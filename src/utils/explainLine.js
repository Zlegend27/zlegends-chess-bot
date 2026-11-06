/* Turns an engine line into plain sentences a coach can say, one per move,
   plus a one-line verdict ("White wins a piece"). Everything is read off
   the board, so it can't describe a move that isn't there. */
import { createEngine, mFrom, mTo, mPromo, M120TO64 } from "../engine/chessEngine.js";

const NAMES = ["", "pawn", "knight", "bishop", "rook", "queen", "king"];
const VALUES = [0, 1, 3, 3, 5, 9, 0];
const sqName = (s120) => { const s = M120TO64[s120]; return "abcdefgh"[s % 8] + ((s >> 3) + 1); };
/** A move in the e2e4 form engines use. */
export const uciOf = (m) => sqName(mFrom(m)) + sqName(mTo(m)) + (["", "", "n", "b", "r", "q"][mPromo(m)] || "");

/** White's material minus Black's, in pawns. */
function materialBalance(eng) {
  let sum = 0;
  for (let i = 0; i < 64; i++) {
    const p = eng.pieceAt(i);
    sum += Math.sign(p) * VALUES[Math.abs(p)];
  }
  return sum;
}

/** "a pawn", "two pawns' worth", "a piece", "a rook", "a queen". */
export function materialText(pawns) {
  if (pawns === 1) return "a pawn";
  if (pawns === 3) return "a piece";
  if (pawns === 5) return "a rook";
  if (pawns === 9) return "a queen";
  return `${pawns} pawns' worth`;
}

/** One sentence for `move` in `eng`'s current position, before it's made. */
export function narrateMove(eng, move) {
  const side = eng.getSide() === 1 ? "White" : "Black";
  const san = eng.sanOf(move);
  const tail = san.endsWith("#") ? ", checkmate" : san.endsWith("+") ? ", check" : "";
  if (san.startsWith("O-O-O")) return `${side} castles queenside${tail}.`;
  if (san.startsWith("O-O")) return `${side} castles kingside${tail}.`;
  const from64 = M120TO64[mFrom(move)], to64 = M120TO64[mTo(move)];
  const piece = NAMES[Math.abs(eng.pieceAt(from64))];
  const target = eng.pieceAt(to64);
  const to = sqName(mTo(move));
  const promo = mPromo(move) ? ` and becomes a ${NAMES[mPromo(move)]}` : "";
  if (target !== 0) return `${side}'s ${piece} takes the ${NAMES[Math.abs(target)]} on ${to}${promo}${tail}.`;
  if (piece === "pawn" && san.includes("x")) return `${side}'s pawn takes en passant on ${to}${tail}.`;
  return `${side}'s ${piece} goes to ${to}${promo}${tail}.`;
}

/** Plays `ucis` from `fen`, narrating each move. Stops at the first move
 *  that isn't legal. Returns { steps: [{ san, text, from, to, fen }], verdict,
 *  delta } where each step's `fen` is the position after that move and
 *  `delta` is the material White gained over the line, in pawns. */
export function explainLine(fen, ucis, maxPlies = 6) {
  const eng = createEngine();
  eng.loadFen(fen);
  const before = materialBalance(eng);
  const steps = [];
  let mated = false;
  for (const uci of ucis.slice(0, maxPlies)) {
    const move = eng.legalMoves().find((m) => uciOf(m) === uci);
    if (move === undefined) break;
    const san = eng.sanOf(move);
    const text = narrateMove(eng, move);
    eng.make(move);
    steps.push({ san, text, from: mFrom(move), to: mTo(move), fen: eng.fen() });
    if (san.endsWith("#")) { mated = true; break; }
  }
  const delta = materialBalance(eng) - before;
  let verdict;
  if (mated) verdict = `${steps[steps.length - 1].text.startsWith("White") ? "White" : "Black"} delivers checkmate.`;
  else if (delta > 0) verdict = `White comes out ${materialText(delta)} ahead.`;
  else if (delta < 0) verdict = `Black comes out ${materialText(-delta)} ahead.`;
  else verdict = "Material stays level.";
  return { steps, verdict, delta };
}

/** Stockfish's score, from White's side in centipawns, as a sentence. */
export function evalText(cpWhite) {
  if (Math.abs(cpWhite) >= 90000) return `Stockfish sees a forced mate for ${cpWhite > 0 ? "White" : "Black"}.`;
  if (Math.abs(cpWhite) < 40) return "Stockfish calls it about equal.";
  return `Stockfish has ${cpWhite > 0 ? "White" : "Black"} better by ${(Math.abs(cpWhite) / 100).toFixed(1)}.`;
}

/** The line's material verdict plus Stockfish's view. When the two point
 *  different ways, as in a gambit, says so instead of contradicting itself. */
export function fullVerdict(line, cpWhite) {
  if (cpWhite == null || line.verdict.endsWith("checkmate.")) return line.verdict;
  const evalSide = Math.abs(cpWhite) < 40 ? 0 : Math.sign(cpWhite);
  const disagree = line.delta !== 0 && evalSide !== Math.sign(line.delta);
  return `${line.verdict} ${disagree ? "Still, " : ""}${evalText(cpWhite)}`;
}
