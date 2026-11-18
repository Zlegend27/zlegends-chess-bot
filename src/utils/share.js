/* Encode/decode a finished-or-in-progress game into a compact URL hash so it
   can be shared and replayed. The engine has no SAN parser, so decoding
   replays moves by matching each target SAN string against the legal moves
   generated at that ply (sanOf is a pure function of position + move). */

/* The code is URL-safe base64 (no "+", "/" or "="), so it can sit in a
   path: /g/<code>. Old links used plain base64 after #g=; both decode. */
export function encodeGame(playerColor, moveList) {
  const payload = JSON.stringify({ c: playerColor, m: moveList });
  return btoa(payload).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeGame(hash) {
  try {
    let b64 = decodeURIComponent(hash).replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const payload = JSON.parse(atob(b64));
    if (!payload || !Array.isArray(payload.m)) return null;
    return { playerColor: payload.c === -1 ? -1 : 1, moveList: payload.m };
  } catch {
    return null;
  }
}

/** The shared game's code in this page's address: /g/<code> (shared links
 *  since 2026-11-17, which get a picture in link previews), or the older
 *  #g=<code>. */
export function getSharedHash() {
  const path = window.location.pathname.match(/^\/g\/([A-Za-z0-9_\-+=%]+)\/?$/);
  if (path) return path[1];
  const match = (window.location.hash || "").match(/^#g=(.+)$/);
  return match ? match[1] : null;
}

/** Replays SAN moves into `eng` one at a time. Returns the applied move ints
 *  (engine move objects) up to the first mismatch, plus whether the last
 *  applied move was a capture (SAN captures always contain "x"). */
export function replayIntoEngine(eng, moveList) {
  const applied = [];
  for (const san of moveList) {
    const legal = eng.legalMoves();
    const move = legal.find(m => eng.sanOf(m) === san);
    if (move === undefined) break;
    eng.make(move);
    applied.push(move);
  }
  const lastCaptured = applied.length > 0 && moveList[applied.length - 1].includes("x");
  return { applied, lastCaptured };
}
