/* Builds Chess Tactica's own puzzle pool from the Lichess puzzle database
   (database.lichess.org/#puzzles, CC0): about 16,000 puzzles, spread evenly
   over rating and puzzle length, half for each colour, well-liked and
   well-tested ones only. Unlike the site's small bundled set
   (import-puzzles.mjs), each puzzle keeps the position BEFORE the
   opponent's opening move, so the game can show that move being played.

   Output: public/tactica-puzzles/<bucket>.json, one file per 300 rating
   points, loaded only when a floor needs it (src/tactica/puzzlePool.js).
   Each row is [id, rating, fenBefore, "uci uci uci ..."], the first move
   being the opponent's.

   Run by hand:
     node scripts/import-tactica-puzzles.mjs <path-to-lichess_db_puzzle.csv.zst> */
import { mkdirSync, writeFileSync, openSync, readSync, closeSync, fstatSync } from "fs";
import zlib from "zlib";
import { createEngine } from "../src/engine/chessEngine.js";
import { BUCKETS, bucketOf } from "../src/tactica/puzzlePool.js";

const srcPath = process.argv[2];
if (!srcPath) {
  console.error("Usage: node scripts/import-tactica-puzzles.mjs <path-to-lichess_db_puzzle.csv.zst>");
  process.exit(1);
}

/* Per bucket, per colour: how many puzzles of each length (the solver's
   own moves). Long ones are what boss floors use. */
const QUOTA = { short: 400, mid: 350, long: 250 };
const lengthClass = (solverMoves) => (solverMoves <= 2 ? "short" : solverMoves === 3 ? "mid" : "long");
const MIN_PLAYS = 500, MIN_POPULARITY = 88, MAX_DEVIATION = 90;
const MAX_SOLVER_MOVES = 7;

const eng = createEngine();
/** True if every move replays legally with the app's own engine. */
function replays(fenBefore, uciMoves) {
  try {
    eng.loadFen(fenBefore);
    for (const uci of uciMoves) {
      const m = eng.moveFromUci(uci);
      if (!m) return false;
      eng.make(m);
    }
    return true;
  } catch { return false; }
}

const store = new Map(BUCKETS.map((b) => [b, { w: { short: [], mid: [], long: [] }, b: { short: [], mid: [], long: [] } }]));
const full = () => [...store.values()].every((s) => ["w", "b"].every((c) => Object.keys(QUOTA).every((k) => s[c][k].length >= QUOTA[k])));

let seen = 0, kept = 0;
function takeLine(line) {
  if (seen++ === 0) return; // header row
  const [id, fenBefore, moves, ratingStr, deviationStr, popularityStr, playsStr] = line.split(",");
  const rating = Number(ratingStr);
  if (!(rating >= 400) || Number(deviationStr) > MAX_DEVIATION || Number(popularityStr) < MIN_POPULARITY || Number(playsStr) < MIN_PLAYS) return;
  const uciMoves = moves.split(" ");
  const solverMoves = uciMoves.length / 2;
  if (uciMoves.length < 2 || uciMoves.length % 2 || solverMoves > MAX_SOLVER_MOVES) return;
  /* The solver plays the side that is NOT to move in fenBefore. */
  const colour = fenBefore.split(" ")[1] === "w" ? "b" : "w";
  const kind = lengthClass(solverMoves);
  const list = store.get(bucketOf(rating))[colour][kind];
  if (list.length >= QUOTA[kind]) return;
  if (!replays(fenBefore, uciMoves)) return;
  list.push([id, rating, fenBefore, moves]);
  kept++;
}

/* The file is many zstd frames in a row, each announced by a small
   "skippable frame" holding the size of the frame after it. Node's stream
   decoder stops at the first of those it meets mid-file, so the frames are
   walked by hand and unpacked one at a time. */
const fd = openSync(srcPath, "r");
const size = fstatSync(fd).size;
const header = Buffer.alloc(12);
let offset = 0, carry = "";
while (offset < size && !full()) {
  readSync(fd, header, 0, 12, offset);
  const magic = header.readUInt32LE(0);
  if (magic < 0x184D2A50 || magic > 0x184D2A5F || header.readUInt32LE(4) !== 4) {
    throw new Error(`Unexpected data at byte ${offset}: this file isn't laid out the way the Lichess dump usually is.`);
  }
  const frameSize = header.readUInt32LE(8);
  const frame = Buffer.alloc(frameSize);
  readSync(fd, frame, 0, frameSize, offset + 12);
  offset += 12 + frameSize;
  const text = carry + zlib.zstdDecompressSync(frame).toString("utf8");
  const lines = text.split(/\r?\n/);
  carry = lines.pop();
  for (const line of lines) if (line) takeLine(line);
}
if (carry && !full()) takeLine(carry);
closeSync(fd);

{
  const dir = new URL("../public/tactica-puzzles/", import.meta.url);
  mkdirSync(dir, { recursive: true });
  console.log(`Scanned ${seen} rows, kept ${kept} puzzles.`);
  for (const bucket of BUCKETS) {
    const s = store.get(bucket);
    const rows = ["w", "b"].flatMap((c) => Object.keys(QUOTA).flatMap((k) => s[c][k]));
    writeFileSync(new URL(`${bucket}.json`, dir), JSON.stringify(rows));
    console.log(`  ${bucket}: ${rows.length}  ` + ["w", "b"].map((c) => `${c} ${Object.keys(QUOTA).map((k) => `${k} ${s[c][k].length}`).join(", ")}`).join("  |  "));
  }
}
