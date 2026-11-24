import { useState } from "react";
import SubPage from "./SubPage";
import PixelAvatar, { BPAL, BPIX, PPAL, PPIX } from "./PixelAvatar";

import { DIFFICULTIES, LEVELS_BY_STRENGTH } from "../utils/difficulties";
import { RUSH_DURATIONS } from "../utils/rushDurations";
import { OPENINGS } from "../utils/openings";
import { loadSetting, saveSetting } from "../utils/storage";

/* The feature pages one level below a section: Openings, Watch Bots, Ranked
   and Puzzle Rush. Loaded only when one of them is showing (see App.jsx).
   Everything they read or do comes in as a prop. */
export default function ModePages({ siteView, openLeaderboard, puzzlesInBand, pz, rushBestMap, setPuzzleBand, setSiteView, setSpectateBlackIdx, setSpectateOpeningId, setSpectateWhiteIdx, spectateBlackIdx, spectateOpeningId, spectateWhiteIdx, startOpening, startPuzzle, startRush, startSpectate, sweetheart }) {
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
                  {LEVELS_BY_STRENGTH.map((i) => { const d = DIFFICULTIES[i]; return !d.adaptive && <option key={i} value={i}>{d.label}</option>; })}
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                Black
                <select value={spectateBlackIdx} onChange={e => setSpectateBlackIdx(Number(e.target.value))}>
                  {LEVELS_BY_STRENGTH.map((i) => { const d = DIFFICULTIES[i]; return !d.adaptive && <option key={i} value={i}>{d.label}</option>; })}
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
                    <div style={{ fontWeight: 700 }}>{band.label} <span style={{ color: "var(--sh-dim)", fontWeight: "normal" }}>({band.max === 9999 ? `${band.min}+` : `${band.min}–${band.max}`})</span></div>
                    <div style={{ fontSize: 11, color: "var(--sh-dim)" }}>{pool.length} puzzle{pool.length === 1 ? "" : "s"}</div>
                  </button>
                );
              })}
            </div>
      </SubPage>
    );
  }

  if (siteView === "rush") return <RushStart {...{ setSiteView, startRush, openLeaderboard, rushBestMap, sweetheart }} />;
  return null;
}

/* Puzzle Rush's start: pick a time (each shows your best), then Start.
   The leaderboard is a quiet link. Same look as the rest of the site
   (2026-11-24 redesign: the shattered-heart theme is gone). */
const SHORT = { 60: "1 min", 180: "3 min", 300: "5 min", null: "No clock" };
function RushStart({ setSiteView, startRush, openLeaderboard, rushBestMap = {}, sweetheart }) {
  const [pick, setPick] = useState(() => {
    const saved = loadSetting("rushLastDuration", 60);
    return RUSH_DURATIONS.some((d) => d.seconds === saved) ? saved : 60;
  });
  const choose = (seconds) => { setPick(seconds); saveSetting("rushLastDuration", seconds); };
  return (
    <SubPage onBack={() => setSiteView("puzzlesHome")} sweetheart={sweetheart}>
      <h1 className="boxHead m-0">Puzzle Rush</h1>
      <p className="rushIntro">Solve as many puzzles as you can before the clock runs out. They get harder as you go, and three misses ends the run.</p>
      <div className="rushPick" role="radiogroup" aria-label="Time">
        {RUSH_DURATIONS.map((d) => {
          const best = rushBestMap[d.seconds == null ? "none" : String(d.seconds)] || 0;
          return (
            <button key={d.label} type="button" role="radio" aria-checked={pick === d.seconds}
              className={"rushPickOption" + (pick === d.seconds ? " on" : "")} onClick={() => choose(d.seconds)}>
              <span className="rushPickTime">{SHORT[d.seconds]}</span>
              <span className="rushPickBest">{best ? `Best ${best}` : "No score yet"}</span>
            </button>
          );
        })}
      </div>
      <button type="button" className="btn gold" style={{ width: "100%" }} onClick={() => startRush(pick)}>Start</button>
      <button type="button" className="rushTextLink" onClick={() => openLeaderboard(pick ?? 60)}>See the leaderboard</button>
    </SubPage>
  );
}
