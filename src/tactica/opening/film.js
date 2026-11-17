/* The opening film, shot by shot. Each shot is a function that draws one
   frame from the seconds since it began; the film plays them in order,
   stopping at the two questions for the player's answer.

   The story: an old chess set gathers dust on a shelf while the seasons
   pass. A man finds it, and for a moment there is hope. He lifts it in his
   hands, carries it out into the dusk, and throws it in a bin. In the dark,
   a crack of light; the narrator speaks; the pieces wake, grow eyes and
   arms, and ask the player to bond with them. Yes: they arm themselves and
   show their attacks in an arena made of the rest of the set. No: they
   huddle, then beg. No again: their eyes turn red. */
import {
  W, H, KINDS, HEIGHT, clamp, lerp, ease, easeOut, easeIn, pop, span, rng,
  drawPiece, glow, speedLines, streaks, fill, gradient, bolt, floor, finish, washed, FACE,
} from "./draw.js";
import { attic, drawMan, carried, hallway, street, alley, inside } from "./scenery.js";

export const NARRATOR = [
  "One man's trash is another man's treasure.",
  "Chess is a game with many minds and souls pursuing further knowledge.",
  "Each piece is a fragmented reflection of what's within.",
  "What bonds will you create, I wonder?",
];
const BACK = ["rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook"];
const LABEL = { pawn: ["PAWN", "SWORD AND SHIELD"], knight: ["KNIGHT", "SPIKED GAUNTLETS"], bishop: ["BISHOP", "KATANA"], rook: ["ROOK", "SPEAR"], queen: ["QUEEN", "LIGHTNING STAFF"], king: ["KING", "THE VERDICT"] };

/* ---------- Things that appear in more than one shot ---------- */

/* The whole set on its board, seen from a little above White's side: black
   pieces at the back, white pawns nearest. `life` 0 is dusty and still. */
function drawSet(ctx, cx, y, s, { wobble = 0, t = 0, dust = 1, warm = 0, sparkle = 0 } = {}) {
  const wash = warm > dust * 0.6 ? ["#ffb45e", warm * 0.42] : ["#5d6675", dust * 0.5];
  washed(ctx, (c) => paintSet(c, cx, y, s, wobble, t), wash[0], wash[1]);
  if (sparkle > 0) {
    const sr = rng(5);
    for (let i = 0; i < 7; i++) {
      const sx = cx + (sr() - 0.5) * s * 8, sy = y - s * (0.6 + sr() * 2.2), tw = Math.max(0, Math.sin(t * 5 + i * 1.7));
      star(ctx, sx, sy, s * 0.42 * tw * sparkle, "#fff6d8");
    }
  }
}
function paintSet(ctx, cx, y, s, wobble, t) {
  const r = rng(11);
  ctx.save();
  ctx.fillStyle = "#3b2414";
  ctx.fillRect(cx - s * 4.6, y - s * 0.1, s * 9.2, s * 0.55);
  ctx.fillStyle = "#6b4527";
  ctx.beginPath(); ctx.moveTo(cx - s * 4.6, y - s * 0.1); ctx.lineTo(cx - s * 3.7, y - s * 2.3); ctx.lineTo(cx + s * 3.7, y - s * 2.3); ctx.lineTo(cx + s * 4.6, y - s * 0.1); ctx.closePath(); ctx.fill();
  const rows = [
    { white: false, kinds: BACK, y: -2.1, k: 0.62 }, { white: false, kinds: Array(8).fill("pawn"), y: -1.55, k: 0.68 },
    { white: true, kinds: BACK, y: -0.75, k: 0.9 }, { white: true, kinds: Array(8).fill("pawn"), y: -0.12, k: 1 },
  ];
  for (const row of rows) {
    row.kinds.forEach((kind, i) => {
      const jitter = wobble ? Math.sin(t * 31 + r() * 9) * wobble : 0;
      r();
      drawPiece(ctx, kind, cx + (i - 3.5) * s * row.k * 1.08, y + row.y * s, s * row.k, { white: row.white, tilt: jitter, facing: kind === "knight" && !row.white ? -1 : 1 });
    });
  }
  ctx.restore();
}

function star(ctx, x, y, r, color) {
  if (r <= 0.5) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, rr = i % 2 ? r * 0.14 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill();
  ctx.restore();
  glow(ctx, x, y, r * 1.6, color, 0.5);
}

/* Cobwebs strung over the set: `grown` 0 to 1 is how many there are, and
   `snap` 0 to 1 lets them fall away. */
function drawWebs(ctx, cx, y, s, grown, snap = 0) {
  const r = rng(23);
  ctx.save();
  ctx.strokeStyle = "rgba(226,232,242,0.55)";
  ctx.lineWidth = 0.9;
  ctx.globalAlpha = 1 - snap;
  for (let i = 0; i < 30; i++) {
    const x0 = cx + (r() - 0.5) * s * 8.4, y0 = y - s * (0.9 + r() * 1.8);
    const x1 = x0 + (r() - 0.5) * s * 3.4, y1 = y0 + (r() - 0.5) * s * 1.2 - (r() < 0.25 ? s * 2.4 : 0);
    if (i / 30 > grown) { r(); continue; }
    const sag = s * (0.2 + r() * 0.5) + snap * 160;
    ctx.beginPath(); ctx.moveTo(x0, y0 + snap * 60); ctx.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + sag, x1, y1 + snap * 40); ctx.stroke();
  }
  ctx.restore();
}

