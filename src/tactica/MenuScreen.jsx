import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { TacticaScene, SET_BOARD } from "./scene";
import { dressTrashBin } from "./sets/trashBin";
import { BOND_KINDS, KIND_NAMES, LOOKS, MAX_LEVEL, loadBonds, levelsOf, progress } from "./bonds";
import { Medal } from "./ui";
import { cburnettPieceSvgUrl } from "../utils/cburnettPieceSvg";
import { soundOn, setSoundOn, onSoundChange } from "./sound";

/* Chess Tactica's front screen: the title and the modes over a standoff in
   the bin. One of your pawns faces the enemy queen, king and knight,
   huddled together; it swings at them every few seconds while the camera
   slowly circles. The Bonds page lists how close each kind of character
   has grown. */
const PAWN = 28, QUEEN_SQ = 35, KING_SQ = 36, KNIGHT_SQ = 37; // e4 against d5, e5, f5
const CIRCLE_SPEED = 0.08; // radians per second
/* The modes, then Exit. Bonds is the round button in the top corner. */
const MODES = [
  { id: "run", name: "Bin Run", piece: 4 },
  { id: "blitz", name: "Blitz in the Bin", piece: 2 },
  { id: "bot", name: "Regular Chess", piece: 6 },
  { id: "versus", name: "1v1", piece: 5 },
  { id: "tutorial", name: "Tutorial", piece: 1 },
];

