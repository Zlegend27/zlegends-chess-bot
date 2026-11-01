import { useEffect, useState } from "react";
import StarField from "./StarField";
import { fetchRecentGames, summarizeGame } from "../utils/gameHistory";
import { getUiTheme } from "../utils/uiTheme";
import { overlayOpen } from "../utils/routes";

/* Export steps per source. Chess.com's are from its help center ("How do I
   get a PGN of my game?"). Lichess has moved these controls over the years,
   so its copy names the two labels a player may see. Website, iPhone and
   Android differ on Chess.com, and a stuck player is likely to be on a
   phone, so all three are spelled out. */
const SOURCES = [
  {
    id: "chesscom", label: "Chess.com",
    groups: [
      { title: "On the website", steps: ["Open the finished game.", "Press the Share icon under the analysis panel.", "Open the PGN tab, then copy the text or download the file."] },
      { title: "On iPhone", steps: ["Open Game Analysis for the game.", "Tap Options, then Share.", "Tap Copy."] },
      { title: "On Android", steps: ["Open the game.", "Tap More in the lower left.", "Choose Export PGN."] },
    ],
  },
  {
    id: "lichess", label: "Lichess",
    groups: [
      { steps: ["Open the game, then its analysis board.", "Look under the board for FEN & PGN or Share & export.", "Copy the PGN text."] },
    ],
  },
  {
    id: "other", label: "Anywhere else",
    groups: [
      { steps: ["Look for Export, Share, or Download PGN on the game.", "Copy the text or save the file.", "Bring it here."] },
    ],
  },
];

const OUTCOME_LABEL = { win: "Won", loss: "Lost", draw: "Draw", abandoned: "Unfinished" };
const MAX_FILE_BYTES = 5 * 1024 * 1024;

/** Game Review's front door: the one place to paste or open a game. Same
 *  page shell as LeaderboardPage.jsx. `onReview` and `onOpenSaved` both
 *  return the loader's result, so a problem can be shown here where the
 *  player is looking. On success App.jsx moves to the board. */
export default function GameReviewPage({ onBack, profile, sweetheart, onReview, onOpenSaved, hasLiveGame }) {
  const T = getUiTheme(sweetheart);
  const [text, setText] = useState("");
  const [error, setError] = useState(null);
  const [sourceId, setSourceId] = useState("chesscom");
  const [recent, setRecent] = useState(null); // null while loading
  const [recentError, setRecentError] = useState(null);
  const source = SOURCES.find(s => s.id === sourceId);

  const loadRecent = () => {
    setRecent(null);
    setRecentError(null);
    fetchRecentGames().then((r) => {
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

  const submit = () => {
    const r = onReview(text);
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

  return (
    <div className="root">
      <StarField sweetheart={sweetheart} />


      <div className="hdr">
        <h1 style={{ fontSize: 34, paddingRight: "0.15em" }}>Game Review</h1>
        <div className="sub">any game, from anywhere</div>
      </div>

      <p className={"mt-3 max-w-md text-center text-sm leading-relaxed " + T.mutedLabel}>
        Paste a game you played on Chess.com, Lichess, or anywhere else. Every move gets graded, and you can practice the ones you missed.
      </p>

      <div className={`mt-5 flex w-full max-w-md flex-col gap-3 rounded-2xl border ${T.cardBorder} ${T.panelBg} p-4 backdrop-blur-sm`}>
        <label className="flex flex-col gap-2">
          <span className={eyebrow}>Your game</span>
          <textarea
            value={text}
            onChange={(e) => { setText(e.target.value); setError(null); }}
            placeholder={"Paste the game's PGN here\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 ..."}
            rows={7}
            className="modalInput mono"
          />
        </label>
        <p className={"m-0 text-xs leading-relaxed " + T.dimText}>
          PGN is the plain-text format every chess site uses to save a game. A link to the game won't work, so use the steps below to get the text.
        </p>
        {error && <p role="alert" className="pasteError m-0 text-[13px] font-bold leading-relaxed">{error}</p>}
        {hasLiveGame && (
          <p className={"m-0 text-xs leading-relaxed " + T.accentText}>
            You have a game in progress. Reviewing a game here will end it.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn gold" onClick={submit} disabled={!text.trim()}>Review This Game</button>
          <label className={`cursor-pointer text-sm font-bold underline ${T.interactiveText}`}>
            or choose a .pgn file
            <input type="file" accept=".pgn,.txt,text/plain" onChange={onFile} className="sr-only" />
          </label>
        </div>
      </div>

      <div className={`mt-4 w-full max-w-md rounded-2xl border ${T.cardBorder} ${T.panelBg} p-4 backdrop-blur-sm`}>
        <h2 className={"m-0 mb-3 " + eyebrow}>Where to find your PGN</h2>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {SOURCES.map((s) => (
            <button
              key={s.id}
              onClick={() => setSourceId(s.id)}
              aria-pressed={s.id === sourceId}
              className={`inline-flex min-h-11 items-center rounded-lg border-0 px-3 py-1.5 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 ${T.ring} ${
                s.id === sourceId
                  ? (sweetheart ? "bg-sh-lteal/15 text-sh-lteal" : "bg-cyan/12 text-cyan")
                  : `bg-transparent ${T.dimText} ${T.hoverInk}`
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-3">
          {source.groups.map((group, i) => (
            <div key={i}>
              {group.title && <div className={"mb-1 text-xs font-bold " + T.ink}>{group.title}</div>}
              <ol className={"m-0 list-decimal space-y-1 pl-5 text-sm leading-relaxed " + T.mutedLabel}>
                {group.steps.map((step) => <li key={step}>{step}</li>)}
              </ol>
            </div>
          ))}
        </div>
      </div>

      <div className={`mt-4 w-full max-w-md rounded-2xl border ${T.cardBorder} ${T.panelBg} p-4 backdrop-blur-sm`}>
        <h2 className={"m-0 mb-2 " + eyebrow}>{profile ? "Your games" : "Games you played here"}</h2>
        {recentError ? (
          <div className="flex flex-col items-start gap-2">
            <p className={"m-0 text-sm " + T.dimText}>{recentError}</p>
            <button type="button" className="btn ghost" onClick={loadRecent}>Try again</button>
          </div>
        ) : recent === null ? (
          <p className={"m-0 text-sm " + T.dimText}>Loading…</p>
        ) : recent.length === 0 ? (
          <p className={"m-0 text-sm " + T.dimText}>Games you play against the bots will show up here.</p>
        ) : recent.map((g) => (
          <button
            key={g.id}
            type="button"
            className="openingRow recentRow"
            onClick={() => { const r = onOpenSaved(g); if (!r.ok) setError(r.error); }}
          >
            <span>
              <b>vs {g.opponent}</b>
              <span className="recentMeta"> · {g.date}</span>
            </span>
            <span className={"recentOutcome " + g.outcome}>{OUTCOME_LABEL[g.outcome]}</span>
          </button>
        ))}
      </div>

    </div>
  );
}
