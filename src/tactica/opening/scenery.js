/* The places the opening film happens in, and the man who carries the set
   through them: the attic, the hallway, the street at dusk, the bin in the
   alley, and the inside of the bin. Each is painted in layers, back to
   front, with small things moving in it (a swinging bulb, a spider, leaves,
   a cat's tail, flies) so no shot sits still. */
import { W, H, clamp, lerp, ease, rng, glow, gradient, fill, drawPiece } from "./draw.js";

const BACK = ["rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook"];

function planks(ctx, x0, x1, y0, y1, gap, color) {
  ctx.strokeStyle = color; ctx.lineWidth = 1;
  for (let x = x0; x <= x1; x += gap) { ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke(); }
}

/* A cobweb fanned across a corner. */
function cornerWeb(ctx, x, y, dx, dy, r) {
  ctx.save();
  ctx.strokeStyle = "rgba(220,228,240,0.22)"; ctx.lineWidth = 0.8;
  for (let i = 0; i <= 5; i++) { const a = (i / 5) * (Math.PI / 2); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dx * Math.cos(a) * r, y + dy * Math.sin(a) * r); ctx.stroke(); }
  for (let k = 1; k <= 4; k++) { ctx.beginPath(); for (let i = 0; i <= 5; i++) { const a = (i / 5) * (Math.PI / 2), rr = (r * k) / 4.4; const px = x + dx * Math.cos(a) * rr, py = y + dy * Math.sin(a) * rr; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); } ctx.stroke(); }
  ctx.restore();
}

const LEAF = ["#4f8a45", "#d08a32", "#8a5a2a", "#8a5a2a", "#e9eef6", "#4f8a45"];
function hex(c) { return [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)); }
function mixHex(a, b, t) { const pa = hex(a), pb = hex(b); return `rgb(${pa.map((v, i) => Math.round(lerp(v, pb[i], t))).join(",")})`; }

/** The attic. `sky` is the colour through the window, `season` runs 0 to 5
 *  (night, autumn dawn, day, rain, snow, night again) and moves the tree
 *  outside through its year; `beam` is how strong the window's light is. */
