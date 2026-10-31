/* Includes the typographic forms: checkGameOver's display text ("1–0", "½–½")
   went straight into saved PGNs for a long time, so stored games have them. */
const RESULT_TOKEN = /^(1[-–—]0|0[-–—]1|1\/2[-–—]1\/2|1\/2|½[-–—]½|\*)$/;

/* Strips PGN headers/comments/variations/NAGs/results down to a flat list
   of SAN move tokens. The engine has no PGN grammar of its own -- pasted
   games get matched against legalMoves() one ply at a time (see
   replayForeignPgn below), same trick share.js's replayIntoEngine uses
   for our own exports, just tolerant of minor notation differences
   (digit-zero castling, missing/extra check marks) since a pasted game
   could come from any external source. */
export function parsePgnMoves(text) {
  if (!text) return [];
  let body = text
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\{[^}]*\}/g, " ")
    .replace(/;[^\n]*/g, " ")
    .replace(/\$\d+/g, " ");
  /* Variations can nest, and one pass only removes the innermost layer --
     the rest would then be read as main-line moves. */
  let previous;
  do {
    previous = body;
    body = body.replace(/\([^()]*\)/g, " ");
  } while (body !== previous);
  const tokens = body.split(/\s+/).filter(Boolean);
  const moves = [];
  for (const raw of tokens) {
    /* A result ends the game. Stopping here matters for files holding
       several games: carrying on would splice the second game onto the
       first, and if its moves happen to be legal there, nothing would
       ever flag the result as wrong. */
    if (RESULT_TOKEN.test(raw)) {
      if (moves.length) break;
      continue;
    }
    if (/^\d+\.*$/.test(raw) || /^e\.?p\.?$/i.test(raw)) continue;
    let tok = raw.replace(/^\d+\.+/, "").replace(/e\.p\.$/i, "").replace(/[!?]+$/g, "");
    if (!tok) continue;
    tok = tok.replace(/^[0oO]-[0oO]-[0oO](?=[+#]?$)/, "O-O-O").replace(/^[0oO]-[0oO](?=[+#]?$)/, "O-O");
    /* "e8Q" and "bxa8q" for the e8=Q our generator writes. */
    tok = tok.replace(/^([a-h](?:x[a-h])?[18])([qrbnQRBN])([+#]?)$/, (_, sq, piece, mark) => `${sq}=${piece.toUpperCase()}${mark}`);
    moves.push(tok);
  }
  return moves;
}

/** Tag pairs as an object. If a file holds several games, the first
 *  game's values win, matching which game parsePgnMoves returns. */
export function parsePgnHeaders(text) {
  const headers = {};
  if (!text) return headers;
  const re = /^\s*\[(\w+)\s+"((?:[^"\\]|\\.)*)"\s*\]/gm;
  let m;
  while ((m = re.exec(text))) {
    if (!(m[1] in headers)) headers[m[1]] = m[2].replace(/\\(.)/g, "$1");
  }
  return headers;
}

export function countPgnGames(text) {
  return (text?.match(/^\s*\[Event\s/gm) || []).length;
}

/** What the review screen shows for a game: player names (with ratings
 *  when the file has real ones) and how it ended. "?" is PGN's standard
 *  "unknown" value, so it gets the same treatment as a missing tag. */
export function reviewInfoFromHeaders(headers) {
  const known = (v) => (v && v !== "?" && v !== "-" ? v : "");
  const label = (name, elo, fallback) => {
    const rating = Number(elo) > 0 ? ` (${elo})` : "";
    return (known(name) || fallback) + rating;
  };
  const result = known(headers.Result) === "*" ? "" : known(headers.Result);
  return {
    white: label(headers.White, headers.WhiteElo, "White"),
    black: label(headers.Black, headers.BlackElo, "Black"),
    outcome: known(headers.Termination) || result,
  };
}

/** Which colour the person who exported the game played, when the file
 *  says. Chess.com's Link tag carries the exporter's name
 *  ("...?username=zlegend27_yt"), lowercased, so it's matched against the
 *  White and Black tags ignoring case. Returns 1, -1, or null if unknown. */
export function exporterSide(headers) {
  const match = /[?&]username=([^&#]+)/i.exec(headers.Link || "");
  if (!match) return null;
  const who = match[1].toLowerCase();
  if (headers.White?.toLowerCase() === who) return 1;
  if (headers.Black?.toLowerCase() === who) return -1;
  return null;
}

const START_FEN_BOARD = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR";

/** Explains text we can already tell isn't a reviewable game, or returns
 *  null if it's worth trying to parse. Each of these used to end in a
 *  generic "couldn't match" error, or worse: a game with a custom start
 *  would replay from the normal position and show a wrong game. */
export function describePasteProblem(text) {
  const t = (text || "").trim();
  if (!t) return "Paste a game first.";
  if (!/\s/.test(t) && /^(https?:\/\/|www\.|(chess\.com|lichess\.org)\/)/i.test(t)) {
    return "That's a link to the game. We need the game's PGN text instead. The steps below show where to find it.";
  }
  if (/^[pnbrqk1-8]+(\/[pnbrqk1-8]+){7}(\s|$)/i.test(t)) {
    return "That's a single position, not a whole game. Paste the game's PGN instead.";
  }
  const h = parsePgnHeaders(t);
  const customFen = h.FEN && h.FEN.split(/\s+/)[0] !== START_FEN_BOARD;
  const variant = h.Variant && !/^(standard|chess)$/i.test(h.Variant);
  if (customFen || variant) {
    return "This game doesn't use the normal starting position, so it can't be reviewed yet.";
  }
  return null;
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

/* checkGameOver's result text is for display. PGN requires plain ASCII, and
   other sites may reject anything else. */
const standardResult = (text) => text.replace(/[–—]/g, "-").replace("½-½", "1/2-1/2");

export function buildPgn(moveList, resultText) {
  const parts = [];
  for (let i = 0; i < moveList.length; i += 2) {
    const num = i / 2 + 1;
    const white = moveList[i];
    const black = moveList[i + 1];
    parts.push(black ? `${num}. ${white} ${black}` : `${num}. ${white}`);
  }
  const movesText = parts.join(" ");
  return resultText ? `${movesText} ${standardResult(resultText)}`.trim() : movesText;
}
