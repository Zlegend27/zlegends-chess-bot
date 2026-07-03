/* Opening book: prefer real master/lichess opening theory over search while
   it's available, weighted by how often each move was actually played.
   Falls back to a small hardcoded book on network failure/timeout, so a
   flaky connection never stalls or breaks a game — this matters more here
   than on most sites since Kinnda Chess runs on a tablet. Once neither
   source has data for the position, the caller falls back to normal search. */

const EXPLORER_URL = "https://explorer.lichess.org/lichess";

/* Covers only the first couple of plies of a handful of common openings —
   just enough that the bot doesn't play something bizarre if Explorer is
   unreachable. Keyed by the SAN move list played so far, space-joined. */
const STATIC_BOOK = {
  "": [["e4", 5], ["d4", 4], ["c4", 2], ["Nf3", 2]],
  "e4": [["e5", 4], ["c5", 4], ["e6", 2], ["c6", 2], ["d5", 1]],
  "d4": [["d5", 4], ["Nf6", 4], ["e6", 1], ["c5", 1]],
  "c4": [["e5", 2], ["Nf6", 3], ["c5", 2]],
  "Nf3": [["d5", 2], ["Nf6", 3], ["c5", 1]],
  "e4 e5": [["Nf3", 4], ["Bc4", 2], ["Nc3", 1]],
  "e4 c5": [["Nf3", 4], ["Nc3", 2], ["c3", 1]],
  "e4 e6": [["d4", 4], ["Nc3", 1]],
  "e4 c6": [["d4", 4], ["Nc3", 1]],
  "d4 d5": [["c4", 4], ["Nf3", 3]],
  "d4 Nf6": [["c4", 4], ["Nf3", 3]],
  "e4 e5 Nf3": [["Nc6", 4], ["Nf6", 1]],
  "e4 e5 Nf3 Nc6": [["Bb5", 3], ["Bc4", 3], ["d4", 1]],
  "d4 d5 c4": [["e6", 3], ["c6", 3], ["dxc4", 1]],
};

function pickWeighted(entries) {
  const total = entries.reduce((s, e) => s + e.weight, 0);
  if (total <= 0) return null;
  let r = Math.random() * total;
  for (const e of entries) {
    r -= e.weight;
    if (r <= 0) return e.san;
  }
  return entries[entries.length - 1].san;
}

export function getStaticBookMove(moveList) {
  const entry = STATIC_BOOK[moveList.join(" ")];
  if (!entry) return null;
  return pickWeighted(entry.map(([san, weight]) => ({ san, weight })));
}

export async function fetchExplorerMove(fenStr, { timeoutMs = 2500 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = `${EXPLORER_URL}?fen=${encodeURIComponent(fenStr)}&moves=12&topGames=0&recentGames=0`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const data = await res.json();
    const moves = data && data.moves;
    if (!moves || !moves.length) return null;
    const entries = moves
      .map(m => ({ san: m.san, weight: (m.white || 0) + (m.draws || 0) + (m.black || 0) }))
      .filter(e => e.weight > 0);
    const total = entries.reduce((s, e) => s + e.weight, 0);
    if (total < 20) return null; // too little data in the database to trust
    return pickWeighted(entries);
  } catch {
    return null; // offline, timed out, CORS hiccup — caller falls back
  } finally {
    clearTimeout(timer);
  }
}

export async function getBookMove(fenStr, moveList, opts) {
  const explorerMove = await fetchExplorerMove(fenStr, opts);
  if (explorerMove) return explorerMove;
  return getStaticBookMove(moveList);
}
