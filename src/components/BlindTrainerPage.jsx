/* The Blind Chess Trainer (/blind, in Learn). A path of stages that open
   one at a time (blindPath.js); each stage takes the board away step by
   step, from tapping answers on a board with the pieces shown, to an
   empty board, to no board at all (text or voice), which is the goal.
   Questions come from blindDrills.js (engine-checked, no AI). The full
   voice game (BlindMode) is one of the choices. */
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import StarField from "./StarField";
import TapBoard from "./TapBoard";
import { getUiTheme } from "../utils/uiTheme";
import { getBoardColor } from "../utils/boardColors";
import { loadSetting, saveSetting } from "../utils/storage";
import { makeQuestion } from "../utils/blindDrills";
import { createEngine, mFrom, mTo, M120TO64 } from "../engine/chessEngine";
import { STAGES, SESSION, openStages, nextStage, afterSession, stepOf, VIEW_NAMES } from "../utils/blindPath";
import { loadTraining, saveTraining, bumpStreak, liveStreak } from "../utils/blindTrainerStore";
import { syncTraining } from "../utils/blindTrainerSync";
import { createSpeaker, createRecognizer } from "../utils/speech";
import { track } from "../utils/track";

const BlindMode = lazy(() => import("./BlindMode"));
const BlindPuzzles = lazy(() => import("./BlindPuzzles"));

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const INSTALLED_IPHONE = typeof window !== "undefined" && /iPhone|iPad|iPod/.test(navigator.userAgent)
  && (window.navigator.standalone === true || window.matchMedia?.("(display-mode: standalone)").matches);
const CAN_LISTEN = typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition) && !INSTALLED_IPHONE;

/** A FEN with one piece (e.g. "N") on one square, for showing reach. */
export function loneFen(piece, square) {
  const f = "abcdefgh".indexOf(square[0]), r = Number(square[1]);
  const rows = [];
  for (let rank = 8; rank >= 1; rank--) {
    if (rank !== r) { rows.push("8"); continue; }
    rows.push((f ? String(f) : "") + piece + (7 - f ? String(7 - f) : ""));
  }
  return rows.join("/") + " w - - 0 1";
}

/* What to say when an answer couldn't be read, by kind of question. */
const RETRY = {
  square: "Answer with a square, like e4.",
  number: "Answer with a number, like 6.",
  colour: "Answer light or dark.",
  yesno: "Answer yes or no.",
  piece: "Answer with a piece, like white knight, or say empty.",
  choice: "Pick one of the openings, or say its number.",
  move: "Answer with a move, like Qg7 or queen to g7.",
};
const CHANGE_TEXT = {
  up2: "Perfect! Two steps ahead.",
  up: "Good: one step ahead.",
  same: "Nearly: one more round at this step.",
  down: "A step back, for a bit more practice.",
  done: "Stage complete!",
};

/* The from and to squares of a move question's answer. */
function solutionSquares(q) {
  if (!q.fen || !q.answer) return null;
  const eng = createEngine(); eng.loadFen(q.fen);
  const m = eng.legalMoves().find((x) => eng.sanOf(x) === q.answer);
  if (!m) return null;
  const name = (i120) => { const t = M120TO64[i120]; return "abcdefgh"[t % 8] + (((t / 8) | 0) + 1); };
  return [name(mFrom(m)), name(mTo(m))];
}

/* What the board shows for a question, by step. */
function boardFor(q, step) {
  const drill = q.drill;
  const reachSquare = drill === "reach" ? (q.prompt.match(/\b[a-h][1-8]\b/) || [])[0] : null;
  const reachFen = reachSquare ? loneFen(/bishop/.test(q.prompt) ? "B" : "N", reachSquare) : null;
  if (step.view === "bare") return { fen: null, coords: true, colored: true };
  if (drill === "coords") return { fen: null, coords: !!step.coords, colored: true, flipped: !!step.flipped };
  if (drill === "colors") return { fen: null, coords: true, colored: false, hint: (q.prompt.match(/\b[a-h][1-8]\b/g) || []) };
  if (drill === "reach") return { fen: reachFen, coords: true, colored: true };
  if (drill === "tracking" || drill === "squares") return { fen: START_FEN, coords: true, colored: true };
  return { fen: q.fen || null, coords: true, colored: true };
}
/* The board shown after answering ("Show the board"): the real position. */
function revealFor(q) {
  if (q.drill === "reach") { const s = (q.prompt.match(/\b[a-h][1-8]\b/) || [])[0]; return s ? loneFen(/bishop/.test(q.prompt) ? "B" : "N", s) : null; }
  return q.fen || null;
}

