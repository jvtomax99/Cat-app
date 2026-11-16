# Phase 06: Christmas tree mischief

Merlin, 2026-11-16: "add a tree that looks as closely as possible as this
tree and I want the cat to interact with it" (a photo of a cat lying across
the top of a dense fir full of warm lights and vintage glass ornaments).
First built in the study by the fireplace (his pick). Then: "find a
different location for the tree. I want the tree to be huge! ... Lots of
ornaments and the cat gets very curious about it." He picked the kitchen by
the glass wall and all four kinds of play offered.

## What it does (for Lettuce, in December)
- Christmas look: a fir about 8.7 high (the study one was 5.5) at the front
  of the kitchen where the glass wall ends; about 330 baubles, 70 drops, 50
  twists, 80 icicles, 50 little figures, 1000 lights; presents and an open
  box under it. The study is as it was (olive tree, armchair in place).
- First look, once a visit: stares up it, creeps up crouched, sits and looks
  again, sniffs and paws a low bauble, hops back when it swings, chirps.
- Climbs in stages (low, middle, high) and lies across it half out of the
  needles; sometimes on to the very top, stuck, mewing ("Tap her to help her
  down" once a visit); a touch brings her down, with thanks and a little joy.
- Bats the baubles under her paws; now and then knocks one off. It tumbles
  down the outside of the tree, rolls and stops in reach; she goes down and
  pats it along. A tap on it hangs it back.
- Hides under the low boughs looking out, patting the baubles over her.
- Sits in the open box (also when you tap it).

## Not in it
Decorating the tree, opening presents, broken baubles, anything saved, a
tree in the study.

## As built
`dist/xmas-tree.js` (`TREE` places everything), `kitchen.js` (`setTree`:
obstacles and her floor), `decor.js` (built in the Christmas look),
`app.js` (`withTree`, the behaviours). Test: `tools/qa/tree.mjs`.

Seen and left: the tree stands where the glass wall ends, so the glass is
behind and beside it, not straight behind (further back it would stand in
the island). Not verified: a real phone (about 6000 needle cards, ~1000
lights, ~40 draws).
