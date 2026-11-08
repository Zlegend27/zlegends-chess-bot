import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { TacticaScene, SET_BOARD } from "./scene";
import { dressTrashBin } from "./sets/trashBin";
import { BOND_KINDS, KIND_NAMES, LOOKS, MAX_LEVEL, loadBonds, levelsOf, progress } from "./bonds";
import { Medal } from "./ui";

/* Chess Tactica's front screen: the title and the modes over a standoff in
   the bin. One of your pawns faces the enemy queen, king and knight,
   huddled together; it swings at them every few seconds while the camera
   slowly circles. The Bonds page lists how close each kind of character
   has grown. */
const PAWN = 28, QUEEN_SQ = 35, KING_SQ = 36, KNIGHT_SQ = 37; // e4 against d5, e5, f5
const CIRCLE_SPEED = 0.08; // radians per second
/* Bonds sits above the tutorial so Exit comes right after it, at the end. */
const MODES = [
  { id: "run", name: "Bin Run", piece: 4 },
  { id: "blitz", name: "Blitz in the Bin", piece: 2 },
  { id: "bot", name: "Regular Chess", piece: 6 },
  { id: "bonds", name: "Bonds", piece: 5 },
  { id: "tutorial", name: "Tutorial", piece: 1 },
];

export default function MenuScreen({ onPick, onExit, blitzBest, sweetheart }) {
  const canvasRef = useRef(null);
  const [page, setPage] = useState("modes"); // modes | bonds
  const [bonds] = useState(loadBonds);

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
    if (!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      scene.everyFrame.push((dt) => scene.spinBy(dt * CIRCLE_SPEED));
    }
    return () => { stop(); scene.dispose(); };
  }, [sweetheart, bonds]);

  return (
    <div className="relative mx-auto w-full max-w-[480px] overflow-hidden" style={{ height: "calc(100dvh - var(--headerH))" }}>
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 block size-full" aria-hidden="true" />
      <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent px-5 pt-7 pb-14 text-center">
        <h1 className="tc-title m-0 text-[32px] leading-tight">Chess Tactica</h1>
      </div>
      {page === "modes" ? (
        <nav aria-label="Tactica modes" className="absolute inset-x-0 bottom-0 flex flex-col gap-2.5 bg-gradient-to-t from-black/90 via-black/65 to-transparent px-4 pt-14 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {MODES.map((m) => (
            <button key={m.id} type="button" className="tc-plank tc-menu" onClick={() => (m.id === "bonds" ? setPage("bonds") : onPick(m.id))}>
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
