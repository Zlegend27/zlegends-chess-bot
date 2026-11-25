import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { TacticaScene, SET_BOARD } from "../scene";
import { dressTrashBin } from "../sets/trashBin";
import { play as playSound, setScore, playMusic, stopMusic, setFlies } from "../sound";
import { NARRATOR } from "./lines";
import { toonify, outline, partsNamed } from "./anime";
import { buildAttic, YARD } from "./attic";
import { BrassButton, useBackLayer } from "../ui";

/* The opening as a 3D anime cinematic, on the game's own scene and
   characters: cel-shaded and inked, with a film's grammar on top
   (letterbox, cuts, glides, speed lines, impact frames, subtitles).

   Act 1, the attic (a faded flashback): the old set under dust and
   cobwebs; a door opens and hope flickers; hands tear it out of its webs,
   carry it out to the yard and throw it in the bin; the lid slams.
   Act 2, inside the bin (full colour): a crack of light, the narrator, the
   six heroes rising, eyes and arms, and the question.

   Each act has its own canvas and scene: act 2's is built while the screen
   is black after the lid slams, so the change never shows. The script is
   async: camera moves, sounds and lines each wait their turn.

   It opens on a title and Begin (phones only allow sound after a tap).
   `onDone(answer)` gets "yes", "refused" (no, twice), or null if skipped;
   Skip is offered when `skippable` (always, since 2026-11-24). A real track in
   public/tactica/music/opening.mp3 plays under it if there is one. */
const COLORS = { light: SET_BOARD.light, dark: SET_BOARD.dark, background: "#050304", highlight: "#3EE7F5", target: "#F5D93E", attack: "#F05348", select: "#3EE7F5" };
const HEROES = [
  { sq: 19, type: 1 }, { sq: 26, type: 2 }, { sq: 28, type: 3 },
  { sq: 33, type: 4 }, { sq: 37, type: 5 }, { sq: 35, type: 6 },
];
const START = (() => {
  const back = [4, 2, 3, 5, 6, 3, 2, 4], list = [];
  for (let f = 0; f < 8; f++) {
    list.push({ sq: f, type: back[f], white: true }, { sq: 8 + f, type: 1, white: true });
    list.push({ sq: 56 + f, type: back[f], white: false }, { sq: 48 + f, type: 1, white: false });
  }
  return list;
})();
const ANIME_LOOK = { glow: 0.5, glowFrom: 0.9, vignette: 0.78, contrast: 1.08, saturation: 1.12, tint: "#f4e6dc" };
/* The attic is a memory: faded, warm, heavy at the edges. */
const FLASHBACK = { glow: 0.28, glowFrom: 0.97, vignette: 0.95, contrast: 1.04, saturation: 0.5, tint: "#efdcc0" };
const V = (x, y, z) => new THREE.Vector3(x, y, z);
/* Hides parts of a character until shown: scaled to nothing after each
   frame's animation (the characters are skinned, so .visible on a part
   doesn't hide it, and the idle animation would undo a one-off scale). */
function hider(scene) {
  const hidden = new Set();
  scene.everyFrame.push(() => { for (const p of hidden) p.scale.setScalar(1e-4); });
  return {
    hide(parts) { for (const p of parts) { p.userData.restScale ??= p.scale.clone(); hidden.add(p); } },
    show(p) { hidden.delete(p); if (p.userData.restScale) p.scale.copy(p.userData.restScale); },
  };
}
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const easeOut = (t) => 1 - (1 - t) ** 3;

