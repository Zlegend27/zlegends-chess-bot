/* What search engines and link previews see for each public page, before
   the app's script runs: the title, the description, a heading, a few lines
   saying what the page is, and links on to the rest of the site.
   scripts/prerender.mjs writes one HTML file per page from this list at
   build time, plus the sitemap. Keep it true to what the page really does.

   Brand: Zlegend2700 in every title (owner's decision, 2026-11-23). */

export const SITE = {
  name: "Zlegend2700",
  url: "https://www.zlegend2700.com",
  image: "https://www.zlegend2700.com/og.jpg",
  /* For the "who runs this" structured data. */
  sameAs: [
    "https://www.youtube.com/@Zlegend27",
    "https://www.tiktok.com/@zlegend27",
    "https://discord.gg/TQtfCVkYqa",
    "https://github.com/Zlegend27/zlegends-chess-bot",
  ],
};

const OPENINGS_LIST = "the Vienna, Italian, Ruy Lopez, Scotch, London System, Queen's Gambit, Sicilian, French, Caro-Kann, Scandinavian, King's Indian and Queen's Gambit Declined";

/* Each page: path, title (without the brand), description (about 150
   characters), heading, intro paragraphs, and related links. `noindex`
   pages are built but kept out of the sitemap. */
export const SEO_PAGES = [
  {
    path: "/",
    title: "Free chess: bots, puzzles and game review",
    description: "Free chess in your browser: play bots that play like people, review your Chess.com or Lichess games move by move, solve puzzles and learn openings. No ads.",
    heading: "Free chess in your browser",
    intro: [
      "Zlegend2700 is a free chess site with no ads and no account needed. Play bots that play like real people at your level, get every move of your games graded, solve puzzles, learn openings, and play Chess Tactica, a 3D story adventure with living chess pieces.",
    ],
    links: ["/play", "/review", "/puzzles", "/lessons", "/tactica"],
  },
  {
    path: "/play",
    title: "Play chess against the computer, free",
    description: "Play chess against a bot that plays like a person at your level, or up to full engine strength. Free, in your browser, no account needed.",
    heading: "Play chess",
    intro: [
      "Play a bot that plays like a person at your level and adjusts as you improve, or pick a fixed level up to full engine strength. You can also play a real person online, move both sides yourself, play a whole game by voice with Blind Chess, or watch two bots battle.",
    ],
    links: ["/lobby", "/tactica", "/watch", "/review"],
  },
  {
    path: "/review",
    title: "Free chess game review for Chess.com and Lichess",
    description: "Review your Chess.com or Lichess games for free: type your username, pick a game, and see your accuracy, best moves and mistakes. Unlimited, no account.",
    heading: "Free chess game review",
    intro: [
      "Type your Chess.com or Lichess username and your latest games appear. Tap one and every move is graded: your accuracy, your best moves and your mistakes. Then practise the moves you missed. You can also paste a PGN or a game link.",
      "Unlimited and free. No account and no password are needed, and the engine runs in your own browser.",
    ],
    links: ["/play", "/puzzles", "/lessons"],
  },
  {
    path: "/puzzles",
    title: "Chess puzzles: daily, ranked and Puzzle Rush",
    description: "Free chess puzzles: a new daily puzzle, ranked puzzles from beginner up, Puzzle Rush against the clock with leaderboards, and Chess Tactica.",
    heading: "Chess puzzles",
    intro: [
      "Solve a new puzzle every day, train at your level with ranked puzzles from beginner up, race the clock in Puzzle Rush and climb the leaderboard, or take on the puzzle rush inside Chess Tactica's 3D bin.",
    ],
    links: ["/rush", "/ranked", "/leaderboard", "/tactica"],
  },
  {
    path: "/rush",
    title: "Puzzle Rush: solve chess puzzles against the clock",
    description: "Solve as many chess puzzles as you can before time runs out. Puzzles get harder as you go, and your best scores go on the leaderboard.",
    heading: "Puzzle Rush",
    intro: ["Solve as many puzzles as you can before the clock runs out. They start easy and get harder, a wrong move costs you, and your best scores go on the leaderboard."],
    links: ["/leaderboard", "/puzzles", "/ranked"],
  },
  {
    path: "/ranked",
    title: "Chess puzzles by rating, from beginner up",
    description: "Pick your level and solve chess puzzles rated for it, from beginner to expert. Free, in your browser.",
    heading: "Ranked puzzles",
    intro: ["Pick a rating band, from beginner to expert, and solve puzzles chosen for that level."],
    links: ["/puzzles", "/rush"],
  },
  {
    path: "/leaderboard",
    title: "Puzzle Rush leaderboards",
    description: "The best Puzzle Rush and Chess Tactica Rush scores on Zlegend2700.",
    heading: "Leaderboards",
    intro: ["The top scores in Puzzle Rush and in Chess Tactica's puzzle rush."],
    links: ["/rush", "/puzzles"],
  },
  {
    path: "/lessons",
    title: "Learn chess: how to play, and openings",
    description: "Learn how to play chess from scratch: how the pieces move, check and checkmate, castling. Then learn 12 openings with a free trainer.",
    heading: "Learn chess",
    intro: [
      "New to chess? How to play chess walks you through the board, how every piece moves, check and checkmate, castling and en passant, and a first plan for your games, with a puzzle to solve at every step.",
      `Then the Opening Trainer teaches 12 openings the right way: the ideas behind each move, the replies players at your level really make, and how to punish their mistakes. It covers ${OPENINGS_LIST}.`,
    ],
    links: ["/openings", "/play", "/review"],
  },
  {
    path: "/openings",
    title: "Chess openings library",
    description: "The most popular chess openings, from the Italian Game to the Sicilian Defense, each with a short summary. Pick one and practise it on the board.",
    heading: "Chess openings",
    intro: ["The most popular chess openings, from the Italian Game and the Ruy Lopez to the Sicilian Defense, each with a short summary of its ideas. Pick one and practise its moves on the board."],
    links: ["/lessons", "/play"],
  },
  {
    path: "/watch",
    title: "Watch chess bots play each other",
    description: "Sit back and watch two chess bots battle, from beginner level to full engine strength.",
    heading: "Watch bots play",
    intro: ["Pick two bots and watch them play a full game, from beginner level up to full engine strength."],
    links: ["/play"],
  },
  {
    path: "/tactica",
    title: "Chess Tactica: a 3D chess puzzle adventure",
    description: "Chess Tactica is a free 3D chess adventure: living chess pieces, a story across four worlds, boss fights, puzzle rushes and 1v1, in your browser.",
    heading: "Chess Tactica",
    intro: [
      "A chess set thrown in the bin wakes up, and the pieces need you. Fight your way out through four worlds of puzzles, bosses and story, with chess pieces that come alive in 3D. Also inside: a puzzle rush, games against bots, and 1v1.",
    ],
    links: ["/puzzles", "/play"],
  },
  {
    path: "/lobby",
    title: "Play chess online 1v1",
    description: "Play chess against a real person online, ranked or casual, in your browser.",
    heading: "1v1 chess",
    intro: ["Sit at a table and play a real person, ranked or casual, with a clock. Signing in is needed to play."],
    links: ["/play"],
  },
  {
    path: "/privacy",
    title: "Privacy Policy",
    description: "What Zlegend2700 keeps, why, and how to delete it.",
    heading: "Privacy Policy",
    intro: ["What the site keeps about you, why, and how to see or delete it."],
    links: ["/terms"],
  },
  {
    path: "/terms",
    title: "Terms of Service",
    description: "The terms for using Zlegend2700.",
    heading: "Terms of Service",
    intro: ["The terms for using the site: play fair, be kind, and the rules for accounts and content."],
    links: ["/privacy"],
  },
];

/** Link text for each page, for the "more on the site" links. */
export const LINK_TEXT = {
  "/": "Home",
  "/play": "Play chess",
  "/review": "Free game review",
  "/puzzles": "Chess puzzles",
  "/rush": "Puzzle Rush",
  "/ranked": "Ranked puzzles",
  "/leaderboard": "Leaderboards",
  "/lessons": "Learn chess",
  "/openings": "Openings library",
  "/watch": "Watch bots play",
  "/tactica": "Chess Tactica",
  "/lobby": "Play 1v1",
  "/privacy": "Privacy",
  "/terms": "Terms",
};
