/* ================================================================
   Interactive lesson player -- steps through a chapter's beats
   (playthrough/narration/think/branch/puzzle, see src/data/lessons.js),
   replaying its own SAN move list into its own engine instance so it
   can't disturb the main Play board/modes, same isolation convention
   BlindMode.jsx already uses.

   The coach (the site mascot, public/lesson-coach.webp) "speaks" every
   beat through a typewriter speech bubble, with a three-mode voice
   toggle: chatter blips (Animal Crossing-style square-wave babble --
   see utils/lessonVoice.js for why that's the "Zelda-ish" answer),
   real TTS (Blind Chess's ranked-best browser voice), or muted.

   Every beat also offers "Analyze this position": free moves for both
   sides plus an on-demand engine check (the same vendored Stockfish
   worker the difficulty tiers use, full strength), with Resume
   snapping cleanly back to the lesson.
   ================================================================ */

import { useEffect, useRef, useState } from "react";
import { createEngine, M64TO120, M120TO64, mFrom, mTo } from "../engine/chessEngine";
import { stockfishBestMove } from "../engine/stockfishEngine";
import { replayIntoEngine } from "../utils/share";
import { createSpeaker } from "../utils/speech";
import { charBlip } from "../utils/lessonVoice";
import { loadSetting, saveSetting } from "../utils/storage";
import LessonBoard from "./LessonBoard";

const TYPE_MS = 16;               // typewriter speed per character
const VOICE_MODES = ["blips", "speech", "off"];

const VoiceIcon = ({ mode }) => mode === "speech" ? (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4.03v8.05A4.5 4.5 0 0 0 16.5 12zM14 3.23v2.06A7 7 0 0 1 14 18.7v2.07A9 9 0 0 0 14 3.23z" />
  </svg>
) : mode === "blips" ? (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" />
  </svg>
) : (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M3 9v6h4l5 5V4L7 9H3zm13.6 3 2.7-2.7-1.4-1.4-2.7 2.7-2.7-2.7-1.4 1.4 2.7 2.7-2.7 2.7 1.4 1.4 2.7-2.7 2.7 2.7 1.4-1.4-2.7-2.7z" />
  </svg>
);

/** One chapter, played beat by beat. `onExit` returns to the chapter
 *  picker; `pieceSetId` is passed down so the lesson board matches
 *  whatever piece design the player already has set. */
