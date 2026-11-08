/* The tutorial set: the board inside a metal trash bin, sitting on a
   flattened pizza box on a pile of garbage. A ragged hole in the back wall
   lets in a shaft of light with dust in it, and flies buzz about. Call
   dressTrashBin(tacticaScene) and add the returned update to its everyFrame
   list. */
import * as THREE from "three";

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
  /* Black bin-bag plastic: dark, with a soft sheen. */
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: "#16171b", roughness: 0.32, metalness: 0.05 }));
  mesh.receiveShadow = true;
  return mesh;
}

/* A full bin bag: a lumpy, glossy black blob with its tied neck. */
function binBag(r, s) {
  const geo = new THREE.SphereGeometry(1, 28, 20);
  const p = geo.getAttribute("position");
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(p, i);
    const k = 1 + 0.12 * Math.sin(v.x * 7 + s * 3) * Math.sin(v.y * 6) + 0.08 * Math.sin(v.z * 9 + s);
    v.multiplyScalar(k);
    v.y *= v.y < 0 ? 0.55 : 0.8;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: "#121316", roughness: 0.28, metalness: 0.08 });
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

/* Small pieces of rubbish, each centred on the ground point it sits on. */
const PAPER = new THREE.MeshStandardMaterial({ color: "#e8e2d2", roughness: 0.95 });
const CARD = new THREE.MeshStandardMaterial({ color: "#9b7448", roughness: 0.9 });
const TIN = new THREE.MeshStandardMaterial({ color: "#c7ccd1", metalness: 0.9, roughness: 0.35 });
const GLASS = new THREE.MeshStandardMaterial({ color: "#2f6b3d", roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.75 });
const PEEL = new THREE.MeshStandardMaterial({ color: "#d9b43a", roughness: 0.7 });
const BRUISE = new THREE.MeshStandardMaterial({ color: "#5a4420", roughness: 0.8 });
const LABELS = ["#c0392b", "#2e86c1", "#27ae60", "#f39c12", "#8e44ad"].map((c) => new THREE.MeshStandardMaterial({ color: c, metalness: 0.5, roughness: 0.4 }));

function crumpledPaper(r) {
  const geo = new THREE.IcosahedronGeometry(0.28, 1);
  const p = geo.getAttribute("position");
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(p, i).multiplyScalar(0.75 + r() * 0.45);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, PAPER);
  m.position.y = 0.18;
  return m;
}
function can(r) {
  const g = new THREE.Group();
  const crushed = r() < 0.5;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.48, 18), TIN);
  const label = new THREE.Mesh(new THREE.CylinderGeometry(0.163, 0.163, 0.3, 18, 1, true), LABELS[Math.floor(r() * LABELS.length)]);
  g.add(body, label);
  if (crushed) g.scale.set(1.15, 0.45, 1.15);
  g.rotation.set(Math.PI / 2 * (r() < 0.6 ? 1 : 0), r() * 6, 0);
  g.position.y = 0.16;
  return g;
}
function cardboard(r) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.9 + r() * 0.8, 0.04, 0.6 + r() * 0.6), CARD);
  m.rotation.set((r() - 0.5) * 0.6, r() * 6, (r() - 0.5) * 0.6);
  m.position.y = 0.08;
  return m;
}
function bottle() {
  const pts = [[0, 0], [0.13, 0], [0.14, 0.05], [0.14, 0.42], [0.11, 0.52], [0.05, 0.6], [0.05, 0.72], [0.06, 0.74], [0, 0.74]].map(([x, y]) => new THREE.Vector2(x, y));
  const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 20), GLASS);
  m.rotation.z = Math.PI / 2;
  m.position.y = 0.14;
  return m;
}
function bananaPeel(r) {
  const g = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const strip = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.28, 4, 8), PEEL);
    strip.scale.set(1.6, 1, 0.5);
    strip.rotation.set(Math.PI / 2 - 0.3, (i / 4) * Math.PI * 2 + r(), 0);
    strip.position.set(Math.sin((i / 4) * Math.PI * 2) * 0.14, 0.05, Math.cos((i / 4) * Math.PI * 2) * 0.14);
    g.add(strip);
  }
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.12, 8), BRUISE);
  stem.position.y = 0.08;
  g.add(stem);
  return g;
}
function appleCore() {
  const pts = [[0, 0], [0.13, 0.02], [0.07, 0.12], [0.06, 0.2], [0.13, 0.3], [0, 0.32]].map(([x, y]) => new THREE.Vector2(x, y));
  const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 14), new THREE.MeshStandardMaterial({ color: "#efe0b5", roughness: 0.8 }));
  m.rotation.z = 1.3;
  m.position.y = 0.14;
  return m;
}
function cup(r) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.12, 0.42, 16, 1, true), new THREE.MeshStandardMaterial({ color: r() < 0.5 ? "#f2efe9" : "#c94f3b", roughness: 0.7, side: THREE.DoubleSide }));
  m.rotation.z = Math.PI / 2;
  m.position.y = 0.15;
  return m;
}

function scatterRubbish(group) {
  const r = rng(7);
  const makers = [[crumpledPaper, 0.32], [can, 0.18], [cardboard, 0.14], [bottle, 0.1], [cup, 0.1], [bananaPeel, 0.08], [appleCore, 0.08]];
  let placed = 0, tries = 0;
  while (placed < 95 && tries < 2000) {
    tries++;
    const a = r() * Math.PI * 2, d = 4.9 + r() * (BIN_R - 5.4);
    const x = Math.sin(a) * d, z = Math.cos(a) * d;
    if (Math.abs(x) < BOARD_HALF && Math.abs(z) < BOARD_HALF) continue;
    let pick = r(), make = makers[0][0];
    for (const [fn, w] of makers) { if (pick < w) { make = fn; break; } pick -= w; }
    const item = new THREE.Group();
    const thing = make(r);
    item.add(thing);
    item.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    item.position.set(x, moundHeight(x, z) - 0.12, z);
    item.rotation.y = r() * Math.PI * 2;
    item.scale.setScalar(0.9 + r() * 0.5);
    group.add(item);
    placed++;
  }
  /* Bin bags piled against the wall. */
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + r() * 0.4, d = BIN_R - 2.2 - r() * 1.2;
    const bag = binBag(1.4 + r() * 1.1, i);
    const x = Math.sin(a) * d, z = Math.cos(a) * d;
    bag.position.set(x, moundHeight(x, z) + 0.2, z);
    bag.rotation.y = r() * 6;
    group.add(bag);
  }
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
  scene.environmentIntensity = 0.12;
  scene.traverse((o) => {
    if (o.isHemisphereLight) o.intensity = 0.22;
    else if (o.isDirectionalLight) o.intensity *= 0.12;
  });
  ts.renderer.shadowMap.enabled = true;
  ts.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  ts.renderer.toneMappingExposure = 1.0;
  for (const t of ts.tiles) t.receiveShadow = true;
  scene.traverse((o) => { if (o.isMesh && o.geometry?.type === "BoxGeometry" && o.position.y < -0.1) o.receiveShadow = true; });

  /* A faint cold bounce off the far wall so the ribbed metal reads. */
  const bounce = new THREE.PointLight("#8fa3b8", 18, 26, 1.4);
  bounce.position.set(0, 6, 6);
  scene.add(bounce);

  const set = new THREE.Group();
  set.add(buildWall(), buildMound(), pizzaBox());
  scatterRubbish(set);
  scene.add(set);
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
