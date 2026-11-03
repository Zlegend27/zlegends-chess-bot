/* Chess Tactica's 3D view: a board with characters standing on it, two
   cameras, and move animations. It only shows what TacticaPage tells it to and
   reports taps and swipes back, so the chess rules can't be affected by
   anything drawn here. Characters are flat sprites that always face the
   camera, which keeps phones fast and lets art be swapped in later. */
import * as THREE from "three";

const SPRITE_SIZE = 0.95;
const TEXTURE_PX = 256;
const SWIPE_PX = 50;
const TAP_SLOP_PX = 10;
const CAMERA_MS = 650;
const MOVE_MS = 420;
const CAPTURE_MS = 320;
const KNIGHT_HOP = 1.1;

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const textureCache = new Map();
/** Piece art drawn at a size that stays sharp up close. */
function textureFor(url) {
  if (!textureCache.has(url)) {
    textureCache.set(url, new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = TEXTURE_PX;
        canvas.getContext("2d").drawImage(img, 0, 0, TEXTURE_PX, TEXTURE_PX);
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        resolve(texture);
      };
      img.onerror = () => resolve(null);
      img.src = url;
    }));
  }
  return textureCache.get(url);
}

export class TacticaScene {
  /** `colors` is { light, dark, background, highlight, target, select }. The
   *  solver's side is always nearest the camera. */
  constructor(canvas, { colors, flipped, onTap, onSwipe, onLost }) {
    this.canvas = canvas;
    this.flipped = flipped;
    this.onTap = onTap;
    this.onSwipe = onSwipe;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "low-power" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(colors.background);
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    this.camPos = new THREE.Vector3(0, 11, 8);
    this.camLook = new THREE.Vector3(0, 0, 0.6);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
    this.tweens = [];
    this.sprites = new Map();
    this.marks = new THREE.Group();
    this.colors = colors;
    this.frameTimes = [];
    this.buildBoard();
    this.scene.add(this.marks);

    this.onLostEvent = (e) => { e.preventDefault(); onLost?.(); };
    canvas.addEventListener("webglcontextlost", this.onLostEvent);
    this.bindPointer();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement);
    this.resize();
    this.running = true;
    this.lastFrame = performance.now();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  /** World position of a square's centre. */
  worldOf(sq) {
    const file = sq % 8, rank = (sq / 8) | 0;
    const x = (this.flipped ? 7 - file : file) - 3.5;
    const z = (this.flipped ? rank : 7 - rank) - 3.5;
    return new THREE.Vector3(x, 0, z);
  }

