import { describe, it, expect } from "vitest";
import { mergeProgress, accountProgress } from "./accountSync.js";

const base = (over = {}) => ({ story: { seen: false, bond: null, hardSwitch: false, beaten: false }, bonds: {}, reached: 0, runBest: 0, blitzBest: 0, at: 0, ...over });

describe("mergeProgress", () => {
  it("keeps the most of every number and every bond", () => {
    const a = base({ bonds: { pawn: 40, rook: 5 }, reached: 2, runBest: 900, blitzBest: 12, at: 10 });
    const b = base({ bonds: { pawn: 10, knight: 30 }, reached: 1, runBest: 1200, blitzBest: 8, at: 5 });
    const m = mergeProgress(a, b);
    expect(m.bonds).toEqual({ pawn: 40, rook: 5, knight: 30 });
    expect(m).toMatchObject({ reached: 2, runBest: 1200, blitzBest: 12, at: 10 });
  });

  it("keeps story moments either side reached", () => {
    const a = base({ story: { seen: true, bond: null, hardSwitch: false, beaten: false } });
    const b = base({ story: { seen: false, bond: null, hardSwitch: false, beaten: true } });
    expect(mergeProgress(a, b).story).toMatchObject({ seen: true, beaten: true });
  });

  it("takes the newer side's bond answer and hard mode switch", () => {
    const old = base({ story: { seen: true, bond: "refused", hardSwitch: true, beaten: false }, at: 1 });
    const now = base({ story: { seen: true, bond: "yes", hardSwitch: false, beaten: false }, at: 2 });
    expect(mergeProgress(old, now).story).toMatchObject({ bond: "yes", hardSwitch: false });
    expect(mergeProgress(now, old).story).toMatchObject({ bond: "yes", hardSwitch: false });
  });

  it("falls back to the older answer when the newer side was never asked", () => {
    const old = base({ story: { seen: true, bond: "yes", hardSwitch: false, beaten: false }, at: 1 });
    const now = base({ at: 2 });
    expect(mergeProgress(old, now).story.bond).toBe("yes");
  });

  it("returns the other side when one is missing", () => {
    const a = base({ reached: 3 });
    expect(mergeProgress(a, null)).toBe(a);
    expect(mergeProgress(null, a)).toBe(a);
  });
});

describe("accountProgress", () => {
  it("is null without saved progress", () => {
    expect(accountProgress(null)).toBeNull();
    expect(accountProgress({ user: { user_metadata: {} } })).toBeNull();
  });

  it("cleans up what the account holds", () => {
    const p = accountProgress({ user: { user_metadata: { zl_tactica: { story: { seen: true, bond: "maybe" }, bonds: { pawn: 12.6, rook: -3, x: "a" }, reached: "2", runBest: 50.4, at: 7 } } } });
    expect(p.story).toEqual({ seen: true, bond: null, hardSwitch: false, beaten: false });
    expect(p.bonds).toEqual({ pawn: 13 });
    expect(p).toMatchObject({ reached: 2, runBest: 50, blitzBest: 0, at: 7 });
  });
});
