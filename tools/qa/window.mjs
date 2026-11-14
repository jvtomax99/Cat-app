// Stills of the study window and the view outside it, day and night, from
// straight on, from each side and close up (the view should shift behind
// the glazing bars as the camera moves).
//   node tools/qa/window.mjs      (OUT, W, H, NIGHTS="0 1", FLAGS)
import {open} from './lib.mjs'; import fs from 'node:fs';
const OUT = process.env.OUT || 'qa-out/window', W = +(process.env.W || 780), H = +(process.env.H || 1100);
fs.mkdirSync(OUT, {recursive: true});
const CAMS = {front: {yaw: 0, pitch: .05, dist: 6.5}, left: {yaw: -.55, pitch: .05, dist: 6.5}, right: {yaw: .55, pitch: .05, dist: 6.5}, close: {yaw: .15, pitch: 0, dist: 2.6}, low: {yaw: 0, pitch: -.12, dist: 4}};
for (const night of (process.env.NIGHTS || '0 1').split(' ')) {
  const {page, step, look, close} = await open({seed: 1, night: +night, flags: process.env.FLAGS || '', width: W, height: H});
  await step(20, 1 / 20);
  const z = await page.evaluate(() => kitten.room.walls.back);
  for (const [name, v] of Object.entries(CAMS)) {
    await look({focus: [-2.35, 3.45, z], ...v});
    const f = `${OUT}/${+night ? 'night' : 'day'}-${name}.png`;
    await page.locator('canvas').first().screenshot({path: f}); console.log(f);
  }
  await close();
}
