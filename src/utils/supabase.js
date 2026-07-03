import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Falls back to null when env vars aren't configured (e.g. a local clone
// without a .env file) so game-saving quietly no-ops instead of crashing.
export const supabase = url && anonKey ? createClient(url, anonKey) : null;
