import { useEffect, useRef, useState } from "react";
import { createEngine, mFrom, mPromo, mTo, M120TO64, EMPTY } from "../engine/chessEngine";
import { stockfishBestMove, warmUpStockfish } from "../engine/stockfishEngine";
import { DIFFICULTIES } from "../utils/difficulties";
import { gameResult, resultSentence } from "../utils/gameResult";
import { loadSetting, saveSetting } from "../utils/storage";
import { TacticaScene, SET_BOARD } from "./scene";
import { dressTrashBin } from "./sets/trashBin";
import { BrassButton, MapButton, MenuButton, PromotionPicker, useViewSource } from "./ui";
import { play as playSound } from "./sound";
import { applyStory } from "./bonds";
import { useBestMove, scoreLabel } from "../utils/useBestMove";

/* Regular Chess in the bin: a full game on the 3D board against the site's own
   bots (the 1000, 1500 and 2000 Elo Stockfish levels and the homemade
   Engine). Rank Bot is left out here: its games feed your rank, and a game
   in the bin isn't rated. Same controls as the tutorial; a pawn reaching
   the last rank asks which piece it becomes. A game in progress is saved
   on the device after every move and can be resumed; the menu can take
   back your last move, and lists the moves so far.

   With `self` it is Play with yourself instead: no bot, you move both sides
   to try out ideas, the board turns to whoever is to move, and Analysis
   draws Stockfish's best move as an arrow on the board. Either way, a
   finished game can be stepped through with the best move drawn for every
   position (Analyse the game). */
const BOTS = DIFFICULTIES.filter((d) => d.id !== "rank");
const KNIGHT = 2, QUEEN = 5;
const sqOf = (sq120) => M120TO64[sq120];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
/* A bot never answers faster than this, so its move doesn't land before
   yours has finished. */
const MIN_THINK_MS = 400;
/* The game in progress, saved after every move: { bot, side, moves }. */
const SAVE = "tacticaBotGame";
const SELF_SAVE = "tacticaSelfGame";
/* Analysis arrows: the engine's best move, and the move actually played. */
const BEST_COLOR = "#3FE07A", PLAYED_COLOR = "#5AA8FF";
const loadSaved = () => {
  const g = loadSetting(SAVE, null);
  return g && Array.isArray(g.moves) && (g.side === 1 || g.side === -1) && Number.isInteger(g.bot) ? g : null;
};

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

