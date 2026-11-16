/* Brings a player's finished games in from Chess.com or Lichess for Game
   Review, by username or by a game link. Both sites publish finished games
   openly, so no login or key is involved: the browser asks the site
   directly, and the only thing sent is the username or game id the player
   typed. Nothing here goes through our own database. */

export const SITES = {
  chesscom: { id: "chesscom", label: "Chess.com" },
  lichess: { id: "lichess", label: "Lichess" },
};

const NAME_OK = /^[A-Za-z0-9_-]{2,30}$/;
/** A username as typed, tidied ("@name", a profile link or stray spaces all
 *  work), or null if it can't be a username on either site. */
export function cleanUsername(text) {
  const t = (text || "").trim().replace(/^@/, "").replace(/\/+$/, "");
  const last = t.includes("/") ? t.slice(t.lastIndexOf("/") + 1) : t;
  return NAME_OK.test(last) ? last : null;
}

/** What a pasted link points at: { site, id } for a single game, or null.
 *  Lichess ids are 8 characters (a 12-character one carries the player's
 *  private half, which is dropped), optionally followed by /white or /black. */
export function parseGameLink(text) {
  const t = (text || "").trim();
  if (/\s/.test(t)) return null;
  const lichess = t.match(/^(?:https?:\/\/)?(?:www\.)?lichess\.org\/(?:embed\/)?(?:game\/export\/)?([A-Za-z0-9]{8})(?:[A-Za-z0-9]{4})?(?:\/(?:white|black))?(?:[?#].*)?$/i);
  if (lichess) return { site: "lichess", id: lichess[1] };
  const chesscom = t.match(/^(?:https?:\/\/)?(?:www\.)?chess\.com\/(?:[a-z]{2}(?:-[A-Za-z]{2})?\/)?(?:analysis\/)?game\/(live|daily)\/(\d+)/i);
  if (chesscom) return { site: "chesscom", id: chesscom[2], kind: chesscom[1].toLowerCase() };
  return null;
}

/* How a game ended, in Chess.com's result codes, as plain words. */
const CHESSCOM_ENDINGS = {
  checkmated: "checkmate", resigned: "resignation", timeout: "time", abandoned: "abandonment",
  agreed: "agreement", stalemate: "stalemate", repetition: "repetition", insufficient: "insufficient material",
  "50move": "the 50-move rule", timevsinsufficient: "time against insufficient material",
};
const DRAWS = new Set(["agreed", "stalemate", "repetition", "insufficient", "50move", "timevsinsufficient"]);

const plyCount = (pgn) => {
  const body = (pgn || "").replace(/\[[^\]]*\]/g, " ").replace(/\{[^}]*\}/g, " ");
  return (body.match(/(?:^|\s)(?:[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?|O-O(?:-O)?)[+#]?(?=\s|$)/g) || []).length;
};
const sameName = (a, b) => (a || "").toLowerCase() === (b || "").toLowerCase();

/** One Chess.com archive game as a row for the list, seen from `username`'s
 *  side, or null if it isn't a normal chess game with moves. */
export function chessComRow(game, username) {
  if (!game?.pgn || (game.rules && game.rules !== "chess")) return null;
  const youAreWhite = sameName(game.white?.username, username);
  const youAreBlack = sameName(game.black?.username, username);
  const color = youAreWhite ? 1 : youAreBlack ? -1 : null;
  const me = color === -1 ? game.black : game.white;
  const them = color === -1 ? game.white : game.black;
  const loserCode = game.white?.result === "win" ? game.black?.result : game.black?.result === "win" ? game.white?.result : null;
  const drawn = DRAWS.has(game.white?.result);
  const outcome = drawn ? "draw" : color == null ? (game.white?.result === "win" ? "white" : "black") : me?.result === "win" ? "win" : "loss";
  const how = CHESSCOM_ENDINGS[drawn ? game.white.result : loserCode] || null;
  const acc = game.accuracies && Number.isFinite(game.accuracies.white) && Number.isFinite(game.accuracies.black)
    ? { white: game.accuracies.white, black: game.accuracies.black } : null;
  return {
    id: game.uuid || game.url, site: "chesscom", url: game.url || null, pgn: game.pgn, color,
    white: game.white?.username || "White", black: game.black?.username || "Black",
    whiteElo: game.white?.rating ?? null, blackElo: game.black?.rating ?? null,
    opponent: them?.username || "Opponent", opponentElo: them?.rating ?? null,
    outcome, how, speed: game.time_class || null, plies: plyCount(game.pgn),
    endedAt: game.end_time ? game.end_time * 1000 : null, siteAccuracy: acc,
  };
}

const LICHESS_ENDINGS = { mate: "checkmate", resign: "resignation", outoftime: "time", timeout: "abandonment", stalemate: "stalemate", draw: "agreement" };

/** One Lichess game (from its JSON export) as a row, or null if it's a
 *  variant or has no moves. */
export function lichessRow(game, username) {
  if (!game?.pgn || (game.variant && game.variant !== "standard") || !game.moves) return null;
  const name = (side) => game.players?.[side]?.user?.name || (game.players?.[side]?.aiLevel ? `Stockfish level ${game.players[side].aiLevel}` : "Anonymous");
  const youAreWhite = sameName(name("white"), username);
  const youAreBlack = sameName(name("black"), username);
  const color = youAreWhite ? 1 : youAreBlack ? -1 : null;
  const them = color === -1 ? "white" : "black";
  const winner = game.winner === "white" ? 1 : game.winner === "black" ? -1 : 0;
  const outcome = winner === 0 ? "draw" : color == null ? (winner === 1 ? "white" : "black") : winner === color ? "win" : "loss";
  return {
    id: game.id, site: "lichess", url: `https://lichess.org/${game.id}`, pgn: game.pgn, color,
    white: name("white"), black: name("black"),
    whiteElo: game.players?.white?.rating ?? null, blackElo: game.players?.black?.rating ?? null,
    opponent: name(them), opponentElo: game.players?.[them]?.rating ?? null,
    outcome, how: LICHESS_ENDINGS[game.status] || null, speed: game.speed || null,
    plies: game.moves.split(" ").filter(Boolean).length,
    endedAt: game.lastMoveAt ?? game.createdAt ?? null, siteAccuracy: null,
  };
}

const unreachable = (site) => `Couldn't reach ${SITES[site].label}. Check your connection and try again, or paste the game instead.`;
const noPlayer = (site, name) => `There's no ${SITES[site].label} player called "${name}". Check the spelling.`;

async function getJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (res.status === 404 || res.status === 410) return { missing: true };
  if (res.status === 429) return { busy: true };
  if (!res.ok) throw new Error(String(res.status));
  return { data: await res.json() };
}

const WANT = 12;
/** A Chess.com player's latest games, newest first. `before` is the list of
 *  monthly archives still unread (from an earlier call), for "show more".
 *  Returns { games, more } or { error }. */
export async function fetchChessComGames(username, before = null) {
  try {
    let months = before;
    if (!months) {
      const r = await getJson(`https://api.chess.com/pub/player/${encodeURIComponent(username.toLowerCase())}/games/archives`);
      if (r.missing) return { error: noPlayer("chesscom", username) };
      if (r.busy) return { error: "Chess.com is busy right now. Try again in a minute." };
      months = [...(r.data.archives || [])].reverse();
      if (!months.length) return { games: [], more: null };
    }
    const games = [];
    let i = 0;
    /* A quiet month may hold nothing, so read on until there's a screenful
       (three months at most per press). */
    for (; i < months.length && i < 3 && games.length < WANT; i++) {
      const r = await getJson(months[i]);
      if (r.busy) return games.length ? { games, more: months.slice(i) } : { error: "Chess.com is busy right now. Try again in a minute." };
      const rows = (r.data?.games || []).map((g) => chessComRow(g, username)).filter(Boolean);
      games.push(...rows.sort((a, b) => (b.endedAt || 0) - (a.endedAt || 0)));
    }
    return { games, more: i < months.length ? months.slice(i) : null };
  } catch {
    return { error: unreachable("chesscom") };
  }
}

/** A Lichess player's latest games, newest first. `before` is the time of
 *  the oldest game already shown, for "show more". */
export async function fetchLichessGames(username, before = null) {
  try {
    const url = `https://lichess.org/api/games/user/${encodeURIComponent(username)}?max=${WANT}&pgnInJson=true&perfType=ultraBullet,bullet,blitz,rapid,classical,correspondence${before ? `&until=${before - 1}` : ""}`;
    const res = await fetch(url, { headers: { Accept: "application/x-ndjson" } });
    if (res.status === 404) return { error: noPlayer("lichess", username) };
    if (res.status === 429) return { error: "Lichess is busy right now. Try again in a minute." };
    if (!res.ok) throw new Error(String(res.status));
    const lines = (await res.text()).split("\n").filter(Boolean);
    const raw = lines.map((l) => JSON.parse(l));
    const games = raw.map((g) => lichessRow(g, username)).filter(Boolean);
    const oldest = raw.length ? Math.min(...raw.map((g) => g.createdAt)) : null;
    return { games, more: raw.length >= WANT ? oldest : null };
  } catch {
    return { error: unreachable("lichess") };
  }
}

/** The PGN of one Lichess game, from its id. Returns { pgn } or { error }. */
export async function fetchLichessGame(id) {
  try {
    const res = await fetch(`https://lichess.org/game/export/${encodeURIComponent(id)}?clocks=false&evals=false`, { headers: { Accept: "application/x-chess-pgn" } });
    if (res.status === 404) return { error: "Lichess has no game at that link. Check that you copied all of it." };
    if (!res.ok) throw new Error(String(res.status));
    return { pgn: await res.text() };
  } catch {
    return { error: unreachable("lichess") };
  }
}

/** One Chess.com game from its link. Chess.com has no open way to fetch a
 *  game by its number, so this looks for it among a player's recent months
 *  (`username` is whose games to search). Returns { game } or { error }. */
export async function findChessComGame(id, username) {
  let months = null;
  for (let page = 0; page < 2; page++) {
    const r = await fetchChessComGames(username, months);
    if (r.error) return r;
    const hit = r.games.find((g) => g.url && g.url.endsWith("/" + id));
    if (hit) return { game: hit };
    if (!r.more) break;
    months = r.more;
  }
  return { error: `Couldn't find that game in ${username}'s recent Chess.com games. Pick it from the list instead.` };
}
