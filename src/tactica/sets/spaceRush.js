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
import { outline } from "../film3d/anime.js";

/* The site's colours (src/index.css) and Zlegend's avatar palette (ZPAL). */
const VOID = "#0E0620", VIOLET = "#8B2FC9", MAGENTA = "#D94BF0", CYAN = "#3EE7F5", LILIAC = "#C9C2E8";
const Z = { outline: "#6c0eff", hood: "#b8ea85", hoodShade: "#9cc16e", face: "#48b2a7", collar: "#7cfff1", shirt: "#f5a7db", skin: "#d39a69", mark: "#ff4c5b", cloth: "#4b1d9e", eye: "#7cfff1" };

/* Where Zlegend floats: beyond the far edge of the board, above it, not too
   big (he watches, he doesn't loom). */
const ZLEGEND_AT = new THREE.Vector3(0, -0.9, -8.6);
const ZLEGEND_SCALE = 1.6;

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

  /* Small cats drifting far off: soft colours, dim, slow. */
  const cats = [];
  const catColors = [LILIAC, "#f5a7db", "#a7e9f5", "#f4efff", "#d9b8ff", "#ffd9a8"];
  /* Where a portrait phone's view reaches: the band above the board's far
     edge (round Zlegend, kept clear of him) and the space under its near
     side, clear of the bottom bar. */
  const spots = [[-4.4, 1.6, -11.5], [4.6, 0.6, -10.5], [-3.4, 4.2, -16], [3.8, 4.6, -17], [-3.6, -4.6, 4.2], [3.4, -5.4, 5.4], [-1.2, -6.2, 7]];
  spots.forEach((at, i) => {
    const cat = buildCat(catColors[i % catColors.length]);
    cat.position.set(...at);
    cat.scale.setScalar(0.42 + (i % 3) * 0.08);
    cat.rotation.set(0.3 * Math.sin(i), i * 1.3, 0.2 * Math.cos(i));
    add(cat);
    cats.push({ cat, base: cat.position.clone(), phase: i * 1.7, spin: (i % 2 ? 1 : -1) * (0.05 + (i % 3) * 0.02) });
  });

  /* Zlegend2700, still, eyes glowing. */
  const zlegend = buildZlegend();
  zlegend.position.copy(ZLEGEND_AT);
  zlegend.scale.setScalar(ZLEGEND_SCALE);
  add(zlegend);

  let t = 0;
  return {
    zlegend,
    update(dt) {
      t += dt;
      for (const c of cats) {
        c.cat.position.y = c.base.y + Math.sin(t * 0.4 + c.phase) * 0.35;
        c.cat.position.x = c.base.x + Math.sin(t * 0.13 + c.phase) * 0.6;
        c.cat.rotation.y += dt * c.spin;
        c.cat.rotation.z = Math.sin(t * 0.3 + c.phase) * 0.15;
      }
    },
    dispose() { for (const o of added) scene.remove(o); },
  };
}

/** A small floating cat: round body, head, ears, a curled tail, closed
 *  happy eyes. Soft and slightly glowing so it shows against the void. */
function buildCat(color) {
  const g = new THREE.Group();
  const fur = new THREE.MeshStandardMaterial({ color, roughness: 0.85, emissive: color, emissiveIntensity: 0.12 });
  const dark = new THREE.MeshBasicMaterial({ color: "#2a1446" });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), fur);
  body.scale.set(1.25, 0.8, 0.85);
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 16, 12), fur);
  head.position.set(0.62, 0.28, 0);
  g.add(head);
  for (const z of [-0.17, 0.17]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.22, 4), fur);
    ear.position.set(0.66, 0.6, z);
    ear.rotation.z = -0.15;
    g.add(ear);
    const eye = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 4, 8, Math.PI), dark);
    eye.position.set(0.95, 0.32, z * 0.7);
    eye.rotation.y = Math.PI / 2;
    g.add(eye);
  }
  const tail = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.07, 6, 14, Math.PI * 1.3), fur);
  tail.position.set(-0.62, 0.2, 0);
  tail.rotation.set(0, 0, 0.4);
  g.add(tail);
  for (const x of [-0.3, 0.3]) for (const z of [-0.22, 0.22]) {
    const paw = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), fur);
    paw.position.set(x, -0.38, z);
    g.add(paw);
  }
  return g;
}

/** Zlegend2700 in 3D, from his pixel avatar: a lime spiky hood falling into
 *  a jagged cape, a teal face in its shadow with a red mark, a cyan collar,
 *  a pink shirt under purple clothes, all with a purple outline. Arms out,
 *  as in his art. Still: only his eyes glow. About 2.3 units tall, feet at 0. */
