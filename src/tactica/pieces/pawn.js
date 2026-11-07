/* Chess Tactica pawn, built like a turned wooden piece (Dubrovnik II pawn),
   with separate parts so it can be posed and animated: body, head, eyes,
   two jointed arms, a fist on each, a sword in the right hand and a shield
   on the left. Front of the piece faces +Z, up is +Y, base sits on y = 0. */
import * as THREE from "three";

export const WOOD = {
  white: { base: "#FDF3E7", shade: "#DECDBC", grain: "#b8915f" },
  black: { base: "#2E1C12", shade: "#170D08", grain: "#5a3b26" },
};

function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Polished wood: soft colour bands, wavy grain lines and pores. Every
   mark is drawn twice (x and x - S) so the texture wraps around the
   turned body without a seam. */
export function woodTexture(c, { seed = 7, lines = 70, planks = 0 } = {}) {
  const S = 512, cv = document.createElement("canvas");
  cv.width = cv.height = S;
  const g = cv.getContext("2d"), r = rng(seed);
  g.fillStyle = c.base; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 40; i++) {
    g.globalAlpha = 0.06 + r() * 0.1;
    g.fillStyle = r() < 0.5 ? c.shade : c.base;
    const x = r() * S, w = 4 + r() * 34;
    g.fillRect(x, 0, w, S); g.fillRect(x - S, 0, w, S);
  }
  g.strokeStyle = c.grain;
  for (let i = 0; i < lines; i++) {
    g.globalAlpha = 0.14 + r() * 0.3;
    g.lineWidth = 0.6 + r() * 1.8;
    const x = r() * S, amp = 2 + r() * 7, k = 1 + Math.floor(r() * 3), ph = r() * 6.28;
    for (const off of [0, -S]) {
      g.beginPath();
      for (let y = 0; y <= S; y += 8) {
        const xx = x + off + Math.sin((y / S) * Math.PI * 2 * k + ph) * amp;
        if (y === 0) g.moveTo(xx, y); else g.lineTo(xx, y);
      }
      g.stroke();
    }
  }
  g.fillStyle = c.grain;
  for (let i = 0; i < 1800; i++) {
    g.globalAlpha = 0.12 + r() * 0.25;
    g.fillRect(r() * S, r() * S, 1, 1 + r() * 3);
  }
  if (planks) {
    g.globalAlpha = 0.85; g.fillStyle = c.shade;
    for (let i = 1; i < planks; i++) g.fillRect((i * S) / planks - 1.5, 0, 3, S);
  }
  g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

export function chaikin(pts, n) {
  for (let k = 0; k < n; k++) {
    const out = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      out.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]]);
      out.push([0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]);
    }
    out.push(pts[pts.length - 1]);
    pts = out;
  }
  return pts;
}

/* Profile of the turned body as (radius, height): felt-sitting foot,
   a groove, the wide bell, the waist ring, the slender neck and the
   collar the head rests on. */
export const PAWN_PROFILE = [
  [0.0, 0.03], [0.47, 0.03], [0.5, 0.05], [0.505, 0.09], [0.49, 0.115],
  [0.455, 0.13], [0.47, 0.15], [0.475, 0.2], [0.45, 0.27], [0.39, 0.33],
  [0.3, 0.375], [0.25, 0.395], [0.29, 0.405], [0.3, 0.43], [0.27, 0.45],
  [0.21, 0.46], [0.17, 0.5], [0.135, 0.58], [0.112, 0.68], [0.105, 0.77],
  [0.115, 0.83], [0.15, 0.86], [0.24, 0.875], [0.255, 0.895], [0.24, 0.915],
  [0.12, 0.925], [0.08, 0.94],
];

export const NECK = { y: 0.8, r: 0.105 };
export const HEAD = { y: 1.14, r: 0.235 };

/* Rest pose of the arms, also used by the animations. */
export const REST = {
  shoulderR: [-0.25, 0, -0.75],
  shoulderL: [-0.25, 0, 0.75],
  elbowR: [-1.9, 0, 0],
  elbowL: [-1.9, 0, 0],
};

export const shadowed = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };

