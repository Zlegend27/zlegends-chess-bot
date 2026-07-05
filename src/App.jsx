import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  createEngine, EMPTY, WN, WB, WR, WQ, WK, M64TO120, M120TO64,
  mFrom, mTo, mPromo, mFlags, MATE, fileOf, rankOf,
} from "./engine/chessEngine";
import { createAudio } from "./audio/chiptune";
import PixelAvatar, { ZPAL, ZPIX, JPAL, JPIX, BPAL, BPIX, PPAL, PPIX } from "./components/PixelAvatar";
import SocialLinks from "./components/SocialLinks";
import StarField from "./components/StarField";
import { loadSetting, saveSetting } from "./utils/storage";
import { buildPgn } from "./utils/pgn";
import { encodeGame, decodeGame, getSharedHash, replayIntoEngine } from "./utils/share";
import { pieceSvgUrl } from "./utils/chessPieceSvg";
import { saveGame } from "./utils/gameHistory";
import { ENGINE_VERSION } from "./utils/version";
import { OPENINGS } from "./utils/openings";
import { PUZZLES, RATING_BANDS } from "./utils/puzzles";
import { stockfishBestMove, STOCKFISH_MIN_ELO } from "./engine/stockfishEngine";
import "./App.css";

/* Casual and Master keep this app's own homemade engine (they're the top
   two tiers and were never in question). The three tiers below them are
   backed by a real Stockfish build instead of guessed search-time
   budgets, so "1000/1500/2000" are meant to actually mean something
   against chess.com's own rating scale -- see stockfishEngine.js for why.
   Stockfish's UCI_Elo has a hard floor of 1320, so the "1000" tier adds
   an extra blunder chance on top of that floor to push it down further. */
const DIFFICULTIES = [
  { label: "1000 Elo", stockfishElo: STOCKFISH_MIN_ELO, blunderChance: 0.3, moveTimeMs: 500 },
  { label: "1500 Elo", stockfishElo: 1500, moveTimeMs: 700 },
  { label: "2000 Elo", stockfishElo: 2000, moveTimeMs: 1000 },
  { label: "Casual", ms: 600, book: true },
  { label: "Master", ms: 12000, book: true },
];

/* Named weight presets on evaluate()'s existing material/position/king-safety
   terms — same eval function, different personality, no engine duplication.
   The bot picks and adapts its own style (see pickPersonality below) rather
   than exposing it as a player-facing setting. */
const PERSONALITIES = [
  { label: "Balanced", material: 1, pawnValue: 1, position: 1, kingSafety: 1 },
  { label: "Aggressive", material: 0.95, pawnValue: 1, position: 1.3, kingSafety: 0.6 },
  { label: "Positional", material: 1, pawnValue: 1, position: 1.35, kingSafety: 1 },
  { label: "Defensive", material: 1.15, pawnValue: 1.05, position: 0.85, kingSafety: 1.7 },
  { label: "Tactical", material: 0.9, pawnValue: 0.85, position: 1.15, kingSafety: 0.9 },
  { label: "Gambit", material: 1, pawnValue: 0.65, position: 1.2, kingSafety: 0.8 },
  { label: "Endgame", material: 1.05, pawnValue: 1.15, position: 1.1, kingSafety: 0.9 },
];
const byStyle = label => PERSONALITIES.find(p => p.label === label);
const BALANCED = byStyle("Balanced");
/* One style is rolled per game (its "personality of the day"), then nudged
   situationally: complicate when losing badly, play it safe when winning
   big, switch to technique once the game reaches a long endgame. */
const GAME_STYLES = ["Aggressive", "Positional", "Defensive", "Tactical", "Gambit"];
const randomStyle = () => byStyle(GAME_STYLES[(Math.random() * GAME_STYLES.length) | 0]);
function pickPersonality(baseStyle, plyCount, botAdvantagePawns) {
  if (plyCount > 40) return byStyle("Endgame");
  if (botAdvantagePawns <= -2.5) return byStyle("Tactical");
  if (botAdvantagePawns >= 3) return byStyle("Defensive");
  return baseStyle;
}

/* Pieces render as classic bold black/white Staunton silhouettes (see
   utils/chessPieceSvg.js) rather than a stylized look — the rest of the UI
   already carries plenty of neon color, so the pieces themselves stay big,
   plain, and instantly readable. */
const pieceImgSrc = (type, isWhite) => pieceSvgUrl(type, isWhite);
const FILES = "abcdefgh";
const PIECE_NAME = { 1: "pawn", 2: "knight", 3: "bishop", 4: "rook", 5: "queen", 6: "king" };
const PTS = { 1: 1, 2: 3, 3: 3, 4: 5, 5: 9 };
const START_COUNT = { 1: 8, 2: 2, 3: 2, 4: 2, 5: 1 };
const RUSH_DURATIONS = [
  { seconds: 60, label: "1 Minute" },
  { seconds: 180, label: "3 Minutes" },
  { seconds: 300, label: "5 Minutes" },
];
const formatClock = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
/* Puzzle Rush difficulty ramp: climb one rating band every 3 solves in a
   row, drop back one band on a miss so a rough patch doesn't strand the
   player facing puzzles far above what they just missed. */
