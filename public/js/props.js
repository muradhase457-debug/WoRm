// Reusable stylised props: rocks, palms, huts, fire, chests, pines, igloo, crystals ...
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { C, M, toon, part, vnoise, sstep, clamp, lerp } from './common.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------- rocks ----------
export function rockGeo(seed, o = {}) {
  const {
    size = 1, sx = 1, sy = 0.78, sz = 1, rough = 0.24, detail = 3,
    base = ['#9c9aab', '#8b8199'], cap = '#6fae3a', capBias = 0.7, capSoft = 0.05, capNoise = 0.55, flatBottom = -0.55,
  } = o;
  let g = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('uv'); g.deleteAttribute('normal');
  g = mergeVertices(g, 1e-4);
  const p = g.attributes.position, s = seed * 7.31;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = vnoise(x * 1.8 + z * 1.1 + s, y * 1.9 - x * 0.7 + s * 1.3);
    const n2 = vnoise(x * 4.1 + s * 2, z * 4.1 - y * 3.3);
    const d = 1 + rough * ((n - 0.5) * 2 + (n2 - 0.5) * 0.5);
    x *= d; y *= d; z *= d; y = Math.max(y, flatBottom);
    p.setXYZ(i, x * sx * size, y * sy * size, z * sz * size);
  }
  g.computeVertexNormals();
  const col = new Float32Array(p.count * 3), nrm = g.attributes.normal;
  const b0 = C(base[0]), b1 = C(base[1]), cc = C(cap), t = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), ny = nrm.getY(i);
    const nn = vnoise(x * 1.5 + s, z * 1.5 + y);
    const m = sstep(capBias - capSoft, capBias + capSoft, ny + (nn - 0.5) * capNoise);
    t.copy(b0).lerp(b1, vnoise(x * 1.2 + s * 3, z * 1.2 + y * 0.9));
    t.multiplyScalar(0.78 + 0.22 * sstep(-0.5 * sy * size, 0.5 * sy * size, y));
    t.lerp(cc, m);
    col[i * 3] = t.r; col[i * 3 + 1] = t.g; col[i * 3 + 2] = t.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
export function rock(seed, o = {}, outline = 0.045) {
  return part(rockGeo(seed, o), toon({ vertexColors: true }), { outline });
}

