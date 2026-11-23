/* Rules of the 1v1 lobby, apart from the screen so they can be tested.

   Everyone in the lobby shares their state through Supabase Realtime
   presence: { id, name, avatar, discordUrl, seat, tc, matchId }. There's no
   server deciding anything, so every client works the same answers out of
   the same presence list:
   - Who holds a seat: whoever claimed it first. Someone who clicked the
     same seat a moment later sees they lost it and stands back up.
   - When a match starts: when both seats at a table are held.
   - Who plays White: a coin flip seeded by the match, so both agree. */

export const TABLE_COUNT = 4;

export const TIME_CONTROLS = [
  { id: "5+0", label: "5 min", baseMs: 5 * 60_000, incMs: 0 },
  { id: "10+0", label: "10 min", baseMs: 10 * 60_000, incMs: 0 },
  { id: "3+2", label: "3 min + 2s", baseMs: 3 * 60_000, incMs: 2_000 },
  { id: "none", label: "No clock", baseMs: null, incMs: 0 },
];
export const timeControl = (id) => TIME_CONTROLS.find((t) => t.id === id) ?? TIME_CONTROLS[1];

/** One entry per player from Supabase's presence state ({ key: [meta, …] }):
 *  a player with two tabs open counts once, as their latest state. */
export function playersFrom(presenceState) {
  return Object.values(presenceState)
    .map((metas) => metas[metas.length - 1])
    .filter((p) => p && p.id)
    .sort((a, b) => (a.joinedAt ?? 0) - (b.joinedAt ?? 0));
}

const firstClaim = (a, b) => (a.seat.at - b.seat.at) || (a.id < b.id ? -1 : 1);

/** The tables as everyone sees them: for each, who holds each of its two
 *  seats, the time control (set by whoever sat first) and whether a match
 *  is on. */
export function tablesFrom(players, count = TABLE_COUNT) {
  return Array.from({ length: count }, (_, id) => tableById(players, id));
}

/** One table as everyone sees it. `id` is a public table's number, or a
 *  private table's "inv-…" id (an invite link: it isn't listed in the
 *  lobby, only the two people with the link sit at it). */
export function tableById(players, id) {
  const seats = [0, 1].map((side) => players
    .filter((p) => p.seat?.table === id && p.seat.side === side)
    .sort(firstClaim)[0] ?? null);
  const held = seats.filter(Boolean).sort(firstClaim);
  /* Whoever sat first sets the table: its clock, and whether it's ranked. */
  return { id, seats, tc: held[0]?.tc ?? null, ranked: !!held[0]?.ranked, full: held.length === 2 };
}

/* ---- Invite links: a private table for two friends ---- */
const INVITE_PREFIX = "inv-";
export const isInviteTable = (id) => typeof id === "string" && id.startsWith(INVITE_PREFIX);
export const inviteTableId = (code) => INVITE_PREFIX + code;
/** A fresh invite code: 10 letters and digits, hard to guess. */
export function newInviteCode(random = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32) {
  const abc = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 10 }, () => abc[Math.floor(random() * abc.length)]).join("");
}
/** A code from a link, or null if it isn't one of ours. */
export const cleanInviteCode = (code) => (typeof code === "string" && /^[a-z0-9]{6,16}$/.test(code) ? code : null);

/* ---- Seeks: "Play" in the lobby ----
   A player looking for a game opens their own table ("seek-…") and waits
   on its first seat; whoever takes the other seat plays them. The lobby
   lists the open ones, so with only a few people around nobody waits
   alone at one table while someone else waits at another. */
const SEEK_PREFIX = "seek-";
export const isSeekTable = (id) => typeof id === "string" && id.startsWith(SEEK_PREFIX);
export const seekTableId = () => SEEK_PREFIX + newInviteCode();

/** Everyone else waiting for a game, oldest first: { table, player, tc,
 *  ranked }. Skips my own, full ones, and players I've blocked. */
