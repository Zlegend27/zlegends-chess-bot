/* Chess Tactica queen: the set's turned wooden base, a double collar, a
   rounded crown with small points and the contrasting-colour ball finial
   (dark on the white queen, light on the black). She carries a staff with
   a glowing crystal orb: she zaps her target with lightning, it vanishes
   in a puff of smoke, and she teleports onto its square.
   Same axes as the pawn: front +Z, up +Y. */
import * as THREE from "three";
import { WOOD, buildArm, chaikin, holdAt, makeEye, makeMats, shadowed } from "./pawn.js";

const BODY_PROFILE = [
  [0.0, 0.03], [0.47, 0.03], [0.5, 0.05], [0.505, 0.09], [0.49, 0.115],
  [0.455, 0.13], [0.47, 0.15], [0.475, 0.21], [0.45, 0.29], [0.39, 0.35],
  [0.3, 0.395], [0.25, 0.415], [0.3, 0.425], [0.31, 0.45], [0.28, 0.47],
  [0.21, 0.48], [0.17, 0.54], [0.14, 0.66], [0.125, 0.8], [0.12, 0.92],
  [0.13, 0.98], [0.23, 1.0], [0.26, 1.02], [0.25, 1.045], [0.17, 1.055],
  [0.15, 1.07], [0.21, 1.085], [0.225, 1.1], [0.21, 1.12], [0.13, 1.13], [0.09, 1.145],
];
/* Head: a rounded bowl that opens into a crown rim, with a low dome inside. */
const HEAD_PROFILE = [
  [0.0, 0.0], [0.1, 0.0], [0.11, 0.04], [0.14, 0.12], [0.19, 0.22], [0.215, 0.3],
  [0.22, 0.36], [0.245, 0.4], [0.25, 0.43], [0.23, 0.44], [0.16, 0.44], [0.14, 0.47],
  [0.1, 0.5], [0.05, 0.515], [0.0, 0.52],
];
const HEAD_Y = 1.13;
export const ARM = { upper: 0.21, fore: 0.22, x: 0.19, y: 0.95 };

/* Staff poses, solved offline: hand spot and staff direction. */
const POSES = {"rest":{"shoulderR":[0.12,-0.6,-0.37],"elbowR":-1.76,"wrist":[0,0,0,1],"shoulderL":[0.19,0.87,0.05],"elbowL":-1.76},"raise":{"shoulderR":[-2.19,-0.25,-0.23],"elbowR":-1.41,"wrist":[0.76,0.393,0.17,0.489],"shoulderL":[-2.47,0.87,0.68],"elbowL":-1.62},"point":{"shoulderR":[-1.35,-0.32,0.05],"elbowR":-1.2,"wrist":[0.781,0.484,0.068,0.39],"shoulderL":[-3.1,0.38,2.36],"elbowL":-1.9}};
const REST_STAFF = new THREE.Vector3(0, 1, 0.06).normalize();

/* The finial is the contrasting colour: dark wood on white, light on black. */
const FINIAL = { white: { base: "#8A5229", shade: "#6a3d1d", grain: "#4a2a12" }, black: { base: "#EED6B0", shade: "#d9bf96", grain: "#b8956a" } };