export default function BlindTrainerPage({ onBack, onRegisterBack, sweetheart, pieceSetId = "classic", startScreen = "home", session: authSession }) {
  const T = getUiTheme(sweetheart);
  const focus = `focus-visible:outline-none focus-visible:ring-2 ${T.ring}`;
  const [screen, setScreen] = useState(startScreen); // home | session | done | game
  const [training, setTraining] = useState(loadTraining);
  const [voiceOn, setVoiceOn] = useState(() => !!loadSetting("blindTrainerVoice", false));
  const [run, setRun] = useState(null); // { stageId, step, queue }
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [verdict, setVerdict] = useState(null); // { correct, explanation, marks } | { retry }
  const [results, setResults] = useState([]);
  const [picked, setPicked] = useState(null);
  const [showBoard, setShowBoard] = useState(false);
  const [listening, setListening] = useState(false);
  const [outcome, setOutcome] = useState(null); // end of session
  /* The whole path is tucked away until asked for: the home screen shows
     where you are and Continue. */
  const [pathOpen, setPathOpen] = useState(false);
  const inputRef = useRef(null);

  const speaker = useMemo(() => createSpeaker(), []);
  const recRef = useRef(null);
  const submitRef = useRef(() => {});
  useEffect(() => {
    if (!CAN_LISTEN) return undefined;
    recRef.current = createRecognizer({
      onResult: (text) => submitRef.current(text),
      onStart: () => setListening(true),
      onEnd: () => setListening(false),
      onError: (err) => { setListening(false); if (err === "no-speech") setVerdict({ retry: "I didn't hear anything. Tap the mic and try again." }); },
    });
    return () => { recRef.current?.stop(); speaker.cancel(); };
  }, [speaker]);
  useEffect(() => {
    const off = () => { if (document.hidden) { recRef.current?.stop(); speaker.cancel(); } };
    document.addEventListener("visibilitychange", off);
    return () => document.removeEventListener("visibilitychange", off);
  }, [speaker]);

  /* The phone's Back steps out of a session (or a game, or puzzles) to
     the trainer's home, and from there to Learn, instead of jumping
     straight to Home (App.jsx onPopState). */
  const screenRef = useRef(screen);
  screenRef.current = screen;
  useEffect(() => {
    onRegisterBack?.(() => {
      if (screenRef.current !== "home") { speaker.cancel(); recRef.current?.stop(); setScreen("home"); return "stay"; }
      onBack();
      return "moved";
    });
    return () => onRegisterBack?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Signed in: bring this device's progress and the account's together. */
  const userId = authSession?.user?.id ?? null;
  useEffect(() => {
    let live = true;
    syncTraining(training).then((merged) => { if (live && merged) { setTraining(merged); saveTraining(merged); } });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const say = (text) => { if (voiceOn) { speaker.cancel(); speaker.speak(text); } };
  const toggleVoice = () => {
    speaker.prime();
    setVoiceOn((v) => { saveSetting("blindTrainerVoice", !v); if (v) speaker.cancel(); return !v; });
  };

  const q = run?.queue[idx] || null;
  const step = run?.step || null;
  const blind = step?.view === "blind";

  /* Called from a tap, so the first spoken sentence is allowed on phones. */
  const startStage = (stageId) => {
    speaker.prime();
    const st = stepOf(training.path, stageId);
    const stage = STAGES.find((s) => s.id === stageId);
    /* Five different questions: random ones could repeat ("Tap c7" twice). */
    const queue = [];
    for (let tries = 0; queue.length < SESSION && tries < SESSION * 20; tries++) {
      const cand = makeQuestion(stage.drill, st.level);
      if (!queue.some((x) => x.prompt === cand.prompt)) queue.push(cand);
    }
    while (queue.length < SESSION) queue.push(makeQuestion(stage.drill, st.level));
    setRun({ stageId, step: st, queue, openBefore: openStages(training.path) });
    setIdx(0); setResults([]); setAnswer(""); setVerdict(null); setPicked(null); setShowBoard(false); setOutcome(null);
    setScreen("session");
    if (st.view === "blind") say(queue[0].spoken);
    track("blind_drill_start", { stage: stageId, view: st.view });
  };

  /* Squares to mark after an answer given on the board. */
  const marksFor = (r, given) => {
    if (!q || !given) return {};
    const m = {};
    if (q.kind === "square" && /^[a-h][1-8]$/.test(given)) {
      /* Every right square lights up (a knight has several), then the
         tapped one on top: green if right, red if not. */
      for (const s2 of q.accepts || (q.answer && /^[a-h][1-8]$/.test(q.answer) ? [q.answer] : [])) m[s2] = "right";
      m[given] = r.correct ? "right" : "wrong";
    }
    if (q.kind === "move" && /^[a-h][1-8][a-h][1-8]$/.test(given)) {
      if (!r.correct) {
        /* The right move, so a miss shows what to play. */
        const sol = solutionSquares(q);
        if (sol) { m[sol[0]] = "right"; m[sol[1]] = "right"; }
      }
      m[given.slice(0, 2)] = r.correct ? "right" : "wrong";
      m[given.slice(2)] = r.correct ? "right" : "wrong";
    }
    return m;
  };

  const submit = (text) => {
    if (!q || (verdict && !verdict.retry)) return;
    const r = q.check(text);
    if (!r.understood) {
      const hint = r.retry || RETRY[q.kind];
      setVerdict({ retry: r.retry ? `"${String(text).trim()}": ${hint}` : `I didn't understand "${String(text).trim()}". ${hint}` });
      setPicked(null);
      say(hint);
      return;
    }
    setResults((list) => [...list, r.correct]);
    setVerdict({ correct: r.correct, explanation: r.explanation, marks: marksFor(r, String(text).trim().toLowerCase()) });
    setPicked(null);
    say(`${r.correct ? "Right." : "Not quite."} ${r.explanation}`);
  };
  submitRef.current = submit;

  const onTap = (square) => {
    if (!q || (verdict && !verdict.retry)) return;
    if (q.kind === "square") { submit(square); return; }
    if (q.kind === "move") {
      if (!picked) { setPicked(square); return; }
      if (picked === square) { setPicked(null); return; }
      submit(picked + square);
    }
  };

  const finish = (allResults) => {
    const right = allResults.filter(Boolean).length;
    const before = training.path[run.stageId];
    const { record, change } = afterSession(before, run.stageId, right, allResults.length);
    const next = { ...training, path: { ...training.path, [run.stageId]: record }, streak: bumpStreak(training.streak) };
    const opened = openStages(next.path).filter((id) => !run.openBefore.includes(id));
    setTraining(next);
    saveTraining(next);
    syncTraining(next).then((merged) => { if (merged) { setTraining(merged); saveTraining(merged); } });
    setOutcome({ right, of: allResults.length, change, opened, nextStep: stepOf(next.path, run.stageId) });
    setScreen("done");
    say(`${right} out of ${allResults.length}. ${CHANGE_TEXT[change]}${opened.length ? ` New stage: ${STAGES.find((s) => s.id === opened[0]).name}.` : ""}`);
    track("blind_drill_done", { stage: run.stageId, view: run.step.view, right, of: allResults.length, change });
  };

  const nextQuestion = () => {
    speaker.prime();
    if (idx + 1 >= run.queue.length) { finish(results); return; }
    const n = idx + 1;
    setIdx(n); setAnswer(""); setVerdict(null); setPicked(null); setShowBoard(false);
    if (blind) say(run.queue[n].spoken);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const onMic = () => {
    speaker.prime();
    if (listening) { recRef.current?.stop(); return; }
    speaker.cancel();
    recRef.current?.resetBlock();
    recRef.current?.start();
  };

  const colors = getBoardColor(loadSetting("boardColor", "default"));
  const streak = liveStreak(training.streak);
  const open = openStages(training.path);
  const current = nextStage(training.path);
  const card = `rounded-2xl border ${T.cardBorder} ${T.panelBg} backdrop-blur-sm`;
  const back = (label, go) => (
    <button type="button" onClick={go} className={`mb-1 inline-flex h-11 items-center gap-1.5 self-start border-0 bg-transparent text-sm font-bold ${T.dimText} ${T.hoverInk} ${focus}`}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" /></svg>
      {label}
    </button>
  );
  const stageName = (id) => STAGES.find((s) => s.id === id).name;

  /* ---------------- a question ---------------- */
  const renderQuestion = () => {
    const b = boardFor(q, step);
    const answered = verdict && !verdict.retry;
    const tapToAnswer = !blind && (q.kind === "square" || q.kind === "move");
    const showChoices = q.choices && (!blind || q.kind === "choice" || q.kind === "colour" || q.kind === "yesno");
    return (
      <section className={card + " trainerLayout p-4"} aria-live="polite">
        <div className="tHead">
        <div className="qDots" role="img" aria-label={`Question ${idx + 1} of ${run.queue.length}`}>
          {run.queue.map((_, i) => <span key={i} className={i < results.length ? (results[i] ? "right" : "wrong") : i === idx ? "now" : ""} />)}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="viewBadge">{VIEW_NAMES[step.view]}</span>
          <span className={`text-xs font-bold ${T.dimText}`}>{stageName(run.stageId)}</span>
        </div>
        <p className={`m-0 text-lg font-bold leading-snug ${T.ink}`}>{q.prompt}</p>
        {blind && voiceOn && <button type="button" onClick={() => { speaker.prime(); speaker.cancel(); speaker.speak(q.spoken); }} className={`self-start border-0 bg-transparent p-0 py-1 text-sm font-bold underline ${T.interactiveText} ${focus}`}>Hear it again</button>}
        </div>

        {!blind && (
          <div className="tBoard">
            <TapBoard
              fen={answered && step.view === "bare" ? revealFor(q) : b.fen}
              coords={b.coords} colored={b.colored || answered} flipped={b.flipped} pieceSetId={pieceSetId} colors={colors}
              onTap={tapToAnswer ? onTap : undefined} picked={picked} disabled={!tapToAnswer || answered}
              marks={answered ? verdict.marks : Object.fromEntries((b.hint || []).map((s) => [s, "hint"]))}
              label={tapToAnswer ? (q.kind === "move" ? "Board: tap the piece, then where it goes" : "Board: tap your answer") : "Board"}
            />
            {tapToAnswer && !answered && (
              <p className={`m-0 text-center text-xs ${T.dimText}`}>{q.kind === "move" ? (picked ? `${picked} picked: now tap where it goes (tap it again to undo)` : "Tap the piece, then the square it goes to.") : "Tap the square."}</p>
            )}
          </div>
        )}

        <div className="tBody">
        {!answered && (
          <>
            {showChoices && (
              <div className="grid grid-cols-2 gap-2">
                {q.choices.map((c, i) => (
                  <button key={c} type="button" onClick={() => submit(q.kind === "choice" ? String(i + 1) : c)}
                    className={`min-h-12 rounded-xl border ${T.cardBorder} bg-transparent px-3 text-sm font-bold ${T.ink} ${focus}`}>{c}</button>
                ))}
              </div>
            )}
            {blind && !showChoices && (
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); submit(answer); }}>
                <input ref={inputRef} value={answer} onChange={(e) => setAnswer(e.target.value)} aria-label="Your answer"
                  placeholder={q.kind === "square" ? "A square, like e4" : q.kind === "number" ? "A number" : q.kind === "move" ? "A move, like Qg7" : "Your answer"}
                  autoCapitalize="off" autoCorrect="off" spellCheck={false} autoFocus
                  className={`min-h-12 min-w-0 flex-1 rounded-xl border ${T.cardBorder} bg-transparent px-3 text-base ${T.ink} ${focus}`} />
                <button type="submit" className="btn gold" style={{ minHeight: 48 }}>Answer</button>
              </form>
            )}
            {blind && CAN_LISTEN && (
              <button type="button" onClick={onMic} className={"btn " + (listening ? "gold" : "ghost")} style={{ minHeight: 48 }}>
                {listening ? "Listening… tap to stop" : "Say your answer"}
              </button>
            )}
            {verdict?.retry && <p role="alert" className={`m-0 text-sm ${T.accentText}`}>{verdict.retry}</p>}
          </>
        )}

        {answered && (
          <>
            <p className={`m-0 text-base font-bold ${verdict.correct ? "blindRight" : "blindWrong"}`}>{verdict.correct ? "Right!" : "Not quite."}</p>
            <p className={`m-0 text-sm leading-relaxed ${T.ink}`}>{verdict.explanation}</p>
            {blind && revealFor(q) && (showBoard ? (
              <TapBoard fen={revealFor(q)} coords pieceSetId={pieceSetId} colors={colors} disabled marks={q.about ? { [q.about.square]: "hint" } : {}} label="The position for this question" />
            ) : (
              <button type="button" onClick={() => setShowBoard(true)} className={`self-start border-0 bg-transparent p-0 py-1 text-sm font-bold underline ${T.interactiveText} ${focus}`}>Show the board</button>
            ))}
            <button type="button" className="btn gold" style={{ width: "100%" }} onClick={nextQuestion} autoFocus>
              {idx + 1 >= run.queue.length ? "See how you did" : "Next question"}
            </button>
          </>
        )}
        </div>
      </section>
    );
  };

  /* ---------------- the path ---------------- */
  const renderPath = () => (
    <>
      {back("Learn", onBack)}
      <section className={card + " flex flex-col gap-3 p-4"}>
        <h1 className="boxHead m-0">Blind Chess Trainer</h1>
        <p className={`m-0 text-sm leading-relaxed ${T.dimText}`}>
          Learn to see the board in your head. Each stage starts with a board to tap on, then an empty board, then no board at all. Get them right and you move on faster; miss some and you get more practice.
        </p>
        {streak > 0 && <p className={`m-0 text-sm font-bold ${T.ink}`}>{streak} {streak === 1 ? "day" : "days"} in a row</p>}
        <button type="button" className="btn gold" style={{ width: "100%" }} onClick={() => startStage(current)}>
          Continue: {stageName(current)}
        </button>
        <label className={`flex min-h-11 items-center justify-between gap-3 text-sm ${T.ink}`}>
          Read questions aloud (no-board steps)
          <button type="button" role="switch" aria-checked={voiceOn} aria-label="Read questions aloud" onClick={toggleVoice} className={"toggleSwitch" + (voiceOn ? " on" : "")}>
            <span className="toggleThumb" />
          </button>
        </label>
      </section>

      <section className="flex flex-col gap-2" aria-label="Your path">
        <button type="button" aria-expanded={pathOpen} onClick={() => setPathOpen((o) => !o)}
          className={`flex min-h-11 items-center justify-between gap-2 border-0 bg-transparent p-0 text-xs font-bold uppercase tracking-wider ${T.dimText} ${focus}`}>
          <span>Your path · {STAGES.filter((s) => training.path[s.id].done).length} of {STAGES.length} done</span>
          <span aria-hidden="true">{pathOpen ? "Hide ▲" : "Show ▼"}</span>
        </button>
        {STAGES.filter((s) => pathOpen || s.id === current).map((s) => {
          const i = STAGES.indexOf(s);
          const p = training.path[s.id];
          const isOpen = open.includes(s.id);
          const st = stepOf(training.path, s.id);
          const pct = p.done ? 100 : Math.round((p.step / s.steps.length) * 100);
          const status = p.done ? "Done" : !isOpen ? `Opens after ${STAGES[i - 1].name}` : `${VIEW_NAMES[st.view]} · step ${p.step + 1} of ${s.steps.length}`;
          return (
            <button key={s.id} type="button" disabled={!isOpen} onClick={() => startStage(s.id)}
              className={"pathStage" + (p.done ? " doneStage" : "") + (s.id === current && !p.done ? " current" : "")}
              aria-label={`${s.name}. ${status}`}>
              <span className="pathDot" aria-hidden="true">{p.done ? "✓" : isOpen ? i + 1 : "🔒"}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">{s.name}</span>
                <span className={`block text-xs ${T.dimText}`}>{isOpen ? s.desc : status}</span>
                {isOpen && <span className="pathBar" aria-hidden="true"><span style={{ width: `${pct}%` }} /></span>}
                {isOpen && <span className={`mt-1 block text-[11px] ${T.dimText}`}>{status}</span>}
              </span>
            </button>
          );
        })}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className={`m-0 text-xs font-bold uppercase tracking-wider ${T.dimText}`}>Play</h2>
        <button type="button" onClick={() => { speaker.prime(); setScreen("game"); }} className="pathStage">
          <span className="pathDot" aria-hidden="true">♞</span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">Play a full game by voice</span>
            <span className={`block text-xs ${T.dimText}`}>No board at all: say or type your moves against the bot.</span>
          </span>
        </button>
        <button type="button" onClick={() => { speaker.prime(); setScreen("puzzles"); }} className="pathStage">
          <span className="pathDot" aria-hidden="true">?</span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">Text puzzles with Zlegend2700</span>
            <span className={`block text-xs ${T.dimText}`}>Real puzzles read to you as a list of pieces. Type or say the move.</span>
          </span>
        </button>
      </section>
    </>
  );

  return (
    <div className="root">
      <StarField sweetheart={sweetheart} />
      {/* Wide on a laptop only while a question shows a board (the board
          then sits beside the question: App.css .trainerPage). */}
      <div className={"trainerPage relative z-10 flex flex-col gap-3" + (screen === "session" && q && !blind ? " wide" : "")}>
        {screen === "puzzles" ? (
          <>
            {back("Blind Chess Trainer", () => setScreen("home"))}
            <Suspense fallback={<p className={"m-0 text-sm " + T.dimText}>Loading…</p>}>
              <BlindPuzzles sweetheart={sweetheart} pieceSetId={pieceSetId} />
            </Suspense>
          </>
        ) : screen === "game" ? (
          <>
            {back("Blind Chess Trainer", () => setScreen("home"))}
            <div className={card + " p-4"}>
              <h1 className="boxHead m-0 mb-2">Play a full game by voice</h1>
              <Suspense fallback={<p className={"m-0 text-sm " + T.dimText}>Loading…</p>}>
                <BlindMode onClose={() => setScreen("home")} />
              </Suspense>
            </div>
          </>
        ) : screen === "session" && q ? (
          <>
            {back("Stop", () => { speaker.cancel(); recRef.current?.stop(); setScreen("home"); })}
            {renderQuestion()}
          </>
        ) : screen === "done" && outcome ? (
          <>
            {back("Blind Chess Trainer", () => setScreen("home"))}
            <section className={card + " flex flex-col gap-3 p-4"} role="status">
              <h1 className="boxHead m-0">{stageName(run.stageId)}</h1>
              <div className="qDots" aria-hidden="true">{results.map((r, i) => <span key={i} className={r ? "right" : "wrong"} />)}</div>
              <p className={`m-0 text-3xl font-bold ${T.ink}`}>{outcome.right} of {outcome.of} right</p>
              <p className={`m-0 text-base font-bold ${outcome.change === "down" || outcome.change === "same" ? T.ink : "blindRight"}`}>{CHANGE_TEXT[outcome.change]}</p>
              {outcome.change !== "done" && <p className={`m-0 text-sm ${T.dimText}`}>Next: {VIEW_NAMES[outcome.nextStep.view].toLowerCase()}.</p>}
              {outcome.opened.map((id) => <p key={id} className={`m-0 text-sm font-bold ${T.interactiveText}`}>New: {stageName(id)} is open.</p>)}
              {streak > 0 && <p className={`m-0 text-sm ${T.dimText}`}>{streak} {streak === 1 ? "day" : "days"} in a row.</p>}
              <button type="button" className="btn gold" style={{ width: "100%" }}
                onClick={() => startStage(outcome.change === "done" || outcome.opened.length ? nextStage(training.path) : run.stageId)}>
                {outcome.change === "done" || outcome.opened.length ? `Continue: ${stageName(nextStage(training.path))}` : "Keep going"}
              </button>
            </section>
          </>
        ) : renderPath()}
      </div>
    </div>
  );
}
