/* What Zlegend27 says about the key moves of the Vienna Gambit repertoire.
   Keyed by the moves before White's decision; `move` is the repertoire
   move the note explains. viennaTrainer.test.js checks every note against
   the book, so a rebuilt book that picks a different move fails the tests
   instead of leaving the coach explaining a move the trainer won't ask for. */
export const VIENNA_NOTES = {
  "": {
    move: "e4",
    idea: "Every Vienna starts with 1.e4. Grab the centre.",
  },
  "e4 e5": {
    move: "Nc3",
    idea: "2.Nc3 is the Vienna. The knight guards e4, so next move you can push f4 and attack Black's centre.",
  },
  "e4 e5 Nc3 Nf6": {
    move: "f4",
    idea: "3.f4 is the gambit. You hit e5 and offer a pawn to rip open the f-file for your rook.",
  },
  "e4 e5 Nc3 Nf6 f4 d5": {
    move: "fxe5",
    idea: "Take with 4.fxe5. You gain space, and that pawn on e5 will keep chasing Black's knight.",
  },
  "e4 e5 Nc3 Nf6 f4 d5 fxe5 Nxe4": {
    move: "Qf3",
    idea: "5.Qf3 hits the knight on e4 and eyes f7. If it trades on c3, take back with the b-pawn to back up d4.",
  },
  "e4 e5 Nc3 Nf6 f4 exf4": {
    move: "e5",
    idea: "Don't win the pawn back yet. 4.e5 kicks the knight first, and it has no good square: g8 undevelops it, h5 puts it on the rim.",
  },
  "e4 e5 Nc3 Nf6 f4 exf4 e5 Ng8": {
    move: "Nf3",
    idea: "5.Nf3 develops and stops ...Qh4+. Later d4 and Bxf4 win the pawn back with a big centre.",
  },
  "e4 e5 Nc3 Nf6 f4 exf4 e5 Qe7": {
    move: "Qe2",
    idea: "Black's queen pins your e5 pawn to your king, so it can't take on f6. 5.Qe2 blocks the file and the threat is back on.",
  },
  "e4 e5 Nc3 Nf6 f4 exf4 e5 Ng4": {
    move: "Qxg4",
    idea: "4...Ng4 is a blunder. The road from d1 to g4 is open, so your queen just takes the knight.",
  },
  "e4 e5 Nc3 Nf6 f4 d6": {
    move: "Nf3",
    idea: "4.Nf3 develops and adds a second attacker on e5. Make Black decide what to do about the pressure.",
  },
  "e4 e5 Nc3 Nf6 f4 Nc6": {
    move: "fxe5",
    idea: "4.fxe5 trades on e5. When the knight takes back, d4 kicks it away and the centre is yours.",
  },
  "e4 e5 Nc3 Nc6": {
    move: "f4",
    idea: "3.f4 works against ...Nc6 too. Hit e5 and aim to open the f-file.",
  },
  "e4 e5 Nc3 Nc6 f4 exf4": {
    move: "Nf3",
    idea: "4.Nf3 stops ...Qh4+ and gets d4 ready. You'll win the f4 pawn back with a strong centre.",
  },
  "e4 e5 Nc3 Bc5": {
    move: "Nf3",
    idea: "Against 2...Bc5, f4 is less good: the bishop aims at g1 and your king gets drafty. 3.Nf3 develops and attacks e5 instead.",
  },
  "e4 e5 Nc3 Bb4": {
    move: "Nf3",
    idea: "3.Nf3 develops and attacks e5. The pin on your knight isn't dangerous yet: castle first and it loses its bite.",
  },
  "e4 e5 Nc3 d6": {
    move: "Bc4",
    idea: "Against the quiet 2...d6, 3.Bc4 aims straight at f7, the weakest square around Black's king.",
  },
};
