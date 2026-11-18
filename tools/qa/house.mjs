// Phase 20, one home. So far (steps 1 and 2): the rooms stand where they
// did, and in each room she walks down the lane to the doorway and back,
// staying in the lane or on her usual floor all the way. Stills at the door.
//   node tools/qa/house.mjs           (OUT)
import {open} from './lib.mjs'; import fs from 'node:fs';
const OUT = process.env.OUT || 'qa-out/house';
fs.mkdirSync(OUT, {recursive: true});
const checks = [];
const ok = (name, pass, info = '') => { checks.push(pass); console.log(pass ? 'ok  ' : 'FAIL', name, info); };
for (const kitchen of [false, true]) {
  const {page, step, look, close} = await open({seed: 2, kitchen, width: 780, height: 900});
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await step(10);
  const id = kitchen ? 'kitchen' : 'room';
  // The other room stands where the old fixed join put it.
  const other = await page.evaluate(k => { const g = (k ? kitten.room : kitten.kitchen).group; return [g.position.x, g.position.z, g.rotation.y].map(v => +v.toFixed(4)); }, kitchen);
  const want = kitchen ? [3.9, -9.25, 1.5708] : [-9.25, -3.9, -1.5708];
  ok(`${id}: the other room stands where it did`, other.every((v, i) => Math.abs(v - want[i]) < 1e-3), JSON.stringify(other));
  // Down the lane to the doorway spot, and back to the middle of her floor.
  for (const [leg, goal] of [['to the door', 'spot'], ['back', 'home']]) {
    const r = await page.evaluate(([id, goal]) => {
      const H = kitten.house, side = H.DOORS[0][id], b = kitten.brain;
      const to = goal === 'spot' ? side.spot : (id === 'room' ? {x: 0, z: .3} : {x: 2.5, z: 3.2});
      kitten.walkTo(new b.pos.constructor(to.x, 0, to.z));
      return to;
    }, [id, goal]);
    let worst = 0, arrived = false, path = [];
    for (let i = 0; i < 160 && !arrived; i++) {
      await step(8);
      const s = await page.evaluate(([id, goal]) => {
        const b = kitten.brain, H = kitten.house, p = {x: b.pos.x, z: b.pos.z};
        // Off her ground: outside the lane and outside her floor fence.
        const lane = H.laneAt(id, p);
        let off = 0;
        if (!lane) { if (id === 'room') { const dx = (p.x + .4) / 1.55, dz = (p.z - .3) / 1.2; off = Math.max(0, (Math.hypot(dx, dz) - 1) * 1.2); } else { const c = kitten.kitchen.clampFloor(new b.pos.constructor(p.x, 0, p.z)); off = Math.hypot(c.x - p.x, c.z - p.z); } }
        return {p: [+p.x.toFixed(2), +p.z.toFixed(2)], off, act: b.activity, target: !!b.target};
      }, [id, goal]);
      worst = Math.max(worst, s.off); path.push(s.p);
      arrived = s.act !== 'walk' && !s.target;
    }
    const end = path.at(-1), d = Math.hypot(end[0] - r.x, end[1] - r.z);
    ok(`${id}: walks ${leg}`, arrived && d < .35, `ends at ${end} (${d.toFixed(2)} from ${r.x}, ${r.z})`);
    ok(`${id}: stays in the lane or on her floor (${leg})`, worst < .12, `worst ${worst.toFixed(2)} off`);
    if (goal === 'spot') {
      const [x, z] = end;
      await look(kitchen ? {focus: [x, .8, z], yaw: .35, pitch: .35, dist: 5} : {focus: [x, .8, z], yaw: -1.0, pitch: .35, dist: 5});
      await page.locator('canvas').first().screenshot({path: `${OUT}/${id}-at-door.png`});
    }
  }
  ok(`${id}: no page errors`, errors.length === 0, errors.join('; '));
  await close();
}
console.log(checks.filter(Boolean).length + ' of ' + checks.length + ' passed');
process.exitCode = checks.every(Boolean) ? 0 : 1;
