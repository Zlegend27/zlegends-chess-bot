/* The scoreboard: how far our Game Review's accuracy is from Chess.com's, for
   each rating band. It scores with the app's own sideAccuracy, so what's
   measured here is what players get. Run features.mjs first.

   "Locked" is the half of the games the curves were never tuned on. Trust
   that table over the full one.

   Usage: node scripts/review-lab/score.mjs */
import { readFileSync } from "node:fs";
import { sideAccuracy } from "../../src/utils/reviewScoring.js";
import { BANDS } from "./bands.mjs";

const DATA = new URL("./data/", import.meta.url);
const sides = JSON.parse(readFileSync(new URL("features.json", DATA), "utf8"));
const isLocked = (s) => (parseInt(s.id.slice(0, 8), 16) % 4) % 2 === 0;

const rows = [];
for (const side of sides) {
  const moves = side.moves.map(([before, after, isBest, forced, book]) => ({ before, after, isBest: !!isBest, forced: !!forced, book: !!book }));
  const ours = sideAccuracy(moves);
  if (ours != null) rows.push({ band: side.band, locked: isLocked(side), ours, theirs: side.target });
}

function stats(list) {
  const n = list.length;
  const mean = (f) => list.reduce((a, r) => a + f(r), 0) / n;
  const meanOurs = mean((r) => r.ours);
  const meanTheirs = mean((r) => r.theirs);
  const cov = mean((r) => (r.ours - meanOurs) * (r.theirs - meanTheirs));
  const sdOurs = Math.sqrt(mean((r) => (r.ours - meanOurs) ** 2));
  const sdTheirs = Math.sqrt(mean((r) => (r.theirs - meanTheirs) ** 2));
  return {
    sides: n,
    ours: meanOurs.toFixed(1),
    chesscom: meanTheirs.toFixed(1),
    bias: (meanOurs - meanTheirs).toFixed(1),
    typicalMiss: mean((r) => Math.abs(r.ours - r.theirs)).toFixed(1),
    rmse: Math.sqrt(mean((r) => (r.ours - r.theirs) ** 2)).toFixed(1),
    correlation: (cov / (sdOurs * sdTheirs)).toFixed(3),
    within5: `${Math.round((list.filter((r) => Math.abs(r.ours - r.theirs) <= 5).length / n) * 100)}%`,
  };
}

function report(title, list) {
  const table = {};
  for (const band of BANDS) {
    const inBand = list.filter((r) => r.band === band);
    if (inBand.length) table[band] = stats(inBand);
  }
  if (list.length) table.ALL = stats(list);
  console.log(title);
  console.table(table);
}

report("Locked games", rows.filter((r) => r.locked));
report("All games", rows);
