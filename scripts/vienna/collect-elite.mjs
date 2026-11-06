/* Adds Vienna games from the Lichess Elite Database (database.nikonoel.fr:
   Lichess games between players rated about 2400+ and 2200+, no bullet)
   to the counts collect.mjs made, as one more band. Strong players stay in
   theory far longer, so these games carry the repertoire deeper; the
   trainer never uses this band to choose Black's replies, only to decide
   how far the known lines reach and which White moves are theory.

   Usage: download months as scripts/vienna/data/elite_YYYY-MM.zip, then
          node scripts/vienna/collect-elite.mjs
   Needs `unzip` on the path. Updates scripts/vienna/data/counts.json. */
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createEngine } from "../../src/engine/chessEngine.js";

const DATA = new URL("./data/", import.meta.url);
const COUNTS = new URL("counts.json", DATA);
const MAX_PLIES = 40;
const ELITE_BAND = [2300, 3500];
const SPEEDS = /Rated (Blitz|Rapid|Classical) game/;

const saved = JSON.parse(readFileSync(COUNTS, "utf8"));
if (saved.bands.some(([lo]) => lo === ELITE_BAND[0])) throw new Error("Elite games were already added to counts.json");
const band = saved.bands.length;
const counts = saved.counts;
for (const moves of Object.values(counts)) for (const c of Object.values(moves)) c.push(0);
const eng = createEngine();

function sansOf(movetext) {
  return movetext.replace(/\{[^}]*\}/g, " ").replace(/\d+\.(\.\.)?/g, " ").split(/\s+/)
    .filter((t) => t && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(t)).map((t) => t.replace(/[?!]+$/, ""));
}

function addGame(sans) {
  eng.reset();
  for (let i = 0; i < Math.min(sans.length, MAX_PLIES); i++) {
    const move = eng.legalMoves().find((m) => eng.sanOf(m) === sans[i]);
    if (move === undefined) return;
    const key = sans.slice(0, i).join(" ");
    const node = (counts[key] ??= {});
    (node[sans[i]] ??= saved.bands.map(() => 0).concat(0))[band] += 1;
    eng.make(move);
  }
}

let games = 0, scanned = 0;
const zips = readdirSync(DATA).filter((f) => /^elite_\d{4}-\d{2}\.zip$/.test(f)).sort();
for (const zip of zips) {
  const unzip = spawn("unzip", ["-p", fileURLToPath(new URL(zip, DATA))], { stdio: ["ignore", "pipe", "inherit"] });
  let header = {}, movetext = "";
  const take = () => {
    if (!movetext) return;
    scanned++;
    const h = header;
    const text = movetext;
    header = {};
    movetext = "";
    if (!/^1\. e4 e5 2\. Nc3 /.test(text) || !SPEEDS.test(h.Event || "")) return;
    if (Math.min(Number(h.WhiteElo), Number(h.BlackElo)) < 2000) return;
    addGame(sansOf(text));
    games++;
  };
  /* Movetext wraps across lines; a blank line or the next header ends it. */
  for await (const line of createInterface({ input: unzip.stdout })) {
    if (line.startsWith("[")) {
      take();
      const m = line.match(/^\[(\w+) "(.*)"\]$/);
      if (m) header[m[1]] = m[2];
    } else if (line.trim()) {
      movetext += (movetext ? " " : "") + line.trim();
    } else if (movetext) {
      take();
    }
  }
  take();
  console.log(`${zip}: ${games} Vienna games so far from ${scanned} scanned`);
}

saved.bands.push(ELITE_BAND);
saved.eliteGames = games;
saved.eliteSource = `Lichess Elite Database (database.nikonoel.fr): ${zips.join(", ")}`;
writeFileSync(COUNTS, JSON.stringify(saved));
console.log(`added ${games} Elite Vienna games`);
