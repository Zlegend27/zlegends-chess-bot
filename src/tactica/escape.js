/* Escape to the light: a special Bin Run floor. One or two of your
   characters must reach the square lit by the hole in the bin within a set
   number of moves. Garbage sits on some squares and blocks moves like a wall
   (a knight still jumps it). Enemy guards stand still, but any square they
   attack is deadly: end a move there and a guard strikes. A guard can be
   taken if no other guard covers its square.

   Squares are 0..63 (a1 = 0, h8 = 63). Pieces use the engine's types:
   1 pawn, 2 knight, 3 bishop, 4 rook, 5 queen, 6 king. Your side is white,
   nearest the camera; guards are black. Kept apart from the 3D so it can be
   tested. */

export const ESCAPE_EVERY = 5, ESCAPE_OFFSET = 3; // floors 3, 8, 13, ...
export const isEscapeFloor = (floor) => floor % ESCAPE_EVERY === ESCAPE_OFFSET;

const KNIGHT_STEPS = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const KING_STEPS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const ROOK_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const BISHOP_DIRS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const fileOf = (sq) => sq % 8, rankOf = (sq) => (sq / 8) | 0;
const at = (f, r) => (f >= 0 && f < 8 && r >= 0 && r < 8 ? r * 8 + f : null);

/** Squares a piece of `type` on `sq` reaches, for `white` or not, given
 *  what blocks lines (`blocked(sq)`: any piece or garbage). With `attacks`,
 *  a pawn's diagonal attacks instead of its forward step. */
function reach(type, sq, white, blocked, attacks = false) {
  const f = fileOf(sq), r = rankOf(sq), out = [];
  const steps = (list) => { for (const [df, dr] of list) { const t = at(f + df, r + dr); if (t != null) out.push(t); } };
  const slide = (dirs) => {
    for (const [df, dr] of dirs) {
      for (let k = 1; k < 8; k++) {
        const t = at(f + df * k, r + dr * k);
        if (t == null) break;
        out.push(t);
        if (blocked(t)) break;
      }
    }
  };
  if (type === 1) {
    const dir = white ? 1 : -1;
    if (attacks) steps([[1, dir], [-1, dir]]);
    else { const t = at(f, r + dir); if (t != null && !blocked(t)) out.push(t); }
  } else if (type === 2) steps(KNIGHT_STEPS);
  else if (type === 3) slide(BISHOP_DIRS);
  else if (type === 4) slide(ROOK_DIRS);
  else if (type === 5) slide([...ROOK_DIRS, ...BISHOP_DIRS]);
  else if (type === 6) steps(KING_STEPS);
  return out;
}

/** A level's starting state: { mine: Map sq->type, guards: Map sq->type,
 *  junk: Set, light, limit }. States are never changed in place. */
const occupied = (s) => (sq) => s.mine.has(sq) || s.guards.has(sq) || s.junk.has(sq);

/** Every square the guards attack. `without` leaves one guard out (it has
 *  just been taken). */
export function guarded(state, without = null) {
  const out = new Set();
  const blocked = occupied(state);
  for (const [sq, type] of state.guards) {
    if (sq === without) continue;
    for (const t of reach(type, sq, false, blocked, true)) out.add(t);
  }
  return out;
}

/** The square of a guard that attacks `sq`, or null. */
export function strikerOf(state, sq) {
  const blocked = occupied(state);
  for (const [g, type] of state.guards) {
    if (g !== sq && reach(type, g, false, blocked, true).includes(sq)) return g;
  }
  return null;
}

/** Your legal moves: [{ from, to, capture, deadly }]. Garbage and your own
 *  characters can't be landed on; a guard can. `deadly` means a guard will
 *  strike if you end there. */
export function movesOf(state) {
  const blocked = occupied(state);
  const list = [];
  for (const [from, type] of state.mine) {
    for (const to of reach(type, from, true, blocked)) {
      if (state.junk.has(to) || state.mine.has(to)) continue;
      const capture = state.guards.has(to);
      /* A pawn takes only diagonally and steps only forward. */
      if (type === 1 && capture) continue;
      list.push({ from, to, capture, deadly: guarded(state, capture ? to : null).has(to) });
    }
    if (type === 1) {
      for (const to of reach(1, from, true, blocked, true)) {
        if (state.guards.has(to)) list.push({ from, to, capture: true, deadly: guarded(state, to).has(to) });
      }
    }
  }
  return list;
}

