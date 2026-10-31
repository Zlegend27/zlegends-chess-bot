/* Kinnda Lessons player -- steps through a chapter's beats (see
   kidLessons.js for the data + beat-type docs), replaying SAN moves into
   its own engine instance so it can never disturb the main Play game,
   same isolation convention the main site's LessonPlayer.jsx uses.

   Owl narrates every beat through a typewriter speech bubble with the
   same chatter-blip "voice" the main site's Lessons feature uses (see
   src/utils/lessonVoice.js) -- reused as-is rather than reinvented, just
   with a plain mute toggle instead of the main app's 3-way voice cycle
   (kids don't need the TTS/off distinction, just on/off). */

import { useEffect, useRef, useState } from "react";
import { createEngine, M64TO120, M120TO64, mFrom, mTo, EMPTY } from "../src/engine/chessEngine";
import { replayIntoEngine } from "../src/utils/share";
import { charBlip } from "../src/utils/lessonVoice";
import { AnimalIcon } from "./AnimalIcon";

const TYPE_MS = 18;
const FILES = "abcdefgh";
/* Help arrives in two stages, so the board gives away as little as it
   can for as long as it can.
   Stage 1 (3 misses): the piece that should move glows. That answers
   "which one?" and leaves "where to?" -- usually the whole lesson -- for
   her to find.
   Stage 2 (6 misses): an arrow adds the destination. By then she isn't
   close, and more guessing teaches nothing. */
const GLOW_AFTER_WRONG = 3;
const ARROW_AFTER_WRONG = 6;
/* How long the wrong square stays lit red / Owl stays sad. */
const WRONG_FLASH_MS = 800;

