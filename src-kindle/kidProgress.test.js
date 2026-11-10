import { describe, test, expect } from "vitest";
import { emptyProgress, record, questsFor, liveStreak, chestReady, openChest, prevDayKey, dayKey, reportCode, QUESTS, setStars, addPalXp, palLevel } from "./kidProgress";

const MON = "2026-11-09", TUE = "2026-11-10", THU = "2026-11-12";

describe("Kinnda progress and quests", () => {
  test("day keys roll over months and years", () => {
    expect(prevDayKey("2026-03-01")).toBe("2026-02-28");
    expect(prevDayKey("2027-01-01")).toBe("2026-12-31");
    expect(dayKey(new Date(2026, 10, 10))).toBe("2026-11-10");
  });

  test("three quests a day, stable all day: a learning one, a thinking one and a game", () => {
    const q = questsFor(emptyProgress(), TUE);
    expect(q.map((x) => x.id)).toEqual(questsFor(emptyProgress(), TUE).map((x) => x.id));
    expect(q[0].id).toBe("lesson");
    expect(["puzzles", "daily", "rush"]).toContain(q[1].id);
    expect(q[2].id).toBe("game");
    expect(q.every((x) => !x.complete && x.done === 0)).toBe(true);
  });

  test("quests count what she did today", () => {
    let s = emptyProgress();
    s = record(s, { type: "puzzle", solved: true }, TUE);
    s = record(s, { type: "puzzle", solved: false, themes: ["fork"] }, TUE);
    s = record(s, { type: "game", opponent: "cat", result: "win", moves: 30 }, TUE);
    const game = questsFor(s, TUE).find((q) => q.id === "game");
    expect(game.complete).toBe(true);
    expect(s.days[TUE].puzzles).toEqual({ solved: 1, missed: 1, themesMissed: { fork: 1 } });
  });

  test("any one quest keeps the streak; a missed day restarts it", () => {
    let s = emptyProgress();
    s = record(s, { type: "game", opponent: "cat", result: "loss" }, MON);
    expect(s.streak).toEqual({ count: 1, best: 1, last: MON });
    s = record(s, { type: "game", opponent: "cat", result: "win" }, TUE);
    expect(s.streak.count).toBe(2);
    expect(liveStreak(s, TUE)).toBe(2);
    expect(liveStreak(s, "2026-11-11")).toBe(2);
    expect(liveStreak(s, THU)).toBe(0);
    s = record(s, { type: "game", opponent: "cat", result: "win" }, THU);
    expect(s.streak).toEqual({ count: 1, best: 2, last: THU });
  });

  test("an Adventure level or camp step counts for the lesson quest", () => {
    const s = record(emptyProgress(), { type: "level", id: "piece-park-1", stars: 3 }, TUE);
    expect(questsFor(s, TUE)[0].complete).toBe(true);
    expect(s.days[TUE].levels).toEqual([{ id: "piece-park-1", stars: 3 }]);
  });

  test("time alone doesn't keep a streak", () => {
    const s = record(emptyProgress(), { type: "time", seconds: 600 }, TUE);
    expect(s.streak.count).toBe(0);
    expect(s.days[TUE].seconds).toBe(600);
  });

  test("the chest opens once, after all three quests", () => {
    let s = emptyProgress();
    const [learn, think] = questsFor(s, TUE);
    expect(chestReady(s, TUE)).toBe(false);
    s = record(s, { type: "lesson", id: "vienna" }, TUE);
    for (let i = 0; i < QUESTS[think.id].need; i++) {
      s = record(s, think.id === "puzzles" ? { type: "puzzle", solved: true } : think.id === "daily" ? { type: "daily" } : { type: "rush", seconds: 60, solved: 4 }, TUE);
    }
    expect(learn.id).toBe("lesson");
    expect(chestReady(s, TUE)).toBe(false);
    s = record(s, { type: "game", opponent: "bunny", result: "draw" }, TUE);
    expect(chestReady(s, TUE)).toBe(true);
    s = openChest(s, TUE);
    expect(chestReady(s, TUE)).toBe(false);
    expect(openChest(s, TUE)).toBe(s);
  });

  test("old days are dropped and the report code reads back", () => {
    let s = record(emptyProgress(), { type: "game", opponent: "cat", result: "win" }, "2026-08-01");
    s = record(s, { type: "lesson", id: "vienna" }, TUE);
    expect(Object.keys(s.days)).toEqual([TUE]);
    const code = reportCode(s, { winsByAnimal: { cat: 3 }, completedLessons: ["vienna"] }, TUE);
    expect(code.startsWith("KINNDA-PROGRESS ")).toBe(true);
    const report = JSON.parse(code.slice("KINNDA-PROGRESS ".length));
    expect(report.days[0].day).toBe(TUE);
    expect(report.winsByAnimal.cat).toBe(3);
  });

  test("stars keep the best score", () => {
    let s = setStars(emptyProgress(), "park-rook", 2);
    s = setStars(s, "park-rook", 1);
    expect(s.stars["park-rook"]).toBe(2);
    expect(setStars(s, "park-rook", 3).stars["park-rook"]).toBe(3);
  });

  test("Piece Pals level up", () => {
    expect(palLevel(0)).toBe(1);
    expect(palLevel(40)).toBe(2);
    expect(palLevel(10000)).toBe(5);
    let r = addPalXp(emptyProgress(), 2, 30);
    expect(r.levelUp).toBe(0);
    r = addPalXp(r.state, 2, 15);
    expect(r.levelUp).toBe(2);
    expect(r.state.pals.knight).toBe(45);
    expect(addPalXp(r.state, 9, 10).levelUp).toBe(0);
  });
});
