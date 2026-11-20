# Handoff (2026-11-20): House view part one on the preview; next, looking inside

## Goal and exact next step
Phase 21 step 5 (`docs/phases/21-step5-plan.md`, approved). Part one
(checkpoint 1, the house from outside) is on the preview (`69aaa4b`).
Next: part two, looking inside: Upstairs/Downstairs buttons in the House
view, roof off and the shell's near walls hidden, one floor's rooms drawn
(camera layers SEEN + HOUSE_LAYER, all built groups visible, skip
`doorwayInView`/`cullThroughDoor` in `updateRoom` ~app.js 5190), meshes
under radius .5 hidden while zoomed out (step 1 result in the plan), the
study's walls cut at y 10, inside-only pieces hidden (study window sheet,
kitchen sky sheet, sky-blocker panels, big floors → floorPatch), tap a
room → card with Call her / Go now. Ask Merlin how part one looks on his
phone first.

## Done (this session)
- `e4d45b6` living room in the picker; build 531 live (with the bathroom).
- `0368c6a` cost measured (in the plan file).
- `69aaa4b` House view part one: `dist/house-shell.js`, House button,
  `tools/qa/house-view.mjs` 10 of 10. See ARCHITECTURE row `house-shell.js`.

## Left
- Part two, its tests, reviewer pass, phone check; then mark phase 21 done
  and offer the cleanup audit (`docs/CLEANUP.md`, postponed to then).
- Merlin hasn't phone-checked build 531 (bathroom).
- `DESIGN.md` named in CLAUDE.md doesn't exist in the repo; the House
  button follows the existing `icon-btn glass` buttons.

## Decisions not yet in SPEC.md
None. (Night windows glow warm on the shell: the opaque glass would
otherwise be dark; stands in for the room lights behind it.)

## Files to look at first
`docs/phases/21-step5-plan.md`, `dist/house-shell.js`, app.js
`CAMERA_VIEWS.house`, `houseLayers`, `placeShell`, `updateRoom`.