  buildBoard() {
    const base = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.4, 8.6), new THREE.MeshBasicMaterial({ color: 0x120a26 }));
    base.position.y = -0.21;
    this.scene.add(base);
    this.tiles = [];
    const tileGeometry = new THREE.PlaneGeometry(1, 1);
    for (let sq = 0; sq < 64; sq++) {
      const light = ((sq % 8) + ((sq / 8) | 0)) % 2 === 1;
      const tile = new THREE.Mesh(tileGeometry, new THREE.MeshBasicMaterial({ color: light ? this.colors.light : this.colors.dark }));
      tile.rotation.x = -Math.PI / 2;
      tile.position.copy(this.worldOf(sq));
      tile.userData.sq = sq;
      this.scene.add(tile);
      this.tiles.push(tile);
    }
    this.shadowGeometry = new THREE.CircleGeometry(0.32, 24);
    this.shadowMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false });
  }

  /** Replaces every character with `pieces`: [{ sq, url }]. */
  async setPieces(pieces) {
    const textures = await Promise.all(pieces.map((p) => textureFor(p.url)));
    for (const { group } of this.sprites.values()) this.scene.remove(group);
    this.sprites.clear();
    pieces.forEach((piece, i) => {
      if (!textures[i]) return;
      const group = new THREE.Group();
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: textures[i], transparent: true }));
      sprite.center.set(0.5, 0.02);
      sprite.scale.set(SPRITE_SIZE, SPRITE_SIZE, 1);
      sprite.userData.sq = piece.sq;
      const shadow = new THREE.Mesh(this.shadowGeometry, this.shadowMaterial);
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = 0.01;
      group.add(shadow, sprite);
      group.position.copy(this.worldOf(piece.sq));
      this.scene.add(group);
      this.sprites.set(piece.sq, { group, sprite });
    });
    this.wake();
  }

  /** Highlights for the selected character: its square, every legal
   *  destination with an arrow toward it, and the chosen one. */
  setMarks({ selected = null, targets = [], chosen = null, captures = [] } = {}) {
    this.marks.clear();
    const flat = (geometry, color, opacity, at, y = 0.02) => {
      const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.copy(at).setY(y);
      this.marks.add(mesh);
      return mesh;
    };
    if (selected != null) flat(new THREE.PlaneGeometry(0.96, 0.96), this.colors.select, 0.45, this.worldOf(selected));
    const from = selected != null ? this.worldOf(selected) : null;
    for (const sq of targets) {
      const to = this.worldOf(sq);
      const isChosen = sq === chosen;
      const color = captures.includes(sq) ? this.colors.attack : isChosen ? this.colors.target : this.colors.highlight;
      flat(isChosen ? new THREE.PlaneGeometry(0.96, 0.96) : new THREE.CircleGeometry(0.16, 20), color, isChosen ? 0.6 : 0.85, to, 0.03);
      if (from) this.addArrow(from, to, color, isChosen ? 0.75 : 0.35);
    }
    this.wake();
  }

  addArrow(from, to, color, opacity) {
    const dir = new THREE.Vector3().subVectors(to, from);
    const length = dir.length() - 0.35;
    if (length <= 0.2) return;
    const shape = new THREE.Shape();
    const w = 0.07, head = 0.24;
    shape.moveTo(-w, 0); shape.lineTo(w, 0); shape.lineTo(w, length - head); shape.lineTo(head * 0.8, length - head);
    shape.lineTo(0, length); shape.lineTo(-head * 0.8, length - head); shape.lineTo(-w, length - head); shape.closePath();
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = Math.atan2(-dir.x, -dir.z) + Math.PI;
    mesh.position.copy(from).setY(0.025);
    const start = dir.clone().normalize().multiplyScalar(0.25);
    mesh.position.add(start);
    this.marks.add(mesh);
  }

  /** Strategic view: the whole board. */
  showBoard() {
    this.moveCamera(new THREE.Vector3(0, 11, 8), new THREE.Vector3(0, 0, 0.6));
  }

  /** Tactical view: just behind the character, looking across the board. A
   *  far destination pulls the camera back so it stays in sight. */
  showCloseUp(sq, destination = null) {
    const at = this.worldOf(sq);
    const toward = destination != null ? this.worldOf(destination) : at.clone().add(new THREE.Vector3(0, 0, -2.5));
    const reach = destination != null ? at.distanceTo(toward) : 2.5;
    const pull = 1 + Math.max(0, reach - 2) * 0.22;
    const look = new THREE.Vector3().addVectors(at, toward).multiplyScalar(0.5).setY(0.4);
    const position = at.clone().add(new THREE.Vector3(0, 2.3 * pull, 3.1 * pull));
    this.moveCamera(position, look);
  }

  moveCamera(position, look) {
    const fromPos = this.camPos.clone(), fromLook = this.camLook.clone();
    this.tween(reducedMotion() ? 0 : CAMERA_MS, (t) => {
      const k = ease(t);
      this.camPos.lerpVectors(fromPos, position, k);
      this.camLook.lerpVectors(fromLook, look, k);
    });
  }

  /** Moves a character; a knight leaps. A captured character sinks and fades
   *  first. Resolves when done. */
  animateMove(from, to, { knight = false, captured = null } = {}) {
    const mover = this.sprites.get(from);
    const victim = captured != null ? this.sprites.get(captured) : null;
    if (!mover) return Promise.resolve();
    const a = this.worldOf(from), b = this.worldOf(to);
    const fast = reducedMotion();
    return new Promise((resolve) => {
      this.tween(fast ? 0 : MOVE_MS, (t) => {
        const k = ease(t);
        mover.group.position.lerpVectors(a, b, k);
        mover.sprite.position.y = knight ? Math.sin(Math.PI * k) * KNIGHT_HOP : 0;
      }, () => {
        if (!victim) { resolve(); return; }
        this.tween(fast ? 0 : CAPTURE_MS, (t) => {
          victim.sprite.material.opacity = 1 - t;
          victim.group.scale.setScalar(1 - t * 0.6);
        }, resolve);
      });
    });
  }

  tween(ms, step, done) {
    this.tweens.push({ start: performance.now(), ms, step, done });
    this.wake();
  }

  wake() { this.awakeUntil = performance.now() + 120; }

  bindPointer() {
    const raycaster = new THREE.Raycaster();
    let down = null;
    this.onDown = (e) => { down = { x: e.clientX, y: e.clientY }; };
    this.onUp = (e) => {
      if (!down) return;
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      down = null;
      if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy)) { this.onSwipe?.(dx < 0 ? 1 : -1); return; }
      if (Math.hypot(dx, dy) > TAP_SLOP_PX) return;
      const rect = this.canvas.getBoundingClientRect();
      raycaster.setFromCamera(new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1), this.camera);
      const sprites = [...this.sprites.values()].map((s) => s.sprite);
      const hit = raycaster.intersectObjects(sprites)[0] || raycaster.intersectObjects(this.tiles)[0];
      if (hit) this.onTap?.(hit.object.userData.sq);
    };
    this.canvas.addEventListener("pointerdown", this.onDown);
    this.canvas.addEventListener("pointerup", this.onUp);
  }

  resize() {
    const parent = this.canvas.parentElement;
    const w = parent.clientWidth, h = parent.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 58 : 45;
    this.camera.updateProjectionMatrix();
    this.wake();
  }

  /** Average frame time while something is moving, for the test readout. */
  stats() {
    const times = this.frameTimes;
    const avg = times.length ? times.reduce((a, b) => a + b, 0) / times.length : 0;
    return { fps: avg ? Math.round(1000 / avg) : null, pixelRatio: this.renderer.getPixelRatio() };
  }

  /* Draws only while something is changing, to spare phone batteries. */
  loop(now) {
    if (!this.running) return;
    const busy = this.tweens.length > 0 || now < this.awakeUntil;
    if (busy) {
      const dt = now - this.lastFrame;
      if (dt < 200 && this.tweens.length) { this.frameTimes.push(dt); if (this.frameTimes.length > 120) this.frameTimes.shift(); }
      /* Finished tweens run their callbacks only after the list is rebuilt,
         since a callback often starts the next tween. */
      const finished = [];
      this.tweens = this.tweens.filter((tw) => {
        const t = tw.ms ? Math.min(1, (now - tw.start) / tw.ms) : 1;
        tw.step(t);
        if (t >= 1) { finished.push(tw); return false; }
        return true;
      });
      finished.forEach((tw) => tw.done?.());
      this.camera.position.copy(this.camPos);
      this.camera.lookAt(this.camLook);
      this.renderer.render(this.scene, this.camera);
    }
    this.lastFrame = now;
    requestAnimationFrame(this.loop);
  }

  dispose() {
    this.running = false;
    this.resizeObserver.disconnect();
    this.canvas.removeEventListener("pointerdown", this.onDown);
    this.canvas.removeEventListener("pointerup", this.onUp);
    this.canvas.removeEventListener("webglcontextlost", this.onLostEvent);
    this.renderer.dispose();
  }
}
