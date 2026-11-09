/* One Opening Trainer session on a board, with Coach Zlegend:
   - idea: a guided look at what the opening is after (notes' idea steps)
   - quiz: the main line; you find your moves
   - scenarios: the replies players at your level make, and the mistakes to
     punish; you find the answer
   - practice: a game against the bot, which replies the way players at the
     chosen level do, until the opening ends; then the plan from here
   - review: the moves you missed before, due today (spaced repetition)
   A wrong move can show its punishment: Stockfish's best answer, played
   out on the board. */
import { useEffect, useRef, useState } from "react";
import LessonBoard from "../LessonBoard";
import { mFrom, mTo, mPromo, M120TO64, M64TO120 } from "../../engine/chessEngine";
import { stockfishAnalyze } from "../../engine/stockfishEngine";
import { LEVELS, courseById } from "../../data/openingCourses";
import { NOTES } from "../../data/openingNotes";
import { getUiTheme } from "../../utils/uiTheme";
import { uciOf } from "../../utils/explainLine";
import {
  nodeAt, playerNode, keyOf, judgeMove, mainLine, scenarios, pickReply, replyShares,
  recordReview, reviewId, parseReviewId,
} from "../../utils/openingTrainer";
import { Coach, Tag, engineAt, loadCourseData, loadReviews, saveReviews, saveProgress, movesText } from "./shared";

const QUEEN = 5;
const STEP_MS = 650;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const TITLES = { idea: "The idea", quiz: "Quiz", scenarios: "Scenarios", practice: "Practice", review: "Daily review" };

