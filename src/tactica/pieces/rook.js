/* Chess Tactica rook: the set's turned wooden base, a straight tower and a
   battlemented turret for a head. He fights with a long spear: two spins,
   a charge down the file and a thrust straight through his target.
   Same axes as the pawn: front +Z, up +Y. */
import * as THREE from "three";
import { buildArm, chaikin, holdAt, makeEye, makeMats, shadowed } from "./pawn.js";

const BODY_PROFILE = [
  [0.0, 0.03], [0.47, 0.03], [0.5, 0.05], [0.505, 0.09], [0.49, 0.115],
  [0.455, 0.13], [0.47, 0.15], [0.475, 0.21], [0.45, 0.29], [0.39, 0.35],
  [0.32, 0.39], [0.27, 0.41], [0.31, 0.42], [0.32, 0.445], [0.29, 0.465],
  [0.23, 0.475], [0.21, 0.52], [0.195, 0.65], [0.185, 0.8], [0.19, 0.9],
  [0.22, 0.93], [0.26, 0.95], [0.255, 0.975], [0.2, 0.985], [0.15, 0.99],
];
/* Turret, turned separately so it can nod: a drum with a rim and a sunken top. */
const TURRET_PROFILE = [
  [0.0, 0.0], [0.19, 0.0], [0.24, 0.012], [0.265, 0.04], [0.27, 0.1], [0.27, 0.2],
  [0.285, 0.215], [0.285, 0.235], [0.21, 0.235], [0.21, 0.215], [0.0, 0.215],
];
const TURRET_Y = 0.97;
export const ARM = { upper: 0.2, fore: 0.21, x: 0.21, y: 0.84 };

/* One-handed spear poses, solved offline: hand spot and spear direction. */
const POSES = {"rest":{"shoulderR":[1.38,-0.04,-2.19],"elbowR":-1.83,"wrist":[0,0,0,1],"shoulderL":[0.96,-0.04,1.24],"elbowL":-1.83},"twirl":{"shoulderR":[0.4,-0.53,-2.26],"elbowR":-0.57,"wrist":[-0.69,0.48,0.533,-0.097],"shoulderL":[1.03,0.1,1.24],"elbowL":-1.97},"couch":{"shoulderR":[1.38,-0.25,-1.49],"elbowR":-2.25,"wrist":[-0.087,0.058,0.732,0.673],"shoulderL":[1.38,0.73,0.05],"elbowL":-2.04},"thrust":{"shoulderR":[0.12,0.87,-1.56],"elbowR":-1.34,"wrist":[-0.252,-0.299,0.889,0.237],"shoulderL":[1.38,0.8,0.05],"elbowL":-1.76},"flick":{"shoulderR":[0.05,0.38,-2.33],"elbowR":-1.69,"wrist":[-0.509,-0.294,0.699,0.408],"shoulderL":[1.38,0.8,0.05],"elbowL":-2.25}};
const REST_SPEAR = new THREE.Vector3(0, 1, 0.08).normalize();

