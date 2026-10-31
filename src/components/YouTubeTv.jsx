import { useEffect, useRef, useState } from "react";
import { fetchLatestShort } from "../utils/latestShort";

/* The TV on Home plays your newest Short while it sits near the middle of
   the screen, and pauses when it's scrolled away. Browsers only let a video
   start with sound after the player has tapped something, so the first tap
   on the TV turns sound on for the rest of the visit. Until then it plays
   muted, and the hover label says "Tap for sound". */
const DWELL_MS = 2000;

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

/* The Short is vertical (9:16). The player letterboxes whatever shape its
   frame is, so the frame itself is 9:16 and sized to cover the screen. Any
   part that overflows is cropped. The player's own controls and title bar
   are switched off, and the screen is covered until it starts, so none of
   YouTube's buttons or share links can show. */
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
  const [started, setStarted] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const boxRef = useRef(null);
  const frameRef = useRef(null);
  const timerRef = useRef(null);
  const soundRef = useRef(false);

  useEffect(() => {
    let live = true;
    fetchLatestShort().then((v) => { if (live) { setVideo(v); setChecked(true); } });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (!video || !boxRef.current) return;
    const send = (func) => frameRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func, args: "" }), "*");
    /* Sound is allowed once the player has tapped the TV, or once the browser
       says the page has been used. Otherwise it plays muted. */
    const playNow = () => {
      if (soundRef.current || navigator.userActivation?.hasBeenActive) {
        soundRef.current = true;
        setSoundOn(true);
        send("unMute");
      }
      setStarted(true);
      send("playVideo");
    };
    const stop = () => { clearTimeout(timerRef.current); timerRef.current = null; send("pauseVideo"); };
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
    /* A tap is the one gesture every browser accepts for sound. */
    const tap = () => { soundRef.current = true; setSoundOn(true); clearTimeout(timerRef.current); timerRef.current = null; setStarted(true); send("unMute"); send("playVideo"); };
    tapRef.current = tap;
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      clearTimeout(timerRef.current);
      tapRef.current = null;
    };
  }, [video]);

  const tapRef = useRef(null);
  const T = sweetheart ? { ink: "text-sh-link", dim: "text-sh-link-dim" } : { ink: "text-paper", dim: "text-dim" };
  const src = video && `https://www.youtube-nocookie.com/embed/${video.id}?enablejsapi=1&mute=1&playsinline=1&controls=0&rel=0&modestbranding=1&origin=${encodeURIComponent(window.location.origin)}`;

  return (
    <div className="flex flex-col items-center gap-2">
      <div ref={boxRef} className="group relative w-[280px] max-w-[88vw] transition hover:-translate-y-0.5">
        <TvBody />
        <div className="absolute overflow-hidden bg-black" style={{ ...SCREEN_PCT, containerType: "size" }}>
          {src ? (
            <>
              <iframe
                ref={frameRef}
                src={src}
                title={video.title || "Latest YouTube Short"}
                allow="autoplay; encrypted-media; picture-in-picture"
                style={FRAME_STYLE}
              />
              <img
                src={`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`}
                alt=""
                aria-hidden="true"
                className={`pointer-events-none absolute inset-0 size-full object-cover transition-opacity duration-500 ${started ? "opacity-0" : "opacity-100"}`}
              />
              <button
                type="button"
                aria-label={soundOn ? "Playing your latest Short" : "Play your latest Short with sound"}
                onClick={() => tapRef.current?.()}
                className="absolute inset-0 cursor-pointer border-0 bg-transparent focus-visible:outline-none"
              >
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
        <p className={"m-0 max-w-[260px] text-center text-xs " + T.ink}>
          Latest Short: <span className="font-bold">{video.title}</span>
        </p>
      )}
    </div>
  );
}
