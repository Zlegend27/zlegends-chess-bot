import { useEffect, useRef, useState } from "react";
import { play as playSound, setScore } from "./sound";
import { borrow, camera } from "./film3d/kit";
import { WORLD_FILMS, FILM_MOOD } from "./film3d/worldFilms";

/* A world's arrival film (and the ending), shot in 3D on the run's own
   scene: the world about to be played, its real boss, and the six heroes
   (film3d/worldFilms.js). No second 3D scene, so phones aren't asked to
   hold two at once. Over it: a letterbox, subtitles, flashes, speed lines
   and a fade, the same film grammar as the opening.

   It waits for the world's scenery to finish loading (`ready`), then takes
   the scene over; when it ends, or is tapped away, everything the film
   touched is put back and onDone is called. */
export default function EntryFilm({ world, sceneRef, setRef, ready, onDone }) {
  const [say, setSay] = useState(null);
  const [flash, setFlash] = useState(null);
  const [fade, setFade] = useState({ to: 1, s: 0 });
  const speedRef = useRef(false);
  const linesRef = useRef(null);
  const finished = useRef(false);
  const doneRef = useRef(null);
  doneRef.current = () => { if (finished.current) return; finished.current = true; onDone(); };
  const script = WORLD_FILMS[world];

  /* Nothing to show (or the scenery never loads): carry on. */
  useEffect(() => {
    if (!script) { doneRef.current(); return undefined; }
    const give = setTimeout(() => { if (!sceneRef.current) doneRef.current(); }, 12000);
    return () => clearTimeout(give);
  }, [script, sceneRef]);

  useEffect(() => {
    if (!script || !ready) return undefined;
    const scene = sceneRef.current, set = setRef.current;
    if (!scene || !set) return undefined;
    let alive = true;
    const lend = borrow(scene);
    setScore(FILM_MOOD[world] ?? null);
    const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));
    const f = {
      scene, set, lend,
      ...camera(scene),
      alive: () => alive,
      wait,
      shot: (name) => { if (import.meta.env.DEV) window.__filmShot = name; },
      score: (mood) => { if (alive) setScore(mood); },
      speed: (on) => { speedRef.current = !!on; },
      line: async (text, secs) => { if (!alive) return; setSay(text); await wait(secs); if (alive) setSay((now) => (now === text ? null : now)); },
      impact: async (heavy = false) => {
        if (!alive) return;
        setFlash("white"); await wait(heavy ? 0.07 : 0.05);
        setFlash("black"); await wait(heavy ? 0.06 : 0.04);
        setFlash(null);
      },
      fade: async (to, s) => { if (!alive) return; setFade({ to, s }); await wait(s); },
    };
    (async () => {
      await wait(0.1);
      if (!alive) return;
      setFade({ to: 0, s: 0.9 });
      try { await script(f); } catch (e) { console.error("world film", e); }
      if (alive) doneRef.current();
    })();

    /* Speed lines over the picture. */
    let frame = 0;
    const lines = () => {
      frame = requestAnimationFrame(lines);
      const c = linesRef.current;
      if (!c) return;
      const g = c.getContext("2d"), w = (c.width = c.clientWidth), h = (c.height = c.clientHeight);
      g.clearRect(0, 0, w, h);
      if (!speedRef.current) return;
      g.strokeStyle = "rgba(255,255,255,0.5)";
      for (let i = 0; i < 46; i++) {
        const a = Math.random() * Math.PI * 2, r0 = Math.max(w, h) * (0.28 + Math.random() * 0.12), r1 = Math.max(w, h) * 0.9;
        g.lineWidth = 0.8 + Math.random() * 2.2;
        g.beginPath();
        g.moveTo(w / 2 + Math.cos(a) * r0, h / 2 + Math.sin(a) * r0);
        g.lineTo(w / 2 + Math.cos(a) * r1, h / 2 + Math.sin(a) * r1);
        g.stroke();
      }
    };
    frame = requestAnimationFrame(lines);
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      setScore(null);
      try { set.monster?.rest?.(); } catch { /* gone */ }
      try { lend.giveBack(); } catch { /* scene gone */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [script, ready]);

  const skip = () => { playSound("tap", { volume: 0.4 }); doneRef.current(); };
  return (
    <button type="button" className="absolute inset-0 z-30 block cursor-default appearance-none overflow-hidden border-0 bg-transparent p-0" onClick={skip} aria-label="Skip the film">
      <canvas ref={linesRef} className="pointer-events-none absolute inset-0 block size-full" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0" style={{ background: "#000", opacity: fade.to, transition: `opacity ${fade.s}s ease` }} aria-hidden="true" />
      {/* Letterbox: a film, not the game. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[9%]" style={{ background: "#000" }} aria-hidden="true" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[9%]" style={{ background: "#000" }} aria-hidden="true" />
      {flash && <div className="pointer-events-none absolute inset-0" style={{ background: flash === "white" ? "#fff" : "#000" }} aria-hidden="true" />}
      {say && (
        <span className="pointer-events-none absolute inset-x-6 bottom-[calc(10%+1.2rem)] text-center text-base italic text-[var(--tc-cream)]" style={{ textShadow: "0 2px 6px #000, 0 0 12px #000" }}>{say}</span>
      )}
      <span className="pointer-events-none absolute right-4 bottom-[calc(3%+env(safe-area-inset-bottom))] text-xs text-[var(--tc-cream-dim)]">Tap to skip</span>
    </button>
  );
}
