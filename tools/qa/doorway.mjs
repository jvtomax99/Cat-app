// Stills of the kitchen seen from the study, through the doorway, day and
// night: straight through and slanted each way (no outdoors should show
// past the end or over the top of the kitchen's window wall).
//   node tools/qa/doorway.mjs      (OUT, FLAGS)
import {open} from './lib.mjs'; import fs from 'node:fs';
const OUT = process.env.OUT || 'qa-out/doorway';
fs.mkdirSync(OUT, {recursive: true});
const CAMS = {straight: {yaw: 1.57, dist: 6}, slant: {yaw: 1.0, dist: 3}, close: {yaw: .7, dist: 2.2}, other: {yaw: 2.1, dist: 3}};
for (const night of [0, 1]) {
  const {page, step, look, close} = await open({seed: 1, night, flags: process.env.FLAGS || '', width: 780, height: 1100});
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await step(20, 1 / 20);
  const d = await page.evaluate(() => ({x: kitten.room.walls.left, z: (kitten.room.door.z0 + kitten.room.door.z1) / 2}));
  for (const [name, v] of Object.entries(CAMS)) {
    await look({focus: [d.x, 2.8, d.z], pitch: .03, ...v}); await step(3, 1 / 20);
    const f = `${OUT}/${night ? 'night' : 'day'}-${name}.png`;
    await page.locator('canvas').first().screenshot({path: f}); console.log(f);
  }
  console.log('page errors:', errs.length); await close();
}
