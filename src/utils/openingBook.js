/* Opening book: prefer real opening theory over search, weighted by how
   often each move was actually played.
   The theory ships with the app (openingBook-lichess.json, built from the
   Lichess game database by scripts/import-opening-book.mjs) and covers the
   first ~10 full moves. It used to come live from the Lichess Opening
   Explorer, but that started answering 401 without a login in 2026-11, and
   a token can't go in browser code. Bundled, a lookup is instant and works
   offline, so the bot never waits on the network to play its first move.
   Positions the bundled book doesn't have fall back to a small hardcoded
   book, then to normal search in the caller. */
import { bookKey } from "./bookKey";
import LICHESS_BOOK from "./openingBook-lichess.json";

/* Covers only the first couple of plies of a handful of common openings.
   The bundled book already covers all of these; this stays as a last
   resort in case that file is ever regenerated thin or broken. Keyed by
   the SAN move list played so far, space-joined. */
const STATIC_BOOK = {
  "": [["e4", 5], ["d4", 4], ["c4", 2], ["Nf3", 2]],
  "e4": [["e5", 4], ["c5", 4], ["e6", 2], ["c6", 2], ["d5", 1]],
  "d4": [["d5", 4], ["Nf6", 4], ["e6", 1], ["c5", 1]],
  "c4": [["e5", 2], ["Nf6", 3], ["c5", 2]],
  "Nf3": [["d5", 2], ["Nf6", 3], ["c5", 1]],
  "e4 e5": [["Nf3", 4], ["Bc4", 2], ["Nc3", 1]],
  "e4 c5": [["Nf3", 4], ["Nc3", 2], ["c3", 1]],
  "e4 e6": [["d4", 4], ["Nc3", 1]],
  "e4 c6": [["d4", 4], ["Nc3", 1]],
  "d4 d5": [["c4", 4], ["Nf3", 3]],
  "d4 Nf6": [["c4", 4], ["Nf3", 3]],
  "e4 e5 Nf3": [["Nc6", 4], ["Nf6", 1]],
  "e4 e5 Nf3 Nc6": [["Bb5", 3], ["Bc4", 3], ["d4", 1]],
  "d4 d5 c4": [["e6", 3], ["c6", 3], ["dxc4", 1]],
};

/* Style bias for the Casual bot's daily personality (only Casual opts in --
   the Stockfish tiers don't use a book and Master stays neutral). Explorer
   weights are raw play-counts, so an untouched pick is pure popularity and
   every Casual game funnels into the same mainlines. Two knobs reshape
   that: `exp` is an exponent on the counts (below 1 flattens the
   distribution so sharp sidelines actually get picked; above 1 makes
   mainlines even stickier for solid styles), and `boost` multiplies moves
   that match the style's signature theory when they're among the
   candidates (Gambit reaching for f4/b4/c3 lines, Positional for
   d4/c4/fianchettos). All candidates still come from real played theory,
   so a boosted move can never be an unsound invention. */
const STYLE_BOOK_BIAS = {
  Aggressive: { exp: 0.55, mult: 3, boost: new Set(["e4", "f4", "Bc4", "h4", "g4", "Ng5", "d5", "f5"]) },
  Tactical: { exp: 0.65, mult: 2.5, boost: new Set(["e4", "Bc4", "Nc3", "d4", "c5", "Nf6"]) },
  Gambit: { exp: 0.5, mult: 3, boost: new Set(["e4", "f4", "b4", "c3", "Bc4", "e5", "b5"]) },
  Positional: { exp: 1.4, mult: 2.5, boost: new Set(["d4", "c4", "Nf3", "g3", "b3", "e6", "g6", "c6"]) },
  Defensive: { exp: 1.4, mult: 2.5, boost: new Set(["d4", "Nf3", "e3", "g3", "c6", "e6", "d5"]) },
};

function applyStyleBias(entries, style) {
  const bias = style && STYLE_BOOK_BIAS[style];
  if (!bias) return entries;
  return entries.map(e => ({
    san: e.san,
    weight: Math.pow(e.weight, bias.exp) * (bias.boost.has(e.san) ? bias.mult : 1),
  }));
}

function pickWeighted(entries) {
  const total = entries.reduce((s, e) => s + e.weight, 0);
  if (total <= 0) return null;
  let r = Math.random() * total;
  for (const e of entries) {
    r -= e.weight;
    if (r <= 0) return e.san;
  }
  return entries[entries.length - 1].san;
}

export function getStaticBookMove(moveList, style) {
  const entry = STATIC_BOOK[moveList.join(" ")];
  if (!entry) return null;
  return pickWeighted(applyStyleBias(entry.map(([san, weight]) => ({ san, weight })), style));
}

/** The bundled book's moves for a position, as {san, weight}, or null. Each
    entry is stored as "san weight san weight ..." with weights in
    per-mille of the games through that position; the generator already
    dropped positions with too few games and moves too rarely played. */
export function lichessBookEntries(fenStr) {
  const raw = LICHESS_BOOK.positions[bookKey(fenStr)];
  if (!raw) return null;
  const parts = raw.split(" ");
  const entries = [];
  for (let i = 0; i + 1 < parts.length; i += 2) {
    const weight = Number(parts[i + 1]);
    if (weight > 0) entries.push({ san: parts[i], weight });
  }
  return entries.length ? entries : null;
}

export function getLichessBookMove(fenStr, style) {
  const entries = lichessBookEntries(fenStr);
  return entries ? pickWeighted(applyStyleBias(entries, style)) : null;
}

/** A book move (SAN) for the position, or null when neither book has it.
    Synchronous: nothing here touches the network. */
export function getBookMove(fenStr, moveList, opts = {}) {
  return getLichessBookMove(fenStr, opts.style) || getStaticBookMove(moveList, opts.style);
}
