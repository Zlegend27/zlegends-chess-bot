import { useState, useRef, useCallback } from "react";
import {
  createEngine, EMPTY, WN, WB, WR, WQ, WK, M64TO120, M120TO64,
  mFrom, mTo, mPromo,
} from "../src/engine/chessEngine";

/* Minimal, no-animation, no-audio, no-worker UI for a jailbroken Kindle's
   old Experimental Browser. Runs the search synchronously on the main
   thread — acceptable since e-ink itself already refreshes at ~500ms. */

const DIFFICULTIES = [
  { label: "Idiot", ms: 250, blunderChance: 0.6 },
  { label: "Casual", ms: 600 },
  { label: "Normal", ms: 2000 },
  { label: "Hard", ms: 5000 },
  { label: "Master", ms: 12000 },
];

/* The rarer "outline" chess Unicode code points (white pieces) aren't
   reliably present in every font, and Kindle's font set is an unknown —
   so use the one universally-supported glyph set for both colors and
   distinguish white with a plain circular outline instead (pure CSS,
   nothing font-dependent). */
const GLYPH = { 1: "♟︎", 2: "♞︎", 3: "♝︎", 4: "♜︎", 5: "♛︎", 6: "♚︎" };
const glyphFor = (piece) => GLYPH[Math.abs(piece)];
const FILES = "abcdefgh";

export default function KindleApp() {
  const engRef = useRef(null);
  if (!engRef.current) engRef.current = createEngine();
  const eng = engRef.current;

  const [, force] = useState(0);
  const rerender = () => force(n => n + 1);

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

  const status = result
    ? `${result.reason} - ${result.text}`
    : thinking ? "Bot is thinking..."
    : eng.getSide() === playerColor ? "Your move" : "Bot to move";

  return (
    <div className="kRoot">
      <h1>Kindle Chess</h1>
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

      <div className="kMoves">{moveText || "No moves yet."}</div>

      <div className="kCtrls">
        <button onClick={() => newGame(1)}>New (White)</button>
        <button onClick={() => newGame(-1)}>New (Black)</button>
        <button onClick={undo} disabled={thinking || !!result || eng.plyCount() === 0}>Undo</button>
        <select value={difficultyIdx} onChange={e => setDifficultyIdx(Number(e.target.value))}>
          {DIFFICULTIES.map((d, i) => <option key={i} value={i}>{d.label}</option>)}
        </select>
        {result && <button onClick={() => newGame(playerColor)}>Rematch</button>}
      </div>
    </div>
  );
}
