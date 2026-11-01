/* How the live Rank Bot is doing, from what real games logged. Read-only.
   Results are grouped by design version (`v` in each move's detail), so a rule
   change can be compared with what came before it.

   Usage: node scripts/review-lab/rankbot-live.mjs */
import { readFileSync } from "node:fs";

const env = Object.fromEntries(readFileSync(new URL("../../.env", import.meta.url), "utf8")
  .split(/\r?\n/).filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));

async function all(table, select) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const url = `${env.VITE_SUPABASE_URL}/rest/v1/${table}?select=${select}&order=created_at.asc&limit=1000&offset=${offset}`;
    const res = await fetch(url, { headers: { apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}` } });
    if (!res.ok) throw new Error(`${table}: ${await res.text()}`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

const moves = (await all("rank_bot_moves", "game_uid,ply,detail")).filter((m) => m.detail);
if (!moves.length) { console.log("No moves with detail yet."); process.exit(0); }
const uids = new Set(moves.map((m) => m.game_uid));
const games = (await all("games", "game_uid,player_color,winner,result_reason,moves")).filter((g) => uids.has(g.game_uid));

const pct = (n, of) => `${Math.round((100 * n) / (of || 1))}%`;
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1] ?? 0; };
const table = {};
for (const v of [...new Set(moves.map((m) => m.detail.v))]) {
  const rows = moves.filter((m) => m.detail.v === v).map((m) => m.detail);
  const held = rows.filter((d) => d.mode !== "closing");
  const ids = new Set(moves.filter((m) => m.detail.v === v).map((m) => m.game_uid));
  const list = games.filter((g) => ids.has(g.game_uid));
  const decided = list.filter((g) => g.result_reason !== "Abandoned");
  table[`v${v}`] = {
    games: list.length,
    playerWins: decided.filter((g) => g.winner === g.player_color).length,
    botWins: decided.filter((g) => g.winner && g.winner !== g.player_color).length,
    draws: decided.filter((g) => !g.winner).length,
    abandoned: list.length - decided.length,
    medianLead: median(held.map((d) => d.lead)),
    medianStep: median(held.map((d) => d.step)),
    withinTwoSteps: pct(held.filter((d) => d.lead >= 0 && d.lead <= 2 * d.step).length, held.length),
    behind: pct(held.filter((d) => d.lead < 0).length, held.length),
    human: pct(rows.filter((d) => d.human).length, rows.length),
    notEngineBest: pct(rows.filter((d) => d.rank !== 1).length, rows.length),
    maiaFailed: pct(rows.filter((d) => d.mode === "maia failed").length, rows.length),
    checksFailed: rows.reduce((a, d) => a + (d.rejected || 0), 0),
    medianMs: median(rows.map((d) => d.totalMs)),
    slowestMs: Math.max(...rows.map((d) => d.totalMs)),
    lowestPace: Math.min(...rows.map((d) => d.pace)),
  };
}
console.table(table);
