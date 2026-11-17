/* The ground the board stands on in the lake and the volcano: not a puck
   cut out with straight walls, but a lump of rock or ice. Flat where the
   board sits, then uneven toward a ragged, rounded edge, and below it a
   cliff face with ledges and overhangs dropping into the water or lava.
   Two meshes so each gets its own texture mapping: the top is mapped flat
   from above, the cliff is mapped round its side, so neither stretches. */
import * as THREE from "three";

/* Smooth value noise in 2D, tiling-free, enough for ground. */
function makeNoise(seed) {
  const hash = (x, y) => {
    let h = (x * 374761393 + y * 668265263 + seed * 1442695040) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  const smooth = (t) => t * t * (3 - 2 * t);
  const value = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = smooth(x - xi), yf = smooth(y - yi);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return (a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf) * 2 - 1;
  };
  /* A few octaves: big shapes with smaller detail on top. */
  return (x, y) => value(x, y) * 0.6 + value(x * 2.1 + 7, y * 2.1 + 3) * 0.28 + value(x * 4.3 + 1, y * 4.3 + 9) * 0.12;
}

/**
 * radius   rough size of the top
 * flat     half-width of the square kept flat for the board
 * depth    how far the cliff drops below the top
 * bumps    height of the uneven ground near the edge
 * flare    how far the cliff widens as it goes down (0.2 = 20%)
 * texScale world units per texture repeat
 * detail   1 = full detail, less for small far-off pieces
 */
export function buildLandform({ radius = 7, flat = 5.3, depth = 3, bumps = 0.35, flare = 0.25, seed = 1, texScale = 3, topMaterial, sideMaterial, detail = 1 }) {
  const noise = makeNoise(seed);
  /* detail 1 for the ground under the board; small floes far off need less. */
  const SEG = Math.max(16, Math.round(128 * detail)), RINGS = Math.max(4, Math.round(26 * detail)), DOWN = Math.max(3, Math.round(14 * detail));
  const edgeR = (a) => radius * (1 + 0.07 * noise(Math.cos(a) * 1.6 + 11, Math.sin(a) * 1.6 + 5) + 0.03 * noise(Math.cos(a) * 6, Math.sin(a) * 6));
  /* Height of the top at (x, z): flat on the board's square, then lumpy,
     rolling off over the last stretch to meet the cliff. */
  const topY = (x, z, r, R) => {
    const fromBoard = Math.max(Math.abs(x), Math.abs(z)) - flat;
    const out = Math.min(1, Math.max(0, fromBoard / Math.max(0.01, R - flat)));
    const t = out * out * (3 - 2 * out);
    const lumps = noise(x * 0.55, z * 0.55) * bumps * t;
    const roll = Math.pow(Math.max(0, (r / R - 0.88) / 0.12), 2) * 0.35;
    return lumps - roll;
  };

  /* The top: rings from the centre to the edge. */
  const tp = [], tuv = [], tidx = [];
  tp.push(0, 0, 0); tuv.push(0.5, 0.5);
  for (let i = 1; i <= RINGS; i++) {
    for (let j = 0; j < SEG; j++) {
      const a = (j / SEG) * Math.PI * 2, R = edgeR(a), r = (i / RINGS) * R;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      tp.push(x, topY(x, z, r, R), z);
      tuv.push(x / texScale, z / texScale);
    }
  }
  for (let j = 0; j < SEG; j++) tidx.push(0, 1 + ((j + 1) % SEG), 1 + j);
  for (let i = 1; i < RINGS; i++) {
    const a0 = 1 + (i - 1) * SEG, a1 = 1 + i * SEG;
    for (let j = 0; j < SEG; j++) {
      const j1 = (j + 1) % SEG;
      tidx.push(a0 + j, a0 + j1, a1 + j, a0 + j1, a1 + j1, a1 + j);
    }
  }
  const topGeo = new THREE.BufferGeometry();
  topGeo.setAttribute("position", new THREE.Float32BufferAttribute(tp, 3));
  topGeo.setAttribute("uv", new THREE.Float32BufferAttribute(tuv, 2));
  topGeo.setIndex(tidx);
  topGeo.computeVertexNormals();

  /* The cliff: from the top's edge down, jagged and ledged, wider below. */
  const sp = [], suv = [], sidx = [];
  const lastRing = 1 + (RINGS - 1) * SEG;
  for (let k = 0; k <= DOWN; k++) {
    const d = k / DOWN;
    for (let j = 0; j <= SEG; j++) {
      const jj = j % SEG, a = (jj / SEG) * Math.PI * 2;
      const ex = tp[(lastRing + jj) * 3], ey = tp[(lastRing + jj) * 3 + 1], ez = tp[(lastRing + jj) * 3 + 2];
      const R = Math.hypot(ex, ez);
      /* Ledges: the face steps in and out as it goes down. */
      const jag = noise(Math.cos(a) * 3 + d * 4, Math.sin(a) * 3 + d * 2.5) * 0.45 + noise(a * 5, d * 9) * 0.18;
      const r = k === 0 ? R : R * (1 + flare * d) + jag * (0.4 + d);
      const y = ey - depth * d + (k === 0 ? 0 : noise(a * 4 + 3, d * 6) * 0.25);
      sp.push(Math.cos(a) * r, y, Math.sin(a) * r);
      suv.push(((j / SEG) * Math.PI * 2 * radius) / texScale, (y - ey) / texScale);
    }
  }
  for (let k = 0; k < DOWN; k++) {
    for (let j = 0; j < SEG; j++) {
      const a = k * (SEG + 1) + j, b = a + SEG + 1;
      sidx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const sideGeo = new THREE.BufferGeometry();
  sideGeo.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3));
  sideGeo.setAttribute("uv", new THREE.Float32BufferAttribute(suv, 2));
  sideGeo.setIndex(sidx);
  sideGeo.computeVertexNormals();

  const group = new THREE.Group();
  const top = new THREE.Mesh(topGeo, topMaterial);
  const side = new THREE.Mesh(sideGeo, sideMaterial);
  top.receiveShadow = side.receiveShadow = true;
  side.castShadow = true;
  group.add(top, side);
  group.userData.edgeRadius = edgeR;
  return group;
}
