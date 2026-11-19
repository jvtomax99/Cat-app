// Phase 20, one home: she walks between the study and the kitchen through
// the doorway. Checks the phase's "Done when": no jump as she changes room
// (her house position and the camera's), Mochi mode follows her across,
// Explore glides into the new room with a note, Feed in the study sends her
// to the kitchen bowl, the room picker calls her, a reload keeps her room,
// and she goes to the other room on her own. Stills in OUT.
//   node tools/qa/house-walk.mjs      (OUT)
import {open} from './lib.mjs'; import fs from 'node:fs';
const OUT = process.env.OUT || 'qa-out/house-walk';
fs.mkdirSync(OUT, {recursive: true});
const checks = [];
const ok = (name, pass, info = '') => { checks.push(pass); console.log(pass ? 'ok  ' : 'FAIL', name, info); };
const {page, step, close} = await open({seed: 2, width: 390, height: 844});
const errors = []; page.on('pageerror', e => errors.push(e.message));
await page.evaluate(() => { const s = document.querySelector('#sheet'); if (s) { s.style.pointerEvents = 'none'; s.style.visibility = 'hidden'; } });
await step(10);
const shot = name => page.locator('canvas').first().screenshot({path: `${OUT}/${name}.png`});
// Where she and the camera are in the house (house.js), whichever room she's in.
const snap = () => page.evaluate(() => {
  const H = kitten.house, id = kitten.placeId(kitten.place), b = kitten.brain, c = kitten.camera.position;
  const p = H.toHouse(id, b.pos), cp = H.toHouse(id, c);
  return {id, p: [p.x, p.z], c: [cp.x, c.y, cp.z], act: b.activity, mode: b.mode, walk: !!b.target, trip: b.toRoom || null, view: kitten.view.mode, toast: document.querySelector('#toast').textContent};
});
// Steps until done(s) (or max), measuring her and the camera between samples (.2 s).
async function watch(name, done, max = 500) {
  let prev = await snap(), r = {herJump: 0, camAtSwitch: 0, camWorst: 0, camLater: 0, switches: 0, end: prev, normal: 0}, after = -1;
  for (let i = 0; i < max; i++) {
    await step(4);
    const s = await snap();
    const dp = Math.hypot(s.p[0] - prev.p[0], s.p[1] - prev.p[1]), dc = Math.hypot(s.c[0] - prev.c[0], s.c[1] - prev.c[1], s.c[2] - prev.c[2]);
    if (s.id !== prev.id) { after = 0; r.switches++; r.herJump = Math.max(r.herJump, dp - r.normal); r.camAtSwitch = Math.max(r.camAtSwitch, dc); await shot(`${name}-switch`); }
    else r.normal = dp;
    // (Up to 6 s after the change of room counts as the crossing; later, the
    // camera's usual dodging round furniture is only reported.)
    if (after >= 0 && ++after > 30) r.camLater = Math.max(r.camLater, dc);
    else if (dc > r.camWorst) { r.camWorst = dc; r.camWhere = `step ${i}, her ${s.p.map(f)}, camera ${s.c.map(f)} (was ${prev.c.map(f)}), ${s.id}`; }
    if (i === 60) await shot(`${name}-walking`);
    prev = r.end = s;
    if (await page.evaluate(done)) break;
  }
  return r;
}
const f = n => n.toFixed(2);

// 1. Mochi mode: study to kitchen, the camera with her.
await page.evaluate(() => kitten.CAMERA_VIEWS.follow());
await step(30);
await page.evaluate(() => kitten.walkToRoom('kitchen', () => kitten.walkTo(new kitten.brain.pos.constructor(2.5, 0, 3.2))));
let r = await watch('1-mochi-to-kitchen', () => kitten.placeId(kitten.place) === 'kitchen' && !kitten.brain.target && !kitten.brain.toRoom);
await shot('1-mochi-in-kitchen');
ok('Mochi mode: she walks study to kitchen', r.end.id === 'kitchen' && r.switches === 1, `in the ${r.end.id}, ${r.switches} change of room`);
ok('no jump as she changes room', r.herJump < .1, `her house position jumped ${f(r.herJump)} m beyond her walking step`);
ok('the camera comes with her, no jump', r.end.view === 'follow' && r.camAtSwitch < .4 && r.camWorst < 1.2, `mode ${r.end.view}; camera moved ${f(r.camAtSwitch)} m at the change, at most ${f(r.camWorst)} m per .2 s (${r.camWhere}); later, round the furniture, at most ${f(r.camLater)} m`);

