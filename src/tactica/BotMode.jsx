import { useEffect, useRef, useState } from "react";
import { createEngine, mFrom, mPromo, mTo, M120TO64, EMPTY } from "../engine/chessEngine";
import { stockfishBestMove, warmUpStockfish } from "../engine/stockfishEngine";
import { DIFFICULTIES } from "../utils/difficulties";
import { gameResult, resultSentence } from "../utils/gameResult";
import { loadSetting, saveSetting } from "../utils/storage";
import { TacticaScene, SET_BOARD } from "./scene";
import { dressTrashBin } from "./sets/trashBin";
import { BrassButton, MapButton, MenuButton, useViewSource } from "./ui";
import { play as playSound } from "./sound";
import { loadBonds, levelsOf } from "./bonds";

/* Regular Chess in the bin: a full game on the 3D board against the site's own
   bots (the 1000, 1500 and 2000 Elo Stockfish levels and the homemade
   Engine). Rank Bot is left out here: its games feed your rank, and a game
   in the bin isn't rated. Same controls as the tutorial; promotions become
   a queen. */
const BOTS = DIFFICULTIES.filter((d) => d.id !== "rank");
const KNIGHT = 2, QUEEN = 5;
const sqOf = (sq120) => M120TO64[sq120];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
/* A bot never answers faster than this, so its move doesn't land before
   yours has finished. */
const MIN_THINK_MS = 400;

/** Your characters, front rank first, left to right as you look at the board. */
export function friendlySquares(eng, side) {
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
  try {
    /* A stuck engine falls back too, after a fair wait. */
    const limit = (bot.ms || bot.moveTimeMs || 1000) + 5000;
    const move = await Promise.race([searchFor(eng, moveList, bot), wait(limit).then(() => null)]);
    if (move) return move;
  } catch { /* fall back below */ }
  const local = createEngine();
  local.loadFen(eng.fen());
  const found = local.search(400, bot.blunderChance || 0)?.move;
  return found ? eng.legalMoves().find((m) => m === found) ?? null : null;
}

