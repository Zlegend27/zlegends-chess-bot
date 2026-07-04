/* One-off import tool: reads the Lichess puzzle database dump
   (lichess_db_puzzle.csv.zst, columns documented at
   database.lichess.org/#puzzles) and curates a bundled subset for
   src/utils/puzzles.js.
   Not part of the app's runtime — run manually with:
     node scripts/import-puzzles.mjs <path-to-lichess_db_puzzle.csv.zst>
   Lichess's format: FEN is the position BEFORE Moves[0]; Moves[0] is
   played to reach the actual puzzle position, then the player finds
   Moves[1], the engine auto-plays Moves[2], etc. This script shifts
   everything by one ply so FEN in our own format already IS the
   solver's starting position (see src/utils/puzzles.js's own header
   for why), then converts every remaining UCI move to SAN with the
   real engine — so a puzzle that doesn't actually replay legally is
   dropped rather than silently shipped. */
import { createReadStream, writeFileSync, openSync, readSync, closeSync } from "fs";
import { createInterface } from "readline";
import zlib from "zlib";
import { createEngine } from "../src/engine/chessEngine.js";

const srcPath = process.argv[2];
if (!srcPath) {
  console.error("Usage: node scripts/import-puzzles.mjs <path-to-lichess_db_puzzle.csv.zst>");
  process.exit(1);
}

// Curated rating bands + how many puzzles to keep per band. Chosen for a
// bundled JSON that's still small (a few hundred KB), not a database dump.
const BANDS = [
  { id: "beginner", label: "Beginner", min: 0, max: 1000, target: 60 },
  { id: "easy", label: "Easy", min: 1000, max: 1300, target: 60 },
  { id: "medium", label: "Medium", min: 1300, max: 1700, target: 60 },
  { id: "hard", label: "Hard", min: 1700, max: 2100, target: 60 },
  { id: "expert", label: "Expert", min: 2100, max: 9999, target: 60 },
];
const MIN_NB_PLAYS = 200; // quality filter -- skip rarely-attempted puzzles
const MIN_POPULARITY = 60; // Lichess's own -100..100 thumbs-up score

const buckets = new Map(BANDS.map(b => [b.id, []]));
const bandFor = rating => BANDS.find(b => rating >= b.min && rating < b.max);

const eng = createEngine();

function convertRow(fenBefore, uciMoves) {
  eng.loadFen(fenBefore);
  const setupMove = eng.moveFromUci(uciMoves[0]);
  if (!setupMove) return null;
  eng.make(setupMove);
  const fen = eng.fen();
  const moves = [];
  for (let i = 1; i < uciMoves.length; i++) {
    const m = eng.moveFromUci(uciMoves[i]);
    if (!m) return null; // if a move doesn't convert cleanly, drop the whole puzzle
    moves.push(eng.sanOf(m));
    eng.make(m);
  }
  return { fen, moves };
}

// Lichess's CDN prepends a zstd "skippable frame" (magic 0x184D2A5*) before
// the real frame -- an 8-byte header (4 magic + 4 little-endian size) plus
// that many content bytes -- which Node's zstd decoder doesn't skip on its
// own, so find where the real frame (magic 0xFD2FB528) actually starts.
const head = Buffer.alloc(16);
const fd = openSync(srcPath, "r");
readSync(fd, head, 0, 16, 0);
closeSync(fd);
let startOffset = 0;
if (head.readUInt32LE(0) >= 0x184D2A50 && head.readUInt32LE(0) <= 0x184D2A5F) {
  startOffset = 8 + head.readUInt32LE(4);
}

let seen = 0, kept = 0;
const stream = createReadStream(srcPath, { start: startOffset }).pipe(zlib.createZstdDecompress());
const rl = createInterface({ input: stream, crlfDelay: Infinity });

rl.on("line", (line) => {
  if (seen === 0) { seen++; return; } // header row
  seen++;

  const allFull = BANDS.every(b => buckets.get(b.id).length >= b.target);
  if (allFull) { rl.close(); stream.destroy(); return; }

  const cols = line.split(",");
  const [, fenBefore, moves, ratingStr, , popularityStr, nbPlaysStr, themes] = cols;
  const rating = Number(ratingStr);
  const band = bandFor(rating);
  if (!band) return;
  const bucket = buckets.get(band.id);
  if (bucket.length >= band.target) return;
  if (Number(nbPlaysStr) < MIN_NB_PLAYS) return;
  if (Number(popularityStr) < MIN_POPULARITY) return;

  const uciMoves = moves.split(" ");
  if (uciMoves.length < 2) return; // need at least one solver move
  const converted = convertRow(fenBefore, uciMoves);
  if (!converted) return;

  bucket.push({
    id: cols[0],
    rating,
    themes: themes ? themes.split(" ").filter(Boolean) : [],
    fen: converted.fen,
    moves: converted.moves,
  });
  kept++;
});

rl.on("close", () => {
  const all = BANDS.flatMap(b => buckets.get(b.id));
  const out = {
    bands: BANDS.map(({ id, label, min, max }) => ({ id, label, min, max })),
    puzzles: all,
  };
  writeFileSync(new URL("../src/utils/puzzles-lichess.json", import.meta.url), JSON.stringify(out, null, 2));
  console.log(`Scanned ${seen} rows, kept ${kept} puzzles.`);
  for (const b of BANDS) console.log(`  ${b.label}: ${buckets.get(b.id).length}/${b.target}`);
  console.log("Wrote src/utils/puzzles-lichess.json");
});
