# Handoff (2026-11-20): bedroom fixes on the preview (build 522)

## Goal and exact next step
Merlin's phone check of live build 516 found four problems (not a speed
stutter): slow trips, no instant way to a room, odd legs on the stairs,
camera stuck on the bedroom floor in Mochi view. All fixed, on the preview
as build 522 (`d1a527c`). Waiting on Merlin: try it, then "Go live".
Then: phase 21 step 4, the bathroom. **Plan approved by Merlin 2026-11-20**
(as in the brief, step 4): tub, sink on a cabinet with a tall tap, toilet
and roll, mat, towel rail, window, plant; she drinks from the tap, unrolls
the paper (rolls back up after she leaves), naps on the mat; water runs only
while she drinks; no new purchases; a save there opens in the hall.
Reuse app.js `drinkFaucet`/`sinkSit` ideas from the kitchen.

## Done this session
- Camera: no doorway boxes upstairs (`view.doorBoxes`), the bedroom lies
  past the kitchen's wall.
- Called from the picker she runs all the way (`upTo(fn, run)`, climbs).
- Picker: each room "Call her" / "Go now" (`data-go` → `goTo`).
- Stairs: `STAIR_LIFT` .5 riser in hall.js `rampAt`, `STAIR_TILT` 1.
- Tests: `stairs.mjs` 8/8, `bedroom.mjs` 11/11, `npm run check` passes.
  New tools: `tools/qa/cost.mjs`, `cpu.mjs` (frame cost per room).

## Files to look at first
`docs/phases/21-house.md` (step 4), `dist/bedroom.js` (`B.bathDoor`),
`docs/ARCHITECTURE.md` rows `hall.js`, `bedroom.js`.
