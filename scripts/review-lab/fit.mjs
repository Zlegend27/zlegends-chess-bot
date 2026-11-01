/* Tunes the review's win-chance and accuracy curves against Chess.com's scores.

   Half the games are locked away. Options are compared on the open half (fit
   on one part, judged on the other), and only the chosen version is scored on
   the locked half, so the final numbers aren't flattered by the tuning.

   Usage: node scripts/review-lab/fit.mjs */
import { readFileSync, writeFileSync } from "node:fs";
import { BANDS } from "./bands.mjs";

const DATA = new URL("./data/", import.meta.url);
const sides = JSON.parse(readFileSync(new URL("features.json", DATA), "utf8"));
const bucket = (s) => parseInt(s.id.slice(0, 8), 16) % 4;
const locked = sides.filter((s) => bucket(s) % 2 === 0);
const open = sides.filter((s) => bucket(s) % 2 === 1);
const fitSet = open.filter((s) => bucket(s) === 1);
const checkSet = open.filter((s) => bucket(s) === 3);

/* Expected points for the mover: a logistic curve that steepens with rating,
   since stronger players convert the same edge more reliably. */
const expected = (cp, k) => 1 / (1 + Math.exp(-k * cp));

function sideAccuracy(side, p, opts) {
  const k = Math.max(0.0001, p.k0 + p.k1 * (side.elo / 1000));
  const b = Math.max(0.001, p.b0 + p.b1 * (side.elo / 1000));
  let sum = 0;
  let n = 0;
  for (const [before, after, isBest, forced, book] of side.moves) {
    if (opts.skipForced && forced) continue;
    if (opts.book === "skip" && book) continue;
    let acc;
    if (opts.book === "full" && book) acc = 100;
    else if (opts.bestIsZero && isBest) acc = 100;
    else {
      const loss = Math.max(0, expected(before, k) - expected(after, k)) * 100;
      acc = 100 * Math.exp(-b * loss ** p.g);
    }
    sum += acc;
    n++;
  }
  return n ? sum / n : null;
}

function errors(set, p, opts) {
  const out = [];
  for (const s of set) {
    const a = sideAccuracy(s, p, opts);
    if (a != null) out.push(a - s.target);
  }
  return out;
}

const rmse = (e) => Math.sqrt(e.reduce((a, x) => a + x * x, 0) / e.length);

/* Nelder-Mead: needs no gradients, and these curves have few parameters. */
function minimize(f, start) {
  const n = start.length;
  let simplex = [start, ...start.map((v, i) => start.map((x, j) => (i === j ? x * 1.25 + 0.0005 : x)))]
    .map((x) => ({ x, f: f(x) }));
  for (let iter = 0; iter < 260; iter++) {
    simplex.sort((a, b) => a.f - b.f);
    const worst = simplex[n];
    const centre = start.map((_, j) => simplex.slice(0, n).reduce((a, v) => a + v.x[j], 0) / n);
    const along = (t) => centre.map((c, j) => c + t * (worst.x[j] - c));
    const reflected = along(-1);
    const fr = f(reflected);
    if (fr < simplex[0].f) {
      const expanded = along(-2);
      const fe = f(expanded);
      simplex[n] = fe < fr ? { x: expanded, f: fe } : { x: reflected, f: fr };
    } else if (fr < simplex[n - 1].f) {
      simplex[n] = { x: reflected, f: fr };
    } else {
      const contracted = along(0.5);
      const fc = f(contracted);
      if (fc < worst.f) simplex[n] = { x: contracted, f: fc };
      else simplex = simplex.map((v, i) => (i === 0 ? v : (() => { const x = v.x.map((c, j) => simplex[0].x[j] + 0.5 * (c - simplex[0].x[j])); return { x, f: f(x) }; })()));
    }
  }
  simplex.sort((a, b) => a.f - b.f);
  return simplex[0].x;
}

/* NO_RATING=1 tests a single curve for everyone, for games with no ratings. */
const NO_RATING = process.env.NO_RATING === "1";
const toParams = ([k0, k1, b0, b1, g]) => ({ k0, k1: NO_RATING ? 0 : k1, b0, b1: NO_RATING ? 0 : b1, g });
const START = [0.004, 0.0005, 0.06, 0, 0.8];
const fit = (set, opts) => toParams(minimize((x) => rmse(errors(set, toParams(x), opts)), START));

const VARIANTS = {
  "real losses, book counted": { book: "count", bestIsZero: false, skipForced: false },
  "best move = no loss": { book: "count", bestIsZero: true, skipForced: false },
  "+ skip forced moves": { book: "count", bestIsZero: true, skipForced: true },
  "+ book moves = 100": { book: "full", bestIsZero: true, skipForced: true },
  "+ book moves skipped": { book: "skip", bestIsZero: true, skipForced: true },
};

console.log(`Fit on ${fitSet.length} scores, judged on ${checkSet.length}, ${locked.length} locked away\n`);
let best = null;
const results = {};
/* ONLY=name fits one option, for when the app has already settled on it. */
const tried = Object.entries(VARIANTS).filter(([name]) => !process.env.ONLY || name === process.env.ONLY);
for (const [name, opts] of tried) {
  const params = fit(fitSet, opts);
  const score = rmse(errors(checkSet, params, opts));
  results[name] = { rmseOnCheck: +score.toFixed(3) };
  if (!best || score < best.score) best = { name, opts, score };
}
console.table(results);
console.log(`Chosen: ${best.name}\n`);

const params = fit(open, best.opts);
console.log("Final curve:", JSON.stringify(Object.fromEntries(Object.entries(params).map(([k, v]) => [k, +v.toFixed(6)]))));

function summary(set) {
  const list = set.flatMap((s) => {
    const a = sideAccuracy(s, params, best.opts);
    return a == null ? [] : [{ a, t: s.target }];
  });
  const m = (f) => list.reduce((x, r) => x + f(r), 0) / list.length;
  const ma = m((r) => r.a);
  const mt = m((r) => r.t);
  const cov = m((r) => (r.a - ma) * (r.t - mt));
  const sa = Math.sqrt(m((r) => (r.a - ma) ** 2));
  const st = Math.sqrt(m((r) => (r.t - mt) ** 2));
  return {
    sides: list.length,
    ours: ma.toFixed(1),
    chesscom: mt.toFixed(1),
    bias: (ma - mt).toFixed(1),
    typicalMiss: m((r) => Math.abs(r.a - r.t)).toFixed(1),
    rmse: Math.sqrt(m((r) => (r.a - r.t) ** 2)).toFixed(1),
    correlation: (cov / (sa * st)).toFixed(3),
    within5: `${Math.round(m((r) => (Math.abs(r.a - r.t) <= 5 ? 1 : 0)) * 100)}%`,
  };
}

const table = {};
for (const band of BANDS) {
  const set = locked.filter((s) => s.band === band);
  if (set.length) table[band] = summary(set);
}
table.ALL = summary(locked);
console.log("\nLocked games:");
console.table(table);
writeFileSync(new URL(NO_RATING ? "model-no-rating.json" : "model.json", DATA), JSON.stringify({ params, opts: best.opts }, null, 2));
