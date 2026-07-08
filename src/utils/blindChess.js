/* ================================================================
   Blind Chess — spoken-move understanding.

   Turns speech-recognition transcripts ("knight to f three",
   "pawn takes e5", "castle long") into legal engine moves by
   slot-filling a partial move spec and matching it against the
   engine's own legal-move list — the engine stays the single
   source of truth for legality, and ambiguity falls out naturally
   as "more than one match" rather than needing its own logic.

   Deliberately deterministic (no LLM in this path): parsing has to
   be instant, free, and impossible to hallucinate. See BlindMode
   for the conversation layer that asks clarifying questions.
   ================================================================ */

import {
  EMPTY, WP, WN, WB, WR, WQ, WK,
  M64TO120, M120TO64, mFrom, mTo, mPromo, mFlags, fileOf, rankOf,
} from "../engine/chessEngine";

export const PIECE_SPOKEN = { [WP]: "pawn", [WN]: "knight", [WB]: "bishop", [WR]: "rook", [WQ]: "queen", [WK]: "king" };

/* Speech recognizers constantly mishear chess vocabulary in the same
   handful of ways ("night", "pawn to e for", "rook takes sea five") —
   a static homophone table fixes most of it before parsing starts. */
const PIECE_WORD = {
  pawn: WP, pawns: WP, pond: WP, palm: WP, prawn: WP,
  knight: WN, knights: WN, night: WN, nite: WN, horse: WN,
  bishop: WB, bishops: WB,
  rook: WR, rooks: WR, rock: WR, brook: WR, ruck: WR,
  queen: WQ, king: WK,
};
const FILE_WORD = {
  a: 0, alpha: 0,
  b: 1, bee: 1, be: 1, bravo: 1,
  c: 2, see: 2, sea: 2, charlie: 2,
  d: 3, dee: 3, delta: 3,
  e: 4, echo: 4,
  f: 5, ef: 5, eff: 5, foxtrot: 5,
  g: 6, gee: 6, golf: 6,
  h: 7, aitch: 7, hotel: 7,
};
const RANK_WORD = {
  1: 0, one: 0, won: 0,
  2: 1, two: 1, to: 1, too: 1,
  3: 2, three: 2, tree: 2, free: 2,
  4: 3, four: 3, for: 3, fore: 3,
  5: 4, five: 4,
  6: 5, six: 5,
  7: 6, seven: 6,
  8: 7, eight: 7, ate: 7,
};
const CAPTURE_WORD = new Set(["takes", "take", "taking", "captures", "capture", "capturing", "x"]);
const PROMO_WORD = new Set(["promote", "promotes", "promoting", "promotion", "equals", "equal"]);
const CASTLE_WORD = new Set(["castle", "castles", "castling"]);
const KINGSIDE_WORD = new Set(["kingside", "short"]);
const QUEENSIDE_WORD = new Set(["queenside", "long"]);
/* Filler that carries no move information once squares are assembled. */
const CONNECTOR = new Set([
  "move", "moves", "moving", "play", "plays", "go", "goes", "put",
  "the", "my", "a", "an", "on", "at", "of", "in", "into", "with",
  "piece", "please", "then", "and", "um", "uh", "it", "that",
]);

export const sqName = (i64) => "abcdefgh"[i64 % 8] + (((i64 / 8) | 0) + 1);
const sq64 = (name) => (name.charCodeAt(0) - 97) + (name.charCodeAt(1) - 49) * 8;

