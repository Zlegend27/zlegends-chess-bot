import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { createEngine, mFrom, mPromo, mTo, M120TO64, EMPTY } from "../engine/chessEngine";
import { stockfishBestMove, warmUpStockfish } from "../engine/stockfishEngine";
import { PUZZLES } from "../utils/puzzles";
import { judgePuzzleMove } from "../utils/puzzleSession";
import { TacticaScene, SET_BOARD } from "./scene";
import { dressTrashBin, placeEscapeProps } from "./sets/trashBin";
import { artSettled } from "./sets/art";
import { BrassButton, MapButton, MenuButton, useViewSource, LearnHints, useLostRebuild } from "./ui";
import { play as playSound, buzz, setScore as setMusicMood, playMusic, stopMusic, preloadMusic, prepareMusic, duckMusic } from "./sound";
import { track } from "../utils/track";
import { makeEscape, movesOf, apply, escaped, strikerOf, piecesOf, fenOf, escapeClock, closeRing, outerRing, ringSquares, allStuck } from "./escape";
import { loadSetting, saveSetting } from "../utils/storage";
import { noteTacticaChange } from "./accountSync.js";
import { submitRunScore } from "../utils/leaderboard";
import { wakeMemory, openMemories, lessonBefore } from "./memories";
import EntryFilm from "./EntryFilm";
import CreditsRoll from "./CreditsRoll";
import {
  START_HEALTH, wrongMoveDamage, phasesForFloor, isStoryFloor, timerSeconds, ratingFor,
  rushDamage, pickPuzzle, effectFloors, offer, choose, floorScore, maxPliesFor, minPliesFor, rememberSeen, isBonusAfter, HARD_MODE_RATING,
} from "./binRun";
import { loadStory, saveStory, isHard, beatStory } from "./story";
import { WORLDS, FLOORS_PER_WORLD, BOSS_STORY, WORLD_STORY, LAST_FLOOR, worldIndex, worldOf, floorInWorld, firstFloorOf, isWorldStart, isBossFloor, isSnowFloor, isIntense, isIntensify, floorTrack } from "./worlds";
import { levelsOf, loadBonds, recordMove, levelUpText, applyStory } from "./bonds";
import { poolNear, expandPuzzle, warmPool } from "./puzzlePool";

/* How much of each move's animation the floor clock still counts (see
   pauseTimer in RunMode). */
const ANIMATION_GRACE_MS = 1000;

/* The Rogue Chess Run: forty floors across four worlds (worlds.js), and
   then the run is won. Each floor is a battle of a few real puzzles
   (phases), played as one colour, with one shared health bar for the whole
   run. A world's last floor can be a boss floor: one long puzzle. A run
   starts at floor 1, or at the first floor of any world already reached
   (only runs from floor 1 count for the best score). Each phase opens on the whole board, with a timer that pauses
   while anything is animating. A wrong move gets punished by the enemy's
   best reply and costs a quarter of your health; a timer running out brings
   an enemy rush. Between floors, pick one reward or one challenge.
   After a world's third and eighth floors comes a bonus Escape (escape.js): reach the
   square the light falls on before the garbage closes in, ring by ring,
   past guards that strike anyone ending a move where they attack. Escaping
   heals 25%; not escaping costs nothing but the heal. Puzzles you've seen
   in recent runs come last, so runs don't repeat.
   Same controls as the tutorial: tap a character, tap a glowing square to
   see the move, tap it again to play it; dragging plays at once. */
const KNIGHT = 2, QUEEN = 5;
/* What closes in on a bonus escape floor, by world. */
const CLOSES_IN = { bin: "garbage", ice: "ice", volcano: "rock", demon: "dark" };
/* Escaping a bonus floor heals this much. */
const BONUS_HEAL = 25;
const VALUE = [0, 1, 3, 3, 5, 9, 100];
const sqOf = (sq120) => M120TO64[sq120];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** The square of the king of the side to move (0-63), or null. */
const kingSquare = (e) => { const k = 6 * e.getSide(); for (let sq = 0; sq < 64; sq++) if (e.pieceAt(sq) === k) return sq; return null; };

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

/** Gold sparks flying out from the middle of the screen, once. */
function SparkBurst() {
  return (
    <div className="tc-burst pointer-events-none absolute inset-0 z-10" aria-hidden="true">
      {Array.from({ length: 22 }, (_, i) => (
        <span key={i} style={{ "--a": `${(i / 22) * 360 + (i % 3) * 7}deg`, "--d": `${90 + (i % 5) * 28}px`, "--t": `${0.7 + (i % 4) * 0.12}s` }} />
      ))}
    </div>
  );
}

/** How the run went, in four numbers. */
function RunSummary({ run, hard }) {
  const mins = Math.max(0, Math.round((Date.now() - (run.startedAt ?? Date.now())) / 60000));
  const items = [
    [run.cleared ?? 0, (run.cleared ?? 0) === 1 ? "floor cleared" : "floors cleared"],
    [run.bosses ?? 0, (run.bosses ?? 0) === 1 ? "boss beaten" : "bosses beaten"],
    [run.wrong ?? 0, (run.wrong ?? 0) === 1 ? "mistake" : "mistakes"],
    [mins < 1 ? "<1" : mins, mins === 1 ? "minute" : "minutes"],
  ];
  return (
    <div className="flex flex-col items-center gap-2">
      <ul className="tc-panel m-0 grid list-none grid-cols-2 gap-x-6 gap-y-2 px-5 py-3">
        {items.map(([n, label]) => (
          <li key={label} className="flex flex-col items-center">
            <span className="tc-display text-2xl">{n}</span>
            <span className="text-xs text-[var(--tc-cream-dim)]">{label}</span>
          </li>
        ))}
      </ul>
      {hard && <span className="tc-label" style={{ color: "var(--tc-danger)" }}>Hard mode</span>}
    </div>
  );
}

