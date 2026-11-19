// A.R.T.I. chat page.
//
// Flow for each message:
//   1. Show and save the player's message (players/{uid}/messages).
//   2. Send ARTI's instructions + saved notes + recent conversation to Gemini.
//   3. Gemini answers with JSON: what ARTI says, and any new notes to remember.
//   4. Show the reply, save it, and add the notes to players/{uid}.notes.
//
// Open arti.html?demo to try the page without Firebase (fake replies).

import { ARTI_MODEL, isConfigured } from "./firebase-config.js";
import { buildSystemPrompt } from "./arti-prompt.js";
import { buildContents, parseReply, classifyError, ERROR_TEXT, HISTORY_LIMIT } from "./arti-core.js";

const GREETING =
  "A.R.T.I. online. Agent, Agent N is still missing. Tell me anything you discover and I will keep it on file. Ask me what you've found at any time.";

const els = {
  log: document.getElementById("chat-log"),
  form: document.getElementById("chat-form"),
  input: document.getElementById("chat-input"),
  send: document.getElementById("send-button"),
  memoryToggle: document.getElementById("memory-toggle"),
  memoryPanel: document.getElementById("memory-panel"),
  memoryList: document.getElementById("memory-list"),
  accountStatus: document.getElementById("account-status"),
  googleButton: document.getElementById("google-button"),
};

const state = {
  backend: null, // real or demo, see below
  notes: [],
  history: [], // [{ role: "player" | "arti", text }]
  busy: false,
};

// ---------- Rendering ----------

function addMessage(role, text, { saved = [], thinking = false } = {}) {
  const div = document.createElement("div");
  div.className = `message ${role}` + (thinking ? " thinking" : "");
  if (role !== "system") {
    const who = document.createElement("span");
    who.className = "who";
    who.textContent = role === "arti" ? "A.R.T.I." : "You";
    div.appendChild(who);
  }
  const body = document.createElement("span");
  body.className = thinking ? "dots" : "";
  body.textContent = text; // textContent, never innerHTML: player text is untrusted
  div.appendChild(body);
  if (saved.length) {
    const note = document.createElement("span");
    note.className = "saved-note";
    note.textContent = saved.length === 1 ? "[ Saved to agent file ]" : `[ ${saved.length} items saved to agent file ]`;
    div.appendChild(note);
  }
  els.log.appendChild(div);
  els.log.scrollTop = els.log.scrollHeight;
  return div;
}

function renderMemory() {
  els.memoryList.replaceChildren();
  if (!state.notes.length) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "Nothing on file yet. Tell ARTI what you discover.";
    els.memoryList.appendChild(li);
    return;
  }
  for (const n of state.notes) {
    const li = document.createElement("li");
    li.textContent = n;
    els.memoryList.appendChild(li);
  }
}

function setBusy(busy) {
  state.busy = busy;
  els.input.disabled = busy;
  els.send.disabled = busy;
  if (!busy) els.input.focus();
}

function autoGrow() {
  els.input.style.height = "auto";
  els.input.style.height = Math.min(els.input.scrollHeight, window.innerHeight * 0.3) + "px";
}

// ---------- Backends ----------

// Real backend: Firebase Auth + Firestore + Gemini through Firebase AI Logic.
async function realBackend() {
  const fb = await import("./firebase.js");
  const { ai, sdk } = await fb.initFirebase();
  const user = await fb.getPlayer();
  const [notes, history] = await Promise.all([
    fb.getNotes(user.uid),
    fb.getRecentMessages(user.uid, HISTORY_LIMIT),
  ]);

  const { Schema, getGenerativeModel } = sdk.ai;
  const responseSchema = Schema.object({
    properties: {
      reply: Schema.string(),
      remember: Schema.array({ items: Schema.string() }),
    },
  });

  return {
    notes,
    history: history.map((m) => ({ role: m.role, text: m.text })),
    uid: () => user.uid,

    async ask(text, notesNow, historyNow) {
      const model = getGenerativeModel(ai, {
        model: ARTI_MODEL,
        systemInstruction: buildSystemPrompt({ notes: notesNow }),
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema,
          maxOutputTokens: 400,
        },
      });
      const result = await model.generateContent({ contents: buildContents(historyNow, text) });
      return parseReply(result.response.text());
    },

    saveMessage: (role, text, extra) => fb.saveMessage(fb_uid(), role, text, extra),
    addNotes: (newNotes) => fb.addNotes(fb_uid(), newNotes),

    account: {
      describe() {
        const u = fbAuthUser();
        if (!u) return "Not connected.";
        if (u.isAnonymous) {
          return "ARTI remembers you on this device only. Sign in with Google to keep your agent file on any device.";
        }
        const g = u.providerData.find((p) => p.providerId === "google.com");
        return `Signed in as ${g?.email || u.email || "Google agent"}. Your agent file follows you to any device.`;
      },
      canSignIn: () => !!fbAuthUser()?.isAnonymous,
      async signIn() {
        await fb.signInWithGoogle();
      },
      reload: async () => fb.getNotes(fb_uid()),
    },
  };

  function fbAuthUser() {
    return sdk.auth.getAuth().currentUser;
  }
  function fb_uid() {
    return fbAuthUser()?.uid || user.uid;
  }
}

