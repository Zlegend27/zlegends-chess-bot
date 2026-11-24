import { describe, test, expect } from "vitest";
import { isLightSquare } from "./TapBoard";
import { makeQuestion } from "../utils/blindDrills";

describe("the tap board's square colours", () => {
  test("a1 and h8 are dark, h1 and a8 light", () => {
    expect(isLightSquare("a1")).toBe(false);
    expect(isLightSquare("h8")).toBe(false);
    expect(isLightSquare("h1")).toBe(true);
    expect(isLightSquare("a8")).toBe(true);
    expect(isLightSquare("g5")).toBe(false);
  });
  test("agrees with the colour drill's answers on every square", () => {
    for (let i = 0; i < 300; i++) {
      const q = makeQuestion("colors", 1);
      const square = q.prompt.match(/\b[a-h][1-8]\b/)[0];
      expect(isLightSquare(square) ? "light" : "dark").toBe(q.answer);
    }
  });
});
