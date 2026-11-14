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
| `motion-cat.js` | `MotionCat`: poses (`POSES`), walk (to 1.0), trot (1.0-2.2) and gallop gaits (a dash, `ctl.sprint`, gallops from the first step; body `flex` and `saw`, level head, tail: `docs/phases/12-cat-motion.md`), foot placement and stepping, eating reach. Walk numbers from real cats: `docs/phases/07-walk-grace.md`. |
| `motion.js` | `MotionRig`: IK legs (`solveLeg`, `reachShort` = how far a leg is short of its paw), spine, head and neck, tail (`drapeTail`, bed bounds), floor contact. |
| `cat-rig.js` | Builds the skeleton and skin weights from the Meshy model at load. |
| `real-cat.js` | Fur, eyes, face, ears, jaw; also the classic movement (`?motion=classic`). |
| `room.js` | `Room`: the study, bowl, fountain, window visitors (bird, moths, monarch). Shared methods live on `Room.prototype` (the kitchen uses them too). |
| `window-view.js` | The view out of the study window (`room.outside`): one sheet at the glass whose shader draws sky, clouds, sea and surf and lays three painted dune pictures at different distances, so the view shifts as the camera moves. `room.view = {day, night}` picks the mood (0 day, 1 night, 2 dusk; `decor.js` sets dusk for Halloween). No canvas `filter` in the paintings: iPhones ignore it. The kitchen's terrace view is still a flat picture (`drawTerrace`). |
| `kitchen.js` | `Kitchen`: island, shelves, sink and faucet, pendant lamp, robot vacuum, terrace, dog (`?dog`). Layout constants in `K`; spots in `layout()`. |
| `decor.js` | Seasonal decor for both rooms; `pillowGeometry`. Seasonal looks have `months` and are stored away out of season (`inSeason`, `decorNow`; `?decor=halloween` shows one anyway). Christmas (`kitchenChristmas`) dresses the kitchen only; the study stays classic under it. Its evening lights run from `kitchen.updateChristmas`. |
| `pet-state.js`, `save.js` | Care meters, saves, offline progress. |
| `away.js` | The "While you were away" story: lines by part of the day, `awayStory(from, to, {asleep, decor})`, seeded by when the player left. No three.js, tested in node. |
| `rewards.js` | Gifts of friendship: `GIFTS` (level to gift), `TOYS`, what a level owns. Owning is worked out from the level every time; the save keeps only `pet.gifts` (shown) and `pet.toy` (picked). |
| `sound.js`, `meows.js` | Short sounds and meows (no ambient loops); the player's pick of music (`TUNES`, `setMusic`; `syncMusic` in `app.js` decides when it may play). |

## Title screen (app.js, "Title screen" block; markup `#title`; styles at the end of style.css; picture in `title-fx.js`)
A script in the head of `index.html` puts the class `title` on `<html>`
before the first paint: on at every launch, off with `?intro=0` or `?debug`
(the QA tools), forced with `?intro=full`, `short` or `1`. While `titleOn`:
the stage is full screen, `titleLife` runs instead of `idleLife`, the
header, panel and footer are `inert`. `titleStage` says where it is:
`load`, `gate`, `cine`, `live`, `still`.

Two kinds (`titleFull`, decided once at start):
- **Full**: every launch,
  not with reduced motion, not if she was put to bed. `gate`: two Enter
  buttons ("with sound" sets `pet.sound` and saves; "without" leaves the
  save alone). `cine`: the zoomies sequence. `live`: her name, she sits at
  `HOME` with her toys, "Play with <name>".
- **Still** (short): she sleeps on the study bed whatever the save says
  (`pet.sleeping` is not changed) under her name; "Tap to wake her".

The sequence: a story clock `cine.T` in real seconds. `SHOTS` = when each
shot starts plus its camera (`cineCamera` places the camera itself,
`updateCamera` is skipped). `CUES` = what she does when, by direct calls
(`setActivity`, `express`, `cineJump`: a jump with no crouch first).
`cine.watch` is a per-frame check (start the leap when she reaches the
hearth; freeze when she is nearly on the lens). `cine.hold` keeps her
heading. Slow motion: `timeRate` slows the game clock (`clockLag` in
`frame`); it is 1 outside the sequence. `endCine()` (the natural end, or a
tap: `titleTap`) tidies: vase home (`room.resetVase`), she is put at `HOME`,
lens and camera back, name in (`.reveal`).

