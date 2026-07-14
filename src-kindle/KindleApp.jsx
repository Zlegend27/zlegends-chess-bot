import { useState, useRef, useCallback, useEffect } from "react";
import {
  createEngine, EMPTY, WN, WB, WR, WQ, WK, M64TO120, M120TO64,
  mFrom, mTo, mPromo, mFlags,
} from "../src/engine/chessEngine";
import { replayIntoEngine } from "../src/utils/share";
import { createKidAudio, TUNES } from "./kidTune";
import Critters from "./Critters";
import { KID_PUZZLE_BANDS, kidPuzzlesInBand, kidDailyPuzzle } from "./kidPuzzles";
import {
  loadShopState, addCoins, spendCoins, buyHat, buyBoard, equipHat, equipBoard, HATS, BOARDS,
  buyTune, equipTune, buyAnimal, buyPiece, equipPiece, PIECES, setMusicVolume, markDailyPuzzleSolved,
  markLessonComplete, recordRushResult,
} from "./kidShop";
import { cburnettPieceSvgUrl } from "../src/utils/cburnettPieceSvg";
import { woodPieceSvgUrl } from "../src/utils/woodPieceSvg";
import Confetti from "../src/components/Confetti";
import { AnimalIcon } from "./AnimalIcon";
import { KID_LESSON_CHAPTERS } from "./kidLessons";
import KidLessonPlayer from "./KidLessonPlayer";

/* Search runs in the same shared Worker the main bot uses (see
   src/engine/engineWorker.js) — the hardest tier ("Lion", 8s of search)
   used to freeze the whole UI on the main thread, which is a bad time for
   a kid mashing buttons waiting for their opponent to move. Full color and
   animation now that we're not targeting e-ink. */

const PTS = { 1: 1, 2: 3, 3: 3, 4: 5, 5: 9 };
const START_COUNT = { 1: 8, 2: 2, 3: 2, 4: 2, 5: 1 };
const RUSH_DURATIONS = [
  { seconds: 60, label: "1 Minute" },
  { seconds: 180, label: "3 Minutes" },
  { seconds: 300, label: "5 Minutes" },
];
const formatKidClock = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
/* Same ramp idea as the main app's Puzzle Rush: climb a band every few
   solves in a row, drop back one on a miss. */
const RUSH_STEP_UP_EVERY = 3;
const todayKey = () => {
  const d = new Date();
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
};
/* Coin rewards scale with difficulty instead of a flat amount, so beating
   a tougher bot or solving a harder puzzle actually feels like it earned
   more. Puzzle bands cap at 15 (the top, "hard" 1200+ band); bots go up
   in the same 5-coin steps across all ten difficulties, topping out at
   50 for Lion. */
const puzzleCoinReward = (rating) => (rating >= 1200 ? 15 : rating >= 900 ? 10 : 5);
const botCoinReward = (difficultyIdx) => (difficultyIdx + 1) * 5;
const HINT_COST = 1;

function materialState(eng) {
  const rem = { 1: {}, "-1": {} };
  for (const t of [1, 2, 3, 4, 5]) { rem[1][t] = 0; rem[-1][t] = 0; }
  for (let i = 0; i < 64; i++) {
    const p = eng.pieceAt(i);
    if (p === EMPTY) continue;
    const a = Math.abs(p);
    if (a === WK) continue;
    if (p > 0) rem[1][a]++; else rem[-1][a]++;
  }
  const taken = color => {
    const out = [];
    for (const t of [5, 4, 3, 2, 1]) {
      const missing = Math.max(0, START_COUNT[t] - rem[color][t]);
      for (let k = 0; k < missing; k++) out.push(t);
    }
    return out;
  };
  return { capturedWhite: taken(1), capturedBlack: taken(-1) };
}

/* A ladder of animal opponents from beginner to strong club-level. The elo
   numbers are a best-effort approximation (mostly driven by blunderChance,
   which controls how often it plays a random legal move instead of its
   real search) — there's no way to calibrate this against real rated
   games from here, so treat these as "roughly this strength", not exact. */
/* The four "unlockable" opponents (id + price) slot in just above Dog --
   stronger than the free ladder up to that point, but still well below
   Fox, so a kid who's been beating Dog can grind toward them without
   suddenly facing a wall. They're bought once in the shop and then just
   show up as extra options in the difficulty picker (no equip step). */
const DIFFICULTIES = [
  { id: "bunny", label: "Bunny", elo: 300, ms: 150, blunderChance: 0.85, book: false },
  { id: "cat", label: "Cat", elo: 600, ms: 300, blunderChance: 0.55, book: true },
  { id: "dog", label: "Dog", elo: 900, ms: 600, blunderChance: 0.3, book: true },
  { id: "panda", label: "Panda", elo: 950, ms: 700, blunderChance: 0.27, book: true, unlockable: true, price: 100 },
  { id: "raccoon", label: "Raccoon", elo: 1000, ms: 800, blunderChance: 0.24, book: true, unlockable: true, price: 100 },
  { id: "koala", label: "Koala", elo: 1050, ms: 900, blunderChance: 0.21, book: true, unlockable: true, price: 100 },
  { id: "otter", label: "Otter", elo: 1100, ms: 1000, blunderChance: 0.18, book: true, unlockable: true, price: 100 },
  { id: "fox", label: "Fox", elo: 1200, ms: 1200, blunderChance: 0.12, book: true },
  { id: "owl", label: "Owl", elo: 1600, ms: 3000, blunderChance: 0.03, book: true },
  { id: "lion", label: "Lion", elo: 2000, ms: 8000, blunderChance: 0, book: true },
];

/* The rarer "outline" chess Unicode code points (white pieces) aren't
   reliably present in every font, and Kindle's font set is an unknown —
   so use the one universally-supported glyph set for both colors and
   distinguish white with a plain circular outline instead (pure CSS,
   nothing font-dependent). */
