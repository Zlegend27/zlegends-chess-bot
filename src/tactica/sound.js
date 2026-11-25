/* Chess Tactica's sound effects. Real recordings (Kenney's CC0 packs, see
   public/tactica/sfx/CREDITS.txt) played through the Web Audio API, with a
   touch of random pitch so repeats don't sound mechanical, plus a fly buzz
   synthesized in code that drifts past now and then. Phones only allow
   sound after a touch, so nothing loads or plays until unlock() is called
   from one. An on/off switch and a volume level for all of it, and a
   vibration switch for hits, remembered on this device. */
import { loadSetting, saveSetting } from "../utils/storage";
import { SYNTHS } from "./synth.js";
import { startScore, playSting } from "./score.js";

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

/* Everything goes through `master` (the on/off switch and the volume);
   music (real tracks and the code-made score) also goes through `musicBus`,
   its own level, so players can keep the effects and quiet the music. */
let ctx = null, master = null, musicBus = null;
const buffers = new Map();
let enabled = loadSetting(KEY, true) !== false;
let level = Math.min(1, Math.max(0, Number(loadSetting("tacticaVolume", 1)) || 0));
let vibrate = loadSetting("tacticaVibrate", true) !== false;
let musicLevel = Math.min(1, Math.max(0, Number(loadSetting("tacticaMusicVolume", 1)) || 0));
const gainNow = () => (enabled ? MASTER * level : 0);
let flyTimer = null, fliesWanted = false;
const listeners = new Set();

export const soundOn = () => enabled;
/** Calls `fn(on)` whenever the switch changes; returns an unsubscribe. */
export function onSoundChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function setSoundOn(on) {
  enabled = on;
  saveSetting(KEY, on);
  if (master) master.gain.value = gainNow();
  listeners.forEach((fn) => fn(on));
}

/** The volume level, 0 to 1. */
export const soundLevel = () => level;
export function setSoundLevel(v) {
  level = Math.min(1, Math.max(0, Number(v) || 0));
  saveSetting("tacticaVolume", level);
  if (master) master.gain.value = gainNow();
}

/** The music's own level, 0 to 1 (under the main volume). */
export const musicVolume = () => musicLevel;
export function setMusicVolume(v) {
  musicLevel = Math.min(1, Math.max(0, Number(v) || 0));
  saveSetting("tacticaMusicVolume", musicLevel);
  if (musicBus) musicBus.gain.value = musicLevel;
}

/* Vibration. Android has the real thing (navigator.vibrate). iPhones don't,
   but since iOS 18 Safari gives a light system tick when a switch-style
   checkbox is toggled, so a hidden one is toggled instead: one light tick,
   no strength or pattern, and only during a touch (a hit landing later may
   not tick). */
const hasVibrate = () => typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
const isIos = () => typeof navigator !== "undefined" && (/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
let tickSwitch = null;
function iosTick() {
  try {
    if (!tickSwitch) {
      const label = document.createElement("label");
      label.setAttribute("aria-hidden", "true");
      label.style.cssText = "position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.setAttribute("switch", "");
      input.tabIndex = -1;
      label.appendChild(input);
      document.body.appendChild(label);
      tickSwitch = label;
    }
    tickSwitch.click();
  } catch { /* no tick here */ }
}
export const canVibrate = () => hasVibrate() || isIos();
export const vibrateOn = () => vibrate;
export function setVibrateOn(on) { vibrate = !!on; saveSetting("tacticaVibrate", vibrate); }
/** A short buzz (ms, or a pattern) if vibration is on; a light tick on iPhone. */
export function buzz(pattern = 60) {
  if (!vibrate) return;
  if (hasVibrate()) { try { navigator.vibrate(pattern); } catch { /* not allowed right now */ } return; }
  if (isIos()) iosTick();
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
      master.gain.value = gainNow();
      master.connect(ctx.destination);
      musicBus = ctx.createGain();
      musicBus.gain.value = musicLevel;
      musicBus.connect(master);
      for (const name of NAMES) {
        fetch(`/tactica/sfx/${name}.mp3`)
          .then((r) => r.arrayBuffer())
          .then((data) => ctx.decodeAudioData(data))
          .then((buf) => buffers.set(name, buf))
          .catch(() => { /* this one sound stays silent */ });
      }
      if (fliesWanted) scheduleFly();
      /* Music asked for before the first touch (the menu's) starts now. */
      if (pendingMusic) { const p = pendingMusic; pendingMusic = null; playMusic(p.name, p); }
      if (scoreMoodNow && !stopScore && enabled && !music?.src) stopScore = startScore(ctx, musicBus, scoreMoodNow, { volume: 0.5 });
    }
    if (ctx.state === "suspended") ctx.resume();
  } catch { /* no audio on this device */ }
}

/** Plays a sound: `volume` 0..1, `rate` (pitch and speed), `delay` in
 *  seconds, `pan` -1 (left) .. 1 (right). */
