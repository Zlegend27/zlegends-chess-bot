import { getSupabase } from "./supabase";
import { storedSession } from "./restApi";
import { loadSetting } from "./storage";
import { beginHandoff, isIosHomeScreenApp, watchHandoff } from "./authHandoff";

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
export async function signInWithProvider(provider) {
  const supabase = await getSupabase();
  if (!supabase) return;
  await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: isIosHomeScreenApp() ? beginHandoff(window.location.origin) : window.location.origin,
    },
  });
}

/* Email sign-in sends a 6-digit code to type in, rather than a link: on an
   iPhone a link in an email opens Safari, not the home-screen app, so the
   sign-in would land in the wrong place. (The email can carry a link as
   well; it works when the email is opened where the game is.) A new email
   address gets an account on the spot. */
const AUTH_NEEDED = "zl:auth-needed";

/** Which ways in are switched on in Supabase ({ google, discord, email }),
 *  so the sign-in window only offers ones that work: a provider switched on
 *  in the dashboard shows up here by itself. Asked once per visit. */
let methods = null;
export function signInMethods() {
  const url = import.meta.env.VITE_SUPABASE_URL, key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return Promise.resolve({});
  methods ??= fetch(`${url.replace(/\/$/, "")}/auth/v1/settings`, { headers: { apikey: key } })
    .then((r) => r.json())
    .then((j) => ({ google: !!j.external?.google, discord: !!j.external?.discord, email: !!j.external?.email }))
    /* Unreachable: offer the long-standing ones and ask again next time. */
    .catch(() => { methods = null; return { discord: true, email: true }; });
  return methods;
}

/** Sends the code. Resolves { error } with a message to show, or {}. */
export async function sendEmailCode(email) {
  const supabase = await getSupabase();
  if (!supabase) return { error: "Sign-in isn't available right now." };
  /* The app only listens for sign-ins once one is under way. */
  window.dispatchEvent(new Event(AUTH_NEEDED));
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: window.location.origin } });
  if (!error) return {};
  if (error.status === 429) return { error: "Too many codes asked for. Wait a minute and try again." };
  return { error: "Couldn't send the code. Check the address and try again." };
}

/** Checks the code. Resolves { error } with a message to show, or {}. */
export async function verifyEmailCode(email, code) {
  const supabase = await getSupabase();
  if (!supabase) return { error: "Sign-in isn't available right now." };
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
  return error ? { error: "That code didn't work. Check it, or send a new one." } : {};
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
/* The sign-in library is about 55KB, so it only loads when there's a
   session to restore, a sign-in in progress, or a sign-in returning to this
   page. Everyone else is signed out and skips it. */
function mayHaveSession() {
  if (storedSession() || loadSetting("pendingSignIn", null)) return true;
  return /access_token=|[?&]code=/.test(window.location.hash + window.location.search);
}

export function watchAuthState(onChange) {
  let unsub = () => {};
  let cancelled = false;
  /* Signed out with nothing stored: wait until a sign-in starts here (an
     email code; Google and Discord leave the page and come back). */
  if (!mayHaveSession()) {
    onChange(null);
    const start = () => { if (!cancelled) listen(); };
    window.addEventListener(AUTH_NEEDED, start, { once: true });
    unsub = () => window.removeEventListener(AUTH_NEEDED, start);
  } else {
    listen();
  }
  return () => { cancelled = true; unsub(); };

  function listen() {
  getSupabase().then((supabase) => {
    if (!supabase || cancelled) return;
    /* A phone waking up often has no network for its first token refresh:
       the library then reports no session, though it keeps the stored one
       and refreshes it a moment later. Showing that as signed out logged
       players out for no reason, so the player only counts as signed out
       after a real sign-out (SIGNED_OUT clears the stored session too) or
       once nothing is stored. */
    const report = (event, session) => {
      if (cancelled) return;
      if (!session && event !== "SIGNED_OUT") session = storedSession();
      onChange(session ?? null);
    };
    supabase.auth.getSession().then(({ data }) => report("INITIAL", data?.session));
    const { data: sub } = supabase.auth.onAuthStateChange(report);
    const stopHandoff = isIosHomeScreenApp() ? watchHandoff(supabase) : () => {};
    unsub = () => { sub.subscription.unsubscribe(); stopHandoff(); };
  });
  }
}

/** The signed-in player's id, or null. Reads the stored session, so awaiting
 *  it doesn't add a network round trip to a save. */
export async function currentUserId() {
  const supabase = await getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data?.session?.user?.id ?? null;
}

/** The player's name and picture from whichever account they signed in
 *  with: Discord and Google fill user_metadata (full_name/name, and
 *  avatar_url or picture); an email account has only its address, so the
 *  name is the part before the @ until they pick one on their profile.
 *  Null for a signed-out session, so callers can `profile &&`. */
export function accountProfile(session) {
  const user = session?.user;
  if (!user) return null;
  const meta = user.user_metadata ?? {};
  return {
    name: meta.full_name || meta.name || meta.custom_claims?.global_name || user.email?.split("@")[0] || "Player",
    avatarUrl: meta.avatar_url || meta.picture || null,
  };
}
