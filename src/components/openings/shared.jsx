/* Shared pieces of the Opening Trainer: loading a course's move tree, the
   coach, the progress kept on this device, and small board helpers. */
import { createEngine } from "../../engine/chessEngine";
import { loadSetting, saveSetting } from "../../utils/storage";
import PixelAvatar, { ZPAL, ZPIX } from "../PixelAvatar";

/* Each course's tree is its own file, loaded only when that course opens. */
const TREES = import.meta.glob("../../data/openings/*.json");
const cache = new Map();
export async function loadCourseData(id) {
  if (cache.has(id)) return cache.get(id);
  const loader = TREES[`../../data/openings/${id}.json`];
  if (!loader) return null;
  const data = (await loader()).default;
  cache.set(id, data);
  return data;
}

/** A fresh engine with `moves` (SAN) played; null if one doesn't fit. */
export function engineAt(moves) {
  const eng = createEngine();
  for (const san of moves) {
    const m = eng.legalMoves().find((x) => eng.sanOf(x) === san);
    if (m === undefined) return null;
    eng.make(m);
  }
  return eng;
}

/** Moves written the way players read them: "1.e4 e5 2.Nc3". */
export function movesText(moves, from = 0) {
  let out = "";
  for (let i = from; i < moves.length; i++) {
    const n = Math.floor(i / 2) + 1;
    if (i % 2 === 0) out += `${n}.${moves[i]} `;
    else out += (i === from ? `${n}…` : "") + `${moves[i]} `;
  }
  return out.trim();
}

/** Coach Zlegend: the site's pixel avatar and a speech card. */
export function Coach({ children, T, tag = null, size = 44 }) {
  return (
    <div className={`grid grid-cols-[auto_1fr] gap-3 rounded-2xl border p-3 ${T.cardBorder} ${T.panelBg} backdrop-blur-sm`}>
      <PixelAvatar rows={ZPIX} pal={ZPAL} size={size} />
      <div className="min-w-0">
        <div className={`text-[11px] font-bold uppercase tracking-wider ${T.interactiveText}`}>Coach Zlegend</div>
        <div className={`mt-1 text-[15px] leading-relaxed ${T.ink}`}>{children}</div>
        {tag}
      </div>
    </div>
  );
}

/** A small rounded tag: "good" (cyan), "bad" (red) or "note" (gold). */
export function Tag({ kind = "note", children }) {
  const styles = {
    good: "border-cyan/40 bg-cyan/10 text-cyan",
    bad: "border-[#ff4c5b]/45 bg-[#ff4c5b]/12 text-[#ff9aa3]",
    note: "border-yellow/40 bg-yellow/10 text-yellow",
  };
  return <span className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${styles[kind]}`}>{children}</span>;
}

/* ---- Progress, kept on this device ----
   { [courseId/lineId]: { idea: true, quiz: best%, scenarios: [ids done], practice: { easy, medium, hard } } } */
const PROGRESS_KEY = "openingProgress";
export const loadProgress = () => loadSetting(PROGRESS_KEY, {}) ?? {};
export function saveProgress(courseId, lineId, update) {
  const all = loadProgress();
  const key = `${courseId}/${lineId}`;
  all[key] = { ...(all[key] ?? {}), ...update(all[key] ?? {}) };
  saveSetting(PROGRESS_KEY, all);
  return all;
}
/** 0..100 for a line: the idea, the quiz score, scenarios seen, practice. */
export function lineProgress(p, scenarioCount = 4) {
  if (!p) return 0;
  const idea = p.idea ? 1 : 0;
  const quiz = (p.quiz ?? 0) / 100;
  const scen = Math.min(1, (p.scenarios?.length ?? 0) / Math.max(1, scenarioCount));
  const practice = Object.values(p.practice ?? {}).filter(Boolean).length / 3;
  return Math.round(((idea + quiz + scen + practice) / 4) * 100);
}

export const REVIEW_KEY = "openingReviews";
export const loadReviews = () => loadSetting(REVIEW_KEY, {}) ?? {};
export const saveReviews = (items) => saveSetting(REVIEW_KEY, items);

/** A progress ring: `value` 0..100. */
export function Ring({ value, size = 34 }) {
  return (
    <span
      className="grid place-items-center rounded-full"
      style={{ width: size, height: size, background: `conic-gradient(var(--color-cyan) ${value * 3.6}deg, rgba(255,255,255,.15) 0)` }}
      aria-label={`${value}% done`}
    >
      <span className="grid place-items-center rounded-full bg-void text-[10px] font-bold text-paper" style={{ width: size - 8, height: size - 8 }}>{value}%</span>
    </span>
  );
}
