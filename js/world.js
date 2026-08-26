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

function falloff(d, r) {
  if (d >= r) return 0;
  const t = 1 - d / r;
  return smooth(t);
}

export function heightAt(x, z) {
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

export function isWater(x, z) { return heightAt(x, z) < 0.02; }

// ---------- texture helper ----------
export function tile(tex, n) {
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(n, n);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

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

  // terrain
  const SEG = 130, SIZE = 170;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cGrass = new THREE.Color(0xffffff);
  const cSand = new THREE.Color(0xe8c98f);
  const cDeep = new THREE.Color(0x7a8f6a);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);
    if (h < 0.35) tmp.lerpColors(cDeep, cSand, Math.min(1, Math.max(0, (h + 1.2) / 1.55)));
    else tmp.copy(cGrass).lerp(cSand, Math.max(0, 1 - (h - 0.35) / 0.5) * 0.55);
    colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const terrain = new THREE.Mesh(
    geo,
    new THREE.MeshLambertMaterial({ map: tile(T.grass, 26), vertexColors: true })
  );
  scene.add(terrain);

  // water
  const waterMat = new THREE.MeshLambertMaterial({
    map: tile(T.water, 11), transparent: true, opacity: 0.85,
    color: 0xd6e2bc,
  });
  T.water.anisotropy = 16;
  const water = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), waterMat);
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

  function makeTree(s, palm) {
    const g = new THREE.Group();
    if (palm) {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * s, 0.28 * s, 5.4 * s, 6), barkMat);
      trunk.position.y = 2.7 * s;
      trunk.rotation.z = (rng() - 0.5) * 0.25;
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
      const n = 2 + Math.floor(rng() * 2);
      for (let i = 0; i < n; i++) {
        const r = (1.5 - i * 0.35) * s;
        const c = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), canopyMat);
        c.position.set((rng() - 0.5) * 0.8 * s, (2.6 + i * 0.9) * s, (rng() - 0.5) * 0.8 * s);
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
        // flower: stem + petal blob
        const f = new THREE.Group();
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.55, 4),
          new THREE.MeshLambertMaterial({ color: 0x54793c }));
        stem.position.y = 0.27;
        f.add(stem);
        const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), petalMat);
        head.position.y = 0.6;
        f.add(head);
        f.position.set(x, h, z);
        scene.add(f);
        world.flowers.push(head);
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

  // update hook
  let wt = 0;
  world.update = (dt, t) => {
    wt = t;
    T.water.offset.set(t * 0.008, t * 0.011);
    portalRing.rotation.z = t * 0.4;
    const pulse = 0.5 + 0.5 * Math.sin(t * 2);
    portalRing.material.opacity = world.portalOpen ? 0.95 : 0.35 + pulse * 0.25;
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
  };

  return world;
}
