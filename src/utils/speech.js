/* ================================================================
   Blind Chess — browser speech services.

   Thin wrappers over the Web Speech API (free, on-device/browser
   provided — deliberately no paid cloud STT/TTS; see the blind-mode
   design discussion). Both degrade gracefully: recognition reports
   supported:false on browsers without it (Firefox), and speak()
   resolves immediately if speechSynthesis is missing, so BlindMode
   can always fall back to its text input.
   ================================================================ */

/* ---------------- voice selection ----------------
   The browser's DEFAULT voice is usually its most robotic one. Most
   browsers also ship far better voices for free — Edge's "Natural"
   voices and Chrome's network-backed "Google" voices are dramatically
   more human — so rank what's installed and auto-pick the best. */

function scoreVoice(v) {
  if (!/^en([-_]|$)/i.test(v.lang)) return -1;
  let s = 0;
  const name = v.name.toLowerCase();
  if (name.includes("natural") || name.includes("neural")) s += 40;
  if (name.includes("google")) s += 20;
  if (name.includes("online")) s += 8;
  if (!v.localService) s += 4;      // network voices are usually the good ones
  if (/^en-US/i.test(v.lang)) s += 2;
  return s;
}

/** Voices load asynchronously in Chrome — resolves once they exist
 *  (or with [] on browsers with no voices at all). */
export function loadVoices() {
  const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
  if (!synth) return Promise.resolve([]);
  const now = synth.getVoices();
  if (now.length) return Promise.resolve(now);
  return new Promise((resolve) => {
    const done = () => resolve(synth.getVoices());
    synth.addEventListener("voiceschanged", done, { once: true });
    setTimeout(done, 1500); // some browsers never fire the event
  });
}

export function rankEnglishVoices(voices) {
  return voices
    .map(v => ({ voice: v, score: scoreVoice(v) }))
    .filter(x => x.score >= 0)
    .sort((a, b) => b.score - a.score)
    .map(x => x.voice);
}

/* Chrome bug: network voices go silent partway through utterances longer
   than ~200 characters (and synthesis stalls entirely after ~15s). Board
   reads easily exceed that, so split into sentence-sized chunks — each
   chunk is its own utterance, spoken back to back. */
function chunkForSpeech(text, maxLen = 180) {
  const sentences = text.split(/(?<=[.?!])\s+/);
  const chunks = [];
  let cur = "";
  for (const s of sentences) {
    if (cur && cur.length + s.length + 1 > maxLen) { chunks.push(cur); cur = s; }
    else cur = cur ? cur + " " + s : s;
    /* a single monster sentence still needs splitting — break on commas */
    while (cur.length > maxLen) {
      const cut = cur.lastIndexOf(", ", maxLen);
      if (cut < 40) break;
      chunks.push(cur.slice(0, cut + 1));
      cur = cur.slice(cut + 2);
    }
  }
  if (cur) chunks.push(cur);
  return chunks;
}

/** TTS with a strict queue — announcements must never talk over each
 *  other ("Knight takes f6, check" arriving mid-"Your move" would be
 *  unintelligible without a board to glance at). */
export function createSpeaker() {
  const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
  let queue = Promise.resolve();
  let enabled = true;
  let voice = null;   // null = browser default until pickBestVoice resolves

  if (synth) loadVoices().then(vs => { if (!voice) voice = rankEnglishVoices(vs)[0] || null; });

  const speakChunk = (text) => new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    if (voice) u.voice = voice;
    u.rate = 1.0;
    u.onend = resolve;
    u.onerror = resolve;
    /* Chrome sometimes drops the onend event (esp. after cancel()). The
       mic stays off until the speech queue drains, so a lost onend would
       otherwise deafen the app permanently — this generous length-based
       timeout guarantees the queue always drains. */
    setTimeout(resolve, 2000 + text.length * 120);
    synth.speak(u);
  });

  const speakOne = async (text) => {
    if (!synth || !enabled) return;
    for (const chunk of chunkForSpeech(text)) await speakChunk(chunk);
  };

  return {
    supported: !!synth,
    /** Queues text; returned promise resolves when THIS utterance ends. */
    speak(text) {
      queue = queue.then(() => speakOne(text));
      return queue;
    },
    cancel() {
      queue = Promise.resolve();
      if (synth) synth.cancel();
    },
    setEnabled(on) {
      enabled = on;
      if (!on && synth) synth.cancel();
    },
    setVoice(v) { voice = v || null; },
    get voiceName() { return voice ? voice.name : null; },
    get speaking() { return !!synth && synth.speaking; },
  };
}

/** Speech recognition tuned for short move utterances: one phrase per
 *  session, caller restarts between turns (this is also what lets the
 *  conversation layer keep the mic off while TTS plays, so the bot
 *  doesn't hear itself). */
export function createRecognizer({ onResult, onStart, onEnd, onError } = {}) {
  const Ctor = typeof window !== "undefined"
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null;
  if (!Ctor) {
    return { supported: false, start() {}, stop() {}, get active() { return false; }, get blocked() { return false; } };
  }
  const rec = new Ctor();
  rec.lang = "en-US";
  rec.continuous = false;
  rec.interimResults = false;
  rec.maxAlternatives = 1;

  let active = false;
  /* Permission denials must stop the start/onend/restart loop dead —
     retrying a blocked mic spins forever and hides the problem. The
     caller is told once via onError and start() refuses until reset. */
  let blocked = false;
  rec.onstart = () => { active = true; if (onStart) onStart(); };
  rec.onresult = (e) => {
    const alt = e.results[e.results.length - 1][0];
    if (onResult) onResult(alt.transcript, alt.confidence);
  };
  rec.onend = () => { active = false; if (onEnd) onEnd(); };
  rec.onerror = (e) => {
    active = false;
    if (e.error === "not-allowed" || e.error === "service-not-allowed") blocked = true;
    /* "no-speech"/"aborted" are routine between turns, not failures */
    if (onError && e.error !== "no-speech" && e.error !== "aborted") onError(e.error);
  };

  return {
    supported: true,
    start() {
      if (active || blocked) return;
      try { rec.start(); } catch { /* already started */ }
    },
    stop() {
      try { rec.abort(); } catch { /* not running */ }
      active = false;
    },
    /** Clears a remembered permission block (e.g. after the user grants
     *  mic access and toggles the mic back on). */
    resetBlock() { blocked = false; },
    get active() { return active; },
    get blocked() { return blocked; },
  };
}

/** Explicitly requests mic permission via getUserMedia — unlike
 *  SpeechRecognition.start(), this reliably raises the browser's
 *  permission prompt from a click, and reports denial as a real error
 *  instead of a silent "not-allowed" loop. The track is released
 *  immediately; only the permission grant matters. */
export async function requestMicPermission() {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return { ok: false, reason: "unsupported" };
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    for (const track of stream.getTracks()) track.stop();
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.name === "NotAllowedError" ? "denied" : (e.name || "error") };
  }
}
