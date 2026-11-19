# Mochi: spec

Drafted 2026-11-11 from the current app and docs. Merlin: fill the gaps
marked **(Merlin?)** and check "Not in v1".

## What it is
A virtual-pet web app. Mochi, a realistic seal-point ragdoll kitten, lives
in a cosy study and a kitchen that you watch and care for. She lives her own
life (roams, climbs, naps, rides the robot vacuum, eats, plays at night);
you feed, pet, brush and play with her, and your friendship grows. Runs in
the phone's browser and can be added to the home screen.

## Who it's for
- **Lettuce** plays with the live app. Whatever is live is what Lettuce sees.
- **Next: a test group** of 10 to 20 people on different phones (phase 09),
  then a group of about 1000. They need it easy and clear without anyone
  explaining it, working on their phone, and their cat kept safe.
- **Merlin** owns it and reviews every change on the preview.
- Goal (Merlin): a commercial-quality app.
- **(Merlin?)** Free, paid, or not decided yet?

## Features (live) and Done when
- **Mochi looks like herself.** Done when: she's recognisably the same
  peculiar, endearing kitten (her Meshy model, fur, real eyes), checked in
  close-ups in the review pack.
- **She moves like a cat.** Done when: the walk matches measured cat numbers
  with no stutter-step, she trots for every run and gallops only flat out,
  no leg stretched more than ~4 cm (`tools/qa/legs.mjs`).
- **Two rooms.** Done when: she walks between the study and the kitchen
  through the doorway, and the player can switch rooms and views.
  (Today switching rooms moves her instantly. Phase 20, approved
  2026-11-18: she really walks through, the camera follows, the room
  picker calls her, food and water live in the kitchen.)
- **Looking around: two camera modes** (live, phase 16; Merlin
  2026-11-13, after "still really bad": replaces the one-finger map drag
  and the automatic view changes of phase 14). Done when: the Explore and
  Mochi buttons pick the mode and it is remembered; a pinch, drag or tap
  never changes it. Mochi: the camera stays on her, one finger circles her,
  a pinch zooms on her. Explore: one finger turns the view all the way
  round (Merlin 2026-11-18: each room got a front wall, and any wall the
  camera is behind hides; turned to a wall with little room behind, the
  camera rises and looks down rather than squeezing in close), a pinch zooms
  to the thing under the fingers (on the fireplace: to the fireplace), two
  fingers sliding move the view and twisting turns it, a double tap on a
  thing goes close to it (again on it: the whole room), pinching far out
  gives the whole room; closer in, the view tilts down, further out it
  looks down over the room; a flick glides on; one tap on Mochi brings her
  back from any view; Watch shows the whole room (`tools/qa/camera.mjs`,
  every line `PASS`).
  After the review of 2026-11-13 (preview): with no mode picked yet the
  app opens in Mochi mode once the first steps are done (in the room view
  she was 7% of a phone screen); in Mochi mode she sits in the middle of
  the part of the screen above the care buttons, and pinched close it is
  her face that is centred; Brush, Cuddle or Play pressed in Explore while
  she is out of the picture turns the view to her (still Explore).
- **Touching her** (preview, phase 14). Done when: she takes a touch by
  where it lands: head and back welcome, chin the favourite, tail and paws
  not for touching (ears flick, a look, a word, no friendship; kept up, she
  moves away), belly only as a good friend (otherwise a playful trap);
  stroking is felt all along the stroke; rolling over is hers to decide, not
  every third pat; a single tap on the floor calls her there unless she is
  busy or asleep (in Mochi mode; in Explore the floor is for looking) (`tools/qa/camera.mjs`).
- **Opening film** (live, phase 15). Done when: on every launch (Merlin,
  2026-11-13; before: only the first of the day), by day or night, in every look (Merlin 2026-11-14, live build 408; before: the
  plain study only), with the long-haired Mochi and an
  upright screen, Enter plays the film "Mochi and the yarn ball" (20 s,
  its music only with "Enter with sound"); a tap skips it; it fades into
  the living title (by day with no visible jump in the room; at night the
  sunny film fades into the night room, Merlin's choice 2026-11-13 so
  evening players see it; in a seasonal look it fades into the decorated
  room); if she was put to bed, opening the app
  wakes her and the film plays (Merlin, 2026-11-14: put to bed every
  night, she was asleep at every open and the film was never seen;
  live build 408); with the first Mochi or on a wide screen the zoomies
  sequence plays instead, and a sleeping Mochi sleeps on behind the short
  title; a film that cannot load never leaves a black or
  stuck screen (`tools/qa/title.mjs`).
