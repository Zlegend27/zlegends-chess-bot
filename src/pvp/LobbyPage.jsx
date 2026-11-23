/* ================================================================
   The 1v1 lobby: one room, always open. Press Play and you're matched with
   someone waiting on the same clock, or you wait for the next person; or
   tap anyone already waiting to play them. Invite a friend by link. The
   clock and ranked/casual sit behind "Change" so the screen has one thing
   to do. (Replaced the four tables with seats, 2026-11-23: with few
   players, two people could sit at different tables and wait forever.)

   Everyone shares their state over Supabase Realtime presence (see
   utils/lobby.js for how every client agrees on seats and matches from
   that list without a server). Signing in is required; in local
   development a guest identity per tab stands in, so two tabs can test
   it.
   ================================================================ */
import { useEffect, useState } from "react";
import { TIME_CONTROLS, timeControl } from "../utils/lobby";
import { inviteLink, pendingInvite, clearPendingInvite } from "../utils/invite";
import { getUiTheme } from "../utils/uiTheme";
import SubPage from "../components/SubPage";
import PlayerSprite from "../components/PlayerSprite";
import Modal from "../components/Modal";
import PvpMatch from "./PvpMatch";
import { useLobby, useLobbyMe } from "./useLobby";

export default function LobbyPage({ session, profile, displayName, avatar, pieceSetId, rating, onRated, onBack, onSignIn, sweetheart }) {
  const T = getUiTheme(sweetheart);
  const { me, signedIn } = useLobbyMe({ session, profile, displayName, avatar });
  const lobby = useLobby({ me, rating });
  const { supabase, connected, stuck, retry, players, seat, tcId, setTcId, ranked, setRanked, match, note, standUp, leaveMatch, inviteTable, seeks, searching } = lobby;
  const [settingsOpen, setSettingsOpen] = useState(false);
  /* How long I've been looking for an opponent, ticking each second. */
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!searching) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [searching]);
  const waited = searching ? Math.max(0, now - seat.at) : 0;
  /* A friend's invite link brought us here: sit at their table as soon as
     the lobby is connected (utils/invite.js). */
  const [arrivedByInvite] = useState(() => pendingInvite());
  useEffect(() => {
    const code = pendingInvite();
    if (!code || !connected || !me || seat || match) return;
    clearPendingInvite();
    lobby.joinInvite(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, me, seat, match]);
  /* The link to my private table, once I've opened one. */
  const [copied, setCopied] = useState(false);
  const myInviteCode = inviteTable && seat?.side === 0 ? String(inviteTable.id).slice(4) : null;
  const link = myInviteCode ? inviteLink(myInviteCode) : null;
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* the link is on screen to copy by hand */ }
  };
  const shareLink = () => navigator.share?.({ title: "Play me at chess", text: "Play me at chess on Zlegend2700", url: link }).catch(() => {});

  if (!me) {
    return (
      <SubPage onBack={onBack} sweetheart={sweetheart}>
        <div className="boxHead">Play a real person</div>
        <p className={"m-0 text-sm " + T.ink}>
          {arrivedByInvite
            ? "A friend invited you to play. Log in and you'll be seated at their table."
            : "Log in to join the lobby. Your name and your look come from your profile."}
        </p>
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

  const chip = (on) => `inline-flex min-h-11 items-center rounded-lg border px-3 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 ${T.ring} `
    + (on ? (sweetheart ? "border-sh-lteal bg-sh-lteal/15 text-sh-lteal" : "border-cyan bg-cyan/10 text-cyan") : `${T.cardBorder} bg-transparent ${T.dimText} ${T.hoverInk}`);
  const label = "text-[11px] font-bold uppercase tracking-[0.14em] " + T.dimText;
  const card = `flex flex-col gap-3 rounded-2xl border p-4 ${T.cardBorder} ${T.panelBg} backdrop-blur-sm`;
  const textLink = "cursor-pointer self-center border-0 bg-transparent p-0 py-2 text-sm font-bold underline " + T.dimText;
  const kindText = (tc, isRanked) => `${timeControl(tc).label} · ${isRanked ? "Ranked" : "Casual"}`;
  /* Everyone else here who isn't already in the waiting list. */
  const others = players.filter((p) => p.id !== me.id && !seeks.some((s) => s.player.id === p.id));
  const busy = !!seat; // waiting, or at a friend's table

  return (
    <SubPage onBack={onBack} sweetheart={sweetheart}>
      <div className="flex items-center justify-between gap-3">
        <h1 className="boxHead m-0">Play a person</h1>
        <span className={"inline-flex items-center gap-1.5 text-xs font-bold " + T.dimText} role="status">
          <i className="block size-2 rounded-full" style={{ background: connected ? "#6FCF97" : "var(--dim)" }} aria-hidden="true" />
          {connected ? `${players.length} online` : stuck ? "Not connected" : "Connecting…"}
        </span>
      </div>

      {stuck && !connected && (
        <div role="alert" className={card}>
          <p className={"m-0 text-sm " + T.ink}>Couldn&apos;t reach the lobby. Check your connection, then try again.</p>
          <button type="button" className="btn ghost" style={{ minHeight: 44 }} onClick={retry}>Try again</button>
        </div>
      )}

      {/* The one thing to do here: Play. The clock and game type sit behind
          "Change" (most people keep the default), and while looking for an
          opponent this card says so instead. */}
      {inviteTable && !inviteTable.full ? (
        <div className={card}>
          <div className={label}>{seat.side === 0 ? "Invite a friend" : "Your friend's game"} · {kindText(inviteTable.tc ?? tcId, inviteTable.ranked)}</div>
          {seat.side === 0 ? (
            <>
              <p className={"m-0 text-sm " + T.ink}>Send this link to a friend, then come back here. The game starts when you&apos;re both on this page.</p>
              <input readOnly value={link ?? ""} aria-label="Invite link" onFocus={(e) => e.target.select()}
                className={`min-h-11 w-full rounded-lg border ${T.cardBorder} bg-transparent px-3 font-mono text-xs ${T.ink}`} />
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn gold" style={{ minHeight: 44, flex: 1 }} onClick={copyLink}>{copied ? "Copied" : "Copy link"}</button>
                {typeof navigator !== "undefined" && navigator.share && (
                  <button type="button" className="btn ghost" style={{ minHeight: 44, flex: 1 }} onClick={shareLink}>Share</button>
                )}
              </div>
            </>
          ) : (
            <p className={"m-0 text-sm " + T.ink} role="status">You&apos;re in. The game starts as soon as your friend is back on this page.</p>
          )}
          <button type="button" className={textLink} onClick={standUp}>{seat.side === 0 ? "Cancel the invite" : "Leave"}</button>
        </div>
      ) : searching ? (
        <div className={card} role="status" aria-live="polite">
          <div className="flex items-center gap-3">
            <span className="lobbyPulse" aria-hidden="true" />
            <div className="flex min-w-0 flex-col">
              <span className={"text-base font-bold " + T.ink}>Looking for an opponent…</span>
              <span className={"text-xs " + T.dimText}>{kindText(tcId, ranked)} · {waitText(waited)}</span>
            </div>
          </div>
          <p className={"m-0 text-sm leading-relaxed " + T.dimText}>The next person who presses Play with the same clock plays you. Want a game now? Invite a friend.</p>
          <div className="flex gap-2">
            <button type="button" className="btn ghost" style={{ minHeight: 44, flex: 1 }} onClick={standUp}>Cancel</button>
            <button type="button" className="btn ghost" style={{ minHeight: 44, flex: 1 }} onClick={() => { standUp(); lobby.invite(); }}>Invite a friend</button>
          </div>
        </div>
      ) : (
        <div className={card}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-col">
              <span className={label}>Your game</span>
              <span className={"text-base font-bold " + T.ink}>{kindText(tcId, ranked)}</span>
            </div>
            <button type="button" className={`min-h-11 rounded-lg border-0 bg-transparent px-2 text-sm font-bold underline ${T.interactiveText} focus-visible:outline-none focus-visible:ring-2 ${T.ring}`} onClick={() => setSettingsOpen(true)}>Change</button>
          </div>
          <button type="button" className="btn gold" style={{ width: "100%", minHeight: 52 }} disabled={!connected || busy} onClick={lobby.seek}>Play</button>
          <button type="button" className={textLink} disabled={!connected || busy} onClick={() => lobby.invite()}>Invite a friend with a link</button>
        </div>
      )}

      {note && <p className={"m-0 text-sm " + T.accentText} role="status">{note}</p>}

      {/* People waiting: with only a few around, tapping one beats two
          people waiting for each other on different clocks. */}
      {connected && !inviteTable && (
        <div className="flex flex-col gap-2">
          <div className={label}>Waiting for an opponent</div>
          {seeks.length === 0 ? (
            <p className={"m-0 text-sm leading-relaxed " + T.dimText}>
              {searching ? "Nobody else is waiting right now." : "Nobody is waiting right now. Press Play and you'll be matched with the next person who does."}
            </p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {seeks.map((s) => (
                <li key={s.table} className={`flex items-center gap-3 rounded-2xl border p-2.5 ${T.cardBorder} ${T.panelBg}`}>
                  <PlayerSprite avatar={s.player.avatar} discordUrl={s.player.discordUrl} size={40} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className={"truncate text-sm font-bold " + T.ink}>{s.player.name}</span>
                    <span className={"text-xs " + T.dimText}>{s.player.elo != null ? `${s.player.elo} Elo · ` : ""}{kindText(s.tc, s.ranked)}</span>
                  </span>
                  <button type="button" className="btn ghost" style={{ minHeight: 44, padding: "0 16px" }} disabled={!!inviteTable} onClick={() => lobby.accept(s)}
                    aria-label={`Play ${s.player.name}, ${kindText(s.tc, s.ranked)}`}>
                    Play
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Who else is here (in a game, or just looking), as a quiet row. */}
      {connected && others.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className={label}>Online now</div>
          <div className="flex flex-wrap gap-3">
            {others.slice(0, 12).map((p) => (
              <div key={p.id} className="flex w-14 flex-col items-center gap-1" title={p.playing ? `${p.name} is playing` : p.name}>
                <PlayerSprite avatar={p.avatar} discordUrl={p.discordUrl} size={36} />
                <span className={"max-w-full truncate text-[11px] " + T.ink}>{p.name}</span>
                {p.playing && <span className={"text-[10px] " + T.dimText}>playing</span>}
              </div>
            ))}
            {others.length > 12 && <span className={"self-center text-xs " + T.dimText}>+{others.length - 12} more</span>}
          </div>
        </div>
      )}

      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} closeLabel="Close game settings" style={{ width: "min(380px, 92vw)", minWidth: undefined, color: "var(--white)" }}>
        <div className="boxHead">Your game</div>
        <div className={label}>Clock</div>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Clock">
          {TIME_CONTROLS.map((t) => (
            <button key={t.id} type="button" role="radio" aria-checked={tcId === t.id} className={chip(tcId === t.id)} onClick={() => setTcId(t.id)}>{t.label}</button>
          ))}
        </div>
        <div className={label}>Game type</div>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Game type">
          <button type="button" role="radio" aria-checked={!ranked} className={chip(!ranked)} onClick={() => setRanked(false)}>Casual</button>
          <button type="button" role="radio" aria-checked={ranked} className={chip(ranked)} onClick={() => setRanked(true)}>Ranked</button>
        </div>
        <p className="m-0 text-xs" style={{ color: "var(--dim)" }}>{ranked ? "Win or lose, your rating moves." : "Just for fun. No rating change."}</p>
        <button type="button" className="btn gold" style={{ width: "100%" }} onClick={() => setSettingsOpen(false)}>Done</button>
      </Modal>
    </SubPage>
  );
}

/* "12s", "1:05": how long I've been waiting. */
const waitText = (ms) => {
  const sec = Math.floor(ms / 1000);
  return sec < 60 ? `${sec}s` : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
};
