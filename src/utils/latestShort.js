import { loadSetting, saveSetting } from "./storage";

/* The browser remembers the answer for 12 hours as well, so a returning
   visitor doesn't ask the server again. The server caches the same way. */
export const SHORT_TTL_MS = 12 * 60 * 60 * 1000;
const KEY = "latestShort";

/** Whatever was remembered, if it's still fresh. */
export function freshShort(saved, now = Date.now()) {
  return saved?.video && now - saved.fetchedAt < SHORT_TTL_MS ? saved.video : null;
}

/** The latest Short, from memory when it's fresh, otherwise from the server.
 *  Resolves to null when the server can't be reached, such as in local dev. */
export async function fetchLatestShort(fetcher = fetch) {
  const cached = freshShort(loadSetting(KEY, null));
  if (cached) return cached;
  try {
    const res = await fetcher("/api/latest-short");
    if (!res.ok) return null;
    const video = await res.json();
    saveSetting(KEY, { video, fetchedAt: Date.now() });
    return video;
  } catch {
    return null;
  }
}
