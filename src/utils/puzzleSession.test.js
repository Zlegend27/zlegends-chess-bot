import { describe, test, expect } from "vitest";
import { createEngine } from "../engine/chessEngine";
import { judgePuzzleMove } from "./puzzleSession";

const at = (fen) => { const eng = createEngine(); eng.loadFen(fen); return eng; };
const move = (eng, san) => eng.legalMoves().find((m) => eng.sanOf(m) === san);

/* Two rooks, two mates: Ra8# and Rd8# both end it. */
const TWO_MATES = "6k1/5ppp/8/8/8/8/5PPP/R2R2K1 w - - 0 1";

describe("judging a puzzle move", () => {
  test("the stored move is accepted", () => {
    const eng = at(TWO_MATES);
    const verdict = judgePuzzleMove(eng, { moves: ["Rd8#"] }, [], move(eng, "Rd8#"));
    expect(verdict).toEqual({ ok: true, san: "Rd8#", solved: true, reply: null });
  });

  test("a different checkmate also solves it", () => {
    const eng = at(TWO_MATES);
    expect(judgePuzzleMove(eng, { moves: ["Rd8#"] }, [], move(eng, "Ra8#"))).toMatchObject({ ok: true, solved: true });
  });

  test("any other move is wrong", () => {
    const eng = at(TWO_MATES);
    expect(judgePuzzleMove(eng, { moves: ["Rd8#"] }, [], move(eng, "Rd7"))).toMatchObject({ ok: false, solved: false, reply: null });
  });

  test("a correct move mid-puzzle hands back the reply", () => {
    const eng = at(TWO_MATES);
    const puzzle = { moves: ["Rd7", "h6", "Rd8#"] };
    expect(judgePuzzleMove(eng, puzzle, [], move(eng, "Rd7"))).toEqual({ ok: true, san: "Rd7", solved: false, reply: "h6" });
  });

  test("an early mate ends the puzzle, even if the stored line runs on", () => {
    const eng = at(TWO_MATES);
    const puzzle = { moves: ["Rd7", "h6", "Rd8#"] };
    expect(judgePuzzleMove(eng, puzzle, [], move(eng, "Ra8#"))).toMatchObject({ ok: true, solved: true, reply: null });
  });

  test("the position is left as it was", () => {
    const eng = at(TWO_MATES);
    const before = eng.fen();
    judgePuzzleMove(eng, { moves: ["Rd8#"] }, [], move(eng, "Ra8#"));
    expect(eng.fen()).toBe(before);
  });
});
