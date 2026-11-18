/* The world films: arriving on the icy lake, at the volcano, in the
   demon's realm, and the ending. Each is shot on the run's own scene, in
   the world about to be played, with its real boss; the six heroes from
   the bin are cel-shaded and inked like the opening.

   A film is an async script given `f` (see EntryFilm.jsx):
     f.scene, f.set (the world's scenery, with .monster), f.lend (kit.borrow),
     f.cut / f.glide / f.tween (camera), f.wait(s), f.line(text, s),
     f.impact(heavy), f.fade(to, s), f.speed(on), f.shot(name), f.score(mood),
     f.alive().
   Each checks f.alive() after anything that waits, and stops if not. */
import * as THREE from "three";
import { play as playSound } from "../sound";
import { toonify, outline } from "./anime";
import { buildHand } from "./attic";
import { V, ease, easeOut, castHeroes, stand, abreast, walk, huddle, eyesOf, glowSprite } from "./kit";

const NORTH = V(0, 0, -1);
const steps = (volume = 0.28) => () => playSound("step", { volume });

/** A camera that rides along beside walkers: offset from, and looking at a
 *  point ahead of, the middle of the group, every frame for `ms`. */
function follow(f, heroes, ms, offset, ahead) {
  return f.tween(ms, () => {
    const mid = heroes.reduce((m, e) => m.add(e.group.position), V(0, 0, 0)).multiplyScalar(1 / heroes.length);
    f.scene.goalPos.copy(mid).add(offset);
    f.scene.goalLook.copy(mid).add(ahead);
  });
}

/** Close on one character's face, a little to the side. */
function closeOn(f, e, { dist = 1.7, height = 0.8, side = 0.35, lookY = 0.6 } = {}) {
  const p = e.group.position, h = e.holder.rotation.y;
  const face = V(Math.sin(h), 0, Math.cos(h));
  const right = V(face.z, 0, -face.x);
  f.cut(p.clone().addScaledVector(face, dist).addScaledVector(right, side).setY(p.y + height), p.clone().setY(p.y + lookY));
}

/* ---------------- The icy lake ---------------- */
async function ice(f) {
  const { scene, set } = f;
  const heroes = castHeroes(scene);
  const [pawn] = heroes;
  stand(heroes, abreast(V(0, 0, 2.6), NORTH, 6, 0.9), Math.PI);
  set.setBoss?.(0);
  f.score("wonder");

  f.shot("sky");
  /* 1. Up into the snow falling out of a white sky, then down onto the
     floe and the six of them. */
  f.cut(V(0.4, 0.45, 4.4), V(0, 9, -5));
  playSound("wind", { volume: 0.5 });
  await f.wait(0.8);
  f.glide(V(0, 4.2, 10.5), V(0, 0.4, 0.8), 2.6);
  await f.line("Out of the bin and into the snow.", 3.2);
  if (!f.alive()) return;

  f.shot("march");
  /* 2. Walking: a low tracking shot beside the line. */
  f.cut(V(4.6, 0.8, 4.2), V(0, 0.55, 1.6));
  const going = walk(scene, heroes, NORTH, 3.4, 3400, { sound: steps() });
  follow(f, heroes, 3400, V(4.4, 0.85, 1.9), V(-0.4, 0.5, -1.2));
  await f.wait(0.6);
  await f.line("The pieces had never seen the sky before.", 2.8);
  await going;
  if (!f.alive()) return;

  f.shot("pawn");
  /* 3. The pawn tips its head back and looks up, eyes wide. */
  for (const e of heroes) e.holder.rotation.y = Math.PI;
  closeOn(f, pawn, { dist: 1.55, height: 0.62, side: 0.3, lookY: 0.62 });
  const eyes = eyesOf(pawn);
  playSound("chime", { volume: 0.5 });
  await f.tween(1500, (k) => {
    pawn.holder.rotation.x = 0.32 * ease(Math.min(1, k * 1.6));
    eyes.wide(ease(Math.min(1, k * 2)));
    scene.goalLook.y = 0.62 + 1.4 * ease(k);
  });
  playSound("aww", { volume: 0.35 });
  await f.wait(0.6);
  if (!f.alive()) return;

  f.shot("watching");
  /* 4. Across the water, on his own floe: the bear. A long lens over
     their shoulders. */
  pawn.holder.rotation.x = 0; eyes.wide(0);
  const bear = set.monster;
  const bearAt = V(-9, 1.6, -34);
  f.lend.zoom(0.38);
  f.cut(V(1.6, 1.25, 4.8), bearAt);
  f.glide(V(1.1, 1.15, 3.6), bearAt, 4);
  f.score("dread");
  playSound("heartbeat", { volume: 0.8 });
  playSound("heartbeat", { volume: 0.8, delay: 0.6 });
  await f.wait(1.2);
  const roaring = bear?.roar?.();
  await f.wait(0.5);
  for (const e of heroes) { scene.squash(e, 0.16, 280); }
  await f.tween(300, (k) => { for (const e of heroes) e.group.position.z += 0.012 * (1 - k); });
  await f.line("Across the ice, something was already watching.", 2.8);
  await roaring;
  if (!f.alive()) return;

  f.shot("closer");
  /* 5. They draw together, and the camera rises away into the storm. */
  f.lend.zoom(1);
  f.cut(V(0, 2.6, 5.4), V(0, 0.4, 0));
  const mid = heroes.reduce((m, e) => m.add(e.group.position), V(0, 0, 0)).multiplyScalar(1 / 6);
  huddle(scene, heroes, mid, 0.72, 1100);
  playSound("cloth1", { volume: 0.5 });
  f.glide(V(0, 9.5, 8.5), V(0, 0, -1), 2.2);
  await f.wait(1.6);
  await f.fade(1, 0.9);
}

