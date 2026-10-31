import { describe, test, expect } from "vitest";
import { nextStreak, currentStreak, utcDay } from "./dailyStreak";

describe("daily puzzle streak", () => {
  test("starts at one", () => {
    expect(nextStreak(undefined, 100)).toEqual({ day: 100, count: 1 });
  });

  test("grows on the next day", () => {
    expect(nextStreak({ day: 99, count: 4 }, 100)).toEqual({ day: 100, count: 5 });
  });

  test("solving again the same day doesn't count twice", () => {
    expect(nextStreak({ day: 100, count: 4 }, 100)).toEqual({ day: 100, count: 4 });
  });

  test("a missed day starts over", () => {
    expect(nextStreak({ day: 97, count: 9 }, 100)).toEqual({ day: 100, count: 1 });
  });

  test("still shows today if yesterday was solved, and not after a miss", () => {
    expect(currentStreak({ day: 99, count: 4 }, 100)).toBe(4);
    expect(currentStreak({ day: 98, count: 4 }, 100)).toBe(0);
    expect(currentStreak(undefined, 100)).toBe(0);
  });

  test("days roll over at UTC midnight", () => {
    expect(utcDay(new Date("2026-11-01T00:00:00Z"))).toBe(utcDay(new Date("2026-10-31T23:59:59Z")) + 1);
  });
});