// ---------- palm ----------
export function leafGeo({ L = 2.4, W = 0.42, seg = 12, droop = 1.45, rise = 0.55, col0 = '#2c7f2a', col1 = '#7bd64c' } = {}) {
  const pos = [], colr = [], idx = [];
  const c0 = C(col0), c1 = C(col1), t = new THREE.Color();
  for (let i = 0; i <= seg; i++) {
    const s = i / seg, x = s * L, y = L * (rise * s - 0.55 * droop * s * s);
    const w = W * Math.sin(Math.PI * Math.pow(s, 0.75)) * (i % 2 ? 0.58 : 1);
    pos.push(x, y - w * 0.32, w, x, y + 0.02, 0, x, y - w * 0.32, -w);
    t.copy(c0).lerp(c1, s);
    colr.push(t.r * 0.9, t.g * 0.9, t.b * 0.9, t.r, t.g, t.b, t.r * 0.9, t.g * 0.9, t.b * 0.9);
  }
  for (let i = 0; i < seg; i++) {
    const a = i * 3, b = (i + 1) * 3;
    idx.push(a, a + 1, b, a + 1, b + 1, b);
    idx.push(a + 1, a + 2, b + 1, a + 2, b + 2, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
const leafMat = () => toon({ vertexColors: true, side: THREE.DoubleSide });

export function palm(rand, { height = 5, lean = 1.2, dir = 0, leaves = 9, leafLen = 2.5, trunk = ['#8a5a34', '#74492a'], l0 = '#2c7f2a', l1 = '#7bd64c' } = {}) {
  const g = new THREE.Group();
  const lx = Math.cos(dir) * lean, lz = Math.sin(dir) * lean;
  const curve = new THREE.CatmullRomCurve3([V(0, -0.4, 0), V(lx * 0.12, height * 0.35, lz * 0.12), V(lx * 0.5, height * 0.72, lz * 0.5), V(lx, height, lz)]);
  const tg = new THREE.TubeGeometry(curve, 20, 0.23, 8, false);
  const tp = tg.attributes.position, tc = new Float32Array(tp.count * 3), stride = 9;
  const ca = C(trunk[0]), cb = C(trunk[1]);
  for (let i = 0; i <= 20; i++) {
    const cen = curve.getPointAt(i / 20), k = 1 - 0.42 * (i / 20);
    for (let j = 0; j < stride; j++) {
      const id = i * stride + j;
      tp.setXYZ(id, cen.x + (tp.getX(id) - cen.x) * k, cen.y + (tp.getY(id) - cen.y) * k, cen.z + (tp.getZ(id) - cen.z) * k);
      const c = i % 2 ? ca : cb; tc[id * 3] = c.r; tc[id * 3 + 1] = c.g; tc[id * 3 + 2] = c.b;
    }
  }
  tg.setAttribute('color', new THREE.BufferAttribute(tc, 3));
  tg.computeVertexNormals();
  g.add(part(tg, toon({ vertexColors: true }), { outline: 0.045 }));

  const top = curve.getPoint(1);
  const crown = new THREE.Group(); crown.position.copy(top); g.add(crown);
  const fronds = [];
  const mat = leafMat();
  for (let k = 0; k < leaves; k++) {
    const piv = new THREE.Group();
    const a = (k / leaves) * Math.PI * 2 + (rand() - 0.5) * 0.4;
    const L = leafLen * (0.85 + rand() * 0.3);
    const lm = new THREE.Mesh(leafGeo({ L, W: 0.44, droop: 1.35 + rand() * 0.5, rise: 0.55 + rand() * 0.15, col0: l0, col1: l1 }), mat);
    lm.castShadow = true; lm.receiveShadow = true;
    piv.add(lm); piv.rotation.y = a; piv.rotation.z = (rand() - 0.5) * 0.18;
    crown.add(piv); fronds.push({ piv, base: piv.rotation.z, ph: rand() * 6.28 });
  }
  for (let k = 0; k < 3; k++) { // young upright leaves
    const piv = new THREE.Group();
    const lm = new THREE.Mesh(leafGeo({ L: 1.5, W: 0.3, droop: 1.0, rise: 1.15, col0: l0, col1: l1 }), mat);
    lm.castShadow = true; piv.add(lm); piv.rotation.y = (k / 3) * Math.PI * 2 + 0.7; crown.add(piv);
    fronds.push({ piv, base: 0, ph: rand() * 6.28 });
  }
  for (let k = 0; k < 3; k++) {
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), M('#6b4423'));
    c.position.set(Math.cos(k * 2.1) * 0.22, -0.2, Math.sin(k * 2.1) * 0.22); c.castShadow = true; crown.add(c);
  }
  g.userData.fronds = fronds;
  return g;
}

export function fern(rand, { n = 7, L = 1.0, l0 = '#1f6b2c', l1 = '#5fc43c' } = {}) {
  const g = new THREE.Group(); const mat = leafMat();
  for (let k = 0; k < n; k++) {
    const piv = new THREE.Group();
    const lm = new THREE.Mesh(leafGeo({ L: L * (0.8 + rand() * 0.4), W: 0.2, seg: 8, droop: 1.3, rise: 1.0, col0: l0, col1: l1 }), mat);
    lm.castShadow = true; piv.add(lm); piv.rotation.y = (k / n) * Math.PI * 2 + rand() * 0.4; piv.rotation.z = (rand() - 0.5) * 0.3;
    g.add(piv);
  }
  return g;
}

// ---------- fire ----------
let _glow = null;
function glowTex() {
  if (_glow) return _glow;
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const x = cv.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,190,90,.95)'); g.addColorStop(0.35, 'rgba(255,140,50,.35)'); g.addColorStop(1, 'rgba(255,120,30,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  _glow = new THREE.CanvasTexture(cv); _glow.colorSpace = THREE.SRGBColorSpace; _glow.userData.own = true; return _glow;
}
const FLAME_PROFILE = [[0.001, 0], [0.2, 0.04], [0.29, 0.22], [0.25, 0.5], [0.15, 0.78], [0.05, 1.02], [0.001, 1.15]].map(([r, y]) => new THREE.Vector2(r, y));
export function flame(scale = 1, { light = 0xffa24a, intensity = 7, dist = 9 } = {}) {
  const g = new THREE.Group();
  const o = new THREE.Mesh(new THREE.LatheGeometry(FLAME_PROFILE, 9), new THREE.MeshBasicMaterial({ color: 0xff7a1c, toneMapped: false }));
  const i = new THREE.Mesh(new THREE.LatheGeometry(FLAME_PROFILE, 9), new THREE.MeshBasicMaterial({ color: 0xffe16a, toneMapped: false }));
  i.scale.set(0.58, 0.68, 0.58); i.position.y = 0.02;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 }));
  sp.scale.set(2.4, 2.4, 1); sp.position.y = 0.55;
  const l = new THREE.PointLight(light, intensity, dist, 1.8); l.position.y = 0.6;
  g.add(sp, o, i, l); g.scale.setScalar(scale);
  g.userData.flame = { s: scale, light: l, base: intensity, ph: Math.random() * 10, outer: o, inner: i };
  return g;
}
export function updateFlame(f, t) {
  const u = f.userData.flame;
  const k = 1 + 0.12 * Math.sin(t * 13 + u.ph) + 0.07 * Math.sin(t * 23 + u.ph * 2);
  f.scale.set(u.s * (1 - (k - 1) * 0.5), u.s * k, u.s * (1 - (k - 1) * 0.5));
  u.light.intensity = u.base * (0.85 + (k - 1) * 2.2);
  u.outer.rotation.y = t * 2; u.inner.rotation.y = -t * 3;
}

