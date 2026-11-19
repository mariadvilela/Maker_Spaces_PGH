// Team dashboard: live view of every player, their saved clues and chats.
//
// Access: sign in with Google. Only accounts listed in Firestore's "admins"
// collection can read player data (enforced by firestore.rules, not just
// this page). To add a team member: Firebase console -> Firestore Database ->
// admins -> Add document -> Document ID = their Google email (lowercase).

import { initFirebase } from "./firebase.js";
import { MILESTONES, MAIN_ROUTE, progressFor, furthestIndex } from "./milestones.js";

const $ = (id) => document.getElementById(id);

const els = {
  gate: $("gate"),
  gateText: $("gate-text"),
  signIn: $("sign-in"),
  signOut: $("sign-out"),
  account: $("account"),
  accountEmail: $("account-email"),
  dashboard: $("dashboard"),
  rows: $("player-rows"),
  noPlayers: $("no-players"),
  search: $("search"),
  exportCsv: $("export-csv"),
  detailEmpty: $("detail-empty"),
  detailBody: $("detail-body"),
  detailName: $("detail-name"),
  detailFacts: $("detail-facts"),
  detailNotes: $("detail-notes"),
  detailProgress: $("detail-progress"),
  route: $("route"),
  transcript: $("detail-transcript"),
  exportTranscript: $("export-transcript"),
  stat: {
    players: $("stat-players"),
    active: $("stat-active"),
    google: $("stat-google"),
    messages: $("stat-messages"),
    notes: $("stat-notes"),
  },
};

const state = {
  fb: null,
  players: [], // [{ id, ...data }]
  selectedId: null,
  messages: [],
  stopPlayers: null,
  stopMessages: null,
};

// ---------- Formatting helpers ----------

function toDate(ts) {
  if (!ts) return null;
  if (typeof ts.toDate === "function") return ts.toDate();
  const d = new Date(ts);
  return isNaN(d) ? null : d;
}

function ago(ts) {
  const d = toDate(ts);
  if (!d) return "—";
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

function full(ts) {
  const d = toDate(ts);
  return d ? d.toLocaleString() : "—";
}

function displayName(p) {
  return p.name || p.email || `Agent ${p.id.slice(0, 6)}`;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text; // never innerHTML: player text is untrusted
  return node;
}

function download(filename, text, type) {
  const blob = new Blob([text], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---------- Players list ----------

function filteredPlayers() {
  const q = els.search.value.trim().toLowerCase();
  if (!q) return state.players;
  return state.players.filter((p) =>
    [p.id, p.name, p.email, ...(p.notes || [])]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q))
  );
}

function renderStats() {
  const day = Date.now() - 24 * 3600 * 1000;
  const ps = state.players;
  els.stat.players.textContent = ps.length;
  els.stat.active.textContent = ps.filter((p) => (toDate(p.lastSeen)?.getTime() || 0) > day).length;
  els.stat.google.textContent = ps.filter((p) => p.signIn === "google").length;
  els.stat.messages.textContent = ps.reduce((n, p) => n + (p.messageCount || 0), 0);
  els.stat.notes.textContent = ps.reduce((n, p) => n + (p.notes?.length || 0), 0);
}

function renderRows() {
  const list = filteredPlayers();
  els.rows.replaceChildren();
  els.noPlayers.hidden = list.length > 0;
  els.noPlayers.textContent = state.players.length ? "No players match your search." : "No players yet.";

  for (const p of list) {
    const tr = document.createElement("tr");
    tr.tabIndex = 0;
    if (p.id === state.selectedId) tr.className = "selected";

    const who = el("td");
    const name = el("span", "who-name", displayName(p));
    if (p.signIn === "google") name.appendChild(el("span", "badge", "Google"));
    who.appendChild(name);
    who.appendChild(el("span", "who-sub", p.email && p.name ? p.email : p.id));
    const stage = furthestIndex(progressFor(p));
    who.appendChild(el("span", "who-sub", `📍 ${stage >= 0 ? MILESTONES[stage].label : "Not started"}`));

    const seen = el("td", "", ago(p.lastSeen));
    seen.title = full(p.lastSeen);

    tr.append(
      who,
      seen,
      el("td", "num", p.messageCount ?? "—"),
      el("td", "num", p.notes?.length || 0)
    );
    tr.addEventListener("click", () => selectPlayer(p.id));
    tr.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        selectPlayer(p.id);
      }
    });
    els.rows.appendChild(tr);
  }
}

function exportCsv() {
  const cols = ["player_id", "name", "email", "sign_in", "first_seen", "last_seen", "furthest_station", "stations_reached", "messages_sent", "clues_saved", "clues"];
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [cols.join(",")];
  for (const p of state.players) {
    lines.push(
      [
        p.id,
        p.name,
        p.email,
        p.signIn,
        toDate(p.firstSeen)?.toISOString() || "",
        toDate(p.lastSeen)?.toISOString() || "",
        (() => {
          const i = furthestIndex(progressFor(p));
          return i >= 0 ? MILESTONES[i].label : "Not started";
        })(),
        progressFor(p)
          .filter((m) => m.reached)
          .map((m) => m.label)
          .join(" | "),
        p.messageCount ?? "",
        p.notes?.length || 0,
        (p.notes || []).join(" | "),
      ]
        .map(esc)
        .join(",")
    );
  }
  download(`spies-players-${new Date().toISOString().slice(0, 10)}.csv`, lines.join("\n"), "text/csv");
}

