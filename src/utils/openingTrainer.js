/* The Opening Trainer's logic, apart from any screen so it can be tested.

   A course line's data (src/data/openings/<course>.json, built by
   scripts/openings/build.mjs) maps positions, written as the moves that led
   to them ("e4 e5 Nc3"), to one of:
     { p: { rep, ok: [...], ev } }   the player's turn: the course move, other
                                     sound moves, Stockfish scores
     { o: { r: { san: [easy, medium, hard] }, punish: { san: [pv...] } } }
                                     the opponent's turn: how often players
                                     at each level chose each reply, and the
                                     replies that are mistakes with the line
                                     that punishes them
   A position missing from the data is where the opening ends. */

export const keyOf = (moves) => moves.join(" ");
export const LEVEL_INDEX = { easy: 0, medium: 1, hard: 2 };

/** The data for the position after `moves`, or null where the opening ends. */
export const nodeAt = (nodes, moves) => nodes[keyOf(moves)] ?? null;

/** The player's node after `moves`: the course's own, or, right after an
 *  opponent mistake the tree doesn't continue from, one made from the line
 *  that punishes it (its first move is the answer). `punishOnly` marks the
 *  second kind: it has no scores, and the opening ends after the answer. */
export function playerNode(nodes, moves) {
  const node = nodeAt(nodes, moves);
  if (node?.p) return node;
  if (node || !moves.length) return null;
  const pv = nodeAt(nodes, moves.slice(0, -1))?.o?.punish?.[moves[moves.length - 1]];
  return pv?.length ? { p: { rep: pv[0], ok: [], ev: {} }, punishOnly: true } : null;
}

/** Share of a level's games choosing each opponent reply, most common first:
 *  [{ san, share, mistake }]. */
export function replyShares(node, level = 1) {
  if (!node?.o) return [];
  const entries = Object.entries(node.o.r);
  const total = entries.reduce((s, [, c]) => s + c[level], 0) || 1;
  return entries.map(([san, c]) => ({ san, share: c[level] / total, mistake: !!node.o.punish?.[san] }))
    .filter((r) => r.share > 0)
    .sort((a, b) => b.share - a.share);
}

/** The opponent's reply at `level`, chosen the way real players at that
 *  level choose (weighted by how often they play each move). `rng` is
 *  injectable for tests. */
export function pickReply(node, level = 1, rng = Math.random) {
  const shares = replyShares(node, level);
  if (!shares.length) return null;
  let roll = rng();
  for (const r of shares) {
    roll -= r.share;
    if (roll <= 0) return r.san;
  }
  return shares[shares.length - 1].san;
}

/** How a player's move compares with the course: "book" (the course move),
 *  "good" (another sound move real players use), or "off" (not in the
 *  course; the screen asks Stockfish how bad it is). */
export function judgeMove(node, san) {
  if (!node?.p) return "off";
  if (san === node.p.rep) return "book";
  if (node.p.ok?.includes(san)) return "good";
  return "off";
}

/** The course's main line from `start` (the root moves): the course move on
 *  the player's turns and the most common reply at `level` on the
 *  opponent's, until the opening ends. */
export function mainLine(nodes, start, level = 1, maxPlies = 40) {
  const moves = [...start];
  for (let i = 0; i < maxPlies; i++) {
    const node = nodeAt(nodes, moves);
    if (!node) break;
    if (node.p) moves.push(node.p.rep);
    else {
      const top = replyShares(node, level)[0];
      if (!top) break;
      moves.push(top.san);
    }
  }
  return moves;
}

/** The scenarios worth teaching: at each opponent decision along the main
 *  line, every reply other than the main one that at least `minShare` of
 *  the level's players choose, plus every reply that is a mistake. Each is
 *  { at: moves before it, reply, share, mistake, punish }. Ordered by how
 *  often players meet them. */
export function scenarios(nodes, start, level = 1, minShare = 0.12) {
  const line = mainLine(nodes, start, level);
  const out = [];
  for (let i = start.length; i < line.length; i++) {
    const before = line.slice(0, i);
    const node = nodeAt(nodes, before);
    if (!node?.o) continue;
    for (const r of replyShares(node, level)) {
      if (r.san === line[i]) continue;
      if (r.share < minShare && !r.mistake) continue;
      /* Only ones with a known answer. */
      if (!playerNode(nodes, [...before, r.san])) continue;
      out.push({ at: before, reply: r.san, share: r.share, mistake: r.mistake, punish: node.o.punish?.[r.san] ?? null });
    }
  }
  /* Common ones first; reach matters, so earlier decisions count more. */
  return out.sort((a, b) => b.share / (a.at.length + 1) - a.share / (b.at.length + 1));
}

/** The player's moves in a line (the ones a quiz asks for): indexes into
 *  `moves` where the player is to move and the course has a move. */
export function playerTurns(nodes, moves, start) {
  const out = [];
  for (let i = start.length; i < moves.length; i++) {
    if (nodeAt(nodes, moves.slice(0, i))?.p) out.push(i);
  }
  return out;
}

/* ---------------- Review (spaced repetition) ----------------
   A move you miss goes into box 1 and comes back the next day; each time
   you get it right it moves up a box and waits longer; a miss sends it back
   to box 1. `items` is { [id]: { box, due } } with `due` a day number. */
export const BOX_DAYS = [1, 1, 3, 7, 16, 35];
export const dayOf = (ms = Date.now()) => Math.floor(ms / 86400000);

export function recordReview(items, id, correct, today = dayOf()) {
  const now = items[id] ?? { box: 0, due: today };
  const box = correct ? Math.min(BOX_DAYS.length - 1, now.box + 1) : 1;
  return { ...items, [id]: { box, due: today + BOX_DAYS[box] } };
}

export const dueReviews = (items, today = dayOf()) =>
  Object.entries(items).filter(([, v]) => v.due <= today).map(([id]) => id);

/** A review item's id: course, line, and the position (moves) where the
 *  player has to find the move. */
export const reviewId = (courseId, lineId, moves) => `${courseId}|${lineId}|${keyOf(moves)}`;
export function parseReviewId(id) {
  const [course, line, key] = id.split("|");
  return { course, line, moves: key ? key.split(" ") : [] };
}
