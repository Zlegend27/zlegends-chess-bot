import { useState, useRef, useCallback } from "react";
import {
  createEngine, EMPTY, WN, WB, WR, WQ, WK, M64TO120, M120TO64,
  mFrom, mTo, mPromo, mFlags,
} from "../src/engine/chessEngine";
import { replayIntoEngine } from "../src/utils/share";
import { createKidAudio } from "./kidTune";

/* Search runs in the same shared Worker the main bot uses (see
   src/engine/engineWorker.js) — the hardest tier ("Lion", 8s of search)
   used to freeze the whole UI on the main thread, which is a bad time for
   a kid mashing buttons waiting for their opponent to move. Full color and
   animation now that we're not targeting e-ink. */

const PTS = { 1: 1, 2: 3, 3: 3, 4: 5, 5: 9 };
const START_COUNT = { 1: 8, 2: 2, 3: 2, 4: 2, 5: 1 };

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
const DIFFICULTIES = [
  { label: "Bunny", elo: 300, ms: 150, blunderChance: 0.85, book: false },
  { label: "Cat", elo: 600, ms: 300, blunderChance: 0.55, book: true },
  { label: "Dog", elo: 900, ms: 600, blunderChance: 0.3, book: true },
  { label: "Fox", elo: 1200, ms: 1200, blunderChance: 0.12, book: true },
  { label: "Owl", elo: 1600, ms: 3000, blunderChance: 0.03, book: true },
  { label: "Lion", elo: 2000, ms: 8000, blunderChance: 0, book: true },
];

/* The rarer "outline" chess Unicode code points (white pieces) aren't
   reliably present in every font, and Kindle's font set is an unknown —
   so use the one universally-supported glyph set for both colors and
   distinguish white with a plain circular outline instead (pure CSS,
   nothing font-dependent). */
const GLYPH = { 1: "♟︎", 2: "♞︎", 3: "♝︎", 4: "♜︎", 5: "♛︎", 6: "♚︎" };
const glyphFor = (piece) => GLYPH[Math.abs(piece)];
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

/* Each puzzle is white-to-move; every FEN and its solution SAN has been
   checked against the actual engine (loadFen + legalMoves + sanOf), not
   just eyeballed, since a wrong "correct answer" would just confuse a
   kid trying to learn from it. */
const PUZZLES = {
  easy: [
    { fen: "4k3/8/8/8/3q4/8/2N5/4K3 w - - 0 1", solution: "Nxd4", hint: "A black piece is just sitting there undefended - can you capture it for free?" },
    { fen: "6k1/5ppp/8/8/8/8/8/3R2K1 w - - 0 1", solution: "Rd8#", hint: "The black king has no room to escape along the back row. Checkmate in one!" },
    { fen: "k7/4P3/8/8/8/8/8/K7 w - - 0 1", solution: "e8=Q+", hint: "Your pawn is one step away from becoming a queen!" },
  ],
  medium: [
    { fen: "r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1", solution: "Nc7+", hint: "Your knight can jump to a square that attacks two pieces at once!" },
    { fen: "q3k3/8/8/1N6/8/8/8/4K3 w - - 0 1", solution: "Nc7+", hint: "Your knight can fork the king and the queen at the same time!" },
    { fen: "7k/5ppp/8/8/8/8/8/Q3K3 w - - 0 1", solution: "Qa8#", hint: "The black king's own pawns are blocking its escape. Find checkmate!" },
  ],
  hard: [
    { fen: "6k1/5p1p/7Q/8/8/8/1B6/4K3 w - - 0 1", solution: "Qg7#", hint: "Your queen and bishop are teaming up. Where can the queen go safely to deliver mate?" },
    { fen: "1r2nk2/8/8/8/8/3Q4/8/4K3 w - - 0 1", solution: "Qb5", hint: "One quiet queen move attacks two undefended black pieces at once - can you spot it?" },
    { fen: "q1r1k3/8/8/3N4/8/8/8/4K3 w - - 0 1", solution: "Nb6", hint: "Your knight can jump to a square that forks two valuable black pieces!" },
  ],
};

const PALETTE = {
  Bunny: { body: "#FFD8EA", ear: "#FFB6D9", accent: "#FF6FA5", blush: "#FFA6C9" },
  Cat: { body: "#FFC98B", ear: "#FFB35C", accent: "#E8853B", blush: "#FF9E9E" },
  Dog: { body: "#E8C08E", ear: "#B9803F", accent: "#8B5E34", blush: "#FFA6A6" },
  Fox: { body: "#FF9955", ear: "#FF7A2E", accent: "#C24E00", blush: "#FFC2C2", muzzle: "#FFF3E4" },
  Owl: { body: "#D9B45C", ear: "#C99A3B", accent: "#7B5218", blush: "#FFC9A0", eye: "#7B4B12" },
  Lion: { body: "#FFDD77", ear: "#F7A531", accent: "#E8790A", blush: "#FFB98A" },
};

