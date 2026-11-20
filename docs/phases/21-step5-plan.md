# Phase 21 step 5: the outside of the house and the House view

## Context
Last step of phase 21. The brief and the approved blueprint (`docs/house/blueprint.png`, "From the front") ask for a House button that pulls back to the whole house: pale walls, slate roof, front door. Coming closer, the near walls hide, and tapping a room takes you there. Done when (phase brief): the room picker and the House view reach all seven rooms; a phone holds the kitchen's frame rate; saves from before still load.

## How similar apps do it
- **The Sims 4:** a whole-house view you can turn round. You pick one of three wall modes (walls up, cutaway, walls down) and step floors up and down with buttons. The roof hides when you look at a lower floor.
- **Fallout Shelter:** the whole base is a cut-away seen from the side. Pinch to zoom, tap a room to pick it.
- **Toca Life World:** each house is a side-on dollhouse cut. You swipe between rooms and floors.

Where Mochi can be better:
- It's a real 3D house you can turn round, not a flat cut.
- Walls hide by themselves as you come close, so there's no wall mode to learn.
- A room you tap gives the same two choices as the picker, "Call her" and "Go now". From up there you can call her and watch her trot through the house.

## What you'll see (plain words)
1. **A "House" button** next to "Explore" and "Mochi".
2. **From outside:** the house as in the blueprint's front drawing.
   - The living room is one storey with a flat roof and tall glazing.
   - The middle is two storeys with a pitched slate roof and the front door.
   - The study block has its own pitched roof and a chimney.
   - Pale walls and windows where the rooms really have them. Around the house: sand, the terrace and the sea, as seen from the kitchen. Drag to walk round it, pinch to zoom.
3. **Look inside:** two buttons, "Upstairs" and "Downstairs".
   - The roof lifts off and the near walls fade.
   - Upstairs shows the landing, bedroom and bathroom. Downstairs shows the study, kitchen, living room and hall.
   - The view opens on the floor Mochi is on. She is drawn where she really is, still doing her thing.
4. **Tap a room** (while looking inside): a small card with the room's name and "Call her" / "Go now", the same two choices as the room picker.
   - Go now: the view flies into that room with her.
   - Call her: you stay in the House view and watch her walk there. If she takes the stairs, the shown floor follows her.
5. **Leave:** tap "Explore" or "Mochi".

## Not in this version
- Walking outside or in a garden.
- Seasonal looks on the outside (no Christmas lights on the house).
- Her climbing on the roof.
- Name tags or arrows to find her.
- Glowing windows at night beyond what the room lights already give.
- A saved House view preference: the app still opens in the view you last had.
- Bought models: everything is built in code, and the $50 budget is untouched.

## Build order (two preview checkpoints, one session)
1. **Measure first.** Extend `tools/qa/cost.mjs` to draw every room at once. If a floor's rooms together cost more than about 1.5 times the kitchen alone, cut detail in the House view before building on it: no sun shadow, a lower pixel ratio there, small clutter hidden at that distance.
2. **The shell.** A new `dist/house-shell.js` with outer walls, openings matching each room's windows and front door, three roofs, a chimney and the ground. Then the House button and camera.
   - **Checkpoint 1 on the preview:** the outside only, no rooms drawn inside. This part is cheap to draw.
3. **Looking inside.** The Upstairs/Downstairs buttons, the roof lifting, near walls hiding, the tap card.
   - Hide in the House view the things only meant to be seen from inside: the study's painted window view, the kitchen's sky sheet, the tall plaster sky-blockers, and the huge floor planes.
   - Cut the study's walls at the upper floor's height, so they don't poke into the bathroom.
   - **Checkpoint 2 on the preview.**
4. **Tests:** `tools/qa/house-view.mjs` (below). A separate reviewer checks the diff. Then the phone check.

## Assumptions (please check)
- Tapping a room gives Call her / Go now. The alternative was always going there at once.
- The floor buttons show only one floor's rooms at a time. Showing both floors stacked would cost twice the drawing on a phone.
- The study keeps its taller walls inside its own Room view. They are only cut at 10 in the House view, so the study you know doesn't change.
- No new saved data, so old saves load as they are.

## Biggest risk
Phone speed. Downstairs at once is the study, the kitchen and the living room together, and the living room is already the heaviest room. Step 1 measures this before anything else is built on it. If it's too heavy, the House view gets a lighter, less detailed version of the rooms.

## Technical notes (for the build)
- **Rooms are already placed round the current one:** `joinRooms` and `house.placeOf` in app.js and house.js. The House view forces every built group visible, on layer `SEEN`, and skips `doorwayInView`/`cullThroughDoor` (app.js ~5102-5139). Upstairs visibility comes from a House-view floor setting instead of `hall.level` (hall.js:645-654). Each room's own `update()` wall hiding must run for all rooms in this view.
- **Camera:**
  - Add `CAMERA_VIEWS.house` and a `[data-cam="house"]` button (index.html:108-113, handler app.js:3750).
  - Update `setCamMode` (3315) and `keepCamMode` (3723).
  - Bypass `clampGoal`/`cameraArm` limits in that view and use a house-sized orbit instead.
  - Raise the camera's far plane while in the House view (now 60; the house is about 38 x 21 units).
- **Shell:** placed in the house frame from the sizes in `tools/house-blueprint.mjs` and the phase brief's "Facts". It is drawn only in the House view, and its near walls hide by the same rule the rooms use.
- **Study cut:** a material clipping plane at y 10 on the study's walls, left at a harmless height outside the House view so shaders compile only once.
- **Tap:** in `endGesture`, before `floorTap` (app.js:3856/3566), raycast the visible rooms' floors, map the hit to a room id, then open the card. Its buttons reuse `goTo` and `callToRoom`/`callToLiving`/`callToBedroom`/`callToBathroom`/`callToLanding`.
- **Shadows:** the sun's shadow box only covers about ±6 round her, so in the House view, shadows go off.

## Verification
- `npm run check`.
- `tools/qa/house-view.mjs` checks:
  - the House button opens it;
  - the outside shows the three roofs, front door and chimney (stills);
  - Upstairs/Downstairs show the right rooms;
  - all seven rooms can be tapped to open the card;
  - Go now and Call her both work from it;
  - leaving gives the Explore view back;
  - no page errors;
  - draw calls per floor under the step 1 limit.
- `tools/qa/cost.mjs` House-view numbers next to the kitchen's.
- Re-run `bathroom.mjs` and `hall.mjs`, since both touch upstairs visibility.
- Preview link for Merlin's phone at each checkpoint.
- Show Lettuce the House view at checkpoint 1, since it changes what she sees.
- This session is already long. Once the plan is approved: write `HANDOFF.md` with this plan and start a fresh session for the build.

## Step 1 result (2026-11-20, `HOUSE=1 node tools/qa/cost.mjs`, phone size)
Draw calls: kitchen Room view 216 (Mochi view 90); every room downstairs at
once from over the house 580 (study 163, kitchen with living room 364, hall
83); upstairs with downstairs still drawn under it 718. Triangles about 2
million everywhere: her fur, so they don't matter here. Hiding meshes
smaller than a bounding radius r: r .2 → 500, .35 → 416, .5 → 365, .8 → 276.
Decision: in the House view, looking inside, meshes under radius .5 are
hidden while zoomed out (shown again close up); upstairs view hides the
downstairs rooms under its floor. Merlin's phone at checkpoint 2 decides
whether more is needed (next option: merging each room's still things per
material when the House view opens).
