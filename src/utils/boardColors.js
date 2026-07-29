/* Board square color themes -- squares are plain CSS-colored divs (no
   images), so each theme is just a light/dark hex pair applied via the
   --boardLight/--boardDark custom properties on .root, rather than
   swapping in the whole boarad SVGs these were sourced from. */
export const BOARD_COLORS = [
  { id: "default", label: "Classic", light: "#C9C2E8", dark: "#4A2A7A" },
  { id: "standard", label: "Standard", light: "#EEEED2", dark: "#769656" },
  /* Her own palette (see the --sh-* comment in tokens.css) -- dark squares
     reuse --sh-red exactly rather than inventing a new value. Light square
     is a step brighter than --sh-text so it still reads as a light square
     next to that dark red, not just "less red." */
  { id: "sweetheart", label: "Sweetheart", light: "#FDE2ED", dark: "#C23B4E" },
  { id: "blue", label: "Blue", light: "#ffffff", dark: "#96dbff" },
  { id: "green", label: "Green", light: "#fff2d4", dark: "#8cc936" },
];

export function getBoardColor(id) {
  return BOARD_COLORS.find(c => c.id === id) || BOARD_COLORS[0];
}
