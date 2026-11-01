/* Turns a position into what Maia3 reads, and its answer back into moves. The
   layout follows tokenize_board and get_all_possible_moves in the Maia3 source:
   the board is always seen from the mover's side, mirrored when Black is to
   move, and each move is a slot in a list of 4352. */
const PIECES = "PNBRQK";
const FILES = "abcdefgh";
const PROMOTIONS = "qrbn";
const SQUARE_MOVES = 64 * 64;

export const MOVE_SLOTS = SQUARE_MOVES + 8 * 8 * PROMOTIONS.length;
export const TOKEN_SIZE = 64 * 12;

const blackToMove = (fen) => fen.split(" ")[1] === "b";
const squareIndex = (name) => (name.charCodeAt(1) - 49) * 8 + (name.charCodeAt(0) - 97);
const mirrorSquare = (name) => name[0] + String(9 - Number(name[1]));

/** One row per square, a1 first, with a mark for the piece on it: six
 *  channels for the mover and six for the opponent. */
export function tokensFor(fen) {
  const tokens = new Float32Array(TOKEN_SIZE);
  const mirrored = blackToMove(fen);
  fen.split(" ")[0].split("/").forEach((row, r) => {
    const rank = 7 - r;
    let file = 0;
    for (const ch of row) {
      if (ch >= "1" && ch <= "8") { file += Number(ch); continue; }
      const isWhite = ch === ch.toUpperCase();
      const square = (mirrored ? 7 - rank : rank) * 8 + file;
      const mine = isWhite !== mirrored;
      tokens[square * 12 + PIECES.indexOf(ch.toUpperCase()) + (mine ? 0 : 6)] = 1;
      file++;
    }
  });
  return tokens;
}

/** Which of the 4352 slots a move in UCI form sits in. */
export function moveSlot(uci, fen) {
  const flip = blackToMove(fen);
  const from = flip ? mirrorSquare(uci.slice(0, 2)) : uci.slice(0, 2);
  const to = flip ? mirrorSquare(uci.slice(2, 4)) : uci.slice(2, 4);
  if (uci.length > 4) {
    return SQUARE_MOVES + FILES.indexOf(from[0]) * 32 + FILES.indexOf(to[0]) * 4 + PROMOTIONS.indexOf(uci[4]);
  }
  return squareIndex(from) * 64 + squareIndex(to);
}

/** Chance of each move out of `ucis`, given Maia's raw scores for all slots. */
export function moveChances(logits, ucis, fen) {
  const scores = ucis.map((uci) => logits[moveSlot(uci, fen)]);
  const top = Math.max(...scores);
  const weights = scores.map((s) => Math.exp(s - top));
  const total = weights.reduce((a, b) => a + b, 0);
  return Object.fromEntries(ucis.map((uci, i) => [uci, weights[i] / total]));
}
