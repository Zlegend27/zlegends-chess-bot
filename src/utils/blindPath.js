/* The Blind Chess Trainer's path (2026-11-24). Stages open one at a time,
   easiest first, and each stage takes the board away step by step:

     board  the pieces are shown; answer by tapping squares
     bare   an empty board with coordinates; tap, but picture the pieces
     blind  no board at all: text or voice (the goal)

   Support is taken away by how the player does, not on a fixed schedule
   (adaptive fading), in sessions of five: 5 right jumps two steps, 4 right
   one, 3 stays, 2 or fewer goes back one for more practice. The next
   stage opens once this one reaches its first no-board step; a stage is
   done after a good session on its last step. */

/* Each step: how it's shown, and the question difficulty (blindDrills
   level). */
const FULL = [
  { view: "board", level: 1 }, { view: "board", level: 3 },
  { view: "bare", level: 3 }, { view: "bare", level: 5 },
  { view: "blind", level: 5 }, { view: "blind", level: 7 }, { view: "blind", level: 10 },
];
const NO_BARE = [
  { view: "board", level: 1 }, { view: "board", level: 3 },
  { view: "blind", level: 3 }, { view: "blind", level: 6 }, { view: "blind", level: 10 },
];

export const STAGES = [
  { id: "coords", drill: "coords", name: "Find the square", desc: "Tap the square you're told.",
    steps: [{ view: "board", level: 1, coords: true }, { view: "board", level: 2 }, { view: "board", level: 3, flipped: true }] },
  { id: "colors", drill: "colors", name: "Square colours", desc: "Light or dark, without looking.", steps: NO_BARE },
  { id: "reach", drill: "reach", name: "Piece reach", desc: "Where can a knight or bishop go?", steps: FULL },
  { id: "tracking", drill: "tracking", name: "Piece tracking", desc: "Follow the moves and find a piece.", steps: FULL },
  { id: "squares", drill: "squares", name: "What's on the square?", desc: "Follow the moves, say what's there.", steps: NO_BARE },
  { id: "openings", drill: "openings", name: "Name the opening", desc: "Hear the first moves, name the opening.", steps: NO_BARE },
  { id: "checks", drill: "checks", name: "Find a check", desc: "A small position: give check.", steps: FULL },
  { id: "free", drill: "free", name: "Free pieces", desc: "Take a piece that can't be taken back.", steps: FULL },
  { id: "recapture", drill: "recapture", name: "Take back", desc: "After a capture, which piece takes back?", steps: NO_BARE },
  { id: "mate", drill: "mate", name: "Mate in one", desc: "A small position: find checkmate.", steps: FULL },
];

export const SESSION = 5;
const stageOf = (id) => STAGES.find((s) => s.id === id);

export function emptyPath() {
  return Object.fromEntries(STAGES.map((s) => [s.id, { step: 0, done: false, answered: 0, correct: 0, sessions: 0 }]));
}

/** Where a stage's steps first go board-free (or its last step). */
export const unlockStep = (stage) => {
  const i = stage.steps.findIndex((x) => x.view === "blind");
  return i === -1 ? stage.steps.length - 1 : i;
};

/** Which stages are open: the first always; each next one once the one
 *  before reaches its no-board step (or is done). */
export function openStages(path) {
  const open = [];
  for (let i = 0; i < STAGES.length; i++) {
    const s = STAGES[i];
    if (i === 0) { open.push(s.id); continue; }
    const prev = STAGES[i - 1], p = path[prev.id];
    if (p && (p.done || p.step >= unlockStep(prev))) open.push(s.id); else break;
  }
  return open;
}

/** The stage Continue goes to: the furthest open one that isn't done,
 *  so the player keeps moving forward; earlier ones can be practised from
 *  the path. */
export function nextStage(path) {
  const open = openStages(path);
  for (let i = open.length - 1; i >= 0; i--) if (!path[open[i]].done) return open[i];
  return open[open.length - 1];
}

/** How a finished session moves the stage: returns the new record and
 *  what happened ("up2", "up", "same", "down", "done"). */
export function afterSession(record, stageId, right, of = SESSION) {
  const stage = stageOf(stageId);
  const last = stage.steps.length - 1;
  const r = { ...record, sessions: record.sessions + 1, answered: record.answered + of, correct: record.correct + right };
  const share = right / of;
  let move = share === 1 ? 2 : share >= 0.8 ? 1 : share >= 0.6 ? 0 : -1;
  if (record.step === last && move > 0) return { record: { ...r, done: true }, change: "done" };
  r.step = Math.max(0, Math.min(last, record.step + move));
  return { record: r, change: move >= 2 && r.step - record.step >= 2 ? "up2" : r.step > record.step ? "up" : r.step < record.step ? "down" : "same" };
}

export const stepOf = (path, stageId) => {
  const s = stageOf(stageId);
  return s.steps[Math.min(path[stageId]?.step ?? 0, s.steps.length - 1)];
};
export const VIEW_NAMES = { board: "With the board", bare: "Board, no pieces", blind: "No board" };
