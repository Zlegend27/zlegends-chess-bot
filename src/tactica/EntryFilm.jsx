import { useEffect, useRef, useState } from "react";
import { ENTRY_FILMS, finish, W, H } from "./opening/entries";
import { play as playSound, setScore, setWind } from "./sound";

/* Plays a world's arrival film (opening/entries.js) over the run, then
   calls onDone. A tap anywhere skips it. Music made in code plays under it
   until real tracks are added. */
export default function EntryFilm({ world, onDone }) {
  const canvasRef = useRef(null);
  const [line, setLine] = useState(null);
  /* Done only once, whether the film ends or is tapped away at the same moment. */
  const finished = useRef(false);
  const doneRef = useRef(null);
  doneRef.current = () => { if (finished.current) return; finished.current = true; onDone(); };
  const film = ENTRY_FILMS[world];

  useEffect(() => {
    if (!film) { doneRef.current(); return undefined; }
    const canvas = canvasRef.current, ctx = canvas.getContext("2d");
    let id = film.first, began = performance.now(), fired = 0, over = false, frame = 0, shown = null;
    const filmBegan = began;
    setScore(film.mood);
    const end = () => { if (over) return; over = true; doneRef.current(); };
    const draw = (now) => {
      if (over) return;
      frame = requestAnimationFrame(draw);
      const shot = film.shots[id], lt = (now - began) / 1000;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cw = canvas.clientWidth, ch = canvas.clientHeight;
      if (!cw || !ch) return;
      if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) { canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr); }
      const scale = Math.max(cw / W, ch / H) * dpr;
      ctx.setTransform(scale, 0, 0, scale, (canvas.width - W * scale) / 2, (canvas.height - H * scale) / 2);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      shot.draw(ctx, lt);
      /* A short fade between shots. */
      const fadeIn = Math.min(1, lt / 0.35), fadeOut = Math.min(1, (shot.dur - lt) / 0.35);
      const dark = 1 - Math.min(fadeIn, fadeOut);
      if (dark > 0) { ctx.fillStyle = `rgba(0,0,0,${dark})`; ctx.fillRect(-50, -50, W + 100, H + 100); }
      finish(ctx, (now - filmBegan) / 1000);
      while (shot.cues && fired < shot.cues.length && lt >= shot.cues[fired][0]) {
        const [, name, volume] = shot.cues[fired++];
        if (name === "wind") setWind(true, volume);
        else playSound(name, { volume });
      }
      const say = shot.line?.(lt)?.text ?? null;
      if (say !== shown) { shown = say; setLine(say); }
      if (lt >= shot.dur) {
        if (shot.end) end();
        else { id = shot.next; began = now; fired = 0; }
      }
    };
    frame = requestAnimationFrame(draw);
    return () => { over = true; cancelAnimationFrame(frame); setScore(null); setWind(false); };
  }, [film]);

  return (
    <button type="button" className="absolute inset-0 z-30 block cursor-default appearance-none border-0 bg-black p-0" onClick={() => doneRef.current()} aria-label="Skip the film">
      <canvas ref={canvasRef} className="absolute inset-0 block size-full" />
      {line && (
        <span className="pointer-events-none absolute inset-x-6 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] text-center text-base italic text-[var(--tc-cream)]" style={{ textShadow: "0 2px 6px #000, 0 0 12px #000" }}>{line}</span>
      )}
      <span className="pointer-events-none absolute right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] text-xs text-[var(--tc-cream-dim)]">Tap to skip</span>
    </button>
  );
}
