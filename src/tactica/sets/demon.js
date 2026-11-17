/* The last boss: the demon. Tall and armoured in black, a crown of horns,
   red eyes in a face that is mostly shadow, a torn cape, and four arms: a
   greatsword, a spear, a great axe, and an empty hand that holds
   lightning. Far off at first, lit only when the lightning strikes; nearer
   in the realm's second half; on the last floor he stands over the board.
   His empty hand moves the enemy's pieces; a wrong move brings one of his
   weapons down, with lightning. Beaten, he breaks apart into ash.

   Same controls as the other bosses: update(dt), setRise(0|1|2), reach,
   carry, rest, slam, roar, melt, finish(points). `zap(from, to)` comes from
   the realm, so his lightning and the sky's share one look. */
import * as THREE from "three";
import { play as playSound } from "../sound.js";
import { dress } from "./art.js";

const ease = (t) => t * t * (3 - 2 * t);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const SPOTS = [
  { pos: new THREE.Vector3(-12, -1, -58), scale: 2.6 },
  { pos: new THREE.Vector3(8, -1, -30), scale: 2.0 },
  { pos: new THREE.Vector3(0, -2.2, -11.5), scale: 1.45 },
];

export function buildDemon(ts, zap) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  /* Battered black plate (photographed worn steel, darkened): rough
     enough that the purple light catches the dents rather than mirroring. */
  const armor = new THREE.MeshStandardMaterial({ color: "#16131a", roughness: 0.6, metalness: 0.7 });
  const armorEdge = new THREE.MeshStandardMaterial({ color: "#3a2f3c", roughness: 0.45, metalness: 0.8 });
  dress(armor, "demon", "armor", { repeat: 1, tint: "#3a343e", normal: 1.4 });
  dress(armorEdge, "demon", "armor", { repeat: 0.6, tint: "#6a5c6a", normal: 1.2 });
  const dot = document.createElement("canvas");
  dot.width = dot.height = 64;
  const dg = dot.getContext("2d"), grad = dg.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)"); grad.addColorStop(1, "rgba(255,255,255,0)");
  dg.fillStyle = grad; dg.fillRect(0, 0, 64, 64);
  const dotMap = new THREE.CanvasTexture(dot);
  const glow = (color, size, opacity) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotMap, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false })); sp.scale.setScalar(size); return sp; };
  const flesh = new THREE.MeshStandardMaterial({ color: "#2a1a22", roughness: 0.8 });
  const glowRed = new THREE.MeshBasicMaterial({ color: "#ff2a2a" });
  const steel = new THREE.MeshStandardMaterial({ color: "#b8c0cc", roughness: 0.22, metalness: 1 });
  const darkSteel = new THREE.MeshStandardMaterial({ color: "#4a4652", roughness: 0.3, metalness: 1 });
  const handle = new THREE.MeshStandardMaterial({ color: "#2a1a12", roughness: 0.8 });
  const cloth = new THREE.MeshStandardMaterial({ color: "#1a0c12", roughness: 0.95, side: THREE.DoubleSide });
  const m = (geo, mat, x, y, z, sx = 1, sy = 1, sz = 1) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = true; return o; };
  const box = new THREE.BoxGeometry(1, 1, 1), ball = new THREE.SphereGeometry(1, 16, 12), oct = new THREE.OctahedronGeometry(1, 0);

  /* Legs and hips, mostly hidden behind the board when he stands close. */
  for (const s of [-1, 1]) {
    body.add(m(box, armor, s * 0.55, 1.1, 0, 0.55, 2.2, 0.6));
    body.add(m(oct, armorEdge, s * 0.55, 2.15, 0.2, 0.4, 0.4, 0.4));
  }
  body.add(m(box, armor, 0, 2.5, 0, 1.6, 0.6, 0.9));
  /* Torso: a breastplate wider at the top, ribs of armour. */
  const torso = new THREE.Group();
  torso.position.y = 3.1;
  body.add(torso);
  torso.add(m(new THREE.CylinderGeometry(1.25, 0.8, 2.4, 14), armor, 0, 1.2, 0));
  for (let i = 0; i < 4; i++) torso.add(m(box, armorEdge, 0, 0.5 + i * 0.45, 0.72, 1.4 - i * 0.1, 0.08, 0.15));
  const heart = m(oct, glowRed, 0, 1.55, 0.86, 0.18, 0.26, 0.1);
  const heartGlow = glow("#ff2a1a", 1.1, 0.7);
  heartGlow.position.set(0, 1.55, 1.0);
  torso.add(heart, heartGlow);
  /* Pauldrons with spikes. */
  for (const s of [-1, 1]) {
    torso.add(m(ball, armor, s * 1.35, 2.25, 0, 0.75, 0.55, 0.7));
    for (let k = 0; k < 3; k++) torso.add(m(new THREE.ConeGeometry(0.12, 0.7, 5), armorEdge, s * (1.2 + k * 0.25), 2.75 + (k === 1 ? 0.15 : 0), -0.1));
  }
  /* The head: a helm with a slit, red eyes, a crown of horns. */
  const head = new THREE.Group();
  head.position.set(0, 2.85, 0.1);
  torso.add(head);
  head.add(m(new THREE.CylinderGeometry(0.42, 0.5, 0.95, 8), armor, 0, 0.3, 0));
  /* A face of shadow behind the visor: two burning slits slanted in rage,
     a jaw guard of fangs below. */
  head.add(m(box, flesh, 0, 0.3, 0.4, 0.66, 0.34, 0.1));
  const eyes = [-1, 1].map((s) => {
    const e = m(box, glowRed, s * 0.17, 0.36, 0.46, 0.2, 0.05, 0.03);
    e.rotation.z = s * 0.4;
    head.add(e);
    return e;
  });
  const eyeGlow = [-1, 1].map((s) => { const g = glow("#ff2010", 0.45, 0.8); g.position.set(s * 0.17, 0.36, 0.55); head.add(g); return g; });
  head.add(m(box, armorEdge, 0, 0.47, 0.47, 0.7, 0.06, 0.08)); // brow of the visor
  for (let i = 0; i < 6; i++) { const fang = m(new THREE.ConeGeometry(0.035, 0.16, 4), armorEdge, -0.22 + i * 0.088, 0.14, 0.47); fang.rotation.x = Math.PI; head.add(fang); }
  for (let k = 0; k < 7; k++) {
    const a = (k / 6) * Math.PI - Math.PI / 2, horn = m(new THREE.ConeGeometry(0.08, 0.6 + (k === 3 ? 0.5 : Math.abs(3 - k) * 0.12), 5), armorEdge, Math.sin(a) * 0.4, 0.95, Math.cos(a) * 0.08 - 0.05);
    horn.rotation.z = -Math.sin(a) * 0.5;
    head.add(horn);
  }
  for (const s of [-1, 1]) { const big = m(new THREE.ConeGeometry(0.16, 1.4, 6), armorEdge, s * 0.55, 0.85, -0.1); big.rotation.z = -s * 0.9; big.rotation.x = -0.3; head.add(big); }
  /* The cape: strips that sway, torn at the bottom. */
  const cape = [];
  for (let i = 0; i < 9; i++) {
    const strip = m(new THREE.PlaneGeometry(0.36, 4.5 - (i % 3) * 0.6), cloth, (i - 4) * 0.3, -0.1, -0.7);
    strip.geometry.translate(0, -(4.5 - (i % 3) * 0.6) / 2, 0);
    strip.position.y = 2.4;
    torso.add(strip);
    cape.push({ strip, ph: i * 0.7 });
  }

  /* Weapons, each built along its own +Y with the grip at 0. */
  const sword = new THREE.Group();
  sword.add(m(box, handle, 0, 0, 0, 0.12, 0.7, 0.12), m(box, darkSteel, 0, 0.4, 0, 0.7, 0.1, 0.18), m(new THREE.BoxGeometry(0.28, 3.2, 0.05), steel, 0, 2.05, 0));
  const spear = new THREE.Group();
  spear.add(m(new THREE.CylinderGeometry(0.06, 0.06, 4.6, 6), handle, 0, 1.2, 0), m(new THREE.ConeGeometry(0.18, 0.9, 4), steel, 0, 3.9, 0));
  const axe = new THREE.Group();
  axe.add(m(new THREE.CylinderGeometry(0.08, 0.08, 3.2, 6), handle, 0, 0.9, 0));
  const blade = new THREE.Shape();
  blade.moveTo(0, 0); blade.quadraticCurveTo(1.0, -0.2, 1.1, -0.9); blade.quadraticCurveTo(0.6, -0.6, 0, -0.5); blade.closePath();
  const head2 = m(new THREE.ExtrudeGeometry(blade, { depth: 0.08, bevelEnabled: false }), steel, 0.05, 2.65, -0.04);
  axe.add(head2, m(new THREE.ExtrudeGeometry(blade, { depth: 0.08, bevelEnabled: false }), steel, -0.05, 2.65, 0.04).rotateY(Math.PI));
  /* The lightning hand: a glowing orb of sparks. */
  const orb = new THREE.Group();
  const orbCore = m(ball, new THREE.MeshBasicMaterial({ color: "#c8ecff" }), 0, 0.2, 0, 0.22, 0.22, 0.22);
  orb.add(orbCore);
  const orbHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotMap, color: "#6fc6ff", transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
  orbHalo.scale.setScalar(1.2);
  orbHalo.position.y = 0.2;
  orb.add(orbHalo);

  /* Four arms: upper pair (sword, axe), lower pair (spear, lightning). */
  const armGeo = new THREE.CylinderGeometry(0.22, 0.17, 1, 6);
  const ARMS = [
    { name: "sword", side: -1, shoulder: [-1.45, 2.05, 0], rest: [-2.6, 1.3, 1.4], tool: sword, aim: [0.4, 1, 0.4] },
    { name: "axe", side: 1, shoulder: [1.45, 2.05, 0], rest: [2.7, 1.6, 1.2], tool: axe, aim: [-0.3, 1, 0.2] },
    { name: "spear", side: -1, shoulder: [-1.05, 1.1, 0.2], rest: [-2.0, -0.2, 1.6], tool: spear, aim: [0.2, 1, 0.9] },
    { name: "hand", side: 1, shoulder: [1.05, 1.1, 0.2], rest: [1.9, 0.0, 1.7], tool: orb, aim: [0, 1, 0] },
  ];
  const arms = ARMS.map((a) => {
    const mesh = m(armGeo, armor, 0, 0, 0);
    const grip = new THREE.Group();
    grip.add(m(ball, armorEdge, 0, 0, 0, 0.26, 0.26, 0.26), a.tool);
    torso.add(mesh, grip);
    return { ...a, mesh, grip, shoulderV: new THREE.Vector3(...a.shoulder), restV: new THREE.Vector3(...a.rest), at: new THREE.Vector3(...a.rest), goal: null, speed: 6, swing: 0 };
  });

  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  root.position.copy(SPOTS[0].pos);
  root.scale.setScalar(SPOTS[0].scale);
  ts.scene.add(root);

  let t = 0, stage = 0, move = null, rage = 0, rageGoal = 0, breaking = 0;
  const shards = [];
  const tmp = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const armBy = (name) => arms.find((a) => a.name === name);
  const toolTip = (a) => a.grip.localToWorld(new THREE.Vector3(0, a.name === "hand" ? 0.2 : 3.5, 0));

  return {
    update(dt) {
      t += dt;
      if (move) {
        move.k = Math.min(1, move.k + (dt * 1000) / move.ms);
        const k = ease(move.k);
        root.position.lerpVectors(move.from, move.to.pos, k);
        root.scale.setScalar(move.fromScale + (move.to.scale - move.fromScale) * k);
        if (move.k >= 1) move = null;
      }
      rage += (rageGoal - rage) * Math.min(1, dt * 5);
      body.position.y = Math.sin(t * 0.8) * 0.06;
      torso.rotation.x = 0.12 + Math.sin(t * 0.8) * 0.02 - rage * 0.15;
      head.rotation.y = Math.sin(t * 0.33) * 0.25;
      head.rotation.x = 0.15 - rage * 0.3;
      const beat = 1 + 0.15 * Math.sin(t * 4) + rage * 0.4;
      heart.scale.set(0.18 * beat, 0.26 * beat, 0.1);
      heartGlow.material.opacity = 0.45 + 0.25 * Math.sin(t * 4) + rage * 0.3;
      for (const e of eyes) e.scale.y = 0.05 * (1 + rage * 0.8);
      for (const g of eyeGlow) g.material.opacity = 0.6 + rage * 0.4 + 0.15 * Math.sin(t * 9);
      for (const c of cape) c.strip.rotation.x = 0.15 + Math.sin(t * 1.3 + c.ph) * 0.12 + rage * 0.3;
      orbHalo.scale.setScalar(1.0 + 0.3 * Math.sin(t * 23) * Math.sin(t * 9) + rage * 0.6);
      for (const a of arms) {
        const goalLocal = a.goal ? torso.worldToLocal(tmp.copy(a.goal)) : a.restV.clone().add(new THREE.Vector3(0, Math.sin(t * 1.1 + a.shoulder[0]) * 0.12, 0));
        a.at.lerp(goalLocal, Math.min(1, dt * a.speed));
        const len = a.shoulderV.distanceTo(a.at);
        a.mesh.position.copy(a.shoulderV).add(a.at).multiplyScalar(0.5);
        a.mesh.scale.set(1, Math.max(0.2, len), 1);
        a.mesh.quaternion.setFromUnitVectors(up, a.at.clone().sub(a.shoulderV).normalize());
        a.grip.position.copy(a.at);
        /* Weapons point up and out at rest, along the swing when striking. */
        const aim = new THREE.Vector3(...a.aim).normalize();
        if (a.swing) aim.lerp(a.at.clone().sub(a.shoulderV).normalize(), a.swing);
        a.grip.quaternion.setFromUnitVectors(up, aim.normalize());
      }
      /* Breaking apart: plates of armour flying off as ash. */
      if (breaking) {
        for (const s of shards) { s.mesh.position.addScaledVector(s.v, dt); s.v.y -= dt * 2; s.mesh.rotation.x += dt * s.spin; s.mesh.material.opacity = Math.max(0, 1 - breaking); }
      }
      ts.wake?.();
    },
    setRise(level) {
      if (level === stage && !move) return;
      stage = level;
      root.visible = true;
      body.visible = true;
      breaking = 0;
      move = { from: root.position.clone(), fromScale: root.scale.x, to: SPOTS[level], k: 0, ms: 1600 + root.position.distanceTo(SPOTS[level].pos) * 50 };
      ts.wake?.();
    },
    get risen() { return stage === 2; },
    /** His empty hand reaches over the board. */
    async reach(point) {
      const a = armBy("hand");
      a.speed = 7;
      a.goal = point.clone().setY(point.y + 1.0);
      playSound("zap", { volume: 0.25 });
      await wait(380);
      return a;
    },
    carry(a, point, ms) {
      const from = a.goal.clone(), to = point.clone().setY(point.y + 1.0);
      return new Promise((resolve) => ts.tween(ms, (k) => { a.goal = from.clone().lerp(to, ease(k)); a.goal.y += Math.sin(k * Math.PI) * 0.5; }, resolve));
    },
    rest() { for (const a of arms) { a.goal = null; a.speed = 5; a.swing = 0; } },
    /** One of his weapons comes down on `point`, with lightning. */
    async slam(point) {
      const a = arms[Math.floor(Math.random() * 3)];
      rageGoal = 1;
      a.speed = 6;
      a.swing = 1;
      a.goal = point.clone().add(new THREE.Vector3(0, 4.5, -1.5));
      playSound("draw", { volume: 0.8 });
      await wait(420);
      a.speed = 22;
      a.goal = point.clone().add(new THREE.Vector3(0, 1.4, -0.6));
      await wait(120);
      playSound(a.name === "axe" ? "chop" : a.name === "spear" ? "metal" : "slice", { volume: 1 });
      playSound("punchHeavy", { volume: 0.9 });
      zap(toolTip(a), point.clone());
      ts.shake = 0.24;
      ts.tween(520, (k) => { ts.shake = 0.24 * (1 - k); }, () => { ts.shake = 0; });
      await wait(300);
      rageGoal = 0;
      a.goal = null;
      a.swing = 0;
      a.speed = 5;
    },
    /** He raises all four arms and the lightning answers. */
    async roar() {
      rageGoal = 1;
      playSound("rumble", { volume: 1 });
      playSound("whoom", { volume: 0.9 });
      for (const a of arms) { a.speed = 4; a.goal = torso.localToWorld(new THREE.Vector3(a.side * 3, a.shoulder[1] + 2.4, 0.8)); }
      await wait(600);
      for (let i = 0; i < 3; i++) {
        const from = toolTip(arms[i % 4]);
        zap(from.clone().add(new THREE.Vector3(0, 30, 0)), from);
        await wait(260);
      }
      ts.shake = 0.14;
      ts.tween(500, (k) => { ts.shake = 0.14 * (1 - k); }, () => { ts.shake = 0; });
      await wait(500);
      rageGoal = 0;
      for (const a of arms) a.goal = null;
      await wait(300);
    },
    /** Beaten: his armour breaks apart and he blows away as ash. */
    async melt() {
      playSound("crack", { volume: 1 });
      playSound("shimmer", { volume: 0.9, delay: 0.4 });
      const wp = new THREE.Vector3();
      torso.traverse((o) => {
        if (!o.isMesh || shards.length > 40) return;
        o.getWorldPosition(wp);
        const mesh = new THREE.Mesh(o.geometry, new THREE.MeshStandardMaterial({ color: "#1c1820", transparent: true, roughness: 0.6 }));
        mesh.position.copy(wp);
        mesh.scale.copy(o.getWorldScale(new THREE.Vector3()));
        ts.scene.add(mesh);
        shards.push({ mesh, v: new THREE.Vector3((Math.random() - 0.5) * 6, 2 + Math.random() * 4, (Math.random() - 0.5) * 6), spin: (Math.random() - 0.5) * 6 });
      });
      body.visible = false;
      await new Promise((resolve) => ts.tween(2000, (k) => { breaking = k; }, resolve));
      for (const s of shards) ts.scene.remove(s.mesh);
      shards.length = 0;
      root.visible = false;
      await wait(300);
    },
    /** You lost: his weapons come down on your pieces, lightning with each. */
    async finish(points) {
      for (const p of points.slice(0, 5)) await this.slam(p);
      await this.roar();
    },
    dispose() { for (const s of shards) ts.scene.remove(s.mesh); ts.scene.remove(root); },
  };
}
