/* Owl's Opening Camp: the main app's Opening Trainer, sized for a child.
   A course page with four steps and the Memory Game:
   - Owl's Story: the idea in a few board pictures with arrows.
   - Copycat: play the course's moves while the other side plays the reply
     kids meet most; a miss gets a gentle hint and comes back later.
   - What If?: cards for the other common replies and the traps, each to
     answer on the board; a trap's punishment plays out after.
   - Practice Match: against Bunny, Cat or Dog, who reply the way real
     players at about 800, 1000 and 1300 do, until the opening is over.
   - Memory Game (startMode "memory"): the moves she missed, due today. */
import { useEffect, useMemo, useRef, useState } from "react";
import { createEngine, M120TO64, mFrom, mTo, mPromo, WQ } from "../src/engine/chessEngine";
import { judgeMove } from "../src/utils/openingTrainer";
import { AnimalIcon } from "./AnimalIcon";
import KidBoard from "./KidBoard";
import { KID_COURSES, kidCourseById } from "./kidOpeningCourses";
import { CAMP_NOTES } from "./kidCampNotes";
import {
  CAMP_TREES, CAMP_OPPONENTS, kidMainLine, kidScenarios, kidPick, kidShares, inTen, playerNode, nodeAt,
  keyOf, parseReviewId, courseState, updateCourse, rememberMove, dueMoves,
} from "./kidCamp";

const STEP_MS = 650;
/* After this many misses on one move the piece glows; after more, an arrow. */
const GLOW_AFTER = 2, ARROW_AFTER = 3;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const sq64 = (name) => (Number(name[1]) - 1) * 8 + "abcdefgh".indexOf(name[0]);

function engineAt(moves) {
  const eng = createEngine();
  for (const san of moves) {
    const m = eng.legalMoves().find((x) => eng.sanOf(x) === san);
    if (m === undefined) break;
    eng.make(m);
  }
  return eng;
}
/** The from and to squares (0..63) of `san` played after `moves`. */
function squaresOf(moves, san) {
  const eng = engineAt(moves);
  const m = eng.legalMoves().find((x) => eng.sanOf(x) === san);
  return m === undefined ? null : { from: M120TO64[mFrom(m)], to: M120TO64[mTo(m)] };
}
/** "1.e4 e5 2.Nc3", from ply `from` on, with the real move numbers. */
function movesText(moves, from = 0) {
  let out = "";
  for (let i = from; i < moves.length; i++) {
    const n = Math.floor(i / 2) + 1;
    out += (i % 2 === 0 ? `${n}.` : i === from ? `${n}…` : "") + moves[i] + " ";
  }
  return out.trim();
}