export function play(name, { volume = 1, rate = 1, delay = 0, pan = 0, ...rest } = {}) {
  if (!ctx || !enabled || ctx.state !== "running") return;
  /* Sounds made in code (synth.js): the crowd, the cat, birds, a drone... */
  if (SYNTHS[name] && name !== "wind") {
    try { SYNTHS[name](ctx, master, ctx.currentTime + delay, volume, rest); } catch { /* skip this one */ }
    return;
  }
  const buf = buffers.get(name);
  if (!buf) return;
  try {
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate * (0.96 + Math.random() * 0.08);
    const gain = ctx.createGain();
    /* A touch of variety, so a sound heard often never repeats exactly. */
    gain.gain.value = volume * (0.92 + Math.random() * 0.08);
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
function flyBuzz() {
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
  /* A fly now and then: 12-30 s apart (it was 8-22, which got old). */
  flyTimer = setTimeout(() => { flyBuzz(); scheduleFly(); }, 12000 + Math.random() * 18000);
}

/* Music. A track is a file in public/tactica/music/ (see the README
   there); if there isn't one, nothing plays and nothing breaks. One track
   at a time; starting another fades the last one out. */
let music = null;
/** Plays `name` (for example "opening"), looping if `loop`. */
/* A track asked for before the first touch (phones keep audio locked until
   then), started by unlock(). */
let pendingMusic = null;
/* Tracks are a few MB: each is downloaded once (starting as soon as it's
   asked for, even before the first touch) and decoded once, then kept, so
   it starts at once on the first tap and on every return to its screen. */
const trackFiles = new Map(), trackBuffers = new Map();
const trackFile = (name) => {
  if (!trackFiles.has(name)) {
    trackFiles.set(name, fetch(`/tactica/music/${name}.mp3`).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error("none")))));
    trackFiles.get(name).catch(() => trackFiles.delete(name));
  }
  return trackFiles.get(name);
};
/* Where a track's sound starts and ends: an MP3 carries a few milliseconds
   of silence at each end, which would be a gap at every loop. Worked out
   once per track. */
const loops = new WeakMap();
function loopPoints(buf) {
  if (!loops.has(buf)) {
    const d = buf.getChannelData(0), n = d.length, quiet = 0.0015;
    let a = 0, b = n - 1;
    while (a < n - 1 && Math.abs(d[a]) < quiet) a++;
    while (b > a && Math.abs(d[b]) < quiet) b--;
    /* Never trim more than half a second: a real pause in the music stays. */
    a = Math.min(a, buf.sampleRate * 0.5);
    b = Math.max(b, n - 1 - buf.sampleRate * 0.5);
    loops.set(buf, [a / buf.sampleRate, (b + 1) / buf.sampleRate]);
  }
  return loops.get(buf);
}
/** The track playing (or starting) now, or null: for checking on the dev server. */
export const musicNow = () => (music ? { name: music.name, playing: !!music.src } : null);
/** Starts downloading a track now (say, the next world's) so it can start
 *  at once later. Nothing plays. */
export function preloadMusic(name) { trackFile(name).catch(() => {}); }
const trackBuffer = (name) => {
  if (!trackBuffers.has(name)) {
    /* decodeAudioData takes the bytes over, so it gets its own copy. */
    trackBuffers.set(name, trackFile(name).then((data) => ctx.decodeAudioData(data.slice(0))));
    trackBuffers.get(name).catch(() => trackBuffers.delete(name));
  }
  return trackBuffers.get(name);
};
export function playMusic(name, { volume = 0.55, loop = false, fade = 1.2 } = {}) {
  /* Asked for again (the next floor of the same world): it carries on. */
  if (music?.name === name || pendingMusic?.name === name) return;
  stopMusic(fade);
  if (!ctx) { pendingMusic = { name, volume, loop, fade }; trackFile(name).catch(() => {}); return; }
  const mine = (music = { name, gain: null, src: null });
  trackBuffer(name)
    .then((buf) => {
      if (music !== mine) return;
      mine.src = ctx.createBufferSource();
      mine.src.buffer = buf;
      mine.src.loop = loop;
      if (loop) { const [a, b] = loopPoints(buf); mine.src.loopStart = a; mine.src.loopEnd = b; }
      mine.gain = ctx.createGain();
      mine.gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      mine.gain.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + fade);
      mine.src.connect(mine.gain).connect(musicBus);
      mine.src.start(ctx.currentTime, loop ? mine.src.loopStart : 0);
      /* A real track replaces the music made in code. */
      setScore(null);
    })
    .catch(() => { /* no track there: silence */ });
}
/* The music made in code (score.js), for when there's no real track. */
let stopScore = null, scoreMoodNow = null;
/** Plays the code-made music in `mood` (see score.js), or stops it with
 *  null. Never plays over a real track. */
export function setScore(mood) {
  if (mood === scoreMoodNow) return;
  scoreMoodNow = mood;
  stopScore?.();
  stopScore = null;
  if (!mood || !ctx || !enabled || music?.src) return;
  stopScore = startScore(ctx, musicBus, mood, { volume: 0.5 });
}

/** A short phrase for the end of a game: "win", "lose" or "draw". */
export function sting(kind) {
  if (!ctx || !enabled || ctx.state !== "running") return;
  playSting(ctx, master, kind);
}

/** Fades the music out over `fade` seconds. */
export function stopMusic(fade = 1.2) {
  pendingMusic = null;
  const old = music;
  music = null;
  if (!old?.src || !ctx) return;
  try {
    old.gain.gain.cancelScheduledValues(ctx.currentTime);
    old.gain.gain.setValueAtTime(Math.max(0.0001, old.gain.gain.value), ctx.currentTime);
    old.gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + fade);
    old.src.stop(ctx.currentTime + fade + 0.05);
  } catch { /* already stopped */ }
}

/* Wind, for outdoors and the blizzard, until it is turned off. */
let stopWindNow = null;
export function setWind(on, volume = 1) {
  stopWindNow?.(1.2);
  stopWindNow = null;
  if (!on || !ctx || !enabled || ctx.state !== "running") return;
  try { stopWindNow = SYNTHS.wind(ctx, master, ctx.currentTime, volume); } catch { /* no wind */ }
}

/** The flies in the bin buzz past every so often while `on`. */
export function setFlies(on) {
  fliesWanted = on;
  if (on) scheduleFly();
  else clearTimeout(flyTimer);
}
