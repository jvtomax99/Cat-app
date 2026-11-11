// The opening screen (dist/title.js): takes pictures of each state, and
// checks that Play hands over to the game.
//   node tools/qa/title.mjs            a returning player, by day
//   CASE=film|night|asleep|kitchen|wide node tools/qa/title.mjs
//   NIGHT=1 with CASE=film: the film at night (day until Play, then night)
//   SCALE=2 for sharp pictures (slower)
//   OUT=qa-out/title  (pictures: <case>-1-title.png, -2-hello.png, -3-game.png)
// Good result: "ok" on every line, no page errors, and in the pictures the
// logo clear of her face, the button clear of her paws, the toys on the floor.
// (Headless Chromium may not play the film's H.264: then the film case
// shows the fallback, which is the same screen without the film.)
import fs from 'node:fs';
import {open} from './lib.mjs';

const CASE = process.env.CASE || 'day', OUT = process.env.OUT || 'qa-out/title';
fs.mkdirSync(OUT, {recursive: true});
const wide = CASE === 'wide';
const {page, step, close} = await open({
  seed: 7, quiet: false, night: CASE === 'night' || process.env.NIGHT ? 1 : 0, kitchen: false,
  flags: '&title=' + (CASE === 'film' ? 'film' : '1'), width: wide ? 1280 : 390, height: wide ? 800 : 844, scale: +process.env.SCALE || 1,
  before: async page => {
    // (Someone who has seen the film already, except in the film case.)
    if (CASE !== 'film') await page.addInitScript(() => localStorage.setItem('pocket-kitten-companion-v1-intro', '1'));
    if (CASE === 'asleep' || CASE === 'kitchen') await page.addInitScript(c => {
      // A save from an earlier visit: asleep in her bed, or in the kitchen.
      const now = Date.now(), pet = {name: 'Mochi', born: now - 5 * 864e5, updated: now, food: 80, water: 80, happiness: 80, energy: 60, cleanliness: 90, sleeping: c === 'asleep', place: c === 'kitchen' ? 'kitchen' : 'study'};
      localStorage.setItem('pocket-kitten-companion-v1', JSON.stringify(pet));
    }, CASE);
  },
});
const ok = (name, good, note = '') => console.log(`${good ? 'ok  ' : 'FAIL'} ${name}${note ? ' · ' + note : ''}`);
const state = () => page.evaluate(() => ({cls: document.querySelector('#title')?.className ?? null, on: document.body.classList.contains('title-on'), inert: document.querySelector('.app').inert, cam: kitten.view.mode, act: kitten.brain.activity, pos: kitten.brain.pos.toArray().map(v => +v.toFixed(2)), dist: +kitten.view.dist.toFixed(2)}));
const shot = async name => { await page.waitForTimeout(1500); await step(1); await page.screenshot({path: `${OUT}/${CASE}-${name}.png`}); };

// (lib.mjs hides the HUD for its own pictures: this check wants it back.)
await page.evaluate(() => document.querySelectorAll('.hud, .dock, .scene-hint, #speech').forEach(e => e.style.visibility = ''));
let s = await state(), filmPlayed = false;
if (CASE === 'film') {
  // The film plays in real time; wait for it to end (or to be given up on).
  await page.waitForFunction(() => document.querySelector('#title').classList.contains('film-done'), null, {timeout: 30000});
  filmPlayed = await page.evaluate(() => document.querySelector('#title-film').currentTime > 0);
  console.log(filmPlayed ? 'film played' : 'film did not play here (fallback shown)');
  s = await state();
}
await page.waitForFunction(() => document.querySelector('#title').classList.contains('live'), null, {timeout: 30000});
await step(1);
await page.screenshot({path: `${OUT}/${CASE}-0-reveal.png`});
// Toys load over the network in real time; then let the camera settle.
await page.waitForTimeout(2500);
await step(120);
s = await state();
ok('title is up over the room', s.on && s.inert && s.cam === 'title', JSON.stringify(s));
await shot('1-title');
await step(100);
await shot('1b-title-later');

await page.click('#title-play');
await step(16);
await shot('2-hello');
await step(40);
s = await state();
ok('Play hands over to the game', !s.on && !s.inert, JSON.stringify(s));
await step(80);
await page.waitForTimeout(1200);
s = await state();
ok('the opening screen is gone and the camera is on the room', s.cls === null && s.cam === 'room', JSON.stringify(s));
await shot('3-game');
if (CASE === 'film') ok('the film is remembered as seen only if it played', await page.evaluate(() => localStorage.getItem('pocket-kitten-companion-v1-intro') === '1') === filmPlayed);
await close();
