# Public release plan (review written 2026-11-23)

The owner asked for an intense review of the whole web app before the public
release: functionality, accessibility, design, SEO, and renovation ideas.
Nothing here is built yet. Sizes: S = under an hour, M = a session,
L = several sessions. Decisions for the owner are in section 9.

This builds on LAUNCH_PLAN.md (security, data, legal: mostly done),
POLISH_PLAN.md and UI_PLAN.md. It doesn't repeat what those finished.

## 1. How the review was done

- Every page of the live site (www.zlegend2700.com) at phone size
  (375x812) and desktop (1366x800): titles, headings, labels, tap targets,
  images, overflow, page length.
- What a search engine or link preview receives: the raw HTML, status codes,
  redirects and response headers, fetched directly.
- The code: routes, the head tags, the sitemap and robots file, the service
  worker, settings, accessibility hooks, content data.
- A quick look at what competes for "free chess game review", and how other
  single-page apps solve search.
- Not done: an automated contrast and accessibility scanner (axe). Loading
  it into the live site from a CDN was blocked by a safety check. Item C1
  adds it to the tests instead.

## 2. The short version

What's strong: the app itself. Pages load fast, every page has a title and
a heading, controls are labelled, popups trap focus and close with Escape,
the board is keyboard-playable with spoken moves, reduced motion is
respected, the database rules are tested, HTTPS is enforced, and the apex
domain redirects to www. Game Review (free, unlimited, from a Chess.com or
Lichess username) is a real hook.

What's not ready for search and first-time visitors:
1. Search engines and link previews see the same page for every address.
   /puzzles, /review and /openings all send the home page's title and
   description; the real titles only appear after the script runs.
2. Made-up addresses return "200 OK" with the home page (a "soft 404").
   Search engines treat that as low quality.
3. Nothing on the home page tells a new visitor what the site is. It's an
   app screen (a greeting, Play, Game Review, the TV). On desktop it's a
   phone-width column in a big empty starfield.
4. There's no text content for search to rank: no opening pages, no
   "how to play" pages, no about page, even though 12 openings already
   have real written notes.
5. Scripts and styles are re-checked with the server on every visit
   (cache time 0), and the service worker downloads about 3.3 MB on a first
   visit (engine, opening book, big images), even if you only look at Home.
6. No security headers besides HTTPS (no protection against the site being
   framed by another site, no content-type or referrer rules).
7. 1v1 has no "invite a friend" link. At launch the lobbies will mostly be
   empty, which makes 1v1 look dead.
8. Small design inconsistencies: Play page cards, Puzzles copy, a stale
   "NEW" label, an unfinished course (1 of 5 chapters) on show.

## 3. SEO and discoverability (section A)