export default function BotMode({ pieceImgSrc, sweetheart, onExit, self = false }) {
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const engRef = useRef(createEngine());
  const eng = engRef.current;
  const busyRef = useRef(false);
  /* A drag in progress. The camera and highlights catch up when it ends. */
  const [dragging, setDragging] = useState(false);
  /* Bumped for every new game, so a bot reply from an old game is dropped. */
  const gameIdRef = useRef(0);

  const [stage, setStage] = useState(self ? "playing" : "setup"); // setup | playing | over | review
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
  /* The square a pawn is promoting on, while the player picks the piece. */
  const [promoting, setPromoting] = useState(null);
  /* A game left unfinished, offered on the setup screen. */
  const [saved, setSaved] = useState(loadSaved);
  /* Who this game is against and which side you play, for saving it (a ref,
     so a bot move finishing later saves the right game). */
  const gameRef = useRef({ bot: 0, side: 1 });
  /* What the camera sees, for the map's view cone. */
  const viewSource = useViewSource();
  /* Play with yourself: the best-move arrow on, and the board turning to
     whoever is to move. */
  const [analysing, setAnalysing] = useState(false);
  const [turnBoard, setTurnBoard] = useState(() => loadSetting("tacticaSelfTurn", true));
  /* Analysing a finished game: how many of its moves are on the board. */
  const [reviewIdx, setReviewIdx] = useState(0);
  /* Regular Chess always plays the full attacks. */
  const pace = "full";
  const bot = BOTS[botIdx];

  /* Whose characters you move: in Play with yourself, whoever is to move. */
  const mover = self ? eng.getSide() : side;
  const myTurn = stage === "playing" && eng.getSide() === mover && !thinking;
  const friends = stage === "playing" ? friendlySquares(eng, mover) : [];
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

  /* ---- Analysis ---- */
  const fen = eng.fen();
  const reviewing = stage === "review";
  const best = useBestMove(fen, reviewing || (self && analysing && stage === "playing" && !gameResult(eng)));
  /* The move that was played from this position, while stepping through. */
  const playedSan = reviewing ? moveList[reviewIdx] ?? null : null;
  const played = playedSan ? eng.legalMoves().find((m) => eng.sanOf(m) === playedSan) : undefined;
  const hints = [];
  if (best && !best.none && (reviewing || (analysing && stage === "playing" && !busy))) hints.push({ from: sqOf(best.from), to: sqOf(best.to), color: BEST_COLOR });
  if (played !== undefined && !(best && best.san === playedSan)) hints.push({ from: sqOf(mFrom(played)), to: sqOf(mTo(played)), color: PLAYED_COLOR });
  const hintKey = hints.map((h) => `${h.from}-${h.to}-${h.color}`).join(",");
  useEffect(() => {
    sceneRef.current?.setHints(hints);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hintKey]);

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
    applyStory(scene);
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
    forget();
    setResult(res);
    setStage("over");
    sceneRef.current?.setMarks({});
    return true;
  };

  const botTurn = (list) => botTurnWith(list, bot);
  const botTurnWith = async (list, bot) => {
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
      const next = [...list, san];
      setMoveList(next);
      if (!checkOver()) remember(next);
    } finally {
      /* Your turn starts once the bot's move has finished playing out. */
      setThinking(false);
      busyRef.current = false;
      setBusy(false);
    }
  };

  /** Saves the game in progress after a move; a finished one is forgotten. */
  const remember = (moves) => (self ? saveSetting(SELF_SAVE, moves) : saveSetting(SAVE, { ...gameRef.current, moves }));
  const forget = () => { saveSetting(self ? SELF_SAVE : SAVE, null); setSaved(null); };

  /** Picks up a saved game where it was left. */
  const resume = () => {
    const g = saved;
    if (!g) return;
    gameIdRef.current++;
    eng.reset();
    const played = [];
    for (const san of g.moves) {
      const move = eng.legalMoves().find((m) => eng.sanOf(m) === san);
      if (!move) break;
      eng.make(move);
      played.push(san);
    }
    const idx = Math.min(BOTS.length - 1, Math.max(0, g.bot));
    gameRef.current = { bot: idx, side: g.side };
    setBotIdx(idx);
    setSide(g.side);
    setMoveList(played);
    setSelectedIdx(0);
    setChosen(null);
    setResult(null);
    setView("board");
    setThinking(false);
    setStage("playing");
    const scene = sceneRef.current;
    scene?.setFlipped(g.side === -1);
    scene?.setPieces(piecesNow());
    scene?.showBoard();
    if (gameResult(eng)) { checkOver(); return; }
    /* Left while the bot was to move: it moves now. */
    if (eng.getSide() !== g.side) botTurnWith(played, BOTS[idx]);
  };

  /** Takes back your last move (and the bot's answer to it). */
  const takeBack = () => {
    if (busyRef.current || !canTakeBack) return;
    gameIdRef.current++;
    setThinking(false);
    /* On your turn: your move and the bot's answer. While it thinks: yours.
       Playing yourself: just the last move. */
    const plies = self ? 1 : eng.getSide() === side ? 2 : 1;
    for (let i = 0; i < plies; i++) eng.unmake();
    const list = moveList.slice(0, moveList.length - plies);
    setMoveList(list);
    remember(list);
    setChosen(null);
    setMenuOpen(false);
    if (self && turnBoard) sceneRef.current?.setFlipped(eng.getSide() === -1);
    sceneRef.current?.setPieces(piecesNow());
    sceneRef.current?.showBoard();
    setSelectedIdx(0);
    setView("board");
    playSound("swish", { volume: 0.5 });
  };
  /* Whether there is a move of yours to take back. */
  const canTakeBack = stage === "playing" && !busy && (self ? moveList.length > 0 : moveList.length >= (eng.getSide() === side ? 2 : 1) && (side === 1 || moveList.length > 1));

  const start = () => {
    gameIdRef.current++;
    forget();
    saveSetting("tacticaBotIdx", botIdx);
    saveSetting("tacticaBotColour", colourPick);
    const s = colourPick === "random" ? (Math.random() < 0.5 ? 1 : -1) : colourPick === "black" ? -1 : 1;
    gameRef.current = { bot: botIdx, side: s };
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

  /** Play with yourself: a fresh board, or `moves` already played on it. */
  const startSelf = (moves = []) => {
    gameIdRef.current++;
    eng.reset();
    const played = [];
    for (const san of moves) {
      const move = eng.legalMoves().find((m) => eng.sanOf(m) === san);
      if (!move) break;
      eng.make(move);
      played.push(san);
    }
    gameRef.current = { bot: 0, side: 1 };
    setSide(1);
    setMoveList(played);
    remember(played);
    setSelectedIdx(0);
    setChosen(null);
    setResult(null);
    setView("board");
    setThinking(false);
    setStage("playing");
    const scene = sceneRef.current;
    scene?.setFlipped(turnBoard && eng.getSide() === -1);
    scene?.setPieces(piecesNow());
    scene?.showBoard();
    if (gameResult(eng)) checkOver();
  };
  /* Play with yourself opens straight onto the board, where you left it. */
  useEffect(() => {
    if (!self) return;
    const moves = loadSetting(SELF_SAVE, []);
    startSelf(Array.isArray(moves) ? moves : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [self, sweetheart]);

  /** Steps a finished game to `i` moves in, for Analyse the game. */
  const reviewTo = (i) => {
    const idx = Math.max(0, Math.min(moveList.length, i));
    eng.reset();
    for (const san of moveList.slice(0, idx)) {
      const move = eng.legalMoves().find((m) => eng.sanOf(m) === san);
      if (!move) break;
      eng.make(move);
    }
    setReviewIdx(idx);
    const scene = sceneRef.current;
    scene?.setPieces(piecesNow());
    scene?.showBoard();
  };
  const startReview = () => {
    gameIdRef.current++;
    setMenuOpen(false);
    setStage("review");
    sceneRef.current?.setMarks({});
    reviewTo(moveList.length);
  };
  /** Back from the review to the result, with the final position. */
  const endReview = () => {
    reviewTo(moveList.length);
    setStage(result ? "over" : "playing");
  };
  /* Arrow keys step through the review, like the site's Game Review. */
  useEffect(() => {
    if (!reviewing) return undefined;
    const onKey = (e) => {
      const step = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
      if (step) { e.preventDefault(); reviewTo(reviewIdx + step); }
      else if (e.key === "Escape") endReview();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewing, reviewIdx, moveList]);

  const play = async (target, piece = null) => {
    if (busyRef.current || !myTurn) return;
    const found = movesFrom.filter((m) => sqOf(mTo(m)) === target);
    /* Several moves to one square is a promotion: ask which piece first. */
    if (found.length > 1 && piece == null) { setPromoting(target); return; }
    const move = found.find((m) => !mPromo(m) || mPromo(m) === (piece ?? QUEEN));
    if (!move) return;
    setPromoting(null);
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
      remember(list);
      if (self) {
        /* The other side's turn: back to the whole board, turned to them. */
        setSelectedIdx(0);
        setView("board");
        if (turnBoard) sceneRef.current?.setFlipped(eng.getSide() === -1);
      } else {
        const stillHere = friendlySquares(eng, side).indexOf(target);
        setSelectedIdx((i) => (stillHere >= 0 ? stillHere : Math.min(i, friendlySquares(eng, side).length - 1)));
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
    if (game === gameIdRef.current && !checkOver() && !self) botTurn(list);
  };

  const resign = () => {
    gameIdRef.current++;
    forget();
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
  const inCheck = stage === "playing" && eng.getSide() === mover && eng.inCheckNow();
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
                <div className="tc-label">{self ? "Play with yourself" : `vs ${bot.label}`}</div>
                <div className="tc-display text-[15px]" aria-live="polite">{inCheck ? "Check!" : self ? `${mover === 1 ? "White" : "Black"} to move` : thinking ? "Bot to move" : "Your move"}</div>
                {lastMove && <div className="text-sm text-[var(--tc-cream-dim)]" style={{ fontFamily: "var(--font-mono)" }}>{lastMove}</div>}
                {self && (
                  <div className="pointer-events-auto mt-1.5 flex items-center gap-2">
                    <button type="button" className="tc-plank tc-center tc-small" style={{ width: 112 }} aria-pressed={analysing} onClick={() => setAnalysing((a) => !a)}>
                      {analysing ? "Analysis on" : "Analysis"}
                    </button>
                    {analysing && <span className="text-sm text-[var(--tc-gold-hi)]" aria-live="polite">{!best ? "Thinking…" : best.none ? "" : `${best.san} · ${scoreLabel(best.score)}`}</span>}
                  </div>
                )}
              </div>
            </div>
            <MapButton
              fen={eng.fen()}
              pieceImgSrc={pieceImgSrc}
              size={88}
              flipped={self ? turnBoard && mover === -1 : side === -1}
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
                <button type="button" className="tc-plank tc-center tc-small" onClick={takeBack} disabled={!canTakeBack}>{self ? "Take back a move" : "Take back my move"}</button>
                {self ? (
                  <>
                    <button type="button" className="tc-plank tc-center tc-small" aria-pressed={turnBoard} onClick={() => {
                      const on = !turnBoard;
                      setTurnBoard(on);
                      saveSetting("tacticaSelfTurn", on);
                      sceneRef.current?.setFlipped(on && eng.getSide() === -1);
                      sceneRef.current?.showBoard();
                    }}>Turn the board: {turnBoard ? "On" : "Off"}</button>
                    <button type="button" className="tc-plank tc-center tc-small" onClick={startReview} disabled={!moveList.length}>Step through the moves</button>
                    <button type="button" className="tc-plank tc-center tc-small" onClick={() => { setMenuOpen(false); forget(); startSelf([]); }}>Start over</button>
                  </>
                ) : (
                  <button type="button" className="tc-plank tc-center tc-small" onClick={resign}>Resign</button>
                )}
                {moveList.length > 0 && (
                  <div>
                    <div className="tc-label mb-1">Moves</div>
                    <ol className="m-0 grid max-h-40 list-none grid-cols-[auto_1fr_1fr] gap-x-2 overflow-y-auto p-0 text-sm" style={{ fontFamily: "var(--font-mono)" }}>
                      {Array.from({ length: Math.ceil(moveList.length / 2) }, (_, i) => (
                        <li key={i} className="contents">
                          <span className="text-[var(--tc-cream-dim)]">{i + 1}.</span>
                          <span>{moveList[i * 2]}</span>
                          <span>{moveList[i * 2 + 1] ?? ""}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                <button type="button" className="tc-plank tc-center tc-small" onClick={() => { gameIdRef.current++; onExit(); }}>Back to the menu</button>
              </div>
            </>
          )}

          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/80 to-transparent px-3 pt-10 pb-[calc(0.9rem+env(safe-area-inset-bottom))]">
            <button type="button" className="tc-round" onClick={() => cycle(-1)} disabled={busy} aria-label="Previous character">‹</button>
            <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5 text-center">
              <span className="tc-display truncate text-[15px]">{selected != null && view === "close" ? pieceName(selected) : self ? `${mover === 1 ? "White" : "Black"}'s characters` : `You play ${side === 1 ? "White" : "Black"}`}</span>
              <span className={"truncate text-sm " + (isAttack ? "font-bold text-[var(--tc-gold-hi)]" : "text-[var(--tc-cream-dim)]")} aria-live="polite">{hint}</span>
            </div>
            <button type="button" className="tc-round" onClick={() => cycle(1)} disabled={busy} aria-label="Next character">›</button>
          </div>
        </>
      )}

      {promoting != null && stage === "playing" && (
        <PromotionPicker onPick={(piece) => play(promoting, piece)} onCancel={() => setPromoting(null)} />
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
          {saved && saved.moves.length > 0 && (
            <div className="tc-panel flex flex-col items-center gap-2 p-3 text-center">
              <span className="text-sm text-[var(--tc-cream-dim)]">Unfinished game vs {BOTS[Math.min(BOTS.length - 1, Math.max(0, saved.bot))].label}, {Math.ceil(saved.moves.length / 2)} moves in, you play {saved.side === 1 ? "White" : "Black"}</span>
              <BrassButton onClick={resume}>Resume that game</BrassButton>
            </div>
          )}
          <BrassButton className="self-center" onClick={start}>{saved && saved.moves.length > 0 ? "Start a new game" : "Start the game"}</BrassButton>
          <button type="button" className="tc-link self-center" onClick={onExit}>Back to the menu</button>
        </div>
      )}

      {stage === "over" && result && (
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 bg-gradient-to-t from-black/90 via-black/70 to-transparent px-5 pt-20 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-center">
          <h2 className="tc-title m-0 text-[28px]">
            {self ? (result.winner ? `${result.winner === 1 ? "White" : "Black"} wins` : "Draw")
              : result.resigned ? "You resigned" : result.winner === side ? "You win!" : result.winner ? `${bot.label} wins` : "Draw"}
          </h2>
          <p className="m-0 text-base text-[var(--tc-cream-dim)]">{self ? `${result.reason}. ${result.text}` : result.resigned ? `${result.text}` : `${resultSentence(result, side)} ${result.text}`} · {Math.ceil(moveList.length / 2)} {Math.ceil(moveList.length / 2) === 1 ? "move" : "moves"}</p>
          <div className="flex flex-wrap justify-center gap-3">
            {moveList.length > 0 && <button type="button" className="tc-plank tc-center tc-small" style={{ width: 170 }} onClick={startReview}>Analyse the game</button>}
            <BrassButton onClick={self ? () => { forget(); startSelf([]); } : start}>{self ? "New board" : "Play again"}</BrassButton>
          </div>
          <div className="flex gap-4">
            {!self && <button type="button" className="tc-link" onClick={() => setStage("setup")}>Change bot</button>}
            <button type="button" className="tc-link" onClick={onExit}>Back to the menu</button>
          </div>
        </div>
      )}

      {reviewing && (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-1 bg-gradient-to-b from-black/80 to-transparent p-3 pb-10">
            <div className="tc-label">Analysing the game</div>
            <div className="tc-display text-[15px]" aria-live="polite">
              {reviewIdx === 0 ? "The starting position" : `After ${Math.ceil(reviewIdx / 2)}${reviewIdx % 2 ? "." : "…"} ${moveList[reviewIdx - 1]}`}
            </div>
            <div className="text-sm text-[var(--tc-cream-dim)]" aria-live="polite">
              {reviewIdx >= moveList.length ? (result ? `${result.reason}. ${result.text}` : "The last move")
                : !best ? "Thinking…"
                : best.none ? ""
                : best.san === playedSan ? `${playedSan} was the best move · ${scoreLabel(best.score)}`
                : `Best: ${best.san} · ${scoreLabel(best.score)}`}
            </div>
            {reviewIdx < moveList.length && best && !best.none && best.san !== playedSan && (
              <div className="flex gap-3 text-xs text-[var(--tc-cream-dim)]">
                <span><i className="mr-1 inline-block size-2.5 rounded-full align-middle" style={{ background: BEST_COLOR }} />Best move</span>
                <span><i className="mr-1 inline-block size-2.5 rounded-full align-middle" style={{ background: PLAYED_COLOR }} />Played: {playedSan}</span>
              </div>
            )}
          </div>
          <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 bg-gradient-to-t from-black/85 to-transparent px-3 pt-10 pb-[calc(0.9rem+env(safe-area-inset-bottom))]">
            <div className="flex w-full items-center justify-between gap-2">
              <button type="button" className="tc-round" onClick={() => reviewTo(0)} disabled={reviewIdx === 0} aria-label="To the start">«</button>
              <button type="button" className="tc-round" onClick={() => reviewTo(reviewIdx - 1)} disabled={reviewIdx === 0} aria-label="Previous move">‹</button>
              <span className="tc-display flex-1 text-center text-sm">{reviewIdx} / {moveList.length}</span>
              <button type="button" className="tc-round" onClick={() => reviewTo(reviewIdx + 1)} disabled={reviewIdx >= moveList.length} aria-label="Next move">›</button>
              <button type="button" className="tc-round" onClick={() => reviewTo(moveList.length)} disabled={reviewIdx >= moveList.length} aria-label="To the end">»</button>
            </div>
            <button type="button" className="tc-plank tc-center tc-small" style={{ width: 200 }} onClick={endReview}>Done</button>
          </div>
        </>
      )}
    </div>
  );
}
