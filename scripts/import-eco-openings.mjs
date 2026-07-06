/* One-off import tool: converts lichess's public chess-openings TSV files
   (github.com/lichess-org/chess-openings, CC0 -- the same reference data
   lichess itself uses to name openings during analysis) into a compact
   JSON lookup table for live opening detection during play.
   Not part of the app's runtime -- run manually with:
     node scripts/import-eco-openings.mjs <dir-with-a.tsv..e.tsv>
   This is deliberately separate from src/utils/openings.js, which stays
   a small hand-curated library (with descriptions and quiz support) for
   the browsable Openings modal -- this dataset only has name/eco/moves,
   used purely to match a live game's move prefix against ~3700 known
   lines and tell the player what they're playing. */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const dir = process.argv[2];
if (!dir) {
  console.error("Usage: node scripts/import-eco-openings.mjs <dir-with-a.tsv..e.tsv>");
  process.exit(1);
}

const out = [];
for (const letter of ["a", "b", "c", "d", "e"]) {
  const text = readFileSync(join(dir, `${letter}.tsv`), "utf8");
  const lines = text.split("\n").slice(1); // drop header row
  for (const line of lines) {
    if (!line.trim()) continue;
    const [eco, name, pgn] = line.split("\t");
    if (!eco || !name || !pgn) continue;
    // "1. Nh3 d5 2. g3 e5 3. f4" -> ["Nh3","d5","g3","e5","f4"]
    const moves = pgn.trim().split(/\s+/).filter(tok => !/^\d+\.+$/.test(tok));
    out.push({ eco, name: name.trim(), moves });
  }
}

writeFileSync(
  new URL("../src/utils/ecoOpenings.json", import.meta.url),
  JSON.stringify(out),
);
console.log(`Wrote ${out.length} named openings to src/utils/ecoOpenings.json`);
