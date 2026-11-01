/* Summarizes rankbot-sim.jsonl: how often players win, how close games stay,
   and whether the bot ever visibly throws.

   Usage: node scripts/review-lab/rankbot-report.mjs */
import { readFileSync } from "node:fs";
import { BANDS } from "./bands.mjs";

const rows = readFileSync(new URL("./data/rankbot-sim.jsonl", import.meta.url), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const pct = (x) => `${Math.round(x * 100)}%`;
const THROW_CP = 150;

function summarize(list) {
  const held = list.map((r) => {
    const end = r.plyAtClose ? Math.max(1, Math.floor((r.plyAtClose - 8) / 2)) : r.leads.length;
    return r.leads.slice(3, end);
  });
  const within = held.map((leads, i) => {
    const step = list[i].steps.slice(3, 3 + leads.length);
    return leads.length ? leads.filter((l, k) => l >= -step[k] && l <= (step[k] || 100) * 3).length / leads.length : 0;
  });
  const tight = held.map((leads, i) => {
    const step = list[i].steps.slice(3, 3 + leads.length);
    return leads.length ? leads.filter((l, k) => l >= -step[k] && l <= (step[k] || 100) * 1.5).length / leads.length : 0;
  });
  const flat = held.flat();
  const bigLead = flat.filter((l) => l >= 400).length / (flat.length || 1);
  const throws = list.flatMap((r) => r.gaveUp).filter((g) => g >= THROW_CP).length;
  const moves = list.reduce((a, r) => a + r.gaveUp.length, 0);
  return {
    games: list.length,
    humanWin: pct(list.filter((r) => r.botPoints === 0).length / list.length),
    draw: pct(list.filter((r) => r.botPoints === 0.5).length / list.length),
    botWin: pct(list.filter((r) => r.botPoints === 1).length / list.length),
    avgLead: Math.round(mean(flat)),
    "400+ lead": pct(bigLead),
    oneStep: pct(mean(tight)),
    closeShare: pct(mean(within)),
    humanAheadGames: pct(list.filter((r) => r.humanAheadMoves > 0).length / list.length),
    hungPerGame: mean(list.map((r) => r.hung ?? 0)).toFixed(2),
    bigDropPerGame: (throws / list.length).toFixed(1),
    plies: Math.round(mean(list.map((r) => r.plies))),
    humanLoss: Math.round(mean(list.flatMap((r) => r.humanLoss.map((l) => Math.min(l, 1000))))),
    dial: Math.round(mean(list.map((r) => r.dial))),
    msPerMove: Math.round(mean(list.flatMap((r) => r.ms))),
  };
}

for (const variant of [...new Set(rows.map((r) => r.variant))]) {
  const list = rows.filter((r) => r.variant === variant && (variant !== "today" || r.seriesGame >= 3));
  const table = {};
  for (const band of BANDS) {
    const inBand = list.filter((r) => r.band === band);
    if (inBand.length) table[band] = summarize(inBand);
  }
  table.ALL = summarize(list);
  console.log(`\n${variant}`);
  console.table(table);
}
