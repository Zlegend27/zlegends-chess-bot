/* Puzzle data imported from Lichess's public puzzle database
   (database.lichess.org/#puzzles, CC0) via scripts/import-puzzles.mjs —
   300 real, human-rated puzzles curated across five rating bands, popular
   and well-attempted ones only (see the script for the exact filters).
   Format: `fen` is the solver's own starting position (already shifted
   past Lichess's "setup move" — see the import script for why), and
   `moves[i]` for even i is the solver's move, odd i is auto-played for
   them; every puzzle is validated against the real engine in
   puzzles-lichess.test.js, so if you re-run the import and something in
   it breaks the test will catch it before it ships. */
import puzzlesData from "./puzzles-lichess.json";

export const RATING_BANDS = puzzlesData.bands;
export const PUZZLES = puzzlesData.puzzles;
