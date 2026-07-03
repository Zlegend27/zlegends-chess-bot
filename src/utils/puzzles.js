/* A small curated puzzle set, hand-built in the same format Lichess's own
   public puzzle database uses (github.com/lichess-org/database, exported at
   database.lichess.org/#puzzles): a FEN plus a UCI-less move sequence that
   alternates solver / opponent, starting with the solver's move. That
   dataset has millions of real, human-rated, engine-verified puzzles —
   scaling this past a hand-curated starter set means importing it (convert
   each row's `Moves` from UCI to SAN via the engine, keep `Rating` as-is)
   rather than writing a puzzle generator from scratch; see the review
   thread this came out of for why generating your own is a much worse
   trade than importing Lichess's.
   `moves[i]` for even i is the solver's move; odd i is auto-played for
   them (the "opponent's" forced reply) — every line is validated against
   the real engine in puzzles.test.js. */

export const RATING_BANDS = [
  { id: "easy", label: "Easy", min: 0, max: 1150 },
  { id: "medium", label: "Medium", min: 1150, max: 1550 },
  { id: "hard", label: "Hard", min: 1550, max: 9999 },
];

export const PUZZLES = [
  {
    id: "fork-king-rook",
    rating: 900,
    themes: ["fork", "knight"],
    fen: "r3k3/8/4N3/8/8/8/8/4K3 w - - 0 1",
    moves: ["Nc7+", "Kd8", "Nxa8"],
  },
  {
    id: "back-rank-mate",
    rating: 800,
    themes: ["mate", "backRank"],
    fen: "6k1/5ppp/8/8/8/8/8/3R3K w - - 0 1",
    moves: ["Rd8#"],
  },
  {
    id: "pin-and-win",
    rating: 1300,
    themes: ["pin", "bishop"],
    fen: "6k1/8/4n3/8/2B5/8/8/K7 w - - 0 1",
    moves: ["Bxe6+"],
  },
  {
    id: "fork-king-queen",
    rating: 1400,
    themes: ["fork", "knight", "queen"],
    fen: "6k1/8/8/7q/4N3/8/8/K7 w - - 0 1",
    moves: ["Nf6+", "Kg7", "Nxh5+"],
  },
  {
    id: "discovered-capture",
    rating: 1600,
    themes: ["discoveredAttack", "knight"],
    fen: "4k3/8/4N3/2q5/8/8/8/K3R3 w - - 0 1",
    moves: ["Nxc5+"],
  },
  {
    id: "pin-exploit-exchange",
    rating: 1750,
    themes: ["pin", "exchange"],
    fen: "6k1/5p2/4r3/6N1/2B5/8/8/K7 w - - 0 1",
    moves: ["Nxe6", "fxe6", "Bxe6+"],
  },
];
