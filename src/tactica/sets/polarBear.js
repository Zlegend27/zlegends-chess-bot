/* The icy lake's boss: a polar bear. He is there from the lake's first
   floor, far off across the ice; in the second half he comes closer; on
   the last floor he climbs onto the back of the board's ice and rears up
   over it, and moves the enemy's pieces with one huge paw.

   Same controls as the pizza monster, so the run treats them alike:
     update(dt), setRise(0 far | 1 closer | 2 at the board), reach(point),
     carry(arm, point, ms), rest(), slam(point), roar(), melt() (beaten: the
     ice gives way under him and he goes into the water). */
import * as THREE from "three";
import { track, glbLoader } from "./art.js";
import { play as playSound } from "../sound.js";

/* How high over a piece a boss's hand stays while it commands the piece to
   move (bosses never touch the pieces). */
const COMMAND_HEIGHT = 2.1;

/* A photographed, rigged bear (CC BY, credited in public/tactica/models/
   CREDITS.txt) replaces the drawn body when its files are there. Without
   them the drawn bear is used, so the game never depends on it. */
const REAL_BEAR = "/tactica/models/polar_bear/bear.glb";
/* How the real bear sits in his body's place: the drawn bear's length, and
   which way his model faces (turned to face +z). */
const REAL = { length: 7.4, turn: 0, jawOpen: 1 };
const BOARD = new THREE.Vector3(0, 0, 0);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _q = new THREE.Quaternion(), _r = new THREE.Quaternion(), _p = new THREE.Quaternion(), _w = new THREE.Quaternion(), _id = new THREE.Quaternion();
/** Turns a bone so the line from it to `tip` points at `target`, by
 *  `amount` (0 to 1). Works in world space, whatever the rig's axes. */
function aimBone(bone, tip, target, amount) {
  bone.updateWorldMatrix(true, true);
  const from = bone.getWorldPosition(_a);
  const now = tip.getWorldPosition(_b).sub(from).normalize();
  const want = target.clone().sub(from).normalize();
  _q.setFromUnitVectors(now, want);
  _r.slerpQuaternions(_id, _q, amount);
  bone.parent.getWorldQuaternion(_p);
  bone.getWorldQuaternion(_w);
  bone.quaternion.copy(_p.invert().multiply(_r).multiply(_w));
}
/* His model has no jaw, so one is added: hinged under the ears, carrying
   every vertex below the line of the mouth. In the model's own space. */
const JAW = { hinge: [0, 3.18, 2.95], line: (z) => 3.27 + (z - 3.3) * 0.25, eyes: [[-0.27, 3.8, 3.2], [0.27, 3.8, 3.2]] };

/** Adds the jaw bone, moves the lower jaw onto it, and fills the mouth with
 *  gums, teeth and a tongue. Returns the jaw bone, or null. */
