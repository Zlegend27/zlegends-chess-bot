import { describe, test, expect } from "vitest";
import { MOVE_SLOTS, moveChances, moveSlot, tokensFor } from "./maiaEncoding";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const AFTER_E4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
const token = (t, square, channel) => t[square * 12 + channel];

describe("board encoding", () => {
  test("White to move reads the board as it stands", () => {
    const t = tokensFor(START);
    expect(token(t, 4, 5)).toBe(1); // white king on e1
    expect(token(t, 12, 0)).toBe(1); // white pawn on e2
    expect(token(t, 60, 11)).toBe(1); // black king on e8
    expect(t.reduce((a, b) => a + b, 0)).toBe(32);
  });

  test("Black to move is mirrored, with Black as the mover", () => {
    const t = tokensFor(AFTER_E4);
    expect(token(t, 4, 5)).toBe(1); // the black king, now on the first rank
    expect(token(t, 60, 11)).toBe(1); // the white king, now on the last rank
    expect(token(t, 36, 6)).toBe(1); // the white e4 pawn reads as an enemy pawn on e5
  });

  test("mirroring a position gives the same picture for the mover", () => {
    const white = "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1";
    const black = "4k3/4p3/8/8/8/8/8/4K3 b - - 0 1";
    expect([...tokensFor(black)]).toEqual([...tokensFor(white)]);
  });
});

describe("move slots", () => {
  test("a normal move is from times 64 plus to", () => {
    expect(moveSlot("a1a2", START)).toBe(8);
    expect(moveSlot("e2e4", START)).toBe(12 * 64 + 28);
  });

  test("Black's moves use the mirrored squares", () => {
    expect(moveSlot("e7e5", AFTER_E4)).toBe(moveSlot("e2e4", START));
  });

  test("promotions sit after the square moves, in q r b n order", () => {
    expect(moveSlot("a7a8q", START)).toBe(4096);
    expect(moveSlot("a7a8n", START)).toBe(4099);
    expect(moveSlot("h7g8r", START)).toBe(4096 + 7 * 32 + 6 * 4 + 1);
    expect(moveSlot("h7h8n", START)).toBe(MOVE_SLOTS - 1);
  });

  test("Black promotes on the mirrored rank", () => {
    expect(moveSlot("a2a1q", AFTER_E4)).toBe(4096);
  });
});

describe("move chances", () => {
  test("only the given moves share the chance, and they add to one", () => {
    const logits = new Float32Array(MOVE_SLOTS);
    logits[moveSlot("e2e4", START)] = 2;
    logits[moveSlot("d2d4", START)] = 2;
    logits[moveSlot("a2a3", START)] = 50; // not offered, so ignored
    const chances = moveChances(logits, ["e2e4", "d2d4"], START);
    expect(chances.e2e4).toBeCloseTo(0.5, 6);
    expect(chances.d2d4).toBeCloseTo(0.5, 6);
  });
});
