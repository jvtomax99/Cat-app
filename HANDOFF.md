# Handoff (2026-11-19): move the Christmas tree to the join

## Goal and exact next step
Phase 21, step 1 (`docs/phases/21-house.md`). The living room is built and
joined to the kitchen as one open space, on the preview (build 476, commit
`d7cab1c`), not live. Merlin picked the next job on 2026-11-19: **move the
Christmas tree to where the kitchen and the living room meet** (blueprint:
the tree circle at the join, sea side; in the kitchen's frame about x -4 to
-1, z 9.8 to 11.8).

Next step: read `dist/xmas-tree.js` (`TREE`, its `walls`, perches, box spot)
and `setTree` in `dist/kitchen.js`; move the tree; decide with Merlin where
her round Christmas bed, fountain and bowl go then (`K.xmas`; today they sit
by the tree's old corner near the study doorway); re-run `tools/qa/tree.mjs`
and `tools/qa/join.mjs`; stills by day and night; push; run the Deploy
workflow; check `/preview/version.json`.

## Done (commits on the preview branch)
- `2ddc45e`, `10cb5d1`: `dist/living.js`, test page `dist/living-check.html`,
  `tools/qa/living.mjs`.
- `3ccadb7`, `d7cab1c`: the join. `Kitchen` builds the living room as part
  of its own place (`kitchen.living`, at z + 9.8); floor and routes cross
  the seam; tent and fountain in the living room; one terrace and plaster;
  lamp light and sun shadow follow her. Test: `tools/qa/join.mjs`.
- How it works: `docs/ARCHITECTURE.md`, row `living.js`.

## Left in step 1
- The tree to the join (this handoff).
- What she does in the living room: nap on the sofa, lie by the fire, knead
  the throw, watch the sea. `living.layout()` has perch spots ready, but the
  kitchen's `layout()` does not pass them on yet.
- A real-phone speed check of the joined space (Merlin; he found the living
  room alone "good" on 2026-11-18).
- Known rough edges: with her in the living room the kitchen's furniture has
  no sun shadows (the shadow area follows her, `sunOver` in app.js); the
  Room view from the living room (`kitchen.frame` when `half === 'living'`)
  has not been seen in a still; glance targets in app.js still point near
  the kitchen's origin; `tools/qa/tree.mjs` was not re-run after the join.

## Decisions not yet in SPEC.md
- Merlin, 2026-11-19: keep the rosewood table and mohair chair as built in
  code (no Meshy models).
- The living room is part of the kitchen's place, not a third room in
  `house.js` (the hall, step 1b, will be the third).
- Her bowl stays in the kitchen; tent and fountain are in the living room
  except at Christmas.

## Rule learned
Commit messages must not carry an AI model name (CLAUDE.md); a commit with a
"Co-Authored-By" model line is refused here. Leave that line out.

## Files to look at first
`docs/phases/21-house.md`, `docs/ARCHITECTURE.md` (row `living.js`),
`dist/xmas-tree.js`, `dist/kitchen.js` (`K.xmas`, `setTree`, `SEAM`),
`tools/qa/tree.mjs`, `tools/qa/join.mjs`.
