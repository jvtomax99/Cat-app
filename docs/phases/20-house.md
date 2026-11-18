# Phase 20: the house (hall, stairs, upstairs, bathroom, roof)

Merlin, 2026-11-18: more rooms she can walk freely, a second floor, a roof,
a bathroom; "a normal luxury house"; a blueprint first, then build. He
picked: add now, in steps; and "rooms plus a House view" (today's close
view in each room, and a House button that pulls back to the whole house).
Status: **blueprint drawn, waiting for Merlin's OK (and Lettuce's look).**

Blueprint: `docs/house/blueprint.png` (drawn by `node tools/house-blueprint.mjs`,
which holds every size; change the plan there).

## What it does
- Downstairs: kitchen and study as they are, plus a **hall** with the front
  door and the stairs, reached by a new doorway in the kitchen's side wall.
- Upstairs: a **landing**, a **bedroom** over the kitchen, a **bathroom**
  over the study (through the bedroom).
- She walks between all rooms through the doorways and climbs the stairs
  step by step. No teleporting.
- A **House** button pulls back to the whole house: pale walls, slate roof,
  front door. The front lifts away like a dollhouse; tap a room to go there.
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
1. **Any number of rooms + the hall.** The code knows only "this room and
   the other" (`JOIN`, `joinRooms`, `cullThroughDoor`, `goTo`, `place !==
   room` tests in `app.js`). Make rooms a list with doorways between them,
   routes across rooms, then build the hall (no stairs yet).
2. **Stairs and landing.** Floors at different heights (`groundAt`), her
   feet on the steps, the camera following her up.
3. **Bathroom** with its three things to do.
4. **Bedroom** with its two things to do.
5. **Outside and the House view**: walls, roof, front door, the front that
   lifts away, tap a room.
Stop rule: if a real phone stutters after a step, fix speed before the next.

## Done when
She can walk by herself from her bed in the study to the bath mat upstairs
and back; the room picker and the House view reach all six rooms; each new
room has its things to do; a phone holds the frame rate it has today in the
kitchen; saves from before still load.

## Facts for the build (study's frame: x east, z south; 1 unit is about .41 m)
- Study: x -4.6 to 4.6, back wall z -3.4, open to the south (to z 8.6).
- Kitchen (after `JOIN`): x -14 to -5.05, z -9.9 (window wall, north) to
  3.1; open to the west. So the house opens on its south and west faces,
  and the House view looks from the south-west.
- Hall: x -14 to -5.05, z 3.1 to 8.6. New doorway in the kitchen's right
  wall (kitchen's own z about 1.6 to 4; check the tent and bowl clear it).
- Upper floor at y 10 (kitchen walls are 9.5, the study's 12: trim to 10).
- Stairs: two flights of 10 steps with a half landing, at the hall's east end.

## Risks
- Phone speed has never been measured on a real phone, even for two rooms.
- Stairs are a new kind of movement for her (the leg work of phases 01, 07, 12).
- The study only lets her walk on the rug; the new rooms need real floor
  routing like the kitchen's.
