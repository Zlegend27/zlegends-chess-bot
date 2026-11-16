import { useEffect, useRef, useState } from "react";
import StarField from "./StarField";
import { fetchRecentGames, summarizeGame } from "../utils/gameHistory";
import { getUiTheme } from "../utils/uiTheme";
import { overlayOpen } from "../utils/routes";
import { loadSetting, saveSetting } from "../utils/storage";
import { parsePgnHeaders } from "../utils/pgn";
import { SITES, cleanUsername, parseGameLink, fetchChessComGames, fetchLichessGames, fetchLichessGame, findChessComGame } from "../utils/gameImport";
import { GameRow } from "./GameHistoryPage";

/* The last few games sit here for a quick review; all of them are on the
   Game History page. */
const RECENT = 5;
/* Games shown per press from a site: a busy player's month can hold hundreds. */
const PAGE = 10;

const TABS = [
  { id: "chesscom", label: "Chess.com" },
  { id: "lichess", label: "Lichess" },
  { id: "paste", label: "Paste a game" },
];
const FETCH = { chesscom: fetchChessComGames, lichess: fetchLichessGames };

/* Export steps per source, for a game that can't be found by username.
   Chess.com's are from its help center ("How do I get a PGN of my game?").
   Lichess has moved these controls over the years, so its copy names the
   two labels a player may see. */
const PGN_STEPS = [
  { title: "Chess.com website", steps: ["Open the finished game.", "Press the Share icon under the analysis panel.", "Open the PGN tab, then copy the text or download the file."] },
  { title: "Chess.com on iPhone", steps: ["Open Game Analysis for the game.", "Tap Options, then Share.", "Tap Copy."] },
  { title: "Chess.com on Android", steps: ["Open the game.", "Tap More in the lower left.", "Choose Export PGN."] },
  { title: "Lichess", steps: ["Open the game, then its analysis board.", "Look under the board for FEN & PGN or Share & export.", "Copy the PGN text."] },
  { title: "Anywhere else", steps: ["Look for Export, Share, or Download PGN on the game.", "Copy the text or save the file, and bring it here."] },
];

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const OUTCOME = { win: "Won", loss: "Lost", draw: "Draw", white: "1-0", black: "0-1" };
const OUTCOME_CLASS = { win: "win", loss: "loss", draw: "draw", white: "draw", black: "draw" };
const day = (ms) => (ms ? new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : null);
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : null);

/* One game from Chess.com or Lichess: who it was against, how it went, and
   enough detail (speed, date, colour, length) to tell it from its neighbours. */
function ImportedRow({ game, onOpen }) {
  const meta = [cap(game.speed), day(game.endedAt), game.color === 1 ? "White" : game.color === -1 ? "Black" : null, `${Math.ceil(game.plies / 2)} moves`].filter(Boolean);
  return (
    <button type="button" className="openingRow recentRow" onClick={() => onOpen(game)}>
      <span>
        <b>{game.color == null ? `${game.white} vs ${game.black}` : `vs ${game.opponent}`}</b>
        {game.color != null && game.opponentElo != null && <span className="recentMeta"> ({game.opponentElo})</span>}
        <span className="recentMeta"> · {meta.join(" · ")}</span>
      </span>
      <span className={"recentOutcome " + OUTCOME_CLASS[game.outcome]}>{OUTCOME[game.outcome]}</span>
    </button>
  );
}

/** Game Review's front door. A game comes in one of three ways: picked from
 *  a Chess.com or Lichess player's latest games (by username, remembered on
 *  this device), or pasted as a PGN, a game link or a .pgn file. `onReview`
 *  (PGN text), `onImport` (a game from a site) and `onOpenSaved` all return
 *  the loader's result, so a problem can be shown here where the player is
 *  looking. On success App.jsx moves to the board. */
