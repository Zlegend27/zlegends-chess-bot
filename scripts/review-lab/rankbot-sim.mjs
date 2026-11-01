/* Plays Rank Bot designs against simulated players, so a new design can be
   judged before anyone meets it.

   A simulated player copies real mistakes: each move it draws a cp loss from
   the games of its rating band, and plays the move that costs about that. It
   doesn't model what humans find hard, only how much they lose.

   Designs:
     today   the design before 2026-11: an Elo dial, random blunders, a +-400 override
     shadow  searches once, then picks the move that keeps a lead of about one
             of this player's typical mistakes

   Usage: node scripts/review-lab/rankbot-sim.mjs <gamesPerBand> <workers> <variant,...>
   Results append to data/rankbot-sim.jsonl. Summarize with rankbot-report.mjs */
import { spawn } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createEngine, MATE } from "../../src/engine/chessEngine.js";
import { hangingPieces } from "../../src/utils/gradeGame.js";
import { BANDS } from "./bands.mjs";

const GAMES_PER_BAND = Number(process.argv[2]) || 6;
const WORKERS = Number(process.argv[3]) || 12;
const VARIANT_NAMES = (process.argv[4] || "today,shadow").split(",");
const DATA = new URL("./data/", import.meta.url);
const ENGINE = fileURLToPath(new URL("engine/stockfish-18-lite-single.js", DATA));
const OUT = new URL("rankbot-sim.jsonl", DATA);
const readJsonl = (name) => readFileSync(new URL(name, DATA), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));

const shadow = { design: "shadow", nodes: 100000, lines: 12, stepMult: 1.2, give: 80, giveShare: 0, believable: true, trapNodes: 0 };
const VARIANTS = {
  today: { design: "today" },
  shadow,
  "shadow-raw": { ...shadow, believable: false, give: 9999 },
  "shadow-120": { ...shadow, give: 120 },
  "shadow-share": { ...shadow, give: 100, giveShare: 0.4 },
  soft: { ...shadow, give: 100, giveShare: 0.6, lines: 18 },
  "soft-trap": { ...shadow, give: 100, giveShare: 0.6, lines: 18, trapNodes: 15000 },
  "soft-30k": { ...shadow, give: 100, giveShare: 0.6, lines: 18, nodes: 30000 },
  "soft-10k": { ...shadow, give: 100, giveShare: 0.6, lines: 18, nodes: 10000 },
  "shadow-trap": { ...shadow, trapNodes: 15000 },
  "shadow-30k": { ...shadow, nodes: 30000 },
  "shadow-10k": { ...shadow, nodes: 10000 },
};

const HUMAN_NODES = 30000;
const HUMAN_LINES = 24;
const OPENING_PLIES = 8;
const MAX_PLIES = 180;
const MAX_LOSS = 300;
const CLOSE_PLY_MIN = 60;
const CLOSE_PLY_MAX = 84;
const ENDGAME_PIECES = 6;
const START_MISTAKE = 60;

class Engine {
  constructor() {
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
  }

  send(cmd) { this.proc.stdin.write(cmd + "\n"); }

  /* Lines come back best first, scored for the side to move. */
  search(fen, { nodes, movetime, lines = 1, elo = null }) {
    return new Promise((resolve) => {
      const found = new Map();
      let nodesUsed = 0;
      this.onLine = (line) => {
        if (line.startsWith("info") && line.includes(" pv ")) {
          const parts = line.split(" ");
          const get = (key) => { const i = parts.indexOf(key); return i < 0 ? null : parts[i + 1]; };
          const mate = get("mate");
          const score = mate != null
            ? Math.sign(Number(mate)) * (MATE - Math.abs(Number(mate)) * 2)
            : Number(get("cp") ?? 0);
          found.set(Number(get("multipv") ?? 1), { score, uci: parts[parts.indexOf("pv") + 1] });
          nodesUsed = Number(get("nodes") ?? nodesUsed);
        } else if (line.startsWith("bestmove")) {
          this.onLine = null;
          resolve({ lines: [...found.entries()].sort((a, b) => a[0] - b[0]).map(([, l]) => l), nodes: nodesUsed, best: line.split(" ")[1] });
        }
      };
      this.send(`setoption name MultiPV value ${lines}`);
      this.send(`setoption name UCI_LimitStrength value ${elo ? "true" : "false"}`);
      if (elo) this.send(`setoption name UCI_Elo value ${elo}`);
      this.send(`position fen ${fen}`);
      this.send(nodes ? `go nodes ${nodes}` : `go movetime ${movetime}`);
    });
  }
}

