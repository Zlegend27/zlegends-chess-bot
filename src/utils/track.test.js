import { describe, test, expect } from "vitest";
import { fitBytes } from "./track";

describe("feedback text fits the events table", () => {
  test("plain text is kept whole", () => {
    expect(fitBytes("The board froze.", 1400)).toBe("The board froze.");
  });
  test("long emoji or non-Latin text is trimmed under the limit, whole characters only", () => {
    for (const ch of ["😀", "棋", "ш"]) {
      const out = fitBytes(ch.repeat(1000), 1400);
      expect(new TextEncoder().encode(out).length).toBeLessThanOrEqual(1400);
      expect([...out].every((c) => c === ch)).toBe(true);
      expect(out.length).toBeGreaterThan(0);
    }
  });
});
