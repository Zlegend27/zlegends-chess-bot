/* How fast the site really is for the people using it: the three numbers
   Google ranks pages by (Core Web Vitals), measured in the visitor's own
   browser and sent once per visit as a "vitals" event through track.js
   (same rules: no account, no stored id). Read them with query 10 in
   supabase/stats.sql.

   - lcp: ms until the biggest thing on the first screen was drawn.
   - cls: how much the page jumped around (the worst burst of shifts).
   - inp: ms from the slowest tap or key press to the next frame.

   Browsers without these timings (Safari has no LCP or INP yet) simply
   send what they have. No library: PerformanceObserver gives all three. */
import { track, flushEvents } from "./track";

const observe = (type, cb, opts = {}) => {
  try {
    if (!PerformanceObserver.supportedEntryTypes?.includes(type)) return null;
    const po = new PerformanceObserver((list) => list.getEntries().forEach(cb));
    po.observe({ type, buffered: true, ...opts });
    return po;
  } catch { return null; }
};

export function startVitals() {
  if (typeof window === "undefined" || typeof PerformanceObserver === "undefined") return;
  const firstPath = window.location.pathname;
  let lcp = null;
  let lcpDone = false;
  /* CLS is the worst "session" of shifts: shifts less than 1s apart, at
     most 5s in all, not counting ones right after the player's own input. */
  let cls = 0, session = 0, sessionStart = 0, sessionLast = 0;
  /* INP: the slowest interaction. (The official figure skips one outlier
     per 50 interactions; for a visit this short the slowest is close.) */
  let inp = null;
  let interactions = 0;

  observe("largest-contentful-paint", (e) => { if (!lcpDone) lcp = e.startTime; });
  /* LCP stops at the first input: after that, it's the player's doing. */
  const stopLcp = () => { lcpDone = true; };
  ["keydown", "pointerdown"].forEach((t) => window.addEventListener(t, stopLcp, { once: true, capture: true }));

  observe("layout-shift", (e) => {
    if (e.hadRecentInput) return;
    if (session && e.startTime - sessionLast < 1000 && e.startTime - sessionStart < 5000) {
      session += e.value;
    } else {
      session = e.value;
      sessionStart = e.startTime;
    }
    sessionLast = e.startTime;
    if (session > cls) cls = session;
  });

  observe("event", (e) => {
    if (!e.interactionId) return;
    interactions++;
    if (inp === null || e.duration > inp) inp = e.duration;
  }, { durationThreshold: 40 });
  observe("first-input", (e) => {
    const d = e.processingStart - e.startTime;
    if (inp === null) inp = d;
  });

  let sent = false;
  const send = (leaving) => {
    if (sent || (!leaving && !document.hidden)) return;
    sent = true;
    const nav = performance.getEntriesByType?.("navigation")?.[0];
    track("vitals", {
      path: firstPath,
      lcp: lcp === null ? null : Math.round(lcp),
      cls: Math.round(cls * 1000) / 1000,
      inp: inp === null ? null : Math.round(inp),
      interactions,
      ttfb: nav ? Math.round(nav.responseStart) : null,
      width: window.innerWidth,
      net: navigator.connection?.effectiveType ?? null,
    });
    flushEvents();
  };
  /* Sent the first time the page is hidden (tab switched, app left, phone
     locked): the numbers are final enough by then, and it may never come
     back. pagehide catches browsers that skip visibilitychange. */
  document.addEventListener("visibilitychange", () => send(false));
  window.addEventListener("pagehide", () => send(true));
}
