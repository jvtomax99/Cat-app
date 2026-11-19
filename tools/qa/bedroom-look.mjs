// A quick look at the bedroom (phase 21 step 3): stills of its Room view
// on a phone and a wide screen, the bed, the window seat, the landing's
// open door from both sides.
//   node tools/qa/bedroom-look.mjs      (OUT, NIGHT)
import {open} from './lib.mjs'; import fs from 'node:fs';
const OUT = process.env.OUT || 'qa-out/bedroom-look';
fs.mkdirSync(OUT, {recursive: true});
for (const [name, width, height] of [['phone', 390, 844], ['wide', 1280, 800]]) {
  const {page, step, look, close} = await open({seed: 3, width, height, night: +(process.env.NIGHT || 0)});
  page.on('console', m => { if (m.type() === 'error') console.log('console', m.text()); });
  page.on('pageerror', e => console.log('pageerror', String(e)));
  await page.evaluate(() => { const s = document.querySelector('#sheet'); if (s) { s.style.pointerEvents = 'none'; s.style.visibility = 'hidden'; } });
  const shot = n => page.locator('canvas').first().screenshot({path: `${OUT}/${name}-${n}.png`});
  await page.evaluate(() => kitten.goTo('bedroom'));
  await step(40); await shot('room');
  console.log(name, await page.evaluate(() => JSON.stringify({place: kitten.placeId(kitten.place), level: kitten.hall.level, wing: kitten.hall.wing, pos: kitten.brain.pos, y: kitten.brain.elevation})));
  if (name === 'phone') {
    await look({focus: [4.5, 11.5, -10.6], yaw: -1.9, pitch: .3, dist: 8}); await step(2); await shot('bed');
    await look({focus: [.5, 12, -15.5], yaw: -.25, pitch: .2, dist: 8}); await step(2); await shot('seat');
    await look({focus: [-4.6, 12, -.5], yaw: Math.PI, pitch: .15, dist: 6}); await step(2); await shot('door-inside');
    await page.evaluate(() => kitten.goTo('landing'));
    await step(30); await shot('landing-room');
    await look({focus: [-4.6, 12, 0], yaw: 0, pitch: .15, dist: 6}); await step(2); await shot('door-landing');
  }
  await close();
}
