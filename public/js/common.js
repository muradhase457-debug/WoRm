// Shared helpers: noise, toon materials, outlines, terrain, water shader.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const C = (hex) => new THREE.Color(hex);

export function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hash2 = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
export function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y) {
  return (vnoise(x, y) * 0.5 + vnoise(x * 2.03 + 11.1, y * 2.03 + 4.7) * 0.25 +
    vnoise(x * 4.1 + 3.3, y * 4.1 + 9.2) * 0.125) / 0.875;
}

// ---------- toon materials + outlines ----------
let _grad = null;
export function gradient() {
  if (!_grad) {
    const v = [92, 156, 220, 255];
    const d = new Uint8Array(v.length * 4);
    v.forEach((x, i) => { d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = x; d[i * 4 + 3] = 255; });
    _grad = new THREE.DataTexture(d, v.length, 1);
    _grad.minFilter = _grad.magFilter = THREE.NearestFilter;
    _grad.needsUpdate = true;
  }
  return _grad;
}
export const toon = (o = {}) => new THREE.MeshToonMaterial({ gradientMap: gradient(), ...o });

let matCache = new Map();
export function resetCaches() { matCache = new Map(); outlineMats = new Map(); }
export function M(color, o = {}) {
  const key = color + '|' + (o.side || 0) + '|' + (o.opacity ?? 1) + '|' + (o.emissive || '');
  if (!matCache.has(key)) matCache.set(key, toon({ color, ...o }));
  return matCache.get(key);
}

let outlineMats = new Map();
function outlineMat(color) {
  if (!outlineMats.has(color)) outlineMats.set(color, new THREE.MeshBasicMaterial({ color, side: THREE.BackSide }));
  return outlineMats.get(color);
}
export function outlineGeo(geo, thick) {
  let g = new THREE.BufferGeometry();
  g.setAttribute('position', geo.getAttribute('position').clone());
  if (geo.index) g.setIndex(geo.index.clone());
  g = mergeVertices(g, 1e-4);
  g.computeVertexNormals();
  const p = g.attributes.position, n = g.attributes.normal;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + n.getX(i) * thick, p.getY(i) + n.getY(i) * thick, p.getZ(i) + n.getZ(i) * thick);
  return g;
}
export let OUTLINE = 0x2b2233;
export function setOutlineColor(c) { OUTLINE = c; }
export function part(geo, mat, { outline = 0.04, outlineColor = OUTLINE, cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast; m.receiveShadow = receive;
  if (outline > 0) {
    const o = new THREE.Mesh(outlineGeo(geo, outline), outlineMat(outlineColor));
    o.userData.outline = true;
    m.add(o);
  }
  return m;
}

// ---------- island shape (signed distance, negative = land) ----------
const smin = (a, b, k) => { const h = clamp(0.5 + 0.5 * (b - a) / k, 0, 1); return lerp(b, a, h) - k * h * (1 - h); };
export function makeSdf(groups, { k = 1.4, wobble = 0.3, seed = 0 } = {}) {
  return (x, z) => {
    let best = 1e9;
    for (const grp of groups) {
      let d = 1e9;
      for (const b of grp) {
        const dx = x - b.x, dz = z - b.z, c = Math.cos(b.rot || 0), s = Math.sin(b.rot || 0);
        const lx = (dx * c + dz * s) / b.rx, lz = (-dx * s + dz * c) / b.rz;
        const k0 = Math.hypot(lx, lz), k1 = Math.max(Math.hypot(lx / b.rx, lz / b.rz), 1e-4), e = k0 * (k0 - 1) / k1;
        d = d > 1e8 ? e : smin(d, e, k);
      }
      best = Math.min(best, d);
    }
    return best + (fbm(x * 0.45 + seed, z * 0.45 + seed * 1.7) - 0.5) * 2 * wobble;
  };
}

export const RANGE = 16;
export function makeSdfTexture(sdf, N = 512) {
  const data = new Uint16Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = (i / (N - 1) * 2 - 1) * RANGE, z = (j / (N - 1) * 2 - 1) * RANGE;
    data[j * N + i] = THREE.DataUtils.toHalfFloat(clamp(sdf(x, z), -6, 9));
  }
  const t = new THREE.DataTexture(data, N, N, THREE.RedFormat, THREE.HalfFloatType);
  t.minFilter = t.magFilter = THREE.LinearFilter;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.needsUpdate = true;
  return t;
}

// ---------- terrain ----------
export function buildTerrain({ size = RANGE * 2, res = 260, height, color }) {
  const g = new THREE.PlaneGeometry(size, size, res, res);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  const col = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const h = height(x, z);
    p.setY(i, h);
    color(x, z, h, c);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, toon({ vertexColors: true }));
  m.receiveShadow = true; m.castShadow = true;
  return m;
}