function itemQuat(dir, edgeHint = new THREE.Vector3(1, 0, 0)) {
  const y = dir.clone().normalize();
  const x = edgeHint.clone().addScaledVector(y, -edgeHint.dot(y)).normalize();
  const z = new THREE.Vector3().crossVectors(x, y);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

/* Staff along its own +Y, held at the origin: dark wooden shaft, gold
   fittings and a ring cradling a glowing crystal orb at the top. */
function buildStaff() {
  const s = new THREE.Group();
  s.name = "staff";
  const wood = new THREE.MeshPhysicalMaterial({ color: "#3e2614", roughness: 0.45, clearcoat: 0.5 });
  const gold = new THREE.MeshStandardMaterial({ color: "#d8b25a", metalness: 1, roughness: 0.25 });
  const shaft = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.019, 1.24, 16), wood));
  shaft.position.y = -0.01;
  s.add(shaft);
  const foot = shadowed(new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.06, 16), gold));
  foot.rotation.x = Math.PI;
  foot.position.y = -0.65;
  s.add(foot);
  for (const y of [0.2, 0.56]) {
    const band = shadowed(new THREE.Mesh(new THREE.TorusGeometry(0.019, 0.006, 8, 20), gold));
    band.rotation.x = Math.PI / 2;
    band.position.y = y;
    s.add(band);
  }
  const collar = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.02, 0.05, 16), gold));
  collar.position.y = 0.62;
  s.add(collar);
  /* Two crossed rings make a cage around the orb. */
  for (const r of [0, Math.PI / 2]) {
    const ring = shadowed(new THREE.Mesh(new THREE.TorusGeometry(0.072, 0.008, 10, 36), gold));
    ring.rotation.y = r;
    ring.position.y = 0.72;
    s.add(ring);
  }
  const tip = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.016, 12, 8), gold));
  tip.position.y = 0.8;
  s.add(tip);
  const orb = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 32, 20),
    new THREE.MeshPhysicalMaterial({ color: "#bfefff", emissive: "#5fc8ff", emissiveIntensity: 0.6, roughness: 0.05, transmission: 0.3, thickness: 0.1, clearcoat: 1 }),
  );
  orb.name = "orb";
  orb.position.y = 0.72;
  s.add(orb);
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 24, 16),
    new THREE.MeshBasicMaterial({ color: "#7fd4ff", transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  halo.name = "halo";
  halo.position.y = 0.72;
  s.add(halo);
  return s;
}

export function buildQueen(colour = "white") {
  const mats = makeMats(colour);
  const queen = new THREE.Group();
  queen.name = "queen_" + colour;
  const body = new THREE.Group();
  body.name = "body";
  queen.add(body);

  const turned = (pts) => chaikin(pts, 2).map(([r, y]) => new THREE.Vector2(Math.max(r, 0), y));
  body.add(shadowed(new THREE.Mesh(new THREE.LatheGeometry(turned(BODY_PROFILE), 96), mats.wood)));
  const felt = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.475, 0.475, 0.03, 64), mats.felt));
  felt.position.y = 0.015;
  body.add(felt);

  const head = new THREE.Group();
  head.name = "head";
  head.position.y = HEAD_Y;
  const bowl = shadowed(new THREE.Mesh(new THREE.LatheGeometry(turned(HEAD_PROFILE), 96), mats.wood));
  bowl.rotation.y = Math.PI;
  head.add(bowl);
  /* Crown points around the rim. */
  const point = new THREE.ConeGeometry(0.026, 0.07, 12);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const p = shadowed(new THREE.Mesh(point, mats.wood));
    p.position.set(Math.sin(a) * 0.232, 0.47, Math.cos(a) * 0.232);
    head.add(p);
  }
  const finialMat = new THREE.MeshPhysicalMaterial({ color: FINIAL[colour].base, roughness: 0.4, clearcoat: 0.7, clearcoatRoughness: 0.2 });
  const finial = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.065, 32, 20), finialMat));
  finial.position.y = 0.58;
  head.add(finial);
  for (const s of [-1, 1]) {
    const th = s * 0.36, ey = 0.2;
    const dir = new THREE.Vector3(Math.sin(th), 0.15, Math.cos(th)).normalize();
    const eye = new THREE.Group();
    eye.name = s < 0 ? "eyeR" : "eyeL";
    eye.position.set(Math.sin(th) * 0.176, ey, Math.cos(th) * 0.176);
    eye.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    makeEye(eye, mats);
    head.add(eye);
  }
  body.add(head);

  const R = buildArm("R", mats, ARM), L = buildArm("L", mats, ARM);
  body.add(R.shoulder, L.shoulder);
  const P = POSES.rest;
  R.shoulder.rotation.set(...P.shoulderR);
  L.shoulder.rotation.set(...P.shoulderL);
  R.elbow.rotation.set(P.elbowR, 0, 0);
  L.elbow.rotation.set(P.elbowL, 0, 0);
  queen.updateMatrixWorld(true);
  holdAt(queen, R.hand, buildStaff(), R.hand.getWorldPosition(new THREE.Vector3()), itemQuat(REST_STAFF));
  return queen;
}

/* ---------- Animation ---------- */

