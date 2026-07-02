import { useState, useRef, useCallback, useEffect } from "react";
import {
  createEngine, EMPTY, WN, WB, WR, WQ, WK, M64TO120, M120TO64,
  mFrom, mTo, mPromo, mFlags, MATE,
} from "./engine/chessEngine";
import { createAudio } from "./audio/chiptune";
import PixelAvatar, { ZPAL, ZPIX, UPAL, UPIX, JPAL, JPIX } from "./components/PixelAvatar";
import { loadSetting, saveSetting } from "./utils/storage";
import { buildPgn } from "./utils/pgn";
import { encodeGame, decodeGame, getSharedHash, replayIntoEngine } from "./utils/share";
import "./App.css";

const DIFFICULTIES = [
  { label: "Casual", ms: 600 },
  { label: "Normal", ms: 2000 },
  { label: "Hard", ms: 5000 },
  { label: "Master", ms: 12000 },
];

const GLYPH = { 1: "♟", 2: "♞", 3: "♝", 4: "♜", 5: "♛", 6: "♚" };
const FILES = "abcdefgh";
const PTS = { 1: 1, 2: 3, 3: 3, 4: 5, 5: 9 };
const START_COUNT = { 1: 8, 2: 2, 3: 2, 4: 2, 5: 1 };

function materialState(eng) {
  const rem = { 1: {}, "-1": {} };
  for (const t of [1, 2, 3, 4, 5]) { rem[1][t] = 0; rem[-1][t] = 0; }
  let wPts = 0, bPts = 0;
  for (let i = 0; i < 64; i++) {
    const p = eng.pieceAt(i);
    if (p === EMPTY) continue;
    const a = Math.abs(p);
    if (a === WK) continue;
    if (p > 0) { rem[1][a]++; wPts += PTS[a]; } else { rem[-1][a]++; bPts += PTS[a]; }
  }
  const taken = color => {
    const out = [];
    for (const t of [5, 4, 3, 2, 1]) {
      const missing = Math.max(0, START_COUNT[t] - rem[color][t]);
      for (let k = 0; k < missing; k++) out.push(t);
    }
    return out;
  };
  return { capturedWhite: taken(1), capturedBlack: taken(-1), diff: wPts - bPts };
}

