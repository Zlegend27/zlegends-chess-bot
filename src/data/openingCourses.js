/* The Opening Trainer's courses: which openings it teaches and the choices
   that make each one what it is. The move trees themselves are built from
   real games by scripts/openings/build.mjs into src/data/openings/<id>.json.

   For each course:
   - `side`: the side the player plays.
   - `root`: the moves (SAN, space separated) that define the opening; the
     course starts in the position after them.
   - `lines`: the course's lines. Each has `forced` player choices, keyed by
     the moves before them, that the builder must use (where the opening
     makes a decision, like the Vienna Gambit's 3.f4). The builder picks the
     player's other moves itself (Stockfish's sound moves, the one strong
     players choose most), preferring the course's `prefer` setup moves when
     they're just as good, so a system opening stays the system.
   Moves up to the root are the player's and the opponent's as written. */

export const COURSES = [
  /* ---------------- White ---------------- */
  {
    id: "vienna", name: "Vienna Game", side: "white", root: "e4 e5 Nc3",
    lines: [
      { id: "vienna", name: "Vienna Game", forced: {} },
      { id: "vienna-gambit", name: "Vienna Gambit", forced: { "e4 e5 Nc3 Nf6": "f4", "e4 e5 Nc3 Nc6": "f4" } },
    ],
  },
  /* The calm, modern Italian (c3 and d3, the Giuoco Pianissimo): at club
     level the sharp d4 lines turn into memorized gambits like the Moller
     Attack, which is what the trainer is meant to avoid. */
  {
    id: "italian", name: "Italian Game", side: "white", root: "e4 e5 Nf3 Nc6 Bc4",
    lines: [{ id: "italian", name: "Italian Game", forced: { "e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6": "d3", "e4 e5 Nf3 Nc6 Bc4 Nf6": "d3" } }],
  },
  { id: "ruy-lopez", name: "Ruy Lopez", side: "white", root: "e4 e5 Nf3 Nc6 Bb5", lines: [{ id: "ruy-lopez", name: "Ruy Lopez", forced: {} }] },
  { id: "scotch", name: "Scotch Game", side: "white", root: "e4 e5 Nf3 Nc6 d4", lines: [{ id: "scotch", name: "Scotch Game", forced: {} }] },
  {
    id: "london", name: "London System", side: "white", root: "d4 d5 Bf4",
    prefer: ["e3", "Nf3", "c3", "Bd3", "Nbd2", "h3", "O-O", "Qc2", "Ne5"],
    lines: [{ id: "london", name: "London System", forced: {} }],
  },
  { id: "queens-gambit", name: "Queen's Gambit", side: "white", root: "d4 d5 c4", lines: [{ id: "queens-gambit", name: "Queen's Gambit", forced: {} }] },

  /* ---------------- Black ---------------- */
  {
    id: "sicilian", name: "Sicilian Defence", side: "black", root: "e4 c5",
    lines: [
      { id: "sicilian", name: "Sicilian Defence", forced: { "e4 c5 Nf3": "d6" } },
      {
        id: "accelerated-dragon", name: "Accelerated Dragon",
        forced: { "e4 c5 Nf3": "Nc6", "e4 c5 Nf3 Nc6 d4": "cxd4", "e4 c5 Nf3 Nc6 d4 cxd4 Nxd4": "g6" },
      },
    ],
  },
  { id: "french", name: "French Defence", side: "black", root: "e4 e6", lines: [{ id: "french", name: "French Defence", forced: {} }] },
  { id: "caro-kann", name: "Caro-Kann Defence", side: "black", root: "e4 c6", lines: [{ id: "caro-kann", name: "Caro-Kann Defence", forced: { "e4 c6 d4": "d5" } }] },
  { id: "scandinavian", name: "Scandinavian Defence", side: "black", root: "e4 d5", lines: [{ id: "scandinavian", name: "Scandinavian Defence", forced: { "e4 d5 exd5": "Qxd5" } }] },
  { id: "qgd", name: "Queen's Gambit Declined", side: "black", root: "d4 d5 c4 e6", lines: [{ id: "qgd", name: "Queen's Gambit Declined", forced: {} }] },
  {
    id: "kings-indian", name: "King's Indian Defence", side: "black", root: "d4 Nf6 c4 g6",
    prefer: ["Bg7", "d6", "O-O", "e5", "Nbd7", "Nc6"],
    lines: [{ id: "kings-indian", name: "King's Indian Defence", forced: {} }],
  },
];

export const LEVELS = [
  { id: "easy", name: "Easy", rating: "≈ 800", band: 0 },
  { id: "medium", name: "Medium", rating: "≈ 1300", band: 1 },
  { id: "hard", name: "Hard", rating: "≈ 1800", band: 2 },
];

export const courseById = (id) => COURSES.find((c) => c.id === id) ?? null;
