/* The volcano's boss: the fire dragon. "Dragon Rigged" by na3ee1 (Poly
   Pizza, CC BY 4.0), recoloured charcoal and ember with burning eyes. The
   model has a skeleton but no animations, so it is flown here in code:
   wingbeats (the forearms lagging the arms), a snapping jaw, a swaying
   tail, a head that follows you, a roar, and fire breath. Far off over the volcano for the world's
   first half, closer in the second, and on the last floor hovering over the
   board, moving the enemy's pieces itself. If you lose, it burns yours.

   Same controls as the other bosses: update(dt), setRise(0|1|2), reach,
   carry, rest, slam, roar, melt (beaten: it falls into the lava) and
   finish(points) (you lost: fire over your pieces). */
import * as THREE from "three";
import { track, glbLoader } from "./art.js";
import { play as playSound } from "../sound.js";

const MODEL = "/tactica/models/fire_dragon/dragon.glb";
const ease = (t) => t * t * (3 - 2 * t);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
/* Where it flies: far over the volcano, closer, then over the board. */
const SPOTS = [
  { pos: new THREE.Vector3(18, 14, -62), scale: 3.0 },
  { pos: new THREE.Vector3(-7, 6, -30), scale: 1.9 },
  /* Hanging in the open space above the board's far edge in the
     whole-board view (worked out from the camera: centred about 45% up
     the screen, clear of the pieces). */
  { pos: new THREE.Vector3(0, 3.9, -12), scale: 1.6 },
];
/* Its wingspan at scale 1, in board squares. */
const SPAN = 8.5;
/* Charcoal scales, ember-red wings and belly, a fiery mouth, burning eyes. */
const COLOURS = {
  DarkGreen: { color: "#2a1d19", emissive: "#5a1004", emissiveIntensity: 0.45 },
  Green: { color: "#8c1e0e", emissive: "#ff3a0c", emissiveIntensity: 0.3 },
  Red: { color: "#ff4a14", emissive: "#ff3a0c", emissiveIntensity: 1.4 },
  Yellow: { color: "#ffd24a", emissive: "#ffb020", emissiveIntensity: 3 },
  Teeth: { color: "#ece0c4", emissive: "#000000", emissiveIntensity: 0 },
  Black: { color: "#0b0707", emissive: "#000000", emissiveIntensity: 0 },
};
/* Model axes: it faces +z, its left wing is on +x. */
const FWD = new THREE.Vector3(0, 0, 1), SIDE = new THREE.Vector3(1, 0, 0), UP = new THREE.Vector3(0, 1, 0);

