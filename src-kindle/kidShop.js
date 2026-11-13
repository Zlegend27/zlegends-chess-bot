/* Coins + shop persistence for Kinnda Chess. Plain localStorage, no
   Supabase — this is a kid's cosmetic-only save file, not a lead or a
   game record, so it doesn't belong in the main app's data layer. */
import { TUNES } from "./kidTune";

const KEY = "kinnda-coins-shop-v1";

export const HATS = [
  { id: "none", label: "No Hat", price: 0 },
  { id: "party", label: "Party Hat", price: 30 },
  { id: "crown", label: "Crown", price: 60 },
  { id: "wizard", label: "Wizard Hat", price: 90 },
  { id: "ninja", label: "Ninja Band", price: 120 },
  { id: "flower", label: "Flower Crown", price: 150 },
];

export const BOARDS = [
  { id: "classic", label: "Classic", price: 0, light: "#FFF7E6", dark: "#BFE6C7" },
  { id: "ocean", label: "Ocean", price: 40, light: "#E6F7FF", dark: "#7FC8E8" },
  { id: "candy", label: "Candy", price: 40, light: "#FFE6F2", dark: "#FF9EC4" },
  { id: "sunset", label: "Sunset", price: 70, light: "#FFF0D9", dark: "#FFA85C" },
  { id: "forest", label: "Forest", price: 90, light: "#EFF6E4", dark: "#6FA860" },
  { id: "galaxy", label: "Galaxy", price: 110, light: "#EAE3FF", dark: "#7C64C4" },
];

/* Standard (the main site's usual chess pieces) is the default, free and
   always owned, so the board looks like a real chess board. "Bubbles"
   (id "classic") is Kinnda's old glyph-in-a-circle look, also free; Wood
   is unlocked with coins. */
export const PIECES = [
  { id: "standard", label: "Standard", price: 0 },
  { id: "classic", label: "Bubbles", price: 0 },
  { id: "wood", label: "Wood", price: 70 },
];

function defaultState() {
  return {
    coins: 0,
    ownedHats: ["none"], ownedBoards: ["classic"], ownedTunes: ["classic"], ownedAnimals: [], ownedPieces: ["standard", "classic"],
    equippedHat: "none", equippedBoard: "classic", equippedTune: "classic", equippedPiece: "standard",
    piecesV2: true,
    musicVolume: 60, dailyPuzzleSolvedDate: null,
    completedLessons: [], bestRushStreak: {},
    /* Wins per opponent id, for the trophy shelf. Coins get spent and
       vanish; this is the one number that only ever goes up, which is
       the point -- a kid needs somewhere to see that she's getting
       better, not just richer. */
    winsByAnimal: {},
    /* Consecutive days the daily puzzle has been solved. dailyStreak is
       the stored count; whether it's still ALIVE depends on the date
       (see liveDailyStreak in KindleApp) -- a stored 5 means nothing if
       the last solve was a fortnight ago. */
    dailyStreak: 0, dailyBestStreak: 0,
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    const state = { ...defaultState(), ...parsed };
    /* Saves from before Standard became the default: switch them to
       Standard once (and own it, free). After that the choice sticks. */
    if (!parsed.piecesV2) {
      state.piecesV2 = true;
      if (!state.ownedPieces.includes("standard")) state.ownedPieces = ["standard", ...state.ownedPieces];
      if (state.equippedPiece === "classic") state.equippedPiece = "standard";
    }
    return state;
  } catch {
    return defaultState();
  }
}

function save(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage unavailable */ }
}

export function loadShopState() { return load(); }

export function addCoins(state, amount) {
  const next = { ...state, coins: state.coins + amount };
  save(next);
  return next;
}

/** No-ops (same pattern as the buy* functions) if the kid can't afford
 *  it -- e.g. a hint -- rather than going negative; the caller should
 *  also disable that action in the UI, this is just the backstop. */
export function spendCoins(state, amount) {
  if (state.coins < amount) return state;
  const next = { ...state, coins: state.coins - amount };
  save(next);
  return next;
}

export function buyHat(state, hatId) {
  const hat = HATS.find(h => h.id === hatId);
  if (!hat || state.ownedHats.includes(hatId) || state.coins < hat.price) return state;
  const next = { ...state, coins: state.coins - hat.price, ownedHats: [...state.ownedHats, hatId] };
  save(next);
  return next;
}

