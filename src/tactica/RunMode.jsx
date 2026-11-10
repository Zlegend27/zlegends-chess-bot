import { useEffect, useRef, useState } from "react";
import { createEngine, mFrom, mPromo, mTo, M120TO64, EMPTY } from "../engine/chessEngine";
import { stockfishBestMove, warmUpStockfish } from "../engine/stockfishEngine";
import { PUZZLES } from "../utils/puzzles";
import { judgePuzzleMove } from "../utils/puzzleSession";
import { TacticaScene, SET_BOARD } from "./scene";
import { dressTrashBin, placeEscapeProps } from "./sets/trashBin";
import { BrassButton, MapButton, MenuButton } from "./ui";
import { play as playSound } from "./sound";
import { makeEscape, movesOf, apply, escaped, strikerOf, piecesOf, fenOf, escapeClock, closeRing, outerRing, ringSquares, allStuck } from "./escape";
import { loadSetting, saveSetting } from "../utils/storage";
import {
  START_HEALTH, WRONG_MOVE_DAMAGE, phasesForFloor, isStoryFloor, timerSeconds, ratingFor,
  rushDamage, pickPuzzle, effectFloors, offer, choose, floorScore, maxPliesFor, rememberSeen, isBonusAfter,
} from "./binRun";
import { loadBonds, levelsOf, recordMove, levelUpText } from "./bonds";

/* The Bin Run: climb floor by floor. Each floor is a battle of a few real
   puzzles (phases), played as one colour, with one shared health bar for the
   whole run. Each phase opens on the whole board, with a timer that pauses
   while anything is animating. A wrong move gets punished by the enemy's
   best reply and costs a quarter of your health; a timer running out brings
   an enemy rush. Between floors, pick one reward or one challenge.
   After floors 3, 8, 13... comes a bonus Escape (escape.js): reach the
   square the light falls on before the garbage closes in, ring by ring,
   past guards that strike anyone ending a move where they attack. Escaping
   heals 25%; not escaping costs nothing but the heal. Puzzles you've seen
   in recent runs come last, so runs don't repeat.
   Same controls as the tutorial: tap a character, tap a glowing square to
   see the move, tap it again to play it; dragging plays at once. */
const KNIGHT = 2, QUEEN = 5;
/* Escaping a bonus floor heals this much. */
const BONUS_HEAL = 25;
const VALUE = [0, 1, 3, 3, 5, 9, 100];
const sqOf = (sq120) => M120TO64[sq120];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function friendlySquares(eng, side) {
  const squares = [];
  for (let sq = 0; sq < 64; sq++) if (Math.sign(eng.pieceAt(sq)) === side) squares.push(sq);
  const rank = (sq) => (side === 1 ? (sq / 8) | 0 : 7 - ((sq / 8) | 0));
  const file = (sq) => (side === 1 ? sq % 8 : 7 - (sq % 8));
  return squares.sort((a, b) => rank(b) - rank(a) || file(a) - file(b));
}

const clock = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/* Cracked glass over the screen, for the curse. */
function Cracks() {
  return (
    <svg className="pointer-events-none absolute inset-0 size-full" viewBox="0 0 100 200" preserveAspectRatio="none" aria-hidden="true">
      <g stroke="rgba(255,255,255,0.85)" strokeWidth="0.35" fill="none" strokeLinecap="round">
        <path d="M58 92 L40 60 L35 38 L22 18 M40 60 L18 66 L4 63 M58 92 L80 70 L92 52 M80 70 L98 78 M58 92 L66 130 L60 160 L70 196 M66 130 L88 140 L99 150 M58 92 L30 118 L12 132 L2 150 M30 118 L34 150 L26 182" />
        <path d="M58 92 L50 82 M58 92 L63 84 M58 92 L52 100 M58 92 L64 99" strokeWidth="0.6" />
      </g>
    </svg>
  );
}