/* A cartoon eye looking down its own +Z, sitting on a surface at z = 0. */
export function makeEye(eye, mats) {
    const white = new THREE.Mesh(new THREE.SphereGeometry(0.047, 32, 16), mats.eyeWhite);
    white.scale.set(1, 1.15, 0.45);
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.027, 24, 12), mats.iris);
    iris.scale.set(1, 1.08, 0.3); iris.position.z = 0.0145;
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.0145, 20, 10), mats.pupil);
    pupil.scale.set(1, 1.05, 0.3); pupil.position.z = 0.0185;
    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.0055, 12, 6), mats.glint);
    glint.position.set(0.008, 0.01, 0.0205);
    const brow = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.0055, 8, 20, Math.PI * 0.55), mats.brow);
    brow.rotation.z = Math.PI * 0.225;
    brow.position.set(0, 0.032, -0.004);
    brow.scale.set(1, 0.7, 1);
    eye.add(white, iris, pupil, glint, brow);
}

function buildEyes(head, mats) {
  for (const side of [-1, 1]) {
    const th = side * 0.36, ph = 0.07;
    const dir = new THREE.Vector3(Math.sin(th) * Math.cos(ph), Math.sin(ph), Math.cos(th) * Math.cos(ph));
    const eye = new THREE.Group();
    eye.name = side < 0 ? "eyeR" : "eyeL";
    eye.position.copy(dir).multiplyScalar(HEAD.r - 0.004);
    eye.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    makeEye(eye, mats);
    head.add(eye);
  }
}

function buildFist(mat) {
  const fist = new THREE.Group();
  const palm = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.043, 24, 16), mat));
  palm.scale.set(1, 0.95, 1.08);
  fist.add(palm);
  return fist;
}

/* Arm lengths and shoulder spot default to the pawn; taller pieces pass their own. */
export function buildArm(side, mats, { upper = 0.17, fore = 0.18, x = 0.155, y = NECK.y } = {}) {
  const isR = side === "R";
  const shoulder = new THREE.Group();
  shoulder.name = "shoulder" + side;
  shoulder.position.set(isR ? -x : x, y, 0);
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.075, 16), mats.joint);
  pin.rotation.z = Math.PI / 2;
  pin.position.x = isR ? 0.035 : -0.035;
  shoulder.add(shadowed(pin));
  shoulder.add(shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.034, 24, 16), mats.wood)));
  const upperArm = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(0.029, upper - 0.05, 6, 16), mats.wood));
  upperArm.position.y = -upper / 2;
  shoulder.add(upperArm);

  const elbow = new THREE.Group();
  elbow.name = "elbow" + side;
  elbow.position.y = -upper;
  const ej = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.066, 16), mats.joint);
  ej.rotation.z = Math.PI / 2;
  elbow.add(shadowed(ej));
  const foreArm = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(0.027, fore - 0.08, 6, 16), mats.wood));
  foreArm.position.y = -(fore - 0.03) / 2;
  elbow.add(foreArm);
  shoulder.add(elbow);

  const hand = new THREE.Group();
  hand.name = "hand" + side;
  hand.position.y = -fore;
  hand.add(buildFist(mats.wood));
  elbow.add(hand);
  return { shoulder, elbow, hand };
}

/* Sword along its own +Y: pommel, leather grip, crossguard, steel blade.
   Its origin is the middle of the grip, where the fist closes. */
function buildSword(mats) {
  const sword = new THREE.Group();
  sword.name = "sword";
  sword.add(shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.0155, 0.0155, 0.115, 16), mats.leather)));
  for (let i = 0; i < 6; i++) {
    const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.0158, 0.0028, 6, 16), mats.leather);
    wrap.rotation.x = Math.PI / 2;
    wrap.position.y = -0.047 + i * 0.019;
    sword.add(wrap);
  }
  const pommel = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.022, 20, 12), mats.steel));
  pommel.position.y = -0.074;
  pommel.scale.set(1, 0.85, 1);
  sword.add(pommel);
  const guard = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.017, 0.024), mats.steel));
  guard.position.y = 0.066;
  sword.add(guard);
  for (const s of [-1, 1]) {
    const tip = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.014, 16, 10), mats.steel));
    tip.position.set(s * 0.077, 0.07, 0);
    sword.add(tip);
  }
  const shape = new THREE.Shape();
  shape.moveTo(-0.021, 0);
  shape.lineTo(0.021, 0);
  shape.lineTo(0.017, 0.3);
  shape.lineTo(0, 0.365);
  shape.lineTo(-0.017, 0.3);
  shape.closePath();
  const depth = 0.006;
  const bladeGeo = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2,
  });
  bladeGeo.translate(0, 0.075, -depth / 2);
  sword.add(shadowed(new THREE.Mesh(bladeGeo, mats.steel)));
  return sword;
}

