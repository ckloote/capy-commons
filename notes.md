# Capy Commons — The Gathering: dev notes

## 2026-08-25 — Session start

**Source chat unreachable.** The shared chat link
(claude.ai/share/eeb7179b-…) is behind a Cloudflare managed JS challenge from
this environment — tried WebFetch (got only the SPA shell), curl with browser
headers (challenge page), and headless Chromium through the session proxy
(connection reset). Since the task says to work independently, I reconstructed
the design from the strong signals available:

- Repo name: **capy-commons**
- Branch name: **3d-game-gemini-textures**
- Concept art: *"The Gathering"* — a golden capybara leading a parade of
  wetland friends (tapir + marmoset rider, heron, otters, agouti, squirrel
  monkey, ducks & ducklings, caimans, lizards, songbirds) along a river path
  at sunset, with a glowing portal-tree grove in the background.

## Design (locked in, per "no further design decisions" instruction)

**Capy Commons — The Gathering.** A cozy third-person 3D game (Three.js):

- You are a capybara in a wetland commons at golden hour.
- 8 animal friends are scattered around the island. Some just want your calm
  company; some want a small favor (a fruit, a flower, a fish found nearby).
- Befriended animals join a conga line behind you.
- Escort friends to the glowing **Grove Gate**; each delivered friend lights a
  rune. All 8 → the portal opens → surprise finale (nightfall, fireflies,
  celebration).
- Small joys: squeak + hop button, a hot spring with floating yuzu (speed
  boost), ambient ducks, day/night shift for the finale.
- Controls: WASD/arrows + pointer-drag camera on desktop; virtual joystick +
  action button on touch. Mobile-first HUD.
- Textures: generated with Gemini `gemini-3.1-flash-image` (key provided),
  saved as static assets in `assets/textures/`.

## Progress log

- **Commit 1**: `index.html` title screen — CSS-painted sunset wetland,
  animated sun/shimmer/fireflies, capybara silhouette, Begin button
  (placeholder until the game ships). Mobile viewport meta + touch-safe CSS
  in place from the start. Also this `notes.md`.

- **Commit 2**: Playable build.
  - 13 Gemini-generated tileable textures in `assets/textures/` (grass, path,
    water, bark, canopy, capy/tapir/otter fur, heron/duck feathers, caiman
    scales, stone, petals) — `gemini-3.1-flash-image`, downsized to 512px JPG,
    ~900 KB total. Generation script kept in session scratchpad.
  - `lib/three.module.min.js` vendored (r168) + import map, so the site is
    fully self-contained static files.
  - `js/world.js`: analytic island heightfield (dome + fbm noise + pond
    depressions + knolls for grove/spring/spawn), vertex-colored terrain with
    sandy shorelines, scrolling water plane, gradient sky shader (uniforms
    lerp to night at finale), ~50 procedural trees/palms, bushes, rocks,
    reeds, flowers, stepping-stone trail, Grove Gate (leaning trunk arch,
    portal ring, 8 rune stones), hot spring (stone ring, bobbing yuzu,
    steam sprites).
  - `js/creatures.js`: primitive-built capybara, tapir, heron, otter, mallard
    + ducklings, squirrel monkey, agouti, caiman, marmoset — all with the
    generated textures, generic leg-swing/bob animation rig.
  - `js/game.js`: 8 friends with personalities and wants (5 fetch items, a
    lost-ducklings quest, and Old Grim who just wants quiet company —
    proximity meter), conga-line following via breadcrumb trail sampling,
    grove delivery lights runes one by one, finale = portal opens, sky falls
    to night, 70 fireflies, petal burst, celebration. Emoji-sprite particles.
  - `js/input.js`: WASD/arrows + pointer-drag camera + wheel zoom on desktop;
    dynamic virtual joystick (appears where thumb lands, left 45% of screen),
    camera drag on right, two-finger pinch zoom, big 🐾 action + 🎵 squeak
    buttons on touch.
  - `js/audio.js`: WebAudio synth — capybara squeak, pickup pluck, per-friend
    rising pentatonic join chords, rune bells, splash, finale melody + pad,
    looping soft wind + random birdsong.
  - Extras: swimming (capys swim! slower, legs hidden, splash), hot-spring
    yuzu speed boost, squeak makes the whole parade answer-hop.
  - Headless Chromium test: no JS errors; title → game → walking all render.