/* `creator`: the game's creator is signed in (account app_metadata role
   "creator"). The intro then offers the boss viewer: a jump straight to any
   world's boss floor that saves nothing (no worlds reached, bonds,
   memories, story, bests or leaderboard). */
export default function RunMode({ pieceImgSrc, sweetheart, best, onBest, displayName, onLeaderboard, onExit, creator = false }) {
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  /* The current world's scenery (the bin, the lake...), so the run can
     change it as the floors go by: snow, the storm, the boss. */
  const binRef = useRef(null);
  /* Resolves when the player taps Continue on a boss's card. */
  const cardRef = useRef(null);
  const [bossCard, setBossCard] = useState(null); // { title, lines }
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

  const [stage, setStage] = useState("intro"); // intro | arrive | ending | omen | story | bossCard | playing | choice | cursed | defeat | over
  /* How the run ended: null while it's on, then "won" (floor 40 cleared),
     "lost" (health ran out) or "quit". */
  const [ending, setEnding] = useState(null);
  /* The furthest world ever reached (0 to 3), kept on the device: a run can
     start from any world up to it. */
  const [reached, setReached] = useState(() => Math.min(WORLDS.length - 1, Math.max(0, Number(loadSetting("tacticaRunReached", 0)) || 0)));
  /* This run, for the record kept when it ends: where it started, and how
     health was lost. */
  const runRef = useRef({ from: 1, wrong: 0, rushes: 0 });
  /* Hard mode (the bond was refused, or the switch in Settings is on):
     every puzzle is harder and there are no rewards, only challenges. */
  const [hard] = useState(() => isHard(loadStory()));
  const [floor, setFloor] = useState(1);
  /* The boss of this floor has made his entrance (his music starts then). */
  const [bossIn, setBossIn] = useState(false);
  /* Which world's set is built. */
  const kindOf = (f) => ["bin", "ice", "volcano", "demon"][worldIndex(f)];
  const setKind = kindOf(floor);
  /* Which world's scenery is built and ready, so a battle never starts on
     a scene that is about to be replaced. */
  const builtKindRef = useRef(null);
  /* Which world's scenery is built, for the loading veil. */
  const [builtKind, setBuiltKind] = useState(null);
  /* A burst of sparks when a floor is cleared (its id restarts it). */
  const [burst, setBurst] = useState(0);
  /* Bumped when a world's scenery has finished loading. */
  const [setReady, setSetReady] = useState(0);
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
  /* The run always plays the full attacks. */
  const pace = "full";
  const [menuOpen, setMenuOpen] = useState(false);
  /* What the camera sees, for the map's view cone. */
  const viewSource = useViewSource();
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
  /* If the phone drops the 3D (memory), the scene is rebuilt on a fresh
     canvas from the run's own state (see useLostRebuild). */
  const { epoch, onLost } = useLostRebuild(sceneRef);
  useEffect(() => {
    const scene = new TacticaScene(canvasRef.current, {
      onLost,
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
      onView: (v) => viewSource.set(v),
    });
    sceneRef.current = scene;
    applyStory(scene);
    /* The light on an Escape floor pulses. */
    let clockT = 0;
    scene.everyFrame.push((dt) => { clockT += dt; propsRef.current?.update(clockT); });
    /* A rebuild mid-floor puts the board back as it was. */
    const rebuilding = epoch > 0 && stage === "playing";
    if (rebuilding) { scene.setFlipped(side === -1); scene.setPieces(piecesNow()); }
    else scene.setPieces([]);
    scene.showBoard();
    /* The bin is part of every mode; the other worlds' scenery loads only
       when the run reaches them, so opening Tactica stays quick. */
    let gone = false, bin = null;
    const dress = (make) => {
      if (gone) return;
      bin = make(scene);
      binRef.current = bin;
      scene.everyFrame.push((dt) => bin.update(dt));
      setSetReady((n) => n + 1);
      /* Shown only once its art has arrived and every shader is built, under
         the "Entering..." veil: art landing mid-floor made the first floors
         of each world stutter. */
      artSettled(5000).then(() => new Promise((r) => requestAnimationFrame(() => r()))).then(() => {
        if (gone) return;
        scene.warmAll();
        builtKindRef.current = setKind;
        setBuiltKind(setKind);
      });
    };
    if (setKind === "bin") dress(dressTrashBin);
    else {
      const load = { ice: () => import("./sets/icyLake").then((m) => m.dressIcyLake), volcano: () => import("./sets/volcano").then((m) => m.dressVolcano), demon: () => import("./sets/demonRealm").then((m) => m.dressDemonRealm) }[setKind];
      load().then(dress, () => dress(dressTrashBin));
    }
    return () => { gone = true; builtKindRef.current = null; propsRef.current = null; bin?.dispose?.(); binRef.current = null; scene.dispose(); sceneRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sweetheart, setKind, epoch]);

  /* The world's scenery follows the floor: the bin's last two floors are
     under snow, every world gets worse in its second half, and its boss
     shows himself as the run gets closer to him. */
  useEffect(() => {
    const set = binRef.current;
    if (!set) return;
    const live = stage !== "intro", w = worldIndex(floor);
    set.setSnow(live && w === 0 && isSnowFloor(floor));
    set.setIntense(live && isIntense(floor) && stage !== "omen");
    /* The pizza monster: his eyes over the far edge on floor 9, all of him
       on floor 10. The bear: far off, then on his way from the sixth floor,
       at the board on the tenth. (The omen moves them itself.) */
    if (stage !== "omen") set.setBoss(!live ? 0 : isBossFloor(floor) ? 2 : w === 0 ? (floorInWorld(floor) === 9 ? 1 : 0) : isIntense(floor) ? 1 : 0);
    /* With the boss over the board, the whole-board view makes room for him. */
    sceneRef.current?.setBossRoom(live && isBossFloor(floor) && w > 0 ? 1 : 0);
  }, [floor, stage, setKind, setReady]);
  /* For checking a floor while building: jump straight to it. */
  if (import.meta.env.DEV) window.__run = { floor: (f) => { runIdRef.current++; usedRef.current = new Set(); runRef.current = { from: f, wrong: 0, rushes: 0, cleared: 0, bosses: 0, startedAt: Date.now() }; setHealth(START_HEALTH); beginFloor(f, null); }, bin: () => binRef.current, scene: () => sceneRef.current, eng, state: { stage, busy: busyRef.current }, tap: (sq) => tapRef.current?.(sq), lose: () => endRunRef.current?.("lost"), clear: () => nextRef.current?.() };
  /** The bin's boss, if this is his floor. */
  const bossOn = (f) => (isBossFloor(f) ? binRef.current?.monster ?? null : null);
  /** Shows a boss's card and waits for Continue. */
  const showCard = (title, lines, mood = null) => new Promise((resolve) => { setBossCard({ title, lines, mood }); setStage("bossCard"); cardRef.current = resolve; });

  /* Music. On a floor (and its world card and reward choice) the floor's
     track plays (floorTrack in worlds.js), carrying on from floor to floor
     in the same world. Story moments between floors fade it out for their
     own music made in code: dread before a boss and at the omen, a fanfare
     when one falls, sorrow when a run is lost. The arrival and ending films
     choose their own. */
  useEffect(() => {
    if (stage === "arrive" || stage === "ending") { stopMusic(1.2); return; }
    /* A boss floor's track waits for the fight itself (his entrance), not
       the floor's opening screen or his card. */
    const track = (isBossFloor(floor) ? bossIn && stage === "playing" : stage === "playing" || stage === "choice" || stage === "story") ? floorTrack(floor) : null;
    if (track) {
      setMusicMood(null);
      /* A boss's track hits at once, on his entrance (the stage turns to
         "playing" as he steps in); a world's fades in. */
      const boss = isBossFloor(floor);
      playMusic(track, { loop: true, volume: boss ? 0.45 : 0.38, fade: boss ? 0.02 : 1.5 });
      /* The next floor's track, if it changes, starts downloading now. */
      const next = floor < LAST_FLOOR ? floorTrack(floor + 1) : null;
      if (next && next !== track) preloadMusic(next);
      return;
    }
    /* During a boss's card his track is unpacked, ready for his entrance. */
    if (stage === "bossCard" && bossCard?.mood === "dread" && isBossFloor(floor) && floorTrack(floor)) prepareMusic(floorTrack(floor));
    stopMusic(1.5);
    const mood = stage === "omen" || stage === "cursed" ? "dread"
      : stage === "bossCard" ? bossCard?.mood ?? null
      : stage === "defeat" ? "sorrow"
      : stage === "credits" ? "triumph"
      : stage === "over" ? (ending === "won" ? "triumph" : "sorrow")
      : null;
    setMusicMood(mood);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, bossCard, floor, bossIn]);
  /* Leaving the run stops whatever was playing. */
  useEffect(() => () => { setMusicMood(null); stopMusic(1); duckMusic(false); }, []);

  /* Arriving in a new world: its short film (EntryFilm, film3d/worldFilms.js)
     plays while the world's scenery builds behind it, then the world's
     card. A tap skips the film. */
  /* The bin's sixth floor opens with an omen: something strikes the bin,
     everything in it jumps, and two eyes show over the far edge. Then the
     card, and from here the bin is a worse place. */
  useEffect(() => {
    if (stage !== "omen") return undefined;
    const scene = sceneRef.current, bin = binRef.current;
    let live = true;
    (async () => {
      scene?.setMarks({});
      const [eye, look] = bin?.omenView ?? [[0, 2.6, 8.6], [0, 1.2, -5]];
      scene?.moveCamera(new THREE.Vector3(...eye), new THREE.Vector3(...look), 0.5);
      await wait(500);
      if (!live) return;
      await bin?.omen?.();
      if (live) setStage("story");
    })();
    return () => { live = false; };
  }, [stage]);

  /* ---- The timer: runs only while playing and nothing is animating ---- */
  /* The menu is a pause: the clock stops and the board is covered, so a
     pause can't be used to study the puzzle. One pause per run is free; a
     run paused twice or more doesn't go on the leaderboard. */
  const pausedWasRunning = useRef(false);
  const pausedRef = useRef(false);
  const openPause = () => {
    pausedRef.current = true;
    /* Running only for an animation's grace: the animation's end restarts it. */
    pausedWasRunning.current = timerRef.current.running && !timerRef.current.graceTimer;
    pauseTimer();
    runRef.current.pauses = (runRef.current.pauses ?? 0) + 1;
    duckMusic(true);
    setMenuOpen(true);
  };
  const closePause = () => {
    pausedRef.current = false;
    duckMusic(false);
    setMenuOpen(false);
    if (pausedWasRunning.current) resumeTimer();
    pausedWasRunning.current = false;
  };
  const closePauseRef = useRef(null);
  closePauseRef.current = closePause;
  /* Stops the clock. With `grace` (ms), it keeps running that long first:
     a move's animation costs real time, like a chess clock, but a long
     attack or punishment doesn't eat the clock (the owner's middle ground:
     a fully stopped clock made every animation free thinking time). The
     grace never takes the clock below a second. */
  const pauseTimer = (grace = 0) => {
    const t = timerRef.current;
    clearTimeout(t.graceTimer);
    t.graceTimer = null;
    if (!t.running) return;
    const left = t.deadline - performance.now();
    const g = Math.min(grace, Math.max(0, left - 1000));
    if (g > 0) {
      t.graceTimer = setTimeout(() => { if (timerRef.current === t) pauseTimer(); }, g);
      return;
    }
    t.left = Math.max(0, left);
    t.running = false;
  };
  const resumeTimer = () => {
    const t = timerRef.current;
    clearTimeout(t.graceTimer);
    t.graceTimer = null;
    if (t.running) return;
    /* Paused: an animation finishing behind the pause screen doesn't start
       the clock; Resume does. */
    if (pausedRef.current) { pausedWasRunning.current = true; return; }
    /* Hidden (another app is in front): start again when the game is back. */
    if (document.hidden) { t.waitVisible = true; return; }
    t.deadline = performance.now() + t.left;
    t.running = true;
  };
  /** A fresh timer for puzzle `p`, or for an Escape floor's `level`. */
  const resetTimer = (p, eff, level = null, f = floor) => {
    const adjust = eff?.id === "time" ? 10 : eff?.id === "fuse" ? -10 : 0;
    const seconds = level ? Math.max(10, escapeClock(level).total + adjust) : timerSeconds(p, eff, f);
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
        if (!busyRef.current && !pausedRef.current) { t.deadline = performance.now() + t.left; t.running = true; }
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e) => { if (e.key === "Escape") closePauseRef.current(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  /* ---- Run flow ---- */
  /** Starts a run at the first floor of world `from` (0 is the bin, a full
   *  run from floor 1). */
  const startRun = (from = 0, { at = null } = {}) => {
    runIdRef.current++;
    usedRef.current = new Set();
    /* A boss preview (`at`, the creator's boss viewer) starts on that floor
       and keeps nothing. */
    runRef.current = { from: at ?? firstFloorOf(from), preview: at != null, wrong: 0, rushes: 0, cleared: 0, bosses: 0, startedAt: Date.now() };
    setEnding(null);
    setHealth(START_HEALTH);
    setEffect(null);
    setScore(0);
    beginFloor(at ?? firstFloorOf(from), null);
  };
  const preview = () => !!runRef.current.preview;

  const beginFloor = (f, eff) => {
    setFloor(f);
    setBossIn(false);
    /* Where this floor started, for the per-floor tuning numbers. */
    runRef.current.floorStart = { at: Date.now(), wrong: runRef.current.wrong, rushes: runRef.current.rushes, health: healthRef.current };
    /* Reaching a new world unlocks starting there. */
    if (!preview() && worldIndex(f) > reached) { setReached(worldIndex(f)); saveSetting("tacticaRunReached", worldIndex(f)); noteTacticaChange(); }
    if (isStoryFloor(f)) {
      /* A story floor ends any reward or challenge. */
      setEffect(null);
      setStage(isIntensify(f) ? "omen" : isWorldStart(f) && f > 1 ? "arrive" : "story");
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
      propsRef.current = placeEscapeProps(scene, [...level.junk], level.light, setKind);
      if (startView === "board") scene.showBoard();
    }
    say(`Bonus · reach the light before the ${CLOSES_IN[setKind]} closes in`, "info");
    busyRef.current = false;
    setBusy(false);
    resumeTimer();
  };

  const startBattle = (f, eff) => {
    clearEscape();
    return startPuzzleBattle(f, eff);
  };

  /** The next puzzle: near the floor's rating, short enough for the floor
   *  (or long enough, for a boss), new to you if possible. It comes from the
   *  big pool, or from the small set bundled with the site if that can't be
   *  fetched. It's remembered so later runs show others. */
  const pickFor = async (f, phaseIndex, eff, s = null) => {
    const rating = ratingFor(f, phaseIndex, eff) + (hard ? HARD_MODE_RATING : 0);
    const options = { seen: seenRef.current, maxPlies: maxPliesFor(f), minPlies: minPliesFor(f) };
    const big = await poolNear(rating);
    let p = null;
    for (let tries = 0; big.length && !p && tries < 4; tries++) {
      const row = pickPuzzle(big, rating, usedRef.current, s, Math.random, options);
      p = expandPuzzle(row);
      if (!p) usedRef.current.add(row.id);
    }
    p ??= pickPuzzle(PUZZLES, rating, usedRef.current, s, Math.random, options);
    seenRef.current = rememberSeen(seenRef.current, [p.id]);
    saveSetting("tacticaRunSeen", seenRef.current);
    return p;
  };

  const startPuzzleBattle = async (f, eff) => {
    const total = phasesForFloor(f);
    setPhases(total);
    const run = runIdRef.current;
    /* Wait for this world's scenery if it is still being built. */
    while (builtKindRef.current !== kindOf(f)) { await wait(50); if (run !== runIdRef.current) return; }
    /* A boss makes his entrance before the battle. */
    const boss = bossOn(f);
    if (boss) {
      const lines = BOSS_STORY[worldOf(f).id];
      /* The pieces face each boss with what the last memory taught them. */
      const open = openMemories({ reached, beaten: loadStory().beaten, levels: levelsOf(loadBonds()) });
      const lesson = lessonBefore(worldIndex(f), open);
      const recall = lesson ? [`The pieces remember ${lesson.title}: ${lesson.motto}.`] : [];
      if (lines) { await showCard(worldOf(f).boss, [...lines.intro, ...recall], "dread"); if (run !== runIdRef.current) return; }
      setStage("playing");
      busyRef.current = true;
      setBusy(true);
      binRef.current.setBoss(2);
      setBossIn(true);
      /* His entrance lands with a hit, on the music's first beat. */
      playSound("punchHeavy", { volume: 0.9 });
      playSound("rumble", { volume: 0.7, rate: 0.8 });
      buzz(80);
      sceneRef.current?.setMarks({});
      const [eye, look] = binRef.current.bossView ?? [[0, 2.8, 9.2], [0, 2.2, -5]];
      sceneRef.current?.moveCamera(new THREE.Vector3(...eye), new THREE.Vector3(...look), 0.6);
      say(worldOf(f).boss, "bad");
      await wait(1700);
      if (run !== runIdRef.current) return;
      await boss.roar();
      if (run !== runIdRef.current) return;
    }
    const first = await pickFor(f, 0, eff);
    if (run !== runIdRef.current) return;
    /* The next floor's puzzles start loading now, so it opens without a wait. */
    warmPool(ratingFor(f + 1, 0, eff) + (hard ? HARD_MODE_RATING : 0));
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
    /* A puzzle from the big pool opens one move earlier, so the enemy can be
       seen making the move the puzzle answers. */
    eng.loadFen(p.before ?? p.fen);
    const mySide = p.fen.split(" ")[1] === "b" ? -1 : 1;
    setPuzzle(p);
    setPlayed([]);
    setChosen(null);
    setSelectedIdx(0);
    setPhase(index);
    const startView = eff?.id === "nomap" ? "close" : "board";
    setView(startView);
    resetTimer(p, eff, null, f);
    setStage("playing");
    if (scene) {
      const run = runIdRef.current;
      if (fresh) {
        scene.setFlipped(mySide === -1);
        scene.setPieces(piecesNow());
      } else {
        await scene.regroupTo(piecesNow());
        if (run !== runIdRef.current) return;
      }
      if (startView === "board") scene.showBoard();
    }
    say(index > 0 ? `Phase ${index + 1}` : isBossFloor(f) ? `${worldOf(f).boss} · one long battle` : `Floor ${f}`, "info");
    const peekFloor = worldIndex(f) === 0 ? floorInWorld(f) === 9 : isIntensify(f);
    if (index === 0 && peekFloor && BOSS_STORY[worldOf(f).id]) { const run = runIdRef.current; setTimeout(() => { if (run === runIdRef.current) say(BOSS_STORY[worldOf(f).id].peek, "bad"); }, 1700); }
    if (p.before) {
      const run = runIdRef.current;
      const lead = eng.moveFromUci(p.lead);
      await wait(450);
      if (run !== runIdRef.current) return;
      if (lead) {
        const from = sqOf(mFrom(lead)), to = sqOf(mTo(lead));
        const boss = bossOn(f);
        if (boss && scene) { const arm = await boss.reach(scene.worldOf(from)); if (run !== runIdRef.current) return; boss.carry(arm, scene.worldOf(to), 420); }
        await scene?.animateMove(from, to, { knight: Math.abs(eng.pieceAt(from)) === KNIGHT, captured: eng.pieceAt(to) !== EMPTY ? to : null, follow: true, pace });
        if (run !== runIdRef.current) return;
        bossOn(f)?.rest();
        eng.make(lead);
        scene?.syncPieces(piecesNow());
      } else {
        /* Can't happen with an imported puzzle; if it did, skip the move. */
        eng.loadFen(p.fen);
        scene?.setPieces(piecesNow());
      }
      setTick((t) => t + 1);
      if (startView === "board") scene?.showBoard();
    }
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
      const p = await pickFor(floor, phase + 1, effect, side);
      if (run !== runIdRef.current) return;
      await loadPhase(p, phase + 1, effect, false);
      return;
    }
    /* Floor cleared. */
    runRef.current.cleared++;
    trackFloor("cleared");
    setBurst((n) => n + 1);
    sceneRef.current?.celebrate(friendlySquares(eng, side));
    if (bossOn(floor)) runRef.current.bosses++;
    const gained = floorScore(effect);
    const newScore = score + gained;
    setScore(newScore);
    playSound("confirm", { volume: 0.8 });
    say(gained > 1 ? "Floor cleared · double score" : "Floor cleared", "good");
    if (bossOn(floor)) {
      const fell = runIdRef.current;
      say(`${worldOf(floor).boss} is beaten`, "good");
      /* His music stops on the blow that beats him; the fanfare comes with the card. */
      stopMusic(0.6);
      sceneRef.current?.moveCamera(new THREE.Vector3(0, 2.8, 9.2), new THREE.Vector3(0, 2.0, -5), 0.6);
      await bossOn(floor).melt();
      if (fell !== runIdRef.current) return;
      const lines = BOSS_STORY[worldOf(floor).id];
      if (lines) { await showCard(`${worldOf(floor).boss} is beaten`, lines.won, "triumph"); if (fell !== runIdRef.current) return; }
      /* Beating a boss wakes a memory (memories.js). */
      const memory = preview() ? null : wakeMemory(worldIndex(floor));
      if (memory) {
        noteTacticaChange();
        playSound("shimmer", { volume: 0.8 });
        await showCard("A memory wakes", [`Your pieces remember ${memory.title}, ${memory.where}.`, "Play it from Memories, in the menu, when the run is done."], "wonder");
        if (fell !== runIdRef.current) return;
      }
    }
    let eff = effect;
    if (eff) {
      eff = { ...eff, floorsLeft: eff.floorsLeft - 1 };
      if (eff.floorsLeft <= 0) eff = null;
      setEffect(eff);
    }
    const run = runIdRef.current;
    await wait(900);
    if (run !== runIdRef.current) return;
    /* The last floor: the run is won. */
    if (floor >= LAST_FLOOR) { if (!preview()) saveStory(beatStory(loadStory())); setStage("ending"); return; }
    const proceed = () => {
      if (!eff && effectFloors(floor) > 0) {
        setChoices(offer(Math.random, hard));
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

  const endRunRef = useRef(null);
  const nextRef = useRef(null);
  const endRun = (how = "lost") => {
    runIdRef.current++;
    busyRef.current = false;
    setBusy(false);
    pauseTimer();
    setEnding(how);
    sceneRef.current?.setMarks({});
    const boss = how === "lost" ? bossOn(floor) : null;
    if (!boss) { setStage("over"); return; }
    busyRef.current = true;
    setBusy(true);
    setStage("defeat");
    const scene = sceneRef.current, ended = runIdRef.current;
    scene?.moveCamera(new THREE.Vector3(0, 3.4, 9.4), new THREE.Vector3(0, 1.4, -3.5), 0.5);
    const mine = [];
    for (let sq = 0; sq < 64; sq++) if (Math.sign(eng.pieceAt(sq)) === side) mine.push(sq);
    if (boss.finish && scene) {
      /* The fire dragon burns your pieces itself, one after another. */
      (async () => {
        for (const sq of mine) setTimeout(() => scene.sink(sq), 300 + Math.random() * 1400);
        await boss.finish(mine.map((sq) => scene.worldOf(sq)));
        if (ended === runIdRef.current) setStage("over");
      })();
      return;
    }
    boss.roar();
    for (const sq of mine) scene?.sink(sq);
    setTimeout(() => { if (ended === runIdRef.current) setStage("over"); }, 2300);
  };
  endRunRef.current = endRun;
  nextRef.current = nextAfterPhase;
  /* Only a run from floor 1 counts for the best score. Every run is
     recorded (where it started and ended, and how health was lost), so the
     difficulty can be tuned from real runs. */
  const fullRun = runRef.current.from === 1;
  /* One line per floor played (cleared, or where the run ended), so the
     difficulty of each floor can be tuned from real runs: how long it took,
     wrong moves and timer rushes on it, health before and after. Boss
     previews (the creator's viewer) aren't counted. */
  const trackFloor = (how) => {
    if (runRef.current.preview) return;
    const start = runRef.current.floorStart ?? { at: Date.now(), wrong: 0, rushes: 0, health: healthRef.current };
    track("tactica_floor", {
      floor, world: worldOf(floor).id, how, hard, seconds: Math.round((Date.now() - start.at) / 1000),
      wrong: runRef.current.wrong - start.wrong, rushes: runRef.current.rushes - start.rushes,
      healthBefore: start.health, healthAfter: healthRef.current, challenge: effect?.kind === "challenge" ? effect.id : null,
    });
  };
  useEffect(() => {
    if (stage !== "over") return;
    const beat = fullRun && score > (best || 0);
    setNewBest(beat);
    if (ending !== "won") trackFloor(ending ?? "ended");
    if (!runRef.current.preview) track("tactica_run_end", {
      score, floor, world: worldOf(floor).id, from: runRef.current.from, how: ending, health: healthRef.current, hard,
      wrong: runRef.current.wrong, rushes: runRef.current.rushes, challenge: effect?.kind === "challenge" ? effect.id : null,
    });
    if (beat) onBest(score);
    /* Full runs go on the Rogue Chess Run leaderboard. */
    /* A run paused more than once doesn't go on the leaderboard. */
    if (fullRun && score > 0 && (runRef.current.pauses ?? 0) <= 1) submitRunScore({ score, floor, won: ending === "won", hard, displayName });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  /* ---- Moves ---- */
  const animate = async (move) => {
    const scene = sceneRef.current;
    const from = sqOf(mFrom(move)), to = sqOf(mTo(move));
    const captured = eng.pieceAt(to) !== EMPTY ? to : null;
    const knight = Math.abs(eng.pieceAt(from)) === KNIGHT;
    const run = runIdRef.current;
    /* On a boss floor the boss moves the enemy's pieces with his own hand. */
    const boss = Math.sign(eng.pieceAt(from)) !== side ? bossOn(floor) : null;
    if (boss && scene) { const arm = await boss.reach(scene.worldOf(from)); if (run !== runIdRef.current) return null; boss.carry(arm, scene.worldOf(to), 420); }
    await scene?.animateMove(from, to, { knight, captured, follow: Math.sign(eng.pieceAt(from)) !== side, pace });
    boss?.rest();
    /* Quit (and maybe a new run started) while it played: the board is no
       longer the one this move belongs to. */
    if (run !== runIdRef.current) return null;
    eng.make(move);
    scene?.syncPieces(piecesNow());
    /* Check: the king's moment of fear. */
    if (eng.inCheckNow() && eng.legalMoves().length) await scene?.kingScare(kingSquare(eng), to);
    if (run !== runIdRef.current) return null;
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
    if (allStuck(state)) finishBonus(false, `Buried by the ${CLOSES_IN[setKind]} · no bonus`);
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
    let ending = null; // how the bonus floor finished, for finishBonus
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
        const cost = wrongMoveDamage(floor);
        runRef.current.wrong++;
        buzz(70);
        const left = takeDamage(cost);
        if (left <= 0) { say("A guard struck · −" + cost + "%", "bad"); await wait(700); endRun(); return; }
        ending = [false, "A guard struck · −" + cost + "% · no bonus"];
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
    pauseTimer(ANIMATION_GRACE_MS);
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
        if (bossOn(floor) && sceneRef.current) { await bossOn(floor).slam(sceneRef.current.worldOf(sqOf(mTo(move)))); buzz([90, 40, 140]); if (gone()) return; }
        const cost = wrongMoveDamage(floor);
        runRef.current.wrong++;
        buzz(70);
        say(`${verdict.san} was punished · −${cost}%`, "bad");
        const left = takeDamage(cost);
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
      const bond = preview() ? {} : recordMove(eng.pieceAt(sqOf(mFrom(move))), { capture: eng.pieceAt(target) !== EMPTY, final: verdict.solved });
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
    if (escapeRef.current) { finishBonus(false, `The ${CLOSES_IN[setKind]} closed in · no bonus`); return; }
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
      runRef.current.rushes++;
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
      <canvas key={epoch} ref={canvasRef} className="absolute inset-0 block size-full touch-none" />
      <LearnHints close={stage === "playing" && view === "close" && !busy} />
      {hurt > 0 && <div key={hurt} className="tacticaNote fades pointer-events-none absolute inset-0 bg-[#b8322a]/30" />}

      {stage === "playing" && (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-2.5 bg-gradient-to-b from-black/80 to-transparent p-3 pb-10">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <MenuButton open={menuOpen} onClick={() => (menuOpen ? closePause() : openPause())} />
                <div>
                  <div className="tc-label">{escape ? "Bonus" : `${worldOf(floor).name} · Floor ${floor}`}</div>
                  <div className="tc-display text-[15px]">{escape ? "Escape to the light" : isBossFloor(floor) ? worldOf(floor).boss : `Phase ${phase + 1} of ${phases}`}</div>
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
                selected={selected}
                viewSource={viewSource}
                locked={mapLocked}
                onToggle={toggleView}
                onSpin={(a) => sceneRef.current?.spinBy(a)}
              />
            </div>
          </div>

          {menuOpen && (
            <div className="tc-scrim absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 p-6 text-center" style={{ background: "radial-gradient(circle at 50% 40%, #2a1a10, #0c0806)" }} role="dialog" aria-label="Paused">
              <h2 className="tc-title m-0 text-[30px]">Paused</h2>
              <p className="m-0 text-sm text-[var(--tc-cream-dim)]">The clock is stopped. Floor {floor}, {worldOf(floor).name}.</p>
              <div className="flex w-56 flex-col gap-3">
                <button type="button" className="tc-plank tc-center tc-small" onClick={closePause}>Resume</button>
                <button type="button" className="tc-plank tc-center tc-small" onClick={() => { pausedRef.current = false; setMenuOpen(false); endRun("quit"); }}>Quit run</button>
              </div>
              {fullRun && (
                <p className="m-0 max-w-[30ch] text-xs text-[var(--tc-cream-dim)]">
                  {(runRef.current.pauses ?? 0) > 1 ? "This run has been paused more than once, so it won't go on the leaderboard." : "One pause per run is free. Pause again and this run won't go on the leaderboard."}
                </p>
              )}
            </div>
          )}

          {banner && (
            <p key={banner.id} role="status" className={"tacticaNote fades tc-note pointer-events-none absolute top-48 left-1/2 m-0 -translate-x-1/2 rounded-lg px-4 py-1.5 text-center text-sm whitespace-nowrap " + (banner.kind === "bad" ? "tc-bad" : banner.kind === "good" ? "tc-good" : "tc-info")}>{banner.text}</p>
          )}

          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/80 to-transparent px-3 pt-10 pb-[calc(0.9rem+env(safe-area-inset-bottom))]">
            <button type="button" className="tc-round tc-cycle" onClick={() => cycle(-1)} disabled={busy} aria-label="Previous character">‹</button>
            <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5 text-center">
              <span className="tc-display truncate text-[15px]">{selected != null && view === "close" ? pieceName(selected) : `Score ${score}`}</span>
              <span className={"truncate text-sm " + (isAttack ? "font-bold text-[var(--tc-gold-hi)]" : "text-[var(--tc-cream-dim)]")} aria-live="polite">{hint}</span>
            </div>
            <button type="button" className="tc-round tc-cycle" onClick={() => cycle(1)} disabled={busy} aria-label="Next character">›</button>
          </div>
        </>
      )}

      {stage === "intro" && (
        <div className="tc-scrim absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
          <h2 className="tc-title m-0 text-[30px]">Rogue Chess Run</h2>
          <p className="m-0 max-w-[32ch] text-base text-[var(--tc-cream-dim)]">{LAST_FLOOR} floors through {WORLDS.length} worlds. Each floor is a battle of real puzzles, and your team shares one health bar for the whole run.</p>
          <ul className="tc-panel m-0 max-w-[34ch] list-none space-y-2 p-4 text-left text-sm">
            <li>A wrong move gets punished and costs a quarter of your health, a third in the later worlds.</li>
            <li>If the timer runs out, the enemy rushes you for 50%.</li>
            <li>Between floors, pick a reward, or take a challenge for double score.</li>
            <li>Every world gets harder halfway, and ends on a boss.</li>
          </ul>
          {hard && <p className="tc-label m-0" style={{ color: "var(--tc-danger)" }}>Hard mode · harder puzzles, no rewards</p>}
          {best ? <p className="tc-label m-0">Your best · {best}</p> : null}
          <BrassButton onClick={() => startRun(0)}>Start from floor 1</BrassButton>
          {reached > 0 && (
            <div className="flex w-full max-w-[34ch] flex-col gap-2">
              <p className="tc-label m-0">Or carry on from a world you&apos;ve reached</p>
              {WORLDS.slice(1, reached + 1).map((w, i) => (
                <button key={w.id} type="button" className="tc-plank tc-center tc-small" onClick={() => startRun(i + 1)}>{w.name} · floor {firstFloorOf(i + 1)}</button>
              ))}
              <p className="m-0 text-xs text-[var(--tc-cream-dim)]">Only a run from floor 1 counts for your best.</p>
            </div>
          )}
          {creator && (
            <div className="tc-panel flex w-full max-w-[34ch] flex-col gap-2 p-3">
              <p className="tc-label m-0">Boss viewer · creator only</p>
              <div className="grid grid-cols-2 gap-2">
                {WORLDS.map((w, i) => w.boss && (
                  <button key={w.id} type="button" className="tc-plank tc-center tc-small" onClick={() => startRun(i, { at: firstFloorOf(i) + FLOORS_PER_WORLD - 1 })}>{w.boss}</button>
                ))}
              </div>
              <p className="m-0 text-xs text-[var(--tc-cream-dim)]">Starts on that boss&apos;s floor. Nothing is saved: no progress, bonds, memories or scores.</p>
            </div>
          )}
          <button type="button" className="tc-link" onClick={onExit}>Back to the menu</button>
        </div>
      )}

      {stage === "omen" && (
        <p role="status" className="tacticaNote tc-note tc-bad pointer-events-none absolute bottom-24 left-1/2 m-0 -translate-x-1/2 rounded-lg px-4 py-1.5 text-center text-sm whitespace-nowrap">{BOSS_STORY[worldOf(floor).id]?.omen}</p>
      )}

      {stage === "bossCard" && bossCard && (
        <div className="tc-scrim absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
          <p className="tc-label m-0" style={{ color: "var(--tc-danger)" }}>{worldOf(floor).name} · floor {floor}</p>
          <h2 className="tc-title m-0 text-[30px]">{bossCard.title}</h2>
          {bossCard.lines.map((line) => <p key={line} className="m-0 max-w-[30ch] text-base text-[var(--tc-cream-dim)]">{line}</p>)}
          <BrassButton onClick={() => { const go = cardRef.current; cardRef.current = null; go?.(); }}>Continue</BrassButton>
        </div>
      )}

      {stage === "arrive" && <EntryFilm world={worldOf(floor).id} sceneRef={sceneRef} setRef={binRef} ready={builtKind === setKind && setReady > 0} onDone={() => setStage("story")} />}
      {stage === "ending" && <EntryFilm world="ending" sceneRef={sceneRef} setRef={binRef} ready={builtKind === setKind && setReady > 0} onDone={() => setStage("credits")} />}
      {stage === "credits" && <CreditsRoll onDone={() => endRun("won")} />}
      {stage === "story" && (
        <div className="tc-scrim absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
          {/* Where each world's entry cutscene and its halfway animation will play. */}
          <p className="tc-label m-0">{isWorldStart(floor) ? `World ${worldIndex(floor) + 1} of ${WORLDS.length}` : `${worldOf(floor).name} · floor ${floor}`}</p>
          <h2 className="tc-title m-0 text-[30px]">{isWorldStart(floor) ? worldOf(floor).name : "It gets harder from here"}</h2>
          {isWorldStart(floor) && WORLD_STORY[worldOf(floor).id] && <p className="m-0 max-w-[32ch] text-base italic text-[var(--tc-cream)]">{WORLD_STORY[worldOf(floor).id]}</p>}
          <p className="m-0 max-w-[30ch] text-base text-[var(--tc-cream-dim)]">
            {isWorldStart(floor)
              ? `Floors ${floor} to ${floor + 9}.${worldOf(floor).boss ? ` ${worldOf(floor).boss} waits on the last one.` : ""}`
              : `${10 - floorInWorld(floor) + 1} floors left in this world.`}
            {floor > runRef.current.from ? " Any reward or challenge ends here." : ""}
          </p>
          <BrassButton onClick={() => startBattle(floor, null)}>Continue</BrassButton>
        </div>
      )}

      {stage === "choice" && choices && (
        <div className="tc-scrim absolute inset-0 flex flex-col justify-center gap-3 overflow-y-auto p-5">
          <h2 className="tc-title m-0 text-center text-[26px]">Floor {floor} cleared</h2>
          <p className="m-0 text-center text-base text-[var(--tc-cream-dim)]">{hard ? "Pick a challenge" : "Pick one"}. It lasts {effectFloors(floor)} floor{effectFloors(floor) === 1 ? "" : "s"}. Health {health}%.</p>
          {choices.rewards.length > 0 && <p className="tc-label m-0 mt-1">Rewards</p>}
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
          {hard
            ? <p className="m-0 text-center text-sm text-[var(--tc-cream-dim)]">Hard mode: no rewards, and one challenge must be taken.</p>
            : <button type="button" className="tc-link mt-1 self-center" onClick={skipChoice}>Skip</button>}
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

      {burst > 0 && <SparkBurst key={burst} />}
      {builtKind !== setKind && (
        <div className="tc-scrim pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 text-center" role="status">
          <p className="tc-label m-0">Floor {floor}</p>
          <p className="tc-title tc-pulse m-0 text-2xl">Entering {worldOf(floor).name.toLowerCase()}…</p>
        </div>
      )}
      {stage === "over" && (
        <div className="tc-scrim absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
          <h2 className="tc-title m-0 text-[30px]">{ending === "won" ? "You made it out" : newBest ? "New best!" : "Run over"}</h2>
          <p className="tc-title m-0 text-6xl">{score}</p>
          <p className="m-0 max-w-[32ch] text-base text-[var(--tc-cream-dim)]">
            score · {ending === "won" ? `all ${LAST_FLOOR} floors cleared` : `reached floor ${floor}, ${worldOf(floor).name}`}
            {fullRun ? ` · your best ${Math.max(best || 0, score)}` : " · started partway, so it doesn't count for your best"}
          </p>
          <RunSummary run={runRef.current} hard={hard} />
          <BrassButton onClick={() => startRun(0)}>Run again from floor 1</BrassButton>
          {ending !== "won" && worldIndex(floor) > 0 && (
            <button type="button" className="tc-plank tc-center tc-small" onClick={() => startRun(worldIndex(floor))}>Try {worldOf(floor).name} again · floor {firstFloorOf(worldIndex(floor))}</button>
          )}
          {fullRun && onLeaderboard && <button type="button" className="tc-link" onClick={onLeaderboard}>See the Rogue Run leaderboard</button>}
          <button type="button" className="tc-link" onClick={onExit}>Back to the menu</button>
        </div>
      )}
    </div>
  );
}