export default function MenuScreen({ onPick, onExit, blitzBest, sweetheart }) {
  const canvasRef = useRef(null);
  const [page, setPage] = useState("modes"); // modes | bonds
  const [bonds] = useState(loadBonds);
  const [sound, setSound] = useState(soundOn);
  useEffect(() => onSoundChange(setSound), []);

  useEffect(() => {
    const scene = new TacticaScene(canvasRef.current, {
      flipped: false,
      colors: {
        light: SET_BOARD.light, dark: SET_BOARD.dark, background: sweetheart ? "#FFF2F6" : "#060507",
        highlight: "#3EE7F5", target: "#F5D93E", attack: "#F05348", select: "#3EE7F5",
      },
    });
    scene.setBonds(levelsOf(bonds));
    scene.setPieces([
      { sq: PAWN, type: 1, white: true },
      { sq: QUEEN_SQ, type: 5, white: false },
      { sq: KING_SQ, type: 6, white: false },
      { sq: KNIGHT_SQ, type: 2, white: false },
    ]);
    const bin = dressTrashBin(scene);
    scene.everyFrame.push((dt) => bin.update(dt));
    /* Low behind the pawn, looking a little below the group so the scene
       sits in the top half of the screen, above the buttons. */
    const middle = scene.worldOf(PAWN).lerp(scene.worldOf(KING_SQ), 0.5);
    scene.pivot.copy(middle);
    scene.moveCamera(middle.clone().add(new THREE.Vector3(1.4, 3.1, 4.6)), middle.clone().add(new THREE.Vector3(0, -1.6, 0.4)));
    const stop = scene.showdown(PAWN, QUEEN_SQ, [QUEEN_SQ, KING_SQ, KNIGHT_SQ]);
    /* The camera never stops circling, so the menu draws every frame. */
    scene.continuous = true;
    if (!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      scene.everyFrame.push((dt) => scene.spinBy(dt * CIRCLE_SPEED));
    }
    return () => { stop(); scene.dispose(); };
  }, [sweetheart, bonds]);

  return (
    <div className="relative mx-auto w-full max-w-[480px] overflow-hidden" style={{ height: "calc(100dvh - var(--headerH))" }}>
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 block size-full" aria-hidden="true" />
      {/* The title keeps clear of the Bonds button in the corner, shrinking a little on narrow phones. */}
      <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent px-16 pt-7 pb-14 text-center">
        <h1 className="tc-title m-0 leading-tight whitespace-nowrap" style={{ fontSize: "clamp(22px, calc((100vw - 136px) / 10), 32px)" }}>Chess Tactica</h1>
      </div>
      {/* Sound on and off, in the other top corner. */}
      <button
        type="button"
        className="tc-round absolute top-3 left-3"
        onClick={() => setSoundOn(!sound)}
        aria-label={sound ? "Turn sound off" : "Turn sound on"}
        aria-pressed={sound}
        title={sound ? "Sound on" : "Sound off"}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="currentColor" d="M3 9h4l5-4v14l-5-4H3z" />
          {sound
            ? <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
            : <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M16 9l6 6M22 9l-6 6" />}
        </svg>
      </button>
      {/* Bonds: a round wood and brass button in the top corner. */}
      <button
        type="button"
        className="tc-round absolute top-3 right-3"
        onClick={() => setPage((p) => (p === "bonds" ? "modes" : "bonds"))}
        aria-label="Bonds"
        aria-pressed={page === "bonds"}
        title="Bonds"
      >
        <img src={cburnettPieceSvgUrl(5, true)} alt="" width="26" height="26" />
      </button>
      {page === "modes" ? (
        <nav aria-label="Tactica modes" className="absolute inset-x-0 bottom-0 flex flex-col gap-2.5 bg-gradient-to-t from-black/90 via-black/65 to-transparent px-4 pt-14 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {MODES.map((m) => (
            <button key={m.id} type="button" className="tc-plank tc-menu" onClick={() => onPick(m.id)}>
              <Medal type={m.piece} />
              <span className="flex flex-1 items-baseline justify-between gap-2">
                {m.name}
                {/* Blitz has one length (3 minutes) for now, so its best is just a number. */}
                {m.id === "blitz" && blitzBest ? <span className="text-sm font-normal tracking-normal text-[var(--tc-cream-dim)]" style={{ fontFamily: "var(--tc-font-body)" }}>Best {blitzBest}</span> : null}
              </span>
            </button>
          ))}
          <button type="button" className="tc-plank tc-menu" onClick={onExit}>
            <span className="tc-medal" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#3a1f08" d="M10 4h9a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-9v-2h8V6h-8zM9.6 7.6 11 9l-2 2h8v2H9l2 2-1.4 1.4L5.2 12z" /></svg>
            </span>
            Exit
          </button>
        </nav>
      ) : (
        <section aria-labelledby="tacticaBondsTitle" className="absolute inset-x-0 bottom-0 flex max-h-[78%] flex-col gap-3 overflow-y-auto bg-gradient-to-t from-black/95 via-black/80 to-transparent px-4 pt-16 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          <div>
            <h2 id="tacticaBondsTitle" className="tc-title m-0 text-2xl">Bonds</h2>
            <p className="m-0 mt-1 text-sm text-[var(--tc-cream-dim)]">Every correct puzzle move grows that character&apos;s bond. Captures and finishing moves grow it more.</p>
          </div>
          <ul className="tc-panel m-0 flex list-none flex-col gap-3 p-4">
            {BOND_KINDS.map((kind, i) => {
              const { level, into, need } = progress(bonds[kind] ?? 0);
              const maxed = level >= MAX_LEVEL;
              return (
                <li key={kind} className="flex items-center gap-3">
                  <Medal type={i + 1} />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="tc-display text-sm">{KIND_NAMES[kind]}</span>
                      <span className="text-xs text-[var(--tc-cream-dim)]">Bond {level}{maxed ? " · max" : ""}</span>
                    </div>
                    <div
                      className="tc-bar"
                      role="progressbar"
                      aria-label={`${KIND_NAMES[kind]} bond progress`}
                      aria-valuemin={0}
                      aria-valuemax={maxed ? 1 : need}
                      aria-valuenow={maxed ? 1 : into}
                    >
                      <i style={{ width: maxed ? "100%" : `${(into / need) * 100}%`, background: "linear-gradient(var(--tc-gold-hi), var(--tc-gold))" }} />
                    </div>
                    <span className="text-xs text-[var(--tc-cream-dim)]">
                      {maxed ? LOOKS[level - 1] : `${need - into} XP to bond ${level + 1}: ${LOOKS[level].toLowerCase()}`}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
          <button type="button" className="tc-plank tc-center tc-small" onClick={() => setPage("modes")}>Back</button>
        </section>
      )}
    </div>
  );
}
