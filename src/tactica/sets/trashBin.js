/* The tutorial set: the board inside a metal trash bin, sitting on a
   flattened pizza box on a pile of garbage. A ragged hole in the back wall
   lets in a shaft of light with dust in it, and flies buzz about. Call
   dressTrashBin(tacticaScene) and add the returned update to its everyFrame
   list. */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const BIN_R = 10.5, BIN_BOTTOM = -4.2, BIN_TOP = 12;
const HOLE = new THREE.Vector3(-1.4, 5.4, -BIN_R + 0.45);
const BOARD_HALF = 4.6;

function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasTexture(w, h, paint, repeat = [1, 1]) {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  paint(cv.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 4;
  return t;
}

/* Galvanised steel gone grimy: blotches, rust streaks running down, scuffs. */
function wallTexture() {
  const r = rng(41);
  return canvasTexture(1024, 512, (g, w, h) => {
    g.fillStyle = "#6b7075"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      g.globalAlpha = 0.05 + r() * 0.1;
      g.fillStyle = r() < 0.5 ? "#3a3d40" : "#8d9296";
      const x = r() * w, y = r() * h, s = 10 + r() * 80;
      g.beginPath(); g.ellipse(x, y, s, s * (0.4 + r()), r() * 3, 0, Math.PI * 2); g.fill();
    }
    for (let i = 0; i < 40; i++) {
      g.globalAlpha = 0.08 + r() * 0.2;
      g.fillStyle = r() < 0.6 ? "#6b3d1d" : "#3b2a1a";
      const x = r() * w, y = r() * h * 0.6, len = 60 + r() * 260, wd = 2 + r() * 8;
      g.fillRect(x, y, wd, len);
    }
    g.strokeStyle = "#a8adb2";
    for (let i = 0; i < 120; i++) {
      g.globalAlpha = 0.1 + r() * 0.2; g.lineWidth = 0.5 + r();
      const x = r() * w, y = r() * h;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 60, y + (r() - 0.5) * 20); g.stroke();
    }
    const grime = g.createLinearGradient(0, 0, 0, h);
    grime.addColorStop(0, "rgba(0,0,0,0)"); grime.addColorStop(1, "rgba(20,14,8,0.55)");
    g.globalAlpha = 1; g.fillStyle = grime; g.fillRect(0, 0, w, h);
  }, [3, 1]);
}

/* The ribbed wall, seen from inside, with a few dents. */
function buildWall() {
  const geo = new THREE.CylinderGeometry(BIN_R, BIN_R * 0.97, BIN_TOP - BIN_BOTTOM, 128, 90, true);
  geo.translate(0, (BIN_TOP + BIN_BOTTOM) / 2, 0);
  const p = geo.getAttribute("position");
  const dents = [[2.4, 5, 1.4], [-1.1, 1, 1.8], [0.4, 9, 1.1]];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const th = Math.atan2(x, z), r0 = Math.hypot(x, z);
    let r = r0 + 0.14 * Math.sin(y * 2.3);
    for (const [dt, dy, s] of dents) {
      const d = Math.hypot(Math.atan2(Math.sin(th - dt), Math.cos(th - dt)) * BIN_R, y - dy);
      if (d < s) r -= 0.35 * (1 - d / s) * (1 - d / s);
    }
    p.setX(i, Math.sin(th) * r); p.setZ(i, Math.cos(th) * r);
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ map: wallTexture(), metalness: 0.55, roughness: 0.6, side: THREE.BackSide });
  const wall = new THREE.Mesh(geo, mat);
  wall.receiveShadow = true;
  const floor = new THREE.Mesh(new THREE.CircleGeometry(BIN_R, 64), new THREE.MeshStandardMaterial({ color: "#1b1712", roughness: 1 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = BIN_BOTTOM;
  const group = new THREE.Group();
  group.add(wall, floor);
  return group;
}

/* Height of the garbage pile under a point: a broad mound peaking under
   the board, lumpy. */
function moundHeight(x, z) {
  const d = Math.hypot(x, z);
  const base = -0.55 - Math.max(0, d - 4.8) * 0.42;
  const lumps = 0.25 * Math.sin(x * 1.3 + 1) * Math.cos(z * 1.1) + 0.15 * Math.sin(x * 2.7 + z * 1.9);
  return Math.max(BIN_BOTTOM + 0.4, base + (d > 4.8 ? lumps : 0));
}

function buildMound() {
  const geo = new THREE.PlaneGeometry(BIN_R * 2, BIN_R * 2, 90, 90);
  geo.rotateX(-Math.PI / 2);
  const p = geo.getAttribute("position");
  for (let i = 0; i < p.count; i++) p.setY(i, moundHeight(p.getX(i), p.getZ(i)) - 0.15);
  geo.computeVertexNormals();
  /* Compacted junk: dark with flecks of paper and plastic, and wet patches. */
  const debris = debrisTexture();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: debris, bumpMap: debris, bumpScale: 1.5, roughness: 0.7 }));
  mesh.receiveShadow = true;
  return mesh;
}

/* A full bin bag: a lumpy, glossy black blob with its tied neck. */
function binBag(r, s, mat) {
  const geo = new THREE.SphereGeometry(1, 32, 24);
  const p = geo.getAttribute("position");
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(p, i);
    const k = 1 + 0.12 * Math.sin(v.x * 7 + s * 3) * Math.sin(v.y * 6) + 0.08 * Math.sin(v.z * 9 + s);
    v.multiplyScalar(k);
    v.y *= v.y < 0 ? 0.55 : 0.8;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  const bag = new THREE.Group();
  const body = new THREE.Mesh(geo, mat);
  body.castShadow = body.receiveShadow = true;
  bag.add(body);
  const neck = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 10), mat);
  neck.position.y = 0.95;
  neck.rotation.z = 0.3;
  bag.add(neck);
  bag.scale.setScalar(r);
  return bag;
}

