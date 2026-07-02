/* ================================================================
   ZLEGEND'S CHESS BOT — chess engine
   10x12 mailbox, iterative deepening negamax + alpha-beta,
   quiescence, transposition table, killer/history ordering,
   tapered piece-square evaluation.
   ================================================================ */

export const OFF = 99, EMPTY = 0;
export const WP = 1, WN = 2, WB = 3, WR = 4, WQ = 5, WK = 6;
export const M64TO120 = [], M120TO64 = new Array(120).fill(-1);
for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
  const s = 21 + r * 10 + f;
  M64TO120[r * 8 + f] = s; M120TO64[s] = r * 8 + f;
}
const N_OFF = [-21, -19, -12, -8, 8, 12, 19, 21];
const B_OFF = [-11, -9, 9, 11];
const R_OFF = [-10, -1, 1, 10];
const K_OFF = [-11, -10, -9, -1, 1, 9, 10, 11];
const VAL = [0, 100, 320, 330, 500, 900, 20000];
export const rankOf = s => ((s / 10) | 0) - 2;
export const fileOf = s => (s % 10) - 1;

function xorshift(seed) {
  let x = seed >>> 0;
  return () => { x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0; return x; };
}
const rnd = xorshift(0x9d2c5680);
const Z_PIECE = []; for (let p = 0; p < 12; p++) { Z_PIECE.push([]); for (let s = 0; s < 64; s++) Z_PIECE[p].push(rnd()); }
const Z_SIDE = rnd();
const Z_CASTLE = []; for (let i = 0; i < 16; i++) Z_CASTLE.push(rnd());
const Z_EP = []; for (let i = 0; i < 8; i++) Z_EP.push(rnd());
const pieceIdx = p => (p > 0 ? p - 1 : 5 - p);

const CASTLE_MASK = new Array(120).fill(15);
CASTLE_MASK[25] = 12; CASTLE_MASK[21] = 13; CASTLE_MASK[28] = 14;
CASTLE_MASK[95] = 3;  CASTLE_MASK[91] = 7;  CASTLE_MASK[98] = 11;

const PST_P = [
   0,  0,  0,  0,  0,  0,  0,  0,
  60, 60, 60, 60, 60, 60, 60, 60,
  10, 10, 25, 35, 35, 25, 10, 10,
   5,  5, 12, 28, 28, 12,  5,  5,
   0,  0,  8, 24, 24,  8,  0,  0,
   5, -5, -8,  2,  2, -8, -5,  5,
   5, 10, 10,-22,-22, 10, 10,  5,
   0,  0,  0,  0,  0,  0,  0,  0];
const PST_P_EG = [
   0,  0,  0,  0,  0,  0,  0,  0,
  95, 95, 90, 85, 85, 90, 95, 95,
  55, 55, 50, 45, 45, 50, 55, 55,
  30, 28, 24, 20, 20, 24, 28, 30,
  14, 12, 10,  8,  8, 10, 12, 14,
   4,  4,  2,  2,  2,  2,  4,  4,
   2,  2,  2,  2,  2,  2,  2,  2,
   0,  0,  0,  0,  0,  0,  0,  0];
const PST_N = [
 -50,-40,-30,-30,-30,-30,-40,-50,
 -40,-20,  0,  0,  0,  0,-20,-40,
 -30,  0, 10, 15, 15, 10,  0,-30,
 -30,  5, 15, 20, 20, 15,  5,-30,
 -30,  0, 15, 20, 20, 15,  0,-30,
 -30,  5, 10, 15, 15, 10,  5,-30,
 -40,-20,  0,  5,  5,  0,-20,-40,
 -50,-40,-30,-30,-30,-30,-40,-50];
const PST_B = [
 -20,-10,-10,-10,-10,-10,-10,-20,
 -10,  0,  0,  0,  0,  0,  0,-10,
 -10,  0,  5, 10, 10,  5,  0,-10,
 -10,  5,  5, 10, 10,  5,  5,-10,
 -10,  0, 10, 10, 10, 10,  0,-10,
 -10, 10, 10, 10, 10, 10, 10,-10,
 -10,  5,  0,  0,  0,  0,  5,-10,
 -20,-10,-10,-10,-10,-10,-10,-20];
