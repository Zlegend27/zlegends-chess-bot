import { useEffect, useRef, useState } from "react";
import { createEngine, mFrom, mPromo, mTo, M120TO64, EMPTY } from "../engine/chessEngine";
import { PUZZLES } from "../utils/puzzles";
import { judgePuzzleMove } from "../utils/puzzleSession";
import { TacticaScene, SET_BOARD } from "./scene";
import { dressTrashBin } from "./sets/trashBin";

/* Blitz in the Bin: three minutes to solve as many puzzles as you can.
   Puzzles start easy and climb. A wrong move costs time and ends the combo;
   every few in a row gives a little time back. The board is seen whole;
   moves are quick slides and captures play each piece's attack at triple
   speed, so the show stays without slowing the chess. One tap on a glowing
   square plays it. */
export const BLITZ_SECONDS = 180;
const WRONG_PENALTY_S = 10;
const COMBO_EVERY = 5, COMBO_BONUS_S = 3;
const START_RATING = 650, RATING_STEP = 45, RATING_WINDOW = 110;
const REPLY_DELAY_MS = 220, NEXT_PUZZLE_MS = 380;
const KNIGHT = 2, QUEEN = 5;

const sqOf = (sq120) => M120TO64[sq120];
const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cyan)]";

/** A puzzle near `rating` that hasn't been used yet, widening the search
 *  if the band runs dry. */
function pickPuzzle(rating, used) {
  for (let widen = 1; widen <= 8; widen *= 2) {
    const pool = PUZZLES.filter((p) => !used.has(p.id) && Math.abs(p.rating - rating) <= RATING_WINDOW * widen);
    if (pool.length) return pool[Math.floor(Math.random() * pool.length)];
  }
  return PUZZLES[Math.floor(Math.random() * PUZZLES.length)];
}

