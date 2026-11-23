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
| `window-view.js` | The sky, sea and beach outside (a shader on one sheet), and for the study window (`room.outside`) three painted dune pictures laid at different distances, so the view shifts as the camera moves. `SCENES` at the top places everything. `room.view = {day, night}` picks the study's mood (0 day, 1 night, 2 dusk; `decor.js` sets dusk for Halloween). The dune pictures are tiled by painting three copies: ground first in all three, then what stands on it. No canvas `filter`: iPhones ignore it. |
| `terrace.js` | Outside the kitchen, in 3D (`kitchen.terrace`; `kitchen.outside` is the strip the dog walks on): paving to a low wall, olive trees in pots (leaf cards), dunes (`duneHeight`) with grass cards, and the sheet from `window-view.js` far behind for sky and sea (`kitchen.terraceView`). Unlit: shade is painted in, and `update` tints it all by night. |
| `bird.js` | The sparrow at the windows (`makeBird`): painted cards (body, folded wing and legs when perched, two spread wings on hinges), flat front to back to fit between the view and the glazing bars. Flown by `Room.updateBird`. |
| `living.js` | `LivingRoom` (phase 21 step 1): the room the kitchen opens into. **Part of the kitchen's place, not a room of its own in `house.js`**: `Kitchen` builds it (`kitchen.living`), adds its group to its own at z + 9.8 (`K.front`; same axes), and the app still knows two places. Sizes in `L` (its own frame: x -6 sea glazing to 10 fire wall, z 0 to 14). Past the seam (`SEAM`, kitchen z 7.2) `kitchen.clampFloor`/`pushOut`/`route`/`randomFloorPoint` hand over to the living room's (`viaLiving`); a route across goes by the point where the straight line crosses the seam. Her tent and fountain stand there (`K.tent`, `FOUNTAIN_HOME` in kitchen.js, still children of `kitchen.group`; at Christmas `setTree` swaps the tent for a round bed beside the tree at the join, `K.xmas.bed`; the tree's foot and box are this room's to walk round, `living.setExtras`). One plaster (the seasons tint it), the kitchen's floor, and the kitchen's terrace run on behind it (`buildTerrace` `span`/`wall`/`tufts`); its far end has a terrace of its own, meeting at the corner. `kitchen.half` ('kitchen' or 'living', from where she is; round the Christmas tree she counts as 'living' from z 8.2, and going back takes a step of .8 past the line; `setHalf` sets it at once on arriving) picks the Room view (`frame`; the living half gives `from`, where `roomFrame` starts its fit; app.js re-aims the Room view with a glide when the half changes), the lamp light's place and, in app.js, where the sun's shadow lies (`sunOver`). No perches or things to do there yet. Many small pieces are merged per material (`batch`); soft furniture is made by `sweep`. On its own (`alone: true`): `dist/living-check.html`. What she does there: `living.layout()` gives the spots in its own frame (`perches` sofa, throw, sofaBack, mohair, sling; `windowSpot`/`seaLook`; `fireSpot`/`fireLook`); `kitchen.layout()` passes on `perches.sofa` and `perches.throw` (without the sofa's lane: `stroll` in app.js only knows lanes along x) and `seaSpot`, `fireSpot` ({at, look}), all moved by `K.front`; app.js: `sofaNap`, `kneadThrow`, `fireside` (the study's fire too), `seaWatch`, picked in `idleLife` and `nightLife`; the three floor ones set `brain.nextIdle` so the next idle pick doesn't cut them short. |
| `hall.js` | `Hall` (phase 21, step 1b): the hall, a **third place** in `house.js` (`ROOMS.hall`, the second entry in `DOORS`), off the kitchen's right wall by the doorway at the kitchen's z 3.75 to 6.15 (`K.hallDoor`; `H.door` here). Its own frame: x -7 (bench) to 7 (stairs' end) along the kitchen's wall, z 0 (that wall) to 5.05 (the front door's wall, which hides for the Room view). Built with the kitchen (`buildKitchen` in app.js: `kitchen` set means `hall` set), sharing its floor and plaster materials. Gives the app what a place needs: `id`, `group`, `floor`, `walls`, `layout()` (home, toyHome, sunSpot by the front door, `stairsSpot`, no perches, tailSolids, limits, camBox, camSolids, camBlocks), `frame(wide)`, `activate(lamp)`, `clampFloor`/`randomFloorPoint`/`route`/`pushOut`, `update`. **No bed** (`noBed`; a dummy `bed` far away with `bedRadius` 0): `toBed` in app.js walks her to the kitchen's first, and a save that has her asleep in the hall opens in the kitchen. The stairs (`H.stairs`, `buildStairs`: a dog-leg of 12 + 12 steps, 5/12 high on .5 treads, lower flight east along the front wall from x -.4 to a half landing at y 5, upper flight back west along the kitchen's wall to y 10). **Upstairs (phase 21 step 2): the landing is the hall's upper floor, part of the same place** (`buildUpstairs`: oak floor at `H.up` 10 round the stairwell, `H.well` the gallery's edge, window, the bedroom's door shut, runner, fig). `hall.level` ('down'/'up', from her height: `levelAt`, set each frame in app.js via `setLevel`, which clears `layoutCache`) picks `layout()` (camera box below the landing's floor downstairs, above it upstairs; the landing's spots `topSpot`, `windowSpot` are at y 10, in both layouts), `frame()`, the lamp's place, where she walks (`clampFloor`/`randomFloorPoint`/`route`: upstairs `UPFLOOR`, the main floor and the gallery) and whether upstairs is drawn (not while she's downstairs). Standing heights: `tops(x, z)` lists floor, treads, half landing, landing; `groundAt(x, z, ref)` is the highest she could step on from height `ref` (each paw's, via `ctl.ground` in motion-cat.js), `rampAt` the smooth line through the treads' middles plus up to half a riser (`STAIR_LIFT`, eased in and out at each flight's ends; without it the treads' noses came up through her chest, 2026-11-20) (her body: app.js sets her root to it under her hips, `HIPS_BACK`, and `brain.slope` tilts her by `STAIR_TILT` (1, the whole slope) of the slope, `ctl.slope`). Walking: `stairPath(up)` (foot, flights, turn on the half landing, top); app.js `climbTo(up, then, run, stop)`; `walkTo` in the hall takes the stairs first when the spot is on the other floor (y over 5 = upstairs, y .05 to 5 = the hall's floor: `hallFloor`, the toy) or she's on a step; `walkToRoom` from upstairs goes down first. Her things: `stairSit`, `stairRace`, `upstairsLook` ('topSpot', 'windowSpot'); the room picker's "The landing" (`callToLanding`; `goTo('landing')`). A save keeps `pet.place` 'hall': she opens downstairs. In app.js: `roomOf(id)`, `builtRooms()`, `placeId`; `walkToRoom` goes room by room (`house.nextRoom`); a room that isn't the camera's is drawn only while every doorway on the way to it is in view, cut to what shows through its own (`doorwayInView(far, near)`, `cullThroughDoor(far, near)`, `house.opening`); in the hall she looks up the stairs (`stairsLook`) or sits on the mat by the front door (`doorSit`); no bird-watching there. |
| `house-shell.js` | `HouseShell` (phase 21 step 5): the house from outside for the House view, in the house frame (house.js, the study's): three blocks (`BLOCKS`: living room one storey with a flat roof; the middle, kitchen and hall with bedroom and landing over them, two storeys; the study with the bathroom over it), outer walls with windows and the front door (`face`), gable roofs with ridges north to south, the study's chimney, sand, terrace, path, sea. Every piece merged per material (about 10 draw calls); opaque glass that glows warm at night (`update`). app.js: `placeShell` builds it on first use and stands it round the current room (`placeOf('room', here)`); it lives on its own layer (`HOUSE_LAYER` 2, the lights too); `CAMERA_VIEWS.house` (button `data-cam="house"`) sets `view.mode` 'house', `houseFit` stands back to fit `BOUNDS` in the clear part of the picture (the picture shifts up as in Mochi mode); `houseLayers` makes the camera see only that layer, with a far plane to match and a sky (`scene.background`) while in it; `clampGoal`, `zoomBy`, `pan` and the per-frame camera have a House-view branch; in and out of it the view cuts (`setCamMode`); Looking inside (part two): `view.floor` 'down'/'up' (buttons `data-floor` under the nameplate, shown by `body.house-view`; a tap from outside looks in on her floor, `herFloor`; the pressed button again goes back out). `houseInside` (from `updateRoom`, instead of the doorway culling) draws that floor's rooms whole (upstairs: only the hall's group; `hall.houseFloor` overrides `hall.level` for what's drawn up there), hides the shell but its ground (`SHELL_GROUND`), each room's big floor for its `floorPatch` (every frame: crossing rooms re-joins them), meshes under radius `HOUSE_SMALL` .5 while `view.dist` is over `HOUSE_CLOSE` (one traversal per floor/zoom/room change, `inside.key`), her when not on that floor, and sun shadows (intensity 0, not off, so nothing recompiles); `houseInsideAfter` hides the inside-only pieces after the rooms' own updates (`insideOnly`: study window sheet, terraces, the 30-high sky walls); `studyCut` clips the study's walls at y 10 (a clipping plane on its wall materials from the start, far overhead elsewhere). `houseOutside` puts all of it back. Tap: `roomAtTap` (the floor's plane, mapped to a room by `BLOCKS` and the hall's line) opens `#house-card` with Call her / Go now (`callHer`, `goNow`, shared with the room picker); after Call her the shown floor follows her (`view.floorFollow`, until she's stood still two seconds); `crossOver` keeps the House view. Test: `tools/qa/house-view.mjs`. |
| `kitchen.js` | `Kitchen`: island, shelves, sink and faucet, pendant lamp, robot vacuum, terrace, dog (`?dog`). Layout constants in `K`; spots in `layout()`. Room width is `K.right` (10 since 2026-11-18); `FLOOR`, `VAC_FLOOR` and `randomFloorPoint` sit just inside it, so move them with it. At Christmas `setTree` swaps the tent for a round bed (`K.xmas`). |
| `bedroom.js` | `Bedroom` (phase 21 step 3): the bedroom over the kitchen, **part of the hall's place, upstairs** (as the landing is): `Hall` builds it (`hall.bedroom`) and adds its group to its own, in the hall's frame (x -7 to 7, z -.45 to -16.45, past the kitchen's wall; plan in `B`, heights above its floor, the hall adds `up`). Reached by the landing's door (`H.bedDoor`; its leaf now stands open, `hall.bedLeaf`). `hall.wing` ('landing'/'bedroom', from her z with a little give either way: `wingAt`, set each frame next to `setLevel`; both call `applyLevel`, which now also refreshes `PERCHES`) picks upstairs `layout()` (home, sunSpot, limits, camBox, camSolids), `frame()` (the bedroom's Room view: from beyond its west wall, over the living room's roof; phones from the corner by the landing) and the lamp's place (`lampFor`). Walking: `clampFloor` (its floor, the doorway's lane, `pushOut` of the kept-clear patches `KEEP`), `randomFloorPoint`, `path(a, b)` (shortest way round the patches' corners); `hall.route` upstairs joins the landing's way (`landingPath`) and the bedroom's by the doorway. `tops()` in hall.js: past the kitchen's wall (z < -.05) only the floor and the bedroom's. Her two things are perches in the upstairs layout (`bigBed`, `windowSeat`, both with `top` at the bedroom's height): app.js `bedNap`, `seatWatch` (via `upTo`: to the hall, up the stairs); upstairs a `nap` (and, at night, a worn-out catnap) is a `bedNap`. Picker: "The bedroom" (`callToBedroom`, `goTo('bedroom')`). With her upstairs the camera counts as in the hall (it is over the kitchen's plan) and the other rooms aren't drawn; upstairs `view.doorBoxes` stays off (the bedroom lies past the kitchen's wall, which once made the Mochi view's arm shrink to the floor). Bathroom door in the east wall (`bathroom.js`). Tests: `tools/qa/bedroom.mjs`, stills `bedroom-look.mjs`. |
| `bathroom.js` | `Bathroom` (phase 21 step 4): the bathroom over the study, **part of the hall's place, upstairs**, built by `Hall` (`hall.bathroom`) after the bedroom, in the hall's frame (plan in `A`: x 7.45 to 16.2, past the bedroom's east wall at 7; z -.45 to -9.95; heights above its floor). Reached by the bedroom's east door (`B.bathDoor`: the bedroom keeps only its frame; the leaf is here, folded flat on the west wall). `hall.wing` 'bathroom' (`wingAt`: x past 7.4, back under 6.6) picks its `layout()` (home, sunSpot, limits, camBox, camSolids), `frame()` (from beyond the south wall) and the lamp (`bathLampSpot`). Upstairs is a row of three rooms: `hall.upRoom(p)` (0 landing, 1 bedroom, 2 bathroom: `bathroom.holds`); `hall.route` goes room by room through each doorway's two spots (`bedroom.doorSpot`/landing; `bathroom.bedroomSpot`/`doorSpot`), each room's own way round its furniture (`path`, `KEEP`, as the bedroom's); `straightOk` likewise; `clampFloor` sends x past 7.2 (or the door's lane, `inLane`) here. Its perch `vanity` (the counter by the bowl) and spots `tapDrink`, `rollSpot`, `matSpot`, `bathHome` are in the upstairs layout. app.js: `tapDrink` (up on the counter; `tapRun(true)` only for the drink), `paperPlay` (swats; `pullPaper`; `update` rolls it back once `near()`, set in `buildKitchen`, is false), `matNap`; `callToBathroom`; picker "The bathroom" (`goTo('bathroom')`). A save keeps `pet.place` 'hall' (opens downstairs). Tests: `tools/qa/bathroom.mjs`, stills `bathroom-look.mjs`. |
| `decor.js` | Seasonal decor for both rooms; `pillowGeometry`. Seasonal looks have `months` and are stored away out of season (`inSeason`, `decorNow`; `?decor=halloween` shows one anyway). Christmas (`kitchenChristmas`) dresses the kitchen; the study stays classic under it, plus pine on the mantel. The Christmas tree (`xmas-tree.js`) stands at the join with the living room. Its evening lights run from `kitchen.updateChristmas`. |
| `xmas-tree.js` | The Christmas tree where the kitchen and the living room meet, sea side (since 2026-11-19: `TX`, `TZ`, and `RY` = π so her side faces the kitchen, where the Room view looks from; it stands past `SEAM`, on the living room's floor) (Christmas look only, `kitchen.xmasTree`, built in `applyKitchenDecor`): fir sprays, lights, baubles, velvet bows (one merged bow geometry from `decor.js`, instanced), the star, the skirt and the open box as a few instanced draws; the needles are cleared round the places she lies. `TREE` (plain numbers) places it, her perches `treeLow`/`treeMid`/`treeHigh`/`treeTop`, `xmasBox`, the hiding spot and the first-look spots. `kitchen.setTree(on)` hands its foot and the box to the living room's floor (`living.setExtras`); fallen baubles stay inside `TREE.walls` and bounce off `kitchen.livingSolids` (sofa, table) too; app.js `withTree` adds the perches and a camera solid to the kitchen's layout. Tree API: `shake`, `bat`, `drop`, `kick`, `rehang`, `hanging(group)`, `hitFallen`, `update`. Her side (app.js): `curiousLook`, `climbTree`, `stuckAtTop`/`helpDown`, `batBauble`, `knockBauble`, `chaseBauble`, `treePaw`, `treeHide`, `boxSit`, `rehangBauble`. Nothing is saved. |
| `pet-state.js`, `save.js` | Care meters, saves, offline progress. |
| `away.js` | The "While you were away" story: lines by part of the day, `awayStory(from, to, {asleep, decor})`, seeded by when the player left. No three.js, tested in node. |
| `rewards.js` | Gifts of friendship: `GIFTS` (level to gift), `TOYS`, what a level owns. Owning is worked out from the level every time; the save keeps only `pet.gifts` (shown) and `pet.toy` (picked). |
| `sound.js`, `meows.js` | Short sounds and meows (no ambient loops); the player's pick of music (`TUNES`, one piece or the Mix of all three in turn, `setMusic`; `syncMusic` in `app.js` decides when it may play). |

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
view turns (drag, twist, flick), all the way round: `goal.yaw` is kept in
one circle (`wrapYaw`) and `view.yaw` eases the short way to it. Each room
has a front wall (study `walls.front`, kitchen `K.front`); a wall the
camera is behind hides (`room.update`, `kitchen.update`). The camera
stays inside `CAM_BOX`; `cameraArm` gives its arm after walls and
furniture, and when that is short (turned to a wall or the island)
`view.rise` tilts it up to look down instead of squeezing in close. `view.shown` is
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
- The active room is at the origin; `brain.pos` is in its frame. Where
  each room stands in the house, and its doorways, is `dist/house.js`
  (`placeOf`, `convert`, `doorBetween`; checked by `house-checks.mjs`).
  The other room is set by `joinRooms`; the room the camera stands in is
  drawn whole and the other only through the doorway (`cullThroughDoor`).
- Between rooms (phase 20): each doorway has a lane from her floor
  (`laneAt`; `walkTo` enters and leaves it by its mouth). `walkToRoom(id)`
  walks her through; halfway through the wall `crossOver` puts her, her
  target, the toy, the camera, the sun and her gait's last position into
  the new room's frame and calls `usePlace` (nothing moves on screen).
  `callToRoom` is the room picker's "Call her" (she runs; so do `callToLanding`, `callToBedroom` via `upTo(fn, run)`), its "Go now" (`data-go`) is `goTo` (instant; not while she sleeps); `inKitchen(fn)` sends her to the bowl
  and fountain, which live in the kitchen (`placeBowls`). Near a doorway
  the camera may stand in either room or the opening (`doorBoxes`). `goTo`
  (teleport) is only for start-up and tests.
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
