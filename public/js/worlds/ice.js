import * as THREE from 'three';
import {
  C, M, toon, part, mulberry, vnoise, fbm, sstep, clamp, makeSdf, makeSdfTexture, buildTerrain, makeWater,
  makeSun, instancedTufts, resetCaches, setOutlineColor,
} from '../common.js';
import { rock, pine, igloo, crystal, iceArch, floe, totem, campfire, chest, flower, updateFlame } from '../props.js';

export const meta = { id: 'ice', name: 'Ice Cove' };
const LINE = 0x3a3f73;

export function build() {
  resetCaches(); setOutlineColor(LINE);
  const rand = mulberry(29);
  const group = new THREE.Group();
  const flames = [], floes = [];
  let iglooGroup = null;

  const sdf = makeSdf([
    [{ x: 0, z: 0, rx: 10.6, rz: 6.2, rot: 0.04 }, { x: -6, z: 0.8, rx: 5.2, rz: 4.4 }, { x: 8, z: 0.8, rx: 3.8, rz: 3.8 }],
    [{ x: 6.4, z: 8.2, rx: 3.5, rz: 2.5, rot: -0.15 }],
  ], { k: 1.8, wobble: 0.3, seed: 9 });
  const SHORE = 0.1, IG = { x: 3.4, z: -2.3 };
  const height = (x, z) => {
    const d = sdf(x, z);
    let h;
    if (d < -0.3) h = 0.5 + (vnoise(x * 0.7, z * 0.7) - 0.5) * 0.08;
    else if (d < SHORE) h = 0.5 * (1 - sstep(-0.3, SHORE, d));
    else h = -1.7 * sstep(SHORE, 3.2, d);
    if (d < -0.3) h += 0.5 * sstep(3.9, 3.3, Math.hypot(x - IG.x, z - IG.z));
    return h;
  };
  const gy = (x, z) => Math.max(height(x, z), 0);

  const snowA = C('#f6f2ff'), snowB = C('#e6e1fb'), side = C('#9cc3e6'), under = C('#74cbe6'), rim = C('#8f879e');
  const terrain = buildTerrain({
    height,
    color: (x, z, h, c) => {
      const d = sdf(x, z);
      if (d >= SHORE) { c.copy(under).lerp(C('#4aa9d0'), sstep(0, 3, d)); return; }
      if (d > -0.25) { c.copy(side).lerp(snowA, sstep(0.0, -0.25, d) * 0.4); return; }
      c.copy(snowA).lerp(snowB, 0.5 + 0.5 * Math.sin((x * 0.4 - z * 0.8 + fbm(x * 0.5, z * 0.5) * 5) * 2.0)); c.lerp(snowB, 0.25 * vnoise(x * 1.5, z * 1.5));
      const bump = 0.5 * sstep(3.9, 3.3, Math.hypot(x - IG.x, z - IG.z));
      if (bump > 0.02 && bump < 0.47) c.lerp(rim, 0.9);
    },
  });
  group.add(terrain);

  const water = makeWater(makeSdfTexture(sdf), {
    shallow: '#79efff', mid: '#17c2e8', deep: '#0b98d4', foam: '#f4ffff', shelf: '#e2f4ff', ice: true, shore: SHORE,
    fog: '#ece6fa', fogNear: 38, fogFar: 85,
  });
  group.add(water);

  const put = (o, x, z, yo = 0, ry = 0) => { o.position.set(x, gy(x, z) + yo, z); o.rotation.y = ry; group.add(o); return o; };
  const snowRock = { base: ['#a58f7a', '#8f7a68'], cap: '#f8f6ff', capBias: 0.12, capSoft: 0.08, capNoise: 0.25 };
  const SR = (x, z, size, seed, o = {}, yo = 0) => put(rock(seed, { size, ...snowRock, ...o }, 0.045), x, z, yo, rand() * 6.28);

  // ----- landmarks -----
  iglooGroup = igloo(); put(iglooGroup, IG.x, IG.z, 0.5 * 0.02, -0.18);
  put(new THREE.Group(), 0, 0);
  const post = part(new THREE.BoxGeometry(0.28, 1.6, 0.28), M('#8a5a34'), { outline: 0.03 }); post.position.set(IG.x + 1.9, gy(IG.x + 1.9, IG.z + 2.1) + 0.8, IG.z + 2.1); post.rotation.z = 0.08; group.add(post);
  const tt = totem(); put(tt, -7.3, -2.6, 0, 0.35); flames.push(...tt.userData.flames);

  const cluster = new THREE.Group();
  [[0, 0, 1.55, [0.05, -0.05]], [-1.5, 0.5, 0.95, [0.1, 0.3]], [1.5, 0.4, 1.0, [-0.05, -0.35]], [0.6, 1.2, 0.7, [0.2, -0.2]], [-0.7, -0.9, 0.7, [-0.15, 0.1]]].forEach(([x, z, s, t]) => {
    const c = crystal(s, t); c.position.set(x, 0, z); cluster.add(c);
  });
  cluster.position.set(IG.x + 1.9, gy(IG.x + 1.9, IG.z - 2.6) - 0.1, IG.z - 2.6); cluster.rotation.y = -0.4; group.add(cluster);

  const ar = iceArch(); put(ar, 8.6, -1.6, -0.2, -0.12);

  // snowy pines
  put(pine(rand, { scale: 0.82 }), -3.0, -3.8);
  put(pine(rand, { scale: 0.95 }), -1.7, -3.0);
  put(pine(rand, { scale: 0.78 }), -0.4, -4.3);
  put(pine(rand, { scale: 0.95 }), 5.0, 7.6);

  // campfire + stepping stones
  const cf = campfire({ stones: ['#9d9aac', '#8b8499'], snow: true, logCol: '#a05a2c' }); put(cf, -4.8, 2.4); flames.push(...cf.userData.flames);
  [[0.3, 0.9, 0.0], [1.4, 0.1, 0.2], [2.3, -0.8, 0.45]].forEach(([x, z, y], i) =>
    put(rock(50 + i, { ...snowRock, sx: 1.25, sy: 0.38, sz: 0.9, size: 0.85, capBias: -0.2 }, 0.04), x, z, y, 0.2 + i * 0.1));

  // boulders
  SR(-6.8, 0.6, 1.5, 60, { sy: 0.9 }); SR(-7.9, 1.9, 0.8, 61); SR(-7.4, -0.6, 0.55, 62);
  SR(7.4, 1.0, 1.3, 63, { sy: 0.9 }); SR(8.6, 2.4, 0.75, 64);
  SR(0.8, -0.2, 0.55, 65); SR(5.6, 1.9, 0.5, 66);
  SR(-3.4, 4.3, 0.8, 67, { sx: 1.4 });

  // chest on islet
  put(chest({ body: '#7b5a3c', band: '#8fc2e6', snow: true }), 8.0, 8.1, 0, -0.5);

  // frost flowers + shards
  for (const [x, z] of [[-6.0, 4.0], [-5.5, 4.4], [1.5, 3.0], [0.7, 3.3], [-3.5, 0.3], [6.0, 5.3]]) put(flower('#bfe8ff', '#ffffff', 6), x, z, 0, rand() * 6);
  for (const [x, z, s] of [[-5.5, 4.6, 0.3], [-4.7, 5.0, 0.25], [-4.9, 4.3, 0.2], [4.3, 3.3, 0.3], [5.0, 3.6, 0.22], [6.8, 3.6, 0.28], [7.3, 2.3, 0.2]]) {
    const c = crystal(s * 1.4, [(rand() - 0.5) * 0.4, (rand() - 0.5) * 0.5]); put(c, x, z, 0, rand() * 6);
  }

  // floating ice floes
  [[-11.2, -3.6, 1.5], [-12.3, 1.2, 1.1], [-10.8, 6.3, 1.0], [-6.6, 9.6, 0.8], [11.8, -4.8, 1.2], [13.4, -1.6, 0.8], [12.6, 6.8, 1.3], [3.4, 11.8, 1.1], [-2.6, 11.4, 0.9], [12.8, 11.0, 1.0], [-1.5, -9.5, 1.2], [9.5, -8.2, 1.0], [-9, -8, 1.3]].forEach(([x, z, r], i) => {
    if (sdf(x, z) < 1.2) return;
    const f = floe(r, rand() * 1.5); f.position.set(x, -0.04, z); f.userData.ph = i * 1.3; floes.push(f); group.add(f);
  });

  // falling snow
  const N = 1500, sp = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { sp[i * 3] = (rand() * 2 - 1) * 24; sp[i * 3 + 1] = rand() * 16; sp[i * 3 + 2] = (rand() * 2 - 1) * 24; }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const snow = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.11, transparent: true, opacity: 0.9, depthWrite: false }));
  snow.frustumCulled = false; group.add(snow);

  // lights
  const sun = makeSun({ color: 0xfff1ea, intensity: 2.6, pos: [-11, 15, -7], extent: 17 });
  group.add(sun, sun.target);
  group.add(new THREE.HemisphereLight(0xdfe4ff, 0xb9c7ee, 1.45));

  return {
    group, sun,
    background: '#ece6fa', fog: { color: '#ece6fa', near: 60, far: 150 },
    camera: { pos: [0.5, 23.5, 32.5], target: [0.2, 1.4, 1.8], fov: 30 },
    exposure: 0.98,
    update(time) {
      water.material.uniforms.uTime.value = time;
      flames.forEach((f) => updateFlame(f, time));
      floes.forEach((f) => { f.position.y = -0.04 + Math.sin(time * 0.8 + f.userData.ph) * 0.05; f.rotation.y += 0.0006; });
      const a = sg.attributes.position;
      for (let i = 0; i < N; i++) {
        let y = a.getY(i) - 0.012 - (i % 5) * 0.002;
        if (y < 0) y += 16;
        a.setY(i, y); a.setX(i, a.getX(i) + Math.sin(time * 0.6 + i) * 0.0025);
      }
      a.needsUpdate = true;
      if (iglooGroup) iglooGroup.userData.glow.intensity = 9 * (0.92 + 0.08 * Math.sin(time * 5));
    },
  };
}
