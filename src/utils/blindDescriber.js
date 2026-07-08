/* ================================================================
   Blind Chess — spoken position descriptions.

   Tier-1 deterministic describers (see the blind-mode design
   discussion): everything here is computed straight off the board,
   templated into speech, and therefore can't hallucinate. The
   optional LLM "coach narrative" tier sits on top of these facts
   later — it never replaces them.
   ================================================================ */

import { EMPTY, WP, WN, WB, WR, WQ, WK, fileOf, M64TO120 } from "../engine/chessEngine";
import { PIECE_SPOKEN, sqName, legalMoveInfos, matchMoves, sanToSpeech } from "./blindChess";

const START_COUNT = { [WP]: 8, [WN]: 2, [WB]: 2, [WR]: 2, [WQ]: 1, [WK]: 1 };
const PIECE_ORDER = [WK, WQ, WR, WB, WN, WP];
const VALUE = { [WP]: 1, [WN]: 3, [WB]: 3, [WR]: 5, [WQ]: 9, [WK]: 0 };

const plural = (name, n) => (n === 1 ? name : name + "s");
const joinList = (items) =>
  items.length <= 1 ? (items[0] || "") :
  items.length === 2 ? `${items[0]} and ${items[1]}` :
  `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;

/** { 1: {pieceType: [sq64...]}, -1: {...} } */
function piecesByColor(engine) {
  const out = { 1: {}, [-1]: {} };
  for (let i = 0; i < 64; i++) {
    const p = engine.pieceAt(i);
    if (p === EMPTY) continue;
    const color = p > 0 ? 1 : -1, type = Math.abs(p);
    (out[color][type] = out[color][type] || []).push(i);
  }
  return out;
}

const colorName = (c) => (c === 1 ? "White" : "Black");

export function describeTurn(engine) {
  return `It is ${colorName(engine.getSide())} to move.`;
}

/** Full board read, grouped by piece type — much easier to hold in your
 *  head than square-by-square. */
export function describeBoard(engine) {
  const byColor = piecesByColor(engine);
  const parts = [];
  for (const color of [1, -1]) {
    const bits = [];
    for (const type of PIECE_ORDER) {
      const squares = byColor[color][type];
      if (!squares) continue;
      bits.push(`${plural(PIECE_SPOKEN[type], squares.length)} ${squares.map(sqName).join(", ")}`);
    }
    parts.push(`${colorName(color)}: ${bits.join("; ")}.`);
  }
  return parts.join(" ");
}

export function describeCaptured(engine) {
  const byColor = piecesByColor(engine);
  const parts = [];
  for (const color of [1, -1]) {
    const missing = [];
    for (const type of PIECE_ORDER) {
      const gone = START_COUNT[type] - (byColor[color][type] || []).length;
      if (gone > 0) missing.push(`${gone === 1 ? "a" : gone} ${plural(PIECE_SPOKEN[type], gone)}`);
    }
    if (missing.length) parts.push(`${colorName(color)} has lost ${joinList(missing)}.`);
  }
  return parts.length ? parts.join(" ") : "No pieces have been captured yet.";
}

/** Natural-language summary: material balance, king safety facts,
 *  check status — the "coach glance", not a full read. */
export function describeSummary(engine) {
  const byColor = piecesByColor(engine);
  const material = { 1: 0, [-1]: 0 };
  for (const color of [1, -1])
    for (const type of PIECE_ORDER)
      material[color] += (byColor[color][type] || []).length * VALUE[type];

  const parts = [];
  const diff = material[1] - material[-1];
  if (diff === 0) parts.push("Material is equal.");
  else {
    const ahead = diff > 0 ? 1 : -1;
    parts.push(`${colorName(ahead)} is up ${Math.abs(diff)} ${Math.abs(diff) === 1 ? "point" : "points"} of material.`);
  }

  /* Castling rights come from the FEN the engine itself reports. */
  const castleField = engine.fen().split(" ")[2];
  const rights = (c) => {
    const k = castleField.includes(c === 1 ? "K" : "k"), q = castleField.includes(c === 1 ? "Q" : "q");
    if (k && q) return `${colorName(c)} can still castle either side.`;
    if (k) return `${colorName(c)} can still castle kingside.`;
    if (q) return `${colorName(c)} can still castle queenside.`;
    return null;
  };
  for (const c of [1, -1]) { const r = rights(c); if (r) parts.push(r); }

  if (engine.inCheckNow()) parts.push(`${colorName(engine.getSide())} is in check.`);
  parts.push(describeTurn(engine));
  return parts.join(" ");
}

/* ---------------- question answering ----------------
   Coherent Q&A for help requests mid-game ("where can my knight
   move?", "what can I take?", "is that a capture?"). All computed
   from legalMoveInfos — deterministic, so the coach can never claim
   a move exists that doesn't. */

/** Targets of one origin square, captures called out:
 *  "f3, h3, or take the pawn on e5". Promotion targets deduped. */
function describeTargets(infos) {
  const seen = new Set();
  const quiet = [], caps = [];
  for (const x of infos) {
    if (seen.has(x.to64)) continue;
    seen.add(x.to64);
    if (x.capture) caps.push(`take the ${PIECE_SPOKEN[x.capturedPiece]} on ${sqName(x.to64)}`);
    else quiet.push(sqName(x.to64));
  }
  const bits = [];
  if (quiet.length) bits.push(`go to ${joinList(quiet)}`);
  bits.push(...caps);
  return joinList(bits);
}

function answerMobility(engine, { piece, square }) {
  const infos = legalMoveInfos(engine).filter(x => !x.castle);
  const mine = infos.filter(x =>
    (piece ? x.piece === piece : true) &&
    (square ? sqName(x.from64) === square : true));
  if (!piece && !square) {
    /* "what are my moves" — a full dump would be unlistenable; summarize
       and invite a narrower question. */
    const types = [...new Set(infos.map(x => x.piece))].map(t => PIECE_SPOKEN[t]);
    return `You have ${infos.length} legal moves, with ${joinList(types)} able to move. Ask about one, like "where can my knight move?"`;
  }
  if (mine.length === 0) {
    if (square) {
      const p = engine.pieceAt((square.charCodeAt(0) - 97) + (square.charCodeAt(1) - 49) * 8);
      if (p === EMPTY) return `There's nothing on ${square}.`;
      return `The ${PIECE_SPOKEN[Math.abs(p)]} on ${square} has no legal moves right now.`;
    }
    const owned = [];
    for (let i = 0; i < 64; i++) {
      const p = engine.pieceAt(i);
      if (p !== EMPTY && Math.abs(p) === piece && Math.sign(p) === engine.getSide()) owned.push(i);
    }
    if (owned.length === 0) return `You don't have any ${PIECE_SPOKEN[piece]}s left.`;
    return `Your ${plural(PIECE_SPOKEN[piece], owned.length)} on ${joinList(owned.map(sqName))} ${owned.length === 1 ? "has" : "have"} no legal moves right now.`;
  }
  /* group by origin so "which knight" never needs asking — both get answered */
  const byFrom = new Map();
  for (const x of mine) (byFrom.get(x.from64) || byFrom.set(x.from64, []).get(x.from64)).push(x);
  const parts = [];
  for (const [from64, list] of byFrom) {
    parts.push(`Your ${PIECE_SPOKEN[list[0].piece]} on ${sqName(from64)} can ${describeTargets(list)}.`);
  }
  return parts.join(" ");
}