export function attic(ctx, t, { sky = "#1b2c55", season = 0, beam = 0.5 } = {}) {
  gradient(ctx, [[0, "#0d1220"], [0.55, "#1a2032"], [1, "#0a0c14"]]);
  planks(ctx, 0, W, 60, 660, 34, "rgba(0,0,0,0.28)");
  /* The roof comes down at both sides; a beam runs across. */
  ctx.fillStyle = "#070910";
  ctx.beginPath(); ctx.moveTo(-10, 60); ctx.lineTo(150, 60); ctx.lineTo(-10, 330); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(W + 10, 60); ctx.lineTo(W - 120, 60); ctx.lineTo(W + 10, 250); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#11141f"; ctx.fillRect(-10, 96, W + 20, 20);
  ctx.fillStyle = "rgba(255,255,255,0.05)"; ctx.fillRect(-10, 96, W + 20, 2);
  cornerWeb(ctx, 0, 116, 1, 1, 90);
  cornerWeb(ctx, W, 116, -1, 1, 70);

  /* The window: arched, four panes, and the year going by outside. */
  ctx.save();
  ctx.beginPath(); ctx.moveTo(236, 300); ctx.lineTo(236, 196); ctx.quadraticCurveTo(236, 142, 290, 142); ctx.quadraticCurveTo(344, 142, 344, 196); ctx.lineTo(344, 300); ctx.closePath();
  ctx.fillStyle = sky; ctx.fill();
  ctx.clip();
  /* Sun or moon crossing. */
  const arc = (season % 1), bright = season > 0.6 && season < 2.9;
  ctx.fillStyle = bright ? "#fff1c4" : "#e9eeff";
  ctx.beginPath(); ctx.arc(lerp(248, 336, arc), 200 - Math.sin(arc * Math.PI) * 44, 9, 0, Math.PI * 2); ctx.fill();
  /* A branch, and what's on it this season. */
  const si = Math.min(4, Math.floor(season)), leaf = mixHex(LEAF[si], LEAF[si + 1], season - si);
  ctx.strokeStyle = "#0b0d13"; ctx.lineWidth = 4; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(350, 286); ctx.quadraticCurveTo(310, 262, 268, 232); ctx.moveTo(312, 262); ctx.quadraticCurveTo(300, 236, 304, 212); ctx.stroke();
  const leaves = season < 1.6 ? 1 : season < 2.6 ? clamp(2.6 - season) : season > 4.4 ? clamp((season - 4.4) / 0.6) : 0;
  const lr = rng(31);
  for (let i = 0; i < 22; i++) { const lx = 262 + lr() * 84, ly = 204 + lr() * 78; if (i / 22 > leaves && !(season > 3.6 && season < 4.5 && i % 3 === 0)) continue; ctx.fillStyle = season > 3.6 && season < 4.5 ? "#eef3fb" : leaf; ctx.beginPath(); ctx.ellipse(lx, ly + Math.sin(t * 2 + i) * 1.5, 6, 4, lr() * 3, 0, Math.PI * 2); ctx.fill(); }
  /* Rain, then snow. */
  if (season > 2.6 && season < 4.6) {
    const r = rng(4); ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.fillStyle = "#fff"; ctx.lineWidth = 1;
    for (let k = 0; k < 30; k++) { const x = 238 + r() * 104, y = 144 + ((r() * 156 + t * (season < 3.6 ? 430 : 46)) % 156); if (season < 3.6) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 11); ctx.stroke(); } else { ctx.beginPath(); ctx.arc(x + Math.sin(t + k) * 4, y, 1.7, 0, Math.PI * 2); ctx.fill(); } }
  }
  ctx.restore();
  ctx.strokeStyle = "#05060a"; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(236, 300); ctx.lineTo(236, 196); ctx.quadraticCurveTo(236, 142, 290, 142); ctx.quadraticCurveTo(344, 142, 344, 196); ctx.lineTo(344, 300); ctx.closePath(); ctx.stroke();
  ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(290, 144); ctx.lineTo(290, 300); ctx.moveTo(236, 224); ctx.lineTo(344, 224); ctx.stroke();
  ctx.fillStyle = "#05060a"; ctx.fillRect(226, 300, 128, 10);
  /* A torn curtain, stirring. */
  ctx.fillStyle = "rgba(60,66,88,0.75)";
  const sway = Math.sin(t * 0.9) * 5;
  ctx.beginPath(); ctx.moveTo(222, 136); ctx.lineTo(252, 136); ctx.quadraticCurveTo(262 + sway, 220, 244 + sway, 292); ctx.lineTo(236 + sway, 270); ctx.lineTo(228 + sway, 300); ctx.quadraticCurveTo(214, 220, 222, 136); ctx.fill();

  /* Its light across the room. */
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const g = ctx.createLinearGradient(290, 200, 60, 700);
  g.addColorStop(0, sky); g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalAlpha = 0.3 * beam; ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(236, 150); ctx.lineTo(344, 150); ctx.lineTo(230, 760); ctx.lineTo(-90, 760); ctx.closePath(); ctx.fill();
  ctx.restore();

  /* A bare bulb on its flex, long dead, swinging a little. */
  const swing = Math.sin(t * 0.8) * 0.07;
  ctx.save(); ctx.translate(150, 116); ctx.rotate(swing);
  ctx.strokeStyle = "#05060a"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 120); ctx.stroke();
  ctx.fillStyle = "#1c2030"; ctx.fillRect(-6, 118, 12, 12);
  ctx.fillStyle = "rgba(170,180,205,0.5)"; ctx.beginPath(); ctx.arc(0, 142, 11, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  /* A spider, letting itself down and climbing back. */
  const drop = 150 + (Math.sin(t * 0.5) * 0.5 + 0.5) * 120;
  ctx.strokeStyle = "rgba(220,228,240,0.4)"; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(206, 116); ctx.lineTo(206, drop); ctx.stroke();
  ctx.fillStyle = "#05060a"; ctx.beginPath(); ctx.arc(206, drop + 3, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#05060a"; ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) { const a = 0.5 + i * 0.35 + Math.sin(t * 6 + i) * 0.1; ctx.beginPath(); ctx.moveTo(206, drop + 3); ctx.lineTo(206 + Math.cos(a) * 8, drop + 3 + Math.sin(a) * 6); ctx.moveTo(206, drop + 3); ctx.lineTo(206 - Math.cos(a) * 8, drop + 3 + Math.sin(a) * 6); ctx.stroke(); }

  /* What else was left up here: boxes, a trunk, a lamp, a picture. */
  const box = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); ctx.fillStyle = "rgba(255,255,255,0.05)"; ctx.fillRect(x, y, w, 3); ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fillRect(x + w / 2 - 5, y, 10, h); };
  box(10, 520, 84, 130, "#141a28"); box(22, 462, 60, 60, "#182031"); box(34, 428, 40, 36, "#141a28");
  ctx.fillStyle = "#20283a"; ctx.fillRect(30, 548, 34, 20);
  box(292, 580, 92, 70, "#151b29");
  ctx.fillStyle = "#101521"; ctx.beginPath(); ctx.moveTo(310, 580); ctx.lineTo(322, 540); ctx.lineTo(354, 540); ctx.lineTo(366, 580); ctx.closePath(); ctx.fill();
  ctx.fillRect(335, 520, 6, 22);
  ctx.strokeStyle = "#0a0d15"; ctx.lineWidth = 5; ctx.strokeRect(98, 590, 40, 52);
  /* The shelf, on its brackets. */
  ctx.fillStyle = "#33221a"; ctx.fillRect(-20, 648, W + 40, 26);
  ctx.fillStyle = "rgba(255,255,255,0.08)"; ctx.fillRect(-20, 648, W + 40, 3);
  ctx.strokeStyle = "rgba(0,0,0,0.25)"; ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-20, 654 + i * 4); ctx.lineTo(W + 20, 655 + i * 4); ctx.stroke(); }
  ctx.fillStyle = "#170f0a"; ctx.fillRect(-20, 674, W + 40, 240);
  ctx.fillStyle = "#22160f";
  for (const x of [40, 330]) { ctx.beginPath(); ctx.moveTo(x, 674); ctx.lineTo(x + 18, 674); ctx.lineTo(x, 730); ctx.closePath(); ctx.fill(); }
}

