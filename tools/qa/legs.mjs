// Leg check: lets her roam (study, then kitchen, then strolls on the
// shelves) and counts how often a planted leg is stretched past its reach
// ("dragging") or a planted paw slides. Seeded, so runs are comparable.
//   node tools/qa/legs.mjs            (SEC=120 per room, SEED=777, FLAGS='&hindlift=0.8')
import {open} from './lib.mjs';
const SEC = +(process.env.SEC || 120);
const {page, step, close} = await open({seed: +(process.env.SEED || 777), quiet: false, flags: process.env.FLAGS || ''});
await page.evaluate(() => {
  const m = kitten.cat.motion, u = m.update.bind(m), last = {}; window.R = {}; window.EV = [];
  m.update = (dt, t, ctl) => {
    u(dt, t, ctl);
    const B = kitten.brain, where = B.perch || 'floor';
    for (const k of ['LF', 'RF', 'LH', 'RH']) {
      // (A paw raised on purpose, swatting or washing, isn't a planted one.)
      const pw = m.paws[k]; if (pw.free || k === 'RF' && ctl.swat > .02 || k === 'LF' && ctl.groom) { last[k] = null; continue; }
      const short = m.rig.legs[k].reachShort || 0, key = `${where.padEnd(9)} ${B.activity.padEnd(7)} ${k}`;
      const r = R[key] ??= {n: 0, over: 0, max: 0, slide: 0};
      r.n++; if (short > .02) r.over++; r.max = Math.max(r.max, short);
      const planted = !pw.swing, p = last[k];
      if (planted && p?.planted) { const d = Math.hypot(pw.pos.x - p.x, pw.pos.z - p.z); if (d > .006 && d < .5) r.slide += d; }
      if (short > .04 && EV.length < 25) EV.push(`${key} stretched ${(short * 100).toFixed(1)}cm speed ${m.vel.length().toFixed(2)} turn ${m.yawRate.toFixed(2)} at ${B.pos.x.toFixed(2)},${B.pos.z.toFixed(2)} t ${t.toFixed(1)} jumped ${!!m.lastJumped}`);
      last[k] = {x: pw.pos.x, z: pw.pos.z, planted};
    }
  };
  kitten.cat.update = (dt, t, ctl) => m.update(dt, t, ctl);
});
await step(SEC * 20);
await page.evaluate(() => kitten.goTo('kitchen'));
await step(SEC * 20);
for (const shelf of ['shelf', 'shelfHigh']) {
  await page.evaluate(s => { kitten.brain.mode = 'idle'; kitten.jumpTo(s, () => kitten.setActivity('sit'), 1e9); }, shelf);
  for (let i = 0; i < 60; i++) { await step(10); if (await page.evaluate(s => kitten.brain.perch === s && !kitten.brain.jump, shelf)) break; }
  for (let i = 0; i < 4; i++) { await page.evaluate(() => { kitten.brain.mode = 'idle'; kitten.stroll(); }); await step(140); }
}
console.log('where     activity leg   frames  stretched>2cm  worst   slide');
console.log(await page.evaluate(() => Object.entries(R).filter(([, r]) => r.n > 40).sort().map(([k, r]) =>
  `${k}  ${String(r.n).padStart(6)}  ${(100 * r.over / r.n).toFixed(1).padStart(12)}%  ${(r.max * 100).toFixed(1).padStart(5)}cm  ${(r.slide * 100).toFixed(1).padStart(5)}cm`).join('\n') + '\n-- worst moments --\n' + EV.join('\n')));
await close();