/* Heater shield in its own XY plane, front facing +Z: walnut planks,
   a raised rim, a steel boss and rivets. Origin is the back face. */
function buildShield(mats) {
  const shield = new THREE.Group();
  shield.name = "shield";
  const w = 0.15;
  const outline = new THREE.Shape();
  outline.moveTo(-w, 0.1);
  outline.quadraticCurveTo(-w * 0.95, 0.19, 0, 0.2);
  outline.quadraticCurveTo(w * 0.95, 0.19, w, 0.1);
  outline.bezierCurveTo(w, -0.05, w * 0.6, -0.17, 0, -0.24);
  outline.bezierCurveTo(-w * 0.6, -0.17, -w, -0.05, -w, 0.1);
  const depth = 0.022;
  const face = new THREE.ExtrudeGeometry(outline, {
    depth, curveSegments: 32, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2,
  });
  shield.add(shadowed(new THREE.Mesh(face, mats.shieldWood)));

  const pts = outline.getSpacedPoints(96);
  const cy = -0.02;
  const ring = new THREE.Shape(pts);
  const inner = pts.map((p) => new THREE.Vector2(p.x * 0.86, cy + (p.y - cy) * 0.88)).reverse();
  ring.holes.push(new THREE.Path(inner));
  const rimGeo = new THREE.ExtrudeGeometry(ring, {
    depth: 0.01, curveSegments: 32, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.002, bevelSegments: 2,
  });
  rimGeo.translate(0, 0, depth);
  shield.add(shadowed(new THREE.Mesh(rimGeo, mats.rim)));

  const boss = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.032, 24, 16), mats.steel));
  boss.scale.set(1, 1, 0.55);
  boss.position.set(0, cy, depth + 0.003);
  shield.add(boss);
  const rivetGeo = new THREE.SphereGeometry(0.007, 10, 8);
  for (const [x, y] of [[-0.095, 0.115], [0.095, 0.115], [-0.1, -0.03], [0.1, -0.03], [0, -0.17], [0, 0.15]]) {
    const rv = new THREE.Mesh(rivetGeo, mats.steel);
    rv.position.set(x, y, depth + 0.003);
    shield.add(rv);
  }
  return shield;
}

/* Place a held item so it has the given world position and rotation in
   the rest pose, whatever the arm angles are. */
export function holdAt(root, hand, item, worldPos, worldQuat) {
  root.updateMatrixWorld(true);
  const hq = hand.getWorldQuaternion(new THREE.Quaternion());
  item.quaternion.copy(hq.invert().multiply(worldQuat));
  item.position.copy(hand.worldToLocal(worldPos.clone()));
  hand.add(item);
}

/* One set of materials per colour, shared by every piece of that colour, so a
   full board paints its wood only twice. */
const matsCache = new Map();
export function makeMats(colour) {
  if (!matsCache.has(colour)) matsCache.set(colour, freshMats(colour));
  return matsCache.get(colour);
}