function answerSquareContent(engine, { square }) {
  if (!square) return "Which square do you mean?";
  const p = engine.pieceAt((square.charCodeAt(0) - 97) + (square.charCodeAt(1) - 49) * 8);
  if (p === EMPTY) return `${square} is empty.`;
  return `${square} has a ${p > 0 ? "White" : "Black"} ${PIECE_SPOKEN[Math.abs(p)]}.`;
}

function answerCaptureAt(engine, { square, piece }) {
  let caps = legalMoveInfos(engine).filter(x => x.capture);
  if (square) caps = caps.filter(x => sqName(x.to64) === square);
  if (piece) caps = caps.filter(x => x.piece === piece);
  if (caps.length === 0) {
    return square ? `Nothing of yours can capture on ${square}.` : "You have no captures available right now.";
  }
  /* group by victim square: "you can take the pawn on e5 with the knight
     from f3 or the pawn from d4" */
  const byTarget = new Map();
  for (const x of caps) (byTarget.get(x.to64) || byTarget.set(x.to64, []).get(x.to64)).push(x);
  const parts = [];
  for (const [to64, list] of byTarget) {
    const attackers = [...new Set(list.map(x => `the ${PIECE_SPOKEN[x.piece]} from ${sqName(x.from64)}`))];
    parts.push(`You can take the ${PIECE_SPOKEN[list[0].capturedPiece]} on ${sqName(to64)} with ${joinList(attackers)}.`);
  }
  return parts.join(" ");
}

