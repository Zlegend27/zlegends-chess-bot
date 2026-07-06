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

/* Longest common SAN-prefix match, same idea as the curated list's own
   detector -- once the game runs past a line's own moves it keeps
   naming that opening, since there's nothing deeper to compare against. */
export function detectEcoOpening(moveList, data) {
  let best = null;
  for (const op of data) {
    const len = Math.min(moveList.length, op.moves.length);
    if (len === 0) continue;
    let matches = true;
    for (let i = 0; i < len; i++) {
      if (moveList[i] !== op.moves[i]) { matches = false; break; }
    }
    if (matches && (!best || len > best.len)) best = { opening: op, len };
  }
  return best ? best.opening : null;
}
