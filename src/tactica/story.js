/* Where a player stands with the pieces: whether they've seen the opening,
   how they answered "Will you bond with us?", and hard mode.

   - Saying yes (at either asking) makes the bond.
   - Refusing twice breaks it: hard mode is on, the pieces' eyes glow red,
     and no bonds can be made until the story is beaten or the question is
     reset in Settings.
   - Reaching the second world unlocks a hard mode switch in Settings for
     everyone, with the same red eyes; bonds still work with it.
   - Beating the story mends a broken bond.

   Everything is kept on the device. The functions here are pure (state in,
   state out); loadStory and saveStory do the reading and writing. */
import { loadSetting, saveSetting } from "../utils/storage.js";

const KEY = "tacticaStory";
/** bond: null (never asked), "yes" or "refused". */
export const NEW_STORY = { seen: false, bond: null, hardSwitch: false, beaten: false };

export function loadStory() {
  const saved = loadSetting(KEY, null);
  if (!saved || typeof saved !== "object") return { ...NEW_STORY };
  return {
    seen: saved.seen === true,
    bond: saved.bond === "yes" || saved.bond === "refused" ? saved.bond : null,
    hardSwitch: saved.hardSwitch === true,
    beaten: saved.beaten === true,
  };
}
export const saveStory = (story) => { saveSetting(KEY, story); return story; };

/** The opening has been watched (or skipped on a rewatch): `answer` is
 *  "yes", "refused", or null when it was skipped, which changes nothing. */
export function afterOpening(story, answer) {
  return { ...story, seen: true, bond: answer === "yes" || answer === "refused" ? answer : story.bond };
}

/** Hard mode is on: the bond was refused, or the switch is on. */
export const isHard = (story) => story.bond === "refused" || story.hardSwitch;
/** The pieces' eyes glow red whenever hard mode is on. */
export const redEyes = isHard;
/** Bonds grow and show unless the bond was refused. */
export const bondsOpen = (story) => story.bond !== "refused";
/** Whether hard mode can be switched off: not while the bond is refused. */
export const hardLocked = (story) => story.bond === "refused";
/** The hard mode switch appears once the second world has been reached
 *  (`reached` is the furthest world index, 0 for the bin). */
export const canSwitchHard = (reached) => reached >= 1;
export const setHardSwitch = (story, on) => ({ ...story, hardSwitch: !!on });

/** Settings' reset: the question will be asked again, with the opening. */
export const resetBond = (story) => ({ ...story, bond: null, seen: false });

/** The last floor is cleared: a broken bond is mended. */
export const beatStory = (story) => ({ ...story, beaten: true, bond: story.bond === "refused" ? "yes" : story.bond });
