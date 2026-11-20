# Handoff (2026-11-20): phase 21 step 5, the House view, plan approved

## Goal and exact next step
Build phase 21 step 5 to the approved plan: `docs/phases/21-step5-plan.md`.
First step: extend `tools/qa/cost.mjs` to draw every room at once (per
floor) and compare with the kitchen alone; over about 1.5x, cut detail in
the House view before building on it. Then the shell (checkpoint 1 on the
preview: outside only), then looking inside (checkpoint 2).

## Done (this session)
- `e4d45b6` "The living room" in the room picker (Call her / Go now);
  `tools/qa/living-pick.mjs` 7 of 7.
- Build 531 live (living room card + the bathroom), `MILESTONES.md` row.
- Step 5 planned and approved (similar apps: Sims 4, Fallout Shelter,
  Toca Life World, in the plan).

## Left
- Merlin hasn't checked build 531 on his phone (the bathroom is unchecked
  on a real phone; no separate review of the bathroom is on record).
- Step 5 build, its reviewer pass, phone check, then phase 21 done and the
  cleanup audit (postponed until phase 21 is done, `docs/CLEANUP.md`).

## Decisions not yet in SPEC.md
None (the plan is in the phase brief).

## Files to look at first
`docs/phases/21-step5-plan.md` (has file:line pointers: `joinRooms`,
`updateRoom` ~5102, `CAMERA_VIEWS` ~3694, `endGesture` ~3856),
`docs/house/blueprint.png` ("From the front"), `docs/ARCHITECTURE.md`
rows `hall.js`, `bedroom.js`, `living.js`.
