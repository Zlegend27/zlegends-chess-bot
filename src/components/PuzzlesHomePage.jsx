import { useEffect } from "react";
import StarField from "./StarField";
import PixelAvatar, { TPAL, TPIX } from "./PixelAvatar";
import { overlayOpen } from "../utils/routes";
import { getUiTheme } from "../utils/uiTheme";

/** The Puzzles tab: four ways to train, all equal, all on one phone screen.
 *  It uses the site's own cards (the same ones as the Play page) so it reads
 *  as part of the site; Sweetheart, whose corner this is, sits small in the
 *  heading rather than filling the screen. Chess Tactica's option opens its
 *  puzzle mode (Puzzle Rush Tactica) directly. */
const ICONS = {
  daily: "M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z",
  ranked: "M12 2 2 12l10 10 10-10L12 2z",
  rush: "M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66L13 3h1l-1 7h3.5c.49 0 .56.33.44.51C12.28 17.53 11 21 11 21z",
};

export default function PuzzlesHomePage({ onBack, onDaily, onRanked, onRush, onTactica, onLeaderboard, puzzlesReady, dailySolved, sweetheart }) {
  useEffect(() => {
    const onKeyDown = (e) => { if (e.key === "Escape" && !overlayOpen()) onBack(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onBack]);

  const T = getUiTheme(sweetheart);
  const modes = [
    { id: "daily", name: "Daily puzzle", desc: dailySolved ? "Solved today ✓" : "One new puzzle every day", onClick: onDaily, needsPuzzles: true },
    { id: "ranked", name: "Ranked puzzles", desc: "Pick your level, from beginner up", onClick: onRanked, needsPuzzles: true },
    { id: "rush", name: "Puzzle Rush", desc: "Solve as many as you can on the clock", onClick: onRush, needsPuzzles: true },
    { id: "tactica", name: "Chess Tactica", desc: "A puzzle rush in the 3D bin", onClick: onTactica },
  ];

  return (
    <div className="root">
      <StarField sweetheart={sweetheart} />
      <div className="relative z-10 flex w-full max-w-md flex-col gap-3">
        <div className="flex items-center gap-3">
          <img src="/sweetheart-still.png" alt="" width="83" height="64" className="h-16 w-auto shrink-0" />
          <div className="min-w-0">
            <h1 className={"m-0 text-xl font-bold " + T.ink} style={{ fontFamily: "var(--font-display)" }}>Puzzles</h1>
            <p className={"m-0 mt-0.5 text-sm " + T.dimText}>Sweetheart&apos;s waiting. Pick how you want to train.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {modes.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={m.onClick}
              disabled={m.needsPuzzles && !puzzlesReady}
              className={`flex min-h-[104px] flex-col gap-2 rounded-2xl border ${T.cardBorder} ${T.panelBg} p-4 text-left backdrop-blur-sm transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 ${T.ring} disabled:cursor-default disabled:opacity-50`}
            >
              {m.id === "tactica" ? (
                <PixelAvatar rows={TPIX} pal={TPAL} size={32} />
              ) : (
                <span className={`flex size-8 items-center justify-center ${T.accentText}`} aria-hidden="true">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d={ICONS[m.id]} /></svg>
                </span>
              )}
              <span className={"text-base font-bold " + T.ink}>{m.name}</span>
              {m.desc && <span className={"text-xs leading-relaxed " + T.dimText}>{m.desc}</span>}
            </button>
          ))}
        </div>

        <button type="button" className="btn ghost" style={{ width: "100%" }} onClick={onLeaderboard}>Leaderboards</button>
        {!puzzlesReady && <p className={"m-0 text-center text-xs " + T.dimText} role="status">Loading puzzles…</p>}
      </div>
    </div>
  );
}
