/* Chess Tactica's 3D view: a board in the chess set's own colours with the
   living wooden pieces standing on it, two cameras, and move animations.
   Captures play the attacker's own attack. It only shows what TacticaPage
   tells it to and reports taps, swipes and drags back, so the chess rules
   can't be affected by anything drawn here. */
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { woodTexture, makeMats } from "./pieces/pawn.js";
import { KINDS, BUILD, clipsFor, reactionFor, attackEffects, PAWN_ATTACK_END } from "./pieces/attacks.js";
import { play as playSound, ATTACK_CUES, buzz } from "./sound.js";
import { artSettled } from "./sets/art.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/* Pieces are modelled about one square wide; this leaves a gap around them. */
const PIECE_SCALE = 0.78;
/* Hit-stop: when an attack connects, attacker and victim hold still for a
   moment (heavier hitters longer) while the camera kicks, so the blow lands
   instead of passing through. Times are when each attack's blow lands (see
   ATTACK_CUES), and the hold in ms. */
const IMPACT = { pawn: [0.6, 60], knight: [1.18, 110], bishop: [0.9, 80], rook: [1.7, 100], queen: [0.8, 70], king: [1.95, 120] };
const IMPACT_KICK = { pawn: 0.05, knight: 0.11, bishop: 0.07, rook: 0.09, queen: 0.07, king: 0.12 };
/* How tall each character's invisible tap area is, so a short pawn doesn't
   cover the squares behind it. Roughly the height of the model on the board. */
const TAP_HEIGHT = { pawn: 1.1, knight: 1.4, bishop: 1.55, rook: 1.25, queen: 1.65, king: 1.75 };
/* The chess set's colours (Dubrovnik II): squares and the board frame. */
export const SET_BOARD = { light: "#EED6B0", dark: "#8A5229", frame: "#5C3317" };
/* The finishing pass over every frame: the picture darkens toward its
   corners so the eye stays on the board, and takes a slight colour cast
   from the world it's in (warm in the bin, cold in the snow). */
