import { useEffect, useRef, useState } from "react";
import { loadSetting, saveSetting } from "../utils/storage";
import MiniBoard from "../components/MiniBoard";
import { cburnettPieceSvgUrl } from "../utils/cburnettPieceSvg";
import { SET_BOARD } from "./scene";
import { soundOn, setSoundOn, onSoundChange, soundLevel, setSoundLevel, musicVolume, setMusicVolume, canVibrate, vibrateOn, setVibrateOn, buzz, play } from "./sound";

/* Tactica's shared controls, in the carved wood and brass look of
   tactica.css. Every screen uses these, so they stay the same everywhere. */

/* Back, one way for all of Tactica. Every screen or overlay that can be
   stepped out of registers how (useBackLayer); the newest open one wins.
   The phone's Back (through App's onPopState) and Escape both call
   backLayer(). Nothing registered: TacticaPage decides (the menu, then out). */
const layers = [];
/** While `active`, Back (or Escape) calls `onBack` instead of leaving. */
export function useBackLayer(active, onBack) {
  const ref = useRef(onBack);
  ref.current = onBack;
  useEffect(() => {
    if (!active) return undefined;
    const entry = { ref };
    layers.push(entry);
    return () => { const i = layers.indexOf(entry); if (i >= 0) layers.splice(i, 1); };
  }, [active]);
}
/** Steps back one layer; false if nothing was open to step out of. */
export function backLayer() {
  const top = layers[layers.length - 1];
  if (!top) return false;
  top.ref.current();
  return true;
}

/** The one primary action on a screen: a brass button. */
export function BrassButton({ children, className = "", ...props }) {
  return (
    <button type="button" className={"tc-brass " + className} {...props}>
      <span className="tc-edge" aria-hidden="true" />
      <span className="tc-face">{children}</span>
    </button>
  );
}

/** Which piece a pawn becomes: four planks over the board. `onPick` gets
 *  the engine piece type (5 queen, 4 rook, 3 bishop, 2 knight). */
const PROMOTIONS = [[5, "Queen"], [4, "Rook"], [3, "Bishop"], [2, "Knight"]];
export function PromotionPicker({ onPick, onCancel }) {
  return (
    <div className="tc-scrim absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 p-5" role="dialog" aria-label="Promote your pawn">
      <h2 className="tc-title m-0 text-2xl">Promote to</h2>
      <div className="grid w-full max-w-xs grid-cols-2 gap-2.5">
        {PROMOTIONS.map(([type, name]) => (
          <button key={type} type="button" className="tc-plank tc-small" onClick={() => onPick(type)}>
            <Medal type={type} />{name}
          </button>
        ))}
      </div>
      <button type="button" className="tc-link" onClick={onCancel}>Cancel</button>
    </div>
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
    /* On a touch screen the view turns with two fingers on the board instead
       (hold the character, slide a second finger), so the map only switches
       views there; a mouse can still drag it to turn. */
    dragRef.current = { id: e.pointerId, x: e.clientX, moved: false, touch: e.pointerType === "touch" };
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* the pointer is already gone */ }
  };
  const move = (e) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== e.pointerId || locked || drag.touch) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) < MAP_DRAG_PX) return;
    drag.moved = true;
    drag.x = e.clientX;
    if (view === "close") onSpin?.(dx * MAP_TURN_PER_PX);
  };
  const up = () => { setTimeout(() => { dragRef.current = null; }, 0); };
  const click = () => {
    if (dragRef.current?.moved || locked) return;
    onToggle?.();
    try { window.dispatchEvent(new CustomEvent("tactica-map")); } catch { /* no window */ }
  };
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

/* Small hints that teach a control until it has been used a few times
   (counted on the device), shown only on phones. Each listens for its own
   event from the scene or the map:
     swipe  "tactica-swipe"  switching characters by swiping
     map    "tactica-map"    tapping the map for the whole board
     turn   "tactica-turn"   turning the view with a second finger
   Only one shows at a time: the game passes `show` for the one that fits
   the moment (see LearnHints). */
/* Touch glyphs drawn in the game's cream, not emoji: a fingertip with a
   two-way arrow (swipe), a fingertip with a ripple (tap), and two
   fingertips with a turning arrow (turn). */
