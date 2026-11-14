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
import { playersFrom, tablesFrom, holdsSeat, matchAt } from "../utils/lobby";
import { DEFAULT_AVATAR } from "../utils/avatar";

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
export function useLobby({ me, room = "lobby-v1", activeKey = "pvpActive", tcKey = "pvpTc", matchPrefix = "" }) {
  const [supabase, setSupabase] = useState(null);
  const [connected, setConnected] = useState(false);
  const [players, setPlayers] = useState([]);
  const [seat, setSeat] = useState(null); // { table, side, at }
  const [tcId, setTcId] = useState(() => loadSetting(tcKey, "10+0"));
  const [match, setMatch] = useState(() => loadSetting(activeKey, null));
  const [note, setNote] = useState(null);
  const joinedAt = useRef(Date.now());
  const channelRef = useRef(null);

  useEffect(() => { saveSetting(tcKey, tcId); }, [tcKey, tcId]);
  useEffect(() => { saveSetting(activeKey, match); }, [activeKey, match]);
  useEffect(() => { getSupabase().then(setSupabase); }, []);

  /* Join the room. */
  useEffect(() => {
    if (!supabase || !me) return;
    const channel = supabase.channel(room, { config: { presence: { key: me.id } } });
    channelRef.current = channel;
    channel
      .on("presence", { event: "sync" }, () => setPlayers(playersFrom(channel.presenceState())))
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));
    return () => { supabase.removeChannel(channel); channelRef.current = null; setConnected(false); };
  }, [supabase, me, room]);

  /* Tell the room where I am, whenever that changes. */
  useEffect(() => {
    if (!connected || !me) return;
    channelRef.current?.track({
      id: me.id, name: me.name, avatar: me.avatar, discordUrl: me.discordUrl,
      seat: match ? match.seat ?? seat : seat, tc: tcId, playing: match?.id ?? null, joinedAt: joinedAt.current,
    });
  }, [connected, me, seat, tcId, match]);

  const tables = useMemo(() => tablesFrom(players), [players]);
  const mePresent = players.find((p) => p.id === me?.id);

  /* Lost a seat to someone who got there first; or a table filled: start. */
  useEffect(() => {
    if (!seat || match || !mePresent?.seat) return;
    if (!holdsSeat(mePresent, tables)) {
      setSeat(null);
      setNote("Someone sat there a moment before you.");
      return;
    }
    const found = matchAt(tables[seat.table], matchPrefix);
    if (found) setMatch({ ...found, seat });
  }, [tables, seat, match, mePresent, matchPrefix]);

  return {
    supabase, connected, players, tables, seat, tcId, setTcId, match, note,
    /** Players in the room who are neither seated nor playing. */
    standing: players.filter((p) => !p.seat && !p.playing),
    sit: (table, side) => { setNote(null); setSeat({ table, side, at: Date.now() }); },
    standUp: () => setSeat(null),
    leaveMatch: () => { setMatch(null); setSeat(null); },
  };
}
