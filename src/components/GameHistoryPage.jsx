import { useEffect, useState } from "react";
import SubPage from "./SubPage";
import { fetchRecentGames, summarizeGame } from "../utils/gameHistory";
import { getUiTheme } from "../utils/uiTheme";

/* Game History: every game the player has finished here, newest first,
   a page at a time. Tapping one opens it in Game Review. (Game Review's own
   page shows only the last few, with a link here.) */
const PAGE = 30;
const OUTCOME_LABEL = { win: "Won", loss: "Lost", draw: "Draw", abandoned: "Unfinished" };
const FILTERS = [
  { id: "all", label: "All" },
  { id: "win", label: "Won" },
  { id: "loss", label: "Lost" },
  { id: "draw", label: "Draws" },
];

/** One game in a list: opponent, date, outcome. Shared with Game Review. */
export function GameRow({ game, onOpen }) {
  return (
    <button type="button" className="openingRow recentRow" onClick={() => onOpen(game)}>
      <span>
        <b>vs {game.opponent}</b>
        <span className="recentMeta"> · {game.date} · {game.playerColor === 1 ? "White" : "Black"}</span>
      </span>
      <span className={"recentOutcome " + game.outcome}>{OUTCOME_LABEL[game.outcome]}</span>
    </button>
  );
}

export default function GameHistoryPage({ onBack, onOpenSaved, profile, onSignIn, sweetheart }) {
  const T = getUiTheme(sweetheart);
  const [games, setGames] = useState(null); // null while the first page loads
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");

  const load = (offset) => {
    setLoading(true);
    setError(null);
    fetchRecentGames(PAGE, offset).then((r) => {
      setLoading(false);
      if (r.error) { setError(r.error); if (offset === 0) setGames([]); return; }
      setMore(r.games.length === PAGE);
      setGames((old) => [...(offset === 0 ? [] : old ?? []), ...r.games.map(summarizeGame)]);
    });
  };
  useEffect(() => { load(0); /* once, on opening the page */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const open = (game) => { const r = onOpenSaved(game); if (!r.ok) setError(r.error); };
  const shown = (games ?? []).filter((g) => filter === "all" || g.outcome === filter);
  const count = (outcome) => (games ?? []).filter((g) => g.outcome === outcome).length;

  return (
    <SubPage onBack={onBack} sweetheart={sweetheart}>
      <h1 className="boxHead m-0">Game History</h1>

      {games === null ? (
        <p className={"m-0 text-sm " + T.dimText} role="status">Loading…</p>
      ) : games.length === 0 && !error ? (
        <p className={"m-0 text-sm " + T.dimText}>Games you finish against the bots or other players show up here.</p>
      ) : (
        <>
          <p className={"m-0 text-sm " + T.ink}>
            {count("win")} won · {count("loss")} lost · {count("draw")} drawn
            <span className={T.dimText}>{more ? ` in your last ${games.length} games` : ` in ${games.length} game${games.length === 1 ? "" : "s"}`}</span>
          </p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Show">
            {FILTERS.map((f) => (
              <button
                key={f.id} type="button" onClick={() => setFilter(f.id)} aria-pressed={filter === f.id}
                className={`inline-flex min-h-11 items-center rounded-lg border-0 px-3 py-1.5 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 ${T.ring} ${
                  filter === f.id ? (sweetheart ? "bg-sh-lteal/15 text-sh-lteal" : "bg-cyan/12 text-cyan") : `bg-transparent ${T.dimText} ${T.hoverInk}`
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div>
            {shown.map((g) => <GameRow key={g.id} game={g} onOpen={open} />)}
            {shown.length === 0 && <p className={"m-0 text-sm " + T.dimText}>None in the games loaded so far.</p>}
          </div>
          {more && <button type="button" className="btn ghost" style={{ width: "100%" }} disabled={loading} onClick={() => load(games.length)}>{loading ? "Loading…" : "Load more games"}</button>}
        </>
      )}

      {error && (
        <div className="flex flex-col items-start gap-2">
          <p className={"m-0 text-sm " + T.dimText} role="alert">{error}</p>
          <button type="button" className="btn ghost" onClick={() => load(games?.length ?? 0)}>Try again</button>
        </div>
      )}

      {!profile && (
        <p className={"m-0 text-xs " + T.dimText}>
          These are the games played in this browser. <button type="button" className={"cursor-pointer border-0 bg-transparent p-0 text-xs font-bold underline " + T.interactiveText} onClick={onSignIn}>Log in</button> to keep them on every device.
        </p>
      )}
    </SubPage>
  );
}
