// Title screen. Full (every launch): the Enter buttons, the
// zoomies cinematic, her name, a tap leaves it; a tap skips the sequence and
// the room is tidy after; the second launch that day is full again.
// Short: "wake her", a tap leaves it and the app is left usable. Phone and
// desktop, plus: already asleep (tiptoe in), reduced motion (no sequence),
// ?intro=0 and ?debug (both: no title). Needs `npm run dev` running.
//   node tools/qa/title.mjs      OUT=qa-out PORT=5173 ONLY=film (only the cases whose name matches)
import fs from 'node:fs';
async function chromium() {
  try { return (await import('playwright')).chromium; } catch {}
  return (await import('/opt/node22/lib/node_modules/playwright/index.mjs')).chromium;
}
const OUT = process.env.OUT || 'qa-out', BASE = `http://127.0.0.1:${process.env.PORT || 5173}/index.html`;
fs.mkdirSync(OUT, {recursive: true});
const browser = await (await chromium()).launch({args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']});
const PHONE = {viewport: {width: 390, height: 844}, deviceScaleFactor: 1, isMobile: true, hasTouch: true}, DESK = {viewport: {width: 1440, height: 900}};
const titleOn = page => page.evaluate(() => document.documentElement.classList.contains('title'));
let failed = 0;
async function run(name, query, opts, body) {
  if (process.env.ONLY && !new RegExp(process.env.ONLY).test(name)) return;
  const ctx = await browser.newContext(opts), page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto(BASE + query);
    await body(page);
    // (Only what the title itself locks: on a phone the resting sheet keeps its hidden cards and the footer inert.)
    const stuck = await page.evaluate(() => document.querySelectorAll('.topbar[inert], .panel[inert]').length + (document.querySelector('.stage').getAttribute('style') ? 1 : 0));
    if (await titleOn(page)) throw new Error('title still up');
    if (stuck) throw new Error('page left locked');
    if (errors.length) throw new Error('page errors: ' + errors.join(' | '));
    console.log('PASS', name);
  } catch (e) { failed++; console.log('FAIL', name, e.message); }
  await ctx.close();
}
const through = (label, key) => async page => {
  await page.waitForSelector('#title.lit', {timeout: 120000});
  await page.waitForTimeout(3000);
  await page.screenshot({path: `${OUT}/title-${label}.png`, timeout: 120000});
  if (key) await page.keyboard.press(key); else await page.click('#title', {timeout: 120000, noWaitAfter: true});
  await page.waitForFunction(() => !document.documentElement.classList.contains('title'), null, {timeout: 60000});
  await page.waitForTimeout(3000);
  await page.screenshot({path: `${OUT}/title-${label}-after.png`, timeout: 120000});
};
const SAVE = 'pocket-kitten-companion-v1';
const tapOut = async page => {
  // (A tap in the first moment after her name comes in doesn't count: tap again.)
  for (let i = 0; i < 40 && await titleOn(page); i++) { await page.click('#title', {timeout: 120000, noWaitAfter: true}).catch(() => {}); await page.waitForTimeout(1500); }
};
await run('full: Enter, the sequence, her name, tap; then full again on the next launch', '?night=0&film=0', PHONE, async page => {
  await page.waitForSelector('#title.gate', {timeout: 120000});
  await page.screenshot({path: `${OUT}/title-gate.png`, timeout: 120000});
  await page.click('#enter-mute', {timeout: 120000, noWaitAfter: true});
  await page.waitForSelector('#title.cine', {timeout: 60000});
  await page.waitForSelector('#title.reveal', {timeout: 1200000});
  if (await page.evaluate(k => JSON.parse(localStorage[k] || '{}').sound === true, SAVE)) throw new Error('sound was turned on');
  await page.waitForTimeout(4000);
  await page.screenshot({path: `${OUT}/title-live.png`, timeout: 120000});
  await tapOut(page);
  await page.goto(BASE + '?night=0');
  await page.waitForSelector('#title.gate', {timeout: 120000});
  if (!await page.evaluate(() => document.getElementById('title').classList.contains('full'))) throw new Error('the second launch the same day is not the full opening');
  await page.click('#enter-mute', {timeout: 120000, noWaitAfter: true});
  await page.waitForSelector('#title.cine', {timeout: 60000});
  await tapOut(page);
});
await run('full: with sound, a tap skips, the room is tidy', '?debug&intro=full&night=0&film=0', PHONE, async page => {
  await page.waitForSelector('#title.gate', {timeout: 120000});
  const before = await page.evaluate(() => JSON.stringify(['name', 'bond', 'cuddles', 'sleeping', 'place'].map(k => kitten.pet[k])));
  await page.click('#enter-sound', {timeout: 120000, noWaitAfter: true});
  // (Into the vase shot, with slow motion on.)
  await page.waitForFunction(() => kitten.title.cine?.T > 5.4, null, {timeout: 1200000});
  await page.click('#title', {timeout: 120000, noWaitAfter: true});
  await page.waitForSelector('#title.reveal', {timeout: 60000});
  await page.waitForTimeout(3000);
  const st = await page.evaluate(() => { const b = kitten.brain, v = kitten.room.mantelVase, h = v.userData.home; return {stage: kitten.title.stage, at: Math.hypot(b.pos.x, b.pos.z - .3), y: b.elevation, perch: b.perch, jump: !!b.jump, vase: v.position.distanceTo(h.p) + Math.abs(v.rotation.x) + Math.abs(v.rotation.z), sound: kitten.pet.sound, pet: JSON.stringify(['name', 'bond', 'cuddles', 'sleeping', 'place'].map(k => kitten.pet[k])), ms: kitten.title.fx?.frameMs}; });
  // (0 here: software 3D is too slow to count. It means something on a real GPU.)
  console.log('  frame time on this machine (ms):', st.ms?.toFixed(0));
  if (st.stage !== 'live' || st.at > .05 || st.y > .05 || st.perch || st.jump) throw new Error('she is not sitting at home: ' + JSON.stringify(st));
  if (st.vase > .001) throw new Error('the vase is not back');
  if (!st.sound) throw new Error('sound was not turned on');
  if (st.pet !== before) throw new Error('her save changed');
  // The logo, her toys beside her, and her name on the button.
  await page.waitForFunction(() => kitten.title.toys?.filter(o => o.visible && o.scale.x > .9).length === 3, null, {timeout: 120000}).catch(() => { throw new Error('her three toys are not out'); });
  const top = await page.evaluate(() => { const i = document.querySelector('.title-logo'), r = i.getBoundingClientRect(); return {logo: i.complete && i.naturalWidth > 0 && r.width > 100 && r.top >= 0 && getComputedStyle(i).visibility === 'visible', go: document.getElementById('title-go').textContent, name: kitten.pet.name, far: Math.max(...kitten.title.toys.map(o => Math.hypot(o.position.x - kitten.brain.pos.x, o.position.z - kitten.brain.pos.z))), near: Math.min(...kitten.title.toys.map(o => Math.hypot(o.position.x - kitten.brain.pos.x, o.position.z - kitten.brain.pos.z)))}; });
  if (!top.logo) throw new Error('the logo is not showing');
  if (top.go !== 'Play with ' + top.name) throw new Error('button says: ' + top.go);
  if (top.near < .4 || top.far > 1.3) throw new Error('toys misplaced: ' + JSON.stringify(top));
  await page.screenshot({path: `${OUT}/title-live-toys.png`, timeout: 120000});
  await tapOut(page);
  if (await page.evaluate(() => !!kitten.title.toys)) throw new Error('toys left out');
  if (await page.evaluate(() => !!kitten.title.fx || kitten.camera.fov > 47)) throw new Error('title picture left on');
});
// The opening film (by day, plain study, long-haired Mochi, upright screen).
// (This browser cannot play the real mp4: it is handed a WebM copy.)
const FILM = new URL('../../fixtures/mochi-opening.webm', import.meta.url).pathname;
const withFilm = page => page.route('**/mochi-opening*.mp4', r => r.fulfill({path: FILM, contentType: 'video/webm'}));
const stage = page => page.evaluate(() => kitten.title.stage);
const liveOK = async page => {
  await page.waitForSelector('#title.reveal', {timeout: 120000});
  await page.waitForFunction(() => kitten.title.toys?.filter(o => o.visible && o.scale.x > .9).length === 3, null, {timeout: 120000}).catch(async () => { throw new Error('her three toys are not out: ' + await page.evaluate(() => JSON.stringify({n: kitten.title.toys?.length, toys: kitten.title.toys?.map(o => [o.visible, +o.scale.x.toFixed(2), o.userData.born && +o.userData.born.toFixed(1)]), clock: +kitten.clock.toFixed(1), stage: kitten.title.stage}))); });
  await page.waitForTimeout(1500);
  const st = await page.evaluate(() => { const b = kitten.brain, f = document.getElementById('title-film'), i = document.querySelector('.title-logo'); return {stage: kitten.title.stage, at: Math.hypot(b.pos.x, b.pos.z - .3), a: b.activity, film: +getComputedStyle(f).opacity, src: f.getAttribute('src'), logo: getComputedStyle(i).visibility, go: document.getElementById('title-go').textContent, name: kitten.pet.name}; });
  if (st.stage !== 'live' || st.at > .05) throw new Error('she is not sitting at home: ' + JSON.stringify(st));
  if (st.film > .02 || st.src) throw new Error('the film is still up: ' + JSON.stringify(st));
  if (st.logo !== 'visible' || st.go !== 'Play with ' + st.name) throw new Error('title not shown: ' + JSON.stringify(st));
};
const toyXY = page => page.evaluate(() => { const v = kitten.toy.position.clone().project(kitten.camera), r = kitten.renderer.domElement.getBoundingClientRect(); return {x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height}; });
await run('film: plays after Enter, a tap skips, then the first steps (ball, stroke) once', '?debug&intro=full&night=0&filmwait=90000', PHONE, async page => {
  await withFilm(page);
  await page.waitForSelector('#title.gate', {timeout: 120000});
  await page.click('#enter-mute', {timeout: 120000, noWaitAfter: true});
  await page.waitForSelector('#title.film.rolling', {timeout: 120000}).catch(async () => { throw new Error('the film did not start, stage ' + await stage(page)); });
  if (await page.evaluate(() => !document.getElementById('title-film').muted)) throw new Error('film has sound after Enter without sound');
  // (The film is slowed right down for the tap: on this slow machine it would be over first.)
  await page.evaluate(() => { document.getElementById('title-film').playbackRate = .07; window.__at = null; document.getElementById('title').addEventListener('click', () => { window.__at = kitten.title.stage; }, true); });
  await page.waitForFunction(() => kitten.clock - kitten.title.film.at > .5, null, {timeout: 60000});
  await page.click('#title', {timeout: 120000, noWaitAfter: true});
  if (await page.evaluate(() => window.__at) !== 'film') throw new Error('the tap came after the film: this machine is too slow to test the skip');
  await liveOK(page);
  await page.screenshot({path: `${OUT}/film-into-title.png`, timeout: 120000});
  await tapOut(page);
  await page.waitForTimeout(5000);
  const hint = () => page.evaluate(() => { const h = document.getElementById('scene-hint'), r = h.getBoundingClientRect(); return {t: h.textContent, teach: h.classList.contains('teach') && getComputedStyle(h).display !== 'none' && r.width > 40 && r.top > 0 && r.bottom < innerHeight * .6, step: kitten.teach, mode: kitten.brain.mode}; });
  let h = await hint();
  if (!h.teach || !/Tap the pink ball/.test(h.t)) throw new Error('no ball prompt: ' + JSON.stringify(h));
  await page.screenshot({path: `${OUT}/first-step-ball.png`, timeout: 120000});
  const at = await toyXY(page);
  await page.mouse.click(at.x, at.y);
  await page.waitForFunction(() => kitten.brain.mode === 'play', null, {timeout: 20000}).catch(() => { throw new Error('a tap on the ball did not start play (tapped ' + JSON.stringify(at) + ')'); });
  h = await hint();
  if (h.teach || h.step !== 'pet') throw new Error('during play: ' + JSON.stringify(h));
  await page.evaluate(() => kitten.endPlay(true));
  await page.waitForTimeout(500);
  await page.evaluate(() => kitten.refresh());
  h = await hint();
  if (!h.teach || !/give .* a stroke/.test(h.t)) throw new Error('no stroke prompt: ' + JSON.stringify(h));
  await page.screenshot({path: `${OUT}/first-step-stroke.png`, timeout: 120000});
  await page.evaluate(() => kitten.touchCat('head'));
  h = await hint();
  if (h.teach || h.step) throw new Error('prompt left after a stroke: ' + JSON.stringify(h));
  await page.goto(BASE + '?debug');
  await page.waitForSelector('#loading.done', {state: 'attached', timeout: 120000});
  await page.waitForTimeout(1500);
  h = await hint();
  if (h.teach || h.step) throw new Error('prompt came back after a reload: ' + JSON.stringify(h));
});
await run('film: with sound, plays to its end and fades into the title', '?debug&intro=full&night=0&filmwait=90000', PHONE, async page => {
  await withFilm(page);
  await page.waitForSelector('#title.gate', {timeout: 120000});
  await page.click('#enter-sound', {timeout: 120000, noWaitAfter: true});
  await page.waitForSelector('#title.film.rolling', {timeout: 120000}).catch(async () => { throw new Error('the film did not start, stage ' + await stage(page)); });
  if (await page.evaluate(() => document.getElementById('title-film').muted)) throw new Error('film is muted after Enter with sound');
  await page.waitForFunction(() => kitten.title.stage === 'live', null, {timeout: 600000});
  await liveOK(page);
  await tapOut(page);
});
await run('film: at night too, into the night room', '?debug&intro=full&night=1&filmwait=90000', PHONE, async page => {
  await withFilm(page);
  await page.waitForSelector('#title.gate', {timeout: 120000});
  await page.click('#enter-mute', {timeout: 120000, noWaitAfter: true});
  await page.waitForSelector('#title.film.rolling', {timeout: 120000}).catch(async () => { throw new Error('the film did not start, stage ' + await stage(page)); });
  await page.waitForFunction(() => kitten.title.stage === 'live', null, {timeout: 600000});
  await liveOK(page);
  if (!await page.evaluate(() => kitten.night)) throw new Error('it is not night');
  await page.screenshot({path: `${OUT}/film-into-night-title.png`, timeout: 120000});
  await tapOut(page);
});
await run('film file missing: the sequence plays instead', '?debug&intro=full&night=0', PHONE, async page => {
  await page.route('**/mochi-opening*.mp4', r => r.abort());
  await page.waitForSelector('#title.gate', {timeout: 120000});
  await page.click('#enter-mute', {timeout: 120000, noWaitAfter: true});
  await page.waitForSelector('#title.cine', {timeout: 60000}).catch(async () => { throw new Error('no sequence, stage ' + await stage(page)); });
  if (await page.evaluate(() => document.getElementById('title').classList.contains('film'))) throw new Error('film class left on');
  await page.waitForFunction(() => kitten.title.cine?.T > 1, null, {timeout: 600000});
  await page.click('#title', {timeout: 120000, noWaitAfter: true});
  await page.waitForSelector('#title.reveal', {timeout: 60000});
  await tapOut(page);
});
await run('film in the Christmas look too, into the decorated room', '?debug&intro=full&night=0&decor=christmas&filmwait=90000', PHONE, async page => {
  await withFilm(page);
  await page.addInitScript(() => { const k = 'pocket-kitten-companion-v1'; localStorage[k] = JSON.stringify({v: 2, name: 'Mochi', decor: 'christmas', updated: Date.now()}); });
  await page.reload();
  await page.waitForSelector('#title.gate', {timeout: 120000});
  if (await page.evaluate(() => kitten.room.decor) !== 'christmas') throw new Error('the Christmas look is not on');
  await page.click('#enter-mute', {timeout: 120000, noWaitAfter: true});
  await page.waitForSelector('#title.film.rolling', {timeout: 120000}).catch(async () => { throw new Error('the film did not start, stage ' + await stage(page)); });
  await page.waitForFunction(() => kitten.title.stage === 'live', null, {timeout: 600000});
  await liveOK(page);
  await page.screenshot({path: `${OUT}/film-into-christmas-title.png`, timeout: 120000});
  await tapOut(page);
});
for (const [name, q, opts] of [['the first Mochi', '?debug&intro=full&night=0&mochi=first', PHONE], ['a wide screen', '?debug&intro=full&night=0', DESK]])
  await run('no film in ' + name + ': the sequence', q, opts, async page => {
    await withFilm(page);
    await page.waitForSelector('#title.gate', {timeout: 120000});
    await page.click('#enter-mute', {timeout: 120000, noWaitAfter: true});
    await page.waitForTimeout(800);
    if (await stage(page) !== 'cine') throw new Error('stage is ' + await stage(page));
    await page.waitForFunction(() => kitten.title.cine?.T > 1, null, {timeout: 600000});
    await page.click('#title', {timeout: 120000, noWaitAfter: true});
    await page.waitForSelector('#title.reveal', {timeout: 60000});
    await tapOut(page);
  });
await run('a save from before: no first steps', '?debug', PHONE, async page => {
  await page.addInitScript(() => { const k = 'pocket-kitten-companion-v1'; localStorage[k] = JSON.stringify({v: 2, name: 'Mochi', bond: 12, cuddles: 3, updated: Date.now()}); });
  await page.reload();
  await page.waitForSelector('#loading.done', {state: 'attached', timeout: 120000});
  await page.waitForTimeout(1500);
  const h = await page.evaluate(() => ({teach: document.getElementById('scene-hint').classList.contains('teach'), step: kitten.teach}));
  if (h.teach || h.step) throw new Error('an old save is being taught: ' + JSON.stringify(h));
});
await run('phone, short', '?night=0&intro=short', PHONE, through('phone'));
await run('desktop, night, Enter key, short', '?night=1&intro=short', DESK, through('desk', 'Enter'));
await run('reduced motion: no sequence', '?night=0&intro=full', {...PHONE, reducedMotion: 'reduce'}, async page => {
  await page.waitForSelector('#title.lit', {timeout: 120000});
  if (await page.isVisible('#title-gate')) throw new Error('Enter buttons shown');
  await through('reduced')(page);
});
// (Where the film plays, opening the app wakes her: the case after this one.
// `film=0` is every place without a film: she sleeps on.)
await run('already asleep: tiptoe in', '?night=1&film=0', PHONE, async page => {
  await page.addInitScript(() => { const k = 'pocket-kitten-companion-v1'; let v = {}; try { v = JSON.parse(localStorage[k]) || {}; } catch {} v.sleeping = true; v.updated = Date.now(); localStorage[k] = JSON.stringify(v); });
  await page.reload();
  await page.waitForSelector('#title.lit', {timeout: 120000});
  if (!/tiptoe/.test(await page.textContent('#title-go'))) throw new Error('no tiptoe label');
  await through('asleep')(page);
  if (await page.textContent('#mood-text') !== 'Dreaming softly') throw new Error('she woke up');
});
await run('asleep where the film plays: the Enter screen, and she is awake', '', PHONE, async page => {
  await page.addInitScript(() => { const k = 'pocket-kitten-companion-v1'; let v = {}; try { v = JSON.parse(localStorage[k]) || {}; } catch {} if (!sessionStorage.getItem('once')) { v.sleeping = true; sessionStorage.setItem('once', '1'); } v.updated = Date.now(); localStorage[k] = JSON.stringify(v); });
  await page.reload();
  await page.waitForSelector('#title.gate', {timeout: 120000});
  if (await page.evaluate(() => document.querySelector('#title-gate').hidden)) throw new Error('no Enter screen');
  if (await page.textContent('#sleep-label') !== 'Rest') throw new Error('she is still asleep');
  if (await page.textContent('#mood-text') === 'Dreaming softly') throw new Error('her mood still says asleep');
  // (Out through the opening: a tap skips it, a tap leaves the title.)
  await page.click('#enter-mute', {timeout: 120000, noWaitAfter: true});
  for (let i = 0; i < 30 && await titleOn(page); i++) { await page.waitForTimeout(1500); await page.click('#title', {timeout: 120000, noWaitAfter: true}).catch(() => {}); }
});
for (const q of ['?debug&intro=short&night=0'])
  await run('chime plays with sound on, ' + q, q, PHONE, async page => {
    await page.addInitScript(() => { const k = 'pocket-kitten-companion-v1'; let v = {}; try { v = JSON.parse(localStorage[k]) || {}; } catch {} v.sound = true; v.sleeping = false; v.updated = Date.now(); localStorage[k] = JSON.stringify(v); });
    await page.reload();
    await page.waitForSelector('#title.lit', {timeout: 120000});
    await page.click('#title', {timeout: 120000, noWaitAfter: true});
    await page.waitForFunction(() => window.kitten.chimed !== undefined, null, {timeout: 60000});
    if (!await page.evaluate(() => window.kitten.chimed)) throw new Error('chime did not play');
    await page.waitForFunction(() => !document.documentElement.classList.contains('title'), null, {timeout: 60000});
  });
for (const q of ['?intro=0', '?debug'])
  await run('no title with ' + q, q, PHONE, async page => { await page.waitForSelector('#loading.done', {state: 'attached', timeout: 120000}); if (await page.isVisible('#title')) throw new Error('title shown'); });
await browser.close();
process.exit(failed ? 1 : 0);