/* ---------------- The volcano ---------------- */
async function volcano(f) {
  const { scene, set } = f;
  const heroes = castHeroes(scene);
  const knight = heroes[1];
  stand(heroes, abreast(V(0, 0, 2.8), NORTH, 6, 0.9), Math.PI);
  set.setBoss?.(0);
  f.score("sorrow");

  f.shot("ash");
  /* 1. Down through the falling ash onto the slab, the lava glowing round it. */
  f.cut(V(-3, 12, 13), V(0, 0, -2));
  f.glide(V(-1.4, 3.4, 8.6), V(0, 0.4, 0.5), 3);
  await f.line("The snow turned grey, then warm. It wasn't snow any more. It was ash.", 3.8);
  if (!f.alive()) return;

  f.shot("march");
  /* 2. They walk toward the camera, lit from below by the lava. */
  f.cut(V(-1.3, 0.75, -1.8), V(0, 0.6, 2.2));
  const going = walk(scene, heroes, NORTH, 2.6, 2800, { sound: steps() });
  follow(f, heroes, 2800, V(-1.4, 0.75, -3.6), V(0, 0.55, 0.4));
  await going;
  if (!f.alive()) return;

  f.shot("eruption");
  /* 3. Wide, over their heads: the mountain goes up, and out of the smoke
     the dragon turns and comes for them. */
  const dragon = set.monster;
  f.lend.zoom(0.6);
  f.cut(V(-1.5, 2.2, 7), V(16, 12, -60));
  await f.wait(0.6);
  f.score("action");
  set.setIntense?.(true);
  playSound("rumble", { volume: 1 });
  playSound("whoom", { volume: 0.9, delay: 0.1 });
  await f.impact(true);
  scene.shake = 0.18;
  dragon?.setRise?.(2);
  f.glide(V(-1, 1.7, 6.2), V(2, 4.5, -14), 2.6);
  await f.tween(1400, (k) => { scene.shake = 0.18 * (1 - k); });
  scene.shake = 0;
  await f.wait(1.2);
  if (!f.alive()) return;

  f.shot("dragon");
  /* 4. Low among them, looking up: it swoops in over the board and breathes
     fire over their heads. */
  f.lend.zoom(1);
  f.cut(V(1.5, 0.4, 3.6), V(0, 4.6, -8));
  playSound("heartbeat", { volume: 0.9 });
  const line = f.line("Then the mountain woke, and something older than it came out of the fire.", 4.2);
  await f.wait(0.6);
  await dragon?.reach?.(V(0, 0, -5));
  f.speed(true);
  for (const e of heroes) scene.squash(e, 0.2, 320);
  await f.wait(0.35);
  f.speed(false);
  const roaring = dragon?.roar?.();
  await f.tween(500, (k) => { for (const e of heroes) e.group.position.z += 0.01 * (1 - k); });
  await roaring;
  await line;
  dragon?.rest?.();
  if (!f.alive()) return;

  f.shot("knight");
  /* 5. The others shrink back. The knight steps forward and looks up at it. */
  const forward = knight.group.position.clone().add(V(0, 0, -0.55));
  const from = knight.group.position.clone();
  f.tween(500, () => { for (const e of heroes) if (e !== knight) e.group.position.z += 0.006; });
  playSound("metal", { volume: 0.5 });
  await f.tween(420, (k) => { knight.group.position.lerpVectors(from, forward, ease(k)); knight.group.position.y = Math.sin(k * Math.PI) * 0.1; });
  closeOn(f, knight, { dist: 1.9, height: 0.35, side: -0.55, lookY: 0.95 });
  f.glide(knight.group.position.clone().add(V(-0.5, 0.3, -1.5)), knight.group.position.clone().setY(1.0), 3);
  await f.tween(600, (k) => { knight.holder.rotation.x = 0.18 * ease(k); });
  playSound("draw", { volume: 0.7 });
  scene.squash(knight, -0.12, 380);
  await f.line("The knight looked up at it, and didn't step back.", 2.8);
  if (!f.alive()) return;
  knight.holder.rotation.x = 0;
  await f.fade(1, 0.9);
}