A1. Real HTML for every public page (M-L). At build time, write one HTML
    file per public route (/, /play, /puzzles, /review, /lessons,
    /openings, /leaderboard, /rush, /ranked, /watch, /tactica, /lobby,
    /privacy, /terms, plus new pages below), each with its own:
    - title and meta description, written for what people search
      (e.g. "Free chess game review: Chess.com and Lichess, no account")
    - canonical link (https://www.zlegend2700.com/<path>)
    - Open Graph and Twitter tags with ABSOLUTE image URLs (today og:image
      is "/og.jpg", which some previewers ignore), og:url, og:site_name
    - a short block of real text and links inside the page shell (what the
      page is, how to use it), which the app replaces when it loads.
    Vercel serves a real file before any rewrite, so /puzzles gets
    dist/puzzles/index.html automatically. Recommended: a small Node script
    after `vite build` that fills a template from a route table (no
    headless browser needed). Alternative: a headless-browser snapshot of
    each route (heavier, needs a big dev dependency).
A2. Real 404 (S). Limit the catch-all rewrite in vercel.json to the app's
    known routes; everything else gets a 404.html page (in the site's
    style, with links home) and a real 404 status. The app's own
    viewForPath fallback to "home" stays for in-app links.
A3. Structured data (S). JSON-LD in the prerendered pages: WebSite,
    Organization (logo, and sameAs links to YouTube, TikTok, Discord,
    GitHub), WebApplication (a free browser chess app, no install), FAQPage
    on the home landing section, BreadcrumbList on opening pages.
A4. Sitemap from the route table at build time, with lastmod (S). Keep
    /game, /profile, /history, /avatar out (already disallowed in robots).
A5. Per-page share images (S-M). api/card.js already draws game cards with
    @vercel/og; add simple cards per section (Review, Puzzles, an opening)
    so links shared to Discord or iMessage look specific.
A6. Search Console and Bing Webmaster Tools (owner, S). Verify the domain
    with a DNS TXT record at Namecheap, submit the sitemap, then watch
    coverage and the queries people find the site with.
A7. One brand name for search (decision 1). Today the site is
    "Zlegend's Chess Bot", "Zlegend2700", "ZLEGEND27" and "Z27Tube" in
    different places. Search and word of mouth work best with one name in
    every title, plus the other names mentioned once in the about text.
A8. Content that can rank (section G below): opening pages, a beginner
    track, an about page, the daily puzzle at its own address.

Search landscape (2026-11-23): free unlimited game review is contested by
small tools (Chessda, Chessiro, Chess It Up) and Lichess, while Chess.com
gives free members about one review a day. Our edge: a Chess.com or Lichess
username lists your games in one tap, accuracy is tuned to match
Chess.com's, and you can practise the moves you missed. The titles and
landing text should say exactly that.

## 4. Performance (section P)

P1. Cache hashed files for a year (S). In vercel.json, give /assets/*
    "Cache-Control: public, max-age=31536000, immutable". They're named by
    content, so they never change in place. Today every visit re-checks
    every one.
P2. Trim the service worker's first download (S). It precaches about
    3.3 MB (uncompressed) for every visitor, including the 513 KB engine
    worker, the 480 KB opening book, lesson-coach.webp (176 KB) and
    blueeyes.webp (114 KB). Precache only the shell (first script, CSS,
    icons) and cache the rest the first time it's used.
P3. Heavy images (S): lesson-coach.webp 176 KB, blueeyes.webp 114 KB,
    sweetheart-full.png 96 KB. Resize to the size they're shown at.
P4. Faster first picture (comes with A1): the prerendered page carries the
    real heading and text, so the first paint isn't an empty shell.
P5. Measure real visitors (S): send each visit's LCP, INP and CLS to our
    own events table (track.js already exists). Our own numbers, no
    third-party tool.
P6. Chess Tactica: the 2026-11-18 performance work (see the Tactica rules
    memory) still needs a real-phone run. It's the heaviest part of the
    site by far.

## 5. Accessibility (section C)

Already good: titles and headings on every page but one, labelled controls,
aria-current in the menus, focus trap and Escape in popups, keyboard play
on the board with spoken moves (aria-live), reduced motion, captions on the
Tactica films, Blind Chess (a full voice game) as an accessible mode in
its own right.

C1. Automated checks in the tests (M). Add axe-core as a dev dependency
    and check every page in both themes on each test run (needs the
    owner's OK to install). Fix what it finds, contrast first.
C2. Landmarks (S): wrap each page's content in <main>, and add a "Skip to
    content" link that appears on keyboard focus.
C3. The 1v1 lobby has no heading (S): add one (hidden is fine).
C4. Zoom (S-M): pinch and double-tap zoom are switched off on the game
    screen. Re-allow zoom on the page and block it only on the board
    itself (that's what stopped accidental zooms), so people who need to
    zoom can.
C5. Focus returns to the button that opened a popup when it closes (S).
    Check every popup.
C6. Don't rely on colour alone (S): move labels in Game Review, the eval
    bar, puzzle right/wrong. Check each one has text or a symbol too.
C7. An accessibility page (S): what works (keyboard, screen readers, Blind
    Chess, reduced motion), what doesn't (Chess Tactica's 3D board is
    visual-first), and how to report a problem. Linked from the footer.

## 6. Design and UX (section D)

Read DESIGN_PRINCIPLES.md before any of this. Show each change before it
goes live (UI_PLAN.md rule).

D1. A home page that explains itself to newcomers (M). Keep the app
    actions on top (Play, Game Review). Under them, for first-time visitors
    and search engines: one line on what this is (free chess: bots that
    play like people, unlimited game review, puzzles, openings, 3D Chess
    Tactica; no ads, no account needed), three or four feature tiles that
    link to each section, and a short FAQ. Returning players can skip past
    it. (Decision 2: on Home, or on a separate /about page.)
D2. Use the width on desktop (M). Home and the section pages are a
    phone-width column on a 1366px screen. Use two columns (actions and
    feature tiles on the left, the TV or a board preview on the right). In
    a game, the board can be much bigger: it's about 440px tall with empty
    space around it.
D3. One-tap play for a new player (S). Home's Play opens the Play menu.
    For a first visit, offer "Play now" that starts Rank Bot directly.
D4. Play page consistency (S). The first four cards have an icon and no
    description; Blind Chess and Watch Bots have a description and no icon.
    Give every card the same shape: icon, name, one line.
D5. Copy pass (S). Puzzles: Daily and Ranked have no description, and the
    Chess Tactica card's subtitle repeats the mode's name. Learn: drop the
    "NEW" label (it goes stale), and decide on the Hyper-Accelerated Dragon
    (1 of 5 chapters ready): finish it, hide it, or mark it "coming soon"
    (decision 10). One name per thing everywhere ("Watch Bots" vs "Watch
    bots play", "Learn" vs "Lessons").
D6. The bottom bar's "Game Review" wraps onto two lines on a phone (S).
    Shorten the label to "Review" (the page title stays "Game Review").
D7. UI_PLAN.md is out of date. It says phase 4 is next as of 2026-10-31,
    but most of phases 4 to 6 happened since. Walk its "done when" checks,
    update the status line, and fold what's left into this plan.
D8. Empty and error states (S-M). An empty 1v1 lobby, a Chess.com username
    with no games, no internet, the leaderboard failing to load: each
    should say what happened and offer a next step.

## 7. Functionality (section F)

F1. Invite a friend to 1v1 by link (M). "Play a friend" creates a private
    table and a link (/1v1/<code>) to send. The friend opens it and the
    game starts. This is how most players will use 1v1 at launch, while
    the public lobbies are quiet. Uses the existing lobby and match code.
F2. Beginner bot levels (S-M, decision 5). The lowest fixed bot is 1000
    Elo. Rank Bot adapts, but a true beginner choosing a level has nothing
    gentle. Consider 400 and 700 levels, labelled in words ("Just learned
    the moves").
F3. A beginner track in Learn (L, decision 4). How the pieces move,
    check and checkmate, the first opening principles. It serves new
    players and search ("how to play chess"). Kinnda already has kid
    lessons; decide whether to reuse its content or write a plain-English
    version for the main site.
F4. Game Review extras (S-M): a share link for a finished review (with the
    accuracy on the preview card), and "Review this game" in one tap from
    Game History.
F5. Daily puzzle at its own address, /daily (S). Shareable, comes back
    every day, and gives search a fresh page.
F6. Puzzle themes (L, later). Forks, pins, mate in 2. Our puzzle file has
    rating bands but no themes; the Lichess puzzle database has them, so
    the data pipeline would need re-running.
F7. Settings people expect (S each, pick some): coordinates on or off,
    move confirmation for slow players, premoves in 1v1, piece animation
    speed.
F8. "Report a bug / send feedback" in the menu (S). A Discord link, plus
    an in-app form that writes a "feedback" event with the page and
    browser.

## 8. Launch readiness (section L)

L1. Security headers (S). In vercel.json: X-Content-Type-Options nosniff,
    Referrer-Policy strict-origin-when-cross-origin, frame-ancestors 'self'
    (stops other sites framing the account pages), and a Permissions-Policy
    that allows the microphone only for this site (Blind Chess needs it) and
    turns off camera and location. A full Content-Security-Policy in
    report-only mode first (Supabase, YouTube, Ko-fi, the engines),
    enforced once nothing breaks.
L2. EU visitors and analytics (decision 7). track.js keeps a random ID in
    the browser to count returning visits. Under EU rules, storing an ID
    for analytics can need consent. Options: drop the persistent ID for
    analytics (count visits without it), or show a one-line notice with a
    choice. This is a point to check, not legal advice.
L3. Hosting limits (LAUNCH_PLAN item 9). A launch spike can hit Supabase's
    free caps (200 live connections matter for 1v1). Check usage the day
    before and after launch. Vercel Pro is needed before any paid supporter
    tier.
L4. Real-device test day (owner, M). iPhone home-screen app, Android
    Chrome, an iPad, a Windows laptop: sign-in, a bot game, a review from a
    username, a puzzle, Rush, Tactica's first world, a 1v1 by invite link
    between two phones. The Tactica checklist
    (tactica-design/test-checklist.md) on one phone.
L5. Link previews on the live site (owner, S). Paste the home page, a
    /g/ game link and a review link into Discord and iMessage after A1.
L6. Kinnda (decision 11). It's a separate app for a child. Is it part of
    the public launch, linked from the site, or kept private?
L7. Launch content (owner). A YouTube video or short showing Game Review
    and Chess Tactica, a Discord announcement, the share cards. Soft
    launch to the Discord first (LAUNCH_PLAN section 6), watch the numbers
    for a week, then go wider.

## 9. Decisions for the owner

1. The one name for search and titles: "Zlegend's Chess Bot",
   "Zlegend2700", or something new. (Recommended: keep "Zlegend2700" as
   the brand and "Zlegend's Chess Bot" in the about text.)
2. Newcomer text on Home, under the app buttons (recommended), or a
   separate /about page.
3. Prerendering: the light script (recommended) or headless-browser
   snapshots (needs Puppeteer or Playwright as a dev dependency).
4. Beginner lessons: write them for the main site, reuse Kinnda's, or not
   now.
5. Beginner bot levels below 1000: yes or no.
6. 1v1 invite links: yes or no. (Recommended: yes, before launch.)
7. Analytics for EU visitors: drop the persistent ID, or add a notice with
   a choice.
8. Opening pages: just the 12 trainer openings with real notes
   (recommended), or also hundreds of generated pages from the opening book
   (risk: thin pages that search engines discount).
9. OK to install axe-core (development only) for accessibility tests.
10. The Dragon course: finish it, hide it, or label it "coming soon".
11. Kinnda's place in the launch.
12. Which settings from F7 are worth adding.

### Owner's answers (2026-11-23)

- Brand: Zlegend2700 in every title ("Zlegend's Chess Bot" once, in the
  about text).
- Newcomer message on Home, under the buttons.
- 1v1 invite links: yes.
- Learn gets a "How to play" track; a "Dumb Bot" level below 1000 Elo.
- The Dragon course: label it "coming soon".
- Kinnda: keep private (not linked, not in the sitemap).
- Analytics for EU visitors: "yes" (still to confirm which: drop the
  persistent ID, or a notice with a choice).
- axe-core dev dependency: yes.
- Not asked, plan defaults used: prerendering with the light script;
  opening pages for the 12 trainer openings only; settings (F7) later.

## 10. Suggested order

1. Quick wins (one session, all S): P1, P2, L1, A2, C2, C3, D4, D5, D6,
   fixing og:image to an absolute URL. Low risk and nothing to decide
   except naming.
2. SEO foundation: A1, A3, A4, A5, then the owner does A6.
3. Newcomer experience: D1, D3, D2.
4. Launch features: F1 (invite links), F5 (/daily), F8 (feedback).
5. Content for search: opening pages, the about page, then F3 if chosen.
6. Accessibility pass: C1, then C4 to C7.
7. Measure (P5) and the real-device test day (L4, L5).
8. Soft launch (L7). After it: F2, F4, F6, F7 based on what players ask for.

## 11. Progress

2026-11-23, quick wins built (NOT pushed; waiting for the owner's OK):
- P1 hashed files cached for a year; L1 security headers (nosniff,
  referrer policy, no framing by other sites, microphone only for this
  site, no camera/location) in vercel.json.
- A2 real 404: vercel.json sends only the app's own addresses to the app;
  anything else gets public/404.html with a 404 status. A test
  (routes.test.js) fails if a page is added to routes.js but not to
  vercel.json.
- P2 the service worker's first download: 3.3 MB down to 1.1 MB. On-demand
  code and pictures are cached when first used. A tab left open across a
  deploy reloads once if a page's code is gone (vite:preloadError).
- C2 a "main" landmark round every page and a "Skip to content" link (first
  Tab stop); C3 the 1v1 lobby has a heading.
- Brand: tab titles are "<page> · Zlegend2700"; Home's title and the share
  tags say what the site is; share images use absolute URLs; the installed
  app is named Zlegend2700. (No canonical tag yet: it comes with A1, where
  each page gets its own.)
- D4 Play page: every card has an icon, a name and one line.
- D5 Puzzles: every card has a description. Learn: "New" label gone; the
  Dragon course says "Coming soon · chapter 1 open now".
- D6 bottom bar says "Review" (screen readers hear "Game Review").
Checked: lint, 968 tests, build; Play, Puzzles, Learn, Home and a game at
phone size; the skip link with a real Tab press. Noted for D2: the game
screen is 897px tall on an 812px phone (it was before too).

Pushed 2026-11-23 (cd751ac, 89626a2, 3cbcfc5) and checked live: real 404,
security headers, year-long caching, new titles and Play cards. The first
deploy failed (Vercel rejects "/?" in a route pattern); fixed in 3cbcfc5.
Analytics (owner chose "drop the ID"): events carry a per-visit number
and no account id; Privacy Policy and stats.sql updated.

Built, committed, NOT pushed yet (waiting for the owner's OK):
- A1/A3/A4: scripts/prerender.mjs (postbuild) writes dist/<page>.html for
  14 pages from src/data/seoPages.js: own title, description, canonical,
  og:url, structured data (WebSite, Organization, WebApplication on Home;
  breadcrumbs elsewhere) and visible text; the sitemap is generated with
  lastmod. vercel.json cleanUrls serves /puzzles from puzzles.html. Checked
  in the production preview: each page's HTML, and the app replacing the
  text with no leftovers. To check after deploy: curl /review shows its own
  title (not Home's).
- D1: Home "New here?" card under the buttons (Hide remembers).
- F2: Dumb Bot (below 1000), offered first after Rank Bot in every list.

Pushed 2026-11-23 (cedd5c4) and checked live: /review, /puzzles, /tactica
send their own titles, /puzzles.html redirects, the sitemap is generated.

Also built and pushed:
- F1 invite links: "Invite a friend" in the 1v1 lobby opens a private table
  (seat at "inv-<code>", not listed) with a link to copy or share
  (/lobby?invite=<code>); the friend is seated there, through sign-in too
  (utils/invite.js, 2-hour expiry). No new SQL. Unit-tested; the live
  two-player flow is NOT tested (guests can't join since public access was
  turned off; needs two signed-in accounts).
- F3 How to play chess: a 5-chapter beginner course, first in Learn
  (lessons can now start from their own position, startFen, and a puzzle
  can accept any checkmate, acceptMate). lessons.test.js replays every
  lesson. Played chapter 2 through in the browser.

Pushed 2026-11-23 (9c15e4b):
- D2 Home on desktop: two columns from 1024px, fits one screen. The game
  screen was measured at a real 1366x800: the board is already 512px and
  fills the height; growing it more means moving the player cards beside
  it (bigger change, not done).
- C1 axe-core (dev) + our own contrast check: __a11y() in the dev console.
  12 pages, both themes: no rule failures. Found and fixed: the Opening
  Trainer card showed the browser's grey through its gradient.
- C4 NOT changed: pinch zoom is blocked on the game screen because the
  owner asked for it (2026-11-16). Asked the owner whether to allow pinch
  but keep blocking double-tap.

Pushed 2026-11-23 (42eb490):
- C4 zoom, matched to Lichess and Chess.com after the owner asked: pinch
  zoom works on every page except on the board itself; double-tap zoom is
  off (touch-action: manipulation). Viewport keeps minimum-scale=1.
- C5 focus goes back to the button that opened a popup (or the menu
  button, when the menu item that opened it is gone).
- C6 the board's grade badge is spoken ("Graded: Blunder") instead of
  being colour and an icon only.
- C7 /accessibility page (what works, what doesn't yet, how to tell us),
  linked from Home's footer, prerendered and in the sitemap.

Pushed 2026-11-23 (this batch):
- P3 lesson-coach.webp 176 KB to 8 KB, blueeyes.webp 114 KB to 9 KB
  (resized to 3x the size they're shown at).
- P5 real-visitor speed: utils/vitals.js sends LCP, INP, CLS (and TTFB,
  width, connection type) once per visit as a "vitals" event, no library.
  Read with query 10 in supabase/stats.sql (p75 per page, phone vs
  computer). Privacy Policy mentions it.
- Found by measuring while building P5: Home's greeting bubble grew as it
  typed and pushed the page down 72 times (CLS 0.178, Google's "good" is
  under 0.1). The bubble now holds its final size from the first frame:
  CLS 0.010.
- Leftover "Zlegend's Chess Bot" names (Privacy, Terms, crash screen,
  share title) changed to Zlegend2700.

Pushed 2026-11-23 (17c3818): P3, P5 and the greeting-bubble shift above.

Then, A8 opening pages: each of the 12 trainer courses has its own
address, /openings/<name> (vienna-game, sicilian-defence, ...; slugs in
src/data/openingPages.js, never rename one once live). The prerendered page
is the course's own notes (what the opening is after, the idea step by
step, the plan), a Home > Learn chess > opening breadcrumb, and links to
the other openings for that side; Learn and the Openings library link to
all 12; all are in the sitemap (27 pages now). In the app the address
opens the trainer on that course, and the address follows whichever
course is open, so it can be shared or refreshed. Back still goes to Home.
Unknown names (/openings/bongcloud) get the real 404.

Pushed 2026-11-23 (ebad5e5) and checked live: /openings/sicilian-defence
has its own title and canonical, the sitemap lists all 12, and
/openings/bongcloud is a real 404.

Then, D8 empty and error states:
- Leaderboard: a failed load (offline, server trouble) now says
  "Couldn't load the scores" with Try again, instead of "No scores yet
  here. Be the first!". (Not seen live: needs the network to fail.)
- 1v1 lobby: if it can't connect (an error, or nothing after 12 s) it
  says so with Try again, instead of "Connecting…" forever; seen in dev.
  When you're the only one there, it says so and what to do (sit and
  wait, or invite a friend).
- Game Review: an empty game list says a game shows up once it's over,
  to check the spelling, or to use Paste a game. (Not found, site busy
  and can't reach the site already had their own messages.)

Pushed 2026-11-23 (82056db).

Then, F8 Feedback: "Feedback" in the profile menu opens a popup (a bug or
an idea, a text box, Send), saved as a "feedback" event with the page,
browser and screen width, no name or email; Discord and the support
email are offered too. Read with query 11 in supabase/stats.sql. The
Privacy Policy and track.js say feedback is the one event with the
player's own words. Text is trimmed to fit the table's 2 KB limit (tested
with emoji and non-Latin text). Checked in dev, both themes, contrast
clean; a real send from the live site is NOT tested yet (dev only logs).

Next: Game Review share link (F4), /daily (F5).

Sources for the search notes:
- Chess.com, Game Review for members: https://www.chess.com/news/view/chesscom-releases-new-game-review
- Chess It Up, Chess.com review limits: https://chessitup.com/blog/unlimited-chess-com-game-reviews-free
- Chessda, free review tool: https://chessda.pages.dev/free-chess-game-review
- Nuxt SEO, prerendering a single-page app: https://nuxtseo.com/learn-seo/vue/spa/prerendering
- Unhead, single-page app head tags: https://unhead.unjs.io/docs/head/guides/get-started/single-page-applications
