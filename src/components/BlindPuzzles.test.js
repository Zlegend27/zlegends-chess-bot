import { describe, test, expect } from "vitest";
import { TEXT_PUZZLES, pickPuzzle, nextRating, readPosition, piecesOf } from "./BlindPuzzles";
import { createEngine } from "../engine/chessEngine";
import { judgePuzzleMove } from "../utils/puzzleSession";
import { _internal } from "../utils/blindDrills";

describe("text puzzles", () => {
  test("there are enough, from beginner up, all short enough to hold in your head", () => {
    expect(TEXT_PUZZLES.length).toBeGreaterThan(80);
    expect(Math.min(...TEXT_PUZZLES.map((p) => p.rating))).toBeLessThan(700);
    for (const p of TEXT_PUZZLES) expect(piecesOf(p.fen).length).toBeLessThanOrEqual(12);
  });
  test("every puzzle can be solved by typing its moves", () => {
    for (const p of TEXT_PUZZLES) {
      const eng = createEngine(); eng.loadFen(p.fen);
      const played = [];
      for (let i = 0; i < p.moves.length; i += 2) {
        const moves = _internal.readMove(eng, p.moves[i]);
        expect(moves, `${p.id} ${p.moves[i]}`).toHaveLength(1);
        const v = judgePuzzleMove(eng, p, played, moves[0]);
        expect(v.ok, p.id).toBe(true);
        eng.make(moves[0]); played.push(v.san);
        if (v.solved) break;
        const reply = eng.legalMoves().find((m) => eng.sanOf(m) === v.reply);
        expect(reply, `${p.id} reply ${v.reply}`).toBeTruthy();
        eng.make(reply); played.push(v.reply);
      }
    }
  });
  test("the position reads as a list, with the side to move", () => {
    expect(readPosition("6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1"))
      .toBe("White: king g1, rook d1, pawns f2, g2 and h2. Black: king g8, pawns f7, g7 and h7. White to move.");
  });
  test("puzzles are picked near your rating, and not repeated", () => {
    const p = pickPuzzle(800, new Set(), () => 0);
    expect(Math.abs(p.rating - 800)).toBeLessThan(300);
    const seen = new Set([p.id]);
    expect(pickPuzzle(800, seen, () => 0).id).not.toBe(p.id);
  });
  test("the rating goes up for a solve and down for a miss", () => {
    expect(nextRating(800, 800, true)).toBe(816);
    expect(nextRating(800, 800, false)).toBe(784);
    expect(nextRating(300, 1500, false)).toBe(300);
  });
});
