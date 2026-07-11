import { useEffect, useState } from "react";
import StarField from "./StarField";
import { TopNav } from "./ExploreNav";
import SocialBanner from "./SocialBanner";
import { fetchLeaderboard } from "../utils/leaderboard";
import { RUSH_DURATIONS } from "../utils/rushDurations";

/** Puzzle Rush leaderboard, as its own page rather than a modal -- every
 *  "View Leaderboard" trigger in the app should navigate here (see
 *  App.jsx's openLeaderboard) instead of opening an overlay, so this is
 *  the one place that pattern lives. Self-contained: owns its own
 *  duration/rows state rather than lifting it into App.jsx.
 *
 *  onToolSelect/activeToolId are the same handlers the Play screen's
 *  TopNav uses -- every non-home page gets the same nav bar at the top,
 *  not just Play (see App.jsx's onToolSelect for why it flips siteView
 *  back to "play" for Music/Settings, which only mount there). */
export default function LeaderboardPage({ initialDuration = 60, onBack, onToolSelect, activeToolId }) {
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
      <TopNav onSelect={onToolSelect} active={activeToolId} />
      <div className="hdr">
        <h1 style={{ fontSize: 34, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M7 4V2h10v2h4v3c0 2.21-1.79 4-4 4h-.08A6.007 6.007 0 0 1 13 15.92V18h3v2H8v-2h3v-2.08A6.007 6.007 0 0 1 7.08 9H7c-2.21 0-4-1.79-4-4V4h4zm-2 2v1c0 1.1.9 2 2 2V6H5zm12 0v3c1.1 0 2-.9 2-2V6h-2z" />
          </svg>
          Leaderboard
        </h1>
        <div className="sub">Puzzle Rush · top solvers</div>
      </div>

      <div className="ctrls" style={{ marginTop: 18 }}>
        {RUSH_DURATIONS.map(d => (
          <button key={d.seconds} className={"btn" + (duration === d.seconds ? "" : " ghost")}
            onClick={() => setDuration(d.seconds)}>{d.label}</button>
        ))}
      </div>

      <div className="rows" style={{ maxHeight: "none", width: "min(88vw,440px)", marginTop: 16 }}>
        {rows === null ? (
          <div className="pv" style={{ padding: "8px 2px" }}>Loading…</div>
        ) : rows.length === 0 ? (
          <div className="pv" style={{ padding: "8px 2px" }}>No scores yet for this duration — be the first!</div>
        ) : (
          rows.map((row, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 2px", borderBottom: "1px solid #8B2FC92E" }}>
              <span>#{i + 1} {row.display_name || "Anonymous"}</span>
              <b>{row.solved}</b>
            </div>
          ))
        )}
      </div>

      <button className="btn ghost" style={{ marginTop: 20 }} onClick={onBack}>← Back</button>

      <SocialBanner />
    </div>
  );
}
