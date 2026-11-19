// Vacuum check ("Vision"): runs the kitchen robot vacuum, with her riding it,
// stalking and swatting it, and walking about, and reports how close the
// vacuum and every point of her body (bones, the tail along its length)
// came to every solid thing on the kitchen floor: the island and its base,
// the stools (seats, legs, foot bars), her bowl and fountain, the dock, the
// back counter, the walls, and the tent's footprint. The solids are read
// off the real meshes (boxes, and round things as cylinders), not the
// walking keep-out boxes, so a negative number means a real overlap.
//   node tools/qa/vacuum.mjs          (SEC=400, SEED=5, SHOTS=1, OUT=qa-out, AT=)
// Prints the closest approach per solid for: the vacuum (alone / with her
// riding), her body riding, her body on the floor, her tail (riding and on
// the floor), and a log of every overlap. A screenshot of the worst moment
// of each kind goes to OUT/vacuum-<kind>.png (SHOTS=0 to skip them: a
// screenshot nudges the clock by a frame).
import fs from 'node:fs';
import {open} from './lib.mjs';
const SEC = +(process.env.SEC || 400), SEED = +(process.env.SEED || 5), SHOTS = process.env.SHOTS !== '0', OUT = process.env.OUT || 'qa-out';
// AT=58,97: a picture at those seconds too (the same moments before and
// after a change, for comparing).
const AT = (process.env.AT || '').split(',').filter(Boolean).map(Number);
fs.mkdirSync(OUT, {recursive: true});
const {page, step, look, close} = await open({seed: SEED, kitchen: true, quiet: false});

