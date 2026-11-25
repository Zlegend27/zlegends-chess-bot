# Final launch plan

Written 2026-11-23, after a review of the live site and research on how to
launch. This replaces the "what's left" parts of LAUNCH_PLAN.md and
RELEASE_PLAN.md: those stay as the history of what was built and why.

Who does what: **[You]** is the owner, **[Claude]** is me, **[Both]** is
the bug hunt we do together. Tick the boxes as we go.

---

## 1. Where we stand

Checked on the live site on 2026-11-23:

- **Pages:** all 28 public pages load, each with its own title,
  description, preview picture and search text. No broken links between
  them. Unknown addresses get a real "Page not found" (404).
- **Search:** Google Search Console and Bing are verified, the sitemap
  (28 pages) is submitted, and indexing was requested for / and /review.
- **Speed (phone size, live):** main content shows at 0.8 s, layout jump
  0.010 (Google's "good" is under 0.1), first script about 77 KB
  compressed. Real visitors' speed is now recorded (stats query 10).
- **Security:** no secrets in the code; the database tables can't be read
  with the public key; size limits and a flood guard are live (012, the
  database refused a test row); the preview-picture functions refuse junk;
  security headers are on; dependencies are up to date (one moderate
  library issue left that our code can't trigger).
- **Privacy:** no ads, no third-party tracking, the YouTube player uses
  YouTube's no-cookie address, our own usage numbers can't be linked
  between visits. Kinnda isn't on the site.
- **Accessibility:** keyboard play, screen-reader labels, skip link,
  pinch zoom (except on the board), an accessibility page; automated
  checks clean on 12 pages in both themes.
- **Email:** Resend is set up to send sign-in codes (its signing record
  is in place); support@zlegend2700.com forwards through Namecheap.
- **Uptime check:** runs and passes, but see 2.1, it runs far less often
  than set.

**Never tested on real devices or real accounts** (this is what the bug
hunt in section 3 is for):

- Signing in with Google, Discord and an email code, and staying signed in.
- Deleting an account on the live database.
- The new 1v1 lobby (Play, the waiting list, two people pressing Play at
  once) and invite links, including leaving the app to send one.
- A real Feedback message reaching the database.
- Games following an account to another device ("Your games").
- The iPhone board-overlap fix, the installed app on iPhone and Android.
- Shared links in Discord and iMessage (the pictures render; how the apps
  show them hasn't been seen).

---

## 2. Before launch: fixes and checks

### 2.1 [You] Accounts and settings (about an hour in all)

- [ ] **Email spam record: delete the duplicate.** Your domain has two
      DMARC records (`v=DMARC1; p=none; rua=mailto:support@zlegend2700.com`
      and a bare `v=DMARC1; p=none;`). With two, mail providers ignore
      DMARC altogether, which makes sign-in emails likelier to land in
      spam. In Namecheap > Advanced DNS, delete the bare one (host
      `_dmarc`, value `v=DMARC1; p=none;`) and keep the one with `rua`.
- [ ] **A real uptime monitor.** The GitHub check is set for every 30
      minutes but GitHub actually runs it every 5 to 8 hours (it delays
      scheduled jobs on quiet repositories), so an outage could go
      unnoticed most of a day. Sign up for a free monitor (UptimeRobot or
      Better Stack), add https://www.zlegend2700.com/ with a 5-minute
      check and your email or phone for alerts. Keep the GitHub one: it
      also checks the database.
- [ ] **Music bucket:** delete the folders `music/juice` and
      `music/omori` in Supabase > Storage > music (the site stopped using
      them on 2026-11-16; the files are still public until deleted).
      I couldn't confirm whether this was done.
- [ ] **Supabase > Authentication:**
  - URL Configuration: Site URL `https://www.zlegend2700.com`; Redirect
    URLs only your own addresses (zlegend2700.com, www, localhost for
    development). No wildcards like `https://*.vercel.app`.
  - Email templates: the "Confirm signup" template must contain
    `{{ .Token }}` like the "Magic Link" one, or new accounts get a link
    instead of a code (found 2026-11-16; check it was changed).
  - Attack Protection: leave CAPTCHA off for now; turn it on if spam
    accounts appear.
- [x] **Run supabase/013_blind_training.sql** (done 2026-11-24, confirmed) in the SQL Editor (Blind
      Chess Trainer progress for accounts; until then it stays on each
      device and nothing breaks).
- [ ] **Supabase > Realtime settings:** "Allow public access" stays OFF
      (the lobby uses private channels).
- [ ] **Usage numbers:** in Supabase > SQL Editor, run queries 1, 2, 7 and
      8 from `supabase/stats.sql` and send me the results (or screenshots).
      They tell us how many people visit now, what they use, and which
      crashes happen. I couldn't read them myself: that needs the
      service key, which my tools aren't allowed to use without your OK.
- [ ] **Supabase > Reports (usage):** note database size, egress and
      Realtime peak connections today, so we can compare after launch.
- [ ] **A backup before launch:** run `node scripts/backup.mjs` on the PC
      with the service key in `.env`. It saves today's data under
      `backups/`.
- [ ] **Send a test email to support@zlegend2700.com** from another
      address and check it arrives (the Privacy Policy and Terms promise
      that address works).
- [ ] **Vercel plan:** the free Hobby plan is for non-commercial use.
      The Ko-fi "Support the site" link is voluntary donations and nothing
      is sold, which is the gentlest case, but Vercel's wording is strict.
      Before adding ads, a paid tier or Stripe, move to Vercel Pro
      (about $20/month). Decide whether to keep the Ko-fi link at launch.

### 2.2 [Claude] Built or checked before launch day

- [x] Everything in RELEASE_PLAN.md sections A, P, C, D, F (except F6
      puzzle themes, later), L1, L2.
- [ ] Fix whatever the bug hunt (section 3) finds, highest severity first.
- [ ] After your usage numbers: fix the top crashes from query 7.
- [ ] Turn the GitHub uptime check into a daily health check that also
      reports yesterday's crash count, if you're happy to add the service
      key as a GitHub secret (optional).
- [ ] A final pass the day before launch: lint, all tests, build, every
      page live, the database rules probe, and the headers.

### 2.3 [You] Decisions

- [ ] **Ranked 1v1 at launch?** Results are trusted to the two browsers,
      so a determined cheat can fake a win. Ratings aren't shown on any
      public list, so the harm is small. Options: keep Ranked as is
      (recommended for launch), or hide it until a server checks games.
- [ ] **The Ko-fi link** (see Vercel above): keep, or remove until Pro.
- [ ] **Launch date**, and whether you'll be free that day and the next
      two to answer people and let me fix things fast.

---

## 3. [Both] The bug hunt

Do this on real devices, signed in as real accounts, in both themes.
Each line is something to do and what should happen. When something is
wrong, note it in the bug log (3.3) or send it with the menu's Feedback
button (that also tests Feedback).

### 3.1 Devices

At least: an iPhone (Safari, and the app added to the home screen), an
Android phone (Chrome, and installed), a computer (Chrome, plus Firefox
or Safari), and a tablet if you have one. Two accounts for 1v1 (a friend,
or your second account on a second phone).

### 3.2 What to test

**First visit (use a private window)**
- [ ] Home: the greeting types without pushing the page around; "New
      here?" shows; "Play a bot" starts a game against Rank Bot at once.
- [ ] The welcome sheet on a first visit; its Play starts a game.
- [ ] Hide on "New here?" keeps it hidden after a reload.
- [ ] The bottom bar (phone) and the header (computer) reach every
      section; the back gesture always returns to Home.

**Accounts**
- [ ] Sign in with Google, with Discord, and with an email code (the
      email arrives, in the inbox not spam, and the code works).
- [ ] Still signed in after closing and reopening the browser, and the
      installed app.
- [ ] iPhone installed app: sign in (the special iPhone sign-in route).
- [ ] Games played signed out are kept after signing in.
- [ ] "Your games" in Game Review shows a game played on another device.
- [ ] Profile: change name and look; they show in the lobby.
- [ ] Delete account (on a spare account): it's gone, and signing in
      again starts fresh.

**Play**
- [ ] A full game against Rank Bot, against Dumb Bot, against 2000 Elo.
- [ ] Resume a game after a reload, and after closing the app.
- [ ] Undo, Best Move, promotion (choose a piece), castling, en passant,
      checkmate, stalemate, draw by repetition.
- [ ] Settings: piece designs, board colour, eval bar, coordinates off
      and on, piece movement Normal/Slow/Instant, light and dark theme.
- [ ] iPhone: the board doesn't overlap anything (the old overlap bug).
- [ ] Pinch zoom works on pages but not on the board; double-tap doesn't
      zoom.
- [ ] Blind Chess Trainer (/blind): a practice session typed, then one
      by voice (Chrome on Android, Safari on iPhone, not the installed
      iPhone app); "Read questions aloud"; Show the board; progress kept
      after signing in on another device (after 013).
- [ ] Blind Chess voice game: the first tap on the mic listens; the coach
      talks on iPhone; a full game typed.
- [ ] Watch Bots: a full game plays out.
- [ ] Play with yourself (Practice).

**1v1 (two phones, two accounts)**
- [ ] Both press Play on the same clock: the game starts for both.
- [ ] Both press Play at the same moment: still one game, not two waits.
- [ ] Different clocks: A waits, B sees A in "Waiting for an opponent"
      and taps Play: the game is on A's clock.
- [ ] Cancel while waiting: A leaves the list on B's screen.
- [ ] Invite a friend: copy or share the link; B opens it (signed in, and
      signed out then signing in): the game starts.
- [ ] The hard one: A makes an invite, switches to Messages and sends the
      link, B opens it while A is still away. B waits; the game starts
      only when A comes back, and A's clock wasn't running meanwhile.
- [ ] A closes the app after sending (or the phone reloads it): reopening
      goes back to the invite and the link still works.
- [ ] During a game: moves arrive quickly; clocks agree; resign; offer
      and accept a draw; abort in the first moves; rematch.
- [ ] One player loses signal for 20 s mid-game: the game recovers.
- [ ] Ranked: ratings change after the game on both accounts.
- [ ] Block a player: you're not matched with them again.

**Game Review**
- [ ] A Chess.com username and a Lichess username: games list, one opens
      and gets graded; "Show older games".
- [ ] A username with no games, a misspelt username, a pasted PGN, a
      Chess.com link, a Lichess link, a PGN file.
- [ ] The report: accuracy, graph, move labels, "Practice your mistakes".
- [ ] "Share this review": the link's preview in Discord/iMessage shows
      the accuracies; opening it shows the same review, graded.
- [ ] A long game (80+ moves) on a phone: how long grading takes.

**Puzzles**
- [ ] Daily puzzle, and /daily opened directly; the streak counts.
- [ ] Ranked puzzles at two levels; Puzzle Rush 1, 3 and 5 minutes; the
      score reaches the leaderboard with your name.
- [ ] The leaderboard with the internet off: "Couldn't load", Try again.

**Learn**
- [ ] How to play chess: all 5 chapters through.
- [ ] Opening Trainer: one White and one Black course, the idea, the
      quiz, scenarios, practice; the address changes per course;
      /openings/vienna-game opened directly lands on the course.
- [ ] Openings library: pick one, practise it.

**Chess Tactica**
- [ ] `tactica-design/test-checklist.md` on one phone (its own list).
- [ ] At least: the first world, a boss, the dragon, Tactica Rush, and its
      1v1.

**Everywhere**
- [ ] Feedback from the menu: send one real message (I confirm it
      arrived).
- [ ] Music: plays, skips, volume.
- [ ] Privacy, Terms, Accessibility pages read correctly.
- [ ] Share links: the home page, /review, an opening page, a /g/ game
      link, a review link, pasted into Discord and iMessage.
- [ ] Offline: open the site once, turn on airplane mode, reload: the
      app opens; a bot game works.
- [ ] A slow connection (Chrome DevTools "Slow 4G" on the computer): the
      first screen shows quickly, nothing stays blank.

### 3.3 Bug log

Write bugs here (or send them to me in chat), one line each:

| # | Severity | Device and browser | What I did | What happened | What should happen | Fixed in |
|---|---|---|---|---|---|---|
| 1 | | | | | | |

**Severity:**
- **Blocker:** loses data, breaks sign-in, a page doesn't load, or a game
  can't be finished. Must be fixed before launch.
- **Major:** a feature doesn't work right but there's a way around it.
  Fix before launch if we can.
- **Minor:** looks wrong or reads oddly. Fix when we can.

**Launch only when:** no blockers left, majors fixed or accepted by you,
and every 1v1 and account line above has passed at least once.

---

## 4. Launch

Research summary (sources at the end): launch small first, then widen;
decide beforehand what "going well" means; have a rollback you've tried;
be around to answer people; and follow each community's rules on
self-promotion.

### 4.1 Going well means (first two weeks)

- Crashes (query 7): fewer than 1 per 100 visits, none repeated across
  many visits.
- Speed (query 10): LCP under 2.5 s at the 75th percentile on phones.
- 1v1: invite games start when both are on the page; no stuck lobbies in
  feedback.
- Supabase usage well under the free limits: database 500 MB, egress
  5 GB/month, 200 live connections (1v1 and the lobby use these).
- Nothing in Feedback that says "I couldn't…" more than once.

### 4.2 Rollback (try it once before launch day)

- **The website:** Vercel > the project > Deployments > pick the last
  good deployment > "Promote to Production" (instant). Or tell me and I'll
  revert the commit and push. Try it once with a harmless deployment so
  you know where the button is.
- **The database:** the SQL files are additions; a bad rule can be
  undone with a short SQL fix I'd write. The backup from 2.1 is the last
  resort.
- **A runaway cost or abuse:** Supabase > Settings: pause the project;
  Vercel: Deployment Protection or pausing the project.

### 4.3 Day by day

**Launch day minus 7 to minus 1**
- [ ] Bug hunt done (section 3), blockers fixed.
- [ ] Section 2.1 done; backup taken; rollback tried.
- [ ] [Claude] final pass (2.2).
- [ ] Prepare the posts (4.4) and a short video or Short showing Game
      Review from a username and a bit of Chess Tactica.

**Launch day: soft launch to your own people**
- [ ] Announce on your Discord and YouTube community tab (and TikTok):
      what it is, the link, "tell me what breaks" (the Feedback button).
- [ ] Be around for the first hours. Watch Feedback (query 11), crashes
      (query 7) and Supabase usage at the end of the day.
- [ ] Send me anything odd; I fix and push the same day.

**Days 2 to 7**
- [ ] Each day: queries 1, 7 and 11; Supabase usage.
- [ ] Fix what comes in; no new features this week.
- [ ] Post the YouTube video/Short when the first fixes are in.

**Week 2: go wider (only if 4.1 looks good)**
- [ ] **r/chess and r/chessbeginners:** read each subreddit's current
      rules first. r/chess allows limited self-promotion only from
      accounts that take part in the community (Reddit's "10%" guideline),
      and frowns on paid products; ask the moderators by modmail if
      unsure. Post something useful (for example "I made a free Game
      Review that reads your Chess.com username, accuracy tuned to match
      Chess.com's"), not an advert, and answer every comment.
- [ ] **Hacker News "Show HN":** only for something people can try now
      (it is). Title like "Show HN: Free chess game review that runs
      Stockfish in your browser". No hype words, don't ask for upvotes or
      link friends straight to the post; post on a weekday morning (US
      Eastern) and stay in the comments. The technical story fits this
      audience: the engine in the browser, the accuracy fitted to
      Chess.com on 1,500 games, Maia3.
- [ ] **Not:** Chess.com forums or clubs (their rules ban advertising
      other sites), and the Lichess forum (it limits promotional posts).
- [ ] Product Hunt is optional; it suits apps more than games.

### 4.4 Posts to have ready

- [x] [Claude] Drafted in LAUNCH_POSTS.md (2026-11-24): the Discord
  announcement, a YouTube Short script and description, Reddit posts for
  r/chessbeginners and r/chess, and the Show HN post with its first
  comment. Edit them before posting.

---

## 5. After launch

- [ ] Week 2: Search Console > Pages (what's indexed, any errors) and
      Performance (what people search for). Send me screenshots.
- [ ] Rank Bot: once 30+ games on the current design, run
      `scripts/review-lab/rankbot-live.mjs` and compare with the last
      version (win rate, how often it plays the engine's best move,
      abandoned games).
- [ ] Supabase usage monthly; upgrade to Pro ($25/month) before reaching
      a limit, especially Realtime connections if 1v1 gets busy, and
      because free projects pause after 7 days without activity.
- [ ] Later, parked on purpose: ads and a supporter tier (research done
      2026-11-23; Vercel Pro and a consent popup first), puzzle themes
      (F6), move confirmation and premoves in 1v1, a server that checks
      ranked 1v1 games.

---

## 6. Known limits we accept at launch

- 1v1 and ranked results are trusted to the two players' browsers; a
  determined cheat could fake a result. Their own Rank Bot rating can be
  set by the player too. Nothing public ranks by these yet.
- Someone could show up in the lobby under another player's name; they
  can't join that player's games (the database checks the real account).
- Chess Tactica's 3D world isn't described to screen readers (said on
  the Accessibility page).
- If the site is flooded, saving games and scores stops for a minute at a
  time (the flood guard) rather than the database filling up.
- No real-time crash alerts: crashes are recorded and read with query 7.

---

## Sources

- Lichess on staying ad-free: https://lichess.org/blog/YF-ZORQAACAA89PI/why-lichess-will-always-be-free
- r/chess rules (self-promotion): https://lr.in.psf.lt/r/chess/wiki/rules and the 2024 rework https://pol1.lr.ggtyler.dev/r/chess/comments/1btdq9f/important_rework_of_rchess_rules
- Chess.com club guidelines (no advertising): https://www.chess.com/clubs/forum/view/general-chess-com-rules-and-club-guidelines
- Lichess blog etiquette: https://lichess.org/page/blog-etiquette
- Show HN rules: https://news.ycombinator.com/showhn.html ; launch advice: https://www.lucasfcosta.com/hn-launch , https://dev.to/iris1031/how-to-launch-on-hacker-news-the-show-hn-guide-real-data-461e
- Launch checklists (rollback, success criteria, alerting): https://dev.to/ahmet_saridag_9232a4f1a24/a-launch-day-checklist-for-developers-that-doesnt-assume-everything-goes-smoothly-2d9b , https://guides.18f.org/engineering/our-approach/software-launch-checklist/
- Supabase free plan limits: https://www.cloudzero.com/blog/supabase-pricing/ , https://neon.com/guides/neon-vs-supabase-free-plan (check supabase.com/pricing for current numbers)
- Vercel Hobby plan (non-commercial): https://vercel.com/docs/plans/hobby