const random = (n) => (Math.random() * n) | 0;
const clampCp = (s) => (Math.abs(s) > MATE - 2000 ? Math.sign(s) * 2000 : s);
const pieceCount = (eng) => {
  let n = 0;
  for (let i = 0; i < 64; i++) { const p = Math.abs(eng.pieceAt(i)); if (p >= 2 && p <= 5) n++; }
  return n;
};

function realLosses() {
  const sides = JSON.parse(readFileSync(new URL("features.json", DATA), "utf8"));
  const out = {};
  for (const s of sides) {
    const list = (out[s.band] ??= []);
    for (const [before, after, isBest, forced, book] of s.moves) {
      if (book || forced || Math.abs(before) >= 600) continue;
      list.push(isBest ? 0 : Math.max(0, before - after));
    }
  }
  return out;
}

async function humanMove(engine, eng, fen, losses) {
  const { lines } = await engine.search(fen, { nodes: HUMAN_NODES, lines: HUMAN_LINES });
  const wanted = losses[random(losses.length)];
  const best = clampCp(lines[0].score);
  let pick = lines[0];
  let gap = Infinity;
  for (const line of lines) {
    const d = Math.abs(best - clampCp(line.score) - wanted);
    if (d < gap) { gap = d; pick = line; }
  }
  return { move: eng.moveFromUci(pick.uci), score: pick.score, loss: best - clampCp(pick.score) };
}

/* Points of real material this move leaves for free. An exchange or a pawn
   reads as a trade-off; a whole piece reads as a blunder. */
const REAL_PIECE = 3;
const hungPoints = (eng, uci) => {
  const probe = createEngine();
  probe.loadFen(eng.fen());
  probe.make(probe.moveFromUci(uci));
  return Math.max(0, ...Object.values(hangingPieces(probe)));
};
const hangsPiece = (eng, uci) => hungPoints(eng, uci) >= REAL_PIECE;

/* The reply gap: how much worse the opponent's third choice is than their
   first. A big gap means few moves hold, so a slip is more likely. */
async function trickiest(engine, eng, options, nodes) {
  let top = options[0].line;
  let widest = -1;
  for (const { line } of options.slice(0, 3)) {
    const probe = createEngine();
    probe.loadFen(eng.fen());
    probe.make(probe.moveFromUci(line.uci));
    const { lines } = await engine.search(probe.fen(), { nodes, lines: 3 });
    if (lines.length < 3) continue;
    const gap = clampCp(lines[0].score) - clampCp(lines[2].score);
    if (gap > widest) { widest = gap; top = line; }
  }
  return top;
}

/* The one-search design. `state` carries what it has learned about the player
   this game; the search itself shows what their last move cost. */
