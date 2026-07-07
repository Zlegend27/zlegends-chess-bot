import { loadSetting, saveSetting } from "./storage";

/** A player-chosen display name, shown on their own "You" card and
 *  submitted alongside Puzzle Rush leaderboard entries (and, later, the
 *  adaptive Rank Bot's persisted rating) -- purely cosmetic, no
 *  uniqueness enforced, no login. Falls back to "Challenger" (the
 *  previous hardcoded label) until the player sets one. */
const KEY = "displayName";

export function getDisplayName() {
  return loadSetting(KEY, "");
}

export function setDisplayName(name) {
  const trimmed = (name || "").trim().slice(0, 24);
  saveSetting(KEY, trimmed);
  return trimmed;
}
