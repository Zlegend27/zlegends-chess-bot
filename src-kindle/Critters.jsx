import { useEffect, useRef, useState } from "react";

/* Purely decorative background critters — kids tap them to make them
   "poof" away, then a new one wanders in later at a random spot after a
   random delay. Absolutely positioned within kRoot (which needs
   position:relative), z-indexed behind every real control so it never
   steals a click meant for the board or buttons. */
const KINDS = ["🐝", "🦋", "🐞", "🐢", "🐸", "🐦"];
const MIN_DELAY_MS = 4000;
const MAX_DELAY_MS = 14000;
const MAX_ON_SCREEN = 3;

function randomCritter(id) {
  return {
    id,
    kind: KINDS[(Math.random() * KINDS.length) | 0],
    left: 4 + Math.random() * 90,
    top: 6 + Math.random() * 88,
    poofing: false,
  };
}

export default function Critters() {
  const [critters, setCritters] = useState([]);
  const nextId = useRef(0);
  const timersRef = useRef([]);

  useEffect(() => {
    const scheduleSpawn = () => {
      const delay = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);
      const t = setTimeout(() => {
        setCritters(cur => {
          if (cur.length >= MAX_ON_SCREEN) return cur;
          return [...cur, randomCritter(nextId.current++)];
        });
        scheduleSpawn();
      }, delay);
      timersRef.current.push(t);
    };
    scheduleSpawn();
    return () => timersRef.current.forEach(clearTimeout);
  }, []);

  const poof = (id) => {
    setCritters(cur => cur.map(c => c.id === id ? { ...c, poofing: true } : c));
    setTimeout(() => setCritters(cur => cur.filter(c => c.id !== id)), 260);
  };

  return (
    <div className="kCritters" aria-hidden="true">
      {critters.map(c => (
        <button
          key={c.id}
          className={"kCritter" + (c.poofing ? " kCritterPoof" : "")}
          style={{ left: `${c.left}%`, top: `${c.top}%` }}
          onClick={() => poof(c.id)}
          tabIndex={-1}
        >{c.kind}</button>
      ))}
    </div>
  );
}