const GLYPH = { 1: "♟︎", 2: "♞︎", 3: "♝︎", 4: "♜︎", 5: "♛︎", 6: "♚︎" };
const glyphFor = (piece) => GLYPH[Math.abs(piece)];
const PIECE_NAME = { 1: "pawn", 2: "knight", 3: "bishop", 4: "rook", 5: "queen", 6: "king" };
const FILES = "abcdefgh";

const LESSONS = [
  { piece: 1, name: "Pawn", text: "Marches straight ahead, one square at a time (two on its very first move!). It can only capture another piece diagonally, one square forward." },
  { piece: 2, name: "Knight", text: "Hops in an L-shape: two squares one way, then one square sideways. The only piece that can jump right over others!" },
  { piece: 3, name: "Bishop", text: "Glides diagonally, as far as it wants. Each bishop stays on the same color square its whole life." },
  { piece: 4, name: "Rook", text: "Looks like a little castle tower! Moves in straight lines - up, down, left, or right - as far as it wants." },
  { piece: 5, name: "Queen", text: "The most powerful piece on the board. Moves like a rook AND a bishop combined - any direction, any distance." },
  { piece: 6, name: "King", text: "Only moves one square at a time, but keep it extra safe! If your king can't escape capture, that's checkmate and the game is over." },
];

const TIPS = [
  "Try moving your knights and bishops out early - get them into the game!",
  "Castle your king to safety before the middle of the board gets busy.",
  "Every game teaches you something new, win or lose. Have fun!",
];

/* Puzzle data now comes from kidPuzzles.js -- a real, kid-rated slice of
   the Lichess database (see that file's header) instead of a small
   hand-curated set. */

