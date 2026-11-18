/* The opening's first act: the attic where the old set lies forgotten, and
   the yard with the bin it is thrown into. Built round the scene's own
   board (which stays at the origin); the yard is a second spot far off,
   that the board is carried to between cuts.

   buildAttic(ts) returns the pieces the film drives: the board rig (board
   and every character together, to lift, carry and throw), the hands, the
   cobwebs, the door and its light, a dust puff, and the yard's bin lid. */
import * as THREE from "three";
import { prop } from "../sets/art.js";
import { toonify, outline } from "./anime.js";

export const YARD = new THREE.Vector3(60, 0, 0);

/* Old planks for the floor, walls and table, drawn in code. */
function plankTexture(base = "#5a3a22", seed = 1, planks = 6) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const w = 256 / planks;
  for (let i = 0; i < planks; i++) {
    const shade = 0.75 + r() * 0.3;
    const col = new THREE.Color(base).multiplyScalar(shade);
    g.fillStyle = `#${col.getHexString()}`;
    g.fillRect(i * w, 0, w, 256);
    g.strokeStyle = "rgba(0,0,0,0.18)";
    for (let k = 0; k < 7; k++) { g.beginPath(); const x = i * w + r() * w; g.moveTo(x, 0); g.bezierCurveTo(x + 6, 80, x - 6, 170, x + 3, 256); g.stroke(); }
    g.fillStyle = "rgba(0,0,0,0.55)";
    g.fillRect(i * w, 0, 2, 256);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* A cobweb in a corner: spokes and a sagging spiral, faint and white. */
function cobweb(size, seed = 1) {
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const pts = [];
  const spokes = 7, rings = 6;
  const ang = (i) => (i / (spokes - 1)) * (Math.PI / 2);
  for (let i = 0; i < spokes; i++) { pts.push(0, 0, 0, Math.cos(ang(i)) * size, Math.sin(ang(i)) * size, 0); }
  for (let k = 1; k <= rings; k++) {
    const rad = (k / rings) * size * (0.85 + r() * 0.1);
    for (let i = 0; i < spokes - 1; i++) {
      const a0 = ang(i), a1 = ang(i + 1), sag = 0.82;
      const mx = Math.cos((a0 + a1) / 2) * rad * sag, my = Math.sin((a0 + a1) / 2) * rad * sag;
      pts.push(Math.cos(a0) * rad, Math.sin(a0) * rad, 0, mx, my, 0, mx, my, 0, Math.cos(a1) * rad, Math.sin(a1) * rad, 0);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: "#e8e4dc", transparent: true, opacity: 0.45, depthWrite: false }));
}

/* A hand, cel-shaded and inked: palm, four fingers, a thumb. `side` -1 left. */
export function buildHand(side) {
  const skin = new THREE.MeshStandardMaterial({ color: "#e2b48e", roughness: 0.8 });
  const sleeve = new THREE.MeshStandardMaterial({ color: "#3a3f52", roughness: 0.9 });
  const hand = new THREE.Group();
  const palm = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.32, 1.25), skin);
  hand.add(palm);
  const fingers = [];
  for (let i = 0; i < 4; i++) {
    const f = new THREE.Group();
    f.position.set(-0.4 + i * 0.27, 0, 0.62);
    const seg = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.55 - Math.abs(i - 1.5) * 0.08, 4, 8), skin);
    seg.rotation.x = Math.PI / 2;
    seg.position.z = 0.33;
    f.add(seg);
    hand.add(f);
    fingers.push(f);
  }
  const thumb = new THREE.Group();
  thumb.position.set(0.58 * side * -1, 0, 0.1);
  const t = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.42, 4, 8), skin);
  t.rotation.set(Math.PI / 2, 0, side * 0.9);
  t.position.set(-side * 0.2, 0, 0.25);
  thumb.add(t);
  hand.add(thumb);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 3.2, 12), sleeve);
  arm.rotation.x = Math.PI / 2;
  arm.position.z = -2.1;
  hand.add(arm);
  toonify(hand);
  outline(hand, { width: 0.025, minSize: 0.05 });
  /** Curls the fingers: 0 open, 1 gripping. */
  hand.userData.grip = (k) => { for (const f of fingers) f.rotation.x = k * 1.25; thumb.rotation.y = side * k * 0.6; };
  hand.userData.grip(0);
  return hand;
}