- **Commit 3**: Art & polish pass (all verified with headless-Chromium
  screenshots at desktop 900×600 and iPhone-ish 375×667 w/ touch events).
  - Gemini-painted 16:9 title background (`assets/title-bg.jpg`) — painterly
    sunset wetland with a capybara leading tapir/heron/otter/ducks toward a
    glowing grove, remarkably close to the concept art. CSS-painted title
    scenery removed (fireflies kept); dark gradient overlay for text.
  - Regenerated `fur_capy` much finer — the old strand-y texture read as
    wood grain on the capsule body. Creature materials now clone their
    texture and tile it 2.5×, which fixed the "wooden barrel capybara".
  - Steam sprites got a soft radial puff texture (were rendering as white
    squares — SpriteMaterial with no map).
  - Distant-water moiré fixed: water repeat 34→11, anisotropy 16, fog pulled
    in (55→210). Sky softened toward the title art's peach/lavender palette
    (finale lerp start colors updated to match).
  - Bug: friends never "arrived" at their rune spot — arrival used 3D
    distance but homeSpot.y=0 while creatures stand at terrain height ~2.
    Now horizontal distance. (Found via scripted quest run: fish → heron →
    grove; headless GL runs ~5fps so everything looked stuck at first —
    real cause was the y-offset.)
  - Direction words in quest text corrected to match actual coordinates
    (north = toward the grove). Pip the agouti still *says* "North-ish?"
    about a nut that is far south — that one is a joke, the action-button
    hint tells the truth.
  - Favicon (🌿), dead CSS removed, debug hooks (`window.CAPY`) for
    scripted testing.
  - Verified: title art on portrait mobile crops beautifully; joystick
    appears under thumb and moves the capy; fish pickup → heron befriend →
    conga → rune walk all function; forced finale shows portal glow,
    nightfall, fireflies, banner.

- **Commit 4**: Full-loop verification + depth polish.
  - Scripted complete playthrough in headless Chromium: all 6 items → 3
    ducklings → all 8 friends (incl. caiman quiet-company timer) → grove →
    8 runes lit → finale triggered. Zero JS errors the whole run.
  - Soft blob shadows under every creature (shared radial canvas texture,
    per-species radius); hidden while swimming.
  - HUD counter reads "The Gathering is complete 🌙" at 8/8.
  - README.md with controls table and credits for the Gemini textures.

- **Commit 5**: Last delights — 10 butterflies drifting over the meadows
  (canvas-emoji sprites on sinusoidal wander paths), and expanding ripple
  rings while the capybara swims (pooled flat ring meshes, faster cadence
  while paddling). Verified in the pond: ripples + splash + bobbing fish
  item all read nicely together.

## 2026-08-25 — The real concept arrives; roadmap

