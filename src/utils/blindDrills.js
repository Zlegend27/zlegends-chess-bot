/* Blind Chess Trainer drills (BLIND_TRAINER_PLAN.md): boardless questions
   for players up to about 1000, answered by typing or speaking. Every
   question is made from real positions and checked by the engine or by
   replaying the moves, never guessed. No AI: explanations are written
   from what the engine knows.

   A question: { drill, level, prompt, spoken, kind, choices?, check(text),
   fen }. check() returns { understood, correct, explanation }; when the
   answer can't be read at all (understood: false) the player is asked
   again without it counting. */
import { createEngine, mFrom, mTo, M120TO64, WP, WK } from "../engine/chessEngine.js";
import { OPENINGS } from "./openings.js";
import { extractSquares, extractPiece, normalize, sanToSpeech, PIECE_SPOKEN } from "./blindChess.js";

export const MAX_LEVEL = 10;

export const DRILLS = [
  { id: "colors", name: "Square colours", desc: "Is a square light or dark?" },
  { id: "reach", name: "Piece reach", desc: "Where can a knight or bishop go?" },
  { id: "tracking", name: "Piece tracking", desc: "Follow the moves and find a piece." },
  { id: "squares", name: "What's on the square?", desc: "Follow the moves and name what's there." },
  { id: "openings", name: "Name the opening", desc: "Hear the first moves, name the opening." },
];

const FILES = "abcdefgh";
const sq = (f, r) => FILES[f] + (r + 1);
const fileOf = (s) => FILES.indexOf(s[0]);
const rankOf = (s) => Number(s[1]) - 1;
const pick = (arr, rand) => arr[Math.floor(rand() * arr.length) % arr.length];
const isDark = (s) => (fileOf(s) + rankOf(s)) % 2 === 0;

/** "1.e4 e5 2.Nf3" and its spoken form. */
export function movesText(moves) {
  return moves.map((m, i) => (i % 2 === 0 ? `${i / 2 + 1}.${m}` : m)).join(" ");
}
export function movesSpoken(moves) {
  return moves.map((m, i) => `${i % 2 === 0 ? "White" : "Black"} ${sanToSpeech(m)}`).join(". ") + ".";
}

/* ---------------- reading answers ---------------- */
const words = (text) => normalize(text).split(" ").filter(Boolean);
function readSquare(text) {
  const n = normalize(text);
  const found = extractSquares(n);
  if (found.length) return found[0];
  const joined = n.replace(/\s+/g, "");
  return /^[a-h][1-8]$/.test(joined) ? joined : null;
}
function readYesNo(text) {
  const w = words(text);
  if (w.some((x) => ["yes", "yeah", "yep", "yup", "same", "correct", "true"].includes(x))) return true;
  if (w.some((x) => ["no", "nope", "nah", "different", "false", "not"].includes(x))) return false;
  return null;
}
function readColour(text) {
  const w = words(text);
  if (w.some((x) => ["light", "white", "lite"].includes(x))) return "light";
  if (w.some((x) => ["dark", "black"].includes(x))) return "dark";
  return null;
}
const NUMBER_WORDS = { zero: 0, one: 1, won: 1, two: 2, to: 2, too: 2, three: 3, four: 4, for: 4, five: 5, six: 6, seven: 7, eight: 8, ate: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14 };
function readNumber(text) {
  for (const x of words(text)) {
    if (/^\d+$/.test(x)) return Number(x);
    if (NUMBER_WORDS[x] !== undefined) return NUMBER_WORDS[x];
  }
  return null;
}
function readEmpty(text) {
  return words(text).some((x) => ["empty", "nothing", "none", "nobody", "blank"].includes(x));
}
function readColourWord(text) {
  const w = words(text);
  if (w.includes("white")) return 1;
  if (w.includes("black")) return -1;
  return 0;
}