function itemQuat(dir, edgeHint = new THREE.Vector3(1, 0, 0)) {
  const y = dir.clone().normalize();
  const x = edgeHint.clone().addScaledVector(y, -edgeHint.dot(y)).normalize();
  const z = new THREE.Vector3().crossVectors(x, y);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

/* Spear along its own +Y, held at the origin: shaft runs back to -0.55,
   forward to a steel socket, a red tassel and a leaf-shaped head. */
function buildSpear() {
  const s = new THREE.Group();
  s.name = "spear";
  const shaftWood = new THREE.MeshPhysicalMaterial({ color: "#6a4526", roughness: 0.5, clearcoat: 0.4 });
  const steel = new THREE.MeshStandardMaterial({ color: "#e6eaee", metalness: 0.75, roughness: 0.22, emissive: "#3a4048", emissiveIntensity: 0.35 });
  const red = new THREE.MeshStandardMaterial({ color: "#a3202a", roughness: 0.8 });

  const shaft = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.019, 1.28, 16), shaftWood));
  shaft.position.y = 0.09;
  s.add(shaft);
  const butt = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.016, 0.04, 16), steel));
  butt.position.y = -0.57;
  s.add(butt);
  const socket = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.021, 0.07, 16), steel));
  socket.position.y = 0.76;
  s.add(socket);
  /* Tassel: a ring of strands hanging off the socket. */
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const strand = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.002, 0.09, 6), red);
    strand.position.set(Math.cos(a) * 0.022, 0.7, Math.sin(a) * 0.022);
    strand.rotation.set(Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3);
    s.add(strand);
  }
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.024, 16, 10), red);
  knot.position.y = 0.735;
  s.add(knot);

  const leaf = new THREE.Shape();
  leaf.moveTo(-0.014, 0.79);
  leaf.quadraticCurveTo(-0.05, 0.85, -0.03, 0.92);
  leaf.quadraticCurveTo(-0.012, 0.97, 0, 1.0);
  leaf.quadraticCurveTo(0.012, 0.97, 0.03, 0.92);
  leaf.quadraticCurveTo(0.05, 0.85, 0.014, 0.79);
  leaf.closePath();
  const depth = 0.008;
  const g = new THREE.ExtrudeGeometry(leaf, { depth, curveSegments: 14, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.003, bevelSegments: 2 });
  g.translate(0, 0, -depth / 2);
  s.add(shadowed(new THREE.Mesh(g, steel)));
  const ridge = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.009, 0.19, 8), steel));
  ridge.position.y = 0.89;
  s.add(ridge);
  return s;
}

/* Battlements: six merlons around the turret rim. */
function buildMerlons(mat) {
  const group = new THREE.Group();
  const span = 0.62, rIn = 0.21, rOut = 0.285, h = 0.1;
  for (let i = 0; i < 6; i++) {
    const c = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const shape = new THREE.Shape();
    const a0 = c - span / 2, a1 = c + span / 2;
    shape.moveTo(Math.cos(a0) * rOut, Math.sin(a0) * rOut);
    shape.absarc(0, 0, rOut, a0, a1, false);
    shape.lineTo(Math.cos(a1) * rIn, Math.sin(a1) * rIn);
    shape.absarc(0, 0, rIn, a1, a0, true);
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: h, curveSegments: 12, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.006, bevelSegments: 2 });
    g.rotateX(-Math.PI / 2);
    group.add(shadowed(new THREE.Mesh(g, mat)));
  }
  group.position.y = 0.235;
  return group;
}

export function buildRook(colour = "white") {
  const mats = makeMats(colour);
  const rook = new THREE.Group();
  rook.name = "rook_" + colour;
  const body = new THREE.Group();
  body.name = "body";
  rook.add(body);

  const turned = (pts) => chaikin(pts, 2).map(([r, y]) => new THREE.Vector2(Math.max(r, 0), y));
  body.add(shadowed(new THREE.Mesh(new THREE.LatheGeometry(turned(BODY_PROFILE), 96), mats.wood)));
  const felt = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.475, 0.475, 0.03, 64), mats.felt));
  felt.position.y = 0.015;
  body.add(felt);

  const head = new THREE.Group();
  head.name = "head";
  head.position.y = TURRET_Y;
  const drum = shadowed(new THREE.Mesh(new THREE.LatheGeometry(turned(TURRET_PROFILE), 96), mats.wood));
  drum.rotation.y = Math.PI;
  head.add(drum);
  head.add(buildMerlons(mats.wood));
  for (const s of [-1, 1]) {
    const th = s * 0.33;
    const dir = new THREE.Vector3(Math.sin(th), 0, Math.cos(th));
    const eye = new THREE.Group();
    eye.name = s < 0 ? "eyeR" : "eyeL";
    eye.position.set(Math.sin(th) * 0.266, 0.12, Math.cos(th) * 0.266);
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
  rook.updateMatrixWorld(true);
  /* The spear sits in a pivot in the fist, so it can slide and twirl in
     the hand without moving the arm. */
  const pivot = new THREE.Group();
  pivot.name = "spearPivot";
  pivot.add(buildSpear());
  holdAt(rook, R.hand, pivot, R.hand.getWorldPosition(new THREE.Vector3()), itemQuat(REST_SPEAR));
  return rook;
}

/* ---------- Animation ---------- */

const qOf = (e) => new THREE.Quaternion().setFromEuler(new THREE.Euler(...e)).toArray();
const qTrack = (node, times, eulers) =>
  new THREE.QuaternionKeyframeTrack(node + ".quaternion", times, eulers.flatMap(qOf));
