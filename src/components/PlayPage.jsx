import { useState } from "react";
import StarField from "./StarField";
import PixelAvatar, { ZPAL, ZPIX, TPAL, TPIX } from "./PixelAvatar";
import { getUiTheme } from "../utils/uiTheme";
import ConfirmModal from "./ConfirmModal";
import { cburnettPieceSvgUrl } from "../utils/cburnettPieceSvg";

/* Small line icons for the modes without a character of their own. */
const MicIcon = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11z" />
  </svg>
);
const TvIcon = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M21 6h-7.59l3.29-3.29L16 2l-4 4-4-4-.71.71L10.59 6H3a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2zm0 13H3V8h18zM9 10v7l6-3.5z" />
  </svg>
);

const OTHER_MODES = [
  { id: "blind", label: "Blind Chess", desc: "A full game by voice, with no board.", Icon: MicIcon },
  { id: "spectate", label: "Watch Bots", desc: "Sit back and watch two bots battle.", Icon: TvIcon },
];

/** Where a new game starts. `levels` are the bots in the order to offer them,
 *  each with its index in DIFFICULTIES. Picking one starts a game. */
export default function PlayPage({ levels, hasLiveGame, onPick, onResume, onQuit, onMode, onLobby, onTactica, onSelf, sweetheart }) {
  const T = getUiTheme(sweetheart);
  const [open, setOpen] = useState(false);
  const [quitting, setQuitting] = useState(false);
  const card = `rounded-2xl border ${T.cardBorder} ${T.panelBg} backdrop-blur-sm`;
  const focus = `focus-visible:outline-none focus-visible:ring-2 ${T.ring}`;
  /* Every mode reads the same way: an icon, its name, one line. */
  const label = (name, desc) => (
    <span className="flex flex-1 flex-col">
      <span className={"text-base font-bold " + T.ink}>{name}</span>
      <span className={"mt-0.5 text-xs leading-relaxed " + T.dimText}>{desc}</span>
    </span>
  );

  return (
    <div className="root">
      <StarField sweetheart={sweetheart} />
      <div className="relative z-10 flex w-full max-w-md flex-col gap-3">
        {hasLiveGame && (
          <div className="flex gap-2">
            <button type="button" className="btn gold" style={{ flex: 1 }} onClick={onResume}>Resume Game</button>
            <button type="button" className="btn ghost" onClick={() => setQuitting(true)}>Quit game</button>
          </div>
        )}
        <ConfirmModal
          open={quitting}
          title="Quit this game?"
          text="The game you have in progress will be left unfinished."
          yesLabel="Yes, quit"
          onYes={() => { setQuitting(false); onQuit(); }}
          onCancel={() => setQuitting(false)}
        />

        <div className={card}>
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className={`flex w-full items-center gap-3 rounded-2xl bg-transparent p-4 text-left ${focus}`}
          >
            <PixelAvatar rows={ZPIX} pal={ZPAL} size={40} />
            {label("Play vs Bot", "From a bot that plays like you to full engine strength.")}
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

        {/* Chess Tactica: the game played by the living wooden pieces. */}
        <button
          type="button"
          onClick={onTactica}
          className={`${card} flex w-full cursor-pointer items-center gap-3 p-4 text-left transition hover:-translate-y-0.5 ${focus}`}
        >
          <PixelAvatar rows={TPIX} pal={TPAL} size={40} />
          {label("Chess Tactica", "A 3D story adventure with living chess pieces.")}
        </button>

        {/* 1v1: Zlegend squaring up to a pawn. Opens the lobby. */}
        <button type="button" onClick={onLobby} className={`${card} flex w-full cursor-pointer items-center gap-3 p-4 text-left transition hover:-translate-y-0.5 ${focus}`}>
          <span className="flex shrink-0 items-center" aria-hidden="true">
            <PixelAvatar rows={ZPIX} pal={ZPAL} size={40} />
            <svg width="18" height="18" viewBox="0 0 24 24" className={"-mx-0.5 " + T.accentText} fill="currentColor">
              <path d="M3 3l7.5 7.5-1.4 1.4-1.6-1.6L5 12.8 3.6 11.4l2.5-2.5L3 5.8zm18 0v2.8l-9.3 9.3 1.6 1.6-1.4 1.4-1.6-1.6-2.5 2.5-1.4-1.4 2.5-2.5-1.6-1.6 1.4-1.4 1.6 1.6L18.2 3zM6.1 16.1l1.4 1.4L5 20H3v-2z" />
            </svg>
            <img src={cburnettPieceSvgUrl(1, false)} alt="" width="36" height="36" style={{ transform: "scaleX(-1)" }} />
          </span>
          {label("1v1", "Play a real person online.")}
        </button>

        {/* Play with yourself: move both sides to try out ideas. */}
        <button type="button" onClick={onSelf} className={`${card} flex w-full cursor-pointer items-center gap-3 p-4 text-left transition hover:-translate-y-0.5 ${focus}`}>
          <span className="relative block shrink-0" style={{ width: 40, height: 40 }} aria-hidden="true">
            <img src={cburnettPieceSvgUrl(6, true)} alt="" width="30" height="30" className="absolute top-0 left-0" />
            <img src={cburnettPieceSvgUrl(6, false)} alt="" width="30" height="30" className="absolute right-0 bottom-0" />
          </span>
          {label("Play with yourself", "Move both sides to try out ideas.")}
        </button>

        {OTHER_MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onMode(m.id)}
            className={`${card} flex w-full cursor-pointer items-center gap-3 p-4 text-left transition hover:-translate-y-0.5 ${focus}`}
          >
            <span className={"flex size-10 shrink-0 items-center justify-center " + T.accentText}><m.Icon /></span>
            {label(m.label, m.desc)}
          </button>
        ))}
      </div>
    </div>
  );
}
