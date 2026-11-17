import { useEffect, useRef, useState } from "react";
import { createEngine, mFrom, mTo, M120TO64, EMPTY } from "../engine/chessEngine";
import { useBestMove, scoreLabel } from "../utils/useBestMove";

/* Analyse the game: steps a finished Tactica game move by move on the 3D
   board. For every position a green arrow shows Stockfish's best move and,
   when the game went another way, a blue arrow shows the move that was
   played. Used after games against the bots, 1v1 games, and Play with
   yourself. It works on its own copy of the game; `onDone` is the moment
   for the mode to put its own pieces back. */
export const BEST_COLOR = "#3FE07A", PLAYED_COLOR = "#5AA8FF";
const sqOf = (sq120) => M120TO64[sq120];

export default function GameReview({ sceneRef, moves, ending = null, onDone }) {
  const engRef = useRef(null);
  if (!engRef.current) engRef.current = createEngine();
  const eng = engRef.current;
  const [idx, setIdx] = useState(moves.length);

  const goTo = (i) => {
    const n = Math.max(0, Math.min(moves.length, i));
    eng.reset();
    for (const san of moves.slice(0, n)) {
      const move = eng.legalMoves().find((m) => eng.sanOf(m) === san);
      if (move === undefined) break;
      eng.make(move);
    }
    const pieces = [];
    for (let sq = 0; sq < 64; sq++) {
      const p = eng.pieceAt(sq);
      if (p !== EMPTY) pieces.push({ sq, type: Math.abs(p), white: p > 0 });
    }
    const scene = sceneRef.current;
    scene?.setMarks({});
    scene?.setPieces(pieces);
    scene?.showBoard();
    setIdx(n);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { goTo(moves.length); }, []);

  const fen = eng.fen();
  const best = useBestMove(fen, true);
  const playedSan = moves[idx] ?? null;
  const played = playedSan ? eng.legalMoves().find((m) => eng.sanOf(m) === playedSan) : undefined;
  const differs = best && !best.none && playedSan && best.san !== playedSan;
  const hints = [];
  if (best && !best.none) hints.push({ from: sqOf(best.from), to: sqOf(best.to), color: BEST_COLOR });
  if (differs && played !== undefined) hints.push({ from: sqOf(mFrom(played)), to: sqOf(mTo(played)), color: PLAYED_COLOR });
  const hintKey = hints.map((h) => `${h.from}-${h.to}-${h.color}`).join(",");
  useEffect(() => {
    sceneRef.current?.setHints(hints);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hintKey]);
  /* No arrows left behind once the review closes. */
  useEffect(() => () => sceneRef.current?.setHints([]), [sceneRef]);

  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    const onKey = (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const step = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
      if (step) { e.preventDefault(); goTo(idx + step); }
      else if (e.key === "Escape") doneRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, moves]);

  const atEnd = idx >= moves.length;
  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-1 bg-gradient-to-b from-black/80 to-transparent p-3 pb-10">
        <div className="tc-label">Analysing the game</div>
        <div className="tc-display text-[15px]" aria-live="polite">
          {idx === 0 ? "The starting position" : `After ${Math.ceil(idx / 2)}${idx % 2 ? "." : "…"} ${moves[idx - 1]}`}
        </div>
        <div className="text-sm text-[var(--tc-cream-dim)]" aria-live="polite">
          {atEnd ? (ending ?? "The last move")
            : !best ? "Thinking…"
            : best.none ? ""
            : best.san === playedSan ? `${playedSan} was the best move · ${scoreLabel(best.score)}`
            : `Best: ${best.san} · ${scoreLabel(best.score)}`}
        </div>
        {!atEnd && differs && (
          <div className="flex gap-3 text-xs text-[var(--tc-cream-dim)]">
            <span><i className="mr-1 inline-block size-2.5 rounded-full align-middle" style={{ background: BEST_COLOR }} />Best move</span>
            <span><i className="mr-1 inline-block size-2.5 rounded-full align-middle" style={{ background: PLAYED_COLOR }} />Played: {playedSan}</span>
          </div>
        )}
      </div>
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 bg-gradient-to-t from-black/85 to-transparent px-3 pt-10 pb-[calc(0.9rem+env(safe-area-inset-bottom))]">
        <div className="flex w-full items-center justify-between gap-2">
          <button type="button" className="tc-round" onClick={() => goTo(0)} disabled={idx === 0} aria-label="To the start">«</button>
          <button type="button" className="tc-round" onClick={() => goTo(idx - 1)} disabled={idx === 0} aria-label="Previous move">‹</button>
          <span className="tc-display flex-1 text-center text-sm">{idx} / {moves.length}</span>
          <button type="button" className="tc-round" onClick={() => goTo(idx + 1)} disabled={atEnd} aria-label="Next move">›</button>
          <button type="button" className="tc-round" onClick={() => goTo(moves.length)} disabled={atEnd} aria-label="To the end">»</button>
        </div>
        <button type="button" className="tc-plank tc-center tc-small" style={{ width: 200 }} onClick={() => doneRef.current()}>Done</button>
      </div>
    </>
  );
}
