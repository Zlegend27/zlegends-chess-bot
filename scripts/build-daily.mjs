/* Writes the next DAYS daily puzzles to src/data/dailyCalendar.json, so the
   home page's Daily card can show today's puzzle without downloading all
   1,000 (src/utils/dailyPuzzle.js falls back to the full set if the
   calendar ever runs out). Picks are exactly dailyPuzzle()'s: the same
   puzzle for everyone on a given UTC day.

   Runs before every build and dev server (see package.json), so each
   deploy carries a fresh calendar. The output is generated, not committed. */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const DAYS = 120;
const { puzzles } = JSON.parse(readFileSync(new URL("../src/utils/puzzles-lichess.json", import.meta.url), "utf8"));
const now = new Date();
const today = Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 86400000);
/* Start a day early so a visitor a few hours behind UTC midnight is covered. */
const firstDay = today - 1;
const days = Array.from({ length: DAYS }, (_, i) => puzzles[(firstDay + i) % puzzles.length]);

mkdirSync(new URL("../src/data/", import.meta.url), { recursive: true });
writeFileSync(new URL("../src/data/dailyCalendar.json", import.meta.url), JSON.stringify({ firstDay, poolSize: puzzles.length, days }));
console.log(`daily calendar: ${DAYS} days from day ${firstDay}`);
