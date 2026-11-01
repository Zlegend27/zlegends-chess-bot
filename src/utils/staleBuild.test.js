import { describe, test, expect } from "vitest";
import { isStaleBuildError } from "./staleBuild";

describe("spotting an out-of-date build", () => {
  test.each([
    ["Failed to fetch dynamically imported module: https://x/assets/a.js"],
    ["error loading dynamically imported module"],
    ["Importing a module script failed."],
  ])("%s", (message) => {
    expect(isStaleBuildError(new Error(message))).toBe(true);
  });

  test("other errors don't count", () => {
    expect(isStaleBuildError(new Error("Cannot read properties of undefined"))).toBe(false);
    expect(isStaleBuildError(null)).toBe(false);
  });
});