const Glyph = ({ kind }) => (
  <svg width="26" height="20" viewBox="0 0 26 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    {kind === "swipe" && <>
      <circle cx="13" cy="10" r="3.4" fill="currentColor" stroke="none" />
      <path d="M2 10h5M2 10l2.4-2.4M2 10l2.4 2.4M24 10h-5M24 10l-2.4-2.4M24 10l-2.4 2.4" />
    </>}
    {kind === "map" && <>
      <circle cx="13" cy="10" r="3.2" fill="currentColor" stroke="none" />
      <circle cx="13" cy="10" r="6.6" opacity="0.6" />
      <circle cx="13" cy="10" r="9.4" opacity="0.3" />
    </>}
    {kind === "turn" && <>
      <circle cx="7" cy="13" r="2.8" fill="currentColor" stroke="none" />
      <circle cx="19" cy="13" r="2.8" fill="currentColor" stroke="none" />
      <path d="M6 5.5a9 6 0 0 1 14 0M20 5.5l-0.4-3M20 5.5l-3 0.6" />
    </>}
  </svg>
);
const HINTS = {
  swipe: { key: "tacticaSwipesLearned", event: "tactica-swipe", needed: 3, text: "Swipe left or right to switch characters", hand: "tc-swipe-hand" },
  map: { key: "tacticaMapLearned", event: "tactica-map", needed: 2, text: "Tap the map for the whole board", hand: "tc-tap-hand" },
  turn: { key: "tacticaTurnLearned", event: "tactica-turn", needed: 1, text: "Hold one finger down, slide a 2nd to turn", hand: "tc-swipe-hand" },
};
const isTouch = () => typeof window !== "undefined" && !!window.matchMedia?.("(pointer: coarse)").matches;

function useLearned(id) {
  const h = HINTS[id];
  const [count, setCount] = useState(() => Number(loadSetting(h.key, 0)) || 0);
  useEffect(() => {
    if (count >= h.needed) return undefined;
    const on = () => setCount((n) => { const next = n + 1; saveSetting(h.key, next); return next; });
    window.addEventListener(h.event, on);
    return () => window.removeEventListener(h.event, on);
  }, [count, h]);
  return count >= h.needed;
}

/** The hints for a game screen, while up close on a character (`close`):
 *  swiping first, then the map, then turning the view. Phones only. */
export function LearnHints({ close }) {
  const swipe = useLearned("swipe"), map = useLearned("map"), turn = useLearned("turn");
  if (!close || !isTouch()) return null;
  const id = !swipe ? "swipe" : !map ? "map" : !turn ? "turn" : null;
  if (!id) return null;
  const h = HINTS[id];
  /* The map hint sits under the map in the top corner; the others over the
     bottom bar. */
  const where = id === "map" ? "top-[118px] right-3" : "inset-x-0 bottom-24 mx-auto";
  return (
    <div key={id} className={`tc-swipe-hint tc-panel pointer-events-none absolute ${where} flex w-max items-center gap-2 px-3 py-1.5 text-sm`} role="status">
      <span className={`${h.hand} text-[var(--tc-gold-hi)]`} aria-hidden="true"><Glyph kind={id} /></span>
      {h.text}
    </div>
  );
}

/** Recovery from a lost 3D context. Phones (iPhones especially) can drop a
 *  page's WebGL context under memory pressure, leaving the board black while
 *  the buttons still work. `onLost` (pass it to TacticaScene) waits a moment
 *  for the browser to give the context back; if it doesn't, `epoch` goes up.
 *  A mode keys its canvas on `epoch` (a lost canvas can't make a new
 *  context) and rebuilds its scene from its own game state, which is never
 *  touched. */
// eslint-disable-next-line no-unused-vars -- callers pass their scene; kept for a later check
export function useLostRebuild(sceneRef) {
  const [epoch, setEpoch] = useState(0);
  /* Always rebuilt, even if the phone hands the 3D back by itself: a
     handed-back context has lost its lighting, environment and effect
     buffers, and drew a black screen (seen on an iPhone, 2026-11-25). */
  const onLost = () => {
    setTimeout(() => setEpoch((n) => n + 1), 600);
  };
  return { epoch, onLost };
}

