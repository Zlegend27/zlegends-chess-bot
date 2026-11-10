import { describe, test, expect } from "vitest";
import { createEngine } from "../src/engine/chessEngine";
import { KID_COURSES } from "./kidOpeningCourses";
import { CAMP_NOTES } from "./kidCampNotes";
import {
  CAMP_TREES, CAMP_OPPONENTS, kidShares, kidPick, kidMainLine, kidScenarios, playerNode,
  emptyCamp, updateCourse, courseStars, rememberMove, dueMoves, inTen,
} from "./kidCamp";

function play(moves) {
  const eng = createEngine();
  for (const san of moves) {
    const m = eng.legalMoves().find((x) => eng.sanOf(x) === san);
    if (m === undefined) return null;
    eng.make(m);
  }
  return eng;
}

describe("Opening Camp", () => {
  test("every course has a tree, notes, a story and a plan", () => {
    for (const c of KID_COURSES) {
      expect(CAMP_TREES[c.id], c.id).toBeTruthy();
      expect(CAMP_NOTES[c.id].story.length, c.id).toBeGreaterThan(2);
      expect(CAMP_NOTES[c.id].plan, c.id).toBeTruthy();
    }
  });

  test("story steps are legal from the root", () => {
    for (const c of KID_COURSES) {
      for (const s of CAMP_NOTES[c.id].story) {
        const moves = [...c.root.split(" "), ...(s.moves ? s.moves.split(" ") : [])];
        expect(play(moves), `${c.id}: ${s.moves}`).not.toBe(null);
      }
    }
  });

  test("every note sits on a position the course reaches", () => {
    for (const c of KID_COURSES) {
      const nodes = CAMP_TREES[c.id];
      const known = new Set();
      for (const [key, node] of Object.entries(nodes)) {
        known.add(key);
        if (node.p) known.add(`${key} ${node.p.rep}`);
        if (node.o) for (const san of Object.keys(node.o.r)) known.add(`${key} ${san}`);
        for (const [san, pv] of Object.entries(node.o?.punish ?? {})) known.add(`${key} ${san} ${pv[0]}`);
      }
      for (const key of Object.keys(CAMP_NOTES[c.id].notes)) expect(known.has(key), `${c.id}: ${key}`).toBe(true);
    }
  });

  test("the Vienna is the gambit: f4 against ...Nc6 and ...Nf6", () => {
    const nodes = CAMP_TREES["kid-vienna"];
    expect(playerNode(nodes, ["e4", "e5", "Nc3", "Nc6"]).p.rep).toBe("f4");
    expect(playerNode(nodes, ["e4", "e5", "Nc3", "Nf6"]).p.rep).toBe("f4");
    const line = kidMainLine(nodes, ["e4", "e5", "Nc3"]);
    expect(line.slice(3, 5)).toEqual(["Nc6", "f4"]);
  });

  test("1...e5 meets the Italian with the Two Knights and never takes the Fried Liver bait", () => {
    const nodes = CAMP_TREES["kid-e5"];
    expect(playerNode(nodes, ["e4", "e5", "Nf3"]).p.rep).toBe("Nc6");
    expect(playerNode(nodes, ["e4", "e5", "Nf3", "Nc6", "Bc4"]).p.rep).toBe("Nf6");
    expect(playerNode(nodes, ["e4", "e5", "Nf3", "Nc6", "Bc4", "Nf6", "Ng5", "d5", "exd5"]).p.rep).toBe("Na5");
  });

  test("opponents blend the bands, and picks follow the shares", () => {
    const node = { o: { r: { a: [9, 0, 0], b: [1, 10, 0] } } };
    const [bunny, cat, dog] = CAMP_OPPONENTS;
    expect(kidShares(node, bunny.weights)[0].san).toBe("a");
    expect(kidShares(node, dog.weights).map((r) => r.san)).toEqual(["b"]);
    expect(kidShares(node, cat.weights)[0].san).toBe("b");
    expect(kidPick(node, bunny.weights, () => 0.05)).toBe("a");
    expect(kidPick(node, bunny.weights, () => 0.95)).toBe("b");
  });

  test("What If? cards all have an answer, traps first", () => {
    for (const c of KID_COURSES) {
      const list = kidScenarios(CAMP_TREES[c.id], c.root.split(" "));
      expect(list.length, c.id).toBeGreaterThan(2);
      for (const s of list) expect(play([...s.at, s.reply, s.answer]), `${c.id}: ${s.key}`).not.toBe(null);
      const firstNonTrap = list.findIndex((s) => !s.mistake);
      expect(list.slice(firstNonTrap).every((s) => !s.mistake)).toBe(true);
    }
    expect(inTen(0.35)).toBe(4);
    expect(inTen(0.01)).toBe(1);
  });

  test("course stars and the Memory Game", () => {
    let s = emptyCamp();
    expect(courseStars(s, "kid-vienna", 3)).toBe(0);
    s = updateCourse(s, "kid-vienna", () => ({ story: true, copycat: 2 }));
    expect(courseStars(s, "kid-vienna", 3)).toBe(1);
    s = updateCourse(s, "kid-vienna", (c) => ({ whatIf: [...c.whatIf, "a", "b", "c"] }));
    expect(courseStars(s, "kid-vienna", 3)).toBe(2);
    s = updateCourse(s, "kid-vienna", (c) => ({ practice: { ...c.practice, cat: true } }));
    expect(courseStars(s, "kid-vienna", 3)).toBe(3);
    s = rememberMove(s, "kid-vienna", ["e4", "e5", "Nc3", "Nc6"], false, 100);
    expect(dueMoves(s, 100)).toEqual([]);
    expect(dueMoves(s, 101)).toEqual(["kid-vienna|main|e4 e5 Nc3 Nc6"]);
  });
});