export default function ZlegendsBot() {
  const initialHash = useRef(getSharedHash()).current;
  const initialShared = useRef(initialHash ? decodeGame(initialHash) : null).current;

  const initRef = useRef(null);
  if (!initRef.current) {
    const engine = createEngine();
    const applied = initialShared ? replayIntoEngine(engine, initialShared.moveList) : [];
    initRef.current = { engine, applied };
  }
  const eng = initRef.current.engine;

  const [volume, setVolume] = useState(() => loadSetting("volume", 60));
  const audioRef = useRef(null);
  if (!audioRef.current) audioRef.current = createAudio(loadSetting("trackIdx", 0), volume / 100);
  const audio = audioRef.current;

  const [, force] = useState(0);
  const rerender = () => force(n => n + 1);
  const [mode, setMode] = useState(initialShared ? "replay" : "play");
  const [replayFull, setReplayFull] = useState(initialShared ? initialShared.moveList : []);
  const [replayIndex, setReplayIndex] = useState(initialShared ? initialShared.moveList.length : 0);
  const [replayPlaying, setReplayPlaying] = useState(false);

  const [playerColor, setPlayerColor] = useState(initialShared ? initialShared.playerColor : 1);
  const [selected, setSelected] = useState(-1);
  const [targets, setTargets] = useState([]);
  const [lastMove, setLastMove] = useState(() => {
    const applied = initRef.current.applied;
    if (!applied.length) return null;
    const last = applied[applied.length - 1];
    return { from: mFrom(last), to: mTo(last) };
  });
  const [moveList, setMoveList] = useState(() => initialShared ? initialShared.moveList : []);
  const [thinking, setThinking] = useState(false);
  const [info, setInfo] = useState(null);
  const [result, setResult] = useState(null);
  const [promo, setPromo] = useState(null);
  const [difficultyIdx, setDifficultyIdx] = useState(() => loadSetting("difficultyIdx", 1));
  const [evalCp, setEvalCp] = useState(() => eng.evalWhite());
  const [musicOn, setMusicOn] = useState(false);
  const [trackName, setTrackName] = useState(audioRef.current.trackName());
  const [hintMove, setHintMove] = useState(null);
  const [hinting, setHinting] = useState(false);
  const [shareToast, setShareToast] = useState(null);
  const [pgnToast, setPgnToast] = useState(null);
  const thinkTimeRef = useRef(DIFFICULTIES[difficultyIdx].ms);
  thinkTimeRef.current = DIFFICULTIES[difficultyIdx].ms;

  const checkGameOver = useCallback(() => {
    const legal = eng.legalMoves();
    if (legal.length === 0) {
      if (eng.inCheckNow()) {
        const winner = -eng.getSide();
        return { text: winner === 1 ? "1–0" : "0–1", reason: "Checkmate", winner };
      }
      return { text: "½–½", reason: "Stalemate" };
    }
    if (eng.halfClock() >= 100) return { text: "½–½", reason: "Fifty-move rule" };
    if (eng.repetitionCount() >= 3) return { text: "½–½", reason: "Threefold repetition" };
    if (eng.insufficientMaterial()) return { text: "½–½", reason: "Insufficient material" };
    return null;
  }, [eng]);

  /* replay mode: rebuild the position from the shared move list whenever the step changes */
  useEffect(() => {
    if (mode !== "replay") return;
    eng.reset();
    const applied = replayIntoEngine(eng, replayFull.slice(0, replayIndex));
    if (applied.length) {
      const last = applied[applied.length - 1];
      setLastMove({ from: mFrom(last), to: mTo(last) });
    } else {
      setLastMove(null);
    }
    setMoveList(replayFull.slice(0, replayIndex));
    setEvalCp(eng.evalWhite());
    setSelected(-1); setTargets([]); setHintMove(null);
    setResult(replayIndex === replayFull.length ? checkGameOver() : null);
    rerender();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, replayIndex, replayFull, eng]);

  useEffect(() => {
    if (!replayPlaying) return;
    if (replayIndex >= replayFull.length) { setReplayPlaying(false); return; }
    const t = setTimeout(() => setReplayIndex(i => Math.min(i + 1, replayFull.length)), 800);
    return () => clearTimeout(t);
  }, [replayPlaying, replayIndex, replayFull.length]);

  const isCaptureMove = m => eng.pieceAt(M120TO64[mTo(m)]) !== EMPTY || (mFlags(m) & 1);

  const engineMove = useCallback(() => {
    setThinking(true);
    setTimeout(() => {
      const res = eng.search(thinkTimeRef.current);
      if (res && res.move) {
        const cap = isCaptureMove(res.move);
        const san = eng.sanOf(res.move);
        const pv = eng.pvLine(8);
        eng.make(res.move);
        try { cap ? audio.sfxCapture() : audio.sfxMove(); } catch { /* audio unavailable */ }
        setLastMove({ from: mFrom(res.move), to: mTo(res.move) });
        setMoveList(l => [...l, san]);
        const whiteScore = eng.getSide() === 1 ? -res.score : res.score;
        setEvalCp(whiteScore);
        setInfo({ depth: res.depth, score: whiteScore, nodes: res.nodes, time: res.time, pv });
        setResult(checkGameOver());
      }
      setThinking(false);
      rerender();
    }, 30);
  }, [eng, audio, checkGameOver]);
  const engineMoveRef = useRef(engineMove);
  engineMoveRef.current = engineMove;

  const playMove = useCallback((m) => {
    const cap = isCaptureMove(m);
    const san = eng.sanOf(m);
    eng.make(m);
    try { cap ? audio.sfxCapture() : audio.sfxMove(); } catch { /* audio unavailable */ }
    setLastMove({ from: mFrom(m), to: mTo(m) });
    setMoveList(l => [...l, san]);
    setSelected(-1); setTargets([]); setHintMove(null);
    setEvalCp(eng.evalWhite());
    const over = checkGameOver();
    setResult(over);
    rerender();
    if (!over) engineMoveRef.current();
  }, [eng, audio, checkGameOver]);

  const onSquare = (i64) => {
    if (mode === "replay" || thinking || result || promo) return;
    if (eng.getSide() !== playerColor) return;
    const legal = eng.legalMoves();
    const sq120 = M64TO120[i64];
    if (selected >= 0) {
      const from120 = M64TO120[selected];
      const candidates = legal.filter(m => mFrom(m) === from120 && mTo(m) === sq120);
      if (candidates.length > 0) {
        if (candidates.length > 1) { setPromo({ from: from120, to: sq120, moves: candidates }); return; }
        playMove(candidates[0]);
        return;
      }
    }
    const p = eng.pieceAt(i64);
    if (p !== EMPTY && p * playerColor > 0) {
      setSelected(i64);
      setTargets(legal.filter(m => mFrom(m) === sq120).map(m => M120TO64[mTo(m)]));
    } else { setSelected(-1); setTargets([]); }
  };

  const newGame = (color) => {
    if (mode === "replay") {
      history.replaceState(null, "", window.location.pathname + window.location.search);
      setMode("play");
      setReplayPlaying(false);
    }
    eng.reset();
    setPlayerColor(color);
    setSelected(-1); setTargets([]); setLastMove(null); setHintMove(null);
    setMoveList([]); setInfo(null); setResult(null); setPromo(null); setEvalCp(0);
    rerender();
    if (color === -1) setTimeout(() => engineMoveRef.current(), 60);
  };

  const undo = () => {
    if (mode === "replay" || thinking || eng.plyCount() === 0) return;
    let n;
    if (eng.getSide() === playerColor && eng.plyCount() >= 2) n = 2; else n = 1;
    for (let i = 0; i < n; i++) eng.unmake();
    setMoveList(l => l.slice(0, l.length - n));
    setSelected(-1); setTargets([]); setLastMove(null); setResult(null); setPromo(null); setHintMove(null);
    setEvalCp(eng.evalWhite());
    rerender();
    if (eng.getSide() !== playerColor) setTimeout(() => engineMoveRef.current(), 60);
  };

  const onHint = () => {
    if (mode === "replay" || thinking || hinting || result || promo || eng.getSide() !== playerColor) return;
    setHinting(true);
    setTimeout(() => {
      const res = eng.search(800);
      if (res && res.move) setHintMove({ from: mFrom(res.move), to: mTo(res.move) });
      setHinting(false);
    }, 20);
  };

  const onDifficultyChange = (idx) => {
    setDifficultyIdx(idx);
    saveSetting("difficultyIdx", idx);
  };

  const toggleMusic = () => setMusicOn(audio.toggle());
  const nextTrack = () => { setTrackName(audio.next()); saveSetting("trackIdx", audio.trackIndex()); };
  const prevTrack = () => { setTrackName(audio.prev()); saveSetting("trackIdx", audio.trackIndex()); };
  const onVolume = v => { setVolume(v); audio.setVolume(v / 100); saveSetting("volume", v); };

  const onCopyPgn = async () => {
    const pgn = buildPgn(moveList, result ? result.text : "*");
    try {
      await navigator.clipboard.writeText(pgn);
      setPgnToast("PGN copied!");
    } catch {
      window.prompt("Copy PGN:", pgn);
    }
    setTimeout(() => setPgnToast(null), 2000);
  };

  const onShare = async () => {
    const hash = encodeGame(playerColor, moveList);
    const url = `${window.location.origin}${window.location.pathname}#g=${hash}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareToast("Link copied — send it to a viewer!");
      setTimeout(() => setShareToast(null), 2500);
    } catch {
      window.prompt("Copy this link to share the game:", url);
    }
  };

  const exitReplay = () => newGame(1);
  const replayStep = (delta) => setReplayIndex(i => Math.max(0, Math.min(replayFull.length, i + delta)));
  const toggleReplayPlay = () => setReplayPlaying(p => !p);

  /* eval bar */
  const evalPawns = evalCp / 100;
  const whiteShare = Math.max(4, Math.min(96, 50 + (Math.atan(evalPawns / 3) / (Math.PI / 2)) * 46));
  const evalLabel = Math.abs(evalCp) >= MATE - 300
    ? "M" + Math.ceil((MATE - Math.abs(evalCp)) / 2)
    : (evalPawns > 0 ? "+" : "") + evalPawns.toFixed(1);
  const playerShare = playerColor === 1 ? whiteShare : 100 - whiteShare;

  /* captures */
  const mat = materialState(eng);
  const botColor = -playerColor;
  const botTaken = botColor === 1 ? mat.capturedBlack : mat.capturedWhite;
  const youTaken = playerColor === 1 ? mat.capturedBlack : mat.capturedWhite;
  const youDiff = playerColor === 1 ? mat.diff : -mat.diff;

  const flipped = playerColor === -1;
  const rows = [];
  for (let vr = 0; vr < 8; vr++) {
    const r = flipped ? vr : 7 - vr;
    const cells = [];
    for (let vf = 0; vf < 8; vf++) {
      const f = flipped ? 7 - vf : vf;
      const i64 = r * 8 + f;
      const sq120 = M64TO120[i64];
      const p = eng.pieceAt(i64);
      const light = (r + f) % 2 === 1;
      const isSel = selected === i64;
      const isTarget = targets.includes(i64);
      const isLast = lastMove && (lastMove.from === sq120 || lastMove.to === sq120);
      const isHintFrom = hintMove && hintMove.from === sq120;
      const isHintTo = hintMove && hintMove.to === sq120;
      const kingInCheck = p * eng.getSide() === WK && eng.inCheckNow();
      cells.push(
        <div key={i64} onClick={() => onSquare(i64)}
          className={"sq " + (light ? "light" : "dark") + (isSel ? " sel" : "") + (isLast ? " last" : "") +
            (kingInCheck ? " chk" : "") + (isHintFrom ? " hintFrom" : "") + (isHintTo ? " hintTo" : "")}>
          {p !== EMPTY && <span className={"pc " + (p > 0 ? "w" : "b")}>{GLYPH[Math.abs(p)]}</span>}
          {isTarget && <span className={"dot" + (p !== EMPTY ? " ring" : "")} />}
          {vf === 0 && <span className="coord rk">{r + 1}</span>}
          {vr === 7 && <span className="coord fl">{FILES[f]}</span>}
        </div>
      );
    }
    rows.push(<div key={vr} className="brow">{cells}</div>);
  }

  const pairs = [];
  for (let i = 0; i < moveList.length; i += 2) pairs.push([moveList[i], moveList[i + 1]]);

  const inChk = eng.inCheckNow() && !result;
  const status = mode === "replay"
    ? (replayIndex === 0 ? "Shared game — start of the line" : replayIndex === replayFull.length ? "Shared game — final position" : `Shared game — move ${replayIndex}`)
    : result
    ? `${result.reason} · ${result.text}`
    : thinking ? "Zlegend's Bot is calculating…"
    : eng.getSide() === playerColor ? "Your move, challenger" : "Bot to move";

  const Tray = ({ pieces, colorClass }) => (
    <div className="tray">
      {pieces.length === 0
        ? <span className="trayEmpty">no captures yet</span>
        : pieces.map((t, i) => <span key={i} className={"trayPc " + colorClass}>{GLYPH[t]}</span>)}
    </div>
  );

  return (
    <div className="root">
      <div className="hdr">
        <div className="eyebrow"><span className="live" />{"Live · Viewer Challenge"}</div>
        <h1>Zlegend's Bot</h1>
        <div className="sub">can you beat it??</div>
      </div>

      <div className="layout">
        <div className="boardCol">
          <div className={"card" + (mode === "play" && !result && !thinking && eng.getSide() === botColor ? " turnGlow" : "")}>
            <div className="avatarBox"><PixelAvatar rows={ZPIX} pal={ZPAL} size={44} /></div>
            <div className="cardMeta">
              <div className="cardName bot">Zlegend's Bot</div>
              <Tray pieces={botTaken} colorClass={playerColor === 1 ? "wpc" : "bpc"} />
            </div>
            {youDiff < 0 && <div className="lead">+{-youDiff}</div>}
          </div>

          <div className="boardWrap">
            <div className="evalbar" title={"Eval " + evalLabel}>
              <div className="pfill" style={{ height: playerShare + "%" }} />
              <div className="tick" />
            </div>
            <div style={{ position: "relative", flex: 1 }}>
              <div className="board">
                {rows}
                {promo && (
                  <div className="promoOv">
                    <div className="promoBox">
                      {[WQ, WR, WB, WN].map(pp => (
                        <button key={pp} onClick={() => {
                          const m = promo.moves.find(x => mPromo(x) === pp);
                          setPromo(null);
                          if (m) playMove(m);
                        }}>
                          <span className={"pc " + (playerColor === 1 ? "w" : "b")} style={{ fontSize: 32 }}>{GLYPH[pp]}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className={"card" + (mode === "play" && !result && !thinking && eng.getSide() === playerColor ? " turnGlow" : "")}>
            <div className="avatarBox"><PixelAvatar rows={UPIX} pal={UPAL} size={44} /></div>
            <div className="cardMeta">
              <div className="cardName you">You (Challenger)</div>
              <Tray pieces={youTaken} colorClass={playerColor === 1 ? "bpc" : "wpc"} />
            </div>
            {youDiff > 0 && <div className="lead">+{youDiff}</div>}
          </div>

          <div className="statusRow">
            <span className={"status" + (result ? " over" : "")}>{status}</span>
            {inChk && <span className="bang">!!</span>}
            {mode === "replay" && <span className="replayBadge">Replay</span>}
          </div>

          {mode === "replay" && (
            <div className="ctrls" style={{ justifyContent: "center" }}>
              <button className="btn ghost" onClick={() => setReplayIndex(0)} disabled={replayIndex === 0}>{"|◀"}</button>
              <button className="btn ghost" onClick={() => replayStep(-1)} disabled={replayIndex === 0}>{"◀"}</button>
              <button className="btn" onClick={toggleReplayPlay} disabled={replayIndex >= replayFull.length && !replayPlaying}>
                {replayPlaying ? "Pause" : "Play"}
              </button>
              <button className="btn ghost" onClick={() => replayStep(1)} disabled={replayIndex >= replayFull.length}>{"▶"}</button>
              <button className="btn ghost" onClick={() => setReplayIndex(replayFull.length)} disabled={replayIndex >= replayFull.length}>{"▶|"}</button>
              <button className="btn gold" onClick={exitReplay}>Start your own game</button>
            </div>
          )}
        </div>

        <div className="panel">
          <div className="box">
            <div className="boxHead jbHead">
              <PixelAvatar rows={JPIX} pal={JPAL} size={20} />
              <span>Juice Box</span>
            </div>
            <div className="trackRow">
              <span className="trackName">{"♪ " + trackName}</span>
              {trackName === "Neon Gambit" && <span className="trackTag">default</span>}
            </div>
            <div className="audioRow">
              <button className="playBtn sm" onClick={prevTrack} title="Previous track">{"◀◀"}</button>
              <button className="playBtn" onClick={toggleMusic} title={musicOn ? "Pause music" : "Play music"}>
                {musicOn ? "❚❚" : "▶"}
              </button>
              <button className="playBtn sm" onClick={nextTrack} title="Next track">{"▶▶"}</button>
              <input type="range" min="0" max="100" value={volume} onChange={e => onVolume(Number(e.target.value))} />
              <span className="volPct">{volume}%</span>
            </div>
          </div>

          <div className="box">
            <div className="boxHead" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Scoresheet</span>
              {moveList.length > 0 && (
                <button className="btn ghost" style={{ padding: "4px 8px", fontSize: 10 }} onClick={onCopyPgn}>Copy PGN</button>
              )}
            </div>
            <div className="rows">
              {pairs.length === 0 && <div className="empty">{"No moves yet — white to play."}</div>}
              {pairs.map(([w, b], i) => (
                <div className="mrow" key={i}>
                  <span className="num">{i + 1}.</span>
                  <span className={i === pairs.length - 1 && !b ? "cur" : ""}>{w}</span>
                  <span className={i === pairs.length - 1 && b ? "cur" : ""}>{b || ""}</span>
                </div>
              ))}
            </div>
            {pgnToast && <div className="toast">{pgnToast}</div>}
          </div>

          <div className="box">
            <div className="boxHead">Bot Analysis</div>
            {info ? (
              <>
                <div className="astats">
                  <div><b>{evalLabel}</b><span>eval</span></div>
                  <div><b>{info.depth}</b><span>depth</span></div>
                  <div><b>{(info.nodes / 1000).toFixed(0)}k</b><span>nodes</span></div>
                  <div><b>{(info.time / 1000).toFixed(1)}s</b><span>time</span></div>
                </div>
                {info.pv.length > 0 && <div className="pv">line: {info.pv.join(" ")}</div>}
              </>
            ) : (
              <div className="pv">After each of its moves, the bot posts its eval, search depth, node count, and the line it expects.</div>
            )}
          </div>

          {mode === "play" && (
            <div className="ctrls">
              <button className="btn" onClick={() => newGame(1)}>New &middot; White</button>
              <button className="btn" onClick={() => newGame(-1)}>New &middot; Black</button>
              <button className="btn" onClick={undo} disabled={thinking || eng.plyCount() === 0}>Undo</button>
              <button className="btn ghost" onClick={onHint}
                disabled={thinking || hinting || !!result || !!promo || eng.getSide() !== playerColor}>
                {hinting ? "Thinking…" : "Hint"}
              </button>
              <select value={difficultyIdx} onChange={e => onDifficultyChange(Number(e.target.value))}>
                {DIFFICULTIES.map((d, i) => <option key={i} value={i}>{"Level: " + d.label}</option>)}
              </select>
              {moveList.length > 0 && <button className="btn ghost" onClick={onShare}>Share</button>}
              {result && <button className="btn gold" onClick={() => newGame(playerColor)}>Rematch!</button>}
              {shareToast && <div className="toast">{shareToast}</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