/* ---------- The garbage ----------
   Sizes are real-world, against the chess set: a pawn is about 5 cm and 1.1
   units tall, so 1 unit is about 4.5 cm. A soda can is 2.7 units tall, a
   crumpled sheet of paper about 1.6 across. Everything small is baked into a
   few merged meshes (one per material) so a phone draws it cheaply. */

const tex = (w, h, paint, repeat) => canvasTexture(w, h, paint, repeat);

/* Newsprint: columns of grey "text" lines, a headline bar, a coffee ring. */
function newsprintTexture() {
  const r = rng(5);
  return tex(512, 512, (g, w, h) => {
    g.fillStyle = "#e7e1d2"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#2b2b2b"; g.globalAlpha = 0.85; g.fillRect(24, 22, w - 48, 26);
    for (let col = 0; col < 4; col++) {
      const x0 = 24 + col * ((w - 48) / 4);
      for (let y = 64; y < h - 20; y += 9) {
        g.globalAlpha = 0.35 + r() * 0.25;
        g.fillRect(x0 + 4, y, ((w - 48) / 4 - 14) * (0.6 + r() * 0.4), 3);
      }
    }
    g.globalAlpha = 0.25; g.strokeStyle = "#7a5530"; g.lineWidth = 10;
    g.beginPath(); g.arc(w * 0.7, h * 0.6, 60, 0, Math.PI * 2); g.stroke();
    g.globalAlpha = 0.18; g.fillStyle = "#8a6a3a";
    for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(r() * w, r() * h, 30 + r() * 50, 20 + r() * 40, r() * 3, 0, Math.PI * 2); g.fill(); }
    g.globalAlpha = 1;
  });
}

/* Corrugated cardboard: ruled flutes, packing tape and a printed box icon. */
function cardboardTexture() {
  const r = rng(8);
  return tex(512, 512, (g, w, h) => {
    g.fillStyle = "#a57b4b"; g.fillRect(0, 0, w, h);
    g.globalAlpha = 0.12; g.fillStyle = "#6e4e2a";
    for (let x = 0; x < w; x += 8) g.fillRect(x, 0, 3, h);
    g.globalAlpha = 0.55; g.fillStyle = "#c9a56c"; g.fillRect(0, h * 0.45, w, 46);
    g.globalAlpha = 0.6; g.strokeStyle = "#3a2a18"; g.lineWidth = 6;
    g.strokeRect(w * 0.12, h * 0.12, 90, 70);
    g.beginPath(); g.moveTo(w * 0.12, h * 0.12); g.lineTo(w * 0.12 + 45, h * 0.12 - 30); g.lineTo(w * 0.12 + 90, h * 0.12); g.stroke();
    for (let i = 0; i < 8; i++) {
      g.globalAlpha = 0.2 + r() * 0.2; g.fillStyle = "#5a3e1f";
      g.beginPath(); g.ellipse(r() * w, r() * h, 20 + r() * 60, 10 + r() * 40, r() * 3, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
  });
}

/* A can label: two-tone body, a bold stripe, a round logo and a white band. */
function canTexture(base, stripe, seed) {
  const r = rng(seed);
  return tex(512, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    g.fillStyle = stripe; g.beginPath(); g.moveTo(0, h * 0.62); g.bezierCurveTo(w * 0.3, h * 0.35, w * 0.6, h * 0.9, w, h * 0.55); g.lineTo(w, h * 0.75); g.bezierCurveTo(w * 0.6, h, w * 0.3, h * 0.5, 0, h * 0.8); g.fill();
    g.fillStyle = "#f4f1ea"; g.beginPath(); g.arc(w * 0.3, h * 0.38, 46, 0, Math.PI * 2); g.fill();
    g.fillStyle = base; g.beginPath(); g.arc(w * 0.3, h * 0.38, 30, 0, Math.PI * 2); g.fill();
    g.fillStyle = "rgba(255,255,255,0.85)"; g.fillRect(w * 0.55, h * 0.2, 150, 18); g.fillRect(w * 0.55, h * 0.3, 100, 10);
    g.globalAlpha = 0.25; g.fillStyle = "#000";
    for (let i = 0; i < 30; i++) g.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 6);
    g.globalAlpha = 1;
  });
}

/* Spotty banana skin. */
function peelTexture() {
  const r = rng(12);
  return tex(256, 256, (g, w, h) => {
    g.fillStyle = "#d8b236"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#4a3416";
    for (let i = 0; i < 90; i++) { g.globalAlpha = 0.4 + r() * 0.5; g.beginPath(); g.arc(r() * w, r() * h, 1 + r() * 6, 0, Math.PI * 2); g.fill(); }
    g.globalAlpha = 0.35; g.fillStyle = "#7a5a1e"; g.fillRect(0, 0, w, h * 0.15);
    g.globalAlpha = 1;
  });
}

/* Wrinkles for plastic: streaks of light and dark used as a bump map. */
function wrinkleTexture(seed) {
  const r = rng(seed);
  return tex(512, 512, (g, w, h) => {
    g.fillStyle = "#808080"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 220; i++) {
      g.globalAlpha = 0.15 + r() * 0.35;
      g.strokeStyle = r() < 0.5 ? "#ffffff" : "#000000";
      g.lineWidth = 1 + r() * 4;
      const x = r() * w, y = r() * h, a = r() * Math.PI, len = 30 + r() * 140;
      g.beginPath(); g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.cos(a) * len * 0.5 + (r() - 0.5) * 30, y + Math.sin(a) * len * 0.5 + (r() - 0.5) * 30, x + Math.cos(a) * len, y + Math.sin(a) * len);
      g.stroke();
    }
    g.globalAlpha = 1;
  }, [2, 2]);
}

/* Compacted junk for the pile's surface: dark, with flecks of paper and
   plastic, and darker wet patches. */
