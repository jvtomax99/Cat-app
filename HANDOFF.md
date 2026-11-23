# Handoff (2026-11-23): phase 21 done on the preview; cleanup audit waiting on Merlin

## Goal and exact next step
Phase 21 is done and marked in `docs/ROADMAP.md` (on the preview, build 539,
checked on Merlin's phone). The cleanup audit ran (`docs/CLEANUP.md`, 5
items, all low risk). Next: Merlin picks which cleanup items to do; then
"Go live" when he says so.

## Done
- `69aaa4b` part one: the house from outside, House button.
- `d818610` part two: Upstairs/Downstairs, roofs and shell walls off, one
  floor's rooms drawn whole, tap a room for a card (Call her / Go now), the
  view follows her to the other floor after Call her. Includes the code
  reviewer's four fixes. Built in a scheduled run that couldn't commit, so it
  came over as a patch and was committed here.
- Checks: `npm run check` pass; `tools/qa/house-view.mjs` all 25 pass
  (downstairs 307 draw calls vs the kitchen's 216; upstairs 151).

## Left
- Merlin's phone check of part two (and of build 531, the bathroom).
- Phase 21 marked done, the cleanup audit offer.
- `DESIGN.md` named in CLAUDE.md doesn't exist in the repo.

## Decisions not yet in SPEC.md
None.

## Files to look at first
ARCHITECTURE row `house-shell.js`; app.js `setFloor`, `houseInside`,
`houseOutside`, `roomAtTap`, `openHouseCard`; `tools/qa/house-view.mjs`.
