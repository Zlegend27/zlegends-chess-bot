import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { createEngine, mFrom, mPromo, mTo, M120TO64, EMPTY } from "../engine/chessEngine";
import { judgePuzzleMove } from "../utils/puzzleSession";
import { loadSetting } from "../utils/storage";
import { TacticaScene, SET_BOARD } from "./scene";
import { BrassButton } from "./ui";
import { play as playSound, setScore } from "./sound";
import { track } from "../utils/track";
import { WORLDS } from "./worlds";
import { MEMORIES, openMemories } from "./memories";
import { loadStory } from "./story";
import { levelsOf, loadBonds, recordMove, levelUpText, KIND_NAMES } from "./bonds";

/* Memories: a famous game, played with ghost pieces in a pale mist. The
   player plays one side's moves, the ghosts answer with the game's own.
   Nothing can be lost: a wrong move is just "not that", and after two the
   piece to move glows. At the end, what the pieces learned. */
const sqOf = (sq120) => M120TO64[sq120];
const QUEEN = 5, KNIGHT = 2;
const REPLY_MS = 650;

export default function MemoryMode({ start = null, onExit }) {
  /* Memories are story moments, so they get a soft, distant mood. */
  useEffect(() => { setScore("ghost"); return () => setScore(null); }, []);
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const engRef = useRef(createEngine());
  const eng = engRef.current;
  const busyRef = useRef(false);
  const runRef = useRef(0);

  const open = openMemories({ reached: Number(loadSetting("tacticaRunReached", 0)) || 0, beaten: loadStory().beaten, levels: levelsOf(loadBonds()) });
  const [memory, setMemory] = useState(() => MEMORIES.find((m) => m.id === start) ?? null);
  const [stage, setStage] = useState(start ? "intro" : "list"); // list | intro | playing | done
  const [played, setPlayed] = useState([]);
  const [selected, setSelected] = useState(null);
  const [misses, setMisses] = useState(0);
  const [note, setNote] = useState(null);
  const [, setTick] = useState(0);

  const legal = stage === "playing" && !busyRef.current ? eng.legalMoves() : [];
  const movesFrom = selected != null ? legal.filter((m) => sqOf(mFrom(m)) === selected) : [];
  const targets = [...new Set(movesFrom.map((m) => sqOf(mTo(m))))];
  const captures = targets.filter((sq) => eng.pieceAt(sq) !== EMPTY);
  const mySide = memory?.fen.split(" ")[1] === "b" ? -1 : 1;
  /* The move the master played next, for the hint. */
  const expected = stage === "playing" && memory ? eng.legalMoves().find((m) => eng.sanOf(m) === memory.moves[played.length]) : null;
  const hintSq = misses >= 2 && expected ? sqOf(mFrom(expected)) : null;

  const piecesNow = () => {
    const list = [];
    for (let sq = 0; sq < 64; sq++) {
      const p = eng.pieceAt(sq);
      if (p !== EMPTY) list.push({ sq, type: Math.abs(p), white: p > 0 });
    }
    return list;
  };

  /* The scene: the board in a dark blue mist, motes drifting, every piece a
     ghost. */
  useEffect(() => {
    const scene = new TacticaScene(canvasRef.current, {
      flipped: false,
      colors: { light: SET_BOARD.light, dark: SET_BOARD.dark, background: "#070b14", highlight: "#9fd4ff", target: "#cfe6ff", attack: "#ff9a8a", select: "#9fd4ff" },
      onTap: (sq) => tapRef.current(sq),
      onDoubleTap: (sq) => tapRef.current(sq),
      onDragStart: (sq) => dragStartRef.current(sq),
      onDrop: (sq) => dropRef.current(sq),
    });
    sceneRef.current = scene;
    scene.scene.fog = new THREE.FogExp2("#0b1322", 0.035);
    scene.setLook?.({ glow: 0.5, glowFrom: 0.85, vignette: 0.75, tint: "#c6d8ff" });
    scene.setSpirits(true);
    /* Motes of light drifting up through the mist. */
    const N = 260, pos = new Float32Array(N * 3), motes = [];
    for (let i = 0; i < N; i++) motes.push({ x: (Math.random() - 0.5) * 30, y: Math.random() * 10 - 2, z: (Math.random() - 0.5) * 30, s: 0.15 + Math.random() * 0.35 });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const points = new THREE.Points(geo, new THREE.PointsMaterial({ color: "#bcdcff", size: 0.06, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
    points.frustumCulled = false;
    scene.scene.add(points);
    scene.everyFrame.push((dt) => {
      for (let i = 0; i < N; i++) { const m = motes[i]; m.y += dt * m.s; if (m.y > 8) m.y = -2; pos[i * 3] = m.x; pos[i * 3 + 1] = m.y; pos[i * 3 + 2] = m.z; }
      geo.attributes.position.needsUpdate = true;
    });
    scene.setPieces([]);
    scene.showBoard();
    /* Leaving bumps the run on purpose, so a ghost reply still on its way is dropped. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { runRef.current++; scene.dispose(); sceneRef.current = null; };
  }, []);

  const begin = (m) => {
    runRef.current++;
    busyRef.current = false;
    setMemory(m);
    eng.loadFen(m.fen);
    setPlayed([]);
    setSelected(null);
    setMisses(0);
    setNote(null);
    setStage("playing");
    const scene = sceneRef.current;
    scene?.setFlipped(m.fen.split(" ")[1] === "b");
    scene?.setPieces(piecesNow());
    scene?.showBoard();
    playSound("shimmer", { volume: 0.7 });
    track("tactica_memory_start", { id: m.id });
  };

  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(null), 1800);
    return () => clearTimeout(t);
  }, [note]);

  /* Highlights, and the hint's glow on the piece to move. */
  useEffect(() => {
    const marks = selected != null ? { selected, held: true, targets, captures } : hintSq != null ? { selected: hintSq } : {};
    sceneRef.current?.setMarks(stage === "playing" ? marks : {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, played, stage, hintSq]);

  const animate = async (move) => {
    const scene = sceneRef.current;
    const from = sqOf(mFrom(move)), to = sqOf(mTo(move));
    const captured = eng.pieceAt(to) !== EMPTY ? to : null;
    const knight = Math.abs(eng.pieceAt(from)) === KNIGHT;
    const run = runRef.current;
    await scene?.animateMove(from, to, { knight, captured, pace: "quick", camera: false });
    if (run !== runRef.current) return false;
    eng.make(move);
    scene?.syncPieces(piecesNow());
    return true;
  };

  const play = async (target) => {
    if (busyRef.current || stage !== "playing") return;
    const move = movesFrom.find((m) => sqOf(mTo(m)) === target && (!mPromo(m) || mPromo(m) === QUEEN));
    if (!move) return;
    const verdict = judgePuzzleMove(eng, memory, played, move);
    setSelected(null);
    if (!verdict.ok) {
      setMisses((n) => n + 1);
      playSound("soft", { volume: 0.6 });
      setNote(misses >= 1 ? "Not that. Follow the glow." : "Not that. The masters saw something else.");
      return;
    }
    busyRef.current = true;
    const run = runRef.current;
    /* Remembering together brings you closer: the piece that played the
       master's move grows its bond (none while the bond is refused). */
    const bond = recordMove(eng.pieceAt(sqOf(mFrom(move))), { capture: eng.pieceAt(target) !== EMPTY, final: verdict.solved });
    if (bond.levelUp) { sceneRef.current?.setBonds(levelsOf(bond.bonds)); playSound("shimmer", { volume: 0.8 }); setNote(levelUpText(bond.kind, bond.levelUp)); }
    try {
      if (!(await animate(move))) return;
      setMisses(0);
      const afterMine = [...played, verdict.san];
      if (verdict.solved) {
        playSound("chime", { volume: 0.9 });
        playSound("shimmer", { volume: 0.8, delay: 0.3 });
        setPlayed(afterMine);
        setTimeout(() => { if (run === runRef.current) setStage("done"); }, 1100);
        track("tactica_memory_done", { id: memory.id });
        return;
      }
      playSound("ghost", { volume: 0.5 });
      await new Promise((r) => setTimeout(r, REPLY_MS));
      if (run !== runRef.current) return;
      const reply = eng.legalMoves().find((m) => eng.sanOf(m) === verdict.reply);
      if (reply && !(await animate(reply))) return;
      setPlayed([...afterMine, verdict.reply]);
      setTick((t) => t + 1);
    } finally {
      if (run === runRef.current) busyRef.current = false;
    }
  };

  /* For checking while building: play a move by name. */
  if (import.meta.env.DEV) window.__memory = { move: (san) => { const m = eng.legalMoves().find((x) => eng.sanOf(x) === san); if (m) { setSelected(sqOf(mFrom(m))); setTimeout(() => playRef.current?.(sqOf(mTo(m))), 50); } } };
  const playRef = useRef(null);
  playRef.current = play;

  const friendAt = (sq) => Math.sign(eng.pieceAt(sq)) === mySide;
  const tapRef = useRef(null);
  tapRef.current = (sq) => {
    if (stage !== "playing" || busyRef.current) return;
    if (selected != null && targets.includes(sq)) { play(sq); return; }
    setSelected(friendAt(sq) ? sq : null);
  };
  const dragStartRef = useRef(null);
  dragStartRef.current = (sq) => {
    if (stage !== "playing" || busyRef.current || !friendAt(sq)) return false;
    setSelected(sq);
    return true;
  };
  const dropRef = useRef(null);
  dropRef.current = (sq) => {
    if (sq != null && targets.includes(sq) && !busyRef.current) { play(sq); return true; }
    return false;
  };

  const yourMoves = memory ? Math.ceil(memory.moves.length / 2) : 0;
  const doneMoves = Math.ceil(played.length / 2);
  return (
    <div className="relative mx-auto w-full max-w-[480px] overflow-hidden" style={{ height: "calc(100dvh - var(--headerH))" }}>
      <canvas ref={canvasRef} className="absolute inset-0 block size-full touch-none" />

      {stage === "playing" && memory && (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center gap-0.5 bg-gradient-to-b from-black/80 to-transparent p-3 pb-10 text-center">
            <div className="tc-label">A memory · {memory.where}</div>
            <div className="tc-display text-[17px]">{memory.title}</div>
            <div className="text-sm text-[var(--tc-cream-dim)]">Move {Math.min(doneMoves + 1, yourMoves)} of {yourMoves}</div>
          </div>
          {note && <p role="status" className="tc-note pointer-events-none absolute top-28 left-1/2 m-0 -translate-x-1/2 rounded-lg px-4 py-1.5 text-center text-sm">{note}</p>}
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/80 to-transparent px-4 pt-10 pb-[calc(0.9rem+env(safe-area-inset-bottom))]">
            <span className="text-sm text-[var(--tc-cream-dim)]">{hintSq != null ? "The glowing piece moves next" : selected == null ? memory.play : "Tap a glowing square to play it"}</span>
            <button type="button" className="tc-link" onClick={() => { runRef.current++; busyRef.current = false; setStage("list"); sceneRef.current?.setPieces([]); }}>Leave</button>
          </div>
        </>
      )}

      {stage === "list" && (
        <div className="tc-scrim absolute inset-0 flex flex-col gap-3 overflow-y-auto p-5">
          <div className="text-center">
            <h2 className="tc-title m-0 text-[28px]">Memories</h2>
            <p className="m-0 mt-1 text-sm text-[var(--tc-cream-dim)]">Great moments of chess, remembered by your pieces: one for each boss beaten, and one from each kind of piece once your bond with it is strong. Playing them grows your bonds.</p>
          </div>
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
            {MEMORIES.map((m, i) => {
              const isOpen = open.includes(m.id);
              const boss = WORLDS[m.world]?.boss;
              const locked = m.kind ? `Reach ${KIND_NAMES[m.kind]} bond ${m.level} to remember` : `Beat ${boss ? boss.charAt(0).toLowerCase() + boss.slice(1) : "the boss"} to remember`;
              const heading = i === 0 ? "On the journey" : m.kind && !MEMORIES[i - 1].kind ? "Your pieces' own" : null;
              return (
                <li key={m.id}>
                  {heading && <div className="tc-label mt-1 mb-1.5">{heading}</div>}
                  <button type="button" className="tc-plank tc-small w-full text-left" disabled={!isOpen} onClick={() => { setMemory(m); setStage("intro"); }}>
                    <span className="flex flex-col">
                      <span>{isOpen ? m.title : "A memory not yet woken"}</span>
                      <span className="text-xs font-normal tracking-normal text-[var(--tc-cream-dim)]" style={{ fontFamily: "var(--tc-font-body)" }}>{isOpen ? m.where : locked}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <button type="button" className="tc-link self-center" onClick={onExit}>Back to the menu</button>
        </div>
      )}

      {stage === "intro" && memory && (
        <div className="tc-scrim absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
          <div className="tc-label">A memory wakes · {memory.where}</div>
          <h2 className="tc-title m-0 text-[28px]">{memory.title}</h2>
          <p className="m-0 max-w-[32ch] text-base text-[var(--tc-cream-dim)]">{memory.who}</p>
          <p className="m-0 text-sm text-[var(--tc-cream-dim)]">{memory.play} Nothing can be lost here.</p>
          <BrassButton onClick={() => begin(memory)}>Remember it</BrassButton>
          <button type="button" className="tc-link" onClick={() => setStage("list")}>All memories</button>
        </div>
      )}

      {stage === "done" && memory && (
        <div className="tc-scrim absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
          <div className="tc-label">{memory.title} · {memory.where}</div>
          <h2 className="tc-title m-0 text-[26px]">The pieces remember</h2>
          <p className="m-0 max-w-[34ch] text-base text-[var(--tc-cream-dim)]">{memory.lesson}</p>
          <BrassButton onClick={() => begin(memory)}>Play it again</BrassButton>
          <div className="flex gap-4">
            <button type="button" className="tc-link" onClick={() => { setStage("list"); sceneRef.current?.setPieces([]); }}>All memories</button>
            <button type="button" className="tc-link" onClick={onExit}>Back to the menu</button>
          </div>
        </div>
      )}
    </div>
  );
}
