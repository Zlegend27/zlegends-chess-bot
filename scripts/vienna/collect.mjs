/* Collects real Vienna games (1.e4 e5 2.Nc3) from the Lichess games database
   (database.lichess.org, CC0) and counts which move was played in every
   position of the first 20 moves, split by rating band. Stronger players'
   games are included because they follow theory much deeper; the trainer
   still picks Black's replies by how often players at the chosen level
   made them. The Vienna Trainer's
   opponent picks its replies from these counts.

   It reads the first 1.6 GB of one month's 29 GB file, fetched to disk
   by download.sh (which resumes if the connection drops; a long stream
   from the server tends to stall). Lichess ratings run higher than Chess.com's, so the bands
   are set on Lichess numbers and labelled in Chess.com terms in the app.

   Usage: bash scripts/vienna/download.sh, then
          node scripts/vienna/collect.mjs [maxGames]
   Output: scripts/vienna/data/counts.json */
import { createZstdDecompress } from "node:zlib";
import { Transform } from "node:stream";
import { createInterface } from "node:readline";
import { createReadStream, mkdirSync, writeFileSync } from "node:fs";
import { createEngine } from "../../src/engine/chessEngine.js";

const SOURCE = "https://database.lichess.org/standard/lichess_db_standard_rated_2026-09.pgn.zst";
const PART = new URL("./data/part.pgn.zst", import.meta.url);
const MAX_GAMES = Number(process.argv[2]) || 120000;
const MAX_PLIES = 40;
/* Average Lichess rating of the two players. */
const BANDS = [[1000, 1400], [1400, 1700], [1700, 2000], [2000, 2400]];
const SPEEDS = /Rated (Blitz|Rapid|Classical) game/;
const OUT = new URL("./data/", import.meta.url);

const counts = {}; // "e4 e5 Nc3 Nf6" -> { f4: [b0, b1, b2], ... }
let games = 0, scanned = 0, bytes = 0;
const eng = createEngine();

/* Lichess compresses in parallel blocks, each one announced by a small
   "skippable" frame holding the next block's size. Node's decompressor
   rejects those frames, so this drops them and passes the blocks through. */
function dropSkippableFrames() {
  let pending = Buffer.alloc(0), passLeft = 0, plain = false;
  return new Transform({
    transform(chunk, _enc, done) {
      if (plain) { done(null, chunk); return; }
      pending = Buffer.concat([pending, chunk]);
      const out = [];
      for (;;) {
        if (passLeft > 0) {
          const n = Math.min(passLeft, pending.length);
          out.push(pending.subarray(0, n));
          pending = pending.subarray(n);
          passLeft -= n;
          if (passLeft > 0) break;
        }
        if (pending.length < 8) break;
        const magic = pending.readUInt32LE(0);
        if ((magic & 0xfffffff0) !== 0x184d2a50) { plain = true; out.push(pending); pending = Buffer.alloc(0); break; }
        const size = pending.readUInt32LE(4);
        if (pending.length < 8 + size) break;
        passLeft = size === 4 ? pending.readUInt32LE(8) : 0;
        pending = pending.subarray(8 + size);
      }
      done(null, Buffer.concat(out));
    },
  });
}

/* Strips clocks, evals, move numbers and the result from Lichess movetext. */
function sansOf(movetext) {
  return movetext.replace(/\{[^}]*\}/g, " ").replace(/\d+\.(\.\.)?/g, " ").split(/\s+/)
    .filter((t) => t && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(t)).map((t) => t.replace(/[?!]+$/, ""));
}

function addGame(sans, band) {
  eng.reset();
  for (let i = 0; i < Math.min(sans.length, MAX_PLIES); i++) {
    const move = eng.legalMoves().find((m) => eng.sanOf(m) === sans[i]);
    if (move === undefined) return; // a notation our engine writes differently: skip the rest
    const key = sans.slice(0, i).join(" ");
    const node = (counts[key] ??= {});
    (node[sans[i]] ??= BANDS.map(() => 0))[band] += 1;
    eng.make(move);
  }
}

function finish(reason) {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(new URL("counts.json", OUT), JSON.stringify({ source: SOURCE, bands: BANDS, games, scanned, counts }));
  console.log(`${reason}: ${games} Vienna games kept from ${scanned} scanned, ${(bytes / 1e6).toFixed(0)} MB read`);
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
  if (!/^1\. e4 (\{[^}]*\} )?1\.\.\. e5 (\{[^}]*\} )?2\. Nc3 /.test(line)) continue;
  if (!SPEEDS.test(h.Event || "")) continue;
  const avg = (Number(h.WhiteElo) + Number(h.BlackElo)) / 2;
  const band = BANDS.findIndex(([lo, hi]) => avg >= lo && avg < hi);
  if (band < 0) continue;
  addGame(sansOf(line), band);
  games++;
  if (games % 5000 === 0) console.log(`${games} games, ${scanned} scanned, ${(bytes / 1e6).toFixed(0)} MB`);
  if (games >= MAX_GAMES) finish("game limit reached");
}
finish("file finished");
