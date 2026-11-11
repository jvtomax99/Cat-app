# QA tools (`tools/qa/`)

Headless Chromium (software WebGL) runs the real app, steps time by hand,
measures, and takes screenshots. Slow: a few minutes per script.

| Script | Checks | Good result |
|---|---|---|
| `eat-reach.mjs` | Mouth reaches kibble, fountain water, salmon, faucet trickle. Screenshots go to `OUT` (default `qa-out/`). | bowl: height ~.12, <.17 from centre; fountain: height ~.21–.23, .19–.40 from centre; salmon <.10; faucet <.05 |
| `legs.mjs` | Roams the study, kitchen, shelves; a leg "stretched" = planted paw out of reach (looks dragged); paw slide. `SEC`, `SEED`, `FLAGS` (e.g. `&walk=cat`, a preview A/B flag; see the top of `motion-cat.js`). | stretched >2cm under ~1% of frames; worst under ~4cm |
| `gallop.mjs` | Dashes across the rug; stretch per leg while running, how long each paw is up, how often both hind paws are up at once (rabbit hop). `DASHES`, `SEED`. | stretched >2cm few %, worst under ~4cm; both hind up under ~40% |
| `clip.mjs` | Side-view clip following her (`SCENE` walk, turn, run (the walk's trip at a run, works on old builds too), gallop, bed or shelf, `SEC`, `OUT`), for checking by eye; old vs new: run in each checkout, `ffmpeg -i a.mp4 -i b.mp4 -filter_complex hstack`. | looks right |
| `ab-walk.mjs` | Controlled walk clip for an A/B: empty floor, straight walk at walking speed, fixed side camera, starts at the top of a stride, 60 fps. `FLAGS` (e.g. `&hindlift=0.8`), `SEC`, `OUT`; writes `OUT.json` (phase, paw heights per frame). Blank frames are retaken; `ONLY=44,52` re-takes just those frames. Same seed: A and B match frame for frame except the change. | phase and position identical between A and B |
| `gait-chart.mjs` | Footfall chart of a straight walk (`RUN=1` a run): which paws are down through the stride, cadence, stretch, track width, body bob and sway. `FLAGS`, `SEED`. | walk: LH 0, LF .25, RH .5, RF .75 touch-downs, no `e` (catch-up) steps mid-stride, stretch under 2cm |
| `season.mjs` | Seasonal decor: Halloween picked under `?decor=halloween`, then back without the flag out of season. | out of season: room `thanksgiving`, Halloween not offered; no page errors |
| `vacuum.mjs` | Robot vacuum, alone and with her riding, her stalking it and walking about: closest approach of the vacuum's disc and of every point of her body (bones, the tail along its length) to every solid on the kitchen floor, read off the real meshes (island base, stool legs and bars, bowl, fountain, dock, counter, walls, tent footprint). Prints the worst per solid for the vacuum / her body riding / her tail riding / her body on the floor / her tail on the floor, a log of overlaps, screenshots of the worst moments (`OUT`, `SHOTS=0` to skip) and at given seconds (`AT=60,98`). `SEC`, `SEED`. ~1 real minute per 25 virtual s. | vacuum and her body > 0 everywhere; tail ≥ about -.03 (a brush, the skin's thickness) |
| `title.mjs` | The opening screen: pictures of the title, the hello after Play and the game (`OUT`, default `qa-out/title`), and that Play hands over. `CASE=day` (default), `film`, `night`, `asleep`, `kitchen`, `wide`. | `ok` on every line; logo clear of her face, button clear of her paws, toys on the floor |

Run: `node tools/qa/<script>.mjs`. Uses `playwright` if installed,
otherwise the cloud container's copy in `/opt/node22`.

Runs are repeatable: same seed, same result (timeouts and the clock run on
virtual time). Different seeds give different days: test 2 seeds.

New check? Use `open()` from `lib.mjs` (`{seed, kitchen, night, quiet}`;
returns `page`, `step(n)`, `look({focus, yaw, pitch, dist})`, `close()`),
add it to this table.
