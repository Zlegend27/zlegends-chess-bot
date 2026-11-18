/* ================================================================
   The rules and connection of a 1v1 game, without its screen, so the
   flat 1v1 board and Chess Tactica's 3D board play the same game.

   The two browsers talk directly over a Supabase Realtime channel for
   the match: each move goes out as { ply, san, clocks } and the other
   side replays it on its own engine, so an illegal or out-of-order move
   is simply ignored (and a resync asked for). Nothing the other side sends
   is taken on trust: a move must be theirs to play, a resync may only add
   their moves, and a result that says I lost must be one my own board and
   clock agree with (see `believable`). Each side runs the clocks
   from the times sent with every move. A refresh rejoins: the game is
   kept on this device (under `storeKey`), and the opponent sends the
   moves to catch up.

   Casual games: nothing checks them on a server yet, so they don't
   touch any rating.
   ================================================================ */
import { useCallback, useEffect, useRef, useState } from "react";
import { createEngine } from "../engine/chessEngine";
import { replayIntoEngine } from "../utils/share";
import { loadSetting, saveSetting } from "../utils/storage";
import { gameResult } from "../utils/gameResult";
import { moveBySan } from "../utils/chessMoves";
import { timeControl, eloChange, rematchOf } from "../utils/lobby";
import { track } from "../utils/track";
import { saveGame } from "../utils/gameHistory";
import { openChannel } from "./channel";

const TICK_MS = 200;
/* The opponent's clock has to pass zero by this much before you can claim
   the win, to allow for the delay in their moves reaching you. */
const FLAG_GRACE_MS = 2000;
const LEFT_CLAIM_MS = 60_000;

/** Whether a result sent by the other player can be true (see the top). */
export function believableResult(res, { moves, myColor, offer = null, myTimeLeft = null }) {
  if (!res || typeof res !== "object" || ![1, -1, 0, undefined, null].includes(res.winner)) return false;
  if (res.winner === myColor) return true;
  if (res.reason === "Aborted") return !res.winner && moves.length < 2;
  if (res.reason === "Agreement") return !res.winner && offer === "sent";
  if (res.reason === "Timeout") return res.winner === -myColor && myTimeLeft != null && myTimeLeft <= 1500;
  const probe = createEngine();
  replayIntoEngine(probe, moves);
  const real = gameResult(probe);
  return !!real && real.reason === res.reason && (real.winner ?? 0) === (res.winner ?? 0);
}

export const resultFor = (winner, reason) => ({ text: winner === 1 ? "1–0" : winner === -1 ? "0–1" : "½–½", reason, winner });

/** `label`: how the game is named in the history ("1v1", "Tactica 1v1").
 *  `clockFromShown`: my clock only starts once the screen says the
 *  opponent's move has been shown (call `shown()`), for a board that plays
 *  moves out as scenes; `flagGraceMs` then has to cover that time too. */
/*  `onRated(change)`: a ranked game ended, with this player's rating change.
 *  `onRematch(next)`: both players asked for another game. */