await page.evaluate(() => {
  const k = kitten, K = k.kitchen, V3 = k.cat.root.position.constructor;
  // Known anchors on the floor, to name the solids by.
  const anchors = [['island', -1.2, .7], ['stool L', -3.0, 2.4], ['stool R', -1.85, 2.4], ['fountain', 3.0, 1.55], ['bowl', 4.55, 2.6], ['dock', 3.15, -2.62]];
  const groups = [[K.island, 'island'], [K.counterGroup, 'counter'], [k.room.bowl, 'bowl'], [k.room.fountain, 'fountain']];
  const walls = new Set(); for (const w of K.walls) w.traverse?.(o => walls.add(o));
  const nameOf = (m, c, b) => {
    for (const [g, n] of groups) { let p = m; while (p) { if (p === g) return n; p = p.parent; } }
    if (walls.has(m)) return 'wall';
    if (b.x1 < -5.8) return 'window wall'; if (b.z0 < -4.1) return 'back wall'; if (b.x0 > 6.9) return 'right wall'; if (b.z0 < -4.19 && b.z1 <= -4.2) return 'doorway';
    let best = null, bd = 9;
    for (const [n, x, z] of anchors) { const d = Math.hypot(c.x - x, c.z - z); if (d < bd && d < .9) { bd = d; best = n; } }
    return best || `other(${m.name || m.geometry.type}@${c.x.toFixed(1)},${c.z.toFixed(1)})`;
  };
  const skip = new Set(); for (const g of [K.vacuum, K.bed, k.cat.root, K.dog?.g].filter(Boolean)) g.traverse(o => skip.add(o));
  const shown = m => { for (let p = m; p; p = p.parent) if (!p.visible && p !== K.group) return false; return true; };
  const solids = [];
  K.group.updateMatrixWorld(true);
  K.group.traverse(m => {
    if (!m.isMesh || m.isInstancedMesh || skip.has(m) || !shown(m)) return;
    m.geometry.computeBoundingBox();
    const b = m.geometry.boundingBox, mn = new V3(Infinity, Infinity, Infinity), mx = new V3(-Infinity, -Infinity, -Infinity), p = new V3();
    for (let i = 0; i < 8; i++) { p.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).applyMatrix4(m.matrixWorld); mn.min(p); mx.max(p); }
    // Only things standing on the floor, low enough to meet her or the
    // vacuum (walls, the counter and the island included); not the floor
    // itself, the rugs and mats, or the shelves and decor up high.
    if (mx.y - mn.y < .03 || mn.y > 1.3 || mx.y < .02) return;
    if (mx.x < -6.1 || mn.x > 7.1 || mn.z > 4.6 || mx.z < -4.3) return;
    const c = {x: (mn.x + mx.x) / 2, z: (mn.z + mx.z) / 2};
    // (Round things stand upright: a cylinder lying on its side, the
    // stools' foot bar, is a box.)
    const w = mx.x - mn.x, d = mx.z - mn.z, round = /Cylinder|Lathe|Circle|Torus|Sphere|Dodecahedron/.test(m.geometry.type) && Math.min(w, d) > .7 * Math.max(w, d);
    solids.push({name: nameOf(m, c, {x0: mn.x, x1: mx.x, z0: mn.z, z1: mx.z}), kind: round ? 'cyl' : 'box', x0: mn.x, x1: mx.x, y0: mn.y, y1: mx.y, z0: mn.z, z1: mx.z, cx: c.x, cz: c.z, r: Math.max(mx.x - mn.x, mx.z - mn.z) / 2});
  });
  // The tent: its footprint, poles to poles (she goes in by the door, so
  // only the vacuum and her riding it are held to it).
  const T = {x: K.bed.position.x, z: K.bed.position.z, ry: K.bed.rotation.y};
  // Signed distance from a point to a solid (negative = inside), minus a radius.
  const toSolid = (s, x, y, z, r) => {
    // (Resting on top of a thing counts as clear.)
    if (y < s.y0 - r || y > s.y1 + r - .01) return 9;
    let d;
    if (s.kind === 'cyl') d = Math.hypot(x - s.cx, z - s.cz) - s.r;
    else { const dx = Math.max(s.x0 - x, 0, x - s.x1), dz = Math.max(s.z0 - z, 0, z - s.z1); d = dx > 0 || dz > 0 ? Math.hypot(dx, dz) : -Math.min(x - s.x0, s.x1 - x, z - s.z0, s.z1 - z); }
    return d - r;
  };
  const toTent = (x, y, z, r) => {
    if (y > 1.9) return 9;
    const dx = x - T.x, dz = z - T.z, lx = Math.cos(T.ry) * dx - Math.sin(T.ry) * dz, lz = Math.sin(T.ry) * dx + Math.cos(T.ry) * dz;
    return Math.max(Math.abs(lx) - 1.35, Math.abs(lz) - 1.05) - r;
  };
  const B = k.cat.bones, M = k.cat.motion.rig, tip = M.tailTip;
  const pts = [['hips', .12], ['spine', .13], ['chest', .13], ['neck', .1], ['head', .09], ['jaw', .07], ['earL', .03], ['earR', .03], ['shoulderL', .06], ['shoulderR', .06], ['elbowL', .05], ['elbowR', .05], ['wristL', .04], ['wristR', .04], ['hipL', .07], ['hipR', .07], ['kneeL', .05], ['kneeR', .05], ['hockL', .04], ['hockR', .04]];
  const P = new V3(), Q = new V3();
  const worst = {}, log = [];
  const note = (kind, solid, name, d, t) => {
    const key = kind + '|' + solid, w = worst[key];
    if (!w || d < w.d) worst[key] = {kind, solid, d, name, t, state: k.kitchen.vac.state, act: k.brain.activity, perch: k.brain.perch || '', vx: K.vacuum.position.x, vz: K.vacuum.position.z, px: k.brain.pos.x, pz: k.brain.pos.z};
    if (d < 0 && (!log.length || log[log.length - 1].key !== key || t - log[log.length - 1].t > 1)) log.push({key, kind, solid, name, d, t});
  };
  const check = (kind, name, x, y, z, r, t, tent) => {
    for (const s of solids) { const d = toSolid(s, x, y, z, r); if (d < .5) note(kind, s.name, name, d, t); }
    if (tent) { const d = toTent(x, y, z, r); if (d < .5) note(kind, 'tent', name, d, t); }
  };
  // Her centre past the walking floor (kitchen.js FLOOR) while on it: who
  // sent her there.
  const FL = {x0: -5.25, x1: 9.3, z0: -2.15, z1: 23.2}; // (on through the living room)
  window.__qa = {solids, worst, log, off: [], rideSec: 0, floorSec: 0, frames: 0, measure(t) {
    const v = K.vacuum.position, br = k.brain, riding = br.perch === 'vacuum', floor = !br.perch && br.elevation < .05 && !br.jump;
    this.frames++;
    if (floor && (br.pos.x < FL.x0 - .03 || br.pos.x > FL.x1 + .03 || br.pos.z < FL.z0 - .03 || br.pos.z > FL.z1 + .03) && (!this.off.length || t - this.off[this.off.length - 1].t > 1)) {
      const tg = br.target; this.off.push({t, act: br.activity, mode: br.mode, x: br.pos.x, z: br.pos.z, tx: tg?.x, tz: tg?.z});
    }
    // The vacuum: a disc, r .43, .12 high (the dock is its home: not counted).
    if (K.vac.state !== 'docked') {
      for (const s of solids) { if (s.name === 'dock') continue; const d = toSolid(s, v.x, .06, v.z, .43); if (d < .5) note(riding ? 'vacuum riding' : 'vacuum', s.name, 'disc', d, t); }
      const d = toTent(v.x, .06, v.z, .43); if (d < .5) note(riding ? 'vacuum riding' : 'vacuum', 'tent', 'disc', d, t);
    }
    if (!riding && !floor) return;
    if (riding) this.rideSec += 1 / 20; else this.floorSec += 1 / 20;
    const kind = riding ? 'body riding' : 'body floor', tk = riding ? 'tail riding' : 'tail floor';
    for (const [n, r] of pts) { B[n].getWorldPosition(P); check(kind, n, P.x, P.y, P.z, r, t, riding); }
    // The tail, sampled along each link (3 points a link) out to the tip.
    for (let i = 0; i < 8; i++) {
      B['tail' + i].getWorldPosition(P);
      if (i < 7) B['tail' + (i + 1)].getWorldPosition(Q); else B.tail7.localToWorld(Q.copy(tip));
      for (let j = 0; j < 3; j++) { const u = j / 3, r = M.tailR[i] * (1 - u) + M.tailR[i + 1] * u; check(tk, 'tail' + i + (j ? '+' + j : ''), P.x + (Q.x - P.x) * u, P.y + (Q.y - P.y) * u, P.z + (Q.z - P.z) * u, r, t, riding); }
    }
    B.tail7.localToWorld(Q.copy(tip)); check(tk, 'tip', Q.x, Q.y, Q.z, M.tailR[8], t, riding);
  }};
});
const solids = await page.evaluate(() => __qa.solids.map(s => `${s.name} ${s.kind} x ${s.x0.toFixed(2)}..${s.x1.toFixed(2)} z ${s.z0.toFixed(2)}..${s.z1.toFixed(2)} y ${s.y0.toFixed(2)}..${s.y1.toFixed(2)}`));
console.log(`${solids.length} solids on the kitchen floor:`); for (const s of solids) console.log('  ' + s);

