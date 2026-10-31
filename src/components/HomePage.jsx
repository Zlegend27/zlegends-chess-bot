import { useEffect, useMemo, useState } from "react";
import StarField from "./StarField";
import SocialBanner from "./SocialBanner";
import BotBubble from "./BotBubble";
import YouTubeTv from "./YouTubeTv";
import MiniBoard from "./MiniBoard";
import { pickWelcomeLine } from "../utils/botLines";
import { fetchRecentGames, summarizeGame } from "../utils/gameHistory";
import { utcDay } from "../utils/dailyStreak";
import { getUiTheme } from "../utils/uiTheme";

const OUTCOME_LABEL = { win: "Won", loss: "Lost", draw: "Draw", abandoned: "Abandoned" };

/* One a day, so Home gently points at something the player might not have
   found. Each opens the same way its menu item does. */
const SUGGESTIONS = [
  { id: "rank", title: "Try Rank Bot", desc: "An adaptive bot that estimates your rating as you play." },
  { id: "lessons", title: "Learn something new", desc: "Short lessons on openings and tactics." },
  { id: "review", title: "Review a game", desc: "Paste any game, even one from Chess.com or Lichess, and see every move graded." },
  { id: "rush", title: "Race the clock", desc: "Solve as many puzzles as you can in Puzzle Rush." },
  { id: "openings", title: "Study an opening", desc: "Browse the Italian, Sicilian, Ruy Lopez and more." },
];

/** The front door: what to do next, not a list of everything. The menu
 *  (AppNav.jsx) covers the full tour, and repeating it here is what the old
 *  tile grid did. Everything above the socials should fit on a phone screen. */
export default function HomePage({
  onEnter, onPlay, onDaily, onOpenSaved, hasLiveGame, daily, dailySolved, streak,
  boardColors, pieceImgSrc, firstVisit, rankElo, rankGames, sweetheart,
}) {
  /* Picked once per mount so it doesn't reroll mid-typewriter. */
  const [dismissed, setDismissed] = useState(false);
  const welcomeLine = useMemo(
    () => pickWelcomeLine({ firstVisit, rankElo, games: rankGames }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const [lastGame, setLastGame] = useState(null);
  useEffect(() => {
    let live = true;
    fetchRecentGames(1).then((r) => { if (live && r.games?.[0]) setLastGame(summarizeGame(r.games[0])); });
    return () => { live = false; };
  }, []);

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

        {lastGame && (
          <button type="button" className={card} onClick={() => onOpenSaved(lastGame)}>
            <span className="min-w-0 flex-1">
              <span className={"block " + eyebrow}>Your last game</span>
              <span className={"mt-1 block text-sm font-bold " + T.ink}>
                vs {lastGame.opponent} · {OUTCOME_LABEL[lastGame.outcome]}
              </span>
            </span>
            <span className={"shrink-0 text-xs font-bold " + T.interactiveText}>Review</span>
          </button>
        )}

        <button type="button" className={card} onClick={() => onEnter(suggestion.id)}>
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
        Built by <a href="https://www.youtube.com/@Zlegend27" target="_blank" rel="noopener noreferrer" className={(sweetheart ? "text-sh-lteal" : "text-cyan") + " hover:underline"}>Zlegend27</a> — all rights reserved.
      </footer>
    </div>
  );
}
