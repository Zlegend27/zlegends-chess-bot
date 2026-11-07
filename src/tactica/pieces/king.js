/* Chess Tactica king: the tallest piece. The set's turned wooden base, a long
   neck, a double collar and a rounded crown with a ring of pearls and a
   plain wooden ball on top (no cross). No weapon: his right hand points.
   His attack is a holy execution: he raises his hand to the sky, points at
   the enemy, draws a finger across his own neck, and the enemy's head falls
   off and rolls away. Same axes as the pawn: front +Z, up +Y. */
import * as THREE from "three";
import { buildArm, chaikin, makeEye, makeMats, shadowed } from "./pawn.js";

const BODY_PROFILE = [
  [0.0, 0.03], [0.47, 0.03], [0.5, 0.05], [0.505, 0.09], [0.49, 0.115],
  [0.455, 0.13], [0.47, 0.15], [0.475, 0.21], [0.45, 0.29], [0.39, 0.35],
  [0.3, 0.395], [0.25, 0.415], [0.3, 0.425], [0.31, 0.45], [0.28, 0.47],
  [0.21, 0.48], [0.17, 0.55], [0.145, 0.68], [0.13, 0.84], [0.125, 1.0],
  [0.135, 1.08], [0.24, 1.1], [0.27, 1.12], [0.26, 1.145], [0.18, 1.155],
  [0.155, 1.17], [0.215, 1.185], [0.23, 1.2], [0.215, 1.22], [0.13, 1.23], [0.09, 1.245],
];
/* Crown: a rounded bowl opening into a flared rim, with a low dome inside. */
const HEAD_PROFILE = [
  [0.0, 0.0], [0.1, 0.0], [0.115, 0.05], [0.15, 0.15], [0.2, 0.26], [0.225, 0.34],
  [0.235, 0.4], [0.27, 0.44], [0.28, 0.47], [0.26, 0.48], [0.2, 0.48], [0.17, 0.52],
  [0.12, 0.56], [0.06, 0.58], [0.0, 0.585],
];
const HEAD_Y = 1.23;
export const ARM = { upper: 0.22, fore: 0.23, x: 0.19, y: 1.03 };

/* Poses solved offline: hand spot and which way the finger points. */
const POSES = {"rest":{"shoulderR":[0.47,-0.32,-0.79],"elbowR":-1.76,"wrist":[0.282,0,0.388,0.877],"shoulderL":[0.82,0.1,1.24],"elbowL":-1.76},"raise":{"shoulderR":[-1.35,0.94,-1.49],"elbowR":-0.71,"wrist":[0.035,0,-0.093,0.995],"shoulderL":[0.75,0.1,1.31],"elbowL":-1.76},"point":{"shoulderR":[-1.07,1.15,-0.72],"elbowR":-0.71,"wrist":[0.207,0,0.078,0.975],"shoulderL":[0.82,0.17,1.31],"elbowL":-1.83},"slitA":{"shoulderR":[-2.68,0.8,0.61],"elbowR":-0.5,"wrist":[-0.781,0,-0.335,0.528],"shoulderL":[0.82,0.17,1.31],"elbowL":-1.83},"slitMid":{"shoulderR":[-1.91,0.73,-0.09],"elbowR":-1.06,"wrist":[-0.745,0,-0.247,0.619],"shoulderL":[0.82,0.17,1.31],"elbowL":-1.83},"slitB":{"shoulderR":[-1.84,-0.11,-0.3],"elbowR":-1.2,"wrist":[-0.755,0,0.117,0.645],"shoulderL":[0.82,0.17,1.31],"elbowL":-1.83},"flourish":{"shoulderR":[-1.91,-0.53,-0.72],"elbowR":-1.41,"wrist":[0.321,0,-0.227,0.92],"shoulderL":[0.82,0.17,1.31],"elbowL":-1.83}};

