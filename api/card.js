/* The picture for a shared game link: the final position, from the
   sharer's side, with the result. 1200x630, the size link previews use.
   Cached for a day: a code always means the same game. */
import { ImageResponse } from "@vercel/og";
import { readGame } from "./_game.js";
import { readAccuracyParam } from "../src/utils/reviewScoring.js";
import { BG, h, boardRows } from "./_board.js";

export const config = { runtime: "edge" };

export default function handler(req) {
  const params = new URL(req.url).searchParams;
  const code = params.get("c");
  const game = readGame(code);
  /* A shared review (?a=87-72) shows both sides' accuracy. */
  const acc = game ? readAccuracyParam(params.get("a")) : null;
  const tree = h("div", { style: { width: 1200, height: 630, display: "flex", alignItems: "center", background: BG, padding: 35, gap: 50, fontFamily: "sans-serif" } },
    boardRows(game?.board, { flipped: game?.side === -1 }),
    h("div", { style: { display: "flex", flexDirection: "column", gap: 24, flex: 1, color: "#F2E9FF" } },
      h("div", { style: { fontSize: 34, color: "#3EE7F5", fontWeight: 700 } }, "Zlegend2700"),
      h("div", { style: { fontSize: 54, fontWeight: 800, lineHeight: 1.1 } }, game ? game.title : "A shared game"),
      h("div", { style: { fontSize: 32, color: "#BFAFDA" } }, game ? game.summary : "Open the link to replay it"),
      ...(acc ? [h("div", { style: { display: "flex", gap: 40, marginTop: 6 } },
        [["White", acc.white], ["Black", acc.black]].map(([side, n]) => h("div", { style: { display: "flex", flexDirection: "column" } },
          h("div", { style: { fontSize: 64, fontWeight: 800, color: "#3EE7F5", lineHeight: 1 } }, `${n}%`),
          h("div", { style: { fontSize: 26, color: "#BFAFDA", marginTop: 6 } }, `${side} accuracy`))))] : []),
      h("div", { style: { fontSize: 28, color: "#F5D93E", marginTop: 20 } }, acc ? "Tap to see every move graded" : "Tap to replay every move")));
  return new ImageResponse(tree, { width: 1200, height: 630, headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400, immutable" } });
}
