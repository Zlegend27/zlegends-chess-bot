/* A shared game link (/g/<code>, rewritten here in vercel.json). People get
   the normal site, which reads the code from the address and replays the
   game; link previews (Discord, iMessage, WhatsApp...) get this page's
   title, summary and a picture of the final position (api/card.js), since
   they don't run the site's script. */
import { readGame, escapeHtml } from "./_game.js";
import { readAccuracyParam } from "../src/utils/reviewScoring.js";

export const config = { runtime: "edge" };

export default async function handler(req) {
  const url = new URL(req.url);
  const code = url.searchParams.get("c") ?? "";
  const origin = url.origin;
  const page = await fetch(`${origin}/index.html`).then((r) => r.text());
  const game = readGame(code);
  if (!game) return new Response(page, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  /* A shared review (?a=87-72): its accuracy goes in the preview. */
  const acc = readAccuracyParam(url.searchParams.get("a"));
  const accText = acc ? `Accuracy: White ${acc.white}%, Black ${acc.black}%. ` : "";
  const title = escapeHtml(`${acc ? "Game review: " : ""}${game.title} · Zlegend2700`);
  const description = escapeHtml(`${accText}${game.title === "A game on Zlegend2700" ? "" : game.title + ", "}${game.summary}. ${acc ? "See every move graded." : "Replay every move."}`);
  const aq = acc ? `&a=${acc.white}-${acc.black}` : "";
  const image = `${origin}/api/card?c=${encodeURIComponent(code)}${aq}`;
  const link = `${origin}/g/${encodeURIComponent(code)}${acc ? `?a=${acc.white}-${acc.black}` : ""}`;
  const swap = (html, attr, name, value) => html.replace(new RegExp(`(<meta ${attr}="${name}" content=")[^"]*(")`), `$1${value}$2`);
  let html = page;
  html = swap(html, "property", "og:title", title);
  html = swap(html, "property", "og:description", description);
  html = swap(html, "property", "og:image", image);
  html = swap(html, "name", "twitter:title", title);
  html = swap(html, "name", "twitter:description", description);
  html = swap(html, "name", "twitter:image", image);
  html = html.replace("</head>", `<meta property="og:url" content="${link}" />\n<meta property="og:image:width" content="1200" />\n<meta property="og:image:height" content="630" />\n</head>`);
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300, s-maxage=86400" } });
}
