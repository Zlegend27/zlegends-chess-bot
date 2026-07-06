/* Strips PGN headers/comments/variations/NAGs/results down to a flat list
   of SAN move tokens. The engine has no PGN grammar of its own -- pasted
   games get matched against legalMoves() one ply at a time (see
   replayForeignPgn below), same trick share.js's replayIntoEngine uses
   for our own exports, just tolerant of minor notation differences
   (digit-zero castling, missing/extra check marks) since a pasted game
   could come from any external source. */
export function parsePgnMoves(text) {
  if (!text) return [];
  const body = text
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\{[^}]*\}/g, " ")
    .replace(/;[^\n]*/g, " ")
    .replace(/\$\d+/g, " ")
    .replace(/\([^()]*\)/g, " ");
  const tokens = body.split(/\s+/).filter(Boolean);
  const moves = [];
  for (const raw of tokens) {
    if (/^(1-0|0-1|1\/2-1\/2|\*)$/.test(raw)) continue;
    let tok = raw.replace(/^\d+\.+/, "");
    if (!tok) continue;
    tok = tok.replace(/^0-0-0$/i, "O-O-O").replace(/^0-0$/i, "O-O");
    tok = tok.replace(/[!?]+$/g, "");
    if (tok) moves.push(tok);
  }
  return moves;
}

const sanCore = s => s.replace(/[+#]$/, "");

/** Like share.js's replayIntoEngine, but tolerant of a pasted game's SAN
 *  not exactly matching our own generator's check/mate suffix -- falls
 *  back to comparing with +/# stripped before giving up on a ply. Returns
 *  canonical (our own generator's) SAN strings alongside the applied
 *  moves, since everything downstream (grading, review) re-derives and
 *  compares SAN via eng.sanOf and expects our own formatting. */
export function replayForeignPgn(eng, sanTokens) {
  const applied = [];
  const sans = [];
  for (const san of sanTokens) {
    const legal = eng.legalMoves();
    const move = legal.find(m => eng.sanOf(m) === san) || legal.find(m => sanCore(eng.sanOf(m)) === sanCore(san));
    if (move === undefined) break;
    sans.push(eng.sanOf(move));
    eng.make(move);
    applied.push(move);
  }
  return { applied, sans };
}

export function buildPgn(moveList, resultText) {
  const parts = [];
  for (let i = 0; i < moveList.length; i += 2) {
    const num = i / 2 + 1;
    const white = moveList[i];
    const black = moveList[i + 1];
    parts.push(black ? `${num}. ${white} ${black}` : `${num}. ${white}`);
  }
  const movesText = parts.join(" ");
  return resultText ? `${movesText} ${resultText}`.trim() : movesText;
}
