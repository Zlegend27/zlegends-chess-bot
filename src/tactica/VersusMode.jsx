import { useEffect, useRef, useState } from "react";
import { createEngine, mFrom, mPromo, mTo, M120TO64, EMPTY } from "../engine/chessEngine";
import { replayIntoEngine } from "../utils/share";
import { moveBySan } from "../utils/chessMoves";
import { TIME_CONTROLS, timeControl, clockText } from "../utils/lobby";
import PlayerSprite from "../components/PlayerSprite";
import { useLobby, useLobbyMe } from "../pvp/useLobby";
import { usePvpMatch } from "../pvp/usePvpMatch";
import { TacticaScene, SET_BOARD } from "./scene";
import { dressTrashBin } from "./sets/trashBin";
import { BrassButton, MapButton, MenuButton, useViewSource } from "./ui";
import { play as playSound } from "./sound";
import { loadBonds, levelsOf } from "./bonds";
import { friendlySquares } from "./BotMode";

/* 1v1 in the bin: a game against another person on the 3D board.

   Tactica has its own lobby room, so Tactica players only meet each other.
   The game itself (moves over Realtime, clocks, draws, results, rejoining
   after a refresh) is the same as the site's 1v1 (usePvpMatch). The board
   on screen plays every move out as the usual attack scenes, yours and
   theirs, one after another, so it can lag the game a moment while a
   scene finishes; you can move again once it has caught up. Casual, not
   rated; promotions become a queen. Your clock starts only once their
   move has played out on your board. */
const KNIGHT = 2, QUEEN = 5;
const sqOf = (sq120) => M120TO64[sq120];
/* Your clock starts once their move has played out on your board, so the
   other side waits this long past zero before it can claim a win on time. */
const FLAG_GRACE_MS = 10_000;
const LOBBY = { room: "tactica-lobby-v1", activeKey: "tacticaPvpActive", tcKey: "tacticaPvpTc", matchPrefix: "tc-" };

export default function VersusMode({ session, profile, displayName, avatar, onSignIn, sweetheart, pieceImgSrc, onExit }) {
  const { me, signedIn } = useLobbyMe({ session, profile, displayName, avatar });
  const lobby = useLobby({ me, ...LOBBY });

  if (!me) {
    return (
      <Screen>
        <h2 className="tc-title m-0 text-center text-[28px]">1v1</h2>
        <p className="m-0 text-center text-base text-[var(--tc-cream-dim)]">Play a real person in the bin. Log in with Discord to join; your name and look come from your profile.</p>
        <BrassButton className="self-center" onClick={onSignIn}>Log in with Discord</BrassButton>
        <button type="button" className="tc-link self-center" onClick={onExit}>Back to the menu</button>
      </Screen>
    );
  }
  if (lobby.match && lobby.supabase) {
    return (
      <VersusGame
        supabase={lobby.supabase} me={me} match={lobby.match} signedIn={signedIn}
        sweetheart={sweetheart} pieceImgSrc={pieceImgSrc} onLeave={lobby.leaveMatch}
      />
    );
  }
  return <Lobby me={me} lobby={lobby} onExit={onExit} />;
}

function Screen({ children }) {
  return (
    <div className="relative mx-auto w-full max-w-[480px] overflow-hidden bg-[#060507]" style={{ height: "calc(100dvh - var(--headerH))" }}>
      <div className="tc-scrim absolute inset-0 flex flex-col justify-center gap-4 overflow-y-auto p-5">{children}</div>
    </div>
  );
}

/* ---------------- The lobby ---------------- */

