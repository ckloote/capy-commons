// main.js — bootstrap, player controller, camera, render loop
import * as THREE from 'three';
import { createWorld, heightAt, ISLAND_R, GROVE } from './world.js';
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
  'fur_capy', 'fur_dark', 'fur_otter', 'feathers_heron', 'feathers_duck', 'scales'];
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

// ---------- player + camera ----------
const camTarget = new THREE.Vector3();
const camPos = new THREE.Vector3();

function step(dt, t) {
  const g = player.group;
  const mv = input.moveVec();
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
    const nx = g.position.x + dx * speed * mv.len * dt;
    const nz = g.position.z + dz * speed * mv.len * dt;
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
  g.position.y = (nowSwimming ? -0.25 : h2) + hopY;
  player.update(dt, t, moving);
  // hide leg churn while swimming
  for (const L of player.legs) L.visible = !nowSwimming;

  // actions
  if (input.takeAction()) {
    sound.start();
    const consumed = game.tryAction(g.position);
    if (!consumed) doSqueak(t);
  }
  if (input.takeSqueak()) { sound.start(); doSqueak(t); }

  // camera
  const d = input.takeCamDeltas();
  camYaw -= d.yaw;
  camPitch = Math.max(0.12, Math.min(1.25, camPitch + d.pitch));
  camDist = Math.max(4.5, Math.min(16, camDist + d.zoom));

  camTarget.set(g.position.x, g.position.y + 1.1, g.position.z);
  camPos.set(
    camTarget.x + Math.sin(camYaw) * Math.cos(camPitch) * camDist,
    camTarget.y + Math.sin(camPitch) * camDist,
    camTarget.z + Math.cos(camYaw) * Math.cos(camPitch) * camDist
  );
  const minY = Math.max(heightAt(camPos.x, camPos.z) + 0.6, 0.6);
  if (camPos.y < minY) camPos.y = minY;
  camera.position.lerp(camPos, Math.min(1, dt * 7));
  camera.lookAt(camTarget);

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
        ? 'Drag left side to walk · drag right side to look · 🐾 to interact, 🎵 to squeak'
        : 'WASD to walk · drag to look · E to interact · Q to squeak', 7000);
    }
  }, 9000);
});
