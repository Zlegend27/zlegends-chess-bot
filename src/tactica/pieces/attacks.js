/* What happens on a capture, for any attacker and any victim: the attacker's
   attack clip aimed at the victim's square, the victim's reaction clip, and
   the effects that go with it (the bishop's cut, the queen's lightning and
   puffs, the king's light and slash). The board scene runs these; the piece
   lab uses the same pieces. Everything here is driven by the attack clip's
   own time, so it stays in step however the frames fall. */
import * as THREE from "three";
import { buildPawn, pawnClips } from "./pawn.js";
import { buildKnight, knightClips, crushedClip } from "./knight.js";
import { buildBishop, bishopClips, SPLIT_T } from "./bishop.js";
import { buildRook, rookClips, skeweredClip } from "./rook.js";
import { buildQueen, queenClips, zappedClip, makeZap, makePoof, SPELL, SPARKLE } from "./queen.js";
import { buildKing, kingClips, executedClip, makeHolyBeam, makeNeckSlash, DECREE } from "./king.js";

export const KINDS = [null, "pawn", "knight", "bishop", "rook", "queen", "king"];

export const BUILD = { pawn: buildPawn, knight: buildKnight, bishop: buildBishop, rook: buildRook, queen: buildQueen, king: buildKing };

/* Clips for a piece kind. The target is the victim's square relative to
   the attacker, in the attacker's own (unscaled) frame. The pawn's slash is
   aimed by turning the whole piece, so it ignores the target. */
export function clipsFor(kind, target = [0, 1.2]) {
  switch (kind) {
    case "pawn": return pawnClips();
    case "knight": return knightClips(target);
    case "bishop": return bishopClips(target);
    case "rook": return rookClips(target);
    case "queen": return queenClips(target);
    default: return kingClips(target);
  }
}

/* When the pawn's sword lands, and when it is back on its square. */
const PAWN_HIT = 0.6;
export const PAWN_ATTACK_END = 1.5;

/* Struck by the pawn: knocked back, toppling, gone. */
function struckClip() {
  const h = PAWN_HIT;
  const t = [0, h - 0.02, h + 0.06, h + 0.25, h + 0.45, h + 0.5];
  const tiny = [0.001, 0.001, 0.001];
  return new THREE.AnimationClip("struck", h + 0.5, [
    new THREE.VectorKeyframeTrack("body.position", t, [0, 0, 0, 0, 0, 0, 0, 0.08, -0.12, 0, 0.05, -0.3, 0, -0.05, -0.4, 0, -0.05, -0.4]),
    new THREE.QuaternionKeyframeTrack("body.quaternion", t, [
      [0, 0, 0], [0, 0, 0], [-0.35, 0, 0.1], [-0.9, 0, 0.2], [-1.4, 0, 0.25], [-1.4, 0, 0.25],
    ].flatMap((e) => new THREE.Quaternion().setFromEuler(new THREE.Euler(...e)).toArray())),
    new THREE.VectorKeyframeTrack("body.scale", t, [1, 1, 1, 1, 1, 1, 1.05, 0.95, 1.05, 1, 1, 1, 0.5, 0.5, 0.5, ...tiny]),
  ]);
}

/* How the victim reacts, chosen by who is attacking. The bishop's victim
   is cut in two by an effect instead, so it has no clip. */
export function reactionFor(attacker, victim) {
  switch (attacker) {
    case "pawn": return struckClip();
    case "knight": return crushedClip();
    case "rook": return skeweredClip();
    case "queen": return zappedClip();
    case "king": {
      const head = victim.getObjectByName("head");
      return executedClip({ headY: head ? head.position.y : 1.14, round: victim.name.startsWith("pawn") });
    }
    default: return null;
  }
}

/* ---- Effects. Each returns { update(t), dispose() }, t being the attack
   clip's time. `scale` is the board's piece scale, so effects match. ---- */

/* Bishop: a beat after he passes, the victim splits along a slanted cut and
   the top half slides off. The victim is hidden and drawn as two clipped
   copies, with the inside of the shell painted end-grain so each half reads
   as solid wood. */
