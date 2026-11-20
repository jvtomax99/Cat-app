# Handoff (2026-11-20): bedroom fixes live (build 522); next the bathroom

## Goal and exact next step
Bedroom fixes from Merlin's phone check of 516 (slow trips, no instant way
to a room, odd legs on the stairs, camera stuck on the bedroom floor) are
**live since 2026-11-20, build 522 (`d1a527c`)**.
Next: phase 21 step 4, the bathroom. **Plan approved by Merlin 2026-11-20**
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
