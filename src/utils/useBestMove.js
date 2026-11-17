import { useEffect, useState } from "react";
import { createEngine, mFrom, mTo, MATE } from "../engine/chessEngine";
import { stockfishAnalyze } from "../engine/stockfishEngine";

/* Stockfish's best move for a position, for the analysis arrows on the
   practice boards and the Tactica game review. Answers are kept per
   position, so stepping back and forth through a game doesn't search the
   same position twice, and an answer that lands after the board has moved
   on is never shown on the wrong position. */
const known = new Map();
const MOVE_TIME_MS = 600;
/* Stepping quickly through a game only searches where you stop. */
const SETTLE_MS = 150;

/** { from, to, san, score } for `fen` while `on` (squares 120-based, score
 *  in centipawns for White), or null while it thinks or when off. */
export function useBestMove(fen, on) {
  const [best, setBest] = useState(null);
  useEffect(() => {
    if (!on || !fen) { setBest(null); return undefined; }
    if (known.has(fen)) { setBest(known.get(fen)); return undefined; }
    setBest(null);
    let gone = false;
    const t = setTimeout(() => {
      stockfishAnalyze(fen, { moveTimeMs: MOVE_TIME_MS }).then(({ uci, lines }) => {
        const answer = readAnswer(fen, uci, lines?.[0]?.score ?? 0);
        known.set(fen, answer);
        if (known.size > 400) known.delete(known.keys().next().value);
        if (!gone) setBest(answer);
      }).catch(() => { if (!gone) setBest({ none: true }); });
    }, SETTLE_MS);
    return () => { gone = true; clearTimeout(t); };
  }, [fen, on]);
  return best;
}

function readAnswer(fen, uci, score) {
  const probe = createEngine();
  probe.loadFen(fen);
  const white = probe.getSide() === 1;
  const forWhite = white ? score : -score;
  const move = uci ? probe.moveFromUci(uci) : null;
  if (!move) return { none: true, score: forWhite };
  return { from: mFrom(move), to: mTo(move), san: probe.sanOf(move), score: forWhite };
}

/** "+1.4", "−0.3", "Mate in 3" from White's side, for under the board. */
export function scoreLabel(score) {
  if (score == null) return "";
  if (Math.abs(score) > MATE - 200) {
    const plies = MATE - Math.abs(score);
    const moves = Math.max(1, Math.ceil(plies / 2));
    return `${score > 0 ? "White" : "Black"} mates in ${moves}`;
  }
  const pawns = score / 100;
  return `${pawns > 0 ? "+" : pawns < 0 ? "−" : ""}${Math.abs(pawns).toFixed(1)}`;
}
