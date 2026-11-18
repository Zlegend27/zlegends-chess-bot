/* The worlds' real textures and skies (public/tactica/env/, public domain,
   fetched by scripts/fetch-tactica-art.mjs; credits in CREDITS.txt there).
   Each scene is built at once with plain materials, and the art is laid on
   as it arrives, so nothing waits on the network. */
import * as THREE from "three";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const textureLoader = new THREE.TextureLoader();
const textures = new Map();

/** A texture from a world's folder ("bin", "ice", ...), tiled `repeat`
 *  times. Colour maps (`color`) are read as sRGB, the rest as data. The
 *  file is fetched once; each call gets its own copy, so repeats can
 *  differ. */
export function art(world, name, repeat = 1, color = name.endsWith("_diff")) {
  const url = `/tactica/env/${world}/${name}.jpg`;
  if (!textures.has(url)) textures.set(url, textureLoader.loadAsync(url).catch(() => null));
  return textures.get(url).then((base) => {
    if (!base) return null;
    const t = base.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    const [rx, ry] = Array.isArray(repeat) ? repeat : [repeat, repeat];
    t.repeat.set(rx, ry);
    t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = 4;
    t.needsUpdate = true;
    return t;
  });
}

/** Lays a texture set ("wall" -> wall_diff, wall_nor, wall_rough) on a
 *  material when it arrives. `tint` multiplies the colour map. */
export function dress(material, world, prefix, { repeat = 1, maps = ["diff", "nor", "rough"], normal = 1, tint = null } = {}) {
  const slots = { diff: "map", nor: "normalMap", rough: "roughnessMap", glow: "emissiveMap" };
  for (const m of maps) {
    art(world, `${prefix}_${m}`, repeat, m === "diff" || m === "glow").then((t) => {
      if (!t) return;
      material[slots[m]] = t;
      if (m === "diff") material.color.set(tint ?? "#ffffff");
      if (m === "nor") material.normalScale.set(normal, normal);
      if (m === "rough") material.roughness = 1;
      material.needsUpdate = true;
    });
  }
  return material;
}

const skies = new Map();
/** A world's sky: used for the scene's reflections and light, and, with
 *  `background`, shown behind everything. `intensity` dims the shown sky. */
export function sky(ts, world, { background = false, intensity = 1, blur = 0 } = {}) {
  const url = `/tactica/env/${world}/sky.hdr`;
  if (!skies.has(url)) skies.set(url, new HDRLoader().loadAsync(url).catch(() => null));
  return skies.get(url).then((hdr) => {
    if (!hdr || !ts.renderer) return;
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    const pmrem = new THREE.PMREMGenerator(ts.renderer);
    ts.scene.environment = pmrem.fromEquirectangular(hdr).texture;
    pmrem.dispose();
    if (background) {
      ts.scene.background = hdr;
      ts.scene.backgroundIntensity = ts.scene.userData.skyIntensity ?? intensity;
      ts.scene.backgroundBlurriness = blur;
    }
    ts.wake?.();
  });
}

const gltfLoader = new GLTFLoader();
const models = new Map();
/** A photographed 3D model from public/tactica/models/<id>/, fetched once.
 *  Resolves to a template resting on y = 0, centred, at its real size
 *  (userData.size, in metres), or null if it could not load. */
export function model(id) {
  if (!models.has(id)) {
    /* Poly Haven props are folder/folder.gltf; others are named in full. */
    const url = id.includes(".") ? `/tactica/models/${id}` : `/tactica/models/${id}/${id}.gltf`;
    models.set(id, gltfLoader.loadAsync(url).then((gltf) => {
      const root = gltf.scene;
      /* Some models carry several levels of detail (name_LOD0, _LOD1...),
         all visible at once. Keep one: LOD1, half the detail, is plenty
         for scenery. */
      const lods = [];
      root.traverse((o) => { const m = /_LOD(\d+)$/.exec(o.name); if (m) lods.push([o, +m[1]]); });
      if (lods.length > 1) {
        const keep = lods.some(([, n]) => n === 1) ? 1 : 0;
        for (const [o, n] of lods) if (n !== keep) o.removeFromParent();
      }
      const box = new THREE.Box3().setFromObject(root);
      root.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
      const holder = new THREE.Group();
      holder.add(root);
      holder.userData.size = box.getSize(new THREE.Vector3());
      root.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = o.receiveShadow = true;
        for (const k of ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap"]) if (o.material[k]) o.material[k].anisotropy = 4;
      });
      return holder;
    }).catch(() => null));
  }
  return models.get(id);
}

const tinted = new Map();
/** Puts a copy of a model into `parent` as soon as it has loaded, scaled so
 *  its longest side is `size`, at `at`, turned by `rot`. `tint` multiplies
 *  its colours (snow on rocks, soot in the volcano). Returns the holder at
 *  once, so it can be moved before the model arrives. */
export function prop(ts, parent, id, { size = 1, at = [0, 0, 0], rot = [0, 0, 0], tint = null, sink = 0, upright = false, flip = false, part = null, env = null } = {}) {
  const holder = new THREE.Group();
  holder.position.set(...at);
  holder.rotation.set(...rot);
  parent.add(holder);
  model(id).then((tpl) => {
    if (!tpl) return;
    const copy = tpl.clone(true);
    /* `part`: some files hold several variants in one spot (four bottles,
       four tins); keep only the one named. */
    if (part) copy.traverse((o) => { if (o.isMesh && !o.name.startsWith(part)) o.visible = false; });
    const s = tpl.userData.size, long = Math.max(s.x, s.y, s.z);
    copy.scale.setScalar(size / long);
    /* `upright` stands its longest side up (a sword); `flip` turns it over. */
    if (upright && s.x === long) copy.rotation.z = Math.PI / 2;
    else if (upright && s.z === long) copy.rotation.x = Math.PI / 2;
    if (flip) copy.rotation.x += Math.PI;
    const wrap = new THREE.Group();
    wrap.add(copy);
    wrap.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(wrap);
    copy.position.set(-(b.min.x + b.max.x) / 2, -b.min.y - sink * size, -(b.min.z + b.max.z) / 2);
    /* `tint` multiplies its colours; `env` sets how strongly it reflects the
       sky (a dark bin wants its rubbish dull, not chrome). */
    if (tint || env != null) {
      copy.traverse((o) => {
        if (!o.isMesh) return;
        const key = `${o.material.uuid}|${tint}|${env}`;
        if (!tinted.has(key)) {
          const m = o.material.clone();
          if (tint) m.color.multiply(new THREE.Color(tint));
          if (env != null) m.envMapIntensity = env;
          tinted.set(key, m);
        }
        o.material = tinted.get(key);
      });
    }
    holder.add(wrap);
    ts.wake?.();
  });
  return holder;
}

/** Changes a world's mood: sets the flat colour while the sky is still
 *  loading (or missing), or dims/brightens the photographed sky once it is
 *  there. The sky remembers the brightness if it arrives later. */
export function skyMood(scene, color, intensity) {
  scene.userData.skyIntensity = intensity;
  if (scene.background?.isColor) scene.background.set(color);
  else if (scene.background) scene.backgroundIntensity = intensity;
}