function motes(ctx, t, n, seed, { x0 = 0, x1 = W, y0 = 0, y1 = H, color = "rgba(255,236,200,0.9)", rise = 6, size = 1.6 } = {}) {
  const r = rng(seed);
  ctx.save();
  ctx.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const bx = lerp(x0, x1, r()), by = lerp(y0, y1, r()), ph = r() * 6.28, sp = 0.4 + r();
    const y = y0 + ((by - y0 - t * rise * sp) % (y1 - y0) + (y1 - y0)) % (y1 - y0);
    ctx.globalAlpha = 0.25 + 0.55 * Math.abs(Math.sin(t * 0.8 + ph));
    ctx.beginPath(); ctx.arc(bx + Math.sin(t * 0.5 + ph) * 9, y, size * (0.5 + r()), 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

/* The pieces as they lie, and as they stand, inside the bin. */
const CAST = (() => {
  const r = rng(77);
  const list = [];
  /* The six who speak for the rest, front and centre. */
  KINDS.forEach((kind, i) => list.push({ kind, white: true, hero: true, sx: 52 + i * 57, sy: 640 + (i % 2) * 22, ss: 92, hx: 36 + i * 62 + r() * 20, hy: 636 + r() * 30, ht: (i % 2 ? 1 : -1) * (1.25 + r() * 0.4) }));
  const rest = [...BACK, ...Array(8).fill("pawn")];
  rest.forEach((kind, i) => list.push({ kind, white: false, sx: 24 + (i % 8) * 49 + (i < 8 ? 0 : 22), sy: i < 8 ? 424 : 470, ss: i < 8 ? 46 : 50, hx: 20 + r() * 350, hy: 620 + r() * 44, ht: (i % 2 ? 1 : -1) * (1.2 + r() * 0.5) }));
  [...BACK.slice(0, 3), ...BACK.slice(5), ...Array(7).fill("pawn")].forEach((kind, i) => list.push({ kind, white: true, sx: 10 + i * 31, sy: 520 + (i % 2) * 10, ss: 60, hx: 20 + r() * 350, hy: 626 + r() * 40, ht: (i % 2 ? -1 : 1) * (1.2 + r() * 0.5) }));
  return list.sort((a, b) => a.sy - b.sy);
})();
export const HEROES = CAST.filter((c) => c.hero);

/* The arena: the board's floor, with the rest of the set lining its edges. */
const CROWD = (() => {
  const r = rng(301);
  const out = [];
  const kinds = [...BACK, ...Array(8).fill("pawn")];
  for (let i = 0; i < 13; i++) out.push({ kind: kinds[Math.floor(r() * 16)], white: i % 2 === 0, x: 14 + i * 30, y: 482 + (i % 2) * 6, s: 30, ph: r() * 6 });
  for (let i = 0; i < 5; i++) {
    out.push({ kind: kinds[Math.floor(r() * 16)], white: i % 2 === 1, x: 14 - i * 5, y: 520 + i * 44, s: 36 + i * 9, ph: r() * 6 });
    out.push({ kind: kinds[Math.floor(r() * 16)], white: i % 2 === 0, x: W - 14 + i * 5, y: 520 + i * 44, s: 36 + i * 9, ph: r() * 6, facing: -1 });
  }
  return out;
})();
function arena(ctx, t, cheer = 0.25, tint = null) {
  gradient(ctx, [[0, "#120c14"], [0.5, "#2b1a22"], [0.6, "#3a241c"]], 0, 520);
  glow(ctx, W / 2, 150, 420, "rgba(255,196,120,0.9)", 0.35);
  /* Shafts of light from above. */
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.09; ctx.fillStyle = "#ffe2b0";
  for (const x of [70, 195, 320]) { ctx.beginPath(); ctx.moveTo(x - 16, 0); ctx.lineTo(x + 16, 0); ctx.lineTo(x + 90, 520); ctx.lineTo(x - 90, 520); ctx.closePath(); ctx.fill(); }
  ctx.restore();
  /* Pennants strung across, and a torch at either side. */
  const flags = ["#b3272d", "#f5c64a", "#2a6f8f", "#f1e4c6"];
  ctx.strokeStyle = "rgba(0,0,0,0.6)"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-10, 250); ctx.quadraticCurveTo(W / 2, 320, W + 10, 250); ctx.stroke();
  for (let i = 0; i < 13; i++) {
    const u = (i + 0.5) / 13, x = u * (W + 20) - 10, y = 250 + Math.sin(u * Math.PI) * 35, sway = Math.sin(t * 2.4 + i) * 3;
    ctx.fillStyle = flags[i % flags.length]; ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.moveTo(x - 11, y); ctx.lineTo(x + 11, y); ctx.lineTo(x + sway, y + 26); ctx.closePath(); ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (const x of [34, W - 34]) {
    ctx.fillStyle = "#1a0f0c"; ctx.fillRect(x - 4, 372, 8, 130); ctx.fillRect(x - 12, 364, 24, 12);
    const flick = Math.sin(t * 17 + x) * 3;
    glow(ctx, x, 344, 110, "rgba(255,170,70,1)", 0.55 + 0.1 * Math.sin(t * 11 + x));
    ctx.fillStyle = "#ff9a3a"; ctx.beginPath(); ctx.moveTo(x - 11, 364); ctx.quadraticCurveTo(x - 14, 340, x + flick, 314); ctx.quadraticCurveTo(x + 14, 340, x + 11, 364); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#ffe08a"; ctx.beginPath(); ctx.moveTo(x - 5, 364); ctx.quadraticCurveTo(x - 6, 348, x + flick * 0.5, 334); ctx.quadraticCurveTo(x + 6, 348, x + 5, 364); ctx.closePath(); ctx.fill();
  }
  floor(ctx, 500, H + 30, "#e6cfa6", "#8a5229");
  ctx.fillStyle = "#3b2414"; ctx.fillRect(-20, 492, W + 40, 10);
  ctx.fillStyle = "rgba(255,226,170,0.35)"; ctx.fillRect(-20, 492, W + 40, 2);
  gradient(ctx, [[0, "rgba(0,0,0,0.5)"], [1, "rgba(0,0,0,0)"]], 500, 600);
  for (const c of CROWD) {
    const hop = Math.abs(Math.sin(t * 5 + c.ph)) * c.s * 0.28 * cheer;
    drawPiece(ctx, c.kind, c.x, c.y - hop, c.s, { white: c.white, facing: c.facing ?? 1, eyes: 1, arms: 1, pose: cheer > 0.5 ? "up" : "down", look: c.x < W / 2 ? 0.9 : -0.9 });
  }
  if (tint) fill(ctx, tint[0], tint[1]);
}
/* The nearest of the crowd: dark shapes along the bottom edge. */
function frontRow(ctx, t, cheer = 0.25) {
  const r = rng(404);
  for (let i = 0; i < 6; i++) {
    const kind = ["pawn", "rook", "pawn", "bishop", "pawn", "knight"][i];
    const hop = Math.abs(Math.sin(t * 5 + i * 1.3)) * 14 * cheer;
    drawPiece(ctx, kind, 20 + i * 70 + r() * 10, H + 96 - hop, 104, { sil: true, back: true });
  }
}

function plate(ctx, kind, p) {
  const [name, weapon] = LABEL[kind];
  const slide = easeOut(span(p, 0, 0.25)) - easeIn(span(p, 0.8, 1));
  if (slide <= 0) return;
  ctx.save();
  ctx.translate(lerp(-W, 0, slide), 0);
  ctx.transform(1, -0.12, 0, 1, 0, 0);
  ctx.fillStyle = "rgba(8,6,10,0.86)"; ctx.fillRect(-20, 196, W + 40, 92);
  ctx.fillStyle = "#f5c64a"; ctx.fillRect(-20, 196, W + 40, 5); ctx.fillRect(-20, 283, W + 40, 5);
  ctx.textAlign = "left"; ctx.fillStyle = "#fff6dc";
  ctx.font = "italic 900 46px 'Arial Black', Impact, sans-serif";
  ctx.fillText(name, 26, 250);
  ctx.fillStyle = "#f5c64a"; ctx.font = "italic 800 15px 'Arial Black', Impact, sans-serif";
  ctx.fillText(weapon, 30, 274);
  ctx.restore();
}

/* ---------- The duels: each kind shows its attack on its opposite number ---------- */
const HERO_X = 128, FOE_X = 268, RING_Y = 672, SIZE = 108;

function duel(ctx, clock, kind) {
  /* The attack itself runs on `lt`, which starts after the entrance and
     the close-up of their eyes. */
  const lt = clock - LEAD;
  const p = clock / DUEL_S;
  let shake = 0, flash = 0, dark = 0;
  const hero = { x: HERO_X, y: RING_Y, eyes: 1, arms: 1, pose: "hold", weapon: true, weaponAngle: 0.25, mood: lt > 0.7 && lt < 2.4 ? "angry" : undefined, look: 0.9 };
  const foe = { x: FOE_X, y: RING_Y, white: false, facing: -1, eyes: 1, arms: 1, pose: "guard", look: 0.9, alpha: 1 };
  const fx = []; // drawn over the fighters
  const under = []; // drawn under them
  const wind = span(lt, 0.7, 1.1);
  let cheer = lt > 2.3 ? 1 : 0.2;

  if (kind === "pawn") {
    hero.tilt = -0.22 * wind; hero.pose = "raise"; hero.weaponAngle = lerp(0.25, -0.7, wind);
    const dash = easeOut(span(lt, 1.1, 1.3));
    hero.x = lerp(HERO_X, FOE_X + 46, dash);
    if (dash > 0) { hero.tilt = 0.28 * (1 - span(lt, 1.4, 1.9)); hero.weaponAngle = lerp(-0.7, 1.9, dash); hero.pose = "point"; }
    if (lt > 1.1 && lt < 1.36) under.push(() => streaks(ctx, lt, { y0: 470, y1: 720, alpha: 0.8 }));
    const cut = span(lt, 1.14, 1.3), fade = 1 - span(lt, 1.4, 1.9);
    if (cut > 0 && fade > 0) fx.push(() => crescent(ctx, FOE_X - 10, RING_Y - 70, 120, -2.5, lerp(-2.5, 0.7, cut), fade, "#ffffff"));
    flash = 1 - span(lt, 1.2, 1.36); if (lt < 1.2) flash = 0;
    if (lt > 1.2) { const k = lt - 1.2; foe.x = FOE_X + k * 420; foe.y = RING_Y - k * 620 + k * k * 520; foe.tilt = k * 9; foe.mood = "shock"; shake = 9 * (1 - span(lt, 1.2, 1.6)); }
  } else if (kind === "knight") {
    hero.pose = "guard"; hero.squashY = 1 - 0.26 * wind * (1 - span(lt, 1.1, 1.16));
    const up = easeOut(span(lt, 1.1, 1.4)), down = easeIn(span(lt, 1.62, 1.76));
    if (lt > 1.1 && lt < 1.76) { hero.x = lerp(HERO_X, FOE_X, span(lt, 1.1, 1.62)); hero.y = lerp(RING_Y, -220, up) + (down ? (RING_Y + 220) * down : 0); hero.squashY = 1.3; hero.pose = "raise"; }
    if (lt > 1.3 && lt < 1.76) under.push(() => { ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.beginPath(); ctx.ellipse(FOE_X, RING_Y + 6, 30 + span(lt, 1.3, 1.76) * 60, 9 + span(lt, 1.3, 1.76) * 12, 0, 0, Math.PI * 2); ctx.fill(); });
    if (lt >= 1.76) {
      hero.x = FOE_X; hero.pose = "point";
      const k = span(lt, 1.76, 2.3);
      flash = 1 - span(lt, 1.76, 1.92); shake = 16 * (1 - span(lt, 1.76, 2.2));
      foe.squashY = lerp(0.14, 0.14, k); foe.squashX = 1.5; foe.alpha = 1 - span(lt, 1.95, 2.3); foe.mood = "shock";
      under.push(() => { for (let i = 0; i < 3; i++) { const q = clamp(k * 1.4 - i * 0.18); if (q <= 0 || q >= 1) continue; ctx.strokeStyle = `rgba(255,236,190,${1 - q})`; ctx.lineWidth = 9 * (1 - q); ctx.beginPath(); ctx.ellipse(FOE_X, RING_Y + 4, 40 + q * 260, 10 + q * 60, 0, 0, Math.PI * 2); ctx.stroke(); } });
      fx.push(() => { const r = rng(8); ctx.fillStyle = "#3b2414"; for (let i = 0; i < 14; i++) { const a = -Math.PI * r(), d = k * (120 + r() * 220); ctx.save(); ctx.translate(FOE_X + Math.cos(a) * d, RING_Y + Math.sin(a) * d + k * k * 190); ctx.rotate(k * 9 * r()); ctx.globalAlpha = 1 - k; ctx.fillRect(-7, -7, 14, 14); ctx.restore(); } });
    }
  } else if (kind === "bishop") {
    hero.pose = "guard"; hero.weaponAngle = lerp(0.25, 2.2, wind); hero.squashY = 1 - 0.1 * wind;
    const gone = lt >= 1.1;
    if (gone) { hero.x = FOE_X + 70; hero.facing = 1; hero.pose = "point"; hero.weaponAngle = lt < 1.9 ? 1.35 : lerp(1.35, 2.6, span(lt, 1.9, 2.2)); }
    if (lt >= 1.1 && lt < 1.26) fx.push(() => { for (let i = 0; i < 5; i++) drawPiece(ctx, "bishop", lerp(HERO_X, FOE_X + 70, i / 5), RING_Y, SIZE, { white: true, alpha: 0.16 + i * 0.05, eyes: 1, arms: 1, pose: "point", weapon: true, weaponAngle: 1.35 }); });
    const line = span(lt, 1.1, 1.16);
    if (line > 0 && lt < 2.0) fx.push(() => { ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.strokeStyle = "#fff"; ctx.lineWidth = lt < 1.2 ? 9 : 2.2; ctx.beginPath(); ctx.moveTo(lerp(20, 20, line), 728); ctx.lineTo(lerp(20, 380, line), 560); ctx.stroke(); ctx.restore(); });
    flash = lt >= 1.1 ? 1 - span(lt, 1.1, 1.2) : 0;
    dark = lt >= 1.16 && lt < 1.8 ? 0.62 : 0;
    if (lt >= 1.8) { flash = Math.max(flash, 1 - span(lt, 1.8, 1.9)); foe.split = span(lt, 1.8, 2.5); foe.mood = "shock"; }
  } else if (kind === "rook") {
    const twirl = lt > 0.7 && lt < 1.3;
    hero.weaponAngle = twirl ? lt * 26 : Math.PI / 2;
    if (lt <= 0.7) hero.weaponAngle = 0.25;
    if (twirl) fx.push(() => { ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(HERO_X + 0.46 * SIZE, RING_Y - 0.74 * SIZE, SIZE * 0.95, 0, Math.PI * 2); ctx.stroke(); });
    const charge = easeIn(span(lt, 1.3, 1.55));
    hero.x = lerp(HERO_X, W + 190, charge); hero.tilt = 0.22 * span(lt, 1.3, 1.4); hero.pose = "point";
    if (lt > 1.3 && lt < 1.75) under.push(() => streaks(ctx, lt, { y0: 440, y1: 740, alpha: 0.85 }));
    if (hero.x > FOE_X - 96) { foe.x = hero.x + 96; foe.tilt = 0.5; foe.mood = "shock"; shake = 10 * (1 - span(lt, 1.42, 1.9)); if (lt < 1.5) flash = 0.8; }
    if (lt > 1.4 && lt < 2.2) under.push(() => { const r = rng(12); for (let i = 0; i < 9; i++) { const q = clamp((lt - 1.4) * 1.4 - i * 0.05); ctx.fillStyle = `rgba(214,190,160,${0.5 * (1 - q)})`; ctx.beginPath(); ctx.arc(FOE_X - 60 + i * 34 + r() * 20, RING_Y - 8 - q * 40, 16 + q * 34, 0, Math.PI * 2); ctx.fill(); } });
    if (lt > 2.2) { hero.x = lerp(-140, HERO_X, easeOut(span(lt, 2.2, 2.7))); hero.tilt = 0; hero.weaponAngle = 0.1; hero.pose = "hold"; foe.alpha = 0; }
  } else if (kind === "queen") {
    hero.pose = "raise"; hero.weaponAngle = lerp(0.25, -0.15, wind); hero.charge = span(lt, 0.7, 1.2);
    dark = 0.6 * span(lt, 0.7, 1.2) * (1 - span(lt, 2.2, 2.6));
    for (const [at, seed] of [[1.2, 3], [1.42, 9], [1.64, 21]]) {
      if (lt >= at && lt < at + 0.16) { fx.push(() => bolt(ctx, FOE_X + (seed - 10) * 4, -20, FOE_X, RING_Y - 70, seed, 6)); flash = Math.max(flash, 0.75); shake = 12; foe.sil = true; }
    }
    if (lt >= 1.2) { foe.mood = "shock"; foe.tilt = Math.sin(lt * 60) * 0.06 * (1 - span(lt, 1.8, 2.0)); foe.char = span(lt, 1.2, 1.8); }
    const blink = span(lt, 1.9, 2.0), back = span(lt, 2.0, 2.1);
    if (lt >= 1.9) { hero.alpha = lt < 2.0 ? 1 - blink : back; hero.x = lt < 2.0 ? HERO_X : FOE_X + 96; hero.facing = lt < 2.0 ? 1 : -1; hero.pose = "point"; hero.weaponAngle = 1.2; hero.charge = 0.3; }
    if (lt >= 1.9 && lt < 2.2) fx.push(() => { for (const x of [HERO_X, FOE_X + 96]) star(ctx, x, RING_Y - 90, 60 * Math.sin(span(lt, 1.9, 2.2) * Math.PI), "#bff3ff"); });
    if (lt >= 2.2) { foe.squashY = 1 - 0.85 * span(lt, 2.2, 2.5); foe.alpha = 1 - span(lt, 2.3, 2.6); }
  } else {
    /* The king: no weapon. One finger, drawn slowly across his own neck. */
    hero.weapon = false; hero.pose = "down";
    dark = 0.72 * span(lt, 0.7, 1.1) * (1 - span(lt, 2.5, 2.9));
    hero.x = lerp(HERO_X, HERO_X + 34, span(lt, 0.7, 1.2));
    const drawAcross = span(lt, 1.3, 1.95);
    if (lt >= 1.1) { hero.hands = [[lerp(0.42, lerp(-0.2, 0.34, drawAcross), span(lt, 1.1, 1.3)), lerp(0.5, 1.07, span(lt, 1.1, 1.3))], [-0.36, 0.4]]; hero.mood = "angry"; }
    if (drawAcross > 0 && lt < 2.6) fx.push(() => { ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.strokeStyle = "#ff3a2a"; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(hero.x - 0.2 * SIZE, RING_Y - 1.07 * SIZE); ctx.lineTo(hero.x + lerp(-0.2, 0.34, drawAcross) * SIZE, RING_Y - 1.07 * SIZE); ctx.stroke(); ctx.restore(); glow(ctx, hero.x, RING_Y - 1.07 * SIZE, 90, "rgba(255,40,20,0.9)", 0.35); });
    if (lt >= 1.95) { foe.tilt = -1.52 * easeIn(span(lt, 1.95, 2.5)); foe.mood = "shock"; foe.eyes = 1 - span(lt, 2.2, 2.5); if (lt < 2.05) flash = 0.5; shake = lt > 2.45 && lt < 2.7 ? 8 : 0; }
  }
  if (lt > 2.3 && kind !== "king") hero.pose = "up";
  if (lt > 2.3) hero.y -= Math.abs(Math.sin((lt - 2.3) * 7)) * 16 * (1 - span(lt, 3.2, 3.9));
  /* They stride in from either side. */
  if (clock < 0.6) { const k = easeOut(clock / 0.55); hero.x = lerp(-110, HERO_X, k); foe.x = lerp(W + 110, FOE_X, k); }
  const impact = lt >= HIT[kind] && lt < HIT[kind] + 0.09;
  if (impact) flash = 0;

  ctx.save();
  if (shake) ctx.translate(jx(clock, shake), jy(clock, shake));
  /* Close on the two of them. */
  ctx.translate(W / 2, 640); ctx.scale(ZOOM, ZOOM); ctx.translate(-W / 2, -640);
  arena(ctx, lt, cheer);
  if (dark) fill(ctx, kind === "king" ? "#1a0204" : "#05060c", dark);
  if (lt > 0.7 && lt < 1.1) speedLines(ctx, hero.x, RING_Y - 70, { inner: 150, alpha: 0.35 * wind, seed: 2 + Math.floor(lt * 20), color: "#fff6dc" });
  under.forEach((f) => f());
  /* The one being struck. */
  if (foe.alpha > 0) {
    if (foe.split != null) {
      /* Cut in two: the top half slides away along the cut. */
      for (const top of [true, false]) {
        ctx.save();
        ctx.beginPath();
        if (top) { ctx.moveTo(0, 0); ctx.lineTo(W, 0); ctx.lineTo(W, RING_Y - 96); ctx.lineTo(0, RING_Y - 40); }
        else { ctx.moveTo(0, H); ctx.lineTo(W, H); ctx.lineTo(W, RING_Y - 96); ctx.lineTo(0, RING_Y - 40); }
        ctx.closePath(); ctx.clip();
        const k = foe.split;
        drawPiece(ctx, kind, foe.x + (top ? k * 70 : 0), foe.y - (top ? k * 26 - k * k * 210 : 0), SIZE, { ...foe, tilt: top ? k * 0.9 : 0, alpha: top ? 1 - k * 0.6 : 1 - span(k, 0.5, 1) });
        ctx.restore();
      }
    } else {
      drawPiece(ctx, kind, foe.x, foe.y, SIZE, foe);
      if (foe.char) { ctx.save(); ctx.globalAlpha = foe.char * 0.75 * foe.alpha; drawPiece(ctx, kind, foe.x, foe.y, SIZE, { ...foe, sil: true, eyes: 1 }); ctx.restore(); }
    }
  }
  drawPiece(ctx, kind, hero.x, hero.y, SIZE, { white: true, ...hero });
  fx.forEach((f) => f());
  if (impact) {
    /* The impact frame: black, white lines bursting from the blow, the two
       of them cut out in light. */
    fill(ctx, "#000");
    speedLines(ctx, foe.x, RING_Y - 60, { inner: 74, outer: 640, color: "#fff", alpha: 1, seed: 4, width: 18 });
    drawPiece(ctx, kind, foe.x, foe.y, SIZE, { ...foe, sil: true, mood: "shock" });
    drawPiece(ctx, kind, hero.x, hero.y, SIZE, { white: true, ...hero, sil: true });
  }
  frontRow(ctx, lt, cheer);
  /* Dust where they skid in. */
  if (clock < 0.9) { const k = clock / 0.9; for (const [x, dir] of [[HERO_X, -1], [FOE_X, 1]]) for (let i = 0; i < 4; i++) { ctx.fillStyle = `rgba(226,204,170,${0.5 * (1 - k)})`; ctx.beginPath(); ctx.arc(x + dir * (20 + i * 16 + k * 40), RING_Y - 6 - k * 24 - i * 4, 9 + k * 16 + i * 2, 0, Math.PI * 2); ctx.fill(); } }
  ctx.restore();
  /* The winner's moment: confetti from above. */
  if (lt > 2.3) {
    const r = rng(77);
    for (let i = 0; i < 46; i++) {
      const x = r() * W, sp = 190 + r() * 220, y = ((lt - 2.3) * sp - r() * 500);
      if (y < 60 || y > H) { r(); continue; }
      ctx.save(); ctx.translate(x + Math.sin(lt * 3 + i) * 14, y); ctx.rotate(lt * 6 * (r() - 0.5) + i);
      ctx.fillStyle = CONFETTI[i % CONFETTI.length]; ctx.globalAlpha = 1 - span(lt, 3.3, 3.9);
      ctx.fillRect(-5, -3, 10, 6); ctx.restore();
    }
  }
  if (flash > 0) fill(ctx, "#fff", flash);
  /* Before the blow: a band across the screen, their eyes locked. */
  const cutIn = span(clock, 0.72, 0.86) * (1 - span(clock, 1.34, 1.48));
  if (cutIn > 0) {
    const half = 78 * cutIn, mid = 392, big = 300;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, mid - half, W, half * 2); ctx.clip();
    fill(ctx, "#0c070a");
    streaks(ctx, clock, { y0: mid - 90, y1: mid + 90, color: "#f5c64a", alpha: 0.45, seed: 7, n: 30 });
    drawPiece(ctx, kind, 96 - (1 - cutIn) * 80, mid + FACE[kind][1] * big, big, { white: true, eyes: 1, mood: "angry", look: 0.9 });
    drawPiece(ctx, kind, 294 + (1 - cutIn) * 80, mid + FACE[kind][1] * big, big, { white: false, facing: -1, eyes: 1, mood: "angry", look: 0.9 });
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.moveTo(203, mid - 90); ctx.lineTo(209, mid - 90); ctx.lineTo(187, mid + 90); ctx.lineTo(181, mid + 90); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#f5c64a"; ctx.fillRect(0, mid - half - 4, W, 4); ctx.fillRect(0, mid + half, W, 4);
  }
  plate(ctx, kind, clamp(clock / 1.25));
  return p;
}

function crescent(ctx, x, y, r, a0, a1, alpha, color) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, a0, a1);
  ctx.arc(x - r * 0.18, y + r * 0.06, r * 0.82, a1, a0, true);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

