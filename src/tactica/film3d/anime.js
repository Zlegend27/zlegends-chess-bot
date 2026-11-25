/* The anime look for the 3D films: cel shading and ink outlines.

   toonify(root) swaps lit materials for cel-shaded ones (light in three flat
   bands, like painted animation), keeping each one's colours and textures.
   outline(root) gives every solid part an ink line: a slightly fattened
   copy drawn back-faces-only in near-black, the classic "inverted hull".
   Both cache what they make, so a material or shape used by many parts is
   converted once. */
import * as THREE from "three";

let bands = null;
/** Three bands of light (shadow, mid, lit), hard-edged. */
function gradient() {
  if (bands) return bands;
  const data = new Uint8Array([70, 70, 70, 255, 160, 160, 160, 255, 255, 255, 255, 255]);
  bands = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  bands.minFilter = bands.magFilter = THREE.NearestFilter;
  bands.generateMipmaps = false;
  bands.needsUpdate = true;
  return bands;
}

const toonCache = new Map();
function toToon(m) {
  if (!m || !(m.isMeshStandardMaterial || m.isMeshPhysicalMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial)) return m;
  if (toonCache.has(m.uuid)) return toonCache.get(m.uuid);
  const t = new THREE.MeshToonMaterial({
    color: m.color, map: m.map, gradientMap: gradient(),
    emissive: m.emissive, emissiveMap: m.emissiveMap, emissiveIntensity: m.emissiveIntensity,
    normalMap: m.normalMap, normalScale: m.normalScale, alphaMap: m.alphaMap,
    transparent: m.transparent, opacity: m.opacity, side: m.side, depthWrite: m.depthWrite,
  });
  t.name = (m.name || "") + "_toon";
  toonCache.set(m.uuid, t);
  return t;
}

/** Cel-shades everything under `root` (materials only; shapes untouched). */
export function toonify(root) {
  root.traverse((o) => {
    if (!o.isMesh || o.userData.ink) return;
    o.material = Array.isArray(o.material) ? o.material.map(toToon) : toToon(o.material);
  });
}

const inkCache = new Map();
function inkMaterial(color, width) {
  const key = `${color}|${width}`;
  if (inkCache.has(key)) return inkCache.get(key);
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.inkWidth = { value: width };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float inkWidth;")
      .replace("#include <begin_vertex>", "vec3 transformed = vec3(position) + normalize(normal) * inkWidth;");
  };
  m.customProgramCacheKey = () => `ink${width}`;
  inkCache.set(key, m);
  return m;
}

/** Ink lines round every solid part under `root`. `width` is in the parts'
 *  own units; tiny parts (eyes, studs) get none, so they stay crisp. */
export function outline(root, { color = "#140a06", width = 0.02, minSize = 0.06 } = {}) {
  const parts = [];
  root.traverse((o) => {
    if (!o.isMesh || o.userData.ink || o.userData.inked || !o.geometry?.attributes?.normal) return;
    const mats = [o.material].flat();
    if (mats.some((m) => m.transparent || m.blending === THREE.AdditiveBlending)) return;
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    if (o.geometry.boundingSphere.radius < minSize) return;
    parts.push(o);
  });
  for (const o of parts) {
    /* A skinned part (the game's characters) gets a skinned outline on the
       same bones, so the ink moves with it. */
    const ink = o.isSkinnedMesh ? new THREE.SkinnedMesh(o.geometry, inkMaterial(color, width)) : new THREE.Mesh(o.geometry, inkMaterial(color, width));
    ink.userData.ink = true;
    ink.renderOrder = -1;
    o.add(ink);
    if (o.isSkinnedMesh) ink.bind(o.skeleton, o.bindMatrix);
    o.userData.inked = true;
  }
}

/** Parts of a character by name, for the film to hide and show (eyes and
 *  arms sprout in the waking scene). */
export function partsNamed(root, test) {
  const found = [];
  root.traverse((o) => { if (o.name && test(o.name)) found.push(o); });
  return found;
}

/* ---- Sharp style ----
   For models that should read crisp rather than soft: flat-faceted cel
   shading (each face lit as one flat panel, so edges stay sharp), and ink
   along the creases as well as round the outside. Used by Zlegend2700
   (sets/spaceRush.js); meant for the bosses too. */

const sharpCache = new Map();
/** A cel-shaded, flat-faceted material in `color`. */
export function sharpMaterial(color, { emissive = null, emissiveIntensity = 1, side = THREE.FrontSide } = {}) {
  const key = `${color}|${emissive}|${emissiveIntensity}|${side}`;
  if (sharpCache.has(key)) return sharpCache.get(key);
  const m = new THREE.MeshToonMaterial({ color, gradientMap: gradient(), flatShading: true, side });
  if (emissive) { m.emissive = new THREE.Color(emissive); m.emissiveIntensity = emissiveIntensity; }
  sharpCache.set(key, m);
  return m;
}

const creaseCache = new Map();
/** Ink lines along every sharp edge of the meshes under `root` (where the
 *  faces meet at more than `angle` degrees), drawn as thin lines. */
export function crease(root, { color = "#160a26", angle = 28, minSize = 0.03 } = {}) {
  const ink = creaseCache.get(color) ?? new THREE.LineBasicMaterial({ color });
  creaseCache.set(color, ink);
  const parts = [];
  root.traverse((o) => {
    if (!o.isMesh || o.userData.ink || !o.geometry?.attributes?.position) return;
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    if (o.geometry.boundingSphere.radius < minSize) return;
    parts.push(o);
  });
  for (const o of parts) {
    const lines = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, angle), ink);
    lines.userData.ink = true;
    o.add(lines);
  }
}
