/* Consecutive days with the Daily Puzzle solved. Days are UTC to match
   dailyPuzzle in App.jsx, so the streak turns over with the puzzle itself. */
export const utcDay = (date = new Date()) =>
  Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86400000);

/** The saved streak after solving today. Solving twice in a day is harmless. */
export function nextStreak(saved, today) {
  if (saved?.day === today) return saved;
  return { day: today, count: saved?.day === today - 1 ? saved.count + 1 : 1 };
}

/** What to show: yesterday's solve still counts, since today isn't over. */
export function currentStreak(saved, today) {
  return saved && saved.day >= today - 1 ? saved.count : 0;
}
