import { describe, test, expect } from "vitest";
import { bumpStreak, liveStreak } from "./blindTrainerStore";
import { mergeTraining } from "./blindTrainerSync";
import { loneFen } from "../components/BlindTrainerPage";
import { emptyPath } from "./blindPath";

describe("practice streak", () => {
  test("counts days in a row, resets after a missed day", () => {
    let s = { last: null, count: 0 };
    s = bumpStreak(s, "2026-11-24"); expect(s.count).toBe(1);
    s = bumpStreak(s, "2026-11-24"); expect(s.count).toBe(1);
    s = bumpStreak(s, "2026-11-25"); expect(s.count).toBe(2);
    expect(liveStreak(s, "2026-11-26")).toBe(2);
    expect(liveStreak(s, "2026-11-27")).toBe(0);
    s = bumpStreak(s, "2026-11-28"); expect(s.count).toBe(1);
  });
  test("across a month end", () => {
    expect(bumpStreak({ last: "2026-11-30", count: 4 }, "2026-12-01").count).toBe(5);
  });
});

describe("merging device and account progress", () => {
  test("keeps each stage's further record and the latest streak", () => {
    const device = { path: { ...emptyPath(), coords: { step: 2, done: true, answered: 20, correct: 19, sessions: 4 }, colors: { step: 1, done: false, answered: 5, correct: 3, sessions: 1 } }, streak: { last: "2026-11-24", count: 3 } };
    const account = { path: { ...emptyPath(), coords: { step: 1, done: false, answered: 10, correct: 8, sessions: 2 }, colors: { step: 3, done: false, answered: 15, correct: 13, sessions: 3 } }, streak: { last: "2026-11-20", count: 9 } };
    const m = mergeTraining(device, account);
    expect(m.path.coords.done).toBe(true);
    expect(m.path.colors.step).toBe(3);
    expect(m.streak).toEqual({ last: "2026-11-24", count: 3 });
  });
  test("an account record from the first version doesn't replace the device's", () => {
    const device = { path: emptyPath(), streak: { last: null, count: 0 } };
    expect(mergeTraining(device, { drills: {}, streak: { last: "2026-11-24", count: 1 } })).toBe(device);
    expect(mergeTraining(device, null)).toBe(device);
  });
});

describe("the board for a reach question", () => {
  test("one piece on its square", () => {
    expect(loneFen("N", "g1")).toBe("8/8/8/8/8/8/8/6N1 w - - 0 1");
    expect(loneFen("B", "a8")).toBe("B7/8/8/8/8/8/8/8 w - - 0 1");
    expect(loneFen("N", "h4")).toBe("8/8/8/8/7N/8/8/8 w - - 0 1");
  });
});
