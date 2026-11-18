/* Music made in code for the opening film, until real tracks are added
   (a file in public/tactica/music/ always wins over this). Five moods, for
   cutscenes and story cards only, never under play:

     "wonder"  the pieces waking: a slow music-box arpeggio over a soft pad.
     "action"  the bond and the arena: drums, a driving bass and brass-like
               stabs in D minor, 124 beats a minute, two-bar loop.
     "sorrow"  the old owner, the attic, a lost run: A minor (Am F C G),
               a sparse falling bell line over slow pads.
     "dread"   an omen, a boss stepping out, refusing the bond: a low drone
               a tritone apart, a heartbeat on the drums, a cold high bell.
     "triumph" a boss beaten: a bright D major fanfare on the brass stabs
               over kick and toms.

   startScore(ctx, out, mood) returns a stop function. Notes are scheduled
   a little ahead on the audio clock, so timing stays steady even when the
   page is busy drawing. */

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

function env(ac, at, attack, decay, peak) {
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  return g;
}

let noiseBuf = null;
function noise(ac) {
  if (noiseBuf && noiseBuf.sampleRate === ac.sampleRate) return noiseBuf;
  noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

const INSTRUMENTS = {
  kick(ac, out, at, v) {
    const o = ac.createOscillator();
    o.frequency.setValueAtTime(140, at);
    o.frequency.exponentialRampToValueAtTime(42, at + 0.18);
    o.connect(env(ac, at, 0.004, 0.32, 0.9 * v)).connect(out);
    o.start(at); o.stop(at + 0.4);
  },
  snare(ac, out, at, v) {
    const n = ac.createBufferSource(); n.buffer = noise(ac);
    const f = ac.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 1900; f.Q.value = 0.8;
    n.connect(f).connect(env(ac, at, 0.002, 0.16, 0.45 * v)).connect(out);
    n.start(at, Math.random() * 0.5); n.stop(at + 0.2);
    const o = ac.createOscillator(); o.frequency.value = 190;
    o.connect(env(ac, at, 0.002, 0.09, 0.3 * v)).connect(out);
    o.start(at); o.stop(at + 0.12);
  },
  tom(ac, out, at, v, pitch = 110) {
    const o = ac.createOscillator();
    o.frequency.setValueAtTime(pitch, at);
    o.frequency.exponentialRampToValueAtTime(pitch * 0.6, at + 0.25);
    o.connect(env(ac, at, 0.004, 0.28, 0.6 * v)).connect(out);
    o.start(at); o.stop(at + 0.32);
  },
  hat(ac, out, at, v) {
    const n = ac.createBufferSource(); n.buffer = noise(ac);
    const f = ac.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 7000;
    n.connect(f).connect(env(ac, at, 0.001, 0.035, 0.12 * v)).connect(out);
    n.start(at, Math.random() * 0.5); n.stop(at + 0.06);
  },
  bass(ac, out, at, v, note, len) {
    const o = ac.createOscillator(); o.type = "sawtooth"; o.frequency.value = midi(note);
    const f = ac.createBiquadFilter(); f.type = "lowpass"; f.Q.value = 6;
    f.frequency.setValueAtTime(900, at); f.frequency.exponentialRampToValueAtTime(220, at + len);
    o.connect(f).connect(env(ac, at, 0.005, len, 0.28 * v)).connect(out);
    o.start(at); o.stop(at + len + 0.05);
  },
  /* Brass-like: detuned saws, a filter that opens and closes fast. */
  stab(ac, out, at, v, notes, len) {
    const f = ac.createBiquadFilter(); f.type = "lowpass"; f.Q.value = 2;
    f.frequency.setValueAtTime(400, at); f.frequency.exponentialRampToValueAtTime(2600, at + 0.04); f.frequency.exponentialRampToValueAtTime(700, at + len);
    const g = env(ac, at, 0.02, len, 0.14 * v);
    f.connect(g).connect(out);
    for (const n of notes) for (const d of [-7, 7]) {
      const o = ac.createOscillator(); o.type = "sawtooth"; o.frequency.value = midi(n); o.detune.value = d;
      o.connect(f); o.start(at); o.stop(at + len + 0.05);
    }
  },
  bell(ac, out, at, v, note) {
    const o = ac.createOscillator(); o.type = "triangle"; o.frequency.value = midi(note);
    const o2 = ac.createOscillator(); o2.type = "sine"; o2.frequency.value = midi(note) * 2.01;
    const g = env(ac, at, 0.005, 1.6, 0.12 * v);
    o.connect(g); o2.connect(env(ac, at, 0.005, 0.6, 0.04 * v)).connect(out);
    g.connect(out);
    o.start(at); o2.start(at); o.stop(at + 1.7); o2.stop(at + 0.7);
  },
  pad(ac, out, at, v, notes, len) {
    const f = ac.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 1200;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(0.05 * v, at + len * 0.4);
    g.gain.linearRampToValueAtTime(0.0001, at + len);
    f.connect(g).connect(out);
    for (const n of notes) { const o = ac.createOscillator(); o.type = "sine"; o.frequency.value = midi(n); o.connect(f); o.start(at); o.stop(at + len + 0.05); }
  },
};

/* What plays on each sixteenth of a two-bar loop (32 steps). */
const ACTION = {
  bpm: 124,
  steps: 32,
  play(I, ac, out, at, step, dur) {
    const s = step % 16, bar = step < 16 ? 0 : 1;
    if ([0, 3, 8, 11].includes(s)) I.kick(ac, out, at, 1);
    if (s === 4 || s === 12) I.snare(ac, out, at, bar && s === 12 ? 0.7 : 1);
    if (s % 2 === 0) I.hat(ac, out, at, s % 4 === 0 ? 1 : 0.6);
    /* A tom run into the loop's turn. */
    if (bar === 1 && s >= 13) I.tom(ac, out, at, 0.9, [130, 110, 92][s - 13]);
    /* Driving bass: D, with the climb to F and C on the off beats. */
    const line = [38, 38, 50, 38, 38, 41, 38, 48, 38, 38, 50, 38, 41, 43, 45, 48];
    I.bass(ac, out, at, 0.9, bar ? line[s] - (s < 8 ? 0 : 2) : line[s], dur * 0.9);
    /* Stabs: D minor, then B flat into C. */
    if (s === 0) I.stab(ac, out, at, 1, bar ? [58, 62, 65] : [62, 65, 69], dur * 5);
    if (s === 6 && !bar) I.stab(ac, out, at, 0.7, [62, 65, 69], dur * 1.5);
    if (s === 8 && bar) I.stab(ac, out, at, 1, [60, 64, 67], dur * 5);
  },
};

const WONDER = {
  bpm: 76,
  steps: 32,
  play(I, ac, out, at, step, dur) {
    /* D major with an added ninth, rising and falling, a bell on each step. */
    const notes = [62, 66, 69, 73, 76, 73, 69, 66];
    if (step % 2 === 0) I.bell(ac, out, at, 0.9, notes[(step / 2) % notes.length] + (step >= 16 ? -2 : 0));
    if (step === 0) I.pad(ac, out, at, 1, [50, 57, 62, 66], dur * 16);
    if (step === 16) I.pad(ac, out, at, 1, [48, 55, 60, 64], dur * 16);
  },
};

const SORROW = {
  bpm: 64,
  steps: 64,
  play(I, ac, out, at, step, dur) {
    /* Four bars, a chord each: A minor, F, C, G. */
    const chords = [[45, 57, 60, 64], [41, 53, 57, 60], [48, 55, 60, 64], [43, 55, 59, 62]];
    const bar = Math.floor(step / 16), s = step % 16;
    if (s === 0) I.pad(ac, out, at, 1.3, chords[bar], dur * 16);
    /* A falling line, one note on each beat but the last. */
    const tops = [[76, 72, 69], [77, 72, 69], [76, 72, 67], [74, 71, 67]];
    if (s % 4 === 0 && s < 12) I.bell(ac, out, at, 0.7, tops[bar][s / 4]);
  },
};

const DREAD = {
  bpm: 56,
  steps: 32,
  play(I, ac, out, at, step, dur) {
    /* D against A flat: the tritone, low and held. */
    if (step === 0) I.pad(ac, out, at, 1.6, [38, 44, 50], dur * 32);
    /* A heartbeat: lub-dub, then rest. */
    if (step % 8 === 0) I.tom(ac, out, at, 0.8, 70);
    if (step % 8 === 2) I.tom(ac, out, at, 0.55, 62);
    /* Now and then a cold, high bell. */
    if (step === 12) I.bell(ac, out, at, 0.5, 80);
    if (step === 28) I.bell(ac, out, at, 0.45, 86);
  },
};

const TRIUMPH = {
  bpm: 104,
  steps: 32,
  play(I, ac, out, at, step, dur) {
    const s = step % 16, bar = step < 16 ? 0 : 1;
    if (s % 4 === 0) I.kick(ac, out, at, 0.8);
    if (s === 8) I.snare(ac, out, at, 0.7);
    if (bar === 1 && s >= 12) I.tom(ac, out, at, 0.7, [150, 130, 115, 100][s - 12]);
    /* D, G, A, D: the fanfare. */
    if (s === 0) I.stab(ac, out, at, 1, bar ? [57, 61, 64] : [62, 66, 69], dur * 7);
    if (s === 8) I.stab(ac, out, at, 0.9, bar ? [62, 66, 69, 74] : [55, 59, 62], dur * 7);
    if (s % 2 === 0) I.bell(ac, out, at, 0.5, [74, 78, 81, 86, 81, 78, 76, 74][(s / 2) % 8] + (bar ? 2 : 0));
    I.bass(ac, out, at, 0.6, [38, 38, 38, 38, 43, 43, 45, 45][Math.floor(s / 2)] + (bar ? 0 : 0), dur * 0.8);
  },
};

const MOODS = { action: ACTION, wonder: WONDER, sorrow: SORROW, dread: DREAD, triumph: TRIUMPH };

/** Starts a mood; returns a function that fades it out and stops it. */
export function startScore(ac, out, mood, { volume = 0.5 } = {}) {
  const tune = MOODS[mood];
  if (!tune || !ac) return () => {};
  const bus = ac.createGain();
  bus.gain.setValueAtTime(0.0001, ac.currentTime);
  bus.gain.exponentialRampToValueAtTime(volume, ac.currentTime + 0.6);
  bus.connect(out);
  const dur = 60 / tune.bpm / 4;
  let step = 0, next = ac.currentTime + 0.08, stopped = false;
  const tick = () => {
    if (stopped) return;
    while (next < ac.currentTime + 0.15) {
      try { tune.play(INSTRUMENTS, ac, bus, next, step, dur); } catch { /* skip a note */ }
      step = (step + 1) % tune.steps;
      next += dur;
    }
  };
  tick();
  const timer = setInterval(tick, 40);
  return (fade = 0.8) => {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    const now = ac.currentTime;
    bus.gain.cancelScheduledValues(now);
    bus.gain.setValueAtTime(Math.max(0.0001, bus.gain.value), now);
    bus.gain.exponentialRampToValueAtTime(0.0001, now + fade);
    setTimeout(() => bus.disconnect(), (fade + 0.3) * 1000);
  };
}
