import { useEffect, useRef, useState } from "react";
import { createEngine, mFrom, mPromo, mTo, M120TO64, EMPTY } from "../engine/chessEngine";
import { pickPuzzle as pickFrom, rememberSeen } from "./binRun";
import { loadSetting, saveSetting } from "../utils/storage";
import { PUZZLES } from "../utils/puzzles";
import { judgePuzzleMove } from "../utils/puzzleSession";
import { TacticaScene, SET_BOARD } from "./scene";
import { dressTrashBin } from "./sets/trashBin";
import { BrassButton } from "./ui";
import { play as playSound } from "./sound";
import { loadBonds, levelsOf, recordMove, levelUpText } from "./bonds";

/* Blitz in the Bin: three minutes to solve as many puzzles as you can.
   Puzzles start easy and climb. A wrong move costs time and ends the combo;
   every few in a row gives a little time back. The board is seen whole;
   moves are quick slides and captures play each piece's attack at triple
   speed, so the show stays without slowing
   the chess. One tap on a glowing square plays it. Correct moves grow the
   piece's bond. */
export const BLITZ_SECONDS = 180;
const WRONG_PENALTY_S = 10;
const COMBO_EVERY = 5, COMBO_BONUS_S = 3;
const START_RATING = 650, RATING_STEP = 45;
const REPLY_DELAY_MS = 120, NEXT_PUZZLE_MS = 250;
const KNIGHT = 2, QUEEN = 5;

const sqOf = (sq120) => M120TO64[sq120];

/** A puzzle near `rating` not used this game, preferring ones not seen in
 *  recent Blitz games (remembered on this device), so games don't repeat. */
