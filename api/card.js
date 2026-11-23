/* The picture for a shared game link: the final position, from the
   sharer's side, with the result. 1200x630, the size link previews use.
   Cached for a day: a code always means the same game. */
import { ImageResponse } from "@vercel/og";
import { readGame } from "./_game.js";
import { cburnettPieceSvgUrl } from "../src/utils/cburnettPieceSvg.js";

export const config = { runtime: "edge" };

const LIGHT = "#EBD6B5", DARK = "#7A5AA8", BG = "#140B22";
/* Every box is a flex box (the renderer insists on it). */
const h = (type, props, ...children) => {
  const kids = children.flat();
  const style = type === "div" ? { display: "flex", ...props.style } : props.style;
  return { type, props: { ...props, style, children: kids.length === 1 ? kids[0] : kids } };
};

export default function handler(req) {
  const code = new URL(req.url).searchParams.get("c");
  const game = readGame(code);
  const size = 70;
  const flipped = game?.side === -1;
  const rows = [];
  for (let vr = 0; vr < 8; vr++) {
    const r = flipped ? vr : 7 - vr;
    const cells = [];
    for (let vf = 0; vf < 8; vf++) {
      const f = flipped ? 7 - vf : vf;
      const p = game ? game.board[r * 8 + f] : 0;
      cells.push(h("div", { style: { width: size, height: size, display: "flex", background: (r + f) % 2 ? LIGHT : DARK } },
        p ? h("img", { src: cburnettPieceSvgUrl(Math.abs(p), p > 0), width: size, height: size }) : []));
    }
    rows.push(h("div", { style: { display: "flex" } }, cells));
  }
  const tree = h("div", { style: { width: 1200, height: 630, display: "flex", alignItems: "center", background: BG, padding: 35, gap: 50, fontFamily: "sans-serif" } },
    h("div", { style: { display: "flex", flexDirection: "column", border: "6px solid #3a2560", borderRadius: 10 } }, rows),
    h("div", { style: { display: "flex", flexDirection: "column", gap: 24, flex: 1, color: "#F2E9FF" } },
      h("div", { style: { fontSize: 34, color: "#3EE7F5", fontWeight: 700 } }, "Zlegend2700"),
      h("div", { style: { fontSize: 54, fontWeight: 800, lineHeight: 1.1 } }, game ? game.title : "A shared game"),
      h("div", { style: { fontSize: 32, color: "#BFAFDA" } }, game ? game.summary : "Open the link to replay it"),
      h("div", { style: { fontSize: 28, color: "#F5D93E", marginTop: 20 } }, "Tap to replay every move")));
  return new ImageResponse(tree, { width: 1200, height: 630, headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400, immutable" } });
}
