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

## Left (worst first, from the last runs)
- Study window sill: Merlin picked "sideways". Done (`app.js` PERCHES.sill
  face pi/2, facing the books): sitting there is now clean
  (`ROOM=study PERCH=sill`). Still wrong for a moment: landing (she arrives
  facing the glass, jaw through it, then turns) and the turn before jumping
  down (tail through the glass). Ideas: land already turned, or add the
  window to the tail's solids (`tailSolids` in the study layout).
- Study mantel: jaw into the wall beside it, hips and tail into the vase
  (`Lathe@4.3,3.1,0.2`).
- Study chair: sitting and grooming, wrist and tail 20 to 40 cm into the
  chair's back and arms (`Plane@3.0,1.0,-1.1`, `Extrude@2.8,1.5,-2.6`).
  Not looked at yet: could partly be the check (the chair's cushion sheet).
- Study round bed: walking past it, knees 19 cm into its rim (keep-out
  circle too small?).
- Living room sofa: sitting, spine and tail 20 to 36 cm into the back
  cushions (`Buffer@-0.9,1.5,15.0`): sofa spot too near the back.
- Kitchen wall step (lowest): landing and grooming, ear into the window
  wall and back wall, hips into the counter. Cramped corner; the last
  session found every other spot worse.
- Hall: hips 8 cm into the foot of the stairs walking past (x -.2, z 3.9);
  10 cm into the doormat's side.

## Decisions not yet in SPEC.md
None.

## Files to look at first
`tools/qa/clipping.mjs`, `dist/app.js` (`PERCHES`, about line 640),
`dist/kitchen.js` (`layout()` perches), `docs/QA.md`.
