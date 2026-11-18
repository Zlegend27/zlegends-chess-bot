import { describe, test, expect } from "vitest";
import {
  phasesForFloor, isStoryFloor, timerSeconds, ratingFor, rushDamage, pickPuzzle,
  effectFloors, offer, choose, floorScore, REWARDS, CHALLENGES, maxPliesFor, rememberSeen, isBonusAfter, SEEN_MEMORY,
  minPliesFor, wrongMoveDamage, BOSS_MIN_PLIES, HARD_MODE_RATING,
} from "./binRun";
import { WORLDS, LAST_FLOOR, worldIndex, floorInWorld, firstFloorOf, isBossFloor, isIntensify, isSnowFloor, isWorldStart } from "./worlds";

const puzzle = (moves, fen = "8/8/8/8/8/8/8/8 w - - 0 1", id = "x", rating = 800) => ({ id, rating, fen, moves: Array(moves).fill("e4") });

describe("the worlds", () => {
  test("four worlds of ten floors, forty in all", () => {
    expect(WORLDS.map((w) => w.id)).toEqual(["bin", "ice", "volcano", "demon"]);
    expect(LAST_FLOOR).toBe(40);
    expect([1, 10, 11, 20, 21, 30, 31, 40, 41].map(worldIndex)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 3]);
    expect([1, 10, 11, 25, 40].map(floorInWorld)).toEqual([1, 10, 1, 5, 10]);
    expect([0, 1, 2, 3].map(firstFloorOf)).toEqual([1, 11, 21, 31]);
  });

  test("each world opens on its first floor and steps up on its sixth", () => {
    expect([1, 11, 21, 31].every(isWorldStart)).toBe(true);
    expect([6, 16, 26, 36].every(isIntensify)).toBe(true);
    expect([5, 7, 10].some(isIntensify)).toBe(false);
  });

  test("every world ends on a boss floor", () => {
    expect([10, 20, 30, 40].map(isBossFloor)).toEqual([true, true, true, true]);
    expect(WORLDS.map((w) => w.boss)).toEqual(["The pizza monster", "The polar bear", "The fire dragon", "The demon"]);
    expect([19, 21, 35].some(isBossFloor)).toBe(false);
  });

  test("the bin's last two floors are under snow", () => {
    expect([8, 9, 10, 11, 19].map(isSnowFloor)).toEqual([false, true, true, false, false]);
  });
});

