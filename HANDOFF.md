# Handoff (2026-11-24): next, a "going through furniture" check for every room

## Goal and exact next step
Merlin said phases 01 (legs), 02 (vacuum) and 11 (title screen) look wrong:
"Opening screen, Her walking, Going through things". For going through
things he named: riding the vacuum, walking into furniture, her tail.
Riding the vacuum is fixed (below). He picked: **build a check for all
rooms** that finds every moment her body or tail goes into furniture
(study, kitchen/living, hall, landing, bedroom, bathroom), then fix the
real cases.

Start from `tools/qa/vacuum.mjs`: it reads the real meshes of the kitchen
floor's solids and measures every bone and the tail along its length
against them (pass: body > 0 everywhere, tail >= about -.03). Make a general
version, e.g. `tools/qa/clipping.mjs`, `ROOM=` each room, letting her roam
(as `legs.mjs` does), and add it to `docs/QA.md`. Small change, no plan
mode needed.

## Done this session
- Phase 09 (test group) built, then undone and parked by Merlin: he's the
  only tester for now. Plan kept in `docs/phases/09-test-group.md`.
- Phases 06 and 13 (Christmas) checked by Merlin, marked live.
- `a5549b7` (on the preview branch, preview publish queued, check
  `/preview/version.json` shows it):
  - Vacuum: she only hops on where there's room (`kitchen.vacRideRoom`),
    and riding it keeps further from the window wall and counter
    (`VAC_FLOOR_RIDE`). vacuum.mjs: riding now touches nothing (was face
    8cm into the wall, tail 4cm into the counter).
  - Legs: after a teleport (room change) her pace is reset too
    (`motion-cat.js`); the stretch left is only the cut frame itself.
  - Title: "is fast asleep" bigger with a shadow, darker top, name a bit
    smaller on wide screens. title.mjs 15/17 PASS; 2 not finished (machine
    too slow / time limit), not failures.
- Tried moving the kitchen step stool's floor spot: every spot was worse
  (ear in wall or chin in the counter). Left as it was; a 2cm ear brush on
  the window wall while walking into that gap remains.

## Left
- Merlin hasn't seen a5549b7 on his phone yet; nothing new to go live
  until he says "Go live" (main equals the preview before a5549b7).
- ROADMAP rows 01, 02, 11 stay "preview" until he's happy.
- Committing: the auto-mode check sometimes blocks `git commit`; after
  Merlin said retry it went through. Stage, commit and push as separate
  commands.
- QA runs are slow here (vacuum ~15 min, title ~30 min); run them in the
  background, one or two at a time, and start `node server.mjs` in the
  same command as title.mjs.
- Deploy: GitHub sometimes fails the publish step ("No artifacts named
  github-pages"); re-run it.

## Decisions not yet in SPEC.md
None (phase 09 on hold is in SPEC.md).

## Files to look at first
`tools/qa/vacuum.mjs`, `tools/qa/legs.mjs`, `tools/qa/lib.mjs`,
`docs/QA.md`, `docs/ARCHITECTURE.md` (rooms and their floors).
