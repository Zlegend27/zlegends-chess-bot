/* Chess Tactica knight: the pawn's turned wooden base and jointed arms,
   with a carved horse head (Dubrovnik knight) on the collar and spiked
   steel gauntlets on both fists. Same axes as the pawn: front +Z, up +Y. */
import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { PAWN_PROFILE, buildArm, chaikin, makeEye, makeMats, shadowed } from "./pawn.js";

export const KNIGHT_SCALE = 1.08;
export const COLLAR_Y = 0.92;
export const EYE_SCALE = 1.22;

export const KREST = {
  shoulderR: [-0.14, -0.08, -0.88],
  shoulderL: [-0.14, 0.08, 0.88],
  elbowR: [-1.08, 0, 0],
  elbowL: [-1.08, 0, 0],
};
/* Rest wrist turn: fists held out to the sides, spiked balls facing forward and out. */
export const KREST_WRIST = { R: [-0.03, -0.083, -0.165, 0.982], L: [-0.03, 0.083, 0.165, 0.982] };

/* Side view of the horse head and neck, as (forward, up) from the collar. */
function headOutline() {
  const s = new THREE.Shape();
  s.moveTo(-0.17, 0);
  s.splineThru([
    new THREE.Vector2(-0.22, 0.16), new THREE.Vector2(-0.2, 0.36), new THREE.Vector2(-0.12, 0.53),
    new THREE.Vector2(0.0, 0.61), new THREE.Vector2(0.1, 0.6), new THREE.Vector2(0.2, 0.51),
    new THREE.Vector2(0.29, 0.41), new THREE.Vector2(0.33, 0.33),
  ]);
  s.splineThru([
    new THREE.Vector2(0.33, 0.27), new THREE.Vector2(0.28, 0.23), new THREE.Vector2(0.18, 0.22),
    new THREE.Vector2(0.08, 0.19), new THREE.Vector2(0.06, 0.11), new THREE.Vector2(0.1, 0.05),
    new THREE.Vector2(0.13, 0),
  ]);
  s.closePath();
  return s;
}

/* The outline's back edge, from the top of the head down the neck, for the mane. */
const MANE_PATH = new THREE.SplineCurve([
  new THREE.Vector2(0.02, 0.61), new THREE.Vector2(-0.12, 0.53), new THREE.Vector2(-0.2, 0.36),
  new THREE.Vector2(-0.22, 0.16), new THREE.Vector2(-0.19, 0.04),
]);

