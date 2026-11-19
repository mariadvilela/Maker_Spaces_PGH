// Shared Firebase setup for S.P.I.E.S. pages.
//
// Every player gets a Firebase account automatically (anonymous sign-in), so
// ARTI can remember them without a login screen. If they choose "Sign in with
// Google", that anonymous account is upgraded in place, and their memory then
// follows them to any device.
//
// Firestore layout (the team can browse it in the Firebase console):
//   players/{uid}                  name, email, sign-in type, notes ARTI remembers
//   players/{uid}/messages/{id}    every chat message, in order (role, text, at)

import { firebaseConfig, FIREBASE_SDK_VERSION, RECAPTCHA_SITE_KEY, isConfigured } from "./firebase-config.js";

const CDN = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}`;

let ready = null;

// Loads the SDK once and returns { app, auth, db, ai, sdk }.
export function initFirebase() {
  if (!isConfigured()) {
    return Promise.reject(new Error("not-configured"));
  }
  if (!ready) {
    ready = (async () => {
      const [appMod, checkMod, authMod, fsMod, aiMod] = await Promise.all([
        import(`${CDN}/firebase-app.js`),
        import(`${CDN}/firebase-app-check.js`),
        import(`${CDN}/firebase-auth.js`),
        import(`${CDN}/firebase-firestore.js`),
        import(`${CDN}/firebase-ai.js`),
      ]);
      const app = appMod.initializeApp(firebaseConfig);
      startAppCheck(app, checkMod);
      const auth = authMod.getAuth(app);
      const db = fsMod.getFirestore(app);
      const ai = aiMod.getAI(app, { backend: new aiMod.GoogleAIBackend() });
      return { app, auth, db, ai, sdk: { auth: authMod, fs: fsMod, ai: aiMod } };
    })();
  }
  return ready;
}

// App Check proves requests come from our website, not someone else's.
// Firebase won't let ARTI answer without it.
//
// On localhost, reCAPTCHA doesn't work, so App Check uses a "debug token"
// instead. The first time, the browser console prints one: register it in
// Firebase console -> App Check -> Apps -> spies-website -> (menu) ->
// Manage debug tokens. To reuse a token you already registered, run this in
// the browser console once:  localStorage.spiesAppCheckDebugToken = "<token>"
// Never put a debug token in the code: anyone could use it to skip App Check.
function startAppCheck(app, checkMod) {
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
  if (local) {
    let saved = null;
    try {
      saved = localStorage.getItem("spiesAppCheckDebugToken");
    } catch (_) {
      // storage blocked; fall back to a generated token
    }
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = saved || true;
  }
  checkMod.initializeAppCheck(app, {
    provider: new checkMod.ReCaptchaEnterpriseProvider(RECAPTCHA_SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  });
}

// Resolves with the current user, signing in anonymously if needed.
export async function getPlayer() {
  const fb = await initFirebase();
  const { auth, sdk } = fb;
  await auth.authStateReady();
  if (!auth.currentUser) {
    await sdk.auth.signInAnonymously(auth);
  }
  await touchPlayer(auth.currentUser);
  return auth.currentUser;
}

// Creates/updates the player's profile document.
async function touchPlayer(user) {
  const { db, sdk } = await initFirebase();
  const { doc, getDoc, setDoc, serverTimestamp } = sdk.fs;
  const google = user.providerData.find((p) => p.providerId === "google.com");
  const ref = doc(db, "players", user.uid);
  const data = {
    signIn: google ? "google" : "anonymous",
    name: google?.displayName || null,
    email: google?.email || null,
    lastSeen: serverTimestamp(),
  };
  const snap = await getDoc(ref);
  if (!snap.exists() || !snap.data().firstSeen) data.firstSeen = serverTimestamp();
  await setDoc(ref, data, { merge: true });
}

// Google sign-in. Keeps everything ARTI already remembers.
export async function signInWithGoogle() {
  const fb = await initFirebase();
  const { auth, sdk } = fb;
  const provider = new sdk.auth.GoogleAuthProvider();
  const current = auth.currentUser;

  if (current && current.isAnonymous) {
    try {
      // Upgrade the anonymous account in place: same uid, same data.
      const result = await sdk.auth.linkWithPopup(current, provider);
      await touchPlayer(result.user);
      return result.user;
    } catch (err) {
      if (err.code !== "auth/credential-already-in-use") throw err;
      // This Google account was already used on another device. Switch to it
      // and carry over the notes from this device so nothing is lost.
      const oldNotes = await getNotes(current.uid);
      const credential = sdk.auth.GoogleAuthProvider.credentialFromError(err);
      const result = await sdk.auth.signInWithCredential(auth, credential);
      if (oldNotes.length) await addNotes(result.user.uid, oldNotes);
      await touchPlayer(result.user);
      return result.user;
    }
  }

  const result = await sdk.auth.signInWithPopup(auth, provider);
  await touchPlayer(result.user);
  return result.user;
}

export async function signOutPlayer() {
  const { auth, sdk } = await initFirebase();
  await sdk.auth.signOut(auth);
}

// Calls back with the user (or null) whenever sign-in state changes.
export async function onPlayerChange(callback) {
  const { auth, sdk } = await initFirebase();
  return sdk.auth.onAuthStateChanged(auth, callback);
}

// ---- ARTI memory ----

const MAX_NOTES = 60;

export async function getNotes(uid) {
  const { db, sdk } = await initFirebase();
  const snap = await sdk.fs.getDoc(sdk.fs.doc(db, "players", uid));
  const notes = snap.exists() ? snap.data().notes : null;
  return Array.isArray(notes) ? notes : [];
}

export async function addNotes(uid, newNotes) {
  const clean = newNotes
    .map((n) => String(n).trim().slice(0, 300))
    .filter(Boolean);
  if (!clean.length) return getNotes(uid);
  const { db, sdk } = await initFirebase();
  const { doc, setDoc } = sdk.fs;
  const existing = await getNotes(uid);
  const seen = new Set(existing.map((n) => n.toLowerCase()));
  const merged = existing.concat(clean.filter((n) => !seen.has(n.toLowerCase())));
  const notes = merged.slice(-MAX_NOTES);
  await setDoc(doc(db, "players", uid), { notes }, { merge: true });
  return notes;
}

// ---- Chat log ----

export async function saveMessage(uid, role, text, extra = {}) {
  const { db, sdk } = await initFirebase();
  const { collection, addDoc, doc, setDoc, increment, serverTimestamp } = sdk.fs;
  await addDoc(collection(db, "players", uid, "messages"), {
    role, // "player" or "arti"
    text: String(text).slice(0, 4000),
    at: serverTimestamp(),
    page: location.pathname,
    ...extra,
  });
  // Running totals so the team dashboard doesn't have to read every message.
  if (role === "player") {
    await setDoc(
      doc(db, "players", uid),
      { messageCount: increment(1), lastMessageAt: serverTimestamp() },
      { merge: true }
    );
  }
}

export async function getRecentMessages(uid, count) {
  const { db, sdk } = await initFirebase();
  const { collection, query, orderBy, limit, getDocs } = sdk.fs;
  const q = query(
    collection(db, "players", uid, "messages"),
    orderBy("at", "desc"),
    limit(count)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data()).reverse();
}
