// Records that this player opened this page, for the team's progress map.
//
// Add this one line near the end of <body> on any player page:
//   <script type="module" src="js/track.js"></script>
//
// It saves players/{uid}.visited.<page> = first time they opened it.
// Silent: if Firebase is unavailable, the page works exactly the same.

import { isConfigured } from "./firebase-config.js";
import { pageKey } from "./milestones.js";

async function track() {
  if (!isConfigured()) return;
  const fb = await import("./firebase.js");
  const { db, sdk } = await fb.initFirebase();
  const user = await fb.getPlayer();
  const key = pageKey(location.pathname);
  const ref = sdk.fs.doc(db, "players", user.uid);
  const snap = await sdk.fs.getDoc(ref);
  if (snap.exists() && snap.data().visited?.[key]) return; // keep the first visit time
  await sdk.fs.setDoc(ref, { visited: { [key]: sdk.fs.serverTimestamp() } }, { merge: true });
}

track().catch((err) => console.warn("progress tracking skipped:", err?.message || err));
