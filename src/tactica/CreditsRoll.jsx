import { useEffect, useRef, useState } from "react";
import { WORLDS } from "./worlds";

/* The credits, rolled after the ending film when the story is beaten. The
   music is the "triumph" mood (RunMode picks it for this stage). A tap ends
   it early; it also ends by itself once the last line has gone by. */
const ROLL_SECONDS = 42;

const SECTIONS = [
  { title: "Created by", lines: ["Zlegend2700"] },
  { title: "Your team", lines: ["The pawns", "The knights", "The bishops", "The rooks", "The queen", "The king", "and you"] },
  { title: "The bosses", lines: WORLDS.map((w) => w.boss).filter(Boolean) },
  { title: "The games they remembered", lines: ["Paul Morphy", "Adolf Anderssen", "Richard Réti", "Bobby Fischer", "Edward Lasker", "Fernando Saavedra", "François-André Philidor", "Luis Ramírez de Lucena"] },
  { title: "Models", lines: ["Polar bear by kenchoo", "Pizza by gatoperdido", "Demon lord by Pigcraft", "Fire dragon by na3ee1", "(CC BY 4.0)"] },
  { title: "Music by", lines: ["Matthew Pablo", "www.matthewpablo.com", "(CC BY 3.0)"] },
  { title: "Textures, skies and props", lines: ["Poly Haven", "ambientCG"] },
  { title: "Puzzles", lines: ["The Lichess puzzle database"] },
  { title: "Bots", lines: ["Stockfish"] },
];

export default function CreditsRoll({ onDone }) {
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const finished = useRef(false);
  const finish = () => { if (finished.current) return; finished.current = true; doneRef.current(); };
  const [canSkip, setCanSkip] = useState(false);
  const reduced = typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  useEffect(() => {
    const skip = setTimeout(() => setCanSkip(true), 1200);
    const end = setTimeout(finish, (reduced ? 12 : ROLL_SECONDS) * 1000);
    return () => { clearTimeout(skip); clearTimeout(end); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <button
      type="button"
      className="absolute inset-0 z-30 block cursor-default appearance-none overflow-hidden border-0 bg-black p-0 text-center"
      onClick={() => { if (canSkip) finish(); }}
      aria-label="Credits. Tap to skip"
    >
      <div
        className={reduced ? "tc-credits-still" : "tc-credits-roll"}
        style={reduced ? undefined : { animationDuration: `${ROLL_SECONDS}s` }}
      >
        <h2 className="tc-title m-0 text-[34px]">Chess Tactica</h2>
        {SECTIONS.map((s) => (
          <section key={s.title} className="mt-12">
            <p className="tc-label m-0">{s.title}</p>
            {s.lines.map((line) => <p key={line} className="m-0 mt-2 text-lg text-[var(--tc-cream)]">{line}</p>)}
          </section>
        ))}
        <p className="tc-title m-0 mt-20 text-[26px]">Thank you for playing</p>
      </div>
      {canSkip && <span className="pointer-events-none absolute right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] text-xs text-[var(--tc-cream-dim)]">Tap to skip</span>}
    </button>
  );
}