// ---------- Progress map ----------

const CHIP_LIMIT = 8;

function renderMap() {
  // Group players by their furthest main-route station (-1 = not started).
  const groups = new Map();
  for (const p of state.players) {
    const i = furthestIndex(progressFor(p));
    if (!groups.has(i)) groups.set(i, []);
    groups.get(i).push(p);
  }
  const furthestOverall = Math.max(-1, ...groups.keys());

  els.route.replaceChildren();
  const stations = [{ id: "_start", label: "Not started", index: -1 }, ...MAIN_ROUTE];

  stations.forEach((st, n) => {
    const here = groups.get(st.index) || [];
    const li = el("li", "station");
    if (here.length) li.classList.add("has-players");
    if (st.manual) li.classList.add("manual");
    if (st.index <= furthestOverall && st.index >= 0) li.classList.add("reached-by-some");

    const count = `${here.length} player${here.length === 1 ? "" : "s"}`;
    const node = el("div", "node", n === 0 ? "–" : String(n));
    node.title = `${count} here`;
    li.appendChild(node);

    const label = el("span", "station-label", st.label);
    if (st.manual) label.appendChild(el("small", "", "ticked by team"));
    li.appendChild(label);
    if (here.length) li.appendChild(el("span", "station-count", count));

    const chips = el("ul", "chips");
    here.slice(0, CHIP_LIMIT).forEach((p) => {
      const item = el("li");
      const b = el("button", "chip" + (p.id === state.selectedId ? " selected" : ""), displayName(p));
      b.type = "button";
      b.title = `${displayName(p)}: last seen ${ago(p.lastSeen)}`;
      b.addEventListener("click", () => selectPlayer(p.id));
      item.appendChild(b);
      chips.appendChild(item);
    });
    if (here.length > CHIP_LIMIT) {
      chips.appendChild(el("li", "chip-more", `+${here.length - CHIP_LIMIT} more`));
    }
    li.appendChild(chips);
    els.route.appendChild(li);
  });
}

async function toggleMilestone(playerId, milestoneId, on) {
  const { db, sdk } = state.fb;
  const { doc, updateDoc, FieldPath, serverTimestamp, deleteField } = sdk.fs;
  try {
    await updateDoc(
      doc(db, "players", playerId),
      new FieldPath("milestones", milestoneId),
      on ? serverTimestamp() : deleteField()
    );
  } catch (err) {
    console.error("milestone", err);
    alertInline("Couldn't update that milestone. Check you're signed in as a team member.");
  }
}

function alertInline(text) {
  els.detailProgress.parentElement.insertBefore(el("p", "empty", text), els.detailProgress);
}

function renderChecklist(p) {
  els.detailProgress.replaceChildren();
  for (const m of progressFor(p)) {
    const li = el("li", m.reached ? "done" : "");
    li.appendChild(el("span", "mark", m.reached ? "✓" : "○"));
    li.appendChild(el("span", "what", m.label));
    if (m.side) li.appendChild(el("span", "side-tag", "side"));
    if (m.manual) {
      const ticked = !!p.milestones?.[m.id];
      const b = el("button", "ghost toggle", ticked ? "Untick" : "Mark done");
      b.type = "button";
      b.addEventListener("click", () => toggleMilestone(p.id, m.id, !ticked));
      li.appendChild(b);
    }
    li.appendChild(el("span", "when", m.at ? ago(m.at) : ""));
    els.detailProgress.appendChild(li);
  }
}

// ---------- Player detail ----------

function renderDetail() {
  const p = state.players.find((x) => x.id === state.selectedId);
  els.detailEmpty.hidden = !!p;
  els.detailBody.hidden = !p;
  if (!p) return;

  els.detailName.textContent = displayName(p);

  els.detailFacts.replaceChildren();
  const facts = [
    ["Player ID", p.id],
    ["Sign-in", p.signIn === "google" ? "Google" : "Automatic (this device only)"],
    ["Email", p.email || "—"],
    ["First seen", full(p.firstSeen)],
    ["Last seen", full(p.lastSeen)],
    ["Last message", full(p.lastMessageAt)],
    ["Messages sent", p.messageCount ?? "—"],
  ];
  for (const [k, v] of facts) {
    els.detailFacts.append(el("dt", "", k), el("dd", "", v));
  }

  renderChecklist(p);

  els.detailNotes.replaceChildren();
  if (!p.notes?.length) {
    els.detailNotes.appendChild(el("li", "", "Nothing saved yet."));
  } else {
    for (const n of p.notes) els.detailNotes.appendChild(el("li", "", n));
  }
}

