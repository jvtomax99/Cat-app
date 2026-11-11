# Architecture

Plain ES modules in `dist/`, three.js vendored in `dist/vendor/`. No build
step. `npm run dev` serves on :5173. `npm run check` = syntax + care checks.
Publishing: `.github/workflows/pages.yml` deploys `main` at the root and the
preview branch (`PREVIEW_BRANCH` in that file) at `/preview/`, plus a review
pack (`tools/review-pack/`). `preview.yml` re-runs it on every push to the
preview branch.

## Files
| File | Job |
|---|---|
| `app.js` | The brain: state (`brain`, `pet`), behaviours, walking and jumping, camera, night, rooms, debug hooks. Big file; search by function name. |
| `motion-cat.js` | `MotionCat`: poses (`POSES`), walk (to 1.0), trot (1.0-2.2) and gallop gaits, foot placement and stepping, eating reach. Walk numbers from real cats: `docs/phases/07-walk-grace.md`. |
| `motion.js` | `MotionRig`: IK legs (`solveLeg`, `reachShort` = how far a leg is short of its paw), spine, head and neck, tail (`drapeTail`, bed bounds), floor contact. |
| `cat-rig.js` | Builds the skeleton and skin weights from the Meshy model at load. |
| `real-cat.js` | Fur, eyes, face, ears, jaw; also the classic movement (`?motion=classic`). |
| `room.js` | `Room`: the study, bowl, fountain, window visitors (bird, moths, monarch). Shared methods live on `Room.prototype` (the kitchen uses them too). |
| `kitchen.js` | `Kitchen`: island, shelves, sink and faucet, pendant lamp, robot vacuum, terrace, dog (`?dog`). Layout constants in `K`; spots in `layout()`. |
| `decor.js` | Seasonal decor for both rooms; `pillowGeometry`. Seasonal looks have `months` and are stored away out of season (`inSeason`, `decorNow`; `?decor=halloween` shows one anyway). |
| `pet-state.js`, `save.js` | Care meters, saves, offline progress. |
| `title.js` | The opening screen: logo, Play, loading bar, the first-time film, the bloom into the game. Page and timing only; the 3D side is in `app.js` (`titleReveal`, `titleCamera`, `titleLife`, `titleEnter`, the toys). |
| `sound.js`, `meows.js` | Short sounds and meows (no ambient loops). |

## Frame loop (app.js)
`frame(now)` → `updateCat(dt, t)` → `updateCamera(dt)` → `updateRoom(dt, t)` → render.

`updateCat` order: idle and night choices (`idleLife`, `nightLife`) →
movement toward `brain.target` (heading, turn caps) → eyes, head, gaze →
eating reach → pick a pose → `cat.update(dt, t, ctl)` (MotionCat).

## Behaviour model
- `brain.mode` (idle, feed, drink, play, brush, …) and `brain.activity`
  (walk, sit, eat, jump, …), set with `setActivity(name, seconds, then)`.
- Moving: `walkTo(point, then, run, anywhere)`, `jumpTo(perchName)`,
  `leap(...)`, `jumpDown`. Perches are listed in `PERCHES` (per room).
- Player actions go through `act('feed' | 'drink' | 'play' | …)`.

## Coordinates and sizes
- The active room is at the origin; `brain.pos` is in its frame. The other
  room is placed by `JOIN` (seen through the doorway; `cullThroughDoor`
  hides what's out of view).
- Her own frame: +z is forward. The root is near the front legs: front
  wrists at z +.23, hips at -.48, tail base at -.71. Standing nose about
  +.4 ahead; head down to eat, her mouth reaches about +.75 to +.9.
- Mouth point: `cat.bones.jaw.localToWorld(new V(0, -.015, .14))`.

## Gotchas (learned the hard way)
- **Study walks are clamped to the rug** (`onRug`) unless `walkTo(..., anywhere = true)`.
- The kitchen vacuum avoids the island with `route(from, to, pad)`
  (pad .45, .7 with her riding); `clampVacuum` keeps it out of the padded
  box, `clampVacBox` inside `VAC_FLOOR` / `VAC_FLOOR_RIDE` (its body, and
  her head and hips aboard, clear of the walls and counter). A route it
  can't find returns `[]` and it picks another goal (never a straight line
  through the furniture). By the window the lane is just wide enough for
  it with her aboard: KEEP_OUT, the riding pad and `VAC_FLOOR_RIDE.x0` are
  tuned together (padded island edge -5.25, box -5.3); move one, re-check
  the others or the left-side corner nodes vanish and no route exists.
