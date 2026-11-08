/* Chess Tactica's sound effects. Real recordings (Kenney's CC0 packs, see
   public/tactica/sfx/CREDITS.txt) played through the Web Audio API, with a
   touch of random pitch so repeats don't sound mechanical, plus a fly buzz
   synthesized in code that drifts past now and then. Phones only allow
   sound after a touch, so nothing loads or plays until unlock() is called
   from one. One on/off switch for all of it, remembered on this device. */
import { loadSetting, saveSetting } from "../utils/storage";

const NAMES = [
  "tap", "land", "landHeavy", "step", "plank", "brass", "ghost", "swish", "slice", "draw", "chop",
  "cloth1", "cloth2", "cloth3", "punch", "punchHeavy", "plate", "metal", "thud", "poof", "soft",
  "bell", "crack", "zap", "charge", "crunch", "rumble", "shimmer", "error", "confirm", "chime",
  "tick", "coins", "creak", "drop", "scrape",
];
const MASTER = 0.8;
const KEY = "tacticaSound";

/* When each attack's sounds land, in seconds of the attack's own clip (so
   they keep in step at any speed): [time, sound, volume]. */
export const ATTACK_CUES = {
  pawn: [[0.32, "swish", 0.7], [0.6, "punch", 0.9], [0.62, "metal", 0.35], [1.05, "thud", 0.6]],
  knight: [[0.4, "cloth1", 0.5], [0.6, "swish", 0.45], [1.18, "punchHeavy", 1], [1.19, "plate", 0.7], [1.2, "crunch", 0.35]],
  bishop: [[0.2, "draw", 0.6], [0.46, "swish", 0.8], [0.52, "chop", 0.6], [0.9, "slice", 0.9], [1.25, "thud", 0.5]],
  rook: [[0.35, "cloth1", 0.45], [0.6, "cloth2", 0.45], [0.85, "cloth3", 0.45], [1.15, "step", 0.5], [1.3, "step", 0.5], [1.45, "step", 0.5],
    [1.7, "metal", 0.8], [1.71, "chop", 0.8], [2.15, "thud", 0.5]],
  queen: [[0.5, "charge", 0.45], [0.8, "zap", 0.75], [1.35, "poof", 0.8], [1.5, "shimmer", 0.5], [1.8, "shimmer", 0.6]],
  king: [[0.55, "bell", 0.55], [1.55, "draw", 0.55], [1.95, "chop", 0.9], [2.25, "thud", 0.7], [2.42, "tap", 0.45], [2.58, "tap", 0.35], [2.72, "tap", 0.25], [2.95, "soft", 0.5]],
};

let ctx = null, master = null;
const buffers = new Map();
let enabled = loadSetting(KEY, true) !== false;
let flyTimer = null, fliesWanted = false;
const listeners = new Set();

export const soundOn = () => enabled;
/** Calls `fn(on)` whenever the switch changes; returns an unsubscribe. */
export function onSoundChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function setSoundOn(on) {
  enabled = on;
  saveSetting(KEY, on);
  if (master) master.gain.value = on ? MASTER : 0;
  listeners.forEach((fn) => fn(on));
}

/** Starts audio from inside a touch or click (phones require it) and loads
 *  the sounds the first time. Safe to call on every touch. */
export function unlock() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = enabled ? MASTER : 0;
      master.connect(ctx.destination);
      for (const name of NAMES) {
        fetch(`/tactica/sfx/${name}.mp3`)
          .then((r) => r.arrayBuffer())
          .then((data) => ctx.decodeAudioData(data))
          .then((buf) => buffers.set(name, buf))
          .catch(() => { /* this one sound stays silent */ });
      }
      if (fliesWanted) scheduleFly();
    }
    if (ctx.state === "suspended") ctx.resume();
  } catch { /* no audio on this device */ }
}

/** Plays a sound: `volume` 0..1, `rate` (pitch and speed), `delay` in
 *  seconds, `pan` -1 (left) .. 1 (right). */
export function play(name, { volume = 1, rate = 1, delay = 0, pan = 0 } = {}) {
  if (!ctx || !enabled || ctx.state !== "running") return;
  const buf = buffers.get(name);
  if (!buf) return;
  try {
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate * (0.96 + Math.random() * 0.08);
    const gain = ctx.createGain();
    gain.gain.value = volume;
    let node = src.connect(gain);
    if (pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      node = node.connect(p);
    }
    node.connect(master);
    src.start(ctx.currentTime + delay);
  } catch { /* skip this one */ }
}

/** A single fly buzzing past: a reedy hum that wobbles, swells and fades
 *  while it drifts from one side to the other. Made in code. */
function buzz() {
  if (!ctx || !enabled || ctx.state !== "running") return;
  try {
    const now = ctx.currentTime, len = 0.9 + Math.random() * 1.1;
    const base = 180 + Math.random() * 60;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, now);
    out.gain.exponentialRampToValueAtTime(0.05, now + 0.25);
    out.gain.setValueAtTime(0.05, now + len * 0.55);
    out.gain.exponentialRampToValueAtTime(0.0001, now + len);
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 700;
    filter.Q.value = 0.9;
    const wobble = ctx.createOscillator();
    wobble.frequency.value = 5 + Math.random() * 4;
    const depth = ctx.createGain();
    depth.gain.value = 14;
    wobble.connect(depth);
    const voices = [0, 7].map((detune) => {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = base;
      o.detune.value = detune;
      depth.connect(o.frequency);
      o.connect(filter);
      return o;
    });
    let chain = filter.connect(out);
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      const from = Math.random() < 0.5 ? -0.8 : 0.8;
      p.pan.setValueAtTime(from, now);
      p.pan.linearRampToValueAtTime(-from * 0.6, now + len);
      chain = chain.connect(p);
    }
    chain.connect(master);
    for (const o of [wobble, ...voices]) { o.start(now); o.stop(now + len + 0.05); }
  } catch { /* no fly this time */ }
}

function scheduleFly() {
  clearTimeout(flyTimer);
  if (!fliesWanted) return;
  flyTimer = setTimeout(() => { buzz(); scheduleFly(); }, 8000 + Math.random() * 14000);
}

/** The flies in the bin buzz past every so often while `on`. */
export function setFlies(on) {
  fliesWanted = on;
  if (on) scheduleFly();
  else clearTimeout(flyTimer);
}