const qOf = (e) => new THREE.Quaternion().setFromEuler(new THREE.Euler(...e)).toArray();
const qTrack = (node, times, eulers) =>
  new THREE.QuaternionKeyframeTrack(node + ".quaternion", times, eulers.flatMap(qOf));
const rawQTrack = (node, times, quats) =>
  new THREE.QuaternionKeyframeTrack(node + ".quaternion", times, quats.flat());
const vTrack = (node, prop, times, vals) =>
  new THREE.VectorKeyframeTrack(node + "." + prop, times, vals.flat());
const nTrack = (path, times, vals) => new THREE.NumberKeyframeTrack(path, times, vals);
const add = (a, b) => a.map((v, i) => v + b[i]);

/* Key moments, in seconds. The lightning and puffs are effects that run
   alongside the clip at these times (see makeZap and makePoof). */
export const SPELL = { raise: 0.5, point: 0.75, zapStart: 0.8, zapEnd: 1.35, enemyPoof: 1.35, vanish: 1.5, appear: 1.8, end: 2.5 };

export function queenClips([dx, dz] = [-2.4, 2.4]) {
  const P = POSES, S = SPELL;
  const yaw = Math.atan2(dx, dz);
  const blink = [[1, 1, 1], [1, 1, 1], [1, 0.08, 1], [1, 1, 1], [1, 1, 1]];
  const bt = [0, 2.2, 2.29, 2.38, 3.2];
  const idle = new THREE.AnimationClip("idle", 3.2, [
    vTrack("body", "scale", [0, 1.6, 3.2], [[1, 1, 1], [1.01, 0.988, 1.01], [1, 1, 1]]),
    qTrack("shoulderR", [0, 1.6, 3.2], [P.rest.shoulderR, add(P.rest.shoulderR, [0.03, 0, 0.02]), P.rest.shoulderR]),
    qTrack("shoulderL", [0, 1.6, 3.2], [P.rest.shoulderL, add(P.rest.shoulderL, [0.05, 0, -0.03]), P.rest.shoulderL]),
    qTrack("head", [0, 1.6, 3.2], [[0, 0, 0], [0.02, 0, 0.025], [0, 0, 0]]),
    nTrack("orb.material.emissiveIntensity", [0, 1.6, 3.2], [0.6, 1.0, 0.6]),
    nTrack("halo.material.opacity", [0, 1.6, 3.2], [0.12, 0.2, 0.12]),
    vTrack("eyeR", "scale", bt, blink),
    vTrack("eyeL", "scale", bt, blink),
  ]);

  /* She turns to the target, raises the staff while the orb charges, points
     it through the zap, then blinks out and reappears on the target square. */
  const t = [0, 0.2, S.raise, S.point, S.zapEnd, S.vanish, S.vanish + 0.1, S.vanish + 0.15, S.appear - 0.01, S.appear, S.appear + 0.12, S.appear + 0.25, S.end];
  const here = [0, 0, 0], there = [dx, 0, dz];
  const pos = [here, here, here, here, here, here, here, here, there, there, there, there, there];
  const rot = [[0, 0, 0], [0, yaw, 0], [-0.06, yaw, 0], [0.08, yaw, 0], [0.08, yaw, 0], [0, yaw, 0], [0, yaw, 0], [0, yaw, 0], [0, yaw, 0], [0, yaw, 0], [0, yaw, 0], [0, yaw, 0], [0, yaw, 0]];
  const tiny = [0.001, 0.001, 0.001];
  const scl = [[1, 1, 1], [1, 1, 1], [0.97, 1.05, 0.97], [1.02, 0.97, 1.02], [1.02, 0.97, 1.02], [1.1, 0.85, 1.1], [0.4, 1.6, 0.4], tiny, tiny, tiny, [0.7, 1.35, 0.7], [1.06, 0.95, 1.06], [1, 1, 1]];

  const kt = [0, 0.2, S.raise, S.point, S.zapEnd, S.vanish, S.appear, S.end];
  const K = ["rest", "rest", "raise", "point", "point", "rest", "rest", "rest"];
  const arms = [
    qTrack("shoulderR", kt, K.map((k) => P[k].shoulderR)),
    qTrack("elbowR", kt, K.map((k) => [P[k].elbowR, 0, 0])),
    rawQTrack("handR", kt, K.map((k) => P[k].wrist)),
    qTrack("shoulderL", kt, K.map((k) => P[k].shoulderL)),
    qTrack("elbowL", kt, K.map((k) => [P[k].elbowL, 0, 0])),
  ];
  const ot = [0, 0.2, S.raise, S.point, S.zapStart, S.zapEnd, S.zapEnd + 0.3, S.end];
  const orb = [
    nTrack("orb.material.emissiveIntensity", ot, [0.6, 0.6, 3.0, 4.5, 6.0, 5.0, 0.8, 0.6]),
    nTrack("halo.material.opacity", ot, [0.12, 0.12, 0.45, 0.6, 0.75, 0.6, 0.15, 0.12]),
    vTrack("halo", "scale", ot, [[1, 1, 1], [1, 1, 1], [1.5, 1.5, 1.5], [1.8, 1.8, 1.8], [2.2, 2.2, 2.2], [1.9, 1.9, 1.9], [1, 1, 1], [1, 1, 1]]),
  ];

  const attack = new THREE.AnimationClip("attack", S.end, [
    vTrack("body", "position", t, pos),
    qTrack("body", t, rot),
    vTrack("body", "scale", t, scl),
    ...arms,
    ...orb,
  ]);

  const rt = [0, 0.15, 0.4, 0.62, 0.75];
  const ret = new THREE.AnimationClip("return", 0.75, [
    vTrack("body", "position", rt, [[dx, 0, dz], [dx, 0, dz], [dx / 2, 0.3, dz / 2], [0, 0, 0], [0, 0, 0]]),
    qTrack("body", rt, [[0, yaw, 0], [0, yaw + Math.PI, 0], [0, yaw + Math.PI, 0], [0, Math.PI * 2, 0], [0, 0, 0]]),
    vTrack("body", "scale", rt, [[1, 1, 1], [1.05, 0.92, 1.05], [0.96, 1.06, 0.96], [1.06, 0.92, 1.06], [1, 1, 1]]),
  ]);
  return { idle, attack, return: ret };
}

