/* Shared by the game-link page (api/g.js) and its picture (api/card.js): a
   shared game's code turned into the final position and a one-line summary.
   Files starting with "_" are helpers, not routes, on Vercel. */
import { createEngine } from "../src/engine/chessEngine.js";
import { decodeGame, replayIntoEngine } from "../src/utils/share.js";
import { gameResult } from "../src/utils/gameResult.js";

/** { board: 64 piece codes (a1 first), side, moves, title, summary } or null. */
export function readGame(code) {
  /* A real game's code is a few KB at most; anything longer, or with moves
     that aren't short strings, is junk and isn't replayed. */
  if (!code || code.length > 12000) return null;
  const game = decodeGame(code);
  if (!game || game.moveList.length > 600 || !game.moveList.every((m) => typeof m === "string" && m.length <= 10)) return null;
  const eng = createEngine();
  eng.reset();
  const { applied } = replayIntoEngine(eng, game.moveList.slice(0, 600));
  const board = Array.from({ length: 64 }, (_, sq) => eng.pieceAt(sq));
  const plies = applied.length;
  const moves = Math.ceil(plies / 2);
  const res = gameResult(eng);
  const result = res ? (res.winner ? `${res.winner === 1 ? "White" : "Black"} wins by ${res.reason.toLowerCase()}` : `Draw by ${res.reason.toLowerCase()}`) : null;
  const summary = result ? `${moves} ${moves === 1 ? "move" : "moves"}` : plies ? `${moves} ${moves === 1 ? "move" : "moves"} played · ${eng.getSide() === 1 ? "White" : "Black"} to move` : "The starting position";
  return { board, side: game.playerColor, plies, title: result ? `${result}` : "A game on Zlegend2700", summary };
}

export const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
