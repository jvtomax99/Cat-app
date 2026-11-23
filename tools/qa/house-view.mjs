// Phase 21 step 5, the House view: the House button opens it on the whole
// house from outside (in the clear part of the picture), only the outside
// drawn (rooms, her and her things not); turning and zooming work; a tap
// from outside looks in on her floor; Explore and Mochi bring the room
// back; it opens round whichever room she's in; by night the windows glow.
// Part two, looking inside: Upstairs/Downstairs show that floor's rooms
// (roofs and shell walls off, her only on her floor, draw calls under 1.5
// times the kitchen's Room view), all seven rooms open their card, Go now
// and Call her work from it, and leaving puts every room back. Stills to OUT.
//   node tools/qa/house-view.mjs      (OUT, W, H, SEED)
import {open} from './lib.mjs'; import fs from 'node:fs';
const OUT = process.env.OUT || 'qa-out/house-view';
fs.mkdirSync(OUT, {recursive: true});
const {page, step, close} = await open({seed: +(process.env.SEED || 4), width: +(process.env.W || 390), height: +(process.env.H || 844)});
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e)));
const shot = n => page.screenshot({path: `${OUT}/${n}.png`});
const results = [];
const check = (name, ok, info = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${info ? ': ' + info : ''}`); };
const info = () => page.evaluate(() => {
  const k = kitten, r = k.renderer.info.render, c = k.camera;
  return {mode: k.view.mode, calls: r.calls, layers: c.layers.mask, far: Math.round(c.far), dist: +k.view.dist.toFixed(1), pressed: document.querySelector('[data-cam="house"]').getAttribute('aria-pressed'), place: k.placeId(k.place)};
});
const press = cam => page.evaluate(cam => document.querySelector(`[data-cam="${cam}"]`).click(), cam);

check('the House button is there', await page.evaluate(() => !!document.querySelector('[data-cam="house"]')));
await page.evaluate(() => kitten.CAMERA_VIEWS.room()); await step(30);
const roomCalls = (await info()).calls;
await press('house'); await step(30);
let s = await info();
check('the House button opens the House view', s.mode === 'house' && s.pressed === 'true' && s.layers === 4, JSON.stringify(s));
check('only the outside is drawn: few draw calls', s.calls < 40, `${s.calls} (the study's Room view: ${roomCalls})`);
await shot('house-front');
// The whole house in the clear part of the picture.
const fit = await page.evaluate(() => {
  const k = kitten, sh = k.shell.group, box = new (k.camera.position.constructor === undefined ? Object : Object)(); 
  const pts = []; sh.traverse(o => { if (o.isMesh && o.name !== 'shell-sand' && o.name !== 'shell-sea' && o.name !== 'shell-paving') { o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox; for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) pts.push([x, y, z]); } });
  const v = k.camera.position.clone(); let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
  for (const [x, y, z] of pts) { v.set(x, y, z); sh.localToWorld(v); v.project(k.camera); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
  return {x0: +x0.toFixed(2), x1: +x1.toFixed(2), y0: +y0.toFixed(2), y1: +y1.toFixed(2)};
});
check('the whole house fits the picture', fit.x0 > -1 && fit.x1 < 1 && fit.y1 < 1 && fit.y0 > -1, JSON.stringify(fit));
// Turning and zooming.
await page.evaluate(() => { kitten.orbit(-260, 0); }); await step(40); await shot('house-turned');
await page.evaluate(() => { kitten.orbit(-260, -40); }); await step(40); await shot('house-back');
await page.evaluate(() => { kitten.zoomBy(.55); }); await step(40);
s = await info();
check('zooming in stays in the House view', s.mode === 'house', JSON.stringify(s));
await shot('house-close');
await page.evaluate(() => { kitten.orbit(0, 200); }); await step(40); await shot('house-above');
// A tap from outside looks in, on her floor.
const box = await page.locator('#scene').boundingBox();
await page.evaluate(() => kitten.CAMERA_VIEWS.house()); await step(20);
await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2); await step(20);
s = await page.evaluate(() => ({mode: kitten.view.mode, floor: kitten.view.floor}));
check('a tap from outside looks in on her floor', s.mode === 'house' && s.floor === 'down', JSON.stringify(s));
await page.evaluate(() => kitten.CAMERA_VIEWS.house()); await step(20);
// Night.
await page.evaluate(() => { kitten.CAMERA_VIEWS.house(); kitten.setNight(true); }); await step(120); await shot('house-night');
await page.evaluate(() => kitten.setNight(false)); await step(60);
// Back to the room.
await press('room'); await step(30);
s = await info();
check('Explore brings the room back', s.mode === 'room' && s.layers === 1 && s.far === 60 && s.pressed === 'false', JSON.stringify(s));
await shot('back-explore');
await press('house'); await step(20); await press('follow'); await step(40);
s = await info();
check('Mochi brings her back', s.mode === 'follow' && s.layers === 1, JSON.stringify(s));
await shot('back-mochi');
// From another room: the house stands where it should round her.
await page.evaluate(() => kitten.goTo('bedroom')); await step(30);
await press('house'); await step(30);
s = await info();
check('from the bedroom too', s.mode === 'house' && s.place === 'hall', JSON.stringify(s));
await shot('house-from-bedroom');
await press('room'); await step(20);

// Part two: looking inside.
await page.evaluate(() => kitten.goTo('kitchen')); await step(30);
await page.evaluate(() => kitten.CAMERA_VIEWS.room()); await step(30);
const kitchenCalls = (await info()).calls;
await page.evaluate(() => document.querySelectorAll('.hud').forEach(e => e.style.visibility = ''));
const floorsShown = () => page.evaluate(() => getComputedStyle(document.querySelector('.house-floors')).display !== 'none');
check('no floor buttons outside the House view', !(await floorsShown()));
await press('house'); await step(20);
check('the floor buttons show in the House view', await floorsShown());
const floor = async f => {
  await page.evaluate(f => document.querySelector(`[data-floor="${f}"]`).click(), f); await step(40);
  return page.evaluate(() => {
    const k = kitten, sh = k.shell.group.children, vis = n => sh.find(m => m.name === n)?.visible;
    return {floor: k.view.floor, calls: k.renderer.info.render.calls, layers: k.camera.layers.mask, study: k.room.group.visible, kitchen: k.kitchen.group.visible, bedroom: k.hall.bedroom.group.visible, bathroom: k.hall.bathroom.group.visible,
      roof: vis('shell-slate'), walls: vis('shell-plaster'), sand: vis('shell-sand'), her: k.cat.root.visible, cut: k.studyCut.constant, sky: k.room.glass.visible, pressed: document.querySelector('[data-floor="' + k.view.floor + '"]')?.getAttribute('aria-pressed')};
  });
};
let d = await floor('down');
check('Downstairs: the study, kitchen and hall, not upstairs', d.floor === 'down' && d.study && d.kitchen && !d.bedroom && !d.bathroom && d.layers === 5 && d.pressed === 'true', JSON.stringify(d));
check('Downstairs: roofs and shell walls off, the ground on, the study cut at 10, no window sheet', !d.roof && !d.walls && d.sand && d.cut === 10 && !d.sky, JSON.stringify(d));
check('Downstairs: draw calls under 1.5 times the kitchen', d.calls < kitchenCalls * 1.5, `${d.calls} (kitchen ${kitchenCalls})`);
check('she is drawn on her floor', d.her);
await shot('inside-down');
let u = await floor('up');
check('Upstairs: landing, bedroom and bathroom, not the rooms under them', u.floor === 'up' && !u.study && !u.kitchen && u.bedroom && u.bathroom, JSON.stringify(u));
check('Upstairs: draw calls under 1.5 times the kitchen', u.calls < kitchenCalls * 1.5, `${u.calls} (kitchen ${kitchenCalls})`);
check('she is not drawn on the other floor', !u.her);
await shot('inside-up');
// Every room's card, by tapping the middle of it.
const MIDS = {study: [0, 2.6, 'down'], kitchen: [-12, -2, 'down'], living: [-26, -2, 'down'], hall: [-12, 9.2, 'down'], landing: [-12, 9.2, 'up'], bedroom: [-12, -3, 'up'], bathroom: [0, 1.5, 'up']};
const NAMES = {study: 'The study', kitchen: 'The kitchen', living: 'The living room', hall: 'The hall', landing: 'The landing', bedroom: 'The bedroom', bathroom: 'The bathroom'};
const tapRoom = async id => {
  const [x, z, f] = MIDS[id];
  if (await page.evaluate(() => kitten.view.floor) !== f) await floor(f);
  const pt = await page.evaluate(([x, z, f]) => {
    const k = kitten, p = k.house.convert({x, z}, 'room', k.placeId(k.place)), v = k.camera.position.clone().set(p.x, f === 'up' ? k.hall.up : 0, p.z).project(k.camera), r = document.querySelector('#scene').getBoundingClientRect();
    return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height];
  }, [x, z, f]);
  await page.evaluate(() => { document.querySelector('#house-card').hidden = true; });
  await page.mouse.click(...pt); await step(10);
  return page.evaluate(() => { const c = document.querySelector('#house-card'); return {shown: !c.hidden, room: c.dataset.room, name: c.querySelector('strong').textContent}; });
};
const cards = [];
for (const id of Object.keys(MIDS)) { const c = await tapRoom(id); cards.push(c.shown && c.room === id && c.name === NAMES[id] ? id : `${id}->${JSON.stringify(c)}`); }
check('all seven rooms open their card', cards.every(c => !c.includes('->')), cards.join(', '));
await shot('inside-card');
// Go now: into that room's Room view.
await tapRoom('living');
await page.evaluate(() => document.querySelector('[data-house-go]').click()); await step(40);
s = await page.evaluate(() => ({mode: kitten.view.mode, half: kitten.kitchen.half, place: kitten.placeId(kitten.place), layers: kitten.camera.layers.mask, cut: kitten.studyCut.constant, her: kitten.cat.root.visible, floor: kitten.kitchen.floor.visible, card: document.querySelector('#house-card').hidden}));
check('Go now opens that room', s.mode === 'room' && s.place === 'kitchen' && s.half === 'living' && s.layers === 1 && s.card, JSON.stringify(s));
check('leaving puts the rooms back', s.cut === 10000 && s.her && s.floor, JSON.stringify(s));
await shot('inside-go-now');
// Call her: the House view stays, she sets off.
await press('house'); await step(20);
await tapRoom('study');
await page.evaluate(() => document.querySelector('[data-house-call]').click()); await step(20);
s = await page.evaluate(() => ({mode: kitten.view.mode, floor: kitten.view.floor, going: !!(kitten.brain.toRoom || kitten.brain.target)}));
check('Call her keeps the House view and she sets off', s.mode === 'house' && s.going, JSON.stringify(s));
await step(200);
s = await page.evaluate(() => ({big: kitten.builtRoomsFloors(), shadow: kitten.sunShadow, place: kitten.placeId(kitten.place)}));
check('after she walks through a doorway, no big floor sheet and no sun shadow', !s.big && s.shadow === 0, JSON.stringify(s));
await shot('inside-call');
await press('room'); await step(20);
s = await page.evaluate(() => ({mode: kitten.view.mode, floors: document.querySelectorAll('[data-floor][aria-pressed="true"]').length, cls: document.body.classList.contains('house-view')}));
check('Explore leaves the inside view', s.mode === 'room' && !s.floors && !s.cls, JSON.stringify(s));
check('no page errors', !errors.length, errors.slice(0, 3).join(' | '));
await close();
console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
