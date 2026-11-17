import { useRef, useState } from "react";
import StarField from "./StarField";
import SubPage from "./SubPage";
import LessonBoard from "./LessonBoard";
import PixelAvatar, { TPAL, TPIX } from "./PixelAvatar";
import { createEngine, mFrom, mTo, mPromo, M64TO120, M120TO64 } from "../engine/chessEngine";
import { gameResult } from "../utils/gameResult";
import { getUiTheme } from "../utils/uiTheme";
import { getPieceSet } from "../utils/pieceSets";
import { useBestMove, scoreLabel } from "../utils/useBestMove";
import { loadSetting, saveSetting } from "../utils/storage";

/* Play with yourself: one person moves both sides, to try out their own
   ideas. First a choice of board (the normal one here, or Chess Tactica's
   3D one), then the board: undo, flip, start over, and Analysis, which
   draws Stockfish's best move for whoever is to move. The moves are kept
   on the device, so an idea survives leaving the page. */
const SAVE = "selfPlayMoves";
const QUEEN = 5;

export default function SelfPlayPage({ pieceSetId, boardVars, sweetheart, onBack, onTactica }) {
  const [board, setBoard] = useState(false);
  const T = getUiTheme(sweetheart);
  const card = `rounded-2xl border ${T.cardBorder} ${T.panelBg} backdrop-blur-sm`;
  const focus = `focus-visible:outline-none focus-visible:ring-2 ${T.ring}`;

  if (board) return <SelfBoard pieceSetId={pieceSetId} boardVars={boardVars} sweetheart={sweetheart} onBack={() => setBoard(false)} />;

  return (
    <SubPage onBack={onBack} sweetheart={sweetheart}>
      <div className="flex flex-col gap-3">
        <h1 className={"m-0 text-xl font-bold " + T.ink}>Play with yourself</h1>
        <p className={"m-0 text-sm leading-relaxed " + T.dimText}>Move both sides and try out your own ideas. Turn on Analysis any time to see the engine&apos;s best move.</p>
        <button type="button" onClick={() => setBoard(true)} className={`${card} flex w-full cursor-pointer items-center gap-3 p-4 text-left transition hover:-translate-y-0.5 ${focus}`}>
          <img src={getPieceSet(pieceSetId).svgUrl(2, true)} alt="" width="40" height="40" />
          <span className={"flex-1 text-base font-bold " + T.ink}>Normal board</span>
        </button>
        <button type="button" onClick={onTactica} className={`${card} flex w-full cursor-pointer items-center gap-3 p-4 text-left transition hover:-translate-y-0.5 ${focus}`}>
          <PixelAvatar rows={TPIX} pal={TPAL} size={40} />
          <span className={"flex-1 text-base font-bold " + T.ink}>Chess Tactica board</span>
        </button>
      </div>
    </SubPage>
  );
}

