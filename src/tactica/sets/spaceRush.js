/* Puzzle Rush Tactica's world: the board floating in space, in the main
   site's colours (deep violet void, violet, magenta, cyan), with still
   stars, two faint nebula glows, a few small cats drifting far off, and
   Zlegend2700 himself watching from beyond the board: his pixel avatar
   (public avatar, PixelAvatar.jsx ZPIX) built in 3D, still, eyes glowing.

   Everything is made in code: nothing to download. Kept calm on purpose,
   it's a race against the clock: the stars and Zlegend never move, the
   cats drift slowly and stay dim, and the busy parts sit far from the
   board. No transmission materials, no extra shadows (performance rules). */
import * as THREE from "three";
import { outline, toonify } from "../film3d/anime.js";

/* The site's colours (src/index.css) and Zlegend's avatar palette (ZPAL). */
const VOID = "#0E0620", VIOLET = "#8B2FC9", MAGENTA = "#D94BF0", CYAN = "#3EE7F5", LILIAC = "#C9C2E8";

/* Where Zlegend floats: beyond the far edge of the board, above it, not too
   big (he watches, he doesn't loom). */
const ZLEGEND_AT = new THREE.Vector3(0, -1.7, -8.6);
const ZLEGEND_SCALE = 1.2;

export function dressSpaceRush(ts) {
  const scene = ts.scene;
  const added = [];
  const add = (o) => { scene.add(o); added.push(o); return o; };

  scene.background = new THREE.Color(VOID);
  scene.fog = null;
  scene.environmentIntensity = 0.3;
  ts.renderer.shadowMap.enabled = false;
  ts.renderer.toneMappingExposure = 1.0;
  /* The scene's own lights, cooled to the void: violet from above, deep
     purple from below; a soft white key from the player's side so the
     pieces read clearly, and a magenta rim from beyond so they stand off
     the dark. */
  scene.traverse((o) => {
    if (o.isHemisphereLight) { o.color.set("#d9ccff"); o.groundColor.set("#2a0e4a"); o.intensity = 0.35; }
    else if (o.isDirectionalLight) o.intensity *= 0.15;
  });
  const key = add(new THREE.DirectionalLight("#f4efff", 0.85));
  key.position.set(2, 9, 8);
  const rim = add(new THREE.DirectionalLight(MAGENTA, 0.6));
  rim.position.set(0, 6, -10);

  /* Stars: still points on a far sphere, mostly white, some liliac and cyan. */
  {
    const count = 1400, pos = new Float32Array(count * 3), col = new Float32Array(count * 3);
    const tints = [new THREE.Color("#ffffff"), new THREE.Color(LILIAC), new THREE.Color(CYAN), new THREE.Color("#ffd9f6")];
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < count; i++) {
      const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, r = 55 + rnd() * 20;
      const s = Math.sqrt(1 - u * u);
      pos.set([Math.cos(a) * s * r, u * r * 0.8 + 6, Math.sin(a) * s * r], i * 3);
      const t = tints[rnd() < 0.7 ? 0 : 1 + Math.floor(rnd() * 3)];
      const dim = 0.45 + rnd() * 0.55;
      col.set([t.r * dim, t.g * dim, t.b * dim], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const stars = new THREE.Points(g, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false }));
    stars.renderOrder = -2;
    add(stars);
  }

  /* Two faint nebula glows far behind, violet and magenta: colour, not detail. */
  const glow = (inner, outer) => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const x = c.getContext("2d");
    const grad = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, inner);
    grad.addColorStop(1, outer);
    x.fillStyle = grad;
    x.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const nebulaTex = glow("rgba(255,255,255,1)", "rgba(255,255,255,0)");
  for (const [color, at, size, opacity] of [[VIOLET, [-22, 10, -45], 48, 0.22], [MAGENTA, [24, 4, -40], 36, 0.12]]) {
    const s = add(new THREE.Sprite(new THREE.SpriteMaterial({ map: nebulaTex, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending })));
    s.position.set(...at);
    s.scale.set(size, size * 0.6, 1);
    s.renderOrder = -1;
  }

  /* Under the board, a soft violet glow: it floats. */
  {
    const under = add(new THREE.Mesh(new THREE.PlaneGeometry(15, 15), new THREE.MeshBasicMaterial({ map: nebulaTex, color: VIOLET, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending })));
    under.rotation.x = -Math.PI / 2;
    under.position.y = -1.6;
  }

  /* Small pixel cats drifting in the margins: cute, dim, slow. */
  const cats = [];
  /* Where a portrait phone's view reaches: the band above the board's far
     edge (round Zlegend, kept clear of him) and the space under its near
     side, clear of the bottom bar. */
  const spots = [[-4.4, 1.6, -11.5], [4.6, 0.6, -10.5], [-4.6, -2.6, -9], [3.8, 4.6, -17], [-3.6, -4.6, 4.2], [3.4, -5.4, 5.4], [-1.2, -6.2, 7]];
  spots.forEach((at, i) => {
    const cat = buildCat(i);
    cat.position.set(...at);
    cat.scale.setScalar(1.25 + (i % 3) * 0.2);
    add(cat);
    cats.push({ cat, base: cat.position.clone(), phase: i * 1.7, tilt: (i % 2 ? 1 : -1) * 0.12 });
  });

  /* Zlegend2700, still, eyes glowing (built below). */
  const zlegend = buildZlegend();
  zlegend.position.copy(ZLEGEND_AT);
  zlegend.scale.setScalar(ZLEGEND_SCALE);
  add(zlegend);

  let t = 0;
  return {
    zlegend,
    update(dt) {
      t += dt;
      /* A slow bob and a gentle sway, like floating in water. */
      for (const c of cats) {
        c.cat.position.y = c.base.y + Math.sin(t * 0.4 + c.phase) * 0.3;
        c.cat.position.x = c.base.x + Math.sin(t * 0.13 + c.phase) * 0.5;
        c.cat.material.rotation = c.tilt * Math.sin(t * 0.3 + c.phase);
      }
    },
    dispose() { for (const o of added) scene.remove(o); },
  };
}

