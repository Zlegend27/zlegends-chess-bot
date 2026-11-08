import { useEffect, useRef } from "react";
import { TacticaScene, SET_BOARD } from "./scene";
import { dressTrashBin } from "./sets/trashBin";

/* Chess Tactica's front screen: the title and the modes, over the bin with
   a full set standing on the board while the camera slowly circles it. */
const START = [4, 2, 3, 5, 6, 3, 2, 4];
const CIRCLE_SPEED = 0.06; // radians per second
const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cyan)]";

export default function MenuScreen({ best, onPick, sweetheart }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const scene = new TacticaScene(canvasRef.current, {
      flipped: false,
      colors: {
        light: SET_BOARD.light, dark: SET_BOARD.dark, background: sweetheart ? "#FFF2F6" : "#060507",
        highlight: "#3EE7F5", target: "#F5D93E", attack: "#F05348", select: "#3EE7F5",
      },
    });
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
  }, [sweetheart]);

  const row = "flex w-full cursor-pointer flex-col items-start rounded-xl border border-white/15 bg-black/55 px-4 py-3 text-left text-white backdrop-blur-sm disabled:cursor-default disabled:opacity-50 " + focusRing;

  return (
    <div className="relative mx-auto w-full max-w-[480px] overflow-hidden" style={{ height: "calc(100dvh - var(--headerH))" }}>
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 block size-full" aria-hidden="true" />
      <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent px-5 pt-8 pb-16 text-center">
        <h1 className="m-0 text-3xl text-white" style={{ fontFamily: "var(--font-display)" }}>Chess Tactica</h1>
        <p className="m-0 mt-1 text-sm text-white/70">Real chess puzzles, played by living pieces.</p>
      </div>
      <nav aria-label="Tactica modes" className="absolute inset-x-0 bottom-0 flex flex-col gap-2 bg-gradient-to-t from-black/85 via-black/60 to-transparent px-4 pt-16 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <button type="button" className={"btn gold w-full " + focusRing} onClick={() => onPick("blitz")}>
          Blitz in the Bin
        </button>
        <p className="m-0 -mt-1 mb-1 text-center text-xs text-white/70">3 minutes · solve as many as you can{best ? ` · Best ${best}` : ""}</p>
        <button type="button" className={row} onClick={() => onPick("practice")}>
          <span className="font-bold">Practice</span>
          <span className="text-xs text-white/70">One puzzle at your own pace, with every attack played out</span>
        </button>
        <button type="button" className={row} disabled>
          <span className="font-bold">Bin Run</span>
          <span className="text-xs text-white/70">Coming soon: climb out of the bin floor by floor</span>
        </button>
        <button type="button" className={row} disabled>
          <span className="font-bold">Play a bot</span>
          <span className="text-xs text-white/70">Coming soon: a full game in the bin</span>
        </button>
      </nav>
    </div>
  );
}
