/* The volcano's boss: the fire dragon. "Dragon Evolved" by Quaternius
   (public domain, CC0), recoloured deep red with molten wings, flown with
   its own animations (hovering, fast flight, headbutt, claw swipe, flinch,
   death) and given fire breath. Far off over the volcano for the world's
   first half, closer in the second, and on the last floor hovering over the
   board, moving the enemy's pieces itself. If you lose, it burns yours.

   Same controls as the other bosses: update(dt), setRise(0|1|2), reach,
   carry, rest, slam, roar, melt (beaten: it falls into the lava) and
   finish(points) (you lost: fire over your pieces). */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { play as playSound } from "../sound.js";

const MODEL = "/tactica/models/fire_dragon/dragon.glb";
const ease = (t) => t * t * (3 - 2 * t);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
/* Where it flies: far over the volcano, closer, then over the board. */
const SPOTS = [
  { pos: new THREE.Vector3(18, 16, -62), scale: 3.2 },
  { pos: new THREE.Vector3(-7, 9, -30), scale: 2.0 },
  { pos: new THREE.Vector3(0, 6.2, -10.5), scale: 1.25 },
];
/* Its wingspan at scale 1, in board squares. */
const SPAN = 7.5;
const COLOURS = {
  Dragon_Main: { color: "#7a140c", emissive: "#ff2a08", emissiveIntensity: 0.12 },
  Dragon_Secondary: { color: "#e8761e", emissive: "#ff5a10", emissiveIntensity: 0.35 },
  Dragon_Horn: { color: "#241612", emissive: "#000000", emissiveIntensity: 0 },
  Eye_White: { color: "#ffd24a", emissive: "#ffb020", emissiveIntensity: 2.2 },
  Eye_Black: { color: "#1a0400", emissive: "#000000", emissiveIntensity: 0 },
};

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
  /* The whole dragon is one mesh, so the whole of it fades when it hangs
     over a piece (other bosses fade just their hands). */
  root.userData.seeAll = true;
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
  new GLTFLoader().loadAsync(MODEL).then((gltf) => {
    const model = gltf.scene;
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    model.scale.setScalar(SPAN / Math.max(size.x, size.z));
    model.updateMatrixWorld(true);
    box.setFromObject(model);
    model.position.set(-(box.min.x + box.max.x) / 2, -(box.min.y + box.max.y) / 2, -(box.min.z + box.max.z) / 2);
    let head = null;
    model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.frustumCulled = false;
        const mats = [o.material].flat().map((m) => {
          const look = COLOURS[m.name];
          if (!look) return m;
          const n = new THREE.MeshStandardMaterial({ color: look.color, emissive: look.emissive, emissiveIntensity: look.emissiveIntensity, roughness: 0.55, metalness: 0.1 });
          n.name = m.name;
          return n;
        });
        o.material = Array.isArray(o.material) ? mats : mats[0];
      }
      if (o.isBone && o.name === "Head") head = o;
    });
    root.add(model);
    const mixer = new THREE.AnimationMixer(model);
    const clips = {};
    for (const c of gltf.animations) clips[c.name.split("|").pop()] = c;
    const actions = {};
    const action = (name) => (actions[name] ??= clips[name] ? mixer.clipAction(clips[name]) : null);
    real = { model, mixer, head, action, current: null };
    play("Flying_Idle");
    ts.wake?.();
  }).catch(() => {});

  /** Crossfades to an animation; `once` plays it through and holds. */
  function play(name, { once = false, fade = 0.25, speed = 1 } = {}) {
    if (!real) return 0;
    const next = real.action(name);
    if (!next) return 0;
    next.reset();
    next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    next.clampWhenFinished = once;
    next.timeScale = speed;
    next.enabled = true;
    if (real.current && real.current !== next) real.current.crossFadeTo(next, fade, false);
    next.play();
    real.current = next;
    return next.getClip().duration / speed;
  }

  let t = 0, stage = 0, move = null, hover = null, falling = 0;
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
      real?.mixer.update(dt);
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
      play("Flying_Idle");
      const spot = SPOTS[stage];
      flyTo(spot.pos, spot.scale, 700);
    },
    /** A dive and a headbutt into the board at `point`. Resolves at the blow. */
    async slam(point) {
      hover = point.clone();
      faceToward(point);
      play("Fast_Flying", { speed: 1.6 });
      await flyTo(point.clone().add(new THREE.Vector3(0, 4.5, -3)), SPOTS[2].scale, 380);
      play("Headbutt", { once: true, speed: 1.3 });
      await flyTo(point.clone().add(new THREE.Vector3(0, 1.6, -1.2)), SPOTS[2].scale, 220);
      playSound("punchHeavy", { volume: 1 });
      playSound("crunch", { volume: 0.8 });
      ts.shake = 0.24;
      ts.tween(520, (k) => { ts.shake = 0.24 * (1 - k); }, () => { ts.shake = 0; });
      await wait(240);
      hover = null;
      play("Flying_Idle");
    },
    /** It rears back and breathes a long blast of fire over the board. */
    async roar() {
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
