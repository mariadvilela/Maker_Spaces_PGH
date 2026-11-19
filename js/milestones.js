// Chapter 1 progress map: the stations a player passes through, in order.
// The team dashboard (dashboard.html) uses this list to place each player on
// the map. Edit it as puzzles are added: no other file needs to change.
//
// Each station is reached when ANY of its checks is true:
//   pages:    the player opened one of these pages (file name without .html)
//   clues:    a clue ARTI saved for the player contains one of these words
//   messages: the player has sent at least this many messages to ARTI
//   manual:   a team member ticks it on the dashboard (in-person events)
//
// side: true  -> optional side content; shown as a badge, not a map station.

export const MILESTONES = [
  { id: "cover", label: "Found the cover site", pages: ["landing", "index"] },
  { id: "terminal", label: "Found the hidden terminal", pages: ["idtap"] },
  { id: "home", label: "Entered S.P.I.E.S. home", pages: ["home"] },
  { id: "arti", label: "Talked to ARTI", messages: 1 },
  { id: "science-center", label: "Science Center visit (11/20)", manual: true },
  { id: "radio", label: "Listened to the radio", pages: ["radio"] },
  { id: "coordinates", label: "Found the coordinates", clues: ["40 26", "40°26", "coordinates"] },
  { id: "blueprints-found", label: "Found the blueprint database", pages: ["blueprinthome"] },
  {
    id: "blueprints-unlocked",
    label: "Unlocked the blueprints",
    pages: ["energysource", "mobility", "chassis"],
  },
  { id: "bp-energy", label: "Blueprint: energy source", pages: ["energysource"] },
  { id: "bp-mobility", label: "Blueprint: mobility", pages: ["mobility"] },
  { id: "bp-chassis", label: "Blueprint: chassis", pages: ["chassis"] },
  { id: "open-lab", label: "Open Lab visit (11/30)", manual: true },
  { id: "rescue", label: "Robot built, Natalie rescued", manual: true },
  { id: "festival", label: "Fall Festival (12/4)", manual: true },

  { id: "author", label: "Read the author page", pages: ["author"], side: true },
];

// The key a page is stored under in players/{uid}.visited.
// "/SPIES_Chapter_One/home.html" -> "home"; "/" -> "index".
export function pageKey(pathname) {
  const file = String(pathname || "").split("/").pop() || "index.html";
  return file.replace(/\.html?$/i, "").replace(/[^a-z0-9_-]/gi, "_").toLowerCase() || "index";
}

function toMillis(ts) {
  if (!ts) return null;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (typeof ts.toDate === "function") return ts.toDate().getTime();
  const n = new Date(ts).getTime();
  return isNaN(n) ? null : n;
}

// For one player, which stations are reached and when (null time = unknown).
export function progressFor(player) {
  const visited = player.visited || {};
  const notes = (player.notes || []).map((n) => String(n).toLowerCase());
  const manual = player.milestones || {};

  return MILESTONES.map((m) => {
    let reached = false;
    let at = null;

    for (const page of m.pages || []) {
      if (visited[page]) {
        reached = true;
        const t = toMillis(visited[page]);
        if (t && (!at || t < at)) at = t;
      }
    }
    if (!reached && m.clues?.some((c) => notes.some((n) => n.includes(c.toLowerCase())))) {
      reached = true;
    }
    if (!reached && m.messages && (player.messageCount || 0) >= m.messages) {
      reached = true;
      at = toMillis(player.lastMessageAt);
    }
    if (m.manual && manual[m.id]) {
      reached = true;
      at = toMillis(manual[m.id]) || at;
    }
    return { ...m, reached, at };
  });
}

// Index (in MILESTONES) of the furthest main-route station reached, or -1.
export function furthestIndex(progress) {
  let best = -1;
  progress.forEach((m, i) => {
    if (m.reached && !m.side) best = i;
  });
  return best;
}

export const MAIN_ROUTE = MILESTONES.map((m, i) => ({ ...m, index: i })).filter((m) => !m.side);
