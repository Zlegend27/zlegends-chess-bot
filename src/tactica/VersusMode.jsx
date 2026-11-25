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
import { BrassButton, MapButton, MenuButton, PromotionPicker, useViewSource, LearnHints, useLostRebuild, useBackLayer } from "./ui";
import { track } from "../utils/track";
import { play as playSound, sting } from "./sound";
import { applyStory } from "./bonds";
import { friendlySquares } from "./BotMode";
import GameReview from "./GameReview";

/* 1v1 in the bin: a game against another person on the 3D board.

   Tactica has its own lobby room, so Tactica players only meet each other.
   The game itself (moves over Realtime, clocks, draws, results, rejoining
   after a refresh) is the same as the site's 1v1 (usePvpMatch). The board
   on screen plays every move out as the usual attack scenes, yours and
   theirs, one after another, so it can lag the game a moment while a
   scene finishes; you can move again once it has caught up. A table is
   casual or ranked (whoever opens it chooses); a pawn reaching the last
   rank asks which piece it becomes. Your clock starts only once their
   move has played out on your board. */
const KNIGHT = 2, QUEEN = 5;
const sqOf = (sq120) => M120TO64[sq120];
/** The square of the king of the side to move (0-63), or null. */
const kingSquare = (e) => { const k = 6 * e.getSide(); for (let sq = 0; sq < 64; sq++) if (e.pieceAt(sq) === k) return sq; return null; };

/* Your clock starts once their move has played out on your board, so the
   other side waits this long past zero before it can claim a win on time. */
const FLAG_GRACE_MS = 10_000;
const LOBBY = { room: "tactica-lobby-v1", activeKey: "tacticaPvpActive", tcKey: "tacticaPvpTc", matchPrefix: "tc-" };

