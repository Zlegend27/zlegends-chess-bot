/* Drawing kit for the opening film: a 2D stage of 390 by 844 (a phone held
   upright), the six characters as cel-shaded shapes with eyes, arms and
   weapons, and the film's effects (glows, speed lines, impact flashes).
   Everything is drawn in code on one canvas; there are no image files. */

export const W = 390, H = 844;
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const ease = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
export const easeOut = (t) => 1 - (1 - clamp(t)) ** 3;
export const easeIn = (t) => clamp(t) ** 3;
/** Overshoots a little before settling: for things that pop into being. */
export const pop = (t) => { t = clamp(t); const c = 1.70158; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; };
/** 0 before `a`, 1 after `b`, smooth between: a beat within a shot. */
export const span = (t, a, b) => ease((t - a) / (b - a));
export function rng(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

export const KINDS = ["pawn", "knight", "bishop", "rook", "queen", "king"];

/* ---- The characters' outlines, in units of one piece width, y up ---- */
const BASE = [[0.42, 0], [0.42, 0.08], [0.34, 0.14], [0.36, 0.2], [0.22, 0.3]];
const PROFILE = {
  pawn: [...BASE, [0.13, 0.62], [0.24, 0.68], [0.24, 0.72], [0.12, 0.76], [0.12, 0.8]],
  rook: [...BASE, [0.2, 0.75], [0.3, 0.82], [0.3, 1.06], [0.2, 1.06], [0.2, 0.97], [0.08, 0.97], [0.08, 1.06], [0, 1.06]],
  bishop: [...BASE, [0.12, 0.78], [0.24, 0.84], [0.24, 0.88], [0.12, 0.92], [0.21, 1.08], [0.17, 1.22], [0.05, 1.4], [0, 1.42]],
  queen: [...BASE, [0.11, 0.95], [0.25, 1.0], [0.25, 1.04], [0.14, 1.08], [0.31, 1.38], [0.2, 1.28], [0.16, 1.42], [0.08, 1.28], [0, 1.44]],
  king: [...BASE, [0.12, 1.0], [0.27, 1.05], [0.27, 1.09], [0.15, 1.13], [0.27, 1.38], [0.12, 1.43], [0, 1.43]],
};
/* The knight faces right, so its outline isn't mirrored. */
const KNIGHT = [[-0.42, 0], [-0.42, 0.08], [-0.34, 0.14], [-0.36, 0.2], [-0.22, 0.3], [-0.26, 0.62], [-0.2, 0.92], [-0.08, 1.12], [-0.03, 1.27], [0.05, 1.12],
  [0.28, 1.0], [0.43, 0.82], [0.39, 0.7], [0.22, 0.75], [0.1, 0.66], [0.2, 0.3], [0.36, 0.2], [0.34, 0.14], [0.42, 0.08], [0.42, 0]];
/* Where each one's face is, how wide apart its eyes sit, and its shoulders. */
export const FACE = { pawn: [0, 1.0, 0.085], knight: [0.1, 0.97, 0.07], bishop: [0, 1.12, 0.075], rook: [0, 0.96, 0.09], queen: [0, 1.2, 0.08], king: [0, 1.25, 0.08] };
const SHOULDER = { pawn: 0.64, knight: 0.6, bishop: 0.8, rook: 0.72, queen: 0.96, king: 1.0 };
export const HEIGHT = { pawn: 1.2, knight: 1.27, bishop: 1.48, rook: 1.06, queen: 1.5, king: 1.68 };

const paths = {};
function pathFor(kind) {
  if (paths[kind]) return paths[kind];
  const p = new Path2D();
  const pts = kind === "knight" ? KNIGHT : [...PROFILE[kind], ...[...PROFILE[kind]].reverse().map(([x, y]) => [-x, y])];
  pts.forEach(([x, y], i) => (i ? p.lineTo(x, -y) : p.moveTo(x, -y)));
  p.closePath();
  if (kind === "pawn") { p.moveTo(0.21, -0.98); p.arc(0, -0.98, 0.21, 0, Math.PI * 2); }
  if (kind === "bishop" || kind === "queen") { const y = kind === "bishop" ? 1.47 : 1.49; p.moveTo(0.055, -y); p.arc(0, -y, 0.055, 0, Math.PI * 2); }
  if (kind === "king") { p.rect(-0.035, -1.68, 0.07, 0.27); p.rect(-0.11, -1.6, 0.22, 0.07); }
  paths[kind] = p;
  return p;
}

const INK = {
  white: { base: "#f1e4c6", shade: "#cdb78f", line: "#2f2114", arm: "#e3d2ae" },
  black: { base: "#5a3d2a", shade: "#33221a", line: "#0e0805", arm: "#4a3122" },
  shadow: { base: "#06070b", shade: "#06070b", line: "rgba(255,214,160,0.55)", arm: "#06070b" },
};

/** A soft round light. */
export function glow(ctx, x, y, r, color, alpha = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

/* A weapon in the front hand, drawn in piece units with the grip at 0,0
   and the weapon pointing up before `angle` turns it. */
function drawWeapon(ctx, kind, angle, charge = 0) {
  ctx.save();
  ctx.rotate(angle);
  ctx.lineCap = "round";
  if (kind === "pawn") {
    ctx.fillStyle = "#e9eef4"; ctx.strokeStyle = "#20252c"; ctx.lineWidth = 0.02;
    ctx.beginPath(); ctx.moveTo(-0.035, -0.08); ctx.lineTo(-0.035, -0.62); ctx.lineTo(0, -0.72); ctx.lineTo(0.035, -0.62); ctx.lineTo(0.035, -0.08); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#c9a14a"; ctx.fillRect(-0.12, -0.1, 0.24, 0.04);
    ctx.fillStyle = "#5b3a1e"; ctx.fillRect(-0.025, -0.07, 0.05, 0.14);
  } else if (kind === "bishop") {
    ctx.strokeStyle = "#20252c"; ctx.lineWidth = 0.075; ctx.beginPath(); ctx.moveTo(0, -0.05); ctx.quadraticCurveTo(0.06, -0.5, 0, -0.98); ctx.stroke();
    ctx.strokeStyle = "#f4f8ff"; ctx.lineWidth = 0.04; ctx.beginPath(); ctx.moveTo(0, -0.07); ctx.quadraticCurveTo(0.06, -0.5, 0, -0.96); ctx.stroke();
    ctx.fillStyle = "#c9a14a"; ctx.fillRect(-0.07, -0.08, 0.14, 0.035);
    ctx.fillStyle = "#3a1f2e"; ctx.fillRect(-0.025, -0.05, 0.05, 0.2);
  } else if (kind === "rook") {
    ctx.strokeStyle = "#6b4527"; ctx.lineWidth = 0.045; ctx.beginPath(); ctx.moveTo(0, 0.45); ctx.lineTo(0, -0.9); ctx.stroke();
    ctx.fillStyle = "#e9eef4"; ctx.strokeStyle = "#20252c"; ctx.lineWidth = 0.02;
    ctx.beginPath(); ctx.moveTo(-0.07, -0.88); ctx.lineTo(0, -1.2); ctx.lineTo(0.07, -0.88); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (kind === "queen") {
    ctx.strokeStyle = "#c9a14a"; ctx.lineWidth = 0.04; ctx.beginPath(); ctx.moveTo(0, 0.4); ctx.lineTo(0, -0.78); ctx.stroke();
    ctx.fillStyle = "#bff3ff"; ctx.beginPath(); ctx.arc(0, -0.86, 0.085, 0, Math.PI * 2); ctx.fill();
    glow(ctx, 0, -0.86, 0.3 + charge * 0.5, "rgba(120,230,255,0.9)", 0.6 + charge * 0.4);
  }
  ctx.restore();
}

function spikedFist(ctx, x, y, r) {
  ctx.fillStyle = "#aeb6c0"; ctx.strokeStyle = "#20252c"; ctx.lineWidth = 0.018;
  ctx.beginPath();
  for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, rr = i % 2 ? r : r * 1.6; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill(); ctx.stroke();
}

/* Where the hands go for each pose, in piece units from the centre line
   (front hand, back hand), y up. */
const POSES = {
  down: [[0.36, 0.4], [-0.36, 0.4]],
  up: [[0.44, 1.12], [-0.44, 1.12]],
  pray: [[0.05, 0.62], [-0.02, 0.62]],
  hold: [[0.46, 0.74], [-0.34, 0.42]],
  raise: [[0.3, 1.3], [-0.34, 0.42]],
  point: [[0.5, 0.9], [-0.34, 0.42]],
  neck: [[0.14, 1.02], [-0.34, 0.42]],
  guard: [[0.3, 0.8], [-0.1, 0.78]],
};

/** One character, standing on (x, y), `s` pixels wide.
 *  o: { white, sil (pure shadow with a rim of light), facing (1 right, -1
 *  left), back (seen from behind: no face), tilt, squashX, squashY, alpha,
 *  eyes (0 shut to 1 open), mood ("angry" | "beg"), red, look (-1..1),
 *  arms (0 none to 1 out), pose, hands ([[x,y],[x,y]] to override the pose),
 *  weapon, weaponAngle, charge, aura (0..1), auraColor } */
export function drawPiece(ctx, kind, x, y, s, o = {}) {
  const ink = o.sil ? INK.shadow : o.white === false ? INK.black : INK.white;
  const path = pathFor(kind);
  const f = o.facing ?? 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(o.tilt ?? 0);
  ctx.globalAlpha *= o.alpha ?? 1;
  if (o.aura) glow(ctx, 0, -HEIGHT[kind] * s * 0.5, s * (1.1 + o.aura * 0.5), o.auraColor ?? "rgba(255,214,130,0.85)", o.aura);
  ctx.scale(s * f * (o.squashX ?? 1), s * (o.squashY ?? 1));
  ctx.lineJoin = "round";
  ctx.fillStyle = ink.base;
  ctx.fill(path);
  if (!o.sil) {
    /* Cel shading: one flat shadow down the side away from the light, and a
       thin strip of light on the near edge. */
    ctx.save();
    ctx.clip(path);
    ctx.fillStyle = ink.shade;
    ctx.fillRect(0.07, -2, 1, 2.2);
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.fillRect(-0.36, -2, 0.045, 2.2);
    ctx.restore();
  }
  ctx.lineWidth = o.sil ? 0.022 : 0.034;
  ctx.strokeStyle = ink.line;
  ctx.stroke(path);
  if (kind === "bishop" && !o.sil) { ctx.lineWidth = 0.03; ctx.beginPath(); ctx.moveTo(0.02, -1.3); ctx.lineTo(0.15, -1.12); ctx.stroke(); }

  /* Arms and what they hold. */
  const arms = o.arms ?? 0;
  if (arms > 0.01) {
    const pose = o.hands ?? POSES[o.pose ?? "down"];
    const sy = SHOULDER[kind];
    const hands = [[0.2, 0], [-0.2, 1]].map(([sx, i]) => [sx, lerp(sx, pose[i][0], arms), lerp(sy, pose[i][1], arms)]);
    ctx.lineCap = "round";
    for (const [sx, hx, hy] of hands) {
      const ex = (sx + hx) / 2 + Math.sign(sx) * 0.1, ey = (sy + hy) / 2 - 0.08;
      ctx.strokeStyle = ink.line; ctx.lineWidth = 0.085;
      ctx.beginPath(); ctx.moveTo(sx, -sy); ctx.quadraticCurveTo(ex, -ey, hx, -hy); ctx.stroke();
      ctx.strokeStyle = ink.arm; ctx.lineWidth = 0.05;
      ctx.beginPath(); ctx.moveTo(sx, -sy); ctx.quadraticCurveTo(ex, -ey, hx, -hy); ctx.stroke();
      ctx.fillStyle = ink.arm; ctx.strokeStyle = ink.line; ctx.lineWidth = 0.02;
      ctx.beginPath(); ctx.arc(hx, -hy, 0.055, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    if (o.weapon && arms > 0.6) {
      if (kind === "knight") { for (const [, hx, hy] of hands) spikedFist(ctx, hx, -hy, 0.075); }
      else if (kind !== "king") { ctx.save(); ctx.translate(hands[0][1], -hands[0][2]); drawWeapon(ctx, kind, o.weaponAngle ?? 0.25, o.charge ?? 0); ctx.restore(); }
    }
  }

  /* The face: two tall eyes with a heavy upper lid, a coloured iris and a
     glint, brows that carry the mood, and a small mouth. */
  const open = o.back ? 0 : o.eyes ?? 0;
  if (open > 0.02) {
    const [fx, fy, gap] = FACE[kind];
    const mood = o.red ? "angry" : o.mood;
    const big = mood === "beg" ? 1.4 : mood === "shock" ? 1.2 : 1;
    const rx = 0.06 * big, ry = 0.098 * big * open;
    const line = o.sil ? "#000" : ink.line;
    const iris = o.red ? "#ff2a12" : o.white === false ? "#e9b24c" : "#8f5f22";
    for (const side of [-1, 1]) {
      const ex = fx + side * gap * big, ey = -fy;
      if (o.red) glow(ctx, ex, ey, 0.28, "rgba(255,40,20,0.95)", 0.9);
      ctx.save();
      ctx.beginPath(); ctx.ellipse(ex, ey, rx, Math.max(0.004, ry), 0, 0, Math.PI * 2);
      ctx.fillStyle = o.red ? "#ffd9d2" : "#fffdf6"; ctx.fill();
      ctx.clip();
      if (open > 0.35) {
        const px = ex + (o.look ?? 0.25) * rx * 0.4, small = mood === "shock" ? 0.55 : 1;
        ctx.fillStyle = iris;
        ctx.beginPath(); ctx.ellipse(px, ey + ry * 0.08, rx * 0.66 * small, ry * 0.7 * small, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#1c110a";
        ctx.beginPath(); ctx.ellipse(px, ey + ry * 0.1, rx * 0.34 * small, ry * 0.4 * small, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.arc(px - rx * 0.24, ey - ry * 0.28, rx * (mood === "beg" ? 0.3 : 0.2), 0, Math.PI * 2); ctx.fill();
        if (mood === "beg") { ctx.beginPath(); ctx.arc(px + rx * 0.26, ey + ry * 0.3, rx * 0.15, 0, Math.PI * 2); ctx.fill(); }
      }
      /* An angry eye is half shut by a slanted lid. */
      if (mood === "angry") {
        ctx.fillStyle = o.sil ? "#06070b" : ink.base;
        ctx.beginPath(); ctx.moveTo(ex - side * rx * 1.4, ey - ry * 1.3); ctx.lineTo(ex + side * rx * 1.4, ey - ry * 1.3); ctx.lineTo(ex + side * rx * 1.4, ey - ry * 0.75); ctx.lineTo(ex - side * rx * 1.4, ey + ry * 0.05); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
      ctx.strokeStyle = line; ctx.lineWidth = 0.014;
      ctx.beginPath(); ctx.ellipse(ex, ey, rx, Math.max(0.004, ry), 0, 0, Math.PI * 2); ctx.stroke();
      ctx.lineCap = "round";
      if (mood === "angry") {
        ctx.lineWidth = 0.04;
        ctx.beginPath(); ctx.moveTo(ex + side * rx * 1.35, ey - ry * 0.95); ctx.lineTo(ex - side * rx * 1.2, ey - ry * 0.02); ctx.stroke();
      } else {
        /* The upper lid. */
        ctx.lineWidth = 0.03;
        ctx.beginPath(); ctx.ellipse(ex, ey, rx * 1.04, Math.max(0.004, ry * 1.04), 0, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
      }
      if (mood === "beg" || mood === "shock") {
        ctx.lineWidth = 0.022;
        ctx.beginPath(); ctx.moveTo(ex + side * rx * 0.9, ey - ry * 1.3); ctx.lineTo(ex - side * rx * 0.9, ey - ry * 1.7); ctx.stroke();
      }
      if (mood === "beg") {
        ctx.fillStyle = "rgba(150,215,255,0.9)";
        ctx.beginPath(); ctx.ellipse(ex + side * rx * 0.7, ey + ry * 1.15, 0.022, 0.034, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
    /* The mouth. The knight's is out on his muzzle. */
    if (open > 0.5) {
      const mx = fx + (kind === "knight" ? 0.17 : 0), my = -(fy - (kind === "knight" ? 0.17 : 0.15) * (big > 1.3 ? 1.12 : 1));
      ctx.strokeStyle = line; ctx.lineWidth = 0.02; ctx.lineCap = "round"; ctx.lineJoin = "round";
      if (mood === "angry" && !o.red) {
        /* A shout: open, teeth showing. */
        ctx.fillStyle = "#3a0f0c";
        ctx.beginPath(); ctx.moveTo(mx - 0.062, my - 0.022); ctx.lineTo(mx + 0.062, my - 0.022); ctx.lineTo(mx + 0.046, my + 0.04); ctx.lineTo(mx - 0.046, my + 0.04); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#fff"; ctx.fillRect(mx - 0.052, my - 0.02, 0.104, 0.016);
      } else if (o.red) {
        ctx.beginPath(); ctx.moveTo(mx - 0.06, my); ctx.lineTo(mx - 0.03, my + 0.015); ctx.lineTo(mx, my); ctx.lineTo(mx + 0.03, my + 0.015); ctx.lineTo(mx + 0.06, my); ctx.stroke();
      } else if (mood === "beg") {
        ctx.beginPath(); ctx.moveTo(mx - 0.04, my + 0.016); ctx.quadraticCurveTo(mx - 0.02, my - 0.02, mx, my + 0.004); ctx.quadraticCurveTo(mx + 0.02, my - 0.02, mx + 0.04, my + 0.016); ctx.stroke();
      } else if (mood === "shock") {
        ctx.fillStyle = "#3a0f0c"; ctx.beginPath(); ctx.ellipse(mx, my + 0.01, 0.026, 0.036, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.moveTo(mx - 0.038, my - 0.004); ctx.quadraticCurveTo(mx, my + 0.03, mx + 0.038, my - 0.004); ctx.stroke();
      }
    }
  }
  ctx.restore();
}

/* Paints something on its own sheet, washes just what was painted with a
   colour (dust, a warm light, a chill), and lays the sheet on the picture.
   This is how light falls on the characters without a box round them. */
let sheet = null;
export function washed(ctx, paint, color, alpha) {
  const w = ctx.canvas.width, h = ctx.canvas.height;
  if (!w || !h) return; // the picture has no size yet (hidden, or mid-resize)
  sheet ??= document.createElement("canvas");
  if (sheet.width !== w || sheet.height !== h) { sheet.width = w; sheet.height = h; }
  const s = sheet.getContext("2d");
  s.setTransform(1, 0, 0, 1, 0, 0);
  s.globalCompositeOperation = "source-over";
  s.globalAlpha = 1;
  s.clearRect(0, 0, w, h);
  s.setTransform(ctx.getTransform());
  paint(s);
  s.setTransform(1, 0, 0, 1, 0, 0);
  s.globalCompositeOperation = "source-atop";
  s.globalAlpha = alpha;
  s.fillStyle = color;
  s.fillRect(0, 0, w, h);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(sheet, 0, 0);
  ctx.restore();
}

/** Lines racing in toward (or out from) a point: the anime "focus" frame. */
export function speedLines(ctx, cx, cy, { n = 46, inner = 120, outer = 700, color = "#fff", alpha = 0.8, seed = 1, width = 9 } = {}) {
  const r = rng(seed);
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, w = (0.3 + r() * 0.7) * width, from = inner * (0.75 + r() * 0.6);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * from, cy + Math.sin(a) * from);
    ctx.lineTo(cx + Math.cos(a - w / outer) * outer, cy + Math.sin(a - w / outer) * outer);
    ctx.lineTo(cx + Math.cos(a + w / outer) * outer, cy + Math.sin(a + w / outer) * outer);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** Streaks flying sideways: something is moving very fast. */
export function streaks(ctx, t, { n = 26, color = "#fff", alpha = 0.7, seed = 3, y0 = 0, y1 = H, dir = -1 } = {}) {
  const r = rng(seed);
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const y = lerp(y0, y1, r()), len = 80 + r() * 260, h = 1.5 + r() * 5, speed = 900 + r() * 1400;
    const x = ((r() * (W + len) + dir * t * speed) % (W + len) + (W + len)) % (W + len) - len;
    ctx.fillRect(x, y, len, h);
  }
  ctx.restore();
}

export function fill(ctx, color, alpha = 1) {
  if (alpha <= 0) return;
  ctx.save(); ctx.globalAlpha *= alpha; ctx.fillStyle = color; ctx.fillRect(-50, -50, W + 100, H + 100); ctx.restore();
}

export function gradient(ctx, stops, y0 = 0, y1 = H) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  stops.forEach(([at, c]) => g.addColorStop(at, c));
  ctx.fillStyle = g;
  ctx.fillRect(-50, y0 - 50, W + 100, y1 - y0 + 100);
}

/** A jagged bolt from (x0, y0) to (x1, y1). */
export function bolt(ctx, x0, y0, x1, y1, seed, width = 5, color = "#dff8ff") {
  const r = rng(seed);
  const pts = [[x0, y0]];
  const n = 9;
  for (let i = 1; i < n; i++) pts.push([lerp(x0, x1, i / n) + (r() - 0.5) * 70, lerp(y0, y1, i / n) + (r() - 0.5) * 24]);
  pts.push([x1, y1]);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineJoin = "round"; ctx.lineCap = "round";
  for (const [w, c] of [[width * 4, "rgba(80,200,255,0.25)"], [width * 1.8, "rgba(140,225,255,0.7)"], [width * 0.7, color]]) {
    ctx.lineWidth = w; ctx.strokeStyle = c;
    ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
  }
  ctx.restore();
}

/** A chessboard floor running away from the viewer, from yTop to yBot. */
export function floor(ctx, yTop, yBot, light, dark, { vanish = W / 2, spread = 3.2, rows = 7 } = {}) {
  for (let r = 0; r < rows; r++) {
    const a = (r / rows) ** 1.7, b = ((r + 1) / rows) ** 1.7;
    const ya = lerp(yTop, yBot, a), yb = lerp(yTop, yBot, b);
    const wa = lerp(0.9, spread, a) * W * 0.5, wb = lerp(0.9, spread, b) * W * 0.5;
    for (let c = -4; c < 4; c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? light : dark;
      ctx.beginPath();
      ctx.moveTo(vanish + (c / 4) * wa, ya); ctx.lineTo(vanish + ((c + 1) / 4) * wa, ya);
      ctx.lineTo(vanish + ((c + 1) / 4) * wb, yb + 0.5); ctx.lineTo(vanish + (c / 4) * wb, yb + 0.5);
      ctx.closePath(); ctx.fill();
    }
  }
}

/** Film grain and darkened corners, over everything. */
export function finish(ctx, t, vignette = 0.75) {
  const g = ctx.createRadialGradient(W / 2, H * 0.48, H * 0.22, W / 2, H * 0.5, H * 0.72);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, `rgba(0,0,0,${vignette})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const r = rng(1 + Math.floor(t * 24));
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = "#fff";
  for (let i = 0; i < 90; i++) ctx.fillRect(r() * W, r() * H, 1.4, 1.4);
  ctx.restore();
}
