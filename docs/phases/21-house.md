# Phase 21: the house (living room, hall, stairs, upstairs, bathroom, roof)

Merlin, 2026-11-18: more rooms she can walk freely, a second floor, a roof,
a bathroom; "a normal luxury house"; a blueprint first, then build. He
picked: add now, in steps; and "rooms plus a House view" (today's close
view in each room, and a House button that pulls back to the whole house).
Status: **blueprint approved by Merlin 2026-11-18; Lettuce saw it and liked it (Merlin, 2026-11-18). Starts when phase 20 (One home) is done: it builds on that phase's house map and room crossing.**

Blueprint: `docs/house/blueprint.png` (drawn by `node tools/house-blueprint.mjs`,
which holds every size; change the plan there).

## What it does
- **Living room** (Merlin's reference picture, 2026-11-18:
  `docs/house/reference-living-room.jpg`): the kitchen opens into it with
  no wall between. Glazing from floor to ceiling on the sea side and the
  end, an antique wool rug, a curved cream sofa, a rosewood coffee table, a
  worn leather chair, an aubergine mohair chair, a big painting over a
  sideboard, a fireplace. At Christmas the tree stands where the two
  spaces meet. Her tent moves here. Things she does: nap on the sofa, lie
  by the fire, knead the throw, watch the sea from the glazing.
- Downstairs: kitchen and study as they are, plus a **hall** with the front
  door and the stairs, reached by a new doorway in the kitchen's side wall.
- Upstairs: a **landing**, a **bedroom** over the kitchen, a **bathroom**
  over the study (through the bedroom).
- She walks between all rooms through the doorways and climbs the stairs
  step by step. No teleporting.
- A **House** button pulls back to the whole house: pale walls, slate roof,
  front door. Coming closer, the near walls hide (as the rooms' walls do
  since 2026-11-18); tap a room to go there.
- Every new room gives her things to do (at least two each):
  bathroom: drink from the tap, unroll the toilet paper, nap on the mat;
  bedroom: sleep on the big bed, watch from the window seat;
  hall and landing: sit on the stairs, race up and down them.

## Who it's for
Lettuce and the test group. Show Lettuce the blueprint before building.

## Not in this version
Decorating or moving furniture; a garden to walk in; seasonal looks for the
new rooms; new care needs (litter box, baths); bought 3D models (built in
code like the kitchen; the $50 budget is untouched); a closed house walked
through at her eye level (stays in "Later").

## Build order (one session each; each ends on the preview with a phone speed check)
Before it: phase 20 finished (she crosses the doorway for real, `dist/house.js`).
1. **The living room**, joined to the kitchen's front (`K.front`, the wall
   phase 20 left for it): one open space, the tree moved to the join.
   The furniture is built in code like the kitchen's; the picture sets
   the mood and materials, not a photo likeness.
   *Built on its own first (2026-11-18: `dist/living.js`, seen at
   `dist/living-check.html`; Merlin tried it on his phone: "the speed is
   good"). Joined 2026-11-19 (`tools/qa/join.mjs`): the kitchen's front wall
   is gone, she walks the whole space, her tent and fountain stand by the
   living room's glazing, one floor, plaster and sea terrace for both. It is
   part of the kitchen's place, not a third room (see ARCHITECTURE,
   `living.js`). The Christmas tree moved to the join 2026-11-19, sea side, her round bed
   beside it; fountain and bowl stay put (`tools/qa/tree.mjs`). What she does
   there (2026-11-19, Merlin: all four; `tools/qa/living-life.mjs`): a nap
   on the sofa (`sofaNap`), kneading the throw (`kneadThrow`), lying by the
   fire (`fireside`, also at night), watching the sea at the glazing
   (`seaWatch`); a tap on the sofa or the throw sends her up. The kitchen's
   `layout()` passes on the perches `sofa` and `throw` and the spots
   `seaSpot` and `fireSpot`. Not passed on yet: the sofa's back, the mohair
   and sling chairs, the far end's glazing. Still to do in this step: a
   phone speed check of the joined space (Merlin).
   Known rough edges: with her in the living room the kitchen's furniture
   has no sun shadows (`sunOver` in app.js); glance targets in app.js still
   point near the kitchen's origin; chasing a fallen bauble she always comes
   at it from the kitchen's middle (`chaseBauble`); seen from the kitchen
   half on a wide screen the tree's lower part may lie outside the sun's
   shadow area (not seen in a still). Each QA run of `tree.mjs` takes about
   35 minutes here.*
