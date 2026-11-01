import { useEffect, useRef, useState } from "react";
import { fetchLatestShort } from "../utils/latestShort";
import BotBubble from "./BotBubble";

/* The TV on Home plays your newest Short while it sits near the middle of
   the screen, and pauses when it's scrolled away. Browsers only let a video
   start with sound after the player has tapped something, so the first tap
   on the TV turns sound on for the rest of the visit. Until then it plays
   muted, and the hover label says "Tap for sound".

   The YouTube player is heavy, so it's only loaded once the TV is close to
   the screen. The thumbnail covers the screen until the player reports that
   the video is actually playing, so nothing flashes black. */
const DWELL_MS = 2000;
const PRELOAD_MARGIN = "400px 0px";

/* The TV is drawn straight on, in a 200 by 250 grid. The screen is taller
   than it is wide, so more of a vertical Short fits on it. */
const VIEW = { w: 200, h: 250 };
const SCREEN = { x: 40, y: 52, w: 120, h: 170 };
const SCREEN_PCT = {
  left: `${(SCREEN.x / VIEW.w) * 100}%`,
  top: `${(SCREEN.y / VIEW.h) * 100}%`,
  width: `${(SCREEN.w / VIEW.w) * 100}%`,
  height: `${(SCREEN.h / VIEW.h) * 100}%`,
};

const BODY = "#8B2FC9";
const SHADE = "#3B1E7A";
const LIGHT = "#A654E0";
const BEZEL = "#2A1450";

/* The Short is vertical (9:16). The player and the thumbnail both fill a 9:16
   frame sized to cover the screen, so they line up exactly and the swap from
   thumbnail to video doesn't jump. Overflow is cropped. */
const FRAME_STYLE = {
  position: "absolute",
  left: "50%",
  top: "50%",
  transform: "translate(-50%, -50%)",
  width: "max(100cqw, calc(100cqh * 9 / 16))",
  height: "max(100cqh, calc(100cqw * 16 / 9))",
  border: 0,
  pointerEvents: "none",
};

function TvBody() {
  return (
    <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} className="block h-auto w-full select-none" aria-hidden="true" shapeRendering="crispEdges">
      <path d="M75 28 L56 6 M125 28 L144 6" stroke={SHADE} strokeWidth="4" strokeLinecap="round" fill="none" />
      <circle cx="56" cy="5" r="5" fill={SHADE} />
      <circle cx="144" cy="5" r="5" fill={SHADE} />
      <rect x="6" y="26" width="188" height="218" rx="14" fill={SHADE} />
      <rect x="10" y="30" width="180" height="210" rx="12" fill={BODY} />
      <rect x="14" y="34" width="172" height="6" rx="3" fill={LIGHT} />
      <rect x={SCREEN.x - 8} y={SCREEN.y - 8} width={SCREEN.w + 16} height={SCREEN.h + 16} rx="10" fill={BEZEL} />
      <rect x={SCREEN.x} y={SCREEN.y} width={SCREEN.w} height={SCREEN.h} fill="#000" />
      <circle cx="180" cy="80" r="5" fill={SHADE} />
      <circle cx="180" cy="100" r="5" fill={SHADE} />
      <rect x="80" y="232" width="40" height="4" rx="2" fill={SHADE} />
    </svg>
  );
}

