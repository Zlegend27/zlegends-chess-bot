/* The bin's boss: the pizza monster. A slice the size of the bin's back
   wall, crust up, rising out of the rubbish behind the board: two pepperoni
   for eye sockets with glowing eyes in them, a wide mouth strung with
   cheese, and two long arms of melted cheese that stretch as far as he
   needs. On his floor he moves the enemy's pieces with his own hands.

   buildPizzaMonster(tacticaScene) returns:
     update(dt)            call every frame
     setRise(level)        0 hidden, 1 peeking over the board (eyes only), 2 risen
     reach(point)          a hand stretches to a point on the board (Promise)
     carry(point, ms)      that hand moves there over `ms` (with the piece it holds)
     rest()                both hands go back to his sides
     slam(point)           a fist comes down on the board there (Promise at the blow)
     roar()                mouth wide, the bin shakes (Promise)
     melt()                beaten: he sags and sinks (Promise) */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { play as playSound } from "../sound.js";

/* A photographed pepperoni slice ("Pizza" by gatoperdido, CC BY 4.0,
   credited in public/tactica/models/CREDITS.txt and Settings > Credits)
   becomes his body when it loads; the drawn slice stays if it doesn't. */
const REAL_PIZZA = "/tactica/models/pizza/pizza.glb";

const HOME = new THREE.Vector3(0, 0, -7.4);
const RISE_Y = [-9, -2.15, 0.5];
const ROPE = 24;
const ease = (t) => t * t * (3 - 2 * t);

function sliceShape() {
  /* Crust edge along the top, the point down, the sides wavy with drips. */
  const s = new THREE.Shape();
  s.moveTo(-3.2, 5);
  s.lineTo(3.2, 5);
  const side = (fromX, fromY, toX, toY, n, sign) => {
    for (let i = 1; i <= n; i++) {
      const u = i / n, x = fromX + (toX - fromX) * u, y = fromY + (toY - fromY) * u;
      const mx = fromX + (toX - fromX) * (u - 0.5 / n), my = fromY + (toY - fromY) * (u - 0.5 / n);
      s.quadraticCurveTo(mx + sign * 0.34, my - 0.12, x, y);
    }
  };
  side(3.2, 5, 0.35, -1.2, 5, 1);
  s.quadraticCurveTo(0, -1.75, -0.35, -1.2);
  side(-0.35, -1.2, -3.2, 5, 5, -1);
  return s;
}