export default function KindleApp() {
  const engRef = useRef(null);
  if (!engRef.current) engRef.current = createEngine();
  const eng = engRef.current;

  const workerRef = useRef(null);
  const pendingSearchesRef = useRef(new Map());
  const searchIdRef = useRef(0);
  if (!workerRef.current) {
    workerRef.current = new Worker(new URL("../src/engine/engineWorker.js", import.meta.url), { type: "module" });
    workerRef.current.onmessage = (e) => {
      const { id, result } = e.data;
      const resolve = pendingSearchesRef.current.get(id);
      if (resolve) { pendingSearchesRef.current.delete(id); resolve(result); }
    };
  }
  const runSearch = useCallback((searchMoveList, timeMs, blunderChance = 0, useBook = false) => {
    const id = ++searchIdRef.current;
    return new Promise((resolve) => {
      pendingSearchesRef.current.set(id, resolve);
      workerRef.current.postMessage({ id, moveList: searchMoveList, timeMs, blunderChance, useBook });
    });
  }, []);

  const [, force] = useState(0);
  const rerender = () => force(n => n + 1);

  const audioRef = useRef(null);
  if (!audioRef.current) audioRef.current = createKidAudio();
  const audio = audioRef.current;
  const [musicOn, setMusicOn] = useState(false);

  const [view, setView] = useState("play");
  const [lessonChapterId, setLessonChapterId] = useState(null);
  const [winBurst, setWinBurst] = useState(0);
  const [playerColor, setPlayerColor] = useState(1);
  const [selected, setSelected] = useState(-1);
  const [targets, setTargets] = useState([]);
  const [moveList, setMoveList] = useState([]);
  const moveListRef = useRef(moveList);
  const [thinking, setThinking] = useState(false);
  const [result, setResult] = useState(null);
  const [promo, setPromo] = useState(null);
  const [difficultyIdx, setDifficultyIdx] = useState(1);
  const [botLastMove, setBotLastMove] = useState(null);
  const [hintMove, setHintMove] = useState(null);
  const [hinting, setHinting] = useState(false);

  const [puzzleBand, setPuzzleBand] = useState(null);
  const [isDailyPuzzle, setIsDailyPuzzle] = useState(false);
  const [activePuzzle, setActivePuzzle] = useState(null);
  const [puzzleFeedback, setPuzzleFeedback] = useState(null);
  const [puzzleSolved, setPuzzleSolved] = useState(false);
  const [rushOpen, setRushOpen] = useState(false);
  const [rushMode, setRushMode] = useState(false);
  const [rushDuration, setRushDuration] = useState(60);
  const [rushTimeLeft, setRushTimeLeft] = useState(60);
  const [rushMistakes, setRushMistakes] = useState(0);
  const [rushSolved, setRushSolved] = useState(0);
  const [rushResult, setRushResult] = useState(null);
  const [rushBandIdx, setRushBandIdx] = useState(0);
  const rushSolvedRef = useRef(0);
  const rushMistakesRef = useRef(0);
  const rushBandIdxRef = useRef(0);
  const rushStreakRef = useRef(0);

  const [shop, setShop] = useState(() => loadShopState());
  const [shopOpen, setShopOpen] = useState(false);
  const equippedHat = shop.equippedHat;
  const boardTheme = BOARDS.find(b => b.id === shop.equippedBoard) || BOARDS[0];
  const boardVars = { "--kBoardLight": boardTheme.light, "--kBoardDark": boardTheme.dark };
  useEffect(() => { audio.setTune(shop.equippedTune); }, [audio, shop.equippedTune]);
  useEffect(() => { audio.setVolume(shop.musicVolume / 100); }, [audio, shop.musicVolume]);

  /* "Classic" keeps Kinnda's own glyph-in-a-circle look (renderPiece
     returns null and the glyph span renders instead); Standard/Wood reuse
     the exact same SVG piece sets the main site uses. */
  const pieceImgSrc = (type, isWhite) => {
    if (shop.equippedPiece === "standard") return cburnettPieceSvgUrl(type, isWhite);
    if (shop.equippedPiece === "wood") return woodPieceSvgUrl(type, isWhite);
    return null;
  };
  const renderPiece = (p, extraClass) => {
    if (p === EMPTY) return null;
    const isWhite = p > 0;
    const src = pieceImgSrc(Math.abs(p), isWhite);
    if (src) return <img className={"kPcImg" + (extraClass ? " " + extraClass : "")} src={src} alt="" draggable="false" />;
    return <span className={"kPc " + (isWhite ? "kPcW" : "kPcB") + (extraClass ? " " + extraClass : "")}>{glyphFor(p)}</span>;
  };
  /* Ghost needs explicit pixel sizing (it's position:fixed, following the
     pointer, not laid out inside a board cell it could size relative to)
     -- font-size for the glyph, width/height for an image, never both on
     the same element so neither mode's box model gets distorted. */
  const renderDragGhost = () => {
    if (dragFrom < 0 || !dragPos) return null;
    const p = eng.pieceAt(dragFrom);
    const isWhite = p > 0;
    const src = pieceImgSrc(Math.abs(p), isWhite);
    if (src) return <img className="kPcImg kDragGhost" src={src} alt="" draggable="false"
      style={{ left: dragPos.x, top: dragPos.y, width: dragCellSize * 0.8, height: dragCellSize * 0.8 }} />;
    return <span className={"kPc kDragGhost " + (isWhite ? "kPcW" : "kPcB")}
      style={{ left: dragPos.x, top: dragPos.y, fontSize: dragCellSize * 0.7 }}>{glyphFor(p)}</span>;
  };

  const isCaptureMove = m => eng.pieceAt(M120TO64[mTo(m)]) !== EMPTY || (mFlags(m) & 1);

  const checkGameOver = useCallback(() => {
    const legal = eng.legalMoves();
    if (legal.length === 0) {
      if (eng.inCheckNow()) {
        const winner = -eng.getSide();
        return { text: winner === 1 ? "1-0" : "0-1", reason: "Checkmate", winner };
      }
      return { text: "1/2-1/2", reason: "Stalemate", winner: 0 };
    }
    if (eng.halfClock() >= 100) return { text: "1/2-1/2", reason: "Fifty-move rule", winner: 0 };
    if (eng.repetitionCount() >= 3) return { text: "1/2-1/2", reason: "Threefold repetition", winner: 0 };
    if (eng.insufficientMaterial()) return { text: "1/2-1/2", reason: "Insufficient material", winner: 0 };
    return null;
  }, [eng]);

  const announceResult = (over) => {
    if (!over) return;
    if (over.winner === playerColor) {
      audio.sfxWin();
      setShop(s => addCoins(s, botCoinReward(difficultyIdx)));
      setWinBurst(n => n + 1);
    }
    else if (over.winner === 0) { /* draw: no stinger, keep it neutral */ }
    else audio.sfxLose();
  };

  const engineMoveRef = useRef(null);
  const engineMove = useCallback(() => {
    setThinking(true);
    const diff = DIFFICULTIES[difficultyIdx];
    runSearch(moveListRef.current, diff.ms, diff.blunderChance || 0, diff.book).then((res) => {
      if (res && res.move) {
        const cap = isCaptureMove(res.move);
        eng.make(res.move);
        cap ? audio.sfxCapture() : audio.sfxMove();
        moveListRef.current = [...moveListRef.current, res.san];
        setMoveList(moveListRef.current);
        setBotLastMove({ from: mFrom(res.move), to: mTo(res.move) });
        setHintMove(null);
        const over = checkGameOver();
        setResult(over);
        announceResult(over);
      }
      setThinking(false);
      rerender();
    });
  }, [eng, audio, difficultyIdx, checkGameOver, runSearch]);
  engineMoveRef.current = engineMove;

  const playMove = (m) => {
    const cap = isCaptureMove(m);
    const san = eng.sanOf(m);
    eng.make(m);
    cap ? audio.sfxCapture() : audio.sfxMove();
    moveListRef.current = [...moveListRef.current, san];
    setMoveList(moveListRef.current);
    setBotLastMove(null);
    setHintMove(null);
    setSelected(-1); setTargets([]);
    const over = checkGameOver();
    setResult(over);
    announceResult(over);
    rerender();
    if (!over) engineMoveRef.current();
  };

  const onHint = () => {
    if (thinking || result || promo || hinting || eng.getSide() !== playerColor || shop.coins < HINT_COST) return;
    setHinting(true);
    setShop(s => spendCoins(s, HINT_COST));
    runSearch(moveListRef.current, 600, 0, true).then((res) => {
      if (res && res.move) setHintMove({ from: M120TO64[mFrom(res.move)], to: M120TO64[mTo(res.move)] });
      setHinting(false);
    });
  };

  /* Returns a status string so drag pointerdown (below) can tell,
     synchronously, whether it just picked up a draggable piece --
     existing callers that ignore the return value see no change. */
  const onSquare = (i64) => {
    if (thinking || result || promo) return "blocked";
    if (eng.getSide() !== playerColor) return "blocked";
    const legal = eng.legalMoves();
    const sq120 = M64TO120[i64];
    if (selected >= 0) {
      const from120 = M64TO120[selected];
      const candidates = legal.filter(m => mFrom(m) === from120 && mTo(m) === sq120);
      if (candidates.length > 0) {
        if (candidates.length > 1) { setPromo({ from: from120, to: sq120, moves: candidates }); return "promo"; }
        playMove(candidates[0]);
        return "moved";
      }
    }
    const p = eng.pieceAt(i64);
    if (p !== EMPTY && p * playerColor > 0) {
      setSelected(i64);
      setTargets(legal.filter(m => mFrom(m) === sq120).map(m => M120TO64[mTo(m)]));
      return "selected";
    } else { setSelected(-1); setTargets([]); return "deselected"; }
  };

  const newGame = (color) => {
    eng.reset();
    setPlayerColor(color);
    moveListRef.current = [];
    setSelected(-1); setTargets([]); setMoveList([]); setResult(null); setPromo(null); setBotLastMove(null); setHintMove(null);
    rerender();
    if (color === -1) setTimeout(() => engineMoveRef.current(), 30);
  };

  const undo = () => {
    if (thinking || result || eng.plyCount() === 0) return;
    let n;
    if (eng.getSide() === playerColor && eng.plyCount() >= 2) n = 2; else n = 1;
    for (let i = 0; i < n; i++) eng.unmake();
    moveListRef.current = moveListRef.current.slice(0, moveListRef.current.length - n);
    setMoveList(moveListRef.current);
    setSelected(-1); setTargets([]); setResult(null); setPromo(null); setBotLastMove(null); setHintMove(null);
    rerender();
  };

  const puzzleProgressRef = useRef([]);
  const prevPlayerColorRef = useRef(1);

  /* Drag-to-move (mouse and touch, via Pointer Events), same approach as
     the main site's board: pointerdown reuses whichever click handler is
     active (onSquare or onPuzzleSquare) for its "select" step -- its new
     return value tells us synchronously whether a draggable piece got
     picked up -- and dropping calls that handler again on the square
     under the pointer, exactly like a second click/tap would. Kinnda's
     board isn't memoized (buildBoardRows already reruns every render), so
     there's no stale-closure ref dance needed here like the main app's. */
  const boardRef = useRef(null);
  const [dragFrom, setDragFrom] = useState(-1);
  const [dragOverSquare, setDragOverSquare] = useState(-1);
  const [dragPos, setDragPos] = useState(null);
  const [dragCellSize, setDragCellSize] = useState(40);

  const loadPuzzle = (puzzle) => {
    eng.loadFen(puzzle.fen);
    puzzleProgressRef.current = [];
    setActivePuzzle(puzzle);
    setPuzzleFeedback(null);
    setPuzzleSolved(false);
    setPlayerColor(eng.getSide());
    setSelected(-1); setTargets([]); setBotLastMove(null); setHintMove(null);
    rerender();
  };

  const startPuzzle = (band) => {
    if (thinking) return;
    if (!activePuzzle) prevPlayerColorRef.current = playerColor;
    const pool = kidPuzzlesInBand(band);
    setPuzzleBand(band);
    setIsDailyPuzzle(false);
    loadPuzzle(pool[(Math.random() * pool.length) | 0]);
  };

  const startDailyPuzzle = () => {
    if (thinking) return;
    const puzzle = kidDailyPuzzle();
    if (!puzzle) return;
    if (!activePuzzle) prevPlayerColorRef.current = playerColor;
    setPuzzleBand(null);
    setIsDailyPuzzle(true);
    loadPuzzle(puzzle);
  };

  const nextPuzzle = () => startPuzzle(puzzleBand);

  const nextRushPuzzle = () => {
    const pool = kidPuzzlesInBand(KID_PUZZLE_BANDS[rushBandIdxRef.current].id);
    loadPuzzle(pool[(Math.random() * pool.length) | 0]);
  };

  const startRush = (seconds) => {
    if (!activePuzzle) prevPlayerColorRef.current = playerColor;
    setIsDailyPuzzle(false);
    rushSolvedRef.current = 0;
    rushMistakesRef.current = 0;
    rushBandIdxRef.current = 0;
    rushStreakRef.current = 0;
    setRushSolved(0);
    setRushMistakes(0);
    setRushBandIdx(0);
    setRushResult(null);
    setRushDuration(seconds);
    setRushTimeLeft(seconds);
    setRushMode(true);
    setRushOpen(false);
    nextRushPuzzle();
  };

  const finishRush = (reason) => {
    const prevBest = shop.bestRushStreak[String(rushDuration)] || 0;
    setRushResult({ reason, solved: rushSolvedRef.current, newBest: rushSolvedRef.current > prevBest });
    setShop(s => recordRushResult(s, rushDuration, rushSolvedRef.current));
  };

  const retryRush = () => startRush(rushDuration);

  const exitRush = () => {
    setRushMode(false);
    setRushResult(null);
    exitPuzzle();
  };

  /* Puzzle Rush countdown -- ticks once a second while a rush is live and
     hasn't already ended, pausing once rushResult is set so a mistake-
     triggered end and a time-triggered end can't race each other. */
  useEffect(() => {
    if (!rushMode || rushResult) return;
    if (rushTimeLeft <= 0) { finishRush("time"); return; }
    const t = setTimeout(() => setRushTimeLeft(s => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rushMode, rushResult, rushTimeLeft]);

  const onPuzzleSquare = (i64) => {
    if (puzzleFeedback || puzzleSolved) return "blocked";
    const sideToMove = eng.getSide();
    const legal = eng.legalMoves();
    const sq120 = M64TO120[i64];
    if (selected >= 0) {
      const from120 = M64TO120[selected];
      const candidates = legal.filter(m => mFrom(m) === from120 && mTo(m) === sq120);
      if (candidates.length > 0) {
        const move = candidates.find(m => mPromo(m) === 0 || mPromo(m) === WQ) || candidates[0];
        const san = eng.sanOf(move);
        const idx = puzzleProgressRef.current.length;
        const expected = activePuzzle.moves[idx];
        if (san !== expected) {
          audio.sfxLose();
          setSelected(-1); setTargets([]);
          if (rushMode) {
            rushMistakesRef.current += 1;
            setRushMistakes(rushMistakesRef.current);
            rushStreakRef.current = 0;
            rushBandIdxRef.current = Math.max(0, rushBandIdxRef.current - 1);
            setRushBandIdx(rushBandIdxRef.current);
            if (rushMistakesRef.current >= 3) {
              setPuzzleFeedback("wrong");
              setTimeout(() => finishRush("mistakes"), 400);
            } else {
              setPuzzleFeedback("wrong");
              setTimeout(() => nextRushPuzzle(), 700);
            }
            return "deselected";
          }
          setPuzzleFeedback("wrong");
          setTimeout(() => setPuzzleFeedback(null), 1400);
          return "deselected";
        }
        const cap = isCaptureMove(move);
        eng.make(move);
        cap ? audio.sfxCapture() : audio.sfxMove();
        setBotLastMove({ from: mFrom(move), to: mTo(move) });
        puzzleProgressRef.current = [...puzzleProgressRef.current, san];
        setSelected(-1); setTargets([]);

        if (puzzleProgressRef.current.length === activePuzzle.moves.length) {
          setPuzzleSolved(true);
          audio.sfxWin();
          if (rushMode) {
            rushSolvedRef.current += 1;
            setRushSolved(rushSolvedRef.current);
            rushStreakRef.current += 1;
            if (rushStreakRef.current >= RUSH_STEP_UP_EVERY && rushBandIdxRef.current < KID_PUZZLE_BANDS.length - 1) {
              rushBandIdxRef.current += 1;
              rushStreakRef.current = 0;
              setRushBandIdx(rushBandIdxRef.current);
            }
            setShop(s => addCoins(s, puzzleCoinReward(activePuzzle.rating)));
            setTimeout(() => nextRushPuzzle(), 500);
          } else {
            const reward = puzzleCoinReward(activePuzzle.rating);
            setShop(s => {
              const next = addCoins(s, reward);
              return isDailyPuzzle ? markDailyPuzzleSolved(next, todayKey()) : next;
            });
          }
          rerender();
          return "moved";
        }
        const replySan = activePuzzle.moves[puzzleProgressRef.current.length];
        setTimeout(() => {
          const replyLegal = eng.legalMoves();
          const replyMove = replyLegal.find(mv => eng.sanOf(mv) === replySan);
          if (replyMove) {
            const replyCap = isCaptureMove(replyMove);
            eng.make(replyMove);
            replyCap ? audio.sfxCapture() : audio.sfxMove();
            setBotLastMove({ from: mFrom(replyMove), to: mTo(replyMove) });
            puzzleProgressRef.current = [...puzzleProgressRef.current, replySan];
            rerender();
          }
        }, 500);
        rerender();
        return "moved";
      }
    }
    const p = eng.pieceAt(i64);
    if (p !== EMPTY && p * sideToMove > 0) {
      setSelected(i64);
      setTargets(legal.filter(m => mFrom(m) === sq120).map(m => M120TO64[mTo(m)]));
      return "selected";
    } else { setSelected(-1); setTargets([]); return "deselected"; }
  };

  const exitPuzzle = () => {
    eng.reset();
    replayIntoEngine(eng, moveList);
    setActivePuzzle(null); setPuzzleBand(null); setIsDailyPuzzle(false); setPuzzleFeedback(null); setPuzzleSolved(false);
    setSelected(-1); setTargets([]); setBotLastMove(null);
    setPlayerColor(prevPlayerColorRef.current);
    setView("play");
    rerender();
  };

  const buildBoardRows = (flippedFlag, clickHandler) => {
    const squareFromPoint = (clientX, clientY) => {
      const el = boardRef.current;
      if (!el) return -1;
      const rect = el.getBoundingClientRect();
      const relX = clientX - rect.left, relY = clientY - rect.top;
      if (relX < 0 || relY < 0 || relX >= rect.width || relY >= rect.height) return -1;
      const visCol = Math.min(7, Math.floor((relX / rect.width) * 8));
      const visRow = Math.min(7, Math.floor((relY / rect.height) * 8));
      const f = flippedFlag ? 7 - visCol : visCol;
      const r = flippedFlag ? visRow : 7 - visRow;
      return r * 8 + f;
    };
    const onPointerDownSq = (i64, e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const status = clickHandler(i64);
      if (status !== "selected") return;
      e.currentTarget.setPointerCapture(e.pointerId);
      setDragCellSize(e.currentTarget.getBoundingClientRect().width);
      setDragFrom(i64);
      setDragOverSquare(i64);
      setDragPos({ x: e.clientX, y: e.clientY });
    };
    const onPointerMoveSq = (e) => {
      if (dragFrom < 0) return;
      setDragPos({ x: e.clientX, y: e.clientY });
      setDragOverSquare(squareFromPoint(e.clientX, e.clientY));
    };
    const onPointerUpSq = (e) => {
      if (dragFrom < 0) return;
      const dropSquare = squareFromPoint(e.clientX, e.clientY);
      setDragFrom(-1); setDragOverSquare(-1); setDragPos(null);
      if (dropSquare >= 0) clickHandler(dropSquare);
    };
    const onPointerCancelSq = () => {
      setDragFrom(-1); setDragOverSquare(-1); setDragPos(null);
    };

    const rows = [];
    for (let vr = 0; vr < 8; vr++) {
      const r = flippedFlag ? vr : 7 - vr;
      const cells = [];
      for (let vf = 0; vf < 8; vf++) {
        const f = flippedFlag ? 7 - vf : vf;
        const i64 = r * 8 + f;
        const sq120 = M64TO120[i64];
        const p = eng.pieceAt(i64);
        const light = (r + f) % 2 === 1;
        const isSel = selected === i64;
        const isTarget = targets.includes(i64);
        const isBotLast = botLastMove && (botLastMove.from === sq120 || botLastMove.to === sq120);
        const isHintFrom = hintMove && hintMove.from === i64;
        const isHintTo = hintMove && hintMove.to === i64;
        const kingInCheck = p * eng.getSide() === WK && eng.inCheckNow();
        const isDragFrom = dragFrom === i64;
        const isDragOver = dragFrom >= 0 && dragOverSquare === i64 && dragOverSquare !== dragFrom;
        const squareName = FILES[f] + (r + 1);
        const pieceLabel = p !== EMPTY ? `${p > 0 ? "White" : "Black"} ${PIECE_NAME[Math.abs(p)]}` : "empty";
        const stateBits = [isSel && "selected", isTarget && "legal move", kingInCheck && "in check"].filter(Boolean);
        const ariaLabel = `${squareName}, ${pieceLabel}` + (stateBits.length ? `, ${stateBits.join(", ")}` : "");
        cells.push(
          <div key={i64} role="gridcell" tabIndex={0} aria-label={ariaLabel}
            onClick={() => clickHandler(i64)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); clickHandler(i64); } }}
            onPointerDown={(e) => onPointerDownSq(i64, e)}
            onPointerMove={onPointerMoveSq}
            onPointerUp={onPointerUpSq}
            onPointerCancel={onPointerCancelSq}
            className={"kSq " + (light ? "kLight" : "kDark") + (isSel ? " kSel" : "") + (isBotLast ? " kLast" : "") + (kingInCheck ? " kChk" : "") + (isDragOver ? " kDragOver" : "") + (isHintFrom || isHintTo ? " kHint" : "")}>
            {p !== EMPTY && !isDragFrom && renderPiece(p)}
            {isTarget && <span className="kDot" />}
            {vf === 0 && <span className="kCoord kRk">{r + 1}</span>}
            {vr === 7 && <span className="kCoord kFl">{FILES[f]}</span>}
          </div>
        );
      }
      rows.push(<div key={vr} role="row" className="kRow">{cells}</div>);
    }
    return rows;
  };

  if (view === "puzzle") {
    const band = KID_PUZZLE_BANDS.find(b => b.id === puzzleBand);
    const sideLabel = activePuzzle ? (eng.getSide() === 1 ? "White" : "Black") : "";
    return (
      <div className="kRoot">
        <Critters />
        <div className="kHdr">
          <AnimalIcon kind={DIFFICULTIES[difficultyIdx].label} hat={equippedHat} />
          <h1>Kinnda Chess</h1>
          <span className="kCoinBadge">🪙 {shop.coins}</span>
        </div>
        {!activePuzzle ? (
          <>
            <div className="kStatus">Pick a puzzle level!</div>
            <div className="kCtrls">
              <button onClick={startDailyPuzzle}>
                📅 Daily Puzzle{shop.dailyPuzzleSolvedDate === todayKey() ? " ✓" : ""}
              </button>
            </div>
            <div className="kCtrls">
              {KID_PUZZLE_BANDS.map(b => (
                <button key={b.id} onClick={() => startPuzzle(b.id)}>{b.label} ({kidPuzzlesInBand(b.id).length})</button>
              ))}
            </div>
            <div className="kCtrls">
              <button onClick={() => setRushOpen(true)}>⚡ Puzzle Rush</button>
              <button onClick={exitPuzzle}>Back to the Game</button>
            </div>
          </>
        ) : (
          <>
            <div className="kStatus">
              {rushMode
                ? `Puzzle Rush · ${KID_PUZZLE_BANDS[rushBandIdx].label} · ${formatKidClock(rushTimeLeft)} left · Solved ${rushSolved} · Misses ${rushMistakes}/3`
                : puzzleSolved ? `You got it! Great puzzle solving! (+${puzzleCoinReward(activePuzzle.rating)} coins)`
                : puzzleFeedback === "wrong" ? "Not quite - give it another try!"
                : isDailyPuzzle ? `Daily Puzzle (rated ${activePuzzle.rating}) - find the best move for ${sideLabel}!`
                : `${band ? band.label : ""} puzzle (rated ${activePuzzle.rating}) - find the best move for ${sideLabel}!`}
            </div>
            {!puzzleFeedback && !puzzleSolved && <div className="kMoves">{activePuzzle.hint}</div>}
            <div className="kBoardWrap">
              <div className="kBoard" style={boardVars} role="grid" aria-label="Chess board" ref={boardRef}>{buildBoardRows(false, onPuzzleSquare)}</div>
              {renderDragGhost()}
            </div>
            <div className="kCtrls">
              {!rushMode && puzzleSolved && <button onClick={nextPuzzle}>Next Puzzle</button>}
              {rushMode ? <button onClick={exitRush}>End Rush</button> : <button onClick={exitPuzzle}>Back to the Game</button>}
            </div>
          </>
        )}

        {rushOpen && (
          <div className="kShopOv" onClick={e => { if (e.target === e.currentTarget) setRushOpen(false); }}>
            <button className="kCloseX" onClick={() => setRushOpen(false)} aria-label="Close Puzzle Rush">✕</button>
            <h2 className="kLessonTitle" style={{ textAlign: "center" }}>Puzzle Rush</h2>
            <div className="kMoves" style={{ width: "min(92vw, 380px)" }}>
              Solve as many puzzles as you can! Three wrong answers or running out of time ends the rush.
            </div>
            <div className="kCtrls" style={{ flexDirection: "column", width: "min(92vw, 380px)" }}>
              {RUSH_DURATIONS.map(d => {
                const best = shop.bestRushStreak[String(d.seconds)] || 0;
                return (
                  <button key={d.seconds} onClick={() => startRush(d.seconds)}>
                    {d.label}{best > 0 ? ` — best ${best} 🏆` : ""}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {rushMode && rushResult && (
          <div className="kShopOv" onClick={e => { if (e.target === e.currentTarget) exitRush(); }}>
            {rushResult.newBest && <Confetti key={rushResult.solved} />}
            <button className="kCloseX" onClick={exitRush} aria-label="Exit Puzzle Rush">✕</button>
            <h2 className="kLessonTitle" style={{ textAlign: "center" }}>
              {rushResult.reason === "time" ? "Time's up!" : "3 misses — rush over!"}
            </h2>
            <div className="kMoves" style={{ width: "min(92vw, 380px)", textAlign: "center", fontSize: 16 }}>
              You solved <b>{rushResult.solved}</b> puzzle{rushResult.solved === 1 ? "" : "s"}!
              {rushResult.newBest && <><br /><b className="kNewBest">🏆 New personal best!</b></>}
            </div>
            <div className="kCtrls">
              <button onClick={retryRush}>Try Again</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (view === "lessons") {
    return (
      <div className="kRoot" onClick={e => { if (e.target === e.currentTarget) setView("play"); }}>
        <button className="kCloseX" onClick={() => setView("play")} aria-label="Close How to Play">✕</button>
        <Critters />
        <div className="kHdr">
          <AnimalIcon kind={DIFFICULTIES[difficultyIdx].label} hat={equippedHat} />
          <h1>Kinnda Chess</h1>
        </div>
        <h2 className="kLessonTitle">How the Pieces Move</h2>
        <div className="kLessons">
          {LESSONS.map(l => (
            <div className="kLessonCard" key={l.name}>
              <span className="kPc kPcB kLessonPc">{GLYPH[l.piece]}</span>
              <div>
                <div className="kLessonName">{l.name}</div>
                <div className="kLessonText">{l.text}</div>
              </div>
            </div>
          ))}
        </div>
        <h2 className="kLessonTitle">A Few Tips</h2>
        <ul className="kTips">
          {TIPS.map((t, i) => <li key={i}>{t}</li>)}
        </ul>
      </div>
    );
  }

  /* Lessons hub -- a chapter picker distinct from "How to Play" above:
     that one covers piece movement, this one covers the concepts (why
     you play the moves you play), same split the main site draws
     between the rules a player already knows and the Lessons feature. */
  if (view === "lessonsHub") {
    if (lessonChapterId) {
      const chapter = KID_LESSON_CHAPTERS.find(c => c.id === lessonChapterId);
      return (
        <KidLessonPlayer
          chapter={chapter}
          renderPiece={renderPiece}
          boardVars={boardVars}
          onExit={() => setLessonChapterId(null)}
          onComplete={() => setShop(s => markLessonComplete(s, chapter.id))}
        />
      );
    }
    return (
      <div className="kRoot" onClick={e => { if (e.target === e.currentTarget) setView("play"); }}>
        <button className="kCloseX" onClick={() => setView("play")} aria-label="Close Lessons">✕</button>
        <Critters />
        <div className="kHdr">
          <AnimalIcon kind="Owl" />
          <h1>Kinnda Chess</h1>
        </div>
        <h2 className="kLessonTitle">Lessons</h2>
        <div className="kLessons">
          {KID_LESSON_CHAPTERS.map(c => (
            c.comingSoon ? (
              <div className="kLessonCard kLessonLocked" key={c.id}>
                <span className="kLessonLockIcon">🔒</span>
                <div>
                  <div className="kLessonName">{c.title}</div>
                  <div className="kLessonText">{c.subtitle} — coming soon!</div>
                </div>
              </div>
            ) : (
              <button className="kLessonCard kLessonPickable" key={c.id} onClick={() => setLessonChapterId(c.id)}>
                <AnimalIcon kind={c.teacher} size={40} />
                <div>
                  <div className="kLessonName">
                    {c.title}{shop.completedLessons.includes(c.id) ? " ✓" : ""}
                  </div>
                  <div className="kLessonText">{c.subtitle}</div>
                </div>
              </button>
            )
          ))}
        </div>
      </div>
    );
  }

  const flipped = playerColor === -1;
  const rows = buildBoardRows(flipped, onSquare);

  const pairs = [];
  for (let i = 0; i < moveList.length; i += 2) pairs.push([i / 2 + 1, moveList[i], moveList[i + 1]]);
  const moveText = pairs.map(([n, w, b]) => `${n}.${w}${b ? " " + b : ""}`).join("  ");

  const mat = materialState(eng);
  const youCaptured = playerColor === 1 ? mat.capturedBlack : mat.capturedWhite;
  const opponentCaptured = playerColor === 1 ? mat.capturedWhite : mat.capturedBlack;

  const opponentName = DIFFICULTIES[difficultyIdx].label;
  const status = result
    ? (result.winner === 0
        ? "It's a tie - great game!"
        : result.winner === playerColor
          ? "Good job, you win!"
          : "Nice try! Better luck next time!")
    : thinking ? `${opponentName} is thinking...`
    : eng.getSide() === playerColor ? "Your move!" : `${opponentName}'s move`;
  const mood = !result ? undefined : result.winner === 0 ? undefined : result.winner === playerColor ? "happy" : "sad";

  const Tray = ({ pieces }) => (
    <div className="kTray">
      {pieces.length === 0
        ? <span className="kTrayEmpty">no captures yet</span>
        : pieces.map((t, i) => <span key={i} className="kTrayPc">{GLYPH[t]}</span>)}
    </div>
  );

  return (
    <div className="kRoot">
      <Critters />
      {result && result.winner === playerColor && <Confetti key={winBurst} />}
      <div className="kHdr">
        <div className="kHdrLeft">
          <AnimalIcon kind={opponentName} hat={equippedHat} mood={mood} />
          <h1>Kinnda Chess</h1>
        </div>
        <div className="kHdrRight">
          <span className="kCoinBadge">🪙 {shop.coins}</span>
          <button className="kIconBtn kLessonBtn" onClick={() => setView("lessonsHub")} title="Lessons">🎓</button>
          <button className="kIconBtn kShopBtn" onClick={() => setShopOpen(true)} title="Shop">🛍️</button>
          <button className="kIconBtn kMusicBtn" onClick={() => setMusicOn(audio.toggle())} title={musicOn ? "Pause music" : "Play music"}>
            {musicOn ? "♪⏸" : "♪▶"}
          </button>
          <input type="range" className="kVolume" min="0" max="100" value={shop.musicVolume}
            onChange={e => setShop(s => setMusicVolume(s, Number(e.target.value)))}
            title="Music volume" aria-label="Music volume" />
        </div>
      </div>
      <div className="kStatus">{status}</div>

      <div className="kCaptureRow">
        <span className="kCaptureLabel">{opponentName}'s captures:</span>
        <Tray pieces={opponentCaptured} />
      </div>

      <div className="kBoardWrap">
        <div className="kBoard" style={boardVars} role="grid" aria-label="Chess board" ref={boardRef}>{rows}</div>
        {renderDragGhost()}
        {promo && (
          <div className="kPromoOv">
            {[WQ, WR, WB, WN].map(pp => (
              <button key={pp} onClick={() => {
                const m = promo.moves.find(x => mPromo(x) === pp);
                setPromo(null);
                if (m) playMove(m);
              }}>{renderPiece(eng.getSide() === 1 ? pp : -pp)}</button>
            ))}
          </div>
        )}
      </div>

      <div className="kCaptureRow">
        <span className="kCaptureLabel">Your captures:</span>
        <Tray pieces={youCaptured} />
      </div>

      <div className="kMoves">{moveText || "No moves yet - good luck!"}</div>

      <div className="kCtrls">
        <button className="kBtnGreen" onClick={() => newGame(1)}>Play White</button>
        <button className="kBtnBlue" onClick={() => newGame(-1)}>Play Black</button>
        <button className="kBtnGhost" onClick={undo} disabled={thinking || !!result || eng.plyCount() === 0}>Undo</button>
        <button className="kBtnGold" onClick={onHint} disabled={thinking || !!result || !!promo || hinting || eng.getSide() !== playerColor || shop.coins < HINT_COST}
          title={`Costs ${HINT_COST} coin`}>
          {hinting ? "Thinking…" : `💡 Hint (${HINT_COST}🪙)`}
        </button>
        <select value={difficultyIdx} onChange={e => setDifficultyIdx(Number(e.target.value))}>
          {DIFFICULTIES.map((d, i) => (!d.unlockable || shop.ownedAnimals.includes(d.id)) &&
            <option key={i} value={i}>{d.label} ({d.elo})</option>)}
        </select>
        <button className="kBtnPurple" onClick={() => setView("lessonsHub")}>🎓 Lessons</button>
        <button className="kBtnPurple" onClick={() => setView("lessons")}>How to Play</button>
        <button className="kBtnPurple" onClick={() => setView("puzzle")} disabled={thinking}>Puzzles</button>
        {result && <button className="kBtnPink" onClick={() => newGame(playerColor)}>Play Again!</button>}
      </div>

      {shopOpen && (
        <div className="kShopOv" onClick={e => { if (e.target === e.currentTarget) setShopOpen(false); }}>
          <button className="kCloseX" onClick={() => setShopOpen(false)} aria-label="Close Shop">✕</button>
          <h2 className="kLessonTitle" style={{ textAlign: "center" }}>Shop - 🪙 {shop.coins}</h2>
          <div className="kShopGrid">
            {HATS.map(h => {
              const owned = shop.ownedHats.includes(h.id);
              const equipped = shop.equippedHat === h.id;
              return (
                <div className="kShopItem" key={h.id}>
                  <AnimalIcon kind={DIFFICULTIES[difficultyIdx].label} hat={h.id === "none" ? null : h.id} size={44} />
                  <div>{h.label}</div>
                  {equipped ? (
                    <button className="kEquipped" disabled>Equipped</button>
                  ) : owned ? (
                    <button onClick={() => setShop(s => equipHat(s, h.id))}>Wear</button>
                  ) : (
                    <button disabled={shop.coins < h.price} onClick={() => setShop(s => buyHat(s, h.id))}>Buy {h.price}🪙</button>
                  )}
                </div>
              );
            })}
            {BOARDS.map(b => {
              const owned = shop.ownedBoards.includes(b.id);
              const equipped = shop.equippedBoard === b.id;
              return (
                <div className="kShopItem" key={b.id}>
                  <span className="kSwatch" style={{ background: `linear-gradient(135deg, ${b.light} 50%, ${b.dark} 50%)` }} />
                  <div>{b.label}</div>
                  {equipped ? (
                    <button className="kEquipped" disabled>Equipped</button>
                  ) : owned ? (
                    <button onClick={() => setShop(s => equipBoard(s, b.id))}>Use</button>
                  ) : (
                    <button disabled={shop.coins < b.price} onClick={() => setShop(s => buyBoard(s, b.id))}>Buy {b.price}🪙</button>
                  )}
                </div>
              );
            })}
            {PIECES.map(pc => {
              const owned = shop.ownedPieces.includes(pc.id);
              const equipped = shop.equippedPiece === pc.id;
              const previewSrc = pc.id === "standard" ? cburnettPieceSvgUrl(6, true)
                : pc.id === "wood" ? woodPieceSvgUrl(6, true) : null;
              return (
                <div className="kShopItem" key={pc.id}>
                  {previewSrc
                    ? <img src={previewSrc} alt="" style={{ width: 44, height: 44 }} />
                    : <span className="kPc kPcW" style={{ fontSize: 30 }}>{GLYPH[6]}</span>}
                  <div>{pc.label}</div>
                  {equipped ? (
                    <button className="kEquipped" disabled>Equipped</button>
                  ) : owned ? (
                    <button onClick={() => setShop(s => equipPiece(s, pc.id))}>Use</button>
                  ) : (
                    <button disabled={shop.coins < pc.price} onClick={() => setShop(s => buyPiece(s, pc.id))}>Buy {pc.price}🪙</button>
                  )}
                </div>
              );
            })}
            {TUNES.map(t => {
              const owned = shop.ownedTunes.includes(t.id);
              const equipped = shop.equippedTune === t.id;
              return (
                <div className="kShopItem" key={t.id}>
                  <span style={{ fontSize: 32 }}>🎵</span>
                  <div>{t.label}</div>
                  {equipped ? (
                    <button className="kEquipped" disabled>Equipped</button>
                  ) : owned ? (
                    <button onClick={() => setShop(s => equipTune(s, t.id))}>Play</button>
                  ) : (
                    <button disabled={shop.coins < t.price} onClick={() => setShop(s => buyTune(s, t.id))}>Buy {t.price}🪙</button>
                  )}
                </div>
              );
            })}
            {DIFFICULTIES.filter(d => d.unlockable).map(d => {
              const owned = shop.ownedAnimals.includes(d.id);
              return (
                <div className="kShopItem" key={d.id}>
                  <AnimalIcon kind={d.label} size={44} />
                  <div>{d.label} ({d.elo})</div>
                  {owned ? (
                    <button className="kEquipped" disabled>Unlocked</button>
                  ) : (
                    <button disabled={shop.coins < d.price} onClick={() => setShop(s => buyAnimal(s, d.id, d.price))}>Buy {d.price}🪙</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
