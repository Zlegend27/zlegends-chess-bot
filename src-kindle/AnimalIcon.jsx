/* Kinnda's animals: storybook-style portraits, drawn in SVG so they stay
   crisp at every size (36px in a list, 90px on a finish screen).

   Each animal has its real features at child-friendly proportions (big
   head, big glossy eyes): the panda's eye patches, the raccoon's mask, the
   koala's fluffy ears and big nose, the fox's white cheeks and dark ear
   tips, the lion's mane, the owl's face disc. Soft shading comes from a
   radial gradient on the head, so the faces read as round, not flat.

   They feel alive: they blink now and then (each animal on its own rhythm),
   and `mood` changes the whole face:
   - undefined: calm, smiling
   - "happy": eyes squeezed shut in a grin, mouth open
   - "sad": droopy brows, a small frown and a tear
   - "think": eyes looking up to one side, a small "o" mouth
   - "surprised": wide eyes and an open "O" mouth
   `hat` puts one of the shop's hats on top. */
import { useId } from "react";

/* Colours per animal: light/body/shade build the head's shading. */
export const PALETTE = {
  Bunny: { light: "#FFFFFF", body: "#FDF1F5", shade: "#E9C9D8", ear: "#FFB8D2", nose: "#FF7FAA", line: "#B98299" },
  Cat: { light: "#FFD49A", body: "#FFB866", shade: "#E0863A", stripe: "#D06A22", muzzle: "#FFF4E6", ear: "#FFC3CB", nose: "#FF8FA3", iris: "#7CC04B", line: "#A85A1E" },
  Dog: { light: "#F2CB98", body: "#E2AE76", shade: "#BF8650", ear: "#8E5A2C", muzzle: "#FFF2DF", nose: "#3A2A22", line: "#7A4F28" },
  Panda: { light: "#FFFFFF", body: "#FAFAFB", shade: "#DCE0E6", patch: "#2F2F36", nose: "#2F2F36", line: "#6B6F7A" },
  Koala: { light: "#D4D8DF", body: "#B9BEC8", shade: "#8F95A1", fluff: "#F4F4F7", nose: "#4A4552", line: "#5F6470" },
  Raccoon: { light: "#CFC8BF", body: "#B3AA9F", shade: "#8A8076", mask: "#3A332C", muzzle: "#F7F3EE", nose: "#2E2722", line: "#5E554B" },
  Otter: { light: "#C29270", body: "#A8784F", shade: "#7F5536", muzzle: "#EED6BC", nose: "#3A2418", line: "#5E3C25" },
  Fox: { light: "#FFAA66", body: "#FF8A3D", shade: "#D9631E", cheek: "#FFF7EE", tip: "#3B2620", ear: "#FFD9C2", nose: "#3B2620", line: "#A84A12" },
  Owl: { light: "#D2A56A", body: "#B98A4E", shade: "#8C6233", disc: "#F4E2BC", ring: "#E9A83A", iris: "#F7B733", beak: "#F29F45", line: "#6E4A22" },
  Lion: { light: "#FFDB8C", body: "#F7C568", shade: "#DB9C3E", mane: "#D9782A", maneDark: "#B85A1B", muzzle: "#FFF1D6", nose: "#8A4B2A", line: "#9A5A22" },
};

