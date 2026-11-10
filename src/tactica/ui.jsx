import { useEffect, useRef } from "react";
import MiniBoard from "../components/MiniBoard";
import { cburnettPieceSvgUrl } from "../utils/cburnettPieceSvg";
import { SET_BOARD } from "./scene";

/* Tactica's shared controls, in the carved wood and brass look of
   tactica.css. Every screen uses these, so they stay the same everywhere. */

/** The one primary action on a screen: a brass button. */
export function BrassButton({ children, className = "", ...props }) {
  return (
    <button type="button" className={"tc-brass " + className} {...props}>
      <span className="tc-edge" aria-hidden="true" />
      <span className="tc-face">{children}</span>
    </button>
  );
}

/** The round button that opens a screen's game menu. */
export function MenuButton({ open, onClick }) {
  return (
    <button type="button" data-tactica-hud className="tc-round pointer-events-auto" onClick={onClick} aria-label="Game menu" aria-expanded={open}>
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 6h16v2.2H4zM4 10.9h16v2.2H4zM4 15.8h16V18H4z" /></svg>
    </button>
  );
}

/** A brass coin with a chess piece on it (engine type 1..6). */
export function Medal({ type }) {
  return <span className="tc-medal" aria-hidden="true"><img src={cburnettPieceSvgUrl(type, false)} alt="" /></span>;
}

/* Dragging across the map turns the view this much per pixel. */
const MAP_TURN_PER_PX = 0.012, MAP_DRAG_PX = 6;
/* The view cone's colour (the game's highlight cyan). */
const CONE = "#3EE7F5";

/** What the camera sees, passed from the scene to the map as it moves:
 *  `set` takes the scene's report (TacticaScene.reportView) and the map
 *  draws it straight away, without re-rendering the screen every frame. */
export function useViewSource() {
  const ref = useRef(null);
  if (!ref.current) {
    const listeners = new Set();
    let value = null;
    ref.current = {
      set: (v) => { value = v; listeners.forEach((fn) => fn(v)); },
      subscribe: (fn) => { listeners.add(fn); fn(value); return () => listeners.delete(fn); },
    };
  }
  return ref.current;
}

/** The map of the board: always a normal diagram with your side at the
 *  bottom, never turned or squeezed, with the part of the board on screen
 *  lit up and a marker where the camera stands, pointing the way it looks
 *  (`viewSource`, live), and a ring on the selected character (`selected`,
 *  a square 0..63, a1 = 0).
 *  Tap it to switch between the whole board and the close view; in the
 *  close view, drag across it to turn the view (`onSpin(angle)`). */
export function MapButton({ fen, pieceImgSrc, size = 96, flipped, view, selected = null, viewSource, locked = false, onToggle, onSpin }) {
  const dragRef = useRef(null);
  const coneRef = useRef(null);
  const markRef = useRef(null);
  const clipId = useRef(`tc-map-${Math.random().toString(36).slice(2)}`).current;

  /* Board x, z (the scene's units: the board runs from -4 to 4 on both,
     your side at +z) to map pixels. The scene already lays the board out
     from your side, flipped or not, just as the diagram is drawn. */
  const toMap = (x, z) => [((x + 4) / 8) * size, ((z + 4) / 8) * size];

  useEffect(() => viewSource?.subscribe((v) => {
    const cone = coneRef.current, mark = markRef.current;
    if (!cone || !mark) return;
    /* The whole board in view: no cone needed. */
    const show = !!v && !v.whole;
    cone.style.display = mark.style.display = show ? "" : "none";
    if (!show) return;
    cone.style.display = v.area.length >= 3 ? "" : "none";
    if (v.area.length >= 3) cone.setAttribute("d", "M" + v.area.map((q) => toMap(q.x, q.z).map((n) => n.toFixed(1)).join(" ")).join("L") + "Z");
    /* The camera: where it stands, or on the edge nearest it when it stands
       off the board, pointing the way it looks. */
    const [cx, cy] = toMap(v.cam.x, v.cam.z), [lx, ly] = toMap(v.look.x, v.look.z);
    let dx = lx - cx, dy = ly - cy;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    const lo = 4, hi = size - 4;
    const mx = Math.min(hi, Math.max(lo, cx)), my = Math.min(hi, Math.max(lo, cy));
    const pts = [[mx + dx * 5, my + dy * 5], [mx - dx * 3 - dy * 4, my - dy * 3 + dx * 4], [mx - dx * 3 + dy * 4, my - dy * 3 - dx * 4]];
    mark.setAttribute("points", pts.map((q) => q.map((n) => n.toFixed(1)).join(",")).join(" "));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [viewSource, size]);

  const down = (e) => {
    dragRef.current = { id: e.pointerId, x: e.clientX, moved: false };
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* the pointer is already gone */ }
  };
  const move = (e) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== e.pointerId || locked) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) < MAP_DRAG_PX) return;
    drag.moved = true;
    drag.x = e.clientX;
    if (view === "close") onSpin?.(dx * MAP_TURN_PER_PX);
  };
  const up = () => { setTimeout(() => { dragRef.current = null; }, 0); };
  const click = () => { if (!dragRef.current?.moved && !locked) onToggle?.(); };
  /* The selected square on the diagram, the same way round as the board. */
  const ring = selected != null && view === "close" ? (() => {
    const file = selected % 8, rank = (selected / 8) | 0, cell = size / 8;
    const col = flipped ? 7 - file : file, row = flipped ? rank : 7 - rank;
    return { x: col * cell, y: row * cell, cell };
  })() : null;
  return (
    <button
      type="button"
      data-tactica-hud
      onClick={click}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      disabled={locked}
      aria-label={locked ? "Map locked by the No map challenge" : view === "board" ? "Back to the close view" : "Show the whole board"}
      title={locked ? undefined : view === "close" ? "Tap to see the whole board, drag to turn the view" : "Tap to go back to the close view"}
      aria-pressed={view === "board"}
      className="tc-frame pointer-events-auto shrink-0 touch-none"
    >
      <div className="relative" style={{ width: size, height: size }}>
        <MiniBoard fen={fen} colors={SET_BOARD} pieceImgSrc={pieceImgSrc} size={size} flipped={flipped} label="Map of the board" />
        <svg className="pointer-events-none absolute inset-0" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
          <defs>
            <clipPath id={clipId}><rect width={size} height={size} rx="8" /></clipPath>
          </defs>
          <g clipPath={`url(#${clipId})`}>
            <path ref={coneRef} fill={CONE} fillOpacity="0.12" stroke={CONE} strokeOpacity="0.9" strokeWidth="1.25" strokeLinejoin="round" style={{ display: "none" }} />
            {ring && <rect x={ring.x + 0.75} y={ring.y + 0.75} width={ring.cell - 1.5} height={ring.cell - 1.5} rx="2" fill="none" stroke={CONE} strokeWidth="1.5" />}
            <polygon ref={markRef} fill="#fff6e6" stroke="#2a1608" strokeWidth="1" strokeLinejoin="round" style={{ display: "none" }} />
          </g>
        </svg>
      </div>
    </button>
  );
}
