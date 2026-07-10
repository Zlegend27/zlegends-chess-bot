/** Shared between App.jsx (Rush start menu) and LeaderboardPage.jsx (its
 *  duration tabs) so the two lists of durations can't drift apart. */
export const RUSH_DURATIONS = [
  { seconds: 60, label: "1 Minute" },
  { seconds: 180, label: "3 Minutes" },
  { seconds: 300, label: "5 Minutes" },
];
