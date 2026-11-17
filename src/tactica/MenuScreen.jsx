import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { TacticaScene, SET_BOARD } from "./scene";
import { dressTrashBin } from "./sets/trashBin";
import { BOND_KINDS, KIND_NAMES, LOOKS, MAX_LEVEL, loadBonds, levelsOf, progress } from "./bonds";
import { Medal } from "./ui";
import { cburnettPieceSvgUrl } from "../utils/cburnettPieceSvg";
import { soundOn, setSoundOn, onSoundChange } from "./sound";
import { loadSetting } from "../utils/storage";
import { loadStory, saveStory, bondsOpen, redEyes, isHard, hardLocked, canSwitchHard, setHardSwitch, resetBond } from "./story";

/* Chess Tactica's front screen: the title and the modes over a standoff in
   the bin. One of your pawns faces the enemy queen, king and knight,
   huddled together; it swings at them every few seconds while the camera
   slowly circles. The Bonds page lists how close each kind of character
   has grown. */
const PAWN = 28, QUEEN_SQ = 35, KING_SQ = 36, KNIGHT_SQ = 37; // e4 against d5, e5, f5
const CIRCLE_SPEED = 0.08; // radians per second
/* The modes, then Exit. Bonds and Settings are the round buttons in the
   top corners; Settings holds sound, hard mode, and asking the bond
   question again. */
const MODES = [
  { id: "run", name: "Rogue Chess Run", piece: 4 },
  { id: "blitz", name: "Puzzle Rush Tactica", piece: 2 },
  { id: "bot", name: "Regular Chess", piece: 6 },
  { id: "versus", name: "1v1", piece: 5 },
  { id: "tutorial", name: "Tutorial", piece: 1 },
];

export default function MenuScreen({ onPick, onExit, onOpening, blitzBest, sweetheart }) {
  const canvasRef = useRef(null);
  const [page, setPage] = useState("modes"); // modes | bonds | settings
  const [story, setStory] = useState(loadStory);
  const change = (next) => setStory(saveStory(next));
  /* The furthest world reached in the run (0 is the bin). */
  const reached = Number(loadSetting("tacticaRunReached", 0)) || 0;
  const [confirmReset, setConfirmReset] = useState(false);
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
    scene.setBonds(bondsOpen(story) ? levelsOf(bonds) : {});
    scene.setRedEyes(redEyes(story));
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
  }, [sweetheart, bonds, story]);

  return (
    <div className="relative mx-auto w-full max-w-[480px] overflow-hidden" style={{ height: "calc(100dvh - var(--headerH))" }}>
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 block size-full" aria-hidden="true" />
      {/* The title keeps clear of the Bonds button in the corner, shrinking a little on narrow phones. */}
      <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent px-16 pt-7 pb-14 text-center">
        <h1 className="tc-title m-0 leading-tight whitespace-nowrap" style={{ fontSize: "clamp(22px, calc((100vw - 136px) / 10), 32px)" }}>Chess Tactica</h1>
      </div>
      {/* Settings (sound, hard mode, the bond) behind a cog in the other top corner. */}
      <button
        type="button"
        className="tc-round absolute top-3 left-3"
        onClick={() => setPage((p) => (p === "settings" ? "modes" : "settings"))}
        aria-label="Settings"
        aria-pressed={page === "settings"}
        title="Settings"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96a7 7 0 0 0-1.62-.94l-.36-2.54a.48.48 0 0 0-.48-.41h-3.84a.48.48 0 0 0-.48.41l-.36 2.54c-.59.24-1.13.56-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L2.74 8.87a.48.48 0 0 0 .12.61l2.03 1.58c-.05.3-.07.63-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.49.49 0 0 0-.12-.61zM12 15.6a3.6 3.6 0 1 1 0-7.2 3.6 3.6 0 0 1 0 7.2z" /></svg>
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
      ) : page === "settings" ? (
        <section aria-labelledby="tacticaSettingsTitle" className="absolute inset-x-0 bottom-0 flex max-h-[82%] flex-col gap-3 overflow-y-auto bg-gradient-to-t from-black/95 via-black/80 to-transparent px-4 pt-16 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <h2 id="tacticaSettingsTitle" className="tc-title m-0 text-2xl">Settings</h2>
          <div className="tc-panel flex flex-col gap-4 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="tc-display text-sm">Sound</span>
              <button type="button" className="tc-plank tc-center tc-small" style={{ width: 96 }} aria-pressed={sound} onClick={() => setSoundOn(!sound)}>{sound ? "On" : "Off"}</button>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-3">
                <span className="tc-display text-sm">Hard mode</span>
                <button
                  type="button" className="tc-plank tc-center tc-small" style={{ width: 96 }}
                  aria-pressed={isHard(story)}
                  disabled={hardLocked(story) || !canSwitchHard(reached)}
                  onClick={() => change(setHardSwitch(story, !story.hardSwitch))}
                >{isHard(story) ? "On" : "Off"}</button>
              </div>
              <p className="m-0 text-xs text-[var(--tc-cream-dim)]">
                {hardLocked(story)
                  ? "You refused the bond, so hard mode stays on until you beat the run or ask the question again."
                  : canSwitchHard(reached)
                    ? "Harder puzzles on every floor, no rewards, and the pieces' eyes glow red."
                    : "Unlocks when you reach the second world."}
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="tc-display text-sm">The bond</span>
              <p className="m-0 text-xs text-[var(--tc-cream-dim)]">
                {story.bond === "yes" ? "You are bonded with the pieces." : story.bond === "refused" ? "You refused the pieces. They haven't forgotten." : "The pieces haven't asked you yet."}
              </p>
              {confirmReset ? (
                <div className="flex gap-2">
                  <button type="button" className="tc-plank tc-center tc-small flex-1" onClick={() => { change(resetBond(story)); onOpening(); }}>Yes, ask me again</button>
                  <button type="button" className="tc-plank tc-center tc-small flex-1" onClick={() => setConfirmReset(false)}>Cancel</button>
                </div>
              ) : (
                <button type="button" className="tc-plank tc-center tc-small" onClick={() => setConfirmReset(true)}>Ask the bond question again</button>
              )}
              {confirmReset && <p className="m-0 text-xs text-[var(--tc-cream-dim)]">The opening plays again and you answer afresh. Your bond levels are kept.</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="tc-display text-sm">Credits</span>
              <p className="m-0 text-xs text-[var(--tc-cream-dim)]">
                Polar bear model: &ldquo;Polar Bear&rdquo; by kenchoo (Sketchfab), CC BY 4.0, mouth added.
                Pizza monster&apos;s slice: &ldquo;Pizza&rdquo; by gatoperdido (Sketchfab), CC BY 4.0, face added.
                Textures, skies and props: Poly Haven and ambientCG, public domain.
              </p>
            </div>
          </div>
          <button type="button" className="tc-plank tc-center tc-small" onClick={() => { setConfirmReset(false); setPage("modes"); }}>Back</button>
        </section>
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
