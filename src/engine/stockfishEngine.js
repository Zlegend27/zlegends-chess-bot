import { MATE } from "./chessEngine";

/* Wraps the vendored Stockfish 18 "lite, single-threaded" WASM build
   (public/stockfish/stockfish-18-lite-single.{js,wasm} -- the `stockfish`
   npm package by nmrugg, GPLv3, see public/stockfish/Copying.txt) to give
   the below-Casual difficulty tiers a real, chess.com-comparable Elo
   instead of a guessed search-time budget. UCI_LimitStrength + UCI_Elo
   are Stockfish's own official strength-limiting options, tuned and
   tested by the Stockfish team against real rating pools -- not a
   homemade guess like the rest of this engine's difficulty ladder.
   Single-threaded + "lite" net was chosen deliberately: it needs no
   COOP/COEP cross-origin-isolation headers (which this static Vercel
   site doesn't set) and is a fraction of the size of the full engine,
   at strength far beyond anything these below-2000 tiers need anyway. */

/* Stockfish's UCI_Elo option won't go below 1320, so the "1000" tier
   layers an extra blunder chance on top of Stockfish's own 1320 floor
   to push effective strength down further -- same blunderChance idea
   already used elsewhere in this app's difficulty ladder. */
export const STOCKFISH_MIN_ELO = 1320;

let workerPromise = null;

function createWorker() {
  return new Promise((resolve, reject) => {
    let worker;
    try {
      worker = new Worker("/stockfish/stockfish-18-lite-single.js");
    } catch (e) {
      reject(e);
      return;
    }
    const onMessage = (e) => {
      if (e.data === "readyok") {
        worker.removeEventListener("message", onMessage);
        resolve(worker);
      }
    };
    worker.addEventListener("message", onMessage);
    worker.onerror = (e) => reject(e);
    worker.postMessage("uci");
    worker.postMessage("isready");
  });
}

function getWorker() {
  if (!workerPromise) workerPromise = createWorker();
  return workerPromise;
}

function parseInfoLine(line) {
  const parts = line.split(" ");
  const get = (key) => {
    const i = parts.indexOf(key);
    return i === -1 ? null : parts[i + 1];
  };
  const pvIdx = parts.indexOf("pv");
  const cpRaw = get("cp");
  const mateRaw = get("mate");
  let score;
  if (mateRaw != null) {
    const n = Number(mateRaw);
    score = Math.sign(n) * (MATE - Math.abs(n) * 2);
  } else {
    score = cpRaw != null ? Number(cpRaw) : 0;
  }
  return {
    depth: Number(get("depth")) || 0,
    nodes: Number(get("nodes")) || 0,
    time: Number(get("time")) || 0,
    score,
    pv: pvIdx !== -1 ? parts.slice(pvIdx + 1) : [],
  };
}

/* Requests are serialized through this queue since there's one shared
   engine instance -- Stockfish can only search one position at a time. */
let queue = Promise.resolve();

export function stockfishBestMove(fen, elo, moveTimeMs = 1000) {
  const run = () => new Promise((resolve, reject) => {
    getWorker().then((worker) => {
      let lastInfo = null;
      const onMessage = (e) => {
        const line = e.data;
        if (typeof line !== "string") return;
        if (line.startsWith("info") && line.includes(" pv ")) {
          lastInfo = parseInfoLine(line);
        } else if (line.startsWith("bestmove")) {
          worker.removeEventListener("message", onMessage);
          const uci = line.split(" ")[1];
          resolve({ uci: uci === "(none)" ? null : uci, info: lastInfo });
        }
      };
      worker.addEventListener("message", onMessage);
      worker.postMessage("setoption name UCI_LimitStrength value true");
      worker.postMessage(`setoption name UCI_Elo value ${Math.max(STOCKFISH_MIN_ELO, elo)}`);
      worker.postMessage(`position fen ${fen}`);
      worker.postMessage(`go movetime ${moveTimeMs}`);
    }).catch(reject);
  });
  const result = queue.then(run);
  queue = result.then(() => {}, () => {});
  return result;
}