export function buildKing(colour = "white") {
  const mats = makeMats(colour);
  const king = new THREE.Group();
  king.name = "king_" + colour;
  const body = new THREE.Group();
  body.name = "body";
  king.add(body);

  const turned = (pts) => chaikin(pts, 2).map(([r, y]) => new THREE.Vector2(Math.max(r, 0), y));
  body.add(shadowed(new THREE.Mesh(new THREE.LatheGeometry(turned(BODY_PROFILE), 96), mats.wood)));
  const felt = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.475, 0.475, 0.03, 64), mats.felt));
  felt.position.y = 0.015;
  body.add(felt);

  const head = new THREE.Group();
  head.name = "head";
  head.position.y = HEAD_Y;
  const crown = shadowed(new THREE.Mesh(new THREE.LatheGeometry(turned(HEAD_PROFILE), 96), mats.wood));
  crown.rotation.y = Math.PI;
  head.add(crown);
  /* A ring of pearls just under the rim. */
  const pearl = new THREE.SphereGeometry(0.022, 16, 10);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const p = shadowed(new THREE.Mesh(pearl, mats.wood));
    p.position.set(Math.sin(a) * 0.262, 0.415, Math.cos(a) * 0.262);
    head.add(p);
  }
  /* The ball finial on a short turned neck, same wood as the king. */
  const stem = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.06, 24), mats.wood));
  stem.position.y = 0.6;
  head.add(stem);
  const ball = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.075, 32, 20), mats.wood));
  ball.position.y = 0.69;
  head.add(ball);
  for (const s of [-1, 1]) {
    const th = s * 0.34, ey = 0.22;
    const dir = new THREE.Vector3(Math.sin(th), 0.12, Math.cos(th)).normalize();
    const eye = new THREE.Group();
    eye.name = s < 0 ? "eyeR" : "eyeL";
    eye.position.set(Math.sin(th) * 0.198, ey, Math.cos(th) * 0.198);
    eye.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    makeEye(eye, mats);
    head.add(eye);
  }
  body.add(head);

  const R = buildArm("R", mats, ARM), L = buildArm("L", mats, ARM);
  body.add(R.shoulder, L.shoulder);
  /* The pointing finger and a thumb on the right fist; the finger runs down
     the hand's -Y, continuing the forearm. */
  const finger = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.055, 4, 10), mats.wood));
  finger.name = "finger";
  finger.position.set(0, -0.07, 0.012);
  R.hand.add(finger);
  const thumb = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.025, 4, 8), mats.wood));
  thumb.position.set(0.03, -0.03, 0.02);
  thumb.rotation.z = 0.7;
  R.hand.add(thumb);

  const P = POSES.rest;
  R.shoulder.rotation.set(...P.shoulderR);
  L.shoulder.rotation.set(...P.shoulderL);
  R.elbow.rotation.set(P.elbowR, 0, 0);
  L.elbow.rotation.set(P.elbowL, 0, 0);
  R.hand.quaternion.fromArray(P.wrist).normalize();
  return king;
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

/* Key moments, in seconds. The light column, the slash and the sparkles
   are effects that run alongside the clip at these times. */
export const DECREE = { raise: 0.6, beam: 0.5, point: 0.95, slitStart: 1.55, slit: 1.95, headDown: 2.25, rolled: 2.85, vanish: 2.95, step: 3.2, end: 3.6 };

