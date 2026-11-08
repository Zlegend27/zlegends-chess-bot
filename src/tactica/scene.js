/* Chess Tactica's 3D view: a board in the chess set's own colours with the
   living wooden pieces standing on it, two cameras, and move animations.
   Captures play the attacker's own attack. It only shows what TacticaPage
   tells it to and reports taps, swipes and drags back, so the chess rules
   can't be affected by anything drawn here. */
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { woodTexture } from "./pieces/pawn.js";
import { KINDS, BUILD, clipsFor, reactionFor, attackEffects, PAWN_ATTACK_END } from "./pieces/attacks.js";

/* Pieces are modelled about one square wide; this leaves a gap around them. */
const PIECE_SCALE = 0.78;
/* The chess set's colours (Dubrovnik II): squares and the board frame. */
export const SET_BOARD = { light: "#EED6B0", dark: "#8A5229", frame: "#5C3317" };
/* Idle breathing only needs about 30 frames a second. */
const IDLE_FRAME_MS = 33;
const SWIPE_PX = 50;
const TAP_SLOP_PX = 10;
const MOVE_MS = 420;
const CAPTURE_MS = 320;
const KNIGHT_HOP = 1.1;
const DOUBLE_TAP_MS = 400;
const DOUBLE_TAP_PX = 40;
/* A picked-up character's view is the close view pulled back this much. */
const HELD_WIDEN = 1.15;
const BEAM_HEIGHT = 0.5;
const DRAG_LIFT = 0.35;
const HELD_OPACITY = 0.55;
/* Dragging near a screen edge slides the camera that way, in board squares
   per second, so a far square can be reached without lifting the finger. The
   finger has to rest there briefly first, so squares near an edge stay easy
   to drop on. */
const EDGE_SPEED = 3.5;
const PULSE_MS = 900;
const EDGE_DWELL_MS = 350;

/* How long the camera takes to settle on a new view, roughly. It chases its
   goal with a critically damped spring, so a new goal mid-move bends the path
   instead of restarting it. */
const CAMERA_SMOOTH = 0.32;
/* Angles the close view may swing to, around the selected character, so it
   can see past whatever is in the way. Zero is the view from the player's
   side; it never swings further than side-on, so the player never ends up
   looking from the enemy's side. */
const AUTO_TURNS = [0, 0.45, -0.45, 0.9, -0.9, 1.4, -1.4];
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const turnAround = (pivot, point, angle) => point.clone().sub(pivot).applyAxisAngle(Y_AXIS, angle).add(pivot);
/* The attack shot settles faster, so it is in place before the hit. */
const ATTACK_SMOOTH = 0.2;
/* The attack shot: how far behind and above the player's piece the camera
   sits, how far to the side so that piece doesn't hide the other, and how far
   along the line it looks. */
const SHOT_BACK = 2.1, SHOT_HIGH = 1.9, SHOT_SIDE = 0.45, SHOT_LOOK = 0.55;
/* Unity-style SmoothDamp on one number; vel is carried between frames. */
function damp(cur, goal, vel, key, smooth, dt) {
  const omega = 2 / smooth, x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = cur - goal;
  const temp = (vel[key] + omega * change) * dt;
  vel[key] = (vel[key] - omega * temp) * exp;
  return goal + (change + temp) * exp;
}
function dampVector(cur, goal, vel, smooth, dt) {
  cur.x = damp(cur.x, goal.x, vel, "x", smooth, dt);
  cur.y = damp(cur.y, goal.y, vel, "y", smooth, dt);
  cur.z = damp(cur.z, goal.z, vel, "z", smooth, dt);
}

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/* One model per kind and colour, built once and cloned for every piece
   (clones share geometry and materials). */
const templates = new Map();
function modelFor(kind, colour) {
  const key = kind + colour;
  if (!templates.has(key)) templates.set(key, BUILD[kind](colour));
  return templates.get(key).clone(true);
}
const idleClips = new Map();
function idleFor(kind) {
  if (!idleClips.has(kind)) idleClips.set(kind, clipsFor(kind).idle);
  return idleClips.get(kind);
}

