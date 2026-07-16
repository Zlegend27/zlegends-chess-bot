import { useEffect, useState } from "react";
import StarField from "./StarField";
import { TopNav } from "./ExploreNav";
import SocialBanner from "./SocialBanner";
import { fetchLeaderboard } from "../utils/leaderboard";
import { RUSH_DURATIONS } from "../utils/rushDurations";

const RANK_ACCENT = {
  1: { text: "text-yellow", medal: "🥇" },
  2: { text: "text-liliac", medal: "🥈" },
  3: { text: "text-[#E0A968]", medal: "🥉" },
};

/** Puzzle Rush leaderboard, as its own page rather than a modal -- every
 *  "View Leaderboard" trigger in the app should navigate here (see
 *  App.jsx's openLeaderboard) instead of opening an overlay, so this is
 *  the one place that pattern lives. Self-contained: owns its own
 *  duration/rows state rather than lifting it into App.jsx.
 *
 *  onToolSelect/activeToolId are the same handlers the Play screen's
 *  TopNav uses -- every non-home page gets the same nav bar at the top,
 *  not just Play (see App.jsx's onToolSelect for why it flips siteView
 *  back to "play" for Music/Settings, which only mount there).
 *
 *  Rebuilt on Tailwind utility classes (matching HomePage.jsx/
 *  ExploreNav.jsx) instead of the raw inline `style={{...}}` this page
 *  started with -- .rows/.btn/.pv are the older hand-CSS pattern used
 *  elsewhere for modals, which this page isn't. */
export default function LeaderboardPage({ initialDuration = 60, onBack, onToolSelect, activeToolId, profile }) {
  const [duration, setDuration] = useState(initialDuration);
  const [rows, setRows] = useState(null);

  useEffect(() => {
    setRows(null);
    fetchLeaderboard(duration).then(setRows);
  }, [duration]);

  useEffect(() => {
    const onKeyDown = (e) => { if (e.key === "Escape") onBack(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onBack]);

  return (
    <div className="root">
      <StarField />
      <TopNav onSelect={onToolSelect} active={activeToolId} profile={profile} />

      <button
        onClick={onBack}
        className="mb-2 inline-flex items-center gap-1.5 self-start bg-transparent text-sm font-bold text-dim transition-colors hover:text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20z" /></svg>
        Back
      </button>

      <div className="hdr">
        <h1 style={{ fontSize: 34, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M7 4V2h10v2h4v3c0 2.21-1.79 4-4 4h-.08A6.007 6.007 0 0 1 13 15.92V18h3v2H8v-2h3v-2.08A6.007 6.007 0 0 1 7.08 9H7c-2.21 0-4-1.79-4-4V4h4zm-2 2v1c0 1.1.9 2 2 2V6H5zm12 0v3c1.1 0 2-.9 2-2V6h-2z" />
          </svg>
          Leaderboard
        </h1>
        <div className="sub">Puzzle Rush · top solvers</div>
      </div>

      <div className="mt-5 flex gap-2">
        {RUSH_DURATIONS.map(d => (
          <button key={d.seconds} className={"btn" + (duration === d.seconds ? "" : " ghost")}
            onClick={() => setDuration(d.seconds)}>{d.label}</button>
        ))}
      </div>

      <div className="mt-4 w-full max-w-md overflow-hidden rounded-2xl border border-violet/40 bg-panel/80 backdrop-blur-sm">
        {rows === null ? (
          <div className="px-4 py-6 text-center text-sm text-dim">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor" className="text-violet/40" aria-hidden="true">
              <path d="M7 4V2h10v2h4v3c0 2.21-1.79 4-4 4h-.08A6.007 6.007 0 0 1 13 15.92V18h3v2H8v-2h3v-2.08A6.007 6.007 0 0 1 7.08 9H7c-2.21 0-4-1.79-4-4V4h4zm-2 2v1c0 1.1.9 2 2 2V6H5zm12 0v3c1.1 0 2-.9 2-2V6h-2z" />
            </svg>
            <p className="text-sm text-dim">No scores yet for this duration — be the first!</p>
          </div>
        ) : (
          <div className="divide-y divide-violet/18">
            {rows.map((row, i) => {
              const rank = i + 1;
              const accent = RANK_ACCENT[rank];
              return (
                <div key={i} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span className={`flex items-center gap-2 text-sm ${accent ? `font-bold ${accent.text}` : "text-paper"}`}>
                    <span className="w-6 text-right tabular-nums">{accent ? accent.medal : `#${rank}`}</span>
                    {row.display_name || "Anonymous"}
                  </span>
                  <b className={accent ? accent.text : "text-paper"}>{row.solved}</b>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <SocialBanner />
    </div>
  );
}
