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

### Next up
- Verify Gemini image API access through the session proxy; generate first
  texture batch (grass, water, bark, canopy, fur, stone, path).
- Vendor Three.js into `lib/` (registry.npmjs.org is reachable).
- Terrain + water + capybara controller, then friends & the Grove Gate.
