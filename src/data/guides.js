/* Guides: articles at /guides/<slug>, written to be found in search and
   to lead into the site's tools. scripts/prerender.mjs writes each published
   guide as its own page (see seoPages.js); GuidesPage.jsx shows them.

   A guide with `draft: true` is not on the live site: no page, no link, not
   in the sitemap. On the dev server drafts show, marked "Draft", so the
   owner can read and edit them before taking the flag off.

   Blocks in `body`: { p: text }, { h2: text }, { ul: [items] },
   { cta: label, href } (a button into the site), { video: YouTube id }.
   Keep every claim true to what the site does. Slugs are the addresses:
   don't change one once it's live. */

export const GUIDES = [
  {
    slug: "how-chess-accuracy-is-calculated",
    draft: true,
    title: "How chess accuracy is calculated (and how ours matches Chess.com)",
    description: "What an accuracy score really measures, why a 90% game can still be lost, and how Zlegend2700's free Game Review was tuned to land near Chess.com's number.",
    heading: "How chess accuracy is calculated",
    updated: "2026-11-26",
    minutes: 5,
    body: [
      { p: "After a game, review tools give each player an accuracy score out of 100. It feels like a grade, but it measures something specific: how much of your winning chances you kept, move by move, compared with the engine's best play." },
      { h2: "Step 1: winning chances, not just the engine number" },
      { p: "An engine rates a position in pawns: +1.5 means White is better by about a pawn and a half. That number isn't fair to compare directly. Going from +0.5 to −1.0 changes the game a lot; going from +8 to +6 changes almost nothing, because you're still winning. So the evaluation is first turned into expected points: the share of the result you'd expect from that position, from 0 to 100." },
      { h2: "Step 2: what each move cost" },
      { p: "For every move, the tool compares your expected points before and after it. If the best move keeps you at 70 and your move drops you to 55, that move cost 15 points. A move that keeps everything costs nothing. That cost is also where the labels come from: Chess.com's published cut-offs are 5 points for an inaccuracy, 10 for a mistake and 20 for a blunder." },
      { h2: "Step 3: from move costs to one score" },
      { p: "Each move's cost becomes a move score on a curve: a free move scores 100, and the score falls quickly as the cost grows. The game's accuracy is built from those move scores. Moves you were forced to play, with no real choice, are left out." },
      { h2: "Why a 90% game can still be lost" },
      { ul: [
        "One blunder in a long game barely dents the average, but it can lose on the spot.",
        "Accuracy compares you with the engine, not with your opponent. Two players can both score 85.",
        "Quiet, simple positions are easy to play accurately. Sharp ones aren't.",
      ] },
      { h2: "How we matched Chess.com" },
      { p: "Chess.com doesn't publish its formula. So we fitted ours to theirs: we took 750 public Chess.com games across six rating bands, with Chess.com's own accuracy for each, and tuned our curves until our numbers lined up. Then we checked it on 750 more games it had never seen. On those, our score lands within 5 points of Chess.com's about 83% of the time, with a typical difference of 3 points." },
      { p: "One thing we found: a plain average of move scores reads too high for weaker games. Chess.com's numbers spread wider, so our score stretches each game's distance from 100 to match. No rating is needed: a version that used ratings did no better." },
      { p: "The engine is Stockfish, running in your own browser, so a review costs nothing to run and stays free and unlimited." },
      { cta: "Review one of your games", href: "/review" },
    ],
    related: ["/review", "/play"],
  },
  {
    slug: "how-to-practise-blindfold-chess",
    draft: true,
    title: "How to practise blindfold chess, step by step",
    description: "A step-by-step plan to see the board in your head: square names, colours, how pieces move, following moves, then small puzzles with no board at all.",
    heading: "How to practise blindfold chess",
    updated: "2026-11-26",
    minutes: 5,
    body: [
      { p: "Blindfold chess means playing without seeing the board. It sounds like a party trick, but the skill underneath, holding a position in your head, is the same one you use every time you calculate a few moves ahead. Training it makes your normal chess sharper." },
      { p: "The trick is not to start blind. Start with a board, then take it away a little at a time." },
      { h2: "1. Learn the squares" },
      { p: "Every square has a name: a file (a to h, left to right from White's side) and a rank (1 to 8, from White's side up). Start by finding squares on a board you can see, then on a board with no letters or numbers, then from Black's side." },
      { h2: "2. Know the colours" },
      { p: "Without a board, you can still tell whether a square is light or dark. a1 is dark, and colours alternate along every file and rank, so a square whose file and rank are both odd or both even (like a1, c3 or b2) is dark." },
      { h2: "3. See where pieces can go" },
      { p: "Ask yourself where a knight on g1 can move, or which squares a bishop on c4 reaches. Do it with the board first, then on an empty board, then from memory." },
      { h2: "4. Follow moves in your head" },
      { p: "Read a short series of moves and keep track of where things end up: after 1.e4 e5 2.Nf3 Nc6 3.Bb5, where is White's bishop? What's on c6? This is the heart of blindfold play." },
      { h2: "5. Small positions, no board" },
      { p: "Finally, solve small puzzles from a list of pieces: find a check, a piece you can take for free, or mate in one. Keep them small at first, a handful of pieces, and grow from there." },
      { h2: "How fast to move on" },
      { ul: [
        "Practise in short sessions: five questions, a few minutes.",
        "Getting nearly all of them right? Make it harder: less board, more pieces.",
        "Missing several? Step back a level for a while. That isn't failing, it's how the skill sticks.",
      ] },
      { p: "Zlegend2700's Blind Chess Trainer is built exactly like this: ten stages, each starting on a board you tap, then a bare board, then no board at all, moving you on faster when you're getting them right. When you're ready, it has text puzzles read as a list of pieces, and a full game by voice." },
      { cta: "Start the Blind Chess Trainer", href: "/blind" },
    ],
    related: ["/blind", "/lessons"],
  },
  {
    slug: "how-to-play-the-vienna-gambit",
    draft: true,
    title: "How to play the Vienna Gambit: ideas, traps and a plan",
    description: "The Vienna Gambit for White (1.e4 e5 2.Nc3 then f4): the idea, Black's main replies, what to do after each, and the plan once the opening is over.",
    heading: "How to play the Vienna Gambit",
    updated: "2026-11-26",
    minutes: 6,
    body: [
      { p: "The Vienna Gambit is an attacking opening for White that starts 1.e4 e5 2.Nc3, then f4. It's easy to learn, it gets you a fight from move three, and many club players don't know it well." },
      { h2: "The idea: knight first, then f4" },
      { p: "2.Nc3 develops a piece and guards e4, but unlike the usual 2.Nf3 it leaves the f-pawn free. White's plan is f2–f4: hit Black's e5 pawn, open the f-file toward Black's king, and build a big centre." },
      { h2: "Against 2…Nf6: the true Vienna Gambit" },
      { p: "After 2…Nf6, 3.f4 is the gambit. If Black takes with 3…exf4, 4.e5 kicks the knight, which usually goes back to g8, and White gets a big centre and quick development. Black's best reply is to strike back in the centre with 3…d5; after 4.fxe5 Nxe4 5.Nf3, White develops and keeps the extra space on the kingside." },
      { h2: "Against 2…Nc6: f4 anyway" },
      { p: "With Black's knight on c6 instead of f6, there's no …Nxe4 trick, so 3.f4 is good here too. If 3…exf4, play 4.Nf3: it stops …Qh4+ and gets ready for d4. You'll usually win the pawn back with Bxf4 and end up with a big centre and quick development, which is the whole point of the gambit." },
      { h2: "Common Black replies, and your answer" },
      { ul: [
        "…g5, holding on to the pawn: g3 attacks f4 at once, and after …fxg3, hxg3 your rook uses the open h-file.",
        "…Bb4, pinning your knight: Nd5 steps out of the pin and attacks the bishop, f4 and c7.",
        "…Bc5, aiming at your king: develop with Nf3 first. Don't rush fxe5 while that bishop eyes g1.",
        "…Nf6, ignoring the attack on e5: take on e5, then kick the knight with d4 and e5.",
      ] },
      { h2: "If you prefer something calmer" },
      { p: "The Vienna Game keeps the same start but plays Bc4 before f4, aiming at f7, the square only Black's king defends. A quiet set-up with Bc4, d3, and later f4 or Nf3 is solid and still sharp enough to win games." },
      { h2: "The plan after the opening" },
      { p: "Castle short, open the f-file with f4 if you haven't yet, and point your pieces at Black's kingside. In the gambit lines, use your lead in development before Black untangles." },
      { p: "The fastest way to learn it is on a board: Zlegend2700's free Opening Trainer walks you through the idea move by move, quizzes you on the main line, then shows you the replies players at your level really make, with how to answer each." },
      { cta: "Train the Vienna", href: "/openings/vienna-game" },
    ],
    related: ["/openings/vienna-game", "/lessons"],
  },
];

/** The guides on the live site (drafts are dev-only). */
export const PUBLISHED_GUIDES = GUIDES.filter((g) => !g.draft);

export const guidePath = (slug) => `/guides/${slug}`;

/** The guide an address leads to, or null. */
export function guideForPath(path) {
  const m = /^\/guides\/([a-z0-9-]+)\/?$/.exec(path);
  return m ? GUIDES.find((g) => g.slug === m[1]) ?? null : null;
}

/** A guide's text as plain paragraphs, for search engines' pre-built page. */
export function guideText(g) {
  return g.body.flatMap((b) => (b.p ? [b.p] : b.h2 ? [b.h2] : b.ul ? b.ul : []));
}
