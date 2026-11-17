/* The volcano's boss: the fire giant. A body of black rock split by
   glowing cracks, flames burning on his head and shoulders, eyes and mouth
   like the inside of a furnace. Far off by the volcano for the world's
   first half, wading closer through the lava in the second, and on the
   last floor standing waist-deep behind the board, moving the enemy's
   pieces with his own hand. If you lose to him, he destroys your pieces.

   Same controls as the other bosses: update(dt), setRise(0|1|2), reach,
   carry, rest, slam, roar, melt (beaten: he crumbles into the lava), and
   finish(points) (you lost: his fists come down on your pieces). */
import * as THREE from "three";
import { play as playSound } from "../sound.js";
import { dress } from "./art.js";

const ease = (t) => t * t * (3 - 2 * t);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const SPOTS = [
  { pos: new THREE.Vector3(14, -5.5, -62), scale: 3.4 },
  { pos: new THREE.Vector3(-6, -4.2, -30), scale: 2.2 },
  { pos: new THREE.Vector3(0, -3.4, -12.5), scale: 1.55 },
];

/* Molten veins, for the rock's emissive map: forking cracks with a soft
   red glow round a hot yellow-white core, the way magma shows through. */
function crackTexture(seed) {
  const S = 512;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d");
  g.fillStyle = "#000"; g.fillRect(0, 0, S, S);
  let s = seed;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const paths = [];
  const crack = (x, y, a, n, w) => {
    const pts = [[x, y]];
    for (let i = 0; i < n; i++) {
      a += (r() - 0.5) * 0.9;
      x += Math.cos(a) * (10 + r() * 16); y += Math.sin(a) * (10 + r() * 16);
      pts.push([x, y]);
      if (w > 1.2 && r() < 0.18) crack(x, y, a + (r() < 0.5 ? 1 : -1) * (0.6 + r() * 0.6), Math.floor(n * 0.5), w * 0.55);
    }
    paths.push([pts, w]);
  };
  for (let k = 0; k < 9; k++) crack(r() * S, r() * S, r() * 6.28, 9 + Math.floor(r() * 8), 2.5 + r() * 3);
  g.lineCap = g.lineJoin = "round";
  const draw = (color, scale, blur) => {
    g.shadowColor = color; g.shadowBlur = blur; g.strokeStyle = color;
    for (const [pts, w] of paths) {
      g.lineWidth = w * scale;
      g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
      for (const [x, y] of pts.slice(1)) g.lineTo(x, y);
      g.stroke();
    }
  };
  draw("#7a1404", 3.2, 18);
  draw("#ff5a10", 1.5, 8);
  draw("#ffd27a", 0.55, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/* A soft round glow, for eyes, mouth and heart. */
function glowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d"), grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)"); grad.addColorStop(0.35, "rgba(255,255,255,0.45)"); grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function flameTexture() {
  const c = document.createElement("canvas");
  c.width = 64; c.height = 128;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(32, 96, 2, 32, 80, 60);
  grad.addColorStop(0, "rgba(255,240,180,1)"); grad.addColorStop(0.3, "rgba(255,170,40,0.9)"); grad.addColorStop(0.7, "rgba(230,60,10,0.45)"); grad.addColorStop(1, "rgba(120,10,0,0)");
  g.fillStyle = grad;
  g.beginPath(); g.moveTo(32, 4); g.quadraticCurveTo(60, 70, 50, 110); g.quadraticCurveTo(32, 128, 14, 110); g.quadraticCurveTo(4, 70, 32, 4); g.fill();
  return new THREE.CanvasTexture(c);
}

export function buildFireGiant(ts) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const veins = crackTexture(7);
  const rock = new THREE.MeshStandardMaterial({ color: "#2a1d18", roughness: 0.95, flatShading: true, emissive: "#ff6a12", emissiveMap: veins, emissiveIntensity: 1.6 });
  const darkRock = new THREE.MeshStandardMaterial({ color: "#1a1210", roughness: 1, flatShading: true });
  dress(rock, "volcano", "rock", { maps: ["diff", "nor"], repeat: 1, tint: "#4a3a34", normal: 1.6 });
  dress(darkRock, "volcano", "rock", { maps: ["diff", "nor"], repeat: 1, tint: "#2a201c", normal: 1.6 });
  const furnace = new THREE.MeshBasicMaterial({ color: "#ffe9b0" });
  const mouthGlow = new THREE.MeshBasicMaterial({ color: "#ff6a1a" });
  const glowMap = glowTexture();
  const glow = (color, size, opacity = 0.85) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowMap, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity })); sp.scale.setScalar(size); return sp; };
  const piece = (geo, mat, x, y, z, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; return m; };
  const lump = new THREE.DodecahedronGeometry(1, 0);

  /* Torso, heaving as he breathes. */
  const chest = new THREE.Group();
  chest.position.y = 2.6;
  body.add(chest);
  chest.add(piece(lump, rock, 0, 0, 0, 1.9, 1.7, 1.25));
  chest.add(piece(lump, rock, 0, -1.5, 0.1, 1.45, 1.1, 1.05));
  chest.add(piece(lump, darkRock, 0, 0.3, 0.95, 1.1, 0.9, 0.35)); // the plate on his chest
  /* The furnace in his chest, showing through the plate. */
  const core = piece(new THREE.SphereGeometry(0.3, 16, 12), furnace, 0, 0.1, 1.12, 1, 1, 0.45);
  const heartGlow = glow("#ff6a14", 1.9, 0.9);
  heartGlow.position.set(0, 0.1, 1.3);
  chest.add(core, heartGlow);
  /* Shoulders. */
  for (const s of [-1, 1]) chest.add(piece(lump, rock, s * 1.95, 0.85, 0, 0.95, 0.85, 0.95));
  /* The head: a heavy brow, furnace eyes, a mouth full of fire, horns. */
  const head = new THREE.Group();
  head.position.set(0, 2.1, 0.25);
  chest.add(head);
  head.add(piece(lump, rock, 0, 0, 0, 0.95, 1.05, 0.9));
  /* Deep sockets with white-hot eyes slanted in rage, under two heavy
     brows that meet low in a V. */
  const eyes = [-1, 1].map((s) => {
    head.add(piece(new THREE.SphereGeometry(0.2, 12, 8), darkRock, s * 0.34, 0.16, 0.7, 1.3, 0.8, 0.5));
    const e = piece(new THREE.SphereGeometry(0.13, 12, 8), furnace, s * 0.34, 0.16, 0.8, 1.35, 0.55, 0.5);
    e.rotation.z = s * 0.35;
    const g = glow("#ff8a2a", 0.75);
    g.position.set(s * 0.34, 0.16, 0.9);
    head.add(e, g);
    const brow = piece(lump, darkRock, s * 0.36, 0.42, 0.66, 0.46, 0.15, 0.3);
    brow.rotation.z = s * 0.45;
    head.add(brow);
    return { e, g };
  });
  /* The mouth: a furnace behind a row of rock fangs, and a jaw that drops. */
  const mouth = new THREE.Group();
  mouth.position.set(0, -0.42, 0.74);
  head.add(mouth);
  const maw = piece(new THREE.SphereGeometry(0.4, 16, 10), mouthGlow, 0, -0.06, 0, 1, 0.3, 0.3);
  const mawGlow = glow("#ff5a10", 1.2, 0.7);
  mawGlow.position.set(0, -0.08, 0.2);
  mouth.add(maw, mawGlow);
  const fang = new THREE.ConeGeometry(0.06, 0.22, 5);
  for (let i = 0; i < 6; i++) { const x = -0.3 + i * 0.12; const tooth = piece(fang, darkRock, x, 0.04, 0.12 - Math.abs(x) * 0.2, 1, i === 1 || i === 4 ? 1.5 : 1, 1); tooth.rotation.x = Math.PI; mouth.add(tooth); }
  const jaw = new THREE.Group();
  jaw.position.set(0, -0.06, -0.1);
  jaw.add(piece(lump, rock, 0, -0.16, 0.06, 0.48, 0.16, 0.36));
  for (let i = 0; i < 5; i++) { const x = -0.24 + i * 0.12; jaw.add(piece(fang, darkRock, x, -0.02, 0.24 - Math.abs(x) * 0.25, 0.9, i === 0 || i === 4 ? 1.4 : 0.8, 0.9)); }
  mouth.add(jaw);
  for (const s of [-1, 1]) {
    const horn = piece(new THREE.ConeGeometry(0.22, 1.2, 6), darkRock, s * 0.7, 0.85, -0.1);
    horn.rotation.z = -s * 0.7;
    head.add(horn);
  }
  /* Flames on his head and shoulders. */
  const flameMat = new THREE.SpriteMaterial({ map: flameTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const flames = [];
  for (const [parent, x, y, z, sz] of [[head, 0, 0.9, 0, 1.6], [head, -0.4, 0.75, -0.2, 1.1], [head, 0.45, 0.78, -0.2, 1.2], [chest, -1.95, 1.7, 0, 1.4], [chest, 1.95, 1.7, 0, 1.4]]) {
    const f = new THREE.Sprite(flameMat);
    f.position.set(x, y, z);
    f.scale.set(sz * 0.6, sz, 1);
    parent.add(f);
    flames.push({ f, base: sz, ph: Math.random() * 6 });
  }
  /* His arms: rock drawn from the shoulder to wherever the hand is. */
  const armGeo = new THREE.CylinderGeometry(0.55, 0.42, 1, 7);
  const arms = [-1, 1].map((side) => {
    const arm = piece(armGeo, rock, 0, 0, 0);
    const fist = new THREE.Group();
    fist.add(piece(lump, rock, 0, 0, 0, 0.8, 0.65, 0.75));
    for (let i = 0; i < 3; i++) fist.add(piece(lump, darkRock, (i - 1) * 0.36, -0.15, 0.55, 0.2, 0.22, 0.22));
    root.add(arm, fist);
    return { side, arm, fist, goal: null, at: new THREE.Vector3(), speed: 6 };
  });

  /* Embers rising off his head and shoulders. */
  const EMBERS = 70, emberPos = new Float32Array(EMBERS * 3), embers = [];
  const emberHome = () => { const spot = [[0, 4.9, 0.2], [-1.95, 4.2, 0], [1.95, 4.2, 0]][Math.floor(Math.random() * 3)]; return { x: spot[0] + (Math.random() - 0.5) * 0.8, y: spot[1], z: spot[2] + (Math.random() - 0.5) * 0.6 }; };
  for (let i = 0; i < EMBERS; i++) embers.push({ ...emberHome(), life: Math.random(), sp: 0.6 + Math.random() * 1.2, ph: Math.random() * 6 });
  const emberGeo = new THREE.BufferGeometry();
  emberGeo.setAttribute("position", new THREE.BufferAttribute(emberPos, 3));
  const emberPoints = new THREE.Points(emberGeo, new THREE.PointsMaterial({ map: glowMap, color: "#ffa040", size: 0.16, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  emberPoints.frustumCulled = false;
  body.add(emberPoints);

  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  root.position.copy(SPOTS[0].pos);
  root.scale.setScalar(SPOTS[0].scale);
  root.rotation.y = -0.25;
  ts.scene.add(root);

  let t = 0, stage = 0, open = 0, openGoal = 0, crumble = 0, heat = 1;
  let move = null;
  const tmp = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const shoulderLocal = (side) => new THREE.Vector3(side * 1.95, chest.position.y + 0.85 + body.position.y, 0);
  const restLocal = (side) => new THREE.Vector3(side * 2.4, 0.8 + Math.sin(t * 1.2 + side) * 0.1, 0.5);

  return {
    update(dt) {
      t += dt;
      if (move) {
        move.k = Math.min(1, move.k + (dt * 1000) / move.ms);
        const k = ease(move.k);
        root.position.lerpVectors(move.from, move.to.pos, k);
        root.position.y += Math.abs(Math.sin(move.k * Math.PI * 4)) * 0.3; // wading steps
        root.scale.setScalar(move.fromScale + (move.to.scale - move.fromScale) * k);
        root.rotation.y = -0.25 * (1 - k) * (stage === 2 ? 1 : 0) + (stage === 2 ? 0 : -0.25 * k);
        if (move.k >= 1) move = null;
      }
      body.position.y = Math.sin(t * 0.9) * 0.08 - crumble * 6;
      chest.rotation.x = 0.18 + Math.sin(t * 0.9) * 0.03 + open * -0.12;
      head.rotation.y = Math.sin(t * 0.4) * 0.2;
      head.rotation.x = 0.1 - open * 0.25;
      open += (openGoal - open) * Math.min(1, dt * 7);
      jaw.rotation.x = 0.12 + open * 0.65;
      maw.scale.y = 0.3 + open * 0.9;
      mawGlow.material.opacity = (0.5 + open * 0.3) * Math.min(heat, 1.15);
      mawGlow.scale.setScalar(1.1 + open * 0.6);
      heartGlow.material.opacity = (0.7 + 0.25 * Math.sin(t * 3)) * heat;
      for (let i = 0; i < EMBERS; i++) {
        const e = embers[i];
        e.life -= dt * 0.45 * e.sp;
        if (e.life <= 0) Object.assign(e, emberHome(), { life: 1 });
        e.y += dt * e.sp * (1 + open);
        e.x += Math.sin(t * 2 + e.ph) * dt * 0.3;
        emberPos[i * 3] = e.x; emberPos[i * 3 + 1] = e.y; emberPos[i * 3 + 2] = e.z;
      }
      emberGeo.attributes.position.needsUpdate = true;
      emberPoints.visible = heat > 0.3;
      const flicker = 0.85 + 0.15 * Math.sin(t * 17) * Math.sin(t * 7.3);
      rock.emissiveIntensity = (0.65 + 0.3 * Math.sin(t * 1.6)) * heat;
      core.scale.setScalar(1 + 0.08 * Math.sin(t * 3));
      for (const { e, g } of eyes) { e.scale.y = (t % 4.6 > 4.45 ? 0.08 : 0.55) * flicker; g.material.opacity = 0.85 * heat * flicker; }
      for (const fl of flames) { const k = 1 + 0.18 * Math.sin(t * 11 + fl.ph) + open * 0.6; fl.f.scale.set(fl.base * 0.6 * (1 + open * 0.3), fl.base * k, 1); }
      /* Arms. */
      for (const a of arms) {
        const goalLocal = a.goal ? root.worldToLocal(tmp.copy(a.goal)) : restLocal(a.side);
        a.at.lerp(goalLocal, Math.min(1, dt * a.speed));
        const sh = shoulderLocal(a.side);
        const len = sh.distanceTo(a.at);
        a.arm.position.copy(sh).add(a.at).multiplyScalar(0.5);
        a.arm.scale.set(1, Math.max(0.2, len), 1);
        a.arm.quaternion.setFromUnitVectors(up, a.at.clone().sub(sh).normalize());
        a.fist.position.copy(a.at);
      }
      ts.wake?.();
    },
    setRise(level) {
      if (level === stage && !move) return;
      stage = level;
      crumble = 0;
      root.visible = true;
      move = { from: root.position.clone(), fromScale: root.scale.x, to: SPOTS[level], k: 0, ms: 1400 + root.position.distanceTo(SPOTS[level].pos) * 60 };
      playSound("rumble", { volume: 0.7 });
      ts.wake?.();
    },
    get risen() { return stage === 2; },
    async reach(point) {
      const a = arms[point.x < 0 ? 0 : 1];
      a.speed = 8;
      a.goal = point.clone().setY(point.y + 1.0);
      playSound("crunch", { volume: 0.35, rate: 0.6 });
      await wait(380);
      return a;
    },
    carry(a, point, ms) {
      const from = a.goal.clone(), to = point.clone().setY(point.y + 1.0);
      return new Promise((resolve) => ts.tween(ms, (k) => { a.goal = from.clone().lerp(to, ease(k)); a.goal.y += Math.sin(k * Math.PI) * 0.5; }, resolve));
    },
    rest() { for (const a of arms) { a.goal = null; a.speed = 5; } },
    /** A fist comes down on the board at `point`. Resolves at the blow. */
    async slam(point) {
      const a = arms[point.x < 0 ? 0 : 1];
      openGoal = 1;
      a.speed = 6;
      a.goal = point.clone().setY(5.5);
      await wait(430);
      a.speed = 26;
      a.goal = point.clone().setY(0.4);
      await wait(110);
      playSound("punchHeavy", { volume: 1 });
      playSound("crunch", { volume: 0.9 });
      playSound("rumble", { volume: 0.6 });
      ts.shake = 0.26;
      ts.tween(560, (k) => { ts.shake = 0.26 * (1 - k); }, () => { ts.shake = 0; });
      await wait(260);
      openGoal = 0;
      a.goal = null;
      a.speed = 5;
    },
    /** A roar, fire pouring from his mouth and flames leaping. */
    async roar() {
      openGoal = 1;
      heat = 1.8;
      playSound("rumble", { volume: 1 });
      playSound("whoom", { volume: 1 });
      playSound("crunch", { volume: 0.6, rate: 0.5 });
      ts.shake = 0.14;
      for (const a of arms) { a.speed = 5; a.goal = root.localToWorld(new THREE.Vector3(a.side * 3.4, 6.2, 1)); }
      await wait(1300);
      ts.tween(400, (k) => { ts.shake = 0.14 * (1 - k); }, () => { ts.shake = 0; });
      openGoal = 0;
      heat = 1;
      for (const a of arms) a.goal = null;
      await wait(350);
    },
    /** Beaten: the fire goes out of him and he crumbles into the lava. */
    async melt() {
      openGoal = 0.4;
      playSound("crunch", { volume: 1 });
      playSound("rumble", { volume: 0.9, delay: 0.3 });
      await new Promise((resolve) => ts.tween(1900, (k) => { heat = 1 - ease(k) * 0.9; crumble = ease(Math.max(0, k - 0.2) / 0.8); }, resolve));
      root.visible = false;
      heat = 1;
      await wait(300);
    },
    /** You lost: his fists come down on your pieces, one after another. */
    async finish(points) {
      for (const p of points.slice(0, 4)) await this.slam(p);
      await this.roar();
    },
    dispose() { ts.scene.remove(root); },
  };
}
