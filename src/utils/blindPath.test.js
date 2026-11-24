import { describe, test, expect } from "vitest";
import { STAGES, emptyPath, openStages, nextStage, afterSession, unlockStep } from "./blindPath";
import { DRILLS } from "./blindDrills";

describe("the trainer's path", () => {
  test("every stage has a drill, and every drill a stage", () => {
    for (const s of STAGES) expect(DRILLS.some((d) => d.id === s.drill)).toBe(true);
    for (const d of DRILLS) expect(STAGES.some((s) => s.drill === d.id)).toBe(true);
  });
  test("only the first stage is open at the start", () => {
    expect(openStages(emptyPath())).toEqual(["coords"]);
    expect(nextStage(emptyPath())).toBe("coords");
  });
  test("a perfect session jumps two steps, 4 of 5 one, 3 stays, 2 goes back", () => {
    const rec = { step: 2, done: false, answered: 0, correct: 0, sessions: 0 };
    expect(afterSession(rec, "reach", 5).record.step).toBe(4);
    expect(afterSession(rec, "reach", 5).change).toBe("up2");
    expect(afterSession(rec, "reach", 4).record.step).toBe(3);
    expect(afterSession(rec, "reach", 3).record.step).toBe(2);
    expect(afterSession(rec, "reach", 2).record.step).toBe(1);
    expect(afterSession({ ...rec, step: 0 }, "reach", 0).record.step).toBe(0);
  });
  test("a good session on the last step finishes the stage", () => {
    const last = STAGES.find((s) => s.id === "coords").steps.length - 1;
    const r = afterSession({ step: last, done: false, answered: 0, correct: 0, sessions: 0 }, "coords", 4);
    expect(r.change).toBe("done");
    expect(r.record.done).toBe(true);
  });
  test("the next stage opens when this one reaches its no-board step", () => {
    const path = emptyPath();
    path.coords = { ...path.coords, done: true };
    expect(openStages(path)).toEqual(["coords", "colors"]);
    path.colors = { ...path.colors, step: unlockStep(STAGES[1]) };
    expect(openStages(path)).toEqual(["coords", "colors", "reach"]);
    expect(nextStage(path)).toBe("reach");
  });
  test("a strong player gets through a stage in few sessions", () => {
    let rec = emptyPath().reach, n = 0;
    while (!rec.done && n < 20) { rec = afterSession(rec, "reach", 5).record; n++; }
    expect(rec.done).toBe(true);
    expect(n).toBeLessThanOrEqual(5);
  });
});
