import { lazy, Suspense, useMemo, useState } from "react";
import StarField from "./StarField";
import SocialBanner from "./SocialBanner";
import BotBubble from "./BotBubble";
import { pickWelcomeLine } from "../utils/botLines";
import { getUiTheme } from "../utils/uiTheme";
import { SUPPORT_URL } from "../utils/links";
import { SECTIONS } from "./AppNav";
import { loadSetting, saveSetting } from "../utils/storage";

const iconOf = (id) => SECTIONS.find((s) => s.id === id)?.icon;
/* A cube for Chess Tactica, the 3D game. */
const CUBE_ICON = "M12 2 3 7v10l9 5 9-5V7l-9-5zm0 2.3L18.7 8 12 11.7 5.3 8 12 4.3zM5 9.7l6 3.3v6.6l-6-3.3V9.7zm8 9.9V13l6-3.3v6.6l-6 3.3z";

/* Below the buttons, so it loads after the first page instead of with it. */
const YouTubeTv = lazy(() => import("./YouTubeTv"));

/* Game Review is always on Home: it's a main feature, and on Chess.com
   reviews are paid, so it's the thing to point at. */
const REVIEW_ICON = "M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z";

/** The front door: the mascot's greeting, Play, and Game Review, then the
 *  TV. Nothing else: the menu (AppNav.jsx) covers the full tour, and the
 *  daily puzzle and suggestions that used to sit here made it cluttered.
 *  Everything above the socials should fit on a phone screen. */
export default function HomePage({ onEnter, onPlay, onTactica, hasLiveGame, firstVisit, rankElo, rankGames, sweetheart }) {
  /* Picked once per mount so it doesn't reroll mid-typewriter. */
  const [dismissed, setDismissed] = useState(false);
  /* "New here?": what the site is, for anyone arriving for the first time
     (and for search engines, which get the same words in the page's HTML).
     Stays until hidden. */
  const [newcomerHidden, setNewcomerHidden] = useState(() => !!loadSetting("newcomerHidden", false));
  const hideNewcomer = () => { setNewcomerHidden(true); saveSetting("newcomerHidden", true); };
  const welcomeLine = useMemo(
    () => pickWelcomeLine({ firstVisit, rankElo, games: rankGames }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const T = useMemo(() => getUiTheme(sweetheart), [sweetheart]);
  const card = `flex w-full items-center gap-4 rounded-2xl border ${T.cardBorder} ${T.panelBg} p-3 text-left backdrop-blur-sm transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 ${T.ring}`;

  return (
    <div className="root">
      <StarField sweetheart={sweetheart} />
      {!dismissed && <BotBubble line={welcomeLine} onDismiss={() => setDismissed(true)} />}

      <div className="relative z-10 mt-3 flex w-full max-w-md flex-col gap-3">
        <button type="button" className="btn gold" style={{ width: "100%" }} onClick={onPlay}>
          {hasLiveGame ? "Resume Game" : "Play"}
        </button>

        <button type="button" className={card} onClick={() => onEnter("review")}>
          <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${T.accentText}`} aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d={REVIEW_ICON} /></svg>
          </span>
          <span className="min-w-0">
            <span className={"block text-sm font-bold " + T.ink}>Game Review</span>
            <span className={"mt-1 block text-xs leading-relaxed " + T.dimText}>Paste any game, even one from Chess.com or Lichess, and see every move graded.</span>
          </span>
        </button>

        {!newcomerHidden && (
          <section aria-labelledby="newcomerTitle" className={`rounded-2xl border ${T.cardBorder} ${T.panelBg} p-4 backdrop-blur-sm`}>
            <div className="flex items-start justify-between gap-3">
              <h2 id="newcomerTitle" className={"m-0 text-base font-bold " + T.ink}>New here?</h2>
              <button type="button" onClick={hideNewcomer} className={`-mt-1 -mr-1 min-h-11 rounded-lg border-0 bg-transparent px-2 text-xs font-bold ${T.dimText} focus-visible:outline-none focus-visible:ring-2 ${T.ring}`}>
                Hide
              </button>
            </div>
            <p className={"m-0 mt-1 text-sm leading-relaxed " + T.dimText}>
              Zlegend2700 is free chess with no ads and no account needed. Play bots that play like real people at your level, get your games graded, and more:
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                { label: "Play a bot", icon: iconOf("play"), go: onPlay },
                { label: "Puzzles", icon: iconOf("puzzles"), go: () => onEnter("puzzles") },
                { label: "Learn", icon: iconOf("learn"), go: () => onEnter("lessons") },
                { label: "Chess Tactica", icon: CUBE_ICON, go: onTactica },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.go}
                  className={`flex min-h-11 items-center gap-2 rounded-lg border ${T.cardBorder} bg-transparent px-3 text-left text-sm font-bold ${T.ink} transition-colors focus-visible:outline-none focus-visible:ring-2 ${T.ring}`}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={"shrink-0 " + T.accentText}><path d={item.icon} /></svg>
                  {item.label}
                </button>
              ))}
            </div>
          </section>
        )}
      </div>

      <div className="relative z-10 mt-6">
        <Suspense fallback={<div style={{ height: 300 }} aria-hidden="true" />}><YouTubeTv /></Suspense>
      </div>

      <SocialBanner />

      <footer className={"mt-3 text-center text-xs " + T.dimText}>
        Built by <a href="https://www.youtube.com/@Zlegend27" target="_blank" rel="noopener noreferrer" className={(sweetheart ? "text-sh-lteal" : "text-cyan") + " inline-block py-2 hover:underline"}>Zlegend27</a> · <a href="https://github.com/Zlegend27/zlegends-chess-bot" target="_blank" rel="noopener noreferrer" className={(sweetheart ? "text-sh-lteal" : "text-cyan") + " inline-block py-2 hover:underline"}>Source code</a> · <a href="https://github.com/Zlegend27/zlegends-chess-bot/blob/main/NOTICE.md" target="_blank" rel="noopener noreferrer" className={(sweetheart ? "text-sh-lteal" : "text-cyan") + " inline-block py-2 hover:underline"}>Licenses</a>
        <br />
        <a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer" className={(sweetheart ? "text-sh-lteal" : "text-cyan") + " inline-block py-2 hover:underline"}>Support the site</a> · <a href="/privacy" className={(sweetheart ? "text-sh-lteal" : "text-cyan") + " inline-block py-2 hover:underline"}>Privacy</a> · <a href="/terms" className={(sweetheart ? "text-sh-lteal" : "text-cyan") + " inline-block py-2 hover:underline"}>Terms</a>
      </footer>
    </div>
  );
}
