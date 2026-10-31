import { useEffect, useRef, useState } from "react";
import { fetchLatestShort } from "../utils/latestShort";

/* The TV on Home plays your newest Short while it's near the middle of the
   screen, and pauses when the player scrolls it away. It starts muted, which
   browsers require for autoplay; the player can tap the video to turn sound on.

   "Near the middle" means the TV crosses a band across the middle of the
   viewport, and it has to stay there for DWELL_MS, so a quick scroll past
   doesn't start anything. */
const DWELL_MS = 2000;

/* The TV is drawn straight on, in a 200 by 180 grid, so the screen is a true
   rectangle and the video can fill it exactly. */
const VIEW = { w: 200, h: 180 };
const SCREEN = { x: 30, y: 64, w: 114, h: 82 };
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
   part that overflows is cropped, which is why nothing shows around the
   edges. The frame is anchored to the bottom so the player's controls stay
   visible. */
const FRAME_STYLE = {
  position: "absolute",
  left: "50%",
  bottom: 0,
  transform: "translateX(-50%)",
  width: "max(100cqw, calc(100cqh * 9 / 16))",
  height: "max(100cqh, calc(100cqw * 16 / 9))",
  border: 0,
};

function TvBody() {
  return (
    <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} className="block h-auto w-full select-none" aria-hidden="true" shapeRendering="crispEdges">
      <path d="M70 42 L52 12 M130 42 L148 12" stroke={SHADE} strokeWidth="4" strokeLinecap="round" fill="none" />
      <circle cx="52" cy="10" r="5" fill={SHADE} />
      <circle cx="148" cy="10" r="5" fill={SHADE} />
      <rect x="6" y="38" width="188" height="136" rx="12" fill={SHADE} />
      <rect x="10" y="42" width="180" height="128" rx="10" fill={BODY} />
      <rect x="12" y="44" width="176" height="6" rx="3" fill={LIGHT} />
      <rect x={SCREEN.x - 8} y={SCREEN.y - 8} width={SCREEN.w + 16} height={SCREEN.h + 16} rx="8" fill={BEZEL} />
      <rect x={SCREEN.x} y={SCREEN.y} width={SCREEN.w} height={SCREEN.h} fill="#000" />
      <circle cx="162" cy="80" r="6" fill={SHADE} />
      <circle cx="162" cy="102" r="6" fill={SHADE} />
      <rect x="150" y="124" width="26" height="8" rx="3" fill={SHADE} />
    </svg>
  );
}

export default function YouTubeTv({ sweetheart }) {
  const [video, setVideo] = useState(null);
  const [checked, setChecked] = useState(false);
  const boxRef = useRef(null);
  const frameRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    let live = true;
    fetchLatestShort().then((v) => { if (live) { setVideo(v); setChecked(true); } });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (!video || !boxRef.current) return;
    const send = (func) => frameRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func, args: "" }), "*");
    const stop = () => { clearTimeout(timerRef.current); timerRef.current = null; send("pauseVideo"); };
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        if (!timerRef.current) timerRef.current = setTimeout(() => send("playVideo"), DWELL_MS);
      } else {
        stop();
      }
    }, { rootMargin: "-40% 0px -40% 0px" });
    observer.observe(boxRef.current);
    const onVisibility = () => { if (document.hidden) stop(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      clearTimeout(timerRef.current);
    };
  }, [video]);

  const T = sweetheart ? { ink: "text-sh-link", dim: "text-sh-link-dim" } : { ink: "text-paper", dim: "text-dim" };
  const src = video && `https://www.youtube-nocookie.com/embed/${video.id}?enablejsapi=1&mute=1&playsinline=1&rel=0&modestbranding=1&origin=${encodeURIComponent(window.location.origin)}`;

  return (
    <div className="flex flex-col items-center gap-2">
      <div ref={boxRef} className="relative w-[210px]">
        <TvBody />
        <div className="absolute overflow-hidden bg-black" style={{ ...SCREEN_PCT, containerType: "size" }}>
          {src ? (
            <iframe
              ref={frameRef}
              src={src}
              title={video.title || "Latest YouTube Short"}
              allow="autoplay; encrypted-media; picture-in-picture"
              style={FRAME_STYLE}
            />
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
