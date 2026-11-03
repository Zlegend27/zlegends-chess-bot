import { useEffect, useMemo, useRef, useState } from "react";
import { createEngine, mFrom, mPromo, mTo, M120TO64, EMPTY } from "../engine/chessEngine";
import { PUZZLES } from "../utils/puzzles";
import { judgePuzzleMove } from "../utils/puzzleSession";
import { getBoardColor } from "../utils/boardColors";
import { TacticaScene } from "./scene";

/* Chess Tactica technical test: one real puzzle on a 3D board, so the
   cameras, controls and speed can be tried on a phone before anything else is
   built. Placeholder characters are the player's current piece set. Not yet
   built: refutations of wrong moves, story, character names and capture
   drama. */
const TEST_PUZZLE_ID = "00IEW";
const KNIGHT = 2, QUEEN = 5;
const REPLY_DELAY_MS = 550;
const OPENING_PAUSE_MS = 1100;

const sqOf = (sq120) => M120TO64[sq120];

/** The solver's characters, ordered left to right from their side, front row
 *  first, so swiping moves across the board predictably. */
function friendlySquares(eng, side) {
  const squares = [];
  for (let sq = 0; sq < 64; sq++) if (Math.sign(eng.pieceAt(sq)) === side) squares.push(sq);
  const rank = (sq) => (side === 1 ? (sq / 8) | 0 : 7 - ((sq / 8) | 0));
  const file = (sq) => (side === 1 ? sq % 8 : 7 - (sq % 8));
  return squares.sort((a, b) => rank(b) - rank(a) || file(a) - file(b));
}