export function buildZlegend() {
  const g = new THREE.Group();
  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...extra });
  const hood = mat(Z.hood, { emissive: Z.hood, emissiveIntensity: 0.12, side: THREE.DoubleSide });
  const cloth = mat(Z.cloth);
  const add = (geo, m, at, rot) => {
    const mesh = new THREE.Mesh(geo, m);
    if (at) mesh.position.set(...at);
    if (rot) mesh.rotation.set(...rot);
    g.add(mesh);
    return mesh;
  };

  /* Legs and boots. */
  for (const x of [-0.17, 0.17]) {
    add(new THREE.CylinderGeometry(0.12, 0.1, 0.75, 10), cloth, [x, 0.42, 0]);
    add(new THREE.SphereGeometry(0.14, 10, 8), mat(Z.skin), [x, 0.06, 0.04]).scale.set(1, 0.6, 1.3);
  }
  /* Body: purple coat, pink shirt down the front. */
  add(new THREE.CylinderGeometry(0.33, 0.4, 0.85, 14), cloth, [0, 1.2, 0]);
  add(new THREE.BoxGeometry(0.3, 0.7, 0.1), mat(Z.shirt), [0, 1.2, 0.33]);
  /* Collar. */
  add(new THREE.TorusGeometry(0.27, 0.07, 8, 18), mat(Z.collar, { emissive: Z.collar, emissiveIntensity: 0.08 }), [0, 1.66, 0], [Math.PI / 2, 0, 0]);
  /* Arms out and down, as in his art, sleeves purple, hands teal. */
  for (const side of [-1, 1]) {
    const arm = add(new THREE.CylinderGeometry(0.09, 0.08, 0.7, 8), cloth, [side * 0.55, 1.35, 0.05], [0, 0, side * 1.05]);
    arm.userData.arm = true;
    add(new THREE.SphereGeometry(0.11, 10, 8), mat(Z.face), [side * 0.86, 1.18, 0.08]);
  }
  /* Head: teal, a red mark on one cheek. */
  const head = add(new THREE.SphereGeometry(0.3, 18, 14), mat(Z.face), [0, 1.95, 0.02]);
  head.scale.set(1, 0.95, 0.95);
  add(new THREE.BoxGeometry(0.04, 0.14, 0.03), mat(Z.mark), [0.15, 1.88, 0.27]);
  /* Eyes: the one thing that moves the light, glowing cyan in the hood's shade. */
  /* Bright enough to glow, not so bright the glow washes to white or bleeds over his face. */
  const eyeMat = new THREE.MeshStandardMaterial({ color: Z.eye, emissive: Z.eye, emissiveIntensity: 1.6, roughness: 0.3 });
  for (const x of [-0.1, 0.1]) add(new THREE.SphereGeometry(0.045, 10, 8), eyeMat, [x, 1.99, 0.27]).scale.set(1.3, 0.8, 0.6);
  /* Hood: a shell over the head, open at the face, its point falling back. */
  add(new THREE.SphereGeometry(0.42, 20, 14, Math.PI * 0.62, Math.PI * 1.76, 0, Math.PI * 0.62), hood, [0, 2.0, -0.02], [0, 0, 0]);
  const tip = add(new THREE.ConeGeometry(0.22, 0.75, 10), hood, [0, 2.45, -0.3], [-0.9, 0, 0]);
  tip.scale.set(1, 1, 0.8);
  /* Spikes round the hood's edge, like the jagged rim of his pixel hood. */
  for (let i = 0; i < 7; i++) {
    const a = -1.1 + i * (2.2 / 6);
    add(new THREE.ConeGeometry(0.07, 0.24, 5), hood, [Math.sin(a) * 0.42, 2.02 + Math.cos(a) * 0.32, 0.12 + Math.cos(a) * 0.08], [0.3, 0, -a * 0.9]);
  }
  /* Cape: a wide jagged sheet from the shoulders, falling and spreading behind. */
  const shape = new THREE.Shape();
  shape.moveTo(-0.35, 0);
  shape.lineTo(0.35, 0);
  const teeth = 9;
  shape.lineTo(1.25, -1.4);
  for (let i = 0; i <= teeth; i++) {
    const x = 1.25 - (2.5 * i) / teeth;
    shape.lineTo(x, i % 2 ? -1.45 : -1.85 - 0.12 * Math.sin(i * 1.7));
  }
  shape.lineTo(-0.35, 0);
  const capeGeo = new THREE.ShapeGeometry(shape, 4);
  /* Bend it round the body so it isn't a flat card. */
  const p = capeGeo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, -0.18 - 0.22 * p.getX(i) * p.getX(i) + 0.15 * p.getY(i));
  capeGeo.computeVertexNormals();
  add(capeGeo, mat(Z.hoodShade, { emissive: Z.hood, emissiveIntensity: 0.06, side: THREE.DoubleSide }), [0, 1.7, -0.05]);

  /* His purple outline, like the pixel art's. */
  outline(g, { color: Z.outline, width: 0.018 });
  return g;
}