export function HatOverlay({ hat }) {
  if (!hat || hat === "none") return null;
  if (hat === "party") return (
    <g>
      <path d="M17 14 L24 -2 L31 14 Z" fill="#FF6FA5" stroke="#C2477A" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="24" cy="-3" r="2.6" fill="#FFD166" />
      <circle cx="21" cy="10" r="1.6" fill="#FFD166" />
      <circle cx="27" cy="7" r="1.6" fill="#4EA8DE" />
    </g>
  );
  if (hat === "crown") return (
    <g>
      <path d="M12 14 L14 3 L20 10 L24 1 L28 10 L34 3 L36 14 Z" fill="#FFD166" stroke="#E8A93B" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="24" cy="2" r="1.8" fill="#FF6FA5" />
    </g>
  );
  if (hat === "wizard") return (
    <g>
      <path d="M15 15 L24 -8 L33 15 Z" fill="#7C5CBF" stroke="#4E3A8A" strokeWidth="1.5" strokeLinejoin="round" />
      <ellipse cx="24" cy="15" rx="12" ry="3" fill="#7C5CBF" stroke="#4E3A8A" strokeWidth="1.5" />
      <path d="M24 3 L25.5 6.5 L29 7 L26.2 9.3 L27 13 L24 11 L21 13 L21.8 9.3 L19 7 L22.5 6.5 Z" fill="#FFD166" />
    </g>
  );
  if (hat === "ninja") return (
    <g>
      <rect x="10" y="8" width="28" height="6" rx="2" fill="#3A3A3A" stroke="#1E1E1E" strokeWidth="1.5" />
      <path d="M34 11 L44 6 L44 16 Z" fill="#3A3A3A" stroke="#1E1E1E" strokeWidth="1.5" strokeLinejoin="round" />
    </g>
  );
  if (hat === "flower") return (
    <g>
      {[0, 60, 120, 180, 240, 300].map(angle => (
        <ellipse key={angle} cx={24 + 9 * Math.cos((angle * Math.PI) / 180)} cy={9 + 9 * Math.sin((angle * Math.PI) / 180)}
          rx="4.5" ry="3" fill="#FF9EC4" stroke="#E8679E" strokeWidth="1" transform={`rotate(${angle} ${24 + 9 * Math.cos((angle * Math.PI) / 180)} ${9 + 9 * Math.sin((angle * Math.PI) / 180)})`} />
      ))}
      <circle cx="24" cy="9" r="4" fill="#FFD166" stroke="#E8A93B" strokeWidth="1" />
    </g>
  );
  return null;
}

/* ---------------- Faces ---------------- */

const INK = "#2B1D14";

/** Glossy eyes at (x, y) and its mirror, for the mood. `iris` gives them a
 *  coloured ring (the cat's green eyes). */
function Eyes({ y = 27, dx = 6, mood, iris, size = 1, onDark }) {
  const xs = [24 - dx, 24 + dx];
  if (mood === "happy") {
    return xs.map((x) => (
      <path key={x} d={`M${x - 2.8 * size} ${y + 0.6} Q${x} ${y - 2.8 * size} ${x + 2.8 * size} ${y + 0.6}`} stroke={onDark ? "#fff" : INK} strokeWidth="1.7" fill="none" strokeLinecap="round" />
    ));
  }
  const look = mood === "think" ? { x: -1, y: -1.2 } : { x: 0, y: 0 };
  const big = mood === "surprised" ? 1.2 : 1;
  return (
    <g className="kBlink">
      {xs.map((x) => (
        <g key={x}>
          {iris ? (
            <>
              <ellipse cx={x} cy={y} rx={3.1 * size * big} ry={3.4 * size * big} fill={iris} />
              <ellipse cx={x + look.x} cy={y + look.y} rx={1.2 * size} ry={2.6 * size} fill={INK} />
            </>
          ) : (
            <ellipse cx={x + look.x * 0.4} cy={y + look.y * 0.4} rx={2.7 * size * big} ry={3.1 * size * big} fill={INK} />
          )}
          <circle cx={x + look.x * 0.6 - 0.9} cy={y + look.y * 0.6 - 1.2} r={1.05 * size} fill="#fff" />
          <circle cx={x + look.x * 0.6 + 0.9} cy={y + look.y * 0.6 + 0.9} r={0.5 * size} fill="#fff" opacity="0.85" />
        </g>
      ))}
      {mood === "sad" && xs.map((x, i) => (
        <path key={`b${x}`} d={i === 0 ? `M${x - 3} ${y - 4} L${x + 2} ${y - 5.6}` : `M${x - 2} ${y - 5.6} L${x + 3} ${y - 4}`} stroke={INK} strokeWidth="1.2" strokeLinecap="round" />
      ))}
    </g>
  );
}

