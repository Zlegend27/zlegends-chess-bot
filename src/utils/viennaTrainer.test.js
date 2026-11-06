import { describe, test, expect } from "vitest";
import { createEngine } from "../engine/chessEngine";
import { nodeAt, pickReply, judgeMove, updateWeak, pawnsText } from "./viennaTrainer";
import book from "../data/viennaRepertoire.json";

const blackNode = { r: { Nf6: [60, 10, 10], Nc6: [30, 50, 10], Bc5: [10, 0, 5] } };
const whiteNode = { w: { rep: "f4", ok: ["Bc4"], ev: { f4: 20, Bc4: 0, d3: -80 } } };

/* rng that walks the weights from the bottom, so the result shows the order. */
const fixed = (x) => () => x;

describe("Black's replies", () => {
  test("follow how often players at the chosen level played them", () => {
    const picks = (band) => {
      const seen = {};
      for (let i = 0; i < 100; i++) {
        const san = pickReply(blackNode, ["e4", "e5", "Nc3"], { band, power: 1, rng: fixed((i + 0.5) / 100) });
        seen[san] = (seen[san] || 0) + 1;
      }
      return seen;
    };
    expect(picks(0)).toEqual({ Nf6: 60, Nc6: 30, Bc5: 10 });
    expect(picks(1).Nc6).toBeGreaterThan(picks(1).Nf6);
  });

  test("a reply nobody at this level played still comes up now and then", () => {
    const seen = new Set();
    for (let i = 0; i < 200; i++) seen.add(pickReply(blackNode, ["e4", "e5", "Nc3"], { band: 1, power: 1, rng: fixed(i / 200) }));
    expect(seen.has("Bc5")).toBe(true);
  });

  test("a line the player missed before comes up more often", () => {
    const count = (weak) => {
      let n = 0;
      for (let i = 0; i < 100; i++) if (pickReply(blackNode, ["e4", "e5", "Nc3"], { band: 0, power: 1, weak, rng: fixed((i + 0.5) / 100) }) === "Bc5") n++;
      return n;
    };
    expect(count({ "e4 e5 Nc3 Bc5 Nf3": 1 })).toBeGreaterThan(count({}));
  });
});

describe("judging the player's move", () => {
  test("sorts moves into repertoire, playable, mistake and unknown", () => {
    expect(judgeMove(whiteNode, "f4")).toEqual({ verdict: "rep", rep: "f4" });
    expect(judgeMove(whiteNode, "Bc4")).toEqual({ verdict: "ok", rep: "f4", loss: 20 });
    expect(judgeMove(whiteNode, "d3")).toEqual({ verdict: "mistake", rep: "f4", loss: 100 });
    expect(judgeMove(whiteNode, "a3")).toEqual({ verdict: "off", rep: "f4", loss: null });
  });
});

describe("remembering missed lines", () => {
  test("a miss is remembered and fades after correct answers", () => {
    let weak = updateWeak({}, "k", false);
    weak = updateWeak(weak, "k", false);
    expect(weak).toEqual({ k: 2 });
    weak = updateWeak(weak, "k", true);
    weak = updateWeak(weak, "k", true);
    expect(weak).toEqual({});
  });
});

test("centipawns read as pawns", () => {
  expect(pawnsText(100)).toBe("1 pawn");
  expect(pawnsText(150)).toBe("1.5 pawns");
});

/* The shipped book must be playable: every move in it is legal, and every
   White position has a repertoire move. */
describe("the shipped Vienna book", () => {
  test("starts with 1.e4 e5 2.Nc3 and the gambit against 2...Nf6", () => {
    expect(nodeAt(book, []).w.rep).toBe("e4");
    expect(nodeAt(book, ["e4", "e5"]).w.rep).toBe("Nc3");
    expect(nodeAt(book, ["e4", "e5", "Nc3", "Nf6"]).w.rep).toBe("f4");
  });

  test("every move in it is legal in its position", () => {
    for (const [key, node] of Object.entries(book.nodes)) {
      const eng = createEngine();
      for (const san of key ? key.split(" ") : []) eng.make(eng.legalMoves().find((m) => eng.sanOf(m) === san));
      const legal = new Set(eng.legalMoves().map((m) => eng.sanOf(m)));
      const moves = node.w ? [node.w.rep, ...node.w.ok] : Object.keys(node.r);
      for (const san of moves) expect(legal.has(san), `${san} after "${key}"`).toBe(true);
    }
  });
});

/* Zlegend27's notes must explain the move the trainer actually asks for. */
describe("the coach's notes", () => {
  test("each note sits on a White decision and names its repertoire move", async () => {
    const { VIENNA_NOTES } = await import("../data/viennaNotes");
    for (const [key, note] of Object.entries(VIENNA_NOTES)) {
      const node = book.nodes[key];
      expect(node?.w, `no White decision at "${key}"`).toBeTruthy();
      expect(node.w.rep, `note at "${key}"`).toBe(note.move);
    }
  });
});

describe("Learn mode's choices and the line map", () => {
  const node = { r: { exf4: [46, 0, 0, 0, 5], d6: [21, 0, 0, 0, 1], Nc6: [19, 0, 0, 0, 1], d5: [8, 0, 0, 0, 90], Bc5: [3, 0, 0, 0, 0] } };

  /* 97 games at this level: exf4 46 of them is 47%. */
  test("offers the three most common replies, plus the main line of theory", async () => {
    const { topReplies } = await import("./viennaTrainer");
    expect(topReplies(node, 0)).toEqual([
      { san: "exf4", pct: 47, main: false },
      { san: "d6", pct: 22, main: false },
      { san: "Nc6", pct: 20, main: false },
      { san: "d5", pct: 8, main: true },
    ]);
  });

  test("the map starts from Black's second move and knows the gambit lines", async () => {
    const { lineMap } = await import("./viennaTrainer");
    const map = lineMap(book, 0);
    const bySan = Object.fromEntries(map.map((l) => [l.san, l]));
    expect(bySan.Nf6.gambit).toBe(true);
    expect(bySan.Nc6.gambit).toBe(true);
    expect(bySan.Bc5.gambit).toBe(false);
    expect(map[0].pct).toBeGreaterThanOrEqual(map[1].pct);
    for (const line of map) {
      expect(line.keys.length).toBeGreaterThan(0);
      for (const k of line.keys) expect(k.startsWith(line.moves.join(" "))).toBe(true);
    }
  });
});
