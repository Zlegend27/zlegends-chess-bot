import { getSupabase } from "./supabase";
import { storedSession } from "./restApi";
import { loadSetting, saveSetting } from "./storage";
import { beginHandoff, isIosHomeScreenApp, watchHandoff } from "./authHandoff";

/* Accounts, through Supabase Auth: log in with Google, Discord or an email
   code. One person, one account: Supabase joins logins that share a
   verified email by itself, and the profile page can connect one that uses
   a different email (linkProvider). Supabase's dashboard handles the
   provider set-up and token exchange, so there's no custom backend to
   write. Every function here no-ops (resolves null / does nothing)
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
  /* The iPhone home-screen app can stay open while the log-in happens in
     another tab, so it has to start listening for the result now. */
  window.dispatchEvent(new Event(AUTH_NEEDED));
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
    name: meta.zl_name || meta.full_name || meta.name || meta.custom_claims?.global_name || user.email?.split("@")[0] || "Player",
    /* The name they picked on their profile, if any (it follows the account). */
    chosenName: meta.zl_name || null,
    avatarUrl: meta.avatar_url || meta.picture || null,
  };
}

/** Saves the name picked on the profile to the account, so it shows on
 *  every device. Does nothing when signed out. */
export async function saveAccountName(name) {
  if (!storedSession()) return;
  const supabase = await getSupabase();
  await supabase?.auth.updateUser({ data: { zl_name: name || null } });
}

/** Deletes the signed-in player's account and everything saved with it
 *  (supabase/004_delete_account.sql). Resolves { error } with a message to
 *  show, or {} once it's gone and this browser is signed out. */
export async function deleteAccount() {
  const supabase = await getSupabase();
  if (!supabase) return { error: "Sign-in isn't available right now." };
  const { error } = await supabase.rpc("delete_my_account");
  if (error) return { error: "Couldn't delete it from here. Email us and we'll do it for you." };
  /* The account is gone, so only this browser's copy of the session is left. */
  await supabase.auth.signOut({ scope: "local" }).catch(() => {});
  return {};
}

/* ---------------- One account, several ways in ---------------- */

export const PROVIDERS = [
  { id: "google", label: "Google" },
  { id: "discord", label: "Discord" },
];

/** What the profile page shows about the account: its email and which
 *  logins are connected. Null when signed out. */
export function accountInfo(session) {
  const user = session?.user;
  if (!user) return null;
  const linked = user.identities?.map((i) => i.provider) ?? user.app_metadata?.providers ?? [];
  return { email: user.email ?? null, linked: [...new Set(linked)] };
}

/* A connect in progress, so the page it comes back to can say how it went. */
const LINKING_KEY = "linkingProvider";
const LINK_WINDOW_MS = 10 * 60 * 1000;

/* What the address said when the page loaded, read before the sign-in
   library tidies it away: Supabase reports a failed log-in or connect as
   error_code in the address. */
const landedWith = typeof window === "undefined" ? "" : window.location.hash + window.location.search;

const LINK_ERRORS = {
  identity_already_exists: (name) => `That ${name} account already has its own Zlegend account, so it can't be connected to this one. Email us if you'd like the two joined.`,
  manual_linking_disabled: () => "Connecting accounts isn't switched on yet.",
};

/** Connects another login to the signed-in account. The page leaves for
 *  the provider and comes back to the profile. Resolves { error } if it
 *  couldn't start. */
export async function linkProvider(provider) {
  const supabase = await getSupabase();
  if (!supabase) return { error: "Sign-in isn't available right now." };
  saveSetting(LINKING_KEY, { provider, at: Date.now() });
  const profilePage = `${window.location.origin}/profile`;
  const { error } = await supabase.auth.linkIdentity({
    provider,
    options: { redirectTo: isIosHomeScreenApp() ? beginHandoff(window.location.origin) : profilePage },
  });
  if (!error) return {};
  saveSetting(LINKING_KEY, null);
  const name = PROVIDERS.find((p) => p.id === provider)?.label ?? provider;
  return { error: LINK_ERRORS[error.code]?.(name) ?? `Couldn't connect ${name}. Try again.` };
}

/** Removes a login from the account (never the last one). The session
 *  refreshes, so the page updates by itself. Resolves { error } or {}. */
export async function unlinkProvider(provider) {
  const supabase = await getSupabase();
  if (!supabase) return { error: "Sign-in isn't available right now." };
  const { data, error: listError } = await supabase.auth.getUserIdentities();
  const identities = data?.identities ?? [];
  const identity = identities.find((i) => i.provider === provider);
  if (listError || !identity) return { error: "Couldn't find that login. Refresh and try again." };
  if (identities.length < 2) return { error: "That's your only way to log in, so it has to stay." };
  const { error } = await supabase.auth.unlinkIdentity(identity);
  if (error) return { error: "Couldn't remove it. Try again." };
  await supabase.auth.refreshSession();
  return {};
}

/** After coming back from a connect: { ok, text } to show once, or null.
 *  `account` is accountInfo(session), once the session has loaded. */
export function takeLinkResult(account) {
  const pending = loadSetting(LINKING_KEY, null);
  if (!pending) return null;
  const name = PROVIDERS.find((p) => p.id === pending.provider)?.label ?? pending.provider;
  const code = /error_code=([a-z_]+)/.exec(landedWith)?.[1];
  const failed = code || /[#?&]error=/.test(landedWith);
  if (failed) {
    saveSetting(LINKING_KEY, null);
    return { ok: false, text: LINK_ERRORS[code]?.(name) ?? `${name} wasn't connected. Try again.` };
  }
  if (account?.linked.includes(pending.provider)) {
    saveSetting(LINKING_KEY, null);
    return { ok: true, text: `${name} is connected. You can log in with it from now on.` };
  }
  /* Still on its way (or abandoned): forget it after a while. */
  if (Date.now() - pending.at > LINK_WINDOW_MS) saveSetting(LINKING_KEY, null);
  return null;
}
