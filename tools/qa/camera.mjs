// Looking around, measured (phase 16: two modes, Explore and Mochi). Zoom
// never has a dead stretch, your zoom is kept while following her, one
// finger turns, the turn goes all the way round (front walls hide), pinch and
// double tap aim at the thing under the fingers, and no drag, pinch or tap
// ever changes the mode: only the buttons do.
//   node tools/qa/camera.mjs        OUT=qa-out/camera (stills)
import {open} from './lib.mjs'; import fs from 'node:fs';
const OUT = process.env.OUT || 'qa-out/camera'; fs.mkdirSync(OUT, {recursive: true});
const {page, step, look, close} = await open({seed: 3, width: 390, height: 844});
// (On a phone the panel is a pull-up sheet over the bottom of the room: the
// checks' fingers pass through it, so a touch there can't open it and cover the room.)
await page.evaluate(() => { const s = document.querySelector('#sheet'); if (s) { s.style.pointerEvents = 'none'; s.style.visibility = 'hidden'; } kitten.sheetOpen?.(false); });
const box = await page.evaluate(() => { const r = document.querySelector('#scene, .scene').getBoundingClientRect(); return {x: r.left, y: r.top, w: r.width, h: r.height}; });
const HOME = {focus: [0, .7, -.2], yaw: 0, pitch: .3, dist: 7};
const state = () => page.evaluate(() => { const v = kitten.view, c = kitten.camera; return {mode: v.mode, camY: +c.position.y.toFixed(2), yaw: v.yaw, goalDist: v.goal.dist, dist: c.position.distanceTo(v.focus), focus: v.focus.toArray().map(x => +x.toFixed(2))}; });
const screenOf = w => page.evaluate(w => { const c = kitten.camera; c.updateMatrixWorld(); const p = new (c.position.constructor)(...w).project(c), r = document.querySelector('.scene').getBoundingClientRect(); return [r.left + (p.x + 1) / 2 * r.width, r.top + (1 - p.y) / 2 * r.height]; }, w);
const wheel = async (n, dy) => { for (let i = 0; i < n; i++) { await page.mouse.wheel(0, dy); await step(3); } };
const shot = n => page.screenshot({path: `${OUT}/${n}.png`});
const line = (name, ok, text) => console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}: ${text}`);

// 1. Zoom to the pointer: a spot on the rug, off-centre, stays under the mouse.
await look(HOME); await step(2);
// (Was [1.4, 0, .9]: off the side of a 390 px phone since the room fills the
// screen there, phase 08; this spot is still off-centre and on screen.)
const W = [.9, 0, .6];
let [x0, y0] = await screenOf(W);
await page.mouse.move(x0, y0); await shot('1a-before-zoom');
const before = await state();
await wheel(8, -120); await step(30);
let [x1, y1] = await screenOf(W); const after = await state(); await shot('1b-zoomed-at-pointer');
const drift = Math.hypot(x1 - x0, y1 - y0);
line('zoom to pointer', drift < 30 && after.dist < before.dist * .6, `spot moved ${drift.toFixed(0)} px on screen while zooming ${before.dist.toFixed(1)} m to ${after.dist.toFixed(1)} m`);

// 2. No dead stretch: zoom far out (into the walls), then three notches in.
// (Seen from the side, where the wall is a few metres behind the camera.)
await look({...HOME, yaw: 1.4}); await step(2); await page.mouse.move(box.x + box.w / 2, box.y + box.h / 2);
await wheel(40, 200); await step(30);
const out = await state();
await wheel(3, -120); await step(30);
const back = await state();
line('no dead stretch', out.dist - back.dist > .3, `zoomed out to ${out.dist.toFixed(2)} m (asked for ${out.goalDist.toFixed(2)}); three notches in moved the camera ${(out.dist - back.dist).toFixed(2)} m`);

// 3. Following her keeps your zoom.
await page.evaluate(() => document.querySelector('[data-cam="follow"]').click()); await step(40);
const c = await page.evaluate(() => { const p = kitten.cat.root.position.clone(); p.y += .25; return p.toArray(); });
const [cx, cy] = await screenOf(c); await page.mouse.move(cx, cy);
await wheel(6, -120); await step(30);
const f1 = await state(); await step(260); const f2 = await state(); await shot('3-follow-close');
line('follow keeps zoom', Math.abs(f2.dist - f1.dist) < .15 && f2.mode === 'follow', `${f1.dist.toFixed(2)} m after zooming in, ${f2.dist.toFixed(2)} m 13 s later (${f2.mode})`);

// 3b. Squeezed against a wall, closer than the nearest zoom: zooming in leaves the view where it is.
await look({focus: [-3.9, .5, 0], yaw: -1.57, pitch: .3, dist: 3}); await step(10);
// (Pointing away from her: a pinch on her goes to her, which is another check.)
{ const hp = await screenOf(await page.evaluate(() => kitten.cat.root.position.toArray()));
  const cand = [[.3, .3], [.7, .3], [.3, .7], [.7, .7]].map(([a, b]) => [box.x + box.w * a, box.y + box.h * b]);
  const far = cand.sort((u, v) => Math.hypot(v[0] - hp[0], v[1] - hp[1]) - Math.hypot(u[0] - hp[0], u[1] - hp[1]))[0];
  await page.mouse.move(far[0], far[1]); }
await wheel(3, -120); await step(10); const q = await page.evaluate(() => kitten.view.goal.focus.toArray());
line('zoom when squeezed', Math.hypot(q[0] + 3.9, q[1] - .5, q[2]) < .3, `focus now [${q.map(x => x.toFixed(2))}] (was [-3.9, .5, 0])`);

// 4. A tap on the floor: in Mochi mode she comes; in Explore she stays put.
const pos = () => page.evaluate(() => [kitten.brain.pos.x, kitten.brain.pos.z]);
const mode = () => page.evaluate(() => kitten.view.mode);
const pref = () => page.evaluate(() => localStorage.getItem('mochi-cam'));
await page.evaluate(() => document.querySelector('[data-cam="room"]').click()); await step(120);
const prefE = await pref();
// (A bare bit of floor: not the ball, a bowl or a perch.)
const SPOT = [.6, 0, 1.3];
[x0, y0] = await screenOf(SPOT);
const e0 = await pos();
await page.mouse.move(x0, y0); await page.mouse.down(); await page.mouse.up(); await step(160); const e1 = await pos();
const bm = await page.evaluate(() => kitten.brain.mode);
line('tap the floor in Explore, she stays', Math.hypot(e1[0] - e0[0], e1[1] - e0[1]) < .3 && await mode() !== 'follow' && bm === 'idle', `tapped at ${x0.toFixed(0)}, ${y0.toFixed(0)}: she moved ${Math.hypot(e1[0] - e0[0], e1[1] - e0[1]).toFixed(2)} m (${bm}), mode ${await mode()}`);
await page.evaluate(() => document.querySelector('[data-cam="follow"]').click()); await step(80);
line('the buttons are remembered', prefE === 'explore' && await pref() === 'mochi', `kept "${prefE}" after Explore, "${await pref()}" after Mochi`);
// (A spot of bare floor near her that is on the screen in her close view.)
let far4 = null;
for (const [dx, dz] of [[.9, .3], [-.9, .3], [.8, -.4], [-.8, -.4], [.6, .6], [-.6, .6]]) {
  const w = await page.evaluate(([dx, dz]) => { const p = kitten.brain.pos; return [p.x + dx, 0, p.z + dz]; }, [dx, dz]);
  [x0, y0] = await screenOf(w);
  if (x0 > 40 && x0 < 320 && y0 > 140 && y0 < 620 && !(await page.evaluate(([x, y]) => kitten.zoneUnder(x, y), [x0, y0]))) { far4 = w; break; }
}
if (!far4) { far4 = [0, 0, 0]; console.log('FAIL  no bare floor on screen near her'); }
const p0 = await pos();
await page.mouse.move(x0, y0); await page.mouse.down(); await page.mouse.up(); await step(8); await shot('4-tap-floor');
await step(240); const p1 = await pos(); await shot('4b-she-came');
line('tap the floor in Mochi, she comes', Math.hypot(p1[0] - far4[0], p1[1] - far4[2]) < .5 && await mode() === 'follow', `tapped at ${x0.toFixed(0)}, ${y0.toFixed(0)}: she was ${Math.hypot(p0[0] - far4[0], p0[1] - far4[2]).toFixed(1)} m from the spot, now ${Math.hypot(p1[0] - far4[0], p1[1] - far4[2]).toFixed(2)} m (${await mode()})`);

// 4c. One finger turns the view about what it looks at, and the view stays where you leave it.
await page.evaluate(() => document.querySelector('[data-cam="room"]').click()); await step(120);
const dragBy = async (dx, n = 6) => { const sx = box.x + box.w / 2 - dx * n / 2, sy = box.y + 330; await page.mouse.move(sx, sy); await page.mouse.down(); for (let i = 1; i <= n; i++) { await page.mouse.move(sx + i * dx, sy); await step(1); } await page.waitForTimeout(150); await page.mouse.up(); await step(40); };
const h0 = await state(); await dragBy(-20); const h1 = await state();
await step(160); const h2 = await state(); await shot('4c-turned');
line('one finger turns the view', Math.abs(h1.yaw - h0.yaw) > .5 && h1.mode === 'free' && Math.abs(h2.yaw - h1.yaw) < .03, `turned ${((h1.yaw - h0.yaw) * 57.3).toFixed(0)}° for a 120 px drag (${h0.mode} to ${h1.mode}); 8 s later it had drifted ${((h2.yaw - h1.yaw) * 57.3).toFixed(1)}°`);
// (On and on: the turn goes all the way round, and on; the camera is never
// squeezed up close on the way.)
const wrap = a => a - Math.round(a / (Math.PI * 2)) * Math.PI * 2;
const ends = async name => {
  let total = 0, last = (await state()).yaw, near = Infinity;
  for (let i = 0; i < 22; i++) { await dragBy(-40); const s = await state(); total += wrap(s.yaw - last); last = s.yaw; near = Math.min(near, s.dist); if (i === 10) await shot(`4c-${name}-turned-round`); }
  const a = await state();
  line(`${name}: the turn goes all the way round`, Math.abs(total) > Math.PI * 2 && a.mode !== 'follow' && near > 2.5, `turned ${(total * 57.3).toFixed(0)}° in all; the camera came no closer than ${near.toFixed(1)} m to what it looks at`);
};
await ends('study');

// 4d. Double tap on the floor: closer to that spot, and she stays put.
await look(HOME); await step(2);
[x0, y0] = await screenOf([.6, 0, -.8]); const q0 = await pos(); // (on a phone screen, off her)
await page.mouse.move(x0, y0); for (let i = 0; i < 2; i++) { await page.mouse.down(); await page.mouse.up(); } await step(60);
const dd = await state(); const q1 = await pos(); await shot('4d-double-tap-floor');
line('double tap the floor, look closer', dd.dist < 4 && Math.hypot(dd.focus[0] - .6, dd.focus[2] + .8) < .6 && Math.hypot(q1[0] - q0[0], q1[1] - q0[1]) < .3, `camera ${dd.dist.toFixed(1)} m from [${dd.focus}]; she moved ${Math.hypot(q1[0] - q0[0], q1[1] - q0[1]).toFixed(2)} m`);

const dbl = async (x, y) => { await page.mouse.move(x, y); for (let i = 0; i < 2; i++) { await page.mouse.down(); await page.mouse.up(); } await step(50); };
// 4e. The fireplace: a double tap goes to it; so does a pinch (see 7).
const FIRE = [3.55, .55, 1.1], SIDE = {focus: [2.5, .7, 1], yaw: -1.2, pitch: .3, dist: 5};
await look(SIDE); await step(2);
[x0, y0] = await screenOf(FIRE); await dbl(x0, y0); await step(40); const fp = await state(); await shot('4e-double-tap-fireplace');
line('double tap the fireplace', Math.hypot(fp.focus[0] - FIRE[0], fp.focus[2] - FIRE[2]) < .9 && fp.dist < 4.2 && fp.mode === 'free', `looking at [${fp.focus}] from ${fp.dist.toFixed(1)} m (fireplace at [${FIRE}]), tapped at ${x0.toFixed(0)}, ${y0.toFixed(0)}`);
// 5. Double tap on her in Explore: a close look at her; the mode stays Explore.
// (She is set in the open middle first: earlier checks may have sent her off.)
await page.evaluate(() => { kitten.brain.perch = null; kitten.brain.jump = null; kitten.brain.target = null; kitten.brain.pos.set(0, 0, .3); kitten.cat.root.position.set(0, 0, .3); kitten.brain.mode = 'idle'; }); await step(20);
await look({...HOME, dist: 6}); await step(2);
const head = await page.evaluate(() => { const p = kitten.cat.root.position.clone(); p.y += .22; return p.toArray(); });
[x0, y0] = await screenOf(head); await dbl(x0, y0); await step(40); const k = await state(); await shot('5-double-tap-her');
line('double tap, her', k.mode === 'free' && k.dist < 3 && Math.hypot(k.focus[0] - head[0], k.focus[2] - head[2]) < .6, `mode ${k.mode}, ${k.dist.toFixed(2)} m, looking at [${k.focus}]`);

// 6. Flick: the view turns on after the finger lifts.
await look(HOME); await step(2);
await page.mouse.move(box.x + 80, box.y + 300); await page.mouse.down();
for (let i = 1; i <= 6; i++) await page.mouse.move(box.x + 80 + i * 30, box.y + 300);
const g0 = await page.evaluate(() => kitten.view.goal.yaw); await page.mouse.up();
await step(30); const g1 = await page.evaluate(() => kitten.view.goal.yaw);
line('glide after a flick', Math.abs(g1 - g0) > .1, `turned ${(Math.abs(g1 - g0) * 57.3).toFixed(0)}° more after letting go`);

// 7. Two fingers: pinch keeps the spot between them; twisting turns the view.
const cdp = await page.context().newCDPSession(page);
await cdp.send('Emulation.setTouchEmulationEnabled', {enabled: true, maxTouchPoints: 5});
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', {type, touchPoints: pts.map(([x, y], id) => ({x, y, id}))});
await look(HOME); await step(2);
const P = [-.7, 0, -.6]; [x0, y0] = await screenOf(P); // (on a phone screen, off her)
const s0 = await state();
await touch('touchStart', [[x0 - 30, y0], [x0 + 30, y0]]);
for (let i = 1; i <= 10; i++) { await touch('touchMove', [[x0 - 30 - i * 8, y0], [x0 + 30 + i * 8, y0]]); await step(2); }
await touch('touchEnd', []); await step(30);
[x1, y1] = await screenOf(P); const s1 = await state(); await shot('7-pinch');
line('pinch at the fingers', Math.hypot(x1 - x0, y1 - y0) < 30 && s1.dist < s0.dist * .6, `spot moved ${Math.hypot(x1 - x0, y1 - y0).toFixed(0)} px while pinching ${s0.dist.toFixed(1)} m to ${s1.dist.toFixed(1)} m`);
// (Pinching while following her keeps following; from the whole-room view a small pinch is a small move.)
await page.evaluate(() => document.querySelector('[data-cam="follow"]').click()); await step(60);
const [hx, hy] = await page.evaluate(() => { const c = kitten.camera, p = kitten.cat.root.position.clone(); p.y += .2; p.project(c); const r = document.querySelector('.scene').getBoundingClientRect(); return [r.left + (p.x + 1) / 2 * r.width, r.top + (1 - p.y) / 2 * r.height]; });
await touch('touchStart', [[hx - 45, hy], [hx + 45, hy]]);
for (let i = 1; i <= 5; i++) { await touch('touchMove', [[hx - 45 - i * 4, hy], [hx + 45 + i * 4, hy + i]]); await step(2); }
await touch('touchEnd', []); await step(10); const pf = await state();
line('pinch while following', pf.mode === 'follow', `mode ${pf.mode}, ${pf.dist.toFixed(2)} m`);
// (Mochi mode: a pinch away from her, in or far out, still follows her.)
{ const away = [hx < 195 ? 300 : 90, hy > 420 ? 200 : 560];
  await touch('touchStart', [[away[0] - 30, away[1]], [away[0] + 30, away[1]]]);
  for (let i = 1; i <= 8; i++) { await touch('touchMove', [[away[0] - 30 - i * 6, away[1]], [away[0] + 30 + i * 6, away[1]]]); await step(2); }
  await touch('touchEnd', []); await step(20); const a1 = await state();
  for (let n = 0; n < 4; n++) { await touch('touchStart', [[75, 400], [315, 400]]); for (let i = 1; i <= 8; i++) { await touch('touchMove', [[75 + i * 12, 400], [315 - i * 12, 400]]); await step(2); } await touch('touchEnd', []); await step(20); }
  const a2 = await state();
  line('pinch away from her in Mochi mode', a1.mode === 'follow' && a2.mode === 'follow', `pinched in off her: ${a1.mode} at ${a1.dist.toFixed(1)} m; pinched far out: ${a2.mode} at ${a2.dist.toFixed(1)} m`); }
// (The fireplace: pinching in on it ends at it.)
await page.evaluate(() => document.querySelector('[data-cam="room"]').click()); await step(40);
await look(SIDE); await step(2);
{ const [fx, fy] = await screenOf(FIRE);
  for (let n = 0; n < 3; n++) { await touch('touchStart', [[fx - 30, fy], [fx + 30, fy]]); for (let i = 1; i <= 8; i++) { await touch('touchMove', [[fx - 30 - i * 8, fy], [fx + 30 + i * 8, fy]]); await step(2); } await touch('touchEnd', []); await step(40); }
  const fz = await state(); await shot('7b-pinch-fireplace');
  line('pinch on the fireplace ends at the fireplace', Math.hypot(fz.focus[0] - FIRE[0], fz.focus[2] - FIRE[2]) < 1.1 && fz.dist < 3 && fz.mode === 'free', `looking at [${fz.focus}] from ${fz.dist.toFixed(1)} m (fireplace at [${FIRE}])`); }
// (Coming closer tilts the view down to her level; further out looks down over the room.)
await page.evaluate(() => document.querySelector('[data-cam="follow"]').click()); await step(80);
const tp0 = await page.evaluate(() => kitten.view.goal.pitch);
await touch('touchStart', [[150, 400], [240, 400]]);
for (let i = 1; i <= 8; i++) { await touch('touchMove', [[150 - i * 10, 400], [240 + i * 10, 400]]); await step(2); }
await touch('touchEnd', []); await step(30);
const tp1 = await page.evaluate(() => kitten.view.goal.pitch);
line('closer looks lower', tp1 < tp0 - .05, `tilt ${tp0.toFixed(2)} to ${tp1.toFixed(2)} as the view came closer`);
// (From the whole room, pinching in goes where the fingers are; pinching out far gives the room back.)
await page.evaluate(() => document.querySelector('[data-cam="room"]').click()); await step(80); const r0 = await state();
const pinchBy = async (a, b) => { await touch('touchStart', [[195 - a, 400], [195 + a, 400]]); for (let i = 1; i <= 8; i++) { await touch('touchMove', [[195 - a - (b - a) * i / 8, 400], [195 + a + (b - a) * i / 8, 400]]); await step(2); } await touch('touchEnd', []); await step(60); };
await pinchBy(40, 110); const r1 = await state();
const cc = await page.evaluate(() => { const p = kitten.cat.root.position.clone(); p.y += .3; return p.toArray(); });
const [ccx] = await screenOf(cc); await shot('7c-pinched-in-from-room');
const herAt = await screenOf(await page.evaluate(() => kitten.cat.root.position.toArray()));
const onHer = Math.hypot(herAt[0] - 195, herAt[1] - 400) < 60;
line('pinch in from the room goes where the fingers are', r1.mode === 'free' && r1.dist < r0.dist * .7, `fingers ${onHer ? 'on her' : 'on the floor'}: ${r0.mode} at ${r0.dist.toFixed(1)} m to ${r1.mode} at ${r1.dist.toFixed(1)} m`);
// (Pinching in on her from the whole room: closer to her, still Explore. She is set in the open
// middle first: earlier checks walked her about, maybe under the care bar.)
await page.evaluate(() => { kitten.brain.perch = null; kitten.brain.jump = null; kitten.brain.pos.set(0, 0, .3); kitten.cat.root.position.set(0, 0, .3); kitten.brain.mode = 'idle'; });
// (Long enough for the view to finish gliding back from wherever it was.)
await page.evaluate(() => document.querySelector('[data-cam="room"]').click()); await step(240);
{ const [hx, hy] = await screenOf(await page.evaluate(() => { const p = kitten.cat.root.position.clone(); p.y += .2; return p.toArray(); }));
  const rm = (await state()).mode;
  await touch('touchStart', [[hx - 40, hy], [hx + 40, hy]]); for (let i = 1; i <= 8; i++) { await touch('touchMove', [[hx - 40 - i * 9, hy], [hx + 40 + i * 9, hy]]); await step(2); } await touch('touchEnd', []); await step(60);
  const rh = await state(); line('pinch in on her stays in Explore', rh.mode === 'free' && rh.dist < 6, `from ${rm}, fingers at ${hx.toFixed(0)}, ${hy.toFixed(0)}: mode ${rh.mode} at ${rh.dist.toFixed(1)} m`); }
await pinchBy(130, 30); await pinchBy(130, 30); const r2 = await state();
line('pinch out gives the room back', r2.mode === 'room', `mode ${r2.mode} at ${r2.dist.toFixed(1)} m`);
await look(HOME); await step(2);
const mx = box.x + box.w / 2, my = box.y + box.h / 2, R = 90;
const pair = a => [[mx - Math.cos(a) * R, my - Math.sin(a) * R], [mx + Math.cos(a) * R, my + Math.sin(a) * R]];
await touch('touchStart', pair(0));
for (let i = 1; i <= 12; i++) { await touch('touchMove', pair(i * .05)); await step(2); }
await touch('touchEnd', []); await step(30);
const t1 = await state();
line('twist turns the view', Math.abs(t1.yaw) > .25 && Math.abs(t1.dist - 7) < .5, `turned ${(t1.yaw * 57.3).toFixed(0)}° for a 34° twist; distance ${t1.dist.toFixed(2)} m`);
// (Twisting on and on: on past where the old turn stopped.)
await look(HOME); await step(2);
let twisted = 0, tl = (await state()).yaw;
for (let k = 0; k < 3; k++) { await touch('touchStart', pair(0)); for (let i = 1; i <= 16; i++) { await touch('touchMove', pair(i * .1)); await step(2); const s = await state(); twisted += wrap(s.yaw - tl); tl = s.yaw; } await touch('touchEnd', []); await step(10); }
await step(40); const t2 = await state(); await shot('7d-twist-on');
line('twisting on, the turn goes on', Math.abs(twisted) > 1.9, `after three big twists: turned ${(twisted * 57.3).toFixed(0)}°, camera ${t2.dist.toFixed(2)} m from the spot`);
await cdp.send('Emulation.setTouchEmulationEnabled', {enabled: false});

// 8. The kitchen turns side to side too.
await page.evaluate(() => kitten.goTo('kitchen')); await step(200);
await page.evaluate(() => document.querySelector('[data-cam="room"]').click()); await step(120);
await ends('kitchen');
await page.evaluate(() => kitten.goTo('study')); await step(200);

// 10. Watch (the room fills the screen): the whole room, with her in the picture, not a wall.
await page.evaluate(() => document.querySelector('#watch-btn').click()); await page.waitForTimeout(400); await step(80);
const w = await state(); const wc = await screenOf(await page.evaluate(() => kitten.cat.root.position.toArray())); await shot('10-watch');
const vh = await page.evaluate(() => innerHeight);
line('watch shows the room', w.mode === 'room' && w.dist > 8 && w.focus[1] < 3.5 && wc[1] > vh * .2 && wc[1] < vh * .9, `camera ${w.dist.toFixed(1)} m back, looking at height ${w.focus[1]} m; she is ${(wc[1] / vh * 100).toFixed(0)}% of the way down the screen`);
await close();
