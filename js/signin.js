// Drop-in Google sign-in button for any page.
//
// Usage: put this anywhere in a page's <body>:
//
//   <button type="button" data-google-signin>Sign in with Google</button>
//   <span data-signin-status></span>
//   <script type="module" src="js/signin.js"></script>
//
// The button hides itself once the player is signed in with Google.
// Signing in keeps everything ARTI already remembers about the player.

import { isConfigured } from "./firebase-config.js";

const buttons = document.querySelectorAll("[data-google-signin]");
const statuses = document.querySelectorAll("[data-signin-status]");

function show(user) {
  const google = user?.providerData?.find((p) => p.providerId === "google.com");
  buttons.forEach((b) => (b.hidden = !!google));
  statuses.forEach((s) => (s.textContent = google ? `Signed in as ${google.email}` : ""));
}

if (!isConfigured()) {
  buttons.forEach((b) => (b.hidden = true));
} else {
  const fb = await import("./firebase.js");
  await fb.getPlayer(); // makes sure an (anonymous) player exists
  await fb.onPlayerChange(show);
  buttons.forEach((b) =>
    b.addEventListener("click", async () => {
      b.disabled = true;
      try {
        await fb.signInWithGoogle();
      } catch (err) {
        if (err?.code !== "auth/popup-closed-by-user") console.error("Google sign-in failed", err);
      } finally {
        b.disabled = false;
      }
    })
  );
}