/** The settings cog (Tactica's menu, and every in-game menu). */
export function CogIcon({ size = 20 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96a7 7 0 0 0-1.62-.94l-.36-2.54a.48.48 0 0 0-.48-.41h-3.84a.48.48 0 0 0-.48.41l-.36 2.54c-.59.24-1.13.56-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L2.74 8.87a.48.48 0 0 0 .12.61l2.03 1.58c-.05.3-.07.63-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.49.49 0 0 0-.12-.61zM12 15.6a3.6 3.6 0 1 1 0-7.2 3.6 3.6 0 0 1 0 7.2z" /></svg>;
}

/** Sound, Volume, Music and Vibration: one panel for Tactica's menu and for
 *  every in-game menu, so they can be changed mid-game without leaving. */
export function SoundSettings() {
  const [sound, setSound] = useState(soundOn);
  const [volume, setVolume] = useState(() => Math.round(soundLevel() * 100));
  const [musicVol, setMusicVol] = useState(() => Math.round(musicVolume() * 100));
  const [vibes, setVibes] = useState(vibrateOn);
  useEffect(() => onSoundChange(setSound), []);
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="tc-display text-sm">Sound</span>
        <button type="button" className="tc-plank tc-center tc-small" style={{ width: 96 }} aria-pressed={sound} onClick={() => setSoundOn(!sound)}>{sound ? "On" : "Off"}</button>
      </div>
      <label className="flex items-center justify-between gap-3">
        <span className="tc-display text-sm">Volume</span>
        <input
          type="range" min="0" max="100" step="5" value={volume} disabled={!sound}
          className="tc-range flex-1" aria-valuetext={`${volume}%`}
          onChange={(e) => { const v = Number(e.target.value); setVolume(v); setSoundLevel(v / 100); }}
          onPointerUp={() => play("tap", { volume: 0.8 })}
        />
        <span className="w-10 text-right text-xs tabular-nums text-[var(--tc-cream-dim)]">{volume}%</span>
      </label>
      {/* Music on its own (under the main volume): some players want the
          hits and no music, or the other way round. */}
      <label className="flex items-center justify-between gap-3">
        <span className="tc-display text-sm">Music</span>
        <input
          type="range" min="0" max="100" step="5" value={musicVol} disabled={!sound}
          className="tc-range flex-1" aria-valuetext={`${musicVol}%`}
          onChange={(e) => { const v = Number(e.target.value); setMusicVol(v); setMusicVolume(v / 100); }}
        />
        <span className="w-10 text-right text-xs tabular-nums text-[var(--tc-cream-dim)]">{musicVol}%</span>
      </label>
      {canVibrate() && (
        <div className="flex items-center justify-between gap-3">
          <span className="tc-display text-sm">Vibration</span>
          <button type="button" className="tc-plank tc-center tc-small" style={{ width: 96 }} aria-pressed={vibes}
            onClick={() => { const on = !vibes; setVibes(on); setVibrateOn(on); if (on) buzz(60); }}>{vibes ? "On" : "Off"}</button>
        </div>
      )}
    </>
  );
}

/** The Settings button in an in-game menu: a plank with the cog. */
export function SettingsPlank({ onClick }) {
  return (
    <button type="button" className="tc-plank tc-center tc-small gap-2" onClick={onClick}>
      <CogIcon size={18} />Settings
    </button>
  );
}

/** An in-game menu's settings view: the sound panel and Back (also the
 *  phone's Back and Escape) to the menu it came from. */
export function InGameSettings({ onBack, compact = false }) {
  useBackLayer(true, onBack);
  return (
    <div className="flex w-full max-w-xs flex-col gap-3 text-left">
      <h2 className={"tc-title m-0 text-center " + (compact ? "text-lg" : "text-[26px]")}>Settings</h2>
      <div className="tc-panel flex flex-col gap-4 p-4"><SoundSettings /></div>
      <button type="button" className="tc-plank tc-center tc-small" onClick={onBack}>Back</button>
    </div>
  );
}

/** A round cog for screens without a game menu (Puzzle Rush, Memories). */
export function CogButton({ onClick, className = "" }) {
  return (
    <button type="button" className={"tc-round shrink-0 " + className} onClick={onClick} aria-label="Settings" title="Settings">
      <CogIcon size={18} />
    </button>
  );
}

/** Settings over the whole screen, for screens without a game menu. */
export function SettingsOverlay({ onClose, note = null }) {
  return (
    <div className="tc-scrim absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 overflow-y-auto p-6" role="dialog" aria-label="Settings">
      <InGameSettings onBack={onClose} />
      {note && <p className="m-0 max-w-[30ch] text-center text-xs text-[var(--tc-cream-dim)]">{note}</p>}
    </div>
  );
}
