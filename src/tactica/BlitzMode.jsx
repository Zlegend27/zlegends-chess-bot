import { useEffect, useRef, useState } from "react";
import { createEngine, mFrom, mPromo, mTo, M120TO64, EMPTY } from "../engine/chessEngine";
import { pickPuzzle as pickFrom, rememberSeen } from "./binRun";
import { loadSetting, saveSetting } from "../utils/storage";
import { PUZZLES } from "../utils/puzzles";
import { judgePuzzleMove } from "../utils/puzzleSession";
import { TacticaScene, SET_BOARD } from "./scene";
import { dressTrashBin } from "./sets/trashBin";
import { BrassButton, useLostRebuild, useBackLayer } from "./ui";
import { play as playSound, playMusic, stopMusic, preloadMusic } from "./sound";
import { track } from "../utils/track";
import { submitRushScore, TACTICA_RUSH_SECONDS } from "../utils/leaderboard";
import { levelsOf, recordMove, levelUpText, applyStory } from "./bonds";
import { poolNear, expandPuzzle, warmPool } from "./puzzlePool";

/* How many rush tracks there are to take turns (rush-1.mp3 ...). */
const RUSH_TRACKS = 4;

/* How much of a move's animation (and the next puzzle's loading) the clock
   still counts; see hold() in BlitzMode. */
const HOLD_GRACE_MS = 500;

/* Puzzle Rush Tactica: three minutes to solve as many puzzles as you can.
   Puzzles start easy and climb. A wrong move costs time and ends the combo;
   every few in a row gives a little time back. The board is seen whole;
   moves are quick slides and captures play each piece's attack at triple
   speed, so the show stays without slowing
   the chess. One tap on a glowing square plays it. Correct moves grow the
   piece's bond. A finished run goes on the Tactica Rush leaderboard. */
export const BLITZ_SECONDS = TACTICA_RUSH_SECONDS;
const WRONG_PENALTY_S = 10;
const COMBO_EVERY = 5, COMBO_BONUS_S = 3;
const START_RATING = 650, RATING_STEP = 45;
const REPLY_DELAY_MS = 120, NEXT_PUZZLE_MS = 250;
const KNIGHT = 2, QUEEN = 5;

const sqOf = (sq120) => M120TO64[sq120];

/** A puzzle near `rating` not used this game, preferring ones not seen in
 *  recent games (remembered on this device), so games don't repeat. It comes
 *  from the big pool, or from the small set bundled with the site if that
 *  can't be fetched. */
async function pickPuzzle(rating, used) {
  const saved = loadSetting("tacticaBlitzSeen", []);
  const seen = Array.isArray(saved) ? saved : [];
  const big = await poolNear(rating);
  let p = null;
  for (let tries = 0; big.length && !p && tries < 4; tries++) {
    const row = pickFrom(big, rating, used, null, Math.random, { seen });
    p = expandPuzzle(row);
    if (!p) used.add(row.id);
  }
  p ??= pickFrom(PUZZLES, rating, used, null, Math.random, { seen });
  saveSetting("tacticaBlitzSeen", rememberSeen(seen, [p.id]));
  return p;
}