/* ---------------- 1. square colours ---------------- */
function colorsQuestion(level, rand) {
  const s1 = sq(Math.floor(rand() * 8), Math.floor(rand() * 8));
  const tip = "Tip: a1 is dark, and colours alternate along every row and column.";
  if (level <= 4) {
    const answer = isDark(s1) ? "dark" : "light";
    return {
      kind: "colour", choices: ["Light", "Dark"], answer: answer,
      prompt: `Is ${s1} a light or a dark square?`, spoken: `Is ${s1} a light or a dark square?`,
      check: (text) => {
        const a = readColour(text);
        if (!a) return { understood: false };
        return { understood: true, correct: a === answer, explanation: `${s1} is ${answer}. ${tip}` };
      },
    };
  }
  let s2 = s1;
  while (s2 === s1) s2 = sq(Math.floor(rand() * 8), Math.floor(rand() * 8));
  const same = isDark(s1) === isDark(s2);
  return {
    kind: "yesno", choices: ["Yes", "No"], answer: same ? "yes" : "no",
    prompt: `Are ${s1} and ${s2} the same colour?`, spoken: `Are ${s1} and ${s2} the same colour?`,
    check: (text) => {
      const a = readYesNo(text);
      if (a === null) return { understood: false };
      return { understood: true, correct: a === same, explanation: `${s1} is ${isDark(s1) ? "dark" : "light"} and ${s2} is ${isDark(s2) ? "dark" : "light"}, so ${same ? "yes, the same" : "no, different"}. ${tip}` };
    },
  };
}

/* ---------------- 2. piece reach (empty board) ---------------- */
const KNIGHT_JUMPS = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
export function reachOf(piece, from) {
  const f = fileOf(from), r = rankOf(from), out = [];
  const on = (x, y) => x >= 0 && x < 8 && y >= 0 && y < 8;
  if (piece === "knight") {
    for (const [dx, dy] of KNIGHT_JUMPS) if (on(f + dx, r + dy)) out.push(sq(f + dx, r + dy));
  } else {
    const dirs = piece === "bishop" ? [[1, 1], [1, -1], [-1, 1], [-1, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dy] of dirs) for (let k = 1; on(f + dx * k, r + dy * k); k++) out.push(sq(f + dx * k, r + dy * k));
  }
  return out;
}
function reachQuestion(level, rand) {
  const piece = level <= 3 || (level >= 6 && level <= 7) ? "knight" : "bishop";
  const count = level >= 6;
  const from = sq(Math.floor(rand() * 8), Math.floor(rand() * 8));
  const reach = reachOf(piece, from);
  const list = reach.join(", ");
  if (!count) {
    const q = `On an empty board, name one square a ${piece} on ${from} can move to.`;
    return {
      kind: "square", prompt: q, spoken: q, answer: reach[0],
      check: (text) => {
        const a = readSquare(text);
        if (!a) return { understood: false };
        return { understood: true, correct: reach.includes(a), explanation: `A ${piece} on ${from} can go to ${list}.` };
      },
    };
  }
  const q = `On an empty board, how many squares can a ${piece} on ${from} move to?`;
  return {
    kind: "number", prompt: q, spoken: q, answer: String(reach.length),
    check: (text) => {
      const a = readNumber(text);
      if (a === null) return { understood: false };
      return { understood: true, correct: a === reach.length, explanation: `${reach.length}: ${list}.` };
    },
  };
}

/* ---------------- move lines for tracking and squares ---------------- */
/* The openings' main lines are the sequences: real, sensible moves. Level
   sets how many moves are read out. */
const LINES = OPENINGS.map((o) => o.moves);
function lineFor(level, rand) {
  const plies = Math.min(2 + level, 15);
  const long = LINES.filter((l) => l.length >= Math.min(plies, 8));
  const line = pick(long.length ? long : LINES, rand);
  return line.slice(0, Math.min(plies, line.length));
}

/* Replays `moves`, following every piece from where it started. Returns
   the engine at the end, and for each piece still on the board its
   starting square and path. */
function follow(moves) {
  const eng = createEngine();
  eng.reset();
  const origin = {}; // current square -> { start, path, piece, color }
  for (let i = 0; i < 64; i++) {
    const p = eng.pieceAt(i);
    if (p) origin[sq(i % 8, (i / 8) | 0)] = { start: sq(i % 8, (i / 8) | 0), path: [sq(i % 8, (i / 8) | 0)], piece: Math.abs(p), color: p > 0 ? 1 : -1 };
  }
  for (const san of moves) {
    const m = eng.legalMoves().find((mv) => eng.sanOf(mv) === san);
    if (!m) break;
    const from = M120TO64[mFrom(m)], to = M120TO64[mTo(m)];
    const fromSq = sq(from % 8, (from / 8) | 0), toSq = sq(to % 8, (to / 8) | 0);
    const mover = origin[fromSq];
    delete origin[toSq];
    delete origin[fromSq];
    if (mover) origin[toSq] = { ...mover, path: [...mover.path, toSq] };
    /* Castling moves the rook too. */
    if (mover?.piece === WK && Math.abs(fileOf(toSq) - fileOf(fromSq)) === 2) {
      const r = rankOf(toSq), kingside = fileOf(toSq) > fileOf(fromSq);
      const rookFrom = sq(kingside ? 7 : 0, r), rookTo = sq(kingside ? 5 : 3, r);
      const rook = origin[rookFrom];
      delete origin[rookFrom];
      if (rook) origin[rookTo] = { ...rook, path: [...rook.path, rookTo] };
    }
    /* En passant removes a pawn that wasn't on the target square. */
    if (mover?.piece === WP && fileOf(toSq) !== fileOf(fromSq) && !eng.pieceAt(to)) {
      delete origin[sq(fileOf(toSq), rankOf(fromSq))];
    }
    eng.make(m);
  }
  return { eng, origin };
}

