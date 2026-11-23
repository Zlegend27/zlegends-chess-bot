/* Drawing pieces shared by the link-preview pictures (api/card.js for a
   shared game, api/page-card.js for each page): the element helper the
   renderer wants, the colours, and a board. Files starting with "_" are
   helpers, not routes, on Vercel. */
import { cburnettPieceSvgUrl } from "../src/utils/cburnettPieceSvg.js";

export const LIGHT = "#EBD6B5", DARK = "#7A5AA8", BG = "#140B22";

/* Every box is a flex box (the renderer insists on it). */
export const h = (type, props, ...children) => {
  const kids = children.flat();
  const style = type === "div" ? { display: "flex", ...props.style } : props.style;
  return { type, props: { ...props, style, children: kids.length === 1 ? kids[0] : kids } };
};

/** A board: `board` is 64 piece codes, a1 first (0 = empty, + White,
 *  - Black); `flipped` puts Black at the bottom. */
export function boardRows(board, { size = 70, flipped = false } = {}) {
  const rows = [];
  for (let vr = 0; vr < 8; vr++) {
    const r = flipped ? vr : 7 - vr;
    const cells = [];
    for (let vf = 0; vf < 8; vf++) {
      const f = flipped ? 7 - vf : vf;
      const p = board ? board[r * 8 + f] : 0;
      cells.push(h("div", { style: { width: size, height: size, display: "flex", background: (r + f) % 2 ? LIGHT : DARK } },
        p ? h("img", { src: cburnettPieceSvgUrl(Math.abs(p), p > 0), width: size, height: size }) : []));
    }
    rows.push(h("div", { style: { display: "flex" } }, cells));
  }
  return h("div", { style: { display: "flex", flexDirection: "column", border: "6px solid #3a2560", borderRadius: 10 } }, rows);
}
