/* Runs the engine search off the main thread so it never blocks audio,
   animation, or interaction while the bot "thinks". The main thread keeps
   its own live engine for instant rendering; this worker mirrors positions
   by replaying the same SAN move list rather than sharing state directly. */
import { createEngine } from "./chessEngine";
import { replayIntoEngine } from "../utils/share";

const eng = createEngine();

self.onmessage = (e) => {
  const { id, moveList, timeMs, blunderChance } = e.data;
  eng.reset();
  replayIntoEngine(eng, moveList);
  const result = eng.search(timeMs, blunderChance || 0);
  if (!result || !result.move) {
    self.postMessage({ id, result: null });
    return;
  }
  const san = eng.sanOf(result.move);
  const pv = eng.pvLine(8);
  self.postMessage({ id, result: { ...result, san, pv } });
};
