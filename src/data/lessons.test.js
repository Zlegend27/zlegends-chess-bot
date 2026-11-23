import { describe, test, expect } from "vitest";
import { createEngine } from "../engine/chessEngine";
import { LESSONS } from "./lessons";

/* Every lesson is replayed move by move: a typo in a move list or a puzzle
   answer would otherwise only show up as a lesson that silently stops. */
const at = (chapter, ply, extra = []) => {
  const e = createEngine();
  if (chapter.startFen) e.loadFen(chapter.startFen); else e.reset();
  for (const san of [...chapter.mainLine.slice(0, ply), ...extra]) {
    const m = e.legalMoves().find((x) => e.sanOf(x) === san);
    if (!m) throw new Error(`${chapter.title}: "${san}" is not legal`);
    e.make(m);
  }
  return e;
};

for (const lesson of LESSONS) {
  describe(lesson.title, () => {
    for (const chapter of lesson.chapters.filter((c) => !c.comingSoon)) {
      test(chapter.title, () => {
        at(chapter, chapter.mainLine.length);
        for (const beat of chapter.beats) {
          expect(beat.afterPly).toBeLessThanOrEqual(chapter.mainLine.length);
          if (beat.type === "playthrough") expect(beat.toPly ?? chapter.mainLine.length).toBeLessThanOrEqual(chapter.mainLine.length);
          if (beat.type === "puzzle") at(chapter, beat.afterPly, beat.solution);
          if (beat.type === "think" && beat.ideaMove) at(chapter, beat.afterPly, [beat.ideaMove]);
          if (beat.type === "branch") for (const o of beat.options) at(chapter, beat.afterPly, o.line);
        }
      });
    }
  });
}

test("the beginner course comes first and every chapter is ready", () => {
  expect(LESSONS[0].id).toBe("how-to-play");
  expect(LESSONS[0].chapters.every((c) => !c.comingSoon)).toBe(true);
});
