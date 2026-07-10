import { useState, useRef, useCallback, useEffect, useMemo, lazy, Suspense } from "react";
import {
  createEngine, EMPTY, WN, WB, WR, WQ, WK, M64TO120, M120TO64,
  mFrom, mTo, mPromo, mFlags, MATE, fileOf, rankOf,
} from "./engine/chessEngine";
import { createAudio } from "./audio/chiptune";
import { getSupabase } from "./utils/supabase";
import { MP3_PLAYLISTS, THEME_ID, loadPlaylistTracks } from "./utils/musicLibrary";
import PixelAvatar, { ZPAL, ZPIX, BPAL, BPIX, PPAL, PPIX } from "./components/PixelAvatar";
import StarField from "./components/StarField";
import Confetti from "./components/Confetti";
import HomePage from "./components/HomePage";
import { TopNav } from "./components/ExploreNav";
import SocialBanner from "./components/SocialBanner";
import GamePanel from "./components/GamePanel";
import { loadSetting, saveSetting } from "./utils/storage";
import { buildPgn, parsePgnMoves, replayForeignPgn } from "./utils/pgn";
import { encodeGame, decodeGame, getSharedHash, replayIntoEngine } from "./utils/share";
import { PIECE_SETS, getPieceSet } from "./utils/pieceSets";
import { BOARD_COLORS, getBoardColor } from "./utils/boardColors";
import { saveGame, estimateRating } from "./utils/gameHistory";
import { getDisplayName, setDisplayName } from "./utils/playerIdentity";
import { submitRushScore } from "./utils/leaderboard";
import { RUSH_DURATIONS } from "./utils/rushDurations";
import LeaderboardPage from "./components/LeaderboardPage";
import { syncRankBotToSupabase, fetchRankBotFromSupabase, logRankBotMove } from "./utils/rankBot";
import { ENGINE_VERSION } from "./utils/version";
import { OPENINGS } from "./utils/openings";
import { loadEcoOpenings, detectEcoOpening } from "./utils/ecoOpenings";
import { stockfishBestMove, STOCKFISH_MIN_ELO } from "./engine/stockfishEngine";
import "./App.css";

/* Loaded on demand: blind mode brings its own parser/describer/speech
   stack, none of which the main board ever needs. */
const BlindMode = lazy(() => import("./components/BlindMode"));

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
  /* styleBook: Casual's opening picks lean into the bot's daily
     personality (see STYLE_BOOK_BIAS in openingBook.js). Master stays on
     the neutral popularity-weighted book, and the Stockfish tiers don't
     use a book at all. */
  { label: "Casual", ms: 600, book: true, styleBook: true },
  { label: "Master", ms: 12000, book: true },
];

/* Rank Bot: rather than one fixed Elo, the target Stockfish strength is a
   dial that moves after every move the player makes based on how strong
   (or weak) the move actually was -- see adjustRankBotDial and the v3
   estimator notes at rankBotLossToPerf below. Game results feed in too
   (RANK_BOT_RESULT_STEP), and sandbagging -- deliberately hanging pieces
   to make the bot easy -- is detected and damped. The opening is excluded
   entirely (both from measurement and from the bot's own strength limit
   -- it plays theory at full strength, then drops to the dial). Below
   Stockfish's 1320 floor, blunderChance stands in for "weaker than
   Stockfish can go", same as the "1000 Elo" tier. */
const RANK_BOT_MIN_ELO = 600;
/* Full engine strength -- the dial can climb all the way to "actually
   unbeatable" for players who earn it (v2 capped at 2200, which strong
   players simply plateaued against). */
const RANK_BOT_MAX_ELO = 3190;
const RANK_BOT_DEFAULT_ELO = 1400;
const RANK_BOT_CALIBRATION_GAMES = 3;
const RANK_BOT_CALIBRATION_MULT = 1.5;
const RANK_BOT_PROBE_MS = 250;
/* Plies (both sides) treated as opening theory: the bot plays them at
   full strength and the dial ignores them. */
const RANK_BOT_OPENING_PLIES = 8;
/* Minimum tracked (post-opening) player moves for an abandoned game to
   still count toward the assessment -- players who bail mid-game and hit
   New would otherwise never complete 3 "games". */
const RANK_BOT_MIN_TRACKED_MOVES = 8;
/* v3 estimator. v2's threshold steps had no equilibrium -- a player's
   loss distribution doesn't change as the dial moves, so whichever
   direction their mix netted, the dial ran to that clamp and stayed
   (confirmed from rank_bot_moves telemetry: every 1400 start crashed to
   the 600 floor; even loss=0 moves averaged +3 because each blunder also
   sat in the rolling window dragging the next four steps down).

   Instead: map each move's cp loss to the Elo whose typical play it
   resembles (buckets sanity-checked against the logged loss
   distribution -- median 42, p75 275 -- and rough public ACPL-vs-rating
   curves), then pull the dial toward that with a small EWMA step. This
   self-limits in both directions: the dial converges to the average
   implied strength of the moves actually being played, climbing for
   clean play and settling low for weak play, no clamp-hugging. */
