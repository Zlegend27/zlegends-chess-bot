/* Picks Rank Bot's move: one Stockfish search for what's safe,
   Maia3 for what looks human, and short searches for which option this player
   is likely to answer badly. The chosen move then gets a much deeper check,
   since a move that looks fine at first can turn out to lose the lead. If Maia
   fails, the bot plays on without it. Loaded only once someone plays Rank Bot,
   so nobody else fetches any of this. */
import { createEngine, MATE, mFrom, mPromo, mTo, M120TO64 } from "./chessEngine";
import { hangingPieces } from "../utils/gradeGame";
import { PTS } from "../utils/material";
import { MATE_EVAL } from "../utils/reviewScoring";
import {
  expectedReplyLoss, isClosing, isLeadLost, isTrusted, learnFromMove, levelsFor, mistakeFor, newGameState, nextPace,
  optionsFor, rankOptions, stepFor,
} from "../utils/rankBotShadow";
import { maiaChances } from "./maiaEngine";
import { stockfishAnalyze } from "./stockfishEngine";

const SEARCH_NODES = 90000;
const SEARCH_LINES = 18;
const CHECK_NODES = 200000;
const CHECKED_MOVES = 2;
const TRAP_NODES = 30000;
const TRAP_LINES = 5;
const TRAP_OPTIONS = 3;
/* Past this, skip the trap search for this move. */
const TRAP_TIME_LIMIT_MS = 3000;
const REAL_PIECE = 3;
/* How far along a line to count material. It stops after the opponent's
   move, so a half-finished trade doesn't read as a win. */
const MATERIAL_PLIES = 8;

const reviewCp = (s) => (Math.abs(s) > MATE - 2000 ? Math.sign(s) * MATE_EVAL : s);
const squareName = (sq120) => {
  const i = M120TO64[sq120];
  return "abcdefgh"[i % 8] + String(((i / 8) | 0) + 1);
};
const uciOf = (m) => squareName(mFrom(m)) + squareName(mTo(m)) + (mPromo(m) ? "  nbrq"[mPromo(m)] : "");

const at = (fen) => { const eng = createEngine(); eng.loadFen(fen); return eng; };
const pieceCount = (eng) => {
  let n = 0;
  for (let i = 0; i < 64; i++) { const p = Math.abs(eng.pieceAt(i)); if (p >= 2 && p <= 5) n++; }
  return n;
};

/** Material for `side` once the first moves of a line are played. */
function materialAfter(fen, pv, side) {
  const eng = at(fen);
  const length = pv.length < 2 ? pv.length : Math.min(MATERIAL_PLIES, pv.length - (pv.length % 2));
  for (const uci of pv.slice(0, length)) {
    const move = eng.moveFromUci(uci);
    if (!move) break;
    eng.make(move);
  }
  let total = 0;
  for (let i = 0; i < 64; i++) {
    const piece = eng.pieceAt(i);
    if (piece) total += Math.sign(piece) * side * (PTS[Math.abs(piece)] || 0);
  }
  return total;
}

const linesFrom = (res, fen) => {
  const side = at(fen).getSide();
  return res.lines.filter((l) => l.pv?.length).map((l) => ({
    uci: l.pv[0], score: reviewCp(l.score), info: l, material: materialAfter(fen, l.pv, side),
  }));
};

/** What this player would lose answering each option. A trap only counts if
 *  it would also catch them at their best, so this takes the lower of the two
 *  readings. */
async function trapValues(fen, options, levels, started, pace) {
  const traps = {};
  for (const option of options) {
    if (Date.now() - started > TRAP_TIME_LIMIT_MS) break;
    const eng = at(fen);
    eng.make(eng.moveFromUci(option.uci));
    const replies = eng.legalMoves().map(uciOf);
    if (replies.length < 2) continue;
    const after = eng.fen();
    const lines = linesFrom(await stockfishAnalyze(after, { nodes: Math.round(TRAP_NODES * pace), multiPv: TRAP_LINES }), after);
    if (!lines.length) continue;
    const asTheyPlay = await maiaChances(after, levels.elo, levels.botElo, replies);
    const atTheirBest = await maiaChances(after, levels.potential, levels.botElo, replies);
    traps[option.uci] = Math.min(expectedReplyLoss(asTheyPlay, lines), expectedReplyLoss(atTheirBest, lines));
  }
  return traps;
}

/** The first of `ranked` that still holds the lead when searched deeper, or
 *  null. Returns the deeper score too, since that's the truer one. */
async function firstSound(fen, ranked, step, pace) {
  for (const option of ranked.slice(0, CHECKED_MOVES)) {
    const res = await stockfishAnalyze(fen, { nodes: Math.round(CHECK_NODES * pace), multiPv: 1, searchMoves: [option.uci] });
    const score = reviewCp(res.lines[0]?.score ?? -MATE_EVAL);
    if (score >= step) return { ...option, score };
  }
  return null;
}

/** `state` comes from newGameState and is updated in place. Returns the
 *  chosen move in UCI form, its search line and a summary for the test
 *  readout. */
export async function chooseShadowMove(fen, ply, state) {
  const started = Date.now();
  const lines = linesFrom(await stockfishAnalyze(fen, { nodes: Math.round(SEARCH_NODES * state.pace), multiPv: SEARCH_LINES }), fen);
  if (!lines.length) return null;
  const pace = state.pace;
  state.pace = nextPace(pace, Date.now() - started);
  if (ply < state.lastPly) Object.assign(state, newGameState(state));
  state.lastPly = ply;
  const cost = learnFromMove(state, lines[0].score, ply);
  const step = stepFor(mistakeFor(state.recent));
  const levels = levelsFor(state);
  const closing = isClosing(ply, state.closePly, pieceCount(at(fen)));
  const leadLost = isLeadLost(lines[0], step);

  let pick = lines[0];
  let mode = closing ? "closing" : "best";
  if (!closing && !leadLost) {
    const hangs = (uci) => {
      const probe = at(fen);
      probe.make(probe.moveFromUci(uci));
      return Math.max(0, ...Object.values(hangingPieces(probe))) >= REAL_PIECE;
    };
    const options = optionsFor(lines, step, hangs);
    let ranked = rankOptions(options, step, null);
    mode = "human";
    if (options.length > 1) {
      try {
        const chances = await maiaChances(fen, levels.botElo, levels.potential, options.map((o) => o.uci));
        const likeliest = [...options].sort((a, b) => chances[b.uci] - chances[a.uci]).slice(0, TRAP_OPTIONS);
        ranked = rankOptions(options, step, chances, await trapValues(fen, likeliest, levels, started, pace));
      } catch {
        mode = "maia failed";
      }
    }
    if (ranked[0] !== lines[0]) {
      const sound = await firstSound(fen, ranked, step, pace);
      pick = sound ?? lines[0];
      if (!sound) mode = "best";
    }
  }
  state.expected = pick.score;
  state.expectedPly = ply;
  return {
    uci: pick.uci, score: pick.score, info: pick.info,
    note: {
      lead: lines[0].score, step: Math.round(step), playerElo: levels.elo, potential: levels.potential, mode, cost,
      trusted: isTrusted(state), totalMs: Date.now() - started,
    },
  };
}
