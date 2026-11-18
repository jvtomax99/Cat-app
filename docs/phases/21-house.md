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
   *Built on its own first (2026-11-18): `dist/living.js`, seen at
   `dist/living-check.html`, stills by `tools/qa/living.mjs`. Still to do in
   this step once phase 20 is done: join it (one entry in `ROOMS`; kitchen's
   front wall goes; one floor and one sea terrace for both; the tree to the
   join; her tent and fountain moved for real), then what she does there.
   Weight on its own: about 150 draw calls and 67k triangles a frame
   (indoors 103 and 36k; the two terraces 48 and 31k). Merlin tried the
   room on its own on his phone, 2026-11-18: "the speed is good" (the
   first real-phone check; the joined rooms are still unmeasured).*
1b. **The hall.** A third room in `ROOMS` and a second doorway in `DOORS`
   (`dist/house.js`); whatever in `app.js` still assumes two rooms
   (`joinRooms`, `cullThroughDoor`, "the other room") becomes a list.
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
- Stairs: two flights of 10 steps with a half landing, at the hall's east end.

## Risks
- The living room is the heaviest room to draw (much glazing with the
  outdoors behind it, the tree at Christmas) and sits in view of the kitchen.
- Phone speed has never been measured on a real phone, even for two rooms.
- Stairs are a new kind of movement for her (the leg work of phases 01, 07, 12).
- The study only lets her walk on the rug; the new rooms need real floor
  routing like the kitchen's.