**The film** (`startOpening`, `filmOK`, `startFilm`, `endFilm`, `stopFilm`):
after Enter, `filmOK()` (full title, day or night, `room.decor === 'classic'`,
`LONGHAIR`, `tallScreen()`, not `?film=0`) picks stage `film` instead of
`cine`. `<video id="title-film">` (in `.title-fx`) gets its `src` only then;
it is muted unless `pet.sound`. Under it the room is already the film's last
picture (she sits at `HOME`, toys placed with no wait), so `endFilm()` (the
end, a tap, or a key) only drops the `film`/`rolling` classes (CSS fades the
video out) and calls `enterLive(true, false)`, the same way into `live` that
`endCine` uses. No `playing` event within 3 s, an error or a refused
`play()`: back to `gate` and `startCine()`. Class `soft` turns off the white
flash. The test browser has no mp4: `tools/qa/title.mjs` serves
`fixtures/mochi-opening.webm` in its place.

**First steps** (`pet.taught = {ball, pet}`, `teachStep`, `learned`): made at
load (a save with bond, cuddles or journal entries counts as taught).
`refresh()` puts the step's text in `#scene-hint` with class `teach`.
`startPlay` learns `ball`, `touchCat` learns `pet`. The room ball is
tappable for good: `hitsToy()` (the ray passes within .26 of it) in
`endGesture` calls `act('play')`.

`leaveTitle()` (tap, click, Enter): from `still` she stretches and walks
home (or stays asleep); from `live` she greets you. The camera glides to
the room view (`view.glideUntil`), `shrinkTitle()` animates the stage down
to its card (the picture is only stretched meanwhile: `titleFlip`), then
`endTitle()` puts everything back and disposes `titleFx`.

`title-fx.js` (`TitleFx`): three's `EffectComposer` (vendored in
`dist/vendor/postprocessing`, `shaders`) with bloom, a vignette and grain
pass, plus sun shafts (additive sheets from the window to the sun patch)
and dust (points moved in the shader). Used ONLY while the title is up:
`frame` draws with `titleFx.render` if it exists, else the plain renderer.
It watches its own frame time: over 40 ms for a run of frames, it first
drops to pixel ratio 1, then turns bloom off. No depth blur yet.
The logo (`.title-logo`, `assets/title/pocket-kitten-logo.webp`) is the
brand at the top of every title stage except `cine`; her name (which can be
changed) stays live text under it.
Title toys (`TITLE_TOYS`, `loadTitleToys`, `placeTitleToy`, `titleToyLife`,
`clearTitleToys`): three Meshy models packed with meshopt (the decoder,
`vendor/meshopt_decoder.module.js`, is imported only here). Fetched when the
sequence starts, hidden until `endCine()` places them around `HOME` by the
title camera's yaw (`at`: [right on screen, toward the camera]); they pop
in, the yarn ball rolls now and then while her eyes follow, they shrink
away in `leaveTitle()` and are disposed in `endTitle()`. Not in the still
title. Re-place them if `HOME`, the live title's camera or her size changes.
Sounds: the wake-up chime in the still title (`sounds.play`,
`assets/sounds/wake-chime.mp3`, sound on only). The sequence has no music yet.

## Phone sheet (phase 08; app.js "The sheet" block, end of style.css)
- Under 720 px wide (`sheetMQ`): the stage is fixed full screen, the top bar
  is hidden and its `.top-actions` are moved into `.hud-left` (under her
  name), the `footer` is moved into the panel. `sheetLayout()` moves them
  back when the width grows past 720 px.
- The `.panel` (`#sheet`) is fixed at the bottom with two stops: resting,
  `translateY(100% - --peek)`, and open, `body.sheet-open`. `--peek-px` is
  measured by `sheetPeek()` (bottom of `.panel .needs` + 14 px; a
  ResizeObserver re-measures) and also places the dock and play meter.
- `roomFrame()` frames the room above the dock whenever `sheetMQ` matches.
- Drags: on the resting sheet anywhere, on the open sheet only from the
  grip or the "needs" heading (its content scrolls with `touch-action:
  pan-y`). The sheet is outside the camera's element, so its touches never
  reach the room. A capture-phase click handler swallows the click after a
  drag and opens the resting sheet on a tap that isn't on a button.
- Checks: `tools/qa/sheet.mjs` (phone), `tools/qa/panel.mjs` (tablet).

## Reasons to come back (phase 17)
- **When the player left**: `save.js` `load()` returns `left` (the save's
  `updated`, read before `restore()` moves it to now). 30 minutes or more
  (`AWAY_MIN`): `pet.away = {from, to, asleep}` is put in the save and stays
  there until the card has been seen (closing the app during the opening
  does not lose it). Coming back from the background does the same with
  `hiddenAt`.
