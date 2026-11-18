import { useCallback, useEffect, useRef, useState } from "react";
import PixelAvatar, { ZPAL, ZPIX } from "../components/PixelAvatar";

/* Chess Tactica's loading screen: Zlegend's pixel icon on dark wood, the
   name, and three brass beads. It stands in while Tactica's code downloads
   (the site shows it as the fallback) and while each mode builds its 3D
   world (TacticaPage). Self-contained styles, since it can show before
   tactica.css has loaded. Needs no three.js, so the site can import it. */
const STYLE = `
@keyframes tcl-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
@keyframes tcl-bead { 0%, 100% { opacity: 0.25; transform: scale(0.8); } 40% { opacity: 1; transform: scale(1); } }
@keyframes tcl-glow { 0%, 100% { opacity: 0.35; } 50% { opacity: 0.6; } }
@media (prefers-reduced-motion: reduce) { .tcl-anim { animation: none !important; } }
`;

export default function TacticaLoading({ visible = true, label = "Chess Tactica" }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading Chess Tactica"
      style={{
        position: "absolute", inset: 0, zIndex: 60, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18,
        background: "radial-gradient(circle at 50% 42%, #2a1a10 0%, #120b07 62%, #080504 100%)",
        /* Not quite opaque, so the scene behind is never hidden outright (see
           EntryFilm: uncovering a hidden 3D canvas costs a long frame). */
        opacity: visible ? 0.985 : 0, transition: visible ? "none" : "opacity 320ms ease", pointerEvents: visible ? "auto" : "none",
      }}
    >
      <style>{STYLE}</style>
      <div style={{ position: "relative", width: 112, height: 112, display: "grid", placeItems: "center" }}>
        {/* A warm glow behind him, and a brass ring like the game's round buttons. */}
        <div className="tcl-anim" style={{ position: "absolute", inset: -18, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,190,110,0.45), rgba(255,190,110,0) 70%)", animation: "tcl-glow 2.4s ease-in-out infinite" }} />
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "radial-gradient(circle at 35% 30%, #6b3c1b, #3b200e)", boxShadow: "inset 0 0 0 3px #c9a45a, 0 6px 16px rgba(0,0,0,0.55)" }} />
        <div className="tcl-anim" style={{ position: "relative", animation: "tcl-bob 1.6s ease-in-out infinite", imageRendering: "pixelated" }}>
          <PixelAvatar rows={ZPIX} pal={ZPAL} size={72} />
        </div>
      </div>
      <div style={{ fontFamily: '"Cinzel", Georgia, serif', fontWeight: 900, letterSpacing: "0.06em", fontSize: 20, color: "#f6e2b8", textShadow: "0 2px 6px #000" }}>{label}</div>
      <div style={{ display: "flex", gap: 8 }} aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span key={i} className="tcl-anim" style={{ width: 8, height: 8, borderRadius: "50%", background: "#e7c27a", boxShadow: "0 0 6px rgba(231,194,122,0.7)", animation: `tcl-bead 1.1s ease-in-out ${i * 0.18}s infinite` }} />
        ))}
      </div>
    </div>
  );
}

/** The loading screen around a change of mode. Building a mode's 3D world
 *  holds the page up for a moment, so the screen goes up FIRST: `go(then)`
 *  shows it, waits until it has actually been drawn (two frames), and only
 *  then runs `then` (the change of mode). It comes down once the new scene
 *  draws its first picture (the "tactica-frame" event, scene.js), after at
 *  least `minMs` and at most `maxMs`. A mode with no 3D world (the opening
 *  film) passes `flat` and gets no wait. Also up on first load. */
export function useVeil({ minMs = 450, maxMs = 6000 } = {}) {
  const [visible, setVisible] = useState(true);
  const armRef = useRef(null);
  const arm = useCallback((flat = false) => {
    armRef.current?.();
    const started = performance.now();
    let done = false;
    const finish = () => { if (done) return; done = true; cleanup(); setVisible(false); };
    const later = () => setTimeout(finish, Math.max(0, minMs - (performance.now() - started)));
    const onFrame = () => later();
    window.addEventListener("tactica-frame", onFrame, { once: true });
    const cap = setTimeout(finish, flat ? minMs : maxMs);
    const cleanup = () => { window.removeEventListener("tactica-frame", onFrame); clearTimeout(cap); };
    armRef.current = cleanup;
    if (flat) later();
  }, [minMs, maxMs]);
  const go = useCallback((then, flat = false) => {
    setVisible(true);
    requestAnimationFrame(() => requestAnimationFrame(() => { then(); arm(flat); }));
  }, [arm]);
  useEffect(() => () => armRef.current?.(), []);
  return { visible, go, arm };
}