/** The man who finds the set, and throws it away: a dark figure in a coat
 *  and flat cap, edged with whatever light is behind him.
 *  step: his walk cycle; hold: arms out carrying; swing: 0 to 1, the throw;
 *  lean: tipping forward; rim: colour of the light on his edge. */
export function drawMan(ctx, x, ground, s, { step = 0, hold = 0, swing = 0, lean = 0, arms = true, rim = "rgba(255,170,90,0.65)", color = "#08090e", detail = "#1b1d29" } = {}) {
  ctx.save();
  ctx.translate(x, ground - Math.abs(Math.sin(step)) * s * 0.035);
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  /* Legs: apart even standing still, striding when he walks. */
  const stride = Math.sin(step);
  for (const dir of [1, -1]) {
    const a = stride * dir * 0.5 + dir * 0.09;
    const kx = Math.sin(a) * s * 0.5, ky = -s * 0.5 + (1 - Math.cos(a)) * s * 0.1;
    const fx = Math.sin(a * 1.45) * s * 0.78, fy = -Math.max(0, stride * dir) * s * 0.12;
    ctx.strokeStyle = dir > 0 ? color : detail; ctx.lineWidth = s * 0.17;
    ctx.beginPath(); ctx.moveTo(dir * s * 0.03, -s * 1.02); ctx.lineTo(kx, ky); ctx.lineTo(fx, fy - s * 0.04); ctx.stroke();
    ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(fx + s * 0.09, fy - s * 0.04, s * 0.17, s * 0.07, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.rotate(lean * 0.3);
  /* The back arm, behind the coat. */
  const reach = hold * (1 - swing);
  const armTo = (shade, back) => {
    const sx = s * (back ? -0.06 : 0.14), sy = -s * 1.84;
    const ex = lerp(s * 0.14, s * 0.44, reach) + swing * s * 0.3 - (back ? s * 0.06 : 0), ey = lerp(-s * 1.36, -s * 1.48, reach) - swing * s * 0.5;
    const hx = lerp(s * 0.06, s * 0.74, reach) + swing * s * 0.86, hy = lerp(-s * 1.0 - stride * s * 0.08 * (back ? -1 : 1), -s * 1.4, reach) - swing * s * 1.05;
    ctx.strokeStyle = shade; ctx.lineWidth = s * 0.14;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.fillStyle = shade; ctx.beginPath(); ctx.arc(hx, hy, s * 0.085, 0, Math.PI * 2); ctx.fill();
    return [hx, hy];
  };
  if (arms) armTo(detail, true);
  /* The coat: shoulders, a flare at the hem that swings as he walks. */
  const hem = stride * s * 0.06;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-s * 0.3, -s * 1.9); ctx.quadraticCurveTo(-s * 0.4, -s * 1.3, -s * 0.36 - hem, -s * 0.72);
  ctx.lineTo(s * 0.34 + hem, -s * 0.72); ctx.quadraticCurveTo(s * 0.4, -s * 1.3, s * 0.3, -s * 1.9);
  ctx.quadraticCurveTo(s * 0.02, -s * 2.04, -s * 0.3, -s * 1.9); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = detail; ctx.lineWidth = s * 0.025;
  ctx.beginPath(); ctx.moveTo(s * 0.1, -s * 1.9); ctx.lineTo(s * 0.14, -s * 0.74); ctx.stroke();
  /* Scarf, neck, head and cap. */
  ctx.fillStyle = detail; ctx.beginPath(); ctx.ellipse(s * 0.03, -s * 1.96, s * 0.22, s * 0.09, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(-s * 0.2, -s * 1.96, s * 0.11, s * 0.4 + hem);
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.ellipse(s * 0.05, -s * 2.2, s * 0.15, s * 0.17, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(s * 0.18, -s * 2.2); ctx.lineTo(s * 0.25, -s * 2.16); ctx.lineTo(s * 0.18, -s * 2.12); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-s * 0.13, -s * 2.28); ctx.quadraticCurveTo(s * 0.02, -s * 2.47, s * 0.2, -s * 2.31); ctx.lineTo(s * 0.36, -s * 2.27); ctx.lineTo(s * 0.35, -s * 2.24); ctx.lineTo(-s * 0.13, -s * 2.24); ctx.closePath(); ctx.fill();
  const [hx, hy] = arms ? armTo(color, false) : [0, 0];
  /* The light on his edge. */
  ctx.lineWidth = 1.6; ctx.strokeStyle = rim;
  ctx.beginPath(); ctx.ellipse(s * 0.05, -s * 2.2, s * 0.15, s * 0.17, 0, -1.0, 0.9); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(s * 0.3, -s * 1.9); ctx.quadraticCurveTo(s * 0.4, -s * 1.3, s * 0.34 + hem, -s * 0.72); ctx.stroke();
  ctx.restore();
  const c = Math.cos(lean * 0.3), sn = Math.sin(lean * 0.3);
  return { hx: x + hx * c - hy * sn, hy: ground + hx * sn + hy * c };
}

/** The board as he carries it: a slab with the set standing on it,
 *  rattling a little with each step. */
export function carried(ctx, x, y, s, tilt = 0, rattle = 0) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(tilt);
  ctx.fillStyle = "#08090e";
  ctx.fillRect(-s * 2.2, -s * 0.16, s * 4.4, s * 0.32);
  for (let i = 0; i < 8; i++) drawPiece(ctx, BACK[i], (i - 3.5) * s * 0.52, -s * 0.14, s * 0.5, { sil: true, tilt: Math.sin(rattle * 3 + i * 1.9) * 0.1 });
  ctx.strokeStyle = "rgba(255,170,90,0.5)"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-s * 2.2, -s * 0.16); ctx.lineTo(s * 2.2, -s * 0.16); ctx.stroke();
  ctx.restore();
}