export function kingClips([dx, dz] = [0, 1.2]) {
  const P = POSES, D = DECREE;
  const yaw = Math.atan2(dx, dz);
  const blink = [[1, 1, 1], [1, 1, 1], [1, 0.08, 1], [1, 1, 1], [1, 1, 1]];
  const bt = [0, 2.4, 2.49, 2.58, 3.4];
  const idle = new THREE.AnimationClip("idle", 3.4, [
    vTrack("body", "scale", [0, 1.7, 3.4], [[1, 1, 1], [1.01, 0.988, 1.01], [1, 1, 1]]),
    qTrack("shoulderR", [0, 1.7, 3.4], [P.rest.shoulderR, add(P.rest.shoulderR, [0.03, 0, 0.02]), P.rest.shoulderR]),
    qTrack("shoulderL", [0, 1.7, 3.4], [P.rest.shoulderL, add(P.rest.shoulderL, [0.03, 0, -0.02]), P.rest.shoulderL]),
    qTrack("head", [0, 1.7, 3.4], [[0, 0, 0], [0.02, 0.03, 0], [0, 0, 0]]),
    vTrack("eyeR", "scale", bt, blink),
    vTrack("eyeL", "scale", bt, blink),
  ]);

  /* He turns, raises his hand to the sky, points, draws his finger across
     his neck (head tilted back, eyes half shut), waits for the head to roll,
     then steps onto the square. */
  /* The neck gesture, big enough to read from across the board: the hand
     reaches over to his left, pauses, drags the fingertip across the front
     of his neck and is flung out wide to his right. */
  const kt = [0, 0.25, D.raise, D.point, 1.3, D.slitStart, 1.75, D.slit, 2.12, 2.32, 2.6, D.vanish, D.end];
  const K = ["rest", "rest", "raise", "point", "point", "slitA", "slitA", "slitMid", "slitB", "flourish", "flourish", "rest", "rest"];
  const arms = [
    qTrack("shoulderR", kt, K.map((k) => P[k].shoulderR)),
    qTrack("elbowR", kt, K.map((k) => [P[k].elbowR, 0, 0])),
    rawQTrack("handR", kt, K.map((k) => P[k].wrist)),
    qTrack("shoulderL", kt, K.map((k) => P[k].shoulderL)),
    qTrack("elbowL", kt, K.map((k) => [P[k].elbowL, 0, 0])),
  ];
  /* Chin up and turned away from the hand, eyes narrowed, as he does it. */
  const ht = [0, D.point, 1.3, D.slitStart, 1.75, D.slit, 2.32, 2.6, D.vanish];
  const eyes = [[1, 1, 1], [1, 0.75, 1], [1, 0.75, 1], [1, 0.45, 1], [1, 0.45, 1], [1, 0.4, 1], [1, 0.6, 1], [1, 1, 1], [1, 1, 1]];
  const head = [
    qTrack("head", ht, [[0, 0, 0], [0.05, 0, 0], [0.05, 0, 0], [-0.14, -0.12, -0.06], [-0.16, -0.12, -0.06], [-0.18, 0.05, 0], [-0.1, 0.18, 0.06], [0, 0, 0], [0, 0, 0]]),
    vTrack("eyeR", "scale", ht, eyes),
    vTrack("eyeL", "scale", ht, eyes),
  ];
  const bt2 = [0, 0.25, D.raise, D.point, D.step - 0.05, (D.step + D.end) / 2, D.end];
  const half = [dx / 2, 0.22, dz / 2];
  const body = [
    vTrack("body", "position", bt2, [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], half, [dx, 0, dz]]),
    qTrack("body", bt2, [[0, 0, 0], [0, yaw, 0], [-0.05, yaw, 0], [0.04, yaw, 0], [0, yaw, 0], [0, yaw, 0], [0, yaw, 0]]),
    vTrack("body", "scale", bt2, [[1, 1, 1], [1, 1, 1], [0.98, 1.04, 0.98], [1, 1, 1], [1.04, 0.94, 1.04], [0.97, 1.04, 0.97], [1, 1, 1]]),
  ];

  const attack = new THREE.AnimationClip("attack", D.end, [...body, ...arms, ...head]);

  const rt = [0, 0.15, 0.4, 0.62, 0.75];
  const ret = new THREE.AnimationClip("return", 0.75, [
    vTrack("body", "position", rt, [[dx, 0, dz], [dx, 0, dz], [dx / 2, 0.3, dz / 2], [0, 0, 0], [0, 0, 0]]),
    qTrack("body", rt, [[0, yaw, 0], [0, yaw + Math.PI, 0], [0, yaw + Math.PI, 0], [0, Math.PI * 2, 0], [0, 0, 0]]),
    vTrack("body", "scale", rt, [[1, 1, 1], [1.05, 0.92, 1.05], [0.96, 1.06, 0.96], [1.06, 0.92, 1.06], [1, 1, 1]]),
  ]);
  return { idle, attack, return: ret };
}

/* The condemned piece (facing the king): stiff with fear under the light,
   head pops off at the slash and falls. A round head (the pawn) rolls away;
   any other head topples onto its side and slides. Then the whole piece is
   gone in the sparkles. Back for the preview at the end. "headY" is the
   head node's rest height; "round" says it is a ball centred on that point. */
