import { useMemo } from "react";

function makeStars(count) {
  const stars = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      left: Math.random() * 100,
      top: Math.random() * 100,
      size: 1 + Math.random() * 1.8,
      delay: Math.random() * 4,
      duration: 2 + Math.random() * 3,
    });
  }
  return stars;
}

export default function StarField({ count = 45 }) {
  const stars = useMemo(() => makeStars(count), [count]);
  return (
    <div className="starField">
      {stars.map((s, i) => (
        <span
          key={i}
          className="star"
          style={{
            left: s.left + "%",
            top: s.top + "%",
            width: s.size + "px",
            height: s.size + "px",
            animationDelay: s.delay + "s",
            animationDuration: s.duration + "s",
          }}
        />
      ))}
    </div>
  );
}
