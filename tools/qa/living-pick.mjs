// The room picker's living room: listed; "Call her" from the study walks
// her through the doorway and across the kitchen to the living room, never
// inside its furniture; the picker marks it; "Go now" from the kitchen half
// opens her there; "Go now" to the kitchen takes her back. Stills to OUT.
//   node tools/qa/living-pick.mjs      (OUT, NIGHT, SEED)
import {open} from './lib.mjs'; import fs from 'node:fs';
const OUT = process.env.OUT || 'qa-out/living-pick';
fs.mkdirSync(OUT, {recursive: true});
const {page, step, close} = await open({seed: +(process.env.SEED || 4), width: 390, height: 844, night: +(process.env.NIGHT || 0)});
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e)));
const shot = n => page.screenshot({path: `${OUT}/${n}.png`});
const results = [];
const check = (name, ok, info = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${info ? ': ' + info : ''}`); };
const state = () => page.evaluate(() => {
  const k = kitten, b = k.brain, p = b.pos, K = k.kitchen;
  return {place: k.placeId(k.place), half: K?.half, x: +p.x.toFixed(2), z: +p.z.toFixed(2), act: b.activity, mode: b.mode, perch: b.perch};
});
const picker = () => page.evaluate(() => { document.querySelector('#decor-btn').click(); const n = [...document.querySelectorAll('#place-options strong')].map(e => e.textContent); const on = document.querySelector('[data-place="living"]')?.getAttribute('aria-pressed'); document.querySelector('#decor-dialog').close(); return {n, on}; });
await page.evaluate(() => { kitten.pet.energy = 80; });

let p = await picker();
check('the picker lists the living room', p.n.includes('The living room'), p.n.join(', '));
await page.evaluate(() => { document.querySelector('#decor-btn').click(); });
await step(20); await shot('picker');
await page.evaluate(() => document.querySelector('#decor-dialog').close());

// Call her from the study.
await page.evaluate(() => kitten.goTo('room')); await step(30);
await page.evaluate(() => document.querySelector('#decor-btn').click());
await page.evaluate(() => document.querySelector('[data-place="living"]').click());
let s = await state(), f = 0;
while (f < 6000 && !(s.place === 'kitchen' && s.half === 'living' && s.act === 'sit' && s.mode === 'idle')) { await step(10); f += 10; s = await state(); }
check('called from the study, she walks to the living room', s.place === 'kitchen' && s.half === 'living' && s.z > 9.8, `${f} frames, ${JSON.stringify(s)}`);
p = await picker();
check('the picker marks the living room', p.on === 'true');
await page.evaluate(() => { kitten.brain.nextIdle = kitten.clock + 1e6; kitten.CAMERA_VIEWS.room(); }); await step(60); await shot('called');

// Go now: to the kitchen, then to the living room.
await page.evaluate(() => { document.querySelector('#decor-btn').click(); document.querySelector('[data-go="kitchen"]').click(); }); await step(30);
s = await state();
check('Go now to the kitchen', s.place === 'kitchen' && s.half === 'kitchen', JSON.stringify(s));
await page.evaluate(() => { document.querySelector('#decor-btn').click(); document.querySelector('[data-go="living"]').click(); }); await step(60);
s = await state();
check('Go now to the living room', s.place === 'kitchen' && s.half === 'living' && s.z > 9.8, JSON.stringify(s));
await shot('go-now');
// And from the study.
await page.evaluate(() => kitten.goTo('room')); await step(30);
await page.evaluate(() => { document.querySelector('#decor-btn').click(); document.querySelector('[data-go="living"]').click(); }); await step(60);
s = await state();
check('Go now from the study', s.place === 'kitchen' && s.half === 'living', JSON.stringify(s));
check('no page errors', !errors.length, errors.slice(0, 3).join(' | '));
await close();
console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