export default function VersusMode({ session, profile, displayName, avatar, onSignIn, rating = null, onRated, sweetheart, pieceImgSrc, onExit }) {
  const { me, signedIn } = useLobbyMe({ session, profile, displayName, avatar });
  const lobby = useLobby({ me, rating, ...LOBBY });

  if (!me) {
    return (
      <Screen>
        <h2 className="tc-title m-0 text-center text-[28px]">1v1</h2>
        <p className="m-0 text-center text-base text-[var(--tc-cream-dim)]">Play a real person in the bin. Log in to join; your name and look come from your profile.</p>
        <BrassButton className="self-center" onClick={onSignIn}>Log in</BrassButton>
        <button type="button" className="tc-link self-center" onClick={onExit}>Back to the menu</button>
      </Screen>
    );
  }
  if (lobby.match && lobby.supabase) {
    return (
      <VersusGame
        key={lobby.match.id}
        supabase={lobby.supabase} me={me} match={lobby.match} signedIn={signedIn}
        sweetheart={sweetheart} pieceImgSrc={pieceImgSrc} onLeave={lobby.leaveMatch}
        onRated={onRated} onRematch={lobby.rematch} onBlock={lobby.block}
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
  const { connected, players, tables, seat, tcId, setTcId, ranked, setRanked, note, standing, sit, standUp } = lobby;
  const mySeatTable = seat ? tables[seat.table] : null;

  const seatView = (table, side) => {
    const p = table.seats[side];
    const mine = p?.id === me.id;
    if (!p) {
      return (
        <button type="button" className="tc-plank tc-small tc-center flex-1" disabled={!connected || !!seat} onClick={() => sit(table.id, side)}>
          {table.seats[1 - side] ? "Join" : "Sit"}
        </button>
      );
    }
    return (
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <PlayerSprite avatar={p.avatar} discordUrl={p.discordUrl} size={40} />
        <span className="flex min-w-0 flex-col">
          <span className={"truncate text-sm font-bold " + (mine ? "text-[var(--tc-gold-hi)]" : "text-[var(--tc-cream)]")}>{mine ? "You" : p.name}</span>
          <span className="text-[11px] text-[var(--tc-cream-dim)]">{p.elo != null ? `${p.elo} Elo` : "Unrated"}</span>
        </span>
      </div>
    );
  };

  return (
    <Screen>
      <div className="flex items-end justify-between gap-3">
        <h2 className="tc-title m-0 text-[28px]">1v1</h2>
        <span className="tc-label flex items-center gap-1.5 pb-1" role="status">
          <i className="block size-2 rounded-full" style={{ background: connected ? "#8fd18a" : "var(--tc-cream-dim)" }} aria-hidden="true" />
          {connected ? `${players.length} in the bin` : "Connecting…"}
        </span>
      </div>

      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="tc-label mb-2">Your table</legend>
        <div className="grid grid-cols-4 gap-2">
          {TIME_CONTROLS.map((t) => (
            <button key={t.id} type="button" aria-pressed={tcId === t.id} disabled={!!seat} className="tc-plank tc-small tc-center" style={{ padding: "8px 4px", fontSize: 12 }} onClick={() => setTcId(t.id)}>{t.label.replace(" min", "m").replace("No clock", "None")}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" aria-pressed={!ranked} disabled={!!seat} className="tc-plank tc-small tc-center" onClick={() => setRanked(false)}>Casual</button>
          <button type="button" aria-pressed={ranked} disabled={!!seat} className="tc-plank tc-small tc-center" onClick={() => setRanked(true)}>Ranked</button>
        </div>
        <p className="m-0 text-xs text-[var(--tc-cream-dim)]">{ranked ? "Ranked: win or lose, your rating moves." : "Casual: just for fun, no rating change."}</p>
      </fieldset>

      <div className="flex flex-col gap-2">
        <span className="tc-label">Tables</span>
        {tables.map((table) => {
          const busy = table.seats.some((p) => p?.playing);
          const taken = table.seats.filter(Boolean).length;
          const mineHere = table.seats.some((p) => p?.id === me.id);
          return (
            <div key={table.id} className="tc-panel flex flex-col gap-2 p-2.5" style={mineHere ? { boxShadow: "inset 0 0 0 2px var(--tc-brass)" } : undefined}>
              <div className="tc-label flex items-baseline justify-between gap-2">
                <span>Table {table.id + 1}{taken > 0 && ` · ${timeControl(table.tc).label} · ${table.ranked ? "Ranked" : "Casual"}`}</span>
                <span style={{ color: busy ? "var(--tc-gold-hi)" : undefined }}>{busy ? "Playing" : taken === 1 ? "Waiting" : "Open"}</span>
              </div>
              <div className="flex items-center gap-2">
                {seatView(table, 0)}
                <span className="tc-label" aria-hidden="true">vs</span>
                {seatView(table, 1)}
              </div>
              {mineHere && !busy && <button type="button" className="tc-link self-start" style={{ fontSize: 12, padding: 2 }} onClick={standUp}>Leave the table</button>}
            </div>
          );
        })}
      </div>

      {mySeatTable && !mySeatTable.full && <p className="m-0 text-center text-sm text-[var(--tc-cream)]" role="status">You&apos;re seated. The game starts as soon as someone joins you.</p>}
      {note && <p className="m-0 text-center text-sm text-[var(--tc-gold-hi)]" role="status">{note}</p>}

      {standing.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="tc-label">Looking around</span>
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

      <button type="button" className="tc-link self-center" onClick={onExit}>Back to the menu</button>
    </Screen>
  );
}

/* ---------------- The game ---------------- */

function VersusGame({ supabase, me, match, signedIn, sweetheart, pieceImgSrc, onLeave, onRated, onRematch, onBlock }) {
  const game = usePvpMatch({ supabase, me, match, signedIn, storeKey: "tacticaPvpMatch", label: "Tactica 1v1", clockFromShown: true, flagGraceMs: FLAG_GRACE_MS, onRated, onRematch });
  /* The square a pawn is promoting on, while the player picks the piece. */
  const [promoting, setPromoting] = useState(null);
  /* Block or report: closed, its choices open, or done. Either way the two
     never get matched again on this device; a report also tells us why. */
  const [flag, setFlag] = useState("closed");
  const blockThem = (reason) => {
    onBlock(opponent.id);
    track(reason ? "player_report" : "player_block", { player: opponent.id, reason: reason ?? null, match: match.id });
    setFlag("done");
  };
  const { moves, result, myColor, opponent, timeLeft, sideToMove, drawOffer, oppGoneLong, canAbort } = game;

  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  /* If the phone drops the 3D, rebuild on a fresh canvas (useLostRebuild). */
  const { epoch, onLost } = useLostRebuild(sceneRef);
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
  /* Analyse the game, once it's over. */
  const [reviewing, setReviewing] = useState(false);

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
      onLost,
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
    applyStory(scene);
    const bin = dressTrashBin(scene);
    scene.everyFrame.push((dt) => bin.update(dt));
    scene.setFlipped(myColor === -1);
    scene.setPieces(piecesNow());
    scene.showBoard();
    return () => { aliveRef.current = false; scene.dispose(); sceneRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sweetheart, epoch]);

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
      if (shown.inCheckNow()) {
        playSound("metal", { volume: 0.7, delay: 0.1 });
        /* The checked king's moment of fear (the board is still catching up). */
        animatingRef.current = true;
        try { await sceneRef.current?.kingScare(kingSquare(shown), to); } finally { animatingRef.current = false; }
        if (!aliveRef.current) return;
      }
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
  /* A rematch starting (or anything that reopens the game) ends the review. */
  useEffect(() => { if (!over) setReviewing(false); }, [over]);
  const endReview = () => {
    setReviewing(false);
    sceneRef.current?.setPieces(piecesNow());
    sceneRef.current?.showBoard();
  };
  const overSound = useRef(false);
  useEffect(() => {
    if (!over || overSound.current) return;
    overSound.current = true;
    sceneRef.current?.setMarks({});
    if (result.reason !== "Aborted") sting(result.winner === myColor ? "win" : result.winner ? "lose" : "draw");
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

  /* Back (the phone's, or Escape) opens the game menu, and closes it if open:
     a stray swipe never leaves a live game. */
  useBackLayer(!reviewing || menuOpen, () => setMenuOpen((o) => !o));

  /* ---- Input ---- */
  const play = (target, piece = null) => {
    if (!canMove) return;
    const found = movesFrom.filter((m) => sqOf(mTo(m)) === target);
    /* Several moves to one square is a promotion: ask which piece first. */
    if (found.length > 1 && piece == null) { setPromoting(target); return; }
    const move = found.find((m) => !mPromo(m) || mPromo(m) === (piece ?? QUEEN));
    if (!move) return;
    setPromoting(null);
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
    const running = color === sideToMove && !result;
    return (
      <span className={"tc-display text-[15px] " + (left < 20_000 ? "text-[var(--tc-gold-hi)]" : running ? "text-[var(--tc-cream)]" : "text-[var(--tc-cream-dim)]")} style={{ fontFamily: "var(--font-mono)" }}>
        {clockText(left)}
      </span>
    );
  };

  const leave = () => { game.forget(); onLeave(); };

  return (
    <div className="relative mx-auto w-full max-w-[480px] overflow-hidden" style={{ height: "calc(100dvh - var(--headerH))" }}>
      <canvas key={epoch} ref={canvasRef} className="absolute inset-0 block size-full touch-none" />
      <LearnHints close={!over && myTurn && view === "close"} />

      {!reviewing && <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 bg-gradient-to-b from-black/80 to-transparent p-3 pb-10">
        <div className="flex min-w-0 items-center gap-2.5">
          <MenuButton open={menuOpen} onClick={() => setMenuOpen((o) => !o)} />
          <PlayerSprite avatar={opponent.avatar} discordUrl={opponent.discordUrl} size={34} />
          <div className="min-w-0">
            <div className="tc-label truncate">vs {opponent.name}{match.ranked ? " · Ranked" : ""}</div>
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
      </div>}

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

      {promoting != null && !over && (
        <PromotionPicker onPick={(piece) => play(promoting, piece)} onCancel={() => setPromoting(null)} />
      )}

      {!over && (
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/80 to-transparent px-3 pt-10 pb-[calc(0.9rem+env(safe-area-inset-bottom))]">
          <button type="button" className="tc-round tc-cycle" onClick={() => cycle(-1)} disabled={busy} aria-label="Previous character">‹</button>
          <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5 text-center">
            <span className="flex items-baseline gap-2">
              <span className="tc-display truncate text-[15px]">{selected != null && view === "close" && myTurn ? pieceName(selected) : `You play ${myColor === 1 ? "White" : "Black"}`}</span>
              {clock(myColor)}
            </span>
            <span className={"truncate text-sm " + (isAttack ? "font-bold text-[var(--tc-gold-hi)]" : "text-[var(--tc-cream-dim)]")} aria-live="polite">{hint}</span>
          </div>
          <button type="button" className="tc-round tc-cycle" onClick={() => cycle(1)} disabled={busy} aria-label="Next character">›</button>
        </div>
      )}

      {reviewing && over && (
        <GameReview sceneRef={sceneRef} moves={moves} ending={`${result.reason}. ${result.text}`} onDone={endReview} onQuit={leave} quitLabel="Back to the lobby" />
      )}

      {over && !reviewing && (
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 bg-gradient-to-t from-black/90 via-black/70 to-transparent px-5 pt-20 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-center">
          <h2 className="tc-title m-0 text-[28px]">
            {result.reason === "Aborted" ? "Game aborted" : won ? "You win!" : lost ? `${opponent.name} wins` : "Draw"}
          </h2>
          {result.reason !== "Aborted" && (
            <p className="m-0 text-base text-[var(--tc-cream-dim)]">
              {result.text} · {result.reason} · {Math.ceil(moves.length / 2)} moves
              {game.ratingChange != null && <b className="text-[var(--tc-gold-hi)]"> · Rating {game.ratingChange >= 0 ? "+" : ""}{game.ratingChange}</b>}
            </p>
          )}
          {game.rematch === "received" && <p className="m-0 text-sm text-[var(--tc-gold-hi)]" role="status">{opponent.name} wants a rematch.</p>}
          {result.reason !== "Aborted" && moves.length > 0 && (
            <button type="button" className="tc-plank tc-center tc-small" style={{ width: 200 }} onClick={() => { setMenuOpen(false); setReviewing(true); }}>Analyse the game</button>
          )}
          {result.reason !== "Aborted" ? (
            <BrassButton onClick={game.offerRematch} disabled={game.rematch === "sent"}>
              {game.rematch === "sent" ? "Waiting for them…" : game.rematch === "received" ? "Accept rematch" : "Rematch"}
            </BrassButton>
          ) : (
            <BrassButton onClick={leave}>Back to the lobby</BrassButton>
          )}
          <div className="flex gap-4">
            {result.reason !== "Aborted" && <button type="button" className="tc-link" onClick={leave}>Back to the lobby</button>}
            {flag === "done"
              ? <span className="p-1.5 text-sm text-[var(--tc-cream-dim)]" role="status">Blocked</span>
              : <button type="button" className="tc-link" aria-expanded={flag === "open"} onClick={() => setFlag(flag === "open" ? "closed" : "open")}>Block or report</button>}
          </div>
          {flag === "open" && (
            <div className="tc-panel flex w-full flex-col gap-2 p-3" role="group" aria-label={`Block or report ${opponent.name}`}>
              <p className="m-0 text-sm text-[var(--tc-cream-dim)]">You won&apos;t be matched with {opponent.name} again.</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" className="tc-plank tc-small tc-center" onClick={() => blockThem(null)}>Just block</button>
                <button type="button" className="tc-plank tc-small tc-center" onClick={() => blockThem("cheating")}>Cheating</button>
                <button type="button" className="tc-plank tc-small tc-center" onClick={() => blockThem("name")}>Offensive name</button>
                <button type="button" className="tc-plank tc-small tc-center" onClick={() => blockThem("stalling")}>Stalling or leaving</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
