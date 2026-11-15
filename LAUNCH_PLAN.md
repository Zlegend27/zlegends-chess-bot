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
