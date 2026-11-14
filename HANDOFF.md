# Handoff: 2026-11-14, outside views and the sparrow are live (build 413)
## Outside views and the bird (live, build 413, `d71d447`, 2026-11-14)
Merlin asked for better graphics outside the windows, then for the kitchen
outside in 3D and a better bird. Live after two "Go live"s (411, 413):
- Study window: `dist/window-view.js`, a shader sheet (sky, clouds, sea,
  surf) with three painted dune pictures at different distances.
- Kitchen: `dist/terrace.js`, real 3D paving, wall, olive trees in pots and
  dunes with grass; the sheet stands far behind for sky and sea.
- Bird: `dist/bird.js`, a painted sparrow on thin cards.
Checked: `npm run check`; stills from `tools/qa/window.mjs` (also
`ROOM=kitchen`) and `tools/qa/bird.mjs`, day and night, no page errors.
Checked later the same day (live, build 416, `911f6d3`): the Christmas
kitchen looks right day and night; from the study's doorway the sky and sea
showed past the end and over the top of the kitchen's window wall, fixed by
carrying that wall on and up (`buildShell` in `dist/kitchen.js`; stills:
`tools/qa/doorway.mjs`). Seen and left alone: past the kitchen's open side
the doorway shows the plain background, which is near black at night.
Not checked: how smoothly the kitchen runs on a phone (three trees, about
760 grass tufts; thin them in `buildTerrace` if it stutters; Merlin went
live without reporting back). Dropped: the four warm lights on the terrace
wall at night (offer to put them back). Merlin's first words on research:
Meshy and Remotion were judged wrong for this (a Meshy model cannot flap;
Remotion makes video files).

## This session's branch trouble
The chat was started on `claude/ecstatic-pascal-qbivw0`, and the session
blocked commits and pushes to the preview branch until Merlin approved each
one. What worked: commit on the session branch, then
`git push origin <sha>:refs/heads/claude/expressive-cat-modern-ui-65z6r5`
after his OK. Both branches are at the same commit. Better: start the next
chat on the preview branch.

## Opening film (live, build 408)
Plays in every look and when she was put to bed. Not run since: the full
`tools/qa/title.mjs`.

## Auto-update (live, build 400; seen working on Merlin's phone, 401 to 402)
An app left open looks for a new build on coming back to the front and
every half hour, and switches on the next return, with no title (`watch`
at the foot of `dist/index.html`). Not built: the offline copy's off
switch (`"sw": false` needs a line in `tools/build-site.sh`).
## Next step
Ask Merlin. Phase 19 (privacy page and `docs/app-store.md`) is built and on
the preview. Waiting on him: a contact address for the privacy page (he
picked "a new address later"; put it in `#contact` in `dist/privacy.html`,
then it can go live), and a decision on the name: "Pocket Kitten" is taken
on the App Store (`docs/app-store.md`, part 2). Still true: phases 17, 17b,
18 and the camera fixes have not been tried on a real phone.

## Music (live, build 396, 2026-11-14; not yet tried on a real phone)
Three pieces made with ElevenLabs (Music box, Piano, Guitar), picked in the
sound panel, off unless picked; SPEC.md "Music". Checked: `npm run check`,
`tools/qa/music.mjs` 15 of 15. Not checked: a real phone (iPhone silent
switch, coming back from another app), how it sounds (nobody but Merlin
has heard it), Lettuce over a long sitting. Merlin confirmed a paid
ElevenLabs plan (CREDITS.md).

## Fun changes (phase 17b, on the preview branch, waiting for a phone try)
Phase 17b is on the preview branch, waiting for Merlin and Lettuce to try
it on a phone: brief `docs/phases/17b-fun-over-days.md` ("As built" and
"Left for Merlin and Lettuce"). Merlin approved the plan on 2026-11-13 and
picked needs "a bit faster" and "wish now, collection later". To see it
without waiting days: `node tools/qa/gifts.mjs` (stills of every gift).
Not looked at: the collar on the first Mochi (`?mochi=first`); a real
phone. Next for the fun side, when Merlin asks: things she finds and a
collection (SPEC.md "Later").

