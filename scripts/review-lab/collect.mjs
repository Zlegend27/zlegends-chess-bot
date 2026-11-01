/* Collects public Chess.com games that carry Chess.com's own accuracy scores,
   spread evenly across rating bands. They're the answer key for measuring
   our Game Review (see score.mjs).

   Requests run one at a time, as the Published-Data API asks. Output goes to
   data/games.jsonl, which is gitignored. Usernames are never written: only
   the moves, ratings and scores are kept, and a one-way hash of the player
   caps how many games any one person contributes.

   Usage: node scripts/review-lab/collect.mjs [gamesPerBand]  (resumable) */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createEngine } from "../../src/engine/chessEngine.js";
import { parsePgnMoves, replayForeignPgn } from "../../src/utils/pgn.js";
import { BANDS, bandFor } from "./bands.mjs";

const DATA = new URL("./data/", import.meta.url);
const OUT = new URL("games.jsonl", DATA);
const QUOTA = Number(process.argv[2]) || 250;
const PER_PLAYER = 3;
const MIN_PLIES = 20;
const STANDARD_START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const HEADERS = { "User-Agent": "zlegend2700.com game review calibration (read-only)" };
const COUNTRIES = ["US", "IN", "BR", "PH", "GB", "DE", "FR", "ES", "IT", "TR", "MX", "ID", "CA", "AU", "NZ", "PL", "NL", "AR", "CO", "EG", "NG", "ZA", "VN", "SE", "NO", "IE", "PT", "RO", "UA", "KR"];
const TITLES = ["GM", "IM", "FM", "CM", "NM"];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hash = (s) => createHash("sha256").update(s).digest("hex").slice(0, 16);

async function get(url) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers: HEADERS }).catch(() => null);
    if (res?.ok) return res.json().catch(() => null);
    if (res?.status === 404 || res?.status === 410) return null;
    await sleep(2000 * (attempt + 1));
  }
  return null;
}

mkdirSync(DATA, { recursive: true });
const seen = new Set();
const counts = Object.fromEntries(BANDS.map((b) => [b, 0]));
const perPlayer = new Map();
if (existsSync(OUT)) {
  for (const line of readFileSync(OUT, "utf8").split("\n").filter(Boolean)) {
    const g = JSON.parse(line);
    seen.add(g.id);
    counts[g.band]++;
    perPlayer.set(g.playerHash, (perPlayer.get(g.playerHash) || 0) + 1);
  }
}

const shuffled = (list) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/* Takes this player's usable games, keeping only bands still short of quota. */
function usableGames(archive, username) {
  const playerHash = hash(username.toLowerCase());
  for (const g of shuffled(archive.games || [])) {
    if ((perPlayer.get(playerHash) || 0) >= PER_PLAYER) return;
    if (g.rules !== "chess" || !g.accuracies || !g.rated) continue;
    if (g.initial_setup && g.initial_setup !== STANDARD_START) continue;
    const whiteAcc = g.accuracies.white;
    const blackAcc = g.accuracies.black;
    const whiteElo = g.white?.rating;
    const blackElo = g.black?.rating;
    if (whiteAcc == null || blackAcc == null || !whiteElo || !blackElo || !g.pgn) continue;
    const band = bandFor((whiteElo + blackElo) / 2);
    if (counts[band] >= QUOTA) continue;
    const id = hash(g.uuid || g.url);
    if (seen.has(id)) continue;
    const tokens = parsePgnMoves(g.pgn);
    const { sans } = replayForeignPgn(createEngine(), tokens);
    if (sans.length !== tokens.length || sans.length < MIN_PLIES) continue;
    seen.add(id);
    counts[band]++;
    perPlayer.set(playerHash, (perPlayer.get(playerHash) || 0) + 1);
    appendFileSync(OUT, JSON.stringify({
      id, band, playerHash, timeClass: g.time_class, moves: sans, whiteElo, blackElo, whiteAcc, blackAcc,
    }) + "\n");
  }
}

async function samplePlayer(username) {
  const list = await get(`https://api.chess.com/pub/player/${encodeURIComponent(username)}/games/archives`);
  const months = list?.archives?.slice(-2).reverse() || [];
  for (const url of months) {
    const archive = await get(url);
    if (archive) usableGames(archive, username);
  }
}

const allFull = () => BANDS.every((b) => counts[b] >= QUOTA);
const report = () => console.log(BANDS.map((b) => `${b}: ${counts[b]}`).join("  |  "));

report();
const checked = new Set();
let round = 0;
while (!allFull() && round < 200) {
  round++;
  /* Titled lists cover the top bands, and countries cover everything else. */
  const topShort = counts["2400+"] < QUOTA || counts["2000-2399"] < QUOTA;
  const useTitled = topShort && round % 2 === 0;
  const url = useTitled
    ? `https://api.chess.com/pub/titled/${TITLES[(round / 2) % TITLES.length | 0]}`
    : `https://api.chess.com/pub/country/${COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)]}/players`;
  const players = (await get(url))?.players || [];
  for (const username of shuffled(players).slice(0, 120)) {
    if (allFull()) break;
    if (checked.has(username)) continue;
    checked.add(username);
    await samplePlayer(username);
  }
  report();
}
console.log(allFull() ? "All bands full." : "Stopped before every band filled.");