const LEAD = 1.2, DUEL_S = 3.9 + LEAD, ZOOM = 1.42;
/* When each attack lands, on the attack's own clock: one black frame of
   pure impact before the flash. */
const HIT = { pawn: 1.2, knight: 1.76, bishop: 1.1, rook: 1.42, queen: 1.2, king: 1.95 };
const CONFETTI = ["#f5c64a", "#f05348", "#3ee7f5", "#fff6dc", "#7fd66b"];

/* ---------- The shots ---------- */
/* Seasons through the attic window: night, dawn, noon, rain, snow, night. */
const SKIES = ["#1b2c55", "#e58a4a", "#bcd8f2", "#55657a", "#dfe8f4", "#152246"];
function mix(a, b, t) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `rgb(${pa.map((v, i) => Math.round(lerp(v, pb[i], t))).join(",")})`;
}

function heroLook(t, i) {
  const blink = (t * 0.37 + i * 0.19) % 1 > 0.94 ? 0.1 : 1;
  return { eyes: blink, look: 0, arms: 1, pose: "down" };
}

/* A camera shake that moves smoothly, so it reads as a shake and not as
   frames being dropped. */
const jx = (t, a) => a * 0.5 * (Math.sin(t * 61) * 0.6 + Math.sin(t * 37.3) * 0.4);
const jy = (t, a) => a * 0.5 * (Math.sin(t * 53.7 + 1) * 0.6 + Math.sin(t * 29.1 + 2) * 0.4);

