import { describe, test, expect } from "vitest";
import { createEngine } from "../engine/chessEngine";
import { gameResult, resultSentence } from "./gameResult";

const at = (fen) => { const eng = createEngine(); eng.loadFen(fen); return eng; };

describe("game results", () => {
  test("a game in progress has no result", () => {
    expect(gameResult(at("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"))).toBeNull();
  });

  test("checkmate names the winner", () => {
    const fools = at("rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3");
    expect(gameResult(fools)).toEqual({ text: "0–1", reason: "Checkmate", winner: -1 });
    expect(resultSentence(gameResult(fools), -1)).toBe("Checkmate, you win!");
    expect(resultSentence(gameResult(fools), 1)).toBe("Checkmate, you lose.");
  });

  test("stalemate, the fifty-move rule and bare kings are draws", () => {
    expect(gameResult(at("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1"))).toEqual({ text: "½–½", reason: "Stalemate" });
    expect(gameResult(at("7k/8/8/8/8/8/8/R5K1 w - - 100 80")).reason).toBe("Fifty-move rule");
    expect(gameResult(at("7k/8/8/8/8/8/8/6K1 w - - 0 1")).reason).toBe("Insufficient material");
    expect(resultSentence({ reason: "Fifty-move rule" }, 1)).toBe("Draw by fifty-move rule.");
  });
});
