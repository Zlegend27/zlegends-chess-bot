/* Draws the home page's link-preview picture, public/og.png (1200x630), saved as public/og-2700.jpg: the
   pixel avatar, ZLEGEND2700, and one line on the two main features. Every
   other page draws its own card on the server (api/page-card.js).

   Run: node scripts/make-og.mjs [path to a heavy font, e.g. Arial Black]
   (the site's display font; on Windows C:\Windows\Fonts\ariblk.ttf). Then
   convert to public/og.jpg if needed. */
import { ImageResponse } from "@vercel/og";
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fontPath = process.argv[2] || "C:/Windows/Fonts/ariblk.ttf";
const heavy = readFileSync(fontPath);

/* The avatar, from PixelAvatar.jsx's ZPIX and ZPAL, as an SVG picture. */
const src = readFileSync(join(root, "src/components/PixelAvatar.jsx"), "utf8");
const pal = Function(`return (${src.match(/ZPAL = (\{[^}]+\})/)[1]})`)();
const rows = Function(`return (${src.match(/ZPIX = (\[[\s\S]*?\]);/)[1]})`)();
const rects = rows.flatMap((row, y) => [...row].map((c, x) => (pal[c] ? `<rect x="${x}" y="${y}" width="1" height="1" fill="${pal[c]}"/>` : ""))).join("");
const avatar = `data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 ${rows.length}" shape-rendering="crispEdges">${rects}</svg>`).toString("base64")}`;

const h = (type, props, ...children) => ({ type, props: { ...props, children: children.length === 1 ? children[0] : children } });

const tree = h("div", {
  style: {
    width: 1200, height: 630, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    background: "radial-gradient(circle at 30% 20%, #3a1466 0%, #1d0b3a 45%, #0e0620 100%)", fontFamily: "Heavy", color: "#ffffff", gap: 18,
  },
},
  h("div", { style: { display: "flex", alignItems: "center", gap: 28 } },
    h("img", { src: avatar, width: 150, height: 150, style: { borderRadius: 24, background: "#1D1038", border: "3px solid #8B2FC9", padding: 8 } }),
    h("div", { style: { fontSize: 108, letterSpacing: 2, transform: "skewX(-8deg)", textShadow: "0 0 32px rgba(217,75,240,0.55)" } }, "ZLEGEND2700"),
  ),
  h("div", { style: { display: "flex", fontSize: 38, color: "#F5D93E", textAlign: "center", maxWidth: 1000, lineHeight: 1.25, marginTop: 6 } },
    "Face Rank Bot, the chess bot that adapts to your level, and get free game reviews."),
  h("div", { style: { display: "flex", fontSize: 26, color: "#C9C2E8", marginTop: 10 } }, "zlegend2700.com · free · no ads"),
);

const res = new ImageResponse(tree, { width: 1200, height: 630, fonts: [{ name: "Heavy", data: heavy, weight: 900, style: "normal" }] });
writeFileSync(join(root, "public/og.png"), Buffer.from(await res.arrayBuffer()));
console.log("public/og.png written");
