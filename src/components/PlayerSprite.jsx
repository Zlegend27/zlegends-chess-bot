/* A player as they appear in the lobby and at the table: their pixel
   character, or (if they chose it and have one) their Discord picture as
   the head on a pixel body. See utils/avatar.js. */
import { useId } from "react";
import PixelAvatar from "./PixelAvatar";
import { spriteFor, HEAD_ROWS } from "../utils/avatar";

export default function PlayerSprite({ avatar, discordUrl, size = 48, className = "" }) {
  /* React's ids contain colons, which url(#...) in SVG doesn't accept everywhere. */
  const clipId = `head${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  if (avatar?.kind !== "discord" || !discordUrl) {
    const { rows, pal } = spriteFor(avatar);
    return <PixelAvatar rows={rows} pal={pal} size={size} className={className} />;
  }
  const { rows, pal } = spriteFor(avatar, { bodyOnly: true });
  const rects = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] !== ".") rects.push(<rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={pal[row[x]]} />);
    }
  });
  const r = HEAD_ROWS / 2;
  return (
    <svg viewBox="0 0 16 24" width={size} height={size} className={className}
      style={{ imageRendering: "pixelated", shapeRendering: "crispEdges" }} aria-hidden="true">
      <defs>
        <clipPath id={clipId}><circle cx="8" cy={r} r={r} /></clipPath>
      </defs>
      {rects}
      <image href={discordUrl} x={8 - r} y="0" width={r * 2} height={r * 2} clipPath={`url(#${clipId})`} preserveAspectRatio="xMidYMid slice" style={{ imageRendering: "auto" }} />
      <circle cx="8" cy={r} r={r - 0.25} fill="none" stroke="#150C24" strokeWidth="0.5" />
    </svg>
  );
}
