/* Owl's Replay, after a game: her best moment and one oops (replayMoments.js),
   each on a small board, plus her Piece Pals. For the oops, Owl can ask
   the engine for a safer idea and draw it. */
import { useEffect, useMemo, useState } from "react";
import { createEngine, M120TO64, mFrom, mTo } from "../src/engine/chessEngine";
import { AnimalIcon } from "./AnimalIcon";
import KidBoard from "./KidBoard";
import { replayMoments } from "./replayMoments";
import { PAL_KINDS, PAL_XP, palLevel } from "./kidProgress";

const PAL_GLYPH = { pawn: "♟", knight: "♞", bishop: "♝", rook: "♜", queen: "♛", king: "♚" };
const engAt = (fen) => { const e = createEngine(); e.loadFen(fen); return e; };

function Moment({ moment, kind, flipped, renderPiece, boardVars, extraArrow }) {
  const eng = useMemo(() => engAt(moment.fenBefore), [moment]);
  const arrows = [[moment.from, moment.to, kind === "best" ? "#4F9E6E" : "#E8853B"]];
  if (moment.reply) arrows.push([moment.reply.from, moment.reply.to, "#E0507F"]);
  if (extraArrow) arrows.push(extraArrow);
  return (
    <div className="krBoard">
      <KidBoard pieceAt={(i) => eng.pieceAt(i)} flipped={flipped} arrows={arrows} renderPiece={renderPiece} boardVars={boardVars} label={kind === "best" ? "Your best move" : "Your oops"} />
    </div>
  );
}

export function PiecePals({ pals = {} }) {
  return (
    <div className="krPals">
      {PAL_KINDS.map((k) => {
        const xp = pals[k] ?? 0, lvl = palLevel(xp);
        const lo = PAL_XP[lvl - 1], hi = PAL_XP[lvl];
        const pct = hi ? Math.round(((xp - lo) / (hi - lo)) * 100) : 100;
        return (
          <div key={k} className={"krPal" + (lvl >= 5 ? " krGold" : lvl >= 3 ? " krSparkle" : "")}>
            <span className="krPalGlyph" aria-hidden="true">{PAL_GLYPH[k]}</span>
            <span className="krPalName">{k[0].toUpperCase() + k.slice(1)}</span>
            <span className="krPalLv">Lv {lvl}{lvl >= 3 ? " ✨" : ""}</span>
            <span className="krBar" aria-label={`${pct}% to the next level`}><i style={{ width: `${pct}%` }} /></span>
          </div>
        );
      })}
    </div>
  );
}

export default function KidReplay({ moves, playerColor, won, pals, renderPiece, boardVars, runSearch, onClose }) {
  const { best, oops } = useMemo(() => replayMoments(moves, playerColor), [moves, playerColor]);
  const [idea, setIdea] = useState(null); // { san, from, to } | "thinking"
  useEffect(() => setIdea(null), [moves]);
  const askIdea = async () => {
    setIdea("thinking");
    const res = await runSearch(moves.slice(0, oops.ply), 700, 0, false);
    if (!res?.move) { setIdea(null); return; }
    setIdea({ san: res.san, from: M120TO64[mFrom(res.move)], to: M120TO64[mTo(res.move)] });
  };
  const flipped = playerColor === -1;
  return (
    <div className="kShopOv" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <button className="kCloseX" onClick={onClose} aria-label="Close Owl's Replay">✕</button>
      <div className="krPanel">
        <h2 className="khTitle" style={{ textAlign: "center" }}>Owl&apos;s Replay</h2>
        <p className="khSub" style={{ textAlign: "center", margin: 0 }}>{won ? "You won! 🥳 " : ""}Two moments from your game</p>

        <section className="khCard krMoment">
          <h3 className="krHead">⭐ Your best move{best && <span className="krBadge krGood">{best.san}</span>}</h3>
          {best ? (
            <>
              <Moment moment={best} kind="best" flipped={flipped} renderPiece={renderPiece} boardVars={boardVars} />
              <div className="kcOwl"><AnimalIcon kind="Owl" size={46} mood="happy" /><div className="khBubble">{best.text}</div></div>
            </>
          ) : (
            <div className="kcOwl"><AnimalIcon kind="Owl" size={46} /><div className="khBubble">No big captures this game. Next time, look for a piece of theirs nobody is guarding!</div></div>
          )}
        </section>

        <section className="khCard krMoment">
          <h3 className="krHead">🙈 One oops{oops && <span className="krBadge krOops">{oops.san}</span>}</h3>
          {oops ? (
            <>
              <Moment moment={oops} kind="oops" flipped={flipped} renderPiece={renderPiece} boardVars={boardVars}
                extraArrow={idea && idea !== "thinking" ? [idea.from, idea.to, "#4A9EE0"] : null} />
              <div className="kcOwl"><AnimalIcon kind="Owl" size={46} /><div className="khBubble">{oops.text}{idea && idea !== "thinking" ? ` A safer idea was ${idea.san} (the blue arrow).` : ""}</div></div>
              {!idea && <button className="khBig khWhite" onClick={askIdea}>💡 What should I have played?</button>}
              {idea === "thinking" && <p className="khSub" style={{ margin: 0 }}>Owl is thinking…</p>}
            </>
          ) : (
            <div className="kcOwl"><AnimalIcon kind="Owl" size={46} mood="happy" /><div className="khBubble">No pieces left hanging. Super careful game!</div></div>
          )}
        </section>

        <h3 className="khH2">Piece Pals</h3>
        <PiecePals pals={pals} />
      </div>
    </div>
  );
}
