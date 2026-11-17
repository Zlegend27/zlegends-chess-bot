/* World 4, the demon's realm: the board on a slab of black stone hanging
   in a void. Red runes burn in the stone, the weapons of everyone who came
   this far stand stuck in the ground around it, broken pillars float in the
   dark, chains hang from nowhere, and a storm turns overhead, lit by
   lightning. In the second half a red moon rises, the storm breaks loose,
   and the demon comes closer.

   dressDemonRealm(tacticaScene) returns the same controls as the other
   worlds: update(dt), setSnow(), setIntense(on), setBoss(level), monster,
   omen(), omenView, bossView, dispose(). */
import * as THREE from "three";
import { setFlies, setWind, play as playSound } from "../sound.js";
import { buildDemon } from "./demon.js";
import { strike } from "./lightning.js";
import { dress, sky, skyMood, prop } from "./art.js";

function rng(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

/* Stone with red runes cut into it. Two maps: the stone, and the runes'
   glow. */
function runeTextures() {
  const make = (glow) => {
    const c = document.createElement("canvas");
    c.width = c.height = 512;
    const g = c.getContext("2d");
    g.fillStyle = glow ? "#000" : "#17141a"; g.fillRect(0, 0, 512, 512);
    const r = rng(glow ? 7 : 3);
    if (!glow) for (let i = 0; i < 200; i++) { g.fillStyle = r() < 0.5 ? "rgba(0,0,0,0.4)" : "rgba(70,60,80,0.25)"; g.fillRect(r() * 512, r() * 512, 2 + r() * 20, 2 + r() * 6); }
    /* A ring of runes round the edge, and a circle. */
    g.strokeStyle = glow ? "#ff2a2a" : "#0a080c"; g.lineWidth = 5;
    g.beginPath(); g.arc(256, 256, 236, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(256, 256, 214, 0, Math.PI * 2); g.stroke();
    const r2 = rng(11);
    g.lineWidth = 4; g.lineCap = "round";
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2, cx = 256 + Math.cos(a) * 225, cy = 256 + Math.sin(a) * 225;
      g.save(); g.translate(cx, cy); g.rotate(a + Math.PI / 2);
      g.beginPath();
      for (let k = 0; k < 3; k++) { const x0 = (r2() - 0.5) * 12, y0 = (r2() - 0.5) * 12; g.moveTo(x0, y0); g.lineTo(x0 + (r2() - 0.5) * 14, y0 + (r2() - 0.5) * 14); }
      g.stroke(); g.restore();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  return { map: make(false), glow: make(true) };
}

function softDot() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)"); grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

const SWORDS = ["antique_estoc", "antique_katana_01", "wooden_handle_saber"];
const AXES = ["wooden_axe_02", "hatchet"];
/* Models that come handle-down: turned over so the point goes in. */
const FLIP = new Set(["antique_estoc", "antique_katana_01", "wooden_handle_saber", "wooden_axe_02", "hatchet"]);

export function dressDemonRealm(ts) {
  const scene = ts.scene;
  const SKY = "#0b0810", SKY_RAGE = "#1a0508";
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.FogExp2("#0d0912", 0.024);
  /* A real night sky of stars, dimmed. */
  sky(ts, "demon", { background: true, intensity: 0.3 });
  scene.environmentIntensity = 0.55;
  scene.traverse((o) => {
    if (o.isHemisphereLight) { o.intensity = 0.4; o.color.set("#7a6aa0"); o.groundColor.set("#2a0a10"); }
    else if (o.isDirectionalLight) { o.intensity *= 0.3; o.color.set("#b8b0ff"); }
  });
  ts.renderer.shadowMap.enabled = true;
  ts.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  ts.renderer.toneMappingExposure = 0.95;
  for (const tile of ts.tiles) tile.receiveShadow = true;
  const key = new THREE.DirectionalLight("#c9c4ff", 1.1);
  key.position.set(-3, 12, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 2, far: 30 });
  key.shadow.bias = -0.0006;
  key.shadow.normalBias = 0.02;
  scene.add(key, key.target);
  /* A cold light from behind, so the demon's dark armour shows its edges
     against the void. */
  const rim = new THREE.DirectionalLight("#9a7aff", 2.2);
  rim.position.set(0, 10, -40);
  scene.add(rim);
  /* The runes' red light from below the board's edge. */
  const runeLight = new THREE.PointLight("#ff2a2a", 10, 14, 1.8);
  runeLight.position.set(0, -0.2, 0);
  scene.add(runeLight);
  const LOOK = { glow: 0.45, glowFrom: 1.0, vignette: 0.72, tint: "#e8e0ff" };
  const RAGE_LOOK = { glow: 0.55, glowFrom: 0.95, vignette: 0.8, tint: "#ffd6dc" };
  ts.setLook?.(LOOK);

  const set = new THREE.Group();
  scene.add(set);
  const r = rng(13);

  /* The slab: a thick disc of black stone, its underside breaking away
     into the void. */
  const tex = runeTextures();
  const top = new THREE.MeshStandardMaterial({ map: tex.map, roughness: 0.8, metalness: 0.2, emissive: "#ff2a2a", emissiveMap: tex.glow, emissiveIntensity: 1.4 });
  const stone = new THREE.MeshStandardMaterial({ color: "#141118", roughness: 0.9, flatShading: true });
  dress(top, "demon", "floor", { repeat: 2.2, tint: "#6a6070", normal: 1.4 });
  dress(stone, "demon", "pillar", { maps: ["diff", "nor"], repeat: 1.5, tint: "#3a3440", normal: 1.4 });
  const slab = new THREE.Mesh(new THREE.CylinderGeometry(7.2, 6.4, 1.2, 10), [stone, top, stone]);
  slab.position.y = -1.02;
  slab.receiveShadow = true;
  set.add(slab);
  const under = new THREE.Mesh(new THREE.ConeGeometry(6.4, 9, 10), stone);
  under.rotation.x = Math.PI;
  under.position.y = -6.1;
  set.add(under);

  /* Weapons stuck in the ground round the board: swords, spears, axes. */
  const steel = new THREE.MeshStandardMaterial({ color: "#8a8f99", roughness: 0.35, metalness: 1 });
  const rust = new THREE.MeshStandardMaterial({ color: "#3a2a22", roughness: 0.8 });
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2 + r() * 0.15, d = 6.1 + r() * 0.8;
    const kind = i % 3;
    /* Swords and axes are photographed models, driven in point first; the
       spears stay drawn. */
    if (kind !== 1) {
      const [id, size] = kind === 0 ? [SWORDS[(i / 3) % SWORDS.length | 0], 2.3] : [AXES[(i / 3) % AXES.length | 0], 1.6];
      prop(ts, set, id, { size, at: [Math.cos(a) * d, -0.45, Math.sin(a) * d], rot: [(r() - 0.5) * 0.5, r() * 6, (r() - 0.5) * 0.5], upright: true, flip: FLIP.has(id), sink: kind === 0 ? 0.22 : 0.12, tint: "#b0a8a8" });
      continue;
    }
    const w = new THREE.Group();
    if (kind === 0) { w.add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.2, 0.03), steel)); const guard = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.07, 0.1), rust); guard.position.y = 1.1; w.add(guard); const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.45, 0.07), rust); grip.position.y = 1.35; w.add(grip); }
    else if (kind === 1) { const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 3, 5), rust); pole.position.y = 0.5; w.add(pole); const tip = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.45, 4), steel); tip.position.y = 2.2; w.add(tip); }
    else { const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2, 5), rust); pole.position.y = 0.3; w.add(pole); const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.45, 0.04), steel); head.position.set(0.25, 1.15, 0); w.add(head); }
    w.position.set(Math.cos(a) * d, -0.5, Math.sin(a) * d);
    w.rotation.set((r() - 0.5) * 0.5, r() * 6, (r() - 0.5) * 0.5);
    w.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    set.add(w);
  }

  /* Two old statues standing in the dark behind the board, and horned heads
     set on the slab rim. */
  prop(ts, set, "gothic_statue", { size: 7, at: [-11, -1.6, -13], rot: [0, 0.6, 0], tint: "#6a6070" });
  prop(ts, set, "gothic_statue", { size: 7, at: [11, -1.6, -13], rot: [0, -0.6, 0], tint: "#6a6070" });
  prop(ts, set, "bull_head", { size: 1.4, at: [-5.2, -0.45, -4.6], rot: [0, 0.75, 0], tint: "#7a6a6a" });
  prop(ts, set, "bull_head", { size: 1.4, at: [5.2, -0.45, -4.6], rot: [0, -0.75, 0], tint: "#7a6a6a" });

  /* Broken pillars and rocks floating in the void, turning slowly. */
  const floaters = [];
  for (let i = 0; i < 16; i++) {
    const a = r() * Math.PI * 2, d = 14 + r() * 35;
    const geo = r() < 0.5 ? new THREE.CylinderGeometry(0.8 + r(), 1 + r(), 3 + r() * 8, 7) : new THREE.DodecahedronGeometry(1 + r() * 2.5, 0);
    const mesh = new THREE.Mesh(geo, stone);
    mesh.position.set(Math.cos(a) * d, -2 + r() * 14, Math.sin(a) * d - 10);
    mesh.rotation.set(r() * 3, r() * 3, r() * 3);
    set.add(mesh);
    floaters.push({ mesh, ph: r() * 6, base: mesh.position.y, spin: (r() - 0.5) * 0.1 });
  }
  /* Chains hanging out of the dark. */
  const link = new THREE.TorusGeometry(0.16, 0.05, 6, 10);
  const linkMat = new THREE.MeshStandardMaterial({ color: "#3a3640", metalness: 0.9, roughness: 0.4 });
  const chains = [];
  for (const [x, z] of [[-9, -6], [10, -4], [-6, -14], [7, -16]]) {
    const chain = new THREE.Group();
    for (let k = 0; k < 40; k++) { const l = new THREE.Mesh(link, linkMat); l.position.y = -k * 0.26; l.rotation.y = k % 2 ? Math.PI / 2 : 0; chain.add(l); }
    chain.position.set(x, 12, z);
    set.add(chain);
    chains.push({ chain, ph: r() * 6 });
  }

  /* The storm: a dark spiral of cloud overhead, and a red moon that
     rises in the second half. */
  const cloudMat = new THREE.SpriteMaterial({ map: softDot(), color: "#2a2236", transparent: true, depthWrite: false, opacity: 0.7 });
  const clouds = Array.from({ length: 26 }, (_, i) => {
    const s = new THREE.Sprite(cloudMat);
    s.scale.setScalar(18 + r() * 20);
    set.add(s);
    return { s, a: (i / 26) * Math.PI * 2, d: 18 + r() * 40, h: 22 + r() * 10 };
  });
  const moon = new THREE.Group();
  moon.add(new THREE.Mesh(new THREE.CircleGeometry(7, 32), new THREE.MeshBasicMaterial({ color: "#c41a1a", fog: false })));
  const moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: "#ff2a1a", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.6, fog: false }));
  moonGlow.scale.setScalar(36);
  moon.add(moonGlow);
  moon.position.set(-18, -20, -90);
  moon.lookAt(0, 0, 0);
  moon.visible = false; // hidden until it starts to rise
  set.add(moon);

  /* Ash and sparks blowing past. */
  const N = 900, pos = new Float32Array(N * 3), specks = [];
  for (let i = 0; i < N; i++) specks.push({ x: (r() - 0.5) * 40, y: r() * 14 - 2, z: (r() - 0.5) * 40 - 4, sp: 0.5 + r() * 1.5 });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const ash = new THREE.Points(geo, new THREE.PointsMaterial({ map: softDot(), color: "#9a8aa8", size: 0.09, transparent: true, depthWrite: false, opacity: 0.6 }));
  ash.frustumCulled = false;
  set.add(ash);

  /* Lightning: bolts live a moment each. */
  const bolts = [];
  const zap = (from, to, opts) => { bolts.push(strike(scene, from, to, opts)); playSound("zap", { volume: 0.7 }); playSound("crack", { volume: 0.5, delay: 0.05 }); };
  let nextBolt = 2;

  const castAll = () => {
    for (const e of ts.pieces.values()) {
      if (e.casts) continue;
      e.model.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      e.casts = true;
    }
  };

  setFlies(false);
  setWind(true, 0.45);

  let t = 0, intense = false, moonUp = 0, demon = null;
  const ensureDemon = () => (demon ??= buildDemon(ts, (from, to) => zap(from, to, { width: 0.08, flash: 80 })));
  ensureDemon();
  return {
    update(dt) {
      t += dt;
      top.emissiveIntensity = 1.1 + 0.4 * Math.sin(t * 1.7) + (intense ? 0.5 : 0);
      runeLight.intensity = 8 + 3 * Math.sin(t * 1.7);
      for (const f of floaters) { f.mesh.position.y = f.base + Math.sin(t * 0.4 + f.ph) * 0.6; f.mesh.rotation.y += dt * f.spin; }
      for (const c of chains) c.chain.rotation.z = Math.sin(t * 0.6 + c.ph) * 0.04;
      for (const c of clouds) { const a = c.a + t * (intense ? 0.05 : 0.02); c.s.position.set(Math.cos(a) * c.d, c.h, Math.sin(a) * c.d - 10); }
      moonUp += ((intense ? 1 : 0) - moonUp) * Math.min(1, dt * 0.4);
      moon.position.y = -20 + moonUp * 34;
      moon.visible = moonUp > 0.02;
      for (let i = 0; i < N; i++) {
        const f = specks[i];
        f.x += dt * (1.8 + (intense ? 2.5 : 0)) * f.sp;
        f.y += dt * 0.2 * f.sp;
        if (f.x > 20) f.x -= 40;
        if (f.y > 12) f.y -= 14;
        pos[i * 3] = f.x; pos[i * 3 + 1] = f.y; pos[i * 3 + 2] = f.z;
      }
      geo.attributes.position.needsUpdate = true;
      /* Lightning in the distance, more often in the storm. */
      nextBolt -= dt;
      if (nextBolt < 0) {
        nextBolt = intense ? 1.5 + Math.random() * 3 : 4 + Math.random() * 6;
        const a = Math.random() * Math.PI * 2, d = 18 + Math.random() * 30;
        const to = new THREE.Vector3(Math.cos(a) * d, -3, Math.sin(a) * d - 12);
        zap(to.clone().add(new THREE.Vector3((Math.random() - 0.5) * 8, 34, 0)), to, { width: 0.12, flash: 120, life: 0.4 });
      }
      for (let i = bolts.length - 1; i >= 0; i--) if (!bolts[i](dt)) bolts.splice(i, 1);
      demon?.update(dt);
      castAll();
    },
    setSnow() {},
    /** The realm's second half: the red moon rises and the storm breaks. */
    setIntense(on) {
      if (on === intense) return;
      intense = on;
      skyMood(scene, on ? SKY_RAGE : SKY, on ? 0.2 : 0.3);
      setWind(true, on ? 0.8 : 0.45);
      ts.setLook?.(on ? RAGE_LOOK : LOOK);
      ts.wake?.();
    },
    get monster() { return ensureDemon(); },
    setBoss(level) { ensureDemon().setRise(level); },
    omenView: [[-2, 3, 9.5], [-6, 7, -40]],
    bossView: [[0, 3.4, 11], [0, 5.4, -8]],
    /** The realm's sixth floor: lightning strikes all round the board, the
     *  red moon rises, and the demon raises his weapons and comes closer. */
    async omen() {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const to = new THREE.Vector3(Math.cos(a) * 7.5, -0.5, Math.sin(a) * 7.5);
        zap(to.clone().add(new THREE.Vector3(0, 30, 0)), to, { width: 0.1, flash: 100 });
        await new Promise((res) => setTimeout(res, 180));
      }
      this.setIntense(true);
      await ensureDemon().roar();
      ensureDemon().setRise(1);
      await new Promise((res) => setTimeout(res, 1600));
    },
    dispose() {
      setWind(false);
      setFlies(true);
      demon?.dispose();
    },
  };
}