function addJaw(model, headBone, mats) {
  let sk = null;
  model.traverse((o) => { if (o.isSkinnedMesh) sk = o; });
  if (!sk || !headBone) return null;
  /* Worked out in the pose the model was bound in (its rest pose is not
     the same): the jaw sits at the hinge, turned like the model itself. */
  const old = sk.skeleton, headInverse = old.boneInverses[old.bones.indexOf(headBone)];
  const jawBind = sk.bindMatrix.clone().multiply(new THREE.Matrix4().makeTranslation(...JAW.hinge));
  const jaw = new THREE.Bone();
  jaw.name = "jaw";
  headInverse.clone().multiply(jawBind).decompose(jaw.position, jaw.quaternion, jaw.scale);
  headBone.add(jaw);
  const jawInverse = jawBind.clone().invert();
  const bones = [...old.bones, jaw];
  const inverses = [...old.boneInverses, jawInverse];
  sk.bind(new THREE.Skeleton(bones, inverses), sk.bindMatrix);
  /* Lower-jaw vertices go to the jaw, fading in from the hinge. */
  const jawIndex = bones.length - 1;
  const { position: p, skinIndex: si, skinWeight: sw } = sk.geometry.attributes;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (z < JAW.hinge[2] || Math.abs(x) > 0.5 || y >= JAW.line(z)) continue;
    /* Full weight on the chin, fading toward the hinge and the mouth's
       corners, so the cheeks stretch rather than tear. */
    const ramp = (v) => v * v * (3 - 2 * v);
    const w = ramp(Math.min(1, (z - JAW.hinge[2]) / 0.5)) * ramp(Math.min(1, (JAW.line(z) - y) / 0.05 + 0.4));
    let low = 0;
    for (let k = 0; k < 4; k++) { sw.setComponent(i, k, sw.getComponent(i, k) * (1 - w)); if (sw.getComponent(i, k) < sw.getComponent(i, low)) low = k; }
    si.setComponent(i, low, jawIndex);
    sw.setComponent(i, low, w);
  }
  si.needsUpdate = sw.needsUpdate = true;
  sk.material.needsUpdate = true;
  /* Groups that move with a bone but take the model's own coordinates. */
  const frame = (bone, inverse) => {
    const g = new THREE.Group();
    inverse.clone().multiply(sk.bindMatrix).decompose(g.position, g.quaternion, g.scale);
    bone.add(g);
    return g;
  };
  const ball = new THREE.SphereGeometry(1, 16, 12), cone = new THREE.ConeGeometry(1, 1, 6);
  const part = (g, geo, mat, [x, y, z], [sx, sy, sz], flip = false) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); if (flip) m.rotation.x = Math.PI; g.add(m); return m; };
  const upper = frame(headBone, headInverse), lower = frame(jaw, jawInverse);
  part(upper, ball, mats.mouthDark, [0, JAW.line(3.45) - 0.02, 3.42], [0.17, 0.08, 0.42]);
  part(lower, ball, mats.mouthDark, [0, JAW.line(3.45) - 0.05, 3.45], [0.1, 0.035, 0.32]);
  part(lower, ball, mats.mouthMat, [0, JAW.line(3.45) - 0.05, 3.45], [0.12, 0.035, 0.3]); // tongue
  for (const sgn of [-1, 1]) {
    part(upper, ball, mats.gumMat, [sgn * 0.14, JAW.line(3.55) + 0.005, 3.55], [0.05, 0.03, 0.26]);
    for (let k = 0; k < 4; k++) {
      const z = 3.4 + k * 0.1, x = sgn * (0.2 - (z - 3.4) * 0.22);
      part(upper, cone, mats.toothMat, [x, JAW.line(z) - 0.02, z], [0.016, 0.05, 0.016], true);
      part(lower, cone, mats.toothMat, [x * 0.95, JAW.line(z) - 0.03, z], [0.014, 0.045, 0.014]);
    }
    /* The fangs. */
    part(upper, cone, mats.toothMat, [sgn * 0.1, JAW.line(3.78) - 0.06, 3.78], [0.026, 0.15, 0.026], true);
    part(lower, cone, mats.toothMat, [sgn * 0.085, JAW.line(3.72) - 0.05, 3.7], [0.022, 0.11, 0.022]);
  }
  /* A dull red glint in each eye. */
  const glint = new THREE.SpriteMaterial({ map: mats.glow, color: "#ff3018", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
  const eyes = JAW.eyes.map(([x, y, z]) => { const e = new THREE.Sprite(glint); e.position.set(x, y, z); e.scale.setScalar(0.16); upper.add(e); return e; });
  return { jaw, glint, eyes };
}

const ease = (t) => t * t * (3 - 2 * t);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
/* Where he stands at each stage, and whether he is up on his hind legs. */
const SPOTS = [
  { pos: new THREE.Vector3(-9, -0.55, -34), scale: 1.6, rear: 0, turn: 0.5 },
  { pos: new THREE.Vector3(5, -0.55, -19), scale: 1.6, rear: 0, turn: -0.3 },
  /* Up out of the water at the back of our floe, leaning over the board. */
  { pos: new THREE.Vector3(0, -1.7, -9.8), scale: 1.15, rear: 1, turn: 0 },
];

/* His coat: thousands of short strands drawn on a canvas, made into a
   cream colour map and a normal map so the light catches the fur. */
let coat = null;
function furTextures() {
  if (coat) return coat;
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const S = 256;
  const hc = document.createElement("canvas");
  hc.width = hc.height = S;
  const g = hc.getContext("2d");
  g.fillStyle = "#808080";
  g.fillRect(0, 0, S, S);
  g.lineCap = "round";
  for (let i = 0; i < 6000; i++) {
    const x = rand() * S, y = rand() * S, len = 5 + rand() * 11, a = Math.PI / 2 + (rand() - 0.5) * 0.7;
    const v = (70 + rand() * 150) | 0;
    g.strokeStyle = `rgb(${v},${v},${v})`;
    g.lineWidth = 0.7 + rand() * 1.3;
    for (const [ox, oy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) {
      g.beginPath(); g.moveTo(x + ox, y + oy); g.lineTo(x + ox + Math.cos(a) * len, y + oy + Math.sin(a) * len); g.stroke();
    }
  }
  const h = g.getImageData(0, 0, S, S).data;
  const H = (x, y) => h[(((y + S) % S) * S + ((x + S) % S)) * 4] / 255;
  const nc = document.createElement("canvas");
  nc.width = nc.height = S;
  const ng = nc.getContext("2d"), out = ng.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * 3, dy = (H(x, y + 1) - H(x, y - 1)) * 3, k = 1 / Math.hypot(dx, dy, 1), i = (y * S + x) * 4;
    out.data[i] = (-dx * k * 0.5 + 0.5) * 255; out.data[i + 1] = (-dy * k * 0.5 + 0.5) * 255; out.data[i + 2] = (k * 0.5 + 0.5) * 255; out.data[i + 3] = 255;
  }
  ng.putImageData(out, 0, 0);
  const cc = document.createElement("canvas");
  cc.width = cc.height = S;
  const cg = cc.getContext("2d");
  cg.fillStyle = "#ece5d3";
  cg.fillRect(0, 0, S, S);
  cg.globalAlpha = 0.45;
  cg.globalCompositeOperation = "overlay";
  cg.drawImage(hc, 0, 0);
  const tex = (c, color) => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); t.anisotropy = 4; if (color) t.colorSpace = THREE.SRGBColorSpace; return t; };
  coat = { map: tex(cc, true), normalMap: tex(nc, false) };
  return coat;
}
/* A soft round puff, for his breath. */
let puffTex = null;
function puff() {
  if (puffTex) return puffTex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d"), grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,0.9)"); grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  puffTex = new THREE.CanvasTexture(c);
  return puffTex;
}