function debrisTexture() {
  const r = rng(31);
  return tex(1024, 1024, (g, w, h) => {
    g.fillStyle = "#1a1714"; g.fillRect(0, 0, w, h);
    const flecks = ["#d8d1c0", "#9b7448", "#3a5f8a", "#a83a2c", "#c9c2b0", "#2d2a26", "#55606a"];
    for (let i = 0; i < 2200; i++) {
      g.globalAlpha = 0.25 + r() * 0.5;
      g.fillStyle = flecks[Math.floor(r() * flecks.length)];
      g.save(); g.translate(r() * w, r() * h); g.rotate(r() * 3);
      g.fillRect(-2, -1, 3 + r() * 14, 2 + r() * 8);
      g.restore();
    }
    for (let i = 0; i < 40; i++) {
      g.globalAlpha = 0.35; g.fillStyle = "#0a0806";
      g.beginPath(); g.ellipse(r() * w, r() * h, 30 + r() * 90, 20 + r() * 60, r() * 3, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
  }, [5, 5]);
}

function rubbishMaterials() {
  const flat = { flatShading: true };
  return {
    paper: new THREE.MeshStandardMaterial({ map: newsprintTexture(), roughness: 0.92, ...flat }),
    plainPaper: new THREE.MeshStandardMaterial({ color: "#efeadf", roughness: 0.95, ...flat }),
    card: new THREE.MeshStandardMaterial({ map: cardboardTexture(), roughness: 0.95 }),
    cans: [["#b3141e", "#f2f2f2"], ["#1d4f9c", "#9fd0ff"], ["#1f7a3a", "#e6d34a"], ["#2a2a2a", "#e0592a"]].map(([b, s], i) =>
      new THREE.MeshStandardMaterial({ map: canTexture(b, s, 40 + i), metalness: 0.75, roughness: 0.38 })),
    tin: new THREE.MeshStandardMaterial({ color: "#c9ced3", metalness: 0.9, roughness: 0.3 }),
    glassGreen: new THREE.MeshStandardMaterial({ color: "#2e6a3a", roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.72 }),
    glassBrown: new THREE.MeshStandardMaterial({ color: "#5a3414", roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.78 }),
    label: new THREE.MeshStandardMaterial({ color: "#e8d9a8", roughness: 0.8 }),
    cap: new THREE.MeshStandardMaterial({ color: "#c9a14a", metalness: 0.8, roughness: 0.35 }),
    styro: new THREE.MeshStandardMaterial({ color: "#f1efe9", roughness: 0.85 }),
    cupRed: new THREE.MeshStandardMaterial({ color: "#c94f3b", roughness: 0.7, side: THREE.DoubleSide }),
    lid: new THREE.MeshStandardMaterial({ color: "#f3f1ec", roughness: 0.5 }),
    sleeve: new THREE.MeshStandardMaterial({ color: "#8a6440", roughness: 0.9 }),
    peel: new THREE.MeshStandardMaterial({ map: peelTexture(), roughness: 0.75 }),
    crust: new THREE.MeshStandardMaterial({ color: "#b8823f", roughness: 0.85 }),
    eggshell: new THREE.MeshStandardMaterial({ color: "#efe6d8", roughness: 0.7, side: THREE.DoubleSide }),
    core: new THREE.MeshStandardMaterial({ color: "#e9d8a6", roughness: 0.8 }),
    rot: new THREE.MeshStandardMaterial({ color: "#6b4a22", roughness: 0.8 }),
    foilPacket: new THREE.MeshStandardMaterial({ color: "#d63a8a", metalness: 0.6, roughness: 0.3, ...flat }),
    foilPacket2: new THREE.MeshStandardMaterial({ color: "#f0b21f", metalness: 0.6, roughness: 0.3, ...flat }),
    shopBag: new THREE.MeshStandardMaterial({ color: "#f4f4f4", roughness: 0.35, transparent: true, opacity: 0.82, side: THREE.DoubleSide, ...flat }),
    spill: new THREE.MeshStandardMaterial({ color: "#2a1608", roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.85 }),
  };
}

/* Bends a shape's vertices with random waves so it reads as crumpled. */
function crumple(geo, amount, seed) {
  const r = rng(seed);
  const p = geo.getAttribute("position");
  const fx = 2 + r() * 4, fy = 2 + r() * 4, fz = 2 + r() * 4, ph = r() * 6;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = Math.sin(x * fx + ph) * Math.cos(y * fy) * Math.sin(z * fz + ph * 0.7);
    const k = 1 + amount * (n + (r() - 0.5) * 0.6);
    p.setXYZ(i, x * k, y * k, z * k);
  }
  geo.computeVertexNormals();
  return geo;
}

/* Each maker returns [mesh, height above the ground it rests on], built at
   real size. "flat" items are low enough to sit between camera and board. */
function makeRubbish(M) {
  const mesh = (g, m) => new THREE.Mesh(g, m);
  const group = (...ms) => { const gr = new THREE.Group(); gr.add(...ms); return gr; };
  return {
    paperBall: (r, s) => [mesh(crumple(new THREE.IcosahedronGeometry(0.8, 2), 0.32, s), r() < 0.6 ? M.paper : M.plainPaper), 0.6],
    paperSheet: (r, s) => {
      const g = new THREE.PlaneGeometry(2.6, 3.4, 10, 12); g.rotateX(-Math.PI / 2);
      const p = g.getAttribute("position");
      for (let i = 0; i < p.count; i++) p.setY(i, Math.sin(p.getX(i) * 2.3 + s) * 0.18 + Math.cos(p.getZ(i) * 3.1) * 0.12 + Math.abs(Math.sin(p.getX(i) * 5 + p.getZ(i) * 4)) * 0.08);
      g.computeVertexNormals();
      const m = mesh(g, M.paper); m.material = M.paper; return [m, 0.2];
    },
    canStanding: (r) => {
      const label = mesh(new THREE.CylinderGeometry(0.74, 0.74, 2.3, 28, 1, true), M.cans[Math.floor(r() * M.cans.length)]);
      const top = mesh(new THREE.CylinderGeometry(0.62, 0.74, 0.2, 28), M.tin); top.position.y = 1.25;
      const bottom = mesh(new THREE.CylinderGeometry(0.74, 0.6, 0.2, 28), M.tin); bottom.position.y = -1.25;
      return [group(label, top, bottom), 1.35];
    },
    canLying: (r) => {
      const label = mesh(new THREE.CylinderGeometry(0.74, 0.74, 2.3, 28, 1, true), M.cans[Math.floor(r() * M.cans.length)]);
      const top = mesh(new THREE.CylinderGeometry(0.62, 0.74, 0.2, 28), M.tin); top.position.y = 1.25;
      const bottom = mesh(new THREE.CylinderGeometry(0.74, 0.6, 0.2, 28), M.tin); bottom.position.y = -1.25;
      const g = group(label, top, bottom); g.rotation.z = Math.PI / 2; return [g, 0.72];
    },
    canCrushed: (r, s) => {
      const geo = new THREE.CylinderGeometry(0.8, 0.8, 1.0, 28, 8, true);
      const p = geo.getAttribute("position");
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const fold = 1 + 0.18 * Math.sin(y * 9 + s) * Math.cos(Math.atan2(x, z) * 3);
        p.setXYZ(i, x * fold, y, z * fold * 0.75);
      }
      geo.computeVertexNormals();
      const body = mesh(geo, M.cans[Math.floor(r() * M.cans.length)]);
      const lid = mesh(new THREE.CylinderGeometry(0.66, 0.66, 0.1, 24), M.tin); lid.position.y = 0.52; lid.rotation.z = 0.25;
      const g = group(body, lid); g.rotation.z = Math.PI / 2; return [g, 0.55];
    },
    bottle: (r) => {
      const pts = [[0, 0], [0.7, 0], [0.74, 0.15], [0.74, 2.6], [0.6, 3.2], [0.28, 3.7], [0.26, 4.2], [0, 4.2]].map(([x, y]) => new THREE.Vector2(x, y));
      const glass = mesh(new THREE.LatheGeometry(pts, 24), r() < 0.5 ? M.glassGreen : M.glassBrown);
      const label = mesh(new THREE.CylinderGeometry(0.76, 0.76, 1.3, 24, 1, true), M.label); label.position.y = 1.4;
      const cap = mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.22, 16), M.cap); cap.position.y = 4.3;
      const g = group(glass, label, cap); g.rotation.z = Math.PI / 2; g.position.x = -2.1; return [group(g), 0.75];
    },
    cardboard: (r, s, flatOnly) => {
      const w = 3.2 + r() * 2.4, d = 2.6 + r() * 1.8;
      const a = mesh(new THREE.BoxGeometry(w, 0.14, d), M.card);
      const b = mesh(new THREE.BoxGeometry(w, 0.14, d * 0.6), M.card);
      b.position.set(0, d * 0.25, d / 2 + 0.05); b.rotation.x = -0.9 - r() * 0.5;
      /* Only some get a folded-up flap; the caller keeps those off the
         player's side. */
      return [s % 3 === 0 && !flatOnly ? group(a, b) : a, 0.12];
    },
    cup: (r) => {
      const body = mesh(new THREE.CylinderGeometry(0.95, 0.68, 2.6, 24, 1, true), r() < 0.5 ? M.cupRed : M.styro);
      const lid = mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.18, 24), M.lid); lid.position.y = 1.35;
      const sleeve = mesh(new THREE.CylinderGeometry(0.9, 0.82, 0.9, 24, 1, true), M.sleeve); sleeve.position.y = 0.1;
      const g = group(body, lid, sleeve); g.rotation.z = Math.PI / 2 + 0.1; return [g, 0.9];
    },
    takeout: (r) => {
      const base = mesh(new THREE.BoxGeometry(3, 1.1, 3), M.styro);
      const lid = mesh(new THREE.BoxGeometry(3, 0.25, 3), M.styro);
      lid.position.set(0, 0.9, -1.6); lid.rotation.x = 1.2 + r() * 0.4;
      return [group(base, lid), 0.55];
    },
    packet: (r, s) => {
      const g = crumple(new THREE.SphereGeometry(1, 14, 10), 0.22, s); g.scale(1.5, 0.28, 2.0);
      return [mesh(g, r() < 0.5 ? M.foilPacket : M.foilPacket2), 0.25];
    },
    shoppingBag: (r, s) => {
      const g = crumple(new THREE.SphereGeometry(1, 18, 12), 0.35, s); g.scale(2.0, 0.9, 1.7);
      return [mesh(g, M.shopBag), 0.6];
    },
    peel: (r) => {
      const parts = [];
      for (let i = 0; i < 4; i++) {
        const strip = mesh(new THREE.CapsuleGeometry(0.28, 1.6, 4, 10), M.peel);
        strip.scale.set(1.6, 1, 0.35);
        const a = (i / 4) * Math.PI * 2 + r() * 0.3;
        strip.rotation.set(Math.PI / 2 - 0.25, a, 0);
        strip.position.set(Math.sin(a) * 0.9, 0.12, Math.cos(a) * 0.9);
        parts.push(strip);
      }
      const stem = mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.6, 8), M.rot); stem.position.y = 0.3;
      return [group(...parts, stem), 0.15];
    },
    crust: (r) => {
      const g = new THREE.TorusGeometry(1.9, 0.26, 8, 20, 1.2 + r() * 0.8); g.rotateX(Math.PI / 2);
      return [mesh(g, M.crust), 0.24];
    },
    eggshell: (r) => {
      const half = (x) => { const m = mesh(new THREE.SphereGeometry(0.48, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.eggshell); m.position.x = x; m.rotation.x = Math.PI + r() * 0.6; return m; };
      return [group(half(-0.5), half(0.55)), 0.35];
    },
    appleCore: () => {
      const pts = [[0, 0], [0.55, 0.1], [0.32, 0.6], [0.28, 1.0], [0.55, 1.5], [0, 1.6]].map(([x, y]) => new THREE.Vector2(x, y));
      const core = mesh(new THREE.LatheGeometry(pts, 16), M.core);
      const g = group(core); g.rotation.z = 1.4; return [g, 0.55];
    },
  };
}

