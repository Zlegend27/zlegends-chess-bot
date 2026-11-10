/* The Opening Camp's logic: the main Opening Trainer's move trees and ideas
   (src/utils/openingTrainer.js), sized for a child.

   The trees count what Lichess players in three rating bands chose. The
   camp's three opponents blend those bands: Bunny plays like the lowest
   (about 800 on Chess.com), Cat half and half, Dog like the middle band
   (about 1300). The course's own moves don't change with the opponent.

   Progress is kept on the tablet (localStorage), apart from the shop save:
   { courses: { [id]: { story, copycat: stars 0-3, whatIf: [scenario keys],
   practice: { bunny, cat, dog } } }, reviews: { [reviewId]: { box, due } } } */
import viennaTree from "./openings/kid-vienna.json";
import e5Tree from "./openings/kid-e5.json";
import { nodeAt, playerNode, keyOf, recordReview, dueReviews, reviewId, parseReviewId, dayOf } from "../src/utils/openingTrainer";

export { nodeAt, playerNode, keyOf, parseReviewId };

export const CAMP_TREES = { "kid-vienna": viennaTree.lines.main, "kid-e5": e5Tree.lines.main };

export const CAMP_OPPONENTS = [
  { id: "bunny", label: "Bunny", stars: 1, weights: [1, 0, 0] },
  { id: "cat", label: "Cat", stars: 2, weights: [0.5, 0.5, 0] },
  { id: "dog", label: "Dog", stars: 3, weights: [0, 1, 0] },
];
/* Copycat and What If? teach what the middle opponent meets most. */
export const TEACH_WEIGHTS = CAMP_OPPONENTS[1].weights;
/* Replies at least this common get a What If? card (mistakes always do). */
const WHATIF_SHARE = 0.1;
const MAX_WHATIF = 7;

/** How often each opponent reply is played, blended over the bands by
 *  `weights`, most common first: [{ san, share, mistake }]. */
export function kidShares(node, weights) {
  if (!node?.o) return [];
  const entries = Object.entries(node.o.r);
  const totals = weights.map((_, b) => entries.reduce((s, [, c]) => s + (c[b] ?? 0), 0) || 1);
  return entries
    .map(([san, c]) => ({ san, share: weights.reduce((s, w, b) => s + w * (c[b] ?? 0) / totals[b], 0), mistake: !!node.o.punish?.[san] }))
    .filter((r) => r.share > 0)
    .sort((a, b) => b.share - a.share);
}

export function kidPick(node, weights, rng = Math.random) {
  const shares = kidShares(node, weights);
  if (!shares.length) return null;
  let roll = rng() * shares.reduce((s, r) => s + r.share, 0);
  for (const r of shares) {
    roll -= r.share;
    if (roll <= 0) return r.san;
  }
  return shares[shares.length - 1].san;
}

/** The course's line: its own moves, and the most common reply. */
export function kidMainLine(nodes, root, weights = TEACH_WEIGHTS) {
  const moves = [...root];
  for (let i = 0; i < 40; i++) {
    const node = nodeAt(nodes, moves);
    if (!node) break;
    const next = node.p ? node.p.rep : kidShares(node, weights)[0]?.san;
    if (!next) break;
    moves.push(next);
  }
  return moves;
}

/** The What If? cards: along the line, the other common replies and every
 *  mistake, each with her answer: [{ key, at, reply, share, mistake, punish, answer }]. */
export function kidScenarios(nodes, root, weights = TEACH_WEIGHTS) {
  const line = kidMainLine(nodes, root, weights);
  const out = [];
  for (let i = root.length; i < line.length; i++) {
    const at = line.slice(0, i);
    const node = nodeAt(nodes, at);
    if (!node?.o) continue;
    for (const r of kidShares(node, weights)) {
      if (r.san === line[i] || (r.share < WHATIF_SHARE && !r.mistake)) continue;
      const answer = playerNode(nodes, [...at, r.san])?.p?.rep;
      if (!answer) continue;
      out.push({ key: keyOf([...at, r.san]), at, reply: r.san, share: r.share, mistake: r.mistake, punish: node.o.punish?.[r.san] ?? null, answer });
    }
  }
  /* Traps first (they're the fun ones), then the most common. */
  return out.sort((a, b) => Number(b.mistake) - Number(a.mistake) || b.share - a.share).slice(0, MAX_WHATIF);
}

/** "4 in 10 kids" for a share. */
export const inTen = (share) => Math.max(1, Math.round(share * 10));

/* ---------------- Progress ---------------- */
const KEY = "kinnda-camp-v1";
export const emptyCamp = () => ({ courses: {}, reviews: {} });
export function loadCamp() {
  try { return { ...emptyCamp(), ...(JSON.parse(localStorage.getItem(KEY)) ?? {}) }; } catch { return emptyCamp(); }
}
export function saveCamp(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage unavailable */ }
  return state;
}
export const courseState = (state, id) => ({ story: false, copycat: 0, whatIf: [], practice: {}, ...(state.courses[id] ?? {}) });
export function updateCourse(state, id, fn) {
  return { ...state, courses: { ...state.courses, [id]: { ...courseState(state, id), ...fn(courseState(state, id)) } } };
}

/** A move she missed comes back in the Memory Game; getting a remembered
 *  move right sends it further away. A move she gets right that was never
 *  missed isn't added: the Memory Game is only for the ones she needs. */
export function rememberMove(state, courseId, before, correct, today = dayOf()) {
  const id = reviewId(courseId, "main", before);
  if (correct && !state.reviews[id]) return state;
  return { ...state, reviews: recordReview(state.reviews, id, correct, today) };
}
export const dueMoves = (state, today = dayOf()) => dueReviews(state.reviews, today);

/** Stars for a course on the Adventure map: 1 once Story and Copycat are
 *  done, 2 once every What If? card is answered, 3 after a clean Practice
 *  Match against Cat or Dog. */
export function courseStars(state, id, whatIfCount) {
  const c = courseState(state, id);
  if (!c.story || !c.copycat) return 0;
  if (c.whatIf.length < whatIfCount) return 1;
  return c.practice.cat || c.practice.dog ? 3 : 2;
}
