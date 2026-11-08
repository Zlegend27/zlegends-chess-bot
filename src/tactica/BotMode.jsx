import { useEffect, useRef, useState } from "react";
import { createEngine, mFrom, mPromo, mTo, M120TO64, EMPTY } from "../engine/chessEngine";
import { stockfishBestMove, warmUpStockfish } from "../engine/stockfishEngine";
import { DIFFICULTIES } from "../utils/difficulties";
import { gameResult, resultSentence } from "../utils/gameResult";
import MiniBoard from "../components/MiniBoard";
import { loadSetting, saveSetting } from "../utils/storage";
import { TacticaScene, SET_BOARD } from "./scene";
import { dressTrashBin } from "./sets/trashBin";
import { loadBonds, levelsOf } from "./bonds";
import { loadPace, savePace } from "./pace";
import PaceControl from "./PaceControl";

/* Play a bot in the bin: a full game on the 3D board against the site's own
   bots (the 1000, 1500 and 2000 Elo Stockfish levels and the homemade
   Engine). Rank Bot is left out here: its games feed your rank, and a game
   in the bin isn't rated. Same controls as the tutorial; promotions become
   a queen. */
const BOTS = DIFFICULTIES.filter((d) => d.id !== "rank");
const KNIGHT = 2, QUEEN = 5;
const sqOf = (sq120) => M120TO64[sq120];
const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cyan)]";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
/* A bot never answers faster than this, so its move doesn't land before
   yours has finished. */
const MIN_THINK_MS = 400;

function friendlySquares(eng, side) {
  const squares = [];
  for (let sq = 0; sq < 64; sq++) if (Math.sign(eng.pieceAt(sq)) === side) squares.push(sq);
  const rank = (sq) => (side === 1 ? (sq / 8) | 0 : 7 - ((sq / 8) | 0));
  const file = (sq) => (side === 1 ? sq % 8 : 7 - (sq % 8));
  return squares.sort((a, b) => rank(b) - rank(a) || file(a) - file(b));
}

/* The homemade Engine runs in the site's engine worker, which replays the
   game from its move list. */
let worker = null, nextId = 0;
const pending = new Map();
function engineSearch(moveList, bot) {
  if (!worker) {
    worker = new Worker(new URL("../engine/engineWorker.js", import.meta.url), { type: "module" });
    worker.onmessage = (e) => { const done = pending.get(e.data.id); if (done) { pending.delete(e.data.id); done(e.data.result); } };
  }
  const id = ++nextId;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    worker.postMessage({ id, moveList, timeMs: bot.ms, blunderChance: bot.blunderChance || 0, useBook: !!bot.book });
  });
}

/** The bot's move in the engine's own form, or null. */
async function botMove(eng, moveList, bot) {
  if (bot.stockfishElo) {
    const { uci } = await stockfishBestMove(eng.fen(), bot.stockfishElo, bot.moveTimeMs || 1000);
    let move = uci ? eng.moveFromUci(uci) : null;
    if (move && bot.blunderChance && Math.random() < bot.blunderChance) {
      const legal = eng.legalMoves();
      move = legal[(Math.random() * legal.length) | 0];
    }
    return move;
  }
  const res = await engineSearch(moveList, bot);
  if (!res?.move) return null;
  /* The worker's move comes back as SAN-checked engine move; match it here. */
  return eng.legalMoves().find((m) => eng.sanOf(m) === res.san) ?? null;
}