/* Everything that may sit between the camera and the board is flat. */
const FLAT = ["paperSheet", "cardboard", "canCrushed", "packet", "peel", "crust", "eggshell"];
const TALL = ["paperBall", "canStanding", "canLying", "bottle", "cup", "takeout", "shoppingBag", "appleCore"];

/* Builds the heaps, then bakes every small piece into one mesh per
   material. */
function fillWithRubbish(set) {
  const M = rubbishMaterials();
  const make = makeRubbish(M);
  const r = rng(77);
  const loose = new THREE.Group();
  const placed = [];
  /* Heaps: a handful of clusters round the board, plus some strays. */
  const centres = [];
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + r() * 0.3, d = 6.2 + r() * 2.8;
    centres.push([Math.sin(a) * d, Math.cos(a) * d]);
  }
  for (let i = 0; i < 120; i++) {
    let x, z;
    if (i < 95) {
      const [cx, cz] = centres[i % centres.length];
      x = cx + (r() - 0.5) * 3.4; z = cz + (r() - 0.5) * 3.4;
    } else {
      const a = r() * Math.PI * 2, d = 5 + r() * 4.8;
      x = Math.sin(a) * d; z = Math.cos(a) * d;
    }
    const dist = Math.hypot(x, z);
    /* Real-size items are big, so their centres keep well clear of the board. */
    if (dist > BIN_R - 0.9 || (Math.abs(x) < BOARD_HALF + 1.4 && Math.abs(z) < BOARD_HALF + 1.4)) continue;
    /* On the player's side only flat things; tall things go behind the
       board or out to the far sides. */
    const front = z > 0;
    const tallOk = z < -BOARD_HALF - 1 || Math.abs(x) > BOARD_HALF + 2.5;
    const pool = front || !tallOk ? FLAT : r() < 0.6 ? TALL : FLAT;
    const kind = pool[Math.floor(r() * pool.length)];
    const [obj, lift] = make[kind](r, i, front);
    const holder = new THREE.Group();
    holder.add(obj);
    /* Pile up: each item rests a little higher where others already lie. */
    const under = placed.filter(([px, pz]) => Math.hypot(px - x, pz - z) < 1.6).length;
    holder.position.set(x, moundHeight(x, z) + lift + Math.min(under, 4) * 0.22 - 0.1, z);
    holder.rotation.set((r() - 0.5) * 0.5, r() * Math.PI * 2, (r() - 0.5) * 0.5);
    holder.scale.setScalar(0.85 + r() * 0.3);
    loose.add(holder);
    placed.push([x, z]);
  }
  /* Spilled soda by the board's edge. */
  for (const [x, z, s] of [[5.6, 1.2, 1.6], [-5.4, -2.6, 1.2], [3.2, -5.6, 1.4]]) {
    const g = new THREE.CircleGeometry(s, 24);
    const p = g.getAttribute("position");
    for (let i = 1; i < p.count; i++) { const k = 0.75 + Math.sin(i * 1.7) * 0.2; p.setX(i, p.getX(i) * k); p.setY(i, p.getY(i) * k * 0.8); }
    const m = new THREE.Mesh(g, M.spill);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, moundHeight(x, z) + 0.02, z);
    loose.add(m);
  }
  /* Bake: merge everything by material. */
  loose.updateMatrixWorld(true);
  const byMaterial = new Map();
  loose.traverse((o) => {
    if (!o.isMesh) return;
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);
    for (const name of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(name)) g.deleteAttribute(name);
    if (!g.getAttribute("uv")) g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(g.getAttribute("position").count * 2), 2));
    if (!byMaterial.has(o.material)) byMaterial.set(o.material, []);
    byMaterial.get(o.material).push(g);
  });
  for (const [material, geos] of byMaterial) {
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    const m = new THREE.Mesh(merged, material);
    m.castShadow = !material.transparent;
    m.receiveShadow = true;
    set.add(m);
  }
  /* Bin bags against the back and sides, real size, wrinkled and glossy. */
  const bagMat = new THREE.MeshStandardMaterial({ color: "#111216", roughness: 0.22, metalness: 0.1, bumpMap: wrinkleTexture(61), bumpScale: 2.2 });
  [-1.75, -1.05, -0.35, 0.35, 1.05, 1.75].forEach((a0, i) => {
    const a = a0 + Math.PI;
    const size = 2.5 + r() * 0.7;
    const d = BIN_R - size * 0.8;
    const bag = binBag(size, i, bagMat);
    const x = Math.sin(a) * d, z = Math.cos(a) * d;
    bag.position.set(x, moundHeight(x, z) + 1.2, z);
    bag.rotation.y = r() * 6;
    set.add(bag);
  });
}

