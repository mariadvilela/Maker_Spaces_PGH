# S.P.I.E.S. website: setup & how-to

Last updated: November 19, 2026

## Account

Everything behind the website (ARTI, player accounts, chat logs) lives in one
Firebase project, owned by this Google account:

- **Email:** arti.arg.test@gmail.com
- **Password:** not stored here (this repo is public). Ask the team lead.

> ⚠️ Anyone with this login controls ARTI, all player data and chat logs.
> Never put the password in this repo.

- **Firebase project:** spies-arg (ID `spies-arg-d64cd`)
- **Firebase console:** https://console.firebase.google.com/project/spies-arg-d64cd
- **Plan:** free (Spark). No payment method is on file, so nothing can be charged.

## What's already set up

| Part | What it does | Where to find it |
|---|---|---|
| Player accounts | Every player gets an account automatically (no login screen). "Sign in with Google" is optional and lets ARTI's memory follow them to any device. | Firebase → Authentication |
| Database | Stores what ARTI remembers about each player and every chat message. | Firebase → Firestore Database |
| ARTI's brain | Gemini (free tier), model `gemini-3.5-flash-lite`. | Firebase → AI Logic |
| Anti-abuse check | Invisible reCAPTCHA that proves requests come from our website. Firebase requires it, or ARTI won't answer. | Firebase → App Check |

The website settings are already filled in, in `js/firebase-config.js`.

## Putting the site online (GitHub Pages)

1. Upload the files to the GitHub repo.
2. Repo **Settings → Pages → Deploy from a branch → `main` / root → Save**.
3. After a few minutes the site is at
   `https://mariadvilela.github.io/SPIES_Chapter_One/`.
4. Open `arti.html` there **on a phone** and send ARTI a message to check it works.

**If the site ever moves to a different web address,** that address must be added in two places,
or ARTI and Google sign-in will stop working there:
- Google Cloud console → Security → Fraud Defense → Keys → `spies-website` → add the domain.
- Firebase → Authentication → Settings → Authorized domains → Add domain.

Already allowed: `mariadvilela.github.io`, `spies-arg-d64cd.web.app`, `spies-arg-d64cd.firebaseapp.com`.

## Testing on your own computer

Double-clicking the files won't work. Use a tiny local server:

1. Open **Terminal** and go to the project folder:
   `cd ~/Desktop/SPIES_Chapter_One-main`
2. Start the server: `python3 -m http.server 8000`
3. In Chrome open **http://localhost:8000/arti.html**
4. Stop the server with **Ctrl + C** when done.

**First time on a new computer or browser:** ARTI won't answer at first, because the anti-abuse
check doesn't work on localhost. Press **Cmd + Option + J**, find the line
"Firebase App Check debug token: ...", and register that code in
Firebase → App Check → Apps → spies-website → ⋮ → **Manage debug tokens**.
Never put a debug token in the code. Delete old ones when you no longer need them.

To try the page layout without Firebase at all (fake replies, nothing saved):
**http://localhost:8000/arti.html?demo**

## Quick test before launch

| Do this | You should see |
|---|---|
| Ask "Who are you?" | A short in-character answer as ARTI |
| Ask something off-topic | ARTI steers back to the mission |
| Tell it a clue ("I found a code on the radio") | A reply plus **[ Saved to agent file ]** |
| Reload the page | "Restoring previous session" and your old messages |
| Ask "What have I found so far?" | ARTI lists the clue |
| Tap **Agent file** | The clue is listed there too |

## Team dashboard (monitor players)

Open **`dashboard.html`** on the site (for example
`https://mariadvilela.github.io/SPIES_Chapter_One/dashboard.html`) and sign in with Google.
It's not linked from any player page.

It shows, updating live:
- totals: players, active in the last 24 hours, Google sign-ins, messages to ARTI, clues saved
- every player, newest activity first, with a search box (name, email, ID or clue text)
- click a player: their details, every clue ARTI saved, and their full chat
- **Export CSV** (all players) and **Download chat** (one player) for reports
- a **progress map** of the Chapter 1 route, with each player shown at the furthest
  station they've reached (see below)

**Who can see it:** only Google accounts on the team list. Players can't read anyone else's
data even if they find the page; the database rules block it.
To add a team member: Firebase → **Firestore Database → Data → admins → Add document**,
**Document ID** = their Google email in lowercase, add any field (e.g. `name` = their name), Save.
Delete the document to remove access. The team account (arti.arg.test@gmail.com) is already on it.

## Progress map

The map's stations are listed in **`js/milestones.js`**, in order. A player reaches a station when:
- they **open a page** (each player page has one line, `<script type="module" src="js/track.js"></script>`,
  that records the first time they open it), or
- a **clue ARTI saved** for them contains certain words (e.g. "coordinates"), or
- they've **sent ARTI a message**, or
- a team member clicks **Mark done** on the dashboard (for in-person events like the
  Science Center and Open Lab visits: open the player, then use the Progress checklist).

**When you add a new page,** paste that `track.js` line before `</body>`, and add or edit a
station in `js/milestones.js` (copy an existing line and change the page name).
Blueprint pages `energysource`, `mobility` and `chassis` are already on the map; they'll
start counting as soon as those pages exist (each needs the `track.js` line).

## Reading players' chats in Firebase directly

Firebase → **Firestore Database → Data → players → (a player) → messages**.
Each message shows who sent it (`player` or `arti`), the text, and the time.
`remembered` shows notes ARTI saved. Players who signed in with Google show their name and email.
Players can't edit or delete their chats.

The two players already in the database are from testing and can be deleted.

## Changing what ARTI knows or how it behaves

Edit **`js/arti-prompt.js`** (any text editor works):
- `ARTI_LORE`: story facts ARTI knows
- `HINTS`: vague nudges ARTI may give stuck players
- `ACCESS_CODES`: optional codes, the way the original ARTI worked
- The **RULES** section: personality and limits (for example, ARTI never decodes clues for players)

Anything in that file can be seen in the page source, so don't put final answers there.

## Sign-in button on other pages

`arti.html` already has one (inside **Agent file**). To add it to another page:

```html
<button type="button" data-google-signin>Sign in with Google</button>
<span data-signin-status></span>
<script type="module" src="js/signin.js"></script>
```

(`index.html` is a frameset and can't hold a button. Use `landing.html` or `home.html`.)

## Limits to know

- **Speed limits on the free tier.** If a whole class messages ARTI at the same moment, some
  may see "ARTI's circuits are overloaded" (it retries once automatically). If that happens a lot,
  upgrade the Firebase project to the Blaze plan and set a spending cap.
- **reCAPTCHA free tier:** 10,000 checks a month (a player uses about one per 30 minutes of play).
- **Not built yet:** a log of which pages each player visits (low priority).
