/* Chess Tactica's puzzle pool: about 16,000 Lichess puzzles in files of 300
   rating points each (public/tactica-puzzles/, built by
   scripts/import-tactica-puzzles.mjs), fetched only when a floor needs
   them and kept for the rest of the visit.

   A row from a file is light: enough to choose by (id, rating, side,
   length). expandPuzzle turns the chosen one into a full puzzle, with the
   solver's position, the solution in chess notation, and the position and
   move that came just before it (`before`, `lead`), so the game can show
   the opponent making that move.

   If the files can't be fetched (offline, or not deployed), callers fall
   back to the small set bundled with the site. */
import { createEngine } from "../engine/chessEngine.js";

const WIDTH = 300, LOWEST = 400, HIGHEST = 2500;
/** Each file's lowest rating: 400 (everything under 700), 700, 1000 ... 2500 (and up). */
export const BUCKETS = Array.from({ length: (HIGHEST - LOWEST) / WIDTH + 1 }, (_, i) => LOWEST + i * WIDTH);

export const bucketOf = (rating) => Math.min(HIGHEST, Math.max(LOWEST, LOWEST + Math.floor((rating - LOWEST) / WIDTH) * WIDTH));

/** The files that hold puzzles within `reach` of a rating. */
export function bucketsNear(rating, reach = 150) {
  const out = [];
  for (let b = bucketOf(rating - reach); b <= bucketOf(rating + reach); b += WIDTH) out.push(b);
  return out;
}

/** A file's row as a light puzzle. The solver is the side NOT to move in
 *  the stored position (the opponent moves first). */
export const lightRow = ([id, rating, before, uci]) => ({
  id, rating, before, uci,
  side: before.split(" ")[1] === "w" ? -1 : 1,
  plies: uci.split(" ").length - 1,
});

const engine = createEngine();
/** The full puzzle for a light row: { id, rating, fen, moves, before, lead }.
 *  A puzzle that is already full (the bundled set) comes back unchanged.
 *  Returns null if the row doesn't replay, which the import rules out. */
export function expandPuzzle(row) {
  if (!row || row.moves) return row;
  const [lead, ...rest] = row.uci.split(" ");
  try {
    engine.loadFen(row.before);
    const first = engine.moveFromUci(lead);
    if (!first) return null;
    engine.make(first);
    const fen = engine.fen();
    const moves = [];
    for (const uci of rest) {
      const m = engine.moveFromUci(uci);
      if (!m) return null;
      moves.push(engine.sanOf(m));
      engine.make(m);
    }
    return { id: row.id, rating: row.rating, fen, moves, before: row.before, lead };
  } catch {
    return null;
  }
}

const files = new Map(); // bucket -> Promise of light rows ([] if it couldn't be fetched)
function loadBucket(bucket) {
  if (!files.has(bucket)) {
    files.set(bucket, fetch(`/tactica-puzzles/${bucket}.json`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((rows) => rows.map(lightRow))
      .catch(() => { files.delete(bucket); return []; }));
  }
  return files.get(bucket);
}

/** Light puzzles around a rating, for pickPuzzle. Empty if nothing could
 *  be fetched. */
export async function poolNear(rating, reach = 150) {
  const lists = await Promise.all(bucketsNear(rating, reach).map(loadBucket));
  return lists.flat();
}

/** Starts fetching the files around a rating without waiting for them. */
export const warmPool = (rating) => { poolNear(rating); };
