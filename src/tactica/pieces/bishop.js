/* Chess Tactica bishop: the set's turned wooden base, a double collar and a
   tall smooth capsule head with a small ball finial in the same wood (the
   contrasting finial is kept for the queen). He carries a big katana in
   both hands. Same axes as the pawn: front +Z, up +Y. */
import * as THREE from "three";
import { buildArm, chaikin, holdAt, makeEye, makeMats, shadowed } from "./pawn.js";

const BODY_PROFILE = [
  [0.0, 0.03], [0.47, 0.03], [0.5, 0.05], [0.505, 0.09], [0.49, 0.115],
  [0.455, 0.13], [0.47, 0.15], [0.475, 0.21], [0.45, 0.29], [0.39, 0.35],
  [0.3, 0.395], [0.25, 0.415], [0.3, 0.425], [0.31, 0.45], [0.28, 0.47],
  [0.21, 0.48], [0.17, 0.53], [0.14, 0.62], [0.125, 0.72], [0.12, 0.82],
  [0.13, 0.88], [0.22, 0.9], [0.25, 0.92], [0.24, 0.945], [0.17, 0.955],
  [0.15, 0.97], [0.2, 0.985], [0.215, 1.0], [0.2, 1.02], [0.13, 1.03], [0.09, 1.045],
];
/* The head, turned separately so it can nod: narrow at the collar, swelling
   to a rounded capsule top. */
const HEAD_PROFILE = [
  [0.0, 0.0], [0.1, 0.0], [0.105, 0.03], [0.11, 0.1], [0.13, 0.2], [0.165, 0.32],
  [0.195, 0.44], [0.205, 0.54], [0.195, 0.63], [0.16, 0.7], [0.1, 0.745], [0.04, 0.76], [0.0, 0.762],
];
const HEAD_Y = 1.03;
export const KATANA_SCALE = 1.35;
export const ARM = { upper: 0.2, fore: 0.21, x: 0.175, y: 0.86 };

/* Two-handed poses, solved offline: right hand and blade placed, the left
   hand lower on the same grip. Wrist is the right hand's turn from rest. */
const POSES = {"rest":{"shoulderR":[0.4,1.22,-1.56],"elbowR":-1.34,"wrist":[0,0,0,1],"shoulderL":[-2.82,-1.3,-1.91],"elbowL":-0.99},"hasso":{"shoulderR":[-0.58,0.73,-1.63],"elbowR":-1.83,"wrist":[-0.925,-0.051,-0.265,-0.266],"shoulderL":[-2.75,-1.02,-1.14],"elbowL":-0.71},"strike":{"shoulderR":[-1.35,1.15,0.05],"elbowR":-0.71,"wrist":[0.051,0.161,-0.45,-0.877],"shoulderL":[-2.12,-1.3,-0.79],"elbowL":-1.06},"follow":{"shoulderR":[-1.91,1.15,0.96],"elbowR":-0.64,"wrist":[-0.193,0.012,0.619,0.761],"shoulderL":[-0.44,-0.67,0.05],"elbowL":-1.41},"flick":{"shoulderR":[-0.09,0.66,-0.79],"elbowR":-1.41,"wrist":[0.189,-0.35,0.304,0.866],"shoulderL":[-3.1,-1.09,-1.77],"elbowL":-0.92}};
/* Blade direction in the rest (ready) stance: forward and up. */
const REST_BLADE = new THREE.Vector3(0.05, 0.55, 0.83).normalize();

