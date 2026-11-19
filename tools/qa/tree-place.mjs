// The Christmas tree at the join of kitchen and living room: where it and
// her things stand, that she walks round it to her round bed, and what the
// Room view shows from each half (phone and wide), by day and night.
//   node tools/qa/tree-place.mjs      (OUT)
import {open} from './lib.mjs'; import fs from 'node:fs';
const OUT = process.env.OUT || 'qa-out/tree-place';
fs.mkdirSync(OUT, {recursive: true});
const checks = [];
const ok = (name, pass, info = '') => { checks.push(pass); console.log(pass ? 'ok  ' : 'FAIL', name, info); };
for (const [tag, width, night] of [['phone-day', 420, 0], ['wide-night', 1100, 1]]) {
  const {page, step, close} = await open({seed: 3, kitchen: true, night, flags: '&decor=christmas', width, height: 760});
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.evaluate(() => { document.querySelector('#decor-btn').click(); document.querySelector('#decor-options [data-decor="christmas"]')?.click(); });
  await page.waitForTimeout(800);
  await step(40);
  const shot = async name => { const f = `${OUT}/${tag}-${name}.png`; await page.locator('canvas').first().screenshot({path: f}); console.log(f); };
  await shot('room-view-kitchen');
  const at = await page.evaluate(() => { const k = kitten.kitchen, L = k.layout(), T = kitten.TREE; return {tree: [T.x, T.z], bed: [k.bed.position.x, k.bed.position.z], round: k.roundBed.visible, tent: k.tentParts.visible, fountain: [L.fountain.p.x, L.fountain.p.z], bowl: [L.bowl.p.x, L.bowl.p.z]}; });
  ok('the tree stands at the join, sea side', at.tree[0] > -4 && at.tree[0] < -1 && at.tree[1] > 9.8 && at.tree[1] < 11.8, JSON.stringify(at.tree));
  ok('her round bed is right beside it, the tent put away', at.round && !at.tent && Math.hypot(at.bed[0] - at.tree[0], at.bed[1] - at.tree[1]) < 3, JSON.stringify(at.bed));
  ok('her fountain stays in the living room', at.fountain[1] > 17, JSON.stringify(at.fountain));
  ok('her bowl stays in the kitchen', at.bowl[1] < 7.2, JSON.stringify(at.bowl));
  // From the kitchen, past the tree and its box, to her bed; then on into the living room and back.
  for (const [leg, x, z] of [['to her bed', at.bed[0], at.bed[1]], ['round the tree into the living room', -4.4, 14.8], ['back past the tree to the kitchen', -3.0, 4.5]]) {
    await page.evaluate(([x, z]) => kitten.walkTo(new kitten.brain.pos.constructor(x, 0, z)), [x, z]);
    let worst = 0, arrived = false, end = null;
    for (let i = 0; i < 260 && !arrived; i++) {
      await step(8);
      const s = await page.evaluate(() => { const b = kitten.brain, c = kitten.kitchen.pushOut(new b.pos.constructor(b.pos.x, 0, b.pos.z)); return {p: [+b.pos.x.toFixed(2), +b.pos.z.toFixed(2)], off: Math.hypot(c.x - b.pos.x, c.z - b.pos.z), walking: b.activity === 'walk' || !!b.target}; });
      worst = Math.max(worst, s.off); end = s.p; arrived = !s.walking;
    }
    const d = Math.hypot(end[0] - x, end[1] - z);
    ok(`walks ${leg}`, arrived && d < .6, `ends at ${end} (${d.toFixed(2)} off)`);
    ok('  keeps out of the tree, the box and the furniture', worst < .12, `worst ${worst.toFixed(2)} inside`);
    if (leg === 'to her bed') { await step(60); await shot('room-view-at-her-bed'); }
  }
  // The look changed away from Christmas: no tree in her way, the tent back.
  await page.evaluate(() => { document.querySelector('#decor-btn').click(); document.querySelector('#decor-options [data-decor="classic"]')?.click(); });
  await page.waitForTimeout(800); await step(10);
  ok('put away: no tree, the tent back, she is on her floor', await page.evaluate(() => { const k = kitten.kitchen, b = kitten.brain; return !kitten.xmasTree().root.visible && k.tentParts.visible && !k.roundBed.visible && k.bed.position.z > 20 && k.pushOut(k.clampFloor(b.pos.clone())).distanceTo(b.pos) < .05 && k.living.layout().obstacles.length === 7; }));
  ok(`${tag}: no page errors`, errors.length === 0, errors.join('; '));
  await close();
}
console.log(checks.filter(Boolean).length + ' of ' + checks.length + ' passed');
process.exitCode = checks.every(Boolean) ? 0 : 1;
