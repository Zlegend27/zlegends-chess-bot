/* Classic, bold black/white Staunton-style chess pieces — big and instantly
   readable rather than stylized, since the rest of the UI already carries
   plenty of neon color. Rendered as SVG (crisp at any size) and cached as
   data URLs so existing <img src> call sites don't need to change. */

const BODY = {
  1: /* pawn */ `
    <circle cx="22.5" cy="12.5" r="6.5"/>
    <path d="M16,33 C16,23.5 19,19.5 22.5,18.5 C26,19.5 29,23.5 29,33 Z"/>
    <rect x="12" y="33" width="21" height="5" rx="2.2"/>`,
  4: /* rook */ `
    <path d="M11,16 L11,9 L16.67,9 L16.67,13 L19.67,13 L19.67,9 L25.33,9 L25.33,13 L28.33,13 L28.33,9 L34,9 L34,16 L30,34 L15,34 Z"/>
    <rect x="9" y="34" width="27" height="5" rx="2.2"/>`,
  2: /* knight */ bg => `
    <path d="M30,34 L30,24 Q30,16 24,14 L21,10 L19,14 Q15,15 12,20 L10,22 L13,24 Q15,23 17,25 L17,29 Q19,31 22,30 L24,34 Z"/>
    <circle cx="20" cy="17" r="1.3" fill="${bg}"/>
    <rect x="10" y="34" width="25" height="5" rx="2.2"/>`,
  3: /* bishop */ bg => `
    <circle cx="22.5" cy="8" r="3"/>
    <path d="M14,36 Q10,24 14,16 Q17,11 22.5,11 Q28,11 31,16 Q35,24 31,36 Z"/>
    <path d="M17.5,17 L27.5,17" stroke="${bg}" stroke-width="1.6" fill="none"/>
    <rect x="11" y="36" width="23" height="5" rx="2.2"/>`,
  5: /* queen */ `
    <circle cx="10" cy="10" r="2.1"/><circle cx="16.5" cy="10" r="2.1"/>
    <circle cx="22.5" cy="9.5" r="2.5"/><circle cx="28.5" cy="10" r="2.1"/><circle cx="35" cy="10" r="2.1"/>
    <path d="M8,20 L10,12 L13.25,17 L16.5,12 L19.5,17 L22.5,12 L25.5,17 L28.5,12 L31.75,17 L35,12 L37,20 Z"/>
    <path d="M12,20 Q9,28 12,34 L33,34 Q36,28 33,20 Z"/>
    <rect x="9" y="34" width="27" height="5" rx="2.2"/>`,
  6: /* king */ `
    <rect x="21" y="3" width="3" height="7"/>
    <rect x="18.5" y="5.5" width="8" height="3"/>
    <path d="M11,22 L14,14 L18,19 L22.5,13 L27,19 L31,14 L34,22 Z"/>
    <path d="M14,22 Q10,29 14,35 L31,35 Q35,29 31,22 Z"/>
    <rect x="9" y="35" width="27" height="5" rx="2.2"/>`,
};

const cache = new Map();

export function pieceSvgUrl(type, isWhite) {
  const key = type + "|" + (isWhite ? "w" : "b");
  if (cache.has(key)) return cache.get(key);
  const fill = isWhite ? "#FFFFFF" : "#1B1626";
  const stroke = isWhite ? "#171225" : "#DCD5EE";
  const bg = isWhite ? "#171225" : "#DCD5EE"; // eye/mitre cutout color, opposite of fill
  const body = typeof BODY[type] === "function" ? BODY[type](bg) : BODY[type];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45">
    <g fill="${fill}" stroke="${stroke}" stroke-width="1.4" stroke-linejoin="round">
      ${body}
    </g>
  </svg>`;
  const url = "data:image/svg+xml;base64," + btoa(svg);
  cache.set(key, url);
  return url;
}
