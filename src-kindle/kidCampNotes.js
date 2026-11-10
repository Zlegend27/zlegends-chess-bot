/* What Owl says in the Opening Camp, in a 9-year-old's words. Checked
   against the real move trees by kidCamp.test.js: story steps must be legal
   and every note must sit on a position the course reaches.

   For each course:
   - story: Owl's Story, the idea in a few pictures: { moves (SAN after the
     course's root), arrows [[from, to, colour?]], text }
   - plan: what to do once the opening is over
   - notes: keyed by all the moves that reach a position; a note talks
     about the last move played. A note on the opponent's move is shown
     before she answers, so it never names her answer. */

const GOOD = "#4F9E6E", BAD = "#E0507F";

const under = (root, notes) => Object.fromEntries(Object.entries(notes).map(([k, v]) => [`${root} ${k}`, v]));

export const CAMP_NOTES = {
  "kid-vienna": {
    story: [
      { moves: "", arrows: [["f2", "f4", GOOD]], text: "Your knight jumps to c3 and guards your e4 pawn. And look: the pawn on f2 is still free to march!" },
      { moves: "Nf6 f4", arrows: [["f4", "e5", BAD]], text: "Then the f-pawn charges: f4! It attacks e5 and opens a road for your rook." },
      { moves: "Nf6 f4 exf4 e5", arrows: [["e5", "f6", BAD]], text: "If they take, push to e5 and chase their knight away. Your pawns own the middle!" },
      { moves: "Nc6 f4 exf4 Nf3 d6 d4", arrows: [["c1", "f4", GOOD]], text: "Knight out, pawn to d4, and your bishop wins the f4 pawn back. That's the Vienna!" },
    ],
    plan: "Castle your king, put a rook on the open f-file, and attack their king's side!",
    notes: under("e4 e5 Nc3", {
      "Nc6": "They copy you and bring out a knight.",
      "Nc6 f4": "f4! Hit their e5 pawn.",
      "Nc6 f4 exf4": "They took your pawn. Don't worry, you'll win it back.",
      "Nc6 f4 exf4 Nf3": "Knight out! It also stops their queen from jumping to h4 with check.",
      "Nc6 f4 exf4 Nf3 d6 d4": "d4: two big pawns in the middle!",
      "Nc6 f4 exf4 Nf3 d6 d4 Bg4 Bxf4": "Pawn won back, and your pieces are all coming out. Great!",
      "Nc6 f4 exf4 Nf3 Nf6": "Their knight attacks your e4 pawn.",
      "Nc6 f4 exf4 Nf3 Nf6 d4": "Your knight on c3 already guards e4, so grab the middle with d4.",
      "Nf6": "Their knight attacks your e4 pawn.",
      "Nf6 f4": "f4! The Vienna Gambit. Attack their e5 pawn right back.",
      "Nc6 f4 d6": "They guard e5 with a pawn.",
      "Nc6 f4 d6 Nf3": "Bring out a knight and get ready to castle.",
      "Nc6 f4 exf4 Nf3 Bb4": "Their bishop pins your knight to your king.",
      "Nc6 f4 exf4 Nf3 Bb4 d4": "d4! Take the middle. The pin can't stop you.",
      "Nc6 f4 exf4 Nf3 Bc5": "Their bishop aims at your king.",
      "Nc6 f4 exf4 Nf3 Bc5 d4": "d4 kicks the bishop away!",
      "Nc6 f4 Nf6": "Oops! They forgot about their e5 pawn.",
      "Nc6 f4 Nf6 fxe5": "Take it! Then your pawns can chase their knights around.",
      "Nc6 f4 exf4 Nf3 Bd6": "Their bishop blocks their own d-pawn.",
      "Nc6 f4 exf4 Nf3 Bd6 d4": "d4! Soon e5 will chase that bishop.",
      "d6": "A shy little pawn move.",
      "d6 Bc4": "Bishop out, aiming at f7, the weak spot next to their king!",
      "Nc6 f4 f6": "f6 is a weak move: it opens up their king.",
      "Nc6 f4 f6 Bc4": "Bishop out, aiming right at their king's open door!",
      "Bc5": "Their bishop aims at your f2 square.",
      "Bc5 Bc4": "Copy them! Your bishop aims at f7.",
      "Nc6 f4 exf4 Nf3 g5": "They try to hold on to the pawn with g5.",
      "Nc6 f4 exf4 Nf3 g5 g3": "g3! Attack their pawns and break them open.",
      "Nc6 f4 Bc5": "Their bishop looks at your king.",
      "Nc6 f4 Bc5 Nf3": "Knight out first, and keep an eye on that bishop.",
      "Nc6 f4 exf4 Nf3 Be7": "Their bishop hides on e7.",
      "Nc6 f4 exf4 Nf3 Be7 Bc4": "Bishop out, aiming at f7!",
    }),
  },
  "kid-e5": {
    story: [
      { moves: "", arrows: [["e5", "d4", GOOD], ["e5", "f4", GOOD]], text: "You answer e4 with e5! Now you have a pawn in the middle too." },
      { moves: "Nf3 Nc6", arrows: [["c6", "e5", GOOD]], text: "Their knight attacks e5, so your knight guards it. Easy!" },
      { moves: "Nf3 Nc6 Bc4 Nf6", arrows: [["f6", "e4", BAD]], text: "The Two Knights! Your other knight jumps out and attacks their e4 pawn." },
      { moves: "Nf3 Nc6 Bc4 Nf6 Ng5 d5", arrows: [["d5", "c4", GOOD]], text: "If their knight jumps at f7, put a pawn on d5 to block the bishop's road. Then you're safe." },
    ],
    plan: "Castle your king, bring out your other bishop, and keep your e5 pawn strong.",
    notes: under("e4 e5", {
      "Nf3": "Their knight attacks your e5 pawn!",
      "Nf3 Nc6": "Guard it with a knight!",
      "Nf3 Nc6 Bc4": "Their bishop looks at f7, the weakest spot next to your king.",
      "Nf3 Nc6 Bc4 Nf6": "The Two Knights! Attack their e4 pawn.",
      "Nf3 Nc6 Bc4 Nf6 d3": "They guard e4 calmly.",
      "Nf3 Nc6 Bc4 Nf6 d3 Bc5": "Your bishop comes out and looks at their f2 square.",
      "Nf3 Nc6 Bc4 Nf6 Ng5": "Watch out! Their knight wants to jump on f7 and attack your queen and rook together.",
      "Nf3 Nc6 Bc4 Nf6 Ng5 d5": "d5! Block the bishop's road to f7.",
      "Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5": "They took. Don't take back with your knight: that's the trap!",
      "Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Na5": "Na5 chases their bishop away, and your knight is safe.",
      "Nf3 Nc6 Bc4 Nf6 d3 Bc5 c3": "They're getting ready to push d4.",
      "Nf3 Nc6 Bc4 Nf6 d3 Bc5 c3 d6": "d6 makes your e5 pawn extra strong.",
      "Nf3 Nc6 Bc4 Nf6 Nc3": "They guard e4 with a knight.",
      "Nf3 Nc6 Bc4 Nf6 Nc3 Nxe4": "The fork trick! If their knight takes back, d5 attacks two pieces at once.",
      "Nf3 Nc6 d4": "They push into the middle.",
      "Nf3 Nc6 d4 exd4": "Take it!",
      "Nf3 Nc6 Bb5": "Their bishop attacks the knight that guards e5.",
      "Nf3 Nc6 Bb5 a6": "a6 asks the bishop: go away, or trade?",
      "Nf3 Nc6 Nc3": "Another knight comes out.",
      "Nf3 Nc6 Nc3 Nf6": "Your knight comes out too. Four knights on the board!",
      "Bc4": "Their bishop already looks at f7.",
      "Bc4 Nc6": "Bring a knight out.",
      "Nf3 Nc6 Bc4 Nf6 d3 Bc5 O-O": "They castled.",
      "Nf3 Nc6 Bc4 Nf6 d3 Bc5 O-O d6": "d6 keeps e5 strong and opens a road for your other bishop.",
      "Nf3 Nc6 Bc4 Nf6 O-O": "They castled and left e4 alone.",
      "Nf3 Nc6 Bc4 Nf6 O-O Nxe4": "Free pawn! Take it.",
      "f4": "They offer you a pawn: the King's Gambit!",
      "f4 exf4": "Take it! A free pawn.",
    }),
  },
};
