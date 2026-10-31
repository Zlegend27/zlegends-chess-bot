import { describe, test, expect, vi, beforeEach } from "vitest";
import { beginHandoff, readHandoffLanding, postHandoffCode, collectHandoff } from "./authHandoff";
import { loadSetting, saveSetting } from "./storage";

const NONCE = "123e4567-e89b-42d3-a456-426614174000";
const store = new Map();

const fakeSupabase = (take) => ({
  rpc: vi.fn(async () => take),
  auth: { exchangeCodeForSession: vi.fn(async () => ({})) },
});

beforeEach(() => {
  store.clear();
  vi.stubGlobal("localStorage", {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, v),
  });
});

describe("recognising the sign-in tab", () => {
  test("a landing carries the mailbox number and the code", () => {
    expect(readHandoffLanding(`?handoff=${NONCE}&code=abc`)).toEqual({ nonce: NONCE, code: "abc" });
  });

  test("a cancelled Discord screen has no code, and still gets the tab's message", () => {
    expect(readHandoffLanding(`?handoff=${NONCE}&error=access_denied`)).toEqual({ nonce: NONCE, code: null });
  });

  test("ordinary page loads open the app", () => {
    expect(readHandoffLanding("")).toBeNull();
    expect(readHandoffLanding("?code=abc")).toBeNull();
    expect(readHandoffLanding("?handoff=not-a-uuid&code=abc")).toBeNull();
  });
});

test("the tab sends Supabase the names the SQL function expects", async () => {
  const fetchMock = vi.fn(async () => ({ ok: true }));
  vi.stubGlobal("fetch", fetchMock);
  expect(await postHandoffCode("https://x.test/", "key", NONCE, "abc")).toBe(true);
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe("https://x.test/rest/v1/rpc/auth_handoff_put");
  expect(JSON.parse(init.body)).toEqual({ handoff: NONCE, auth_code: "abc" });
});

describe("the app collecting a sign-in", () => {
  test("starting one points Discord back at a mailbox the app remembers", () => {
    const url = beginHandoff("https://app.test");
    expect(url).toBe(`https://app.test/?handoff=${loadSetting("pendingSignIn").nonce}`);
  });

  test("nothing pending means no network at all", async () => {
    const sb = fakeSupabase({ data: null, error: null });
    await collectHandoff(sb);
    expect(sb.rpc).not.toHaveBeenCalled();
  });

  test("an empty mailbox keeps waiting", async () => {
    beginHandoff("https://app.test");
    const sb = fakeSupabase({ data: null, error: null });
    await collectHandoff(sb);
    expect(sb.auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(loadSetting("pendingSignIn", null)).not.toBeNull();
  });

  test("a code finishes the sign-in once", async () => {
    beginHandoff("https://app.test");
    const sb = fakeSupabase({ data: "abc", error: null });
    await collectHandoff(sb);
    await collectHandoff(sb);
    expect(sb.auth.exchangeCodeForSession).toHaveBeenCalledTimes(1);
    expect(sb.auth.exchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(loadSetting("pendingSignIn", null)).toBeNull();
  });

  test("an abandoned sign-in stops being checked", async () => {
    saveSetting("pendingSignIn", { nonce: NONCE, startedAt: Date.now() - 11 * 60 * 1000 });
    const sb = fakeSupabase({ data: "abc", error: null });
    await collectHandoff(sb);
    expect(sb.rpc).not.toHaveBeenCalled();
    expect(loadSetting("pendingSignIn", null)).toBeNull();
  });

  test("a failed exchange doesn't throw, so Login can be tried again", async () => {
    beginHandoff("https://app.test");
    const sb = fakeSupabase({ data: "abc", error: null });
    sb.auth.exchangeCodeForSession.mockRejectedValue(new Error("bad code"));
    await expect(collectHandoff(sb)).resolves.toBeUndefined();
    await collectHandoff(sb);
    expect(sb.rpc).toHaveBeenCalledTimes(1);
  });
});
