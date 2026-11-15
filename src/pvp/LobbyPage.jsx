/* ================================================================
   The 1v1 lobby: one room, always open. Open a table (pick its clock, and
   whether it's ranked) or take the free seat at someone else's; when both
   seats are taken the game starts for both of you.

   Everyone shares their state over Supabase Realtime presence (see
   utils/lobby.js for how every client agrees on seats and matches from
   that list without a server). Signing in is required; in local
   development a guest identity per tab stands in, so two tabs can test
   it.
   ================================================================ */
import { TIME_CONTROLS, timeControl } from "../utils/lobby";
import { getUiTheme } from "../utils/uiTheme";
import SubPage from "../components/SubPage";
import PlayerSprite from "../components/PlayerSprite";
import PvpMatch from "./PvpMatch";
import { useLobby, useLobbyMe } from "./useLobby";

export default function LobbyPage({ session, profile, displayName, avatar, pieceSetId, rating, onRated, onBack, onSignIn, sweetheart }) {
  const T = getUiTheme(sweetheart);
  const { me, signedIn } = useLobbyMe({ session, profile, displayName, avatar });
  const lobby = useLobby({ me, rating });
  const { supabase, connected, players, tables, seat, tcId, setTcId, ranked, setRanked, match, note, standing, sit, standUp, leaveMatch } = lobby;

  if (!me) {
    return (
      <SubPage onBack={onBack} sweetheart={sweetheart}>
        <div className="boxHead">Play a real person</div>
        <p className={"m-0 text-sm " + T.ink}>Log in to join the lobby. Your name and your look come from your profile.</p>
        <button type="button" className="btn gold" style={{ width: "100%" }} onClick={onSignIn}>Log in</button>
      </SubPage>
    );
  }

  if (match && supabase) {
    return (
      <div className="root">
        <PvpMatch
          key={match.id}
          supabase={supabase} me={me} match={match} pieceSetId={pieceSetId} signedIn={signedIn}
          onExit={leaveMatch} onRated={onRated} onRematch={lobby.rematch} onBlock={lobby.block}
        />
      </div>
    );
  }

  const chip = (on) => `inline-flex min-h-11 items-center rounded-lg border px-3 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 ${T.ring} `
    + (on ? (sweetheart ? "border-sh-lteal bg-sh-lteal/15 text-sh-lteal" : "border-cyan bg-cyan/10 text-cyan") : `border-transparent bg-transparent ${T.dimText} ${T.hoverInk}`);
  const label = "text-[11px] font-bold uppercase tracking-[0.14em] " + T.dimText;
  const mySeatTable = seat ? tables[seat.table] : null;

  const seatView = (table, side) => {
    const p = table.seats[side];
    const mine = p?.id === me.id;
    if (!p) {
      return (
        <button type="button" className="btn ghost" style={{ minHeight: 44, flex: 1 }} disabled={!connected || !!seat} onClick={() => sit(table.id, side)}>
          {table.seats[1 - side] ? "Join" : "Sit"}
        </button>
      );
    }
    return (
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <PlayerSprite avatar={p.avatar} discordUrl={p.discordUrl} size={40} />
        <span className="flex min-w-0 flex-col">
          <span className={"truncate text-sm font-bold " + (mine ? T.interactiveText : T.ink)}>{mine ? "You" : p.name}</span>
          <span className={"text-[11px] " + T.dimText}>{p.elo != null ? `${p.elo} Elo` : "Unrated"}</span>
        </span>
      </div>
    );
  };

  return (
    <SubPage onBack={onBack} sweetheart={sweetheart}>
      <div className="flex items-center justify-between gap-3">
        <h1 className="boxHead m-0">1v1 Lobby</h1>
        <span className={"inline-flex items-center gap-1.5 text-xs font-bold " + T.dimText} role="status">
          <i className="block size-2 rounded-full" style={{ background: connected ? "#6FCF97" : "var(--dim)" }} aria-hidden="true" />
          {connected ? `${players.length} online` : "Connecting…"}
        </span>
      </div>

      {/* The table you open: its clock, and whether it counts for rating. */}
      <div className="flex flex-col gap-2">
        <div className={label}>Your table</div>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Clock">
          {TIME_CONTROLS.map((t) => (
            <button key={t.id} type="button" role="radio" aria-checked={tcId === t.id} disabled={!!seat} className={chip(tcId === t.id)} onClick={() => setTcId(t.id)}>{t.label}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Game type">
          <button type="button" role="radio" aria-checked={!ranked} disabled={!!seat} className={chip(!ranked)} onClick={() => setRanked(false)}>Casual</button>
          <button type="button" role="radio" aria-checked={ranked} disabled={!!seat} className={chip(ranked)} onClick={() => setRanked(true)}>Ranked</button>
          <span className={"self-center text-xs " + T.dimText}>{ranked ? "Win or lose, your rating moves." : "Just for fun. No rating change."}</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className={label}>Tables</div>
        {tables.map((table) => {
          const busy = table.seats.some((p) => p?.playing);
          const open = table.seats.filter(Boolean).length;
          const mineHere = table.seats.some((p) => p?.id === me.id);
          return (
            <div key={table.id} className={`flex flex-col gap-2.5 rounded-2xl border p-3 ${mineHere ? (sweetheart ? "border-sh-lteal" : "border-cyan") : T.cardBorder} ${T.panelBg}`}>
              <div className="flex items-center justify-between gap-2 text-xs font-bold">
                <span className={T.dimText}>Table {table.id + 1}{open > 0 && ` · ${timeControl(table.tc).label} · ${table.ranked ? "Ranked" : "Casual"}`}</span>
                <span className={busy ? T.accentText : open === 1 ? T.interactiveText : T.dimText}>{busy ? "Playing" : open === 1 ? "Waiting for a player" : "Open"}</span>
              </div>
              <div className="flex items-center gap-2">
                {seatView(table, 0)}
                <span className={"text-xs font-bold " + T.dimText} aria-hidden="true">vs</span>
                {seatView(table, 1)}
              </div>
              {mineHere && !busy && (
                <button type="button" className={"cursor-pointer self-start border-0 bg-transparent p-0 py-1 text-xs underline " + T.dimText} onClick={standUp}>Leave the table</button>
              )}
            </div>
          );
        })}
      </div>

      {mySeatTable && !mySeatTable.full && <p className={"m-0 text-sm " + T.ink} role="status">You&apos;re seated. The game starts as soon as someone joins you.</p>}
      {note && <p className={"m-0 text-sm " + T.accentText} role="status">{note}</p>}

      {standing.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className={label}>Looking around</div>
          <div className="flex flex-wrap gap-3">
            {standing.map((p) => (
              <div key={p.id} className="flex w-14 flex-col items-center gap-1">
                <PlayerSprite avatar={p.avatar} discordUrl={p.discordUrl} size={36} />
                <span className={"max-w-full truncate text-[11px] " + (p.id === me.id ? T.interactiveText : T.ink)}>{p.id === me.id ? "You" : p.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </SubPage>
  );
}
