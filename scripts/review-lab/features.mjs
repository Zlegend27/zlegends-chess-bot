/* Turns the cached engine results into per-side move lists, so tuning can run
   thousands of trials without replaying games. Each move records the
   mover's eval before and after, whether it was the engine's top choice,
   whether it was forced, and whether it was still in opening theory.

   Usage: node scripts/review-lab/features.mjs [nodesPerMove] */
import { readFileSync, writeFileSync } from "node:fs";
import { createEngine, MATE } from "../../src/engine/chessEngine.js";
import { theoryPlyCount } from "../../src/utils/ecoOpenings.js";
import { bandFor } from "./bands.mjs";

const NODES = Number(process.argv[2]) || 100000;
const DATA = new URL("./data/", import.meta.url);
const readJsonl = (name) => readFileSync(new URL(name, DATA), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const eco = JSON.parse(readFileSync(new URL("../../src/utils/ecoOpenings.json", import.meta.url), "utf8"));
const evals = new Map(readJsonl(`evals-${NODES}.jsonl`).map((e) => [e.id, e.plies]));

/* Mate scores become a large fixed eval, so they sit at the end of the curve. */
const MATE_CP = 2000;
const toCp = (s) => (Math.abs(s) > MATE - 2000 ? Math.sign(s) * MATE_CP : s);

const sides = [];
for (const game of readJsonl("games.jsonl")) {
  const plies = evals.get(game.id);
  if (!plies) continue;
  const theory = theoryPlyCount(game.moves, eco);
  const eng = createEngine();
  const white = [];
  const black = [];
  for (let i = 0; i < game.moves.length; i++) {
    const legal = eng.legalMoves();
    const move = legal.find((m) => eng.sanOf(m) === game.moves[i]);
    if (move === undefined) break;
    const bestMove = plies[i].best ? eng.moveFromUci(plies[i].best) : null;
    const isBest = bestMove != null && eng.sanOf(bestMove) === game.moves[i];
    const forced = legal.length === 1;
    eng.make(move);
    const mated = eng.legalMoves().length === 0 && eng.inCheckNow();
    const before = toCp(plies[i].s);
    const after = mated ? MATE_CP : -toCp(plies[i + 1].s);
    (i % 2 === 0 ? white : black).push([before, after, isBest ? 1 : 0, forced ? 1 : 0, i < theory ? 1 : 0]);
  }
  sides.push({ id: game.id, elo: game.whiteElo, band: bandFor(game.whiteElo), target: game.whiteAcc, moves: white });
  sides.push({ id: game.id, elo: game.blackElo, band: bandFor(game.blackElo), target: game.blackAcc, moves: black });
}
writeFileSync(new URL("features.json", DATA), JSON.stringify(sides));
console.log(`${sides.length} sides, ${sides.reduce((n, s) => n + s.moves.length, 0)} moves`);
