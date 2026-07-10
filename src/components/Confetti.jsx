/** One-shot confetti burst -- CSS-driven, no dependency. Pieces fall and
 *  fade via a keyframe animation with animation-fill-mode:forwards, so
 *  once it plays out they're simply invisible; nothing needs to unmount
 *  this for it to stop costing anything. Remount with a fresh `key` (see
 *  App.jsx's rushMilestone counter) to replay it. */
const COLORS = ["#F5D93E", "#3EE7F5", "#D94BF0", "#8B6FE0", "#7FE8C8", "#FF6FD8"];

export default function Confetti({ count = 90 }) {
  const pieces = Array.from({ length: count }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.35,
    duration: 2.2 + Math.random() * 1.5,
    width: 5 + Math.random() * 6,
    height: 8 + Math.random() * 8,
    color: COLORS[i % COLORS.length],
    drift: (Math.random() - 0.5) * 140,
  }));
  return (
    <div className="confettiLayer" aria-hidden="true">
      {pieces.map(p => (
        <span
          key={p.id}
          className="confettiPiece"
          style={{
            left: p.left + "%",
            width: p.width,
            height: p.height,
            background: p.color,
            animationDelay: p.delay + "s",
            animationDuration: p.duration + "s",
            "--drift": p.drift + "px",
          }}
        />
      ))}
    </div>
  );
}
