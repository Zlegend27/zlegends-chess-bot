/* Reusable "the bot talks" speech bubble -- typewriter reveal + chatter
   blips (the exact voice mechanic already shipped for Lessons, see
   utils/lessonVoice.js), reused for the HomePage welcome beat and Play's
   post-game one-liners (see utils/botLines.js for the actual lines).
   Flavor only -- never blocks anything, always dismissible, and a new
   `line` value just replaces whatever was showing instead of queuing. */

import { useEffect, useState } from "react";
import PixelAvatar, { ZPAL, ZPIX } from "./PixelAvatar";
import { charBlip } from "../utils/lessonVoice";

const TYPE_MS = 18;

export default function BotBubble({ line, muted = false, onDismiss, avatarSize = 40, className = "" }) {
  const [typedLen, setTypedLen] = useState(0);

  useEffect(() => {
    setTypedLen(0);
    if (!line) return;
    const t = setInterval(() => {
      setTypedLen(len => {
        if (len >= line.length) { clearInterval(t); return len; }
        if (!muted && len % 2 === 0) charBlip(line[len]);
        return len + 1;
      });
    }, TYPE_MS);
    return () => clearInterval(t);
  }, [line, muted]);

  if (!line) return null;
  const typedDone = typedLen >= line.length;

  return (
    <div className={"botBubbleRow " + className}>
      <PixelAvatar rows={ZPIX} pal={ZPAL} size={avatarSize} />
      <div className="botBubble" onClick={() => setTypedLen(line.length)}>
        <span>{line.slice(0, typedLen)}</span>
        {!typedDone && <span className="botBubbleCaret">▌</span>}
        {onDismiss && (
          <button className="botBubbleClose" onClick={(e) => { e.stopPropagation(); onDismiss(); }} aria-label="Dismiss">✕</button>
        )}
      </div>
    </div>
  );
}
