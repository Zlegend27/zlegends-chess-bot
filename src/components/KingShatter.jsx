/* The mated king cracks down the middle and crumbles where it stood, then a
   banner stamps across the board. Shards are copies of the king's own image,
   each clipped to one piece of it, so this works with every piece set. `done`
   skips straight to the rubble. */
const CRACK = [[50, 0], [44, 20], [56, 38], [46, 58], [54, 78], [48, 100]];
const BRANCHES = ["44,20 30,30 22,27", "56,38 70,46 77,42", "46,58 33,66 28,76", "54,78 66,84 71,93"];
const points = CRACK.map(([x, y]) => `${x},${y}`).join(" ");
/* Dark line for a white king, the bright edge for a black one. */
const crackLine = (pts, cls, key) => <polyline key={key} points={pts} pathLength="1" className={cls} />;

/* Between each pair of crack points, one shard left of it and one right. */
const SHARDS = CRACK.slice(1).flatMap((point, i) => {
  const [top, bottom] = [CRACK[i], point];
  const y1 = i * 20, y2 = (i + 1) * 20;
  const poly = (edge) => [[edge, y1], top, bottom, [edge, y2]].map(([x, y]) => `${x}% ${y}%`).join(",");
  const lift = 4 - i; // higher shards have further to fall
  return [
    { clip: poly(0), side: -1, x: -14 - i * 7, y: lift * 11, r: -38 - i * 27 },
    { clip: poly(100), side: 1, x: 12 + i * 8, y: lift * 12, r: 44 + i * 21 },
  ];
});

export default function KingShatter({ x, y, src, colorClass, title, subtitle, done }) {
  return (
    <>
      <div className={"kingFx" + (done ? " done" : "")} aria-hidden="true"
        style={{ left: `${((x - 0.5) / 8) * 100}%`, top: `${((y - 0.5) / 8) * 100}%` }}>
        {SHARDS.map((shard, i) => (
          <img key={i} src={src} alt="" className={"pc kingShard " + colorClass} style={{
            clipPath: `polygon(${shard.clip})`,
            "--split": `${shard.side * 7}%`, "--x": `${shard.x}%`, "--y": `${shard.y}%`, "--r": `${shard.r}deg`,
            animationDelay: `${1.45 + i * 0.03}s`,
          }} />
        ))}
        <svg className="kingCrack" viewBox="0 0 100 100" preserveAspectRatio="none">
          {crackLine(points, "glow main")}
          {crackLine(points, "core main")}
          {BRANCHES.map((b, i) => crackLine(b, "glow branch", `g${i}`))}
          {BRANCHES.map((b, i) => crackLine(b, "core branch", `c${i}`))}
        </svg>
      </div>
      {!done && (
        <div className="mateBanner" role="status">
          <strong>{title}</strong>
          <span>{subtitle}</span>
        </div>
      )}
    </>
  );
}
