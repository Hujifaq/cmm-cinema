// News page: WebGL disc gallery (three.js).
// Each story is a 3D disc with its picture printed on the face. Discs sit on a tilted arc on
// desktop and in a dropping row on touch screens. The scroll wheel steps one disc at a time,
// dragging the row (or swiping) slides through it with inertia, dragging the front disc spins it,
// and hovering the front disc tilts it toward the pointer while a hand-drawn pen loop boils
// around it.
import {
  ACESFilmicToneMapping, AmbientLight, BufferAttribute, BufferGeometry, CanvasTexture,
  CircleGeometry, Color, DirectionalLight, DoubleSide, EquirectangularReflectionMapping, Fog,
  Group, LatheGeometry, MathUtils, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, NoColorSpace,
  PMREMGenerator, PerspectiveCamera, Quaternion, Raycaster, RectAreaLight, RingGeometry, Scene,
  SRGBColorSpace, Vector2, Vector3, WebGLRenderer
} from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { initIndexMenu } from './index-menu.js';

const S = {
  // Disc surface
  texGrain: 0.59, texPrint: 0.35, texScratches: 0.36, texGloss: 1,
  frontClearcoat: 0.8, frontRough: 0.42, frontMetal: 0.48,
  backBaseColor: '#1A1E2A', backRough: 0.23, backMetal: 1, backClearcoat: 0.34,
  backIridescence: 1, backIridIOR: 1.86, backIridThickness: 900, backRadialDetail: 1,
  edgeColor: '#FFFFFF', edgeRoughness: 0.04, edgeMetalness: 0.55, edgeBleed: 0.026,
  hubColor: '#FFFFFF', hubTransmission: 0.68, hubRoughness: 0.38, hubIOR: 2,
  hubMatrixWidth: 0.4, hubFrostedEdge: 0.54,
  discThickness: 0.01, edgeBevel: 1, holeSize: 0.14, hubSize: 0.24,
  // Arrangement and camera
  galleryScale: 1.08, hGap: 2.3, depthGap: 1, activeDiscY: 0.06,
  galleryRotX: -30, galleryRotY: -30, inactiveScale: 0.8,
  cameraDistance: 4.4, cameraFOV: 40,
  // Light
  exposure: 0.86, environmentIntensity: 1, keyIntensity: 0.75, keyColor: '#FFF9E8', keyX: 3.5, keyY: -8,
  fillIntensity: 0.3, rimIntensity: 0.75, rimColor: '#499FF5', topStripIntensity: 1.9, fogColor: '#FFFFFF',
  // Motion
  hoverTiltStrength: 0.21, dragSensitivity: 0.95, dragVelocitySmoothing: 0.32, dragMaxVelocity: 0.5,
  friction: 0.89, maxSpinAngle: 180, resetDuration: 1.2, dragStartDistance: 5, snapDuration: 0.46,
  flowLean: 0.055, flowLeanMax: 0.3, flowBank: 0.32, flowDip: 0.014, flowDipMax: 0.09,
  followTight: 15, followBase: 11, followFalloff: 1.15, followMin: 6.5,
  snapFreq: 9.5, snapDamping: 12,
  wipePush: 0.012, wipePushMax: 0.5, wipeSpin: 0.009, wipeSpinMax: 0.4, wipeMinSpeed: 9,
  pushDamping: 4.5, pushReturn: 3.4, pressDepth: 0.55, pressTilt: 1.5,
  flightRecede: 2.2, flightStaggerIn: 0.28, flightStaggerMax: 4, flightPopScaleIn: 0.02,
  introRise: 1.6, introDepth: 0.7, introSpin: 1.1, introDuration: 1.15,
  flightStagger: 0.45, flightPopScale: 0.35,
  exitPress: 0.94, exitPressTime: 0.12, exitSpring: 1.015, exitSpringTime: 0.16, exitOthers: 0.55, exitDuration: 0.8,
  loopDrop: 3.4, loopRadius: 0.36, loopDepth: 0.3, loopDuration: 1.7,
  // Touch screens (991px and below)
  touchPeek: 1, touchMinScale: 0.3, touchMaxScale: 3, touchGap: 2.2, touchDepth: 0.5,
  touchLeadMaxHeight: 0.6, touchDropY: 1, touchActiveScale: 1.5, touchInactiveScale: 0.6, touchFlickVelocity: 0.035,
  // Scroll wheel: one disc per gesture
  wheelNoiseFloor: 0.3, wheelStepThreshold: 6, wheelEventCap: 24, wheelEnvelopeTau: 550, wheelRiseFactor: 1.2,
  wheelTickGap: 34, wheelTickRatio: 1, wheelPauseGap: 130, wheelIdleReset: 150, wheelMinStepTick: 90,
  wheelMinStepFlick: 190, wheelSustainDelay: 480, wheelSustainRatio: 0.8, wheelQuietGap: 220,
  // Hand-drawn hover loop
  scribbleColor: '#000000', scribbleFps: 10, scribblePoints: 24, scribbleJitter: 0.028, scribbleLoops: 2,
  scribbleLoopGap: 0.045, scribblePadding: 0.06, scribbleWidth: 0.012, scribbleSweep: 0.68,
  scribbleSweepJitter: 0.4, scribbleIn: [0.3, 0.5, 0.72], scribbleOut: [0.72, 0.5, 0.3], scribbleLag: 15,
  artResolution: 1024
};

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const nextFrame = () => new Promise(resolve => setTimeout(resolve, 0));

// ---------- Easing and a tiny tween runner ----------

const bezier = (x1, y1, x2, y2) => {
  const at = (a, b, t) => ((1 - 3 * b + 3 * a) * t + (3 * b - 6 * a)) * t * t + 3 * a * t;
  const slope = (a, b, t) => 3 * (1 - 3 * b + 3 * a) * t * t + 2 * (3 * b - 6 * a) * t + 3 * a;
  return x => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const d = at(x1, x2, t) - x;
      const s = slope(x1, x2, t);
      if (Math.abs(d) < 1e-6 || !s) break;
      t = clamp(t - d / s, 0, 1);
    }
    return at(y1, y2, t);
  };
};
const EASE = {
  glide: bezier(0.32, 0.72, 0, 1),
  linear: t => t,
  out2: t => 1 - (1 - t) ** 2,
  out3: t => 1 - (1 - t) ** 3,
  in2: t => t * t,
  inOut3: t => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
};

const tweens = new Set();
function tween(target, to, { duration, ease = EASE.out3, delay = 0, onComplete } = {}) {
  const keys = Object.keys(to);
  for (const t of tweens) {
    if (t.target !== target) continue;
    t.keys = t.keys.filter(k => !keys.includes(k));
    if (!t.keys.length) tweens.delete(t);
  }
  const t = { target, keys, from: {}, to, start: performance.now() + delay * 1000, duration: Math.max(0, duration) * 1000, ease, onComplete, begun: false };
  tweens.add(t);
  return t;
}
const killTweens = target => { for (const t of tweens) if (t.target === target) tweens.delete(t); };
const isTweening = target => { for (const t of tweens) if (t.target === target) return true; return false; };
function runTweens(now) {
  for (const t of [...tweens]) {
    if (now < t.start) continue;
    if (!t.begun) { t.begun = true; t.keys.forEach(k => { t.from[k] = t.target[k]; }); }
    const p = t.duration ? clamp((now - t.start) / t.duration, 0, 1) : 1;
    const e = t.ease(p);
    t.keys.forEach(k => { t.target[k] = t.from[k] + (t.to[k] - t.from[k]) * e; });
    if (p >= 1) { tweens.delete(t); if (t.onComplete) t.onComplete(); }
  }
}

// ---------- Procedural surface maps (pressed print, scratches, gloss rings) ----------

const noise = (x, y) => { const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return v - Math.floor(v); };

function heightToNormals(height, size) {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = height[y * size + Math.max(0, x - 1)] - height[y * size + Math.min(size - 1, x + 1)];
      const ny = height[Math.max(0, y - 1) * size + x] - height[Math.min(size - 1, y + 1) * size + x];
      const inv = 1 / Math.sqrt(nx * nx + ny * ny + 1);
      const i = (y * size + x) * 4;
      data[i] = (nx * inv * 0.5 + 0.5) * 255;
      data[i + 1] = (ny * inv * 0.5 + 0.5) * 255;
      data[i + 2] = (inv * 0.5 + 0.5) * 255;
      data[i + 3] = 255;
    }
  }
  return data;
}

function frontNormalData(size) {
  const h = new Float32Array(size * size);
  const c = size / 2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const r = Math.hypot(x - c, y - c) + 1e-4;
    h[y * size + x] = Math.sin(r * 0.6) * 0.02 + (noise(x * 0.4, y * 0.4) - 0.5) * 0.5 * S.texPrint;
  }
  const scratches = Math.floor(30 * S.texScratches);
  for (let s = 0; s < scratches; s++) {
    const a = Math.random() * Math.PI * 2;
    const len = 30 + Math.random() * 220;
    const sx = Math.random() * size;
    const sy = Math.random() * size;
    const depth = (Math.random() * 0.7 + 0.2) * S.texScratches;
    for (let k = 0; k < len; k++) {
      const px = Math.round(sx + Math.cos(a) * k);
      const py = Math.round(sy + Math.sin(a) * k);
      if (px < 1 || py < 1 || px >= size - 1 || py >= size - 1) continue;
      h[py * size + px] -= depth;
    }
  }
  const dust = Math.floor(500 * S.texScratches);
  for (let d = 0; d < dust; d++) h[Math.floor(Math.random() * size) * size + Math.floor(Math.random() * size)] += (Math.random() - 0.5) * S.texScratches * 1.2;
  return heightToNormals(h, size);
}

