/* ================================================================
   A 1v1 lobby room, without its screen, so the main lobby and Chess
   Tactica's lobby work the same way (each in its own room, so players
   only meet people playing the same game).

   Everyone shares their state over Supabase Realtime presence (see
   utils/lobby.js for how every client agrees on seats and matches from
   that list without a server). Signing in is required; in local
   development a guest identity per tab stands in, so two tabs can test
   it.
   ================================================================ */
import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabase } from "../utils/supabase";
import { loadSetting, saveSetting } from "../utils/storage";
import { playersFrom, tablesFrom, holdsSeat, matchAt, tableOfSeat, inviteTableId, newInviteCode, isInviteTable, isSeekTable, seekTableId, openSeeks, matchingSeek, olderTwin } from "../utils/lobby";
import { DEFAULT_AVATAR } from "../utils/avatar";
import { cleanName } from "../utils/cleanName";
import { openChannel } from "./channel";

/** In local development, a different guest per tab so two tabs can play. */
function devGuest() {
  let id = sessionStorage.getItem("zlDevGuest");
  if (!id) { id = `guest-${crypto.randomUUID()}`; sessionStorage.setItem("zlDevGuest", id); }
  return { id, name: `Guest ${id.slice(6, 10)}`, avatar: { ...DEFAULT_AVATAR, shirt: id.charCodeAt(7) % 8 }, discordUrl: null };
}

/** Who I am in a lobby: the signed-in player, a dev guest, or null. */
export function useLobbyMe({ session, profile, displayName, avatar }) {
  const signedIn = !!session?.user?.id;
  const me = useMemo(() => {
    if (signedIn) {
      const name = displayName && displayName !== "Challenger" ? displayName : profile?.name || "Player";
      return { id: session.user.id, name, avatar, discordUrl: profile?.avatarUrl ?? null };
    }
    return import.meta.env.DEV ? devGuest() : null;
  }, [signedIn, session?.user?.id, displayName, profile?.name, profile?.avatarUrl, avatar]);
  return { me, signedIn };
}

/** `room`: the Realtime channel; `matchPrefix` keeps match ids (and so
 *  their channels) apart between rooms; the keys keep each room's saved
 *  clock choice and active match apart on this device. */