const clock = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export default function BlitzMode({ sweetheart, best, onBest, displayName, onExit, exitLabel = "Back to the menu" }) {
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const engRef = useRef(createEngine());
  const eng = engRef.current;
  const usedRef = useRef(new Set());
  const deadlineRef = useRef(0);
  const busyRef = useRef(false);
  /* Bumped when a game starts or is ended early, so a move still playing
     from before doesn't land on the new board or count. */
  const gameIdRef = useRef(0);
  /* The second last ticked, so each of the final ten ticks once. */
  const tickRef = useRef(null);
  /* While moves animate and the next puzzle comes in, the clock runs for the
     first half second (HOLD_GRACE_MS: a move costs real time, like a chess
     clock) and then stands still, so a long capture or a slow connection
     doesn't eat the clock but animations aren't free thinking time either.
     holdRef: when it stops (can be a moment ahead). Never below a second. */
  const holdRef = useRef(null);
  const hold = () => {
    if (holdRef.current != null) return;
    const now = performance.now();
    holdRef.current = now + Math.min(HOLD_GRACE_MS, Math.max(0, deadlineRef.current - now - 1000));
  };
  const release = () => { if (holdRef.current != null) { deadlineRef.current += Math.max(0, performance.now() - holdRef.current); holdRef.current = null; } };
  const timeLeftNow = () => deadlineRef.current - Math.min(performance.now(), holdRef.current ?? Infinity);
  /* A tap or drop on a square while a move was still animating: played as
     soon as it's over, instead of being ignored (that felt sticky). */
  const pendingRef = useRef(null);
  /* The next puzzle, picked while this one is being solved. */
  const nextPickRef = useRef(null);

  const [phase, setPhase] = useState("ready"); // ready | playing | done
  /* During a rush, Back (a stray edge swipe) does nothing rather than end
     it; End run is on screen. Before and after, Back leaves. */
  useBackLayer(phase === "playing", () => {});
  /* Music for a rush: one of four driving tracks by Trevor Lentz, a
     different one each rush in turn (public/tactica/music/rush-1..4.mp3).
     It starts with the rush and fades out when it ends. The next rush's
     track starts downloading during this one. */
  useEffect(() => {
    if (phase !== "playing") return undefined;
    const turn = (Number(loadSetting("tacticaRushTrack", 0)) || 0) % RUSH_TRACKS;
    saveSetting("tacticaRushTrack", turn + 1);
    playMusic(`rush-${turn + 1}`, { loop: true, volume: 0.4, fade: 0.8 });
    const nextOne = setTimeout(() => preloadMusic(`rush-${((turn + 1) % RUSH_TRACKS) + 1}`), 20000);
    return () => { clearTimeout(nextOne); stopMusic(1.2); };
  }, [phase]);
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

  /* The first puzzles start loading as soon as the mode opens. */
  useEffect(() => { warmPool(START_RATING); }, []);

  /* The scene, in the bin, seen whole. */
  /* If the phone drops the 3D, rebuild on a fresh canvas (useLostRebuild). */
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
      onDoubleTap: (sq) => tapRef.current(sq),
      onDragStart: (sq) => dragStartRef.current(sq),
      onDrop: (sq) => dropRef.current(sq),
    });
    sceneRef.current = scene;
    applyStory(scene);
    const bin = dressTrashBin(scene);
    scene.everyFrame.push((dt) => bin.update(dt));
    /* A rebuild mid-run puts the puzzle back as it was. */
    if (epoch > 0 && puzzle) { scene.setFlipped(puzzle.fen.split(" ")[1] === "b"); scene.setPieces(piecesNow()); }
    else scene.setPieces([]);
    scene.showBoard();
    return () => { scene.dispose(); sceneRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sweetheart, epoch]);

  /** Sets up the next puzzle, about RATING_STEP harder than the last. The
   *  enemy's opening move isn't shown here: this mode is against the clock. */
  const loadNext = async (solvedCount) => {
    const game = gameIdRef.current;
    const rating = START_RATING + solvedCount * RATING_STEP;
    const ready = nextPickRef.current?.rating === rating && nextPickRef.current.game === game ? nextPickRef.current.promise : null;
    nextPickRef.current = null;
    let next = ready ? await ready : null;
    if (!next || usedRef.current.has(next.id)) next = await pickPuzzle(rating, usedRef.current);
    if (game !== gameIdRef.current) return;
    usedRef.current.add(next.id);
    /* Pick the one after this now, so solving it goes straight on. */
    const after = rating + RATING_STEP;
    nextPickRef.current = { rating: after, game, promise: pickPuzzle(after, new Set([...usedRef.current])).catch(() => null) };
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
    gameIdRef.current++;
    busyRef.current = false;
    usedRef.current = new Set();
    setScore(0); setCombo(0); setBestCombo(0);
    deadlineRef.current = performance.now() + BLITZ_SECONDS * 1000;
    holdRef.current = null;
    pendingRef.current = null;
    nextPickRef.current = null;
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
      const left = timeLeftNow();
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
      if (document.hidden) leftWhenHidden = timeLeftNow();
      else if (leftWhenHidden != null) { deadlineRef.current = Math.min(performance.now(), holdRef.current ?? Infinity) + leftWhenHidden; leftWhenHidden = null; }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [phase]);

  /* At the end: record a new best. */
  useEffect(() => {
    if (phase !== "done") return;
    setSelected(null);
    track("tactica_blitz_end", { score });
    if (score > 0) submitRushScore({ duration: BLITZ_SECONDS, solved: score, displayName, mode: "tactica" });
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

  /** Plays a move out; false if the game changed while it played. */
  const moveQuick = async (move) => {
    const scene = sceneRef.current;
    const from = sqOf(mFrom(move)), to = sqOf(mTo(move));
    const captured = eng.pieceAt(to) !== EMPTY ? to : null;
    const knight = Math.abs(eng.pieceAt(from)) === KNIGHT;
    const game = gameIdRef.current;
    await scene?.animateMove(from, to, { knight, captured, pace, camera: false });
    /* The run ended (or restarted) while it played: the board goes back to
       what the game says rather than keep a move that never counted. */
    if (game !== gameIdRef.current) { if (sceneRef.current === scene) scene?.syncPieces(piecesNow()); return false; }
    eng.make(move);
    scene?.syncPieces(piecesNow());
    return true;
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
    hold();
    /* The piece that played it grows closer to you. */
    const bond = recordMove(eng.pieceAt(sqOf(mFrom(move))), { capture: eng.pieceAt(target) !== EMPTY, final: verdict.solved });
    if (bond.levelUp) { sceneRef.current?.setBonds(levelsOf(bond.bonds)); playSound("shimmer", { volume: 0.8 }); }
    const bondNote = bond.levelUp ? levelUpText(bond.kind, bond.levelUp) : null;
    const game = gameIdRef.current;
    try {
      if (!(await moveQuick(move))) return;
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
        if (game === gameIdRef.current && timeLeftNow() > 0) await loadNext(newScore);
        return;
      }
      await new Promise((r) => setTimeout(r, REPLY_DELAY_MS));
      if (game !== gameIdRef.current) return;
      const reply = eng.legalMoves().find((m) => eng.sanOf(m) === verdict.reply);
      if (bondNote) say("good", bondNote);
      if (reply && !(await moveQuick(reply))) return;
      setPlayed([...afterMine, verdict.reply]);
      setTick((t) => t + 1);
    } finally {
      if (game === gameIdRef.current) { busyRef.current = false; release(); setTick((t) => t + 1); }
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
    /* While a move is still animating you can already pick your next piece,
       and a tap on where it goes is kept and played the moment it's over. */
    if (busyRef.current) { if (friendAt(sq)) { setSelected(sq); pendingRef.current = null; } else if (selected != null) pendingRef.current = sq; return; }
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
    if (sq != null && busyRef.current && sq !== selected) { pendingRef.current = sq; return false; }
    if (sq != null && targets.includes(sq) && !busyRef.current) { play(sq); return true; }
    return false;
  };
  /* A tap kept from while a move was animating: play it now that it's over
     (only if it's still a move for the piece picked). */
  useEffect(() => {
    const sq = pendingRef.current;
    if (sq == null || busyRef.current || phase !== "playing") return;
    pendingRef.current = null;
    if (selected != null && targets.includes(sq)) play(sq);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  });

  if (import.meta.env.DEV) window.__blitz = { eng, phase, puzzle, played, busy: busyRef.current, timeLeft: () => timeLeftNow(), tap: (sq) => tapRef.current(sq), start, scene: () => sceneRef.current };
  const low = timeLeft < 30000;
  const toMove = side === 1 ? "White" : "Black";
  return (
    <div className="relative mx-auto w-full max-w-[480px] overflow-hidden" style={{ height: "calc(100dvh - var(--headerH))" }}>
      <canvas key={epoch} ref={canvasRef} className="absolute inset-0 block size-full touch-none" />

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
          <button type="button" className="tc-link" onClick={() => { gameIdRef.current++; busyRef.current = false; holdRef.current = null; pendingRef.current = null; setPhase("done"); }}>End run</button>
        </div>
      )}

      {phase !== "playing" && (
        <div className="tc-scrim absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
          {phase === "ready" ? (
            <>
              <h2 className="tc-title m-0 text-[28px]">Puzzle Rush Tactica</h2>
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
          <button type="button" className="tc-link" onClick={onExit}>{exitLabel}</button>
        </div>
      )}
    </div>
  );
}
