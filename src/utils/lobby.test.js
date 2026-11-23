import { describe, test, expect } from "vitest";
import { playersFrom, tablesFrom, holdsSeat, matchAt, clockText, eloChange, rematchOf } from "./lobby";

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

describe("ranked tables", () => {
  const seat = (id, table, side, at, extra = {}) => ({ id, seat: { table, side, at }, tc: "5+0", ...extra });

  test("whoever sat first decides whether the table is ranked", () => {
    const tables = tablesFrom([seat("aaaaaaaa-1", 0, 0, 1, { ranked: true }), seat("bbbbbbbb-2", 0, 1, 2, { ranked: false })]);
    expect(tables[0].ranked).toBe(true);
    expect(matchAt(tables[0]).ranked).toBe(true);
  });

  test("a table with a local development guest is never ranked", () => {
    const tables = tablesFrom([seat("guest-1234", 0, 0, 1, { ranked: true }), seat("bbbbbbbb-2", 0, 1, 2)]);
    expect(matchAt(tables[0]).ranked).toBe(false);
  });

  test("rating moves by the Elo rule: more for an upset, nothing lost by both sides in total", () => {
    expect(eloChange(1000, 1000, 1)).toBe(12);
    expect(eloChange(1000, 1000, 0)).toBe(-12);
    expect(eloChange(1000, 1000, 0.5)).toBe(0);
    expect(eloChange(1000, 1400, 1)).toBeGreaterThan(eloChange(1400, 1000, 1));
    /* Someone unrated counts as 1000. */
    expect(eloChange(null, null, 1)).toBe(12);
  });

  test("a rematch swaps colours and keeps both players' ids in its name", () => {
    const first = { id: "t0-5-aaaaaaaa-bbbbbbbb", white: { id: "a" }, black: { id: "b" }, tc: "5+0", ranked: true };
    const second = rematchOf(first);
    expect(second).toMatchObject({ id: "t0-5-aaaaaaaa-bbbbbbbb-r1", white: { id: "b" }, black: { id: "a" }, ranked: true });
    expect(rematchOf(second).id).toBe("t0-5-aaaaaaaa-bbbbbbbb-r2");
  });
});

import { tableById, tableOfSeat, inviteTableId, newInviteCode, cleanInviteCode, isInviteTable } from "./lobby";
describe("invite links", () => {
  const inv = inviteTableId("k3x9mnp2qr");
  test("a private table isn't one of the listed tables", () => {
    const host = player("hosthost-1", { table: inv, side: 0, at: 10 });
    expect(tablesFrom([host]).every((t) => t.seats.every((s) => s === null))).toBe(true);
    expect(tableById([host], inv).seats[0].id).toBe("hosthost-1");
  });
  test("the friend joining fills it, and both agree on the match", () => {
    const host = player("hosthost-1", { table: inv, side: 0, at: 10 }, { tc: "3+2" });
    const friend = player("friendxx-2", { table: inv, side: 1, at: 50 }, { tc: "10+0" });
    const table = tableById([host, friend], inv);
    expect(table.full).toBe(true);
    expect(table.tc).toBe("3+2"); // the host's clock
    expect(matchAt(table)).toEqual(matchAt(tableById([friend, host], inv)));
    /* Both players' ids are in the match id: the database lets only them in. */
    expect(matchAt(table).id).toContain("hosthost");
    expect(matchAt(table).id).toContain("friendxx");
  });
  test("a third person with the same link loses the seat", () => {
    const host = player("hosthost-1", { table: inv, side: 0, at: 10 });
    const friend = player("friendxx-2", { table: inv, side: 1, at: 50 });
    const late = player("latelate-3", { table: inv, side: 1, at: 60 });
    const players = [host, late, friend];
    expect(holdsSeat(friend, tablesFrom(players), players)).toBe(true);
    expect(holdsSeat(late, tablesFrom(players), players)).toBe(false);
    expect(tableOfSeat(late.seat, tablesFrom(players), players).id).toBe(inv);
  });
  test("codes are fresh and only our own shape is accepted from a link", () => {
    const a = newInviteCode(), b = newInviteCode();
    expect(a).not.toBe(b);
    expect(cleanInviteCode(a)).toBe(a);
    expect(cleanInviteCode("<script>")).toBeNull();
    expect(cleanInviteCode(null)).toBeNull();
    expect(isInviteTable(2)).toBe(false);
    expect(isInviteTable(inv)).toBe(true);
  });
});