/* The flattened pizza box the board rests on, grease stains and all. */
function pizzaBox() {
  const top = canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = "#a47a4c"; g.fillRect(0, 0, w, h);
    const r = rng(3);
    for (let i = 0; i < 9; i++) {
      g.globalAlpha = 0.25 + r() * 0.2;
      g.fillStyle = "#6e4a24";
      g.beginPath(); g.ellipse(r() * w, r() * h, 20 + r() * 50, 15 + r() * 40, r() * 3, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 0.5; g.strokeStyle = "#7d5a32"; g.lineWidth = 6;
    g.strokeRect(18, 18, w - 36, h - 36);
  });
  const m = new THREE.Mesh(new THREE.BoxGeometry(9.8, 0.14, 9.8), new THREE.MeshStandardMaterial({ map: top, roughness: 0.95 }));
  m.position.y = -0.47;
  m.rotation.y = 0.06;
  m.receiveShadow = true;
  return m;
}

/* The hole: torn metal round a bright opening, a glow, the light itself and
   the shaft of light with dust drifting in it. */
function buildHole(scene, target) {
  const group = new THREE.Group();
  const inward = new THREE.Vector3(0, 0, 1);
  const shape = new THREE.Shape();
  const r = rng(19);
  const pts = [];
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2, rr = 0.55 * (0.75 + r() * 0.5);
    pts.push(new THREE.Vector2(Math.cos(a) * rr * 1.25, Math.sin(a) * rr));
  }
  shape.setFromPoints(pts);
  const opening = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color: "#fff4d6" }));
  opening.position.copy(HOLE);
  opening.lookAt(HOLE.clone().add(inward));
  group.add(opening);
  /* Curled-in shards of metal round the edge. */
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + r() * 0.3;
    const shard = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.4 + r() * 0.3, 4), new THREE.MeshStandardMaterial({ color: "#555a5e", metalness: 0.7, roughness: 0.5 }));
    shard.position.copy(HOLE).add(new THREE.Vector3(Math.cos(a) * 0.72, Math.sin(a) * 0.58, 0.12));
    shard.rotation.set(Math.PI / 2 + 0.6, 0, -a + Math.PI / 2);
    group.add(shard);
  }
  const glowTex = canvasTexture(128, 128, (g, w) => {
    const grad = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    grad.addColorStop(0, "rgba(255,240,200,0.9)"); grad.addColorStop(0.35, "rgba(255,220,160,0.35)"); grad.addColorStop(1, "rgba(255,200,120,0)");
    g.fillStyle = grad; g.fillRect(0, 0, w, w);
  });
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.position.copy(HOLE).add(inward.clone().multiplyScalar(0.2));
  glow.scale.setScalar(3.6);
  group.add(glow);

  const light = new THREE.SpotLight("#ffe7c2", 260, 40, 0.3, 0.55, 1.6);
  light.position.copy(HOLE).add(inward.clone().multiplyScalar(0.3));
  light.target.position.copy(target);
  light.castShadow = true;
  light.shadow.mapSize.set(1024, 1024);
  light.shadow.camera.near = 2;
  light.shadow.camera.far = 30;
  light.shadow.bias = -0.0005;
  light.shadow.normalBias = 0.02;
  group.add(light, light.target);

  /* The shaft: an open cone from the hole to the board, brightest near the
     hole and soft at its edges. */
  const from = light.position.clone(), dir = target.clone().sub(from);
  const len = dir.length();
  const radius = Math.tan(0.3) * len;
  const coneGeo = new THREE.CylinderGeometry(radius, 0.45, len, 48, 1, true);
  coneGeo.translate(0, -len / 2, 0);
  const shaftMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { color: { value: new THREE.Color("#ffe2b0") }, strength: { value: 0.42 } },
    vertexShader: `varying float vAlong; varying vec3 vN; varying vec3 vView;
      void main() { vAlong = -position.y; vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal); vView = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 color; uniform float strength; varying float vAlong; varying vec3 vN; varying vec3 vView;
      void main() { float edge = pow(abs(dot(vN, vView)), 1.6); float fade = 1.0 - smoothstep(0.0, ${len.toFixed(2)}, vAlong) * 0.75;
        gl_FragColor = vec4(color * strength * edge * fade, 1.0); }`,
  });
  const shaft = new THREE.Mesh(coneGeo, shaftMat);
  shaft.position.copy(from);
  shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.clone().normalize());
  group.add(shaft);

  /* Dust: specks drifting slowly in the light. */
  const N = 260;
  const pos = new Float32Array(N * 3), seeds = [];
  const dustR = rng(23);
  for (let i = 0; i < N; i++) seeds.push({ u: dustR(), a: dustR() * 6.28, rr: Math.sqrt(dustR()), sp: 0.02 + dustR() * 0.04, ph: dustR() * 6.28 });
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const dustTex = canvasTexture(32, 32, (g, w) => {
    const grad = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    grad.addColorStop(0, "rgba(255,245,220,1)"); grad.addColorStop(1, "rgba(255,245,220,0)");
    g.fillStyle = grad; g.fillRect(0, 0, w, w);
  });
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ map: dustTex, size: 0.06, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: "#ffe9c4", opacity: 0.8 }));
  group.add(dust);
  const axis = dir.clone().normalize();
  const side1 = new THREE.Vector3().crossVectors(axis, new THREE.Vector3(0, 1, 0)).normalize();
  const side2 = new THREE.Vector3().crossVectors(axis, side1).normalize();
  const updateDust = (t) => {
    for (let i = 0; i < N; i++) {
      const s = seeds[i];
      const u = (s.u + t * s.sp * 0.15) % 1;
      const across = Math.tan(0.3) * len * u * 0.85 * s.rr;
      const a = s.a + Math.sin(t * 0.3 + s.ph) * 0.4;
      const p = from.clone().addScaledVector(axis, len * u)
        .addScaledVector(side1, Math.cos(a) * across).addScaledVector(side2, Math.sin(a) * across);
      p.y += Math.sin(t * 0.7 + s.ph) * 0.05;
      pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
    }
    dustGeo.attributes.position.needsUpdate = true;
  };
  scene.add(group);
  return { updateDust, light };
}