const GRADE_SHADER = {
  uniforms: { tDiffuse: { value: null }, vignette: { value: 0.45 }, tint: { value: new THREE.Color("#ffffff") }, contrast: { value: 1.06 }, saturation: { value: 1 } },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float vignette; uniform vec3 tint; uniform float contrast; uniform float saturation; varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float edge = smoothstep(0.35, 0.95, length((vUv - 0.5) * vec2(1.0, 1.15)) * 1.25);
      c.rgb *= tint * (1.0 - vignette * edge);
      c.rgb = max(vec3(0.0), (c.rgb - 0.18) * contrast + 0.18);
      float grey = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      c.rgb = max(vec3(0.0), mix(vec3(grey), c.rgb, saturation));
      gl_FragColor = c;
    }`,
};
/* Idle breathing only needs about 30 frames a second. */
const IDLE_FRAME_MS = 33;
const SWIPE_PX = 50;
/* A quick sideways flick is a swipe to the next character even when it
   starts on one: the character isn't picked up while a sideways move is
   this young, and a drag of the selected character let go this soon,
   sideways and off its glowing squares, still counts as a swipe. */
const FLICK_MS = 220, FLICK_DRAG_MS = 400, SIDEWAYS = 1.3;
/* How far a finger may drift and still count as a tap. A quick tap on a
   phone drifts more, so a short press is allowed more. */
const TAP_SLOP_PX = 16, QUICK_TAP_SLOP_PX = 32, QUICK_TAP_MS = 250;
const MOVE_MS = 420;
const CAPTURE_MS = 320;
/* Fast modes: a short slide and a quick pop for captures. */
const QUICK_MOVE_MS = 170, QUICK_CAPTURE_MS = 120;
/* Battle animations: armies regrouping between phases, an enemy rush, and a
   scared character after a quiet punishing reply. */
const REGROUP_MS = 700, RUSH_MS = 900, SCARE_MS = 1300;
/* Fast modes play the full attack cinematics this many times faster. */
const QUICK_ATTACK_SPEED = 3;
const KNIGHT_HOP = 1.1;
/* Bond looks: the warm glow's colour, its strength by level (index = level),
   and the collar ring that sits in the base groove every piece shares
   (model units, before PIECE_SCALE). */
const BOND_GLOW = "#ffc864";
/* How see-through a boss's hand gets where it covers a character. */
const SEE_THROUGH = 0.35, SEE_THROUGH_MAX_RADIUS = 2.6;
/* Turning the view with a second finger: radians per pixel slid (slowed
   from 0.012, the creator found it too fast). */
const TURN_PER_PX = 0.0075;
/* Kept faint and inside the piece's own square: a bond is a keepsake, and a
   strong gold glow read like a move highlight (the creator, 2026-11-17). */
const BOND_GLOW_OPACITY = [0, 0, 0.13, 0.16, 0.22, 0.28];
const BOND_TRIM = { r: 0.462, tube: 0.026, y: 0.128 };
const DOUBLE_TAP_MS = 400;
const DOUBLE_TAP_PX = 40;
/* A picked-up character's view is the close view pulled back this much. */
const HELD_WIDEN = 1.15;
const BEAM_HEIGHT = 0.5;
const DRAG_LIFT = 0.35;
const HELD_OPACITY = 0.55;
/* A character standing between the camera and the picked one (or one of its
   glowing squares) fades to this, so it never hides them. It counts as in
   the way when the line of sight passes within FADE_RADIUS of its body. */
const FADE_OPACITY = 0.25, FADE_RADIUS = 0.42, FADE_SMOOTH = 10;
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
/* Half the board's width including its frame, and the furthest the
   whole-board view pulls back to fit it on a narrow screen. */
const BOARD_EDGE = 4.6, MAX_BOARD_PULL = 2.2;
/* The furthest the close view pulls back to fit every glowing square, and
   the furthest it slides sideways (in squares) to centre a wide spread of
   them, like a bishop's long diagonal on a narrow phone. */
const MAX_FIT_PULL = 2.4, MAX_SIDE_SHIFT = 2.5;
/* Room kept around the game's own buttons and panels (the map, the menu
   button, the tutorial card), in pixels: a glowing square under one of
   them couldn't be tapped. They are marked with data-tactica-hud. */
const HUD_PAD_PX = 6;
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
/** A mesh's see-through copies of its materials (for a boss over a piece),
 *  made once and kept: never disposed, see setMarks. */
function seeMats(o) {
  o.userData.seeMat ??= [o.userData.seeOrig ?? o.material].flat().map((m) => { const c = m.clone(); c.transparent = true; c.depthWrite = false; c.userData.baseOpacity = m.opacity ?? 1; return c; });
  return o.userData.seeMat;
}

/* One model per kind and colour, built once and cloned for every piece
   (clones share geometry and materials). */
const templates = new Map();
function modelFor(kind, colour) {
  const key = kind + colour;
  if (!templates.has(key)) templates.set(key, noTinyShadows(bakeStill(BUILD[kind](colour))));
  return templates.get(key).clone(true);
}

/* The small parts of a character (eyes, studs, rivets, a sword's tip) cast
   no shadow: too small to see in the shadow map, and drawn into it every
   frame they cost a phone more than the rest of the character. */
function noTinyShadows(root) {
  root.updateMatrixWorld(true);
  const scale = new THREE.Vector3();
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    if (o.geometry.boundingSphere.radius * o.getWorldScale(scale).x < 0.06 / PIECE_SCALE) { o.castShadow = false; o.userData.tiny = true; }
  });
  return root;
}

/* Each character is built from dozens of small meshes; drawn one by one, a
   full board is well over a thousand draw calls, which is what slows phones.
   Within each part that moves as one (body, head, an arm: whatever the
   animations move), the plain meshes that share a material are merged into
   one. Named meshes stay as they are: code finds them by name (eyes,
   weapons, glows) and animations can only move named parts. */
function bakeStill(root) {
  root.updateMatrixWorld(true);
  const parents = [];
  root.traverse((o) => { if (o.children.length > 1) parents.push(o); });
  for (const parent of parents) {
    const groups = new Map();
    for (const child of parent.children) {
      if (!child.isMesh || child.isSkinnedMesh || child.isInstancedMesh || child.name || child.children.length || Array.isArray(child.material) || child.morphTargetInfluences) continue;
      const g = child.geometry;
      const sig = [child.material.uuid, g.index ? "i" : "n", ...Object.keys(g.attributes).sort(), child.castShadow, child.receiveShadow, child.visible, child.renderOrder].join("|");
      if (!groups.has(sig)) groups.set(sig, []);
      groups.get(sig).push(child);
    }
    for (const list of groups.values()) {
      if (list.length < 2) continue;
      const geos = list.map((m) => { m.updateMatrix(); const g = m.geometry.clone(); g.applyMatrix4(m.matrix); return g; });
      const merged = mergeGeometries(geos, false);
      if (!merged) continue;
      const first = list[0];
      const mesh = new THREE.Mesh(merged, first.material);
      mesh.castShadow = first.castShadow;
      mesh.receiveShadow = first.receiveShadow;
      mesh.renderOrder = first.renderOrder;
      for (const m of list) parent.remove(m);
      parent.add(mesh);
    }
  }
  return root;
}
const idleClips = new Map();
function idleFor(kind) {
  if (!idleClips.has(kind)) idleClips.set(kind, clipsFor(kind).idle);
  return idleClips.get(kind);
}

export class TacticaScene {
  /** `colors` is { light, dark, background, highlight, target, select }. The
   *  solver's side is always nearest the camera. */
  /** `onView(view)` reports what the camera sees whenever it moves, for the
   *  map (see reportView). */
  /** `onDragStart(sq)` returns whether that character may be dragged;
   *  `onDrop(sq)` gets the square it was let go over, or null, and returns
   *  whether it took the move; if not, the character slides home. */
  constructor(canvas, { colors, flipped, onTap, onDoubleTap, onSwipe, onDragStart, onDrop, onLost, onView, onTurn }) {
    this.canvas = canvas;
    this.flipped = flipped;
    this.onTap = onTap;
    this.onDoubleTap = onDoubleTap;
    this.onSwipe = onSwipe;
    this.onView = onView;
    /* `onTurn(angle)`: the player turned the view with two fingers. */
    this.onTurn = onTurn;
    if (import.meta.env.DEV) window.__tcScene = this;
    /* A scene that never gets characters (the Memories list) still tells
       the loading screen it's ready. Timers wait for the build to finish, so
       this can't fire in the middle of it. */
    this.frameTimer = setTimeout(() => { if (!this.framed && this.running !== false) { this.framed = true; try { window.dispatchEvent(new CustomEvent("tactica-frame")); } catch { /* no window */ } } }, 300);
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
    /* Bond levels by kind, shown on the player's characters. */
    this.bonds = {};
    this.dragging = false;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "low-power" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.85;
    /* Shadows are redrawn every other frame (see loop), not every frame. */
    this.renderer.shadowMap.autoUpdate = false;
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
    /* Scenery that animates on its own (set dressing) gets called every
       drawn frame with the seconds since the last one. */
    this.everyFrame = [];
    /* Camera shake strength (board units), set during an enemy rush. */
    this.shake = 0;
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
    /* Analysis arrows, kept apart from the move highlights so picking a
       character doesn't wipe them. */
    this.hints = new THREE.Group();
    this.colors = colors;
    this.frameTimes = [];
    this.setupPost();
    this.buildBoard();
    this.scene.add(this.marks, this.hoverMark, this.hints);

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

  /** The finishing passes: bright things glow (the light through the hole,
   *  lava, lightning, glowing squares), then the grade above. If the phone
   *  can't set this up, or later can't keep up (see adaptResolution), the
   *  scene is drawn plainly, as it always was. */
  setupPost() {
    this.post = false;
    try {
      const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
      this.composer = new EffectComposer(this.renderer, target);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.45, 0.7, 0.9);
      this.composer.addPass(this.bloom);
      this.grade = new ShaderPass(GRADE_SHADER);
      this.composer.addPass(this.grade);
      this.composer.addPass(new OutputPass());
      this.post = true;
    } catch {
      this.composer = null;
    }
  }

  /** A world's look: how much bright things glow, how dark the corners go,
   *  and the colour cast. Anything left out keeps its value. */
  setLook({ glow, glowFrom, vignette, tint, contrast, saturation } = {}) {
    if (!this.composer) return;
    if (glow != null) this.bloom.strength = glow;
    if (glowFrom != null) this.bloom.threshold = glowFrom;
    if (vignette != null) this.grade.uniforms.vignette.value = vignette;
    if (tint != null) this.grade.uniforms.tint.value.set(tint);
    if (contrast != null) this.grade.uniforms.contrast.value = contrast;
    if (saturation != null) this.grade.uniforms.saturation.value = saturation;
    this.wake();
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
    /* A new board: animations still finishing from the old one must not
       put their pieces back on it (see animateMove). */
    this.generation = (this.generation ?? 0) + 1;
    this.stopAttacks(() => false);
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
      this.hitGeometry ??= new THREE.CylinderGeometry(0.36, 0.38, 1, 12);
      this.hitMaterial ??= new THREE.MeshBasicMaterial({ visible: false });
      const hit = new THREE.Mesh(this.hitGeometry, this.hitMaterial);
      const tapHeight = TAP_HEIGHT[kind] ?? 1.4;
      hit.scale.y = tapHeight;
      hit.position.y = tapHeight / 2;
      hit.userData.sq = piece.sq;
      group.add(shadow, holder, hit);
      group.position.copy(this.worldOf(piece.sq));
      this.scene.add(group);
      const mixer = new THREE.AnimationMixer(model);
      const idle = mixer.clipAction(idleFor(kind));
      idle.play();
      idle.time = Math.random() * idle.getClip().duration;
      const entry = { group, holder, model, hit, kind, colour, mixer, idle };
      this.pieces.set(piece.sq, entry);
      this.decorate(entry);
      this.spiritLook(entry);
    }
  }

  /** Memories: every character becomes a ghost of an old master's piece,
   *  pale and see-through, glowing faintly blue. Pieces added later too. */
  setSpirits(on) {
    this.spirits = !!on;
    for (const entry of this.pieces.values()) this.spiritLook(entry);
    this.wake();
  }
  spiritLook(entry) {
    if (!this.spirits || entry.spirit) return;
    entry.spirit = true;
    const pale = new THREE.Color("#d6ebff");
    entry.model.traverse((o) => {
      if (!o.isMesh || !o.material || Array.isArray(o.material)) return;
      const m = o.material.clone();
      m.transparent = true;
      m.opacity = 0.58;
      if (m.color) m.color.lerp(pale, 0.65);
      if (m.emissive) { m.emissive.set("#5fa8ff"); m.emissiveIntensity = 0.45; }
      o.material = m;
    });
  }

  /** Bond levels by kind ({ pawn: 1..5, ... }). They show on the player's
   *  own characters (the side nearest the camera) as a glow at the feet from
   *  level 2, a silver collar in the base groove at 3, gold with a brighter
   *  glow at 4 and a soft aura at 5. */
  setBonds(levels) {
    this.bonds = levels ?? {};
    for (const entry of this.pieces.values()) this.decorate(entry);
    this.wake();
  }

  /** Hard mode: the player's own characters have glowing red eyes. */
  setRedEyes(on) {
    this.redEyes = !!on;
    for (const entry of this.pieces.values()) this.decorate(entry);
    this.wake();
  }

  /** Gives a character its eyes for the mode: red and glowing for the
   *  player's side in hard mode (or for anyone, with `force`), its own
   *  otherwise. */
  paintEyes(entry, force = false) {
    const red = force || (this.redEyes && entry.colour === this.nearColour);
    const own = makeMats(entry.colour).iris;
    this.redIris ??= new THREE.MeshStandardMaterial({ color: "#ff3a22", emissive: "#ff2010", emissiveIntensity: 4, roughness: 0.4 });
    entry.model.traverse((o) => {
      if (!o.isMesh || (o.material !== own && o.material !== this.redIris)) return;
      o.material = red ? this.redIris : own;
    });
  }

  /** Shared meshes' geometry and materials for the bond looks, made once. */
  bondAssets() {
    if (this.bondKit) return this.bondKit;
    const radial = document.createElement("canvas");
    radial.width = radial.height = 128;
    const rg = radial.getContext("2d");
    const g = rg.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.35, "rgba(255,255,255,0.55)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    rg.fillStyle = g;
    rg.fillRect(0, 0, 128, 128);
    const rising = document.createElement("canvas");
    rising.width = 4;
    rising.height = 128;
    const vg = rising.getContext("2d");
    const v = vg.createLinearGradient(0, 128, 0, 0);
    v.addColorStop(0, "rgba(255,255,255,0.9)");
    v.addColorStop(0.5, "rgba(255,255,255,0.3)");
    v.addColorStop(1, "rgba(255,255,255,0)");
    vg.fillStyle = v;
    vg.fillRect(0, 0, 4, 128);
    const glowMap = new THREE.CanvasTexture(radial), auraMap = new THREE.CanvasTexture(rising);
    glowMap.colorSpace = auraMap.colorSpace = THREE.SRGBColorSpace;
    const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: BOND_GLOW };
    this.bondKit = {
      glowGeometry: new THREE.PlaneGeometry(0.95, 0.95).rotateX(-Math.PI / 2),
      /* One glow material per strength, so a level-2 glow and a level-4 glow
         can sit on the board together. */
      glow: BOND_GLOW_OPACITY.map((opacity) => new THREE.MeshBasicMaterial({ ...additive, map: glowMap, opacity })),
      trimGeometry: new THREE.TorusGeometry(BOND_TRIM.r, BOND_TRIM.tube, 10, 64).rotateX(Math.PI / 2),
      silver: new THREE.MeshStandardMaterial({ color: "#dfe3ea", metalness: 1, roughness: 0.22 }),
      gold: new THREE.MeshStandardMaterial({ color: "#f2c45a", metalness: 1, roughness: 0.25 }),
      auraGeometry: new THREE.CylinderGeometry(0.42, 0.5, 1.7, 32, 1, true).translate(0, 0.85, 0),
      aura: new THREE.MeshBasicMaterial({ ...additive, map: auraMap, opacity: 0.1, side: THREE.DoubleSide }),
    };
    return this.bondKit;
  }

  /** Puts a character's bond look on it, or takes it off: only the player's
   *  side shows bonds, so this runs again when the board turns. */
  decorate(entry) {
    this.paintEyes(entry);
    for (const part of entry.bondParts ?? []) part.removeFromParent();
    entry.bondParts = [];
    const kit = this.bondAssets();
    /* Hard mode: the player's own characters are seen from behind, where
       their red eyes don't show, so a red glow burns at their feet too. */
    if (this.redEyes && entry.colour === this.nearColour) {
      this.redGlow ??= new THREE.MeshBasicMaterial({ map: kit.glow[2].map, color: "#ff2a12", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.75 });
      const ember = new THREE.Mesh(kit.glowGeometry, this.redGlow);
      ember.position.y = 0.03;
      ember.renderOrder = 1;
      entry.group.add(ember);
      entry.bondParts.push(ember);
    }
    const level = entry.colour === this.nearColour ? this.bonds?.[entry.kind] ?? 1 : 1;
    if (level < 2) return;
    const glow = new THREE.Mesh(kit.glowGeometry, kit.glow[level]);
    glow.position.y = 0.025;
    glow.renderOrder = 1;
    entry.group.add(glow);
    entry.bondParts.push(glow);
    if (level >= 3) {
      /* The collar sits in the groove of the base, on the body, so it rides
         along with every attack. */
      const trim = new THREE.Mesh(kit.trimGeometry, level >= 4 ? kit.gold : kit.silver);
      trim.position.y = BOND_TRIM.y;
      const body = entry.model.getObjectByName("body") ?? entry.model;
      body.add(trim);
      entry.bondParts.push(trim);
    }
    if (level >= 5) {
      const aura = new THREE.Mesh(kit.auraGeometry, kit.aura);
      aura.scale.y = (TAP_HEIGHT[entry.kind] ?? 1.4) / 1.4;
      aura.renderOrder = 2;
      entry.group.add(aura);
      entry.bondParts.push(aura);
    }
  }

  /** Compiles, in the background, the shaders the attacks will need: the
   *  see-through and cut-in-two versions of every piece material and the
   *  glow, smoke and sparkle materials. Otherwise the first lightning bolt
   *  or first cut stalls for a moment while the phone compiles them. */
  prewarm() {
    if (this.warmed || !this.running || !this.renderer.compileAsync) return;
    this.warmed = true;
    this.compileFor(this.warmupGroup(), this.scene);
    this.prewarmLive();
    /* And once the scenery's art has all arrived, everything else. */
    artSettled(8000).then(() => requestAnimationFrame(() => this.warmAll()));
  }

  /** The warm-up materials (made once, kept: disposing them would also
   *  throw away the compiled shaders). */
  warmupGroup() {
    if (this.warmup) return this.warmup;
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
    /* The walls of light around glowing squares (faded by a texture). */
    add(new THREE.MeshBasicMaterial({ alphaMap: this.beamFade(), transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    /* The bond looks: glows, the aura and the metal collars. */
    const kit = this.bondAssets();
    [...kit.glow.slice(2), kit.aura, kit.silver, kit.gold].forEach(add);
    group.position.copy(this.camLook);
    this.warmup = group;
    return group;
  }

  /** The warm-up above can't match every shader the real scene asks for
   *  (lights, shadows and flags on the real objects differ), so the real
   *  thing is compiled too: for one moment, between two frames, the scene
   *  gets a full set of highlights and one faded copy of each kind of
   *  character, the shaders are made, and it is all put back before
   *  anything is drawn. Without this the first few character picks each
   *  froze for 60-100 ms. */
  /** Compiles shaders for `objects` as the frame will really draw them: with
   *  post-processing on, the scene is drawn into the composer's buffer, and
   *  three.js makes different shaders for a buffer than for the screen. */
  compileFor(objects, scene = undefined, now = false) {
    const target = this.renderer.getRenderTarget();
    if (this.post && this.composer) this.renderer.setRenderTarget(this.composer.readBuffer);
    try {
      if (now || !this.renderer.compileAsync) this.renderer.compile(objects, this.camera, scene);
      else this.renderer.compileAsync(objects, this.camera, scene).catch(() => {});
    } finally {
      this.renderer.setRenderTarget(target);
    }
  }

  /** Everything ready to draw, all at once, while something covers the
   *  screen (a loading veil, a card, a film's black): every texture sent to
   *  the graphics card, every shader in the scene built (scenery off to the
   *  side and a boss far away included, which three.js would otherwise
   *  build the first time each comes into view), and the bosses'
   *  see-through copies built too, so a boss covering a piece mid-fight
   *  doesn't freeze the game. One pause here instead of many during play. */
  warmAll() {
    if (!this.running) return;
    const sent = new Set();
    const send = (t) => { if (t?.isTexture && !sent.has(t) && t.image) { sent.add(t); try { this.renderer.initTexture(t); } catch { /* not ready */ } } };
    send(this.scene.background); send(this.scene.environment);
    this.scene.traverse((o) => {
      for (const m of [o.material].flat()) {
        if (!m) continue;
        for (const key of ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "emissiveMap", "alphaMap", "bumpMap", "clearcoatNormalMap", "gradientMap"]) send(m[key]);
      }
    });
    const target = this.renderer.getRenderTarget();
    const compile = () => { try { this.renderer.compile(this.scene, this.camera); } catch { /* lost */ } };
    try {
      if (this.post && this.composer) this.renderer.setRenderTarget(this.composer.readBuffer);
      compile();
      /* The bosses as they look while faded. */
      const swapped = [];
      for (const root of this.seeThrough ?? []) {
        root.traverse((o) => {
          if (!o.isMesh || !o.geometry || o.userData.seeOrig) return;
          seeMats(o);
          swapped.push([o, o.material]);
          o.material = Array.isArray(o.material) ? o.userData.seeMat : o.userData.seeMat[0];
        });
      }
      if (swapped.length) { compile(); for (const [o, m] of swapped) o.material = m; }
    } finally {
      this.renderer.setRenderTarget(target);
    }
    /* The attack and bond materials, now rather than in the background. */
    this.warmed = true;
    this.compileFor(this.warmupGroup(), this.scene, true);
    /* Highlights and faded characters need characters to build on: with an
       empty board (a world just built), a stand-in of each kind and colour
       is put down for the moment and taken away again. */
    const empty = !this.pieces.size;
    if (empty) {
      const cast = [];
      for (let type = 1; type <= 6; type++) cast.push({ sq: type - 1, type, white: true }, { sq: 56 + type - 1, type, white: false });
      this.setPieces(cast);
    }
    this.prewarmLive(true);
    if (empty) this.setPieces([]);
    this.wake();
  }

  prewarmLive(now = false) {
    /* Textures go to the graphics card the first time something using them
       is drawn: scenery off to the side would make the first turn of the
       view hitch. Send them all now. */
    if (this.renderer.initTexture) {
      const sent = new Set();
      this.scene.traverse((o) => {
        for (const m of [o.material].flat()) {
          if (!m) continue;
          for (const key of ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "emissiveMap", "alphaMap", "bumpMap"]) {
            const t = m[key];
            if (t?.isTexture && !sent.has(t) && t.image) { sent.add(t); try { this.renderer.initTexture(t); } catch { /* not ready */ } }
          }
        }
      });
    }
    const entries = [...this.pieces.entries()];
    if (!entries.length) return;
    const [sq] = entries[0];
    const others = entries.slice(1, 4).map(([s]) => s);
    const empty = [];
    for (let t = 0; t < 64 && empty.length < 3; t++) if (!this.pieces.has(t)) empty.push(t);
    const faded = [];
    const kinds = new Set();
    for (const [, entry] of entries) {
      const key = entry.kind + entry.colour;
      if (kinds.has(key) || entry.fadeMats || entry.ghost) continue;
      kinds.add(key);
      this.fadeMaterials(entry);
      faded.push(entry);
    }
    this.silent = true;
    const before = { soundSelected: this.soundSelected, chosen: this.chosen };
    try {
      this.setMarks({ selected: sq, held: true, targets: [...empty, ...others], chosen: empty[0] ?? null, captures: others, confirm: true });
      this.setHints(empty.length > 1 ? [{ from: empty[0], to: empty[1], color: "#3FE07A" }] : []);
      this.compileFor(this.scene, undefined, now);
    } finally {
      /* Back to exactly what was showing (still silent: no tap sound). */
      this.setMarks(this.lastMarks ?? {});
      this.setHints(this.lastHints ?? []);
      for (const entry of faded) this.unfade(entry);
      Object.assign(this, before);
      this.silent = false;
    }
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
      this.unfade(entry);
      entry.ghost = new Map();
      entry.model.traverse((o) => {
        if (!o.isMesh) return;
        entry.ghost.set(o, o.material);
        o.material = o.material.clone();
        o.material.transparent = true;
        o.material.opacity = HELD_OPACITY;
      });
    } else {
      /* The see-through copies aren't disposed (see setMarks). */
      for (const [o, m] of entry.ghost) o.material = m;
      entry.ghost = null;
    }
  }

  /** Fades the characters standing in front of the picked one or its glowing
   *  squares, and brings back the ones no longer in the way. */
  updateFades(dt) {
    const blockers = new Set();
    const focus = this.focusSq != null ? this.pieces.get(this.focusSq) : null;
    if (focus) {
      const eye = this.camera.position;
      const points = [focus.group.position.clone().setY((TAP_HEIGHT[focus.kind] ?? 1.4) * 0.6)];
      for (const sq of this.targets) points.push(this.worldOf(sq).setY(0.2));
      const d = new THREE.Vector3(), p = new THREE.Vector3(), q = new THREE.Vector3();
      for (const entry of this.pieces.values()) {
        if (entry === focus || entry.ghost) continue;
        const h = TAP_HEIGHT[entry.kind] ?? 1.4;
        in_the_way: for (const y of [0.35, h * 0.75]) {
          p.copy(entry.group.position).setY(y);
          for (const at of points) {
            /* Its own square (a capture) isn't hidden by itself. */
            if (Math.hypot(at.x - p.x, at.z - p.z) < 0.5) continue;
            d.subVectors(at, eye);
            const t = q.subVectors(p, eye).dot(d) / d.lengthSq();
            if (t <= 0 || t >= 1) continue;
            if (q.copy(eye).addScaledVector(d, t).distanceTo(p) < FADE_RADIUS) { blockers.add(entry); break in_the_way; }
          }
        }
      }
    }
    const k = 1 - Math.exp(-FADE_SMOOTH * dt);
    for (const entry of this.pieces.values()) {
      const goal = blockers.has(entry) ? FADE_OPACITY : 1;
      const now = entry.fade ?? 1;
      if (now === goal && (goal < 1 || !entry.fadeMats)) continue;
      const next = Math.abs(goal - now) < 0.02 ? goal : now + (goal - now) * k;
      if (next >= 1) { this.unfade(entry); continue; }
      this.fadeMaterials(entry);
      entry.fade = next;
      for (const o of entry.fadeMats.keys()) o.material.opacity = next;
      this.wake();
    }
  }

  /** Boss parts that go see-through where they cover a character: a boss's
   *  hand reaching over the board shouldn't hide the pieces under it. */
  addSeeThrough(root) { (this.seeThrough ??= new Set()).add(root); this.wake(); }
  removeSeeThrough(root) { this.seeThrough?.delete(root); }

  /** Each frame: any boss part between the camera and a character fades to
   *  SEE_THROUGH, and comes back when it has moved off. Bounding spheres
   *  only (no triangles), so it costs next to nothing. */
  updateSeeThrough(dt) {
    if (!this.seeThrough?.size) return;
    const eye = this.camera.position;
    const targets = [];
    /* A film (film3d/kit.js) frames its own shots: nothing fades. */
    if (!this.seeThroughOff) for (const e of this.pieces.values()) targets.push(e.group.position.clone().setY((TAP_HEIGHT[e.kind] ?? 1.4) * 0.55));
    const sphere = this._seeSphere ??= new THREE.Sphere(), ray = this._seeRay ??= new THREE.Ray(), hitAt = this._seeHit ??= new THREE.Vector3();
    const k = 1 - Math.exp(-10 * dt);
    for (const root of this.seeThrough) {
      root.traverse((o) => {
        if (!o.isMesh || !o.visible || !o.geometry) return;
        /* Shapes redrawn every frame (the pizza monster's rope arms) are
           measured again when they change. */
        const pos = o.geometry.attributes.position;
        if (!o.geometry.boundingSphere || (pos && o.userData.seeVersion !== pos.version)) { o.geometry.computeBoundingSphere(); o.userData.seeVersion = pos?.version; }
        sphere.copy(o.geometry.boundingSphere).applyMatrix4(o.matrixWorld);
        /* Hands and arms only: a whole body is too big to test this way. */
        if (sphere.radius > SEE_THROUGH_MAX_RADIUS && !o.userData.seeOrig && !root.userData.seeAll) return;
        let covers = false;
        for (const t of targets) {
          ray.origin.copy(eye);
          ray.direction.subVectors(t, eye);
          const far = ray.direction.length();
          ray.direction.divideScalar(far);
          if (ray.intersectSphere(sphere, hitAt) && hitAt.distanceTo(eye) < far - 0.3) { covers = true; break; }
        }
        const goal = covers ? SEE_THROUGH : 1;
        const now = o.userData.seeOpacity ?? 1;
        if (now === goal && (goal < 1 || !o.userData.seeOrig)) return;
        const next = Math.abs(goal - now) < 0.02 ? goal : now + (goal - now) * k;
        o.userData.seeOpacity = next;
        if (next >= 1) {
          if (o.userData.seeOrig) { o.material = o.userData.seeOrig; o.userData.seeOrig = null; }
          return;
        }
        if (!o.userData.seeOrig) {
          o.userData.seeOrig = o.material;
          seeMats(o);
          o.material = Array.isArray(o.material) ? o.userData.seeMat : o.userData.seeMat[0];
        }
        for (const m of o.userData.seeMat) m.opacity = (m.userData.baseOpacity ?? 1) * next;
        this.wake();
      });
    }
  }

  /** Gives a character see-through copies of its materials, to fade. */
  fadeMaterials(entry) {
    if (entry.fadeMats) return;
    entry.fadeMats = new Map();
    entry.model.traverse((o) => {
      if (!o.isMesh) return;
      entry.fadeMats.set(o, o.material);
      o.material = o.material.clone();
      o.material.transparent = true;
      o.material.depthWrite = false;
    });
  }

  /** Puts a faded character back to solid at once. */
  unfade(entry) {
    if (entry.fadeMats) {
      for (const [o, m] of entry.fadeMats) o.material = m;
      entry.fadeMats = null;
    }
    entry.fade = 1;
  }

  /** Which square a tap means, given the character bodies under the finger,
   *  nearest first (`hits`), and the board square under it (`tile`). The
   *  nearest body wins, except that while a character is selected its
   *  glowing squares come first: the tap looks past bodies that only stand
   *  in the way (the selected character itself, enemies it can't take) and
   *  past a friend standing in front of a glowing square, so moving a
   *  bishop out from behind its own pawn never picks the pawn. A friend is
   *  still picked by tapping it where no glowing square is behind it (its
   *  own square, say), or with a swipe or the ‹ › buttons. */
  throughTo(hits, tile) {
    if (!hits.length) return tile;
    /* Nothing picked yet: you can only pick your own characters, so the tap
       looks past enemy bodies standing in front of one of yours. */
    if (this.held == null) return hits.find((sq) => this.pieces.get(sq)?.colour === this.nearColour) ?? hits[0];
    if (this.chosen != null && (hits.includes(this.chosen) || tile === this.chosen)) return this.chosen;
    const mine = this.pieces.get(this.held);
    const glowing = tile != null && this.targets.includes(tile) ? tile : null;
    for (const [i, sq] of hits.entries()) {
      if (this.targets.includes(sq)) return sq;
      const there = this.pieces.get(sq);
      const inTheWay = sq === this.held || (mine && there && there.colour !== mine.colour);
      if (inTheWay) continue;
      /* A friend in front: an enemy to take behind it, or a glowing square
         under the finger, wins over switching to the friend. */
      return hits.slice(i + 1).find((s) => this.targets.includes(s)) ?? glowing ?? sq;
    }
    return glowing ?? hits[0];
  }

  /** Highlights: a ring under the selected character and, with `held`, a
   *  glow on every square it can reach. A `chosen` square gets an arrow and
   *  a see-through ghost of the character standing there, so the move can be
   *  checked before it is played. With `ghost` (while dragging) the
   *  character itself turns see-through so the squares under it show.
   *  `confirm` tells the tap logic that a first tap only previews a move
   *  (see throughTo). */
  setMarks(marks = {}) {
    if (!this.silent) this.lastMarks = marks;
    const { selected = null, held = false, targets = [], chosen = null, captures = [], ghost = false, confirm = false } = marks;
    /* The old highlights' own geometry (arrows) is freed. Their materials are
       left to the garbage collector, never disposed: disposing the last
       material using a shader makes three.js delete that shader, and the
       next highlight then recompiles it, a 60-90 ms freeze on every
       character switch. Materials hold nothing on the graphics card
       themselves, so this costs nothing. */
    for (const m of this.marks.children) { if (m.userData.ownGeometry) m.geometry.dispose(); }
    this.marks.clear();
    this.pulse = [];
    this.held = held ? selected : null;
    this.focusSq = held ? selected : null;
    this.targets = held ? targets : [];
    this.captures = captures;
    /* A tap when a character is picked, a tick when a move is previewed. */
    if (!this.silent && held && selected != null && selected !== this.soundSelected) {
      playSound("tap", { volume: 0.55 });
      /* The picked character perks up: it heard you. */
      this.squash(this.pieces.get(selected), -0.08, 220);
    }
    if (!this.silent && held && chosen != null && chosen !== this.chosen) playSound("ghost", { volume: 0.7 });
    this.soundSelected = held ? selected : null;
    this.chosen = held ? chosen : null;
    this.confirm = confirm;
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
      /* The ring at its feet hides behind its own body from a low camera,
         so a small marker also floats above its head, drawn over
         everything, gently bobbing: you can always tell who is picked. */
      const entry = this.pieces.get(selected);
      this.markerGeometry ??= new THREE.ConeGeometry(0.11, 0.2, 4).rotateX(Math.PI);
      const marker = new THREE.Mesh(this.markerGeometry, new THREE.MeshBasicMaterial({ color: this.colors.select, depthTest: false, depthWrite: false, transparent: true, opacity: 0.95 }));
      marker.renderOrder = 10;
      const baseY = (entry ? TAP_HEIGHT[entry.kind] ?? 1.4 : 1.4) + 0.28;
      marker.position.copy(at).setY(baseY);
      this.marks.add(marker);
      this.selMarker = { mesh: marker, baseY };
    } else {
      this.selMarker = null;
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
      /* The same outline, faint, drawn through anything in front of it, so
         a square hidden behind a tall piece still shows where it is. */
      const xray = new THREE.Mesh(this.outlineGeometry, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, depthTest: false, depthWrite: false }));
      xray.rotation.x = -Math.PI / 2;
      xray.position.copy(at).setY(0.03);
      xray.scale.setScalar(1.06);
      xray.renderOrder = 9;
      this.marks.add(xray);
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

  /** Analysis arrows: [{ from, to, color }] as 0-63 squares; [] clears. */
  setHints(arrows = []) {
    if (!this.silent) this.lastHints = arrows;
    for (const m of this.hints.children) m.geometry?.dispose();
    this.hints.clear();
    /* Drawn over everything, like the x-ray square outlines: from a low
       camera the board surface and the characters would hide them. */
    for (const a of arrows) {
      /* A knight's move bends: an L, the long leg first, then the short one,
         the way chess sites draw it (utils/arrowGeometry.js on the site). */
      const df = (a.to % 8) - (a.from % 8), dr = ((a.to / 8) | 0) - ((a.from / 8) | 0);
      const knight = (Math.abs(df) === 2 && Math.abs(dr) === 1) || (Math.abs(df) === 1 && Math.abs(dr) === 2);
      if (!knight) { this.addArrow(this.worldOf(a.from), this.worldOf(a.to), a.color, 0.85, this.hints, 0.05, true); continue; }
      const bendSq = Math.abs(df) === 2 ? a.from + df : a.from + dr * 8;
      const from = this.worldOf(a.from), bend = this.worldOf(bendSq), to = this.worldOf(a.to);
      this.addShaft(from, bend, a.color, 0.85, this.hints, 0.05, true);
      this.addArrow(bend, to, a.color, 0.85, this.hints, 0.05, true, 0);
    }
    this.wake();
  }

  /** The first leg of a bent arrow: a flat bar from just off `from` to
   *  `to`, with a round end so the bend joins smoothly. */
  addShaft(from, to, color, opacity, into = this.marks, y = 0.025, onTop = false) {
    const dir = new THREE.Vector3().subVectors(to, from);
    const w = 0.07, start = 0.25, length = dir.length() - start;
    if (length <= 0) return;
    const shape = new THREE.Shape();
    shape.moveTo(-w, 0); shape.lineTo(w, 0); shape.lineTo(w, length);
    shape.absarc(0, length, w, 0, Math.PI, false);
    shape.lineTo(-w, 0);
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape, 8), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, depthTest: !onTop, side: THREE.DoubleSide }));
    mesh.userData.ownGeometry = true;
    if (onTop) mesh.renderOrder = 9;
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = Math.atan2(-dir.x, -dir.z);
    mesh.position.copy(from).setY(y).add(dir.clone().normalize().multiplyScalar(start));
    into.add(mesh);
  }

  /** A flat arrow from `from` to `to`; `startOff` leaves room round the
   *  character it starts from (0 when it carries on from a bend). */
  addArrow(from, to, color, opacity, into = this.marks, y = 0.025, onTop = false, startOff = 0.25) {
    const dir = new THREE.Vector3().subVectors(to, from);
    const length = dir.length() - 0.1 - startOff;
    if (length <= 0.2) return;
    const shape = new THREE.Shape();
    const w = 0.07, head = 0.24;
    shape.moveTo(-w, 0); shape.lineTo(w, 0); shape.lineTo(w, length - head); shape.lineTo(head * 0.8, length - head);
    shape.lineTo(0, length); shape.lineTo(-head * 0.8, length - head); shape.lineTo(-w, length - head); shape.closePath();
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, depthTest: !onTop, side: THREE.DoubleSide }));
    mesh.userData.ownGeometry = true;
    if (onTop) mesh.renderOrder = 9;
    /* The shape points along its own +y; lying flat, that turns to
       (-sin z, 0, -cos z), so this aims it from `from` to `to`. */
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = Math.atan2(-dir.x, -dir.z);
    mesh.position.copy(from).setY(y);
    const start = dir.clone().normalize().multiplyScalar(startOff);
    mesh.position.add(start);
    into.add(mesh);
  }

  /** Strategic view: the whole board. */
  /** Makes room in the whole-board view for a boss (0 none, 1 full). */
  setBossRoom(k) {
    if ((this.bossRoom ?? 0) === k) return;
    this.bossRoom = k;
    if (this.inBoardView) this.showBoard();
  }

  showBoard() {
    if (this.holdCamera(() => this.showBoard())) return;
    /* The whole-board view always faces the board from the player's side. */
    this.lastSq = null;
    this.inBoardView = true;
    this.pivot.set(0, 0, 0);
    this.manualTurn = false;
    this.setTurn(0);
    const { position, look } = this.boardFit();
    this.moveCamera(position, look);
  }

  /** The whole-board view, pulled back until all four corners of the board
   *  (frame included) fit across the screen and between the bars at the top
   *  and bottom, so a narrow phone doesn't cut the near corners off. */
  boardFit() {
    /* With a boss standing over the board (`bossRoom` 1), the view looks
       further back and keeps the board in the lower part of the screen, so
       he is in the picture too. */
    const lift = this.bossRoom ?? 0;
    const look = new THREE.Vector3(0, lift * 1.4, 0.6 - lift * 3.2);
    const away = new THREE.Vector3(0, 11, 8).sub(look);
    const probe = this.probe ??= new THREE.PerspectiveCamera();
    probe.fov = this.camera.fov; probe.aspect = this.camera.aspect; probe.near = 0.1; probe.far = 100;
    probe.updateProjectionMatrix();
    const edge = BOARD_EDGE;
    const corners = [[-edge, -edge], [edge, -edge], [-edge, edge], [edge, edge]].map(([x, z]) => new THREE.Vector3(x, 0, z));
    let pull = 1;
    for (; pull < MAX_BOARD_PULL; pull += 0.04) {
      probe.position.copy(look).addScaledVector(away, pull);
      probe.lookAt(look);
      probe.updateMatrixWorld();
      const fits = corners.every((c) => {
        const p = c.clone().project(probe);
        return Math.abs(p.x) <= 0.95 && p.y >= -0.8 && p.y <= 0.74 - lift * 0.5;
      });
      if (fits) break;
    }
    return { position: look.clone().addScaledVector(away, pull), look };
  }

  setTurn(angle) {
    this.turn = Math.atan2(Math.sin(angle), Math.cos(angle));
  }

  /** Tells the map what the camera sees, whenever it has moved: where it
   *  stands and where it looks (`cam`, `look`), and exactly which part of
   *  the board is on screen (`area`, a polygon: the board's square cut down
   *  by the camera's view), all as board x, z. `whole` is true when the
   *  whole board is in view. Taken from the camera's own position each
   *  frame, so it is right during glides, attack shots, edge scrolling and
   *  turns alike. */
  reportView() {
    if (!this.onView) return;
    const p = this.camPos, l = this.camLook;
    const key = [p.x, p.y, p.z, l.x, l.y, l.z, this.camera.aspect, this.camera.fov].map((v) => Math.round(v * 1000)).join(",");
    if (key === this.viewKey) return;
    this.viewKey = key;
    const probe = this.viewProbe ??= new THREE.PerspectiveCamera();
    probe.fov = this.camera.fov; probe.aspect = this.camera.aspect; probe.near = 0.1; probe.far = 100;
    probe.updateProjectionMatrix();
    probe.position.copy(p);
    probe.lookAt(l);
    probe.updateMatrixWorld();
    /* The board's square, clipped by each side of the camera's view in turn. */
    const frustum = (this.viewFrustum ??= new THREE.Frustum());
    frustum.setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(probe.projectionMatrix, probe.matrixWorldInverse));
    const square = [[-4, -4], [4, -4], [4, 4], [-4, 4]].map(([x, z]) => new THREE.Vector3(x, 0, z));
    let area = square;
    for (const plane of frustum.planes) {
      const kept = [];
      for (let i = 0; i < area.length; i++) {
        const a = area[i], b = area[(i + 1) % area.length];
        const da = plane.distanceToPoint(a), db = plane.distanceToPoint(b);
        if (da >= 0) kept.push(a);
        if ((da >= 0) !== (db >= 0)) kept.push(a.clone().lerp(b, da / (da - db)));
      }
      area = kept;
      if (!area.length) break;
    }
    const whole = square.every((c) => frustum.containsPoint(c));
    this.onView({ cam: { x: p.x, z: p.z }, look: { x: l.x, z: l.z }, area: area.map((v) => ({ x: v.x, z: v.z })), whole });
  }

  /** Turns the view by `angle` around what the close view is looking at
   *  (the selected character and its squares), at once; used when the
   *  player drags the map. The turn holds until another character is
   *  chosen. */
  spinBy(angle) {
    if (this.active.length || this.moving) return;
    this.manualTurn = true;
    for (const p of [this.goalPos, this.goalLook, this.camPos, this.camLook]) p.copy(turnAround(this.pivot, p, angle));
    this.setTurn(this.turn + angle);
    /* Remembered, so the view comes back to it (after a drag, say) for as
       long as the same character stays selected. */
    this.manualView = { position: this.goalPos.clone(), look: this.goalLook.clone() };
    this.wake();
  }

  /** The turn for a character's close view. It only turns on its own when
   *  the character itself is hidden behind another piece; its squares never
   *  decide the angle, since turning toward some of them and away from the
   *  others would hint at (or mislead about) the answer. Squares off screen
   *  are handled by pulling back instead (see showCloseUp); looking around
   *  is the player's choice, with the map. Among turns that show the
   *  character, the one closest to the player's side wins. */
  clearTurn(sq, basePos, baseLook) {
    return this.bestTurn(sq, basePos, baseLook, []);
  }

  /** How far (as a multiplier on the close view's distance) the camera must
   *  pull back so every one of `targets` is on screen from `turn`. */
  fitPull(sq, basePosFor, baseLook, turn, targets) {
    if (!targets.length) return 1;
    const at = this.worldOf(sq);
    const probe = this.probe ??= new THREE.PerspectiveCamera();
    probe.fov = this.camera.fov; probe.aspect = this.camera.aspect; probe.near = 0.1; probe.far = 100;
    probe.updateProjectionMatrix();
    const huds = this.hudRects();
    const rect = this.canvas.getBoundingClientRect();
    for (let pull = 1; pull <= MAX_FIT_PULL; pull += 0.1) {
      probe.position.copy(turnAround(at, basePosFor(pull), turn));
      probe.lookAt(turnAround(at, baseLook, turn));
      probe.updateMatrixWorld();
      const fits = targets.every((t) => {
        const ndc = this.worldOf(t).setY(0.2).project(probe);
        if (!(Math.abs(ndc.x) < 0.9 && ndc.y > -0.72 && ndc.y < 0.8 && ndc.z < 1)) return false;
        const x = rect.left + ((ndc.x + 1) / 2) * rect.width, y = rect.top + ((1 - ndc.y) / 2) * rect.height;
        return !huds.some((h) => x > h.left - HUD_PAD_PX && x < h.right + HUD_PAD_PX && y > h.top - HUD_PAD_PX && y < h.bottom + HUD_PAD_PX);
      });
      if (fits) return pull;
    }
    return MAX_FIT_PULL;
  }

  /** Where the game's own buttons and panels sit on screen. */
  hudRects() {
    const root = this.canvas.parentElement;
    if (!root) return [];
    return [...root.querySelectorAll("[data-tactica-hud]")].map((el) => el.getBoundingClientRect()).filter((r) => r.width && r.height);
  }

  /** How far (in squares, sideways in the view) to slide the close view so
   *  the character and all its glowing squares sit centred: the middle of
   *  their spread, never more than MAX_SIDE_SHIFT. Every square counts the
   *  same, so it favours none of them. */
  sideShift(sq, targets, turn) {
    if (!targets.length) return 0;
    const at = this.worldOf(sq);
    const xs = [0, ...targets.map((t) => this.worldOf(t).sub(at).applyAxisAngle(Y_AXIS, -turn).x)];
    const mid = (Math.min(...xs) + Math.max(...xs)) / 2;
    return Math.max(-MAX_SIDE_SHIFT, Math.min(MAX_SIDE_SHIFT, mid));
  }

  /** The turn that shows a character and the squares it can reach best:
   *  fewest of them hidden behind other pieces or off screen, then the one
   *  closest to the view from the player's side, then the one closest to
   *  where the camera already is. With no targets, only whether the
   *  character itself is hidden counts. */
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
    this.inBoardView = false;
    const at = this.worldOf(sq);
    const toward = destination != null ? this.worldOf(destination) : at.clone().add(new THREE.Vector3(0, 0, -3.5));
    const reach = destination != null ? at.distanceTo(toward) : 3.5;
    const pull = (1 + Math.max(0, reach - 2.5) * 0.2) * widen;
    const look = new THREE.Vector3().addVectors(at, toward).multiplyScalar(0.5).setY(0.35);
    const positionFor = (extra) => at.clone().add(new THREE.Vector3(0.7, 2.2 * pull * extra, 3.1 * pull * extra));
    /* A new character gets a clear view of itself, from the player's side
       where possible; the same one keeps a turn the player made with the
       map. Then the camera pulls back until every glowing square is in
       view, so none is favoured. */
    if (sq !== this.lastSq) this.manualTurn = false;
    this.lastSq = sq;
    /* The same character, turned with the map: back to where it was put. */
    if (this.manualTurn && this.manualView) {
      this.moveCamera(this.manualView.position, this.manualView.look);
      return;
    }
    this.setTurn(this.clearTurn(sq, positionFor(1), look));
    /* A wide spread of squares (a long diagonal, a rook's rank) slides the
       view sideways to the middle of them before pulling back. */
    /* The camera itself only slides half as far, so it stays behind the
       character rather than behind its neighbours; the character must stay
       in view as well. */
    const shift = this.sideShift(sq, targets, this.turn);
    const lookAt = look.clone().add(new THREE.Vector3(shift, 0, 0));
    const sidePositionFor = (extra) => positionFor(extra).add(new THREE.Vector3(shift / 2, 0, 0));
    const position = sidePositionFor(this.fitPull(sq, sidePositionFor, lookAt, this.turn, targets.length ? [sq, ...targets] : []));
    const finalLook = turnAround(at, lookAt, this.turn);
    /* Turning with the map circles the point the camera looks at, so the
       character and its squares stay in the middle of the view. */
    this.pivot.copy(finalLook).setY(0);
    this.moveCamera(turnAround(at, position, this.turn), finalLook);
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
    /* Materials not disposed, for the reason in setMarks. */
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


  /** Between battle phases both armies regroup into the next position:
   *  each character walks (with a little hop) to the nearest square its kind
   *  and colour needs in the new position; any left over shrink away and any
   *  new ones grow in. Resolves when they have settled. */
  regroupTo(pieces) {
    this.generation = (this.generation ?? 0) + 1;
    this.stopAttacks();
    const fast = reducedMotion();
    const moves = [], added = [];
    const free = [...this.pieces.entries()].map(([sq, e]) => ({ sq, e, used: false }));
    for (const p of pieces) {
      const kind = KINDS[p.type], colour = p.white ? "white" : "black";
      const target = this.worldOf(p.sq);
      let best = null;
      for (const f of free) {
        if (f.used || f.e.kind !== kind || f.e.colour !== colour) continue;
        const d = this.worldOf(f.sq).distanceTo(target);
        if (!best || d < best.d) best = { f, d };
      }
      if (best) { best.f.used = true; moves.push({ e: best.f.e, from: best.f.e.group.position.clone(), to: target, sq: p.sq }); }
      else added.push(p);
    }
    const leaving = free.filter((f) => !f.used).map((f) => f.e);
    this.pieces.clear();
    for (const m of moves) {
      this.pieces.set(m.sq, m.e);
      m.e.hit.userData.sq = m.sq;
      m.e.holder.rotation.y = m.e.colour === this.nearColour ? Math.PI : 0;
      this.setGhost(m.e, false);
    }
    const grown = added.map((p) => { this.addPiece(p); const e = this.pieces.get(p.sq); e.group.scale.setScalar(0.001); return e; });
    return new Promise((resolve) => {
      this.tween(fast ? 0 : REGROUP_MS, (t) => {
        const k = ease(t);
        for (const m of moves) {
          m.e.group.position.lerpVectors(m.from, m.to, k);
          if (m.from.distanceToSquared(m.to) > 1e-4) m.e.group.position.y = Math.sin(Math.PI * k) * 0.35;
        }
        for (const e of leaving) e.group.scale.setScalar(Math.max(0.001, 1 - k));
        for (const e of grown) e.group.scale.setScalar(Math.max(0.001, k));
      }, () => {
        for (const e of leaving) this.scene.remove(e.group);
        for (const e of grown) e.group.scale.setScalar(1);
        for (const m of moves) m.e.group.position.copy(m.to);
        resolve();
      });
    });
  }

  /** A burst of sparks where a piece is taken: thrown up and out, falling
   *  back and fading in about two thirds of a second. */
  /** A floor won: each character on `squares` hops in turn and throws
   *  sparks, gold and cyan. */
  celebrate(squares) {
    squares.slice(0, 8).forEach((sq, i) => setTimeout(() => {
      const entry = this.running ? this.pieces.get(sq) : null;
      if (!entry) return;
      this.sparks(this.worldOf(sq), i % 2 ? "#3EE7F5" : "#ffcf6a");
      const g = entry.group, base = g.position.y;
      this.tweens.push({ start: performance.now(), ms: 460, step: (t) => { g.position.y = base + Math.sin(t * Math.PI) * 0.4; }, done: () => { g.position.y = base; } });
      this.wake();
    }, i * 80));
  }

  sparks(at, color = "#ffcf6a") {
    if (!this.sparkMap) {
      const c = document.createElement("canvas");
      c.width = c.height = 32;
      const g = c.getContext("2d"), grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
      grad.addColorStop(0, "rgba(255,255,255,1)"); grad.addColorStop(0.4, "rgba(255,255,255,0.6)"); grad.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grad; g.fillRect(0, 0, 32, 32);
      this.sparkMap = new THREE.CanvasTexture(c);
    }
    const N = 26, pos = new Float32Array(N * 3), vel = [];
    for (let i = 0; i < N; i++) {
      const a = Math.random() * Math.PI * 2, out = 1.2 + Math.random() * 2.2;
      vel.push([Math.cos(a) * out, 1.5 + Math.random() * 2.5, Math.sin(a) * out]);
      pos[i * 3] = at.x; pos[i * 3 + 1] = at.y + 0.5; pos[i * 3 + 2] = at.z;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ map: this.sparkMap, color, size: 0.16, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    this.scene.add(points);
    let life = 0;
    const step = (dt) => {
      life += dt;
      for (let i = 0; i < N; i++) {
        vel[i][1] -= dt * 7;
        pos[i * 3] += vel[i][0] * dt; pos[i * 3 + 1] += vel[i][1] * dt; pos[i * 3 + 2] += vel[i][2] * dt;
      }
      geo.attributes.position.needsUpdate = true;
      mat.opacity = Math.max(0, 1 - life / 0.7);
      this.wake();
      if (life >= 0.7) {
        this.everyFrame = this.everyFrame.filter((x) => x !== step);
        this.scene.remove(points);
        /* The material isn't disposed: that would delete its shader and
           make the next burst recompile it (see setMarks). */
        geo.dispose();
      }
    };
    this.everyFrame.push(step);
    this.wake();
  }

  /** A character buried by garbage on a bonus floor: it sinks halfway in,
   *  tilts, and its bond glow goes out. It stays like that. */
  sink(sq) {
    const entry = this.pieces.get(sq);
    if (!entry || entry.sunk) return;
    entry.sunk = true;
    playSound("drop", { volume: 0.6 });
    for (const part of entry.bondParts ?? []) part.visible = false;
    const tilt = ((sq * 37) % 10) / 10 - 0.5;
    this.tween(reducedMotion() ? 0 : 500, (t) => {
      const k = ease(t);
      entry.group.position.y = -0.42 * k;
      entry.holder.rotation.z = 0.28 * tilt * k;
    });
  }

  /** A looping standoff for the menu: the character on `attackerSq` swings
   *  its attack at `targetSq` every few seconds (the motion only: no
   *  effects, nobody is taken), while the characters on `cowering` huddle
   *  together, face it and shiver, harder while the blow comes. Returns a
   *  stop function. */
  showdown(attackerSq, targetSq, cowering) {
    const attacker = this.pieces.get(attackerSq);
    const victims = cowering.map((sq) => this.pieces.get(sq)).filter(Boolean);
    if (!attacker) return () => {};
    const a = this.worldOf(attackerSq);
    /* Huddle: each one leans in toward the middle of the group, facing the attacker. */
    const middle = new THREE.Vector3();
    for (const sq of cowering) middle.add(this.worldOf(sq));
    middle.divideScalar(Math.max(1, cowering.length));
    for (const [i, v] of victims.entries()) {
      const home = this.worldOf(cowering[i]);
      v.group.position.copy(home.clone().lerp(middle, 0.22));
      const to = a.clone().sub(v.group.position);
      v.holder.rotation.y = Math.atan2(to.x, to.z);
    }
    const toward = this.worldOf(targetSq).sub(a);
    if (attacker.kind === "pawn") attacker.holder.rotation.y = Math.atan2(toward.x, toward.z);
    const local = toward.clone().applyAxisAngle(Y_AXIS, -attacker.holder.rotation.y).divideScalar(PIECE_SCALE);
    const clip = clipsFor(attacker.kind, [local.x, local.z]).attack;
    const end = attacker.kind === "pawn" ? PAWN_ATTACK_END : clip.duration;
    const act = attacker.mixer.clipAction(clip);
    act.setLoop(THREE.LoopOnce, 1);
    act.clampWhenFinished = true;
    let swingAt = -1, stopped = false;
    const swing = () => {
      if (stopped || reducedMotion()) return;
      attacker.idle.stop();
      act.reset().play();
      playSound("swish", { volume: 0.3, delay: 0.3 });
      swingAt = performance.now();
    };
    const step = () => {
      if (stopped) return;
      const now = performance.now();
      /* Back to breathing once the swing is done. */
      if (swingAt >= 0 && act.time >= end - 1e-3) {
        act.stop();
        const body = attacker.model.getObjectByName("body");
        if (body) { body.position.set(0, 0, 0); body.quaternion.identity(); body.scale.set(1, 1, 1); }
        attacker.idle.reset().play();
        swingAt = -1;
      }
      const fear = swingAt >= 0 ? 1 : 0.35;
      for (const [i, v] of victims.entries()) {
        v.holder.rotation.z = Math.sin(now / 38 + i * 2.1) * 0.035 * fear;
      }
    };
    this.everyFrame.push(step);
    const first = setTimeout(swing, 1200);
    const timer = setInterval(swing, 3600);
    this.wake();
    return () => {
      stopped = true;
      clearTimeout(first);
      clearInterval(timer);
      this.everyFrame = this.everyFrame.filter((f) => f !== step);
    };
  }

  /** The enemy rush when a phase's timer runs out: every enemy piece winds
   *  back and lunges at the nearest of the player's pieces, staggered like a
   *  charge, while the camera shakes. Nobody actually moves square: the
   *  position is unchanged when it ends. */
  rush() {
    playSound("rumble", { volume: 0.9 });
    const enemies = [...this.pieces.values()].filter((e) => e.colour !== this.nearColour);
    const friends = [...this.pieces.values()].filter((e) => e.colour === this.nearColour);
    if (!enemies.length || reducedMotion()) return Promise.resolve();
    const plans = enemies.map((e, i) => {
      const home = e.group.position.clone();
      let target = home.clone().add(new THREE.Vector3(0, 0, 1));
      let bestD = Infinity;
      for (const f of friends) { const d = f.group.position.distanceTo(home); if (d < bestD) { bestD = d; target = f.group.position.clone(); } }
      const dir = target.sub(home).setY(0);
      const reach = Math.min(0.85, dir.length() * 0.6);
      dir.normalize();
      return { e, home, dir, reach, delay: i * 70 };
    });
    const total = RUSH_MS + plans.length * 70;
    return new Promise((resolve) => {
      this.tween(total, (t) => {
        const now = t * total;
        this.shake = 0.18 * Math.sin(Math.PI * t);
        for (const p of plans) {
          const u = Math.min(1, Math.max(0, (now - p.delay) / RUSH_MS));
          /* Wind back, lunge, recoil home. */
          const off = u < 0.25 ? -0.2 * (u / 0.25) : u < 0.55 ? -0.2 + (p.reach + 0.2) * ((u - 0.25) / 0.3) : p.reach * (1 - (u - 0.55) / 0.45);
          p.e.group.position.copy(p.home).addScaledVector(p.dir, off);
          p.e.group.position.y = u > 0.25 && u < 0.7 ? Math.sin(Math.PI * (u - 0.25) / 0.45) * 0.3 : 0;
        }
      }, () => {
        this.shake = 0;
        for (const p of plans) p.e.group.position.copy(p.home);
        resolve();
      });
    });
  }

  /** Check! The camera cuts close on the king's face: he glances about,
   *  eyes wide, then scurries a few nervous hops away from `threatSq`,
   *  trembles, and shuffles back to his square as the camera returns.
   *  About a second and a half; modes wait for it before carrying on. */
  async kingScare(kingSq, threatSq) {
    const king = this.pieces.get(kingSq);
    if (!king || reducedMotion() || this.kingScaring) return;
    this.kingScaring = true;
    this.moving++;
    const at = this.worldOf(kingSq);
    const threat = threatSq != null ? this.worldOf(threatSq) : at.clone().add(new THREE.Vector3(0, 0, -1));
    const away = at.clone().sub(threat).setY(0);
    if (away.lengthSq() < 1e-4) away.set(0, 0, 1);
    away.normalize();
    const h = king.holder, g = king.group, baseTurn = h.rotation.y;
    const face = new THREE.Vector3(Math.sin(baseTurn), 0, Math.cos(baseTurn));
    const prev = { pos: this.goalPos.clone(), look: this.goalLook.clone(), smooth: this.smooth };
    const eyes = [];
    king.model.traverse((o) => { if (o.name === "eyeR" || o.name === "eyeL") eyes.push([o, o.scale.clone()]); });
    const tween = (ms, step) => new Promise((r) => this.tween(ms, step, r));
    /* Close on his face, a little to the side. */
    this.moveCamera(at.clone().addScaledVector(face, 2.4).add(new THREE.Vector3(0.6, 1.35, 0)), at.clone().setY(0.95), 0.16);
    playSound("heartbeat", { volume: 0.8 });
    await tween(260, () => {});
    /* The glance: left, right, left, eyes wide. */
    playSound("squeak", { volume: 0.6 });
    await tween(720, (k) => {
      h.rotation.y = baseTurn + Math.sin(k * Math.PI * 3) * 0.55;
      const wide = 1 + 0.45 * Math.sin(Math.min(1, k * 3) * Math.PI / 2);
      for (const [o, s] of eyes) o.scale.copy(s).multiplyScalar(wide);
    });
    /* Skedaddle: quick hops away from the threat. */
    for (let i = 0; i < 3; i++) playSound("step", { volume: 0.55, delay: i * 0.13 });
    await tween(420, (k) => {
      g.position.copy(at).addScaledVector(away, 0.42 * Math.min(1, k * 1.2));
      g.position.y = Math.abs(Math.sin(k * Math.PI * 3)) * 0.14;
      h.rotation.y = baseTurn + Math.sin(k * Math.PI * 6) * 0.15;
    });
    await tween(300, (k) => { h.rotation.z = Math.sin(k * 70) * 0.05 * (1 - k); });
    h.rotation.z = 0;
    /* Back to his square, eyes back, camera back. */
    this.moveCamera(prev.pos, prev.look, prev.smooth ?? CAMERA_SMOOTH);
    const from = g.position.clone();
    await tween(320, (k) => {
      g.position.lerpVectors(from, at, ease(k));
      h.rotation.y = baseTurn;
      for (const [o, s] of eyes) o.scale.copy(s).multiplyScalar(1 + 0.45 * (1 - k));
    });
    g.position.copy(at);
    for (const [o, s] of eyes) o.scale.copy(s);
    h.rotation.y = baseTurn;
    this.moving--;
    this.kingScaring = false;
    if (!this.moving && !this.active.length) { const view = this.pendingView; this.pendingView = null; view?.(); }
  }

  /** After a quiet punishing reply: the camera shows the threat, then closes
   *  in on the threatened character, which trembles, scared stiff. */
  scare(threatSq, victimSq) {
    playSound("creak", { volume: 0.6, delay: 0.6 });
    const victim = this.pieces.get(victimSq);
    if (!victim || reducedMotion()) return Promise.resolve();
    this.frameMove(this.worldOf(threatSq), this.worldOf(victimSq));
    const at = this.worldOf(victimSq);
    const toward = this.worldOf(threatSq).sub(at).setY(0).normalize();
    return new Promise((resolve) => {
      setTimeout(() => {
        this.moveCamera(at.clone().addScaledVector(toward, -1.9).add(new THREE.Vector3(0.4, 1.3, 0)), at.clone().setY(0.6), 0.25);
        const baseY = victim.holder.rotation.y, baseScale = victim.model.scale.x;
        this.tween(SCARE_MS, (t) => {
          const shiver = Math.sin(t * 90) * 0.06 * (1 - t * 0.3);
          victim.holder.rotation.z = shiver;
          victim.holder.rotation.y = baseY + shiver * 0.5;
          victim.model.scale.setScalar(baseScale * (1 - 0.06 * Math.sin(Math.PI * Math.min(1, t * 3))));
        }, () => {
          victim.holder.rotation.z = 0;
          victim.holder.rotation.y = baseY;
          victim.model.scale.setScalar(baseScale);
          resolve();
        });
      }, 650);
    });
  }

  /** Turns the board round so the given side is nearest the camera, for a
   *  new puzzle where the solver plays the other colour. */
  setFlipped(flipped) {
    if (flipped === this.flipped) return;
    this.flipped = flipped;
    this.nearColour = flipped ? "black" : "white";
    for (const tile of this.tiles) tile.position.copy(this.worldOf(tile.userData.sq));
    for (const [sq, e] of this.pieces) {
      e.group.position.copy(this.worldOf(sq));
      e.holder.rotation.y = e.colour === this.nearColour ? Math.PI : 0;
      this.decorate(e);
    }
    this.wake();
  }

  /** Moves a character; a knight leaps. `pace` sets how much of a capture
   *  plays: "full" plays the attacker's own attack on the victim, "quick"
   *  the same attack at QUICK_ATTACK_SPEED with short slides, "off" just a
   *  short slide and the victim pops away (as with reduced motion). With
   *  `camera` (the default) the camera may frame the move: at full pace it
   *  follows with `follow` and gives captures a head-on shot; otherwise it
   *  only moves for a square out of view. Modes that keep the whole board in
   *  view pass `camera: false`.
   *  Afterwards the piece simply stays on its new square; nothing is
   *  rebuilt. */
  animateMove(from, to, { knight = false, captured = null, follow = false, pace = "full", camera = true } = {}) {
    const mover = this.pieces.get(from);
    const victim = captured != null ? this.pieces.get(captured) : null;
    if (!mover) return Promise.resolve();
    this.setGhost(mover, false);
    this.moving++;
    const generation = this.generation;
    /* A board rebuilt mid-move (a new game, a reset) keeps its own pieces
       where they are; the camera view asked for meanwhile is still applied,
       or it would wait forever. */
    const current = () => generation === this.generation;
    const finish = () => {
      this.moving--;
      if (current()) this.settle(mover, from, to, captured);
      if (!this.moving && !this.active.length) { const view = this.pendingView; this.pendingView = null; view?.(); }
    };
    const full = pace === "full", quick = !full;
    if (victim && pace !== "off" && !reducedMotion()) {
      return this.attack(mover, victim, from, to, { speed: full ? 1 : QUICK_ATTACK_SPEED, shot: camera && full, current }).then(finish);
    }
    /* A dropped character lands from where it was let go, without a leap. */
    const a = mover.group.position.clone(), b = this.worldOf(to);
    if (camera && (full ? follow || !this.inView(to) : !this.inView(to))) this.frameMove(this.worldOf(from), b);
    const leap = knight && a.y < 0.01;
    const fast = reducedMotion();
    return new Promise((resolve) => {
      this.tween(fast ? 0 : quick ? QUICK_MOVE_MS : MOVE_MS, (t) => {
        if (!current()) return;
        const k = ease(t);
        mover.group.position.lerpVectors(a, b, k);
        if (leap) mover.group.position.y = Math.sin(Math.PI * k) * KNIGHT_HOP * (quick ? 0.5 : 1);
      }, () => {
        if (!current()) { resolve(); return; }
        if (!victim) {
          playSound(leap ? "landHeavy" : "land", { volume: quick ? 0.6 : 0.8 });
          /* It lands with a little weight: a squash, more after a leap. */
          if (!fast) this.squash(mover, leap ? 0.16 : 0.09, leap ? 260 : 200);
          resolve();
          return;
        }
        playSound("poof", { volume: 0.7 });
        if (!fast) this.sparks(b);
        this.tween(fast ? 0 : quick ? QUICK_CAPTURE_MS : CAPTURE_MS, (t) => { if (current()) victim.group.scale.setScalar(Math.max(0.001, 1 - t)); }, resolve);
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
      this.standUp(mover);
      mover.holder.rotation.y += yaw;
    }
    const facing = mover.colour === this.nearColour ? Math.PI : 0;
    const start = mover.holder.rotation.y;
    let turn = ((facing - start) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
    if (Math.abs(turn) > 1e-3) this.tween(reducedMotion() ? 0 : 450, (t) => { mover.holder.rotation.y = start + turn * ease(t); });
    this.wake();
  }

  /** Stops a character's attack or reaction and stands it back up, breathing. */
  standUp(entry) {
    entry.mixer.stopAllAction();
    const body = entry.model.getObjectByName("body");
    if (body) { body.position.set(0, 0, 0); body.quaternion.identity(); body.scale.set(1, 1, 1); }
    entry.idle.reset().play();
  }

  /** Stops every attack still playing: the board is being rebuilt, so they
   *  are out of date. A character that stays (`staying`) is stood back up,
   *  facing the other side, its bond look back on. */
  stopAttacks(staying = () => true) {
    for (const run of this.active) {
      run.cancelled = true;
      for (const entry of [run.mover, run.victim]) {
        if (!entry || !staying(entry)) continue;
        this.standUp(entry);
        entry.holder.rotation.set(0, entry.colour === this.nearColour ? Math.PI : 0, 0);
        entry.group.scale.setScalar(1);
        for (const part of entry.bondParts ?? []) part.visible = !entry.sunk;
      }
    }
  }

  /** Brings the board in line with `pieces` ([{ sq, type, white }]) without
   *  rebuilding what is already right: pieces in place are kept (and put
   *  back on their squares), anything else is added or removed. Covers
   *  castling, en passant and promotion after a move. */
  syncPieces(pieces) {
    /* Normally called once a move has finished; if one is still playing
       (the board was reset under it), it stops here. */
    this.generation = (this.generation ?? 0) + 1;
    this.stopAttacks();
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
  attack(mover, victim, from, to, { speed = 1, shot = true, current = () => true } = {}) {
    const a = this.worldOf(from), b = this.worldOf(to);
    /* A dragged character goes back to its square to make its attack. */
    mover.group.position.copy(a);
    const delta = b.clone().sub(a);
    /* The pawn's slash goes straight ahead, so it turns to face the victim. */
    if (mover.kind === "pawn") mover.holder.rotation.y = Math.atan2(delta.x, delta.z);
    const local = delta.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -mover.holder.rotation.y).divideScalar(PIECE_SCALE);
    const clip = clipsFor(mover.kind, [local.x, local.z]).attack;
    /* The victim turns to face what is coming for it, and loses its bond glow. */
    victim.holder.rotation.y = Math.atan2(-delta.x, -delta.z);
    for (const part of victim.bondParts ?? []) part.visible = false;
    mover.idle.stop();
    const act = mover.mixer.clipAction(clip);
    act.setLoop(THREE.LoopOnce, 1);
    act.clampWhenFinished = true;
    act.timeScale = speed;
    act.play();
    const reaction = reactionFor(mover.kind, victim.model);
    if (reaction) {
      victim.idle.stop();
      const r = victim.mixer.clipAction(reaction);
      r.setLoop(THREE.LoopOnce, 1);
      r.clampWhenFinished = true;
      r.timeScale = speed;
      r.play();
    }
    const fx = attackEffects(mover.kind, {
      scene: this.scene, attacker: mover.model, victim: victim.model, from: a, to: b,
      scale: PIECE_SCALE, attackerColour: mover.colour, victimColour: victim.colour,
    });
    const end = mover.kind === "pawn" ? PAWN_ATTACK_END : clip.duration;
    /* The knight leaps high, so his shot sits a little further back and higher. */
    const leapRoom = mover.kind === "knight" ? { back: 2.6, high: 2.3, lookY: 1.15 } : {};
    if (shot) this.attackShot(from, to, mover.colour === this.nearColour, leapRoom);
    return new Promise((resolve) => {
      this.active.push({
        act, fx, end, mover, victim,
        /* Each attack's sounds, on the attack's own clock. */
        cues: ATTACK_CUES[mover.kind] ?? [], cueAt: 0, loud: speed > 1 ? 0.8 : 1,
        done: () => {
          fx.dispose();
          if (mover.kind !== "pawn" || !current()) { resolve(); return; }
          /* The pawn steps onto the square once its slash is done. */
          const start = mover.group.position.clone();
          this.tween(speed > 1 ? QUICK_MOVE_MS : MOVE_MS, (t) => { if (current()) mover.group.position.lerpVectors(start, b, ease(t)); }, resolve);
        },
      });
      this.wake();
    });
  }

  /** A swipe across the board: tells the game, and the swipe hint (ui.jsx). */
  swiped(dir) {
    /* A tiny tick under the finger as the character changes. */
    buzz(12);
    this.onSwipe?.(dir);
    try { window.dispatchEvent(new CustomEvent("tactica-swipe")); } catch { /* no window */ }
  }

  /** A quick squash (`amount` > 0, flattening) or stretch (< 0) of a
   *  character, back to its shape in `ms`. A newer one replaces an older. */
  squash(entry, amount, ms = 200) {
    if (!entry || reducedMotion()) return;
    const token = (entry.squashToken = (entry.squashToken ?? 0) + 1);
    const h = entry.holder;
    this.tween(ms, (t) => {
      if (entry.squashToken !== token) return;
      const k = Math.sin(Math.PI * t) * (1 - t * 0.35);
      h.scale.set(1 + amount * 0.5 * k, 1 - amount * k, 1 + amount * 0.5 * k);
    }, () => { if (entry.squashToken === token) h.scale.set(1, 1, 1); });
  }

  tween(ms, step, done) {
    this.tweens.push({ start: performance.now(), ms, step, done });
    this.wake();
  }

  wake() { this.awakeUntil = performance.now() + 120; }

  bindPointer() {
    const raycaster = new THREE.Raycaster();
    const aim = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      raycaster.setFromCamera(new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1), this.camera);
    };
    /* Every character body under the finger, nearest first. */
    /* Every character body under the finger, nearest first, and where the
       finger met each one. */
    const pieceHits = () => {
      const points = new Map();
      for (const h of raycaster.intersectObjects([...this.pieces.values()].map((v) => v.hit))) {
        if (!points.has(h.object.userData.sq)) points.set(h.object.userData.sq, h.point.clone());
      }
      return points;
    };
    let down = null, drag = null, lastTap = null;
    /* Turning the view: with a character selected, one finger held down
       anywhere and a second finger sliding sideways turns the camera round
       it (the same sensitivity the map's drag had). The first finger can be
       anywhere, since after a turn the character is no longer under it.
       Lifting either finger ends it; nothing counts as a tap or a move. */
    let turning = null;
    /* A dragged character stays under the point of it that was grabbed: the
       finger slides it across a level through that point, so picking a
       piece up by its head doesn't make it jump to the square behind (and a
       small wobble lets it go on its own square, playing nothing). Returns
       the square it is over, or null off the board. */
    const dragTo = (e) => {
      aim(e);
      const p = raycaster.ray.intersectPlane(drag.plane, new THREE.Vector3());
      if (p) drag.at = { x: p.x - drag.offset.x, z: p.z - drag.offset.z };
      return drag.at ? this.squareAt(drag.at) : null;
    };
    const follow = (e) => {
      const sq = dragTo(e);
      if (!drag.at) return;
      drag.piece.group.position.set(drag.at.x, DRAG_LIFT, drag.at.z);
      this.setHover(sq === drag.sq ? null : sq);
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

    this.onDown = (e) => {
      /* A second finger while the first holds the selected character: turn. */
      if (down && e.pointerId !== down.id) {
        const holding = this.held != null;
        if (!holding || turning) return;
        if (drag?.piece) {
          /* The hold had started to lift it: put it back down first. */
          drag.piece.group.position.copy(this.worldOf(drag.sq));
          this.setHover(null);
          drag = null;
          this.dragging = false;
          this.onDrop?.(null);
        }
        down.turning = true;
        turning = { id: e.pointerId, x: e.clientX };
        try { this.canvas.setPointerCapture?.(e.pointerId); } catch { /* the pointer is already gone */ }
        return;
      }
      if (down && drag) return;
      aim(e);
      /* What a tap means is fixed where the finger lands, not where it lifts:
         a fast tap drifts, sometimes onto the next square or off the board. */
      const tile = raycaster.intersectObjects(this.tiles)[0]?.object.userData.sq ?? null;
      const points = pieceHits();
      const hits = [...points.keys()];
      down = { id: e.pointerId, x: e.clientX, y: e.clientY, sq: hits[0] ?? null, hits, points, tile, at: performance.now() };
    };
    this.onMove = (e) => {
      if (turning && e.pointerId === turning.id) {
        const dx = e.clientX - turning.x;
        turning.x = e.clientX;
        if (dx) {
          this.spinBy(dx * TURN_PER_PX);
          this.onTurn?.(dx * TURN_PER_PX);
          turning.total = (turning.total ?? 0) + Math.abs(dx);
          if (turning.total > 40 && !turning.told) { turning.told = true; try { window.dispatchEvent(new CustomEvent("tactica-turn")); } catch { /* no window */ } }
        }
        return;
      }
      if (!down || e.pointerId !== down.id || down.turning) return;
      /* A mouse released outside the page never sends pointerup here. */
      if (e.pointerType === "mouse" && e.buttons === 0 && !drag) { down = null; return; }
      const mx = e.clientX - down.x, my = e.clientY - down.y;
      const age = performance.now() - down.at;
      /* A young sideways move may still be a swipe, and a quick tap may
         drift as far as it is allowed to (see onUp): wait before picking up. */
      const flicking = Math.abs(mx) > Math.abs(my) * SIDEWAYS && age < FLICK_MS;
      const slop = age < QUICK_TAP_MS ? QUICK_TAP_SLOP_PX : TAP_SLOP_PX;
      if (!drag && down.sq != null && Math.hypot(mx, my) > slop && !flicking) {
        this.dragging = true;
        /* Whether it's the character already selected: only then can a quick
           sideways drag still turn out to be a swipe (see onUp). */
        const wasHeld = this.held === down.sq;
        if (this.onDragStart?.(down.sq)) {
          const grab = down.points.get(down.sq) ?? this.worldOf(down.sq);
          const home = this.worldOf(down.sq);
          drag = {
            sq: down.sq, piece: this.pieces.get(down.sq), wasHeld,
            plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), -grab.y),
            offset: { x: grab.x - home.x, z: grab.z - home.z },
            at: null,
          };
          try { this.canvas.setPointerCapture?.(e.pointerId); } catch { /* the pointer is already gone */ }
        } else { down.sq = null; this.dragging = false; }
      }
      if (!drag?.piece) return;
      drag.pointer = { clientX: e.clientX, clientY: e.clientY };
      follow(e);
      this.wake();
    };
    this.onUp = (e) => {
      if (turning && e.pointerId === turning.id) { turning = null; return; }
      if (down?.turning && e.pointerId === down.id) { down = null; turning = null; return; }
      if (!down || e.pointerId !== down.id) return;
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      const pressed = down;
      down = null;
      if (drag) {
        const over = dragTo(e);
        const { sq, piece, wasHeld } = drag;
        drag = null;
        this.setHover(null);
        this.dragging = false;
        /* The selected character flicked sideways, quickly, and let go off
           its glowing squares: that was a swipe, not a move. */
        const flick = wasHeld && performance.now() - pressed.at < FLICK_DRAG_MS && Math.abs(dx) > SWIPE_PX
          && Math.abs(dx) > Math.abs(dy) * SIDEWAYS && !this.targets.includes(over);
        /* The game always hears that the drag ended, even when the character
           is let go over its own square (or the drag was a swipe), or it
           would go on thinking a drag is in progress and stop moving the
           camera. */
        const taken = !flick && over !== sq && over != null ? !!this.onDrop?.(over) : (this.onDrop?.(null), false);
        if (piece && !taken) {
          const from = piece.group.position.clone(), home = this.worldOf(sq);
          this.tween(reducedMotion() ? 0 : 160, (t) => piece.group.position.lerpVectors(from, home, ease(t)));
        }
        if (flick) this.swiped(dx < 0 ? 1 : -1);
        return;
      }
      if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy)) { this.swiped(dx < 0 ? 1 : -1); return; }
      const quick = performance.now() - pressed.at < QUICK_TAP_MS;
      if (Math.hypot(dx, dy) > (quick ? QUICK_TAP_SLOP_PX : TAP_SLOP_PX)) return;
      /* A tap on a character means that character (an enemy on a glowing
         square is that square anyway); otherwise the square the finger landed
         on. While a character is selected, a glowing square under the finger
         wins over a body that only stands in front of it: the selected
         character itself (a pawn hides its own square ahead) or an enemy it
         can't take. A friend still wins, so you can switch characters. */
      const sq = this.throughTo(pressed.hits, pressed.tile);
      if (sq == null) return;
      const now = performance.now();
      /* A double-tap is two quick taps on the same square: tapping a piece and
         then a square next to it, fast, must count as two taps. */
      if (lastTap && lastTap.sq === sq && now - lastTap.at < DOUBLE_TAP_MS && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < DOUBLE_TAP_PX) {
        const first = lastTap.sq;
        lastTap = null;
        this.onDoubleTap?.(first);
        return;
      }
      lastTap = { sq, at: now, x: e.clientX, y: e.clientY };
      this.onTap?.(sq);
    };
    this.onCancel = (e) => {
      if (turning && e?.pointerId === turning.id) { turning = null; return; }
      if (down?.turning) { down = null; turning = null; return; }
      if (down && e?.pointerId !== down.id) return;
      const wasDragging = !!drag;
      if (drag?.piece) {
        drag.piece.group.position.copy(this.worldOf(drag.sq));
        this.setHover(null);
      }
      down = drag = null;
      this.dragging = false;
      /* Tell the game the drag ended with no square, or it would go on
         thinking a drag is in progress and stop moving the camera. */
      if (wasDragging) this.onDrop?.(null);
    };
    this.canvas.addEventListener("pointerdown", this.onDown);
    this.canvas.addEventListener("pointermove", this.onMove);
    this.canvas.addEventListener("pointerup", this.onUp);
    this.canvas.addEventListener("pointercancel", this.onCancel);
    /* If the browser takes the pointer away mid-drag without a pointerup,
       end the drag, or every later touch would be ignored. (After a normal
       pointerup `down` is already cleared, so this does nothing.) */
    this.onLostCapture = (e) => { if (drag && down && e.pointerId === down.id) this.onCancel(e); };
    this.canvas.addEventListener("lostpointercapture", this.onLostCapture);
  }

  resize() {
    const parent = this.canvas.parentElement;
    const w = parent.clientWidth, h = parent.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    if (this.composer) {
      this.composer.setPixelRatio(this.renderer.getPixelRatio());
      this.composer.setSize(w, h);
    }
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 62 : 45;
    this.camera.updateProjectionMatrix();
    /* A new screen shape needs a new fit for the whole-board view. */
    if (this.inBoardView) this.showBoard();
    this.wake();
  }

  /** Keeps motion smooth on slower phones: if frames while something moves
   *  average slower than about 40 a second, the 3D view renders at a lower
   *  resolution, a step at a time down to 1x; if it is still slow there, the
   *  finishing passes (glow and grade) are dropped for the rest of the
   *  visit. With plenty of headroom the resolution steps back up toward the
   *  screen's own. Checked every ~1.5 seconds of motion, never more than
   *  once every 3 seconds. */
  adaptResolution(dt, now) {
    /* Only ever down, and only after two slow stretches in a row: every
       change resizes every buffer (a frame of 80 ms or more), and the old
       way, up when fast and down when slow, kept changing back and forth
       every few seconds on a 120 Hz phone. */
    const a = (this.adapt ??= { sum: 0, n: 0, changedAt: 0, slow: 0 });
    a.sum += dt;
    a.n++;
    if (a.n < 90) return;
    const avg = a.sum / a.n;
    a.sum = 0;
    a.n = 0;
    a.slow = avg > 28 ? a.slow + 1 : 0;
    if (a.slow < 2 || now - a.changedAt < 4000) return;
    a.slow = 0;
    a.changedAt = now;
    const ratio = this.renderer.getPixelRatio();
    if (ratio > 1) {
      this.renderer.setPixelRatio(Math.max(1, ratio - 0.25));
      this.resize();
    } else if (this.post) this.post = false;
  }

  /** Average frame time while something is moving, for the test readout. */
  stats() {
    const times = this.frameTimes;
    const avg = times.length ? times.reduce((a, b) => a + b, 0) / times.length : 0;
    return { fps: avg ? Math.round(1000 / avg) : null, pixelRatio: this.renderer.getPixelRatio(), post: this.post };
  }

  /* Draws only while something is changing, to spare phone batteries. Set
     dressing (dust, flies) doesn't count as change: with nothing else going
     on, it and the pieces' idle breathing are drawn at about 30 frames a
     second, unless the scene is `continuous` (the menu's circling camera). */
  loop(now) {
    if (!this.running) return;
    const busy = this.tweens.length > 0 || now < this.awakeUntil || this.dragging || this.pulse.length > 0 || this.active.length > 0 || this.continuous || this.cameraMoving();
    const idleDue = this.pieces.size > 0 && now - (this.lastDraw ?? 0) >= IDLE_FRAME_MS;
    if (busy || idleDue) {
      const dt = now - this.lastFrame;
      const since = Math.min(0.1, (now - (this.lastDraw ?? now)) / 1000);
      this.lastDraw = now;
      /* Characters in a hit-stop hold their pose. */
      for (const entry of this.pieces.values()) if (!(entry.frozenUntil > now)) entry.mixer.update(since);
      for (const step of this.everyFrame) step(since);
      for (const run of this.active) {
        const impact = IMPACT[run.mover.kind];
        if (impact && !run.hit && run.act.time >= impact[0] && !reducedMotion()) {
          run.hit = true;
          const hold = impact[1] / Math.max(1, run.act.timeScale);
          run.mover.frozenUntil = now + hold;
          if (run.victim) run.victim.frozenUntil = now + hold;
          this.kick = Math.max(this.kick ?? 0, (IMPACT_KICK[run.mover.kind] ?? 0.06) / Math.max(1, run.act.timeScale));
          buzz(25);
        }
        run.fx.update(run.act.time);
        while (run.cueAt < run.cues.length && run.act.time >= run.cues[run.cueAt][0]) {
          const [, name, volume] = run.cues[run.cueAt++];
          playSound(name, { volume: volume * run.loud });
        }
      }
      /* An attack ends when its clip does, or when it was stopped or its
         attacker left the board (its clock would never run again, and the
         camera would wait for it forever). */
      const ended = this.active.filter((run) => run.cancelled || !run.mover.group.parent || run.act.time >= run.end - 1e-3 || !run.act.isRunning());
      this.active = this.active.filter((run) => !ended.includes(run));
      ended.forEach((run) => run.done());
      if (this.dragging) this.dragFollow?.(dt);
      const beat = 0.7 + 0.45 * (0.5 + 0.5 * Math.sin((now / PULSE_MS) * Math.PI * 2));
      for (const { material, base } of this.pulse) material.opacity = Math.min(1, base * beat);
      if (this.selMarker) {
        this.selMarker.mesh.position.y = this.selMarker.baseY + 0.07 * Math.sin(now / 280);
        this.selMarker.mesh.rotation.y = now / 900;
      }
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
      /* The rush's long shake, or an impact's short kick, fading fast. */
      const shake = Math.max(this.shake, this.kick ?? 0);
      if (shake > 0) {
        this.camera.position.x += (Math.random() - 0.5) * shake;
        this.camera.position.y += (Math.random() - 0.5) * shake;
      }
      if (this.kick) { this.kick *= Math.exp(-since * 14); if (this.kick < 0.003) this.kick = 0; else this.wake(); }
      this.camera.lookAt(this.camLook);
      this.updateFades(since);
      this.updateSeeThrough(since);
      this.reportView();
      /* The shadow map costs as much as the scene itself (every character's
         every part drawn again): redrawn every other frame, a lag no one can
         see, it nearly halves the work per frame. */
      this.shadowFrame = !this.shadowFrame;
      if (this.shadowFrame) this.renderer.shadowMap.needsUpdate = true;
      if (this.post) this.composer.render();
      else this.renderer.render(this.scene, this.camera);
      /* The loading screen waits for a mode's first picture. */
      /* The first picture with its characters (a scene with none, like the
         Memories list, says so from a timer: see the constructor). */
      if (!this.framed && this.pieces.size) { this.framed = true; try { window.dispatchEvent(new CustomEvent("tactica-frame")); } catch { /* no window */ } }
      if (busy && dt < 200) this.adaptResolution(dt, now);
    }
    this.lastFrame = now;
    requestAnimationFrame(this.loop);
  }

  dispose() {
    this.running = false;
    clearTimeout(this.warmTimer);
    clearTimeout(this.frameTimer);
    this.resizeObserver.disconnect();
    this.canvas.removeEventListener("pointerdown", this.onDown);
    this.canvas.removeEventListener("pointerup", this.onUp);
    this.canvas.removeEventListener("pointermove", this.onMove);
    this.canvas.removeEventListener("pointercancel", this.onCancel);
    this.canvas.removeEventListener("lostpointercapture", this.onLostCapture);
    this.canvas.removeEventListener("webglcontextlost", this.onLostEvent);
    this.composer?.dispose();
    this.renderer.dispose();
    /* Hand the WebGL context back now rather than whenever the browser gets
       round to it: phones allow only a few at once, and every screen makes
       a new one, so without this the oldest get killed after some menu
       hopping and a later screen can go black. Only once the canvas has
       left the page: a canvas that stays (a scene rebuilt in place) would
       otherwise be left with a dead context. */
    const renderer = this.renderer, canvas = this.canvas;
    setTimeout(() => { if (!canvas.isConnected) renderer.forceContextLoss(); }, 0);
  }
}
