# Handoff (2026-11-19): what she does in the living room

## Goal and exact next step
Phase 21, step 1 (`docs/phases/21-house.md`). Merlin picked the next job on
2026-11-19: **things for her to do in the living room**: nap on the sofa,
lie by the fire, knead the throw, watch the sea.

Next step: read `living.layout()` in `dist/living.js` (perch spots are
ready there) and `layout()` in `dist/kitchen.js`, which does not pass them
on yet (the living room is part of the kitchen's place, its frame is the
kitchen's z + 9.8, `K.front`). Then how app.js uses a place's perches and
idle picks (the kitchen's counter, shelves, island are the pattern). Before
building, tell Merlin in a few plain lines what she will do and where, and
ask the one thing that is open: which of the four first, or all four.

## Done (on the preview, build 479, commit `90cc0ce`; not live)
- The living room, joined to the kitchen (`tools/qa/join.mjs`, 13 of 13).
- The Christmas tree at the join, sea side, her round bed beside it;
  fountain and bowl stay put (`tools/qa/tree.mjs`, `tools/qa/tree-place.mjs`
  24 of 24).
- The Room view glides to the half she is in (`kitchen.half`, `view.half`
  in app.js); the living half's fit starts from `frame().from`.

## Left in step 1
- What she does in the living room (this handoff).
- A real-phone speed check of the joined space (Merlin).
- Rough edges: listed in `docs/phases/21-house.md`, step 1.

## Decisions not yet in SPEC.md
None: the tree's place and her Christmas bed are in SPEC.md.

## Rules learned
- Commit messages must not carry an AI model name; no "Co-Authored-By"
  line. A "Claude-Session:" link line is what earlier commits end with.
- The browser tests are slow here: `tree.mjs` about 35 minutes,
  `tree-place.mjs` and `join.mjs` about 12 to 15. Run one at a time, in the
  background, with no short timeout. For a quick look, a throwaway script
  with `open()` from `tools/qa/lib.mjs` and one still takes 3 to 4 minutes.
- In the fork a push does not publish: run the "Deploy site" workflow
  (`pages.yml` on `main`), then check `/preview/version.json`.

## Files to look at first
`docs/phases/21-house.md`, `docs/ARCHITECTURE.md` (rows `living.js`,
`kitchen.js`), `dist/living.js` (`layout`, `L`), `dist/kitchen.js`
(`layout`, `frame`), `SPEC.md` (the living room lines near line 238).