function buildHorseHead(mats) {
  const head = new THREE.Group();
  head.name = "head";
  head.position.y = COLLAR_Y;

  /* A thin core with a deep rounded bevel gives a carved, pillowy cross-section. */
  const half = 0.035, bevel = 0.115;
  let geo = new THREE.ExtrudeGeometry(headOutline(), {
    depth: half * 2, curveSegments: 48, bevelEnabled: true,
    bevelThickness: bevel, bevelSize: 0.05, bevelSegments: 10,
  });
  /* Outline was drawn as (forward, up): turn it so forward is +Z, centred on x = 0. */
  geo.translate(0, 0, -half);
  geo.rotateY(-Math.PI / 2);
  /* Taper: the muzzle and the neck are narrower than the cheeks. */
  const pos = geo.getAttribute("position");
  const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i), z = pos.getZ(i);
    const muzzle = 1 - 0.36 * smooth(0.04, 0.4, z);
    const neck = 1 - 0.18 * (1 - smooth(0.05, 0.3, y));
    const crown = 1 - 0.2 * smooth(0.5, 0.68, y);
    pos.setX(i, pos.getX(i) * muzzle * neck * crown);
  }
  /* Weld the caps to the rounded sides so the surface shades smoothly, and
     project the grain from the side so it runs unbroken down the neck. */
  geo.deleteAttribute("normal");
  geo.deleteAttribute("uv");
  geo = mergeVertices(geo, 1e-4);
  const p2 = geo.getAttribute("position"), uv = new Float32Array(p2.count * 2);
  for (let i = 0; i < p2.count; i++) { uv[2 * i] = p2.getZ(i) * 1.6 + p2.getX(i) * 0.8; uv[2 * i + 1] = p2.getY(i) * 1.6; }
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  const mesh = shadowed(new THREE.Mesh(geo, mats.headWood));
  mesh.name = "horseHead";
  head.add(mesh);

  /* Mane: carved ridges running down the back of the head and neck. */
  const strand = new THREE.CapsuleGeometry(0.03, 0.07, 4, 12);
  for (let i = 0; i < 9; i++) {
    const t = 0.04 + (i / 8) * 0.9;
    const p = MANE_PATH.getPointAt(t), tan = MANE_PATH.getTangentAt(t);
    const out = new THREE.Vector2(-tan.y, tan.x);
    if (out.x > 0.2) out.negate();
    const m = shadowed(new THREE.Mesh(strand, mats.wood));
    m.position.set(0, p.y + out.y * 0.035, p.x + out.x * 0.035);
    m.rotation.x = Math.atan2(tan.x, tan.y) + 0.35;
    m.scale.set(2.3, 1, 1);
    head.add(m);
  }

  /* Ears. */
  for (const s of [-1, 1]) {
    const ear = shadowed(new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.17, 16), mats.wood));
    ear.position.set(s * 0.075, 0.67, -0.03);
    ear.rotation.set(-0.25, 0, -s * 0.22);
    ear.scale.set(1, 1, 0.65);
    head.add(ear);
  }

  /* Eyes on the sides of the head, turned a little toward the front. */
  for (const s of [-1, 1]) {
    const dir = new THREE.Vector3(s * 0.8, 0.08, 0.6).normalize();
    const eye = new THREE.Group();
    eye.name = s < 0 ? "eyeR" : "eyeL";
    const at = new THREE.Vector3(s * 0.128, 0.46, 0.1);
    /* Lizard-style: a carved wooden dome bulges out of the head and the eye
       sits on top of it, so it pops out sideways. */
    const socket = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.062, 32, 20), mats.headWood));
    socket.position.copy(at).addScaledVector(dir, 0.012);
    socket.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir));
    socket.scale.set(1, 1.05, 0.75);
    head.add(socket);
    eye.position.copy(at).addScaledVector(dir, 0.052);
    eye.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    eye.scale.setScalar(EYE_SCALE);
    makeEye(eye, mats);
    head.add(eye);
  }

  /* Nostrils on the front of the muzzle. */
  for (const s of [-1, 1]) {
    const n = new THREE.Mesh(new THREE.SphereGeometry(0.013, 16, 10), mats.nostril);
    n.scale.set(0.7, 1.3, 0.5);
    n.position.set(s * 0.05, 0.3, 0.385);
    n.rotation.z = s * 0.4;
    head.add(n);
  }
  return head;
}

/* A spiked steel ball centred on the origin. The side facing -Y (toward
   the glove) is left smooth where it joins. */
function spikedBall(mats, R) {
  const g = new THREE.Group();
  g.add(shadowed(new THREE.Mesh(new THREE.SphereGeometry(R, 32, 20), mats.steel)));
  const dirs = [];
  for (const [geo, h, r] of [[new THREE.IcosahedronGeometry(1, 0), R * 0.85, R * 0.28], [new THREE.DodecahedronGeometry(1, 0), R * 0.56, R * 0.2]]) {
    const p = geo.toNonIndexed().getAttribute("position"), seen = new Set();
    for (let i = 0; i < p.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(p, i).normalize();
      const key = v.toArray().map((x) => x.toFixed(3)).join();
      if (!seen.has(key)) { seen.add(key); dirs.push([v, h, r]); }
    }
  }
  const spikes = [], up = new THREE.Vector3(0, 1, 0);
  for (const [d, h, r] of dirs) {
    if (d.y > 0.75) continue;
    const c = new THREE.ConeGeometry(r, h, 10);
    c.translate(0, R + h / 2 - R * 0.08, 0);
    c.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, d));
    spikes.push(c);
  }
  g.add(shadowed(new THREE.Mesh(mergeGeometries(spikes), mats.steel)));
  return g;
}

