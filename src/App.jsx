import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  createEngine, EMPTY, WN, WB, WR, WQ, WK, M64TO120, M120TO64,
  mFrom, mTo, mPromo, mFlags, MATE, fileOf, rankOf,
} from "./engine/chessEngine";
import { createAudio } from "./audio/chiptune";
import { getSupabase } from "./utils/supabase";
import { MP3_PLAYLISTS, THEME_ID, loadPlaylistTracks } from "./utils/musicLibrary";
import PixelAvatar, { ZPAL, ZPIX, BPAL, BPIX, PPAL, PPIX } from "./components/PixelAvatar";
import SocialLinks from "./components/SocialLinks";
import StarField from "./components/StarField";
import { loadSetting, saveSetting } from "./utils/storage";
import { buildPgn, parsePgnMoves, replayForeignPgn } from "./utils/pgn";
import { encodeGame, decodeGame, getSharedHash, replayIntoEngine } from "./utils/share";
import { PIECE_SETS, getPieceSet } from "./utils/pieceSets";
import { BOARD_COLORS, getBoardColor } from "./utils/boardColors";
import { saveGame, estimateRating } from "./utils/gameHistory";
import { getDisplayName, setDisplayName } from "./utils/playerIdentity";
import { submitRushScore, fetchLeaderboard } from "./utils/leaderboard";
import { syncRankBotToSupabase, fetchRankBotFromSupabase, logRankBotMove } from "./utils/rankBot";
import { ENGINE_VERSION } from "./utils/version";
import { OPENINGS } from "./utils/openings";
import { loadEcoOpenings, detectEcoOpening } from "./utils/ecoOpenings";
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
  { label: "Rank Bot", id: "rank", adaptive: true, moveTimeMs: 900 },
  { label: "Casual", ms: 600, book: true },
  { label: "Master", ms: 12000, book: true },
];

/* Rank Bot: rather than one fixed Elo, the target Stockfish strength is a
   dial that moves after every move the player makes -- a blunder steps
   it down immediately, a clean run of moves steps it up, everything else
   holds steady, always by one bounded increment so it can't swing wildly
   in a single game (see adjustRankBotDial below). The first few games use
   a bigger step to converge faster (closer to chess.com/Lichess-style
   placement matches), then settle into finer adjustments for ongoing
   play. Below Stockfish's own 1320 floor, blunderChance stands in for
   "weaker than Stockfish can go" the same way the "1000 Elo" tier does. */
const RANK_BOT_MIN_ELO = 600;
const RANK_BOT_MAX_ELO = 2200;
const RANK_BOT_DEFAULT_ELO = 1000;
const RANK_BOT_CALIBRATION_GAMES = 3;
const RANK_BOT_STEP_CALIBRATION = 75;
const RANK_BOT_STEP_STEADY = 25;
const RANK_BOT_PROBE_MS = 250;
/* The live dial above drives actual in-game difficulty and never stops
   moving -- but that's a bad number to show the player directly (it can
   swing mid-game). Every RANK_BOT_ASSESSMENT_EVERY completed games, this
   averages that batch's ending dial values into one displayed Elo,
   smoothing out one unusually easy/hard game rather than trusting
   whichever number the dial happened to land on last. */
const RANK_BOT_ASSESSMENT_EVERY = 3;
function rankBotBlunderChance(elo) {
  if (elo >= STOCKFISH_MIN_ELO) return 0;
  const deficit = STOCKFISH_MIN_ELO - elo;
  return Math.min(0.75, 0.3 + deficit / 1000);
}

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

const FILES = "abcdefgh";
const PIECE_NAME = { 1: "pawn", 2: "knight", 3: "bishop", 4: "rook", 5: "queen", 6: "king" };

/* Recognizes which curated opening (if any) the current game matches,
   by longest common SAN prefix -- once the game runs past a curated
   entry's own move list it keeps naming that opening (nothing deeper
   to compare against), same as how a live board usually keeps showing
   "last known opening" after leaving book. */
function detectOpening(moveList) {
  let best = null;
  for (const op of OPENINGS) {
    const len = Math.min(moveList.length, op.moves.length);
    if (len === 0) continue;
    let matches = true;
    for (let i = 0; i < len; i++) {
      if (moveList[i] !== op.moves[i]) { matches = false; break; }
    }
    if (matches && (!best || len > best.len)) best = { opening: op, len };
  }
  return best ? best.opening : null;
}
/* Deterministic "same puzzle for everyone today" -- purely a function of
   the UTC date and the puzzle pool, no server/schedule needed. */
function todayKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
}
function dailyPuzzle(allPuzzles) {
  if (!allPuzzles.length) return null;
  const dayNum = Math.floor(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()) / 86400000);
  return allPuzzles[dayNum % allPuzzles.length];
}
/* Shared by manual next/prev and the "ended" auto-advance -- shuffle picks
   any other track at random, otherwise steps sequentially with wraparound. */
