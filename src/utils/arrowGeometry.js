import { fileOf, rankOf } from "../engine/chessEngine.js";

/** Centre of a 120-square on an 8x8 board drawn in a 0..8 viewBox. */
export function arrowPoint(sq120, flipped = false) {
  const f = fileOf(sq120), r = rankOf(sq120);
  const visCol = flipped ? 7 - f : f;
  const visRow = flipped ? r : 7 - r;
  return { x: visCol + 0.5, y: visRow + 0.5 };
}

/* Arrow geometry, precomputed as one path + one head polygon.
   v1 drew two <line>s with an auto-oriented marker: the knight-move
   joint showed a visible seam, and the marker overshot the target
   square's center -- both read as "wonky", especially at phone sizes.
   Now: a single polyline (round joins handle the knight bend cleanly),
   the shaft starts offset from the origin center so it doesn't bury
   the piece, stops short of the target center, and an explicitly
   rotated triangle puts the arrow TIP exactly on the target center. */
export function arrowGeometry(arrow, flipped = false) {
  if (!arrow || arrow.from === arrow.to) return null;
  const a = arrowPoint(arrow.from, flipped), b = arrowPoint(arrow.to, flipped);
  const dx = b.x - a.x, dy = b.y - a.y;
  let bend = null;
  if (Math.abs(dx) === 2 && Math.abs(dy) === 1) bend = { x: a.x + dx, y: a.y };
  else if (Math.abs(dy) === 2 && Math.abs(dx) === 1) bend = { x: a.x, y: a.y + dy };
  const norm = (vx, vy) => { const l = Math.hypot(vx, vy) || 1; return { x: vx / l, y: vy / l }; };
  const first = bend || b;
  const u0 = norm(first.x - a.x, first.y - a.y);       // direction leaving the origin
  const prev = bend || a;
  const u1 = norm(b.x - prev.x, b.y - prev.y);         // direction into the target
  const HEAD_LEN = 0.42, HEAD_W = 0.5, START_OFF = 0.28;
  const start = { x: a.x + u0.x * START_OFF, y: a.y + u0.y * START_OFF };
  const shaftEnd = { x: b.x - u1.x * HEAD_LEN, y: b.y - u1.y * HEAD_LEN };
  const perp = { x: -u1.y, y: u1.x };
  const head = [
    `${b.x},${b.y}`,
    `${shaftEnd.x + perp.x * HEAD_W / 2},${shaftEnd.y + perp.y * HEAD_W / 2}`,
    `${shaftEnd.x - perp.x * HEAD_W / 2},${shaftEnd.y - perp.y * HEAD_W / 2}`,
  ].join(" ");
  const path = bend
    ? `M${start.x},${start.y} L${bend.x},${bend.y} L${shaftEnd.x},${shaftEnd.y}`
    : `M${start.x},${start.y} L${shaftEnd.x},${shaftEnd.y}`;
  return { path, head };
}