/* The target: jolting and shaking while the lightning holds it, then gone
   in the puff; back for the preview after the queen hops home. */
export function zappedClip() {
  const S = SPELL;
  const t = [0, S.zapStart - 0.01];
  const pos = [[0, 0, 0], [0, 0, 0]], rot = [[0, 0, 0], [0, 0, 0]], scl = [[1, 1, 1], [1, 1, 1]];
  for (let i = 0; i <= 10; i++) {
    t.push(S.zapStart + ((S.zapEnd - S.zapStart) * i) / 10);
    const s = i % 2 ? 1 : -1;
    pos.push([s * 0.02, 0.03 + (i % 3) * 0.015, 0]);
    rot.push([-0.12 + s * 0.04, 0, s * 0.08]);
    scl.push(i % 2 ? [1.04, 0.97, 1.04] : [0.97, 1.04, 0.97]);
  }
  const len = S.end + 0.75;
  t.push(S.enemyPoof + 0.08, len - 0.15, len);
  pos.push([0, 0.1, 0], [0, 0, 0], [0, 0, 0]);
  rot.push([0, 0, 0], [0, 0, 0], [0, 0, 0]);
  scl.push([0.001, 0.001, 0.001], [0.001, 0.001, 0.001], [1, 1, 1]);
  return new THREE.AnimationClip("zapped", len, [
    vTrack("body", "position", t, pos),
    qTrack("body", t, rot),
    vTrack("body", "scale", t, scl),
  ]);
}

/* ---------- Effects ---------- */

/* Lightning from a moving start point (the orb) to a target point. Returns
   update(t, from, to) and dispose(). The bolt is redrawn a few times a
   second with fresh zigzags and a branch or two, so it crackles. */
