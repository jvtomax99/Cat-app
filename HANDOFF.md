# Handoff (2026-11-23): next, phase 09, the small test group

## Goal and exact next step
Phase 21 (the house) is done and live (build 543, `e180b68`). Merlin picked
the next phase: **09, the small test group**: share Mochi with 10 to 20
people on different phones, with a way to send feedback, before the
1000-member group (`docs/ROADMAP.md` row 09, `SPEC.md` line ~15).

It's a big feature (likely an outside service for feedback), so per
CLAUDE.md: first look at 2 or 3 similar apps/tools for collecting tester
feedback and tell Merlin in a few lines how they do it and where Mochi can
be better; then plan mode, plain words, assumptions listed apart; wait for
his OK. Write the brief to `docs/phases/09-test-group.md`.

Open question already in SPEC.md (line ~258): what counts as v1, i.e. what
the test group gets. Ask that one first.

## Done (previous session)
- `d818610` House view part two; `e180b68` cleanup audit's five items;
  `1908f90` MILESTONES row for live build 543, phase 21 marked live.

## Left
- Merlin hasn't phone-checked live 543 after the cleanup (should look the
  same; the cleanup removed only unused files and code).
- `DESIGN.md` named in CLAUDE.md doesn't exist in the repo.
- Deploys: a push to `main` doesn't start "Deploy site" here; run it by hand.
  GitHub sometimes fails the publish step ("No artifacts named github-pages");
  a fresh run fixes it.

## Decisions not yet in SPEC.md
None.

## Files to look at first
`SPEC.md`, `docs/ROADMAP.md`, `dist/privacy.html` (what the app keeps and
sends: feedback must fit it), `docs/app-store.md`.
