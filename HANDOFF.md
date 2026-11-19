# Handoff (2026-11-19): the hall is live; next, phase 21 step 2 (the stairs)

## Goal and exact next step
Phase 21, step 1b, the hall (`docs/phases/21-house.md`): **live since
2026-11-19, build 494 (`2e5dea2`)**. Merlin, 2026-11-19: on his phone it
runs smoothly with three rooms.
Next: step 2, climbing the stairs and the landing. A big job: look at 2 or 3
similar apps, plan in plain words, list assumptions, wait for his OK.

## Done (commits c4dfd38 to 2e5dea2)
- `dist/hall.js`: the room (front door, console and mirror, bench, runner,
  lantern, fig, dog-leg stairs as scenery). `dist/house.js`: `ROOMS.hall`, a
  second doorway, `nextRoom`, `opening`. Kitchen's right wall has the doorway
  (`K.hallDoor`).
- `dist/app.js`: rooms as a list (`roomOf`, `builtRooms`, `layoutOf`),
  room-by-room walks, drawing through up to two doorways, hall life
  (`stairsLook`, `doorSit`), `toBed` (no bed in the hall).
- Review fixes: the camera-room test only counts beside a doorway; out of one
  doorway's lane before the next. Own fix: a walk that reaches the
  kitchen-living seam crosses it (`kitchen.route`).
- Tests: `tools/qa/hall.mjs` 14 of 14, `house-walk.mjs` 12 of 12, `join.mjs`
  13 of 13, `npm run check` passes. Stills: `tools/qa/hall-look.mjs`.

## Left
- Rough edge: on a wide screen, past the hall's east end the view shows dunes
  where the study's outer wall will be (step 5).
- The deploy run sometimes fails with "No artifacts named github-pages"
  (a GitHub hiccup): start a fresh run, don't re-run (the re-run sat queued).

## Decisions not yet in SPEC.md
None: the hall's line is in SPEC.md (house section).

## Rules learned
- Commit messages: no AI model name, no "Co-Authored-By" line; end with the
  "Claude-Session:" link line.
- Browser tests are slow here (`hall.mjs` about 40 min, `join.mjs` and
  `house-walk.mjs` 12 to 15). Run them one at a time in the background.

## Files to look at first
`docs/phases/21-house.md` (step 1b, step 2), `docs/ARCHITECTURE.md` (row
`hall.js`), `dist/hall.js` (`H`, `H.stairs`, `layout`), `dist/house.js`.
