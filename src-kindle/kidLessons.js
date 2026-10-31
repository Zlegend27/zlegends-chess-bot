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
  {
    id: "special-moves",
    title: "Special Moves",
    subtitle: "Castling, en passant, and pawn promotion",
    teacher: "Owl",
    beats: [
      {
        type: "narration",
        demoMoves: [],
        text: "Welcome back! Today's lesson is 3 special moves that aren't like any other move in chess. You already met one -- castling -- let's go deeper, then meet two brand-new ones.",
      },
      {
        type: "narration",
        demoFen: "4k3/8/8/8/8/8/8/R3K3 w Q - 0 1",
        text: "Castling comes in two flavors: kingside (the short hop, O-O) and queenside (the long hop, O-O-O). Either way, the king and rook both move at once -- but only if neither has moved yet, and the squares between them are empty.",
      },
      {
        type: "think",
        demoFen: "4k3/8/8/8/8/8/8/R3K3 w Q - 0 1",
        prompt: "This king only has one rook available -- on the queenside. Castle that way!",
        acceptable: ["O-O-O"],
        hint: "The king hops TWO squares toward the rook on the a-file.",
        answer: "O-O-O! Same idea as kingside castling, just a longer hop -- the king ends up on c1, and the rook jumps to d1.",
      },
      {
        type: "narration",
        demoMoves: ["e4", "Nf6", "e5", "d5"],
        text: "New move #1: en passant (\"in passing\")! Black's pawn just jumped two squares to d5, landing right beside White's pawn on e5. Normally that's safe -- but not this time.",
      },
      {
        type: "think",
        demoMoves: ["e4", "Nf6", "e5", "d5"],
        prompt: "Capture that pawn en passant -- right now, or the chance is gone forever!",
        acceptable: ["exd6"],
        hint: "Your e5 pawn can capture d5's pawn as if it had only moved one square.",
        answer: "exd6! Because Black's pawn skipped past the square your pawn was watching, you get to capture it anyway -- but only on the very next move. Wait even one move too long and the chance disappears.",
      },
      {
        type: "quiz",
        demoMoves: ["e4", "Nf6", "e5", "d5", "exd6"],
        prompt: "Quick check: how long do you have to capture en passant?",
        options: [
          { label: "Only right away, the very next move", correct: true,
            note: "Exactly right! Blink and you miss it -- en passant only works the instant after the two-square pawn push." },
          { label: "Anytime later in the game", correct: false,
            note: "Nope -- if you don't grab it immediately, the chance is gone for good, even though the pawn is sitting right there." },
          { label: "Only if you're already in check", correct: false,
            note: "Being in check has nothing to do with it -- en passant is just about timing, not check." },
        ],
      },
      {
        type: "narration",
        demoFen: "6k1/4P3/8/8/8/8/6K1/8 w - - 0 1",
        text: "New move #2: pawn promotion! When a pawn survives the whole board and reaches the very last row, it transforms into ANY piece you want -- almost always a queen, since she's the strongest.",
      },
      {
        type: "think",
        demoFen: "6k1/4P3/8/8/8/8/6K1/8 w - - 0 1",
        prompt: "This pawn is one step from the last row. Push it and promote!",
        acceptable: ["e8=Q+"],
        hint: "Move the pawn forward one more square, all the way to the 8th row.",
        answer: "e8=Q! A brand new queen appears -- and this one even comes with check. Pawns really can become the most powerful piece on the board.",
      },
      {
        type: "narration",
        demoMoves: [],
        text: "3 special moves in the books: castling (king safety in one move), en passant (a pawn's one-time trick), and promotion (turning a lowly pawn into a queen). Keep an eye out for all three in your own games!",
      },
    ],
  },
  {
    id: "spot-the-trick",
    title: "Spot the Trick",
    subtitle: "Forks, pins, and skewers",
    teacher: "Owl",
    beats: [
      {
        type: "narration",
        demoMoves: [],
        text: "Some moves don't just develop a piece -- they set a trap! Today: 3 classic tricks that win material if your opponent isn't watching. First up: the fork.",
      },
      {
        type: "narration",
        demoFen: "r3k3/8/8/1N6/8/8/8/6K1 w - - 0 1",
        text: "A fork is one piece attacking TWO enemy targets at the same time -- they can't both escape! Knights are famous for this because they attack in such a weird pattern.",
      },
      {
        type: "think",
        demoFen: "r3k3/8/8/1N6/8/8/8/6K1 w - - 0 1",
        prompt: "Find the fork! One knight move attacks the king AND the rook at once.",
        acceptable: ["Nc7+"],
        hint: "Look for a knight jump that lands a check.",
        answer: "Nc7+! The knight checks the king on e8 AND attacks the rook on a8 in the very same move. Whatever Black does about the check, that rook is lost next.",
      },
      {
        type: "narration",
        demoFen: "4k3/8/2n5/1B6/8/8/8/6K1 w - - 0 1",
        text: "Trick #2: the pin. Black's knight on c6 looks safe, but it's actually stuck -- White's bishop is lined up straight through it to the king behind on e8.",
      },
      {
        type: "quiz",
        demoFen: "4k3/8/2n5/1B6/8/8/8/6K1 w - - 0 1",
        prompt: "Why can't that knight just move away?",
        options: [
          { label: "It's pinned -- moving it would expose the king to check", correct: true,
            note: "Exactly! A pinned piece is glued in place: moving it would be illegal (or just really dangerous) because the king behind it would be left in check." },
          { label: "It's simply out of legal moves", correct: false,
            note: "Not quite -- the knight has plenty of squares it COULD jump to. It's the pin that's holding it back, not a lack of options." },
          { label: "It's protecting a pawn", correct: false,
            note: "There's no pawn to protect here -- the bishop lined up on the king is the whole story." },
        ],
      },
      {
        type: "narration",
        demoFen: "4q3/8/8/4k3/8/2B5/8/4R2K b - - 0 1",
        text: "Trick #3: the skewer -- a pin's aggressive cousin. White's rook checks the king, which MUST move out of the way... and then the queen behind it is wide open to capture.",
      },
      {
        type: "quiz",
        demoFen: "4q3/8/8/4k3/8/2B5/8/4R2K b - - 0 1",
        prompt: "Black is in check. What's the best response?",
        options: [
          { label: "Move the king off the e-file", correct: true,
            note: "Right -- the king has to deal with check first. Sadly the queen behind it was the real target all along; that's the skewer." },
          { label: "Capture the rook: Qxe1", correct: false,
            note: "Watch out -- White's bishop on c3 is guarding e1! Bxe1 wins your queen for just a rook. A terrible trade." },
          { label: "Ignore it and develop another piece", correct: false,
            note: "You can't skip responding to check -- some legal move has to deal with it before anything else happens." },
        ],
      },
      {
        type: "narration",
        demoMoves: [],
        text: "Forks, pins, and skewers: three tricks where lining pieces up (or jumping to the right square) wins material for free. Start looking for them every single move!",
      },
    ],
  },
  {
    id: "checkmate-patterns",
    title: "Checkmate Patterns",
    subtitle: "Famous ways to finish the game",
    teacher: "Owl",
    beats: [
      {
        type: "narration",
        demoMoves: [],
        text: "You know what checkmate IS -- now let's learn to recognize a few famous checkmate SHAPES, so you can spot them (and set them up) instantly.",
      },
      {
        type: "narration",
        demoFen: "R5k1/5ppp/8/8/8/8/7K/8 b - - 0 1",
        text: "Pattern #1: the back-rank mate. Black's own pawns box the king in on the 8th row -- and White's rook controls the entire row. No escape, no blocking, checkmate.",
      },
      {
        type: "think",
        demoFen: "6k1/5ppp/8/8/8/8/7K/R7 w - - 0 1",
        prompt: "Same idea, your move this time. Find the checkmate in one!",
        acceptable: ["Ra8#"],
        hint: "Slide your rook all the way down the a-file, onto the back rank.",
        answer: "Ra8#! Those pawns that were supposed to protect the king turn into a wall with no way out. This is exactly why Golden Rule #3 (castle early, but don't forget to give your king some luft/breathing room later) matters.",
      },
      {
        type: "narration",
        demoFen: "k7/7R/8/3R4/8/8/8/6K1 w - - 0 1",
        text: "Pattern #2: the ladder mate. Two rooks (or a queen and rook) take turns -- one blocks off an entire row so the king can't escape, while the other marches down to deliver the final check.",
      },
      {
        type: "think",
        demoFen: "k7/7R/8/3R4/8/8/8/6K1 w - - 0 1",
        prompt: "Rh7 already seals off the 7th row. Bring the other rook down for checkmate!",
        acceptable: ["Rd8#"],
        hint: "Move the d5 rook all the way down to the 8th row.",
        answer: "Rd8#! The king can't step to the 7th row (Rh7 owns it) and can't hide anywhere on the 8th row either (Rd8 owns that now too). Ladder mate complete.",
      },
      {
        type: "narration",
        demoMoves: [],
        text: "Pattern #3: Scholar's Mate -- a 4-move trap that catches beginners constantly. It starts innocently: 1.e4 e5 2.Qh5 Nc6 3.Bc4, both aiming at f7.",
      },
      {
        type: "quiz",
        demoMoves: ["e4", "e5", "Qh5", "Nc6", "Bc4"],
        prompt: "White threatens Qxf7#! What should Black play to defend?",
        options: [
          { label: "g6 -- kick the queen and block the diagonal", correct: true, move: "g6",
            note: "Perfect -- this is the exact move we learned back in Golden Rule #4! It attacks the queen AND blocks her path to f7 at the same time." },
          { label: "Nf6?? -- develop a piece", correct: false,
            note: "This is the actual trap -- it looks natural, but it ignores the threat completely. Qxf7# follows immediately. Game over in 4 moves!" },
          { label: "Nd4 -- attack the bishop", correct: false,
            note: "Doesn't address the real problem -- White just plays Qxf7# anyway. Always deal with your opponent's biggest threat first." },
        ],
      },
      {
        type: "narration",
        demoMoves: [],
        text: "Back-rank mate, ladder mate, Scholar's Mate: three patterns worth memorizing, because they show up again and again -- both as traps to spring and traps to avoid.",
      },
    ],
  },
  {
    id: "endgame-basics",
    title: "Endgame Basics",
    subtitle: "Winning when there are just a few pieces left",
    teacher: "Owl",
    beats: [
      {
        type: "narration",
        demoMoves: [],
        text: "Last stop on the road: the endgame, when most of the pieces are traded off. Different rules apply here -- let's cover the 3 biggest ideas.",
      },
      {
        type: "narration",
        demoFen: "8/8/8/4k3/8/8/2K5/Q7 w - - 0 1",
        text: "Idea #1: finishing with king + queen vs. king. The technique is simple -- use your queen to push the enemy king toward the edge, then bring your own king up to help finish the job.",
      },
      {
        type: "think",
        demoFen: "8/8/8/4k3/8/8/2K5/Q7 w - - 0 1",
        prompt: "Push the enemy king toward the edge! Give a check with your queen.",
        acceptable: ["Qe1+"],
        hint: "Move your queen onto the same file as the enemy king.",
        answer: "Qe1+! The king has to step off the e-file, giving up ground. Keep repeating this idea -- push, push, push -- until the king is trapped on the edge for mate.",
      },
      {
        type: "narration",
        demoMoves: [],
        text: "Idea #2: the opposition. When the two kings face each other with exactly one empty square between them, the side who does NOT have to move holds a big advantage -- they force the other king to give ground.",
      },
      {
        type: "quiz",
        demoMoves: [],
        prompt: "White king on d4, Black king on d6, one empty square between them -- and it's White's move. Who has the opposition?",
        options: [
          { label: "Black -- because White is the one forced to move", correct: true,
            note: "Right! Having the opposition means making your OPPONENT move first. Since White has to move now, Black holds the opposition." },
          { label: "White, since White's king got there first", correct: false,
            note: "Getting there first doesn't matter -- opposition is all about whose turn it is when the kings face off." },
          { label: "Neither -- kings don't affect the position", correct: false,
            note: "Kings matter a lot in the endgame! Fighting for key squares with your king is often the whole game." },
        ],
      },
      {
        type: "narration",
        demoMoves: [],
        text: "Idea #3: pawn races. Sometimes the fastest path to victory is just running a pawn to the last row before the enemy king can possibly catch it. Count the squares each side needs!",
      },
      {
        type: "think",
        demoFen: "k7/8/8/4P3/8/8/8/6K1 w - - 0 1",
        prompt: "Your pawn is way ahead of the enemy king. Start the race -- push it!",
        acceptable: ["e6"],
        hint: "The black king on a8 is much too far away to catch this pawn in time.",
        answer: "e6! Three more pushes and this becomes a queen -- the black king can never arrive in time. When you're this far ahead in a pawn race, just run.",
      },
      {
        type: "narration",
        demoMoves: [],
        text: "That's the whole road: openings, special moves, tricks, checkmate patterns, and endgame basics. You've got real tools now -- go put them to work in a game!",
      },
    ],
  },

  /* ---- Opening repertoire chapters -------------------------------
     The five chapters above teach ideas that apply to any position.
     These two are different: they teach ONE named opening each, one as
     White and one as Black, so there's a plan to reach for on move 1
     instead of improvising every game.

     They're a deliberate pair rather than two unrelated openings. The
     Vienna is 1.e4 e5 2.Nc3, and the Black chapter answers 1.e4 with
     1...e5 -- so both live in the same pawn structure and every pattern
     learned on one side shows up on the other. (A Scandinavian or
     Caro-Kann would have meant learning two unrelated worlds, and the
     Scandinavian specifically contradicts "Opening Habits", which
     teaches not to bring the queen out early.)

     Every SAN line below is checked by scripts/verifyKidLessons.mjs --
     run it after any edit here. Opening lines are far easier to typo
     than concept lessons, and a wrong `acceptable` move is invisible
     until a kid is stuck on it. */
  {
    id: "vienna",
    title: "The Vienna",
    subtitle: "Your opening as White -- with a sneaky trap",
    teacher: "Owl",
    beats: [
      {
        type: "narration",
        demoMoves: [],
        text: "Time to pick your very own opening! When you're White, you get to decide how the whole game starts. I'm going to teach you mine: the Vienna. It's got a secret weapon.",
      },
      {
        type: "narration",
        demoMoves: ["e4", "e5"],
        text: "It starts the normal way -- you take the middle with e4, they copy you with e5. So far, so ordinary. Now comes the choice that makes it the Vienna.",
      },
      {
        type: "think",
        demoMoves: ["e4", "e5"],
        prompt: "Bring out a knight -- but NOT the one next to your king. Use the other one!",
        acceptable: ["Nc3"],
        hint: "It's the knight sitting on b1, over on the queen's side.",
        nudge: "The glowing piece is the one you want -- your spare knight on b1. Now: which square brings it out without getting in anybody's way?",
        nudgeArrow: "Follow the arrow -- b1 to c3. Play it and I'll show you why that knight and not the other one.",
        answer: "Nc3! That's the Vienna. Here's the secret: it guards your e4 pawn, AND it leaves your f-pawn free. The other knight would have stood right in the f-pawn's way -- and that pawn is about to do something exciting.",
      },
      {
        type: "narration",
        demoMoves: ["e4", "e5", "Nc3", "Nf6"],
        text: "Say they develop a knight to f6, attacking your e4 pawn. Most players would defend it quietly. You're not going to do that. You're going to attack.",
      },
      {
        type: "think",
        demoMoves: ["e4", "e5", "Nc3", "Nf6"],
        prompt: "Charge the free f-pawn two squares forward!",
        acceptable: ["f4"],
        hint: "Remember why we chose Nc3 -- the f-pawn has a clear road.",
        nudge: "The glowing pawn is the one -- the f-pawn we deliberately kept free. How far can it charge?",
        nudgeArrow: "Follow the arrow -- push it two squares to f4. This is the whole point of the Vienna!",
        answer: "f4! This is the Vienna Gambit. You're offering them a pawn to blow the centre wide open. Scary for them, fun for you.",
      },
      {
        type: "narration",
        demoMoves: ["e4", "e5", "Nc3", "Nf6", "f4", "exf4"],
        text: "If they grab it, don't panic -- that's exactly what you wanted. Their knight on f6 is now standing on a square you can attack, and you have a pawn ready to do it.",
      },
      {
        type: "think",
        demoMoves: ["e4", "e5", "Nc3", "Nf6", "f4", "exf4"],
        prompt: "Push your e-pawn forward and kick their knight!",
        acceptable: ["e5"],
        hint: "Which of your pawns can attack the knight sitting on f6?",
        nudge: "That's your e-pawn glowing. Push it forward at their knight -- how far does it need to go to attack f6?",
        nudgeArrow: "Follow the arrow -- e4 to e5. The knight on f6 won't have anywhere good to go.",
        answer: "e5! The knight has to run all the way home, and look at the middle of the board -- it's all yours. You gave up one pawn and got the whole centre.",
      },
      {
        type: "narration",
        demoMoves: ["e4", "e5", "Nc3", "Nf6", "f4", "Nxe4"],
        text: "Now my favourite part. Sometimes they get greedy and snatch your e4 pawn with the knight instead. That looks clever... but it's a mistake, and there's a punishment.",
      },
      {
        type: "think",
        demoMoves: ["e4", "e5", "Nc3", "Nf6", "f4", "Nxe4"],
        prompt: "Owl's Trap! Bring your queen out to the edge -- there's a square where she attacks two things at once.",
        acceptable: ["Qh5"],
        hint: "Follow the long diagonal from your queen towards their king -- which square causes the most trouble?",
        nudge: "It's your queen glowing. Slide her out along the diagonal -- which square lets her hit two things at once?",
        nudgeArrow: "Follow the arrow -- all the way out to h5. Watch what she's attacking the moment she lands.",
        answer: "Qh5! Yes -- normally I'd tell you off for an early queen move, but this one WORKS. She's hitting the pawn on e5 and staring at f7, their weakest square. They're in real trouble.",
      },
      {
        type: "narration",
        demoMoves: ["e4", "e5", "Nc3", "Nf6", "f4", "Nxe4", "Qh5", "g6"],
        text: "Usually they block with g6 to shoo your queen away. But now their king and that greedy knight are lined up... and your queen can take a pawn WITH CHECK.",
      },
      {
        type: "think",
        demoMoves: ["e4", "e5", "Nc3", "Nf6", "f4", "Nxe4", "Qh5", "g6"],
        prompt: "Snap up the e5 pawn with your queen -- it's check, and it's a fork!",
        acceptable: ["Qxe5+"],
        hint: "Your queen can capture a pawn and give check at the same time.",
        nudge: "Your queen's glowing again. There's a pawn she can grab that gives check at the same time -- can you spot it?",
        nudgeArrow: "Follow the arrow -- take the pawn on e5. It's check, and look what else she's attacking.",
        answer: "Qxe5+! It's check, so they MUST deal with their king -- and the moment they do, you take that greedy knight for free. That's a fork, and that's Owl's Trap. Remember it!",
      },
      {
        type: "quiz",
        demoMoves: ["e4", "e5", "Nc3", "Nc6"],
        prompt: "Last thing: what if they DON'T play Nf6, and go Nc6 instead?",
        options: [
          { label: "Bring the bishop to c4", correct: true, move: "Bc4",
            note: "Nice. Bc4 points straight at f7, you can still play f4 later, and you're following all the golden rules. The Vienna is flexible -- Nc3 first always works." },
          { label: "Give up and start a different opening", correct: false,
            note: "Never! The Vienna's first move is always Nc3. Whatever they do, you just keep developing -- bishop out, castle, and push f4 when it's ready." },
          { label: "Rush Qh5 again", correct: false,
            note: "Careful -- Qh5 only worked because they'd blundered. Without that mistake your queen just gets chased around, exactly like Opening Habits warned." },
        ],
      },
      {
        type: "narration",
        demoMoves: ["e4", "e5", "Nc3"],
        text: "That's the Vienna! Two moves to remember -- e4, then Nc3 -- then f4 when the moment comes, and Owl's Trap if they get greedy. Go play it in a real game!",
      },
    ],
  },

  {
    id: "two-knights",
    title: "Two Knights",
    subtitle: "Your opening as Black -- and the trap you MUST know",
    teacher: "Owl",
    beats: [
      {
        type: "narration",
        demoMoves: [],
        text: "Now the other half. When you're Black you don't get to pick first -- you have to answer. Let's give you a plan for the most common opening move in chess.",
      },
      {
        type: "think",
        demoMoves: ["e4"],
        prompt: "They played e4 and grabbed the middle. Take your fair share -- copy them!",
        acceptable: ["e5"],
        hint: "Which of your pawns can march two squares and stand right opposite theirs?",
        nudge: "The glowing pawn is the one to move. How far can a pawn travel on its very first move?",
        nudgeArrow: "Follow the arrow -- two squares, e7 to e5, right opposite theirs.",
        answer: "e5! You've stopped them owning the middle by themselves. And here's a bonus: this is the same structure as the Vienna you just learned -- you already know these positions from the other side.",
      },
      {
        type: "narration",
        demoMoves: ["e4", "e5", "Nf3"],
        text: "They bring a knight out and attack your e5 pawn. You need to defend it -- but lazily defending isn't enough. Defend AND develop with the same move.",
      },
      {
        type: "think",
        demoMoves: ["e4", "e5", "Nf3"],
        prompt: "Develop a knight so it guards your e5 pawn.",
        acceptable: ["Nc6"],
        hint: "One of your knights can jump out and cover e5 at the same time.",
        nudge: "The glowing knight is the one. Which square brings it out AND guards your e5 pawn at the same time?",
        nudgeArrow: "Follow the arrow -- b8 to c6. Defends the pawn and develops, all in one move.",
        answer: "Nc6! Perfect -- pawn defended, piece developed, one move. That's the golden rule working for you.",
      },
      {
        type: "narration",
        demoMoves: ["e4", "e5", "Nf3", "Nc6", "Bc4"],
        text: "Watch out -- their bishop just swung to c4, aiming straight at f7. That's the square only your king defends. Don't panic, but do pay attention.",
      },
      {
        type: "think",
        demoMoves: ["e4", "e5", "Nf3", "Nc6", "Bc4"],
        prompt: "Develop your other knight and counter-attack their e4 pawn!",
        acceptable: ["Nf6"],
        hint: "Your knight on g8 can jump out and hit their centre pawn.",
        nudge: "Your other knight is glowing. Where can it jump so it attacks their e4 pawn right back?",
        nudgeArrow: "Follow the arrow -- g8 to f6. Now you're the one doing the attacking.",
        answer: "Nf6! Now you've got both knights out and you're attacking THEM. This opening has a name: the Two Knights. It's yours now.",
      },
      {
        type: "narration",
        demoMoves: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Nf6", "Ng5"],
        text: "Now the important bit. Some players jump Ng5 here, piling onto f7. This is the single most common trap you'll ever face as Black -- so let's make sure it never gets you.",
      },
      {
        type: "think",
        demoMoves: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Nf6", "Ng5"],
        prompt: "Fight back in the centre -- push your d-pawn two squares!",
        acceptable: ["d5"],
        hint: "A pawn push that blocks the bishop's diagonal AND hits their e4 pawn.",
        nudge: "The glowing pawn is your d-pawn. Push it far enough to get in that bishop's way.",
        nudgeArrow: "Follow the arrow -- two squares to d5. It blocks the bishop and hits the centre at once.",
        answer: "d5! Good -- you've blocked the bishop that was aiming at f7 and attacked in the middle. They'll capture with exd5. And THEN comes the moment that decides the game.",
      },
      {
        type: "narration",
        demoMoves: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Nf6", "Ng5", "d5", "exd5", "Nxd5", "Nxf7"],
        text: "DANGER! This is what happens if you take back with the knight. Their knight crashes into f7 and forks your queen and your rook at once. This is the Fried Liver -- and it has eaten a LOT of kids. Never take with that knight.",
      },
      {
        type: "think",
        demoMoves: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Nf6", "Ng5", "d5", "exd5"],
        prompt: "So DON'T recapture. Attack their bishop with your knight instead!",
        acceptable: ["Na5"],
        hint: "Your knight on c6 can jump sideways and attack the bishop on c4.",
        nudge: "It's your knight on c6 that's glowing. Don't recapture -- send it after that dangerous bishop instead.",
        nudgeArrow: "Follow the arrow -- c6 out to a5. It looks odd, but it chases off the bishop aiming at f7.",
        answer: "Na5! This is the move that saves you. You chase away the dangerous bishop and the whole Fried Liver attack falls apart. Odd-looking, completely correct -- remember this one above everything else.",
      },
      {
        type: "narration",
        demoMoves: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Nf6", "Ng5", "d5", "exd5", "Na5", "Bb5+", "c6", "dxc6", "bxc6"],
        text: "A few moves later you've got your pawn back, two bishops, and a strong centre. You went from 'about to be forked' to completely fine -- just by knowing one move.",
      },
      {
        type: "narration",
        demoMoves: [],
        text: "So: e5, Nc6, Nf6 -- and if the knight jumps to g5, play d5 and then Na5. That's your Black opening sorted. Now you've got a plan with both colours!",
      },
    ],
  },
];