// ---------- water ----------
const WATER_VS = `
varying vec3 vW;
void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const WATER_FS = `
uniform sampler2D uSdf; uniform float uRange, uTime, uShore, uIce, uFogNear, uFogFar;
uniform vec3 uDeep, uMid, uShallow, uFoam, uShelf, uFogColor;
varying vec3 vW;
float h21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float a=.5,s=0.; for(int i=0;i<4;i++){ s+=a*n2(p); p*=2.03; a*=.5; } return s; }
void main(){
  vec2 uv = vW.xz/(2.*uRange)+.5;
  float d = 9.0;
  if(uv.x>0. && uv.x<1. && uv.y>0. && uv.y<1.) d = texture2D(uSdf,uv).r;
  d -= uShore;
  if(d < -0.02) discard;
  vec2 p = vW.xz;
  float n = fbm(p*.7 + vec2(uTime*.05,-uTime*.04));
  float fd = d + (n-.5)*.55;
  float depth = smoothstep(0.,5.5,d);
  vec3 col = mix(uShallow,uMid,smoothstep(0.,2.4,d));
  col = mix(col,uDeep,smoothstep(1.6,5.2,d));
  vec2 q = p*1.15 + (n-.5)*3.;
  float w = sin(q.x+uTime*.7)*sin(q.y*1.1-uTime*.55);
  float rip = smoothstep(.55,.95,w)*.11;
  float c2 = fbm(p*2.2+uTime*.12);
  rip += smoothstep(.68,.76,c2)*.05*(1.-depth*.5);
  col += rip;
  float soft = smoothstep(.85,.0,fd)*.55;
  float line = smoothstep(.08,.0,abs(fd-(.95+.12*sin(uTime*.8+p.x*.6+p.y*.4))));
  float foam = clamp(soft+line*.85,0.,1.);
  col = mix(col,uFoam,foam*(1.-uIce*.55));
  float shelf = uIce*smoothstep(1.7,1.35,fd)*smoothstep(-.1,.25,fd);
  float crack = smoothstep(.035,.0,abs(fbm(p*1.25+4.)-.5));
  vec3 sc = uShelf - crack*.10 + n*.05;
  col = mix(col,sc,shelf*.92);
  float alpha = mix(.36,1.,smoothstep(0.,3.8,d));
  alpha = max(alpha, shelf*.93);
  float fg = smoothstep(uFogNear,uFogFar,distance(vW,cameraPosition));
  col = mix(col,uFogColor,fg); alpha = mix(alpha,1.,fg);
  gl_FragColor = vec4(col,alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
export function makeWater(sdfTex, o) {
  const mat = new THREE.ShaderMaterial({
    vertexShader: WATER_VS, fragmentShader: WATER_FS, transparent: true, depthWrite: false,
    uniforms: {
      uSdf: { value: sdfTex }, uRange: { value: RANGE }, uTime: { value: 0 }, uShore: { value: o.shore ?? 0 },
      uIce: { value: o.ice ? 1 : 0 }, uFogNear: { value: o.fogNear }, uFogFar: { value: o.fogFar },
      uDeep: { value: C(o.deep) }, uMid: { value: C(o.mid) }, uShallow: { value: C(o.shallow) },
      uFoam: { value: C(o.foam) }, uShelf: { value: C(o.shelf || '#dff3ff') }, uFogColor: { value: C(o.fog) },
    },
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(700, 700).rotateX(-Math.PI / 2), mat);
  m.renderOrder = 2;
  return m;
}

// ---------- misc ----------
export function makeSun({ color = 0xfff0d0, intensity = 3, pos = [-10, 14, -6], extent = 17 } = {}) {
  const l = new THREE.DirectionalLight(color, intensity);
  l.position.set(...pos);
  l.castShadow = true;
  const c = l.shadow.camera;
  c.left = -extent; c.right = extent; c.top = extent; c.bottom = -extent; c.near = 1; c.far = 70;
  l.shadow.bias = -0.0004; l.shadow.normalBias = 0.05; l.shadow.radius = 3;
  return l;
}

export function tuftGeo(color = '#4fb83f') {
  const parts = [];
  for (let i = 0; i < 5; i++) {
    const g = new THREE.ConeGeometry(0.05, 0.38 + (i % 2) * 0.12, 4);
    g.translate(0, 0.19, 0);
    const a = (i / 5) * Math.PI * 2;
    g.rotateZ(Math.cos(a) * 0.35); g.rotateX(Math.sin(a) * 0.35);
    g.deleteAttribute('uv');
    parts.push(g);
  }
  return parts;
}
export function instancedTufts(list, color, tipColor) {
  // list: [{x,y,z,s}] — a single InstancedMesh of small grass blades
  const geos = tuftGeo();
  const merged = mergeBuffer(geos);
  const m = new THREE.InstancedMesh(merged, toon({ color, side: THREE.DoubleSide }), list.length);
  const o = new THREE.Object3D();
  list.forEach((t, i) => { o.position.set(t.x, t.y, t.z); o.rotation.set(0, t.r || 0, 0); o.scale.setScalar(t.s || 1); o.updateMatrix(); m.setMatrixAt(i, o.matrix); });
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function mergeBuffer(geos) {
  let n = 0; geos.forEach((g) => (n += g.attributes.position.count));
  const pos = new Float32Array(n * 3); const idx = []; let off = 0;
  geos.forEach((g) => {
    pos.set(g.attributes.position.array, off * 3);
    g.index.array.forEach((i) => idx.push(i + off));
    off += g.attributes.position.count;
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setIndex(idx); out.computeVertexNormals();
  return out;
}

export function disposeTree(root) {
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { if (m.map && m.map.userData.own) m.map.dispose(); m.dispose(); });
    if (o.isLight && o.shadow && o.shadow.map) { o.shadow.map.dispose(); o.shadow.map = null; }
  });
}
