/* Deterministic "same puzzle for everyone today" -- purely a function of
   the UTC date and the puzzle pool, no server/schedule needed. */
import { utcDay } from "./dailyStreak";

export function todayKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
}

export function dailyPuzzle(allPuzzles) {
  if (!allPuzzles.length) return null;
  return allPuzzles[utcDay() % allPuzzles.length];
}

/* The next few months of daily picks, written before each build by
   scripts/build-daily.mjs: a ~7KB file instead of the ~48KB pool of 1,000.
   Looked up with a glob so a missing file (Vite run without the pre-step)
   just means "use the full pool". */
const calendars = import.meta.glob("../data/dailyCalendar.json", { import: "default" });

/** Today's puzzle, from the small calendar when it covers today, otherwise
 *  from the full pool. Resolves to null only if both are unavailable. */
export async function loadDailyPuzzle() {
  const loadCalendar = calendars["../data/dailyCalendar.json"];
  const calendar = loadCalendar ? await loadCalendar().catch(() => null) : null;
  const today = utcDay();
  const fromCalendar = calendar?.days?.[today - calendar.firstDay];
  if (fromCalendar) return fromCalendar;
  const { PUZZLES } = await import("./puzzles");
  return dailyPuzzle(PUZZLES);
}
