import { describe, test, expect } from "vitest";
import { playersFrom, tablesFrom, holdsSeat, matchAt, clockText } from "./lobby";

const player = (id, seat = null, extra = {}) => ({ id, name: id, seat, tc: "5+0", joinedAt: 1, ...extra });

describe("the lobby", () => {
  test("a player with two tabs open counts once, as their latest state", () => {
    const state = { a: [player("a"), player("a", { table: 0, side: 0, at: 5 })], b: [player("b")] };
    const players = playersFrom(state);
    expect(players.map((p) => p.id)).toEqual(["a", "b"]);
    expect(players[0].seat.table).toBe(0);
  });

  test("two players clicking the same seat: the first claim keeps it", () => {
    const early = player("early", { table: 1, side: 0, at: 100 });
    const late = player("late", { table: 1, side: 0, at: 105 });
    const tables = tablesFrom([late, early]);
    expect(tables[1].seats[0].id).toBe("early");
    expect(holdsSeat(early, tables)).toBe(true);
    expect(holdsSeat(late, tables)).toBe(false);
    expect(tables[1].full).toBe(false);
  });

  test("a full table starts a match both players agree on", () => {
    const a = player("aaaaaaaa-1", { table: 2, side: 0, at: 10 }, { tc: "3+2" });
    const b = player("bbbbbbbb-2", { table: 2, side: 1, at: 20 }, { tc: "10+0" });
    const table = tablesFrom([a, b])[2];
    expect(table.full).toBe(true);
    expect(table.tc).toBe("3+2"); // set by whoever sat first
    const fromA = matchAt(tablesFrom([a, b])[2]);
    const fromB = matchAt(tablesFrom([b, a])[2]);
    expect(fromA).toEqual(fromB);
    expect([fromA.white.id, fromA.black.id].sort()).toEqual(["aaaaaaaa-1", "bbbbbbbb-2"]);
  });

  test("a half-empty table has no match", () => {
    expect(matchAt(tablesFrom([player("solo", { table: 0, side: 1, at: 1 })])[0])).toBeNull();
  });
});

test("clocks read like a chess clock", () => {
  expect(clockText(245_000)).toBe("4:05");
  expect(clockText(9_340)).toBe("0:09.3");
  expect(clockText(-50)).toBe("0:00.0");
  expect(clockText(null)).toBe("–");
});
