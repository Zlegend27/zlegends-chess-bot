import { describe, test, expect } from "vitest";
import { explainLine, materialText } from "./explainLine";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe("explaining a line", () => {
  test("says who moves what where, and the result", () => {
    const { steps, verdict } = explainLine(START, ["e2e4", "e7e5", "b1c3"]);
    expect(steps.map((s) => s.text)).toEqual([
      "White's pawn goes to e4.",
      "Black's pawn goes to e5.",
      "White's knight goes to c3.",
    ]);
    expect(verdict).toBe("Material stays level.");
  });

  test("names captures and counts the material won", () => {
    /* Vienna Gambit trap: 3...exf4 4.e5 Ng4?? 5.Qxg4 wins a knight. */
    const fen = "rnbqkb1r/pppp1ppp/8/4P3/5pn1/2N5/PPPP2PP/R1BQKBNR w KQkq - 1 5";
    const { steps, verdict } = explainLine(fen, ["d1g4"]);
    expect(steps[0].text).toBe("White's queen takes the knight on g4.");
    expect(verdict).toBe("White comes out a piece ahead.");
  });

  test("notices checkmate and stops there", () => {
    const fools = "rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2";
    const { steps, verdict } = explainLine(fools, ["d8h4", "a2a3"]);
    expect(steps).toHaveLength(1);
    expect(steps[0].text).toBe("Black's queen goes to h4, checkmate.");
    expect(verdict).toBe("Black delivers checkmate.");
  });

  test("stops at a move that isn't legal", () => {
    expect(explainLine(START, ["e2e4", "e2e4"]).steps).toHaveLength(1);
  });
});

test("material reads naturally", () => {
  expect(["a pawn", "2 pawns' worth", "a piece", "a rook", "a queen"]).toEqual([1, 2, 3, 5, 9].map(materialText));
});

describe("the verdict with Stockfish's view", () => {
  test("a gambit reads as a pawn down but fine, not as a loss", async () => {
    const { fullVerdict } = await import("./explainLine");
    expect(fullVerdict({ verdict: "Black comes out a pawn ahead.", delta: -1 }, 10))
      .toBe("Black comes out a pawn ahead. Still, Stockfish calls it about equal.");
    expect(fullVerdict({ verdict: "White comes out a piece ahead.", delta: 3 }, 320))
      .toBe("White comes out a piece ahead. Stockfish has White better by 3.2.");
    expect(fullVerdict({ verdict: "Material stays level.", delta: 0 }, null)).toBe("Material stays level.");
  });
});
