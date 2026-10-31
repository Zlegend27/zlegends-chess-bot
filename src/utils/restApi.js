/* Plain reads from Supabase, without the Supabase library. The library is
   about 55KB compressed and only matters for signing in and for writing, so
   Home's reads (recent games, the rating, the Rank Bot checkpoint) go
   straight to the REST API. The anon key can already read these tables, and
   a signed-in player's token is sent when there is one, so the results are
   the same either way. */
const URL = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isConfigured = () => !!(URL && KEY);

/* The library keeps its session under sb-<project>-auth-token. */
const storageKey = () => `sb-${new URL(URL).hostname.split(".")[0]}-auth-token`;

/** The stored session, if the player has signed in on this browser before. */
export function storedSession() {
  if (!isConfigured()) return null;
  try {
    const session = JSON.parse(localStorage.getItem(storageKey()) || "null");
    return session?.access_token ? session : null;
  } catch {
    return null;
  }
}

/** The signed-in player's id, even if their token has expired. Their rows
 *  are still filtered by it, and the anon key can read every row. */
export function storedUserId() {
  return storedSession()?.user?.id ?? null;
}

/** GET from the REST API. `params` is a query string. Throws on a failed
 *  request, so callers can show their own "couldn't reach" message. */
export async function restGet(table, params) {
  const session = storedSession();
  const fresh = session && session.expires_at * 1000 > Date.now();
  const bearer = fresh ? session.access_token : KEY;
  const res = await fetch(`${URL}/rest/v1/${table}?${params}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${bearer}` },
  });
  if (!res.ok) throw new Error(`${table} read failed (${res.status})`);
  return res.json();
}
