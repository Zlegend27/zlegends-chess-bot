/* Shared boss effects: being hit, being beaten, and the path of a hand
   that commands a piece without touching it.

   wrapBoss(ts, obj) puts the boss (its root group) inside a holder that
   only these effects move, so the boss's own animation code (which sets
   its root's position every frame) is left alone. */
import * as THREE from "three";
import { play as playSound } from "../sound.js";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* Which bosses get the sharp style (film3d/anime.js sharpenBoss): only
   where it was seen to look better, side by side. On the dev server,
   window.__sharp = { pizza: false } (and so on) overrides it for comparing. */
/* Compared 2026-11-25: the pizza monster, polar bear and fire dragon read
   clearer (the bear most) for almost nothing (600, 20,000 and 2,500 extra
   triangles). The demon's armour already has glowing cracks, so his gain was
   small, and his outline adds 54,000 triangles on the busiest floor: off. */
export const SHARP_BOSSES = { pizza: true, bear: true, dragon: true, demon: false };
export const sharpOn = (id) => {
  if (import.meta.env.DEV && typeof localStorage !== "undefined") {
    try { const o = JSON.parse(localStorage.getItem("devSharp") || "{}"); if (id in o) return o[id]; } catch { /* none */ }
  }
  return SHARP_BOSSES[id];
};

/** How high over a piece a boss's hand stays while it commands it. */
export const COMMAND_HEIGHT = 2.1;

export function wrapBoss(ts, obj) {
  const holder = new THREE.Group();
  ts.scene.add(holder);
  holder.add(obj);
  const at = new THREE.Vector3();

  /* Away from the board's centre (the origin), along the ground. */
  const awayFromBoard = () => {
    obj.getWorldPosition(at);
    at.y = 0;
    return at.lengthSq() > 1e-4 ? at.normalize() : at.set(0, 0, -1);
  };

  /* A glow on every lit material, faded back over `ms`. Each material's own
     glow is saved the first time it is seen (never mid-flash), so flashes
     that overlap (the three hits of a defeat) all end on the real colour,
     not on each other's red. */
  const originals = new WeakMap();
  const flash = (color, strength, ms) => {
    const mats = new Map();
    obj.traverse((o) => {
      const list = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      for (const m of list) {
        if (!m?.emissive || mats.has(m)) continue;
        if (!originals.has(m)) originals.set(m, { c: m.emissive.clone(), i: m.emissiveIntensity ?? 1 });
        mats.set(m, originals.get(m));
      }
    });
    const hit = new THREE.Color(color);
    return new Promise((resolve) => ts.tween(ms, (k) => {
      const f = strength * (1 - k) * (1 - k);
      for (const [m, was] of mats) {
        m.emissive.copy(was.c).lerp(hit, Math.min(1, f));
        m.emissiveIntensity = was.i + f * 1.5;
      }
    }, () => {
      for (const [m, was] of mats) { m.emissive.copy(was.c); m.emissiveIntensity = was.i; }
      resolve();
    }));
  };

  return {
    holder,
    /** Knocked back by a good move: a recoil away from the board, a tilt,
     *  a red flash and a hit. `power` 1 is a normal move, more for bigger. */
    hurt(power = 1) {
      const dir = awayFromBoard().clone();
      const s = obj.getWorldScale(new THREE.Vector3()).x || 1;
      const push = Math.min(1.2, 0.35 * power) * Math.max(0.6, Math.min(1.6, s));
      playSound("punchHeavy", { volume: Math.min(1, 0.55 + 0.2 * power), rate: 0.85 });
      playSound("crunch", { volume: 0.35 * power, rate: 0.7 });
      ts.shake = Math.max(ts.shake || 0, 0.05 * power);
      flash("#ff2a1a", 0.9, 420 + 120 * power);
      return new Promise((resolve) => ts.tween(420 + 80 * power, (k) => {
        const kick = Math.sin(Math.min(1, k * 1.6) * Math.PI) * (1 - k * 0.5);
        holder.position.copy(dir).multiplyScalar(push * kick);
        holder.position.y = 0.08 * power * kick;
        holder.rotation.z = Math.sin(k * Math.PI * 5) * 0.05 * power * (1 - k);
        ts.shake = Math.max(0, 0.05 * power * (1 - k));
      }, () => { holder.position.set(0, 0, 0); holder.rotation.z = 0; ts.shake = 0; resolve(); }));
    },
    /** The winning blow: three heavy hits, each harder, with the screen
     *  shaking, before the boss's own fall (melt). */
    async defeat() {
      for (const power of [1.6, 2.2, 3]) {
        this.hurt(power);
        await wait(power < 3 ? 330 : 120);
      }
      playSound("crack", { volume: 1 });
      playSound("rumble", { volume: 1, rate: 0.7 });
      ts.shake = 0.3;
      await flash("#ffffff", 1, 700);
      await new Promise((resolve) => ts.tween(500, (k) => { ts.shake = 0.3 * (1 - k); }, () => { ts.shake = 0; resolve(); }));
    },
    dispose() { ts.scene.remove(holder); },
  };
}

/**
 * Where a commanding hand goes, in world space, at moment k (0..1) of a
 * command from `from` (the hand's world position) toward the piece's square
 * `point`. `boss` is the boss's world position. A `small` command stays
 * back near the boss (after the first one, so the hand isn't in the way);
 * an `attack` ends in a hard jab toward the victim, still above it.
 */
export function commandPath(from, point, boss, { small = false, attack = false } = {}) {
  const over = point.clone().setY(point.y + COMMAND_HEIGHT);
  const target = small ? over.clone().lerp(boss.clone().setY(over.y), 0.55) : over;
  const sweepTo = from.clone().lerp(target, small ? 0.5 : 0.65);
  const jab = over.clone().setY(point.y + COMMAND_HEIGHT * 0.55);
  const out = new THREE.Vector3();
  return (k) => {
    const sweepK = attack ? Math.min(1, k / 0.7) : k;
    const e = sweepK < 0.5 ? 2 * sweepK * sweepK : 1 - Math.pow(-2 * sweepK + 2, 2) / 2;
    out.copy(from).lerp(sweepTo, e);
    out.y += Math.sin(sweepK * Math.PI) * (small ? 0.15 : 0.3);
    out.x += Math.sin(sweepK * Math.PI * 7) * (small ? 0.04 : 0.08) * (1 - sweepK);
    if (attack && k > 0.7) {
      const j = (k - 0.7) / 0.3;
      out.lerp(jab, Math.sin(j * Math.PI));
    }
    return out;
  };
}
