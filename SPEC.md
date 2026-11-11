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
- **Opening screen** (not live yet: on branch `claude/cat-app-opening-menu-vmvfz6`).
  Done when: opening the app shows the Pocket Kitten logo over the real
  Mochi in her room while it loads, one tap on Play goes to the game, the
  very first open plays a short film that ends on the real Mochi with no
  visible cut, it never plays sound by itself, and a save or a sleeping
  Mochi is untouched (`tools/qa/title.mjs`).
- **Mochi looks like herself.** Done when: she's recognisably the same
  peculiar, endearing kitten (her Meshy model, fur, real eyes), checked in
  close-ups in the review pack.
- **She moves like a cat.** Done when: the walk matches measured cat numbers
  with no stutter-step, she trots for every run and gallops only flat out,
  no leg stretched more than ~4 cm (`tools/qa/legs.mjs`).
- **Two rooms.** Done when: she walks between the study and the kitchen
  through the doorway, and the player can switch rooms and views.
- **Care.** Done when: a player can feed, pet, brush, play with and put her
  to sleep, and the meters (food, water, happiness, energy, cleanliness)
  respond.
- **Friendship.** Done when: care raises the bond, the level bar fills, and
  the journal records moments.
- **Saves.** Done when: closing and reopening keeps her name, meters and
  journal, time away counts, an update never loses a save, and the player
  can copy a backup code and restore from it.
- **Her own life.** Done when: left alone she roams, climbs shelves and the
  bed, eats and drinks with her mouth at the bowl, fountain, salmon or
  faucet, rides the vacuum, and never goes through furniture
  (`tools/qa/vacuum.mjs`).
- **Night.** Done when: the sun/moon button switches lighting and she does
  night-owl things.
- **Seasonal decor.** Done when: decor shows in its season only (Halloween
  in October, Thanksgiving), stays put day and night, and her routes stay
  open.
- **Sound.** Done when: sound is off until the player turns it on, only
  short occasional sounds play (meows, purr, soft clinks), with separate
  volume for her and the room.

## Phases
Build order and status: `docs/ROADMAP.md` (a brief per phase in
`docs/phases/`). Next up: phase 03 (tail in the study), then Christmas
decor, Miso, phase 08 (app screens), phase 09 (test group).

## Not in v1 (draft, Merlin to confirm)
- **(Merlin?)** What counts as v1: what the test group (phase 09) gets?
- Accounts, logins, or saves that move between devices (saves stay on the
  phone; backup codes cover moving).
- Continuous or ambient sound, including the vacuum's sound.
- Spotify (on hold).
- The dog visit, until there's a proper model (code waits behind `?dog`).
- **(Merlin?)** Miso: v1 or later?
- **(Merlin?)** Payments, ads, notifications?

## Later
- Miso, the second cat (blue British Shorthair), and the cats playing together.
- Adopting more cats by levelling up.
- Christmas: decor and tree mischief (phase 06, December).
- The dog visit at the French doors.
- Friendly app screens (phase 08): "real app ready".
- Sharing with the 1000-member group after the test group.

## Decisions
- Opening screen: one tap every open, and it doubles as the loading screen
  so it costs no waiting. The film plays once per device (not in the backup
  code), is skippable, and is skipped for people who ask for less motion or
  are saving data. No menu items, no music. Merlin picked "Runway film first
  time only". 2026-11-11.
- Merlin OK'd spending the Runway and Meshy credits already in the accounts
  on the opening screen (film, logo, three toys). Mochi herself stays on her
  own model. 2026-11-11.
- Nothing goes live without Merlin's "Go live"; one preview branch,
  published at /preview/ (no per-feature branches, no Vercel). 2026-11-11.
- Asset and design budget: $50 total. 2026-11-11.
- Preserve her identity, not her imperfections; paid Meshy only for new
  characters. (TEAM-INSTRUCTIONS.md)
