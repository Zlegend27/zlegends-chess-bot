/* The Bin Run's rules, kept apart from the 3D so they can be tested.
   A run is endless floors; each floor is a battle of a few puzzle phases,
   all played as the same colour. Every 5th floor is a story floor. Between
   floors, when nothing is active, the player picks one reward or one
   challenge; it lasts 3 floors or until the next story floor. */

export const START_HEALTH = 100;
export const WRONG_MOVE_DAMAGE = 25;
export const RUSH_DAMAGE = 50, HEAVY_RUSH_DAMAGE = 75;
export const BASE_SECONDS = 30, SECONDS_PER_EXTRA_MOVE = 10;
export const EFFECT_FLOORS = 3;
export const CURSE_CHANCE = 1 / 20;
export const STORY_EVERY = 5;

export const REWARDS = [
  { id: "time", name: "+10 seconds", text: "Every timer gets 10 more seconds." },
  { id: "heal", name: "Heal 25%", text: "Get a quarter of your health back now." },
  { id: "shield", name: "Shield", text: "Blocks the next enemy rush completely." },
];
export const CHALLENGES = [
  { id: "fuse", name: "Short fuse", text: "Every timer is 10 seconds shorter." },
  { id: "nomap", name: "No map", text: "Phases start up close and the map is locked." },
  { id: "hard", name: "Harder puzzles", text: "Puzzles are about 200 rating points harder." },
  { id: "heavy", name: "Heavy rush", text: "Enemy rushes deal 75% instead of 50%." },
];

/** Phases (puzzles) in a floor's battle: floors 1 to 3 are a two-puzzle
 *  warm-up, then 3 puzzles on floors 4 to 6, 4 on floors 7 to 10, and 5
 *  from floor 11. */
export function phasesForFloor(floor) {
  if (floor <= 3) return 2;
  if (floor <= 6) return 3;
  if (floor <= 10) return 4;
  return 5;
}

/** The longest puzzle (in plies, both sides' moves) a floor uses: the
 *  warm-up floors keep to one or two moves of yours, the middle floors to
 *  three, after that anything goes. */
export function maxPliesFor(floor) {
  if (floor <= 3) return 3;
  if (floor <= 10) return 5;
  return Infinity;
}

export function isStoryFloor(floor) {
  return floor % STORY_EVERY === 0;
}

/** How many moves the player makes in a puzzle (the solution alternates the
 *  player's moves and the opponent's replies, starting with the player). */
export function playerMoves(puzzle) {
  return Math.ceil(puzzle.moves.length / 2);
}

/** The phase timer in seconds: 30, plus 10 per extra move, adjusted by the
 *  active reward or challenge. */
export function timerSeconds(puzzle, effect) {
  let s = BASE_SECONDS + SECONDS_PER_EXTRA_MOVE * (playerMoves(puzzle) - 1);
  if (effect?.id === "time") s += 10;
  if (effect?.id === "fuse") s -= 10;
  return Math.max(10, s);
}

/* Target ratings: the warm-up starts at 550 and climbs 70 a floor; floors 4
   to 15 climb 65 a floor (about 1470 by floor 15), then 45 a floor, never
   above 2300 (about the 90th percentile of the puzzle set, so the pool
   doesn't run dry). Each puzzle within a floor is a little harder. */
const RATING_START = 550, RATING_CAP = 2300;
export function ratingFor(floor, phase, effect) {
  const f = Math.max(1, floor);
  let base = RATING_START + Math.min(f - 1, 2) * 70;
  if (f > 3) base += Math.min(f - 3, 12) * 65;
  if (f > 15) base += (f - 15) * 45;
  return Math.min(RATING_CAP, base + phase * 15) + (effect?.id === "hard" ? 200 : 0);
}

/* How many puzzle ids the run remembers across runs, so new runs show new
   puzzles first. */
export const SEEN_MEMORY = 400;

export const rushDamage = (effect) => (effect?.id === "heavy" ? HEAVY_RUSH_DAMAGE : RUSH_DAMAGE);

const sideOf = (puzzle) => (puzzle.fen.split(" ")[1] === "b" ? -1 : 1);

/** A puzzle near `rating`, for the given side if one is set (a floor's
 *  battle is all one colour), no longer than `maxPlies`. Never one already
 *  used this run (`used`). Among the rest it prefers one you haven't seen
 *  in recent runs (`seen`, oldest first); if every candidate has been seen,
 *  the one seen longest ago. Widens the rating band, then drops the length
 *  limit, if the pool runs dry. */
export function pickPuzzle(puzzles, rating, used, side = null, random = Math.random, { seen = [], maxPlies = Infinity } = {}) {
  const seenAt = new Map(seen.map((id, i) => [id, i]));
  const choose = (pool) => {
    const fresh = pool.filter((p) => !seenAt.has(p.id));
    if (fresh.length) return fresh[Math.floor(random() * fresh.length)];
    return pool.reduce((a, b) => (seenAt.get(b.id) < seenAt.get(a.id) ? b : a));
  };
  for (const limit of maxPlies === Infinity ? [Infinity] : [maxPlies, Infinity]) {
    for (let widen = 1.5; widen <= 16; widen *= 2) {
      const pool = puzzles.filter((p) => !used.has(p.id) && (side == null || sideOf(p) === side)
        && p.moves.length <= limit && Math.abs(p.rating - rating) <= 100 * widen);
      if (pool.length) return choose(pool);
    }
  }
  const any = puzzles.filter((p) => side == null || sideOf(p) === side);
  return any[Math.floor(random() * any.length)];
}

/** The run's memory of seen puzzles with `ids` added, newest last, trimmed
 *  to SEEN_MEMORY. */
export function rememberSeen(seen, ids) {
  const next = [...seen.filter((id) => !ids.includes(id)), ...ids];
  return next.slice(Math.max(0, next.length - SEEN_MEMORY));
}

/** Bonus Escape floors come after clearing floors 3, 8, 13... (between 3
 *  and 4, 8 and 9...). They don't count as floors. */
export const isBonusAfter = (floor) => floor % STORY_EVERY === 3;

/** How many floors an effect picked after `floor` lasts: 3, or fewer if a
 *  story floor comes first (it ends there). */
export function effectFloors(floor) {
  let n = 0;
  for (let f = floor + 1; f <= floor + EFFECT_FLOORS; f++) {
    if (isStoryFloor(f)) break;
    n++;
  }
  return n;
}

/** Two rewards and two challenges to choose from. */
export function offer(random = Math.random) {
  const pick = (list) => [...list].sort(() => random() - 0.5).slice(0, 2);
  return { rewards: pick(REWARDS), challenges: pick(CHALLENGES) };
}

/** Applies the player's pick. A reward has a 1 in 20 chance of being cursed:
 *  it melts away and a random challenge (not chosen, so no double score)
 *  takes its place. Returns { effect, cursed, heal }. */
export function choose(option, kind, floor, random = Math.random) {
  const floors = effectFloors(floor);
  if (kind === "reward" && random() < CURSE_CHANCE) {
    const challenge = CHALLENGES[Math.floor(random() * CHALLENGES.length)];
    return { effect: { ...challenge, kind: "challenge", chosen: false, floorsLeft: floors }, cursed: true, lost: option, heal: 0 };
  }
  return {
    effect: { ...option, kind, chosen: kind === "challenge", floorsLeft: floors, shieldUsed: false },
    cursed: false,
    heal: option.id === "heal" ? 25 : 0,
  };
}

/** Score for clearing a floor: 1, or 2 under a challenge taken on purpose. */
export function floorScore(effect) {
  return effect?.kind === "challenge" && effect.chosen ? 2 : 1;
}
