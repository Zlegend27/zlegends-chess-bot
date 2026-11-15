import { expect, test } from "vitest";
import { cleanName, nameIsClean } from "./cleanName";

test("ordinary names pass", () => {
  for (const name of ["Zlegend", "Magnus", "Knight Rider", "Bishop 42", "Cassandra", "Sharpshooter"]) {
    expect(nameIsClean(name)).toBe(true);
  }
});

test("blocked words are caught through case, spacing, repeats and digit swaps", () => {
  for (const name of ["FUCK", "f u c k", "fuuuuck you", "sh1t", "b!tch", "n1gg3r", "xXh1tl3rXx"]) {
    expect(nameIsClean(name)).toBe(false);
  }
});

test("an unclean name is shown as the fallback; empty stays empty", () => {
  expect(cleanName("sh1thead")).toBe("Player");
  expect(cleanName("Zlegend")).toBe("Zlegend");
  expect(cleanName("")).toBe("");
  expect(cleanName(null)).toBe(null);
});