/* ---------------- The demon's realm ---------------- */
async function demon(f) {
  const { scene, set } = f;
  const heroes = castHeroes(scene);
  stand(heroes, abreast(V(0, 0, 2.8), NORTH, 6, 0.9), Math.PI);
  set.setBoss?.(0);
  const lord = set.monster;
  f.score("dread");

  f.shot("swords");
  /* 1. Low among the weapons stuck in the ground round the board, the
     lightning showing them up. */
  f.cut(V(5.0, 1.0, 6.0), V(0, 0.5, 0.5));
  f.glide(V(-5.0, 1.1, 5.4), V(0, 0.5, 0), 4.5);
  const going = walk(scene, heroes, NORTH, 2.2, 3600, { sound: steps(0.22) });
  const line = f.line("Past the fire the world went dark. The ground was full of swords, and none of them had an owner any more.", 4.6);
  await f.wait(1.1);
  lord?.slam?.(V(6.4, -0.45, -1.5));
  await f.wait(1.7);
  lord?.slam?.(V(-6.6, -0.45, 2.5));
  await going;
  await line;
  if (!f.alive()) return;

  f.shot("moon");
  /* 2. The red moon comes up behind him; a long lens over their heads. */
  set.setIntense?.(true);
  f.lend.zoom(0.42);
  const lordAt = V(-12, 7, -58);
  f.cut(V(1.2, 1.2, 4.2), lordAt);
  f.glide(V(0.9, 1.1, 3.2), lordAt.clone().add(V(0, 1, 0)), 5);
  playSound("drone", { volume: 0.7 });
  playSound("heartbeat", { volume: 0.8, delay: 0.6 });
  playSound("heartbeat", { volume: 0.9, delay: 1.3 });
  const said = f.line("Under a red moon, the one who had been waiting since the bin turned to face them.", 4.4);
  await f.wait(2.2);
  if (!f.alive()) return;
  await lord?.roar?.();
  await said;
  if (!f.alive()) return;

  f.shot("together");
  /* 3. They draw close; a glow of gold; the camera circles them. */
  f.lend.zoom(1);
  const mid = heroes.reduce((m, e) => m.add(e.group.position), V(0, 0, 0)).multiplyScalar(1 / 6);
  huddle(scene, heroes, mid, 0.7, 1200);
  playSound("cloth2", { volume: 0.6 });
  f.score("wonder");
  /* Warm, out of the moon's red: this moment is theirs. */
  scene.setLook({ tint: "#ffe9d6", glow: 0.4, glowFrom: 0.92, saturation: 1.05 });
  scene.scene.traverse((o) => { if (o.isPointLight) { o.color.set("#ffb46a"); o.intensity *= 0.3; } });
  const orbit = (a) => mid.clone().add(V(Math.sin(a) * 3.4, 1.35, Math.cos(a) * 3.4));
  f.cut(orbit(0.5), mid.clone().setY(0.55));
  const circling = f.tween(4400, (k) => { scene.goalPos.copy(orbit(0.5 + 1.1 * k)); scene.goalLook.copy(mid).setY(0.55); });
  await f.wait(1.3);
  playSound("shimmer", { volume: 0.8 });
  playSound("chime", { volume: 0.6, delay: 0.2 });
  heroes.forEach((e, i) => setTimeout(() => { if (f.alive()) scene.sparks(e.group.position.clone(), "#ffcf6a"); }, i * 90));
  await f.line("The pieces drew close together. Whatever happened next, it would happen to all of them.", 3.4);
  await circling;
  if (!f.alive()) return;
  await f.fade(1, 0.9);
}

