import { useEffect, useRef, useState } from "react";
import { SHOTS, FIRST, finish, W, H } from "./opening/film";
import { play as playSound, playMusic, stopMusic, setFlies, setWind, setScore } from "./sound";

/* Which code-made music goes under each shot (until a real track is added):
   wonder while the pieces wake and ask, action from the bond to the end. */
/* Cutscene music by shot: the old owner's story is sad, the bin is dark
   and quiet, the waking is wonder, a refusal is dread, the bond is action. */
const scoreFor = (shot) => (/^duel|^bonded$|^arenaIn$|^finale$/.test(shot) ? "action"
  : /^awaken$|^ask1$|^huddle$|^beg$|^ask2$/.test(shot) ? "wonder"
  : /^refused$/.test(shot) ? "dread"
  : /^attic$|^found$|^hands$|^carry$|^toss$/.test(shot) ? "sorrow"
  : null);
import { BrassButton } from "./ui";

/* The opening, as a 2D film drawn on one canvas (opening/film.js holds the
   shots, opening/draw.js the characters and effects). This plays it: runs
   the clock, fires each shot's sounds, shows the narrator's lines as
   subtitles (voices aren't recorded yet), and stops at the two questions.

   `onDone(answer)` gets "yes", "refused", or null if it was skipped. Skip is
   offered only when `skippable` (a rewatch). A tap moves a narrator's line
   on. */
export default function OpeningScene({ skippable = false, onDone }) {
  const canvasRef = useRef(null);
  const [stage, setStage] = useState("title"); // title | playing
  const [line, setLine] = useState(null); // { text, who }
  const [question, setQuestion] = useState(null); // { again, answer(yes) }
  const hurryRef = useRef(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    if (stage !== "playing") return undefined;
    const canvas = canvasRef.current, ctx = canvas.getContext("2d");
    /* The film's own music, if a track has been added; no flies over it. */
    setFlies(false);
    playMusic("opening", { loop: true });
    let id = FIRST, began = performance.now(), fired = 0, over = false, asked = false, shown = null, frame = 0;
    const filmBegan = began;
    const go = (next) => { id = next; began = performance.now(); fired = 0; asked = false; setScore(scoreFor(next)); const w = !!SHOTS[next]?.wind; if (w !== windOn) { windOn = w; setWind(w, SHOTS[next]?.wind ?? 0); } };
    let windOn = false;
    const end = (answer) => { if (over) return; over = true; doneRef.current(answer); };
    /* A tap jumps to the shot's next beat (the next narrator line). */
    hurryRef.current = () => {
      const shot = SHOTS[id], lt = (performance.now() - began) / 1000;
      const beat = shot.beats?.find((at) => at > lt + 0.4);
      if (beat != null && lt > (shot.beats[0] ?? 0)) began -= (beat - lt) * 1000;
    };
    /* For checking a shot while building: jump to it, or hold it at a time. */
    if (import.meta.env.DEV) window.__opening = { go, hold: (shot, at) => { go(shot); began = performance.now() - at * 1000; window.__openingHold = at; }, free: () => { window.__openingHold = null; } };

    const draw = (now) => {
      if (over) return;
      frame = requestAnimationFrame(draw);
      if (import.meta.env.DEV && window.__openingHold != null) began = now - window.__openingHold * 1000;
      const shot = SHOTS[id], lt = (now - began) / 1000;
      /* The picture fills the screen, keeping its shape (the sides are cut
         on a wide screen, never stretched). */
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cw = canvas.clientWidth, ch = canvas.clientHeight;
      if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) { canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr); }
      const scale = Math.max(cw / W, ch / H) * dpr;
      ctx.setTransform(scale, 0, 0, scale, (canvas.width - W * scale) / 2, (canvas.height - H * scale) / 2);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      const drawStart = import.meta.env.DEV ? performance.now() : 0;
      shot.draw(ctx, lt);
      finish(ctx, (now - filmBegan) / 1000);
      /* While building: how long each shot takes to draw, to catch stutters. */
      if (import.meta.env.DEV) {
        const st = (window.__openingStats ??= {})[id] ??= { frames: 0, total: 0, worst: 0, at: 0 };
        const took = performance.now() - drawStart;
        st.frames++; st.total += took;
        if (took > st.worst) { st.worst = took; st.at = Math.round(lt * 100) / 100; }
      }

      while (shot.cues && fired < shot.cues.length && lt >= shot.cues[fired][0]) { const [, name, volume] = shot.cues[fired++]; playSound(name, { volume }); }
      const say = shot.line?.(lt) ?? null;
      if ((say?.text ?? null) !== shown) { shown = say?.text ?? null; setLine(say); }
      if (shot.wait) {
        if (!asked) { asked = true; setQuestion({ again: !!shot.again, answer: (yes) => { setQuestion(null); go(yes ? shot.next : shot.no); } }); }
      } else if (lt >= shot.dur) {
        if (shot.end) end(shot.end);
        else go(shot.next);
      }
    };
    frame = requestAnimationFrame(draw);
    return () => { over = true; cancelAnimationFrame(frame); hurryRef.current = null; stopMusic(1.5); setScore(null); setWind(false); setFlies(true); };
  }, [stage]);

  return (
    <div className="relative mx-auto w-full max-w-[480px] overflow-hidden bg-black" style={{ height: "calc(100dvh - var(--headerH))" }} onClick={() => hurryRef.current?.()}>
      <canvas ref={canvasRef} className="absolute inset-0 block size-full" aria-hidden="true" />
      {/* The film's bars. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[8%] bg-black" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[8%] bg-black" />

      {stage === "title" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-black p-6 text-center">
          <h1 className="tc-title m-0 text-[34px]">Chess Tactica</h1>
          <BrassButton onClick={() => setStage("playing")}>Begin</BrassButton>
          {skippable && <button type="button" className="tc-link" onClick={() => onDone(null)}>Skip the opening</button>}
        </div>
      )}

      {line && (
        <p key={line.text} role="status" className="tacticaNote absolute inset-x-6 bottom-[11%] m-0 text-center text-[18px] leading-snug text-[var(--tc-cream)]" style={{ fontFamily: "var(--tc-font-body)", fontStyle: line.who === "narrator" ? "italic" : "normal", textShadow: "0 2px 8px #000, 0 0 2px #000" }}>
          {line.text}
        </p>
      )}

      {question && (
        <div className="absolute inset-x-0 top-[12%] flex flex-col items-center gap-4 p-6 text-center" onClick={(e) => e.stopPropagation()}>
          <h2 className="tc-title m-0 text-[28px]" style={{ textShadow: "0 2px 12px #000, 0 0 3px #000" }}>Will you bond with us?</h2>
          <div className="flex w-full max-w-[320px] gap-3">
            <BrassButton className="flex-1" onClick={() => question.answer(true)}>Yes</BrassButton>
            <button type="button" className="tc-plank tc-center flex-1" onClick={() => question.answer(false)}>{question.again ? "Still no" : "No"}</button>
          </div>
        </div>
      )}

      {stage === "playing" && skippable && !question && (
        <button type="button" className="tc-link absolute top-[9%] right-3" onClick={(e) => { e.stopPropagation(); onDone(null); }}>Skip</button>
      )}
    </div>
  );
}
