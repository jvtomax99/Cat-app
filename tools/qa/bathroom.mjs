// Phase 21 step 4, the bathroom: the picker lists it; called from the
// study she walks there herself (kitchen, hall, up the stairs, through the
// bedroom and its east door) and keeps out of the furniture; a drink from
// the tall tap (the water runs only while she drinks); the toilet roll
// (the paper comes down, and rolls back up once she's gone); a nap on the
// mat; random walks across its floor, and to the bedroom and the landing,
// go round everything; "Go now" opens it; a save there opens in the hall;
// she walks home to the study. Stills to OUT.
//   node tools/qa/bathroom.mjs      (OUT, NIGHT, SEED)
import {open} from './lib.mjs'; import fs from 'node:fs';
const OUT = process.env.OUT || 'qa-out/bathroom';
fs.mkdirSync(OUT, {recursive: true});
const {page, step, close} = await open({seed: +(process.env.SEED || 4), width: 390, height: 844, night: +(process.env.NIGHT || 0)});
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e)));
await page.evaluate(() => { const s = document.querySelector('#sheet'); if (s) { s.style.pointerEvents = 'none'; s.style.visibility = 'hidden'; } });
const shot = n => page.locator('canvas').first().screenshot({path: `${OUT}/${n}.png`});
const results = [];
const check = (name, ok, info = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${info ? ': ' + info : ''}`); };
// Where she is; which furniture patch she's in, if any (on the floor, upstairs).
const state = () => page.evaluate(() => {
  const k = kitten, b = k.brain, h = k.hall, p = b.pos, A = h?.bathroom;
  const up = k.placeId(k.place) === 'hall' && h.level === 'up';
  const inBath = up && p.x > 7.6 && p.z < -.45, inBed = up && !inBath && p.z < -1.2;
  const keep = inBath ? A.keep : inBed ? h.bedroom.keep : [];
  const hit = !b.perch && !b.jump ? keep.findIndex(r => p.x > r.x0 + .05 && p.x < r.x1 - .05 && p.z > r.z0 + .05 && p.z < r.z1 - .05) : -1;
  return {place: k.placeId(k.place), level: h?.level, wing: h?.wing, x: +p.x.toFixed(2), z: +p.z.toFixed(2), y: +b.elevation.toFixed(2), act: b.activity, perch: b.perch, mode: b.mode, inBath, hit: hit >= 0 ? `${inBath ? 'bath' : 'bed'}${hit}` : null, water: A?.stream.visible, paper: A ? +A.paper.toFixed(2) : 0};
});
// Step until `done(state)`, or the frame limit; furniture hits on the way,
// and whether the water ran while she wasn't drinking.
async function until(done, max, every = 10) {
  let s = await state(), frames = 0;
  const hits = [], dry = [];
  while (frames < max && !done(s)) {
    await step(every); frames += every; s = await state();
    if (s.hit) hits.push(`${s.hit}@${s.x},${s.z}`);
    if (s.water && s.act !== 'drink') dry.push(`${s.act}@${frames}`);
  }
  return {s, frames, hits, dry};
}

await page.evaluate(() => { kitten.pet.energy = 80; });
// The picker.
const names = await page.evaluate(() => { document.querySelector('#decor-btn').click(); const n = [...document.querySelectorAll('#place-options strong')].map(e => e.textContent); document.querySelector('#decor-dialog').close(); return n; });
check('the picker lists the bathroom', names.includes('The bathroom'), names.join(', '));

// From the study, by herself.
await page.evaluate(() => kitten.goTo('room'));
await step(30);
await page.evaluate(() => kitten.callToBathroom());
let r = await until(s => s.inBath && s.act === 'sit' && s.mode === 'idle', 12000);
check('called from the study, she walks to the bathroom', r.s.inBath && r.s.y > 9.95 && r.s.wing === 'bathroom', `${r.frames} frames, ${JSON.stringify(r.s)}`);
check('on the way she keeps out of the bedroom\'s and the bathroom\'s furniture', !r.hits.length, r.hits.slice(0, 5).join(' '));
check('the picker marks the bathroom', await page.evaluate(() => { document.querySelector('#decor-btn').click(); const b = document.querySelector('[data-place="bathroom"]'); const on = b?.getAttribute('aria-pressed') === 'true'; document.querySelector('#decor-dialog').close(); return on; }));
// (From here on she does only what she's asked: no idle wandering off.)
const hold = () => page.evaluate(() => { kitten.brain.nextIdle = kitten.clock + 1e6; kitten.brain.nextShow = kitten.clock + 1e6; });
await hold();
await page.evaluate(() => kitten.CAMERA_VIEWS.room()); await step(60); await shot('arrived');

// A drink from the tap: up on the counter; the water runs only while she drinks.
await page.evaluate(() => { kitten.pet.water = 50; kitten.tapDrink(); });
r = await until(s => s.act === 'drink', 2500);
const before = r.dry.length;
check('up on the counter, she drinks from the tap', r.s.perch === 'vanity' && r.s.act === 'drink' && Math.abs(r.s.y - 12.15) < .1, JSON.stringify(r.s));
check('the water runs while she drinks', r.s.water === true);
await step(30); await shot('tap');
r = await until(s => s.act !== 'drink', 600);
const r2 = await until(() => false, 120);
check('the water stops when she\'s done, and stayed off before', !r2.s.water && !before && !r.dry.length && !r2.dry.length, `${JSON.stringify(r2.s)} ${r.dry.concat(r2.dry).slice(0, 3)}`);

// The toilet roll: pat, pat, and the paper comes down.
await hold(); await page.evaluate(() => { kitten.setActivity('sit'); kitten.paperPlay(); });
r = await until(s => s.paper > 1.2 && s.act === 'sit', 3000);
check('she pats the roll and the paper comes down', r.s.paper > 1.2 && !r.s.perch && r.s.x > 14.9, JSON.stringify(r.s));
check('getting there she kept out of the furniture', !r.hits.length, r.hits.slice(0, 5).join(' '));
await step(20); await shot('paper');
const kept = (await until(() => false, 200)).s.paper;
check('while she stays by it, it stays down', kept > 1.1, `${kept}`);

// A nap on the mat (and once she's gone from the roll, it rolls back up).
await hold(); await page.evaluate(() => { kitten.setActivity('sit'); kitten.matNap(); });
r = await until(s => s.act === 'catnap', 2500);
const M = await page.evaluate(() => { const L = kitten.hall.bathroom.layout().matSpot.at; return {x: L.x, z: L.z}; });
check('a nap on the bath mat', r.s.act === 'catnap' && Math.hypot(r.s.x - M.x, r.s.z - M.z) < .4 && Math.abs(r.s.y - 10) < .05, JSON.stringify(r.s));
check('getting there she kept out of the furniture', !r.hits.length, r.hits.slice(0, 5).join(' '));
const rolled = await until(s => s.paper === 0, 1200);
check('the paper rolls back up once she\'s gone', rolled.s.paper === 0, `${rolled.frames} frames, ${rolled.s.paper}`);
await shot('mat');

// Random walks: across the bathroom, and out to the bedroom and the landing.
const walks = await page.evaluate(() => {
  const h = kitten.hall, A = h.bathroom, B = h.bedroom, V = kitten.cat.root.position.constructor, bad = [];
  // (Up to .12 into a patch's margin is fine: a corner she's standing on; the margins are .4 to .65.)
  const into = (K, p) => K.some(r => p.x > r.x0 + .12 && p.x < r.x1 - .12 && p.z > r.z0 + .12 && p.z < r.z1 - .12);
  const wall = p => (p.x > 6.4 && p.x < 8.1 && Math.abs(p.z - A.doorSpot.z) > .9) || (p.z > -.6 && p.z < -.3 && Math.abs(p.x - -4.6) > .9);
  for (let i = 0; i < 400; i++) {
    const a = A.randomFloorPoint(), b = i % 4 === 1 ? B.randomFloorPoint() : i % 4 === 2 ? new V(-5 + Math.random() * 4, 0, 1 + Math.random() * 3) : A.randomFloorPoint();
    const ends = i % 8 === 3 ? [b, a] : [a, b];
    const pts = [ends[0], ...h.route(ends[0], ends[1])]; if (pts.length === 1) pts.push(ends[1]);
    for (let j = 1; j < pts.length; j++) for (let t = 0; t <= 1; t += .02) {
      const p = pts[j - 1].clone().lerp(pts[j], t);
      if ((p.x > 7.6 && p.z < -.45 && into(A.keep, p)) || (p.x < 7 && p.z < -1.2 && into(B.keep, p)) || wall(p)) { bad.push(`${ends[0].x.toFixed(1)},${ends[0].z.toFixed(1)}>${ends[1].x.toFixed(1)},${ends[1].z.toFixed(1)} at ${p.x.toFixed(1)},${p.z.toFixed(1)}`); j = 99; break; }
    }
  }
  const L = A.layout(), spots = [L.home, L.sunSpot, L.perches.vanity.base, L.rollSpot.at, L.matSpot.at, A.doorSpot].filter(p => into(A.keep, p)).length;
  return {bad, spots};
});
check('400 routes from the bathroom go round the furniture and through the doors', !walks.bad.length, walks.bad.slice(0, 5).join(' '));
check('her spots in the bathroom are on free floor', walks.spots === 0, `${walks.spots} inside`);

// "Go now" from downstairs opens the bathroom with her in it; the save
// keeps the hall (a save there opens in the hall).
await page.evaluate(() => { kitten.setActivity('sit'); kitten.goTo('kitchen'); });
await step(20);
await page.evaluate(() => kitten.goTo('bathroom'));
await step(30);
const go = await state();
check('"Go now" opens the bathroom', go.inBath && go.wing === 'bathroom' && go.y > 9.95, JSON.stringify(go));
const saved = await page.evaluate(() => { kitten.refresh?.(); const k = Object.keys(localStorage).find(k => /mochi|pet/i.test(k) && /"place"/.test(localStorage[k])); return k ? JSON.parse(localStorage[k]).place : kitten.pet.place; });
check('a save in the bathroom keeps the hall', saved === 'hall', `${saved}`);

// Home to the study.
await page.evaluate(() => { kitten.setActivity('sit'); kitten.walkToRoom('room', () => kitten.setActivity('sit', 30)); });
r = await until(s => s.place === 'room' && s.act === 'sit' && s.mode === 'idle', 12000);
check('she walks home to the study', r.s.place === 'room' && r.s.y < .1, `${r.frames} frames, ${JSON.stringify(r.s)}`);
check('on the way out she keeps out of the furniture', !r.hits.length, r.hits.slice(0, 5).join(' '));
check('no page errors', !errors.length, errors.slice(0, 3).join(' | '));
console.log(`${results.filter(Boolean).length} of ${results.length} passed`);
await close();
