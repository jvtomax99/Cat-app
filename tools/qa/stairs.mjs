// The stairs (phase 21, step 2): she climbs from the hall to the landing
// and back. Checks her height on the way (rising steadily, the landing at
// 10, the floor again at the end), that each paw stands on a step (never
// in the air or inside one), and stills on the way up and on the landing.
//   node tools/qa/stairs.mjs      (OUT, WIDTH, HEIGHT)
import {open} from './lib.mjs'; import fs from 'node:fs';
const OUT = process.env.OUT || 'qa-out/stairs';
fs.mkdirSync(OUT, {recursive: true});
const {page, step, look, close} = await open({seed: 5, width: +(process.env.WIDTH || 390), height: +(process.env.HEIGHT || 844)});
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e)));
await page.evaluate(() => { const s = document.querySelector('#sheet'); if (s) { s.style.pointerEvents = 'none'; s.style.visibility = 'hidden'; } });
const shot = n => page.locator('canvas').first().screenshot({path: `${OUT}/${n}.png`});
const results = [];
const check = (name, ok, info = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${info ? ': ' + info : ''}`); };
// Where she is, and how far each planted paw is above (or below) the step under it.
const state = () => page.evaluate(() => {
  const k = kitten, b = k.brain, h = k.hall, m = k.cat.motion;
  const paws = Object.entries(m.paws).map(([n, p]) => p.pos && !p.swing && !p.free ? +(p.pos.y - h.groundAt(p.pos.x, p.pos.z, b.elevation)).toFixed(3) : null);
  return {x: +b.pos.x.toFixed(2), z: +b.pos.z.toFixed(2), y: +b.elevation.toFixed(2), level: h.level, act: b.activity, slope: +(b.slope || 0).toFixed(2), paws, place: k.placeId(k.place)};
});
const side = async (s, n, dist = 6, yaw = -.35) => { await look({focus: [s.x, s.y + .6, s.z], yaw, pitch: .22, dist}); await shot(n); };

await page.evaluate(() => kitten.goTo('hall'));
await step(30);
await page.evaluate(() => kitten.climbTo(true, () => kitten.setActivity('sit', 30)));
let s = await state(), last = s.y, maxDrop = 0, worstPaw = 0, snaps = [1.2, 3.5, 5, 7.5, 10], frames = 0;
while (frames < 2400) {
  await step(10); frames += 10;
  s = await state();
  maxDrop = Math.max(maxDrop, last - s.y); last = s.y;
  for (const p of s.paws) if (p !== null) worstPaw = Math.max(worstPaw, Math.abs(p));
  if (snaps.length && s.y >= snaps[0] - .05) { const v = snaps.shift(); console.log('up', v, JSON.stringify(s)); await side(s, `up-${v}`); await page.evaluate(() => { kitten.view.mode = 'room'; }); }
  if (s.act === 'sit' && s.y > 9.9) break;
}
check('she reaches the landing', s.y > 9.9 && s.level === 'up', JSON.stringify(s));
check('going up she never drops more than a little', maxDrop < .15, `largest drop ${maxDrop.toFixed(2)}`);
check('her planted paws stand on the steps', worstPaw < .03, `worst ${worstPaw.toFixed(3)}`);
await page.evaluate(() => kitten.CAMERA_VIEWS.room());
await step(60); await shot('landing-room');
await page.evaluate(() => kitten.CAMERA_VIEWS.follow(kitten.view.goal.yaw));
await step(40); await shot('landing-follow');

// And down again, to the hall's floor (by asking her to the kitchen: down
// the stairs first).
await page.evaluate(() => kitten.walkToRoom('kitchen', () => kitten.setActivity('sit', 30)));
let rose = 0; worstPaw = 0; frames = 0; last = s.y; snaps = [7.5, 2.5];
while (frames < 3200) {
  await step(10); frames += 10;
  s = await state();
  rose = Math.max(rose, s.y - last); last = s.y;
  for (const p of s.paws) if (p !== null) worstPaw = Math.max(worstPaw, Math.abs(p));
  if (snaps.length && s.y <= snaps[0] && s.level === 'down' || (snaps.length && snaps[0] > 5 && s.y <= snaps[0])) { const v = snaps.shift(); console.log('down', v, JSON.stringify(s)); await side(s, `down-${v}`, 6, -.35); await page.evaluate(() => { kitten.view.mode = 'room'; }); }
  if (s.place === 'kitchen' && s.act === 'sit') break;
}
check('down the stairs and on to the kitchen', s.place === 'kitchen' && s.y < .05, JSON.stringify(s));
check('going down she never climbs back up', rose < .15, `largest rise ${rose.toFixed(2)}`);
check('her planted paws stand on the steps going down', worstPaw < .03, `worst ${worstPaw.toFixed(3)}`);
check('no errors', !errors.length, errors.slice(0, 3).join(' | '));
console.log(`${results.filter(Boolean).length} of ${results.length} passed`);
await close();
process.exit(results.every(Boolean) ? 0 : 1);