function freshMats(colour) {
  const c = WOOD[colour];
  const tex = woodTexture(c, { seed: colour === "white" ? 11 : 23 });
  const shieldTex = woodTexture({ base: "#6b4527", shade: "#3f2715", grain: "#2c1a0d" }, { seed: 5, lines: 90, planks: 4 });
  shieldTex.repeat.set(3, 2.4);
  shieldTex.offset.set(0.5, 0.5);
  const polish = { roughness: 0.42, clearcoat: 0.7, clearcoatRoughness: 0.22 };
  const mats = {
    wood: new THREE.MeshPhysicalMaterial({ map: tex, ...polish }),
    shieldWood: new THREE.MeshPhysicalMaterial({ map: shieldTex, roughness: 0.55, clearcoat: 0.35, clearcoatRoughness: 0.4 }),
    rim: new THREE.MeshPhysicalMaterial({ color: "#3b2414", roughness: 0.5, clearcoat: 0.4 }),
    steel: new THREE.MeshStandardMaterial({ color: "#c9cdd3", metalness: 1, roughness: 0.28 }),
    joint: new THREE.MeshStandardMaterial({ color: "#a9adb3", metalness: 1, roughness: 0.35 }),
    leather: new THREE.MeshStandardMaterial({ color: "#5b3a1e", roughness: 0.85 }),
    felt: new THREE.MeshStandardMaterial({ color: "#1d4a2c", roughness: 1 }),
    eyeWhite: new THREE.MeshPhysicalMaterial({ color: "#fbfbf8", roughness: 0.25, clearcoat: 1 }),
    iris: new THREE.MeshStandardMaterial({ color: colour === "white" ? "#6a4426" : "#8a5a32", roughness: 0.4 }),
    pupil: new THREE.MeshStandardMaterial({ color: "#0c0806", roughness: 0.3 }),
    glint: new THREE.MeshBasicMaterial({ color: "#ffffff" }),
    brow: new THREE.MeshStandardMaterial({ color: colour === "white" ? "#7a5232" : "#b08860", roughness: 0.7 }),
  };

  return mats;
}

export function buildPawn(colour = "white") {
  const mats = makeMats(colour);

  const pawn = new THREE.Group();
  pawn.name = "pawn_" + colour;
  const body = new THREE.Group();
  body.name = "body";
  pawn.add(body);

  const profile = chaikin(PAWN_PROFILE, 2).map(([r, y]) => new THREE.Vector2(Math.max(r, 0), y));
  const turned = shadowed(new THREE.Mesh(new THREE.LatheGeometry(profile, 96), mats.wood));
  turned.name = "turnedBody";
  body.add(turned);
  const felt = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.475, 0.475, 0.03, 64), mats.felt));
  felt.position.y = 0.015;
  body.add(felt);

  const head = new THREE.Group();
  head.name = "head";
  head.position.y = HEAD.y;
  const ball = shadowed(new THREE.Mesh(new THREE.SphereGeometry(HEAD.r, 64, 48), mats.wood));
  ball.rotation.y = Math.PI;
  head.add(ball);
  body.add(head);
  buildEyes(head, mats);

  const R = buildArm("R", mats), L = buildArm("L", mats);
  body.add(R.shoulder, L.shoulder);
  R.shoulder.rotation.set(...REST.shoulderR);
  L.shoulder.rotation.set(...REST.shoulderL);
  R.elbow.rotation.set(...REST.elbowR);
  L.elbow.rotation.set(...REST.elbowL);

  pawn.updateMatrixWorld(true);
  const handR = R.hand.getWorldPosition(new THREE.Vector3());
  const handL = L.hand.getWorldPosition(new THREE.Vector3());

  /* Sword upright in the right fist, leaning slightly out and forward. */
  const swordQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.12, 0, 0.16));
  const sword = buildSword(mats);
  sword.scale.setScalar(1.3);
  holdAt(pawn, R.hand, sword, handR, swordQ);

  /* Shield in front of the left fist, facing forward and out. */
  const yaw = 0.85;
  const n = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  const shieldQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  holdAt(pawn, L.hand, buildShield(mats), handL.clone().addScaledVector(n, 0.045), shieldQ);

  return pawn;
}

/* Animation clips on the named parts. Arm keys are absolute angles. */
const qOf = (e) => new THREE.Quaternion().setFromEuler(new THREE.Euler(...e)).toArray();
const qTrack = (node, times, eulers) =>
  new THREE.QuaternionKeyframeTrack(node + ".quaternion", times, eulers.flatMap(qOf));
const vTrack = (node, prop, times, vals) =>
  new THREE.VectorKeyframeTrack(node + "." + prop, times, vals.flat());
const rawQTrack = (node, times, quats) =>
  new THREE.QuaternionKeyframeTrack(node + ".quaternion", times, quats.flat());
const add = (a, b) => a.map((v, i) => v + b[i]);

