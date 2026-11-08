/* How much of each attack cinematic plays: Full (the whole attack, with the
   camera's head-on shot where the mode uses one), Quick (the same attack at
   triple speed, camera stays) or Off (a plain slide and the captured piece
   pops away). One setting per mode, remembered on this device. */
import { loadSetting, saveSetting } from "../utils/storage";

export const PACES = [
  { id: "full", name: "Full" },
  { id: "quick", name: "Quick" },
  { id: "off", name: "Off" },
];
export const DEFAULT_PACE = { practice: "full", run: "full", blitz: "quick" };

const key = (mode) => "tacticaPace." + mode;

export function loadPace(mode) {
  const saved = loadSetting(key(mode), null);
  return PACES.some((p) => p.id === saved) ? saved : DEFAULT_PACE[mode] ?? "full";
}

export function savePace(mode, pace) {
  saveSetting(key(mode), pace);
}
