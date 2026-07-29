/* Sweetheart's hand-drawn piece set -- unlike the other three sets (all
   generated inline as data-URL SVGs, see chessPieceSvg.js), these are real
   raster files under public/pieces/sweetheart/, cropped and color-keyed
   to transparent from her reference art, then downscaled to a 360px cap
   (comfortably covers the largest on-screen size, an ~90px board square
   at 2x-3x pixel density) and palette-quantized -- the sources were
   full-resolution originals (up to ~900KB each); this set totals ~230KB.
   Same svgUrl(type, isWhite) contract as the other sets despite the name
   mismatch (getPieceSet's callers don't care whether the URL is a data:
   URI or a real path), so nothing else needs to change to support it. */
const NAMES = { 1: "pawn", 2: "knight", 3: "bishop", 4: "rook", 5: "queen", 6: "king" };

export function sweetheartPieceUrl(type, isWhite) {
  return `/pieces/sweetheart/${isWhite ? "w" : "b"}-${NAMES[type]}.png`;
}
