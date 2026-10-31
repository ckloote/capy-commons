// game.js — friends, items, conga line, grove delivery, finale, particles, UI
import * as THREE from 'three';
import { BUILDERS, makeDuckling, makeOcelot, makeDolphin, makeTurtle, makeFrog, makeSongbird, makeCousin } from './creatures.js';
import { heightAt, GROVE, ISLAND_R, ISLANDS } from './world.js';

// ---------- emoji sprite helper ----------
const spriteCache = {};
export function emojiTexture(emoji, px = 96) {
  if (spriteCache[emoji]) return spriteCache[emoji];
  const c = document.createElement('canvas');
  c.width = c.height = px;
  const ctx = c.getContext('2d');
  ctx.font = `${px * 0.8}px serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(emoji, px / 2, px / 2 + px * 0.05);
  const tex = new THREE.CanvasTexture(c);
  spriteCache[emoji] = tex;
  return tex;
}

// ---------- particles ----------
class Particles {
  constructor(scene) { this.scene = scene; this.list = []; }
  burst(emoji, pos, { count = 8, speed = 1.6, up = 2.2, life = 1.1, size = 0.5, gravity = -2.5, spread = 0.6 } = {}) {
    const tex = emojiTexture(emoji);
    for (let i = 0; i < count; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
      s.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * spread, Math.random() * 0.4, (Math.random() - 0.5) * spread));
      s.scale.setScalar(size * (0.7 + Math.random() * 0.6));
      const a = Math.random() * Math.PI * 2;
      this.list.push({
        s, life, t: 0, gravity,
        vx: Math.cos(a) * speed * Math.random(),
        vy: up * (0.5 + Math.random() * 0.5),
        vz: Math.sin(a) * speed * Math.random(),
      });
      this.scene.add(s);
    }
  }
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.t += dt;
      if (p.t >= p.life) { this.scene.remove(p.s); p.s.material.dispose(); this.list.splice(i, 1); continue; }
      p.vy += p.gravity * dt;
      p.s.position.x += p.vx * dt; p.s.position.y += p.vy * dt; p.s.position.z += p.vz * dt;
      p.s.material.opacity = 1 - p.t / p.life;
    }
  }
}

// ---------- friendship aura ring: a circle of soft motes that hugs the ground ----------
const AURA_MOTES = 56;
function auraMoteTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(16, 16, 1, 16, 16, 15);
  g.addColorStop(0, 'rgba(255,248,220,1)');
  g.addColorStop(0.4, 'rgba(255,214,150,0.55)');
  g.addColorStop(1, 'rgba(255,200,140,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

// ---------- swimming ripples ----------
const rippleGeo = new THREE.RingGeometry(0.42, 0.56, 24);

// ---------- config ----------
const FRIENDS = [
  { id: 'tapir', tier: 'mellow', name: 'Tobi the Tapir', emoji: '🌺', want: 'flower', space: 2.7,
    pos: [18, -28], ask: 'Tobi sniffs the air dreamily. He has smelled a sweet flower somewhere in the meadows…',
    thanks: 'Tobi tucks the flower behind his ear. He lumbers happily into line!',
    calmed: 'Tobi lets out a long, contented sigh and lumbers into line beside you.',
    necklace: 'Tobi lowers his big head so you can reach. He wears the necklace with enormous dignity.' },
  { id: 'heron', tier: 'skittish', auraNeed: 2, name: 'Hana the Heron', emoji: '🐟', want: 'fish', space: 2.1,
    pos: [31, 6], ask: 'Hana stands perfectly still. "A silver fish glints in the pond shallows. My old wings miss the dive…"',
    thanks: 'Hana swallows the fish in one elegant gulp. She strides after you on stilt legs!',
    calmed: 'Hana\'s feathers settle. She lowers her head, just once — and steps after you on stilt legs.',
    necklace: 'Hana arches her long neck. "Oh, it suits me," she says — and it really does.' },
  { id: 'otter', tier: 'shy', name: 'Rio the Otter', emoji: '🪨', want: 'skipstone', space: 1.8,
    pos: [-14, 30], ask: 'Rio juggles nothing. "Lost my lucky skipping stone! Flat, smooth, somewhere up the stone trail north of the meadow."',
    thanks: 'Rio skips the stone across the water — four bounces! He tumbles into line, chittering.',
    calmed: 'Rio stops juggling nothing, flops over, then bounces up and tumbles into line. Who needs a stone?',
    necklace: 'Rio spins in a circle to show the necklace to absolutely everyone.' },
  { id: 'duck', tier: 'shy', name: 'Mabel the Mallard', emoji: '🐥', want: 'ducklings', space: 1.6,
    pos: [21, 22], ask: 'Mabel is beside herself. "My three ducklings wandered off! Please, bring them waddling back."',
    thanks: 'Mabel counts her ducklings twice, then quacks the happiest quack you have ever heard.',
    calmed: 'Mabel tucks her bill under a wing for a moment, then rises with a soft quack. She\'ll come — the ducklings can catch up.',
    necklace: 'Mabel quacks with delight. The ducklings are extremely jealous.' },
  { id: 'monkey', tier: 'shy', name: 'Miko the Monkey', emoji: '🥭', want: 'mango', space: 1.8,
    pos: [-34, 16], ask: 'Miko swings down. "Mango. MANGO. There is one under a tree to the northwest and it is calling to me."',
    thanks: 'Miko cradles the mango like treasure and scampers into line behind you!',
    calmed: 'Miko yawns hugely, forgets about mango entirely, and scampers into line behind you.',
    necklace: 'Miko tries to eat one petal, then decides the necklace is better for wearing.' },
  { id: 'agouti', tier: 'mellow', name: 'Pip the Agouti', emoji: '🌰', want: 'nut', space: 1.5,
    pos: [8, 38], ask: 'Pip twitches. "I buried a marvelous nut. Somewhere. North-ish? It is gone. This is a catastrophe."',
    thanks: 'Pip stuffs the nut in one cheek. It is enormous. Pip is thrilled.',
    calmed: 'Pip stops twitching. Pip is… calm? Pip is calm. Pip follows you.',
    necklace: 'Pip pats the necklace over and over. "Mine? Truly? MINE?"' },
  { id: 'caiman', tier: 'mellow', name: 'Old Grim the Caiman', emoji: '🧘', want: 'company', space: 2.7,
    pos: [38, -10], ask: 'Old Grim says nothing. He simply floats. Perhaps he just wants… quiet company. (Stay close a while.)',
    thanks: 'Old Grim opens one golden eye. "…fine," he rumbles, and drifts after you like a very slow torpedo.',
    calmed: 'Old Grim opens one golden eye. "…fine," he rumbles, and drifts after you like a very slow torpedo.',
    necklace: 'Old Grim says nothing. But he does not take it off, and his golden eye looks a little softer.' },
  { id: 'marmoset', tier: 'shy', name: 'Luna the Marmoset', emoji: '🫐', want: 'berry', space: 1.4,
    pos: [-38, -20], ask: 'Luna, tiny and serious: "One berry. The plump kind that grows in the northwest woods. Then I am yours."',
    thanks: 'Luna eats the berry in seventeen rapid bites and climbs onto the parade!',
    calmed: 'Luna studies you very seriously, decides you will do, and climbs onto the parade.',
    necklace: 'Luna, tiny and serious, adjusts her necklace until it is exactly right.' },
];

const ITEMS = [
  { id: 'flower', emoji: '🌺', name: 'a sweet flower', pos: [-8, 22], color: 0xff7a5c },
  { id: 'fish', emoji: '🐟', name: 'a silver fish', pos: [27, 17], color: 0xb8ccd8 },
  { id: 'skipstone', emoji: '🪨', name: "Rio's lucky stone", pos: [4, -22], color: 0x9aa0a8 },
  { id: 'mango', emoji: '🥭', name: 'a perfect mango', pos: [-24, -30], color: 0xffb03a },
  { id: 'nut', emoji: '🌰', name: 'a marvelous nut', pos: [-2, 45], color: 0x8a5a30 },
  { id: 'berry', emoji: '🫐', name: 'a plump berry', pos: [-27, -38], color: 0x5a5ac8 },
];

const DUCKLING_SPOTS = [[33, 2], [12, 28], [30, 27]];

// the stranded dolphin (issue #3): west beach, a few steps up from the
// waterline; seaward = radial 170°. Clear sand behind it for the parade.
const DOLPHIN = { x: -53.4, z: 9.4, seaX: -0.985, seaZ: 0.174, helpersNeeded: 3 };

// phase 2 trust: calm is transferred, not radiated. Sitting still near a
// friend fills their trust over ~8s and spends your zen by how skittish
// they are; shy species won't *start* settling unless you're calm enough.
const TIERS = {
  mellow: { drain: 3, floor: 0 },      // ≈25 zen
  shy: { drain: 4.5, floor: 50 },      // ≈35 zen
  skittish: { drain: 6, floor: 65 },   // ≈50 zen
};
const FILL_TIME = 8;        // seconds of shared calm to full trust
// the friendship aura (phase 2b): your circle of calm. It's how close you
// need to sit, and it widens with every friend walking with you. Skittish
// species (cfg.auraNeed) won't let a small parade near them at all.
const AURA_BASE = 4.5, AURA_PER_FRIEND = 0.6, AURA_MAX = 9;
const FLEE_R = 7;           // a skittish animal bolts when an under-sized parade comes this close
const FLEE_LEASH = 12;      // …but never strays further than this from home
const SPEND_FLOOR = 15;     // recruitment never spends zen below this
const NECKLACE_TRUST = 0.35;
const shortName = (cfg) => cfg.name.split(' the ')[0];

// phase 2c: little critters ride on you (head/back stacks); wild capybara
// cousins walk in the parade. All bonus — the 8 friends still make the
// Gathering — but they share calm the same way and count toward your parade.
const KINDS = {
  turtle: { name: 'Pond Turtle', emoji: '🐢', tier: 'mellow', fill: 3, ride: 'back', iconH: 0.6,
    build: (T) => makeTurtle(T),
    ask: 'A pond turtle blinks at you, very slowly. It looks like it would enjoy a ride.',
    calmed: 'The turtle clambers up and settles onto your back. 🐢' },
  frog: { name: 'Marsh Frog', emoji: '🐸', tier: 'shy', fill: 3, ride: 'back', iconH: 0.55,
    build: () => makeFrog(),
    ask: 'A frog eyes you from the pond edge, throat pulsing. Sit still and it might hop aboard.',
    calmed: 'Boing! The frog hops aboard. 🐸' },
  songbird: { name: 'Songbird', emoji: '🐦', tier: 'skittish', fill: 3, auraNeed: 3, ride: 'head', iconH: 0.6,
    build: (T, i) => makeSongbird(i),
    ask: 'A little songbird hops through the grass, singing. Birds adore a capybara head — if they trust you.',
    calmed: 'The songbird flutters up and perches on your head, singing! 🐦' },
  cousin: { name: 'Wild Cousin', emoji: '🦫', tier: 'shy', fill: 5, auraNeed: 1, ride: null, space: 1.4, iconH: 1.3,
    build: (T) => makeCousin(T),
    ask: 'A wild capybara cousin! Shy of strangers, but very interested in your parade.',
    calmed: 'Your wild cousin squeaks and falls in behind you. Family! 🫶' },
};
const CRITTERS = [
  ['turtle', -25.8, -0.5], ['turtle', -15.2, 36.8],          // basking by the hot spring; NW pond rim
  ['frog', -21.9, 33], ['frog', -20, 37.5],                 // NW pond edge
  ['songbird', -8, -14], ['songbird', 7, -11], ['songbird', -2, -20],   // meadow, north of spawn
  ['cousin', -21, 44], ['cousin', -18, 47], ['cousin', -24, 41],        // southwest marsh herd
];
const RIDE_CAP = 4;          // per stack (head, back)

// ---------- UI helpers ----------
const $ = (id) => document.getElementById(id);
const actKey = () => (navigator.maxTouchPoints > 0 ? '🐾' : 'E');
let toastTimer = null;
export function toast(msg, ms = 3200) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

// ---------- game ----------
export class Game {
  constructor(scene, T, sound) {
    this.scene = scene;
    this.sound = sound;
    this.particles = new Particles(scene);
    this.friends = [];
    this.items = [];
    this.ducklings = [];
    this.inventory = {};
    this.flowerCount = 0;     // meadow flowers in paw; 3 → a necklace
    this.necklaces = 0;
    this.followers = [];      // creatures currently in the conga line
    this.homed = 0;
    this.finaleStarted = false;
    this.finaleT = 0;
    this.fireflies = [];
    this.ripples = [];
    this.boostUntil = -99;
    this.springToastAt = -99;
    this.visited = new Set(['home']);   // islands you've set foot on (arrival toasts)
    // zen (phase 1): the only "health" this game has.
    // It settles near ZEN_SET (60) on its own; only naps, the spring, and
    // friend piles push it toward 100 — full calm is prepared, not default.
    this.zen = 62;
    this.napping = false;        // set by main each frame
    this.zenFaceState = '';
    this.stressed = false;       // ocelot aura active this frame
    this.wanderingOff = false;   // set by main during the stress-out stroll
    this.calming = null;         // the friend you're sharing calm with
    this.calmState = null;       // 'calming' | 'wary' | 'low' | 'idle' for the prompt card
    this.calmDrain = 0;          // zen/s being given away this frame
    this.aura = AURA_BASE;       // calm radius; grows with the parade
    this.auraShown = AURA_BASE;  // eased radius for the ring visual
    this.trail = [];          // {x,z,d}
    this.trailD = 0;
    this.T = T;

    // build friends
    for (const cfg of FRIENDS) {
      const cr = BUILDERS[cfg.id](T);
      const [x, z] = cfg.pos;
      const y = Math.max(heightAt(x, z), 0.02);
      cr.group.position.set(x, y, z);
      cr.group.rotation.y = Math.random() * Math.PI * 2;
      scene.add(cr.group);
      const icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTexture(cfg.emoji), transparent: true, depthWrite: false }));
      icon.scale.setScalar(0.8);
      icon.position.set(0, this._iconH(cfg.id), 0);
      cr.group.add(icon);
      cr.noSwim = !!cfg.auraNeed;   // a startled heron wades, but won't bolt out to sea
      this.friends.push({
        cfg, cr, icon, state: 'waiting', space: cfg.space,
        trust: 0, runeIndex: -1, home: { x, z }, fleeUntil: -99, returnAt: -99, homeSpot: null, wanderT: Math.random() * 5,
      });
    }

    // ducklings
    for (const [x, z] of DUCKLING_SPOTS) {
      const cr = makeDuckling();
      cr.group.position.set(x, Math.max(heightAt(x, z), 0.02), z);
      scene.add(cr.group);
      this.ducklings.push({ cr, state: 'lost', space: 0.8 });
    }

    // items
    for (const cfg of ITEMS) {
      const g = new THREE.Group();
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTexture(cfg.emoji), transparent: true, depthWrite: false }));
      s.scale.setScalar(0.9);
      s.position.y = 0.6;
      g.add(s);
      const glow = new THREE.Mesh(
        new THREE.CircleGeometry(0.55, 20),
        new THREE.MeshBasicMaterial({ color: cfg.color, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
      );
      glow.rotation.x = -Math.PI / 2;
      glow.position.y = 0.05;
      g.add(glow);
      const [x, z] = cfg.pos;
      g.position.set(x, Math.max(heightAt(x, z), 0.05), z);
      this.scene.add(g);
      this.items.push({ cfg, g, sprite: s, taken: false });
    }
    // the ocelot: a slow-circling worry on the east bank
    {
      const cr = makeOcelot(T);
      cr.group.position.set(43, Math.max(heightAt(43, 4), 0.02), 4);
      scene.add(cr.group);
      this.ocelot = {
        cr, angle: Math.random() * Math.PI * 2, state: 'prowl',
        cx: 41, cz: 2, r: 5.5, calmUntil: -99, stungAt: -99, toldOff: false,
        landOnly: true,   // cats do not do water
      };
    }
    // the stranded dolphin: too heavy for one capybara
    {
      const cr = makeDolphin();
      const { x, z, seaX, seaZ } = DOLPHIN;
      cr.group.position.set(x, heightAt(x, z), z);
      cr.group.rotation.y = Math.atan2(seaZ, -seaX);   // lying along the shoreline
      scene.add(cr.group);
      const icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTexture('🌊'), transparent: true, depthWrite: false }));
      icon.scale.setScalar(0.8);
      icon.position.set(0, 1.9, 0);
      cr.group.add(icon);
      this.dolphin = {
        cr, icon, state: 'stranded',
        sea: new THREE.Vector3(seaX, 0, seaZ),
        noticed: false, nagAt: -99, heaveTold: false,
        angle: 0, leapAt: 6, leapT: -1, rippleT: 0, towTold: false, side: 1,
      };
    }
    // critters + cousins
    this.critters = [];
    this.riders = { head: [], back: [] };
    CRITTERS.forEach(([kind, x, z], i) => {
      const k = KINDS[kind];
      const cr = k.build(T, i);
      cr.group.position.set(x, Math.max(heightAt(x, z), 0.02), z);
      cr.group.rotation.y = Math.random() * Math.PI * 2;
      cr.noSwim = !!k.auraNeed;
      scene.add(cr.group);
      this.critters.push({
        cfg: { ...k, kind, id: `${kind}${i}` }, cr, state: 'waiting', trust: 0, space: k.space || 1,
        home: { x, z }, fleeUntil: -99, returnAt: -99,
      });
    });
    this._lastP = null;
    this._vel = new THREE.Vector2();
    this._acc = new THREE.Vector2();

    // the aura ring
    {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(AURA_MOTES * 3), 3));
      this.auraRing = new THREE.Points(geo, new THREE.PointsMaterial({
        map: auraMoteTexture(), size: 0.42, transparent: true, opacity: 0, depthWrite: false,
        blending: THREE.AdditiveBlending, color: 0xffe2a8,
      }));
      this.auraRing.frustumCulled = false;
      this.auraRing.visible = false;
      this.auraOpacity = 0;
      scene.add(this.auraRing);
    }
    this.dolphinTow = false;      // read by main: swimming beside the dolphin is faster
    this.playerSwimming = false;  // set by main each frame
    this._updateHUD();
  }

  _iconH(id) {
    return { tapir: 2.3, heron: 2.6, otter: 1.5, duck: 1.4, monkey: 1.5, agouti: 1.3, caiman: 1.2, marmoset: 1.1 }[id] || 1.6;
  }

  // ----- trail recording & sampling -----
  recordTrail(p) {
    const last = this.trail[this.trail.length - 1];
    if (!last) { this.trail.push({ x: p.x, z: p.z, d: 0 }); return; }
    const dd = Math.hypot(p.x - last.x, p.z - last.z);
    if (dd > 0.3) {
      this.trailD = last.d + dd;
      this.trail.push({ x: p.x, z: p.z, d: this.trailD });
      while (this.trail.length > 2 && this.trailD - this.trail[0].d > 90) this.trail.shift();
    }
  }
  sampleTrail(back, out) {
    const head = this.trail[this.trail.length - 1];
    if (!head) return false;
    const target = head.d - back;
    for (let i = this.trail.length - 1; i > 0; i--) {
      const a = this.trail[i - 1], b = this.trail[i];
      if (a.d <= target) {
        const t = (target - a.d) / Math.max(0.0001, b.d - a.d);
        out.set(a.x + (b.x - a.x) * t, 0, a.z + (b.z - a.z) * t);
        return true;
      }
    }
    out.set(this.trail[0].x, 0, this.trail[0].z);
    return true;
  }

  // ----- ripples (player + anyone wading or swimming) -----
  spawnRipple(x, z, size = 1) {
    const m = new THREE.Mesh(rippleGeo, new THREE.MeshBasicMaterial({
      color: 0xf2fce8, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false,
    }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.04, z);
    this.scene.add(m);
    this.ripples.push({ m, t: 0, size });
  }
  _updateRipples(dt) {
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.t += dt;
      if (r.t > 1.2) { this.scene.remove(r.m); r.m.material.dispose(); this.ripples.splice(i, 1); continue; }
      const s = (1 + r.t * 2.4) * r.size;
      r.m.scale.set(s, s, 1);
      r.m.material.opacity = 0.45 * (1 - r.t / 1.2);
    }
  }

  _mabel() { return this.friends.find((f) => f.cfg.id === 'duck'); }
  _ducklingSpot(mabel) {
    return mabel.homeSpot.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2));
  }

  countDucklingsFollowing() {
    return this.ducklings.filter((d) => d.state === 'following').length;
  }

  // ----- interaction -----
  nearestActionable(playerPos) {
    let best = null, bestD = this.aura;
    for (const f of this._waitingAll()) {
      const d = f.cr.group.position.distanceTo(playerPos);
      if (d < bestD) { best = f; bestD = d; }
    }
    return best;
  }

  *_waitingAll() {
    for (const f of this.friends) if (f.state === 'waiting') yield f;
    for (const c of this.critters) if (c.state === 'waiting') yield c;
  }

  _riderCount() { return this.riders.head.length + this.riders.back.length; }

  _canSatisfy(f) {
    const want = f.cfg.want;
    if (want === 'company') return false;   // no gift for Old Grim: only calm
    if (want === 'ducklings') return this.countDucklingsFollowing() >= 3;
    return !!this.inventory[want];
  }

  // who a necklace would go to: the friend you're talking to, else the nearest bare neck
  _necklaceTarget(playerPos, talking) {
    if (this.necklaces <= 0) return null;
    // the friend you're talking to — but only within arm's length: the aura
    // can make "talking" reach 9 units, and a necklace is handed over, not thrown
    if (talking && !talking.cfg.kind && !talking.cr.necklace &&
      talking.cr.group.position.distanceTo(playerPos) < AURA_BASE) return talking;
    let best = null, bestD = AURA_BASE;
    for (const f of this.friends) {
      if (f.cr.necklace) continue;
      const d = f.cr.group.position.distanceTo(playerPos);
      if (d < bestD) { best = f; bestD = d; }
    }
    return best;
  }

  tryAction(playerPos, t = 0) {
    const f = this.nearestActionable(playerPos);
    if (f && this._canSatisfy(f)) {
      if (f.cfg.want !== 'ducklings') delete this.inventory[f.cfg.want];
      this._befriend(f);
      this._updateHUD();
      return true;
    }
    const giveTo = this._necklaceTarget(playerPos, f);
    if (giveTo) { this._giveNecklace(giveTo, t); return true; }
    if (!f || f.cfg.kind) return false;   // critters: just squeak hello
    if (f.cfg.want === 'company') {
      toast('🧘  Old Grim wants nothing but quiet company. Stay close and keep still.');
      return true;
    }
    this.sound.denied();
    toast(f.cfg.emoji + '  ' + hintFor(f.cfg) + '  (Or just sit with them a while.)', 4200);
    return true;
  }

  // ----- flower necklaces -----
  _pickFlower(fl, t, player) {
    fl.picked = true;
    fl.g.visible = false;
    fl.regrowAt = t + 75;
    this.flowerCount++;
    this.particles.burst('🌼', fl.g.position.clone().add(new THREE.Vector3(0, 0.7, 0)),
      { count: 3, size: 0.3, up: 1.4, life: 0.8 });
    if (this.flowerCount >= 3) {
      this.flowerCount -= 3;
      this.necklaces++;
      this.sound.rune();
      this.particles.burst('📿', player.position.clone().add(new THREE.Vector3(0, 1.3, 0)),
        { count: 1, size: 0.7, up: 1.2, life: 1.5, spread: 0 });
      toast(this.necklaceTold
        ? 'Another flower necklace! 📿'
        : `You weave three flowers into a necklace! 📿 Walk up to a friend and press ${actKey()} to give it.`, 4800);
      this.necklaceTold = true;
    } else {
      this.sound.pickup();
      if (!this.flowerTold) {
        this.flowerTold = true;
        toast('You pick a flower 🌼 — three make a necklace!');
      }
    }
    this._updateHUD();
  }

  _giveNecklace(f, t) {
    this.necklaces--;
    f.cr.wearNecklace();
    this.sound.friendJoin(5 + Math.floor(Math.random() * 3));
    const above = f.cr.group.position.clone().add(new THREE.Vector3(0, 1.2, 0));
    this.particles.burst('🌸', above, { count: 8, size: 0.4 });
    this.particles.burst('💛', above, { count: 3, size: 0.4 });
    this.zen = Math.min(100, this.zen + 10);   // giving feels good
    if (f.state === 'following') f.hopAt = t + 0.1;
    toast(f.cfg.necklace, 4500);
    // the universal gift: a big, free trust boost — but not an instant join
    if (f.state === 'waiting') {
      f.trust = Math.min(1, f.trust + NECKLACE_TRUST);
      if (f.trust >= 1) {
        // let the necklace line land before the join line
        this._befriend(f, { quiet: true });
        setTimeout(() => toast(f.cfg.calmed, 4200), 3600);
      }
    }
    this._updateHUD();
  }

  _paradeFriends() {
    return this.followers.filter((f) => f.cfg).length;
  }

  // skittish species won't let a small parade near — unless you're carrying
  // exactly what they're hoping for (the fetch route always stays open)
  _startles(f) {
    return !!f.cfg.auraNeed && this._paradeFriends() < f.cfg.auraNeed && !this._canSatisfy(f);
  }

  _befriend(f, { line, quiet = false } = {}) {
    f.state = 'following';
    f.trust = 1;
    f.cr.noSwim = false;
    if (this.calming === f) this.calming = null;
    f.icon.material.map = emojiTexture('💛');
    f.icon.material.needsUpdate = true;
    this.followers.push(f);
    // ducklings you've already found slot in right behind their mother;
    // still-lost ones run to her when you find them (see the duckling loop)
    if (f.cfg.id === 'duck') {
      for (const d of this.ducklings) {
        if (d.state === 'lost') continue;
        d.state = 'withDuck';
        this.followers.push(d);
      }
    }
    this.sound.friendJoin(this.followers.filter((x) => x.cfg).length - 1);
    this.particles.burst('💛', f.cr.group.position.clone().add(new THREE.Vector3(0, 1.2, 0)), { count: 10 });
    if (!quiet) toast(line || f.cfg.thanks, 4200);
    if (!this.auraTold) {
      this.auraTold = true;
      setTimeout(() => toast('Your circle of calm widens 💛 Every friend beside you makes it bigger — and shy animals notice.', 5200), 4600);
    }
    this._updateHUD();
    setTimeout(() => { f.icon.visible = false; }, 2500);
  }

  // ----- per-frame -----
  update(dt, t, player, playerMoving, camera) {
    this.particles.update(dt);
    this._updateRipples(dt);
    this.recordTrail(player.position);

    // item pickups + bobbing
    for (const it of this.items) {
      if (it.taken) continue;
      it.sprite.position.y = 0.6 + Math.sin(t * 2.2 + it.g.position.x) * 0.12;
      if (it.g.position.distanceTo(player.position) < 1.6) {
        it.taken = true;
        this.scene.remove(it.g);
        this.inventory[it.cfg.id] = true;
        this.sound.pickup();
        this.particles.burst('✨', player.position.clone().add(new THREE.Vector3(0, 1, 0)), { count: 8, size: 0.4 });
        toast(`You found ${it.cfg.name}! ${it.cfg.emoji}`);
        this._updateHUD();
      }
    }

    // meadow flowers: walk through them to pick; three make a necklace
    for (const fl of this.world.flowers) {
      if (fl.picked) continue;
      const dx = fl.x - player.position.x, dz = fl.z - player.position.z;
      if (dx * dx + dz * dz < 1.69) this._pickFlower(fl, t, player);
    }

    // lost ducklings: run to player when near, then follow loosely
    for (const d of this.ducklings) {
      if (d.state === 'lost') {
        d.cr.update(dt, t, false);
        if (d.cr.group.position.distanceTo(player.position) < 5) {
          const mabel = this._mabel();
          this.sound.pickup();
          this.particles.burst('🐥', d.cr.group.position.clone().add(new THREE.Vector3(0, 0.6, 0)), { count: 5, size: 0.35 });
          if (mabel.state === 'waiting') {
            d.state = 'following';
            toast(`A duckling peeps and waddles after you! (${this.countDucklingsFollowing()}/3)`);
          } else if (mabel.state === 'following') {
            // slot in behind Mabel and any siblings already with her
            d.state = 'withDuck';
            let at = this.followers.indexOf(mabel) + 1;
            while (this.followers[at] && this.followers[at].state === 'withDuck' && !this.followers[at].cfg) at++;
            this.followers.splice(at, 0, d);
            toast('A duckling peeps and races back to Mabel! 🐥');
          } else {
            // Mabel is already at the grove: the duckling heads there on its own
            d.state = 'homing';
            d.homeSpot = this._ducklingSpot(mabel);
            toast('A duckling peeps and sets off for the grove to find Mabel! 🐥');
          }
          this._updateHUD();
        }
      } else if (d.state === 'following') {
        this._moveToward(d, player.position, dt, t, 2.2, 5.5);
      }
    }

    // friends
    const target = new THREE.Vector3();
    let lineBack = 0;
    for (const fw of this.followers) {
      lineBack += (fw.space || 1.8) + 0.6;
      if (fw.state !== 'following' && fw.state !== 'withDuck') continue;
      if (this.sampleTrail(lineBack, target)) {
        target.y = 0;
        this._moveToward(fw, target, dt, t, 1.4, 8.2);
      }
    }

    for (const f of this.friends) {
      const d = f.cr.group.position.distanceTo(player.position);
      if (f.state === 'waiting') {
        if (this._updateSkittish(f, d, dt, t, player)) continue;
        f.cr.update(dt, t, false);
        // idle turn
        f.wanderT -= dt;
        if (f.wanderT < 0) { f.wanderT = 3 + Math.random() * 5; f.targetRot = f.cr.group.rotation.y + (Math.random() - 0.5) * 1.6; }
        if (f.targetRot !== undefined) {
          f.cr.group.rotation.y += (f.targetRot - f.cr.group.rotation.y) * Math.min(1, dt * 2);
        }
        // face player when near
        if (d < 6) {
          const dx = player.position.x - f.cr.group.position.x;
          const dz = player.position.z - f.cr.group.position.z;
          f.targetRot = Math.atan2(dx, dz);
        }
        f.icon.position.y = this._iconH(f.cfg.id) + Math.sin(t * 2 + f.cr.phase) * 0.08;
      } else if (f.state === 'homing') {
        this._moveToward(f, f.homeSpot, dt, t, 1.6, 5);
        if (Math.hypot(f.cr.group.position.x - f.homeSpot.x, f.cr.group.position.z - f.homeSpot.z) < 1.2) {
          f.state = 'home';
          this.homed++;
          const rune = this.world.runes[f.runeIndex];
          rune.lit = true;
          rune.glow.material.opacity = 0.95;
          rune.glow.material.color.set(0xaffff0);
          rune.stone.material.emissive = new THREE.Color(0x1d6a58);
          this.sound.rune();
          this.particles.burst('✨', rune.glow.position.clone().add(this.world.grove.position), { count: 12, size: 0.4 });
          this._updateHUD();
          if (this.homed >= FRIENDS.length && !this.finaleStarted) this._startFinale();
        }
      } else if (f.state === 'home') {
        // gentle celebratory bobbing; face the portal
        const dx = this.world.grove.position.x - f.cr.group.position.x;
        const dz = this.world.grove.position.z - f.cr.group.position.z;
        f.cr.group.rotation.y = Math.atan2(dx, dz);
        f.cr.update(dt, t, false);
        if (this.finaleStarted) {
          f.cr.group.position.y = Math.max(heightAt(f.cr.group.position.x, f.cr.group.position.z), 0.02) +
            Math.abs(Math.sin(t * 3 + f.cr.phase)) * 0.18;
        }
      }
    }

    this._updateCritters(dt, t, player);
    this._updateRiders(dt, t, player);
    this.aura = Math.min(AURA_MAX, AURA_BASE + AURA_PER_FRIEND * this._paradeFriends());
    this._updateCalm(dt, t, player, playerMoving);
    this._updateAuraRing(dt, t, player);

    // grove delivery
    const groveD = Math.hypot(player.position.x - GROVE.x, player.position.z - GROVE.z);
    if (groveD < 11) {
      for (const f of this.friends) {
        if (f.state === 'following') {
          f.state = 'homing';
          f.runeIndex = this._nextRune();
          f.homeSpot = this.world.runes[f.runeIndex].spot.clone();
          // remove from conga
          const i = this.followers.indexOf(f);
          if (i >= 0) this.followers.splice(i, 1);
          if (f.cfg.id === 'duck') {
            for (const d of this.ducklings) {
              if (d.state !== 'withDuck') continue;   // lost ones stay lost until found
              d.state = 'homing';
              d.homeSpot = this._ducklingSpot(f);
              const j = this.followers.indexOf(d);
              if (j >= 0) this.followers.splice(j, 1);
            }
          }
        }
      }
    }
    for (const d of this.ducklings) {
      if (d.state === 'homing') {
        this._moveToward(d, d.homeSpot, dt, t, 2, 5);
        if (Math.hypot(d.cr.group.position.x - d.homeSpot.x, d.cr.group.position.z - d.homeSpot.z) < 0.8) d.state = 'home';
      } else if (d.state === 'home') d.cr.update(dt, t, false);
    }

    // first footfall on a neighbour island
    {
      const px = player.position.x, pz = player.position.z;
      const isl = heightAt(px, pz) > -0.3 ? this.world.islandAt(px, pz) : null;
      if (isl && isl.arrive && !this.visited.has(isl.id)) {
        this.visited.add(isl.id);
        toast(isl.arrive, 4800);
        this.sound.pickup();
      }
    }

    // hot spring boost
    const springD = this.world.springDist(player.position.x, player.position.z);
    if (springD < 3.4) {
      const spr = this.world.springAt(player.position.x, player.position.z);
      if (t - this.springToastAt > 16 || (spr && spr !== this.lastSpring && t - this.springToastAt > 4)) {
        this.springToastAt = t;
        toast((spr || this.world.springs[0]).line);
        this.sound.pickup();
      }
      this.lastSpring = spr;
      this.boostUntil = t + 10;
      if (Math.random() < dt * 3) {
        this.particles.burst('✨', player.position.clone().add(new THREE.Vector3(0, 0.8, 0)), { count: 2, size: 0.3, up: 1.4, life: 0.9 });
      }
    }

    // ocelot + zen
    this._updateOcelot(dt, t, player);
    this._updateDolphin(dt, t, player, playerMoving);
    this._updateZen(dt, t, player, playerMoving, springD);

    // finale progression
    if (this.finaleStarted) this._updateFinale(dt, t);

    // prompt card
    this._updatePrompt(player.position);
  }

  // ----- critters: idle, startle, gather at the finale -----
  _updateCritters(dt, t, player) {
    for (const c of this.critters) {
      const g = c.cr.group;
      if (c.state === 'waiting') {
        const d = g.position.distanceTo(player.position);
        if (this._updateSkittish(c, d, dt, t, player)) continue;
        c.cr.update(dt, t, false);
        if (d < 6) {   // turn to look at you
          let diff = Math.atan2(player.position.x - g.position.x, player.position.z - g.position.z) - g.rotation.y;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          g.rotation.y += diff * Math.min(1, dt * 3);
        }
        if (c.cr.wings) for (const [i, w] of c.cr.wings.entries()) w.rotation.z = (i ? -1 : 1) * Math.max(0, Math.sin(t * 3 + c.cr.phase)) ** 8 * 0.9;
      } else if (c.state === 'gathering') {
        this._moveToward(c, c.homeSpot, dt, t, 1.6, 5);
        if (Math.hypot(g.position.x - c.homeSpot.x, g.position.z - c.homeSpot.z) < 1) c.state = 'gathered';
      } else if (c.state === 'gathered') {
        g.rotation.y = Math.atan2(GROVE.x - g.position.x, GROVE.z - g.position.z);
        c.cr.update(dt, t, false);
        g.position.y = Math.max(heightAt(g.position.x, g.position.z), 0.02) + Math.abs(Math.sin(t * 3 + c.cr.phase)) * 0.12;
      }
    }
  }

  _recruitCritter(c, t, player) {
    c.trust = 1;
    c.cr.noSwim = false;
    if (this.calming === c) this.calming = null;
    this.particles.burst('💗', c.cr.group.position.clone().add(new THREE.Vector3(0, c.cfg.iconH, 0)), { count: 6, size: 0.35 });
    let line = c.cfg.calmed;
    const stack = c.cfg.ride && (this.riders[c.cfg.ride].length < RIDE_CAP ? this.riders[c.cfg.ride]
      : this.riders.back.length < RIDE_CAP ? this.riders.back : this.riders.head.length < RIDE_CAP ? this.riders.head : null);
    if (stack) {
      this.sound.pickup();
      this._mountRider(c, stack, player);
      if (!this.riderTold) {
        this.riderTold = true;
        line += '  Little friends ride along, and they count toward your parade.';
      }
    } else {
      c.state = 'following';
      this.followers.push(c);
      this.sound.friendJoin(3 + Math.floor(Math.random() * 3));
      if (!this.cousinTold) {
        this.cousinTold = true;
        line += '  Cousins walk in your parade and widen your circle of calm.';
      }
    }
    toast(line, 4600);
    this._updateHUD();
  }

  // a rider hops in an arc to the top of its stack, then rides a sway pivot.
  // Pivots nest (each sits on the previous rider), so a tall stack whips.
  _mountRider(c, stack, player) {
    const slot = stack === this.riders.head ? this.player.slots.head : this.player.slots.back;
    const below = stack[stack.length - 1];
    c.pivot = new THREE.Group();
    c.pivot.position.y = below ? below.cr.top : 0;
    (below ? below.pivot : slot).add(c.pivot);
    c.spring = { ax: 0, vx: 0, az: 0, vz: 0 };
    c.hop = { k: 0, from: c.cr.group.position.clone() };
    c.state = 'mounting';
    c.cr.shadow.visible = false;
    c.cr.swimming = false;
    for (const L of c.cr.legs) L.visible = true;
    stack.push(c);
  }

  _updateRiders(dt, t, player) {
    // player acceleration in its own frame, low-passed so frame jitter doesn't shake the stack
    const p = player.position;
    if (!this._lastP) this._lastP = p.clone();
    const vx = (p.x - this._lastP.x) / dt, vz = (p.z - this._lastP.z) / dt;
    this._lastP.copy(p);
    const jump = Math.hypot(vx, vz) > 30;   // a teleport, not a stride
    const ax = jump ? 0 : (vx - this._vel.x) / dt, az = jump ? 0 : (vz - this._vel.y) / dt;
    if (!jump) this._vel.set(vx, vz);
    else this._vel.set(0, 0);
    const k = Math.min(1, dt / 0.12);
    this._acc.x += (Math.max(-60, Math.min(60, ax)) - this._acc.x) * k;
    this._acc.y += (Math.max(-60, Math.min(60, az)) - this._acc.y) * k;
    const ry = player.rotation.y, sin = Math.sin(ry), cos = Math.cos(ry);
    const aFwd = this._acc.x * sin + this._acc.y * cos;       // along facing (+z local)
    const aSide = this._acc.x * cos - this._acc.y * sin;      // along local +x
    // inertia tips riders against the acceleration
    const tx = Math.max(-0.45, Math.min(0.45, -aFwd * 0.012));
    const tz = Math.max(-0.45, Math.min(0.45, aSide * 0.012));
    const moving = Math.hypot(this._vel.x, this._vel.y) > 1;

    for (const stack of [this.riders.head, this.riders.back]) {
      for (const c of stack) {
        const g = c.cr.group;
        if (c.state === 'mounting') {
          c.hop.k = Math.min(1, c.hop.k + dt / 0.55);
          const to = c.pivot.getWorldPosition(new THREE.Vector3());
          g.position.lerpVectors(c.hop.from, to, c.hop.k);
          g.position.y += 4 * 1.3 * c.hop.k * (1 - c.hop.k);
          g.rotation.y = player.rotation.y;
          if (c.hop.k >= 1) {
            c.state = 'riding';
            c.pivot.add(g);
            g.position.set(0, 0, 0);
            g.rotation.set(0, 0, 0);
          }
          continue;
        }
        // damped spring toward the inertia lean: lags, then wobbles when you stop
        const S = c.spring;
        S.vx += ((tx - S.ax) * 55 - S.vx * 6) * dt; S.ax += S.vx * dt;
        S.vz += ((tz - S.az) * 55 - S.vz * 6) * dt; S.az += S.vz * dt;
        c.pivot.rotation.set(S.ax, 0, S.az);
        c.cr.update(dt, t, false);
        if (c.cr.wings) {
          const flap = moving ? Math.abs(Math.sin(t * 26 + c.cr.phase)) * 0.9 : Math.max(0, Math.sin(t * 3 + c.cr.phase)) ** 8 * 0.6;
          c.cr.wings[0].rotation.z = flap; c.cr.wings[1].rotation.z = -flap;
        }
        // squeak-answer hop
        if (c.hopAt != null && t > c.hopAt) { c.hopAt = null; c.hopV = 2.2; c.hopY = 0; }
        if (c.hopV) {
          c.hopY += c.hopV * dt; c.hopV -= 12 * dt;
          if (c.hopY <= 0) { c.hopY = 0; c.hopV = 0; }
        }
        g.position.y = c.hopY || 0;
      }
    }
    // a napping capybara is a napping stack
    if (this.napping && this._riderCount()) {
      this._riderZT = (this._riderZT ?? 0) - dt;
      if (this._riderZT <= 0) {
        this._riderZT = 2.3;
        const top = this.riders.back[this.riders.back.length - 1] || this.riders.head[this.riders.head.length - 1];
        if (top && top.state === 'riding') {
          this.particles.burst('💤', top.cr.group.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.4, 0)),
            { count: 1, size: 0.28, up: 0.6, speed: 0.15, life: 1.5, gravity: 0.3, spread: 0.1 });
        }
      }
    }
    if (this.finaleStarted && Math.random() < dt * 0.5) {
      for (const c of [...this.riders.head, ...this.riders.back]) c.hopAt = t + Math.random() * 0.4;
    }
  }

  // ----- the aura ring: shows only when it matters (a waiting friend nearby) -----
  _updateAuraRing(dt, t, player) {
    let want = 0;
    if (!this.finaleStarted && !this.wanderingOff) {
      for (const f of this._waitingAll()) {
        const d = f.cr.group.position.distanceTo(player.position);
        if (d < this.aura + 4) want = Math.max(want, this.calmState === 'calming' ? 0.85 : 0.5);
      }
    }
    this.auraOpacity += (want - this.auraOpacity) * Math.min(1, dt * 3);
    this.auraShown += (this.aura - this.auraShown) * Math.min(1, dt * 1.5);   // grows gently
    const ring = this.auraRing;
    ring.visible = this.auraOpacity > 0.01;
    if (!ring.visible) return;
    ring.material.opacity = this.auraOpacity * (0.75 + 0.25 * Math.sin(t * 2.4));
    const pos = ring.geometry.attributes.position;
    const px = player.position.x, pz = player.position.z, spin = t * 0.12;
    for (let i = 0; i < AURA_MOTES; i++) {
      const a = (i / AURA_MOTES) * Math.PI * 2 + spin;
      const r = this.auraShown * (1 + Math.sin(t * 1.7 + i * 1.3) * 0.015);
      const x = px + Math.cos(a) * r, z = pz + Math.sin(a) * r;
      pos.setXYZ(i, x, Math.max(heightAt(x, z), 0) + 0.12 + Math.sin(t * 2 + i) * 0.04, z);
    }
    pos.needsUpdate = true;
  }

  // ----- skittish friends: bolt from a small parade, drift back home -----
  // returns true while it's handling the friend's movement this frame
  _updateSkittish(f, d, dt, t, player) {
    if (!f.cfg.auraNeed) return false;
    const g = f.cr.group;
    if (d < FLEE_R && this._startles(f) && t >= f.fleeUntil && !this.finaleStarted) {
      // pick the most "away" direction that stays near home and out of the sea
      const ax = g.position.x - player.position.x, az = g.position.z - player.position.z;
      const base = Math.atan2(ax, az);
      let best = null;
      for (const off of [0, 0.7, -0.7, 1.4, -1.4, 2.1, -2.1]) {
        const a = base + off;
        const tx = g.position.x + Math.sin(a) * 6, tz = g.position.z + Math.cos(a) * 6;
        if (Math.hypot(tx - f.home.x, tz - f.home.z) > FLEE_LEASH) continue;
        if (-heightAt(tx, tz) >= f.cr.swimSink * 0.8) continue;
        best = { x: tx, z: tz }; break;
      }
      f.fleeTo = best;   // null = cornered: she just stands there, ruffled
      f.fleeUntil = t + 2.2;
      f.returnAt = t + 6;
      this.particles.burst('💨', g.position.clone().add(new THREE.Vector3(0, 1, 0)), { count: 3, size: 0.4 });
      if (!this.fleeTold) {
        this.fleeTold = true;
        this.sound.denied();
        toast(`${shortName(f.cfg)} startles and hurries off! Only a bigger parade will put them at ease. (${this._paradeFriends()}/${f.cfg.auraNeed} friends)`, 5000);
      }
    }
    if (t < f.fleeUntil) {
      if (f.fleeTo) this._moveToward(f, f.fleeTo, dt, t, 2.5, 6.5);
      else f.cr.update(dt, t, false);
      return true;
    }
    const homeD = Math.hypot(g.position.x - f.home.x, g.position.z - f.home.z);
    if (homeD > 0.6 && t > f.returnAt && (d > FLEE_R + 2 || !this._startles(f))) {
      this._moveToward(f, { x: f.home.x, z: f.home.z }, dt, t, 0.8, 2);
      return true;
    }
    return false;
  }

  // ----- trust: sit still near a waiting friend and share your calm -----
  _updateCalm(dt, t, player, moving) {
    this.calmDrain = 0;
    this.calmState = null;
    const f = this.wanderingOff || this.finaleStarted ? null : this.nearestActionable(player.position);
    if (!f) { this.calming = null; return; }
    const tier = TIERS[f.cfg.tier];
    const who = shortName(f.cfg);
    if (this._startles(f)) {
      // too small a parade: no amount of sitting still will do it
      this.calming = null;
      this.calmState = 'startled';
      return;
    }
    if (moving) {
      // walking away (or fidgeting) pauses a session; trust is never lost
      this.calming = null;
      this.calmState = 'idle';
      return;
    }
    // the zen floor gates *starting* to settle; a friend who has already
    // begun to trust you picks up where you left off
    if (this.calming !== f && f.trust === 0 && this.zen < tier.floor) {
      this.calmState = 'wary';
      if (!this.waryTold) {
        this.waryTold = true;
        this.sound.denied();
        toast(`${who} is too skittish to settle near someone so frazzled. Nap or soak first, then come back calmer (zen ${tier.floor}+). 🌿`, 5200);
      }
      return;
    }
    this.calming = f;
    // out of calm to share: the session waits for you, nothing is lost.
    // Resume only once you've recovered a little, so it doesn't flicker.
    if (this.zen <= SPEND_FLOOR + 0.01) this.calmLow = true;
    else if (this.zen >= SPEND_FLOOR + 5) this.calmLow = false;
    if (this.calmLow) {
      this.calmState = 'low';
      if (!this.lowTold) {
        this.lowTold = true;
        toast(`You've shared all the calm you can spare. Rest a moment — ${who} will wait. 💤`, 4800);
      }
      return;
    }
    this.calmState = 'calming';
    if (!this.calmTold) {
      this.calmTold = true;
      toast(`${who} begins to relax around you 💗  Sharing calm costs a little zen.`, 4600);
    }
    // napping beside a friend is the fastest way to their heart
    f.trust = Math.min(1, f.trust + dt / (f.cfg.fill || FILL_TIME) * (this.napping ? 2 : 1));
    this.calmDrain = tier.drain;
    if (Math.random() < dt * 1.6) {
      this.particles.burst('💗', f.cr.group.position.clone().add(new THREE.Vector3(0, (f.cfg.iconH ?? this._iconH(f.cfg.id)) - 0.3, 0)),
        { count: 1, size: 0.3, up: 1, speed: 0.3, life: 1.1, gravity: 0.2, spread: 0.3 });
    }
    if (f.trust >= 1) {
      if (f.cfg.kind) this._recruitCritter(f, t, player);
      else this._befriend(f, { line: f.cfg.calmed });
    }
  }

  // ----- ocelot: prowls, stalks, and is politely outnumbered -----
  _updateOcelot(dt, t, player) {
    const o = this.ocelot;
    const g = o.cr.group;
    const pd = Math.hypot(player.position.x - g.position.x, player.position.z - g.position.z);
    const procession = this.followers.length + this._riderCount();   // riders look fierce too
    this.stressed = false;

    if (this.finaleStarted && o.state !== 'retreat') {
      // even the ocelot attends the Gathering, from a respectful distance
      o.state = 'calmed';
    }

    if (o.state === 'prowl') {
      if (pd < 12 && t > o.calmUntil) {
        if (procession >= 3) {
          o.state = 'retreat';
          o.retreatT = 0;
          if (!o.toldOff) {
            o.toldOff = true;
            toast('The ocelot eyes your parade… and thinks better of it. Your calm outnumbers its menace. 🐾');
          }
          this.particles.burst('💨', g.position.clone().add(new THREE.Vector3(0, 0.8, 0)), { count: 4, size: 0.35 });
        } else {
          o.state = 'stalk';
          if (t - o.stungAt > 20) {
            o.stungAt = t;
            this.sound.stress();
            this.particles.burst('❗', g.position.clone().add(new THREE.Vector3(0, 1.2, 0)), { count: 1, size: 0.5, up: 1, life: 1.2 });
            toast('An ocelot is watching. Your zen is draining — more friends, or more distance. 🐆', 3800);
          }
        }
      } else {
        o.angle += dt * 0.22;
        const tx = o.cx + Math.cos(o.angle) * o.r;
        const tz = o.cz + Math.sin(o.angle) * o.r;
        this._moveToward(o, { x: tx, z: tz }, dt, t, 1.2, 2.2);
      }
    } else if (o.state === 'stalk') {
      // frozen, staring; slow low creep toward the player, never closing fully
      const dx = player.position.x - g.position.x, dz = player.position.z - g.position.z;
      g.rotation.y = Math.atan2(dx, dz);
      if (pd > 5) {
        const step = 0.55 * dt;
        const solid = this.world.collide(
          g.position.x + (dx / pd) * step, g.position.z + (dz / pd) * step, 0.5);
        if (heightAt(solid.x, solid.z) >= 0.08) {   // stalks along the shore, never in
          g.position.x = solid.x;
          g.position.z = solid.z;
        }
      }
      g.position.y = Math.max(heightAt(g.position.x, g.position.z), 0.02);
      o.cr.update(dt, t, false);
      this.stressed = pd < 12;
      if (pd > 14) o.state = 'prowl';
      if (procession >= 3) { o.state = 'retreat'; o.retreatT = 0; }
    } else if (o.state === 'retreat') {
      o.retreatT += dt;
      const away = new THREE.Vector3(g.position.x - player.position.x, 0, g.position.z - player.position.z).normalize();
      this._moveToward(o, {
        x: g.position.x + away.x * 6, z: g.position.z + away.z * 6,
      }, dt, t, 2.5, 6);
      if (o.retreatT > 3.5) { o.state = 'prowl'; o.calmUntil = t + 25; }
    } else if (o.state === 'calmed') {
      o.cr.update(dt, t, false);
    }
  }

  // ----- dolphin: stranded → pushed home by the parade → plays offshore -----
  _friendsInParade(near, r) {
    return this.followers.filter((f) => f.cfg && f.cr.group.position.distanceTo(near) < r).length;
  }

  _updateDolphin(dt, t, player, moving) {
    const D = this.dolphin, g = D.cr.group, p = g.position;
    const pd = Math.hypot(player.position.x - p.x, player.position.z - p.z);
    this.dolphinTow = false;

    if (D.state === 'stranded') {
      // sad little flops and a dry puff from the blowhole
      D.cr.fluke.rotation.x = Math.max(0, Math.sin(t * 1.4)) ** 6 * -0.5;
      D.icon.position.y = 1.9 + Math.sin(t * 2) * 0.08;
      if (Math.random() < dt * 0.4) {
        this.particles.burst('💦', p.clone().add(new THREE.Vector3(0, 1.1, 0)), { count: 1, size: 0.3, up: 1.4, life: 0.8, spread: 0.1 });
      }
      if (!D.noticed && pd < 12) {
        D.noticed = true;
        toast('A dolphin is stranded on the sand! 🐬 It needs to get back to the sea…', 4500);
      }
      // pushing: in contact on the land side, walking toward the sea
      const toD = new THREE.Vector3(p.x - player.position.x, 0, p.z - player.position.z);
      const fwd = new THREE.Vector3(Math.sin(g.rotation.y), 0, Math.cos(g.rotation.y));
      const along = Math.max(-0.8, Math.min(0.8, -toD.dot(fwd)));       // closest point on its axis
      const gap = Math.hypot(p.x + fwd.x * along - player.position.x, p.z + fwd.z * along - player.position.z);
      const face = new THREE.Vector3(Math.sin(player.rotation.y), 0, Math.cos(player.rotation.y));
      const pushing = moving && gap < 1.45 && toD.dot(D.sea) > 0.2 && face.dot(D.sea) > 0.5;
      if (pushing) {
        const helpers = this._friendsInParade(p, 15);
        if (helpers >= DOLPHIN.helpersNeeded) {
          const step = 0.45 * dt;
          p.x += D.sea.x * step;
          p.z += D.sea.z * step;
          if (!D.heaveTold) {
            D.heaveTold = true;
            toast('Everybody PUSH! The whole parade leans in… 💪', 3000);
          }
          if (Math.random() < dt * 4) {
            this.particles.burst('💨', p.clone().add(new THREE.Vector3(0, 0.2, 0)).addScaledVector(D.sea, -0.6),
              { count: 1, size: 0.35, up: 0.6, life: 0.6 });
          }
        } else {
          g.rotation.z = Math.sin(t * 22) * 0.04;   // budges, but no
          if (t - D.nagAt > 5) {
            D.nagAt = t;
            this.sound.denied();
            toast(helpers === 0
              ? `Hnnngh! Too heavy for one capybara. Bring friends to help push! (0/${DOLPHIN.helpersNeeded})`
              : `Heave! Not quite… you need more friends pushing with you. (${helpers}/${DOLPHIN.helpersNeeded})`, 3600);
          }
        }
      } else {
        g.rotation.z = 0;
      }
      const h = heightAt(p.x, p.z);
      p.y = Math.max(h, -0.3);
      D.cr.shadow.visible = h >= 0;
      if (h < -0.7) this._freeDolphin(t);
      return;
    }

    // ---- free: play offshore; swim beside the capybara when it's in the sea ----
    // home water stays close to the beach (it was sized for the old ISLAND_R + 4 swim limit)
    const home = { x: DOLPHIN.x + D.sea.x * 5.5, z: DOLPHIN.z + D.sea.z * 5.5 };
    let tx, tz, maxSp;
    const companion = this.playerSwimming && pd < 14;
    if (companion) {
      // swim beside the capybara, aiming a little ahead so it stays alongside at speed;
      // keep to whichever side has deep water (it won't follow into the shallows)
      const fx = Math.sin(player.rotation.y), fz = Math.cos(player.rotation.y);
      const beside = (s) => [player.position.x - fz * 1.7 * s + fx, player.position.z + fx * 1.7 * s + fz];
      [tx, tz] = beside(D.side);
      if (heightAt(tx, tz) >= -0.7) { D.side = -D.side; [tx, tz] = beside(D.side); }
      maxSp = 10;
    } else {
      D.angle += dt * 0.35;
      tx = home.x + Math.cos(D.angle) * 3; tz = home.z + Math.sin(D.angle) * 3;
      maxSp = 3.5;
    }
    const dx = tx - p.x, dz = tz - p.z, dist = Math.hypot(dx, dz);
    if (dist > 0.2 && heightAt(tx, tz) < -0.7) {
      const sp = Math.min(maxSp, dist * 4);
      const nx = p.x + (dx / dist) * sp * dt, nz = p.z + (dz / dist) * sp * dt;
      if (heightAt(nx, nz) < -0.7) { p.x = nx; p.z = nz; }
      let diff = Math.atan2(dx, dz) - g.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      g.rotation.y += diff * Math.min(1, dt * 5);
    }
    if (companion && pd < 3.2) {
      this.dolphinTow = true;
      if (!D.towTold && t - D.freedAt > 6) {   // let the thank-you toast finish first
        D.towTold = true;
        toast('The dolphin swims right beside you — whoosh, you’re zooming! 🐬💨', 4000);
      }
    }
    // leaps for joy when it's on its own
    if (D.leapT < 0 && !companion && t > D.leapAt) {
      D.leapT = 0;
      this.particles.burst('💦', p.clone().setY(0.2), { count: 4, size: 0.3, up: 2.2 });
    }
    let y = -0.3 + Math.sin(t * 2.2) * 0.05;
    g.rotation.x = 0;
    if (D.leapT >= 0) {
      D.leapT += dt / 1.2;
      const k = Math.min(1, D.leapT);
      y = -0.3 + 4 * 1.7 * k * (1 - k);
      g.rotation.x = (k - 0.5) * 1.6;   // nose up, then nose down
      if (k >= 1) {
        D.leapT = -1;
        D.leapAt = t + 4 + Math.random() * 4;
        this.particles.burst('💦', p.clone().setY(0.2), { count: 5, size: 0.3, up: 2 });
        this.spawnRipple(p.x, p.z, 1.3);
      }
    }
    p.y = y;
    D.cr.fluke.rotation.x = Math.sin(t * (companion ? 9 : 5)) * 0.35;
    D.rippleT -= dt;
    if (D.rippleT <= 0 && D.leapT < 0) { this.spawnRipple(p.x, p.z, 1.1); D.rippleT = companion ? 0.4 : 0.9; }
  }

  _freeDolphin(t) {
    const D = this.dolphin;
    D.state = 'free';
    D.freedAt = t;
    D.icon.visible = false;
    D.cr.shadow.visible = false;
    D.cr.group.rotation.z = 0;
    D.angle = Math.atan2(D.cr.group.position.z - (DOLPHIN.z + D.sea.z * 5.5), D.cr.group.position.x - (DOLPHIN.x + D.sea.x * 5.5));
    D.leapAt = t + 1.2;
    this.sound.splash();
    this.sound.friendJoin(7);
    const pos = D.cr.group.position.clone().setY(0.8);
    this.particles.burst('💦', pos, { count: 10, size: 0.4, up: 3 });
    this.particles.burst('💙', pos, { count: 6, size: 0.45 });
    this.zen = Math.min(100, this.zen + 15);
    for (const fw of this.followers) fw.hopAt = t + 0.1 + Math.random() * 0.4;   // the parade cheers
    toast('SPLASH! The dolphin is free! It clicks a happy thank-you and leaps for joy. 🐬💙  (Swim out to say hi!)', 5500);
  }

  // ----- zen -----
  _updateZen(dt, t, player, moving, springD) {
    // ambient regen is generous below the set point, a trickle above it
    const belowSet = this.zen < 60;
    // while you're sharing calm, your own resting regen (ambient + nap) goes
    // to the friend instead — the spring and friend piles still top you up
    let delta = this.calmDrain ? 0
      : this.napping ? 8 : (moving ? (belowSet ? 0.3 : 0) : (belowSet ? 1.2 : 0.15));
    if (springD < 3.4) delta += 6;
    // chaos zones: gentle, legible, and always parked next to something you want
    for (const zone of this.world.chaosZones) {
      const zd = Math.hypot(player.position.x - zone.x, player.position.z - zone.z);
      if (zd < zone.r) {
        delta -= 2.5;
        if (!zone.warned) {
          zone.warned = true;
          this.sound.stress();
          toast(zone.warning, 4200);
        }
        if (Math.random() < dt * 1.2) {
          this.particles.burst(zone.emoji, player.position.clone().add(new THREE.Vector3(0, 1.4, 0)),
            { count: 1, size: 0.4, up: 1.2, life: 1 });
        }
      }
    }
    // the pile bonus: every friend nearby is a little weighted blanket
    let near = 0;
    for (const fw of this.followers) {
      if (fw.cr.group.position.distanceTo(player.position) < 7) near++;
    }
    near += this._riderCount();   // riders are always close
    delta += Math.min(4, near * 0.6);
    if (this.stressed) {
      const od = Math.hypot(player.position.x - this.ocelot.cr.group.position.x,
        player.position.z - this.ocelot.cr.group.position.z);
      delta -= (1 - Math.min(1, od / 12)) * 9 + 3;
    }
    if (this.finaleStarted) delta = Math.max(delta, 10); // perfect calm settles
    this.zen = Math.max(0, Math.min(100, this.zen + delta * dt));
    // calm given away never pushes you below the spending floor
    if (this.calmDrain) this.zen = Math.max(Math.min(this.zen, SPEND_FLOOR), this.zen - this.calmDrain * dt);
    $('zen-wrap').classList.toggle('giving', this.calmDrain > 0);

    // HUD ring
    const arc = $('zen-arc');
    arc.style.strokeDashoffset = (150.8 * (1 - this.zen / 100)).toFixed(1);
    arc.style.stroke = this.zen > 60 ? '#a8e8c8' : this.zen > 30 ? '#ffd98a' : '#ff9a80';
    const face = this.napping ? '😴' : this.zen > 66 ? '😌' : this.zen > 33 ? '🙂' : '😟';
    if (face !== this.zenFaceState) {
      this.zenFaceState = face;
      $('zen-face').textContent = face;
    }
    // low-zen vignette creep (full stress-out handled in main)
    const vig = document.getElementById('vignette');
    if (!this.wanderingOff) {
      vig.style.opacity = this.zen < 35 ? ((35 - this.zen) / 35 * 0.7).toFixed(2) : 0;
    }
    if (!this.zenHintShown && this.zen < 45) {
      this.zenHintShown = true;
      toast('Your zen is fading. Nap 💤, soak in the hot spring, or keep friends close. 🌿', 5200);
    }
  }

  // push (x,z) out of dynamic bodies (ocelot + friends); `skip` excludes self
  separate(x, z, r, skip) {
    const bump = (bg, br) => {
      const dx = x - bg.position.x, dz = z - bg.position.z;
      const min = br + r;
      if (dx > min || dx < -min || dz > min || dz < -min) return;
      const d2 = dx * dx + dz * dz;
      if (d2 >= min * min) return;
      if (d2 === 0) { x += min; return; }   // perfectly stacked: pick a direction
      const d = Math.sqrt(d2);
      x += dx * ((min - d) / d);
      z += dz * ((min - d) / d);
    };
    if (this.ocelot && this.ocelot.cr !== skip) bump(this.ocelot.cr.group, 0.55);
    if (this.dolphin && this.dolphin.state === 'stranded') {
      // long body: two circles along its axis
      const dg = this.dolphin.cr.group, fx = Math.sin(dg.rotation.y), fz = Math.cos(dg.rotation.y);
      for (const s of [-0.6, 0.6]) {
        bump({ position: { x: dg.position.x + fx * s, z: dg.position.z + fz * s } }, 0.7);
      }
    }
    for (const f of this.friends) {
      if (f.cr !== skip) bump(f.cr.group, Math.min(f.cr.shadowR, 1.1) * 0.7);
    }
    for (const c of this.critters) {
      if (c.cfg.kind === 'cousin' && c.cr !== skip) bump(c.cr.group, 0.5);
    }
    return { x, z };
  }

  _moveToward(fw, target, dt, t, speedMul, maxSpeed) {
    const g = fw.cr.group;
    const dx = target.x - g.position.x, dz = target.z - g.position.z;
    const dist = Math.hypot(dx, dz);
    let moving = false;
    if (dist > 0.25) {
      const sp = Math.min(maxSpeed, dist * speedMul);
      let nx = g.position.x + (dx / dist) * sp * dt;
      let nz = g.position.z + (dz / dist) * sp * dt;
      if (fw._noClipT > 0) {
        // wriggling free of a wedge: ignore obstacles briefly
        fw._noClipT -= dt;
      } else {
        const solid = this.world.collide(nx, nz, Math.min(fw.cr.shadowR, 0.8) * 0.7);
        nx = solid.x; nz = solid.z;
      }
      if (fw.landOnly && heightAt(nx, nz) < 0.08) {
        nx = g.position.x; nz = g.position.z;   // refuse to step into water
      }
      if (fw.cr.noSwim && -heightAt(nx, nz) >= fw.cr.swimSink * 0.8) {
        nx = g.position.x; nz = g.position.z;   // wade, yes; swim off, no
      }
      // stuck watchdog: intent to move but no progress → wriggle free
      const stepped = Math.hypot(nx - g.position.x, nz - g.position.z);
      if (dist > 1.4 && !fw.landOnly) {
        if (stepped < sp * dt * 0.2) {
          fw._stuckT = (fw._stuckT || 0) + dt;
          if (fw._stuckT > 2) {
            fw._stuckT = 0;
            fw._noClipT = 1.3;
            this.particles.burst('💨', g.position.clone().add(new THREE.Vector3(0, 0.8, 0)), { count: 3, size: 0.35 });
          }
        } else {
          fw._stuckT = 0;
        }
      }
      g.position.x = nx;
      g.position.z = nz;
      const ry = Math.atan2(dx, dz);
      let diff = ry - g.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      g.rotation.y += diff * Math.min(1, dt * 8);
      moving = dist > 0.5;
    }
    // wade on the floor while it's shallow for this species, float once it isn't
    const cr = fw.cr;
    const h = heightAt(g.position.x, g.position.z);
    const swimming = !fw.landOnly && -h >= cr.swimSink;
    if (swimming && !cr.swimming) {
      this.particles.burst('💧', g.position.clone().setY(0.3), { count: 3, size: 0.25, up: 1.6 });
    }
    cr.swimming = swimming;
    g.position.y = swimming ? -cr.swimSink : h;
    for (const L of cr.legs) L.visible = !swimming;
    cr.shadow.visible = h >= 0;
    if (h < -0.02) {
      fw._rippleT = (fw._rippleT ?? 0) - dt;
      if (fw._rippleT <= 0) {
        this.spawnRipple(g.position.x, g.position.z, Math.min(1.3, cr.shadowR) * (swimming ? 1 : 0.7));
        fw._rippleT = moving ? 0.5 : 1.3;
      }
    }
    // squeak-answer hop
    if (fw.hopAt != null && t > fw.hopAt) { fw.hopAt = null; fw.hopV = 3.2; fw.hopY = 0; }
    if (fw.hopV) {
      fw.hopY += fw.hopV * dt;
      fw.hopV -= 13 * dt;
      if (fw.hopY <= 0) { fw.hopY = 0; fw.hopV = 0; }
      g.position.y += fw.hopY;
    }
    fw.cr.update(dt, t, moving);
  }

  _nextRune() {
    for (let i = 0; i < this.world.runes.length; i++) {
      if (!this.world.runes[i].lit && !this.friends.some((f) => f.runeIndex === i)) return i;
    }
    return 0;
  }

  _updatePrompt(playerPos) {
    const card = $('prompt-card');
    const f = this.nearestActionable(playerPos);
    const giveTo = f && this._canSatisfy(f) ? null : this._necklaceTarget(playerPos, f);
    if (!f && !giveTo) {
      const shy = [...this._waitingAll()].find((x) => this._startles(x) &&
        x.cr.group.position.distanceTo(playerPos) < FLEE_R + 2);
      if (shy) {
        card.classList.add('show');
        $('prompt-name').textContent = shy.cfg.name;
        $('prompt-line').textContent = this._startledLine(shy);
        $('prompt-progress').style.display = 'none';
        return;
      }
      const D = this.dolphin;
      if (D.state === 'stranded' && D.cr.group.position.distanceTo(playerPos) < 6) {
        card.classList.add('show');
        $('prompt-name').textContent = 'Stranded Dolphin 🐬';
        $('prompt-line').textContent = `Too heavy alone! Bring ${DOLPHIN.helpersNeeded} friends and push it into the sea. ` +
          `(${Math.min(this._friendsInParade(D.cr.group.position, 15), DOLPHIN.helpersNeeded)}/${DOLPHIN.helpersNeeded} friends)`;
        $('prompt-progress').style.display = 'none';
        return;
      }
      card.classList.remove('show');
      return;
    }
    card.classList.add('show');
    const giveLine = `📿 Press ${actKey()} to give a flower necklace.`;
    const bar = $('prompt-progress');
    if (!f) {
      $('prompt-name').textContent = giveTo.cfg.name;
      $('prompt-line').textContent = giveLine;
      bar.style.display = 'none';
      return;
    }
    $('prompt-name').textContent = f.cfg.name;
    const who = shortName(f.cfg);
    let line = f.cfg.ask;
    if (this.calmState === 'startled') {
      line = this._startledLine(f);
    } else if (this.calmState === 'wary') {
      line = `${who} is too wary to settle — come back calmer (zen ${TIERS[f.cfg.tier].floor}+). 🌿`;
    } else if (this.calmState === 'low') {
      line = `You're running low on calm… rest a moment. ${who} will wait.`;
    } else if (this.calmState === 'idle' && f.trust > 0) {
      line = `${who} is starting to trust you. Keep still nearby. 💗`;
    } else if (this.calmState === 'calming' && f.trust > 0.15) {
      line = `${who} is relaxing… 💗`;
    }
    $('prompt-line').textContent = giveTo === f ? `${line}  ${giveLine}` : line;
    bar.style.display = 'block';
    bar.classList.toggle('paused', this.calmState !== 'calming');
    bar.firstElementChild.style.width = Math.min(100, f.trust * 100).toFixed(1) + '%';
  }

  _startledLine(f) {
    const item = ITEMS.find((it) => it.id === f.cfg.want);
    const hint = item ? ` Or bring ${item.name} ${item.emoji} — that would hold them still.` : '';
    return `${shortName(f.cfg)} startles — only a bigger parade will put them at ease. ` +
      `(${this._paradeFriends()}/${f.cfg.auraNeed} friends)${hint}`;
  }

  _updateHUD() {
    const n = this.friends.filter((f) => f.state !== 'waiting').length;
    $('friend-count').textContent = this.homed >= 8
      ? 'The Gathering is complete 🌙'
      : `${this.homed}/8 home · ${n - this.homed > 0 ? (n - this.homed) + ' in your parade' : 'parade empty'}`;
    const cz = this.critters.filter((c) => c.cfg.kind === 'cousin' && c.state !== 'waiting').length;
    if (cz) $('friend-count').textContent += ` · ${cz} cousin${cz > 1 ? 's' : ''}`;
    const dots = $('friend-dots');
    dots.innerHTML = '';
    for (const f of this.friends) {
      const s = document.createElement('span');
      s.className = 'dot' + (f.state === 'home' ? ' home' : f.state !== 'waiting' ? ' joined' : '');
      s.textContent = f.state === 'waiting' ? '·' : f.cfg.emoji;
      dots.appendChild(s);
    }
    const inv = $('inv');
    inv.innerHTML = '';
    const chip = (text) => {
      const c = document.createElement('span');
      c.className = 'chip';
      c.textContent = text;
      inv.appendChild(c);
    };
    for (const it of ITEMS) {
      if (this.inventory[it.id]) chip(it.emoji);
    }
    if (this.flowerCount > 0) chip(`🌼${this.flowerCount}/3`);
    if (this.necklaces > 0) chip(this.necklaces > 1 ? `📿×${this.necklaces}` : '📿');
    const riding = {};
    for (const c of [...this.riders.head, ...this.riders.back]) riding[c.cfg.emoji] = (riding[c.cfg.emoji] || 0) + 1;
    const ride = Object.entries(riding).map(([e, n]) => e + (n > 1 ? n : '')).join(' ');
    if (ride) chip(ride);
    const dn = this.countDucklingsFollowing();
    if (dn > 0 && this.friends.find((f) => f.cfg.id === 'duck').state === 'waiting') chip('🐥×' + dn);
  }

  squeak(player, t) {
    this.sound.squeak();
    this.particles.burst('🎵', player.position.clone().add(new THREE.Vector3(0, 1.3, 0)), { count: 3, size: 0.4, up: 1.8, life: 1 });
    for (const c of [...this.riders.head, ...this.riders.back]) c.hopAt = t + 0.1 + Math.random() * 0.25;
    // nearby followers answer with a hop
    for (const fw of this.followers) {
      if (fw.cr.group.position.distanceTo(player.position) < 12) {
        fw.hopAt = t + 0.15 + Math.random() * 0.3;
      }
    }
  }

  _startFinale() {
    this.finaleStarted = true;
    this.finaleT = 0;
    // cousins settle in a loose ring below the grove
    const cousins = this.critters.filter((c) => c.cfg.kind === 'cousin' && c.state === 'following');
    cousins.forEach((c, i) => {
      const a = Math.PI * 0.5 + (i - (cousins.length - 1) / 2) * 0.45;
      c.state = 'gathering';
      c.homeSpot = new THREE.Vector3(GROVE.x + Math.cos(a) * 12, 0, GROVE.z + Math.sin(a) * 12);
      const j = this.followers.indexOf(c);
      if (j >= 0) this.followers.splice(j, 1);
    });
    this.world.portalOpen = true;
    this.sound.finale();
    $('banner').classList.add('show');
    setTimeout(() => {
      $('banner').classList.remove('show');
      toast('The commons is yours now. Stay as long as you like. 🌙', 6000);
    }, 7000);
    // fireflies
    for (let i = 0; i < 70; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: emojiTexture('✦'), color: 0xffe9a8, transparent: true, opacity: 0, depthWrite: false,
      }));
      // most over home; a few drift over each neighbour island too
      const I = i < 52 ? null : ISLANDS[1 + (i % 3)];
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * (I ? I.rm * 0.75 : ISLAND_R - 6);
      const x = (I ? I.x : 0) + Math.cos(a) * r, z = (I ? I.z : 0) + Math.sin(a) * r;
      s.scale.setScalar(0.28);
      s.position.set(x, Math.max(heightAt(x, z), 0) + 0.8 + Math.random() * 2.5, z);
      s.userData = { x0: s.position.x, y0: s.position.y, z0: s.position.z, ph: Math.random() * 6 };
      this.scene.add(s);
      this.fireflies.push(s);
    }
    // petal burst at grove
    const gp = this.world.grove.position.clone().add(new THREE.Vector3(0, 6, 0));
    this.particles.burst('🌸', gp, { count: 26, speed: 3, up: 3, life: 3.2, size: 0.5, gravity: -1.2, spread: 3 });
    this.particles.burst('✨', gp, { count: 20, speed: 2.5, up: 2.5, life: 2.5, size: 0.45, gravity: -0.8, spread: 3 });
  }

  _updateFinale(dt, t) {
    this.finaleT += dt;
    const k = Math.min(1, this.finaleT / 8); // nightfall over 8s
    const sky = this.world.skyUniforms;
    sky.topColor.value.lerpColors(new THREE.Color(0x8a74b0), new THREE.Color(0x131b38), k);
    sky.midColor.value.lerpColors(new THREE.Color(0xf8c48a), new THREE.Color(0x2c3d66), k);
    sky.botColor.value.lerpColors(new THREE.Color(0xffe9c0), new THREE.Color(0x3d5580), k);
    this.world.fog.color.lerpColors(new THREE.Color(0xf5c98a), new THREE.Color(0x1c2a48), k);
    this.world.hemi.intensity = 0.95 - 0.5 * k;
    this.world.sun.intensity = 1.5 - 1.15 * k;
    this.world.sun.color.lerpColors(new THREE.Color(0xffd9a0), new THREE.Color(0x9ab8ff), k);
    this.world.portalDisc.material.opacity = 0.1 + 0.65 * k;
    for (const s of this.fireflies) {
      const u = s.userData;
      s.position.set(
        u.x0 + Math.sin(t * 0.6 + u.ph) * 1.4,
        u.y0 + Math.sin(t * 0.9 + u.ph * 2) * 0.6,
        u.z0 + Math.cos(t * 0.5 + u.ph) * 1.4
      );
      s.material.opacity = k * (0.4 + 0.6 * Math.abs(Math.sin(t * 1.3 + u.ph * 3)));
    }
  }
}

function hintFor(cfg) {
  switch (cfg.want) {
    case 'flower': return 'A sweet flower grows in the meadow southwest of where you woke…';
    case 'fish': return 'Something glints in the big pond shallows to the east…';
    case 'skipstone': return 'A flat lucky stone lies on the trail north of the meadow…';
    case 'mango': return 'A mango waits under a tree in the northwest…';
    case 'nut': return 'A marvelous nut is somewhere in the far south grass…';
    case 'berry': return 'A plump berry grows in the northwest woods…';
    case 'ducklings': return 'Three ducklings are lost around the pond — walk near them and they will follow!';
    default: return 'They seem to want something…';
  }
}