export function campfire({ stones = ['#9b9aa6', '#7e7a88'], logCol = '#8a4f2a', snow = false } = {}) {
  const g = new THREE.Group();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const r = rock(i + 3, { size: 0.2, sy: 0.8, detail: 1, base: stones, cap: snow ? '#f6f3ff' : '#7a7a86', capBias: snow ? 0.2 : 2 }, 0.025);
    r.position.set(Math.cos(a) * 0.62, 0.08, Math.sin(a) * 0.62); g.add(r);
  }
  for (let i = 0; i < 4; i++) {
    const lg = part(new THREE.CylinderGeometry(0.07, 0.08, 1.0, 7), M(logCol), { outline: 0.02 });
    lg.rotation.z = Math.PI / 2 - 0.55; lg.rotation.y = (i / 4) * Math.PI * 2 + 0.4;
    lg.position.y = 0.2; lg.position.x = Math.cos((i / 4) * 6.28 + 0.4) * -0.15; lg.position.z = Math.sin((i / 4) * 6.28 + 0.4) * 0.15;
    g.add(lg);
  }
  const f = flame(1.05); f.position.y = 0.1; g.add(f); g.userData.flames = [f];
  return g;
}

export function torch({ wood = '#8a4f2a', dark = '#5e3418' } = {}) {
  const g = new THREE.Group();
  const pole = part(new THREE.BoxGeometry(0.22, 2.7, 0.22), M(wood), { outline: 0.03 }); pole.position.y = 1.35; g.add(pole);
  const cage = part(new THREE.BoxGeometry(0.5, 0.5, 0.5), M(dark), { outline: 0.03 }); cage.position.y = 2.85; g.add(cage);
  const rim = part(new THREE.BoxGeometry(0.62, 0.1, 0.62), M(wood), { outline: 0.025 }); rim.position.y = 3.14; g.add(rim);
  const f = flame(1.0, { intensity: 6 }); f.position.y = 3.15; g.add(f); g.userData.flames = [f];
  return g;
}

