import { describe, it, expect } from "vitest";
import { createEngine } from "../engine/chessEngine.js";
import { MEMORIES, openMemories } from "./memories.js";

describe("memories", () => {
  for (const m of MEMORIES) {
    it(`${m.title}: every move is legal, in turn`, () => {
      const eng = createEngine();
      eng.reset();
      eng.loadFen(m.fen);
      for (const san of m.moves) {
        const move = eng.legalMoves().find((x) => eng.sanOf(x) === san);
        expect(move, `${san} in ${m.id}`).toBeTruthy();
        eng.make(move);
      }
    });
  }

  it("one memory per world, in order", () => {
    expect(MEMORIES.filter((m) => m.world != null).map((m) => m.world)).toEqual([0, 1, 2, 3]);
  });

  it("opens the memories of worlds already passed, and all once beaten", () => {
    expect(openMemories({ woken: [], reached: 0 })).toEqual([]);
    expect(openMemories({ woken: [], reached: 2 })).toEqual(["opera", "reti"]);
    expect(openMemories({ woken: ["immortal"], reached: 0 })).toEqual(["immortal"]);
    expect(openMemories({ woken: [], reached: 0, beaten: true })).toHaveLength(4);
  });

  it("each kind of piece brings back its own memory at bond level 3", () => {
    const kinds = MEMORIES.filter((m) => m.kind).map((m) => m.kind).sort();
    expect(kinds).toEqual(["bishop", "king", "knight", "pawn", "queen", "rook"]);
    expect(openMemories({ woken: [], levels: { knight: 2 } })).toEqual([]);
    expect(openMemories({ woken: [], levels: { knight: 3, pawn: 5 } })).toEqual(["saavedra", "philidor"]);
  });
});
