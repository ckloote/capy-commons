// main.js — bootstrap, player controller, camera, render loop
import * as THREE from 'three';
import { createWorld, heightAt, ISLAND_R, GROVE, SPRING } from './world.js';
import { makeCapybara } from './creatures.js';
import { Input } from './input.js';
import { Sound } from './audio.js';
import { Game, toast } from './game.js';

const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 900);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- texture loading ----------
const NAMES = ['grass', 'path', 'water', 'bark', 'canopy', 'stone', 'petals',
  'fur_capy', 'fur_dark', 'fur_otter', 'fur_ocelot', 'feathers_heron', 'feathers_duck', 'scales'];
const loader = new THREE.TextureLoader();
const T = {};
const texturesReady = Promise.all(NAMES.map((n) => new Promise((res, rej) => {
  loader.load(`assets/textures/${n}.jpg`, (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    T[n] = tex; res();
  }, undefined, rej);
})));

// ---------- state ----------
let world, game, player, input;
const sound = new Sound();
let started = false;
let camYaw = Math.PI;         // behind the capy facing north (-z)
let camPitch = 0.42;
let camDist = 8.5;
let hopY = 0, hopV = 0;
let wasSwimming = false;
let napping = false;
let napZZZTimer = 0, snoreTimer = 0, napZoom = 0;
let wander = null;   // { target, t } during the zen-zero stroll
const clock = new THREE.Clock();

function buildGame() {
  world = createWorld(scene, T);
  game = new Game(scene, T, sound);
  game.world = world;

  player = makeCapybara(T);
  player.group.position.set(0, heightAt(0, 0), 4);
  scene.add(player.group);

  input = new Input(canvas);
  // debug/test hooks
  window.CAPY = {
    scene, camera, game, world,
    get player() { return player; },
    teleport(x, z) { player.group.position.set(x, Math.max(heightAt(x, z), 0), z); },
    setCam(yaw, pitch, dist) { camYaw = yaw; if (pitch !== undefined) camPitch = pitch; if (dist !== undefined) camDist = dist; },
  };
  animate();
}