export default function Film3D({ onDone, skippable = false }) {
  const [begun, setBegun] = useState(false);
  const doneRef = useRef(false);
  const finish = (answer) => { if (doneRef.current) return; doneRef.current = true; onDone?.(answer); };
  /* Back (the phone's, or Escape) skips the opening, like Skip. */
  useBackLayer(skippable, () => finish(null));
  const canvasA = useRef(null), canvasB = useRef(null);
  const linesRef = useRef(null);
  const [act, setAct] = useState(1);
  const [say, setSay] = useState(null);
  const [flash, setFlash] = useState(null);
  const [asking, setAsking] = useState(false);
  const [title, setTitle] = useState(false);
  const answerRef = useRef(null);
  const speedRef = useRef(0);

  useEffect(() => {
    if (!begun) return undefined;
    let alive = true;
    const scenes = [];
    setFlies(false);
    playMusic("opening", { loop: true });
    const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));
    /* Which shot is playing, for checking shots on the dev server. */
    const shot = (name) => { if (import.meta.env.DEV) window.__filmShot = name; };
    const line = async (text, secs) => { if (!alive) return; setSay(text); await wait(secs); if (alive) setSay(null); };
    const impact = async (heavy = false) => {
      setFlash("white"); await wait(heavy ? 0.07 : 0.05);
      setFlash("black"); await wait(heavy ? 0.06 : 0.04);
      setFlash(null);
    };
    /* Camera helpers for one scene. */
    const camFor = (scene) => ({
      cut(pos, look) {
        scene.camPos.copy(pos); scene.goalPos.copy(pos); scene.camLook.copy(look); scene.goalLook.copy(look);
        Object.assign(scene.posVel, { x: 0, y: 0, z: 0 }); Object.assign(scene.lookVel, { x: 0, y: 0, z: 0 });
        scene.wake();
      },
      glide(pos, look, smooth = 0.9) { scene.moveCamera(pos, look, smooth); },
      tween(ms, step) { return new Promise((r) => scene.tween(ms, step, r)); },
    });

    /* ================= ACT 1: the attic ================= */
    const act1 = async () => {
      const scene = new TacticaScene(canvasA.current, { flipped: false, colors: COLORS });
      scenes.push(scene);
      scene.continuous = true;
      scene.setPieces(START);
      /* Still just carved pieces here: no eyes, no arms. They only wake in
         the bin. */
      const carved = hider(scene);
      for (const e of scene.pieces.values()) {
        toonify(e.model); outline(e.model, { width: 0.012 });
        carved.hide(partsNamed(e.model, (n) => /^(eye[RL]|shoulder[RL])$/.test(n)));
      }
      const attic = buildAttic(scene);
      scene.everyFrame.push((dt) => attic.update(dt));
      scene.setLook(FLASHBACK);
      const { cut, glide, tween } = camFor(scene);
      const R = attic.rig;
      const flying = [];
      scene.everyFrame.push((dt) => {
        for (const f of flying) {
          if (f.done) continue;
          const s = f.scale();
          f.v.y -= 22 * dt * s;
          f.g.position.addScaledVector(f.v, dt * s);
          f.g.rotation.x += f.spin.x * dt * s; f.g.rotation.z += f.spin.z * dt * s;
          if (f.g.position.y < -6) f.done = true;
        }
      });
      await wait(0.4);
      if (!alive) return;

      shot("attic");
      /* 1. Forgotten: a slow drift over the set under its dust and webs. */
      setScore("sorrow");
      cut(V(-8, 4.2, 10), V(0, -0.2, 0));
      glide(V(-5, 3, 7.2), V(0, 0, 0), 4);
      playSound("drone", { volume: 0.5 });
      for (let i = 0; i < 6; i++) playSound("tick", { volume: 0.4, delay: i * 0.6 });
      await wait(3.6);
      /* Close: a pawn, a web strung from it to the next. */
      cut(V(2.6, 1.0, 5.6), V(0.4, 0.35, 2.4));
      glide(V(2.1, 0.85, 4.8), V(0.4, 0.35, 2.4), 3);
      playSound("creak", { volume: 0.4 });
      await wait(2.4);
      if (!alive) return;

      shot("door");
      /* 2. Found: the door opens, light floods in, and for a moment the
         colour comes back. */
      /* Low behind the pieces: they stand dark against the door's light. */
      cut(V(-2.4, 0.75, 1.6), V(11, 1.7, 3));
      glide(V(-2.0, 0.85, 1.9), V(11, 1.9, 3), 3);
      playSound("creak", { volume: 0.9 });
      attic.figure.visible = true;
      await tween(1100, (k) => {
        const s = ease(k);
        attic.doorPivot.rotation.y = -1.7 * s;
        attic.hallLight.intensity = 45 * s;
      });
      playSound("heartbeat", { volume: 0.8 });
      playSound("shimmer", { volume: 0.7, delay: 0.25 });
      await tween(900, (k) => scene.setLook({ saturation: 0.5 + 0.45 * Math.sin(Math.PI * k), glow: 0.45 + 0.2 * Math.sin(Math.PI * k) }));
      scene.setLook(FLASHBACK);
      await wait(0.4);
      if (!alive) return;

      shot("hands");
      /* 3. Hands: they come in from both sides, grip the board's edges, and
         tear it out of its webs. */
      const [L, Rh] = attic.hands;
      /* Close on one hand as it closes on the board's edge. */
      cut(V(9.2, 1.6, 4.6), V(5.0, 0.1, 0.4));
      glide(V(8.6, 1.4, 4.0), V(5.0, 0.1, 0.4), 2);
      for (const [h, side] of [[L, -1], [Rh, 1]]) { h.visible = true; h.position.set(side * 11, 0.1, 0.4); h.rotation.set(0, side < 0 ? Math.PI / 2 : -Math.PI / 2, 0); h.userData.grip(0); }
      playSound("cloth2", { volume: 0.7 });
      await tween(800, (k) => { const s = ease(k); L.position.x = -11 + 5.3 * s; Rh.position.x = 11 - 5.3 * s; });
      playSound("tap", { volume: 0.8 });
      await tween(250, (k) => { L.userData.grip(k); Rh.userData.grip(k); });
      await wait(0.25);
      /* From the side: the near hand big in front, the board torn up out of
         its webs. */
      cut(V(13, 2.2, 5.2), V(-1, 1.0, 0));
      glide(V(13.5, 3.8, 6), V(-1, 2.6, 0), 2.2);
      playSound("scrape", { volume: 0.9 });
      playSound("crack", { volume: 0.4 });
      attic.puff();
      await tween(1100, (k) => {
        const s = easeOut(k);
        R.position.y = 2.6 * s; R.rotation.z = 0.06 * Math.sin(k * Math.PI);
        L.position.y = 0.1 + 2.6 * s; Rh.position.y = 0.1 + 2.6 * s;
        for (const w of attic.webs) { w.material.opacity = 0.45 * (1 - k); w.scale.y = 1 + k * 0.8; }
      });
      for (const w of attic.webs) w.visible = false;
      await wait(0.4);
      if (!alive) return;

      shot("carry");
      /* 4. Carried out: the yard, grey and cold. */
      attic.setYardLight(1);
      scene.setLook({ ...FLASHBACK, glow: 0.12, glowFrom: 1.1, saturation: 0.6, tint: "#cfd5de" });
      const carryFrom = YARD.clone().add(V(0, 1.2, 14)), carryTo = YARD.clone().add(V(0, 2.2, 3));
      R.position.copy(carryFrom); R.rotation.set(0, 0, 0);
      L.position.copy(carryFrom).add(V(-5.4, 0.1, 0.4)); Rh.position.copy(carryFrom).add(V(5.4, 0.1, 0.4));
      /* A tracking shot, low behind the board, the grey sky ahead of it. */
      const follow = (p) => ({ pos: p.clone().add(V(-3.2, -0.4, 7)), look: p.clone().add(V(0.6, 1.2, -5)) });
      { const f = follow(carryFrom); cut(f.pos, f.look); }
      setScore(null);
      let lastStep = -1;
      await tween(2300, (k) => {
        const p = carryFrom.clone().lerp(carryTo, k);
        p.y += Math.abs(Math.sin(k * Math.PI * 4)) * 0.25;
        R.position.copy(p);
        L.position.copy(p).add(V(-5.4, 0.1, 0.4)); Rh.position.copy(p).add(V(5.4, 0.1, 0.4));
        const f = follow(p);
        scene.goalPos.copy(f.pos); scene.goalLook.copy(f.look);
        const step = Math.floor(k * 8);
        if (step !== lastStep) { lastStep = step; playSound("step", { volume: 0.5 }); }
      });
      if (!alive) return;

      shot("throw");
      /* 5. Thrown: up and over, in slow motion, into the bin. */
      /* Close as it leaves the hands, the camera turning to follow it up. */
      cut(YARD.clone().add(V(-6.5, 1.2, 8)), YARD.clone().add(V(0, 3.4, 2)));
      glide(YARD.clone().add(V(-8, 1.6, 8)), YARD.clone().add(V(0, 9, -7)), 0.9);
      playSound("swish", { volume: 0.9 });
      playSound("whoom", { volume: 0.8 });
      let slow = 0.3;
      for (const e of scene.pieces.values()) {
        const g = e.group;
        scene.scene.attach(g);
        flying.push({ g, v: V((Math.random() - 0.5) * 3, 9 + Math.random() * 5, -9 - Math.random() * 4), spin: V((Math.random() - 0.5) * 8, 0, (Math.random() - 0.5) * 8), scale: () => slow });
      }
      flying.push({ g: R, v: V(0, 10, -11), spin: V(-2.2, 0, 0.4), scale: () => slow });
      for (const h of [L, Rh]) scene.tween(500, (k) => { h.position.y += 0.08; h.position.z += 0.1 * k; }, () => { h.visible = false; });
      speedRef.current = 1;
      await wait(1.4);
      speedRef.current = 0;
      slow = 1;
      shot("binview");
      /* Looking down into the bin as they rain in. */
      cut(YARD.clone().add(V(0.5, 16, -6)), YARD.clone().add(V(0, -4, -14)));
      await wait(0.7);
      playSound("landHeavy", { volume: 1 });
      playSound("metal", { volume: 0.8, delay: 0.08 });
      playSound("punchHeavy", { volume: 0.7, delay: 0.16 });
      await impact(true);
      await wait(0.4);
      /* The lid slams. */
      shot("lid");
      /* From inside the bin, looking up: the lid swings down over the sky. */
      cut(YARD.clone().add(V(0.6, -4.5, -13)), YARD.clone().add(V(0, 6, -17)));
      await wait(0.25);
      await tween(420, (k) => { attic.lidPivot.rotation.x = -1.9 * (1 - k * k); });
      playSound("punchHeavy", { volume: 1 });
      playSound("metal", { volume: 0.9 });
      scene.shake = 0.25;
      setFlash("black");
      await wait(0.25);
      scene.shake = 0;
    };

    /* ================= ACT 2: inside the bin ================= */
    const act2 = async () => {
      setAct(2);
      await wait(0.05);
      const scene = new TacticaScene(canvasB.current, { flipped: false, colors: COLORS });
      scenes.push(scene);
      scene.continuous = true;
      const bin = dressTrashBin(scene);
      scene.everyFrame.push((dt) => bin.update(dt));
      scene.setPieces(HEROES.map((h) => ({ ...h, white: true })));
      const heroes = HEROES.map((h) => scene.pieces.get(h.sq));
      for (const e of heroes) { toonify(e.model); outline(e.model, { width: 0.012 }); }
      scene.setLook({ ...ANIME_LOOK, tint: "#000000" });
      const sprouts = heroes.map((e) => ({
        eyes: partsNamed(e.model, (n) => n === "eyeR" || n === "eyeL"),
        arms: partsNamed(e.model, (n) => n === "shoulderR" || n === "shoulderL"),
      }));
      const asleep = hider(scene);
      for (const s of sprouts) asleep.hide([...s.eyes, ...s.arms]);
      heroes.forEach((e, i) => { e.group.rotation.z = (i % 2 ? 1 : -1) * (1.25 + (i % 3) * 0.12); e.group.position.y = 0.32; e.holder.rotation.y = Math.PI + (i - 2.5) * 0.5; });
      bin.setHoleLight(0);
      const { cut, glide, tween } = camFor(scene);
      /* Act 1's scene can go once this one has drawn. */
      await wait(0.6);
      try { scenes[0]?.dispose(); } catch { /* gone */ }
      setFlash(null);
      if (!alive) return;

      /* 1. Black, then a crack of light in the lid. */
      setScore("ghost");
      cut(V(0.6, 6.5, 6.8), V(0, 0.2, 0.4));
      await wait(0.5);
      playSound("crack", { volume: 0.6 });
      playSound("shimmer", { volume: 0.4, delay: 0.3 });
      await tween(1600, (k) => {
        bin.setHoleLight(ease(k));
        scene.grade.uniforms.tint.value.copy(new THREE.Color("#000000").lerp(new THREE.Color(ANIME_LOOK.tint), ease(k)));
      });
      if (!alive) return;
      glide(V(0.2, 3.6, 4.4), V(0, 0.3, 0.6), 4.5);
      playSound("drone", { volume: 0.7 });
      await line(NARRATOR[0], 3);
      await line(NARRATOR[1], 3.4);
      cut(V(-3.6, 1.8, 4.2), V(0, 0.4, 0.6));
      glide(V(-3.0, 1.5, 3.6), V(0, 0.4, 0.6), 4);
      await line(NARRATOR[2], 3.2);
      { const pawn = scene.worldOf(19); cut(pawn.clone().add(V(2.4, 1.3, 2.6)), pawn.clone().setY(0.35)); glide(pawn.clone().add(V(2.0, 1.1, 2.1)), pawn.clone().setY(0.35), 3); }
      await line(NARRATOR[3], 3);
      if (!alive) return;

      shot("waking");
      /* 2. The waking. */
      setScore("wonder");
      playSound("rumble", { volume: 0.8 });
      playSound("scrape", { volume: 0.9 });
      cut(V(0, 2.4, 5.2), V(0, 0.4, 0.8));
      await tween(900, (k) => { scene.shake = 0.12 * Math.sin(Math.PI * k); });
      scene.shake = 0;
      playSound("shimmer", { volume: 0.9 });
      const order = [3, 1, 2, 4, 5, 0];
      for (const [n, i] of order.entries()) {
        if (!alive) return;
        const e = heroes[i], p = scene.worldOf(HEROES[i].sq), side = n % 2 ? 1 : -1;
        cut(p.clone().add(V(side * 2.6, 1.0, 3.2)), p.clone().setY(0.6));
        speedRef.current = 1;
        playSound("squeak", { volume: 0.7 });
        const z0 = e.group.rotation.z, y0 = e.group.position.y;
        await tween(n < 2 ? 520 : 360, (k) => {
          const s = ease(Math.min(1, k * 1.15));
          e.group.rotation.z = z0 * (1 - s) + Math.sin(k * Math.PI) * -0.08 * Math.sign(z0);
          e.group.position.y = y0 * (1 - s) + Math.sin(k * Math.PI) * 0.18;
        });
        e.group.rotation.z = 0; e.group.position.y = 0;
        scene.squash(e, 0.14, 240);
        speedRef.current = 0;
        playSound("land", { volume: 0.7 });
        await wait(n < 2 ? 0.3 : 0.15);
      }
      if (!alive) return;
      cut(V(0, 1.2, 6.2), V(0, 0.8, 0.8));
      glide(V(0, 1.3, 5.2), V(0, 0.85, 0.8), 2.4);
      await tween(500, (k) => { for (const [i, e] of heroes.entries()) { const from = Math.PI + (i - 2.5) * 0.5; e.holder.rotation.y = from + (Math.PI * 2 - from) * ease(k); } });
      await wait(0.3);
      await impact();
      playSound("chime", { volume: 0.7 });
      for (const s of sprouts) for (const p of s.eyes) asleep.show(p);
      await wait(0.8);
      for (const [i, s] of sprouts.entries()) {
        playSound(i % 2 ? "cloth1" : "cloth2", { volume: 0.6 });
        for (const p of s.arms) {
          asleep.show(p);
          const s0 = p.scale.clone();
          p.scale.setScalar(0.01);
          scene.tween(260, (k) => p.scale.copy(s0).multiplyScalar(Math.max(0.01, ease(k) * (1 + 0.25 * Math.sin(k * Math.PI)))));
        }
        await wait(0.12);
      }
      await wait(0.5);
      playSound("cheer", { volume: 0.3 });

      /* 3. The question, and what follows each answer. */
      const ask = async (again) => {
        cut(V(0, 1.5, 5.0), V(0, 1.0, 0.8));
        glide(V(0, 1.4, 4.4), V(0, 1.0, 0.8), 3);
        setScore(null);
        setAsking(again ? "again" : "first");
        const a = await new Promise((r) => { answerRef.current = r; });
        setAsking(false);
        return a;
      };
      /* Each turns toward the middle of the group (a heading of 0 faces the
         camera, +z; in general a heading θ faces (sin θ, cos θ)). */
      const middle = HEROES.reduce((m, h) => m.add(scene.worldOf(h.sq)), V(0, 0, 0)).multiplyScalar(1 / HEROES.length);
      const faceCentre = () => heroes.forEach((e, i) => {
        const p = scene.worldOf(HEROES[i].sq);
        e.holder.rotation.y = Math.atan2(middle.x - p.x, middle.z - p.z);
      });
      let answer = await ask(false);
      if (!alive) return;
      if (answer === "no") {
        /* They huddle and whisper, then beg. */
        cut(V(0, 5.2, 2.6), V(0, 0.5, 0.4));
        glide(V(0, 4.6, 2.2), V(0, 0.5, 0.4), 2);
        await tween(450, () => faceCentre());
        playSound("cloth1", { volume: 0.6 });
        playSound("whisper", { volume: 0.9, delay: 0.3 });
        for (const e of heroes) scene.tween(1600, (k) => { e.holder.rotation.z = Math.sin(k * Math.PI * 6) * 0.04; });
        await wait(1.8);
        cut(V(0, 0.9, 4.6), V(0, 0.7, 0.8));
        await tween(500, (k) => { for (const [i, e] of heroes.entries()) { e.holder.rotation.y = Math.PI * 2 + (1 - k) * (i - 2.5) * 0.3; e.holder.rotation.x = 0.35 * ease(k); } });
        playSound("aww", { volume: 0.7 });
        await line("Please… please…", 1.2);
        for (const e of heroes) scene.tween(900, (k) => { e.holder.position.y = Math.abs(Math.sin(k * Math.PI * 3)) * 0.06; });
        playSound("aww", { volume: 0.6 });
        await line("Please…", 1.0);
        for (const e of heroes) e.holder.rotation.x = 0;
        answer = await ask(true);
        if (!alive) return;
      }
      if (answer === "no") {
        /* Refused twice: anger. Their eyes burn red. */
        setScore("dread");
        playSound("heartbeat", { volume: 0.9 });
        playSound("heartbeat", { volume: 0.9, delay: 0.55 });
        cut(V(0, 0.95, 3.6), V(0, 0.95, 0.8));
        glide(V(0, 0.95, 2.6), V(0, 1.0, 0.8), 1.4);
        await wait(1.0);
        await impact(true);
        scene.setRedEyes(true);
        playSound("crack", { volume: 0.9 });
        playSound("rumble", { volume: 1 });
        scene.setLook({ ...ANIME_LOOK, tint: "#ffb0a0", saturation: 1.2, vignette: 0.95 });
        await tween(900, (k) => { scene.shake = 0.1 * Math.sin(Math.PI * k); });
        scene.shake = 0;
        await line("Then we will see what you are made of.", 2.4);
        setScore(null);
        finish("refused");
        return;
      }

      shot("bonded");
      /* Bonded: a flare of gold, weapons up, and a taste of the fight. */
      setScore("action");
      await impact(true);
      playSound("chime", { volume: 0.8 });
      playSound("cheer", { volume: 0.5 });
      for (const e of heroes) { scene.sparks(e.group.position.clone(), "#ffcf6a"); scene.squash(e, -0.12, 300); }
      cut(V(0, 0.6, 4.2), V(0, 1.1, 0.8));
      glide(V(0, 0.5, 3.6), V(0, 1.2, 0.8), 1.5);
      await wait(1.4);
      if (!alive) return;
      shot("arena");
      /* The arena: six shadows step up to face them. */
      /* Each foe stands where its hero can really reach: the knight's L
         (c4 to d6), the bishop's diagonal (e4 to g6), the queen's file (f5
         to f7). */
      const foes = [
        { hero: 1, sq: 43, type: 1 },
        { hero: 2, sq: 46, type: 2 },
        { hero: 4, sq: 53, type: 3 },
      ];
      for (const f of foes) {
        scene.addPiece({ sq: f.sq, type: f.type, white: false });
        const e = scene.pieces.get(f.sq);
        if (e) { toonify(e.model); outline(e.model, { width: 0.012 }); scene.squash(e, 0.12, 260); }
      }
      playSound("brass", { volume: 0.8 });
      cut(V(-4.5, 2.4, 4.5), V(0.5, 0.6, 2.4));
      glide(V(-3.8, 2.0, 3.8), V(0.5, 0.6, 2.4), 2);
      await wait(1.0);
      for (const f of foes) {
        if (!alive) return;
        const from = HEROES[f.hero].sq;
        const hero = scene.pieces.get(from);
        if (!hero) continue;
        await scene.animateMove(from, f.sq, { captured: f.sq, knight: hero.kind === "knight", pace: "full", follow: true });
        await impact();
        await wait(0.25);
      }
      if (!alive) return;
      /* The title. */
      setScore("triumph");
      cut(V(0, 1.2, 7.5), V(0, 1, 0.5));
      glide(V(0, 2.6, 10), V(0, 1, 0.5), 2.5);
      setTitle(true);
      await wait(2.6);
      setTitle(false);
      setScore(null);
      finish("yes");
    };

    (async () => {
      try { await act1(); if (alive) await act2(); } catch (e) { console.error("film3d", e); }
    })();

    /* Speed lines over the picture. */
    let frame = 0;
    const lines = () => {
      frame = requestAnimationFrame(lines);
      const c = linesRef.current;
      if (!c) return;
      const g = c.getContext("2d"), w = (c.width = c.clientWidth), h = (c.height = c.clientHeight);
      g.clearRect(0, 0, w, h);
      if (!speedRef.current) return;
      g.strokeStyle = "rgba(255,255,255,0.55)";
      for (let i = 0; i < 46; i++) {
        const a = Math.random() * Math.PI * 2, r0 = Math.max(w, h) * (0.28 + Math.random() * 0.12), r1 = Math.max(w, h) * 0.9;
        g.lineWidth = 0.8 + Math.random() * 2.2;
        g.beginPath();
        g.moveTo(w / 2 + Math.cos(a) * r0, h / 2 + Math.sin(a) * r0);
        g.lineTo(w / 2 + Math.cos(a) * r1, h / 2 + Math.sin(a) * r1);
        g.stroke();
      }
    };
    frame = requestAnimationFrame(lines);
    if (import.meta.env.DEV) window.__film3d = { scenes };
    return () => { alive = false; cancelAnimationFrame(frame); setScore(null); stopMusic(1.2); setFlies(true); for (const s of scenes) { try { s.dispose(); } catch { /* gone */ } } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [begun]);

  const answer = (a) => answerRef.current?.(a);
  return (
    <div className="relative mx-auto w-full max-w-[480px] overflow-hidden" style={{ height: "calc(100dvh - var(--headerH))", background: "#000" }}>
      <canvas ref={canvasA} className="absolute inset-0 block size-full" style={{ visibility: act === 1 ? "visible" : "hidden" }} />
      <canvas ref={canvasB} className="absolute inset-0 block size-full" style={{ visibility: act === 2 ? "visible" : "hidden" }} />
      <canvas ref={linesRef} className="pointer-events-none absolute inset-0 block size-full" aria-hidden="true" />
      {/* Letterbox: a film, not the game. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[9%]" style={{ background: "#000" }} aria-hidden="true" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[9%]" style={{ background: "#000" }} aria-hidden="true" />
      {flash && <div className="pointer-events-none absolute inset-0" style={{ background: flash === "white" ? "#fff" : "#000", opacity: 0.9 }} aria-hidden="true" />}
      {say && (
        <p className="pointer-events-none absolute inset-x-6 bottom-[calc(10%+1.2rem)] m-0 text-center text-base italic text-[var(--tc-cream)]" style={{ textShadow: "0 2px 6px #000, 0 0 12px #000" }}>{say}</p>
      )}
      {!begun && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 p-6 text-center" style={{ background: "radial-gradient(circle at 50% 40%, #2a1a10, #0c0806)" }}>
          <h1 className="tc-title m-0 leading-tight" style={{ fontSize: "clamp(24px, 8.5vw, 34px)" }}>Chess Tactica</h1>
          <BrassButton onClick={() => setBegun(true)}>Begin</BrassButton>
          {skippable && <button type="button" className="tc-link" onClick={() => finish(null)}>Skip the opening</button>}
        </div>
      )}
      {begun && skippable && !asking && (
        <button type="button" className="tc-link absolute top-[9%] right-3 z-10" onClick={() => finish(null)}>Skip</button>
      )}
      {title && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <h1 className="tc-title m-0 px-4 text-center leading-tight" style={{ fontSize: "clamp(26px, 9.5vw, 40px)", textShadow: "0 3px 12px #000" }}>Chess Tactica</h1>
        </div>
      )}
      {asking && (
        <div className="absolute inset-x-0 bottom-[calc(10%+1rem)] flex flex-col items-center gap-3 px-6 text-center">
          <h2 className="tc-title m-0 text-[21px] leading-tight">{asking === "again" ? "Please… will you bond with us?" : "Will you bond with us?"}</h2>
          <div className="flex gap-3">
            <button type="button" className="tc-plank tc-center tc-small" style={{ width: 120 }} onClick={() => answer("yes")}>Yes</button>
            <button type="button" className="tc-plank tc-center tc-small" style={{ width: 120 }} onClick={() => answer("no")}>No</button>
          </div>
        </div>
      )}
    </div>
  );
}