// ---------- tropical hut ----------
export function hut() {
  const g = new THREE.Group();
  const R = 1.3;
  let wg = new THREE.CylinderGeometry(R * 0.92, R, 1.55, 16, 1, false).toNonIndexed();
  wg.computeVertexNormals();
  const wp = wg.attributes.position, wc = new Float32Array(wp.count * 3), a = C('#b9824a'), b = C('#97652f'), t = new THREE.Color();
  for (let f = 0; f < wp.count / 3; f++) {
    const cx = (wp.getX(f * 3) + wp.getX(f * 3 + 1) + wp.getX(f * 3 + 2)) / 3, cz = (wp.getZ(f * 3) + wp.getZ(f * 3 + 1) + wp.getZ(f * 3 + 2)) / 3;
    const col = Math.floor(((Math.atan2(cz, cx) + Math.PI) / (Math.PI * 2)) * 16) % 2 ? a : b;
    for (let k = 0; k < 3; k++) { wc[(f * 3 + k) * 3] = col.r; wc[(f * 3 + k) * 3 + 1] = col.g; wc[(f * 3 + k) * 3 + 2] = col.b; }
  }
  wg.setAttribute('color', new THREE.BufferAttribute(wc, 3));
  const walls = part(wg, toon({ vertexColors: true }), { outline: 0.04 }); walls.position.y = 0.78; g.add(walls);
  const door = part(new THREE.BoxGeometry(0.85, 1.12, 0.2), M('#24170f'), { outline: 0.02 }); door.position.set(0, 0.62, R * 0.93); g.add(door);
  const lintel = part(new THREE.BoxGeometry(1.1, 0.14, 0.26), M('#7a4a26'), { outline: 0.02 }); lintel.position.set(0, 1.22, R * 0.95); g.add(lintel);
  for (const sx of [-0.52, 0.52]) { const post = part(new THREE.BoxGeometry(0.14, 1.25, 0.26), M('#7a4a26'), { outline: 0.02 }); post.position.set(sx, 0.64, R * 0.95); g.add(post); }
  // roof
  const straw = ['#ecc962', '#d9a947'];
  let y = 1.5;
  for (let k = 0; k < 4; k++) {
    const rb = 2.1 - k * 0.42, rt = rb - 0.4, h = 0.62;
    const tg = new THREE.CylinderGeometry(rt, rb, h, 16, 1, true);
    const tp = tg.attributes.position;
    for (let x = 0; x <= 16; x++) { const id = 17 + x; if (x % 2) tp.setY(id, tp.getY(id) - 0.16); }
    tg.computeVertexNormals();
    const tier = part(tg, toon({ color: straw[k % 2], side: THREE.DoubleSide }), { outline: 0.035 });
    tier.position.y = y + h / 2; g.add(tier); y += h * 0.78;
  }
  const cone = part(new THREE.ConeGeometry(0.75, 0.7, 14), toon({ color: straw[0] }), { outline: 0.035 }); cone.position.y = y + 0.28; g.add(cone);
  const knob = part(new THREE.CylinderGeometry(0.17, 0.2, 0.5, 8), M('#b9824a'), { outline: 0.03 }); knob.position.y = y + 0.82; g.add(knob);
  const kcap = part(new THREE.BoxGeometry(0.46, 0.14, 0.46), M('#8d5b2c'), { outline: 0.025 }); kcap.position.y = y + 1.1; g.add(kcap);
  return g;
}