/* A housefly: dark iridescent body, red eyes, two see-through wings that
   flap fast. It wanders in loops round the board, now and then darting. */
function buildFly() {
  const fly = new THREE.Group();
  const shell = new THREE.MeshStandardMaterial({ color: "#1d2b22", metalness: 0.6, roughness: 0.3 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), shell);
  body.scale.set(0.9, 0.8, 1.5);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), shell);
  head.position.z = 0.07;
  const eyeMat = new THREE.MeshStandardMaterial({ color: "#7a1e14", roughness: 0.4 });
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), eyeMat);
    eye.position.set(s * 0.025, 0.012, 0.08);
    fly.add(eye);
  }
  const wingMat = new THREE.MeshStandardMaterial({ color: "#cfe3ff", transparent: true, opacity: 0.35, side: THREE.DoubleSide, roughness: 0.2, depthWrite: false });
  const wings = [];
  for (const s of [-1, 1]) {
    const hinge = new THREE.Group();
    hinge.position.set(s * 0.02, 0.035, 0.0);
    const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.055), wingMat);
    wing.position.x = s * 0.07;
    wing.rotation.x = -Math.PI / 2;
    hinge.add(wing);
    fly.add(hinge);
    wings.push({ hinge, s });
  }
  fly.add(body, head);
  return { fly, wings };
}

