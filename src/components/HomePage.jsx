import { lazy, Suspense, useMemo, useState } from "react";
import StarField from "./StarField";
import SocialBanner from "./SocialBanner";
import BotBubble from "./BotBubble";
import { pickWelcomeLine } from "../utils/botLines";
import { getUiTheme } from "../utils/uiTheme";
import { SUPPORT_URL } from "../utils/links";

/* Below the buttons, so it loads after the first page instead of with it. */
const YouTubeTv = lazy(() => import("./YouTubeTv"));

/* Game Review is always on Home: it's a main feature, and on Chess.com
   reviews are paid, so it's the thing to point at. */
const REVIEW_ICON = "M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z";

/** The front door: the mascot's greeting, Play, and Game Review, then the
 *  TV. Nothing else: the menu (AppNav.jsx) covers the full tour, and the
 *  daily puzzle and suggestions that used to sit here made it cluttered.
 *  Everything above the socials should fit on a phone screen. */
export default function HomePage({ onEnter, onPlay, hasLiveGame, firstVisit, rankElo, rankGames, sweetheart }) {
  /* Picked once per mount so it doesn't reroll mid-typewriter. */
  const [dismissed, setDismissed] = useState(false);
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
