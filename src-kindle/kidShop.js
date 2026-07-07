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

/* "Classic" here is Kinnda's own glyph-in-a-circle look (free, always
   owned) -- Standard and Wood are the same SVG piece sets the main site
   uses, unlocked with coins like everything else in the shop. */
export const PIECES = [
  { id: "classic", label: "Classic", price: 0 },
  { id: "standard", label: "Standard", price: 50 },
  { id: "wood", label: "Wood", price: 70 },
];

function defaultState() {
  return {
    coins: 0,
    ownedHats: ["none"], ownedBoards: ["classic"], ownedTunes: ["classic"], ownedAnimals: [], ownedPieces: ["classic"],
    equippedHat: "none", equippedBoard: "classic", equippedTune: "classic", equippedPiece: "classic",
    musicVolume: 60, dailyPuzzleSolvedDate: null,
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return { ...defaultState(), ...parsed };
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

export function markDailyPuzzleSolved(state, dateKey) {
  const next = { ...state, dailyPuzzleSolvedDate: dateKey };
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
