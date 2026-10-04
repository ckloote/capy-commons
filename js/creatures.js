// creatures.js — capybara + friend builders from primitives with Gemini textures
import * as THREE from 'three';

function mat(tex, tint) {
  // clone so creature UV tiling doesn't affect world materials (image is shared)
  const t = tex.clone();
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2.5, 2.5);
  t.needsUpdate = true;
  const m = new THREE.MeshLambertMaterial({ map: t });
  if (tint) m.color.set(tint);
  return m;
}
function solid(color) { return new THREE.MeshLambertMaterial({ color }); }
const EYE = new THREE.MeshLambertMaterial({ color: 0x1c1410 });

function eye(r = 0.06) { return new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), EYE); }

// Creature: group + generic idle/walk animation over stored legs
export class Creature {
  constructor(group, opts = {}) {
    this.group = group;
    this.shadowR = opts.shadowR ?? 0.9;
    this.shadow = blobShadow(this.shadowR);
    group.add(this.shadow);
    this.legs = opts.legs || [];
    this.bobPart = opts.bobPart || null;   // body that bobs
    this.bobAmp = opts.bobAmp ?? 0.03;
    this.baseY = opts.baseY ?? 0;          // group y offset above ground
    this.tail = opts.tail || null;
    this.head = opts.head || null;
    this.phase = Math.random() * Math.PI * 2;
    this.speedMul = opts.speedMul ?? 1;
    this.swimSink = opts.swimSink ?? 0.4;  // group y below the surface when afloat
    this.swimming = false;                 // set by the mover each frame
    this.neck = opts.neck || null;         // { y, z, r, tilt, squash } necklace anchor
    this.necklace = null;
    this.moving = 0; // smoothed 0..1
  }
  wearNecklace() {
    if (this.necklace || !this.neck) return false;
    const { y, z, r, tilt = 0, squash = 1 } = this.neck;
    const n = makeNecklace(r);
    n.position.set(0, y, z);
    n.rotation.x = tilt;     // tip the ring's axis forward to follow the neck
    n.scale.z = squash;      // flatten for wide, low necks (caiman)
    this.group.add(n);
    this.necklace = n;
    return true;
  }
  update(dt, t, moving) {
    this.moving += ((moving ? 1 : 0) - this.moving) * Math.min(1, dt * 8);
    const m = this.moving;
    if (this.swimming) {
      // legs are hidden underwater; just a slow float bob
      if (this.bobPart) {
        this.bobPart.position.y = this.bobPart.userData.y0 + Math.sin(t * 1.8 + this.phase) * 0.04;
      }
      if (this.tail) this.tail.rotation.y = Math.sin(t * 3 + this.phase) * 0.3;
      if (this.head) this.head.rotation.x = Math.sin(t * 0.7 + this.phase) * 0.06;
      return;
    }
    const w = t * 10 * this.speedMul + this.phase;
    for (let i = 0; i < this.legs.length; i++) {
      const dir = i % 2 === 0 ? 1 : -1;
      this.legs[i].rotation.x = Math.sin(w + (i < 2 ? 0 : Math.PI)) * 0.55 * m * dir;
    }
    if (this.bobPart) {
      this.bobPart.position.y = this.bobPart.userData.y0 +
        Math.sin(t * 2 + this.phase) * this.bobAmp * (1 - m) +
        Math.abs(Math.sin(w)) * 0.05 * m;
    }
    if (this.tail) this.tail.rotation.y = Math.sin(t * 3 + this.phase) * 0.3;
    if (this.head) this.head.rotation.x = Math.sin(t * 0.7 + this.phase) * 0.06;
  }
}

let shadowTex = null;
function blobShadow(r) {
  if (!shadowTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
    g.addColorStop(0, 'rgba(20,14,6,0.42)');
    g.addColorStop(1, 'rgba(20,14,6,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    shadowTex = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(r, 18),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.06;
  m.renderOrder = 1;
  return m;
}

// flower necklace: a ring of little petal beads in mixed colours
const LEI_COLORS = [0xff8fb0, 0xffe066, 0xfff4e8, 0xff9a5c, 0xc9a2ff];
let leiMats = null, beadGeo = null;
export function makeNecklace(r) {
  if (!leiMats) {
    leiMats = LEI_COLORS.map((c) => new THREE.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: 0.18 }));
    beadGeo = new THREE.IcosahedronGeometry(1, 0);
  }
  const g = new THREE.Group();
  const n = Math.max(10, Math.round(r * 46));
  const off = Math.floor(Math.random() * leiMats.length);
  const br = Math.max(0.04, r * 0.22);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const b = new THREE.Mesh(beadGeo, leiMats[(i + off) % leiMats.length]);
    b.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    b.scale.set(br, br * 0.75, br);
    b.rotation.set(i * 1.3, i * 2.1, 0);
    g.add(b);
  }
  return g;
}