describe("the Rogue Chess Run", () => {
  test("the bin warms up on 2 puzzles, then each world sets its own count; a boss floor is one battle", () => {
    expect([1, 3, 4, 9, 10, 11, 15, 16, 19, 20, 21, 29, 30, 31, 36, 40].map(phasesForFloor))
      .toEqual([2, 2, 3, 3, 1, 3, 3, 4, 4, 1, 4, 4, 1, 4, 5, 1]);
  });

  test("puzzles stay short early on, and a boss floor asks for a long one", () => {
    expect([1, 3, 4, 9, 10, 11, 15, 16, 21].map(maxPliesFor)).toEqual([3, 3, 5, 5, Infinity, 5, 5, Infinity, Infinity]);
    expect([9, 10, 19, 20, 30, 40].map(minPliesFor)).toEqual([0, BOSS_MIN_PLIES, 0, BOSS_MIN_PLIES, BOSS_MIN_PLIES, BOSS_MIN_PLIES]);
  });

  test("difficulty never drops, each world starts above the last, and it is capped", () => {
    const r = Array.from({ length: 40 }, (_, i) => ratingFor(i + 1, 0));
    expect(r[0]).toBe(550);
    for (let i = 1; i < r.length; i++) expect(r[i]).toBeGreaterThanOrEqual(r[i - 1]);
    expect([r[8], r[9], r[10], r[20], r[30]]).toEqual([861, 950, 950, 1500, 1950]);
    /* The volcano is a real step: 150 above the icy lake's hardest normal floor. */
    expect(r[20] - r[18]).toBeGreaterThanOrEqual(150);
    expect(Math.max(...r)).toBeLessThanOrEqual(2400);
    expect(ratingFor(5, 2)).toBeGreaterThan(ratingFor(5, 0));
  });

  test("a boss floor is harder than anything else in its world", () => {
    expect(ratingFor(10, 0)).toBe(950);
    expect(ratingFor(20, 0)).toBe(1400);
    expect(ratingFor(30, 0)).toBe(1950);
    expect(ratingFor(40, 0)).toBe(2350);
  });

  test("a wrong move costs more from the volcano on", () => {
    expect([1, 15, 21, 40].map(wrongMoveDamage)).toEqual([25, 25, 34, 34]);
  });

  test("a long puzzle is preferred on a boss floor, and a shorter one is taken if there's none", () => {
    const pool = [puzzle(1, undefined, "short"), puzzle(7, undefined, "long")];
    for (let i = 0; i < 10; i++) expect(pickPuzzle(pool, 800, new Set(), null, Math.random, { minPlies: 7 }).id).toBe("long");
    expect(pickPuzzle([pool[0]], 800, new Set(), null, Math.random, { minPlies: 7 }).id).toBe("short");
  });

  test("light puzzles from the big pool are chosen by their own side and length", () => {
    const light = (id, side, plies) => ({ id, rating: 800, side, plies });
    const pool = [light("w-short", 1, 1), light("b-short", -1, 1), light("b-long", -1, 7)];
    for (let i = 0; i < 10; i++) {
      expect(pickPuzzle(pool, 800, new Set(), 1).id).toBe("w-short");
      expect(pickPuzzle(pool, 800, new Set(), -1, Math.random, { minPlies: 7 }).id).toBe("b-long");
      expect(pickPuzzle(pool, 800, new Set(), -1, Math.random, { maxPlies: 3 }).id).toBe("b-short");
    }
  });

  test("new puzzles come before ones seen in earlier runs", () => {
    const pool = [puzzle(1, undefined, "a"), puzzle(1, undefined, "b"), puzzle(1, undefined, "c")];
    for (let i = 0; i < 10; i++) expect(pickPuzzle(pool, 800, new Set(), null, Math.random, { seen: ["a", "b"] }).id).toBe("c");
    /* All seen: the one seen longest ago. */
    expect(pickPuzzle(pool, 800, new Set(), null, Math.random, { seen: ["b", "c", "a"] }).id).toBe("b");
  });

  test("a length limit is kept while possible", () => {
    const pool = [puzzle(5, undefined, "long"), puzzle(1, undefined, "short")];
    expect(pickPuzzle(pool, 800, new Set(), null, Math.random, { maxPlies: 3 }).id).toBe("short");
    expect(pickPuzzle([pool[0]], 800, new Set(), null, Math.random, { maxPlies: 3 }).id).toBe("long");
  });

  test("the seen memory keeps the newest ids, once each", () => {
    expect(rememberSeen(["a", "b"], ["a", "c"])).toEqual(["b", "a", "c"]);
    const many = rememberSeen([], Array.from({ length: SEEN_MEMORY + 5 }, (_, i) => String(i)));
    expect(many).toHaveLength(SEEN_MEMORY);
    expect(many.at(-1)).toBe(String(SEEN_MEMORY + 4));
  });

  test("bonus escapes follow a world's third and eighth floors", () => {
    expect([2, 3, 4, 8, 13, 5].map(isBonusAfter)).toEqual([false, true, false, true, true, false]);
  });

  test("a world's first and sixth floors are story floors", () => {
    expect([1, 5, 6, 10, 11, 16, 20].map(isStoryFloor)).toEqual([true, false, true, false, true, true, false]);
  });

  test("the timer is 30 seconds plus 10 per extra player move, and tighter from the volcano on", () => {
    expect(timerSeconds(puzzle(1))).toBe(30);
    expect(timerSeconds(puzzle(3))).toBe(40);
    expect(timerSeconds(puzzle(5))).toBe(50);
    expect(timerSeconds(puzzle(1), null, 21)).toBe(25);
    expect(timerSeconds(puzzle(5), null, 35)).toBe(41);
  });

  test("the +10 reward and the short fuse change the timer", () => {
    expect(timerSeconds(puzzle(3), { id: "time" })).toBe(50);
    expect(timerSeconds(puzzle(3), { id: "fuse" })).toBe(30);
  });

  test("puzzles get harder by floor, and much harder under the challenge", () => {
    expect(ratingFor(2, 0)).toBeGreaterThan(ratingFor(1, 0));
    expect(ratingFor(30, 4, { id: "hard" }) - ratingFor(30, 4)).toBe(200);
    expect(ratingFor(1, 0, { id: "hard" }) - ratingFor(1, 0)).toBe(200);
  });

  test("a heavy rush deals 75%, a normal one 50%", () => {
    expect(rushDamage()).toBe(50);
    expect(rushDamage({ id: "heavy" })).toBe(75);
  });

  test("a floor's puzzles all share the first puzzle's colour", () => {
    const pool = [puzzle(1, "8/8/8/8/8/8/8/8 w - - 0 1", "w1"), puzzle(1, "8/8/8/8/8/8/8/8 b - - 0 1", "b1"), puzzle(1, "8/8/8/8/8/8/8/8 b - - 0 1", "b2")];
    for (let i = 0; i < 20; i++) expect(pickPuzzle(pool, 800, new Set(), -1).fen.split(" ")[1]).toBe("b");
    expect(pickPuzzle(pool, 800, new Set(["b1"]), -1).id).toBe("b2");
  });

  test("effects last 3 floors, or end at the next story floor", () => {
    expect(effectFloors(1)).toBe(3); // floors 2, 3, 4
    expect(effectFloors(3)).toBe(2); // floors 4 and 5, then 6 is a story floor
    expect(effectFloors(5)).toBe(0); // floor 6 is a story floor
    expect(effectFloors(10)).toBe(0); // floor 11 opens the next world
  });

  test("hard mode offers no rewards, only challenges, and is 200 points harder", () => {
    const o = offer(Math.random, true);
    expect(o.rewards).toEqual([]);
    expect(o.challenges).toHaveLength(2);
    expect(HARD_MODE_RATING).toBe(200);
  });

  test("the offer is two rewards and two challenges", () => {
    const o = offer();
    expect(o.rewards).toHaveLength(2);
    expect(o.challenges).toHaveLength(2);
    for (const r of o.rewards) expect(REWARDS).toContain(r);
    for (const c of o.challenges) expect(CHALLENGES).toContain(c);
  });

  test("a reward can be cursed into a challenge that doesn't double the score", () => {
    const cursed = choose(REWARDS[0], "reward", 1, () => 0);
    expect(cursed.cursed).toBe(true);
    expect(cursed.effect.kind).toBe("challenge");
    expect(floorScore(cursed.effect)).toBe(1);
  });

  test("an uncursed heal heals 25%; a chosen challenge doubles the score", () => {
    const heal = choose(REWARDS.find((r) => r.id === "heal"), "reward", 1, () => 0.9);
    expect(heal.cursed).toBe(false);
    expect(heal.heal).toBe(25);
    const fuse = choose(CHALLENGES[0], "challenge", 1, () => 0.9);
    expect(floorScore(fuse.effect)).toBe(2);
    expect(floorScore(null)).toBe(1);
  });
});
