/** Shared between App.jsx (Rush start menu) and LeaderboardPage.jsx (its
 *  duration tabs) so the two lists of durations can't drift apart.
 *  `seconds: null` is the No Timer variant -- App.jsx's countdown effect
 *  skips entirely when rushDuration is null, and it's excluded from the
 *  leaderboard (rush_scores.duration_seconds is NOT NULL, and "most
 *  solved with unlimited time" isn't a comparable leaderboard stat
 *  anyway), so LeaderboardPage.jsx never needs to render a tab for it. */
export const RUSH_DURATIONS = [
  { seconds: 60, label: "1 Minute" },
  { seconds: 180, label: "3 Minutes" },
  { seconds: 300, label: "5 Minutes" },
  { seconds: null, label: "No Timer" },
];