const clock = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export default function BlitzMode({ sweetheart, best, onBest, onExit }) {
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const engRef = useRef(createEngine());
  const eng = engRef.current;
  const usedRef = useRef(new Set());
  const deadlineRef = useRef(0);
  const busyRef = useRef(false);

  const [phase, setPhase] = useState("ready"); // ready | playing | done
  const [puzzle, setPuzzle] = useState(null);
  const [played, setPlayed] = useState([]);
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(BLITZ_SECONDS * 1000);
  const [flash, setFlash] = useState(null); // { kind: "good" | "bad", text, id }
  const [, setTick] = useState(0);

  const side = puzzle ? eng.getSide() : 1;
  const legal = puzzle && phase === "playing" ? eng.legalMoves() : [];
  const movesFrom = selected != null ? legal.filter((m) => sqOf(mFrom(m)) === selected) : [];
  const targets = [...new Set(movesFrom.map((m) => sqOf(mTo(m))))];
  const captures = targets.filter((sq) => eng.pieceAt(sq) !== EMPTY);

  const piecesNow = () => {
    const list = [];
    for (let sq = 0; sq < 64; sq++) {
      const p = eng.pieceAt(sq);
      if (p !== EMPTY) list.push({ sq, type: Math.abs(p), white: p > 0 });
    }
    return list;
  };

  /* The scene, in the bin, seen whole. */
  useEffect(() => {
    const scene = new TacticaScene(canvasRef.current, {
      flipped: false,
      colors: {
        light: SET_BOARD.light, dark: SET_BOARD.dark, background: sweetheart ? "#FFF2F6" : "#060507",
        highlight: "#3EE7F5", target: "#F5D93E", attack: "#F05348", select: "#3EE7F5",
      },
      onTap: (sq) => tapRef.current(sq),
      onDoubleTap: (sq) => tapRef.current(sq),
      onDragStart: (sq) => dragStartRef.current(sq),
      onDrop: (sq) => dropRef.current(sq),
    });
    sceneRef.current = scene;
    const bin = dressTrashBin(scene);
    scene.everyFrame.push((dt) => bin.update(dt));
    scene.setPieces([]);
    scene.showBoard();
    return () => { scene.dispose(); sceneRef.current = null; };
  }, [sweetheart]);

  /** Sets up the next puzzle, about RATING_STEP harder than the last. */
  const loadNext = (solvedCount) => {
    const next = pickPuzzle(START_RATING + solvedCount * RATING_STEP, usedRef.current);
    usedRef.current.add(next.id);
    eng.loadFen(next.fen);
    setPuzzle(next);
    setPlayed([]);
    setSelected(null);
    const scene = sceneRef.current;
    if (scene) {
      scene.setFlipped(eng.getSide() === -1);
      scene.syncPieces(piecesNow());
      scene.showBoard();
    }
  };

  const start = () => {
    usedRef.current = new Set();
    setScore(0); setCombo(0); setBestCombo(0);
    deadlineRef.current = performance.now() + BLITZ_SECONDS * 1000;
    setTimeLeft(BLITZ_SECONDS * 1000);
    setPhase("playing");
    loadNext(0);
  };

  /* The clock. */
  useEffect(() => {
    if (phase !== "playing") return;
    const id = setInterval(() => {
      const left = deadlineRef.current - performance.now();
      setTimeLeft(left);
      if (left <= 0) setPhase("done");
    }, 100);
    return () => clearInterval(id);
  }, [phase]);

  /* At the end: record a new best. */
  useEffect(() => {
    if (phase === "done") {
      setSelected(null);
      if (score > (best || 0)) onBest(score);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  /* Highlights. */
  useEffect(() => {
    sceneRef.current?.setMarks(phase === "playing" && selected != null ? { selected, held: true, targets, captures } : {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, puzzle, played, phase]);

  const say = (kind, text) => setFlash({ kind, text, id: Math.random() });
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 900);
    return () => clearTimeout(t);
  }, [flash]);

  const moveQuick = async (move) => {
    const scene = sceneRef.current;
    const from = sqOf(mFrom(move)), to = sqOf(mTo(move));
    const captured = eng.pieceAt(to) !== EMPTY ? to : null;
    const knight = Math.abs(eng.pieceAt(from)) === KNIGHT;
    await scene?.animateMove(from, to, { knight, captured, quick: true });
    eng.make(move);
    scene?.syncPieces(piecesNow());
  };

  const play = async (target) => {
    if (busyRef.current || phase !== "playing") return;
    const move = movesFrom.find((m) => sqOf(mTo(m)) === target && (!mPromo(m) || mPromo(m) === QUEEN));
    if (!move) return;
    const verdict = judgePuzzleMove(eng, puzzle, played, move);
    setSelected(null);
    if (!verdict.ok) {
      deadlineRef.current -= WRONG_PENALTY_S * 1000;
      setCombo(0);
      say("bad", `−${WRONG_PENALTY_S}s`);
      sceneRef.current?.syncPieces(piecesNow());
      return;
    }
    busyRef.current = true;
    try {
      await moveQuick(move);
      const afterMine = [...played, verdict.san];
      if (verdict.solved) {
        const newScore = score + 1, newCombo = combo + 1;
        setScore(newScore);
        setCombo(newCombo);
        setBestCombo((b) => Math.max(b, newCombo));
        if (newCombo % COMBO_EVERY === 0) { deadlineRef.current += COMBO_BONUS_S * 1000; say("good", `Combo ${newCombo}! +${COMBO_BONUS_S}s`); }
        else say("good", "Solved");
        await new Promise((r) => setTimeout(r, NEXT_PUZZLE_MS));
        if (deadlineRef.current - performance.now() > 0) loadNext(newScore);
        return;
      }
      await new Promise((r) => setTimeout(r, REPLY_DELAY_MS));
      const reply = eng.legalMoves().find((m) => eng.sanOf(m) === verdict.reply);
      if (reply) await moveQuick(reply);
      setPlayed([...afterMine, verdict.reply]);
      setTick((t) => t + 1);
    } finally {
      busyRef.current = false;
    }
  };

  const friendAt = (sq) => puzzle && Math.sign(eng.pieceAt(sq)) === side;
  const tapRef = useRef(null);
  tapRef.current = (sq) => {
    if (phase !== "playing" || busyRef.current) return;
    if (selected != null && targets.includes(sq)) { play(sq); return; }
    setSelected(friendAt(sq) ? sq : null);
  };
  const dragStartRef = useRef(null);
  dragStartRef.current = (sq) => {
    if (phase !== "playing" || busyRef.current || !friendAt(sq)) return false;
    setSelected(sq);
    return true;
  };
  const dropRef = useRef(null);
  dropRef.current = (sq) => {
    if (sq != null && targets.includes(sq)) { play(sq); return true; }
    return false;
  };

  const low = timeLeft < 30000;
  const toMove = side === 1 ? "White" : "Black";
  return (
    <div className="relative mx-auto w-full max-w-[480px] overflow-hidden" style={{ height: "calc(100dvh - var(--headerH))" }}>
      <canvas ref={canvasRef} className="absolute inset-0 block size-full touch-none" />

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 bg-gradient-to-b from-black/70 to-transparent p-3 pb-8">
        <div className="text-white">
          <div className="text-[10px] uppercase tracking-wide text-white/60">Solved</div>
          <div className="text-2xl" style={{ fontFamily: "var(--font-display)" }}>{score}</div>
        </div>
        <div className="text-center">
          <div role="timer" aria-live="off" className={"text-4xl " + (low ? "text-[var(--magenta)]" : "text-white")} style={{ fontFamily: "var(--font-display)" }}>{clock(timeLeft)}</div>
          {phase === "playing" && puzzle && <div className="text-xs text-white/75">{toMove} to move</div>}
        </div>
        <div className="text-right text-white">
          <div className="text-[10px] uppercase tracking-wide text-white/60">Combo</div>
          <div className="text-2xl" style={{ fontFamily: "var(--font-display)" }}>{combo}</div>
        </div>
      </div>

      {flash && (
        <p key={flash.id} role="status" className={"tacticaNote fades pointer-events-none absolute top-24 left-1/2 m-0 -translate-x-1/2 rounded-lg px-3 py-1.5 text-sm font-bold " + (flash.kind === "good" ? "bg-[var(--cyan)]/90 text-black" : "bg-[var(--magenta)]/90 text-white")}>{flash.text}</p>
      )}

      {phase === "playing" && (
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent px-3 pt-8 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <span className="text-xs text-white/75">{selected == null ? "Tap a piece, then a glowing square" : "Tap a glowing square to play it"}</span>
          <button type="button" className={"border-0 bg-transparent p-1 text-xs text-white/75 underline " + focusRing} onClick={() => setPhase("done")}>End run</button>
        </div>
      )}

      {phase !== "playing" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 p-6 text-center text-white">
          {phase === "ready" ? (
            <>
              <h2 className="m-0 text-2xl" style={{ fontFamily: "var(--font-display)" }}>Blitz in the Bin</h2>
              <p className="m-0 max-w-[30ch] text-sm text-white/80">Three minutes. Puzzles get harder as you go. A wrong move costs {WRONG_PENALTY_S} seconds; every {COMBO_EVERY} in a row gives {COMBO_BONUS_S} back.</p>
              {best ? <p className="m-0 text-sm text-white/70">Your best: {best}</p> : null}
            </>
          ) : (
            <>
              <h2 className="m-0 text-2xl" style={{ fontFamily: "var(--font-display)" }}>{score > (best || 0) || (score && score === best) ? "New best!" : "Time!"}</h2>
              <p className="m-0 text-5xl" style={{ fontFamily: "var(--font-display)" }}>{score}</p>
              <p className="m-0 text-sm text-white/80">solved · best combo {bestCombo} · your best {Math.max(best || 0, score)}</p>
            </>
          )}
          <button type="button" className={"btn gold " + focusRing} onClick={start}>{phase === "ready" ? "Start" : "Play again"}</button>
          <button type="button" className={"btn ghost " + focusRing} onClick={onExit}>Menu</button>
        </div>
      )}
    </div>
  );
}