// ---------- stumps / chest / flowers ----------
function ringTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const x = cv.getContext('2d'); x.fillStyle = '#e0ad6c'; x.fillRect(0, 0, 128, 128);
  x.strokeStyle = '#b5773a'; x.lineWidth = 4;
  for (let r = 10; r < 64; r += 12) { x.beginPath(); x.arc(64, 64, r, 0, 7); x.stroke(); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.userData.own = true; return t;
}
let _ring = null;
export function stump() {
  _ring = _ring || ringTexture();
  const side = M('#8a5a34'), topM = toon({ map: _ring });
  return part(new THREE.CylinderGeometry(0.46, 0.55, 0.5, 12), [side, topM, side], { outline: 0.03 });
}

export function chest({ body = '#8a5a2e', band = '#5d6372', snow = false } = {}) {
  const g = new THREE.Group();
  const b = part(new THREE.BoxGeometry(1.5, 0.72, 0.98), M(body), { outline: 0.035 }); b.position.y = 0.36; g.add(b);
  const lg = new THREE.CylinderGeometry(0.49, 0.49, 1.5, 14, 1, false, 0, Math.PI); lg.rotateZ(Math.PI / 2);
  const lid = part(lg, M(body), { outline: 0.035 }); lid.position.y = 0.72; g.add(lid);
  for (const x of [-0.5, 0.5]) {
    const bg = new THREE.CylinderGeometry(0.51, 0.51, 0.12, 14, 1, false, 0, Math.PI); bg.rotateZ(Math.PI / 2);
    const bd = part(bg, M(band), { outline: 0.02 }); bd.position.set(x, 0.72, 0); g.add(bd);
    const bb = part(new THREE.BoxGeometry(0.13, 0.74, 1.0), M(band), { outline: 0.02 }); bb.position.set(x, 0.36, 0); g.add(bb);
  }
  const lock = part(new THREE.BoxGeometry(0.2, 0.26, 0.1), M('#e6b93c'), { outline: 0.02 }); lock.position.set(0, 0.62, 0.52); g.add(lock);
  if (snow) {
    const s = part(new THREE.CylinderGeometry(0.45, 0.5, 1.3, 14, 1, false, 0.2, Math.PI - 0.4).rotateZ(Math.PI / 2), M('#f7f5ff'), { outline: 0.02 });
    s.position.y = 0.78; s.scale.set(1, 1.08, 1.0); g.add(s);
  }
  return g;
}

export function flower(color = '#ff7ac8', center = '#ffd34a', petals = 5) {
  const g = new THREE.Group();
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2;
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.09, 7, 5), M(color)); p.scale.set(1, 0.45, 1);
    p.position.set(Math.cos(a) * 0.11, 0.18, Math.sin(a) * 0.11); g.add(p);
  }
  const c = new THREE.Mesh(new THREE.SphereGeometry(0.06, 7, 5), M(center)); c.position.y = 0.2; g.add(c);
  const st = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.2, 5), M('#3d9a3a')); st.position.y = 0.1; g.add(st);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// ---------- ice world props ----------
export function pine(rand, { scale = 1, green = '#1f6b44', snow = '#f7f5ff', line = '#2b2f5a' } = {}) {
  const g = new THREE.Group();
  const trunk = part(new THREE.CylinderGeometry(0.2, 0.3, 0.9, 7), M('#6b4423'), { outline: 0.03 }); trunk.position.y = 0.3; g.add(trunk);
  for (let t = 0; t < 4; t++) {
    const r = 1.75 * (1 - t * 0.2), y = 0.55 + t * 0.95, h = 1.55;
    const cg = new THREE.ConeGeometry(r, h, 9);
    const c = part(cg, M(green), { outline: 0.04, outlineColor: line }); c.position.y = y + h / 2; g.add(c);
    const sg = new THREE.ConeGeometry(r * 0.97, h * 0.82, 9, 1, true);
    const sp = sg.attributes.position;
    for (let x = 0; x <= 9; x++) { const id = 10 + x; if (x % 2) sp.setY(id, sp.getY(id) + 0.24); }
    sg.computeVertexNormals();
    const s = part(sg, toon({ color: snow, side: THREE.DoubleSide }), { outline: 0.035, outlineColor: line });
    s.position.y = y + h - h * 0.41 + 0.06; g.add(s);
  }
  g.scale.setScalar(scale); g.rotation.y = rand() * 6.28;
  return g;
}