- **News cards** (`#news-dialog`; `news`, `gatherNews`, `pumpNews` in
  app.js): one queue for the away story and for gifts. `pumpNews()` shows
  the next card only when she is `ready`, the title is off, `brain.mode` is
  `idle` and no other dialog is open; it is called a little after load,
  after `endTitle()`, from `refresh()` when something is waiting, and when
  a card closes. A card's `shown()` writes the Moment and marks it seen.
- **Gift toys**: `altToy()` is what stands in for the ball: the picked gift
  toy (`giftToy`, loaded on first use by `loadGiftToy`, parented to the
  scene like the ball) or else a decor's own toy (`room.altToy`). During
  the title only `room.altToy` counts (the title has its own toys).
  `useToy()` follows `toyChoice()`; `refresh()` calls it when the choice
  changes (a restored backup too).
- **Bowl name**: `Room.setBowlName(name)` (room.js), a curved strip with a
  canvas texture; `refresh()` sets it when level 4 is reached or the name
  changes.
- **Photo** (`takePhoto`): draws one frame and copies the canvas in the same
  task (the renderer has no `preserveDrawingBuffer`), cuts the picture
  above the dock on a phone, adds the caption, then `#photo-dialog` with
  Share (`navigator.canShare` with a file) and Save (a download link).
- Moments: `JOURNAL_MAX` (pet-state.js) = 40.

## Fun that lasts (phase 17b)
- **Friendship over days** (pet-state.js): `care()` no longer adds to
  `bond` itself; `earn(p, action, now)` does, with `DAY_FULL` (full counts a
  day), `WORTH`, then a tenth up to `DAY_EXTRA`. `pet.day` = `{key, n, extra,
  wish, wishDone, last}`; `today()` starts a new one when `dayKey()` (local
  date, turning at 4 am) is later than the stored key, never when it is
  earlier. `bond` can now have one decimal. `care(..., {auto: true})` (her
  own drink) earns nothing. `dayFull()` drives `#bond-day`.
- **Needs**: `DROP` (points an hour) and `AWAY_MAX_HOURS` (24) in
  pet-state.js; one rate, app open or closed.
- **Wish** (wish.js): `WISHES`, `todaysWish(pet, has)`, `grantWish(pet,
  event, has)`. app.js `wishCheck(e)` is called at the end of `act()` (not
  for her own drink or Rest) and after a photo; `wishNow()` is null during
  the first steps. `#wish` (under the nameplate) and the big need card's
  tip show it; `pumpNews()` has her say it once a visit when no card waits.
- **Later gifts** (rewards.js, level `LATE` = 5 and up): hers once the card
  has been shown (`owns(level, id, pet.gifts)`), at most one a day
  (`pet.giftDay`, `newGifts(level, shown, giftDay, dayKey())`); app.js
  `has(id)` and `dueGifts()`. `refresh()` applies them:
  `room.setFairyLights(on)` and `room.setFrame(on, image)` (room.js, both
  children of the fireplace so they hide with the right wall),
  `cat.setCollar({color, tag} | null)` (real-cat.js, on the neck bone;
  placement per model in `COLLAR`, set by eye). Ribbon colours: `RIBBONS`,
  `pet.collar`, picked in `#name-dialog`.
- **Framed photo**: "Hang it on the wall" in `#photo-dialog` stores one
  480 x 600 JPEG as a data URL under the save's key + `-frame` (not in the
  save or a backup code); `loadFramePhoto()` reads it at start.

## Phone speed and the offline copy (phase 18)
- **Her model**: the source is `assets/mochi-longhair-hq.glb` (8.9 MB, kept
  for the tools and `rig-check.html`). The app loads a packed copy made by
  `tools/mochi-longhair/web.sh` (meshopt): `-web.glb` (4.8 MB) or, on a
  touch device, `-phone.glb` (2.2 MB, textures at 1024). `?model=hq|web|phone`
  picks one. A packed file stores whole-number positions with the true size
  on the mesh's node; `plainGeometry` in `real-cat.js` turns that back into
  plain floats in the model's own space before the rig and fur read it.
  Change the source model → run `web.sh` again.
- **three.js** in `vendor/` is minified (esbuild); the readable source is
  the three.js repository at r180.