const rawQTrack = (node, times, quats) =>
  new THREE.QuaternionKeyframeTrack(node + ".quaternion", times, quats.flat());
const vTrack = (node, prop, times, vals) =>
  new THREE.VectorKeyframeTrack(node + "." + prop, times, vals.flat());
const add = (a, b) => a.map((v, i) => v + b[i]);

/* Key moments of the attack, in seconds. */
export const CHARGE = { twirlStart: 0.3, twirlEnd: 1.0, run: 1.1, arrive: 1.6, pierce: 1.7, flick: 2.15, end: 2.8 };
/* While twirling he slides his grip to the middle of the shaft, so both
   ends clear his base and the board. */
const TWIRL_SLIDE = -0.2;
/* Gap between where he stops and the target, so the spear runs it through. */
const STAND_OFF = 1.05;

export function rookClips([dx, dz] = [0, 3.6]) {
  const P = POSES, C = CHARGE;
  const dist = Math.hypot(dx, dz), ux = dx / dist, uz = dz / dist;
  const yaw = Math.atan2(dx, dz);
  const at = (d, y = 0) => [ux * d, y, uz * d];

  const blink = [[1, 1, 1], [1, 1, 1], [1, 0.08, 1], [1, 1, 1], [1, 1, 1]];
  const bt = [0, 2.1, 2.19, 2.28, 3];
  const idle = new THREE.AnimationClip("idle", 3, [
    vTrack("body", "scale", [0, 1.5, 3], [[1, 1, 1], [1.01, 0.988, 1.01], [1, 1, 1]]),
    qTrack("shoulderR", [0, 1.5, 3], [P.rest.shoulderR, add(P.rest.shoulderR, [0.03, 0, 0.03]), P.rest.shoulderR]),
    qTrack("shoulderL", [0, 1.5, 3], [P.rest.shoulderL, add(P.rest.shoulderL, [0.05, 0, -0.03]), P.rest.shoulderL]),
    qTrack("head", [0, 1.5, 3], [[0, 0, 0], [0.02, 0.03, 0], [0, 0, 0]]),
    vTrack("eyeR", "scale", bt, blink),
    vTrack("eyeL", "scale", bt, blink),
  ]);

  /* Body stays planted while the spear twirls, then the charge with
     running bounces, the lunge, the hold and the step onto the square. */
  const times = [0, 0.2, C.twirlEnd, C.twirlEnd + 0.06], pos = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const rot = [[0, 0, 0], [0, yaw, 0], [0, yaw, 0], [0.1, yaw, 0]];
  const scl = [[1, 1, 1], [1.03, 0.96, 1.03], [1.03, 0.96, 1.03], [1.05, 0.93, 1.05]];
  const stop = dist - STAND_OFF;
  const steps = 4;
  for (let i = 0; i <= steps * 2; i++) {
    const u = i / (steps * 2);
    times.push(C.run + (C.arrive - C.run) * u);
    pos.push(at(stop * u, i % 2 ? 0.07 : 0));
    rot.push([0.22, yaw, 0]);
    scl.push(i % 2 ? [0.97, 1.05, 0.97] : [1.04, 0.95, 1.04]);
  }
  const p = C.pierce;
  times.push(p, p + 0.12, p + 0.24, p + 0.35, C.flick, C.flick + 0.2, C.flick + 0.45, C.end);
  pos.push(at(stop + 0.15), at(stop + 0.15), at(stop + 0.15), at(stop + 0.15), at(stop + 0.05), at((stop + dist) / 2, 0.25), at(dist), at(dist));
  rot.push([0.3, yaw, 0], [0.27, yaw + 0.03, 0], [0.27, yaw - 0.03, 0], [0.27, yaw, 0], [-0.12, yaw, 0], [0, yaw, 0], [0, yaw, 0], [0, yaw, 0]);
  scl.push([0.95, 1.06, 0.95], [1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1], [0.97, 1.04, 0.97], [1.05, 0.93, 1.05], [1, 1, 1]);

  const kt = [0, 0.22, C.twirlEnd, C.run, C.arrive, p, p + 0.35, C.flick, C.flick + 0.2, C.flick + 0.45, C.end];
  const K = ["rest", "twirl", "twirl", "couch", "couch", "thrust", "thrust", "flick", "rest", "rest", "rest"];
  const arms = [
    qTrack("shoulderR", kt, K.map((k) => P[k].shoulderR)),
    qTrack("elbowR", kt, K.map((k) => [P[k].elbowR, 0, 0])),
    rawQTrack("handR", kt, K.map((k) => P[k].wrist)),
    qTrack("shoulderL", kt, K.map((k) => P[k].shoulderL)),
    qTrack("elbowL", kt, K.map((k) => [P[k].elbowL, 0, 0])),
  ];

  /* The twirl: two full turns of the spear in his fist, speeding up then
     easing off, keyed every quarter turn so it never spins backwards. */
  const tw = [0, C.twirlStart - 0.06], twQ = [[0, 0, 0], [0, 0, 0]];
  const quarters = 8;
  for (let i = 0; i <= quarters; i++) {
    const u = i / quarters;
    const eased = u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u);
    tw.push(C.twirlStart + (C.twirlEnd - C.twirlStart) * u);
    twQ.push([eased * Math.PI * 4, 0, 0]);
  }
  tw.push(C.end);
  twQ.push([0, 0, 0]);
  const slideT = [0, 0.18, C.twirlStart - 0.04, C.twirlEnd, C.twirlEnd + 0.08, C.end];
  const spear = [
    qTrack("spear", tw, twQ),
    vTrack("spear", "position", slideT, [[0, 0, 0], [0, 0, 0], [0, TWIRL_SLIDE, 0], [0, TWIRL_SLIDE, 0], [0, 0, 0], [0, 0, 0]]),
  ];

  const attack = new THREE.AnimationClip("attack", C.end, [
    vTrack("body", "position", times, pos),
    qTrack("body", times, rot),
    vTrack("body", "scale", times, scl),
    ...arms,
    ...spear,
  ]);

  const rt = [0, 0.15, 0.4, 0.62, 0.75];
  const ret = new THREE.AnimationClip("return", 0.75, [
    vTrack("body", "position", rt, [[dx, 0, dz], [dx, 0, dz], [dx / 2, 0.3, dz / 2], [0, 0, 0], [0, 0, 0]]),
    qTrack("body", rt, [[0, yaw, 0], [0, yaw + Math.PI, 0], [0, yaw + Math.PI, 0], [0, Math.PI * 2, 0], [0, 0, 0]]),
    vTrack("body", "scale", rt, [[1, 1, 1], [1.05, 0.92, 1.05], [0.96, 1.06, 0.96], [1.06, 0.92, 1.06], [1, 1, 1]]),
  ]);
  return { idle, attack, return: ret };
}

