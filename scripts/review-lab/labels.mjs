/* How often each move label fires, per player per game, using the app's own
   gradeGame. Chess.com's public data has no labels to compare with, so this
   shows whether the rates are sensible, and SHOW=<label> prints examples to
   check by hand.

   Usage: node scripts/review-lab/labels.mjs [nodesPerMove] */
import { readFileSync } from "node:fs";
import { createEngine } from "../../src/engine/chessEngine.js";
import { theoryPlyCount } from "../../src/utils/ecoOpenings.js";
import { gradeGame } from "../../src/utils/gradeGame.js";
import { BANDS, bandFor } from "./bands.mjs";

const NODES = Number(process.argv[2]) || 100000;
const SHOW = process.env.SHOW;
const DATA = new URL("./data/", import.meta.url);
const readJsonl = (name) => readFileSync(new URL(name, DATA), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const eco = JSON.parse(readFileSync(new URL("../../src/utils/ecoOpenings.json", import.meta.url), "utf8"));
const evals = new Map(readJsonl(`evals-${NODES}.jsonl`).map((e) => [e.id, e.plies]));

const LABELS = ["brilliant", "great", "best", "excellent", "good", "inaccuracy", "miss", "mistake", "blunder"];
const counts = Object.fromEntries(BANDS.map((b) => [b, { sides: 0 }]));
let shown = 0;
for (const game of readJsonl("games.jsonl")) {
  const plies = evals.get(game.id);
  if (!plies) continue;
  const eng = createEngine();
  const bestSans = [];
  for (let i = 0; i < game.moves.length; i++) {
    const best = plies[i].best ? eng.moveFromUci(plies[i].best) : null;
    bestSans.push(best ? eng.sanOf(best) : undefined);
    eng.make(eng.legalMoves().find((m) => eng.sanOf(m) === game.moves[i]));
  }
  const { grades } = gradeGame({
    list: game.moves,
    scores: plies.map((p) => p.s),
    secondScores: plies.map((p) => p.s2 ?? null),
    bestSans,
    scoreOk: plies.map(() => true),
    theoryPlies: theoryPlyCount(game.moves, eco),
  });
  counts[bandFor(game.whiteElo)].sides++;
  counts[bandFor(game.blackElo)].sides++;
  grades.forEach((g, i) => {
    if (!g || g === "book") return;
    const row = counts[bandFor(i % 2 === 0 ? game.whiteElo : game.blackElo)];
    row[g] = (row[g] || 0) + 1;
    if (g === SHOW && shown < 12) {
      shown++;
      const line = game.moves.slice(0, i + 1).map((m, k) => (k % 2 ? m : `${k / 2 + 1}. ${m}`)).join(" ");
      console.log(`[eval ${plies[i].s}] played ${game.moves[i]}, engine liked ${bestSans[i]}: ${line}\n`);
    }
  });
}
const table = {};
for (const band of BANDS) {
  const row = counts[band];
  table[band] = Object.fromEntries(LABELS.map((l) => [l, ((row[l] || 0) / row.sides).toFixed(2)]));
}
console.table(table);