async function shadowMove(engine, eng, fen, v, state, ply) {
  const started = Date.now();
  const { lines, nodes } = await engine.search(fen, { nodes: v.nodes, lines: v.lines });
  const ms = Date.now() - started;
  if (!lines.length) return null;
  const best = clampCp(lines[0].score);
  if (state.expected != null) {
    const cost = Math.min(MAX_LOSS, Math.max(0, best - state.expected));
    state.mistake += (cost - state.mistake) * 0.1;
  }
  const step = Math.max(25, Math.min(200, state.mistake * v.stepMult));
  const closing = ply >= state.closePly || pieceCount(eng) <= ENDGAME_PIECES;
  let pick = lines[0];
  if (!closing && best > step) {
    const floor = Math.max(step, best - Math.max(v.give, v.giveShare * (best - step)));
    const allowed = [];
    for (const line of lines) {
      const score = clampCp(line.score);
      if (score < floor) break;
      if (line !== lines[0] && v.believable && hangsPiece(eng, line.uci)) continue;
      allowed.push({ line, score });
    }
    if (allowed.length) {
      const lowest = allowed[allowed.length - 1];
      pick = lowest.line;
      if (v.trapNodes) pick = await trickiest(engine, eng, allowed.filter((a) => a.score <= lowest.score + 20), v.trapNodes);
    }
  }
  state.expected = clampCp(pick.score);
  const hung = pick !== lines[0] && hangsPiece(eng, pick.uci);
  return { hung, move: eng.moveFromUci(pick.uci), lead: best, step, gaveUp: best - clampCp(pick.score), ms, nodes, closing };
}

/* The old logic, kept as a baseline. The dial carries across
   a player's games, as it does in the app. */
const perfOf = (l) => (l === 0 ? 3000 : l < 20 ? 2400 : l < 60 ? 1700 : l < 150 ? 1150 : l < 300 ? 800 : 450);
const blunderChance = (elo) => (elo >= 1320 ? 0 : Math.min(0.75, 0.3 + (1320 - elo) / 1000));

async function todayMove(engine, eng, fen, state, ply) {
  const started = Date.now();
  const sanity = await engine.search(fen, { nodes: 100000 });
  if (!sanity.lines.length) return null;
  const lead = clampCp(sanity.lines[0].score);
  if (ply >= OPENING_PLIES && state.expected != null) {
    const loss = Math.max(0, lead - state.expected);
    state.dial = Math.max(state.floor, Math.min(3190, state.dial + (perfOf(loss) - state.dial) * 0.06));
  }
  let elo = ply < OPENING_PLIES ? 3190 : state.dial;
  if (lead <= -400) elo = 3190;
  else if (lead >= 400) elo = Math.min(elo, 900);
  let uci = sanity.best;
  if (elo < 3190) uci = (await engine.search(fen, { movetime: 250, elo: Math.max(1320, Math.round(elo)) })).best;
  let move = eng.moveFromUci(uci);
  let hung = false;
  if (lead < 400 && Math.random() < blunderChance(elo)) {
    const legal = eng.legalMoves();
    move = legal[random(legal.length)];
    const probe = createEngine();
    probe.loadFen(eng.fen());
    probe.make(move);
    hung = Math.max(0, ...Object.values(hangingPieces(probe))) >= REAL_PIECE;
  }
  const ms = Date.now() - started;
  const probe = createEngine();
  probe.loadFen(eng.fen());
  probe.make(move);
  const after = await engine.search(probe.fen(), { nodes: 30000 });
  const score = after.lines.length ? -clampCp(after.lines[0].score) : lead;
  state.expected = score;
  return { hung, move, lead, step: 0, gaveUp: Math.max(0, lead - score), ms, nodes: 0, closing: false };
}

function finished(eng) {
  if (eng.legalMoves().length === 0) return eng.inCheckNow() ? "mate" : "draw";
  if (eng.halfClock() >= 100 || eng.repetitionCount() >= 3 || eng.insufficientMaterial()) return "draw";
  return null;
}