function leg(matl, r, h) {
  const pivot = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.8, h, 6), matl);
  mesh.position.y = -h / 2;
  pivot.add(mesh);
  return pivot;
}

// ---------- Capybara (player, and cousin variant) ----------
export function makeCapybara(T, scale = 1) {
  const fur = mat(T.fur_capy);
  const g = new THREE.Group();

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 0.75, 6, 12), fur);
  body.rotation.z = Math.PI / 2;
  body.rotation.y = Math.PI / 2;
  body.position.y = 0.62;
  body.scale.set(1, 1, 1.05);
  body.userData.y0 = 0.62;
  g.add(body);

  const head = new THREE.Group();
  head.position.set(0, 0.88, 0.62);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 10), fur);
  skull.scale.set(0.85, 0.85, 1);
  head.add(skull);
  const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.26, 0.34, 10), fur);
  muzzle.rotation.x = Math.PI / 2;
  muzzle.position.set(0, -0.03, 0.34);
  head.add(muzzle);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), solid(0x3a2a1c));
  nose.scale.set(1.4, 0.7, 0.6);
  nose.position.set(0, 0.04, 0.52);
  head.add(nose);
  for (const s of [-1, 1]) {
    const e = eye(0.055); e.position.set(s * 0.19, 0.13, 0.2); head.add(e);
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), fur);
    ear.scale.set(0.7, 0.85, 0.45);
    ear.position.set(s * 0.19, 0.28, -0.06);
    head.add(ear);
  }
  g.add(head);

  const legs = [];
  for (const [sx, sz] of [[-0.3, 0.42], [0.3, 0.42], [-0.3, -0.42], [0.3, -0.42]]) {
    const L = leg(fur, 0.11, 0.42);
    L.position.set(sx, 0.42, sz);
    g.add(L); legs.push(L);
  }

  g.scale.setScalar(scale);
  return new Creature(g, { legs, bobPart: body, head, baseY: 0, shadowR: 1.0, swimSink: 0.45 });
}

// ---------- Tapir ----------
export function makeTapir(T) {
  const hide = mat(T.fur_dark);
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.62, 1.1, 6, 12), hide);
  body.rotation.z = Math.PI / 2; body.rotation.y = Math.PI / 2;
  body.position.y = 0.85; body.userData.y0 = 0.85;
  g.add(body);
  const head = new THREE.Group();
  head.position.set(0, 1.12, 0.95);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 10), hide);
  skull.scale.set(0.8, 0.8, 1);
  head.add(skull);
  const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.22, 0.5, 8), hide);
  snout.rotation.x = Math.PI / 2 + 0.5;
  snout.position.set(0, -0.04, 0.42);
  head.add(snout);
  for (const s of [-1, 1]) {
    const e = eye(0.06); e.position.set(s * 0.22, 0.12, 0.22); head.add(e);
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), hide);
    ear.scale.set(0.7, 1, 0.4);
    ear.position.set(s * 0.24, 0.36, -0.08);
    head.add(ear);
  }
  g.add(head);
  const legs = [];
  for (const [sx, sz] of [[-0.35, 0.6], [0.35, 0.6], [-0.35, -0.6], [0.35, -0.6]]) {
    const L = leg(hide, 0.13, 0.6);
    L.position.set(sx, 0.6, sz);
    g.add(L); legs.push(L);
  }
  return new Creature(g, { legs, bobPart: body, head, shadowR: 1.3, swimSink: 0.8,
    neck: { y: 1.0, z: 1.0, r: 0.46, tilt: 1.0 } });
}

