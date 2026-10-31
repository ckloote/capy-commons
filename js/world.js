// world.js — terrain, water, sky, trees, grove gate, hot spring
import * as THREE from 'three';

// ---------- deterministic noise ----------
function hash(x, z) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function smooth(t) { return t * t * (3 - 2 * t); }
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const a = hash(xi, zi), b = hash(xi + 1, zi);
  const c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  const u = smooth(xf), v = smooth(zf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, z) {
  return vnoise(x, z) * 0.6 + vnoise(x * 2.3 + 5, z * 2.3 + 5) * 0.28 + vnoise(x * 5.1 + 9, z * 5.1 + 9) * 0.12;
}
export function mulberry(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- layout constants ----------
export const ISLAND_R = 60;
export const GROVE = new THREE.Vector3(0, 0, -44);
export const SPRING = new THREE.Vector3(-30, 0, -4);
export const POND = { x: 26, z: 14, r: 13 };

const PONDS = [
  { x: POND.x, z: POND.z, r: POND.r, d: 3.2 },
  { x: -18, z: 34, r: 9, d: 2.6 },
];

// ---------- the archipelago ----------
// Home is the original island (its height function below is untouched).
// Neighbours are ellipses: rx/rz half-axes, rot (radians), top = dome height,
// rough = noise amount, shore = width of the beach drop-off, biome = shaper.
export const ISLANDS = [
  { id: 'home', name: 'the Commons', x: 0, z: 0, rx: ISLAND_R, rz: ISLAND_R, biome: 'marsh' },
  { id: 'terraces', name: 'the Steaming Terraces', x: 85, z: -55, rx: 24, rz: 22, rot: 0.5,
    top: 6, rough: 1, shore: 8, seed: 31, biome: 'terraces',
    arrive: 'The Steaming Terraces — warm stone steps, stacked like a sleepy cake. ♨️' },
  { id: 'paddies', name: 'the Rice Paddies', x: 20, z: 100, rx: 29, rz: 26, rot: -0.2,
    top: 1.5, rough: 0.35, shore: 7, seed: 57, biome: 'paddies',
    arrive: 'The Rice Paddies — the water here is ankle-deep and warm. 🌾' },
  { id: 'riverbank', name: 'the Riverbank', x: -100, z: 30, rx: 19, rz: 31, rot: 0.15,
    top: 3.6, rough: 0.9, shore: 8, seed: 83, biome: 'riverbank',
    arrive: 'The Riverbank — a lazy river winds right through the middle. 🏞️' },
  // tiny rocky islets: landmarks and rest stops in the open water
  { id: 'islet-se', name: 'a little islet', x: 50, z: 70, rx: 6, rz: 5, rot: 0.8,
    top: 2.2, rough: 0.3, shore: 3, seed: 101, biome: 'islet' },
  { id: 'islet-w', name: 'a little islet', x: -74, z: -16, rx: 5.5, rz: 6.5, rot: 0.3,
    top: 2.2, rough: 0.3, shore: 3, seed: 113, biome: 'islet' },
];
// the player can swim anywhere inside this circle (the old limit was ISLAND_R + 4)
export const SEA_R = 150;

for (const I of ISLANDS) {
  if (I.id === 'home') continue;
  I.rot = I.rot || 0;
  I.cos = Math.cos(I.rot); I.sin = Math.sin(I.rot);
  I.rm = (I.rx + I.rz) / 2;
  I.reach = Math.max(I.rx, I.rz) * (1 + (I.shore * 1.75) / I.rm) + 1;   // bbox for a cheap reject
}

const RIVER = ISLANDS.find((i) => i.biome === 'riverbank');

// ---------- the Rice Paddies layout (pure geometry, shared with game.js) ----------
// Fields are the 7.5-unit cells of the paddies' local grid that sit wholly in
// the flooded middle. Most are planted with rice; the rest grow lily pads,
// and a few pads near the north shore are perches for frogs.
export const PADDY = (() => {
  const I = ISLANDS.find((i) => i.biome === 'paddies');
  const CELL = 7.5, R = mulberry(7707);
  const toWorld = (lx, lz) => ({ x: I.x + lx * I.cos - lz * I.sin, z: I.z + lx * I.sin + lz * I.cos });
  const fields = [];
  for (let i = -5; i < 5; i++) {
    for (let j = -5; j < 5; j++) {
      const lx = (i + 0.5) * CELL, lz = (j + 0.5) * CELL;
      // whole: every corner is in the flooded middle; edge fields are cut off by the rim
      const whole = [[-1, -1], [1, -1], [-1, 1], [1, 1]].every(([a, b]) =>
        Math.hypot((lx + a * (CELL / 2 - 0.5)) / I.rx, (lz + b * (CELL / 2 - 0.5)) / I.rz) < 0.64);
      if (whole || Math.hypot(lx / I.rx, lz / I.rz) < 0.62) fields.push({ lx, lz, ...toWorld(lx, lz), whole, planted: R() < 0.62 });
    }
  }
  // the lily-pad fields: always at least the three nearest the north shore (toward home)
  const byNorth = fields.filter((f) => f.whole).sort((a, b) => a.z - b.z);
  for (let k = 0; k < 3; k++) byNorth[k].planted = false;
  const lily = byNorth.filter((f) => !f.planted);
  const perches = [toWorld(lily[0].lx + 1.3, lily[0].lz - 0.9), toWorld(lily[1].lx - 1.1, lily[1].lz + 1.2)];
  // a turtle basks on the bund between the first lily field and its east neighbour;
  // a cousin herd grazes the dry rim on the north side
  const turtle = toWorld(lily[0].lx + CELL / 2, lily[0].lz + 1.5);
  // (the dry rim is a narrow ring at q ≈ 0.72–0.78, between the fields and the beach)
  const herd = [-0.22, 0, 0.22].map((a) => toWorld(Math.sin(a) * 0.75 * I.rx, -Math.cos(a) * 0.75 * I.rz));
  return { island: I, CELL, fields, perches, turtle, herd, toWorld };
})();

function falloff(d, r) {
  if (d >= r) return 0;
  const t = 1 - d / r;
  return smooth(t);
}

// local frame of a neighbour island: lx across, lz along its long axis
function localOf(I, x, z) {
  const dx = x - I.x, dz = z - I.z;
  return { lx: dx * I.cos + dz * I.sin, lz: -dx * I.sin + dz * I.cos };
}

// one neighbour's terrain, or -Infinity outside its footprint. It sinks an
// extra 4 below the ocean floor before the cutoff so max() with home's sea
// floor never shows a step.
function neighbourHeight(I, x, z) {
  if (Math.abs(x - I.x) > I.reach || Math.abs(z - I.z) > I.reach) return -Infinity;
  const { lx, lz } = localOf(I, x, z);
  const q = Math.hypot(lx / I.rx, lz / I.rz);
  const d = q * I.rm;
  const S = I.shore;
  if (d > I.rm + S * 1.75) return -Infinity;
  let h = I.top * Math.max(0, 1 - q * q) + (fbm(x * 0.05 + I.seed, z * 0.05 + I.seed * 1.3) * 2 - 0.7) * I.rough;
  h = BIOME[I.biome](h, lx, lz, q, I);
  if (d > I.rm - S) h -= smooth(Math.min(1, (d - (I.rm - S)) / (S * 1.75))) * 6.5;
  if (d > I.rm + S * 0.75) h -= smooth(Math.min(1, (d - (I.rm + S * 0.75)) / S)) * 4;
  return h;
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const BIOME = {
  islet: (h) => h,
  // stepped treads with short soft risers, like travertine terraces
  terraces(h) {
    if (h < 0.3) return h;
    const STEP = 0.8, k = (h - 0.3) / STEP, f = k - Math.floor(k);
    return 0.3 + (Math.floor(k) + smooth(clamp01((f - 0.78) / 0.22))) * STEP;
  },
  // a grid of flooded fields (wading depth for every species) between bunds you can walk
  paddies(h, lx, lz, q) {
    const CELL = 7.5;
    const bx = Math.abs(((lx % CELL) + CELL) % CELL - CELL / 2);
    const bz = Math.abs(((lz % CELL) + CELL) % CELL - CELL / 2);
    const toBund = CELL / 2 - Math.max(bx, bz);       // 0 on a bund line
    const field = 0.35 + (-0.09 - 0.35) * smooth(clamp01((toBund - 0.45) / 0.55));
    const m = smooth(clamp01((0.78 - q) / 0.14));      // a dry rim of land around the fields
    return h + (field - h) * m;
  },
  // a lazy river along the long axis, meandering, open to the sea at both ends
  riverbank(h, lx, lz) {
    const dist = Math.abs(lx - riverCentre(lz));
    const c = smooth(clamp01((7.5 - dist) / 3.5));   // flat bed ±4, sloping banks out to 7.5
    return h + (-1.3 - h) * c;
  },
};
export function riverCentre(lz) { return 4 * Math.sin(lz * 0.12); }

// ---------- the river current (phase 3d) ----------
// The Riverbank's river flows along its long axis toward +lz (roughly south),
// out to sea at the south end. Strongest mid-channel, nothing on the banks.
export const CURRENT_MAX = 2.4;     // units/s; swimming is 4.2, so you can always beat it
const RIVER_HALF = 5.2;             // the current fades to 0 this far from the centre line
export function currentAt(x, z, out = { x: 0, z: 0 }) {
  out.x = 0; out.z = 0;
  const I = RIVER;
  if (Math.abs(x - I.x) > I.reach || Math.abs(z - I.z) > I.reach) return out;
  if (heightAt(x, z) > -0.05) return out;
  const { lx, lz } = localOf(I, x, z);
  const end = I.rz + I.shore * 1.5;                       // past the mouths it dies away in the sea
  if (Math.abs(lz) > end) return out;
  const k = smooth(clamp01(1 - Math.abs(lx - riverCentre(lz)) / RIVER_HALF)) *
    smooth(clamp01((end - Math.abs(lz)) / 6));
  if (k <= 0) return out;
  // flow direction: along the centre line's tangent (dlx/dlz, 1), rotated into the world
  const tx = 0.48 * Math.cos(lz * 0.12), n = Math.hypot(tx, 1);
  const flx = tx / n, flz = 1 / n;
  out.x = (flx * I.cos - flz * I.sin) * CURRENT_MAX * k;
  out.z = (flx * I.sin + flz * I.cos) * CURRENT_MAX * k;
  return out;
}

// the original single-island height function, unchanged (home invariance)
function homeHeight(x, z) {
  const r = Math.hypot(x, z);
  // island dome
  let h = 3.4 * Math.max(0, 1 - (r / ISLAND_R) ** 2);
  h += fbm(x * 0.045 + 11, z * 0.045 + 7) * 2.4 - 0.9;
  // shore drop
  if (r > ISLAND_R - 8) {
    const t = Math.min(1, (r - (ISLAND_R - 8)) / 14);
    h -= smooth(t) * 6.5;
  }
  // ponds
  for (const p of PONDS) {
    h -= p.d * falloff(Math.hypot(x - p.x, z - p.z), p.r);
  }
  // keep gameplay spots comfortable
  h += 1.6 * falloff(Math.hypot(x - GROVE.x, z - GROVE.z), 16);      // grove knoll
  h += 1.2 * falloff(Math.hypot(x - SPRING.x, z - SPRING.z), 10);    // spring hill
  h += 0.8 * falloff(Math.hypot(x, z), 10);                          // spawn meadow
  return h;
}

export function heightAt(x, z) {
  let h = homeHeight(x, z);
  for (let i = 1; i < ISLANDS.length; i++) {
    const n = neighbourHeight(ISLANDS[i], x, z);
    if (n > h) h = n;
  }
  return h;
}

// which island's terrain is on top here (index into ISLANDS)
function ownerAt(x, z) {
  let best = 0, h = homeHeight(x, z);
  for (let i = 1; i < ISLANDS.length; i++) {
    const n = neighbourHeight(ISLANDS[i], x, z);
    if (n > h) { h = n; best = i; }
  }
  return best;
}

// the island you're standing on (dry land or shallows), or null in open water
export function islandAt(x, z) {
  if (heightAt(x, z) < -1) return null;
  return ISLANDS[ownerAt(x, z)];
}

export function isWater(x, z) { return heightAt(x, z) < 0.02; }

// ---------- texture helper ----------
export function tile(tex, n) {
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(n, n);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// MeshLambertMaterial with a second texture mixed in by a per-vertex `splat`
// attribute (0 = base map, 1 = alt map). Both share the base map's UVs;
// altScale sets the alt texture's tile size relative to the base.
const WHITE = new THREE.Color(1, 1, 1);
function nrmY(geo, i) { return geo.attributes.normal.getY(i); }
function splatMaterial(baseMap, altTex, altScale = 1) {
  const mat = new THREE.MeshLambertMaterial({ map: baseMap, vertexColors: true });
  const altMap = tile(altTex.clone(), 1);
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.altMap = { value: altMap };
    sh.uniforms.altScale = { value: altScale };
    sh.vertexShader = 'attribute float splat;\nvarying float vSplat;\n' +
      sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vSplat = splat;');
    sh.fragmentShader = 'uniform sampler2D altMap;\nuniform float altScale;\nvarying float vSplat;\n' +
      sh.fragmentShader.replace('#include <map_fragment>',
        'diffuseColor *= mix(texture2D(map, vMapUv), texture2D(altMap, vMapUv * altScale), vSplat);');
  };
  mat.customProgramCacheKey = () => 'splat';
  return mat;
}

// how much of the alt texture each biome shows: (x, z, height, local x/z, q, normal.y) → 0..1
const SPLAT = {
  // mineral crust over the treads and every riser; a few grassy patches on the treads
  // river stones along the channel and its banks, grass beyond
  riverbank(x, z, h, lx, lz) {
    return smooth(clamp01((9.5 - Math.abs(lx - riverCentre(lz))) / 2));
  },
  // mud on the flooded field floors; the bunds between them and the dry rim stay grassy
  paddies(x, z, h, lx, lz, q) {
    return smooth(clamp01((0.82 - q) / 0.12)) * smooth(clamp01((0.22 - h) / 0.2));
  },
  terraces(x, z, h, lx, lz, q, ny) {
    const crust = smooth(clamp01((h - 0.05) / 0.4));
    const grass = smooth(clamp01((fbm(x * 0.11 + 3, z * 0.11 - 4) - 0.58) / 0.12));
    const riser = clamp01((0.95 - ny) / 0.15);
    return crust * Math.max(1 - grass * 0.9, riser);
  },
};

// ---------- world build ----------
export function createWorld(scene, T) {
  const world = { runes: [], steam: [], yuzu: [], flowers: [], mixers: [] };

  // static circular colliders (tree trunks, rocks, grove trunks, rune stones).
  // Soft things — bushes, reeds, low spring stones, flat slabs — stay passable.
  world.colliders = [];
  world.collide = (x, z, r) => {
    for (let pass = 0; pass < 2; pass++) {
      for (const c of world.colliders) {
        const dx = x - c.x, dz = z - c.z;
        const min = c.r + r;
        if (dx > min || dx < -min || dz > min || dz < -min) continue;
        const d2 = dx * dx + dz * dz;
        if (d2 >= min * min) continue;
        const d = Math.sqrt(d2) || 0.001;
        const push = (min - d) / d;
        x += dx * push; z += dz * push;
      }
    }
    return { x, z };
  };

  // sky dome (gradient shader; uniforms lerped for finale nightfall)
  const skyUniforms = {
    topColor: { value: new THREE.Color(0x8a74b0) },
    midColor: { value: new THREE.Color(0xf8c48a) },
    botColor: { value: new THREE.Color(0xffe9c0) },
    offset: { value: 0.12 },
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(420, 24, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: skyUniforms,
      vertexShader: `varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `
        uniform vec3 topColor, midColor, botColor; uniform float offset; varying vec3 vP;
        void main(){
          float h = normalize(vP).y + offset;
          vec3 c = h > 0.25 ? mix(midColor, topColor, smoothstep(0.25, 0.9, h))
                            : mix(botColor, midColor, smoothstep(-0.1, 0.25, h));
          gl_FragColor = vec4(c, 1.0);
        }`,
    })
  );
  scene.add(sky);
  world.skyUniforms = skyUniforms;

  scene.fog = new THREE.Fog(0xf5c98a, 55, 210);
  world.fog = scene.fog;

  // lights
  const hemi = new THREE.HemisphereLight(0xffe8c0, 0x4a5c38, 0.95);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffd9a0, 1.5);
  sun.position.set(40, 55, 60);
  scene.add(sun);
  world.hemi = hemi; world.sun = sun;

  // terrain: one mesh per island. Each keeps only the triangles that touch its
  // own ground (ownerAt), so neighbouring meshes never overlap and z-fight;
  // a dark sea-floor plane underneath fills any gap in the deep water.
  const tmp = new THREE.Color();
  const PALETTE = {
    marsh:     { land: 0xffffff, sand: 0xe8c98f, deep: 0x7a8f6a },
    terraces:  { land: 0xfff0d2, sand: 0xf1dcb4, deep: 0x8c9478, cliff: 0xf6dcc2,     // soft apricot risers
                 alt: 'travertine', altScale: 0.9 },
    paddies:   { land: 0xe4ffc4, sand: 0xb8a26e, deep: 0x7a8456, alt: 'mud', altScale: 1.6 },
    riverbank: { land: 0xf2ffe0, sand: 0xc9ad78, deep: 0x6f7f5c, alt: 'riverstones', altScale: 2.4 },
    islet:     { land: 0xf0e6cc, sand: 0xe8c98f, deep: 0x7a8f6a },
  };
  function buildTerrain(owner, cx, cz, size, seg, repeat) {
    const pal = PALETTE[ISLANDS[owner].biome];
    const cLand = new THREE.Color(pal.land), cSand = new THREE.Color(pal.sand), cDeep = new THREE.Color(pal.deep);
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    geo.translate(cx, 0, cz);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const mine = new Uint8Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = heightAt(x, z);
      pos.setY(i, h);
      mine[i] = ownerAt(x, z) === owner ? 1 : 0;
      if (h < 0.35) tmp.lerpColors(cDeep, cSand, Math.min(1, Math.max(0, (h + 1.2) / 1.55)));
      else tmp.copy(cLand).lerp(cSand, Math.max(0, 1 - (h - 0.35) / 0.5) * 0.55);
      colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
    }
    const idx = geo.index.array, keep = [];
    for (let k = 0; k < idx.length; k += 3) {
      if (mine[idx[k]] || mine[idx[k + 1]] || mine[idx[k + 2]]) keep.push(idx[k], idx[k + 1], idx[k + 2]);
    }
    geo.setIndex(keep);
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    if (pal.cliff) {
      // steep faces (terrace risers) catch a different colour so the steps read
      const nrm = geo.attributes.normal, cCliff = new THREE.Color(pal.cliff);
      for (let i = 0; i < pos.count; i++) {
        const k = clamp01((0.93 - nrm.getY(i)) / 0.2);
        if (k <= 0 || pos.getY(i) < 0.3) continue;
        tmp.fromArray(colors, i * 3).lerp(cCliff, k).multiplyScalar(1 + 0.25 * k);
        tmp.toArray(colors, i * 3);
      }
    }
    let mat;
    const splatFn = SPLAT[ISLANDS[owner].biome];
    if (splatFn) {
      // a second ground texture (travertine, mud, river stones) blended in per vertex
      const I = ISLANDS[owner];
      const splat = new Float32Array(pos.count);
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i), h = pos.getY(i);
        const { lx, lz } = localOf(I, x, z);
        const k = clamp01(splatFn(x, z, h, lx, lz, Math.hypot(lx / I.rx, lz / I.rz), nrmY(geo, i)));
        splat[i] = k;
        // under the alternate texture the biome tint gives way to plain white
        // (steep faces keep their cliff tint, so terrace risers still read as steps)
        const flat = clamp01((nrmY(geo, i) - 0.8) / 0.15);
        tmp.fromArray(colors, i * 3).lerp(WHITE, k * 0.8 * flat).toArray(colors, i * 3);
      }
      geo.setAttribute('splat', new THREE.BufferAttribute(splat, 1));
      mat = splatMaterial(tile(T.grass.clone(), repeat), T[pal.alt], pal.altScale);
    } else {
      mat = new THREE.MeshLambertMaterial({ map: tile(T.grass.clone(), repeat), vertexColors: true });
    }
    const mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);
    return mesh;
  }
  // home: the original 170×170 / 130-segment plane (heights unchanged)
  world.terrains = [buildTerrain(0, 0, 0, 170, 130, 26)];
  for (let i = 1; i < ISLANDS.length; i++) {
    const I = ISLANDS[i];
    const size = 2 * I.reach + 4;
    // mesh spacing per biome: fine enough that the rendered ground matches
    // heightAt (which places characters and water) across the narrow features —
    // terrace risers, 0.55-wide bund edges, the river's banks
    const cell = { terraces: 0.45, paddies: 0.35, riverbank: 0.8 }[I.biome] || 1.3;
    world.terrains.push(buildTerrain(i, I.x, I.z, size, Math.ceil(size / cell), 26 * size / 170));
  }
  const seaFloor = new THREE.Mesh(new THREE.PlaneGeometry(700, 700),
    new THREE.MeshLambertMaterial({ map: tile(T.grass.clone(), 107), color: 0x6c805c }));
  seaFloor.rotation.x = -Math.PI / 2;
  seaFloor.position.y = -6.6;
  scene.add(seaFloor);

  // water
  const waterMat = new THREE.MeshLambertMaterial({
    map: tile(T.water, 15), transparent: true, opacity: 0.85,
    color: 0xd6e2bc,
  });
  T.water.anisotropy = 16;
  // big enough that its edge stays in the fog even from the outer sea bound
  const water = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0;
  scene.add(water);
  world.waterMat = waterMat;

  // materials for props
  const barkMat = new THREE.MeshLambertMaterial({ map: tile(T.bark, 1.6) });
  const canopyMat = new THREE.MeshLambertMaterial({ map: tile(T.canopy, 2) });
  const canopyMat2 = new THREE.MeshLambertMaterial({ map: tile(T.canopy, 2), color: 0xd8ffc0 });
  const stoneMat = new THREE.MeshLambertMaterial({ map: tile(T.stone, 1.4) });
  const petalMat = new THREE.MeshLambertMaterial({ map: tile(T.petals, 1) });

  const rng = mulberry(20260825);
  const clearOf = (x, z) => (
    Math.hypot(x - GROVE.x, z - GROVE.z) > 13 &&
    Math.hypot(x - SPRING.x, z - SPRING.z) > 8 &&
    Math.hypot(x, z) > 7
  );

  // flower: stem + petal blob; pickable, regrows after a while
  const stemMat = new THREE.MeshLambertMaterial({ color: 0x54793c });
  function addFlower(x, h, z, mat) {
    const g = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.55, 4), stemMat);
    stem.position.y = 0.27;
    g.add(stem);
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), mat);
    head.position.y = 0.6;
    g.add(head);
    g.position.set(x, h, z);
    scene.add(g);
    world.flowers.push({ g, x, z, picked: false, regrowAt: 0, grow: 1 });
  }

  function makeTree(s, palm, R = rng) {   // R: neighbour islands pass their own rng
    const g = new THREE.Group();
    if (palm) {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * s, 0.28 * s, 5.4 * s, 6), barkMat);
      trunk.position.y = 2.7 * s;
      trunk.rotation.z = (R() - 0.5) * 0.25;
      g.add(trunk);
      for (let i = 0; i < 6; i++) {
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.5 * s, 3.1 * s, 4), canopyMat2);
        leaf.position.y = 5.35 * s;
        leaf.rotation.z = Math.PI / 2 + 0.55;
        leaf.rotation.y = (i / 6) * Math.PI * 2;
        leaf.rotateX(0.35);
        leaf.scale.z = 0.3;
        g.add(leaf);
      }
    } else {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * s, 0.38 * s, 2.6 * s, 6), barkMat);
      trunk.position.y = 1.3 * s;
      g.add(trunk);
      const n = 2 + Math.floor(R() * 2);
      for (let i = 0; i < n; i++) {
        const r = (1.5 - i * 0.35) * s;
        const c = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), canopyMat);
        c.position.set((R() - 0.5) * 0.8 * s, (2.6 + i * 0.9) * s, (R() - 0.5) * 0.8 * s);
        g.add(c);
      }
    }
    return g;
  }

  for (let i = 0; i < 52; i++) {
    const a = rng() * Math.PI * 2, r = 12 + rng() * (ISLAND_R - 16);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const h = heightAt(x, z);
    if (h < 0.7 || !clearOf(x, z)) continue;
    const s = 0.7 + rng() * 0.8;
    const palm = rng() < 0.38;
    const tree = makeTree(s, palm);
    tree.position.set(x, h - 0.1, z);
    tree.rotation.y = rng() * Math.PI * 2;
    scene.add(tree);
    // no pinch-pairs: a gap narrower than a tapir is a trap, so keep solid
    // trunks well apart (visual tree still placed; only the collider is skipped)
    const tr = (palm ? 0.32 : 0.44) * s;
    if (!world.colliders.some((c) => Math.hypot(c.x - x, c.z - z) < c.r + tr + 2.2)) {
      world.colliders.push({ x, z, r: tr });
    }
  }

  // bushes & rocks & reeds & flowers
  for (let i = 0; i < 70; i++) {
    const a = rng() * Math.PI * 2, r = 6 + rng() * (ISLAND_R - 8);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const h = heightAt(x, z);
    if (!clearOf(x, z)) continue;
    if (h < 0.15 && h > -0.7) {
      // reeds at waterline
      const reed = new THREE.Group();
      const n = 3 + Math.floor(rng() * 4);
      for (let k = 0; k < n; k++) {
        const st = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 1.4 + rng(), 4),
          new THREE.MeshLambertMaterial({ color: 0x4f7038 }));
        st.position.set((rng() - 0.5) * 0.7, 0.7, (rng() - 0.5) * 0.7);
        reed.add(st);
        const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.3, 4),
          new THREE.MeshLambertMaterial({ color: 0x6b4a2f }));
        tip.position.set(st.position.x, st.position.y + 0.85, st.position.z);
        reed.add(tip);
      }
      reed.position.set(x, Math.max(h, -0.2), z);
      scene.add(reed);
    } else if (h > 0.4) {
      const kind = rng();
      if (kind < 0.4) {
        const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5 + rng() * 0.6, 1), canopyMat);
        bush.position.set(x, h + 0.25, z);
        bush.scale.y = 0.75;
        scene.add(bush);
      } else if (kind < 0.65) {
        const rockR = 0.3 + rng() * 0.5;
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(rockR, 0), stoneMat);
        rock.position.set(x, h + 0.15, z);
        rock.rotation.set(rng() * 3, rng() * 3, rng() * 3);
        scene.add(rock);
        if (rockR > 0.45 &&
            !world.colliders.some((c) => Math.hypot(c.x - x, c.z - z) < c.r + rockR + 2.2)) {
          world.colliders.push({ x, z, r: rockR * 0.85 });
        }
      } else {
        addFlower(x, h, z, petalMat);
      }
    }
  }

  // flower patches for necklace-making (own rng so the layout above is untouched)
  {
    const frng = mulberry(4);
    const tints = [petalMat, ...[0xffc4dc, 0xfff0a0, 0xdcc8ff].map((c) =>
      new THREE.MeshLambertMaterial({ map: petalMat.map, color: c }))];
    const centres = [[3, -9]];   // one in view from spawn
    for (let tries = 0; centres.length < 9 && tries < 200; tries++) {
      const a = frng() * Math.PI * 2, r = 10 + frng() * (ISLAND_R - 20);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (heightAt(x, z) > 0.6 && clearOf(x, z) &&
          !centres.some(([cx, cz]) => Math.hypot(cx - x, cz - z) < 12)) centres.push([x, z]);
    }
    for (const [cx, cz] of centres) {
      const mat = tints[Math.floor(frng() * tints.length)];
      for (let k = 0; k < 5; k++) {
        const x = cx + (frng() - 0.5) * 3.6, z = cz + (frng() - 0.5) * 3.6;
        const h = heightAt(x, z);
        if (h > 0.4 && world.collide(x, z, 0.3).x === x) addFlower(x, h, z, mat);
      }
    }
  }

  // ---------- Grove Gate ----------
  const grove = new THREE.Group();
  const gy = heightAt(GROVE.x, GROVE.z);
  grove.position.set(GROVE.x, gy, GROVE.z);

  // two ancient leaning trunks forming an arch
  for (const side of [-1, 1]) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 1.0, 11, 7), barkMat);
    trunk.position.set(side * 3.4, 4.8, 0);
    trunk.rotation.z = -side * 0.42;
    grove.add(trunk);
    // the trunks lean: at ground level their bases sit near ±1.16, not ±3.4
    world.colliders.push({ x: GROVE.x + side * 1.16, z: GROVE.z, r: 0.85 });
  }
  // plug the pocket between the two trunk bases — it was a wedge trap for
  // big followers (a tapir got stuck in there and broke the win condition)
  world.colliders.push({ x: GROVE.x, z: GROVE.z, r: 0.9 });
  for (const side of [-1, 1]) {
    const canopy = new THREE.Mesh(new THREE.IcosahedronGeometry(3.1, 1), canopyMat);
    canopy.position.set(side * 1.1, 10.3, 0);
    grove.add(canopy);
    const canopy2 = new THREE.Mesh(new THREE.IcosahedronGeometry(2.2, 1), canopyMat);
    canopy2.position.set(side * 3.3, 8.6, 0.6);
    grove.add(canopy2);
    // hanging moss
    for (let k = 0; k < 3; k++) {
      const moss = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.02, 1.6 + k * 0.4, 4),
        new THREE.MeshLambertMaterial({ color: 0x7fae6a }));
      moss.position.set(side * (1.5 + k * 0.9), 7.6 - k * 0.3, 0.4);
      grove.add(moss);
    }
  }

  // portal (revealed at finale; shimmer ring always)
  const portalRing = new THREE.Mesh(
    new THREE.TorusGeometry(2.6, 0.16, 10, 40),
    new THREE.MeshBasicMaterial({ color: 0x8ff7d8, transparent: true, opacity: 0.55 })
  );
  portalRing.position.y = 5.4;
  grove.add(portalRing);
  const portalDisc = new THREE.Mesh(
    new THREE.CircleGeometry(2.45, 40),
    new THREE.MeshBasicMaterial({ color: 0xbdfff0, transparent: true, opacity: 0.10, side: THREE.DoubleSide })
  );
  portalDisc.position.y = 5.4;
  grove.add(portalDisc);
  world.portalRing = portalRing;
  world.portalDisc = portalDisc;

  // rune stones circle
  const runeGeo = new THREE.CylinderGeometry(0.34, 0.5, 1.5, 5);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const rx = Math.cos(a) * 7.5, rz = Math.sin(a) * 7.5 + 2.5;
    const stone = new THREE.Mesh(runeGeo, stoneMat.clone());
    const wy = heightAt(GROVE.x + rx, GROVE.z + rz) - gy;
    stone.position.set(rx, wy + 0.7, rz);
    stone.rotation.y = rng() * 3;
    grove.add(stone);
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0x8ff7d8, transparent: true, opacity: 0.12 })
    );
    glow.position.set(rx, wy + 1.62, rz);
    grove.add(glow);
    world.runes.push({ stone, glow, lit: false, spot: new THREE.Vector3(GROVE.x + rx * 0.8, 0, GROVE.z + rz * 0.8) });
    world.colliders.push({ x: GROVE.x + rx, z: GROVE.z + rz, r: 0.6 });
  }
  scene.add(grove);
  world.grove = grove;

  // ---------- Hot spring ----------
  const spring = new THREE.Group();
  const sy = heightAt(SPRING.x, SPRING.z);
  spring.position.set(SPRING.x, sy, SPRING.z);
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(3.2, 26),
    new THREE.MeshLambertMaterial({ map: tile(T.water.clone(), 3), color: 0xcfe8ff, transparent: true, opacity: 0.9 })
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.12;
  spring.add(pool);
  world.springPool = pool;
  const nRocks = 11;
  for (let i = 0; i < nRocks; i++) {
    const a = (i / nRocks) * Math.PI * 2;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55 + rng() * 0.3, 0), stoneMat);
    rock.position.set(Math.cos(a) * 3.5, 0.25, Math.sin(a) * 3.5);
    rock.rotation.set(rng() * 3, rng() * 3, rng() * 3);
    spring.add(rock);
  }
  // yuzu oranges bobbing
  const yuzuMat = new THREE.MeshLambertMaterial({ color: 0xffb63d });
  for (let i = 0; i < 5; i++) {
    const y = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), yuzuMat);
    const a = rng() * Math.PI * 2, r = rng() * 2.2;
    y.position.set(Math.cos(a) * r, 0.22, Math.sin(a) * r);
    y.userData.phase = rng() * Math.PI * 2;
    spring.add(y);
    world.yuzu.push(y);
  }
  // steam sprites (soft radial puff texture)
  const puffCanvas = document.createElement('canvas');
  puffCanvas.width = puffCanvas.height = 64;
  const pctx = puffCanvas.getContext('2d');
  const grad = pctx.createRadialGradient(32, 32, 4, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  pctx.fillStyle = grad;
  pctx.fillRect(0, 0, 64, 64);
  const puffTex = new THREE.CanvasTexture(puffCanvas);
  const steamMat = new THREE.SpriteMaterial({ map: puffTex, transparent: true, opacity: 0.24, depthWrite: false });
  for (let i = 0; i < 8; i++) {
    const s = new THREE.Sprite(steamMat.clone());
    s.scale.set(1.6, 1.6, 1);
    s.position.set((rng() - 0.5) * 4, 0.6, (rng() - 0.5) * 4);
    s.userData.phase = rng() * 6;
    spring.add(s);
    world.steam.push(s);
  }
  scene.add(spring);
  world.spring = spring;

  // stepping stones from spawn toward grove (a gentle guide)
  for (let i = 0; i < 9; i++) {
    const t = (i + 1) / 10;
    const x = GROVE.x * t + Math.sin(i * 1.7) * 3;
    const z = -6 + (GROVE.z + 9 + 6) * t;
    const h = heightAt(x, z);
    if (h < 0.1) continue;
    const slab = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 0.16, 6),
      new THREE.MeshLambertMaterial({ map: tile(T.path.clone(), 1) }));
    slab.position.set(x, h + 0.06, z);
    slab.rotation.y = rng() * 3;
    scene.add(slab);
  }

  // ---------- chaos zones: legible stress, parked next to something you want ----------
  world.chaosZones = [
    { x: -22, z: -26, r: 6.5, kind: 'troupe', emoji: '💢',
      warning: 'The monkey troupe is having a MOMENT. The screeching frays your zen… 🐒' },
    { x: 0, z: 43, r: 6, kind: 'midges', emoji: '〰️',
      warning: 'Midges! A whining cloud of them. Grab what you came for and go. 🦟' },
  ];

  // troupe tree: one big shaking tree full of upset little monkeys (near the mango)
  {
    const zone = world.chaosZones[0];
    const ty = heightAt(zone.x, zone.z);
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 3.6, 6), barkMat);
    trunk.position.y = 1.8;
    tree.add(trunk);
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(2.1, 1), canopyMat);
    crown.position.y = 4.4;
    tree.add(crown);
    world.troupeCrown = crown;
    world.troupeMonkeys = [];
    const mMat = new THREE.MeshLambertMaterial({ color: 0x4a3a26 });
    for (let i = 0; i < 4; i++) {
      const monkey = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), mMat);
      body.scale.y = 1.2;
      monkey.add(body);
      const headM = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), mMat);
      headM.position.y = 0.22;
      monkey.add(headM);
      const tailM = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.4, 5), mMat);
      tailM.position.set(0.12, -0.05, -0.08);
      tailM.rotation.z = 0.8;
      monkey.add(tailM);
      const a = (i / 4) * Math.PI * 2 + 0.4;
      monkey.position.set(Math.cos(a) * 1.7, 4.2 + (i % 2) * 0.8, Math.sin(a) * 1.7);
      monkey.userData.phase = i * 1.7;
      tree.add(monkey);
      world.troupeMonkeys.push(monkey);
    }
    tree.position.set(zone.x, ty, zone.z);
    scene.add(tree);
    world.colliders.push({ x: zone.x, z: zone.z, r: 0.55 });
  }

  // midge cloud over the south mudflat (near the marvelous nut)
  {
    const zone = world.chaosZones[1];
    world.midges = [];
    const midgeMat = new THREE.SpriteMaterial({ color: 0x2c2418, transparent: true, opacity: 0.8, depthWrite: false });
    for (let i = 0; i < 18; i++) {
      const m = new THREE.Sprite(midgeMat.clone());
      m.scale.setScalar(0.09 + rng() * 0.07);
      m.userData = { a: rng() * Math.PI * 2, rr: 0.6 + rng() * 2.4, sp: 1.5 + rng() * 2.5, ph: rng() * 6 };
      scene.add(m);
      world.midges.push(m);
    }
  }

  // butterflies drifting over the meadows
  const bfCanvas = document.createElement('canvas');
  bfCanvas.width = bfCanvas.height = 48;
  const bctx = bfCanvas.getContext('2d');
  bctx.font = '38px serif';
  bctx.textAlign = 'center'; bctx.textBaseline = 'middle';
  bctx.fillText('🦋', 24, 26);
  const bfTex = new THREE.CanvasTexture(bfCanvas);
  world.butterflies = [];
  for (let i = 0; i < 10; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: bfTex, transparent: true, depthWrite: false }));
    const a = rng() * Math.PI * 2, r = 8 + rng() * 38;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    s.scale.setScalar(0.4);
    s.userData = { x0: x, z0: z, ph: rng() * 6, sp: 0.4 + rng() * 0.5 };
    scene.add(s);
    world.butterflies.push(s);
  }

  // ---------- the Steaming Terraces: mineral pools on the flat treads ----------
  // A pool goes wherever a tread is level across its whole disc, so the water
  // sits flush in the step. They're springs: soaking tops up zen and gives zoomies.
  world.pools = [];
  {
    const ti = ISLANDS.findIndex((I) => I.biome === 'terraces');
    const I = ISLANDS[ti];
    const poolMat = new THREE.MeshLambertMaterial({
      map: tile(T.water.clone(), 1.2), color: 0xb8f4ee, emissive: 0x2a6a66, transparent: true, opacity: 0.9,
    });
    const lipMat = new THREE.MeshLambertMaterial({ map: tile(T.travertine.clone(), 2), color: 0xfff4e4 });
    const level = (x, z, r) => {
      const h0 = heightAt(x, z);
      if (h0 < 0.9 || ownerAt(x, z) !== ti) return null;
      for (let k = 0; k < 14; k++) {
        const a = (k / 14) * Math.PI * 2;
        for (const rr of [r * 0.5, r + 0.15]) {
          const xx = x + Math.cos(a) * rr, zz = z + Math.sin(a) * rr;
          if (Math.abs(heightAt(xx, zz) - h0) > 0.035 || ownerAt(xx, zz) !== ti) return null;
        }
      }
      return h0;
    };
    // scan outward from the middle so the top treads get pools first
    const cands = [];
    for (let gx = -I.rx; gx <= I.rx; gx += 1) {
      for (let gz = -I.rz; gz <= I.rz; gz += 1) {
        const x = I.x + gx * I.cos - gz * I.sin, z = I.z + gx * I.sin + gz * I.cos;
        cands.push({ x, z, d: Math.hypot(gx, gz) });
      }
    }
    cands.sort((a, b) => a.d - b.d);
    for (const c of cands) {
      if (world.pools.length >= 6) break;
      for (const r of [2.4, 1.9, 1.5, 1.2]) {
        if (world.pools.some((p) => Math.hypot(p.x - c.x, p.z - c.z) < p.r + r + 3)) continue;
        const h = level(c.x, c.z, r);
        if (h === null) continue;
        world.pools.push({ x: c.x, z: c.z, r, h });
        break;
      }
    }
    for (const p of world.pools) {
      const g = new THREE.Group();
      g.position.set(p.x, p.h, p.z);
      const water = new THREE.Mesh(new THREE.CircleGeometry(p.r, 28), poolMat);
      water.rotation.x = -Math.PI / 2;
      water.position.y = 0.07;
      g.add(water);
      // a low scalloped rim of mineral crust
      const lip = new THREE.Mesh(new THREE.TorusGeometry(p.r + 0.05, 0.16, 5, 28), lipMat);
      lip.rotation.x = -Math.PI / 2;
      lip.scale.z = 0.55;
      lip.position.y = 0.06;
      g.add(lip);
      for (let i = 0; i < 3; i++) {
        const st = new THREE.Sprite(steamMat.clone());
        st.scale.set(1.3 + p.r * 0.2, 1.3 + p.r * 0.2, 1);
        st.position.set((i - 1) * p.r * 0.45, 0.6, ((i * 7) % 3 - 1) * p.r * 0.3);
        st.userData.phase = i * 1.05 + p.x * 0.37;
        g.add(st);
        world.steam.push(st);
      }
      scene.add(g);
      p.group = g;
    }
  }

  // ---------- the Rice Paddies: rice in rows, lily pads, a lotus or two ----------
  {
    const { CELL, fields, perches, island: I } = PADDY;
    const R = mulberry(7717);
    // a painted decal of seedlings just above the water in every planted field…
    const riceTex = T.rice.clone();
    riceTex.wrapS = riceTex.wrapT = THREE.RepeatWrapping;
    riceTex.repeat.set(1.6, 1.6);
    riceTex.colorSpace = THREE.SRGBColorSpace;
    const decalMat = new THREE.MeshLambertMaterial({ map: riceTex, transparent: true, alphaTest: 0.3, depthWrite: false });
    const decalGeo = new THREE.PlaneGeometry(CELL - 1.2, CELL - 1.2).rotateX(-Math.PI / 2);
    // …and real tufts standing in rows, so the fields have height from a distance
    const tuftGeo = (() => {
      const parts = [];
      for (let k = 0; k < 5; k++) {
        const c = new THREE.ConeGeometry(0.05, 0.6 + (k % 2) * 0.18, 3).toNonIndexed();
        c.translate(0, 0.28, 0);
        c.rotateZ(0.32 * Math.cos(k * 1.26));
        c.rotateX(0.32 * Math.sin(k * 1.26));
        parts.push(c);
      }
      const n = parts.reduce((a, c) => a + c.attributes.position.count, 0);
      const pos = new Float32Array(n * 3);
      let o = 0;
      for (const c of parts) { pos.set(c.attributes.position.array, o); o += c.attributes.position.array.length; }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.computeVertexNormals();
      return g;
    })();
    const planted = fields.filter((f) => f.planted);
    const ROW = 0.62, PER = Math.floor((CELL - 1.6) / ROW) + 1;
    const tufts = new THREE.InstancedMesh(tuftGeo, new THREE.MeshLambertMaterial({ color: 0xa6e65c }),
      planted.length * PER * PER);
    const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    let ti = 0;
    for (const f of planted) {
      if (f.whole) {   // (an edge field's decal would hang over its bund)
        const decal = new THREE.Mesh(decalGeo, decalMat);
        decal.position.set(f.x, 0.035, f.z);
        decal.rotation.y = -I.rot;
        scene.add(decal);
      }
      for (let a = 0; a < PER; a++) {
        for (let b = 0; b < PER; b++) {
          const p = PADDY.toWorld(f.lx - (CELL - 1.6) / 2 + a * ROW + (R() - 0.5) * 0.12,
            f.lz - (CELL - 1.6) / 2 + b * ROW + (R() - 0.5) * 0.12);
          const h = heightAt(p.x, p.z);
          const rr = R(), k = 0.8 + R() * 0.45;
          if (h > -0.03) continue;   // rice only grows in the water
          v.set(p.x, h, p.z);
          q4.setFromEuler(e.set(0, rr * 6.3, 0));
          sc.set(k, k, k);
          tufts.setMatrixAt(ti++, m4.compose(v, q4, sc));
        }
      }
    }
    tufts.count = ti;
    scene.add(tufts);
    world.riceTufts = tufts;

    // lily pads float in the unplanted fields (and under each frog perch)
    const lilyTex = T.lilypad.clone();
    lilyTex.colorSpace = THREE.SRGBColorSpace;
    const pads = [];
    for (const f of fields.filter((ff) => !ff.planted)) {
      for (let k = 0; k < 9; k++) {
        const p = PADDY.toWorld(f.lx + (R() - 0.5) * (CELL - 2.2), f.lz + (R() - 0.5) * (CELL - 2.2));
        const r = 0.45 + R() * 0.4;
        // the whole pad has to float on water, not lap onto a bund
        const wet = [0, 1, 2, 3, 4, 5].every((k) => heightAt(p.x + Math.cos(k * 1.05) * r, p.z + Math.sin(k * 1.05) * r) < -0.05);
        if (!wet || heightAt(p.x, p.z) > -0.05 || pads.some((o) => Math.hypot(o.x - p.x, o.z - p.z) < o.r + r)) continue;
        pads.push({ x: p.x, z: p.z, r, rot: R() * 6.3 });
      }
    }
    for (const p of perches) pads.push({ x: p.x, z: p.z, r: 0.95, rot: R() * 6.3, perch: true });
    const padMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2),
      new THREE.MeshLambertMaterial({ map: lilyTex, alphaTest: 0.5, side: THREE.DoubleSide }), pads.length);
    pads.forEach((p, i) => {
      v.set(p.x, 0.03 + (i % 3) * 0.002, p.z);
      q4.setFromEuler(e.set(0, p.rot, 0));
      sc.set(p.r, 1, p.r);
      padMesh.setMatrixAt(i, m4.compose(v, q4, sc));
    });
    scene.add(padMesh);
    world.lilyPads = pads;
    // a few pink lotus flowers sitting on pads
    const lotusMat = new THREE.MeshLambertMaterial({ map: petalMat.map, color: 0xffc4dc });
    for (const p of pads.filter((pp) => !pp.perch && pp.r > 0.7).slice(0, 7)) {
      const lotus = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0), lotusMat);
      lotus.position.set(p.x + 0.15, 0.17, p.z - 0.1);
      lotus.scale.y = 0.7;
      scene.add(lotus);
    }
  }

  // ---------- the Riverbank: a flowing river surface, boulders, drifting leaves ----------
  {
    const I = RIVER;
    const L0 = -(I.rz + I.shore * 1.5), L1 = -L0, SEG = 90, HALF = 7;
    const toW = (lx, lz) => [I.x + lx * I.cos - lz * I.sin, I.z + lx * I.sin + lz * I.cos];
    // a ribbon along the centre line, just above the sea plane. Banks hide
    // its edges (they're above it); alpha fades it out at the sides and mouths.
    const pos = [], uv = [], col = [], idx = [];
    for (let i = 0; i <= SEG; i++) {
      const lz = L0 + (L1 - L0) * (i / SEG), c = riverCentre(lz);
      const endA = smooth(clamp01((L1 - Math.abs(lz)) / 8));
      for (const [side, u] of [[-1, 0], [-0.55, 0.22], [0.55, 0.78], [1, 1]]) {
        const [x, z] = toW(c + side * HALF, lz);
        pos.push(x, 0.03, z);
        uv.push(u * 1.6, (lz - L0) / 7);
        col.push(1, 1, 1, (Math.abs(side) === 1 ? 0 : 0.6) * endA);
      }
    }
    for (let i = 0; i < SEG; i++) {
      for (let j = 0; j < 3; j++) {
        const a = i * 4 + j, b = a + 4;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const riverTex = T.water.clone();
    riverTex.wrapS = riverTex.wrapT = THREE.RepeatWrapping;
    riverTex.colorSpace = THREE.SRGBColorSpace;
    const river = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({
      map: riverTex, color: 0xcfe6c4, vertexColors: true, transparent: true, depthWrite: false,
    }));
    river.renderOrder = 1;
    scene.add(river);
    world.riverTex = riverTex;

    // a few big boulders mid-stream: something to bump into, or rest against
    for (const [lz, off] of [[-14, 0.4], [3, -0.6], [17, 0.3]]) {
      const [x, z] = toW(riverCentre(lz) + off, lz);
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.25, 0), stoneMat);
      rock.position.set(x, -0.35, z);
      rock.rotation.set(lz, lz * 0.7, 0.3);
      rock.scale.y = 0.85;
      scene.add(rock);
      world.colliders.push({ x, z, r: 1.15 });
    }

    // leaves riding the current from one mouth to the other
    const leafMat = new THREE.MeshLambertMaterial({ map: canopyMat.map, color: 0xc8e890, side: THREE.DoubleSide });
    const leafGeo = new THREE.CircleGeometry(0.22, 7).rotateX(-Math.PI / 2).scale(1, 1, 1.8);
    const LR = mulberry(4242);
    world.leaves = [];
    for (let i = 0; i < 16; i++) {
      const m = new THREE.Mesh(leafGeo, i % 4 ? leafMat : petalMat);
      m.userData = { s: LR(), off: (LR() - 0.5) * 3.2, spin: (LR() - 0.5) * 1.5, sp: 0.75 + LR() * 0.4 };
      scene.add(m);
      world.leaves.push(m);
    }
    world.river = { L0, L1, toW };
  }

  // ---------- neighbour islands: trees, bushes, rocks, reeds ----------
  // Each island has its own rng, so the home layout above (and everything
  // below that still draws from `rng`) is exactly what it always was.
  const reedMat = new THREE.MeshLambertMaterial({ color: 0x4f7038 });
  const reedTipMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2f });
  const DENSITY = { terraces: 0.018, paddies: 0.035, riverbank: 0.045, islet: 0 };
  world.calmSpots = [{ x: 0, z: 4, island: 'home' }, { x: SPRING.x, z: SPRING.z, island: 'home' }];
  for (let i = 1; i < ISLANDS.length; i++) {
    const I = ISLANDS[i];
    const R = mulberry(9000 + I.seed);
    const pick = (qMax) => {
      const a = R() * Math.PI * 2, q = Math.sqrt(R()) * qMax;
      const lx = Math.cos(a) * q * I.rx, lz = Math.sin(a) * q * I.rz;
      return { x: I.x + lx * I.cos - lz * I.sin, z: I.z + lx * I.sin + lz * I.cos };
    };
    // keep pools and the paddies' critter spots free of trees and rocks
    const keepClear = [...PADDY.herd, PADDY.turtle].map((c) => ({ ...c, r: 1.2 }));
    const inPool = (x, z, pad) => world.pools.some((p) => Math.hypot(p.x - x, p.z - z) < p.r + pad) ||
      keepClear.some((p) => Math.hypot(p.x - x, p.z - z) < p.r + pad);
    const solidNear = (x, z, r) => world.colliders.some((c) => Math.hypot(c.x - x, c.z - z) < c.r + r + 2.2);
    const nTrees = I.biome === 'islet' ? 0 : Math.round(I.rx * I.rz * DENSITY[I.biome]);
    let placed = 0;
    for (let k = 0; k < nTrees * 3 && placed < nTrees; k++) {    // up to 3 tries per tree
      const { x, z } = pick(0.92);
      const h = heightAt(x, z);
      if (h < 0.7 || ownerAt(x, z) !== i || inPool(x, z, 1.5)) continue;
      const s = 0.7 + R() * 0.8;
      const palm = R() < (I.biome === 'paddies' ? 0.6 : 0.3);
      const tree = makeTree(s, palm, R);
      tree.position.set(x, h - 0.1, z);
      tree.rotation.y = R() * Math.PI * 2;
      scene.add(tree);
      const tr = (palm ? 0.32 : 0.44) * s;
      if (!solidNear(x, z, tr)) world.colliders.push({ x, z, r: tr });
      placed++;
    }
    if (I.biome === 'islet') {
      // one leaning palm on the crown of every islet
      const tree = makeTree(1, true, R);
      tree.position.set(I.x + 1, heightAt(I.x + 1, I.z) - 0.1, I.z);
      tree.rotation.y = R() * Math.PI * 2;
      scene.add(tree);
      world.colliders.push({ x: I.x + 1, z: I.z, r: 0.32 });
    }
    const nSmall = Math.round(I.rx * I.rz * (I.biome === 'islet' ? 0.3 : 0.06));
    for (let k = 0; k < nSmall; k++) {
      const { x, z } = pick(1.05);
      if (ownerAt(x, z) !== i || inPool(x, z, 0.8)) continue;
      const h = heightAt(x, z);
      if (h < 0.15 && h > -0.7 && I.biome !== 'paddies') {
        const reed = new THREE.Group();
        const n = 3 + Math.floor(R() * 4);
        for (let m = 0; m < n; m++) {
          const st = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 1.4 + R(), 4), reedMat);
          st.position.set((R() - 0.5) * 0.7, 0.7, (R() - 0.5) * 0.7);
          reed.add(st);
          const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.3, 4), reedTipMat);
          tip.position.set(st.position.x, st.position.y + 0.85, st.position.z);
          reed.add(tip);
        }
        reed.position.set(x, Math.max(h, -0.2), z);
        scene.add(reed);
      } else if (h > 0.4) {
        const kind = R();
        if (kind < 0.5 && I.biome !== 'islet') {
          const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5 + R() * 0.6, 1), canopyMat);
          bush.position.set(x, h + 0.25, z);
          bush.scale.y = 0.75;
          scene.add(bush);
        } else {
          const rockR = 0.3 + R() * (I.biome === 'terraces' || I.biome === 'islet' ? 0.7 : 0.5);
          const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(rockR, 0), stoneMat);
          rock.position.set(x, h + 0.15, z);
          rock.rotation.set(R() * 3, R() * 3, R() * 3);
          scene.add(rock);
          if (rockR > 0.45 && !solidNear(x, z, rockR)) world.colliders.push({ x, z, r: rockR * 0.85 });
        }
      }
    }
    // a calm spot to wander back to after a stress-out: the open dry ground
    // nearest the island's middle
    if (I.biome !== 'islet') {
      let spot = null;
      for (let r = 0; r < I.rm && !spot; r += 1) {
        for (let a = 0; a < Math.PI * 2 && !spot; a += 0.4) {
          const x = I.x + Math.cos(a) * r, z = I.z + Math.sin(a) * r;
          if (heightAt(x, z) > 0.3 && ownerAt(x, z) === i &&
              !world.colliders.some((c) => Math.hypot(c.x - x, c.z - z) < c.r + 1.5)) spot = { x, z, island: I.id };
        }
      }
      if (spot) world.calmSpots.push(spot);
    }
  }

  // warm water that tops up zen (and gives zoomies): the home spring and the terrace pools
  world.springs = [{ x: SPRING.x, z: SPRING.z, r: 3.4,
    line: 'Ahh… yuzu warmth soaks in. Zoomies unlocked! ⚡' }];
  for (const p of world.pools) {
    world.springs.push({ x: p.x, z: p.z, r: p.r + 0.3, pool: p,
      line: 'Milky mineral water, hot and fizzy. Every muscle melts. Zoomies unlocked! ♨️⚡' });
  }
  // the spring you're soaking in, or null
  world.springAt = (x, z) => world.springs.find((s) => Math.hypot(x - s.x, z - s.z) < s.r) || null;
  // distance to the nearest spring, scaled so `< 3.4` means "in the water" for any pool size
  world.springDist = (x, z) => {
    let best = Infinity;
    for (const s of world.springs) best = Math.min(best, Math.hypot(x - s.x, z - s.z) * 3.4 / s.r);
    return best;
  };
  world.islandAt = islandAt;
  world.currentAt = currentAt;

  // update hook
  let wt = 0;
  world.update = (dt, t) => {
    wt = t;
    T.water.offset.set(t * 0.008, t * 0.011);
    portalRing.rotation.z = t * 0.4;
    const pulse = 0.5 + 0.5 * Math.sin(t * 2);
    portalRing.material.opacity = world.portalOpen ? 0.95 : 0.35 + pulse * 0.25;
    // picked flowers pop back up
    for (const f of world.flowers) {
      if (f.picked && t > f.regrowAt) { f.picked = false; f.grow = 0; f.g.visible = true; }
      if (!f.picked && f.grow < 1) {
        f.grow = Math.min(1, f.grow + dt * 1.5);
        const k = f.grow;
        f.g.scale.setScalar(Math.max(0.01, k + 0.35 * Math.sin(k * Math.PI)));   // little overshoot pop
      }
    }
    // the river runs: texture scrolls downstream, leaves ride the current
    world.riverTex.offset.y = -t * CURRENT_MAX / 7 * 0.8;
    {
      const { L0, L1, toW } = world.river, span = L1 - L0;
      for (const m of world.leaves) {
        const u = m.userData;
        const lz = L0 + (((u.s * span + t * CURRENT_MAX * 0.8 * u.sp) % span) + span) % span;
        const [x, z] = toW(riverCentre(lz) + u.off, lz);
        m.position.set(x, 0.06 + Math.sin(t * 2 + u.s * 9) * 0.02, z);
        m.rotation.y = t * u.spin + u.s * 6;
        // hide while out past the mouths, where the ribbon has faded
        m.visible = Math.abs(lz) < L1 - 6;
      }
    }
    for (const y of world.yuzu) y.position.y = 0.2 + Math.sin(t * 1.6 + y.userData.phase) * 0.06;
    for (const s of world.steam) {
      const p = (t * 0.35 + s.userData.phase) % 3;
      s.position.y = 0.5 + p * 1.2;
      s.material.opacity = 0.26 * (1 - p / 3);
    }
    for (const b of world.butterflies) {
      const u = b.userData;
      const x = u.x0 + Math.sin(t * u.sp + u.ph) * 6 + Math.sin(t * 1.7 + u.ph * 2) * 0.8;
      const z = u.z0 + Math.cos(t * u.sp * 0.8 + u.ph) * 6;
      b.position.set(x, Math.max(heightAt(x, z), 0) + 1 + Math.sin(t * 2.3 + u.ph) * 0.4, z);
    }
    // troupe tree shakes; monkeys hop with indignation
    if (world.troupeCrown) {
      world.troupeCrown.rotation.z = Math.sin(t * 9) * 0.045;
      world.troupeCrown.rotation.x = Math.cos(t * 7.3) * 0.04;
      for (const m of world.troupeMonkeys) {
        m.position.y = 4.2 + (Math.abs(Math.sin(t * 5 + m.userData.phase))) * 0.5;
        m.rotation.y = Math.sin(t * 3 + m.userData.phase) * 0.8;
      }
    }
    // midges swirl
    if (world.midges) {
      const zone = world.chaosZones[1];
      const zy = Math.max(heightAt(zone.x, zone.z), 0);
      for (const m of world.midges) {
        const u = m.userData;
        u.a += u.sp * 0.016;
        m.position.set(
          zone.x + Math.cos(u.a + u.ph) * u.rr,
          zy + 1 + Math.sin(t * 3 + u.ph) * 0.5,
          zone.z + Math.sin(u.a * 1.3 + u.ph) * u.rr
        );
      }
    }
  };

  return world;
}
