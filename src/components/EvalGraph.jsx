import { GRADE_COLOR } from "../utils/grades";

/* Clickable eval graph for the post-game report -- the same "story of
   the game" area chart chess.com/lichess center their review on. scores
   come straight from gradeMoves (side-to-move perspective, one per ply
   plus the final position); the light region is White's share of the
   game, squashed with the same atan the eval bar next to the board
   uses. Tap or drag anywhere to jump the review to that ply. */
export default function EvalGraph({ scores, grades, current, onSeek }) {
  const n = scores.length - 1;
  if (n < 1) return null;
  const W = 100, H = 34;
  const whiteCp = (k) => (k % 2 === 0 ? scores[k] : -scores[k]);
  const y = (k) => (1 - Math.atan(whiteCp(k) / 300) / (Math.PI / 2)) * (H / 2);
  const x = (k) => (k / n) * W;
  let line = `M${x(0)},${y(0)}`;
  for (let k = 1; k <= n; k++) line += ` L${x(k)},${y(k)}`;
  const seek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    onSeek(Math.max(0, Math.min(n, Math.round(frac * n))));
  };
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
      className="block h-16 w-full cursor-pointer rounded-lg"
      style={{ background: "#150C24", touchAction: "none" }}
      onPointerDown={seek}
      onPointerMove={(e) => { if (e.buttons === 1) seek(e); }}
      role="slider" aria-label="Game evaluation graph" aria-valuemin={0} aria-valuemax={n} aria-valuenow={current}
    >
      <path d={`${line} L${W},${H} L0,${H} Z`} fill="#E9E4F5" fillOpacity="0.85" />
      <line x1="0" y1={H / 2} x2={W} y2={H / 2} stroke="#8B2FC9" strokeOpacity="0.5" strokeWidth="0.4" strokeDasharray="1.6 1.6" />
      <path d={line} fill="none" stroke="#3EE7F5" strokeOpacity="0.9" strokeWidth="0.6" />
      {grades && grades.map((g, i) => (
        (g === "mistake" || g === "blunder" || g === "miss") ? (
          <circle key={i} cx={x(i + 1)} cy={y(i + 1)} r="1.6" fill={GRADE_COLOR[g]} stroke="#150C24" strokeWidth="0.5" />
        ) : null
      ))}
      <line x1={x(current)} y1="0" x2={x(current)} y2={H} stroke="#F5D93E" strokeWidth="0.6" strokeOpacity="0.9" />
    </svg>
  );
}
