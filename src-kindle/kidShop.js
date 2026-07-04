/* Coins + shop persistence for Kinnda Chess. Plain localStorage, no
   Supabase — this is a kid's cosmetic-only save file, not a lead or a
   game record, so it doesn't belong in the main app's data layer. */
const KEY = "kinnda-coins-shop-v1";

export const HATS = [
  { id: "none", label: "No Hat", price: 0 },
  { id: "party", label: "Party Hat", price: 30 },
  { id: "crown", label: "Crown", price: 60 },
  { id: "wizard", label: "Wizard Hat", price: 90 },
];

export const BOARDS = [
  { id: "classic", label: "Classic", price: 0, light: "#FFF7E6", dark: "#BFE6C7" },
  { id: "ocean", label: "Ocean", price: 40, light: "#E6F7FF", dark: "#7FC8E8" },
  { id: "candy", label: "Candy", price: 40, light: "#FFE6F2", dark: "#FF9EC4" },
  { id: "sunset", label: "Sunset", price: 70, light: "#FFF0D9", dark: "#FFA85C" },
];

function defaultState() {
  return { coins: 0, ownedHats: ["none"], ownedBoards: ["classic"], equippedHat: "none", equippedBoard: "classic" };
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