const SIDE = (c) => (c === 1 ? "White" : "Black");
const pieceName = (p) => PIECE_SPOKEN[p];

/* ---------------- 3. piece tracking ---------------- */
function trackingQuestion(level, rand) {
  const moves = lineFor(level, rand);
  const { eng, origin } = follow(moves);
  /* A piece that moved; prefer the last mover at low levels, any mover
     (often an earlier one, harder to keep in mind) higher up. */
  const movers = Object.entries(origin).filter(([, o]) => o.path.length > 1);
  const lastTo = movers.find(([s]) => s === followLastTo(moves));
  const chosen = level <= 3 && lastTo ? lastTo : pick(movers, rand);
  const [where, o] = chosen;
  const name = o.piece === WP ? `pawn that started on ${o.start}` : `${pieceName(o.piece)} that started on ${o.start}`;
  const prompt = `${movesText(moves)}. Where is ${SIDE(o.color)}'s ${name} now?`;
  return {
    kind: "square", moves, fen: eng.fen(), answer: where, about: { square: where, piece: o.piece, color: o.color },
    prompt, spoken: `${movesSpoken(moves)} Where is ${SIDE(o.color)}'s ${name} now?`,
    check: (text) => {
      const a = readSquare(text);
      if (!a) return { understood: false };
      return { understood: true, correct: a === where, explanation: `It's on ${where}: it went ${o.path.join(" to ")}.` };
    },
  };
}
function followLastTo(moves) {
  const { eng } = follow(moves.slice(0, -1));
  const m = eng.legalMoves().find((mv) => eng.sanOf(mv) === moves[moves.length - 1]);
  if (!m) return null;
  const to = M120TO64[mTo(m)];
  return sq(to % 8, (to / 8) | 0);
}

/* ---------------- 4. what's on the square ---------------- */
function squaresQuestion(level, rand) {
  const moves = lineFor(level, rand);
  const { eng, origin } = follow(moves);
  /* Ask about a square something moved to, or (sometimes, higher up) one
     it left, which is now empty. */
  const touched = new Set();
  for (const o of Object.values(origin)) for (const s of o.path) touched.add(s);
  const occupiedTouched = [...touched].filter((s) => origin[s] && origin[s].path.length > 1);
  const emptied = [...touched].filter((s) => !origin[s]);
  const askEmpty = level >= 4 && emptied.length && rand() < 0.3;
  const target = askEmpty ? pick(emptied, rand) : pick(occupiedTouched.length ? occupiedTouched : Object.keys(origin), rand);
  const there = origin[target] || null;
  const what = there ? `a ${SIDE(there.color).toLowerCase()} ${pieceName(there.piece)}` : "nothing";
  const prompt = `${movesText(moves)}. What is on ${target} now?`;
  return {
    kind: "piece", moves, fen: eng.fen(), answer: there ? `${SIDE(there.color).toLowerCase()} ${pieceName(there.piece)}` : "empty", about: { square: target, piece: there?.piece ?? 0, color: there?.color ?? 0 },
    prompt, spoken: `${movesSpoken(moves)} What is on ${target} now?`,
    check: (text) => {
      const empty = readEmpty(text);
      const piece = extractPiece(normalize(text));
      if (!empty && piece === null) return { understood: false };
      const colour = readColourWord(text);
      const correct = there ? !empty && piece === there.piece && (colour === 0 || colour === there.color) : empty;
      return { understood: true, correct, explanation: `${target} has ${what} on it now.${there && there.path.length > 1 ? ` It came from ${there.path[there.path.length - 2]}.` : ""}` };
    },
  };
}

