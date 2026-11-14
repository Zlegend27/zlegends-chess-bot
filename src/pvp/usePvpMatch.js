/* ================================================================
   The rules and connection of a 1v1 game, without its screen, so the
   flat 1v1 board and Chess Tactica's 3D board play the same game.

   The two browsers talk directly over a Supabase Realtime channel for
   the match: each move goes out as { ply, san, clocks } and the other
   side replays it on its own engine, so an illegal or out-of-order move
   is simply ignored (and a resync asked for). Each side runs the clocks
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
import { timeControl } from "../utils/lobby";
import { saveGame } from "../utils/gameHistory";

const TICK_MS = 200;
/* The opponent's clock has to pass zero by this much before you can claim
   the win, to allow for the delay in their moves reaching you. */
const FLAG_GRACE_MS = 2000;
const LEFT_CLAIM_MS = 60_000;

export const resultFor = (winner, reason) => ({ text: winner === 1 ? "1–0" : winner === -1 ? "0–1" : "½–½", reason, winner });

/** `label`: how the game is named in the history ("1v1", "Tactica 1v1").
 *  `clockFromShown`: my clock only starts once the screen says the
 *  opponent's move has been shown (call `shown()`), for a board that plays
 *  moves out as scenes; `flagGraceMs` then has to cover that time too. */
export function usePvpMatch({ supabase, me, match, signedIn, storeKey = "pvpMatch", label = "1v1", clockFromShown = false, flagGraceMs = FLAG_GRACE_MS }) {
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
  const [turnStart, setTurnStart] = useState(() => resume?.turnStart ?? Date.now());
  const [result, setResult] = useState(resume?.result ?? null);
  const [drawOffer, setDrawOffer] = useState(null); // "sent" | "received" | "declined"
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
  useEffect(() => { saveSetting(storeKey, { id: match.id, moves, clocks, result, turnStart }); }, [storeKey, match.id, moves, clocks, result, turnStart]);

  const finish = useCallback((res, { announce = true } = {}) => {
    if (live.current.result) return;
    live.current.result = res;
    setResult(res);
    if (announce) send("result", res);
    if (signedIn && res.reason !== "Aborted") {
      saveGame({
        difficultyLabel: `${label} vs ${opponent.name}`, playerColor: myColor, moveList: live.current.moves,
        result: res, finalEval: null, gameUid: `${match.id}-${me.id.slice(0, 8)}`,
      });
    }
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
    if (res && !live.current.result) { live.current.result = res; setResult(res); }
  }, [eng, clockFromShown, myColor]);

  /* The match channel: moves, resync, results and draw offers, plus
     presence to notice the opponent leaving. */
  useEffect(() => {
    const channel = supabase.channel(`match-${match.id}`, { config: { broadcast: { self: false }, presence: { key: me.id } } });
    channelRef.current = channel;
    channel
      .on("broadcast", { event: "move" }, ({ payload }) => {
        const { moves: list } = live.current;
        if (payload.ply === list.length) apply(payload.san, payload.clocks);
        else if (payload.ply > list.length) send("sync-request");
      })
      .on("broadcast", { event: "sync-request" }, () => {
        const { moves: list, clocks: c, result: r } = live.current;
        send("sync", { moves: list, clocks: c, result: r });
      })
      .on("broadcast", { event: "sync" }, ({ payload }) => {
        const mine = live.current.moves;
        const theirs = payload.moves ?? [];
        const extends_ = theirs.length > mine.length && mine.every((m, i) => theirs[i] === m);
        if (extends_) adopt(theirs, payload.clocks, payload.result);
        else if (payload.result && !live.current.result) { live.current.result = payload.result; setResult(payload.result); }
      })
      .on("broadcast", { event: "result" }, ({ payload }) => finish(payload, { announce: false }))
      .on("broadcast", { event: "draw-offer" }, () => setDrawOffer("received"))
      .on("broadcast", { event: "draw-decline" }, () => setDrawOffer("declined"))
      .on("broadcast", { event: "draw-accept" }, () => finish(resultFor(0, "Agreement"), { announce: false }))
      .on("presence", { event: "sync" }, () => {
        const here = Object.keys(channel.presenceState()).includes(opponent.id);
        setOppOnline(here);
        setOppGoneSince((since) => (here ? null : since ?? Date.now()));
      })
      .subscribe((status) => {
        if (status !== "SUBSCRIBED") return;
        channel.track({ id: me.id });
        send("sync-request");
      });
    return () => { supabase.removeChannel(channel); channelRef.current = null; };
  }, [supabase, match.id, me.id, opponent.id, apply, adopt, finish, send]);

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
    return color === sideToMove && !result && moves.length >= 2 && turnStart != null ? base - (now - turnStart) : base;
  };
  useEffect(() => {
    if (result || tc.baseMs == null || moves.length < 2) return;
    const left = timeLeft(sideToMove);
    if (sideToMove === myColor && left <= 0) finish(resultFor(-myColor, "Timeout"));
    else if (sideToMove !== myColor && left <= -flagGraceMs) finish(resultFor(myColor, "Timeout"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now]);

  const myTurn = sideToMove === myColor && !result;

  /** Plays my move (in SAN) and sends it. False if it isn't legal now. */
  const submit = (san) => {
    if (!myTurn) return false;
    const ply = moves.length;
    const k = keyOf(myColor);
    const spent = ply >= 2 && turnStart != null ? Date.now() - turnStart : 0; // the clock starts after both first moves
    const newClocks = tc.baseMs == null ? clocks : { ...clocks, [k]: clocks[k] - spent + (ply >= 2 ? tc.incMs : 0) };
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
    status = myTurn ? `Your move${moves.length < 2 ? " (the clocks start after both first moves)" : ""}.` : `${opponent.name} is thinking…`;
  }

  return {
    eng, moves, result, tc, myColor, opponent, sideToMove, myTurn, timeLeft,
    oppOnline, oppGoneLong, drawOffer, canAbort, status,
    submit,
    /** The opponent's last move is on screen: my clock starts now. */
    shown: () => setTurnStart((t) => t ?? Date.now()),
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