/** The bin: ribbed, with handles, its lid hinged at the far side. `lid` 0
 *  is open and leaning back, 1 is shut. */
export function bin(ctx, x, ground, s, lid = 0, rim = "rgba(255,170,90,0.6)") {
  ctx.save();
  ctx.translate(x, ground);
  ctx.fillStyle = "#08090e"; ctx.strokeStyle = rim; ctx.lineWidth = 1.6; ctx.lineJoin = "round";
  /* The lid first when open, so it sits behind the body. */
  ctx.save();
  ctx.translate(s * 0.7, -s * 1.52);
  ctx.rotate(lerp(1.22, 0, lid));
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-s * 1.44, 0); ctx.quadraticCurveTo(-s * 1.4, -s * 0.2, -s * 0.72, -s * 0.24); ctx.quadraticCurveTo(-s * 0.04, -s * 0.2, 0, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillRect(-s * 0.84, -s * 0.34, s * 0.24, s * 0.1);
  ctx.restore();
  ctx.beginPath(); ctx.moveTo(-s * 0.56, 0); ctx.lineTo(-s * 0.7, -s * 1.5); ctx.lineTo(s * 0.7, -s * 1.5); ctx.lineTo(s * 0.56, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillRect(-s * 0.76, -s * 1.56, s * 1.52, s * 0.1);
  ctx.globalAlpha = 0.4;
  for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * s * 0.15, -s * 0.1); ctx.lineTo(i * s * 0.18, -s * 1.38); ctx.stroke(); }
  ctx.globalAlpha = 1;
  for (const side of [-1, 1]) { ctx.beginPath(); ctx.arc(side * s * 0.72, -s * 1.05, s * 0.1, side > 0 ? -1.2 : Math.PI - 1.2 + 0.8, side > 0 ? 1.2 : Math.PI + 1.2 + 0.8 - 0.8); ctx.stroke(); }
  ctx.restore();
}

/** Inside the house: wallpaper, pictures, a clock, a coat stand, sliding
 *  by as he walks. `travel` is how far he has come, in pixels. */