function buildFlies(scene, count = 7) {
  const r = rng(99);
  const flies = [];
  for (let i = 0; i < count; i++) {
    const { fly, wings } = buildFly();
    scene.add(fly);
    flies.push({
      fly, wings,
      c: new THREE.Vector3((r() - 0.5) * 7, 1.2 + r() * 2.2, (r() - 0.5) * 7),
      rx: 1 + r() * 2.2, rz: 1 + r() * 2.2, ry: 0.3 + r() * 0.6,
      fx: 0.6 + r() * 0.9, fz: 0.5 + r() * 0.9, fy: 1.2 + r() * 1.5, ph: r() * 6.28,
      dart: 0, last: new THREE.Vector3(),
    });
  }
  return (t, dt) => {
    for (const f of flies) {
      /* Every few seconds a fly darts its loop somewhere new. */
      f.dart -= dt;
      if (f.dart < 0) {
        f.dart = 2 + Math.random() * 4;
        f.target = new THREE.Vector3((Math.random() - 0.5) * 8, 0.9 + Math.random() * 2.8, (Math.random() - 0.5) * 8);
      }
      if (f.target) f.c.lerp(f.target, 1 - Math.exp(-dt * 1.2));
      const p = new THREE.Vector3(
        f.c.x + Math.sin(t * f.fx + f.ph) * f.rx + Math.sin(t * 7.3 + f.ph) * 0.06,
        f.c.y + Math.sin(t * f.fy + f.ph * 2) * f.ry + Math.sin(t * 11 + f.ph) * 0.03,
        f.c.z + Math.cos(t * f.fz + f.ph) * f.rz + Math.cos(t * 6.1 + f.ph) * 0.06,
      );
      const v = p.clone().sub(f.last);
      if (v.lengthSq() > 1e-8) f.fly.lookAt(p.clone().add(v));
      f.fly.position.copy(p);
      f.last.copy(p);
      for (const w of f.wings) w.hinge.rotation.z = w.s * (0.5 + Math.sin(t * 140 + f.ph) * 0.6);
    }
  };
}

export function dressTrashBin(ts) {
  const scene = ts.scene;
  /* Dark inside the bin: dim the scene's own lights and reflections. */
  scene.background = new THREE.Color("#060507");
  scene.fog = new THREE.FogExp2("#060507", 0.022);
  /* Enough room reflection for the polish to catch light on dark wood. */
  scene.environmentIntensity = 0.32;
  scene.traverse((o) => {
    if (o.isHemisphereLight) o.intensity = 0.3;
    else if (o.isDirectionalLight) o.intensity *= 0.12;
  });
  ts.renderer.shadowMap.enabled = true;
  ts.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  ts.renderer.toneMappingExposure = 1.0;
  for (const t of ts.tiles) t.receiveShadow = true;
  scene.traverse((o) => { if (o.isMesh && o.geometry?.type === "BoxGeometry" && o.position.y < -0.1) o.receiveShadow = true; });

  /* The hole is behind the black pieces, so they face the player in their
     own shadow. A soft warm fill from the player's side, as if bounced off
     the bin, lights their faces. It is a spotlight on the board only and
     fades out before the walls, so the pieces stand out from the dark bin
     instead of the whole bin getting lighter. */
  const fill = new THREE.SpotLight("#ffdcb4", 60, 17, 0.55, 0.9, 2);
  fill.position.set(0, 8, 9);
  fill.target.position.set(0, 0, -1.5);
  scene.add(fill, fill.target);
  /* A cool rim from high behind, so dark silhouettes stand off the dark bin. */
  const rimLight = new THREE.DirectionalLight("#b8d4ff", 0.8);
  rimLight.position.set(0, 9, -9);
  scene.add(rimLight);

  /* A faint cold bounce off the far wall so the ribbed metal reads. */
  const bounce = new THREE.PointLight("#8fa3b8", 18, 26, 1.4);
  bounce.position.set(0, 6, 6);
  scene.add(bounce);

  const set = new THREE.Group();
  set.add(buildWall(), buildMound(), pizzaBox());
  fillWithRubbish(set);
  scene.add(set);
  /* The stronger room reflections are for the pieces' polish; the bin and
     its rubbish keep the dim reflections they had, so the bin stays dark. */
  set.traverse((o) => { if (o.isMesh && o.material && "envMapIntensity" in o.material) o.material.envMapIntensity = 0.35; });
  const hole = buildHole(scene, new THREE.Vector3(0.3, 0, 0.8));
  const flies = buildFlies(scene);
  /* Pieces cast shadows in the light from the hole; pieces added later
     (after a promotion, say) are picked up as they appear. */
  const castAll = () => {
    for (const e of ts.pieces.values()) {
      if (e.casts) continue;
      e.model.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      e.casts = true;
    }
  };
  castAll();
  let t = 0;
  return {
    update(dt) {
      t += dt;
      hole.updateDust(t);
      flies(t, dt);
      castAll();
    },
  };
}

/* ---- Escape floors: garbage on squares and the square the light falls on ---- */

/* Small things that really are about a square across at this scale (one
   unit is about 4.5 cm): a crumpled receipt, a ball of foil, bottle caps and
   an eggshell. Each sits on a dark stain so the square reads as blocked. */
