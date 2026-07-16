import { getSupabase } from "./supabase";

/* Discord OAuth via Supabase Auth -- chosen over email/password because
   this app's whole audience already lives on Discord (it's linked in
   the footer/social banner), and Supabase's own dashboard handles the
   OAuth app registration + token exchange, so there's no custom backend
   to write. Every function here no-ops (resolves null / does nothing)
   when Supabase isn't configured, same convention as the rest of
   utils/*.js that touch it -- a local clone without a .env file, or a
   deploy where the Discord provider hasn't been enabled yet, should
   never crash the app, just leave auth unavailable. */

/** Kicks off the Discord OAuth redirect -- the browser leaves the page,
 *  Discord shows its consent screen, then lands back here with a session
 *  Supabase has already stored. watchAuthState (below) is what actually
 *  notices the new session; this function doesn't return one itself. */
export async function signInWithDiscord() {
  const supabase = await getSupabase();
  if (!supabase) return;
  await supabase.auth.signInWithOAuth({
    provider: "discord",
    options: { redirectTo: window.location.origin },
  });
}

export async function signOut() {
  const supabase = await getSupabase();
  if (!supabase) return;
  await supabase.auth.signOut();
}

/** Subscribes to auth state (sign-in, sign-out, token refresh) and fires
 *  `onChange(session | null)` -- once immediately with whatever session
 *  already exists (so callers don't need a separate initial fetch), then
 *  again on every future change. Returns an unsubscribe function, safe
 *  to call even if Supabase never finished loading (e.g. unmounted
 *  before the dynamic import resolved). */
export function watchAuthState(onChange) {
  let unsub = () => {};
  let cancelled = false;
  getSupabase().then((supabase) => {
    if (!supabase || cancelled) return;
    supabase.auth.getSession().then(({ data }) => { if (!cancelled) onChange(data?.session ?? null); });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => onChange(session));
    unsub = () => sub.subscription.unsubscribe();
  });
  return () => { cancelled = true; unsub(); };
}

/** Discord's profile fields land in user_metadata under provider-specific
 *  keys -- full_name/name/avatar_url are what Supabase's Discord OAuth
 *  integration populates as of writing. Returns null for a signed-out
 *  session so callers can `profile &&` without a separate null check. */
export function discordProfile(session) {
  const meta = session?.user?.user_metadata;
  if (!meta) return null;
  return {
    name: meta.full_name || meta.name || meta.custom_claims?.global_name || "Discord Player",
    avatarUrl: meta.avatar_url || null,
  };
}
