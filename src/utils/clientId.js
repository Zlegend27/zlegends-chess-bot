import { loadSetting, saveSetting } from "./storage";

function randomId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
}

/** A stable anonymous identifier for this browser, used to group a
 *  player's own game history — no login involved. */
export function getClientId() {
  let id = loadSetting("clientId", null);
  if (!id) {
    id = randomId();
    saveSetting("clientId", id);
  }
  return id;
}
