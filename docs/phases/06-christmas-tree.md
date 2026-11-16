# Phase 06: Christmas tree mischief

Merlin, 2026-11-16: "add a tree that looks as closely as possible as this
tree and I want the cat to interact with it" (a photo of a black-and-white
cat lying across the top of a dense fir full of warm lights and vintage
glass ornaments). He picked the study, by the fireplace, over the kitchen.

## What it does (for Lettuce, in December)
- Christmas look: the olive tree by the armchair is put away and a full fir
  stands in the corner by the fireplace, lights along the top of the walls.
- She climbs it on her own (a leap into the low branches on the fireplace
  side, a scramble to the top half) and lies across it with her front half
  out, as in the photo. A tap on the tree invites her up.
- Up there: she bats the baubles under her paws (they swing, the tree
  trembles); now and then the third pat sends one down. It tumbles out of
  the boughs, bounces, rolls and stops. She looks at it, at you, then goes
  down and pats it along the floor.
- A tap on a fallen bauble hangs it back up.

## Not in it
Decorating the tree, presents, baubles breaking, fallen baubles kept in the
save, a tree in the kitchen, sounds beyond the existing soft clink.

## As built
`dist/xmas-tree.js` (the tree, `TREE` places it and her two perches),
`decor.js` (shows it in the Christmas look, hides the olive tree), `app.js`
(`treeLow`/`treeHigh` perches, `climbTree`, `batBauble`, `knockBauble`,
`chaseBauble`, `rehangBauble`, tap targets). Test: `tools/qa/tree.mjs`.

Similar apps (from memory, not checked): Talking Tom-style apps play a
canned animation when a decoration is tapped; Neko Atsume cats use items on
their own while you watch. Here the tree reacts to her (sway, swinging
baubles, one that falls and rolls) and she to it.
