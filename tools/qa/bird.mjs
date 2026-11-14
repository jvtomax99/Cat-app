// Stills of the bird at the study window: flying by (several moments of
// the wing beat) and perched, close up.   node tools/qa/bird.mjs   (OUT, ROOM=kitchen)
import {open} from './lib.mjs'; import fs from 'node:fs';
const OUT = process.env.OUT || 'qa-out/bird', KITCHEN = process.env.ROOM === 'kitchen';
fs.mkdirSync(OUT, {recursive: true});
for (const kind of ['flyby', 'perch']) {
  const {page, step, look, close} = await open({seed: 1, kitchen: KITCHEN, width: 780, height: 700});
  await step(10);
  await page.evaluate(([kind, k]) => { const w = k ? kitten.kitchen : kitten.room, start = w.startBird; w.startBird = t => start.call(w, t, kind); kitten.brain.nextBird = 0; }, [kind, KITCHEN]);
  const cam = KITCHEN ? {focus: [-6, 3.6, .1], yaw: 1.5, pitch: 0, dist: 5} : {focus: [-2.35, 3.5, await page.evaluate(() => kitten.room.walls.back)], yaw: .1, pitch: 0, dist: 3.4};
  // (Sixtieths of a second, so the wing beat is caught at different points.)
  for (const [i, n] of (kind === 'flyby' ? [50, 7, 5, 9, 13, 8] : [100, 60, 70, 40]).entries()) {
    await step(n, 1 / 60); await look(cam);
    const at = await page.evaluate(k => { const w = k ? kitten.kitchen : kitten.room; return w.birdRun ? w.bird.position.toArray().map(v => +v.toFixed(2)) : null; }, KITCHEN);
    const f = `${OUT}/${KITCHEN ? 'kitchen-' : ''}${kind}-${i}.png`;
    await page.locator('canvas').first().screenshot({path: f}); console.log(f, at);
  }
  await close();
}
