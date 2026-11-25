import { describe, it, expect, vi } from "vitest";
import * as THREE from "three";

vi.mock("../sound.js", () => ({ play: () => {} }));
const { wrapBoss, commandPath, COMMAND_HEIGHT } = await import("./bossFx.js");

/* A stand-in for TacticaScene: a scene, a shake value and tweens that a
   test runs by hand, frame by frame. */
function fakeScene() {
  const tweens = [];
  return {
    scene: new THREE.Scene(),
    shake: 0,
    tween(ms, step, done) { tweens.push({ ms, t: 0, step, done }); },
    /** One frame of `dt` ms. */
    step(dt = 16) {
      for (const tw of [...tweens]) {
        tw.t = Math.min(tw.ms, tw.t + dt);
        tw.step(tw.ms ? tw.t / tw.ms : 1);
        if (tw.t >= tw.ms) { tweens.splice(tweens.indexOf(tw), 1); tw.done?.(); }
      }
    },
    /** Every tween to its end. */
    run() { for (let guard = 0; tweens.length && guard < 10000; guard++) this.step(16); },
  };
}

function boss() {
  const root = new THREE.Group();
  root.position.set(0, 0, -6);
  const mat = new THREE.MeshStandardMaterial({ emissive: "#112233", emissiveIntensity: 0.4 });
  root.add(new THREE.Mesh(new THREE.BoxGeometry(), mat));
  return { root, mat };
}

describe("wrapBoss", () => {
  it("knocks the boss back and puts it back exactly at rest", async () => {
    const ts = fakeScene();
    const { root } = boss();
    const fx = wrapBoss(ts, root);
    expect(root.parent).toBe(fx.holder);
    const done = fx.hurt(1);
    let moved = false;
    for (let i = 0; i < 40; i++) { ts.step(16); if (fx.holder.position.z < -0.05) moved = true; }
    ts.run();
    await done;
    expect(moved).toBe(true);
    expect(fx.holder.position.length()).toBe(0);
    expect(fx.holder.rotation.z).toBe(0);
    expect(ts.shake).toBe(0);
  });

  it("ends overlapping flashes on the boss's real glow", () => {
    const ts = fakeScene();
    const { root, mat } = boss();
    const fx = wrapBoss(ts, root);
    fx.hurt(1);
    ts.step(16); ts.step(16);
    fx.hurt(2);
    fx.hurt(3);
    ts.run();
    expect(mat.emissive.getHexString()).toBe("112233");
    expect(mat.emissiveIntensity).toBeCloseTo(0.4);
  });

  it("takes its holder out of the scene on dispose", () => {
    const ts = fakeScene();
    const fx = wrapBoss(ts, boss().root);
    fx.dispose();
    expect(ts.scene.children).not.toContain(fx.holder);
  });
});

describe("commandPath", () => {
  const point = new THREE.Vector3(1.5, 0, 0.5);
  const bossAt = new THREE.Vector3(0, 0, -7);
  const from = new THREE.Vector3(0, 3, -5);

  it("never brings the hand down to the pieces", () => {
    for (const opts of [{}, { small: true }, { attack: true }, { small: true, attack: true }]) {
      const path = commandPath(from, point, bossAt, opts);
      for (let k = 0; k <= 1; k += 0.01) expect(path(k).y).toBeGreaterThan(point.y + COMMAND_HEIGHT * 0.5);
    }
  });

  it("keeps a small command back near the boss", () => {
    const big = commandPath(from, point, bossAt).call(null, 1).clone();
    const small = commandPath(from, point, bossAt, { small: true })(1).clone();
    expect(small.distanceTo(bossAt)).toBeLessThan(big.distanceTo(bossAt));
  });

  it("jabs toward the victim at the end of an attack", () => {
    const path = commandPath(from, point, bossAt, { attack: true });
    const late = path(0.85).clone(), end = path(1).clone();
    expect(late.y).toBeLessThan(end.y);
  });
});