const PST_R = [
   0,  0,  0,  0,  0,  0,  0,  0,
   5, 10, 10, 10, 10, 10, 10,  5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
   0,  0,  0,  5,  5,  0,  0,  0];
const PST_Q = [
 -20,-10,-10, -5, -5,-10,-10,-20,
 -10,  0,  0,  0,  0,  0,  0,-10,
 -10,  0,  5,  5,  5,  5,  0,-10,
  -5,  0,  5,  5,  5,  5,  0, -5,
   0,  0,  5,  5,  5,  5,  0, -5,
 -10,  5,  5,  5,  5,  5,  0,-10,
 -10,  0,  5,  0,  0,  0,  0,-10,
 -20,-10,-10, -5, -5,-10,-10,-20];
const PST_K_MG = [
 -30,-40,-40,-50,-50,-40,-40,-30,
 -30,-40,-40,-50,-50,-40,-40,-30,
 -30,-40,-40,-50,-50,-40,-40,-30,
 -30,-40,-40,-50,-50,-40,-40,-30,
 -20,-30,-30,-40,-40,-30,-30,-20,
 -10,-20,-20,-20,-20,-20,-20,-10,
  20, 20,  0,  0,  0,  0, 20, 20,
  20, 30, 10,  0,  0, 10, 30, 20];
const PST_K_EG = [
 -50,-40,-30,-20,-20,-30,-40,-50,
 -30,-20,-10,  0,  0,-10,-20,-30,
 -30,-10, 20, 30, 30, 20,-10,-30,
 -30,-10, 30, 40, 40, 30,-10,-30,
 -30,-10, 30, 40, 40, 30,-10,-30,
 -30,-10, 20, 30, 30, 20,-10,-30,
 -30,-30,  0,  0,  0,  0,-30,-30,
 -50,-30,-30,-30,-30,-30,-30,-50];
const PST_MG = [null, PST_P, PST_N, PST_B, PST_R, PST_Q, PST_K_MG];
const PST_EG = [null, PST_P_EG, PST_N, PST_B, PST_R, PST_Q, PST_K_EG];
const PHASE_W = [0, 0, 1, 1, 2, 4, 0];
export const MATE = 100000;

export const mFrom = m => m & 127, mTo = m => (m >> 7) & 127, mPromo = m => (m >> 14) & 7, mFlags = m => (m >> 18) & 7;
export const mk = (from, to, promo = 0, flags = 0) => from | (to << 7) | (promo << 14) | (flags << 18);

