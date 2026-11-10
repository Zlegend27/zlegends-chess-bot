import { describe, test, expect } from "vitest";
import { replayMoments } from "./replayMoments";

describe("Owl's Replay", () => {
  test("finds the checkmate as the best moment", () => {
    const { best } = replayMoments(["e4", "e5", "Bc4", "Nc6", "Qh5", "Nf6", "Qxf7#"], 1);
    expect(best.san).toBe("Qxf7#");
    expect(best.text).toMatch(/Checkmate/);
  });

  test("finds a piece left hanging as the oops", () => {
    /* White's bishop goes to g5, where the h6 pawn takes it for nothing. */
    const { oops } = replayMoments(["e4", "e5", "Nf3", "h6", "d3", "d6", "Bg5", "hxg5"], 1);
    expect(oops.san).toBe("Bg5");
    expect(oops.reply.san).toBe("hxg5");
    expect(oops.text).toMatch(/bishop/);
  });

  test("finds a capture that wins material, for Black too", () => {
    const { best } = replayMoments(["e4", "e5", "Nf3", "h6", "d3", "d6", "Bg5", "hxg5"], -1);
    expect(best.san).toBe("hxg5");
    expect(best.text).toMatch(/bishop/);
  });

  test("a quiet game has no moments", () => {
    expect(replayMoments(["e4", "e5", "Nf3", "Nc6"], 1)).toEqual({ best: null, oops: null });
  });
});
