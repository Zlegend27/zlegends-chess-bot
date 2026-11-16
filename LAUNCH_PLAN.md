# Launch plan (written 2026-11-15)

What's left before opening the site to the public, what data we collect and
what we're missing, and ways to earn from it. Nothing here is built: each
item is for the owner to say yes or no to. Sizes: S = under an hour,
M = a session, L = several sessions.

## 1. Where we are

Live today (2026-11-15), read with the public key: 130 saved games, 13
players, 1,980 Rank Bot moves, 44 Rush scores. So far that's the owner and
a handful of testers.

## 2. The data we collect, and the gaps

Collected now:
- Bot games: opponent, colour, moves, result, final eval (table `games`).
- Rank Bot: every bot move with why it was chosen (`rank_bot_moves`).
- Puzzle Rush scores with the typed name (`rush_scores`).
- Blind Chess: text of moves it couldn't understand (`blind_utterances`).
- Site 1v1 and Tactica 1v1 games save like bot games (signed-in only).

Not collected at all (so we can't improve them from data):
- Chess Tactica: Bin Run floors reached, Blitz scores, tutorial drop-off,
  which modes get opened. Nothing is saved.
- Game Review: how many reviews run, pasted vs own game, whether people
  practise the missed moves.
- Puzzles outside Rush: daily and ranked solves and fails.
- Lessons and Opening Trainer: what's started and finished.
- The basics: visits, which pages, new vs returning, sign-ups, device.
- Errors: when the site crashes for someone, nobody finds out.

Proposal A (M): one first-party `events` table, written from our own code.
  One small row per event: { name, detail, client id, user id, time }. No
  third-party tracker, no cookies, nothing sold. Events: page opened, mode
  started and finished (with score), review run, puzzle solved/failed,
  lesson step, sign-up, error. The owner runs one SQL file; the Privacy
  Policy gets one added line ("which features are used"), since it
  currently says we run no analytics.
Proposal B (S): error reports into the same table (message, page, app
  version), so crashes are visible.
Proposal C (S): a private stats page or script that prints weekly numbers
  (players, games per mode, Rank Bot results, drop-off).
Proposal D (S): Rank Bot: a one-tap "How did that feel?" after a game
  (too easy / close / unfair). Three taps of real feedback beat guessing.

## 3. Must fix before a public launch

Security and fairness
1. Anyone can read every saved game and name (M). The public key reads all
   rows of `games`, `players`, `rush_scores`. Fine for a leaderboard, not
   for private game history. Tighten the database rules (owner runs SQL).
2. Leaderboard can be faked (M). Rush scores are sent by the browser and
   trusted. Add server-side limits (sane maximum, rate limit) and a name
   filter for offensive names.
3. 1v1 lobby is open to anyone with the public key (M). Turn on Supabase
   Realtime Authorization; games stay unrated until a server checks moves.
4. Check that nobody can change or delete another player's rows (S). Not
   tested, on purpose: it needs the owner's OK since the test writes.

Legal (owner decided 2026-11-15)
5. Music: DECIDED, the Juice and Omori playlists will be removed. Not done
   yet: the owner asked to be reminded. To do it: drop them from
   MP3_PLAYLISTS in src/utils/musicLibrary.js and delete the folders from
   the Supabase "music" bucket.
6. Art: DECIDED, accepted as is. The Sweetheart art and the Wood piece set
   are a small part of the site; remove them if anyone objects.
7. Maia3 (AGPL): DONE. LICENSE and NOTICE.md are in the repo, the repo is
   public, and the home page links to both.
8. Account deletion: BUILT 2026-11-15. "Delete my account" on the profile,
   with a confirm step. It needs supabase/004_delete_account.sql run once
   in the Supabase SQL Editor; until then the button says to email us.
   Not tested against the live database.

Reliability and limits
9. Hosting plans. Vercel's free plan doesn't allow commercial use, so any
   monetization means Vercel Pro (about $20/month). Supabase free tier has
   caps (database size, monthly users, 200 live connections, storage
   bandwidth, which music eats). Check usage monthly; upgrade when close.
10. Email: Resend free tier caps daily sends; fine now, watch it.
11. Backups (S): Supabase free has no point-in-time restore. Schedule a
    weekly export.
12. Uptime check (S): a free monitor that emails when the site is down.

## 4. Should fix soon

13. New-player welcome (M): first visit explains what's here in one screen.
14. 1v1: choose the promotion piece (auto-queens today); rematch button;
    report/block a player (M-L).
15. Ratings: shown nowhere until calibrated; decide what players see (M).
16. Search and sharing (S-M): page titles and descriptions per page, a
    sitemap, nicer share cards for a game link.
17. Accessibility pass (M): keyboard play, contrast in the light theme,
    screen-reader labels on the board controls.
18. Real-device testing (owner): iPhone home-screen app, Android, iPad:
    sign-in, staying signed in, music, 1v1 on two phones, Tactica checklist.
19. First script is 302 KB; Preact would cut about 120 KB (M, needs a full
    retest).
20. Rank Bot design 3 went in on 2026-11-15 on a small sample (32 games, 7
    players). Re-run `scripts/review-lab/rankbot-live.mjs` after 30+ new
    games and compare v3 with v2: engine-best share (was 72%), lead of 300+
    (was 40% of moves), player wins (was 0), abandoned games (was 25%).

## 5. Ways to earn (later; needs items 5, 6 and 9 first)

- Supporter tier (recommended first): a few dollars a month for cosmetics
  only: extra piece sets, board colours, avatar items, a badge. Nothing
  that affects play. Needs Stripe and a server piece to record who paid (L).
- Donations (S): a Ko-fi or similar link in the menu. Easiest start.
- Premium features (L): deeper Game Review, more lessons and opening
  lines. Works against "reviews are free here", our best hook, so go
  carefully.
- Ads: not recommended; they'd cost the look and the speed, and need a
  consent banner.
- The YouTube/TikTok funnel is already free marketing; a share-your-game
  card (item 16) feeds it.

## 6. Suggested order

1. Legal items 5 and 6 (decisions only).
2. Data: proposals A-D, so launch traffic teaches us something.
3. Security items 1-4.
4. Items 11, 12 and 18.
5. Soft launch to the Discord, watch the numbers for two weeks, then wider.

## Built 2026-11-15 (second pass; waiting on the owner to run the SQL)

Data (section 2, proposals A-D): BUILT.
- `src/utils/track.js` records page opens, sign-ins, puzzles solved/failed,
  reviews run, Tactica modes and Blitz/Run scores, lessons, crashes, and a
  visit's start. Real visits only (not tests or local development).
- Needs `supabase/005_events.sql` run once. Until then the site gets a
  "no such table" reply and stops sending for that visit.
- `supabase/stats.sql`: eight read-only queries for the SQL Editor.
- Rank Bot: "How did that feel?" (Too easy / A close fight / Unfair) after
  a game. Not seen in the browser yet (needs a finished Rank Bot game).
- Privacy Policy now describes this.

Security (section 3):
- Item 2, leaderboard: BUILT. `supabase/006_leaderboard_safety.sql` (NOT
  TESTED against a database) gives the leaderboard a view without private
  IDs, closes direct reads of rush_scores, refuses impossible scores and
  floods. The site already reads the view and falls back to the table, so
  run the SQL only after this version is live. Offensive names show as
  "Player" on the leaderboard and in the lobbies (`cleanName.js`).
- Item 4, found by reading the rules (nothing was written to test it):
  the public key can UPDATE any row of `players` (rating and name), and
  until 006 is run the leaderboard lists the private client_ids that let a
  signed-in user claim someone's unclaimed games. Fixing `players` and
  item 1 (private game history) changes how the site proves "this row is
  mine", so it needs a test database first. STILL OPEN.
- Item 3 (lobby authorization): STILL OPEN, same reason.

Other:
- Item 11: `scripts/backup.mjs` saves every table to backups/<date>/ (not
  committed). First backup taken 2026-11-15 with the public key.
- Item 14: the site's 1v1 asks which piece to promote to. Not played
  through in the browser. Tactica 1v1 still auto-queens.
- Item 16: each page sets its own tab title; sitemap.xml and robots.txt.
- Item 12 (uptime monitor) is an outside service: sign up at a free one
  (e.g. UptimeRobot) and point it at https://www.zlegend2700.com.

To test database changes safely we need one of: permission to install
PGlite (a small local Postgres, development only), or a second free
Supabase project to try SQL on first.

## 2026-11-16: database files run, private-data rules written and tested

Run by the owner and confirmed with the public key: 004 (delete account),
005 (events; a test insert was accepted, reads are refused), 006
(leaderboard view returns all 44 scores; rush_scores itself reads empty).

Section 3 items 1 and 4: BUILT AND TESTED LOCALLY, waiting on the owner.
- `supabase/007_private_data.sql`: games, player rows and the Rank Bot move
  log stop being readable with the public key, and player rows stop being
  writable directly. Reads and the rating sync go through functions that
  take the browser's private id (my_games, my_rated_games, my_player,
  sync_player, claim_my_data).