export function executedClip({ headY = 1.14, round = true } = {}) {
  const D = DECREE;
  const len = D.end + 0.75;
  const r = 0.235;
  const t = [0, D.slit - 0.02, D.slit + 0.1, D.headDown];
  const pos = [[0, headY, 0], [0, headY, 0], [0.05, headY + 0.18, 0]];
  const rot = [[0, 0, 0], [0, 0, 0], [0.3, 0, -0.4]];
  const steps = 6;
  if (round) {
    /* Roll along the piece's own +X (its right), a little back. */
    const roll = (x) => [x, r, -0.12 - x * 0.15];
    pos.push(roll(0.42));
    rot.push([0.2, 0, -1.2]);
    for (let i = 1; i <= steps; i++) {
      const u = i / steps;
      const x = 0.42 + 0.85 * (1 - (1 - u) * (1 - u));
      t.push(D.headDown + (D.rolled - D.headDown) * u);
      pos.push(roll(x));
      rot.push([0.2, 0, -1.2 - (x - 0.42) / r]);
    }
  } else {
    /* Lands on its side and skids to a stop. */
    const lie = (x) => [x, 0.14, -0.1 - x * 0.12];
    pos.push(lie(0.45));
    rot.push([0.1, 0, -1.45]);
    for (let i = 1; i <= steps; i++) {
      const u = i / steps;
      const x = 0.45 + 0.4 * (1 - (1 - u) * (1 - u));
      t.push(D.headDown + (D.rolled - D.headDown) * u);
      pos.push(lie(x));
      rot.push([0.1 + 0.05 * Math.sin(u * 9) * (1 - u), 0, -1.57 + 0.12 * Math.sin(u * 7) * (1 - u)]);
    }
  }
  t.push(len - 0.15, len - 0.149, len);
  pos.push(pos[pos.length - 1], [0, headY, 0], [0, headY, 0]);
  rot.push(rot[rot.length - 1], [0, 0, 0], [0, 0, 0]);

  const bodyT = [0, D.beam + 0.2, D.slit - 0.02, D.slit + 0.05, D.slit + 0.2, D.vanish, D.vanish + 0.2, len - 0.15, len];
  return new THREE.AnimationClip("executed", len, [
    vTrack("head", "position", t, pos),
    qTrack("head", t, rot),
    vTrack("body", "scale", bodyT, [[1, 1, 1], [0.97, 1.03, 0.97], [0.97, 1.03, 0.97], [1.04, 0.95, 1.04], [1, 1, 1], [1, 1, 1], [0.001, 0.001, 0.001], [0.001, 0.001, 0.001], [1, 1, 1]]),
    qTrack("body", bodyT, [[0, 0, 0], [0, 0, 0.03], [0, 0, -0.03], [-0.06, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]]),
  ]);
}

/* ---------- Effects ---------- */

/* A column of golden light coming down on a square. update(t) with t from
   the start; it fades in, holds while strength stays 1, and fades out. */
export function makeHolyBeam(scene, at, scale = 1) {
  const group = new THREE.Group();
  group.position.copy(at);
  group.scale.setScalar(scale);
  scene.add(group);
  const mk = (r, opacity) => {
    const g = new THREE.CylinderGeometry(r, r * 1.15, 5, 40, 1, true);
    g.translate(0, 2.5, 0);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: "#ffd77a", transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    m.userData.max = opacity;
    group.add(m);
    return m;
  };
  const layers = [mk(0.62, 0.06), mk(0.42, 0.09), mk(0.18, 0.15)];
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.62, 48), new THREE.MeshBasicMaterial({ color: "#ffe39a", transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  group.add(ring);
  return {
    update(t, strength) {
      for (const m of layers) {
        m.material.opacity = m.userData.max * strength;
        m.scale.set(1, Math.min(1, t * 4), 1);
      }
      ring.material.opacity = 0.35 * strength;
      ring.rotation.z = t * 0.6;
    },
    dispose() { scene.remove(group); for (const m of layers) m.geometry.dispose(); },
  };
}

/* A thin golden line flashing across a neck. */
export function makeNeckSlash(scene, at, facing, scale = 1) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.018, 0.018), new THREE.MeshBasicMaterial({ color: "#fff3c4", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  m.position.copy(at);
  m.rotation.y = facing;
  m.rotation.z = -0.12;
  m.userData.scale = scale;
  scene.add(m);
  return {
    update(t) {
      const grow = Math.min(1, t / 0.08);
      const s = m.userData.scale;
      m.scale.set(grow * s, (1 + t * 3) * s, (1 + t * 3) * s);
      m.material.opacity = Math.max(0, 1 - Math.max(0, t - 0.08) / 0.3);
    },
    dispose() { scene.remove(m); m.geometry.dispose(); },
  };
}
