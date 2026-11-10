import { describe, test, expect } from "vitest";
import { TacticaScene } from "./scene";

/* What a tap means (TacticaScene.throughTo), without a 3D view: `hits` are
   the character bodies under the finger, nearest first, and `tile` is the
   board square under it. Squares are 0..63 (a1 = 0). */
const sq = (name) => (Number(name[1]) - 1) * 8 + "abcdefgh".indexOf(name[0]);
function board({ white = [], black = [], held = null, targets = [], chosen = null }) {
  const pieces = new Map();
  for (const s of white) pieces.set(sq(s), { colour: "white" });
  for (const s of black) pieces.set(sq(s), { colour: "black" });
  return { pieces, nearColour: "white", held: held == null ? null : sq(held), targets: targets.map(sq), chosen: chosen == null ? null : sq(chosen) };
}
const tap = (state, hits, tile) => TacticaScene.prototype.throughTo.call(state, hits.map(sq), tile == null ? null : sq(tile));

describe("Tactica taps", () => {
  test("with nothing picked, a tap looks past enemies to your own character", () => {
    const state = board({ white: ["d2"], black: ["d3"] });
    expect(tap(state, ["d3", "d2"], "d2")).toBe(sq("d2"));
  });

  test("a glowing square under the finger beats a friend standing in front of it", () => {
    /* The bishop on c1 is picked; the d2 pawn's body covers e3, where it can go. */
    const state = board({ white: ["c1", "d2"], held: "c1", targets: ["e3", "f4"] });
    expect(tap(state, ["d2"], "e3")).toBe(sq("e3"));
  });

  test("a friend is still picked where no glowing square is behind it", () => {
    const state = board({ white: ["c1", "d2"], held: "c1", targets: ["e3", "f4"] });
    expect(tap(state, ["d2"], "d2")).toBe(sq("d2"));
    expect(tap(state, ["d2"], "d3")).toBe(sq("d2"));
  });

  test("an enemy to take behind a friend wins too", () => {
    const state = board({ white: ["c1", "d2"], black: ["e3"], held: "c1", targets: ["e3"] });
    expect(tap(state, ["d2", "e3"], "f4")).toBe(sq("e3"));
  });

  test("the picked character and enemies it can't take don't block its squares", () => {
    const state = board({ white: ["e2"], black: ["d4"], held: "e2", targets: ["e3", "e4"] });
    expect(tap(state, ["e2"], "e3")).toBe(sq("e3"));
    expect(tap(state, ["d4"], "e4")).toBe(sq("e4"));
  });

  test("the square already chosen wins, so a second tap plays it", () => {
    const state = board({ white: ["c1", "d2"], held: "c1", targets: ["e3"], chosen: "e3" });
    expect(tap(state, ["d2"], "d2")).toBe(sq("d2"));
    expect(tap(state, ["d2"], "e3")).toBe(sq("e3"));
  });

  test("an empty spot is just the square", () => {
    const state = board({ white: ["c1"], held: "c1", targets: ["e3"] });
    expect(tap(state, [], "h8")).toBe(sq("h8"));
  });
});
