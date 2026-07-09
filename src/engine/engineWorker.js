/* Runs the engine search off the main thread so it never blocks audio,
   animation, or interaction while the bot "thinks". The main thread keeps
   its own live engine for instant rendering; this worker mirrors positions
   by replaying the same SAN move list rather than sharing state directly. */
import { createEngine } from "./chessEngine";
import { replayIntoEngine } from "../utils/share";
import { getBookMove } from "../utils/openingBook";

const eng = createEngine();
const MAX_BOOK_PLIES = 20; // ~10 full moves; opening theory thins out past this anyway

self.onmessage = async (e) => {
  const { id, moveList, timeMs, blunderChance, personality, useBook, bookStyle } = e.data;
  eng.reset();
  replayIntoEngine(eng, moveList);
  eng.setPersonality(personality);

  if (useBook && moveList.length < MAX_BOOK_PLIES) {
    /* bookStyle (Casual only) tilts the weighted opening pick toward the
       bot's daily personality -- see STYLE_BOOK_BIAS in openingBook.js. */
    const bookSan = await getBookMove(eng.fen(), moveList, { timeoutMs: 2500, style: bookStyle || null });
    const legal = bookSan ? eng.legalMoves() : [];
    const bookMove = legal.find(m => eng.sanOf(m) === bookSan);
    if (bookMove) {
      const sideScore = eng.getSide() === 1 ? eng.evalWhite() : -eng.evalWhite();
      self.postMessage({ id, result: { move: bookMove, score: sideScore, depth: 0, nodes: 0, time: 0, san: bookSan, pv: [], book: true } });
      return;
    }
  }

  const result = eng.search(timeMs, blunderChance || 0);
  if (!result || !result.move) {
    self.postMessage({ id, result: null });
    return;
  }
  const san = eng.sanOf(result.move);
  const pv = eng.pvLine(8);
  self.postMessage({ id, result: { ...result, san, pv } });
};
