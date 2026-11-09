import { describe, test, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { COURSES } from "./openingCourses";
import { NOTES } from "./openingNotes";
import { createEngine } from "../engine/chessEngine";

/* Plays SAN moves from the start; returns null if one isn't legal. */
function play(moves) {
  const eng = createEngine();
  for (const san of moves) {
    const m = eng.legalMoves().find((x) => eng.sanOf(x) === san);
    if (m === undefined) return null;
    eng.make(m);
  }
  return eng;
}
const tree = (id) => {
  const file = new URL(`./openings/${id}.json`, import.meta.url);
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
};

describe("Opening Trainer notes", () => {
  test("every course has notes with a summary, idea steps and a plan", () => {
    for (const c of COURSES) {
      const n = NOTES[c.id];
      expect(n, c.id).toBeTruthy();
      expect(n.summary, c.id).toBeTruthy();
      expect(n.idea.length, c.id).toBeGreaterThan(0);
      expect(n.plan, c.id).toBeTruthy();
    }
  });

  test("every course root is legal", () => {
    for (const c of COURSES) expect(play(c.root.split(" ")), c.id).not.toBe(null);
  });

  test("every idea step is legal from its course's root", () => {
    for (const c of COURSES) {
      for (const s of NOTES[c.id].idea) {
        const moves = [...c.root.split(" "), ...(s.moves ? s.moves.split(" ") : [])];
        expect(play(moves), `${c.id}: ${s.moves}`).not.toBe(null);
      }
    }
  });

  test("every move note sits on a position the course's tree reaches", () => {
    for (const c of COURSES) {
      const data = tree(c.id);
      const notes = NOTES[c.id].moves ?? {};
      if (!data) continue;
      const known = new Set();
      for (const nodes of Object.values(data.lines)) {
        for (const [key, node] of Object.entries(nodes)) {
          known.add(key);
          if (node.p) known.add(`${key} ${node.p.rep}`);
          if (node.o) for (const san of Object.keys(node.o.r)) known.add(`${key} ${san}`);
          for (const [san, pv] of Object.entries(node.o?.punish ?? {})) known.add(`${key} ${san} ${pv[0]}`);
        }
      }
      for (const key of Object.keys(notes)) expect(known.has(key), `${c.id}: ${key}`).toBe(true);
    }
  });
});
