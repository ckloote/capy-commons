// game.js — friends, items, conga line, grove delivery, finale, particles, UI
import * as THREE from 'three';
import { BUILDERS, makeDuckling, makeOcelot } from './creatures.js';
import { heightAt, GROVE, SPRING, ISLAND_R } from './world.js';

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

// ---------- config ----------
const FRIENDS = [
  { id: 'tapir', name: 'Tobi the Tapir', emoji: '🌺', want: 'flower', space: 2.7,
    pos: [18, -28], ask: 'Tobi sniffs the air dreamily. He has smelled a sweet flower somewhere in the meadows…',
    thanks: 'Tobi tucks the flower behind his ear. He lumbers happily into line!' },
  { id: 'heron', name: 'Hana the Heron', emoji: '🐟', want: 'fish', space: 2.1,
    pos: [31, 6], ask: 'Hana stands perfectly still. "A silver fish glints in the pond shallows. My old wings miss the dive…"',
    thanks: 'Hana swallows the fish in one elegant gulp. She strides after you on stilt legs!' },
  { id: 'otter', name: 'Rio the Otter', emoji: '🪨', want: 'skipstone', space: 1.8,
    pos: [-14, 30], ask: 'Rio juggles nothing. "Lost my lucky skipping stone! Flat, smooth, somewhere up the stone trail north of the meadow."',
    thanks: 'Rio skips the stone across the water — four bounces! He tumbles into line, chittering.' },
  { id: 'duck', name: 'Mabel the Mallard', emoji: '🐥', want: 'ducklings', space: 1.6,
    pos: [21, 22], ask: 'Mabel is beside herself. "My three ducklings wandered off! Please, bring them waddling back."',
    thanks: 'Mabel counts her ducklings twice, then quacks the happiest quack you have ever heard.' },
  { id: 'monkey', name: 'Miko the Monkey', emoji: '🥭', want: 'mango', space: 1.8,
    pos: [-34, 16], ask: 'Miko swings down. "Mango. MANGO. There is one under a tree to the northwest and it is calling to me."',
    thanks: 'Miko cradles the mango like treasure and scampers into line behind you!' },
  { id: 'agouti', name: 'Pip the Agouti', emoji: '🌰', want: 'nut', space: 1.5,
    pos: [8, 38], ask: 'Pip twitches. "I buried a marvelous nut. Somewhere. North-ish? It is gone. This is a catastrophe."',
    thanks: 'Pip stuffs the nut in one cheek. It is enormous. Pip is thrilled.' },
  { id: 'caiman', name: 'Old Grim the Caiman', emoji: '🧘', want: 'company', space: 2.7,
    pos: [38, -10], ask: 'Old Grim says nothing. He simply floats. Perhaps he just wants… quiet company. (Stay close a while.)',
    thanks: 'Old Grim opens one golden eye. "…fine," he rumbles, and drifts after you like a very slow torpedo.' },
  { id: 'marmoset', name: 'Luna the Marmoset', emoji: '🫐', want: 'berry', space: 1.4,
    pos: [-38, -20], ask: 'Luna, tiny and serious: "One berry. The plump kind that grows in the northwest woods. Then I am yours."',
    thanks: 'Luna eats the berry in seventeen rapid bites and climbs onto the parade!' },
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

// ---------- UI helpers ----------
const $ = (id) => document.getElementById(id);
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
    this.followers = [];      // creatures currently in the conga line
    this.homed = 0;
    this.finaleStarted = false;
    this.finaleT = 0;
    this.fireflies = [];
    this.ripples = [];
    this.boostUntil = -99;
    this.springToastAt = -99;
    // zen (phase 1): the only "health" this game has
    this.zen = 78;
    this.napping = false;        // set by main each frame
    this.zenFaceState = '';
    this.stressed = false;       // ocelot aura active this frame
    this.wanderingOff = false;   // set by main during the stress-out stroll
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
      this.friends.push({
        cfg, cr, icon, state: 'waiting', space: cfg.space,
        companyTime: 0, runeIndex: -1, homeSpot: null, wanderT: Math.random() * 5,
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
        cx: 43, cz: 4, r: 6.5, calmUntil: -99, stungAt: -99, toldOff: false,
      };
    }
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

  countDucklingsFollowing() {
    return this.ducklings.filter((d) => d.state === 'following').length;
  }

  // ----- interaction -----
  nearestActionable(playerPos) {
    let best = null, bestD = 4.2;
    for (const f of this.friends) {
      if (f.state !== 'waiting') continue;
      const d = f.cr.group.position.distanceTo(playerPos);
      if (d < bestD) { best = f; bestD = d; }
    }
    return best;
  }

  tryAction(playerPos) {
    const f = this.nearestActionable(playerPos);
    if (!f) return false;
    const want = f.cfg.want;
    if (want === 'company') return true; // handled passively
    let ok = false;
    if (want === 'ducklings') ok = this.countDucklingsFollowing() >= 3;
    else ok = !!this.inventory[want];
    if (ok) {
      if (want === 'ducklings') {
        for (const d of this.ducklings) d.state = 'withDuck';
      } else {
        delete this.inventory[want];
      }
      this._befriend(f);
    } else {
      this.sound.denied();
      toast(f.cfg.emoji + '  ' + hintFor(f.cfg));
    }
    this._updateHUD();
    return true;
  }

  _befriend(f) {
    f.state = 'following';
    f.icon.material.map = emojiTexture('💛');
    f.icon.material.needsUpdate = true;
    this.followers.push(f);
    // ducklings slot in right behind their mother
    if (f.cfg.id === 'duck') {
      for (const d of this.ducklings) this.followers.push(d);
    }
    this.sound.friendJoin(this.followers.filter((x) => x.cfg).length - 1);
    this.particles.burst('💛', f.cr.group.position.clone().add(new THREE.Vector3(0, 1.2, 0)), { count: 10 });
    toast(f.cfg.thanks, 4200);
    setTimeout(() => { f.icon.visible = false; }, 2500);
  }

  // ----- per-frame -----
  update(dt, t, player, playerMoving, camera) {
    this.particles.update(dt);
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

    // lost ducklings: run to player when near, then follow loosely
    for (const d of this.ducklings) {
      if (d.state === 'lost') {
        d.cr.update(dt, t, false);
        if (d.cr.group.position.distanceTo(player.position) < 5) {
          d.state = 'following';
          this.sound.pickup();
          this.particles.burst('🐥', d.cr.group.position.clone().add(new THREE.Vector3(0, 0.6, 0)), { count: 5, size: 0.35 });
          toast(`A duckling peeps and waddles after you! (${this.countDucklingsFollowing()}/3)`);
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
        // caiman quiet company
        if (f.cfg.want === 'company') {
          if (d < 4.5) {
            // napping beside Old Grim is the fastest way to his heart
            f.companyTime += dt * (this.napping ? 2.5 : 1);
            if (f.companyTime > 4) this._befriend(f);
          } else {
            f.companyTime = Math.max(0, f.companyTime - dt * 2);
          }
        }
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
              d.state = 'homing';
              d.homeSpot = f.homeSpot.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2));
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

    // hot spring boost
    const springD = Math.hypot(player.position.x - SPRING.x, player.position.z - SPRING.z);
    if (springD < 3.4) {
      if (t - this.springToastAt > 16) {
        this.springToastAt = t;
        toast('Ahh… yuzu warmth soaks in. Zoomies unlocked! ⚡');
        this.sound.pickup();
      }
      this.boostUntil = t + 10;
      if (Math.random() < dt * 3) {
        this.particles.burst('✨', player.position.clone().add(new THREE.Vector3(0, 0.8, 0)), { count: 2, size: 0.3, up: 1.4, life: 0.9 });
      }
    }

    // ocelot + zen
    this._updateOcelot(dt, t, player);
    this._updateZen(dt, t, player, playerMoving, springD);

    // finale progression
    if (this.finaleStarted) this._updateFinale(dt, t);

    // prompt card
    this._updatePrompt(player.position);
  }

  // ----- ocelot: prowls, stalks, and is politely outnumbered -----
  _updateOcelot(dt, t, player) {
    const o = this.ocelot;
    const g = o.cr.group;
    const pd = Math.hypot(player.position.x - g.position.x, player.position.z - g.position.z);
    const procession = this.followers.length;
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
        g.position.x += (dx / pd) * step;
        g.position.z += (dz / pd) * step;
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

  // ----- zen -----
  _updateZen(dt, t, player, moving, springD) {
    let delta = this.napping ? 8 : (moving ? 0.35 : 1.1);
    if (springD < 3.4) delta += 6;
    // the pile bonus: every friend nearby is a little weighted blanket
    let near = 0;
    for (const fw of this.followers) {
      if (fw.cr.group.position.distanceTo(player.position) < 7) near++;
    }
    delta += Math.min(4, near * 0.6);
    if (this.stressed) {
      const od = Math.hypot(player.position.x - this.ocelot.cr.group.position.x,
        player.position.z - this.ocelot.cr.group.position.z);
      delta -= (1 - Math.min(1, od / 12)) * 9 + 3;
    }
    if (this.finaleStarted) delta = Math.max(delta, 10); // perfect calm settles
    this.zen = Math.max(0, Math.min(100, this.zen + delta * dt));

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

  _moveToward(fw, target, dt, t, speedMul, maxSpeed) {
    const g = fw.cr.group;
    const dx = target.x - g.position.x, dz = target.z - g.position.z;
    const dist = Math.hypot(dx, dz);
    let moving = false;
    if (dist > 0.25) {
      const sp = Math.min(maxSpeed, dist * speedMul);
      g.position.x += (dx / dist) * sp * dt;
      g.position.z += (dz / dist) * sp * dt;
      const ry = Math.atan2(dx, dz);
      let diff = ry - g.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      g.rotation.y += diff * Math.min(1, dt * 8);
      moving = dist > 0.5;
    }
    const h = heightAt(g.position.x, g.position.z);
    g.position.y = h < 0 ? -0.1 : h;   // swim or walk
    fw.cr.shadow.visible = h >= 0;
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
    if (!f) { card.classList.remove('show'); return; }
    card.classList.add('show');
    $('prompt-name').textContent = f.cfg.name;
    $('prompt-line').textContent = f.cfg.ask;
    const bar = $('prompt-progress');
    if (f.cfg.want === 'company') {
      bar.style.display = 'block';
      bar.firstElementChild.style.width = Math.min(100, (f.companyTime / 4) * 100) + '%';
    } else {
      bar.style.display = 'none';
    }
  }

  _updateHUD() {
    const n = this.friends.filter((f) => f.state !== 'waiting').length;
    $('friend-count').textContent = this.homed >= 8
      ? 'The Gathering is complete 🌙'
      : `${this.homed}/8 home · ${n - this.homed > 0 ? (n - this.homed) + ' in your parade' : 'parade empty'}`;
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
    for (const it of ITEMS) {
      if (this.inventory[it.id]) {
        const c = document.createElement('span');
        c.className = 'chip';
        c.textContent = it.emoji;
        inv.appendChild(c);
      }
    }
    const dn = this.countDucklingsFollowing();
    if (dn > 0 && this.friends.find((f) => f.cfg.id === 'duck').state === 'waiting') {
      const c = document.createElement('span');
      c.className = 'chip';
      c.textContent = '🐥×' + dn;
      inv.appendChild(c);
    }
  }

  squeak(player, t) {
    this.sound.squeak();
    this.particles.burst('🎵', player.position.clone().add(new THREE.Vector3(0, 1.3, 0)), { count: 3, size: 0.4, up: 1.8, life: 1 });
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
      const a = Math.random() * Math.PI * 2, r = Math.random() * (ISLAND_R - 6);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
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