export function createEngine() {
  const board = new Int8Array(120).fill(OFF);
  let side = 1, castle = 15, ep = 0, half = 0, key = 0, wk = 25, bk = 95;
  const hist = [];
  let tt = new Map();
  const killers = Array.from({ length: 64 }, () => [0, 0]);
  const histH = Array.from({ length: 13 }, () => new Int32Array(120));
  let nodes = 0, stopAt = 0, stopped = false;

  function reset() {
    board.fill(OFF);
    for (let i = 0; i < 64; i++) board[M64TO120[i]] = EMPTY;
    const back = [WR, WN, WB, WQ, WK, WB, WN, WR];
    for (let f = 0; f < 8; f++) {
      board[21 + f] = back[f]; board[31 + f] = WP;
      board[81 + f] = -WP; board[91 + f] = -back[f];
    }
    side = 1; castle = 15; ep = 0; half = 0; wk = 25; bk = 95;
    hist.length = 0; tt = new Map();
    key = computeKey();
  }
  function computeKey() {
    let k = 0;
    for (let i = 0; i < 64; i++) { const p = board[M64TO120[i]]; if (p !== EMPTY) k ^= Z_PIECE[pieceIdx(p)][i]; }
    if (side === -1) k ^= Z_SIDE;
    k ^= Z_CASTLE[castle];
    if (ep) k ^= Z_EP[fileOf(ep)];
    return k >>> 0;
  }
  function attacked(sq, by) {
    if (by === 1) { if (board[sq - 9] === WP || board[sq - 11] === WP) return true; }
    else { if (board[sq + 9] === -WP || board[sq + 11] === -WP) return true; }
    for (const o of N_OFF) if (board[sq + o] === by * WN) return true;
    for (const o of K_OFF) if (board[sq + o] === by * WK) return true;
    for (const o of B_OFF) { let t = sq + o; while (board[t] === EMPTY) t += o; const p = board[t]; if (p === by * WB || p === by * WQ) return true; }
    for (const o of R_OFF) { let t = sq + o; while (board[t] === EMPTY) t += o; const p = board[t]; if (p === by * WR || p === by * WQ) return true; }
    return false;
  }
  const inCheck = s => attacked(s === 1 ? wk : bk, -s);

  function genPseudo(capsOnly) {
    const out = [];
    const push = (f, t, pr = 0, fl = 0) => out.push(mk(f, t, pr, fl));
    const pushPawn = (f, t, fl = 0) => {
      const r = rankOf(t);
      if (r === 7 || r === 0) { push(f, t, WQ, fl); push(f, t, WR, fl); push(f, t, WB, fl); push(f, t, WN, fl); }
      else push(f, t, 0, fl);
    };
    for (let i = 0; i < 64; i++) {
      const from = M64TO120[i], p = board[from];
      if (p === EMPTY || p * side <= 0) continue;
      const ap = p * side;
      if (ap === WP) {
        const fwd = side === 1 ? 10 : -10;
        if (!capsOnly && board[from + fwd] === EMPTY) {
          pushPawn(from, from + fwd);
          const home = side === 1 ? 1 : 6;
          if (rankOf(from) === home && board[from + 2 * fwd] === EMPTY) push(from, from + 2 * fwd, 0, 2);
        }
        for (const d of [fwd - 1, fwd + 1]) {
          const t = from + d, q = board[t];
          if (q !== OFF && q !== EMPTY && q * side < 0) pushPawn(from, t);
          else if (ep && t === ep) push(from, t, 0, 1);
        }
      } else if (ap === WN || ap === WK) {
        for (const o of (ap === WN ? N_OFF : K_OFF)) {
          const t = from + o, q = board[t];
          if (q === OFF) continue;
          if (q === EMPTY) { if (!capsOnly) push(from, t); }
          else if (q * side < 0) push(from, t);
        }
        if (ap === WK && !capsOnly) {
          if (side === 1) {
            if ((castle & 1) && board[26] === EMPTY && board[27] === EMPTY && !attacked(25, -1) && !attacked(26, -1) && !attacked(27, -1)) push(25, 27, 0, 4);
            if ((castle & 2) && board[24] === EMPTY && board[23] === EMPTY && board[22] === EMPTY && !attacked(25, -1) && !attacked(24, -1) && !attacked(23, -1)) push(25, 23, 0, 4);
          } else {
            if ((castle & 4) && board[96] === EMPTY && board[97] === EMPTY && !attacked(95, 1) && !attacked(96, 1) && !attacked(97, 1)) push(95, 97, 0, 4);
            if ((castle & 8) && board[94] === EMPTY && board[93] === EMPTY && board[92] === EMPTY && !attacked(95, 1) && !attacked(94, 1) && !attacked(93, 1)) push(95, 93, 0, 4);
          }
        }
      } else {
        const offs = ap === WB ? B_OFF : ap === WR ? R_OFF : K_OFF;
        for (const o of offs) {
          let t = from + o;
          while (board[t] !== OFF) {
            const q = board[t];
            if (q === EMPTY) { if (!capsOnly) push(from, t); }
            else { if (q * side < 0) push(from, t); break; }
            t += o;
          }
        }
      }
    }
    return out;
  }

  function make(m) {
    const from = mFrom(m), to = mTo(m), fl = mFlags(m), pr = mPromo(m);
    const piece = board[from];
    let captured = board[to], capSq = to;
    if (fl & 1) { capSq = side === 1 ? to - 10 : to + 10; captured = board[capSq]; }
    hist.push({ m, captured, capSq, castle, ep, half, key, piece });
    key ^= Z_SIDE;
    if (ep) key ^= Z_EP[fileOf(ep)];
    key ^= Z_CASTLE[castle];
    if (captured !== EMPTY) { key ^= Z_PIECE[pieceIdx(captured)][M120TO64[capSq]]; board[capSq] = EMPTY; }
    key ^= Z_PIECE[pieceIdx(piece)][M120TO64[from]];
    board[from] = EMPTY;
    const placed = pr ? pr * side : piece;
    board[to] = placed;
    key ^= Z_PIECE[pieceIdx(placed)][M120TO64[to]];
    if (fl & 4) {
      let rf, rt;
      if (to === 27) { rf = 28; rt = 26; } else if (to === 23) { rf = 21; rt = 24; }
      else if (to === 97) { rf = 98; rt = 96; } else { rf = 91; rt = 94; }
      const rook = board[rf];
      key ^= Z_PIECE[pieceIdx(rook)][M120TO64[rf]] ^ Z_PIECE[pieceIdx(rook)][M120TO64[rt]];
      board[rt] = rook; board[rf] = EMPTY;
    }
    if (piece === WK) wk = to; else if (piece === -WK) bk = to;
    castle &= CASTLE_MASK[from] & CASTLE_MASK[to];
    key ^= Z_CASTLE[castle];
    ep = (fl & 2) ? (side === 1 ? from + 10 : from - 10) : 0;
    if (ep) key ^= Z_EP[fileOf(ep)];
    half = (captured !== EMPTY || Math.abs(piece) === WP) ? 0 : half + 1;
    side = -side;
    key >>>= 0;
    if (inCheck(-side)) { unmake(); return false; }
    return true;
  }
  function unmake() {
    const h = hist.pop();
    const from = mFrom(h.m), to = mTo(h.m), fl = mFlags(h.m);
    side = -side;
    board[from] = h.piece;
    board[to] = EMPTY;
    if (h.captured !== EMPTY) board[h.capSq] = h.captured;
    if (fl & 4) {
      let rf, rt;
      if (to === 27) { rf = 28; rt = 26; } else if (to === 23) { rf = 21; rt = 24; }
      else if (to === 97) { rf = 98; rt = 96; } else { rf = 91; rt = 94; }
      board[rf] = board[rt]; board[rt] = EMPTY;
    }
    if (h.piece === WK) wk = from; else if (h.piece === -WK) bk = from;
    castle = h.castle; ep = h.ep; half = h.half; key = h.key;
  }

  function legalMoves() {
    const out = [];
    for (const m of genPseudo(false)) if (make(m)) { unmake(); out.push(m); }
    return out;
  }

  function evaluate() {
    let mg = 0, eg = 0, phase = 0, wb = 0, bb = 0;
    for (let i = 0; i < 64; i++) {
      const p = board[M64TO120[i]];
      if (p === EMPTY) continue;
      const a = Math.abs(p), r = (i / 8) | 0, f = i % 8;
      phase += PHASE_W[a];
      const idx = p > 0 ? (7 - r) * 8 + f : r * 8 + f;
      const s = p > 0 ? 1 : -1;
      mg += s * (VAL[a] + PST_MG[a][idx]);
      eg += s * (VAL[a] + PST_EG[a][idx]);
      if (p === WB) wb++; else if (p === -WB) bb++;
    }
    if (wb >= 2) { mg += 30; eg += 40; }
    if (bb >= 2) { mg -= 30; eg -= 40; }
    if (phase > 24) phase = 24;
    let score = ((mg * phase + eg * (24 - phase)) / 24) | 0;
    score += side === 1 ? 10 : -10;
    return side === 1 ? score : -score;
  }

  function orderScore(m, ttMove, ply) {
    if (m === ttMove) return 2000000000;
    const to = mTo(m), fl = mFlags(m);
    let victim = board[to];
    if (fl & 1) victim = -side * WP;
    if (victim !== EMPTY) return 1000000 + VAL[Math.abs(victim)] * 16 - VAL[Math.abs(board[mFrom(m)])];
    if (mPromo(m)) return 900000 + VAL[mPromo(m)];
    if (killers[ply] && killers[ply][0] === m) return 800000;
    if (killers[ply] && killers[ply][1] === m) return 790000;
    return histH[pieceIdx(board[mFrom(m)]) + 1][mTo(m)] | 0;
  }
  function sortMoves(moves, ttMove, ply) {
    const scored = moves.map(m => [orderScore(m, ttMove, ply), m]);
    scored.sort((a, b) => b[0] - a[0]);
    return scored.map(x => x[1]);
  }

  function qsearch(alpha, beta) {
    nodes++;
    if ((nodes & 2047) === 0 && Date.now() > stopAt) stopped = true;
    if (stopped) return 0;
    const stand = evaluate();
    if (stand >= beta) return beta;
    if (stand > alpha) alpha = stand;
    let moves = genPseudo(true);
    moves = sortMoves(moves, 0, 63);
    for (const m of moves) {
      if (!make(m)) continue;
      const score = -qsearch(-beta, -alpha);
      unmake();
      if (stopped) return 0;
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }

  function repInSearch() {
    let count = 0;
    for (let i = hist.length - 1; i >= 0; i--) {
      if (hist[i].key === key) count++;
      if (count >= 1) return true;
      if (hist[i].half === 0) break;
    }
    return false;
  }

  function negamax(depth, alpha, beta, ply) {
    nodes++;
    if ((nodes & 2047) === 0 && Date.now() > stopAt) stopped = true;
    if (stopped) return 0;
    if (ply > 0 && (half >= 100 || repInSearch())) return 0;
    const alphaOrig = alpha;
    const entry = tt.get(key);
    let ttMove = 0;
    if (entry) {
      ttMove = entry.move;
      if (entry.depth >= depth && ply > 0) {
        if (entry.flag === 0) return entry.score;
        if (entry.flag === 1 && entry.score >= beta) return entry.score;
        if (entry.flag === 2 && entry.score <= alpha) return entry.score;
      }
    }
    const check = inCheck(side);
    if (depth <= 0 && !check) return qsearch(alpha, beta);
    if (depth <= 0) depth = 1;
    let moves = sortMoves(genPseudo(false), ttMove, ply);
    let legal = 0, bestScore = -Infinity, bestMove = 0;
    for (const m of moves) {
      if (!make(m)) continue;
      legal++;
      const score = -negamax(depth - 1, -beta, -alpha, ply + 1);
      unmake();
      if (stopped) return 0;
      if (score > bestScore) { bestScore = score; bestMove = m; }
      if (score > alpha) {
        alpha = score;
        if (alpha >= beta) {
          if (board[mTo(m)] === EMPTY && !mPromo(m)) {
            if (killers[ply][0] !== m) { killers[ply][1] = killers[ply][0]; killers[ply][0] = m; }
            histH[pieceIdx(board[mFrom(m)]) + 1][mTo(m)] += depth * depth;
          }
          break;
        }
      }
    }
    if (legal === 0) return check ? -MATE + ply : 0;
    if (tt.size > 1200000) tt.clear();
    tt.set(key, { depth, score: bestScore, move: bestMove, flag: bestScore <= alphaOrig ? 2 : bestScore >= beta ? 1 : 0 });
    return bestScore;
  }

  function search(timeMs, blunderChance = 0) {
    nodes = 0; stopped = false; stopAt = Date.now() + timeMs;
    for (let i = 0; i < 64; i++) { killers[i][0] = 0; killers[i][1] = 0; }
    const t0 = Date.now();
    let best = 0, bestScore = 0, completedDepth = 0;
    const rootMoves = legalMoves();
    if (rootMoves.length === 0) return null;
    if (blunderChance > 0 && Math.random() < blunderChance) {
      const randomMove = rootMoves[(Math.random() * rootMoves.length) | 0];
      return { move: randomMove, score: 0, depth: 0, nodes: 0, time: 0 };
    }
    best = rootMoves[0];
    for (let depth = 1; depth <= 60; depth++) {
      let iterBest = 0, iterScore = -Infinity;
      let alpha = -Infinity;
      const ordered = sortMoves(rootMoves, best, 0);
      for (const m of ordered) {
        if (!make(m)) continue;
        const s = -negamax(depth - 1, -Infinity, -alpha, 1);
        unmake();
        if (stopped) break;
        if (s > iterScore) { iterScore = s; iterBest = m; }
        if (s > alpha) alpha = s;
      }
      if (stopped) break;
      if (iterBest) { best = iterBest; bestScore = iterScore; completedDepth = depth; }
      if (Math.abs(bestScore) > MATE - 200) break;
      if (Date.now() - t0 > timeMs * 0.6) break;
    }
    return { move: best, score: bestScore, depth: completedDepth, nodes, time: Date.now() - t0 };
  }

  function pvLine(maxLen) {
    const line = [];
    for (let i = 0; i < maxLen; i++) {
      const e = tt.get(key);
      if (!e || !e.move) break;
      const legal = legalMoves();
      if (!legal.includes(e.move)) break;
      line.push(sanOf(e.move));
      make(e.move);
    }
    for (let i = 0; i < line.length; i++) unmake();
    return line;
  }

  const FILES_S = "abcdefgh";
  const sqName = s => FILES_S[fileOf(s)] + (rankOf(s) + 1);
  const PIECE_LETTER = ["", "", "N", "B", "R", "Q", "K"];
  function sanOf(m) {
    const from = mFrom(m), to = mTo(m), fl = mFlags(m), pr = mPromo(m);
    const piece = Math.abs(board[from]);
    let san;
    if (fl & 4) san = (to === 27 || to === 97) ? "O-O" : "O-O-O";
    else {
      const isCap = board[to] !== EMPTY || (fl & 1);
      if (piece === WP) san = (isCap ? FILES_S[fileOf(from)] + "x" : "") + sqName(to) + (pr ? "=" + PIECE_LETTER[pr] : "");
      else {
        let dis = "";
        const others = legalMoves().filter(o => o !== m && mTo(o) === to && Math.abs(board[mFrom(o)]) === piece);
        if (others.length) {
          const sameFile = others.some(o => fileOf(mFrom(o)) === fileOf(from));
          const sameRank = others.some(o => rankOf(mFrom(o)) === rankOf(from));
          if (!sameFile) dis = FILES_S[fileOf(from)];
          else if (!sameRank) dis = String(rankOf(from) + 1);
          else dis = sqName(from);
        }
        san = PIECE_LETTER[piece] + dis + (isCap ? "x" : "") + sqName(to);
      }
    }
    make(m);
    if (inCheck(side)) san += legalMoves().length === 0 ? "#" : "+";
    unmake();
    return san;
  }

  function repetitionCount() {
    let c = 1;
    for (const h of hist) if (h.key === key) c++;
    return c;
  }
  function insufficientMaterial() {
    let minors = 0;
    for (let i = 0; i < 64; i++) {
      const a = Math.abs(board[M64TO120[i]]);
      if (a === WP || a === WR || a === WQ) return false;
      if (a === WN || a === WB) minors++;
    }
    return minors <= 1;
  }

  reset();
  return {
    reset, legalMoves, make, unmake, search, sanOf, pvLine,
    inCheckNow: () => inCheck(side),
    getSide: () => side,
    pieceAt: i64 => board[M64TO120[i64]],
    halfClock: () => half,
    repetitionCount, insufficientMaterial,
    evalWhite: () => (side === 1 ? evaluate() : -evaluate()),
    plyCount: () => hist.length,
  };
}