/* ---------------- 5. name the opening ---------------- */
const OPENING_KEYWORDS = {
  italian: ["italian", "giuoco", "piano"],
  "ruy-lopez": ["ruy", "lopez", "spanish"],
  scotch: ["scotch"],
  vienna: ["vienna"],
  sicilian: ["sicilian"],
  french: ["french"],
  "caro-kann": ["caro", "kann", "karo", "carokann"],
  scandinavian: ["scandinavian", "center counter", "centre counter"],
  "queens-gambit": ["queens gambit", "queen gambit"],
  qgd: ["declined"],
  "kings-indian": ["kings indian", "king indian"],
  london: ["london"],
};
const NAMEABLE = OPENINGS.filter((o) => OPENING_KEYWORDS[o.id]);
/* The fewest moves that tell this opening apart from the others. */
function shortestUnique(o) {
  for (let n = 1; n <= o.moves.length; n++) {
    const prefix = o.moves.slice(0, n).join(" ");
    if (NAMEABLE.filter((x) => x.moves.slice(0, n).join(" ") === prefix).length === 1) return n;
  }
  return o.moves.length;
}
function openingsQuestion(level, rand) {
  const o = pick(NAMEABLE, rand);
  const n = Math.min(o.moves.length, shortestUnique(o) + Math.max(0, 3 - Math.floor(level / 3)));
  const moves = o.moves.slice(0, n);
  const others = NAMEABLE.filter((x) => x.id !== o.id);
  const choices = [o];
  while (choices.length < 4) { const c = pick(others, rand); if (!choices.includes(c)) choices.push(c); }
  choices.sort(() => rand() - 0.5);
  const names = choices.map((c) => c.name);
  return {
    kind: "choice", moves, choices: names, answer: o.name,
    prompt: `${movesText(moves)}. Which opening is this?`,
    spoken: `${movesSpoken(moves)} Which opening is this? ${names.map((c, i) => `${i + 1}: ${c}`).join(". ")}.`,
    check: (text) => {
      const n2 = normalize(text);
      const num = readNumber(text);
      let said = num && num >= 1 && num <= choices.length ? choices[num - 1] : null;
      if (!said) said = choices.find((c) => (OPENING_KEYWORDS[c.id] || []).some((k) => n2.includes(k)) || n2 === normalize(c.name)) || null;
      /* "Queen's Gambit" also matches inside "Queen's Gambit Declined". */
      if (said?.id === "queens-gambit" && n2.includes("declined")) said = choices.find((c) => c.id === "qgd") || said;
      if (!said) return { understood: false };
      return { understood: true, correct: said.id === o.id, explanation: `It's the ${o.name}. ${o.summary}` };
    },
  };
}

const MAKERS = { colors: colorsQuestion, reach: reachQuestion, tracking: trackingQuestion, squares: squaresQuestion, openings: openingsQuestion };

/** A question for `drill` at `level` (1 to 10). */
export function makeQuestion(drill, level = 1, rand = Math.random) {
  const lv = Math.max(1, Math.min(MAX_LEVEL, Math.round(level)));
  const q = MAKERS[drill](lv, rand);
  return { drill, level: lv, ...q };
}

/* ---------------- progress ----------------
   Per drill: level, a run of right answers, a run of wrong ones, totals.
   Four right in a row moves up a level; two wrong in a row moves down. */
export const UP_AFTER = 4, DOWN_AFTER = 2;
export function emptyProgress() {
  return Object.fromEntries(DRILLS.map((d) => [d.id, { level: 1, right: 0, wrong: 0, answered: 0, correct: 0, best: 0 }]));
}
export function recordAnswer(progress, drill, correct) {
  const p = { ...(progress[drill] || emptyProgress()[drill]) };
  p.answered += 1;
  if (correct) {
    p.correct += 1; p.right += 1; p.wrong = 0;
    p.best = Math.max(p.best, p.right);
    if (p.right % UP_AFTER === 0 && p.level < MAX_LEVEL) p.level += 1;
  } else {
    p.wrong += 1; p.right = 0;
    if (p.wrong >= DOWN_AFTER && p.level > 1) { p.level -= 1; p.wrong = 0; }
  }
  return { ...progress, [drill]: p };
}

/* Exported for tests. */
export const _internal = { follow, readSquare, readYesNo, readColour, readNumber, isDark, shortestUnique, NAMEABLE };