function answerIsCapture(engine, { spec }) {
  if (!spec || (!spec.to && !spec.castle)) {
    return 'Tell me the move you\'re thinking of — for example, "if I play knight to e5, is that a capture?"';
  }
  const matches = matchMoves(engine, spec);
  if (matches.length === 0) return "That move isn't legal right now, so no.";
  const caps = matches.filter(x => isCapSan(x.san));
  if (caps.length === matches.length) {
    const victim = victimOf(engine, matches[0]);
    return `Yes — ${sanToSpeech(matches[0].san)} captures ${victim}.`;
  }
  if (caps.length === 0) return `No — ${sanToSpeech(matches[0].san)} doesn't capture anything.`;
  /* mixed (two same-type pieces, only one path captures) */
  return matches.map(x =>
    `${sanToSpeech(x.san)} from ${sqName(x.from64)} ${isCapSan(x.san) ? `captures ${victimOf(engine, x)}` : "is not a capture"}`
  ).join(". ") + ".";
}
const isCapSan = (san) => san.includes("x");
function victimOf(engine, match) {
  const p = engine.pieceAt(match.to64);
  return p !== EMPTY ? `the ${PIECE_SPOKEN[Math.abs(p)]} on ${sqName(match.to64)}` : "a pawn en passant";
}

function answerLegality(engine, { spec }) {
  if (!spec || (!spec.to && !spec.castle)) return "Tell me the move and I'll check it.";
  const matches = matchMoves(engine, spec);
  if (spec.castle) {
    if (matches.length === 0) return "No — you can't castle right now.";
    const sides = matches.map(x => (fileOf(M64TO120[x.to64]) === 6 ? "kingside" : "queenside"));
    return sides.length === 2 ? "Yes — you can castle on either side."
      : `Yes — you can castle ${sides[0]}.`;
  }
  if (matches.length === 0) return "No — that's not legal right now.";
  const cap = isCapSan(matches[0].san) ? `, and it captures ${victimOf(engine, matches[0])}` : "";
  return `Yes — ${sanToSpeech(matches[0].san)} is legal${cap}.`;
}

export function answerQuestion(engine, q) {
  switch (q.question) {
    case "mobility": return answerMobility(engine, q);
    case "squareContent": return answerSquareContent(engine, q);
    case "captureAt": return answerCaptureAt(engine, q);
    case "isCapture": return answerIsCapture(engine, q);
    case "legality": return answerLegality(engine, q);
    default: return "I'm not sure how to answer that yet.";
  }
}

/** "How am I doing?" — coarse buckets over the engine's own eval (free
 *  and instant; no Stockfish call needed for a rough standing), plus the
 *  concrete material count so the answer never feels hand-wavy. */
export function describeStanding(engine, playerColor) {
  const cp = engine.evalWhite() * playerColor;
  let phrase;
  if (cp >= 700) phrase = "You're completely winning.";
  else if (cp >= 300) phrase = "You're winning.";
  else if (cp >= 120) phrase = "You're clearly better.";
  else if (cp >= 40) phrase = "You're slightly better.";
  else if (cp > -40) phrase = "The game is roughly equal.";
  else if (cp > -120) phrase = "You're slightly worse.";
  else if (cp > -300) phrase = "You're clearly worse.";
  else if (cp > -700) phrase = "You're losing — look for chances to complicate.";
  else phrase = "You're in serious trouble.";

  const byColor = piecesByColor(engine);
  const material = { 1: 0, [-1]: 0 };
  for (const color of [1, -1])
    for (const type of PIECE_ORDER)
      material[color] += (byColor[color][type] || []).length * VALUE[type];
  const diff = material[playerColor] - material[-playerColor];
  const matBit = diff === 0 ? "Material is even."
    : diff > 0 ? `You're up ${diff} ${diff === 1 ? "point" : "points"} of material.`
    : `You're down ${-diff} ${-diff === 1 ? "point" : "points"} of material.`;
  return `${phrase} ${matBit}`;
}

export function describeThreats(engine) {
  if (engine.inCheckNow()) {
    return `Yes — ${colorName(engine.getSide())}'s king is in check right now.`;
  }
  const kingSq = piecesByColor(engine)[engine.getSide()][WK]?.[0];
  return `Your king on ${kingSq !== undefined ? sqName(kingSq) : "?"} is not in check.`;
}
