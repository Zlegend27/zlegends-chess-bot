/* Encode/decode a finished-or-in-progress game into a compact URL hash so it
   can be shared and replayed. The engine has no SAN parser, so decoding
   replays moves by matching each target SAN string against the legal moves
   generated at that ply (sanOf is a pure function of position + move). */

export function encodeGame(playerColor, moveList) {
  const payload = JSON.stringify({ c: playerColor, m: moveList });
  return btoa(payload);
}

export function decodeGame(hash) {
  try {
    const payload = JSON.parse(atob(hash));
    if (!payload || !Array.isArray(payload.m)) return null;
    return { playerColor: payload.c === -1 ? -1 : 1, moveList: payload.m };
  } catch {
    return null;
  }
}

export function getSharedHash() {
  const raw = window.location.hash || "";
  const match = raw.match(/^#g=(.+)$/);
  return match ? match[1] : null;
}

/** Replays SAN moves into `eng` one at a time. Returns the list of applied
 *  move objects (engine move ints) up to the first mismatch. */
export function replayIntoEngine(eng, moveList) {
  const applied = [];
  for (const san of moveList) {
    const legal = eng.legalMoves();
    const move = legal.find(m => eng.sanOf(m) === san);
    if (move === undefined) break;
    eng.make(move);
    applied.push(move);
  }
  return applied;
}