/* Spiked gauntlet built around the fist, in the hand frame: the forearm
   comes in from +Y and the knuckles face -Y. A steel cuff over the wrist,
   a steel glove over the wooden fist and a spiked ball fused to the
   knuckles, so every punch and slam lands with the ball. */
function buildGauntlet(mats) {
  const g = new THREE.Group();
  const cuff = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.036, 0.075, 24, 1, true), mats.steel));
  cuff.position.y = 0.05;
  g.add(cuff);
  const rim = shadowed(new THREE.Mesh(new THREE.TorusGeometry(0.043, 0.006, 8, 24), mats.steel));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.088;
  g.add(rim);
  const glove = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.05, 28, 18), mats.steel));
  glove.scale.set(1.05, 0.95, 1.1);
  g.add(glove);
  const ball = spikedBall(mats, 0.095);
  ball.position.y = -0.1;
  g.add(ball);
  return g;
}

export function buildKnight(colour = "white") {
  const mats = makeMats(colour);
  /* The head is one carved block, so its grain runs along the neck. */
  mats.headWood = mats.wood.clone();
  mats.headWood.map = mats.wood.map.clone();
  mats.headWood.map.repeat.set(1, 1);
  mats.headWood.map.needsUpdate = true;
  mats.nostril = new THREE.MeshStandardMaterial({ color: colour === "white" ? "#8a6a4a" : "#120a06", roughness: 0.6 });

  const knight = new THREE.Group();
  knight.name = "knight_" + colour;
  knight.scale.setScalar(KNIGHT_SCALE);
  const body = new THREE.Group();
  body.name = "body";
  knight.add(body);

  const profile = chaikin(PAWN_PROFILE, 2).map(([r, y]) => new THREE.Vector2(Math.max(r, 0), y));
  body.add(shadowed(new THREE.Mesh(new THREE.LatheGeometry(profile, 96), mats.wood)));
  const felt = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.475, 0.475, 0.03, 64), mats.felt));
  felt.position.y = 0.015;
  body.add(felt);
  body.add(buildHorseHead(mats));

  const R = buildArm("R", mats), L = buildArm("L", mats);
  body.add(R.shoulder, L.shoulder);
  R.shoulder.rotation.set(...KREST.shoulderR);
  L.shoulder.rotation.set(...KREST.shoulderL);
  R.elbow.rotation.set(...KREST.elbowR);
  L.elbow.rotation.set(...KREST.elbowL);

  for (const [side, arm] of [["R", R], ["L", L]]) {
    const gauntlet = buildGauntlet(mats);
    gauntlet.name = "gauntlet" + side;
    arm.hand.add(gauntlet);
    arm.hand.quaternion.fromArray(KREST_WRIST[side]).normalize();
  }
  addShockwave(knight);
  return knight;
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

/* Arm angles solved offline from where each fist should be and which way
   its spiked ball should face. */
const POSES = {"R":{"crouch":{"shoulder":[1.06,-0.4,-0.48],"elbow":-1.24,"wrist":[0.517,-0.243,-0.026,0.821]},"launch":{"shoulder":[-1.66,-0.24,-0.96],"elbow":-1.8,"wrist":[0.181,-0.041,0.12,0.975]},"apex":{"shoulder":[-2.54,0.16,-0.64],"elbow":-0.84,"wrist":[0.151,0.25,0.028,0.956]},"slam":{"shoulder":[-0.38,0.48,-0.56],"elbow":-0.68,"wrist":[0.288,0.197,0.346,0.871]}},"L":{"crouch":{"shoulder":[1.06,0.4,0.48],"elbow":-1.24,"wrist":[0.517,0.243,0.026,0.821]},"launch":{"shoulder":[-1.66,0.24,0.96],"elbow":-1.8,"wrist":[0.181,0.041,-0.12,0.975]},"apex":{"shoulder":[-2.54,-0.16,0.64],"elbow":-0.84,"wrist":[0.151,-0.25,-0.028,0.956]},"slam":{"shoulder":[-0.38,-0.48,0.56],"elbow":-0.68,"wrist":[0.288,-0.197,-0.346,0.871]}}};

