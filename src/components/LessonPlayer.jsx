/* ================================================================
   Interactive lesson player -- steps through a chapter's beats
   (narration/think/branch/puzzle, see src/data/lessons.js), replaying
   its own SAN move list into its own engine instance so it can't
   disturb the main Play board/modes, same isolation convention
   BlindMode.jsx already uses.
   ================================================================ */

import { useEffect, useMemo, useRef, useState } from "react";
import { createEngine, M64TO120, M120TO64, mFrom, mTo } from "../engine/chessEngine";
import { replayIntoEngine } from "../utils/share";
import { getPieceSet } from "../utils/pieceSets";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

function Board({ eng, orientation, selected, targets, lastMove, onSquare, pieceSetId }) {
  const flipped = orientation === "black";
  const pieceImgSrc = (type, isWhite) => getPieceSet(pieceSetId).svgUrl(type, isWhite);
  const rows = [];
  for (let vr = 0; vr < 8; vr++) {
    const r = flipped ? vr : 7 - vr;
    const cells = [];
    for (let vf = 0; vf < 8; vf++) {
      const f = flipped ? 7 - vf : vf;
      const i64 = r * 8 + f;
      const sq120 = M64TO120[i64];
      const p = eng.pieceAt(i64);
      const light = (r + f) % 2 === 1;
      const isSel = selected === i64;
      const isTarget = targets.includes(i64);
      const isLast = lastMove && (lastMove.from === sq120 || lastMove.to === sq120);
      const squareName = FILES[f] + (r + 1);
      cells.push(
        <div key={i64} role="gridcell" tabIndex={0} aria-label={squareName}
          onClick={() => onSquare(i64)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSquare(i64); } }}
          className={"sq " + (light ? "light" : "dark") + (isSel ? " sel" : "") + (isLast ? " last" : "")}>
          {p !== 0 && <img className={"pc " + (p > 0 ? "w" : "b")} src={pieceImgSrc(Math.abs(p), p > 0)} alt="" draggable="false" />}
          {isTarget && <span className={"dot" + (p !== 0 ? " ring" : "")} />}
          {vf === 0 && <span className="coord rk">{r + 1}</span>}
          {vr === 7 && <span className="coord fl">{FILES[f]}</span>}
        </div>
      );
    }
    rows.push(<div key={vr} role="row" className="brow">{cells}</div>);
  }
  return <div className="board" role="grid" aria-label="Lesson board">{rows}</div>;
}

/** One chapter, played beat by beat. `onExit` returns to the chapter
 *  picker; `pieceSetId` is passed down from the parent so the lesson
 *  board matches whatever piece design the player already has set. */