The user relayed the original chat. The reconstruction was close ("pretty
consistent, a good starting point") but the true spine is different:
**attraction and calm as the core system**, not fetch quests. Key elements
from the chat: Zen meter instead of health (stress drains it; hot springs,
naps, animal piles refill it; "death" = wander off and respawn, no
punishment); passive recruitment (animals relax around you — ducks nest on
your head, turtles ride your back; a growing "friendship radius" unlocks
areas); environmental puzzles via capybara diplomacy (bird scouts from your
head, weight on switches, capy herds trampling reeds); biomes (marsh, hot
springs, rice paddies, riverbank); narrative hook: the annual pilgrimage to
"the Gathering", with you as the accidental pilgrim-guide.

### Roadmap (agreed with user)

1. **Zen meter core** ← current phase. Zen resource + HUD ring; regen from
   idling, hot spring, nearby friends (pile bonus), napping (new 💤 action:
   curl up, zzz, fast refill, calms nearby animals faster); drain from a
   prowling ocelot stressor on the east bank (never catches you; slinks off
   if your procession is big enough); zen=0 → soft vignette, capy wanders
   off to a calm spot, half refill — no punishment.
2. **Passive recruitment + friendship radius + stacking.** Generalize the
   caiman proximity-trust mechanic to every animal (trust fills from
   proximity × zen; gifts become optional accelerators, ducklings quest
   stays). Growing calm aura gates skittish species/areas. Attachment
   slots on capy (head/back/rump) for small critters with spring-sway;
   new stackables: turtle, frog, songbird, wild capy cousins.
3. **Biomes.** Region masks in the heightfield: marsh (center), hot-spring
   terraces (NW), rice paddies (SE), riverbank + current (E), Gathering
   grove (N). New textures: rice seedlings, mineral terrace, mud, lily pads.
4. **Diplomacy puzzles**, one per gate: bird-on-head clears mist path;
   weight switch lowers a log bridge (procession piles on); capy herd
   tramples the reed wall to the riverbank.
5. **Narrative framing.** Opening vignette of the Gathering legend, elder
   capybara NPC as tutorial, finale reworked so *every* creature settles in.
6. **Persistence & polish.** localStorage save/continue, instancing perf
   pass, per-biome audio layers, reduce-motion/button-size options.

- **Commit 6 (Phase 1): Zen meter core.**
  - `zen` (0–100) lives in `game.js`; HUD is a stroke-dashoffset ring around
    a mood face (😌/🙂/😟/😴) under the friend panel. Color shifts
    green→amber→coral as it drains.
  - Regen: idle 1.1/s (0.35 walking), nap 8/s, hot spring +6/s, pile bonus
    +0.6/s per follower within 7m (cap +4). Finale locks regen high —
    "a perfect calm settles".
  - **Nap** (Z / 💤): capybara drops into a legless loaf, chin down, 💤
    particles float up, soft synth snores, camera dollies out ~3m. Any
    movement/action/swimming wakes you. Napping beside Old Grim fills his
    company meter 2.5× — first taste of Phase 2's "napping calms animals".
  - **Ocelot stressor** (new `fur_ocelot` Gemini texture + builder): prowls
    a circle on the east bank; within 12m it freezes and stalks (slow creep,
    never closes past 5m), draining zen with distance falloff. If your
    procession is ≥3, it retreats instead — attraction as power. One-time
    toasts teach both rules. Goes 'calmed' at the finale.
  - **Stress-out**: zen 0 → full vignette, input locked, capy autopilots to
    the nearest calm spot (spawn meadow or spring), then zen=55, relief
    chime, "The wetland is still here." No other consequence, per the pitch.
  - Low-zen vignette creeps in below 35 so danger is felt before it lands.
  - Headless test run: nap 79.8→99.5 in ~4s ✓, move-to-wake ✓, ocelot
    stalk drains 45→35.5 ✓, wander-off engages and recovers to 55 ✓,
    3-friend parade forces retreat ✓, zero JS errors.

- **Commit 7: Obstacle collision** (user-reported: capy walked through
  trees). Static circular colliders recorded at world-build time — tree
  trunks (radius scaled per tree, palms thinner), rocks above pebble size,
  the grove's two trunk bases (computed at ±1.16 from the lean, not the
  ±3.4 mesh-center x), and the 8 rune stones. 64 colliders total.
  `world.collide(x, z, r)` does a 2-pass circle push-out (naturally slides
  along surfaces); applied to the player, all `_moveToward` movement
  (followers, homing, ocelot prowl/retreat), and the ocelot's stalk creep.
  Deliberately passable: bushes, reeds, low spring stones, flat slabs —
  a capybara shoves through soft things. Verified: walking into a tree
  holds at exactly treeR + playerR (0.91) with no jitter; full playthrough
  regression still green, followers path around obstacles via push-out.

### Status: feature-complete (as the v1 fetch-quest game)
Remaining niceties if time allows: idle capybara ear wiggles, more ambient
critters. The emoji want-icons depend on the device's emoji font (headless
Chromium renders a few as outlines; real phones/desktops are fine).
