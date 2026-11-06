/* Rules of the Vienna Trainer, kept apart from the screen so they can be
   tested. The book (src/data/viennaRepertoire.json, built by
   scripts/vienna/build.mjs) maps each position, keyed by its moves so far,
   to either:
     { r: { san: [band0, band1, band2] } }   Black's replies and how often
                                              real players chose them
     { w: { rep, ok, ev, punish? } }         White's repertoire move, other
                                              playable moves, Stockfish's
                                              score for each (centipawns),
                                              and whether Black's last move
                                              was a mistake worth punishing */

import { M120TO64, mFrom, mTo, mPromo } from "../engine/chessEngine.js";

/* Lichess ratings run about 300 above Chess.com's, so the bands are built on
   Lichess numbers and described here in Chess.com terms. `maia` is the
   rating Maia plays at once real games run out; `elo` is Stockfish's
   strength in free play (it can't go below 1320). */
export const BANDS = [
  { label: "Beginner", detail: "about 700–1100 on Chess.com", maia: 900, elo: 1320 },
  { label: "Improving", detail: "about 1100–1400 on Chess.com", maia: 1250, elo: 1500 },
  { label: "Club", detail: "about 1400–1700 on Chess.com", maia: 1550, elo: 1700 },
  { label: "Advanced", detail: "about 1700–2100 on Chess.com", maia: 1900, elo: 2000 },
];

/* Past known theory the trainer keeps going to this many half-moves (move
   20), with Maia playing Black and Stockfish checking the player. */
export const EXTEND_TO_PLY = 40;
/* A move this many centipawns worse than Stockfish's best is sent back. */
export const ENGINE_MISS_CP = 60;

const PROMO = { 2: "n", 3: "b", 4: "r", 5: "q" };
const sqName = (s120) => { const s = M120TO64[s120]; return "abcdefgh"[s % 8] + ((s >> 3) + 1); };
/** A move in the e2e4 form engines use. */
export const uciOf = (m) => sqName(mFrom(m)) + sqName(mTo(m)) + (PROMO[mPromo(m)] || "");

/** Picks Maia's move from its { uci: chance } read, ignoring long shots so
 *  a human-like reply never turns into a random one. */
export function pickByChance(chances, rng = Math.random) {
  const entries = Object.entries(chances).filter(([, p]) => p >= 0.03);
  const total = entries.reduce((s, [, p]) => s + p, 0);
  if (!total) return null;
  let r = rng() * total;
  for (const [uci, p] of entries) {
    r -= p;
    if (r <= 0) return uci;
  }
  return entries[entries.length - 1][0];
}

/* How strongly Black favours its most common replies: 1 plays them as often
   as real players do, lower values bring out rarer lines more often. */
export const VARIETY = [
  { id: "common", label: "Most common replies", power: 1 },
  { id: "mixed", label: "Mixed", power: 0.7 },
  { id: "rare", label: "Surprise me", power: 0.35 },
];

/* A line the player has missed before comes up this many times as often. */
const WEAK_BOOST = 3;

export const keyOf = (moves) => moves.join(" ");
const childKey = (key, san) => (key ? `${key} ${san}` : san);
const sum = (counts) => counts.reduce((a, b) => a + b, 0);

export function nodeAt(book, moves) {
  return book.nodes[keyOf(moves)] ?? null;
}

/** Picks Black's reply from real games at the chosen level. Lines leading to
 *  a position in `weak` (keys the player has missed) are favoured. */
export function pickReply(node, moves, { band = 0, power = 0.7, weak = {}, rng = Math.random } = {}) {
  const key = keyOf(moves);
  const weakKeys = Object.keys(weak);
  const entries = Object.entries(node.r).map(([san, counts]) => {
    /* A reply nobody at this level played still exists in the book because
       other levels did; give it a small share instead of none. */
    const played = counts[band] || sum(counts) / 20;
    const child = childKey(key, san);
    const missedBelow = weakKeys.some((k) => k === child || k.startsWith(child + " "));
    return { san, weight: played ** power * (missedBelow ? WEAK_BOOST : 1) };
  });
  const total = entries.reduce((s, e) => s + e.weight, 0);
  let r = rng() * total;
  for (const e of entries) {
    r -= e.weight;
    if (r <= 0) return e.san;
  }
  return entries[entries.length - 1].san;
}

/** How the player's move compares with the repertoire:
 *  "rep"      the repertoire move
 *  "ok"       a sound alternative, but not the repertoire's choice
 *  "mistake"  a move people play here that Stockfish rates clearly worse
 *  "off"      a move the book doesn't cover
 *  `loss` is how many centipawns worse than the repertoire move it scored. */
export function judgeMove(node, san) {
  const { rep, ok, ev } = node.w;
  if (san === rep) return { verdict: "rep", rep };
  const loss = san in ev && rep in ev ? ev[rep] - ev[san] : null;
  if (ok.includes(san)) return { verdict: "ok", rep, loss };
  if (loss != null) return { verdict: "mistake", rep, loss };
  return { verdict: "off", rep, loss: null };
}

/** Records a miss or a first-try success at a position, so missed lines come
 *  back until they're learned. Returns a new object. */
export function updateWeak(weak, key, correctFirstTry) {
  const next = { ...weak };
  if (correctFirstTry) {
    if (next[key] > 1) next[key] -= 1;
    else delete next[key];
  } else {
    next[key] = Math.min(3, (next[key] || 0) + 1);
  }
  return next;
}

/** "a pawn", "1.5 pawns": centipawns as a player would say them. */
export function pawnsText(cp) {
  const pawns = Math.round(cp / 10) / 10;
  return `${pawns} pawn${pawns === 1 ? "" : "s"}`;
}