export default function BotMode({ pieceImgSrc, sweetheart, onExit }) {
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const engRef = useRef(createEngine());
  const eng = engRef.current;
  const busyRef = useRef(false);
  const draggingRef = useRef(false);
  /* Bumped for every new game, so a bot reply from an old game is dropped. */
  const gameIdRef = useRef(0);

  const [stage, setStage] = useState("setup"); // setup | playing | over
  const [botIdx, setBotIdx] = useState(() => Math.min(BOTS.length - 1, Math.max(0, loadSetting("tacticaBotIdx", 0))));
  const [colourPick, setColourPick] = useState(() => loadSetting("tacticaBotColour", "white"));
  const [side, setSide] = useState(1);
  const [moveList, setMoveList] = useState([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [chosen, setChosen] = useState(null);
  const [view, setView] = useState("board");
  const [busy, setBusy] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [result, setResult] = useState(null); // { text, reason, winner?, resigned? }
  const [menuOpen, setMenuOpen] = useState(false);
  const [pace, setPaceState] = useState(() => loadPace("bot"));
  const setPace = (p) => { setPaceState(p); savePace("bot", p); };
  const bot = BOTS[botIdx];

  const myTurn = stage === "playing" && eng.getSide() === side && !thinking;
  const friends = stage === "playing" ? friendlySquares(eng, side) : [];
  const selected = friends[Math.min(selectedIdx, friends.length - 1)];
  const legal = myTurn ? eng.legalMoves() : [];
  const movesFrom = legal.filter((m) => sqOf(mFrom(m)) === selected);
  const targets = [...new Set(movesFrom.map((m) => sqOf(mTo(m))))];
  const captures = targets.filter((sq) => eng.pieceAt(sq) !== EMPTY);
  const canMove = myTurn && view === "close" && !busy;

  const piecesNow = () => {
    const list = [];
    for (let sq = 0; sq < 64; sq++) {
      const p = eng.pieceAt(sq);
      if (p !== EMPTY) list.push({ sq, type: Math.abs(p), white: p > 0 });
    }
    return list;
  };

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
    });
    sceneRef.current = scene;
    scene.setBonds(levelsOf(loadBonds()));
    const bin = dressTrashBin(scene);
    scene.everyFrame.push((dt) => bin.update(dt));
    eng.reset();
    scene.setPieces(piecesNow());
    scene.showBoard();
    /* Leaving bumps the game id on purpose, so a bot reply still on its way
       is dropped instead of landing on a scene that is gone. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { gameIdRef.current++; scene.dispose(); sceneRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sweetheart]);

  useEffect(() => { warmUpStockfish(); }, []);

  /* ---- Camera and highlights ---- */
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || draggingRef.current || stage !== "playing" || busy) return;
    if (view === "board") scene.showBoard();
    else scene.showReach(selected, targets);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, selected, moveList, stage, busy]);
  useEffect(() => {
    const show = myTurn && view === "close" && !busy;
    sceneRef.current?.setMarks(show ? { selected, held: true, ghost: draggingRef.current, targets, chosen, captures, confirm: true } : {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, selected, chosen, moveList, stage, busy, thinking]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e) => { if (e.key === "Escape") setMenuOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  /* ---- The game ---- */
  const animate = async (move, follow) => {
    const scene = sceneRef.current;
    const from = sqOf(mFrom(move)), to = sqOf(mTo(move));
    const captured = eng.pieceAt(to) !== EMPTY ? to : null;
    const knight = Math.abs(eng.pieceAt(from)) === KNIGHT;
    const san = eng.sanOf(move);
    await scene?.animateMove(from, to, { knight, captured, follow, pace });
    eng.make(move);
    scene?.syncPieces(piecesNow());
    return san;
  };

  /** Ends the game if the rules say it's over. */
  const checkOver = () => {
    const res = gameResult(eng);
    if (!res) return false;
    setResult(res);
    setStage("over");
    sceneRef.current?.setMarks({});
    return true;
  };

  const botTurn = async (list) => {
    const game = gameIdRef.current;
    setThinking(true);
    const started = performance.now();
    const move = await botMove(eng, list, bot).catch(() => null);
    await wait(Math.max(0, MIN_THINK_MS - (performance.now() - started)));
    if (game !== gameIdRef.current) return;
    if (!move) { setThinking(false); return; }
    busyRef.current = true;
    setBusy(true);
    try {
      const san = await animate(move, true);
      if (game !== gameIdRef.current) return;
      setMoveList([...list, san]);
      checkOver();
    } finally {
      /* Your turn starts once the bot's move has finished playing out. */
      setThinking(false);
      busyRef.current = false;
      setBusy(false);
    }
  };

  const start = () => {
    gameIdRef.current++;
    saveSetting("tacticaBotIdx", botIdx);
    saveSetting("tacticaBotColour", colourPick);
    const s = colourPick === "random" ? (Math.random() < 0.5 ? 1 : -1) : colourPick === "black" ? -1 : 1;
    eng.reset();
    setSide(s);
    setMoveList([]);
    setSelectedIdx(0);
    setChosen(null);
    setResult(null);
    setView("board");
    setThinking(false);
    setStage("playing");
    const scene = sceneRef.current;
    scene?.setFlipped(s === -1);
    scene?.setPieces(piecesNow());
    scene?.showBoard();
    if (s === -1) botTurn([]);
  };

  const play = async (target) => {
    if (busyRef.current || !myTurn) return;
    const move = movesFrom.find((m) => sqOf(mTo(m)) === target && (!mPromo(m) || mPromo(m) === QUEEN));
    if (!move) return;
    busyRef.current = true;
    setBusy(true);
    setChosen(null);
    let list;
    try {
      const san = await animate(move, false);
      list = [...moveList, san];
      setMoveList(list);
      const stillHere = friendlySquares(eng, side).indexOf(target);
      setSelectedIdx((i) => (stillHere >= 0 ? stillHere : Math.min(i, friendlySquares(eng, side).length - 1)));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
    if (!checkOver()) botTurn(list);
  };

  const resign = () => {
    gameIdRef.current++;
    setMenuOpen(false);
    setThinking(false);
    setResult({ text: side === 1 ? "0–1" : "1–0", reason: "Resigned", winner: -side, resigned: true });
    setStage("over");
    sceneRef.current?.setMarks({});
  };

  /* ---- Input ---- */
  const cycle = (dir) => {
    if (busy || !friends.length) return;
    setChosen(null);
    setSelectedIdx((i) => (i + dir + friends.length) % friends.length);
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
    draggingRef.current = true;
    setSelectedIdx(idx);
    setChosen(null);
    return true;
  };
  const dropRef = useRef(null);
  dropRef.current = (sq) => {
    draggingRef.current = false;
    if (sq != null && targets.includes(sq)) { play(sq); return true; }
    return false;
  };
  const toggleView = () => { if (!busy) setView((v) => (v === "board" ? "close" : "board")); };
  const squareName = (sq) => `${"abcdefgh"[sq % 8]}${((sq / 8) | 0) + 1}`;
  const pieceName = (sq) => ["", "Pawn", "Knight", "Bishop", "Rook", "Queen", "King"][Math.abs(eng.pieceAt(sq))] + ` on ${squareName(sq)}`;
  const isAttack = chosen != null && captures.includes(chosen);
  const inCheck = stage === "playing" && eng.getSide() === side && eng.inCheckNow();
  const hint = thinking ? `${bot.label} is thinking…` : busy ? "…"
    : view === "board" ? "Tap a character to take a closer look"
    : !targets.length ? "This one can't move"
    : chosen != null ? (isAttack ? `Tap ${squareName(chosen)} again to strike` : `Tap ${squareName(chosen)} again to move`)
    : "Tap a glowing square, or drag there";
  const iconBtn = "flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/20 bg-black/45 text-lg text-white disabled:opacity-35 " + focusRing;
  const option = (on) => "cursor-pointer rounded-xl border px-3 py-2 text-left text-sm " + (on ? "border-[var(--cyan)] bg-[var(--cyan)]/15 text-white " : "border-white/15 bg-black/40 text-white/85 ") + focusRing;
  const lastMove = moveList.length ? `${Math.ceil(moveList.length / 2)}${moveList.length % 2 ? "." : "…"} ${moveList[moveList.length - 1]}` : null;

  return (
    <div className="relative mx-auto w-full max-w-[480px] overflow-hidden" style={{ height: "calc(100dvh - var(--headerH))" }}>
      <canvas ref={canvasRef} className="absolute inset-0 block size-full touch-none" />

      {stage === "playing" && (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 bg-gradient-to-b from-black/70 to-transparent p-3 pb-8">
            <div className="flex items-start gap-2">
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                aria-label="Game menu"
                aria-expanded={menuOpen}
                className={"pointer-events-auto flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/20 bg-black/45 text-white " + focusRing}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M5 10a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm7 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm7 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z" /></svg>
              </button>
              <div className="text-white">
                <div className="text-[10px] uppercase tracking-wide text-white/60">vs {bot.label}</div>
                <div className="text-sm font-bold" aria-live="polite">{inCheck ? "Check!" : thinking ? "Bot to move" : "Your move"}</div>
                {lastMove && <div className="text-xs text-white/70" style={{ fontFamily: "var(--font-mono)" }}>{lastMove}</div>}
              </div>
            </div>
            <button
              type="button"
              onClick={toggleView}
              aria-label={view === "board" ? "Back to the close view" : "Show the whole board"}
              aria-pressed={view === "board"}
              className={"pointer-events-auto shrink-0 cursor-pointer rounded-lg border-2 bg-black/40 p-1 " + (view === "board" ? "border-[var(--cyan)] " : "border-white/30 ") + focusRing}
            >
              <MiniBoard fen={eng.fen()} colors={SET_BOARD} pieceImgSrc={pieceImgSrc} size={64} flipped={side === -1} label="Map of the board" />
            </button>
          </div>

          {menuOpen && (
            <>
              <button type="button" aria-label="Close the menu" className="absolute inset-0 cursor-default border-0 bg-transparent" onClick={() => setMenuOpen(false)} />
              <div className="absolute top-14 left-3 flex w-56 flex-col gap-3 rounded-xl border border-white/15 bg-black/80 p-3 text-white backdrop-blur-sm">
                <PaceControl value={pace} onChange={setPace} />
                <button type="button" className={"btn ghost " + focusRing} onClick={resign}>Resign</button>
                <button type="button" className={"btn ghost " + focusRing} onClick={() => { gameIdRef.current++; onExit(); }}>Main menu</button>
              </div>
            </>
          )}

          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent px-3 pt-8 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            <button type="button" className={iconBtn} onClick={() => cycle(-1)} disabled={busy} aria-label="Previous character">‹</button>
            <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5 text-center">
              <span className="truncate text-sm font-bold text-white">{selected != null && view === "close" ? pieceName(selected) : `You play ${side === 1 ? "White" : "Black"}`}</span>
              <span className={"truncate text-xs " + (isAttack ? "font-bold text-[var(--yellow)]" : "text-white/75")} aria-live="polite">{hint}</span>
            </div>
            <button type="button" className={iconBtn} onClick={() => cycle(1)} disabled={busy} aria-label="Next character">›</button>
          </div>
        </>
      )}

      {stage === "setup" && (
        <div className="absolute inset-0 flex flex-col justify-center gap-3 overflow-y-auto bg-black/65 p-5 text-white">
          <h2 className="m-0 text-center text-2xl" style={{ fontFamily: "var(--font-display)" }}>Play a bot</h2>
          <p className="m-0 text-center text-sm text-white/80">A full game in the bin. Not rated.</p>
          <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
            <legend className="mb-1 text-[10px] uppercase tracking-wide text-white/60">Opponent</legend>
            {BOTS.map((b, i) => (
              <button key={b.label} type="button" aria-pressed={i === botIdx} className={option(i === botIdx)} onClick={() => setBotIdx(i)}>
                {b.label}{b.ms ? " · strongest, thinks longer" : ""}
              </button>
            ))}
          </fieldset>
          <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
            <legend className="mb-1 text-[10px] uppercase tracking-wide text-white/60">You play</legend>
            <div className="flex gap-1.5">
              {[["white", "White"], ["black", "Black"], ["random", "Random"]].map(([id, name]) => (
                <button key={id} type="button" aria-pressed={colourPick === id} className={option(colourPick === id) + " flex-1 text-center"} onClick={() => setColourPick(id)}>{name}</button>
              ))}
            </div>
          </fieldset>
          <PaceControl value={pace} onChange={setPace} />
          <button type="button" className={"btn gold self-center " + focusRing} onClick={start}>Start the game</button>
          <button type="button" className={"btn ghost self-center " + focusRing} onClick={onExit}>Menu</button>
        </div>
      )}

      {stage === "over" && result && (
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 bg-gradient-to-t from-black/90 via-black/70 to-transparent px-5 pt-20 pb-[calc(1rem+env(safe-area-inset-bottom))] text-center text-white">
          <h2 className="m-0 text-2xl" style={{ fontFamily: "var(--font-display)" }}>
            {result.resigned ? "You resigned" : result.winner === side ? "You win!" : result.winner ? `${bot.label} wins` : "Draw"}
          </h2>
          <p className="m-0 text-sm text-white/80">{result.resigned ? `${result.text}` : `${resultSentence(result, side)} ${result.text}`} · {Math.ceil(moveList.length / 2)} moves</p>
          <button type="button" className={"btn gold " + focusRing} onClick={start}>Play again</button>
          <button type="button" className={"btn ghost " + focusRing} onClick={() => setStage("setup")}>Change bot</button>
          <button type="button" className={"border-0 bg-transparent text-xs text-white/75 underline " + focusRing} onClick={onExit}>Main menu</button>
        </div>
      )}
    </div>
  );
}
