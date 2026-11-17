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

/** Makes a bolt in `scene` from `from` to `to`. Call the returned
 *  update(dt) every frame; it returns false once the bolt has faded and
 *  removed itself. `color` tints the flash. */
export function strike(scene, from, to, { width = 0.06, life = 0.32, flash = 60, color = "#9fd6ff" } = {}) {
  const group = new THREE.Group();
  const main = jagged(from, to, from.distanceTo(to) * 0.12, 14);
  const curve = new THREE.CatmullRomCurve3(main, false, "catmullrom", 0.1);
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
  const light = new THREE.PointLight(color, flash, 40, 1.4);
  light.position.copy(to).add(new THREE.Vector3(0, 1.5, 0));
  group.add(light);
  scene.add(group);
  let t = 0;
  return (dt) => {
    t += dt;
    const k = 1 - t / life, flick = Math.random() < 0.3 ? 0.4 : 1;
    if (k <= 0) {
      scene.remove(group);
      group.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
      return false;
    }
    mat.opacity = k * flick;
    halo.opacity = 0.35 * k * flick;
    light.intensity = flash * k * flick;
    return true;
  };
}
