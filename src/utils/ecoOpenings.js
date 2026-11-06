/* Big (~3700-entry) name/eco/moves-only opening lookup for live "what
   opening is this?" detection during play -- see
   scripts/import-eco-openings.mjs for where ecoOpenings.json comes from
   (lichess's own public chess-openings reference data, CC0) and why this
   stays separate from the small hand-curated src/utils/openings.js
   library that powers the browsable Openings modal (that one keeps its
   descriptions and quiz support; this one is purely for matching). */
let dataPromise = null;
export function loadEcoOpenings() {
  if (!dataPromise) dataPromise = import("./ecoOpenings.json").then(m => m.default);
  return dataPromise;
}

/* How many of the game's opening plies are known theory: the length of
   the longest line whose moves the game followed exactly from move 1.
   Used by move grading to tag those plies "book" instead of running
   engine judgment on memorized theory (whose shallow-probe "grades"
   were mostly noise anyway). */
export function theoryPlyCount(moveList, data) {
  let best = 0;
  for (const op of data) {
    const len = Math.min(moveList.length, op.moves.length);
    if (len <= best) continue;
    let matches = true;
    for (let i = 0; i < len; i++) {
      if (moveList[i] !== op.moves[i]) { matches = false; break; }
    }
    if (matches) best = len;
  }
  return best;
}

/* The longest opening whose own moves have all been played. One the game
   has only started (the Bongcloud after 1.e4 e5) isn't named yet. Once the
   game runs past a line's own moves it keeps naming that opening, since
   there's nothing deeper to compare against. */
export function detectEcoOpening(moveList, data) {
  let best = null;
  for (const op of data) {
    const len = op.moves.length;
    if (len === 0 || len > moveList.length) continue;
    let matches = true;
    for (let i = 0; i < len; i++) {
      if (moveList[i] !== op.moves[i]) { matches = false; break; }
    }
    if (matches && (!best || len > best.len)) best = { opening: op, len };
  }
  return best ? best.opening : null;
}