export function usePvpMatch({ supabase, me, match, signedIn, storeKey = "pvpMatch", label = "1v1", clockFromShown = false, flagGraceMs = FLAG_GRACE_MS, onRated, onRematch }) {
  const myColor = match.white.id === me.id ? 1 : -1;
  const opponent = myColor === 1 ? match.black : match.white;
  const tc = timeControl(match.tc);
  const [resume] = useState(() => { const s = loadSetting(storeKey, null); return s?.id === match.id ? s : null; });

  const engRef = useRef(null);
  if (!engRef.current) { engRef.current = createEngine(); replayIntoEngine(engRef.current, resume?.moves ?? []); }
  const eng = engRef.current;

  const [moves, setMoves] = useState(resume?.moves ?? []);
  const [clocks, setClocks] = useState(resume?.clocks ?? { w: tc.baseMs, b: tc.baseMs });
  /* Saved too, so a refresh can't reset the clock of the side to move.
     Null while my clock waits for the opponent's move to be shown. */
  const [turnStart, setTurnStart] = useState(() => resume?.turnStart ?? null);
  const [result, setResult] = useState(resume?.result ?? null);
  const [drawOffer, setDrawOffer] = useState(null); // "sent" | "received" | "declined"
  /* Who has asked for a rematch since the game ended. */
  const [rematch, setRematch] = useState({ mine: false, theirs: false });
  /* This player's rating change from this game, once it's known. */
  const [ratingChange, setRatingChange] = useState(resume?.ratingChange ?? null);
  const callbacks = useRef({});
  callbacks.current = { onRated, onRematch };
  const [oppOnline, setOppOnline] = useState(false);
  const [oppGoneSince, setOppGoneSince] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const channelRef = useRef(null);
  const live = useRef({});
  live.current = { moves, clocks, result };

  const send = useCallback((event, payload = {}) => {
    channelRef.current?.send({ type: "broadcast", event, payload });
  }, []);

  /* Keep the game on this device, so a refresh can rejoin it. */
  useEffect(() => { saveSetting(storeKey, { id: match.id, moves, clocks, result, turnStart, ratingChange }); }, [storeKey, match.id, moves, clocks, result, turnStart, ratingChange]);

  const finish = useCallback((res, { announce = true } = {}) => {
    if (live.current.result) return;
    live.current.result = res;
    setResult(res);
    if (announce) send("result", res);
    /* A ranked game moves the rating, once, when it ends. */
    if (match.ranked && res.reason !== "Aborted") {
      const mine = myColor === 1 ? match.white : match.black;
      const change = eloChange(mine.elo, opponent.elo, res.winner === myColor ? 1 : res.winner ? 0 : 0.5);
      setRatingChange(change);
      callbacks.current.onRated?.(change);
    }
    track("pvp_end", { label, ranked: !!match.ranked, reason: res.reason, plies: live.current.moves.length });
    if (signedIn && res.reason !== "Aborted") {
      saveGame({
        difficultyLabel: `${label} vs ${opponent.name}`, playerColor: myColor, moveList: live.current.moves,
        result: res, finalEval: null, gameUid: `${match.id}-${me.id.slice(0, 8)}`,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [send, signedIn, label, opponent.name, myColor, match.id, me.id]);

  /* Plays a move given in SAN onto the engine and the move list. */
  const apply = useCallback((san, newClocks, mine = false) => {
    const mv = moveBySan(eng, san);
    if (mv === undefined) return false;
    eng.make(mv);
    const list = [...live.current.moves, san];
    live.current.moves = list;
    setMoves(list);
    if (newClocks) setClocks(newClocks);
    setTurnStart(clockFromShown && !mine ? null : Date.now());
    const over = gameResult(eng);
    if (over) finish(over, { announce: false });
    return true;
  }, [eng, finish, clockFromShown]);

  const adopt = useCallback((list, newClocks, res) => {
    eng.reset();
    replayIntoEngine(eng, list);
    live.current.moves = list;
    setMoves(list);
    if (newClocks) setClocks(newClocks);
    setTurnStart(clockFromShown && (list.length % 2 === 0 ? 1 : -1) === myColor ? null : Date.now());
    if (res) finish(res, { announce: false });
  }, [eng, clockFromShown, myColor, finish]);

  /* The match channel: moves, resync, results and draw offers, plus
     presence to notice the opponent leaving. */
  useEffect(() => {
    const table = openChannel(supabase, `match-${match.id}`, { broadcast: { self: false }, presence: { key: me.id } }, {
      signedIn,
      onStatus: (status, channel) => {
        if (status !== "SUBSCRIBED") return;
        channel.track({ id: me.id });
        send("sync-request");
      },
      build: (channel) => {
    channelRef.current = channel;
    channel
      .on("broadcast", { event: "move" }, ({ payload }) => {
        const { moves: list } = live.current;
        /* Only a move for their own side: never one of mine. */
        const theirTurn = (list.length % 2 === 0 ? 1 : -1) !== myColor;
        if (payload.ply === list.length && theirTurn && typeof payload.san === "string") apply(payload.san, payload.clocks);
        else if (payload.ply > list.length) send("sync-request");
      })
      .on("broadcast", { event: "sync-request" }, () => {
        const { moves: list, clocks: c, result: r } = live.current;
        send("sync", { moves: list, clocks: c, result: r });
      })
      .on("broadcast", { event: "sync" }, ({ payload }) => {
        const mine = live.current.moves;
        const theirs = payload.moves ?? [];
        /* A resync may only add their moves: my own are kept on this device,
           so a list with a new move of mine in it was made up. */
        const extends_ = Array.isArray(theirs) && theirs.length > mine.length && mine.every((m, i) => theirs[i] === m)
          && theirs.slice(mine.length).every((_, k) => ((mine.length + k) % 2 === 0 ? 1 : -1) !== myColor);
        if (extends_) adopt(theirs, payload.clocks, believableRef.current(payload.result, theirs) ? payload.result : null);
        else if (payload.result && believableRef.current(payload.result)) finish(payload.result, { announce: false });
      })
      .on("broadcast", { event: "result" }, ({ payload }) => { if (believableRef.current(payload)) finish(payload, { announce: false }); })
      .on("broadcast", { event: "draw-offer" }, () => setDrawOffer("received"))
      .on("broadcast", { event: "draw-decline" }, () => setDrawOffer("declined"))
      /* A draw they accept only counts if I offered one. */
      .on("broadcast", { event: "draw-accept" }, () => { if (offerRef.current === "sent") finish(resultFor(0, "Agreement"), { announce: false }); })
      .on("broadcast", { event: "rematch" }, () => setRematch((r) => ({ ...r, theirs: true })))
      .on("presence", { event: "sync" }, () => {
        const here = Object.keys(channel.presenceState()).includes(opponent.id);
        setOppOnline(here);
        setOppGoneSince((since) => (here ? null : since ?? Date.now()));
      });
      },
    });
    return () => { table.close(); channelRef.current = null; };
  }, [supabase, match.id, me.id, opponent.id, apply, adopt, finish, send, signedIn, myColor]);

  /* The clocks run from the first move, like any chess clock: White's
     starts once both players are at the board (so nobody loses time waiting
     for the other to arrive), and each move starts the other side's. */
  useEffect(() => {
    if (oppOnline && moves.length === 0) setTurnStart((t) => t ?? Date.now());
  }, [oppOnline, moves.length]);

  /* Clocks tick on screen, and run out. */
  useEffect(() => {
    if (result) return;
    const t = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(t);
  }, [result]);

  const sideToMove = moves.length % 2 === 0 ? 1 : -1;
  const keyOf = (color) => (color === 1 ? "w" : "b");
  const timeLeft = (color) => {
    if (tc.baseMs == null) return null;
    const base = clocks[keyOf(color)];
    return color === sideToMove && !result && turnStart != null ? base - (now - turnStart) : base;
  };
  useEffect(() => {
    if (result || tc.baseMs == null) return;
    const left = timeLeft(sideToMove);
    if (sideToMove === myColor && left <= 0) finish(resultFor(-myColor, "Timeout"));
    else if (sideToMove !== myColor && left <= -flagGraceMs) finish(resultFor(myColor, "Timeout"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now]);

  /* Both asked: on to the next game. */
  useEffect(() => {
    if (rematch.mine && rematch.theirs && result) callbacks.current.onRematch?.(rematchOf(match));
  }, [rematch, result, match]);

  const myTurn = sideToMove === myColor && !result;

  /* Whether a result the other side sent can be true. One that's good for
     me (they resigned, flagged, or left) is always fine; a draw or a loss
     for me must match my own board (checkmate, stalemate and the draw
     rules), my own clock (a timeout), or the game's start (an abort). */
  const offerRef = useRef(drawOffer);
  offerRef.current = drawOffer;
  const believableRef = useRef(null);
  believableRef.current = (res, list = live.current.moves) =>
    believableResult(res, { moves: list, myColor, offer: offerRef.current, myTimeLeft: timeLeft(myColor) });

  /** Plays my move (in SAN) and sends it. False if it isn't legal now. */
  const submit = (san) => {
    if (!myTurn) return false;
    const ply = moves.length;
    const k = keyOf(myColor);
    const spent = turnStart != null ? Date.now() - turnStart : 0;
    const newClocks = tc.baseMs == null ? clocks : { ...clocks, [k]: clocks[k] - spent + tc.incMs };
    if (!apply(san, newClocks, true)) return false;
    send("move", { ply, san, clocks: newClocks });
    if (drawOffer === "received" || drawOffer === "declined") setDrawOffer(null);
    return true;
  };

  const canAbort = moves.length < 2;
  const oppGoneLong = !oppOnline && !!oppGoneSince && now - oppGoneSince > LEFT_CLAIM_MS;

  let status;
  if (result) {
    const won = result.winner === myColor, lost = result.winner === -myColor;
    const verdict = result.reason === "Aborted" ? "Game aborted." : won ? "You win!" : lost ? `${opponent.name} wins.` : "Draw.";
    status = `${verdict} ${result.reason === "Aborted" ? "" : `(${result.reason.toLowerCase()})`}`.trim();
  } else if (!oppOnline) {
    status = oppGoneLong ? `${opponent.name} has been gone a while. You can claim the win.` : `Waiting for ${opponent.name} to connect…`;
  } else if (drawOffer === "received") {
    status = `${opponent.name} offers a draw.`;
  } else if (drawOffer === "sent") {
    status = "Draw offered. Waiting for an answer.";
  } else if (drawOffer === "declined") {
    status = "Draw declined. Play on.";
  } else {
    status = myTurn ? "Your move." : `${opponent.name} is thinking…`;
  }

  return {
    eng, moves, result, tc, myColor, opponent, sideToMove, myTurn, timeLeft,
    oppOnline, oppGoneLong, drawOffer, canAbort, status, ratingChange,
    /** "none" | "sent" | "received": who has asked for another game. */
    rematch: rematch.mine ? "sent" : rematch.theirs ? "received" : "none",
    offerRematch: () => { send("rematch"); setRematch((r) => ({ ...r, mine: true })); },
    submit,
    /** The opponent's last move is on screen: my clock starts now. */
    shown: () => { if (live.current.moves.length) setTurnStart((t) => t ?? Date.now()); },
    abort: () => finish(resultFor(0, "Aborted")),
    resign: () => finish(resultFor(-myColor, "Resignation")),
    claimWin: () => finish(resultFor(myColor, "Opponent left")),
    offerDraw: () => { send("draw-offer"); setDrawOffer("sent"); },
    acceptDraw: () => { send("draw-accept"); finish(resultFor(0, "Agreement"), { announce: false }); },
    declineDraw: () => { send("draw-decline"); setDrawOffer(null); },
    /** Forgets the finished game on this device. */
    forget: () => saveSetting(storeKey, null),
  };
}
