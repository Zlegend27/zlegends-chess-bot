/* Kinnda Lessons -- concept lessons for a kid who already knows how the
   pieces move (that's "How to Play") but not yet WHY you play the moves
   you play. Owl (see AnimalIcon.jsx) is the fixed narrator regardless of
   which animal the kid has equipped as their opponent, same idea as the
   main site's Coach Bot being a separate identity from whoever you're
   actually playing against.

   Every beat carries `demoMoves` -- a SAN array replayed from the start
   position (via replayIntoEngine, same convention as the main app's own
   Lessons feature) -- so the board always shows exactly the position the
   text is talking about, before any interaction happens.

   Beat types:
   - narration: just text + a demo position. "Next" to continue.
   - quiz: a concept check -- text-button multiple choice (not a board
           move), each option has its own feedback `note`; picking the
           `correct` one plays that idea out on the board if it carries
           a `move`.
   - think: try a real move on the live board, matched against
            `acceptable` (a list, since more than one move can be "the
            idea" -- e.g. castling either side).

   All demoMoves/acceptable SAN was hand-verified against the engine's
   own legal-move generator before shipping (see verifyKidLessons.mjs). */

export const KID_LESSON_CHAPTERS = [
  {
    id: "opening-habits",
    title: "Opening Habits",
    subtitle: "4 golden rules for starting a game right",
    teacher: "Owl",
    beats: [
      {
        type: "narration",
        demoMoves: [],
        text: "Hi, I'm Owl! You already know how the pieces move -- now let's learn how to actually START a game like a pro. There are 4 golden rules. Ready?",
      },
      {
        type: "narration",
        demoMoves: ["e4"],
        text: "Golden Rule #1: Control the center! The middle four squares are the most powerful ones on the board -- pieces posted there can reach almost anywhere.",
      },
      {
        type: "quiz",
        demoMoves: ["e4", "e5"],
        prompt: "Both sides grabbed a center pawn. What should White play next?",
        options: [
          { label: "Nf3 -- bring a knight out", correct: true, move: "Nf3",
            note: "Yes! The knight jumps into the game and eyes the center at the same time -- a piece developed AND the center defended." },
          { label: "h3 -- push a side pawn", correct: false,
            note: "Not yet -- h3 doesn't develop a piece or fight for the center. Save little pawn pushes like this for when you actually need them." },
          { label: "Qh5 -- bring the queen out", correct: false,
            note: "Careful! Bringing your queen out this early means it can get chased around and you'll waste moves later. We'll see exactly why in a bit!" },
        ],
      },
      {
        type: "narration",
        demoMoves: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5"],
        text: "Golden Rule #2: Get your pieces out before you attack! Look at this position -- White already has a knight AND a bishop developed, both aiming at the center.",
      },
      {
        type: "think",
        demoMoves: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5"],
        prompt: "It's White's turn. Bring your OTHER knight into the game!",
        acceptable: ["Nc3"],
        hint: "Look at the knight still sitting on b1.",
        answer: "Nc3! Now both of White's minor pieces are out -- one on each side of the board.",
      },
      {
        type: "narration",
        demoMoves: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "Nc3", "Nf6"],
        text: "Golden Rule #3: Castle early! Once your knights and bishops are out of the way, tuck your king behind its pawns before things get busy in the middle of the board.",
      },
      {
        type: "think",
        demoMoves: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "Nc3", "Nf6"],
        prompt: "Time to get your king to safety. Castle kingside!",
        acceptable: ["O-O"],
        hint: "Look for the special two-square king move, toward your rook.",
        answer: "O-O! Your king is tucked safely behind its pawns, and your rook hops right to the center file.",
      },
      {
        type: "narration",
        demoMoves: ["e4", "e5", "Qh5", "Nc6", "Bc4", "g6"],
        text: "Golden Rule #4: Don't bring your queen out too early! Here White tried Qh5 on move 2 instead of developing a knight -- and now Black's pawn on g6 is attacking it.",
      },
      {
        type: "quiz",
        demoMoves: ["e4", "e5", "Qh5", "Nc6", "Bc4", "g6"],
        prompt: "The queen is under attack! What should White play?",
        options: [
          { label: "Qf3 -- retreat to safety", correct: true, move: "Qf3",
            note: "Smart! The queen slides to a safe, still-useful square. No real harm done, but White definitely wasted time bringing it out so soon." },
          { label: "Qxh7?? -- grab a pawn", correct: false,
            note: "Ouch -- that wins a pawn, but ...Rxh7 wins the queen right back! Never grab a pawn if it costs you your queen." },
          { label: "Qxg6?? -- grab the attacker", correct: false,
            note: "Tempting, but ...hxg6 recaptures immediately. Trading your queen for one pawn is a terrible deal." },
        ],
      },
      {
        type: "narration",
        demoMoves: [],
        text: "You've got it! The 4 golden rules: control the center, get your pieces out, castle early, and keep your queen home until she's needed. Go try them out in a real game!",
      },
    ],
  },
  { id: "special-moves", title: "Special Moves", subtitle: "Castling, en passant, and pawn promotion", comingSoon: true },
  { id: "spot-the-trick", title: "Spot the Trick", subtitle: "Forks, pins, and skewers", comingSoon: true },
  { id: "checkmate-patterns", title: "Checkmate Patterns", subtitle: "Famous ways to finish the game", comingSoon: true },
  { id: "endgame-basics", title: "Endgame Basics", subtitle: "Winning when there are just a few pieces left", comingSoon: true },
];