// 2. Explore: back to the study; the view glides into the study, with a note.
await page.evaluate(() => document.querySelector('[data-cam="room"]')?.click());
await step(40);
await page.evaluate(() => kitten.walkToRoom('room', () => kitten.walkTo(new kitten.brain.pos.constructor(0, 0, .3))));
r = await watch('2-explore-to-study', () => kitten.placeId(kitten.place) === 'room' && !kitten.brain.target && !kitten.brain.toRoom);
await step(80); r.end = await snap(); await shot('2-explore-in-study');
const camInStudy = await page.evaluate(() => kitten.house.pastDoor(kitten.house.DOORS[0].room, kitten.camera.position) < 0);
ok('Explore: she walks back to the study', r.end.id === 'room' && r.switches === 1 && r.herJump < .1, `in the ${r.end.id}; jumped ${f(r.herJump)} m`);
ok('Explore: a note says where she went', /went to the study/.test(r.end.toast), `"${r.end.toast}"`);
ok('Explore: the view goes into her room', camInStudy && r.end.view !== 'follow', `camera in the study: ${camInStudy}, mode ${r.end.view}`);

// 3. Feed in the study: she goes to the kitchen bowl and eats.
await page.evaluate(() => { kitten.pet.food = 20; kitten.brain.mode = 'idle'; kitten.act('feed'); });
let ate = false;
r = await watch('3-feed', () => kitten.brain.activity === 'eat', 600);
ate = r.end.act === 'eat';
await shot('3-eating');
ok('Feed in the study: she eats at the kitchen bowl', ate && r.end.id === 'kitchen' && r.herJump < .1, `${r.end.act} in the ${r.end.id}`);
await step(200);

// 4. The room picker calls her (no teleport).
await page.evaluate(() => { document.querySelector('#decor-btn').click(); document.querySelector('#place-options [data-place="study"]').click(); });
await step(2);
const called = await snap();
ok('the picker calls her: she is still in the kitchen, walking', called.id === 'kitchen' && called.trip === 'room' && /Calling/.test(called.toast), `in the ${called.id}, on her way to ${called.trip}; "${called.toast}"`);
r = await watch('4-called', () => kitten.placeId(kitten.place) === 'room' && !kitten.brain.target && !kitten.brain.toRoom);
ok('called, she walks to the study', r.end.id === 'room' && r.herJump < .1, `in the ${r.end.id}; jumped ${f(r.herJump)} m`);

// 5. Her own trip: in time she goes to the other room by herself.
await page.evaluate(() => Object.assign(kitten.brain, {nextTrip: 0, nextIdle: 0, nextShow: 1e9, mode: 'idle'}));
let own = false;
for (let i = 0; i < 300 && !own; i++) {
  await step(10);
  own = await page.evaluate(() => { const b = kitten.brain; if (b.toRoom || kitten.placeId(kitten.place) === 'kitchen') return true; if (b.mode === 'idle' && b.nextIdle > kitten.clock + 1) b.nextIdle = kitten.clock + .5; b.nextTrip = Math.min(b.nextTrip, kitten.clock); return false; });
}
ok('she goes to the other room on her own', own);
await watch('5-own-trip', () => !kitten.brain.toRoom && !kitten.brain.target, 400);

// 6. Reload: she's where she was.
const before = (await snap()).id;
await page.reload();
await page.waitForFunction(() => window.kitten && kitten.cat.ready && kitten.cat.motion, null, {timeout: 900000});
const after = await page.evaluate(() => kitten.placeId(kitten.place));
ok('a reload keeps her room', after === before, `${before} before, ${after} after`);

ok('no page errors', errors.length === 0, errors.slice(0, 3).join('; '));
await close();
console.log(checks.filter(Boolean).length + ' of ' + checks.length + ' passed');
process.exitCode = checks.every(Boolean) ? 0 : 1;
