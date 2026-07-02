import { useState, useRef, useCallback } from "react";
import {
  createEngine, EMPTY, WN, WB, WR, WQ, WK, M64TO120, M120TO64,
  mFrom, mTo, mPromo,
} from "../src/engine/chessEngine";

/* Minimal, no-animation, no-audio, no-worker UI for a jailbroken Kindle's
   old Experimental Browser. Runs the search synchronously on the main
   thread — acceptable since e-ink itself already refreshes at ~500ms.
   This is a single dedicated device for one child, so the theme leans
   cute/playful rather than trying to match the web app's look at all. */

/* A ladder of animal opponents from beginner to strong club-level. The elo
   numbers are a best-effort approximation (mostly driven by blunderChance,
   which controls how often it plays a random legal move instead of its
   real search) — there's no way to calibrate this against real rated
   games from here, so treat these as "roughly this strength", not exact. */
const DIFFICULTIES = [
  { label: "Bunny", elo: 300, ms: 150, blunderChance: 0.85 },
  { label: "Cat", elo: 600, ms: 300, blunderChance: 0.55 },
  { label: "Dog", elo: 900, ms: 600, blunderChance: 0.3 },
  { label: "Fox", elo: 1200, ms: 1200, blunderChance: 0.12 },
  { label: "Owl", elo: 1600, ms: 3000, blunderChance: 0.03 },
  { label: "Lion", elo: 2000, ms: 8000, blunderChance: 0 },
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

function AnimalIcon({ kind, size = 46 }) {
  const isOwl = kind === "Owl";
  const isLion = kind === "Lion";
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className="kAnimal">
      {isLion && (
        <circle cx="24" cy="30" r="21" fill="none" stroke="#000" strokeWidth="2" strokeDasharray="4 3" />
      )}
      {kind === "Bunny" && (<>
        <rect x="12" y="2" width="7" height="22" rx="3.5" fill="#fff" stroke="#000" strokeWidth="2" />
        <rect x="29" y="2" width="7" height="22" rx="3.5" fill="#fff" stroke="#000" strokeWidth="2" />
      </>)}
      {kind === "Cat" && (<>
        <path d="M10 16 L16 2 L22 16 Z" fill="#fff" stroke="#000" strokeWidth="2" strokeLinejoin="round" />
        <path d="M26 16 L32 2 L38 16 Z" fill="#fff" stroke="#000" strokeWidth="2" strokeLinejoin="round" />
      </>)}
      {kind === "Dog" && (<>
        <ellipse cx="9" cy="28" rx="7" ry="12" fill="#fff" stroke="#000" strokeWidth="2" />
        <ellipse cx="39" cy="28" rx="7" ry="12" fill="#fff" stroke="#000" strokeWidth="2" />
      </>)}
      {kind === "Fox" && (<>
        <path d="M9 18 L16 3 L21 18 Z" fill="#fff" stroke="#000" strokeWidth="2" strokeLinejoin="round" />
        <path d="M27 18 L32 3 L39 18 Z" fill="#fff" stroke="#000" strokeWidth="2" strokeLinejoin="round" />
      </>)}
      {isOwl && (<>
        <path d="M13 11 L18 3 L20 12 Z" fill="#fff" stroke="#000" strokeWidth="2" strokeLinejoin="round" />
        <path d="M35 11 L30 3 L28 12 Z" fill="#fff" stroke="#000" strokeWidth="2" strokeLinejoin="round" />
      </>)}
      {isLion && (<>
        <path d="M8 20 L14 8 L18 20 Z" fill="#fff" stroke="#000" strokeWidth="2" strokeLinejoin="round" />
        <path d="M40 20 L34 8 L30 20 Z" fill="#fff" stroke="#000" strokeWidth="2" strokeLinejoin="round" />
      </>)}
      <circle cx="24" cy="30" r="15" fill="#fff" stroke="#000" strokeWidth="2" />
      {isOwl ? (<>
        <circle cx="17" cy="28" r="5" fill="#fff" stroke="#000" strokeWidth="2" />
        <circle cx="31" cy="28" r="5" fill="#fff" stroke="#000" strokeWidth="2" />
        <circle cx="17" cy="28" r="1.6" fill="#000" />
        <circle cx="31" cy="28" r="1.6" fill="#000" />
        <path d="M22 33 L26 33 L24 38 Z" fill="#000" />
      </>) : (<>
        <circle cx="19" cy="27" r="2" fill="#000" />
        <circle cx="29" cy="27" r="2" fill="#000" />
        <path d="M22 33 L26 33 L24 36 Z" fill="#000" />
        <path d="M24 36 L24 39 M24 39 L20 41 M24 39 L28 41" stroke="#000" strokeWidth="1.5" fill="none" />
      </>)}
    </svg>
  );
}