function brickTexture(bg = '#f1f4fc', line = '#aebbd8') {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256;
  const x = cv.getContext('2d'); x.fillStyle = bg; x.fillRect(0, 0, 512, 256);
  x.strokeStyle = line; x.lineWidth = 3;
  const rows = 8, cols = 14, rh = 256 / rows, cw = 512 / cols;
  for (let r = 0; r <= rows; r++) { x.beginPath(); x.moveTo(0, r * rh); x.lineTo(512, r * rh); x.stroke(); }
  for (let r = 0; r < rows; r++) for (let c = 0; c <= cols; c++) {
    const xx = (c + (r % 2) * 0.5) * cw; x.beginPath(); x.moveTo(xx, r * rh); x.lineTo(xx, (r + 1) * rh); x.stroke();
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.userData.own = true; return t;
}
export function igloo() {
  const g = new THREE.Group(); const tex = brickTexture();
  const mat = toon({ map: tex });
  const dome = part(new THREE.SphereGeometry(2.25, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), mat, { outline: 0.045, outlineColor: '#5a6a9a' }); g.add(dome);
  const tg = new THREE.CylinderGeometry(0.95, 0.95, 1.7, 16, 1, false, 0, Math.PI); tg.rotateZ(Math.PI / 2); tg.rotateY(Math.PI / 2);
  const tmat = toon({ map: tex.clone() }); tmat.map.userData.own = true; tmat.map.needsUpdate = true; tmat.map.repeat.set(2, 1);
  const tun = part(tg, tmat, { outline: 0.04, outlineColor: '#5a6a9a' }); tun.position.set(0, 0, 2.25); g.add(tun);
  const door = new THREE.Mesh(new THREE.CircleGeometry(0.66, 20, 0, Math.PI), new THREE.MeshBasicMaterial({ color: 0xffa443 }));
  door.position.set(0, 0.02, 3.1); g.add(door);
  const glow = new THREE.PointLight(0xffa04a, 9, 7, 1.6); glow.position.set(0, 0.7, 3.4); g.add(glow);
  g.userData.glow = glow;
  return g;
}

export function crystal(scale = 1, tilt = [0, 0], o = {}) {
  const g = new THREE.Group();
  const mat = toon({ color: o.color || '#8fdcf5', transparent: true, opacity: 0.84, emissive: '#1a86b4', emissiveIntensity: 0.45 });
  const r = 0.55;
  const body = part(new THREE.CylinderGeometry(r, r * 1.08, 3.0, 6), mat, { outline: 0.04, outlineColor: '#2b6f9c' }); body.position.y = 1.5;
  const tip = part(new THREE.CylinderGeometry(0.02, r, 1.2, 6), mat, { outline: 0.04, outlineColor: '#2b6f9c' }); tip.position.y = 3.6;
  g.add(body, tip); g.scale.setScalar(scale); g.rotation.set(tilt[0], 0, tilt[1]);
  return g;
}

export function iceArch() {
  const g = new THREE.Group();
  const tg = new THREE.TorusGeometry(2.7, 0.5, 8, 16, Math.PI);
  const p = tg.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = 1 + (vnoise(x * 1.6 + 5, y * 1.6 + z * 2) - 0.5) * 0.16;
    p.setXYZ(i, x * n, y * n, z * n * 1.1);
  }
  tg.deleteAttribute('uv'); tg.deleteAttribute('normal');
  const geo = mergeVertices(tg, 1e-4); geo.computeVertexNormals();
  const mat = toon({ color: '#92dcf0', transparent: true, opacity: 0.9, emissive: '#2399c4', emissiveIntensity: 0.35 });
  const arch = part(geo, mat, { outline: 0.045, outlineColor: '#2b6f9c' }); arch.position.y = 0.2; g.add(arch);
  for (const sx of [-2.7, 2.7]) {
    const foot = part(new THREE.IcosahedronGeometry(0.8, 1), mat, { outline: 0.04, outlineColor: '#2b6f9c' }); foot.position.set(sx, 0.35, 0); foot.scale.set(1, 0.9, 1); g.add(foot);
  }
  for (let i = 0; i < 7; i++) {
    const a = 0.35 + (i / 6) * (Math.PI - 0.7);
    const ic = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.35 + (i % 3) * 0.2, 5), toon({ color: '#c9f1ff' }));
    ic.rotation.x = Math.PI; ic.position.set(Math.cos(a) * 2.7, 0.2 + Math.sin(a) * 2.7 - 0.62, 0.15); g.add(ic);
  }
  return g;
}

