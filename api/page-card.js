/* The link-preview picture for each public page (/api/page-card?p=/review):
   the page's heading and description beside a board, 1200x630. An
   opening's page shows that opening's position, from its side. Pages
   point here from their og:image (scripts/prerender.mjs); Home keeps its
   own og-2700.jpg (scripts/make-og.mjs). The text comes from src/data/seoPages.js, so it changes with
   a deploy: cached for a day. */
import { ImageResponse } from "@vercel/og";
import { createEngine } from "../src/engine/chessEngine.js";
import { replayIntoEngine } from "../src/utils/share.js";
import { SEO_PAGES } from "../src/data/seoPages.js";
import { courseForPath } from "../src/data/openingPages.js";
import { BG, h, boardRows } from "./_board.js";

export const config = { runtime: "edge" };

export function shorten(text, max) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const end = cut.lastIndexOf(". ");
  return end > 40 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, "") + "…";
}

function boardFor(path) {
  const course = courseForPath(path);
  const eng = createEngine();
  eng.reset();
  if (course) replayIntoEngine(eng, course.root.split(" "));
  return { board: Array.from({ length: 64 }, (_, sq) => eng.pieceAt(sq)), flipped: course?.side === "black" };
}

export default function handler(req) {
  const path = new URL(req.url).searchParams.get("p") || "/";
  const page = SEO_PAGES.find((p) => p.path === path);
  /* Only our own pages: anything else is refused before any drawing, so
     made-up addresses can't make this render pictures without end. */
  if (!page) return new Response("Not found", { status: 404, headers: { "Cache-Control": "public, max-age=3600" } });
  const { board, flipped } = boardFor(page.path);
  /* Long descriptions stop at the end of a sentence that fits, not mid-phrase. */
  const description = shorten(page.description, 150);
  const tree = h("div", { style: { width: 1200, height: 630, display: "flex", alignItems: "center", background: BG, padding: 35, gap: 50, fontFamily: "sans-serif" } },
    boardRows(board, { flipped }),
    h("div", { style: { display: "flex", flexDirection: "column", gap: 22, flex: 1, color: "#F2E9FF" } },
      h("div", { style: { fontSize: 34, color: "#3EE7F5", fontWeight: 700 } }, "Zlegend2700"),
      h("div", { style: { fontSize: 52, fontWeight: 800, lineHeight: 1.1 } }, page.heading),
      h("div", { style: { fontSize: 28, color: "#BFAFDA", lineHeight: 1.35 } }, description),
      h("div", { style: { fontSize: 28, color: "#F5D93E", marginTop: 12 } }, "Free · no ads · in your browser")));
  return new ImageResponse(tree, { width: 1200, height: 630, headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" } });
}
