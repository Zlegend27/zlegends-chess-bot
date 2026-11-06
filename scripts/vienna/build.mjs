/* Turns the collected Vienna game counts into the trainer's repertoire.

   Black's side: the replies real players chose in each position, per rating
   band, kept while enough games reach that position to trust the numbers.

   White's side (the player's Vienna Gambit): 3.f4 against 2...Nf6 and
   2...Nc6, as chosen by the site owner. Everywhere else Stockfish compares
   the moves White players actually tried, plus its own top choice, and the
   repertoire takes the most popular move within REP_MARGIN of the best, so
   the trainer teaches what is both sound and practical. Other moves within
   OK_MARGIN are accepted as playable alternatives.

   Usage: node scripts/vienna/build.mjs [nodesPerSearch] [workers]
   Reads scripts/vienna/data/counts.json, writes src/data/viennaRepertoire.json */
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createEngine, MATE } from "../../src/engine/chessEngine.js";
import { uciOf } from "../../src/utils/viennaTrainer.js";

const NODES = Number(process.argv[2]) || 1000000;
const WORKERS = Number(process.argv[3]) || 10;
const ENGINE = fileURLToPath(new URL("../review-lab/data/engine/stockfish-18-lite-single.js", import.meta.url));
const COUNTS = new URL("./data/counts.json", import.meta.url);
const OUT = new URL("../../src/data/viennaRepertoire.json", import.meta.url);

const MAX_PLIES = 40;
const MIN_GAMES = 10;          // fewer games reach a position than this: the book ends there
const MIN_REPLY = 3;           // a Black reply needs this many games...
const MIN_REPLY_SHARE = 0.02;  // ...and this share of the position's games
const MIN_TRIED = 4;           // a White move needs this many games to be compared
const REP_MARGIN = 25;         // centipawns: popular beats best within this
const OK_MARGIN = 60;          // centipawns: still a playable alternative...
const OK_SHARE = 0.05;         // ...if at least this share of players chose it. Early on
                               // Stockfish rates almost anything as equal, and 3.a4
                               // shouldn't pass as a Vienna alternative.
const PUNISH_JUMP = 150;       // Black's reply handed White this much: flag it
const FORCED = { "": "e4", "e4 e5": "Nc3", "e4 e5 Nc3 Nf6": "f4", "e4 e5 Nc3 Nc6": "f4" };

const { counts, bands, games } = JSON.parse(readFileSync(COUNTS, "utf8"));
const sum = (c) => c.reduce((a, b) => a + b, 0);
const total = (moves) => Object.values(moves).reduce((s, c) => s + sum(c), 0);


function positionAt(key) {
  const eng = createEngine();
  for (const san of key ? key.split(" ") : []) eng.make(eng.legalMoves().find((m) => eng.sanOf(m) === san));
  return eng;
}

class Engine {
  constructor() {
    this.proc = spawn("node", [ENGINE], { stdio: ["pipe", "pipe", "ignore"] });
    this.buffer = "";
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
  }

  send(cmd) { this.proc.stdin.write(cmd + "\n"); }

  /* Scores each of `ucis` from the mover's side, or searches freely when the
     list is empty. Resolves with { scores: Map(uci -> cp), best }. */
  compare(fen, ucis) {
    return new Promise((resolve) => {
      const scores = new Map();
      this.onLine = (line) => {
        if (line.startsWith("info") && line.includes(" pv ")) {
          const p = line.split(" ");
          const get = (k) => { const i = p.indexOf(k); return i < 0 ? null : p[i + 1]; };
          const mate = get("mate");
          const cp = mate != null ? Math.sign(Number(mate)) * (MATE - Math.abs(Number(mate)) * 2) : Number(get("cp"));
          scores.set(get("pv"), cp);
        } else if (line.startsWith("bestmove")) {
          this.onLine = null;
          resolve({ scores, best: line.split(" ")[1] });
        }
      };
      this.send(`setoption name MultiPV value ${Math.max(1, ucis.length)}`);
      this.send(`position fen ${fen}`);
      this.send(`go nodes ${NODES}${ucis.length ? " searchmoves " + ucis.join(" ") : ""}`);
    });
  }
}