import { openSeeks, matchingSeek, olderTwin, seekTableId, isSeekTable } from "./lobby";
describe("seeks (Play in the lobby)", () => {
  const seeker = (id, at, extra = {}) => player(id, { table: `seek-${id}`, side: 0, at }, extra);
  test("a seek table is its own kind, not listed among the numbered tables", () => {
    expect(isSeekTable(seekTableId())).toBe(true);
    expect(isSeekTable(inviteTableId("abcdefgh"))).toBe(false);
    expect(tablesFrom([seeker("aaaa", 5)]).every((t) => t.seats.every((s) => s === null))).toBe(true);
  });
  test("lists others waiting, oldest first, not me, not blocked, not full", () => {
    const players = [seeker("bbbb", 20), seeker("aaaa", 10), seeker("meme", 5), seeker("badd", 1),
      seeker("full", 2), player("join", { table: "seek-full", side: 1, at: 3 })];
    const list = openSeeks(players, "meme", ["badd"]);
    expect(list.map((s) => s.player.id)).toEqual(["aaaa", "bbbb"]);
  });
  test("Play joins the oldest seek with the same clock and game type", () => {
    const players = [seeker("aaaa", 10, { tc: "3+2" }), seeker("bbbb", 20, { tc: "10+0" }), seeker("cccc", 30, { tc: "10+0", ranked: true })];
    const seeks = openSeeks(players, "meme");
    expect(matchingSeek(seeks, "10+0", false).player.id).toBe("bbbb");
    expect(matchingSeek(seeks, "10+0", true).player.id).toBe("cccc");
    expect(matchingSeek(seeks, "5+0", false)).toBe(null);
  });
  test("two seeks opened at once: only the later one moves, and both agree", () => {
    const a = seeker("aaaa", 10, { tc: "10+0" }), b = seeker("bbbb", 12, { tc: "10+0" });
    const fromA = olderTwin(openSeeks([a, b], "aaaa"), { tc: "10+0", ranked: false, at: 10, meId: "aaaa" });
    const fromB = olderTwin(openSeeks([a, b], "bbbb"), { tc: "10+0", ranked: false, at: 12, meId: "bbbb" });
    expect(fromA).toBe(null);
    expect(fromB.player.id).toBe("aaaa");
    /* Same moment: the smaller id stays. */
    const c = seeker("cccc", 10, { tc: "10+0" });
    expect(olderTwin(openSeeks([a, c], "aaaa"), { tc: "10+0", ranked: false, at: 10, meId: "aaaa" })).toBe(null);
    expect(olderTwin(openSeeks([a, c], "cccc"), { tc: "10+0", ranked: false, at: 10, meId: "cccc" }).player.id).toBe("aaaa");
  });
  test("joining a seek fills it and makes a match, held by the first claim", () => {
    const host = seeker("hosthost-1", 10, { tc: "3+2" });
    const guest = player("guestxxx-2", { table: "seek-hosthost-1", side: 1, at: 40 }, { tc: "10+0" });
    const table = tableOfSeat(guest.seat, tablesFrom([host, guest]), [host, guest]);
    expect(table.full).toBe(true);
    expect(matchAt(table).tc).toBe("3+2");
    expect(holdsSeat(guest, tablesFrom([host, guest]), [host, guest])).toBe(true);
  });
});
