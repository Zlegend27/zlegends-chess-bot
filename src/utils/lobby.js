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
  return Array.from({ length: count }, (_, id) => {
    const seats = [0, 1].map((side) => players
      .filter((p) => p.seat?.table === id && p.seat.side === side)
      .sort(firstClaim)[0] ?? null);
    const held = seats.filter(Boolean).sort(firstClaim);
    return { id, seats, tc: held[0]?.tc ?? null, full: held.length === 2 };
  });
}

/** Whether `me` really holds the seat they claim (false if someone else got
 *  there first, or they claim none). */
export function holdsSeat(me, tables) {
  if (!me?.seat) return false;
  return tables[me.seat.table]?.seats[me.seat.side]?.id === me.id;
}

/** A tiny stable hash, so both players flip the same coin. */
function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** The match at a full table, the same on both clients:
 *  { id, white, black, tc }, or null if the table isn't full. */
export function matchAt(table) {
  if (!table.full) return null;
  const [a, b] = [...table.seats].sort((x, y) => (x.id < y.id ? -1 : 1));
  const startedAt = Math.min(a.seat.at, b.seat.at);
  const id = `t${table.id}-${startedAt}-${a.id.slice(0, 8)}-${b.id.slice(0, 8)}`;
  const aIsWhite = hash(id) % 2 === 0;
  return { id, white: aIsWhite ? a : b, black: aIsWhite ? b : a, tc: table.tc ?? TIME_CONTROLS[1].id };
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
