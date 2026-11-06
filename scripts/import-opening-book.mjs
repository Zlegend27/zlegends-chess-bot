/* One-off import tool: builds the bundled opening book
   (src/utils/openingBook-lichess.json) from the Lichess game database
   (database.lichess.org, CC0). Replaces the live Opening Explorer lookup,
   which started answering 401 without a login in 2026-11; a token can't
   ship in browser code, so the theory now ships with the app instead.
   Not part of the app's runtime -- run manually with:
     node --max-old-space-size=4096 scripts/import-opening-book.mjs <file-or-url> [--games N] [--min-elo N]
   e.g. the October 2026 standard rated dump:
     node --max-old-space-size=4096 scripts/import-opening-book.mjs https://database.lichess.org/standard/lichess_db_standard_rated_2026-10.pgn.zst
   A monthly dump is ~30GB, but only its start is read: streaming stops
   once enough qualifying games have been seen (a URL is never saved to
   disk).
   Every move is replayed with the app's own engine, and the book stores
   the engine's own SAN for it, so a move the worker looks up always
   matches one of its legal moves. A game whose move doesn't replay is cut
   off at that point rather than trusted. */
import { createReadStream, writeFileSync } from "fs";
import { StringDecoder } from "string_decoder";
import zlib from "zlib";
import { createEngine } from "../src/engine/chessEngine.js";
import { bookKey } from "../src/utils/bookKey.js";

const args = process.argv.slice(2);
const src = args.find(a => !a.startsWith("--") && !/^\d+$/.test(a));
const flag = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : def;
};
if (!src) {
  console.error("Usage: node --max-old-space-size=4096 scripts/import-opening-book.mjs <lichess_db_standard_rated_YYYY-MM.pgn.zst | url> [--games N] [--min-elo N] [--min-position-games N]");
  process.exit(1);
}
const isUrl = /^https?:\/\//.test(src);

// Who counts. The book feeds the strongest bot tier and the Best Move
// hint, so only games where both players are rated MIN_ELO+ at blitz or
// slower (no bullet: openings there are often just whatever is fastest).
const TARGET_GAMES = flag("games", 400000);
const MIN_ELO = flag("min-elo", 2000);
const MIN_BASE_SECONDS = 180;
// The worker consults the book while fewer than 20 plies have been played
// (MAX_BOOK_PLIES in engineWorker.js), i.e. the first ~10 full moves.
const MAX_PLIES = 20;
// What gets kept. A position needs MIN_POSITION_GAMES games through it to
// be in the book at all (the old Explorer path likewise refused positions
// with fewer than 20 games). Within a position, a move must be played in
// at least MIN_MOVE_SHARE of games and MIN_MOVE_GAMES games, and only the
// MAX_MOVES most played survive -- so the bot never "books" a move a
// handful of people tried once.
const MIN_POSITION_GAMES = flag("min-position-games", 40);
const MIN_MOVE_SHARE = 0.03;
const MIN_MOVE_GAMES = 4;
const MAX_MOVES = 6;

// A monthly dump is hundreds of separate zstd frames (~32MB of PGN each),
// led by a "skippable" frame (magic 0x184D2A5*) -- the same one
// scripts/import-puzzles.mjs skips. Node's streaming decoder stops at the
// end of the first frame, so this splits the compressed bytes into frames
// itself and decodes each one whole. Returns the frame's length in bytes
// starting at `off`, or -1 if `buf` doesn't hold all of it yet. Layout:
// RFC 8878 section 3.1.
function zstdFrameLength(buf, off) {
  if (buf.length - off < 8) return -1;
  const magic = buf.readUInt32LE(off);
  if (magic >= 0x184D2A50 && magic <= 0x184D2A5F) {
    const len = 8 + buf.readUInt32LE(off + 4);
    return buf.length - off >= len ? len : -1;
  }
  if (magic !== 0xFD2FB528) throw new Error(`Not a zstd frame at byte ${off}`);
  const fhd = buf[off + 4];
  const fcsFlag = fhd >> 6, single = (fhd >> 5) & 1, checksum = (fhd >> 2) & 1, dictFlag = fhd & 3;
  let pos = off + 5 + (single ? 0 : 1) + [0, 1, 2, 4][dictFlag] + (fcsFlag === 0 ? single : [0, 2, 4, 8][fcsFlag]);
  for (;;) {
    if (pos + 3 > buf.length) return -1;
    const hdr = buf[pos] | (buf[pos + 1] << 8) | (buf[pos + 2] << 16);
    const last = hdr & 1, type = (hdr >> 1) & 3, size = hdr >>> 3;
    pos += 3 + (type === 1 ? 1 : size); // type 1 (RLE) stores one byte
    if (pos > buf.length) return -1;
    if (last) break;
  }
  pos += checksum ? 4 : 0;
  return pos <= buf.length ? pos - off : -1;
}

