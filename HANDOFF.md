# Handoff: 2026-11-19

## Goal and next step
Phase 20 (one home) and the 360° camera are on the preview, build 470
(`b1e4e81`). Next: Merlin tries it on his phone; then his "Go live" (or
fixes from what he sees). Not live yet.

## Done (preview branch `claude/expressive-cat-modern-ui-65z6r5`)
- 360° camera turn: front walls in both rooms (study `walls.front`, kitchen
  `K.front`), walls hide when the camera is behind them, the camera rises
  to look down when a wall or furniture leaves little room (`cameraArm`,
  `view.rise`). `tools/qa/camera.mjs` 25 of 25.
- Phase 20 steps 1 to 7: `dist/house.js` (rooms, doorway, lanes),
  `walkToRoom`, `crossOver`, `callToRoom`, `placeBowls`/`inKitchen`,
  doorway camera (`doorBoxes`, lane yaw steering, `camRoom` culling), her
  own trips (`otherRoom` idle choice). Reviewer found 9 issues, all fixed.
  `tools/qa/house-walk.mjs` 12 of 12, `tools/qa/house.mjs` 12 of 12.

## Left / open
- Real-phone check (Merlin).
- Known, from before phase 20: the follow camera swoops quickly in front of
  furniture (up to 2.8 m per .2 s). Merlin chose to wait on it.
- The room picker's camera buttons for food/water still aim at the bowl
  through the wall when she is in the study.
- Another session is building phase 21 (living room) on this branch: its
  rooms need entries in `dist/house.js` ROOMS and DOORS.
- `tools/qa/tree.mjs`, `vacuum.mjs` not rerun since phase 20.

## Files to look at first
`docs/phases/20-one-home.md`, `dist/house.js`, `docs/ARCHITECTURE.md`
("Coordinates and sizes"), `dist/app.js` (`walkToRoom`, `crossOver`,
`updateCamera`).
