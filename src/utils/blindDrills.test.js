import { describe, test, expect } from "vitest";
import { DRILLS, makeQuestion, recordAnswer, emptyProgress, reachOf, MAX_LEVEL, _internal } from "./blindDrills";
import { createEngine } from "../engine/chessEngine";

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
    });
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