// ---------- Heron ----------
export function makeHeron(T) {
  const plume = mat(T.feathers_heron);
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 10), plume);
  body.scale.set(0.8, 0.85, 1.25);
  body.position.y = 1.05; body.userData.y0 = 1.05;
  g.add(body);
  // neck: two segments
  const neck1 = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.55, 8), plume);
  neck1.position.set(0, 1.42, 0.32); neck1.rotation.x = 0.5;
  g.add(neck1);
  const neck2 = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.5, 8), plume);
  neck2.position.set(0, 1.78, 0.38); neck2.rotation.x = -0.25;
  g.add(neck2);
  const head = new THREE.Group();
  head.position.set(0, 2.02, 0.42);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), plume);
  skull.scale.set(0.8, 0.8, 1.1);
  head.add(skull);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.55, 8), solid(0xd9a13c));
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0, 0.35);
  head.add(beak);
  const crest = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.3, 6), solid(0x2e3b4a));
  crest.rotation.x = -Math.PI / 2 - 0.5;
  crest.position.set(0, 0.1, -0.16);
  head.add(crest);
  for (const s of [-1, 1]) { const e = eye(0.045); e.position.set(s * 0.1, 0.05, 0.1); head.add(e); }
  g.add(head);
  const legs = [];
  for (const sx of [-0.12, 0.12]) {
    const L = leg(solid(0x5a4a30), 0.035, 0.85);
    L.position.set(sx, 0.85, 0);
    g.add(L); legs.push(L);
  }
  return new Creature(g, { legs, bobPart: body, head, bobAmp: 0.02, speedMul: 0.8, shadowR: 0.6, swimSink: 0.95,
    neck: { y: 1.3, z: 0.27, r: 0.15, tilt: 0.5 } });
}

// ---------- Otter ----------
export function makeOtter(T) {
  const fur = mat(T.fur_otter);
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.7, 6, 10), fur);
  body.rotation.z = Math.PI / 2; body.rotation.y = Math.PI / 2;
  body.rotation.x = -0.35;
  body.position.y = 0.42; body.userData.y0 = 0.42;
  g.add(body);
  const head = new THREE.Group();
  head.position.set(0, 0.78, 0.42);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), fur);
  head.add(skull);
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), mat(T.fur_otter, 0xffe8cc));
  muzzle.position.set(0, -0.04, 0.16);
  head.add(muzzle);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), solid(0x241a12));
  nose.position.set(0, 0.0, 0.26);
  head.add(nose);
  for (const s of [-1, 1]) {
    const e = eye(0.04); e.position.set(s * 0.1, 0.08, 0.14); head.add(e);
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), fur);
    ear.position.set(s * 0.14, 0.16, -0.02);
    head.add(ear);
  }
  g.add(head);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.75, 8), fur);
  tail.rotation.x = Math.PI / 2 + 0.5;
  tail.position.set(0, 0.22, -0.55);
  g.add(tail);
  const legs = [];
  for (const [sx, sz] of [[-0.16, 0.22], [0.16, 0.22], [-0.16, -0.25], [0.16, -0.25]]) {
    const L = leg(fur, 0.06, 0.22);
    L.position.set(sx, 0.22, sz);
    g.add(L); legs.push(L);
  }
  return new Creature(g, { legs, bobPart: body, head, tail, speedMul: 1.3, shadowR: 0.65, swimSink: 0.4,
    neck: { y: 0.58, z: 0.42, r: 0.25, tilt: 1.2 } });
}

// ---------- Mallard duck & duckling ----------
export function makeDuck(T) {
  const plume = mat(T.feathers_duck);
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), plume);
  body.scale.set(0.85, 0.8, 1.25);
  body.position.y = 0.38; body.userData.y0 = 0.38;
  g.add(body);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.25, 6), plume);
  tail.rotation.x = -Math.PI / 2 - 0.6;
  tail.position.set(0, 0.5, -0.34);
  g.add(tail);
  const head = new THREE.Group();
  head.position.set(0, 0.72, 0.26);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), solid(0x2e6b3a));
  head.add(skull);
  const beak = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 0.18, 8), solid(0xe8b83a));
  beak.rotation.x = Math.PI / 2;
  beak.scale.y = 0.6; beak.scale.x = 1.3;
  beak.position.set(0, -0.02, 0.19);
  head.add(beak);
  for (const s of [-1, 1]) { const e = eye(0.035); e.position.set(s * 0.09, 0.05, 0.09); head.add(e); }
  g.add(head);
  const legs = [];
  for (const sx of [-0.1, 0.1]) {
    const L = leg(solid(0xe8983a), 0.03, 0.2);
    L.position.set(sx, 0.2, 0.05);
    g.add(L); legs.push(L);
  }
  return new Creature(g, { legs, bobPart: body, head, bobAmp: 0.02, speedMul: 1.4, shadowR: 0.5, swimSink: 0.22,
    neck: { y: 0.58, z: 0.25, r: 0.14, tilt: 0.3 } });
}

