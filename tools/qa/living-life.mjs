// Phase 21 step 1: what she does in the living room. A nap on the sofa,
// kneading the throw, lying by the fire, watching the sea: each one run
// from the kitchen, checked for where she ends up and what she is doing,
// with a still of it. Then a tap on the sofa, and the same at Christmas
// (the tree stands at the join, on her way).
//   node tools/qa/living-life.mjs      (OUT, W, H, ONLY="sofa throw fire sea")
import {open} from './lib.mjs'; import fs from 'node:fs';
const OUT = process.env.OUT || 'qa-out/living-life', W = +(process.env.W || 1100), H = +(process.env.H || 760);
const ONLY = (process.env.ONLY || 'sofa throw fire sea').split(' ');
fs.mkdirSync(OUT, {recursive: true});
const checks = [];
const ok = (name, pass, info = '') => { checks.push(pass); console.log(pass ? 'ok  ' : 'FAIL', name, info); };
const state = page => page.evaluate(() => { const b = kitten.brain, c = kitten.kitchen.pushOut(new b.pos.constructor(b.pos.x, 0, b.pos.z)); return {x: +b.pos.x.toFixed(2), z: +b.pos.z.toFixed(2), y: +b.elevation.toFixed(2), h: +Math.atan2(Math.sin(b.heading), Math.cos(b.heading)).toFixed(2), act: b.activity, perch: b.perch || '', knead: kitten.clock < b.kneadUntil, off: b.perch || b.jump ? 0 : Math.hypot(c.x - b.pos.x, c.z - b.pos.z)}; });
for (const flags of ['', '&decor=christmas']) {
  const tag = flags ? 'xmas' : 'plain';
  if (flags && process.env.XMAS === '0') continue;
  const {page, step, look, close} = await open({seed: 5, kitchen: true, flags, width: W, height: H});
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await step(10);
  if (flags) { await page.evaluate(() => { document.querySelector('#decor-btn').click(); document.querySelector('#decor-options [data-decor="christmas"]')?.click(); }); await step(40); }
  const L = await page.evaluate(() => { const l = kitten.kitchen.layout(), v = p => [+p.x.toFixed(2), +p.z.toFixed(2)]; return {sofa: v(l.perches.sofa.spot), sofaTop: l.perches.sofa.top, throw: v(l.perches.throw.spot), fire: v(l.fireSpot.at), sea: v(l.seaSpot.at)}; });
  console.log(tag, JSON.stringify(L));
  const shot = async (name, v) => { await look(v); const f = `${OUT}/${tag}-${name}.png`; await page.locator('canvas').first().screenshot({path: f}); console.log(f); };
  // Run one of them until `done` says so; the worst she was inside furniture on the way.
  const run = async (fn, done, max = 300) => {
    await page.evaluate(() => { kitten.brain.mode = 'idle'; kitten.brain.nextIdle = 1e9; });
    await page.evaluate(fn);
    let worst = 0, s = null;
    for (let i = 0; i < max; i++) { await step(8); s = await state(page); worst = Math.max(worst, s.off); if (done(s)) return {s, worst, reached: true}; }
    return {s, worst, reached: false};
  };
  const near = (s, [x, z], d = .6) => Math.hypot(s.x - x, s.z - z) < d;
  if (ONLY.includes('sofa')) {
    const r = await run(() => kitten.sofaNap(), s => s.perch === 'sofa' && s.act === 'catnap');
    ok(`${tag}: up on the sofa and asleep`, r.reached && near(r.s, L.sofa, .35) && Math.abs(r.s.y - L.sofaTop) < .05, JSON.stringify(r.s));
    ok('  keeps out of the furniture on the way', r.worst < .12, `worst ${r.worst.toFixed(2)}`);
    await step(40);
    await shot('sofa-nap', {focus: [L.sofa[0], 1.3, L.sofa[1]], yaw: 1.15, pitch: .3, dist: 6});
    await shot('sofa-nap-wide', {focus: [1.5, 1.6, 16.5], yaw: Math.PI - .5, pitch: .25, dist: 12});
    const d = await run(() => kitten.jumpDown(() => kitten.setActivity('sit')), s => !s.perch && s.act === 'sit', 80);
    ok('  and down again to the floor', d.reached && d.s.y < .05, JSON.stringify(d.s));
  }
  if (ONLY.includes('throw')) {
    const r = await run(() => kitten.kneadThrow(), s => s.perch === 'throw' && s.knead && s.act === 'loaf');
    ok(`${tag}: on the throw, kneading`, r.reached && near(r.s, L.throw, .35), JSON.stringify(r.s));
    await step(50);
    const s = await state(page);
    ok('  facing the arm it hangs over', Math.abs(Math.abs(s.h) - Math.PI) < .35, `heading ${s.h}`);
    await shot('throw-knead', {focus: [L.throw[0], 1.3, L.throw[1]], yaw: 1.0, pitch: .32, dist: 5});
    await shot('throw-knead-side', {focus: [L.throw[0], 1.3, L.throw[1]], yaw: 2.2, pitch: .3, dist: 5});
    await run(() => kitten.jumpDown(() => kitten.setActivity('sit')), s => !s.perch && s.act === 'sit', 80);
  }
  if (ONLY.includes('fire')) {
    const r = await run(() => kitten.fireside(), s => s.act === 'loaf' && near(s, L.fire, .7));
    ok(`${tag}: lying by the fire`, r.reached, JSON.stringify(r.s));
    ok('  keeps out of the furniture on the way', r.worst < .12, `worst ${r.worst.toFixed(2)}`);
    await step(60);
    const s = await state(page);
    ok('  facing the flames', Math.abs(s.h - Math.PI / 2) < .4 && s.act === 'loaf', `heading ${s.h}, ${s.act}`);
    await shot('fireside', {focus: [L.fire[0] + .6, .8, L.fire[1]], yaw: -1.0, pitch: .28, dist: 6});
  }
  if (ONLY.includes('sea')) {
    const r = await run(() => kitten.seaWatch(), s => s.act === 'sit' && near(s, L.sea, .5));
    ok(`${tag}: at the glazing`, r.reached, JSON.stringify(r.s));
    ok('  keeps out of the furniture on the way', r.worst < .12, `worst ${r.worst.toFixed(2)}`);
    await step(60);
    const s = await state(page);
    ok('  sitting, facing the sea', Math.abs(s.h + Math.PI / 2) < .4 && s.act === 'sit', `heading ${s.h}, ${s.act}`);
    await shot('sea-watch', {focus: [L.sea[0], .9, L.sea[1]], yaw: 1.1, pitch: .25, dist: 6});
    await shot('sea-watch-behind', {focus: [L.sea[0] - 1, 1.2, L.sea[1]], yaw: Math.PI / 2, pitch: .18, dist: 5});
  }
  ok(`${tag}: no page errors`, errors.length === 0, errors.join('; '));
  await close();
}
console.log(`${checks.filter(Boolean).length} of ${checks.length} passed`);
process.exit(checks.every(Boolean) ? 0 : 1);