/* Katana frame: blade along +Y, cutting edge along +X, edge turned down. */
function bladeQuat(dir, edgeHint = new THREE.Vector3(0, -1, 0)) {
  const y = dir.clone().normalize();
  const x = edgeHint.clone().addScaledVector(y, -edgeHint.dot(y)).normalize();
  const z = new THREE.Vector3().crossVectors(x, y);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

function wrapTexture() {
  const S = 128, cv = document.createElement("canvas");
  cv.width = S; cv.height = S;
  const g = cv.getContext("2d");
  g.fillStyle = "#ece3cf"; g.fillRect(0, 0, S, S);
  g.fillStyle = "#1b1820";
  /* Crossed silk wrap leaving ivory diamonds. */
  for (const flip of [1, -1]) {
    g.save();
    g.translate(S / 2, S / 2); g.scale(flip, 1); g.translate(-S / 2, -S / 2);
    g.beginPath();
    g.moveTo(0, 0); g.lineTo(S * 0.42, 0); g.lineTo(S, S * 0.58); g.lineTo(S, S); g.lineTo(S * 0.58, S); g.lineTo(0, S * 0.42);
    g.closePath(); g.fill();
    g.restore();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 6);
  return t;
}

/* Katana along its own +Y. Origin is where the right hand holds, just
   under the guard; the long grip runs down to -0.2 for the left hand. */
function buildKatana() {
  const k = new THREE.Group();
  k.name = "katana";
  const iron = new THREE.MeshStandardMaterial({ color: "#2c2b2f", metalness: 0.8, roughness: 0.45 });
  const brass = new THREE.MeshStandardMaterial({ color: "#c9a14a", metalness: 1, roughness: 0.3 });
  const blade = new THREE.MeshStandardMaterial({ color: "#eef2f6", metalness: 0.75, roughness: 0.22, emissive: "#3a4048", emissiveIntensity: 0.35 });

  const tsuka = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.021, 0.245, 20), new THREE.MeshStandardMaterial({ map: wrapTexture(), roughness: 0.7 })));
  tsuka.scale.set(1, 1, 0.8);
  tsuka.position.y = -0.08;
  k.add(tsuka);
  const kashira = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.02, 0.018, 20), iron));
  kashira.scale.set(1, 1, 0.8);
  kashira.position.y = -0.21;
  k.add(kashira);
  const tsuba = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.009, 32), iron));
  tsuba.scale.set(1, 1, 0.85);
  tsuba.position.y = 0.05;
  k.add(tsuba);
  const habaki = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.02, 0.026, 16), brass));
  habaki.scale.set(1, 1, 0.55);
  habaki.position.y = 0.068;
  k.add(habaki);

  /* Curved blade: edge on +X, back on -X, bending back toward the spine. */
  const L = 0.8, base = 0.072, N = 28;
  const centre = (t) => -0.05 * t * t;
  const width = (t) => 0.033 - 0.007 * t;
  const shape = new THREE.Shape();
  const edge = [], back = [];
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * 0.93;
    edge.push([centre(t) + width(t) / 2, base + t * L]);
    back.push([centre(t) - width(t) / 2, base + t * L]);
  }
  shape.moveTo(...back[0]);
  shape.lineTo(...edge[0]);
  for (const p of edge.slice(1)) shape.lineTo(...p);
  /* Kissaki: the edge sweeps up to a point on the back line. */
  const tip = [centre(1) - width(1) / 2 + 0.004, base + L];
  shape.quadraticCurveTo(centre(0.985) + width(0.985) / 2, base + 0.985 * L, ...tip);
  for (const p of back.slice(1).reverse()) shape.lineTo(...p);
  shape.closePath();
  const depth = 0.006;
  const g = new THREE.ExtrudeGeometry(shape, { depth, curveSegments: 12, bevelEnabled: true, bevelThickness: 0.0025, bevelSize: 0.002, bevelSegments: 2 });
  g.translate(0, 0, -depth / 2);
  k.add(shadowed(new THREE.Mesh(g, blade)));
  return k;
}