export default function LessonPlayer({ chapter, orientation = "white", pieceSetId, onExit }) {
  const engRef = useRef(null);
  if (!engRef.current) engRef.current = createEngine();
  const eng = engRef.current;

  const [beatIdx, setBeatIdx] = useState(0);
  const [, setTick] = useState(0);
  const rerender = () => setTick(t => t + 1);

  const [selected, setSelected] = useState(-1);
  const [targets, setTargets] = useState([]);
  const [lastMove, setLastMove] = useState(null);

  // think-beat state
  const [thinkTried, setThinkTried] = useState(null); // { san, matched } | null
  // branch-beat state
  const [branchShown, setBranchShown] = useState(new Set()); // option indices already played
  const [branchViewing, setBranchViewing] = useState(null); // option index currently on the board, or null = at the branch point
  // puzzle-beat state
  const [puzzleProgress, setPuzzleProgress] = useState(0); // how many of solution[] applied
  const [puzzleFeedback, setPuzzleFeedback] = useState(null);
  const [puzzleSolved, setPuzzleSolved] = useState(false);

  const beat = chapter.beats[beatIdx];

  /* Replays the main line up to a given ply and repaints the board --
     the single source of truth every beat transition and branch
     return goes through, so the board can never drift from what the
     current beat thinks the position is. */
  const gotoPly = (ply, extraMoves = []) => {
    eng.reset();
    replayIntoEngine(eng, chapter.mainLine.slice(0, ply).concat(extraMoves));
    const applied = ply + extraMoves.length;
    const allMoves = chapter.mainLine.slice(0, ply).concat(extraMoves);
    setLastMove(applied > 0 ? lastMoveFromSan(eng, allMoves) : null);
    setSelected(-1); setTargets([]);
    rerender();
  };

  /* lastMove needs the from/to squares, but replayIntoEngine only
     returns the applied move objects transiently -- easiest to just
     redo the final ply's move lookup against the position one ply
     back rather than plumb it through replayIntoEngine's return. */
  function lastMoveFromSan(finalEng, moveList) {
    if (!moveList.length) return null;
    const probe = createEngine();
    replayIntoEngine(probe, moveList.slice(0, -1));
    const legal = probe.legalMoves();
    const mv = legal.find(m => probe.sanOf(m) === moveList[moveList.length - 1]);
    return mv ? { from: mFrom(mv), to: mTo(mv) } : null;
  }

  useEffect(() => {
    setThinkTried(null);
    setBranchShown(new Set());
    setBranchViewing(null);
    setPuzzleProgress(0);
    setPuzzleFeedback(null);
    setPuzzleSolved(false);
    if (beat) gotoPly(beat.afterPly);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beatIdx]);

  const atLastBeat = beatIdx >= chapter.beats.length - 1;
  const next = () => setBeatIdx(i => Math.min(chapter.beats.length - 1, i + 1));
  const prev = () => setBeatIdx(i => Math.max(0, i - 1));

  const onSquare = (i64) => {
    if (!beat || (beat.type !== "think" && beat.type !== "puzzle")) return;
    if (beat.type === "puzzle" && puzzleSolved) return;
    const legal = eng.legalMoves();
    const sq120 = M64TO120[i64];
    if (selected >= 0) {
      const from120 = M64TO120[selected];
      const candidates = legal.filter(m => mFrom(m) === from120 && mTo(m) === sq120);
      if (candidates.length > 0) {
        handleAttempt(candidates[0]);
        return;
      }
    }
    const p = eng.pieceAt(i64);
    const sideToMove = eng.getSide();
    if (p !== 0 && p * sideToMove > 0) {
      setSelected(i64);
      setTargets(legal.filter(m => mFrom(m) === sq120).map(m => M120TO64[mTo(m)]));
    } else { setSelected(-1); setTargets([]); }
  };

  const handleAttempt = (move) => {
    const san = eng.sanOf(move);
    if (beat.type === "think") {
      const matched = beat.ideaMove ? san === beat.ideaMove : true;
      setThinkTried({ san, matched });
      setSelected(-1); setTargets([]);
      return; // think never actually plays the move -- it's a guess, not a commitment
    }
    // puzzle
    const expected = beat.solution[puzzleProgress];
    if (san !== expected) {
      setPuzzleFeedback("Not quite — try again");
      setSelected(-1); setTargets([]);
      setTimeout(() => setPuzzleFeedback(null), 1200);
      return;
    }
    eng.make(move);
    setLastMove({ from: mFrom(move), to: mTo(move) });
    setSelected(-1); setTargets([]);
    setPuzzleFeedback(null);
    const applied = puzzleProgress + 1;
    if (applied >= beat.solution.length) {
      setPuzzleSolved(true);
      setPuzzleProgress(applied);
      rerender();
      return;
    }
    setPuzzleProgress(applied);
    rerender();
    // auto-play the opponent's forced reply
    const replySan = beat.solution[applied];
    setTimeout(() => {
      const legal = eng.legalMoves();
      const replyMove = legal.find(m => eng.sanOf(m) === replySan);
      if (replyMove) {
        eng.make(replyMove);
        setLastMove({ from: mFrom(replyMove), to: mTo(replyMove) });
        setPuzzleProgress(applied + 1);
        rerender();
      }
    }, 500);
  };

  const viewBranchOption = (i) => {
    const opt = beat.options[i];
    gotoPly(beat.afterPly, opt.line);
    setBranchViewing(i);
    setBranchShown(prev => new Set(prev).add(i));
  };
  const returnToBranchPoint = () => {
    gotoPly(beat.afterPly);
    setBranchViewing(null);
  };

  if (!beat) return null;

  return (
    <div className="layout">
      <div className="boardCol">
        <Board eng={eng} orientation={orientation} selected={selected} targets={targets}
          lastMove={lastMove} onSquare={onSquare} pieceSetId={pieceSetId} />
      </div>

      <div className="panel">
        <div className="box lessonBox">
        <div className="lessonBeatCount">Step {beatIdx + 1} / {chapter.beats.length}</div>

        {beat.type === "narration" && (
          <p className="lessonText">{beat.text}</p>
        )}

        {beat.type === "think" && (
          <>
            <p className="lessonPrompt">{beat.prompt}</p>
            {!thinkTried ? (
              <p className="lessonHint">Try a move on the board, or reveal the idea.</p>
            ) : (
              <p className={"lessonTriedFeedback" + (thinkTried.matched ? " good" : "")}>
                {thinkTried.matched ? `${thinkTried.san} — that's the idea!` : `${thinkTried.san} — not quite what the coach played, but let's see the idea:`}
              </p>
            )}
            {(thinkTried || !beat.ideaMove) && <p className="lessonText">{beat.answer}</p>}
            {!thinkTried && <button className="btn ghost" onClick={() => setThinkTried({ san: null, matched: false })}>Show the idea</button>}
          </>
        )}

        {beat.type === "branch" && (
          <>
            <p className="lessonPrompt">{beat.prompt}</p>
            {branchViewing == null ? (
              <div className="lessonBranchOptions">
                {beat.options.map((opt, i) => (
                  <button key={i} className="btn ghost" onClick={() => viewBranchOption(i)}>
                    {branchShown.has(i) ? "✓ " : ""}{opt.label}
                  </button>
                ))}
              </div>
            ) : (
              <>
                <p className="lessonText">{beat.options[branchViewing].note}</p>
                <button className="btn ghost" onClick={returnToBranchPoint}>← Back to the branch point</button>
              </>
            )}
          </>
        )}

        {beat.type === "puzzle" && (
          <>
            <p className="lessonPrompt">{beat.prompt}</p>
            {puzzleFeedback && <p className="lessonTriedFeedback">{puzzleFeedback}</p>}
            {puzzleSolved && <p className="lessonText">{beat.explanation}</p>}
          </>
        )}

        <div className="lessonNav">
          <button className="btn ghost" onClick={prev} disabled={beatIdx === 0}>← Back</button>
          {atLastBeat ? (
            <button className="btn gold" onClick={onExit}>Finish chapter</button>
          ) : (
            <button className="btn gold" onClick={next}
              disabled={beat.type === "branch" && branchViewing != null}>Next →</button>
          )}
        </div>
        </div>
        <button className="btn ghost lessonExit" onClick={onExit}>Exit lesson</button>
      </div>
    </div>
  );
}