/* The target, facing the rook: run through, shaking on the spear, then
   flung up and away when he flicks it; back for the preview at the end. */
export function skeweredClip() {
  const C = CHARGE;
  const p = C.pierce, f = C.flick, len = C.end + 0.75;
  const t = [0, p - 0.02, p + 0.03, p + 0.12, p + 0.24, p + 0.35, f, f + 0.15, f + 0.35, len - 0.15, len];
  return new THREE.AnimationClip("skewered", len, [
    vTrack("body", "position", t, [[0, 0, 0], [0, 0, 0], [0, 0.02, -0.1], [0, 0.04, -0.1], [0, 0.04, -0.1], [0, 0.06, -0.1], [0, 0.1, -0.12], [0, 1.0, -1.1], [0, 0.6, -2.0], [0, 0, 0], [0, 0, 0]]),
    qTrack("body", t, [[0, 0, 0], [0, 0, 0], [-0.3, 0, 0], [-0.28, 0, 0.07], [-0.28, 0, -0.07], [-0.3, 0, 0], [-0.4, 0, 0], [-2.2, 0, 0.6], [-3.6, 0, 1.2], [0, 0, 0], [0, 0, 0]]),
    vTrack("body", "scale", t, [[1, 1, 1], [1, 1, 1], [0.92, 1.06, 0.92], [1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1], [0.7, 0.7, 0.7], [0.001, 0.001, 0.001], [0.001, 0.001, 0.001], [1, 1, 1]]),
  ]);
}
