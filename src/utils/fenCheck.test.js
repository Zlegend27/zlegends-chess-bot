import { describe, test, expect } from "vitest";
import { checkFen } from "./fenCheck";

describe("pasted positions for Watch Bots", () => {
  test("a real position is accepted and tidied", () => {
    expect(checkFen("  r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3 ").fen)
      .toBe("r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3");
  });
  test("just the pieces and side is enough", () => {
    expect(checkFen("6k1/5ppp/8/8/8/8/5PPP/3R2K1 w").fen).toBe("6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1");
  });
  test.each([
    ["", /Paste a position/],
    ["hello", /doesn't look like a FEN/],
    ["rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBN w KQkq - 0 1", /8 squares/],
    ["rnbq1bnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1", /one white king and one black king/],
    ["4k3/8/8/8/8/8/8/P3K3 w - - 0 1", /first or last row/],
    ["4k3/8/8/8/8/8/8/4K2r b - - 0 1", /Check whose turn/],
    ["4k3/8/8/8/8/8/8/4K2r w - - 0 1", null],
    ["7k/6Q1/6K1/8/8/8/8/8 b - - 0 1", /already checkmate/],
    ["7k/8/6QK/8/8/8/8/8 b - - 0 1", /already stalemate/],
  ])("checks %s", (fen, msg) => {
    if (msg) expect(checkFen(fen).error).toMatch(msg);
    else expect(checkFen(fen).fen).toBeTruthy();
  });
});
