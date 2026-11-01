import { Suspense } from "react";
import SubPage from "./SubPage";
import RushThemeArt from "./RushThemeArt";
import PixelAvatar, { BPAL, BPIX, PPAL, PPIX } from "./PixelAvatar";

import { DIFFICULTIES } from "../utils/difficulties";
import { RUSH_DURATIONS } from "../utils/rushDurations";
import { OPENINGS } from "../utils/openings";

/* The feature pages one level below a section: Openings, Watch Bots, Ranked
   and Puzzle Rush. Loaded only when one of them is showing (see App.jsx).
   Everything they read or do comes in as a prop. */
export default function ModePages({ siteView, openLeaderboard, puzzlesInBand, pz, resetRushCounter, rushDuration, rushLifetime, setPuzzleBand, setSiteView, setSpectateBlackIdx, setSpectateOpeningId, setSpectateWhiteIdx, spectateBlackIdx, spectateOpeningId, spectateWhiteIdx, startOpening, startPuzzle, startRush, startSpectate, sweetheart }) {
  if (siteView === "openings") {
    return (
      <SubPage onBack={() => setSiteView("lessons")} sweetheart={sweetheart}>
            <div className="boxHead" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <PixelAvatar rows={BPIX} pal={BPAL} size={18} />
              Openings Library
            </div>
            <div className="rows" style={{ maxHeight: "none" }}>
              {OPENINGS.map(op => (
                <button key={op.id} type="button" className="openingRow"
                  style={{ display: "block", width: "100%", textAlign: "left", background: "transparent", border: "none", borderBottom: "1px solid #8B2FC92E", font: "inherit", color: "inherit", cursor: "pointer", padding: "6px 2px" }}
                  onClick={() => startOpening(op)}>
                  <div style={{ fontWeight: 700 }}>{op.name} <span style={{ opacity: 0.6, fontWeight: "normal" }}>({op.eco})</span></div>
                  <div style={{ fontSize: 11, opacity: 0.75 }}>{op.summary}</div>
                </button>
              ))}
            </div>
      </SubPage>
    );
  }

  if (siteView === "watch") {
    return (
      <SubPage onBack={() => setSiteView("playHub")} sweetheart={sweetheart}>
            <div className="boxHead" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              Watch Bots
            </div>
            <div className="pv" style={{ fontSize: 12, opacity: 0.85 }}>
              Pick a bot for each side and watch them play each other. No clicking required.
            </div>
            <div className="rows" style={{ maxHeight: "none", display: "flex", flexDirection: "column", gap: 10, padding: "4px 2px" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                White
                <select value={spectateWhiteIdx} onChange={e => setSpectateWhiteIdx(Number(e.target.value))}>
                  {DIFFICULTIES.map((d, i) => !d.adaptive && <option key={i} value={i}>{d.label}</option>)}
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                Black
                <select value={spectateBlackIdx} onChange={e => setSpectateBlackIdx(Number(e.target.value))}>
                  {DIFFICULTIES.map((d, i) => !d.adaptive && <option key={i} value={i}>{d.label}</option>)}
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                Starting position
                <select value={spectateOpeningId} onChange={e => setSpectateOpeningId(e.target.value)}>
                  <option value="">Standard start</option>
                  {OPENINGS.map(op => <option key={op.id} value={op.id}>{op.name}</option>)}
                </select>
              </label>
            </div>
            <button className="btn gold" style={{ fontSize: 12, padding: "8px 12px" }}
              onClick={() => startSpectate(spectateWhiteIdx, spectateBlackIdx, spectateOpeningId)}>Start Spectating</button>
      </SubPage>
    );
  }

  if (siteView === "ranked") {
    return (
      <SubPage onBack={() => setSiteView("puzzlesHome")} boxClass="shModal" sweetheart={sweetheart}>
            <div className="boxHead" style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--sh-text)" }}>
              <PixelAvatar rows={PPIX} pal={PPAL} size={18} />
              Ranked Puzzles — Pick a Rating
            </div>
            <div className="rows" style={{ maxHeight: "none" }}>
              {pz.RATING_BANDS.map(band => {
                const pool = puzzlesInBand(band);
                return (
                  <button key={band.id} type="button" className="shModalRow" disabled={!pool.length}
                    style={{ display: "block", width: "100%", textAlign: "left", background: "transparent", font: "inherit", cursor: pool.length ? "pointer" : "default", padding: "10px 8px", border: "none", borderBottom: "1px solid #F06BAE33", borderRadius: "var(--r-sm)", opacity: pool.length ? 1 : 0.4, color: "var(--sh-text)" }}
                    onClick={() => {
                      setPuzzleBand(band);
                      setSiteView("play");
                      startPuzzle(pool[(Math.random() * pool.length) | 0]);
                    }}>
                    <div style={{ fontWeight: 700 }}>{band.label} <span style={{ color: "var(--sh-dim)", fontWeight: "normal" }}>({band.min}–{band.max === 9999 ? "2000+" : band.max})</span></div>
                    <div style={{ fontSize: 11, color: "var(--sh-dim)" }}>{pool.length} puzzle{pool.length === 1 ? "" : "s"}</div>
                  </button>
                );
              })}
            </div>
      </SubPage>
    );
  }

  if (siteView === "rush") {
    return (
      <SubPage onBack={() => setSiteView("puzzlesHome")} boxClass="rushThemeBox" flush sweetheart={sweetheart}>
            <div className="rushThemeInner">
          {/* Same shattered-glass + corner-heart + sprite background as
             the heartbreak screen (see RushThemeArt) -- this and that
             screen are the two places that are explicitly her corner of
             the app end to end, so they share one skin, not two. */}
          <Suspense fallback={null}><RushThemeArt /></Suspense>
          <div className="rushEndHead">
            <p className="rushEndEyebrow">Puzzle Rush</p>
            <p className="rushEndSub" style={{ fontSize: 12, fontWeight: 400, color: "var(--sh-dim)" }}>
              Solve as many puzzles as you can before time runs out. Three wrong answers ends the rush early.
            </p>
          </div>
          <div className="durationGrid">
            {RUSH_DURATIONS.map(d => (
              <button key={d.label} type="button" className="durationChip" onClick={() => startRush(d.seconds)}>
                {d.label}
                {d.seconds == null && <span className="newBadge">New</span>}
              </button>
            ))}
          </div>
          <div className="rushCounterRow" style={{ color: "var(--sh-dim)" }}>
            <span>Lifetime solved: <b style={{ color: "var(--sh-text)" }}>{rushLifetime}</b></span>
            <button className="btn ghost" style={{ padding: "4px 10px", fontSize: 10, minHeight: 30 }} onClick={resetRushCounter}>Reset</button>
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <button className="rushEndTrophy" onClick={() => openLeaderboard(rushDuration ?? 60)} aria-label="View leaderboard" title="View leaderboard">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M18 3h-2V1H8v2H6C4.9 3 4 3.9 4 5v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.95V17H9v2h6v-2h-3v-3.11c1.63-.32 2.98-1.45 3.61-2.95C18.08 10.63 20 8.55 20 6V5c0-1.1-.9-2-2-2zM6 6V5h2v3.82C6.84 8.4 6 7.3 6 6zm12 0c0 1.3-.84 2.4-2 2.82V5h2v1z" /></svg>
            </button>
          </div>
        </div>
      </SubPage>
    );
  }
  return null;
}
