import * as THREE from 'three';
import {
  C, M, toon, part, mulberry, vnoise, fbm, sstep, clamp, makeSdf, makeSdfTexture, buildTerrain, makeWater,
  makeSun, instancedTufts, resetCaches, setOutlineColor,
} from '../common.js';
import { rock, rockGeo, palm, fern, campfire, torch, hut, stump, chest, flower, updateFlame } from '../props.js';

export const meta = { id: 'tropical', name: 'Tropical Island' };

export function build() {
  resetCaches(); setOutlineColor(0x2b2233);
  const rand = mulberry(11);
  const group = new THREE.Group();
  const flames = [], palms = [];

  // ----- island shape -----
  const sdf = makeSdf([
    [{ x: 0, z: 0, rx: 10.4, rz: 6.3, rot: 0.06 }, { x: -5.2, z: 1.8, rx: 5.6, rz: 4.6 }, { x: 6.6, z: 0.6, rx: 4.6, rz: 4.2 }],
    [{ x: 6.4, z: 8.3, rx: 3.7, rz: 2.4, rot: -0.2 }],
  ], { k: 1.6, wobble: 0.28, seed: 3 });
  const HUT = { x: -0.2, z: -2.5 };
  const height = (x, z) => {
    const d = sdf(x, z);
    let h = d < 0 ? 0.38 * sstep(0, -0.9, d) : -1.7 * sstep(0, 2.6, d);
    if (d < 0) {
      h += 0.8 * sstep(3.3, 1.4, Math.hypot(x - HUT.x, z - HUT.z)) * sstep(0, -1, d);
      h += (vnoise(x * 0.8, z * 0.8) - 0.5) * 0.12 * sstep(0, -1, d);
      h = Math.max(h, 0.02);
    }
    return h;
  };
  const gy = (x, z) => Math.max(height(x, z), 0);

  const grassSpots = [[-6.4, 0.2, 2.4], [-7.6, -0.6, 1.6], [3.5, -3.6, 1.9], [-3.4, -3.8, 1.6], [6.3, 2.2, 1.6], [6.2, 8.2, 1.5], [-0.8, -1.3, 1.1], [-5, 4.2, 1.4], [8.2, 0.8, 1.4]];
  const sandA = C('#f6d38a'), sandB = C('#ecbf6e'), wet = C('#e2b268'), bed = C('#c9a56a'), grassA = C('#4fae40'), grassB = C('#74c94c'), t = C('#000');
  const terrain = buildTerrain({
    height,
    color: (x, z, h, c) => {
      const d = sdf(x, z);
      if (d >= 0) { c.copy(bed).lerp(C('#a98c58'), sstep(0, 3, d)); return; }
      const n = fbm(x * 0.5, z * 0.5);
      c.copy(sandA).lerp(sandB, 0.5 + 0.5 * Math.sin((x * 0.55 + z * 0.9 + n * 4) * 2.2));
      c.lerp(wet, sstep(-0.7, 0, d) * 0.9);
      let gm = sstep(0.64, 0.68, vnoise(x * 0.5 + 7, z * 0.5) * 0.6 + vnoise(x * 1.3, z * 1.3) * 0.4) * sstep(-1.0, -1.8, d) * 0.9;
      for (const s of grassSpots) gm = Math.max(gm, sstep(s[2], s[2] * 0.55, Math.hypot(x - s[0], z - s[1])) * (0.6 + 0.4 * vnoise(x * 2, z * 2)) * sstep(-0.3, -1.1, d));
      if (gm > 0.01) { t.copy(grassA).lerp(grassB, vnoise(x * 1.7, z * 1.7)); c.lerp(t, clamp(gm * 1.4, 0, 1)); }
    },
  });
  group.add(terrain);

  // ----- water -----
  const water = makeWater(makeSdfTexture(sdf), {
    shallow: '#58e6d6', mid: '#26c3cf', deep: '#1a95b8', foam: '#f4ffff', fog: '#2a9ec0', fogNear: 55, fogFar: 170,
  });
  group.add(water);

  // ----- helpers -----
  const put = (o, x, z, yo = 0, ry = 0) => { o.position.set(x, gy(x, z) + yo, z); o.rotation.y = ry; group.add(o); return o; };
  const R = (x, z, size, seed, o = {}, yo = 0.0, ry = rand() * 6.28) => put(rock(seed, { size, ...o }), x, z, yo, ry);

  // ----- rocks & stone formations -----
  const tex = { base: ['#a3a2b2', '#8c8299'] };
  R(-5.6, -3.4, 1.7, 1, { ...tex, sy: 0.9 }); R(-3.6, -4.0, 1.5, 2, { ...tex, sy: 0.9 });
  put(rock(3, { ...tex, sx: 2.5, sy: 0.5, sz: 1.5, size: 1.1, capBias: 0.62 }), -4.6, -3.7, 1.55, 0.2); // big slab on top
  R(-6.8, -1.5, 1.25, 4, tex, 0.1); R(-5.3, -1.1, 0.9, 5, tex);
  R(-8.7, 1.4, 1.0, 6, { ...tex, sx: 2.0, sy: 0.6, sz: 1.1 }, 0.1, -0.5);
  R(-1.9, -1.2, 0.5, 7, tex); R(1.6, -1.4, 0.55, 8, tex); R(2.2, -2.2, 0.8, 9, tex);
  // steps
  put(rock(10, { ...tex, sx: 1.2, sy: 0.35, sz: 0.85, size: 0.7 }), 1.7, 0.2, 0.05, 0.3);
  put(rock(11, { ...tex, sx: 1.2, sy: 0.35, sz: 0.85, size: 0.7 }), 1.45, -0.45, 0.35, 0.1);
  put(rock(12, { ...tex, sx: 1.2, sy: 0.35, sz: 0.85, size: 0.7 }), 1.2, -1.1, 0.65, 0.2);
  // arch (right)
  const arch = new THREE.Group();
  const pl = (x, y, s, seed, o = {}) => { const r = rock(seed, { ...tex, size: s, ...o }); r.position.set(x, y, 0); r.rotation.y = rand() * 6; arch.add(r); };
  pl(-1.7, 0.55, 1.15, 20, { sy: 1.15 }); pl(-1.65, 1.95, 0.95, 21, { sy: 0.9 });
  pl(1.8, 0.5, 1.2, 22, { sy: 1.1 }); pl(1.8, 1.75, 1.0, 23, { sy: 0.9 }); pl(1.75, 2.9, 0.85, 24, { sy: 0.85 });
  const lintel = rock(25, { ...tex, sx: 2.5, sy: 0.4, sz: 1.1, size: 1.2, capBias: 0.62 }); lintel.position.set(0.1, 3.6, 0); lintel.rotation.z = -0.07; arch.add(lintel);
  const lint2 = rock(26, { ...tex, sx: 1.4, sy: 0.4, sz: 0.9, size: 1.0, capBias: 0.62 }); lint2.position.set(-0.8, 3.0, 0.05); arch.add(lint2);
  arch.position.set(6.2, gy(6.2, -2.6) - 0.05, -2.6); arch.rotation.y = -0.22; group.add(arch);
  // right boulders
  R(8.3, -0.4, 1.9, 30, { ...tex, sy: 0.95 }); R(7.1, 0.9, 1.1, 31, tex); R(8.7, 1.9, 1.05, 32, tex);
  put(rock(33, { ...tex, sx: 2.0, sy: 0.6, sz: 1.0, size: 0.9 }), 5.3, 2.2, 0.05, 0.35);
  put(rock(34, { ...tex, sx: 1.7, sy: 0.6, sz: 0.9, size: 0.9 }), 8.2, 3.5, 0.05, -0.6);
  R(9.4, 3.0, 0.45, 35, tex); R(4.1, 2.9, 0.4, 36, tex);
  // front boulders
  R(0.4, 2.7, 1.55, 40, { ...tex, sy: 0.95 }); R(-1.3, 3.8, 1.0, 41, tex); R(-0.6, 1.2, 0.5, 42, tex); R(1.9, 4.2, 0.35, 43, tex);
  R(-2.4, 2.0, 0.4, 44, tex);

  // ----- hut, torch, fire -----
  put(hut(), HUT.x, HUT.z, 0, 0.1);
  const tc = torch(); put(tc, -7.5, -0.7); flames.push(...tc.userData.flames);
  const cf = campfire(); put(cf, -5.5, 3.0); flames.push(...cf.userData.flames);
  for (const [x, z] of [[-7.1, 2.3], [-4.4, 1.8], [-4.2, 3.9], [-6.4, 4.4]]) { const s = stump(); put(s, x, z, 0.22, rand() * 6); }

  // ----- palms -----
  const P = (x, z, o) => { const p = palm(rand, o); put(p, x, z); palms.push(p); return p; };
  P(-8.5, -1.1, { height: 5.0, lean: 1.8, dir: Math.PI * 0.95, leaves: 9 });
  P(-2.8, -4.4, { height: 6.0, lean: 0.9, dir: 0.4, leaves: 10 });
  P(0.9, -4.8, { height: 6.4, lean: 0.9, dir: -0.6, leaves: 10 });
  P(2.7, -2.9, { height: 5.4, lean: 1.2, dir: 0.4, leaves: 9 });
  P(5.1, 7.5, { height: 5.0, lean: 2.1, dir: Math.PI * 0.8, leaves: 10, leafLen: 2.7 });

  // ----- chest on islet -----
  const ch = put(chest(), 7.6, 7.9, 0.0, -0.5);

  // ----- plants -----
  for (const [x, z] of [[-0.6, -1.4], [-6.6, 1.5], [-6.2, 1.0], [-6.0, -0.5], [5.9, 8.4], [4.6, 8.1], [8.4, 8.6], [-3.2, -2.8], [3.2, -1.6]]) {
    const f = flower(rand() > 0.3 ? '#ff7ac8' : '#ff9ad6'); put(f, x, z, 0, rand() * 6);
  }
  for (const [x, z, n] of [[-0.9, -3.8, 6], [-7.6, 0.2, 7], [-6.7, -2.3, 5], [4.2, -3.9, 6], [1.9, -3.5, 5], [-6.2, 3.7, 6], [5.6, 7.0, 5]]) {
    const f = fern(rand, { n, L: 1.0 + rand() * 0.3 }); put(f, x, z, 0.05, rand() * 6);
  }
  const tufts = [];
  for (let i = 0, n = 0; i < 4000 && n < 140; i++) {
    const x = (rand() * 2 - 1) * 12, z = (rand() * 2 - 1) * 8;
    if (sdf(x, z) > -1.4) continue;
    const y = height(x, z); if (y < 0.1) continue;
    // only on grassy ground: re-use the terrain colour test
    const gm = sstep(0.64, 0.68, vnoise(x * 0.5 + 7, z * 0.5) * 0.6 + vnoise(x * 1.3, z * 1.3) * 0.4);
    let near = 0; for (const s of grassSpots) near = Math.max(near, sstep(s[2], s[2] * 0.55, Math.hypot(x - s[0], z - s[1])));
    if (gm < 0.5 && near < 0.5) continue;
    tufts.push({ x, y: y - 0.02, z, r: rand() * 6, s: 0.7 + rand() * 0.7 }); n++;
  }
  group.add(instancedTufts(tufts, '#4cb43c'));

  // ----- lights -----
  const sun = makeSun({ color: 0xfff0cf, intensity: 3.1, pos: [-11, 15, -7], extent: 17 });
  group.add(sun, sun.target);
  group.add(new THREE.HemisphereLight(0xcdeeff, 0xf5d79c, 1.15));

  return {
    group, sun,
    background: '#2a9ec0', fog: { color: '#2a9ec0', near: 70, far: 190 },
    camera: { pos: [0.5, 23.5, 32.5], target: [0.2, 1.4, 1.8], fov: 30 },
    exposure: 1.0,
    update(time) {
      water.material.uniforms.uTime.value = time;
      flames.forEach((f) => updateFlame(f, time));
      palms.forEach((p) => p.userData.fronds.forEach((fr) => { fr.piv.rotation.z = fr.base + Math.sin(time * 1.1 + fr.ph) * 0.045; }));
    },
  };
}