function pickTrackIndex(current, len, delta, shuffle) {
  if (len <= 1) return 0;
  if (shuffle) {
    let next;
    do { next = Math.floor(Math.random() * len); } while (next === current);
    return next;
  }
  return ((current + delta) % len + len) % len;
}
const PTS = { 1: 1, 2: 3, 3: 3, 4: 5, 5: 9 };
const GRADE_TAG = { brilliant: "!!", best: "!", inaccuracy: "?!", mistake: "?", blunder: "??" };
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
  const [pieceSetId, setPieceSetId] = useState(() => loadSetting("pieceSet", "classic"));
  const [boardColorId, setBoardColorId] = useState(() => loadSetting("boardColor", "default"));
  const [hideEvalBar, setHideEvalBar] = useState(() => loadSetting("hideEvalBar", false));
  const [ecoData, setEcoData] = useState(null);
  useEffect(() => { loadEcoOpenings().then(setEcoData); }, []);
  const pieceImgSrc = (type, isWhite) => getPieceSet(pieceSetId).svgUrl(type, isWhite);
  const audioRef = useRef(null);
  if (!audioRef.current) audioRef.current = createAudio(loadSetting("trackIdx", 0), volume / 100);
  const audio = audioRef.current;

  /* MP3 side of the Juice Box -- streamed from Supabase Storage rather than
     synthesized, so it needs its own HTMLAudioElement instead of the
     chiptune player's oscillator graph. musicSource picks which engine is
     "live"; switching sources pauses whichever one was playing so they
     never overlap. */
  const mp3AudioRef = useRef(null);
  if (!mp3AudioRef.current) {
    mp3AudioRef.current = new Audio();
    mp3AudioRef.current.volume = volume / 100;
    /* "metadata" (not the "auto" default) so picking a playlist only costs
       a small header fetch for duration/seek-bar purposes -- the full
       multi-MB file doesn't start streaming until the player actually
       presses Play. Mobile connections were stalling for a long time
       before a song became audible because "auto" preload used to kick
       off a full download the instant a track was selected. */
    mp3AudioRef.current.preload = "metadata";
    /* Required for createMediaElementSource below to work at all -- must
       be set before any src is ever assigned. Supabase Storage serves
       permissive CORS on public objects, verified against the live
       bucket (non-zero, varying AnalyserNode data), so this doesn't
       silently break playback. */
    mp3AudioRef.current.crossOrigin = "anonymous";
  }
  const mp3Audio = mp3AudioRef.current;
  /* iOS Safari hard-ignores HTMLMediaElement.volume -- the only way to
     actually change an <audio> element's loudness there is to route it
     through a Web Audio GainNode instead, which iOS does respect. Created
     lazily (createMediaElementSource can only ever be called once per
     element) the first time mp3 playback actually starts, inside a user
     gesture so the AudioContext isn't blocked by autoplay policy. */
  const mp3GainRef = useRef(null);
  const volumeRef = useRef(volume);
  volumeRef.current = volume;
  const ensureMp3Gain = () => {
    if (mp3GainRef.current) return mp3GainRef.current;
    try {
      const C = window.AudioContext || window.webkitAudioContext;
      const ctx = new C();
      const source = ctx.createMediaElementSource(mp3Audio);
      const gainNode = ctx.createGain();
      gainNode.gain.value = volumeRef.current / 100;
      source.connect(gainNode).connect(ctx.destination);
      mp3GainRef.current = { ctx, gainNode };
    } catch {
      mp3GainRef.current = null;
    }
    return mp3GainRef.current;
  };
  const resumeMp3Gain = () => {
    const gain = ensureMp3Gain();
    if (gain && gain.ctx.state === "suspended") gain.ctx.resume();
  };
  const [musicSource, setMusicSourceState] = useState(() => loadSetting("musicSource", "chiptune"));
  const [mp3Tracks, setMp3Tracks] = useState([]);
  const [mp3Loading, setMp3Loading] = useState(false);
  const [mp3Idx, setMp3Idx] = useState(() => loadSetting("mp3Idx", 0));
  const [mp3Playing, setMp3Playing] = useState(false);
  const [mp3Duration, setMp3Duration] = useState(0);
  const [mp3CurrentTime, setMp3CurrentTime] = useState(0);
  const [mp3Buffering, setMp3Buffering] = useState(false);
  const [mp3Shuffle, setMp3Shuffle] = useState(() => loadSetting("mp3Shuffle", false));
  const mp3IdxRef = useRef(mp3Idx);
  mp3IdxRef.current = mp3Idx;
  const mp3TracksRef = useRef(mp3Tracks);
  mp3TracksRef.current = mp3Tracks;
  const mp3PlayingRef = useRef(mp3Playing);
  mp3PlayingRef.current = mp3Playing;
  const mp3ShuffleRef = useRef(mp3Shuffle);
  mp3ShuffleRef.current = mp3Shuffle;
  /* First-time visitors get the theme track playing softly the moment
     they first interact with the page (browsers block audio-with-sound
     autoplay before any user gesture, so we can't start it on load --
     the very first click/tap/keydown anywhere satisfies that gesture
     requirement while still feeling immediate). Only fires once, ever,
     and only if they haven't already picked a source themselves. */
  const themeAutoplayArmedRef = useRef(!loadSetting("visitedBefore", false) && loadSetting("musicSource", "chiptune") === "chiptune");

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
  const [moveGrades, setMoveGrades] = useState(null);
  const [grading, setGrading] = useState(false);
  const [gradeProgress, setGradeProgress] = useState(0);
  const [pastedGame, setPastedGame] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteError, setPasteError] = useState(null);
  const [bestArrow, setBestArrow] = useState(null);
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const [analysisExtra, setAnalysisExtra] = useState([]);
  const [posVersion, setPosVersion] = useState(0);
  const [shareToast, setShareToast] = useState(null);
  const [pgnToast, setPgnToast] = useState(null);
  const [musicOpen, setMusicOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [ratingInfo, setRatingInfo] = useState(null);
  /* Fetched eagerly (not just when Settings opens) now that the estimate
     also shows next to the "You" card on the main play screen. */
  useEffect(() => { estimateRating().then(setRatingInfo); }, []);
  const openSettings = () => {
    setSettingsOpen(true);
    if (!ratingInfo) estimateRating().then(setRatingInfo);
  };
  const [displayName, setDisplayNameState] = useState(() => getDisplayName());
  const displayNameRef = useRef(displayName);
  displayNameRef.current = displayName;
  const [nameEditOpen, setNameEditOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const saveDisplayName = () => {
    const saved = setDisplayName(nameDraft);
    setDisplayNameState(saved);
    setNameEditOpen(false);
  };
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [leaderboardDuration, setLeaderboardDuration] = useState(60);
  const [leaderboardRows, setLeaderboardRows] = useState(null);
  const loadLeaderboard = (duration) => {
    setLeaderboardDuration(duration);
    setLeaderboardRows(null);
    fetchLeaderboard(duration).then(setLeaderboardRows);
  };
  const [rankBotElo, setRankBotElo] = useState(() => loadSetting("rankBotElo", RANK_BOT_DEFAULT_ELO));
  const [rankBotGames, setRankBotGames] = useState(() => loadSetting("rankBotGames", 0));
  const rankBotEloRef = useRef(rankBotElo);
  rankBotEloRef.current = rankBotElo;
  const rankBotGamesRef = useRef(rankBotGames);
  rankBotGamesRef.current = rankBotGames;
  /* The displayed, checkpointed Elo (see RANK_BOT_ASSESSMENT_EVERY above)
     -- null until the player's first batch of games completes. Recent
     game-ending dial values accumulate in rankBotRecentGameElosRef until
     there are enough for a new checkpoint, then reset. */
  const [rankBotAssessedElo, setRankBotAssessedElo] = useState(() => loadSetting("rankBotAssessedElo", null));
  const rankBotRecentGameElosRef = useRef(loadSetting("rankBotRecentGameElos", []));
  /* Last few of the player's own move-quality scores this game -- reset
     each new game, not persisted, purely to smooth out the live dial
     adjustment so one weird move doesn't overreact. */
  const rankBotWindowRef = useRef([]);
  /* Client-generated id linking one Rank Bot game's rank_bot_moves rows
     back to its single games-table row (that insert is fire-and-forget
     and doesn't return its own id) -- lazily created on this game's first
     tracked move, cleared once the game ends so the next game gets a
     fresh one. */
  const rankBotGameUidRef = useRef(null);
  const ensureRankBotGameUid = () => {
    if (!rankBotGameUidRef.current) {
      rankBotGameUidRef.current = (typeof crypto !== "undefined" && crypto.randomUUID)
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
    return rankBotGameUidRef.current;
  };
  /* Recovers a returning player's rating on a fresh browser/device --
     only if localStorage has never seen a Rank Bot game here, so it
     can't clobber an in-progress session's own local state. */
  useEffect(() => {
    if (loadSetting("rankBotElo", null) != null) return;
    fetchRankBotFromSupabase().then(saved => {
      const elo = saved ? saved.rankElo : RANK_BOT_DEFAULT_ELO;
      const games = saved ? saved.rankGames : 0;
      setRankBotElo(elo);
      setRankBotGames(games);
      saveSetting("rankBotElo", elo);
      saveSetting("rankBotGames", games);
    });
  }, []);
  const [pieceDesignsOpen, setPieceDesignsOpen] = useState(false);
  const [boardColorsOpen, setBoardColorsOpen] = useState(false);
  const [openingsOpen, setOpeningsOpen] = useState(false);
  const [activeOpening, setActiveOpening] = useState(null);
  const [quizOpening, setQuizOpening] = useState(null);
  const [quizFeedback, setQuizFeedback] = useState(null);
  const [quizDoneToast, setQuizDoneToast] = useState(null);
  const [puzzlesOpen, setPuzzlesOpen] = useState(false);
  const [puzzlesData, setPuzzlesData] = useState(null);
  const puzzlesLoadingRef = useRef(false);
  const pz = puzzlesData || { PUZZLES: [], RATING_BANDS: [] };
  const ensurePuzzlesLoaded = () => {
    if (puzzlesData || puzzlesLoadingRef.current) return;
    puzzlesLoadingRef.current = true;
    import("./utils/puzzles").then(m => setPuzzlesData({ PUZZLES: m.PUZZLES, RATING_BANDS: m.RATING_BANDS }));
  };
  const [puzzleBand, setPuzzleBand] = useState(null);
  const [activePuzzle, setActivePuzzle] = useState(null);
  const [puzzleFeedback, setPuzzleFeedback] = useState(null);
  const [puzzleSolved, setPuzzleSolved] = useState(false);
  const [dailySolvedDate, setDailySolvedDate] = useState(() => loadSetting("dailyPuzzleSolvedDate", null));
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
  const [spectateOpen, setSpectateOpen] = useState(false);
  const [spectateMode, setSpectateMode] = useState(false);
  const [spectatePaused, setSpectatePaused] = useState(false);
  const [spectateWhiteIdx, setSpectateWhiteIdx] = useState(2);
  const [spectateBlackIdx, setSpectateBlackIdx] = useState(2);
  const [spectateOpeningId, setSpectateOpeningId] = useState("");
  const spectateModeRef = useRef(false);
  const spectatePausedRef = useRef(false);
  const spectateWhiteRef = useRef(DIFFICULTIES[2]);
  const spectateBlackRef = useRef(DIFFICULTIES[2]);

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
  const reviewing = mode === "play" && (!!result || pastedGame) && reviewIndex !== null;
  /* Analyze is available both in post-game review and while browsing an
     opening/shared replay -- anywhere the board is showing a fixed,
     already-decided position rather than a live game the player is
     mid-move in. */
  const canAnalyze = reviewing || mode === "replay" || (spectateMode && spectatePaused);
  const reviewFirstRun = useRef(true);
  useEffect(() => {
    if (!reviewing) {
      reviewFirstRun.current = true;
      if (mode !== "replay" && !(spectateMode && spectatePaused)) { setAnalyzing(false); setBestArrow(null); setAnalysisExtra([]); }
      return;
    }
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
    setAnalyzing(a => {
      const next = !a;
      if (next && reviewing && !moveGrades && !grading) gradeMoves();
      return next;
    });
    setSelected(-1); setTargets([]); setBestArrow(null);
  };

  /* Move-quality grading: only needs N+1 searches for an N-ply game, not
     2N -- the position after move i is the same position as before move
     i+1, so each prefix's best-play score is computed once and reused
     for both the "before" side of one ply and the "after" side of the
     previous one. loss = bestScoreBefore - (-bestScoreAfter), i.e. how
     much worse the actual move was than the best move available, both
     converted to the mover's own perspective (negamax flip). Homemade
     engine only (fast + free) since this is a retrospective accuracy
     hint, not tournament-grade analysis -- Stockfish's official Elo
     limiting has no bearing on grading a move that already happened.
     "Best" and "brilliant" aren't as rigorous as chess.com/lichess's own
     classifiers (which use much deeper multi-line analysis) -- "best" is
     just "matched the engine's own top pick", and "brilliant" is a
     lightweight sacrifice heuristic (the move leaves the piece truly
     hanging -- attacked with no legal recapture -- yet the engine still
     rates it at essentially no lost value). Good enough to be a useful
     signal, not good enough to claim tournament-grade accuracy. */
  function classifyLoss(loss) {
    if (loss >= 150) return "blunder";
    if (loss >= 60) return "mistake";
    if (loss >= 20) return "inaccuracy";
    return null;
  }

  const gradeMoves = async () => {
    if (grading) return;
    const list = moveListRef.current;
    if (!list.length) return;
    setGrading(true);
    setGradeProgress(0);
    const scores = new Array(list.length + 1);
    const bestSans = new Array(list.length);
    for (let k = 0; k <= list.length; k++) {
      const res = await runSearch(list.slice(0, k), 250, 0, { personality: BALANCED, useBook: false });
      scores[k] = res ? res.score : 0;
      if (k < list.length && res) bestSans[k] = res.san;
      setGradeProgress(k + 1);
    }
    const tempEng = createEngine();
    const grades = [];
    for (let i = 0; i < list.length; i++) {
      const loss = Math.max(0, scores[i] + scores[i + 1]);
      let tag = classifyLoss(loss);
      const legal = tempEng.legalMoves();
      const move = legal.find(m => tempEng.sanOf(m) === list[i]);
      if (!move) { grades.push(null); continue; }
      tempEng.make(move); // advances for real -- this ply's move stays applied for the rest of the loop
      if (loss < 20) {
        const toSq120 = mTo(move);
        const attacker = tempEng.legalMoves().find(m => mTo(m) === toSq120);
        if (attacker) {
          tempEng.make(attacker); // probe only
          const recapture = tempEng.legalMoves().some(m => mTo(m) === toSq120);
          tempEng.unmake(); // undo the probe, not the real move
          if (!recapture) tag = "brilliant";
        }
        if (tag !== "brilliant" && bestSans[i] === list[i]) tag = "best";
      }
      grades.push(tag);
    }
    /* The search has no move to return at a finished game's final
       position (checkmate), so that last score defaults to a neutral 0
       rather than "this side is completely lost" -- without this fix,
       the very move that delivers checkmate could get wrongly flagged
       as a blunder purely from that missing data, when it's obviously
       the best possible move available. */
    if (result && result.reason === "Checkmate") grades[grades.length - 1] = null;
    setMoveGrades(grades);
    setGrading(false);
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

  /* Rank Bot has no fixed stockfishElo in DIFFICULTIES -- it's synthesized
     here from the live dial every time a move is needed, so engineMove
     doesn't need its own special case beyond this one substitution. */
  const effectiveDifficulty = (diff) => {
    if (!diff.adaptive) return diff;
    const elo = rankBotEloRef.current;
    return { ...diff, stockfishElo: Math.max(elo, STOCKFISH_MIN_ELO), blunderChance: rankBotBlunderChance(elo) };
  };

  /* Runs after each of the player's own moves (playMove only -- not
     puzzles/analysis/quiz), purely when Rank Bot is the opponent. Two
     quick background searches (before/after the move, same shape as the
     N+1-search trick gradeMoves uses for move-grading) estimate how much
     eval the player's actual move gave up; a rolling window of the last
     few smooths that into one dial step per move so a single lucky or
     unlucky move can't swing it. */
  const adjustRankBotDial = (prefixBefore, prefixAfter, gameOver) => {
    if (difficultyRef.current.id !== "rank" || gameOver) return;
    const gameUid = ensureRankBotGameUid();
    const ply = prefixAfter.length;
    Promise.all([
      runSearch(prefixBefore, RANK_BOT_PROBE_MS, 0, { useBook: false }),
      runSearch(prefixAfter, RANK_BOT_PROBE_MS, 0, { useBook: false }),
    ]).then(([before, after]) => {
      if (!before || !after) return;
      const loss = Math.max(0, before.score + after.score);
      const window = rankBotWindowRef.current;
      window.push(loss);
      if (window.length > 5) window.shift();
      const calibrating = rankBotGamesRef.current < RANK_BOT_CALIBRATION_GAMES;
      const step = calibrating ? RANK_BOT_STEP_CALIBRATION : RANK_BOT_STEP_STEADY;
      const eloBefore = rankBotEloRef.current;
      let next = eloBefore;
      if (loss >= 150) {
        next -= step;
      } else if (window.length >= 3) {
        const avg = window.reduce((a, b) => a + b, 0) / window.length;
        if (avg < 15) next += step;
        else if (avg >= 60) next -= step;
      }
      next = Math.max(RANK_BOT_MIN_ELO, Math.min(RANK_BOT_MAX_ELO, next));
      if (next !== eloBefore) {
        rankBotEloRef.current = next;
        setRankBotElo(next);
        saveSetting("rankBotElo", next);
      }
      logRankBotMove({ gameUid, ply, loss, eloBefore, eloAfter: next });
    });
  };

  const engineMove = useCallback((currentMoveList) => {
    setThinking(true);
    const diff = effectiveDifficulty(difficultyRef.current);
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
          const isRankBot = difficultyRef.current.id === "rank";
          saveGame({
            difficultyLabel: difficultyRef.current.label, playerColor: playerColorRef.current, moveList: newMoveList,
            result: over, finalEval: whiteScore, style: gameStyleRef.current.label, engineVersion: ENGINE_VERSION,
            gameUid: isRankBot ? rankBotGameUidRef.current : null, rankEloAtGame: isRankBot ? rankBotEloRef.current : null,
          });
          finishRankBotGame();
        }
      }
      setThinking(false);
      rerender();
    });
  }, [eng, audio, checkGameOver, runSearch, stockfishMove]);
  const engineMoveRef = useRef(engineMove);
  engineMoveRef.current = engineMove;

  /* Bot-vs-bot spectator mode: a dedicated mover (same shape as
     engineMove/playMove elsewhere in this file follow the one-function-
     per-mode convention) since BOTH sides are automated here rather than
     one bot answering a human click -- picks whichever tier is assigned
     to the side currently on move and keeps calling itself until the
     game ends or spectating is stopped. Games here aren't saved (no
     saveGame call) since neither side is the visitor playing. */
  const spectateMove = useCallback(() => {
    if (!spectateModeRef.current) return;
    setThinking(true);
    const diff = eng.getSide() === 1 ? spectateWhiteRef.current : spectateBlackRef.current;
    const personality = pickPersonality(gameStyleRef.current, eng.plyCount(), 0);
    const searchPromise = diff.stockfishElo
      ? stockfishMove(diff)
      : runSearch(moveListRef.current, diff.ms, diff.blunderChance || 0, { personality, useBook: diff.book });
    searchPromise.then((res) => {
      if (res && res.move && spectateModeRef.current) {
        const cap = isCaptureMove(res.move);
        eng.make(res.move);
        try { cap ? audio.sfxCapture() : audio.sfxMove(); } catch { /* audio unavailable */ }
        setLastMove({ from: mFrom(res.move), to: mTo(res.move) });
        const newMoveList = [...moveListRef.current, res.san];
        moveListRef.current = newMoveList;
        setMoveList(newMoveList);
        const whiteScore = eng.getSide() === 1 ? -res.score : res.score;
        setEvalCp(whiteScore);
        setInfo({ depth: res.depth, score: whiteScore, nodes: res.nodes, time: res.time, pv: res.pv, book: res.book });
        const over = checkGameOver();
        setResult(over);
        setThinking(false);
        rerender();
        if (!over) setTimeout(() => { if (!spectatePausedRef.current) spectateMoveRef.current(); }, 500);
      } else {
        setThinking(false);
        rerender();
      }
    });
  }, [eng, audio, checkGameOver, runSearch, stockfishMove]);
  const spectateMoveRef = useRef(spectateMove);
  spectateMoveRef.current = spectateMove;

  const startSpectate = (whiteIdx, blackIdx, openingId) => {
    setSpectateWhiteIdx(whiteIdx); setSpectateBlackIdx(blackIdx);
    spectateWhiteRef.current = DIFFICULTIES[whiteIdx];
    spectateBlackRef.current = DIFFICULTIES[blackIdx];
    eng.reset();
    const opening = openingId ? OPENINGS.find(op => op.id === openingId) : null;
    const { applied } = opening ? replayIntoEngine(eng, opening.moves) : { applied: [] };
    const startMoves = opening ? opening.moves.slice(0, applied.length) : [];
    moveListRef.current = startMoves;
    setGameStyle(randomStyle());
    setActiveOpening(null); setQuizOpening(null); setActivePuzzle(null);
    setSelected(-1); setTargets([]); setHintMove(null);
    setLastMove(applied.length ? { from: mFrom(applied[applied.length - 1]), to: mTo(applied[applied.length - 1]) } : null);
    setMoveList(startMoves); setInfo(null); setResult(null); setPromo(null); setEvalCp(eng.evalWhite()); setReviewIndex(null);
    setMoveGrades(null); setGrading(false); setGradeProgress(0);
    setPastedGame(false);
    setMode("play");
    setSpectateOpen(false);
    spectatePausedRef.current = false;
    setSpectatePaused(false);
    spectateModeRef.current = true;
    setSpectateMode(true);
    rerender();
    setTimeout(() => spectateMoveRef.current(), 60);
  };

  const stopSpectate = () => {
    spectateModeRef.current = false;
    spectatePausedRef.current = false;
    setSpectateMode(false);
    setSpectatePaused(false);
    newGame(1);
  };

  const pauseSpectate = () => {
    spectatePausedRef.current = true;
    setSpectatePaused(true);
  };

  /* Resuming discards any exploratory moves made while paused/analyzing
     (analysisMove only ever appends to analysisExtra, never to the real
     moveListRef) by resetting the shared engine back to the real game
     position before letting the bots continue. */
  const resumeSpectate = () => {
    spectatePausedRef.current = false;
    setSpectatePaused(false);
    setAnalyzing(false); setBestArrow(null); setAnalysisExtra([]);
    eng.reset();
    replayIntoEngine(eng, moveListRef.current);
    setPosVersion(v => v + 1);
    rerender();
    setTimeout(() => spectateMoveRef.current(), 60);
  };

  const finishRankBotGame = () => {
    if (difficultyRef.current.id !== "rank") return;
    const games = rankBotGamesRef.current + 1;
    rankBotGamesRef.current = games;
    setRankBotGames(games);
    saveSetting("rankBotGames", games);
    rankBotWindowRef.current = [];
    rankBotGameUidRef.current = null;

    const recent = [...rankBotRecentGameElosRef.current, rankBotEloRef.current];
    if (recent.length >= RANK_BOT_ASSESSMENT_EVERY) {
      const assessed = Math.round(recent.reduce((a, b) => a + b, 0) / recent.length);
      rankBotRecentGameElosRef.current = [];
      saveSetting("rankBotRecentGameElos", []);
      setRankBotAssessedElo(assessed);
      saveSetting("rankBotAssessedElo", assessed);
    } else {
      rankBotRecentGameElosRef.current = recent;
      saveSetting("rankBotRecentGameElos", recent);
    }

    syncRankBotToSupabase({ rankElo: rankBotEloRef.current, rankGames: games, displayName: displayNameRef.current });
  };

  const playMove = useCallback((m) => {
    const cap = isCaptureMove(m);
    const san = eng.sanOf(m);
    const prefixBefore = moveListRef.current;
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
    adjustRankBotDial(prefixBefore, newMoveList, !!over);
    if (over) {
      setReviewIndex(eng.plyCount());
      const isRankBot = difficultyRef.current.id === "rank";
      saveGame({
        difficultyLabel: difficultyRef.current.label, playerColor: playerColorRef.current, moveList: newMoveList,
        result: over, finalEval: eng.evalWhite(), style: gameStyleRef.current.label, engineVersion: ENGINE_VERSION,
        gameUid: isRankBot ? rankBotGameUidRef.current : null, rankEloAtGame: isRankBot ? rankBotEloRef.current : null,
      });
      finishRankBotGame();
    }
    rerender();
    if (!over) engineMoveRef.current(newMoveList);
  }, [eng, audio, checkGameOver]);

  /* Returns a status string ("moved"/"promo"/"selected"/"deselected"/
     "blocked") purely so drag handling (below) can tell, synchronously,
     whether a pointerdown just picked up a piece worth dragging --
     state updates here are otherwise identical to before this return
     value was added, so the existing onClick/onKeyDown callers that
     ignore it see no behavior change. */
  const onSquare = (i64) => {
    if ((spectateMode && !(spectatePaused && analyzing)) || (mode === "replay" && !analyzing) || thinking || promo) return "blocked";
    const inQuiz = !!quizOpening;
    const inPuzzle = !!activePuzzle;
    if (inPuzzle && puzzleSolved) return "blocked";
    const legal = eng.legalMoves();
    const sq120 = M64TO120[i64];
    const sideToMove = (analyzing || inQuiz) ? eng.getSide() : playerColor;
    if (!analyzing && !inQuiz && (result || eng.getSide() !== playerColor)) return "blocked";
    if (inQuiz && result) return "blocked";
    if (selected >= 0) {
      const from120 = M64TO120[selected];
      const candidates = legal.filter(m => mFrom(m) === from120 && mTo(m) === sq120);
      if (candidates.length > 0) {
        if (candidates.length > 1) { setPromo({ from: from120, to: sq120, moves: candidates }); return "promo"; }
        inPuzzle ? puzzleMove(candidates[0]) : inQuiz ? quizMove(candidates[0]) : (analyzing ? analysisMove(candidates[0]) : playMove(candidates[0]));
        return "moved";
      }
    }
    const p = eng.pieceAt(i64);
    if (p !== EMPTY && p * sideToMove > 0) {
      setSelected(i64);
      setTargets(legal.filter(m => mFrom(m) === sq120).map(m => M120TO64[mTo(m)]));
      return "selected";
    } else { setSelected(-1); setTargets([]); return "deselected"; }
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

  /* Drag-to-move: a thin pointer-events layer on top of the existing
     click-to-select/click-to-move state machine above, so it can't
     regress puzzle/analysis/quiz/promo handling -- pointerdown reuses
     onSquare's own "select" step (via its new return value, so we know
     synchronously whether a draggable piece actually got picked up),
     and dropping calls onSquare again on the square underneath the
     pointer, exactly as a second click would. Pointer Events (not
     separate mouse/touch listeners) is what makes one implementation
     cover both mouse-drag and finger-drag. */
  const boardRef = useRef(null);
  const [dragFrom, setDragFrom] = useState(-1);
  const [dragOverSquare, setDragOverSquare] = useState(-1);
  const [dragPos, setDragPos] = useState(null);
  const [dragCellSize, setDragCellSize] = useState(48);

  const squareFromPoint = (clientX, clientY) => {
    const el = boardRef.current;
    if (!el) return -1;
    const rect = el.getBoundingClientRect();
    const relX = clientX - rect.left, relY = clientY - rect.top;
    if (relX < 0 || relY < 0 || relX >= rect.width || relY >= rect.height) return -1;
    const visCol = Math.min(7, Math.floor((relX / rect.width) * 8));
    const visRow = Math.min(7, Math.floor((relY / rect.height) * 8));
    const f = flipped ? 7 - visCol : visCol;
    const r = flipped ? visRow : 7 - visRow;
    return r * 8 + f;
  };

  const onSquarePointerDown = (i64, e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const status = onSquareRef.current(i64);
    if (status !== "selected") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragCellSize(e.currentTarget.getBoundingClientRect().width);
    setDragFrom(i64);
    setDragOverSquare(i64);
    setDragPos({ x: e.clientX, y: e.clientY });
  };
  const onDragPointerMoveRef = useRef(null);
  onDragPointerMoveRef.current = (e) => {
    if (dragFrom < 0) return;
    setDragPos({ x: e.clientX, y: e.clientY });
    setDragOverSquare(squareFromPoint(e.clientX, e.clientY));
  };
  const onDragPointerUpRef = useRef(null);
  onDragPointerUpRef.current = (e) => {
    if (dragFrom < 0) return;
    const dropSquare = squareFromPoint(e.clientX, e.clientY);
    setDragFrom(-1); setDragOverSquare(-1); setDragPos(null);
    if (dropSquare >= 0) onSquareRef.current(dropSquare);
  };
  const onDragPointerCancelRef = useRef(null);
  onDragPointerCancelRef.current = () => {
    setDragFrom(-1); setDragOverSquare(-1); setDragPos(null);
  };

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
    setMoveGrades(null); setGrading(false); setGradeProgress(0);
    setPastedGame(false);
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

  const puzzlesInBand = (band) => band ? pz.PUZZLES.filter(p => p.rating >= band.min && p.rating < band.max) : pz.PUZZLES;

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

  const rushPool = () => puzzlesInBand(pz.RATING_BANDS[rushBandIdxRef.current]);

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
    const pool = puzzlesInBand(pz.RATING_BANDS[0]);
    startPuzzle(pool[(Math.random() * pool.length) | 0]);
  };

  const nextRushPuzzle = () => {
    const pool = rushPool();
    startPuzzle(pool[(Math.random() * pool.length) | 0]);
  };

  const finishRush = (reason) => {
    setRushResult({ reason, solved: rushSolvedRef.current });
    submitRushScore({ duration: rushDuration, solved: rushSolvedRef.current, displayName });
  };

  const retryRush = () => startRush(rushDuration);

  const exitRush = () => {
    setRushMode(false);
    setRushResult(null);
    exitPuzzle();
  };

  /* Escape closes whichever modal is open, mirroring each one's own
     backdrop-click behavior (e.g. Piece Designs -> back to Settings). */
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;
      if (pieceDesignsOpen) { setPieceDesignsOpen(false); setSettingsOpen(true); }
      else if (boardColorsOpen) { setBoardColorsOpen(false); setSettingsOpen(true); }
      else if (settingsOpen) setSettingsOpen(false);
      else if (rushMode && rushResult) exitRush();
      else if (rushOpen) { setRushOpen(false); setPuzzlesOpen(true); }
      else if (puzzlesOpen) setPuzzlesOpen(false);
      else if (openingsOpen) setOpeningsOpen(false);
      else if (musicOpen) setMusicOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pieceDesignsOpen, boardColorsOpen, settingsOpen, rushMode, rushResult, rushOpen, puzzlesOpen, openingsOpen, musicOpen]);

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
      const daily = dailyPuzzle(pz.PUZZLES);
      if (daily && activePuzzle.id === daily.id) {
        setDailySolvedDate(todayKey());
        saveSetting("dailyPuzzleSolvedDate", todayKey());
      }
      if (rushMode) {
        rushSolvedRef.current += 1;
        setRushSolved(rushSolvedRef.current);
        rushStreakRef.current += 1;
        if (rushStreakRef.current >= RUSH_STEP_UP_EVERY && rushBandIdxRef.current < pz.RATING_BANDS.length - 1) {
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
  }, [eng, audio, activePuzzle, rushMode, pz]);

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

  const loadMp3Playlist = (id) => {
    const playlist = MP3_PLAYLISTS.find(p => p.id === id);
    if (!playlist) return;
    setMp3Loading(true);
    setMp3Tracks([]);
    getSupabase().then(sb => loadPlaylistTracks(sb, playlist)).then(tracks => {
      setMp3Tracks(tracks);
      setMp3Loading(false);
    });
  };
  /* Only fetches the saved playlist's track list once the Juice Box is
     actually opened, not on every app mount -- otherwise, whenever
     someone's last-used source was an mp3 playlist, the app would import
     supabase-js and hit Storage before they'd even looked at the music
     player, slowing down the rest of the site (worst on mobile). Picking
     a playlist from the dropdown already loads it directly in
     setMusicSource below, so this only covers "reopened with a playlist
     already selected from last time". */
  useEffect(() => {
    if (!musicOpen || musicSource === "chiptune") return;
    if (mp3TracksRef.current.length || mp3Loading) return;
    loadMp3Playlist(musicSource);
  }, [musicOpen]);
  /* The theme is a single track meant to play indefinitely rather than
     stop dead after ~30s -- native loop restarts it itself and never
     fires "ended" at all, so the multi-track auto-advance below doesn't
     need a special case for playlists of length 1. */
  useEffect(() => { mp3Audio.loop = musicSource === THEME_ID; }, [musicSource]);
  /* Keeps the <audio> element's src in sync with the selected track,
     re-playing automatically if music was already playing -- covers both
     manual next/prev and the "ended" auto-advance below. */
  useEffect(() => {
    if (musicSource === "chiptune" || !mp3Tracks.length) return;
    const track = mp3Tracks[((mp3Idx % mp3Tracks.length) + mp3Tracks.length) % mp3Tracks.length];
    if (mp3Audio.src !== track.url) {
      mp3Audio.src = track.url;
      setMp3Duration(0);
      setMp3CurrentTime(0);
      if (mp3PlayingRef.current) { resumeMp3Gain(); mp3Audio.play().catch(() => {}); }
    }
  }, [musicSource, mp3Tracks, mp3Idx]);
  useEffect(() => {
    const onEnded = () => {
      setMp3Idx(i => {
        const tracks = mp3TracksRef.current;
        if (!tracks.length) return i;
        const next = pickTrackIndex(i, tracks.length, 1, mp3ShuffleRef.current);
        saveSetting("mp3Idx", next);
        return next;
      });
    };
    const onMeta = () => setMp3Duration(mp3Audio.duration || 0);
    const onTime = () => setMp3CurrentTime(mp3Audio.currentTime);
    const onWaiting = () => setMp3Buffering(true);
    const onReady = () => setMp3Buffering(false);
    mp3Audio.addEventListener("ended", onEnded);
    mp3Audio.addEventListener("loadedmetadata", onMeta);
    mp3Audio.addEventListener("timeupdate", onTime);
    mp3Audio.addEventListener("waiting", onWaiting);
    mp3Audio.addEventListener("playing", onReady);
    mp3Audio.addEventListener("canplay", onReady);
    return () => {
      mp3Audio.removeEventListener("ended", onEnded);
      mp3Audio.removeEventListener("loadedmetadata", onMeta);
      mp3Audio.removeEventListener("timeupdate", onTime);
      mp3Audio.removeEventListener("waiting", onWaiting);
      mp3Audio.removeEventListener("playing", onReady);
      mp3Audio.removeEventListener("canplay", onReady);
    };
  }, []);
  /* Cues the theme track (metadata + src only, not full playback) as soon
     as a genuine first-time visitor loads the page, so it's ready to go
     the instant they satisfy the browser's user-gesture requirement for
     audio-with-sound autoplay below -- without this, the first click would
     have to wait on a fresh Storage round trip before anything could play. */
  useEffect(() => {
    if (!themeAutoplayArmedRef.current) return;
    saveSetting("visitedBefore", true);
    setMusicSourceState(THEME_ID);
    saveSetting("musicSource", THEME_ID);
    loadMp3Playlist(THEME_ID);
  }, []);
  useEffect(() => {
    if (!themeAutoplayArmedRef.current) return;
    const start = () => {
      if (!themeAutoplayArmedRef.current) return;
      themeAutoplayArmedRef.current = false;
      onVolume(35);
      setMp3Playing(true);
      resumeMp3Gain();
      if (mp3Audio.src) mp3Audio.play().catch(() => {});
    };
    document.addEventListener("pointerdown", start, { once: true });
    document.addEventListener("keydown", start, { once: true });
    return () => {
      document.removeEventListener("pointerdown", start);
      document.removeEventListener("keydown", start);
    };
  }, []);
  const setMusicSource = (id) => {
    themeAutoplayArmedRef.current = false;
    if (id === musicSource) return;
    if (musicOn) { audio.toggle(); setMusicOn(false); }
    if (mp3PlayingRef.current) { mp3Audio.pause(); setMp3Playing(false); }
    setMusicSourceState(id);
    saveSetting("musicSource", id);
    if (id !== "chiptune") {
      setMp3Idx(0);
      saveSetting("mp3Idx", 0);
      loadMp3Playlist(id);
    }
  };
  const switchMp3Track = (delta) => {
    const tracks = mp3TracksRef.current;
    if (!tracks.length) return;
    setMp3Idx(i => {
      const next = pickTrackIndex(i, tracks.length, delta, mp3ShuffleRef.current);
      saveSetting("mp3Idx", next);
      return next;
    });
  };
  const toggleShuffle = () => {
    setMp3Shuffle(v => {
      const next = !v;
      saveSetting("mp3Shuffle", next);
      return next;
    });
  };
  const pickMp3Track = (idx) => {
    setMp3Idx(idx);
    saveSetting("mp3Idx", idx);
  };
  const toggleMusic = () => {
    if (musicSource === "chiptune") { setMusicOn(audio.toggle()); return; }
    if (!mp3TracksRef.current.length) return;
    if (mp3PlayingRef.current) { mp3Audio.pause(); setMp3Playing(false); }
    else { resumeMp3Gain(); mp3Audio.play().catch(() => {}); setMp3Playing(true); }
  };
  const nextTrack = () => {
    if (musicSource === "chiptune") { setTrackName(audio.next()); saveSetting("trackIdx", audio.trackIndex()); return; }
    switchMp3Track(1);
  };
  const prevTrack = () => {
    if (musicSource === "chiptune") { setTrackName(audio.prev()); saveSetting("trackIdx", audio.trackIndex()); return; }
    switchMp3Track(-1);
  };
  /* Once the Web Audio graph exists, control loudness exclusively through
     its GainNode -- that's what actually works on iOS Safari, which
     otherwise hard-ignores HTMLMediaElement.volume entirely. Falls back to
     the plain .volume property only before the graph exists (nothing is
     playing yet, so it's just keeping state consistent for whenever
     playback actually starts). */
  const onVolume = v => {
    setVolume(v);
    audio.setVolume(v / 100);
    if (mp3GainRef.current) mp3GainRef.current.gainNode.gain.value = v / 100;
    else mp3Audio.volume = v / 100;
    saveSetting("volume", v);
  };
  const seekMp3 = (t) => { mp3Audio.currentTime = t; setMp3CurrentTime(t); };
  const fmtTime = (s) => {
    if (!isFinite(s) || s < 0) s = 0;
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  };
  const isMp3Source = musicSource !== "chiptune";
  const mp3NowPlaying = isMp3Source && mp3Tracks.length ? mp3Tracks[((mp3Idx % mp3Tracks.length) + mp3Tracks.length) % mp3Tracks.length] : null;
  const jbTrackLabel = !isMp3Source ? trackName : mp3Loading ? "Loading…" : mp3NowPlaying ? mp3NowPlaying.name : "No tracks yet";
  const jbPlaying = isMp3Source ? mp3Playing : musicOn;
  const jbDisabled = isMp3Source && !mp3Tracks.length;
  const choosePieceSet = (id) => { setPieceSetId(id); saveSetting("pieceSet", id); };
  const chooseBoardColor = (id) => { setBoardColorId(id); saveSetting("boardColor", id); };
  const toggleEvalBar = () => { setHideEvalBar(v => { saveSetting("hideEvalBar", !v); return !v; }); };

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

  /* Loads a pasted PGN straight into review mode (reusing the exact same
     step-through/Analyze/Grade Moves machinery as a just-finished game,
     via the pastedGame flag folded into reviewing's own definition)
     rather than building a separate viewer for it. */
  const loadPastedPgn = () => {
    const tokens = parsePgnMoves(pasteText);
    if (!tokens.length) { setPasteError("Couldn't find any moves in that text."); return; }
    const tempEng = createEngine();
    const { applied, sans } = replayForeignPgn(tempEng, tokens);
    if (!applied.length) { setPasteError("Couldn't match those moves to a legal game."); return; }
    if (applied.length < tokens.length) { setPasteError(`Only matched ${applied.length} of ${tokens.length} moves — loaded as far as it could.`); }
    else setPasteError(null);
    eng.reset();
    replayIntoEngine(eng, sans);
    moveListRef.current = sans;
    setMoveList(sans);
    setActiveOpening(null); setQuizOpening(null); setActivePuzzle(null);
    setSpectateMode(false); spectateModeRef.current = false;
    setSelected(-1); setTargets([]); setPromo(null);
    const last = applied[applied.length - 1];
    setLastMove({ from: mFrom(last), to: mTo(last) });
    setEvalCp(eng.evalWhite());
    setMoveGrades(null); setGrading(false); setGradeProgress(0);
    setResult(checkGameOver());
    setPastedGame(true);
    setMode("play");
    setReviewIndex(sans.length);
    setPasteOpen(false);
    setPasteText("");
    setAnalyzing(true);
    gradeMoves();
    rerender();
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
  const liveOpening = (mode === "play" && !activePuzzle && !quizOpening)
    ? (ecoData ? detectEcoOpening(moveList, ecoData) : detectOpening(moveList))
    : null;

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
    const gradeHere = (reviewing && moveGrades && reviewIndex >= 1) ? moveGrades[reviewIndex - 1] : null;
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
        const isDragFrom = dragFrom === i64;
        const isDragOver = dragFrom >= 0 && dragOverSquare === i64 && dragOverSquare !== dragFrom;
        const squareName = FILES[f] + (r + 1);
        const pieceLabel = p !== EMPTY ? `${p > 0 ? "White" : "Black"} ${PIECE_NAME[Math.abs(p)]}` : "empty";
        const stateBits = [isSel && "selected", isTarget && "legal move", kingInCheck && "in check"].filter(Boolean);
        const ariaLabel = `${squareName}, ${pieceLabel}` + (stateBits.length ? `, ${stateBits.join(", ")}` : "");
        cells.push(
          <div key={i64} role="gridcell" tabIndex={0} aria-label={ariaLabel}
            onClick={() => onSquareRef.current(i64)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSquareRef.current(i64); } }}
            onPointerDown={(e) => onSquarePointerDown(i64, e)}
            onPointerMove={(e) => onDragPointerMoveRef.current(e)}
            onPointerUp={(e) => onDragPointerUpRef.current(e)}
            onPointerCancel={(e) => onDragPointerCancelRef.current(e)}
            className={"sq " + (light ? "light" : "dark") + (isSel ? " sel" : "") + (isLast ? " last" : "") +
              (isBotLast ? " botLast" : "") + (isPlayerLast ? " playerLast" : "") +
              (kingInCheck ? " chk" : "") + (isHintFrom ? " hintFrom" : "") + (isHintTo ? " hintTo" : "") +
              (isDragOver ? " dragOver" : "")}>
            {p !== EMPTY && !isDragFrom && <img className={"pc " + (p > 0 ? "w" : "b")} src={pieceImgSrc(Math.abs(p), p > 0)} alt="" draggable="false" />}
            {gradeHere && lastMove && lastMove.to === sq120 && <span className={"boardGrade " + gradeHere}>{GRADE_TAG[gradeHere]}</span>}
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
      moveList, reviewIndex, replayIndex, replayFull, analysisExtra, mode, pieceSetId, dragFrom, dragOverSquare,
      reviewing, moveGrades]);

  const pairs = [];
  for (let i = 0; i < moveList.length; i += 2) pairs.push([moveList[i], moveList[i + 1]]);
  const shownPly = reviewing ? reviewIndex : moveList.length;
  const curMoveIdx = shownPly - 1;

  const inChk = eng.inCheckNow() && !result;
  const replayLabel = activeOpening ? activeOpening.name : "Shared game";
  const status = spectateMode
    ? (result ? `${result.reason} · ${result.text}`
        : spectatePaused ? `Paused — ${DIFFICULTIES[spectateWhiteIdx].label} vs ${DIFFICULTIES[spectateBlackIdx].label}`
        : `${DIFFICULTIES[spectateWhiteIdx].label} vs ${DIFFICULTIES[spectateBlackIdx].label} — ${eng.getSide() === 1 ? "White" : "Black"} to move`)
    : mode === "replay"
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
    <div className={"root" + (hideEvalBar ? " noEval" : "")} style={{ "--boardLight": getBoardColor(boardColorId).light, "--boardDark": getBoardColor(boardColorId).dark }}>
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
              <div className="cardName bot">{spectateMode ? `${DIFFICULTIES[botColor === 1 ? spectateWhiteIdx : spectateBlackIdx].label} (${botColor === 1 ? "White" : "Black"})` : "Zlegend2700"}</div>
              {activePuzzle ? (
                <div className="trayEmpty puzzleMeta">
                  {rushMode ? `Puzzle Rush · ${pz.RATING_BANDS[rushBandIdx]?.label || ""} · ${formatClock(rushTimeLeft)} left` : `Puzzle · rated ${activePuzzle.rating}`}
                </div>
              ) : (
                <>
                  <div className="trayEmpty">{gameStyle.label} today</div>
                  {!spectateMode && difficultyRef.current.id === "rank" && (
                    <div className="trayEmpty openingTag">
                      ~{rankBotElo} Elo{rankBotAssessedElo == null ? " · Calibrating" : ""}
                    </div>
                  )}
                  {liveOpening && (
                    <div className="trayEmpty openingTag">{liveOpening.name} · {liveOpening.eco}</div>
                  )}
                  <Tray pieces={botTaken} colorClass={playerColor === 1 ? "wpc" : "bpc"} />
                </>
              )}
            </div>
            {youDiff < 0 && <div className="lead">+{-youDiff}</div>}
          </div>

          <div className="boardWrap">
            {!hideEvalBar && (
              <div className="evalbar" title={"Eval " + evalLabel}>
                <div className="pfill" style={{ height: playerShare + "%" }} />
                <div className="tick" />
              </div>
            )}
            <div style={{ position: "relative", flex: 1 }}>
              <div className="board" role="grid" aria-label="Chess board" ref={boardRef}>
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
              {dragFrom >= 0 && dragPos && (
                <img className={"pc dragGhost " + (eng.pieceAt(dragFrom) > 0 ? "w" : "b")}
                  src={pieceImgSrc(Math.abs(eng.pieceAt(dragFrom)), eng.pieceAt(dragFrom) > 0)}
                  alt="" draggable="false"
                  style={{ left: dragPos.x, top: dragPos.y, width: dragCellSize, height: dragCellSize }} />
              )}
            </div>
          </div>

          <div className={"card youCard" + (mode === "play" && !result && !thinking && eng.getSide() === playerColor ? " turnGlow" : "")}>
            <div className="avatarBox"><img src="/you-avatar.webp" alt="You (Challenger)" className="youAvatarImg" /></div>
            <div className="cardMeta">
              <div className="cardName you" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span>{spectateMode ? `${DIFFICULTIES[playerColor === 1 ? spectateWhiteIdx : spectateBlackIdx].label} (${playerColor === 1 ? "White" : "Black"})` : (displayName || "Challenger")}</span>
                {!spectateMode && (
                  <button className="nameEditBtn" onClick={() => { setNameDraft(displayName); setNameEditOpen(true); }} title="Edit your name" aria-label="Edit your name">✎</button>
                )}
              </div>
              {!spectateMode && difficultyRef.current.id === "rank" ? (
                <div className="trayEmpty" style={{ color: "var(--cyan)" }}>
                  {rankBotAssessedElo == null
                    ? `Your Elo updates every ${RANK_BOT_ASSESSMENT_EVERY} games — playing game ${(rankBotGames % RANK_BOT_ASSESSMENT_EVERY) + 1}/${RANK_BOT_ASSESSMENT_EVERY}`
                    : `~${rankBotAssessedElo} Elo`}
                </div>
              ) : (
                !spectateMode && ratingInfo && !ratingInfo.error && ratingInfo.games > 0 && (
                  <div className="trayEmpty" style={{ color: "var(--cyan)" }}>~{ratingInfo.rating} Elo</div>
                )
              )}
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
                {analyzing ? (grading ? `Grading ${gradeProgress}/${moveList.length}…` : analysisBusy ? "Analyzing…" : "Analyzing") : "Analyze"}
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
              {moveList.length > 0 ? (
                <button className="btn ghost" style={{ padding: "4px 8px", fontSize: 10 }} onClick={onCopyPgn}>Copy PGN</button>
              ) : (
                <button className="btn ghost" style={{ padding: "4px 8px", fontSize: 10 }} onClick={() => { setPasteOpen(true); setPasteError(null); }}>Paste PGN</button>
              )}
            </div>
            <div className="rows">
              {pairs.length === 0 && <div className="empty">{"No moves yet — white to play."}</div>}
              {pairs.map(([w, b], i) => {
                const wGrade = moveGrades && moveGrades[i * 2];
                const bGrade = moveGrades && moveGrades[i * 2 + 1];
                return (
                  <div className="mrow" key={i}>
                    <span className="num">{i + 1}.</span>
                    <span
                      className={curMoveIdx === i * 2 ? "cur" : ""}
                      style={reviewing ? { cursor: "pointer" } : undefined}
                      onClick={reviewing ? () => setReviewIndex(i * 2 + 1) : undefined}>
                      {w}{wGrade && <span className={"moveGrade " + wGrade}>{GRADE_TAG[wGrade]}</span>}
                    </span>
                    <span
                      className={curMoveIdx === i * 2 + 1 ? "cur" : ""}
                      style={reviewing && b ? { cursor: "pointer" } : undefined}
                      onClick={reviewing && b ? () => setReviewIndex(i * 2 + 2) : undefined}>
                      {b || ""}{bGrade && <span className={"moveGrade " + bGrade}>{GRADE_TAG[bGrade]}</span>}
                    </span>
                  </div>
                );
              })}
            </div>
            {pgnToast && <div className="toast">{pgnToast}</div>}
          </div>

          <div className="box analysisBox">
            {activePuzzle ? (
              rushMode ? (
                <>
                  <div className="boxHead">Puzzle Rush · {pz.RATING_BANDS[rushBandIdx]?.label || ""} · {formatClock(rushTimeLeft)} left</div>
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

          {mode === "play" && !activePuzzle && !spectateMode && (
            <div className="ctrls playCtrls">
              <button className="btn" onClick={() => { setPromo(null); setColorPick(true); }}>New</button>
              <button className="btn" onClick={undo} disabled={thinking || !!result || eng.plyCount() === 0}>Undo</button>
              <button className="btn ghost" onClick={onHint}
                disabled={thinking || hinting || !!result || !!promo || !!quizOpening || eng.getSide() !== playerColor}>
                {hinting ? "Thinking…" : "Best Move"}
              </button>
              <select value={difficultyIdx} onChange={e => onDifficultyChange(Number(e.target.value))}>
                {DIFFICULTIES.map((d, i) => <option key={i} value={i}>{d.adaptive ? d.label : "Level: " + d.label}</option>)}
              </select>
              {moveList.length > 0 && <button className="btn ghost" onClick={onShare}>Share</button>}
              {result && <button className="btn gold" onClick={() => newGame(playerColor)}>Rematch!</button>}
              {shareToast && <div className="toast">{shareToast}</div>}
              {quizDoneToast && <div className="toast">{quizDoneToast}</div>}
            </div>
          )}

          {spectateMode && (
            <div className="ctrls playCtrls">
              {result ? (
                <button className="btn gold" onClick={() => startSpectate(spectateWhiteIdx, spectateBlackIdx, spectateOpeningId)}>Watch Again</button>
              ) : spectatePaused ? (
                <>
                  <button className="btn gold" onClick={resumeSpectate}>Resume</button>
                  <button className={"btn" + (analyzing ? "" : " ghost")} onClick={toggleAnalyze}>
                    {analyzing ? "Analyzing" : "Analyze"}
                  </button>
                </>
              ) : (
                <button className="btn ghost" onClick={pauseSpectate}>Pause</button>
              )}
              <button className="btn ghost" onClick={stopSpectate}>Stop Spectating</button>
            </div>
          )}
          {spectateMode && spectatePaused && analyzing && (
            <div className="status analyzeHint" style={{ fontSize: 11, opacity: 0.8 }}>
              Move any piece to explore — Resume discards exploratory moves and lets the bots continue
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
            <button className="btn ghost" style={{ display: "flex", alignItems: "center", padding: "10px 14px" }} onClick={() => setMusicOpen(true)} aria-label="Juice Box" title="Juice Box">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" />
              </svg>
            </button>
            <button className="btn ghost" style={{ display: "flex", alignItems: "center", gap: 6 }} onClick={() => setOpeningsOpen(true)}>
              <PixelAvatar rows={BPIX} pal={BPAL} size={16} />
              Openings
            </button>
            <button className="btn ghost" style={{ display: "flex", alignItems: "center", padding: "10px 14px" }}
              onClick={() => { setPuzzlesOpen(true); ensurePuzzlesLoaded(); }}
              onMouseEnter={ensurePuzzlesLoaded}
              aria-label="Puzzles" title="Puzzles">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-1.99.9-1.99 2v3.8H3.5c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.49 1.21-2.7 2.7-2.7s2.7 1.21 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5S21.88 11 20.5 11z" />
              </svg>
            </button>
            <button className="btn ghost" style={{ display: "flex", alignItems: "center", padding: "10px 14px" }} onClick={() => setSpectateOpen(true)} aria-label="Spectate bots" title="Spectate bots">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 5c-5 0-9.27 3.11-11 7 1.73 3.89 6 7 11 7s9.27-3.11 11-7c-1.73-3.89-6-7-11-7zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-2a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
              </svg>
            </button>
            <button className="btn ghost" style={{ fontSize: 18, lineHeight: 1, padding: "10px 14px" }} onClick={openSettings} aria-label="Settings" title="Settings">
              <span aria-hidden="true">⚙</span>
            </button>
          </div>
        </div>
      </div>

      {musicOpen && (
        <div className="promoOv" style={{ position: "fixed", inset: 0, zIndex: 50 }} onClick={e => { if (e.target === e.currentTarget) setMusicOpen(false); }}>
          <div className="promoBox jbBox" style={{ flexDirection: "column", gap: 12, width: 300, padding: "20px 24px" }}>
            <button className="modalCloseX" onClick={() => setMusicOpen(false)} aria-label="Close Juice Box" title="Close">✕</button>
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
          </div>
        </div>
      )}


      {openingsOpen && (
        <div className="promoOv" style={{ position: "fixed", inset: 0, zIndex: 50 }} onClick={e => { if (e.target === e.currentTarget) setOpeningsOpen(false); }}>
          <div className="promoBox" style={{ flexDirection: "column", gap: 12, minWidth: 260, maxWidth: 360, maxHeight: "80vh", overflowY: "auto", padding: "20px 24px" }}>
            <button className="modalCloseX" onClick={() => setOpeningsOpen(false)} aria-label="Close Openings Library" title="Close">✕</button>
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
          </div>
        </div>
      )}

      {puzzlesOpen && (
        <div className="promoOv" style={{ position: "fixed", inset: 0, zIndex: 50 }} onClick={e => { if (e.target === e.currentTarget) setPuzzlesOpen(false); }}>
          <div className="promoBox" style={{ flexDirection: "column", gap: 12, minWidth: 260, maxWidth: 360, padding: "20px 24px" }}>
            <button className="modalCloseX" onClick={() => setPuzzlesOpen(false)} aria-label="Close Puzzles" title="Close">✕</button>
            <div className="boxHead" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <PixelAvatar rows={PPIX} pal={PPAL} size={18} />
              Puzzles — Pick a Rating
            </div>
            {!puzzlesData ? (
              <div className="pv" style={{ padding: "8px 2px" }}>Loading puzzles…</div>
            ) : (
              <div className="rows" style={{ maxHeight: "none" }}>
                <div style={{ cursor: "pointer", padding: "8px 2px", borderBottom: "1px solid #8B2FC92E" }}
                  onClick={() => { setPuzzlesOpen(false); startPuzzle(dailyPuzzle(pz.PUZZLES)); }}>
                  <div style={{ fontWeight: 700, color: "var(--cyan)" }}>📅 Daily Puzzle</div>
                  <div style={{ fontSize: 11, opacity: 0.75 }}>
                    {dailySolvedDate === todayKey() ? "Solved today ✓" : "One puzzle, same for everyone today"}
                  </div>
                </div>
                {pz.RATING_BANDS.map(band => {
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
                <div style={{ cursor: "pointer", padding: "8px 2px" }}
                  onClick={() => { setPuzzlesOpen(false); setRushOpen(true); }}>
                  <div style={{ fontWeight: 700, color: "var(--yellow)" }}>⚡ Puzzle Rush</div>
                  <div style={{ fontSize: 11, opacity: 0.75 }}>Race the clock, difficulty ramps as you solve</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {rushOpen && (
        <div className="promoOv" style={{ position: "fixed", inset: 0, zIndex: 50 }} onClick={e => { if (e.target === e.currentTarget) { setRushOpen(false); setPuzzlesOpen(true); } }}>
          <div className="promoBox" style={{ flexDirection: "column", gap: 12, minWidth: 260, maxWidth: 360, padding: "20px 24px" }}>
            <button className="modalCloseX" onClick={() => { setRushOpen(false); setPuzzlesOpen(true); }} aria-label="Close Puzzle Rush" title="Close">✕</button>
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
            <button className="btn ghost" onClick={() => { setRushOpen(false); setLeaderboardOpen(true); loadLeaderboard(rushDuration); }}>🏆 Leaderboard</button>
          </div>
        </div>
      )}

      {rushMode && rushResult && (
        <div className="promoOv" style={{ position: "fixed", inset: 0, zIndex: 50 }} onClick={e => { if (e.target === e.currentTarget) exitRush(); }}>
          <div className="promoBox" style={{ flexDirection: "column", gap: 12, minWidth: 260, maxWidth: 360, padding: "20px 24px" }}>
            <button className="modalCloseX" onClick={exitRush} aria-label="Exit Puzzle Rush" title="Close">✕</button>
            <div className="boxHead" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <PixelAvatar rows={PPIX} pal={PPAL} size={18} />
              {rushResult.reason === "time" ? "Time's up!" : "3 misses — rush over!"}
            </div>
            <div className="pv" style={{ fontSize: 15 }}>
              You solved <b>{rushResult.solved}</b> puzzle{rushResult.solved === 1 ? "" : "s"}.
            </div>
            <button className="btn gold" onClick={retryRush}>Try Again</button>
            <button className="btn ghost" onClick={() => { setLeaderboardOpen(true); loadLeaderboard(rushDuration); }}>🏆 Leaderboard</button>
          </div>
        </div>
      )}

      {leaderboardOpen && (
        <div className="promoOv" style={{ position: "fixed", inset: 0, zIndex: 51 }} onClick={e => { if (e.target === e.currentTarget) setLeaderboardOpen(false); }}>
          <div className="promoBox" style={{ flexDirection: "column", gap: 12, minWidth: 260, maxWidth: 360, padding: "20px 24px" }}>
            <button className="modalCloseX" onClick={() => setLeaderboardOpen(false)} aria-label="Close Leaderboard" title="Close">✕</button>
            <div className="boxHead" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              🏆 Puzzle Rush Leaderboard
            </div>
            <div className="ctrls">
              {RUSH_DURATIONS.map(d => (
                <button key={d.seconds} className={"btn" + (leaderboardDuration === d.seconds ? "" : " ghost")}
                  onClick={() => loadLeaderboard(d.seconds)}>{d.label}</button>
              ))}
            </div>
            <div className="rows" style={{ maxHeight: 280 }}>
              {leaderboardRows === null ? (
                <div className="pv" style={{ padding: "8px 2px" }}>Loading…</div>
              ) : leaderboardRows.length === 0 ? (
                <div className="pv" style={{ padding: "8px 2px" }}>No scores yet for this duration — be the first!</div>
              ) : (
                leaderboardRows.map((row, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 2px", borderBottom: "1px solid #8B2FC92E" }}>
                    <span>#{i + 1} {row.display_name || "Anonymous"}</span>
                    <b>{row.solved}</b>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {nameEditOpen && (
        <div className="promoOv" style={{ position: "fixed", inset: 0, zIndex: 51 }} onClick={e => { if (e.target === e.currentTarget) setNameEditOpen(false); }}>
          <div className="promoBox" style={{ flexDirection: "column", gap: 12, minWidth: 260, maxWidth: 360, padding: "20px 24px" }}>
            <button className="modalCloseX" onClick={() => setNameEditOpen(false)} aria-label="Close" title="Close">✕</button>
            <div className="boxHead" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              Your Name
            </div>
            <div className="pv" style={{ fontSize: 12, opacity: 0.85 }}>
              Shown on your "You" card and on the Puzzle Rush leaderboard.
            </div>
            <input
              type="text" value={nameDraft} maxLength={24} placeholder="Challenger"
              onChange={e => setNameDraft(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") saveDisplayName(); }}
              style={{ width: "100%", boxSizing: "border-box", fontSize: 14, padding: "8px 10px", borderRadius: 8, background: "#150C24", color: "var(--white, #F4EFFF)", border: "1px solid #8B2FC966" }}
            />
            <button className="btn gold" onClick={saveDisplayName}>Save</button>
          </div>
        </div>
      )}

      {settingsOpen && (
        <div className="promoOv" style={{ position: "fixed", inset: 0, zIndex: 50 }} onClick={e => { if (e.target === e.currentTarget) setSettingsOpen(false); }}>
          <div className="promoBox" style={{ flexDirection: "column", gap: 12, minWidth: 260, maxWidth: 360, padding: "20px 24px" }}>
            <button className="modalCloseX" onClick={() => setSettingsOpen(false)} aria-label="Close Settings" title="Close">✕</button>
            <div className="boxHead" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span aria-hidden="true">⚙</span>
              Settings
            </div>
            <div className="rows" style={{ maxHeight: "none" }}>
              <div style={{ cursor: "pointer", padding: "8px 2px", borderBottom: "1px solid #8B2FC92E" }}
                onClick={() => { setSettingsOpen(false); setPieceDesignsOpen(true); }}>
                <div style={{ fontWeight: 700 }}>Piece Designs</div>
                <div style={{ fontSize: 11, opacity: 0.75 }}>Currently: {getPieceSet(pieceSetId).label}</div>
              </div>
              <div style={{ cursor: "pointer", padding: "8px 2px", borderBottom: "1px solid #8B2FC92E" }}
                onClick={() => { setSettingsOpen(false); setBoardColorsOpen(true); }}>
                <div style={{ fontWeight: 700 }}>Board Color</div>
                <div style={{ fontSize: 11, opacity: 0.75 }}>Currently: {getBoardColor(boardColorId).label}</div>
              </div>
              <div style={{ cursor: "pointer", padding: "8px 2px", borderBottom: "1px solid #8B2FC92E" }} onClick={toggleEvalBar}>
                <div style={{ fontWeight: 700 }}>{hideEvalBar ? "Show Eval Bar" : "Hide Eval Bar"}</div>
                <div style={{ fontSize: 11, opacity: 0.75 }}>
                  {hideEvalBar ? "Eval bar is currently hidden" : "Hides the eval bar for a bigger board on mobile"}
                </div>
              </div>
              <div style={{ padding: "8px 2px" }}>
                <div style={{ fontWeight: 700 }}>Your Rating</div>
                <div style={{ fontSize: 11, opacity: 0.75 }}>
                  {!ratingInfo ? "Loading…"
                    : ratingInfo.error ? ratingInfo.message
                    : ratingInfo.games === 0 ? "Play the 1000/1500/2000 Elo bots to get an estimate"
                    : `~${ratingInfo.rating} (from ${ratingInfo.games} game${ratingInfo.games === 1 ? "" : "s"} vs the calibrated bots)`}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {pieceDesignsOpen && (
        <div className="promoOv" style={{ position: "fixed", inset: 0, zIndex: 50 }} onClick={e => { if (e.target === e.currentTarget) { setPieceDesignsOpen(false); setSettingsOpen(true); } }}>
          <div className="promoBox" style={{ flexDirection: "column", gap: 12, minWidth: 260, maxWidth: 360, padding: "20px 24px" }}>
            <button className="modalCloseX" onClick={() => { setPieceDesignsOpen(false); setSettingsOpen(true); }} aria-label="Close Piece Designs" title="Close">✕</button>
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
                    <img src={set.svgUrl(6, true)} alt="" style={{ width: 36, height: 36 }} />
                    <img src={set.svgUrl(5, false)} alt="" style={{ width: 36, height: 36 }} />
                  </div>
                  <div style={{ fontWeight: 700 }}>{set.label}{set.id === pieceSetId ? " (selected)" : ""}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {boardColorsOpen && (
        <div className="promoOv" style={{ position: "fixed", inset: 0, zIndex: 50 }} onClick={e => { if (e.target === e.currentTarget) { setBoardColorsOpen(false); setSettingsOpen(true); } }}>
          <div className="promoBox" style={{ flexDirection: "column", gap: 12, minWidth: 260, maxWidth: 360, padding: "20px 24px" }}>
            <button className="modalCloseX" onClick={() => { setBoardColorsOpen(false); setSettingsOpen(true); }} aria-label="Close Board Color" title="Close">✕</button>
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
          </div>
        </div>
      )}

      {spectateOpen && (
        <div className="promoOv" style={{ position: "fixed", inset: 0, zIndex: 50 }} onClick={e => { if (e.target === e.currentTarget) setSpectateOpen(false); }}>
          <div className="promoBox" style={{ flexDirection: "column", gap: 12, minWidth: 260, maxWidth: 360, padding: "20px 24px" }}>
            <button className="modalCloseX" onClick={() => setSpectateOpen(false)} aria-label="Close Spectate Bots" title="Close">✕</button>
            <div className="boxHead" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              Spectate Bots
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
          </div>
        </div>
      )}

      {pasteOpen && (
        <div className="promoOv" style={{ position: "fixed", inset: 0, zIndex: 50 }} onClick={e => { if (e.target === e.currentTarget) setPasteOpen(false); }}>
          <div className="promoBox" style={{ flexDirection: "column", gap: 12, minWidth: 260, maxWidth: 420, padding: "20px 24px" }}>
            <button className="modalCloseX" onClick={() => setPasteOpen(false)} aria-label="Close Paste PGN" title="Close">✕</button>
            <div className="boxHead" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              Paste PGN
            </div>
            <div className="pv" style={{ fontSize: 12, opacity: 0.85 }}>
              Paste a game's PGN text below, then press Analyze to step through it and grade the moves.
            </div>
            <textarea
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              placeholder={"1. e4 e5 2. Nf3 Nc6 3. Bb5 ..."}
              rows={8}
              style={{ width: "100%", boxSizing: "border-box", resize: "vertical", fontFamily: "ui-monospace, Consolas, monospace", fontSize: 12, padding: 8, borderRadius: 8, background: "#150C24", color: "var(--white, #F4EFFF)", border: "1px solid #8B2FC966" }}
            />
            {pasteError && <div className="pv" style={{ fontSize: 11, color: "#F05348" }}>{pasteError}</div>}
            <button className="btn gold" onClick={loadPastedPgn} disabled={!pasteText.trim()}>Analyze</button>
          </div>
        </div>
      )}
    </div>
  );
}