const travelAt = (lt) => 150 * (Math.min(lt, 8.6) + (lt > 8.6 ? (1 - (1 - clamp((lt - 8.6) / 0.7)) ** 2) * 0.35 : 0));

export const SHOTS = {
  /* 1. Years on a shelf, while the seasons go by in the window. */
  attic: {
    dur: 10, next: "found", cues: [[0.2, "drone", 0.5], ...Array.from({ length: 9 }, (_, i) => [1 + i, "tick", 0.18]), [3.4, "creak", 0.25], [6.8, "creak", 0.2]],
    draw(ctx, lt) {
      const season = clamp(lt / 8.6) * 5, i = Math.min(4, Math.floor(season));
      const zoom = 1 + 0.1 * ease(lt / 10);
      ctx.save(); ctx.translate(W / 2, 620); ctx.scale(zoom, zoom); ctx.translate(-W / 2, -620);
      attic(ctx, lt, { sky: mix(SKIES[i], SKIES[i + 1], season - i), season, beam: 0.55 + 0.45 * Math.sin(season * 2) });
      drawSet(ctx, W / 2, 648, 40, { dust: 0.3 + 0.7 * clamp(lt / 6) });
      drawWebs(ctx, W / 2, 648, 40, clamp(lt / 7.5));
      motes(ctx, lt, 40, 3, { x0: 20, x1: 300, y0: 180, y1: 700, rise: 3, color: "rgba(214,226,255,0.8)" });
      ctx.restore();
      fill(ctx, "#000", 1 - span(lt, 0, 1.4));
    },
  },
  /* 2. Found: a door opens, a man comes in, and for a moment, hope. */
  found: {
    dur: 7.4, next: "hands", cues: [[0.05, "creak", 0.9], [1.5, "step", 0.5], [2.0, "step", 0.55], [2.5, "step", 0.6], [3.0, "step", 0.65], [3.5, "step", 0.7], [4.2, "heartbeat", 0.8], [4.4, "shimmer", 0.8], [4.6, "aww", 0.35]],
    draw(ctx, lt) {
      const door = ease(lt / 1.5), walk = ease(span(lt, 1.3, 3.9)), hope = span(lt, 4.2, 5.4), reach = ease(span(lt, 6.0, 7.2));
      ctx.save(); ctx.translate(W / 2, 620); ctx.scale(1.1, 1.1); ctx.translate(-W / 2, -620);
      attic(ctx, lt, { sky: SKIES[5], season: 5, beam: 0.4 });
      /* The door at the back of the room swings open on warm light. */
      const dg = ctx.createLinearGradient(0, 262, 0, 648); dg.addColorStop(0, "#ffe6b0"); dg.addColorStop(1, "#ff9a4a");
      ctx.fillStyle = dg; ctx.fillRect(98, 262, 116, 386);
      ctx.fillStyle = "#1a1210"; ctx.fillRect(98 + 116 * door, 262, 116 * (1 - door), 386);
      ctx.strokeStyle = "#05060a"; ctx.lineWidth = 8; ctx.strokeRect(94, 258, 124, 394);
      glow(ctx, 156, 440, 320, "rgba(255,170,90,0.9)", 0.3 * door);
      /* Its light across the floor, and the man in it. */
      ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.4 * door;
      const g = ctx.createLinearGradient(0, 640, 0, 880); g.addColorStop(0, "#ffb866"); g.addColorStop(1, "rgba(255,150,60,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(98, 648); ctx.lineTo(214, 648); ctx.lineTo(470, 880); ctx.lineTo(-170, 880); ctx.closePath(); ctx.fill();
      ctx.restore();
      if (lt > 0.7) {
        ctx.save(); ctx.globalAlpha = span(lt, 0.7, 1.2);
        drawMan(ctx, lerp(150, 96, walk), lerp(650, 838, walk), lerp(88, 196, walk), { step: lt * 5 * (walk < 1 ? 1 : 0), lean: hope * 0.5 + reach * 0.6, hold: reach, rim: "rgba(255,190,120,0.7)", color: "#0a0705", detail: "#20140d" });
        ctx.restore();
      }
      drawSet(ctx, W / 2, 648, 40, { dust: 1 - 0.5 * hope, warm: 0.9 * door, sparkle: hope * (1 - span(lt, 6.4, 7.2)), t: lt });
      drawWebs(ctx, W / 2, 648, 40, 1);
      motes(ctx, lt, 60, 3, { x0: 0, x1: 380, y0: 160, y1: 700, rise: 5 + 30 * hope, color: "rgba(255,226,170,0.9)" });
      ctx.restore();
    },
  },
  /* 3. His hands close on it. It is lifted from the shelf. */
  hands: {
    dur: 5, next: "carry", cues: [[0.5, "cloth2", 0.8], [1.3, "tap", 0.4], [1.9, "scrape", 0.9], [2.2, "crack", 0.35], [2.4, "ooh", 0.3], [2.6, "land", 0.3]],
    draw(ctx, lt) {
      const grip = easeOut(span(lt, 0.2, 1.4)), lift = ease(span(lt, 1.9, 4.2));
      const y = 656 - lift * 290, shudder = lt > 1.4 && lt < 2.6 ? 0.05 : 0.012 * lift;
      ctx.save(); ctx.translate(0, lift * 330);
      ctx.save(); ctx.translate(W / 2, 620); ctx.scale(1.18, 1.18); ctx.translate(-W / 2, -620);
      attic(ctx, lt, { sky: SKIES[5], season: 5, beam: 0.3 });
      ctx.restore();
      ctx.restore();
      fill(ctx, "#ffb866", 0.1);
      glow(ctx, W / 2, 300, 360, "rgba(255,170,90,0.9)", 0.28);
      const manY = 1210 - lift * 60;
      drawMan(ctx, W / 2 - 14, manY, 440, { arms: false, rim: "rgba(255,190,120,0.75)", color: "#0a0705", detail: "#1d130d" });
      ctx.save(); ctx.translate(jx(lt, lt > 1.8 && lt < 2.4 ? 5 : 0), 0);
      drawSet(ctx, W / 2, y, 34, { dust: 0.3, warm: 0.8, wobble: shudder, t: lt });
      drawWebs(ctx, W / 2, y, 34, 1, span(lt, 2.0, 3.0));
      /* His hands, seen from the front: his arms come down from his
         shoulders behind the set, and each hand closes on one end of the
         board, thumb on top, fingers curled under. */
      const skin = "#e3b490", shade = "#c08c68", ink = "#3a2416";
      for (const side of [-1, 1]) {
        const ex = W / 2 + side * 157;             // the end of the board
        const reach = 1 - grip;                    // 1 hand still out at the side
        const hx = ex + side * (12 + reach * 90), hy = y - 4 - reach * 80;
        const sx = W / 2 - 14 + side * 118, sy = manY - 440 * 1.82; // his shoulder, behind the set
        ctx.save();
        ctx.lineCap = "round"; ctx.lineJoin = "round";
        /* Sleeve and forearm, from the shoulder to the wrist. */
        const wx = hx + side * 22, wy = hy - 44;
        /* Upper arm out to the elbow, forearm in to the board. */
        const elx = sx + side * 34, ely = (sy + wy) / 2 + 10;
        ctx.strokeStyle = "#0a0705"; ctx.lineWidth = 42;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(elx, ely); ctx.lineTo(wx + side * 4, wy - 26); ctx.stroke();
        ctx.strokeStyle = "rgba(255,190,120,0.55)"; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(sx + side * 21, sy); ctx.lineTo(elx + side * 21, ely); ctx.lineTo(wx + side * 25, wy - 26); ctx.stroke();
        ctx.translate(hx, hy); ctx.scale(1.35, 1.35); ctx.translate(-hx, -hy);
        ctx.strokeStyle = "#2a1c16"; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(wx + side * 6 - 30, wy - 44); ctx.lineTo(wx + side * 6 + 30, wy - 16); ctx.stroke();
        ctx.strokeStyle = skin; ctx.lineWidth = 34;
        ctx.beginPath(); ctx.moveTo(wx + side * 4, wy - 24); ctx.lineTo(wx, wy); ctx.stroke();
        /* The hand: the back of it, wrapped round the end of the board. */
        ctx.fillStyle = skin; ctx.strokeStyle = ink; ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(wx - 20, wy - 4);
        ctx.quadraticCurveTo(hx + side * 34, hy - 30, hx + side * 30, hy + 4);
        ctx.quadraticCurveTo(hx + side * 26, hy + 36, hx - side * 4, hy + 40);
        ctx.quadraticCurveTo(hx - side * 18, hy + 30, hx - side * 14, hy + 14);
        ctx.quadraticCurveTo(hx - side * 10, hy - 14, wx + 20, wy + 4);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = shade;
        ctx.beginPath(); ctx.moveTo(hx + side * 30, hy + 4); ctx.quadraticCurveTo(hx + side * 26, hy + 36, hx - side * 4, hy + 40); ctx.quadraticCurveTo(hx + side * 14, hy + 22, hx + side * 30, hy + 4); ctx.fill();
        /* Fingers curled under the board: knuckles showing below it. */
        ctx.fillStyle = skin;
        for (let i = 0; i < 4; i++) {
          const kx = hx - side * (2 + i * 12) * grip + side * 8 * (1 - grip), ky = hy + 30 + i * 2;
          ctx.beginPath(); ctx.ellipse(kx, ky, 8, 10, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
        /* The thumb, laid along the top of the board toward the pieces. */
        const tx = hx - side * (18 + 26 * grip), ty = hy - 10;
        ctx.beginPath();
        ctx.moveTo(hx + side * 6, hy - 16);
        ctx.quadraticCurveTo((hx + tx) / 2, hy - 30, tx, ty - 6);
        ctx.quadraticCurveTo(tx - side * 8, ty + 2, tx, ty + 6);
        ctx.quadraticCurveTo((hx + tx) / 2, hy - 8, hx - side * 4, hy - 2);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#f4d6be"; ctx.beginPath(); ctx.ellipse(tx + side * 3, ty, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      ctx.restore();
      motes(ctx, lt, 70, 6, { rise: 40 * lift + 6, color: "rgba(255,226,170,0.85)" });
      fill(ctx, "#000", span(lt, 4.4, 5));
    },
  },
  /* 4. Carried down the hall, out of the door and along the street at dusk. */
  carry: {
    dur: 9.6, next: "toss", wind: 0.5, cues: [...Array.from({ length: 15 }, (_, i) => [0.3 + i * 0.58, i < 6 ? "step" : "land", 0.4]), [2.4, "creak", 0.6], [3.6, "chirp", 0.6], [5.2, "chirp", 0.5], [8.8, "meow", 0.35]],
    draw(ctx, lt) {
      const travel = travelAt(lt), stop = span(lt, 8.6, 9.3);
      const wall = 520 - travel; // the front wall of the house, with its door
      street(ctx, lt, Math.max(0, travel - 520));
      if (wall > -80) {
        ctx.save(); ctx.beginPath(); ctx.rect(-20, 0, wall + 20, H); ctx.clip();
        hallway(ctx, lt, travel);
        ctx.restore();
        ctx.fillStyle = "#070505"; ctx.fillRect(wall, 0, 70, 250); ctx.fillRect(wall, 0, 16, 642); ctx.fillRect(wall + 54, 0, 16, 642);
      }
      const ax = lerp(W + 320, 296, easeOut(span(lt, 7.2, 9.0)));
      if (ax < W + 300) alley(ctx, lt, ax, 0);
      const step = lt * 6.2 * (1 - stop), outside = wall < 120;
      const hand = drawMan(ctx, 138, 642, 96, { step, hold: 1, rim: outside ? "rgba(255,170,90,0.65)" : "rgba(255,200,140,0.35)" });
      carried(ctx, hand.hx + 26, hand.hy - 10, 30, Math.sin(step) * 0.04, step);
      fill(ctx, "#000", 1 - span(lt, 0, 0.6));
    },
  },
  /* 5. Thrown away. The moment hangs; the lid comes down; he walks off. */
  toss: {
    dur: 9, next: "dark", wind: 0.5, cues: [[0.5, "swish", 1], [0.95, "whoom", 0.9], [1.0, "heartbeat", 0.7], [1.9, "heartbeat", 0.7], [3.3, "land", 0.9], [3.4, "metal", 0.6], [3.55, "landHeavy", 0.8], [3.7, "land", 0.6], [4.2, "tap", 0.9], [4.45, "tap", 0.6], [4.62, "land", 0.7], [5.0, "punchHeavy", 1], [5.02, "metal", 0.9], [5.05, "crack", 0.8], [5.15, "meow", 0.8], [6.0, "step", 0.4], [6.6, "step", 0.35], [7.2, "step", 0.3], [7.8, "step", 0.2]],
    draw(ctx, lt) {
      const back = easeOut(span(lt, 0, 0.4)), swing = easeOut(span(lt, 0.45, 0.85));
      const slow = lt > 0.9 && lt < 3.1; // the moment hangs in the air
      const lid = easeIn(span(lt, 4.6, 5.0)), slam = lt >= 5.0;
      const leave = span(lt, 5.8, 8.6), push = 1 + 0.4 * ease(span(lt, 5.6, 8.6));
      ctx.save();
      if (slam && lt < 5.6) ctx.translate(jx(lt, 22 * (1 - span(lt, 5.0, 5.6))), jy(lt, 22 * (1 - span(lt, 5.0, 5.6))));
      ctx.translate(296, 560); ctx.scale(push, push); ctx.translate(-296, -560);
      street(ctx, lt, travelAt(99) - 520);
      alley(ctx, lt, 296, lid, slam ? 1 - span(lt, 5.0, 5.8) : 0);
      /* The man: winds up, throws, watches, dusts his hands, walks away. */
      if (leave <= 0) drawMan(ctx, 138, 642, 96, { hold: 1, swing: swing - back * 0.25 * (1 - swing), lean: swing * 0.4 });
      else { ctx.save(); ctx.translate(138 - leave * 300, 0); ctx.scale(-1, 1); drawMan(ctx, 0, 642, 96, { step: lt * 6 }); ctx.restore(); }
      if (lt < 0.9) {
        const k = span(lt, 0.5, 0.9);
        carried(ctx, lerp(238 - back * 20, 262, k), lerp(486 + back * 14, 390, k), 30, -k * 1.1 + back * 0.2 * (1 - k), lt * 9);
      } else if (!slow && lt < 4.0) {
        /* Into the bin they go, one after another. */
        for (let i = 0; i < 9; i++) {
          const k = clamp((lt - 3.1 - i * 0.07) / 0.6);
          if (k <= 0 || k >= 1) continue;
          drawPiece(ctx, KINDS[i % 6], lerp(250 + (i - 4) * 16, 296 + (i - 4) * 5, k), lerp(330 - i * 10, 520, k * k), 34, { sil: true, tilt: k * 7 + i });
        }
      }
      /* One pawn catches the rim, teeters, and drops in. */
      if (lt >= 3.7 && lt < 4.6) { const k = (lt - 3.7) / 0.9; drawPiece(ctx, "pawn", 262 + k * 16, k < 0.45 ? lerp(380, 492, (k / 0.45) ** 2) : 492 - Math.sin((k - 0.45) / 0.55 * Math.PI) * 30 + (k > 0.8 ? (k - 0.8) * 260 : 0), 34, { sil: true, tilt: k < 0.45 ? k * 5 : Math.sin(k * 20) * 0.4 }); }
      if (slam) {
        const k = span(lt, 5.0, 5.5);
        speedLines(ctx, 296, 500, { inner: 60 + k * 120, alpha: 0.9 * (1 - k), seed: 5, color: "#fff", width: 14 });
      }
      ctx.restore();
      if (slow) {
        /* Mid-air, in slow motion: the pieces tumble past, close. */
        const k = (lt - 0.9) / 2.2;
        fill(ctx, "#150a1e", 0.8 * Math.sin(k * Math.PI) ** 0.4);
        speedLines(ctx, W / 2, H * 0.45, { inner: 190, alpha: 0.5, seed: 1 + Math.floor(lt * 14), color: "#ffd9a0" });
        const r = rng(19);
        KINDS.concat(["pawn", "rook", "pawn"]).forEach((kind, i) => {
          const x = 40 + r() * 310, y0 = -120 - r() * 520, spin = (r() - 0.5) * 5;
          drawPiece(ctx, kind, x + Math.sin(k * 2 + i) * 20, y0 + k * 1250, 86 + r() * 60, { white: i % 3 !== 1, tilt: spin * k * 2 + i, alpha: 0.96 });
        });
        fill(ctx, "#fff", 1 - span(lt, 0.9, 1.08));
      }
      if (lt >= 3.1 && lt < 3.3) fill(ctx, "#fff", 0.6 * (1 - span(lt, 3.1, 3.3)));
      if (slam) fill(ctx, "#fff", 0.9 * (1 - span(lt, 5.0, 5.16)));
      fill(ctx, "#000", span(lt, 8.0, 9));
    },
  },
  /* 6. Dark. */
  dark: { dur: 1.8, next: "inside", cues: [[0.2, "bell", 0.25]], draw(ctx) { fill(ctx, "#000"); } },
  /* 7. A crack of light; the narrator. The player can tap each line on. */
  inside: {
    dur: 23, next: "awaken", cues: [[0.3, "crack", 0.6], [0.5, "shimmer", 0.4], [1.5, "drone", 0.8], [8, "drone", 0.7], [14.5, "drone", 0.7]], beats: [2.6, 7.6, 12.6, 17.6, 22.4],
    line: (lt) => { const i = [2.6, 7.6, 12.6, 17.6].findLastIndex((at) => lt >= at); return i >= 0 && lt < [7.2, 12.2, 17.2, 22.2][i] ? { text: NARRATOR[i], who: "narrator" } : null; },
    draw(ctx, lt) {
      const open = easeOut(lt / 3.2), push = 1 + 0.1 * ease(lt / 23);
      ctx.save(); ctx.translate(W / 2, 620); ctx.scale(push, push); ctx.translate(-W / 2, -620);
      inside(ctx, lt, open);
      /* Where they fell, on their sides: dim shapes, lit a little as the light comes. */
      washed(ctx, (c) => { for (const p of CAST) drawPiece(c, p.kind, p.hx, p.hy, p.ss, { white: p.white, tilt: p.ht }); }, "#04050a", 0.86 - 0.3 * open);
      ctx.restore();
    },
  },
  /* 8. They wake: a rumble, a glow, they rise; eyes; arms. */
  awaken: {
    dur: 9.2, next: "ask1", cues: [[0.1, "rumble", 0.7], [0.15, "scrape", 0.9], [1.6, "shimmer", 0.9], [1.8, "drone", 0.6], [4.5, "squeak", 0.7], [4.75, "squeak", 0.7], [5.0, "squeak", 0.7], [5.25, "squeak", 0.7], [5.5, "squeak", 0.7], [5.75, "squeak", 0.8], [5.9, "ooh", 0.4], [6.6, "cloth1", 0.8], [6.8, "cloth2", 0.6], [7.6, "chime", 0.6], [7.8, "cheer", 0.35]],
    draw(ctx, lt) {
      const rumble = lt < 3.6 ? 5 * (1 - span(lt, 2.4, 3.6)) : 0;
      ctx.save(); ctx.translate(jx(lt, rumble), jy(lt, rumble));
      inside(ctx, lt + 23, 1);
      const lit = span(lt, 2.6, 4.2);
      glow(ctx, W / 2, 600, 380, "rgba(255,200,110,1)", 0.5 * Math.sin(clamp(lt / 4.6) * Math.PI));
      if (lt > 1.2 && lt < 5.4) { ctx.save(); ctx.globalAlpha = Math.sin(clamp((lt - 1.2) / 4.2) * Math.PI); motes(ctx, lt, 60, 14, { y0: 260, y1: 700, rise: 90, color: "rgba(255,214,130,0.95)", size: 2.2 }); ctx.restore(); }
      CAST.forEach((c, i) => {
        const up = ease(span(lt, 1.4 + (i % 9) * 0.12, 3.0 + (i % 9) * 0.12));
        const x = lerp(c.hx, c.sx, up), y = lerp(c.hy, c.sy, up) - Math.sin(up * Math.PI) * 70;
        const tilt = lerp(c.ht, 0, up);
        const hi = HEROES.indexOf(c);
        const eyes = hi >= 0 ? pop(span(lt, 4.5 + hi * 0.25, 4.75 + hi * 0.25)) : pop(span(lt, 5.4 + (i % 7) * 0.1, 5.7 + (i % 7) * 0.1));
        const arms = pop(span(lt, 6.6 + (i % 6) * 0.08, 7.0 + (i % 6) * 0.08));
        const o = { tilt, eyes: clamp(eyes, 0, 1.2), arms: clamp(arms, 0, 1.15), pose: "down", look: 0, aura: 0.7 * Math.sin(up * Math.PI), white: c.white };
        drawPiece(ctx, c.kind, x, y, c.ss, { ...o, sil: true });
        if (lit > 0) drawPiece(ctx, c.kind, x, y, c.ss, { ...o, alpha: lit * (c.hero ? 1 : 0.8), aura: 0 });
        if (hi >= 0) { const g = span(lt, 4.5 + hi * 0.25, 4.62 + hi * 0.25) * (1 - span(lt, 4.62 + hi * 0.25, 4.95 + hi * 0.25)); if (g > 0) star(ctx, x, y - c.ss * HEIGHT[c.kind] * 0.75, 70 * g, "#fff6d8"); }
      });
      ctx.restore();
    },
  },
  /* 9. "Will you bond with us?" */
  ask1: { wait: "ask", next: "bonded", no: "huddle", draw(ctx, lt) { crowd(ctx, lt, (c, i, t) => heroLook(t, i)); } },
  /* No: a huddle, and a plan. */
  huddle: {
    dur: 4.6, next: "beg", cues: [[0.2, "cloth1", 0.6], [0.9, "whisper", 0.9], [2.9, "cloth2", 0.5]],
    draw(ctx, lt) {
      const inn = ease(span(lt, 0, 1)), peek = lt > 2.6 && lt < 3.5;
      crowd(ctx, lt, (c, i, t) => {
        const a = (i / 6) * Math.PI * 2;
        return { x: lerp(c.sx, W / 2 + Math.cos(a) * 78, inn), y: lerp(c.sy, 644 + Math.sin(a) * 22, inn) - Math.abs(Math.sin(t * 9 + i)) * 5 * inn, back: inn > 0.6 && !(peek && i === 2), eyes: 1, look: peek ? 0 : 0.6, arms: 1, pose: "guard", tilt: Math.cos(a) * -0.16 * inn };
      });
      /* Whispering. */
      if (lt > 1 && lt < 4) { ctx.strokeStyle = "rgba(255,255,255,0.75)"; ctx.lineWidth = 2.5; ctx.lineCap = "round"; for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.42, q = (lt * 1.6 + i * 0.3) % 1; ctx.globalAlpha = 1 - q; ctx.beginPath(); ctx.moveTo(W / 2 + Math.cos(a) * (96 + q * 26), 500 + Math.sin(a) * (40 + q * 26)); ctx.lineTo(W / 2 + Math.cos(a) * (112 + q * 26), 500 + Math.sin(a) * (54 + q * 26)); ctx.stroke(); } ctx.globalAlpha = 1; }
    },
  },
  /* They beg. */
  beg: {
    dur: 4.4, next: "ask2", cues: [[0.5, "cloth3", 0.7], [1.0, "aww", 0.9], [2.6, "aww", 0.7]],
    line: (lt) => (lt > 1.1 ? { text: "Please. Please.", who: "pieces" } : null),
    draw(ctx, lt) {
      const kneel = easeOut(span(lt, 0.4, 1.0)), close = 1 + 0.32 * ease(span(lt, 0.2, 1.6));
      ctx.save(); ctx.translate(W / 2, 600); ctx.scale(close, close); ctx.translate(-W / 2, -600);
      crowd(ctx, lt, (c, i, t) => ({ y: c.sy + kneel * 10, squashY: 1 - 0.2 * kneel, eyes: 1, mood: "beg", look: 0, arms: 1, pose: kneel > 0.5 ? "pray" : "down", tilt: Math.sin(t * 22 + i) * 0.02 * kneel }));
      ctx.restore();
    },
  },
  ask2: { wait: "ask", again: true, next: "bonded", no: "refused", draw(ctx, lt) { ctx.save(); ctx.translate(W / 2, 600); ctx.scale(1.32, 1.32); ctx.translate(-W / 2, -600); crowd(ctx, lt, (c, i, t) => ({ y: c.sy + 10, squashY: 0.8, eyes: 1, mood: "beg", look: 0, arms: 1, pose: "pray", tilt: Math.sin(t * 22 + i) * 0.02 })); ctx.restore(); } },
  /* No again: their eyes turn red. */
  refused: {
    dur: 6, end: "refused", cues: [[0.3, "heartbeat", 0.9], [0.9, "heartbeat", 1], [1.4, "crack", 1], [1.5, "punchHeavy", 0.8], [1.6, "bell", 0.7], [1.7, "drone", 1], [1.9, "rumble", 0.8]],
    draw(ctx, lt) {
      const fall = span(lt, 0, 1.2), turn = lt >= 1.4, push = 1.12 + 0.3 * ease(span(lt, 1.4, 6));
      ctx.save();
      const shake = turn ? 14 * (1 - span(lt, 1.4, 2.1)) : 0;
      ctx.translate(W / 2 + jx(lt, shake), 580 + jy(lt, shake)); ctx.scale(push, push); ctx.translate(-W / 2, -580);
      crowd(ctx, lt, (c, i) => {
        const on = turn && lt >= 1.4 + i * 0.07;
        return { y: c.sy + 10 * (1 - span(lt, 1.4, 1.8)), squashY: lerp(0.8, 1, span(lt, 1.4, 1.8)), eyes: on ? 1 : 1 - fall * 0.9, red: on, sil: turn, mood: on ? "angry" : undefined, look: 0, arms: 1, pose: "down" };
      }, turn ? 0 : 1 - fall * 0.7, turn);
      ctx.restore();
      if (turn) { fill(ctx, "#5a0408", 0.34); speedLines(ctx, W / 2, 560, { inner: 230, alpha: 0.5 * (1 - span(lt, 1.4, 2.6)) + 0.12, seed: 3 + Math.floor(lt * 12), color: "#ff2a1a" }); }
      fill(ctx, "#fff", turn ? 1 - span(lt, 1.4, 1.6) : 0);
      fill(ctx, "#000", span(lt, 5.2, 6));
    },
  },
  /* Yes: a burst of gold, and weapons in their hands. */
  bonded: {
    dur: 3, next: "arenaIn", cues: [[0.05, "chime", 1], [0.2, "cheer", 0.8], [0.9, "shimmer", 1], [1.0, "draw", 0.8], [1.15, "metal", 0.6]],
    draw(ctx, lt) {
      const armed = lt >= 1.0;
      crowd(ctx, lt, (c, i, t) => ({ y: c.sy - Math.abs(Math.sin(t * 7 + i)) * 12, squashY: 1, eyes: 1, look: 0, arms: 1, pose: armed ? "raise" : "up", weapon: armed, weaponAngle: -0.1, aura: 0.5 * (1 - span(lt, 1.6, 3)) }));
      speedLines(ctx, W / 2, 560, { inner: 200, alpha: 0.45 * (1 - span(lt, 0, 1.2)), seed: 2 + Math.floor(lt * 14), color: "#ffe2a0" });
      if (armed) HEROES.forEach((c) => star(ctx, c.sx + 36, c.sy - c.ss * 1.5, 60 * (1 - span(lt, 1.0, 1.7)), "#fff6d8"));
      fill(ctx, "#ffe9b8", 1 - span(lt, 0, 0.5));
      fill(ctx, "#000", span(lt, 2.5, 3));
    },
  },
  /* The rest of the set lines the board: an arena. */
  arenaIn: {
    dur: 3, next: "duel0", cues: [[0.1, "cheer", 0.8], [0.2, "coins", 0.6], [1.2, "chime", 0.5]],
    draw(ctx, lt) {
      const push = lerp(0.82, 1, ease(lt / 3));
      ctx.save(); ctx.translate(W / 2, 520); ctx.scale(push, push); ctx.translate(-W / 2, -520);
      arena(ctx, lt, 0.9);
      frontRow(ctx, lt, 0.9);
      ctx.restore();
      fill(ctx, "#000", 1 - span(lt, 0, 0.5));
    },
  },
  ...Object.fromEntries(KINDS.map((kind, i) => [`duel${i}`, {
    dur: DUEL_S, next: i < 5 ? `duel${i + 1}` : "finale",
    cues: {
      pawn: [[0.1, "brass", 0.6], [0.8, "swish", 0.7], [1.2, "punch", 1], [1.22, "metal", 0.6]],
      knight: [[0.1, "brass", 0.6], [1.1, "swish", 0.8], [1.76, "punchHeavy", 1], [1.8, "crack", 0.6]],
      bishop: [[0.1, "brass", 0.6], [0.75, "draw", 0.8], [1.1, "swish", 1], [1.8, "chop", 1], [2.0, "tap", 0.6]],
      rook: [[0.1, "brass", 0.6], [0.75, "cloth1", 0.6], [0.95, "cloth2", 0.6], [1.15, "cloth3", 0.6], [1.3, "swish", 1], [1.45, "punch", 1]],
      queen: [[0.1, "brass", 0.6], [0.7, "charge", 0.7], [1.2, "zap", 1], [1.42, "zap", 1], [1.64, "zap", 1], [2.0, "shimmer", 0.6], [2.3, "poof", 0.9]],
      king: [[0.1, "brass", 0.6], [1.0, "bell", 0.8], [1.3, "draw", 0.7], [1.95, "chop", 1], [2.5, "drop", 0.9]],
    }[kind].map(([at, name, volume], n) => [n === 0 ? at : at + LEAD, name, volume]).concat([[0.72, "swish", 0.5], [0.8, "heartbeat", 0.6], [LEAD + HIT[kind] + 0.05, "ooh", 0.8], [LEAD + 2.35, "cheer", 0.55], [LEAD + 2.4, "coins", 0.7]]).sort((x, y) => x[0] - y[0]),
    draw(ctx, lt) { duel(ctx, lt, kind); },
  }])),
  /* Armed, together: the six strike a pose, and the title lands. */
  finale: {
    dur: 6.4, end: "yes", cues: [[0.15, "chime", 1], [0.4, "coins", 0.8], [0.5, "landHeavy", 0.6], [0.75, "landHeavy", 0.6], [1.0, "landHeavy", 0.7], [1.2, "draw", 0.7], [2.9, "punchHeavy", 1], [2.95, "bell", 0.8], [3.0, "shimmer", 0.9], [3.1, "cheer", 0.9]],
    draw(ctx, lt) {
      const push = lerp(1.25, 1, easeOut(lt / 1.6)), title = lt >= 2.9;
      ctx.save();
      if (title && lt < 3.4) ctx.translate(jx(lt, 14 * (1 - span(lt, 2.9, 3.4))), jy(lt, 14 * (1 - span(lt, 2.9, 3.4))));
      ctx.translate(W / 2, 600); ctx.scale(push, push); ctx.translate(-W / 2, -600);
      arena(ctx, lt, 1);
      fill(ctx, "#1a0d08", 0.5);
      /* A burst of light turning slowly behind them. */
      ctx.save(); ctx.translate(W / 2, 520); ctx.rotate(lt * 0.25); ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 18; i++) { ctx.rotate((Math.PI * 2) / 18); ctx.fillStyle = i % 2 ? "rgba(255,214,130,0.2)" : "rgba(255,170,70,0.12)"; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-46, -760); ctx.lineTo(46, -760); ctx.closePath(); ctx.fill(); }
      ctx.restore();
      glow(ctx, W / 2, 520, 330, "rgba(255,214,140,1)", 0.7);
      /* Outer pair first, the king and queen in front. */
      const stand = [
        ["pawn", 54, 640, 92, { pose: "raise", weaponAngle: -0.25 }], ["knight", 336, 640, 92, { pose: "guard", facing: -1 }],
        ["bishop", 110, 674, 110, { pose: "point", weaponAngle: -0.5 }], ["rook", 282, 674, 110, { pose: "hold", weaponAngle: 0.1, facing: -1 }],
        ["queen", 158, 716, 128, { pose: "raise", weaponAngle: -0.1, charge: 0.6 + 0.4 * Math.sin(lt * 6) }], ["king", 236, 716, 128, { pose: "guard", facing: -1 }],
      ];
      stand.forEach(([kind, x, y, size, o], i) => {
        const land = easeOut(span(lt, 0.1 + i * 0.12, 0.6 + i * 0.12));
        drawPiece(ctx, kind, x, lerp(y - 500, y, land) - Math.abs(Math.sin(lt * 3 + i)) * 4, size, { white: true, eyes: 1, look: 0, arms: 1, weapon: true, mood: lt < 2.9 ? "angry" : undefined, squashY: 1 + 0.12 * Math.sin(clamp((lt - 0.6 - i * 0.12) * 5) * Math.PI) * -1, aura: 0.3, ...o });
      });
      frontRow(ctx, lt, 1);
      ctx.restore();
      /* The title. */
      if (title) {
        const k = pop(span(lt, 2.9, 3.3));
        ctx.save();
        ctx.translate(W / 2, 250); ctx.scale(k * (1 + 0.6 * (1 - span(lt, 2.9, 3.1))), k); ctx.transform(1, -0.08, 0, 1, 0, 0);
        ctx.textAlign = "center"; ctx.lineJoin = "round";
        for (const [text, y, size] of [["CHESS", -8, 62], ["TACTICA", 58, 72]]) {
          ctx.font = `italic 900 ${size}px 'Arial Black', Impact, sans-serif`;
          ctx.lineWidth = 12; ctx.strokeStyle = "#1a0d08"; ctx.strokeText(text, 0, y);
          const g = ctx.createLinearGradient(0, y - size, 0, y); g.addColorStop(0, "#fff6dc"); g.addColorStop(0.55, "#f5c64a"); g.addColorStop(1, "#c98a1e");
          ctx.fillStyle = g; ctx.fillText(text, 0, y);
        }
        ctx.restore();
        fill(ctx, "#fff", 1 - span(lt, 2.9, 3.1));
      }
      fill(ctx, "#fff", 1 - span(lt, 0, 0.4));
      fill(ctx, "#000", span(lt, 5.6, 6.4));
    },
  },
};

/* The woken set standing in the bin. `pose(c, i, t)` gives each hero's
   state; the rest stand behind and watch. */
function crowd(ctx, lt, pose, dim = 1, red = false) {
  inside(ctx, lt + 40, 1);
  CAST.forEach((c, i) => {
    const hi = HEROES.indexOf(c);
    if (hi < 0) {
      drawPiece(ctx, c.kind, c.sx, c.sy - Math.abs(Math.sin(lt * 2 + i)) * 2, c.ss, { white: c.white, sil: red, eyes: (lt * 0.31 + i * 0.13) % 1 > 0.95 ? 0.1 : 1, red, look: 0, arms: 1, pose: "down", alpha: red ? 1 : 0.8 * dim + 0.2 });
      return;
    }
    const o = pose(c, hi, lt);
    drawPiece(ctx, c.kind, o.x ?? c.sx, o.y ?? c.sy, c.ss, { white: true, ...o });
  });
}

export const FIRST = "attic";
export { finish, W, H };