export function useLobby({ me, rating = null, room = "lobby-v1", activeKey = "pvpActive", tcKey = "pvpTc", matchPrefix = "" }) {
  const [supabase, setSupabase] = useState(null);
  const [connected, setConnected] = useState(false);
  /* The room can't be reached (offline, or the server refused): said on
     the page with a "Try again", instead of "Connecting…" forever. */
  const [stuck, setStuck] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const retry = () => { setStuck(false); setAttempt((n) => n + 1); };
  useEffect(() => {
    if (connected) { setStuck(false); return; }
    const t = setTimeout(() => setStuck(true), 12000);
    return () => clearTimeout(t);
  }, [connected, attempt]);
  const [players, setPlayers] = useState([]);
  const [seat, setSeat] = useState(null); // { table, side, at }
  const [tcId, setTcId] = useState(() => loadSetting(tcKey, "10+0"));
  const [match, setMatch] = useState(() => loadSetting(activeKey, null));
  const [note, setNote] = useState(null);
  /* A table I open is ranked or casual; it only applies between two accounts. */
  const [ranked, setRanked] = useState(() => loadSetting(tcKey + "Ranked", false));
  useEffect(() => { saveSetting(tcKey + "Ranked", ranked); }, [tcKey, ranked]);
  /* Players I've blocked on this device: I never get matched with them. */
  const [blocked, setBlocked] = useState(() => loadSetting("pvpBlocked", []));
  const block = (id) => setBlocked((list) => { const next = [...new Set([...list, id])].slice(-200); saveSetting("pvpBlocked", next); return next; });
  const joinedAt = useRef(Date.now());
  const channelRef = useRef(null);

  useEffect(() => { saveSetting(tcKey, tcId); }, [tcKey, tcId]);
  useEffect(() => { saveSetting(activeKey, match); }, [activeKey, match]);
  useEffect(() => { getSupabase().then(setSupabase); }, []);

  /* Join the room. */
  useEffect(() => {
    if (!supabase || !me) return;
    const joined = openChannel(supabase, room, { presence: { key: me.id } }, {
      /* Local development guests aren't signed in. */
      signedIn: !me.id.startsWith("guest-"),
      build: (channel) => {
        channelRef.current = channel;
        /* Other players' names pass the name filter before anyone sees them. */
        channel.on("presence", { event: "sync" }, () => setPlayers(playersFrom(channel.presenceState()).map((p) => ({ ...p, name: cleanName(p.name) }))));
      },
      onStatus: (status) => {
        setConnected(status === "SUBSCRIBED");
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setStuck(true);
      },
    });
    return () => { joined.close(); channelRef.current = null; setConnected(false); };
  }, [supabase, me, room, attempt]);

  /* Tell the room where I am, whenever that changes. */
  useEffect(() => {
    if (!connected || !me) return;
    channelRef.current?.track({
      id: me.id, name: me.name, avatar: me.avatar, discordUrl: me.discordUrl,
      seat: match ? match.seat ?? seat : seat, tc: tcId, ranked, elo: rating, playing: match?.id ?? null, joinedAt: joinedAt.current,
    });
  }, [connected, me, seat, tcId, ranked, rating, match]);

  const tables = useMemo(() => tablesFrom(players), [players]);
  const mePresent = players.find((p) => p.id === me?.id);

  /* Seeks: everyone else waiting for a game, and whether I am. */
  const seeks = useMemo(() => openSeeks(players, me?.id, blocked), [players, me, blocked]);
  const searching = !!seat && !match && isSeekTable(seat.table) && seat.side === 0;
  /* Pressed Play at the same moment as someone with the same settings:
     the later of the two joins the earlier (olderTwin), so they play. */
  useEffect(() => {
    if (!searching || !mePresent?.seat) return;
    const twin = olderTwin(seeks, { tc: tcId, ranked, at: seat.at, meId: me.id });
    if (twin) setSeat({ table: twin.table, side: 1, at: Date.now() });
  }, [searching, seeks, tcId, ranked, seat, me, mePresent]);

  /* Lost a seat to someone who got there first; or a table filled: start. */
  useEffect(() => {
    if (!seat || match || !mePresent?.seat) return;
    if (!holdsSeat(mePresent, tables, players)) {
      setSeat(null);
      setNote(isInviteTable(seat.table) ? "Someone else already took that invite." : isSeekTable(seat.table) ? "Someone else took that game a moment before you." : "Someone sat there a moment before you.");
      return;
    }
    const found = matchAt(tableOfSeat(seat, tables, players), matchPrefix);
    if (!found) return;
    const other = found.white.id === me.id ? found.black : found.white;
    if (blocked.includes(other.id)) {
      setSeat(null);
      setNote("That seat was taken by someone you've blocked, so you stood up.");
      return;
    }
    setMatch({ ...found, seat });
  }, [tables, players, seat, match, mePresent, matchPrefix, blocked, me]);

  return {
    supabase, connected, stuck, retry, players, tables, seat, tcId, setTcId, ranked, setRanked, blocked, block, match, note,
    /** Both players asked for another game: on to it, same seats. */
    rematch: (next) => setMatch((m) => ({ ...next, seat: m?.seat ?? seat })),
    /** Players in the room who are neither seated nor playing. */
    standing: players.filter((p) => !p.seat && !p.playing),
    sit: (table, side) => { setNote(null); setSeat({ table, side, at: Date.now() }); },
    /** Opens a private table and returns its code, for a link to a friend. */
    invite: () => { const code = newInviteCode(); setNote(null); setSeat({ table: inviteTableId(code), side: 0, at: Date.now() }); return code; },
    /** Sits at a friend's private table (the other seat to theirs). */
    joinInvite: (code) => { setNote(null); setSeat({ table: inviteTableId(code), side: 1, at: Date.now() }); },
    /** The private table I'm at, if any (who's there, its clock). */
    inviteTable: seat && isInviteTable(seat.table) ? tableOfSeat(seat, tables, players) : null,
    standUp: () => setSeat(null),
    /** Others waiting for a game, oldest first, and whether I'm waiting. */
    seeks, searching,
    /** Play: join someone waiting with the same clock and game type, or
     *  wait for the next person myself. */
    seek: () => {
      setNote(null);
      const m = matchingSeek(seeks, tcId, ranked);
      setSeat(m ? { table: m.table, side: 1, at: Date.now() } : { table: seekTableId(), side: 0, at: Date.now() });
    },
    /** Play someone who's waiting, on their clock and game type. */
    accept: (s) => { setNote(null); setSeat({ table: s.table, side: 1, at: Date.now() }); },
    leaveMatch: () => { setMatch(null); setSeat(null); },
  };
}
