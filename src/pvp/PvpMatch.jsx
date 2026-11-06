/* ================================================================
   A 1v1 game between two people in the lobby.

   The two browsers talk directly over a Supabase Realtime channel for
   the match: each move goes out as { ply, san, clocks } and the other
   side replays it on its own engine, so an illegal or out-of-order move
   is simply ignored (and a resync asked for). Each side runs the clocks
   from the times sent with every move. A refresh rejoins: the game is
   kept on this device, and the opponent sends the moves to catch up.

   Casual games: nothing checks them on a server yet, so they don't
   touch any rating.
   ================================================================ */
import { useCallback, useEffect, useRef, useState } from "react";
import { createEngine, M64TO120, M120TO64, mFrom, mTo, mPromo } from "../engine/chessEngine";
import { replayIntoEngine } from "../utils/share";
import { loadSetting, saveSetting } from "../utils/storage";
import { gameResult } from "../utils/gameResult";
import { lastMoveOf, moveBySan } from "../utils/chessMoves";
import { timeControl, clockText } from "../utils/lobby";
import { saveGame } from "../utils/gameHistory";
import { fullMoves } from "../utils/moveNumber";
import LessonBoard from "../components/LessonBoard";
import PlayerSprite from "../components/PlayerSprite";

const STORE_KEY = "pvpMatch";
const TICK_MS = 200;
/* The opponent's clock has to pass zero by this much before you can claim
   the win, to allow for the delay in their moves reaching you. */
const FLAG_GRACE_MS = 2000;
const LEFT_CLAIM_MS = 60_000;
const QUEEN = 5;

const resultFor = (winner, reason) => ({ text: winner === 1 ? "1–0" : winner === -1 ? "0–1" : "½–½", reason, winner });

