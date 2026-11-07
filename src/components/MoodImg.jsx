import { useEffect, useState } from "react";
import PixelAvatar, { ZPAL, ZPIX } from "./PixelAvatar";

/* A plain <img src="/bot-happy.webp"> never retries once it fails --
   browsers just leave the broken-image icon (or nothing but the alt
   text) sitting there forever, even though the very next request for
   the same URL might succeed (a dropped connection during dev-server
   HMR, a flaky mobile network, whatever). Retries twice with a cache-
   busting query param before giving up and falling back to the inline
   PixelAvatar, which can't ever fail to load since it's not a network
   request. Its own module, so it isn't
   redefined (and remounted) on every render. */
export default function MoodImg({ src, alt }) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  useEffect(() => { setAttempt(0); setFailed(false); }, [src]);
  if (failed) return <PixelAvatar rows={ZPIX} pal={ZPAL} size={44} />;
  const onError = () => {
    if (attempt < 2) setAttempt(a => a + 1);
    else setFailed(true);
  };
  return (
    <img
      src={attempt === 0 ? src : `${src}?retry=${attempt}`}
      alt={alt}
      className="reactionImg"
      onError={onError}
    />
  );
}