async function playGame(engine, { band, losses, openings, variant, botWhite, carry }) {
  const v = VARIANTS[variant];
  const eng = createEngine();
  engine.send("ucinewgame");
  const state = {
    mistake: START_MISTAKE, expected: null,
    closePly: CLOSE_PLY_MIN + random(CLOSE_PLY_MAX - CLOSE_PLY_MIN),
    dial: carry.dial, floor: Math.max(600, carry.dial - 250),
  };
  for (const san of openings[random(openings.length)].moves.slice(0, OPENING_PLIES)) {
    const m = eng.legalMoves().find((x) => eng.sanOf(x) === san);
    if (m === undefined) break;
    eng.make(m);
  }
  const trace = { hung: 0, leads: [], steps: [], gaveUp: [], ms: [], nodes: [], humanLoss: [], plyAtClose: null };
  let result = null;
  let humanAheadMoves = 0;
  while (eng.plyCount() < MAX_PLIES) {
    result = finished(eng);
    if (result) break;
    const ply = eng.plyCount();
    const botTurn = (ply % 2 === 0) === botWhite;
    const fen = eng.fen();
    if (botTurn) {
      const choice = v.design === "today" ? await todayMove(engine, eng, fen, state, ply) : await shadowMove(engine, eng, fen, v, state, ply);
      if (!choice) break;
      trace.leads.push(Math.round(choice.lead));
      trace.steps.push(Math.round(choice.step));
      trace.gaveUp.push(Math.round(choice.gaveUp));
      trace.ms.push(choice.ms);
      trace.nodes.push(choice.nodes);
      if (choice.closing && trace.plyAtClose == null) trace.plyAtClose = ply;
      if (choice.hung) trace.hung++;
      if (choice.lead < -20) humanAheadMoves++;
      eng.make(choice.move);
    } else {
      const h = await humanMove(engine, eng, fen, losses);
      trace.humanLoss.push(Math.round(h.loss));
      eng.make(h.move);
    }
  }
  const end = result ?? finished(eng);
  let botPoints = 0.5;
  if (end === "mate") botPoints = ((eng.plyCount() % 2 === 0) === botWhite) ? 0 : 1;
  else if (!end) {
    const last = trace.leads[trace.leads.length - 1] ?? 0;
    botPoints = last >= 300 ? 1 : last <= -300 ? 0 : 0.5;
  }
  if (v.design === "today") {
    const step = botPoints === 0 ? 120 : botPoints === 1 ? -80 : 20;
    carry.dial = Math.max(600, Math.min(3190, state.dial + step));
  }
  return { variant, band, botWhite, plies: eng.plyCount(), botPoints, humanAheadMoves, dial: Math.round(state.dial), ...trace };
}

const losses = realLosses();
const allGames = readJsonl("games.jsonl");
const openingsOf = Object.fromEntries(BANDS.map((b) => [b, allGames.filter((g) => g.band === b && g.moves.length >= 20)]));

/* `today` plays each player in a run of games, since its dial needs time to
   settle; only the later games are reported. */
const jobs = [];
for (const variant of VARIANT_NAMES) {
  for (const band of BANDS) {
    if (variant === "today") {
      for (let p = 0; p < Math.ceil(GAMES_PER_BAND / 3); p++) jobs.push({ variant, band, series: 6 });
    } else {
      for (let g = 0; g < GAMES_PER_BAND; g++) jobs.push({ variant, band, series: 1 });
    }
  }
}
for (let i = jobs.length - 1; i > 0; i--) { const j = random(i + 1); [jobs[i], jobs[j]] = [jobs[j], jobs[i]]; }
const total = jobs.reduce((a, j) => a + j.series, 0);
let done = 0;
const started = Date.now();

async function worker() {
  const engine = new Engine();
  for (;;) {
    const job = jobs.shift();
    if (!job) break;
    const carry = { dial: 1400 };
    for (let g = 0; g < job.series; g++) {
      const rec = await playGame(engine, { band: job.band, losses: losses[job.band], openings: openingsOf[job.band], variant: job.variant, botWhite: g % 2 === 0, carry });
      appendFileSync(OUT, JSON.stringify({ ...rec, seriesGame: g }) + "\n");
      done++;
      if (done % 25 === 0 || done === total) {
        const left = Math.round(((total - done) * (Date.now() - started)) / done / 60000);
        console.log(`${done}/${total} games, about ${left} min left`);
      }
    }
  }
  engine.proc.kill();
}
await Promise.all(Array.from({ length: WORKERS }, worker));
console.log("Simulation finished.");
process.exit(0);
