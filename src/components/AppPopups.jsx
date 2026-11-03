import { MP3_PLAYLISTS } from "../utils/musicLibrary";
import { PIECE_SETS, getPieceSet } from "../utils/pieceSets";
import { BOARD_COLORS, getBoardColor } from "../utils/boardColors";
import Modal from "./Modal";
import PixelAvatar, { ZPAL, ZPIX } from "./PixelAvatar";

const JB_ICONS = {
  volume: "M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05A4.5 4.5 0 0 0 16.5 12zM14 3.23v2.06a7 7 0 0 1 0 13.42v2.06a9 9 0 0 0 0-17.54z",
  pawn: "M12 2a4 4 0 0 0-2.6 7.04L8 10.5V12h2c0 3-1.2 5-3 7h10c-1.8-2-3-4-3-7h2v-1.5l-1.4-1.46A4 4 0 0 0 12 2zM6 20h12v2H6z",
  shuffle: "M10.59 9.17 5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z",
  prev: "M6 6h2v12H6zm3.5 6 8.5 6V6z",
  next: "M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z",
  play: "M8 5v14l11-7z",
  pause: "M6 19h4V5H6v14zm8-14v14h4V5h-4z",
};
const JbIcon = ({ name, size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={JB_ICONS[name]} /></svg>
);

/* The Juice Box, Settings, Piece Designs and Board Colors popups. Loaded only
   when one of them is open (see App.jsx). Everything they read comes in as a
   prop, so this file holds no state of its own. */
export default function AppPopups({ sweetheart, chooseTheme, sfxOn, toggleSfx, boardColorId, boardColorsOpen, chooseBoardColor, choosePieceSet, closeMusic, closeSettings, fmtTime, hideEvalBar, isMp3Source, jbDisabled, jbPlaying, jbTrackLabel, mp3Buffering, mp3CurrentTime, mp3Duration, mp3Idx, mp3Shuffle, mp3Tracks, musicOpen, musicSource, nextTrack, onVolume, pickMp3Track, pieceDesignsOpen, pieceImgSrc, pieceSetId, prevTrack, seekMp3, setBoardColorsOpen, setMusicSource, setPieceDesignsOpen, setSettingsOpen, settingsOpen, toggleEvalBar, toggleMusic, toggleShuffle, trackName, volume }) {
  return (
    <>
      <Modal open={musicOpen} onClose={closeMusic} closeLabel="Close Juice Box"
        className="jbBox" style={{ width: "min(440px, 92vw)", minWidth: undefined, maxWidth: undefined }}>
            <div className="jbTitle">Music</div>
            <div className="jbVolume">
              <JbIcon name="volume" />
              <input type="range" min="0" max="100" value={volume} onChange={e => onVolume(Number(e.target.value))} aria-label="Music volume" />
              <span className="volPct">{volume}%</span>
              <button className={"jbSfx" + (sfxOn ? " on" : "")} onClick={toggleSfx} aria-pressed={sfxOn}
                title={sfxOn ? "Turn sound effects off" : "Turn sound effects on"}>
                <JbIcon name="pawn" size={18} />Effects
              </button>
            </div>
            <div className="jbNow">
              <img src="/VIRTUOSO_MOLE.webp" alt="" className="jbMole" />
              <div className="jbNowText">
                <select value={musicSource} onChange={e => setMusicSource(e.target.value)} aria-label="Music source">
                  <option value="chiptune">Chiptune</option>
                  {MP3_PLAYLISTS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
                <div className="trackRow">
                  <span className="trackName" title={jbTrackLabel}>{jbTrackLabel}</span>
                  {!isMp3Source && trackName === "Neon Gambit" && <span className="trackTag">default</span>}
                  {isMp3Source && mp3Buffering && !jbDisabled && <span className="trackTag">buffering</span>}
                </div>
              </div>
            </div>
            {isMp3Source && (
              <div className="mp3Progress">
                <span className="mp3Time">{fmtTime(mp3CurrentTime)}</span>
                <input
                  type="range" min="0" max={mp3Duration || 0}
                  value={Math.min(mp3CurrentTime, mp3Duration || 0)}
                  onChange={e => seekMp3(Number(e.target.value))}
                  disabled={jbDisabled || !mp3Duration}
                  aria-label="Track position"
                />
                <span className="mp3Time">{fmtTime(mp3Duration)}</span>
              </div>
            )}
            <div className="jbControls">
              {isMp3Source && (
                <button className={"jbBtn" + (mp3Shuffle ? " active" : "")} onClick={toggleShuffle} disabled={jbDisabled}
                  aria-pressed={mp3Shuffle} aria-label="Shuffle" title={mp3Shuffle ? "Shuffle on" : "Shuffle off"}>
                  <JbIcon name="shuffle" />
                </button>
              )}
              <button className="jbBtn" onClick={prevTrack} disabled={jbDisabled} aria-label="Previous track" title="Previous track"><JbIcon name="prev" /></button>
              <button className="jbBtn jbPlay" onClick={toggleMusic} disabled={jbDisabled} aria-label={jbPlaying ? "Pause music" : "Play music"} title={jbPlaying ? "Pause music" : "Play music"}>
                <JbIcon name={jbPlaying ? "pause" : "play"} size={28} />
              </button>
              <button className="jbBtn" onClick={nextTrack} disabled={jbDisabled} aria-label="Next track" title="Next track"><JbIcon name="next" /></button>
            </div>
            {isMp3Source && mp3Tracks.length > 1 && (
              <div className="jbTrackList">
                {mp3Tracks.map((t, i) => (
                  <button
                    key={t.url}
                    className={"jbTrackRow" + (i === mp3Idx ? " cur" : "")}
                    onClick={() => pickMp3Track(i)}
                    title={t.name}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            )}
      </Modal>

      <Modal open={settingsOpen} onClose={closeSettings} closeLabel="Close Settings">
            <div className="boxHead" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span aria-hidden="true">⚙</span>
              Settings
            </div>
            <div className="rows" style={{ maxHeight: "none" }}>
              <div style={{ cursor: "pointer", padding: "8px 2px", borderBottom: "1px solid #8B2FC92E", display: "flex", alignItems: "center", gap: 10 }} role="button" tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSettingsOpen(false); setPieceDesignsOpen(true); } }}
                onClick={() => { setSettingsOpen(false); setPieceDesignsOpen(true); }}>
                <img src={pieceImgSrc(1, true)} alt="" style={{ width: 30, height: 30, objectFit: "contain", flex: "none", background: "#DDD6EA", borderRadius: 6, padding: 3, boxSizing: "border-box" }} />
                <div>
                  <div style={{ fontWeight: 700 }}>Piece Designs</div>
                  <div style={{ fontSize: 11, opacity: 0.75 }}>Currently: {getPieceSet(pieceSetId).label}</div>
                </div>
              </div>
              <div style={{ cursor: "pointer", padding: "8px 2px", borderBottom: "1px solid #8B2FC92E", display: "flex", alignItems: "center", gap: 10 }} role="button" tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSettingsOpen(false); setBoardColorsOpen(true); } }}
                onClick={() => { setSettingsOpen(false); setBoardColorsOpen(true); }}>
                <span style={{
                  display: "grid", gridTemplateColumns: "1fr 1fr", width: 30, height: 30, flex: "none",
                  borderRadius: 6, overflow: "hidden", border: "1px solid #ffffff22",
                }} aria-hidden="true">
                  <span style={{ background: getBoardColor(boardColorId).light }} />
                  <span style={{ background: getBoardColor(boardColorId).dark }} />
                  <span style={{ background: getBoardColor(boardColorId).dark }} />
                  <span style={{ background: getBoardColor(boardColorId).light }} />
                </span>
                <div>
                  <div style={{ fontWeight: 700 }}>Board Color</div>
                  <div style={{ fontSize: 11, opacity: 0.75 }}>Currently: {getBoardColor(boardColorId).label}</div>
                </div>
              </div>
              <div style={{ padding: "8px 2px", borderBottom: "1px solid #8B2FC92E", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>Eval Bar</div>
                  <div style={{ fontSize: 11, opacity: 0.75 }}>
                    {hideEvalBar ? "Hidden — bigger board on mobile" : "Shown next to the board"}
                  </div>
                </div>
                <button
                  type="button" role="switch" aria-checked={!hideEvalBar} aria-label="Toggle eval bar"
                  className={"toggleSwitch" + (!hideEvalBar ? " on" : "")}
                  onClick={toggleEvalBar}
                >
                  <span className="toggleThumb" />
                </button>
              </div>
            </div>
            <div className="themePick" role="group" aria-label="App theme">
              <button className={"themeOption" + (sweetheart ? "" : " on")} aria-pressed={!sweetheart} onClick={() => chooseTheme(false)}>
                <PixelAvatar rows={ZPIX} pal={ZPAL} size={56} />
                <span>Zlegend27</span>
                <small>Dark</small>
              </button>
              <button className={"themeOption" + (sweetheart ? " on" : "")} aria-pressed={sweetheart} onClick={() => chooseTheme(true)}>
                <img src="/sweetheart-sprite.webp" alt="" />
                <span>Sweetheart</span>
                <small>Light</small>
              </button>
            </div>
      </Modal>

      <Modal open={pieceDesignsOpen} onClose={() => { setPieceDesignsOpen(false); setSettingsOpen(true); }} closeLabel="Close Piece Designs">
            <div className="boxHead" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              Piece Designs
            </div>
            <div className="rows" style={{ maxHeight: "none", display: "flex", flexDirection: "column", gap: 10 }}>
              {PIECE_SETS.map(set => (
                <div key={set.id}
                  style={{
                    cursor: "pointer", padding: "10px 8px", borderRadius: 8,
                    border: set.id === pieceSetId ? "1px solid #F5D93E" : "1px solid #8B2FC92E",
                    display: "flex", alignItems: "center", gap: 12,
                  }}
                  onClick={() => choosePieceSet(set.id)}>
                  <div style={{ display: "flex", gap: 4, background: "#DDD6EA", borderRadius: 6, padding: 4 }}>
                    <img src={set.svgUrl(6, true)} alt="" style={{ width: 36, height: 36, objectFit: "contain" }} />
                    <img src={set.svgUrl(5, false)} alt="" style={{ width: 36, height: 36, objectFit: "contain" }} />
                  </div>
                  <div style={{ fontWeight: 700 }}>{set.label}{set.id === pieceSetId ? " (selected)" : ""}</div>
                </div>
              ))}
            </div>
      </Modal>

      <Modal open={boardColorsOpen} onClose={() => { setBoardColorsOpen(false); setSettingsOpen(true); }} closeLabel="Close Board Color">
            <div className="boxHead" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              Board Color
            </div>
            <div className="rows" style={{ maxHeight: "none", display: "flex", flexDirection: "column", gap: 10 }}>
              {BOARD_COLORS.map(bc => (
                <div key={bc.id}
                  style={{
                    cursor: "pointer", padding: "10px 8px", borderRadius: 8,
                    border: bc.id === boardColorId ? "1px solid #F5D93E" : "1px solid #8B2FC92E",
                    display: "flex", alignItems: "center", gap: 12,
                  }}
                  onClick={() => chooseBoardColor(bc.id)}>
                  <div style={{ display: "grid", gridTemplateColumns: "16px 16px", gridTemplateRows: "16px 16px", borderRadius: 6, overflow: "hidden" }}>
                    <div style={{ background: bc.light }} /><div style={{ background: bc.dark }} />
                    <div style={{ background: bc.dark }} /><div style={{ background: bc.light }} />
                  </div>
                  <div style={{ fontWeight: 700 }}>{bc.label}{bc.id === boardColorId ? " (selected)" : ""}</div>
                </div>
              ))}
            </div>
      </Modal>
    </>
  );
}