export function buildAttic(ts) {
  const scene = ts.scene;
  scene.background = new THREE.Color("#0e0906");
  scene.fog = new THREE.Fog("#0e0906", 10, 34);
  scene.traverse((o) => {
    if (o.isHemisphereLight) { o.intensity = 0.3; o.color.set("#d8c4a8"); }
    else if (o.isDirectionalLight) o.intensity *= 0.25;
  });
  ts.renderer.shadowMap.enabled = true;
  for (const tile of ts.tiles) tile.receiveShadow = true;

  const room = new THREE.Group();
  scene.add(room);
  const wood = new THREE.MeshStandardMaterial({ map: plankTexture("#4a301c", 3), roughness: 0.95 });
  wood.map.repeat.set(4, 4);
  const darkWood = new THREE.MeshStandardMaterial({ map: plankTexture("#2e1d12", 7), roughness: 1 });
  darkWood.map.repeat.set(3, 2);
  /* Floor, back and side walls under a sloping roof. */
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), wood);
  floor.rotation.x = -Math.PI / 2; floor.position.y = -3.2; floor.receiveShadow = true;
  room.add(floor);
  for (const [w, h, at, ry] of [[40, 16, [0, 4, -9], 0], [40, 16, [-11, 4, 0], Math.PI / 2], [40, 16, [12, 4, 0], -Math.PI / 2]]) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(w, h), darkWood);
    wall.position.set(...at); wall.rotation.y = ry; wall.receiveShadow = true;
    room.add(wall);
  }
  for (let i = -3; i <= 3; i++) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 22), darkWood);
    beam.position.set(i * 3.2, 8.5, -1);
    beam.rotation.x = 0.35;
    room.add(beam);
  }
  /* The old table the set has sat on for years. */
  const tableTop = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.35, 10), wood);
  tableTop.position.y = -0.6; tableTop.castShadow = tableTop.receiveShadow = true;
  room.add(tableTop);
  for (const [x, z] of [[-4.8, -4.4], [4.8, -4.4], [-4.8, 4.4], [4.8, 4.4]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.45, 2.6, 0.45), darkWood);
    leg.position.set(x, -2, z);
    room.add(leg);
  }
  /* Forgotten things round about. */
  prop(ts, room, "cardboard_box_01", { size: 3.2, at: [-8, -3.2, -6], rot: [0, 0.4, 0], tint: "#9a8a7a" });
  prop(ts, room, "cardboard_box_01", { size: 2.4, at: [-7.6, -0.4, -6.4], rot: [0, -0.3, 0], tint: "#8a7a6a" });
  prop(ts, room, "cardboard_box_01", { size: 2.8, at: [8.5, -3.2, -6.5], rot: [0, 1.2, 0], tint: "#9a8a7a" });
  prop(ts, room, "wine_bottles_01", { size: 1.4, at: [7.4, -3.2, -3], rot: [0, 0.6, 0], tint: "#7a8a7a" });

  /* A small window high on the left: a shaft of dusty light onto the board. */
  const windowGlow = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2), new THREE.MeshBasicMaterial({ color: "#ffe6bf" }));
  windowGlow.position.set(-10.95, 6.5, -2);
  windowGlow.rotation.y = Math.PI / 2;
  room.add(windowGlow);
  const sun = new THREE.SpotLight("#ffd9a8", 130, 30, 0.32, 0.6, 1.4);
  sun.position.set(-10.5, 6.5, -2);
  sun.target.position.set(0.5, 0, 0.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  room.add(sun, sun.target);
  const shaftGeo = new THREE.CylinderGeometry(0.9, 3.2, 13, 24, 1, true);
  shaftGeo.translate(0, -6.5, 0);
  const shaft = new THREE.Mesh(shaftGeo, new THREE.MeshBasicMaterial({ color: "#ffdfb0", transparent: true, opacity: 0.06, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  shaft.position.copy(sun.position);
  shaft.lookAt(sun.target.position);
  shaft.rotateX(-Math.PI / 2);
  room.add(shaft);
  /* Dust drifting in the light. */
  const N = 220, pos = new Float32Array(N * 3), seeds = [];
  for (let i = 0; i < N; i++) {
    const k = Math.random();
    const p = sun.position.clone().lerp(sun.target.position, k);
    seeds.push({ base: p.add(new THREE.Vector3((Math.random() - 0.5) * 3 * k + 0.4, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 3 * k)), ph: Math.random() * 6 });
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: "#fff1d6", size: 0.05, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending }));
  dust.frustumCulled = false;
  room.add(dust);

  /* The door on the right, and the hall light behind it. */
  const doorway = new THREE.Group();
  doorway.position.set(11.9, -3.2, 3);
  doorway.rotation.y = -Math.PI / 2;
  room.add(doorway);
  const hall = new THREE.Mesh(new THREE.PlaneGeometry(3, 6.2), new THREE.MeshBasicMaterial({ color: "#c9b28c" }));
  hall.position.set(0, 3.1, -0.05);
  doorway.add(hall);
  const doorPivot = new THREE.Group();
  doorPivot.position.set(-1.5, 0, 0);
  doorway.add(doorPivot);
  const door = new THREE.Mesh(new THREE.BoxGeometry(3, 6.2, 0.2), darkWood);
  door.position.set(1.5, 3.1, 0.1);
  doorPivot.add(door);
  /* Someone stands in the light: only a shape against it. */
  const figure = new THREE.Group();
  const shadowMat = new THREE.MeshBasicMaterial({ color: "#0a0705" });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.75, 2.6, 4, 12), shadowMat);
  body.position.y = 2.2;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), shadowMat);
  head.position.y = 4.6;
  figure.add(body, head);
  figure.position.set(0.2, 0, -0.8);
  figure.visible = false;
  doorway.add(figure);
  /* The hall light spills in when the door opens (made now, at no
     strength, so lights never change number mid-film). */
  const hallLight = new THREE.SpotLight("#ffe2b4", 0, 26, 0.6, 0.7, 1.3);
  hallLight.position.set(11.5, 3, 3);
  hallLight.target.position.set(0, -0.4, 0.5);
  room.add(hallLight, hallLight.target);

  /* Cobwebs on the board's corners and between its pieces. */
  const webs = [];
  for (const [x, z, ry, sz] of [[-4.35, -4.35, 0, 1.6], [4.35, -4.35, -Math.PI / 2, 1.4], [-4.35, 4.35, Math.PI / 2, 1.2], [4.35, 4.35, Math.PI, 1.5]]) {
    const w = cobweb(sz, webs.length + 3);
    w.position.set(x, -0.42, z);
    w.rotation.set(0, ry, 0);
    w.rotateX(-0.55);
    room.add(w);
    webs.push(w);
  }
  for (const [x, z] of [[-1.5, -2.5], [2, -2.6], [-2.5, 2.6], [1.2, 2.4]]) {
    const w = cobweb(1.0, webs.length + 9);
    w.position.set(x, 0.05, z);
    w.rotation.set(-Math.PI / 2 + 0.25, 0, Math.random() * 6);
    room.add(w);
    webs.push(w);
  }

  /* The board rig: the board's own squares and frame, and every character,
     moved as one when it is lifted, carried and thrown. */
  const rig = new THREE.Group();
  scene.add(rig);
  for (const tile of ts.tiles) rig.attach(tile);
  for (const m of ts.boardMeshes ?? []) rig.attach(m);
  /* (Found first, moved after: moving things while walking the scene's
     list of children would skip or break the walk.) */
  const frame = scene.children.filter((o) => o.isMesh && o.geometry?.parameters?.width === 8.7);
  for (const o of frame) rig.attach(o);
  for (const e of ts.pieces.values()) rig.attach(e.group);

  /* Dust coming off the board as it's lifted. */
  const puff = [];
  const puffGeo = new THREE.BufferGeometry();
  const puffPos = new Float32Array(160 * 3);
  puffGeo.setAttribute("position", new THREE.BufferAttribute(puffPos, 3));
  const puffMat = new THREE.PointsMaterial({ color: "#d8cdb8", size: 0.12, transparent: true, opacity: 0, depthWrite: false });
  const puffPts = new THREE.Points(puffGeo, puffMat);
  puffPts.frustumCulled = false;
  scene.add(puffPts);

  /* The hands, out of sight until they reach in. */
  const hands = [-1, 1].map((side) => { const h = buildHand(side); h.visible = false; scene.add(h); return h; });

  /* ---- The yard: grey sky, wet ground, the bin with its lid up ---- */
  const yard = new THREE.Group();
  yard.position.copy(YARD);
  scene.add(yard);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: "#5a5f68", roughness: 0.55 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -9; ground.receiveShadow = true;
  yard.add(ground);
  const skyMat = new THREE.MeshBasicMaterial({ color: "#a9b6c6", fog: false });
  const skyWall = new THREE.Mesh(new THREE.PlaneGeometry(200, 90), skyMat);
  skyWall.position.set(0, 10, -60);
  yard.add(skyWall);
  const house = new THREE.Mesh(new THREE.BoxGeometry(30, 22, 12), new THREE.MeshStandardMaterial({ color: "#3a3430", roughness: 1 }));
  house.position.set(-22, 2, -24);
  yard.add(house);
  const binMat = new THREE.MeshStandardMaterial({ color: "#2f4a38", roughness: 0.55, metalness: 0.3 });
  const bin = new THREE.Mesh(new THREE.CylinderGeometry(5, 4.4, 11, 32, 1, true), binMat);
  bin.material.side = THREE.DoubleSide;
  bin.position.set(0, -3.5, -14);
  yard.add(bin);
  const binFloor = new THREE.Mesh(new THREE.CircleGeometry(4.4, 32), new THREE.MeshBasicMaterial({ color: "#050403" }));
  binFloor.rotation.x = -Math.PI / 2; binFloor.position.set(0, -6, -14);
  yard.add(binFloor);
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, 2, -19);
  yard.add(lidPivot);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.2, 0.4, 32), binMat);
  lid.position.set(0, 0, 5);
  lidPivot.add(lid);
  lidPivot.rotation.x = -1.9; // up and open
  const yardLight = new THREE.DirectionalLight("#dfe7f2", 0);
  /* A soft fill from the sky side, so the board reads against the grey. */
  const yardFill = new THREE.PointLight("#c8d6ea", 0, 60, 1.2);
  yardFill.position.copy(YARD).add(new THREE.Vector3(4, 8, 22));
  scene.add(yardFill);
  yardLight.position.copy(YARD).add(new THREE.Vector3(10, 30, 10));
  yardLight.target.position.copy(YARD);
  scene.add(yardLight, yardLight.target);

  let t = 0;
  return {
    rig, hands, webs, doorPivot, figure, hallLight, hall, sun, room, yard, lidPivot,
    binMouth: YARD.clone().add(new THREE.Vector3(0, 2, -14)),
    /** The yard's daylight on (the room's lights don't reach it). */
    setYardLight(k) { yardLight.intensity = 1.3 * k; yardFill.intensity = 22 * k; },
    /** A puff of dust falling off the board. */
    puff() {
      puff.length = 0;
      for (let i = 0; i < 160; i++) {
        const a = Math.random() * Math.PI * 2, d = Math.random() * 4.5;
        puff.push({ p: rig.position.clone().add(new THREE.Vector3(Math.cos(a) * d, 0.2, Math.sin(a) * d)), v: new THREE.Vector3((Math.random() - 0.5) * 0.8, -0.4 - Math.random() * 1.2, (Math.random() - 0.5) * 0.8) });
      }
      puffMat.opacity = 0.8;
    },
    update(dt) {
      t += dt;
      for (let i = 0; i < N; i++) {
        const s = seeds[i];
        pos[i * 3] = s.base.x + Math.sin(t * 0.3 + s.ph) * 0.25;
        pos[i * 3 + 1] = s.base.y + Math.sin(t * 0.2 + s.ph * 2) * 0.3;
        pos[i * 3 + 2] = s.base.z + Math.cos(t * 0.25 + s.ph) * 0.25;
      }
      dustGeo.attributes.position.needsUpdate = true;
      if (puffMat.opacity > 0) {
        for (let i = 0; i < puff.length; i++) {
          const q = puff[i];
          q.p.addScaledVector(q.v, dt);
          puffPos[i * 3] = q.p.x; puffPos[i * 3 + 1] = q.p.y; puffPos[i * 3 + 2] = q.p.z;
        }
        puffGeo.attributes.position.needsUpdate = true;
        puffMat.opacity = Math.max(0, puffMat.opacity - dt * 0.35);
      }
    },
  };
}
