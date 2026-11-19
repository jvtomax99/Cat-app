// Phase 21 step 3, the bedroom: the picker lists it; called from the
// study she walks there herself (kitchen, hall, up the stairs, through the
// landing's door) and keeps out of the furniture; a nap on the big bed, a
// sit on the window seat; random walks across its floor go round
// everything; she walks home to the study. Stills to OUT.
//   node tools/qa/bedroom.mjs      (OUT, NIGHT, SEED)
import {open} from './lib.mjs'; import fs from 'node:fs';
const OUT = process.env.OUT || 'qa-out/bedroom';
fs.mkdirSync(OUT, {recursive: true});
const {page, step, close} = await open({seed: +(process.env.SEED || 4), width: 390, height: 844, night: +(process.env.NIGHT || 0)});
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e)));
await page.evaluate(() => { const s = document.querySelector('#sheet'); if (s) { s.style.pointerEvents = 'none'; s.style.visibility = 'hidden'; } });
const shot = n => page.locator('canvas').first().screenshot({path: `${OUT}/${n}.png`});
const results = [];
const check = (name, ok, info = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${info ? ': ' + info : ''}`); };
const state = () => page.evaluate(() => {
  const k = kitten, b = k.brain, h = k.hall, p = b.pos;
  const inBed = k.placeId(k.place) === 'hall' && h.level === 'up' && p.z < -1.2;
  const hit = inBed && !b.perch && !b.jump ? h.bedroom.keep.findIndex(r => p.x > r.x0 + .05 && p.x < r.x1 - .05 && p.z > r.z0 + .05 && p.z < r.z1 - .05) : -1;
  return {place: k.placeId(k.place), level: h?.level, wing: h?.wing, x: +p.x.toFixed(2), z: +p.z.toFixed(2), y: +b.elevation.toFixed(2), act: b.activity, perch: b.perch, mode: b.mode, inBed, hit};
});
// Step until `done(state)`, or the frame limit; worst furniture hit on the way.
async function until(done, max, every = 10) {
  let s = await state(), frames = 0, hits = [];
  while (frames < max && !done(s)) { await step(every); frames += every; s = await state(); if (s.hit >= 0) hits.push(`${s.hit}@${s.x},${s.z}`); }
  return {s, frames, hits};
}

await page.evaluate(() => { kitten.pet.energy = 80; kitten.renderPlaces?.(); });
// The picker.
const names = await page.evaluate(() => { document.querySelector('#decor-btn').click(); const n = [...document.querySelectorAll('#place-options strong')].map(e => e.textContent); document.querySelector('#decor-dialog').close(); return n; });
check('the picker lists the bedroom', names.includes('The bedroom'), names.join(', '));

// From the study, by herself.
await page.evaluate(() => kitten.goTo('room'));
await step(30);
await page.evaluate(() => kitten.callToBedroom());
let r = await until(s => s.inBed && s.act === 'sit' && s.mode === 'idle', 9000);
check('called from the study, she walks to the bedroom', r.s.inBed && r.s.y > 9.95 && r.s.wing === 'bedroom', `${r.frames} frames, ${JSON.stringify(r.s)}`);
check('on the way she keeps out of the bedroom\'s furniture', !r.hits.length, r.hits.slice(0, 5).join(' '));
check('the picker marks the bedroom', await page.evaluate(() => { document.querySelector('#decor-btn').click(); const b = document.querySelector('[data-place="bedroom"]'); const on = b?.getAttribute('aria-pressed') === 'true'; document.querySelector('#decor-dialog').close(); return on; }));
await page.evaluate(() => kitten.CAMERA_VIEWS.room()); await step(60); await shot('arrived');

// A nap on the big bed.
await page.evaluate(() => kitten.bedNap());
r = await until(s => s.perch === 'bigBed' && s.act === 'catnap', 2500);
check('a nap on the big bed', r.s.perch === 'bigBed' && r.s.act === 'catnap' && Math.abs(r.s.y - 11.72) < .1, JSON.stringify(r.s));
await step(30); await shot('bed-nap');
// The window seat (down off the bed first).
await page.evaluate(() => { kitten.setActivity('sit'); kitten.seatWatch(); });
r = await until(s => s.perch === 'windowSeat' && s.act === 'sit', 2500);
check('a sit on the window seat', r.s.perch === 'windowSeat' && Math.abs(r.s.y - 11.6) < .1, JSON.stringify(r.s));
check('getting there she kept out of the furniture', !r.hits.length, r.hits.slice(0, 5).join(' '));
await step(40); await shot('window-seat');

// Random walks across the floor: every route clear of the furniture.
const walks = await page.evaluate(() => {
  const h = kitten.hall, B = h.bedroom, K = B.keep, V = kitten.cat.root.position.constructor, bad = [];
  const into = p => K.some(r => p.x > r.x0 + .01 && p.x < r.x1 - .01 && p.z > r.z0 + .01 && p.z < r.z1 - .01);
  for (let i = 0; i < 400; i++) {
    const a = B.randomFloorPoint(), b = i % 4 ? B.randomFloorPoint() : new V(-4.6, 0, 1 + Math.random() * 3);
    const pts = [a, ...h.route(a, b)]; if (pts.length === 1) pts.push(b);
    for (let j = 1; j < pts.length; j++) for (let t = 0; t <= 1; t += .02) { const p = pts[j - 1].clone().lerp(pts[j], t); if (p.z < -1.2 && into(p)) { bad.push(`${a.x.toFixed(1)},${a.z.toFixed(1)}>${b.x.toFixed(1)},${b.z.toFixed(1)}`); j = 99; break; } }
  }
  const spots = [B.layout().home, B.layout().sunSpot, B.layout().perches.bigBed.base, B.layout().perches.windowSeat.base].filter(into).length;
  return {bad, spots};
});
check('400 routes across the bedroom go round the furniture', !walks.bad.length, walks.bad.slice(0, 5).join(' '));
check('her spots in the bedroom are on free floor', walks.spots === 0, `${walks.spots} inside`);

// Home to the study.
await page.evaluate(() => { kitten.setActivity('sit'); kitten.walkToRoom('room', () => kitten.setActivity('sit', 30)); });
r = await until(s => s.place === 'room' && s.act === 'sit' && s.mode === 'idle', 9000);
check('she walks home to the study', r.s.place === 'room' && r.s.y < .1, `${r.frames} frames, ${JSON.stringify(r.s)}`);
check('no page errors', !errors.length, errors.slice(0, 3).join(' | '));
console.log(`${results.filter(Boolean).length} of ${results.length} passed`);
await close();