/** Mouth (and a tear when sad) under a nose at `y`. */
function Mouth({ y = 34, mood, tongue = "#FF7F9C" }) {
  if (mood === "happy") {
    return (
      <g>
        <path d={`M20.5 ${y} Q24 ${y + 6} 27.5 ${y} Z`} fill="#7A2E3A" stroke={INK} strokeWidth="1.1" strokeLinejoin="round" />
        <path d={`M22 ${y + 2.6} Q24 ${y + 1.4} 26 ${y + 2.6} Q24 ${y + 4.6} 22 ${y + 2.6} Z`} fill={tongue} />
      </g>
    );
  }
  if (mood === "sad") {
    return (
      <g>
        <path d={`M21.5 ${y + 2.4} Q24 ${y} 26.5 ${y + 2.4}`} stroke={INK} strokeWidth="1.3" fill="none" strokeLinecap="round" />
        <path d="M33.4 29.5 Q32 32.2 33.4 33.2 Q34.8 32.2 33.4 29.5 Z" fill="#7CC8F2" stroke="#4E9BD0" strokeWidth="0.5" />
      </g>
    );
  }
  if (mood === "think") return <ellipse cx="25.2" cy={y + 1} rx="1.3" ry="1.2" fill="#7A2E3A" stroke={INK} strokeWidth="0.8" />;
  if (mood === "surprised") return <ellipse cx="24" cy={y + 1.4} rx="2.1" ry="2.6" fill="#7A2E3A" stroke={INK} strokeWidth="1" />;
  /* Calm: a little "w" smile. */
  return <path d={`M21 ${y} Q22.5 ${y + 1.8} 24 ${y} Q25.5 ${y + 1.8} 27 ${y}`} stroke={INK} strokeWidth="1.2" fill="none" strokeLinecap="round" />;
}

function Cheeks({ y = 32, mood, colour = "#FF9DB5" }) {
  return (
    <g opacity={mood === "happy" ? 0.85 : 0.55}>
      <ellipse cx="14.5" cy={y} rx="3" ry="1.8" fill={colour} />
      <ellipse cx="33.5" cy={y} rx="3" ry="1.8" fill={colour} />
    </g>
  );
}

function Whiskers({ y = 32.5, colour }) {
  return (
    <g stroke={colour} strokeWidth="0.55" strokeLinecap="round" opacity="0.7">
      <path d={`M18 ${y} L10 ${y - 1.6} M18 ${y + 1.2} L10 ${y + 1.6}`} />
      <path d={`M30 ${y} L38 ${y - 1.6} M30 ${y + 1.2} L38 ${y + 1.6}`} />
    </g>
  );
}

/* ---------------- The animals ----------------
   Each returns { back, front, face }: what sits behind the head (ears,
   mane), markings on the head, and the face (or null for the standard one).
   The head itself is an ellipse at (24, 29) filled with the shaded gradient. */
