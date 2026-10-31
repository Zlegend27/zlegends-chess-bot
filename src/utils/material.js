import { EMPTY, WK } from "../engine/chessEngine";

export const PTS = { 1: 1, 2: 3, 3: 3, 4: 5, 5: 9 };

export const START_COUNT = { 1: 8, 2: 2, 3: 2, 4: 2, 5: 1 };

export function materialState(eng) {
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