export function buildPizzaMonster(ts) {
  const group = new THREE.Group();
  group.position.copy(HOME).setY(RISE_Y[0]);
  group.rotation.x = 0.26; // he leans over the board
  group.scale.setScalar(1.15);
  group.visible = false;

  const cheese = new THREE.MeshStandardMaterial({ color: "#f2b53a", roughness: 0.5, emissive: "#4a2c00", emissiveIntensity: 0.55 });
  const crustMat = new THREE.MeshStandardMaterial({ color: "#b4753a", roughness: 0.92, emissive: "#2a1606", emissiveIntensity: 0.4 });
  const sauce = new THREE.MeshStandardMaterial({ color: "#a9241e", roughness: 0.6, emissive: "#3a0805", emissiveIntensity: 0.5 });
  const pepperoni = new THREE.MeshStandardMaterial({ color: "#8f2019", roughness: 0.65, emissive: "#300604", emissiveIntensity: 0.5 });
  const eyeWhite = new THREE.MeshStandardMaterial({ color: "#fff3c4", emissive: "#ffd23a", emissiveIntensity: 2.4, roughness: 0.4 });
  const pupilMat = new THREE.MeshBasicMaterial({ color: "#120604" });

  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(sliceShape(), { depth: 0.5, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 2, curveSegments: 6 }), cheese);
  body.position.z = -0.25;
  body.castShadow = true;
  group.add(body);
  /* The crust: a fat roll along the top, blistered. */
  const crustCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(-3.45, 4.9, 0), new THREE.Vector3(-1.6, 5.2, 0.05), new THREE.Vector3(0, 5.28, 0.08), new THREE.Vector3(1.6, 5.2, 0.05), new THREE.Vector3(3.45, 4.9, 0)]);
  const crust = new THREE.Mesh(new THREE.TubeGeometry(crustCurve, 24, 0.62, 10, false), crustMat);
  crust.castShadow = true;
  group.add(crust);
  const drawn = [body, crust];
  for (const [x, r] of [[-3.45, 0.62], [3.45, 0.62], [-2.2, 0.3], [0.7, 0.34], [2.5, 0.26], [-0.9, 0.24]]) {
    const blob = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), crustMat);
    drawn.push(blob);
    blob.position.set(x, Math.abs(x) > 3 ? 4.9 : 5.62 - Math.abs(x) * 0.07, Math.abs(x) > 3 ? 0 : 0.3);
    group.add(blob);
  }
  const strip = new THREE.Mesh(new THREE.BoxGeometry(6.1, 0.3, 0.66), sauce);
  strip.position.set(0, 4.42, 0.02);
  group.add(strip);
  drawn.push(strip);

  /* Pepperoni: two big ones hold his eyes, the rest are just pepperoni. */
  const disc = (x, y, r) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.14, 24), pepperoni); m.rotation.x = Math.PI / 2; m.position.set(x, y, 0.36); group.add(m); return m; };
  for (const [x, y, r] of [[0.1, 0.9, 0.36], [-2.15, 3.95, 0.34], [2.2, 4.0, 0.32], [0.9, 2.0, 0.26], [-0.2, -0.2, 0.26]]) drawn.push(disc(x, y, r));
  const eyes = [-1, 1].map((side) => {
    disc(side * 1.2, 3.25, 0.8);
    const eye = new THREE.Group();
    eye.position.set(side * 1.2, 3.25, 0.46);
    const white = new THREE.Mesh(new THREE.SphereGeometry(0.46, 20, 14), eyeWhite);
    white.scale.set(1, 1.1, 0.4);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), pupilMat);
    pupil.scale.z = 0.4;
    pupil.position.z = 0.17;
    eye.add(white, pupil);
    /* A heavy brow of crust, slanted in anger. */
    const brow = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.34, 0.4), crustMat);
    brow.position.set(side * 1.2, 3.98, 0.52);
    brow.rotation.z = side * 0.38;
    group.add(eye, brow);
    return { eye, pupil };
  });

  /* The mouth: a wide crescent grin, deep red inside with a tongue, a row
     of crooked teeth along the top and two fangs below, thick lips of
     sauce round it, and strings of cheese stretched across when it opens. */
  const mouth = new THREE.Group();
  mouth.position.set(0, 1.85, 0.36);
  const grin = (w, h) => {
    const g = new THREE.Shape();
    g.moveTo(-w, 0.2); g.quadraticCurveTo(0, -0.12, w, 0.2); g.quadraticCurveTo(w * 0.62, -h, 0, -h); g.quadraticCurveTo(-w * 0.62, -h, -w, 0.2);
    return g;
  };
  const lips = new THREE.Mesh(new THREE.ShapeGeometry(grin(1.78, 1.32), 16), sauce);
  const throat = new THREE.MeshBasicMaterial({ color: "#2a0604" });
  const maw = new THREE.Mesh(new THREE.ShapeGeometry(grin(1.6, 1.12), 16), throat);
  maw.position.z = 0.03;
  const inner = new THREE.Mesh(new THREE.ShapeGeometry(grin(1.15, 0.8), 16), new THREE.MeshBasicMaterial({ color: "#120201" }));
  inner.position.set(0, -0.12, 0.05);
  const tongue = new THREE.Mesh(new THREE.SphereGeometry(0.62, 16, 10), new THREE.MeshStandardMaterial({ color: "#d4545a", roughness: 0.45, emissive: "#4a0a0c", emissiveIntensity: 0.5 }));
  tongue.scale.set(1, 0.42, 0.25);
  tongue.position.set(0.12, -0.86, 0.07);
  mouth.add(lips, maw, inner, tongue);
  const toothMat = new THREE.MeshStandardMaterial({ color: "#f3e4b0", roughness: 0.4, emissive: "#3a2a08", emissiveIntensity: 0.4 });
  for (let i = 0; i < 7; i++) {
    const x = -1.2 + i * 0.4, tooth = new THREE.Mesh(new THREE.ConeGeometry(0.13 + (i % 3) * 0.02, 0.3 + (i % 2) * 0.1, 5), toothMat);
    tooth.position.set(x, 0.0 - Math.abs(x) * 0.08 - 0.1, 0.12);
    tooth.rotation.set(Math.PI, 0, (i - 3) * 0.08);
    mouth.add(tooth);
  }
  for (const x of [-0.85, 0.85]) {
    const fang = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.48, 5), toothMat);
    fang.position.set(x, -0.82, 0.12);
    mouth.add(fang);
  }
  const strings = [-0.7, -0.15, 0.5].map((x) => {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 1, 6), cheese);
    s.position.set(x, -0.5, 0.14);
    mouth.add(s);
    return s;
  });
  group.add(mouth);

  /* The real slice: stood point-down, cheese toward the board, sized to the
     drawn one (point at y -1.75, crust top near 5.9), sitting just behind
     the eyes and mouth. */
  new GLTFLoader().loadAsync(REAL_PIZZA).then((gltf) => {
    const slice = gltf.scene;
    slice.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(slice);
    const k = 7.7 / (box.max.y - box.min.y);
    slice.scale.setScalar(k);
    slice.updateMatrixWorld(true);
    box.setFromObject(slice);
    slice.position.set(-(box.min.x + box.max.x) / 2, -1.75 - box.min.y, 0.2 - box.max.z);
    slice.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.material.emissiveMap = o.material.map; o.material.emissive.set("#ffffff"); o.material.emissiveIntensity = 0.3; } });
    for (const m of drawn) m.visible = false;
    group.add(slice);
    ts.wake?.();
  }).catch(() => {});

  /* The arms: one rope of melted cheese from his shoulder to wherever his
     hand is, thick at the shoulder and thinning, sagging in the middle,
     with strings dripping off it. Its shape is rewritten every frame. */
  const goo = new THREE.MeshPhysicalMaterial({ color: "#f0b032", roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.25, emissive: "#4a2800", emissiveIntensity: 0.5 });
  const RADIAL = 10;
  const ropeGeometry = () => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array((ROPE + 1) * RADIAL * 3), 3));
    g.setAttribute("normal", new THREE.BufferAttribute(new Float32Array((ROPE + 1) * RADIAL * 3), 3));
    const idx = [];
    for (let i = 0; i < ROPE; i++) for (let j = 0; j < RADIAL; j++) {
      const a = i * RADIAL + j, b = i * RADIAL + ((j + 1) % RADIAL), c = a + RADIAL, d = b + RADIAL;
      idx.push(a, c, b, b, c, d);
    }
    g.setIndex(idx);
    return g;
  };
  const arms = [-1, 1].map((side) => {
    const rope = new THREE.Mesh(ropeGeometry(), goo);
    rope.castShadow = true;
    rope.frustumCulled = false;
    group.add(rope);
    const drips = [0.28, 0.44, 0.6, 0.76].map((u, i) => {
      const strand = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 1, 6).translate(0, -0.5, 0), goo);
      const drop = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), goo);
      group.add(strand, drop);
      return { u, strand, drop, len: 0.35 + (i % 2) * 0.35, ph: i * 1.7 };
    });
    const hand = new THREE.Group();
    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), goo);
    palm.scale.set(1.1, 0.75, 1);
    palm.castShadow = true;
    hand.add(palm);
    for (let f = 0; f < 3; f++) {
      const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.34, 4, 8), goo);
      finger.position.set((f - 1) * 0.26, -0.24, 0.26);
      finger.rotation.x = 0.9;
      hand.add(finger);
    }
    group.add(hand);
    const shoulder = new THREE.Vector3(side * 2.9, 3.5, 0.3);
    const home = new THREE.Vector3(side * 4.1, 1.5, 1.6);
    return { side, rope, drips, hand, shoulder, home, at: home.clone(), goal: home.clone(), speed: 6 };
  });

  ts.scene.add(group);
  ts.addSeeThrough?.(group);

  /* Lays an arm's rope along the curve from shoulder to hand. */
  const bez = (p, q, r, u, out) => out.set(
    (1 - u) * (1 - u) * p.x + 2 * (1 - u) * u * q.x + u * u * r.x,
    (1 - u) * (1 - u) * p.y + 2 * (1 - u) * u * q.y + u * u * r.y,
    (1 - u) * (1 - u) * p.z + 2 * (1 - u) * u * q.z + u * u * r.z);
  const pt = new THREE.Vector3(), ahead = new THREE.Vector3(), tan = new THREE.Vector3(), nrm = new THREE.Vector3(), bin = new THREE.Vector3(), upV = new THREE.Vector3(0, 1, 0), off = new THREE.Vector3();
  const shapeRope = (arm, time) => {
    const pos = arm.rope.geometry.attributes.position, nor = arm.rope.geometry.attributes.normal;
    for (let i = 0; i <= ROPE; i++) {
      const u = i / ROPE;
      bez(arm.shoulder, mid, arm.at, u, pt);
      bez(arm.shoulder, mid, arm.at, Math.min(1, u + 0.01), ahead);
      tan.subVectors(ahead, pt);
      if (tan.lengthSq() < 1e-8) tan.set(0, 0, 1);
      tan.normalize();
      nrm.crossVectors(tan, upV);
      if (nrm.lengthSq() < 1e-6) nrm.set(1, 0, 0);
      nrm.normalize();
      bin.crossVectors(nrm, tan).normalize();
      /* Thick at the shoulder, thin at the wrist, lumpy as it stretches. */
      const r = (0.34 - u * 0.2) * (1 + 0.12 * Math.sin(u * 19 + time * 2.4));
      for (let j = 0; j < RADIAL; j++) {
        const a = (j / RADIAL) * Math.PI * 2;
        off.copy(nrm).multiplyScalar(Math.cos(a)).addScaledVector(bin, Math.sin(a));
        const k = (i * RADIAL + j) * 3;
        pos.array[k] = pt.x + off.x * r; pos.array[k + 1] = pt.y + off.y * r * 0.85; pos.array[k + 2] = pt.z + off.z * r;
        nor.array[k] = off.x; nor.array[k + 1] = off.y; nor.array[k + 2] = off.z;
      }
    }
    pos.needsUpdate = nor.needsUpdate = true;
    /* Strings of cheese hanging off it, swaying. */
    for (const d of arm.drips) {
      bez(arm.shoulder, mid, arm.at, d.u, pt);
      const len = d.len * (1 + 0.25 * Math.sin(time * 1.7 + d.ph));
      d.strand.position.set(pt.x, pt.y - 0.12, pt.z);
      d.strand.scale.set(1, len, 1);
      d.strand.rotation.z = Math.sin(time * 1.3 + d.ph) * 0.15;
      d.drop.position.set(pt.x - Math.sin(d.strand.rotation.z) * len, pt.y - 0.12 - Math.cos(d.strand.rotation.z) * len, pt.z);
    }
  };

  let t = 0, rise = 0, riseGoal = 0, riseY = RISE_Y[0], open = 0.25, openGoal = 0.25, sag = 0, melted = false;
  const tmp = new THREE.Vector3(), mid = new THREE.Vector3();
  /** A point in the world, in his own space (he leans, and rises). */
  const local = (point) => group.worldToLocal(point.clone());
  const nearestArm = (point) => (point.x < 0 ? arms[0] : arms[1]);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  return {
    group,
    update(dt) {
      t += dt;
      /* Rising and sinking. */
      const targetY = RISE_Y[riseGoal] - sag * 5;
      riseY += (targetY - riseY) * Math.min(1, dt * (riseGoal > rise ? 1.6 : 2.4));
      if (Math.abs(targetY - riseY) < 0.02) rise = riseGoal;
      group.visible = riseY > RISE_Y[0] + 0.3;
      if (!group.visible) return;
      group.position.y = riseY + Math.sin(t * 1.3) * 0.08;
      group.rotation.z = Math.sin(t * 0.7) * 0.025;
      group.scale.set(1.15 * (1 + sag * 0.25), 1.15 * (1 - sag * 0.5), 1.15);
      /* Eyes follow nothing in particular, and blink. */
      const blink = (t % 4.2) > 4.05 ? 0.1 : 1;
      for (const [i, e] of eyes.entries()) { e.eye.scale.y = blink * (melted ? 0.3 : 1); e.pupil.position.x = Math.sin(t * 0.6 + i * 0.3) * 0.12; e.pupil.position.y = -0.08 + Math.cos(t * 0.5) * 0.05; }
      /* The mouth opens and shuts; the strings stretch with it. */
      open += (openGoal - open) * Math.min(1, dt * 8);
      mouth.scale.y = 0.55 + open * 0.75 + Math.sin(t * 2.2) * 0.03;
      for (const s of strings) { s.scale.y = 0.4 + open * 0.7; s.visible = open > 0.45; }
      /* Arms: each hand heads for its goal, the beads hang between. */
      for (const arm of arms) {
        const goal = tmp.copy(arm.goal);
        if (arm.goal === arm.home || arm.goal.equals(arm.home)) goal.y += Math.sin(t * 1.6 + arm.side) * 0.18;
        arm.at.lerp(goal, Math.min(1, dt * arm.speed));
        arm.hand.position.copy(arm.at);
        arm.hand.rotation.z = -arm.side * 0.4;
        mid.copy(arm.shoulder).lerp(arm.at, 0.5);
        mid.y += 0.9 - Math.min(1.6, arm.shoulder.distanceTo(arm.at) * 0.12);
        mid.z += 0.6;
        shapeRope(arm, t);
      }
      ts.wake?.();
    },
    setRise(level) {
      if (level === riseGoal) return;
      if (level > riseGoal) playSound("rumble", { volume: level === 2 ? 0.9 : 0.4 });
      riseGoal = level;
      melted = false;
      sag = 0;
      ts.wake?.();
    },
    get risen() { return riseGoal === 2; },
    /** A hand stretches out to a point just above the board. */
    async reach(point) {
      const arm = nearestArm(point);
      arm.speed = 9;
      arm.goal = local(point.clone().setY(point.y + 0.95));
      playSound("cloth2", { volume: 0.5, rate: 0.7 });
      await wait(330);
      return arm;
    },
    /** The reaching hand moves on to `point` over `ms`, as the piece does. */
    carry(arm, point, ms) {
      const from = arm.goal.clone(), to = local(point.clone().setY(point.y + 0.95));
      return new Promise((resolve) => ts.tween(ms, (k) => { arm.goal = from.clone().lerp(to, ease(k)); arm.goal.y += Math.sin(k * Math.PI) * 0.5; }, resolve));
    },
    rest() { for (const arm of arms) { arm.goal = arm.home; arm.speed = 5; } },
    /** A fist comes down on the board at `point`. Resolves at the blow. */
    async slam(point) {
      const arm = nearestArm(point);
      arm.speed = 7;
      arm.goal = local(point.clone().setY(5.2));
      openGoal = 0.9;
      await wait(420);
      arm.speed = 26;
      arm.goal = local(point.clone().setY(0.35));
      await wait(110);
      playSound("punchHeavy", { volume: 1 });
      playSound("crunch", { volume: 0.7 });
      ts.shake = 0.22;
      ts.tween(520, (k) => { ts.shake = 0.22 * (1 - k); }, () => { ts.shake = 0; });
      await wait(260);
      openGoal = 0.25;
      arm.goal = arm.home;
      arm.speed = 5;
    },
    /** Mouth wide; the whole bin shakes. */
    async roar() {
      openGoal = 1;
      playSound("rumble", { volume: 1 });
      playSound("crunch", { volume: 0.6, rate: 0.6 });
      ts.shake = 0.12;
      for (const arm of arms) { arm.speed = 6; arm.goal = new THREE.Vector3(arm.side * 4.6, 5.4, 1.2); }
      await wait(1100);
      ts.tween(400, (k) => { ts.shake = 0.12 * (1 - k); }, () => { ts.shake = 0; });
      openGoal = 0.25;
      for (const arm of arms) { arm.goal = arm.home; arm.speed = 5; }
      await wait(400);
    },
    /** Beaten: he sags like cheese off the heat, and sinks into the rubbish. */
    async melt() {
      melted = true;
      openGoal = 0.6;
      playSound("poof", { volume: 0.9, rate: 0.6 });
      await new Promise((resolve) => ts.tween(1800, (k) => { sag = ease(k); }, resolve));
      riseGoal = 0;
      await wait(500);
    },
    dispose() { ts.scene.remove(group); ts.removeSeeThrough?.(group); },
  };
}
