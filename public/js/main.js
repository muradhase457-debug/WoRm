import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { disposeTree } from './common.js';
import * as tropical from './worlds/tropical.js';
import * as ice from './worlds/ice.js';

const WORLDS = { tropical, ice };
const $ = (s) => document.querySelector(s);
const canvas = $('#c');
const isMobile = matchMedia('(pointer: coarse)').matches || innerWidth < 700;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.5, 800);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.07;
controls.minDistance = 7; controls.maxDistance = 70;
controls.maxPolarAngle = Math.PI * 0.47; controls.minPolarAngle = 0.15;
controls.autoRotateSpeed = 0.55;

// ---------- quality ----------
const QUALITY = {
  standard: { dpr: () => Math.min(devicePixelRatio, 1.5), shadow: 2048, label: 'Standard' },
  high: { dpr: () => Math.min(devicePixelRatio, 2), shadow: 4096, label: 'High' },
  ultra: { dpr: () => clamp(Math.max(devicePixelRatio, 3840 / innerWidth), 1, 3), shadow: 4096, label: 'Ultra 4K' },
};
function clamp(x, a, b) { return Math.min(b, Math.max(a, x)); }
let quality = new URLSearchParams(location.search).get('q') || (isMobile ? 'standard' : 'high');
if (!QUALITY[quality]) quality = 'high';

let world = null, current = null, frame = 0;

function applyQuality() {
  const q = QUALITY[quality];
  renderer.setPixelRatio(q.dpr());
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  if (world && world.sun) {
    world.sun.shadow.mapSize.set(q.shadow, q.shadow);
    if (world.sun.shadow.map) { world.sun.shadow.map.dispose(); world.sun.shadow.map = null; }
  }
  renderer.shadowMap.needsUpdate = true;
  $('#res').textContent = `${renderer.domElement.width} × ${renderer.domElement.height}px`;
  document.querySelectorAll('#quality button').forEach((b) => b.classList.toggle('on', b.dataset.q === quality));
}

// ---------- world loading ----------
function frameCamera(w, instant) {
  const c = w.camera;
  camera.fov = c.fov; camera.updateProjectionMatrix();
  controls.target.set(...c.target);
  // landscape framing: pull back a little on tall/narrow screens so the whole island stays in view
  const k = camera.aspect < 1.7 ? Math.pow(1.7 / camera.aspect, 0.8) : 1;
  const pos = new THREE.Vector3(...c.pos).sub(controls.target).multiplyScalar(k).add(controls.target);
  w._home = pos.clone();
  controls.maxDistance = Math.max(70, pos.distanceTo(controls.target) * 1.5);
  if (instant) { camera.position.copy(pos); controls.update(); }
}
let intro = null;

async function load(id, first = false) {
  const loader = $('#loader');
  loader.classList.add('show');
  await new Promise((r) => setTimeout(r, first ? 30 : 280));
  if (world) { scene.remove(world.group); disposeTree(world.group); world = null; }
  const w = WORLDS[id].build();
  world = w; current = id;
  scene.add(w.group);
  scene.background = new THREE.Color(w.background);
  scene.fog = new THREE.Fog(w.fog.color, w.fog.near, w.fog.far);
  renderer.toneMappingExposure = w.exposure || 1;
  frameCamera(w, false);
  applyQuality();
  // intro fly-in
  const home = w._home, far = home.clone().sub(controls.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), -0.9).multiplyScalar(1.35).add(controls.target);
  far.y = home.y + 8;
  intro = { t0: performance.now(), from: far, to: home.clone(), dur: first ? 2600 : 2000 };
  camera.position.copy(far); controls.update();
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.w === id));
  document.title = `World Builder — ${WORLDS[id].meta.name}`;
  history.replaceState(null, '', '#' + id);
  loader.classList.remove('show');
  window.__ready = id;
}

// ---------- loop ----------
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const t = clock.getElapsedTime();
  if (intro) {
    const k = clamp((performance.now() - intro.t0) / intro.dur, 0, 1), e = 1 - Math.pow(1 - k, 3);
    camera.position.lerpVectors(intro.from, intro.to, e);
    if (k >= 1) intro = null;
  }
  controls.update();
  if (world) {
    world.update(t);
    frame++;
    if (frame % 3 === 0) renderer.shadowMap.needsUpdate = true;
    renderer.render(scene, camera);
  }
});

addEventListener('resize', applyQuality);
controls.addEventListener('start', () => { intro = null; });

// ---------- UI ----------
document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => { if (b.dataset.w !== current) load(b.dataset.w); }));
document.querySelectorAll('#quality button').forEach((b) => b.addEventListener('click', () => { quality = b.dataset.q; applyQuality(); }));
$('#rotate').addEventListener('click', (e) => { controls.autoRotate = !controls.autoRotate; e.currentTarget.classList.toggle('on', controls.autoRotate); });
$('#reset').addEventListener('click', () => { if (!world) return; intro = { t0: performance.now(), from: camera.position.clone(), to: world._home.clone(), dur: 900 }; controls.target.set(...world.camera.target); });
$('#full').addEventListener('click', () => { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.(); });
$('#shot').addEventListener('click', () => save4k());

// Render one frame at 3840px on the long side and download it as PNG.
function save4k() {
  if (!world) return;
  const btn = $('#shot'); btn.disabled = true; const old = btn.textContent; btn.textContent = 'Rendering…';
  setTimeout(() => {
    const aspect = innerWidth / innerHeight;
    const W = aspect >= 1 ? 3840 : Math.round(3840 * aspect), H = aspect >= 1 ? Math.round(3840 / aspect) : 3840;
    const prevDpr = renderer.getPixelRatio();
    renderer.setPixelRatio(1); renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.updateProjectionMatrix();
    renderer.shadowMap.needsUpdate = true;
    renderer.render(scene, camera);
    canvas.toBlob((blob) => {
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `world-builder-${current}-4k.png`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      renderer.setPixelRatio(prevDpr); renderer.setSize(innerWidth, innerHeight);
      camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
      btn.disabled = false; btn.textContent = old;
    }, 'image/png');
  }, 60);
}
window.__save4k = save4k;

const start = (location.hash || '').replace('#', '');
load(WORLDS[start] ? start : 'tropical', true);