const ANIMALS = {
  Bunny: (p) => ({
    back: (
      <g>
        <path d="M14 18 C9 4 13 -2 17 0 C21 2 20 12 20 18 Z" fill={p.body} stroke={p.line} strokeWidth="1" />
        <path d="M15.5 15 C12.5 6 14.5 2 16.5 3 C18.5 4 18.2 11 18.3 15 Z" fill={p.ear} />
        <path d="M34 18 C39 4 35 -2 31 0 C27 2 28 12 28 18 Z" fill={p.body} stroke={p.line} strokeWidth="1" />
        <path d="M32.5 15 C35.5 6 33.5 2 31.5 3 C29.5 4 29.8 11 29.7 15 Z" fill={p.ear} />
      </g>
    ),
    front: (
      <g>
        <ellipse cx="20.5" cy="34.5" rx="3.8" ry="2.8" fill="#fff" />
        <ellipse cx="27.5" cy="34.5" rx="3.8" ry="2.8" fill="#fff" />
        <path d="M22.3 30.6 L25.7 30.6 L24 32.6 Z" fill={p.nose} />
        <Whiskers y={33} colour={p.line} />
      </g>
    ),
    mouthY: 33.6, teeth: true,
  }),
  Cat: (p) => ({
    back: (
      <g>
        <path d="M10 19 L12.5 4 L21 13 Z" fill={p.body} stroke={p.line} strokeWidth="1" strokeLinejoin="round" />
        <path d="M12.5 15.5 L13.6 8 L18 12.6 Z" fill={p.ear} />
        <path d="M38 19 L35.5 4 L27 13 Z" fill={p.body} stroke={p.line} strokeWidth="1" strokeLinejoin="round" />
        <path d="M35.5 15.5 L34.4 8 L30 12.6 Z" fill={p.ear} />
      </g>
    ),
    front: (
      <g>
        {/* Tabby stripes on the forehead. */}
        <path d="M24 16 L24 21 M20.5 16.6 L21.4 20.6 M27.5 16.6 L26.6 20.6" stroke={p.stripe} strokeWidth="1.4" strokeLinecap="round" />
        <ellipse cx="24" cy="34.2" rx="6.4" ry="4.4" fill={p.muzzle} />
        <path d="M22.6 31.4 L25.4 31.4 L24 33 Z" fill={p.nose} />
        <Whiskers y={33.2} colour={p.line} />
      </g>
    ),
    iris: p.iris, mouthY: 33.6,
  }),
  Dog: (p) => ({
    back: null,
    front: (
      <g>
        {/* Floppy ears hang over the sides of the head. */}
        <path d="M11 15 C5 16 4 30 8.5 33 C11 34.5 13 28 13.5 21 Z" fill={p.ear} />
        <path d="M37 15 C43 16 44 30 39.5 33 C37 34.5 35 28 34.5 21 Z" fill={p.ear} />
        <ellipse cx="24" cy="34.5" rx="7.2" ry="5.4" fill={p.muzzle} />
        <ellipse cx="24" cy="31.4" rx="2.8" ry="2" fill={p.nose} />
        <ellipse cx="23.2" cy="30.8" rx="0.9" ry="0.5" fill="#fff" opacity="0.7" />
      </g>
    ),
    mouthY: 34.4,
  }),
  Panda: (p) => ({
    back: (
      <g>
        <circle cx="12" cy="17" r="5.4" fill={p.patch} />
        <circle cx="36" cy="17" r="5.4" fill={p.patch} />
      </g>
    ),
    front: (
      <g>
        <ellipse cx="17.6" cy="27.4" rx="4.6" ry="5.4" fill={p.patch} transform="rotate(-25 17.6 27.4)" />
        <ellipse cx="30.4" cy="27.4" rx="4.6" ry="5.4" fill={p.patch} transform="rotate(25 30.4 27.4)" />
        <ellipse cx="24" cy="31.6" rx="2.6" ry="1.8" fill={p.nose} />
      </g>
    ),
    eyeRing: "#5C5C66", mouthY: 34,
  }),
  Koala: (p) => ({
    back: (
      <g>
        <circle cx="10.5" cy="21" r="7.4" fill={p.body} stroke={p.line} strokeWidth="0.8" />
        <circle cx="10.5" cy="21" r="4.6" fill={p.fluff} />
        <circle cx="37.5" cy="21" r="7.4" fill={p.body} stroke={p.line} strokeWidth="0.8" />
        <circle cx="37.5" cy="21" r="4.6" fill={p.fluff} />
      </g>
    ),
    front: (
      <g>
        {/* The big, dark koala nose. */}
        <path d="M21 28.6 C21 26.6 27 26.6 27 28.6 L27 31.2 C27 34.4 21 34.4 21 31.2 Z" fill={p.nose} />
        <ellipse cx="23" cy="28.8" rx="0.9" ry="1.4" fill="#fff" opacity="0.35" />
      </g>
    ),
    eyeDX: 7.4, eyeY: 26.4, mouthY: 35.4,
  }),
  Raccoon: (p) => ({
    back: (
      <g>
        <path d="M10.5 20 L12.5 7 L20 14 Z" fill={p.body} stroke={p.line} strokeWidth="1" strokeLinejoin="round" />
        <path d="M13 17 L13.8 10.4 L17.6 14 Z" fill={p.muzzle} />
        <path d="M37.5 20 L35.5 7 L28 14 Z" fill={p.body} stroke={p.line} strokeWidth="1" strokeLinejoin="round" />
        <path d="M35 17 L34.2 10.4 L30.4 14 Z" fill={p.muzzle} />
      </g>
    ),
    front: (
      <g>
        {/* The bandit mask, with white brows above it. */}
        <path d="M10.5 27 C13 22 20 22.6 24 26 C28 22.6 35 22 37.5 27 C35 31.6 28.6 31 24 29 C19.4 31 13 31.6 10.5 27 Z" fill={p.mask} />
        <path d="M13.5 22.4 Q18 20 22 22.6 M26 22.6 Q30 20 34.5 22.4" stroke={p.muzzle} strokeWidth="1.6" strokeLinecap="round" fill="none" />
        <ellipse cx="24" cy="34" rx="6.4" ry="4.6" fill={p.muzzle} />
        <ellipse cx="24" cy="31.4" rx="2.3" ry="1.6" fill={p.nose} />
        <Whiskers y={33.4} colour={p.line} />
      </g>
    ),
    eyeRing: "#6A5F55", mouthY: 34.2,
  }),
  Otter: (p) => ({
    back: (
      <g>
        <circle cx="11.6" cy="20.6" r="3.6" fill={p.body} stroke={p.line} strokeWidth="0.8" />
        <circle cx="36.4" cy="20.6" r="3.6" fill={p.body} stroke={p.line} strokeWidth="0.8" />
      </g>
    ),
    front: (
      <g>
        <ellipse cx="20.8" cy="33.4" rx="4.4" ry="3.6" fill={p.muzzle} />
        <ellipse cx="27.2" cy="33.4" rx="4.4" ry="3.6" fill={p.muzzle} />
        <ellipse cx="24" cy="30.8" rx="2.6" ry="1.8" fill={p.nose} />
        <g fill={p.line} opacity="0.6">
          <circle cx="19" cy="33" r="0.45" /><circle cx="20.6" cy="34.4" r="0.45" /><circle cx="18.4" cy="34.8" r="0.45" />
          <circle cx="29" cy="33" r="0.45" /><circle cx="27.4" cy="34.4" r="0.45" /><circle cx="29.6" cy="34.8" r="0.45" />
        </g>
        <Whiskers y={33.6} colour={p.line} />
      </g>
    ),
    eyeY: 26.6, mouthY: 34.6,
  }),
  Fox: (p) => ({
    back: (
      <g>
        <path d="M9 21 L11.5 3 L21.5 13 Z" fill={p.body} stroke={p.line} strokeWidth="1" strokeLinejoin="round" />
        <path d="M11.5 3 L14.4 9.6 L10.5 10 Z" fill={p.tip} />
        <path d="M12 17 L12.8 9 L18.4 13.4 Z" fill={p.ear} />
        <path d="M39 21 L36.5 3 L26.5 13 Z" fill={p.body} stroke={p.line} strokeWidth="1" strokeLinejoin="round" />
        <path d="M36.5 3 L33.6 9.6 L37.5 10 Z" fill={p.tip} />
        <path d="M36 17 L35.2 9 L29.6 13.4 Z" fill={p.ear} />
      </g>
    ),
    front: (
      <g>
        {/* White cheek fluff meeting at a pointed muzzle. */}
        <path d="M9.4 29 C12 37 19 41 24 42 C29 41 36 37 38.6 29 C34 33.6 28.6 33 24 31 C19.4 33 14 33.6 9.4 29 Z" fill={p.cheek} />
        <ellipse cx="24" cy="31.6" rx="2.3" ry="1.6" fill={p.nose} />
        <ellipse cx="23.4" cy="31.1" rx="0.7" ry="0.4" fill="#fff" opacity="0.6" />
      </g>
    ),
    mouthY: 34.2,
  }),
  Lion: (p) => ({
    back: (
      <g>
        {/* A shaggy mane: overlapping tufts all round the head. */}
        {Array.from({ length: 14 }, (_, i) => {
          const a = (i / 14) * Math.PI * 2;
          return <circle key={i} cx={24 + 17.6 * Math.cos(a)} cy={29 + 16.4 * Math.sin(a)} r="6" fill={i % 2 ? p.mane : p.maneDark} />;
        })}
        <circle cx="13" cy="17.4" r="3.6" fill={p.body} stroke={p.line} strokeWidth="0.8" />
        <circle cx="35" cy="17.4" r="3.6" fill={p.body} stroke={p.line} strokeWidth="0.8" />
      </g>
    ),
    front: (
      <g>
        <ellipse cx="20.6" cy="33.8" rx="4.4" ry="3.6" fill={p.muzzle} />
        <ellipse cx="27.4" cy="33.8" rx="4.4" ry="3.6" fill={p.muzzle} />
        <path d="M21.6 30.4 C21.6 29 26.4 29 26.4 30.4 C26.4 31.8 24 33 24 33 C24 33 21.6 31.8 21.6 30.4 Z" fill={p.nose} />
      </g>
    ),
    mouthY: 35,
  }),
};

