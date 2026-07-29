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

/* Sweetheart's own ambience -- hearts, bows, and little four-point
   twinkles instead of plain star dots, cycling through her rose/gold/teal
   accents. Sized larger than the star dots (a 1-2px heart isn't
   recognizable as one) and fewer of them, since a shape this size at
   45-particle density would read as clutter rather than atmosphere. */
const HEART_D = "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z";
const TWINKLE_D = "M12 1 14.2 9.8 23 12 14.2 14.2 12 23 9.8 14.2 1 12 9.8 9.8Z";
const SWEETHEART_SHAPES = [
  { color: "#F06BAE", render: () => <path d={HEART_D} /> },
  { color: "#F5D95E", render: () => (<><path d="M12 12 4 6v12z" /><path d="M12 12 20 6v12z" /><circle cx="12" cy="12" r="1.6" /></>) },
  { color: "#7FD8C4", render: () => <path d={TWINKLE_D} /> },
];

function makeSweetheartParticles(count) {
  const particles = [];
  for (let i = 0; i < count; i++) {
    particles.push({
      left: Math.random() * 100,
      top: Math.random() * 100,
      size: 7 + Math.random() * 9,
      delay: Math.random() * 4,
      duration: 2.5 + Math.random() * 3,
      shape: SWEETHEART_SHAPES[(Math.random() * SWEETHEART_SHAPES.length) | 0],
    });
  }
  return particles;
}

export default function StarField({ count = 45, sweetheart }) {
  const stars = useMemo(() => makeStars(count), [count]);
  const particles = useMemo(() => makeSweetheartParticles(Math.round(count * 0.55)), [count]);

  if (sweetheart) {
    return (
      <div className="starField" aria-hidden="true">
        {particles.map((p, i) => (
          <svg
            key={i}
            viewBox="0 0 24 24"
            className="sparkle"
            style={{
              left: p.left + "%",
              top: p.top + "%",
              width: p.size + "px",
              height: p.size + "px",
              animationDelay: p.delay + "s",
              animationDuration: p.duration + "s",
              fill: p.shape.color,
            }}
          >
            {p.shape.render()}
          </svg>
        ))}
      </div>
    );
  }

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
