/* Chess Tactica's progress follows the signed-in account: the story (opening
   seen, the bond, hard mode, beaten), bonds, the furthest world reached and
   the bests. It rides on the account's own data (user_metadata.zl_tactica,
   like the rating's zl_rating), so no database table is needed. The lists
   of puzzles already seen stay on the device: they only stop repeats.

   On sign-in, progress made on this device while signed out is merged into
   the account (the better of each); progress that belongs to a different
   account that signed in here before is replaced by this account's own.
   After that, changes are saved to the account a moment after they happen.
   Signed out, everything works as before, on the device only. */
import { loadSetting, saveSetting } from "../utils/storage.js";
import { getSupabase } from "../utils/supabase.js";

const OWNER = "tacticaOwner";
const FRESH = { story: { seen: false, bond: null, hardSwitch: false, beaten: false }, bonds: {}, reached: 0, runBest: 0, blitzBest: 0, at: 0 };
const BOND_LEVELS = (bonds) => Object.fromEntries(Object.entries(bonds ?? {}).filter(([, v]) => Number.isFinite(v) && v >= 0).map(([k, v]) => [k, Math.round(v)]));

/** This device's progress, as saved to the account. `at` says when it last
 *  changed, so the newer side wins the few choices that can't be merged. */
export function deviceProgress() {
  const story = loadSetting("tacticaStory", null) ?? {};
  return {
    story: { seen: story.seen === true, bond: story.bond === "yes" || story.bond === "refused" ? story.bond : null, hardSwitch: story.hardSwitch === true, beaten: story.beaten === true },
    bonds: BOND_LEVELS(loadSetting("tacticaBonds", {})),
    reached: Math.max(0, Number(loadSetting("tacticaRunReached", 0)) || 0),
    runBest: Math.max(0, Number(loadSetting("tacticaRunBest", 0)) || 0),
    blitzBest: Math.max(0, Number(loadSetting("tacticaBlitzBest", 0)) || 0),
    at: Number(loadSetting("tacticaAt", 0)) || 0,
  };
}

/** The account's copy, cleaned up, or null. */
export function accountProgress(session) {
  const p = session?.user?.user_metadata?.zl_tactica;
  if (!p || typeof p !== "object") return null;
  const s = p.story ?? {};
  return {
    story: { seen: s.seen === true, bond: s.bond === "yes" || s.bond === "refused" ? s.bond : null, hardSwitch: s.hardSwitch === true, beaten: s.beaten === true },
    bonds: BOND_LEVELS(p.bonds),
    reached: Math.max(0, Math.round(Number(p.reached) || 0)),
    runBest: Math.max(0, Math.round(Number(p.runBest) || 0)),
    blitzBest: Math.max(0, Math.round(Number(p.blitzBest) || 0)),
    at: Number(p.at) || 0,
  };
}

/** Two copies of progress made into one: the most of every number, every
 *  story moment either side has reached, and for the bond and the hard
 *  mode switch (choices, not progress) the newer side's answer. */
export function mergeProgress(a, b) {
  if (!a) return b;
  if (!b) return a;
  const newer = b.at > a.at ? b : a, older = newer === a ? b : a;
  const kinds = new Set([...Object.keys(a.bonds), ...Object.keys(b.bonds)]);
  return {
    story: {
      seen: a.story.seen || b.story.seen,
      bond: newer.story.bond ?? older.story.bond,
      hardSwitch: newer.story.hardSwitch,
      beaten: a.story.beaten || b.story.beaten,
    },
    bonds: Object.fromEntries([...kinds].map((k) => [k, Math.max(a.bonds[k] ?? 0, b.bonds[k] ?? 0)])),
    reached: Math.max(a.reached, b.reached),
    runBest: Math.max(a.runBest, b.runBest),
    blitzBest: Math.max(a.blitzBest, b.blitzBest),
    at: Math.max(a.at, b.at),
  };
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function writeDevice(p) {
  saveSetting("tacticaStory", p.story);
  saveSetting("tacticaBonds", p.bonds);
  saveSetting("tacticaRunReached", p.reached);
  saveSetting("tacticaRunBest", p.runBest);
  saveSetting("tacticaBlitzBest", p.blitzBest);
  saveSetting("tacticaAt", p.at);
}

async function writeAccount(p) {
  const supabase = await getSupabase();
  await supabase?.auth.updateUser({ data: { zl_tactica: p } }).catch(() => {});
}

let signedIn = null, timer = null;

/** Called when the signed-in account changes (null when signed out).
 *  Returns true if this device's progress was changed, so open screens can
 *  reload it. */
export function syncTacticaAccount(session) {
  const id = session?.user?.id ?? null;
  signedIn = id;
  if (!id) return false;
  const owner = loadSetting(OWNER, null);
  const theirs = accountProgress(session);
  const mine = deviceProgress();
  /* Another account's progress is on this device: don't hand it to this one. */
  const merged = owner != null && owner !== id ? (theirs ?? FRESH) : mergeProgress(mine, theirs);
  saveSetting(OWNER, id);
  const changed = !same(merged, mine);
  if (changed) writeDevice(merged);
  if (!same(merged, theirs)) writeAccount(merged);
  return changed;
}

/** Call after Tactica saves progress on the device: it's stamped and, when
 *  signed in, saved to the account a moment later (several changes in a row
 *  make one save). */
export function noteTacticaChange() {
  saveSetting("tacticaAt", Date.now());
  if (!signedIn) return;
  clearTimeout(timer);
  timer = setTimeout(() => writeAccount(deviceProgress()), 3000);
}