function normalize(text) {
  return (text || "")
    .toLowerCase()
    .replace(/['’]/g, "")   // "what's" → "whats", so phrase regexes stay simple
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* ---------------- commands ----------------
   Checked on the whole utterance BEFORE move parsing, so "what was
   captured" never gets mangled into a capture move. Phrase-level
   regexes rather than token matching for exactly that reason. */
const COMMANDS = [
  /* yes/no must match the WHOLE utterance, not a prefix — people preface
     real moves with affirmation-ish filler ("okay lets do pawn e4"), and
     a prefix match would swallow the move. The move parser ignores filler
     tokens on its own, so anything that isn't purely yes/no falls through
     to it safely. */
  { command: "yes", re: /^(yes|yeah|yep|yup|correct|confirm|confirmed|sure|ok|okay|right|exactly|affirmative)( (yes|yeah|yep|yup|correct|confirm|confirmed|sure|ok|okay|right|exactly|affirmative|thats|that|is|do|it|please))*$/ },
  { command: "no", re: /^(no|nope|nah|cancel|wrong|never|nevermind|incorrect|dont|stop|wait)( (no|nope|nah|cancel|wrong|never|nevermind|incorrect|dont|stop|wait|mind|that|this|it|please|not))*$/ },
  { command: "repeat", re: /\b(repeat|say (that |it )?again|what was that|pardon|come again)\b/ },
  { command: "board", re: /\b(read|full)\b.*\b(board|position)\b|^board$/ },
  { command: "position", re: /\b(position|summar(y|ize)|describe)\b|what does the board look like/ },
  { command: "turn", re: /\b(whose|whos|which colou?rs?) (turn|move)\b|^turn$/ },
  { command: "captured", re: /\bcaptured\b|\bcapture count\b|what (pieces )?(have|are) .*\b(taken|gone|off)\b/ },
  { command: "threats", re: /\bthreat|\battacking my king\b|\bam i in check\b|\bin check\b/ },
  { command: "undo", re: /\b(undo|take ?back|go back)\b/ },
  { command: "hint", re: /\b(hint|suggest|suggestion|help me|what should i (play|do))\b/ },
  { command: "help", re: /\bhelp$|^help\b|\bwhat can i say\b|\bwhat can you do\b|\bcommands\b|\binstructions\b|\bhow does this work\b/ },
  { command: "standing", re: /\bhow am i doing\b|\bwhos? winning\b|\bwho is winning\b|\bwhats? the score\b|\bwhat is the score\b|\bam i winning\b|\bhow (do|am) i stand/ },
  { command: "draw", re: /\b(offer|want|accept|take|call it) (a |the )?draw\b|^draw$/ },
  { command: "resign", re: /\b(resign|give up|i quit)\b/ },
  { command: "new", re: /\b(new game|start over|restart|rematch|play again)\b/ },
];
function parseCommand(text) {
  for (const c of COMMANDS) if (c.re.test(text)) return c.command;
  return null;
}

/* ---------------- questions ----------------
   "Where can my knight move?", "what can I take?", "is that a capture?"
   — all answerable straight off the legal-move list, so they're parsed
   as first-class utterances rather than falling through to the move
   parser (where "can i castle" would just castle!). Checked after
   commands, before moves. */

function extractSquares(text) {
  const tokens = tokenize(text);
  const squares = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (/^[a-h][1-8]$/.test(t)) { squares.push(t); continue; }
    if (FILE_WORD[t] !== undefined && i + 1 < tokens.length && RANK_WORD[tokens[i + 1]] !== undefined) {
      squares.push("abcdefgh"[FILE_WORD[t]] + (RANK_WORD[tokens[i + 1]] + 1));
      i++;
    }
  }
  return squares;
}
function extractPiece(text) {
  for (const t of tokenize(text)) if (PIECE_WORD[t] !== undefined) return PIECE_WORD[t];
  return null;
}

const QUESTIONS = [
  /* order matters: "can i take on e5" must hit captureAt, not legality */
  { question: "isCapture", re: /\bam i (capturing|taking)\b|\bis (that|this|it) a capture\b|\bwould (that|it|i) (capture|take|be capturing|be taking)\b|\bdo i (capture|take) (anything|something)\b/ },
  { question: "captureAt", re: /\b(what|which)( piece| pieces)? can (i )?(take|capture)\b|\bcan i (take|capture)\b|\bany(thing)? (i can |to )?(take|capture)\b/ },
  { question: "mobility", re: /\bwhere can\b|\bwhere could\b|\b(what|which) squares?\b|\bwhat moves\b|\bwhat are my .*moves\b|\bwhat can (i do with|my)\b|\bshow me my\b/ },
  { question: "squareContent", re: /\bwhats on\b|\bwhat (is|piece is) on\b|\bwhos on\b|\bwho is on\b|\bwhat do i have on\b|\bwhat is at\b/ },
  { question: "legality", re: /^(can|could) i\b|\bis (it|that) legal\b|\bam i allowed\b/ },
];

export function parseQuestion(rawText) {
  const text = normalize(rawText);
  for (const q of QUESTIONS) {
    if (!q.re.test(text)) continue;
    const squares = extractSquares(text);
    const piece = extractPiece(text);
    if (q.question === "isCapture" || q.question === "legality") {
      /* the move being asked about is embedded in the sentence itself:
         "if i move my knight to e5 am i capturing" */
      const spec = parseMoveSpec(text);
      if (spec) spec.capture = false; // "am i CAPTURING" must not pre-filter to captures
      return { kind: "question", question: q.question, spec, piece, square: squares[0] || null, text };
    }
    return { kind: "question", question: q.question, piece, square: squares[0] || null, text };
  }
  return null;
}

/* ---------------- move spec ---------------- */

function tokenize(text) {
  const raw = text.split(" ");
  const tokens = [];
  for (const t of raw) {
    /* UCI-ish run-together squares: "e2e4" → "e2", "e4" */
    const uci = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/.exec(t);
    if (uci) {
      tokens.push(uci[1], uci[2]);
      if (uci[3]) tokens.push({ q: "queen", r: "rook", b: "bishop", n: "knight" }[uci[3]]);
      continue;
    }
    tokens.push(t);
  }
  return tokens;
}

/* Slot-fill a partial move description. Every field optional except
   that a non-castle move needs a target square to be useful. */
export function parseMoveSpec(text) {
  const tokens = tokenize(normalize(text));
  if (!tokens.length || (tokens.length === 1 && !tokens[0])) return null;

  /* Castling first: "castle", "castle kingside", "long castle", "castle
     queen side" ("king"/"queen" count as a side only in castle context). */
  if (tokens.some(t => CASTLE_WORD.has(t))) {
    let side = null;
    for (const t of tokens) {
      if (KINGSIDE_WORD.has(t) || t === "king") side = "k";
      else if (QUEENSIDE_WORD.has(t) || t === "queen") side = "q";
    }
    return { castle: side || "any", piece: null, to: null, from: null, fromFile: null, capture: false, promo: null };
  }

  const spec = { castle: null, piece: null, to: null, from: null, fromFile: null, capture: false, promo: null };
  const squares = [];
  let fromMarkerNext = false;   // saw "from": the next square is the origin
  let promoNext = false;        // saw "promote(s) to" / "equals": next piece word is the promotion
  let sawPiece = false;

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (/^[a-h][1-8]$/.test(t)) {
      squares.push({ sq: t, from: fromMarkerNext });
      fromMarkerNext = false;
      continue;
    }
    /* file word + rank word → square ("e" "four", also "b" "to" = b2 —
       "to" only counts as rank 2 in this adjacent position). */
    if (FILE_WORD[t] !== undefined && i + 1 < tokens.length && RANK_WORD[tokens[i + 1]] !== undefined) {
      squares.push({ sq: "abcdefgh"[FILE_WORD[t]] + (RANK_WORD[tokens[i + 1]] + 1), from: fromMarkerNext });
      fromMarkerNext = false;
      i++;
      continue;
    }
    if (t === "from") { fromMarkerNext = true; continue; }
    if (CAPTURE_WORD.has(t)) { spec.capture = true; continue; }
    if (PROMO_WORD.has(t)) { promoNext = true; continue; }
    if (PIECE_WORD[t] !== undefined) {
      if (promoNext) { spec.promo = PIECE_WORD[t]; promoNext = false; }
      else if (!sawPiece) { spec.piece = PIECE_WORD[t]; sawPiece = true; }
      continue;
    }
    /* Lone file letter after the piece word is a SAN-style disambiguator
       ("rook a takes d1"). Only literal single letters count here —
       homophones like "be"/"see" are valid inside square assembly above,
       but as standalone words they're almost always ordinary English
       ("would i BE capturing"). "a" is excluded as the article. */
    if (t.length === 1 && FILE_WORD[t] !== undefined && sawPiece && spec.fromFile === null && t !== "a") {
      spec.fromFile = FILE_WORD[t];
      continue;
    }
    if (t === "a" || CONNECTOR.has(t) || RANK_WORD[t] !== undefined) continue;
    /* unknown token: ignore rather than fail — STT noise is normal */
  }

  const fromSq = squares.find(s => s.from);
  const rest = squares.filter(s => !s.from);
  if (fromSq) {
    spec.from = fromSq.sq;
    if (rest.length) spec.to = rest[rest.length - 1].sq;
  } else if (rest.length >= 2) {
    spec.from = rest[0].sq;
    spec.to = rest[rest.length - 1].sq;
  } else if (rest.length === 1) {
    spec.to = rest[0].sq;
  }
  if (!spec.to && spec.from && !spec.piece) {
    /* a single bare square is a destination, not an origin */
    spec.to = spec.from; spec.from = null;
  }
  if (!spec.to && !spec.castle && spec.promo === null) return null;
  return spec;
}

/* ---------------- matching against the engine ---------------- */

const isCaptureMove = (engine, m) =>
  engine.pieceAt(M120TO64[mTo(m)]) !== EMPTY || (mFlags(m) & 1) !== 0;

/** Rich info for every legal move — the raw material for Q&A answers
 *  ("where can my knight go", "what can I take"). capturedPiece is the
 *  victim's piece type (WP for en passant), or 0 for quiet moves. */
export function legalMoveInfos(engine) {
  return engine.legalMoves().map((m) => {
    const from64 = M120TO64[mFrom(m)], to64 = M120TO64[mTo(m)];
    const toPiece = engine.pieceAt(to64);
    return {
      move: m,
      from64, to64,
      piece: Math.abs(engine.pieceAt(from64)),
      capture: isCaptureMove(engine, m),
      capturedPiece: toPiece !== EMPTY ? Math.abs(toPiece) : ((mFlags(m) & 1) ? WP : 0),
      promo: mPromo(m),
      castle: (mFlags(m) & 4) !== 0,
    };
  });
}

export function matchMoves(engine, spec) {
  const legal = engine.legalMoves();
  const out = [];
  for (const m of legal) {
    const from120 = mFrom(m), to120 = mTo(m);
    const from64 = M120TO64[from120], to64 = M120TO64[to120];
    const pieceVal = Math.abs(engine.pieceAt(from64));
    if (spec.castle) {
      if (!(mFlags(m) & 4)) continue;
      const side = fileOf(to120) === 6 ? "k" : "q";
      if (spec.castle !== "any" && spec.castle !== side) continue;
    } else {
      if (sqName(to64) !== spec.to) continue;
      if (spec.piece && pieceVal !== spec.piece) continue;
      if (spec.from && sqName(from64) !== spec.from) continue;
      if (spec.fromFile !== null && fileOf(from120) !== spec.fromFile) continue;
      if (spec.capture && !isCaptureMove(engine, m)) continue;
      if (spec.promo && mPromo(m) !== spec.promo) continue;
    }
    out.push({ move: m, san: engine.sanOf(m), from64, to64, piece: pieceVal, promo: mPromo(m) });
  }
  return out;
}

/* All matches are the same pawn push/capture differing only in promotion
   piece → the right question is "promote to what?", not "which piece?". */
export function isPromotionChoice(matches) {
  return matches.length > 1 &&
    matches.every(x => x.promo > 0 && x.from64 === matches[0].from64 && x.to64 === matches[0].to64);
}

export function parseUtterance(engine, rawText) {
  const text = normalize(rawText);
  if (!text) return { kind: "unknown", text };
  const command = parseCommand(text);
  if (command) return { kind: "command", command, text };
  const question = parseQuestion(text);
  if (question) return question;
  const spec = parseMoveSpec(text);
  if (!spec) return { kind: "unknown", text };
  const matches = matchMoves(engine, spec);
  if (isPromotionChoice(matches)) return { kind: "promotion", spec, matches, text };
  return { kind: "move", spec, matches, text };
}

/* Disambiguation replies: "the one on g1", "g1", "the g1 knight",
   "the one on the b file". Returns whatever narrowing info was found. */
export function parseClarification(rawText) {
  const text = normalize(rawText);
  const tokens = tokenize(text);
  let square = null, file = null, piece = null;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (/^[a-h][1-8]$/.test(t)) { square = t; continue; }
    if (FILE_WORD[t] !== undefined && i + 1 < tokens.length && RANK_WORD[tokens[i + 1]] !== undefined) {
      square = "abcdefgh"[FILE_WORD[t]] + (RANK_WORD[tokens[i + 1]] + 1); i++; continue;
    }
    if (PIECE_WORD[t] !== undefined) { piece = PIECE_WORD[t]; continue; }
    if (t.length === 1 && FILE_WORD[t] !== undefined && t !== "a") { file = FILE_WORD[t]; continue; }
  }
  if (!square && !file && piece === null) return null;
  return { square, file, piece };
}