export function makeDuckling() {
  const fluff = solid(0xf5d34a);
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), fluff);
  body.scale.set(0.9, 0.85, 1.15);
  body.position.y = 0.17; body.userData.y0 = 0.17;
  g.add(body);
  const head = new THREE.Group();
  head.position.set(0, 0.32, 0.1);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), fluff);
  head.add(skull);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.08, 6), solid(0xe8983a));
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, -0.01, 0.1);
  head.add(beak);
  for (const s of [-1, 1]) { const e = eye(0.022); e.position.set(s * 0.05, 0.03, 0.06); head.add(e); }
  g.add(head);
  const legs = [];
  for (const sx of [-0.05, 0.05]) {
    const L = leg(solid(0xe8983a), 0.018, 0.09);
    L.position.set(sx, 0.09, 0.02);
    g.add(L); legs.push(L);
  }
  return new Creature(g, { legs, bobPart: body, head, bobAmp: 0.015, speedMul: 2.2, shadowR: 0.25, swimSink: 0.1 });
}

// ---------- Squirrel monkey ----------
export function makeMonkey(T) {
  const fur = mat(T.fur_otter, 0xd8c860);
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.3, 6, 10), fur);
  body.position.y = 0.45; body.userData.y0 = 0.45;
  g.add(body);
  const head = new THREE.Group();
  head.position.set(0, 0.78, 0.05);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), mat(T.fur_dark, 0x776644));
  head.add(skull);
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), solid(0xf2e2c8));
  face.scale.set(1.1, 1, 0.5);
  face.position.set(0, -0.01, 0.1);
  head.add(face);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), solid(0x241a12));
  nose.position.set(0, -0.02, 0.15);
  head.add(nose);
  for (const s of [-1, 1]) {
    const e = eye(0.032); e.position.set(s * 0.05, 0.04, 0.13); head.add(e);
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 5), solid(0xf2e2c8));
    ear.position.set(s * 0.14, 0.03, -0.02);
    head.add(ear);
  }
  g.add(head);
  // long curled tail from segments
  const tail = new THREE.Group();
  tail.position.set(0, 0.4, -0.16);
  let ty = 0, tz = 0, ang = -0.5;
  for (let i = 0; i < 5; i++) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.035 - i * 0.004, 0.04 - i * 0.004, 0.2, 6), fur);
    seg.position.set(0, ty, tz);
    seg.rotation.x = ang;
    tail.add(seg);
    ty += Math.cos(ang) * 0.17; tz -= Math.sin(ang) * 0.17;
    ang += 0.55;
  }
  g.add(tail);
  const legs = [];
  for (const [sx, sz] of [[-0.1, 0.05], [0.1, 0.05], [-0.12, -0.06], [0.12, -0.06]]) {
    const L = leg(fur, 0.035, 0.3);
    L.position.set(sx, 0.3, sz);
    g.add(L); legs.push(L);
  }
  return new Creature(g, { legs, bobPart: body, head, tail, speedMul: 1.6, shadowR: 0.5, swimSink: 0.5,
    neck: { y: 0.66, z: 0.04, r: 0.15, tilt: 0.15 } });
}

// ---------- Agouti ----------
export function makeAgouti(T) {
  const fur = mat(T.fur_capy, 0xc09a58);
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.4, 6, 10), fur);
  body.rotation.z = Math.PI / 2; body.rotation.y = Math.PI / 2;
  body.rotation.x = -0.25;
  body.position.y = 0.38; body.userData.y0 = 0.38;
  g.add(body);
  const head = new THREE.Group();
  head.position.set(0, 0.62, 0.3);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), fur);
  skull.scale.set(0.85, 0.85, 1.15);
  head.add(skull);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), solid(0x2c2018));
  nose.position.set(0, 0, 0.17);
  head.add(nose);
  for (const s of [-1, 1]) {
    const e = eye(0.035); e.position.set(s * 0.07, 0.05, 0.09); head.add(e);
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), fur);
    ear.scale.set(0.7, 1.2, 0.4);
    ear.position.set(s * 0.07, 0.15, -0.02);
    head.add(ear);
  }
  g.add(head);
  const legs = [];
  for (const [sx, sz] of [[-0.11, 0.15], [0.11, 0.15], [-0.11, -0.18], [0.11, -0.18]]) {
    const L = leg(fur, 0.04, 0.32);
    L.position.set(sx, 0.32, sz);
    g.add(L); legs.push(L);
  }
  return new Creature(g, { legs, bobPart: body, head, speedMul: 1.5, shadowR: 0.5, swimSink: 0.4,
    neck: { y: 0.52, z: 0.25, r: 0.14, tilt: 0.6 } });
}

