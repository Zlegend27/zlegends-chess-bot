import { useRef } from "react";
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
    <button type="button" className="tc-round pointer-events-auto" onClick={onClick} aria-label="Game menu" aria-expanded={open}>
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

/** The map of the board. Tap it to switch between the whole board and the
 *  close view; in the close view, drag across it to turn the view
 *  (`onSpin(angle)`). It turns with the view like a compass. */
export function MapButton({ fen, pieceImgSrc, size = 96, flipped, view, turn = 0, locked = false, onToggle, onSpin }) {
  const dragRef = useRef(null);
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
  return (
    <button
      type="button"
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
      {/* Shrunk while at an angle so its corners stay inside the frame. */}
      <div style={{ transform: `rotate(${turn}rad) scale(${1 / (Math.abs(Math.cos(turn)) + Math.abs(Math.sin(turn)))})`, transition: "transform .2s ease" }}>
        <MiniBoard fen={fen} colors={SET_BOARD} pieceImgSrc={pieceImgSrc} size={size} flipped={flipped} label="Map of the board" />
      </div>
    </button>
  );
}
