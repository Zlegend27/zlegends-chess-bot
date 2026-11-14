import { afterEach, beforeEach, expect, test, vi } from "vitest";

/* The stored session must be found again after a refresh. It once never
   was (a const named URL hid the browser's URL), which signed everyone out
   on every page load. */
beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("VITE_SUPABASE_URL", "https://abcdefgh.supabase.co/");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon");
  const store = new Map();
  vi.stubGlobal("localStorage", { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

test("finds the session the sign-in library stored", async () => {
  localStorage.setItem("sb-abcdefgh-auth-token", JSON.stringify({ access_token: "t", user: { id: "u1" } }));
  const { storedSession, storedUserId } = await import("./restApi");
  expect(storedSession()?.access_token).toBe("t");
  expect(storedUserId()).toBe("u1");
});

test("no stored session means signed out", async () => {
  const { storedSession } = await import("./restApi");
  expect(storedSession()).toBeNull();
});
