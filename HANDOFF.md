# Handoff: 2026-11-18

## Goal and next step
Next: **phase 20, One home** (`docs/phases/20-one-home.md`, plan approved by
Merlin 2026-11-18). Start by confirming with Merlin, then build step 1 (the
house map, `dist/house.js`) and step 2 (lanes to the doorway in each room).
Before that: the Christmas tree in the widened kitchen should be on the
preview (see below).

## Done this session (preview branch `claude/expressive-cat-modern-ui-65z6r5`)
- Christmas tree moved several times at Merlin's request, then **the kitchen
  was widened** (right wall x 7 to 10, `K.right`; `FLOOR`, `VAC_FLOOR`,
  camera limits, `floorPatch`, painting at z 1.9 follow it). The tree stands
  in the new back right corner, right of the doorway (`TX` 8.1, `TZ` -1.4,
  `RY` 0 in `dist/xmas-tree.js`). Commit `e990700` and after.
- While the tree is up the tent is put away for a round bed (`kitchen.setTree`,
  `K.xmas`, `tentParts`, `roundBed`); other looks bring the tent back.
- Last build on the preview: 447 (`09042cf`, the spot before the widening).
  The widened kitchen is pushed but **not yet published**: run the Deploy
  site workflow (`pages.yml` on `main`) once `tools/qa/tree.mjs` passes, then
  check `/preview/version.json`.
- Tree test fixes: she settles before hiding/box; wall at x 10; hide wait 900.

## Decisions (in SPEC.md)
- Kitchen widened to x 10 in every look (Merlin 2026-11-18).
- Phase 20: study + kitchen first; food and water in the kitchen only;
  room picker calls her instead of teleporting. More rooms on "Later".

## Left / open
- Real-phone check of the tree (about 5000 needle cards). Merlin has not
  said "Go live".
- Offered, not decided: a "Tree" camera shortcut; moving the open box to
  the tree's front so she shows in it.

## Files to look at first
`docs/phases/20-one-home.md`, `dist/app.js` (`goTo` ~3637, `usePlace` ~731,
`JOIN` ~655, `joinRooms`, `cullThroughDoor`, `walkTo` ~839, `onRug` ~769),
`dist/room.js` (study doorway ~536), `dist/kitchen.js` (`K`, `FLOOR`,
`clampFloor`, `pushOut`, `route`).
