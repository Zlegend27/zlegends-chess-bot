import { loadSetting, saveSetting } from "./storage";

/* The hidden Rank Bot test mode. Open the site once with ?rankbot=test to
   turn it on for this browser, and ?rankbot=off to turn it off. */
const KEY = "rankBotTest";

export function readRankBotTest(search = window.location.search) {
  const asked = new URLSearchParams(search).get("rankbot");
  if (asked === "test") saveSetting(KEY, true);
  if (asked === "off") saveSetting(KEY, false);
  return loadSetting(KEY, false) === true;
}
