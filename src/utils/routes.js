/* Every screen gets a real address, so the phone's back gesture, a refresh
   and a pasted link all land where they should. siteView stays the source
   of truth in App.jsx; this just translates it to and from the URL. */
const VIEW_PATHS = {
  home: "/",
  playHub: "/play",
  play: "/game",
  puzzlesHome: "/puzzles",
  leaderboard: "/leaderboard",
  review: "/review",
  lessons: "/lessons",
  profile: "/profile",
  openings: "/openings",
  watch: "/watch",
  ranked: "/ranked",
  rush: "/rush",
  tactica: "/tactica",
  lobby: "/lobby",
  practice: "/practice",
  history: "/history",
  avatar: "/avatar",
  privacy: "/privacy",
  terms: "/terms",
};

export const pathForView = (view) => VIEW_PATHS[view] ?? "/";

/* A heading for the pages that don't show one of their own, read out by
   screen readers (the others carry a visible h1: Puzzles, Leaderboard,
   Game Review, Lessons, Privacy, Terms). */
const HIDDEN_HEADINGS = {
  home: "Zlegend's Chess Bot",
  playHub: "Play",
  play: "Chess board",
  openings: "Openings",
  watch: "Watch bots play",
  ranked: "Ranked puzzles",
  rush: "Puzzle Rush",
  profile: "Your profile",
};
export const hiddenHeadingFor = (view) => HIDDEN_HEADINGS[view] ?? null;

/* The browser tab's title per page, so tabs, history and search results
   say where they lead. */
const SITE = "Zlegend's Chess Bot";
const TITLES = {
  playHub: "Play", play: "Game", puzzlesHome: "Puzzles", leaderboard: "Leaderboards", review: "Game Review",
  lessons: "Learn", openings: "Openings", watch: "Watch bots play", ranked: "Ranked puzzles", rush: "Puzzle Rush",
  profile: "Profile", avatar: "Your avatar", history: "Game History", lobby: "1v1 lobby", practice: "Play with yourself", tactica: "Chess Tactica",
  privacy: "Privacy Policy", terms: "Terms of Service",
};
export const titleFor = (view) => (TITLES[view] ? `${TITLES[view]} · ${SITE}` : `${SITE} — can you beat it?`);

export function viewForPath(path) {
  const clean = path.length > 1 ? path.replace(/\/+$/, "") : path;
  return Object.keys(VIEW_PATHS).find((view) => VIEW_PATHS[view] === clean) ?? "home";
}

/** Which menu item to light up. A puzzle or a reviewed game runs on the Play
 *  screen, but as far as the player knows they're still in that section. */
export function sectionForView({ siteView, rushMode, activePuzzle, pastedGame }) {
  if (["puzzlesHome", "leaderboard", "ranked", "rush"].includes(siteView)) return "puzzles";
  if (siteView === "lessons" || siteView === "openings") return "learn";
  if (siteView === "review") return "review";
  if (siteView === "home") return "home";
  if (["profile", "avatar", "history", "privacy", "terms"].includes(siteView)) return "";
  if (["playHub", "watch", "tactica", "lobby", "practice"].includes(siteView)) return "play";
  if (rushMode || activePuzzle) return "puzzles";
  return pastedGame ? "review" : "play";
}

/** Escape closes a popup or the profile menu first. Pages check this before
 *  treating it as Back. */
export const overlayOpen = () => !!document.querySelector(".promoOv, [role='menu']");

/** How the browser history should follow a move to `view`. Sections are tabs,
 *  so history never holds more than Home plus the current page: one back
 *  swipe at most, and always to Home. `onSubPage` says we're on that second
 *  entry. */
export function historyStep(view, onSubPage) {
  if (view === "home") return onSubPage ? "back" : "replace";
  return onSubPage ? "replace" : "push";
}
