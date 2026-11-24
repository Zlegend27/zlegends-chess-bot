/* Blind Chess Trainer progress, kept on this device: where the player is
   on the path (blindPath.js: each stage's step, whether it's done,
   totals) and the days-in-a-row practice streak. Synced to the account by
   blindTrainerSync.js when signed in. (Version 2, 2026-11-24: the path
   replaced per-drill levels; the old record is set aside.) */
import { loadSetting, saveSetting } from "./storage";
import { STAGES, emptyPath } from "./blindPath";

const KEY = "blindTrainingV2";

/* A local calendar day, "2026-11-24": the streak follows the player's own
   midnight, not UTC. */
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function loadTraining() {
  const saved = loadSetting(KEY, null) || {};
  const path = emptyPath();
  for (const s of STAGES) path[s.id] = { ...path[s.id], ...(saved.path?.[s.id] || {}) };
  return { path, streak: saved.streak || { last: null, count: 0 }, updatedAt: saved.updatedAt || 0 };
}

export function saveTraining(t) {
  saveSetting(KEY, { ...t, updatedAt: Date.now() });
}

/** The streak after practising today. */
export function bumpStreak(streak, today = dayKey()) {
  if (streak.last === today) return streak;
  const y = new Date(today + "T12:00:00");
  y.setDate(y.getDate() - 1);
  const yesterday = dayKey(y);
  return { last: today, count: streak.last === yesterday ? streak.count + 1 : 1 };
}

/** The streak as it stands today (0 once a day was missed). */
export function liveStreak(streak, today = dayKey()) {
  if (!streak.last) return 0;
  const y = new Date(today + "T12:00:00");
  y.setDate(y.getDate() - 1);
  return streak.last === today || streak.last === dayKey(y) ? streak.count : 0;
}
