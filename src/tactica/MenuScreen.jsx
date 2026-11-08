import { useEffect, useRef, useState } from "react";
import { TacticaScene, SET_BOARD } from "./scene";
import { dressTrashBin } from "./sets/trashBin";
import { BOND_KINDS, KIND_NAMES, LOOKS, MAX_LEVEL, loadBonds, levelsOf, progress } from "./bonds";

/* Chess Tactica's front screen: the title and the modes, over the bin with
   a full set standing on the board while the camera slowly circles it. Your
   (white) characters wear their bond looks. The Bonds page lists how close
   each kind of character has grown. */
const START = [4, 2, 3, 5, 6, 3, 2, 4];
const CIRCLE_SPEED = 0.06; // radians per second
const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cyan)]";

export default function MenuScreen({ best, runBest, onPick, sweetheart }) {
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
    const pieces = [];
    for (let f = 0; f < 8; f++) {
      pieces.push({ sq: f, type: START[f], white: true }, { sq: 8 + f, type: 1, white: true });
      pieces.push({ sq: 56 + f, type: START[f], white: false }, { sq: 48 + f, type: 1, white: false });
    }
    scene.setPieces(pieces);
    const bin = dressTrashBin(scene);
    scene.everyFrame.push((dt) => bin.update(dt));
    scene.showBoard();
    if (!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      scene.everyFrame.push((dt) => scene.spinBy(dt * CIRCLE_SPEED));
    }
    return () => scene.dispose();
  }, [sweetheart, bonds]);

  const row = "flex w-full cursor-pointer flex-col items-start rounded-xl border border-white/15 bg-black/55 px-4 py-3 text-left text-white backdrop-blur-sm disabled:cursor-default disabled:opacity-50 " + focusRing;

  return (
    <div className="relative mx-auto w-full max-w-[480px] overflow-hidden" style={{ height: "calc(100dvh - var(--headerH))" }}>
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 block size-full" aria-hidden="true" />
      <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent px-5 pt-8 pb-16 text-center">
        <h1 className="m-0 text-3xl text-white" style={{ fontFamily: "var(--font-display)" }}>Chess Tactica</h1>
        <p className="m-0 mt-1 text-sm text-white/70">Real chess puzzles, played by living pieces.</p>
      </div>
      {page === "modes" ? (
        <nav aria-label="Tactica modes" className="absolute inset-x-0 bottom-0 flex flex-col gap-2 bg-gradient-to-t from-black/85 via-black/60 to-transparent px-4 pt-16 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <button type="button" className={"btn gold w-full " + focusRing} onClick={() => onPick("run")}>
            Bin Run
          </button>
          <p className="m-0 -mt-1 mb-1 text-center text-xs text-white/70">Climb out floor by floor{runBest ? ` · Best ${runBest}` : ""}</p>
          <button type="button" className={row} onClick={() => onPick("blitz")}>
            <span className="font-bold">Blitz in the Bin</span>
            <span className="text-xs text-white/70">3 minutes · solve as many as you can{best ? ` · Best ${best}` : ""}</span>
          </button>
          <button type="button" className={row} onClick={() => onPick("practice")}>
            <span className="font-bold">Practice</span>
            <span className="text-xs text-white/70">One puzzle at your own pace, with every attack played out</span>
          </button>
          <button type="button" className={row} onClick={() => setPage("bonds")}>
            <span className="font-bold">Bonds</span>
            <span className="text-xs text-white/70">How close each of your characters has grown</span>
          </button>
          <button type="button" className={row} disabled>
            <span className="font-bold">Play a bot</span>
            <span className="text-xs text-white/70">Coming soon: a full game in the bin</span>
          </button>
        </nav>
      ) : (
        <section aria-labelledby="tacticaBondsTitle" className="absolute inset-x-0 bottom-0 flex max-h-[75%] flex-col gap-3 overflow-y-auto bg-gradient-to-t from-black/90 via-black/75 to-transparent px-4 pt-16 pb-[calc(1rem+env(safe-area-inset-bottom))] text-white">
          <div>
            <h2 id="tacticaBondsTitle" className="m-0 text-xl" style={{ fontFamily: "var(--font-display)" }}>Bonds</h2>
            <p className="m-0 text-xs text-white/70">Every correct move grows that character&apos;s bond; captures and finishing moves grow it more. More to unlock is coming.</p>
          </div>
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
            {BOND_KINDS.map((kind) => {
              const xp = bonds[kind] ?? 0;
              const { level, into, need } = progress(xp);
              const maxed = level >= MAX_LEVEL;
              return (
                <li key={kind} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-bold">{KIND_NAMES[kind]}</span>
                    <span className="text-xs text-white/75">Bond {level}{maxed ? " · max" : ""}</span>
                  </div>
                  <div
                    className="h-2 overflow-hidden rounded-full bg-white/15"
                    role="progressbar"
                    aria-label={`${KIND_NAMES[kind]} bond progress`}
                    aria-valuemin={0}
                    aria-valuemax={maxed ? 1 : need}
                    aria-valuenow={maxed ? 1 : into}
                  >
                    <div className="h-full rounded-full bg-[var(--yellow)]" style={{ width: maxed ? "100%" : `${(into / need) * 100}%` }} />
                  </div>
                  <span className="text-[11px] text-white/65">
                    {maxed ? LOOKS[level - 1] : `${need - into} XP to bond ${level + 1}: ${LOOKS[level].toLowerCase()}`}
                  </span>
                </li>
              );
            })}
          </ul>
          <button type="button" className={"btn ghost self-center " + focusRing} onClick={() => setPage("modes")}>Back</button>
        </section>
      )}
    </div>
  );
}
