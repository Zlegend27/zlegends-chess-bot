/* Kinnda's progress log and Today's Quests. Plain localStorage, like the
   shop save (kidShop.js): a child's progress stays on the tablet.

   The log keeps a small record per day (time played, games, puzzles,
   lessons) for two things:
   - Today's Quests: three small tasks a day, about ten minutes in all.
     Doing ANY one keeps the streak alive (a high bar breaks streaks, and
     a broken streak is a reason to stop); doing all three opens the
     day's treasure chest.
   - The progress code (reportCode): a grown-up holds Owl on the home
     screen to copy it, and pastes it into a chat to get a written report
     on how she's doing. There is no grown-up screen in the app itself.

   Days are the tablet's own calendar days (local time), so "today" ends
   at her midnight, not at UTC midnight. All functions take the state and
   return a new one; `save` writes it. */

const KEY = "kinnda-progress-v1";
/* Days older than this are dropped, so the save stays small. */
const KEEP_DAYS = 60;
export const CHEST_COINS = 25;

/* The quests a day can hold. `need` is how many it takes; `go` says where
   the Go button leads (KidHome turns it into a screen). */
export const QUESTS = {
  lesson: { icon: "🎓", text: "Finish a lesson or level with Owl", need: 1, go: "learn" },
  puzzles: { icon: "🧩", text: "Solve 3 puzzles", need: 3, go: "puzzles" },
  daily: { icon: "📅", text: "Solve the Daily Puzzle", need: 1, go: "daily" },
  rush: { icon: "⚡", text: "Do a Puzzle Rush", need: 1, go: "rush" },
  game: { icon: "♞", text: "Play a game against an animal", need: 1, go: "play" },
};

/* One learning task, one thinking task and one game: about ten minutes. */
const SLOTS = [["lesson"], ["puzzles", "daily", "rush"], ["game"]];

const pad = (n) => String(n).padStart(2, "0");
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export function prevDayKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return dayKey(new Date(y, m - 1, d - 1));
}

function emptyDay() {
  return { seconds: 0, games: [], puzzles: { solved: 0, missed: 0, themesMissed: {} }, daily: false, rushes: [], lessons: [], levels: [], lessonMisses: {}, chest: false };
}
export function emptyProgress() {
  return { days: {}, streak: { count: 0, best: 0, last: null }, stars: {}, pals: {} };
}

export function loadProgress() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyProgress();
    const parsed = JSON.parse(raw);
    return { ...emptyProgress(), ...parsed, streak: { ...emptyProgress().streak, ...(parsed.streak ?? {}) } };
  } catch {
    return emptyProgress();
  }
}
export function saveProgress(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage unavailable */ }
  return state;
}

export const dayOf = (state, key) => ({ ...emptyDay(), ...(state.days[key] ?? {}) });

/* A small, stable number from the date, so the quests change daily but
   stay the same all day. */
function seedOf(key) {
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}
/** Today's three quests: [{ id, ...QUESTS[id], done: count so far, complete }]. */
export function questsFor(state, key) {
  const day = dayOf(state, key);
  const seed = seedOf(key);
  return SLOTS.map((options, i) => {
    const id = options[(seed >> (i * 3)) % options.length];
    const done = Math.min(QUESTS[id].need, countFor(day, id));
    return { id, ...QUESTS[id], done, complete: done >= QUESTS[id].need };
  });
}
function countFor(day, id) {
  switch (id) {
    case "lesson": return day.lessons.length + day.levels.length;
    case "puzzles": return day.puzzles.solved;
    case "daily": return day.daily ? 1 : 0;
    case "rush": return day.rushes.length;
    case "game": return day.games.length;
    default: return 0;
  }
}

/** The streak as it stands today: alive only if a quest was done today
 *  or yesterday. */
export function liveStreak(state, key) {
  const { count, last } = state.streak;
  return last === key || last === prevDayKey(key) ? count : 0;
}

/** Records something she did. Events:
 *  { type: "time", seconds } · { type: "game", opponent, result: "win" | "loss" | "draw", moves }
 *  { type: "puzzle", solved, rating, themes, rush } · { type: "daily" }
 *  { type: "rush", seconds, solved } · { type: "lesson", id } · { type: "lessonMiss", id }
 *  { type: "level", id, stars }: an Adventure level or an Opening Camp step */
