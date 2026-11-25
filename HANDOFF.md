# Handoff (2026-11-24, background run): going-through-furniture check built, first fixes

## Goal and exact next step
Merlin named "going through things" (riding the vacuum, walking into
furniture, her tail). The check for every room is built:
`tools/qa/clipping.mjs` (row in `docs/QA.md`). Next: fix the rest of the list
(below), rerunning
`ROOM=<room> SEC=150 node tools/qa/clipping.mjs` after each.

## Done this session
- Merlin is holding "Go live" until this work is on the preview, then
  releases it with the vacuum, legs and title fixes in one go.
- Preview publish re-run: `/preview/version.json` showed 41dad08 (has a5549b7).
- `clipping.mjs`: measures her bones and tail against each room's real
  triangles. Took four rounds to stop false alarms (mirrored meshes, edges,
  flat mats with faces both ways, rugs).
- Fixed: kitchen shelves and wall steps. Sitting on the lower shelf her
  hips were 14 cm inside the back wall (her spot was .3 from the wall, she
  sits .44 behind her spot). Spots moved out (`kitchen.js` perches). Shelf
  hits gone in the rerun.
- Bedroom and bathroom: pass. Landing: only small (5 to 8 cm) knees and
  elbows into the treads while climbing.

## Done 2026-11-24 (second run): commit e85c428, on the preview (build 562)
Merlin picked "fix the rest first": Go live still waits for the list below.
- Chair: spot forward (local z .48), take-off 1.8 out. Worst now 2 to 4 cm (was 42).
- Mantel: sits along it facing the vase (face pi), turns in the air as she
  lands (`turnIn`), take-off off to the vase side. Clean.
- Sill: spot toward the front, `turnIn`, jumps down to a new `down` point
  beside her bed (small turn). Clean on the sill.
- Study now has `tailSolids` (walls, sill, pitcher, chair pieces, fireplace,
  hearth, vase, bed rim).
- Sofa: spot at the front of the seat in a gap; the rust cushion moved to the
  middle to make that gap; cushions and arms added to the tail list. Clean.
- Check: a draped cloth drawn both ways (chair throw) no longer counts as solid.
- Full runs: study 1,213 overlap moments to 115; living 4,501 to 30.

## Done 2026-11-25 (third run): NOT COMMITTED (git commit was refused by
## the permission check; changes sit in dist/app.js and dist/living.js)
- Throw: spot at(S.x + .8, S.z - 1.6), top seat + .07. Rerun clean
  (was 19 cm hind foot, 13 cm wrist, 13 cm moss cushion).
- Study bed: `bedGround` (rim height under each paw and her body, low at
  the front), `bedBody`, `bedWay` (walks round the bed; in and out over the
  front). Sill take-off bed z - .1, landing bed x + 1.55, z - .4.
  Bed rim worst 2.5 cm (was 15). `npm run check` passes.
- Still there: on the sill route her tail tip dips up to 20 cm into the
  floor for an instant as she sits after jumping down (was 9.5 before;
  a tail-after-landing thing, not the bed). Rug edge (`Extrude@-0.4,0,0.3`)
  6 cm knee/tail: likely the check counting the rug's edge.
- Next: commit, push, Deploy site, check /preview/version.json.

## Left (next: the first two, then rerun ROOM=living PERCH=throw and
## ROOM=study, confirm with a picture, push, run Deploy site)
- Sofa throw perch: hind feet 19 cm into the seat on landing, wrist 12 cm
  into the moss cushion.
- Study round bed: walking past, wrists and knees 15 to 18 cm into its rim.
- Sill: wrist 3 to 5 cm into the books on landing.
- Kitchen wall step (lowest), hall stairs foot and doormat (see last handoff).

## Decisions not yet in SPEC.md
None.

## Files to look at first
`tools/qa/clipping.mjs`, `dist/app.js` (`PERCHES`, about line 640),
`dist/kitchen.js` (`layout()` perches), `docs/QA.md`.