// Yields the dump's text in decoded pieces, reading only as far as asked.
async function* pgnText(input) {
  const decoder = new StringDecoder("utf8");
  let buf = Buffer.alloc(0), pending = [], pendingBytes = 0;
  const drain = function* () {
    buf = Buffer.concat([buf, ...pending]);
    pending = [];
    pendingBytes = 0;
    let off = 0, len;
    while ((len = zstdFrameLength(buf, off)) > 0) {
      const frame = buf.subarray(off, off + len);
      off += len;
      if (frame.readUInt32LE(0) === 0xFD2FB528) yield decoder.write(zlib.zstdDecompressSync(frame));
    }
    buf = buf.subarray(off);
  };
  for await (const chunk of input) {
    pending.push(chunk);
    pendingBytes += chunk.length;
    if (pendingBytes >= 1 << 20) yield* drain(); // re-scan once per MB, not per chunk
  }
  yield* drain();
  yield decoder.end();
}

// Reading ~2GB at ~1MB/s takes over half an hour, and Lichess's server
// does drop connections that long, so a dropped download picks up where it
// left off with a Range request instead of starting over.
const abort = new AbortController();
async function* download(url) {
  let received = 0;
  // Gives up only after 20 drops in a row with no bytes in between; the
  // 2026-10 run that built the shipped book survived 15 drops in all.
  for (let attempt = 0, lastReceived = 0; ; attempt++) {
    if (received > lastReceived) { attempt = 0; lastReceived = received; }
    try {
      const res = await fetch(url, {
        signal: abort.signal,
        headers: received ? { Range: `bytes=${received}-` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (received && res.status !== 206) throw new Error("server ignored the Range request");
      for await (const chunk of res.body) {
        received += chunk.length;
        yield chunk;
      }
      return;
    } catch (err) {
      if (abort.signal.aborted) return;
      if (attempt >= 20) throw err;
      console.log(`  download dropped at ${Math.round(received / 1e6)}MB (${err.cause?.code || err.message}), resuming`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}
const input = isUrl ? download(src) : createReadStream(src);

const eng = createEngine();
const strip = san => san.replace(/[+#]/g, "");

// Phase 1 (while streaming): replay each qualifying game's first MAX_PLIES
// moves, remember the position key before each move and the move itself,
// and count how many games reach each position.
const positionGames = new Map(); // key -> games reaching it
// One string per game, "key san key san ...": a few hundred bytes each,
// where an array of pairs per game ran to kilobytes.
const games = [];
let headers = {};
let scanned = 0, cutShort = 0, done = false;

function qualifies(h) {
  if (!/^Rated /.test(h.Event || "")) return false;
  if (h.Termination === "Abandoned" || h.Termination === "Rules infraction") return false;
  if (!(Number(h.WhiteElo) >= MIN_ELO && Number(h.BlackElo) >= MIN_ELO)) return false;
  const base = Number((h.TimeControl || "").split("+")[0]);
  return h.TimeControl === "-" || base >= MIN_BASE_SECONDS; // "-" is correspondence
}

function movesOf(movetext) {
  return movetext
    .replace(/\{[^}]*\}/g, " ")
    .split(/\s+/)
    .filter(t => t && !/^\d+\.+$/.test(t) && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(t))
    .map(t => t.replace(/[?!]+$/, ""));
}

function replay(sans) {
  eng.reset();
  const out = [];
  const seen = new Set(); // a game that repeats a position counts it once
  for (const san of sans.slice(0, MAX_PLIES)) {
    const key = bookKey(eng.fen());
    const move = eng.legalMoves().find(m => strip(eng.sanOf(m)) === strip(san));
    if (move === undefined) { cutShort++; break; }
    out.push(`${key} ${eng.sanOf(move)}`);
    if (!seen.has(key)) { seen.add(key); positionGames.set(key, (positionGames.get(key) || 0) + 1); }
    eng.make(move);
  }
  return out;
}

const started = Date.now();
function onLine(line) {
  if (line.startsWith("[")) {
    const m = /^\[(\w+) "(.*)"\]$/.exec(line);
    if (m) headers[m[1]] = m[2];
    return;
  }
  if (!line.trim()) return;
  // Movetext: one line per game in the Lichess dumps.
  scanned++;
  if (qualifies(headers)) {
    const plies = replay(movesOf(line));
    if (plies.length) {
      games.push(plies.join(" "));
      if (games.length % 50000 === 0) {
        console.log(`  ${games.length} games kept of ${scanned} scanned (${Math.round((Date.now() - started) / 1000)}s)`);
      }
    }
    if (games.length >= TARGET_GAMES) done = true;
  }
  headers = {};
}

let carry = "";
for await (const text of pgnText(input)) {
  const lines = (carry + text).split("\n");
  carry = lines.pop();
  for (const line of lines) {
    onLine(line.replace(/\r$/, ""));
    if (done) break;
  }
  if (done) break;
}
if (!done && carry) onLine(carry);
abort.abort(); // stop the download once enough games are in

// Phase 2: tally the moves played from every position that enough games
// reach, then trim each to the moves worth playing.
const moveCounts = new Map(); // key -> Map(san -> games)
for (const game of games) {
  const parts = game.split(" ");
  for (let i = 0; i < parts.length; i += 2) {
    const key = parts[i], san = parts[i + 1];
    if (positionGames.get(key) < MIN_POSITION_GAMES) continue;
    let m = moveCounts.get(key);
    if (!m) moveCounts.set(key, (m = new Map()));
    m.set(san, (m.get(san) || 0) + 1);
  }
}

const positions = {};
let moveTotal = 0;
for (const [key, counts] of moveCounts) {
  const total = [...counts.values()].reduce((s, n) => s + n, 0);
  const kept = [...counts]
    .filter(([, n]) => n >= MIN_MOVE_GAMES && n / total >= MIN_MOVE_SHARE)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_MOVES);
  if (!kept.length) continue;
  // Weights are per-mille of the games through this position: only their
  // ratios matter to the weighted pick (and to STYLE_BOOK_BIAS, whose
  // exponent and multiplier are both scale-free), so absolute game counts
  // would just cost bytes.
  positions[key] = kept.map(([san, n]) => `${san} ${Math.max(1, Math.round((1000 * n) / total))}`).join(" ");
  moveTotal += kept.length;
}

const out = {
  source: isUrl ? src : src.split(/[\\/]/).pop(),
  license: "CC0 (database.lichess.org)",
  filter: { minElo: MIN_ELO, minBaseSeconds: MIN_BASE_SECONDS, maxPlies: MAX_PLIES, minPositionGames: MIN_POSITION_GAMES },
  games: games.length,
  // bookKey(fen) -> "san weight san weight ...", weights in per-mille
  positions,
};
const json = JSON.stringify(out);
writeFileSync(new URL("../src/utils/openingBook-lichess.json", import.meta.url), json);
console.log(`Scanned ${scanned} games, kept ${games.length} (${cutShort} cut short by a move that didn't replay).`);
console.log(`Wrote ${Object.keys(positions).length} positions, ${moveTotal} moves, ${Math.round(json.length / 1024)}KB to src/utils/openingBook-lichess.json`);
process.exit(0);
