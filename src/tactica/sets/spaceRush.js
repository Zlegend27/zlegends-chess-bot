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
import { outline, sharpMaterial, crease } from "../film3d/anime.js";

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
    cat.scale.setScalar(0.8 + (i % 3) * 0.12);
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
  /* Dimmed and a little see-through, so they sit back in the scene. */
  mat.color.setScalar(0.6);
  mat.opacity = 0.75;
  const sprite = new THREE.Sprite(mat);
  sprite.renderOrder = -1;
  return sprite;
}

/* ---- Zlegend2700 ----
   Built from his art (bot-happy.webp, bot-angry.webp, the pixel avatar),
   in the sharp style (film3d/anime.js): flat-faceted cel shading, ink round
   the outside and along every crease, angular shapes instead of balls.
     Hair: a crest of flat, blade-like locks in three greens, swept up and to
       his right, bangs falling over the forehead to his left.
     Head: blue, a pointed chin; a dark red domino mask with pointed ends;
       narrow, slanted glowing cyan eyes on it; a wide toothy grin.
     Gold circlet with a round emblem and an amber centre on the forehead.
     Pink military jacket, gold trim and buttons, the red mark; dark red
     pauldrons with gold edges and points; arms raised, gold cuffs, blue
     gloves, green blasters with cyan glass; red-brown trousers, boots; a
     wide jagged cape, green outside and teal inside.
   Still: only his eyes glow. About 3 units tall, feet at 0, facing +z. */
const ZC = {
  hair: "#7fdc6a", hairDark: "#4fae4a", hairLight: "#b8f08a", face: "#4fb4d4", mask: "#6a1626", eye: "#7cfff1", teeth: "#ffffff",
  jacket: "#f4a9d6", gold: "#f2c14a", amber: "#ff9a1f", pauldron: "#8a1f2e", collar: "#5b1d6e", glove: "#2f63cf",
  blaster: "#45d07a", glass: "#7cfff1", pants: "#7a2b22", boots: "#2b1a2e", cape: "#4fcf8c", lining: "#2c9488", mark: "#c4232f", ink: "#160a26",
};
/** A flat shape (a list of [x, y]) as a thin slab, bent round a face of
 *  radius \`wrap\` so it sits on a rounded head. */
function plate(points, depth, wrap = 0) {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  if (wrap) {
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i); pos.setZ(i, pos.getZ(i) - (x * x) / (2 * wrap)); }
    geo.computeVertexNormals();
  }
  return geo;
}
/** A blade of hair: a flat leaf, wide at the root, curving to a sharp tip,
 *  with a ridge down the middle so it catches light on two faces. */
