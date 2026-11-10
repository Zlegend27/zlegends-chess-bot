import { describe, test, expect } from "vitest";
import { createEngine } from "../src/engine/chessEngine";
import { ISLANDS, levelStars, islandStars, islandOpen, currentIsland, totalStars } from "./kidAdventure";
import { KID_LESSON_CHAPTERS } from "./kidLessons";
import { KID_COURSES } from "./kidOpeningCourses";
import { starPar, sq } from "./kidMini";
import { goodCapture, badCapture, isCapture, checkOf } from "./kidRules";
import drills from "./kidDrills.json";
import puzzlesData from "../src/utils/puzzles-lichess.json";

const levels = ISLANDS.flatMap((i) => i.levels);

describe("Owl's Adventure", () => {
  test("level ids are unique and islands open in order", () => {
    expect(new Set(levels.map((l) => l.id)).size).toBe(levels.length);
    for (let i = 1; i < ISLANDS.length; i++) expect(ISLANDS[i].needs).toBeGreaterThan(ISLANDS[i - 1].needs);
  });

  test("every lesson and camp course exists, and every lesson chapter is on the map", () => {
    const chapters = new Set(KID_LESSON_CHAPTERS.filter((c) => !c.comingSoon).map((c) => c.id));
    for (const l of levels.filter((x) => x.type === "lesson")) expect(chapters.has(l.chapter), l.id).toBe(true);
    for (const c of chapters) expect(levels.some((l) => l.chapter === c), c).toBe(true);
    for (const l of levels.filter((x) => x.type === "camp")) expect(KID_COURSES.some((c) => c.id === l.course), l.id).toBe(true);
  });

  test("every star hunt can be finished", () => {
    for (const l of levels.filter((x) => x.type === "stars")) {
      for (const r of l.rounds) {
        expect(starPar(r.piece, sq(r.start), r.stars.map(sq), (r.rocks ?? []).map(sq)), `${l.id} ${r.start}`).toBeGreaterThan(0);
      }
    }
  });

  test("puzzle levels have enough puzzles at their rating", () => {
    for (const l of levels.filter((x) => x.type === "puzzles")) {
      const pool = puzzlesData.puzzles.filter((p) => p.rating < l.max && p.themes.some((t) => l.themes.includes(t)));
      expect(pool.length, l.id).toBeGreaterThanOrEqual(l.count);
    }
  });

  test("drill positions have the answers they promise", () => {
    const eng = createEngine();
    for (const fen of drills.freeLunch) {
      eng.loadFen(fen);
      const caps = eng.legalMoves().filter((m) => isCapture(eng, m));
      expect(caps.filter((m) => goodCapture(eng, m)).length, fen).toBe(1);
    }
    for (const fen of drills.careful) {
      eng.loadFen(fen);
      const caps = eng.legalMoves().filter((m) => isCapture(eng, m));
      expect(caps.some((m) => goodCapture(eng, m)) && caps.some((m) => badCapture(eng, m)), fen).toBe(true);
    }
    for (const fen of drills.giveCheck) {
      eng.loadFen(fen);
      const checks = eng.legalMoves().map((m) => checkOf(eng, m)).filter((c) => c.check);
      expect(checks.length > 0 && !checks.some((c) => c.mate), fen).toBe(true);
    }
    for (const l of levels.filter((x) => x.type === "drill")) expect(drills[l.set].length, l.id).toBeGreaterThanOrEqual(l.count);
  });

  test("endgame positions are legal with White to move", () => {
    const eng = createEngine();
    for (const l of levels.filter((x) => x.type === "endgame")) {
      eng.loadFen(l.fen);
      expect(eng.getSide(), l.id).toBe(1);
      expect(eng.legalMoves().length, l.id).toBeGreaterThan(0);
    }
  });

  test("stars add up and open the next island", () => {
    const ctx = { stars: {}, completedLessons: [] };
    expect(currentIsland(ctx).id).toBe("park");
    expect(islandOpen(ISLANDS[1], ctx)).toBe(false);
    const park = ISLANDS[0];
    ctx.stars = { "park-how": 3, "park-rook": 1 };
    expect(islandStars(park, ctx)).toBe(4);
    expect(islandOpen(ISLANDS[1], ctx)).toBe(true);
    ctx.completedLessons = ["vienna"];
    expect(levelStars(ISLANDS[3].levels[1], ctx)).toBe(3);
    expect(totalStars(ctx)).toBe(7);
  });
});
