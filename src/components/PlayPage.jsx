import StarField from "./StarField";
import PixelAvatar, { ZPAL, ZPIX } from "./PixelAvatar";
import { getUiTheme } from "../utils/uiTheme";

const OTHER_MODES = [
  { id: "rank", label: "Rank Bot", desc: "An adaptive bot that estimates your rating as you play." },
  { id: "blind", label: "Blind Chess", desc: "Play a full game by voice, with no board." },
  { id: "spectate", label: "Watch Bots", desc: "Sit back and watch two bots battle." },
];

/** Where a new game starts. `levels` are App.jsx's DIFFICULTIES minus Rank
 *  Bot, each with its index, since Rank Bot gets its own row below. */
export default function PlayPage({ levels, levelIdx, playLabel, onLevel, onPlay, onMode, sweetheart }) {
  const T = getUiTheme(sweetheart);
  const card = `rounded-2xl border ${T.cardBorder} ${T.panelBg} backdrop-blur-sm`;
  const focus = `focus-visible:outline-none focus-visible:ring-2 ${T.ring}`;

  return (
    <div className="root">
      <StarField sweetheart={sweetheart} />
      <div className="relative z-10 flex w-full max-w-md flex-col gap-3">
        <div className={`${card} flex flex-col gap-3 p-4`}>
          <div className="flex items-center gap-3">
            <PixelAvatar rows={ZPIX} pal={ZPAL} size={40} />
            <div className={"text-base font-bold " + T.ink}>Play vs Bot</div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {levels.map((level) => (
              <button
                key={level.idx}
                type="button"
                aria-pressed={level.idx === levelIdx}
                onClick={() => onLevel(level.idx)}
                className={`h-11 rounded-lg border bg-transparent text-xs font-bold transition-colors ${focus} ${level.idx === levelIdx ? `${T.accentBorder} ${T.interactiveText}` : `${T.cardBorder} ${T.dimText} ${T.hoverInk}`}`}
              >
                {level.label}
              </button>
            ))}
          </div>
          <button type="button" className="btn gold" style={{ width: "100%" }} onClick={onPlay}>{playLabel}</button>
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
