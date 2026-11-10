/* The Adventure's mini-games, on their own tiny board (no kings, no check),
   the way chess coaches teach children one piece at a time:
   - Star hunt: one piece collects every star; fewer moves, more ⭐.
   - Pawn Wars: pawns only; the first pawn to reach the far side wins, and
     a side that can't move loses.
   - Queen vs. 8 Pawns: catch every pawn before one reaches your side.
   Board: 64 squares (a1 = 0), each null or { t: "P"|"N"|"B"|"R"|"Q"|"K", w }.
   The computer side plays a small minimax search. */

const DIRS = {
  N: [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]],
  B: [[1, 1], [1, -1], [-1, 1], [-1, -1]],
  R: [[1, 0], [-1, 0], [0, 1], [0, -1]],
  K: [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]],
};
DIRS.Q = DIRS.K;
const SLIDES = { B: true, R: true, Q: true };
const TYPE_NUM = { P: 1, N: 2, B: 3, R: 4, Q: 5, K: 6 };

export const sq = (name) => (Number(name[1]) - 1) * 8 + "abcdefgh".indexOf(name[0]);
const fileOf = (s) => s % 8, rankOf = (s) => (s / 8) | 0;

/** A board from "Qd1 pa7 pb7" style text: capital letter = White's. */
export function boardFrom(text) {
  const b = Array(64).fill(null);
  for (const tok of text.trim().split(/\s+/)) {
    const t = tok[0].toUpperCase();
    b[sq(tok.slice(1))] = { t, w: tok[0] === t };
  }
  return b;
}
/** The engine-style number for KidBoard: + White, - Black, 0 empty. */
export const pieceNum = (p) => (p ? (p.w ? 1 : -1) * TYPE_NUM[p.t] : 0);

/** Every move for `white`'s pieces: [{ from, to, capture }]. `rocks` are
 *  squares nothing can stand on or pass through. */
export function movesFor(b, white, rocks = []) {
  const out = [];
  const blocked = (s) => rocks.includes(s);
  for (let from = 0; from < 64; from++) {
    const p = b[from];
    if (!p || p.w !== white) continue;
    const f = fileOf(from), r = rankOf(from);
    if (p.t === "P") {
      const dir = white ? 1 : -1;
      const one = from + 8 * dir;
      if (r + dir >= 0 && r + dir <= 7) {
        if (!b[one] && !blocked(one)) {
          out.push({ from, to: one, capture: false });
          const start = white ? 1 : 6, two = from + 16 * dir;
          if (r === start && !b[two] && !blocked(two)) out.push({ from, to: two, capture: false });
        }
        for (const df of [-1, 1]) {
          if (f + df < 0 || f + df > 7) continue;
          const to = one + df;
          if (b[to] && b[to].w !== white) out.push({ from, to, capture: true });
        }
      }
      continue;
    }
    for (const [df, dr] of DIRS[p.t]) {
      let nf = f + df, nr = r + dr;
      while (nf >= 0 && nf <= 7 && nr >= 0 && nr <= 7) {
        const to = nr * 8 + nf;
        if (blocked(to)) break;
        if (b[to]) {
          if (b[to].w !== white) out.push({ from, to, capture: true });
          break;
        }
        out.push({ from, to, capture: false });
        if (!SLIDES[p.t]) break;
        nf += df; nr += dr;
      }
    }
  }
  return out;
}

export function apply(b, m) {
  const next = b.slice();
  next[m.to] = next[m.from];
  next[m.from] = null;
  return next;
}

/* ---------------- Star hunt ---------------- */

/** The fewest moves to collect every star with the one piece on `start`
 *  (a breadth-first search over where it stands and which stars are left). */
export function starPar(type, start, stars, rocks = []) {
  const all = (1 << stars.length) - 1;
  const key = (s, got) => s * 64 + got;
  const seen = new Set([key(start, 0)]);
  let frontier = [[start, 0]];
  for (let depth = 1; depth <= 40 && frontier.length; depth++) {
    const next = [];
    for (const [s, got] of frontier) {
      const b = Array(64).fill(null);
      b[s] = { t: type, w: true };
      for (const m of movesFor(b, true, rocks)) {
        const i = stars.indexOf(m.to);
        const g = i >= 0 ? got | (1 << i) : got;
        if (g === all) return depth;
        if (!seen.has(key(m.to, g))) { seen.add(key(m.to, g)); next.push([m.to, g]); }
      }
    }
    frontier = next;
  }
  return null;
}
export const starRating = (used, par) => (used <= par ? 3 : used <= par + 2 ? 2 : 1);

/* ---------------- Pawn Wars and Queen vs. pawns ---------------- */

/** Who has won: "white", "black" or null. `game` is "pawnwars" or
 *  "queenhunt"; `toMove` is the side about to move. */
export function winner(b, game, toMove) {
  for (let f = 0; f < 8; f++) {
    if (b[56 + f]?.t === "P" && b[56 + f].w) return "white";
    if (b[f]?.t === "P" && !b[f].w) return "black";
  }
  if (game === "queenhunt") {
    if (!b.some((p) => p && !p.w)) return "white";
    if (!b.some((p) => p && p.w)) return "black";
  }
  if (!movesFor(b, toMove === "white").length) return toMove === "white" ? "black" : "white";
  return null;
}

/* From White's side: pawns further up the board are worth more, a pawn
   that can run unchallenged is worth a lot, and pieces count. */
function evaluate(b, game) {
  let score = 0;
  for (let s = 0; s < 64; s++) {
    const p = b[s];
    if (!p) continue;
    const sign = p.w ? 1 : -1;
    if (p.t === "P") {
      const adv = p.w ? rankOf(s) - 1 : 6 - rankOf(s);
      score += sign * (100 + adv * adv * 12);
    } else score += sign * (p.t === "Q" ? 900 : 300);
  }
  return game === "queenhunt" ? score : score;
}

function search(b, game, white, depth, alpha, beta) {
  const win = winner(b, game, white ? "white" : "black");
  if (win) return (win === "white" ? 1 : -1) * (100000 + depth);
  if (depth === 0) return evaluate(b, game);
  const moves = movesFor(b, white);
  moves.sort((x, y) => Number(y.capture) - Number(x.capture));
  if (white) {
    let best = -Infinity;
    for (const m of moves) {
      best = Math.max(best, search(apply(b, m), game, false, depth - 1, alpha, beta));
      alpha = Math.max(alpha, best);
      if (alpha >= beta) break;
    }
    return best;
  }
  let best = Infinity;
  for (const m of moves) {
    best = Math.min(best, search(apply(b, m), game, true, depth - 1, alpha, beta));
    beta = Math.min(beta, best);
    if (alpha >= beta) break;
  }
  return best;
}

/** The computer's move for `white`'s side, searching `depth` moves ahead;
 *  ties are broken at random so games don't repeat. */
export function aiMove(b, game, white, depth = 3, rng = Math.random) {
  const moves = movesFor(b, white);
  if (!moves.length) return null;
  let best = null, bestScore = white ? -Infinity : Infinity;
  for (const m of moves) {
    const s = search(apply(b, m), game, !white, depth - 1, -Infinity, Infinity) + (rng() - 0.5) * 6;
    if (white ? s > bestScore : s < bestScore) { bestScore = s; best = m; }
  }
  return best;
}