export default function KidLessonPlayer({ chapter, renderPiece, boardVars, audio, onExit, onComplete }) {
  const engRef = useRef(null);
  if (!engRef.current) engRef.current = createEngine();
  const eng = engRef.current;

  const [beatIdx, setBeatIdx] = useState(0);
  const [, force] = useState(0);
  const rerender = () => force(n => n + 1);

  const [selected, setSelected] = useState(-1);
  const [targets, setTargets] = useState([]);
  const [lastMove, setLastMove] = useState(null);

  /* A "think" beat used to end on the very first attempt, right or
     wrong -- one guess and Owl just played the answer for you. Now a
     wrong move resets the board and lets the kid try again, so these
     track the attempt history instead of a single shot. */
  const [thinkDone, setThinkDone] = useState(null);   // { san } once solved/revealed
  const [thinkWrong, setThinkWrong] = useState(0);    // wrong attempts this beat
  const [lastWrong, setLastWrong] = useState(null);   // SAN of the most recent miss
  const [wrongSquare, setWrongSquare] = useState(-1); // square to flash red
  const wrongTimerRef = useRef(null);
  const [quizPicked, setQuizPicked] = useState(null); // option index | null
  const [quizSolved, setQuizSolved] = useState(false);

  const [muted, setMuted] = useState(false);
  const [typedLen, setTypedLen] = useState(0);
  const [boardShake, setBoardShake] = useState(false);

  const beat = chapter.beats[beatIdx];

  /* Most beats replay SAN from the true start position (matches the main
     site's Lessons convention), but endgame/tactics positions are much
     more naturally expressed as a FEN (`demoFen`) than a contrived legal
     move sequence from move 1 -- `extra` (SAN) applies on top of
     whichever base the beat uses, for revealing a think/quiz answer. */
  const setupPosition = (extra = []) => {
    eng.reset();
    let last = null;
    if (beat?.demoFen) {
      eng.loadFen(beat.demoFen);
      for (const san of extra) {
        const mv = eng.legalMoves().find(m => eng.sanOf(m) === san);
        if (mv) { eng.make(mv); last = { from: mFrom(mv), to: mTo(mv) }; }
      }
    } else {
      const allMoves = (beat?.demoMoves || []).concat(extra);
      replayIntoEngine(eng, allMoves);
      if (allMoves.length) {
        const probe = createEngine();
        replayIntoEngine(probe, allMoves.slice(0, -1));
        const mv = probe.legalMoves().find(m => probe.sanOf(m) === allMoves[allMoves.length - 1]);
        if (mv) last = { from: mFrom(mv), to: mTo(mv) };
      }
    }
    setLastMove(last);
    setSelected(-1); setTargets([]);
    rerender();
  };

  useEffect(() => () => clearTimeout(wrongTimerRef.current), []);

  useEffect(() => {
    setThinkDone(null);
    setThinkWrong(0);
    setLastWrong(null);
    setWrongSquare(-1);
    clearTimeout(wrongTimerRef.current);
    setQuizPicked(null);
    setQuizSolved(false);
    if (beat) setupPosition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beatIdx]);

  /* Two escalating tiers, never once it's solved (see the constants). */
  const stillThinking = beat?.type === "think" && !thinkDone;
  const showGlow = stillThinking && thinkWrong >= GLOW_AFTER_WRONG;
  const showArrow = stillThinking && thinkWrong >= ARROW_AFTER_WRONG;

  /* The from/to squares of the move being hinted -- resolved against the
     live position (a wrong attempt always resets back to the beat's own
     position, so this stays valid across retries). `from` drives the
     glow at stage 1; `to` and the arrow only appear at stage 2. */
  const hintSquares = (() => {
    if (!showGlow || !beat?.acceptable?.length) return null;
    const mv = eng.legalMoves().find(m => eng.sanOf(m) === beat.acceptable[0]);
    return mv ? { from: M120TO64[mFrom(mv)], to: M120TO64[mTo(mv)] } : null;
  })();

  const coachLine = !beat ? ""
    : beat.type === "narration" ? beat.text
    : beat.type === "think" ? (
        thinkDone ? beat.answer
        : showArrow ? (beat.nudgeArrow || "Follow the arrow -- that's exactly where it goes. Play it and I'll explain why it works!")
        : showGlow ? (beat.nudge || "See the piece that's glowing? That's the one to move. Now -- where should it go?")
        : thinkWrong > 0 ? (beat.retry || "Not quite! Have another go -- you can try as many times as you like.")
        : beat.prompt
      )
    : beat.type === "quiz" ? (quizPicked != null ? beat.options[quizPicked].note : beat.prompt)
    : "";

  useEffect(() => {
    setTypedLen(0);
    if (!coachLine) return;
    const t = setInterval(() => {
      setTypedLen(len => {
        if (len >= coachLine.length) { clearInterval(t); return len; }
        if (!muted && len % 2 === 0) charBlip(coachLine[len]);
        return len + 1;
      });
    }, TYPE_MS);
    return () => clearInterval(t);
  }, [coachLine, muted]);

  const boardInteractive = beat?.type === "think" && !thinkDone;

  /* Escape hatch once the arrow is up -- plays the move for them and
     jumps straight to Owl's explanation, so a kid who still can't find
     it (or can't be bothered) is never stuck on a beat. */
  const revealAnswer = () => {
    const san = beat.acceptable[0];
    setThinkDone({ san });
    setupPosition([san]);
  };

  const onSquare = (i64) => {
    if (!boardInteractive) return;
    const legal = eng.legalMoves();
    const sq120 = M64TO120[i64];
    if (selected >= 0) {
      const from120 = M64TO120[selected];
      const candidates = legal.filter(m => mFrom(m) === from120 && mTo(m) === sq120);
      if (candidates.length > 0) {
        const san = eng.sanOf(candidates[0]);
        const matched = beat.acceptable.includes(san);
        setSelected(-1); setTargets([]);
        if (matched) {
          /* Play it for real so the board matches what Owl is about to
             explain. */
          setThinkDone({ san });
          setupPosition([san]);
        } else {
          /* Reset to the beat's own position rather than playing the
             answer -- the kid gets to try again, and the board still
             shows the puzzle instead of spoiling it.
             Four signals fire together so a miss is unmissable even if
             the sound is muted: the buzz, the board shake, the square
             she dropped on flashing red, and Owl pulling a sad face. */
          audio?.sfxWrong();
          setBoardShake(true);
          setTimeout(() => setBoardShake(false), 400);
          setWrongSquare(i64);
          clearTimeout(wrongTimerRef.current);
          wrongTimerRef.current = setTimeout(() => setWrongSquare(-1), WRONG_FLASH_MS);
          setLastWrong(san);
          setThinkWrong(n => n + 1);
          setupPosition();
        }
        return;
      }
    }
    const p = eng.pieceAt(i64);
    if (p !== EMPTY && p * eng.getSide() > 0) {
      setSelected(i64);
      setTargets(legal.filter(m => mFrom(m) === sq120).map(m => M120TO64[mTo(m)]));
    } else { setSelected(-1); setTargets([]); }
  };

  const pickQuiz = (i) => {
    setQuizPicked(i);
    const opt = beat.options[i];
    if (opt.correct) {
      setQuizSolved(true);
      if (opt.move) setupPosition([opt.move]);
    } else {
      audio?.sfxWrong();
    }
  };

  const atLastBeat = beatIdx >= chapter.beats.length - 1;
  const next = () => {
    if (atLastBeat) { onComplete?.(); onExit(); return; }
    setBeatIdx(i => Math.min(chapter.beats.length - 1, i + 1));
  };
  const prev = () => setBeatIdx(i => Math.max(0, i - 1));

  const buildBoardRows = () => {
    const rows = [];
    for (let vr = 0; vr < 8; vr++) {
      const r = 7 - vr;
      const cells = [];
      for (let vf = 0; vf < 8; vf++) {
        const f = vf;
        const i64 = r * 8 + f;
        const sq120 = M64TO120[i64];
        const p = eng.pieceAt(i64);
        const light = (r + f) % 2 === 1;
        const isSel = selected === i64;
        const isTarget = targets.includes(i64);
        const isLast = lastMove && (lastMove.from === sq120 || lastMove.to === sq120);
        const isHintFrom = hintSquares && hintSquares.from === i64;
        const isHintTo = showArrow && hintSquares && hintSquares.to === i64;
        const isWrongSq = wrongSquare === i64;
        const squareName = FILES[f] + (r + 1);
        cells.push(
          <div key={i64} role="gridcell" tabIndex={0} aria-label={squareName}
            onClick={() => onSquare(i64)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSquare(i64); } }}
            className={"kSq " + (light ? "kLight" : "kDark") + (isSel ? " kSel" : "") + (isLast ? " kLast" : "")
              + (isHintFrom ? " kHintFrom" : "") + (isHintTo ? " kHintTo" : "") + (isWrongSq ? " kWrongSq" : "")}>
            {isWrongSq && <span className="kWrongX" aria-hidden="true">✕</span>}
            {p !== EMPTY && renderPiece(p)}
            {isTarget && <span className="kDot" />}
            {vf === 0 && <span className="kCoord kRk">{r + 1}</span>}
            {vr === 7 && <span className="kCoord kFl">{FILES[f]}</span>}
          </div>
        );
      }
      rows.push(<div key={vr} role="row" className="kRow">{cells}</div>);
    }
    return rows;
  };

  /* The nudge arrow. Drawn in board coordinates (viewBox 0 0 8 8) over
     the squares, so it scales with the board at any size. The lesson
     board is always white-side-up, so the mapping needs no flip.
     Deliberately a straight line even for knight moves -- the main app
     bends those, but for a kid "this piece goes to that square" reads
     more clearly as one straight arrow than an L-shaped path. */
  const hintArrow = () => {
    if (!showArrow || !hintSquares) return null;
    const pt = (i64) => ({ x: (i64 % 8) + 0.5, y: (7 - ((i64 / 8) | 0)) + 0.5 });
    const a = pt(hintSquares.from), b = pt(hintSquares.to);
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    const HEAD = 0.46, START_OFF = 0.3;
    const start = { x: a.x + ux * START_OFF, y: a.y + uy * START_OFF };
    const tipBase = { x: b.x - ux * HEAD, y: b.y - uy * HEAD };
    const px = -uy, py = ux;
    const head = [
      `${b.x},${b.y}`,
      `${tipBase.x + px * 0.26},${tipBase.y + py * 0.26}`,
      `${tipBase.x - px * 0.26},${tipBase.y - py * 0.26}`,
    ].join(" ");
    return (
      <svg className="kHintArrow" viewBox="0 0 8 8" aria-hidden="true">
        <line x1={start.x} y1={start.y} x2={tipBase.x} y2={tipBase.y}
          strokeWidth="0.19" strokeLinecap="round" />
        <polygon points={head} />
      </svg>
    );
  };

  if (!beat) return null;
  const typedDone = typedLen >= coachLine.length;

  return (
    <div className="kRoot" onClick={e => { if (e.target === e.currentTarget) onExit(); }}>
      <button className="kCloseX" onClick={onExit} aria-label="Close Lessons">✕</button>
      <div className="kHdr">
        <h1>Kinnda Chess</h1>
      </div>
      <h2 className="kLessonTitle" style={{ marginTop: 4 }}>{chapter.title}</h2>

      <div className="kBoardWrap">
        <div className={"kBoard" + (boardShake ? " kWrongShake" : "")} style={boardVars} role="grid" aria-label="Chess board">
          {buildBoardRows()}
          {hintArrow()}
        </div>
      </div>

      <div className="kCoachPanel">
        <div className="kCoachHead">
          {/* Owl reacts: sad for the moment after a miss, happy once
              it's solved. Same mood prop the Play screen uses. */}
          <AnimalIcon kind={chapter.teacher} size={44}
            mood={wrongSquare >= 0 ? "sad" : thinkDone ? "happy" : undefined} />
          <div className="kCoachMeta">
            <div className="kCoachName">{chapter.teacher}</div>
            <div className="kCoachStep">Step {beatIdx + 1} of {chapter.beats.length}</div>
          </div>
          <button className="kIconBtn kCoachMute" onClick={() => setMuted(m => !m)} title={muted ? "Unmute" : "Mute"}>
            {muted ? "🔇" : "🔊"}
          </button>
        </div>
        <div className="kCoachBubble" onClick={() => setTypedLen(coachLine.length)}>
          {coachLine.slice(0, typedLen)}
          {!typedDone && <span className="kCoachCaret">▌</span>}
        </div>

        {beat.type === "think" && (
          thinkDone ? (
            <p className="kThinkFeedback good">{thinkDone.san} -- that's it! ⭐</p>
          ) : (
            <>
              {lastWrong && (
                <p className="kThinkFeedback">
                  <span className="kThinkX">✕</span> {lastWrong} isn&apos;t it -- try again!
                  {thinkWrong > 1 && <span className="kTryCount"> ({thinkWrong} tries)</span>}
                </p>
              )}
              <p className="kThinkHint">{beat.hint || "Try a move on the board!"}</p>
              {showArrow && (
                <button className="kThinkReveal" onClick={revealAnswer}>Just show me ▶</button>
              )}
            </>
          )
        )}

        {beat.type === "quiz" && (
          <div className="kQuizOptions">
            {beat.options.map((opt, i) => (
              <button key={i}
                className={"kQuizOpt" + (quizPicked === i ? (opt.correct ? " correct" : " wrong") : "")}
                onClick={() => pickQuiz(i)} disabled={quizSolved && quizPicked !== i}>
                {opt.label}
              </button>
            ))}
          </div>
        )}

        <div className="kLessonNav">
          <button onClick={prev} disabled={beatIdx === 0}>← Back</button>
          <button className="kLessonNext" onClick={next}>{atLastBeat ? "Finish! 🎉" : "Next →"}</button>
        </div>
      </div>
    </div>
  );
}
