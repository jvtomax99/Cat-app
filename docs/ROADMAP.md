# Roadmap

Status: `todo` · `doing` · `preview` (pushed, awaiting review) · `live` · `blocked`.
One phase per session (see `WORKFLOW.md`). Briefs are in `docs/phases/`.

| # | Phase | Status | Notes |
|---|---|---|---|
| 01 | [Leg drag](phases/01-leg-drag.md) | preview | Three causes fixed (stuck step when setting off, bed step-up, gallop reach). Left: a short front-leg stretch sitting down on perches, one high-shelf turn. |
| 02 | [Vacuum "Vision"](phases/02-vacuum-vision.md) | preview | Measured: the vacuum itself never went through anything; she did (tail off the vacuum into the counter, stools, dock; head and hips into the stool legs; body in the counter at two spots). Her tail now keeps out of the kitchen furniture (`clearTail`), the keep-out and the vacuum's lanes are sized for her body. Overlaps 2005 to 74 and 1625 to 199 per 600 s; the vacuum never touches anything; left: head turned while walking along a thing (to 15 cm), fur-deep tail brushes. Preview `f027528`, awaiting Merlin. |
| 03 | [Tail through furniture](phases/03-tail-collision.md) | doing | The kitchen is done in phase 02 (`clearTail` with the kitchen's solids). Left: the study's furniture list (`tailSolids` in `studyLayout`), `tools/qa/tail.mjs` for both rooms. |
| 04 | Miso, the second cat | blocked | Waiting for Merlin's Meshy .glb (blue British Shorthair kitten). Then: the cats play together; later, adopt more cats by levelling up. |
| 05 | Dog visit at the French doors | blocked | Code ready behind `?dog`; needs a proper (Meshy) dog model. |
| 06 | Christmas tree mischief | todo (December) | Mochi climbs and bats at the tree. |
| 07 | [Walk like a cat again](phases/07-walk-grace.md) | live (build 171) | Walk set to measured cat numbers, stutter-step fixed, a trot for every run, gallop only flat out. Merlin: "much much better". |
| 10 | Seasonal looks stored away | live (build 174) | Halloween hidden from the picker out of October (`?decor=halloween` shows it); a room left in it wakes up as Thanksgiving. Christmas: waiting on Orion's image. |
| 08 | Friendly app screens | todo | Merlin wants it "real app ready": an easy, clear interface. Needs a brief with Merlin/Orion first. One piece is built ahead of the rest: the opening screen (logo, Play, first-time film), on branch `claude/cat-app-opening-menu-vmvfz6` in `jvtomax99/Cat-app`, not on the preview branch yet, awaiting Merlin. |
| 09 | Small test group | todo | Share with 10-20 people (different phones) with a way to send feedback, before the 1000-member group. |

## Done (live build 174, `97f11c8`)
Mouth reaches food and water; monarch butterflies; vacuum routing round the
island; per-leg reach and turn caps (leg drag reduced); tent flaps; night
mode and night-owl activities; kitchen seasonal decor. History:
`MILESTONES.md` and `git log`.
