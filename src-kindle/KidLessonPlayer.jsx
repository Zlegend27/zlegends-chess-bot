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

export default function KidLessonPlayer({ chapter, renderPiece, boardVars, onExit, onComplete }) {
  const engRef = useRef(null);
  if (!engRef.current) engRef.current = createEngine();
  const eng = engRef.current;

  const [beatIdx, setBeatIdx] = useState(0);
  const [, force] = useState(0);
  const rerender = () => force(n => n + 1);

  const [selected, setSelected] = useState(-1);
  const [targets, setTargets] = useState([]);
  const [lastMove, setLastMove] = useState(null);

  const [thinkTried, setThinkTried] = useState(null); // { san, matched } | null
  const [quizPicked, setQuizPicked] = useState(null); // option index | null
  const [quizSolved, setQuizSolved] = useState(false);

  const [muted, setMuted] = useState(false);
  const [typedLen, setTypedLen] = useState(0);

  const beat = chapter.beats[beatIdx];

  const showPosition = (moves) => {
    eng.reset();
    replayIntoEngine(eng, moves);
    if (moves.length) {
      const probe = createEngine();
      replayIntoEngine(probe, moves.slice(0, -1));
      const mv = probe.legalMoves().find(m => probe.sanOf(m) === moves[moves.length - 1]);
      setLastMove(mv ? { from: mFrom(mv), to: mTo(mv) } : null);
    } else setLastMove(null);
    setSelected(-1); setTargets([]);
    rerender();
  };

  useEffect(() => {
    setThinkTried(null);
    setQuizPicked(null);
    setQuizSolved(false);
    if (beat) showPosition(beat.demoMoves || []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beatIdx]);

  const coachLine = !beat ? ""
    : beat.type === "narration" ? beat.text
    : beat.type === "think" ? (thinkTried ? beat.answer : beat.prompt)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coachLine, muted]);

  const boardInteractive = beat?.type === "think" && !thinkTried;

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
        setThinkTried({ san, matched });
        setSelected(-1); setTargets([]);
        /* Always land on a position that visually matches the answer
           text -- a correct guess gets played for real; a wrong one is
           replaced by the actual idea, so the board never contradicts
           what Owl just said. */
        showPosition([...(beat.demoMoves || []), matched ? san : beat.acceptable[0]]);
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
      if (opt.move) showPosition([...(beat.demoMoves || []), opt.move]);
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
        const squareName = FILES[f] + (r + 1);
        cells.push(
          <div key={i64} role="gridcell" tabIndex={0} aria-label={squareName}
            onClick={() => onSquare(i64)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSquare(i64); } }}
            className={"kSq " + (light ? "kLight" : "kDark") + (isSel ? " kSel" : "") + (isLast ? " kLast" : "")}>
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
        <div className="kBoard" style={boardVars} role="grid" aria-label="Chess board">{buildBoardRows()}</div>
      </div>

      <div className="kCoachPanel">
        <div className="kCoachHead">
          <AnimalIcon kind={chapter.teacher} size={44} />
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
          thinkTried ? (
            <p className={"kThinkFeedback" + (thinkTried.matched ? " good" : "")}>
              {thinkTried.matched ? `${thinkTried.san} -- that's it!` : `${thinkTried.san} -- not quite, but here's the idea above!`}
            </p>
          ) : (
            <p className="kThinkHint">{beat.hint || "Try a move on the board!"}</p>
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
