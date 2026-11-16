// Music in the sound panel (2026-11-14), on a phone (390 x 844): off for a
// new player, a piece picked in the panel plays (measured on the music
// volume), switching pieces, Off, the Sound switch, the choice survives a
// reload, a piece comes round again after its pause, and Mix moves on to
// the next piece. Stills to OUT.
// About 5 min (it listens to two pieces all the way through).
import {open} from './lib.mjs';
const OUT = process.env.OUT || 'qa-out';
(await import('node:fs')).mkdirSync(OUT, {recursive: true});
let bad = 0;
const check = (ok, what) => { console.log(`${ok ? 'PASS' : 'FAIL'}: ${what}`); if (!ok) bad++; };
const {page, close} = await open({width: 390, height: 844, flags: '&intro=0'});
await page.evaluate(() => document.querySelectorAll('.hud, .dock').forEach(e => e.style.visibility = ''));
// How loud the music is right now (0 = silence), read off its volume control.
const level = () => page.evaluate(async () => {
  const s = kitten.sounds; if (!s.ctx) return 0;
  const a = s.meter ||= (() => { const a = s.ctx.createAnalyser(); a.fftSize = 2048; s.bus.music.connect(a); return a; })();
  let peak = 0; const d = new Float32Array(a.fftSize);
  for (let i = 0; i < 12; i++) { await new Promise(r => requestAnimationFrame(r)); a.getFloatTimeDomainData(d); for (const v of d) peak = Math.max(peak, Math.abs(v)); }
  return peak;
});
const state = () => page.evaluate(() => ({music: kitten.pet.music, tune: kitten.sounds.tune, playing: !!kitten.sounds.tuneSrc, title: kitten.title.stage, checked: [...document.querySelectorAll('#tunes [aria-checked=true]')].map(b => b.textContent)}));
const pick = async name => { await page.click(`#tunes button:text-is("${name}")`); await page.waitForTimeout(2500); };

let s = await state();
check(s.music === '' && s.tune === null, 'a new player has no music');
await page.click('#sound');
await page.screenshot({path: `${OUT}/music-panel-muted.png`});
check(s.checked.join() === 'Off', 'the panel shows Off picked');
await page.click('#sound-on');
await page.waitForTimeout(1500);
check(await level() === 0, 'sound on, still no music until a piece is picked');
await pick('Music box');
s = await state();
check(s.music === 'box' && s.tune === 'music-box.mp3' && s.playing && s.checked.join() === 'Music box', 'Music box picked: it plays');
const loud = await level();
check(loud > .001, `music is heard on its volume (peak ${loud.toFixed(4)})`);
await page.screenshot({path: `${OUT}/music-panel.png`});
await page.evaluate(() => { const v = document.querySelector('#vol-music'); v.value = 0; v.dispatchEvent(new Event('input')); v.dispatchEvent(new Event('change')); });
await page.waitForTimeout(800);
check(await level() < loud / 20, 'the music volume turned down silences it');
await page.evaluate(() => { const v = document.querySelector('#vol-music'); v.value = .3; v.dispatchEvent(new Event('input')); v.dispatchEvent(new Event('change')); });
await pick('Guitar');
s = await state();
check(s.tune === 'music-guitar.mp3' && s.playing && await level() > .001, 'switching to Guitar plays the guitar');
await pick('Off');
s = await state();
check(s.tune === null && !s.playing && await level() < .0005, 'Off stops it');
await pick('Piano');
await page.click('#sound-on');
await page.waitForTimeout(2500);
s = await state();
check(s.tune === null && s.music === 'piano', 'the Sound switch off stops the music and keeps the choice');
await page.click('#sound-on');
await page.waitForTimeout(2500);
check((await state()).tune === 'music-piano.mp3' && await level() > .001, 'Sound back on: the piano again');
// A page put in the background goes quiet.
await page.evaluate(() => { Object.defineProperty(document, 'hidden', {get: () => true, configurable: true}); document.dispatchEvent(new Event('visibilitychange')); });
check((await state()).tune === null, 'the app in the background: no music');
await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
await page.waitForTimeout(500);
check((await state()).tune === 'music-piano.mp3', 'back in front: music again');
// The whole piece, the pause, then round again.
const first = await page.evaluate(() => { const s = kitten.sounds; window.__src = s.tuneSrc; return s.tuneKept.buffer.duration; });
await page.waitForTimeout((first + 5) * 1000);
check(await level() < .0005, `after the piece (${first.toFixed(0)} s) there is a quiet pause`);
await page.waitForTimeout(12000);
check(await page.evaluate(() => kitten.sounds.tuneSrc !== window.__src) && await level() > .001, 'then it comes round again');
// The choice is saved.
await page.reload();
await page.waitForFunction(() => window.kitten && kitten.cat.ready, null, {timeout: 900000});
s = await state();
check(s.music === 'piano', 'the choice survives a reload');
// Mix: the three in turn, the next one after the pause.
if (!await page.isVisible('#tunes')) await page.click('#sound');
await pick('Mix');
const now = () => page.evaluate(() => ({file: kitten.sounds.tuneNow, playing: !!kitten.sounds.tuneSrc, checked: [...document.querySelectorAll('#tunes [aria-checked=true]')].map(b => b.textContent).join()}));
let m = await now();
await page.screenshot({path: `${OUT}/music-mix.png`});
check(m.file === 'music-box.mp3' && m.playing && m.checked === 'Mix' && await level() > .001, 'Mix picked: the music box first');
// (Timed on the audio clock, which can fall behind the wall clock on a busy
// test machine.)
const end = await page.evaluate(() => { const s = kitten.sounds; s.mixEnded = null; s.tuneSrc.addEventListener('ended', () => s.mixEnded = s.ctx.currentTime); return s.tuneKept.buffer.duration; });
await page.waitForFunction(() => kitten.sounds.mixEnded !== null, null, {timeout: (end + 30) * 1000, polling: 500});
await page.waitForTimeout(3000);
check(await level() < .0005, 'Mix: a quiet pause after the first piece');
await page.waitForFunction(() => kitten.sounds.tuneNow === 'music-piano.mp3', null, {timeout: 30000, polling: 250}).catch(() => {});
const gap = await page.evaluate(() => kitten.sounds.ctx.currentTime - kitten.sounds.mixEnded);
check(gap > 10 && gap < 16, `Mix: the pause is about 12 s (${gap.toFixed(1)} s)`);
await page.waitForTimeout(2500);
m = await now();
check(m.file === 'music-piano.mp3' && await level() > .001, 'Mix: then the piano, not the music box again');
await close();
console.log(bad ? `${bad} FAILED` : 'ALL PASS');
process.exit(bad ? 1 : 0);
