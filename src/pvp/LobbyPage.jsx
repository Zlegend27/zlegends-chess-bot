/* ================================================================
   The 1v1 lobby: one room, always open. Everyone in it shows up as their
   sprite. Sit at a table to wait for an opponent; when both seats at a
   table are taken, the game starts for both of you.

   Everyone shares their state over Supabase Realtime presence (see
   utils/lobby.js for how every client agrees on seats and matches from
   that list without a server). Signing in is required; in local
   development a guest identity per tab stands in, so two tabs can test
   it.
   ================================================================ */
import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabase } from "../utils/supabase";
import { loadSetting, saveSetting } from "../utils/storage";
import { TIME_CONTROLS, playersFrom, tablesFrom, holdsSeat, matchAt, timeControl } from "../utils/lobby";
import { getUiTheme } from "../utils/uiTheme";
import { DEFAULT_AVATAR } from "../utils/avatar";
import SubPage from "../components/SubPage";
import PlayerSprite from "../components/PlayerSprite";
import PvpMatch from "./PvpMatch";

const ACTIVE_KEY = "pvpActive";
const LOBBY_CHANNEL = "lobby-v1";

/** In local development, a different guest per tab so two tabs can play. */
function devGuest() {
  let id = sessionStorage.getItem("zlDevGuest");
  if (!id) { id = `guest-${crypto.randomUUID()}`; sessionStorage.setItem("zlDevGuest", id); }
  return { id, name: `Guest ${id.slice(6, 10)}`, avatar: { ...DEFAULT_AVATAR, shirt: id.charCodeAt(7) % 8 }, discordUrl: null };
}

export default function LobbyPage({ session, profile, displayName, avatar, pieceSetId, onBack, onSignIn, sweetheart }) {
  const T = getUiTheme(sweetheart);
  const signedIn = !!session?.user?.id;
  const me = useMemo(() => {
    if (signedIn) {
      const name = displayName && displayName !== "Challenger" ? displayName : profile?.name || "Player";
      return { id: session.user.id, name, avatar, discordUrl: profile?.avatarUrl ?? null };
    }
    return import.meta.env.DEV ? devGuest() : null;
  }, [signedIn, session?.user?.id, displayName, profile?.name, profile?.avatarUrl, avatar]);

  const [supabase, setSupabase] = useState(null);
  const [connected, setConnected] = useState(false);
  const [players, setPlayers] = useState([]);
  const [seat, setSeat] = useState(null); // { table, side, at }
  const [tcId, setTcId] = useState(() => loadSetting("pvpTc", "10+0"));
  const [match, setMatch] = useState(() => loadSetting(ACTIVE_KEY, null));
  const [note, setNote] = useState(null);
  const joinedAt = useRef(Date.now());
  const channelRef = useRef(null);

  useEffect(() => { saveSetting("pvpTc", tcId); }, [tcId]);
  useEffect(() => { saveSetting(ACTIVE_KEY, match); }, [match]);
  useEffect(() => { getSupabase().then(setSupabase); }, []);

  /* Join the room. */
  useEffect(() => {
    if (!supabase || !me) return;
    const channel = supabase.channel(LOBBY_CHANNEL, { config: { presence: { key: me.id } } });
    channelRef.current = channel;
    channel
      .on("presence", { event: "sync" }, () => setPlayers(playersFrom(channel.presenceState())))
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));
    return () => { supabase.removeChannel(channel); channelRef.current = null; setConnected(false); };
  }, [supabase, me]);

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
    const found = matchAt(tables[seat.table]);
    if (found) setMatch({ ...found, seat });
  }, [tables, seat, match, mePresent]);

  if (!me) {
    return (
      <SubPage onBack={onBack} sweetheart={sweetheart}>
        <div className="boxHead">Play a real person</div>
        <p className={"m-0 text-sm " + T.ink}>Log in with Discord to join the lobby. Your name and your look come from your profile.</p>
        <button type="button" className="btn gold" style={{ width: "100%" }} onClick={onSignIn}>Log in with Discord</button>
      </SubPage>
    );
  }

  if (match && supabase) {
    return (
      <div className="root">
        <PvpMatch
          supabase={supabase} me={me} match={match} pieceSetId={pieceSetId} signedIn={signedIn}
          onExit={() => { setMatch(null); setSeat(null); }}
        />
      </div>
    );
  }

  const sit = (table, side) => {
    setNote(null);
    setSeat({ table, side, at: Date.now() });
  };
  const standing = players.filter((p) => !p.seat && !p.playing);

  return (
    <SubPage onBack={onBack} sweetheart={sweetheart}>
      <div className="boxHead" style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span>Lobby</span>
        <span className={"text-xs font-bold " + T.dimText}>{connected ? `${players.length} here` : "Connecting…"}</span>
      </div>
      <p className={"m-0 text-sm " + T.ink}>
        Sit at a table to wait for an opponent. When both seats are taken, the game starts. Casual games, no rating.
      </p>

      <label className={"flex items-center justify-between gap-2 text-xs " + T.dimText}>
        <span>Clock for a table you open</span>
        <select value={tcId} onChange={(e) => setTcId(e.target.value)} disabled={!!seat}>
          {TIME_CONTROLS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-2.5">
        {tables.map((table) => {
          const busy = table.seats.some((p) => p?.playing);
          return (
            <div key={table.id} className={`rounded-2xl border ${T.cardBorder} ${T.panelBg} flex flex-col items-center gap-2 p-2.5`}>
              <div className={"flex w-full items-baseline justify-between text-xs font-bold " + T.dimText}>
                <span>Table {table.id + 1}</span>
                <span>{busy ? "Playing" : table.tc ? timeControl(table.tc).label : ""}</span>
              </div>
              <div className="flex w-full items-end justify-around">
                {[0, 1].map((side) => {
                  const p = table.seats[side];
                  const mine = p?.id === me.id;
                  return (
                    <div key={side} className="flex w-1/2 flex-col items-center gap-1">
                      {p ? (
                        <>
                          <PlayerSprite avatar={p.avatar} discordUrl={p.discordUrl} size={44} />
                          <span className={"max-w-full truncate text-xs " + (mine ? T.interactiveText : T.ink)}>{mine ? "You" : p.name}</span>
                        </>
                      ) : (
                        <button type="button" className="btn ghost" style={{ minHeight: 32, padding: "4px 8px", fontSize: 11 }}
                          disabled={!connected || !!seat} onClick={() => sit(table.id, side)}>
                          Sit
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="pvpTableTop" aria-hidden="true" />
              {table.seats.some((p) => p?.id === me.id) && !busy && (
                <button type="button" className="border-0 bg-transparent p-0 text-xs underline" style={{ color: "var(--dim)" }} onClick={() => setSeat(null)}>
                  Stand up
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-2">
        <span className={"text-xs font-bold uppercase tracking-[0.14em] " + T.dimText}>In the room</span>
        {standing.length === 0 ? (
          <p className={"m-0 text-xs " + T.dimText}>Nobody standing around right now.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {standing.map((p) => (
              <div key={p.id} className="flex w-14 flex-col items-center gap-1">
                <PlayerSprite avatar={p.avatar} discordUrl={p.discordUrl} size={40} />
                <span className={"max-w-full truncate text-[11px] " + (p.id === me.id ? T.interactiveText : T.ink)}>{p.id === me.id ? "You" : p.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {note && <p className={"m-0 text-xs " + T.accentText} role="status">{note}</p>}
    </SubPage>
  );
}
