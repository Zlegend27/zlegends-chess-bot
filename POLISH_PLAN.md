# Polish plan (written 2026-11-14, research session cut short)

Owner's brief: no changes yet; research competitors, compare performance and
layout, then polish. Show each change before it goes live; push only when asked.
Read DESIGN_PRINCIPLES.md before any UI work.

## Measured (phone size 375x812, same browser, first visit unless noted)

| Page | Total | JS | Requests | First paint | Largest paint |
|---|---|---|---|---|---|
| Our home | 216 KB | 181 KB | 13 | 0.96 s | 1.57 s |
| Lichess home | 304 KB | 151 KB | 85 | 0.59 s | 0.64 s |
| Chess.com home | 1,873 KB | 1,513 KB | 228 | 0.77 s | 1.33 s |
| Our /puzzles (cached visit) | 573 KB | 0 | 12 | 0.12 s | 0.25 s |
| Lichess /training | 159 KB | 58 KB | 85 | - | - |
| Chess.com /play/computer | 1,560 KB | 1,337 KB | 251 | load 3.6 s | - |

Findings:
- We are lighter than both, but our largest paint (1.57 s) is slower than
  Lichess (0.64 s): the page is drawn by JS after it loads; Lichess sends HTML.
- /puzzles downloads `public/sweetheart-angry.gif`: 573 KB, bigger than the
  whole home page. Biggest single win.
- Home has 1,361 DOM elements (Lichess 523, Chess.com 599).
- Other heavy images: lesson-coach.webp 176 KB, blueeyes.webp 114 KB,
  sweetheart-full.png 96 KB.

## Layout compared

- In a game (phone): we keep a 57px header AND a 57px bottom bar, the board
  has side margins plus the eval bar, and the page scrolls (892px tall on an
  812px screen) to reach Moves/Analysis. Lichess: board edge to edge (372 of
  375px) right under a 60px header, no bottom bar. Chess.com: scrolls the
  header away so the board fills the screen; has an optional Focus Mode.
  Lichess has Zen mode (board and clock only).
- Puzzles: Lichess opens straight into a puzzle, with themes as a plain list.
  Chess.com lists modes as equal tiles (Rated, Rush, Battle, Daily, Custom).
  Ours: logo, a large animated character and a paragraph fill the first
  screen; the first option starts two thirds down; Daily is highlighted.

## To do next session, in order

1. Bug sweep (NOT DONE this session). Lint, tests, then click through every
   page at phone and desktop size watching the console; read App.jsx game
   flow, PlayView, puzzles, review, lobby. List bugs before fixing.
2. Bundle check (NOT DONE). `npm run build`, list chunk sizes, find what is
   in the 181 KB first load, and check the service worker (first visit showed
   no controller).
3. Puzzles page revamp (owner's spec):
   - Four equal options: Daily puzzle, Ranked puzzles, Puzzle Rush, and
     Chess Tactica puzzles (goes straight to Tactica's puzzle mode: Bin Run
     or Blitz, ask which). Daily must not look like the main one.
   - Art small (a header strip or corner), not most of the screen. Replace
     the 573 KB gif with a small still or short webp/video.
   - Match the rest of the site (same cards as Play page); options visible
     without scrolling on a phone. Keep Leaderboard as a secondary link.
4. Home page declutter (owner's spec): keep Play and Game Review; remove the
   Daily Puzzle card and the "random" third card (currently "Study an
   opening"; confirm with owner that this is the one). Keep the mascot
   greeting, the TV and the vision. Cut DOM size.
5. In-game layout: hide the bottom bar during a game (and consider hiding or
   shrinking the header), make the board wider on phones, and fit board,
   players and controls on one screen without scrolling. Consider a focus
   toggle like Zen mode.
6. Speed: lazy-load below-the-fold home content (TV), compress the heavy
   images, consider prerendering the home shell so first paint doesn't wait
   for JS.
7. Smaller gaps to check against competitors: move sounds/premoves, board
   coordinates, piece drag feel, promotion choice (1v1 auto-queens), resign
   or draw confirmation, keyboard shortcuts.

## Still open from earlier
- Owner to turn on "Allow manual linking" in Supabase and test Connect Google.
- Phone tests: staying logged in, email code in the home-screen app.
- Tactica checklist (tactica-design/test-checklist.md), incl. 1v1 on two phones.
- Chess app Supabase project is oqhioznopfdgiksuwahj (the MCP sees another).

Sources: chess.com forum threads on Focus Mode; lichess.org forum on Zen
mode; support.chess.com "How do puzzles work".

## Session 2 (2026-11-15): sweep results and decisions

Owner's answers: the Tactica puzzle option opens Blitz in the Bin; the home
card to remove is the rotating daily suggestion (it showed "Study an opening").
Building starts once the sweep is done.

Bundle: first load is one 344 KB script (115 KB compressed) + 97 KB CSS (18 KB
compressed). Everything else is on demand (Tactica 824 KB, openings book 479 KB,
puzzles 175 KB, sign-in library 215 KB).

Sweep (15 pages at 375x812 and 10 at 1280x800; a bot game with undo; daily,
ranked and Rush puzzles): no console errors, no sideways overflow, no broken
images, lint clean, 833 tests pass.

Found:
- iOS home-screen app: logging in with Google/Discord while signed out never
  starts the session listener if the sign-in opens in a separate tab (only an
  email code announces itself). Fix: announce in signInWithProvider too.
- Tap targets under 32px: the name pencil in a game (21x17), avatar colour
  swatches (28x28), home footer links (14px tall).
- /puzzles loads a 573 KB gif.
- Most pages have no h1 heading (screen readers, search).
- In a game on a phone the header and bottom bar both stay and the page
  scrolls; in a puzzle the bottom bar hides but the header stays.
- Status line always says "Your move, challenger", even for a named player.
- Back is blocked during a game or puzzle on purpose (not a bug).

### Built in session 2 (awaiting the owner's OK to push)
- Puzzles tab: four equal cards (Daily, Ranked, Rush, Chess Tactica -> Blitz in
  the Bin), site theme, small Sweetheart still (44 KB) instead of the 573 KB
  gif (moved to branding/, not deployed). Blitz exits back to Puzzles.
- Home: Play, Game Review, TV. Daily puzzle and rotating suggestion removed
  (1,361 -> 771 page elements). Footer links easier to tap.
- Sign-in: provider log-in now starts the session listener (iPhone app).
- Avatar swatches 28 -> 32px.

### Still to do
- In-game layout on phones (header stays; bottom bar only hides after the
  first move; page scrolls before that). Decide with owner: hide the bottom
  bar for the whole game screen, and/or a focus toggle.
- Speed: first paint waits for the 344 KB script; consider a static shell.
  Check what the service worker precaches for every visitor (openings book
  479 KB and engine worker 513 KB match its glob).
- h1 headings on pages that lack one.
- "Your move, challenger" for named players.

### Also built in session 2 (pushed 2026-11-15)
- Game screen: bottom bar hidden for the whole game or puzzle (back when the
  game is over or being reviewed); board, controls and move tabs fit a phone.
- First frame: index.html paints the theme background and the header bar
  before the script loads.
- Hidden h1 headings for pages without a visible one (routes.js).
- Status line uses the player's name ("Your move, <name>").

### Left for later
- Shrink the 344 KB first script (find what's in it; no analyser installed).
- A focus toggle that also hides the header in a game (owner hasn't asked).
- Re-measure the live site's first paint after this deploy.