function AnimalIcon({ kind, size = 46 }) {
  const isOwl = kind === "Owl";
  const isLion = kind === "Lion";
  const isFox = kind === "Fox";
  const pal = PALETTE[kind] || PALETTE.Bunny;
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className="kAnimal">
      {isLion && (
        <circle cx="24" cy="30" r="21" fill="none" stroke={pal.ear} strokeWidth="4" strokeDasharray="5 4" />
      )}
      {kind === "Bunny" && (<>
        <rect x="12" y="2" width="7" height="22" rx="3.5" fill={pal.body} stroke={pal.accent} strokeWidth="2" />
        <rect x="29" y="2" width="7" height="22" rx="3.5" fill={pal.body} stroke={pal.accent} strokeWidth="2" />
        <rect x="14" y="6" width="3" height="14" rx="1.5" fill={pal.ear} />
        <rect x="31" y="6" width="3" height="14" rx="1.5" fill={pal.ear} />
      </>)}
      {kind === "Cat" && (<>
        <path d="M10 16 L16 2 L22 16 Z" fill={pal.body} stroke={pal.accent} strokeWidth="2" strokeLinejoin="round" />
        <path d="M26 16 L32 2 L38 16 Z" fill={pal.body} stroke={pal.accent} strokeWidth="2" strokeLinejoin="round" />
        <path d="M13 13 L16 6 L19 13 Z" fill={pal.ear} />
        <path d="M29 13 L32 6 L35 13 Z" fill={pal.ear} />
      </>)}
      {kind === "Dog" && (<>
        <ellipse cx="9" cy="28" rx="7" ry="12" fill={pal.body} stroke={pal.accent} strokeWidth="2" />
        <ellipse cx="39" cy="28" rx="7" ry="12" fill={pal.body} stroke={pal.accent} strokeWidth="2" />
      </>)}
      {isFox && (<>
        <path d="M9 18 L16 3 L21 18 Z" fill={pal.body} stroke={pal.accent} strokeWidth="2" strokeLinejoin="round" />
        <path d="M27 18 L32 3 L39 18 Z" fill={pal.body} stroke={pal.accent} strokeWidth="2" strokeLinejoin="round" />
        <path d="M12 15 L16 8 L19 15 Z" fill={pal.muzzle} />
        <path d="M29 15 L32 8 L36 15 Z" fill={pal.muzzle} />
      </>)}
      {isOwl && (<>
        <path d="M13 11 L18 3 L20 12 Z" fill={pal.body} stroke={pal.accent} strokeWidth="2" strokeLinejoin="round" />
        <path d="M35 11 L30 3 L28 12 Z" fill={pal.body} stroke={pal.accent} strokeWidth="2" strokeLinejoin="round" />
      </>)}
      {isLion && (<>
        <path d="M8 20 L14 8 L18 20 Z" fill={pal.ear} stroke={pal.accent} strokeWidth="2" strokeLinejoin="round" />
        <path d="M40 20 L34 8 L30 20 Z" fill={pal.ear} stroke={pal.accent} strokeWidth="2" strokeLinejoin="round" />
      </>)}
      <circle cx="24" cy="30" r="15" fill={pal.body} stroke={pal.accent} strokeWidth="2" />
      <circle cx="15" cy="34" r="3" fill={pal.blush} opacity="0.85" />
      <circle cx="33" cy="34" r="3" fill={pal.blush} opacity="0.85" />
      {isFox && <ellipse cx="24" cy="34" rx="7" ry="8" fill={pal.muzzle} />}
      {isOwl ? (<>
        <circle cx="17" cy="28" r="5.5" fill="#fff" stroke={pal.accent} strokeWidth="2" />
        <circle cx="31" cy="28" r="5.5" fill="#fff" stroke={pal.accent} strokeWidth="2" />
        <circle cx="17" cy="28" r="2.2" fill={pal.eye} />
        <circle cx="31" cy="28" r="2.2" fill={pal.eye} />
        <path d="M22 33 L26 33 L24 38 Z" fill="#F2A65A" />
      </>) : (<>
        <circle cx="19" cy="27" r="2" fill="#3a2a1a" />
        <circle cx="29" cy="27" r="2" fill="#3a2a1a" />
        <path d="M22 33 L26 33 L24 36 Z" fill="#3a2a1a" />
        <path d="M24 36 L24 39 M24 39 L20 41 M24 39 L28 41" stroke="#3a2a1a" strokeWidth="1.5" fill="none" />
      </>)}
    </svg>
  );
}

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

  const [puzzleTier, setPuzzleTier] = useState(null);
  const [activePuzzle, setActivePuzzle] = useState(null);
  const [puzzleFeedback, setPuzzleFeedback] = useState(null);

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
    if (over.winner === playerColor) audio.sfxWin();
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
    setSelected(-1); setTargets([]);
    const over = checkGameOver();
    setResult(over);
    announceResult(over);
    rerender();
    if (!over) engineMoveRef.current();
  };

  const onSquare = (i64) => {
    if (thinking || result || promo) return;
    if (eng.getSide() !== playerColor) return;
    const legal = eng.legalMoves();
    const sq120 = M64TO120[i64];
    if (selected >= 0) {
      const from120 = M64TO120[selected];
      const candidates = legal.filter(m => mFrom(m) === from120 && mTo(m) === sq120);
      if (candidates.length > 0) {
        if (candidates.length > 1) { setPromo({ from: from120, to: sq120, moves: candidates }); return; }
        playMove(candidates[0]);
        return;
      }
    }
    const p = eng.pieceAt(i64);
    if (p !== EMPTY && p * playerColor > 0) {
      setSelected(i64);
      setTargets(legal.filter(m => mFrom(m) === sq120).map(m => M120TO64[mTo(m)]));
    } else { setSelected(-1); setTargets([]); }
  };

  const newGame = (color) => {
    eng.reset();
    setPlayerColor(color);
    moveListRef.current = [];
    setSelected(-1); setTargets([]); setMoveList([]); setResult(null); setPromo(null); setBotLastMove(null);
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
    setSelected(-1); setTargets([]); setResult(null); setPromo(null); setBotLastMove(null);
    rerender();
  };

  const startPuzzle = (tier) => {
    if (thinking) return;
    const list = PUZZLES[tier];
    const puzzle = list[(Math.random() * list.length) | 0];
    eng.loadFen(puzzle.fen);
    setActivePuzzle(puzzle);
    setPuzzleTier(tier);
    setPuzzleFeedback(null);
    setSelected(-1); setTargets([]); setBotLastMove(null);
    rerender();
  };

  const onPuzzleSquare = (i64) => {
    if (puzzleFeedback) return;
    const legal = eng.legalMoves();
    const sq120 = M64TO120[i64];
    if (selected >= 0) {
      const from120 = M64TO120[selected];
      const candidates = legal.filter(m => mFrom(m) === from120 && mTo(m) === sq120);
      if (candidates.length > 0) {
        const move = candidates.find(m => mPromo(m) === 0 || mPromo(m) === WQ) || candidates[0];
        const san = eng.sanOf(move);
        const correct = san === activePuzzle.solution;
        eng.make(move);
        if (correct) audio.sfxWin(); else audio.sfxLose();
        setPuzzleFeedback(correct ? "correct" : "wrong");
        setSelected(-1); setTargets([]);
        rerender();
        return;
      }
    }
    const p = eng.pieceAt(i64);
    if (p > 0) {
      setSelected(i64);
      setTargets(legal.filter(m => mFrom(m) === sq120).map(m => M120TO64[mTo(m)]));
    } else { setSelected(-1); setTargets([]); }
  };

  const retryPuzzle = () => {
    eng.unmake();
    setPuzzleFeedback(null);
    setSelected(-1); setTargets([]);
    rerender();
  };

  const exitPuzzle = () => {
    eng.reset();
    replayIntoEngine(eng, moveList);
    setActivePuzzle(null); setPuzzleTier(null); setPuzzleFeedback(null);
    setSelected(-1); setTargets([]);
    setView("play");
    rerender();
  };

  const buildBoardRows = (flippedFlag, clickHandler) => {
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
        const kingInCheck = p * eng.getSide() === WK && eng.inCheckNow();
        cells.push(
          <div key={i64} onClick={() => clickHandler(i64)}
            className={"kSq " + (light ? "kLight" : "kDark") + (isSel ? " kSel" : "") + (isBotLast ? " kLast" : "") + (kingInCheck ? " kChk" : "")}>
            {p !== EMPTY && <span className={"kPc " + (p > 0 ? "kPcW" : "kPcB")}>{glyphFor(p)}</span>}
            {isTarget && <span className="kDot" />}
            {vf === 0 && <span className="kCoord kRk">{r + 1}</span>}
            {vr === 7 && <span className="kCoord kFl">{FILES[f]}</span>}
          </div>
        );
      }
      rows.push(<div key={vr} className="kRow">{cells}</div>);
    }
    return rows;
  };

  if (view === "puzzle") {
    const tierLabel = puzzleTier ? puzzleTier[0].toUpperCase() + puzzleTier.slice(1) : "";
    return (
      <div className="kRoot">
        <div className="kHdr">
          <AnimalIcon kind={DIFFICULTIES[difficultyIdx].label} />
          <h1>Kinnda Chess</h1>
        </div>
        {!activePuzzle ? (
          <>
            <div className="kStatus">Pick a puzzle level!</div>
            <div className="kCtrls">
              <button onClick={() => startPuzzle("easy")}>Easy</button>
              <button onClick={() => startPuzzle("medium")}>Medium</button>
              <button onClick={() => startPuzzle("hard")}>Hard</button>
            </div>
            <div className="kCtrls">
              <button onClick={exitPuzzle}>Back to the Game</button>
            </div>
          </>
        ) : (
          <>
            <div className="kStatus">
              {puzzleFeedback === "correct" ? "You got it! Great puzzle solving!"
                : puzzleFeedback === "wrong" ? "Not quite - give it another try!"
                : `${tierLabel} puzzle - find White's best move!`}
            </div>
            {!puzzleFeedback && <div className="kMoves">{activePuzzle.hint}</div>}
            <div className="kBoardWrap">
              <div className="kBoard">{buildBoardRows(false, onPuzzleSquare)}</div>
            </div>
            <div className="kCtrls">
              {puzzleFeedback === "wrong" && <button onClick={retryPuzzle}>Try Again</button>}
              {puzzleFeedback === "correct" && <button onClick={() => startPuzzle(puzzleTier)}>Next Puzzle</button>}
              <button onClick={exitPuzzle}>Back to the Game</button>
            </div>
          </>
        )}
      </div>
    );
  }

  if (view === "lessons") {
    return (
      <div className="kRoot">
        <div className="kHdr">
          <AnimalIcon kind={DIFFICULTIES[difficultyIdx].label} />
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
        <div className="kCtrls">
          <button onClick={() => setView("play")}>Back to the Game</button>
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

  const Tray = ({ pieces }) => (
    <div className="kTray">
      {pieces.length === 0
        ? <span className="kTrayEmpty">no captures yet</span>
        : pieces.map((t, i) => <span key={i} className="kTrayPc">{GLYPH[t]}</span>)}
    </div>
  );

  return (
    <div className="kRoot">
      <div className="kHdr">
        <AnimalIcon kind={DIFFICULTIES[difficultyIdx].label} />
        <h1>Kinnda Chess</h1>
        <button className="kMusicBtn" onClick={() => setMusicOn(audio.toggle())} title={musicOn ? "Pause music" : "Play music"}>
          {musicOn ? "♪⏸" : "♪▶"}
        </button>
      </div>
      <div className="kStatus">{status}</div>

      <div className="kCaptureRow">
        <span className="kCaptureLabel">{opponentName}'s captures:</span>
        <Tray pieces={opponentCaptured} />
      </div>

      <div className="kBoardWrap">
        <div className="kBoard">{rows}</div>
        {promo && (
          <div className="kPromoOv">
            {[WQ, WR, WB, WN].map(pp => (
              <button key={pp} onClick={() => {
                const m = promo.moves.find(x => mPromo(x) === pp);
                setPromo(null);
                if (m) playMove(m);
              }}><span className={"kPc " + (eng.getSide() === 1 ? "kPcW" : "kPcB")}>{GLYPH[pp]}</span></button>
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
        <button onClick={() => newGame(1)}>Play White</button>
        <button onClick={() => newGame(-1)}>Play Black</button>
        <button onClick={undo} disabled={thinking || !!result || eng.plyCount() === 0}>Undo</button>
        <select value={difficultyIdx} onChange={e => setDifficultyIdx(Number(e.target.value))}>
          {DIFFICULTIES.map((d, i) => <option key={i} value={i}>{d.label} ({d.elo})</option>)}
        </select>
        <button onClick={() => setView("lessons")}>How to Play</button>
        <button onClick={() => setView("puzzle")} disabled={thinking}>Puzzles</button>
        {result && <button onClick={() => newGame(playerColor)}>Play Again!</button>}
      </div>
    </div>
  );
}
