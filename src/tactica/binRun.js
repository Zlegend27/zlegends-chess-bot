/* The Rogue Chess Run's rules, kept apart from the 3D so they can be tested.
   A run is forty floors across four worlds (worlds.js); each floor is a
   battle of a few puzzle phases, all played as the same colour. A world's
   first and sixth floors are story floors: the world opens, then steps up.
   Between floors, when nothing is active, the player picks one reward or
   one challenge; it lasts 3 floors or until the next story floor. */
import { worldOf, floorInWorld, isIntense, isBossFloor, worldIndex } from "./worlds.js";

export const START_HEALTH = 100;
export const WRONG_MOVE_DAMAGE = 25;
export const RUSH_DAMAGE = 50, HEAVY_RUSH_DAMAGE = 75;
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

/** Phases (puzzles) in a floor's battle. The bin's first three floors are
 *  a two-puzzle warm-up; after that each world sets a count for its first
 *  half and its second. A boss floor is one long puzzle. */
export function phasesForFloor(floor) {
  if (isBossFloor(floor)) return 1;
  if (worldIndex(floor) === 0) return floorInWorld(floor) <= 3 ? 2 : 3;
  return worldOf(floor).phases[isIntense(floor) ? 1 : 0];
}

/** The longest puzzle (in plies, both sides' moves) a floor uses: the
 *  warm-up floors keep to one or two moves of yours, the rest of the bin
 *  and the icy lake's first half to three, after that anything goes. */
export function maxPliesFor(floor) {
  if (isBossFloor(floor)) return Infinity;
  const world = worldIndex(floor);
  if (world === 0) return floorInWorld(floor) <= 3 ? 3 : 5;
  if (world === 1 && !isIntense(floor)) return 5;
  return Infinity;
}

/** The shortest puzzle a floor wants: a boss floor's one battle is long
 *  (four of your moves), when the pool has one. */
export const BOSS_MIN_PLIES = 7;
export const minPliesFor = (floor) => (isBossFloor(floor) ? BOSS_MIN_PLIES : 0);

/** A world's first floor (it opens) and sixth (it steps up). Any reward or
 *  challenge ends there. */
export function isStoryFloor(floor) {
  return floor % STORY_EVERY === 1;
}

/** What a wrong move costs on a floor, in health. */
export const wrongMoveDamage = (floor) => worldOf(floor).wrongMoveDamage;

/** How many moves the player makes in a puzzle (the solution alternates the
 *  player's moves and the opponent's replies, starting with the player). */
export function playerMoves(puzzle) {
  return Math.ceil(puzzle.moves.length / 2);
}

/** The phase timer in seconds: the floor's world sets the base and what
 *  each extra move adds (30 and 10 in the first two worlds, 25 and 8 after),
 *  adjusted by the active reward or challenge. */
export function timerSeconds(puzzle, effect, floor = 1) {
  const world = worldOf(floor);
  let s = world.baseSeconds + world.secondsPerMove * (playerMoves(puzzle) - 1);
  if (effect?.id === "time") s += 10;
  if (effect?.id === "fuse") s -= 10;
  return Math.max(10, s);
}

/* Target ratings: each world climbs evenly from its own low to its own
   high over its ten floors, so a new world is a step up, not one more
   notch (the volcano starts 150 above where the icy lake ends). A boss
   floor is 50 above its world's high (still no harder than the next world's
   first floor). Each puzzle within a floor is a
   little harder. Never above 2400, so the pool doesn't run dry. */
const RATING_CAP = 2400, BOSS_EXTRA = 50;
export function ratingFor(floor, phase, effect) {
  const [low, high] = worldOf(floor).rating;
  const base = isBossFloor(floor) ? high + BOSS_EXTRA : low + ((high - low) * (floorInWorld(floor) - 1)) / 9;
  return Math.min(RATING_CAP, Math.round(base) + phase * 15) + (effect?.id === "hard" ? 200 : 0);
}

/* How many puzzle ids the run remembers across runs, so new runs show new
   puzzles first. */
export const SEEN_MEMORY = 400;

export const rushDamage = (effect) => (effect?.id === "heavy" ? HEAVY_RUSH_DAMAGE : RUSH_DAMAGE);

/* A puzzle from the big pool is light until it's chosen (puzzlePool.js): it
   carries its side and length itself. A full one has a position and moves. */
const sideOf = (puzzle) => puzzle.side ?? (puzzle.fen.split(" ")[1] === "b" ? -1 : 1);
const pliesOf = (puzzle) => puzzle.plies ?? puzzle.moves.length;

/** A puzzle near `rating`, for the given side if one is set (a floor's
 *  battle is all one colour), no longer than `maxPlies` and, if the pool
 *  allows, no shorter than `minPlies`. Never one already
 *  used this run (`used`). Among the rest it prefers one you haven't seen
 *  in recent runs (`seen`, oldest first); if every candidate has been seen,
 *  the one seen longest ago. Widens the rating band, then drops the length
 *  limit, if the pool runs dry. */
export function pickPuzzle(puzzles, rating, used, side = null, random = Math.random, { seen = [], maxPlies = Infinity, minPlies = 0 } = {}) {
  const seenAt = new Map(seen.map((id, i) => [id, i]));
  const choose = (pool) => {
    const fresh = pool.filter((p) => !seenAt.has(p.id));
    if (fresh.length) return fresh[Math.floor(random() * fresh.length)];
    return pool.reduce((a, b) => (seenAt.get(b.id) < seenAt.get(a.id) ? b : a));
  };
  /* A long puzzle is worth looking a little further in rating for, but not
     at any rating: after two widenings the length asked for comes down. */
  for (const least of minPlies > 0 ? [minPlies, minPlies - 2, 0] : [0]) {
    for (const limit of maxPlies === Infinity ? [Infinity] : [maxPlies, Infinity]) {
      for (let widen = 1.5; widen <= (least > 0 ? 3 : 16); widen *= 2) {
        const pool = puzzles.filter((p) => !used.has(p.id) && (side == null || sideOf(p) === side)
          && pliesOf(p) <= limit && pliesOf(p) >= least && Math.abs(p.rating - rating) <= 100 * widen);
        if (pool.length) return choose(pool);
      }
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

/** Bonus Escape floors come after clearing a world's third and eighth
 *  floors (3, 8, 13, 18...). They don't count as floors. */
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

/** Two rewards and two challenges to choose from. In hard mode there are
 *  no rewards: one of the challenges has to be taken. */
export function offer(random = Math.random, hard = false) {
  const pick = (list) => [...list].sort(() => random() - 0.5).slice(0, 2);
  return { rewards: hard ? [] : pick(REWARDS), challenges: pick(CHALLENGES) };
}

/** How much harder every puzzle is in hard mode, in rating points. */
export const HARD_MODE_RATING = 200;

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
