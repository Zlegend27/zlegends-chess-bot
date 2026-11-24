/* Every screen gets a real address, so the phone's back gesture, a refresh
   and a pasted link all land where they should. siteView stays the source
   of truth in App.jsx; this just translates it to and from the URL. */
import { courseForPath } from "../data/openingPages";

const VIEW_PATHS = {
  home: "/",
  playHub: "/play",
  play: "/game",
  puzzlesHome: "/puzzles",
  daily: "/daily",
  leaderboard: "/leaderboard",
  review: "/review",
  lessons: "/lessons",
  blind: "/blind",
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
  accessibility: "/accessibility",
};

export const pathForView = (view) => VIEW_PATHS[view] ?? "/";
/** Every page address, for the checks that the host serves them all. */
export const ALL_PATHS = Object.values(VIEW_PATHS);

/* A heading for the pages that don't show one of their own, read out by
   screen readers (the others carry a visible h1: Puzzles, Leaderboard,
   Game Review, Lessons, Privacy, Terms). */
const HIDDEN_HEADINGS = {
  home: "Zlegend2700",
  playHub: "Play",
  play: "Chess board",
  openings: "Openings",
  daily: "Daily puzzle",
  watch: "Watch bots play",
  ranked: "Ranked puzzles",
  rush: "Puzzle Rush",
  profile: "Your profile",
  lobby: "1v1 lobby",
};
export const hiddenHeadingFor = (view) => HIDDEN_HEADINGS[view] ?? null;

/* The browser tab's title per page, so tabs, history and search results
   say where they lead. */
const SITE = "Zlegend2700";
const TITLES = {
  playHub: "Play", play: "Game", puzzlesHome: "Puzzles", leaderboard: "Leaderboards", daily: "Daily chess puzzle", review: "Game Review",
  lessons: "Learn", blind: "Blind Chess Trainer", openings: "Openings", watch: "Watch bots play", ranked: "Ranked puzzles", rush: "Puzzle Rush",
  profile: "Profile", avatar: "Your avatar", history: "Game History", lobby: "1v1 lobby", practice: "Play with yourself", tactica: "Chess Tactica",
  privacy: "Privacy Policy", terms: "Terms of Service", accessibility: "Accessibility",
};
export const titleFor = (view) => (TITLES[view] ? `${TITLES[view]} · ${SITE}` : `${SITE} · Free chess: bots, puzzles and game review`);

export function viewForPath(path) {
  const clean = path.length > 1 ? path.replace(/\/+$/, "") : path;
  /* An opening's own page (/openings/vienna-game) is the trainer, in Learn. */
  if (courseForPath(clean)) return "lessons";
  return Object.keys(VIEW_PATHS).find((view) => VIEW_PATHS[view] === clean) ?? "home";
}

/** Which menu item to light up. A puzzle or a reviewed game runs on the Play
 *  screen, but as far as the player knows they're still in that section. */
export function sectionForView({ siteView, rushMode, activePuzzle, pastedGame }) {
  if (["puzzlesHome", "daily", "leaderboard", "ranked", "rush"].includes(siteView)) return "puzzles";
  if (siteView === "lessons" || siteView === "openings" || siteView === "blind") return "learn";
  if (siteView === "review") return "review";
  if (siteView === "home") return "home";
  if (["profile", "avatar", "history", "privacy", "terms", "accessibility"].includes(siteView)) return "";
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
