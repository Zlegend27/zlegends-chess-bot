/* Lightning for the demon's realm: a jagged, branching bolt between two
   points that lights up for a moment and fades, with a flash of light. */
import * as THREE from "three";

const boltMat = new THREE.MeshBasicMaterial({ color: "#e6f4ff", transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
const glowMat = new THREE.MeshBasicMaterial({ color: "#7cc8ff", transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false });

function jagged(from, to, jitter, steps) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const p = from.clone().lerp(to, i / steps);
    if (i > 0 && i < steps) p.add(new THREE.Vector3((Math.random() - 0.5) * jitter, (Math.random() - 0.5) * jitter * 0.4, (Math.random() - 0.5) * jitter));
    pts.push(p);
  }
  return pts;
}

/* The flash lights are made once per scene and reused. A light added or
   removed changes how many lights every material's shader is built for, so
   a fresh light per bolt made the whole world recompile on each strike: the
   demon's realm stuttered at every flash. Call prepareLightning when the
   world is built. */
const POOL = 2;
export function prepareLightning(scene) {
  if (scene.userData.boltLights) return scene.userData.boltLights;
  const lights = Array.from({ length: POOL }, () => {
    const l = new THREE.PointLight("#9fd6ff", 0, 40, 1.4);
    scene.add(l);
    return l;
  });
  scene.userData.boltLights = { lights, next: 0 };
  return scene.userData.boltLights;
}

/** Makes a bolt in `scene` from `from` to `to`. Call the returned
 *  update(dt) every frame; it returns false once the bolt has faded and
 *  removed itself. `color` tints the flash. */
export function strike(scene, from, to, { width = 0.06, life = 0.32, flash = 60, color = "#9fd6ff" } = {}) {
  const group = new THREE.Group();
  const main = jagged(from, to, from.distanceTo(to) * 0.12, 14);
  const curve = new THREE.CatmullRomCurve3(main, false, "catmullrom", 0.1);
  /* Copies of shared materials, never disposed: disposing the last one
     would throw its shader away and the next bolt would rebuild it. */
  const mat = boltMat.clone(), halo = glowMat.clone();
  group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 48, width, 5, false), mat));
  group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 48, width * 4, 5, false), halo));
  /* Two branches forking off. */
  for (let b = 0; b < 2; b++) {
    const at = main[3 + Math.floor(Math.random() * 8)];
    const end = at.clone().add(new THREE.Vector3((Math.random() - 0.5) * 4, -1 - Math.random() * 3, (Math.random() - 0.5) * 4));
    const c = new THREE.CatmullRomCurve3(jagged(at, end, 1.2, 6));
    group.add(new THREE.Mesh(new THREE.TubeGeometry(c, 16, width * 0.6, 4, false), mat));
  }
  const pool = prepareLightning(scene);
  const light = pool.lights[pool.next++ % pool.lights.length];
  light.color.set(color);
  light.position.copy(to).add(new THREE.Vector3(0, 1.5, 0));
  light.intensity = flash;
  scene.add(group);
  let t = 0;
  return (dt) => {
    t += dt;
    /* A smooth fade, no strobing: the old random flicker read as flashing. */
    const k = Math.max(0, 1 - t / life);
    if (k <= 0) {
      scene.remove(group);
      light.intensity = 0;
      group.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
      return false;
    }
    mat.opacity = k;
    halo.opacity = 0.35 * k;
    light.intensity = flash * k * k;
    return true;
  };
}
