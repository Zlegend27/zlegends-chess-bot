/* The toolbox for the world films (worldFilms.js), which are shot on the
   run's own live scene: the world the player is about to play in, its real
   boss, and the six heroes cel-shaded and inked like the opening.

   borrow(scene) takes the scene over for a film and returns `give back`,
   which puts everything the film touched back as it was: the grade, the
   camera, the lights, what was hidden, the characters on the board. */
import * as THREE from "three";
import { toonify, outline } from "./anime";

export const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const easeOut = (t) => 1 - (1 - t) ** 3;

/* The six who woke in the bin, in the order the films use them. */
export const HEROES = [
  { sq: 19, type: 1, name: "pawn" }, { sq: 26, type: 2, name: "knight" }, { sq: 28, type: 3, name: "bishop" },
  { sq: 33, type: 4, name: "rook" }, { sq: 37, type: 5, name: "queen" }, { sq: 35, type: 6, name: "king" },
];
/* The opening's grade, for the characters' anime look over each world's own. */
export const ANIME = { contrast: 1.08, saturation: 1.12 };

/** Heading that faces direction (dx, dz): a heading θ faces (sin θ, cos θ). */
export const headingTo = (dx, dz) => Math.atan2(dx, dz);

export function borrow(scene) {
  const saved = {
    continuous: scene.continuous,
    pos: scene.goalPos.clone(), look: scene.goalLook.clone(), smooth: scene.smooth,
    background: scene.background, fog: scene.fog ? { color: scene.fog.color.clone(), density: scene.fog.density } : null,
    exposure: scene.renderer.toneMappingExposure,
    fov: scene.camera.fov,
    look2: scene.composer ? {
      glow: scene.bloom.strength, glowFrom: scene.bloom.threshold,
      vignette: scene.grade.uniforms.vignette.value, tint: scene.grade.uniforms.tint.value.clone(),
      contrast: scene.grade.uniforms.contrast.value, saturation: scene.grade.uniforms.saturation.value,
    } : null,
    lights: [], hidden: [], added: [],
  };
  scene.scene.traverse((o) => { if (o.isLight) saved.lights.push([o, o.color.clone(), o.intensity, o.groundColor?.clone()]); });
  saved.redEyes = !!scene.redEyes;
  saved.flipped = !!scene.flipped;
  scene.setFlipped(false);
  scene.continuous = true;
  scene.seeThroughOff = true;
  scene.setPieces([]);
  return {
    saved,
    /** Something the film adds, removed again at the end. */
    add(obj) { scene.scene.add(obj); saved.added.push(obj); return obj; },
    /** Something to run every frame while the film lasts. */
    onFrame(fn) { scene.everyFrame.push(fn); (saved.frames ??= []).push(fn); },
    /** Hides the world (not the board, its characters or the lights), for a
     *  film's shot somewhere else. */
    hideWorld() {
      const keep = new Set([...scene.tiles, ...(scene.boardMeshes ?? []), scene.marks, scene.hoverMark, scene.hints, ...saved.added]);
      for (const e of scene.pieces.values()) keep.add(e.group);
      for (const o of scene.scene.children) {
        if (keep.has(o) || o.isLight || !o.visible) continue;
        if (o.isMesh && o.geometry?.parameters?.width === 8.7) continue; // the board's frame
        o.visible = false;
        saved.hidden.push(o);
      }
    },
    /** A longer lens (a smaller field of view) for a far subject; scaled
     *  from the phone's own, so 1 is normal. */
    zoom(k) { scene.camera.fov = saved.fov * k; scene.camera.updateProjectionMatrix(); scene.wake(); },
    giveBack() {
      scene.camera.fov = saved.fov; scene.camera.updateProjectionMatrix();
      for (const o of saved.added) scene.scene.remove(o);
      if (saved.frames) scene.everyFrame = scene.everyFrame.filter((fn) => !saved.frames.includes(fn));
      for (const o of saved.hidden) o.visible = true;
      for (const [l, color, intensity, ground] of saved.lights) { l.color.copy(color); l.intensity = intensity; if (ground) l.groundColor.copy(ground); }
      scene.background = saved.background;
      if (saved.fog && scene.fog) { scene.fog.color.copy(saved.fog.color); if (saved.fog.density != null) scene.fog.density = saved.fog.density; }
      scene.setRedEyes(saved.redEyes);
      scene.setFlipped(saved.flipped);
      scene.renderer.toneMappingExposure = saved.exposure;
      if (saved.look2) {
        scene.bloom.strength = saved.look2.glow; scene.bloom.threshold = saved.look2.glowFrom;
        const u = scene.grade.uniforms;
        u.vignette.value = saved.look2.vignette; u.tint.value.copy(saved.look2.tint);
        u.contrast.value = saved.look2.contrast; u.saturation.value = saved.look2.saturation;
      }
      scene.shake = 0;
      scene.setPieces([]);
      scene.continuous = saved.continuous;
      scene.seeThroughOff = false;
      scene.moveCamera(saved.pos, saved.look, saved.smooth);
      scene.wake();
    },
  };
}

/** Camera moves: a hard cut, a glide (`smooth` is how long it takes to
 *  settle, roughly), and a tween that waits. */
