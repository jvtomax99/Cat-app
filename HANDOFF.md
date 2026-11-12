# Handoff: 2026-11-12, branch `claude/cat-app-opening-menu-vmvfz6`

This branch is a side line. It started from `main` at `43fdbf8`, before
the title screen, the cinematic and the long-haired Mochi reached the fork.
Nothing here is on the preview branch. Do not merge it as it is.

## What Merlin asked here
2026-11-11: "use Runway and Meshy, create a cute but exciting opening start
menu". He picked "Runway film first time only". 2026-11-12, after seeing
it: "the cat's face needs vast improvement, it doesn't look cute and it
doesn't look like a cat", then "let's continue but with the new model".
The new model is the long-haired Mochi, already the default cat on the
preview branch `claude/expressive-cat-modern-ui-65z6r5` (`d38641f`).

## The clash (waiting on Merlin)
The preview branch already has an opening screen: "Enter" gate, the
7.6 s zoomies cinematic with the real Mochi, her name, "Tap to start"
(`docs/phases/11-title-cinematic.md` there; in that session he picked the
real-cat cinematic over a generated film). This branch built a second one
with the same names (`#title`, `titleView`, `titleLife`,
`tools/qa/title.mjs`), so the two cannot both be merged. **Merlin picked
(2026-11-12): keep the cinematic, add this branch's Pocket Kitten logo and
the three toys to it. No film.** The work moves to a new chat on the
preview branch.

## Built on this branch (3 commits, `304f505`..`21b55f7`, pushed)
- `dist/title.js` and the `title*` functions in `dist/app.js`: logo and
  Play over the live room while it loads, a first-time film, a bloom into
  the game, camera glide. Checked with `tools/qa/title.mjs`: day, night,
  asleep, kitchen, wide screen, film at night all "ok". The film path on
  its own (page markup + `title.js`, no 3D): plays to the end, hands over,
  is remembered as seen, Play removes the screen.
- Assets worth keeping whichever way he picks:
  - `dist/assets/title/pocket-kitten-logo.webp` (95 KB, Runway).
  - `dist/assets/models/yarn-ball.glb`, `felt-mouse.glb`,
    `fabric-fish.glb` (Meshy; packed with meshopt, they need
    `dist/vendor/meshopt_decoder.module.js`); fuller copies in
    `models/title-toys/`.
- Out of date: `dist/assets/title/mochi-hello.mp4` shows the first Mochi.
  A film for the long-haired Mochi has to be made again from two new
  screenshots (how: `docs/ARCHITECTURE.md` here, "Opening screen";
  about 210 Runway credits a take).
- Credits used here: Runway about 255, Meshy 237. `CREDITS.md` has rows.

## Not done
- The reviewer check of this branch's code was stopped half way (usage
  limit, then the clash made it pointless until Merlin picks).
- Nothing from here is on the preview branch.

## Next step
Work on the preview branch (the fork's
CLAUDE.md there says every change goes to it). Bring files over with
`git checkout origin/claude/cat-app-opening-menu-vmvfz6 -- <path>`.
