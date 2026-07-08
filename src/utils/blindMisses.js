/* ================================================================
   Blind Chess — unrecognized-utterance logging.

   Every "I didn't understand that" is parser training data: the
   exact phrasings real players use that the slot-filler misses.
   Only FAILED parses are logged (never successfully understood
   speech), kept in a small local ring buffer plus a best-effort
   Supabase insert following gameHistory.js's never-throw pattern.
   Review them after launch and turn the common misses into parser
   patterns.
   ================================================================ */

import { getSupabase } from "./supabase";
import { getClientId } from "./clientId";

const KEY = "blindMisses";
const MAX_LOCAL = 50;

export function logBlindMiss(text) {
  if (!text) return;
  try {
    const arr = JSON.parse(localStorage.getItem(KEY) || "[]");
    arr.push({ text, at: Date.now() });
    localStorage.setItem(KEY, JSON.stringify(arr.slice(-MAX_LOCAL)));
  } catch { /* storage full/blocked — not worth surfacing */ }
  getSupabase().then((supabase) => {
    if (!supabase) return;
    return supabase.from("blind_utterances").insert({ client_id: getClientId(), text });
  }).then(() => {}, () => { /* table may not exist yet — fine */ });
}

/** The locally kept misses, newest last — handy for debugging in the
 *  console: `JSON.parse(localStorage.blindMisses)`. */
export function getLocalMisses() {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
