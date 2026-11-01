import { loadSetting, saveSetting } from "./storage";

/* Rank Bot's private readout under the board. Open the site once with
   ?rankbot=test to show it in this browser, and ?rankbot=off to hide it. */
const KEY = "rankBotTest";

export function readRankBotTest(search = window.location.search) {
  const asked = new URLSearchParams(search).get("rankbot");
  if (asked === "test") saveSetting(KEY, true);
  if (asked === "off") saveSetting(KEY, false);
  return loadSetting(KEY, false) === true;
}