export class TacticaScene {
  /** `colors` is { light, dark, background, highlight, target, select }. The
   *  solver's side is always nearest the camera. */
  /** `onTurn(angle)` reports how far the view is turned from the player's
   *  side, so the map can turn with it. */
  /** `onDragStart(sq)` returns whether that character may be dragged;
   *  `onDrop(sq)` gets the square it was let go over, or null, and returns
   *  whether it took the move; if not, the character slides home. */
  constructor(canvas, { colors, flipped, onTap, onDoubleTap, onSwipe, onDragStart, onDrop, onLost, onTurn }) {
    this.canvas = canvas;
    this.flipped = flipped;
    this.onTap = onTap;
    this.onDoubleTap = onDoubleTap;
    this.onSwipe = onSwipe;
    this.onTurn = onTurn;
    /* How far the view is turned from the player's side, the point it turns
       around, and whether the player turned it with the map. */
    this.turn = 0;
    this.pivot = new THREE.Vector3();
    this.manualTurn = false;
    this.onDragStart = onDragStart;
    this.onDrop = onDrop;
    this.held = null;
    this.targets = [];
    this.captures = [];
    this.pulse = [];
    this.dragging = false;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "low-power" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.85;
    this.renderer.localClippingEnabled = true;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(colors.background);
    /* Soft room reflections for the polish and steel, a warm key light and a
       cool rim light. */
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.45;
    pmrem.dispose();
    const key = new THREE.DirectionalLight("#ffe9cc", 2.0);
    key.position.set(3, 8, 5);
    const rim = new THREE.DirectionalLight("#9fc4ff", 0.7);
    rim.position.set(-4, 3, -5);
    this.scene.add(key, rim, new THREE.HemisphereLight("#fff6ea", "#3a2a1e", 0.55));
    /* The solver's side is nearest the camera; each side faces the other. */
    this.nearColour = flipped ? "black" : "white";
    this.active = [];
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    this.camPos = new THREE.Vector3(0, 11, 8);
    this.camLook = new THREE.Vector3(0, 0, 0.6);
    this.goalPos = this.camPos.clone();
    this.goalLook = this.camLook.clone();
    this.posVel = { x: 0, y: 0, z: 0 };
    this.lookVel = { x: 0, y: 0, z: 0 };
    this.moving = 0;
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
    this.tweens = [];
    this.pieces = new Map();
    this.marks = new THREE.Group();
    this.hoverMark = new THREE.Group();
    this.colors = colors;
    this.frameTimes = [];
    this.buildBoard();
    this.scene.add(this.marks, this.hoverMark);

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

  /** The square under a world point, or null off the board. */
  squareAt(point) {
    const fx = Math.round(point.x + 3.5), fz = Math.round(point.z + 3.5);
    if (fx < 0 || fx > 7 || fz < 0 || fz > 7) return null;
    const file = this.flipped ? 7 - fx : fx, rank = this.flipped ? fz : 7 - fz;
    return rank * 8 + file;
  }

  /** World position of a square's centre. */
  worldOf(sq) {
    const file = sq % 8, rank = (sq / 8) | 0;
    const x = (this.flipped ? 7 - file : file) - 3.5;
    const z = (this.flipped ? rank : 7 - rank) - 3.5;
    return new THREE.Vector3(x, 0, z);
  }

  /** The set's board: wooden squares in its two colours inside a dark
   *  wooden frame. */
  buildBoard() {
    const grain = (base, seed) => {
      const t = woodTexture({ base, shade: base, grain: "#3b2210" }, { seed, lines: 30 });
      t.repeat.set(0.5, 0.5);
      return t;
    };
    const frameMat = new THREE.MeshStandardMaterial({ map: grain(SET_BOARD.frame, 3), roughness: 0.55 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(8.7, 0.4, 8.7), frameMat);
    base.position.y = -0.21;
    this.scene.add(base);
    const squareMat = {
      light: new THREE.MeshStandardMaterial({ map: grain(this.colors.light, 5), roughness: 0.6 }),
      dark: new THREE.MeshStandardMaterial({ map: grain(this.colors.dark, 9), roughness: 0.6 }),
    };
    this.tiles = [];
    const tileGeometry = new THREE.PlaneGeometry(1, 1);
    for (let sq = 0; sq < 64; sq++) {
      const light = ((sq % 8) + ((sq / 8) | 0)) % 2 === 1;
      const tile = new THREE.Mesh(tileGeometry, light ? squareMat.light : squareMat.dark);
      tile.rotation.x = -Math.PI / 2;
      tile.position.copy(this.worldOf(sq));
      tile.userData.sq = sq;
      this.scene.add(tile);
      this.tiles.push(tile);
    }
    this.shadowGeometry = new THREE.CircleGeometry(0.32, 24);
    this.shadowMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false });
  }

  /** Replaces every character with `pieces`: [{ sq, type, white }], type
   *  1 pawn to 6 king. Each stands in its square facing the other side and
   *  breathes and blinks on its own clock. */
  setPieces(pieces) {
    for (const entry of this.pieces.values()) this.scene.remove(entry.group);
    this.pieces.clear();
    for (const piece of pieces) this.addPiece(piece);
    this.wake();
    /* Warm up after the first frames are on screen, during the opening view. */
    if (!this.warmTimer) this.warmTimer = setTimeout(() => this.prewarm(), 900);
  }

  /** One character standing on its square, facing the other side, breathing
   *  and blinking on its own clock. */
  addPiece(piece) {
    {
      const kind = KINDS[piece.type], colour = piece.white ? "white" : "black";
      const group = new THREE.Group();
      const model = modelFor(kind, colour);
      model.scale.multiplyScalar(PIECE_SCALE);
      const holder = new THREE.Group();
      holder.add(model);
      holder.rotation.y = colour === this.nearColour ? Math.PI : 0;
      const shadow = new THREE.Mesh(this.shadowGeometry, this.shadowMaterial);
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = 0.01;
      /* An invisible column to tap or drag the character by. */
      this.hitGeometry ??= new THREE.CylinderGeometry(0.4, 0.4, 1.5, 12);
      this.hitMaterial ??= new THREE.MeshBasicMaterial({ visible: false });
      const hit = new THREE.Mesh(this.hitGeometry, this.hitMaterial);
      hit.position.y = 0.75;
      hit.userData.sq = piece.sq;
      group.add(shadow, holder, hit);
      group.position.copy(this.worldOf(piece.sq));
      this.scene.add(group);
      const mixer = new THREE.AnimationMixer(model);
      const idle = mixer.clipAction(idleFor(kind));
      idle.play();
      idle.time = Math.random() * idle.getClip().duration;
      this.pieces.set(piece.sq, { group, holder, model, hit, kind, colour, mixer, idle });
    }
  }

