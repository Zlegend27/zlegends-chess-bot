/* Sounds made in code, for the things no recording covers: the pieces'
   little crowd (cheers, gasps, whispers, a hopeful "aww"), a cat, wind,
   birds, a low drone under the narrator, a heartbeat, a ticking clock.
   Each takes the audio context, the node to play into, a start time and a
   volume, and schedules itself; nothing here keeps running afterwards
   except wind, which is stopped by the function it returns. */

const rand = (a, b) => a + Math.random() * (b - a);

let noiseBuffer = null;
function noise(ac) {
  if (noiseBuffer && noiseBuffer.sampleRate === ac.sampleRate) return noiseBuffer;
  const len = ac.sampleRate * 2;
  noiseBuffer = ac.createBuffer(1, len, ac.sampleRate);
  const d = noiseBuffer.getChannelData(0);
  /* Pinkish: white noise run through a gentle smoothing. */
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0527;
    d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
  }
  return noiseBuffer;
}

function envelope(ac, at, attack, hold, release, peak) {
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + attack);
  g.gain.setValueAtTime(Math.max(0.0002, peak), at + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, at + attack + hold + release);
  return g;
}

function noiseBurst(ac, out, at, { dur = 1, freq = 1000, q = 0.8, type = "bandpass", attack = 0.05, release = 0.3, peak = 0.3, pan = 0 } = {}) {
  const src = ac.createBufferSource();
  src.buffer = noise(ac);
  src.loop = true;
  const f = ac.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = envelope(ac, at, attack, Math.max(0, dur - attack - release), release, peak);
  let node = src.connect(f).connect(g);
  if (pan && ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = pan; node = node.connect(p); }
  node.connect(out);
  src.start(at, Math.random());
  src.stop(at + dur + 0.05);
  return f;
}

/* One small voice: a buzzy tone shaped by two formants, gliding in pitch.
   `contour` is [[time, frequency], ...] relative to `at`. */
function voice(ac, out, at, contour, { peak = 0.06, formants = [800, 1250], pan = 0, wave = "sawtooth" } = {}) {
  const dur = contour[contour.length - 1][0];
  const o = ac.createOscillator();
  o.type = wave;
  o.frequency.setValueAtTime(contour[0][1], at);
  for (const [t, f] of contour.slice(1)) o.frequency.linearRampToValueAtTime(f, at + t);
  /* A little wobble, so it sounds alive. */
  const vib = ac.createOscillator(), depth = ac.createGain();
  vib.frequency.value = rand(5, 7); depth.gain.value = contour[0][1] * 0.025;
  vib.connect(depth).connect(o.frequency);
  const g = envelope(ac, at, 0.03, Math.max(0, dur - 0.11), 0.08, peak);
  const mix = ac.createGain();
  for (const [fq, gain] of [[formants[0], 1], [formants[1], 0.6]]) {
    const f = ac.createBiquadFilter();
    f.type = "bandpass"; f.frequency.value = fq; f.Q.value = 5;
    const fg = ac.createGain(); fg.gain.value = gain;
    o.connect(f).connect(fg).connect(mix);
  }
  let node = mix.connect(g);
  if (pan && ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = pan; node = node.connect(p); }
  node.connect(out);
  for (const n of [o, vib]) { n.start(at); n.stop(at + dur + 0.1); }
}