/* The owl has its own face: a feathery face disc and big round eyes. */
function OwlFace({ p, mood }) {
  const eye = (x) => {
    if (mood === "happy") return <path key={x} d={`M${x - 3.6} 28.4 Q${x} 24.4 ${x + 3.6} 28.4`} stroke={INK} strokeWidth="1.8" fill="none" strokeLinecap="round" />;
    const look = mood === "think" ? { x: -1, y: -1.2 } : { x: 0, y: 0 };
    const r = mood === "surprised" ? 4.4 : 3.9;
    return (
      <g key={x}>
        <circle cx={x} cy="27.6" r={r} fill={p.iris} stroke={p.ring} strokeWidth="1.2" />
        <circle cx={x + look.x} cy={27.6 + look.y} r={2.2} fill={INK} />
        <circle cx={x + look.x - 1} cy={26.4 + look.y} r="0.95" fill="#fff" />
        {mood === "sad" && <path d={`M${x - 4.4} 23.6 L${x + 4} ${x < 24 ? 25 : 22.2}`} stroke={p.line} strokeWidth="1.6" strokeLinecap="round" />}
      </g>
    );
  };
  return (
    <g>
      <ellipse cx="17.6" cy="28" rx="7.6" ry="8" fill={p.disc} />
      <ellipse cx="30.4" cy="28" rx="7.6" ry="8" fill={p.disc} />
      <g className={mood === "happy" ? "" : "kBlink"}>{[17.6, 30.4].map(eye)}</g>
      <path d="M22.4 31.4 L25.6 31.4 L24 35.6 Z" fill={p.beak} stroke="#B86A1E" strokeWidth="0.6" strokeLinejoin="round" />
      {/* A few chest feathers under the face. */}
      <path d="M18 40 Q20 38.6 22 40 M22 40 Q24 38.6 26 40 M26 40 Q28 38.6 30 40" stroke={p.line} strokeWidth="0.8" fill="none" opacity="0.6" />
      {mood === "sad" && <Mouth y={36.4} mood="sad" />}
    </g>
  );
}