function pickPuzzle(rating, used) {
  const saved = loadSetting("tacticaBlitzSeen", []);
  const seen = Array.isArray(saved) ? saved : [];
  const p = pickFrom(PUZZLES, rating, used, null, Math.random, { seen });
  saveSetting("tacticaBlitzSeen", rememberSeen(seen, [p.id]));
  return p;
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
  /* The second last ticked, so each of the final ten ticks once. */
  const tickRef = useRef(null);

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
  /* Whether this game beat the best, worked out before the best is updated. */
  const [newBest, setNewBest] = useState(false);
  const endedRef = useRef(false);
  /* Blitz always plays attacks quick. */
  const pace = "quick";

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
    scene.setBonds(levelsOf(loadBonds()));
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
    tickRef.current = null;
    endedRef.current = false;
    setNewBest(false);
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
      if (left > 0 && left < 10000) {
        const sec = Math.ceil(left / 1000);
        if (sec !== tickRef.current) { tickRef.current = sec; playSound("tick", { volume: 0.5 }); }
      }
      if (left <= 0 && !endedRef.current) { endedRef.current = true; playSound("chime", { volume: 0.9 }); setPhase("done"); }
    }, 100);
    return () => clearInterval(id);
  }, [phase]);

  /* Leaving the game (another app, a call, locking the phone) stops the
     clock until you come back. */
  useEffect(() => {
    if (phase !== "playing") return;
    let leftWhenHidden = null;
    const onVisibility = () => {
      if (document.hidden) leftWhenHidden = deadlineRef.current - performance.now();
      else if (leftWhenHidden != null) { deadlineRef.current = performance.now() + leftWhenHidden; leftWhenHidden = null; }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [phase]);

  /* At the end: record a new best. */
  useEffect(() => {
    if (phase !== "done") return;
    setSelected(null);
    if (score > (best || 0)) { setNewBest(true); onBest(score); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, score]);

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
    await scene?.animateMove(from, to, { knight, captured, pace, camera: false });
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
      playSound("error", { volume: 0.6 });
      setCombo(0);
      say("bad", `−${WRONG_PENALTY_S}s`);
      sceneRef.current?.syncPieces(piecesNow());
      return;
    }
    busyRef.current = true;
    /* The piece that played it grows closer to you. */
    const bond = recordMove(eng.pieceAt(sqOf(mFrom(move))), { capture: eng.pieceAt(target) !== EMPTY, final: verdict.solved });
    if (bond.levelUp) { sceneRef.current?.setBonds(levelsOf(bond.bonds)); playSound("shimmer", { volume: 0.8 }); }
    const bondNote = bond.levelUp ? levelUpText(bond.kind, bond.levelUp) : null;
    try {
      await moveQuick(move);
      const afterMine = [...played, verdict.san];
      if (verdict.solved) {
        const newScore = score + 1, newCombo = combo + 1;
        setScore(newScore);
        setCombo(newCombo);
        setBestCombo((b) => Math.max(b, newCombo));
        playSound("confirm", { volume: 0.6 });
        if (newCombo % COMBO_EVERY === 0) {
          playSound("coins", { volume: 0.8 });
          deadlineRef.current += COMBO_BONUS_S * 1000;
          say("good", `Combo ${newCombo}! +${COMBO_BONUS_S}s` + (bondNote ? ` · ${bondNote}` : ""));
        }
        else say("good", bondNote ?? "Solved");
        await new Promise((r) => setTimeout(r, NEXT_PUZZLE_MS));
        if (deadlineRef.current - performance.now() > 0) loadNext(newScore);
        return;
      }
      await new Promise((r) => setTimeout(r, REPLY_DELAY_MS));
      const reply = eng.legalMoves().find((m) => eng.sanOf(m) === verdict.reply);
      if (bondNote) say("good", bondNote);
      if (reply) await moveQuick(reply);
      setPlayed([...afterMine, verdict.reply]);
      setTick((t) => t + 1);
    } finally {
      busyRef.current = false;
    }
  };

  /* The player's colour comes from the puzzle, not the engine: while the
     reply is animating it is the engine's other side to move, and a piece
     picked early must still count as yours. */
  const mySide = puzzle?.fen.split(" ")[1] === "b" ? -1 : 1;
  const friendAt = (sq) => puzzle && Math.sign(eng.pieceAt(sq)) === mySide;
  const tapRef = useRef(null);
  tapRef.current = (sq) => {
    if (phase !== "playing") return;
    /* While a move is still animating you can already pick your next piece. */
    if (busyRef.current) { if (friendAt(sq)) setSelected(sq); return; }
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
    if (sq != null && targets.includes(sq) && !busyRef.current) { play(sq); return true; }
    return false;
  };

  const low = timeLeft < 30000;
  const toMove = side === 1 ? "White" : "Black";
  return (
    <div className="relative mx-auto w-full max-w-[480px] overflow-hidden" style={{ height: "calc(100dvh - var(--headerH))" }}>
      <canvas ref={canvasRef} className="absolute inset-0 block size-full touch-none" />

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 bg-gradient-to-b from-black/75 to-transparent p-3 pb-10">
        <div>
          <div className="tc-label">Solved</div>
          <div className="tc-display text-[28px] leading-none">{score}</div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div role="timer" aria-live="off" className={"tc-plate text-[30px] " + (low ? "tc-low" : "")}>{clock(timeLeft)}</div>
          {phase === "playing" && puzzle && <div className="text-sm text-[var(--tc-cream-dim)]">{toMove} to move</div>}
        </div>
        <div className="text-right">
          <div className="tc-label">Combo</div>
          <div className="tc-display text-[28px] leading-none">{combo}</div>
        </div>
      </div>

      {flash && (
        <p key={flash.id} role="status" className={"tacticaNote fades tc-note pointer-events-none absolute top-28 left-1/2 m-0 -translate-x-1/2 rounded-lg px-4 py-1.5 text-sm whitespace-nowrap " + (flash.kind === "good" ? "tc-good" : "tc-bad")}>{flash.text}</p>
      )}

      {phase === "playing" && (
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/75 to-transparent px-4 pt-10 pb-[calc(0.9rem+env(safe-area-inset-bottom))]">
          <span className="text-sm text-[var(--tc-cream-dim)]">{selected == null ? "Tap a piece, then a glowing square" : "Tap a glowing square to play it"}</span>
          <button type="button" className="tc-link" onClick={() => setPhase("done")}>End run</button>
        </div>
      )}

      {phase !== "playing" && (
        <div className="tc-scrim absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
          {phase === "ready" ? (
            <>
              <h2 className="tc-title m-0 text-[28px]">Blitz in the Bin</h2>
              <p className="m-0 max-w-[30ch] text-base text-[var(--tc-cream-dim)]">Three minutes. Puzzles get harder as you go. A wrong move costs {WRONG_PENALTY_S} seconds; every {COMBO_EVERY} in a row gives {COMBO_BONUS_S} back.</p>
              {best ? <p className="tc-label m-0">Your best · {best}</p> : null}
            </>
          ) : (
            <>
              <h2 className="tc-title m-0 text-[28px]">{newBest ? "New best!" : "Time!"}</h2>
              <p className="tc-title m-0 text-6xl">{score}</p>
              <p className="m-0 text-base text-[var(--tc-cream-dim)]">solved · best combo {bestCombo} · your best {Math.max(best || 0, score)}</p>
            </>
          )}
          <BrassButton onClick={start}>{phase === "ready" ? "Start" : "Play again"}</BrassButton>
          <button type="button" className="tc-link" onClick={onExit}>Back to the menu</button>
        </div>
      )}
    </div>
  );
}
