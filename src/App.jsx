import { useState, useRef, useCallback, useEffect, useLayoutEffect, useMemo, lazy, Suspense } from "react";
import {
  createEngine, EMPTY, WK, M64TO120, M120TO64,
  mFrom, mTo, mFlags, MATE, fileOf, rankOf,
} from "./engine/chessEngine";
import { createAudio } from "./audio/chiptune";
import { getSupabase } from "./utils/supabase";
import { MP3_PLAYLISTS, THEME_ID, loadPlaylistTracks } from "./utils/musicLibrary";
import PixelAvatar, { ZPAL, ZPIX } from "./components/PixelAvatar";
import HomePage from "./components/HomePage";
import { AppHeader, BottomBar } from "./components/AppNav";
import PlayPage from "./components/PlayPage";
import { currentStreak, nextStreak, utcDay } from "./utils/dailyStreak";
import { historyStep, pathForView, sectionForView, viewForPath } from "./utils/routes";
import { pickPostGameLine } from "./utils/botLines";
import { signInWithDiscord, signOut, watchAuthState, discordProfile } from "./utils/auth";
import { claimAnonymousData } from "./utils/accountMigration";
import { loadSetting, saveSetting } from "./utils/storage";
const RushThemeArt = lazy(() => import("./components/RushThemeArt"));
import { getUiTheme } from "./utils/uiTheme";
import { CURRENT_LIST_VERSION, DIFFICULTIES, levelIdxFor, savedLevelIdx } from "./utils/difficulties";
import { RANK_BOT_DEFAULT_ELO, RANK_BOT_OPENING_PLIES, RANK_BOT_MIN_TRACKED_MOVES, RANK_BOT_ASSESSMENT_EVERY, nextRankRating } from "./utils/rankBotMath";
import { BALANCED, randomStyle, byStyle, pickPersonality } from "./utils/personalities";
import { detectOpening } from "./utils/openingDetect";
import { todayKey, dailyPuzzle } from "./utils/dailyPuzzle";
import { pickTrackIndex } from "./utils/trackIndex";
import { materialState } from "./utils/material";
import { RECHECK_LOSS, pointsLost, sideAccuracy } from "./utils/reviewScoring";
import { readRankBotTest } from "./utils/rankBotTest";
import { judgePuzzleMove } from "./utils/puzzleSession";
import { clearLiveGame, isResumable, loadLiveGame, saveLiveGame } from "./utils/liveGame";
import { reloadIfStaleBuild } from "./utils/staleBuild";
import { gradeGame } from "./utils/gradeGame";
import { buildPgn, parsePgnMoves, replayForeignPgn, parsePgnHeaders, countPgnGames, describePasteProblem, reviewInfoFromHeaders, exporterSide } from "./utils/pgn";
import { encodeGame, decodeGame, getSharedHash, replayIntoEngine } from "./utils/share";
import { getPieceSet } from "./utils/pieceSets";
import { getBoardColor } from "./utils/boardColors";
import { saveGame, estimateRating } from "./utils/gameHistory";
import { getDisplayName, setDisplayName } from "./utils/playerIdentity";
import { submitRushScore } from "./utils/leaderboard";
const LeaderboardPage = lazy(() => import("./components/LeaderboardPage"));
const PuzzlesHomePage = lazy(() => import("./components/PuzzlesHomePage"));
const LessonsPage = lazy(() => import("./components/LessonsPage"));
const GameReviewPage = lazy(() => import("./components/GameReviewPage"));
const AppPopups = lazy(() => import("./components/AppPopups"));
const ModePages = lazy(() => import("./components/ModePages"));
const ProfilePage = lazy(() => import("./components/ProfilePage"));
const PlayView = lazy(() => import("./components/PlayView"));
import { syncRankBotToSupabase, fetchRankBotFromSupabase, logRankBotMove } from "./utils/rankBot";
import { ENGINE_VERSION } from "./utils/version";
import { OPENINGS } from "./utils/openings";
import { loadEcoOpenings, detectEcoOpening, theoryPlyCount } from "./utils/ecoOpenings";
import { stockfishBestMove, stockfishAnalyze, warmUpStockfish, isStockfishWarm } from "./engine/stockfishEngine";
import "./tokens.css";
import "./App.css";

/* Loaded on demand: blind mode brings its own parser/describer/speech
   stack, none of which the main board ever needs. */
const BlindMode = lazy(() => import("./components/BlindMode"));

const FILES = "abcdefgh";
const PIECE_NAME = { 1: "pawn", 2: "knight", 3: "bishop", 4: "rook", 5: "queen", 6: "king" };

/* "book" = memorized theory (tagged via the ECO line data, not engine
   judgment); "miss" = the opponent just blundered and this move let the
   punishment slip -- chess.com's vocabulary, and the distinction players
   actually learn from: a miss is a found-nothing, not a played-badly. */
const SHADOW_MIN_THINK_MS = 700;
const MATE_FX_MS = 4600;
/* Rank Bot first: he's the one to suggest. */
const PLAY_LEVELS = DIFFICULTIES
  .map((d, idx) => (d.id === "rank" ? { label: "Zlegend2700 (Rank Bot)", suggested: true, idx } : { label: d.label, idx }))
  .sort((a, b) => Number(!!b.suggested) - Number(!!a.suggested));
const GRADE_TAG = { brilliant: "!!", great: "★", best: "!", excellent: "✓", good: "•", book: "≡", inaccuracy: "?!", miss: "✗", mistake: "?", blunder: "??" };
const GRADE_COLOR = { brilliant: "#3EE7F5", great: "#4EA8DE", best: "#6FCF97", excellent: "#8FD9A8", good: "#C9C2E8", book: "#9D8FC4", inaccuracy: "#F5D93E", miss: "#FF8A5C", mistake: "#F0A548", blunder: "#F05348" };

/* Clickable eval graph for the post-game report -- the same "story of
   the game" area chart chess.com/lichess center their review on. scores
   come straight from gradeMoves (side-to-move perspective, one per ply
   plus the final position); the light region is White's share of the
   game, squashed with the same atan the eval bar next to the board
   uses. Tap or drag anywhere to jump the review to that ply. */
function EvalGraph({ scores, grades, current, onSeek }) {
  const n = scores.length - 1;
  if (n < 1) return null;
  const W = 100, H = 34;
  const whiteCp = (k) => (k % 2 === 0 ? scores[k] : -scores[k]);
  const y = (k) => (1 - Math.atan(whiteCp(k) / 300) / (Math.PI / 2)) * (H / 2);
  const x = (k) => (k / n) * W;
  let line = `M${x(0)},${y(0)}`;
  for (let k = 1; k <= n; k++) line += ` L${x(k)},${y(k)}`;
  const seek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    onSeek(Math.max(0, Math.min(n, Math.round(frac * n))));
  };
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
      className="block h-16 w-full cursor-pointer rounded-lg"
      style={{ background: "#150C24", touchAction: "none" }}
      onPointerDown={seek}
      onPointerMove={(e) => { if (e.buttons === 1) seek(e); }}
      role="slider" aria-label="Game evaluation graph" aria-valuemin={0} aria-valuemax={n} aria-valuenow={current}
    >
      <path d={`${line} L${W},${H} L0,${H} Z`} fill="#E9E4F5" fillOpacity="0.85" />
      <line x1="0" y1={H / 2} x2={W} y2={H / 2} stroke="#8B2FC9" strokeOpacity="0.5" strokeWidth="0.4" strokeDasharray="1.6 1.6" />
      <path d={line} fill="none" stroke="#3EE7F5" strokeOpacity="0.9" strokeWidth="0.6" />
      {grades && grades.map((g, i) => (
        (g === "mistake" || g === "blunder" || g === "miss") ? (
          <circle key={i} cx={x(i + 1)} cy={y(i + 1)} r="1.6" fill={GRADE_COLOR[g]} stroke="#150C24" strokeWidth="0.5" />
        ) : null
      ))}
      <line x1={x(current)} y1="0" x2={x(current)} y2={H} stroke="#F5D93E" strokeWidth="0.6" strokeOpacity="0.9" />
    </svg>
  );
}
const formatClock = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
/* Matches the .15s used for the app's other quick UI transitions. */
const PIECE_SLIDE_MS = 150;
/* Puzzle Rush difficulty ramp: climb one rating band every 3 solves in a
   row, drop back one band on a miss so a rough patch doesn't strand the
   player facing puzzles far above what they just missed. */
const RUSH_STEP_UP_EVERY = 3;

/* Inline-SVG icon for the label prefix that used to be a raw emoji (⚡)
   -- same fill="currentColor" convention as HomePage's ICONS, just local
   to App.jsx since it's only used here. */
function BoltIcon({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M7 2v11h3v9l7-12h-4l4-8z" />
    </svg>
  );
}

/* A plain <img src="/bot-happy.webp"> never retries once it fails --
   browsers just leave the broken-image icon (or nothing but the alt
   text) sitting there forever, even though the very next request for
   the same URL might succeed (a dropped connection during dev-server
   HMR, a flaky mobile network, whatever). Retries twice with a cache-
   busting query param before giving up and falling back to the inline
   PixelAvatar, which can't ever fail to load since it's not a network
   request. Defined at module scope, not inside ZlegendsBot, so it isn't
   redefined (and remounted) on every render. */
function MoodImg({ src, alt }) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  useEffect(() => { setAttempt(0); setFailed(false); }, [src]);
  if (failed) return <PixelAvatar rows={ZPIX} pal={ZPAL} size={44} />;
  const onError = () => {
    if (attempt < 2) setAttempt(a => a + 1);
    else setFailed(true);
  };
  return (
    <img
      src={attempt === 0 ? src : `${src}?retry=${attempt}`}
      alt={alt}
      className="reactionImg"
      onError={onError}
    />
  );
}

