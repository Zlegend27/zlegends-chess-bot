/* World 3, the volcano: the board stands on a slab of black rock over a sea
   of lava. The lava moves, its light comes up from below, embers rise past
   the board, ash drifts down, and the volcano itself smokes and glows on
   the horizon. In the second half it erupts: the lava runs brighter, ash
   thickens, the rock shakes now and then, and the fire dragon flies closer.

   dressVolcano(tacticaScene) returns the same controls as the other worlds:
     update(dt), setSnow(), setIntense(on), setBoss(level), monster, omen(),
     omenView, bossView, dispose(). */
import * as THREE from "three";
import { setFlies, setWind, play as playSound } from "../sound.js";
import { buildFireDragon } from "./fireDragon.js";
import { dress, sky, skyMood, art, prop } from "./art.js";
import { buildLandform } from "./landform.js";

function rng(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}


/* Black rock with glowing seams, for the slab's top. */
function rockTextures() {
  const make = (glow) => {
    const c = document.createElement("canvas");
    c.width = c.height = 512;
    const g = c.getContext("2d");
    g.fillStyle = glow ? "#000" : "#2a201c"; g.fillRect(0, 0, 512, 512);
    const r = rng(glow ? 9 : 4);
    if (!glow) for (let i = 0; i < 260; i++) { g.fillStyle = r() < 0.5 ? "rgba(0,0,0,0.35)" : "rgba(90,70,60,0.25)"; g.beginPath(); g.arc(r() * 512, r() * 512, 2 + r() * 14, 0, Math.PI * 2); g.fill(); }
    g.lineCap = "round";
    const r2 = rng(21);
    for (let k = 0; k < 12; k++) {
      let x = r2() * 512, y = r2() * 512;
      g.strokeStyle = glow ? (r2() < 0.5 ? "#ff7a1a" : "#ffb03a") : "#120c0a";
      g.lineWidth = 2 + r2() * 3;
      g.beginPath(); g.moveTo(x, y);
      for (let i = 0; i < 8; i++) { x += (r2() - 0.5) * 70; y += (r2() - 0.5) * 70; g.lineTo(x, y); }
      g.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  return { map: make(false), glow: make(true) };
}

/* Lava: slow-moving bright flows under a darker cooling crust. */
/* The photographed lava, made to flow: a second, larger copy of it turned
   and drifting the other way breaks up the repeat, and slow waves of heat
   run across it, so the crust darkens and the flows brighten in turn. */
function flowingLava(map, glow, time) {
  const m = new THREE.MeshStandardMaterial({ map, emissiveMap: glow, emissive: "#ffffff", emissiveIntensity: 1.1, roughness: 0.85 });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    const second = (uv) => `(mat2(0.8, -0.6, 0.6, 0.8) * (${uv} * 0.37) + vec2(uTime * -0.003, uTime * 0.002))`;
    shader.fragmentShader = "uniform float uTime;\n" + shader.fragmentShader
      .replace("#include <map_fragment>", `#ifdef USE_MAP
        vec4 lavaA = texture2D(map, vMapUv);
        vec4 lavaB = texture2D(map, ${second("vMapUv")});
        diffuseColor *= mix(lavaA, lavaB, 0.45);
      #endif`)
      .replace("#include <emissivemap_fragment>", `#ifdef USE_EMISSIVEMAP
        vec3 hotA = texture2D(emissiveMap, vEmissiveMapUv).rgb;
        vec3 hotB = texture2D(emissiveMap, ${second("vEmissiveMapUv")}).rgb;
        float heatWave = 0.72 + 0.38 * sin(vEmissiveMapUv.x * 0.31 + uTime * 0.45) * sin(vEmissiveMapUv.y * 0.23 - uTime * 0.33);
        totalEmissiveRadiance *= max(hotA, hotB * 0.95) * heatWave;
      #endif`);
  };
  return m;
}

const LAVA_SHADER = {
  uniforms: { time: { value: 0 }, heat: { value: 1 } },
  vertexShader: `varying vec2 vUv; varying vec3 vPos;
    void main() { vUv = uv; vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform float time; uniform float heat; varying vec2 vUv; varying vec3 vPos;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y); }
    float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
    void main() {
      vec2 p = vPos.xy * 0.09;
      float flow = fbm(p + vec2(time * 0.03, time * 0.05) + fbm(p * 1.7 - time * 0.04));
      float crust = smoothstep(0.36, 0.5, flow);
      vec3 hot = mix(vec3(0.85, 0.22, 0.02), vec3(1.0, 0.66, 0.18), smoothstep(0.12, 0.0, abs(flow - 0.33)));
      vec3 col = mix(hot * (0.75 + 0.35 * heat), vec3(0.06, 0.03, 0.025), crust);
      float far = clamp(length(vPos.xy) / 120.0, 0.0, 1.0);
      col = mix(col, vec3(0.16, 0.04, 0.02), far * 0.85);
      gl_FragColor = vec4(col, 1.0);
    }`,
};

const USE_LAVA_SCAN = false;

export function dressVolcano(ts) {
  const scene = ts.scene;
  const SKY = "#2a0e08", SKY_ERUPT = "#3c1006";
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.FogExp2("#2c0f08", 0.022);
  /* A real sunset, dimmed to a burning sky. */
  sky(ts, "volcano", { background: true, intensity: 0.32, blur: 0.02 });
  scene.environmentIntensity = 0.3;
  scene.traverse((o) => {
    if (o.isHemisphereLight) { o.intensity = 0.45; o.color.set("#ff9a5a"); o.groundColor.set("#ff4a10"); }
    else if (o.isDirectionalLight) { o.intensity *= 0.3; o.color.set("#ffb58a"); }
  });
  ts.renderer.shadowMap.enabled = true;
  ts.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  ts.renderer.toneMappingExposure = 0.85;
  for (const tile of ts.tiles) tile.receiveShadow = true;
  /* The lava lights everything from below and the sides. */
  const glows = [[-7, -1.2, 3], [7, -1.2, 3], [0, -1.2, -7.5]].map(([x, y, z]) => {
    const l = new THREE.PointLight("#ff6a1a", 12, 12, 1.8);
    l.position.set(x, y, z);
    scene.add(l);
    return l;
  });
  const key = new THREE.DirectionalLight("#ffcfa8", 1.0);
  key.position.set(5, 11, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 2, far: 30 });
  key.shadow.bias = -0.0006;
  key.shadow.normalBias = 0.02;
  scene.add(key, key.target);
  /* The dark pieces were hard to make out against the black rock (the
     creator, 2026-11-17): a soft fill from the camera's side lights their
     faces, and a rim from beyond the board traces their outline. No
     shadows, so they cost little. */
  const fill = new THREE.DirectionalLight("#ffe2cc", 0.7);
  fill.position.set(0, 6, 11);
  const rim = new THREE.DirectionalLight("#ffc9a0", 1.1);
  rim.position.set(-2, 5, -11);
  scene.add(fill, fill.target, rim, rim.target);
  scene.environmentIntensity = 0.45;
  const LOOK = { glow: 0.32, glowFrom: 1.05, vignette: 0.62, tint: "#ffe6d6" };
  const ERUPT_LOOK = { glow: 0.42, glowFrom: 1.0, vignette: 0.74, tint: "#ffd9c6" };
  ts.setLook?.(LOOK);

  const set = new THREE.Group();
  scene.add(set);
  const r = rng(61);

  /* The slab the board stands on. */
  const tex = rockTextures();
  const slabTop = new THREE.MeshStandardMaterial({ map: tex.map, roughness: 0.95, emissive: "#ff6a1a", emissiveMap: tex.glow, emissiveIntensity: 1.2 });
  const slabSide = new THREE.MeshStandardMaterial({ color: "#1b1310", roughness: 1, emissive: "#ff4a10", emissiveMap: tex.glow, emissiveIntensity: 0.6 });
  /* Its textures are mapped in world units here (landform.js), so one
     repeat is one tile of rock. */
  dress(slabTop, "volcano", "ground", { repeat: 1, tint: "#9a8a82", normal: 1.4 });
  dress(slabSide, "volcano", "rock", { maps: ["diff", "nor"], repeat: 1, tint: "#6a5a54", normal: 1.6 });
  /* A lump of black rock: flat under the board, broken toward its edge, a
     ledged cliff dropping into the lava. */
  const slab = buildLandform({ radius: 7.3, flat: 5.3, depth: 2.6, bumps: 0.45, flare: 0.3, seed: 5, texScale: 3.5, topMaterial: slabTop, sideMaterial: slabSide });
  slab.position.y = -0.11;
  set.add(slab);
  /* Jagged rocks round its edge. */
  const rockMat = new THREE.MeshStandardMaterial({ color: "#1e1512", roughness: 1, flatShading: true });
  dress(rockMat, "volcano", "rock", { maps: ["diff", "nor"], repeat: 1.5, tint: "#5a4a44", normal: 1.5 });
  const lump = new THREE.DodecahedronGeometry(1, 0);
  /* Photographed rocks (scorched dark) between plain lumps, kept light for phones. */
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + r() * 0.3, d = 6.5 + r() * 0.9;
    prop(ts, set, i % 3 ? "moon_rock_02" : "moon_rock_03", { size: 1.1 + r() * 0.9, at: [Math.cos(a) * d, -0.45, Math.sin(a) * d], rot: [0, r() * 6, 0], tint: "#6a5650", sink: 0.2 });
  }
  /* Cooled pahoehoe flows (a scan of real Hawaiian lava): ropy black crust
     spilling off the rock into the lava sea, between the boulders. */
  /* Off until its credit is settled (CC BY-NC: it must be credited); the
     model file is kept out of the repo until then. */
  if (USE_LAVA_SCAN) for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.4 + r() * 0.3, d = 8.6 + r() * 1.4;
    prop(ts, set, "lava_flow/lava_flow.glb", { size: 3.4 + r() * 1.6, at: [Math.cos(a) * d, -2.75, Math.sin(a) * d], rot: [0, a + Math.PI / 2 + (r() - 0.5) * 0.6, 0], tint: "#9a8580", sink: 0.35 });
  }
  /* Boulders sticking out of the lava, near enough to see their surface. */
  for (const [x, z, sz] of [[-11, -9, 4.5], [12, -12, 5.5], [-15, 3, 3.6], [15, 2, 4], [3, -17, 6]]) {
    prop(ts, set, "moon_rock_01", { size: sz, at: [x, -2.7, z], rot: [0, x * 0.7, 0], tint: "#5a4640", sink: 0.1 });
  }
  for (let i = 0; i < 14; i++) {
    const a = r() * Math.PI * 2, d = 6.4 + r() * 1.2, m = new THREE.Mesh(lump, rockMat);
    m.position.set(Math.cos(a) * d, -0.5 + r() * 0.2, Math.sin(a) * d);
    m.scale.set(0.3 + r() * 0.5, 0.25 + r() * 0.7, 0.3 + r() * 0.5);
    m.rotation.set(r() * 3, r() * 3, r() * 3);
    m.castShadow = m.receiveShadow = true;
    set.add(m);
  }

  /* The lava sea. */
  const lavaMat = new THREE.ShaderMaterial(LAVA_SHADER);
  const lava = new THREE.Mesh(new THREE.CircleGeometry(150, 80), lavaMat);
  /* Once the photographed lava has loaded it replaces the drawn one. */
  let lavaMaps = null;
  const lavaTime = { value: 0 };
  Promise.all([art("volcano", "lava_diff", 40), art("volcano", "lava_glow", 40, true)]).then(([map, glow]) => {
    if (!map || !glow) return;
    lavaMaps = [map, glow];
    lava.material = flowingLava(map, glow, lavaTime);
  });
  lava.rotation.x = -Math.PI / 2;
  lava.position.y = -2.6;
  set.add(lava);

  /* Spires of rock standing out of the lava. */
  for (let i = 0; i < 18; i++) {
    const a = r() * Math.PI * 2, d = 14 + r() * 40, h = 4 + r() * 12;
    const m = new THREE.Mesh(new THREE.ConeGeometry(1 + r() * 2.2, h, 5), rockMat);
    m.position.set(Math.cos(a) * d, h / 2 - 2.6, Math.sin(a) * d - 8);
    m.rotation.y = r() * 6;
    set.add(m);
  }
  /* The volcano on the horizon: a dark cone, a glowing crater, lava down
     its sides, and smoke. */
  const volcano = new THREE.Group();
  volcano.position.set(10, -2.6, -95);
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(9, 48, 46, 9, 1, true), rockMat);
  cone.position.y = 23;
  volcano.add(cone);
  const crater = new THREE.Mesh(new THREE.CircleGeometry(9, 16), new THREE.MeshBasicMaterial({ color: "#ffb040" }));
  crater.rotation.x = -Math.PI / 2;
  crater.position.y = 45.8;
  volcano.add(crater);
  const streamMat = new THREE.MeshBasicMaterial({ color: "#ff6a1a" });
  for (let i = 0; i < 5; i++) {
    const a = -0.6 + i * 0.3, s = new THREE.Mesh(new THREE.BoxGeometry(1.1, 44, 0.4), streamMat);
    s.position.set(Math.sin(a) * 28, 22, Math.cos(a) * 28);
    s.lookAt(0, 22, 0);
    s.rotateX(-0.82);
    volcano.add(s);
  }
  const craterGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: "#ff7a2a", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 }));
  craterGlow.position.y = 48;
  craterGlow.scale.setScalar(40);
  volcano.add(craterGlow);
  set.add(volcano);
  /* Smoke from the crater: big dark puffs rising and drifting. */
  const smokeMat = new THREE.SpriteMaterial({ map: softDot(), color: "#2a1a18", transparent: true, depthWrite: false, opacity: 0.6 });
  const smoke = Array.from({ length: 12 }, (_, i) => { const s = new THREE.Sprite(smokeMat); volcano.add(s); return { s, k: i / 12 }; });

  /* Embers rising, and ash coming down. */
  const embers = particles(900, "#ffae4a", 0.14, THREE.AdditiveBlending, r);
  const ash = particles(1400, "#6a5a56", 0.1, THREE.NormalBlending, r);
  set.add(embers.points, ash.points);

  const castAll = () => {
    for (const e of ts.pieces.values()) {
      if (e.casts) continue;
      e.model.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      e.casts = true;
    }
  };

  setFlies(false);
  setWind(true, 0.35);

  let t = 0, heat = 1, heatGoal = 1, intense = false, quake = 0, giant = null;
  const ensureGiant = () => (giant ??= buildFireDragon(ts));
  ensureGiant();
  return {
    update(dt) {
      t += dt;
      heat += (heatGoal - heat) * Math.min(1, dt * 0.8);
      lavaMat.uniforms.time.value = t;
      lavaMat.uniforms.heat.value = heat;
      if (lavaMaps) { for (const m of lavaMaps) { m.offset.x = t * 0.004; m.offset.y = t * 0.006; } lavaTime.value = t; lava.material.emissiveIntensity = 0.8 + 0.4 * heat + 0.1 * Math.sin(t * 1.3); }
      for (const [i, l] of glows.entries()) l.intensity = (9 + 5 * heat) * (0.85 + 0.15 * Math.sin(t * 2.3 + i * 1.7));
      slabTop.emissiveIntensity = (0.7 + 0.3 * Math.sin(t * 1.3)) * heat;
      craterGlow.material.opacity = 0.6 + 0.3 * Math.sin(t * 2) * heat;
      for (const p of smoke) {
        const k = (p.k + t * 0.02 * heat) % 1;
        p.s.position.set(Math.sin(k * 3 + p.k * 9) * 6 + k * 18, 48 + k * 50, Math.cos(p.k * 9) * 4);
        p.s.scale.setScalar(8 + k * 34);
        p.s.material.opacity = 0.6 * (1 - k);
      }
      embers.step(dt, (f) => { f.y += dt * f.speed * (1 + heat * 0.6); f.x += Math.sin(t + f.ph) * dt * 0.4; if (f.y > 12) f.y -= 13; });
      ash.step(dt, (f) => { f.y -= dt * f.speed * 0.35 * heat; f.x += dt * 0.5; if (f.y < -1) f.y += 13; if (f.x > 20) f.x -= 40; });
      /* Now and then, during the eruption, the rock shakes. */
      if (intense) {
        quake -= dt;
        if (quake < 0) { quake = 5 + Math.random() * 6; playSound("rumble", { volume: 0.6 }); ts.shake = 0.08; ts.tween(900, (k) => { ts.shake = 0.08 * (1 - k); }, () => { ts.shake = 0; }); }
      }
      giant?.update(dt);
      castAll();
    },
    setSnow() {},
    /** The eruption: hotter lava, thicker ash, a darker sky. */
    setIntense(on) {
      if (on === intense) return;
      intense = on;
      quake = 3;
      heatGoal = on ? 1.8 : 1;
      skyMood(scene, on ? SKY_ERUPT : SKY, on ? 0.45 : 0.32);
      scene.fog.density = on ? 0.03 : 0.022;
      ash.points.material.opacity = on ? 0.95 : 0.6;
      setWind(true, on ? 0.6 : 0.35);
      ts.setLook?.(on ? ERUPT_LOOK : LOOK);
      ts.wake?.();
    },
    get monster() { return ensureGiant(); },
    setBoss(level) { ensureGiant().setRise(level); },
    omenView: [[2, 3.2, 9.5], [6, 6, -40]],
    bossView: [[0, 3.2, 10.5], [0, 4.4, -8]],
    /** The volcano's sixth floor: it erupts, the dragon turns and roars, and
     *  starts wading toward the board. */
    async omen() {
      playSound("rumble", { volume: 1 });
      playSound("whoom", { volume: 0.9 });
      this.setIntense(true);
      ts.shake = 0.2;
      await new Promise((res) => ts.tween(1200, (k) => { ts.shake = 0.2 * (1 - k); craterGlow.scale.setScalar(40 + Math.sin(k * Math.PI) * 50); }, () => { ts.shake = 0; res(); }));
      await ensureGiant().roar();
      ensureGiant().setRise(1);
      await new Promise((res) => setTimeout(res, 1800));
    },
    dispose() {
      setWind(false);
      setFlies(true);
      giant?.dispose();
    },
  };
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

/* A cloud of specks in the air around the board; `step` moves each one. */
function particles(n, color, size, blending, r) {
  const pos = new Float32Array(n * 3), list = [];
  for (let i = 0; i < n; i++) list.push({ x: (r() - 0.5) * 40, y: r() * 13 - 1, z: (r() - 0.5) * 40 - 4, speed: 0.6 + r() * 1.6, ph: r() * 6.28 });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({ map: softDot(), color, size, transparent: true, depthWrite: false, blending, opacity: 0.6 }));
  points.frustumCulled = false;
  return {
    points,
    step(dt, move) {
      for (let i = 0; i < n; i++) { const f = list[i]; move(f); pos[i * 3] = f.x; pos[i * 3 + 1] = f.y; pos[i * 3 + 2] = f.z; }
      geo.attributes.position.needsUpdate = true;
    },
  };
}