export default function TacticaPage({ pieceImgSrc, boardColorId, sweetheart }) {
  const puzzle = useMemo(() => PUZZLES.find((p) => p.id === TEST_PUZZLE_ID), []);
  const engRef = useRef(null);
  if (!engRef.current) { engRef.current = createEngine(); engRef.current.loadFen(puzzle.fen); }
  const eng = engRef.current;
  const side = useRef(eng.getSide()).current;

  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const [sceneKey, setSceneKey] = useState(0);
  const [lost, setLost] = useState(false);
  const [view, setView] = useState("board");
  const [played, setPlayed] = useState([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [chosen, setChosen] = useState(null);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("Study the position, then switch to the close view to move.");
  const [solved, setSolved] = useState(false);
  const [stats, setStats] = useState(null);

  const friends = friendlySquares(eng, side);
  const selected = friends[Math.min(selectedIdx, friends.length - 1)];
  const movesFrom = eng.legalMoves().filter((m) => sqOf(mFrom(m)) === selected);
  const targets = [...new Set(movesFrom.map((m) => sqOf(mTo(m))))];
  const captures = targets.filter((sq) => eng.pieceAt(sq) !== EMPTY);
  const canMove = view === "close" && !busy && !solved;

  const piecesNow = () => {
    const list = [];
    for (let sq = 0; sq < 64; sq++) {
      const p = eng.pieceAt(sq);
      if (p !== EMPTY) list.push({ sq, url: pieceImgSrc(Math.abs(p), p > 0) });
    }
    return list;
  };

  /* One scene per mount, rebuilt if the phone drops the 3D context. */
  useEffect(() => {
    const board = getBoardColor(boardColorId);
    const scene = new TacticaScene(canvasRef.current, {
      flipped: side === -1,
      colors: {
        light: board.light, dark: board.dark, background: sweetheart ? "#FFF2F6" : "#0E0620",
        highlight: "#3EE7F5", target: "#F5D93E", attack: "#F05348", select: "#3EE7F5",
      },
      onTap: (sq) => tapRef.current(sq),
      onSwipe: (dir) => swipeRef.current(dir),
      onLost: () => setLost(true),
    });
    sceneRef.current = scene;
    scene.setPieces(piecesNow());
    const opening = setTimeout(() => { setView("close"); setBusy(false); }, sceneKey ? 0 : OPENING_PAUSE_MS);
    const readout = setInterval(() => setStats(scene.stats()), 1000);
    return () => { clearTimeout(opening); clearInterval(readout); scene.dispose(); sceneRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneKey]);

  /* Camera and highlights follow the state. */
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (view === "board") scene.showBoard();
    else scene.showCloseUp(selected, chosen);
    scene.setMarks(view === "close" && !solved ? { selected, targets, chosen, captures } : {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, selected, chosen, played, solved, sceneKey]);

  const playMove = async (move) => {
    const scene = sceneRef.current;
    const from = sqOf(mFrom(move)), to = sqOf(mTo(move));
    const captured = eng.pieceAt(to) !== EMPTY ? to : null;
    const knight = Math.abs(eng.pieceAt(from)) === KNIGHT;
    await scene.animateMove(from, to, { knight, captured });
    eng.make(move);
    await scene.setPieces(piecesNow());
  };

  const confirm = async () => {
    const move = movesFrom.find((m) => sqOf(mTo(m)) === chosen && (!mPromo(m) || mPromo(m) === QUEEN));
    if (!move) return;
    const verdict = judgePuzzleMove(eng, puzzle, played, move);
    if (!verdict.ok) {
      setMessage(`${verdict.san} isn't the answer. In the prototype the opponent will show why. Try again.`);
      setChosen(null);
      return;
    }
    setBusy(true);
    setChosen(null);
    setMessage(null);
    await playMove(move);
    const afterMine = [...played, verdict.san];
    if (verdict.solved) {
      setPlayed(afterMine);
      setSolved(true);
      setBusy(false);
      setMessage("Puzzle solved!");
      return;
    }
    await new Promise((r) => setTimeout(r, REPLY_DELAY_MS));
    const reply = eng.legalMoves().find((m) => eng.sanOf(m) === verdict.reply);
    if (reply) await playMove(reply);
    setMessage(`Opponent played ${verdict.reply}.`);
    setPlayed([...afterMine, verdict.reply]);
    setSelectedIdx((i) => Math.min(i, friendlySquares(eng, side).length - 1));
    setBusy(false);
  };

  const restart = () => {
    eng.loadFen(puzzle.fen);
    setPlayed([]);
    setSolved(false);
    setChosen(null);
    setSelectedIdx(0);
    setMessage("Study the position, then switch to the close view to move.");
    sceneRef.current?.setPieces(piecesNow());
  };

  const cycleCharacter = (dir) => {
    if (busy) return;
    setChosen(null);
    setSelectedIdx((i) => (i + dir + friends.length) % friends.length);
  };
  const cycleTarget = (dir) => {
    if (!canMove || !targets.length) return;
    const i = targets.indexOf(chosen);
    setChosen(targets[(i + dir + targets.length + (i < 0 && dir > 0 ? 1 : 0)) % targets.length]);
  };
  const tapRef = useRef(null);
  tapRef.current = (sq) => {
    if (busy) return;
    const friendIdx = friends.indexOf(sq);
    if (friendIdx >= 0) { setSelectedIdx(friendIdx); setChosen(null); return; }
    if (canMove && targets.includes(sq)) setChosen(sq);
  };
  const swipeRef = useRef(null);
  swipeRef.current = cycleCharacter;

  const squareName = (sq) => `${"abcdefgh"[sq % 8]}${((sq / 8) | 0) + 1}`;
  const pieceName = (sq) => ["", "Pawn", "Knight", "Bishop", "Rook", "Queen", "King"][Math.abs(eng.pieceAt(sq))] + ` on ${squareName(sq)}`;
  const iconBtn = "flex size-11 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white disabled:opacity-40";

  return (
    <div className="relative w-full overflow-hidden" style={{ height: "calc(100dvh - var(--headerH))" }}>
      <canvas key={sceneKey} ref={canvasRef} className="absolute inset-0 block size-full touch-none" />

      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center gap-2 p-3">
        <div className="pointer-events-auto flex gap-2">
          <button type="button" className={`btn ${view === "board" ? "" : "ghost"}`} onClick={() => setView("board")}>Board view</button>
          <button type="button" className={`btn ${view === "close" ? "" : "ghost"}`} onClick={() => setView("close")} disabled={busy && view === "board" && !played.length}>Close view</button>
        </div>
        {message && <p className="m-0 max-w-sm rounded-lg bg-black/55 px-3 py-2 text-center text-sm text-white">{message}</p>}
      </div>

      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {solved ? (
          <button type="button" className="btn gold" onClick={restart}>Play it again</button>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <button type="button" className={iconBtn} onClick={() => cycleCharacter(-1)} aria-label="Previous character">‹</button>
              <span className="min-w-36 rounded-lg bg-black/55 px-3 py-2 text-center text-sm font-bold text-white">{selected != null ? pieceName(selected) : ""}</span>
              <button type="button" className={iconBtn} onClick={() => cycleCharacter(1)} aria-label="Next character">›</button>
            </div>
            {view === "close" && (
              <div className="flex items-center gap-3">
                <button type="button" className={iconBtn} onClick={() => cycleTarget(-1)} disabled={!canMove || !targets.length} aria-label="Previous square">◀</button>
                {chosen != null ? (
                  <>
                    <button type="button" className={"btn " + (captures.includes(chosen) ? "gold" : "")} onClick={confirm}>{captures.includes(chosen) ? "Attack" : "Confirm"} {squareName(chosen)}</button>
                    <button type="button" className="btn ghost" onClick={() => setChosen(null)}>Cancel</button>
                  </>
                ) : (
                  <span className="rounded-lg bg-black/55 px-3 py-2 text-xs text-white">{targets.length ? "Pick a square" : "No legal moves"}</span>
                )}
                <button type="button" className={iconBtn} onClick={() => cycleTarget(1)} disabled={!canMove || !targets.length} aria-label="Next square">▶</button>
              </div>
            )}
            <button type="button" className="border-0 bg-transparent text-xs text-white/70 underline" onClick={restart}>Restart puzzle</button>
          </>
        )}
        <span className="text-[10px] text-white/60">Test build · {stats?.fps ? `${stats.fps} fps while moving` : "measuring…"} · {stats?.pixelRatio ?? "-"}x</span>
      </div>

      {lost && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 p-6 text-center text-white">
          <p className="m-0">The 3D view was reset by the phone.</p>
          <button type="button" className="btn gold" onClick={() => { setLost(false); setSceneKey((k) => k + 1); }}>Restore it</button>
        </div>
      )}
    </div>
  );
}
