import { describe, test, expect } from "vitest";
import { createEngine } from "./chessEngine";

/* perft counts leaf nodes at a given depth — the standard way to verify a
   move generator against known-correct values. If this drifts, movegen is
   broken somewhere (missing en passant, bad castling rights, etc.), usually
   in a way that wouldn't show up in normal play for a long time. */
function perft(eng, depth) {
  if (depth === 0) return 1;
  const moves = eng.legalMoves();
  if (depth === 1) return moves.length;
  let nodes = 0;
  for (const m of moves) {
    eng.make(m);
    nodes += perft(eng, depth - 1);
    eng.unmake();
  }
  return nodes;
}

describe("perft", () => {
  test("starting position", () => {
    const eng = createEngine();
    expect(perft(eng, 1)).toBe(20);
    expect(perft(eng, 2)).toBe(400);
    expect(perft(eng, 3)).toBe(8902);
    expect(perft(eng, 4)).toBe(197281);
  });

  test("kiwipete (castling, promotions, mixed captures)", () => {
    const eng = createEngine();
    eng.loadFen("r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1");
    expect(perft(eng, 1)).toBe(48);
    expect(perft(eng, 2)).toBe(2039);
    expect(perft(eng, 3)).toBe(97862);
  });

  test("position 3 (en passant, pawn checks)", () => {
    const eng = createEngine();
    eng.loadFen("8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1");
    expect(perft(eng, 1)).toBe(14);
    expect(perft(eng, 2)).toBe(191);
    expect(perft(eng, 3)).toBe(2812);
  });
});

describe("game-end detection", () => {
  test("fool's mate is checkmate, not stalemate", () => {
    const eng = createEngine();
    eng.loadFen("rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 0 3");
    expect(eng.inCheckNow()).toBe(true);
    expect(eng.legalMoves().length).toBe(0);
  });

  test("known king+queen stalemate", () => {
    const eng = createEngine();
    eng.loadFen("7k/5K2/6Q1/8/8/8/8/8 b - - 0 1");
    expect(eng.inCheckNow()).toBe(false);
    expect(eng.legalMoves().length).toBe(0);
  });
});

describe("special moves", () => {
  test("en passant capture is generated", () => {
    const eng = createEngine();
    eng.loadFen("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1");
    const sans = eng.legalMoves().map(m => eng.sanOf(m));
    expect(sans).toContain("exd6");
  });

  test("both castling moves are generated when nothing blocks them", () => {
    const eng = createEngine();
    eng.loadFen("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
    const sans = eng.legalMoves().map(m => eng.sanOf(m));
    expect(sans).toContain("O-O");
    expect(sans).toContain("O-O-O");
  });
});

describe("moveFromUci", () => {
  test("finds a plain move by UCI", () => {
    const eng = createEngine();
    const m = eng.moveFromUci("e2e4");
    expect(m).toBeDefined();
    expect(eng.sanOf(m)).toBe("e4");
  });

  test("distinguishes promotion pieces", () => {
    const eng = createEngine();
    eng.loadFen("4k3/P7/8/8/8/8/8/4K3 w - - 0 1");
    const q = eng.moveFromUci("a7a8q");
    const n = eng.moveFromUci("a7a8n");
    expect(eng.sanOf(q)).toBe("a8=Q+");
    expect(eng.sanOf(n)).toBe("a8=N");
  });

  test("returns undefined for a move that isn't legal", () => {
    const eng = createEngine();
    expect(eng.moveFromUci("e2e5")).toBeUndefined();
  });
});
