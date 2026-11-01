/* Runs our own Stockfish build over every position of the collected games and
   caches the raw results, so scoring and tuning can rerun instantly without
   searching again.

   It searches a fixed number of positions per move rather than for a fixed
   time, so results don't depend on how busy this machine is.

   Usage: node scripts/review-lab/analyze.mjs [nodesPerMove] [workers]
   Resumable: finished games are skipped. */
import { spawn } from "node:child_process";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createEngine, MATE } from "../../src/engine/chessEngine.js";

const NODES = Number(process.argv[2]) || 100000;
const WORKERS = Number(process.argv[3]) || 12;
const DATA = new URL("./data/", import.meta.url);
const GAMES = new URL("games.jsonl", DATA);
const OUT = new URL(`evals-${NODES}.jsonl`, DATA);
const ENGINE = fileURLToPath(new URL("engine/stockfish-18-lite-single.js", DATA));
const SEARCH_TIMEOUT_MS = 60000;

class Engine {
  constructor() { this.start(); }

  start() {
    this.proc = spawn("node", [ENGINE], { stdio: ["pipe", "pipe", "ignore"] });
    this.buffer = "";
    this.onLine = null;
    this.proc.stdout.on("data", (chunk) => {
      this.buffer += chunk;
      let i;
      while ((i = this.buffer.indexOf("\n")) >= 0) {
        const line = this.buffer.slice(0, i).trim();
        this.buffer = this.buffer.slice(i + 1);
        this.onLine?.(line);
      }
    });
    this.send("uci");
    this.send("setoption name MultiPV value 2");
  }

  send(cmd) { this.proc.stdin.write(cmd + "\n"); }

  restart() { this.proc.kill(); this.start(); }

  /* Same parsing as stockfishAnalyze: the last report for each line wins, and
     a finished game has no lines at all. */
  search(fen) {
    return new Promise((resolve, reject) => {
      const lines = new Map();
      const timer = setTimeout(() => { this.onLine = null; reject(new Error("search timed out")); }, SEARCH_TIMEOUT_MS);
      this.onLine = (line) => {
        if (line.startsWith("info") && line.includes(" pv ")) {
          const parts = line.split(" ");
          const get = (key) => { const i = parts.indexOf(key); return i < 0 ? null : parts[i + 1]; };
          const mate = get("mate");
          const score = mate != null
            ? Math.sign(Number(mate)) * (MATE - Math.abs(Number(mate)) * 2)
            : Number(get("cp") ?? 0);
          lines.set(Number(get("multipv") ?? 1), score);
        } else if (line.startsWith("bestmove")) {
          clearTimeout(timer);
          this.onLine = null;
          const best = line.split(" ")[1];
          resolve({ s: lines.get(1) ?? 0, s2: lines.get(2) ?? null, best: best === "(none)" ? null : best });
        }
      };
      this.send(`position fen ${fen}`);
      this.send(`go nodes ${NODES}`);
    });
  }
}

function fensOf(moves) {
  const eng = createEngine();
  const fens = [eng.fen()];
  for (const san of moves) {
    const move = eng.legalMoves().find((m) => eng.sanOf(m) === san);
    if (move === undefined) return null;
    eng.make(move);
    fens.push(eng.fen());
  }
  return fens;
}

const games = readFileSync(GAMES, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const done = new Set();
if (existsSync(OUT)) {
  for (const line of readFileSync(OUT, "utf8").split("\n").filter(Boolean)) done.add(JSON.parse(line).id);
}
const queue = games.filter((g) => !done.has(g.id));
const total = queue.length;
let finished = 0;
const started = Date.now();
console.log(`${total} games to analyze at ${NODES} nodes per move, ${WORKERS} workers`);

async function worker() {
  const engine = new Engine();
  for (;;) {
    const game = queue.shift();
    if (!game) break;
    const fens = fensOf(game.moves);
    if (!fens) continue;
    engine.send("ucinewgame");
    const plies = [];
    let failed = false;
    for (const fen of fens) {
      try {
        plies.push(await engine.search(fen));
      } catch {
        engine.restart();
        failed = true;
        break;
      }
    }
    if (failed) continue;
    appendFileSync(OUT, JSON.stringify({ id: game.id, plies }) + "\n");
    finished++;
    if (finished % 25 === 0 || finished === total) {
      const perGame = (Date.now() - started) / finished;
      const left = Math.round(((total - finished) * perGame) / 60000);
      console.log(`${finished}/${total} games, about ${left} min left`);
    }
  }
  engine.proc.kill();
}

await Promise.all(Array.from({ length: WORKERS }, worker));
console.log("Analysis finished.");