- **First steps** (live, phase 15). Done when: a new player sees "Tap the
  pink ball" once, a tap on the ball starts play at once, then one "give her
  a stroke" hint, and neither shows again, also after a reload; a save from
  before never sees them; the ball stays tappable for good.
- **Opening screen.** Done when: every launch plays the
  zoomies sequence with the real Mochi and ends on the Pocket Kitten logo
  with her name under it (the name can be changed, the logo cannot), her
  toys on the rug beside her and "Play with <name>"; a tap skips at any
  moment; the short title (she sleeps, "Tap to wake her") shows only with
  reduced motion or when she was put to bed (`tools/qa/title.mjs`).
  Merlin changed his mind on a generated film (2026-11-12, evening): a
  13 s Runway film, "Mochi and the yarn ball", is cut and waiting for his
  pick of music; it is NOT in the app yet (`HANDOFF.md`).
- **The screen on a phone** (live, build 323, phase 08; Merlin 2026-11-12 picked
  the pull-up sheet over swipe cards and needs-on-the-room). Done when: on
  a phone the room fills the screen and never scrolls; a sheet at the bottom
  shows what she needs most with its button and the other four needs; a
  swipe up (or a tap) opens it to friendship, moments and the care guide; a
  swipe down or a tap on the room closes it. Tablets and computers keep the
  side panel. Brief: docs/phases/08-app-sheet.md.
- **Care panel look** (live, builds 284 and 294). The need that wants her
  most is a big coloured card with its button; the rest fill like glasses;
  glossy icons on the needs, dock, moments and guide (made with Meshy, then
  Runway).
- **Reasons to come back** (live, build 392, phase 17; Merlin 2026-11-13, after a
  review found nothing changes from one day to the next). Done when: away
  30 minutes or more, a card tells 2 or 3 things she did, fitting the time
  away; one tap closes it; it is in Moments; under 30 minutes there is no
  card; the same absence always tells the same story. Reaching levels 2, 3
  and 4 gives a felt mouse, a fabric fish and her name on her bowl; the
  friendship card names the next gift; a save already past a level gets its
  gifts at the first launch; nothing a player has is ever locked. Play
  opens a toy basket once she has more than the ball. The photo button
  gives a picture without buttons that can be shared or saved on iPhone and
  Android; a phone that cannot share still saves. Moments keeps 40 entries
  (`return-checks.mjs`, `tools/qa/return.mjs`). Brief:
  docs/phases/17-reasons-to-return.md.
- **Fun that lasts** (live, build 392, phase 17b; Merlin 2026-11-13, after the
  store review found a keen player had seen everything in one sitting; he
  picked needs "a bit faster" and "wish now, collection later"). Done when:
  each kind of care counts in full a few times a day (stroke 10, brush 2,
  feed 3, water 3, play 3), then a tenth, and the tenths stop at 5 more a
  day; the day turns at 4 in the morning; she reacts to every touch as
  before; her drinking by herself gives no friendship; friendship never
  drops; the level numbers are unchanged; once the day's care has counted
  the friendship card says "A lovely day together. More tomorrow." Each day
  she has one wish (about 14, only things this player has, never the same
  two days running, the same all day): it is under her name, a tap and she
  says it, granting it is thanked, written in Moments and worth 5. Levels 5
  to 9 give a ball of yarn, fairy lights along the study mantel (lit in the
  evening), a ribbon bow at her throat (six colours, in the name card; Merlin
  2026-11-14: a bow, because a plain collar was hidden by her fur), a
  picture frame over the fire for one of your photos, and a gold tag under
  the bow;
  a save already past a level gets these one a day. Left overnight she is a
  little hungry and thirsty, left a day she is missing you too; never under
  30 (`fun-checks.mjs`, `tools/qa/gifts.mjs`). Brief:
  docs/phases/17b-fun-over-days.md.
- **Care.** Done when: a player can feed, pet, brush, play with and put her
  to sleep, and the meters (food, water, happiness, energy, cleanliness)
  respond.
- **Friendship.** Done when: care raises the bond, the level bar fills, and
  the journal records moments.
- **Saves.** Done when: closing and reopening keeps her name, meters and
  journal, time away counts, an update never loses a save, and the player
  can copy a backup code and restore from it.
- **Install line (2026-11-15, the fork's owner).** In the name sheet, on an iPhone in
  Safari when the app is not on the Home Screen: "On iPhone: tap Share, then Add to Home
  Screen so she stays safe." Done when: it shows there and nowhere else (not on
  Android, a computer, or the installed app).
- **Her own life.** Done when: left alone she roams, climbs shelves and the
  bed, eats and drinks with her mouth at the bowl, fountain, salmon or
  faucet, rides the vacuum, and never goes through furniture
  (`tools/qa/vacuum.mjs`).