export default function OpeningSession({ mode, course: startCourse, line: startLine, data: startData, level, reviewIds, sweetheart, pieceSetId, onExit }) {
  const T = getUiTheme(sweetheart);
  const focus = `focus-visible:outline-none focus-visible:ring-2 ${T.ring}`;
  const levelIdx = LEVELS.find((l) => l.id === level).band;
  const levelInfo = LEVELS.find((l) => l.id === level);

  /* In review the course changes from item to item. */
  const [course, setCourse] = useState(startCourse);
  const [line, setLine] = useState(startLine);
  const [data, setData] = useState(startData);
  const nodes = data?.lines[line?.id] ?? {};
  const notes = NOTES[course?.id] ?? {};
  const root = course ? course.root.split(" ") : [];

  const [moves, setMoves] = useState(root);
  const [selected, setSelected] = useState(null);
  const [arrows, setArrows] = useState([]);
  const [lastMove, setLastMove] = useState(null);
  const [coach, setCoach] = useState(null); // { text, tag }
  const [waiting, setWaiting] = useState(false); // the player's move is expected
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0); // idea step / quiz turn / scenario / review item
  const [total, setTotal] = useState(0);
  const [missed, setMissed] = useState(null); // { before, played, answer } after a wrong move
  const [done, setDone] = useState(null); // end card { title, text }
  const stats = useRef({ firstTry: 0, asked: 0, mistakes: 0 });
  const runRef = useRef(0); // bumps to cancel a running animation
  const lineRef = useRef(null); // quiz: the main line; scenarios: the list; review: ids
  const endRef = useRef(null); // the spot under the buttons, scrolled into view

  const eng = engineAt(moves) ?? engineAt(root);
  const playerWhite = course?.side === "white";
  const myTurn = eng && (eng.getSide() === 1) === playerWhite;

  /* ---- Board helpers ---- */
  const legalFrom = (sq64) => (waiting && eng ? eng.legalMoves().filter((m) => M120TO64[mFrom(m)] === sq64) : []);
  const targets = selected != null ? [...new Set(legalFrom(selected).map((m) => M120TO64[mTo(m)]))] : [];
  const arrowFor = (fromMoves, san, color) => {
    const e = engineAt(fromMoves);
    const m = e?.legalMoves().find((x) => e.sanOf(x) === san);
    return m === undefined ? null : { from: mFrom(m), to: mTo(m), color };
  };
  const showMove = (fromMoves, san) => {
    const e = engineAt(fromMoves);
    const m = e?.legalMoves().find((x) => e.sanOf(x) === san);
    setLastMove(m === undefined ? null : { from: mFrom(m), to: mTo(m) });
  };
  /** Plays `sans` on from `fromMoves`, one at a time. Stops if cancelled. */
  const animate = async (fromMoves, sans, { ms = STEP_MS } = {}) => {
    const run = ++runRef.current;
    let cur = [...fromMoves];
    for (const san of sans) {
      await wait(ms);
      if (run !== runRef.current) return null;
      showMove(cur, san);
      cur = [...cur, san];
      setMoves(cur);
    }
    return cur;
  };
  const cancel = () => { runRef.current++; };

  /* When there is something to press (Next, Try again, the end card), bring
     it into view; while it's your move, leave the board where it is. */
  useEffect(() => {
    if (!waiting && !busy && endRef.current) endRef.current.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [waiting, busy, missed, done]);

  /* ---- Starting each mode ---- */
  useEffect(() => {
    if (!course || !data) return;
    stats.current = { firstTry: 0, asked: 0, mistakes: 0 };
    if (mode === "idea") startIdea(0);
    if (mode === "quiz") startQuiz();
    if (mode === "scenarios") startScenario(0);
    if (mode === "practice") startPractice();
    return cancel;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, data, line?.id]);
  useEffect(() => {
    if (mode !== "review") return;
    lineRef.current = reviewIds ?? [];
    setTotal(lineRef.current.length);
    startReview(0);
    return cancel;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- The idea ---------------- */
  const ideaSteps = notes.idea ?? [];
  const startIdea = async (i) => {
    cancel();
    setStep(i);
    setTotal(ideaSteps.length);
    setWaiting(false);
    setArrows([]);
    setMissed(null);
    const s = ideaSteps[i];
    if (!s) {
      saveProgress(course.id, line.id, () => ({ idea: true }));
      setDone({ title: "That's the idea", text: notes.plan ?? notes.summary ?? "" });
      return;
    }
    const extra = s.moves ? s.moves.split(" ") : [];
    setMoves(root);
    setLastMove(null);
    setCoach({ text: s.text });
    const end = await animate(root, extra, { ms: 500 });
    if (end && s.arrows) setArrows(s.arrows.map(([a, b, c]) => ({ from: M64TO120[sqIndex(a)], to: M64TO120[sqIndex(b)], color: c ?? "#3EE7F5" })));
  };

  /* ---------------- Quiz ---------------- */
  const startQuiz = async () => {
    const lineMoves = mainLine(nodes, root, levelIdx);
    lineRef.current = lineMoves;
    const asked = lineMoves.slice(root.length).filter((_, j) => nodeAt(nodes, lineMoves.slice(0, root.length + j))?.p).length;
    setTotal(asked);
    setStep(0);
    setMoves(root);
    setLastMove(null);
    setArrows([]);
    setMissed(null);
    setDone(null);
    setCoach({ text: notes.quizIntro ?? `Play the ${line.name} the way the course does. I'll play the most common replies at your level.` });
    await advanceLine(root);
  };
  /* Plays the opponent's moves of the quiz line until it's your turn. */
  const advanceLine = async (from) => {
    const lineMoves = lineRef.current;
    let cur = from;
    const auto = [];
    while (cur.length + auto.length < lineMoves.length && !nodeAt(nodes, [...cur, ...auto])?.p) auto.push(lineMoves[cur.length + auto.length]);
    if (auto.length) {
      setBusy(true);
      cur = await animate(cur, auto);
      setBusy(false);
      if (!cur) return;
    }
    if (cur.length >= lineMoves.length || !nodeAt(nodes, cur)) {
      const { firstTry, asked } = stats.current;
      const pct = asked ? Math.round((firstTry / asked) * 100) : 100;
      saveProgress(course.id, line.id, (p) => ({ quiz: Math.max(p.quiz ?? 0, pct) }));
      setDone({ title: `Quiz done · ${pct}%`, text: `You found ${firstTry} of ${asked} moves on the first try. ${notes.plan ?? ""}` });
      return;
    }
    setWaiting(true);
  };

  /* ---------------- Scenarios ---------------- */
  const startScenario = async (i) => {
    cancel();
    const list = scenarios(nodes, root, levelIdx);
    lineRef.current = list;
    setTotal(list.length);
    setStep(i);
    setMissed(null);
    setArrows([]);
    setWaiting(false);
    const s = list[i];
    if (!s) {
      setDone({ title: "Scenarios done", text: notes.plan ?? "" });
      return;
    }
    setMoves(s.at);
    setLastMove(null);
    setCoach({ text: `${Math.round(s.share * 100)}% of players around ${levelInfo.rating.replace("≈ ", "")} play ${movesText([...s.at, s.reply], s.at.length)} here.` });
    setBusy(true);
    const cur = await animate(s.at, [s.reply], { ms: 700 });
    setBusy(false);
    if (!cur) return;
    const note = notes.moves?.[keyOf(cur)];
    const often = `${Math.round(s.share * 100)}% of players around ${levelInfo.rating.replace("≈ ", "")} play ${movesText([...s.at, s.reply], s.at.length)} here.`;
    setCoach({
      text: s.mistake
        ? `${often} ${note ?? `${s.reply} is a mistake.`} Find the move that punishes it.`
        : `${often} ${note ?? ""} What's your answer?`.replace("  ", " "),
      tag: s.mistake ? <Tag kind="bad">Mistake: punish it</Tag> : null,
    });
    setWaiting(true);
  };

  /* ---------------- Practice ---------------- */
  const startPractice = async () => {
    setMoves(root);
    setLastMove(null);
    setArrows([]);
    setMissed(null);
    setDone(null);
    setCoach({ text: `Play the ${line.name}. I'll answer the way players around ${levelInfo.rating.replace("≈ ", "")} do, until the opening is over.` });
    await botTurn(root);
  };
  const botTurn = async (cur) => {
    const node = nodeAt(nodes, cur);
    if (!node) return finishPractice(cur);
    if (node.p) { setWaiting(true); return; }
    const reply = pickReply(node, levelIdx);
    if (!reply) return finishPractice(cur);
    setBusy(true);
    const next = await animate(cur, [reply], { ms: 800 });
    setBusy(false);
    if (!next) return;
    const share = replyShares(node, levelIdx).find((r) => r.san === reply);
    const note = notes.moves?.[keyOf(next)];
    if (share?.mistake) setCoach({ text: `${note ?? `${reply} is a mistake.`} Can you punish it?`, tag: <Tag kind="bad">Their mistake</Tag> });
    else if (note) setCoach({ text: note });
    if (!playerNode(nodes, next)) return finishPractice(next);
    setWaiting(true);
  };
  const finishPractice = (cur) => {
    setWaiting(false);
    const { mistakes } = stats.current;
    if (!mistakes) saveProgress(course.id, line.id, (p) => ({ practice: { ...(p.practice ?? {}), [level]: true } }));
    setDone({
      title: mistakes ? "Opening over" : "Opening played cleanly",
      text: `${movesText(cur, root.length)}\n\nThat's where the opening ends. ${notes.plan ?? "From here, finish developing and follow the plans from the idea."}`,
    });
  };

  /* ---------------- Review ---------------- */
  const startReview = async (i) => {
    cancel();
    setStep(i);
    setMissed(null);
    setArrows([]);
    const id = lineRef.current[i];
    if (!id) { setDone({ title: "Review done", text: "Come back tomorrow for the next ones." }); return; }
    const { course: cId, line: lId, moves: at } = parseReviewId(id);
    const c = courseById(cId);
    const d = await loadCourseData(cId);
    if (!c || !d) { startReview(i + 1); return; }
    setCourse(c);
    setLine(c.lines.find((l) => l.id === lId) ?? c.lines[0]);
    setData(d);
    setMoves(at);
    setLastMove(null);
    setCoach({ text: `${c.name}: you missed this one before. What's the move?` });
    setWaiting(true);
  };

  /* ---------------- Your move ---------------- */
  const onSquare = (sq64) => {
    if (!waiting || busy || !eng || !myTurn) return;
    const piece = eng.pieceAt(sq64);
    const mine = piece !== 0 && (piece > 0) === playerWhite;
    if (selected != null && targets.includes(sq64)) {
      const m = legalFrom(selected).find((x) => M120TO64[mTo(x)] === sq64 && (!mPromo(x) || mPromo(x) === QUEEN));
      setSelected(null);
      if (m !== undefined) played(eng.sanOf(m));
      return;
    }
    setSelected(mine ? sq64 : null);
  };

  const played = async (san) => {
    setWaiting(false);
    setArrows([]);
    const before = moves;
    const node = playerNode(nodes, before);
    const verdict = judgeMove(node, san);
    const after = [...before, san];
    showMove(before, san);
    setMoves(after);
    const answer = node?.p?.rep;
    const firstTry = !missed;

    if (mode === "practice") {
      if (verdict === "book" || verdict === "good") {
        const note = notes.moves?.[keyOf(after)];
        setCoach({ text: note ?? (verdict === "book" ? "Book move." : `Also fine. The course plays ${answer}.`), tag: <Tag kind="good">{verdict === "book" ? "Book" : "Also good"}</Tag> });
        if (!nodeAt(nodes, after)) return finishPractice(after);
        await wait(250);
        return botTurn(after);
      }
      /* Off the course: is it actually bad? */
      setBusy(true);
      const loss = await lossOf(before, san, node);
      setBusy(false);
      if (loss < 60) {
        setCoach({ text: `${san} is playable, but it leaves the course. The course plays ${answer}.`, tag: <Tag kind="note">Off the book</Tag> });
        return finishPractice(after);
      }
      stats.current.mistakes++;
      setMissed({ before, played: san, answer });
      setCoach({ text: `${san} is a mistake here (about ${(loss / 100).toFixed(1)} pawns). The course plays ${answer}. ${notes.moves?.[keyOf([...before, answer])] ?? ""}`, tag: <Tag kind="bad">Mistake</Tag> });
      setArrows([arrowFor(before, answer, "#3EE7F5")].filter(Boolean));
      return;
    }

    /* Quiz, scenarios and review all want the course move. */
    if (verdict === "book" || (verdict === "good" && mode !== "review")) {
      if (firstTry) stats.current.firstTry++;
      stats.current.asked++;
      const items = recordReview(loadReviews(), reviewId(course.id, line.id, before), firstTry);
      saveReviews(items);
      const note = notes.moves?.[keyOf([...before, answer])];
      setCoach({ text: `${verdict === "good" ? `${san} is fine too, but the course plays ${answer}. ` : ""}${note ?? "That's the move."}`, tag: <Tag kind="good">{verdict === "book" ? "Correct" : "Also good"}</Tag> });
      setMissed(null);
      if (verdict === "good") {
        /* Keep to the course line. */
        await wait(900);
        showMove(before, answer);
        setMoves([...before, answer]);
      }
      const cur = [...before, answer];
      if (mode === "quiz") { setStep((s) => s + 1); await wait(700); return advanceLine(cur); }
      if (mode === "scenarios") {
        saveProgress(course.id, line.id, (p) => ({ scenarios: [...new Set([...(p.scenarios ?? []), keyOf(lineRef.current[step].at) + "|" + lineRef.current[step].reply])] }));
        const s = lineRef.current[step];
        if (s.mistake && s.punish?.length > 1 && s.punish[0] === answer) {
          setCoach({ text: `${note ?? "That's the move."} Here's how it goes on:`, tag: <Tag kind="good">Punished</Tag> });
          await animate(before, s.punish.slice(0, 5), { ms: 750 });
        }
        return;
      }
      if (mode === "review") return;
    }
    /* A miss. */
    setMissed({ before, played: san, answer });
    const items = recordReview(loadReviews(), reviewId(course.id, line.id, before), false);
    saveReviews(items);
    setCoach({ text: `Not quite. The move here is ${answer}. ${notes.moves?.[keyOf([...before, answer])] ?? ""}`, tag: <Tag kind="bad">You played {san}</Tag> });
    setArrows([arrowFor(before, answer, "#3EE7F5")].filter(Boolean));
  };

  /* How much a move gives away, in centipawns, from the mover's side,
     against the course move's score. */
  const lossOf = async (before, san, node) => {
    try {
      const e = engineAt([...before, san]);
      const { lines } = await stockfishAnalyze(e.fen(), { moveTimeMs: 600 });
      const after = -(lines[0]?.score ?? 0);
      let course = node?.p?.ev?.[node.p.rep];
      if (course === undefined) {
        /* No stored score (right after a mistake): ask about the position. */
        const best = await stockfishAnalyze(engineAt(before).fen(), { moveTimeMs: 600 });
        course = best.lines[0]?.score ?? after;
      }
      return course - after;
    } catch { return 0; }
  };

  /* Plays out Stockfish's best answer to the wrong move. */
  const showPunishment = async () => {
    if (!missed) return;
    setBusy(true);
    const e = engineAt([...missed.before, missed.played]);
    try {
      const { lines } = await stockfishAnalyze(e.fen(), { moveTimeMs: 700 });
      const pv = lines[0]?.pv ?? [];
      const sans = [];
      const walk = engineAt([...missed.before, missed.played]);
      for (const u of pv.slice(0, 5)) {
        const m = walk.legalMoves().find((x) => uciOf(x) === u);
        if (m === undefined) break;
        sans.push(walk.sanOf(m));
        walk.make(m);
      }
      setArrows([]);
      setCoach({ text: `Watch what the best reply does after ${missed.played}.`, tag: <Tag kind="bad">The punishment</Tag> });
      await animate([...missed.before, missed.played], sans, { ms: 800 });
      setCoach({ text: `That's why ${missed.answer} is the move. Try it.` });
    } finally {
      setBusy(false);
    }
  };

  const tryAgain = () => {
    if (!missed) return;
    cancel();
    setMoves(missed.before);
    setLastMove(null);
    setArrows([]);
    setCoach((c) => ({ ...c, tag: null }));
    setWaiting(true);
    if (mode === "practice") stats.current.mistakes = Math.max(0, stats.current.mistakes);
  };

  const next = () => {
    if (mode === "idea") return startIdea(step + 1);
    if (mode === "scenarios") return startScenario(step + 1);
    if (mode === "review") return startReview(step + 1);
  };

  if (!course || !data) return <p className={`m-0 text-sm ${T.dimText}`}>Loading…</p>;

  const showNext = !waiting && !busy && !missed && !done && (mode === "idea" || mode === "scenarios" || mode === "review") && coach;
  const dots = Math.min(total, 12);
  return (
    <div className="flex w-full max-w-md flex-col gap-3">
      <button onClick={onExit} className={`self-start border-0 bg-transparent p-0 text-sm font-bold ${T.dimText} ${focus}`}>← {course.name}</button>
      <div className="flex items-center justify-between gap-3">
        <h2 className={`m-0 text-[17px] ${T.ink}`} style={{ fontFamily: "var(--font-display)" }}>
          {TITLES[mode]}{total > 0 && mode !== "practice" ? ` · ${Math.min(step + 1, total)} of ${total}` : ""}
        </h2>
        {dots > 0 && mode !== "practice" && (
          <div className="flex gap-1" aria-hidden="true">
            {Array.from({ length: dots }, (_, i) => <i key={i} className={`h-1.5 w-4 rounded-full ${i < step ? "bg-cyan" : i === step ? "bg-yellow" : "bg-white/15"}`} />)}
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,.45)]">
        <LessonBoard eng={eng} orientation={course.side} selected={selected} targets={targets} lastMove={lastMove} onSquare={onSquare} pieceSetId={pieceSetId} arrows={arrows} />
      </div>

      {done ? (
        <section className={`rounded-2xl border p-4 ${T.cardBorder} ${T.panelBg}`}>
          <h3 className={`m-0 text-lg ${T.ink}`} style={{ fontFamily: "var(--font-display)" }}>{done.title}</h3>
          <p className={`m-0 mt-2 whitespace-pre-line text-[15px] leading-relaxed ${T.ink}`}>{done.text}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button className="btn ghost" onClick={() => { setDone(null); if (mode === "quiz") startQuiz(); else if (mode === "practice") startPractice(); else if (mode === "scenarios") startScenario(0); else if (mode === "idea") startIdea(0); else onExit(); }}>Again</button>
            <button className="btn gold" onClick={onExit}>Done</button>
          </div>
        </section>
      ) : coach && (
        <Coach T={T} tag={coach.tag}>{coach.text}</Coach>
      )}

      {missed && !done && (
        <div className="grid grid-cols-2 gap-2">
          <button onClick={showPunishment} disabled={busy} className={`rounded-xl border border-[#ff4c5b]/50 bg-black/25 px-3 py-2.5 text-sm font-bold text-[#ffb3ba] disabled:opacity-50 ${focus}`}>Show the punishment</button>
          <button onClick={tryAgain} disabled={busy} className={`rounded-xl border px-3 py-2.5 text-sm font-bold ${T.cardBorder} bg-black/25 ${T.ink} disabled:opacity-50 ${focus}`}>Try again</button>
        </div>
      )}
      {showNext && (
        <button className="btn gold" style={{ width: "100%" }} onClick={next}>
          {mode === "idea" ? (step + 1 >= total ? "Finish" : "Next") : "Next"}
        </button>
      )}
      {/* Keeps the buttons in view on short screens (clear of the bottom bar). */}
      <div ref={endRef} style={{ scrollMarginBottom: 96 }} aria-hidden="true" />
    </div>
  );
}

const sqIndex = (name) => (Number(name[1]) - 1) * 8 + "abcdefgh".indexOf(name[0]);
