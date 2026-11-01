import { MP3_PLAYLISTS } from "../utils/musicLibrary";
import { PIECE_SETS, getPieceSet } from "../utils/pieceSets";
import { BOARD_COLORS, getBoardColor } from "../utils/boardColors";
import Modal from "./Modal";

/* The Juice Box, Settings, Piece Designs and Board Colors popups. Loaded only
   when one of them is open (see App.jsx). Everything they read comes in as a
   prop, so this file holds no state of its own. */
export default function AppPopups({ boardColorId, boardColorsOpen, chooseBoardColor, choosePieceSet, closeMusic, closeSettings, fmtTime, hideEvalBar, isMp3Source, jbDisabled, jbPlaying, jbTrackLabel, mp3Buffering, mp3CurrentTime, mp3Duration, mp3Idx, mp3Shuffle, mp3Tracks, musicOpen, musicSource, nextTrack, onVolume, pickMp3Track, pieceDesignsOpen, pieceImgSrc, pieceSetId, prevTrack, seekMp3, setBoardColorsOpen, setMusicSource, setPieceDesignsOpen, setSettingsOpen, settingsOpen, toggleEvalBar, toggleMusic, toggleShuffle, trackName, volume }) {
  return (
    <>
      <Modal open={musicOpen} onClose={closeMusic} closeLabel="Close Juice Box"
        className="jbBox" style={{ width: 300, minWidth: undefined, maxWidth: undefined }}>
            <img src="/VIRTUOSO_MOLE.webp" alt="Juice Box" className="jbMole" />
            <select value={musicSource} onChange={e => setMusicSource(e.target.value)}>
              <option value="chiptune">Chiptune</option>
              {MP3_PLAYLISTS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
            <div className="trackRow">
              <span className="trackName" title={jbTrackLabel}>{"♪ " + jbTrackLabel}</span>
              {!isMp3Source && trackName === "Neon Gambit" && <span className="trackTag">default</span>}
              {isMp3Source && mp3Buffering && !jbDisabled && <span className="trackTag">buffering</span>}
            </div>
            {isMp3Source && (
              <div className="mp3Progress">
                <span className="mp3Time">{fmtTime(mp3CurrentTime)}</span>
                <input
                  type="range" min="0" max={mp3Duration || 0}
                  value={Math.min(mp3CurrentTime, mp3Duration || 0)}
                  onChange={e => seekMp3(Number(e.target.value))}
                  disabled={jbDisabled || !mp3Duration}
                />
                <span className="mp3Time">{fmtTime(mp3Duration)}</span>
              </div>
            )}
            <div className="audioRow">
              {isMp3Source && (
                <button className={"playBtn sm" + (mp3Shuffle ? " active" : "")} onClick={toggleShuffle} disabled={jbDisabled} title={mp3Shuffle ? "Shuffle on" : "Shuffle off"}>
                  {"\u{1F500}"}
                </button>
              )}
              <button className="playBtn sm" onClick={prevTrack} disabled={jbDisabled} title="Previous track">{"◀◀"}</button>
              <button className="playBtn" onClick={toggleMusic} disabled={jbDisabled} title={jbPlaying ? "Pause music" : "Play music"}>
                {jbPlaying ? "❚❚" : "▶"}
              </button>
              <button className="playBtn sm" onClick={nextTrack} disabled={jbDisabled} title="Next track">{"▶▶"}</button>
              <input type="range" min="0" max="100" value={volume} onChange={e => onVolume(Number(e.target.value))} />
              <span className="volPct">{volume}%</span>
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