- **Night.** Done when: the sun/moon button switches lighting and she does
  night-owl things.
- **Outside the windows** (live, build 413; Merlin, 2026-11-14). Done
  when: the study window and the kitchen's glazing show a sky with drifting
  clouds, a sea with surf and dunes with grass that shift as the camera
  moves (the kitchen's outside is built in 3D), by day and by night, and
  the bird at the window is a recognisable sparrow that flies and perches
  (`tools/qa/window.mjs`, `tools/qa/bird.mjs`).
- **Seasonal decor.** Done when: decor shows in its season only (Halloween
  in October, Thanksgiving, Christmas in December), stays put day and
  night, and her routes stay open.
- **Christmas kitchen** (preview, from Orion's day and night pictures).
  Done when: in December the look picker offers "Christmas at the Beach
  House"; the kitchen then has the pine garland with fairy lights on the
  top shelf, velvet bows, the wreath on the glazing, pine in a jug, the
  runner with clementines and walnuts, the lantern with baubles, and in
  the evening the lights and the glow under the shelves come up; she naps
  on the top shelf by the garland; her routes stay open
  (`tools/qa/vacuum.mjs`). The study keeps its classic look, with pine
  and a brass lantern on the mantel and a plaid cushion on the armchair
  (seen through the doorway).
- **Christmas tree** (preview, phase 06; Merlin 2026-11-16, from a photo of a
  cat lying in a decorated tree, then a picture of the kitchen with the tree
  in it). Done when: in the Christmas look a tall full fir (about 7.5 high)
  stands where the kitchen and the living room meet, on the sea side, clear
  of the walkway between the two rooms (Merlin 2026-11-19; before that in
  the kitchen's back right corner, which is why the kitchen is 10 wide);
  while it's up her tent is put away and she has a round bed right beside
  the tree, by the window wall; her fountain stays in the living room and
  her bowl in the kitchen, as in every other look (the tent is back in
  every other look); with warm white lights all through it, baubles in gold, champagne,
  bronze, mercury silver and deep red, big burgundy velvet bows, a gold star
  on top, a cream knitted skirt with a few baubles on it, and an open box beside
  it; the first time she sees it in a visit she stares up it, creeps
  up crouched, sits, then sniffs and paws a low bauble and hops back; on her
  own (often) and when the tree is tapped she climbs it in stages and lies
  across its front half out of the needles; up there she bats baubles and
  sometimes knocks one off, which tumbles down the outside, rolls and stops
  in reach, and she goes down and pats it along; a tap on it hangs it back;
  sometimes she climbs to the very top, is stuck, mews, and a tap on her
  helps her down; she hides under the low boughs looking out and pats the
  baubles over her; she sits in the open box (also when it's tapped); out
  of the Christmas look none of it is there (`tools/qa/tree.mjs`). Not in
  it: decorating the tree yourself, presents, broken baubles, anything kept
  in the save.
- **Quick on a phone, and there without signal** (phase 18, live, build 392).
  Done when: the first open on a phone downloads under 6 MB before she is
  on screen; after one open with signal the app opens and plays with no
  signal, from the browser and from the home screen, save intact; a new
  build shows after at most one reopen, never a mix of old and new; an app
  left open (a home-screen app that is woken, not started) looks for a new
  build each time it comes back to the front and every half hour, fetches
  it behind the app, and switches the next time the player comes back to
  it, in one load without the title, never while they play (Merlin
  2026-11-14, live, build 400); a phone
  that cannot hold 25 frames a second gets an easier picture by itself;
  on a computer she looks as before (`tools/qa/load.mjs`,
  `tools/qa/quality.mjs`). Not in it: notifications, an "update ready"
  banner, a lighter cat shape.
- **Privacy page** (preview, phase 19; Merlin 2026-11-14, first step
  towards the App Store). Done when: `privacy.html` says in plain words
  what the app keeps on the phone and what leaves it, matches the code (no
  request to anyone but its own site, nothing sent unless the player
  presses Share), opens from the footer and the name card, also with no
  signal, and "Back to your kitten" returns to the app. Open: a contact
  address (Merlin: a new one, later); the page stays on the preview until
  then. Anything new that leaves the phone changes this page first.
- **Sound.** Done when: sound is off until the player turns it on, only
  short occasional sounds play (meows, purr, soft clinks), with separate
  volume for her and the music.
- **Music** (preview; Merlin, 2026-11-14, who liked all three takes and
  wanted the player to choose). Done when: the sound panel offers Off,
  Music box, Piano, Guitar and Mix with a volume of its own; a new player has
  Off; a picked piece plays only with sound on, after the opening and
  while the app is in front, plays through, pauses 12 seconds and comes
  round again; the choice is kept (`tools/qa/music.mjs`). "Mix" (Merlin,
  2026-11-16) plays the three in turn, the same 12-second pause between
  them, and starts over. Still to hear from Lettuce: does it tire over a
  long sitting.

## Phases
Build order and status: `docs/ROADMAP.md` (a brief per phase in
`docs/phases/`). Next up: phase 03 (tail in the study), then Christmas
decor, Miso, phase 08 (app screens), phase 09 (test group).

## Planned: the house (phase 21, Merlin 2026-11-18)
(2026-11-19: the living room is built and joined to the kitchen as one open space, on the preview. Merlin: its rosewood table and mohair chair stay as built in code, no bought models. Her tent and fountain stand there, her bowl stays in the kitchen. What she does there (Merlin 2026-11-19, all four at once): naps on the sofa, kneads the throw over its arm, lies by the fire, sits at the glazing watching the sea; a tap on the sofa or the throw invites her up. Done when: each of the four happens by itself within a few minutes of watching, and she walks there from the kitchen without crossing furniture.)
(2026-11-19: the hall is built, on the preview: a third room off the kitchen, with the front door, a console and mirror, a bench and the stairs. Merlin: the hall first, with the stairs standing there to look at; climbing them and the landing come next. She walks there through a new doorway in the kitchen's wall (from the study: by way of the kitchen), looks up the stairs and sits by the front door; for a nap or a meal she goes back to the kitchen. The room picker lists it. Done when: called from the picker she walks from the kitchen to the hall without a jump, keeps to its floor, and a reload finds her there.)
After phase 20 (One home). A living room the kitchen opens into (first;
reference picture `docs/house/reference-living-room.jpg`), a hall with stairs, an upstairs landing, a
bedroom and a bathroom, a roof, and a House view of the whole house (tap a
room). She walks everywhere herself. Blueprint (approved 2026-11-18):
`docs/house/blueprint.png`; brief and build order: `docs/phases/21-house.md`.
Done when: she walks by herself from her bed in the study to the bath mat
upstairs and back; every room is reachable from the picker and the House
view; each new room has at least two things she does there; a phone runs
as smoothly as in the kitchen today; old saves load. Not in it: decorating,
a garden to walk in, seasonal looks for the new rooms, new care needs,
bought models.

## Not in v1 (draft, Merlin to confirm)
- Picking her up or carrying her, dragging food or the brush to her (plan
  B of phase 14; "Later" unless Merlin approves).
- **(Merlin?)** What counts as v1: what the test group (phase 09) gets?
- Accounts, logins, or saves that move between devices (saves stay on the
  phone; backup codes cover moving).
- Ambient sound (room tone, the fountain, the vacuum's sound). Music is
  the player's choice since 2026-11-14 (see Music above).
- Spotify (on hold).
- The dog visit, until there's a proper model (code waits behind `?dog`).
- **(Merlin?)** Miso: v1 or later?
- **(Merlin?)** Payments, ads, notifications?
- From phase 17: a photo gallery inside the app, things she finds and a
  collection screen, coins or a shop, finding her where the away story
  ended.

## Later
- An App Store release (Merlin, 2026-11-13: "in the future"; today it runs
  in the phone's browser). Needs a wrapper app, an Apple developer account
  ($99 a year) and a look at Apple's rules for apps that are a website.
  The list: `docs/app-store.md`. The name "Pocket Kitten" is already taken
  on the store (checked 2026-11-14).
- From phase 16: an arrow pointing to Mochi when she is
  off screen, walking through the room at eye level. (The photo button
  came in phase 17.)
- First steps for food, water, brushing and sleep (ChatGPT's review of the
  opening film, 2026-11-12; v1 teaches only the ball and a stroke).
- A "watch the film again" button; a film for night and for Christmas.
- Things she finds and a collection screen (Merlin 2026-11-13: after the
  daily wish; the stronger reason to come back in month two).
- Something after level 9; notifications ("she misses you") with the
  store wrapper.
- Miso, the second cat (blue British Shorthair), and the cats playing together.
- Adopting more cats by levelling up.
- The dog visit at the French doors.
- Friendly app screens (phase 08): "real app ready".
- Sharing with the 1000-member group after the test group.
- More rooms on the house plan (Merlin 2026-11-18): a living room in the
  kitchen's open front, then others, one per phase; stairs; a house map.

## Decisions
- Nothing goes live without Merlin's "Go live"; one preview branch,
  published at /preview/ (no per-feature branches, no Vercel). 2026-11-11.
- Asset and design budget: $50 total. 2026-11-11.
- Preserve her identity, not her imperfections; paid Meshy only for new
  characters. (TEAM-INSTRUCTIONS.md)