function Lobby({ me, lobby, onExit }) {
  const { connected, players, tables, seat, tcId, setTcId, note, standing, sit, standUp } = lobby;
  return (
    <Screen>
      <div className="text-center">
        <h2 className="tc-title m-0 text-[28px]">1v1</h2>
        <p className="m-0 mt-1 text-base text-[var(--tc-cream-dim)]">Sit at a table. When both seats are taken, the game starts. Casual, not rated.</p>
        <p className="tc-label m-0 mt-2">{connected ? `${players.length} in the bin` : "Connecting…"}</p>
      </div>

      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="tc-label mb-2">Clock for a table you open</legend>
        <div className="grid grid-cols-2 gap-2">
          {TIME_CONTROLS.map((t) => (
            <button key={t.id} type="button" aria-pressed={tcId === t.id} disabled={!!seat} className="tc-plank tc-small tc-center" onClick={() => setTcId(t.id)}>{t.label}</button>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-2.5">
        {tables.map((table) => {
          const busy = table.seats.some((p) => p?.playing);
          return (
            <div key={table.id} className="tc-panel flex flex-col items-center gap-2 p-2.5">
              <div className="tc-label flex w-full items-baseline justify-between">
                <span>Table {table.id + 1}</span>
                <span>{busy ? "Playing" : table.tc ? timeControl(table.tc).label : ""}</span>
              </div>
              <div className="flex w-full items-end justify-around">
                {[0, 1].map((side) => {
                  const p = table.seats[side];
                  const mine = p?.id === me.id;
                  return (
                    <div key={side} className="flex w-1/2 flex-col items-center gap-1">
                      {p ? (
                        <>
                          <PlayerSprite avatar={p.avatar} discordUrl={p.discordUrl} size={40} />
                          <span className={"max-w-full truncate text-xs " + (mine ? "text-[var(--tc-gold-hi)]" : "text-[var(--tc-cream)]")}>{mine ? "You" : p.name}</span>
                        </>
                      ) : (
                        <button type="button" className="tc-plank tc-small tc-center" style={{ minHeight: 34, padding: "4px 10px", fontSize: 12 }}
                          disabled={!connected || !!seat} onClick={() => sit(table.id, side)}>
                          Sit
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              {table.seats.some((p) => p?.id === me.id) && !busy && (
                <button type="button" className="tc-link" style={{ fontSize: 12, padding: 2 }} onClick={standUp}>Stand up</button>
              )}
            </div>
          );
        })}
      </div>

      {standing.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="tc-label">Standing around</span>
          <div className="flex flex-wrap gap-3">
            {standing.map((p) => (
              <div key={p.id} className="flex w-14 flex-col items-center gap-1">
                <PlayerSprite avatar={p.avatar} discordUrl={p.discordUrl} size={36} />
                <span className="max-w-full truncate text-[11px] text-[var(--tc-cream-dim)]">{p.id === me.id ? "You" : p.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {note && <p className="m-0 text-center text-sm text-[var(--tc-gold-hi)]" role="status">{note}</p>}
      <button type="button" className="tc-link self-center" onClick={onExit}>Back to the menu</button>
    </Screen>
  );
}

/* ---------------- The game ---------------- */

function VersusGame({ supabase, me, match, signedIn, sweetheart, pieceImgSrc, onLeave }) {
  const game = usePvpMatch({ supabase, me, match, signedIn, storeKey: "tacticaPvpMatch", label: "Tactica 1v1", clockFromShown: true, flagGraceMs: FLAG_GRACE_MS });
  const { moves, result, myColor, opponent, timeLeft, sideToMove, drawOffer, oppGoneLong, canAbort } = game;

  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  /* The board as shown: it plays the game's moves out one at a time, so it
     can be a move or two behind the game while a scene finishes. */
  const shownRef = useRef(null);
  if (!shownRef.current) { shownRef.current = createEngine(); replayIntoEngine(shownRef.current, moves); }
  const shown = shownRef.current;
  const [shownPly, setShownPly] = useState(moves.length);
  const animatingRef = useRef(false);
  const aliveRef = useRef(true);

  const [dragging, setDragging] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [chosen, setChosen] = useState(null);
  const [view, setView] = useState("board");
  const [menuOpen, setMenuOpen] = useState(false);
  const viewSource = useViewSource();

  const caughtUp = shownPly === moves.length;
  const busy = !caughtUp;
  const myTurn = game.myTurn && caughtUp;
  const friends = friendlySquares(shown, myColor);
  const selected = friends[Math.min(selectedIdx, friends.length - 1)];
  const legal = myTurn ? shown.legalMoves() : [];
  const movesFrom = legal.filter((m) => sqOf(mFrom(m)) === selected);
  const targets = [...new Set(movesFrom.map((m) => sqOf(mTo(m))))];
  const captures = targets.filter((sq) => shown.pieceAt(sq) !== EMPTY);
  const canMove = myTurn && view === "close" && !busy;

  const piecesNow = () => {
    const list = [];
    for (let sq = 0; sq < 64; sq++) {
      const p = shown.pieceAt(sq);
      if (p !== EMPTY) list.push({ sq, type: Math.abs(p), white: p > 0 });
    }
    return list;
  };

  /* ---- The scene ---- */
  useEffect(() => {
    aliveRef.current = true;
    const scene = new TacticaScene(canvasRef.current, {
      flipped: myColor === -1,
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
    scene.setBonds(levelsOf(loadBonds()));
    const bin = dressTrashBin(scene);
    scene.everyFrame.push((dt) => bin.update(dt));
    scene.setFlipped(myColor === -1);
    scene.setPieces(piecesNow());
    scene.showBoard();
    return () => { aliveRef.current = false; scene.dispose(); sceneRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sweetheart]);

  /* ---- Playing the game's moves out on the board ---- */
  useEffect(() => {
    if (animatingRef.current) return;
    const list = moves;
    /* A resync that rewrote the game (it shouldn't, but never trust the
       network): put the board straight to it. */
    const ok = shownPly <= list.length && (() => {
      const probe = createEngine();
      replayIntoEngine(probe, list.slice(0, shownPly));
      return probe.fen() === shown.fen();
    })();
    if (!ok) {
      shown.reset();
      replayIntoEngine(shown, list);
      sceneRef.current?.setPieces(piecesNow());
      setShownPly(list.length);
      return;
    }
    if (shownPly >= list.length) return;
    const move = moveBySan(shown, list[shownPly]);
    if (move === undefined) { shown.reset(); replayIntoEngine(shown, list); sceneRef.current?.setPieces(piecesNow()); setShownPly(list.length); return; }
    const theirs = Math.sign(shown.pieceAt(sqOf(mFrom(move)))) !== myColor;
    animatingRef.current = true;
    sceneRef.current?.setMarks({});
    (async () => {
      const from = sqOf(mFrom(move)), to = sqOf(mTo(move));
      const captured = shown.pieceAt(to) !== EMPTY ? to : null;
      const knight = Math.abs(shown.pieceAt(from)) === KNIGHT;
      try {
        /* Their moves fly the camera along; yours stay where you are. */
        await sceneRef.current?.animateMove(from, to, { knight, captured, follow: theirs, pace: "full" });
      } finally {
        animatingRef.current = false;
      }
      if (!aliveRef.current) return;
      shown.make(move);
      sceneRef.current?.syncPieces(piecesNow());
      if (shown.inCheckNow()) playSound("metal", { volume: 0.7, delay: 0.1 });
      const stillHere = friendlySquares(shown, myColor).indexOf(to);
      if (!theirs) setSelectedIdx((i) => (stillHere >= 0 ? stillHere : Math.min(i, friendlySquares(shown, myColor).length - 1)));
      setShownPly((n) => n + 1);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moves, shownPly]);

  /* My clock starts once their move is on the board. */
  useEffect(() => { if (caughtUp) game.shown(); });

  /* The end of the game, once the board has caught up with it. */
  const over = !!result && caughtUp;
  const overSound = useRef(false);
  useEffect(() => {
    if (!over || overSound.current) return;
    overSound.current = true;
    sceneRef.current?.setMarks({});
    playSound(result.winner === myColor ? "confirm" : result.winner ? "error" : "chime", { volume: 0.8 });
  }, [over, result, myColor]);

  /* ---- Camera and highlights ---- */
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || dragging || busy) return;
    if (view === "board" || over) scene.showBoard();
    else scene.showReach(selected, targets);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, selected, shownPly, busy, dragging, over]);
  useEffect(() => {
    const show = myTurn && view === "close" && !busy && !over;
    sceneRef.current?.setMarks(show ? { selected, held: true, ghost: dragging, targets, chosen, captures, confirm: true } : {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, selected, chosen, shownPly, myTurn, busy, dragging, over]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e) => { if (e.key === "Escape") setMenuOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  /* ---- Input ---- */
  const play = (target) => {
    if (!canMove) return;
    const move = movesFrom.find((m) => sqOf(mTo(m)) === target && (!mPromo(m) || mPromo(m) === QUEEN));
    if (!move) return;
    setChosen(null);
    game.submit(shown.sanOf(move));
  };
  const cycle = (dir) => {
    if (busy || over || !friends.length) return;
    setChosen(null);
    setSelectedIdx((i) => (i + dir + friends.length) % friends.length);
    setView("close");
  };
  const cycleRef = useRef(null);
  cycleRef.current = cycle;
  const tapRef = useRef(null);
  tapRef.current = (sq) => {
    if (busy || over) return;
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
    if (sq != null && targets.includes(sq)) { play(sq); return true; }
    return false;
  };
  const toggleView = () => { if (!busy) setView((v) => (v === "board" ? "close" : "board")); };

  const squareName = (sq) => `${"abcdefgh"[sq % 8]}${((sq / 8) | 0) + 1}`;
  const pieceName = (sq) => ["", "Pawn", "Knight", "Bishop", "Rook", "Queen", "King"][Math.abs(shown.pieceAt(sq))] + ` on ${squareName(sq)}`;
  const isAttack = chosen != null && captures.includes(chosen);
  const inCheck = caughtUp && !result && shown.inCheckNow();
  const shownMoves = moves.slice(0, shownPly);
  const lastMove = shownMoves.length ? `${Math.ceil(shownMoves.length / 2)}${shownMoves.length % 2 ? "." : "…"} ${shownMoves[shownMoves.length - 1]}` : null;
  const hint = busy ? "…"
    : !myTurn ? game.status
    : view === "board" ? "Your move. Tap a character to take a closer look"
    : !targets.length ? "This one can't move"
    : chosen != null ? (isAttack ? `Tap ${squareName(chosen)} again to strike` : `Tap ${squareName(chosen)} again to move`)
    : "Tap a glowing square, or drag there";
  const won = result?.winner === myColor, lost = result && result.winner === -myColor;

  const clock = (color) => {
    const left = timeLeft(color);
    if (left == null) return null;
    const running = color === sideToMove && !result && moves.length >= 2;
    return (
      <span className={"tc-display text-[15px] " + (left < 20_000 ? "text-[var(--tc-gold-hi)]" : running ? "text-[var(--tc-cream)]" : "text-[var(--tc-cream-dim)]")} style={{ fontFamily: "var(--font-mono)" }}>
        {clockText(left)}
      </span>
    );
  };

  const leave = () => { game.forget(); onLeave(); };

  return (
    <div className="relative mx-auto w-full max-w-[480px] overflow-hidden" style={{ height: "calc(100dvh - var(--headerH))" }}>
      <canvas ref={canvasRef} className="absolute inset-0 block size-full touch-none" />

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 bg-gradient-to-b from-black/80 to-transparent p-3 pb-10">
        <div className="flex min-w-0 items-center gap-2.5">
          <MenuButton open={menuOpen} onClick={() => setMenuOpen((o) => !o)} />
          <PlayerSprite avatar={opponent.avatar} discordUrl={opponent.discordUrl} size={34} />
          <div className="min-w-0">
            <div className="tc-label truncate">vs {opponent.name}</div>
            <div className="flex items-baseline gap-2">
              <span className="tc-display text-[15px]" aria-live="polite">{inCheck ? "Check!" : sideToMove === myColor ? "Your move" : "Their move"}</span>
              {clock(-myColor)}
            </div>
            {lastMove && <div className="text-sm text-[var(--tc-cream-dim)]" style={{ fontFamily: "var(--font-mono)" }}>{lastMove}</div>}
          </div>
        </div>
        <MapButton
          fen={shown.fen()}
          pieceImgSrc={pieceImgSrc}
          size={88}
          flipped={myColor === -1}
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
            {!result && (canAbort
              ? <button type="button" className="tc-plank tc-center tc-small" onClick={() => { setMenuOpen(false); game.abort(); }}>Abort</button>
              : <button type="button" className="tc-plank tc-center tc-small" onClick={() => { setMenuOpen(false); game.resign(); }}>Resign</button>)}
            {!result && !canAbort && !drawOffer && (
              <button type="button" className="tc-plank tc-center tc-small" onClick={() => { setMenuOpen(false); game.offerDraw(); }}>Offer a draw</button>
            )}
          </div>
        </>
      )}

      {/* Their draw offer, or a chance to claim the win if they left. */}
      {!result && (drawOffer === "received" || oppGoneLong) && (
        <div className="tc-panel absolute inset-x-3 top-28 flex flex-col gap-2.5 p-3 text-center">
          <p className="m-0 text-base text-[var(--tc-cream)]" role="status">{game.status}</p>
          {drawOffer === "received" ? (
            <div className="flex gap-2.5">
              <button type="button" className="tc-plank tc-center tc-small flex-1" onClick={game.acceptDraw}>Accept draw</button>
              <button type="button" className="tc-plank tc-center tc-small flex-1" onClick={game.declineDraw}>Play on</button>
            </div>
          ) : (
            <button type="button" className="tc-plank tc-center tc-small" onClick={game.claimWin}>Claim the win</button>
          )}
        </div>
      )}

      {!over && (
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/80 to-transparent px-3 pt-10 pb-[calc(0.9rem+env(safe-area-inset-bottom))]">
          <button type="button" className="tc-round" onClick={() => cycle(-1)} disabled={busy} aria-label="Previous character">‹</button>
          <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5 text-center">
            <span className="flex items-baseline gap-2">
              <span className="tc-display truncate text-[15px]">{selected != null && view === "close" && myTurn ? pieceName(selected) : `You play ${myColor === 1 ? "White" : "Black"}`}</span>
              {clock(myColor)}
            </span>
            <span className={"truncate text-sm " + (isAttack ? "font-bold text-[var(--tc-gold-hi)]" : "text-[var(--tc-cream-dim)]")} aria-live="polite">{hint}</span>
          </div>
          <button type="button" className="tc-round" onClick={() => cycle(1)} disabled={busy} aria-label="Next character">›</button>
        </div>
      )}

      {over && (
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 bg-gradient-to-t from-black/90 via-black/70 to-transparent px-5 pt-20 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-center">
          <h2 className="tc-title m-0 text-[28px]">
            {result.reason === "Aborted" ? "Game aborted" : won ? "You win!" : lost ? `${opponent.name} wins` : "Draw"}
          </h2>
          {result.reason !== "Aborted" && (
            <p className="m-0 text-base text-[var(--tc-cream-dim)]">{result.text} · {result.reason} · {Math.ceil(moves.length / 2)} moves</p>
          )}
          <BrassButton onClick={leave}>Back to the lobby</BrassButton>
        </div>
      )}
    </div>
  );
}