export default function GameReviewPage({ onBack, sweetheart, onReview, onImport, onOpenSaved, onHistory, hasLiveGame }) {
  const T = getUiTheme(sweetheart);
  const [tab, setTab] = useState(() => { const t = loadSetting("reviewSource", "chesscom"); return TABS.some((x) => x.id === t) ? t : "chesscom"; });
  const [names, setNames] = useState(() => ({ chesscom: loadSetting("reviewUser_chesscom", ""), lichess: loadSetting("reviewUser_lichess", "") }));
  /* Per site, once found: { name, games (all fetched so far), shown (how many
     are on screen), more (what to ask the site for next, if anything) }. */
  const [found, setFound] = useState({ chesscom: null, lichess: null });
  const [loading, setLoading] = useState(null); // the site being fetched
  const [siteError, setSiteError] = useState(null);
  const [text, setText] = useState("");
  const [error, setError] = useState(null);
  const [fetching, setFetching] = useState(false); // a pasted link being fetched
  const [recent, setRecent] = useState(null); // null while loading
  const [recentError, setRecentError] = useState(null);
  /* Bumped on every search, so a slow answer to an old one is dropped. */
  const searchRef = useRef(0);

  const loadRecent = () => {
    setRecent(null);
    setRecentError(null);
    fetchRecentGames(RECENT + 1).then((r) => {
      if (r.error) setRecentError(r.error);
      else setRecent(r.games.map(summarizeGame));
    });
  };
  useEffect(loadRecent, []);

  useEffect(() => {
    const onKeyDown = (e) => { if (e.key === "Escape" && !overlayOpen()) onBack(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onBack]);

  const search = (site, typed, more = null) => {
    const name = cleanUsername(typed);
    if (!name) { setSiteError(`That doesn't look like a ${SITES[site].label} username.`); return; }
    const id = ++searchRef.current;
    setLoading(site);
    setSiteError(null);
    FETCH[site](name, more).then((r) => {
      if (id !== searchRef.current) return;
      setLoading(null);
      if (r.error) { setSiteError(r.error); return; }
      saveSetting("reviewUser_" + site, name);
      setNames((n) => ({ ...n, [site]: name }));
      setFound((f) => {
        const old = more ? f[site] : null;
        return { ...f, [site]: { name, games: [...(old?.games ?? []), ...r.games], shown: (old?.shown ?? 0) + PAGE, more: r.more } };
      });
    });
  };

  /* A remembered username shows its latest games straight away. */
  useEffect(() => {
    saveSetting("reviewSource", tab);
    setSiteError(null);
    if (tab !== "paste" && !found[tab] && cleanUsername(names[tab])) search(tab, names[tab]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  /* Older games: first the ones already fetched, then the site's next batch. */
  const showOlder = (site) => {
    const list = found[site];
    if (list.shown < list.games.length) setFound((f) => ({ ...f, [site]: { ...list, shown: list.shown + PAGE } }));
    else search(site, list.name, list.more);
  };
  const open = (game) => { const r = onImport(game); if (!r.ok) setSiteError(r.error); };

  /* A pasted game is PGN text, a Lichess game link, or a Chess.com game
     link (which can only be looked up among a known player's games). */
  const submit = async () => {
    const link = parseGameLink(text);
    if (!link) { const r = onReview(text); if (!r.ok) setError(r.error); return; }
    setFetching(true);
    setError(null);
    let r;
    if (link.site === "lichess") {
      const got = await fetchLichessGame(link.id);
      if (got.pgn) {
        const h = parsePgnHeaders(got.pgn);
        const me = (names.lichess || "").toLowerCase();
        const color = me && (h.White || "").toLowerCase() === me ? 1 : me && (h.Black || "").toLowerCase() === me ? -1 : null;
        r = onImport({ site: "lichess", pgn: got.pgn, color, siteAccuracy: null });
      } else r = { ok: false, error: got.error };
    } else if (!cleanUsername(names.chesscom)) {
      r = { ok: false, error: "A Chess.com link only works once we know whose game it is. Open the Chess.com tab, enter the username, and pick the game from the list." };
    } else {
      const got = await findChessComGame(link.id, cleanUsername(names.chesscom));
      r = got.game ? onImport(got.game) : { ok: false, error: got.error };
    }
    setFetching(false);
    if (!r.ok) setError(r.error);
  };

  /* Chess.com's PGN tab leads with Download, so a saved .pgn file has to be
     as easy as pasting. */
  const onFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // so choosing the same file again still fires
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) { setError("That file is too big. Try a file with just the one game."); return; }
    file.text().then(
      (contents) => { setText(contents); setError(null); },
      () => setError("Couldn't read that file."),
    );
  };

  const eyebrow = "text-[11px] font-bold uppercase tracking-[0.14em] " + T.dimText;
  const card = `w-full max-w-md rounded-2xl border ${T.cardBorder} ${T.panelBg} p-4 backdrop-blur-sm`;
  const site = tab === "paste" ? null : tab;
  const list = site ? found[site] : null;

  return (
    <div className="root">
      <StarField sweetheart={sweetheart} />

      <div className="hdr">
        <h1 style={{ fontSize: 34, paddingRight: "0.15em" }}>Game Review</h1>
        <div className="sub">every move graded, free</div>
      </div>

      <p className={"mt-3 max-w-md text-center text-sm leading-relaxed " + T.mutedLabel}>
        Bring in a game from Chess.com or Lichess with just a username. See your accuracy, your best moves and your mistakes, then practice the ones you missed.
      </p>

      <div className={`mt-5 flex flex-col gap-3 ${card}`}>
        <div className="flex gap-1.5" role="tablist" aria-label="Where the game is from">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={t.id === tab}
              onClick={() => setTab(t.id)}
              className={`inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border-0 px-2 py-1.5 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 ${T.ring} ${
                t.id === tab
                  ? (sweetheart ? "bg-sh-lteal/15 text-sh-lteal" : "bg-cyan/12 text-cyan")
                  : `bg-transparent ${T.dimText} ${T.hoverInk}`
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {site ? (
          <>
            <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); search(site, names[site]); }}>
              <label htmlFor="reviewUser" className={eyebrow}>{SITES[site].label} username</label>
              <div className="flex gap-2">
                <input
                  id="reviewUser"
                  value={names[site]}
                  onChange={(e) => { setNames((n) => ({ ...n, [site]: e.target.value })); setSiteError(null); }}
                  placeholder="Yours, or anyone's"
                  autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false}
                  className="modalInput"
                  style={{ flex: 1, minWidth: 0 }}
                />
                <button type="submit" className={"btn" + (list ? " ghost" : " gold")} disabled={!names[site].trim() || loading === site}>
                  {loading === site && !list ? "Looking…" : "Find games"}
                </button>
              </div>
            </form>
            {siteError && <p role="alert" className="pasteError m-0 text-[13px] font-bold leading-relaxed">{siteError}</p>}
            {!list && loading !== site && !siteError && (
              <p className={"m-0 text-xs leading-relaxed " + T.dimText}>
                Their latest games show up here. Tap one to review it. No password or sign-in needed, and the name is remembered on this device.
              </p>
            )}
            {list && (
              <div>
                <h2 className={"m-0 mb-1 " + eyebrow}>{list.name}&apos;s latest games</h2>
                {list.games.length === 0
                  ? <p className={"m-0 text-sm " + T.dimText}>No finished games found for {list.name}.</p>
                  : list.games.slice(0, list.shown).map((g) => <ImportedRow key={g.id} game={g} onOpen={open} />)}
                {(list.shown < list.games.length || list.more) && (
                  <button type="button" className="btn ghost" style={{ width: "100%", marginTop: 10 }} disabled={loading === site} onClick={() => showOlder(site)}>
                    {loading === site ? "Loading…" : "Show older games"}
                  </button>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            <label className="flex flex-col gap-2">
              <span className={eyebrow}>PGN or game link</span>
              <textarea
                value={text}
                onChange={(e) => { setText(e.target.value); setError(null); }}
                placeholder={"Paste the game's PGN, or a link to the game\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 ..."}
                rows={6}
                className="modalInput mono"
              />
            </label>
            {error && <p role="alert" className="pasteError m-0 text-[13px] font-bold leading-relaxed">{error}</p>}
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="btn gold" onClick={submit} disabled={!text.trim() || fetching}>{fetching ? "Getting the game…" : "Review this game"}</button>
              <label className={`cursor-pointer text-sm font-bold underline ${T.interactiveText}`}>
                or choose a .pgn file
                <input type="file" accept=".pgn,.txt,text/plain" onChange={onFile} className="sr-only" />
              </label>
            </div>
            <details>
              <summary className={`cursor-pointer text-sm font-bold ${T.interactiveText}`}>Where do I find a game&apos;s PGN?</summary>
              <p className={"m-0 mt-2 text-xs leading-relaxed " + T.dimText}>
                PGN is the plain-text format every chess site uses to save a game.
              </p>
              <div className="mt-2 flex flex-col gap-3">
                {PGN_STEPS.map((group) => (
                  <div key={group.title}>
                    <div className={"mb-1 text-xs font-bold " + T.ink}>{group.title}</div>
                    <ol className={"m-0 list-decimal space-y-1 pl-5 text-sm leading-relaxed " + T.mutedLabel}>
                      {group.steps.map((step) => <li key={step}>{step}</li>)}
                    </ol>
                  </div>
                ))}
              </div>
            </details>
          </>
        )}

        {hasLiveGame && (
          <p className={"m-0 text-xs leading-relaxed " + T.accentText}>
            You have a game in progress. Reviewing a game here will end it.
          </p>
        )}
      </div>

      <div className={"mt-4 " + card}>
        <h2 className={"m-0 mb-2 " + eyebrow}>Your games here</h2>
        {recentError ? (
          <div className="flex flex-col items-start gap-2">
            <p className={"m-0 text-sm " + T.dimText}>{recentError}</p>
            <button type="button" className="btn ghost" onClick={loadRecent}>Try again</button>
          </div>
        ) : recent === null ? (
          <p className={"m-0 text-sm " + T.dimText}>Loading…</p>
        ) : recent.length === 0 ? (
          <p className={"m-0 text-sm " + T.dimText}>Games you play against the bots will show up here.</p>
        ) : (
          <>
            {recent.slice(0, RECENT).map((g) => (
              <GameRow key={g.id} game={g} onOpen={(game) => { const r = onOpenSaved(game); if (!r.ok) setRecentError(r.error); }} />
            ))}
            {recent.length > RECENT && <button type="button" className="btn ghost" style={{ width: "100%", marginTop: 10 }} onClick={onHistory}>See all your games</button>}
          </>
        )}
      </div>

    </div>
  );
}
