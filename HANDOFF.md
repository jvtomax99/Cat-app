# Handoff: 2026-11-14, opening film fixed on the preview, waiting for Go live
## Opening film fixed (preview, build 407, Merlin: "It works", 2026-11-14)
On his iPhone the Runway film never showed: Mochi was asleep (put to bed)
or the room was in a seasonal look, and both skipped the film by design.
Now (Merlin's picks): opening the app wakes a sleeping Mochi where the
film plays, and the film plays in every look. Also: the film loads behind
the Enter screen and gets 8 s, not 3, to start. On the preview the footer
says "film: played" or why not (`noteFilm` in `dist/app.js`). Waiting on
his "Go live". Not run since: the full `tools/qa/title.mjs` (only the film
cases); run it before going live if time allows.

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