export function openSeeks(players, meId, blocked = []) {
  return players
    .filter((p) => p.seat && isSeekTable(p.seat.table) && p.seat.side === 0 && !p.playing && p.id !== meId && !blocked.includes(p.id))
    .map((p) => ({ table: tableById(players, p.seat.table), player: p }))
    .filter(({ table }) => !table.full && table.seats[0]?.id !== meId)
    .map(({ table, player }) => ({ table: table.id, player, tc: table.tc ?? TIME_CONTROLS[1].id, ranked: table.ranked, at: player.seat.at }))
    .sort((a, b) => a.at - b.at || (a.player.id < b.player.id ? -1 : 1));
}

/** The seek "Play" should join: the oldest one with the same clock and
 *  game type, or null (then I open my own). */
export const matchingSeek = (seeks, tc, ranked) => seeks.find((s) => s.tc === tc && !!s.ranked === !!ranked) ?? null;

/** Two people pressed Play at the same moment with the same settings, and
 *  each opened a seek. The one who opened later joins the earlier one;
 *  both clients agree which, so they never swap places. Returns the seek
 *  to move to, or null. */
export function olderTwin(seeks, mine) {
  if (!mine) return null;
  return seeks.find((s) => s.tc === mine.tc && !!s.ranked === !!mine.ranked
    && (s.at < mine.at || (s.at === mine.at && s.player.id < mine.meId))) ?? null;
}

/** The table a seat is at: a public one from `tables`, or a private or
 *  seek one worked out from the players. */
export const tableOfSeat = (seat, tables, players) => (seat ? (typeof seat.table === "string" ? tableById(players, seat.table) : tables[seat.table]) : null);

/** Whether `me` really holds the seat they claim (false if someone else got
 *  there first, or they claim none). `players` is needed for private
 *  tables. */
export function holdsSeat(me, tables, players = []) {
  if (!me?.seat) return false;
  return tableOfSeat(me.seat, tables, players)?.seats[me.seat.side]?.id === me.id;
}

/** A tiny stable hash, so both players flip the same coin. */
function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** The match at a full table, the same on both clients:
 *  { id, white, black, tc }, or null if the table isn't full. `prefix`
 *  keeps the match ids of different lobbies apart. */
export function matchAt(table, prefix = "") {
  if (!table.full) return null;
  const [a, b] = [...table.seats].sort((x, y) => (x.id < y.id ? -1 : 1));
  const startedAt = Math.min(a.seat.at, b.seat.at);
  const id = `${prefix}t${table.id}-${startedAt}-${a.id.slice(0, 8)}-${b.id.slice(0, 8)}`;
  const aIsWhite = hash(id) % 2 === 0;
  /* Ranked needs two real accounts (local development guests don't count). */
  const ranked = !!table.ranked && ![a.id, b.id].some((who) => String(who).startsWith("guest-"));
  return { id, white: aIsWhite ? a : b, black: aIsWhite ? b : a, tc: table.tc ?? TIME_CONTROLS[1].id, ranked };
}

/* Ranked 1v1 moves a player's rating by the usual Elo rule. Someone with no
   rating yet counts as UNRATED_ELO. */
export const UNRATED_ELO = 1000;
const ELO_K = 24;
/** The rating change for a result: `score` is 1 for a win, 0.5 a draw, 0 a loss. */
export function eloChange(mine, theirs, score) {
  const expected = 1 / (1 + 10 ** (((theirs ?? UNRATED_ELO) - (mine ?? UNRATED_ELO)) / 400));
  return Math.round(ELO_K * (score - expected));
}

/** The match after this one when both players ask for a rematch: the same
 *  two players with colours swapped. Its id keeps both players' ids in it
 *  (the database lets only them join), with a rematch count on the end. */
export function rematchOf(match) {
  const base = match.id.replace(/-r\d+$/, "");
  const round = Number(/-r(\d+)$/.exec(match.id)?.[1] ?? 0) + 1;
  return { ...match, id: `${base}-r${round}`, white: match.black, black: match.white };
}

/** "4:05", or "0:09.3" under ten seconds; "–" without a clock. */
export function clockText(ms) {
  if (ms == null) return "–";
  const left = Math.max(0, ms);
  const m = Math.floor(left / 60_000);
  const s = Math.floor((left % 60_000) / 1000);
  if (left < 10_000) return `0:0${s}.${Math.floor((left % 1000) / 100)}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}