export default function KindleApp() {
  const engRef = useRef(null);
  if (!engRef.current) engRef.current = createEngine();
  const eng = engRef.current;

  const [, force] = useState(0);
  const rerender = () => force(n => n + 1);

  const [view, setView] = useState("play");
  const [playerColor, setPlayerColor] = useState(1);
  const [selected, setSelected] = useState(-1);
  const [targets, setTargets] = useState([]);
  const [moveList, setMoveList] = useState([]);
  const [thinking, setThinking] = useState(false);
  const [result, setResult] = useState(null);
  const [promo, setPromo] = useState(null);
  const [difficultyIdx, setDifficultyIdx] = useState(1);

  const checkGameOver = useCallback(() => {
    const legal = eng.legalMoves();
    if (legal.length === 0) {
      if (eng.inCheckNow()) {
        const winner = -eng.getSide();
        return { text: winner === 1 ? "1-0" : "0-1", reason: "Checkmate" };
      }
      return { text: "1/2-1/2", reason: "Stalemate" };
    }
    if (eng.halfClock() >= 100) return { text: "1/2-1/2", reason: "Fifty-move rule" };
    if (eng.repetitionCount() >= 3) return { text: "1/2-1/2", reason: "Threefold repetition" };
    if (eng.insufficientMaterial()) return { text: "1/2-1/2", reason: "Insufficient material" };
    return null;
  }, [eng]);

  const engineMoveRef = useRef(null);
  const engineMove = useCallback(() => {
    setThinking(true);
    const diff = DIFFICULTIES[difficultyIdx];
    setTimeout(() => {
      const res = eng.search(diff.ms, diff.blunderChance || 0);
      if (res && res.move) {
        const san = eng.sanOf(res.move);
        eng.make(res.move);
        setMoveList(l => [...l, san]);
        const over = checkGameOver();
        setResult(over);
      }
      setThinking(false);
      rerender();
    }, 0);
  }, [eng, difficultyIdx, checkGameOver]);
  engineMoveRef.current = engineMove;

  const playMove = (m) => {
    const san = eng.sanOf(m);
    eng.make(m);
    setMoveList(l => [...l, san]);
    setSelected(-1); setTargets([]);
    const over = checkGameOver();
    setResult(over);
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
    setSelected(-1); setTargets([]); setMoveList([]); setResult(null); setPromo(null);
    rerender();
    if (color === -1) setTimeout(() => engineMoveRef.current(), 30);
  };

  const undo = () => {
    if (thinking || result || eng.plyCount() === 0) return;
    let n;
    if (eng.getSide() === playerColor && eng.plyCount() >= 2) n = 2; else n = 1;
    for (let i = 0; i < n; i++) eng.unmake();
    setMoveList(l => l.slice(0, l.length - n));
    setSelected(-1); setTargets([]); setResult(null); setPromo(null);
    rerender();
  };

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
  const rows = [];
  for (let vr = 0; vr < 8; vr++) {
    const r = flipped ? vr : 7 - vr;
    const cells = [];
    for (let vf = 0; vf < 8; vf++) {
      const f = flipped ? 7 - vf : vf;
      const i64 = r * 8 + f;
      const p = eng.pieceAt(i64);
      const light = (r + f) % 2 === 1;
      const isSel = selected === i64;
      const isTarget = targets.includes(i64);
      const kingInCheck = p * eng.getSide() === WK && eng.inCheckNow();
      cells.push(
        <div key={i64} onClick={() => onSquare(i64)}
          className={"kSq " + (light ? "kLight" : "kDark") + (isSel ? " kSel" : "") + (kingInCheck ? " kChk" : "")}>
          {p !== EMPTY && <span className={"kPc " + (p > 0 ? "kPcW" : "kPcB")}>{glyphFor(p)}</span>}
          {isTarget && <span className="kDot" />}
          {vf === 0 && <span className="kCoord kRk">{r + 1}</span>}
          {vr === 7 && <span className="kCoord kFl">{FILES[f]}</span>}
        </div>
      );
    }
    rows.push(<div key={vr} className="kRow">{cells}</div>);
  }

  const pairs = [];
  for (let i = 0; i < moveList.length; i += 2) pairs.push([i / 2 + 1, moveList[i], moveList[i + 1]]);
  const moveText = pairs.map(([n, w, b]) => `${n}.${w}${b ? " " + b : ""}`).join("  ");

  const opponentName = DIFFICULTIES[difficultyIdx].label;
  const status = result
    ? `${result.reason} - ${result.text}`
    : thinking ? `${opponentName} is thinking...`
    : eng.getSide() === playerColor ? "Your move!" : `${opponentName}'s move`;

  return (
    <div className="kRoot">
      <div className="kHdr">
        <AnimalIcon kind={DIFFICULTIES[difficultyIdx].label} />
        <h1>Kinnda Chess</h1>
      </div>
      <div className="kStatus">{status}</div>

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

      <div className="kMoves">{moveText || "No moves yet - good luck!"}</div>

      <div className="kCtrls">
        <button onClick={() => newGame(1)}>Play White</button>
        <button onClick={() => newGame(-1)}>Play Black</button>
        <button onClick={undo} disabled={thinking || !!result || eng.plyCount() === 0}>Undo</button>
        <select value={difficultyIdx} onChange={e => setDifficultyIdx(Number(e.target.value))}>
          {DIFFICULTIES.map((d, i) => <option key={i} value={i}>{d.label} ({d.elo})</option>)}
        </select>
        <button onClick={() => setView("lessons")}>How to Play</button>
        {result && <button onClick={() => newGame(playerColor)}>Play Again!</button>}
      </div>
    </div>
  );
}