function rankBotLossToPerf(loss) {
  if (loss === 0) return 3000;
  if (loss < 20) return 2400;
  if (loss < 60) return 1700;
  if (loss < 150) return 1150;
  if (loss < 300) return 800;
  return 450;
}
/* EWMA pull per move toward the implied perf -- half-life ~11 moves, so
   one game meaningfully moves the dial but one move can't hijack it. */
const RANK_BOT_EWMA_K = 0.06;
/* A cp loss this big is a "throw" (hung piece / mate-in-sight ignored). */
const RANK_BOT_THROW_CP = 300;
/* Sandbagging guards: players deliberately hanging pieces to make the
   bot easy. Two throws inside the recent-move window flip the game to
   "suspect" -- further throws only move the dial at quarter weight --
   and no single game may drag the dial down more than this many points
   total, however it's played. Genuine collapses still register (capped),
   while the material override + full-strength swing check elsewhere
   means the bot punishes the hung pieces themselves either way. */
const RANK_BOT_THROWS_TO_SUSPECT = 2;
const RANK_BOT_SUSPECT_WEIGHT = 0.25;
const RANK_BOT_MAX_GAME_DROP = 250;
/* Game outcome feedback (v3): move quality is the primary signal, but
   the result is real evidence too -- the bot plays AT the player's
   estimated level, so beating it says the estimate is too low. Losing
   is close to expected and worth less; a draw leans mildly positive.
   Also blunts sandbagging: throwing pieces now mostly just loses the
   game, and a loss is worth far less dial movement than the throws
   would have been without the caps above. */
const RANK_BOT_RESULT_STEP = { win: 120, draw: 20, loss: -80 };
/* The per-move dial above only updates *after* the player moves, and only
   by a small step -- fine for a slow-moving skill estimate, but it means
   a bot sitting on a weak dial would blunder-roll right past a just-hung
   queen because "skill this low" says so. Material/tactical reality has
   to trump the calibration in the moment: a big swing overrides the dial
   for that one move only (never persisted), snapping to full strength to
   grab (or dodge) it, and easing off when the bot is already dominating
   so the game doesn't turn into a blowout. */
const RANK_BOT_SWING_CP = 400;
/* Budget for the full-strength sanity search in stockfishMove -- short
   since it's only checking "is there something decisive right now", not
   doing real analysis; confirmed reliable at this length even at only
   300ms in testing. Adds this much to Rank Bot's per-move latency. */