// Demo backend: no network. Lets the team check the page layout.
function demoBackend() {
  let demoNotes = [];
  return {
    notes: [],
    history: [],
    async ask(text, notesNow) {
      await new Promise((r) => setTimeout(r, 600));
      const t = text.toLowerCase();
      if (/(what|recap|remember|found|know)\b.*\?|^recap/.test(t) && !/remember (that|this)/.test(t)) {
        return {
          reply: notesNow.length
            ? "Agent file:\n" + notesNow.map((n) => "- " + n).join("\n")
            : "Your agent file is empty.",
          remember: [],
        };
      }
      if (/(found|discovered|figured|remember|clue|code)/.test(t)) {
        return { reply: "Logged. I will keep that on file. (demo)", remember: ["Agent reported: " + text] };
      }
      return { reply: "[DEMO MODE] ARTI is not connected to Gemini. Try: \"I found a code\" then \"what have I found?\"", remember: [] };
    },
    saveMessage: async () => {},
    addNotes: async (n) => {
      demoNotes = demoNotes.concat(n);
      return demoNotes;
    },
    account: {
      describe: () => "Demo mode: nothing is saved.",
      canSignIn: () => false,
      signIn: async () => {},
      reload: async () => demoNotes,
    },
  };
}

// ---------- Sending ----------

async function askWithRetry(text) {
  try {
    return await state.backend.ask(text, state.notes, state.history);
  } catch (err) {
    if (classifyError(err) !== "busy") throw err;
    await new Promise((r) => setTimeout(r, 4000));
    return state.backend.ask(text, state.notes, state.history);
  }
}

async function send(text) {
  setBusy(true);
  addMessage("player", text);
  state.backend.saveMessage("player", text).catch((e) => console.error("save failed", e));

  const thinking = addMessage("arti", "Processing", { thinking: true });
  try {
    const { reply, remember } = await askWithRetry(text);
    thinking.remove();

    let saved = [];
    if (remember.length) {
      const before = new Set(state.notes.map((n) => n.toLowerCase()));
      saved = remember.filter((n) => !before.has(n.toLowerCase()));
      try {
        state.notes = await state.backend.addNotes(remember);
      } catch (e) {
        console.error("note save failed", e);
        saved = [];
      }
      renderMemory();
    }

    addMessage("arti", reply, { saved });
    state.history.push({ role: "player", text }, { role: "arti", text: reply });
    state.backend
      .saveMessage("arti", reply, saved.length ? { remembered: saved } : {})
      .catch((e) => console.error("save failed", e));
  } catch (err) {
    console.error("ARTI error", err);
    thinking.remove();
    addMessage("system", ERROR_TEXT[classifyError(err)]);
    // Keep the player's message in history so the next try has context.
    state.history.push({ role: "player", text });
  } finally {
    setBusy(false);
  }
}

// ---------- Account / memory panel ----------

function renderAccount() {
  els.accountStatus.textContent = state.backend.account.describe();
  els.googleButton.hidden = !state.backend.account.canSignIn();
}

els.memoryToggle.addEventListener("click", () => {
  const open = els.memoryPanel.hidden;
  els.memoryPanel.hidden = !open;
  els.memoryToggle.setAttribute("aria-expanded", String(open));
});

els.googleButton.addEventListener("click", async () => {
  els.googleButton.disabled = true;
  try {
    await state.backend.account.signIn();
    state.notes = await state.backend.account.reload();
    renderMemory();
  } catch (err) {
    console.error("Google sign-in failed", err);
    if (err?.code !== "auth/popup-closed-by-user" && err?.code !== "auth/cancelled-popup-request") {
      addMessage("system", "Google sign-in didn't work. Your agent file is still saved on this device.");
    }
  } finally {
    els.googleButton.disabled = false;
    renderAccount();
  }
});

// ---------- Input ----------

els.form.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = els.input.value.trim();
  if (!text || state.busy) return;
  els.input.value = "";
  autoGrow();
  send(text);
});

els.input.addEventListener("input", autoGrow);
els.input.addEventListener("keydown", (e) => {
  // Enter sends, Shift+Enter makes a new line (desktop).
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    els.form.requestSubmit();
  }
});

// ---------- Start ----------

async function start() {
  const demo = new URLSearchParams(location.search).has("demo");
  try {
    if (!isConfigured() && !demo) throw Object.assign(new Error("not-configured"), { code: "not-configured" });
    state.backend = demo ? demoBackend() : await realBackend();
  } catch (err) {
    console.error("ARTI failed to start", err);
    addMessage("system", ERROR_TEXT[classifyError(err)]);
    return;
  }

  state.notes = state.backend.notes;
  state.history = state.backend.history;
  renderMemory();
  renderAccount();

  if (state.history.length) {
    addMessage("system", "Restoring previous session");
    for (const m of state.history) addMessage(m.role === "arti" ? "arti" : "player", m.text);
  } else {
    addMessage("arti", GREETING);
  }
  setBusy(false);
}

start();