export default function YouTubeTv({ sweetheart }) {
  const [video, setVideo] = useState(null);
  const [checked, setChecked] = useState(false);
  const [near, setNear] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const boxRef = useRef(null);
  const frameRef = useRef(null);
  const timerRef = useRef(null);
  const soundRef = useRef(false);
  const playingRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const wantRef = useRef("pause");
  const applyRef = useRef(null);

  useEffect(() => {
    let live = true;
    fetchLatestShort().then((v) => { if (live) { setVideo(v); setChecked(true); } });
    return () => { live = false; };
  }, []);

  /* Load the player only once the TV is about to come on screen. */
  useEffect(() => {
    if (!video || !boxRef.current) return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setNear(true); io.disconnect(); }
    }, { rootMargin: PRELOAD_MARGIN });
    io.observe(boxRef.current);
    return () => io.disconnect();
  }, [video]);

  useEffect(() => {
    if (!video || !boxRef.current) return;
    const send = (func) => frameRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func, args: "" }), "*");
    /* Sends whatever the TV currently wants. Before the player has loaded,
       the frame's onLoad calls this again. */
    const apply = () => {
      if (!frameRef.current) return;
      if (wantRef.current === "play") {
        if (soundRef.current) send("unMute");
        send("playVideo");
      } else {
        send("pauseVideo");
      }
    };
    applyRef.current = apply;
    const playNow = () => {
      if (soundRef.current || navigator.userActivation?.hasBeenActive) {
        soundRef.current = true;
        setSoundOn(true);
      }
      wantRef.current = "play";
      apply();
    };
    const stop = () => {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      wantRef.current = "pause";
      apply();
    };
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        if (!timerRef.current) timerRef.current = setTimeout(playNow, DWELL_MS);
      } else {
        stop();
      }
    }, { rootMargin: "-40% 0px -40% 0px" });
    observer.observe(boxRef.current);
    const onVisibility = () => { if (document.hidden) stop(); };
    document.addEventListener("visibilitychange", onVisibility);
    /* YouTube reports its state once it's been asked to listen. The thumbnail
       only comes off when it reports that the video is actually playing. */
    const onMessage = (e) => {
      if (e.source !== frameRef.current?.contentWindow || typeof e.data !== "string") return;
      try {
        const data = JSON.parse(e.data);
        if (data.event === "infoDelivery" && typeof data.info?.playerState === "number") {
          const on = data.info.playerState === 1;
          playingRef.current = on;
          setIsPlaying(on);
          if (on) setPlaying(true);
        }
      } catch { /* not a player message */ }
    };
    window.addEventListener("message", onMessage);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("message", onMessage);
      clearTimeout(timerRef.current);
      applyRef.current = null;
    };
  }, [video]);

  /* A tap plays with sound, or pauses if it's already playing. A tap is the
     one gesture every browser accepts for sound. */
  const tap = () => {
    clearTimeout(timerRef.current);
    timerRef.current = null;
    if (playingRef.current) {
      wantRef.current = "pause";
      applyRef.current?.();
      return;
    }
    soundRef.current = true;
    setSoundOn(true);
    wantRef.current = "play";
    applyRef.current?.();
  };

  const onFrameLoad = () => {
    frameRef.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: 1, channel: "widget" }), "*");
    /* The player needs a moment after its frame loads before it takes commands. */
    setTimeout(() => applyRef.current?.(), 600);
  };

  const T = sweetheart ? { ink: "text-sh-link", dim: "text-sh-link-dim" } : { ink: "text-paper", dim: "text-dim" };
  const src = video && `https://www.youtube-nocookie.com/embed/${video.id}?enablejsapi=1&mute=1&playsinline=1&controls=0&rel=0&modestbranding=1&origin=${encodeURIComponent(window.location.origin)}`;

  return (
    <div className="flex flex-col items-center gap-2">
      <div ref={boxRef} className="group relative w-[240px] sm:w-[280px] max-w-[88vw] transition hover:-translate-y-0.5">
        <TvBody />
        <div className="absolute overflow-hidden bg-black" style={{ ...SCREEN_PCT, containerType: "size" }}>
          {video ? (
            <>
              {near && (
                <iframe
                  ref={frameRef}
                  src={src}
                  title={video.title || "Latest YouTube Short"}
                  allow="autoplay; encrypted-media; picture-in-picture"
                  onLoad={onFrameLoad}
                  style={FRAME_STYLE}
                />
              )}
              <img
                src={`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`}
                alt=""
                aria-hidden="true"
                decoding="async"
                style={FRAME_STYLE}
                className={`object-cover transition-opacity duration-300 ${playing ? "opacity-0" : "opacity-100"}`}
              />
              <button
                type="button"
                aria-label={isPlaying ? "Pause your latest Short" : "Play your latest Short with sound"}
                onClick={tap}
                className="absolute inset-0 cursor-pointer border-0 bg-transparent focus-visible:outline-none"
              >
                <span aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center text-2xl text-white opacity-0 transition-opacity drop-shadow group-hover:opacity-100">
                  {isPlaying ? "❚❚" : "▶"}
                </span>
                {!soundOn && (
                  <span className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/70 px-3 py-1 text-[11px] font-bold text-white opacity-0 transition-opacity group-hover:opacity-100">
                    Tap for sound
                  </span>
                )}
              </button>
            </>
          ) : (
            <div className={"flex size-full items-center justify-center p-2 text-center text-[11px] " + T.dim}>
              {checked ? "Latest Short unavailable right now" : "Loading…"}
            </div>
          )}
        </div>
      </div>
      {video && (
        <div className="flex max-w-[300px] flex-col items-center gap-1">
          <a href={`https://www.youtube.com/shorts/${video.id}`} target="_blank" rel="noopener noreferrer" aria-label="Watch this Short on YouTube" className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-[13px] font-extrabold tracking-wide no-underline" style={{ background: "#FF0000", color: "#FFFFFF" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
            Z27Tube
          </a>
          <BotBubble line={video.title} muted avatarSize={40} />
        </div>
      )}
    </div>
  );
}
