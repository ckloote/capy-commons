# Capy Commons — The Gathering 🌿

A cozy third-person 3D browser game. You are a capybara in a wetland commons
at golden hour. Eight animal friends are scattered across the island — some
want a small favor (a mango, a lost lucky stone, three runaway ducklings),
and one just wants quiet company. Befriend them, lead your growing parade to
the glowing grove in the north, and light the eight runes to complete the
Gathering.

**Play it:** serve this repo as static files and open `index.html`.
No build step, no external CDNs — everything is vendored.

## Controls

| | Desktop | Touch |
|---|---|---|
| Walk | WASD / arrows | drag on the left side (virtual joystick) |
| Look | drag mouse | drag on the right side |
| Zoom | scroll wheel | pinch |
| Interact | E / Space | 🐾 button |
| Squeak | Q | 🎵 button |

Capybaras can swim. The hot spring in the west does something nice.
Squeak near your parade and see what happens.

## How it's made

- **Three.js** (vendored, `lib/`) — the whole world is built from primitives:
  the island is an analytic heightfield (shared by the renderer and gameplay),
  every animal is spheres, capsules and cones with a little leg-swing rig.
- **Textures were generated with Gemini** (`gemini-3.1-flash-image`) as
  seamless painterly tiles — grass, bark, water, fur, feathers, scales — plus
  the painted title screen. See `assets/textures/`.
- **Audio** is synthesized in WebAudio at runtime: squeaks, pentatonic join
  chords (each friend adds a higher step — the island slowly builds a chord),
  rune bells, wind and random birdsong.
- `notes.md` is the running dev log.
