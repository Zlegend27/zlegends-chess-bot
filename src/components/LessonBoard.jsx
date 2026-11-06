/* Shared presentational board for the Lessons feature (LessonPlayer +
   TheoryTrainer) -- renders any engine instance's position using the
   exact .board/.sq/.pc classes the main Play board owns, so lesson
   boards automatically match the player's board-color theme and piece
   design. Click-to-move only (no drag) -- lessons are a slower,
   deliberate context and this keeps the component tiny. */

import { M64TO120 } from "../engine/chessEngine";
import { getPieceSet } from "../utils/pieceSets";
import { arrowGeometry } from "../utils/arrowGeometry";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

/** `hint` ({ from, to } as 120-squares) outlines a move in gold, the same way
 *  the Play board shows Best Move. `arrows` ([{ from, to, color }]) draws
 *  arrows with the Play board's geometry. */
export default function LessonBoard({ eng, orientation, selected, targets, lastMove, onSquare, pieceSetId, hint = null, arrows = [] }) {
  const flipped = orientation === "black";
  const pieceImgSrc = (type, isWhite) => getPieceSet(pieceSetId).svgUrl(type, isWhite);
  const rows = [];
  for (let vr = 0; vr < 8; vr++) {
    const r = flipped ? vr : 7 - vr;
    const cells = [];
    for (let vf = 0; vf < 8; vf++) {
      const f = flipped ? 7 - vf : vf;
      const i64 = r * 8 + f;
      const sq120 = M64TO120[i64];
      const p = eng.pieceAt(i64);
      const light = (r + f) % 2 === 1;
      const isSel = selected === i64;
      const isTarget = targets.includes(i64);
      const isLast = lastMove && (lastMove.from === sq120 || lastMove.to === sq120);
      const hintClass = hint?.from === sq120 ? " hintFrom" : hint?.to === sq120 ? " hintTo" : "";
      const squareName = FILES[f] + (r + 1);
      cells.push(
        <div key={i64} role="gridcell" tabIndex={0} aria-label={squareName}
          onClick={() => onSquare(i64)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSquare(i64); } }}
          className={"sq " + (light ? "light" : "dark") + (isSel ? " sel" : "") + (isLast ? " last" : "") + hintClass}>
          {p !== 0 && <img className={"pc " + (p > 0 ? "w" : "b") + (pieceSetId === "sweetheart" && Math.abs(p) === 6 ? " kingBoost" : "") + (pieceSetId === "sweetheart" && p === -2 ? " knightBoost" : "")} src={pieceImgSrc(Math.abs(p), p > 0)} alt="" draggable="false" />}
          {isTarget && <span className={"dot" + (p !== 0 ? " ring" : "")} />}
          {vf === 0 && <span className="coord rk">{r + 1}</span>}
          {vr === 7 && <span className="coord fl">{FILES[f]}</span>}
        </div>
      );
    }
    rows.push(<div key={vr} role="row" className="brow">{cells}</div>);
  }
  const drawn = arrows.map((a) => ({ ...a, geo: arrowGeometry(a, flipped) })).filter((a) => a.geo);
  return (
    <div className="board" role="grid" aria-label="Lesson board">
      {rows}
      {drawn.length > 0 && (
        <svg className="arrowLayer" viewBox="0 0 8 8" aria-hidden="true">
          {drawn.map((a, i) => (
            <g key={i}>
              <path d={a.geo.path} fill="none" stroke={a.color || "#F5D93E"} strokeOpacity={0.85} strokeWidth="0.26" strokeLinecap="round" strokeLinejoin="round" />
              <polygon points={a.geo.head} fill={a.color || "#F5D93E"} fillOpacity={0.85} />
            </g>
          ))}
        </svg>
      )}
    </div>
  );
}