function backNormalData(size) {
  const h = new Float32Array(size * size);
  const c = size / 2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const r = Math.hypot(x - c, y - c);
    h[y * size + x] = Math.sin(r * 3.2) * 0.5 * S.backRadialDetail + (noise(x * 0.6, y * 0.6) - 0.5) * 0.06 * S.backRadialDetail;
  }
  return heightToNormals(h, size);
}

function roughData(size, front) {
  const data = new Uint8ClampedArray(size * size * 4);
  const c = size / 2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let r;
    if (front) {
      r = S.frontRough + (noise(x * 2.3, y * 2.3) - 0.5) * 0.35 * S.texGrain + (noise(x * 0.5, y * 0.5) - 0.5) * 0.3 * S.texPrint;
      r -= (Math.sin((Math.hypot(x - c, y - c) / (size * 0.5)) * 14) * 0.5 + 0.5) * 0.5 * S.texGloss;
    } else {
      const d = Math.hypot(x - c, y - c);
      r = S.backRough + Math.sin(d * 1.6) * 0.06 * S.backRadialDetail + (noise(x * 1.2, y * 1.2) - 0.5) * 0.04 * S.backRadialDetail;
    }
    const v = clamp(r, 0.02, 1) * 255;
    const i = (y * size + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = v;
    data[i + 3] = 255;
  }
  return data;
}

const toCanvas = (data, size) => {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  canvas.getContext('2d').putImageData(new ImageData(data, size, size), 0, 0);
  return canvas;
};

