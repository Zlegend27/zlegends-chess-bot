const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let clientPromise = null;

/** Lazily loads and creates the Supabase client on first use, so the
 *  ~100KB+ supabase-js library isn't in the initial bundle for players who
 *  never finish a game or open Stats. Falls back to null when env vars
 *  aren't configured (e.g. a local clone without a .env file) so
 *  game-saving quietly no-ops instead of crashing. */
export function getSupabase() {
  if (!url || !anonKey) return Promise.resolve(null);
  if (!clientPromise) {
    clientPromise = import("@supabase/supabase-js").then(({ createClient }) => createClient(url, anonKey));
  }
  return clientPromise;
}