- `supabase/rules.test.js` (14 checks, part of `npm test`) builds the whole
  database locally with PGlite from the real SQL files and checks what a
  visitor and two signed-in players can and can't do. It also covers 004,
  005 and 006. A control run without 007 showed both holes open.
- The site uses the functions when they exist and the old reads when they
  don't, so: push first, then run 007.
- After 007, `scripts/backup.mjs` and `rankbot-live.mjs` need
  SUPABASE_SERVICE_KEY in .env to read everything.
- Behaviour change: signed out, Game History shows only games no account
  has claimed (a logged-out shared browser no longer shows the account's).

Still open: item 3 (lobby authorization; Supabase Realtime can't be
modelled in PGlite), uptime monitor, music removal (owner asked to be
reminded), real-phone tests.

## 2026-11-16 (later): 007 confirmed, music removed, lobby access written

- 007 run by the owner and confirmed with the public key: games, players,
  rank_bot_moves and rush_scores read empty; a direct rating overwrite
  changes nothing; visitors can't claim. Owner confirmed Game History still
  lists games and a new game appears.
- Music (section 3 item 5): DONE in the site. Juice and Omori are out of
  `MP3_PLAYLISTS`; the music box offers Chiptune and Theme. The files are
  still in the Supabase "music" bucket (folders music/juice and
  music/omori) until the owner deletes them there.
- Lobby access (section 3 item 3): BUILT, waiting on the owner.
  `src/pvp/channel.js` asks for a private channel when signed in and falls
  back to a public one if refused. `supabase/008_lobby_access.sql` lets
  signed-in players into the lobbies and only a match's two players into
  that match. The rules are tested locally (rules.test.js, 17 checks); the
  live connection can only be tested on the site. Steps: push, run 008,
  check a game starts between two signed-in players, THEN turn off
  "Allow public access" under Realtime settings. After that, local
  development guests can't use the lobby.

What's left in this plan:
- Owner: delete the two music folders; uptime monitor (item 12); real-phone
  tests (item 18), now including 1v1 on two signed-in phones.
- Needs a decision: new-player welcome (13), what players see of their
  rating (15), supporter tier or donation link (section 5), Preact (19).
- Could build next: 1v1 rematch and report/block (14), Tactica promotion
  choice (14), accessibility pass (17).
- Needs data first: Rank Bot v3 against v2 (20), after 30+ new games.

## 2026-11-16 (evening): owner's round of requests

Confirmed by the owner: 008 run, a signed-in 1v1 works. (If "Allow public
access" is now off, two guest tabs on this computer can no longer test 1v1.)

Built:
- 1v1 clocks: White's clock starts once both players are at the board and
  Black's starts when White moves (they used to wait for both first moves).
- Welcome screen for first-time visitors (WelcomeSheet.jsx), once per browser.
- One rating (item 15): it comes only from Rank Bot's assessment and from
  ranked 1v1 games. The estimate from games against the fixed bots is gone.
  Shown on the board card, the profile and next to names in the lobbies.
  The 1v1 part is saved on the device (setting pvpRating), not the account.
- Ranked or casual tables (the opener chooses; needs two real accounts).
  Ranked results are worked out by each player's own browser, so a
  determined cheat could fake them: acceptable for now, noted.
- Both lobbies rebuilt (site and Tactica): online count, your table's
  clock and type, one row per table with both players, rating and status.
- Rematch (both ask, colours swap), block (never matched again on this
  device) and report (block + a `player_report` event with the reason).
  Tactica has rematch and block.
- Promotion choice in Tactica (Regular Chess and 1v1).
- Support link to Ko-fi (https://ko-fi.com/zlegend2700) in the menu and
  home footer; Terms say donations are voluntary and buy nothing.
- Accessibility: Escape closes every popup; colour-picker buttons are
  labelled. A fuller pass (keyboard play, contrast) is still open.
- Preact (item 19): DONE. First script 310 -> 186 KB (109 -> 72 KB
  compressed). Retested on the production build: all pages, a bot game
  with undo, puzzles, Game Review, the trainer, typing and saving a name,
  the login window, Tactica's 3D board. Kinnda still uses React.

Not tested by Claude (needs two signed-in players): the new clock start,
ranked rating changes, rematch, block/report, promotion in a live 1v1.

Owner's to-do in Supabase for the email problems:
- New accounts got a LINK, not a code: the "Confirm signup" email template
  needs the same {{ .Token }} body as the Magic Link template.
- Spam: add a DMARC record at Namecheap (TXT, host _dmarc, value
  v=DMARC1; p=none; rua=mailto:support@zlegend2700.com), and check Resend
  shows SPF and DKIM as verified.

Supporter tier (owner's idea, details later): perks for people who support
on YouTube or TikTok. YouTube has an API to check channel memberships
(needs the viewer to link their Google account, which we now have);
TikTok has no public way to check subscriptions, so that side would need
a manual code or list. Not started.

## 2026-11-16 (night): what was left that Claude could build

Owner confirmed: the signup email template and DMARC record are done.

Built (not tested with two players or two devices):
- The rating follows the account. It is saved on the signed-in account a
  moment after it changes, and signing in on another device brings the
  newer copy along (the newer of the device's and the account's wins).
  It is still worked out in the browser, so it can be faked.
- Report choices in Tactica's 1v1 end screen (just block, cheating,
  offensive name, stalling or leaving), the same as the site's 1v1.
- Contrast on the light (Sweetheart) theme: the teal and gold text, the
  "win" label, the leaderboard bronze and the TV's "unavailable" text were
  too faint and are darker now. The home page passes an automatic check.
  Other pages on the light theme were not re-checked after the fix.

Still open: keyboard play on the board, server-checked ranked results,
uptime monitor, real-phone tests, deleting the old music folders in
Supabase, Rank Bot v3 vs v2 comparison (needs the service key in .env),
the supporter tier.

## 2026-11-16 (late): owner's phone round, service key added

Owner did: deleted the music folders in Supabase; added SUPABASE_SERVICE_KEY
to .env on this computer. First full backup run: backups/2026-11-16/ (135
games, 14 players, 44 rush scores, 2,099 Rank Bot moves, 160 events).

Rank Bot v3 vs v2 (item 20): NOT YET COMPARABLE. v3 has 3 finished games
from one player (0 wins, 2 losses, 1 draw); v2 had 28 games, 0 player wins,
8 abandoned. Re-run `node scripts/review-lab/rankbot-live.mjs` after 30+
v3 games. Nobody has answered the "how did that feel" question yet.

Built (not pushed; checked at phone size in the desktop browser only):
- iPhone bug: the board's box was too short, so the board drew over the
  player card, "Your move" and the buttons (captured pieces seemed to float
  on the board). On touch phones the board now gets a plain width and
  height. NOT CONFIRMED on a real iPhone: the bug doesn't show in Chrome.
- No pinch or double-tap zoom on the game screen (scrolling still works).
- Quit button on the game screen, and "Quit game" beside Resume Game on
  the Play page. Quit and New ask in a popup (yes or cancel) once the game
  is past move 2. After quitting there is nothing to resume.
- A game only counts as "in progress" once the player has moved (as Black
  the bot's first move alone no longer makes Resume Game appear).
- The player card shows the account's picture when signed in.
- "Blitz in the Bin" is now "Puzzle Rush Tactica". Puzzles page: no
  description on Daily and Ranked; Chess Tactica says "Puzzle Rush Tactica".
- Tactica Rush leaderboard: one "Leaderboards" button on the Puzzles page
  opens the leaderboard page, which has a Puzzle Rush / Tactica Rush switch. NEEDS supabase/009_tactica_leaderboard.sql
  run by the owner; until then Tactica scores are not saved and that board
  is empty. Puzzle Rush is unaffected either way. Tested locally only.

Item 17 (keyboard play): already there. Every square can be reached with
Tab and played with Enter or Space, and is read out by name.

Still open: server-checked ranked results, share cards, supporter tier,
uptime monitor (owner), real-phone tests incl. two signed-in players.

## 2026-11-17: Game Review revamp

Owner ran supabase/009 (Tactica Rush leaderboard is live).

Fix: Quit always asks in a popup now (it used to quit straight away in the
first two moves).

Game Review page rebuilt (not pushed yet):
- Three ways in: Chess.com username, Lichess username, or paste. A username
  lists that player's latest games (opponent, rating, speed, date, colour,
  length, result), ten at a time; tapping one starts the review from that
  player's side. The username is remembered on the device and its games
  load on the next visit. Both sites' public data works straight from the
  browser, no key or login (checked from localhost).
- Paste takes PGN text, a .pgn file, a Lichess game link, or a Chess.com
  game link. Chess.com has no open way to fetch a game by its number, so a
  Chess.com link is looked up among the remembered username's recent games.
- When Chess.com already reviewed the game, its accuracy shows under ours.
- Privacy page lists Chess.com and Lichess under services.

Accuracy formula retuned (scripts/review-lab/variants.mjs compares six ways
of combining moves; data: 3,000 Chess.com scores, half held back):
- Before: within 5 points of Chess.com 70% of the time, typical miss 4.1,
  under-800 games read 3.6 high.
- Now: within 5 points 83%, typical miss 3.0, under-800 bias 0.1. The
  change: the average move score's shortfall from 100 is stretched by 1.84
  (Chess.com's scores spread wider than a plain average), with the curve
  refitted.
- Tried and rejected: weighting turbulent moves more (worse), capping one
  move's cost, pulling short games to the middle (no gain).
- A "game rating" like Chess.com's was NOT added: accuracy alone guesses a
  rating with a typical miss of 556 Elo. Chess.com anchors its number on
  the player's real rating; we have no examples of its output to fit to.
- Move labels are still unvalidated: Chess.com publishes no label data.
  Its help page says Great and Brilliant are given more generously to
  lower-rated players; ours ignore rating.
