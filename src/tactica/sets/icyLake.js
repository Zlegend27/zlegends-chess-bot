/* World 2, the icy lake: the board sits on a small floe of ice, a little
   bigger than the board, out on a dark lake in a blizzard. Other floes
   drift and bob around it, ice cliffs stand in the fog, snow drives across
   on the wind, and far off across the ice a polar bear watches.

   dressIcyLake(tacticaScene) returns the same controls as the bin, so the
   run can treat any world alike:
     update(dt), setSnow(), setIntense(on), setBoss(level), monster,
     omen(), dispose(). */
import * as THREE from "three";
import { setFlies, setWind, play as playSound } from "../sound.js";
import { buildPolarBear } from "./polarBear.js";
import { dress, sky, skyMood, prop } from "./art.js";
import { buildLandform } from "./landform.js";

function rng(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

/* Cracks and frost painted on the floe's top. `cracks` 0 to 1. */
function iceTexture(cracks) {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(256, 256, 40, 256, 256, 256);
  grad.addColorStop(0, "#c9d8e5"); grad.addColorStop(0.7, "#aec3d5"); grad.addColorStop(1, "#86a3bc");
  g.fillStyle = grad; g.fillRect(0, 0, 512, 512);
  const r = rng(5);
  g.globalAlpha = 0.18;
  for (let i = 0; i < 70; i++) { g.fillStyle = r() < 0.5 ? "#ffffff" : "#a9c4da"; g.beginPath(); g.ellipse(r() * 512, r() * 512, 10 + r() * 50, 4 + r() * 18, r() * 3, 0, Math.PI * 2); g.fill(); }
  g.globalAlpha = 1;
  if (cracks > 0) {
    g.strokeStyle = `rgba(40,80,110,${0.55 * cracks})`; g.lineCap = "round";
    for (let k = 0; k < 7; k++) {
      let x = 256 + (r() - 0.5) * 120, y = 256 + (r() - 0.5) * 120;
      const a0 = r() * Math.PI * 2;
      g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(x, y);
      for (let s = 0; s < 9; s++) { const a = a0 + (r() - 0.5) * 0.9; x += Math.cos(a) * 30; y += Math.sin(a) * 30; g.lineTo(x, y); g.lineWidth = Math.max(0.6, 2.5 - s * 0.25); }
      g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function crackOnly() {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d");
  const r = rng(5);
  g.strokeStyle = "rgba(30,64,92,0.85)"; g.lineCap = "round";
  for (let k = 0; k < 8; k++) {
    let x = 256 + (r() - 0.5) * 120, y = 256 + (r() - 0.5) * 120;
    const a0 = r() * Math.PI * 2;
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(x, y);
    for (let s = 0; s < 10; s++) { const a = a0 + (r() - 0.5) * 0.9; x += Math.cos(a) * 28; y += Math.sin(a) * 28; g.lineTo(x, y); }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* Ripples for the water: wind-stretched swells drawn as heights, then
   turned into a tiling normal map, so the sky's light breaks up on it. */
function waterNormals(repeat) {
  const S = 256, r = rng(17);
  const h = new Float32Array(S * S);
  /* A sum of waves at different angles and sizes, all tiling. */
  const waves = Array.from({ length: 9 }, (_, i) => ({ kx: Math.round(1 + r() * 5) * (r() < 0.5 ? -1 : 1), ky: Math.round(1 + r() * 9), amp: 1 / (1 + i * 0.6), ph: r() * 6.28 }));
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let v = 0;
    for (const w of waves) v += Math.sin(((x * w.kx + y * w.ky) / S) * Math.PI * 2 + w.ph) * w.amp;
    h[y * S + x] = v;
  }
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d"), img = g.createImageData(S, S);
  const H = (x, y) => h[((y + S) % S) * S + ((x + S) % S)];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * 0.6, dy = (H(x, y + 1) - H(x, y - 1)) * 0.6, k = 1 / Math.hypot(dx, dy, 1), i = (y * S + x) * 4;
    img.data[i] = (-dx * k * 0.5 + 0.5) * 255; img.data[i + 1] = (-dy * k * 0.5 + 0.5) * 255; img.data[i + 2] = (k * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  return t;
}

const ROCKS = ["rock_07", "moon_rock_02", "rock_09"];

export function dressIcyLake(ts) {
  const scene = ts.scene;
  const SKY = "#5d7186", SKY_STORM = "#45576a";
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.FogExp2(SKY, 0.028);
  /* Once the real sky shows, the fog is matched to it. */
  let fogCalm = SKY;
  sky(ts, "ice", { background: true, intensity: 0.55, blur: 0.04 }).then(() => { fogCalm = "#7a8a9a"; if (!intense) scene.fog.color.set(fogCalm); });
  scene.environmentIntensity = 0.5;
  /* Cold, flat light from a white sky. */
  scene.traverse((o) => {
    if (o.isHemisphereLight) { o.intensity = 0.62; o.color.set("#e6f0fa"); o.groundColor.set("#2c4152"); }
    else if (o.isDirectionalLight) { o.intensity *= 0.35; o.color.set("#e9f1ff"); }
  });
  ts.renderer.shadowMap.enabled = true;
  ts.renderer.shadowMap.type = THREE.PCFShadowMap;
  ts.renderer.toneMappingExposure = 0.82;
  for (const tile of ts.tiles) tile.receiveShadow = true;
  const sun = new THREE.DirectionalLight("#f2f6ff", 1.05);
  sun.position.set(-4, 12, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 2, far: 30 });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);
  const LOOK = { glow: 0.12, glowFrom: 1.6, vignette: 0.5, tint: "#e1ecfb" };
  const STORM_LOOK = { glow: 0.12, glowFrom: 1.6, vignette: 0.64, tint: "#d3e0f2" };
  ts.setLook?.(LOOK);

  const set = new THREE.Group();
  scene.add(set);

  /* The floe the board sits on. */
  const topTex = iceTexture(0);
  const floeTop = new THREE.MeshStandardMaterial({ map: topTex, roughness: 0.35, metalness: 0.02 });
  const floeSide = new THREE.MeshStandardMaterial({ color: "#7fb2d4", roughness: 0.15, metalness: 0.05, emissive: "#0d3a58", emissiveIntensity: 0.25 });
  /* Mapped in world units (landform.js): one repeat per tile. */
  dress(floeTop, "ice", "snow", { repeat: 1, tint: "#b9c8d6", normal: 1.2 });
  dress(floeSide, "ice", "ice", { repeat: 1, tint: "#9fc8e6" });
  /* The other floes' snow, one material for all of them. */
  const floeSnow = new THREE.MeshStandardMaterial({ color: "#eaf3fa", roughness: 0.6 });
  dress(floeSnow, "ice", "snow", { repeat: 1, tint: "#dce6ee", normal: 1 });
  /* The cracks of the second half lie over the snow, on their own layer. */
  const crackLayer = new THREE.Mesh(new THREE.CircleGeometry(5.7, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: crackOnly(), transparent: true, depthWrite: false, opacity: 0 }));
  crackLayer.position.y = -0.19;
  /* A thick floe of old ice: flat under the board, snow drifted up toward
     its broken edge, a wall of blue ice with ledges dropping into the
     water. */
  const floe = buildLandform({ radius: 7.0, flat: 5.3, depth: 2.2, bumps: 0.3, flare: 0.12, seed: 3, texScale: 3, topMaterial: floeTop, sideMaterial: floeSide });
  floe.position.y = -0.21;
  set.add(floe, crackLayer);
  /* Icicles hanging off its edge into the water, and snow banked against the board. */
  const r = rng(41);
  const icicle = new THREE.ConeGeometry(0.12, 1, 6);
  icicle.rotateX(Math.PI);
  const icicleMat = new THREE.MeshStandardMaterial({ color: "#d8ecfa", roughness: 0.1, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 40; i++) {
    const a = r() * Math.PI * 2, m = new THREE.Mesh(icicle, icicleMat);
    m.position.set(Math.cos(a) * 6.95, -1.75, Math.sin(a) * 6.95);
    m.scale.set(1, 0.4 + r() * 0.8, 1);
    set.add(m);
  }
  const snowMat = new THREE.MeshStandardMaterial({ color: "#d4e0ea", roughness: 1 });
  dress(snowMat, "ice", "snow", { maps: ["diff", "nor"], repeat: 0.6, tint: "#c6d3df" });
  const drift = new THREE.SphereGeometry(1, 12, 8);
  for (let i = 0; i < 44; i++) {
    const a = r() * Math.PI * 2, d = 4.9 + r() * 1.6, m = new THREE.Mesh(drift, snowMat);
    m.position.set(Math.cos(a) * d, -0.42, Math.sin(a) * d);
    m.scale.set(0.5 + r() * 0.7, 0.2 + r() * 0.25, 0.5 + r() * 0.7);
    m.receiveShadow = true;
    set.add(m);
  }

  /* The lake. */
  /* Dark, cold water that mirrors the snowy sky, broken up by two layers
     of ripples drifting different ways. */
  const bump = waterNormals(18), bump2 = waterNormals(7);
  const water = new THREE.Mesh(new THREE.CircleGeometry(160, 64), new THREE.MeshPhysicalMaterial({ color: "#081822", roughness: 0.06, metalness: 0, normalMap: bump, normalScale: new THREE.Vector2(0.45, 0.45), clearcoat: 1, clearcoatRoughness: 0.12, clearcoatNormalMap: bump2, clearcoatNormalScale: new THREE.Vector2(0.3, 0.3), envMapIntensity: 1.4 }));
  water.rotation.x = -Math.PI / 2;
  water.position.y = -1.55;
  set.add(water);
  /* A ring of slush where the floe meets the water. */
  const slush = new THREE.Mesh(new THREE.RingGeometry(6.8, 7.8, 48), new THREE.MeshBasicMaterial({ color: "#c8dceb", transparent: true, opacity: 0.35, depthWrite: false }));
  slush.rotation.x = -Math.PI / 2;
  slush.position.y = -1.53;
  set.add(slush);

  /* Other floes, drifting and bobbing. */
  const floes = [];
  for (let i = 0; i < 16; i++) {
    const rad = 1.2 + r() * 3.2, a = r() * Math.PI * 2, d = 11 + r() * 30;
    const m = buildLandform({ radius: rad, flat: 0, depth: 0.9, bumps: 0.15, flare: 0.1, seed: 100 + i, texScale: 3, topMaterial: floeSnow, sideMaterial: floeSide, detail: 0.28 });
    m.position.set(Math.cos(a) * d, -1.2, Math.sin(a) * d - 6);
    m.rotation.y = r() * 6;
    set.add(m);
    floes.push({ m, ph: r() * 6.28, base: m.position.clone(), drift: (r() - 0.5) * 0.12 });
    /* Half the floes carry a frozen boulder (photographed rock, cold grey). */
    if (i % 2 === 0) prop(ts, m, ROCKS[i % ROCKS.length], { size: rad * (0.7 + r() * 0.5), at: [(r() - 0.5) * rad * 0.5, 0.05, (r() - 0.5) * rad * 0.5], rot: [0, r() * 6, 0], tint: "#c9d6e2", sink: 0.08 });
  }
  /* A few stones frozen into the edge of our own floe, clear of the board. */
  for (const [x, z, sz, k] of [[6.1, 0.8, 1.3, 0], [-6.0, -1.6, 1.0, 1], [-1.2, -6.1, 1.1, 2]]) {
    prop(ts, set, ROCKS[k], { size: sz, at: [x, -0.05, z], rot: [0, x + z, 0], tint: "#c9d6e2", sink: 0.15 });
  }
  /* The bear's floe, out across the water. */
  const bearFloe = buildLandform({ radius: 7, flat: 3, depth: 1.4, bumps: 0.2, flare: 0.12, seed: 9, texScale: 3, topMaterial: floeSnow, sideMaterial: floeSide, detail: 0.5 });
  bearFloe.position.set(-9, -0.55, -34);
  set.add(bearFloe);
  /* A bridge of ice from his floe toward ours, so he has a way across. */
  for (let i = 0; i < 6; i++) {
    const m = buildLandform({ radius: 2.6, flat: 0, depth: 1.1, bumps: 0.12, flare: 0.1, seed: 300 + i, texScale: 3, topMaterial: floeSnow, sideMaterial: floeSide, detail: 0.3 });
    m.position.set(-9 + i * 2.4, -0.6, -29 + i * 3.6);
    set.add(m);
  }

  /* Ice cliffs and far mountains, pale in the fog. */
  const cliffMat = new THREE.MeshStandardMaterial({ color: "#c4d6e4", roughness: 0.6, flatShading: true });
  dress(cliffMat, "ice", "cliff", { maps: ["diff", "nor"], repeat: 2, tint: "#b6cde0" });
  for (let i = 0; i < 14; i++) {
    const a = -Math.PI * 0.95 + (i / 13) * Math.PI * 0.9, d = 55 + r() * 35, h = 10 + r() * 22;
    const m = new THREE.Mesh(new THREE.ConeGeometry(6 + r() * 9, h, 5 + Math.floor(r() * 3)), cliffMat);
    m.position.set(Math.cos(a) * d, h / 2 - 1.6, Math.sin(a) * d);
    m.rotation.y = r() * 6;
    set.add(m);
  }

  /* The blizzard: snow driving across on the wind. */
  const N = 2600, BOX = 26, HIGH = 14;
  const pos = new Float32Array(N * 3), flakes = [];
  for (let i = 0; i < N; i++) flakes.push({ x: (r() - 0.5) * BOX * 2, y: r() * HIGH - 1.5, z: (r() - 0.5) * BOX * 2, fall: 1 + r() * 1.6, ph: r() * 6.28 });
  const snowGeo = new THREE.BufferGeometry();
  snowGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const flakeTex = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 32;
    const g = c.getContext("2d"); const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, "rgba(255,255,255,1)"); grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad; g.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c);
  })();
  const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({ map: flakeTex, size: 0.11, transparent: true, depthWrite: false, color: "#e9f1f8", opacity: 0.75 }));
  snow.frustumCulled = false;
  set.add(snow);

  /* Pieces cast shadows; ones added later are picked up as they appear. */
  const castAll = () => {
    for (const e of ts.pieces.values()) {
      if (e.casts) continue;
      e.model.traverse((o) => { if (o.isMesh && !o.userData.tiny) o.castShadow = true; });
      e.casts = true;
    }
  };

  setFlies(false);
  setWind(true, 0.6);

  let t = 0, wind = 1, windGoal = 1, intense = false, bear = null;
  const ensureBear = () => (bear ??= buildPolarBear(ts));
  ensureBear();
  return {
    update(dt) {
      t += dt;
      wind += (windGoal - wind) * Math.min(1, dt * 0.8);
      const gust = 1 + 0.35 * Math.sin(t * 0.7) * Math.sin(t * 1.9);
      for (let i = 0; i < N; i++) {
        const f = flakes[i];
        f.x += dt * (5.5 * wind * gust);
        f.z += dt * 1.2 * wind;
        f.y -= dt * f.fall * (0.7 + 0.3 * wind);
        if (f.x > BOX) f.x -= BOX * 2;
        if (f.z > BOX) f.z -= BOX * 2;
        if (f.y < -1.5) f.y += HIGH;
        pos[i * 3] = f.x + Math.sin(t * 2 + f.ph) * 0.2;
        pos[i * 3 + 1] = f.y;
        pos[i * 3 + 2] = f.z;
      }
      snowGeo.attributes.position.needsUpdate = true;
      bump.offset.x = t * 0.012; bump.offset.y = t * 0.007;
      bump2.offset.x = -t * 0.004; bump2.offset.y = t * 0.009;
      for (const fl of floes) {
        fl.m.position.y = fl.base.y + Math.sin(t * 0.8 + fl.ph) * 0.06;
        fl.m.rotation.z = Math.sin(t * 0.6 + fl.ph) * 0.02;
        fl.m.position.x = fl.base.x + Math.sin(t * 0.05 + fl.ph) * 1.5 + t * fl.drift * 0.1;
      }
      /* Our floe rocks very gently. */
      set.rotation.z = Math.sin(t * 0.5) * 0.004;
      bear?.update(dt);
      castAll();
    },
    setSnow() {},
    /** The lake's second half: the storm thickens and the ice cracks. */
    setIntense(on) {
      if (on === intense) return;
      intense = on;
      windGoal = on ? 1.8 : 1;
      crackLayer.material.opacity = on ? 0.9 : 0;
      scene.fog.density = on ? 0.04 : 0.028;
      scene.fog.color.set(on ? SKY_STORM : fogCalm);
      skyMood(scene, on ? SKY_STORM : SKY, on ? 0.35 : 0.55);
      setWind(true, on ? 1 : 0.6);
      ts.setLook?.(on ? STORM_LOOK : LOOK);
      ts.wake?.();
    },
    get monster() { return ensureBear(); },
    /** 0: far across the ice, 1: on the ice bridge, coming, 2: at the board. */
    setBoss(level) { ensureBear().setRise(level); },
    omenView: [[3, 3.2, 9], [-4, 1.4, -22]],
    bossView: [[0, 3.0, 10], [0, 3.6, -6]],
    /** The lake's sixth floor: a roar across the ice, the floe splits a
     *  little, and the storm comes in. */
    async omen() {
      playSound("rumble", { volume: 0.8 });
      await new Promise((res) => setTimeout(res, 300));
      await ensureBear().roar();
      playSound("crack", { volume: 1 });
      this.setIntense(true);
      ts.shake = 0.15;
      await new Promise((res) => ts.tween(900, (k) => { ts.shake = 0.15 * (1 - k); }, () => { ts.shake = 0; res(); }));
      ensureBear().setRise(1);
      await new Promise((res) => setTimeout(res, 1600));
    },
    dispose() {
      setWind(false);
      setFlies(true);
      bear?.dispose();
    },
  };
}
