/* Short films for arriving in each new world (worlds 2 to 4), drawn the
   same way as the opening: shots that draw one frame from the seconds
   since they began, with sound cues and a line of story under them.

     ice      out of the bin into the snow; the long walk; a pawn sees the sky
     volcano  the snow turns to ash; the volcano wakes and the dragon rises;
              a knight steadies himself
     demon    lightning over a field of old swords; the red moon over the
              demon; the pieces draw close together

   ENTRY_FILMS[world] = { first, shots, mood } where mood is the code-made
   music to play under it (score.js). */
import { W, H, clamp, lerp, ease, easeOut, span, rng, drawPiece, glow, fill, gradient, bolt, finish } from "./draw.js";

const MARCH = ["pawn", "knight", "bishop", "rook", "queen", "king", "pawn", "pawn"];

/* The pieces walking in a line, left to right, bobbing as they step. */
function march(ctx, t, { y, s, x0, speed, gap = 0.95, white = true, sil = false, alpha = 1, seed = 4 }) {
  const r = rng(seed);
  MARCH.forEach((kind, i) => {
    const x = x0 + t * speed - i * s * gap;
    const bob = Math.abs(Math.sin(t * 6 + i * 1.3)) * s * 0.05;
    r();
    drawPiece(ctx, kind, x, y - bob, s * (kind === "pawn" ? 0.9 : 1), { white: i % 2 ? !white : white, sil, facing: 1, eyes: 1, arms: 0.6, pose: "down", alpha, tilt: Math.sin(t * 6 + i) * 0.04 });
  });
}