export default function ZlegendsBot() {
  const initialHash = useRef(getSharedHash()).current;
  const initialShared = useRef(initialHash ? decodeGame(initialHash) : null).current;
  /* A shared game link (?/#g=...) always drops straight into Play with
     that game loaded -- a viewer clicking a friend's shared link should
     never have to click through the home page first to see the position
     they were sent. */
  const [siteView, setSiteView] = useState(() => (initialShared ? "play" : viewForPath(window.location.pathname)));

  const initRef = useRef(null);
  if (!initRef.current) {
    const engine = createEngine();
    const saved = initialShared ? null : loadLiveGame();
    const line = initialShared ? initialShared.moveList : isResumable(saved) ? saved.moves : [];
    const applied = replayIntoEngine(engine, line).applied;
    const resumed = isResumable(saved) && applied.length === line.length ? saved : null;
    if (saved && !resumed) { engine.reset(); applied.length = 0; }
    initRef.current = { engine, applied, resumed, expired: saved && !resumed ? saved : null };
  }
  const eng = initRef.current.engine;
  const resumed = initRef.current.resumed;

  const [volume, setVolume] = useState(() => loadSetting("volume", 60));
  const [pieceSetId, setPieceSetId] = useState(() => loadSetting("pieceSet", "classic"));
  const [boardColorId, setBoardColorId] = useState(() => loadSetting("boardColor", "default"));
  /* Single source of truth for the app-wide light theme, Sweetheart's, chosen
     in Settings and independent of the board and pieces (see tokens.css's
     [data-theme="sweetheart"] block and getUiTheme in utils/uiTheme.js). It
     used to follow her board color, so anyone on that board starts light.
     Mirrored onto the real document root (not just .root's className)
     because Home/Leaderboard/Lessons render as separate top-level trees
     outside .root's subtree and still need the palette to cascade. */
  const [sweetheart, setSweetheart] = useState(() => loadSetting("lightTheme", boardColorId === "sweetheart"));
  const chooseTheme = (light) => { setSweetheart(light); saveSetting("lightTheme", light); };
  useEffect(() => {
    document.documentElement.dataset.theme = sweetheart ? "sweetheart" : "";
  }, [sweetheart]);
  const uiT = getUiTheme(sweetheart);
  const [hideEvalBar, setHideEvalBar] = useState(() => loadSetting("hideEvalBar", false));
  const [ecoData, setEcoData] = useState(null);
  /* The full ECO book is a ~480KB chunk that only matters once there's a
     game to name openings for -- don't make home-page visitors download
     it. detectOpening (the small built-in book) covers the gap while it
     streams in after the player first enters the play view. */
  useEffect(() => {
    if (siteView !== "play" || ecoData) return;
    loadEcoOpenings().then(setEcoData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteView]);
  /* warmUpStockfish() has existed since this engine was added specifically
     to avoid the first bot move absorbing the whole WASM download+init --
     but nothing was actually calling it, so it was dead code and every
     new player's first move (default difficulty is "2000 Elo", a
     Stockfish tier) paid that stall in full. Same defer-until-play timing
     as the ECO book above; the existing "Zlegend2700 is calculating…"
     thinking state already covers the rare case someone moves faster than
     a small single-threaded WASM build can finish loading. */
  /* Tracked in state so the status line can switch from "warming up" to
     "calculating" once the engine is ready -- the worker boots outside
     React, so nothing else would re-render the moment it finishes. */
  const [engineWarm, setEngineWarm] = useState(() => isStockfishWarm());
  useEffect(() => {
    if (siteView !== "play") return;
    warmUpStockfish().then(() => setEngineWarm(isStockfishWarm()));
  }, [siteView]);
  const pieceImgSrc = (type, isWhite) => getPieceSet(pieceSetId).svgUrl(type, isWhite);
  const audioRef = useRef(null);
  if (!audioRef.current) audioRef.current = createAudio(loadSetting("trackIdx", 0), volume / 100, loadSetting("sfxOn", true));
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
  /* Read once, before the "mark visited" effect below flips the flag --
     HomePage's welcome beat needs to know if this is a genuine first
     visit, independent of whether theme-music autoplay is armed (that
     one also requires musicSource === "chiptune"). */
  const isFirstVisitRef = useRef(!loadSetting("visitedBefore", false));

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
        personality: opts.personality, useBook: !!opts.useBook, bookStyle: opts.bookStyle || null,
      });
    });
  }, []);

  const [, force] = useState(0);
  const rerender = () => force(n => n + 1);
  const [mode, setMode] = useState(initialShared ? "replay" : "play");
  const [replayFull, setReplayFull] = useState(initialShared ? initialShared.moveList : []);
  const [replayIndex, setReplayIndex] = useState(initialShared ? initialShared.moveList.length : 0);
  const [replayPlaying, setReplayPlaying] = useState(false);

  const [playerColor, setPlayerColor] = useState(initialShared ? initialShared.playerColor : resumed?.color ?? 1);
  const [selected, setSelected] = useState(-1);
  const [targets, setTargets] = useState([]);
  const [lastMove, setLastMove] = useState(() => {
    const applied = initRef.current.applied;
    if (!applied.length) return null;
    const last = applied[applied.length - 1];
    return { from: mFrom(last), to: mTo(last) };
  });
  const [moveList, setMoveList] = useState(() => initialShared ? initialShared.moveList : resumed?.moves ?? []);
  const moveListRef = useRef(moveList);
  moveListRef.current = moveList;
  const [thinking, setThinking] = useState(false);
  const [info, setInfo] = useState(null);
  const [result, setResult] = useState(null);
  /* ZLEGEND2700's post-game one-liner -- picked once when `result`
     transitions from null to a real result object (a fresh object every
     time a game actually ends), not recomputed on unrelated re-renders.
     Deliberately cheap: no move grading involved (that's a whole
     Stockfish pass now), just the final result + material + which
     "personality of the day" the bot was playing as. */
  const [botLine, setBotLine] = useState(null);
  const [mateFx, setMateFx] = useState(null);
  const [promo, setPromo] = useState(null);
  const [colorPick, setColorPick] = useState(false);
  /* Inline "abandon this game?" step before New wipes a game that's
     actually in progress -- New used to jump straight to the color
     picker regardless, so one misclick could lose a real game with zero
     warning. Only gates past a few opening moves (nothing worth losing
     yet before that) and skips entirely once the game already ended
     (New after checkmate isn't "abandoning" anything). */
  const [newGameConfirm, setNewGameConfirm] = useState(false);
  const [difficultyIdx, setDifficultyIdx] = useState(() => {
    const saved = savedLevelIdx(loadSetting("difficultyIdx", 2), loadSetting("levelListVersion", 0));
    saveSetting("difficultyIdx", saved);
    saveSetting("levelListVersion", CURRENT_LIST_VERSION);
    const level = resumed ? levelIdxFor(resumed.label) : -1;
    return level >= 0 ? level : saved;
  });
  const [gameStyle, setGameStyle] = useState(() => (resumed?.style ? byStyle(resumed.style) : randomStyle()));
  const [evalCp, setEvalCp] = useState(() => eng.evalWhite());
  const [musicOn, setMusicOn] = useState(false);
  const [trackName, setTrackName] = useState(audioRef.current.trackName());
  const [hintMove, setHintMove] = useState(null);
  const [hinting, setHinting] = useState(false);
  const [reviewIndex, setReviewIndex] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [moveGrades, setMoveGrades] = useState(null);
  /* Everything else gradeMoves computes along the way, kept instead of
     discarded: per-ply eval scores (side-to-move perspective, length
     N+1) drive the eval graph + accuracy numbers, bestSans powers the
     "best was X" coaching line on graded mistakes. */
  const [gradeDetail, setGradeDetail] = useState(null);
  /* Practice-your-mistakes drill state: { queue, idx, feedback, revealed,
     done } while a drill is running, null otherwise. See startPractice. */
  const [practice, setPractice] = useState(null);
  const [grading, setGrading] = useState(false);
  const [gradeProgress, setGradeProgress] = useState(0);
  const [rechecking, setRechecking] = useState(false);
  /* Bumped whenever the game grading was analyzing gets replaced out from
     under it (new game, undo, a fresh pasted PGN) -- gradeMoves checks
     this after every await and abandons silently if it's changed, so a
     slow in-flight run from a previous game can't land its grades on
     whatever's on the board now. */
  const gradeRunIdRef = useRef(0);
  const [pastedGame, setPastedGame] = useState(false);
  /* Who played and how it ended, for a game opened in Game Review. Without
     this the cards would label someone else's game as Zlegend2700 vs you. */
  const [reviewInfo, setReviewInfo] = useState(null);
  const [bestArrow, setBestArrow] = useState(null);
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const [analysisExtra, setAnalysisExtra] = useState([]);
  const [posVersion, setPosVersion] = useState(0);
  const [shareToast, setShareToast] = useState(null);
  const [shareLinkFallback, setShareLinkFallback] = useState(null);
  const [pgnToast, setPgnToast] = useState(null);
  const [musicOpen, setMusicOpen] = useState(false);
  const musicOpenRef = useRef(false);
  musicOpenRef.current = musicOpen;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [ratingInfo, setRatingInfo] = useState(null);
  /* Fetched up-front (not just when Settings opens) now that the estimate
     also shows next to the "You" card -- but deferred a few seconds past
     load, since it dynamic-imports the ~100KB supabase-js chunk and
     shouldn't compete with the board/engine for startup bandwidth. */
  useEffect(() => {
    const t = setTimeout(() => estimateRating().then(setRatingInfo), 3000);
    return () => clearTimeout(t);
  }, []);
  const openSettings = () => {
    setSettingsOpen(true);
    if (!ratingInfo) estimateRating().then(setRatingInfo);
  };
  /* Discord sign-in (see utils/auth.js). watchAuthState fires once
     immediately with whatever session already exists (page reload after
     a previous sign-in), then again on every future sign-in/out --
     session is the single source of truth `profile` and the account
     modal below are derived from. */
  const [session, setSession] = useState(null);
  useEffect(() => watchAuthState(setSession), []);
  const profile = discordProfile(session);
  /* Folds this browser's anonymous client_id data (Rank Bot rating, game
     history, Rush scores) onto the account, so a returning player who just
     signed in doesn't look like they're starting from zero. */
  useEffect(() => {
    if (session?.user?.id) claimAnonymousData(session.user.id);
  }, [session?.user?.id]);
  const closeMusic = () => setMusicOpen(false);
  const closeSettings = () => setSettingsOpen(false);

  /* Keeps the address bar in step with siteView, and lets the back gesture
     drive siteView. See historyStep for why back only ever goes one step.
     Landing straight on a page puts Home underneath it, so that one step
     exists from the start. */
  const firstRouteRef = useRef(true);
  useEffect(() => {
    const url = pathForView(siteView) + window.location.search + window.location.hash;
    const onSubPage = !!history.state?.subPage;
    if (firstRouteRef.current) {
      firstRouteRef.current = false;
      if (siteView === "home" || onSubPage) return;
      history.replaceState(null, "", "/");
      history.pushState({ subPage: true }, "", url);
      return;
    }
    if (window.location.pathname === pathForView(siteView)) return;
    const step = historyStep(siteView, onSubPage);
    if (step === "back") history.back();
    else if (step === "push") history.pushState({ subPage: true }, "", url);
    else history.replaceState(siteView === "home" ? null : { subPage: true }, "", url);
  }, [siteView]);
  const focusedRef = useRef(false);
  const leaveActivityRef = useRef(null);
  useEffect(() => {
    const onPopState = () => {
      /* A stray edge swipe shouldn't pull anyone out of a game, so undo it.
         Leaving is still one tap away on the logo. */
      if (focusedRef.current) {
        history.pushState({ subPage: true }, "", pathForView("play"));
        return;
      }
      const view = viewForPath(window.location.pathname);
      setMusicOpen(false);
      setSettingsOpen(false);
      /* Same exception as enterMode: Leaderboard and the board keep a Rush
         result alive so the player can step back to it. */
      if (view !== "leaderboard" && view !== "play") leaveActivityRef.current();
      setSiteView(view);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  const [displayName, setDisplayNameState] = useState(() => getDisplayName());
  const displayNameRef = useRef(displayName);
  displayNameRef.current = displayName;
  const [nameEditOpen, setNameEditOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const saveProfileName = (name) => {
    const saved = setDisplayName(name);
    setDisplayNameState(saved);
  };
  const saveDisplayName = () => {
    const saved = setDisplayName(nameDraft);
    setDisplayNameState(saved);
    setNameEditOpen(false);
  };
  /* Leaderboard lives on its own page (LeaderboardPage.jsx), not a modal
     -- every "View Leaderboard" trigger should call this rather than
     opening an overlay, now and for any future leaderboard entry point.
     Back returns to whichever view the player actually came from (home
     tile vs the Rush modals on the play screen), not a hardcoded one. */
  const [leaderboardDuration, setLeaderboardDuration] = useState(60);
  const leaderboardReturnRef = useRef("puzzlesHome");
  const openLeaderboard = (duration) => {
    setLeaderboardDuration(duration);
    leaderboardReturnRef.current = siteView === "leaderboard" ? leaderboardReturnRef.current : siteView;
    setSiteView("leaderboard");
  };
  /* One-time recalibration (v2): the original dial logic could only ever
     drift down -- its step-up bar sat under the probe searches' noise
     floor, confirmed from the logged rank_bot_moves data -- so anyone who
     never completed a full assessment restarts from the new, higher
     default rather than keeping a rating the old math dragged down. */
  /* Rank Bot's choices live in engine/shadowBot.js. This state is what it has
     learned about the player this session, and the private readout that
     ?rankbot=test shows under the board. */
  const [rankBotTest] = useState(readRankBotTest);
  const [rankTestNote, setRankTestNote] = useState(null);
  const shadowStateRef = useRef(null);
  /* The latest estimate of this player, once it's based on enough moves. */
  const rankLevelRef = useRef(null);

  const [rankBotElo, setRankBotElo] = useState(() => {
    if (loadSetting("rankBotVersion", 1) < 2) {
      if (loadSetting("rankBotElo", null) != null && loadSetting("rankBotAssessedElo", null) == null) {
        saveSetting("rankBotElo", RANK_BOT_DEFAULT_ELO);
        saveSetting("rankBotGames", 0);
        saveSetting("rankBotRecentGameElos", []);
      }
      saveSetting("rankBotVersion", 2);
    }
    return loadSetting("rankBotElo", RANK_BOT_DEFAULT_ELO);
  });
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
  /* How many post-opening moves Rank Bot tracked this game --
     an abandoned game with enough of these still counts toward the
     assessment (see maybeCountAbandonedRankGame). */
  const rankBotTrackedRef = useRef(resumed?.tracked ?? 0);
  /* Client-generated id linking one Rank Bot game's rank_bot_moves rows
     back to its single games-table row (that insert is fire-and-forget
     and doesn't return its own id) -- lazily created on this game's first
     tracked move, cleared once the game ends so the next game gets a
     fresh one. */
  const rankBotGameUidRef = useRef(resumed?.uid ?? null);
  const ensureRankBotGameUid = () => {
    if (!rankBotGameUidRef.current) {
      rankBotGameUidRef.current = (typeof crypto !== "undefined" && crypto.randomUUID)
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
    return rankBotGameUidRef.current;
  };
  const ensureRankBotGameUidRef = useRef(ensureRankBotGameUid);
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
  const [activeOpening, setActiveOpening] = useState(null);
  const [quizOpening, setQuizOpening] = useState(null);
  const [quizFeedback, setQuizFeedback] = useState(null);
  const [quizDoneToast, setQuizDoneToast] = useState(null);
  const [blindOpen, setBlindOpen] = useState(false);
  const [puzzlesData, setPuzzlesData] = useState(null);
  const puzzlesLoadingRef = useRef(false);
  const pz = puzzlesData || { PUZZLES: [], RATING_BANDS: [] };
  const ensurePuzzlesLoaded = () => {
    if (puzzlesData || puzzlesLoadingRef.current) return;
    puzzlesLoadingRef.current = true;
    import("./utils/puzzles").then(m => setPuzzlesData({ PUZZLES: m.PUZZLES, RATING_BANDS: m.RATING_BANDS }));
  };
  useEffect(() => {
    if (["puzzlesHome", "ranked", "rush"].includes(siteView)) ensurePuzzlesLoaded();
    /* Home only needs the puzzle pool for its Daily card, so it's fetched
       after the first paint rather than in front of it. */
    if (siteView !== "home") return undefined;
    const timer = setTimeout(ensurePuzzlesLoaded, 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteView]);
  const [puzzleBand, setPuzzleBand] = useState(null);
  const [activePuzzle, setActivePuzzle] = useState(null);
  const [puzzleFeedback, setPuzzleFeedback] = useState(null);
  const [puzzleSolved, setPuzzleSolved] = useState(false);
  const [dailyStreak, setDailyStreak] = useState(() => loadSetting("dailyStreak", null));
  const [dailySolvedDate, setDailySolvedDate] = useState(() => loadSetting("dailyPuzzleSolvedDate", null));
  const [rushMode, setRushMode] = useState(false);
  const [rushDuration, setRushDuration] = useState(60);
  const [rushTimeLeft, setRushTimeLeft] = useState(60);
  const [rushMistakes, setRushMistakes] = useState(0);
  const [rushSolved, setRushSolved] = useState(0);
  const [rushResult, setRushResult] = useState(null);
  /* The heartbreak-screen Modal's own visibility, independent of whether
     the run itself is over -- closing it (X, backdrop, Escape) used to
     call exitRush() and boot the player back to the Puzzles menu, losing
     the final position. Now it just clears this flag; rushResult/rushMode
     stay put so the board keeps showing where the run ended, and the
     puzzleCtrls row below grows a Results button to bring it back. */
  const [rushSummaryOpen, setRushSummaryOpen] = useState(true);
  /* Which of the (up to 3) missed puzzles the heartbreak screen's stepper
     is currently showing -- resets with each new run. */
  const [missedStepIdx, setMissedStepIdx] = useState(0);
  /* Try again gets a 2-second "get ready" beat instead of dropping straight
     into the next puzzle -- null while idle, else 2/1 counting down. */
  const [restartCountdown, setRestartCountdown] = useState(null);
  /* Set while attempting a puzzle from the heartbreak screen's missed-
     puzzle stepper -- distinct from a normal Daily/Ranked attempt (its own
     Retry/Analyze/Exit control row) and distinct from live Rush (rushMode/
     rushResult deliberately stay untouched the whole time, so Exit can
     drop straight back into the summary with the other missed puzzles
     still there instead of ending the rush session). */
  const [missedAttempt, setMissedAttempt] = useState(null);
  /* The board position at the moment a rush actually ended -- captured so
     a missed-puzzle attempt (which loads a different position onto the
     same shared engine) can be undone on Exit, restoring what Analyze on
     the heartbreak screen is supposed to be analyzing. */
  const rushFinalMoveListRef = useRef([]);
  /* Best single-run solved count per duration (keyed by seconds, "none"
     for No Timer), shown on the heartbreak screen instead of the lifetime
     total -- "how does this run compare to your best at this speed" is a
     more useful number in the moment than an ever-climbing lifetime sum. */
  const [rushBestMap, setRushBestMap] = useState(() => loadSetting("rushBestByDuration", {}));
  const [rushBandIdx, setRushBandIdx] = useState(0);
  /* Puzzles missed during the current run (max 3, since 3 misses ends the
     run) -- kept as full puzzle objects so the results screen can offer
     retrying one straight from the summary. */
  const [rushMissed, setRushMissed] = useState([]);
  const rushMissedRef = useRef([]);
  /* puzzleMove's own follow-up timers (auto-reply move, advance to the
     next rush puzzle, end the rush) -- tracked so leaveActivity() can
     cancel a pending one when the player exits mid-delay, instead of it
     firing 400-700ms later against whatever's on the board by then. */
  const puzzleTimeoutRef = useRef(null);
  /* Lifetime rush-solve counter, independent of any single run -- for
     players doing many rushes in one sitting. Persisted so it survives a
     reload; user-resettable from the Rush start menu. */
  const [rushLifetime, setRushLifetime] = useState(() => loadSetting("rushLifetimeSolved", 0));
  const rushLifetimePrevRef = useRef(rushLifetime);
  const [rushMilestone, setRushMilestone] = useState(0);
  const rushSolvedRef = useRef(0);
  const rushMistakesRef = useRef(0);
  const rushBandIdxRef = useRef(0);
  const rushStreakRef = useRef(0);
  /* Every puzzle id served so far this run (across every band it's
     touched, not scoped per band -- a band drop after a miss can re-enter
     a band already partly seen). nextRushPuzzle/startRush both draw
     through pickUnseenPuzzle so the same puzzle can't come up twice in
     one run. */
  const rushSeenRef = useRef(new Set());
  const difficultyRef = useRef(DIFFICULTIES[difficultyIdx]);
  difficultyRef.current = DIFFICULTIES[difficultyIdx];
  const gameStyleRef = useRef(gameStyle);
  gameStyleRef.current = gameStyle;
  const playerColorRef = useRef(playerColor);
  playerColorRef.current = playerColor;
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

  /* The checkmate moment, for games played out here. Reviewed games and
     puzzles have their own endings. */
  useEffect(() => {
    if (result?.reason !== "Checkmate" || pastedGame || activePuzzle || rushMode) { setMateFx(null); return; }
    const loser = eng.getSide();
    let sq = -1;
    for (let i = 0; i < 64; i++) if (eng.pieceAt(i) === loser * WK) sq = i;
    if (sq < 0) return;
    setMateFx({ sq, loser, winner: result.winner, done: false });
    try { audio.sfxCheckmate(); } catch { /* audio unavailable */ }
    const timer = setTimeout(() => setMateFx((fx) => fx && { ...fx, done: true }), MATE_FX_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

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
  const canAnalyze = reviewing || mode === "replay" || (spectateMode && spectatePaused) || (rushMode && !!rushResult) || !!missedAttempt;

  /* Arrow keys step through a review or replay, which is how Chess.com's
     Game Review moves too: left/right one move, up/down to the ends.
     Ignored while typing or with a modal open, and when a modifier is held
     so browser shortcuts like Alt+Left still work. */
  useEffect(() => {
    if (!reviewing && mode !== "replay") return;
    const total = reviewing ? moveList.length : replayFull.length;
    const setIndex = reviewing ? setReviewIndex : setReplayIndex;
    const onKeyDown = (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (e.target.closest?.("input, textarea, select") || document.querySelector(".promoOv")) return;
      const step = { ArrowLeft: (i) => i - 1, ArrowRight: (i) => i + 1, ArrowUp: () => 0, ArrowDown: () => total }[e.key];
      if (!step) return;
      e.preventDefault();
      setIndex((i) => Math.max(0, Math.min(total, step(i))));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [reviewing, mode, moveList.length, replayFull.length]);
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
    /* A graded game already knows Stockfish's move and score for every
       position, so the arrow and eval are instant and always agree with the
       labels. Searching again would use the far weaker homemade engine, and
       stepping through moves would queue up searches. */
    const knownBest = reviewing && !analysisExtra.length ? gradeDetail?.bestSans?.[reviewIndex] : null;
    if (knownBest && gradeDetail.fens) {
      const probe = createEngine();
      probe.loadFen(gradeDetail.fens[reviewIndex]);
      const move = probe.legalMoves().find((m) => probe.sanOf(m) === knownBest);
      if (move !== undefined) {
        const score = gradeDetail.scores[reviewIndex];
        setBestArrow({ from: mFrom(move), to: mTo(move), san: knownBest });
        setEvalCp(probe.getSide() === 1 ? score : -score);
        setAnalysisBusy(false);
        return;
      }
    }
    setBestArrow(null);
    setAnalysisBusy(true);
    let cancelled = false;
    const fullLine = (reviewing ? moveList.slice(0, reviewIndex) : moveList).concat(analysisExtra);
    runSearch(fullLine, 800, 0, { personality: BALANCED, useBook: false }).then((res) => {
      if (cancelled) return;
      if (res && res.move) {
        /* SAN of the suggestion, for the "Best: Nf3" text next to the
           board -- on a phone the arrow alone is easy to misread. eng is
           already replayed to this exact position by the review effect;
           sanOf can still throw if the player slipped in an exploratory
           move mid-search, so treat the label as best-effort. */
        let san = null;
        try { san = eng.sanOf(res.move); } catch { /* stale position */ }
        setBestArrow({ from: mFrom(res.move), to: mTo(res.move), san });
        const whiteScore = eng.getSide() === 1 ? -res.score : res.score;
        setInfo({ depth: res.depth, score: whiteScore, nodes: res.nodes, time: res.time, pv: res.pv });
      } else {
        setBestArrow(null);
      }
      setAnalysisBusy(false);
    });
    return () => { cancelled = true; };
  }, [canAnalyze, reviewing, analyzing, posVersion, moveList, reviewIndex, analysisExtra, gradeDetail, eng, runSearch]);

  const isCaptureMove = useCallback((m) => eng.pieceAt(M120TO64[mTo(m)]) !== EMPTY || (mFlags(m) & 1), [eng]);

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
  }, [eng, audio, isCaptureMove]);

  const toggleAnalyze = () => {
    if (!canAnalyze) return;
    /* The analyze arrow is the answer key -- practice mode can't coexist
       with it, so flipping analysis on (or off) ends the drill. */
    if (practice) { setPractice(null); setHintMove(null); }
    setAnalyzing(a => {
      const next = !a;
      if (next && reviewing && !moveGrades && !grading) gradeMoves();
      return next;
    });
    setSelected(-1); setTargets([]); setBestArrow(null);
  };

  /* ---- practice-your-mistakes: replay each graded slip as a mini-puzzle
     (lichess's "learn from your mistakes"). The queue is the plies whose
     move earned mistake/blunder/miss -- your own moves for games played
     here, both sides' for pasted/shared games. Each drill parks the
     review at the position before the slip and checks whatever the
     player moves against the best move the grading pass already found;
     analysis stays off the whole time so the arrow can't leak the
     answer. */
  const practiceQueue = (moveGrades && gradeDetail) ? (() => {
    const ownGame = mode !== "replay" && !pastedGame;
    /* "Your mistakes" means yours whenever we know which side that was. Only
       a game with no known player drills both sides. */
    const yourSide = ownGame ? playerColor : reviewInfo?.you ?? null;
    const parityWanted = yourSide == null ? null : (yourSide === 1 ? 0 : 1);
    const q = [];
    moveGrades.forEach((g, i) => {
      if ((g === "mistake" || g === "blunder" || g === "miss")
        && (parityWanted == null || i % 2 === parityWanted)
        && gradeDetail.bestSans[i]) q.push(i);
    });
    return q;
  })() : [];

  const startPractice = () => {
    if (!practiceQueue.length) return;
    setAnalyzing(false); setBestArrow(null); setHintMove(null);
    setSelected(-1); setTargets([]);
    setPractice({ queue: practiceQueue, idx: 0, feedback: null, revealed: false, done: false });
    setReviewIndex(practiceQueue[0]);
  };

  const exitPractice = () => {
    setPractice(null);
    setHintMove(null);
    setSelected(-1); setTargets([]);
  };

  const practiceNext = () => {
    const p = practice;
    if (!p) return;
    setHintMove(null);
    const idx = p.idx + 1;
    if (idx >= p.queue.length) { setPractice({ ...p, done: true, feedback: null }); return; }
    setPractice({ ...p, idx, feedback: null, revealed: false });
    setReviewIndex(p.queue[idx]);
  };

  const practiceReveal = () => {
    const p = practice;
    if (!p || p.done) return;
    const best = gradeDetail?.bestSans?.[p.queue[p.idx]];
    const mv = eng.legalMoves().find(x => { try { return eng.sanOf(x) === best; } catch { return false; } });
    if (mv) setHintMove({ from: mFrom(mv), to: mTo(mv) });
    setPractice({ ...p, revealed: true });
  };

  const practiceMove = (m) => {
    const p = practice;
    if (!p || p.done) return;
    const ply = p.queue[p.idx];
    const best = gradeDetail?.bestSans?.[ply];
    let san = null;
    try { san = eng.sanOf(m); } catch { /* stale */ }
    if (san && best && san === best) {
      analysisMove(m); // plays it on the board, with the usual move sfx
      setHintMove(null);
      const last = p.idx + 1 >= p.queue.length;
      if (last) { try { audio.sfxWin(); } catch { /* audio unavailable */ } }
      setPractice({ ...p, feedback: "correct", done: last });
    } else {
      try { audio.sfxWrong(); } catch { /* audio unavailable */ }
      setSelected(-1); setTargets([]);
      setPractice({ ...p, feedback: "wrong" });
    }
  };

  /* Move-quality grading, powered by the real Stockfish worker (already
     vendored for bot moves) instead of the homemade engine's fixed-time
     search -- a grade is only as trustworthy as the engine judging it,
     and 250ms of the homemade engine was never in the same league as
     Stockfish. Full strength (no UCI_Elo limiting -- that's for playing
     weak on purpose, irrelevant to judging a move that already
     happened), MultiPV 2 so the runner-up line's score is available too
     (that's what "great" needs -- see below).

     Labels come from utils/gradeGame.js and accuracy from
     utils/reviewScoring.js, which is tuned against Chess.com's own scores. */

  /* A fixed search size rather than a time limit, so the same game grades
     the same on every device. The curves in reviewScoring were fitted at
     this size. */
  const GRADE_NODES = 100000;
  /* Enough to settle most close calls: on real games this took labels from
     67% to 86% agreement with a far deeper search. */
  const GRADE_RECHECK_NODES = 300000;

  /* One Stockfish search per grading position was slow: a 60-ply game
     meant 61 sequential ~500ms searches, and 10-16 of the leading ones
     are almost always still inside a recognized opening -- theoryPlies
     already tags them "book" regardless of what the engine says, so
     searching each individually was pure waste. This scores those
     positions off ONE real search (at the first out-of-book position)
     instead: each step back through the book range just flips the sign
     of the position after it (negamax's own convention -- whoever's
     turn it is next sees the position from the opposite side), which is
     exactly what a flat, "theory says this is fine" evaluation should
     look like, and costs nothing extra. */
  function scoreBookRange(bookBoundary, scores, scoreOk) {
    // If the one real search this range depends on itself failed, there's
    // nothing honest to backfill -- propagate "unscored" instead of a
    // fabricated 0, same as any other failed position.
    for (let k = bookBoundary - 1; k >= 0; k--) {
      scores[k] = scoreOk[bookBoundary] ? -scores[k + 1] : 0;
      scoreOk[k] = scoreOk[bookBoundary];
    }
  }

  const gradeMoves = async () => {
    /* No "already grading" check here. A new run replaces any older one
       through gradeRunIdRef below, and `grading` in this closure can be
       stale, which used to make a second game's grading silently never
       start. toggleAnalyze checks before calling. */
    const list = moveListRef.current;
    if (!list.length) return;
    const myRunId = ++gradeRunIdRef.current;
    setGrading(true);
    setGradeProgress(0);
    /* A game opened straight from the Game Review page can get here before
       the play view's own fetch of the ECO book has landed. */
    const eco = ecoData || await loadEcoOpenings().catch(() => null);
    if (gradeRunIdRef.current !== myRunId) return;
    /* FENs are cheap to build (just replaying moves, no search) -- do
       that up front so every grading search below is a single Stockfish
       call against a known position instead of re-deriving it. */
    const fenEng = createEngine();
    const fens = [fenEng.fen()];
    for (const san of list) {
      const mv = fenEng.legalMoves().find(m => fenEng.sanOf(m) === san);
      if (mv) fenEng.make(mv);
      fens.push(fenEng.fen());
    }
    /* Plies still inside known opening theory get tagged "book" instead
       of an engine grade -- shallow probes "grading" memorized theory
       was pure noise. Falls back to 0 (no book tags) if the ECO data
       chunk hasn't streamed in yet. */
    /* The opening data names some traps, like Fool's Mate. A game that ends
       inside theory still needs its final blunder graded. */
    const theoryPlies = eco ? Math.min(theoryPlyCount(list, eco), Math.max(0, list.length - 2)) : 0;
    const bookBoundary = Math.min(theoryPlies, list.length);
    const scores = new Array(list.length + 1);
    const secondScores = new Array(list.length + 1);
    const scoreOk = new Array(list.length + 1).fill(true);
    const bestSans = new Array(list.length);
    const storeSearch = (k, res) => {
      /* A rejected search (worker error, dropped connection) is not the
         same as "the engine found nothing" -- defaulting that to a score
         of 0 used to fabricate a fake blunder/brilliancy on whichever
         plies touched it. Only mark a position unscored when the search
         itself failed; a resolved-but-empty `lines` (e.g. checkmate, no
         legal moves) is a genuine result and 0 is the correct score. */
      if (res === null) scoreOk[k] = false;
      const lines = res?.lines || [];
      scores[k] = lines[0] ? lines[0].score : 0;
      secondScores[k] = lines[1] ? lines[1].score : null;
      if (k < list.length && res?.uci) {
        try {
          const probe = createEngine();
          probe.loadFen(fens[k]);
          const mv = probe.moveFromUci(res.uci);
          if (mv) bestSans[k] = probe.sanOf(mv);
        } catch { /* unknown uci -- leave bestSans[k] unset */ }
      }
    };
    for (let k = bookBoundary; k <= list.length; k++) {
      const res = await stockfishAnalyze(fens[k], { nodes: GRADE_NODES, multiPv: 2 }).catch(() => null);
      /* The board this run was grading may not even be the current game
         anymore (new game, undo, a fresh pasted PGN all bump this) --
         bail out now rather than keep burning searches, and definitely
         don't let a stale run's eventual setMoveGrades land on top of
         whatever's on screen at that point. */
      if (gradeRunIdRef.current !== myRunId) return; // whoever replaced this run owns `grading` now
      storeSearch(k, res);
      setGradeProgress(k + 1);
    }
    scoreBookRange(bookBoundary, scores, scoreOk);
    const { grades, plyScores } = gradeGame({ list, scores, secondScores, bestSans, scoreOk, theoryPlies });
    setMoveGrades(grades);
    setGradeDetail({ scores, bestSans, scoreOk, plyScores, fens });
    setGrading(false);

    /* The report is usable now, so the close calls get their deeper look in
       the background and labels firm up as a second step. Accuracy stays on
       the first pass, since its curves were fitted at that search size. */
    const unsure = plyScores.flatMap((p, i) => (p && !p.book && !p.isBest && pointsLost(p.before, p.after) >= RECHECK_LOSS ? [i, i + 1] : []));
    if (!unsure.length) return;
    setRechecking(true);
    for (const k of new Set(unsure)) {
      const res = await stockfishAnalyze(fens[k], { nodes: GRADE_RECHECK_NODES, multiPv: 2 }).catch(() => null);
      if (gradeRunIdRef.current !== myRunId) { setRechecking(false); return; }
      if (res) storeSearch(k, res);
    }
    setMoveGrades(gradeGame({ list, scores, secondScores, bestSans, scoreOk, theoryPlies }).grades);
    setGradeDetail((d) => d && { ...d, scores: [...scores], bestSans: [...bestSans] });
    setRechecking(false);
  };

  /* Stockfish tiers report score/depth/nodes/time/pv the same shape the
     homemade engine's worker does, so the .then() handler below can stay
     identical either way -- see stockfishEngine.js for why Stockfish was
     brought in for these three tiers instead of tuning search time. */
  const stockfishMove = useCallback((diff) => {
    const fen = eng.fen();
    const mainSearch = stockfishBestMove(fen, diff.stockfishElo, diff.moveTimeMs || 1000);
    return mainSearch.then(({ uci, info }) => {
      if (!uci) return null;
      let move = eng.moveFromUci(uci);
      const score = info ? info.score : 0;
      if (move && diff.blunderChance && Math.random() < diff.blunderChance) {
        const legal = eng.legalMoves();
        if (legal.length) move = legal[(Math.random() * legal.length) | 0];
      }
      if (!move) return null;
      return {
        move, san: eng.sanOf(move),
        score, depth: info ? info.depth : 0,
        nodes: info ? info.nodes : 0, time: info ? info.time : (diff.moveTimeMs || 1000),
        pv: info ? info.pv : [], book: false,
      };
    });
  }, [eng]);

  const shadowMove = useCallback(async () => {
    const started = Date.now();
    const [{ chooseShadowMove }, { newGameState }] = await Promise.all([
      import("./engine/shadowBot"), import("./utils/rankBotShadow"),
    ]);
    shadowStateRef.current ??= newGameState(loadSetting("rankBotProfile", {}));
    const ply = eng.plyCount();
    const res = await chooseShadowMove(eng.fen(), ply, shadowStateRef.current);
    const move = res && eng.moveFromUci(res.uci);
    if (!move) return null;
    const { recent, peakElo } = shadowStateRef.current;
    saveSetting("rankBotProfile", { recent, peakElo });
    setRankTestNote(res.note);
    rankLevelRef.current = res.note.trusted ? res.note.playerElo : null;
    if (ply > RANK_BOT_OPENING_PLIES) rankBotTrackedRef.current += 1;
    logRankBotMove({
      gameUid: ensureRankBotGameUidRef.current(), ply, loss: res.note.cost ?? 0,
      eloBefore: res.note.playerElo, eloAfter: res.note.playerElo, detail: res.note,
    });
    const san = eng.sanOf(move);
    /* Some searches finish so fast that the reply would feel inhuman. */
    await new Promise((r) => setTimeout(r, Math.max(0, SHADOW_MIN_THINK_MS - (Date.now() - started))));
    return {
      move, san, score: res.score,
      depth: res.info.depth, nodes: res.info.nodes, time: res.note.totalMs, pv: res.info.pv, book: false,
    };
  }, [eng]);

  const engineSearchIdRef = useRef(0);
  const engineMove = useCallback((currentMoveList) => {
    setThinking(true);
    /* The position this search was asked about, same check as onHint. New
       Game isn't disabled while the bot thinks, so without this the old
       reply landed on the fresh board: 1.h3, New Game, and 12 seconds
       later the board read "1.h3 d5" on a position where h3 was never
       played, with the turn flipped to the bot and no search running. The
       game stayed frozen until a reload. The id means only the newest
       search may clear `thinking`. */
    const askedAt = moveListRef.current;
    const searchId = ++engineSearchIdRef.current;
    const finish = () => {
      if (searchId !== engineSearchIdRef.current) return;
      setThinking(false);
      rerender();
    };
    const diff = difficultyRef.current;
    const botColorNow = -playerColorRef.current;
    const whiteEvalNow = eng.evalWhite();
    const botAdvantagePawns = (botColorNow === 1 ? whiteEvalNow : -whiteEvalNow) / 100;
    const personality = pickPersonality(gameStyleRef.current, eng.plyCount(), botAdvantagePawns);
    const searchPromise = diff.id === "rank" ? shadowMove() : diff.stockfishElo
      ? stockfishMove(diff)
      : runSearch(currentMoveList, diff.ms, diff.blunderChance || 0, { personality, useBook: diff.book, bookStyle: diff.styleBook ? gameStyleRef.current.label : null });
    searchPromise.then((res) => {
      if (moveListRef.current !== askedAt) { finish(); return; }
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
      finish();
    }).catch((e) => {
      reloadIfStaleBuild(e);
      /* A rejected search (Stockfish worker failed to boot, WASM fetch
         dropped) still has to clear `thinking` -- onSquare returns
         "blocked" the whole time it's set, so leaving it true locks the
         board for the rest of the session with "Zlegend2700 is
         calculating…" on screen permanently. runSearch (the homemade
         worker) only ever resolves; this covers the Stockfish tiers. */
      finish();
    });
  }, [eng, audio, checkGameOver, runSearch, stockfishMove, shadowMove, isCaptureMove]);
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
    const askedAt = moveListRef.current; // see engineMove
    const diff = eng.getSide() === 1 ? spectateWhiteRef.current : spectateBlackRef.current;
    const personality = pickPersonality(gameStyleRef.current, eng.plyCount(), 0);
    const searchPromise = diff.stockfishElo
      ? stockfishMove(diff)
      : runSearch(moveListRef.current, diff.ms, diff.blunderChance || 0, { personality, useBook: diff.book, bookStyle: diff.styleBook ? gameStyleRef.current.label : null });
    searchPromise.then((res) => {
      if (res && res.move && spectateModeRef.current && moveListRef.current === askedAt) {
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
    }).catch(() => {
      /* Same stuck-`thinking` hazard as engineMove above -- here it also
         stalls the bot-vs-bot loop, since the next spectateMove is only
         scheduled from inside the resolve path. */
      setThinking(false);
      rerender();
    });
  }, [eng, audio, checkGameOver, runSearch, stockfishMove, isCaptureMove]);
  const spectateMoveRef = useRef(spectateMove);
  spectateMoveRef.current = spectateMove;

  const startSpectate = (whiteIdx, blackIdx, openingId) => {
    setSiteView("play");
    maybeSaveAbandonedGame();
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
    setMoveGrades(null); setGradeDetail(null); setPractice(null); setGrading(false); setGradeProgress(0);
    setPastedGame(false);
    setMode("play");
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
    rankBotGameUidRef.current = null;
    rankBotTrackedRef.current = 0;

    /* The rating follows what the bot has measured, a little each game.
       Results say little here, since he's built to win almost every game. */
    if (rankLevelRef.current != null) {
      const next = nextRankRating(rankBotEloRef.current, rankLevelRef.current);
      rankBotEloRef.current = next;
      setRankBotElo(next);
      saveSetting("rankBotElo", next);
    }

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

  /* An abandoned Rank Bot game (player hits New mid-game) still counts
     toward the assessment if enough real moves were tracked --
     otherwise players who rarely play to checkmate would never complete
     3 "games" and never see their Elo. Finished games reset the tracked
     counter inside finishRankBotGame, so this can't double-count. */
  const maybeCountAbandonedRankGame = () => {
    if (rankBotTrackedRef.current >= RANK_BOT_MIN_TRACKED_MOVES) finishRankBotGame();
    rankBotGameUidRef.current = null;
    rankBotTrackedRef.current = 0;
  };

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
  }, [eng, audio, checkGameOver, isCaptureMove]);

  /* Returns a status string ("moved"/"promo"/"selected"/"deselected"/
     "blocked") purely so drag handling (below) can tell, synchronously,
     whether a pointerdown just picked up a piece worth dragging --
     state updates here are otherwise identical to before this return
     value was added, so the existing onClick/onKeyDown callers that
     ignore it see no behavior change. */
  const onSquare = (i64) => {
    /* A live practice drill accepts moves exactly like analysis mode
       does, but only while parked at the drill's own position with no
       exploratory moves on top -- wander off with the stepper and the
       board goes read-only again until Resume. */
    const inPractice = !!practice && !practice.done && practice.feedback !== "correct"
      && reviewIndex === practice.queue[practice.idx] && analysisExtra.length === 0;
    if ((spectateMode && !(spectatePaused && analyzing)) || (mode === "replay" && !analyzing && !inPractice) || thinking || promo) return "blocked";
    /* A reviewed game is a record, not a live game. Without this, turning
       Analyze off (or any unfinished game) fell through to the live-play
       path below, so tapping a piece played a move and woke the bot up on
       a board the player was only reading. */
    if (pastedGame && !analyzing && !inPractice) return "blocked";
    const inQuiz = !!quizOpening;
    const inPuzzle = !!activePuzzle;
    if (inPuzzle && puzzleSolved) return "blocked";
    const legal = eng.legalMoves();
    const sq120 = M64TO120[i64];
    const sideToMove = (analyzing || inQuiz || inPractice) ? eng.getSide() : playerColor;
    if (!analyzing && !inQuiz && !inPractice && (result || eng.getSide() !== playerColor)) return "blocked";
    if (inQuiz && result) return "blocked";
    if (selected >= 0) {
      const from120 = M64TO120[selected];
      const candidates = legal.filter(m => mFrom(m) === from120 && mTo(m) === sq120);
      if (candidates.length > 0) {
        if (candidates.length > 1) { setPromo({ from: from120, to: sq120, moves: candidates }); return "promo"; }
        inPuzzle ? puzzleMove(candidates[0]) : inQuiz ? quizMove(candidates[0]) : inPractice ? practiceMove(candidates[0]) : (analyzing ? analysisMove(candidates[0]) : playMove(candidates[0]));
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
  const suppressSlideRef = useRef(false);
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
    if (dropSquare >= 0) {
      /* The hand already carried this piece there, so it shouldn't also
         slide across the board from where it started. */
      suppressSlideRef.current = onSquareRef.current(dropSquare) === "moved";
    }
  };
  const onDragPointerCancelRef = useRef(null);
  onDragPointerCancelRef.current = () => {
    setDragFrom(-1); setDragOverSquare(-1); setDragPos(null);
  };

  /* Telemetry showed days of active play producing almost no rows in the
     games table -- sessions were real (rank_bot_moves proved it) but
     nearly every game got abandoned mid-way, and only finished games
     were saved. That's most of the dataset evaporating. Any real game
     with 8+ plies now gets saved with reason "Abandoned" ("*" is PGN's
     standard unfinished-game result) at every board-wiping entry point.
     Guards: only live Play-mode games (not puzzles/quiz/spectate/replay/
     pasted), not already over (game-end already saved it). Must run
     BEFORE maybeCountAbandonedRankGame wherever both fire -- that nulls
     rankBotGameUidRef, and this wants the uid so the game row stays
     linked to its rank_bot_moves. estimateRating excludes these rows
     (winner:null would otherwise count as a draw). */
  const maybeSaveAbandonedGame = () => {
    if (mode !== "play" || result || activePuzzle || quizOpening || spectateMode || pastedGame) return;
    if (moveListRef.current.length < 8) return;
    const isRankBot = difficultyRef.current.id === "rank";
    saveGame({
      difficultyLabel: difficultyRef.current.label, playerColor: playerColorRef.current, moveList: moveListRef.current,
      result: { text: "*", reason: "Abandoned" }, finalEval: eng.evalWhite(), style: gameStyleRef.current.label,
      engineVersion: ENGINE_VERSION,
      gameUid: isRankBot ? rankBotGameUidRef.current : null, rankEloAtGame: isRankBot ? rankBotEloRef.current : null,
    });
  };
  const maybeSaveAbandonedGameRef = useRef(maybeSaveAbandonedGame);
  maybeSaveAbandonedGameRef.current = maybeSaveAbandonedGame;
  const maybeCountAbandonedRankGameRef = useRef(maybeCountAbandonedRankGame);
  maybeCountAbandonedRankGameRef.current = maybeCountAbandonedRankGame;
  /* Every board-wiping in-app action (New, switch difficulty, open a
     puzzle/quiz/spectate, paste a PGN) already runs both functions above --
     but closing the tab or reloading mid-game hits none of them, so that
     session's abandoned-game row and Rank Bot assessment checkpoint never
     land. Confirmed from Supabase: 7 tracked Rank Bot sessions had 8+
     dial-adjusted moves (well past RANK_BOT_MIN_TRACKED_MOVES) but no
     matching games row at all -- the live per-move dial nudges persisted
     fine (logRankBotMove fires synchronously during play), only the
     game-end bookkeeping was missing. pagehide catches mobile Safari's
     backgrounding/swipe-away (which never fires beforeunload); both are
     wired for desktop reload/close. Same best-effort, fire-and-forget
     convention as the rest of this file -- an unload mid-request can still
     drop the network call, but that's no worse than today's coverage.

     Verified live (both events dispatched manually against a real Rank
     Bot game): both pagehide AND beforeunload can fire for the same
     close in some browsers, which would otherwise save the same
     abandoned game twice. finalizedRef is a one-shot latch for that --
     reset on pageshow (not "on next game start") so a bfcache-restored
     tab that gets played further and closed again still finalizes that
     second session too. */
  const abandonFinalizedRef = useRef(false);
  useEffect(() => {
    const finalize = () => {
      /* A saved game isn't abandoned, the player can come back to it. */
      if (liveGameRef.current || abandonFinalizedRef.current) return;
      abandonFinalizedRef.current = true;
      maybeSaveAbandonedGameRef.current();
      maybeCountAbandonedRankGameRef.current();
    };
    const onShow = () => { abandonFinalizedRef.current = false; };
    window.addEventListener("pagehide", finalize);
    window.addEventListener("beforeunload", finalize);
    window.addEventListener("pageshow", onShow);
    return () => {
      window.removeEventListener("pagehide", finalize);
      window.removeEventListener("pageshow", onShow);
      window.removeEventListener("beforeunload", finalize);
    };
  }, []);

  /* Keeps the game in progress on the device, so a refresh doesn't lose it. */
  const liveGameRef = useRef(false);
  useEffect(() => {
    if (mode === "replay") return;
    const live = mode === "play" && !result && !activePuzzle && !quizOpening && !spectateMode && !pastedGame && !rushMode && moveList.length > 0;
    liveGameRef.current = live;
    if (!live) { clearLiveGame(); return; }
    saveLiveGame({
      moves: moveList, color: playerColor, label: difficultyRef.current.label, style: gameStyle.label,
      uid: rankBotGameUidRef.current, tracked: rankBotTrackedRef.current,
    });
  }, [mode, result, activePuzzle, quizOpening, spectateMode, pastedGame, rushMode, moveList, playerColor, difficultyIdx, gameStyle]);

  /* Once on load: if it was the bot's turn it needs to move, and a game left
     for too long to resume finally counts as abandoned. */
  const resumeHandledRef = useRef(false);
  useEffect(() => {
    if (resumeHandledRef.current) return;
    resumeHandledRef.current = true;
    const { expired } = initRef.current;
    if (resumed && eng.getSide() !== resumed.color) setTimeout(() => engineMoveRef.current(resumed.moves), 300);
    if (expired?.moves?.length >= 8) {
      saveGame({
        difficultyLabel: expired.label, playerColor: expired.color, moveList: expired.moves,
        result: { text: "*", reason: "Abandoned" }, finalEval: 0, style: expired.style, engineVersion: ENGINE_VERSION,
        gameUid: expired.uid ?? null, rankEloAtGame: null,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Tears down whichever non-"real game" activity currently owns the
     board or a stray modal (puzzle/rush, spectate, opening replay/quiz,
     Blind Chess, the Ranked/Openings pickers) -- called from every "go do
     something else" entry point (enterMode, the nav bar's Home button) so
     leaving one activity can never leak its controls, a running clock, or
     its board position into whatever's opened next (the reported bug: a
     puzzle's Retry/Next/Exit row and position surviving a trip through
     Home into Play vs Bot). Left untouched: a genuine in-progress Play vs
     Bot game -- same as today, navigating away from a real game and back
     just resumes it, since none of hadBoardActivity's checks fire for it. */
  leaveActivityRef.current = () => leaveActivity();
  const leaveActivity = () => {
    if (puzzleTimeoutRef.current) { clearTimeout(puzzleTimeoutRef.current); puzzleTimeoutRef.current = null; }

    const hadBoardActivity = !!activePuzzle || spectateModeRef.current || mode === "replay" || pastedGame;
    if (pastedGame) gradeRunIdRef.current += 1;

    setActivePuzzle(null);
    setPuzzleBand(null);
    setPuzzleFeedback(null);
    setPuzzleSolved(false);
    setMissedAttempt(null);

    setRushMode(false);
    setRushResult(null);
    setRushSummaryOpen(true);
    setMissedStepIdx(0);
    setRestartCountdown(null);

    spectateModeRef.current = false;
    spectatePausedRef.current = false;
    setSpectateMode(false);
    setSpectatePaused(false);

    setQuizOpening(null);
    setQuizFeedback(null);
    setActiveOpening(null);
    setBlindOpen(false);

    if (mode === "replay") {
      history.replaceState(history.state, "", window.location.pathname + window.location.search);
      setMode("play");
      setReplayPlaying(false);
    }

    if (hadBoardActivity) {
      eng.reset();
      moveListRef.current = [];
      setPlayerColor(1);
      setSelected(-1); setTargets([]); setLastMove(null); setHintMove(null);
      setMoveList([]); setInfo(null); setResult(null); setPromo(null); setEvalCp(0); setReviewIndex(null);
      setMoveGrades(null); setGradeDetail(null); setPractice(null); setGrading(false); setGradeProgress(0);
      setPastedGame(false);
      rerender();
    }
  };

  const newGame = (color) => {
    gradeRunIdRef.current += 1;
    setThinking(false);
    setNewGameConfirm(false);
    maybeSaveAbandonedGame();
    maybeCountAbandonedRankGame();
    if (mode === "replay") {
      history.replaceState(history.state, "", window.location.pathname + window.location.search);
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
    setMissedAttempt(null);
    setSelected(-1); setTargets([]); setLastMove(null); setHintMove(null);
    setMoveList([]); setInfo(null); setResult(null); setPromo(null); setEvalCp(0); setReviewIndex(null);
    setMoveGrades(null); setGradeDetail(null); setPractice(null); setGrading(false); setGradeProgress(0);
    setPastedGame(false);
    rerender();
    if (color === -1) setTimeout(() => engineMoveRef.current([]), 60);
  };

  const startOpening = (opening) => {
    setSiteView("play");
    setActiveOpening(opening);
    setPlayerColor(opening.for === "black" ? -1 : 1);
    setMode("replay");
    setReplayFull(opening.moves);
    setReplayIndex(0);
    setReplayPlaying(false);
  };

  const startQuiz = (opening) => {
    maybeSaveAbandonedGame();
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
  }, [eng, audio, quizOpening, checkGameOver, isCaptureMove]);

  const puzzlesInBand = (band) => band ? pz.PUZZLES.filter(p => p.rating >= band.min && p.rating < band.max) : pz.PUZZLES;

  const startPuzzle = (puzzle) => {
    /* Every caller derives its argument from the puzzle pool, which is
       empty until the puzzles chunk finishes streaming in (and
       dailyPuzzle returns null for an empty pool). The UI gates on
       puzzlesReady, so this is belt-and-braces -- but without it a miss
       lands as a TypeError on .fen below rather than a no-op. */
    if (!puzzle) return;
    maybeSaveAbandonedGame();
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

  /* Draws a random puzzle this run hasn't served yet, falling back to
     allowing repeats once a band is exhausted (200 per band, so only a
     very long run gets there). Returns null on a genuinely empty pool
     rather than indexing undefined -- can't happen with the shipped
     puzzle set, but startPuzzle dereferences .fen immediately and a
     future data change shouldn't be able to turn that into a crash. */
  const pickUnseenPuzzle = (pool) => {
    if (!pool.length) return null;
    const fresh = pool.filter(p => !rushSeenRef.current.has(p.id));
    const from = fresh.length ? fresh : pool;
    const puzzle = from[(Math.random() * from.length) | 0];
    rushSeenRef.current.add(puzzle.id);
    return puzzle;
  };

  const startRush = (seconds) => {
    setSiteView("play");
    rushSolvedRef.current = 0;
    rushMistakesRef.current = 0;
    rushBandIdxRef.current = 0;
    rushStreakRef.current = 0;
    rushMissedRef.current = [];
    rushSeenRef.current = new Set();
    setRushSolved(0);
    setRushMistakes(0);
    setRushBandIdx(0);
    setRushMissed([]);
    setRushResult(null);
    setRushSummaryOpen(true);
    setMissedStepIdx(0);
    setRestartCountdown(null);
    setMissedAttempt(null);
    setRushDuration(seconds);
    setRushTimeLeft(seconds);
    setRushMode(true);
    const pool = puzzlesInBand(pz.RATING_BANDS[0]);
    startPuzzle(pickUnseenPuzzle(pool));
  };

  const nextRushPuzzle = () => {
    const pool = rushPool();
    startPuzzle(pickUnseenPuzzle(pool));
  };

  const finishRush = (reason) => {
    setRushResult({ reason, solved: rushSolvedRef.current });
    setRushSummaryOpen(true);
    /* Snapshot so a later missed-puzzle attempt (which loads a different
       position onto this same shared engine) can be undone -- see
       exitMissedAttempt. */
    rushFinalMoveListRef.current = moveListRef.current;
    /* 0-solve runs (opened a duration once, bailed or timed out cold)
       aren't scores -- a third of logged runs were these, pure noise in
       the leaderboard data. No Timer runs are excluded outright: unlimited
       time makes "most solved" meaningless as a comparison, and
       duration_seconds is NOT NULL in the rush_scores table anyway. */
    /* displayNameRef, not the `displayName` state directly: finishRush is
       reached from puzzleMove, a useCallback that doesn't list
       displayName in its deps -- so a player who renames themselves
       mid-run would otherwise submit the name they had when that
       callback was last memoized. Same ref the Rank Bot sync already
       uses for the identical reason. */
    if (rushSolvedRef.current > 0 && rushDuration != null) submitRushScore({ duration: rushDuration, solved: rushSolvedRef.current, displayName: displayNameRef.current });
    /* Personal best per duration, shown on the heartbreak screen instead
       of the lifetime total. */
    const bestKey = rushDuration == null ? "none" : String(rushDuration);
    setRushBestMap(prev => {
      if (rushSolvedRef.current <= (prev[bestKey] || 0)) return prev;
      const next = { ...prev, [bestKey]: rushSolvedRef.current };
      saveSetting("rushBestByDuration", next);
      return next;
    });
    if (reason === "time") { try { audio.sfxTimeUp(); } catch { /* audio unavailable */ } }
  };

  const retryRush = () => startRush(rushDuration);

  /* Try again's 2-second "get ready" beat -- startRush() itself resets
     restartCountdown back to null, so this doesn't need to. */
  const beginRestartCountdown = () => {
    if (restartCountdown != null) return;
    setRestartCountdown(2);
  };
  useEffect(() => {
    if (restartCountdown == null) return;
    if (restartCountdown === 0) { retryRush(); return; }
    const t = setTimeout(() => setRestartCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restartCountdown]);

  /* Swipe support for the missed-puzzle stepper, mobile and desktop both
     via Pointer Events (one code path covers touch/mouse/pen) rather than
     separate touch handlers. Attached to the whole card, not just the
     arrow row, so a swipe anywhere on it works, same as any carousel.
     Small movements (a tap on the rating button itself) never cross
     SWIPE_THRESHOLD, so they still reach that button's own onClick. */
  const SWIPE_THRESHOLD = 40;
  const missedSwipeStartRef = useRef(null);
  const onMissedSwipeStart = (e) => { missedSwipeStartRef.current = e.clientX; };
  const onMissedSwipeEnd = (e) => {
    if (missedSwipeStartRef.current == null) return;
    const dx = e.clientX - missedSwipeStartRef.current;
    missedSwipeStartRef.current = null;
    if (dx > SWIPE_THRESHOLD) setMissedStepIdx(i => Math.max(0, i - 1));
    else if (dx < -SWIPE_THRESHOLD) setMissedStepIdx(i => Math.min(rushMissed.length - 1, i + 1));
  };

  /* Actually leaving Puzzle Rush (the "Puzzles" board-control button once
     a run has ended, or Escape/backdrop before a run's first result ever
     lands). Deliberately does NOT call exitPuzzle()/newGame(1) -- that
     would reset the board into a fresh Play vs Bot game, "portaling" the
     player out of Puzzles entirely right after a rush ends. Clearing the
     rush flags and sending them back to the Sweetheart puzzles page (not
     the board) lets them immediately pick Daily/Ranked/Rush again. */
  const exitRush = () => {
    leaveActivity();
    setSiteView("puzzlesHome");
  };

  /* Closing the heartbreak-screen Modal (X/backdrop/Escape) -- unlike
     exitRush above, this never touches rushMode/rushResult, so the final
     position stays on the board and the Results control can bring the
     summary back. */
  const hideRushSummary = () => setRushSummaryOpen(false);

  const resetRushCounter = () => {
    setRushLifetime(0);
    rushLifetimePrevRef.current = 0;
    saveSetting("rushLifetimeSolved", 0);
  };

  /* Attempts a puzzle missed during the last rush. Deliberately does NOT
     touch rushMode/rushResult (unlike a normal Daily/Ranked puzzle) -- the
     rush session stays alive in the background so Exit can drop straight
     back into the heartbreak screen with the other missed puzzles still
     there, rather than ending the session the way leaving a puzzle
     normally would. */
  const reviewMissedPuzzle = (puzzle) => {
    setMissedAttempt(puzzle);
    setRushSummaryOpen(false);
    startPuzzle(puzzle);
  };

  /* Exit from a missed-puzzle attempt -- restores the board to the actual
     position the rush ended on (startPuzzle above overwrote it with the
     missed puzzle) and reopens the heartbreak screen. */
  const exitMissedAttempt = () => {
    setMissedAttempt(null);
    eng.reset();
    const { applied } = replayIntoEngine(eng, rushFinalMoveListRef.current);
    moveListRef.current = rushFinalMoveListRef.current;
    setMoveList(rushFinalMoveListRef.current);
    if (applied.length) {
      const last = applied[applied.length - 1];
      setLastMove({ from: mFrom(last), to: mTo(last) });
    } else {
      setLastMove(null);
    }
    setEvalCp(eng.evalWhite());
    setSelected(-1); setTargets([]);
    setPosVersion(v => v + 1);
    setRushSummaryOpen(true);
    rerender();
  };

  /* Confetti + fanfare every 50 lifetime rush solves. Driven off the
     lifetime counter itself (not the per-run solved count) via a
     prev-value ref, so it fires exactly once per crossing regardless of
     how state batching groups the surrounding updates. */
  useEffect(() => {
    if (rushLifetime > rushLifetimePrevRef.current && rushLifetime % 50 === 0) {
      setRushMilestone(m => m + 1);
      try { audio.sfxWin(); } catch { /* audio unavailable */ }
    }
    rushLifetimePrevRef.current = rushLifetime;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rushLifetime]);

  /* Escape closes whichever modal is open, mirroring each one's own
     backdrop-click behavior (e.g. Piece Designs -> back to Settings). */
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;
      if (pieceDesignsOpen) { setPieceDesignsOpen(false); setSettingsOpen(true); }
      else if (boardColorsOpen) { setBoardColorsOpen(false); setSettingsOpen(true); }
      else if (settingsOpen) closeSettings();
      else if (nameEditOpen) setNameEditOpen(false);
      else if (shareLinkFallback) setShareLinkFallback(null);
      else if (newGameConfirm) setNewGameConfirm(false);
      else if (rushMode && rushResult && rushSummaryOpen) hideRushSummary();
      else if (blindOpen) setBlindOpen(false);
      else if (musicOpen) closeMusic();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pieceDesignsOpen, boardColorsOpen, settingsOpen, nameEditOpen, shareLinkFallback, newGameConfirm, rushMode, rushResult, rushSummaryOpen, blindOpen, musicOpen]);

  /* Modal accessibility, applied generically rather than per-modal: this
     app has ~15 separate .promoOv/.promoBox blocks (one per open-state
     boolean) rather than one shared <Modal> component, so wiring a ref
     through each individually would be a lot of repetitive plumbing for
     the same fix. Querying the live DOM instead means every current AND
     future modal gets this for free with no per-modal changes needed.

     Two concerns, handled separately since they have different triggers:
     - Tab-trap: a keydown listener attached once, querying whichever
       .promoBox is actually mounted at press-time -- always current, no
       stale closures.
     - Scroll-lock + initial-focus + focus-restore: these must fire only
       on the OPEN/CLOSE transition, not every render, or a modal
       containing a text input would steal focus back to itself on every
       keystroke (each keystroke re-renders App). modalOpenRef tracks
       "was a modal open as of the last time this ran" so the effect body
       runs every render (cheap: one querySelector) but only acts when
       that boolean actually flips. */
  const modalOpenRef = useRef(false);
  const modalPrevFocusRef = useRef(null);
  const FOCUSABLE_SEL = 'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== "Tab") return;
      const box = document.querySelector(".promoOv .promoBox");
      if (!box) return;
      const focusables = box.querySelectorAll(FOCUSABLE_SEL);
      if (!focusables.length) return;
      const first = focusables[0], last = focusables[focusables.length - 1];
      if (!box.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  useEffect(() => {
    const box = document.querySelector(".promoOv .promoBox");
    if (box) {
      /* role/aria-modal/aria-label set programmatically here rather than
         in each of the ~15 individual modal blocks -- same generic
         approach as the trap/lock above. aria-label reuses whatever
         heading text the modal already renders (.boxHead, or the plain
         "Your Name" style header some modals use) so no modal needs an
         id wired up for aria-labelledby. */
      box.setAttribute("role", "dialog");
      box.setAttribute("aria-modal", "true");
      const heading = box.querySelector(".boxHead, h1, h2, h3");
      if (heading) box.setAttribute("aria-label", heading.textContent.trim());
    }
    if (box && !modalOpenRef.current) {
      modalOpenRef.current = true;
      modalPrevFocusRef.current = document.activeElement;
      document.body.style.overflow = "hidden";
      box.querySelector(FOCUSABLE_SEL)?.focus();
    } else if (!box && modalOpenRef.current) {
      modalOpenRef.current = false;
      document.body.style.overflow = "";
      modalPrevFocusRef.current?.focus?.();
      modalPrevFocusRef.current = null;
    }
  });

  /* Puzzle Rush countdown -- ticks once a second while a rush is live and
     hasn't already ended from 3 mistakes, pausing entirely once rushResult
     is set so a mistake-triggered end and a time-triggered end can't race.
     leaveActivity() clears rushMode on every real "navigate away" path
     (nav bar Home, enterMode, exitRush, ...), which already stops this --
     the siteView check is a second line of defense so a future navigation
     path that forgets to call it can't leave the clock (and eventually
     finishRush, with its leaderboard submit) running against a board the
     player isn't even looking at. */
  useEffect(() => {
    if (!rushMode || rushResult || rushDuration == null || siteView !== "play") return;
    if (rushTimeLeft <= 0) { finishRush("time"); return; }
    const t = setTimeout(() => setRushTimeLeft(s => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rushMode, rushResult, rushTimeLeft, rushDuration, siteView]);

  const puzzleMove = useCallback((m) => {
    const verdict = judgePuzzleMove(eng, activePuzzle, moveListRef.current, m);
    const attemptedSan = verdict.san;
    if (!verdict.ok) {
      try { audio.sfxWrong(); } catch { /* audio unavailable */ }
      setSelected(-1); setTargets([]);
      if (rushMode) {
        rushMistakesRef.current += 1;
        setRushMistakes(rushMistakesRef.current);
        rushMissedRef.current = [...rushMissedRef.current, activePuzzle];
        setRushMissed(rushMissedRef.current);
        rushStreakRef.current = 0;
        rushBandIdxRef.current = Math.max(0, rushBandIdxRef.current - 1);
        setRushBandIdx(rushBandIdxRef.current);
        if (rushMistakesRef.current >= 3) {
          setPuzzleFeedback("Wrong — that's 3 misses!");
          puzzleTimeoutRef.current = setTimeout(() => finishRush("mistakes"), 400);
        } else {
          setPuzzleFeedback("Not quite — next puzzle!");
          puzzleTimeoutRef.current = setTimeout(() => nextRushPuzzle(), 700);
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

    if (verdict.solved) {
      setPuzzleSolved(true);
      try { audio.sfxCapture(); } catch { /* audio unavailable */ }
      const daily = dailyPuzzle(pz.PUZZLES);
      if (daily && activePuzzle.id === daily.id) {
        setDailySolvedDate(todayKey());
        saveSetting("dailyPuzzleSolvedDate", todayKey());
        const streak = nextStreak(dailyStreak, utcDay());
        setDailyStreak(streak);
        saveSetting("dailyStreak", streak);
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
        setRushLifetime(n => {
          const next = n + 1;
          saveSetting("rushLifetimeSolved", next);
          return next;
        });
        puzzleTimeoutRef.current = setTimeout(() => nextRushPuzzle(), 500);
      }
      rerender();
      return;
    }
    const replySan = verdict.reply;
    puzzleTimeoutRef.current = setTimeout(() => {
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
    /* finishRush and nextRushPuzzle read refs, so a stale copy behaves the same. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eng, audio, activePuzzle, rushMode, pz, dailyStreak, isCaptureMove]);

  const undo = () => {
    if (mode === "replay" || pastedGame || thinking || result || eng.plyCount() === 0) return;
    gradeRunIdRef.current += 1;
    setGrading(false);
    let n;
    if (quizOpening) n = 1; // quiz: the player supplies every ply, so always step back exactly one
    else if (eng.getSide() === playerColor && eng.plyCount() >= 2) n = 2; else n = 1;
    /* A full player+bot pair going back past the opening stops counting
       toward the game's tracked moves. */
    if (n === 2 && difficultyRef.current.id === "rank" && moveListRef.current.length - n >= RANK_BOT_OPENING_PLIES) {
      rankBotTrackedRef.current = Math.max(0, rankBotTrackedRef.current - 1);
    }
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
    /* Remember which position the hint was asked about. Every path that
       changes the board (a move, undo, New, loading a puzzle or a
       pasted PGN, leaving an activity) reassigns moveListRef.current to
       a brand-new array, so an identity check is enough to tell that
       this answer is now stale.
       Without it the search had no cancellation at all and its arrow
       landed on whatever was on the board when it returned -- confirmed
       by playing 1.d4 d5 2.Bf4 Bf5, pressing Best Move and immediately
       starting a New Game: three seconds later b1-c3 lit up on the
       fresh board, advice for a game that no longer existed. Same
       stale-result guard gradeMoves and the Rank Bot probe already
       have; this was the one search path missing one. */
    const askedAt = moveListRef.current;
    runSearch(moveList, 800, 0, { personality: BALANCED, useBook: true }).then((res) => {
      setHinting(false); // always clear, even when discarding the result
      if (moveListRef.current !== askedAt) return;
      if (res && res.move) setHintMove({ from: mFrom(res.move), to: mTo(res.move) });
    });
  };

  const onDifficultyChange = (idx) => {
    /* difficultyRef still points at the outgoing tier here (it's
       reassigned on render), so an in-progress Rank Bot game being
       switched away from can still be counted. */
    if (difficultyRef.current.id === "rank" && DIFFICULTIES[idx].id !== "rank") maybeCountAbandonedRankGame();
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
    /* Only opening the player should load a playlist, not a change to the source. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [musicOpen]);
  /* The theme is a single track meant to play indefinitely rather than
     stop dead after ~30s -- native loop restarts it itself and never
     fires "ended" at all, so the multi-track auto-advance below doesn't
     need a special case for playlists of length 1. */
  useEffect(() => { mp3Audio.loop = musicSource === THEME_ID; }, [musicSource, mp3Audio]);
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
    /* Only a new track should reload the audio, and mp3Audio never changes. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    /* timeupdate fires ~4x/second the whole time music plays (and the
       theme autoplays), re-rendering the entire app each tick -- but the
       progress bar it drives is only visible inside the Juice Box modal,
       so skip the state write entirely while that's closed. */
    const onTime = () => { if (musicOpenRef.current) setMp3CurrentTime(mp3Audio.currentTime); };
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
  }, [mp3Audio]);
  /* "visitedBefore" needs to be unconditional -- it now also drives
     HomePage's welcome-beat line (see isFirstVisitRef above), not just
     autoplay-arming, so it has to flip for every first-time visitor, not
     only ones who still had chiptune as their music source. */
  useEffect(() => {
    saveSetting("visitedBefore", true);
  }, []);
  /* Cues the theme track (metadata + src only, not full playback) as soon
     as a genuine first-time visitor loads the page, so it's ready to go
     the instant they satisfy the browser's user-gesture requirement for
     audio-with-sound autoplay below -- without this, the first click would
     have to wait on a fresh Storage round trip before anything could play. */
  useEffect(() => {
    if (!themeAutoplayArmedRef.current) return;
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
    /* Runs only when the volume or player changes. The helpers it calls are rebuilt every render. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* Backgrounding the tab (swiped away, phone locked, switched apps) is
     supposed to keep music playing -- that's the whole point of it being
     music -- but browsers auto-suspend AudioContexts and throttle
     setInterval timers while hidden, which is what "music breaking after
     leaving the app" actually was: the chiptune engine's scheduler falls
     behind and either stays silent or bursts through its missed steps at
     once (see chiptune.js's resumeIfNeeded), and the mp3 engine's own
     GainNode context can end up suspended too. Nothing here pauses
     anything ON hide -- that's the point, it should keep going in the
     background -- this only repairs state once the tab is visible again. */
  useEffect(() => {
    const onVisible = () => {
      if (document.hidden) return;
      if (musicOn) audio.resumeIfNeeded();
      if (mp3PlayingRef.current) {
        resumeMp3Gain();
        if (mp3Audio.paused) mp3Audio.play().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [musicOn]);
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
  /* Blind Mode reads moves aloud over speechSynthesis -- background music
     talking over it at the same time would make both unintelligible, so
     the two are mutually exclusive the same way switching musicSource
     already pauses whichever engine was playing. Unlike that case,
     leaving Blind Mode should hand playback back rather than just
     staying off, so this remembers which engine (if either) it paused
     and resumes only that one. Background music itself is untouched by
     any of this -- see the visibilitychange effect above -- this is
     purely about not overlapping with Blind Mode's own audio. */
  const blindPausedMusicRef = useRef(null);
  useEffect(() => {
    if (blindOpen) {
      if (musicSource === "chiptune" && musicOn) {
        audio.toggle();
        setMusicOn(false);
        blindPausedMusicRef.current = "chiptune";
      } else if (musicSource !== "chiptune" && mp3PlayingRef.current) {
        mp3Audio.pause();
        setMp3Playing(false);
        blindPausedMusicRef.current = "mp3";
      } else {
        blindPausedMusicRef.current = null;
      }
    } else if (blindPausedMusicRef.current) {
      if (blindPausedMusicRef.current === "chiptune") {
        setMusicOn(audio.toggle());
      } else {
        resumeMp3Gain();
        mp3Audio.play().catch(() => {});
        setMp3Playing(true);
      }
      blindPausedMusicRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blindOpen]);
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
  const [sfxOn, setSfxOn] = useState(() => loadSetting("sfxOn", true));
  const toggleSfx = () => {
    const on = !sfxOn;
    setSfxOn(on);
    audio.setSfxOn(on);
    saveSetting("sfxOn", on);
    if (on) audio.sfxMove();
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
  /* Parses, validates and loads a PGN into review mode, for both pasted and
     saved games. Returns { ok: false, error } when nothing could be loaded,
     or { ok: true, note } where note is a warning worth showing the player.
     `side` is which colour sits at the bottom. A Chess.com export says who
     exported it; anything else starts from White and can be flipped. */
  const loadPgnText = (text, { side = null, info = null } = {}) => {
    const problem = describePasteProblem(text);
    if (problem) return { ok: false, error: problem };
    const tokens = parsePgnMoves(text);
    if (!tokens.length) return { ok: false, error: "Couldn't find any moves in that text." };
    const tempEng = createEngine();
    const { applied, sans } = replayForeignPgn(tempEng, tokens);
    if (!applied.length) return { ok: false, error: "That doesn't look like a chess game. Check that you copied the game's PGN text." };
    gradeRunIdRef.current += 1;
    maybeSaveAbandonedGame();
    maybeCountAbandonedRankGame();
    eng.reset();
    replayIntoEngine(eng, sans);
    moveListRef.current = sans;
    setMoveList(sans);
    setThinking(false);
    const headers = parsePgnHeaders(text);
    /* Kept apart from playerColor, which the flip button changes. */
    const you = side ?? exporterSide(headers);
    setPlayerColor(you ?? 1);
    setReviewInfo({ ...(info || reviewInfoFromHeaders(headers)), you });
    setActiveOpening(null); setQuizOpening(null); setActivePuzzle(null);
    setSpectateMode(false); spectateModeRef.current = false;
    setSelected(-1); setTargets([]); setPromo(null); setHintMove(null); setInfo(null);
    setAnalysisExtra([]); setBestArrow(null);
    const last = applied[applied.length - 1];
    setLastMove({ from: mFrom(last), to: mTo(last) });
    setEvalCp(eng.evalWhite());
    setMoveGrades(null); setGradeDetail(null); setPractice(null); setGrading(false); setGradeProgress(0);
    setResult(checkGameOver());
    setPastedGame(true);
    setMode("play");
    setReviewIndex(sans.length);
    setAnalyzing(true);
    gradeMoves();
    rerender();
    const games = countPgnGames(text);
    const note = applied.length < tokens.length
      ? `Loaded ${applied.length} of ${tokens.length} moves. The rest didn't match a legal game.`
      : games > 1 ? `That file has ${games} games. Reviewing the first one.` : null;
    return { ok: true, note };
  };

  const finishReviewLoad = (r) => {
    if (!r.ok) return r;
    setSiteView("play");
    if (r.note) {
      setPgnToast(r.note);
      setTimeout(() => setPgnToast(null), 7000);
    }
    return r;
  };
  const reviewPastedGame = (text) => finishReviewLoad(loadPgnText(text));
  /* Saved games know which side the player was on, so they open from that
     side, the way Chess.com keeps you at the bottom by default. */
  const reviewSavedGame = (game) => {
    const you = displayNameRef.current || "You";
    return finishReviewLoad(loadPgnText(game.pgn, {
      side: game.playerColor,
      info: {
        white: game.playerColor === 1 ? you : game.opponent,
        black: game.playerColor === 1 ? game.opponent : you,
        outcome: game.reason,
      },
    }));
  };
  const reviewReturnRef = useRef("home");
  const openReviewPage = () => {
    reviewReturnRef.current = siteView === "review" ? reviewReturnRef.current : siteView;
    setSiteView("review");
  };


  /* Three-tier fallback, in order of "works well on the phone this is
     most likely being tapped from":
     1. navigator.share -- the native share sheet. Only real option that
        works reliably from an installed home-screen PWA on iOS; also
        just the better UX on any mobile browser.
     2. Clipboard write -- fine on desktop, but mobile Safari can throw
        "Document is not focused" here depending on what triggered the
        tap, and it silently fails in some in-app browsers (Instagram/
        TikTok webviews) that don't grant clipboard permissions at all.
     3. A real modal showing the link as selectable text. NOT
        window.prompt() -- that's a no-op in iOS standalone/home-screen
        PWA mode (this app is installable), so on exactly the devices
        most likely to reach this fallback, prompt() would show nothing
        and the player would think Share was just broken. */
  const onShare = async () => {
    const hash = encodeGame(playerColor, moveList);
    const url = `${window.location.origin}${window.location.pathname}#g=${hash}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Zlegend's Chess Bot", text: "Check out this game!", url });
        return;
      } catch (e) {
        if (e && e.name === "AbortError") return; // player closed the native share sheet
        // any other failure (unsupported target, permission, etc.) -- fall through
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareToast("Link copied — send it to a viewer!");
      setTimeout(() => setShareToast(null), 2500);
    } catch {
      setShareLinkFallback(url);
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
  useEffect(() => {
    if (!result || spectateMode || activePuzzle || rushMode || pastedGame) { setBotLine(null); return; }
    setBotLine(pickPostGameLine({
      result,
      playerWon: result.winner === playerColor,
      isDraw: result.winner === 0,
      youDiff,
      styleLabel: gameStyle.label,
      difficultyLabel: difficultyRef.current.label,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);
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
  /* Stepping back through the moves puts the king back. */
  const showMateFx = !!mateFx && reviewIndex === moveList.length;
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
            {p !== EMPTY && !isDragFrom && !(showMateFx && mateFx.sq === i64) && <img className={"pc " + (p > 0 ? "w" : "b") + (pieceSetId === "sweetheart" && Math.abs(p) === 6 ? " kingBoost" : "") + (pieceSetId === "sweetheart" && p === -2 ? " knightBoost" : "")} src={pieceImgSrc(Math.abs(p), p > 0)} alt="" draggable="false" />}
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

  /* GamePanel's Analysis tab content -- unchanged logic from before the
     Scoresheet/Bot Analysis boxes merged into one tabbed card, just
     computed here instead of inline JSX so it can be handed to GamePanel
     as a prop. Still five mutually-exclusive real states (puzzle/rush,
     quiz, opening replay, normal bot analysis), nothing stubbed. */
  const analysisLabel = activePuzzle ? (rushMode ? "Rush" : "Puzzle") : quizOpening ? "Quiz" : activeOpening ? "Opening" : "Analysis";
  /* Shared by ExploreDock and BottomNav so the currently-open tool
     highlights consistently on both. Only tracks tools the nav can
     actually open now (Home/Login/Music/Settings) -- Openings/Puzzles/
     Spectate/Blind Chess still have their own open state elsewhere for
     the home-page mode grid, they just don't light up this nav. Home
     itself is never "active" here since clicking it navigates away from
     this screen (ExploreDock/BottomNav only render in the play view). */
  /* The tab itself is already named (Rush/Puzzle/Quiz/Opening/Analysis via
     analysisLabel), so no state repeats a heading inside its own content
     anymore -- each shows one small context chip where it earns its place,
     then the actual text. Rush deliberately shows no clock/score here:
     the rushHud card above the board already owns those numbers, and
     mirroring them in a second spot was pure clutter. */
  const analysisChip = (text, tone = "dim") => (
    <span className={`inline-flex w-fit items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold tracking-wide ${
      tone === "gold" ? (sweetheart ? "bg-sh-lgold/15 text-sh-lgold" : "bg-yellow/12 text-yellow")
      : tone === "cyan" ? (sweetheart ? "bg-sh-lteal/15 text-sh-lteal" : "bg-cyan/12 text-cyan")
      : (sweetheart ? "bg-sh-rose/12 " + uiT.dimText : "bg-violet/15 text-dim")
    }`}>{text}</span>
  );
  const analysisHint = (text) => <p className={"m-0 text-[13px] leading-relaxed " + uiT.mutedLabel}>{text}</p>;
  const playerAdvantageCp = playerColor === 1 ? evalCp : -evalCp;
  /* Post-game "report card": once Analyze has graded the moves, tally
     each side's brilliants/mistakes/etc so the player gets a chess.com-
     style game summary instead of having to scroll the scoresheet
     counting ?? marks by hand. White's moves are the even plies. */
  const gradeReport = (reviewing && moveGrades) ? (() => {
    /* Pasted/shared games are someone else's moves -- plain White/Black
       there, You/Bot only for games actually played here. */
    const ownGame = mode !== "replay" && !pastedGame;
    const whiteIsYou = ownGame && playerColor === 1;
    const blackIsYou = ownGame && playerColor === -1;
    const tally = (parity) => {
      const counts = { brilliant: 0, great: 0, best: 0, excellent: 0, good: 0, book: 0, inaccuracy: 0, miss: 0, mistake: 0, blunder: 0 };
      moveGrades.forEach((g, i) => { if (g && i % 2 === parity) counts[g] += 1; });
      return counts;
    };
    /* There used to be a "~N rated play" figure here too, averaging Rank
       Bot's loss->implied-Elo mapping over the game. It read ~2000 for an 833
       player: a single clean move counts as 3000, so the average runs far too
       high. That mapping was built to nudge a dial, not to be averaged into a
       rating, so it stays off until it's calibrated on real games. */
    const sideStats = (parity) => {
      if (!gradeDetail) return null;
      const acc = sideAccuracy(gradeDetail.plyScores.filter((m, i) => m && i % 2 === parity));
      return acc == null ? null : { acc: Math.round(acc) };
    };
    return {
      cols: [
        { label: whiteIsYou ? "You" : blackIsYou ? "Bot" : "White", counts: tally(0), stats: sideStats(0) },
        { label: blackIsYou ? "You" : whiteIsYou ? "Bot" : "Black", counts: tally(1), stats: sideStats(1) },
      ],
    };
  })() : null;
  const analysisContent = activePuzzle ? (
    missedAttempt ? (
      /* Attempting a puzzle from the heartbreak screen's missed-puzzle
         stepper -- Analyze lives in the Retry/Analyze/Exit row under the
         board here, not embedded in this tab, so this stays a plain hint
         like a normal Daily/Ranked attempt. */
      <div className="flex flex-col gap-2.5">
        {analysisChip(`Rated ${missedAttempt.rating}`, "gold")}
        {analysisHint(puzzleSolved ? "Solved! Nice work." : puzzleFeedback || `Find the best move for ${eng.getSide() === 1 ? "White" : "Black"}.`)}
      </div>
    ) : rushMode && rushResult ? (
      /* The run is over but the final puzzle's position is still on the
         board (see rushSummaryOpen/canAnalyze) -- the "find the best
         move" prompt no longer applies, so this swaps to the same
         Analyze toggle every other analyzable mode gets instead. */
      <div className="flex flex-col gap-2.5">
        {analysisChip("Rush over", "gold")}
        {analysisHint("Take a look at the final position, or bring the results back up.")}
        <button
          onClick={toggleAnalyze}
          className="flex h-9 w-fit items-center gap-1.5 rounded-xl border px-3.5 text-xs font-bold tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
          style={analyzing
            ? { borderColor: "#F06BAE80", background: "#F06BAE1F", color: "var(--sh-rose)" }
            : { borderColor: "#F06BAE3D", background: "#1D0A22CC", color: "var(--sh-dim)" }}
        >
          {analyzing ? (
            <img src="/sweetheart-sprite.webp" alt="" className={"shAnalyzeSpinner" + (analysisBusy ? " busy" : "")} />
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2 9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5L12 2z" />
            </svg>
          )}
          {analyzing ? (analysisBusy ? "Analyzing…" : "Analyzing") : "Analyze"}
        </button>
      </div>
    ) : rushMode ? (
      <div className="flex flex-col gap-2.5">
        {analysisChip(<><BoltIcon size={11} />{pz.RATING_BANDS[rushBandIdx]?.label || ""}</>, "gold")}
        {analysisHint(puzzleFeedback || `Find the best move for ${eng.getSide() === 1 ? "White" : "Black"}.`)}
      </div>
    ) : (
      <div className="flex flex-col gap-2.5">
        {analysisChip(`Rated ${activePuzzle.rating}`, "gold")}
        {analysisHint(puzzleSolved ? "Solved! Nice work." : puzzleFeedback || `Find the best move for ${eng.getSide() === 1 ? "White" : "Black"}.`)}
      </div>
    )
  ) : quizOpening ? (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {analysisChip(quizOpening.name, "cyan")}
        {analysisChip(`Move ${Math.min(moveList.length + 1, quizOpening.moves.length)} of ${quizOpening.moves.length}`)}
      </div>
      {analysisHint(quizFeedback || `Play ${eng.getSide() === 1 ? "White" : "Black"}'s next move from memory.`)}
    </div>
  ) : activeOpening ? (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {analysisChip(activeOpening.name, "cyan")}
        {analysisChip(activeOpening.eco)}
      </div>
      {analysisHint(replayIndex === 0 ? activeOpening.summary : activeOpening.steps[replayIndex - 1])}
    </div>
  ) : (
    <div className="flex flex-col gap-3">
      {grading && (
        <div className="flex flex-col gap-1.5">
          <div className={"text-[12px] " + uiT.dimText}>Grading moves… {gradeProgress}/{moveList.length}</div>
          <div className={"h-1.5 w-full overflow-hidden rounded-full " + (sweetheart ? "bg-sh-rose/20" : "bg-violet/20")}>
            <div
              className={"h-full rounded-full transition-[width] duration-200 ease-out " + (sweetheart ? "bg-sh-lteal" : "bg-cyan")}
              style={{ width: `${Math.min(100, (gradeProgress / moveList.length) * 100)}%` }}
            />
          </div>
        </div>
      )}
      {gradeReport && !grading && (
        <div className={`rounded-xl border p-3 ${sweetheart ? "border-sh-rose/24 bg-sh-lcard/70" : "border-violet/24 bg-[#150C2466]"}`}>
          <div className={"mb-2 text-[10px] font-bold uppercase tracking-[0.14em] " + uiT.dimText}>Game report</div>
          {gradeReport.cols.some(c => c.stats) && (
            <div className="mb-2.5 grid grid-cols-2 gap-2">
              {gradeReport.cols.map((col) => (
                <div key={col.label} className={"rounded-lg px-2.5 py-2 text-center " + uiT.panelBg}>
                  <div className={"text-[10px] font-bold uppercase tracking-[0.12em] " + uiT.dimText}>{col.label}</div>
                  <div className={"mt-0.5 text-xl font-bold leading-none " + uiT.interactiveText}>{col.stats ? `${col.stats.acc}%` : "—"}</div>
                  <div className={"mt-1 text-[10px] " + uiT.dimText}>accuracy</div>
                </div>
              ))}
            </div>
          )}
          {gradeDetail && (
            <div className="mb-2.5">
              <EvalGraph scores={gradeDetail.scores} grades={moveGrades} current={reviewIndex} onSeek={setReviewIndex} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            {gradeReport.cols.map((col) => (
              <div key={col.label}>
                <div className={"mb-1.5 text-xs font-bold " + uiT.ink}>{col.label}</div>
                <div className="flex flex-col gap-1">
                  {Object.entries(col.counts).map(([g, n]) => (
                    <div key={g} className="flex items-center justify-between gap-1 text-[11px]">
                      <span className={"flex items-center gap-1 capitalize " + uiT.mutedLabel}>
                        <b style={{ color: GRADE_COLOR[g], minWidth: 14 }}>{GRADE_TAG[g]}</b>{g}
                      </span>
                      <span className={n > 0 ? "font-bold " + uiT.ink : uiT.dimText}>{n}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {practiceQueue.length > 0 && !practice && (
            <button
              onClick={startPractice}
              className={`mt-3 w-full rounded-lg border px-3 py-2 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 ${uiT.ring} ${sweetheart ? "border-sh-lgold/40 bg-sh-lgold/10 text-sh-lgold hover:border-sh-lgold/70 hover:bg-sh-lgold/18" : "border-yellow/30 bg-yellow/8 text-yellow hover:border-yellow/60 hover:bg-yellow/14"}`}
            >
              🎯 Practice your mistakes ({practiceQueue.length})
            </button>
          )}
        </div>
      )}
      {info ? (
      info.book ? (
        <div className="flex flex-col gap-2.5">
          {analysisChip("Opening book", "cyan")}
          {analysisHint("The bot is playing known theory — analysis starts once it's out of book.")}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <div className={"rounded-xl px-3 py-2.5 " + (sweetheart ? "bg-sh-lcard/80" : "bg-[#150C2480]")}>
              <div className={`text-lg font-bold leading-none ${playerAdvantageCp >= 50 ? uiT.interactiveText : playerAdvantageCp <= -50 ? (sweetheart ? "text-sh-red" : "text-[#FF7B9C]") : uiT.ink}`}>{evalLabel}</div>
              <div className={"mt-1 text-[10px] font-bold uppercase tracking-[0.14em] " + uiT.dimText}>Eval</div>
            </div>
            <div className={"rounded-xl px-3 py-2.5 " + (sweetheart ? "bg-sh-lcard/80" : "bg-[#150C2480]")}>
              <div className={"text-lg font-bold leading-none " + uiT.ink}>{info.depth}</div>
              <div className={"mt-1 text-[10px] font-bold uppercase tracking-[0.14em] " + uiT.dimText}>Depth</div>
            </div>
          </div>
          {info.pv.length > 0 && (
            <div>
              <div className={"mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] " + uiT.dimText}>Expected line</div>
              <div className="flex flex-wrap gap-1">
                {info.pv.slice(0, 8).map((sanMove, i) => (
                  <span key={i} className={"rounded-md px-1.5 py-0.5 font-mono text-xs " + (sweetheart ? "bg-sh-rose/15 " + uiT.ink : "bg-violet/15 text-paper")}>{sanMove}</span>
                ))}
                {info.pv.length > 8 && <span className={"px-1 py-0.5 text-xs " + uiT.dimText}>+{info.pv.length - 8} more</span>}
              </div>
            </div>
          )}
          <div className={"text-[11px] " + uiT.dimText}>{(info.nodes / 1000).toFixed(0)}k nodes · {(info.time / 1000).toFixed(1)}s</div>
        </div>
      )
    ) : (
      !pastedGame && analysisHint("After each bot move, its eval, search depth, and the line it expects will show up here.")
    )}
    </div>
  );

  const inChk = eng.inCheckNow() && !result;
  /* Only the Stockfish tiers (and Rank Bot, which runs on Stockfish) wait
     on the WASM boot. Engine uses the homemade worker, which has
     no such delay, so they shouldn't be told the engine is warming up. */
  const usesStockfish = !!(difficultyRef.current.stockfishElo || difficultyRef.current.adaptive);
  const replayLabel = activeOpening ? activeOpening.name : "Shared game";
  const status = spectateMode
    ? (result ? `${result.reason} · ${result.text}`
        : spectatePaused ? `Paused — ${DIFFICULTIES[spectateWhiteIdx].label} vs ${DIFFICULTIES[spectateBlackIdx].label}`
        : `${DIFFICULTIES[spectateWhiteIdx].label} vs ${DIFFICULTIES[spectateBlackIdx].label} — ${eng.getSide() === 1 ? "White" : "Black"} to move`)
    : mode === "replay"
    ? (replayIndex === 0 ? `${replayLabel} — starting position` : replayIndex === replayFull.length ? `${replayLabel} — final position` : `${replayLabel} — move ${replayIndex}`)
    : quizOpening
    ? `Quiz: ${quizOpening.name} — move ${moveList.length + 1} of ${quizOpening.moves.length}`
    : pastedGame && reviewInfo?.outcome
    ? reviewInfo.outcome
    : result
    ? `${result.reason} · ${result.text}`
    : pastedGame
    ? "Reviewing this game"
    : thinking ? (!engineWarm && usesStockfish ? "Warming up the engine… first move only" : "Zlegend2700 is calculating…")
    : eng.getSide() === playerColor ? "Your move, challenger" : "Bot to move";

  const arrowPoint = (sq120) => {
    const f = fileOf(sq120), r = rankOf(sq120);
    const visCol = flipped ? 7 - f : f;
    const visRow = flipped ? r : 7 - r;
    return { x: visCol + 0.5, y: visRow + 0.5 };
  };

  /* Slides the piece that just moved instead of letting it teleport. The
     board has already re-rendered by the time this runs, so the piece is
     started back on its old square and animated home. Only for a single
     step forward: stepping backward or jumping through a review would
     otherwise replay a move that isn't the one that just changed the board.
     A drag skips it too, since the hand already moved the piece there. */
  const slidePlyRef = useRef(eng.plyCount());
  useLayoutEffect(() => {
    const ply = eng.plyCount();
    const steppedForward = ply === slidePlyRef.current + 1;
    const dragged = suppressSlideRef.current;
    slidePlyRef.current = ply;
    suppressSlideRef.current = false;
    const board = boardRef.current;
    if (!lastMove || !steppedForward || dragged || !board) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const squareSize = board.clientWidth / 8;
    const slide = (a, b) => {
      const cell = board.children[Math.floor(b.y)]?.children[Math.floor(b.x)];
      const piece = cell?.querySelector("img.pc");
      if (!piece) return;
      /* Keep any resting transform (the Sweetheart king and knight are
         scaled) so the piece doesn't change size mid-slide. */
      const resting = getComputedStyle(piece).transform;
      const rest = resting === "none" ? "" : resting;
      const dx = (a.x - b.x) * squareSize, dy = (a.y - b.y) * squareSize;
      cell.style.zIndex = 4; // ride above the squares it crosses
      const anim = piece.animate(
        [{ transform: `translate(${dx}px, ${dy}px) ${rest}` }, { transform: rest || "none" }],
        { duration: PIECE_SLIDE_MS, easing: "ease-out" },
      );
      const done = () => { cell.style.zIndex = ""; };
      anim.onfinish = done;
      anim.oncancel = done;
    };
    const from = arrowPoint(lastMove.from), to = arrowPoint(lastMove.to);
    slide(from, to);
    /* Castling moves two pieces, and lastMove only names the king. */
    if (Math.abs(to.x - from.x) === 2 && Math.abs(eng.pieceAt(M120TO64[lastMove.to])) === WK) {
      const dir = Math.sign(to.x - from.x);
      slide({ x: dir > 0 ? 7.5 : 0.5, y: to.y }, { x: from.x + dir, y: to.y });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastMove]);
  /* Best-move arrow geometry, precomputed as one path + one head polygon.
     v1 drew two <line>s with an auto-oriented marker: the knight-move
     joint showed a visible seam, and the marker overshot the target
     square's center -- both read as "wonky", especially at phone sizes.
     Now: a single polyline (round joins handle the knight bend cleanly),
     the shaft starts offset from the origin center so it doesn't bury
     the piece, stops short of the target center, and an explicitly
     rotated triangle puts the arrow TIP exactly on the target center. */
  const arrowGeometry = (arrow) => {
    if (!arrow || arrow.from === arrow.to) return null;
    const a = arrowPoint(arrow.from), b = arrowPoint(arrow.to);
    const dx = b.x - a.x, dy = b.y - a.y;
    let bend = null;
    if (Math.abs(dx) === 2 && Math.abs(dy) === 1) bend = { x: a.x + dx, y: a.y };
    else if (Math.abs(dy) === 2 && Math.abs(dx) === 1) bend = { x: a.x, y: a.y + dy };
    const norm = (vx, vy) => { const l = Math.hypot(vx, vy) || 1; return { x: vx / l, y: vy / l }; };
    const first = bend || b;
    const u0 = norm(first.x - a.x, first.y - a.y);       // direction leaving the origin
    const prev = bend || a;
    const u1 = norm(b.x - prev.x, b.y - prev.y);         // direction into the target
    const HEAD_LEN = 0.42, HEAD_W = 0.5, START_OFF = 0.28;
    const start = { x: a.x + u0.x * START_OFF, y: a.y + u0.y * START_OFF };
    const shaftEnd = { x: b.x - u1.x * HEAD_LEN, y: b.y - u1.y * HEAD_LEN };
    const perp = { x: -u1.y, y: u1.x };
    const head = [
      `${b.x},${b.y}`,
      `${shaftEnd.x + perp.x * HEAD_W / 2},${shaftEnd.y + perp.y * HEAD_W / 2}`,
      `${shaftEnd.x - perp.x * HEAD_W / 2},${shaftEnd.y - perp.y * HEAD_W / 2}`,
    ].join(" ");
    const path = bend
      ? `M${start.x},${start.y} L${bend.x},${bend.y} L${shaftEnd.x},${shaftEnd.y}`
      : `M${start.x},${start.y} L${shaftEnd.x},${shaftEnd.y}`;
    return { path, head };
  };
  const arrowLine = arrowGeometry(bestArrow);
  /* Reviewing a slip, the move that should have been played, drawn on the
     position it was played in. */
  const mateFxProps = showMateFx ? {
    ...arrowPoint(M64TO120[mateFx.sq]),
    src: pieceImgSrc(6, mateFx.loser === 1),
    colorClass: mateFx.loser === 1 ? "w" : "b",
    title: "Checkmate",
    subtitle: spectateMode ? `${mateFx.winner === 1 ? "White" : "Black"} wins` : mateFx.winner === playerColor ? "You win!" : "Zlegend2700 wins",
    done: mateFx.done,
  } : null;
  const betterMoveLine = (() => {
    const played = reviewIndex - 1;
    const grade = moveGrades?.[played];
    const best = gradeDetail?.bestSans?.[played];
    if (!reviewing || practice || !["inaccuracy", "mistake", "blunder", "miss"].includes(grade)) return null;
    if (!best || best === moveList[played] || !gradeDetail.fens) return null;
    const probe = createEngine();
    probe.loadFen(gradeDetail.fens[played]);
    const move = probe.legalMoves().find((m) => probe.sanOf(m) === best);
    return move === undefined ? null : arrowGeometry({ from: mFrom(move), to: mTo(move) });
  })();

  const Tray = ({ pieces, colorClass }) => (
    <div className="tray">
      {pieces.length === 0
        ? <span className="trayEmpty">no captures yet</span>
        : pieces.map((t, i) => <img key={i} className={"trayPc " + colorClass} src={pieceImgSrc(t, colorClass === "wpc")} alt="" draggable="false" />)}
    </div>
  );

  /* Home page mode cards drop straight into the matching part of the
     Play screen rather than making the player navigate there themselves
     -- each of these already exists as its own control elsewhere in the
     app (the Puzzles/Openings/Spectate/Blind Chess icon-row buttons, the
     Rush row inside the Puzzles modal, the Rank Bot difficulty option),
     this just triggers the same state changes those already do. */
  const enterMode = (modeId) => {
    /* Leaderboard is the one exception -- reachable mid-rush from the
       heartbreak screen's own trophy button, and leaderboardReturnRef
       relies on rushMode/rushResult still being set so Back can drop the
       player straight back into their results. Every other destination
       here is a real "I'm done with whatever I was doing" move. */
    if (modeId === "leaderboard") { leaderboardReturnRef.current = "home"; setSiteView("leaderboard"); return; }
    leaveActivity();
    if (modeId === "lessons") { setSiteView("lessons"); return; }
    if (modeId === "review") { openReviewPage(); return; }
    if (modeId === "puzzles") { setSiteView("puzzlesHome"); ensurePuzzlesLoaded(); return; }
    if (modeId === "openings" || modeId === "rush") { setSiteView(modeId); return; }
    if (modeId === "spectate") { setSiteView("watch"); return; }
    if (modeId === "blind") { setBlindOpen(true); return; }
    setSiteView("play");
    if (modeId === "rank") {
      const idx = DIFFICULTIES.findIndex(d => d.id === "rank");
      if (idx >= 0) onDifficultyChange(idx);
    }
  };

  const hasLiveGame = mode === "play" && !result && !pastedGame && !activePuzzle && !quizOpening && !spectateMode && moveList.length > 0;
  const openDaily = () => { leaveActivity(); startPuzzle(dailyPuzzle(pz.PUZZLES)); setSiteView("play"); };
  /* A finished game may still be on the board, so Play starts a fresh one
     instead of reopening it. */
  const startFromHub = (idx) => {
    leaveActivity();
    if (moveList.length > 0) newGame(playerColor);
    onDifficultyChange(idx);
    setSiteView("play");
  };

  /* Settings and Juice Box open from the header on any page, so they live
     up here beside it instead of inside the Play screen. Everything else
     stays with Play: the Rush results popup, for one, has to stay put while
     the player steps over to the Leaderboard and back. */
  const boardVars = { "--boardLight": getBoardColor(boardColorId).light, "--boardDark": getBoardColor(boardColorId).dark };
  const appOverlays = (
    <div className="appOverlays" style={boardVars}>
      {blindOpen && (
        <Suspense fallback={
          <div className="promoOv" style={{ position: "fixed", inset: 0, zIndex: 50 }}>
            <div className="promoBox" style={{ flexDirection: "column", gap: 12, minWidth: 260, maxWidth: 360, padding: "20px 24px" }} role="status" aria-label="Loading Blind Chess">
              <div className="boxHead">Blind Chess</div>
              <div style={{ height: 10, borderRadius: 999, overflow: "hidden", background: "#150C24" }}>
                <div className="loadingBarFill" style={{ width: "60%", height: "100%", borderRadius: 999, background: "var(--cyan)" }} />
              </div>
            </div>
          </div>
        }>
          <BlindMode onClose={() => setBlindOpen(false)} />
        </Suspense>
      )}

      {(musicOpen || settingsOpen || pieceDesignsOpen || boardColorsOpen) && (
        <Suspense fallback={null}>
          <AppPopups sweetheart={sweetheart} chooseTheme={chooseTheme} sfxOn={sfxOn} toggleSfx={toggleSfx} boardColorId={boardColorId} boardColorsOpen={boardColorsOpen} chooseBoardColor={chooseBoardColor} choosePieceSet={choosePieceSet} closeMusic={closeMusic} closeSettings={closeSettings} fmtTime={fmtTime} hideEvalBar={hideEvalBar} isMp3Source={isMp3Source} jbDisabled={jbDisabled} jbPlaying={jbPlaying} jbTrackLabel={jbTrackLabel} mp3Buffering={mp3Buffering} mp3CurrentTime={mp3CurrentTime} mp3Duration={mp3Duration} mp3Idx={mp3Idx} mp3Shuffle={mp3Shuffle} mp3Tracks={mp3Tracks} musicOpen={musicOpen} musicSource={musicSource} nextTrack={nextTrack} onVolume={onVolume} pickMp3Track={pickMp3Track} pieceDesignsOpen={pieceDesignsOpen} pieceImgSrc={pieceImgSrc} pieceSetId={pieceSetId} prevTrack={prevTrack} seekMp3={seekMp3} setBoardColorsOpen={setBoardColorsOpen} setMusicSource={setMusicSource} setPieceDesignsOpen={setPieceDesignsOpen} setSettingsOpen={setSettingsOpen} settingsOpen={settingsOpen} toggleEvalBar={toggleEvalBar} toggleMusic={toggleMusic} toggleShuffle={toggleShuffle} trackName={trackName} volume={volume} />
        </Suspense>
      )}
    </div>
  );

  const renderPage = () => {
  if (siteView === "home") {
    return (
      <HomePage
        onEnter={enterMode}
        onPlay={() => onSection("play")}
        onDaily={openDaily}
        hasLiveGame={hasLiveGame}
        daily={puzzlesData ? dailyPuzzle(pz.PUZZLES) : null}
        dailySolved={dailySolvedDate === todayKey()}
        streak={currentStreak(dailyStreak, utcDay())}
        boardColors={getBoardColor(boardColorId)}
        pieceImgSrc={pieceImgSrc}
        firstVisit={isFirstVisitRef.current}
        rankElo={rankBotAssessedElo ?? (rankBotGames > 0 ? rankBotElo : null)}
        rankGames={rankBotGames}
        sweetheart={sweetheart}
      />
    );
  }

  if (siteView === "playHub") {
    return (
      <PlayPage
        levels={PLAY_LEVELS}
        hasLiveGame={hasLiveGame}
        onPick={startFromHub}
        onResume={() => setSiteView("play")}
        onMode={enterMode}
        sweetheart={sweetheart}
      />
    );
  }

  if (["openings", "watch", "ranked", "rush"].includes(siteView)) {
    return (
      <Suspense fallback={null}>
        <ModePages siteView={siteView} openLeaderboard={openLeaderboard} puzzlesInBand={puzzlesInBand} pz={pz} resetRushCounter={resetRushCounter} rushDuration={rushDuration} rushLifetime={rushLifetime} setPuzzleBand={setPuzzleBand} setSiteView={setSiteView} setSpectateBlackIdx={setSpectateBlackIdx} setSpectateOpeningId={setSpectateOpeningId} setSpectateWhiteIdx={setSpectateWhiteIdx} spectateBlackIdx={spectateBlackIdx} spectateOpeningId={spectateOpeningId} spectateWhiteIdx={spectateWhiteIdx} startOpening={startOpening} startPuzzle={startPuzzle} startRush={startRush} startSpectate={startSpectate} sweetheart={sweetheart} />
      </Suspense>
    );
  }

  if (siteView === "profile") {
    return (
      <Suspense fallback={null}>
        <ProfilePage
          profile={profile}
          displayName={displayName}
          onSaveName={saveProfileName}
          onBack={() => setSiteView("home")}
          onSignIn={signInWithDiscord}
          onSignOut={signOut}
          onYourGames={() => enterMode("review")}
          sweetheart={sweetheart}
        />
      </Suspense>
    );
  }

  if (siteView === "puzzlesHome") {
    return (
      <PuzzlesHomePage
        onBack={() => setSiteView("home")}
        onDaily={openDaily}
        onLeaderboard={() => openLeaderboard(leaderboardDuration)}
        onRanked={() => { leaveActivity(); setSiteView("ranked"); }}
        onRush={() => { leaveActivity(); setSiteView("rush"); }}
        sweetheart={sweetheart}
        puzzlesReady={!!puzzlesData}
        dailySolved={dailySolvedDate === todayKey()}
      />
    );
  }

  if (siteView === "leaderboard") {
    return (
      <LeaderboardPage
        initialDuration={leaderboardDuration}
        onBack={() => setSiteView(leaderboardReturnRef.current)}
        sweetheart={sweetheart}
      />
    );
  }

  if (siteView === "review") {
    return (
      <GameReviewPage
        onBack={() => setSiteView(reviewReturnRef.current)}
        onReview={reviewPastedGame}
        onOpenSaved={reviewSavedGame}
        hasLiveGame={hasLiveGame}
        profile={profile}
        sweetheart={sweetheart}
      />
    );
  }

  if (siteView === "lessons") {
    return (
      <LessonsPage
        onOpenings={() => enterMode("openings")}
        sweetheart={sweetheart}
      />
    );
  }

  return (
    <Suspense fallback={null}>
      <PlayView mateFxProps={mateFxProps} rechecking={rechecking} betterMoveLine={betterMoveLine} rankTestNote={rankBotTest && difficultyRef.current.id === "rank" ? (rankTestNote || {}) : null} GRADE_COLOR={GRADE_COLOR} GRADE_TAG={GRADE_TAG} MoodImg={MoodImg} RushThemeArt={RushThemeArt} Tray={Tray} activeOpening={activeOpening} activePuzzle={activePuzzle} analysisBusy={analysisBusy} analysisContent={analysisContent} analysisLabel={analysisLabel} analysisMove={analysisMove} analyzing={analyzing} arrowLine={arrowLine} beginRestartCountdown={beginRestartCountdown} bestArrow={bestArrow} boardColorId={boardColorId} boardRef={boardRef} boardVars={boardVars} botColor={botColor} botLine={botLine} botMood={botMood} botTaken={botTaken} colorPick={colorPick} curMoveIdx={curMoveIdx} difficultyIdx={difficultyIdx} difficultyRef={difficultyRef} displayName={displayName} dragCellSize={dragCellSize} dragFrom={dragFrom} dragPos={dragPos} eng={eng} evalLabel={evalLabel} evalPawns={evalPawns} exitMissedAttempt={exitMissedAttempt} exitPractice={exitPractice} exitPuzzle={exitPuzzle} exitReplay={exitReplay} exitRush={exitRush} formatClock={formatClock} gameStyle={gameStyle} gradeDetail={gradeDetail} gradeProgress={gradeProgress} grading={grading} hideEvalBar={hideEvalBar} hideRushSummary={hideRushSummary} hinting={hinting} inChk={inChk} liveOpening={liveOpening} missedAttempt={missedAttempt} missedStepIdx={missedStepIdx} mode={mode} moveGrades={moveGrades} moveList={moveList} nameDraft={nameDraft} nameEditOpen={nameEditOpen} newGame={newGame} newGameConfirm={newGameConfirm} nextPuzzle={nextPuzzle} onCopyPgn={onCopyPgn} onDifficultyChange={onDifficultyChange} onHint={onHint} onMissedSwipeEnd={onMissedSwipeEnd} onMissedSwipeStart={onMissedSwipeStart} openLeaderboard={openLeaderboard} openReviewPage={openReviewPage} pairs={pairs} pastedGame={pastedGame} pauseSpectate={pauseSpectate} pgnToast={pgnToast} pieceImgSrc={pieceImgSrc} pieceSetId={pieceSetId} playMove={playMove} playerAdvantageCp={playerAdvantageCp} playerColor={playerColor} playerShare={playerShare} practice={practice} practiceMove={practiceMove} practiceNext={practiceNext} practiceReveal={practiceReveal} promo={promo} puzzleBand={puzzleBand} puzzleFeedback={puzzleFeedback} puzzleMove={puzzleMove} puzzleSolved={puzzleSolved} pz={pz} quizDoneToast={quizDoneToast} quizMove={quizMove} quizOpening={quizOpening} rankBotAssessedElo={rankBotAssessedElo} rankBotGames={rankBotGames} ratingInfo={ratingInfo} replayFull={replayFull} replayIndex={replayIndex} replayPlaying={replayPlaying} replayStep={replayStep} restartCountdown={restartCountdown} result={result} resumeSpectate={resumeSpectate} reviewIndex={reviewIndex} reviewInfo={reviewInfo} reviewMissedPuzzle={reviewMissedPuzzle} reviewing={reviewing} rows={rows} rushBandIdx={rushBandIdx} rushBestMap={rushBestMap} rushDuration={rushDuration} rushLifetime={rushLifetime} rushMilestone={rushMilestone} rushMissed={rushMissed} rushMistakes={rushMistakes} rushMode={rushMode} rushResult={rushResult} rushSolved={rushSolved} rushSummaryOpen={rushSummaryOpen} rushTimeLeft={rushTimeLeft} saveDisplayName={saveDisplayName} setBotLine={setBotLine} setColorPick={setColorPick} setMissedStepIdx={setMissedStepIdx} setNameDraft={setNameDraft} setNameEditOpen={setNameEditOpen} setNewGameConfirm={setNewGameConfirm} setPlayerColor={setPlayerColor} setPromo={setPromo} setReplayIndex={setReplayIndex} setReviewIndex={setReviewIndex} setRushSummaryOpen={setRushSummaryOpen} setShareLinkFallback={setShareLinkFallback} setShareToast={setShareToast} setSiteView={setSiteView} shareLinkFallback={shareLinkFallback} shareToast={shareToast} spectateBlackIdx={spectateBlackIdx} spectateMode={spectateMode} spectateOpeningId={spectateOpeningId} spectatePaused={spectatePaused} spectateWhiteIdx={spectateWhiteIdx} startPuzzle={startPuzzle} startQuiz={startQuiz} startSpectate={startSpectate} status={status} stopSpectate={stopSpectate} sweetheart={sweetheart} thinking={thinking} toggleAnalyze={toggleAnalyze} toggleReplayPlay={toggleReplayPlay} uiT={uiT} undo={undo} youDiff={youDiff} youTaken={youTaken} />
    </Suspense>
  );
  };

  const onSection = (id) => {
    if (id === "home") { leaveActivity(); setSiteView("home"); }
    else if (id === "play" && hasLiveGame) setSiteView("play");
    else if (id === "play") { leaveActivity(); setSiteView("playHub"); }
    else enterMode(id === "learn" ? "lessons" : id);
  };
  /* Hidden during an activity so the board gets the screen. The header's
     logo is still there as the way out. */
  const focused = siteView === "play" && (rushMode || !!activePuzzle || spectateMode
    || (mode === "play" && moveList.length > 0 && !result && !pastedGame));
  focusedRef.current = focused;
  const section = sectionForView({ siteView, rushMode, activePuzzle, pastedGame });
  const darkNav = siteView === "puzzlesHome" && !sweetheart;

  return (
    <div className={"appShell" + (focused ? "" : " hasBottomBar")}>
      <AppHeader
        section={section}
        onSection={onSection}
        profile={profile}
        sweetheart={sweetheart}
        dark={darkNav}
        onSignIn={signInWithDiscord}
        onSignOut={signOut}
        onProfile={() => setSiteView("profile")}
        onShare={onShare}
        hasMoves={moveList.length > 0}
        onYourGames={() => enterMode("review")}
        onSettings={openSettings}
        onMusic={() => setMusicOpen(true)}
      />
      <div key={siteView} className="pageIn">
        <Suspense fallback={null}>{renderPage()}</Suspense>
      </div>
      {!focused && <BottomBar section={section} onSection={onSection} sweetheart={sweetheart} dark={darkNav} />}
      {appOverlays}
    </div>
  );
}
