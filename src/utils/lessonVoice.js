/* ================================================================
   Lesson coach voice -- the "blips" half of the voice modes.

   Animal Crossing-style synthesized chatter: short square-wave blips
   fired as the lesson text types itself out, pitched per-character so
   it babbles rather than beeps. Chosen over trying to imitate an
   actual game character's voice: Link famously has no dialogue to
   imitate, and this is the retro-game equivalent that fits the app's
   chiptune identity anyway. The TTS half of the voice modes reuses
   utils/speech.js (Blind Chess's speaker) -- nothing new needed there.

   One module-level AudioContext, lazily created on first blip (must be
   after a user gesture anyway -- entering a lesson counts).
   ================================================================ */

let ctx = null;

function ensureCtx() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

/** One chatter blip for the given character. Vowels get slightly longer,
 *  lower blips than consonants, and each letter lands on its own pitch
 *  (deterministic, so the same word always "sounds" the same) -- that
 *  tiny structure is what reads as babble instead of Morse code. */
export function charBlip(ch) {
  const c = ensureCtx();
  if (!c || !/[a-z0-9]/i.test(ch)) return; // silence for spaces/punctuation
  const lower = ch.toLowerCase();
  const isVowel = "aeiou".includes(lower);
  const seed = lower.charCodeAt(0) * 37 % 100;      // 0-99, stable per letter
  const freq = (isVowel ? 220 : 300) + seed * 2.2;  // ~220-520Hz band
  const dur = isVowel ? 0.075 : 0.05;
  const t = c.currentTime;
  const o = c.createOscillator(), g = c.createGain();
  o.type = "square";
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.045, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(c.destination);
  o.start(t); o.stop(t + dur + 0.02);
}