export function makeZap(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const core = new THREE.MeshBasicMaterial({ color: "#f2fbff", transparent: true, depthWrite: false });
  const glow = new THREE.MeshBasicMaterial({ color: "#5fc8ff", transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending });
  /* A flickering glow where the bolt lands. (No real light: adding and
     removing lights makes every material recompile, which stalls phones.) */
  const spark = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 10), new THREE.MeshBasicMaterial({ color: "#bfefff", transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  group.add(spark);
  let last = -1;
  const jag = (a, b, depth, spread) => {
    if (depth === 0) return [a, b];
    const mid = a.clone().lerp(b, 0.5);
    const len = a.distanceTo(b);
    mid.add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(len * spread));
    return [...jag(a, mid, depth - 1, spread), ...jag(mid, b, depth - 1, spread).slice(1)];
  };
  const tube = (pts, r, mat) => {
    const path = new THREE.CurvePath();
    for (let i = 0; i < pts.length - 1; i++) path.add(new THREE.LineCurve3(pts[i], pts[i + 1]));
    return new THREE.Mesh(new THREE.TubeGeometry(path, pts.length * 2, r, 5, false), mat);
  };
  const clear = () => {
    for (const m of [...group.children]) if (m !== spark) { m.geometry.dispose(); group.remove(m); }
  };
  return {
    update(time, from, to, strength = 1) {
      spark.position.copy(to);
      spark.material.opacity = strength > 0 ? strength * (0.45 + Math.random() * 0.4) : 0;
      spark.scale.setScalar(0.7 + Math.random() * 0.6);
      core.opacity = strength;
      glow.opacity = 0.35 * strength;
      if (strength <= 0) { clear(); return; }
      if (Math.floor(time / 0.05) === last) return;
      last = Math.floor(time / 0.05);
      clear();
      const main = jag(from, to, 4, 0.5);
      group.add(tube(main, 0.011, core), tube(main, 0.04, glow));
      for (let b = 0; b < 2; b++) {
        const i = 3 + Math.floor(Math.random() * (main.length - 6));
        const start = main[i];
        const end = start.clone().add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.7, Math.random() - 0.5).multiplyScalar(0.6));
        const branch = jag(start, end, 3, 0.55);
        group.add(tube(branch, 0.005, core), tube(branch, 0.018, glow));
      }
    },
    dispose() { clear(); scene.remove(group); },
  };
}

/* A puff at a point: smoke balls (or sparkles) bursting out and up while
   they fade. Returns update(t) for t from 0 and dispose(). */
export function makePoof(scene, at, { colour = "#d9d2c8", sparkle = false, count = 16, size = 0.16 } = {}) {
  const group = new THREE.Group();
  group.position.copy(at);
  scene.add(group);
  const geo = sparkle ? new THREE.OctahedronGeometry(1, 0) : new THREE.IcosahedronGeometry(1, 1);
  const bits = [];
  for (let i = 0; i < count; i++) {
    const mat = sparkle
      ? new THREE.MeshBasicMaterial({ color: colour, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
      : new THREE.MeshStandardMaterial({ color: colour, roughness: 1, transparent: true, depthWrite: false });
    const m = new THREE.Mesh(geo, mat);
    const a = (i / count) * Math.PI * 2 + Math.random() * 0.4;
    const dir = new THREE.Vector3(Math.cos(a), 0.4 + Math.random() * 0.9, Math.sin(a)).normalize();
    const s = size * (0.6 + Math.random() * 0.7);
    m.position.set(0, 0.25 + Math.random() * 0.6, 0);
    m.userData = { dir, speed: 0.7 + Math.random() * 0.8, s, y0: m.position.y, spin: Math.random() * 6 };
    group.add(m);
    bits.push(m);
  }
  return {
    update(t) {
      for (const m of bits) {
        const { dir, speed, s, y0, spin } = m.userData;
        const out = 1 - Math.exp(-t * 5);
        m.position.set(dir.x * speed * out * 0.7, y0 + dir.y * speed * out * 0.7 + t * 0.2, dir.z * speed * out * 0.7);
        const grow = sparkle ? s * Math.max(0, 1 - t * 1.6) : s * (0.5 + out);
        m.scale.setScalar(Math.max(grow, 0.0001));
        m.rotation.set(spin * t, spin * t * 0.7, 0);
        m.material.opacity = Math.max(0, 1 - t / (sparkle ? 0.6 : 0.8));
      }
    },
    dispose() { scene.remove(group); geo.dispose(); },
  };
}

export const SPARKLE = { white: "#ffe6a8", black: "#d8c2ff" };
export const finialWood = (colour) => FINIAL[colour] || WOOD[colour];