export function buyBoard(state, boardId) {
  const board = BOARDS.find(b => b.id === boardId);
  if (!board || state.ownedBoards.includes(boardId) || state.coins < board.price) return state;
  const next = { ...state, coins: state.coins - board.price, ownedBoards: [...state.ownedBoards, boardId] };
  save(next);
  return next;
}

export function equipHat(state, hatId) {
  if (!state.ownedHats.includes(hatId)) return state;
  const next = { ...state, equippedHat: hatId };
  save(next);
  return next;
}

export function equipBoard(state, boardId) {
  if (!state.ownedBoards.includes(boardId)) return state;
  const next = { ...state, equippedBoard: boardId };
  save(next);
  return next;
}

export function buyTune(state, tuneId) {
  const tune = TUNES.find(t => t.id === tuneId);
  if (!tune || state.ownedTunes.includes(tuneId) || state.coins < tune.price) return state;
  const next = { ...state, coins: state.coins - tune.price, ownedTunes: [...state.ownedTunes, tuneId] };
  save(next);
  return next;
}

export function equipTune(state, tuneId) {
  if (!state.ownedTunes.includes(tuneId)) return state;
  const next = { ...state, equippedTune: tuneId };
  save(next);
  return next;
}

export function buyPiece(state, pieceId) {
  const piece = PIECES.find(p => p.id === pieceId);
  if (!piece || state.ownedPieces.includes(pieceId) || state.coins < piece.price) return state;
  const next = { ...state, coins: state.coins - piece.price, ownedPieces: [...state.ownedPieces, pieceId] };
  save(next);
  return next;
}

export function equipPiece(state, pieceId) {
  if (!state.ownedPieces.includes(pieceId)) return state;
  const next = { ...state, equippedPiece: pieceId };
  save(next);
  return next;
}

export function setMusicVolume(state, volume) {
  const next = { ...state, musicVolume: volume };
  save(next);
  return next;
}

/** Records today's daily-puzzle solve and advances the streak.
 *  `prevDayKey` is yesterday's key -- passed in rather than computed
 *  here so the date logic lives in exactly one place (KindleApp's
 *  dayKeyFrom), and so this stays a pure function of its arguments.
 *  Re-solving on a day already credited is a no-op, so the streak can't
 *  be farmed by replaying the same puzzle. */
export function markDailyPuzzleSolved(state, dateKey, prevDayKey) {
  if (state.dailyPuzzleSolvedDate === dateKey) return state;
  const streak = state.dailyPuzzleSolvedDate === prevDayKey ? (state.dailyStreak || 0) + 1 : 1;
  const next = {
    ...state,
    dailyPuzzleSolvedDate: dateKey,
    dailyStreak: streak,
    dailyBestStreak: Math.max(state.dailyBestStreak || 0, streak),
  };
  save(next);
  return next;
}

/** One more win against a given opponent. Never resets. */
export function recordWin(state, animalId) {
  const winsByAnimal = { ...state.winsByAnimal, [animalId]: (state.winsByAnimal?.[animalId] || 0) + 1 };
  const next = { ...state, winsByAnimal };
  save(next);
  return next;
}

/* Animal opponents aren't "equipped" -- once unlocked they just appear as
   an extra option in the difficulty picker, so there's no equip step. */
export function buyAnimal(state, animalId, price) {
  if (state.ownedAnimals.includes(animalId) || state.coins < price) return state;
  const next = { ...state, coins: state.coins - price, ownedAnimals: [...state.ownedAnimals, animalId] };
  save(next);
  return next;
}

/** One-time coin reward for finishing a Lessons chapter -- no-ops on
 *  repeat playthroughs (coins were already paid out) so a kid can revisit
 *  a chapter to review without farming it. */
export function markLessonComplete(state, lessonId, reward = 20) {
  if (state.completedLessons.includes(lessonId)) return state;
  const next = { ...state, coins: state.coins + reward, completedLessons: [...state.completedLessons, lessonId] };
  save(next);
  return next;
}

/** Personal-best tracker for Puzzle Rush, keyed by duration -- a kid's
 *  own trophy case instead of a public leaderboard, which feels wrong to
 *  ship for a kids product. */
export function recordRushResult(state, seconds, solved) {
  const key = String(seconds);
  const prevBest = state.bestRushStreak[key] || 0;
  if (solved <= prevBest) return state;
  const next = { ...state, bestRushStreak: { ...state.bestRushStreak, [key]: solved } };
  save(next);
  return next;
}
