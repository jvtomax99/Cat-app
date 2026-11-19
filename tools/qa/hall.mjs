// Phase 21, the hall: a third room, off the kitchen. She walks kitchen to
// hall through the new doorway with no jump, study to hall by way of the
// kitchen, the room picker lists and calls her to the hall, she stays on
// the hall's floor (out of the console, the bench and the stairs), a nap or
// a meal in the hall takes her back to the kitchen's place, a reload keeps
// her in the hall, and she finds her way back to her study. Stills in OUT.
//   node tools/qa/hall.mjs      (OUT)
import {open} from './lib.mjs'; import fs from 'node:fs';
const OUT = process.env.OUT || 'qa-out/hall';
fs.mkdirSync(OUT, {recursive: true});
const checks = [];
const ok = (name, pass, info = '') => { checks.push(pass); console.log(pass ? 'ok  ' : 'FAIL', name, info); };
const {page, step, close} = await open({seed: 2, width: 390, height: 844, kitchen: true});
const errors = []; page.on('pageerror', e => errors.push(e.message));
await page.evaluate(() => { const s = document.querySelector('#sheet'); if (s) { s.style.pointerEvents = 'none'; s.style.visibility = 'hidden'; } });
await step(10);
const shot = name => page.locator('canvas').first().screenshot({path: `${OUT}/${name}.png`});
const f = n => n.toFixed(2);
const snap = () => page.evaluate(() => {
  const H = kitten.house, id = kitten.placeId(kitten.place), b = kitten.brain, c = kitten.camera.position;
  const p = H.toHouse(id, b.pos), cp = H.toHouse(id, c);
  return {id, p: [p.x, p.z], own: [b.pos.x, b.pos.z], y: b.elevation, c: [cp.x, c.y, cp.z], act: b.activity, walk: !!b.target, trip: b.toRoom?.to || null, view: kitten.view.mode, toast: document.querySelector('#toast').textContent};
});
// Steps until done() (or max), measuring her and the camera between samples (.2 s).
async function watch(name, done, max = 600) {
  let prev = await snap(), r = {herJump: 0, camAtSwitch: 0, switches: 0, end: prev, normal: 0, rooms: [prev.id], offFloor: 0};
  for (let i = 0; i < max; i++) {
    await step(4);
    const s = await snap();
    const dp = Math.hypot(s.p[0] - prev.p[0], s.p[1] - prev.p[1]), dc = Math.hypot(s.c[0] - prev.c[0], s.c[1] - prev.c[1], s.c[2] - prev.c[2]);
    if (s.id !== prev.id) { r.switches++; r.rooms.push(s.id); r.herJump = Math.max(r.herJump, dp - r.normal); r.camAtSwitch = Math.max(r.camAtSwitch, dc); await shot(`${name}-switch-${r.switches}`); }
    else r.normal = dp;
    // (In the hall, on its floor: inside its walls, west of the stairs,
    // clear of the bench. On the stairs or the landing, stairs.mjs checks.)
    if (s.id === 'hall' && s.y < .05 && (s.own[0] < -5.5 || s.own[0] > -1.0 || s.own[1] > 4.45 || (s.own[1] < .6 && Math.abs(s.own[0] + 2.15) > .6))) r.offFloor++;
    prev = r.end = s;
    if (await page.evaluate(done)) break;
  }
  return r;
}
const settled = id => `kitten.placeId(kitten.place) === '${id}' && !kitten.brain.target && !kitten.brain.toRoom`;

// 1. The picker lists the hall and calls her there from the kitchen.
await page.evaluate(() => { document.querySelector('#decor-btn').click(); });
const places = await page.evaluate(() => [...document.querySelectorAll('#place-options [data-place]')].map(b => b.dataset.place));
ok('the room picker lists the hall', places.join() === 'study,kitchen,hall,landing', places.join());
await page.evaluate(() => document.querySelector('#place-options [data-place="hall"]').click());
await step(2);
const called = await snap();
ok('called, she is still in the kitchen, walking', called.id === 'kitchen' && called.trip === 'hall' && /Calling .* to the hall/.test(called.toast), `in the ${called.id}, on her way to ${called.trip}; "${called.toast}"`);
let r = await watch('1-to-hall', new Function(`return ${settled('hall')}`));
await step(80); await shot('1-in-hall');
ok('she walks kitchen to hall through the doorway', r.end.id === 'hall' && r.switches === 1, `in the ${r.end.id}, ${r.switches} change of room`);
// (In the Room view the camera sweeps round into the new room, as at the
// study's doorway: reported, not judged. house-walk.mjs judges Mochi mode.)
ok('no jump as she changes room', r.herJump < .1, `her house position jumped ${f(r.herJump)} beyond her step; the Room view's camera moved ${f(r.camAtSwitch)} in .2 s`);
ok('a note says where she went', /went to the hall/.test(r.end.toast), `"${r.end.toast}"`);

