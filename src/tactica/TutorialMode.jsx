import { useEffect, useRef, useState } from "react";
import { createEngine, mFrom, mPromo, mTo, M120TO64, EMPTY } from "../engine/chessEngine";
import { TacticaScene, SET_BOARD } from "./scene";
import { dressTrashBin } from "./sets/trashBin";
import { BrassButton, MapButton, MenuButton } from "./ui";
import { play as playSound } from "./sound";
import { loadBonds, levelsOf } from "./bonds";

/* Chess Tactica tutorial: the controls, one step at a time, on a practice
   board in the bin. No story (that comes with the opening cutscene, which
   will offer this tutorial or a skip). The enemy never moves here: after
   each of your moves it is simply your turn again, so you can try things
   freely. Each step finishes when you do what it says. */
const START_FEN = "6k1/8/1p3n2/3p4/8/2N2p2/PP3PPP/R2QKB1R w KQ - 0 1";
const KNIGHT = 2, QUEEN = 5, KING = 6;
const OPENING_PAUSE_MS = 900;

const STEPS = [
  { id: "look", title: "The whole board", text: "This is the whole board from above. Your characters are the light ones nearest you. Tap one of them to go up close." },
  { id: "select", title: "Where it can go", text: "The glowing squares are where this character can move. Tap one to see a ghost of the move." },
  { id: "play", title: "Play the move", text: "The ghost shows where it would stand. Tap that same square again to play it." },
  { id: "swipe", title: "Change character", text: "Swipe left or right on the board, or use the ‹ › buttons, to switch to another of your characters." },
  { id: "drag", title: "Drag to move", text: "You can also drag a character straight onto a glowing square. It plays at once. Try it." },
  { id: "capture", title: "Attack", text: "A red square holds an enemy you can attack. Take one and watch your character's attack." },
  { id: "turn", title: "Turn the view", text: "Drag sideways across the map in the top corner to turn the view around your character." },
  { id: "map", title: "Back to the map", text: "Tap the map to see the whole board again. Tap a character to go back in close." },
  { id: "done", title: "You're ready", text: "That's every control. Puzzles in Bin Run and Blitz are played exactly like this." },
];

const sqOf = (sq120) => M120TO64[sq120];

/** The player's characters, left to right from their side, front row first,
 *  so swiping moves across the board predictably. */
function friendlySquares(eng) {
  const squares = [];
  for (let sq = 0; sq < 64; sq++) if (eng.pieceAt(sq) > 0) squares.push(sq);
  return squares.sort((a, b) => ((b / 8) | 0) - ((a / 8) | 0) || (a % 8) - (b % 8));
}