export default function OpeningCamp({ courseId: startCourse = null, startMode = "hub", camp, setCamp, renderPiece, boardVars, audio, log, onExit }) {
  const [courseId, setCourseId] = useState(startCourse ?? KID_COURSES[0].id);
  const course = kidCourseById(courseId);
  const nodes = CAMP_TREES[courseId];
  const root = useMemo(() => course.root.split(" "), [course]);
  const notes = CAMP_NOTES[courseId];
  const playerWhite = course.side === "white";
  const scenarios = useMemo(() => kidScenarios(nodes, root), [nodes, root]);
  const line = useMemo(() => kidMainLine(nodes, root), [nodes, root]);
  const progress = courseState(camp, courseId);

  const [mode, setMode] = useState(startMode);
  const [moves, setMoves] = useState(root);
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState(-1);
  const [arrows, setArrows] = useState([]);
  const [glow, setGlow] = useState([]);
  const [coach, setCoach] = useState({ text: "", mood: undefined });
  const [waiting, setWaiting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null); // { title, text, next? }
  const [shake, setShake] = useState(false);
  const [wrongSq, setWrongSq] = useState(-1);
  const [oppIdx, setOppIdx] = useState(1);
  const [cardDone, setCardDone] = useState(false);
  const missRef = useRef({ here: 0, total: 0 });
  const runRef = useRef(0);
  const listRef = useRef([]); // memory: the review ids being played
  useEffect(() => () => { runRef.current++; }, []);

  const eng = useMemo(() => engineAt(moves), [moves]);
  const lastMove = useMemo(() => (moves.length ? squaresOf(moves.slice(0, -1), moves[moves.length - 1]) : null), [moves]);
  const myTurn = (eng.getSide() === 1) === playerWhite;
  const legalFrom = (i) => eng.legalMoves().filter((m) => M120TO64[mFrom(m)] === i);
  const targets = selected >= 0 && waiting ? [...new Set(legalFrom(selected).map((m) => M120TO64[mTo(m)]))] : [];

  const say = (text, mood) => setCoach({ text, mood });
  const reset = () => { runRef.current++; setSelected(-1); setArrows([]); setGlow([]); setDone(null); setWaiting(false); setBusy(false); setCardDone(false); missRef.current = { here: 0, total: 0 }; };
  /** Plays `sans` one by one after `from`; false if interrupted. */
  const animate = async (from, sans, ms = STEP_MS) => {
    const run = ++runRef.current;
    let cur = from;
    setMoves(cur);
    for (const san of sans) {
      await wait(ms);
      if (run !== runRef.current) return null;
      cur = [...cur, san];
      setMoves(cur);
      audio?.sfxMove?.();
    }
    return cur;
  };
  const finishStep = (id, stars) => log?.({ type: "level", id: `${courseId}:${id}`, stars });

  /* ---------------- Owl's Story ---------------- */
  const showStory = (i) => {
    reset();
    const s = notes.story[i];
    if (!s) {
      setCamp((c) => updateCourse(c, courseId, () => ({ story: true })));
      finishStep("story", 3);
      setDone({ title: "Story done! ⭐", text: notes.plan, next: "copycat" });
      return;
    }
    setMode("story");
    setStep(i);
    const at = [...root, ...(s.moves ? s.moves.split(" ") : [])];
    setMoves(at);
    setArrows(s.arrows.map(([a, b, c]) => [sq64(a), sq64(b), c]));
    say(s.text);
  };

  /* ---------------- Copycat ---------------- */
  const startCopycat = async () => {
    reset();
    setMode("copycat");
    say(`Let's play ${course.name} together! You play ${playerWhite ? "White" : "Black"}. I'll show you the other side's moves.`);
    await continueLine(root);
  };
  /** Plays the other side's moves along the line until it's her turn. */
  const continueLine = async (from) => {
    let cur = from;
    while (cur.length < line.length && !nodeAt(nodes, cur)?.p) {
      setBusy(true);
      cur = await animate(cur, [line[cur.length]]);
      setBusy(false);
      if (!cur) return;
      const note = notes.notes[keyOf(cur)];
      if (note) say(note);
    }
    if (cur.length >= line.length || !nodeAt(nodes, cur)) {
      const stars = missRef.current.total === 0 ? 3 : missRef.current.total <= 2 ? 2 : 1;
      setCamp((c) => updateCourse(c, courseId, (p) => ({ copycat: Math.max(p.copycat, stars) })));
      finishStep("copycat", stars);
      setDone({ title: `Copycat done! ${"⭐".repeat(stars)}`, text: notes.plan, next: "whatif" });
      return;
    }
    missRef.current.here = 0;
    setWaiting(true);
  };

  /* ---------------- What If? ---------------- */
  const startCard = async (i) => {
    reset();
    setMode("whatif");
    setStep(i);
    const s = scenarios[i];
    say(`${inTen(s.share)} in 10 kids play ${s.reply} here. Watch!`);
    setBusy(true);
    const cur = await animate(s.at, [s.reply]);
    setBusy(false);
    if (!cur) return;
    const note = notes.notes[keyOf(cur)];
    say(s.mistake ? `${note ?? `${s.reply} is a mistake!`} Can you catch them out?` : `${note ?? "A different move!"} What's your answer?`, s.mistake ? "happy" : undefined);
    setWaiting(true);
  };

  /* ---------------- Practice Match ---------------- */
  const startPractice = async (idx) => {
    reset();
    setMode("practice");
    setOppIdx(idx);
    say(`Play ${course.name} against ${CAMP_OPPONENTS[idx].label}! They play like real kids. Let's see how far you get.`);
    await botTurn(root, idx);
  };
  const botTurn = async (cur, idx = oppIdx) => {
    const node = nodeAt(nodes, cur);
    if (!node) return finishPractice(cur, idx);
    if (node.p) { missRef.current.here = 0; setWaiting(true); return; }
    const reply = kidPick(node, CAMP_OPPONENTS[idx].weights);
    if (!reply) return finishPractice(cur, idx);
    setBusy(true);
    const next = await animate(cur, [reply], 800);
    setBusy(false);
    if (!next) return;
    const share = kidShares(node, CAMP_OPPONENTS[idx].weights).find((r) => r.san === reply);
    const note = notes.notes[keyOf(next)];
    if (share?.mistake) say(`${note ?? `${reply} is a mistake!`} Catch them out!`, "happy");
    else if (note) say(note);
    if (!playerNode(nodes, next)) return finishPractice(next, idx);
    missRef.current.here = 0;
    setWaiting(true);
  };
  const finishPractice = (cur, idx = oppIdx) => {
    setWaiting(false);
    const clean = missRef.current.total === 0;
    const opp = CAMP_OPPONENTS[idx];
    if (clean) setCamp((c) => updateCourse(c, courseId, (p) => ({ practice: { ...p.practice, [opp.id]: true } })));
    finishStep(`practice-${opp.id}`, clean ? 3 : 2);
    setDone({
      title: clean ? `Perfect opening against ${opp.label}! ⭐⭐⭐` : `Opening done against ${opp.label}!`,
      text: `${movesText(cur)}\n\nThe opening is over. ${notes.plan}`,
      next: "practice",
    });
  };

  /* ---------------- Memory Game ---------------- */
  const startMemory = (i) => {
    reset();
    setMode("memory");
    setStep(i);
    if (i === 0) listRef.current = dueMoves(camp);
    const id = listRef.current[i];
    if (!id) {
      setDone({ title: i ? "Memory Game done! 🧠" : "Nothing to remember today!", text: i ? "Those moves will come back on another day, so they stick." : "Come back tomorrow, or play a camp step to add more." });
      if (i) log?.({ type: "level", id: "memory", stars: 3 });
      return;
    }
    const { course: c, moves: at } = parseReviewId(id);
    if (c !== courseId) setCourseId(c);
    setMoves(at);
    say(`${kidCourseById(c)?.name ?? "Camp"}: what's your move here?`);
    setWaiting(true);
  };

  useEffect(() => {
    if (startMode === "memory") startMemory(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- Her move ---------------- */
  const onSquare = (i) => {
    if (!waiting || busy || !myTurn) return;
    if (selected >= 0 && targets.includes(i)) {
      const m = legalFrom(selected).find((x) => M120TO64[mTo(x)] === i && (!mPromo(x) || mPromo(x) === WQ));
      setSelected(-1);
      if (m !== undefined) played(eng.sanOf(m));
      return;
    }
    const p = eng.pieceAt(i);
    setSelected(p !== 0 && (p > 0) === playerWhite ? i : -1);
  };

  const missed = (before, san, answer) => {
    audio?.sfxWrong?.();
    missRef.current.here++;
    missRef.current.total++;
    setShake(true);
    setTimeout(() => setShake(false), 400);
    const sq = squaresOf(before, san);
    if (sq) { setWrongSq(sq.to); setTimeout(() => setWrongSq(-1), 800); }
    setCamp((c) => rememberMove(c, courseId, before, false));
    setMoves(before);
    const hint = squaresOf(before, answer);
    const n = missRef.current.here;
    if (hint && n >= GLOW_AFTER) setGlow([hint.from]);
    if (hint && n >= ARROW_AFTER) setArrows([[hint.from, hint.to, "#4F9E6E"]]);
    say(n >= ARROW_AFTER ? `Follow the arrow: ${answer}!` : n >= GLOW_AFTER ? "See the glowing piece? That's the one to move." : "Not quite! Have another go.", "sad");
    setWaiting(true);
  };

  const played = async (san) => {
    setWaiting(false);
    const before = moves;
    const node = playerNode(nodes, before);
    const answer = node?.p?.rep;
    const verdict = judgeMove(node, san);
    if (mode === "memory" && verdict === "good") {
      /* Not the camp's move: it comes back tomorrow, like a miss. */
      missRef.current.here++;
      setCamp((c) => rememberMove(c, courseId, before, false));
      say(`${san} is a good move too! But in camp we play another one. Can you find it?`);
      setWaiting(true);
      return;
    }
    if (verdict === "off") {
      setMoves([...before, san]);
      await wait(350);
      return missed(before, san, answer);
    }
    setArrows([]);
    setGlow([]);
    if (missRef.current.here === 0) setCamp((c) => rememberMove(c, courseId, before, true));
    audio?.sfxMove?.();
    /* Another good move is fine, but the camp keeps to its own line. */
    const after = [...before, answer];
    setMoves([...before, san]);
    const note = notes.notes[keyOf(after)];
    if (verdict === "good") {
      say(`${san} is good too! In camp we play ${answer}.`, "happy");
      await wait(1100);
      setMoves(after);
    } else {
      say(note ?? "Yes! That's the move.", "happy");
    }
    if (mode === "copycat") { await wait(500); return continueLine(after); }
    if (mode === "practice") { await wait(400); return botTurn(after); }
    if (mode === "memory") { await wait(900); return startMemory(step + 1); }
    if (mode === "whatif") {
      const s = scenarios[step];
      setCamp((c) => updateCourse(c, courseId, (p) => ({ whatIf: [...new Set([...p.whatIf, s.key])] })));
      finishStep(`whatif-${step}`, 3);
      if (s.mistake && s.punish?.length > 1 && s.punish[0] === answer) {
        say(`${note ?? "Got them!"} Watch how it goes on:`, "happy");
        setBusy(true);
        await animate(after, s.punish.slice(1, 5), 800);
        setBusy(false);
      }
      setCardDone(true);
    }
  };

  /* ---------------- Screens ---------------- */
  const startStep = (id) => {
    if (id === "story") showStory(0);
    else if (id === "copycat") startCopycat();
    else if (id === "whatif") { reset(); setMode("whatif-list"); }
    else if (id === "practice") { reset(); setMode("hub"); }
  };
  const header = (back, title) => (
    <div className="khTop">
      <button className="khBack" onClick={back}>← {title}</button>
      <span className="khChip">{course.emoji} {course.name}</span>
    </div>
  );
  const owl = (
    <div className="kcOwl">
      <AnimalIcon kind="Owl" size={56} mood={coach.mood} />
      <div className="khBubble">{coach.text}</div>
    </div>
  );
  const toHub = () => { reset(); setMode("hub"); };

  if (done) {
    return (
      <div className="khRoot">
        {header(mode === "memory" ? onExit : toHub, mode === "memory" ? "Back" : "Camp")}
        <div className="kcDone">
          <AnimalIcon kind="Owl" size={90} mood="happy" />
          <h2 className="khTitle">{done.title}</h2>
          <p className="kcDoneText">{done.text}</p>
          {done.next && done.next !== "practice" && <button className="khBig khMint" onClick={() => startStep(done.next)}>Next: {done.next === "copycat" ? "Copycat 🐒" : "What If? ❓"}</button>}
          <button className="khBig khWhite" onClick={mode === "memory" ? onExit : toHub}>{mode === "memory" ? "Back" : "Back to camp"}</button>
        </div>
      </div>
    );
  }

  if (mode === "hub") {
    const whatIfDone = progress.whatIf.filter((k) => scenarios.some((s) => s.key === k)).length;
    const stepRow = (id, icon, bg, title, sub, right, onClick, locked) => (
      <button key={id} className={"kcStep" + (locked ? " kcLocked" : "")} onClick={locked ? undefined : onClick} disabled={locked}>
        <span className="kcIcon" style={{ background: bg }} aria-hidden="true">{icon}</span>
        <span className="kcStepText"><b>{title}</b><small>{sub}</small></span>
        <span className="kcRight">{right}</span>
      </button>
    );
    return (
      <div className="khRoot">
        <div className="khTop">
          <button className="khBack" onClick={onExit}>← Back</button>
          <span className="khChip">⛺ Opening Camp</span>
        </div>
        <div className="kcCourses" role="tablist" aria-label="Opening">
          {KID_COURSES.map((c) => (
            <button key={c.id} role="tab" aria-selected={c.id === courseId} className="kcCourseTab" onClick={() => { setCourseId(c.id); setMoves(c.root.split(" ")); }}>
              <span aria-hidden="true">{c.emoji}</span> {c.name}<small>as {c.side === "white" ? "White" : "Black"}</small>
            </button>
          ))}
        </div>
        <div className="kcOwl">
          <AnimalIcon kind="Owl" size={56} />
          <div className="khBubble">{notes.story[0].text}</div>
        </div>
        <div className="kcSteps">
          {stepRow("story", "📖", "#E3F4FF", "Owl's Story", "See the idea in pictures", progress.story ? "⭐" : "Go", () => showStory(0))}
          {stepRow("copycat", "🐒", "#FFE9B8", "Copycat", "Play the moves with Owl", progress.copycat ? "⭐".repeat(progress.copycat) : "Go", startCopycat, !progress.story)}
          {stepRow("whatif", "❓", "#FFE0EA", "What If?", `${scenarios.length} sneaky replies to answer`, `${whatIfDone}/${scenarios.length}`, () => setMode("whatif-list"), !progress.copycat)}
        </div>
        <h2 className="khH2">⚔️ Practice Match</h2>
        <div className="kcOpps" role="radiogroup" aria-label="Practice against">
          {CAMP_OPPONENTS.map((o, i) => (
            <button key={o.id} role="radio" aria-checked={i === oppIdx} className={"khRung" + (i === oppIdx ? " khNow" : "")} onClick={() => setOppIdx(i)}>
              <AnimalIcon kind={o.label} size={44} />
              <b>{o.label}</b>
              <span className="khStars">{"★".repeat(o.stars)}{"☆".repeat(3 - o.stars)}</span>
              <span className="khRungNote">{progress.practice[o.id] ? "⭐ perfect" : ""}</span>
            </button>
          ))}
        </div>
        <button className="khBig khMint" disabled={!progress.copycat} onClick={() => startPractice(oppIdx)}>
          {progress.copycat ? `▶ Play ${course.name} vs ${CAMP_OPPONENTS[oppIdx].label}` : "🔒 Finish Copycat first"}
        </button>
        <p className="khSub" style={{ marginTop: 0 }}>They play the moves real kids your level play, until the opening is over.</p>
      </div>
    );
  }

  if (mode === "whatif-list") {
    return (
      <div className="khRoot">
        {header(toHub, "Camp")}
        <div className="kcOwl">
          <AnimalIcon kind="Owl" size={56} />
          <div className="khBubble">Here&apos;s what other kids play. Tap one and find your answer!</div>
        </div>
        <div className="kcCards">
          {scenarios.map((s, i) => {
            const answered = progress.whatIf.includes(s.key);
            return (
              <button key={s.key} className={"kcCard" + (s.mistake ? " kcTrap" : "")} onClick={() => startCard(i)}>
                <span className="kcMove">{s.reply}</span>
                <span className="kcCardText">
                  <b>{s.mistake ? "Gotcha! A trap to spring" : `${inTen(s.share)} in 10 kids play this`}</b>
                  <small>after {movesText(s.at, Math.max(0, s.at.length - 3))}</small>
                </span>
                <span className="kcRight">{answered ? "⭐" : "Go"}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  /* A board screen: story, copycat, what-if, practice, memory. */
  const titles = { story: "📖 Owl's Story", copycat: "🐒 Copycat", whatif: "❓ What If?", practice: `⚔️ vs ${CAMP_OPPONENTS[oppIdx].label}`, memory: "🧠 Memory Game" };
  return (
    <div className="khRoot">
      {header(mode === "memory" ? onExit : mode === "whatif" ? () => { reset(); setMode("whatif-list"); } : toHub, mode === "memory" ? "Back" : mode === "whatif" ? "Cards" : "Camp")}
      <h2 className="khH2">{titles[mode]}{mode === "story" ? ` · ${step + 1} of ${notes.story.length}` : ""}</h2>
      <KidBoard
        pieceAt={(i) => eng.pieceAt(i)}
        flipped={!playerWhite}
        selected={selected}
        targets={targets}
        lastMove={lastMove}
        arrows={arrows}
        glow={glow}
        wrongSquare={wrongSq}
        shake={shake}
        onSquare={onSquare}
        renderPiece={renderPiece}
        boardVars={boardVars}
      />
      <p className="kcMoves">{movesText(moves) || " "}</p>
      {owl}
      {mode === "story" && (
        <div className="khPlayRow">
          <button className="khBig khWhite" disabled={step === 0} onClick={() => showStory(step - 1)}>← Back</button>
          <button className="khBig khMint" onClick={() => showStory(step + 1)}>{step + 1 >= notes.story.length ? "Done! ⭐" : "Next →"}</button>
        </div>
      )}
      {mode === "whatif" && cardDone && (
        <div className="khPlayRow">
          <button className="khBig khMint" onClick={() => (step + 1 < scenarios.length ? startCard(step + 1) : (reset(), setMode("whatif-list")))}>
            {step + 1 < scenarios.length ? "Next card →" : "All cards ⭐"}
          </button>
        </div>
      )}
    </div>
  );
}