export default function RunMode({ pieceImgSrc, sweetheart, best, onBest, onExit }) {
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const engRef = useRef(createEngine());
  const eng = engRef.current;
  const usedRef = useRef(new Set());
  const busyRef = useRef(false);
  /* A drag in progress. The camera and highlights catch up when it ends,
     including a drag let go where it started, which plays nothing. */
  const [dragging, setDragging] = useState(false);
  /* The phase timer: time left while paused, or the moment it runs out. */
  const timerRef = useRef({ running: false, left: 0, deadline: 0 });
  /* The second last ticked, so each of the final ten ticks once. */
  const tickRef = useRef(null);
  /* Bumped when a run starts or ends. Moves, timers and bonus floors still
     finishing from an earlier run check it and stop, so quitting mid-move
     can't open a reward screen over "Run over". */
  const runIdRef = useRef(0);

  const [stage, setStage] = useState("intro"); // intro | story | playing | choice | cursed | over
  const [floor, setFloor] = useState(1);
  const [phase, setPhase] = useState(0);
  const [phases, setPhases] = useState(2);
  const [side, setSide] = useState(1);
  const [health, setHealthState] = useState(START_HEALTH);
  /* A live copy, read in the middle of animations. */
  const healthRef = useRef(START_HEALTH);
  const setHealth = (v) => {
    const next = typeof v === "function" ? v(healthRef.current) : v;
    healthRef.current = next;
    setHealthState(next);
  };
  const [effect, setEffect] = useState(null);
  const [score, setScore] = useState(0);
  const [puzzle, setPuzzle] = useState(null);
  const [played, setPlayed] = useState([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [chosen, setChosen] = useState(null);
  const [view, setView] = useState("board");
  const [busy, setBusy] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [banner, setBanner] = useState(null); // { text, kind, id }
  const [choices, setChoices] = useState(null);
  const [curse, setCurse] = useState(null);
  const [hurt, setHurt] = useState(0);
  /* Whether the run that just ended beat the best, worked out before the
     best is updated. */
  const [newBest, setNewBest] = useState(false);
  const [, setTick] = useState(0);
  /* The Bin Run always plays the full attacks. */
  const pace = "full";
  const [menuOpen, setMenuOpen] = useState(false);
  /* How far the view is turned, so the map turns with it like a compass. */
  const [turn, setTurn] = useState(0);
  /* An Escape floor in progress: { start, state, used } (moves used), or null
     on a puzzle floor. The garbage and light props live in propsRef. */
  const [escape, setEscapeState] = useState(null);
  const escapeRef = useRef(null);
  const setEscape = (v) => {
    const next = typeof v === "function" ? v(escapeRef.current) : v;
    escapeRef.current = next;
    setEscapeState(next);
  };
  const propsRef = useRef(null);
  /* Puzzle ids seen in recent runs, oldest first. */
  const seenRef = useRef(null);
  if (seenRef.current == null) { const saved = loadSetting("tacticaRunSeen", []); seenRef.current = Array.isArray(saved) ? saved : []; }

  const escapeFriends = escape ? [...escape.state.mine.keys()].sort((a, b) => ((b / 8) | 0) - ((a / 8) | 0) || (a % 8) - (b % 8)) : [];
  const friends = escape ? escapeFriends : puzzle ? friendlySquares(eng, side) : [];
  const selected = friends[Math.min(selectedIdx, friends.length - 1)];
  const legal = !escape && puzzle && stage === "playing" ? eng.legalMoves() : [];
  const movesFrom = legal.filter((m) => sqOf(mFrom(m)) === selected);
  const escapeMoves = escape && stage === "playing" ? movesOf(escape.state).filter((m) => m.from === selected) : [];
  const targets = escape ? escapeMoves.map((m) => m.to) : [...new Set(movesFrom.map((m) => sqOf(mTo(m))))];
  const captures = escape ? escapeMoves.filter((m) => m.capture).map((m) => m.to) : targets.filter((sq) => eng.pieceAt(sq) !== EMPTY);
  const canMove = stage === "playing" && view === "close" && !busy;
  const mapLocked = effect?.id === "nomap";

  const piecesNow = () => {
    const list = [];
    for (let sq = 0; sq < 64; sq++) {
      const p = eng.pieceAt(sq);
      if (p !== EMPTY) list.push({ sq, type: Math.abs(p), white: p > 0 });
    }
    return list;
  };

  const say = (text, kind = "info") => setBanner({ text, kind, id: Math.random() });
  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), 1600);
    return () => clearTimeout(t);
  }, [banner]);

  /* ---- The scene ---- */
  useEffect(() => {
    const scene = new TacticaScene(canvasRef.current, {
      flipped: false,
      colors: {
        light: SET_BOARD.light, dark: SET_BOARD.dark, background: sweetheart ? "#FFF2F6" : "#060507",
        highlight: "#3EE7F5", target: "#F5D93E", attack: "#F05348", select: "#3EE7F5",
      },
      onTap: (sq) => tapRef.current(sq),
      onDoubleTap: (sq) => doubleTapRef.current(sq),
      onSwipe: (dir) => cycleRef.current(dir),
      onDragStart: (sq) => dragStartRef.current(sq),
      onDrop: (sq) => dropRef.current(sq),
      onTurn: setTurn,
    });
    sceneRef.current = scene;
    scene.setBonds(levelsOf(loadBonds()));
    const bin = dressTrashBin(scene);
    scene.everyFrame.push((dt) => bin.update(dt));
    /* The light on an Escape floor pulses. */
    let clockT = 0;
    scene.everyFrame.push((dt) => { clockT += dt; propsRef.current?.update(clockT); });
    scene.setPieces([]);
    scene.showBoard();
    return () => { propsRef.current = null; scene.dispose(); sceneRef.current = null; };
  }, [sweetheart]);

  /* ---- The timer: runs only while playing and nothing is animating ---- */
  const pauseTimer = () => {
    const t = timerRef.current;
    if (!t.running) return;
    t.left = Math.max(0, t.deadline - performance.now());
    t.running = false;
  };
  const resumeTimer = () => {
    const t = timerRef.current;
    if (t.running) return;
    /* Hidden (another app is in front): start again when the game is back. */
    if (document.hidden) { t.waitVisible = true; return; }
    t.deadline = performance.now() + t.left;
    t.running = true;
  };
  /** A fresh timer for puzzle `p`, or for an Escape floor's `level`. */
  const resetTimer = (p, eff, level = null) => {
    const adjust = eff?.id === "time" ? 10 : eff?.id === "fuse" ? -10 : 0;
    const seconds = level ? Math.max(10, escapeClock(level).total + adjust) : timerSeconds(p, eff);
    timerRef.current = { running: false, left: seconds * 1000, deadline: 0 };
    tickRef.current = null;
    setTimeLeft(timerRef.current.left);
  };
  useEffect(() => {
    if (stage !== "playing") return;
    const id = setInterval(() => {
      const t = timerRef.current;
      const left = t.running ? t.deadline - performance.now() : t.left;
      setTimeLeft(left);
      if ((t.running ? left : 0) > 0 && (t.running ? left : 0) < 10000) {
        const sec = Math.ceil((t.running ? left : 0) / 1000);
        if (sec !== tickRef.current) { tickRef.current = sec; playSound("tick", { volume: 0.5 }); }
      }
      if (escapeRef.current) ringTickRef.current(left);
      if (t.running && left <= 0) timeUpRef.current();
    }, 100);
    return () => clearInterval(id);
  }, [stage]);

  /* ---- Camera and highlights ---- */
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || dragging || stage !== "playing" || busy) return;
    if (view === "board") scene.showBoard();
    else scene.showReach(selected, targets);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, selected, played, stage, puzzle, busy, escape, dragging]);
  useEffect(() => {
    const show = stage === "playing" && view === "close" && !busy;
    sceneRef.current?.setMarks(show ? { selected, held: true, ghost: dragging, targets, chosen, captures, confirm: true } : {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, selected, chosen, played, stage, puzzle, busy, escape, dragging]);

  useEffect(() => { warmUpStockfish(); }, []);

  /* Leaving the game (another app, a call, locking the phone) pauses the
     clock; it carries on when you come back, unless something was already
     paused for an animation. */
  useEffect(() => {
    const onVisibility = () => {
      const t = timerRef.current;
      if (document.hidden) {
        if (t.running) { t.left = Math.max(0, t.deadline - performance.now()); t.running = false; t.waitVisible = true; }
      } else if (t.waitVisible) {
        t.waitVisible = false;
        if (!busyRef.current) { t.deadline = performance.now() + t.left; t.running = true; }
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e) => { if (e.key === "Escape") setMenuOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  /* ---- Run flow ---- */
  const startRun = () => {
    runIdRef.current++;
    usedRef.current = new Set();
    setHealth(START_HEALTH);
    setEffect(null);
    setScore(0);
    beginFloor(1, null);
  };

  const beginFloor = (f, eff) => {
    setFloor(f);
    if (isStoryFloor(f)) {
      /* A story floor ends any reward or challenge. */
      setEffect(null);
      setStage("story");
      return;
    }
    startBattle(f, eff);
  };

  /** Takes an Escape floor's garbage and light off the board. */
  const clearEscape = () => {
    propsRef.current?.dispose();
    propsRef.current = null;
    setEscape(null);
  };

  /** The bonus escape after floor `f`: a fresh level, always played from
   *  the near side. `onDone` carries on with the run afterwards. */
  const startEscape = async (f, eff, onDone) => {
    const level = makeEscape(f);
    if (!level) { onDone(); return; }
    const scene = sceneRef.current;
    busyRef.current = true;
    setBusy(true);
    setPhases(1);
    setPhase(0);
    setSide(1);
    setPuzzle(null);
    setPlayed([]);
    setChosen(null);
    setSelectedIdx(0);
    const startView = eff?.id === "nomap" ? "close" : "board";
    setView(startView);
    resetTimer(null, eff, level);
    /* The rings close evenly over the clock actually given (a reward or
       challenge can change it), the last one as it runs out. */
    setEscape({ start: level, state: level, closed: 0, warned: 0, onDone, total: timerRef.current.left / 1000 });
    setStage("playing");
    if (scene) {
      propsRef.current?.dispose();
      scene.setFlipped(false);
      scene.setPieces(piecesOf(level));
      propsRef.current = placeEscapeProps(scene, [...level.junk], level.light);
      if (startView === "board") scene.showBoard();
    }
    say("Bonus · reach the light before the garbage closes in", "info");
    busyRef.current = false;
    setBusy(false);
    resumeTimer();
  };

  const startBattle = (f, eff) => {
    clearEscape();
    return startPuzzleBattle(f, eff);
  };

  /** The next puzzle: near the floor's rating, short enough for the floor,
   *  new to you if possible. It's remembered so later runs show others. */
  const pickFor = (f, phaseIndex, eff, s = null) => {
    const p = pickPuzzle(PUZZLES, ratingFor(f, phaseIndex, eff), usedRef.current, s, Math.random, { seen: seenRef.current, maxPlies: maxPliesFor(f) });
    seenRef.current = rememberSeen(seenRef.current, [p.id]);
    saveSetting("tacticaRunSeen", seenRef.current);
    return p;
  };

  const startPuzzleBattle = async (f, eff) => {
    const total = phasesForFloor(f);
    setPhases(total);
    const first = pickFor(f, 0, eff);
    const s = first.fen.split(" ")[1] === "b" ? -1 : 1;
    setSide(s);
    await loadPhase(first, 0, eff, true, f);
  };

  /** Sets up a phase: the armies take up the new position (regrouping if
   *  they are already on the board), the view opens on the whole board
   *  (unless the map is locked), and the timer starts. */
  const loadPhase = async (p, index, eff, fresh, f = floor) => {
    usedRef.current.add(p.id);
    const scene = sceneRef.current;
    busyRef.current = true;
    setBusy(true);
    eng.loadFen(p.fen);
    setPuzzle(p);
    setPlayed([]);
    setChosen(null);
    setSelectedIdx(0);
    setPhase(index);
    const startView = eff?.id === "nomap" ? "close" : "board";
    setView(startView);
    resetTimer(p, eff);
    setStage("playing");
    if (scene) {
      if (fresh) {
        scene.setFlipped(eng.getSide() === -1);
        scene.setPieces(piecesNow());
      } else {
        const run = runIdRef.current;
        await scene.regroupTo(piecesNow());
        if (run !== runIdRef.current) return;
      }
      if (startView === "board") scene.showBoard();
    }
    say(index === 0 ? `Floor ${f}` : `Phase ${index + 1}`, "info");
    busyRef.current = false;
    setBusy(false);
    resumeTimer();
  };

  const nextAfterPhase = async () => {
    if (phase + 1 < phases) {
      playSound("chime", { volume: 0.8 });
      say("Phase cleared", "good");
      const run = runIdRef.current;
      await wait(500);
      if (run !== runIdRef.current) return;
      const p = pickFor(floor, phase + 1, effect, side);
      await loadPhase(p, phase + 1, effect, false);
      return;
    }
    /* Floor cleared. */
    const gained = floorScore(effect);
    const newScore = score + gained;
    setScore(newScore);
    playSound("confirm", { volume: 0.8 });
    say(gained > 1 ? "Floor cleared · double score" : "Floor cleared", "good");
    let eff = effect;
    if (eff) {
      eff = { ...eff, floorsLeft: eff.floorsLeft - 1 };
      if (eff.floorsLeft <= 0) eff = null;
      setEffect(eff);
    }
    const run = runIdRef.current;
    await wait(900);
    if (run !== runIdRef.current) return;
    const proceed = () => {
      if (!eff && effectFloors(floor) > 0) {
        setChoices(offer());
        setStage("choice");
        return;
      }
      beginFloor(floor + 1, eff);
    };
    if (isBonusAfter(floor)) { startEscape(floor, eff, proceed); return; }
    proceed();
  };

  const pick = (option, kind) => {
    const res = choose(option, kind, floor);
    if (res.heal) setHealth((h) => Math.min(START_HEALTH, h + res.heal));
    setEffect(res.effect);
    setChoices(null);
    if (res.cursed) {
      playSound("crack", { volume: 1 });
      setCurse(res);
      setStage("cursed");
      return;
    }
    beginFloor(floor + 1, res.effect);
  };
  const skipChoice = () => { setChoices(null); beginFloor(floor + 1, null); };

  const takeDamage = (amount) => {
    playSound("punchHeavy", { volume: 0.9 });
    const left = Math.max(0, healthRef.current - amount);
    setHealth(left);
    setHurt((n) => n + 1);
    return left;
  };

  const endRun = () => {
    runIdRef.current++;
    busyRef.current = false;
    setBusy(false);
    pauseTimer();
    setStage("over");
    sceneRef.current?.setMarks({});
  };
  useEffect(() => {
    if (stage !== "over") return;
    setNewBest(score > (best || 0));
    if (score > (best || 0)) onBest(score);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  /* ---- Moves ---- */
  const animate = async (move) => {
    const scene = sceneRef.current;
    const from = sqOf(mFrom(move)), to = sqOf(mTo(move));
    const captured = eng.pieceAt(to) !== EMPTY ? to : null;
    const knight = Math.abs(eng.pieceAt(from)) === KNIGHT;
    const run = runIdRef.current;
    await scene?.animateMove(from, to, { knight, captured, follow: Math.sign(eng.pieceAt(from)) !== side, pace });
    /* Quit (and maybe a new run started) while it played: the board is no
       longer the one this move belongs to. */
    if (run !== runIdRef.current) return null;
    eng.make(move);
    scene?.syncPieces(piecesNow());
    return { from, to, captured };
  };

  /** The enemy's best answer to a wrong move, searched by Stockfish in its
   *  worker so the game keeps running smoothly; the built-in engine is the
   *  fallback if Stockfish can't answer. */
  const punishingReply = async () => {
    const fen = eng.fen();
    try {
      /* Never wait on it for long: a stuck engine falls back too. */
      const { uci } = await Promise.race([stockfishBestMove(fen, 2600, 300), wait(2500).then(() => ({ uci: null }))]);
      const move = uci ? eng.moveFromUci(uci) : null;
      if (move) return move;
    } catch { /* fall back below */ }
    const search = createEngine();
    search.loadFen(fen);
    const found = search.search(280)?.move;
    return found ? eng.legalMoves().find((m) => m === found) ?? null : null;
  };

  /** The most valuable of the player's pieces the enemy now threatens,
   *  preferring ones the piece that just moved attacks. */
  const threatenedBy = (fromSq) => {
    const parts = eng.fen().split(" ");
    parts[1] = parts[1] === "w" ? "b" : "w";
    parts[3] = "-";
    const probe = createEngine();
    probe.loadFen(parts.join(" "));
    let best = null;
    for (const m of probe.legalMoves()) {
      const to = sqOf(mTo(m)), victim = probe.pieceAt(to);
      if (victim === EMPTY || Math.sign(victim) !== side) continue;
      const score = VALUE[Math.abs(victim)] + (sqOf(mFrom(m)) === fromSq ? 50 : 0);
      if (!best || score > best.score) best = { score, from: sqOf(mFrom(m)), to };
    }
    return best;
  };

  /** Ends the bonus escape: a heal if you made it, nothing lost if not. */
  const finishBonus = async (won, text) => {
    const done = escapeRef.current?.onDone;
    const run = runIdRef.current;
    pauseTimer();
    busyRef.current = true;
    setBusy(true);
    setChosen(null);
    if (won) { setHealth((h) => Math.min(START_HEALTH, h + BONUS_HEAL)); playSound("shimmer", { volume: 0.9 }); playSound("confirm", { volume: 0.8, delay: 0.2 }); }
    else playSound("error", { volume: 0.4 });
    say(text, won ? "good" : "info");
    await wait(1400);
    if (run !== runIdRef.current) return;
    clearEscape();
    busyRef.current = false;
    setBusy(false);
    done?.();
  };

  /** Called with the time left on every timer tick of a bonus floor: marks
   *  the next ring shortly before it closes, then buries it. Pieces caught
   *  under it are stuck; if all of yours are, the bonus is over. */
  const ringTickRef = useRef(null);
  ringTickRef.current = (left) => {
    const e = escapeRef.current;
    if (!e || !timerRef.current.running) return;
    const { warn } = escapeClock(e.start);
    const outer = outerRing(e.start);
    const total = e.total, interval = total / outer;
    const elapsed = total - left / 1000;
    const due = Math.min(outer, Math.floor(elapsed / interval));
    const nextRing = outer - e.closed;
    if (e.warned <= e.closed && e.closed < outer && elapsed >= (e.closed + 1) * interval - warn) {
      propsRef.current?.warn(ringSquares(e.state, nextRing).filter((sq) => sq !== e.start.light));
      playSound("scrape", { volume: 0.7 });
      setEscape({ ...e, warned: e.closed + 1 });
      return;
    }
    if (due <= e.closed) return;
    let state = e.state;
    const buried = [];
    for (let k = e.closed + 1; k <= due; k++) {
      const ring = outer - k + 1;
      buried.push(...ringSquares(state, ring).filter((sq) => sq !== e.start.light));
      state = closeRing(state, ring);
    }
    propsRef.current?.bury(buried);
    playSound("drop", { volume: 0.8 });
    playSound("poof", { volume: 0.5, delay: 0.25 });
    for (const sq of state.stuck ?? []) sceneRef.current?.sink(sq);
    for (const sq of buried) if (e.state.guards.has(sq)) sceneRef.current?.sink(sq);
    setEscape({ ...e, state, closed: due, warned: Math.max(e.warned, due) });
    if (allStuck(state)) finishBonus(false, "Buried by the garbage · no bonus");
  };

  /** A move on a bonus escape. Ending where a guard attacks: it strikes,
   *  −25%, and the bonus is over. Reaching the light heals. */
  const playEscape = async (target) => {
    const move = escapeMoves.find((m) => m.to === target);
    if (!move) return;
    const scene = sceneRef.current;
    busyRef.current = true;
    setBusy(true);
    setChosen(null);
    pauseTimer();
    let ending = null;
    const run = runIdRef.current;
    try {
      const now = escapeRef.current.state;
      const type = now.mine.get(move.from);
      await scene?.animateMove(move.from, move.to, { knight: type === KNIGHT, captured: move.capture ? move.to : null, pace });
      if (run !== runIdRef.current) return;
      const after = apply(now, move);
      if (move.deadly) {
        const striker = strikerOf(after, move.to);
        if (striker != null) {
          await scene?.animateMove(striker, move.to, { knight: after.guards.get(striker) === KNIGHT, captured: move.to, follow: true, pace });
        }
        const left = takeDamage(WRONG_MOVE_DAMAGE);
        if (left <= 0) { say("A guard struck · −" + WRONG_MOVE_DAMAGE + "%", "bad"); await wait(700); endRun(); return; }
        ending = [false, "A guard struck · −" + WRONG_MOVE_DAMAGE + "% · no bonus"];
        return;
      }
      setEscape((e) => ({ ...e, state: after }));
      const stillHere = [...after.mine.keys()].sort((a, b) => ((b / 8) | 0) - ((a / 8) | 0) || (a % 8) - (b % 8)).indexOf(move.to);
      if (stillHere >= 0) setSelectedIdx(stillHere);
      if (escaped(after)) { ending = [true, `Into the light! +${BONUS_HEAL}% health`]; return; }
      resumeTimer();
    } finally {
      busyRef.current = false;
      setBusy(false);
      if (ending && run === runIdRef.current) finishBonus(...ending);
    }
  };

  const play = async (target) => {
    if (busyRef.current || stage !== "playing") return;
    if (escape) { await playEscape(target); return; }
    const move = movesFrom.find((m) => sqOf(mTo(m)) === target && (!mPromo(m) || mPromo(m) === QUEEN));
    if (!move) return;
    const verdict = judgePuzzleMove(eng, puzzle, played, move);
    busyRef.current = true;
    setBusy(true);
    setChosen(null);
    pauseTimer();
    const run = runIdRef.current;
    const gone = () => run !== runIdRef.current;
    try {
      if (!verdict.ok) {
        /* Wrong: the move is played, the enemy punishes it with its best
           reply, then everything goes back for another try. */
        const before = eng.fen();
        await animate(move);
        if (gone()) return;
        const reply = await punishingReply();
        if (gone()) return;
        if (reply) {
          const r = await animate(reply);
          if (gone()) return;
          if (r.captured == null) {
            const threat = threatenedBy(r.to);
            if (threat) await sceneRef.current?.scare(threat.from, threat.to);
          }
        }
        playSound("error", { volume: 0.6 });
        say(`${verdict.san} was punished · −${WRONG_MOVE_DAMAGE}%`, "bad");
        const left = takeDamage(WRONG_MOVE_DAMAGE);
        if (left <= 0) { await wait(700); if (!gone()) endRun(); return; }
        await wait(500);
        if (gone()) return;
        eng.loadFen(before);
        await sceneRef.current?.regroupTo(piecesNow());
        if (gone()) return;
        setTick((t) => t + 1);
        setView(effect?.id === "nomap" ? "close" : "board");
        resumeTimer();
        return;
      }
      /* The piece that played it grows closer to you. */
      const bond = recordMove(eng.pieceAt(sqOf(mFrom(move))), { capture: eng.pieceAt(target) !== EMPTY, final: verdict.solved });
      if (bond.levelUp) { sceneRef.current?.setBonds(levelsOf(bond.bonds)); playSound("shimmer", { volume: 0.8 }); say(levelUpText(bond.kind, bond.levelUp), "good"); }
      await animate(move);
      if (gone()) return;
      const afterMine = [...played, verdict.san];
      if (verdict.solved) {
        setPlayed(afterMine);
        await nextAfterPhase();
        return;
      }
      await wait(350);
      if (gone()) return;
      const reply = eng.legalMoves().find((m) => eng.sanOf(m) === verdict.reply);
      if (reply) await animate(reply);
      if (gone()) return;
      setPlayed([...afterMine, verdict.reply]);
      const stillHere = friendlySquares(eng, side).indexOf(sqOf(mTo(move)));
      setSelectedIdx((i) => (stillHere >= 0 ? stillHere : Math.min(i, friendlySquares(eng, side).length - 1)));
      resumeTimer();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  /** Time's up: the enemy rushes (unless a shield takes it), the position
   *  stays as it is and the timer starts again. */
  const timeUpRef = useRef(null);
  timeUpRef.current = async () => {
    if (busyRef.current) return;
    if (escapeRef.current) { finishBonus(false, "The garbage closed in · no bonus"); return; }
    busyRef.current = true;
    setBusy(true);
    pauseTimer();
    setChosen(null);
    setView("board");
    sceneRef.current?.showBoard();
    const run = runIdRef.current;
    await wait(400);
    if (run !== runIdRef.current) return;
    say("Time's up · the enemy rushes!", "bad");
    await sceneRef.current?.rush();
    if (run !== runIdRef.current) return;
    let left = healthRef.current;
    if (effect?.id === "shield" && !effect.shieldUsed) {
      setEffect({ ...effect, shieldUsed: true });
      say("Your shield took the rush", "good");
    } else {
      left = takeDamage(rushDamage(effect));
    }
    busyRef.current = false;
    setBusy(false);
    if (left <= 0) { await wait(700); endRun(); return; }
    resetTimer(puzzle, effect, escape?.start);
    resumeTimer();
  };

  /* ---- Input ---- */
  const cycle = (dir) => {
    if (busy || !friends.length || stage !== "playing") return;
    setChosen(null);
    setSelectedIdx((i) => (i + dir + friends.length) % friends.length);
    /* From the whole board, switching goes in close on the next one. */
    setView("close");
  };
  const cycleRef = useRef(null);
  cycleRef.current = cycle;
  const tapRef = useRef(null);
  tapRef.current = (sq) => {
    if (busyRef.current || stage !== "playing") return;
    if (canMove && targets.includes(sq)) {
      if (sq === chosen) play(sq);
      else setChosen(sq);
      return;
    }
    const idx = friends.indexOf(sq);
    if (idx >= 0) { setSelectedIdx(idx); setChosen(null); setView("close"); return; }
    setChosen(null);
  };
  const doubleTapRef = useRef(null);
  doubleTapRef.current = (sq) => {
    if (canMove && targets.includes(sq)) play(sq);
    else tapRef.current(sq);
  };
  const dragStartRef = useRef(null);
  dragStartRef.current = (sq) => {
    const idx = friends.indexOf(sq);
    if (!canMove || idx < 0) return false;
    setDragging(true);
    setSelectedIdx(idx);
    setChosen(null);
    return true;
  };
  const dropRef = useRef(null);
  dropRef.current = (sq) => {
    setDragging(false);
    if (sq != null && targets.includes(sq) && !busyRef.current) { play(sq); return true; }
    return false;
  };
  const toggleView = () => { if (!busy && !mapLocked) setView((v) => (v === "board" ? "close" : "board")); };
  const squareName = (sq) => `${"abcdefgh"[sq % 8]}${((sq / 8) | 0) + 1}`;
  const pieceName = (sq) => ["", "Pawn", "Knight", "Bishop", "Rook", "Queen", "King"][escape ? escape.state.mine.get(sq) : Math.abs(eng.pieceAt(sq))] + ` on ${squareName(sq)}`;
  const isAttack = chosen != null && captures.includes(chosen);
  const hint = busy ? "…" : view === "board" ? (escape ? "Reach the light. Don't stop where a guard strikes." : "Tap a character to take a closer look")
    : !targets.length ? "This one can't move"
    : chosen != null ? (isAttack ? `Tap ${squareName(chosen)} again to strike` : `Tap ${squareName(chosen)} again to move`)
    : "Tap a glowing square, or drag there";
  const low = timeLeft < 10000;
  const healthFill = health > 50 ? "linear-gradient(#ffd77a, #e2a33a)" : health > 25 ? "linear-gradient(#f2a35a, #c96a24)" : "linear-gradient(#ef6a5c, #b8322a)";
  const choiceText = "text-sm font-normal tracking-normal text-[var(--tc-cream-dim)]";

  return (
    <div className="relative mx-auto w-full max-w-[480px] overflow-hidden" style={{ height: "calc(100dvh - var(--headerH))" }}>
      <canvas ref={canvasRef} className="absolute inset-0 block size-full touch-none" />
      {hurt > 0 && <div key={hurt} className="tacticaNote fades pointer-events-none absolute inset-0 bg-[#b8322a]/30" />}

      {stage === "playing" && (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-2.5 bg-gradient-to-b from-black/80 to-transparent p-3 pb-10">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <MenuButton open={menuOpen} onClick={() => setMenuOpen((o) => !o)} />
                <div>
                  <div className="tc-label">{escape ? "Bonus" : `Floor ${floor}`}</div>
                  <div className="tc-display text-[15px]">{escape ? "Escape to the light" : `Phase ${phase + 1} of ${phases}`}</div>
                </div>
              </div>
              <div role="timer" className={"tc-plate text-[26px] " + (low ? "tc-low" : "")}>{clock(timeLeft)}</div>
            </div>
            <div className="flex items-center gap-2">
              <div className="tc-bar flex-1" role="meter" aria-label="Team health" aria-valuemin={0} aria-valuemax={100} aria-valuenow={health}>
                <i style={{ width: `${health}%`, background: healthFill }} />
              </div>
              <span className="tc-display w-11 text-right text-sm">{health}%</span>
            </div>
            {/* The map sits under the health bar: tap it to switch views, drag it to turn the view. */}
            <div className="flex items-start justify-between gap-2">
              {effect ? (
                <div data-tactica-hud className="tc-panel px-3 py-1 text-xs">
                  <span className="tc-display">{effect.kind === "challenge" ? "Challenge" : "Reward"}:</span> {effect.name}{effect.id === "shield" && effect.shieldUsed ? " (used)" : ""} · {effect.floorsLeft} floor{effect.floorsLeft === 1 ? "" : "s"} left
                </div>
              ) : <span />}
              <MapButton
                fen={escape ? fenOf(escape.state) : eng.fen()}
                pieceImgSrc={pieceImgSrc}
                size={96}
                flipped={side === -1}
                view={view}
                turn={turn}
                locked={mapLocked}
                onToggle={toggleView}
                onSpin={(a) => sceneRef.current?.spinBy(a)}
              />
            </div>
          </div>

          {menuOpen && (
            <>
              <button type="button" aria-label="Close the menu" className="absolute inset-0 cursor-default border-0 bg-transparent" onClick={() => setMenuOpen(false)} />
              <div className="tc-panel absolute top-16 left-3 flex w-56 flex-col gap-3 p-3">
                <button type="button" className="tc-plank tc-center tc-small" onClick={() => setMenuOpen(false)}>Resume</button>
                <button type="button" className="tc-plank tc-center tc-small" onClick={() => { setMenuOpen(false); endRun(); }}>Quit run</button>
              </div>
            </>
          )}

          {banner && (
            <p key={banner.id} role="status" className={"tacticaNote fades tc-note pointer-events-none absolute top-48 left-1/2 m-0 -translate-x-1/2 rounded-lg px-4 py-1.5 text-center text-sm whitespace-nowrap " + (banner.kind === "bad" ? "tc-bad" : banner.kind === "good" ? "tc-good" : "tc-info")}>{banner.text}</p>
          )}

          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/80 to-transparent px-3 pt-10 pb-[calc(0.9rem+env(safe-area-inset-bottom))]">
            <button type="button" className="tc-round" onClick={() => cycle(-1)} disabled={busy} aria-label="Previous character">‹</button>
            <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5 text-center">
              <span className="tc-display truncate text-[15px]">{selected != null && view === "close" ? pieceName(selected) : `Score ${score}`}</span>
              <span className={"truncate text-sm " + (isAttack ? "font-bold text-[var(--tc-gold-hi)]" : "text-[var(--tc-cream-dim)]")} aria-live="polite">{hint}</span>
            </div>
            <button type="button" className="tc-round" onClick={() => cycle(1)} disabled={busy} aria-label="Next character">›</button>
          </div>
        </>
      )}

      {stage === "intro" && (
        <div className="tc-scrim absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
          <h2 className="tc-title m-0 text-[30px]">Bin Run</h2>
          <p className="m-0 max-w-[32ch] text-base text-[var(--tc-cream-dim)]">Climb out floor by floor. Each floor is a battle of real puzzles, and your team shares one health bar for the whole run.</p>
          <ul className="tc-panel m-0 max-w-[34ch] list-none space-y-2 p-4 text-left text-sm">
            <li>A wrong move gets punished and costs 25% health.</li>
            <li>If the timer runs out, the enemy rushes you for 50%.</li>
            <li>Between floors, pick a reward, or take a challenge for double score.</li>
            <li>After floors 3, 8 and 13, a bonus escape: reach the light before the garbage closes in to heal 25%.</li>
          </ul>
          {best ? <p className="tc-label m-0">Your best · {best}</p> : null}
          <BrassButton onClick={startRun}>Start the run</BrassButton>
          <button type="button" className="tc-link" onClick={onExit}>Back to the menu</button>
        </div>
      )}

      {stage === "story" && (
        <div className="tc-scrim absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
          <p className="tc-label m-0">Floor {floor}</p>
          <h2 className="tc-title m-0 text-[30px]">Chapter {floor / 5}</h2>
          <p className="m-0 text-base text-[var(--tc-cream-dim)]">Any reward or challenge ends here.</p>
          <BrassButton onClick={() => startBattle(floor, null)}>Continue</BrassButton>
        </div>
      )}

      {stage === "choice" && choices && (
        <div className="tc-scrim absolute inset-0 flex flex-col justify-center gap-3 overflow-y-auto p-5">
          <h2 className="tc-title m-0 text-center text-[26px]">Floor {floor} cleared</h2>
          <p className="m-0 text-center text-base text-[var(--tc-cream-dim)]">Pick one. It lasts {effectFloors(floor)} floor{effectFloors(floor) === 1 ? "" : "s"}. Health {health}%.</p>
          <p className="tc-label m-0 mt-1">Rewards</p>
          {choices.rewards.map((r) => (
            <button key={r.id} type="button" className="tc-plank tc-stack" onClick={() => pick(r, "reward")}>
              <span>{r.name}</span>
              <span className={choiceText} style={{ fontFamily: "var(--tc-font-body)" }}>{r.text}</span>
            </button>
          ))}
          <p className="tc-label m-0 mt-2">Challenges · double score</p>
          {choices.challenges.map((c) => (
            <button key={c.id} type="button" className="tc-plank tc-stack tc-risk" onClick={() => pick(c, "challenge")}>
              <span>{c.name}</span>
              <span className={choiceText} style={{ fontFamily: "var(--tc-font-body)" }}>{c.text}</span>
            </button>
          ))}
          <button type="button" className="tc-link mt-1 self-center" onClick={skipChoice}>Skip</button>
        </div>
      )}

      {stage === "cursed" && curse && (
        <div className="tc-scrim absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
          <Cracks />
          <h2 className="tc-title m-0 text-[30px]" style={{ color: "var(--tc-danger)" }}>Cursed!</h2>
          <p className="m-0 max-w-[30ch] text-base text-[var(--tc-cream-dim)]">Your {curse.lost.name} melts away. A challenge takes its place: <strong className="text-[var(--tc-cream)]">{curse.effect.name}</strong>. {curse.effect.text}</p>
          <BrassButton onClick={() => beginFloor(floor + 1, curse.effect)}>Carry on</BrassButton>
        </div>
      )}

      {stage === "over" && (
        <div className="tc-scrim absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
          <h2 className="tc-title m-0 text-[30px]">{newBest ? "New best!" : "Run over"}</h2>
          <p className="tc-title m-0 text-6xl">{score}</p>
          <p className="m-0 text-base text-[var(--tc-cream-dim)]">score · reached floor {floor} · your best {Math.max(best || 0, score)}</p>
          <BrassButton onClick={startRun}>Run again</BrassButton>
          <button type="button" className="tc-link" onClick={onExit}>Back to the menu</button>
        </div>
      )}
    </div>
  );
}