/* Arm angles solved offline (shoulder Euler, elbow bend, wrist quaternion). */
const ATTACK = {"sword":{"windup":{"shoulder":[-1.1,0.72,-2.24],"elbow":-0.44,"wrist":[-0.15,-0.565,0.074,0.808],"handErr":0.002},"peak":{"shoulder":[-1.1,1.12,-2.08],"elbow":-0.12,"wrist":[-0.158,-0.433,0.248,0.852],"handErr":0.077},"slash":{"shoulder":[-0.86,0.96,-0.72],"elbow":-0.12,"wrist":[0.146,-0.24,0.654,0.703],"handErr":0.001},"follow":{"shoulder":[-0.54,0.16,-0.4],"elbow":-0.92,"wrist":[0.444,0.175,0.637,0.605],"handErr":0.002}},"shield":{"guard":{"shoulder":[-0.7,-0.8,0.8],"elbow":-1.08,"wrist":[-0.227,0.238,-0.045,0.943],"handErr":0.002}}};

export function pawnClips() {
  const { shoulderR: SR, shoulderL: SL, elbowR: ER, elbowL: EL } = REST;
  const blink = [[1, 1, 1], [1, 1, 1], [1, 0.08, 1], [1, 1, 1], [1, 1, 1]];
  const bt = [0, 2.2, 2.29, 2.38, 3];
  const idle = new THREE.AnimationClip("idle", 3, [
    vTrack("body", "scale", [0, 1.5, 3], [[1, 1, 1], [1.012, 0.985, 1.012], [1, 1, 1]]),
    qTrack("shoulderR", [0, 1.5, 3], [SR, add(SR, [0.07, 0, 0.04]), SR]),
    qTrack("shoulderL", [0, 1.5, 3], [SL, add(SL, [0.06, 0, -0.04]), SL]),
    qTrack("head", [0, 1.5, 3], [[0, 0, 0], [0.03, 0, 0.02], [0, 0, 0]]),
    vTrack("eyeR", "scale", bt, blink),
    vTrack("eyeL", "scale", bt, blink),
  ]);

  /* Poses solved from where the fist and blade should be (wind-up over
     the shoulder, chop forward and down, follow-through); see ATTACK. */
  const P = ATTACK.sword, G = ATTACK.shield.guard, I = [0, 0, 0, 1];
  const t = [0, 0.3, 0.48, 0.6, 0.82, 1.15, 1.5];
  const attack = new THREE.AnimationClip("attack", 1.5, [
    vTrack("body", "position", t, [[0, 0, 0], [0, 0, -0.05], [0, 0.14, 0.22], [0, 0.03, 0.4], [0, 0, 0.42], [0, 0.09, 0.2], [0, 0, 0]]),
    qTrack("body", t, [[0, 0, 0], [-0.16, 0, 0], [0.04, 0, 0], [0.2, 0, 0], [0.08, 0, 0], [-0.04, 0, 0], [0, 0, 0]]),
    vTrack("body", "scale", t, [[1, 1, 1], [1.05, 0.91, 1.05], [0.96, 1.07, 0.96], [1.05, 0.94, 1.05], [1, 1, 1], [0.98, 1.03, 0.98], [1, 1, 1]]),
    qTrack("shoulderR", t, [SR, P.windup.shoulder, P.peak.shoulder, P.slash.shoulder, P.follow.shoulder, SR, SR]),
    qTrack("elbowR", t, [ER, [P.windup.elbow, 0, 0], [P.peak.elbow, 0, 0], [P.slash.elbow, 0, 0], [P.follow.elbow, 0, 0], ER, ER]),
    rawQTrack("handR", t, [I, P.windup.wrist, P.peak.wrist, P.slash.wrist, P.follow.wrist, I, I]),
    qTrack("shoulderL", t, [SL, G.shoulder, G.shoulder, G.shoulder, G.shoulder, SL, SL]),
    qTrack("elbowL", t, [EL, [G.elbow, 0, 0], [G.elbow, 0, 0], [G.elbow, 0, 0], [G.elbow, 0, 0], EL, EL]),
    rawQTrack("handL", t, [I, G.wrist, G.wrist, G.wrist, G.wrist, I, I]),
  ]);
  return { idle, attack };
}
