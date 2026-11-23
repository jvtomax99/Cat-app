# Handoff (2026-11-23): House view part two on the preview; waiting on Merlin's phone check

## Goal and exact next step
Phase 21 step 5 (`docs/phases/21-step5-plan.md`). Both parts are now on the
preview (`d818610`). Next: Merlin checks it on his phone
(https://jvtomax99.github.io/Cat-app/preview/). If it's good: mark phase 21
done in `docs/ROADMAP.md`, then offer the cleanup audit
(`docs/cleanup-audit.md`; `docs/CLEANUP.md` says "none yet", postponed until
phase 21 is done) with buttons: "Run it now" (recommended), "Next session",
"Skip this time". Going live needs his "Go live".

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
