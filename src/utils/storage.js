const PREFIX = "zlegendsBot.";

export function loadSetting(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function saveSetting(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode, quota, etc.) — settings just won't persist */
  }
}
