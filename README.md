# Capy Commons — The Gathering 🌿

A cozy third-person 3D browser game. You are a capybara in a wetland commons
at golden hour. Eight animal friends are scattered across the island. Each
will come to trust you if you sit quietly with them and share your calm —
or you can win them over at once with the small favor they're hoping for (a
mango, a lost lucky stone, three runaway ducklings). Lead your growing parade
to the glowing grove in the north and light the eight runes to complete the
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
| Nap | Z | 💤 button |

**Zen** is the only "health" here. Left alone it settles around 60 — naps,
the hot spring, and a pile of nearby friends push it toward full. It drains
when the ocelot on the east bank is watching you, and in the island's two
noisy corners (a screeching monkey troupe, a cloud of midges) that happen
to sit right next to things you want. Hit zero and nothing bad happens: you
just wander off to somewhere calmer and collect yourself. A big enough
parade makes the ocelot think better of it entirely.

**Sharing calm:** stand still near a friend and their trust bar fills
(about 8 seconds; napping beside them is twice as fast). Calm is *given*, so
it costs zen while it fills — a little for easygoing friends, more for shy
ones, and the skittish heron won't even start to settle unless you arrive
properly calm. Walk away and their trust waits for you; it never resets.
Sharing calm can't take you below a small reserve, so being friendly never
makes you stress out.

**Your circle of calm** (the ring of golden motes that appears near a
friend) is how close you need to sit, and it widens with every friend in
your parade. Hana the heron is too skittish to let a lone capybara anywhere
near her — come back with a couple of friends, or with the one thing she's
hoping for.

**Little riders and wild cousins:** turtles, frogs and songbirds can be
calmed too — quickly, and for a little zen — and then they ride on you:
songbirds perch on your head, turtles and frogs stack up on your back and
sway as you walk. A herd of shy wild capybara cousins lives in the
southwest marsh; bring a friend along and they'll join your parade. None
of them are needed for the Gathering, but they all count toward your
parade (the ocelot certainly notices).

**Flower necklaces:** walk through the meadow flowers to pick them — three
make a necklace 📿. Walk up to any friend and press E / 🐾 to give it; they
wear it for the rest of the game, and it earns a big chunk of trust for free. Picked flowers grow back.

**A dolphin is stranded on the west beach.** It's far too heavy for one
capybara — come back with friends in your parade and push it into the sea
together. It doesn't forget a favour.

**There's more out there.** Look out from the beaches: the Commons isn't
alone. Steaming stone terraces lie to the northeast, rice paddies to the
south, and a river island to the west, with a couple of palm islets in
between. Your whole parade swims with you. Nothing out there is needed
for the Gathering; they're places to explore.

Capybaras can swim. The hot spring in the west does something nice.
Squeak near your parade and see what happens.

## How it's made

- **Three.js** (vendored, `lib/`) — the whole world is built from primitives:
  the island is an analytic heightfield (shared by the renderer and gameplay),
  every animal is spheres, capsules and cones with a little leg-swing rig.
- **Textures were generated with Gemini** (`gemini-3.1-flash-image`) as
  seamless painterly tiles — grass, bark, water, fur, feathers, scales — plus
  the painted title screen. The neighbour islands' tiles (travertine, mud,
  rice, river stones, lily pads) came later from `gemini-nano-banana-2.1`.
  See `assets/textures/`.
- **Audio** is synthesized in WebAudio at runtime: squeaks, pentatonic join
  chords (each friend adds a higher step — the island slowly builds a chord),
  rune bells, wind and random birdsong.
- `notes.md` is the running dev log.
