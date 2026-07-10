import { useEffect, useState } from "react";
import StarField from "./StarField";
import { fetchLeaderboard } from "../utils/leaderboard";
import { RUSH_DURATIONS } from "../utils/rushDurations";

/** Puzzle Rush leaderboard, as its own page rather than a modal -- every
 *  "View Leaderboard" trigger in the app should navigate here (see
 *  App.jsx's openLeaderboard) instead of opening an overlay, so this is
 *  the one place that pattern lives. Self-contained: owns its own
 *  duration/rows state rather than lifting it into App.jsx. */
export default function LeaderboardPage({ initialDuration = 60, onBack }) {
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
      <div className="hdr">
        <h1 style={{ fontSize: 34 }}>🏆 Leaderboard</h1>
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
    </div>
  );
}
