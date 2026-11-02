import { useState } from "react";
import StarField from "./StarField";
import PixelAvatar, { ZPAL, ZPIX } from "./PixelAvatar";
import { getUiTheme } from "../utils/uiTheme";

const OTHER_MODES = [
  { id: "blind", label: "Blind Chess", desc: "Play a full game by voice, with no board." },
  { id: "spectate", label: "Watch Bots", desc: "Sit back and watch two bots battle." },
];

/** Where a new game starts. `levels` are the bots in the order to offer them,
 *  each with its index in DIFFICULTIES. Picking one starts a game. */
export default function PlayPage({ levels, hasLiveGame, onPick, onResume, onMode, sweetheart }) {
  const T = getUiTheme(sweetheart);
  const [open, setOpen] = useState(false);
  const card = `rounded-2xl border ${T.cardBorder} ${T.panelBg} backdrop-blur-sm`;
  const focus = `focus-visible:outline-none focus-visible:ring-2 ${T.ring}`;

  return (
    <div className="root">
      <StarField sweetheart={sweetheart} />
      <div className="relative z-10 flex w-full max-w-md flex-col gap-3">
        {hasLiveGame && (
          <button type="button" className="btn gold" style={{ width: "100%" }} onClick={onResume}>Resume Game</button>
        )}

        <div className={card}>
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className={`flex w-full items-center gap-3 rounded-2xl bg-transparent p-4 text-left ${focus}`}
          >
            <PixelAvatar rows={ZPIX} pal={ZPAL} size={40} />
            <span className={"flex-1 text-base font-bold " + T.ink}>Play vs Bot</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"
              className={`${T.dimText} transition-transform ${open ? "rotate-180" : ""}`}>
              <path d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
            </svg>
          </button>
          {open && (
            <div className="flex flex-col gap-2 px-4 pb-4">
              {levels.map((level) => (
                <button
                  key={level.idx}
                  type="button"
                  onClick={() => onPick(level.idx)}
                  className={`flex min-h-11 items-center justify-between gap-2 rounded-lg border ${T.cardBorder} bg-transparent px-3 text-left text-sm font-bold ${T.ink} transition-colors ${focus}`}
                >
                  {level.label}
                  {level.suggested && <span className={"text-xs font-bold " + T.interactiveText}>Suggested</span>}
                </button>
              ))}
              {hasLiveGame && (
                <p className={"m-0 text-xs leading-relaxed " + T.accentText}>
                  You have a game in progress. Picking a bot here will end it.
                </p>
              )}
            </div>
          )}
        </div>

        <div className={`${card} p-4`} aria-disabled="true">
          <span className="flex items-center justify-between gap-2">
            <span className={"text-sm font-bold " + T.ink}>Player vs Player</span>
            <span className={"text-xs font-bold " + T.dimText}>Coming soon</span>
          </span>
          <span className={"mt-1 block text-xs leading-relaxed " + T.dimText}>Play against a real person.</span>
        </div>

        {OTHER_MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onMode(m.id)}
            className={`${card} block w-full p-4 text-left transition hover:-translate-y-0.5 ${focus}`}
          >
            <span className={"block text-sm font-bold " + T.ink}>{m.label}</span>
            <span className={"mt-1 block text-xs leading-relaxed " + T.dimText}>{m.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