export function buildBishop(colour = "white") {
  const mats = makeMats(colour);
  const bishop = new THREE.Group();
  bishop.name = "bishop_" + colour;
  const body = new THREE.Group();
  body.name = "body";
  bishop.add(body);

  const turned = (pts) => chaikin(pts, 2).map(([r, y]) => new THREE.Vector2(Math.max(r, 0), y));
  body.add(shadowed(new THREE.Mesh(new THREE.LatheGeometry(turned(BODY_PROFILE), 96), mats.wood)));
  const felt = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.475, 0.475, 0.03, 64), mats.felt));
  felt.position.y = 0.015;
  body.add(felt);

  const head = new THREE.Group();
  head.name = "head";
  head.position.y = HEAD_Y;
  const cap = shadowed(new THREE.Mesh(new THREE.LatheGeometry(turned(HEAD_PROFILE), 96), mats.wood));
  cap.rotation.y = Math.PI;
  head.add(cap);
  const finial = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.055, 32, 20), mats.wood));
  finial.position.y = 0.8;
  head.add(finial);
  for (const s of [-1, 1]) {
    const th = s * 0.34, ey = 0.47;
    const dir = new THREE.Vector3(Math.sin(th), 0.04, Math.cos(th)).normalize();
    const eye = new THREE.Group();
    eye.name = s < 0 ? "eyeR" : "eyeL";
    eye.position.set(Math.sin(th) * 0.195, ey, Math.cos(th) * 0.195);
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
  bishop.updateMatrixWorld(true);
  const katana = buildKatana();
  katana.scale.setScalar(KATANA_SCALE);
  holdAt(bishop, R.hand, katana, R.hand.getWorldPosition(new THREE.Vector3()), bladeQuat(REST_BLADE));

  /* Slash streak left along his path; it hangs off the root so it can
     stretch from the start square to where he stops. */
  const streak = new THREE.Group();
  streak.name = "streak";
  streak.scale.set(1, 1, 0.001);
  const geo = new THREE.BoxGeometry(0.035, 0.012, 1);
  geo.translate(0, 0, 0.5);
  const core = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0, depthWrite: false }));
  core.name = "streakCore";
  core.position.y = 0.8;
  streak.add(core);
  const glowGeo = new THREE.PlaneGeometry(0.22, 1);
  glowGeo.rotateX(-Math.PI / 2);
  glowGeo.translate(0, 0, 0.5);
  const glow = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({ color: "#bfe6ff", transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  glow.name = "streakGlow";
  glow.position.y = 0.8;
  streak.add(glow);
  bishop.add(streak);
  return bishop;
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

/* When the cut shows on the enemy (after he has already passed through). */
export const SPLIT_T = 0.9;
/* How far past the target he skids before stepping back onto it. */
const OVERSHOOT = 0.75;

export function bishopClips([dx, dz] = [-2.4, 2.4]) {
  const P = POSES;
  const dist = Math.hypot(dx, dz), ux = dx / dist, uz = dz / dist;
  const yaw = Math.atan2(dx, dz);
  const end = [dx + ux * OVERSHOOT, 0, dz + uz * OVERSHOOT];
  const full = dist + OVERSHOOT;

  const blink = [[1, 1, 1], [1, 1, 1], [1, 0.08, 1], [1, 1, 1], [1, 1, 1]];
  const bt = [0, 2.3, 2.39, 2.48, 3.2];
  const idle = new THREE.AnimationClip("idle", 3.2, [
    vTrack("body", "scale", [0, 1.6, 3.2], [[1, 1, 1], [1.01, 0.988, 1.01], [1, 1, 1]]),
    qTrack("shoulderR", [0, 1.6, 3.2], [P.rest.shoulderR, add(P.rest.shoulderR, [0.04, 0, 0]), P.rest.shoulderR]),
    qTrack("shoulderL", [0, 1.6, 3.2], [P.rest.shoulderL, add(P.rest.shoulderL, [0.04, 0, 0]), P.rest.shoulderL]),
    qTrack("head", [0, 1.6, 3.2], [[0, 0, 0], [0.025, 0, -0.02], [0, 0, 0]]),
    vTrack("eyeR", "scale", bt, blink),
    vTrack("eyeL", "scale", bt, blink),
  ]);

  /* Stance, then one blink-fast dash along the diagonal with the cut. */
  const t = [0, 0.2, 0.42, 0.47, 0.5, 0.56, 0.85, 1.1, 1.35, 1.55, 1.75, 2.0];
  const back = [-ux * 0.08, 0, -uz * 0.08];
  const mid = [end[0] * 0.45, 0, end[2] * 0.45];
  const hop = [(dx + end[0]) / 2, 0.22, (dz + end[2]) / 2];
  const pos = [[0, 0, 0], [0, 0, 0], back, back, mid, end, end, end, end, hop, [dx, 0, dz], [dx, 0, dz]];
  const rot = [[0, 0, 0], [0, yaw, 0], [-0.06, yaw, 0], [0.05, yaw, 0], [0.35, yaw, 0], [0.3, yaw, 0], [0.12, yaw, 0], [0, yaw, 0], [0, yaw, 0], [0, yaw, 0], [0, yaw, 0], [0, yaw, 0]];
  const scl = [[1, 1, 1], [1, 1, 1], [1.05, 0.92, 1.05], [1.05, 0.92, 1.05], [0.9, 1.1, 0.9], [1.04, 0.95, 1.04], [1, 1, 1], [1, 1, 1], [1, 1, 1], [0.97, 1.04, 0.97], [1.04, 0.95, 1.04], [1, 1, 1]];
  /* Arm keys per time above. */
  const K = ["rest", "rest", "hasso", "hasso", "strike", "follow", "follow", "flick", "rest", "rest", "rest", "rest"];
  const arms = [
    qTrack("shoulderR", t, K.map((k) => P[k].shoulderR)),
    qTrack("elbowR", t, K.map((k) => [P[k].elbowR, 0, 0])),
    rawQTrack("handR", t, K.map((k) => P[k].wrist)),
    qTrack("shoulderL", t, K.map((k) => P[k].shoulderL)),
    qTrack("elbowL", t, K.map((k) => [P[k].elbowL, 0, 0])),
  ];

  const st = [0, 0.47, 0.5, 0.56, 0.75, 1.0, 2.0];
  const streak = [
    qTrack("streak", st, st.map(() => [0, yaw, 0])),
    vTrack("streak", "scale", st, [[1, 1, 0.001], [1, 1, 0.001], [1, 1, full * 0.45], [1, 1, full], [1, 1, full], [1, 1, full], [1, 1, 0.001]]),
    nTrack("streakCore.material.opacity", st, [0, 0, 1, 1, 0.8, 0, 0]),
    nTrack("streakGlow.material.opacity", st, [0, 0, 0.9, 0.9, 0.5, 0, 0]),
  ];

  const attack = new THREE.AnimationClip("attack", 2.0, [
    vTrack("body", "position", t, pos),
    qTrack("body", t, rot),
    vTrack("body", "scale", t, scl),
    ...arms,
    ...streak,
  ]);

  const rt = [0, 0.15, 0.4, 0.62, 0.75];
  const ret = new THREE.AnimationClip("return", 0.75, [
    vTrack("body", "position", rt, [[dx, 0, dz], [dx, 0, dz], [dx / 2, 0.3, dz / 2], [0, 0, 0], [0, 0, 0]]),
    qTrack("body", rt, [[0, yaw, 0], [0, yaw + Math.PI, 0], [0, yaw + Math.PI, 0], [0, Math.PI * 2, 0], [0, 0, 0]]),
    vTrack("body", "scale", rt, [[1, 1, 1], [1.05, 0.92, 1.05], [0.96, 1.06, 0.96], [1.06, 0.92, 1.06], [1, 1, 1]]),
  ]);
  return { idle, attack, return: ret };
}