/* ---------------- The ending ---------------- */
/* The full set, for the board by the window. */
const START = (() => {
  const back = [4, 2, 3, 5, 6, 3, 2, 4], list = [];
  for (let file = 0; file < 8; file++) {
    list.push({ sq: file, type: back[file], white: true }, { sq: 8 + file, type: 1, white: true });
    list.push({ sq: 56 + file, type: back[file], white: false }, { sq: 48 + file, type: 1, white: false });
  }
  return list;
})();

/** A sky that fades in over the world: blue overhead, gold at the horizon. */
function dawnSky() {
  const geo = new THREE.SphereGeometry(70, 32, 16);
  const top = new THREE.Color("#6f9ed4"), mid = new THREE.Color("#ffc489"), low = new THREE.Color("#4a2a1c");
  const cols = [];
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / 70;
    const c = y > 0.05 ? mid.clone().lerp(top, Math.min(1, (y - 0.05) / 0.5)) : low.clone().lerp(mid, Math.max(0, 1 + y / 0.15));
    cols.push(c.r, c.g, c.b);
  }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, transparent: true, opacity: 0, depthWrite: false, fog: false }));
}

/** A room in the sun: a table, a wall with a window, a shaft of light, dust. */
function sunnyRoom() {
  const room = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: "#8a5a34", roughness: 0.7 });
  const wall = new THREE.MeshStandardMaterial({ color: "#d9c3a2", roughness: 0.95 });
  const table = new THREE.Mesh(new THREE.BoxGeometry(14, 0.5, 11), wood);
  table.position.y = -0.66; table.receiveShadow = true;
  const back = new THREE.Mesh(new THREE.PlaneGeometry(40, 24), wall);
  back.position.set(0, 6, -8);
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(9, 5.4), new THREE.MeshBasicMaterial({ color: "#cfe6fa", fog: false, toneMapped: false }));
  sky.position.set(0, 4.4, -7.95);
  const frameMat = new THREE.MeshStandardMaterial({ color: "#f3ead9", roughness: 0.6 });
  room.add(table, back, sky);
  for (const [w, h, x, y] of [[9.6, 0.35, 0, 7.1], [9.6, 0.5, 0, 1.6], [0.35, 5.8, -4.6, 4.4], [0.35, 5.8, 4.6, 4.4], [0.2, 5.4, 0, 4.4], [9, 0.18, 0, 4.4]]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.3), frameMat);
    bar.position.set(x, y, -7.85);
    room.add(bar);
  }
  const shaftGeo = new THREE.CylinderGeometry(2.6, 4.6, 11, 24, 1, true);
  const shaft = new THREE.Mesh(shaftGeo, new THREE.MeshBasicMaterial({ color: "#ffe2b0", transparent: true, opacity: 0.07, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
  shaft.position.set(0, 3.2, -3.6);
  shaft.rotation.x = -0.95;
  room.add(shaft);
  const N = 160, pos = new Float32Array(N * 3), seeds = [];
  for (let i = 0; i < N; i++) seeds.push([(Math.random() - 0.5) * 7, Math.random() * 5, -6 + Math.random() * 8, Math.random() * 6]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const dust = new THREE.Points(geo, new THREE.PointsMaterial({ color: "#fff3d8", size: 0.05, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
  dust.frustumCulled = false;
  room.add(dust);
  let t = 0;
  room.userData.update = (dt) => {
    t += dt;
    seeds.forEach(([x, y, z, ph], i) => { pos[i * 3] = x + Math.sin(t * 0.3 + ph) * 0.3; pos[i * 3 + 1] = y + Math.sin(t * 0.2 + ph * 2) * 0.3; pos[i * 3 + 2] = z + Math.cos(t * 0.25 + ph) * 0.3; });
    geo.attributes.position.needsUpdate = true;
  };
  return room;
}

async function ending(f) {
  const { scene, set } = f;
  set.setIntense?.(false);
  set.monster?.hide?.();
  const heroes = castHeroes(scene);
  stand(heroes, abreast(V(0, 0, 2.2), NORTH, 6, 0.9), Math.PI);
  f.score("wonder");

  f.shot("dawn");
  /* 1. The storm goes, the sky turns blue and gold, and the sun comes up
     over the edge of the world. */
  const sky = f.lend.add(dawnSky());
  const sun = f.lend.add(glowSprite("#ffd49a", 34, 0));
  sun.position.set(0, -8, -66);
  const warm = new THREE.Color("#ffd7a6"), lights = [];
  scene.scene.traverse((o) => { if (o.isLight) lights.push([o, o.color.clone(), o.intensity]); });
  const tint0 = scene.grade?.uniforms.tint.value.clone(), tint1 = new THREE.Color("#fff0dc");
  f.cut(V(0.6, 0.55, 5.4), V(0, 2.4, -40));
  f.glide(V(0.3, 0.9, 4.6), V(0, 4.2, -40), 4);
  playSound("shimmer", { volume: 0.5 });
  const rising = f.tween(5200, (k) => {
    const s = ease(k);
    sky.material.opacity = s;
    sun.material.opacity = Math.min(1, k * 1.6);
    sun.position.y = -8 + 16 * s;
    for (const [l, c, i] of lights) {
      l.color.copy(c).lerp(warm, s);
      if (l.isPointLight) l.intensity = i * (1 - s);
      else if (l.isDirectionalLight) l.intensity = i * (1 + 0.6 * s);
    }
    if (tint0) scene.grade.uniforms.tint.value.copy(tint0).lerp(tint1, s);
    if (scene.fog) scene.fog.color.set("#0d0912").lerp(new THREE.Color("#c9a27a"), s);
  });
  await f.wait(0.6);
  await f.line("The storm was gone. For the first time since the shelf, the sky was getting light.", 4.4);
  await rising;
  playSound("chirp", { volume: 0.5 });
  heroes.forEach((e, i) => setTimeout(() => scene.squash(e, -0.1, 300), i * 110));
  await f.wait(0.8);
  if (!f.alive()) return;

  f.shot("home");
  /* 2. A board by a window, in the sun. The whole set, home. */
  await f.fade(1, 0.6);
  if (!f.alive()) return;
  f.lend.hideWorld();
  sky.visible = sun.visible = false;
  scene.setPieces(START);
  for (const e of scene.pieces.values()) { toonify(e.model); outline(e.model, { width: 0.012 }); }
  const room = f.lend.add(sunnyRoom());
  f.lend.onFrame(room.userData.update);
  const hand = f.lend.add(buildHand(1));
  hand.rotation.y = Math.PI;
  hand.visible = false;
  scene.background = new THREE.Color("#3a2818");
  if (scene.fog) { scene.fog.color.set("#5a4028"); if (scene.fog.isFogExp2) scene.fog.density = 0.01; }
  for (const [l] of lights) {
    l.color.set(l.isHemisphereLight ? "#fff1dc" : "#ffe2b8");
    l.intensity = l.isPointLight ? 0 : l.isHemisphereLight ? 0.6 : 0.8;
    if (l.isHemisphereLight) l.groundColor.set("#6b4a2e");
  }
  scene.setLook({ glow: 0.18, glowFrom: 1.05, vignette: 0.62, tint: "#fff1dc", contrast: 1.06, saturation: 1.08 });
  scene.renderer.toneMappingExposure = 0.78;
  f.cut(V(2.2, 1.6, 7.6), V(0, 0.5, 0.2));
  f.glide(V(1.6, 1.3, 6.4), V(0.2, 0.5, 0.6), 4);
  await f.wait(0.15);
  f.fade(0, 0.8);
  playSound("chirp", { volume: 0.45, delay: 0.4 });
  await f.line("They found their way back to a board, in a window, in the sun.", 3.2);
  if (!f.alive()) return;

  /* Someone sits down, and plays the first move: e2 to e4. */
  const pawnE = scene.pieces.get(12);
  const e2 = scene.worldOf(12), e4 = scene.worldOf(28);
  const over = (p, lift = 0) => p.clone().add(V(0, 1.25 + lift, 0.78));
  hand.visible = true;
  hand.userData.grip(0);
  /* From the side, so the hand and the pawn are both in the picture. */
  f.cut(V(6.4, 2.5, 4.4), V(0.4, 0.6, 1.4));
  f.glide(V(5.9, 2.3, 3.9), V(0.4, 0.6, 1.4), 3);
  const said = f.line("And someone sat down to play.", 3.4);
  playSound("cloth2", { volume: 0.6 });
  const entry = over(e2).add(V(0.3, 2.4, 4.5));
  await f.tween(900, (k) => hand.position.lerpVectors(entry, over(e2), easeOut(k)));
  await f.tween(220, (k) => hand.userData.grip(k * 0.8));
  playSound("tap", { volume: 0.6 });
  await f.tween(900, (k) => {
    const s = ease(k), lift = Math.sin(k * Math.PI) * 0.7;
    const at = e2.clone().lerp(e4, s);
    hand.position.copy(over(at, lift));
    if (pawnE) { pawnE.group.position.copy(at); pawnE.group.position.y = lift; }
  });
  playSound("land", { volume: 0.7 });
  if (pawnE) scene.squash(pawnE, 0.12, 240);
  await f.tween(200, (k) => hand.userData.grip(0.8 * (1 - k)));
  const away = hand.position.clone();
  f.tween(800, (k) => hand.position.lerpVectors(away, entry, ease(k)));
  await said;
  if (!f.alive()) return;

  f.shot("thanks");
  /* 3. Their faces, one after another as they hop, and the thanks. */
  f.score("triumph");
  playSound("cheer", { volume: 0.4 });
  const front = [...scene.pieces.values()].filter((e) => e.colour === "white");
  front.forEach((e, i) => setTimeout(() => { if (!f.alive()) return; scene.squash(e, -0.14, 300); scene.tween(380, (k) => { e.group.position.y = Math.sin(k * Math.PI) * 0.3; }); }, 300 + i * 70));
  f.glide(V(0, 3.4, 9.2), V(0, 0.4, 0), 3);
  setTimeout(() => { if (f.alive()) for (const e of front.slice(8)) scene.sparks(e.group.position.clone(), "#ffcf6a"); }, 900);
  await f.line("The soul of chess was never in the pieces. It was in playing them together.", 3.6);
  await f.line("Thank you for playing with us.", 2.6);
  if (!f.alive()) return;
  await f.fade(1, 1);
}

export const WORLD_FILMS = { ice, volcano, demon, ending };
/* The films' first music, before the script picks its own. */
export const FILM_MOOD = { ice: "wonder", volcano: "sorrow", demon: "dread", ending: "wonder" };