function renderTranscript() {
  els.transcript.replaceChildren();
  if (!state.messages.length) {
    els.transcript.appendChild(el("p", "empty", "No messages yet."));
    return;
  }
  for (const m of state.messages) {
    const box = el("div", `msg ${m.role === "arti" ? "arti" : "player"}`);
    box.appendChild(el("span", "meta", `${m.role === "arti" ? "ARTI" : "Player"} · ${full(m.at)}`));
    box.appendChild(document.createTextNode(m.text || ""));
    if (m.remembered?.length) {
      box.appendChild(el("span", "saved", `Saved: ${m.remembered.join(" · ")}`));
    }
    els.transcript.appendChild(box);
  }
  els.transcript.scrollTop = els.transcript.scrollHeight;
}

function selectPlayer(id) {
  state.selectedId = id;
  renderMap();
  renderRows();
  renderDetail();

  if (state.stopMessages) state.stopMessages();
  state.messages = [];
  renderTranscript();

  const { db, sdk } = state.fb;
  const { collection, query, orderBy, onSnapshot } = sdk.fs;
  state.stopMessages = onSnapshot(
    query(collection(db, "players", id, "messages"), orderBy("at", "asc")),
    (snap) => {
      state.messages = snap.docs.map((d) => d.data());
      renderTranscript();
    },
    (err) => {
      console.error("messages", err);
      els.transcript.replaceChildren(el("p", "empty", "Couldn't load this chat."));
    }
  );
}

function exportTranscript() {
  const p = state.players.find((x) => x.id === state.selectedId);
  if (!p) return;
  const lines = [
    `S.P.I.E.S. chat log: ${displayName(p)} (${p.id})`,
    `Exported ${new Date().toLocaleString()}`,
    "",
    "Clues saved:",
    ...(p.notes?.length ? p.notes.map((n) => `- ${n}`) : ["- (none)"]),
    "",
    "Chat:",
  ];
  for (const m of state.messages) {
    lines.push(`[${full(m.at)}] ${m.role === "arti" ? "ARTI" : "PLAYER"}: ${m.text}`);
  }
  download(`spies-chat-${p.id.slice(0, 8)}.txt`, lines.join("\n"), "text/plain");
}

// ---------- Access ----------

function showGate(text) {
  els.gate.hidden = false;
  els.dashboard.hidden = true;
  els.gateText.textContent = text;
  if (state.stopPlayers) state.stopPlayers();
  if (state.stopMessages) state.stopMessages();
  state.stopPlayers = state.stopMessages = null;
}

async function isAdmin(user) {
  if (!user?.email) return false;
  const { db, sdk } = state.fb;
  try {
    const snap = await sdk.fs.getDoc(sdk.fs.doc(db, "admins", user.email.toLowerCase()));
    return snap.exists();
  } catch (err) {
    console.error("admin check", err);
    return false;
  }
}

function startLiveData() {
  const { db, sdk } = state.fb;
  const { collection, query, orderBy, onSnapshot } = sdk.fs;
  state.stopPlayers = onSnapshot(
    query(collection(db, "players"), orderBy("lastSeen", "desc")),
    (snap) => {
      state.players = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderStats();
      renderMap();
      renderRows();
      renderDetail();
    },
    (err) => {
      console.error("players", err);
      showGate("Couldn't load player data. Your account may not be approved yet.");
    }
  );
}

async function onUser(user) {
  els.account.hidden = !user || user.isAnonymous;
  els.accountEmail.textContent = user?.email || "";

  if (!user || user.isAnonymous) {
    showGate("Sign in with an approved Google account to see player activity.");
    return;
  }
  if (!(await isAdmin(user))) {
    showGate(
      `${user.email} isn't on the team list. Ask whoever manages Firebase to add it ` +
        `(Firestore Database → admins → Add document → ID = this email).`
    );
    return;
  }
  els.gate.hidden = true;
  els.dashboard.hidden = false;
  if (!state.stopPlayers) startLiveData();
}

async function start() {
  try {
    state.fb = await initFirebase();
  } catch (err) {
    console.error(err);
    showGate("Firebase isn't configured. See SETUP.md.");
    els.signIn.hidden = true;
    return;
  }
  const { auth, sdk } = state.fb;

  els.signIn.addEventListener("click", async () => {
    els.signIn.disabled = true;
    try {
      const provider = new sdk.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await sdk.auth.signInWithPopup(auth, provider);
    } catch (err) {
      if (err?.code !== "auth/popup-closed-by-user" && err?.code !== "auth/cancelled-popup-request") {
        console.error("sign-in", err);
        els.gateText.textContent = "Sign-in didn't work. Try again.";
      }
    } finally {
      els.signIn.disabled = false;
    }
  });

  els.signOut.addEventListener("click", () => sdk.auth.signOut(auth));
  els.search.addEventListener("input", renderRows);
  els.exportCsv.addEventListener("click", exportCsv);
  els.exportTranscript.addEventListener("click", exportTranscript);

  sdk.auth.onAuthStateChanged(auth, onUser);
}

start();
