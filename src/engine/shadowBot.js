/* Picks Rank Bot's move in test mode: one Stockfish search for what's safe,
   Maia3 for what looks human, and a few short searches for which option this
   player is likely to answer badly. If Maia fails, the bot plays on without
   it. Loaded only in test mode, so public players never fetch any of this. */
import { createEngine, MATE, mFrom, mPromo, mTo, M120TO64 } from "./chessEngine";
import { hangingPieces } from "../utils/gradeGame";
import { MATE_EVAL } from "../utils/reviewScoring";
import {
  BOT_ELO_EDGE, eloFor, expectedReplyLoss, isClosing, learnFromMove, newGameState, optionsFor, pickOption, stepFor,
} from "../utils/rankBotShadow";
import { maiaChances } from "./maiaEngine";
import { stockfishAnalyze } from "./stockfishEngine";

const SEARCH_NODES = 30000;
const SEARCH_LINES = 18;
const TRAP_NODES = 8000;
const TRAP_LINES = 5;
const TRAP_OPTIONS = 3;
/* Past this, skip the trap search for this move. */
const TRAP_TIME_LIMIT_MS = 1500;
const REAL_PIECE = 3;

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

const linesFrom = (res) => res.lines
  .filter((l) => l.pv?.length)
  .map((l) => ({ uci: l.pv[0], score: reviewCp(l.score), info: l }));

/** What this player is expected to lose answering each option. */
async function trapValues(fen, options, playerElo, botElo, started) {
  const traps = {};
  for (const option of options) {
    if (Date.now() - started > TRAP_TIME_LIMIT_MS) break;
    const eng = at(fen);
    eng.make(eng.moveFromUci(option.uci));
    const replies = eng.legalMoves().map(uciOf);
    if (replies.length < 2) continue;
    const after = eng.fen();
    const lines = linesFrom(await stockfishAnalyze(after, { nodes: TRAP_NODES, multiPv: TRAP_LINES }));
    if (!lines.length) continue;
    traps[option.uci] = expectedReplyLoss(await maiaChances(after, playerElo, botElo, replies), lines);
  }
  return traps;
}

/** `state` comes from newGameState and is updated in place. Returns the
 *  chosen move in UCI form, its search line and a summary for the test
 *  readout. */
export async function chooseShadowMove(fen, ply, state) {
  const started = Date.now();
  const lines = linesFrom(await stockfishAnalyze(fen, { nodes: SEARCH_NODES, multiPv: SEARCH_LINES }));
  if (!lines.length) return null;
  const searchMs = Date.now() - started;
  if (ply < state.lastPly) Object.assign(state, newGameState(state.mistake));
  state.lastPly = ply;
  state.mistake = learnFromMove(state, lines[0].score, ply);
  const step = stepFor(state.mistake);
  const closing = isClosing(ply, state.closePly, pieceCount(at(fen)));
  const playerElo = eloFor(state.mistake);
  const botElo = playerElo + BOT_ELO_EDGE;

  let pick = lines[0];
  let maia = "off";
  if (!closing) {
    const hangs = (uci) => {
      const probe = at(fen);
      probe.make(probe.moveFromUci(uci));
      return Math.max(0, ...Object.values(hangingPieces(probe))) >= REAL_PIECE;
    };
    const options = optionsFor(lines, step, hangs);
    if (options.length > 1) {
      try {
        const chances = await maiaChances(fen, botElo, playerElo, options.map((o) => o.uci));
        const likeliest = [...options].sort((a, b) => chances[b.uci] - chances[a.uci]).slice(0, TRAP_OPTIONS);
        pick = pickOption(options, step, chances, await trapValues(fen, likeliest, playerElo, botElo, started));
        maia = "on";
      } catch {
        pick = pickOption(options, step, null);
        maia = "failed";
      }
    } else {
      pick = options[0] ?? lines[0];
    }
  }
  state.expected = pick.score;
  state.expectedPly = ply;
  return {
    uci: pick.uci, score: pick.score, info: pick.info,
    note: { lead: lines[0].score, step: Math.round(step), playerElo, closing, maia, searchMs, totalMs: Date.now() - started },
  };
}