/** The state after a move. */
export function apply(state, { from, to }) {
  const mine = new Map(state.mine);
  const type = mine.get(from);
  mine.delete(from);
  mine.set(to, type);
  const guards = new Map(state.guards);
  guards.delete(to);
  return { ...state, mine, guards };
}

export const escaped = (state) => state.mine.has(state.light);

const keyOf = (s) => [...s.mine].sort((a, b) => a[0] - b[0]).join(";") + "|" + [...s.guards.keys()].sort((a, b) => a - b).join(",");

/** Fewest safe moves to reach the light, or null if it can't be done within
 *  `cap` moves. */
export function solve(state, cap = 8) {
  if (escaped(state)) return 0;
  let frontier = [state];
  const seen = new Set([keyOf(state)]);
  for (let depth = 1; depth <= cap; depth++) {
    const next = [];
    for (const s of frontier) {
      for (const m of movesOf(s)) {
        if (m.deadly) continue;
        const after = apply(s, m);
        if (escaped(after)) return depth;
        const k = keyOf(after);
        if (!seen.has(k)) { seen.add(k); next.push(after); }
      }
    }
    if (!next.length) return null;
    frontier = next;
  }
  return null;
}

/** A small seeded random generator (mulberry32), so a level can be rebuilt
 *  from its seed. */
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** How hard an escape floor is: the fewest moves it takes, growing slowly
 *  with the floor, plus one spare move on the early ones. */
export function escapePar(floor) {
  const par = Math.min(5, 3 + Math.floor(floor / 10));
  return { par, spare: floor < 10 ? 1 : 0 };
}

/** Builds a solvable escape level for `floor`. Tries random layouts until
 *  one needs exactly the floor's par in safe moves. */
export function makeEscape(floor, random = Math.random) {
  const { par, spare } = escapePar(floor);
  const pick = (list) => list[Math.floor(random() * list.length)];
  const all = [...Array(64).keys()];
  for (let tries = 0; tries < 4000; tries++) {
    const light = at(Math.floor(random() * 8), 6 + Math.floor(random() * 2));
    const taken = new Set([light]);
    const free = () => pick(all.filter((s) => !taken.has(s)));
    const mine = new Map();
    const count = random() < 0.35 ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const sq = pick(all.filter((s) => rankOf(s) <= 1 && !taken.has(s)));
      mine.set(sq, pick([2, 3, 4, 5, 6]));
      taken.add(sq);
    }
    const junk = new Set();
    const junkCount = 6 + Math.floor(random() * 6);
    for (let i = 0; i < junkCount; i++) { const sq = free(); junk.add(sq); taken.add(sq); }
    const guards = new Map();
    const guardCount = 3 + Math.floor(random() * 3) + Math.min(2, Math.floor(floor / 10));
    for (let i = 0; i < guardCount; i++) {
      const sq = pick(all.filter((s) => !taken.has(s) && rankOf(s) >= 2));
      guards.set(sq, pick([1, 1, 2, 3, 4, 5]));
      taken.add(sq);
    }
    const state = { mine, guards, junk, light, limit: 0 };
    const danger = guarded(state);
    if (danger.has(light) || [...mine.keys()].some((sq) => danger.has(sq))) continue;
    if (solve(state, par) !== par) continue;
    return { ...state, limit: par + spare, par };
  }
  return null;
}

/** The pieces in the shape the 3D scene and the map want. */
export function piecesOf(state) {
  return [
    ...[...state.mine].map(([sq, type]) => ({ sq, type, white: true })),
    ...[...state.guards].map(([sq, type]) => ({ sq, type, white: false })),
  ];
}

/** A FEN-style board for the map (no kings needed there). */
export function fenOf(state) {
  const letters = " pnbrqk";
  let fen = "";
  for (let r = 7; r >= 0; r--) {
    let empty = 0;
    for (let f = 0; f < 8; f++) {
      const sq = r * 8 + f;
      const c = state.mine.has(sq) ? letters[state.mine.get(sq)].toUpperCase() : state.guards.has(sq) ? letters[state.guards.get(sq)] : null;
      if (!c) { empty++; continue; }
      if (empty) { fen += empty; empty = 0; }
      fen += c;
    }
    if (empty) fen += empty;
    if (r) fen += "/";
  }
  return fen + " w - - 0 1";
}

/** Seconds on the clock for an escape floor: 20, plus 8 per allowed move. */
export const escapeSeconds = (state) => 20 + 8 * state.limit;
