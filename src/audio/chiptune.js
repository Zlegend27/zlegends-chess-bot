/* ---------------- audio: chiptune loop + SFX ---------------- */
const TRACKS = [
  { name: "Neon Gambit", bpm: 108, bassWave: "square", arpWave: "triangle",
    bass: [45, 45, 52, 45, 48, 48, 55, 48, 43, 43, 50, 43, 47, 47, 54, 50],
    arp:  [69, 72, 76, 81, 79, 76, 72, 69, 67, 72, 76, 84, 83, 79, 76, 71],
    pad:  [57, 60, 64] },
  { name: "Pawn Storm", bpm: 132, bassWave: "square", arpWave: "square",
    bass: [38, 38, 38, 45, 41, 41, 41, 48, 36, 36, 36, 43, 40, 40, 47, 45],
    arp:  [62, 65, 69, 74, 72, 69, 65, 62, 60, 65, 69, 77, 74, 72, 69, 65],
    pad:  [50, 53, 57] },
  { name: "Endgame Drift", bpm: 84, bassWave: "triangle", arpWave: "sine",
    bass: [40, 40, 47, 40, 43, 43, 50, 43, 45, 45, 52, 45, 38, 38, 45, 43],
    arp:  [64, 67, 71, 76, 74, 71, 67, 64, 69, 72, 76, 79, 76, 74, 71, 67],
    pad:  [52, 55, 59] },
  { name: "Check by Wire", bpm: 140, bassWave: "sawtooth", arpWave: "square",
    bass: [47, 47, 54, 47, 50, 50, 57, 50, 45, 45, 52, 45, 49, 49, 56, 50],
    arp:  [71, 74, 78, 83, 81, 78, 74, 71, 69, 74, 78, 86, 85, 81, 78, 73],
    pad:  [59, 62, 66] },
  { name: "Sicilian Sunrise", bpm: 116, bassWave: "triangle", arpWave: "triangle",
    bass: [43, 43, 50, 43, 47, 47, 54, 47, 45, 45, 52, 45, 48, 48, 55, 50],
    arp:  [67, 71, 74, 79, 76, 74, 71, 67, 69, 74, 78, 86, 83, 79, 76, 72],
    pad:  [55, 59, 62] },
  { name: "Blitz Mode", bpm: 156, bassWave: "square", arpWave: "sawtooth",
    bass: [33, 33, 40, 33, 36, 36, 43, 36, 35, 35, 38, 35, 41, 41, 43, 40],
    arp:  [69, 72, 76, 81, 79, 76, 72, 69, 71, 76, 79, 84, 83, 79, 76, 72],
    pad:  [45, 48, 52] },
];

export function createAudio(initialTrackIdx = 0, initialVolume = 0.6) {
  const st = { ctx: null, master: null, playing: false, nextTime: 0, step: 0, timer: null, volume: initialVolume };
  const f = m => 440 * Math.pow(2, (m - 69) / 12);
  const ensure = () => {
    if (!st.ctx) {
      const C = window.AudioContext || window.webkitAudioContext;
      st.ctx = new C();
      st.master = st.ctx.createGain();
      st.master.gain.value = st.volume;
      st.master.connect(st.ctx.destination);
    }
    if (st.ctx.state === "suspended") st.ctx.resume();
  };
  const voice = (freq, t, dur, type, g0) => {
    const o = st.ctx.createOscillator(), g = st.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(g0, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(st.master);
    o.start(t); o.stop(t + dur + 0.05);
  };
  st.trackIdx = ((initialTrackIdx % TRACKS.length) + TRACKS.length) % TRACKS.length;
  const cur = () => TRACKS[st.trackIdx];
  const stepDur = () => 60 / cur().bpm / 2;
  const scheduleStep = (i, t) => {
    const T = cur(), sd = stepDur();
    voice(f(T.bass[i % 16]), t, sd * 0.9, T.bassWave, 0.10);
    voice(f(T.arp[i % 16]), t, sd * 0.8, T.arpWave, 0.085);
    if (i % 32 === 0) for (const n of T.pad) voice(f(n), t, sd * 14, "sawtooth", 0.025);
  };
  const tick = () => {
    while (st.nextTime < st.ctx.currentTime + 0.28) {
      scheduleStep(st.step, st.nextTime);
      st.step++; st.nextTime += stepDur();
    }
  };
  st.toggle = () => {
    if (st.playing) {
      clearInterval(st.timer); st.timer = null; st.playing = false;
    } else {
      ensure();
      st.nextTime = st.ctx.currentTime + 0.06;
      st.timer = setInterval(tick, 90);
      st.playing = true;
    }
    return st.playing;
  };
  st.trackName = () => cur().name;
  st.trackIndex = () => st.trackIdx;
  st.trackCount = () => TRACKS.length;
  const switchTo = idx => {
    st.trackIdx = ((idx % TRACKS.length) + TRACKS.length) % TRACKS.length;
    st.step = 0;
    if (st.playing) st.nextTime = st.ctx.currentTime + 0.06;
    return st.trackName();
  };
  st.next = () => switchTo(st.trackIdx + 1);
  st.prev = () => switchTo(st.trackIdx - 1);
  st.setVolume = v => { st.volume = v; if (st.master) st.master.gain.value = v; };
  st.sfxMove = () => {
    ensure();
    const t = st.ctx.currentTime;
    voice(520, t, 0.07, "triangle", 0.14);
  };
  st.sfxCapture = () => {
    ensure();
    const t = st.ctx.currentTime;
    const o = st.ctx.createOscillator(), g = st.ctx.createGain();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(880, t);
    o.frequency.exponentialRampToValueAtTime(140, t + 0.16);
    g.gain.setValueAtTime(0.16, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g); g.connect(st.master);
    o.start(t); o.stop(t + 0.2);
  };
  return st;
}
