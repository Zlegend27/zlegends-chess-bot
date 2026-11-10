/* Makes the positions for Kinnda's capture and check drills
   (src-kindle/kidDrills.json). Random but repeatable (fixed seed): kings
   and a few pieces each, White to move, nobody in check, and each position
   chosen so the drill has a clear answer:
   - freeLunch: exactly one capture wins material, and no capture loses it.
   - careful: at least one capture wins material and at least one loses it
     (a defended piece taken with a dearer one), so she has to look first.
   - giveCheck: one to three checks, none of them mate.
   Usage: node scripts/kinnda/makeDrills.mjs */
import { writeFileSync } from "node:fs";
import { createEngine } from "../../src/engine/chessEngine.js";
import { goodCapture, badCapture, isCapture, checkOf } from "../../src-kindle/kidRules.js";

const COUNT = 14;
let seed = 20261110;
const rand = () => { seed = (seed + 0x6d2b79f5) | 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (arr) => arr[(rand() * arr.length) | 0];

/* Pieces drawn for each side: mostly minor pieces and pawns, like a child's games. */
const BAG = "PPPPNNBBRRQ";

function randomFen() {
  const board = Array(64).fill(null);
  const put = (c, avoidEdgeRanks) => {
    for (let t = 0; t < 50; t++) {
      const sq = (rand() * 64) | 0;
      const rank = (sq / 8) | 0;
      if (board[sq] || (avoidEdgeRanks && (rank === 0 || rank === 7))) continue;
      board[sq] = c;
      return true;
    }
    return false;
  };
  put("K"); put("k");
  const n = 3 + ((rand() * 3) | 0);
  for (let i = 0; i < n; i++) { const p = pick(BAG); put(p, p === "P"); }
  for (let i = 0; i < n; i++) { const p = pick(BAG); put(p.toLowerCase(), p === "P"); }
  let fen = "";
  for (let r = 7; r >= 0; r--) {
    let empty = 0;
    for (let f = 0; f < 8; f++) {
      const c = board[r * 8 + f];
      if (!c) { empty++; continue; }
      if (empty) { fen += empty; empty = 0; }
      fen += c;
    }
    if (empty) fen += empty;
    if (r) fen += "/";
  }
  return `${fen} w - - 0 1`;
}

/* Kings next to each other, or Black in check (White to move), make a
   position impossible; the engine refuses or mis-handles those. */
function sane(eng) {
  if (eng.inCheckNow()) return false;
  const fen = eng.fen().split(" ");
  fen[1] = "b";
  const other = createEngine();
  other.loadFen(fen.join(" "));
  return !other.inCheckNow() && eng.legalMoves().length > 0;
}

const out = { freeLunch: [], careful: [], giveCheck: [] };
const eng = createEngine();
for (let tries = 0; tries < 200000 && Object.values(out).some((l) => l.length < COUNT); tries++) {
  const fen = randomFen();
  try { eng.loadFen(fen); } catch { continue; }
  if (!sane(eng)) continue;
  const legal = eng.legalMoves();
  const caps = legal.filter((m) => isCapture(eng, m));
  const good = caps.filter((m) => goodCapture(eng, m));
  const bad = caps.filter((m) => badCapture(eng, m));
  const checks = legal.map((m) => checkOf(eng, m)).filter((c) => c.check);
  if (out.freeLunch.length < COUNT && good.length === 1 && bad.length === 0 && caps.length <= 3) out.freeLunch.push(fen);
  else if (out.careful.length < COUNT && good.length >= 1 && bad.length >= 1 && caps.length <= 4) out.careful.push(fen);
  else if (out.giveCheck.length < COUNT && checks.length >= 1 && checks.length <= 3 && !checks.some((c) => c.mate) && caps.length === 0) out.giveCheck.push(fen);
}
writeFileSync(new URL("../../src-kindle/kidDrills.json", import.meta.url), JSON.stringify(out, null, 1));
console.log(Object.entries(out).map(([k, v]) => `${k} ${v.length}`).join(", "));