/* Each animal blinks on its own rhythm, so a screen of them never blinks in step. */
const BLINK_DELAY = { Bunny: 0.4, Cat: 2.1, Dog: 1.2, Panda: 3.0, Koala: 0.9, Raccoon: 2.6, Otter: 1.7, Fox: 3.4, Owl: 2.3, Lion: 0.2 };

/** `mood`: undefined | "happy" | "sad" | "think" | "surprised" (see the top). */
export function AnimalIcon({ kind, size = 46, hat, mood }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const p = PALETTE[kind] || PALETTE.Bunny;
  const isOwl = kind === "Owl";
  const a = isOwl ? null : (ANIMALS[kind] || ANIMALS.Bunny)(p);
  const headFill = `url(#${uid}h)`;
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true"
      className={"kAnimal" + (mood ? " kAnimal" + mood : "")}
      style={{ "--kBlinkDelay": `${BLINK_DELAY[kind] ?? 1}s` }}>
      <defs>
        <radialGradient id={`${uid}h`} cx="42%" cy="34%" r="68%">
          <stop offset="0" stopColor={p.light} />
          <stop offset="0.62" stopColor={p.body} />
          <stop offset="1" stopColor={p.shade} />
        </radialGradient>
      </defs>
      {isOwl ? (
        <>
          {/* Ear tufts, round body hint, then the head. */}
          <path d="M11 17 L9.6 6 L18.6 13.4 Z" fill={p.body} stroke={p.line} strokeWidth="1" strokeLinejoin="round" />
          <path d="M37 17 L38.4 6 L29.4 13.4 Z" fill={p.body} stroke={p.line} strokeWidth="1" strokeLinejoin="round" />
          <ellipse cx="24" cy="29" rx="16.2" ry="15.4" fill={headFill} stroke={p.line} strokeWidth="1" />
          <OwlFace p={p} mood={mood} />
        </>
      ) : (
        <>
          {a.back}
          <ellipse cx="24" cy="29" rx="15.6" ry="14.6" fill={headFill} stroke={p.line} strokeWidth="1" />
          {a.front}
          <Cheeks mood={mood} y={a.eyeRing ? 33.4 : 32.4} />
          {a.eyeRing ? (
            /* Eyes in dark patches (panda, raccoon) get a lighter ring so they still read. */
            <g>
              {mood !== "happy" && <>
                <circle cx="18" cy={a.eyeY ?? 27} r="3.9" fill={a.eyeRing} />
                <circle cx="30" cy={a.eyeY ?? 27} r="3.9" fill={a.eyeRing} />
              </>}
              <Eyes y={a.eyeY ?? 27} dx={a.eyeDX ?? 6} mood={mood} onDark />
            </g>
          ) : (
            <Eyes y={a.eyeY ?? 27} dx={a.eyeDX ?? 6} mood={mood} iris={a.iris} />
          )}
          <Mouth y={a.mouthY ?? 34} mood={mood} />
          {a.teeth && mood !== "happy" && mood !== "surprised" && (
            <path d="M22.9 35 L22.9 36.8 L25.1 36.8 L25.1 35" fill="#fff" stroke={p.line} strokeWidth="0.5" />
          )}
        </>
      )}
      <HatOverlay hat={hat} />
    </svg>
  );
}
