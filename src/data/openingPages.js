/* Each Opening Trainer course has its own address, /openings/<slug>, so it
   can be found in search and shared: scripts/prerender.mjs writes a page of
   text for it (from openingNotes.js, see seoPages.js), and in the app the
   address opens the trainer on that course (routes.js, LessonsPage). The
   slugs are the names people search for; don't change one once it's live,
   or links to it break. */
import { COURSES } from "./openingCourses.js";

const SLUGS = {
  vienna: "vienna-game",
  italian: "italian-game",
  "ruy-lopez": "ruy-lopez",
  scotch: "scotch-game",
  london: "london-system",
  "queens-gambit": "queens-gambit",
  sicilian: "sicilian-defence",
  french: "french-defence",
  "caro-kann": "caro-kann-defence",
  scandinavian: "scandinavian-defence",
  qgd: "queens-gambit-declined",
  "kings-indian": "kings-indian-defence",
};

export const coursePath = (id) => (SLUGS[id] ? `/openings/${SLUGS[id]}` : null);

/** The course an address leads to, or null. */
export function courseForPath(path) {
  const m = /^\/openings\/([a-z-]+)\/?$/.exec(path);
  if (!m) return null;
  return COURSES.find((c) => SLUGS[c.id] === m[1]) ?? null;
}

export const OPENING_PATHS = COURSES.map((c) => coursePath(c.id));
