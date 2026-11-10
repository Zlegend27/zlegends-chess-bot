/* Builds the Opening Trainer's move trees from the collected game counts
   (collect.mjs) and Stockfish.

   For every course line (src/data/openingCourses.js), from the course's
   root position:
   - Player's turn: the forced choice if the line has one; otherwise the
     move that is sound (within REP_MARGIN of Stockfish's best) and that
     strong players choose most, preferring the course's `prefer` setup
     moves. Other sound moves real players use are kept as "also fine".
   - Opponent's turn: every reply that at least MIN_SHARE of the games at
     one of the three levels chose (and MIN_COUNT games). A reply that hands
     the player PUNISH_JUMP or more is marked as a mistake, with Stockfish's
     punishing line.
   - A branch ends when fewer than MIN_REACH of a level's games still get
     there, when too few games reach it, or at MAX_PLIES: the opening is over
     there and the trainer stops; it never teaches middlegames.

   Usage: node scripts/openings/build.mjs [nodesPerSearch] [workers] [kid]
   Reads scripts/openings/data/counts.json, writes src/data/openings/<id>.json.
   With "kid", builds Kinnda's Opening Camp courses instead
   (src-kindle/kidOpeningCourses.js) into src-kindle/openings/, ending the
   opening sooner (KID_MAX_PLIES). */
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createEngine, MATE } from "../../src/engine/chessEngine.js";
import { COURSES as MAIN_COURSES } from "../../src/data/openingCourses.js";
import { KID_COURSES } from "../../src-kindle/kidOpeningCourses.js";
import { uciOf as uci } from "../../src/utils/explainLine.js";
const uciOf = (_eng, m) => uci(m);

const NODES = Number(process.argv[2]) || 400000;
const WORKERS = Number(process.argv[3]) || 8;
const ENGINE = fileURLToPath(new URL("../review-lab/data/engine/stockfish-18-lite-single.js", import.meta.url));
const COUNTS = new URL("./data/counts.json", import.meta.url);
const KID = process.argv[4] === "kid";
const COURSES = KID ? KID_COURSES : MAIN_COURSES;
const OUT = new URL(KID ? "../../src-kindle/openings/" : "../../src/data/openings/", import.meta.url);

/* Twelve moves each: the opening is over by then. A child's courses stop
   at about move 7. */
const KID_MAX_PLIES = 14;
const MAX_PLIES = KID ? KID_MAX_PLIES : 24;
const LEVEL_BANDS = [0, 1, 2]; // Easy, Medium, Hard
const STRONG = [2, 3];      // Hard and strong players judge what's played
const MIN_SHARE = 0.08;     // a reply at least this many of a level's players chose...
const PROBE_SHARE = 0.03;   // rarer replies (down to this) are checked, and kept only if they're mistakes
const MIN_COUNT = 12;       // ...in at least this many games
const MIN_REACH = 0.015;    // keep going while this share of a level's games get here
const MIN_GAMES = 30;       // games (all levels) reaching a position for it to count
const MIN_TRIED = 6;        // a player move needs this many strong games to be compared
const REP_MARGIN = 25;      // centipawns: popular beats best within this
const OK_MARGIN = 60;       // still a playable alternative within this...
const OK_SHARE = 0.05;      // ...if this share of strong players chose it
const PUNISH_JUMP = 120;    // a reply that hands the player this much is a mistake
const PV_PLIES = 6;         // punishing lines shown this many plies long

const { counts, bands, games } = JSON.parse(readFileSync(COUNTS, "utf8"));
const sumOf = (arr, idx) => idx.reduce((s, i) => s + (arr?.[i] ?? 0), 0);
const join = (key, san) => (key ? `${key} ${san}` : san);

