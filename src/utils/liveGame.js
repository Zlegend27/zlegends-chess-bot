import { loadSetting, saveSetting } from "./storage";

/* The game in progress, kept on the device so a refresh, or Safari reloading a
   tab it put to sleep, picks up where the player left off. */
const KEY = "liveGame";
const KEEP_FOR_MS = 24 * 60 * 60 * 1000;

export const saveLiveGame = (game, now = Date.now()) => saveSetting(KEY, { ...game, savedAt: now });
export const clearLiveGame = () => saveSetting(KEY, null);
export const loadLiveGame = () => loadSetting(KEY, null);

export const isResumable = (game, now = Date.now()) =>
  Array.isArray(game?.moves) && game.moves.length > 0 && now - game.savedAt < KEEP_FOR_MS;
