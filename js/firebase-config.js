// S.P.I.E.S. Firebase settings.
//
// Paste the "firebaseConfig" object from:
//   Firebase console -> Project settings -> General -> Your apps -> Web app
// These values are NOT secret. Firebase web config is meant to be public;
// access is controlled by firestore.rules and the console settings.
// (See SETUP.md for the full checklist.)

export const firebaseConfig = {
  apiKey: "AIzaSyC8U49n-i8E69ac_JINaiTI-ziRfkcZejE",
  authDomain: "spies-arg-d64cd.firebaseapp.com",
  projectId: "spies-arg-d64cd",
  storageBucket: "spies-arg-d64cd.firebasestorage.app",
  messagingSenderId: "1000655827828",
  appId: "1:1000655827828:web:826a27f7bb6b0c543d7221",
};

// reCAPTCHA Enterprise site key for Firebase App Check (anti-abuse; players
// never see a puzzle). Firebase requires App Check before ARTI will answer.
// This key is public by design. It only works on the domains listed in
// Google Cloud console -> Security -> Fraud Defense -> Keys -> spies-website.
export const RECAPTCHA_SITE_KEY = "6Lf2VSYuAAAAAInQShPkdQpXS1CYKnlSd_hrwROt";

// Gemini model ARTI uses. gemini-3.5-flash-lite is fast and does not need
// billing on the Gemini Developer API free tier. Change it here if Google
// retires it or you upgrade the project.
export const ARTI_MODEL = "gemini-3.5-flash-lite";

// Firebase JS SDK version loaded from Google's CDN by js/firebase.js.
export const FIREBASE_SDK_VERSION = "13.2.0";

export function isConfigured() {
  return !String(firebaseConfig.apiKey).startsWith("PASTE_");
}
