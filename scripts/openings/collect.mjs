/* Collects what real players chose in the Opening Trainer's openings, from
   the Lichess games database (database.lichess.org, CC0): for every
   position (as the moves that led to it) in the first MAX_PLIES plies of
   games starting with one of ROOTS, how often each next move was played,
   split by rating band.

   Bands are on Lichess ratings (average of the two players), which run
   higher than Chess.com's. The first three are the trainer's levels, about
   Chess.com 800, 1300 and 1800; the fourth (strong players) is only used
   to judge which moves are sound and where theory goes. Blitz, rapid and
   classical games only.

   Rare positions are dropped as it goes (fewer than PRUNE_BELOW games deep
   in the tree), so millions of games fit in memory; positions the trainer
   uses are seen hundreds of times.

   Usage: bash scripts/openings/download.sh, then
          node scripts/openings/collect.mjs [maxGames]
   Output: scripts/openings/data/counts.json */
import { createZstdDecompress } from "node:zlib";
import { createInterface } from "node:readline";
import { createReadStream, mkdirSync, writeFileSync } from "node:fs";
import { dropSkippableFrames, sansOf } from "./lichess.mjs";

const SOURCE = "https://database.lichess.org/standard/lichess_db_standard_rated_2026-10.pgn.zst";
const PART = new URL("./data/part.pgn.zst", import.meta.url);
const OUT = new URL("./data/", import.meta.url);
const MAX_GAMES = Number(process.argv[2]) || Infinity;
const MAX_PLIES = 24;
export const BANDS = [[1100, 1450], [1450, 1800], [1800, 2150], [2150, 3500]];
const SPEEDS = /Rated (Blitz|Rapid|Classical) game/;
/* Every opening in the trainer starts with one of these. */
const ROOTS = ["e4 e5", "e4 c5", "e4 e6", "e4 c6", "e4 d5", "d4 d5", "d4 Nf6"];
const PRUNE_EVERY = 250000, PRUNE_DEPTH = 8, PRUNE_BELOW = 3;

/* "e4 e5 Nc3" -> { n: games through here, m: { Nf6: [b0, b1, b2, b3], ... } } */
const nodes = new Map();
let games = 0, scanned = 0, bytes = 0;

function addGame(sans, band) {
  let key = "";
  for (let i = 0; i < Math.min(sans.length, MAX_PLIES); i++) {
    let node = nodes.get(key);
    if (!node) { node = { n: 0, d: i, m: {} }; nodes.set(key, node); }
    node.n++;
    (node.m[sans[i]] ??= [0, 0, 0, 0])[band]++;
    key = key ? key + " " + sans[i] : sans[i];
  }
}

/* Drops deep positions seen too rarely to matter; their counts are tiny. */
function prune() {
  let dropped = 0;
  for (const [key, node] of nodes) {
    if (node.d >= PRUNE_DEPTH && node.n < PRUNE_BELOW) { nodes.delete(key); dropped++; }
  }
  return dropped;
}

let finished = false;
function finish(reason) {
  if (finished) return;
  finished = true;
  prune();
  const out = {};
  for (const [key, node] of nodes) if (node.n >= 5) out[key] = node.m;
  mkdirSync(OUT, { recursive: true });
  writeFileSync(new URL("counts.json", OUT), JSON.stringify({ source: SOURCE, bands: BANDS, maxPlies: MAX_PLIES, games, scanned, counts: out }));
  console.log(`${reason}: ${games} games kept from ${scanned} scanned, ${(bytes / 1e6).toFixed(0)} MB read, ${Object.keys(out).length} positions`);
  process.exit(0);
}

const body = createReadStream(PART);
body.on("data", (chunk) => { bytes += chunk.length; });
const unzip = createZstdDecompress();
/* The slice ends partway through a compressed block, so the decompressor
   either errors or simply goes quiet at the end; both mean "done". */
unzip.on("error", () => finish("end of the downloaded slice"));
process.on("beforeExit", () => finish("end of the downloaded slice"));
const lines = createInterface({ input: body.pipe(dropSkippableFrames()).pipe(unzip) });

let header = {};
for await (const line of lines) {
  if (line.startsWith("[")) {
    const m = line.match(/^\[(\w+) "(.*)"\]$/);
    if (m) header[m[1]] = m[2];
    continue;
  }
  if (!line.startsWith("1.")) continue;
  scanned++;
  const h = header;
  header = {};
  if (!SPEEDS.test(h.Event || "")) continue;
  const avg = (Number(h.WhiteElo) + Number(h.BlackElo)) / 2;
  const band = BANDS.findIndex(([lo, hi]) => avg >= lo && avg < hi);
  if (band < 0) continue;
  const sans = sansOf(line);
  if (sans.length < 4 || !ROOTS.includes(sans[0] + " " + sans[1])) continue;
  addGame(sans, band);
  games++;
  if (games % PRUNE_EVERY === 0) {
    const dropped = prune();
    console.log(`${games} games, ${scanned} scanned, ${(bytes / 1e6).toFixed(0)} MB, ${nodes.size} positions (${dropped} rare dropped)`);
  }
  if (games >= MAX_GAMES) finish("game limit reached");
}
finish("file finished");
