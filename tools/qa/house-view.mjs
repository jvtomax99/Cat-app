// Phase 21 step 5, the House view: the House button opens it on the whole
// house from outside (in the clear part of the picture), only the outside
// drawn (rooms, her and her things not); turning and zooming work; a tap
// does nothing; Explore and Mochi bring the room back; it opens round
// whichever room she's in; by night the windows glow. Stills to OUT.
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
// A tap does nothing.
const box = await page.locator('#scene').boundingBox();
await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2); await step(20);
check('a tap leaves the House view alone', (await info()).mode === 'house');
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
check('no page errors', !errors.length, errors.slice(0, 3).join(' | '));
await close();
console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
