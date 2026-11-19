const PASSWORD = "BLUEPRINTS";

const form = document.getElementById("gate-form");
const input = document.getElementById("password");
const error = document.getElementById("password-error");
const gate = document.getElementById("gate");
const database = document.getElementById("database");

form.addEventListener("submit", (event) => {
  event.preventDefault();

  // Ignore capitalization and stray spaces (phones often auto-capitalize).
  const entered = input.value.trim().toUpperCase();

  if (entered === PASSWORD) {
    gate.hidden = true;
    database.hidden = false;
    document.getElementById("database-title").focus();
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