- **Offline copy**: `dist/sw.js` (how it works is at its top) and the
  script at the foot of `index.html`. A build is fetched whole into its own
  cache ("stage") and put to use only at a launch ("launch"), so a running
  app never mixes builds. An app left open looks again on every return to
  the front (at most once a minute) and every half hour (`watch` in that
  script); a build that is in is put to use on the next return, with
  `pk-swap` in sessionStorage so that one load skips the title. The first copy starts once she is home. What is
  kept is `dist/offline-files.json`, written by `node tools/offline-list.mjs`
  (every script reachable from `app.js`, plus pictures, sounds, toys; her
  model for the device; the film unless the phone asks to save data).
  `npm run check` fails when that list is out of date: **add a file the app
  loads → run the tool.** `version.json`, `sw.js` and the list are never
  served from the copy. Cache names carry the path (`pk:/Cat-app/preview/:`)
  because live and preview share an address. Off switches: `?sw=off`, or
  `"sw": false` in `version.json`. No `version.json` (local run): no worker.
- **Nothing is built at publish time** for this: `pages.yml` runs from
  `main`, so the preview cannot rely on a changed build script.
- **Quality** (`app.js`, "Quality"): after two seconds of frames slower than
  40 ms the room's picture steps down: 1 sharpness to 1.5, 2 two thirds of
  the fur layers (`cat.furLayers`), 3 sharpness 1 and half-size shadows.
  Kept for a day in `pk-quality`. Not during the title (`title-fx.js` has
  its own steps) and not under `?debug&frames`. `?q=0..3` fixes it, `?fps`
  shows frames a second and the level.

## Frame loop (app.js)
`frame(now)` → `updateCat(dt, t)` → `updateCamera(dt)` → `updateRoom(dt, t)` → render.

**Camera** (app.js, "Input"): an orbit round `view.focus`; everything eases
towards `view.goal`. Two modes for the player (phase 16), changed only by
the buttons (`CAMERA_VIEWS`, kept in storage as `mochi-cam`, put back by
`keepCamMode`): Mochi = `follow`; Explore = `room` (the whole room,
`roomFrame`), `free` (a view of your own), `spot` (bowl, fountain, bed).
No gesture crosses between `follow` and the rest. One finger always turns
(`orbit`). `zoomBy`: in Explore it zooms about `view.aim`, the thing under
the fingers (`thingUnder`: one raycast of `place.group` per pinch, else the
floor); far out gives `room` back; in `follow` it only changes the
distance. `goClose` = a double tap in Explore. Two fingers sliding call
`pan` (Explore only). Tilt follows zoom (`tiltFor(dist)`, applied as a
change, so each view keeps its own angle). `turnBy` is the only way the
view turns (drag, twist, flick): `TURN_MAX` each way from the front (the
rooms have no front wall, and from behind them wall furniture hangs in the
way), with a little give that `updateCamera` springs back. The camera
stays inside `CAM_BOX`: turned to a side, the arm shortens. `view.shown` is
how far the camera really is (walls, `boxArm`, furniture); zoom starts from
it. `view.zoomHeld` = the player chose the zoom, so follow leaves it.
`clearArea()` = the part of the picture above the care buttons and the
sheet; in `follow` the picture slides up by half of what they cover
(`camera.setViewOffset`, eased as `view.shift`; the camera itself does not
move, so taps on the floor land where they did), and close in it aims at
`cat.headCenter`. `keepCamMode`: Mochi mode unless
the player picked Explore (also called when the first steps end, from
`learned`). `showHer()`: a care button pressed in Explore while
`herInPicture()` is false looks at her (`lookAtSpot`, mode `spot`).
`view.fling` = the glide after a flick. Touch times come from `e.timeStamp`
(the QA freezes `performance.now`).

**Touch** (app.js, above `act`): the pointer hits invisible spheres on her
bones (`real-cat.js`, "colliders"; tail and paws included). `zoneAt(point)`
names the part (head, chin, back, tail, paws) by the nearest skeleton point,
`touchCat(zone)` sends welcome touches to `act('pet', {zone})` (`PET_ZONES`,
`brain.content` builds towards a roll-over) and tail or paws to
`dislikeTouch`. `callTo(x, y)`: a tap on the floor in Mochi mode, she walks there.

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

## Debug (`?debug` → `window.kitten`)
`brain`, `pet`, `cat`, `room`, `kitchen`, `place`, `view`, `camera`,
`step(dt, n, draw)`, `act`, `setActivity`, `walkTo`, `jumpTo`, `jumpDown`,
`goTo('kitchen' | 'room')`, `stroll`, `stealSalmon`, `drinkFaucet`,
`vacuumRide`, `vacuumAttack`, `ridePendant`, `nightLife`, `setNight(bool)`,
`knockItem`, `tapCups`, and others (see the end of app.js).
URL flags: `?debug`, `?frames`, `?night=0/1`, `?dog`, `?motion=classic`.