export function buildPolarBear(ts) {
  const root = new THREE.Group();
  const bear = new THREE.Group();
  root.add(bear);
  const { map, normalMap } = furTextures();
  /* Cream fur with a soft sheen at its edges, as real fur has. */
  const furOf = (color) => new THREE.MeshPhysicalMaterial({ color, map, normalMap, normalScale: new THREE.Vector2(0.9, 0.9), roughness: 0.9, sheen: 1, sheenRoughness: 0.45, sheenColor: new THREE.Color("#fff6e6"), emissive: "#3a4652", emissiveIntensity: 0.15 });
  const fur = furOf("#ffffff");
  const furShade = furOf("#d9d2c4");
  const black = new THREE.MeshStandardMaterial({ color: "#060708", roughness: 0.55 });
  const mouthMat = new THREE.MeshStandardMaterial({ color: "#6a1f28", roughness: 0.45 });
  const mouthDark = new THREE.MeshStandardMaterial({ color: "#3a0c12", roughness: 0.7 });
  const gumMat = new THREE.MeshStandardMaterial({ color: "#7a2430", roughness: 0.35 });
  const toothMat = new THREE.MeshStandardMaterial({ color: "#e8dcc0", roughness: 0.3 });
  const claw = new THREE.MeshStandardMaterial({ color: "#2b2a28", roughness: 0.4 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: "#0a0506", roughness: 0.1, emissive: "#ff2a10", emissiveIntensity: 0 });
  const rimMat = new THREE.MeshStandardMaterial({ color: "#3a0c0c", roughness: 0.6 });
  const wrinkleMat = new THREE.MeshStandardMaterial({ color: "#6e6458", roughness: 0.95 });
  const mesh = (geo, mat, x, y, z, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; return m; };
  const ball = new THREE.SphereGeometry(1, 24, 18);

  /* The body pivots at the hips, so rearing up is one rotation. */
  const hips = new THREE.Group();
  hips.position.set(0, 1.6, -1.1);
  bear.add(hips);
  const torso = new THREE.Group();
  hips.add(torso);
  torso.add(mesh(ball, fur, 0, 0.3, 1.2, 1.55, 1.45, 2.3));
  torso.add(mesh(ball, fur, 0, 0.55, 2.7, 1.3, 1.3, 1.2)); // shoulders
  /* A polar bear's long neck, and a long, narrow head with a Roman nose. */
  torso.add(mesh(ball, fur, 0, 0.78, 3.3, 0.8, 0.9, 1.05));
  const head = new THREE.Group();
  head.position.set(0, 1.05, 3.95);
  torso.add(head);
  head.add(mesh(ball, fur, 0, 0.08, 0, 0.62, 0.62, 0.9)); // skull
  head.add(mesh(ball, fur, 0, 0.12, 0.45, 0.5, 0.45, 0.7)); // brow and forehead
  const muzzle = mesh(new THREE.CylinderGeometry(0.28, 0.42, 1.1, 20).rotateX(Math.PI / 2), fur, 0, -0.06, 0.95, 1, 0.78, 1);
  head.add(muzzle, mesh(ball, fur, 0, -0.05, 1.48, 0.3, 0.24, 0.2));
  head.add(mesh(ball, black, 0, 0.02, 1.6, 0.16, 0.11, 0.1)); // nose
  /* Black skin along the lips, as a polar bear has; gums and teeth under it. */
  head.add(mesh(ball, black, 0, -0.29, 1.02, 0.29, 0.045, 0.52));
  head.add(mesh(ball, gumMat, 0, -0.33, 1.02, 0.26, 0.06, 0.45));
  head.add(mesh(ball, mouthDark, 0, -0.44, 0.8, 0.25, 0.1, 0.55)); // inside the mouth
  const toothCone = new THREE.ConeGeometry(1, 1, 6);
  const teethRow = (parent, y, down, z0, r) => {
    for (let i = 0; i < 9; i++) {
      const ang = -1.3 + (i / 8) * 2.6, canine = Math.abs(i - 4) === 3;
      const tooth = mesh(toothCone, toothMat, Math.sin(ang) * r, y + (down ? -1 : 1) * (canine ? 0.15 : 0.04), z0 + Math.cos(ang) * r, canine ? 0.06 : 0.03, canine ? 0.34 : 0.09, canine ? 0.06 : 0.03);
      if (down) tooth.rotation.x = Math.PI;
      parent.add(tooth);
    }
  };
  teethRow(head, -0.36, true, 0.98, 0.22);
  /* The sides of the upper lip, drawn up off the teeth as he snarls. */
  const lips = [-1, 1].map((s) => { const l = mesh(ball, furShade, s * 0.22, -0.3, 0.98, 0.12, 0.12, 0.42); head.add(l); return l; });
  /* Creases across the bridge of the nose, deepening with the snarl. */
  const wrinkles = [0, 1, 2].map((i) => { const w = mesh(ball, wrinkleMat, 0, 0.19 - i * 0.025, 0.72 + i * 0.15, 0.2, 0.022, 0.03); head.add(w); return w; });
  /* Small ears, and heavy brows that come down into a V when he is angry. */
  const ears = [-1, 1].map((s) => {
    const e = new THREE.Group();
    e.position.set(s * 0.38, 0.52, -0.2);
    e.add(mesh(ball, fur, 0, 0, 0, 0.17, 0.17, 0.1), mesh(ball, black, 0, 0, 0.05, 0.08, 0.08, 0.05));
    head.add(e);
    return e;
  });
  const brows = [-1, 1].map((s) => { const b = mesh(ball, fur, s * 0.25, 0.31, 0.62, 0.2, 0.07, 0.15); head.add(b); return b; });
  /* Small dark eyes under the brows, red round the rims. */
  for (const s of [-1, 1]) head.add(mesh(ball, rimMat, s * 0.27, 0.2, 0.62, 0.1, 0.07, 0.05));
  const eyes = [-1, 1].map((s) => { const e = mesh(ball, eyeMat, s * 0.27, 0.2, 0.65, 0.075, 0.055, 0.04); head.add(e); return e; });
  /* The lower jaw: black lower lip, tongue, lower teeth. */
  const jaw = new THREE.Group();
  jaw.position.set(0, -0.38, 0.45);
  jaw.add(mesh(ball, furShade, 0, -0.1, 0.5, 0.3, 0.11, 0.6));
  jaw.add(mesh(ball, black, 0, -0.01, 0.52, 0.27, 0.03, 0.55));
  jaw.add(mesh(ball, mouthMat, 0, -0.02, 0.45, 0.19, 0.05, 0.4)); // tongue
  teethRow(jaw, 0.0, false, 0.55, 0.2);
  head.add(jaw);
  /* His breath, steaming in the cold. */
  const breathMat = new THREE.SpriteMaterial({ map: puff(), color: "#e8f0f6", transparent: true, depthWrite: false, opacity: 0 });
  const breaths = Array.from({ length: 6 }, () => { const sp = new THREE.Sprite(breathMat.clone()); sp.visible = false; return { sp, life: 0, v: new THREE.Vector3() }; });
  const noseWorld = new THREE.Vector3(), aheadWorld = new THREE.Vector3();
  /* Legs: back legs at the hips, front legs at the shoulders. */
  const leg = (x, z, parent, len) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.add(mesh(new THREE.CapsuleGeometry(0.5, len, 6, 12), fur, 0, -len / 2 - 0.2, 0));
    const paw = mesh(ball, furShade, 0, -len - 0.6, 0.18, 0.62, 0.3, 0.75);
    g.add(paw);
    for (let i = 0; i < 4; i++) g.add(mesh(new THREE.ConeGeometry(0.06, 0.24, 5), claw, (i - 1.5) * 0.16, -len - 0.66, 0.85).rotateX(Math.PI / 2));
    parent.add(g);
    return g;
  };
  const hind = [-1, 1].map((s) => leg(s * 0.85, 0.1, hips, 0.9));
  const fore = [-1, 1].map((s) => leg(s * 0.8, 2.75, torso, 1.1));

  /* The paw that moves the pieces: an arm drawn from his shoulder to
     wherever it is wanted. */
  const armMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 1, 6, 12), fur);
  armMesh.castShadow = true;
  const bigPaw = new THREE.Group();
  bigPaw.add(mesh(ball, furShade, 0, 0, 0, 0.75, 0.38, 0.85));
  for (let i = 0; i < 4; i++) bigPaw.add(mesh(new THREE.ConeGeometry(0.07, 0.32, 5), claw, (i - 1.5) * 0.2, -0.12, 0.85).rotateX(Math.PI / 2 + 0.4));
  armMesh.visible = bigPaw.visible = false;
  root.add(armMesh, bigPaw);
  for (const b of breaths) ts.scene.add(b.sp);

  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  ts.scene.add(root);
  ts.addSeeThrough?.(root);

  /* The real bear, laid in when (and if) he loads. */
  let real = null;
  track(glbLoader().loadAsync(REAL_BEAR)).then((gltf) => {
    const model = gltf.scene;
    model.rotation.y = REAL.turn;
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const k = REAL.length / Math.max(size.x, size.z);
    model.scale.setScalar(k);
    model.updateMatrixWorld(true);
    box.setFromObject(model);
    const wrap = new THREE.Group();
    wrap.add(model);
    /* Hind end at the hip pivot, feet on the ground under it. */
    model.position.set(-(box.min.x + box.max.x) / 2, -1.6 - box.min.y, -1.2 - box.min.z);
    for (const c of [...hips.children]) c.visible = false;
    hips.add(wrap);
    let headBone = null, neckBone = null, snoutBone = null, legTop = null, legMid = null, legEnd = null;
    model.traverse((o) => {
      if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; }
      /* His rig: Bone005 is the neck, Bone006 the head (three drops the dots from "Bone.005"). */
      if (o.isBone && o.name === "Bone006") headBone = o;
      if (o.isBone && o.name === "Bone005") neckBone = o;
      if (o.isBone && o.name === "Bone007") snoutBone = o;
      /* His left foreleg, shoulder to paw: the one that reaches. */
      if (o.isBone && o.name === "Bone008") legTop = o;
      if (o.isBone && o.name === "Bone009") legMid = o;
      if (o.isBone && o.name === "Bone011") legEnd = o;
    });
    const face = addJaw(model, headBone, { mouthDark, mouthMat, gumMat, toothMat, glow: puff() });
    const jawBone = face?.jaw ?? null;
    const mixer = new THREE.AnimationMixer(model);
    const action = gltf.animations[0] ? mixer.clipAction(gltf.animations[0]).play() : null;
    /* Their rest turns: put back every frame, since the clip may not move
       them and the anger is added on top. */
    const rest = [headBone, neckBone, legTop].filter(Boolean).map((b) => [b, b.quaternion.clone()]);
    real = { mixer, action, headBone, neckBone, snoutBone, legTop, legMid, legEnd, midRest: legMid?.position.clone(), jawBone, glint: face?.glint, wrap, rest };
    ts.wake?.();
  }).catch(() => {});

  let t = 0, stage = 0, rear = 0, rearGoal = 0, open = 0, openGoal = 0, sinking = 0;
  let anger = 0.45, nextBreath = 1, nextGrowl = 4;
  /* A puff of breath from his nose; a big cloud when he roars. */
  const breathe = (big = false) => {
    const b = breaths.find((x) => x.life <= 0) ?? breaths[0];
    const from = real?.headBone ?? head;
    from.localToWorld(noseWorld.set(0, -0.2, 1.7));
    from.localToWorld(aheadWorld.set(0, -0.6, 3.2));
    b.sp.position.copy(noseWorld);
    b.v.subVectors(aheadWorld, noseWorld).multiplyScalar(big ? 1.2 : 0.45);
    b.life = 1;
    b.big = big;
    b.sp.visible = root.visible;
  };
  const at = SPOTS[0].pos.clone(), heading = new THREE.Vector3();
  let walkFrom = null, walkT = 1, walkMs = 1;
  root.position.copy(at);
  root.scale.setScalar(SPOTS[0].scale);
  const paw = { at: new THREE.Vector3(), goal: null, speed: 8 };
  const shoulderWorld = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);

  const place = () => {
    const spot = SPOTS[stage];
    walkFrom = { pos: root.position.clone(), scale: root.scale.x, turn: root.rotation.y };
    walkT = 0;
    walkMs = root.position.distanceTo(spot.pos) * 180 + 600;
    rearGoal = spot.rear;
  };

  return {
    update(dt) {
      t += dt;
      const spot = SPOTS[stage];
      /* Walking from one spot to the next: legs going, body rocking. */
      let walking = false;
      if (walkT < 1) {
        walkT = Math.min(1, walkT + (dt * 1000) / walkMs);
        const k = ease(walkT);
        root.position.lerpVectors(walkFrom.pos, spot.pos, k);
        root.scale.setScalar(walkFrom.scale + (spot.scale - walkFrom.scale) * k);
        heading.subVectors(spot.pos, walkFrom.pos);
        const face = Math.atan2(heading.x, heading.z);
        root.rotation.y = walkT < 0.85 ? face : face + (spot.turn - face) * ((walkT - 0.85) / 0.15);
        walking = walkT < 0.92;
      }
      const gait = walking ? t * 7 : 0;
      hind.forEach((g, i) => { g.rotation.x = Math.sin(gait + i * Math.PI) * 0.45 * (1 - rear); });
      fore.forEach((g, i) => { g.rotation.x = Math.sin(gait + i * Math.PI + Math.PI / 2) * 0.45 * (1 - rear) - rear * 0.9; });
      torso.position.y = walking ? Math.abs(Math.sin(gait)) * 0.12 : Math.sin(t * 1.4) * 0.04; // breathing
      /* Rearing up onto his hind legs, and swaying there. */
      rear += (rearGoal - rear) * Math.min(1, dt * 2.2);
      hips.rotation.x = -rear * 0.86 + Math.sin(t * 1.1) * 0.03 * rear;
      hips.position.y = 1.6 + rear * 0.4;
      /* Angry: head low and swinging, lip curled, a growl now and then. */
      const angerGoal = [0.45, 0.75, 1][stage];
      anger += (angerGoal - anger) * Math.min(1, dt * 1.5);
      const twitch = Math.pow(Math.max(0, Math.sin(t * 0.9)), 8) * 0.35;
      const snarl = Math.min(1, anger * 0.75 + twitch + open * 0.4);
      head.rotation.x = rear * 1.05 + anger * 0.22 * (1 - rear) + Math.sin(t * 0.8) * 0.05 - open * 0.3;
      head.rotation.y = Math.sin(t * (0.35 + anger * 0.5)) * (rear ? 0.15 : 0.35 + anger * 0.2);
      open += (openGoal - open) * Math.min(1, dt * 7);
      jaw.rotation.x = 0.08 + snarl * 0.2 + open * 0.7;
      lips.forEach((l, i) => { l.position.y = -0.3 + snarl * 0.12; l.scale.y = 0.12 * (1 - snarl * 0.5); l.rotation.z = (i ? -1 : 1) * snarl * 0.3; });
      wrinkles.forEach((w) => { w.scale.x = 0.08 + snarl * 0.14; w.visible = snarl > 0.25; });
      ears.forEach((e) => { e.rotation.x = -anger * 0.9; });
      brows.forEach((b, i) => { b.rotation.z = (i ? 1 : -1) * (0.15 + anger * 0.4); b.position.y = 0.36 - anger * 0.06; });
      for (const e of eyes) { e.scale.y = (t % 6 > 5.88 ? 0.01 : 0.07 * (1 - anger * 0.3)); e.material.emissiveIntensity = 0.2 + anger * 0.9 + rear * 0.6; }
      /* The real bear: his own walk while walking, head down and jaw open
         by the same anger as the drawn one. */
      if (real) {
        if (real.action) real.action.timeScale = walking ? 1 : 0;
        for (const [b, q] of real.rest) b.quaternion.copy(q);
        real.mixer.update(dt);
        /* He glares at the board, head swinging; a roar throws it up. */
        if (real.headBone && real.snoutBone) {
          const target = BOARD.clone();
          target.x += Math.sin(t * (0.35 + anger * 0.5)) * (rear ? 2 : 5);
          target.y += open * 14;
          if (paw.goal) target.copy(paw.goal);
          if (real.neckBone) aimBone(real.neckBone, real.snoutBone, target, 0.35);
          aimBone(real.headBone, real.snoutBone, target, 0.5 + anger * 0.4);
        }
        if (real.glint) real.glint.opacity = 0.15 + anger * 0.45 + rear * 0.3;
        if (real.jawBone) real.jawBone.rotation.x = REAL.jawOpen * (0.03 + snarl * 0.07 + open * 0.3);
      }
      /* The real bear reaches with his own leg: pointed at the paw's spot,
         the upper arm drawn out as far as it must go, forearm and paw kept
         their own shape. The drawn arm stays hidden. */
      if (real?.legTop && real.legMid && real.legEnd) {
        real.legMid.position.copy(real.midRest);
        if (paw.goal) {
          aimBone(real.legTop, real.legEnd, paw.at, 1);
          real.legTop.updateWorldMatrix(true, true);
          const from = real.legTop.getWorldPosition(_a);
          const short = paw.at.distanceTo(from) - real.legEnd.getWorldPosition(_b).distanceTo(from);
          if (short > 0) {
            const len = real.midRest.length() * real.legTop.getWorldScale(_b).y;
            real.legMid.position.multiplyScalar(1 + short / len);
            aimBone(real.legTop, real.legEnd, paw.at, 1);
          }
        }
        armMesh.visible = bigPaw.visible = false;
      }
      /* Breath in the cold, and a low growl. */
      nextBreath -= dt;
      if (nextBreath < 0 && root.visible) { breathe(); nextBreath = 1.6 - anger * 0.6; }
      for (const b of breaths) {
        if (b.life <= 0) { b.sp.visible = false; continue; }
        b.life -= dt / (b.big ? 1.6 : 1.1);
        b.sp.position.addScaledVector(b.v, dt);
        b.sp.position.y += dt * 0.25;
        const k = 1 - b.life, sc = root.scale.x * (b.big ? 0.8 + k * 3.2 : 0.35 + k * 1.3);
        b.sp.scale.set(sc, sc, 1);
        b.sp.material.opacity = Math.sin(Math.min(1, b.life) * Math.PI) * (b.big ? 0.7 : 0.45);
      }
      nextGrowl -= dt;
      if (nextGrowl < 0 && stage > 0 && root.visible && !sinking) { playSound("rumble", { volume: 0.22 + anger * 0.1, rate: 0.55 }); nextGrowl = 6 + Math.random() * 5; }
      /* Sinking through the ice, beaten. */
      if (sinking) root.position.y = spot.pos.y - sinking * 6;
      /* The reaching paw. */
      if (paw.goal) {
        paw.at.lerp(paw.goal, Math.min(1, dt * paw.speed));
        armMesh.visible = bigPaw.visible = !real;
        torso.localToWorld(shoulderWorld.set(0.9, 0.7, 2.9));
        const local = root.worldToLocal(shoulderWorld.clone());
        const pawLocal = root.worldToLocal(paw.at.clone());
        const mid = local.clone().add(pawLocal).multiplyScalar(0.5);
        const len = local.distanceTo(pawLocal);
        armMesh.position.copy(mid);
        armMesh.scale.set(1, Math.max(0.1, len - 1.1), 1);
        armMesh.quaternion.setFromUnitVectors(up, pawLocal.clone().sub(local).normalize());
        bigPaw.position.copy(pawLocal);
        bigPaw.rotation.y = -root.rotation.y;
      } else {
        armMesh.visible = bigPaw.visible = false;
      }
      ts.wake?.();
    },
    setRise(level) {
      if (level === stage) return;
      stage = level;
      sinking = 0;
      root.visible = true;
      root.position.y = SPOTS[stage].pos.y;
      place();
      ts.wake?.();
    },
    get risen() { return stage === 2; },
    /** The paw comes over the board to a point just above it. */
    async reach(point) {
      torso.localToWorld(shoulderWorld.set(0.9, 0.7, 2.9));
      if (!paw.goal) paw.at.copy(shoulderWorld);
      paw.speed = 9;
      /* High over the piece, commanding it (he doesn't touch it). */
      paw.goal = point.clone().setY(point.y + COMMAND_HEIGHT);
      playSound("cloth2", { volume: 0.5, rate: 0.6 });
      await wait(360);
      return paw;
    },
    carry(arm, point, ms) {
      /* He never touches the pieces: the hand stays high over the board and
       sweeps toward the square, with an angry shake, and the piece obeys. */
      const from = arm.goal.clone(), target = point.clone().setY(point.y + COMMAND_HEIGHT);
      const to = from.clone().lerp(target, 0.65);
      playSound("swish", { volume: 0.55, rate: 0.8 });
      return new Promise((resolve) => ts.tween(ms, (k) => {
        arm.goal = from.clone().lerp(to, ease(k));
        arm.goal.y += Math.sin(k * Math.PI) * 0.3;
        arm.goal.x += Math.sin(k * Math.PI * 7) * 0.08 * (1 - k);
      }, resolve));
    },
    rest() { paw.goal = null; },
    /** The paw comes down on the board at `point`. Resolves at the blow. */
    async slam(point) {
      torso.localToWorld(shoulderWorld.set(0.9, 0.7, 2.9));
      if (!paw.goal) paw.at.copy(shoulderWorld);
      openGoal = 1;
      paw.speed = 6;
      paw.goal = point.clone().setY(4.5);
      breathe(true);
      playSound("ooh", { volume: 0.3 });
      await wait(450);
      paw.speed = 24;
      paw.goal = point.clone().setY(0.3);
      await wait(120);
      playSound("punchHeavy", { volume: 1 });
      playSound("crack", { volume: 0.9 });
      ts.shake = 0.22;
      ts.tween(520, (k) => { ts.shake = 0.22 * (1 - k); }, () => { ts.shake = 0; });
      await wait(260);
      openGoal = 0;
      paw.goal = null;
    },
    /** A roar that carries across the whole lake. */
    async roar() {
      openGoal = 1;
      anger = 1;
      breathe(true);
      setTimeout(() => breathe(true), 350);
      playSound("rumble", { volume: 1 });
      playSound("whoom", { volume: 0.8 });
      ts.shake = 0.1;
      await wait(1300);
      ts.tween(400, (k) => { ts.shake = 0.1 * (1 - k); }, () => { ts.shake = 0; });
      openGoal = 0;
      await wait(300);
    },
    /** Beaten: the ice cracks under him and he drops into the lake. */
    async melt() {
      openGoal = 0.6;
      playSound("crack", { volume: 1 });
      playSound("crunch", { volume: 0.8, delay: 0.3 });
      await new Promise((resolve) => ts.tween(1600, (k) => { sinking = ease(k); }, resolve));
      root.visible = false;
      await wait(400);
    },
    dispose() { ts.scene.remove(root); for (const b of breaths) ts.scene.remove(b.sp); ts.removeSeeThrough?.(root); },
  };
}
