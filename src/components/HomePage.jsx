import { useMemo, useState } from "react";
import StarField from "./StarField";
import SocialBanner from "./SocialBanner";
import BotBubble from "./BotBubble";
import YouTubeTv from "./YouTubeTv";
import MiniBoard from "./MiniBoard";
import { pickWelcomeLine } from "../utils/botLines";
import { utcDay } from "../utils/dailyStreak";
import { getUiTheme } from "../utils/uiTheme";

/* Game Review is always on Home: it's a main feature, and on Chess.com
   reviews are paid, so it's the thing to point at. */
const REVIEW_ICON = "M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z";

/* One a day, so Home gently points at something else the player might not
   have found. Each opens the same way its menu item does. */
const SUGGESTIONS = [
  { id: "rank", title: "Try Rank Bot", desc: "An adaptive bot that estimates your rating as you play.", icon: "M12 2l2.9 6.9L22 9.6l-5.5 4.8L18 22l-6-3.6L6 22l1.5-7.6L2 9.6l7.1-.7L12 2z" },
  { id: "lessons", title: "Learn something new", desc: "Short lessons on openings and tactics.", icon: "M12 3 1 9l11 6 9-4.91V17h2V9L12 3zm0 13.5L4.24 12.3 3 13l9 5 9-5-1.24-.7L12 16.5zM5 14.18v3.82c0 1.1 3.13 3 7 3s7-1.9 7-3v-3.82l-7 3.82-7-3.82z" },
  { id: "rush", title: "Race the clock", desc: "Solve as many puzzles as you can in Puzzle Rush.", icon: "M7 2v11h3v9l7-12h-4l4-8z" },
  { id: "openings", title: "Study an opening", desc: "Browse the Italian, Sicilian, Ruy Lopez and more.", icon: "M12 5.5C10.5 4 8 3 4 3v14c4 0 6.5 1 8 2.5V5.5zM12 5.5C13.5 4 16 3 20 3v14c-4 0-6.5 1-8 2.5V5.5z" },
];

/** The front door: what to do next, not a list of everything. The menu
 *  (AppNav.jsx) covers the full tour, and repeating it here is what the old
 *  tile grid did. Everything above the socials should fit on a phone screen. */
export default function HomePage({
  onEnter, onPlay, onDaily, hasLiveGame, daily, dailySolved, streak,
  boardColors, pieceImgSrc, firstVisit, rankElo, rankGames, sweetheart,
}) {
  /* Picked once per mount so it doesn't reroll mid-typewriter. */
  const [dismissed, setDismissed] = useState(false);
  const welcomeLine = useMemo(
    () => pickWelcomeLine({ firstVisit, rankElo, games: rankGames }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const T = useMemo(() => getUiTheme(sweetheart), [sweetheart]);
  const card = `flex w-full items-center gap-4 rounded-2xl border ${T.cardBorder} ${T.panelBg} p-3 text-left backdrop-blur-sm transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 ${T.ring}`;
  const eyebrow = `text-[10px] font-bold uppercase tracking-[0.16em] ${T.dimText}`;
  const suggestion = SUGGESTIONS[utcDay() % SUGGESTIONS.length];

  return (
    <div className="root">
      <StarField sweetheart={sweetheart} />
      {!dismissed && <BotBubble line={welcomeLine} onDismiss={() => setDismissed(true)} />}

      <div className="relative z-10 mt-3 flex w-full max-w-md flex-col gap-3">
        <button type="button" className="btn gold" style={{ width: "100%" }} onClick={onPlay}>
          {hasLiveGame ? "Resume Game" : "Play"}
        </button>

        <button type="button" className={card} onClick={onDaily} disabled={!daily}>
          {daily ? (
            <MiniBoard fen={daily.fen} colors={boardColors} pieceImgSrc={pieceImgSrc} />
          ) : (
            <div className={`size-[104px] shrink-0 rounded-lg ${T.panelBg}`} aria-hidden="true" />
          )}
          <span className="min-w-0">
            <span className={"block " + eyebrow}>Daily Puzzle</span>
            <span className={"mt-1 block text-base font-bold " + T.ink}>
              {dailySolved ? "Solved today" : daily ? `Rated ${daily.rating}` : "Loading…"}
            </span>
            {streak > 0 && (
              <span className={"mt-1 block text-xs " + T.dimText}>{streak} day streak</span>
            )}
          </span>
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

        <button type="button" className={card} onClick={() => onEnter(suggestion.id)}>
          <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${T.accentText}`} aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d={suggestion.icon} /></svg>
          </span>
          <span className="min-w-0">
            <span className={"block text-sm font-bold " + T.ink}>{suggestion.title}</span>
            <span className={"mt-1 block text-xs leading-relaxed " + T.dimText}>{suggestion.desc}</span>
          </span>
        </button>
      </div>

      <div className="relative z-10 mt-6">
        <YouTubeTv sweetheart={sweetheart} />
      </div>

      <SocialBanner />

      <footer className={"mt-3 text-center text-xs " + T.dimText}>
        Built by <a href="https://www.youtube.com/@Zlegend27" target="_blank" rel="noopener noreferrer" className={(sweetheart ? "text-sh-lteal" : "text-cyan") + " hover:underline"}>Zlegend27</a> · <a href="https://github.com/Zlegend27/zlegends-chess-bot" target="_blank" rel="noopener noreferrer" className={(sweetheart ? "text-sh-lteal" : "text-cyan") + " hover:underline"}>Source code</a> · <a href="https://github.com/Zlegend27/zlegends-chess-bot/blob/main/NOTICE.md" target="_blank" rel="noopener noreferrer" className={(sweetheart ? "text-sh-lteal" : "text-cyan") + " hover:underline"}>Licenses</a>
      </footer>
    </div>
  );
}