function positionAt(key) {
  const eng = createEngine();
  for (const san of key ? key.split(" ") : []) {
    const m = eng.legalMoves().find((x) => eng.sanOf(x) === san);
    if (m === undefined) return null;
    eng.make(m);
  }
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
  /* Scores `ucis` (or searches freely when empty) from the mover's side.
     Resolves { scores: Map(uci -> cp), best, pv: [uci...] of the best line }. */
  search(fen, ucis = []) {
    return new Promise((resolve) => {
      const scores = new Map(), pvs = new Map();
      this.onLine = (line) => {
        if (line.startsWith("info") && line.includes(" pv ")) {
          const p = line.split(" ");
          const get = (k) => { const i = p.indexOf(k); return i < 0 ? null : p[i + 1]; };
          const mate = get("mate");
          const cp = mate != null ? Math.sign(Number(mate)) * (MATE - Math.abs(Number(mate)) * 2) : Number(get("cp"));
          const pv = p.slice(p.indexOf("pv") + 1);
          scores.set(pv[0], cp);
          pvs.set(pv[0], pv);
        } else if (line.startsWith("bestmove")) {
          this.onLine = null;
          const best = line.split(" ")[1];
          resolve({ scores, best, pv: pvs.get(best) ?? [best] });
        }
      };
      this.send(`setoption name MultiPV value ${Math.max(1, ucis.length)}`);
      this.send(`position fen ${fen}`);
      this.send(`go nodes ${NODES}${ucis.length ? " searchmoves " + ucis.join(" ") : ""}`);
    });
  }
}

/* A Stockfish line (UCI) as SAN from `eng`'s position, `n` plies long. */
function sanLine(eng, ucis, n) {
  const out = [];
  for (const u of ucis.slice(0, n)) {
    const m = eng.legalMoves().find((x) => uciOf(eng, x) === u);
    if (m === undefined) break;
    out.push(eng.sanOf(m));
    eng.make(m);
  }
  return out;
}

/* Jobs: one per (course line, player position). */
const jobs = [];
const results = new Map(); // `${courseId}/${lineId}` -> { nodes }
for (const course of COURSES) {
  for (const line of course.lines) {
    const id = `${course.id}/${line.id}`;
    results.set(id, { course, line, nodes: {} });
  }
}

function opponentReplies(job, key, ply, reach) {
  const { course, line, nodes } = results.get(job.id);
  if (ply >= MAX_PLIES) return;
  const moves = counts[key];
  if (!moves) return;
  const levelTotals = LEVEL_BANDS.map((b) => Object.values(moves).reduce((s, c) => s + c[b], 0));
  if (levelTotals.reduce((a, b) => a + b, 0) < MIN_GAMES) return;
  const replies = {}, probes = new Set();
  for (const [san, c] of Object.entries(moves)) {
    const share = (s) => LEVEL_BANDS.some((b) => levelTotals[b] && c[b] >= MIN_COUNT && c[b] / levelTotals[b] >= s);
    if (share(MIN_SHARE)) replies[san] = LEVEL_BANDS.map((b) => c[b]);
    else if (share(PROBE_SHARE)) { replies[san] = LEVEL_BANDS.map((b) => c[b]); probes.add(san); }
  }
  if (!Object.keys(replies).length) return;
  nodes[key] = { o: { r: replies } };
  for (const [san, c] of Object.entries(replies)) {
    const share = LEVEL_BANDS.map((b, i) => (levelTotals[i] ? c[i] / levelTotals[i] : 0));
    const next = reach.map((r, i) => r * share[i]);
    /* A rare reply is only checked (is it a mistake?), never followed. */
    if (probes.has(san)) { jobs.push({ id: job.id, key: join(key, san), ply: ply + 1, reach: next, after: san, from: key, probe: true }); continue; }
    if (Math.max(...next) < MIN_REACH) continue;
    jobs.push({ id: job.id, key: join(key, san), ply: ply + 1, reach: next, after: san, from: key });
  }
  void course; void line;
}