function bishopCut({ scene, victim, from, to, scale, victimColour }) {
  let split = null;
  const d = to.clone().sub(from).setY(0).normalize();
  const n = new THREE.Vector3(0, Math.cos(0.62), 0).addScaledVector(d, Math.sin(0.62)).normalize();
  const downhill = new THREE.Vector3(0, -1, 0).addScaledVector(n, n.y).normalize();
  const start = () => {
    victim.updateMatrixWorld(true);
    const centre = victim.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.62 * scale, 0));
    victim.visible = false;
    const cutColour = victimColour === "white" ? "#efe2c8" : "#7a5236";
    const halves = [1, -1].map((sign) => {
      const obj = victim.clone(true);
      obj.visible = true;
      victim.parent.add(obj);
      obj.position.copy(victim.position);
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(n.clone().multiplyScalar(sign), centre);
      const mats = [];
      const cutWood = new THREE.MeshBasicMaterial({ color: cutColour, side: THREE.BackSide, clippingPlanes: [plane], transparent: true });
      mats.push(cutWood);
      const meshes = [];
      obj.traverse((o) => { if (o.isMesh) meshes.push(o); });
      for (const o of meshes) {
        o.material = o.material.clone();
        o.material.clippingPlanes = [plane];
        o.material.side = THREE.FrontSide;
        o.material.transparent = true;
        mats.push(o.material);
        o.add(new THREE.Mesh(o.geometry, cutWood));
      }
      return { obj, plane, sign, base: plane.constant, start: obj.position.clone(), mats };
    });
    const flash = new THREE.Mesh(
      new THREE.BoxGeometry(0.02 * scale, 0.02 * scale, 1.6 * scale),
      new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, depthWrite: false }),
    );
    flash.position.copy(centre);
    const across = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), d).normalize();
    flash.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3().crossVectors(n, across).normalize());
    scene.add(flash);
    split = { halves, flash };
  };
  return {
    update(t) {
      if (t < SPLIT_T) return;
      if (!split) start();
      const s = t - SPLIT_T;
      for (const h of split.halves) {
        const move = new THREE.Vector3();
        const k = Math.max(0, s - 0.08);
        const gap = 0.05 * scale * Math.min(1, s * 10);
        if (h.sign > 0) move.addScaledVector(n, gap).addScaledVector(downhill, 2.6 * scale * k * k).add(new THREE.Vector3(0, -2.2 * scale * k * k, 0));
        else move.addScaledVector(n, -gap - 0.25 * scale * k * k);
        move.y = Math.max(move.y, -0.6 * scale);
        h.obj.position.copy(h.start).add(move);
        h.plane.constant = h.base - h.plane.normal.dot(move);
        const fade = s < 0.32 ? 1 : Math.max(0, 1 - (s - 0.32) / 0.25);
        for (const m of h.mats) m.opacity = fade;
      }
      split.flash.material.opacity = Math.max(0, 1 - s / 0.35);
      split.flash.scale.set(1 + s * 4, 1 + s * 4, 1 + s * 0.6);
    },
    dispose() {
      if (!split) return;
      for (const h of split.halves) h.obj.parent?.remove(h.obj);
      scene.remove(split.flash);
    },
  };
}

/* A burst that appears at a set time and runs for a while. */
function timedPoof(scene, at, when, opts) {
  let fx = null;
  return {
    update(t) {
      if (t < when || t > when + 1.2) { if (fx) { fx.dispose(); fx = null; } return; }
      if (!fx) fx = makePoof(scene, at, opts);
      fx.update(t - when);
    },
    dispose() { fx?.dispose(); },
  };
}

/* Queen: lightning from her orb to the victim, a smoke puff where it was,
   sparkles where she vanishes and where she appears. */
function queenSpell({ scene, attacker, victim, from, to, scale, attackerColour }) {
  const zap = makeZap(scene);
  const S = SPELL;
  const sparkle = { colour: SPARKLE[attackerColour], sparkle: true, count: 22, size: 0.06 * scale };
  const poofs = [
    timedPoof(scene, to.clone(), S.enemyPoof, { colour: "#cfc8bd", count: 18, size: 0.2 * scale }),
    timedPoof(scene, from.clone(), S.vanish + 0.1, sparkle),
    timedPoof(scene, to.clone(), S.appear, sparkle),
  ];
  return {
    update(t) {
      const orb = attacker.getObjectByName("orb").getWorldPosition(new THREE.Vector3());
      const chest = victim.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.75 * scale, 0));
      const on = t >= S.zapStart && t <= S.zapEnd ? 1 : t > S.zapEnd && t < S.zapEnd + 0.1 ? 1 - (t - S.zapEnd) / 0.1 : 0;
      zap.update(t, orb, chest, on);
      for (const p of poofs) p.update(t);
    },
    dispose() { zap.dispose(); for (const p of poofs) p.dispose(); },
  };
}

/* King: a column of light on the condemned piece, a gold slash across its
   neck, and gold sparkles where the body and the head end up. */
function kingDecree({ scene, victim, to, scale }) {
  const D = DECREE;
  let beam = null, slash = null, sparks = null;
  return {
    update(t) {
      if (t >= D.beam && t < D.vanish + 0.4) {
        if (!beam) beam = makeHolyBeam(scene, to.clone(), scale);
        const fadeIn = Math.min(1, (t - D.beam) / 0.25), fadeOut = t > D.vanish ? Math.max(0, 1 - (t - D.vanish) / 0.4) : 1;
        beam.update(t - D.beam, fadeIn * fadeOut);
      } else if (beam) { beam.dispose(); beam = null; }
      if (t >= D.slit && t < D.slit + 0.5) {
        if (!slash) {
          const head = victim.getObjectByName("head");
          const at = head ? head.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, -0.15 * scale, 0)) : to.clone().setY(0.95 * scale);
          slash = makeNeckSlash(scene, at, victim.parent.rotation.y + victim.rotation.y, scale);
        }
        slash.update(t - D.slit);
      } else if (slash) { slash.dispose(); slash = null; }
      if (t >= D.vanish && t < D.vanish + 1.2) {
        if (!sparks) {
          const headAt = victim.getObjectByName("head")?.getWorldPosition(new THREE.Vector3()) ?? to.clone();
          const opts = { colour: "#ffe08a", sparkle: true, size: 0.07 * scale };
          sparks = [makePoof(scene, to.clone(), { ...opts, count: 24 }), makePoof(scene, headAt.setY(-0.25 * scale), { ...opts, count: 14 })];
        }
        for (const s of sparks) s.update(t - D.vanish);
      } else if (sparks) { for (const s of sparks) s.dispose(); sparks = null; }
    },
    dispose() { beam?.dispose(); slash?.dispose(); if (sparks) for (const s of sparks) s.dispose(); },
  };
}

const NONE = { update() {}, dispose() {} };

/** Effects for one capture. `from` and `to` are world positions of the two
 *  squares; `victim` is the victim's model (whose "head" and position the
 *  effects follow). */
export function attackEffects(kind, opts) {
  if (kind === "bishop") return bishopCut(opts);
  if (kind === "queen") return queenSpell(opts);
  if (kind === "king") return kingDecree(opts);
  return NONE;
}