/* ---- Pixel cats ----
   Small 2D pixel-art cats, drawn here cell by cell (20 by 20), in two poses
   and six coats from the site's palette, shown as flat sprites that always
   face you. Letters: o outline, b coat, s coat shade, w muzzle and belly,
   p pink (inner ears, nose, blush), e eye, h eye shine, t tabby stripe. */
const CAT_POSES = {
  sit: [
    "...oo..........oo...",
    "..obpo........opbo..",
    "..obppo......oppbo..",
    "..obbbsoooooosbbbo..",
    ".obbbbbbtbbtbbbbbbo.",
    ".obbbbbbbbbbbbbbbbo.",
    "obbbbeebbbbbbeebbbbo",
    "obbbbehbbbbbbehbbbbo",
    "obbbbeebbwwbbeebbbbo",
    "obppbbbbwwpwwbbbppbo",
    ".obbbbbbwwwwwbbbbbo.",
    "..oobbbbbbbbbbbboo..",
    "...osbbbbbbbbbbsooo.",
    "..osbbbwwwwwwbbbsobo",
    "..osbbwwwwwwwwbbsobo",
    "..osbbwwwwwwwwbbsobo",
    "..oosbbwwwwwwbbsoob.",
    "...owbbbwbbwbbbwoo..",
    "...oowwoowwoowwoo...",
    "....oo..oo..oo.oo...",
  ],
  loaf: [
    "....................",
    "....................",
    "....oo........oo....",
    "...obpo......opbo...",
    "...obppooooooppbo...",
    "..obbbbbtbbtbbbbbo..",
    ".obbbbbbbbbbbbbbbbo.",
    ".obbboobbbbbboobbbo.",
    ".obbbbbbbwwbbbbbbbo.",
    ".obppbbbwwpwwbbppbo.",
    "..obbbbbbwwwbbbbbbo.",
    ".oobbbbbbbbbbbbbbbboo",
    "obsbbbtbbbbbbtbbbbsbo",
    "obsbbbbbbbbbbbbbbbsbo",
    "obssbbbbbbbbbbbbbssbo",
    ".obssssssssssssssssbo",
    "..owwoowwooooowwoowwo",
    "...oo..oo.....oo..oo.",
    "....................",
    "....................",
  ],
};
const CAT_COATS = [
  { b: "#C9C2E8", s: "#9D8FC4", t: "#b4aad8" },
  { b: "#f5a7db", s: "#d77fbd", t: "#e996cc" },
  { b: "#a7e9f5", s: "#6fc3d6", t: "#8fdbea" },
  { b: "#fff1dc", s: "#e5cda8", t: "#f2ddbb" },
  { b: "#b48ef0", s: "#8B2FC9", t: "#9d6ce0" },
  { b: "#ffc27a", s: "#e0904a", t: "#e88f3c" },
];
const CAT_INK = { o: "#1d0f33", w: "#ffffff", p: "#ff8fc8", e: "#1d0f33", h: "#ffffff" };
const catTextures = new Map();
function catTexture(pose, coat) {
  const key = pose + coat;
  if (catTextures.has(key)) return catTextures.get(key);
  const rows = CAT_POSES[pose], c = CAT_COATS[coat];
  const n = Math.max(rows.length, ...rows.map((r) => r.length)), px = 4;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = n * px;
  const x = canvas.getContext("2d");
  rows.forEach((row, ry) => {
    for (let rx = 0; rx < n; rx++) {
      const ch = row[rx];
      const color = ch === "b" || ch === "s" || ch === "t" ? c[ch] : CAT_INK[ch];
      if (!color) continue;
      x.fillStyle = color;
      x.fillRect(rx * px, ry * px, px, px);
    }
  });
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  catTextures.set(key, t);
  return t;
}
/** A pixel cat sprite (about 1 unit square at scale 1). */
function buildCat(i) {
  const pose = i % 3 === 2 ? "loaf" : "sit";
  const mat = new THREE.SpriteMaterial({ map: catTexture(pose, i % CAT_COATS.length), transparent: true, depthWrite: false, fog: false });
  /* Dimmed a little, so they sit back in the scene. */
  mat.color.setScalar(0.85);
  const sprite = new THREE.Sprite(mat);
  sprite.renderOrder = -1;
  return sprite;
}