// ---------- Caiman ----------
export function makeCaiman(T) {
  const scale = mat(T.scales);
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 1.1, 6, 10), scale);
  body.rotation.z = Math.PI / 2; body.rotation.y = Math.PI / 2;
  body.position.y = 0.3; body.userData.y0 = 0.3;
  body.scale.set(1, 1, 0.62);
  g.add(body);
  const head = new THREE.Group();
  head.position.set(0, 0.3, 0.8);
  const snout = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.5, 5, 8), scale);
  snout.rotation.z = Math.PI / 2; snout.rotation.y = Math.PI / 2;
  snout.scale.set(1, 1, 0.55);
  snout.position.z = 0.2;
  head.add(snout);
  for (const s of [-1, 1]) {
    const bump = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), scale);
    bump.position.set(s * 0.12, 0.13, -0.05);
    head.add(bump);
    const e = eye(0.04); e.position.set(s * 0.12, 0.17, -0.05); head.add(e);
  }
  g.add(head);
  // segmented tail
  const tail = new THREE.Group();
  tail.position.set(0, 0.28, -0.7);
  for (let i = 0; i < 4; i++) {
    const seg = new THREE.Mesh(new THREE.ConeGeometry(0.24 - i * 0.05, 0.5, 6), scale);
    seg.rotation.x = Math.PI / 2 + 0.08 * i;
    seg.scale.y = 1;
    seg.position.z = -i * 0.34;
    seg.position.y = 0;
    tail.add(seg);
  }
  g.add(tail);
  const legs = [];
  for (const [sx, sz] of [[-0.34, 0.35], [0.34, 0.35], [-0.34, -0.35], [0.34, -0.35]]) {
    const L = leg(scale, 0.07, 0.22);
    L.position.set(sx, 0.22, sz);
    L.rotation.z = sx > 0 ? -0.5 : 0.5;
    g.add(L); legs.push(L);
  }
  return new Creature(g, { legs, bobPart: body, head, tail, bobAmp: 0.012, speedMul: 0.9, shadowR: 1.15, swimSink: 0.38,
    neck: { y: 0.3, z: 0.62, r: 0.33, tilt: Math.PI / 2, squash: 0.65 } });
}

// ---------- Marmoset (tiny) ----------
export function makeMarmoset(T) {
  const fur = mat(T.fur_otter, 0xcccccc);
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.2, 6, 8), fur);
  body.position.y = 0.3; body.userData.y0 = 0.3;
  g.add(body);
  const head = new THREE.Group();
  head.position.set(0, 0.52, 0.03);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), fur);
  head.add(skull);
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), solid(0x3a2c20));
  face.scale.set(1.1, 1, 0.5);
  face.position.set(0, 0, 0.07);
  head.add(face);
  for (const s of [-1, 1]) {
    const e = eye(0.024); e.position.set(s * 0.032, 0.02, 0.1); head.add(e);
    // big white ear tufts
    const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), solid(0xf5f0e8));
    tuft.scale.set(1.3, 1, 0.5);
    tuft.position.set(s * 0.11, 0.02, -0.02);
    head.add(tuft);
  }
  g.add(head);
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.5, 6), fur);
  tail.rotation.x = 0.7;
  tail.position.set(0, 0.28, -0.2);
  g.add(tail);
  const legs = [];
  for (const [sx, sz] of [[-0.07, 0.04], [0.07, 0.04], [-0.08, -0.05], [0.08, -0.05]]) {
    const L = leg(fur, 0.025, 0.2);
    L.position.set(sx, 0.2, sz);
    g.add(L); legs.push(L);
  }
  return new Creature(g, { legs, bobPart: body, head, tail, speedMul: 1.8, shadowR: 0.35, swimSink: 0.32,
    neck: { y: 0.44, z: 0.03, r: 0.1, tilt: 0.15 } });
}

