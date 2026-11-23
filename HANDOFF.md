# Handoff (2026-11-23): phase 21 live (build 543)

## Goal and exact next step
Phase 21 is done and live (build 543, `e180b68`), with the cleanup audit's
five items. Next: pick the next phase with Merlin (`docs/ROADMAP.md`). This
handoff's work is finished; delete this file at the next session start.

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
