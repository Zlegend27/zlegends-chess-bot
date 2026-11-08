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
   wrong moves, story and character names.

   One way to play: tap a character and the squares it can reach glow; tap a
   glowing square to see a ghost of the move; tap it again to play it.
   Dragging a character onto a glowing square plays it at once. */
const TEST_PUZZLE_ID = "00IEW";
const KNIGHT = 2, QUEEN = 5;
const REPLY_DELAY_MS = 550;
const OPENING_PAUSE_MS = 1100;
const NOTE_MS = 3200;
const STUDY_HINT = "Drag the board to look around. Pinch to zoom.";

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

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cyan)]";

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
  /* The square being previewed; tapping it again plays it. */
  const [chosen, setChosen] = useState(null);
  /* While a finger drags a character the camera is the scene's to move, and
     the character turns see-through so the squares under it show. */
  const draggingRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const playingRef = useRef(false);
  const [busy, setBusy] = useState(true);
  /* A short note at the top that fades, unless it is the result. */
  const [note, setNote] = useState({ text: STUDY_HINT, sticky: false, id: 0 });
  const [solved, setSolved] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [stats, setStats] = useState(null);
  /* Whether the camera has been turned, tilted or zoomed by the player. */
  const [turned, setTurned] = useState(false);

  const friends = friendlySquares(eng, side);
  const selected = friends[Math.min(selectedIdx, friends.length - 1)];
  const movesFrom = eng.legalMoves().filter((m) => sqOf(mFrom(m)) === selected);
  const targets = [...new Set(movesFrom.map((m) => sqOf(mTo(m))))];
  const captures = targets.filter((sq) => eng.pieceAt(sq) !== EMPTY);
  const canMove = view === "close" && !busy && !solved;

  const say = (text, sticky = false) => setNote((n) => ({ text, sticky, id: n.id + 1 }));
  useEffect(() => {
    if (!note.text || note.sticky) return;
    const t = setTimeout(() => setNote((n) => (n.id === note.id ? { ...n, text: null } : n)), NOTE_MS);
    return () => clearTimeout(t);
  }, [note]);

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
      onDragStart: (sq) => dragStartRef.current(sq),
      onDrop: (sq) => dropRef.current(sq),
      onLost: () => setLost(true),
      onTurned: setTurned,
    });
    sceneRef.current = scene;
    scene.setPieces(piecesNow());
    const opening = setTimeout(() => { setView("close"); setBusy(false); }, sceneKey ? 0 : OPENING_PAUSE_MS);
    const readout = setInterval(() => setStats(scene.stats()), 1000);
    return () => { clearTimeout(opening); clearInterval(readout); scene.dispose(); sceneRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneKey]);

  /* The camera moves only for a new view, a new character, and after each
     turn; choosing a square never moves it. `played`, `solved` and
     `sceneKey` bring it back to the character after each turn, at the end
     and after a reset. */
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || draggingRef.current) return;
    if (view === "board") scene.showBoard();
    else scene.showReach(selected);
  }, [view, selected, played, solved, sceneKey]);
  /* Highlights: the selected character's squares glow, and a chosen square
     shows a ghost of the move. */
  useEffect(() => {
    const show = view === "close" && !solved && !busy;
    sceneRef.current?.setMarks(show ? { selected, held: true, ghost: dragging, targets, chosen, captures } : {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, selected, chosen, dragging, played, solved, busy, sceneKey]);

  /** Animates a move, then plays it. The pieces stay where they are; only
   *  what changed is fixed up (castling, en passant, promotion). The
   *  opponent's moves are followed by the camera. */
  const playMove = async (move, { follow = false } = {}) => {
    const scene = sceneRef.current;
    const from = sqOf(mFrom(move)), to = sqOf(mTo(move));
    const captured = eng.pieceAt(to) !== EMPTY ? to : null;
    const knight = Math.abs(eng.pieceAt(from)) === KNIGHT;
    await scene.animateMove(from, to, { knight, captured, follow });
    eng.make(move);
    scene.syncPieces(piecesNow());
  };

  /** Plays the move to `target`: a previewed square tapped again, or the
   *  square a character was dropped on. */
  const play = async (target) => {
    const move = movesFrom.find((m) => sqOf(mTo(m)) === target && (!mPromo(m) || mPromo(m) === QUEEN));
    if (!move || busy || playingRef.current) return;
    const verdict = judgePuzzleMove(eng, puzzle, played, move);
    setChosen(null);
    if (!verdict.ok) {
      say(`${verdict.san} isn't the answer. In the prototype the opponent will show why. Try again.`);
      sceneRef.current?.syncPieces(piecesNow());
      return;
    }
    setBusy(true);
    playingRef.current = true;
    setNote((n) => ({ ...n, text: null }));
    try {
      await playMove(move);
      const afterMine = [...played, verdict.san];
      if (verdict.solved) {
        setPlayed(afterMine);
        setSolved(true);
        say("Puzzle solved!", true);
        return;
      }
      await new Promise((r) => setTimeout(r, REPLY_DELAY_MS));
      const reply = eng.legalMoves().find((m) => eng.sanOf(m) === verdict.reply);
      if (reply) await playMove(reply, { follow: true });
      say(`Opponent played ${verdict.reply}.`);
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
    setSelectedIdx(0);
    setMenuOpen(false);
    say(STUDY_HINT);
    sceneRef.current?.syncPieces(piecesNow());
  };

  const cycleCharacter = (dir) => {
    if (busy) return;
    setChosen(null);
    setSelectedIdx((i) => (i + dir + friends.length) % friends.length);
  };
  /* Tap a character to select it; tap a glowing square to preview the move,
     and again to play it; tap anywhere else to cancel the preview. On the
     whole-board view, tapping a character opens its close view. */
  const tapRef = useRef(null);
  tapRef.current = (sq) => {
    if (busy || solved) return;
    if (canMove && targets.includes(sq)) {
      if (sq === chosen) play(sq);
      else setChosen(sq);
      return;
    }
    const friendIdx = friends.indexOf(sq);
    if (friendIdx >= 0) {
      setSelectedIdx(friendIdx);
      setChosen(null);
      setView("close");
      return;
    }
    setChosen(null);
  };
  /* A quick double-tap on a glowing square is the same as two taps. */
  const doubleTapRef = useRef(null);
  doubleTapRef.current = (sq) => {
    if (canMove && targets.includes(sq)) play(sq);
    else tapRef.current(sq);
  };
  /* Dragging selects the character; letting go over a glowing square plays
     the move at once, anywhere else puts it back. */
  const dragStartRef = useRef(null);
  dragStartRef.current = (sq) => {
    const friendIdx = friends.indexOf(sq);
    if (!canMove || friendIdx < 0) return false;
    draggingRef.current = true;
    setDragging(true);
    setSelectedIdx(friendIdx);
    setChosen(null);
    return true;
  };
  const dropRef = useRef(null);
  dropRef.current = (sq) => {
    draggingRef.current = false;
    setDragging(false);
    if (sq != null && targets.includes(sq)) { play(sq); return true; }
    return false;
  };

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e) => { if (e.key === "Escape") setMenuOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const squareName = (sq) => `${"abcdefgh"[sq % 8]}${((sq / 8) | 0) + 1}`;
  const pieceName = (sq) => ["", "Pawn", "Knight", "Bishop", "Rook", "Queen", "King"][Math.abs(eng.pieceAt(sq))] + ` on ${squareName(sq)}`;
  const iconBtn = "flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/20 bg-black/45 text-lg text-white disabled:opacity-35 " + focusRing;
  const isAttack = chosen != null && captures.includes(chosen);
  const hint = busy ? "…"
    : view === "board" ? "Tap a character to take a closer look"
    : !targets.length ? "This one can't move"
    : chosen != null ? (isAttack ? `Tap ${squareName(chosen)} again to strike` : `Tap ${squareName(chosen)} again to move`)
    : "Tap a glowing square, or drag there";
  const toggleView = () => { if (!busy || played.length) setView((v) => (v === "board" ? "close" : "board")); };

  /* A phone-shaped column, even on a wide screen: the game is played upright. */
  return (
    <div className="relative mx-auto w-full max-w-[480px] overflow-hidden" style={{ height: "calc(100dvh - var(--headerH))" }}>
      <canvas key={sceneKey} ref={canvasRef} className="absolute inset-0 block size-full touch-none" />

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3">
        <div className="flex shrink-0 flex-col gap-2">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Game menu"
            aria-expanded={menuOpen}
            className={"pointer-events-auto flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/20 bg-black/45 text-white " + focusRing}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M5 10a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm7 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm7 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z" /></svg>
          </button>
          {turned && (
            <button
              type="button"
              onClick={() => sceneRef.current?.resetTurn()}
              aria-label="Face the board from your side again"
              title="Face the board from your side again"
              className={"pointer-events-auto flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[var(--cyan)] bg-black/45 text-[var(--cyan)] " + focusRing}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm0 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm0 2 3 7h-6l3-7Zm-3 8h6l-3 4-3-4Z" /></svg>
            </button>
          )}
        </div>
        {note.text && (
          <p key={note.id} role="status" className={"tacticaNote " + (note.sticky ? "" : "fades ") + "m-0 max-w-[60%] rounded-lg bg-black/55 px-3 py-2 text-center text-sm text-white"}>{note.text}</p>
        )}
        <button
          type="button"
          onClick={toggleView}
          aria-label={view === "board" ? "Back to the close view" : "Show the whole board"}
          aria-pressed={view === "board"}
          className={"pointer-events-auto shrink-0 cursor-pointer rounded-lg border-2 bg-black/40 p-1 " + (view === "board" ? "border-[var(--cyan)] " : "border-white/30 ") + focusRing}
        >
          <MiniBoard fen={eng.fen()} colors={board} pieceImgSrc={pieceImgSrc} size={80} flipped={side === -1} label="Map of the board" />
        </button>
      </div>

      {menuOpen && (
        <>
          <button type="button" aria-label="Close the menu" className="absolute inset-0 cursor-default border-0 bg-transparent" onClick={() => setMenuOpen(false)} />
          <div className="absolute top-14 left-3 flex flex-col gap-2 rounded-xl border border-white/15 bg-black/80 p-3 text-white backdrop-blur-sm">
            {!solved && <button type="button" className={"btn ghost " + focusRing} onClick={restart}>Restart</button>}
            <span className="text-[10px] text-white/60">Test build · {stats?.fps ? `${stats.fps} fps` : "measuring…"} · {stats?.pixelRatio ?? "-"}x</span>
          </div>
        </>
      )}

      <div className="absolute inset-x-0 bottom-0 flex items-center justify-center bg-gradient-to-t from-black/70 to-transparent px-3 pt-8 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {solved ? (
          <button type="button" className={"btn gold " + focusRing} onClick={restart}>Play it again</button>
        ) : (
          <div className="flex w-full items-center justify-between gap-2">
            <button type="button" className={iconBtn} onClick={() => cycleCharacter(-1)} disabled={busy} aria-label="Previous character">‹</button>
            <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5 text-center">
              <span className="truncate text-sm font-bold text-white">{selected != null ? pieceName(selected) : ""}</span>
              <span className={"truncate text-xs " + (isAttack ? "font-bold text-[var(--yellow)]" : "text-white/75")} aria-live="polite">{hint}</span>
            </div>
            <button type="button" className={iconBtn} onClick={() => cycleCharacter(1)} disabled={busy} aria-label="Next character">›</button>
          </div>
        )}
      </div>

      {lost && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 p-6 text-center text-white">
          <p className="m-0">The 3D view was reset by the phone.</p>
          <button type="button" className={"btn gold " + focusRing} onClick={() => { setLost(false); setSceneKey((k) => k + 1); }}>Restore it</button>
        </div>
      )}
    </div>
  );
}
