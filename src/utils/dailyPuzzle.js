/* Deterministic "same puzzle for everyone today" -- purely a function of
   the UTC date and the puzzle pool, no server/schedule needed. */
export function todayKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
}
export function dailyPuzzle(allPuzzles) {
  if (!allPuzzles.length) return null;
  const dayNum = Math.floor(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()) / 86400000);
  return allPuzzles[dayNum % allPuzzles.length];
}
