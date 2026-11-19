# Handoff (2026-11-19): phase 21 step 2 (stairs and landing) on the preview

## Goal and exact next step
Step 2 of phase 21 (`docs/phases/21-house.md`): Mochi climbs the hall
stairs to a new landing. **Live since 2026-11-19, build 506 (`62a295e`).** Merlin
hasn't said yet how it runs on his phone: ask.
Next: step 3, the bedroom (Merlin swapped it with the bathroom; big job: look at similar apps first,
plan, wait for his OK).

## Done (commits 5fc10e2 to the route fix)
- Stairs made gentler first (Merlin's pick): 12 + 12 steps of 17 cm on 25 cm
  treads, about 40 degrees.
- Each paw on its own step, body tilted (`motion-cat.js`: `ctl.ground`,
  `ctl.slope`). Landing = the hall's upper floor (`hall.level`), see
  ARCHITECTURE row `hall.js`.
- Reviewer subagent ran; its 8 real finds fixed. Own find: hall routes
  returned one point, which walkTo ignores (she cut across the stairwell;
  downstairs, the console's corner): routes now end with the goal.
- Tests: `tools/qa/stairs.mjs` 8 of 8, `hall.mjs` 14 of 14 (updated: the
  landing in the picker; stairs and landing count as hers). `npm run check`
  passes. Preview build 502 (`1b586f0`) has all the app changes (later
  commits are tests and notes only).

## Left
- Merlin's phone check of the live build.
- Rough edges: 3 cm high at the stairs' foot facing away; the hall shows
  under the landing's front edge in its Room view.

## Decisions not yet in SPEC.md
None (stairs slope and the single bedroom door are in the phase brief).

## Rules learned
- Commit messages: no AI model name, no "Co-Authored-By"; end with the
  "Claude-Session:" link line.
- Browser tests are slow (stairs.mjs about 30 min, hall.mjs about 40): one at
  a time, in the background.
- A place's `route()` must return the whole way with the goal last: walkTo
  follows only routes of two or more points.

## Files to look at first
`docs/phases/21-house.md` (step 2), `docs/ARCHITECTURE.md` (row `hall.js`),
`dist/hall.js` (`tops`, `rampAt`, `stairPath`, `level`), app.js `climbTo`.