/* Walks the book from the start: each White decision is scored first, then
   the walk follows only the chosen repertoire move into Black's replies. */
const book = {};
const join = (key, san) => (key ? `${key} ${san}` : san);
const enough = (key, ply) => counts[key] && ply < MAX_PLIES && total(counts[key]) >= MIN_GAMES;
const queue = [{ key: "", ply: 0 }];
let inFlight = 0, done = 0;

function addBlackReplies(key, ply) {
  if (!enough(key, ply)) return;
  const moves = counts[key];
  const all = total(moves);
  const replies = {};
  for (const [san, c] of Object.entries(moves)) if (sum(c) >= MIN_REPLY && sum(c) / all >= MIN_REPLY_SHARE) replies[san] = c;
  book[key] = { r: replies };
  for (const san of Object.keys(replies)) if (enough(join(key, san), ply + 1)) queue.push({ key: join(key, san), ply: ply + 1 });
}

async function worker() {
  const engine = new Engine();
  for (;;) {
    const job = queue.shift();
    if (!job) {
      if (inFlight === 0) break;
      await new Promise((r) => setTimeout(r, 50));
      continue;
    }
    inFlight++;
    const { key, ply } = job;
    const eng = positionAt(key);
    const legal = eng.legalMoves();
    const forced = FORCED[key];
    const tried = Object.entries(counts[key]).filter(([, c]) => sum(c) >= MIN_TRIED).map(([san]) => san);
    const bySan = new Map();
    for (const san of [...(forced ? [forced] : []), ...tried]) {
      const m = legal.find((x) => eng.sanOf(x) === san);
      if (m !== undefined) bySan.set(san, m);
    }
    const open = await engine.compare(eng.fen(), []);
    const bestMove = legal.find((m) => uciOf(m) === open.best);
    if (bestMove !== undefined) bySan.set(eng.sanOf(bestMove), bestMove);
    const { scores } = await engine.compare(eng.fen(), [...bySan.values()].map(uciOf));
    const ev = {};
    for (const [san, m] of bySan) if (scores.has(uciOf(m))) ev[san] = scores.get(uciOf(m));
    const best = Math.max(...Object.values(ev));
    const pop = (san) => sum(counts[key][san] || [0]);
    const rep = forced ?? Object.keys(ev).filter((s) => ev[s] >= best - REP_MARGIN).sort((a, b) => pop(b) - pop(a))[0];
    const share = (san) => pop(san) / total(counts[key]);
    const ok = Object.keys(ev).filter((s) => s !== rep && ev[s] >= best - OK_MARGIN && share(s) >= OK_SHARE);
    book[key] = { w: { rep, ok, ev } };
    addBlackReplies(join(key, rep), ply + 1);
    inFlight--;
    done++;
    if (done % 50 === 0) console.log(`${done} White decisions scored, ${queue.length} waiting`);
  }
  engine.proc.kill();
}
console.log(`${games} games loaded`);
await Promise.all(Array.from({ length: WORKERS }, worker));
const kept = book;

/* Flag replies that hand White a big gain, so the trainer can say "punish it". */
for (const [key, node] of Object.entries(kept)) {
  if (!node.w || !key) continue;
  const parts = key.split(" ");
  if (parts.length < 2) continue;
  const before = kept[parts.slice(0, -2).join(" ")];
  const prevScore = before?.w?.ev[before.w.rep];
  const nowScore = node.w.ev[node.w.rep];
  if (prevScore != null && nowScore != null && nowScore - prevScore >= PUNISH_JUMP) node.w.punish = true;
}

mkdirSync(new URL("../../src/data/", import.meta.url), { recursive: true });
writeFileSync(OUT, JSON.stringify({
  source: "Lichess games database (CC0), rated blitz, rapid and classical games, September 2026",
  games, bands, nodes: kept,
}));
console.log(`wrote ${Object.keys(kept).length} positions to src/data/viennaRepertoire.json`);