const RUSH_STEP_UP_EVERY = 3;

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
    const applied = initialShared ? replayIntoEngine(engine, initialShared.moveList).applied : [];
    initRef.current = { engine, applied };
  }
  const eng = initRef.current.engine;

  const [volume, setVolume] = useState(() => loadSetting("volume", 60));
  const audioRef = useRef(null);
  if (!audioRef.current) audioRef.current = createAudio(loadSetting("trackIdx", 0), volume / 100);
  const audio = audioRef.current;

  /* engine search runs in a worker so it never blocks the audio scheduler or UI */
  const workerRef = useRef(null);
  const pendingSearchesRef = useRef(new Map());
  const searchIdRef = useRef(0);
  if (!workerRef.current) {
    workerRef.current = new Worker(new URL("./engine/engineWorker.js", import.meta.url), { type: "module" });
    workerRef.current.onmessage = (e) => {
      const { id, result } = e.data;
      const resolve = pendingSearchesRef.current.get(id);
      if (resolve) { pendingSearchesRef.current.delete(id); resolve(result); }
    };
  }
  const runSearch = useCallback((searchMoveList, timeMs, blunderChance = 0, opts = {}) => {
    const id = ++searchIdRef.current;
    return new Promise((resolve) => {
      pendingSearchesRef.current.set(id, resolve);
      workerRef.current.postMessage({
        id, moveList: searchMoveList, timeMs, blunderChance,
        personality: opts.personality, useBook: !!opts.useBook,
      });
    });
  }, []);

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
  const moveListRef = useRef(moveList);
  moveListRef.current = moveList;
  const [thinking, setThinking] = useState(false);
  const [info, setInfo] = useState(null);
  const [result, setResult] = useState(null);
  const [promo, setPromo] = useState(null);
  const [colorPick, setColorPick] = useState(false);
  const [difficultyIdx, setDifficultyIdx] = useState(() => loadSetting("difficultyIdx", 2));
  const [gameStyle, setGameStyle] = useState(() => randomStyle());
  const [evalCp, setEvalCp] = useState(() => eng.evalWhite());
  const [musicOn, setMusicOn] = useState(false);
  const [trackName, setTrackName] = useState(audioRef.current.trackName());
  const [hintMove, setHintMove] = useState(null);
  const [hinting, setHinting] = useState(false);
  const [reviewIndex, setReviewIndex] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [bestArrow, setBestArrow] = useState(null);
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const [analysisExtra, setAnalysisExtra] = useState([]);
  const [posVersion, setPosVersion] = useState(0);
  const [shareToast, setShareToast] = useState(null);
  const [pgnToast, setPgnToast] = useState(null);
  const [musicOpen, setMusicOpen] = useState(false);
  const [openingsOpen, setOpeningsOpen] = useState(false);
  const [activeOpening, setActiveOpening] = useState(null);
  const [quizOpening, setQuizOpening] = useState(null);
  const [quizFeedback, setQuizFeedback] = useState(null);
  const [quizDoneToast, setQuizDoneToast] = useState(null);
  const [puzzlesOpen, setPuzzlesOpen] = useState(false);
  const [puzzleBand, setPuzzleBand] = useState(null);
  const [activePuzzle, setActivePuzzle] = useState(null);
  const [puzzleFeedback, setPuzzleFeedback] = useState(null);
  const [puzzleSolved, setPuzzleSolved] = useState(false);
  const [rushOpen, setRushOpen] = useState(false);
  const [rushMode, setRushMode] = useState(false);
  const [rushDuration, setRushDuration] = useState(60);
  const [rushTimeLeft, setRushTimeLeft] = useState(60);
  const [rushMistakes, setRushMistakes] = useState(0);
  const [rushSolved, setRushSolved] = useState(0);
  const [rushResult, setRushResult] = useState(null);
  const [rushBandIdx, setRushBandIdx] = useState(0);
  const rushSolvedRef = useRef(0);
  const rushMistakesRef = useRef(0);
  const rushBandIdxRef = useRef(0);
  const rushStreakRef = useRef(0);
  const difficultyRef = useRef(DIFFICULTIES[difficultyIdx]);
  difficultyRef.current = DIFFICULTIES[difficultyIdx];
  const gameStyleRef = useRef(gameStyle);
  gameStyleRef.current = gameStyle;
  const playerColorRef = useRef(playerColor);
  playerColorRef.current = playerColor;

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
  const replayFirstRun = useRef(true);
  useEffect(() => {
    if (mode !== "replay") return;
    eng.reset();
    const { applied, lastCaptured } = replayIntoEngine(eng, replayFull.slice(0, replayIndex));
    if (applied.length) {
      const last = applied[applied.length - 1];
      setLastMove({ from: mFrom(last), to: mTo(last) });
      if (!replayFirstRun.current) {
        try { lastCaptured ? audio.sfxCapture() : audio.sfxMove(); } catch { /* audio unavailable */ }
      }
    } else {
      setLastMove(null);
    }
    replayFirstRun.current = false;
    setMoveList(replayFull.slice(0, replayIndex));
    setEvalCp(eng.evalWhite());
    setSelected(-1); setTargets([]); setHintMove(null);
    setResult(replayIndex === replayFull.length ? checkGameOver() : null);
    setAnalysisExtra([]); setBestArrow(null);
    setPosVersion(v => v + 1);
    rerender();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, replayIndex, replayFull, eng]);

  useEffect(() => {
    if (!replayPlaying) return;
    if (replayIndex >= replayFull.length) { setReplayPlaying(false); return; }
    const t = setTimeout(() => setReplayIndex(i => Math.min(i + 1, replayFull.length)), 800);
    return () => clearTimeout(t);
  }, [replayPlaying, replayIndex, replayFull.length]);

  /* post-game review: step through the just-finished game without altering its record */
  const reviewing = mode === "play" && !!result && reviewIndex !== null;
  /* Analyze is available both in post-game review and while browsing an
     opening/shared replay -- anywhere the board is showing a fixed,
     already-decided position rather than a live game the player is
     mid-move in. */
  const canAnalyze = reviewing || mode === "replay";
  const reviewFirstRun = useRef(true);
  useEffect(() => {
    if (!reviewing) { reviewFirstRun.current = true; if (mode !== "replay") { setAnalyzing(false); setBestArrow(null); setAnalysisExtra([]); } return; }
    eng.reset();
    setAnalysisExtra([]);
    const { applied, lastCaptured } = replayIntoEngine(eng, moveList.slice(0, reviewIndex));
    if (applied.length) {
      const last = applied[applied.length - 1];
      setLastMove({ from: mFrom(last), to: mTo(last) });
      if (!reviewFirstRun.current) {
        try { lastCaptured ? audio.sfxCapture() : audio.sfxMove(); } catch { /* audio unavailable */ }
      }
    } else {
      setLastMove(null);
    }
    reviewFirstRun.current = false;
    setEvalCp(eng.evalWhite());
    setSelected(-1); setTargets([]);
    setPosVersion(v => v + 1);
    rerender();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewing, reviewIndex, moveList, eng]);

  /* leaving both analyzable modes (e.g. starting a fresh game) should
     always clear analysis state, even though the effect above only runs
     on reviewing's own transitions */
  useEffect(() => {
    if (canAnalyze) return;
    setAnalyzing(false); setBestArrow(null); setAnalysisExtra([]);
  }, [canAnalyze]);

  /* analysis mode: while reviewing or browsing a replay, continuously
     suggest the engine's best move as an arrow */
  useEffect(() => {
    if (!canAnalyze || !analyzing) return;
    setAnalysisBusy(true);
    let cancelled = false;
    const fullLine = (reviewing ? moveList.slice(0, reviewIndex) : moveList).concat(analysisExtra);
    runSearch(fullLine, 800, 0, { personality: BALANCED, useBook: false }).then((res) => {
      if (cancelled) return;
      if (res && res.move) {
        setBestArrow({ from: mFrom(res.move), to: mTo(res.move) });
        const whiteScore = eng.getSide() === 1 ? -res.score : res.score;
        setInfo({ depth: res.depth, score: whiteScore, nodes: res.nodes, time: res.time, pv: res.pv });
      } else {
        setBestArrow(null);
      }
      setAnalysisBusy(false);
    });
    return () => { cancelled = true; };
  }, [canAnalyze, reviewing, analyzing, posVersion, moveList, reviewIndex, analysisExtra, eng, runSearch]);

  const isCaptureMove = m => eng.pieceAt(M120TO64[mTo(m)]) !== EMPTY || (mFlags(m) & 1);

  const analysisMove = useCallback((m) => {
    const cap = isCaptureMove(m);
    const san = eng.sanOf(m);
    eng.make(m);
    try { cap ? audio.sfxCapture() : audio.sfxMove(); } catch { /* audio unavailable */ }
    setLastMove({ from: mFrom(m), to: mTo(m) });
    setSelected(-1); setTargets([]);
    setEvalCp(eng.evalWhite());
    setBestArrow(null);
    setAnalysisExtra(prev => [...prev, san]);
    setPosVersion(v => v + 1);
    rerender();
  }, [eng, audio]);

  const toggleAnalyze = () => {
    if (!canAnalyze) return;
    setAnalyzing(a => !a);
    setSelected(-1); setTargets([]); setBestArrow(null);
  };

  /* Stockfish tiers report score/depth/nodes/time/pv the same shape the
     homemade engine's worker does, so the .then() handler below can stay
     identical either way -- see stockfishEngine.js for why Stockfish was
     brought in for these three tiers instead of tuning search time. */
  const stockfishMove = useCallback((diff) => {
    return stockfishBestMove(eng.fen(), diff.stockfishElo, diff.moveTimeMs || 1000).then(({ uci, info }) => {
      if (!uci) return null;
      let move = eng.moveFromUci(uci);
      if (move && diff.blunderChance && Math.random() < diff.blunderChance) {
        const legal = eng.legalMoves();
        if (legal.length) move = legal[(Math.random() * legal.length) | 0];
      }
      if (!move) return null;
      return {
        move, san: eng.sanOf(move),
        score: info ? info.score : 0, depth: info ? info.depth : 0,
        nodes: info ? info.nodes : 0, time: info ? info.time : (diff.moveTimeMs || 1000),
        pv: info ? info.pv : [], book: false,
      };
    });
  }, [eng]);

  const engineMove = useCallback((currentMoveList) => {
    setThinking(true);
    const diff = difficultyRef.current;
    const botColorNow = -playerColorRef.current;
    const whiteEvalNow = eng.evalWhite();
    const botAdvantagePawns = (botColorNow === 1 ? whiteEvalNow : -whiteEvalNow) / 100;
    const personality = pickPersonality(gameStyleRef.current, eng.plyCount(), botAdvantagePawns);
    const searchPromise = diff.stockfishElo
      ? stockfishMove(diff)
      : runSearch(currentMoveList, diff.ms, diff.blunderChance || 0, { personality, useBook: diff.book });
    searchPromise.then((res) => {
      if (res && res.move) {
        const cap = isCaptureMove(res.move);
        eng.make(res.move);
        try { cap ? audio.sfxCapture() : audio.sfxMove(); } catch { /* audio unavailable */ }
        setLastMove({ from: mFrom(res.move), to: mTo(res.move) });
        const newMoveList = [...currentMoveList, res.san];
        moveListRef.current = newMoveList;
        setMoveList(newMoveList);
        const whiteScore = eng.getSide() === 1 ? -res.score : res.score;
        setEvalCp(whiteScore);
        setInfo({ depth: res.depth, score: whiteScore, nodes: res.nodes, time: res.time, pv: res.pv, book: res.book });
        const over = checkGameOver();
        setResult(over);
        if (over) {
          setReviewIndex(eng.plyCount());
          saveGame({ difficultyLabel: difficultyRef.current.label, playerColor: playerColorRef.current, moveList: newMoveList, result: over, finalEval: whiteScore, style: gameStyleRef.current.label, engineVersion: ENGINE_VERSION });
        }
      }
      setThinking(false);
      rerender();
    });
  }, [eng, audio, checkGameOver, runSearch, stockfishMove]);
  const engineMoveRef = useRef(engineMove);
  engineMoveRef.current = engineMove;

  const playMove = useCallback((m) => {
    const cap = isCaptureMove(m);
    const san = eng.sanOf(m);
    eng.make(m);
    try { cap ? audio.sfxCapture() : audio.sfxMove(); } catch { /* audio unavailable */ }
    setLastMove({ from: mFrom(m), to: mTo(m) });
    const newMoveList = [...moveListRef.current, san];
    moveListRef.current = newMoveList;
    setMoveList(newMoveList);
    setSelected(-1); setTargets([]); setHintMove(null);
    setEvalCp(eng.evalWhite());
    const over = checkGameOver();
    setResult(over);
    if (over) {
      setReviewIndex(eng.plyCount());
      saveGame({ difficultyLabel: difficultyRef.current.label, playerColor: playerColorRef.current, moveList: newMoveList, result: over, finalEval: eng.evalWhite(), style: gameStyleRef.current.label, engineVersion: ENGINE_VERSION });
    }
    rerender();
    if (!over) engineMoveRef.current(newMoveList);
  }, [eng, audio, checkGameOver]);

  const onSquare = (i64) => {
    if ((mode === "replay" && !analyzing) || thinking || promo) return;
    const inQuiz = !!quizOpening;
    const inPuzzle = !!activePuzzle;
    if (inPuzzle && puzzleSolved) return;
    const legal = eng.legalMoves();
    const sq120 = M64TO120[i64];
    const sideToMove = (analyzing || inQuiz) ? eng.getSide() : playerColor;
    if (!analyzing && !inQuiz && (result || eng.getSide() !== playerColor)) return;
    if (inQuiz && result) return;
    if (selected >= 0) {
      const from120 = M64TO120[selected];
      const candidates = legal.filter(m => mFrom(m) === from120 && mTo(m) === sq120);
      if (candidates.length > 0) {
        if (candidates.length > 1) { setPromo({ from: from120, to: sq120, moves: candidates }); return; }
        inPuzzle ? puzzleMove(candidates[0]) : inQuiz ? quizMove(candidates[0]) : (analyzing ? analysisMove(candidates[0]) : playMove(candidates[0]));
        return;
      }
    }
    const p = eng.pieceAt(i64);
    if (p !== EMPTY && p * sideToMove > 0) {
      setSelected(i64);
      setTargets(legal.filter(m => mFrom(m) === sq120).map(m => M120TO64[mTo(m)]));
    } else { setSelected(-1); setTargets([]); }
  };
  /* The memoized board below only rebuilds when position-relevant state
     changes, so its onClick/onKeyDown closures can't safely capture
     onSquare directly — it also reads thinking/promo/quizOpening/result/
     analyzing, none of which are in that memo's deps. Routing through a
     ref that's always reassigned to the latest onSquare keeps clicks
     correct without needing to rebuild all 64 cells whenever any of those
     change. */
  const onSquareRef = useRef(onSquare);
  onSquareRef.current = onSquare;

  const newGame = (color) => {
    if (mode === "replay") {
      history.replaceState(null, "", window.location.pathname + window.location.search);
      setMode("play");
      setReplayPlaying(false);
    }
    eng.reset();
    moveListRef.current = [];
    setPlayerColor(color);
    setGameStyle(randomStyle());
    setActiveOpening(null);
    setQuizOpening(null);
    setQuizFeedback(null);
    setActivePuzzle(null);
    setPuzzleFeedback(null);
    setPuzzleSolved(false);
    setSelected(-1); setTargets([]); setLastMove(null); setHintMove(null);
    setMoveList([]); setInfo(null); setResult(null); setPromo(null); setEvalCp(0); setReviewIndex(null);
    rerender();
    if (color === -1) setTimeout(() => engineMoveRef.current([]), 60);
  };

  const startOpening = (opening) => {
    setOpeningsOpen(false);
    setActiveOpening(opening);
    setPlayerColor(opening.for === "black" ? -1 : 1);
    setMode("replay");
    setReplayFull(opening.moves);
    setReplayIndex(0);
    setReplayPlaying(false);
  };

  const startQuiz = (opening) => {
    eng.reset();
    moveListRef.current = [];
    setQuizOpening(opening);
    setActiveOpening(null);
    setPlayerColor(opening.for === "black" ? -1 : 1);
    setMode("play");
    setSelected(-1); setTargets([]); setLastMove(null); setHintMove(null);
    setMoveList([]); setInfo(null); setResult(null); setPromo(null); setEvalCp(0); setReviewIndex(null);
    setQuizFeedback(null);
    rerender();
  };

  const quizMove = useCallback((m) => {
    const idx = moveListRef.current.length;
    const expectedSan = quizOpening.moves[idx];
    const attemptedSan = eng.sanOf(m);
    if (attemptedSan !== expectedSan) {
      setQuizFeedback("Not quite — try again!");
      setSelected(-1); setTargets([]);
      setTimeout(() => setQuizFeedback(null), 1400);
      return;
    }
    const cap = isCaptureMove(m);
    eng.make(m);
    try { cap ? audio.sfxCapture() : audio.sfxMove(); } catch { /* audio unavailable */ }
    setLastMove({ from: mFrom(m), to: mTo(m) });
    const newMoveList = [...moveListRef.current, attemptedSan];
    moveListRef.current = newMoveList;
    setMoveList(newMoveList);
    setSelected(-1); setTargets([]);
    setEvalCp(eng.evalWhite());
    const over = checkGameOver();
    if (newMoveList.length === quizOpening.moves.length) {
      const forColor = quizOpening.for === "black" ? -1 : 1;
      setQuizOpening(null);
      setQuizFeedback(null);
      setQuizDoneToast(over ? null : "Opening complete! Now try to beat the bot from here.");
      if (over) { setResult(over); setReviewIndex(eng.plyCount()); }
      else if (eng.getSide() !== forColor) engineMoveRef.current(newMoveList);
      setTimeout(() => setQuizDoneToast(null), 3000);
    }
    rerender();
  }, [eng, audio, quizOpening, checkGameOver]);

  const puzzlesInBand = (band) => band ? PUZZLES.filter(p => p.rating >= band.min && p.rating < band.max) : PUZZLES;

  const startPuzzle = (puzzle) => {
    eng.loadFen(puzzle.fen);
    moveListRef.current = [];
    setActivePuzzle(puzzle);
    setPuzzleSolved(false);
    setPuzzleFeedback(null);
    setActiveOpening(null);
    setQuizOpening(null);
    setPlayerColor(eng.getSide());
    setMode("play");
    setSelected(-1); setTargets([]); setLastMove(null); setHintMove(null);
    setMoveList([]); setInfo(null); setResult(null); setPromo(null);
    setEvalCp(eng.evalWhite()); setReviewIndex(null);
    rerender();
  };

  const nextPuzzle = () => {
    const pool = puzzlesInBand(puzzleBand);
    startPuzzle(pool[(Math.random() * pool.length) | 0]);
  };

  const exitPuzzle = () => newGame(1);

  const rushPool = () => puzzlesInBand(RATING_BANDS[rushBandIdxRef.current]);

  const startRush = (seconds) => {
    rushSolvedRef.current = 0;
    rushMistakesRef.current = 0;
    rushBandIdxRef.current = 0;
    rushStreakRef.current = 0;
    setRushSolved(0);
    setRushMistakes(0);
    setRushBandIdx(0);
    setRushResult(null);
    setRushDuration(seconds);
    setRushTimeLeft(seconds);
    setRushMode(true);
    setRushOpen(false);
    setPuzzlesOpen(false);
    const pool = puzzlesInBand(RATING_BANDS[0]);
    startPuzzle(pool[(Math.random() * pool.length) | 0]);
  };

  const nextRushPuzzle = () => {
    const pool = rushPool();
    startPuzzle(pool[(Math.random() * pool.length) | 0]);
  };

  const finishRush = (reason) => {
    setRushResult({ reason, solved: rushSolvedRef.current });
  };

  const retryRush = () => startRush(rushDuration);

  const exitRush = () => {
    setRushMode(false);
    setRushResult(null);
    exitPuzzle();
  };

  /* Puzzle Rush countdown -- ticks once a second while a rush is live and
     hasn't already ended from 3 mistakes, pausing entirely once rushResult
     is set so a mistake-triggered end and a time-triggered end can't race. */
  useEffect(() => {
    if (!rushMode || rushResult) return;
    if (rushTimeLeft <= 0) { finishRush("time"); return; }
    const t = setTimeout(() => setRushTimeLeft(s => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rushMode, rushResult, rushTimeLeft]);

  const puzzleMove = useCallback((m) => {
    const idx = moveListRef.current.length;
    const expectedSan = activePuzzle.moves[idx];
    const attemptedSan = eng.sanOf(m);
    if (attemptedSan !== expectedSan) {
      try { audio.sfxWrong(); } catch { /* audio unavailable */ }
      setSelected(-1); setTargets([]);
      if (rushMode) {
        rushMistakesRef.current += 1;
        setRushMistakes(rushMistakesRef.current);
        rushStreakRef.current = 0;
        rushBandIdxRef.current = Math.max(0, rushBandIdxRef.current - 1);
        setRushBandIdx(rushBandIdxRef.current);
        if (rushMistakesRef.current >= 3) {
          setPuzzleFeedback("Wrong — that's 3 misses!");
          setTimeout(() => finishRush("mistakes"), 400);
        } else {
          setPuzzleFeedback("Not quite — next puzzle!");
          setTimeout(() => nextRushPuzzle(), 700);
        }
        return;
      }
      setPuzzleFeedback("Not quite — try again!");
      setTimeout(() => setPuzzleFeedback(null), 1400);
      return;
    }
    const cap = isCaptureMove(m);
    eng.make(m);
    try { cap ? audio.sfxCapture() : audio.sfxMove(); } catch { /* audio unavailable */ }
    setLastMove({ from: mFrom(m), to: mTo(m) });
    const newMoveList = [...moveListRef.current, attemptedSan];
    moveListRef.current = newMoveList;
    setMoveList(newMoveList);
    setSelected(-1); setTargets([]);
    setEvalCp(eng.evalWhite());
    setPuzzleFeedback(null);

    if (newMoveList.length === activePuzzle.moves.length) {
      setPuzzleSolved(true);
      try { audio.sfxCapture(); } catch { /* audio unavailable */ }
      if (rushMode) {
        rushSolvedRef.current += 1;
        setRushSolved(rushSolvedRef.current);
        rushStreakRef.current += 1;
        if (rushStreakRef.current >= RUSH_STEP_UP_EVERY && rushBandIdxRef.current < RATING_BANDS.length - 1) {
          rushBandIdxRef.current += 1;
          rushStreakRef.current = 0;
          setRushBandIdx(rushBandIdxRef.current);
        }
        setTimeout(() => nextRushPuzzle(), 500);
      }
      rerender();
      return;
    }
    const replySan = activePuzzle.moves[newMoveList.length];
    setTimeout(() => {
      const legal = eng.legalMoves();
      const replyMove = legal.find(mv => eng.sanOf(mv) === replySan);
      if (replyMove) {
        const replyCap = isCaptureMove(replyMove);
        eng.make(replyMove);
        try { replyCap ? audio.sfxCapture() : audio.sfxMove(); } catch { /* audio unavailable */ }
        setLastMove({ from: mFrom(replyMove), to: mTo(replyMove) });
        const afterReply = [...moveListRef.current, replySan];
        moveListRef.current = afterReply;
        setMoveList(afterReply);
        rerender();
      }
    }, 500);
    rerender();
  }, [eng, audio, activePuzzle, rushMode]);

  const undo = () => {
    if (mode === "replay" || thinking || result || eng.plyCount() === 0) return;
    let n;
    if (quizOpening) n = 1; // quiz: the player supplies every ply, so always step back exactly one
    else if (eng.getSide() === playerColor && eng.plyCount() >= 2) n = 2; else n = 1;
    for (let i = 0; i < n; i++) eng.unmake();
    const newMoveList = moveListRef.current.slice(0, moveListRef.current.length - n);
    moveListRef.current = newMoveList;
    setMoveList(newMoveList);
    setSelected(-1); setTargets([]); setLastMove(null); setResult(null); setPromo(null); setHintMove(null); setReviewIndex(null); setQuizFeedback(null);
    setEvalCp(eng.evalWhite());
    rerender();
    if (!quizOpening && eng.getSide() !== playerColor) setTimeout(() => engineMoveRef.current(newMoveList), 60);
  };

  const onHint = () => {
    if (mode === "replay" || thinking || hinting || result || promo || eng.getSide() !== playerColor) return;
    setHinting(true);
    runSearch(moveList, 800, 0, { personality: BALANCED, useBook: true }).then((res) => {
      if (res && res.move) setHintMove({ from: mFrom(res.move), to: mTo(res.move) });
      setHinting(false);
    });
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
  const botAdvantage = (botColor === 1 ? evalCp : -evalCp) / 100;
  const botMood = botAdvantage < -1 ? "angry" : botAdvantage >= 1 ? "happy" : "neutral";
  const botTaken = botColor === 1 ? mat.capturedBlack : mat.capturedWhite;
  const youTaken = playerColor === 1 ? mat.capturedBlack : mat.capturedWhite;
  const youDiff = playerColor === 1 ? mat.diff : -mat.diff;

  const lastMoverColor = lastMove ? Math.sign(eng.pieceAt(M120TO64[lastMove.to])) : 0;
  const isBotLastMove = !analyzing && lastMove && lastMoverColor === botColor;
  const isPlayerLastMove = !analyzing && lastMove && lastMoverColor === playerColor;

  const flipped = playerColor === -1;
  /* The 64-cell board is the most expensive thing this component renders,
     and eng is a mutable object (its reference never changes even when the
     position does) — so this list must cover everything that actually
     drives eng's position or the cells' own display, or a move could apply
     without the board visually updating. Rebuilding it only when one of
     these actually changes means unrelated state (volume, toasts, track
     name, quiz feedback text, ...) no longer forces React to re-diff all
     64 squares on every render. */
  const rows = useMemo(() => {
    const built = [];
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
        const isBotLast = isBotLastMove && isLast;
        const isPlayerLast = isPlayerLastMove && isLast;
        const isHintFrom = hintMove && hintMove.from === sq120;
        const isHintTo = hintMove && hintMove.to === sq120;
        const kingInCheck = p * eng.getSide() === WK && eng.inCheckNow();
        const squareName = FILES[f] + (r + 1);
        const pieceLabel = p !== EMPTY ? `${p > 0 ? "White" : "Black"} ${PIECE_NAME[Math.abs(p)]}` : "empty";
        const stateBits = [isSel && "selected", isTarget && "legal move", kingInCheck && "in check"].filter(Boolean);
        const ariaLabel = `${squareName}, ${pieceLabel}` + (stateBits.length ? `, ${stateBits.join(", ")}` : "");
        cells.push(
          <div key={i64} role="gridcell" tabIndex={0} aria-label={ariaLabel}
            onClick={() => onSquareRef.current(i64)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSquareRef.current(i64); } }}
            className={"sq " + (light ? "light" : "dark") + (isSel ? " sel" : "") + (isLast ? " last" : "") +
              (isBotLast ? " botLast" : "") + (isPlayerLast ? " playerLast" : "") +
              (kingInCheck ? " chk" : "") + (isHintFrom ? " hintFrom" : "") + (isHintTo ? " hintTo" : "")}>
            {p !== EMPTY && <img className={"pc " + (p > 0 ? "w" : "b")} src={pieceImgSrc(Math.abs(p), p > 0)} alt="" draggable="false" />}
            {isTarget && <span className={"dot" + (p !== EMPTY ? " ring" : "")} />}
            {vf === 0 && <span className="coord rk">{r + 1}</span>}
            {vr === 7 && <span className="coord fl">{FILES[f]}</span>}
          </div>
        );
      }
      built.push(<div key={vr} role="row" className="brow">{cells}</div>);
    }
    return built;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eng, flipped, selected, targets, lastMove, hintMove, isBotLastMove, isPlayerLastMove,
      moveList, reviewIndex, replayIndex, replayFull, analysisExtra, mode]);

  const pairs = [];
  for (let i = 0; i < moveList.length; i += 2) pairs.push([moveList[i], moveList[i + 1]]);
  const shownPly = reviewing ? reviewIndex : moveList.length;
  const curMoveIdx = shownPly - 1;

  const inChk = eng.inCheckNow() && !result;
  const replayLabel = activeOpening ? activeOpening.name : "Shared game";
  const status = mode === "replay"
    ? (replayIndex === 0 ? `${replayLabel} — starting position` : replayIndex === replayFull.length ? `${replayLabel} — final position` : `${replayLabel} — move ${replayIndex}`)
    : quizOpening
    ? `Quiz: ${quizOpening.name} — move ${moveList.length + 1} of ${quizOpening.moves.length}`
    : result
    ? `${result.reason} · ${result.text}`
    : thinking ? "Zlegend2700 is calculating…"
    : eng.getSide() === playerColor ? "Your move, challenger" : "Bot to move";

  const arrowPoint = (sq120) => {
    const f = fileOf(sq120), r = rankOf(sq120);
    const visCol = flipped ? 7 - f : f;
    const visRow = flipped ? r : 7 - r;
    return { x: visCol + 0.5, y: visRow + 0.5 };
  };
  const arrowLine = (() => {
    if (!bestArrow || bestArrow.from === bestArrow.to) return null;
    const a = arrowPoint(bestArrow.from), b = arrowPoint(bestArrow.to);
    const dx = b.x - a.x, dy = b.y - a.y;
    let bend = null;
    if (Math.abs(dx) === 2 && Math.abs(dy) === 1) bend = { x: a.x + dx, y: a.y };
    else if (Math.abs(dy) === 2 && Math.abs(dx) === 1) bend = { x: a.x, y: a.y + dy };
    return { a, b, bend };
  })();

  const Tray = ({ pieces, colorClass }) => (
    <div className="tray">
      {pieces.length === 0
        ? <span className="trayEmpty">no captures yet</span>
        : pieces.map((t, i) => <img key={i} className={"trayPc " + colorClass} src={pieceImgSrc(t, colorClass === "wpc")} alt="" draggable="false" />)}
    </div>
  );

  return (
    <div className="root">
      <StarField />
      <div className="hdr">
        <div className="eyebrow"><span className="live" />{"Zlegend27"}<SocialLinks /></div>
        <h1>Zlegend's Chess Bot</h1>
        <div className="sub">can you beat it??</div>
      </div>

      <div className="layout">
        <div className="boardCol">
          <div className={"card botCard" + (mode === "play" && !result && !thinking && eng.getSide() === botColor ? " turnGlow" : "")}>
            <div className={"avatarBox" + (botMood !== "neutral" ? " reactionBox " + botMood : "")}>
              {botMood === "angry" && <img src="/bot-angry.webp" alt="Zlegend2700 is furious" className="reactionImg" />}
              {botMood === "happy" && <img src="/bot-happy.webp" alt="Zlegend2700 is thrilled" className="reactionImg" />}
              {botMood === "neutral" && <PixelAvatar rows={ZPIX} pal={ZPAL} size={44} />}
            </div>
            <div className="cardMeta">
              <div className="cardName bot">Zlegend2700</div>
              {activePuzzle ? (
                <div className="trayEmpty puzzleMeta">
                  {rushMode ? `Puzzle Rush · ${RATING_BANDS[rushBandIdx].label} · ${formatClock(rushTimeLeft)} left` : `Puzzle · rated ${activePuzzle.rating}`}
                </div>
              ) : (
                <>
                  <div className="trayEmpty">{gameStyle.label} today</div>
                  <Tray pieces={botTaken} colorClass={playerColor === 1 ? "wpc" : "bpc"} />
                </>
              )}
            </div>
            {youDiff < 0 && <div className="lead">+{-youDiff}</div>}
          </div>

          <div className="boardWrap">
            <div className="evalbar" title={"Eval " + evalLabel}>
              <div className="pfill" style={{ height: playerShare + "%" }} />
              <div className="tick" />
            </div>
            <div style={{ position: "relative", flex: 1 }}>
              <div className="board" role="grid" aria-label="Chess board">
                {rows}
                {arrowLine && (
                  <svg className="arrowLayer" viewBox="0 0 8 8" preserveAspectRatio="none">
                    <defs>
                      <marker id="bestArrowHead" markerWidth="3.2" markerHeight="3.2" refX="1.5" refY="1.6" orient="auto">
                        <path d="M0,0 L3.2,1.6 L0,3.2 Z" fill="#F5D93E" />
                      </marker>
                    </defs>
                    {arrowLine.bend ? (
                      <>
                        <line x1={arrowLine.a.x} y1={arrowLine.a.y} x2={arrowLine.bend.x} y2={arrowLine.bend.y}
                          stroke="#F5D93E" strokeOpacity="0.85" strokeWidth="0.14" strokeLinecap="round" />
                        <line x1={arrowLine.bend.x} y1={arrowLine.bend.y} x2={arrowLine.b.x} y2={arrowLine.b.y}
                          stroke="#F5D93E" strokeOpacity="0.85" strokeWidth="0.14" strokeLinecap="round" markerEnd="url(#bestArrowHead)" />
                      </>
                    ) : (
                      <line x1={arrowLine.a.x} y1={arrowLine.a.y} x2={arrowLine.b.x} y2={arrowLine.b.y}
                        stroke="#F5D93E" strokeOpacity="0.85" strokeWidth="0.14" strokeLinecap="round" markerEnd="url(#bestArrowHead)" />
                    )}
                  </svg>
                )}
                {promo && (
                  <div className="promoOv">
                    <div className="promoBox">
                      {[WQ, WR, WB, WN].map(pp => (
                        <button key={pp} onClick={() => {
                          const m = promo.moves.find(x => mPromo(x) === pp);
                          setPromo(null);
                          if (m) (activePuzzle ? puzzleMove(m) : quizOpening ? quizMove(m) : analyzing ? analysisMove(m) : playMove(m));
                        }}>
                          <img className={"pc " + (eng.getSide() === 1 ? "w" : "b")} style={{ width: 44, height: 44 }} src={pieceImgSrc(pp, eng.getSide() === 1)} alt="" draggable="false" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {colorPick && (
                  <div className="promoOv">
                    <div className="promoBox">
                      <button onClick={() => { setColorPick(false); newGame(1); }} title="Play as White">
                        <img className="pc w" style={{ width: 44, height: 44 }} src={pieceImgSrc(1, true)} alt="" draggable="false" />
                      </button>
                      <button onClick={() => { setColorPick(false); newGame(-1); }} title="Play as Black">
                        <img className="pc b" style={{ width: 44, height: 44 }} src={pieceImgSrc(1, false)} alt="" draggable="false" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className={"card youCard" + (mode === "play" && !result && !thinking && eng.getSide() === playerColor ? " turnGlow" : "")}>
            <div className="avatarBox"><img src="/you-avatar.webp" alt="You (Challenger)" className="youAvatarImg" /></div>
            <div className="cardMeta">
              <div className="cardName you">You (Challenger)</div>
              {activePuzzle ? (
                <div className="trayEmpty puzzleMeta">
                  {rushMode
                    ? (puzzleFeedback || `Solved ${rushSolved} · Misses ${rushMistakes}/3`)
                    : (puzzleSolved ? "Solved! Nice work." : puzzleFeedback || `Find the best move for ${eng.getSide() === 1 ? "White" : "Black"}.`)}
                </div>
              ) : (
                <Tray pieces={youTaken} colorClass={playerColor === 1 ? "bpc" : "wpc"} />
              )}
            </div>
            {youDiff > 0 && <div className="lead">+{youDiff}</div>}
          </div>

          <div className="statusRow">
            <span className={"status" + (result ? " over" : "")}>{status}</span>
            {inChk && <span className="bang">!!</span>}
            {mode === "replay" && <span className="replayBadge">{activeOpening ? "Opening" : "Replay"}</span>}
            {reviewing && <span className="replayBadge">Move {reviewIndex}/{moveList.length}</span>}
          </div>

          {mode === "replay" && (
            <div className="ctrls replayCtrls" style={{ justifyContent: "center" }}>
              <button className="btn ghost" onClick={() => setReplayIndex(0)} disabled={replayIndex === 0}>{"|◀"}</button>
              <button className="btn ghost" onClick={() => replayStep(-1)} disabled={replayIndex === 0}>{"◀"}</button>
              <button className="btn" onClick={toggleReplayPlay} disabled={replayIndex >= replayFull.length && !replayPlaying}>
                {replayPlaying ? "Pause" : "Play"}
              </button>
              <button className="btn ghost" onClick={() => replayStep(1)} disabled={replayIndex >= replayFull.length}>{"▶"}</button>
              <button className="btn ghost" onClick={() => setReplayIndex(replayFull.length)} disabled={replayIndex >= replayFull.length}>{"▶|"}</button>
              <button className={"btn" + (analyzing ? "" : " ghost")} onClick={toggleAnalyze}>
                {analyzing ? (analysisBusy ? "Analyzing…" : "Analyzing") : "Analyze"}
              </button>
              {activeOpening && <button className="btn gold" onClick={() => startQuiz(activeOpening)}>Try the Opening</button>}
              <button className="btn gold" onClick={exitReplay}>Start your own game</button>
            </div>
          )}

          {reviewing && (
            <div className="ctrls reviewCtrls" style={{ justifyContent: "center" }}>
              <button className="btn ghost" onClick={() => setReviewIndex(0)} disabled={reviewIndex === 0}>{"|◀"}</button>
              <button className="btn ghost" onClick={() => setReviewIndex(i => Math.max(0, i - 1))} disabled={reviewIndex === 0}>{"◀"}</button>
              <button className="btn ghost" onClick={() => setReviewIndex(i => Math.min(moveList.length, i + 1))} disabled={reviewIndex === moveList.length}>{"▶"}</button>
              <button className="btn ghost" onClick={() => setReviewIndex(moveList.length)} disabled={reviewIndex === moveList.length}>{"▶|"}</button>
              <button className={"btn" + (analyzing ? "" : " ghost")} onClick={toggleAnalyze}>
                {analyzing ? (analysisBusy ? "Analyzing…" : "Analyzing") : "Analyze"}
              </button>
            </div>
          )}
          {analyzing && (
            <div className="status analyzeHint" style={{ fontSize: 11, opacity: 0.8 }}>
              Move any piece to explore — yellow arrow shows the bot's top pick
            </div>
          )}
        </div>

        <div className="panel">
          <div className="box scoreBox">
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
                  <span
                    className={curMoveIdx === i * 2 ? "cur" : ""}
                    style={reviewing ? { cursor: "pointer" } : undefined}
                    onClick={reviewing ? () => setReviewIndex(i * 2 + 1) : undefined}>{w}</span>
                  <span
                    className={curMoveIdx === i * 2 + 1 ? "cur" : ""}
                    style={reviewing && b ? { cursor: "pointer" } : undefined}
                    onClick={reviewing && b ? () => setReviewIndex(i * 2 + 2) : undefined}>{b || ""}</span>
                </div>
              ))}
            </div>
            {pgnToast && <div className="toast">{pgnToast}</div>}
          </div>

          <div className="box analysisBox">
            {activePuzzle ? (
              rushMode ? (
                <>
                  <div className="boxHead">Puzzle Rush · {RATING_BANDS[rushBandIdx].label} · {formatClock(rushTimeLeft)} left</div>
                  <div className="pv">
                    {puzzleFeedback || `Solved ${rushSolved} · Misses ${rushMistakes}/3 · find the best move for ${eng.getSide() === 1 ? "White" : "Black"}.`}
                  </div>
                </>
              ) : (
                <>
                  <div className="boxHead">Puzzle · rated {activePuzzle.rating}</div>
                  <div className="pv">
                    {puzzleSolved
                      ? "Solved! Nice work."
                      : puzzleFeedback || `Find the best move for ${eng.getSide() === 1 ? "White" : "Black"}.`}
                  </div>
                </>
              )
            ) : quizOpening ? (
              <>
                <div className="boxHead">Quiz: {quizOpening.name}</div>
                <div className="pv">
                  {quizFeedback || `Play ${eng.getSide() === 1 ? "White" : "Black"}'s move ${moveList.length + 1} of ${quizOpening.moves.length} from memory.`}
                </div>
              </>
            ) : activeOpening ? (
              <>
                <div className="boxHead">{activeOpening.name} · {activeOpening.eco}</div>
                <div className="pv">
                  {replayIndex === 0 ? activeOpening.summary : activeOpening.steps[replayIndex - 1]}
                </div>
              </>
            ) : (
              <>
                <div className="boxHead">Bot Analysis</div>
                {info ? (
                  info.book ? (
                    <div className="pv">Playing from the opening book.</div>
                  ) : (
                    <>
                      <div className="astats">
                        <div><b>{evalLabel}</b><span>eval</span></div>
                        <div><b>{info.depth}</b><span>depth</span></div>
                        <div><b>{(info.nodes / 1000).toFixed(0)}k</b><span>nodes</span></div>
                        <div><b>{(info.time / 1000).toFixed(1)}s</b><span>time</span></div>
                      </div>
                      {info.pv.length > 0 && <div className="pv">line: {info.pv.join(" ")}</div>}
                    </>
                  )
                ) : (
                  <div className="pv">After each of its moves, the bot posts its eval, search depth, node count, and the line it expects.</div>
                )}
              </>
            )}
          </div>

          {mode === "play" && !activePuzzle && (
            <div className="ctrls playCtrls">
              <button className="btn" onClick={() => { setPromo(null); setColorPick(true); }}>New</button>
              <button className="btn" onClick={undo} disabled={thinking || !!result || eng.plyCount() === 0}>Undo</button>
              <button className="btn ghost" onClick={onHint}
                disabled={thinking || hinting || !!result || !!promo || !!quizOpening || eng.getSide() !== playerColor}>
                {hinting ? "Thinking…" : "Best Move"}
              </button>
              <select value={difficultyIdx} onChange={e => onDifficultyChange(Number(e.target.value))}>
                {DIFFICULTIES.map((d, i) => <option key={i} value={i}>{"Level: " + d.label}</option>)}
              </select>
              {moveList.length > 0 && <button className="btn ghost" onClick={onShare}>Share</button>}
              {result && <button className="btn gold" onClick={() => newGame(playerColor)}>Rematch!</button>}
              {shareToast && <div className="toast">{shareToast}</div>}
              {quizDoneToast && <div className="toast">{quizDoneToast}</div>}
            </div>
          )}

          {activePuzzle && !rushMode && (
            <div className="ctrls puzzleCtrls">
              <button className="btn ghost" onClick={() => startPuzzle(activePuzzle)}>Retry</button>
              <button className="btn gold" onClick={nextPuzzle}>Next Puzzle</button>
              <button className="btn ghost" onClick={exitPuzzle}>Exit</button>
            </div>
          )}

          {activePuzzle && rushMode && !rushResult && (
            <div className="ctrls puzzleCtrls">
              <button className="btn ghost" onClick={exitRush}>End Rush</button>
            </div>
          )}

          <div className="ctrls iconRow">
            <button className="btn ghost" style={{ display: "flex", alignItems: "center", gap: 6 }} onClick={() => setMusicOpen(true)} title="Juice Box">
              <PixelAvatar rows={JPIX} pal={JPAL} size={16} />
              Juice Box
            </button>
            <button className="btn ghost" style={{ display: "flex", alignItems: "center", gap: 6 }} onClick={() => setOpeningsOpen(true)}>
              <PixelAvatar rows={BPIX} pal={BPAL} size={16} />
              Openings
            </button>
            <button className="btn ghost" style={{ display: "flex", alignItems: "center", gap: 6 }} onClick={() => setPuzzlesOpen(true)}>
              <PixelAvatar rows={PPIX} pal={PPAL} size={16} />
              Puzzles
            </button>
          </div>
        </div>
      </div>

      {musicOpen && (
        <div className="promoOv" style={{ position: "fixed", inset: 0, zIndex: 50 }}>
          <div className="promoBox" style={{ flexDirection: "column", gap: 12, minWidth: 220, padding: "20px 24px" }}>
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
            <button className="btn gold" onClick={() => setMusicOpen(false)}>Close</button>
          </div>
        </div>
      )}


      {openingsOpen && (
        <div className="promoOv" style={{ position: "fixed", inset: 0, zIndex: 50 }}>
          <div className="promoBox" style={{ flexDirection: "column", gap: 12, minWidth: 260, maxWidth: 360, maxHeight: "80vh", overflowY: "auto", padding: "20px 24px" }}>
            <div className="boxHead" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <PixelAvatar rows={BPIX} pal={BPAL} size={18} />
              Openings Library
            </div>
            <div className="rows" style={{ maxHeight: "none" }}>
              {OPENINGS.map(op => (
                <div key={op.id} style={{ cursor: "pointer", padding: "6px 2px", borderBottom: "1px solid #8B2FC92E" }}
                  onClick={() => startOpening(op)}>
                  <div style={{ fontWeight: 700 }}>{op.name} <span style={{ opacity: 0.6, fontWeight: "normal" }}>({op.eco})</span></div>
                  <div style={{ fontSize: 11, opacity: 0.75 }}>{op.summary}</div>
                </div>
              ))}
            </div>
            <button className="btn gold" onClick={() => setOpeningsOpen(false)}>Close</button>
          </div>
        </div>
      )}

      {puzzlesOpen && (
        <div className="promoOv" style={{ position: "fixed", inset: 0, zIndex: 50 }}>
          <div className="promoBox" style={{ flexDirection: "column", gap: 12, minWidth: 260, maxWidth: 360, padding: "20px 24px" }}>
            <div className="boxHead" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <PixelAvatar rows={PPIX} pal={PPAL} size={18} />
              Puzzles — Pick a Rating
            </div>
            <div className="rows" style={{ maxHeight: "none" }}>
              {RATING_BANDS.map(band => {
                const pool = puzzlesInBand(band);
                return (
                  <div key={band.id} style={{ cursor: pool.length ? "pointer" : "default", padding: "8px 2px", borderBottom: "1px solid #8B2FC92E", opacity: pool.length ? 1 : 0.4 }}
                    onClick={() => {
                      if (!pool.length) return;
                      setPuzzleBand(band);
                      setPuzzlesOpen(false);
                      startPuzzle(pool[(Math.random() * pool.length) | 0]);
                    }}>
                    <div style={{ fontWeight: 700 }}>{band.label} <span style={{ opacity: 0.6, fontWeight: "normal" }}>({band.min}–{band.max === 9999 ? "2000+" : band.max})</span></div>
                    <div style={{ fontSize: 11, opacity: 0.75 }}>{pool.length} puzzle{pool.length === 1 ? "" : "s"}</div>
                  </div>
                );
              })}
            </div>
            <button className="btn gold" onClick={() => { setPuzzlesOpen(false); setRushOpen(true); }}>⚡ Puzzle Rush</button>
            <button className="btn ghost" onClick={() => setPuzzlesOpen(false)}>Close</button>
          </div>
        </div>
      )}

      {rushOpen && (
        <div className="promoOv" style={{ position: "fixed", inset: 0, zIndex: 50 }}>
          <div className="promoBox" style={{ flexDirection: "column", gap: 12, minWidth: 260, maxWidth: 360, padding: "20px 24px" }}>
            <div className="boxHead" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <PixelAvatar rows={PPIX} pal={PPAL} size={18} />
              Puzzle Rush
            </div>
            <div className="pv" style={{ fontSize: 12, opacity: 0.85 }}>
              Solve as many puzzles as you can before time runs out. Three wrong answers ends the rush early.
            </div>
            <div className="rows" style={{ maxHeight: "none" }}>
              {RUSH_DURATIONS.map(d => (
                <div key={d.seconds} style={{ cursor: "pointer", padding: "8px 2px", borderBottom: "1px solid #8B2FC92E" }}
                  onClick={() => startRush(d.seconds)}>
                  <div style={{ fontWeight: 700 }}>{d.label}</div>
                </div>
              ))}
            </div>
            <button className="btn ghost" onClick={() => { setRushOpen(false); setPuzzlesOpen(true); }}>Back</button>
          </div>
        </div>
      )}

      {rushMode && rushResult && (
        <div className="promoOv" style={{ position: "fixed", inset: 0, zIndex: 50 }}>
          <div className="promoBox" style={{ flexDirection: "column", gap: 12, minWidth: 260, maxWidth: 360, padding: "20px 24px" }}>
            <div className="boxHead" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <PixelAvatar rows={PPIX} pal={PPAL} size={18} />
              {rushResult.reason === "time" ? "Time's up!" : "3 misses — rush over!"}
            </div>
            <div className="pv" style={{ fontSize: 15 }}>
              You solved <b>{rushResult.solved}</b> puzzle{rushResult.solved === 1 ? "" : "s"}.
            </div>
            <button className="btn gold" onClick={retryRush}>Try Again</button>
            <button className="btn ghost" onClick={exitRush}>Exit</button>
          </div>
        </div>
      )}
    </div>
  );
}