// Dark studio with a few soft light strips, used for reflections.
function environmentCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const base = ctx.createLinearGradient(0, 0, 0, 512);
  base.addColorStop(0, '#25282f');
  base.addColorStop(0.5, '#0e0f13');
  base.addColorStop(1, '#020203');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 1024, 512);
  const w = 0.07;
  [[0.14, w, 1], [0.4, w * 0.7, 0.6], [0.26, w * 1.1, 0.85], [0.62, w * 0.5, 0.35]].forEach(([center, half, strength]) => {
    const g = ctx.createLinearGradient(0, 512 * (center - half), 0, 512 * (center + half));
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, `rgba(255,255,255,${Math.max(0.1, 0.85 * strength)})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 512 * (center - half), 1024, 512 * half * 2);
  });
  return canvas;
}

// Brushed metal ring around the hole.
function matrixCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(256, 256, 40.96, 256, 256, 256);
  g.addColorStop(0, '#d9dde4');
  g.addColorStop(0.42, '#f0f2f5');
  g.addColorStop(0.72, '#cfd4dc');
  g.addColorStop(1, '#b8bec8');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);
  ctx.lineWidth = 1;
  [0.255, 0.285, 0.315, 0.345].forEach((r, i) => {
    ctx.strokeStyle = `rgba(255,255,255,${0.14 - i * 0.018})`;
    ctx.beginPath();
    ctx.arc(256, 256, 512 * r, 0, Math.PI * 2);
    ctx.stroke();
  });
  return canvas;
}

// ---------- Disc geometry ----------

const T = S.discThickness;
const HOLE = 2 * S.holeSize;
const HUB = S.hubSize;
const RIM = 1 - S.edgeBleed;

function edgeGeometry() {
  const h = T / 2;
  const b = 0.0015 + S.edgeBevel * Math.min(T * 0.55, 0.018);
  const g = new LatheGeometry([
    new Vector2(RIM, h), new Vector2(1 - b, h), new Vector2(1, h - b),
    new Vector2(1, -h + b), new Vector2(1 - b, -h), new Vector2(RIM, -h)
  ], 256);
  g.computeVertexNormals();
  return g;
}

// A clear ring with a softly rippled top and bottom, spun around the disc's axis.
function hubGeometry(inner, outer, thickness, ripple, segments) {
  const h = thickness / 2;
  const r0 = Math.max(0.002, inner);
  const span = Math.max(1e-4, outer - r0);
  const wave = t => h * (1 - ripple) + h * ripple * (0.6 + 0.4 * Math.cos(t * Math.PI * 3));
  const pts = [new Vector2(r0, -h), new Vector2(r0, h)];
  for (let k = 0; k <= 5; k++) pts.push(new Vector2(r0 + span * (k / 5), wave(k / 5)));
  pts.push(new Vector2(outer, h * 0.92), new Vector2(outer, -h * 0.92));
  for (let k = 5; k >= 0; k--) pts.push(new Vector2(r0 + span * (k / 5), -wave(k / 5)));
  const g = new LatheGeometry(pts, segments);
  g.computeVertexNormals();
  return g;
}

function planarUv(geometry) {
  const pos = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) * 0.5 + 0.5, pos.getY(i) * 0.5 + 0.5);
  uv.needsUpdate = true;
}

// ---------- Gallery ----------

async function createGallery(root) {
  const host = root.querySelector('[data-disc-canvas]');
  const items = [...root.querySelectorAll('[data-disc-item]')].map((el, index) => ({
    index, el,
    title: el.dataset.title || '',
    category: el.dataset.category || '',
    date: el.dataset.date || '',
    excerpt: el.dataset.excerpt || '',
    url: el.dataset.url || '',
    art: el.dataset.art || ''
  }));
  const count = items.length;
  if (!host || !count) return;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const touchLayout = matchMedia('(max-width: 991px)');
  const isTouch = () => touchLayout.matches;
  const baseScale = S.galleryScale;
  let disposed = false;

  const renderer = new WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = S.exposure;
  renderer.setClearColor(0, 0);
  if ('transmissionResolutionScale' in renderer) renderer.transmissionResolutionScale = 0.5;
  Object.assign(renderer.domElement.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'block', pointerEvents: 'none' });
  RectAreaLightUniformsLib.init();

  const scene = new Scene();
  scene.fog = new Fog(S.fogColor, 7, 14);
  const camera = new PerspectiveCamera(S.cameraFOV, 1, 0.1, 100);
  camera.position.set(0, 0, S.cameraDistance);
  camera.lookAt(0, 0, 0);

  const gallery = new Group();
  gallery.rotation.x = MathUtils.degToRad(S.galleryRotX);
  gallery.rotation.y = MathUtils.degToRad(S.galleryRotY);
  gallery.scale.setScalar(S.galleryScale);
  scene.add(gallery);
  scene.add(new AmbientLight(0xffffff, 0.25));
  const key = new DirectionalLight(S.keyColor, S.keyIntensity);
  key.position.set(S.keyX, S.keyY, 6);
  const fill = new DirectionalLight(0xffffff, S.fillIntensity);
  fill.position.set(-5, -2, 4);
  const rim = new DirectionalLight(S.rimColor, S.rimIntensity);
  rim.position.set(0, 3, -6);
  const strip = new RectAreaLight(0xffffff, S.topStripIntensity, 6, 0.4);
  strip.position.set(0, 3.2, 3);
  strip.lookAt(0, 0, 0);
  scene.add(key, fill, rim, strip);

  const pmrem = new PMREMGenerator(renderer);
  const envSource = new CanvasTexture(environmentCanvas());
  envSource.mapping = EquirectangularReflectionMapping;
  const envTarget = pmrem.fromEquirectangular(envSource);
  envSource.dispose();
  pmrem.dispose();
  scene.environment = envTarget.texture;
  scene.environmentIntensity = S.environmentIntensity;

  const texture = (canvas, colorSpace = NoColorSpace) => {
    const t = new CanvasTexture(canvas);
    t.colorSpace = colorSpace;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return t;
  };

  // Surface maps are built in small pieces so the page stays responsive.
  const frontNormal = texture(toCanvas(frontNormalData(1024), 1024)); await nextFrame();
  const backNormal = texture(toCanvas(backNormalData(1024), 1024)); await nextFrame();
  const frontRough = texture(toCanvas(roughData(512, true), 512)); await nextFrame();
  const backRough = texture(toCanvas(roughData(512, false), 512)); await nextFrame();
  const placeholderCanvas = document.createElement('canvas');
  placeholderCanvas.width = placeholderCanvas.height = 16;
  const pctx = placeholderCanvas.getContext('2d');
  pctx.fillStyle = '#0c0c0e';
  pctx.fillRect(0, 0, 16, 16);
  const placeholder = texture(placeholderCanvas, SRGBColorSpace);

  const frontGeo = new RingGeometry(HUB, RIM, 220, 1);
  const backGeo = new RingGeometry(HUB, RIM, 220, 1);
  planarUv(frontGeo);
  planarUv(backGeo);
  const holeR = HOLE / 2;
  const hubSpan = HUB - holeR;
  const frostOuter = holeR + hubSpan * 0.34;
  const matrixOuter = frostOuter + hubSpan * S.hubMatrixWidth;
  const hubT = T * 1.02;
  const edgeGeo = edgeGeometry();
  const hubGeo = hubGeometry(matrixOuter, HUB, hubT, 0.22, 160);
  const matrixGeo = hubGeometry(frostOuter, matrixOuter, hubT * 0.88, 0.12, 128);
  const frostGeo = hubGeometry(holeR, frostOuter, hubT * 0.96, 0.4, 128);
  const pickGeo = new CircleGeometry(1, 24);
  const pickMat = new MeshBasicMaterial({ visible: false, side: DoubleSide, depthWrite: false });

  const backMat = new MeshPhysicalMaterial({
    color: new Color(S.backBaseColor), roughness: S.backRough, metalness: S.backMetal, roughnessMap: backRough,
    clearcoat: S.backClearcoat, clearcoatRoughness: 0.06, iridescence: S.backIridescence, iridescenceIOR: S.backIridIOR,
    iridescenceThicknessRange: [140, S.backIridThickness], normalMap: backNormal, normalScale: new Vector2(0.5, 0.5), envMapIntensity: 1.5
  });
  const edgeMat = new MeshPhysicalMaterial({
    color: new Color(S.edgeColor), roughness: S.edgeRoughness, metalness: S.edgeMetalness,
    clearcoat: 0.7, clearcoatRoughness: 0.05, envMapIntensity: 1.8, side: DoubleSide
  });
  const hubMat = new MeshPhysicalMaterial({
    color: new Color(S.hubColor), roughness: S.hubRoughness, metalness: 0, transmission: S.hubTransmission, thickness: 0.6,
    ior: S.hubIOR, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.3, transparent: true, side: DoubleSide
  });
  const matrixMat = new MeshPhysicalMaterial({
    color: new Color(0xdfe3e9), map: texture(matrixCanvas(), SRGBColorSpace), roughness: 0.28, metalness: 0.82,
    clearcoat: 0.7, clearcoatRoughness: 0.12, envMapIntensity: 1.45, side: DoubleSide
  });
  const frostMat = new MeshPhysicalMaterial({
    color: new Color(0xeef0f5), roughness: 0.25 + S.hubFrostedEdge * 0.55, metalness: 0, transmission: (1 - S.hubFrostedEdge) * 0.5,
    thickness: 0.3, ior: 1.5, clearcoat: 0.4, clearcoatRoughness: 0.3, envMapIntensity: 0.9, transparent: true, side: DoubleSide
  });

  // One disc per story.
  const discs = items.map((item, index) => {
    const group = new Group();
    const spin = new Group();
    group.add(spin);
    const frontMat = new MeshPhysicalMaterial({
      map: placeholder, roughness: S.frontRough, metalness: S.frontMetal, roughnessMap: frontRough,
      clearcoat: S.frontClearcoat, clearcoatRoughness: 0.18 * (1 - S.texGloss), normalMap: frontNormal,
      normalScale: new Vector2(0.3, 0.3), envMapIntensity: 0.85
    });
    const front = new Mesh(frontGeo, frontMat);
    const back = new Mesh(backGeo, backMat);
    const edge = new Mesh(edgeGeo, edgeMat);
    const hub = new Mesh(hubGeo, hubMat);
    const matrix = new Mesh(matrixGeo, matrixMat);
    const frost = new Mesh(frostGeo, frostMat);
    front.position.z = T / 2 + 6e-4;
    back.position.z = -T / 2 - 6e-4;
    back.rotation.y = Math.PI;
    edge.rotation.x = hub.rotation.x = matrix.rotation.x = frost.rotation.x = Math.PI / 2;
    spin.add(front, back, edge, hub, matrix, frost);
    const pick = new Mesh(pickGeo, pickMat);
    pick.renderOrder = -1;
    pick.userData.index = index;
    group.add(pick);
    gallery.add(group);
    return {
      index, item, group, spin, pick, frontMat, placed: false,
      hover: 0, spinX: 0, spinY: 0, resetting: false,
      pushX: 0, pushY: 0, pushZ: 0, pushVX: 0, pushVY: 0, pushVZ: 0,
      pushRotX: 0, pushRotY: 0, pushRotVX: 0, pushRotVY: 0
    };
  });
  const picks = discs.map(d => d.pick);

  let forceFrames = 3;
  const wake = (frames = 2) => { forceFrames = Math.max(forceFrames, frames); };

  // Story pictures, printed onto the disc face (round, with the centre hole cut out).
  function printArt(image) {
    const size = clamp(S.artResolution, 512, 1536);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.arc(size / 2, size / 2, size * 0.5 * Math.max(S.holeSize, S.hubSize), 0, Math.PI * 2, true);
    ctx.clip('evenodd');
    ctx.fillStyle = '#0c0c0e';
    ctx.fillRect(0, 0, size, size);
    const ratio = image.naturalWidth / image.naturalHeight || 1;
    let w = size;
    let h = size;
    if (ratio > 1) w = h * ratio; else h = w / ratio;
    ctx.drawImage(image, (size - w) / 2, (size - h) / 2, w, h);
    ctx.restore();
    return canvas;
  }
  const artLoads = new Map();
  function loadArt(index) {
    const disc = discs[index];
    if (!disc || !disc.item.art) return Promise.resolve();
    if (artLoads.has(index)) return artLoads.get(index);
    const p = new Promise(resolve => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.decoding = 'async';
      img.onload = () => {
        if (disposed) { resolve(); return; }
        try {
          const t = texture(printArt(img), SRGBColorSpace);
          renderer.initTexture(t);
          disc.frontMat.map = t;
          disc.frontMat.needsUpdate = true;
        } catch (err) {
          console.warn('Could not print disc artwork:', disc.item.art, err);
        }
        wake(2);
        resolve();
      };
      img.onerror = () => { console.warn('Could not load disc artwork:', disc.item.art); resolve(); };
      img.src = disc.item.art;
    });
    artLoads.set(index, p);
    return p;
  }

  // ---------- Hand-drawn loop around the front disc ----------

  const scribbleSegs = S.scribblePoints * 3;
  const scribble = new Group();
  const scribbleMat = new MeshBasicMaterial({ color: new Color(S.scribbleColor), side: DoubleSide, depthWrite: false, toneMapped: false });
  const scribbleGeos = [];
  for (let k = 0; k < S.scribbleLoops; k++) {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array((scribbleSegs + 1) * 2 * 3), 3));
    const index = [];
    for (let i = 0; i < scribbleSegs; i++) { const a = i * 2; index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setIndex(index);
    const mesh = new Mesh(g, scribbleMat);
    mesh.renderOrder = 900;
    mesh.frustumCulled = false;
    scribbleGeos.push(g);
    scribble.add(mesh);
  }
  scribble.visible = false;
  gallery.add(scribble);

  // A wobbly ribbon that sweeps part of the way round; `amount` grows it while drawing in and out.
  function drawLoop(k, amount) {
    const pos = scribbleGeos[k].getAttribute('position');
    const radius = 1 + S.scribblePadding + k * S.scribbleLoopGap;
    const half = S.scribbleWidth * 0.5;
    const sweep = clamp(S.scribbleSweep * (1 + (Math.random() - 0.5) * S.scribbleSweepJitter), 0.12, 1) * amount;
    const arc = Math.PI * 2 * sweep;
    const start = Math.random() * Math.PI * 2;
    const knots = [];
    for (let i = 0; i <= S.scribblePoints; i++) knots.push(1 + (Math.random() - 0.5) * 2 * S.scribbleJitter);
    for (let i = 0; i <= scribbleSegs; i++) {
      const t = i / scribbleSegs;
      const a = start + t * arc;
      const u = t * S.scribblePoints * sweep;
      const k0 = Math.floor(u);
      const k1 = Math.min(S.scribblePoints, k0 + 1);
      const f = u - k0;
      const s = f * f * (3 - 2 * f);
      const wobble = knots[k0] * (1 - s) + knots[k1] * s;
      const taper = Math.min(1, Math.min(t, 1 - t) * 14 + 0.15);
      const inner = radius * wobble - half * taper;
      const outer = radius * wobble + half * taper;
      const c = Math.cos(a);
      const sn = Math.sin(a);
      pos.setXYZ(i * 2, c * inner, sn * inner, 0);
      pos.setXYZ(i * 2 + 1, c * outer, sn * outer, 0);
    }
    pos.needsUpdate = true;
  }
  const drawLoops = amount => { for (let k = 0; k < scribbleGeos.length; k++) drawLoop(k, amount); };

  // ---------- State ----------

  let L = 0;                 // continuous position along the row (0 = first story)
  let active = -1;           // story in front
  let target = -1;           // story a running move is heading to
  let pending = 0;           // last requested story (wheel stepping counts from here)
  let dragVel = 0;           // inertia after a mouse drag
  let springVel = 0;         // settle spring toward the nearest disc
  let flow = 0;              // smoothed travel speed: leans and dips the row
  let lastL = 0;
  let hovered = -1;
  let hoverDirty = false;
  let pointerX = 0;          // pointer in -1..1 across the canvas
  let pointerY = 0;
  let mouseVX = 0;
  let mouseVY = 0;
  let lastMoveAt = 0;
  let lastMouseX = 0;
  let lastMouseY = 0;
  let keyboardFocus = false;
  let touchSpan = 0;
  let inView = true;
  let lastFrame = performance.now();
  const moveTween = { value: 0 };
  const intro = { active: reduced ? 1 : 0.001, others: reduced ? 1 : 0, rise: 1, playing: false, path: 'rise' };
  // Leaving for a story: the front disc is pressed, springs, then turns edge-on and shrinks away.
  const exit = { press: 1, shrink: 1, others: 1 };
  let leaving = false;
  const down = { on: false, id: -1, touch: false, dragging: false, spinning: -1, candidate: -1, startX: 0, startY: 0, lastX: 0, lastY: 0, lastT: 0, suppressUntil: 0 };

  const nearest = () => Math.round(clamp(L, 0, count - 1));
  const currentTarget = () => (target >= 0 ? clamp(target, 0, count - 1) : isTweening(moveTween) ? clamp(pending, 0, count - 1) : clamp(Math.round(L), 0, count - 1));

  // ---------- Story text and controls ----------

  const ui = {
    title: root.querySelector('[data-disc-title]'),
    category: root.querySelector('[data-disc-category]'),
    date: root.querySelector('[data-disc-date]'),
    index: root.querySelector('[data-disc-index]'),
    excerpt: root.querySelector('[data-disc-excerpt]'),
    read: root.querySelector('[data-disc-read]'),
    progress: root.querySelector('[data-disc-progress]'),
    prev: root.querySelector('[data-disc-prev]'),
    next: root.querySelector('[data-disc-next]')
  };
  const live = document.createElement('p');
  live.className = 'disc-news__sr';
  live.setAttribute('aria-live', 'polite');
  live.setAttribute('aria-atomic', 'true');
  root.appendChild(live);
  let liveTimer = 0;
  let textTimer = 0;

  // Masked lines and letters rise into place, the same reveal the movie pages use for their copy.
  const { gsap, SplitText } = window;
  const textFx = !reduced && !!gsap && !!SplitText;
  if (textFx) gsap.registerPlugin(SplitText);
  let textFxCleanup = () => {};
  const textReady = () => root.setAttribute('data-text-ready', '');

  function revealText({ full, dir = 1, delay = 0 }) {
    textFxCleanup();
    if (!textFx) { textReady(); return; }
    const splits = [];
    const split = (el, type) => {
      if (!el) return [];
      const result = SplitText.create(el, { type: type === 'chars' ? 'words,chars' : type, mask: type });
      splits.push(result);
      return result[type];
    };
    const info = root.querySelector('.disc-news__info');
    const kicker = info && info.querySelector('.disc-news__kicker');
    const rows = [...root.querySelectorAll('.disc-news__meta > div')];
    const tl = gsap.timeline({ delay, defaults: { ease: 'power4.out' } });
    const from = Math.sign(dir) * 110;
    if (full) tl.from(split(kicker, 'lines'), { yPercent: 105, duration: 0.8 }, 0);
    tl.from(split(ui.title, 'chars'), { yPercent: from, duration: 1, stagger: 0.025 }, full ? 0.05 : 0)
      .from(full ? rows : [ui.category, ui.date].filter(Boolean), { y: 14, autoAlpha: 0, duration: 0.7, ease: 'power3.out', stagger: 0.06, clearProps: 'transform,opacity,visibility' }, full ? 0.3 : 0.12)
      .from(split(ui.excerpt, 'lines'), { yPercent: 105, duration: 1, stagger: 0.08 }, full ? 0.5 : 0.18);
    textFxCleanup = () => { tl.kill(); splits.forEach(result => result.revert()); textFxCleanup = () => {}; };
    // Once settled, un-split only the line-split copy (it re-wraps on resize). The headline keeps its letters
    // split until the next story: un-splitting it lets the browser re-break the line (Thai words, balanced
    // wrapping), which made the finished title jump.
    tl.eventCallback('onComplete', () => splits.filter(result => !result.chars.length).forEach(result => result.revert()));
    textReady();
  }

  function writeText(item) {
    if (ui.title) ui.title.textContent = item.title;
    if (ui.category) ui.category.textContent = item.category;
    if (ui.date) ui.date.textContent = item.date;
    if (ui.excerpt) ui.excerpt.textContent = item.excerpt;
  }

  function setActive(i) {
    const n = clamp(i, 0, count - 1);
    if (n === active) return;
    const previous = active;
    active = n;
    const item = items[n];
    root.setAttribute('data-active-index', String(n));
    items.forEach((it, k) => it.el.setAttribute('data-disc-status', k === n ? 'active' : 'inactive'));
    if (ui.index) ui.index.textContent = String(n + 1).padStart(2, '0');
    if (ui.progress) ui.progress.style.transform = `scaleX(${(n + 1) / count})`;
    if (ui.prev) ui.prev.disabled = n === 0;
    if (ui.next) ui.next.disabled = n === count - 1;
    if (ui.read) ui.read.href = item.url || '#';
    document.querySelectorAll('[data-disc-goto]').forEach(link => {
      if (Number(link.dataset.discGoto) === n) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
    const textEls = [ui.title, ui.category, ui.date, ui.excerpt].filter(Boolean);
    clearTimeout(textTimer);
    if (previous < 0 || reduced) writeText(item);
    else if (textFx) {
      textFxCleanup();
      textEls.forEach(el => el.classList.add('is-leaving'));
      textTimer = setTimeout(() => {
        writeText(item);
        textEls.forEach(el => { el.style.transition = 'none'; el.classList.remove('is-leaving'); });
        revealText({ full: false, dir: n > previous ? 1 : -1 });
        requestAnimationFrame(() => textEls.forEach(el => { el.style.transition = ''; }));
      }, 150);
    } else {
      root.style.setProperty('--text-dir', String(n > previous ? 1 : -1));
      textEls.forEach(el => { el.classList.remove('is-entering'); el.classList.add('is-leaving'); });
      textTimer = setTimeout(() => {
        writeText(item);
        textEls.forEach(el => { el.classList.remove('is-leaving'); el.classList.add('is-entering'); });
        requestAnimationFrame(() => requestAnimationFrame(() => textEls.forEach(el => el.classList.remove('is-entering'))));
      }, 180);
    }
    clearTimeout(liveTimer);
    liveTimer = setTimeout(() => { live.textContent = `${item.title}, ${n + 1} of ${count}`; }, 350);
    for (let k = n - 3; k <= n + 3; k++) loadArt(k);
    wake();
  }

  // ---------- Moving along the row ----------

  function moveTo(i, source = 'snap', immediate = false) {
    const n = clamp(i, 0, count - 1);
    const distance = Math.abs(n - L);
    const d = S.snapDuration;
    const cfg = source === 'wheel' ? { duration: d + 0.05, ease: EASE.glide, kick: 2.5 }
      : source === 'key' ? { duration: Math.min(0.6, d - 0.04 + distance * 0.05), ease: EASE.glide, kick: 4 }
      : source === 'click' ? { duration: clamp(0.45 + distance * 0.11, d, 1.05), ease: EASE.glide, kick: Math.min(5, distance * 1.4) }
      : source === 'flick' ? { duration: d + 0.1, ease: EASE.glide, kick: 0 }
      : { duration: d, ease: EASE.out3, kick: 0 };
    pending = n;
    target = n;
    dragVel = 0;
    springVel = 0;
    killTweens(moveTween);
    if (!reduced && cfg.kick) { const dir = Math.sign(n - L); if (dir) flow = clamp(flow + dir * cfg.kick, -12, 12); }
    for (let k = n - 2; k <= n + 2; k++) loadArt(k);
    if (reduced || immediate) {
      L = n; lastL = n; flow = 0; target = -1;
      setActive(n);
      wake(3);
      return;
    }
    moveTween.value = L;
    tween(moveTween, { value: n }, { duration: cfg.duration, ease: cfg.ease, onComplete: () => { L = n; target = -1; setActive(n); } });
    wake(3);
  }

  // ---------- Layout of every disc, each frame ----------

  const tmpV = new Vector3();
  const tmpQ = new Quaternion();
  const touchOffset = (m, out) => {
    const h = Math.min(Math.abs(m), 2.5);
    return out.set(m * S.touchGap, -h * S.touchDropY, -h * S.touchDepth);
  };
  // Intro: the front disc rises from below, turning edge-on to face-on, then the rest fan out.
  const introOffset = rise => {
    const t = 1 - clamp(rise, 0, 1);
    tmpV.set(0, -S.introRise * t, -S.introDepth * t);
    if (t === 0) return tmpV;
    tmpQ.copy(gallery.quaternion).invert();
    tmpV.applyQuaternion(tmpQ);
    return tmpV.divideScalar(gallery.scale.x || 1);
  };
  // Back from a story: the disc drops in from above, swings round one small loop and settles.
  const loopOffset = progress => {
    const t = clamp(progress, 0, 1);
    // Straight fall from above the screen, plus a small circle that opens up and closes as it lands.
    const fall = S.loopDrop * (1 - t) ** 3;
    const r = S.loopRadius * 4 * t * (1 - t);
    const a = Math.PI / 2 + Math.PI * 2 * t;
    tmpV.set(Math.cos(a) * r, fall + Math.sin(a) * r - r, S.loopDepth * (1 - t) ** 2);
    if (t === 1) return tmpV.set(0, 0, 0);
    tmpQ.copy(gallery.quaternion).invert();
    tmpV.applyQuaternion(tmpQ);
    return tmpV.divideScalar(gallery.scale.x || 1);
  };

  function layout(dt, snap = false) {
    const front = nearest();
    const moving = !reduced && !intro.playing;
    const lean = moving ? clamp(Math.sign(flow) * Math.sqrt(Math.abs(flow)) * S.flowLean, -S.flowLeanMax, S.flowLeanMax) : 0;
    const dip = moving ? Math.min(S.flowDipMax, Math.abs(flow) * S.flowDip) : 0;
    const follow = down.dragging ? S.followTight : S.followBase;
    const touch = isTouch();
    const activeScale = touch ? Math.max(0.5, S.touchActiveScale) : 1;
    const restScale = touch ? clamp(S.touchInactiveScale, 0.2, 1) : S.inactiveScale;
    const spread = Math.max(T * 3, 0.12, S.depthGap);
    let residual = 0;

    discs.forEach((disc, p) => {
      const m = p - L;
      const h = Math.abs(m);
      const isFront = p === front;
      const arc = m * 0.35;
      let x = Math.sin(arc) * S.hGap * 2.4;
      let y = (isFront ? S.activeDiscY : 0) - dip * (isFront ? 0.7 : 1);
      let z = -Math.cos(arc) * spread * 2.4 + spread * 2.4;
      if (touch) {
        touchOffset(m, tmpV);
        tmpQ.copy(gallery.quaternion).invert();
        tmpV.applyQuaternion(tmpQ);
        x = tmpV.x;
        y += tmpV.y;
        z = tmpV.z;
      }
      let rx = 0;
      let ry = -arc + lean * (isFront ? 1 : 1.12);
      if (touch) ry = clamp(-m, 0, 1) * -2 * MathUtils.degToRad(S.galleryRotY) + lean * (isFront ? 1 : 1.12);
      const rz = -lean * S.flowBank * (isFront ? 0.7 : 1);
      const base = isFront ? activeScale : Math.max(restScale, 1 - h * (1 - restScale) * (touch ? 1 : 0.6));

      let scale;
      let visible = true;
      if (isFront) scale = base * intro.active * exit.press * exit.shrink;
      else {
        const e = clamp(intro.others, 0, 2);
        const stagger = clamp(S.flightStaggerIn, 0, 0.9);
        const maxSteps = Math.max(1, Math.round(S.flightStaggerMax));
        const lag = (Math.min(h, maxSteps) / maxSteps) * stagger;
        const o = clamp((Math.min(1, e) - lag) / Math.max(0.1, 1 - stagger), 0, 1);
        const grown = EASE.glide(o) + Math.max(0, e - 1);
        // Outgoing: the nearest discs shrink first and pop away before they get tiny.
        const out = clamp((exit.others - (Math.min(h, maxSteps) / maxSteps) * S.flightStagger) / Math.max(0.1, 1 - S.flightStagger), 0, 1);
        const kept = out * (2 - out);
        visible = grown > S.flightPopScaleIn && (exit.others >= 1 || kept > S.flightPopScale);
        scale = base * grown * kept;
        const missing = 1 - Math.min(1, grown * kept);
        if (missing > 1e-4) z -= missing * S.flightRecede;
      }
      disc.group.visible = visible && h < 7;

      const wantHover = hovered === p && down.spinning < 0 ? 1 : 0;
      disc.hover += (wantHover - disc.hover) * Math.min(1, dt * 10);
      if (disc.hover > 0.001) {
        rx += disc.hover * S.hoverTiltStrength * pointerY;
        ry += disc.hover * S.hoverTiltStrength * pointerX;
      }

      // Springy nudges from presses and fast passes of the pointer.
      const push = Math.abs(disc.pushX) + Math.abs(disc.pushY) + Math.abs(disc.pushZ) + Math.abs(disc.pushVX) + Math.abs(disc.pushVY)
        + Math.abs(disc.pushVZ) + Math.abs(disc.pushRotX) + Math.abs(disc.pushRotY) + Math.abs(disc.pushRotVX) + Math.abs(disc.pushRotVY);
      if (push > 8e-4 && !intro.playing) {
        const damp = Math.exp(-S.pushDamping * dt);
        const back = Math.min(1, dt * S.pushReturn);
        disc.pushX += disc.pushVX * dt; disc.pushVX *= damp;
        disc.pushY += disc.pushVY * dt; disc.pushVY *= damp;
        disc.pushZ += disc.pushVZ * dt; disc.pushVZ *= damp;
        disc.pushRotX += disc.pushRotVX * dt; disc.pushRotVX *= damp;
        disc.pushRotY += disc.pushRotVY * dt; disc.pushRotVY *= damp;
        disc.pushX -= disc.pushX * back; disc.pushY -= disc.pushY * back; disc.pushZ -= disc.pushZ * back;
        disc.pushRotX -= disc.pushRotX * back; disc.pushRotY -= disc.pushRotY * back;
        x += disc.pushX; y += disc.pushY; z += disc.pushZ;
        residual += push;
      } else if (push > 0) {
        disc.pushX = disc.pushY = disc.pushZ = disc.pushVX = disc.pushVY = disc.pushVZ = 0;
        disc.pushRotX = disc.pushRotY = disc.pushRotVX = disc.pushRotVY = 0;
      }

      if (intro.playing && isFront) { const o = intro.path === 'loop' ? loopOffset(intro.rise) : introOffset(intro.rise); x += o.x; y += o.y; z += o.z; }

      const k = down.dragging ? S.followTight : clamp(follow - h * S.followFalloff, S.followMin, S.followTight);
      const a = snap || reduced || intro.playing ? 1 : Math.min(1, dt * k);
      const g = disc.group;
      if (!disc.placed) {
        g.position.set(x, y, z);
        g.rotation.set(rx, ry, rz);
        g.scale.setScalar(scale);
        disc.placed = true;
      } else {
        g.position.x += (x - g.position.x) * a;
        g.position.y += (y - g.position.y) * a;
        g.position.z += (z - g.position.z) * a;
        g.scale.setScalar(g.scale.x + (scale - g.scale.x) * a);
        g.rotation.x += (rx - g.rotation.x) * a;
        g.rotation.y += (ry - g.rotation.y) * a;
        g.rotation.z += (rz - g.rotation.z) * a;
      }
      if (down.spinning !== p && !disc.resetting) disc.spinX += (0 - disc.spinX) * Math.min(1, dt * 2.5);
      disc.spin.rotation.x = disc.spinX + disc.pushRotX;
      disc.spin.rotation.y = disc.spinY + disc.pushRotY;
      g.renderOrder = Math.round(500 + g.position.z * 10 - p * 0.01);
      residual += Math.abs(x - g.position.x) + Math.abs(y - g.position.y) + Math.abs(z - g.position.z) + Math.abs(scale - g.scale.x)
        + Math.abs(rx - g.rotation.x) + Math.abs(ry - g.rotation.y) + Math.abs(rz - g.rotation.z) + Math.abs(wantHover - disc.hover);
      if (down.spinning !== p && !disc.resetting) residual += Math.abs(disc.spinX);
      if (disc.resetting) residual += 1;
    });
    return residual;
  }

  // ---------- Picking ----------

  const raycaster = new Raycaster();
  const ndc = new Vector2();
  const hitUv = { x: 0, y: 0 };
  function toNdc(e) {
    const r = host.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    ndc.x = (x / r.width) * 2 - 1;
    ndc.y = -(y / r.height) * 2 + 1;
    return { x, y, rect: r };
  }
  function pick() {
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(picks.filter(p => p.parent.visible), false)[0];
    if (!hit) return -1;
    hitUv.x = hit.uv ? hit.uv.x * 2 - 1 : 0;
    hitUv.y = hit.uv ? hit.uv.y * 2 - 1 : 0;
    return hit.object.userData.index;
  }

  const wipe = i => {
    const disc = discs[i];
    if (reduced || !disc || Math.hypot(mouseVX, mouseVY) < S.wipeMinSpeed) return;
    disc.pushVX += clamp(mouseVX * S.wipePush, -S.wipePushMax, S.wipePushMax);
    disc.pushVY -= clamp(mouseVY * S.wipePush, -S.wipePushMax, S.wipePushMax);
    disc.pushRotVY += clamp(mouseVX * S.wipeSpin, -S.wipeSpinMax, S.wipeSpinMax);
    disc.pushRotVX += clamp(mouseVY * S.wipeSpin, -S.wipeSpinMax, S.wipeSpinMax);
    wake();
  };
  const press = i => {
    const disc = discs[i];
    if (reduced || !disc) return;
    disc.pushVZ -= S.pressDepth;
    disc.pushRotVY += hitUv.x * S.pressTilt;
    disc.pushRotVX -= hitUv.y * S.pressTilt;
    wake();
  };
  // Spinning past half a turn gets heavier.
  const softSpin = (angle, delta) => {
    const max = MathUtils.degToRad(S.maxSpinAngle);
    const over = Math.max(0, Math.abs(angle) - max * 0.8) / max;
    const resist = 1 / (1 + over * over * 14);
    return angle + delta * (Math.sign(delta) === Math.sign(angle) || angle === 0 ? resist : 1);
  };
  const resetSpin = i => {
    const disc = discs[i];
    if (!disc || (Math.abs(disc.spinX) < 0.001 && Math.abs(disc.spinY) < 0.001)) return;
    disc.resetting = true;
    tween(disc, { spinX: 0, spinY: 0 }, { duration: reduced ? 0.15 : S.resetDuration, ease: EASE.out3, onComplete: () => { disc.resetting = false; } });
    wake();
  };
  const flip = i => {
    const disc = discs[i];
    if (!disc) return;
    disc.resetting = true;
    tween(disc, { spinY: Math.abs(disc.spinY) > Math.PI / 2 ? 0 : Math.PI, spinX: 0 }, { duration: reduced ? 0.15 : 0.75, ease: EASE.inOut3, onComplete: () => { disc.resetting = false; } });
    wake();
  };
  const open = e => {
    const url = items[active] && items[active].url;
    if (!url || url === '#') return false;
    if (e && (e.metaKey || e.ctrlKey)) { window.open(url, '_blank', 'noopener'); return true; }
    leaveFor(url);
    return true;
  };
  // Like the original's open: press in, spring back, the others shrink away, then the front disc
  // turns edge-on and shrinks to nothing before the story page loads.
  function leaveFor(url) {
    if (leaving) return;
    leaving = true;
    endPointer(true);
    resetWheel();
    killTweens(moveTween);
    L = active;
    target = -1;
    dragVel = 0;
    springVel = 0;
    hovered = -1;
    keyboardFocus = false;
    root.setAttribute('data-disc-leaving', 'true');
    if (reduced) { window.location.href = url; return; }
    const disc = discs[active];
    const turn = Math.ceil((disc.spinY + Math.PI / 2 - Math.PI / 2) / Math.PI - 1e-6);
    const settle = S.exitPressTime + S.exitSpringTime;
    tween(exit, { press: S.exitPress }, { duration: S.exitPressTime, ease: EASE.out2, onComplete: () => {
      tween(exit, { press: S.exitSpring }, { duration: S.exitSpringTime, ease: EASE.out2 });
    } });
    tween(exit, { others: 0 }, { duration: S.exitOthers, ease: EASE.linear, delay: S.exitPressTime });
    tween(exit, { shrink: 0.001 }, { duration: S.exitDuration, ease: EASE.in2, delay: settle });
    disc.resetting = true;
    tween(disc, { spinY: Math.PI / 2 + turn * Math.PI, spinX: 0 }, { duration: S.exitDuration, ease: EASE.in2, delay: settle });
    wake(3);
    setTimeout(() => {
      try { sessionStorage.setItem('cmm-news-handoff', '1'); } catch {}
      window.location.href = url;
    }, (settle + S.exitDuration) * 1000 + 120);
  }
  // Coming back with the browser's back button restores this page as it was left: bring the discs back.
  window.addEventListener('pageshow', e => {
    if (!e.persisted || !leaving) return;
    leaving = false;
    root.removeAttribute('data-disc-leaving');
    killTweens(exit);
    Object.assign(exit, { press: 1, shrink: 1, others: 1 });
    const disc = discs[active];
    if (disc) { killTweens(disc); disc.spinX = 0; disc.spinY = 0; disc.resetting = false; }
    wake(3);
    start();
  });
  const setCursor = () => { if (!down.on) root.style.cursor = hovered >= 0 ? 'pointer' : 'grab'; };

  // ---------- Scroll wheel: one disc per gesture ----------

  let wheelQuiet = false;
  let quietAt = 0;
  const wheel = { armed: true, gated: false, acc: 0, dir: 0, env: 0, peak: 0, events: 0, stepAt: 0, lastAt: 0, hasLast: false, timer: 0 };
  function resetWheel() {
    clearTimeout(wheel.timer);
    Object.assign(wheel, { armed: true, gated: false, acc: 0, dir: 0, env: 0, peak: 0, events: 0, stepAt: 0, lastAt: 0, hasLast: false, timer: 0 });
    pending = currentTarget();
  }
  function onWheel(e) {
    if (e.ctrlKey) return;
    if (wheelQuiet) {
      const now = performance.now();
      const calm = now - quietAt > S.wheelQuietGap;
      quietAt = now;
      if (!calm || intro.playing) { e.preventDefault(); return; }
      wheelQuiet = false;
    }
    if (leaving || intro.playing) { e.preventDefault(); return; }
    let dx = e.deltaX;
    let dy = e.deltaY;
    if (e.deltaMode === 1) { dx *= 16; dy *= 16; } else if (e.deltaMode === 2) { dx *= innerWidth; dy *= innerHeight; }
    const delta = Math.abs(dx) > Math.abs(dy) * 1.25 ? dx : dy;
    const size = Math.abs(delta);
    e.preventDefault();
    e.stopPropagation();
    const now = performance.now();
    const gap = wheel.hasLast ? now - wheel.lastAt : Infinity;
    wheel.lastAt = now;
    wheel.hasLast = true;
    clearTimeout(wheel.timer);
    wheel.timer = setTimeout(resetWheel, S.wheelIdleReset);
    const prevEnv = wheel.env * (gap === Infinity ? 0 : Math.exp(-gap / S.wheelEnvelopeTau));
    if (size < S.wheelNoiseFloor) { wheel.env = prevEnv; return; }
    const rising = size > prevEnv * S.wheelRiseFactor;
    wheel.env = Math.max(size, prevEnv);
    // After a step, wait for a pause, a fresh flick or a long steady push before stepping again.
    if (!wheel.armed) {
      wheel.events += 1;
      wheel.peak = Math.max(wheel.peak, size);
      const since = now - wheel.stepAt;
      const paused = gap >= S.wheelPauseGap;
      const tick = gap >= S.wheelTickGap && wheel.events <= 2 && since >= S.wheelMinStepTick && size >= wheel.peak * S.wheelTickRatio;
      const flick = rising && since >= S.wheelMinStepFlick;
      const sustained = since >= S.wheelSustainDelay && wheel.env >= wheel.peak * S.wheelSustainRatio;
      if (!(paused || tick || flick || sustained)) return;
      wheel.armed = true;
      wheel.acc = 0;
      wheel.dir = 0;
      wheel.gated = !(paused || tick || sustained);
    }
    const dir = delta > 0 ? 1 : -1;
    if (dir !== wheel.dir) { wheel.acc = 0; wheel.dir = dir; }
    wheel.acc += Math.min(wheel.gated ? Math.max(0, size - prevEnv) : size, S.wheelEventCap);
    if (wheel.acc < S.wheelStepThreshold) return;
    Object.assign(wheel, { armed: false, gated: false, acc: 0, stepAt: now, events: 0, peak: size });
    const from = currentTarget();
    const to = clamp(from + dir, 0, count - 1);
    pending = to;
    if (to !== from) moveTo(to, 'wheel');
  }

  // ---------- Pointer ----------

  const noDrag = 'a, button, input, textarea, select, label, [data-disc-no-drag]';
  function onPointerDown(e) {
    if (leaving || e.button !== 0 || !e.isPrimary || (e.target instanceof Element && e.target.closest(noDrag))) return;
    const p = toNdc(e);
    Object.assign(down, { on: true, id: e.pointerId, touch: e.pointerType !== 'mouse', dragging: false, spinning: -1, candidate: -1, startX: p.x, startY: p.y, lastX: p.x, lastY: p.y, lastT: performance.now() });
    const hit = pick();
    if (hit >= 0 && Math.abs(hit - L) < 0.6) down.candidate = hit;
    hovered = hit;
    pointerX = ndc.x;
    pointerY = ndc.y;
    window.addEventListener('pointermove', onDragMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
    wake();
  }
  function startDrag(e) {
    down.dragging = true;
    killTweens(moveTween);
    target = -1;
    resetWheel();
    dragVel = 0;
    springVel = 0;
    down.spinning = down.candidate;
    root.style.cursor = 'grabbing';
    root.setAttribute('data-disc-dragging', 'true');
    const selection = window.getSelection();
    if (selection) selection.removeAllRanges();
    if (down.spinning >= 0) { const d = discs[down.spinning]; killTweens(d); d.resetting = false; }
    try { root.setPointerCapture(e.pointerId); } catch {}
  }
  function onDragMove(e) {
    if (!down.on || e.pointerId !== down.id) return;
    const p = toNdc(e);
    pointerX = ndc.x;
    pointerY = ndc.y;
    if (!down.dragging) {
      const dx = p.x - down.startX;
      const dy = p.y - down.startY;
      if (Math.hypot(dx, dy) < S.dragStartDistance) return;
      if (down.touch && Math.abs(dx) >= Math.abs(dy)) down.candidate = -1; // sideways swipes move the row
      startDrag(e);
    }
    if (e.cancelable) e.preventDefault();
    const now = performance.now();
    const dx = p.x - down.lastX;
    const dy = p.y - down.lastY;
    const elapsed = Math.max(8, now - down.lastT);
    down.lastX = p.x;
    down.lastY = p.y;
    down.lastT = now;
    wake();
    if (down.spinning >= 0) {
      const d = discs[down.spinning];
      const k = S.dragSensitivity * 0.0045;
      d.spinY = softSpin(d.spinY, dx * k);
      d.spinX = softSpin(d.spinX, dy * k);
      return;
    }
    const span = down.touch ? (touchSpan || 1.8) : 6 * S.dragSensitivity;
    const shift = -(dx / p.rect.width) * span;
    L = clamp(L + shift, 0, count - 1);
    const v = clamp((16.667 / elapsed) * shift, -S.dragMaxVelocity, S.dragMaxVelocity);
    dragVel += (v - dragVel) * S.dragVelocitySmoothing;
    pending = Math.round(L);
  }
  function endPointer(cancelled) {
    if (!down.on) return;
    const wasDragging = down.dragging;
    const spun = down.spinning;
    const id = down.id;
    Object.assign(down, { on: false, id: -1, dragging: false, spinning: -1, candidate: -1 });
    window.removeEventListener('pointermove', onDragMove, { passive: false });
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerCancel);
    root.removeAttribute('data-disc-dragging');
    setCursor();
    try { if (root.hasPointerCapture(id)) root.releasePointerCapture(id); } catch {}
    wake();
    if (!wasDragging) return;
    down.suppressUntil = performance.now() + 140;
    if (spun >= 0) { resetSpin(spun); dragVel = 0; return; }
    if (cancelled) { dragVel = 0; moveTo(Math.round(L)); return; }
    if (down.touch) {
      const dir = Math.abs(dragVel) >= S.touchFlickVelocity ? Math.sign(dragVel) : 0;
      const to = dir > 0 ? Math.floor(L) + 1 : dir < 0 ? Math.ceil(L) - 1 : Math.round(L);
      dragVel = 0;
      resetWheel();
      moveTo(to, 'flick', reduced);
      return;
    }
    if (reduced) moveTo(Math.round(L), 'snap', true);
  }
  const onPointerUp = () => endPointer(false);
  const onPointerCancel = () => endPointer(true);

  function onHoverMove(e) {
    keyboardFocus = false;
    if (leaving || down.on || !finePointer) return;
    toNdc(e);
    const now = performance.now();
    const gap = now - lastMoveAt;
    lastMoveAt = now;
    if (gap < 120) { const k = 16.7 / Math.max(8, gap); mouseVX = (e.clientX - lastMouseX) * k; mouseVY = (e.clientY - lastMouseY) * k; }
    else { mouseVX = 0; mouseVY = 0; }
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    pointerX = ndc.x;
    pointerY = ndc.y;
    hoverDirty = true;
    wake();
  }

  function onClick(e) {
    if (leaving || performance.now() < down.suppressUntil) { e.preventDefault(); e.stopPropagation(); return; }
    if (e.target instanceof Element && e.target.closest('a, button, [data-disc-no-open]')) return;
    toNdc(e);
    const hit = pick();
    if (hit < 0) return;
    e.preventDefault();
    if (hit !== active) { resetWheel(); press(hit); moveTo(hit, 'click'); return; }
    open(e);
  }

  function onKey(e) {
    if (leaving || e.defaultPrevented || e.altKey) return;
    const focused = document.activeElement;
    if (focused && (/^(INPUT|TEXTAREA|SELECT)$/.test(focused.tagName) || focused.isContentEditable)) return;
    const inside = root.contains(focused);
    if (!inside && focused && focused !== document.body) return;
    if (!inView || ((e.metaKey || e.ctrlKey) && e.key !== 'Enter')) return;
    if (e.key === 'Enter') { if (focused === root && open(e)) e.preventDefault(); return; }
    if (e.key === ' ' || e.key === 'Spacebar') { if (focused === root) { e.preventDefault(); flip(active); } return; }
    let to = -1;
    if (e.key === 'ArrowRight') to = currentTarget() + 1;
    else if (e.key === 'ArrowLeft') to = currentTarget() - 1;
    else if (e.key === 'Home') to = 0;
    else if (e.key === 'End') to = count - 1;
    else return;
    e.preventDefault();
    resetWheel();
    keyboardFocus = focused === root;
    moveTo(to, 'key');
  }

  // ---------- Sizing ----------

  const projX = (scale, m) => { touchOffset(m, tmpV).multiplyScalar(scale); tmpV.project(camera); return tmpV.x; };
  const peek = scale => Math.max(Math.abs(projX(scale, 1)), Math.abs(projX(scale, -1)));
  // On touch screens the row is scaled so the next disc just peeks in at the edge.
  function fitTouch() {
    camera.updateMatrixWorld();
    if (!isTouch()) { S.galleryScale = baseScale; touchSpan = 0; return; }
    const want = Math.max(0.6, S.touchPeek);
    let lo = baseScale * clamp(S.touchMinScale, 0.1, 1);
    let hi = baseScale * Math.max(1, S.touchMaxScale);
    let scale;
    if (peek(lo) > want) scale = lo;
    else if (peek(hi) < want) scale = hi;
    else {
      for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (peek(mid) > want) hi = mid; else lo = mid; }
      scale = (lo + hi) / 2;
    }
    const lead = clamp(S.touchLeadMaxHeight || 1, 0.2, 1);
    tmpV.set(0, Math.max(0.5, S.touchActiveScale) * scale, 0).project(camera);
    if (tmpV.y > lead) scale *= lead / tmpV.y;
    S.galleryScale = scale;
    const avg = (Math.abs(projX(scale, 1)) + Math.abs(projX(scale, -1))) / 2;
    touchSpan = avg > 0.05 ? clamp(2 / avg, 1, 4) : 0;
  }

  const MAX_PIXELS = 12e6;
  const QUALITY = [1, 0.85, 0.7, 0.55];
  let quality = 0;
  let slowSum = 0;
  let slowFrames = 0;
  let busyFrames = 0;
  const pixelRatio = (w, h) => {
    let r = Math.min(devicePixelRatio || 1, w <= 767 ? 1.5 : 2);
    if (w * h * r * r > MAX_PIXELS) r = Math.sqrt(MAX_PIXELS / (w * h));
    return r * QUALITY[quality];
  };
  function resize() {
    const w = Math.max(1, host.clientWidth);
    const h = Math.max(1, host.clientHeight);
    renderer.setPixelRatio(pixelRatio(w, h));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    fitTouch();
    gallery.scale.setScalar(S.galleryScale);
    wake(3);
  }
  // Drop the render resolution a notch if frames keep running slow.
  function watchSpeed(dt) {
    if (busyFrames < 3 || dt > 0.08 || intro.playing) return;
    slowSum += dt;
    slowFrames += 1;
    if (slowFrames < 30) return;
    const avg = slowSum / slowFrames;
    slowSum = 0;
    slowFrames = 0;
    if (avg > 0.0265 && quality < QUALITY.length - 1) {
      quality = Math.min(QUALITY.length - 1, quality + (avg > 0.045 ? 2 : 1));
      const w = Math.max(1, host.clientWidth);
      const h = Math.max(1, host.clientHeight);
      renderer.setPixelRatio(pixelRatio(w, h));
      renderer.setSize(w, h, false);
    }
  }

  // ---------- Scribble timing (redrawn ten times a second so the line boils) ----------

  let scribblePhase = 'hidden';
  let scribbleFrame = 0;
  let scribbleAt = 0;
  let scribbleOn = -1;
  const scribbleTarget = () => (((hovered >= 0 && hovered === active) || keyboardFocus) && items[active] && items[active].url ? active : -1);
  const travelling = () => down.dragging || dragVel !== 0 || isTweening(moveTween) || Math.abs(L - Math.round(L)) > 0.0015;
  function followDisc(disc, snap, dt) {
    if (snap) {
      scribble.position.copy(disc.group.position);
      scribble.quaternion.copy(disc.group.quaternion);
      scribble.scale.copy(disc.group.scale);
      return;
    }
    const k = 1 - Math.exp(-Math.max(0, S.scribbleLag) * dt);
    scribble.position.lerp(disc.group.position, k);
    scribble.quaternion.slerp(disc.group.quaternion, k);
    scribble.scale.lerp(disc.group.scale, k);
  }
  // Returns 'redraw' when the line changed shape, 'follow' while it is showing, '' when hidden.
  function updateScribble(now, dt) {
    const want = scribbleTarget();
    const interval = 1000 / S.scribbleFps;
    if (want < 0) {
      if (scribblePhase === 'hidden') return '';
      if (scribblePhase !== 'out') { scribblePhase = 'out'; scribbleFrame = 0; scribbleAt = now - interval; }
      const disc = discs[scribbleOn];
      if (disc) followDisc(disc, travelling(), dt);
      if (now - scribbleAt < interval) return 'follow';
      scribbleAt = now;
      if (scribbleFrame >= S.scribbleOut.length || !disc) { scribblePhase = 'hidden'; scribbleOn = -1; scribble.visible = false; return 'redraw'; }
      drawLoops(S.scribbleOut[scribbleFrame++]);
      return 'redraw';
    }
    const disc = discs[want];
    if (scribblePhase === 'hidden' || scribbleOn !== want) {
      scribblePhase = 'in';
      scribbleOn = want;
      scribbleAt = now;
      followDisc(disc, true, dt);
      drawLoops(S.scribbleIn[0]);
      scribbleFrame = 1;
      scribble.visible = true;
      return 'redraw';
    }
    followDisc(disc, travelling(), dt);
    if (reduced || now - scribbleAt < interval) return 'follow';
    scribbleAt = now;
    if (scribblePhase === 'in' && scribbleFrame < S.scribbleIn.length) drawLoops(S.scribbleIn[scribbleFrame++]);
    else { scribblePhase = 'on'; drawLoops(1); }
    return 'redraw';
  }

  // ---------- Frame loop ----------

  let raf = 0;
  function frame(now) {
    raf = 0;
    if (disposed || !inView || document.hidden) return;
    const raw = (now - lastFrame) / 1000;
    const dt = Math.min(0.05, raw);
    lastFrame = now;
    watchSpeed(raw);
    const r = Math.min(3, dt * 60);
    runTweens(now);
    if (isTweening(moveTween)) L = moveTween.value;

    if (hoverDirty) {
      hoverDirty = false;
      const hit = pick();
      if (hit !== hovered) {
        if (hit >= 0 && !down.on && !intro.playing) wipe(hit);
        hovered = hit;
        setCursor();
        wake();
      }
    }

    if (!down.dragging) {
      if (Math.abs(dragVel) > 1e-5) {
        L += dragVel * r;
        dragVel *= reduced ? 0 : S.friction ** r;
        if (Math.abs(dragVel) < 4e-4) dragVel = 0;
      }
      if (dragVel === 0 && !isTweening(moveTween)) {
        const goal = Math.round(L);
        const gap = goal - L;
        if (reduced) { L += gap * Math.min(1, dt * 20); springVel = 0; if (Math.abs(goal - L) < 0.001) L = goal; }
        else if (gap !== 0 || Math.abs(springVel) > 1e-5) {
          springVel += gap * S.snapFreq * S.snapFreq * dt;
          springVel *= Math.exp(-S.snapDamping * dt);
          L += springVel * dt;
          if (Math.abs(goal - L) < 8e-4 && Math.abs(springVel) < 0.004) { L = goal; springVel = 0; }
        }
      }
    }
    L = clamp(L, -0.05, count - 0.95);
    if (reduced || intro.playing) { flow = 0; lastL = L; }
    else {
      const v = clamp((L - lastL) / Math.max(dt, 0.001), -40, 40);
      lastL = L;
      flow += (v - flow) * Math.min(1, dt * (Math.abs(v) > Math.abs(flow) ? 14 : 6));
      if (Math.abs(flow) < 0.01) flow = 0;
    }
    setActive(nearest());
    gallery.scale.setScalar(S.galleryScale);
    const residual = layout(dt);
    const line = updateScribble(now, dt);
    const busy = down.on || dragVel !== 0 || springVel !== 0 || flow !== 0 || tweens.size > 0 || residual > 0.001 || forceFrames > 0;
    if (busy || line === 'redraw') {
      if (forceFrames > 0) forceFrames -= 1;
      busyFrames = busy ? busyFrames + 1 : 0;
      renderer.render(scene, camera);
    } else busyFrames = 0;
    raf = requestAnimationFrame(frame);
  }
  const start = () => { if (!raf && !disposed && inView && !document.hidden) { lastFrame = performance.now(); raf = requestAnimationFrame(frame); } };
  const stop = () => { if (raf) cancelAnimationFrame(raf); raf = 0; };

  // ---------- Wire up ----------

  root.style.cursor = 'grab';
  root.style.touchAction = 'none';
  if (!root.hasAttribute('tabindex')) root.setAttribute('tabindex', '0');
  root.setAttribute('aria-roledescription', 'carousel');
  root.setAttribute('aria-keyshortcuts', 'ArrowLeft ArrowRight Home End Enter Space');
  host.replaceChildren(renderer.domElement);

  root.addEventListener('pointerdown', onPointerDown, { capture: true });
  root.addEventListener('pointermove', onHoverMove, { passive: true });
  root.addEventListener('pointerleave', () => { if (!down.on) { hovered = -1; hoverDirty = false; setCursor(); wake(); } });
  root.addEventListener('click', onClick, { capture: true });
  root.addEventListener('wheel', onWheel, { passive: false, capture: true });
  root.addEventListener('dragstart', e => e.preventDefault());
  root.addEventListener('focus', () => { if (root.matches(':focus-visible')) { keyboardFocus = true; wake(); } });
  root.addEventListener('blur', () => { keyboardFocus = false; wake(); });
  window.addEventListener('keydown', onKey);
  window.addEventListener('blur', () => { endPointer(true); keyboardFocus = false; });
  // Index menu entries jump straight to their disc while the gallery is on screen.
  document.addEventListener('click', e => {
    const link = e.target instanceof Element && e.target.closest('[data-disc-goto]');
    if (!link || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    if (leaving) return;
    resetWheel();
    moveTo(Number(link.dataset.discGoto), 'click');
  });
  if (ui.read) ui.read.addEventListener('click', e => {
    const url = items[active] && items[active].url;
    if (!url || url === '#' || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    leaveFor(url);
  });
  if (ui.prev) ui.prev.addEventListener('click', e => { e.preventDefault(); resetWheel(); moveTo(currentTarget() - 1, 'key'); });
  if (ui.next) ui.next.addEventListener('click', e => { e.preventDefault(); resetWheel(); moveTo(currentTarget() + 1, 'key'); });
  touchLayout.addEventListener('change', resize);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else { resetWheel(); wake(3); start(); } });
  renderer.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); stop(); });
  renderer.domElement.addEventListener('webglcontextrestored', () => { resize(); start(); });
  new ResizeObserver(resize).observe(host);
  new IntersectionObserver(entries => {
    const visible = entries.some(e => e.isIntersecting);
    if (visible === inView) return;
    inView = visible;
    if (inView) { wake(3); start(); } else { stop(); resetWheel(); }
  }, { rootMargin: '200px 0px' }).observe(root);
  window.addEventListener('pagehide', stop);

  // Arriving from the bottom of a story (?story=N&arrive=drop) opens on that story's disc.
  const params = new URLSearchParams(window.location.search);
  const first = clamp(Number.parseInt(params.get('story') || '0', 10) || 0, 0, count - 1);
  const dropped = params.get('arrive') === 'drop';
  if (params.has('story') || params.has('arrive')) {
    params.delete('story');
    params.delete('arrive');
    const query = params.toString();
    history.replaceState(history.state, '', window.location.pathname + (query ? `?${query}` : '') + window.location.hash);
  }
  L = lastL = pending = first;
  if (dropped && !reduced) {
    // Hold the pose before the first frame so nothing can move the row while the disc drops in.
    intro.playing = true;
    intro.path = 'loop';
    intro.rise = 0;
    intro.active = 0.85;
  }
  // The scroll that dropped the reader here may still be coasting: ignore it until it stops.
  wheelQuiet = dropped;

  resize();
  setActive(first);
  await Promise.race([Promise.all([first - 1, first, first + 1, first + 2].map(loadArt)), new Promise(r => setTimeout(r, 900))]);
  layout(1, true);
  try { if (renderer.compileAsync) await renderer.compileAsync(scene, camera); } catch {}
  root.setAttribute('data-disc-ready', 'true');

  if (!reduced && dropped) {
    // The disc falls in from the top, swings round one little loop (turning over once) and settles.
    const lead = discs[first];
    const d = S.loopDuration;
    // When the story page is still lifting away above the gallery, wait for it to clear the top
    // so the disc falls in through open space instead of from behind it.
    const wait = document.documentElement.hasAttribute('data-news-drop') ? 0.5 : 0;
    lead.spinY = -Math.PI * 2;
    tween(intro, { rise: 1 }, { duration: d, ease: EASE.out2, delay: wait });
    tween(lead, { spinY: 0 }, { duration: d, ease: EASE.out3, delay: wait });
    tween(intro, { active: 1 }, { duration: d * 0.8, ease: EASE.glide, delay: wait });
    tween(intro, { others: 1 }, { duration: 0.9, ease: EASE.linear, delay: wait + d * 0.55, onComplete: () => { intro.playing = false; intro.path = 'rise'; } });
  } else if (!reduced) {
    // The front disc rises into place turning from edge-on, then the others fan out behind it.
    const lead = discs[first];
    const d = S.introDuration;
    const turn = { z: S.introSpin };
    intro.playing = true;
    intro.rise = 0;
    lead.spinY = -Math.PI / 2;
    tween(intro, { rise: 1 }, { duration: d * 0.8, ease: EASE.glide });
    tween(lead, { spinY: 0 }, { duration: d * 0.8, ease: EASE.out2 });
    tween(turn, { z: 0 }, { duration: d * 0.8, ease: EASE.out2 });
    const roll = () => { lead.spin.rotation.z = turn.z; if (isTweening(turn)) requestAnimationFrame(roll); else lead.spin.rotation.z = 0; };
    requestAnimationFrame(roll);
    tween(intro, { active: 1 }, { duration: d, ease: EASE.glide });
    tween(intro, { others: 1 }, { duration: d * 0.85, ease: EASE.linear, delay: d * 0.1, onComplete: () => { intro.playing = false; } });
  }
  const arrival = document.documentElement;
  revealText({ full: true, delay: dropped ? 0.6 : arrival.hasAttribute('data-page-arrived') ? 0.5 : 0.1 });
  wake(3);
  start();
}

function init() {
  initIndexMenu();
  document.querySelectorAll('[data-disc-gallery]').forEach(root => {
    if (root.dataset.discGalleryInit === 'true') return;
    root.dataset.discGalleryInit = 'true';
    createGallery(root).catch(err => {
      // No WebGL (or it failed): the story list shows as a flat disc instead.
      console.warn('Disc gallery is showing the flat fallback:', err && err.message ? err.message : err);
      root.classList.add('is-static');
    });
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
