/* 1v1 invite links: /lobby?invite=<code> (see the private tables in
   utils/lobby.js). The code is remembered on arrival, before the app tidies
   the address, and survives a trip out to sign in and back, so a friend who
   isn't signed in yet still lands at the right table afterwards. It goes
   stale after a couple of hours (an old link shouldn't seat anyone). */
import { loadSetting, saveSetting } from "./storage";
import { cleanInviteCode } from "./lobby";

const KEY = "pendingInvite";
const FRESH_MS = 2 * 60 * 60 * 1000;

/** The link to send a friend. */
export const inviteLink = (code, origin = window.location.origin) => `${origin}/lobby?invite=${code}`;

/** Remembers an invite in the current address, if there is one. Call once,
 *  at start-up. */
export function rememberInviteFromUrl(search = window.location.search) {
  try {
    const code = cleanInviteCode(new URLSearchParams(search).get("invite"));
    if (code) saveSetting(KEY, { code, at: Date.now() });
  } catch { /* no storage: the link just won't survive a sign-in */ }
}

/** A remembered invite code that's still fresh, or null. */
export function pendingInvite() {
  const saved = loadSetting(KEY, null);
  if (!saved || Date.now() - saved.at > FRESH_MS) return null;
  return cleanInviteCode(saved.code);
}

export const clearPendingInvite = () => saveSetting(KEY, null);
