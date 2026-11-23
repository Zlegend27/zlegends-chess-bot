import { describe, test, expect } from "vitest";
import { pathForView, viewForPath, sectionForView, historyStep } from "./routes";

describe("page addresses", () => {
  test.each(["home", "playHub", "play", "puzzlesHome", "leaderboard", "review", "lessons", "openings", "watch", "ranked", "rush", "profile"])("%s survives a refresh", (view) => {
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

/* vercel.json lists the app's addresses (anything else gets the real
   404 page), so a page added to routes.js must be added there too. */
import { readFileSync } from "node:fs";
import { ALL_PATHS } from "./routes";
describe("the host serves every page", () => {
  const config = JSON.parse(readFileSync(new URL("../../vercel.json", import.meta.url), "utf8"));
  const served = (path) => path === "/" || config.rewrites.some((r) => r.destination === "/" && new RegExp(`^${r.source.replace(/:\w+/g, "[^/]+")}$`).test(path));
  test.each(ALL_PATHS)("%s", (path) => {
    expect(served(path)).toBe(true);
    if (path !== "/") expect(served(path + "/")).toBe(true);
  });
  test("an unknown address is not sent to the app", () => {
    expect(served("/nope")).toBe(false);
  });
});

describe("opening pages", () => {
  test("every trainer course has its own address, which opens Learn", async () => {
    const { COURSES } = await import("../data/openingCourses");
    const { coursePath, courseForPath } = await import("../data/openingPages");
    const paths = COURSES.map((c) => coursePath(c.id));
    expect(paths.every(Boolean)).toBe(true);
    expect(new Set(paths).size).toBe(COURSES.length);
    for (const c of COURSES) {
      expect(courseForPath(coursePath(c.id))?.id).toBe(c.id);
      expect(viewForPath(coursePath(c.id))).toBe("lessons");
    }
    expect(viewForPath("/openings/vienna-game/")).toBe("lessons");
  });
  test("an unknown opening is not a course", async () => {
    const { courseForPath } = await import("../data/openingPages");
    expect(courseForPath("/openings/bongcloud")).toBe(null);
    expect(viewForPath("/openings/bongcloud")).toBe("home");
  });
  test("each opening gets a prerendered page with real text", async () => {
    const { SEO_PAGES, LINK_TEXT } = await import("../data/seoPages");
    const { OPENING_PATHS } = await import("../data/openingPages");
    for (const path of OPENING_PATHS) {
      const page = SEO_PAGES.find((p) => p.path === path);
      expect(page).toBeTruthy();
      expect(page.intro.join(" ").length).toBeGreaterThan(400);
      expect(page.description.length).toBeLessThanOrEqual(170);
      expect(LINK_TEXT[path]).toBeTruthy();
    }
  });
});
