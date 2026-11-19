// A quick look at the hall: stills of the Room view on a phone and a wide
// screen, the hall seen from the kitchen, and the kitchen from the hall.
//   node tools/qa/hall-look.mjs      (OUT)
import {open} from './lib.mjs'; import fs from 'node:fs';
const OUT = process.env.OUT || 'qa-out/hall-look';
fs.mkdirSync(OUT, {recursive: true});
for (const [name, width, height] of [['phone', 390, 844], ['wide', 1280, 800]]) {
  const {page, step, look, close} = await open({seed: 3, width, height, night: +(process.env.NIGHT || 0)});
  page.on('console', m => { if (m.type() === 'error') console.log('console', m.text()); });
  await page.evaluate(() => { const s = document.querySelector('#sheet'); if (s) { s.style.pointerEvents = 'none'; s.style.visibility = 'hidden'; } });
  const shot = n => page.locator('canvas').first().screenshot({path: `${OUT}/${name}-${n}.png`});
  await page.evaluate(() => kitten.goTo('hall'));
  await step(40); await shot('room');
  await look({focus: [3.5, 3, 2.5], yaw: -.5, pitch: .35, dist: 11}); await step(2); await shot('stairs');
  await look({focus: [-4.5, 1.5, 2], yaw: .6, pitch: .3, dist: 8}); await step(2); await shot('bench');
  await look({focus: [-2.15, 1.5, 1], yaw: 0, pitch: .12, dist: 5}); await step(2); await shot('to-kitchen');
  await page.evaluate(() => kitten.goTo('kitchen'));
  await step(40); await shot('kitchen-room');
  await look({focus: [8, 1.5, 4.95], yaw: -Math.PI / 2, pitch: .15, dist: 6}); await step(2); await shot('from-kitchen');
  await close();
}