export default function LessonPlayer({ chapter, orientation = "white", pieceSetId, onExit }) {
  const engRef = useRef(null);
  if (!engRef.current) engRef.current = createEngine();
  const eng = engRef.current;
  const speakerRef = useRef(null);
  if (!speakerRef.current) speakerRef.current = createSpeaker();

  const [beatIdx, setBeatIdx] = useState(0);
  const [, setTick] = useState(0);
  const rerender = () => setTick(t => t + 1);

  const [selected, setSelected] = useState(-1);
  const [targets, setTargets] = useState([]);
  const [lastMove, setLastMove] = useState(null);

  // playthrough-beat state
  const [playPly, setPlayPly] = useState(0);
  const [autoPlaying, setAutoPlaying] = useState(false);
  // narration-beat "how we got here" recap state
  const [recapPly, setRecapPly] = useState(null); // null = not recapping, else 0..beat.afterPly
  const [recapPlaying, setRecapPlaying] = useState(false);
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
  // coach voice
  const [voiceMode, setVoiceMode] = useState(() => loadSetting("lessonVoiceMode", "blips"));
  const [typedLen, setTypedLen] = useState(0);

  const beat = chapter.beats[beatIdx];
  const playthroughEnd = beat?.type === "playthrough" ? (beat.toPly ?? chapter.mainLine.length) : 0;

  /* What the coach is currently saying -- ONE line at a time, so the
     typewriter/voice always has a single source of truth. Reveals
     (think answer, branch note, puzzle explanation) replace the prompt. */
  const coachLine = analyzing
    ? "Analysis board — move pieces for either side and try your own ideas."
    : !beat ? ""
    : beat.type === "playthrough" || beat.type === "narration" ? beat.text
    : beat.type === "think" ? ((thinkTried || !beat.ideaMove) && thinkTried !== null ? beat.answer : beat.prompt)
    : beat.type === "branch" ? (branchViewing != null ? beat.options[branchViewing].note : beat.prompt)
    : beat.type === "puzzle" ? (puzzleSolved ? beat.explanation : beat.prompt)
    : "";

  /* Typewriter + voice, driven off coachLine changes. Blips fire as
     characters land; TTS speaks the whole line up front; both stop the
     instant the line changes (speaker.cancel + interval teardown). */
  useEffect(() => {
    setTypedLen(0);
    const speaker = speakerRef.current;
    speaker.cancel();
    if (!coachLine) return;
    if (voiceMode === "speech") speaker.speak(coachLine);
    const t = setInterval(() => {
      setTypedLen(len => {
        if (len >= coachLine.length) { clearInterval(t); return len; }
        const ch = coachLine[len];
        if (voiceMode === "blips" && len % 2 === 0) charBlip(ch);
        return len + 1;
      });
    }, TYPE_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coachLine, voiceMode]);

  useEffect(() => () => speakerRef.current.cancel(), []);

  const cycleVoice = () => {
    const next = VOICE_MODES[(VOICE_MODES.indexOf(voiceMode) + 1) % VOICE_MODES.length];
    setVoiceMode(next);
    saveSetting("lessonVoiceMode", next);
    if (next !== "speech") speakerRef.current.cancel();
  };

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
    setRecapPly(null);
    setRecapPlaying(false);
    if (beat) {
      setPlayPly(beat.afterPly);
      gotoPly(beat.afterPly);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beatIdx]);

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

  /* Narration beats jump straight to the position -- "how we got here"
     lets a newer player scrub/play back through the moves since the last
     beat's own board, same first/prev/play/next/last controls as the
     opening playthrough, just scoped to 0..beat.afterPly. */
  useEffect(() => {
    if (!recapPlaying || beat?.type !== "narration") return;
    const t = setInterval(() => {
      setRecapPly(p => {
        if (p >= beat.afterPly) { setRecapPlaying(false); return p; }
        return p + 1;
      });
    }, 1100);
    return () => clearInterval(t);
  }, [recapPlaying, beat]);

  useEffect(() => {
    if (beat?.type === "narration" && recapPly != null) gotoPly(recapPly);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recapPly]);

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
      setEngineInfo(null);
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
    setRecapPly(null);
    setRecapPlaying(false);
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
      } catch { /* position moved on -- show eval only */ }
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

  const typedDone = typedLen >= coachLine.length;

  return (
    <div className="layout">
      <div className="boardCol">
        <LessonBoard eng={eng} orientation={orientation} selected={selected} targets={targets}
          lastMove={lastMove} onSquare={onSquare} pieceSetId={pieceSetId} />
      </div>

      <div className="panel lessonPanel">
        <div className="box lessonBox">
          <div className="lessonCoachHead">
            <img src="/lesson-coach.webp" alt="" className="lessonCoachImg" />
            <div className="lessonCoachMeta">
              <div className="lessonCoachName">Coach Bot</div>
              <div className="lessonBeatCount">{analyzing ? "Analysis" : `Step ${beatIdx + 1} of ${chapter.beats.length}`}</div>
            </div>
            <button className="lessonVoiceBtn" onClick={cycleVoice}
              aria-label={`Coach Bot voice: ${voiceMode === "blips" ? "chatter" : voiceMode === "speech" ? "spoken" : "muted"} — click to change`}
              title={voiceMode === "blips" ? "Voice: chatter blips" : voiceMode === "speech" ? "Voice: spoken" : "Voice: muted"}>
              <VoiceIcon mode={voiceMode} />
            </button>
          </div>

          {/* The bubble types itself out; tap it to skip to the full line. */}
          <div className="lessonBubble" onClick={() => setTypedLen(coachLine.length)}>
            {coachLine.slice(0, typedLen)}
            {!typedDone && <span className="lessonCaret">▌</span>}
          </div>

          {analyzing ? (
            <>
              {engineInfo === "busy" ? (
                <p className="lessonHint">Engine thinking…</p>
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
                  <div className="lessonPlayCtrls">
                    <button className="btn ghost" onClick={() => { setAutoPlaying(false); setPlayPly(beat.afterPly); }} disabled={playPly <= beat.afterPly} aria-label="First move">|◀</button>
                    <button className="btn ghost" onClick={() => { setAutoPlaying(false); setPlayPly(p => Math.max(beat.afterPly, p - 1)); }} disabled={playPly <= beat.afterPly} aria-label="Previous move">◀</button>
                    <button className="btn ghost" onClick={() => setAutoPlaying(a => !a)} disabled={playPly >= playthroughEnd}>
                      {autoPlaying ? "❚❚" : "▶ Play"}
                    </button>
                    <button className="btn ghost" onClick={() => { setAutoPlaying(false); setPlayPly(p => Math.min(playthroughEnd, p + 1)); }} disabled={playPly >= playthroughEnd} aria-label="Next move">▶</button>
                    <button className="btn ghost" onClick={() => { setAutoPlaying(false); setPlayPly(playthroughEnd); }} disabled={playPly >= playthroughEnd} aria-label="Last move">▶|</button>
                  </div>
                  <div className="lessonBeatCount" style={{ marginTop: 6 }}>Move {playPly} / {playthroughEnd}</div>
                </>
              )}

              {beat.type === "narration" && beat.afterPly > 0 && (
                recapPly == null ? (
                  <button className="btn ghost lessonAnalyzeBtn" onClick={() => setRecapPly(0)}>
                    ▶ Show how we got here
                  </button>
                ) : (
                  <>
                    <div className="lessonPlayCtrls">
                      <button className="btn ghost" onClick={() => { setRecapPlaying(false); setRecapPly(0); }} disabled={recapPly <= 0} aria-label="First move">|◀</button>
                      <button className="btn ghost" onClick={() => { setRecapPlaying(false); setRecapPly(p => Math.max(0, p - 1)); }} disabled={recapPly <= 0} aria-label="Previous move">◀</button>
                      <button className="btn ghost" onClick={() => setRecapPlaying(a => !a)} disabled={recapPly >= beat.afterPly}>
                        {recapPlaying ? "❚❚" : "▶ Play"}
                      </button>
                      <button className="btn ghost" onClick={() => { setRecapPlaying(false); setRecapPly(p => Math.min(beat.afterPly, p + 1)); }} disabled={recapPly >= beat.afterPly} aria-label="Next move">▶</button>
                      <button className="btn ghost" onClick={() => { setRecapPlaying(false); setRecapPly(beat.afterPly); }} disabled={recapPly >= beat.afterPly} aria-label="Last move">▶|</button>
                    </div>
                    <div className="lessonBeatCount" style={{ marginTop: 6 }}>Move {recapPly} / {beat.afterPly}</div>
                    <button className="btn ghost" style={{ marginTop: 6 }}
                      onClick={() => { setRecapPlaying(false); setRecapPly(null); gotoPly(beat.afterPly); }}>
                      ✕ Close replay
                    </button>
                  </>
                )
              )}

              {beat.type === "think" && (
                <>
                  {!thinkTried ? (
                    <p className="lessonHint">Try a move on the board, or reveal the idea.</p>
                  ) : (
                    <p className={"lessonTriedFeedback" + (thinkTried.matched ? " good" : "")}>
                      {thinkTried.matched ? `${thinkTried.san} — that's the idea!` : thinkTried.san ? `${thinkTried.san} — not quite what I had in mind. Here's the idea:` : ""}
                    </p>
                  )}
                  {!thinkTried && <button className="btn ghost" onClick={() => setThinkTried({ san: null, matched: false })}>Show the idea</button>}
                </>
              )}

              {beat.type === "branch" && (
                branchViewing == null ? (
                  <div className="lessonBranchOptions">
                    {beat.options.map((opt, i) => (
                      <button key={i} className="btn ghost" onClick={() => viewBranchOption(i)}>
                        {branchShown.has(i) ? "✓ " : ""}{opt.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <button className="btn ghost" onClick={returnToBranchPoint}>← Back to the branch point</button>
                )
              )}

              {beat.type === "puzzle" && (
                <>
                  {puzzleFeedback && <p className="lessonTriedFeedback">{puzzleFeedback}</p>}
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
