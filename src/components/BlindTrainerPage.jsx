/* The Blind Chess Trainer (/blind, in Learn): boardless drills for
   players up to about 1000 (BLIND_TRAINER_PLAN.md), and the full voice
   game (BlindMode) as one of the choices. Questions can be answered by
   tapping, typing or speaking; they're read aloud if the player wants.
   No AI: questions and explanations come from blindDrills.js. */
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import StarField from "./StarField";
import MiniBoard from "./MiniBoard";
import { getUiTheme } from "../utils/uiTheme";
import { getPieceSet } from "../utils/pieceSets";
import { getBoardColor } from "../utils/boardColors";
import { loadSetting, saveSetting } from "../utils/storage";
import { DRILLS, makeQuestion, recordAnswer, MAX_LEVEL } from "../utils/blindDrills";
import { loadTraining, saveTraining, bumpStreak, liveStreak } from "../utils/blindTrainerStore";
import { syncTraining } from "../utils/blindTrainerSync";
import { createSpeaker, createRecognizer } from "../utils/speech";
import { track } from "../utils/track";

const BlindMode = lazy(() => import("./BlindMode"));

const SESSION = 5;
const INSTALLED_IPHONE = typeof window !== "undefined" && /iPhone|iPad|iPod/.test(navigator.userAgent)
  && (window.navigator.standalone === true || window.matchMedia?.("(display-mode: standalone)").matches);
const CAN_LISTEN = typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition) && !INSTALLED_IPHONE;

/* A FEN with one piece (e.g. "N") on one square, for showing reach. */
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

