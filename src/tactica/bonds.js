/* Bonds: each kind of character (all your pawns together, all your knights,
   and so on) grows closer to you as it plays correct puzzle moves. A
   capture or the move that finishes a puzzle counts for more. Bond levels
   show on the board as a glow and trim on your own characters. Saved on
   this device. */
import { loadSetting, saveSetting } from "../utils/storage";

export const BOND_KINDS = ["pawn", "knight", "bishop", "rook", "queen", "king"];
export const KIND_NAMES = { pawn: "Pawn", knight: "Knight", bishop: "Bishop", rook: "Rook", queen: "Queen", king: "King" };
/* Indexed by the engine's piece type (1 pawn ... 6 king). */
const BY_TYPE = [null, ...BOND_KINDS];

export const XP_MOVE = 10, XP_CAPTURE = 10, XP_FINAL = 15;
/* Total XP needed to reach each level, level 1 first. */
export const LEVEL_XP = [0, 100, 300, 700, 1500];
export const MAX_LEVEL = LEVEL_XP.length;
/* What each level looks like on the board. */
export const LOOKS = [
  "No glow yet",
  "A warm glow at its feet",
  "Silver trim",
  "Gold trim and a brighter glow",
  "A radiant aura",
];

const KEY = "tacticaBonds";

export const kindOfType = (type) => BY_TYPE[Math.abs(type)] ?? null;

/** XP for one correct move. */
export function xpForMove({ capture = false, final = false } = {}) {
  return XP_MOVE + (capture ? XP_CAPTURE : 0) + (final ? XP_FINAL : 0);
}

export function levelFor(xp) {
  let level = 1;
  for (let i = 1; i < LEVEL_XP.length; i++) if (xp >= LEVEL_XP[i]) level = i + 1;
  return level;
}

/** Where a kind stands: its level, XP into that level and XP the level
 *  needs (both null at the top level). */
export function progress(xp) {
  const level = levelFor(xp);
  if (level >= MAX_LEVEL) return { level, into: null, need: null };
  return { level, into: xp - LEVEL_XP[level - 1], need: LEVEL_XP[level] - LEVEL_XP[level - 1] };
}

/** Adds XP to a kind. Returns the new bonds (not changing the old) and
 *  the new level if it went up. */
export function award(bonds, kind, xp) {
  const before = bonds[kind] ?? 0;
  const next = { ...bonds, [kind]: before + xp };
  const from = levelFor(before), to = levelFor(before + xp);
  return { bonds: next, levelUp: to > from ? to : null };
}

/** Bond levels by kind, as the 3D scene wants them. */
export function levelsOf(bonds) {
  return Object.fromEntries(BOND_KINDS.map((k) => [k, levelFor(bonds[k] ?? 0)]));
}

export function loadBonds() {
  const saved = loadSetting(KEY, {});
  return saved && typeof saved === "object" ? saved : {};
}

/** Records a correct move by a piece of engine `type` and saves it.
 *  Returns { bonds, kind, levelUp }. */
export function recordMove(type, { capture = false, final = false } = {}) {
  const kind = kindOfType(type);
  const bonds = loadBonds();
  if (!kind) return { bonds, kind: null, levelUp: null };
  const res = award(bonds, kind, xpForMove({ capture, final }));
  saveSetting(KEY, res.bonds);
  return { bonds: res.bonds, kind, levelUp: res.levelUp };
}

/** The note shown when a bond grows. */
export const levelUpText = (kind, level) => `${KIND_NAMES[kind]} bond ${level}: ${LOOKS[level - 1].toLowerCase()}`;
