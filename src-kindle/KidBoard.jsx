/* A kid board for the Opening Camp, the Adventure's mini-games and level
   puzzles: the same look as the Play board (the .kBoard/.kSq styles and
   the equipped board colours), tap a piece then a square.

   `pieceAt(i64)` gives the piece on a square (the engine's signed numbers,
   0 for empty), so it works for a real chess engine and for the mini-games'
   own little boards alike. Squares are 0..63, a1 = 0. `marks` puts an
   emoji on squares ({ [i64]: "⭐" }), for star hunts and rocks. */
const FILES = "abcdefgh";

export default function KidBoard({
  pieceAt, flipped = false, selected = -1, targets = [], lastMove = null, arrows = [], marks = {},
  glow = [], wrongSquare = -1, shake = false, onSquare, renderPiece, boardVars, label = "Chess board",
}) {
  const rows = [];
  for (let vr = 0; vr < 8; vr++) {
    const r = flipped ? vr : 7 - vr;
    const cells = [];
    for (let vf = 0; vf < 8; vf++) {
      const f = flipped ? 7 - vf : vf;
      const i64 = r * 8 + f;
      const p = pieceAt(i64);
      const light = (r + f) % 2 === 1;
      const isLast = lastMove && (lastMove.from === i64 || lastMove.to === i64);
      const name = FILES[f] + (r + 1);
      cells.push(
        <div key={i64} role="gridcell" tabIndex={0} aria-label={name + (p ? "" : ", empty")}
          onClick={() => onSquare?.(i64)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSquare?.(i64); } }}
          className={"kSq " + (light ? "kLight" : "kDark") + (selected === i64 ? " kSel" : "") + (isLast ? " kLast" : "")
            + (glow.includes(i64) ? " kHintFrom" : "") + (wrongSquare === i64 ? " kWrongSq" : "")}>
          {wrongSquare === i64 && <span className="kWrongX" aria-hidden="true">✕</span>}
          {marks[i64] && <span className="kStarSq" aria-hidden="true">{marks[i64]}</span>}
          {p !== 0 && renderPiece(p)}
          {targets.includes(i64) && <span className="kDot" />}
          {vf === 0 && <span className="kCoord kRk">{r + 1}</span>}
          {vr === 7 && <span className="kCoord kFl">{FILES[f]}</span>}
        </div>
      );
    }
    rows.push(<div key={vr} role="row" className="kRow">{cells}</div>);
  }
  /* Arrows in board coordinates (viewBox 0 0 8 8), so they scale with it. */
  const pt = (i64) => {
    const f = i64 % 8, r = (i64 / 8) | 0;
    return { x: (flipped ? 7 - f : f) + 0.5, y: (flipped ? r : 7 - r) + 0.5 };
  };
  return (
    <div className="kBoardWrap">
      <div className={"kBoard" + (shake ? " kWrongShake" : "")} style={boardVars} role="grid" aria-label={label}>
        {rows}
        {arrows.length > 0 && (
          <svg className="kHintArrow" viewBox="0 0 8 8" aria-hidden="true">
            {arrows.map(([from, to, colour], i) => {
              const a = pt(from), b = pt(to);
              const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
              const ux = dx / len, uy = dy / len, px = -uy, py = ux;
              const start = { x: a.x + ux * 0.3, y: a.y + uy * 0.3 };
              const base = { x: b.x - ux * 0.46, y: b.y - uy * 0.46 };
              const head = `${b.x},${b.y} ${base.x + px * 0.26},${base.y + py * 0.26} ${base.x - px * 0.26},${base.y - py * 0.26}`;
              const style = colour ? { stroke: colour, fill: colour } : undefined;
              return (
                <g key={i} style={style}>
                  <line x1={start.x} y1={start.y} x2={base.x} y2={base.y} strokeWidth="0.19" strokeLinecap="round" />
                  <polygon points={head} />
                </g>
              );
            })}
          </svg>
        )}
      </div>
    </div>
  );
}
