// Stills of the bathroom (phase 21 step 4): the Room view on a phone and a
// wide screen, her at the tap, the paper down, on the mat.
//   node tools/qa/bathroom-look.mjs      (OUT, NIGHT, WIDE=1)
import {open} from './lib.mjs'; import fs from 'node:fs';
const OUT = process.env.OUT || 'qa-out/bathroom-look';
fs.mkdirSync(OUT, {recursive: true});
const wide = !!+(process.env.WIDE || 0);
const {page, step, close} = await open({seed: 4, width: wide ? 1280 : 390, height: wide ? 800 : 844, night: +(process.env.NIGHT || 0)});
page.on('pageerror', e => console.log('ERR', String(e)));
await page.evaluate(() => { const s = document.querySelector('#sheet'); if (s) { s.style.pointerEvents = 'none'; s.style.visibility = 'hidden'; } });
const until = async (f, max) => { for (let i = 0; i < max; i += 10) { if (await page.evaluate(f)) return; await step(10); } };
const close2 = async n => { await page.evaluate(() => kitten.CAMERA_VIEWS.follow()); await step(50); await shot(n + '-close'); await page.evaluate(() => kitten.CAMERA_VIEWS.room()); await step(30); };
const shot = n => page.locator('canvas').first().screenshot({path: `${OUT}/${wide ? 'wide-' : ''}${n}.png`});
await page.evaluate(() => { kitten.goTo('bathroom'); kitten.brain.nextIdle = kitten.clock + 1e6; kitten.brain.nextShow = kitten.clock + 1e6; });
await step(120); await shot('room');
console.log(await page.evaluate(() => JSON.stringify({wing: kitten.hall.wing, level: kitten.hall.level, pos: kitten.brain.pos})));
if (!process.env.ONLY) {
  await page.evaluate(() => kitten.tapDrink()); await until(() => kitten.brain.activity === 'drink', 1500); await step(40); await shot('tap'); await close2('tap');
  console.log(await page.evaluate(() => JSON.stringify({act: kitten.brain.activity, perch: kitten.brain.perch, y: kitten.brain.elevation, run: kitten.hall.bathroom.stream.visible})));
  await page.evaluate(() => { kitten.brain.nextIdle = kitten.clock + 1e6; kitten.setActivity('sit'); kitten.paperPlay(); }); await step(900); await shot('paper'); await close2('paper');
  console.log(await page.evaluate(() => JSON.stringify({act: kitten.brain.activity, paper: kitten.hall.bathroom.paper, pos: kitten.brain.pos})));
  await page.evaluate(() => { kitten.brain.nextIdle = kitten.clock + 1e6; kitten.setActivity('sit'); kitten.matNap(); }); await step(700); await shot('mat'); await close2('mat');
  console.log(await page.evaluate(() => JSON.stringify({act: kitten.brain.activity, paper: kitten.hall.bathroom.paper, pos: kitten.brain.pos})));
}
await close();
