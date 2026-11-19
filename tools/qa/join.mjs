// Phase 21 step 1: the living room joined to the kitchen as one open space.
// She walks from the kitchen into the living room, round its furniture, to
// her tent's door and back, never off her floor; stills of the open space
// by day and night (from the kitchen, in the living room, from the study's
// doorway); how heavy one frame is with her in the living room.
//   node tools/qa/join.mjs      (OUT, NIGHTS="0 1", W, H)
import {open} from './lib.mjs'; import fs from 'node:fs';
const OUT = process.env.OUT || 'qa-out/join', W = +(process.env.W || 1100), H = +(process.env.H || 760);
fs.mkdirSync(OUT, {recursive: true});
const checks = [];
const ok = (name, pass, info = '') => { checks.push(pass); console.log(pass ? 'ok  ' : 'FAIL', name, info); };
const STOPS = [['into the living room', 6.0, 17.0], ['behind the sofa, by the sea glazing', -4.4, 14.8], ['to the far end', 6.5, 22.6], ['to her tent door', -3.0, 20.0], ['back to the kitchen', 2.5, 3.2]];
for (const night of (process.env.NIGHTS || '0 1').split(' ')) {
  const tag = +night ? 'night' : 'day';
  const {page, step, look, close} = await open({seed: 3, kitchen: true, night: +night, width: W, height: H});
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await step(10);
  const shot = async (name, v) => { await look(v); const f = `${OUT}/${tag}-${name}.png`; await page.locator('canvas').first().screenshot({path: f}); console.log(f); };
  await shot('open-plan', {focus: [2.0, 2.0, 10.0], yaw: Math.PI - .25, pitch: .2, dist: 13.5});
  await shot('from-living', {focus: [2.0, 2.0, 8.0], yaw: .25, pitch: .2, dist: 15});
  await shot('seam', {focus: [1.0, 1.5, 9.0], yaw: 1.2, pitch: .3, dist: 8.5});
  if (!+night) {
    ok('her tent and fountain stand in the living room', await page.evaluate(() => kitten.kitchen.bed.position.z > 20 && kitten.kitchen.layout().fountain.p.z > 17));
    for (const [leg, x, z] of STOPS) {
      await page.evaluate(([x, z]) => kitten.walkTo(new kitten.brain.pos.constructor(x, 0, z)), [x, z]);
      let worst = 0, arrived = false, end = null;
      for (let i = 0; i < 260 && !arrived; i++) {
        await step(8);
        const s = await page.evaluate(() => { const b = kitten.brain, c = kitten.kitchen.pushOut(new b.pos.constructor(b.pos.x, 0, b.pos.z)); return {p: [+b.pos.x.toFixed(2), +b.pos.z.toFixed(2)], off: Math.hypot(c.x - b.pos.x, c.z - b.pos.z), walking: b.activity === 'walk' || !!b.target, place: kitten.placeId?.() ?? ''}; });
        worst = Math.max(worst, s.off); end = s.p; arrived = !s.walking;
      }
      const d = Math.hypot(end[0] - x, end[1] - z);
      ok(`walks ${leg}`, arrived && d < .6, `ends at ${end} (${d.toFixed(2)} from ${x}, ${z})`);
      ok(`  keeps out of the furniture`, worst < .12, `worst ${worst.toFixed(2)} inside`);
      await shot('walk-' + leg.replace(/[^a-z]+/g, '-'), {focus: [end[0], .8, end[1]], yaw: end[1] > 9.8 ? Math.PI - .5 : .35, pitch: .32, dist: 7});
    }
    // One frame with her in the living room.
    await page.evaluate(() => kitten.walkTo(new kitten.brain.pos.constructor(6, 0, 17)));
    for (let i = 0; i < 60; i++) await step(8);
    await look({focus: [2.0, 2.0, 10.0], yaw: Math.PI - .25, pitch: .2, dist: 13.5});
    console.log('one frame, the open-plan view:', JSON.stringify(await page.evaluate(() => { const r = kitten.renderer?.info.render; return r ? {calls: r.calls, triangles: r.triangles} : 'renderer not exposed'; })));
  }
  ok(`${tag}: no page errors`, errors.length === 0, errors.join('; '));
  await close();
}
{
  const {page, step, look, close} = await open({seed: 3, kitchen: false, width: W, height: H});
  await step(10);
  await look({focus: [-3.4, 2.4, 1.1], yaw: Math.PI / 2 + .25, pitch: .1, dist: 6});
  await page.locator('canvas').first().screenshot({path: `${OUT}/from-study-doorway.png`}); console.log(`${OUT}/from-study-doorway.png`);
  await close();
}
console.log(checks.filter(Boolean).length + ' of ' + checks.length + ' passed');
process.exitCode = checks.every(Boolean) ? 0 : 1;
