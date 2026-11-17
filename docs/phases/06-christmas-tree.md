# Phase 06: Christmas tree mischief

Merlin, 2026-11-16: "add a tree that looks as closely as possible as this
tree and I want the cat to interact with it" (a photo of a cat lying across
the top of a dense fir full of warm lights and vintage glass ornaments).
First built in the study by the fireplace (his pick). Then: "find a
different location for the tree. I want the tree to be huge! ... Lots of
ornaments and the cat gets very curious about it." He picked the kitchen by
the glass wall and all four kinds of play offered.

Then, the same day, his picture of the kitchen with the tree in the back
corner by the doorway, the tent in front of it, gold and champagne baubles,
burgundy velvet bows, a gold star and a cream skirt: built to match.

2026-11-17, after trying it: the tree blocked the doorway. Moved beside the
island (`TX`, `TZ` in `xmas-tree.js`; `RY` turns her side of it to face the
open floor). While it's up the tent is put away for a round bed by the right
wall, with her fountain and bowl beside it (`kitchen.setTree`, `K.xmas`);
any other look brings the tent back.

## What it does (for Lettuce, in December)
- Christmas look: a tall full fir (about 7.5 high) in the kitchen beside
  the island, clear of the doorway; her tent swapped for a round bed; about 230 baubles and 45 teardrops in gold,
  champagne, bronze, mercury silver and deep red, about 15 velvet bows, a
  gold star, about 900 lights; a cream knitted skirt with a few baubles on
  it and an open box beside it. The study is as it was.
- First look, once a visit: stares up it, creeps up crouched, sits and looks
  again, sniffs and paws a low bauble, hops back when it swings, chirps.
- Climbs in stages (low, middle, high) and lies across its front half out
  of the needles, head to the wall; sometimes on to the very top, stuck,
  mewing ("Tap her to help her down" once a visit); a touch brings her down,
  with thanks and a little joy.
- Bats the baubles under her paws; now and then knocks one off. It tumbles
  down the outside of the tree, rolls and stops in reach; she goes down and
  pats it along. A tap on it hangs it back.
- Hides under the low boughs on the tree's left, looking out, patting the
  baubles over her.
- Sits in the open box (also when you tap it).

## Not in it
Decorating the tree, presents, broken baubles, anything saved, a tree in
the study.

## As built
`dist/xmas-tree.js` (`TREE` places everything), `kitchen.js` (`setTree`:
obstacles; solids for rolling baubles), `decor.js` (built in the Christmas
look; the bow geometry), `app.js` (`withTree`, the behaviours). Test:
`tools/qa/tree.mjs`.

Not verified: a real phone (about 5000 needle cards, ~900
lights, ~45 draws).
