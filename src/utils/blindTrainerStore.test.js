import { describe, test, expect } from "vitest";
import { bumpStreak, liveStreak } from "./blindTrainerStore";
import { mergeTraining } from "./blindTrainerSync";
import { loneFen } from "../components/BlindTrainerPage";
import { emptyProgress } from "./blindDrills";

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
  test("keeps each drill's more-practised record and the latest streak", () => {
    const device = { drills: { ...emptyProgress(), colors: { level: 5, answered: 40, correct: 30, right: 0, wrong: 0, best: 6 } }, streak: { last: "2026-11-24", count: 3 } };
    const account = { drills: { ...emptyProgress(), colors: { level: 2, answered: 10, correct: 5, right: 0, wrong: 0, best: 2 }, reach: { level: 4, answered: 20, correct: 15, right: 0, wrong: 0, best: 5 } }, streak: { last: "2026-11-20", count: 9 } };
    const m = mergeTraining(device, account);
    expect(m.drills.colors.level).toBe(5);
    expect(m.drills.reach.level).toBe(4);
    expect(m.streak).toEqual({ last: "2026-11-24", count: 3 });
  });
  test("nothing on the account keeps the device's", () => {
    const device = { drills: emptyProgress(), streak: { last: null, count: 0 } };
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
