import { describe, test, expect } from "vitest";
import { NEW_STORY, afterOpening, isHard, redEyes, bondsOpen, hardLocked, canSwitchHard, setHardSwitch, resetBond, beatStory } from "./story";

describe("the bond question", () => {
  test("a new player hasn't seen the opening and has no bond yet", () => {
    expect(NEW_STORY).toEqual({ seen: false, bond: null, hardSwitch: false, beaten: false });
    expect(isHard(NEW_STORY)).toBe(false);
    expect(bondsOpen(NEW_STORY)).toBe(true);
  });

  test("saying yes makes the bond, with nothing hard about it", () => {
    const s = afterOpening(NEW_STORY, "yes");
    expect(s).toMatchObject({ seen: true, bond: "yes" });
    expect([isHard(s), redEyes(s), bondsOpen(s)]).toEqual([false, false, true]);
  });

  test("refusing twice turns on hard mode, red eyes, and closes bonds", () => {
    const s = afterOpening(NEW_STORY, "refused");
    expect([isHard(s), redEyes(s), bondsOpen(s), hardLocked(s)]).toEqual([true, true, false, true]);
  });

  test("skipping a rewatch changes nothing but marks it seen", () => {
    const refused = afterOpening(NEW_STORY, "refused");
    expect(afterOpening({ ...refused, seen: false }, null)).toEqual(refused);
  });

  test("watching again and saying yes makes the bond after all", () => {
    const s = afterOpening(afterOpening(NEW_STORY, "refused"), "yes");
    expect([isHard(s), bondsOpen(s)]).toEqual([false, true]);
  });
});

describe("hard mode", () => {
  test("the switch unlocks on reaching the second world", () => {
    expect([0, 1, 3].map(canSwitchHard)).toEqual([false, true, true]);
  });

  test("the switch gives red eyes but keeps bonds, and can be turned off again", () => {
    const on = setHardSwitch(afterOpening(NEW_STORY, "yes"), true);
    expect([isHard(on), redEyes(on), bondsOpen(on), hardLocked(on)]).toEqual([true, true, true, false]);
    expect(isHard(setHardSwitch(on, false))).toBe(false);
  });

  test("a refused bond keeps hard mode on whatever the switch says", () => {
    expect(isHard(setHardSwitch(afterOpening(NEW_STORY, "refused"), false))).toBe(true);
  });

  test("the reset asks the question again, opening and all", () => {
    expect(resetBond(afterOpening(NEW_STORY, "refused"))).toMatchObject({ bond: null, seen: false });
    expect(isHard(resetBond(afterOpening(NEW_STORY, "refused")))).toBe(false);
  });

  test("beating the story mends a refused bond and leaves a made one alone", () => {
    expect(beatStory(afterOpening(NEW_STORY, "refused"))).toMatchObject({ beaten: true, bond: "yes" });
    expect(beatStory(afterOpening(NEW_STORY, "yes"))).toMatchObject({ beaten: true, bond: "yes" });
    expect(beatStory(NEW_STORY).bond).toBeNull();
  });
});