/* Timing of the leap, in seconds. */
export const LEAP = { turn: 0.25, crouch: 0.45, launch: 0.6, impact: 1.18, end: 1.9, height: 1.9 };

/* Shockwave rings for the landing. They hang off the root (not the body)
   so the body's squash does not flatten them. */
export function addShockwave(knight) {
  for (const [name, color, inner, outer] of [["shockwave", "#fff8e8", 0.34, 0.6], ["dust", "#b89a76", 0.3, 0.62]]) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(inner, outer, 64),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
    );
    ring.name = name;
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    ring.scale.setScalar(0.001);
    knight.add(ring);
  }
}

/* idle, attack (leap onto the square at [dx, dz] and slam it) and return
   (hop back, for the preview). Target is in board units from the knight. */
export function knightClips([dx, dz] = [0, 2]) {
  const S = KNIGHT_SCALE;
  const tx = dx / S, tz = dz / S;
  const yaw = Math.atan2(dx, dz);
  const { shoulderR: SR, shoulderL: SL, elbowR: ER, elbowL: EL } = KREST;

  const E = EYE_SCALE;
  const blink = [[E, E, E], [E, E, E], [E, 0.08, E], [E, E, E], [E, E, E]];
  const bt = [0, 2.0, 2.09, 2.18, 3];
  const idle = new THREE.AnimationClip("idle", 3, [
    vTrack("body", "scale", [0, 1.5, 3], [[1, 1, 1], [1.012, 0.985, 1.012], [1, 1, 1]]),
    qTrack("shoulderR", [0, 1.5, 3], [SR, add(SR, [0.08, 0, 0.05]), SR]),
    qTrack("shoulderL", [0, 1.5, 3], [SL, add(SL, [0.08, 0, -0.05]), SL]),
    qTrack("head", [0, 0.9, 1.5, 2.4, 3], [[0, 0, 0], [0.04, 0.06, 0], [0.02, 0, 0], [0.04, -0.06, 0], [0, 0, 0]]),
    vTrack("eyeR", "scale", bt, blink),
    vTrack("eyeL", "scale", bt, blink),
  ]);

  /* Body: turn, crouch, a high arc onto the target, a heavy squash on landing. */
  const L = LEAP;
  const times = [0, L.turn, L.crouch];
  const pos = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const rot = [[0, 0, 0], [0, yaw, 0], [-0.15, yaw, 0]];
  const scl = [[1, 1, 1], [1.04, 0.94, 1.04], [1.14, 0.78, 1.14]];
  const steps = 10;
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    times.push(L.launch + (L.impact - L.launch) * u);
    pos.push([tx * u, 4 * L.height * u * (1 - u), tz * u]);
    rot.push([-0.1 + 0.3 * u, yaw, 0]);
    const s = i === 0 ? [0.9, 1.15, 0.9] : i === steps ? [1.28, 0.66, 1.28] : [1, 1.04, 1];
    scl.push(s);
  }
  times.push(1.34, 1.55, L.end);
  pos.push([tx, 0, tz], [tx, 0, tz], [tx, 0, tz]);
  rot.push([0.08, yaw, 0], [0, yaw, 0], [0, yaw, 0]);
  scl.push([0.94, 1.08, 0.94], [1, 1, 1], [1, 1, 1]);

  const at = [0, L.turn, L.crouch, L.launch, 0.95, L.impact, 1.34, 1.55, L.end];
  const arm = (side, rest, erest) => {
    const P = POSES[side], I = KREST_WRIST[side];
    return [
      qTrack("shoulder" + side, at, [rest, rest, P.crouch.shoulder, P.launch.shoulder, P.apex.shoulder, P.slam.shoulder, P.slam.shoulder, rest, rest]),
      qTrack("elbow" + side, at, [erest, erest, [P.crouch.elbow, 0, 0], [P.launch.elbow, 0, 0], [P.apex.elbow, 0, 0], [P.slam.elbow, 0, 0], [P.slam.elbow, 0, 0], erest, erest]),
      rawQTrack("hand" + side, at, [I, I, P.crouch.wrist, P.launch.wrist, P.apex.wrist, P.slam.wrist, P.slam.wrist, I, I]),
    ];
  };

  /* Rings burst out from the landing spot. */
  const wt = [0, L.impact - 0.01, L.impact, L.impact + 0.45, L.end];
  const ringAt = [[tx * S, 0.02, tz * S], [tx * S, 0.02, tz * S], [tx * S, 0.02, tz * S], [tx * S, 0.02, tz * S], [tx * S, 0.02, tz * S]].map((p) => p.map((v) => v / S));
  const rings = [
    vTrack("shockwave", "position", wt, ringAt),
    vTrack("shockwave", "scale", wt, [[0.001, 0.001, 0.001], [0.001, 0.001, 0.001], [0.6, 0.6, 0.6], [3.4, 3.4, 3.4], [3.4, 3.4, 3.4]]),
    nTrack("shockwave.material.opacity", wt, [0, 0, 1, 0, 0]),
    vTrack("dust", "position", wt, ringAt),
    vTrack("dust", "scale", wt, [[0.001, 0.001, 0.001], [0.001, 0.001, 0.001], [0.8, 0.8, 0.8], [2.2, 2.2, 2.2], [2.2, 2.2, 2.2]]),
    nTrack("dust.material.opacity", wt, [0, 0, 0.7, 0, 0]),
  ];

  const attack = new THREE.AnimationClip("attack", L.end, [
    vTrack("body", "position", times, pos),
    qTrack("body", times, rot),
    vTrack("body", "scale", times, scl),
    ...arm("R", SR, ER),
    ...arm("L", SL, EL),
    ...rings,
  ]);

  /* Preview only: hop back to the start square. */
  const rt = [0, 0.15, 0.4, 0.62, 0.75];
  const ret = new THREE.AnimationClip("return", 0.75, [
    vTrack("body", "position", rt, [[tx, 0, tz], [tx, 0, tz], [tx / 2, 0.35, tz / 2], [0, 0, 0], [0, 0, 0]]),
    qTrack("body", rt, [[0, yaw, 0], [0, yaw + Math.PI, 0], [0, yaw + Math.PI, 0], [0, Math.PI * 2, 0], [0, 0, 0]]),
    vTrack("body", "scale", rt, [[1, 1, 1], [1.05, 0.92, 1.05], [0.96, 1.06, 0.96], [1.06, 0.92, 1.06], [1, 1, 1]]),
  ]);
  return { idle, attack, return: ret };
}

/* The piece that gets landed on: flattened at impact, gone, then (for the
   preview) back once the knight has hopped home. */
export function crushedClip() {
  const i = LEAP.impact;
  const t = [0, i - 0.02, i + 0.04, i + 0.3, i + 0.55, 2.6, 2.75, 2.85];
  return new THREE.AnimationClip("crushed", 2.85, [
    vTrack("body", "scale", t, [[1, 1, 1], [1, 1, 1], [1.45, 0.28, 1.45], [1.55, 0.14, 1.55], [0.001, 0.001, 0.001], [0.001, 0.001, 0.001], [1.1, 1.1, 1.1], [1, 1, 1]]),
  ]);
}
