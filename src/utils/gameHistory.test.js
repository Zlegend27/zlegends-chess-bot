import { describe, test, expect, vi, beforeEach } from "vitest";

const db = vi.hoisted(() => ({ userId: null, calls: [], reads: [] }));

vi.mock("./clientId", () => ({ getClientId: () => "this-browser" }));
vi.mock("./supabase", () => ({
  getSupabase: async () => {
    const query = { then: (resolve) => resolve({ data: [], error: null }) };
    for (const name of ["insert"]) {
      query[name] = (...args) => { db.calls.push([name, ...args]); return query; };
    }
    return {
      from: () => query,
      auth: { getSession: async () => ({ data: { session: db.userId ? { user: { id: db.userId } } : null } }) },
    };
  },
}));
vi.mock("./restApi", () => ({
  isConfigured: () => true,
  storedUserId: () => db.userId,
  restGet: async (table, params) => { db.reads.push([table, params]); return []; },
}));

import { saveGame, fetchRecentGames, ownGamesFilter } from "./gameHistory";

const save = () => saveGame({ playerColor: 1, moveList: ["e4"], result: { text: "1–0", reason: "Checkmate", winner: 1 } });

beforeEach(() => { db.userId = null; db.calls = []; db.reads = []; });

describe("signed out", () => {
  test("a save doesn't mention user_id, so it works before the account columns exist", async () => {
    await save();
    expect(db.calls.find((c) => c[0] === "insert")[1]).not.toHaveProperty("user_id");
  });

  test("the list is this browser's games", async () => {
    await fetchRecentGames();
    const params = new URLSearchParams(db.reads[0][1]);
    expect(params.get("client_id")).toBe("eq.this-browser");
    expect(params.has("or")).toBe(false);
  });
});

describe("signed in", () => {
  beforeEach(() => { db.userId = "account-1"; });

  test("a save is stamped with the account, so other devices can see it", async () => {
    await save();
    expect(db.calls.find((c) => c[0] === "insert")[1]).toMatchObject({ user_id: "account-1", client_id: "this-browser" });
  });

  test("the list follows the account instead of the browser", async () => {
    await fetchRecentGames();
    const params = new URLSearchParams(db.reads[0][1]);
    expect(params.get("or")).toBe(`(${ownGamesFilter("account-1", "this-browser")})`);
    expect(params.has("client_id")).toBe(false);
  });
});

test("on a shared browser, only unclaimed games come along with the account's own", () => {
  expect(ownGamesFilter("a", "b")).toBe("user_id.eq.a,and(client_id.eq.b,user_id.is.null)");
});