async function worker() {
  const engine = new Engine();
  for (;;) {
    const job = jobs.shift();
    if (!job) {
      if (busy === 0) break;
      await new Promise((r) => setTimeout(r, 50));
      continue;
    }
    busy++;
    try {
      const { course, line, nodes } = results.get(job.id);
      const { key, ply } = job;
      if (ply >= MAX_PLIES) continue;
      const eng = positionAt(key);
      if (!eng) continue;
      const legal = eng.legalMoves();
      const forced = line.forced[key];
      const moves = counts[key] ?? {};
      const strongTotal = Object.values(moves).reduce((s, c) => s + sumOf(c, STRONG), 0);
      const tried = Object.entries(moves).filter(([, c]) => sumOf(c, STRONG) >= MIN_TRIED).map(([san]) => san);
      const bySan = new Map();
      for (const san of [...(forced ? [forced] : []), ...tried, ...(course.prefer ?? [])]) {
        const m = legal.find((x) => eng.sanOf(x) === san);
        if (m !== undefined) bySan.set(san, m);
      }
      const free = await engine.search(eng.fen());
      const bestMove = legal.find((m) => uciOf(eng, m) === free.best);
      if (bestMove !== undefined) bySan.set(eng.sanOf(bestMove), bestMove);
      const { scores } = await engine.search(eng.fen(), [...bySan.values()].map((m) => uciOf(eng, m)));
      const ev = {};
      for (const [san, m] of bySan) if (scores.has(uciOf(eng, m))) ev[san] = scores.get(uciOf(eng, m));
      if (!Object.keys(ev).length) continue;
      const best = Math.max(...Object.values(ev));
      const pop = (san) => sumOf(moves[san], STRONG);
      const preferred = (san) => (course.prefer?.includes(san) ? 1 : 0);
      const rep = forced ?? Object.keys(ev).filter((s) => ev[s] >= best - REP_MARGIN)
        .sort((a, b) => preferred(b) - preferred(a) || pop(b) - pop(a))[0];
      const ok = Object.keys(ev).filter((s) => s !== rep && ev[s] >= best - OK_MARGIN && strongTotal && pop(s) / strongTotal >= OK_SHARE);
      const node = { p: { rep, ok, ev: { [rep]: ev[rep] ?? best } } };
      for (const s of ok) node.p.ev[s] = ev[s];
      if (!job.probe) nodes[key] = { ...(nodes[key] ?? {}), ...node };
      /* Was the opponent's last move a mistake? Compare with the position
         before it, from the player's side. */
      if (job.from != null) {
        const prev = nodes[job.from];
        const prevPlayer = job.prevScore;
        const isMistake = prev && prevPlayer != null && (ev[rep] ?? best) - prevPlayer >= PUNISH_JUMP;
        if (isMistake) {
          const pvEng = positionAt(key);
          const pv = sanLine(pvEng, free.pv, PV_PLIES);
          (prev.o.punish ??= {})[job.after] = pv;
        }
        /* A rare reply that isn't a mistake isn't worth teaching: drop it. A
           rare mistake stays (with its punishment) but isn't followed. */
        if (job.probe) {
          if (!isMistake && prev?.o?.r) delete prev.o.r[job.after];
          continue;
        }
      }
      /* On to the opponent's replies after our move. */
      const afterKey = join(key, rep);
      const before = jobs.length;
      opponentReplies(job, afterKey, ply + 1, job.reach);
      for (let i = before; i < jobs.length; i++) jobs[i].prevScore = ev[rep] ?? best;
      done++;
      if (done % 100 === 0) console.log(`${done} decisions, ${jobs.length} waiting`);
    } finally {
      busy--;
    }
  }
  engine.proc.kill();
}

let busy = 0, done = 0;
/* Start each line: the player's first decision is at the root, or (for
   Black) the root already ends with the player's move, so start at the
   opponent's replies. */
for (const [id, { course }] of results) {
  const rootPlies = course.root.split(" ").length;
  const playerToMove = (course.side === "white") === (rootPlies % 2 === 0);
  const job = { id, key: course.root, ply: rootPlies, reach: [1, 1, 1] };
  if (playerToMove) jobs.push(job);
  else opponentReplies(job, course.root, rootPlies, [1, 1, 1]);
}
console.log(`${games} games loaded; starting ${jobs.length} positions on ${WORKERS} engines`);
await Promise.all(Array.from({ length: WORKERS }, worker));

mkdirSync(OUT, { recursive: true });
const byCourse = new Map();
for (const { course, line, nodes } of results.values()) {
  if (!byCourse.has(course.id)) byCourse.set(course.id, { id: course.id, side: course.side, root: course.root, lines: {} });
  byCourse.get(course.id).lines[line.id] = nodes;
}
for (const data of byCourse.values()) {
  const file = new URL(`${data.id}.json`, OUT);
  writeFileSync(file, JSON.stringify({
    source: "Lichess games database (CC0), rated blitz, rapid and classical games, October 2026",
    levels: bands.slice(0, 3), ...data,
  }));
  const sizes = Object.entries(data.lines).map(([l, n]) => `${l} ${Object.keys(n).length}`).join(", ");
  console.log(`wrote ${data.id}.json (${sizes} positions)`);
}