/* ---- Zlegend2700 ----
   Built from his art (bot-happy.webp, bot-angry.webp, the pixel avatar):
   a big swept-up spiky green hairdo with a gold circlet and an amber gem,
   a blue face with a dark red mask across glowing cyan eyes and a white
   grin, a pink military jacket with gold trim and buttons, dark red
   pauldrons edged in gold, blue gloves raised holding green blasters with
   cyan glass, red-brown trousers, and a wide jagged green cape lined in
   teal. Cel-shaded with an ink outline so he reads clearly from afar.
   Still: only his eyes glow. About 3 units tall, feet at 0, facing +z. */
const ZC = {
  hair: "#7fdc6a", hair2: "#58bf55", face: "#4fb4d4", mask: "#6a1626", eye: "#7cfff1", teeth: "#ffffff",
  jacket: "#f4a9d6", gold: "#f2c14a", pauldron: "#8a1f2e", collar: "#5b1d6e", glove: "#2f63cf",
  blaster: "#45d07a", glass: "#7cfff1", pants: "#7a2b22", boots: "#2b1a2e", cape: "#4fcf8c", lining: "#2c9488", mark: "#c4232f",
};
export function buildZlegend() {
  const g = new THREE.Group();
  const mats = new Map();
  const mat = (color, extra = {}) => {
    const key = color + JSON.stringify(extra);
    if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...extra }));
    return mats.get(key);
  };
  const add = (geo, m, at, rot, scale) => {
    const mesh = new THREE.Mesh(geo, m);
    if (at) mesh.position.set(...at);
    if (rot) mesh.rotation.set(...rot);
    if (scale) mesh.scale.set(...scale);
    g.add(mesh);
    return mesh;
  };
  /* A limb or rod from point a to point b. */
  const rod = (a, b, r0, r1, m, seg = 10) => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
    const len = A.distanceTo(B);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, len, seg), m);
    mesh.position.copy(A).add(B).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
    g.add(mesh);
    return mesh;
  };

  /* Legs apart, trousers and boots. */
  for (const side of [-1, 1]) {
    rod([side * 0.16, 1.02, 0], [side * 0.34, 0.2, 0.02], 0.15, 0.11, mat(ZC.pants));
    add(new THREE.SphereGeometry(0.15, 12, 10), mat(ZC.boots), [side * 0.36, 0.1, 0.07], null, [0.9, 0.62, 1.35]);
  }
  /* Jacket: a tapered body, narrow at the waist, broad at the chest. */
  const jacket = new THREE.LatheGeometry([
    new THREE.Vector2(0.27, 0), new THREE.Vector2(0.3, 0.12), new THREE.Vector2(0.28, 0.3),
    new THREE.Vector2(0.33, 0.55), new THREE.Vector2(0.37, 0.72), new THREE.Vector2(0.3, 0.86), new THREE.Vector2(0.14, 0.92),
  ], 20);
  add(jacket, mat(ZC.jacket), [0, 1.0, 0]);
  /* Belt and buckle. */
  add(new THREE.TorusGeometry(0.285, 0.035, 8, 24), mat(ZC.collar), [0, 1.06, 0], [Math.PI / 2, 0, 0]);
  add(new THREE.BoxGeometry(0.1, 0.08, 0.03), mat(ZC.gold, { metalness: 0.5, roughness: 0.35 }), [0, 1.06, 0.3]);
  /* Gold trim down the front and buttons between. */
  for (const x of [-0.05, 0.05]) add(new THREE.BoxGeometry(0.022, 0.72, 0.02), mat(ZC.gold, { metalness: 0.5, roughness: 0.35 }), [x, 1.48, 0.335], [-0.06, 0, 0]);
  for (let i = 0; i < 4; i++) add(new THREE.SphereGeometry(0.022, 8, 6), mat(ZC.gold, { metalness: 0.5, roughness: 0.35 }), [0, 1.22 + i * 0.15, 0.345 + (i > 1 ? 0.01 : 0)]);
  /* The red mark on his chest, from his art. */
  add(new THREE.SphereGeometry(0.05, 8, 6), mat(ZC.mark), [-0.15, 1.55, 0.33], null, [1, 1.4, 0.3]);
  add(new THREE.SphereGeometry(0.025, 6, 5), mat(ZC.mark), [-0.14, 1.45, 0.335], null, [1, 1.6, 0.3]);
  /* High collar with a gold rim. */
  add(new THREE.CylinderGeometry(0.17, 0.2, 0.16, 16, 1, true), mat(ZC.collar, { side: THREE.DoubleSide }), [0, 1.95, 0]);
  add(new THREE.TorusGeometry(0.17, 0.018, 6, 20), mat(ZC.gold, { metalness: 0.5, roughness: 0.35 }), [0, 2.03, 0], [Math.PI / 2, 0, 0]);
  /* Pauldrons: dark red domes, gold edges, a point each. */
  for (const side of [-1, 1]) {
    add(new THREE.SphereGeometry(0.2, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(ZC.pauldron), [side * 0.38, 1.8, 0], [0, 0, side * -0.35], [1.15, 0.8, 1.1]);
    add(new THREE.TorusGeometry(0.2, 0.022, 6, 20), mat(ZC.gold, { metalness: 0.5, roughness: 0.35 }), [side * 0.39, 1.79, 0], [Math.PI / 2, side * -0.35, 0], [1.15, 1.1, 1]);
    add(new THREE.ConeGeometry(0.045, 0.2, 6), mat(ZC.gold, { metalness: 0.5, roughness: 0.35 }), [side * 0.5, 1.92, 0], [0, 0, side * -0.7]);
  }
  /* Arms raised, as in his art: pink sleeves with gold cuffs, blue gloves,
     a green blaster with cyan glass in each hand. */
  for (const side of [-1, 1]) {
    const shoulder = [side * 0.42, 1.78, 0.02], elbow = [side * 0.74, 1.92, 0.06], hand = [side * 0.8, 2.36, 0.12];
    rod(shoulder, elbow, 0.1, 0.085, mat(ZC.jacket));
    rod(elbow, hand, 0.085, 0.075, mat(ZC.jacket));
    add(new THREE.SphereGeometry(0.095, 10, 8), mat(ZC.jacket), elbow);
    add(new THREE.TorusGeometry(0.08, 0.02, 6, 16), mat(ZC.gold, { metalness: 0.5, roughness: 0.35 }), [side * 0.79, 2.27, 0.11], [Math.PI / 2 - 0.1, 0, 0]);
    add(new THREE.SphereGeometry(0.1, 12, 10), mat(ZC.glove), hand, null, [1, 1.05, 1]);
    const top = [side * 0.82, 2.66, 0.14];
    rod([side * 0.81, 2.4, 0.13], top, 0.075, 0.085, mat(ZC.blaster), 12);
    add(new THREE.SphereGeometry(0.075, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(ZC.glass, { emissive: ZC.glass, emissiveIntensity: 0.5, roughness: 0.2 }), top);
    add(new THREE.TorusGeometry(0.085, 0.02, 6, 16), mat(ZC.blaster), [side * 0.815, 2.5, 0.135], [Math.PI / 2, 0, 0]);
    rod([side * 0.8, 2.48, 0.13], [side * 0.8, 2.5, 0.3], 0.025, 0.025, mat(ZC.boots), 8);
  }
  /* Head: blue, a little long; dark red mask band round the eyes. */
  add(new THREE.SphereGeometry(0.27, 20, 16), mat(ZC.face), [0, 2.25, 0.02], null, [0.95, 1.08, 0.95]);
  add(new THREE.CylinderGeometry(0.262, 0.262, 0.1, 22, 1, true, -Math.PI * 0.55, Math.PI * 1.1), mat(ZC.mask, { side: THREE.DoubleSide }), [0, 2.29, 0.035]);
  /* Eyes: the one glow. Narrow, fierce, cyan, on the mask. */
  const eyeMat = new THREE.MeshStandardMaterial({ color: ZC.eye, emissive: ZC.eye, emissiveIntensity: 1.4, roughness: 0.3 });
  for (const side of [-1, 1]) add(new THREE.SphereGeometry(0.045, 10, 8), eyeMat, [side * 0.1, 2.3, 0.27], [0, 0, side * -0.25], [1.5, 0.6, 0.5]);
  /* A wide white grin. */
  add(new THREE.TorusGeometry(0.11, 0.028, 6, 16, Math.PI), mat(ZC.teeth), [0, 2.16, 0.235], [Math.PI, 0, 0], [1, 0.55, 0.6]);
  /* Gold circlet and its amber gem. */
  add(new THREE.TorusGeometry(0.27, 0.022, 6, 28), mat(ZC.gold, { metalness: 0.5, roughness: 0.35 }), [0, 2.4, 0.01], [Math.PI / 2 - 0.12, 0, 0]);
  add(new THREE.OctahedronGeometry(0.05), mat("#ffb02e", { emissive: "#ff8a00", emissiveIntensity: 0.4, roughness: 0.2 }), [0, 2.43, 0.28], null, [0.8, 1.2, 0.6]);
  /* Hair: a cap and a crown of big spikes swept up and back, two greens. */
  add(new THREE.SphereGeometry(0.29, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), mat(ZC.hair), [0, 2.32, -0.02]);
  const spikes = [
    [0, 2.62, 0.08, 0.13, 0.6, -0.35, 0], [-0.14, 2.6, 0.02, 0.11, 0.5, -0.2, 0.45], [0.14, 2.6, 0.02, 0.11, 0.52, -0.25, -0.45],
    [-0.24, 2.48, -0.06, 0.1, 0.42, 0.2, 0.95], [0.24, 2.48, -0.06, 0.1, 0.42, 0.2, -0.95], [0, 2.58, -0.14, 0.13, 0.62, 0.55, 0],
    [-0.12, 2.5, -0.2, 0.11, 0.5, 0.85, 0.4], [0.12, 2.5, -0.2, 0.11, 0.5, 0.85, -0.4], [0.05, 2.7, -0.02, 0.1, 0.55, -0.05, -0.2],
    [-0.3, 2.34, -0.08, 0.08, 0.32, 0.4, 1.35], [0.3, 2.34, -0.08, 0.08, 0.32, 0.4, -1.35],
  ];
  spikes.forEach(([x, y, z, r, h, rx, rz], i) => add(new THREE.ConeGeometry(r, h, 7), mat(i % 2 ? ZC.hair2 : ZC.hair), [x, y + h * 0.35, z], [rx, 0, rz]));
  /* Cape: a wide jagged sheet from the shoulders, curved round behind him
     with a few folds; green outside, teal lining (the side you see). */
  const shape = new THREE.Shape();
  shape.moveTo(-0.42, 0);
  shape.lineTo(0.42, 0);
  shape.lineTo(1.5, -1.25);
  const teeth = 11;
  for (let i = 0; i <= teeth; i++) {
    const x = 1.5 - (3.0 * i) / teeth;
    const deep = i % 2 ? -1.35 + 0.08 * Math.sin(i * 2.1) : -1.78 - 0.14 * Math.sin(i * 1.3);
    shape.lineTo(x, deep - 0.25 * (1 - Math.abs(x) / 1.5));
  }
  shape.lineTo(-0.42, 0);
  const capeGeo = new THREE.ShapeGeometry(shape, 6);
  const cp = capeGeo.attributes.position;
  for (let i = 0; i < cp.count; i++) {
    const x = cp.getX(i), y = cp.getY(i);
    cp.setZ(i, -0.24 - 0.16 * x * x + 0.18 * y + 0.06 * Math.sin(x * 6) * -y);
  }
  capeGeo.computeVertexNormals();
  add(capeGeo, mat(ZC.lining, { side: THREE.FrontSide }), [0, 1.86, -0.04]);
  add(capeGeo, mat(ZC.cape, { side: THREE.BackSide }), [0, 1.86, -0.055]);

  /* Cel shading and a dark ink line, so his shapes read from afar. */
  toonify(g);
  outline(g, { color: "#160a26", width: 0.022, minSize: 0.04 });
  return g;
}