// ---------- Dolphin (stranded on the beach; the parade pushes it home) ----------
export function makeDolphin() {
  const skin = solid(0x7d99ad), belly = solid(0xe4ecf0);
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 1.3, 8, 14), skin);
  body.rotation.x = Math.PI / 2;     // capsule axis along z
  body.scale.z = 0.85;               // a touch flatter top-to-bottom
  body.position.y = 0.45;
  g.add(body);
  const under = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 10), belly);
  under.scale.set(0.92, 0.55, 2.0);
  under.position.set(0, 0.32, 0.05);
  g.add(under);
  const melon = new THREE.Mesh(new THREE.SphereGeometry(0.33, 12, 10), skin);
  melon.scale.set(1, 0.9, 1.15);
  melon.position.set(0, 0.5, 0.78);
  g.add(melon);
  const beak = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.42, 10), skin);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.38, 1.16);
  g.add(beak);
  const grin = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.165, 0.4, 10), belly);
  grin.rotation.x = Math.PI / 2;
  grin.scale.set(1, 1, 0.45);
  grin.position.set(0, 0.33, 1.16);
  g.add(grin);
  for (const s of [-1, 1]) {
    const e = eye(0.05); e.position.set(s * 0.27, 0.5, 0.86); g.add(e);
    const flipper = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.5, 4), skin);
    flipper.scale.set(1, 1, 0.3);
    flipper.rotation.set(0.5, 0, s * -1.9);
    flipper.position.set(s * 0.42, 0.24, 0.42);
    g.add(flipper);
  }
  const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.55, 4), skin);
  dorsal.scale.set(0.28, 1, 1);
  dorsal.rotation.x = -0.55;
  dorsal.position.set(0, 0.98, -0.12);
  g.add(dorsal);
  // tail stock + flukes on a pivot so it can beat up and down
  const fluke = new THREE.Group();
  fluke.position.set(0, 0.45, -0.95);
  const stock = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.65, 10), skin);
  stock.rotation.x = -Math.PI / 2;
  stock.scale.set(1, 1, 0.8);
  stock.position.z = -0.28;
  fluke.add(stock);
  for (const s of [-1, 1]) {
    const lobe = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.26), skin);
    lobe.rotation.y = s * 0.45;
    lobe.position.set(s * 0.22, 0, -0.62);
    fluke.add(lobe);
  }
  g.add(fluke);
  const cr = new Creature(g, { shadowR: 1.3 });
  cr.fluke = fluke;
  return cr;
}

// ---------- Ocelot (the wetland's gentle menace — never catches anyone) ----------
export function makeOcelot(T) {
  const fur = mat(T.fur_ocelot);
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.85, 6, 10), fur);
  body.rotation.z = Math.PI / 2; body.rotation.y = Math.PI / 2;
  body.position.y = 0.5; body.userData.y0 = 0.5;
  g.add(body);
  const head = new THREE.Group();
  head.position.set(0, 0.72, 0.6);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), fur);
  skull.scale.set(0.95, 0.9, 1);
  head.add(skull);
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), solid(0xf0e0cc));
  muzzle.scale.set(1.2, 0.8, 0.9);
  muzzle.position.set(0, -0.06, 0.16);
  head.add(muzzle);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), solid(0x8a4a44));
  nose.position.set(0, -0.02, 0.25);
  head.add(nose);
  for (const s of [-1, 1]) {
    const e = eye(0.045); e.position.set(s * 0.09, 0.06, 0.16); head.add(e);
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.14, 4), fur);
    ear.position.set(s * 0.13, 0.2, -0.02);
    head.add(ear);
  }
  g.add(head);
  // long expressive tail
  const tail = new THREE.Group();
  tail.position.set(0, 0.52, -0.6);
  let ang = -0.9;
  let ty = 0, tz = 0;
  for (let i = 0; i < 4; i++) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.05 - i * 0.007, 0.055 - i * 0.007, 0.28, 6), fur);
    seg.position.set(0, ty, tz);
    seg.rotation.x = ang;
    tail.add(seg);
    ty += Math.cos(ang) * 0.24; tz -= Math.sin(ang) * 0.24;
    ang += 0.5;
  }
  g.add(tail);
  const legs = [];
  for (const [sx, sz] of [[-0.17, 0.35], [0.17, 0.35], [-0.17, -0.35], [0.17, -0.35]]) {
    const L = leg(fur, 0.06, 0.42);
    L.position.set(sx, 0.42, sz);
    g.add(L); legs.push(L);
  }
  return new Creature(g, { legs, bobPart: body, head, tail, speedMul: 1.1, shadowR: 0.75 });
}

export const BUILDERS = {
  capybara: makeCapybara,
  tapir: makeTapir,
  heron: makeHeron,
  otter: makeOtter,
  duck: makeDuck,
  monkey: makeMonkey,
  agouti: makeAgouti,
  caiman: makeCaiman,
  marmoset: makeMarmoset,
};
