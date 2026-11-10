/* Owl's Replay: two moments from a finished game, sized for a child.
   - Best move: the checkmate if she gave one; otherwise the capture of
     hers that won the most once they had answered (so a piece taken back
     doesn't count).
   - Oops: the move of hers after which they captured and she was the most
     material down once she had answered (so a fair trade doesn't count).
   Counted with the piece values she learns (pawn 1 .. queen 9), from the
   game itself rather than an engine, so it shows what actually happened. */
import { createEngine, M120TO64, mFrom, mTo } from "../src/engine/chessEngine.js";
import { VALUE } from "./kidRules.js";

const NAMES = ["", "pawn", "knight", "bishop", "rook", "queen", "king"];
/* A swing smaller than this (in pawns) isn't worth showing. */
const MIN_SWING = 2;

/** Material from `colour`'s side: + is ahead. */
function balance(eng, colour) {
  let s = 0;
  for (let i = 0; i < 64; i++) {
    const p = eng.pieceAt(i);
    if (p && Math.abs(p) !== 6) s += Math.sign(p) * colour * VALUE[Math.abs(p)];
  }
  return s;
}

/** Each position of the game, with what happened on each move. */
function replay(moves) {
  const eng = createEngine();
  const steps = [];
  for (const san of moves) {
    const m = eng.legalMoves().find((x) => eng.sanOf(x) === san);
    if (m === undefined) break;
    const from = M120TO64[mFrom(m)], to = M120TO64[mTo(m)];
    const captured = Math.abs(eng.pieceAt(to));
    const mover = Math.abs(eng.pieceAt(from));
    const fen = eng.fen();
    eng.make(m);
    const mate = eng.inCheckNow() && eng.legalMoves().length === 0;
    steps.push({ san, from, to, captured, mover, fenBefore: fen, mate, balanceWhite: balance(eng, 1) });
  }
  return steps;
}

/** { best, oops } for the player of `colour` (1 White, -1 Black); each is
 *  { ply, san, text, fenBefore, from, to, reply? } or null. */
export function replayMoments(moves, colour) {
  const steps = replay(moves);
  /* Material after ply i (from her side); before the first move it's even. */
  const bal = (i) => (i < 0 ? 0 : steps[Math.min(i, steps.length - 1)].balanceWhite * colour);
  let best = null, oops = null;
  for (let i = 0; i < steps.length; i++) {
    const mine = (i % 2 === 0) === (colour === 1);
    if (!mine) continue;
    const s = steps[i];
    const moveNo = Math.floor(i / 2) + 1;
    if (s.mate) {
      best = { ply: i, san: s.san, from: s.from, to: s.to, fenBefore: s.fenBefore, swing: 100,
        text: `Checkmate with your ${NAMES[s.mover]}! Move ${moveNo}: ${s.san}. That's how you finish a game.` };
      continue;
    }
    const gain = bal(i + 1) - bal(i - 1);
    if (s.captured && gain >= MIN_SWING && (!best || gain > best.swing)) {
      best = { ply: i, san: s.san, from: s.from, to: s.to, fenBefore: s.fenBefore, swing: gain,
        text: `Move ${moveNo}: ${s.san}! You won their ${NAMES[s.captured]}, and they couldn't win it back. Great eyes!` };
    }
    const swing = bal(i + 2) - bal(i - 1);
    const reply = steps[i + 1];
    if (reply && reply.captured && swing <= -MIN_SWING && (!oops || swing < oops.swing)) {
      oops = { ply: i, san: s.san, from: s.from, to: s.to, fenBefore: s.fenBefore, swing,
        reply: { san: reply.san, from: reply.from, to: reply.to },
        text: `Move ${moveNo}: after ${s.san}, they played ${reply.san} and took your ${NAMES[reply.captured]}. Before every move, ask: is anything of mine left unguarded?` };
    }
  }
  return { best, oops };
}
