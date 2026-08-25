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

### Next up
- Soften the horizon (water/fog tint), check capybara from the front.
- Gemini-painted title background art to replace the CSS title scene.
- Mobile viewport test pass (touch controls, small screens).
