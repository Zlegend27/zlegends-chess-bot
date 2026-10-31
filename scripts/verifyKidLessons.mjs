/* Validates every SAN string in src-kindle/kidLessons.js against the
 * engine's own legal-move generator.
 *
 * kidLessons.js has claimed since it was written that its moves were
 * "hand-verified against the engine" -- but the script it pointed at
 * didn't exist in the repo, so nothing was actually checking. This is
 * that script.
 *
 * It matters most for the opening chapters (Vienna / Two Knights): a
 * typo in `demoMoves` silently shows the wrong position, and a typo in
 * `acceptable` makes a beat unsolvable -- a kid just gets told "not
 * quite" forever on a move that IS correct. Neither failure is visible
 * from reading the data.
 *
 *   node scripts/verifyKidLessons.mjs
 *
 * Exits non-zero on the first problem found, so it can gate a commit.
 */
import { createEngine } from "../src/engine/chessEngine.js";
import { KID_LESSON_CHAPTERS } from "../src-kindle/kidLessons.js";

let errors = 0;
let checked = 0;

const fail = (where, msg) => { errors++; console.error(`  FAIL  ${where}\n        ${msg}`); };

/** Replays SAN into a fresh engine from the beat's base position.
 *  Returns the engine on success, or null after reporting the problem. */
function replay(where, base, sans) {
  const eng = createEngine();
  if (base) {
    try { eng.loadFen(base); }
    catch { fail(where, `demoFen could not be loaded: ${base}`); return null; }
  }
  for (let i = 0; i < sans.length; i++) {
    const mv = eng.legalMoves().find(m => eng.sanOf(m) === sans[i]);
    if (!mv) {
      fail(where, `illegal/misspelled move at ply ${i + 1}: "${sans[i]}"  (line so far: ${sans.slice(0, i).join(" ") || "start"})`);
      return null;
    }
    eng.make(mv);
    checked++;
  }
  return eng;
}

for (const chapter of KID_LESSON_CHAPTERS) {
  console.log(`\n${chapter.id} -- ${chapter.title}`);
  const errorsBefore = errors;
  chapter.beats.forEach((beat, bi) => {
    const where = `${chapter.id} beat ${bi + 1} (${beat.type})`;
    const base = beat.demoFen || null;
    const sans = beat.demoFen ? [] : (beat.demoMoves || []);

    const eng = replay(where, base, sans);
    if (!eng) return;

    if (beat.type === "think") {
      if (!beat.acceptable?.length) { fail(where, "think beat has no `acceptable` moves"); return; }
      /* Each acceptable move must be legal in the beat's own position --
         this is the one that silently breaks a lesson. */
      for (const san of beat.acceptable) {
        if (!eng.legalMoves().some(m => eng.sanOf(m) === san)) {
          fail(where, `acceptable move "${san}" is not legal here -- this beat would be unsolvable`);
        } else checked++;
      }
      if (!beat.answer) fail(where, "think beat has no `answer` for Owl to explain with");
      /* `nudge` is optional (the player falls back to generic text), but
         a beat with no hint at all leaves a stuck kid nothing to read. */
      if (!beat.hint) fail(where, "think beat has no `hint`");
    }

    if (beat.type === "quiz") {
      if (!beat.options?.length) { fail(where, "quiz beat has no options"); return; }
      const correct = beat.options.filter(o => o.correct);
      if (correct.length !== 1) fail(where, `quiz needs exactly 1 correct option, found ${correct.length}`);
      beat.options.forEach((opt, oi) => {
        if (!opt.note) fail(where, `option ${oi + 1} ("${opt.label}") has no feedback note`);
        if (opt.move && !eng.legalMoves().some(m => eng.sanOf(m) === opt.move)) {
          fail(where, `option ${oi + 1} move "${opt.move}" is not legal here`);
        } else if (opt.move) checked++;
      });
    }

    if (beat.type === "narration" && !beat.text) fail(where, "narration beat has no text");
  });
  /* Per-chapter, not global -- otherwise one early failure hides the
     pass/fail state of every chapter after it. */
  if (errors === errorsBefore) console.log(`  ok (${chapter.beats.length} beats)`);
}

console.log(`\n${checked} moves checked across ${KID_LESSON_CHAPTERS.length} chapters.`);
if (errors) { console.error(`${errors} problem(s) found.`); process.exit(1); }
console.log("All kid lesson lines are legal.");
