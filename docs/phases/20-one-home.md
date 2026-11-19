# Phase 20: One home, she walks between rooms

Status: preview (2026-11-19). Built steps 1 to 7; `tools/qa/house-walk.mjs` 12 of 12, `tools/qa/house.mjs` 12 of 12, `tools/qa/camera.mjs` 25 of 25; reviewer's 9 findings fixed. Not verified: a real phone. Known, from before this phase: the follow camera can swoop quickly in front of furniture (up to 2.8 m in .2 s). Plan approved by Merlin 2026-11-18 (food and water in the
kitchen only; first version study + kitchen). Start after the Christmas
tree (phase 06) is on the preview.

## Context
Merlin (2026-11-18): the goal is for Mochi to roam a house, not be tied to one room. Today the study and kitchen are joined only for looks: the kitchen shows through the doorway, but switching rooms teleports her (`goTo`, app.js:3637). Each room keeps her inside its own fence (study: the rug, `onRug`; kitchen: `FLOOR`, which stops 2 m short of the doorway), so she can't reach the opening.

Decided with Merlin today: first version = study + kitchen only (new rooms later, one per phase, on the same plan); food bowl and water fountain live in the kitchen only.

How others do it (research, thin sources): My Talking Tom Friends uses separate room screens and added a second floor in March 2026 (PocketGamer). Sims 4 pets roam a lot, and players report pets walking through walls or vanishing off the map with no way to call them back (EA forums). Where Mochi can be better: one continuous walk through a real doorway, the camera going with her, and she's never "lost": a chip always says where she went.

## What she'll do (for Lettuce)
- Walk from room to room through the doorway, no jump: on her own now and then (nap in the study, the kitchen window, the tree at Christmas), and when needed.
- Hungry or thirsty in the study: she trots to the kitchen to eat or drink, the camera following.
- Room picker becomes "call her": tap Kitchen while she's in the study and she walks there (no teleport).
- Mochi mode: the camera follows her through the doorway. Explore mode: when she leaves, the camera glides into the room she went to, and a chip says "Mochi went to the kitchen".
- Her room is saved; reopening the app finds her where she was.

## How (plain words, then files)
1. **A house map** (new `dist/house.js`): the rooms, where each sits in the house, and the doorways between them (a spot just inside each side, the opening's width). Replaces the single `JOIN` table (app.js:655) and its maths; adding a room later = one entry.
2. **A lane to the door in each room**: the study rug fence gets a corridor from the rug to its doorway; the kitchen floor fence gets one from the floor to the opening (clear of the vacuum dock). Reuse `onRug`, `clampFloor`/`pushOut`/`route` (kitchen.js), adding the lane, not rewriting them.
3. **Crossing**: a walk to a spot in another room becomes: walk to this side's door spot → walk through → at the threshold the app switches rooms *without moving anything on screen*: her position, heading and the camera are converted into the new room's frame (today `usePlace` + `goTo` reset all that). Then she carries on to the goal. Reuses `usePlace` (app.js:731) for the per-room swap.
4. **Bowl and fountain** stay in the kitchen (no longer re-parented by `usePlace`); feeding or drinking from the study routes her there first.
5. **Her own life**: a new idle choice "go to the other room" (rare, more at night, never mid-play or asleep), with a reason when there is one (study bed for naps, tree at Christmas).
6. **Camera and UI**: follow mode carries across; Explore glides to the new room; a small chip (design rules apply) when she changes room out of Mochi mode. Room picker buttons call her instead of teleporting.
7. **Teleport stays** only for app start (saved room) and the title screen.

Files: new `dist/house.js`; `dist/app.js` (usePlace, goTo, walkTo, idle choices, camera, picker); `dist/room.js` (doorway lane); `dist/kitchen.js` (lane to the opening); `dist/index.html` (chip); `tools/offline-list.mjs` run for the new file; `SPEC.md` ("Two rooms" Done when, Not in v1, Later); `docs/ROADMAP.md`, `docs/phases/20-one-home.md`, `docs/ARCHITECTURE.md`.

## Done when
She walks study → kitchen → study through the doorway with no visible jump (her house position changes under 0.1 at the switch); Mochi mode follows her across; Explore shows the chip and the new room; Feed in the study sends her to the kitchen bowl; she sometimes changes room on her own; the room picker calls her; reload keeps her room; tree, vacuum, camera and doorway tests still pass.

## Not in v1
New rooms (living room in the kitchen's open front, bedroom, garden), stairs, a map screen, looking at a room she isn't in, Miso.

## Assumptions
- Study and kitchen keep their size and place (kitchen just widened); the doorway is the one opening they share.
- The Christmas tree ships first (its test is running; preview link before this phase starts).
- One lamp and the sun's shadows follow the room she's in, as now.

## Biggest risk
The handover moment: her tail, the camera and things in flight (toy, vacuum ride, a jump) all use the room she's in. She only crosses on foot, never mid-play, riding or jumping; anything else is ended first. If it still looks wrong on a phone, fallback is a short soft fade at the threshold.

## Verification
New `tools/qa/house.mjs`: walks her both ways and checks no jump in house position and camera, Feed from the study, the chip, picker, reload; stills at the doorway day and night. Also `npm run check`, `tools/qa/tree.mjs`, `vacuum.mjs`, `camera.mjs`, `doorway.mjs`. Reviewer subagent on the diff. Then preview link for Merlin's phone; check with Lettuce that the walk feels right.