const RANK_BOT_SANITY_MS = 400;
const RANK_BOT_DOMINANT_CAP = 900;
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
  /* A shared game link (?/#g=...) always drops straight into Play with
     that game loaded -- a viewer clicking a friend's shared link should
     never have to click through the home page first to see the position
     they were sent. */
  const [siteView, setSiteView] = useState(initialShared ? "play" : "home");

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
  /* Single dispatcher for ExploreDock (desktop)/BottomNav (mobile).
     Openings/Puzzles/Spectate/Blind Chess used to open from here too, but
     the nav only exposes Home/Login/Music/Settings now -- those modes are
     reachable from the home page's mode grid instead. Login has no auth
     wired up yet, so it's a no-op placeholder for now. */
  /* The Music/Settings modals only render inside the "play" branch below
     -- TopNav is now shown on every page (Play, Leaderboard, ...), so
     opening one from a page that isn't "play" needs to flip siteView
     first or the modal has nowhere to mount. Harmless no-op when
     already on "play". */
  const onToolSelect = (id) => {
    if (id === "music") { setSiteView("play"); setMusicOpen(true); }
    else if (id === "settings") { setSiteView("play"); openSettings(); }
    else if (id === "home") setSiteView("home");
    else if (id === "login") {} // placeholder -- no auth implemented yet
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
  /* Leaderboard lives on its own page (LeaderboardPage.jsx), not a modal
     -- every "View Leaderboard" trigger should call this rather than
     opening an overlay, now and for any future leaderboard entry point. */
  const [leaderboardDuration, setLeaderboardDuration] = useState(60);
  const openLeaderboard = (duration) => {
    setLeaderboardDuration(duration);
    setSiteView("leaderboard");
  };
  /* One-time recalibration (v2): the original dial logic could only ever
     drift down -- its step-up bar sat under the probe searches' noise
     floor, confirmed from the logged rank_bot_moves data -- so anyone who
     never completed a full assessment restarts from the new, higher
     default rather than keeping a rating the old math dragged down. */
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
  /* Last few of the player's own move-quality scores this game -- reset
     each new game, not persisted. v3 uses it only for sandbag detection
     (counting recent throws), not for smoothing: v2 fed the window
     average back into the step on top of the per-move step, which
     double-counted every blunder across the next four moves and was a
     big part of why the dial could only fall. */
  const rankBotWindowRef = useRef([]);
  /* How many post-opening player moves the dial tracked this game --
     an abandoned game with enough of these still counts toward the
     assessment (see maybeCountAbandonedRankGame). */
  const rankBotTrackedRef = useRef(0);
  /* Dial value when this game's first tracked move landed -- the anchor
     for RANK_BOT_MAX_GAME_DROP's per-game floor. Null until then. */
  const rankBotGameStartEloRef = useRef(null);
  /* Bumped on every undo/new-game/abandon -- an in-flight adjustRankBotDial
     probe (two 250ms searches) captures the epoch when it starts and
     checks it again before applying its result, so undoing a move can't
     let a stale probe for a move that no longer happened still nudge the
     dial and log a row (confirmed in production data: a duplicate ply
     entry from exactly this race). */
  const rankBotEpochRef = useRef(0);
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
  const [rankedPuzzlesOpen, setRankedPuzzlesOpen] = useState(false);
  const [blindOpen, setBlindOpen] = useState(false);
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
  /* Puzzles missed during the current run (max 3, since 3 misses ends the
     run) -- kept as full puzzle objects so the results screen can offer
     Retry/Analyze straight from the summary. */
  const [rushMissed, setRushMissed] = useState([]);
  const rushMissedRef = useRef([]);
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
    const fen = eng.fen();
    const mainSearch = stockfishBestMove(fen, diff.stockfishElo, diff.moveTimeMs || 1000);
    /* Rank Bot only: a short full-strength sanity check run alongside the
       calibrated search. Testing this directly against the engine showed
       why this needs its own search rather than just reading diff's own
       result -- UCI_LimitStrength doesn't just search shallower, it
       deliberately weakens Stockfish's play, so a low-Elo search can
       simply fail to notice a one-move queen capture even given ample
       time (confirmed: 600 Elo missed it at 900ms/1200ms in testing,
       while full strength found it consistently even at 300ms). Piece
       value/board reality has to come from a search that isn't itself
       handicapped -- the calibrated search stays in charge of "how" the
       bot plays, this only overrides "whether it takes the free queen". */
    const sanitySearch = diff.adaptive ? stockfishBestMove(fen, 3190, RANK_BOT_SANITY_MS) : Promise.resolve(null);
    return Promise.all([mainSearch, sanitySearch]).then(([{ uci, info }, sanity]) => {
      if (!uci) return null;
      let move = eng.moveFromUci(uci);
      let score = info ? info.score : 0;
      const sanityMove = sanity && sanity.info && sanity.info.score >= RANK_BOT_SWING_CP && sanity.uci
        ? eng.moveFromUci(sanity.uci) : null;
      if (sanityMove) {
        move = sanityMove;
        score = sanity.info.score;
      } else if (move && diff.blunderChance && Math.random() < diff.blunderChance) {
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

  /* Rank Bot has no fixed stockfishElo in DIFFICULTIES -- it's synthesized
     here from the live dial every time a move is needed, so engineMove
     doesn't need its own special case beyond this one substitution.
     During the opening plies it plays unthrottled (3190 is Stockfish's
     own UCI_Elo ceiling): everyone's theory moves are "perfect", so a
     weakened bot stumbling out of a normal opening reads as random
     rather than adaptive, and the dial isn't measuring yet anyway. */
  const effectiveDifficulty = (diff) => {
    if (!diff.adaptive) return diff;
    if (eng.plyCount() < RANK_BOT_OPENING_PLIES) {
      return { ...diff, stockfishElo: 3190, blunderChance: 0 };
    }
    let elo = rankBotEloRef.current;
    /* Real-time material/eval reality check, evaluated fresh every move
       (cheap -- reuses the existing static eval, no extra search) rather
       than waiting on the slow per-move dial to catch up:
       - bot is getting crushed (a hung queen, a blundered piece) -> play
         its actual best move this instant regardless of calibration;
       - bot is already crushing the player -> cap its own strength down
         so the position doesn't snowball into a blowout. */
    const botColorNow = -playerColorRef.current;
    const whiteEval = eng.evalWhite();
    const botAdvantageCp = botColorNow === 1 ? whiteEval : -whiteEval;
    if (botAdvantageCp <= -RANK_BOT_SWING_CP) elo = RANK_BOT_MAX_ELO;
    else if (botAdvantageCp >= RANK_BOT_SWING_CP) elo = Math.min(elo, RANK_BOT_DOMINANT_CAP);
    return { ...diff, stockfishElo: Math.max(elo, STOCKFISH_MIN_ELO), blunderChance: rankBotBlunderChance(elo) };
  };

  /* Runs after each of the player's own moves (playMove only -- not
     puzzles/analysis/quiz), purely when Rank Bot is the opponent. Two
     quick background searches (before/after the move, same shape as the
     N+1-search trick gradeMoves uses for move-grading) estimate how much
     eval the player's actual move gave up; rankBotLossToPerf maps that to
     an implied performance Elo and the dial EWMAs toward it (see the v3
     block by the constants for why v2's threshold steps had to go).
     Opening plies are skipped entirely: they're theory, their measured
     "loss" is mostly probe noise, and letting them into the estimate was
     masking the player's real level. */
  const adjustRankBotDial = (prefixBefore, prefixAfter, gameOver) => {
    if (difficultyRef.current.id !== "rank" || gameOver) return;
    if (prefixAfter.length <= RANK_BOT_OPENING_PLIES) return;
    const gameUid = ensureRankBotGameUid();
    const ply = prefixAfter.length;
    const epoch = rankBotEpochRef.current;
    Promise.all([
      runSearch(prefixBefore, RANK_BOT_PROBE_MS, 0, { useBook: false }),
      runSearch(prefixAfter, RANK_BOT_PROBE_MS, 0, { useBook: false }),
    ]).then(([before, after]) => {
      if (rankBotEpochRef.current !== epoch) return; // undone/reset since this probe started
      if (!before || !after) return;
      /* Mate-range scores don't behave like normal centipawn evals -- two
         shallow (250ms) probe searches finding forced mate at slightly
         different distances can disagree by tens of thousands of "cp",
         which reads as a catastrophic blunder even when the player's
         move was fine or literally the best move in a mating sequence.
         Confirmed from logged games: this is what was smashing the dial
         back to the floor mid-mate even while the player kept playing
         cleanly. Skip the whole adjustment rather than trust either
         number once either side sees mate. */
      if (Math.abs(before.score) > MATE - 2000 || Math.abs(after.score) > MATE - 2000) return;
      const loss = Math.max(0, before.score + after.score);
      const window = rankBotWindowRef.current;
      window.push(loss);
      if (window.length > 8) window.shift();
      rankBotTrackedRef.current += 1;
      const eloBefore = rankBotEloRef.current;
      if (rankBotGameStartEloRef.current == null) rankBotGameStartEloRef.current = eloBefore;
      /* Sandbag check: with 2+ throws already in the recent window,
         further throws barely count -- someone repeatedly hanging pieces
         is manipulating the dial, not revealing their level. (A genuine
         collapse looks the same, but it's capped, not erased, and the
         per-game floor below bounds the total damage either way.) */
      const throwsInWindow = window.filter(l => l >= RANK_BOT_THROW_CP).length;
      const suspect = loss >= RANK_BOT_THROW_CP && throwsInWindow > RANK_BOT_THROWS_TO_SUSPECT;
      const mult = rankBotGamesRef.current < RANK_BOT_CALIBRATION_GAMES ? RANK_BOT_CALIBRATION_MULT : 1;
      let step = (rankBotLossToPerf(loss) - eloBefore) * RANK_BOT_EWMA_K * mult;
      if (suspect && step < 0) step *= RANK_BOT_SUSPECT_WEIGHT;
      /* Per-game floor: however this game goes, the dial can't be dragged
         down more than RANK_BOT_MAX_GAME_DROP from where it started. */
      const gameFloor = Math.max(RANK_BOT_MIN_ELO, rankBotGameStartEloRef.current - RANK_BOT_MAX_GAME_DROP);
      let next = Math.round(eloBefore + step);
      next = Math.max(gameFloor, Math.min(RANK_BOT_MAX_ELO, next));
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
      : runSearch(currentMoveList, diff.ms, diff.blunderChance || 0, { personality, useBook: diff.book, bookStyle: diff.styleBook ? gameStyleRef.current.label : null });
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
          finishRankBotGame(over);
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
      : runSearch(moveListRef.current, diff.ms, diff.blunderChance || 0, { personality, useBook: diff.book, bookStyle: diff.styleBook ? gameStyleRef.current.label : null });
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

  const finishRankBotGame = (over) => {
    if (difficultyRef.current.id !== "rank") return;
    const games = rankBotGamesRef.current + 1;
    rankBotGamesRef.current = games;
    setRankBotGames(games);
    saveSetting("rankBotGames", games);
    rankBotWindowRef.current = [];
    rankBotGameUidRef.current = null;
    rankBotTrackedRef.current = 0;
    rankBotGameStartEloRef.current = null;

    /* Outcome feedback (v3) -- see RANK_BOT_RESULT_STEP. Abandoned games
       pass no result and skip this; only decisive/drawn finishes count. */
    if (over) {
      const step = over.winner === playerColorRef.current ? RANK_BOT_RESULT_STEP.win
        : over.winner ? RANK_BOT_RESULT_STEP.loss
        : RANK_BOT_RESULT_STEP.draw;
      const next = Math.max(RANK_BOT_MIN_ELO, Math.min(RANK_BOT_MAX_ELO, rankBotEloRef.current + step));
      if (next !== rankBotEloRef.current) {
        rankBotEloRef.current = next;
        setRankBotElo(next);
        saveSetting("rankBotElo", next);
      }
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
     toward the assessment if the dial tracked enough real moves --
     otherwise players who rarely play to checkmate would never complete
     3 "games" and never see their Elo. Finished games reset the tracked
     counter inside finishRankBotGame, so this can't double-count. */
  const maybeCountAbandonedRankGame = () => {
    rankBotEpochRef.current += 1;
    if (rankBotTrackedRef.current >= RANK_BOT_MIN_TRACKED_MOVES) finishRankBotGame(null);
    rankBotWindowRef.current = [];
    rankBotGameUidRef.current = null;
    rankBotTrackedRef.current = 0;
    rankBotGameStartEloRef.current = null;
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
      finishRankBotGame(over);
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
    maybeCountAbandonedRankGame();
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
    rushMissedRef.current = [];
    setRushSolved(0);
    setRushMistakes(0);
    setRushBandIdx(0);
    setRushMissed([]);
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
    if (reason === "time") { try { audio.sfxTimeUp(); } catch { /* audio unavailable */ } }
  };

  const retryRush = () => startRush(rushDuration);

  /* Deliberately does NOT call exitPuzzle()/newGame(1) -- that would
     reset the board into a fresh Play vs Bot game, "portaling" the
     player out of Puzzles entirely right after a rush ends. Clearing the
     rush flags and reopening the Puzzles menu keeps them on a puzzle
     board and lets them immediately pick Daily/Ranked/Rush again. */
  const exitRush = () => {
    setRushMode(false);
    setRushResult(null);
    setPuzzlesOpen(true);
  };

  const resetRushCounter = () => {
    setRushLifetime(0);
    rushLifetimePrevRef.current = 0;
    saveSetting("rushLifetimeSolved", 0);
  };

  /* Opens a puzzle missed during the last rush outside of rush mode --
     Retry just replays it with unlimited tries via the normal Puzzle
     controls; Analyze additionally draws the solution's first move as a
     hint arrow (no engine call needed, the puzzle data already has it). */
  const reviewMissedPuzzle = (puzzle, reveal) => {
    setRushMode(false);
    setRushResult(null);
    startPuzzle(puzzle);
    if (reveal) {
      /* bestArrow gets wiped by the canAnalyze cleanup effect since a
         plain puzzle isn't an "analyzable" mode -- hintMove isn't touched
         by that effect and already renders a from/to square highlight
         (see isHintFrom/isHintTo), so it survives here. */
      const legal = eng.legalMoves();
      const mv = legal.find(x => eng.sanOf(x) === puzzle.moves[0]);
      if (mv) setHintMove({ from: mFrom(mv), to: mTo(mv) });
    }
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
      else if (settingsOpen) setSettingsOpen(false);
      else if (nameEditOpen) setNameEditOpen(false);
      else if (shareLinkFallback) setShareLinkFallback(null);
      else if (rushMode && rushResult) exitRush();
      else if (rushOpen) { setRushOpen(false); setPuzzlesOpen(true); }
      else if (rankedPuzzlesOpen) { setRankedPuzzlesOpen(false); setPuzzlesOpen(true); }
      else if (puzzlesOpen) setPuzzlesOpen(false);
      else if (openingsOpen) setOpeningsOpen(false);
      else if (musicOpen) setMusicOpen(false);
      else if (spectateOpen) setSpectateOpen(false);
      else if (pasteOpen) setPasteOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pieceDesignsOpen, boardColorsOpen, settingsOpen, nameEditOpen, shareLinkFallback, rushMode, rushResult, rushOpen, rankedPuzzlesOpen, puzzlesOpen, openingsOpen, musicOpen, spectateOpen, pasteOpen]);

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
        rushMissedRef.current = [...rushMissedRef.current, activePuzzle];
        setRushMissed(rushMissedRef.current);
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
        setRushLifetime(n => {
          const next = n + 1;
          saveSetting("rushLifetimeSolved", next);
          return next;
        });
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
    /* Bump first (see rankBotEpochRef): any adjustRankBotDial probe still
       in flight for the move(s) being undone will find its epoch stale
       and discard its result instead of logging/adjusting for a move
       that's about to stop existing. n===2 means a full player+bot pair
       is being undone -- if that player move was past the opening and
       already got tracked, unwind that bookkeeping too rather than
       leaving the count/window one move ahead of reality. */
    if (n === 2 && difficultyRef.current.id === "rank" && moveListRef.current.length - n >= RANK_BOT_OPENING_PLIES) {
      rankBotEpochRef.current += 1;
      rankBotWindowRef.current.pop();
      rankBotTrackedRef.current = Math.max(0, rankBotTrackedRef.current - 1);
    } else if (difficultyRef.current.id === "rank") {
      rankBotEpochRef.current += 1;
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
    runSearch(moveList, 800, 0, { personality: BALANCED, useBook: true }).then((res) => {
      if (res && res.move) setHintMove({ from: mFrom(res.move), to: mTo(res.move) });
      setHinting(false);
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
  const activeToolId = musicOpen ? "music" : settingsOpen ? "settings" : null;
  const analysisContent = activePuzzle ? (
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
  );

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

  /* Home page mode cards drop straight into the matching part of the
     Play screen rather than making the player navigate there themselves
     -- each of these already exists as its own control elsewhere in the
     app (the Puzzles/Openings/Spectate/Blind Chess icon-row buttons, the
     Rush row inside the Puzzles modal, the Rank Bot difficulty option),
     this just triggers the same state changes those already do. */
  const enterMode = (modeId) => {
    if (modeId === "leaderboard") { setSiteView("leaderboard"); return; }
    if (modeId === "settings") { setSiteView("play"); openSettings(); return; }
    setSiteView("play");
    if (modeId === "puzzles") { setPuzzlesOpen(true); ensurePuzzlesLoaded(); }
    else if (modeId === "openings") setOpeningsOpen(true);
    else if (modeId === "rush") { setRushOpen(true); ensurePuzzlesLoaded(); }
    else if (modeId === "spectate") setSpectateOpen(true);
    else if (modeId === "blind") setBlindOpen(true);
    else if (modeId === "rank") {
      const idx = DIFFICULTIES.findIndex(d => d.id === "rank");
      if (idx >= 0) onDifficultyChange(idx);
    }
  };

  if (siteView === "home") {
    return <HomePage onEnter={enterMode} />;
  }

  if (siteView === "leaderboard") {
    return (
      <LeaderboardPage
        initialDuration={leaderboardDuration}
        onBack={() => setSiteView("play")}
        onToolSelect={onToolSelect}
        activeToolId={activeToolId}
      />
    );
  }

  return (
    <div className={"root" + (hideEvalBar ? " noEval" : "") + (boardColorId === "standard" ? " theme-standard" : "")} style={{ "--boardLight": getBoardColor(boardColorId).light, "--boardDark": getBoardColor(boardColorId).dark }}>
      <StarField />
      {rushMilestone > 0 && <Confetti key={rushMilestone} />}
      <TopNav onSelect={onToolSelect} active={activeToolId} />

      <div className="layout">
        <div className="boardCol">
          {rushMode ? (
            <div className="card rushHud">
              <div className={"rushClock" + (rushTimeLeft <= 10 ? " low" : "")}>{formatClock(rushTimeLeft)}</div>
              <div className="rushHudBody">
                <div className="rushHudTop">
                  <span className="rushHudBand">{pz.RATING_BANDS[rushBandIdx]?.label || ""}</span>
                  <span className="rushHudSolved">Solved {rushSolved}</span>
                </div>
                <div className="rushMistakeBoxes" aria-label={`${rushMistakes} of 3 mistakes`}>
                  {[0, 1, 2].map(i => (
                    <span key={i} className={"rushMistakeBox" + (i < rushMistakes ? " filled" : "")} />
                  ))}
                </div>
                <div className="rushHudLifetime">Lifetime solved: {rushLifetime}</div>
              </div>
            </div>
          ) : activePuzzle ? (
            /* Neither the Rush HUD (clock/mistakes, a solo race) nor the
               bot-facing card (avatar/mood/name, an opponent framing) fit
               an untimed Daily/Ranked puzzle -- there's no clock and no
               one to "face", just a position and a rating. */
            <div className="card puzzleHud">
              <div className="avatarBox">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="var(--cyan)" aria-hidden="true">
                  <path d="M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-1.99.9-1.99 2v3.8H3.5c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.49 1.21-2.7 2.7-2.7s2.7 1.21 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5S21.88 11 20.5 11z" />
                </svg>
              </div>
              <div className="cardMeta">
                <div className="puzzleHudLabel">{puzzleBand ? `${puzzleBand.label} Puzzle` : "Daily Puzzle"}</div>
                <div className="trayEmpty puzzleMeta">Rated {activePuzzle.rating}</div>
              </div>
            </div>
          ) : (
            <div className={"card botCard" + (mode === "play" && !result && !thinking && eng.getSide() === botColor ? " turnGlow" : "")}>
              <div className={"avatarBox" + (botMood !== "neutral" ? " reactionBox " + botMood : "")}>
                {botMood === "angry" && <img src="/bot-angry.webp" alt="Zlegend2700 is furious" className="reactionImg" />}
                {botMood === "happy" && <img src="/bot-happy.webp" alt="Zlegend2700 is thrilled" className="reactionImg" />}
                {botMood === "neutral" && <PixelAvatar rows={ZPIX} pal={ZPAL} size={44} />}
              </div>
              <div className="cardMeta">
                <div className="cardName bot">{spectateMode ? `${DIFFICULTIES[botColor === 1 ? spectateWhiteIdx : spectateBlackIdx].label} (${botColor === 1 ? "White" : "Black"})` : "Zlegend2700"}</div>
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
              </div>
              {youDiff < 0 && <div className="lead">+{-youDiff}</div>}
            </div>
          )}

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
                {arrowLine && (() => {
                  /* Standard theme mimics chess.com's thicker, flat,
                     semi-transparent green best-move arrow; every other
                     theme keeps this app's original thin glowing-yellow
                     one. */
                  const std = boardColorId === "standard";
                  const color = std ? "#15A310" : "#F5D93E";
                  const opacity = std ? "0.8" : "0.85";
                  const width = std ? "0.22" : "0.14";
                  const headSize = std ? 4.4 : 3.2;
                  return (
                    <svg className="arrowLayer" viewBox="0 0 8 8" preserveAspectRatio="none">
                      <defs>
                        <marker id="bestArrowHead" markerWidth={headSize} markerHeight={headSize} refX={headSize * 0.47} refY={headSize / 2} orient="auto">
                          <path d={`M0,0 L${headSize},${headSize / 2} L0,${headSize} Z`} fill={color} fillOpacity={opacity} />
                        </marker>
                      </defs>
                      {arrowLine.bend ? (
                        <>
                          <line x1={arrowLine.a.x} y1={arrowLine.a.y} x2={arrowLine.bend.x} y2={arrowLine.bend.y}
                            stroke={color} strokeOpacity={opacity} strokeWidth={width} strokeLinecap="round" />
                          <line x1={arrowLine.bend.x} y1={arrowLine.bend.y} x2={arrowLine.b.x} y2={arrowLine.b.y}
                            stroke={color} strokeOpacity={opacity} strokeWidth={width} strokeLinecap="round" markerEnd="url(#bestArrowHead)" />
                        </>
                      ) : (
                        <line x1={arrowLine.a.x} y1={arrowLine.a.y} x2={arrowLine.b.x} y2={arrowLine.b.y}
                          stroke={color} strokeOpacity={opacity} strokeWidth={width} strokeLinecap="round" markerEnd="url(#bestArrowHead)" />
                      )}
                    </svg>
                  );
                })()}
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
                    ? `Calibrating Elo — game ${(rankBotGames % RANK_BOT_ASSESSMENT_EVERY) + 1}/${RANK_BOT_ASSESSMENT_EVERY}`
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
                    ? (puzzleFeedback || `Find the best move for ${eng.getSide() === 1 ? "White" : "Black"}.`)
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
          <div className="gamePanelSlot">
            <GamePanel
              pairs={pairs} moveGrades={moveGrades} curMoveIdx={curMoveIdx} reviewing={reviewing}
              onReviewIndex={setReviewIndex} gradeTag={GRADE_TAG}
              hasMoves={moveList.length > 0} onCopyPgn={onCopyPgn}
              onPastePgn={() => { setPasteOpen(true); setPasteError(null); }}
              pgnToast={pgnToast}
              analysisContent={analysisContent} analysisLabel={analysisLabel}
            />
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
              <button className="btn ghost" onClick={() => { exitPuzzle(); setSiteView("home"); }}>Exit</button>
            </div>
          )}

          {activePuzzle && rushMode && !rushResult && (
            <div className="ctrls puzzleCtrls">
              <button className="btn ghost" onClick={exitRush}>End Rush</button>
            </div>
          )}

        </div>
      </div>

      <SocialBanner />

      {blindOpen && (
        <Suspense fallback={null}>
          <BlindMode onClose={() => setBlindOpen(false)} />
        </Suspense>
      )}

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
              Puzzles
            </div>
            {!puzzlesData ? (
              <div className="pv" style={{ padding: "8px 2px" }}>Loading puzzles…</div>
            ) : (
              <div className="rows" style={{ maxHeight: "none" }}>
                <div style={{ cursor: "pointer", padding: "8px 2px", borderBottom: "1px solid #8B2FC92E" }}
                  onClick={() => { setPuzzlesOpen(false); setPuzzleBand(null); startPuzzle(dailyPuzzle(pz.PUZZLES)); }}>
                  <div style={{ fontWeight: 700, color: "var(--cyan)" }}>📅 Daily Puzzle</div>
                  <div style={{ fontSize: 11, opacity: 0.75 }}>
                    {dailySolvedDate === todayKey() ? "Solved today ✓" : "One puzzle, same for everyone today"}
                  </div>
                </div>
                <div style={{ cursor: "pointer", padding: "8px 2px", borderBottom: "1px solid #8B2FC92E" }}
                  onClick={() => { setPuzzlesOpen(false); setRankedPuzzlesOpen(true); }}>
                  <div style={{ fontWeight: 700, color: "var(--liliac)" }}>🎯 Ranked Puzzles</div>
                  <div style={{ fontSize: 11, opacity: 0.75 }}>Pick a rating band, Beginner to Expert</div>
                </div>
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

      {rankedPuzzlesOpen && (
        <div className="promoOv" style={{ position: "fixed", inset: 0, zIndex: 50 }} onClick={e => { if (e.target === e.currentTarget) { setRankedPuzzlesOpen(false); setPuzzlesOpen(true); } }}>
          <div className="promoBox" style={{ flexDirection: "column", gap: 12, minWidth: 260, maxWidth: 360, padding: "20px 24px" }}>
            <button className="modalCloseX" onClick={() => { setRankedPuzzlesOpen(false); setPuzzlesOpen(true); }} aria-label="Close Ranked Puzzles" title="Close">✕</button>
            <div className="boxHead" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <PixelAvatar rows={PPIX} pal={PPAL} size={18} />
              Ranked Puzzles — Pick a Rating
            </div>
            <div className="rows" style={{ maxHeight: "none" }}>
              {pz.RATING_BANDS.map(band => {
                const pool = puzzlesInBand(band);
                return (
                  <div key={band.id} style={{ cursor: pool.length ? "pointer" : "default", padding: "8px 2px", borderBottom: "1px solid #8B2FC92E", opacity: pool.length ? 1 : 0.4 }}
                    onClick={() => {
                      if (!pool.length) return;
                      setPuzzleBand(band);
                      setRankedPuzzlesOpen(false);
                      startPuzzle(pool[(Math.random() * pool.length) | 0]);
                    }}>
                    <div style={{ fontWeight: 700 }}>{band.label} <span style={{ opacity: 0.6, fontWeight: "normal" }}>({band.min}–{band.max === 9999 ? "2000+" : band.max})</span></div>
                    <div style={{ fontSize: 11, opacity: 0.75 }}>{pool.length} puzzle{pool.length === 1 ? "" : "s"}</div>
                  </div>
                );
              })}
            </div>
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
            <div className="rushCounterRow">
              <span>Lifetime solved: <b>{rushLifetime}</b></span>
              <button className="btn ghost" style={{ padding: "4px 10px", fontSize: 10 }} onClick={resetRushCounter}>Reset</button>
            </div>
            <button className="leaderboardBtn" onClick={() => openLeaderboard(rushDuration)}>🏆 View Leaderboard</button>
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
            {rushMissed.length > 0 && (
              <div className="rushMissedList">
                <div className="rushMissedHead">Missed puzzles</div>
                {rushMissed.map((p, i) => (
                  <div className="rushMissedRow" key={p.id + "-" + i}>
                    <span className="rushMissedRating">Rated {p.rating}</span>
                    <span className="rushMissedActions">
                      <button className="btn ghost" onClick={() => reviewMissedPuzzle(p, false)}>Retry</button>
                      <button className="btn ghost" onClick={() => reviewMissedPuzzle(p, true)}>Analyze</button>
                    </span>
                  </div>
                ))}
              </div>
            )}
            <button className="btn gold" onClick={retryRush}>Try Again</button>
            <button className="leaderboardBtn" onClick={() => openLeaderboard(rushDuration)}>🏆 View Leaderboard</button>
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

      {shareLinkFallback && (
        <div className="promoOv" style={{ position: "fixed", inset: 0, zIndex: 51 }} onClick={e => { if (e.target === e.currentTarget) setShareLinkFallback(null); }}>
          <div className="promoBox" style={{ flexDirection: "column", gap: 12, minWidth: 260, maxWidth: 400, padding: "20px 24px" }}>
            <button className="modalCloseX" onClick={() => setShareLinkFallback(null)} aria-label="Close" title="Close">✕</button>
            <div className="boxHead" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              Share This Game
            </div>
            <div className="pv" style={{ fontSize: 12, opacity: 0.85 }}>
              Couldn't copy automatically — tap the link below to select it, or hit Copy.
            </div>
            <input
              type="text" readOnly value={shareLinkFallback}
              onFocus={e => e.target.select()}
              style={{ width: "100%", boxSizing: "border-box", fontSize: 12, padding: "8px 10px", borderRadius: 8, background: "#150C24", color: "var(--white, #F4EFFF)", border: "1px solid #8B2FC966" }}
            />
            <button className="btn gold" onClick={async () => {
              try {
                await navigator.clipboard.writeText(shareLinkFallback);
                setShareLinkFallback(null);
                setShareToast("Link copied — send it to a viewer!");
                setTimeout(() => setShareToast(null), 2500);
              } catch { /* still selectable in the input above */ }
            }}>Copy</button>
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
              <div style={{ cursor: "pointer", padding: "8px 2px", borderBottom: "1px solid #8B2FC92E", display: "flex", alignItems: "center", gap: 10 }}
                onClick={() => { setSettingsOpen(false); setPieceDesignsOpen(true); }}>
                <img src={pieceImgSrc(1, true)} alt="" style={{ width: 30, height: 30, flex: "none", background: "#DDD6EA", borderRadius: 6, padding: 3, boxSizing: "border-box" }} />
                <div>
                  <div style={{ fontWeight: 700 }}>Piece Designs</div>
                  <div style={{ fontSize: 11, opacity: 0.75 }}>Currently: {getPieceSet(pieceSetId).label}</div>
                </div>
              </div>
              <div style={{ cursor: "pointer", padding: "8px 2px", borderBottom: "1px solid #8B2FC92E", display: "flex", alignItems: "center", gap: 10 }}
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
