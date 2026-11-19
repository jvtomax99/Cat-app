# Handoff (2026-11-19): living room things live; next, phase 21 step 2

## Goal and exact next step
Phase 21, step 1 (`docs/phases/21-house.md`). What she does in the living
room is built (Merlin 2026-11-19: all four): `sofaNap`, `kneadThrow`,
`fireside`, `seaWatch` in `dist/app.js`; `tools/qa/living-life.mjs` 24 of 24
(plain and Christmas). Live since 2026-11-19 (build 486, `9c37f1a`).

Next step: ask Merlin what he saw on his phone (the kneading, the speed of
the joined space) and fix what he finds; then step 2 of phase 21 (the hall
and stairs), confirmed with him first. Offered, not decided: the mohair and sling chairs and
the sofa's back as places for her (spots are ready in `living.layout()`).

## Done before (build 479, commit `90cc0ce`; live since 2026-11-19, see MILESTONES.md)
- The living room, joined to the kitchen (`tools/qa/join.mjs`, 13 of 13).
- The Christmas tree at the join, sea side, her round bed beside it;
  fountain and bowl stay put (`tools/qa/tree.mjs`, `tools/qa/tree-place.mjs`
  24 of 24).
- The Room view glides to the half she is in (`kitchen.half`, `view.half`
  in app.js); the living half's fit starts from `frame().from`.

## Left in step 1
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
  (`pages.yml` on `main`), then check `/preview/version.json`. The same after
  "Go live": a push to `main` does not start it either.

## Files to look at first
`docs/phases/21-house.md`, `docs/ARCHITECTURE.md` (rows `living.js`,
`kitchen.js`), `dist/living.js` (`layout`, `L`), `dist/kitchen.js`
(`layout`, `frame`), `SPEC.md` (the living room lines near line 238).
