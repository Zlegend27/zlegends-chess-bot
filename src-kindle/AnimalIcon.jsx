/* Animal opponent art -- extracted out of KindleApp.jsx so the Lessons
   feature (KidLessonPlayer.jsx) can reuse the same mascot art for its
   narrator (Owl) without duplicating ~140 lines of hand-drawn SVG. */

export const PALETTE = {
  Bunny: { body: "#FFD8EA", ear: "#FFB6D9", accent: "#FF6FA5", blush: "#FFA6C9" },
  Cat: { body: "#FFC98B", ear: "#FFB35C", accent: "#E8853B", blush: "#FF9E9E" },
  Dog: { body: "#E8C08E", ear: "#B9803F", accent: "#8B5E34", blush: "#FFA6A6" },
  Panda: { body: "#F7F7F7", ear: "#3A3A3A", accent: "#2B2B2B", blush: "#FFB8C6" },
  Koala: { body: "#C7CAD1", ear: "#9297A3", accent: "#5B5F68", blush: "#FFB6B6" },
  Raccoon: { body: "#B8B0A6", ear: "#5A5248", accent: "#3A342C", blush: "#FFAFAF" },
  Otter: { body: "#A8785A", ear: "#7A5138", accent: "#4E331F", blush: "#FFC0A8" },
  Fox: { body: "#FF9955", ear: "#FF7A2E", accent: "#C24E00", blush: "#FFC2C2", muzzle: "#FFF3E4" },
  Owl: { body: "#D9B45C", ear: "#C99A3B", accent: "#7B5218", blush: "#FFC9A0", eye: "#7B4B12" },
  Lion: { body: "#FFDD77", ear: "#F7A531", accent: "#E8790A", blush: "#FFB98A" },
};

/* Ear shape families for the four unlockable animals -- rather than
   hand-drawing a brand-new ear shape for each, they reuse Dog's rounded
   ears or Cat's triangular ears (just recolored via PALETTE), which is
   plenty of visual variety for a shop icon at this size. */
export const DOG_EARED = ["Dog", "Panda", "Koala"];
export const CAT_EARED = ["Cat", "Raccoon", "Otter"];

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

/** `mood`: "happy" (big grin, brighter blush) | "sad" (downturned mouth) |
 *  undefined (neutral, the default face). Purely cosmetic -- callers
 *  decide when a win/loss/puzzle-mistake warrants a mood swing. */
export function AnimalIcon({ kind, size = 46, hat, mood }) {
  const isOwl = kind === "Owl";
  const isLion = kind === "Lion";
  const isFox = kind === "Fox";
  const pal = PALETTE[kind] || PALETTE.Bunny;
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className={"kAnimal" + (mood ? " kAnimal" + mood : "")}>
      <HatOverlay hat={hat} />
      {isLion && (
        <circle cx="24" cy="30" r="21" fill="none" stroke={pal.ear} strokeWidth="4" strokeDasharray="5 4" />
      )}
      {kind === "Bunny" && (<>
        <rect x="12" y="2" width="7" height="22" rx="3.5" fill={pal.body} stroke={pal.accent} strokeWidth="2" />
        <rect x="29" y="2" width="7" height="22" rx="3.5" fill={pal.body} stroke={pal.accent} strokeWidth="2" />
        <rect x="14" y="6" width="3" height="14" rx="1.5" fill={pal.ear} />
        <rect x="31" y="6" width="3" height="14" rx="1.5" fill={pal.ear} />
      </>)}
      {CAT_EARED.includes(kind) && (<>
        <path d="M10 16 L16 2 L22 16 Z" fill={pal.body} stroke={pal.accent} strokeWidth="2" strokeLinejoin="round" />
        <path d="M26 16 L32 2 L38 16 Z" fill={pal.body} stroke={pal.accent} strokeWidth="2" strokeLinejoin="round" />
        <path d="M13 13 L16 6 L19 13 Z" fill={pal.ear} />
        <path d="M29 13 L32 6 L35 13 Z" fill={pal.ear} />
      </>)}
      {DOG_EARED.includes(kind) && (<>
        <ellipse cx="9" cy="28" rx="7" ry="12" fill={pal.body} stroke={pal.accent} strokeWidth="2" />
        <ellipse cx="39" cy="28" rx="7" ry="12" fill={pal.body} stroke={pal.accent} strokeWidth="2" />
      </>)}
      {isFox && (<>
        <path d="M9 18 L16 3 L21 18 Z" fill={pal.body} stroke={pal.accent} strokeWidth="2" strokeLinejoin="round" />
        <path d="M27 18 L32 3 L39 18 Z" fill={pal.body} stroke={pal.accent} strokeWidth="2" strokeLinejoin="round" />
        <path d="M12 15 L16 8 L19 15 Z" fill={pal.muzzle} />
        <path d="M29 15 L32 8 L36 15 Z" fill={pal.muzzle} />
      </>)}
      {isOwl && (<>
        <path d="M13 11 L18 3 L20 12 Z" fill={pal.body} stroke={pal.accent} strokeWidth="2" strokeLinejoin="round" />
        <path d="M35 11 L30 3 L28 12 Z" fill={pal.body} stroke={pal.accent} strokeWidth="2" strokeLinejoin="round" />
      </>)}
      {isLion && (<>
        <path d="M8 20 L14 8 L18 20 Z" fill={pal.ear} stroke={pal.accent} strokeWidth="2" strokeLinejoin="round" />
        <path d="M40 20 L34 8 L30 20 Z" fill={pal.ear} stroke={pal.accent} strokeWidth="2" strokeLinejoin="round" />
      </>)}
      <circle cx="24" cy="30" r="15" fill={pal.body} stroke={pal.accent} strokeWidth="2" />
      <circle cx="15" cy="34" r="3" fill={pal.blush} opacity={mood === "happy" ? "1" : "0.85"} />
      <circle cx="33" cy="34" r="3" fill={pal.blush} opacity={mood === "happy" ? "1" : "0.85"} />
      {isFox && <ellipse cx="24" cy="34" rx="7" ry="8" fill={pal.muzzle} />}
      {isOwl ? (<>
        <circle cx="17" cy="28" r="5.5" fill="#fff" stroke={pal.accent} strokeWidth="2" />
        <circle cx="31" cy="28" r="5.5" fill="#fff" stroke={pal.accent} strokeWidth="2" />
        <circle cx="17" cy="28" r="2.2" fill={pal.eye} />
        <circle cx="31" cy="28" r="2.2" fill={pal.eye} />
        <path d="M22 33 L26 33 L24 38 Z" fill="#F2A65A" />
      </>) : (<>
        <circle cx="19" cy="27" r="2" fill="#3a2a1a" />
        <circle cx="29" cy="27" r="2" fill="#3a2a1a" />
        {mood === "happy" ? (
          <path d="M18 34 Q24 40 30 34" stroke="#3a2a1a" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        ) : mood === "sad" ? (
          <path d="M18 38 Q24 33 30 38" stroke="#3a2a1a" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        ) : (<>
          <path d="M22 33 L26 33 L24 36 Z" fill="#3a2a1a" />
          <path d="M24 36 L24 39 M24 39 L20 41 M24 39 L28 41" stroke="#3a2a1a" strokeWidth="1.5" fill="none" />
        </>)}
      </>)}
    </svg>
  );
}
