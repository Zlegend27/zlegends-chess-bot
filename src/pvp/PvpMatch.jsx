/* ================================================================
   A 1v1 game between two people in the lobby, on the flat board. The
   game itself (moves over Realtime, clocks, draw offers, results, rejoin
   after a refresh) is usePvpMatch, shared with Chess Tactica's 1v1.
   ================================================================ */
import { useState } from "react";
import { M64TO120, M120TO64, mFrom, mTo, mPromo } from "../engine/chessEngine";
import { lastMoveOf } from "../utils/chessMoves";
import { timeControl, clockText } from "../utils/lobby";
import { fullMoves } from "../utils/moveNumber";
import LessonBoard from "../components/LessonBoard";
import PlayerSprite from "../components/PlayerSprite";
import { usePvpMatch } from "./usePvpMatch";
import { getPieceSet } from "../utils/pieceSets";
import Modal from "../components/Modal";

/* Promotion choices, engine piece types, best first. */
const PROMOTIONS = [[5, "Queen"], [4, "Rook"], [3, "Bishop"], [2, "Knight"]];

export default function PvpMatch({ supabase, me, match, pieceSetId, signedIn, onExit }) {
  const game = usePvpMatch({ supabase, me, match, signedIn });
  const { eng, moves, result, myColor, opponent, sideToMove, myTurn, timeLeft, drawOffer, oppGoneLong, canAbort, status } = game;
  const [selected, setSelected] = useState(-1);
  const [targets, setTargets] = useState([]);
  /* A pawn reaching the last rank: the moves to choose between. */
  const [promotion, setPromotion] = useState(null);
  const play = (mv) => {
    game.submit(eng.sanOf(mv));
    setSelected(-1);
    setTargets([]);
    setPromotion(null);
  };

  const onSquare = (i64) => {
    if (!myTurn) return;
    const legal = eng.legalMoves();
    const sq120 = M64TO120[i64];
    if (selected >= 0) {
      const found = legal.filter((m) => mFrom(m) === M64TO120[selected] && mTo(m) === sq120);
      /* Several moves to one square means a promotion: ask which piece. */
      if (found.length > 1) { setPromotion(found); return; }
      if (found.length === 1) { play(found[0]); return; }
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

  const playerRow = (player, color) => (
    <div className={"pvpPlayer" + (color === sideToMove && !result ? " toMove" : "")}>
      <PlayerSprite avatar={player.avatar} discordUrl={player.discordUrl} size={40} />
      <span className="pvpName">{player.name}{player.id === me.id ? " (you)" : ""}</span>
      <span className={"pvpClock" + (timeLeft(color) != null && timeLeft(color) < 20_000 ? " low" : "")}>{clockText(timeLeft(color))}</span>
    </div>
  );

  return (
    <div className="trainerCol">
      <Modal open={!!promotion && myTurn} onClose={() => setPromotion(null)} closeLabel="Cancel the promotion">
        <div className="boxHead">Promote to</div>
        <div className="flex justify-center gap-2">
          {PROMOTIONS.map(([type, name]) => {
            const mv = promotion?.find((m) => mPromo(m) === type);
            return mv === undefined ? null : (
              <button key={type} type="button" className="btn ghost" style={{ padding: 6 }} aria-label={name} title={name} onClick={() => play(mv)}>
                <img src={getPieceSet(pieceSetId).svgUrl(type, myColor === 1)} alt="" width="44" height="44" />
              </button>
            );
          })}
        </div>
      </Modal>
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
            <button className="btn gold" onClick={() => { game.forget(); onExit(); }}>Back to the lobby</button>
          ) : (
            <>
              {drawOffer === "received" && (
                <>
                  <button className="btn gold" onClick={game.acceptDraw}>Accept draw</button>
                  <button className="btn ghost" onClick={game.declineDraw}>Decline</button>
                </>
              )}
              {oppGoneLong && <button className="btn gold" onClick={game.claimWin}>Claim the win</button>}
              {canAbort
                ? <button className="btn ghost" onClick={game.abort}>Abort</button>
                : <button className="btn ghost" onClick={game.resign}>Resign</button>}
              {!canAbort && drawOffer !== "received" && drawOffer !== "sent" && (
                <button className="btn ghost" onClick={game.offerDraw}>Offer draw</button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
