/* ================================================================
   Lesson content -- structured coach lessons for LessonPlayer.jsx.

   Each chapter is a `mainLine` (a plain SAN move array, same
   convention as everything else in this app -- puzzle banks, opening
   book, move lists) plus a `beats` array of interactive checkpoints,
   each anchored to a ply in that line via `afterPly` (0 = starting
   position, 1 = after White's first move, etc.).

   Beat types (see LessonPlayer.jsx for how each renders/behaves):
   - playthrough: step/autoplay through the chapter's line first, like
                  the Openings Library replay -- see the game before
                  dissecting it. `toPly` bounds it (default: whole line).
   - narration:  coach's text at a position. "Next" to continue.
   - think:      a strategic question -- student can try a move on the
                 live board first, gets matched against `ideaMove` (if
                 given) before the explanation reveals either way.
   - branch:     one or more named sidelines from the same position,
                 each played out on request; returns to the branch
                 point and resumes the main line when done.
   - puzzle:     find-the-move, checked against `solution` (an
                 alternating [student, reply, student, reply, ...] SAN
                 array -- identical convention to the puzzle bank's own
                 `.moves`, so it reuses that exact interaction).

   Chapter 1's game/lines come from the coach's own PGN
   (chess.com analysis collection, linked in `resources`) -- the
   auto-transcribed video alone had garbled notation, so every move
   here is from the PGN, with the transcript supplying the coaching
   commentary around them.
   ================================================================ */

/* The coached game, flattened from the PGN's 8.Rb1 variation (the
   video's actual game). Plies: 1=e4 ... 13=O-O, 14=e6, 15=Rb1, 16=d5,
   17=exd5, 18=exd5, 19=Bb5, 20=Bg4, 21=Re1, 22=Nd4, 23=Ba4, 24=Rb8,
   25=Bb3, 26=b5, 27=a3, 28=Qd7, 29=Be3, 30=Nxb3, 31=cxb3, 32=d4,
   33=Ne5, 34=Bxd1, 35=Nxd7, 36=Nxd7, 37=Nxd1, 38=dxe3, 39=Rxe3,
   40=Rfe8. */
const CH1_GAME = [
  "e4", "c5", "Nf3", "g6", "Bc4", "Bg7", "d3", "Nc6", "Nc3", "Nf6",
  "Bd2", "O-O", "O-O", "e6", "Rb1", "d5", "exd5", "exd5", "Bb5", "Bg4",
  "Re1", "Nd4", "Ba4", "Rb8", "Bb3", "b5", "a3", "Qd7", "Be3", "Nxb3",
  "cxb3", "d4", "Ne5", "Bxd1", "Nxd7", "Nxd7", "Nxd1", "dxe3", "Rxe3", "Rfe8",
];

