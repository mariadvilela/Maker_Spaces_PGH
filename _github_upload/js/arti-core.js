// Pure helpers for ARTI (no DOM, no Firebase), so they can be tested alone.

// How many past messages are sent to Gemini with each new message.
export const HISTORY_LIMIT = 20;

// Turns saved messages + the new one into Gemini "contents".
// Gemini wants the conversation to start with the user and alternate roles,
// so leading ARTI messages are dropped and same-role runs are merged.
export function buildContents(history, newText) {
  const turns = history
    .slice(-HISTORY_LIMIT)
    .filter((m) => m && typeof m.text === "string" && m.text.trim())
    .map((m) => ({ role: m.role === "arti" ? "model" : "user", text: m.text }));
  turns.push({ role: "user", text: newText });

  while (turns.length && turns[0].role !== "user") turns.shift();

  const merged = [];
  for (const t of turns) {
    const last = merged[merged.length - 1];
    if (last && last.role === t.role) {
      last.parts[0].text += "\n" + t.text;
    } else {
      merged.push({ role: t.role, parts: [{ text: t.text }] });
    }
  }
  return merged;
}

// Reads ARTI's JSON answer. Falls back to treating the whole text as the
// reply if the model ever returns something that isn't valid JSON.
export function parseReply(raw) {
  const text = String(raw ?? "").trim();
  const stripped = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    const data = JSON.parse(stripped);
    const reply = typeof data.reply === "string" ? data.reply.trim() : "";
    const remember = Array.isArray(data.remember)
      ? data.remember.filter((n) => typeof n === "string" && n.trim()).map((n) => n.trim())
      : [];
    if (reply) return { reply, remember };
  } catch (_) {
    // fall through
  }
  return { reply: text || "...", remember: [] };
}

// Sorts an error from the Gemini call into something we can show in-character.
export function classifyError(err) {
  const msg = String(err?.message || err || "").toLowerCase();
  const code = String(err?.code || "").toLowerCase();
  if (msg.includes("429") || msg.includes("quota") || msg.includes("resource_exhausted") || msg.includes("rate")) {
    return "busy";
  }
  if (code.includes("not-configured") || msg.includes("not-configured")) return "offline";
  if (msg.includes("api has not been used") || msg.includes("permission") || msg.includes("403")) {
    return "setup";
  }
  if (msg.includes("safety") || msg.includes("blocked")) return "blocked";
  return "error";
}

export const ERROR_TEXT = {
  busy: "ARTI's circuits are overloaded. Wait a minute and try again.",
  offline: "ARTI is offline. (Firebase isn't configured yet. See SETUP.md.)",
  setup: "ARTI can't reach its core. (Check that Firebase AI Logic is enabled. See SETUP.md.)",
  blocked: "ARTI can't respond to that. Try asking another way.",
  error: "Connection to ARTI lost. Try again.",
};
