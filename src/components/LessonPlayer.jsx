/* ================================================================
   Interactive lesson player -- steps through a chapter's beats
   (playthrough/narration/think/branch/puzzle, see src/data/lessons.js),
   replaying its own SAN move list into its own engine instance so it
   can't disturb the main Play board/modes, same isolation convention
   BlindMode.jsx already uses.

   Every beat also offers "Analyze this position": free moves for both
   sides on the live board plus an on-demand engine check (the same
   vendored Stockfish worker the difficulty tiers use, full strength),
   with Resume snapping cleanly back to the lesson. Interactivity over
   reading -- same philosophy as the Openings Library's replay/quiz.
   ================================================================ */

import { useEffect, useRef, useState } from "react";
import { createEngine, M64TO120, M120TO64, mFrom, mTo } from "../engine/chessEngine";
import { stockfishBestMove } from "../engine/stockfishEngine";
import { replayIntoEngine } from "../utils/share";
import LessonBoard from "./LessonBoard";

/** One chapter, played beat by beat. `onExit` returns to the chapter
 *  picker; `pieceSetId` is passed down so the lesson board matches
 *  whatever piece design the player already has set. */
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

  // playthrough-beat state
  const [playPly, setPlayPly] = useState(0);
  const [autoPlaying, setAutoPlaying] = useState(false);
  // think-beat state
  const [thinkTried, setThinkTried] = useState(null); // { san, matched } | null
  // branch-beat state
  const [branchShown, setBranchShown] = useState(new Set());
  const [branchViewing, setBranchViewing] = useState(null);
  // puzzle-beat state
  const [puzzleProgress, setPuzzleProgress] = useState(0);
  const [puzzleFeedback, setPuzzleFeedback] = useState(null);
  const [puzzleSolved, setPuzzleSolved] = useState(false);
  // analyze mode (available on every beat)
  const [analyzing, setAnalyzing] = useState(false);
  const [engineInfo, setEngineInfo] = useState(null); // { evalCp, bestSan } | "busy" | null

  const beat = chapter.beats[beatIdx];
  const playthroughEnd = beat?.type === "playthrough" ? (beat.toPly ?? chapter.mainLine.length) : 0;

  /* Replays the main line up to a given ply (plus optional sideline
     moves) and repaints -- the single source of truth every beat
     transition, playthrough step, branch view, and analyze-resume goes
     through, so the board can never drift from the current beat. */
  const gotoPly = (ply, extraMoves = []) => {
    eng.reset();
    const allMoves = chapter.mainLine.slice(0, ply).concat(extraMoves);
    replayIntoEngine(eng, allMoves);
    setLastMove(lastMoveFromSan(allMoves));
    setSelected(-1); setTargets([]);
    setEngineInfo(null);
    rerender();
  };

  /* replayIntoEngine doesn't return from/to squares -- cheapest correct
     way to highlight the final move is replaying one ply short on a
     scratch engine and looking the move up there. */
  function lastMoveFromSan(moveList) {
    if (!moveList.length) return null;
    const probe = createEngine();
    replayIntoEngine(probe, moveList.slice(0, -1));
    const mv = probe.legalMoves().find(m => probe.sanOf(m) === moveList[moveList.length - 1]);
    return mv ? { from: mFrom(mv), to: mTo(mv) } : null;
  }

  useEffect(() => {
    setThinkTried(null);
    setBranchShown(new Set());
    setBranchViewing(null);
    setPuzzleProgress(0);
    setPuzzleFeedback(null);
    setPuzzleSolved(false);
    setAnalyzing(false);
    setAutoPlaying(false);
    if (beat) {
      setPlayPly(beat.afterPly);
      gotoPly(beat.afterPly);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beatIdx]);

  /* Playthrough autoplay -- one ply per tick until the end, then stops.
     Cleared on pause, beat change, or unmount. */
  useEffect(() => {
    if (!autoPlaying || beat?.type !== "playthrough") return;
    const t = setInterval(() => {
      setPlayPly(p => {
        if (p >= playthroughEnd) { setAutoPlaying(false); return p; }
        return p + 1;
      });
    }, 1100);
    return () => clearInterval(t);
  }, [autoPlaying, beat, playthroughEnd]);

  useEffect(() => {
    if (beat?.type === "playthrough") gotoPly(playPly);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playPly]);

  const atLastBeat = beatIdx >= chapter.beats.length - 1;
  const next = () => setBeatIdx(i => Math.min(chapter.beats.length - 1, i + 1));
  const prev = () => setBeatIdx(i => Math.max(0, i - 1));

  const boardInteractive = analyzing || beat?.type === "think" || (beat?.type === "puzzle" && !puzzleSolved);

  const onSquare = (i64) => {
    if (!boardInteractive) return;
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
    if (p !== 0 && p * eng.getSide() > 0) {
      setSelected(i64);
      setTargets(legal.filter(m => mFrom(m) === sq120).map(m => M120TO64[mTo(m)]));
    } else { setSelected(-1); setTargets([]); }
  };

  const handleAttempt = (move) => {
    const san = eng.sanOf(move);
    if (analyzing) {
      eng.make(move);
      setLastMove({ from: mFrom(move), to: mTo(move) });
      setSelected(-1); setTargets([]);
      setEngineInfo(null); // position changed; last eval is stale
      rerender();
      return;
    }
    if (beat.type === "think") {
      const matched = beat.ideaMove ? san === beat.ideaMove : true;
      setThinkTried({ san, matched });
      setSelected(-1); setTargets([]);
      return; // think never plays the move -- it's a guess, not a commitment
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
    const replySan = beat.solution[applied];
    setTimeout(() => {
      const replyMove = eng.legalMoves().find(m => eng.sanOf(m) === replySan);
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
    setBranchShown(prevSet => new Set(prevSet).add(i));
  };
  const returnToBranchPoint = () => {
    gotoPly(beat.afterPly);
    setBranchViewing(null);
  };

  const startAnalyze = () => { setAnalyzing(true); setSelected(-1); setTargets([]); };
  const resumeLesson = () => {
    setAnalyzing(false);
    setEngineInfo(null);
    // snap back to wherever this beat's board is supposed to be
    if (beat.type === "playthrough") gotoPly(playPly);
    else if (beat.type === "branch" && branchViewing != null) gotoPly(beat.afterPly, beat.options[branchViewing].line);
    else gotoPly(beat.afterPly);
    if (beat.type === "puzzle") { setPuzzleProgress(0); setPuzzleSolved(false); setPuzzleFeedback(null); }
  };
  const runEngineCheck = () => {
    setEngineInfo("busy");
    const sideAtRequest = eng.getSide();
    stockfishBestMove(eng.fen(), 3190, 600).then(({ uci, info }) => {
      let bestSan = null;
      try {
        const mv = uci && eng.moveFromUci(uci);
        if (mv) bestSan = eng.sanOf(mv);
      } catch { /* position moved on / uci unmatched -- show eval only */ }
      const score = info ? (sideAtRequest === 1 ? info.score : -info.score) : 0;
      setEngineInfo({ evalCp: score, bestSan });
    }).catch(() => setEngineInfo(null));
  };

  if (!beat) return null;

  const evalLabel = engineInfo && engineInfo !== "busy"
    ? (Math.abs(engineInfo.evalCp) > 98000
      ? (engineInfo.evalCp > 0 ? "White mates" : "Black mates")
      : (engineInfo.evalCp >= 0 ? "+" : "") + (engineInfo.evalCp / 100).toFixed(1))
    : null;

  return (
    <div className="layout">
      <div className="boardCol">
        <LessonBoard eng={eng} orientation={orientation} selected={selected} targets={targets}
          lastMove={lastMove} onSquare={onSquare} pieceSetId={pieceSetId} />
      </div>

      <div className="panel">
        <div className="box lessonBox">
          <div className="lessonBeatCount">Step {beatIdx + 1} / {chapter.beats.length}</div>

          {analyzing ? (
            <>
              <p className="lessonPrompt">Analysis board</p>
              <p className="lessonHint">Move pieces for either side — try your own ideas here.</p>
              {engineInfo === "busy" ? (
                <p className="lessonText">Engine thinking…</p>
              ) : engineInfo ? (
                <p className="lessonText">
                  Engine: <b style={{ color: "var(--cyan)" }}>{evalLabel}</b>
                  {engineInfo.bestSan && <> · best move <b style={{ color: "var(--yellow)" }}>{engineInfo.bestSan}</b></>}
                </p>
              ) : null}
              <div className="lessonBranchOptions">
                <button className="btn ghost" onClick={runEngineCheck} disabled={engineInfo === "busy"}>Engine check</button>
                <button className="btn gold" onClick={resumeLesson}>Resume lesson</button>
              </div>
            </>
          ) : (
            <>
              {beat.type === "playthrough" && (
                <>
                  <p className="lessonText">{beat.text}</p>
                  <div className="lessonPlayCtrls">
                    <button className="btn ghost" onClick={() => { setAutoPlaying(false); setPlayPly(beat.afterPly); }} disabled={playPly <= beat.afterPly} aria-label="First move">|◀</button>
                    <button className="btn ghost" onClick={() => { setAutoPlaying(false); setPlayPly(p => Math.max(beat.afterPly, p - 1)); }} disabled={playPly <= beat.afterPly} aria-label="Previous move">◀</button>
                    <button className="btn ghost" onClick={() => setAutoPlaying(a => !a)} disabled={playPly >= playthroughEnd}>
                      {autoPlaying ? "❚❚" : "▶ Play"}
                    </button>
                    <button className="btn ghost" onClick={() => { setAutoPlaying(false); setPlayPly(p => Math.min(playthroughEnd, p + 1)); }} disabled={playPly >= playthroughEnd} aria-label="Next move">▶</button>
                    <button className="btn ghost" onClick={() => { setAutoPlaying(false); setPlayPly(playthroughEnd); }} disabled={playPly >= playthroughEnd} aria-label="Last move">▶|</button>
                  </div>
                  <div className="lessonBeatCount" style={{ marginTop: 6 }}>
                    Move {playPly} / {playthroughEnd}
                  </div>
                </>
              )}

              {beat.type === "narration" && <p className="lessonText">{beat.text}</p>}

              {beat.type === "think" && (
                <>
                  <p className="lessonPrompt">{beat.prompt}</p>
                  {!thinkTried ? (
                    <p className="lessonHint">Try a move on the board, or reveal the idea.</p>
                  ) : (
                    <p className={"lessonTriedFeedback" + (thinkTried.matched ? " good" : "")}>
                      {thinkTried.matched ? `${thinkTried.san} — that's the idea!` : `${thinkTried.san} — not what the coach played. Here's the idea:`}
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
                  {!puzzleSolved && !puzzleFeedback && <p className="lessonHint">Play the move on the board.</p>}
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
              <button className="btn ghost lessonAnalyzeBtn" onClick={startAnalyze}>🔍 Analyze this position</button>
            </>
          )}
        </div>
        <button className="btn ghost lessonExit" onClick={onExit}>Exit lesson</button>
      </div>
    </div>
  );
}