- `KEEP_OUT` (her centre) is .65 from the island's faces and 1.35 in
  front of it: her head and hips reach about .6 from her centre, the stool
  legs .7 in front of the island. Shrink it and she walks through the stools.
  `FLOOR` is .6 from the counter and the window wall for the same reason.
  `clampFloor` and `pushOut` run the island's margin and the circles a few
  times and end with the margin (squeezed between it and the vacuum's
  circle, the margin wins), `clampFloor` then the floor's edge.
- The gap at the foot of the wall steps (between the counter's end and the
  window wall) is .78 wide and she is 1.2 long: routes go in and out by
  `GAP_MOUTH`, and at the foot she keeps facing north or the first step
  (`atStepFoot` in app.js). Any turn across the gap puts her in the wall.
- Boarding or stalking the vacuum, `approachVacuum` picks a side where she
  and her landing stay on free floor; off it, `PERCHES.vacuum.base` scores
  both sides, ahead and behind. `randomFloorPoint(pad)` keeps the vacuum's
  goals outside each obstacle's padded circle: `route()` drops a circle
  that holds the goal, and would drive straight through it.
- **Her tail keeps out of furniture** in `MotionRig.clearTail(solids)`
  (`motion.js`), run after the tail is posed and laid on the floor: each
  joint inside a solid turns its bone to bring it out by the nearest face
  (lying on top counts as out). The solids come per frame from
  `tailSolids()` in `app.js`: the room layout's `tailSolids` list (the
  kitchen's is in `layout()`; the study has none yet) minus her bed while
  she's in it and the counter while she sits in the sink, plus the vacuum
  where it is. Shapes: `box`, `cyl`, `rbox` (turned box, the tent).
- The motion rig resets the jaw and ears each frame (otherwise rotations pile up).
- Random choices make runs differ: seed `Math.random` (QA `open({seed})`).
  `setTimeout` and `performance.now` are real time: in QA they're put on
  virtual time (`lib.mjs`), else a busy machine changes the run.
- `MotionCat` paws: a standing (corrective) swing and a walking (`gait`)
  swing are advanced by different code; a swing of the wrong kind for the
  current mode is never finished (that was the dragged leg).
- Software WebGL is slow: step with `kitten.step(dt, n, false)` (draws only the last frame).
- github.io is blocked from the cloud container; check the deploy workflow run instead.
- Night: `clockNight()` (sunset table) or `?night=0` / `?night=1`.

## Opening screen
- `#title` is in `index.html` from the first paint and `body.title-on`
  makes the room full screen behind it (like Watch mode). `openTitle()` in
  `app.js` gets `onReveal` (room ready and any film over: pose her, set the
  camera), `onPlay` (greet), `onEnter` (screen covered: game layout, camera
  glides to the room, toys removed).
- While `title.on`, `idleLife` does nothing but `titleLife` (blinks, head
  tilts, the yarn ball). The care meters and the save are untouched.
- The film's last frame is a real screenshot: study, Mochi sitting at
  (0, 0, .5) facing +z, camera `TITLE_CLOSE`, portrait (fov 46). The live
  scene opens on exactly that, then eases to `TITLE_WIDE`. Change the pose,
  the study behind her or `TITLE_CLOSE` and the hand-over shows a jump:
  retake `sources/title/film-last-frame.png` and remake the film.
- The film is daylight, so day is forced until Play when the film plays.
- Seen-the-film flag: `localStorage[<save key> + '-intro']`, apart from the
  save and not in backup codes.
- `?title=0` no opening screen, `?title=film` the film again, `?title=1`
  with `?debug` (which otherwise skips it, for the QA tools and review pack).
- Toys (`dist/assets/models/`) are packed with meshopt: the loader needs
  `vendor/meshopt_decoder.module.js` (fetched only on the opening screen).
  Remake from `models/title-toys/` with `gltf-transform optimize
  --compress meshopt --texture-compress webp --texture-size 512`.

## Debug (`?debug` → `window.kitten`)
`brain`, `pet`, `cat`, `room`, `kitchen`, `place`, `view`, `camera`,
`step(dt, n, draw)`, `act`, `setActivity`, `walkTo`, `jumpTo`, `jumpDown`,
`goTo('kitchen' | 'room')`, `stroll`, `stealSalmon`, `drinkFaucet`,
`vacuumRide`, `vacuumAttack`, `ridePendant`, `nightLife`, `setNight(bool)`,
`knockItem`, `tapCups`, and others (see the end of app.js).
URL flags: `?debug`, `?frames`, `?night=0/1`, `?dog`, `?motion=classic`, `?title=0/1/film`.