/* A soft round glow, for the fire. */
function glowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)"); grad.addColorStop(0.4, "rgba(255,255,255,0.5)"); grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export function buildFireDragon(ts) {
  const root = new THREE.Group();
  root.position.copy(SPOTS[0].pos);
  root.scale.setScalar(SPOTS[0].scale);
  ts.scene.add(root);
  /* The whole dragon is one mesh: while it swoops over the board (only
     then) the whole of it may fade where it covers a piece. */
  root.userData.seeAll = false;
  ts.addSeeThrough?.(root);

  /* Fire breath: sparks streaming from its mouth toward a point. */
  const FIRE = 180, firePos = new Float32Array(FIRE * 3), fireCol = new Float32Array(FIRE * 3), sparks = [];
  for (let i = 0; i < FIRE; i++) sparks.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), life: 0 });
  const fireGeo = new THREE.BufferGeometry();
  fireGeo.setAttribute("position", new THREE.BufferAttribute(firePos, 3));
  fireGeo.setAttribute("color", new THREE.BufferAttribute(fireCol, 3));
  const fire = new THREE.Points(fireGeo, new THREE.PointsMaterial({ map: glowTexture(), size: 0.9, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  fire.frustumCulled = false;
  ts.scene.add(fire);
  let breathing = null; // { at: Vector3 } while breathing
  const mouth = new THREE.Vector3(), aim = new THREE.Vector3();
  const hot = new THREE.Color("#fff2b0"), warm = new THREE.Color("#ff7a18"), dark = new THREE.Color("#5a0a02");

  /* The model, laid in when it loads. */
  let real = null;
  track(glbLoader().loadAsync(MODEL)).then((gltf) => {
    const model = gltf.scene;
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    model.scale.setScalar(SPAN / Math.max(size.x, size.z));
    model.updateMatrixWorld(true);
    box.setFromObject(model);
    model.position.set(-(box.min.x + box.max.x) / 2, -(box.min.y + box.max.y) / 2, -(box.min.z + box.max.z) / 2);
    const bones = {};
    model.traverse((o) => {
      if (o.isBone) bones[o.name] = o;
      if (o.isMesh) {
        o.castShadow = true;
        o.frustumCulled = false;
        const mats = [o.material].flat().map((m) => {
          const look = COLOURS[m.name];
          if (!look) return m;
          const n = new THREE.MeshStandardMaterial({ color: look.color, emissive: look.emissive, emissiveIntensity: look.emissiveIntensity, roughness: 0.6, metalness: 0.15, flatShading: true });
          n.name = m.name;
          return n;
        });
        o.material = Array.isArray(o.material) ? mats : mats[0];
      }
    });
    root.add(model);
    model.updateMatrixWorld(true);
    /* Each animated bone with its rest turn and its parent's turn in model
       space, so a turn can be given round the model's own axes. */
    const modelInv = model.getWorldQuaternion(new THREE.Quaternion()).invert();
    const rig = (name) => {
      const b = bones[name];
      if (!b) return null;
      const parent = b.parent.getWorldQuaternion(new THREE.Quaternion()).premultiply(modelInv);
      return { b, rest: b.quaternion.clone(), parent, parentInv: parent.clone().invert() };
    };
    const R = {
      armL: rig("ArmL"), armR: rig("ArmR"), foreL: rig("ForearmL"), foreR: rig("ForearmR"),
      jaw: rig("Jaw001"), skull: rig("SkullControl"), neck: rig("Spine008"),
      tail: ["Tail002", "Tail004", "Tail006"].map(rig).filter(Boolean),
    };
    real = { model, head: bones.Head001 ?? bones.SkullControl, R };
    ts.wake?.();
  }).catch(() => {});

  /* Motion state, eased toward each frame. */
  const pose = { flap: 1, flapGoal: 1, jaw: 0, jawGoal: 0, rear: 0, rearGoal: 0, lunge: 0, lungeGoal: 0, droop: 0, droopGoal: 0, look: 0 };
  let phase = 0;
  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
  /** Turns a rigged bone by `angle` round a model-space `axis`, on top of rest. */
  const turn = (r, axis, angle, extra = null) => {
    if (!r) return;
    qa.setFromAxisAngle(axis, angle);
    qb.copy(r.parentInv).multiply(qa).multiply(r.parent);
    r.b.quaternion.copy(qb).multiply(r.rest);
    if (extra) { qa.setFromAxisAngle(extra[0], extra[1]); qb.copy(r.parentInv).multiply(qa).multiply(r.parent); r.b.quaternion.premultiply(qb); }
  };
  const animate = (dt) => {
    if (!real) return;
    const k = Math.min(1, dt * 6);
    for (const key of ["flap", "jaw", "rear", "lunge", "droop"]) pose[key] += (pose[key + "Goal"] - pose[key]) * k;
    phase += dt * (2.6 + pose.flap * 3.2);
    const { R } = real;
    /* Wingbeats: up on +z for the left wing, mirrored on the right; the
       forearms follow a beat behind. Folded when it droops (dying). */
    const beat = Math.sin(phase) * (0.35 + 0.25 * pose.flap) * (1 - pose.droop);
    const lag = Math.sin(phase - 0.9) * (0.3 + 0.2 * pose.flap) * (1 - pose.droop);
    turn(R.armL, FWD, beat - pose.droop * 0.9);
    turn(R.armR, FWD, -beat + pose.droop * 0.9);
    turn(R.foreL, FWD, lag * 0.8);
    turn(R.foreR, FWD, -lag * 0.8);
    /* The jaw drops; the head rears back for a roar or thrusts in a lunge. */
    turn(R.jaw, SIDE, pose.jaw * 0.75);
    turn(R.skull, SIDE, -pose.rear * 0.5 + pose.lunge * 0.35 + Math.sin(phase * 0.5) * 0.04, [UP, pose.look]);
    turn(R.neck, SIDE, -pose.rear * 0.25 + pose.lunge * 0.2);
    R.tail.forEach((r, i) => turn(r, UP, Math.sin(phase * 0.45 - i * 0.7) * 0.18));
  };

  /** Animation states, for the same calls the other bosses use. */
  function play(name, { speed = 1 } = {}) {
    pose.flapGoal = name === "Fast_Flying" ? 2 * speed : 1;
    pose.jawGoal = name === "Yes" || name === "Punch" ? 1 : name === "Headbutt" ? 0.6 : 0;
    pose.rearGoal = name === "Yes" ? 1 : 0;
    pose.lungeGoal = name === "Headbutt" || name === "Punch" ? 1 : 0;
    pose.droopGoal = name === "Death" ? 1 : 0;
    if (name === "HitReact") { pose.rear = 0.8; pose.jaw = 0.5; }
    ts.wake?.();
    return name === "Death" ? 1.2 : 0.8;
  }

  let t = 0, stage = 0, move = null, hover = null, falling = 0, nextSnort = 7, snorting = 0;
  /** Flies to a spot (world position and scale) over `ms`. */
  const flyTo = (pos, scale = root.scale.x, ms = 900) => {
    move = { from: root.position.clone(), fromScale: root.scale.x, to: pos.clone(), toScale: scale, k: 0, ms };
    ts.wake?.();
    return wait(ms);
  };
  /* Faces a point on the board, turning only round the vertical (its model
     faces +z: a heading of atan2(dx, dz) looks at (dx, dz)). */
  const faceToward = (p) => { const d = p.clone().sub(root.position); root.rotation.y = Math.atan2(d.x, d.z); };

  return {
    update(dt) {
      t += dt;
      animate(dt);
      if (move) {
        move.k = Math.min(1, move.k + (dt * 1000) / move.ms);
        const k = ease(move.k);
        root.position.lerpVectors(move.from, move.to, k);
        root.scale.setScalar(move.fromScale + (move.toScale - move.fromScale) * k);
        if (move.k >= 1) move = null;
      } else if (stage === 0 && !falling) {
        /* Far off, it circles the volcano's crater. */
        const a = t * 0.25;
        root.position.set(SPOTS[0].pos.x + Math.cos(a) * 9, SPOTS[0].pos.y + Math.sin(t * 0.7) * 1.2, SPOTS[0].pos.z + Math.sin(a) * 6);
        root.rotation.y = a + Math.PI;
      }
      if (!move && stage > 0 && !falling) {
        /* Hovering: a gentle rise and fall with the wingbeats. */
        root.position.y += Math.sin(t * 2.2) * 0.012;
        if (!hover) faceToward(new THREE.Vector3(0, 0, 2));
      }
      if (falling) {
        root.position.y -= dt * falling;
        falling += dt * 9;
        root.rotation.x = Math.min(1.2, root.rotation.x + dt * 0.8);
      }
      /* Hovering over the board, now and then a short burst of fire over
         the pieces' heads (never at them). */
      if (stage === 2 && !move && !hover && !falling && root.visible) {
        nextSnort -= dt;
        if (nextSnort < 0 && !breathing) {
          nextSnort = 9 + Math.random() * 6;
          snorting = 0.55;
          breathing = { at: new THREE.Vector3((Math.random() - 0.5) * 4, 3.4, 3.5) };
          play("Yes");
          playSound("whoom", { volume: 0.45 });
        }
      }
      if (snorting > 0) { snorting -= dt; if (snorting <= 0) { breathing = null; play("Flying_Idle"); } }
      /* Fire breath. */
      if (real?.head) {
        real.head.getWorldPosition(mouth);
        mouth.addScaledVector(new THREE.Vector3(Math.sin(root.rotation.y), -0.25, Math.cos(root.rotation.y)), 0.9 * root.scale.x);
      }
      let live = 0;
      for (let i = 0; i < FIRE; i++) {
        const s = sparks[i];
        if (s.life <= 0 && breathing && Math.random() < 0.6) {
          s.p.copy(mouth);
          aim.copy(breathing.at).sub(mouth).normalize();
          s.v.copy(aim).multiplyScalar(9 + Math.random() * 5).add(new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2));
          s.life = 0.55 + Math.random() * 0.3;
        }
        if (s.life > 0) {
          s.life -= dt;
          s.p.addScaledVector(s.v, dt);
          s.v.multiplyScalar(1 - dt * 0.8);
          live++;
        }
        const k = Math.max(0, s.life / 0.8);
        firePos[i * 3] = s.life > 0 ? s.p.x : 0; firePos[i * 3 + 1] = s.life > 0 ? s.p.y : -999; firePos[i * 3 + 2] = s.life > 0 ? s.p.z : 0;
        const c = k > 0.6 ? hot.clone().lerp(warm, (1 - k) / 0.4) : warm.clone().lerp(dark, 1 - k / 0.6);
        fireCol[i * 3] = c.r; fireCol[i * 3 + 1] = c.g; fireCol[i * 3 + 2] = c.b;
      }
      fireGeo.attributes.position.needsUpdate = true;
      fireGeo.attributes.color.needsUpdate = true;
      if (live) ts.wake?.();
    },
    setRise(level) {
      if (level === stage && !move) return;
      stage = level;
      falling = 0;
      root.rotation.x = 0;
      root.visible = true;
      play(level === 2 ? "Flying_Idle" : "Fast_Flying");
      playSound("whoom", { volume: 0.7 });
      const spot = SPOTS[level];
      flyTo(spot.pos, spot.scale, 1600 + root.position.distanceTo(spot.pos) * 40).then(() => { if (stage === level) play("Flying_Idle"); });
    },
    get risen() { return stage === 2; },
    /** It swoops in over the piece it is about to move. */
    async reach(point) {
      hover = point.clone();
      root.userData.seeAll = true;
      faceToward(point);
      play("Fast_Flying", { speed: 1.4 });
      playSound("whoom", { volume: 0.6 });
      await flyTo(point.clone().add(new THREE.Vector3(0, 3.2, -2.4)), SPOTS[2].scale, 420);
      play("Punch", { once: true, speed: 1.4 });
      return { at: point.clone() };
    },
    carry(handle, point, ms) {
      faceToward(point);
      return flyTo(point.clone().add(new THREE.Vector3(0, 3.2, -2.4)), SPOTS[2].scale, ms);
    },
    rest() {
      hover = null;
      root.userData.seeAll = false;
      play("Flying_Idle");
      const spot = SPOTS[stage];
      flyTo(spot.pos, spot.scale, 700);
    },
    /** A wrong move: it swoops over `point`, breathes fire on it, dives
     *  into it, and flies back to where it hovers. Resolves just after the
     *  blow. */
    async slam(point) {
      snorting = 0;
      hover = point.clone();
      root.userData.seeAll = true;
      faceToward(point);
      play("Fast_Flying", { speed: 1.6 });
      await flyTo(point.clone().add(new THREE.Vector3(0, 4.4, -3.4)), SPOTS[2].scale, 380);
      play("Yes");
      playSound("whoom", { volume: 1 });
      playSound("crunch", { volume: 0.5, rate: 0.7, delay: 0.25 });
      breathing = { at: point.clone() };
      ts.shake = 0.06;
      await wait(700);
      breathing = null;
      ts.shake = 0;
      play("Headbutt");
      await flyTo(point.clone().add(new THREE.Vector3(0, 1.6, -1.2)), SPOTS[2].scale, 200);
      playSound("punchHeavy", { volume: 1 });
      ts.shake = 0.24;
      ts.tween(520, (k) => { ts.shake = 0.24 * (1 - k); }, () => { ts.shake = 0; });
      await wait(200);
      this.rest();
    },
    /** It rears back and breathes a long blast of fire over the board. */
    async roar() {
      snorting = 0;
      play("Yes", { once: true });
      playSound("rumble", { volume: 1 });
      playSound("whoom", { volume: 1 });
      ts.shake = 0.12;
      breathing = { at: new THREE.Vector3(0, 0, 3) };
      await wait(1300);
      breathing = null;
      ts.tween(400, (k) => { ts.shake = 0.12 * (1 - k); }, () => { ts.shake = 0; });
      play("Flying_Idle");
      await wait(300);
    },
    /** Beaten: it flinches, falters, and falls into the lava. */
    async melt() {
      play("HitReact", { once: true });
      playSound("crunch", { volume: 1 });
      await wait(500);
      const d = play("Death", { once: true }) || 1.2;
      playSound("rumble", { volume: 0.9 });
      await wait(Math.min(1500, d * 1000));
      falling = 2;
      await wait(1400);
      root.visible = false;
      falling = 0;
      root.rotation.x = 0;
    },
    /** You lost: fire over your pieces, one patch after another. */
    async finish(points) {
      play("Yes", { once: true });
      playSound("whoom", { volume: 1 });
      for (const p of points.slice(0, 6)) {
        faceToward(p);
        breathing = { at: p.clone() };
        playSound("crunch", { volume: 0.5, rate: 0.7 });
        await wait(420);
      }
      breathing = null;
      await this.roar();
    },
    dispose() { ts.scene.remove(root); ts.scene.remove(fire); ts.removeSeeThrough?.(root); },
  };
}
