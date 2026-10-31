import { loadSetting, saveSetting } from "./storage";

/* iOS runs a home-screen app's sign-in in a separate browser tab with its
   own storage, so the session Discord grants there dies with the tab and
   the app itself stays signed out. The two can't talk directly, so the tab
   leaves the one-time code in a Supabase mailbox and the app collects it.

   This is safe because of PKCE: the code is worthless without a verifier
   that never leaves the app's own storage. See
   supabase/002_ios_sign_in_handoff.sql. */
const PENDING_KEY = "pendingSignIn";
const HANDOFF_WINDOW_MS = 10 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** navigator.standalone only exists on iOS, which is the point: Android and
 *  desktop installs bring the session back on their own. */
export const isIosHomeScreenApp = () => typeof navigator !== "undefined" && navigator.standalone === true;

/** Remembers a sign-in in progress and returns where Discord should send
 *  the tab afterwards. Stored rather than held in memory because the page
 *  can reload while the player is away. */
export function beginHandoff(origin) {
  const nonce = crypto.randomUUID();
  saveSetting(PENDING_KEY, { nonce, startedAt: Date.now() });
  return `${origin}/?handoff=${nonce}`;
}

/** The sign-in tab's landing details, or null on any ordinary page load. */
export function readHandoffLanding(search) {
  const params = new URLSearchParams(search);
  const nonce = params.get("handoff");
  if (!nonce || !UUID.test(nonce)) return null;
  return { nonce, code: params.get("code") };
}

/** Plain fetch, because creating a Supabase client here would make it try
 *  to use the code itself and fail without the app's verifier. */
export async function postHandoffCode(url, anonKey, nonce, code) {
  const res = await fetch(`${url.replace(//$/, "")}/rest/v1/rpc/auth_handoff_put`, {
    method: "POST",
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ handoff: nonce, auth_code: code }),
  });
  return res.ok;
}

let collecting = false;

/** Finishes a sign-in if the tab has left its code. No network at all unless
 *  one is pending. onAuthStateChange delivers the new session to the app. */
export async function collectHandoff(supabase) {
  const pending = loadSetting(PENDING_KEY, null);
  if (!pending || collecting) return;
  if (Date.now() - pending.startedAt > HANDOFF_WINDOW_MS) {
    saveSetting(PENDING_KEY, null);
    return;
  }
  collecting = true;
  try {
    const { data: code, error } = await supabase.rpc("auth_handoff_take", { handoff: pending.nonce });
    if (error || !code) return;
    saveSetting(PENDING_KEY, null);
    await supabase.auth.exchangeCodeForSession(code);
  } catch {
    /* best-effort: Login is still there to try again */
  } finally {
    collecting = false;
  }
}

/** Checks on an interval and whenever the app comes back, since iOS can
 *  freeze timers while the sign-in tab covers the app. Returns a stop
 *  function. */
export function watchHandoff(supabase) {
  const check = () => collectHandoff(supabase);
  const events = ["focus", "pageshow"];
  events.forEach((e) => window.addEventListener(e, check));
  document.addEventListener("visibilitychange", check);
  const timer = setInterval(check, 2000);
  check();
  return () => {
    events.forEach((e) => window.removeEventListener(e, check));
    document.removeEventListener("visibilitychange", check);
    clearInterval(timer);
  };
}
