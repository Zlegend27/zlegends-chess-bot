/* Our own record of what gets used: "a page opened", "a puzzle was solved",
   "the site crashed". Rows go to the `events` table (supabase/005_events.sql)
   with a plain fetch, so this adds nothing to the first load and involves no
   third-party tracker. It never throws and never blocks anything: events are
   queued and sent a few at a time, and once more as the page is left.

   What's sent with each: its name, a small detail object, a random number
   made for this visit only (never stored), whether the player is signed
   in, and the build. No account id, no stored browser id, no names, emails
   or free text typed by the player. The Privacy Policy
   describes this; change both together. */
/* global __APP_VERSION__ */
import { isConfigured, restPost, storedSession } from "./restApi";

const FLUSH_MS = 4000;
/* A visit that somehow loops can't flood the table. */
const MAX_PER_VISIT = 300;
const MAX_ERRORS_PER_VISIT = 5;

/* This visit only: never stored, so visits can't be linked (see track). */
const VISIT_ID = "v-" + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);

const VERSION = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev";

let queue = [];
let timer = null;
let sent = 0;
let errors = 0;
/* Off once the table turns out not to exist (the SQL hasn't been run). */
let off = false;

function flush() {
  clearTimeout(timer);
  timer = null;
  if (!queue.length || off) { queue = []; return; }
  const rows = queue;
  queue = [];
  restPost("events", rows).then((status) => { if (status === 404 || status === 401 || status === 403) off = true; }, () => {});
}

/** Records that something happened. `detail` is a small plain object. */
export function track(name, detail = null) {
  try {
    /* Not from tests or local development: only real visits count. */
    if (off || !isConfigured() || import.meta.env?.MODE === "test" || import.meta.env?.DEV || sent >= MAX_PER_VISIT) return;
    sent++;
    /* Not tied to the person (owner's decision, 2026-11-23): no account id
       and no stored browser id, only a number made up for this visit and
       kept in memory, so one visit's events can be grouped but two visits
       can't be linked. Whether they're signed in is all we keep. */
    const session = storedSession();
    const signedIn = !!(session && session.expires_at * 1000 > Date.now());
    queue.push({ name, detail: { ...(detail ?? {}), signedIn }, client_id: VISIT_ID, user_id: null, app_version: VERSION });
    if (!timer) timer = setTimeout(flush, FLUSH_MS);
  } catch { /* never in the way */ }
}

/** A crash or failed promise, trimmed and capped per visit. */
export function trackError(error, where) {
  if (errors >= MAX_ERRORS_PER_VISIT) return;
  errors++;
  const message = String(error?.message ?? error ?? "unknown").slice(0, 300);
  const stack = String(error?.stack ?? "").split("\n").slice(1, 4).map((l) => l.trim().replace(/https?:\/\/[^/]+/g, "")).join(" | ").slice(0, 500);
  track("error", { message, stack, where, view: window.location.pathname });
}

/** Call once at start-up: records the visit and catches crashes. */
export function startTracking() {
  if (typeof window === "undefined") return;
  let referrer = null;
  try { referrer = document.referrer ? new URL(document.referrer).hostname : null; } catch { /* odd referrer */ }
  if (referrer === window.location.hostname) referrer = null;
  track("app_open", {
    view: window.location.pathname,
    installed: window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true,
    width: window.innerWidth,
    referrer,
  });
  window.addEventListener("error", (e) => trackError(e.error ?? e.message, "window"));
  window.addEventListener("unhandledrejection", (e) => trackError(e.reason, "promise"));
  /* The last few events would otherwise be lost with the page. */
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => { if (document.hidden) flush(); });
}
