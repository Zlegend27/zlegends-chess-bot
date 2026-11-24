import { describe, test, expect } from "vitest";
import { DRILLS, makeQuestion, recordAnswer, emptyProgress, reachOf, MAX_LEVEL, _internal } from "./blindDrills";
import { createEngine, M120TO64, mFrom, mTo } from "../engine/chessEngine";

/* A repeatable random source, so a failure can be replayed. */
function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}
const square64 = (s) => "abcdefgh".indexOf(s[0]) + (Number(s[1]) - 1) * 8;

describe("every drill's questions have right answers", () => {
  for (const d of DRILLS) {
    test(`${d.name}: 400 questions across all levels`, () => {
      const rand = seeded(d.id.length * 7919);
      for (let i = 0; i < 400; i++) {
        const level = 1 + (i % MAX_LEVEL);
        const q = makeQuestion(d.id, level, rand);
        expect(q.prompt.length).toBeGreaterThan(5);
        expect(q.spoken.length).toBeGreaterThan(5);
        const right = q.check(q.answer);
        expect(right.understood, `${q.prompt} / ${q.answer}`).toBe(true);
        expect(right.correct, `${q.prompt} / ${q.answer}`).toBe(true);
        expect(right.explanation.length).toBeGreaterThan(5);
        /* The engine agrees with what tracking and square questions say is there. */
        if (q.about) {
          const eng = createEngine();
          eng.loadFen(q.fen);
          const p = eng.pieceAt(square64(q.about.square));
          expect(Math.abs(p)).toBe(q.about.piece);
          if (p) expect(Math.sign(p)).toBe(q.about.color);
        }
      }
    }, 60_000);
  }
});

describe("answers in words, as typed or spoken", () => {
  test("squares", () => {
    expect(_internal.readSquare("e four")).toBe("e4");
    expect(_internal.readSquare("F6")).toBe("f6");
    expect(_internal.readSquare("it's on d 5")).toBe("d5");
    expect(_internal.readSquare("no idea")).toBe(null);
  });
  test("colours, yes/no, numbers", () => {
    expect(_internal.readColour("it's a light square")).toBe("light");
    expect(_internal.readColour("Dark")).toBe("dark");
    expect(_internal.readYesNo("yeah same colour")).toBe(true);
    expect(_internal.readYesNo("no")).toBe(false);
    expect(_internal.readNumber("eight squares")).toBe(8);
    expect(_internal.readNumber("13")).toBe(13);
  });
  test("a wrong answer is wrong, an unreadable one isn't counted", () => {
    const q = makeQuestion("colors", 1, seeded(3));
    const wrong = q.answer === "light" ? "dark" : "light";
    expect(q.check(wrong)).toMatchObject({ understood: true, correct: false });
    expect(q.check("banana").understood).toBe(false);
  });
  test("what's on a square: colour optional, but a wrong colour is wrong", () => {
    for (let seed = 1; seed < 60; seed++) {
      const q = makeQuestion("squares", 3, seeded(seed));
      if (q.answer === "empty") { expect(q.check("nothing").correct).toBe(true); continue; }
      const [colour, piece] = q.answer.split(" ");
      expect(q.check(piece).correct).toBe(true);
      expect(q.check(`${colour === "white" ? "black" : "white"} ${piece}`).correct).toBe(false);
    }
  });
  test("openings by name or by number", () => {
    const q = makeQuestion("openings", 1, seeded(11));
    const n = q.choices.indexOf(q.answer) + 1;
    expect(q.check(String(n)).correct).toBe(true);
    expect(q.check(`number ${["one", "two", "three", "four"][n - 1]}`).correct).toBe(true);
  });
});

describe("knight and bishop reach", () => {
  test("corners and the middle", () => {
    expect(reachOf("knight", "a1").sort()).toEqual(["b3", "c2"]);
    expect(reachOf("knight", "e4")).toHaveLength(8);
    expect(reachOf("bishop", "a1")).toHaveLength(7);
    expect(reachOf("bishop", "d4")).toHaveLength(13);
  });
});

