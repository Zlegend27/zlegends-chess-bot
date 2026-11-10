/* Kinnda's Opening Camp courses. The move trees (src-kindle/openings/*.json)
   are built from real games by the main app's pipeline in kid mode:
     node scripts/openings/build.mjs 400000 8 kid
   Same shape as the main Opening Trainer's courses
   (src/data/openingCourses.js), shorter: the opening ends around move 7.

   - The Vienna Gambit as White, the opening Owl already teaches in the
     Vienna lesson: Nc3, then f4 against ...Nf6 or ...Nc6.
   - 1...e5 as Black: ...Nc6 against Nf3, and the Two Knights (...Nf6)
     against the Italian, the opening of Owl's Two Knights lesson. Stockfish
     and real games pick the rest, including the answers to an early queen
     attack (the "Scholar's mate" try kids meet all the time). */
export const KID_COURSES = [
  {
    id: "kid-vienna", name: "The Vienna", side: "white", root: "e4 e5 Nc3", emoji: "🌪️",
    lesson: "vienna",
    lines: [{ id: "main", name: "The Vienna", forced: { "e4 e5 Nc3 Nf6": "f4", "e4 e5 Nc3 Nc6": "f4" } }],
  },
  {
    id: "kid-e5", name: "The Two Knights", side: "black", root: "e4 e5", emoji: "🐴",
    lesson: "two-knights",
    lines: [{ id: "main", name: "1...e5 and the Two Knights", forced: { "e4 e5 Nf3": "Nc6", "e4 e5 Nf3 Nc6 Bc4": "Nf6" } }],
  },
];

export const kidCourseById = (id) => KID_COURSES.find((c) => c.id === id) ?? null;
