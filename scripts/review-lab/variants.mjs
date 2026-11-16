/* Tries other ways of turning a side's moves into one accuracy number, to see
   whether any gets closer to Chess.com's than the app's plain average
   (src/utils/reviewScoring.js). Same split as fit.mjs: fitted on one part of
   the open half, judged on the other, and only then scored on the locked
   half. Also asks how well accuracy alone can guess a player's rating.

   Usage: node scripts/review-lab/variants.mjs */
import { readFileSync } from "node:fs";
import { BANDS } from "./bands.mjs";

const sides = JSON.parse(readFileSync(new URL("./data/features.json", import.meta.url), "utf8"));
const bucket = (s) => parseInt(s.id.slice(0, 8), 16) % 4;
const locked = sides.filter((s) => bucket(s) % 2 === 0);
const fitSet = sides.filter((s) => bucket(s) === 1);
const checkSet = sides.filter((s) => bucket(s) === 3);

const expected = (cp, k) => 100 / (1 + Math.exp(-k * cp));
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };

/* Each variant: a start point and a function from (side, params) to accuracy. */
function perMove(side, k, b, g, cap = Infinity) {
  const out = [];
  for (const [before, after, isBest, forced, book] of side.moves) {
    if (forced) continue;
    if (book || isBest) { out.push({ acc: 100, before }); continue; }
    const loss = Math.min(cap, Math.max(0, expected(before, k) - expected(after, k)));
    out.push({ acc: 100 * Math.exp(-b * loss ** g), before });
  }
  return out;
}
const harmonic = (a) => a.length / a.reduce((x, y) => x + 1 / Math.max(y, 1), 0);
/* Lichess-style: moves in the turbulent parts of a game count for more. */
function volatilityWeighted(moves, k) {
  const win = moves.map((m) => expected(m.before, k));
  const size = Math.max(2, Math.min(8, Math.round(moves.length / 10)));
  let sum = 0, total = 0;
  moves.forEach((m, i) => {
    const lo = Math.max(0, Math.min(i - (size >> 1), moves.length - size));
    const w = Math.min(12, Math.max(0.5, sd(win.slice(lo, lo + size))));
    sum += w * m.acc; total += w;
  });
  return sum / total;
}

const VARIANTS = {
  "plain average (the app today)": {
    start: [0.0023, 0.13, 1.5],
    acc: (s, [k, b, g]) => { const m = perMove(s, k, b, g); return m.length ? mean(m.map((x) => x.acc)) : null; },
  },
  "average blended with harmonic mean": {
    start: [0.0023, 0.13, 1.5, 0.3],
    acc: (s, [k, b, g, w]) => {
      const m = perMove(s, k, b, g).map((x) => x.acc);
      const t = Math.min(1, Math.max(0, w));
      return m.length ? (1 - t) * mean(m) + t * harmonic(m) : null;
    },
  },
  "turbulent moves weigh more": {
    start: [0.0023, 0.13, 1.5],
    acc: (s, [k, b, g]) => { const m = perMove(s, k, b, g); return m.length ? volatilityWeighted(m, k) : null; },
  },
  "one move can only cost so much": {
    start: [0.0023, 0.13, 1.5, 40],
    acc: (s, [k, b, g, cap]) => { const m = perMove(s, k, b, g, Math.max(5, cap)); return m.length ? mean(m.map((x) => x.acc)) : null; },
  },
  "plain average, then straightened": {
    start: [0.0023, 0.13, 1.5, 1, 0],
    acc: (s, [k, b, g, a, c]) => { const m = perMove(s, k, b, g); return m.length ? Math.min(100, Math.max(0, a * mean(m.map((x) => x.acc)) + c)) : null; },
  },
  "harmonic blend, then straightened": {
    start: [0.0024, 0.06, 1.3, 0.05, 1.6, -60],
    acc: (s, [k, b, g, w, a, c]) => {
      const m = perMove(s, k, b, g).map((x) => x.acc);
      const t = Math.min(1, Math.max(0, w));
      return m.length ? Math.min(100, Math.max(0, a * ((1 - t) * mean(m) + t * harmonic(m)) + c)) : null;
    },
  },
  "straightened, a perfect game still 100": {
    start: [0.0024, 0.06, 1.3, 1.6],
    acc: (s, [k, b, g, a]) => { const m = perMove(s, k, b, g); return m.length ? Math.min(100, Math.max(0, 100 - a * (100 - mean(m.map((x) => x.acc))))) : null; },
  },
  "short games pulled toward the middle": {
    start: [0.0023, 0.13, 1.5, 5, 75],
    acc: (s, [k, b, g, n0, mid]) => {
      const m = perMove(s, k, b, g);
      if (!m.length) return null;
      const n = Math.max(0, n0);
      return (mean(m.map((x) => x.acc)) * m.length + mid * n) / (m.length + n);
    },
  },
};

