/* The music side of the app: the chiptune engine (which also plays every
   sound effect), the Juice Box's MP3 playlists streamed from Supabase
   Storage, the volume, and the first-visit theme autoplay. Moved out of
   App.jsx; it only needs to know whether the Juice Box and Blind Mode are
   open (Blind Mode reads moves aloud, so music steps aside for it). */
import { useEffect, useRef, useState } from "react";
import { createAudio } from "../audio/chiptune";
import { MP3_PLAYLISTS, THEME_ID, loadPlaylistTracks } from "../utils/musicLibrary";
import { pickTrackIndex } from "../utils/trackIndex";
import { loadSetting, saveSetting } from "../utils/storage";
import { getSupabase } from "../utils/supabase";

export default function useMusic({ musicOpen, blindOpen }) {
  const musicOpenRef = useRef(musicOpen);
  musicOpenRef.current = musicOpen;
  const [volume, setVolume] = useState(() => loadSetting("volume", 60));

  const audioRef = useRef(null);
  if (!audioRef.current) audioRef.current = createAudio(loadSetting("trackIdx", 0), volume / 100, loadSetting("sfxOn", true));
  const audio = audioRef.current;

  /* MP3 side of the Juice Box -- streamed from Supabase Storage rather than
     synthesized, so it needs its own HTMLAudioElement instead of the
     chiptune player's oscillator graph. musicSource picks which engine is
     "live"; switching sources pauses whichever one was playing so they
     never overlap. */
  const mp3AudioRef = useRef(null);
  if (!mp3AudioRef.current) {
    mp3AudioRef.current = new Audio();
    mp3AudioRef.current.volume = volume / 100;
    /* "metadata" (not the "auto" default) so picking a playlist only costs
       a small header fetch for duration/seek-bar purposes -- the full
       multi-MB file doesn't start streaming until the player actually
       presses Play. Mobile connections were stalling for a long time
       before a song became audible because "auto" preload used to kick
       off a full download the instant a track was selected. */
    mp3AudioRef.current.preload = "metadata";
    /* Required for createMediaElementSource below to work at all -- must
       be set before any src is ever assigned. Supabase Storage serves
       permissive CORS on public objects, verified against the live
       bucket (non-zero, varying AnalyserNode data), so this doesn't
       silently break playback. */
    mp3AudioRef.current.crossOrigin = "anonymous";
  }
  const mp3Audio = mp3AudioRef.current;
  /* iOS Safari hard-ignores HTMLMediaElement.volume -- the only way to
     actually change an <audio> element's loudness there is to route it
     through a Web Audio GainNode instead, which iOS does respect. Created
     lazily (createMediaElementSource can only ever be called once per
     element) the first time mp3 playback actually starts, inside a user
     gesture so the AudioContext isn't blocked by autoplay policy. */
  const mp3GainRef = useRef(null);
  const volumeRef = useRef(volume);
  volumeRef.current = volume;
  const ensureMp3Gain = () => {
    if (mp3GainRef.current) return mp3GainRef.current;
    try {
      const C = window.AudioContext || window.webkitAudioContext;
      const ctx = new C();
      const source = ctx.createMediaElementSource(mp3Audio);
      const gainNode = ctx.createGain();
      gainNode.gain.value = volumeRef.current / 100;
      source.connect(gainNode).connect(ctx.destination);
      mp3GainRef.current = { ctx, gainNode };
    } catch {
      mp3GainRef.current = null;
    }
    return mp3GainRef.current;
  };
  const resumeMp3Gain = () => {
    const gain = ensureMp3Gain();
    if (gain && gain.ctx.state === "suspended") gain.ctx.resume();
  };
  const [musicSource, setMusicSourceState] = useState(() => loadSetting("musicSource", "chiptune"));
  const [mp3Tracks, setMp3Tracks] = useState([]);
  const [mp3Loading, setMp3Loading] = useState(false);
  const [mp3Idx, setMp3Idx] = useState(() => loadSetting("mp3Idx", 0));
  const [mp3Playing, setMp3Playing] = useState(false);
  const [mp3Duration, setMp3Duration] = useState(0);
  const [mp3CurrentTime, setMp3CurrentTime] = useState(0);
  const [mp3Buffering, setMp3Buffering] = useState(false);
  const [mp3Shuffle, setMp3Shuffle] = useState(() => loadSetting("mp3Shuffle", false));
  const mp3IdxRef = useRef(mp3Idx);
  mp3IdxRef.current = mp3Idx;
  const mp3TracksRef = useRef(mp3Tracks);
  mp3TracksRef.current = mp3Tracks;
  const mp3PlayingRef = useRef(mp3Playing);
  mp3PlayingRef.current = mp3Playing;
  const mp3ShuffleRef = useRef(mp3Shuffle);
  mp3ShuffleRef.current = mp3Shuffle;
  /* First-time visitors get the theme track playing softly the moment
     they first interact with the page (browsers block audio-with-sound
     autoplay before any user gesture, so we can't start it on load --
     the very first click/tap/keydown anywhere satisfies that gesture
     requirement while still feeling immediate). Only fires once, ever,
     and only if they haven't already picked a source themselves. */
  const themeAutoplayArmedRef = useRef(!loadSetting("visitedBefore", false) && loadSetting("musicSource", "chiptune") === "chiptune");

  const [musicOn, setMusicOn] = useState(false);
  const [trackName, setTrackName] = useState(audioRef.current.trackName());

  const loadMp3Playlist = (id) => {
    const playlist = MP3_PLAYLISTS.find(p => p.id === id);
    if (!playlist) return;
    setMp3Loading(true);
    setMp3Tracks([]);
    getSupabase().then(sb => loadPlaylistTracks(sb, playlist)).then(tracks => {
      setMp3Tracks(tracks);
      setMp3Loading(false);
    });
  };
  /* Only fetches the saved playlist's track list once the Juice Box is
     actually opened, not on every app mount -- otherwise, whenever
     someone's last-used source was an mp3 playlist, the app would import
     supabase-js and hit Storage before they'd even looked at the music
     player, slowing down the rest of the site (worst on mobile). Picking
     a playlist from the dropdown already loads it directly in
     setMusicSource below, so this only covers "reopened with a playlist
     already selected from last time". */
  useEffect(() => {
    if (!musicOpen || musicSource === "chiptune") return;
    if (mp3TracksRef.current.length || mp3Loading) return;
    loadMp3Playlist(musicSource);
    /* Only opening the player should load a playlist, not a change to the source. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [musicOpen]);
  /* The theme is a single track meant to play indefinitely rather than
     stop dead after ~30s -- native loop restarts it itself and never
     fires "ended" at all, so the multi-track auto-advance below doesn't
     need a special case for playlists of length 1. */
  useEffect(() => { mp3Audio.loop = musicSource === THEME_ID; }, [musicSource, mp3Audio]);
  /* Keeps the <audio> element's src in sync with the selected track,
     re-playing automatically if music was already playing -- covers both
     manual next/prev and the "ended" auto-advance below. */
  useEffect(() => {
    if (musicSource === "chiptune" || !mp3Tracks.length) return;
    const track = mp3Tracks[((mp3Idx % mp3Tracks.length) + mp3Tracks.length) % mp3Tracks.length];
    if (mp3Audio.src !== track.url) {
      mp3Audio.src = track.url;
      setMp3Duration(0);
      setMp3CurrentTime(0);
      if (mp3PlayingRef.current) { resumeMp3Gain(); mp3Audio.play().catch(() => {}); }
    }
    /* Only a new track should reload the audio, and mp3Audio never changes. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [musicSource, mp3Tracks, mp3Idx]);
  useEffect(() => {
    const onEnded = () => {
      setMp3Idx(i => {
        const tracks = mp3TracksRef.current;
        if (!tracks.length) return i;
        const next = pickTrackIndex(i, tracks.length, 1, mp3ShuffleRef.current);
        saveSetting("mp3Idx", next);
        return next;
      });
    };
    const onMeta = () => setMp3Duration(mp3Audio.duration || 0);
    /* timeupdate fires ~4x/second the whole time music plays (and the
       theme autoplays), re-rendering the entire app each tick -- but the
       progress bar it drives is only visible inside the Juice Box modal,
       so skip the state write entirely while that's closed. */
    const onTime = () => { if (musicOpenRef.current) setMp3CurrentTime(mp3Audio.currentTime); };
    const onWaiting = () => setMp3Buffering(true);
    const onReady = () => setMp3Buffering(false);
    mp3Audio.addEventListener("ended", onEnded);
    mp3Audio.addEventListener("loadedmetadata", onMeta);
    mp3Audio.addEventListener("timeupdate", onTime);
    mp3Audio.addEventListener("waiting", onWaiting);
    mp3Audio.addEventListener("playing", onReady);
    mp3Audio.addEventListener("canplay", onReady);
    return () => {
      mp3Audio.removeEventListener("ended", onEnded);
      mp3Audio.removeEventListener("loadedmetadata", onMeta);
      mp3Audio.removeEventListener("timeupdate", onTime);
      mp3Audio.removeEventListener("waiting", onWaiting);
      mp3Audio.removeEventListener("playing", onReady);
      mp3Audio.removeEventListener("canplay", onReady);
    };
  }, [mp3Audio]);
  /* Cues the theme track (metadata + src only, not full playback) as soon
     as a genuine first-time visitor loads the page, so it's ready to go
     the instant they satisfy the browser's user-gesture requirement for
     audio-with-sound autoplay below -- without this, the first click would
     have to wait on a fresh Storage round trip before anything could play. */
  useEffect(() => {
    if (!themeAutoplayArmedRef.current) return;
    setMusicSourceState(THEME_ID);
    saveSetting("musicSource", THEME_ID);
    loadMp3Playlist(THEME_ID);
  }, []);
  useEffect(() => {
    if (!themeAutoplayArmedRef.current) return;
    const start = () => {
      if (!themeAutoplayArmedRef.current) return;
      themeAutoplayArmedRef.current = false;
      onVolume(35);
      setMp3Playing(true);
      resumeMp3Gain();
      if (mp3Audio.src) mp3Audio.play().catch(() => {});
    };
    document.addEventListener("pointerdown", start, { once: true });
    document.addEventListener("keydown", start, { once: true });
    return () => {
      document.removeEventListener("pointerdown", start);
      document.removeEventListener("keydown", start);
    };
    /* Runs only when the volume or player changes. The helpers it calls are rebuilt every render. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* Backgrounding the tab (swiped away, phone locked, switched apps) is
     supposed to keep music playing -- that's the whole point of it being
     music -- but browsers auto-suspend AudioContexts and throttle
     setInterval timers while hidden, which is what "music breaking after
     leaving the app" actually was: the chiptune engine's scheduler falls
     behind and either stays silent or bursts through its missed steps at
     once (see chiptune.js's resumeIfNeeded), and the mp3 engine's own
     GainNode context can end up suspended too. Nothing here pauses
     anything ON hide -- that's the point, it should keep going in the
     background -- this only repairs state once the tab is visible again. */
  useEffect(() => {
    const onVisible = () => {
      if (document.hidden) return;
      if (musicOn) audio.resumeIfNeeded();
      if (mp3PlayingRef.current) {
        resumeMp3Gain();
        if (mp3Audio.paused) mp3Audio.play().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [musicOn]);
  const setMusicSource = (id) => {
    themeAutoplayArmedRef.current = false;
    if (id === musicSource) return;
    if (musicOn) { audio.toggle(); setMusicOn(false); }
    if (mp3PlayingRef.current) { mp3Audio.pause(); setMp3Playing(false); }
    setMusicSourceState(id);
    saveSetting("musicSource", id);
    if (id !== "chiptune") {
      setMp3Idx(0);
      saveSetting("mp3Idx", 0);
      loadMp3Playlist(id);
    }
  };
  /* Blind Mode reads moves aloud over speechSynthesis -- background music
     talking over it at the same time would make both unintelligible, so
     the two are mutually exclusive the same way switching musicSource
     already pauses whichever engine was playing. Unlike that case,
     leaving Blind Mode should hand playback back rather than just
     staying off, so this remembers which engine (if either) it paused
     and resumes only that one. Background music itself is untouched by
     any of this -- see the visibilitychange effect above -- this is
     purely about not overlapping with Blind Mode's own audio. */
  const blindPausedMusicRef = useRef(null);
  useEffect(() => {
    if (blindOpen) {
      if (musicSource === "chiptune" && musicOn) {
        audio.toggle();
        setMusicOn(false);
        blindPausedMusicRef.current = "chiptune";
      } else if (musicSource !== "chiptune" && mp3PlayingRef.current) {
        mp3Audio.pause();
        setMp3Playing(false);
        blindPausedMusicRef.current = "mp3";
      } else {
        blindPausedMusicRef.current = null;
      }
    } else if (blindPausedMusicRef.current) {
      if (blindPausedMusicRef.current === "chiptune") {
        setMusicOn(audio.toggle());
      } else {
        resumeMp3Gain();
        mp3Audio.play().catch(() => {});
        setMp3Playing(true);
      }
      blindPausedMusicRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blindOpen]);
  const switchMp3Track = (delta) => {
    const tracks = mp3TracksRef.current;
    if (!tracks.length) return;
    setMp3Idx(i => {
      const next = pickTrackIndex(i, tracks.length, delta, mp3ShuffleRef.current);
      saveSetting("mp3Idx", next);
      return next;
    });
  };
  const toggleShuffle = () => {
    setMp3Shuffle(v => {
      const next = !v;
      saveSetting("mp3Shuffle", next);
      return next;
    });
  };
  const [sfxOn, setSfxOn] = useState(() => loadSetting("sfxOn", true));
  const toggleSfx = () => {
    const on = !sfxOn;
    setSfxOn(on);
    audio.setSfxOn(on);
    saveSetting("sfxOn", on);
    if (on) audio.sfxMove();
  };
  const pickMp3Track = (idx) => {
    setMp3Idx(idx);
    saveSetting("mp3Idx", idx);
  };
  const toggleMusic = () => {
    if (musicSource === "chiptune") { setMusicOn(audio.toggle()); return; }
    if (!mp3TracksRef.current.length) return;
    if (mp3PlayingRef.current) { mp3Audio.pause(); setMp3Playing(false); }
    else { resumeMp3Gain(); mp3Audio.play().catch(() => {}); setMp3Playing(true); }
  };
  const nextTrack = () => {
    if (musicSource === "chiptune") { setTrackName(audio.next()); saveSetting("trackIdx", audio.trackIndex()); return; }
    switchMp3Track(1);
  };
  const prevTrack = () => {
    if (musicSource === "chiptune") { setTrackName(audio.prev()); saveSetting("trackIdx", audio.trackIndex()); return; }
    switchMp3Track(-1);
  };
  /* Once the Web Audio graph exists, control loudness exclusively through
     its GainNode -- that's what actually works on iOS Safari, which
     otherwise hard-ignores HTMLMediaElement.volume entirely. Falls back to
     the plain .volume property only before the graph exists (nothing is
     playing yet, so it's just keeping state consistent for whenever
     playback actually starts). */
  const onVolume = v => {
    setVolume(v);
    audio.setVolume(v / 100);
    if (mp3GainRef.current) mp3GainRef.current.gainNode.gain.value = v / 100;
    else mp3Audio.volume = v / 100;
    saveSetting("volume", v);
  };
  const seekMp3 = (t) => { mp3Audio.currentTime = t; setMp3CurrentTime(t); };
  const fmtTime = (s) => {
    if (!isFinite(s) || s < 0) s = 0;
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  };
  const isMp3Source = musicSource !== "chiptune";
  const mp3NowPlaying = isMp3Source && mp3Tracks.length ? mp3Tracks[((mp3Idx % mp3Tracks.length) + mp3Tracks.length) % mp3Tracks.length] : null;
  const jbTrackLabel = !isMp3Source ? trackName : mp3Loading ? "Loading…" : mp3NowPlaying ? mp3NowPlaying.name : "No tracks yet";
  const jbPlaying = isMp3Source ? mp3Playing : musicOn;
  const jbDisabled = isMp3Source && !mp3Tracks.length;

  return { volume, audio, musicSource, mp3Tracks, mp3Idx, mp3Duration, mp3CurrentTime, mp3Buffering, mp3Shuffle, trackName, setMusicSource, toggleShuffle, sfxOn, toggleSfx, pickMp3Track, toggleMusic, nextTrack, prevTrack, onVolume, seekMp3, fmtTime, isMp3Source, jbTrackLabel, jbPlaying, jbDisabled };
}
