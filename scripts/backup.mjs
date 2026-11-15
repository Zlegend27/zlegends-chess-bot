/* Saves a copy of the site's data to this computer, one JSON file per
   table, in backups/<date>/ (never committed). Run it weekly:

     node scripts/backup.mjs

   It reads with the key in .env. For a complete backup add this line to
   .env (it's already kept out of git), using the "service_role" key from
   Supabase > Project Settings > API keys:

     SUPABASE_SERVICE_KEY=...

   That key can read and write everything, so it must never go in the
   site's code, a chat, or anywhere public. Without it, the script saves
   only what the public key may read and says so. Accounts themselves
   (emails, logins) aren't in these tables; Supabase keeps those. */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const env = Object.fromEntries(readFileSync(new URL("../.env", import.meta.url), "utf8")
  .split(/\r?\n/).filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]));
const base = env.VITE_SUPABASE_URL?.replace(/\/$/, "");
const key = env.SUPABASE_SERVICE_KEY || env.VITE_SUPABASE_ANON_KEY;
if (!base || !key) { console.error("No Supabase address or key in .env."); process.exit(1); }

const TABLES = ["games", "players", "rush_scores", "rank_bot_moves", "blind_utterances", "events"];
const PAGE = 1000;
const day = new Date().toISOString().slice(0, 10);
const dir = new URL(`../backups/${day}/`, import.meta.url);
mkdirSync(dir, { recursive: true });

for (const table of TABLES) {
  const rows = [];
  let note = "";
  for (let offset = 0; ; offset += PAGE) {
    const res = await fetch(`${base}/rest/v1/${table}?select=*&limit=${PAGE}&offset=${offset}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!res.ok) { note = res.status === 404 ? "no such table yet" : `couldn't read (${res.status})`; break; }
    const page = await res.json();
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  if (note) { console.log(`${table}: ${note}`); continue; }
  writeFileSync(new URL(`${table}.json`, dir), JSON.stringify(rows));
  console.log(`${table}: ${rows.length} rows`);
}
console.log(`Saved to backups/${day}/` + (env.SUPABASE_SERVICE_KEY ? "" : "  (public key only: tables it can't read come out empty; see the note at the top of this file)"));
