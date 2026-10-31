/* Every screen gets a real address, so the phone's back gesture, a refresh
   and a pasted link all land where they should. siteView stays the source
   of truth in App.jsx; this just translates it to and from the URL. */
const VIEW_PATHS = {
  home: "/",
  play: "/play",
  puzzlesHome: "/puzzles",
  leaderboard: "/leaderboard",
  review: "/review",
  lessons: "/lessons",
};

export const pathForView = (view) => VIEW_PATHS[view] ?? "/";

export function viewForPath(path) {
  const clean = path.length > 1 ? path.replace(/\/+$/, "") : path;
  return Object.keys(VIEW_PATHS).find((view) => VIEW_PATHS[view] === clean) ?? "home";
}

/** Which menu item to light up. A puzzle or a reviewed game runs on the Play
 *  screen, but as far as the player knows they're still in that section. */
export function sectionForView({ siteView, rushMode, activePuzzle, pastedGame }) {
  if (siteView === "puzzlesHome" || siteView === "leaderboard") return "puzzles";
  if (siteView === "lessons") return "learn";
  if (siteView === "review") return "review";
  if (siteView === "home") return "home";
  if (rushMode || activePuzzle) return "puzzles";
  return pastedGame ? "review" : "play";
}

/** Escape closes a popup or the profile menu first. Pages check this before
 *  treating it as Back. */
export const overlayOpen = () => !!document.querySelector(".promoOv, [role='menu']");
