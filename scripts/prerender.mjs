/* Runs after `vite build` (npm's postbuild). The app draws every page with
   its script, so on its own every address sends search engines and link
   previews the same page. This writes a real HTML file for each public page
   (dist/<path>.html) from src/data/seoPages.js: its own title,
   description, canonical link, share tags and structured data, and a short
   block of text and links inside the page shell, which the app replaces as
   soon as it loads. It also writes dist/sitemap.xml from the same list.

   Vercel serves these files before its rewrites ("cleanUrls" in
   vercel.json: /puzzles is dist/puzzles.html); addresses without a file
   still reach the app through the rewrites there. */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SEO_PAGES, SITE, LINK_TEXT } from "../src/data/seoPages.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const template = readFileSync(join(dist, "index.html"), "utf8");

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const urlOf = (path) => SITE.url + (path === "/" ? "/" : path);
const fullTitle = (page) => (page.path === "/" ? `${SITE.name} · ${page.title}` : `${page.title} · ${SITE.name}`);

/* Structured data: who runs the site and what it is on Home; where each
   other page sits (a breadcrumb) on the rest. */
function structuredData(page) {
  if (page.path === "/") {
    return [
      { "@context": "https://schema.org", "@type": "WebSite", name: SITE.name, url: SITE.url + "/" },
      { "@context": "https://schema.org", "@type": "Organization", name: SITE.name, url: SITE.url + "/", logo: SITE.url + "/icon-512.png", sameAs: SITE.sameAs },
      {
        "@context": "https://schema.org", "@type": "WebApplication", name: SITE.name, url: SITE.url + "/",
        applicationCategory: "GameApplication", operatingSystem: "Any (runs in the browser)",
        description: page.description, image: SITE.image,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      },
    ];
  }
  return [{
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: SITE.name, item: SITE.url + "/" },
      { "@type": "ListItem", position: 2, name: page.heading, item: urlOf(page.path) },
    ],
  }];
}

function render(page) {
  const title = fullTitle(page);
  let html = template;
  const swap = (re, value) => {
    if (!re.test(html)) throw new Error(`prerender: ${re} not found in dist/index.html`);
    html = html.replace(re, value);
  };
  swap(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`);
  swap(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${esc(page.description)}" />`);
  swap(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${esc(title)}" />`);
  swap(/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${esc(page.description)}" />`);
  swap(/<meta name="twitter:title" content="[^"]*" \/>/, `<meta name="twitter:title" content="${esc(title)}" />`);
  swap(/<meta name="twitter:description" content="[^"]*" \/>/, `<meta name="twitter:description" content="${esc(page.description)}" />`);
  const head = [
    `<link rel="canonical" href="${urlOf(page.path)}" />`,
    `<meta property="og:url" content="${urlOf(page.path)}" />`,
    ...structuredData(page).map((d) => `<script type="application/ld+json">${JSON.stringify(d).replace(/</g, "\\u003c")}</script>`),
  ].join("\n    ");
  swap(/<\/head>/, `    ${head}\n  </head>`);
  const links = page.links.map((p) => `<a href="${p}">${esc(LINK_TEXT[p] ?? p)}</a>`).join(" ");
  const text = `<div class="seoText"><h1>${esc(page.heading)}</h1>${page.intro.map((p) => `<p>${esc(p)}</p>`).join("")}<nav aria-label="More on ${esc(SITE.name)}">${links}</nav></div>`;
  swap(/<div id="shell"><header>([^<]*)<\/header><\/div>/, `<div id="shell"><header>$1</header>${text}</div>`);
  return html;
}

for (const page of SEO_PAGES) {
  const file = page.path === "/" ? join(dist, "index.html") : join(dist, page.path.slice(1) + ".html");
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, render(page));
}

const today = new Date().toISOString().slice(0, 10);
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${SEO_PAGES.filter((p) => !p.noindex).map((p) => `  <url><loc>${urlOf(p.path)}</loc><lastmod>${today}</lastmod></url>`).join("\n")}
</urlset>
`;
writeFileSync(join(dist, "sitemap.xml"), sitemap);
console.log(`prerender: ${SEO_PAGES.length} pages and the sitemap written`);