async function searchFor(eng, moveList, bot) {
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
  /* A drag in progress. The camera and highlights catch up when it ends. */
  const [dragging, setDragging] = useState(false);
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
  /* What the camera sees, for the map's view cone. */
  const viewSource = useViewSource();
  /* Regular Chess always plays the full attacks. */
  const pace = "full";
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
      onView: (v) => viewSource.set(v),
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
    if (!scene || dragging || stage !== "playing" || busy) return;
    if (view === "board") scene.showBoard();
    else scene.showReach(selected, targets);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, selected, moveList, stage, busy, dragging]);
  useEffect(() => {
    const show = myTurn && view === "close" && !busy;
    sceneRef.current?.setMarks(show ? { selected, held: true, ghost: dragging, targets, chosen, captures, confirm: true } : {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, selected, chosen, moveList, stage, busy, thinking, dragging]);

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
    const game = gameIdRef.current;
    await scene?.animateMove(from, to, { knight, captured, follow, pace });
    /* A new game started while it played: this move isn't part of it. */
    if (game !== gameIdRef.current) return null;
    eng.make(move);
    scene?.syncPieces(piecesNow());
    return san;
  };

  /** Ends the game if the rules say it's over. */
  const checkOver = () => {
    const res = gameResult(eng);
    if (!res) {
      if (eng.inCheckNow()) playSound("metal", { volume: 0.7, delay: 0.1 });
      return false;
    }
    playSound(res.winner === side ? "confirm" : res.winner ? "error" : "chime", { volume: 0.8 });
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
    const game = gameIdRef.current;
    let list;
    try {
      const san = await animate(move, false);
      if (game !== gameIdRef.current) return;
      list = [...moveList, san];
      setMoveList(list);
      const stillHere = friendlySquares(eng, side).indexOf(target);
      setSelectedIdx((i) => (stillHere >= 0 ? stillHere : Math.min(i, friendlySquares(eng, side).length - 1)));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
    if (game === gameIdRef.current && !checkOver()) botTurn(list);
  };

  const resign = () => {
    gameIdRef.current++;
    setMenuOpen(false);
    setThinking(false);
    setResult({ text: side === 1 ? "0–1" : "1–0", reason: "Resigned", winner: -side, resigned: true });
    playSound("error", { volume: 0.5 });
    setStage("over");
    sceneRef.current?.setMarks({});
  };

  /* ---- Input ---- */
  const cycle = (dir) => {
    if (busy || !friends.length) return;
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
  const lastMove = moveList.length ? `${Math.ceil(moveList.length / 2)}${moveList.length % 2 ? "." : "…"} ${moveList[moveList.length - 1]}` : null;

  return (
    <div className="relative mx-auto w-full max-w-[480px] overflow-hidden" style={{ height: "calc(100dvh - var(--headerH))" }}>
      <canvas ref={canvasRef} className="absolute inset-0 block size-full touch-none" />

      {stage === "playing" && (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 bg-gradient-to-b from-black/80 to-transparent p-3 pb-10">
            <div className="flex items-center gap-2.5">
              <MenuButton open={menuOpen} onClick={() => setMenuOpen((o) => !o)} />
              <div>
                <div className="tc-label">vs {bot.label}</div>
                <div className="tc-display text-[15px]" aria-live="polite">{inCheck ? "Check!" : thinking ? "Bot to move" : "Your move"}</div>
                {lastMove && <div className="text-sm text-[var(--tc-cream-dim)]" style={{ fontFamily: "var(--font-mono)" }}>{lastMove}</div>}
              </div>
            </div>
            <MapButton
              fen={eng.fen()}
              pieceImgSrc={pieceImgSrc}
              size={88}
              flipped={side === -1}
              view={view}
              selected={selected}
              viewSource={viewSource}
              onToggle={toggleView}
              onSpin={(a) => sceneRef.current?.spinBy(a)}
            />
          </div>

          {menuOpen && (
            <>
              <button type="button" aria-label="Close the menu" className="absolute inset-0 cursor-default border-0 bg-transparent" onClick={() => setMenuOpen(false)} />
              <div className="tc-panel absolute top-16 left-3 flex w-56 flex-col gap-3 p-3">
                <button type="button" className="tc-plank tc-center tc-small" onClick={() => setMenuOpen(false)}>Resume</button>
                <button type="button" className="tc-plank tc-center tc-small" onClick={resign}>Resign</button>
                <button type="button" className="tc-plank tc-center tc-small" onClick={() => { gameIdRef.current++; onExit(); }}>Back to the menu</button>
              </div>
            </>
          )}

          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/80 to-transparent px-3 pt-10 pb-[calc(0.9rem+env(safe-area-inset-bottom))]">
            <button type="button" className="tc-round" onClick={() => cycle(-1)} disabled={busy} aria-label="Previous character">‹</button>
            <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5 text-center">
              <span className="tc-display truncate text-[15px]">{selected != null && view === "close" ? pieceName(selected) : `You play ${side === 1 ? "White" : "Black"}`}</span>
              <span className={"truncate text-sm " + (isAttack ? "font-bold text-[var(--tc-gold-hi)]" : "text-[var(--tc-cream-dim)]")} aria-live="polite">{hint}</span>
            </div>
            <button type="button" className="tc-round" onClick={() => cycle(1)} disabled={busy} aria-label="Next character">›</button>
          </div>
        </>
      )}

      {stage === "setup" && (
        <div className="tc-scrim absolute inset-0 flex flex-col justify-center gap-4 overflow-y-auto p-5">
          <div className="text-center">
            <h2 className="tc-title m-0 text-[28px]">Regular Chess</h2>
            <p className="m-0 mt-1 text-base text-[var(--tc-cream-dim)]">A full game in the bin. Not rated.</p>
          </div>
          <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
            <legend className="tc-label mb-2">Opponent</legend>
            {BOTS.map((b, i) => (
              <button key={b.label} type="button" aria-pressed={i === botIdx} className="tc-plank tc-small" onClick={() => setBotIdx(i)}>
                {b.label}{b.ms ? " · thinks longer" : ""}
              </button>
            ))}
          </fieldset>
          <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
            <legend className="tc-label mb-2">You play</legend>
            <div className="flex gap-2.5">
              {[["white", "White"], ["black", "Black"], ["random", "Random"]].map(([id, name]) => (
                <button key={id} type="button" aria-pressed={colourPick === id} className="tc-plank tc-small tc-center flex-1" onClick={() => setColourPick(id)}>{name}</button>
              ))}
            </div>
          </fieldset>
          <BrassButton className="self-center" onClick={start}>Start the game</BrassButton>
          <button type="button" className="tc-link self-center" onClick={onExit}>Back to the menu</button>
        </div>
      )}

      {stage === "over" && result && (
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 bg-gradient-to-t from-black/90 via-black/70 to-transparent px-5 pt-20 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-center">
          <h2 className="tc-title m-0 text-[28px]">
            {result.resigned ? "You resigned" : result.winner === side ? "You win!" : result.winner ? `${bot.label} wins` : "Draw"}
          </h2>
          <p className="m-0 text-base text-[var(--tc-cream-dim)]">{result.resigned ? `${result.text}` : `${resultSentence(result, side)} ${result.text}`} · {Math.ceil(moveList.length / 2)} moves</p>
          <BrassButton onClick={start}>Play again</BrassButton>
          <div className="flex gap-4">
            <button type="button" className="tc-link" onClick={() => setStage("setup")}>Change bot</button>
            <button type="button" className="tc-link" onClick={onExit}>Back to the menu</button>
          </div>
        </div>
      )}
    </div>
  );
}
