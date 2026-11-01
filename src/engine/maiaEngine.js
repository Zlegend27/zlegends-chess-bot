let worker = null;
let nextId = 0;
const waiting = new Map();

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL("./maiaWorker.js", import.meta.url), { type: "module" });
  worker.onmessage = ({ data }) => {
    const job = waiting.get(data.id);
    if (!job) return;
    waiting.delete(data.id);
    if (data.error) job.reject(new Error(data.error));
    else job.resolve(data.chances);
  };
  worker.onerror = () => {
    for (const job of waiting.values()) job.reject(new Error("Maia worker failed"));
    waiting.clear();
    worker = null;
  };
  return worker;
}

/** How likely a player of `selfElo` is to play each of `ucis` here, as
 *  { uci: chance }. Rejects if the model can't load, so callers can play on
 *  without it. */
export function maiaChances(fen, selfElo, oppoElo, ucis) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    waiting.set(id, { resolve, reject });
    getWorker().postMessage({ id, fen, selfElo, oppoElo, ucis });
  });
}
