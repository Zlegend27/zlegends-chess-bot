import { spriteFor, normalizeAvatar, BACKDROPS, HEAD_ROWS } from "../utils/avatar";

/** The face of a built character on its backdrop colour, as a round
 *  picture: the head and shoulders, cropped from the full sprite. */
export function FaceAvatar({ avatar, size = 36, className = "" }) {
  const a = normalizeAvatar(avatar);
  const { rows, pal } = spriteFor(a);
  const rects = [];
  /* Head rows plus the shoulders under them. */
  rows.slice(0, HEAD_ROWS + 3).forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] !== ".") rects.push(<rect key={`${x}-${y}`} x={x} y={y} width="1.02" height="1.02" fill={pal[row[x]]} />);
    }
  });
  return (
    <svg
      viewBox="1 -1.5 14 14" width={size} height={size} aria-hidden="true"
      className={"flex-none rounded-full " + className}
      style={{ background: BACKDROPS[a.bg], shapeRendering: "crispEdges" }}
    >
      {rects}
    </svg>
  );
}

/* The signed-in player's profile picture, the same everywhere (header,
   menu, profile): their account's photo if that's what they chose, else
   the face of the character they built. Without an avatar to draw (a
   signed-out caller) it falls back to an initial. */
export default function AccountAvatar({ profile, avatar, size = 36, className = "" }) {
  const box = { width: size, height: size };
  if (profile?.avatarUrl && (!avatar || avatar.kind === "discord")) {
    return <img src={profile.avatarUrl} alt="" style={box} className={"flex-none rounded-full object-cover " + className} />;
  }
  if (avatar) return <FaceAvatar avatar={avatar} size={size} className={className} />;
  return (
    <span
      aria-hidden="true"
      style={{ ...box, fontSize: size * 0.45, fontFamily: "var(--font-display)", background: "var(--violet)", color: "#fff" }}
      className={"inline-flex flex-none items-center justify-center rounded-full " + className}
    >
      {(profile?.name || "?").trim().charAt(0).toUpperCase()}
    </span>
  );
}
