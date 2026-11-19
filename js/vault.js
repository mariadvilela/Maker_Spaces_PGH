// Password gate for the locked blueprint pages (cranium, locomotion, core).
// Each page sets its own password(s) in the data-passwords attribute on
// <main id="vault">, separated by commas. Capitalization and stray spaces
// are ignored.
//
// NOTE: this runs in the browser, so the password and the image address are
// visible to anyone who views the page source. That's fine for a game gate,
// not for real secrets.
const vault = document.getElementById("vault");
const PASSWORDS = vault.dataset.passwords
  .split(",")
  .map((p) => p.trim().toUpperCase())
  .filter(Boolean);

const form = document.getElementById("gate-form");
const input = document.getElementById("password");
const error = document.getElementById("password-error");
const gate = document.getElementById("gate");
const reveal = document.getElementById("reveal");
const image = document.getElementById("blueprint-image");

form.addEventListener("submit", (event) => {
  event.preventDefault();

  if (PASSWORDS.includes(input.value.trim().toUpperCase())) {
    // The image is only loaded now, so it isn't fetched before unlocking.
    image.src = image.dataset.src;
    gate.hidden = true;
    reveal.hidden = false;
    document.getElementById("reveal-title").focus();
  } else {
    error.textContent = "incorrect password!";
    input.value = "";
    input.focus();
  }
});

// Clear the error as soon as they start typing again.
input.addEventListener("input", () => {
  error.textContent = "";
});