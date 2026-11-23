/* Development only: `await __a11y()` in the browser console checks the
   page on screen with axe-core (the accessibility rules WCAG 2.1 A and AA)
   and prints what fails. Contrast over the site's see-through cards often
   comes back "can't tell" from axe, so __a11y also runs its own contrast
   check: each text's colour against the layers behind it blended down to
   the page background (stars ignored). Not part of the site's build. */
const parse = (c) => {
  const m = /rgba?\(([^)]+)\)/.exec(c);
  if (!m) return null;
  const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
  return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 };
};
const over = (top, bot) => ({ r: top.r * top.a + bot.r * (1 - top.a), g: top.g * top.a + bot.g * (1 - top.a), b: top.b * top.a + bot.b * (1 - top.a), a: 1 });
const lum = (c) => {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

/** Text on the page that fails WCAG AA contrast (4.5:1, or 3:1 for large text). */
export function contrastFailures(doc = document, win = window) {
  const pageBg = parse(win.getComputedStyle(doc.body).backgroundColor) ?? { r: 14, g: 6, b: 32, a: 1 };
  const bgOf = (el) => {
    const layers = [];
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const cs = win.getComputedStyle(e);
      const c = parse(cs.backgroundColor);
      if (c && c.a > 0) layers.push(c);
      /* A gradient behind the text: can't tell, skip it. */
      if (cs.backgroundImage !== "none" && !/url\(/.test(cs.backgroundImage) && layers.length === 0) return null;
    }
    return layers.reverse().reduce((bg, l) => over(l, bg), pageBg);
  };
  const fails = [];
  const seen = new Set();
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const el = walker.currentNode.parentElement;
    if (!walker.currentNode.textContent.trim() || !el || seen.has(el)) continue;
    seen.add(el);
    const cs = win.getComputedStyle(el);
    if (!el.getBoundingClientRect().width || cs.visibility === "hidden" || el.closest('[aria-hidden="true"],.sr-only,:disabled')) continue;
    const bg = bgOf(el);
    let fg = parse(cs.color);
    if (!bg || !fg) continue;
    if (fg.a < 1) fg = over(fg, bg);
    const size = parseFloat(cs.fontSize);
    const need = size >= 24 || (+cs.fontWeight >= 700 && size >= 18.66) ? 3 : 4.5;
    const got = ratio(fg, bg);
    if (got < need) fails.push({ text: walker.currentNode.textContent.trim().slice(0, 40), ratio: +got.toFixed(2), need, el });
  }
  return fails;
}

export async function a11y() {
  if (!window.axe) await import("axe-core").then((m) => { window.axe = m.default ?? m; });
  const res = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] } });
  const rules = res.violations.map((v) => ({ rule: v.id, impact: v.impact, count: v.nodes.length, where: v.nodes.slice(0, 3).map((n) => n.target.join(" ")) }));
  const contrast = contrastFailures();
  console.table(rules);
  console.table(contrast.map((f) => ({ text: f.text, ratio: f.ratio, need: f.need })));
  return { rules, contrast };
}