describe("tracking follows castling and captures", () => {
  test("castling moves the rook", () => {
    const { origin } = _internal.follow(["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "O-O"]);
    expect(origin.f1.start).toBe("h1");
    expect(origin.g1.start).toBe("e1");
  });
  test("a captured piece is gone, the capturer is on its square", () => {
    const { origin } = _internal.follow(["e4", "d5", "exd5"]);
    expect(origin.d5.start).toBe("e2");
    expect(Object.values(origin).some((o) => o.start === "d7")).toBe(false);
  });
});

describe("getting harder and easier", () => {
  test("four right in a row moves up, two wrong in a row moves down", () => {
    let p = emptyProgress();
    for (let i = 0; i < 4; i++) p = recordAnswer(p, "colors", true);
    expect(p.colors.level).toBe(2);
    p = recordAnswer(p, "colors", false);
    expect(p.colors.level).toBe(2);
    p = recordAnswer(p, "colors", false);
    expect(p.colors.level).toBe(1);
    expect(p.colors).toMatchObject({ answered: 6, correct: 4, best: 4 });
  });
  test("never above the top level or below 1", () => {
    let p = emptyProgress();
    for (let i = 0; i < 200; i++) p = recordAnswer(p, "reach", true);
    expect(p.reach.level).toBe(MAX_LEVEL);
    for (let i = 0; i < 50; i++) p = recordAnswer(p, "reach", false);
    expect(p.reach.level).toBe(1);
  });
});

import { describePieces } from "./blindDrills";
describe("the harder drills", () => {
  test("a position reads as a piece list", () => {
    expect(describePieces([["g1", "K"], ["d1", "Q"], ["h8", "k"], ["g7", "p"], ["h7", "p"]]))
      .toBe("White: king g1, queen d1. Black: king h8, pawns g7 and h7.");
  });
  test("mate in one: notation or words, and a wrong move is wrong", () => {
    const q = makeQuestion("mate", 1, seeded(5));
    expect(q.check(q.answer).correct).toBe(true);
    const words = q.answer.replace(/[+#]/g, "").replace(/^Q/, "queen to ").replace(/^R/, "rook to ").replace(/x/, "");
    expect(q.check(words).correct).toBe(true);
    expect(q.check("banana").understood).toBe(false);
  });
  test("a legal move that doesn't mate is marked wrong, with the answer", () => {
    for (let seed = 1; seed < 40; seed++) {
      const q = makeQuestion("mate", 2, seeded(seed));
      const eng = createEngine(); eng.loadFen(q.fen);
      const other = eng.legalMoves().map((m) => eng.sanOf(m)).find((s) => !s.includes("#"));
      if (!other) continue;
      const r = q.check(other);
      expect(r.correct).toBe(false);
      expect(r.explanation).toContain(q.answer);
      return;
    }
  });
  test("take back has questions from the openings", () => {
    expect(_internal.RECAPTURES.length).toBeGreaterThan(5);
  });
  test("questions are quick to make (they're built on the phone)", () => {
    const rand = seeded(99);
    for (const d of ["checks", "free", "mate"]) {
      const t0 = performance.now();
      for (let i = 0; i < 20; i++) makeQuestion(d, 1 + (i % 10), rand);
      expect((performance.now() - t0) / 20).toBeLessThan(150);
    }
  });
});

describe("impossible moves get a clear message", () => {
  test("notation that no piece can play here", () => {
    const q = makeQuestion("mate", 1, seeded(5));
    const r = q.check("Nh9") ;
    expect(r.understood).toBe(false);
    const r2 = q.check("Nb1");
    expect(r2.understood).toBe(false);
    expect(r2.retry).toMatch(/isn't possible/);
  });
});

describe("answers given by tapping", () => {
  test("the choices for what's on a square: exactly one is right", () => {
    for (let seed = 1; seed < 80; seed++) {
      const q = makeQuestion("squares", 1 + (seed % 10), seeded(seed));
      expect(new Set(q.choices).size).toBe(4);
      expect(q.choices.filter((c) => q.check(c).correct)).toHaveLength(1);
    }
  });
  test("take back: the right pieces are among the choices", () => {
    for (let seed = 1; seed < 40; seed++) {
      const q = makeQuestion("recapture", 3, seeded(seed));
      expect(q.choices.some((c) => q.check(c).correct)).toBe(true);
    }
  });
  test("a move tapped from-square then to-square", () => {
    const q = makeQuestion("mate", 1, seeded(5));
    const eng = createEngine(); eng.loadFen(q.fen);
    const name = (i120) => { const t = M120TO64[i120]; return "abcdefgh"[t % 8] + (((t / 8) | 0) + 1); };
    const mate = eng.legalMoves().find((x) => eng.sanOf(x) === q.answer);
    expect(q.check(name(mFrom(mate)) + name(mTo(mate))).correct).toBe(true);
    const other = eng.legalMoves().find((x) => !eng.sanOf(x).includes("#"));
    expect(q.check(name(mFrom(other)) + name(mTo(other))).correct).toBe(false);
  });
  test("find the square", () => {
    const q = makeQuestion("coords", 1, seeded(2));
    expect(q.check(q.target).correct).toBe(true);
    expect(q.check(q.target === "e4" ? "d5" : "e4").correct).toBe(false);
  });
});
