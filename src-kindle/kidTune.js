/* A tiny, cheerful looping tune plus a few sound effects, built the same
   way the main web app's chiptune player is (raw Web Audio oscillators,
   no audio files) — just much simpler, since this is one background loop
   instead of a full track list. */

const LOOP_NOTES = [523.25, 587.33, 659.25, 783.99, 659.25, 587.33, 523.25, 659.25];

export function createKidAudio() {
  let ctx = null;
  let playing = false;
  let timer = null;
  let step = 0;

  function ensure() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type, vol) {
    const c = ensure();
    const t0 = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur);
  }

  function tick() {
    tone(LOOP_NOTES[step % LOOP_NOTES.length], 0.3, "triangle", 0.12);
    step++;
    timer = setTimeout(tick, 380);
  }

  function toggle() {
    ensure();
    if (playing) {
      clearTimeout(timer);
      playing = false;
    } else {
      playing = true;
      tick();
    }
    return playing;
  }

  function stop() {
    clearTimeout(timer);
    playing = false;
  }

  function sfxMove() {
    try { tone(440, 0.08, "square", 0.1); } catch { /* audio unavailable */ }
  }

  function sfxCapture() {
    try { tone(220, 0.12, "sawtooth", 0.12); } catch { /* audio unavailable */ }
  }

  function sfxWin() {
    try {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => setTimeout(() => tone(f, 0.3, "square", 0.18), i * 120));
    } catch { /* audio unavailable */ }
  }

  function sfxLose() {
    try {
      [392, 349.23, 311.13].forEach((f, i) => setTimeout(() => tone(f, 0.35, "sine", 0.14), i * 150));
    } catch { /* audio unavailable */ }
  }

  return { toggle, stop, sfxMove, sfxCapture, sfxWin, sfxLose, isPlaying: () => playing };
}