export default function BlindTrainerPage({ onBack, sweetheart, pieceSetId = "classic", startScreen = "home", session: authSession }) {
  const T = getUiTheme(sweetheart);
  const focus = `focus-visible:outline-none focus-visible:ring-2 ${T.ring}`;
  const [screen, setScreen] = useState(startScreen); // home | session | done | game
  const [training, setTraining] = useState(loadTraining);
  const [voiceOn, setVoiceOn] = useState(() => !!loadSetting("blindTrainerVoice", false));
  const [drill, setDrill] = useState(null); // null = mixed
  const [queue, setQueue] = useState([]);
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [verdict, setVerdict] = useState(null); // { correct, explanation } | { retry }
  const [results, setResults] = useState([]);
  const [showBoard, setShowBoard] = useState(false);
  const [listening, setListening] = useState(false);
  const startLevels = useRef({});
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
  /* Leaving the app stops the voice. */
  useEffect(() => {
    const off = () => { if (document.hidden) { recRef.current?.stop(); speaker.cancel(); } };
    document.addEventListener("visibilitychange", off);
    return () => document.removeEventListener("visibilitychange", off);
  }, [speaker]);

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

  const q = queue[idx] || null;

  /* Called from a tap, so the first spoken sentence is allowed on phones. */
  const startSession = (drillId) => {
    speaker.prime();
    const ids = drillId ? [drillId] : DRILLS.map((d) => d.id);
    const list = Array.from({ length: SESSION }, (_, i) => {
      const id = drillId || ids[(i + Math.floor(Math.random() * ids.length)) % ids.length];
      return makeQuestion(id, training.drills[id].level);
    });
    startLevels.current = Object.fromEntries(DRILLS.map((d) => [d.id, training.drills[d.id].level]));
    setDrill(drillId);
    setQueue(list);
    setIdx(0);
    setResults([]);
    setAnswer("");
    setVerdict(null);
    setShowBoard(false);
    setScreen("session");
    say(list[0].spoken);
    track("blind_drill_start", { drill: drillId || "mixed" });
  };

  const submit = (text) => {
    if (!q || (verdict && !verdict.retry)) return;
    const r = q.check(text);
    if (!r.understood) {
      const hint = r.retry || RETRY[q.kind];
      /* A move that isn't possible was understood; anything else wasn't. */
      setVerdict({ retry: r.retry ? `"${String(text).trim()}": ${hint}` : `I didn't understand "${String(text).trim()}". ${hint}` });
      say(hint);
      return;
    }
    const next = { ...training, drills: recordAnswer(training.drills, q.drill, r.correct), streak: bumpStreak(training.streak) };
    setTraining(next);
    saveTraining(next);
    setResults((list) => [...list, { drill: q.drill, correct: r.correct }]);
    setVerdict({ correct: r.correct, explanation: r.explanation });
    say(`${r.correct ? "Right." : "Not quite."} ${r.explanation}`);
  };
  submitRef.current = submit;

  const nextQuestion = () => {
    speaker.prime();
    if (idx + 1 >= queue.length) {
      setScreen("done");
      syncTraining(training).then((merged) => { if (merged) { setTraining(merged); saveTraining(merged); } });
      const right = results.filter((x) => x.correct).length;
      say(`Done. ${right} out of ${queue.length} right.`);
      track("blind_drill_done", { drill: drill || "mixed", right, of: queue.length });
      return;
    }
    const n = idx + 1;
    setIdx(n);
    setAnswer("");
    setVerdict(null);
    setShowBoard(false);
    say(queue[n].spoken);
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
  const pieceImgSrc = (type, isWhite) => getPieceSet(pieceSetId).svgUrl(type, isWhite);
  const streak = liveStreak(training.streak);
  const card = `rounded-2xl border ${T.cardBorder} ${T.panelBg} backdrop-blur-sm`;
  const row = `flex w-full items-center justify-between gap-3 rounded-xl border ${T.cardBorder} ${T.panelBg} p-3 text-left backdrop-blur-sm transition-colors ${focus}`;
  const back = (label, go) => (
    <button type="button" onClick={go} className={`mb-2 inline-flex h-11 items-center gap-1.5 self-start border-0 bg-transparent text-sm font-bold ${T.dimText} ${T.hoverInk} ${focus}`}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" /></svg>
      {label}
    </button>
  );

  /* A board for the answer: the position after the moves, or a piece on
     the square for reach questions, with the square marked. */
  const boardFor = (qq) => {
    if (qq.fen) return { fen: qq.fen, marks: qq.about ? [qq.about.square] : [] };
    const sqs = (qq.prompt.match(/\b[a-h][1-8]\b/g) || []);
    if (qq.drill === "reach" && sqs[0]) return { fen: loneFen(/bishop/.test(qq.prompt) ? "B" : "N", sqs[0]), marks: [] };
    return { fen: "8/8/8/8/8/8/8/8 w - - 0 1", marks: sqs };
  };

  return (
    <div className="root">
      <StarField sweetheart={sweetheart} />
      <div className="relative z-10 flex w-full max-w-md flex-col gap-3">
        {screen === "game" ? (
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
            <section className={card + " flex flex-col gap-3 p-4"} aria-live="polite">
              <p className={`m-0 text-xs font-bold uppercase tracking-wider ${T.dimText}`}>
                Question {idx + 1} of {queue.length} · {DRILLS.find((d) => d.id === q.drill).name} · Level {q.level}
              </p>
              <p className={`m-0 text-lg font-bold leading-snug ${T.ink}`}>{q.prompt}</p>
              {voiceOn && <button type="button" onClick={() => { speaker.prime(); speaker.cancel(); speaker.speak(q.spoken); }} className={`self-start border-0 bg-transparent p-0 py-1 text-sm font-bold underline ${T.interactiveText} ${focus}`}>Hear it again</button>}

              {!verdict || verdict.retry ? (
                <>
                  {q.choices ? (
                    <div className="grid grid-cols-2 gap-2">
                      {q.choices.map((c, i) => (
                        <button key={c} type="button" onClick={() => submit(q.kind === "choice" ? String(i + 1) : c)}
                          className={`min-h-12 rounded-xl border ${T.cardBorder} bg-transparent px-3 text-sm font-bold ${T.ink} ${focus}`}>{c}</button>
                      ))}
                    </div>
                  ) : (
                    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); submit(answer); }}>
                      <input ref={inputRef} value={answer} onChange={(e) => setAnswer(e.target.value)} aria-label="Your answer"
                        placeholder={q.kind === "square" ? "A square, like e4" : q.kind === "number" ? "A number" : q.kind === "move" ? "A move, like Qg7" : "Your answer"}
                        autoCapitalize="off" autoCorrect="off" spellCheck={false} autoFocus
                        className={`min-h-12 min-w-0 flex-1 rounded-xl border ${T.cardBorder} bg-transparent px-3 text-base ${T.ink} ${focus}`} />
                      <button type="submit" className="btn gold" style={{ minHeight: 48 }}>Answer</button>
                    </form>
                  )}
                  {CAN_LISTEN && (
                    <button type="button" onClick={onMic} className={"btn " + (listening ? "gold" : "ghost")} style={{ minHeight: 48 }}>
                      {listening ? "Listening… tap to stop" : "Say your answer"}
                    </button>
                  )}
                  {verdict?.retry && <p role="alert" className={`m-0 text-sm ${T.accentText}`}>{verdict.retry}</p>}
                </>
              ) : (
                <>
                  <p className={`m-0 text-base font-bold ${verdict.correct ? "blindRight" : "blindWrong"}`}>{verdict.correct ? "Right!" : "Not quite."}</p>
                  <p className={`m-0 text-sm leading-relaxed ${T.ink}`}>{verdict.explanation}</p>
                  {showBoard ? (
                    <div className="flex justify-center">
                      <MiniBoard {...boardFor(q)} flipped={false} colors={colors} pieceImgSrc={pieceImgSrc} size={232} label="The position for this question" />
                    </div>
                  ) : (
                    <button type="button" onClick={() => setShowBoard(true)} className={`self-start border-0 bg-transparent p-0 py-1 text-sm font-bold underline ${T.interactiveText} ${focus}`}>Show the board</button>
                  )}
                  <button type="button" className="btn gold" style={{ width: "100%" }} onClick={nextQuestion} autoFocus>
                    {idx + 1 >= queue.length ? "See how you did" : "Next question"}
                  </button>
                </>
              )}
            </section>
          </>
        ) : screen === "done" ? (
          <>
            {back("Blind Chess Trainer", () => setScreen("home"))}
            <section className={card + " flex flex-col gap-3 p-4"}>
              <h1 className="boxHead m-0">Done</h1>
              <p className={`m-0 text-3xl font-bold ${T.ink}`}>{results.filter((x) => x.correct).length} of {results.length} right</p>
              {DRILLS.filter((d) => results.some((x) => x.drill === d.id)).map((d) => {
                const before = startLevels.current[d.id], now = training.drills[d.id].level;
                return (
                  <p key={d.id} className={`m-0 text-sm ${T.dimText}`}>
                    {d.name}: level {now}{now > before ? " (up!)" : now < before ? " (down, it'll come back)" : ""}
                  </p>
                );
              })}
              {streak > 0 && <p className={`m-0 text-sm ${T.ink}`}>{streak} {streak === 1 ? "day" : "days"} in a row.</p>}
              <button type="button" className="btn gold" style={{ width: "100%" }} onClick={() => startSession(drill)}>Practice again</button>
            </section>
          </>
        ) : (
          <>
            {back("Learn", onBack)}
            <section className={card + " flex flex-col gap-3 p-4"}>
              <h1 className="boxHead m-0">Blind Chess Trainer</h1>
              <p className={`m-0 text-sm leading-relaxed ${T.dimText}`}>
                Train your mind&apos;s eye: follow moves, find pieces and picture squares without looking at a board. A minute a day makes the board easier to see in your head, in your own games too.
              </p>
              {streak > 0 && <p className={`m-0 text-sm font-bold ${T.ink}`}>{streak} {streak === 1 ? "day" : "days"} in a row</p>}
              <button type="button" className="btn gold" style={{ width: "100%" }} onClick={() => startSession(null)}>Practice ({SESSION} questions)</button>
              <label className={`flex min-h-11 items-center justify-between gap-3 text-sm ${T.ink}`}>
                Read questions aloud
                <button type="button" role="switch" aria-checked={voiceOn} aria-label="Read questions aloud" onClick={toggleVoice} className={"toggleSwitch" + (voiceOn ? " on" : "")}>
                  <span className="toggleThumb" />
                </button>
              </label>
            </section>

            {[["see", "Seeing the board"], ["tactics", "Tactics without a board"]].map(([group, title]) => (
            <section key={group} className="flex flex-col gap-2">
              <h2 className={`m-0 text-xs font-bold uppercase tracking-wider ${T.dimText}`}>{title}</h2>
              {DRILLS.filter((d) => d.group === group).map((d) => {
                const p = training.drills[d.id];
                const acc = p.answered ? Math.round((p.correct / p.answered) * 100) : null;
                return (
                  <button key={d.id} type="button" onClick={() => startSession(d.id)} className={row}>
                    <span className="min-w-0">
                      <span className={`block text-sm font-bold ${T.ink}`}>{d.name}</span>
                      <span className={`block text-xs ${T.dimText}`}>{d.desc}</span>
                    </span>
                    <span className={`shrink-0 text-right text-xs ${T.dimText}`}>
                      <span className={`block font-bold ${T.interactiveText}`}>Level {p.level}{p.level === MAX_LEVEL ? " (top)" : ""}</span>
                      {acc != null && <span className="block">{acc}% right</span>}
                    </span>
                  </button>
                );
              })}
            </section>
            ))}

            <section className="flex flex-col gap-2">
              <h2 className={`m-0 text-xs font-bold uppercase tracking-wider ${T.dimText}`}>Play</h2>
              <button type="button" onClick={() => { speaker.prime(); setScreen("game"); }} className={row}>
                <span className="min-w-0">
                  <span className={`block text-sm font-bold ${T.ink}`}>Play a full game by voice</span>
                  <span className={`block text-xs ${T.dimText}`}>No board at all: say or type your moves against the bot.</span>
                </span>
              </button>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