export default function TutorialMode({ pieceImgSrc, sweetheart, onExit }) {
  const engRef = useRef(null);
  if (!engRef.current) { engRef.current = createEngine(); engRef.current.loadFen(START_FEN); }
  const eng = engRef.current;

  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const [sceneKey, setSceneKey] = useState(0);
  const [lost, setLost] = useState(false);
  const [view, setView] = useState("board");
  const [moves, setMoves] = useState(0);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [chosen, setChosen] = useState(null);
  const [dragging, setDragging] = useState(false);
  const playingRef = useRef(false);
  const [busy, setBusy] = useState(true);
  const [step, setStep] = useState(0);
  /* After the last step: free play on the same board. */
  const [practising, setPractising] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [turn, setTurn] = useState(0);
  /* The tutorial plays the full attacks. */
  const pace = "full";

  const current = STEPS[step];
  /** Finishes the step `id` if it is the current one. */
  const complete = (id) => setStep((s) => (STEPS[s].id === id ? s + 1 : s));
  /* A chime for every step done. */
  useEffect(() => { if (step > 0) playSound("chime", { volume: 0.7 }); }, [step]);

  const friends = friendlySquares(eng);
  const selected = friends[Math.min(selectedIdx, friends.length - 1)];
  /* Kings can't be taken, even though the enemy never gets to move. */
  const movesFrom = eng.legalMoves().filter((m) => sqOf(mFrom(m)) === selected && Math.abs(eng.pieceAt(sqOf(mTo(m)))) !== KING);
  const targets = [...new Set(movesFrom.map((m) => sqOf(mTo(m))))];
  const captures = targets.filter((sq) => eng.pieceAt(sq) !== EMPTY);
  const canMove = view === "close" && !busy;
  const enemiesLeft = (() => { let n = 0; for (let sq = 0; sq < 64; sq++) { const p = eng.pieceAt(sq); if (p < 0 && p !== -KING) n++; } return n; })();

  const piecesNow = () => {
    const list = [];
    for (let sq = 0; sq < 64; sq++) {
      const p = eng.pieceAt(sq);
      if (p !== EMPTY) list.push({ sq, type: Math.abs(p), white: p > 0 });
    }
    return list;
  };

  useEffect(() => {
    const scene = new TacticaScene(canvasRef.current, {
      flipped: false,
      colors: {
        light: SET_BOARD.light, dark: SET_BOARD.dark, background: sweetheart ? "#FFF2F6" : "#1b1714",
        highlight: "#3EE7F5", target: "#F5D93E", attack: "#F05348", select: "#3EE7F5",
      },
      onTap: (sq) => tapRef.current(sq),
      onDoubleTap: (sq) => doubleTapRef.current(sq),
      onSwipe: (dir) => swipeRef.current(dir),
      onDragStart: (sq) => dragStartRef.current(sq),
      onDrop: (sq) => dropRef.current(sq),
      onLost: () => setLost(true),
      onTurn: setTurn,
    });
    sceneRef.current = scene;
    scene.setBonds(levelsOf(loadBonds()));
    scene.setPieces(piecesNow());
    const bin = dressTrashBin(scene);
    scene.everyFrame.push((dt) => bin.update(dt));
    const opening = setTimeout(() => setBusy(false), sceneKey ? 0 : OPENING_PAUSE_MS);
    return () => { clearTimeout(opening); scene.dispose(); sceneRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneKey]);

  /* The camera moves only for a new view, a new character, or after a move. */
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || dragging || playingRef.current) return;
    if (view === "board") scene.showBoard();
    else scene.showReach(selected, targets);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, selected, moves, sceneKey, dragging]);
  useEffect(() => {
    const show = view === "close" && !busy;
    sceneRef.current?.setMarks(show ? { selected, held: true, ghost: dragging, targets, chosen, captures, confirm: true } : {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, selected, chosen, dragging, moves, busy, sceneKey]);

  /* Steps finished by looking around. (`complete` only reads state through
     its updater, so it is safe to leave out of the dependencies.) */
  useEffect(() => { if (view === "close") complete("look"); if (view === "board") complete("map"); }, [view]);
  useEffect(() => { if (chosen != null) complete("select"); }, [chosen]);

  /** Plays a move, then hands the turn straight back: the enemy never moves. */
  const play = async (target, how) => {
    const move = movesFrom.find((m) => sqOf(mTo(m)) === target && (!mPromo(m) || mPromo(m) === QUEEN));
    if (!move || busy || playingRef.current) return;
    const scene = sceneRef.current;
    const from = sqOf(mFrom(move));
    const captured = eng.pieceAt(target) !== EMPTY ? target : null;
    setChosen(null);
    setBusy(true);
    playingRef.current = true;
    try {
      await scene.animateMove(from, target, { knight: Math.abs(eng.pieceAt(from)) === KNIGHT, captured, pace });
      eng.make(move);
      const parts = eng.fen().split(" ");
      parts[1] = "w";
      parts[3] = "-";
      eng.loadFen(parts.join(" "));
      scene.syncPieces(piecesNow());
      setMoves((n) => n + 1);
      const stillHere = friendlySquares(eng).indexOf(target);
      if (stillHere >= 0) setSelectedIdx(stillHere);
      if (how === "tap") complete("play");
      if (how === "drag") complete("drag");
      if (captured != null) complete("capture");
    } finally {
      playingRef.current = false;
      setBusy(false);
    }
  };

  const restart = () => {
    /* Not while a move is playing: it would land on the fresh board. */
    if (playingRef.current) return;
    eng.loadFen(START_FEN);
    setMoves((n) => n + 1);
    setChosen(null);
    setSelectedIdx(0);
    setMenuOpen(false);
    sceneRef.current?.syncPieces(piecesNow());
  };
  const startOver = () => { if (playingRef.current) return; restart(); setStep(0); setPractising(false); setView("board"); };

  const cycleCharacter = (dir) => {
    if (busy) return;
    setChosen(null);
    setSelectedIdx((i) => (i + dir + friends.length) % friends.length);
    if (view === "close") complete("swipe");
    /* From the whole board, switching goes in close on the next one. */
    setView("close");
  };
  const tapRef = useRef(null);
  tapRef.current = (sq) => {
    if (busy) return;
    if (canMove && targets.includes(sq)) {
      if (sq === chosen) play(sq, "tap");
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
  const doubleTapRef = useRef(null);
  doubleTapRef.current = (sq) => {
    if (canMove && targets.includes(sq)) play(sq, "tap");
    else tapRef.current(sq);
  };
  const dragStartRef = useRef(null);
  dragStartRef.current = (sq) => {
    const friendIdx = friends.indexOf(sq);
    if (!canMove || friendIdx < 0) return false;
    setDragging(true);
    setSelectedIdx(friendIdx);
    setChosen(null);
    return true;
  };
  const dropRef = useRef(null);
  dropRef.current = (sq) => {
    setDragging(false);
    if (sq != null && targets.includes(sq) && !busy && !playingRef.current) { play(sq, "drag"); return true; }
    return false;
  };
  const swipeRef = useRef(null);
  swipeRef.current = cycleCharacter;

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e) => { if (e.key === "Escape") setMenuOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const squareName = (sq) => `${"abcdefgh"[sq % 8]}${((sq / 8) | 0) + 1}`;
  const pieceName = (sq) => ["", "Pawn", "Knight", "Bishop", "Rook", "Queen", "King"][Math.abs(eng.pieceAt(sq))] + ` on ${squareName(sq)}`;
  const isAttack = chosen != null && captures.includes(chosen);
  const hint = busy ? "…"
    : view === "board" ? "Tap a character to take a closer look"
    : !targets.length ? "This one can't move"
    : chosen != null ? (isAttack ? `Tap ${squareName(chosen)} again to strike` : `Tap ${squareName(chosen)} again to move`)
    : "Tap a glowing square, or drag there";
  const toggleView = () => { if (!busy) setView((v) => (v === "board" ? "close" : "board")); };
  /* Only a turn the player makes with the map counts for the step; the
     camera also turns itself. */
  const turnedRef = useRef(0);
  const spin = (angle) => {
    sceneRef.current?.spinBy(angle);
    turnedRef.current += Math.abs(angle);
    if (turnedRef.current > 0.25) complete("turn");
  };
  const finished = current.id === "done" && !practising;
  const highlightMap = current.id === "turn" || current.id === "map";

  return (
    <div className="relative mx-auto w-full max-w-[480px] overflow-hidden" style={{ height: "calc(100dvh - var(--headerH))" }}>
      <canvas key={sceneKey} ref={canvasRef} className="absolute inset-0 block size-full touch-none" />

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3">
        <MenuButton open={menuOpen} onClick={() => setMenuOpen((o) => !o)} />
        {current.id !== "done" && (
          <div role="status" aria-live="polite" data-tactica-hud className="tc-panel pointer-events-auto m-0 max-w-[60%] px-3 py-2.5">
            <p className="tc-label m-0">Step {step + 1} of {STEPS.length - 1} · {current.title}</p>
            <p className="m-0 mt-1 text-[15px] leading-snug">{current.text}</p>
            {current.id === "capture" && enemiesLeft === 0 && (
              <button type="button" className="tc-link mt-1 p-0 text-sm" onClick={restart}>No enemies left: reset the board</button>
            )}
          </div>
        )}
        <div className={highlightMap ? "rounded-xl shadow-[0_0_0_3px_var(--tc-gold-hi),0_0_18px_rgba(255,200,100,0.6)]" : ""}>
          <MapButton
            fen={eng.fen()}
            pieceImgSrc={pieceImgSrc}
            size={88}
            flipped={false}
            view={view}
            turn={turn}
            onToggle={toggleView}
            onSpin={spin}
          />
        </div>
      </div>

      {menuOpen && (
        <>
          <button type="button" aria-label="Close the menu" className="absolute inset-0 cursor-default border-0 bg-transparent" onClick={() => setMenuOpen(false)} />
          <div className="tc-panel absolute top-16 left-3 flex w-60 flex-col gap-3 p-3">
            <button type="button" className="tc-plank tc-center tc-small" onClick={restart} disabled={busy}>Reset the board</button>
            <button type="button" className="tc-plank tc-center tc-small" onClick={startOver} disabled={busy}>Start the tutorial over</button>
            <button type="button" className="tc-plank tc-center tc-small" onClick={onExit}>Back to the menu</button>
          </div>
        </>
      )}

      {finished && (
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 bg-gradient-to-t from-black/90 via-black/70 to-transparent px-5 pt-20 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-center">
          <h2 className="tc-title m-0 text-[28px]">{current.title}</h2>
          <p className="m-0 max-w-[32ch] text-base text-[var(--tc-cream-dim)]">{current.text}</p>
          <BrassButton onClick={onExit}>Back to the menu</BrassButton>
          <button type="button" className="tc-link" onClick={() => setPractising(true)}>Keep practising here</button>
        </div>
      )}

      {!finished && (
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/80 to-transparent px-3 pt-10 pb-[calc(0.9rem+env(safe-area-inset-bottom))]">
          <button type="button" className="tc-round" onClick={() => cycleCharacter(-1)} disabled={busy} aria-label="Previous character">‹</button>
          <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5 text-center">
            <span className="tc-display truncate text-[15px]">{selected != null && view === "close" ? pieceName(selected) : ""}</span>
            <span className={"truncate text-sm " + (isAttack ? "font-bold text-[var(--tc-gold-hi)]" : "text-[var(--tc-cream-dim)]")}>{hint}</span>
          </div>
          <button type="button" className="tc-round" onClick={() => cycleCharacter(1)} disabled={busy} aria-label="Next character">›</button>
        </div>
      )}

      {lost && (
        <div className="tc-scrim absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
          <p className="m-0 text-base">The 3D view was reset by the phone.</p>
          <BrassButton onClick={() => { setLost(false); setSceneKey((k) => k + 1); }}>Restore it</BrassButton>
        </div>
      )}
    </div>
  );
}