// 2. What she does in the hall: on its floor, nothing breaks.
await page.evaluate(() => Object.assign(kitten.brain, {nextIdle: 0, nextShow: 1e9, nextTrip: 1e9, mode: 'idle'}));
const did = new Set(); let off = 0;
for (let i = 0; i < 160; i++) {
  await step(10);
  const s = await page.evaluate(() => { const b = kitten.brain; if (b.mode === 'idle' && b.nextIdle > kitten.clock + 1.5) b.nextIdle = kitten.clock + .5; return {id: kitten.placeId(kitten.place), x: b.pos.x, z: b.pos.z, act: b.activity, walk: !!b.target}; });
  if (s.id !== 'hall') break;
  did.add(s.walk ? 'walk' : s.act);
  if (s.x < -5.5 || s.x > 1.0 || s.z > 4.45 || (s.z < .6 && Math.abs(s.x + 2.15) > .6)) off++;
  if (i === 60) await shot('2-hall-life');
}
ok('in the hall she keeps to its floor', off === 0, `${off} samples off it; she did: ${[...did].join(', ')}`);
ok('she is still in the hall after pottering about', (await snap()).id === 'hall');

// 3. Hungry in the hall: she eats at the kitchen bowl.
await page.evaluate(() => { Object.assign(kitten.brain, {nextIdle: 1e9, mode: 'idle'}); kitten.pet.food = 20; kitten.act('feed'); });
r = await watch('3-feed', () => kitten.brain.activity === 'eat', 700);
await shot('3-eating');
ok('Feed in the hall: she eats at the kitchen bowl', r.end.act === 'eat' && r.end.id === 'kitchen' && r.herJump < .1, `${r.end.act} in the ${r.end.id}`);
await step(240);

// 4. From the study to the hall: by way of the kitchen, two doorways.
await page.evaluate(() => kitten.walkToRoom('room'));
await watch('4-to-study', new Function(`return ${settled('room')}`));
await page.evaluate(() => kitten.callToRoom('hall'));
r = await watch('4-study-to-hall', new Function(`return ${settled('hall')}`), 900);
await step(60); await shot('4-in-hall');
ok('study to hall: through the kitchen, two doorways', r.end.id === 'hall' && r.rooms.join() === 'room,kitchen,hall', r.rooms.join(' > '));
ok('no jump at either doorway', r.herJump < .1, `jumped ${f(r.herJump)}`);

// 5. A reload keeps her in the hall.
await page.reload();
await page.waitForFunction(() => window.kitten && kitten.cat.ready && kitten.cat.motion && kitten.kitchen, null, {timeout: 900000});
ok('a reload keeps her in the hall', await page.evaluate(() => kitten.placeId(kitten.place)) === 'hall');
await page.waitForTimeout(3000);
await page.evaluate(() => { Object.assign(kitten.brain, {nextIdle: 1e9, nextShow: 1e9, nextBird: 1e9, nextVacuum: 1e9, vacInit: true}); const s = document.querySelector('#sheet'); if (s) { s.style.pointerEvents = 'none'; s.style.visibility = 'hidden'; } });
await step(20); await shot('5-reloaded');

// 6. Bedtime in the hall: she goes to her bed in the kitchen's place.
await page.evaluate(() => { kitten.brain.mode = 'idle'; kitten.act('sleep'); });
r = await watch('6-bedtime', () => kitten.brain.activity === 'sleep', 900);
await shot('6-asleep');
ok('Sleep in the hall: she goes to her bed', r.end.act === 'sleep' && r.end.id === 'kitchen', `${r.end.act} in the ${r.end.id}`);
await page.evaluate(() => kitten.act('sleep'));
await step(120);

// 7. And home again: from the kitchen's place to her study.
await page.evaluate(() => kitten.callToRoom('room'));
r = await watch('7-home', new Function(`return ${settled('room')}`), 900);
ok('back to the study', r.end.id === 'room' && r.herJump < .1, `in the ${r.end.id}`);

ok('no page errors', errors.length === 0, errors.slice(0, 3).join('; '));
await close();
console.log(checks.filter(Boolean).length + ' of ' + checks.length + ' passed');
process.exitCode = checks.every(Boolean) ? 0 : 1;