export function floe(r = 1.4, rot = 0) {
  const g = new THREE.Group();
  const base = part(new THREE.CylinderGeometry(r, r * 1.06, 0.34, 6), M('#c5e6f6'), { outline: 0.035, outlineColor: '#3b7fae' });
  const top = part(new THREE.CylinderGeometry(r * 0.9, r * 0.94, 0.16, 6), M('#fbfaff'), { outline: 0.025, outlineColor: '#7d86c0' });
  top.position.y = 0.24; g.add(base, top); g.rotation.y = rot; return g;
}

export function totem() {
  const g = new THREE.Group(); const L = '#2b2233';
  const seg = (y, h, r, col) => { const s = part(new THREE.CylinderGeometry(r, r * 1.04, h, 12), M(col), { outline: 0.035 }); s.position.y = y; g.add(s); return s; };
  const face = (y, r, eye = '#ffffff') => {
    for (const sx of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.17, 0.05), M(eye)); e.position.set(sx * 0.24, y + 0.12, r + 0.02);
      const pu = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.06), M('#1a1420')); pu.position.set(sx * 0.24, y + 0.12, r + 0.04);
      const br = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.07, 0.06), M('#3a2312')); br.position.set(sx * 0.24, y + 0.3, r + 0.03); br.rotation.z = -sx * 0.25;
      g.add(e, pu, br);
    }
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.06), M('#3a1c14')); m.position.set(0, y - 0.22, r + 0.03); g.add(m);
    const n = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.2, 0.12), M('#a8672f')); n.position.set(0, y - 0.02, r + 0.05); g.add(n);
  };
  seg(0.7, 1.4, 0.62, '#8d5a30'); face(0.8, 0.62);
  seg(1.9, 1.1, 0.58, '#c97b3c'); face(1.95, 0.58);
  seg(2.85, 0.9, 0.52, '#8d5a30');
  const head = part(new THREE.SphereGeometry(0.46, 12, 10), M('#8d5a30'), { outline: 0.035 }); head.position.y = 3.55; g.add(head);
  const beak = part(new THREE.ConeGeometry(0.2, 0.5, 6), M('#e89a2a'), { outline: 0.025 }); beak.rotation.x = Math.PI / 2; beak.position.set(0, 3.5, 0.55); g.add(beak);
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), M('#ffffff')); eye.position.set(sx * 0.2, 3.65, 0.38); g.add(eye);
    const pu = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), M('#111')); pu.position.set(sx * 0.2, 3.65, 0.45); g.add(pu);
    for (let k = 0; k < 3; k++) {
      const w = part(new THREE.BoxGeometry(0.95 - k * 0.12, 0.14, 0.42), M(k % 2 ? '#c97b3c' : '#6f4423'), { outline: 0.025 });
      w.position.set(sx * (0.9 + k * 0.02), 3.15 + k * 0.18, 0); w.rotation.z = sx * (-0.45 + k * 0.1); g.add(w);
    }
  }
  const f = flame(1.0, { intensity: 6 }); f.position.y = 3.95; g.add(f); g.userData.flames = [f];
  return g;
}

export function snowMound() { return null; }