// Step a second at a time, measuring after every frame (drawing only the last).
const tick = () => page.evaluate(() => {
  const r = kitten.renderer, render = r.render; __vt.on = true;
  try { for (let i = 0; i < 20; i++) { r.render = i === 19 ? render : () => {}; kitten.step(1 / 20, 1); __vt.tick(50); __qa.measure(__vt.now / 1000); } } finally { r.render = render; }
  return Object.values(__qa.worst).filter(w => w.d < 0).map(w => w.kind + '|' + w.solid + '|' + w.d.toFixed(3));
});
let seen = new Set(), shots = {};
for (let s = 0; s < SEC; s++) {
  // Every 25 s: the vacuum out if it's home; she rides it, stalks it, or
  // just gets on with her day (and reacts to it on her own too).
  if (s % 25 === 0) await page.evaluate(() => { const k = kitten; if (k.kitchen.vac.state === 'docked') k.kitchen.startVacuum(performance.now() / 1000); const r = Math.random(); if (k.brain.mode === 'idle' && k.brain.perch !== 'vacuum') { if (r < .5) k.vacuumRide(); else if (r < .8) k.vacuumAttack(); } });
  const worse = await tick();
  if (AT.includes(s + 1)) {
    const [x, , z] = await page.evaluate(() => { const p = kitten.brain.pos; return [p.x, p.y, p.z]; });
    await look({focus: [x, .3, z], yaw: .3, pitch: .8, dist: 3.2});
    await page.screenshot({path: `${OUT}/vacuum-at-${s + 1}.png`});
  }
  // A new worst overlap of a kind: a picture of it.
  for (const w of worse) {
    if (seen.has(w)) continue; seen.add(w);
    const kind = w.split('|')[0];
    if (!SHOTS || (shots[kind] ?? 0) >= 4) continue;
    shots[kind] = (shots[kind] ?? 0) + 1;
    const st = await page.evaluate(() => { const v = kitten.kitchen.vacuum.position, p = kitten.brain.pos; return [v.x, v.z, p.x, p.z]; });
    const [x, z] = kind.startsWith('vacuum') ? st : st.slice(2);
    await look({focus: [x, .3, z], yaw: .3, pitch: .8, dist: 3.2}); // (from the open front, high enough to clear the island top)
    await page.screenshot({path: `${OUT}/vacuum-${kind.replace(' ', '-')}-${shots[kind]}.png`});
    console.log(`  ${s}s: ${w}  → ${OUT}/vacuum-${kind.replace(' ', '-')}-${shots[kind]}.png`);
  }
}
const {worst, log, off, rideSec, floorSec, frames} = await page.evaluate(() => ({worst: Object.values(__qa.worst), log: __qa.log, off: __qa.off, rideSec: __qa.rideSec, floorSec: __qa.floorSec, frames: __qa.frames}));
console.log(`\n${SEC} s (seed ${SEED}): riding ${rideSec.toFixed(0)} s, on the floor ${floorSec.toFixed(0)} s. Closest approach in metres (negative = went through):`);
for (const kind of ['vacuum', 'vacuum riding', 'body riding', 'tail riding', 'body floor', 'tail floor']) {
  const ws = worst.filter(w => w.kind === kind).sort((a, b) => a.d - b.d);
  if (!ws.length) { console.log(`  ${kind}: (never near anything)`); continue; }
  console.log(`  ${kind}:`);
  for (const w of ws.slice(0, 6)) console.log(`    ${w.solid.padEnd(10)} ${w.d.toFixed(3).padStart(7)}  (${w.name} at ${w.t.toFixed(1)} s, vac ${w.state} at ${w.vx.toFixed(2)},${w.vz.toFixed(2)}, she ${w.act}${w.perch ? ' on ' + w.perch : ''} at ${w.px.toFixed(2)},${w.pz.toFixed(2)})`);
}
console.log(`\n${log.length} overlap(s):`);
for (const e of log) console.log(`  ${e.t.toFixed(1).padStart(6)} s  ${e.kind.padEnd(13)} ${e.solid.padEnd(10)} ${e.name.padEnd(8)} ${e.d.toFixed(3)}`);
console.log(`\n${off.length} moment(s) past the walking floor's edge (her centre, on the floor):`);
for (const e of off) console.log(`  ${e.t.toFixed(1).padStart(6)} s  ${e.act} (${e.mode}) at ${e.x.toFixed(2)},${e.z.toFixed(2)}${e.tx != null ? ` going to ${e.tx.toFixed(2)},${e.tz.toFixed(2)}` : ''}`);
await close();