function lockGeometry(length, width, bend) {
  const pts = [];
  const n = 6;
  for (let i = 0; i <= n; i++) { const t = i / n; pts.push([-(width / 2) * (1 - t) ** 0.8 + bend * t * t, length * t]); }
  for (let i = n - 1; i >= 1; i--) { const t = i / n; pts.push([(width / 2) * (1 - t) ** 0.8 + bend * t * t, length * t]); }
  const geo = plate(pts, width * 0.28);
  geo.translate(0, 0, -width * 0.14);
  /* The ridge: push the middle forward so the blade has two faces. */
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    /* Clamped: at the tip, rounding can put t a hair past 1, and a
       fractional power of a negative number is NaN. */
    const x = pos.getX(i), y = pos.getY(i), t = Math.min(1, Math.max(0, y / length));
    const centre = bend * t * t, half = Math.max(1e-3, (width / 2) * (1 - t) ** 0.8);
    const k = 1 - Math.min(1, Math.abs(x - centre) / half);
    pos.setZ(i, pos.getZ(i) + (pos.getZ(i) > 0 ? 1 : -1) * k * width * 0.12);
  }
  geo.computeVertexNormals();
  return geo;
}
export function buildZlegend() {
  const g = new THREE.Group();
  const M = (color, extra) => sharpMaterial(color, extra);
  const gold = M(ZC.gold);
  const add = (geo, m, at, rot, scale) => {
    const mesh = new THREE.Mesh(geo, m);
    if (at) mesh.position.set(...at);
    if (rot) mesh.rotation.set(...rot);
    if (scale) mesh.scale.set(...scale);
    g.add(mesh);
    return mesh;
  };
  /* A limb or rod from a to b: few sides, so it has edges. */
  const rod = (a, b, r0, r1, m, sides = 7) => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, A.distanceTo(B), sides), m);
    mesh.position.copy(A).add(B).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
    g.add(mesh);
    return mesh;
  };
  const joint = (r, m, at) => add(new THREE.IcosahedronGeometry(r, 0), m, at);

  /* Legs apart, trousers, boots with a pointed toe. */
  for (const side of [-1, 1]) {
    rod([side * 0.16, 1.02, 0], [side * 0.31, 0.5, 0.01], 0.15, 0.12, M(ZC.pants));
    rod([side * 0.31, 0.5, 0.01], [side * 0.36, 0.16, 0.02], 0.12, 0.1, M(ZC.pants));
    joint(0.12, M(ZC.pants), [side * 0.31, 0.5, 0.01]);
    add(new THREE.ConeGeometry(0.12, 0.34, 5), M(ZC.boots), [side * 0.37, 0.08, 0.1], [Math.PI / 2, 0, 0], [1, 1, 0.6]);
    add(new THREE.CylinderGeometry(0.11, 0.12, 0.16, 6), M(ZC.boots), [side * 0.36, 0.14, 0.02]);
  }
  /* Jacket: narrow waist, broad chest, eight sides so its panels show. */
  const jacket = new THREE.LatheGeometry([
    new THREE.Vector2(0.27, 0), new THREE.Vector2(0.3, 0.12), new THREE.Vector2(0.27, 0.3),
    new THREE.Vector2(0.34, 0.56), new THREE.Vector2(0.38, 0.72), new THREE.Vector2(0.3, 0.86), new THREE.Vector2(0.14, 0.92),
  ], 8);
  add(jacket, M(ZC.jacket), [0, 1.0, 0], [0, Math.PI / 8, 0]);
  add(new THREE.CylinderGeometry(0.295, 0.295, 0.07, 8), M(ZC.collar), [0, 1.06, 0], [0, Math.PI / 8, 0]);
  add(new THREE.BoxGeometry(0.11, 0.09, 0.03), gold, [0, 1.06, 0.29]);
  for (const x of [-0.055, 0.055]) add(new THREE.BoxGeometry(0.024, 0.72, 0.02), gold, [x, 1.48, 0.335], [-0.07, 0, 0]);
  for (let i = 0; i < 4; i++) add(new THREE.OctahedronGeometry(0.026), gold, [0, 1.22 + i * 0.15, 0.345]);
  add(plate([[0, 0.07], [0.04, 0.02], [0.06, -0.05], [0.02, -0.04], [0.01, -0.12], [-0.02, -0.03], [-0.06, -0.04], [-0.04, 0.03]], 0.01), M(ZC.mark), [-0.16, 1.52, 0.335]);
  /* High collar, gold rim. */
  add(new THREE.CylinderGeometry(0.17, 0.21, 0.17, 8, 1, true), M(ZC.collar, { side: THREE.DoubleSide }), [0, 1.95, 0]);
  add(new THREE.CylinderGeometry(0.18, 0.18, 0.03, 8, 1, true), gold, [0, 2.035, 0]);
  /* Pauldrons: faceted dark red shells, gold edges, a point each. */
  for (const side of [-1, 1]) {
    add(new THREE.SphereGeometry(0.21, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), M(ZC.pauldron), [side * 0.38, 1.8, 0], [0, 0, side * -0.35], [1.15, 0.8, 1.1]);
    add(new THREE.CylinderGeometry(0.215, 0.215, 0.035, 7, 1, true), gold, [side * 0.385, 1.79, 0], [0, 0, side * -0.35], [1.15, 1, 1.1]);
    add(new THREE.ConeGeometry(0.05, 0.24, 4), gold, [side * 0.52, 1.95, 0], [0, 0, side * -0.75]);
  }
  /* Arms raised: pink sleeves, gold cuffs, blue gloves, green blasters. */
  for (const side of [-1, 1]) {
    const shoulder = [side * 0.42, 1.78, 0.02], elbow = [side * 0.74, 1.92, 0.06], wrist = [side * 0.79, 2.27, 0.11], hand = [side * 0.8, 2.37, 0.12];
    rod(shoulder, elbow, 0.105, 0.088, M(ZC.jacket));
    joint(0.095, M(ZC.jacket), elbow);
    rod(elbow, wrist, 0.088, 0.078, M(ZC.jacket));
    add(new THREE.CylinderGeometry(0.088, 0.088, 0.05, 7), gold, wrist, [0, 0, side * -0.08]);
    add(new THREE.DodecahedronGeometry(0.1, 0), M(ZC.glove), hand, null, [1, 1.1, 1]);
    const top = [side * 0.82, 2.66, 0.14];
    rod([side * 0.81, 2.4, 0.13], top, 0.075, 0.088, M(ZC.blaster), 8);
    add(new THREE.SphereGeometry(0.08, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), M(ZC.glass, { emissive: ZC.glass, emissiveIntensity: 0.5 }), top);
    add(new THREE.CylinderGeometry(0.095, 0.095, 0.035, 8), M(ZC.blaster), [side * 0.815, 2.5, 0.135]);
    rod([side * 0.8, 2.48, 0.13], [side * 0.8, 2.5, 0.3], 0.028, 0.028, M(ZC.boots), 6);
  }

  /* Head: blue, wide at the cheeks, coming to a pointed chin. */
  const headGeo = new THREE.SphereGeometry(0.27, 12, 10);
  const hp = headGeo.attributes.position;
  for (let i = 0; i < hp.count; i++) {
    const y = hp.getY(i);
    if (y < 0) { const k = 1 + (y / 0.27) * 0.45; hp.setX(i, hp.getX(i) * k); hp.setZ(i, hp.getZ(i) * (0.85 + 0.15 * k)); hp.setY(i, y * 1.25); }
  }
  headGeo.computeVertexNormals();
  add(headGeo, M(ZC.face), [0, 2.25, 0.02], null, [1.02, 1.06, 0.98]);
  /* Domino mask: a band across the eyes with pointed ends sweeping up, a
     notch over the nose. */
  add(plate([
    [-0.3, 0.07], [-0.2, 0.05], [-0.06, 0.04], [0, 0.02], [0.06, 0.04], [0.2, 0.05], [0.3, 0.07],
    [0.27, 0.0], [0.2, -0.05], [0.08, -0.05], [0, -0.02], [-0.08, -0.05], [-0.2, -0.05], [-0.27, 0.0],
  ], 0.03, 0.22), M(ZC.mask), [0, 2.29, 0.276]);
  /* Eyes: narrow and slanted up at the outer corners, glowing cyan. */
  const eyeMat = new THREE.MeshBasicMaterial({ color: ZC.eye });
  eyeMat.color.multiplyScalar(1.6);
  for (const side of [-1, 1]) {
    const eye = add(plate([[0, 0], [0.04, 0.016], [0.09, 0.03], [0.07, 0.0], [0.03, -0.012]].map(([x, y]) => [x * side, y]), 0.01, 0.22), eyeMat, [side * 0.045, 2.29, 0.308]);
    eye.userData.ink = true;
  }
  /* A wide, toothy grin: a white crescent with the teeth marked. */
  const grin = add(plate([[-0.13, 0.03], [-0.06, 0.012], [0, 0.008], [0.06, 0.012], [0.13, 0.03], [0.1, -0.02], [0.05, -0.05], [0, -0.058], [-0.05, -0.05], [-0.1, -0.02]], 0.012, 0.2), M(ZC.teeth), [0, 2.13, 0.252]);
  grin.userData.ink = true;
  for (const x of [-0.075, -0.035, 0.005, 0.045, 0.085]) add(new THREE.BoxGeometry(0.006, 0.05, 0.006), new THREE.MeshBasicMaterial({ color: ZC.ink }), [x, 2.115, 0.267 - (x * x) / 0.4]).userData.ink = true;
  add(new THREE.BoxGeometry(0.2, 0.005, 0.006), new THREE.MeshBasicMaterial({ color: ZC.ink }), [0, 2.122, 0.266]).userData.ink = true;
  /* Gold circlet with a round emblem and an amber centre on the forehead. */
  add(new THREE.CylinderGeometry(0.29, 0.29, 0.04, 10, 1, true), gold, [0, 2.41, 0.01], [-0.12, 0, 0]);
  add(new THREE.CylinderGeometry(0.062, 0.062, 0.025, 8), gold, [0, 2.43, 0.29], [Math.PI / 2 - 0.12, 0, 0]);
  add(new THREE.CylinderGeometry(0.034, 0.034, 0.03, 8), M(ZC.amber, { emissive: ZC.amber, emissiveIntensity: 0.35 }), [0, 2.43, 0.3], [Math.PI / 2 - 0.12, 0, 0]);

  /* Hair: a faceted cap, then the crest. Each lock: [x, y, z] root,
     length, width, tilt forward/back (rx), lean left/right (rz), turn (ry),
     bend of its tip, colour. Swept up and to his right; bangs to his left. */
  add(new THREE.SphereGeometry(0.29, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), M(ZC.hair), [0, 2.33, -0.02]);
  const shades = { m: ZC.hair, d: ZC.hairDark, l: ZC.hairLight };
  const locks = [
    /* the crest: thick blades, together, swept up and over to one side */
    [-0.04, 2.5, 0.05, 0.62, 0.27, -0.28, -0.32, 0, 0.16, "m"],
    [0.09, 2.5, 0.0, 0.56, 0.25, -0.12, -0.72, 0, 0.12, "l"],
    [-0.17, 2.48, 0.02, 0.5, 0.23, -0.16, -0.12, 0.2, 0.13, "d"],
    [0.2, 2.44, -0.02, 0.42, 0.21, 0.0, -1.08, -0.2, 0.08, "m"],
    [-0.26, 2.42, -0.04, 0.34, 0.19, 0.08, 0.25, 0.3, 0.1, "l"],
    /* the back of the crest */
    [0, 2.44, -0.16, 0.5, 0.25, 0.68, -0.42, 0, 0.1, "d"],
    [-0.15, 2.4, -0.18, 0.4, 0.21, 0.8, 0.08, 0.4, 0.08, "m"],
    [0.16, 2.4, -0.18, 0.42, 0.21, 0.8, -0.82, -0.4, 0.08, "d"],
    [-0.29, 2.34, -0.06, 0.28, 0.17, 0.4, 1.0, 0.6, 0.05, "d"],
    [0.3, 2.34, -0.06, 0.3, 0.17, 0.4, -1.3, -0.6, 0.05, "m"],
    /* bangs falling over the forehead to the other side, above the circlet */
    [0.06, 2.49, 0.24, 0.28, 0.15, -1.95, 0.75, 0, -0.06, "l"],
    [-0.07, 2.49, 0.23, 0.24, 0.13, -2.1, 0.95, 0, -0.05, "m"],
  ];
  for (const [x, y, z, len, wid, rx, rz, ry, bend, shade] of locks) {
    const lock = add(lockGeometry(len, wid, bend), M(shades[shade]), [x, y, z]);
    lock.rotation.set(rx, ry, rz, "YXZ");
  }

  /* Cape: a wide jagged sheet from the shoulders, curved round behind him
     with folds; green outside, teal lining (the side you see). */
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
  const capeGeo = new THREE.ShapeGeometry(shape, 3);
  const cp = capeGeo.attributes.position;
  for (let i = 0; i < cp.count; i++) {
    const x = cp.getX(i), y = cp.getY(i);
    cp.setZ(i, -0.24 - 0.16 * x * x + 0.18 * y + 0.06 * Math.sin(x * 6) * -y);
  }
  capeGeo.computeVertexNormals();
  add(capeGeo, M(ZC.lining), [0, 1.86, -0.04]);
  add(capeGeo, M(ZC.cape, { side: THREE.BackSide }), [0, 1.86, -0.055]);

  /* Ink round the outside and along the creases. */
  outline(g, { color: ZC.ink, width: 0.02, minSize: 0.04 });
  crease(g, { color: ZC.ink, angle: 32 });
  return g;
}