  /** Compiles, in the background, the shaders the attacks will need: the
   *  see-through and cut-in-two versions of every piece material and the
   *  glow, smoke and sparkle materials. Otherwise the first lightning bolt
   *  or first cut stalls for a moment while the phone compiles them. */
  prewarm() {
    if (this.warmed || !this.running || !this.renderer.compileAsync) return;
    this.warmed = true;
    const group = new THREE.Group();
    const geometry = new THREE.PlaneGeometry(0.01, 0.01);
    const add = (material) => group.add(new THREE.Mesh(geometry, material));
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const seen = new Set();
    for (const kind of KINDS.slice(1)) {
      for (const colour of ["white", "black"]) {
        modelFor(kind, colour).traverse((o) => {
          if (!o.isMesh || seen.has(o.material)) return;
          seen.add(o.material);
          const ghost = o.material.clone();
          ghost.transparent = true;
          add(ghost);
          const cut = o.material.clone();
          cut.clippingPlanes = [plane];
          cut.transparent = true;
          add(cut);
        });
      }
    }
    add(new THREE.MeshBasicMaterial({ side: THREE.BackSide, clippingPlanes: [plane], transparent: true }));
    add(new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }));
    add(new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    add(new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    add(new THREE.MeshStandardMaterial({ roughness: 1, transparent: true, depthWrite: false }));
    group.position.copy(this.camLook);
    /* The warm-up materials are kept, not disposed: disposing them would
       also throw away the compiled shaders. */
    this.warmup = group;
    this.renderer.compileAsync(group, this.camera, this.scene).catch(() => {});
  }

  /** A still, see-through copy of a character, for the move preview. */
  previewOf(entry) {
    this.previewMats ??= new Map();
    const model = modelFor(entry.kind, entry.colour);
    model.scale.multiplyScalar(PIECE_SCALE);
    model.traverse((o) => {
      if (!o.isMesh) return;
      if (!this.previewMats.has(o.material)) {
        const m = o.material.clone();
        m.transparent = true;
        m.opacity = 0.42;
        m.depthWrite = false;
        this.previewMats.set(o.material, m);
      }
      o.material = this.previewMats.get(o.material);
    });
    const holder = new THREE.Group();
    holder.rotation.y = entry.holder.rotation.y;
    holder.add(model);
    return holder;
  }

  /** See-through while dragged, so the squares under it show. */
  setGhost(entry, on) {
    if (!!entry.ghost === on) return;
    if (on) {
      entry.ghost = new Map();
      entry.model.traverse((o) => {
        if (!o.isMesh) return;
        entry.ghost.set(o, o.material);
        o.material = o.material.clone();
        o.material.transparent = true;
        o.material.opacity = HELD_OPACITY;
      });
    } else {
      for (const [o, m] of entry.ghost) o.material = m;
      entry.ghost = null;
    }
  }

  /** Highlights: a ring under the selected character and, with `held`, a
   *  glow on every square it can reach. A `chosen` square gets an arrow and
   *  a see-through ghost of the character standing there, so the move can be
   *  checked before it is played. With `ghost` (while dragging) the
   *  character itself turns see-through so the squares under it show. */
  setMarks({ selected = null, held = false, targets = [], chosen = null, captures = [], ghost = false } = {}) {
    this.marks.clear();
    this.pulse = [];
    this.held = held ? selected : null;
    this.targets = held ? targets : [];
    this.captures = captures;
    for (const [sq, entry] of this.pieces) this.setGhost(entry, ghost && sq === selected);
    const flat = (geometry, color, opacity, at, y, additive = false) => {
      const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
        color, transparent: true, opacity, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      }));
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.copy(at).setY(y);
      this.marks.add(mesh);
      return mesh;
    };
    this.outlineGeometry ??= (() => {
      const outer = new THREE.Shape();
      outer.moveTo(-0.46, -0.46); outer.lineTo(0.46, -0.46); outer.lineTo(0.46, 0.46); outer.lineTo(-0.46, 0.46); outer.closePath();
      const hole = new THREE.Path();
      hole.moveTo(-0.38, -0.38); hole.lineTo(-0.38, 0.38); hole.lineTo(0.38, 0.38); hole.lineTo(0.38, -0.38); hole.closePath();
      outer.holes.push(hole);
      return new THREE.ShapeGeometry(outer);
    })();
    this.glowGeometry ??= new THREE.PlaneGeometry(0.96, 0.96);
    if (selected != null) {
      const at = this.worldOf(selected);
      this.glowCircle ??= new THREE.CircleGeometry(0.55, 40);
      this.ringGeometry ??= new THREE.RingGeometry(0.36, 0.46, 48);
      flat(this.glowCircle, this.colors.select, held ? 0.35 : 0.2, at, 0.015, true);
      flat(this.ringGeometry, this.colors.select, 0.95, at, 0.02);
    }
    for (const sq of this.targets) {
      const at = this.worldOf(sq);
      const isChosen = sq === chosen;
      const color = captures.includes(sq) ? this.colors.attack : isChosen ? this.colors.target : this.colors.highlight;
      /* Reachable squares glow and pulse; a drag needs no arrows, since the
         character itself shows where it is going. */
      const glow = flat(this.glowGeometry, color, isChosen ? 0.8 : 0.6, at, 0.02);
      const edge = flat(this.outlineGeometry, color, 1, at, 0.03);
      edge.scale.setScalar(1.06);
      /* A short wall of light around the square, so it still stands out from
         a low camera that sees the board almost edge on. */
      const beam = new THREE.Mesh(this.beamGeometry(), new THREE.MeshBasicMaterial({
        color, alphaMap: this.beamFade(), transparent: true, opacity: isChosen ? 0.95 : 0.7,
        depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      }));
      beam.position.copy(at).setY(BEAM_HEIGHT / 2);
      this.marks.add(beam);
      this.pulse.push({ material: glow.material, base: glow.material.opacity }, { material: beam.material, base: beam.material.opacity });
    }
    if (selected != null && chosen != null) {
      const color = captures.includes(chosen) ? this.colors.attack : this.colors.target;
      this.addArrow(this.worldOf(selected), this.worldOf(chosen), color, 0.85);
      const entry = this.pieces.get(selected);
      if (entry) {
        const preview = this.previewOf(entry);
        preview.position.copy(this.worldOf(chosen));
        this.marks.add(preview);
      }
    }
    this.wake();
  }

  /** An open square tube, one tile wide, for the walls of light. */
  beamGeometry() {
    if (!this.beamShape) {
      this.beamShape = new THREE.CylinderGeometry(0.46 * Math.SQRT2, 0.46 * Math.SQRT2, BEAM_HEIGHT, 4, 1, true);
      this.beamShape.rotateY(Math.PI / 4);
    }
    return this.beamShape;
  }

  /** Fades the walls of light from solid at the floor to nothing on top. */
  beamFade() {
    if (!this.beamTexture) {
      const canvas = document.createElement("canvas");
      canvas.width = 1; canvas.height = 64;
      const g = canvas.getContext("2d");
      const fade = g.createLinearGradient(0, 0, 0, 64);
      fade.addColorStop(0, "#000");
      fade.addColorStop(1, "#fff");
      g.fillStyle = fade;
      g.fillRect(0, 0, 1, 64);
      this.beamTexture = new THREE.CanvasTexture(canvas);
    }
    return this.beamTexture;
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
    if (this.holdCamera(() => this.showBoard())) return;
    this.lastSq = null;
    this.pivot.set(0, 0, 0);
    if (!this.manualTurn) this.setTurn(0);
    this.moveCamera(turnAround(this.pivot, new THREE.Vector3(0, 11, 8), this.turn), turnAround(this.pivot, new THREE.Vector3(0, 0, 0.6), this.turn));
  }

  setTurn(angle) {
    this.turn = Math.atan2(Math.sin(angle), Math.cos(angle));
    this.onTurn?.(this.turn);
  }

  /** Turns the view by `angle` around the selected character (or the
   *  board's middle), at once; used when the player drags the map. The turn
   *  holds until another character is chosen. */
  spinBy(angle) {
    this.manualTurn = true;
    for (const p of [this.goalPos, this.goalLook, this.camPos, this.camLook]) p.copy(turnAround(this.pivot, p, angle));
    this.setTurn(this.turn + angle);
    this.wake();
  }

  /** The turn that shows a character and the squares it can reach best:
   *  fewest of them hidden behind other pieces or off screen, then the one
   *  closest to the view from the player's side, then the one closest to
   *  where the camera already is. */
  bestTurn(sq, basePos, baseLook, targets) {
    /* Pieces placed since the last frame have no world position yet. */
    this.scene.updateMatrixWorld();
    const at = this.worldOf(sq);
    const self = this.pieces.get(sq);
    const blockers = [...this.pieces.values()].filter((e) => e !== self).map((e) => e.hit);
    const probe = this.probe ??= new THREE.PerspectiveCamera();
    probe.fov = this.camera.fov; probe.aspect = this.camera.aspect; probe.near = 0.1; probe.far = 100;
    probe.updateProjectionMatrix();
    const ray = new THREE.Raycaster();
    const hidden = (from, point, except) => {
      const dir = point.clone().sub(from);
      const dist = dir.length();
      ray.set(from, dir.normalize());
      ray.far = dist - 0.35;
      return ray.intersectObjects(blockers).some((h) => h.object !== except);
    };
    let best = null;
    for (const turn of AUTO_TURNS) {
      const pos = turnAround(at, basePos, turn), look = turnAround(at, baseLook, turn);
      probe.position.copy(pos);
      probe.lookAt(look);
      probe.updateMatrixWorld();
      /* The character itself hidden matters most; then the share of its
         squares that are off screen or hidden; then how far the view turns. */
      let cost = hidden(pos, at.clone().setY(0.55), null) ? 6 : 0;
      let lost = 0;
      for (const t of targets) {
        const p = this.worldOf(t).setY(0.2);
        const ndc = p.clone().project(probe);
        if (Math.abs(ndc.x) > 0.92 || Math.abs(ndc.y) > 0.85 || ndc.z > 1 || hidden(pos, p, this.pieces.get(t)?.hit)) lost++;
      }
      if (targets.length) cost += 2.5 * lost / targets.length;
      cost += Math.abs(turn) * 1.1 + Math.abs(Math.atan2(Math.sin(turn - this.turn), Math.cos(turn - this.turn))) * 0.25;
      if (!best || cost < best.cost) best = { cost, turn };
    }
    return best.turn;
  }

  /** Tactical view: low over the character's shoulder, looking out across
   *  the board. A far destination pulls the camera back so it stays in sight.
   *  Switching characters swings the camera from one to the next. */
  showCloseUp(sq, destination = null, widen = 1, targets = []) {
    if (this.holdCamera(() => this.showCloseUp(sq, destination, widen, targets))) return;
    const at = this.worldOf(sq);
    const toward = destination != null ? this.worldOf(destination) : at.clone().add(new THREE.Vector3(0, 0, -3.5));
    const reach = destination != null ? at.distanceTo(toward) : 3.5;
    const pull = (1 + Math.max(0, reach - 2.5) * 0.2) * widen;
    const look = new THREE.Vector3().addVectors(at, toward).multiplyScalar(0.5).setY(0.35);
    const position = at.clone().add(new THREE.Vector3(0.7, 2.2 * pull, 3.1 * pull));
    /* A new character gets the clearest angle; the same one keeps a turn
       the player made with the map. */
    if (sq !== this.lastSq) this.manualTurn = false;
    this.lastSq = sq;
    this.pivot.copy(at);
    this.setTurn(this.manualTurn ? this.turn : this.bestTurn(sq, position, look, targets));
    this.moveCamera(turnAround(at, position, this.turn), turnAround(at, look, this.turn));
  }

  /** View of a character with every square it can reach in sight, from
   *  whichever side shows them best. */
  showReach(sq, targets = []) {
    this.showCloseUp(sq, null, HELD_WIDEN, targets);
  }

  /** Outlines the square a dragged character is over: gold for a legal
   *  landing, red for a capture, grey for somewhere it can't go. */
  setHover(sq) {
    if (sq === this.hoverSq) return;
    this.hoverSq = sq;
    this.hoverMark.clear();
    if (sq != null && this.outlineGeometry) {
      const legal = this.targets.includes(sq);
      const color = !legal ? 0x9a9aa8 : this.captures.includes(sq) ? this.colors.attack : this.colors.target;
      const mesh = new THREE.Mesh(this.outlineGeometry, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: legal ? 1 : 0.6, depthWrite: false }));
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.copy(this.worldOf(sq)).setY(0.04);
      mesh.scale.setScalar(legal ? 1.08 : 1);
      this.hoverMark.add(mesh);
      if (legal) {
        const glow = new THREE.Mesh(this.glowGeometry, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }));
        glow.rotation.x = -Math.PI / 2;
        glow.position.copy(this.worldOf(sq)).setY(0.035);
        this.hoverMark.add(glow);
      }
    }
    this.wake();
  }

  /** While an attack plays, its camera stays put; the latest view asked
   *  for is applied once the attack is over. */
  holdCamera(view) {
    if (!this.active.length && !this.moving) return false;
    this.pendingView = view;
    return true;
  }

  /** Points the camera at a new view. It glides there on its own; asking
   *  again before it arrives just changes where it is heading. */
  moveCamera(position, look, smooth = CAMERA_SMOOTH) {
    this.goalPos.copy(position);
    this.goalLook.copy(look);
    this.smooth = smooth;
    if (reducedMotion()) { this.camPos.copy(position); this.camLook.copy(look); }
    this.wake();
  }

  /** Whether the camera is still on its way. */
  cameraMoving() {
    const v = this.posVel, w = this.lookVel;
    return this.camPos.distanceToSquared(this.goalPos) > 1e-5 || this.camLook.distanceToSquared(this.goalLook) > 1e-5
      || Math.abs(v.x) + Math.abs(v.y) + Math.abs(v.z) + Math.abs(w.x) + Math.abs(w.y) + Math.abs(w.z) > 1e-3;
  }

  /** Is a square comfortably inside the current view? */
  inView(sq) {
    this.camera.updateMatrixWorld();
    const p = this.worldOf(sq).setY(0.4).project(this.camera);
    return Math.abs(p.x) < 0.8 && p.y > -0.75 && p.y < 0.8 && p.z < 1;
  }

  /** The attack shot: close behind the player's own piece in the fight (the
   *  attacker on their turn, the victim on the opponent's), looking straight
   *  down the line at the other one, so the hit lands head-on in the middle
   *  of an upright screen with room above for a leap. */
  attackShot(attackerSq, victimSq, attackerIsMine, { back = SHOT_BACK, high = SHOT_HIGH, lookY = 0.75 } = {}) {
    const mine = this.worldOf(attackerIsMine ? attackerSq : victimSq);
    const other = this.worldOf(attackerIsMine ? victimSq : attackerSq);
    const along = other.clone().sub(mine).setY(0).normalize();
    const side = new THREE.Vector3(-along.z, 0, along.x);
    /* Lean to whichever side keeps the camera nearer the board's middle. */
    if (mine.clone().addScaledVector(side, SHOT_SIDE).lengthSq() > mine.clone().addScaledVector(side, -SHOT_SIDE).lengthSq()) side.negate();
    const position = mine.clone().addScaledVector(along, -back).addScaledVector(side, SHOT_SIDE).setY(high);
    const look = mine.clone().lerp(other, SHOT_LOOK).setY(lookY);
    this.moveCamera(position, look, ATTACK_SMOOTH);
  }

  /** Pulls back to frame two squares and a leap's height, staying on the side
   *  the camera is already looking from. */
  frameMove(a, b) {
    const mid = a.clone().lerp(b, 0.5).setY(0.9);
    const away = this.goalPos.clone().sub(this.goalLook).setY(0);
    if (away.lengthSq() < 1e-4) away.set(0, 0, 1);
    away.normalize();
    const reach = 3.2 + a.distanceTo(b) * 0.7;
    this.moveCamera(mid.clone().addScaledVector(away, reach).setY(2.2 + reach * 0.45), mid);
  }


  /** Moves a character; a knight leaps. A capture plays the attacker's own
   *  attack on the victim (with reduced motion the victim just fades). With
   *  `follow`, or for any capture, the camera frames the move. Afterwards the
   *  piece simply stays on its new square; nothing is rebuilt. */
  animateMove(from, to, { knight = false, captured = null, follow = false } = {}) {
    const mover = this.pieces.get(from);
    const victim = captured != null ? this.pieces.get(captured) : null;
    if (!mover) return Promise.resolve();
    this.setGhost(mover, false);
    this.moving++;
    const finish = () => {
      this.moving--;
      this.settle(mover, from, to, captured);
      if (!this.moving && !this.active.length) { const view = this.pendingView; this.pendingView = null; view?.(); }
    };
    if (victim && !reducedMotion()) return this.attack(mover, victim, from, to).then(finish);
    /* A dropped character lands from where it was let go, without a leap. */
    const a = mover.group.position.clone(), b = this.worldOf(to);
    if (follow || !this.inView(to)) this.frameMove(this.worldOf(from), b);
    const leap = knight && a.y < 0.01;
    const fast = reducedMotion();
    return new Promise((resolve) => {
      this.tween(fast ? 0 : MOVE_MS, (t) => {
        const k = ease(t);
        mover.group.position.lerpVectors(a, b, k);
        if (leap) mover.group.position.y = Math.sin(Math.PI * k) * KNIGHT_HOP;
      }, () => {
        if (!victim) { resolve(); return; }
        this.tween(fast ? 0 : CAPTURE_MS, (t) => victim.group.scale.setScalar(Math.max(0.001, 1 - t)), resolve);
      });
    }).then(finish);
  }

  /** After a move: the piece is filed under its new square, standing at rest
   *  where its attack left it, then turns back to face the other side. A
   *  captured piece is taken off the board. */
  settle(mover, from, to, captured) {
    if (captured != null) {
      const victim = this.pieces.get(captured);
      if (victim && victim !== mover) { this.scene.remove(victim.group); this.pieces.delete(captured); }
    }
    if (this.pieces.get(from) === mover) this.pieces.delete(from);
    this.pieces.set(to, mover);
    mover.hit.userData.sq = to;
    mover.group.position.copy(this.worldOf(to));
    /* An attack leaves the body displaced and turned toward its target; fold
       the turn into the holder and stand the body back up. */
    const body = mover.model.getObjectByName("body");
    if (body) {
      const yaw = new THREE.Euler().setFromQuaternion(body.quaternion, "YXZ").y;
      mover.mixer.stopAllAction();
      body.position.set(0, 0, 0);
      body.quaternion.identity();
      body.scale.set(1, 1, 1);
      mover.holder.rotation.y += yaw;
      mover.idle.reset().play();
    }
    const facing = mover.colour === this.nearColour ? Math.PI : 0;
    const start = mover.holder.rotation.y;
    let turn = ((facing - start) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
    if (Math.abs(turn) > 1e-3) this.tween(reducedMotion() ? 0 : 450, (t) => { mover.holder.rotation.y = start + turn * ease(t); });
    this.wake();
  }

  /** Brings the board in line with `pieces` ([{ sq, type, white }]) without
   *  rebuilding what is already right: pieces in place are kept (and put
   *  back on their squares), anything else is added or removed. Covers
   *  castling, en passant and promotion after a move. */
  syncPieces(pieces) {
    const want = new Map(pieces.map((p) => [p.sq, p]));
    for (const [sq, entry] of [...this.pieces]) {
      const p = want.get(sq);
      if (p && KINDS[p.type] === entry.kind && (p.white ? "white" : "black") === entry.colour) {
        entry.group.position.copy(this.worldOf(sq));
        entry.group.scale.setScalar(1);
        this.setGhost(entry, false);
        want.delete(sq);
      } else {
        this.scene.remove(entry.group);
        this.pieces.delete(sq);
      }
    }
    for (const p of want.values()) this.addPiece(p);
    this.wake();
  }

  /** The attacker plays its attack at the victim's square, the victim its
   *  reaction, and the effects run on the attack's clock. */
  attack(mover, victim, from, to) {
    const a = this.worldOf(from), b = this.worldOf(to);
    /* A dragged character goes back to its square to make its attack. */
    mover.group.position.copy(a);
    const delta = b.clone().sub(a);
    /* The pawn's slash goes straight ahead, so it turns to face the victim. */
    if (mover.kind === "pawn") mover.holder.rotation.y = Math.atan2(delta.x, delta.z);
    const local = delta.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -mover.holder.rotation.y).divideScalar(PIECE_SCALE);
    const clip = clipsFor(mover.kind, [local.x, local.z]).attack;
    /* The victim turns to face what is coming for it. */
    victim.holder.rotation.y = Math.atan2(-delta.x, -delta.z);
    mover.idle.stop();
    const act = mover.mixer.clipAction(clip);
    act.setLoop(THREE.LoopOnce, 1);
    act.clampWhenFinished = true;
    act.play();
    const reaction = reactionFor(mover.kind, victim.model);
    if (reaction) {
      victim.idle.stop();
      const r = victim.mixer.clipAction(reaction);
      r.setLoop(THREE.LoopOnce, 1);
      r.clampWhenFinished = true;
      r.play();
    }
    const fx = attackEffects(mover.kind, {
      scene: this.scene, attacker: mover.model, victim: victim.model, from: a, to: b,
      scale: PIECE_SCALE, attackerColour: mover.colour, victimColour: victim.colour,
    });
    const end = mover.kind === "pawn" ? PAWN_ATTACK_END : clip.duration;
    /* The knight leaps high, so his shot sits a little further back and higher. */
    const leapRoom = mover.kind === "knight" ? { back: 2.6, high: 2.3, lookY: 1.15 } : {};
    this.attackShot(from, to, mover.colour === this.nearColour, leapRoom);
    return new Promise((resolve) => {
      this.active.push({
        act, fx, end,
        done: () => {
          fx.dispose();
          if (mover.kind !== "pawn") { resolve(); return; }
          /* The pawn steps onto the square once its slash is done. */
          const start = mover.group.position.clone();
          this.tween(MOVE_MS, (t) => mover.group.position.lerpVectors(start, b, ease(t)), resolve);
        },
      });
      this.wake();
    });
  }

  tween(ms, step, done) {
    this.tweens.push({ start: performance.now(), ms, step, done });
    this.wake();
  }

  wake() { this.awakeUntil = performance.now() + 120; }

  bindPointer() {
    const raycaster = new THREE.Raycaster();
    const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const aim = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      raycaster.setFromCamera(new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1), this.camera);
    };
    const groundSquare = () => {
      const point = raycaster.ray.intersectPlane(ground, new THREE.Vector3());
      return point ? { point, sq: this.squareAt(point) } : null;
    };
    const pieceHit = () => raycaster.intersectObjects([...this.pieces.values()].map((v) => v.hit))[0]?.object.userData.sq ?? null;
    let down = null, drag = null, lastTap = null;
    const follow = (e) => {
      aim(e);
      const hit = groundSquare();
      if (!hit) return;
      drag.piece.group.position.set(hit.point.x, DRAG_LIFT, hit.point.z);
      this.setHover(hit.sq === drag.sq ? null : hit.sq);
    };
    /* Called every frame of a drag: slides the camera while the finger rests
       near an edge, keeping the character under it. */
    this.dragFollow = (dt) => {
      if (!drag?.piece || !drag.pointer) return;
      const rect = this.canvas.getBoundingClientRect();
      const nx = (drag.pointer.clientX - rect.left) / rect.width, ny = (drag.pointer.clientY - rect.top) / rect.height;
      const fz = ny < 0.16 ? -(0.16 - ny) / 0.16 - 0.3 : ny > 0.86 ? ((ny - 0.86) / 0.14) * 0.6 + 0.2 : 0;
      const fx = nx < 0.08 ? -(0.08 - nx) / 0.08 - 0.3 : nx > 0.92 ? (nx - 0.92) / 0.08 + 0.3 : 0;
      if (!fx && !fz) { drag.edgeSince = null; return; }
      drag.edgeSince ??= performance.now();
      if (performance.now() - drag.edgeSince < EDGE_DWELL_MS) return;
      const step = (EDGE_SPEED * Math.min(dt, 50)) / 1000;
      /* Stops at the board edge, but never pulls back a camera already past it. */
      const clamp = (v, cur, lo, hi) => Math.max(Math.min(lo, cur), Math.min(Math.max(hi, cur), v));
      /* Screen right and screen up, on the board, for however the view is turned. */
      const ahead = this.camLook.clone().sub(this.camPos).setY(0).normalize();
      const right = new THREE.Vector3(-ahead.z, 0, ahead.x);
      const move = right.multiplyScalar(fx * step).addScaledVector(ahead, -fz * step);
      const x = clamp(this.camLook.x + move.x, this.camLook.x, -4, 4), z = clamp(this.camLook.z + move.z, this.camLook.z, -4.5, 4.5);
      const shift = new THREE.Vector3(x - this.camLook.x, 0, z - this.camLook.z);
      this.camLook.add(shift);
      this.camPos.add(shift);
      this.goalLook.add(shift);
      this.goalPos.add(shift);
      this.camera.position.copy(this.camPos);
      this.camera.lookAt(this.camLook);
      this.camera.updateMatrixWorld();
      follow(drag.pointer);
    };

    /* One finger at a time: a second finger can't hijack a drag. */
    this.onDown = (e) => {
      if (down && drag) return;
      aim(e);
      down = { id: e.pointerId, x: e.clientX, y: e.clientY, sq: pieceHit() };
    };
    this.onMove = (e) => {
      if (!down || e.pointerId !== down.id) return;
      /* A mouse released outside the page never sends pointerup here. */
      if (e.pointerType === "mouse" && e.buttons === 0 && !drag) { down = null; return; }
      if (!drag && down.sq != null && Math.hypot(e.clientX - down.x, e.clientY - down.y) > TAP_SLOP_PX) {
        this.dragging = true;
        if (this.onDragStart?.(down.sq)) {
          drag = { sq: down.sq, piece: this.pieces.get(down.sq) };
          this.canvas.setPointerCapture?.(e.pointerId);
        } else { down.sq = null; this.dragging = false; }
      }
      if (!drag?.piece) return;
      drag.pointer = { clientX: e.clientX, clientY: e.clientY };
      follow(e);
      this.wake();
    };
    this.onUp = (e) => {
      if (!down || e.pointerId !== down.id) return;
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      const pressed = down;
      down = null;
      if (drag) {
        const { sq, piece } = drag;
        drag = null;
        aim(e);
        const over = groundSquare()?.sq ?? null;
        this.setHover(null);
        this.dragging = false;
        const taken = over !== sq && this.onDrop?.(over);
        if (piece && !taken) {
          const from = piece.group.position.clone(), home = this.worldOf(sq);
          this.tween(reducedMotion() ? 0 : 160, (t) => piece.group.position.lerpVectors(from, home, ease(t)));
        }
        return;
      }
      if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy)) { this.onSwipe?.(dx < 0 ? 1 : -1); return; }
      if (Math.hypot(dx, dy) > TAP_SLOP_PX) return;
      aim(e);
      /* While a character is held, a square it can reach wins over whatever
         character is drawn in front of it, such as the held one itself. */
      const tile = raycaster.intersectObjects(this.tiles)[0]?.object.userData.sq ?? null;
      const sq = tile != null && this.targets.includes(tile) ? tile : pressed.sq ?? pieceHit() ?? tile;
      if (sq == null) return;
      /* A double-tap is matched by where the finger landed, not by square, so
         it still counts while the camera is swinging after the first tap. */
      const now = performance.now();
      if (lastTap && now - lastTap.at < DOUBLE_TAP_MS && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < DOUBLE_TAP_PX) {
        const first = lastTap.sq;
        lastTap = null;
        this.onDoubleTap?.(first);
        return;
      }
      lastTap = { sq, at: now, x: e.clientX, y: e.clientY };
      this.onTap?.(sq);
    };
    this.onCancel = (e) => {
      if (down && e?.pointerId !== down.id) return;
      if (drag?.piece) {
        drag.piece.group.position.copy(this.worldOf(drag.sq));
        this.setHover(null);
      }
      down = drag = null;
      this.dragging = false;
    };
    this.canvas.addEventListener("pointerdown", this.onDown);
    this.canvas.addEventListener("pointermove", this.onMove);
    this.canvas.addEventListener("pointerup", this.onUp);
    this.canvas.addEventListener("pointercancel", this.onCancel);
  }

  resize() {
    const parent = this.canvas.parentElement;
    const w = parent.clientWidth, h = parent.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 62 : 45;
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
    const busy = this.tweens.length > 0 || now < this.awakeUntil || this.dragging || this.pulse.length > 0 || this.active.length > 0 || this.cameraMoving();
    /* With nothing else going on, the pieces' idle breathing is drawn at
       about 30 frames a second. */
    const idleDue = this.pieces.size > 0 && now - (this.lastDraw ?? 0) >= IDLE_FRAME_MS;
    if (busy || idleDue) {
      const dt = now - this.lastFrame;
      const since = Math.min(0.1, (now - (this.lastDraw ?? now)) / 1000);
      this.lastDraw = now;
      for (const entry of this.pieces.values()) entry.mixer.update(since);
      for (const run of this.active) run.fx.update(run.act.time);
      const ended = this.active.filter((run) => run.act.time >= run.end - 1e-3 || !run.act.isRunning());
      this.active = this.active.filter((run) => !ended.includes(run));
      ended.forEach((run) => run.done());
      if (this.dragging) this.dragFollow?.(dt);
      const beat = 0.7 + 0.45 * (0.5 + 0.5 * Math.sin((now / PULSE_MS) * Math.PI * 2));
      for (const { material, base } of this.pulse) material.opacity = Math.min(1, base * beat);
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
      if (!this.dragging) {
        const step = Math.min(0.05, Math.max(0.001, dt / 1000));
        dampVector(this.camPos, this.goalPos, this.posVel, this.smooth ?? CAMERA_SMOOTH, step);
        dampVector(this.camLook, this.goalLook, this.lookVel, this.smooth ?? CAMERA_SMOOTH, step);
      }
      this.camera.position.copy(this.camPos);
      this.camera.lookAt(this.camLook);
      this.renderer.render(this.scene, this.camera);
    }
    this.lastFrame = now;
    requestAnimationFrame(this.loop);
  }

  dispose() {
    this.running = false;
    clearTimeout(this.warmTimer);
    this.resizeObserver.disconnect();
    this.canvas.removeEventListener("pointerdown", this.onDown);
    this.canvas.removeEventListener("pointerup", this.onUp);
    this.canvas.removeEventListener("pointermove", this.onMove);
    this.canvas.removeEventListener("pointercancel", this.onCancel);
    this.canvas.removeEventListener("webglcontextlost", this.onLostEvent);
    this.renderer.dispose();
  }
}