export default function PvpMatch({ supabase, me, match, pieceSetId, signedIn, onExit }) {
  const myColor = match.white.id === me.id ? 1 : -1;
  const opponent = myColor === 1 ? match.black : match.white;
  const tc = timeControl(match.tc);
  const resume = (() => { const s = loadSetting(STORE_KEY, null); return s?.id === match.id ? s : null; })();

  const engRef = useRef(null);
  if (!engRef.current) { engRef.current = createEngine(); replayIntoEngine(engRef.current, resume?.moves ?? []); }
  const eng = engRef.current;

  const [moves, setMoves] = useState(resume?.moves ?? []);
  const [clocks, setClocks] = useState(resume?.clocks ?? { w: tc.baseMs, b: tc.baseMs });
  /* Saved too, so a refresh can't reset the clock of the side to move. */
  const [turnStart, setTurnStart] = useState(() => resume?.turnStart ?? Date.now());
  const [result, setResult] = useState(resume?.result ?? null);
  const [drawOffer, setDrawOffer] = useState(null); // "sent" | "received" | "declined"
  const [oppOnline, setOppOnline] = useState(false);
  const [oppGoneSince, setOppGoneSince] = useState(null);
  const [selected, setSelected] = useState(-1);
  const [targets, setTargets] = useState([]);
  const [now, setNow] = useState(() => Date.now());
  const channelRef = useRef(null);
  const live = useRef({});
  live.current = { moves, clocks, result };

  const send = useCallback((event, payload = {}) => {
    channelRef.current?.send({ type: "broadcast", event, payload });
  }, []);

  /* Keep the game on this device, so a refresh can rejoin it. */
  useEffect(() => { saveSetting(STORE_KEY, { id: match.id, moves, clocks, result, turnStart }); }, [match.id, moves, clocks, result, turnStart]);

  const finish = useCallback((res, { announce = true } = {}) => {
    if (live.current.result) return;
    live.current.result = res;
    setResult(res);
    if (announce) send("result", res);
    if (signedIn && res.reason !== "Aborted") {
      saveGame({
        difficultyLabel: `1v1 vs ${opponent.name}`, playerColor: myColor, moveList: live.current.moves,
        result: res, finalEval: null, gameUid: `${match.id}-${me.id.slice(0, 8)}`,
      });
    }
  }, [send, signedIn, opponent.name, myColor, match.id, me.id]);

  /* Plays a move given in SAN onto the board and the move list. */
  const apply = useCallback((san, newClocks) => {
    const mv = moveBySan(eng, san);
    if (mv === undefined) return false;
    eng.make(mv);
    const list = [...live.current.moves, san];
    live.current.moves = list;
    setMoves(list);
    if (newClocks) setClocks(newClocks);
    setTurnStart(Date.now());
    setSelected(-1);
    setTargets([]);
    const over = gameResult(eng);
    if (over) finish(over, { announce: false });
    return true;
  }, [eng, finish]);

  const adopt = useCallback((list, newClocks, res) => {
    eng.reset();
    replayIntoEngine(eng, list);
    live.current.moves = list;
    setMoves(list);
    if (newClocks) setClocks(newClocks);
    setTurnStart(Date.now());
    if (res && !live.current.result) { live.current.result = res; setResult(res); }
  }, [eng]);

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
    return color === sideToMove && !result && moves.length >= 2 ? base - (now - turnStart) : base;
  };
  useEffect(() => {
    if (result || tc.baseMs == null || moves.length < 2) return;
    const left = timeLeft(sideToMove);
    if (sideToMove === myColor && left <= 0) finish(resultFor(-myColor, "Timeout"));
    else if (sideToMove !== myColor && left <= -FLAG_GRACE_MS) finish(resultFor(myColor, "Timeout"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now]);

  const myTurn = sideToMove === myColor && !result;

  const onSquare = (i64) => {
    if (!myTurn) return;
    const legal = eng.legalMoves();
    const sq120 = M64TO120[i64];
    if (selected >= 0) {
      /* Promotions become a queen for now. */
      const mv = legal.filter((m) => mFrom(m) === M64TO120[selected] && mTo(m) === sq120)
        .sort((a, b) => (mPromo(b) === QUEEN) - (mPromo(a) === QUEEN))[0];
      if (mv !== undefined) {
        const san = eng.sanOf(mv);
        const ply = moves.length;
        const k = keyOf(myColor);
        const spent = ply >= 2 ? Date.now() - turnStart : 0; // the clock starts after both first moves
        const newClocks = tc.baseMs == null ? clocks : { ...clocks, [k]: clocks[k] - spent + (ply >= 2 ? tc.incMs : 0) };
        apply(san, newClocks);
        send("move", { ply, san, clocks: newClocks });
        if (drawOffer === "received" || drawOffer === "declined") setDrawOffer(null);
        return;
      }
    }
    const p = eng.pieceAt(i64);
    if (p !== 0 && Math.sign(p) === myColor) {
      setSelected(i64);
      setTargets(legal.filter((m) => mFrom(m) === sq120).map((m) => M120TO64[mTo(m)]));
    } else {
      setSelected(-1);
      setTargets([]);
    }
  };

  const canAbort = moves.length < 2;
  const oppGoneLong = !oppOnline && oppGoneSince && now - oppGoneSince > LEFT_CLAIM_MS;

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

  const playerRow = (player, color) => (
    <div className={"pvpPlayer" + (color === sideToMove && !result ? " toMove" : "")}>
      <PlayerSprite avatar={player.avatar} discordUrl={player.discordUrl} size={40} />
      <span className="pvpName">{player.name}{player.id === me.id ? " (you)" : ""}</span>
      <span className={"pvpClock" + (timeLeft(color) != null && timeLeft(color) < 20_000 ? " low" : "")}>{clockText(timeLeft(color))}</span>
    </div>
  );

  return (
    <div className="trainerCol">
      {playerRow(opponent, -myColor)}
      <LessonBoard
        eng={eng}
        orientation={myColor === 1 ? "white" : "black"}
        selected={selected}
        targets={targets}
        lastMove={lastMoveOf(moves)}
        onSquare={onSquare}
        pieceSetId={pieceSetId}
      />
      {playerRow(me, myColor)}

      <div className="box trainerBox">
        <p className="lessonText" style={{ margin: 0 }} role="status">{status}</p>
        <p className="lessonHint" style={{ margin: "6px 0 0" }}>
          {timeControl(match.tc).label} · Casual · Move {fullMoves(moves.length + (result ? 0 : 1))}
        </p>
        <div className="trainerActions" style={{ minHeight: 0, marginTop: 10 }}>
          {result ? (
            <button className="btn gold" onClick={() => { saveSetting(STORE_KEY, null); onExit(); }}>Back to the lobby</button>
          ) : (
            <>
              {drawOffer === "received" && (
                <>
                  <button className="btn gold" onClick={() => { send("draw-accept"); finish(resultFor(0, "Agreement"), { announce: false }); }}>Accept draw</button>
                  <button className="btn ghost" onClick={() => { send("draw-decline"); setDrawOffer(null); }}>Decline</button>
                </>
              )}
              {oppGoneLong && <button className="btn gold" onClick={() => finish(resultFor(myColor, "Opponent left"))}>Claim the win</button>}
              {canAbort
                ? <button className="btn ghost" onClick={() => finish(resultFor(0, "Aborted"))}>Abort</button>
                : <button className="btn ghost" onClick={() => finish(resultFor(-myColor, "Resignation"))}>Resign</button>}
              {!canAbort && drawOffer !== "received" && drawOffer !== "sent" && (
                <button className="btn ghost" onClick={() => { send("draw-offer"); setDrawOffer("sent"); }}>Offer draw</button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
