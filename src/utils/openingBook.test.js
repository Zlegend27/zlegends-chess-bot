import { describe, test, expect, vi, afterEach } from "vitest";
import { createEngine } from "../engine/chessEngine";
import { replayIntoEngine } from "./share";
import { bookKey } from "./bookKey";
import { getBookMove, lichessBookEntries } from "./openingBook";
import LICHESS_BOOK from "./openingBook-lichess.json";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function engineAt(moves) {
  const eng = createEngine();
  eng.reset();
  replayIntoEngine(eng, moves);
  return eng;
}

afterEach(() => vi.unstubAllGlobals());

describe("bookKey", () => {
  test("ignores the move counters but not the side to move", () => {
    expect(bookKey(START)).toBe(bookKey(START.replace(" 0 1", " 7 30")));
    expect(bookKey(START)).not.toBe(bookKey(START.replace(" w ", " b ")));
  });

  test("transpositions share a key", () => {
    const a = engineAt(["d4", "Nf6", "c4", "e6"]).fen();
    const b = engineAt(["c4", "Nf6", "d4", "e6"]).fen();
    expect(bookKey(a)).toBe(bookKey(b));
  });
});

describe("bundled Lichess book", () => {
  test("every stored entry parses to moves with positive weights", () => {
    for (const raw of Object.values(LICHESS_BOOK.positions)) {
      const parts = raw.split(" ");
      expect(parts.length % 2).toBe(0);
      for (let i = 1; i < parts.length; i += 2) expect(Number(parts[i])).toBeGreaterThan(0);
    }
  });

  test("covers the starting position", () => {
    const sans = lichessBookEntries(START).map(e => e.san);
    expect(sans).toContain("e4");
    expect(sans).toContain("d4");
  });

  /* Walk the book the way the bot does: every move it hands out must be
     one of the engine's own legal moves, spelled exactly as sanOf()
     spells it (the worker matches on that string). Also proves the book
     reaches well past STATIC_BOOK, which stops after three plies. */
  test("random walks through the book only ever play legal moves", () => {
    let deepest = 0;
    for (let walk = 0; walk < 300; walk++) {
      const eng = createEngine();
      eng.reset();
      let ply = 0;
      for (; ply < 20; ply++) {
        const entries = lichessBookEntries(eng.fen());
        if (!entries) break;
        const pick = entries[Math.floor(Math.random() * entries.length)].san;
        const move = eng.legalMoves().find(m => eng.sanOf(m) === pick);
        expect(move, `book move ${pick} at ply ${ply}`).toBeDefined();
        eng.make(move);
      }
      deepest = Math.max(deepest, ply);
    }
    expect(deepest).toBeGreaterThanOrEqual(10);
  });

  test("a main line stays in book for at least ten plies", () => {
    const line = ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "a6"];
    for (let ply = 0; ply < line.length; ply++) {
      const entries = lichessBookEntries(engineAt(line.slice(0, ply)).fen());
      expect(entries, `after ${line.slice(0, ply).join(" ") || "start"}`).not.toBeNull();
    }
  });
});

describe("getBookMove", () => {
  test("never touches the network", () => {
    const fetchSpy = vi.fn(() => { throw new Error("no network in the opening book"); });
    vi.stubGlobal("fetch", fetchSpy);
    const move = getBookMove(START, [], { style: null });
    expect(["e4", "d4", "c4", "Nf3", "g3", "b3", "f4", "Nc3", "e3", "b4", "d3", "c3", "g4", "a3", "h3"]).toContain(move);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("a style still picks only moves from the book", () => {
    const sans = lichessBookEntries(START).map(e => e.san);
    for (let i = 0; i < 50; i++) expect(sans).toContain(getBookMove(START, [], { style: "Gambit" }));
  });

  test("returns null once both books are out of moves", () => {
    const moves = ["a4", "h5", "Ra3", "Rh6", "Rb3", "Rb6"];
    expect(getBookMove(engineAt(moves).fen(), moves)).toBeNull();
  });
});
