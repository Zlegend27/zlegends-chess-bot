import { describe, test, expect } from "vitest";
import { pathForView, viewForPath, sectionForView, historyStep } from "./routes";

describe("page addresses", () => {
  test.each(["home", "playHub", "play", "puzzlesHome", "leaderboard", "review", "lessons", "openings", "watch", "ranked", "rush"])("%s survives a refresh", (view) => {
    expect(viewForPath(pathForView(view))).toBe(view);
  });

  test("a trailing slash still finds the page", () => {
    expect(viewForPath("/puzzles/")).toBe("puzzlesHome");
  });

  test("an unknown address opens Home", () => {
    expect(viewForPath("/nope")).toBe("home");
  });
});

describe("the highlighted menu item", () => {
  test("follows the page", () => {
    expect(sectionForView({ siteView: "leaderboard" })).toBe("puzzles");
    expect(sectionForView({ siteView: "lessons" })).toBe("learn");
    expect(sectionForView({ siteView: "playHub" })).toBe("play");
    expect(sectionForView({ siteView: "watch" })).toBe("play");
    expect(sectionForView({ siteView: "openings" })).toBe("learn");
    expect(sectionForView({ siteView: "rush" })).toBe("puzzles");
  });

  test("stays on the section when its activity runs on the Play screen", () => {
    expect(sectionForView({ siteView: "play" })).toBe("play");
    expect(sectionForView({ siteView: "play", rushMode: true })).toBe("puzzles");
    expect(sectionForView({ siteView: "play", activePuzzle: {} })).toBe("puzzles");
    expect(sectionForView({ siteView: "play", pastedGame: true })).toBe("review");
  });
});

describe("back swipes", () => {
  test("leaving Home adds the one back step", () => {
    expect(historyStep("puzzlesHome", false)).toBe("push");
  });

  test("moving between sections doesn't add another", () => {
    expect(historyStep("lessons", true)).toBe("replace");
  });

  test("returning Home uses that step up", () => {
    expect(historyStep("home", true)).toBe("back");
  });
});
