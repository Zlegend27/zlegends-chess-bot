/* Board square color themes -- squares are plain CSS-colored divs (no
   images), so each theme is just a light/dark hex pair applied via the
   --boardLight/--boardDark custom properties on .root, rather than
   swapping in the whole boarad SVGs these were sourced from. */
export const BOARD_COLORS = [
  { id: "default", label: "Classic", light: "#C9C2E8", dark: "#4A2A7A" },
  { id: "standard", label: "Standard", light: "#EEEED2", dark: "#769656" },
  { id: "blue", label: "Blue", light: "#ffffff", dark: "#96dbff" },
  { id: "brown", label: "Brown", light: "#fff2d4", dark: "#de925a" },
  { id: "green", label: "Green", light: "#fff2d4", dark: "#8cc936" },
];

export function getBoardColor(id) {
  return BOARD_COLORS.find(c => c.id === id) || BOARD_COLORS[0];
}
