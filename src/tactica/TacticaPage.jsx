import { useEffect, useMemo, useRef, useState } from "react";
import { createEngine, mFrom, mPromo, mTo, M120TO64, EMPTY } from "../engine/chessEngine";
import { PUZZLES } from "../utils/puzzles";
import { judgePuzzleMove } from "../utils/puzzleSession";
import MiniBoard from "../components/MiniBoard";
import { TacticaScene, SET_BOARD } from "./scene";

/* Chess Tactica technical test: one real puzzle on a 3D board, so the
   cameras, controls and speed can be tried on a phone before anything else is
   built. The board and the living wooden pieces follow the chess set; a
   capture plays the attacker's own attack. Not yet built: refutations of
   wrong moves, story and character names. */
const TEST_PUZZLE_ID = "00IEW";
const KNIGHT = 2, QUEEN = 5;
const REPLY_DELAY_MS = 550;
const OPENING_PAUSE_MS = 1100;
const STUDY_HINT = "Tap the map to study the whole board.";

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

export default function TacticaPage({ pieceImgSrc, sweetheart }) {
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
  /* A character is picked up (double-tap, drag or the square arrows) before
     its moves show. */
  const [held, setHeld] = useState(false);
  /* While a finger drags a character the camera is the scene's to move. */
  const draggingRef = useRef(false);
  /* Set when ◀ ▶ pick a square, which may be off screen, so the camera
     follows it; a tapped square is already in view, so it stays put. */
  const followChosenRef = useRef(false);
  const playingRef = useRef(false);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState(STUDY_HINT);
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
      if (p !== EMPTY) list.push({ sq, type: Math.abs(p), white: p > 0 });
    }
    return list;
  };

  /* One scene per mount, rebuilt if the phone drops the 3D context. The
     board always uses the chess set's colours, map included. */
  const board = SET_BOARD;
  useEffect(() => {
    const scene = new TacticaScene(canvasRef.current, {
      flipped: side === -1,
      colors: {
        light: board.light, dark: board.dark, background: sweetheart ? "#FFF2F6" : "#1b1714",
        highlight: "#3EE7F5", target: "#F5D93E", attack: "#F05348", select: "#3EE7F5",
      },
      onTap: (sq) => tapRef.current(sq),
      onDoubleTap: (sq) => doubleTapRef.current(sq),
      onSwipe: (dir) => swipeRef.current(dir),
      onDragStart: (sq) => dragStartRef.current(sq),
      onDrop: (sq) => dropRef.current(sq),
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
    else if (draggingRef.current) { /* the drag steers the camera */ }
    else if (held && !(chosen != null && followChosenRef.current)) scene.showReach(selected);
    else scene.showCloseUp(selected, chosen);
    scene.setMarks(view === "close" && !solved ? { selected, held, targets, chosen, captures } : {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, selected, held, chosen, played, solved, sceneKey]);

  const playMove = async (move) => {
    const scene = sceneRef.current;
    const from = sqOf(mFrom(move)), to = sqOf(mTo(move));
    const captured = eng.pieceAt(to) !== EMPTY ? to : null;
    const knight = Math.abs(eng.pieceAt(from)) === KNIGHT;
    await scene.animateMove(from, to, { knight, captured });
    eng.make(move);
    await scene.setPieces(piecesNow());
  };

  /** Plays the move to `target`: the chosen square after Confirm, or the
   *  square a character was dropped on, which needs no Confirm. */
  const confirm = async (target = chosen) => {
    const move = movesFrom.find((m) => sqOf(mTo(m)) === target && (!mPromo(m) || mPromo(m) === QUEEN));
    if (!move || busy || playingRef.current) return;
    const verdict = judgePuzzleMove(eng, puzzle, played, move);
    if (!verdict.ok) {
      setMessage(`${verdict.san} isn't the answer. In the prototype the opponent will show why. Try again.`);
      setChosen(null);
      setHeld(false);
      sceneRef.current?.setPieces(piecesNow());
      return;
    }
    setBusy(true);
    playingRef.current = true;
    setChosen(null);
    setHeld(false);
    setMessage(null);
    try {
      await playMove(move);
      const afterMine = [...played, verdict.san];
      if (verdict.solved) {
        setPlayed(afterMine);
        setSolved(true);
        setMessage("Puzzle solved!");
        return;
      }
      await new Promise((r) => setTimeout(r, REPLY_DELAY_MS));
      const reply = eng.legalMoves().find((m) => eng.sanOf(m) === verdict.reply);
      if (reply) await playMove(reply);
      setMessage(`Opponent played ${verdict.reply}.`);
      setPlayed([...afterMine, verdict.reply]);
      /* The character that just moved stays selected for the next move. */
      const stillHere = friendlySquares(eng, side).indexOf(sqOf(mTo(move)));
      setSelectedIdx((i) => (stillHere >= 0 ? stillHere : Math.min(i, friendlySquares(eng, side).length - 1)));
    } finally {
      playingRef.current = false;
      setBusy(false);
    }
  };

  const restart = () => {
    eng.loadFen(puzzle.fen);
    setPlayed([]);
    setSolved(false);
    setChosen(null);
    setHeld(false);
    setSelectedIdx(0);
    setMessage(STUDY_HINT);
    sceneRef.current?.setPieces(piecesNow());
  };

  const cycleCharacter = (dir) => {
    if (busy) return;
    setChosen(null);
    setHeld(false);
    setSelectedIdx((i) => (i + dir + friends.length) % friends.length);
  };
  const cycleTarget = (dir) => {
    if (!canMove || !targets.length) return;
    setHeld(true);
    followChosenRef.current = true;
    const i = targets.indexOf(chosen);
    setChosen(targets[(i + dir + targets.length + (i < 0 && dir > 0 ? 1 : 0)) % targets.length]);
  };
  const tapRef = useRef(null);
  tapRef.current = (sq) => {
    if (busy) return;
    /* Tapping the chosen square again plays it, like a double-tap. */
    if (held && canMove && targets.includes(sq)) {
      if (sq === chosen) confirm(sq);
      else { followChosenRef.current = false; setChosen(sq); }
      return;
    }
    const friendIdx = friends.indexOf(sq);
    if (friendIdx >= 0) { setSelectedIdx(friendIdx); setHeld(false); setChosen(null); return; }
    if (held) { setHeld(false); setChosen(null); }
  };
  const pickUpRef = useRef(null);
  /* A double-tap on a glowing square plays it; on a character, picks it up. */
  const doubleTapRef = useRef(null);
  doubleTapRef.current = (sq) => {
    if (held && canMove && targets.includes(sq)) confirm(sq);
    else if (friends.includes(sq)) pickUpRef.current(sq);
    else tapRef.current(sq);
  };
  pickUpRef.current = (sq) => {
    const friendIdx = friends.indexOf(sq);
    if (busy || solved || friendIdx < 0) return;
    followChosenRef.current = false;
    setView("close");
    setSelectedIdx(friendIdx);
    setChosen(null);
    setHeld(true);
  };
  /* Dragging picks the character up; letting go over a square it can reach
     plays the move at once. Tapping a square still asks for Confirm. */
  const dragStartRef = useRef(null);
  dragStartRef.current = (sq) => {
    if (!canMove || !friends.includes(sq)) return false;
    draggingRef.current = true;
    pickUpRef.current(sq);
    return true;
  };
  const dropRef = useRef(null);
  dropRef.current = (sq) => {
    draggingRef.current = false;
    if (sq != null && targets.includes(sq)) { confirm(sq); return true; }
    /* Let go anywhere else and the character is put back down. */
    setHeld(false);
    setChosen(null);
    return false;
  };
  const swipeRef = useRef(null);
  swipeRef.current = cycleCharacter;

  const squareName = (sq) => `${"abcdefgh"[sq % 8]}${((sq / 8) | 0) + 1}`;
  const pieceName = (sq) => ["", "Pawn", "Knight", "Bishop", "Rook", "Queen", "King"][Math.abs(eng.pieceAt(sq))] + ` on ${squareName(sq)}`;
  const iconBtn = "flex size-10 shrink-0 items-center justify-center rounded-full border border-white/20 bg-black/45 text-lg text-white disabled:opacity-35";
  const isAttack = chosen != null && captures.includes(chosen);
  const toggleView = () => { if (!busy || played.length) setView((v) => (v === "board" ? "close" : "board")); };

  /* A phone-shaped column, even on a wide screen: the game is played upright. */
  return (
    <div className="relative mx-auto w-full max-w-[480px] overflow-hidden" style={{ height: "calc(100dvh - var(--headerH))" }}>
      <canvas key={sceneKey} ref={canvasRef} className="absolute inset-0 block size-full touch-none" />

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3">
        {message ? <p className="m-0 max-w-[60%] rounded-lg bg-black/55 px-3 py-2 text-sm text-white">{message}</p> : <span />}
        <button
          type="button"
          onClick={toggleView}
          aria-label={view === "board" ? "Back to the close view" : "Show the whole board"}
          className={"pointer-events-auto shrink-0 cursor-pointer rounded-lg border-2 bg-black/40 p-1 " + (view === "board" ? "border-[#3EE7F5]" : "border-white/30")}
        >
          <MiniBoard fen={eng.fen()} colors={board} pieceImgSrc={pieceImgSrc} size={96} flipped={side === -1} label="Map of the board" />
          <span className="mt-1 block text-center text-[10px] font-bold uppercase tracking-wide text-white">{view === "board" ? "Close view" : "Map"}</span>
        </button>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 bg-gradient-to-t from-black/70 to-transparent px-3 pt-6 pb-[calc(0.6rem+env(safe-area-inset-bottom))]">
        {solved ? (
          <button type="button" className="btn gold" onClick={restart}>Play it again</button>
        ) : (
          <div className="flex w-full items-center justify-between gap-2">
            <button type="button" className={iconBtn} onClick={() => cycleCharacter(-1)} disabled={busy} aria-label="Previous character">‹</button>
            <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
              <span className="truncate text-sm font-bold text-white">{selected != null ? pieceName(selected) : ""}</span>
              {view === "close" && (
                <div className="flex items-center gap-2">
                  <button type="button" className={iconBtn + " size-8 text-sm"} onClick={() => cycleTarget(-1)} disabled={!canMove || !targets.length} aria-label="Previous square">◀</button>
                  {chosen != null ? (
                    <>
                      <button type="button" className={"btn " + (isAttack ? "gold" : "")} onClick={() => confirm()}>{isAttack ? "Attack" : "Confirm"} {squareName(chosen)}</button>
                      <button type="button" className="border-0 bg-transparent text-xs text-white/75 underline" onClick={() => { setChosen(null); setHeld(false); }}>Cancel</button>
                    </>
                  ) : (
                    <span className="px-2 text-xs text-white/80">{busy ? "…" : !targets.length ? "This one can't move" : held ? "Drag or double-tap a glowing square" : "Drag a character, or double-tap it"}</span>
                  )}
                  <button type="button" className={iconBtn + " size-8 text-sm"} onClick={() => cycleTarget(1)} disabled={!canMove || !targets.length} aria-label="Next square">▶</button>
                </div>
              )}
            </div>
            <button type="button" className={iconBtn} onClick={() => cycleCharacter(1)} disabled={busy} aria-label="Next character">›</button>
          </div>
        )}
        <div className="flex items-center gap-3 text-[10px] text-white/55">
          {!solved && <button type="button" className="border-0 bg-transparent p-0 text-[10px] text-white/70 underline" onClick={restart}>Restart</button>}
          <span>Test build · {stats?.fps ? `${stats.fps} fps` : "measuring…"} · {stats?.pixelRatio ?? "-"}x</span>
        </div>
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
