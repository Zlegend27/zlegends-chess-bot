import { describe, test, expect } from "vitest";
import { expectedPoints, pointsLost, moveAccuracy, gradeFromLoss, sideAccuracy } from "./reviewScoring";

describe("expected points", () => {
  test("an equal position is worth half the points", () => {
    expect(expectedPoints(0)).toBeCloseTo(50, 6);
  });

  test("being ahead is worth more, and the curve is symmetric", () => {
    expect(expectedPoints(300)).toBeGreaterThan(60);
    expect(expectedPoints(300) + expectedPoints(-300)).toBeCloseTo(100, 6);
  });

  test("the same eval drop costs less once a game is decided", () => {
    expect(pointsLost(0, -200)).toBeGreaterThan(pointsLost(1500, 1300));
  });

  test("an improving eval never counts as a loss", () => {
    expect(pointsLost(0, 100)).toBe(0);
  });
});

describe("move labels", () => {
  test.each([
    [0, "excellent"], [1.9, "excellent"], [2, "good"], [4.9, "good"],
    [5, "inaccuracy"], [9.9, "inaccuracy"], [10, "mistake"], [19.9, "mistake"],
    [20, "blunder"], [60, "blunder"],
  ])("%s points lost is %s", (loss, label) => {
    expect(gradeFromLoss(loss)).toBe(label);
  });
});

describe("accuracy", () => {
  test("a lossless move scores 100, and bigger losses score less", () => {
    expect(moveAccuracy(0)).toBe(100);
    expect(moveAccuracy(5)).toBeLessThan(100);
    expect(moveAccuracy(20)).toBeLessThan(moveAccuracy(5));
  });

  const bad = { before: 0, after: -400, isBest: false, forced: false, book: false };

  test("the engine's own choice scores full marks even if its eval dipped", () => {
    expect(sideAccuracy([{ ...bad, isBest: true }])).toBe(100);
  });

  test("book moves score full marks", () => {
    expect(sideAccuracy([{ ...bad, book: true }])).toBe(100);
  });

  test("forced moves don't count at all", () => {
    const withForced = sideAccuracy([bad, { ...bad, isBest: true, forced: true }]);
    expect(withForced).toBeCloseTo(sideAccuracy([bad]), 6);
  });

  test("a game is the average of its moves", () => {
    const expected = (100 + moveAccuracy(pointsLost(0, -400))) / 2;
    expect(sideAccuracy([{ ...bad, isBest: true }, bad])).toBeCloseTo(expected, 6);
  });

  test("nothing to score gives no accuracy", () => {
    expect(sideAccuracy([])).toBeNull();
    expect(sideAccuracy([{ ...bad, forced: true }])).toBeNull();
  });
});
