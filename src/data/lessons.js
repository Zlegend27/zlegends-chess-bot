/* ================================================================
   Lesson content -- structured coach lessons for LessonPlayer.jsx.

   Each chapter is a `mainLine` (a plain SAN move array, same
   convention as everything else in this app -- puzzle banks, opening
   book, move lists) plus a `beats` array of interactive checkpoints,
   each anchored to a ply in that line via `afterPly` (0 = starting
   position, 1 = after White's first move, etc.).

   Beat types (see LessonPlayer.jsx for how each renders/behaves):
   - narration:  coach's text at a position. "Next" to continue.
   - think:      a strategic question -- student can try a move on the
                 live board first, gets matched against `ideaMove` (if
                 given) before the explanation reveals either way.
   - branch:     two or more named plans from the same position, each
                 played out on request; returns to the branch point and
                 resumes the main line when done.
   - puzzle:     find-the-move, checked against `solution` (an
                 alternating [student, reply, student, reply, ...] SAN
                 array -- identical convention to the puzzle bank's own
                 `.moves`, so it reuses that exact interaction).
   ================================================================ */

export const LESSONS = [
  {
    id: "hyper-accelerated-dragon",
    title: "Hyper-Accelerated Dragon",
    desc: "A Black repertoire against 1.e4 built around winning the fight for d5.",
    orientation: "black",
    chapters: [
      {
        number: 1,
        title: "Move Order & the Fight for d5",
        /* Reconstructed from a coach's video transcript (auto-transcribed,
           so chess notation came through garbled in places) -- verified
           against a real PGN once one's supplied. The line stops after
           the branch point below (fully confirmed content); the tactic
           later in the video needs the PGN before it ships as a puzzle,
           since a wrong guessed square here would silently break the
           position rather than just being imprecise commentary. */
        mainLine: ["e4", "c5", "Nf3", "g6", "Bc4", "Bg7", "d3", "Nc6", "Nc3", "Nf6", "Bd2", "O-O", "O-O"],
        beats: [
          {
            type: "narration",
            afterPly: 4,
            text: "The Accelerated Dragon skips ...d6 entirely — g6 and Bg7 go in immediately. That's the whole point of \"accelerated\": Black can fight for the d5 square in one move instead of two.",
          },
          {
            type: "narration",
            afterPly: 8,
            text: "...Nc6 gives Black three pieces bearing on d4 (the c5-pawn, Bg7, and now Nc6) against White's two. White's moves so far are all reasonable on their own, but none of them add up to a real plan.",
          },
          {
            type: "think",
            afterPly: 13,
            prompt: "Both sides have castled. Black's last piece to develop is the light-squared bishop. What's the plan?",
            ideaMove: "b6",
            answer: "The whole point of this setup: control d5. There are two ways to get there from here — see both below.",
          },
          {
            type: "branch",
            afterPly: 13,
            prompt: "Two ways to fight for d5 from this exact position:",
            options: [
              {
                label: "Trade off the light-squared bishop",
                line: ["d6", "Rb1", "Bg4", "h3", "Bxf3", "Qxf3", "Nd4"],
                note: "Not usually a good idea to trade your light-squared bishop, but here it's a trick: after the trade on f3, ...Nd4 jumps in attacking the queen with tempo. Black stands very well.",
              },
              {
                label: "Play b6 and d5 directly (recommended)",
                line: ["b6"],
                note: "The simple, recommended approach. Once ...b6 is in, ...d5 can't be stopped — White has no piece that can contest the square, and getting there in one move instead of two is the whole point of the Accelerated move order.",
              },
            ],
          },
          {
            type: "narration",
            afterPly: 13,
            text: "Chapter 1 continues here in the next update — the winning tactic later in this game is being finalized against the real game PGN before it ships as an interactive puzzle.",
          },
        ],
      },
    ],
  },
];