export const SYNTHS = {
  /* The pieces cheering: a swell of crowd under a scatter of small high
     "yay!"s and "woo!"s. */
  cheer(ac, out, at, volume, { dur = 2.2, size = 16 } = {}) {
    noiseBurst(ac, out, at, { dur, freq: 1300, q: 0.7, attack: 0.25, release: 0.9, peak: 0.22 * volume });
    noiseBurst(ac, out, at, { dur: dur * 0.8, freq: 2600, q: 1.2, attack: 0.2, release: 0.6, peak: 0.08 * volume });
    for (let i = 0; i < size; i++) {
      const t = at + rand(0, dur * 0.7), base = rand(420, 760), len = rand(0.28, 0.6);
      const woo = Math.random() < 0.4;
      voice(ac, out, t, woo
        ? [[0, base * 0.8], [len * 0.4, base * 1.5], [len, base * 1.1]]
        : [[0, base], [len * 0.3, base * 1.35], [len, base * 0.9]],
      { peak: 0.05 * volume, formants: woo ? [700, 1100] : [900, 1700], pan: rand(-0.8, 0.8) });
    }
  },
  /* A gasp from the crowd: "ooh!" sliding up. */
  ooh(ac, out, at, volume) {
    noiseBurst(ac, out, at, { dur: 0.9, freq: 900, q: 0.8, attack: 0.08, release: 0.5, peak: 0.12 * volume });
    for (let i = 0; i < 10; i++) {
      const base = rand(300, 520), t = at + rand(0, 0.12);
      voice(ac, out, t, [[0, base], [0.5, base * 1.45], [0.85, base * 1.3]], { peak: 0.05 * volume, formants: [500, 900], pan: rand(-0.7, 0.7) });
    }
  },
  /* Hopeful and sad at once: "awww". */
  aww(ac, out, at, volume) {
    for (let i = 0; i < 8; i++) {
      const base = rand(420, 620), t = at + rand(0, 0.15);
      voice(ac, out, t, [[0, base * 1.2], [0.9, base * 0.85], [1.2, base * 0.8]], { peak: 0.045 * volume, formants: [750, 1150], pan: rand(-0.6, 0.6) });
    }
  },
  /* Whispering in the huddle: short breathy bursts. */
  whisper(ac, out, at, volume, { dur = 2.4 } = {}) {
    for (let t = 0; t < dur; t += rand(0.08, 0.2)) {
      noiseBurst(ac, out, at + t, { dur: rand(0.06, 0.16), freq: rand(3000, 6000), q: 2, attack: 0.01, release: 0.05, peak: rand(0.03, 0.08) * volume, pan: rand(-0.5, 0.5) });
    }
  },
  /* A small surprised squeak, for each pair of eyes popping open. */
  squeak(ac, out, at, volume) {
    const base = rand(700, 1000);
    voice(ac, out, at, [[0, base], [0.12, base * 1.6]], { peak: 0.06 * volume, formants: [1100, 2200], wave: "triangle", pan: rand(-0.5, 0.5) });
  },
  /* The cat on the wall, startled. */
  meow(ac, out, at, volume) {
    voice(ac, out, at, [[0, 520], [0.12, 880], [0.45, 760], [0.6, 600]], { peak: 0.12 * volume, formants: [900, 2400], pan: 0.5 });
  },
  /* Birds going home: a few quick chirps. */
  chirp(ac, out, at, volume) {
    for (let i = 0; i < 4; i++) {
      const t = at + i * rand(0.12, 0.22), f = rand(2600, 3600);
      const o = ac.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 1.4, t + 0.05); o.frequency.exponentialRampToValueAtTime(f * 0.9, t + 0.09);
      const g = envelope(ac, t, 0.005, 0.04, 0.05, 0.05 * volume);
      o.connect(g).connect(out); o.start(t); o.stop(t + 0.12);
    }
  },
  /* A low swell under the narrator and the moments that matter. */
  drone(ac, out, at, volume, { dur = 6 } = {}) {
    for (const [f, peak] of [[55, 0.16], [82.4, 0.09], [110, 0.05]]) {
      const o = ac.createOscillator();
      o.type = "sine"; o.frequency.value = f;
      const g = envelope(ac, at, dur * 0.35, dur * 0.3, dur * 0.35, peak * volume);
      o.connect(g).connect(out); o.start(at); o.stop(at + dur + 0.1);
    }
    noiseBurst(ac, out, at, { dur, freq: 220, q: 0.6, type: "lowpass", attack: dur * 0.4, release: dur * 0.4, peak: 0.06 * volume });
  },
  /* Two thumps of a heart. */
  heartbeat(ac, out, at, volume) {
    for (const [t, peak] of [[0, 1], [0.24, 0.7]]) {
      const o = ac.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(70, at + t); o.frequency.exponentialRampToValueAtTime(40, at + t + 0.15);
      const g = envelope(ac, at + t, 0.01, 0.03, 0.14, 0.4 * peak * volume);
      o.connect(g).connect(out); o.start(at + t); o.stop(at + t + 0.25);
    }
  },
  /* A slow-motion whoom: everything stretched. */
  whoom(ac, out, at, volume) {
    const o = ac.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(90, at); o.frequency.exponentialRampToValueAtTime(38, at + 2);
    const f = ac.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 300;
    const g = envelope(ac, at, 0.3, 1.2, 0.6, 0.18 * volume);
    o.connect(f).connect(g).connect(out); o.start(at); o.stop(at + 2.2);
    noiseBurst(ac, out, at, { dur: 2, freq: 400, q: 0.5, type: "lowpass", attack: 0.3, release: 0.8, peak: 0.15 * volume });
  },
  /* Wind, for outdoors and the blizzard: a moving band of noise. Runs until
     the returned function is called. */
  wind(ac, out, at, volume) {
    const src = ac.createBufferSource();
    src.buffer = noise(ac); src.loop = true;
    const f = ac.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 500; f.Q.value = 0.9;
    const lfo = ac.createOscillator(), lfoGain = ac.createGain();
    lfo.frequency.value = 0.13; lfoGain.gain.value = 260;
    lfo.connect(lfoGain).connect(f.frequency);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.35 * volume, at + 1.5);
    src.connect(f).connect(g).connect(out);
    src.start(at); lfo.start(at);
    return (fade = 1) => {
      const now = ac.currentTime;
      g.gain.cancelScheduledValues(now); g.gain.setValueAtTime(Math.max(0.0002, g.gain.value), now); g.gain.exponentialRampToValueAtTime(0.0001, now + fade);
      src.stop(now + fade + 0.05); lfo.stop(now + fade + 0.05);
    };
  },
};