function SelfBoard({ pieceSetId, boardVars, sweetheart, onBack }) {
  const T = getUiTheme(sweetheart);
  const engRef = useRef(null);
  /* The moves so far, replayed into a fresh engine on first open. */
  const [moves, setMoves] = useState(() => {
    const eng = createEngine();
    eng.reset();
    const saved = loadSetting(SAVE, []);
    const played = [];
    for (const san of Array.isArray(saved) ? saved : []) {
      const m = eng.legalMoves().find((x) => eng.sanOf(x) === san);
      if (m === undefined) break;
      eng.make(m);
      played.push(san);
    }
    engRef.current = eng;
    return played;
  });
  const eng = engRef.current;
  const [selected, setSelected] = useState(-1);
  const [targets, setTargets] = useState([]);
  const [lastMove, setLastMove] = useState(null);
  const [flipped, setFlipped] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  /* A pawn waiting on its last rank: { from, to } 120-squares. */
  const [promo, setPromo] = useState(null);

  const fen = eng.fen();
  const result = gameResult(eng);
  const best = useBestMove(fen, analysing && !result);
  const arrows = analysing && best && !best.none ? [{ from: best.from, to: best.to, color: "#3FAE5A" }] : [];

  const keep = (list) => { setMoves(list); saveSetting(SAVE, list); };
  const clearPick = () => { setSelected(-1); setTargets([]); };

  const make = (move) => {
    const san = eng.sanOf(move);
    eng.make(move);
    setLastMove({ from: mFrom(move), to: mTo(move) });
    setPromo(null);
    clearPick();
    keep([...moves, san]);
  };

  const onSquare = (i64) => {
    if (promo || result) return;
    const legal = eng.legalMoves();
    const sq120 = M64TO120[i64];
    if (selected >= 0) {
      const from120 = M64TO120[selected];
      const found = legal.filter((m) => mFrom(m) === from120 && mTo(m) === sq120);
      if (found.length > 1) { setPromo({ from: from120, to: sq120 }); return; }
      if (found.length === 1) { make(found[0]); return; }
    }
    const p = eng.pieceAt(i64);
    if (p !== 0 && Math.sign(p) === eng.getSide() && i64 !== selected) {
      setSelected(i64);
      setTargets(legal.filter((m) => mFrom(m) === sq120).map((m) => M120TO64[mTo(m)]));
    } else clearPick();
  };

  const promote = (piece) => {
    const move = eng.legalMoves().find((m) => mFrom(m) === promo.from && mTo(m) === promo.to && mPromo(m) === piece);
    if (move !== undefined) make(move);
  };

  const undo = () => {
    if (!moves.length) return;
    eng.unmake();
    setPromo(null);
    clearPick();
    setLastMove(null);
    keep(moves.slice(0, -1));
  };
  const restart = () => {
    eng.reset();
    setPromo(null);
    clearPick();
    setLastMove(null);
    keep([]);
  };

  const toMove = eng.getSide() === 1 ? "White" : "Black";
  const status = result
    ? `${result.reason}${result.winner ? `, ${result.winner === 1 ? "White" : "Black"} wins` : ""} ${result.text}`
    : `${toMove} to move${eng.inCheckNow() ? ", in check" : ""}`;
  const analysisLine = !analysing || result ? null
    : !best ? "Thinking…"
    : best.none ? "No best move found"
    : `Best: ${best.san} · ${scoreLabel(best.score)}`;
  const btn = "btn ghost";

  return (
    <div className="root" style={boardVars}>
      <StarField sweetheart={sweetheart} />
      <div className="relative z-10 flex w-full max-w-md flex-col gap-3">
        <button
          type="button"
          onClick={onBack}
          className={`inline-flex h-11 items-center gap-1.5 self-start border-0 bg-transparent text-sm font-bold ${T.dimText} ${T.hoverInk} focus-visible:outline-none focus-visible:ring-2 ${T.ring}`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" /></svg>
          Back
        </button>
        <div className="flex items-baseline justify-between gap-2">
          <span className={"text-base font-bold " + T.ink} aria-live="polite">{status}</span>
          {analysisLine && <span className={"text-sm font-bold " + T.interactiveText} aria-live="polite">{analysisLine}</span>}
        </div>
        <div style={{ position: "relative" }}>
          <LessonBoard eng={eng} orientation={flipped ? "black" : "white"} selected={selected} targets={targets}
            lastMove={lastMove} onSquare={onSquare} pieceSetId={pieceSetId} arrows={arrows} />
          {promo && (
            <div className="promoOv">
              <div className="promoBox pieceBox" role="dialog" aria-label="Promote to">
                {[QUEEN, 4, 3, 2].map((t) => (
                  <button key={t} type="button" onClick={() => promote(t)} aria-label={["", "", "Knight", "Bishop", "Rook", "Queen"][t]}>
                    <img src={getPieceSet(pieceSetId).svgUrl(t, eng.getSide() === 1)} alt="" width="48" height="48" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={analysing ? "btn gold" : "btn"} aria-pressed={analysing} onClick={() => setAnalysing((a) => !a)} style={{ flex: 1 }}>
            {analysing ? "Analysis on" : "Analysis"}
          </button>
          <button type="button" className={btn} onClick={undo} disabled={!moves.length}>Undo</button>
          <button type="button" className={btn} onClick={() => setFlipped((f) => !f)}>Flip</button>
          <button type="button" className={btn} onClick={restart} disabled={!moves.length}>Start over</button>
        </div>
        {moves.length > 0 && (
          <ol className={"m-0 grid max-h-40 list-none grid-cols-[auto_1fr_1fr] gap-x-3 overflow-y-auto p-0 text-sm " + T.ink} style={{ fontFamily: "var(--font-mono)" }} aria-label="Moves">
            {Array.from({ length: Math.ceil(moves.length / 2) }, (_, i) => (
              <li key={i} className="contents">
                <span className={T.dimText}>{i + 1}.</span>
                <span>{moves[i * 2]}</span>
                <span>{moves[i * 2 + 1] ?? ""}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
