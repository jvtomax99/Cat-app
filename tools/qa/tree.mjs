// The Christmas tree where the kitchen meets the living room: her first curious look, up it in
// stages, a bauble batted, one knocked off and chased, stuck at the top and
// helped down, hiding under it, sitting in the open box; a tap hangs a
// fallen bauble back. Stills of each step, and checks.
//   node tools/qa/tree.mjs            (OUT, NIGHT=0|1, W, H)
import {open} from './lib.mjs'; import fs from 'node:fs';
const OUT = process.env.OUT || 'qa-out/tree', W = +(process.env.W || 900), H = +(process.env.H || 760);
fs.mkdirSync(OUT, {recursive: true});
const {page, step, look, close} = await open({seed: 3, kitchen: true, night: +(process.env.NIGHT ?? 1), flags: '&decor=christmas', width: W, height: H});
const errors = []; page.on('pageerror', e => errors.push(e.message));
await page.evaluate(() => { document.querySelector('#decor-btn').click(); document.querySelector('#decor-options [data-decor="christmas"]')?.click(); });
await page.waitForTimeout(800);
await step(10);
const wide = {focus: [-.5, 3.2, 10.0], yaw: Math.PI - .35, pitch: .1, dist: 15};
// (Close shots look at her from the kitchen, the side she climbs.)
const shot = async (name, cam = null) => {
  if (!cam) { const [x, y, z] = await page.evaluate(() => [kitten.brain.pos.x, kitten.brain.elevation, kitten.brain.pos.z]); cam = {focus: [x + .3, y + .4, z], yaw: Math.PI - .1, pitch: .12, dist: 9}; }
  await look(cam); await page.locator('canvas').first().screenshot({path: `${OUT}/${name}.png`});
};
const state = () => page.evaluate(() => ({perch: kitten.brain.perch, act: kitten.brain.activity, y: +kitten.brain.elevation.toFixed(2), at: kitten.brain.pos.toArray().map(v => +v.toFixed(2)), stuck: !!kitten.brain.treeStuck, fallen: kitten.xmasTree().fallen().map(L => L.down.g.getWorldPosition(L.down.g.position.clone()).toArray().map(v => +v.toFixed(2)).concat(L.down.rest))}));
const until = async (test, max = 400) => { for (let i = 0; i < max; i += 10) { await step(10); if (await page.evaluate(test)) return true; } return false; };
const checks = [];
const ok = (name, pass, info = '') => { checks.push(pass); console.log(pass ? 'ok  ' : 'FAIL', name, info); };
// (Her own life kept quiet between steps: getting stuck, say, wakes it.)
const idle = () => page.evaluate(() => { const b = kitten.brain; b.mode = 'idle'; b.perchUntil = 1e9; b.nextIdle = 1e9; b.nextShow = 1e9; });