## Camera fixes (on the preview, build 384, waiting for a phone try)
Merlin picked the three camera fixes from the review (page:
https://claude.ai/artifact/YRrnVJZKRBrARzXUnccHH7). Done and pushed
(`496b210`, test tools `fdcf723`); waiting for him to try them on a phone:
- With no mode picked yet the app opens in Mochi mode (after the first
  steps for a new player). A player who pressed Explore keeps Explore.
- In Mochi mode the picture slides up by half of what the care buttons
  cover (the camera does not move); pinched close, her face is centred.
- Brush, Cuddle or Play pressed in Explore while she is out of the picture
  turns the view to her.
Checked: `npm run check`, `camera.mjs` 25 of 25, `sheet.mjs` 14, `return.mjs` 24.
Not checked: a real phone; the kitchen in Mochi mode at closest zoom.

Still open from the review, most important first: (1) fun: all gifts in
about two minutes of Brush, nothing after level 4, needs a plan and
Lettuce; (5) film on every launch; (6) washed-out day; (7) kitchen room
view, Bed view and turned study view framing; (8) buttons under 44 points,
labels 10 points; (9) the first hint covers the sound panel. App Store:
guideline 4.2, privacy policy, offline inside a wrapper not confirmed.

## Also waiting
Phases 17 and 18 are both on the preview (build 374, `281e611`), waiting
for Merlin and Lettuce to try them on a real phone:
https://jvtomax99.github.io/Cat-app/preview/ . Then notes or "Go live".

Phase 18 (phone speed and an offline copy), brief:
`docs/phases/18-phone-speed-offline.md`. To check on a phone:
- Add `?fps` to the address: the top-left box shows frames a second and
  the quality level. Wanted: Merlin's and Lettuce's numbers and phone models.
- Open once with signal, wait a minute, turn on airplane mode, open again
  (browser, and the home-screen icon). Does the opening film play offline
  on an iPhone?
Going live puts a service worker on the live site for the first time: keep
it on the preview a few days first. Off switch if it misbehaves: publish a
`version.json` with `"sw": false` (needs a line in `tools/build-site.sh`).

Phase 17, brief: `docs/phases/17-reasons-to-return.md`. To see the cards
without waiting: play until friendship level 2 (15 care), or leave the app
closed for 30 minutes.

A fresh cloud session can start with the local branch label on an old
commit: check `git log -1` matches the remote tip before committing.

## Done (preview branch)
- "While you were away" card, gifts at friendship levels 2 to 4 (felt
  mouse, fabric fish, her name on her bowl), toy basket on Play, photo
  button, Moments keeps 40.
- Fixed a live bug: the friendship card squeezed to a strip on phones.
- `npm run check`, `tools/qa/return.mjs` (23 of 23), `sheet.mjs`,
  `panel.mjs`.

## Not verified
- Share and Save of a photo on a real iPhone and Android phone (the test
  browser cannot press a real share sheet).
- Phase 18: frame rate on a real phone (`?fps`), offline from an iPhone
  home-screen icon, the film offline in Safari.

## Waiting on Merlin
- Gifts for levels 5 to 9 (phase 17b; proposals in SPEC.md "Later").
- Should needs drop faster while away? Today a week away reads "All good".
- From the review, not started: a feedback
  button before the test group (phase 09); Mochi is small in the room view,
  labels are 10.5 px; the opening now plays on every launch (three taps to
  reach her).
- SPEC.md open questions: free or paid, what counts as v1.
- Still owed from before: Lettuce's reaction to the opening film and first
  steps; then phase 14b (long-haired Mochi's movement). `DESIGN.md` does
  not exist yet (docs/design-rules.md says how to make it).

## Files to look at first
`docs/phases/17-reasons-to-return.md`, `dist/away.js`, `dist/rewards.js`,
"Reasons to come back" in `docs/ARCHITECTURE.md`.

## Paste into a new chat
> Read CLAUDE.md and HANDOFF.md, then ask me what is next.
