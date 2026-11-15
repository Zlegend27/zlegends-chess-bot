/* Keeps offensive names off shared screens (the Rush leaderboard, the 1v1
   lobby). A short list of words nobody needs in a display name; a name
   containing one is shown as "Player". Spacing, case, repeated letters and
   the usual digit swaps don't get round it. It's a filter for the obvious,
   not a moderation system. */
const BLOCKED = [
  "fuck", "shit", "bitch", "cunt", "dick", "cock", "pussy", "whore", "slut", "rape", "nazi", "hitler",
  "nigger", "nigga", "faggot", "fag", "retard", "kike", "chink", "spic", "tranny", "kys",
];
const SWAPS = { 0: "o", 1: "i", 3: "e", 4: "a", 5: "s", 7: "t", "@": "a", $: "s", "!": "i" };

const squash = (name) => name.toLowerCase()
  .replace(/[013457@$!]/g, (c) => SWAPS[c])
  .replace(/[^a-z]/g, "")
  .replace(/(.)\1+/g, "$1");

/** True if the name is fine to show to other players. */
export function nameIsClean(name) {
  const flat = squash(String(name ?? ""));
  return !BLOCKED.some((word) => flat.includes(squash(word)));
}

/** The name to show other players: itself, or `fallback` if it isn't clean. */
export const cleanName = (name, fallback = "Player") => (name && nameIsClean(name) ? name : name ? fallback : name);