/* Snow or ash drifting down, blown sideways. */
function flakes(ctx, t, { n = 140, color = "#ffffff", size = 2.4, wind = 60, fall = 70, seed = 9, alpha = 0.85 }) {
  const r = rng(seed);
  ctx.save();
  ctx.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const sz = size * (0.5 + r()), sp = 0.6 + r();
    const x = ((r() * W + t * wind * sp) % (W + 20) + W + 20) % (W + 20) - 10;
    const y = ((r() * H + t * fall * sp) % (H + 20) + H + 20) % (H + 20) - 10;
    ctx.globalAlpha = alpha * (0.4 + r() * 0.6);
    ctx.beginPath(); ctx.arc(x, y, sz, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

/* Rolling hills of snow (or ash), layered back to front. */
function hills(ctx, layers, seed) {
  const r = rng(seed);
  for (const [y, color, amp] of layers) {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(-20, H + 20);
    const ph = r() * 6, f = 0.006 + r() * 0.006;
    for (let x = -20; x <= W + 20; x += 10) ctx.lineTo(x, y + Math.sin(x * f + ph) * amp + Math.sin(x * f * 2.7 + ph) * amp * 0.35);
    ctx.lineTo(W + 20, H + 20); ctx.closePath(); ctx.fill();
  }
}

/* ---------------- The icy lake ---------------- */
const ICE = {
  climb: {
    dur: 4.6, next: "walk",
    cues: [[0.2, "creak", 0.8], [0.9, "scrape", 0.7], [1.6, "wind", 0.6], [2.4, "ooh", 0.4]],
    line: () => ({ text: "The lid was open. Above it, something none of them had ever seen." }),
    draw(ctx, t) {
      /* From inside the bin, looking up at a square of snowy night sky, the
         pieces climbing out over the rim one by one. */
      gradient(ctx, [[0, "#0b0d12"], [1, "#030304"]]);
      const open = span(t, 0, 1.4);
      const hx = W * 0.5, hy = H * 0.3, hw = W * 0.7 * open, hh = H * 0.22 * open;
      ctx.save();
      ctx.beginPath(); ctx.rect(hx - hw / 2, hy - hh / 2, hw, hh); ctx.clip();
      gradient(ctx, [[0, "#20304e"], [1, "#6d86a8"]], hy - hh / 2, hy + hh / 2);
      flakes(ctx, t, { n: 90, size: 2, wind: 20, fall: 50 });
      ctx.restore();
      glow(ctx, hx, hy, 260 * open, "rgba(170,200,255,0.5)", 0.8);
      /* The rim, and the pieces going over it. */
      ctx.fillStyle = "#1a1d24"; ctx.fillRect(hx - hw / 2 - 12, hy + hh / 2, hw + 24, 14);
      MARCH.slice(0, 6).forEach((kind, i) => {
        const k = clamp((t - 1.3 - i * 0.42) / 1.1);
        const y = lerp(H * 0.92, hy + hh / 2, easeOut(k)) - (k >= 1 ? 30 : 0);
        if (k <= 0) return;
        drawPiece(ctx, kind, hx - hw * 0.35 + i * hw * 0.14, y, 52, { white: i % 2 === 0, back: true, arms: 1, pose: "up", alpha: k < 1 ? 1 : clamp(1 - (t - 1.3 - i * 0.42 - 1.1) * 2) });
      });
      flakes(ctx, t, { n: 40, size: 2.6, wind: 10, fall: 40, seed: 3, alpha: 0.6 });
    },
  },
  walk: {
    dur: 5.2, next: "sky",
    cues: [[0.1, "wind", 0.8], ...Array.from({ length: 8 }, (_, i) => [0.4 + i * 0.6, "step", 0.25]), [3.6, "rumble", 0.35]],
    line: () => ({ text: "Out of the bin and into the snow. Across the ice, something was already watching." }),
    draw(ctx, t) {
      gradient(ctx, [[0, "#141e33"], [0.55, "#4c5f7c"], [1, "#9fb2c8"]]);
      /* Far mountains, then the frozen lake, then the near snow. */
      hills(ctx, [[H * 0.46, "#33415a", 26], [H * 0.53, "#6c7f98", 14]], 2);
      ctx.fillStyle = "#b9cadc"; ctx.fillRect(-20, H * 0.56, W + 40, H * 0.08);
      ctx.fillStyle = "rgba(255,255,255,0.25)"; for (let i = 0; i < 6; i++) ctx.fillRect(i * 70 - (t * 8) % 70, H * 0.585 + (i % 2) * 6, 40, 2);
      /* Two small eyes far off across the ice. */
      const blink = (t % 2.4) > 2.25 ? 0.1 : 1;
      if (t > 2.2) { const a = span(t, 2.2, 3.2); glow(ctx, W * 0.8, H * 0.555, 18, "rgba(255,230,180,0.9)", a); ctx.fillStyle = `rgba(255,240,200,${a})`; ctx.fillRect(W * 0.8 - 6, H * 0.553, 4, 3 * blink); ctx.fillRect(W * 0.8 + 3, H * 0.553, 4, 3 * blink); }
      hills(ctx, [[H * 0.7, "#dfe8f1", 12], [H * 0.8, "#eef4f9", 8]], 5);
      march(ctx, t, { y: H * 0.76, s: 46, x0: -40, speed: 62 });
      flakes(ctx, t, { n: 170, size: 2.4, wind: 130, fall: 60 });
    },
  },
  sky: {
    dur: 4.4, end: true,
    cues: [[0.3, "chime", 0.5], [1.4, "aww", 0.35], [2.6, "shimmer", 0.6]],
    line: () => ({ text: "The pieces had never seen the sky before." }),
    draw(ctx, t) {
      gradient(ctx, [[0, "#0d1428"], [0.6, "#2c3f63"], [1, "#4f6588"]]);
      /* Stars through a break in the snow clouds. */
      const sr = rng(7);
      for (let i = 0; i < 70; i++) { const x = sr() * W, y = sr() * H * 0.5, tw = 0.5 + 0.5 * Math.sin(t * 3 + i); ctx.fillStyle = `rgba(255,255,255,${0.3 + tw * 0.6})`; ctx.fillRect(x, y, 1.6, 1.6); }
      hills(ctx, [[H * 0.74, "#d9e4ee", 10]], 8);
      /* A pawn, close, looking up; a flake lands on it. */
      const zoom = lerp(1, 1.08, ease(t / 4.4));
      ctx.save(); ctx.translate(W / 2, H * 0.86); ctx.scale(zoom, zoom); ctx.translate(-W / 2, -H * 0.86);
      drawPiece(ctx, "pawn", W / 2, H * 0.86, 230, { white: true, eyes: 1, arms: 1, pose: "down", look: 0, tilt: -0.05 });
      ctx.restore();
      const fy = lerp(H * 0.2, H * 0.6, span(t, 0.4, 3.2));
      glow(ctx, W * 0.53, fy, 26, "rgba(255,255,255,0.8)", 0.8);
      flakes(ctx, t, { n: 60, size: 2, wind: 30, fall: 30, seed: 2, alpha: 0.6 });
    },
  },
};

/* ---------------- The volcano ---------------- */
const VOLCANO = {
  ash: {
    dur: 4.6, next: "eruption",
    cues: [[0.2, "wind", 0.6], ...Array.from({ length: 7 }, (_, i) => [0.5 + i * 0.6, "step", 0.25]), [3.4, "rumble", 0.5]],
    line: () => ({ text: "The snow turned grey, then warm. It wasn't snow any more. It was ash." }),
    draw(ctx, t) {
      const k = span(t, 0, 4.6);
      gradient(ctx, [[0, lerpColor("#1d2333", "#2a1410", k)], [0.6, lerpColor("#5a6478", "#7a2f18", k)], [1, lerpColor("#a8b4c4", "#3a1c12", k)]]);
      glow(ctx, W * 0.5, H * 0.52, 420, "rgba(255,90,30,0.55)", k);
      hills(ctx, [[H * 0.58, lerpColor("#55617a", "#2a1712", k), 18], [H * 0.72, lerpColor("#c9d4df", "#3a2a24", k), 10]], 4);
      march(ctx, t, { y: H * 0.77, s: 44, x0: -20, speed: 55 });
      flakes(ctx, t, { n: 160, size: 2.2, wind: 40, fall: 45, color: lerpColor("#ffffff", "#8a8580", k) });
    },
  },
  eruption: {
    dur: 5.0, next: "knight",
    cues: [[0.3, "rumble", 1], [0.5, "whoom", 0.9], [1.0, "crunch", 0.6], [2.6, "rumble", 0.8], [3.0, "heartbeat", 0.7]],
    line: () => ({ text: "Then the mountain woke, and something older than it climbed out of the fire." }),
    draw(ctx, t) {
      gradient(ctx, [[0, "#140606"], [0.55, "#4a1408"], [1, "#1a0905"]]);
      const shake = t < 1.4 ? Math.sin(t * 60) * 4 * (1.4 - t) : 0;
      ctx.save(); ctx.translate(shake, 0);
      /* The dragon climbing out of the crater: wings unfolding, a long neck,
         eyes like furnaces. */
      const rise = span(t, 1.8, 4.2);
      const gy = lerp(H * 0.62, H * 0.3, rise);
      const spread = span(t, 2.6, 4.4);
      const beat = Math.sin(t * 5) * 18 * spread;
      ctx.fillStyle = "#0c0504";
      for (const sx of [-1, 1]) {
        /* A bat wing: shoulder, the long finger tips, scalloped back in. */
        const wx = W * 0.5 + sx * 40, wy = gy + 60;
        const tipX = wx + sx * lerp(60, 230, spread), tipY = wy - lerp(20, 150, spread) - beat;
        ctx.beginPath();
        ctx.moveTo(wx, wy);
        ctx.lineTo(tipX, tipY);
        ctx.quadraticCurveTo(wx + sx * lerp(50, 170, spread), wy - 10, wx + sx * lerp(40, 150, spread), wy + 50 - beat * 0.3);
        ctx.quadraticCurveTo(wx + sx * lerp(30, 100, spread), wy + 30, wx + sx * lerp(20, 70, spread), wy + 80);
        ctx.closePath();
        ctx.fill();
      }
      ctx.beginPath(); ctx.ellipse(W * 0.5, gy + 120, 70, 110, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(W * 0.5 - 22, gy + 40); ctx.quadraticCurveTo(W * 0.5 - 30, gy - 10, W * 0.5 - 8, gy - 30); ctx.lineTo(W * 0.5 + 12, gy - 28); ctx.quadraticCurveTo(W * 0.5 + 30, gy, W * 0.5 + 22, gy + 40); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.ellipse(W * 0.5, gy - 36, 34, 26, 0, 0, Math.PI * 2); ctx.fill();
      for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(W * 0.5 + sx * 16, gy - 54); ctx.lineTo(W * 0.5 + sx * 40, gy - 100); ctx.lineTo(W * 0.5 + sx * 28, gy - 50); ctx.fill(); }
      if (rise > 0.2) for (const sx of [-1, 1]) { glow(ctx, W * 0.5 + sx * 13, gy - 38, 30, "rgba(255,190,80,0.95)", rise); ctx.fillStyle = "#ffe9b0"; ctx.save(); ctx.translate(W * 0.5 + sx * 13, gy - 38); ctx.rotate(sx * 0.35); ctx.fillRect(-8, -2.5, 16, 5); ctx.restore(); }
      /* The volcano, its crater glowing, lava running down. */
      ctx.fillStyle = "#1d0c08";
      ctx.beginPath(); ctx.moveTo(-30, H * 0.78); ctx.lineTo(W * 0.38, H * 0.46); ctx.lineTo(W * 0.62, H * 0.46); ctx.lineTo(W + 30, H * 0.78); ctx.closePath(); ctx.fill();
      glow(ctx, W * 0.5, H * 0.46, 120, "rgba(255,120,30,0.9)", 0.9);
      ctx.strokeStyle = "#ff7a1e"; ctx.lineWidth = 5; ctx.lineCap = "round";
      for (const [dx, len] of [[-30, 0.9], [10, 1], [40, 0.8]]) { const l = len * span(t, 0.4, 3); ctx.beginPath(); ctx.moveTo(W * 0.5 + dx * 0.4, H * 0.47); ctx.quadraticCurveTo(W * 0.5 + dx, H * 0.6, W * 0.5 + dx * 2.2, H * (0.47 + 0.3 * l)); ctx.stroke(); }
      /* Lava bombs. */
      const br = rng(12);
      for (let i = 0; i < 14; i++) { const st = br() * 3, tt = t - st; if (tt < 0 || tt > 1.6) continue; const vx = (br() - 0.5) * 260, x = W * 0.5 + vx * tt, y = H * 0.46 - 420 * tt + 300 * tt * tt; glow(ctx, x, y, 16, "rgba(255,150,50,0.9)", 1); }
      ctx.restore();
      /* The pieces small in front, lit red. */
      march(ctx, 0, { y: H * 0.9, s: 34, x0: W * 0.72, speed: 0, gap: 0.9, sil: true });
    },
  },
  knight: {
    dur: 4.0, end: true,
    cues: [[0.3, "metal", 0.5], [1.2, "draw", 0.7], [2.6, "shimmer", 0.5]],
    line: () => ({ text: "The knight looked up at it, and didn't step back." }),
    draw(ctx, t) {
      gradient(ctx, [[0, "#230805"], [1, "#0d0403"]]);
      glow(ctx, W * 0.3, H * 0.25, 360, "rgba(255,110,40,0.6)", 0.8 + 0.2 * Math.sin(t * 5));
      const zoom = lerp(1, 1.06, ease(t / 4));
      ctx.save(); ctx.translate(W / 2, H * 0.88); ctx.scale(zoom, zoom); ctx.translate(-W / 2, -H * 0.88);
      drawPiece(ctx, "knight", W * 0.52, H * 0.88, 240, { white: false, eyes: 1, mood: "angry", arms: 1, pose: "guard", facing: -1, look: -0.6 });
      ctx.restore();
      flakes(ctx, t, { n: 90, size: 2, wind: -20, fall: -70, color: "#ffb060", seed: 5, alpha: 0.8 });
    },
  },
};

/* ---------------- The demon's realm ---------------- */
const DEMON = {
  swords: {
    dur: 4.8, next: "moon",
    cues: [[0.4, "zap", 0.7], [0.45, "crack", 0.6], [2.2, "zap", 0.8], [2.25, "rumble", 0.5], [3.6, "whisper", 0.5]],
    line: () => ({ text: "Past the fire the world went dark. The ground was full of swords, and none of them had an owner any more." }),
    draw(ctx, t) {
      fill(ctx, "#05040a");
      const flash = Math.max(0, 1 - Math.abs(t - 0.4) * 5) + Math.max(0, 1 - Math.abs(t - 2.2) * 5);
      gradient(ctx, [[0, `rgba(70,60,120,${0.2 + flash * 0.6})`], [1, "rgba(0,0,0,0)"]], 0, H * 0.6);
      if (flash > 0.1) bolt(ctx, W * (t < 1.3 ? 0.25 : 0.72), 0, W * (t < 1.3 ? 0.35 : 0.6), H * 0.55, t < 1.3 ? 3 : 8, 4);
      /* The field of swords, leaning, against the sky. */
      const r = rng(21);
      ctx.strokeStyle = `rgba(160,150,190,${0.35 + flash * 0.5})`; ctx.lineCap = "round";
      for (let i = 0; i < 46; i++) {
        const d = r(), x = r() * W, y = lerp(H * 0.56, H * 0.95, d), len = lerp(18, 70, d), a = (r() - 0.5) * 0.5;
        ctx.lineWidth = lerp(1.2, 3.5, d);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.sin(a) * len, y - Math.cos(a) * len); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + Math.sin(a) * len * 0.75 - 8 * d, y - Math.cos(a) * len * 0.75); ctx.lineTo(x + Math.sin(a) * len * 0.75 + 8 * d, y - Math.cos(a) * len * 0.75); ctx.stroke();
      }
      march(ctx, t, { y: H * 0.86, s: 40, x0: -60, speed: 50, sil: flash < 0.3 });
    },
  },
  moon: {
    dur: 5.0, next: "together",
    cues: [[0.3, "drone", 0.8], [1.5, "heartbeat", 0.8], [2.4, "heartbeat", 0.9], [3.4, "rumble", 0.7]],
    line: () => ({ text: "Under a red moon, the one who had been waiting since the bin turned to face them." }),
    draw(ctx, t) {
      gradient(ctx, [[0, "#0a0408"], [0.6, "#1c0610"], [1, "#050205"]]);
      const mr = span(t, 0, 2.5);
      const my = lerp(H * 0.42, H * 0.2, mr);
      glow(ctx, W * 0.72, my, 220, "rgba(255,40,30,0.6)", mr);
      ctx.fillStyle = "#b8161a"; ctx.beginPath(); ctx.arc(W * 0.72, my, 62, 0, Math.PI * 2); ctx.fill();
      /* The demon: horned, still, his eyes lighting one after the other. */
      ctx.fillStyle = "#050306";
      ctx.beginPath(); ctx.ellipse(W * 0.5, H * 0.52, 110, 150, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(W * 0.5, H * 0.34, 44, 52, 0, 0, Math.PI * 2); ctx.fill();
      /* Spiked shoulders, and a greatsword planted beside him. */
      for (const sx of [-1, 1]) {
        ctx.beginPath(); ctx.ellipse(W * 0.5 + sx * 92, H * 0.42, 58, 40, sx * 0.3, 0, Math.PI * 2); ctx.fill();
        for (let k = 0; k < 3; k++) { const bx = W * 0.5 + sx * (70 + k * 22); ctx.beginPath(); ctx.moveTo(bx - 8, H * 0.4); ctx.lineTo(bx + sx * 6, H * 0.4 - 40 - k * 8); ctx.lineTo(bx + 8, H * 0.4); ctx.fill(); }
      }
      ctx.fillRect(W * 0.5 + 150, H * 0.36, 9, H * 0.36);
      ctx.fillRect(W * 0.5 + 126, H * 0.44, 57, 8);
      for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(W * 0.5 + sx * 26, H * 0.31); ctx.quadraticCurveTo(W * 0.5 + sx * 90, H * 0.24, W * 0.5 + sx * 70, H * 0.17); ctx.quadraticCurveTo(W * 0.5 + sx * 64, H * 0.25, W * 0.5 + sx * 20, H * 0.3); ctx.fill(); }
      for (const [sx, at] of [[-1, 1.5], [1, 2.4]]) { const a = span(t, at, at + 0.4); if (a > 0) { glow(ctx, W * 0.5 + sx * 16, H * 0.34, 30, "rgba(255,40,20,0.95)", a); ctx.fillStyle = `rgba(255,90,60,${a})`; ctx.save(); ctx.translate(W * 0.5 + sx * 16, H * 0.34); ctx.rotate(sx * 0.4); ctx.fillRect(-9, -2, 18, 4); ctx.restore(); } }
      /* The rune circle at his feet. */
      ctx.strokeStyle = `rgba(255,40,40,${0.5 + 0.3 * Math.sin(t * 3)})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(W * 0.5, H * 0.74, 170, 36, 0, 0, Math.PI * 2); ctx.stroke();
    },
  },
  together: {
    dur: 4.6, end: true,
    cues: [[0.3, "cloth1", 0.6], [1.0, "whisper", 0.6], [2.2, "shimmer", 0.8], [2.4, "chime", 0.6]],
    line: () => ({ text: "The pieces drew close together. Whatever happened next, it would happen to all of them." }),
    draw(ctx, t) {
      gradient(ctx, [[0, "#0a0610"], [1, "#030205"]]);
      const close = span(t, 0, 2.2);
      const bond = span(t, 2.0, 3.4);
      glow(ctx, W / 2, H * 0.78, 300, "rgba(255,190,90,0.55)", bond);
      MARCH.slice(0, 6).forEach((kind, i) => {
        const spread = lerp(1, 0.55, close);
        const x = W / 2 + (i - 2.5) * 62 * spread;
        drawPiece(ctx, kind, x, H * 0.82, 70, { white: i % 2 === 0, eyes: 1, arms: 1, pose: i === 2 || i === 3 ? "hold" : "down", look: (W / 2 - x) / 200, aura: bond, auraColor: "rgba(255,200,110,0.9)" });
      });
    },
  },
};

/* ---------------- The ending ---------------- */
const ENDING = {
  dawn: {
    dur: 5.0, next: "home",
    cues: [[0.3, "shimmer", 0.6], [1.8, "chime", 0.5], [3.4, "chirp", 0.5]],
    line: () => ({ text: "The storm was gone. For the first time since the shelf, the sky was getting light." }),
    draw(ctx, t) {
      const k = span(t, 0, 4.5);
      gradient(ctx, [[0, lerpColor("#0c0a18", "#3a5a8a", k)], [0.55, lerpColor("#1c0e1a", "#f2a86a", k)], [1, lerpColor("#070507", "#5a3a2a", k)]]);
      /* The sun coming up over the ridge. */
      const sy = lerp(H * 0.62, H * 0.5, k);
      glow(ctx, W * 0.5, sy, 340, "rgba(255,200,120,0.7)", k);
      ctx.fillStyle = `rgba(255,226,160,${k})`; ctx.beginPath(); ctx.arc(W * 0.5, sy, 46, 0, Math.PI * 2); ctx.fill();
      hills(ctx, [[H * 0.6, lerpColor("#09060a", "#3a2418", k), 16], [H * 0.72, lerpColor("#050305", "#24160f", k), 10]], 6);
      /* The old swords, falling one by one. */
      const r = rng(31);
      ctx.strokeStyle = `rgba(30,20,20,${1 - k * 0.5})`; ctx.lineWidth = 3; ctx.lineCap = "round";
      for (let i = 0; i < 14; i++) { const x = r() * W, y = H * (0.73 + r() * 0.15), fallen = clamp((t - r() * 3) * 0.8); const a = (r() - 0.5) * 0.4 + fallen * 1.3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.sin(a) * 50, y - Math.cos(a) * 50); ctx.stroke(); }
      march(ctx, t * 0.5, { y: H * 0.86, s: 42, x0: W * 0.25, speed: 30, sil: k < 0.5 });
    },
  },
  home: {
    dur: 5.4, next: "thanks",
    cues: [[0.4, "chirp", 0.5], [2.6, "cloth2", 0.6], [3.3, "land", 0.7], [3.6, "chime", 0.6]],
    line: () => ({ text: "They found their way back to a board, in a window, in the sun. And someone sat down to play." }),
    draw(ctx, t) {
      gradient(ctx, [[0, "#8fb7dc"], [0.55, "#e8d2b0"], [1, "#a77c52"]]);
      /* A window: sky, a frame, warm light falling in. */
      ctx.fillStyle = "#c7e2f5"; ctx.fillRect(W * 0.1, H * 0.06, W * 0.8, H * 0.36);
      ctx.strokeStyle = "#6e4a2c"; ctx.lineWidth = 12; ctx.strokeRect(W * 0.1, H * 0.06, W * 0.8, H * 0.36);
      ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(W * 0.5, H * 0.06); ctx.lineTo(W * 0.5, H * 0.42); ctx.moveTo(W * 0.1, H * 0.24); ctx.lineTo(W * 0.9, H * 0.24); ctx.stroke();
      glow(ctx, W * 0.5, H * 0.5, 380, "rgba(255,230,170,0.5)", 0.9);
      /* The board on the sill, the pieces standing ready. */
      ctx.fillStyle = "#5a3a1e"; ctx.fillRect(-10, H * 0.66, W + 20, H * 0.4);
      ctx.fillStyle = "#3b2414"; ctx.fillRect(W * 0.08, H * 0.62, W * 0.84, 22);
      ctx.fillStyle = "#6b4527"; ctx.beginPath(); ctx.moveTo(W * 0.08, H * 0.62); ctx.lineTo(W * 0.16, H * 0.5); ctx.lineTo(W * 0.84, H * 0.5); ctx.lineTo(W * 0.92, H * 0.62); ctx.closePath(); ctx.fill();
      const pawnMove = span(t, 2.6, 3.4);
      ["rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook"].forEach((kind, i) => drawPiece(ctx, kind, W * 0.2 + i * W * 0.085, H * 0.585, 30, { white: true, eyes: 1, arms: 0.4, pose: "down" }));
      for (let i = 0; i < 8; i++) {
        const lift = i === 4 ? pawnMove : 0;
        drawPiece(ctx, "pawn", W * 0.18 + i * W * 0.09, H * 0.62 - lift * 24, 34, { white: true, eyes: 1, arms: 0.5, pose: lift > 0 && lift < 1 ? "up" : "down" });
      }
      /* A hand reaching in to play the first move. */
      const reach = span(t, 1.6, 2.6) * (1 - span(t, 3.6, 4.6));
      ctx.fillStyle = "#e0b48c";
      ctx.beginPath(); ctx.ellipse(W * 0.56, lerp(H * 1.05, H * 0.66, reach), 34, 52, -0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(W * 0.52, lerp(H * 1.1, H * 0.71, reach), 40, H * 0.4);
    },
  },
  thanks: {
    dur: 5.0, end: true,
    cues: [[0.3, "cheer", 0.5], [1.5, "shimmer", 0.8], [3.0, "chime", 0.6]],
    line: (t) => ({ text: t < 2.4 ? "The soul of chess was never in the pieces. It was in playing them together." : "Thank you for playing with us." }),
    draw(ctx, t) {
      gradient(ctx, [[0, "#f1d9b0"], [1, "#b98a5c"]]);
      glow(ctx, W / 2, H * 0.6, 360, "rgba(255,240,200,0.6)", 1);
      ["pawn", "knight", "bishop", "queen", "king", "rook"].forEach((kind, i) => {
        const x = W / 2 + (i - 2.5) * 60, hop = Math.abs(Math.sin(t * 4 + i)) * 8 * span(t, 0.2, 1);
        drawPiece(ctx, kind, x, H * 0.78 - hop, 66, { white: i % 2 === 0, eyes: 1, arms: 1, pose: t > 1.4 && i % 2 ? "up" : "down", look: (W / 2 - x) / 300, aura: span(t, 1.2, 2.4), auraColor: "rgba(255,210,120,0.9)" });
      });
    },
  },
};

function lerpColor(a, b, k) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return "#" + pa.map((v, i) => Math.round(lerp(v, pb[i], clamp(k))).toString(16).padStart(2, "0")).join("");
}

export const ENTRY_FILMS = {
  ice: { first: "climb", shots: ICE, mood: "wonder" },
  volcano: { first: "ash", shots: VOLCANO, mood: "action" },
  demon: { first: "swords", shots: DEMON, mood: "action" },
  ending: { first: "dawn", shots: ENDING, mood: "wonder" },
};
export { finish, W, H };