let junkMats = null;
function junkMaterials() {
  if (junkMats) return junkMats;
  junkMats = {
    paper: new THREE.MeshStandardMaterial({ map: newsprintTexture(), roughness: 0.92, flatShading: true }),
    receipt: new THREE.MeshStandardMaterial({ color: "#f1ede2", roughness: 0.95, flatShading: true }),
    foil: new THREE.MeshStandardMaterial({ color: "#d5d9de", metalness: 1, roughness: 0.32, flatShading: true }),
    caps: ["#c0262e", "#1d5fb0", "#c9a14a"].map((color) => new THREE.MeshStandardMaterial({ color, metalness: 0.75, roughness: 0.35 })),
    capInside: new THREE.MeshStandardMaterial({ color: "#9aa0a6", metalness: 0.8, roughness: 0.4 }),
    eggshell: new THREE.MeshStandardMaterial({ color: "#efe6d8", roughness: 0.7, side: THREE.DoubleSide }),
    stain: new THREE.MeshBasicMaterial({ color: "#1a0e05", transparent: true, opacity: 0.55, depthWrite: false }),
  };
  return junkMats;
}

/** One piece of square-sized garbage, seeded so a level always looks the same. */
function squareJunk(seed) {
  const M = junkMaterials();
  const r = rng(seed);
  const g = new THREE.Group();
  const stain = new THREE.Mesh(new THREE.CircleGeometry(0.46, 20), M.stain);
  stain.rotation.x = -Math.PI / 2;
  stain.position.y = 0.006;
  stain.scale.set(1, 0.8 + r() * 0.3, 1);
  g.add(stain);
  const kind = Math.floor(r() * 4);
  if (kind === 0 || kind === 1) {
    /* A crumpled receipt or a ball of foil. */
    const ball = new THREE.Mesh(crumple(new THREE.IcosahedronGeometry(0.4, 2), 0.3, seed), kind === 0 ? (r() < 0.5 ? M.paper : M.receipt) : M.foil);
    ball.position.y = 0.33;
    ball.rotation.set(r() * 6, r() * 6, r() * 6);
    g.add(ball);
  } else if (kind === 2) {
    /* Two or three bottle caps, one on its back. */
    const n = 2 + Math.floor(r() * 2);
    for (let i = 0; i < n; i++) {
      const cap = new THREE.Group();
      const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.14, 21, 1, true), M.caps[Math.floor(r() * M.caps.length)]);
      const top = new THREE.Mesh(new THREE.CircleGeometry(0.3, 21), M.capInside);
      top.rotation.x = -Math.PI / 2;
      top.position.y = 0.07;
      cap.add(shell, top);
      if (i === 0) cap.rotation.x = Math.PI;
      const a = (i / n) * Math.PI * 2 + r();
      cap.position.set(Math.cos(a) * 0.2, 0.07 + (i === n - 1 && n === 3 ? 0.14 : 0), Math.sin(a) * 0.2);
      cap.rotation.y = r() * 6;
      g.add(cap);
    }
  } else {
    /* A broken eggshell. */
    for (const x of [-0.18, 0.2]) {
      const half = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.eggshell);
      half.position.set(x, 0.2, (r() - 0.5) * 0.2);
      half.rotation.set(Math.PI + (r() - 0.5) * 1.2, r() * 6, (r() - 0.5) * 0.8);
      g.add(half);
    }
  }
  g.rotation.y = r() * Math.PI * 2;
  g.traverse((o) => { if (o.isMesh && o.material !== M.stain) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/** Puts garbage on `squares` and marks `light`, the square the light from the
 *  hole falls on, with a warm column and a pulsing glow. Returns { update(t),
 *  dispose() }; call update from everyFrame. */
export function placeEscapeProps(ts, squares, light) {
  const group = new THREE.Group();
  for (const sq of squares) {
    const junk = squareJunk(sq * 131 + 7);
    junk.position.copy(ts.worldOf(sq));
    group.add(junk);
  }
  let pulse = null;
  if (light != null) {
    const at = ts.worldOf(light);
    const glowCanvas = document.createElement("canvas");
    glowCanvas.width = glowCanvas.height = 128;
    const c = glowCanvas.getContext("2d");
    const grad = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, "rgba(255,240,200,1)");
    grad.addColorStop(0.5, "rgba(255,210,130,0.5)");
    grad.addColorStop(1, "rgba(255,200,120,0)");
    c.fillStyle = grad;
    c.fillRect(0, 0, 128, 128);
    const glowTex = new THREE.CanvasTexture(glowCanvas);
    glowTex.colorSpace = THREE.SRGBColorSpace;
    const disc = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 1.5).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 }),
    );
    disc.position.set(at.x, 0.02, at.z);
    const colCanvas = document.createElement("canvas");
    colCanvas.width = 4; colCanvas.height = 128;
    const cc = colCanvas.getContext("2d");
    const vg = cc.createLinearGradient(0, 128, 0, 0);
    vg.addColorStop(0, "rgba(255,230,180,0.85)");
    vg.addColorStop(1, "rgba(255,230,180,0)");
    cc.fillStyle = vg;
    cc.fillRect(0, 0, 4, 128);
    const colTex = new THREE.CanvasTexture(colCanvas);
    colTex.colorSpace = THREE.SRGBColorSpace;
    const column = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.5, 4.5, 24, 1, true).translate(0, 2.25, 0),
      new THREE.MeshBasicMaterial({ map: colTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, opacity: 0.4 }),
    );
    column.position.set(at.x, 0, at.z);
    group.add(disc, column);
    pulse = (t) => {
      const k = 0.5 + 0.5 * Math.sin(t * 2.4);
      disc.material.opacity = 0.65 + 0.35 * k;
      column.material.opacity = 0.3 + 0.15 * k;
    };
  }
  ts.scene.add(group);
  return {
    update(t) { pulse?.(t); },
    dispose() {
      ts.scene.remove(group);
      group.traverse((o) => {
        if (!o.isMesh) return;
        o.geometry.dispose();
        /* Shared garbage materials stay; the light's own ones go. */
        if (o.material.map && (o.material.blending === THREE.AdditiveBlending)) { o.material.map.dispose(); o.material.dispose(); }
      });
    },
  };
}