export function filterByClarification(matches, clar) {
  return matches.filter(x =>
    (clar.square ? sqName(x.from64) === clar.square || sqName(x.to64) === clar.square : true) &&
    (clar.file !== null && clar.file !== undefined && !clar.square ? x.from64 % 8 === clar.file : true) &&
    (clar.piece ? x.piece === clar.piece || x.promo === clar.piece : true));
}

/* ---------------- SAN → spoken English ---------------- */

const SAN_RE = /^([NBRQK])?([a-h])?([1-8])?(x)?([a-h][1-8])(=([NBRQ]))?$/;
const LETTER_PIECE = { N: "knight", B: "bishop", R: "rook", Q: "queen", K: "king" };

export function sanToSpeech(san) {
  let suffix = "";
  let core = san;
  if (core.endsWith("#")) { suffix = ", checkmate"; core = core.slice(0, -1); }
  else if (core.endsWith("+")) { suffix = ", check"; core = core.slice(0, -1); }
  if (core === "O-O") return "castles kingside" + suffix;
  if (core === "O-O-O") return "castles queenside" + suffix;
  const m = SAN_RE.exec(core);
  if (!m) return san;
  const [, pieceL, disFile, disRank, cap, target, , promoL] = m;
  let piece = pieceL ? LETTER_PIECE[pieceL] : "pawn";
  let origin = "";
  if (pieceL) {
    if (disFile && disRank) origin = ` on ${disFile}${disRank}`;
    else if (disFile) origin = ` on the ${disFile} file`;
    else if (disRank) origin = ` on rank ${disRank}`;
  } else if (cap && disFile) {
    origin = ` on the ${disFile} file`;
  }
  const verb = cap ? "takes" : "to";
  const promo = promoL ? `, promoting to ${LETTER_PIECE[promoL]}` : "";
  return `${piece}${origin} ${verb} ${target}${promo}${suffix}`;
}
