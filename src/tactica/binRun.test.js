import { describe, test, expect } from "vitest";
import {
  phasesForFloor, isStoryFloor, timerSeconds, ratingFor, rushDamage, pickPuzzle,
  effectFloors, offer, choose, floorScore, REWARDS, CHALLENGES, maxPliesFor, rememberSeen, isBonusAfter, SEEN_MEMORY,
} from "./binRun";

const puzzle = (moves, fen = "8/8/8/8/8/8/8/8 w - - 0 1", id = "x", rating = 800) => ({ id, rating, fen, moves: Array(moves).fill("e4") });

describe("the Bin Run", () => {
  test("floors 1-3 are a 2-puzzle warm-up, then 3, 4 and 5 puzzles", () => {
    expect([1, 2, 3, 4, 6, 7, 10, 11, 30].map(phasesForFloor)).toEqual([2, 2, 2, 3, 3, 4, 4, 5, 5]);
  });

  test("puzzles stay short early on", () => {
    expect([1, 3, 4, 10, 11].map(maxPliesFor)).toEqual([3, 3, 5, 5, Infinity]);
  });

  test("difficulty climbs every floor, steadily, and is capped", () => {
    const r = Array.from({ length: 40 }, (_, i) => ratingFor(i + 1, 0));
    expect(r[0]).toBe(550);
    for (let i = 1; i < r.length; i++) expect(r[i]).toBeGreaterThanOrEqual(r[i - 1]);
    expect(r[14]).toBe(1470);
    expect(Math.max(...r)).toBeLessThanOrEqual(2300);
    expect(ratingFor(5, 2)).toBeGreaterThan(ratingFor(5, 0));
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

  test("bonus escapes follow floors 3, 8, 13", () => {
    expect([2, 3, 4, 8, 13, 5].map(isBonusAfter)).toEqual([false, true, false, true, true, false]);
  });

  test("every 5th floor is a story floor", () => {
    expect([4, 5, 9, 10].map(isStoryFloor)).toEqual([false, true, false, true]);
  });

  test("the timer is 30 seconds plus 10 per extra player move", () => {
    expect(timerSeconds(puzzle(1))).toBe(30);
    expect(timerSeconds(puzzle(3))).toBe(40);
    expect(timerSeconds(puzzle(5))).toBe(50);
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
    expect(effectFloors(3)).toBe(1); // floor 4, then 5 is a story floor
    expect(effectFloors(4)).toBe(0); // floor 5 is a story floor
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