export const LESSONS = [
  {
    id: "hyper-accelerated-dragon",
    title: "Hyper-Accelerated Dragon",
    desc: "A Black repertoire against 1.e4 built around winning the fight for d5.",
    orientation: "black",
    cover: "/lesson-coach.webp",
    resources: [
      { label: "Lesson source: full analysis (chess.com)", url: "https://www.chess.com/analysis/collection/accelereated-dragon-opening-xqCV2qLz/3GSiyz3iAa/analysis" },
      { label: "Accelerated Dragon overview (Wikipedia)", url: "https://en.wikipedia.org/wiki/Sicilian_Defence,_Accelerated_Dragon_Variation" },
      { label: "Explore the position yourself (Lichess analysis)", url: "https://lichess.org/analysis/pgn/1.%20e4%20c5%202.%20Nf3%20g6" },
    ],
    /* Named repertoire lines for the Theory Trainer -- the trainer plays
       White's side of whichever lines still match the game so far, and
       flags the student when their Black move leaves all of them.
       Lines end where the coach's known theory ends; the engine takes
       over from there. */
    repertoire: [
      { name: "The main plan (…e6 & …d5)", line: CH1_GAME.slice(0, 27) },
      { name: "Bishop-trade plan (…d6 & …Bg4)", line: [...CH1_GAME.slice(0, 13), "d6", "Rb1", "Bg4", "h3", "Bxf3", "Qxf3", "Nd4"] },
      { name: "vs the space-grab 8.e5", line: [...CH1_GAME.slice(0, 14), "e5"] },
    ],
    chapters: [
      {
        number: 1,
        title: "Move Order & the Fight for d5",
        mainLine: CH1_GAME,
        beats: [
          {
            type: "playthrough",
            afterPly: 0,
            text: "First, watch the whole game — a 1700-rated White player develops all their pieces \"normally\" and still gets run over by move 20. Step through or hit play, then we'll break down why.",
          },
          {
            type: "narration",
            afterPly: 4,
            text: "This is the Accelerated Dragon: ...g6 immediately, skipping ...d6 entirely. The difference from the regular Dragon matters — the whole system is built around playing ...d5 in ONE move. In the regular Dragon (...d6 first), reaching d5 costs two tempi. Here it costs one, and that tempo is worth a lot.",
          },
          {
            type: "narration",
            afterPly: 8,
            text: "Count the pressure on d4: the c5-pawn, the Bg7, and now Nc6 — three attackers before White has finished developing. White would love to play d4, but it's simply not available. Notice White's moves all look reasonable individually; nothing ties them into a plan.",
          },
          {
            type: "think",
            afterPly: 13,
            prompt: "Both sides have castled, and Black's only undeveloped piece is the light-squared bishop. What's the plan? Try a move.",
            ideaMove: "e6",
            answer: "...e6! It looks quiet, but it's the point of the whole system: it prepares ...d5 in one push. White has no piece that can fight for d5, so the break can't be prevented. (The bishop develops naturally afterward — often to b7 or g4 depending on how White reacts.)",
          },
          {
            type: "branch",
            afterPly: 13,
            prompt: "There's more than one good plan here — let me show you two:",
            options: [
              {
                label: "Bishop-trade plan: …d6 and …Bg4",
                line: ["d6", "Rb1", "Bg4", "h3", "Bxf3", "Qxf3", "Nd4"],
                note: "Trading the light-squared bishop is usually a concession — but here it's a trick. After ...Bg4, h3 Bxf3 Qxf3, the d4 square has lost its last defender: ...Nd4 hits the queen with tempo and the knight is a monster. Black is very comfortable.",
              },
              {
                label: "My recommendation: …e6 then …d5",
                line: ["e6"],
                note: "Here's the simple idea I'd play: ...e6 prepares ...d5, and nothing White has can stop it. Control of the center first — then Black decides whether to attack on the queenside or kingside depending on what White does.",
              },
            ],
          },
          {
            type: "branch",
            afterPly: 14,
            prompt: "Before White's reply — a question I get all the time: can't White just grab space with e5 here?",
            options: [
              {
                label: "See 8.e5 on the board",
                line: ["e5"],
                note: "Don't fear this move — welcome it. The pawn on e5 chases your knight to a better future (it reroutes toward d5/c7 or g4), and the pawn itself becomes a long-term weakness that Black's pieces gang up on. You'll see this pattern across many Accelerated Dragon lines: White's \"space-gaining\" e5 usually just drops the pawn later.",
              },
            ],
          },
          {
            type: "narration",
            afterPly: 16,
            text: "White played the planless 8.Rb1, and there it is: ...d5, the thematic break, achieved in one move. This is the position the whole move order was engineered to reach. White's pieces are developed but pointing at nothing.",
          },
          {
            type: "narration",
            afterPly: 19,
            text: "After the exchange on d5, Black recaptured with the pawn — opening the c8-bishop's diagonal. Now White plays Bb5, offering to trade on c6. Let them! Yes, it doubles Black's pawns, but you get the bishop pair, and more importantly White just traded off their best attacking piece. White was supposed to be playing for a kingside attack; that idea leaves the board with the bishop.",
          },
          {
            type: "think",
            afterPly: 21,
            prompt: "White just played Re1. Black's knight on c6 has a dream square available. Find it.",
            ideaMove: "Nd4",
            answer: "...Nd4! The knight lands on the square this whole opening fights for. It attacks the b5-bishop, eyes f3 and c2, and can't easily be evicted — c3 is occupied by White's own knight. Watch how much work this knight does for the rest of the game.",
          },
          {
            type: "think",
            afterPly: 23,
            prompt: "The bishop ran to a4. How does Black keep harassing it? (Hint: think pawns, not pieces.)",
            ideaMove: "Rb8",
            answer: "...Rb8, preparing ...b5. And here's the trap being set: after ...b5, if the bishop drops back to b3, then ...c4! wins it — dxc4 bxc4 and the bishop has no squares. White's \"safe\" retreats are walking into a net.",
          },
          {
            type: "branch",
            afterPly: 28,
            prompt: "Quick honesty check: Black's last move (…Qd7) was slightly inaccurate. White actually had one good try here:",
            options: [
              {
                label: "White's best try: 15.Ne5",
                line: ["Ne5"],
                note: "15.Ne5! hits both the queen on d7 and the g4-bishop — this is why ...Qd7 wasn't the most precise (Black is still fine, but White gets activity). In the game, White missed it and played 15.Be3 instead... which loses on the spot. Let's see why.",
              },
            ],
          },
          {
            type: "puzzle",
            afterPly: 29,
            prompt: "White just played 15.Be3?? — pause here and find the win. Look for forcing moves and overloaded defenders. (Two Black moves to find.)",
            solution: ["Nxb3", "cxb3", "d4"],
            explanation: "Simple chess: trades first, then the fork. 15...Nxb3 16.cxb3 clears the d4 square — and now ...d4! hits the e3-bishop and c3-knight at once, while the g4-bishop still pins the f3-knight against the queen. Too many problems: whatever White tries, a piece falls.",
          },
          {
            type: "narration",
            afterPly: 40,
            text: "The cleanup, in case you're wondering how it resolves: 17.Ne5 tries to counterattack, but ...Bxd1 just takes the queen; after 18.Nxd7 Nxd7 19.Nxd1 dxe3 20.Rxe3 Rfe8, Black is up a clean piece with the better structure — against an opponent who never made an \"obvious\" mistake. That's the Accelerated Dragon promise: if White plays natural moves without a plan, the ...d5 break and the d4-knight do the rest. Next chapter: what happens when White DOES know the main lines.",
          },
        ],
      },
      { number: 2, title: "Main Line Classical Systems", comingSoon: true },
      { number: 3, title: "The Maroczy Bind — How to Fight It", comingSoon: true },
      { number: 4, title: "Tactics & Traps in the Dragon", comingSoon: true },
      { number: 5, title: "Model Game Breakdown", comingSoon: true },
    ],
  },
];