// ---------- swimming ripples ----------
const rippleGeo = new THREE.RingGeometry(0.42, 0.56, 24);
const ripples = [];
let rippleTimer = 0;
function spawnRipple(x, z) {
  const m = new THREE.Mesh(rippleGeo, new THREE.MeshBasicMaterial({
    color: 0xf2fce8, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false,
  }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.04, z);
  scene.add(m);
  ripples.push({ m, t: 0 });
}
function updateRipples(dt) {
  for (let i = ripples.length - 1; i >= 0; i--) {
    const r = ripples[i];
    r.t += dt;
    if (r.t > 1.2) { scene.remove(r.m); r.m.material.dispose(); ripples.splice(i, 1); continue; }
    const s = 1 + r.t * 2.4;
    r.m.scale.set(s, s, 1);
    r.m.material.opacity = 0.45 * (1 - r.t / 1.2);
  }
}

// ---------- player + camera ----------
const camTarget = new THREE.Vector3();
const camPos = new THREE.Vector3();

function step(dt, t) {
  const g = player.group;
  let mv = input.moveVec();

  // zen hit zero → the capybara wanders off to collect itself (no punishment)
  if (!wander && game.zen <= 0) {
    napping = false;
    document.getElementById('btn-nap').classList.remove('napping');
    const spots = [{ x: 0, z: 4 }, { x: SPRING.x, z: SPRING.z }];
    spots.sort((a, b) =>
      Math.hypot(g.position.x - a.x, g.position.z - a.z) -
      Math.hypot(g.position.x - b.x, g.position.z - b.z));
    wander = { target: spots[0], t: 0 };
    game.wanderingOff = true;
    document.getElementById('vignette').style.opacity = 1;
    toast('Too much. You wander off to collect yourself… 🍃', 4200);
  }
  if (wander) {
    wander.t += dt;
    const dx = wander.target.x - g.position.x, dz = wander.target.z - g.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 2.5 && wander.t < 6) {
      // autopilot expressed in camera space, since movement below is camera-relative
      const sin = Math.sin(camYaw), cos = Math.cos(camYaw);
      const fx = -sin, fz = -cos, rx = cos, rz = -sin;
      mv = { y: (dx * fx + dz * fz) / dist, x: (dx * rx + dz * rz) / dist, len: 0.7 };
    } else {
      wander = null;
      game.wanderingOff = false;
      game.zen = 55;
      sound.relief();
      document.getElementById('vignette').style.opacity = 0;
      toast('A deep breath. The wetland is still here. 🌿', 3600);
      mv = { x: 0, y: 0, len: 0 };
    }
    input.takeAction(); input.takeSqueak(); input.takeNap(); // ignore inputs mid-stroll
  }

  // nap toggle
  if (!wander && input.takeNap()) {
    sound.start();
    napping = !napping;
    document.getElementById('btn-nap').classList.toggle('napping', napping);
  }
  if (napping && mv.len > 0.1) {
    napping = false;
    document.getElementById('btn-nap').classList.remove('napping');
  }

  const boost = t < game.boostUntil;
  const h = heightAt(g.position.x, g.position.z);
  const swimming = h < -0.05;
  let speed = (swimming ? 4.2 : 6) * (boost ? 1.55 : 1);

  let moving = false;
  if (mv.len > 0.05) {
    const sin = Math.sin(camYaw), cos = Math.cos(camYaw);
    // camera-relative: forward = away from camera
    const fx = -sin, fz = -cos;
    const rx = cos, rz = -sin;
    let dx = fx * mv.y + rx * mv.x;
    let dz = fz * mv.y + rz * mv.x;
    const len = Math.hypot(dx, dz);
    if (len > 0) { dx /= len; dz /= len; }
    let nx = g.position.x + dx * speed * mv.len * dt;
    let nz = g.position.z + dz * speed * mv.len * dt;
    const solid = world.collide(nx, nz, 0.55);
    nx = solid.x; nz = solid.z;
    if (Math.hypot(nx, nz) < ISLAND_R + 4) {
      g.position.x = nx; g.position.z = nz;
    }
    const targetRot = Math.atan2(dx, dz);
    let diff = targetRot - g.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    g.rotation.y += diff * Math.min(1, dt * 10);
    moving = true;
  }

  // hop physics
  if (hopV !== 0 || hopY > 0) {
    hopY += hopV * dt; hopV -= 22 * dt;
    if (hopY <= 0) { hopY = 0; hopV = 0; }
  }

  const h2 = heightAt(g.position.x, g.position.z);
  const nowSwimming = h2 < -0.05;
  if (nowSwimming && !wasSwimming) {
    sound.splash();
    game.particles.burst('💧', g.position.clone().add(new THREE.Vector3(0, 0.6, 0)), { count: 6, size: 0.35, up: 2 });
  }
  wasSwimming = nowSwimming;
  if (nowSwimming && napping) {
    napping = false;
    document.getElementById('btn-nap').classList.remove('napping');
  }
  if (nowSwimming) {
    rippleTimer -= dt;
    if (rippleTimer <= 0) { spawnRipple(g.position.x, g.position.z); rippleTimer = moving ? 0.45 : 1.1; }
  }
  updateRipples(dt);
  g.position.y = (nowSwimming ? -0.25 : h2) + hopY - (napping ? 0.22 : 0);
  player.update(dt, t, moving);
  // hide leg churn + shadow while swimming; tuck legs into the loaf while napping
  for (const L of player.legs) L.visible = !nowSwimming && !napping;
  player.shadow.visible = !nowSwimming;
  if (napping) {
    player.head.rotation.x = 0.32;    // chin down, eyes soft
    napZZZTimer -= dt;
    if (napZZZTimer <= 0) {
      napZZZTimer = 1.7;
      game.particles.burst('💤', g.position.clone().add(new THREE.Vector3(0.35, 1.05, 0.3)),
        { count: 1, size: 0.42, up: 0.8, speed: 0.2, life: 1.7, gravity: 0.35, spread: 0.2 });
    }
    snoreTimer -= dt;
    if (snoreTimer <= 0) { snoreTimer = 2.7; sound.snore(); }
  }

  // actions
  if (input.takeAction()) {
    sound.start();
    if (napping) {
      napping = false;
      document.getElementById('btn-nap').classList.remove('napping');
    }
    const consumed = game.tryAction(g.position);
    if (!consumed) doSqueak(t);
  }
  if (input.takeSqueak()) { sound.start(); doSqueak(t); }

  // camera
  const d = input.takeCamDeltas();
  camYaw -= d.yaw;
  camPitch = Math.max(0.12, Math.min(1.25, camPitch + d.pitch));
  camDist = Math.max(4.5, Math.min(16, camDist + d.zoom));

  napZoom += ((napping ? 2.8 : 0) - napZoom) * Math.min(1, dt * 1.2);
  const cd = camDist + napZoom;
  camTarget.set(g.position.x, g.position.y + 1.1, g.position.z);
  camPos.set(
    camTarget.x + Math.sin(camYaw) * Math.cos(camPitch) * cd,
    camTarget.y + Math.sin(camPitch) * cd,
    camTarget.z + Math.cos(camYaw) * Math.cos(camPitch) * cd
  );
  const minY = Math.max(heightAt(camPos.x, camPos.z) + 0.6, 0.6);
  if (camPos.y < minY) camPos.y = minY;
  camera.position.lerp(camPos, Math.min(1, dt * 7));
  camera.lookAt(camTarget);

  game.napping = napping;
  game.update(dt, t, g, moving, camera);
  world.update(dt, t);
}

function doSqueak(t) {
  hopV = 5.5;
  game.squeak(player.group, t);
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  if (started) step(dt, t);
  renderer.render(scene, camera);
}

// ---------- boot ----------
const beginBtn = document.getElementById('begin-btn');
const note = document.getElementById('loading-note');
beginBtn.addEventListener('click', async () => {
  beginBtn.disabled = true;
  note.textContent = 'Waking the wetland…';
  try {
    await texturesReady;
  } catch (e) {
    note.textContent = 'Some textures failed to load — starting anyway.';
  }
  if (!world) buildGame();
  sound.start();
  document.getElementById('title-screen').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  started = true;
  setTimeout(() => {
    toast('Find the eight friends of the commons and lead them to the glowing grove in the north. 🌿', 6500);
  }, 800);
  setTimeout(() => {
    if (game && game.followers.length === 0) {
      toast(navigator.maxTouchPoints > 0
        ? 'Drag left side to walk · drag right to look · 🐾 interact · 🎵 squeak · 💤 nap'
        : 'WASD to walk · drag to look · E to interact · Q to squeak · Z to nap', 7000);
    }
  }, 9000);
});