const errs = (set, v, p) => set.flatMap((s) => { const a = v.acc(s, p); return a == null || !Number.isFinite(a) ? [] : [a - s.target]; });
const rmse = (e) => Math.sqrt(mean(e.map((x) => x * x)));

function minimize(f, start) {
  const n = start.length;
  let simplex = [start, ...start.map((v, i) => start.map((x, j) => (i === j ? x * 1.25 + 0.0005 : x)))].map((x) => ({ x, f: f(x) }));
  for (let iter = 0; iter < 400; iter++) {
    simplex.sort((a, b) => a.f - b.f);
    const worst = simplex[n];
    const centre = start.map((_, j) => simplex.slice(0, n).reduce((a, v) => a + v.x[j], 0) / n);
    const along = (t) => centre.map((c, j) => c + t * (worst.x[j] - c));
    const r = along(-1), fr = f(r);
    if (fr < simplex[0].f) { const e = along(-2), fe = f(e); simplex[n] = fe < fr ? { x: e, f: fe } : { x: r, f: fr }; }
    else if (fr < simplex[n - 1].f) simplex[n] = { x: r, f: fr };
    else {
      const c = along(0.5), fc = f(c);
      if (fc < worst.f) simplex[n] = { x: c, f: fc };
      else simplex = simplex.map((v, i) => { if (i === 0) return v; const x = v.x.map((q, j) => simplex[0].x[j] + 0.5 * (q - simplex[0].x[j])); return { x, f: f(x) }; });
    }
  }
  simplex.sort((a, b) => a.f - b.f);
  return simplex[0].x;
}

console.log(`Fitted on ${fitSet.length} scores, judged on ${checkSet.length}; ${locked.length} locked away\n`);
const table = {};
const fitted = {};
for (const [name, v] of Object.entries(VARIANTS)) {
  const p = minimize((x) => rmse(errs(fitSet, v, x)), v.start);
  fitted[name] = p;
  const e = errs(checkSet, v, p);
  table[name] = { rmse: rmse(e).toFixed(2), typicalMiss: mean(e.map(Math.abs)).toFixed(2), within5: Math.round(mean(e.map((x) => (Math.abs(x) <= 5 ? 1 : 0))) * 100) + "%", params: p.map((x) => +x.toPrecision(4)).join(", ") };
}
console.table(table);

const summarize = (set, v, p) => {
  const e = errs(set, v, p);
  return { sides: e.length, bias: mean(e).toFixed(1), typicalMiss: mean(e.map(Math.abs)).toFixed(1), rmse: rmse(e).toFixed(1), within5: Math.round(mean(e.map((x) => (Math.abs(x) <= 5 ? 1 : 0))) * 100) + "%" };
};
const show = process.env.LOCKED ? process.env.LOCKED.split("|") : [];
for (const name of show) {
  const v = VARIANTS[name];
  const open = sides.filter((s) => bucket(s) % 2 === 1);
  const p = minimize((x) => rmse(errs(open, v, x)), fitted[name]);
  console.log(`\nLocked games, "${name}" refitted on the whole open half: ${p.map((x) => +x.toPrecision(6)).join(", ")}`);
  const rows = {};
  for (const band of BANDS) rows[band] = summarize(locked.filter((s) => s.band === band), v, p);
  rows.ALL = summarize(locked, v, p);
  console.table(rows);
}

/* Can accuracy guess the rating? Chess.com's own score against the player's
   real rating: the best a rating-from-accuracy number could hope for. */
{
  const xs = fitSet.concat(checkSet);
  const mx = mean(xs.map((s) => s.target)), my = mean(xs.map((s) => s.elo));
  const slope = mean(xs.map((s) => (s.target - mx) * (s.elo - my))) / mean(xs.map((s) => (s.target - mx) ** 2));
  const guess = (s) => my + slope * (s.target - mx);
  const miss = locked.map((s) => Math.abs(guess(s) - s.elo));
  console.log(`\nRating guessed from Chess.com's own accuracy alone: typical miss ${Math.round(mean(miss))} Elo, within 200: ${Math.round(mean(miss.map((m) => (m <= 200 ? 1 : 0))) * 100)}% (always guessing the average rating misses by ${Math.round(mean(locked.map((s) => Math.abs(s.elo - my))))})`);
}
