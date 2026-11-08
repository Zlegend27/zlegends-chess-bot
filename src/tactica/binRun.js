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

/** Phases in a floor's battle: 2 to start, one more every 2 floors, up to 5. */
export function phasesForFloor(floor) {
  return Math.min(5, 2 + Math.floor((floor - 1) / 2));
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

/** Target puzzle rating for a phase: climbs with floors and phases. */
export function ratingFor(floor, phase, effect) {
  return 600 + (floor - 1) * 70 + phase * 20 + (effect?.id === "hard" ? 200 : 0);
}

export const rushDamage = (effect) => (effect?.id === "heavy" ? HEAVY_RUSH_DAMAGE : RUSH_DAMAGE);

const sideOf = (puzzle) => (puzzle.fen.split(" ")[1] === "b" ? -1 : 1);

/** An unused puzzle near `rating`, for the given side if one is set (a
 *  floor's battle is all one colour). Widens the search if the band runs dry. */
export function pickPuzzle(puzzles, rating, used, side = null, random = Math.random) {
  for (let widen = 1; widen <= 16; widen *= 2) {
    const pool = puzzles.filter((p) => !used.has(p.id) && (side == null || sideOf(p) === side) && Math.abs(p.rating - rating) <= 100 * widen);
    if (pool.length) return pool[Math.floor(random() * pool.length)];
  }
  const any = puzzles.filter((p) => side == null || sideOf(p) === side);
  return any[Math.floor(random() * any.length)];
}

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