ok('the tree is up in the kitchen', await page.evaluate(() => kitten.place === kitten.kitchen && kitten.xmasTree()?.root.visible && kitten.xmasTree().foliage.count > 1000), await page.evaluate(() => kitten.xmasTree()?.foliage.count));
await shot('0-tree', wide);
// The first look: stares, creeps up, sits, sniffs and paws a low bauble.
await page.evaluate(() => kitten.curiousLook());
ok('first look: she creeps up (crouched)', await until(() => kitten.brain.activity === 'stalk', 1000), JSON.stringify(await state()));
await shot('1-creep', wide);
ok('first look: a careful paw at a low bauble', await until(() => kitten.brain.activity === 'swat', 500), JSON.stringify(await state()));
await step(6);
const lowSwing = await page.evaluate(() => Math.max(...kitten.xmasTree().loose.filter(L => L.group === 'low').map(L => Math.hypot(L.pivot.rotation.x, L.pivot.rotation.z))));
ok('the low bauble swings', lowSwing > .03, lowSwing.toFixed(3));
await shot('2-paw');
await step(80);
// Up in stages.
await idle();
await page.evaluate(() => kitten.climbTree('treeHigh'));
for (const p of ['treeLow', 'treeMid']) ok(`climbs: ${p}`, await until(`kitten.brain.perch === '${p}'`, 400), JSON.stringify(await state()));
// (A tap on the tree while she's in the air between branches: she carries on up.)
await until(() => kitten.brain.perch === 'treeMid' && !!kitten.brain.jump, 300);
await page.evaluate(() => { kitten.brain.mode = 'idle'; for (let i = 0; i < 5; i++) kitten.invite('treeHigh'); });
ok('climbs: treeHigh', await until(() => kitten.brain.perch === 'treeHigh' && !kitten.brain.jump, 400), JSON.stringify(await state()));
await step(30);
await shot('3-high');
await idle();
await page.evaluate(() => kitten.batBauble());
await step(14);
const swing = await page.evaluate(() => Math.max(...kitten.xmasTree().loose.filter(L => L.group === 'high').map(L => Math.hypot(L.pivot.rotation.x, L.pivot.rotation.z))));
ok('a pat up there sets a bauble swinging', swing > .05, swing.toFixed(3));
await step(60);
await page.evaluate(() => { kitten.brain.nextKnock = 0; kitten.knockBauble(); });
ok('one comes off', await until(() => kitten.xmasTree().fallen().length === 1, 120));
ok('it lands and rolls to a stop', await until(() => kitten.xmasTree().fallen().every(L => L.down.rest), 400), JSON.stringify((await state()).fallen));
ok('she goes down after it', await until(() => !kitten.brain.perch && !kitten.brain.jump, 600), JSON.stringify(await state()));
ok('and gives it a pat', await until(() => kitten.brain.activity === 'swat', 400), JSON.stringify(await state()));
ok('standing clear of the island, the tree and the box', await page.evaluate(() => { const b = kitten.brain, v = b.pos.clone(); return kitten.kitchen.pushOut(kitten.kitchen.clampFloor(v.clone())).distanceTo(v) < .05; }), JSON.stringify(await state()));
await step(6);
await shot('4-chase');
await step(140);
const s = await state();
ok('the bauble stays indoors (kitchen and living room)', s.fallen.every(([x, y, z]) => x > -6 && x < 10 && z > -4.2 && z < 23.4 && y > 0), JSON.stringify(s.fallen));
// A tap on the fallen bauble (she's moved off it first: a tap on her is a stroke).
await page.evaluate(() => { kitten.brain.target = null; kitten.brain.pos.set(1, 0, 4.2); });
await look(wide); await step(2);
const tapped = await page.evaluate(() => {
  const L = kitten.xmasTree().fallen()[0], p = L.down.g.getWorldPosition(L.down.g.position.clone()).project(kitten.camera);
  const c = kitten.renderer.domElement.getBoundingClientRect();
  return {x: c.left + (p.x + 1) / 2 * c.width, y: c.top + (1 - p.y) / 2 * c.height};
});
await page.mouse.click(tapped.x, tapped.y);
await step(12);
ok('a tap hangs it back up', await page.evaluate(() => kitten.xmasTree().fallen().length === 0));
// Stuck at the top, and helped down by a touch.
await idle();
await page.evaluate(() => kitten.climbTree('treeTop'));
ok('all the way to the top', await until(() => kitten.brain.perch === 'treeTop' && !kitten.brain.jump, 800), JSON.stringify(await state()));
ok('stuck there', await until(() => kitten.brain.treeStuck, 100));
await step(80);
await shot('5-stuck');
await page.evaluate(() => kitten.touchCat('back'));
ok('a touch helps her down to the floor', await until(() => !kitten.brain.perch && !kitten.brain.jump, 800), JSON.stringify(await state()));
await step(120);
ok('and stays down', await page.evaluate(() => !kitten.brain.perch), JSON.stringify(await state()));
await idle(); await step(60);
// Hiding under the low boughs.
await idle();
// (As in the app, she picks it when she's settled: not halfway through
// something of her own, like stalking the vacuum's dock.)
// (Off on a climb of her own, up on the counter say, she comes down first.)
const settle = async () => {
  await until(() => ['sit', 'loaf'].includes(kitten.brain.activity) && !kitten.brain.target && !kitten.brain.pounce && !kitten.brain.jump, 600);
  for (let i = 0; i < 4 && await page.evaluate(() => !!kitten.brain.perch); i++) { await page.evaluate(() => kitten.jumpDown(() => kitten.setActivity('sit'))); await until(() => !kitten.brain.jump && kitten.brain.activity === 'sit', 300); }
  await idle();
};
await settle();
await page.evaluate(() => kitten.treeHide());
ok('hides under the tree', await until(() => kitten.brain.activity === 'loaf' && Math.hypot(kitten.brain.pos.x - kitten.TREE.hide[0], kitten.brain.pos.z - kitten.TREE.hide[1]) < .4, 900), JSON.stringify(await state()));
await step(20);
await shot('6-hide');
await step(260);
// Into the open box.
await idle(); await settle();
await page.evaluate(() => kitten.boxSit());
ok('sits in the open box', await until(() => kitten.brain.perch === 'xmasBox' && kitten.brain.activity === 'loaf', 800), JSON.stringify(await state()));
await step(10);
await shot('7-box');
// The look changed away from Christmas: no tree, she's back on her usual floor.
await page.evaluate(() => { document.querySelector('#decor-btn').click(); document.querySelector('#decor-options [data-decor="classic"]')?.click(); });
await page.waitForTimeout(800); await step(10);
ok('put away: no tree, her usual floor', await page.evaluate(() => !kitten.xmasTree().root.visible && !kitten.brain.perch && kitten.kitchen.pushOut(kitten.kitchen.clampFloor(kitten.brain.pos.clone())).distanceTo(kitten.brain.pos) < .05 && !kitten.PERCHES.treeHigh), JSON.stringify(await state()));
ok('no page errors', errors.length === 0, errors.join(' | '));
console.log(`${checks.filter(Boolean).length} of ${checks.length}`);
await close();
process.exit(checks.every(Boolean) ? 0 : 1);
