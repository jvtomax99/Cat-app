# Handoff (2026-11-20): phase 21 step 3 (the bedroom) live (build 516)

## Goal and exact next step
Step 3 of phase 21 (`docs/phases/21-house.md`; Merlin swapped it with the
bathroom): the bedroom over the kitchen. **Live since 2026-11-20, build 516 (`def03b6`)**, without a phone check
first (Merlin's pick). Ask him how it runs on his phone; a stutter means a
speed fix before the bathroom.
Next after that: step 4, the bathroom (big job: similar apps were already
looked at 2026-11-19, see the phase brief; plan, wait for his OK). Its door
is already in the bedroom's east wall, shut (`bedroom.js` `B.bathDoor`).

## Done (commits 3444c9e to 9ab710f)
- `dist/bedroom.js`: the room, built in code; part of the hall's place
  upstairs (`hall.wing`), see ARCHITECTURE row `bedroom.js`.
- Her things: `bedNap` (perch `bigBed`), `seatWatch` (perch `windowSeat`);
  "The bedroom" in the picker (`callToBedroom`).
- Reviewer's five finds fixed; own find: a route loop at the doorway.
- Tests: `tools/qa/bedroom.mjs` 11 of 11, `hall.mjs` 13 of 14 (the one: its room list, since
  updated, not rerun), `stairs.mjs` 8 of 8. `npm run check` passes.

## Left
- Merlin's phone check of the live build.
- Rough edges: past the bedroom's edges the hall's floor shows far below
  (goes with step 5's outside); the corner-by-corner route may brush up to
  10 cm into a furniture margin (margins are 40 to 65 cm).

## Decisions not yet in SPEC.md
None (bedroom before bathroom and the duvet idea are in the brief / Later).

## Rules learned
- Commit messages: no AI model name, no "Co-Authored-By"; end with the
  "Claude-Session:" link line.
- Browser tests are slow (bedroom.mjs about 30 min, hall.mjs about 40,
  stairs.mjs about 30): one at a time, in the background.
- A place's `route()` must never hand walkTo a first point she's already
  on: it asks again for the same way, forever (stack overflow).

## Files to look at first
`docs/phases/21-house.md` (step 3), `docs/ARCHITECTURE.md` (rows
`hall.js`, `bedroom.js`), `dist/bedroom.js`, app.js `bedNap`, `seatWatch`, `upTo`.