export function hallway(ctx, t, travel) {
  gradient(ctx, [[0, "#3a2418"], [0.72, "#2a1810"], [0.76, "#1a0f0a"], [1, "#120a07"]]);
  const wrap = (x, span) => ((x - travel) % span + span) % span - 120;
  ctx.strokeStyle = "rgba(0,0,0,0.22)"; ctx.lineWidth = 9;
  for (let i = 0; i < 14; i++) { const x = wrap(i * 38, 532); ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 520); ctx.stroke(); }
  /* Wainscot and floor. */
  ctx.fillStyle = "#24140d"; ctx.fillRect(-20, 520, W + 40, 122);
  ctx.fillStyle = "rgba(255,200,140,0.07)"; ctx.fillRect(-20, 520, W + 40, 4);
  ctx.fillStyle = "#140c08"; ctx.fillRect(-20, 640, W + 40, 240);
  ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.lineWidth = 1.5;
  for (let i = 0; i < 9; i++) { const x = wrap(i * 70, 630); ctx.beginPath(); ctx.moveTo(x, 640); ctx.lineTo(x - 30, 880); ctx.stroke(); }
  /* Pictures, with whoever is in them. */
  for (let i = 0; i < 3; i++) {
    const x = wrap(40 + i * 250, 750);
    ctx.fillStyle = "#120a07"; ctx.fillRect(x, 250 + (i % 2) * 40, 86, 110);
    ctx.fillStyle = "#5a3a26"; ctx.fillRect(x + 8, 258 + (i % 2) * 40, 70, 94);
    ctx.fillStyle = "#24140d"; ctx.beginPath(); ctx.arc(x + 43, 296 + (i % 2) * 40, 15, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(x + 22, 312 + (i % 2) * 40, 42, 40);
  }
  /* A tall clock, its pendulum going. */
  const cx = wrap(520, 900);
  ctx.fillStyle = "#120a07"; ctx.fillRect(cx, 300, 62, 340); ctx.fillRect(cx - 6, 290, 74, 16);
  ctx.fillStyle = "#e8d4a8"; ctx.beginPath(); ctx.arc(cx + 31, 346, 22, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#120a07"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(cx + 31, 346); ctx.lineTo(cx + 31, 330); ctx.moveTo(cx + 31, 346); ctx.lineTo(cx + 42, 350); ctx.stroke();
  ctx.strokeStyle = "#c9a14a"; ctx.lineWidth = 3; const sw = Math.sin(t * 3.2) * 16;
  ctx.beginPath(); ctx.moveTo(cx + 31, 400); ctx.lineTo(cx + 31 + sw, 520); ctx.stroke();
  ctx.fillStyle = "#c9a14a"; ctx.beginPath(); ctx.arc(cx + 31 + sw, 524, 11, 0, Math.PI * 2); ctx.fill();
  /* A lamp on the wall. */
  const lx = wrap(300, 620);
  glow(ctx, lx, 210, 190, "rgba(255,190,110,1)", 0.5);
  ctx.fillStyle = "#ffe2a8"; ctx.beginPath(); ctx.moveTo(lx - 16, 222); ctx.lineTo(lx + 16, 222); ctx.lineTo(lx + 9, 196); ctx.lineTo(lx - 9, 196); ctx.closePath(); ctx.fill();
}

/** The street at dusk. `travel` slides its layers past at their own speeds:
 *  clouds barely, far roofs slowly, the fence and the pavement fastest. */
export function street(ctx, t, travel) {
  gradient(ctx, [[0, "#1a1440"], [0.38, "#6a3660"], [0.6, "#e8794a"], [0.76, "#f8cf7a"]], 0, 642);
  /* The sun going down, and clouds lit from under. */
  glow(ctx, 300, 500, 190, "rgba(255,226,160,1)", 0.9);
  ctx.fillStyle = "#fff3c9"; ctx.beginPath(); ctx.arc(300, 500, 36, 0, Math.PI * 2); ctx.fill();
  const cr = rng(51);
  for (let i = 0; i < 6; i++) {
    const x = ((cr() * 700 - travel * 0.04 - t * 3) % 700 + 700) % 700 - 150, y = 150 + cr() * 250, w = 70 + cr() * 90;
    ctx.fillStyle = "rgba(60,32,74,0.7)"; ctx.beginPath(); ctx.ellipse(x, y, w, 12 + cr() * 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,170,110,0.55)"; ctx.beginPath(); ctx.ellipse(x, y + 7, w * 0.92, 4, 0, 0, Math.PI * 2); ctx.fill();
  }
  /* Birds heading home. */
  ctx.strokeStyle = "#2a1730"; ctx.lineWidth = 1.6;
  for (let i = 0; i < 5; i++) { const bx = ((90 + i * 24 + t * 16) % 500) - 60, by = 250 + i * 9 + Math.sin(t * 2 + i) * 4, f = Math.sin(t * 9 + i) * 4; ctx.beginPath(); ctx.moveTo(bx - 7, by - f); ctx.lineTo(bx, by); ctx.lineTo(bx + 7, by - f); ctx.stroke(); }
  /* Far roofs with lit windows. */
  for (let i = 0; i < 9; i++) {
    const x = ((i * 124 - travel * 0.16) % 1116 + 1116) % 1116 - 124, h = 66 + ((i * 37) % 76);
    ctx.fillStyle = "#2a1730"; ctx.fillRect(x, 642 - h, 92, h);
    ctx.beginPath(); ctx.moveTo(x - 9, 642 - h); ctx.lineTo(x + 46, 642 - h - 36); ctx.lineTo(x + 101, 642 - h); ctx.fill();
    ctx.fillRect(x + 62, 642 - h - 40, 12, 26);
    ctx.fillStyle = "#ffd98a";
    if (i % 2 === 0) ctx.fillRect(x + 18, 642 - h + 18, 14, 16);
    if (i % 3 !== 1) ctx.fillRect(x + 56, 642 - h + 22, 14, 16);
  }
  /* Trees, losing their leaves. */
  for (let i = 0; i < 4; i++) {
    const x = ((i * 290 - travel * 0.34) % 1160 + 1160) % 1160 - 140;
    ctx.fillStyle = "#170d1c"; ctx.fillRect(x - 6, 470, 12, 172);
    for (const [dx, dy, r] of [[0, -40, 52], [-34, -6, 38], [36, -10, 40], [6, -78, 36]]) { ctx.beginPath(); ctx.arc(x + dx, 470 + dy, r, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = "#e58a3a";
    for (let k = 0; k < 4; k++) { const fall = (t * 0.25 + k * 0.27 + i * 0.4) % 1; ctx.save(); ctx.translate(x - 50 + k * 30 + Math.sin(fall * 8 + k) * 14, 440 + fall * 200); ctx.rotate(fall * 9); ctx.globalAlpha = 1 - fall * 0.6; ctx.fillRect(-4, -2.5, 8, 5); ctx.restore(); }
  }
  /* A street lamp, just come on. */
  const lx = ((760 - travel * 0.7) % 1200 + 1200) % 1200 - 200;
  ctx.fillStyle = "#120a16"; ctx.fillRect(lx, 330, 9, 312); ctx.fillRect(lx - 4, 322, 50, 9); ctx.fillRect(lx + 30, 330, 22, 12);
  glow(ctx, lx + 41, 346, 100, "rgba(255,214,140,1)", 0.75);
  /* Fence, pavement. */
  ctx.fillStyle = "#120a16";
  for (let i = 0; i < 14; i++) { const x = ((i * 64 - travel * 0.55) % 896 + 896) % 896 - 60; ctx.beginPath(); ctx.moveTo(x, 568); ctx.lineTo(x + 5, 556); ctx.lineTo(x + 10, 568); ctx.lineTo(x + 10, 642); ctx.lineTo(x, 642); ctx.fill(); ctx.fillRect(x - 28, 584, 66, 7); ctx.fillRect(x - 28, 616, 66, 7); }
  ctx.fillStyle = "#0b080c"; ctx.fillRect(-20, 642, W + 40, 240);
  ctx.fillStyle = "rgba(255,180,100,0.2)"; ctx.fillRect(-20, 642, W + 40, 3);
  ctx.strokeStyle = "rgba(255,180,100,0.08)"; ctx.lineWidth = 1.5;
  for (let i = 0; i < 8; i++) { const x = ((i * 90 - travel) % 720 + 720) % 720 - 90; ctx.beginPath(); ctx.moveTo(x, 645); ctx.lineTo(x - 50, 880); ctx.stroke(); }
}

/** The end of the alley: a brick wall, the bin against it, bags of
 *  rubbish, and a cat on the wall who sees everything. `x` is where the
 *  bin stands. */
export function alley(ctx, t, x, lid, alarm = 0) {
  /* The wall, behind the bin. */
  ctx.fillStyle = "#170d1c"; ctx.fillRect(x - 120, 400, 330, 242);
  ctx.strokeStyle = "rgba(0,0,0,0.45)"; ctx.lineWidth = 1.5;
  for (let r = 0; r < 12; r++) { ctx.beginPath(); ctx.moveTo(x - 120, 400 + r * 20); ctx.lineTo(x + 210, 400 + r * 20); ctx.stroke(); for (let c = 0; c < 9; c++) { const bx = x - 120 + c * 40 + (r % 2) * 20; ctx.beginPath(); ctx.moveTo(bx, 400 + r * 20); ctx.lineTo(bx, 420 + r * 20); ctx.stroke(); } }
  ctx.fillStyle = "#0b080c"; ctx.fillRect(x - 126, 392, 342, 10);
  ctx.strokeStyle = "rgba(255,170,90,0.45)"; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x - 126, 392); ctx.lineTo(x + 216, 392); ctx.stroke();
  /* The cat. */
  const cx = x + 66, jump = alarm * 16;
  ctx.fillStyle = "#08090e";
  ctx.beginPath(); ctx.ellipse(cx, 376 - jump, 22, 16 + alarm * 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx - 20, 362 - jump, 11, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx - 29, 356 - jump); ctx.lineTo(cx - 27, 342 - jump); ctx.lineTo(cx - 20, 352 - jump); ctx.moveTo(cx - 16, 352 - jump); ctx.lineTo(cx - 12, 342 - jump); ctx.lineTo(cx - 10, 356 - jump); ctx.fill();
  ctx.strokeStyle = "#08090e"; ctx.lineWidth = 5; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(cx + 20, 380 - jump); ctx.quadraticCurveTo(cx + 44, 372 - jump - alarm * 30, cx + 40 + Math.sin(t * 2.4) * 8, 350 - jump - alarm * 30); ctx.stroke();
  ctx.fillStyle = "#ffe08a"; ctx.beginPath(); ctx.ellipse(cx - 24, 361 - jump, 2.4, 2.4 + alarm * 1.6, 0, 0, Math.PI * 2); ctx.ellipse(cx - 16, 361 - jump, 2.4, 2.4 + alarm * 1.6, 0, 0, Math.PI * 2); ctx.fill();
  /* Bags and a box beside the bin. */
  ctx.fillStyle = "#08090e"; ctx.strokeStyle = "rgba(255,170,90,0.4)"; ctx.lineWidth = 1.2;
  for (const [bx, r] of [[x + 96, 34], [x + 138, 26], [x - 96, 30]]) { ctx.beginPath(); ctx.moveTo(bx - r, 642); ctx.quadraticCurveTo(bx - r * 1.1, 642 - r * 1.5, bx, 642 - r * 1.7); ctx.quadraticCurveTo(bx + r * 1.1, 642 - r * 1.5, bx + r, 642); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(bx - 5, 642 - r * 1.7); ctx.lineTo(bx - 9, 642 - r * 1.95); ctx.lineTo(bx + 8, 642 - r * 1.95); ctx.lineTo(bx + 4, 642 - r * 1.7); ctx.fill(); }
  bin(ctx, x, 642, 96, lid);
}

/* Rubbish, for the floor of the bin: each a small shape, edged with light. */
function rubbish(ctx, t, lit) {
  const edge = `rgba(255,214,160,${0.18 + 0.4 * lit})`;
  ctx.save();
  ctx.translate(0, -84); // the heap sits clear of the subtitles
  ctx.lineJoin = "round"; ctx.lineWidth = 1.4; ctx.strokeStyle = edge;
  /* The heap itself. */
  ctx.fillStyle = "#0c0a0b";
  ctx.beginPath(); ctx.moveTo(-20, 760); ctx.quadraticCurveTo(60, 700, 150, 730); ctx.quadraticCurveTo(230, 690, 310, 724); ctx.quadraticCurveTo(370, 706, 410, 740); ctx.lineTo(410, 1000); ctx.lineTo(-20, 1000); ctx.closePath(); ctx.fill(); ctx.stroke();
  /* A pizza box, open, one slice left. */
  ctx.fillStyle = "#1c1410";
  ctx.beginPath(); ctx.moveTo(250, 742); ctx.lineTo(372, 734); ctx.lineTo(384, 776); ctx.lineTo(262, 786); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(250, 742); ctx.lineTo(372, 734); ctx.lineTo(360, 660); ctx.lineTo(244, 672); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = `rgba(214,150,70,${0.25 + 0.5 * lit})`; ctx.beginPath(); ctx.moveTo(290, 772); ctx.lineTo(346, 748); ctx.lineTo(352, 772); ctx.closePath(); ctx.fill();
  /* A tin, a bottle, a fish bone, a banana skin, crumpled paper. */
  ctx.fillStyle = "#15171d";
  ctx.save(); ctx.translate(60, 742); ctx.rotate(-0.5); ctx.fillRect(-14, -26, 28, 52); ctx.strokeRect(-14, -26, 28, 52); ctx.restore();
  ctx.save(); ctx.translate(186, 752); ctx.rotate(1.2); ctx.beginPath(); ctx.moveTo(-9, 30); ctx.lineTo(-9, -8); ctx.lineTo(-4, -22); ctx.lineTo(-4, -34); ctx.lineTo(4, -34); ctx.lineTo(4, -22); ctx.lineTo(9, -8); ctx.lineTo(9, 30); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  ctx.beginPath(); ctx.moveTo(100, 788); ctx.lineTo(150, 780); ctx.stroke();
  for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(108 + i * 8, 780 - i); ctx.lineTo(110 + i * 8, 794 - i); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(100, 788); ctx.lineTo(90, 780); ctx.lineTo(92, 796); ctx.closePath(); ctx.stroke();
  ctx.fillStyle = `rgba(190,160,60,${0.2 + 0.4 * lit})`;
  ctx.beginPath(); ctx.moveTo(18, 786); ctx.quadraticCurveTo(34, 760, 52, 788); ctx.quadraticCurveTo(34, 776, 18, 786); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#1b1d24";
  for (const [x, y, r] of [[226, 776, 15], [326, 800, 13], [20, 730, 12]]) { ctx.beginPath(); for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2, rr = r * (0.75 + ((i * 7) % 5) * 0.09); ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); ctx.stroke(); }
  ctx.restore();
}

/** Inside the bin: ribbed walls curving away into the dark, the lid above
 *  with its broken corner, the crack of light (`open` 0 to 1) and its beam,
 *  the rubbish, and flies turning in the light. */
export function inside(ctx, t, open) {
  fill(ctx, "#040406");
  /* Ribs of the wall, catching a little light. */
  ctx.save();
  for (let i = 0; i < 12; i++) {
    const x = 16 + i * 33, bend = (x - W / 2) * 0.08;
    ctx.strokeStyle = `rgba(120,110,100,${0.05 + 0.1 * open * (1 - Math.abs(x - 150) / 300)})`; ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(x - bend, 70); ctx.quadraticCurveTo(x + bend * 0.4, 400, x + bend, 760); ctx.stroke();
  }
  ctx.restore();
  /* The lid above, and the corner that broke. */
  ctx.fillStyle = "#020203"; ctx.fillRect(-20, 0, W + 40, 92);
  if (open > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const w = 5 + open * 150;
    const g = ctx.createLinearGradient(50, 60, 300, 820);
    g.addColorStop(0, "rgba(255,238,200,1)"); g.addColorStop(0.45, "rgba(255,214,150,0.34)"); g.addColorStop(1, "rgba(255,200,120,0)");
    ctx.fillStyle = g; ctx.globalAlpha = 0.25 + 0.6 * open;
    ctx.beginPath(); ctx.moveTo(44, 80); ctx.lineTo(64 + open * 26, 80); ctx.lineTo(250 + w, 870); ctx.lineTo(250 - w, 870); ctx.closePath(); ctx.fill();
    ctx.restore();
    /* The break itself: a jagged bright shape. */
    ctx.fillStyle = "#fff4d8";
    ctx.beginPath(); ctx.moveTo(38, 92); ctx.lineTo(46, 72 - open * 6); ctx.lineTo(54, 84); ctx.lineTo(62, 66 - open * 8); ctx.lineTo(72 + open * 22, 82); ctx.lineTo(80 + open * 24, 92); ctx.closePath(); ctx.fill();
    glow(ctx, 62, 84, 70 + open * 80, "rgba(255,240,205,1)", 0.9 * open);
    /* Dust in the beam. */
    const r = rng(9);
    ctx.fillStyle = "rgba(255,236,200,0.9)";
    for (let i = 0; i < 50; i++) { const u = r(), bx = lerp(56, 250, u) + (r() - 0.5) * (20 + u * 240), by = lerp(90, 780, u), ph = r() * 6.28; ctx.globalAlpha = (0.2 + 0.6 * Math.abs(Math.sin(t * 0.8 + ph))) * open; ctx.beginPath(); ctx.arc(bx + Math.sin(t * 0.5 + ph) * 8, by - ((t * 5 * (0.5 + r())) % 40), 1 + r() * 1.3, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  rubbish(ctx, t, open);
  /* Flies. */
  if (open > 0.3) {
    ctx.fillStyle = "#000";
    for (let i = 0; i < 4; i++) { const a = t * (1.6 + i * 0.4) + i * 2, fx = 170 + i * 30 + Math.cos(a) * (40 + i * 12), fy = 430 + i * 50 + Math.sin(a * 1.3) * 34; ctx.beginPath(); ctx.arc(fx, fy, 2.4, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(fx - 4, fy - 3 - Math.sin(t * 60) * 2); ctx.lineTo(fx + 4, fy - 3 + Math.sin(t * 60) * 2); ctx.stroke(); }
  }
}

export { ease, H };
