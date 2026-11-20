// Thinking time per frame (nothing drawn) in each room, sitting and while
// she walks to random spots. For a stutter that isn't drawing.
//   node tools/qa/cpu.mjs      (ONLY=bedroom,kitchen)
import {open} from './lib.mjs';
const {page, step, close} = await open({seed: 3, width: 390, height: 844, init: [() => { window.__rt = () => { const m = performance.mark('t'); performance.clearMarks(); return m.startTime; }; }, null]});
const rooms = (process.env.ONLY || 'room,kitchen,hall,landing,bedroom').split(',');
for (const id of rooms) {
  await page.evaluate(id => kitten.goTo(id), id);
  await step(20);
  const t = await page.evaluate(() => {
    const r = kitten.renderer, render = r.render, pc = performance.now; r.render = () => {}; __vt.on = true;
    const res = {}, run = (name, n) => { const ts = []; for (let i = 0; i < n; i++) { const a = window.__rt(); kitten.step(1 / 60, 1); __vt.tick(1000 / 60); ts.push(window.__rt() - a); } ts.sort((x, y) => x - y); res[name] = {avg: +(ts.reduce((s, x) => s + x, 0) / n).toFixed(2), p95: +ts[Math.floor(n * .95)].toFixed(2), max: +ts[n - 1].toFixed(2)}; };
    run('sit', 120);
    const p = kitten.place; let walks = 0; const ts = [];
    for (let w = 0; w < 6; w++) { const q = p.randomFloorPoint ? p.randomFloorPoint() : null; if (!q) break; kitten.walkTo(q); walks++; run('walk' + w, 90); }
    r.render = render; return res;
  });
  const walk = Object.entries(t).filter(([k]) => k.startsWith('walk')).map(([, v]) => v);
  const agg = walk.length ? {avg: +(walk.reduce((s, v) => s + v.avg, 0) / walk.length).toFixed(2), p95: Math.max(...walk.map(v => v.p95)), max: Math.max(...walk.map(v => v.max))} : null;
  console.log(id.padEnd(8), 'sit', JSON.stringify(t.sit), '| walking', JSON.stringify(agg));
}
await close();
