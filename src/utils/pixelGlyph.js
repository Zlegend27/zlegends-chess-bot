/* Renders a chess Unicode glyph onto a tiny canvas and returns a data URL —
   displayed with `image-rendering: pixelated` at a larger CSS size, this
   turns the already-legible chess symbols into a chunky retro pixel-art
   look without needing to hand-design a dozen sprites from scratch.
   Results are cached since a canvas render per piece is unnecessary work
   to repeat on every re-render. */

const cache = new Map();
const SIZE = 28;

export function pixelGlyphUrl(glyph, fillColor, { outline, accent } = {}) {
  const key = glyph + "|" + fillColor + "|" + (outline || "") + "|" + (accent || "");
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement("canvas");
  c.width = SIZE; c.height = SIZE;
  const ctx = c.getContext("2d");
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `bold ${Math.floor(SIZE * 0.9)}px sans-serif`;
  const x = SIZE / 2, y = SIZE / 2 + SIZE * 0.05, text = glyph + "︎";
  const outlineOffset = Math.max(1, Math.round(SIZE / 20));
  if (outline) {
    ctx.fillStyle = outline;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      ctx.fillText(text, x + dx * outlineOffset, y + dy * outlineOffset);
    }
  }
  ctx.fillStyle = fillColor;
  ctx.fillText(text, x, y);
  if (accent) {
    // king only: a small cross so it isn't confused with the queen at this resolution
    ctx.fillStyle = accent;
    const cx = SIZE / 2, top = SIZE * 0.02;
    ctx.fillRect(cx - 1, top, 2, SIZE * 0.22);
    ctx.fillRect(cx - 3, top + SIZE * 0.06, 6, 2);
  }
  const url = c.toDataURL();
  cache.set(key, url);
  return url;
}