1b. **The hall.** A third room in `ROOMS` and a second doorway in `DOORS`
   (`dist/house.js`); whatever in `app.js` still assumes two rooms
   (`joinRooms`, `cullThroughDoor`, "the other room") becomes a list.
   *Built 2026-11-19 (`dist/hall.js`, `tools/qa/hall.mjs`; Merlin: hall
   first, the stairs as scenery, climbing next). The doorway is in the
   kitchen's right wall at its z 3.75 to 6.15, past the painting (the
   blueprint's spot is where the painting hangs); the front door faces it.
   The stairs are a dog-leg along the hall's length (lower flight east along
   the front wall, half landing at the east end, upper flight back west
   along the kitchen's wall to y 10), not two flights across the hall as
   drawn: across, there is no floor to step on to them from. Console and
   mirror, bench, runner, lantern, a fig under the upper flight. She walks
   there room by room (study, kitchen, hall), looks up the stairs, sits on
   the mat by the front door; no bed there (a nap takes her to the
   kitchen's). The room picker has "The hall". Still to do: a phone speed
   check (Merlin). Not yet: her two hall things (sit on the stairs, race up
   and down), which need step 2. Tests 2026-11-19: `hall.mjs` 14 of 14,
   `house-walk.mjs` 12 of 12, `join.mjs` 13 of 13. Rough edge: on a wide
   screen the Room view stands outside the front wall, and past the hall's
   east end it sees the dunes where the study's outer wall will be (step 5).*
2. **Stairs and landing.** Floors at different heights (`groundAt`), her
   feet on the steps, the camera following her up.
3. **Bathroom** with its three things to do.
4. **Bedroom** with its two things to do.
5. **Outside and the House view**: outer walls, roof, front door, tap a room.
Stop rule: if a real phone stutters after a step, fix speed before the next.

## Done when
She can walk by herself from her bed in the study to the bath mat upstairs
and back; the room picker and the House view reach all seven rooms; each new
room has its things to do; a phone holds the frame rate it has today in the
kitchen; saves from before still load.

## Facts for the build (house frame = the study's: x east, z south; 1 unit is about .41 m)
- Study: x -4.6 to 4.6, z -3.4 (back wall) to 8.6 (front wall).
- Kitchen (its place in `ROOMS`; `K.right` 10, `K.front` 9.8): x -19.05 to
  -5.05, z -9.9 (window wall, north) to 6.1.
- Hall: x -19.05 to -5.05, z 6.1 to 11.6. New doorway in the kitchen's
  right wall (kitchen's own z about 1.6 to 4; check the Christmas tree's
  corner, the tent and the bowl clear it). Front door in its south wall.
- Living room: x -33.05 to -19.05, z -9.9 to 6.1, one storey with its own
  roof; no wall to the kitchen (the kitchen's front wall goes).
- Upper floor at y 10 (kitchen walls are 9.5, the study's 12: trim to 10).
- Stairs: two flights of 10 steps with a half landing, at the hall's east end
  (built as a dog-leg along the hall: `H.stairs` in `dist/hall.js`).

## Risks
- The living room is the heaviest room to draw (much glazing with the
  outdoors behind it, the tree at Christmas) and sits in view of the kitchen.
- Phone speed has never been measured on a real phone, even for two rooms.
- Stairs are a new kind of movement for her (the leg work of phases 01, 07, 12).
- The study only lets her walk on the rug; the new rooms need real floor
  routing like the kitchen's.