export function record(state, event, key = dayKey()) {
  const day = dayOf(state, key);
  switch (event.type) {
    case "time": day.seconds += event.seconds; break;
    case "game": day.games = [...day.games, { opponent: event.opponent, result: event.result, moves: event.moves ?? 0 }]; break;
    case "puzzle": {
      const p = { ...day.puzzles, themesMissed: { ...day.puzzles.themesMissed } };
      if (event.solved) p.solved += 1;
      else {
        p.missed += 1;
        for (const t of event.themes ?? []) p.themesMissed[t] = (p.themesMissed[t] ?? 0) + 1;
      }
      day.puzzles = p;
      break;
    }
    case "daily": day.daily = true; break;
    case "rush": day.rushes = [...day.rushes, { seconds: event.seconds, solved: event.solved }]; break;
    case "lesson": day.lessons = [...day.lessons, event.id]; break;
    case "level": day.levels = [...day.levels, { id: event.id, stars: event.stars ?? 0 }]; break;
    case "lessonMiss": day.lessonMisses = { ...day.lessonMisses, [event.id]: (day.lessonMisses[event.id] ?? 0) + 1 }; break;
    default: return state;
  }
  let next = { ...state, days: prune({ ...state.days, [key]: day }, key) };
  /* The first quest done today keeps (or starts) the streak. */
  if (next.streak.last !== key && questsFor(next, key).some((q) => q.complete)) {
    const count = next.streak.last === prevDayKey(key) ? next.streak.count + 1 : 1;
    next = { ...next, streak: { count, best: Math.max(next.streak.best, count), last: key } };
  }
  return next;
}

/** Whether today's chest can be opened (all three quests done, not yet opened). */
export const chestReady = (state, key = dayKey()) => !dayOf(state, key).chest && questsFor(state, key).every((q) => q.complete);
export function openChest(state, key = dayKey()) {
  if (!chestReady(state, key)) return state;
  return { ...state, days: { ...state.days, [key]: { ...dayOf(state, key), chest: true } } };
}

function prune(days, key) {
  const [y, m, d] = key.split("-").map(Number);
  const cutoff = dayKey(new Date(y, m - 1, d - KEEP_DAYS));
  return Object.fromEntries(Object.entries(days).filter(([k]) => k >= cutoff));
}

/** The progress code a grown-up copies for a report: the last 14 days and
 *  the lasting totals, as one line of text. */
export function reportCode(state, shop, key = dayKey()) {
  const days = [];
  let k = key;
  for (let i = 0; i < 14; i++) {
    if (state.days[k]) days.push({ day: k, ...state.days[k] });
    k = prevDayKey(k);
  }
  const report = {
    app: "Kinnda Chess", v: 1, made: new Date().toISOString(), today: key,
    questStreak: liveStreak(state, key), bestQuestStreak: state.streak.best,
    winsByAnimal: shop?.winsByAnimal ?? {}, lessonsDone: shop?.completedLessons ?? [],
    dailyPuzzleStreak: shop?.dailyStreak ?? 0, bestRush: shop?.bestRushStreak ?? {}, coins: shop?.coins ?? 0,
    adventureStars: state.stars ?? {}, piecePals: state.pals ?? {},
    days,
  };
  return "KINNDA-PROGRESS " + JSON.stringify(report);
}

/* ---------------- Adventure stars ---------------- */

/** Keeps a level's best score (0-3 stars). */
export function setStars(state, id, stars) {
  const now = state.stars?.[id] ?? 0;
  if (stars <= now) return state;
  return { ...state, stars: { ...(state.stars ?? {}), [id]: stars } };
}

/* ---------------- Piece Pals ----------------
   Each kind of piece earns XP when she uses it well (a capture in a game,
   the first move of a solved puzzle, a checkmate) and levels up 1 to 5,
   like Tactica's bonds in the main app. Her pieces show it on the board:
   a sparkle from level 3, a golden glow at 5. */
export const PAL_KINDS = ["pawn", "knight", "bishop", "rook", "queen", "king"];
export const PAL_XP = [0, 40, 120, 250, 450];
export const palLevel = (xp = 0) => PAL_XP.filter((t) => xp >= t).length;
/** Adds XP to a piece kind (1 pawn .. 6 king): { state, levelUp } where
 *  levelUp is the new level, or 0. */
export function addPalXp(state, type, xp) {
  const kind = PAL_KINDS[type - 1];
  if (!kind || xp <= 0) return { state, levelUp: 0 };
  const before = state.pals?.[kind] ?? 0;
  const after = before + xp;
  const next = { ...state, pals: { ...(state.pals ?? {}), [kind]: after } };
  const up = palLevel(after) > palLevel(before) ? palLevel(after) : 0;
  return { state: next, levelUp: up };
}
