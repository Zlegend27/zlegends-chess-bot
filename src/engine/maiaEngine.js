/* Past this, a read is treated as stuck and the worker is restarted. */
const READ_TIMEOUT_MS = 4000;

let worker = null;
let loading = null;
let ready = false;
let nextId = 0;
const waiting = new Map();

function failAll(message) {
  for (const job of waiting.values()) job.reject(new Error(message));
  waiting.clear();
}

function restart(message) {
  worker?.terminate();
  worker = null;
  loading = null;
  ready = false;
  failAll(message);
}

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
  worker.onerror = () => restart("Maia worker failed");
  return worker;
}

function ask(message) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    waiting.set(id, { resolve, reject });
    getWorker().postMessage({ id, ...message });
  });
}

/** Starts fetching the model in the background. Nothing waits for it, so a
 *  slow connection can't hold up the game. Safe to call repeatedly. */
export function warmMaia() {
  loading ??= ask({ load: true }).then(() => { ready = true; }, () => { loading = null; });
}

export const isMaiaReady = () => ready;

/** How likely a player of `selfElo` is to play each of `ucis` here, as
 *  { uci: chance }. Rejects if the model fails or takes too long, so callers
 *  can play on without it. */
export function maiaChances(fen, selfElo, oppoElo, ucis) {
  const read = ask({ fen, selfElo, oppoElo, ucis });
  const timer = setTimeout(() => restart("Maia took too long"), READ_TIMEOUT_MS);
  return read.finally(() => clearTimeout(timer));
}
