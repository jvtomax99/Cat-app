// The Christmas tree in the study: she climbs it, lies in its top half, bats
// a bauble, knocks one off, goes down after it; a tap hangs it back up.
// Stills of each step, and checks.
//   node tools/qa/tree.mjs            (OUT, NIGHT=0|1, W, H)
import {open} from './lib.mjs'; import fs from 'node:fs';
const OUT = process.env.OUT || 'qa-out/tree', W = +(process.env.W || 900), H = +(process.env.H || 760);
fs.mkdirSync(OUT, {recursive: true});
const {page, step, look, close} = await open({seed: 3, night: +(process.env.NIGHT ?? 1), flags: '&decor=christmas', width: W, height: H});
const errors = []; page.on('pageerror', e => errors.push(e.message));
await page.evaluate(() => { document.querySelector('#decor-btn').click(); document.querySelector('#decor-options [data-decor="christmas"]')?.click(); });
await page.waitForTimeout(800);
await step(10);
const cam = {focus: [3.1, 2.4, -1.9], yaw: -0.45, pitch: 0.1, dist: 7.2};
const shot = async name => { await look(cam); await page.locator('canvas').first().screenshot({path: `${OUT}/${name}.png`}); };
const state = () => page.evaluate(() => ({perch: kitten.brain.perch, act: kitten.brain.activity, y: +kitten.brain.elevation.toFixed(2), at: kitten.brain.pos.toArray().map(v => +v.toFixed(2)), fallen: kitten.room.xmasTree.fallen().map(L => L.down.g.position.toArray().map(v => +v.toFixed(2)).concat(L.down.rest))}));
const until = async (test, max = 400) => { for (let i = 0; i < max; i += 10) { await step(10); if (await page.evaluate(test)) return true; } return false; };
const checks = [];
const ok = (name, pass, info = '') => { checks.push(pass); console.log(pass ? 'ok  ' : 'FAIL', name, info); };

ok('the tree is up, the olive tree put away', await page.evaluate(() => kitten.room.xmasTree?.root.visible && !kitten.room.oliveTree.visible));
await shot('0-tree');
await page.evaluate(() => kitten.climbTree());
ok('into the low branches', await until(() => kitten.brain.perch === 'treeLow'), JSON.stringify(await state()));
await shot('1-low');
ok('up to the top half', await until(() => kitten.brain.perch === 'treeHigh' && !kitten.brain.jump, 300), JSON.stringify(await state()));
await step(30);
await shot('2-high');
await page.evaluate(() => { kitten.brain.perchUntil = 1e9; kitten.batBauble(); });
await step(14);
const swing = await page.evaluate(() => Math.max(...kitten.room.xmasTree.loose.map(L => Math.hypot(L.pivot.rotation.x, L.pivot.rotation.z))));
ok('a pat sets a bauble swinging', swing > .05, swing.toFixed(3));
await shot('3-bat');
await step(60);
await page.evaluate(() => { kitten.brain.nextKnock = 0; kitten.knockBauble(); });
ok('one comes off', await until(() => kitten.room.xmasTree.fallen().length === 1, 120));
await step(8);
await shot('4-falling');
ok('it lands and rolls to a stop on the floor', await until(() => kitten.room.xmasTree.fallen().every(L => L.down.rest), 400), JSON.stringify((await state()).fallen));
ok('she goes down after it', await until(() => !kitten.brain.perch && !kitten.brain.jump, 500), JSON.stringify(await state()));
ok('and gives it a pat', await until(() => kitten.brain.activity === 'swat', 400), JSON.stringify(await state()));
ok('standing clear of the chair, the tree and the hearth', await page.evaluate(() => kitten.room.xmasTree.freeFloor(kitten.brain.pos.x, kitten.brain.pos.z, kitten.brain.heading)));
await step(6);
await shot('5-chase');
await step(120);
const s = await state();
ok('the bauble stays in the room', s.fallen.every(([x, y, z]) => { const wx = x + 4.0, wz = z - 2.72; return wx > -4.6 && wx < 4.6 && wz > -3.4 && wz < 3.7 && y > 0; }), JSON.stringify(s.fallen));
await shot('6-after');
// A tap on the fallen bauble: back on the tree.
const tapped = await page.evaluate(() => {
  const T = kitten.room.xmasTree, L = T.fallen()[0], p = L.down.g.getWorldPosition(L.down.g.position.clone()).project(kitten.camera);
  const c = kitten.renderer.domElement.getBoundingClientRect();
  return {x: c.left + (p.x + 1) / 2 * c.width, y: c.top + (1 - p.y) / 2 * c.height};
});
await page.mouse.click(tapped.x, tapped.y);
await step(12);
ok('a tap hangs it back up', await page.evaluate(() => kitten.room.xmasTree.fallen().length === 0));
ok('no page errors', errors.length === 0, errors.join(' | '));
console.log(`${checks.filter(Boolean).length} of ${checks.length}`);
await close();
process.exit(checks.every(Boolean) ? 0 : 1);