export function camera(scene) {
  return {
    cut(pos, look) {
      scene.camPos.copy(pos); scene.goalPos.copy(pos); scene.camLook.copy(look); scene.goalLook.copy(look);
      Object.assign(scene.posVel, { x: 0, y: 0, z: 0 }); Object.assign(scene.lookVel, { x: 0, y: 0, z: 0 });
      scene.wake();
    },
    glide(pos, look, smooth = 0.9) { scene.moveCamera(pos, look, smooth); },
    tween(ms, step) { return new Promise((r) => scene.tween(ms, step, r)); },
  };
}

/** Puts the heroes on the board, cel-shaded and inked, awake (eyes and
 *  arms), and returns their entries in HEROES order. */
export function castHeroes(scene, list = HEROES) {
  scene.setPieces(list.map((h) => ({ sq: h.sq, type: h.type, white: true })));
  const heroes = list.map((h) => scene.pieces.get(h.sq));
  for (const e of heroes) { toonify(e.model); outline(e.model, { width: 0.012 }); }
  return heroes;
}

/** Stands the heroes at world points `spots`, each facing `heading` (one
 *  number for all, or one each). */
export function stand(heroes, spots, heading) {
  heroes.forEach((e, i) => {
    e.group.position.copy(spots[i]);
    e.holder.rotation.set(0, Array.isArray(heading) ? heading[i] : heading, 0);
  });
}

/** A line abreast, `gap` apart, centred on `at`, across direction `dir`. */
export function abreast(at, dir, n, gap = 0.95) {
  const side = V(dir.z, 0, -dir.x).normalize();
  return Array.from({ length: n }, (_, i) => at.clone().addScaledVector(side, (i - (n - 1) / 2) * gap));
}

/** Walks every hero along `dir` by `dist` over `ms`, bobbing as they step,
 *  each from where it stands. Resolves when they arrive. */
export function walk(scene, heroes, dir, dist, ms, { sound } = {}) {
  const d = dir.clone().setY(0).normalize();
  const from = heroes.map((e) => e.group.position.clone());
  const turn = headingTo(d.x, d.z);
  for (const e of heroes) e.holder.rotation.y = turn;
  const steps = Math.max(2, Math.round(ms / 230));
  let last = -1;
  return new Promise((resolve) => scene.tween(ms, (k) => {
    heroes.forEach((e, i) => {
      const ph = k * steps * Math.PI + i * 1.1;
      e.group.position.copy(from[i]).addScaledVector(d, dist * k);
      e.group.position.y = from[i].y + Math.abs(Math.sin(ph)) * 0.09;
      e.holder.rotation.z = Math.sin(ph) * 0.06;
    });
    const step = Math.floor(k * steps);
    if (sound && step !== last) { last = step; sound(); }
  }, () => {
    heroes.forEach((e, i) => { e.group.position.copy(from[i]).addScaledVector(d, dist); e.holder.rotation.z = 0; });
    resolve();
  }));
}

/** Draws the heroes in close round `centre`, each turning to face it. */
export function huddle(scene, heroes, centre, radius, ms) {
  const from = heroes.map((e) => e.group.position.clone());
  const to = heroes.map((e, i) => {
    const a = (i / heroes.length) * Math.PI * 2 + 0.4;
    return centre.clone().add(V(Math.sin(a) * radius, 0, Math.cos(a) * radius));
  });
  const turns = to.map((p) => headingTo(centre.x - p.x, centre.z - p.z));
  const start = heroes.map((e) => e.holder.rotation.y);
  return new Promise((resolve) => scene.tween(ms, (k) => {
    const s = ease(k);
    heroes.forEach((e, i) => {
      e.group.position.lerpVectors(from[i], to[i], s);
      e.group.position.y = Math.abs(Math.sin(k * Math.PI * 4 + i)) * 0.06 * (1 - k);
      const dt = Math.atan2(Math.sin(turns[i] - start[i]), Math.cos(turns[i] - start[i]));
      e.holder.rotation.y = start[i] + dt * Math.min(1, k * 2);
    });
  }, resolve));
}

/** Turns one hero to face a world point over `ms`. */
export function faceToward(scene, e, point, ms = 300) {
  const p = e.group.position, from = e.holder.rotation.y;
  const goal = headingTo(point.x - p.x, point.z - p.z);
  const dt = Math.atan2(Math.sin(goal - from), Math.cos(goal - from));
  return new Promise((resolve) => scene.tween(ms, (k) => { e.holder.rotation.y = from + dt * ease(k); }, resolve));
}

/** The eyes of a character, with their resting scales, for going wide. */
export function eyesOf(e) {
  const eyes = [];
  e.model.traverse((o) => { if (o.name === "eyeR" || o.name === "eyeL") eyes.push([o, o.scale.clone()]); });
  return { wide(k) { for (const [o, s] of eyes) o.scale.copy(s).multiplyScalar(1 + 0.45 * k); } };
}

/** A big soft glow on a sprite (a sun, a flare), drawn over the fog. */
export function glowSprite(color, size, opacity = 1) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d"), grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,255,255,1)"); grad.addColorStop(0.18, "rgba(255,255,255,0.85)"); grad.addColorStop(0.45, "rgba(255,255,255,0.25)"); grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), color, transparent: true, opacity, depthWrite: false, fog: false, toneMapped: false, blending: THREE.AdditiveBlending }));
  sp.scale.set(size, size, 1);
  return sp;
}
