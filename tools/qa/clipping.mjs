// Going-through-furniture check, every room: lets her live in a room (her
// own choices, plus walks to random spots and up to the room's perches) and
// measures every point of her body (bones as balls) and her tail along its
// length against the room's real triangles: every mesh of the place, merged
// pieces included, walls too (hidden ones as well: the Room view hides the
// near walls, they are still there). Negative = that much of her went
// through. Contact with a top (a surface facing up: floor, seat, shelf, bed)
// counts only past half a ball's radius and 2 cm more: the balls are fatter
// than she is, and lying on a thing presses into it a little.
//   ROOM=study,kitchen,living,hall,landing,bedroom,bathroom (the default: all)
//   SEC=150 per room, SEED=5, SHOTS=1, OUT=qa-out
// Prints, per room: the worst moments per thing (body and tail apart), and
// a screenshot of the worst body and tail moment in each room.
import fs from 'node:fs';
import {open} from './lib.mjs';
const ROOMS = (process.env.ROOM || 'study,kitchen,living,hall,landing,bedroom,bathroom').split(',');
const SEC = +(process.env.SEC || 150), SEED = +(process.env.SEED || 5), SHOTS = process.env.SHOTS !== '0', OUT = process.env.OUT || 'qa-out';
fs.mkdirSync(OUT, {recursive: true});
const {page, step, look, close} = await open({seed: SEED, quiet: false});

await page.evaluate(() => {
  const k = kitten, V3 = k.cat.root.position.constructor;
  const B = k.cat.bones, M = k.cat.motion.rig, tip = M.tailTip;
  const pts = [['hips', .12], ['spine', .13], ['chest', .13], ['neck', .1], ['head', .09], ['jaw', .07], ['earL', .03], ['earR', .03], ['shoulderL', .06], ['shoulderR', .06], ['elbowL', .05], ['elbowR', .05], ['wristL', .04], ['wristR', .04], ['hipL', .07], ['hipR', .07], ['kneeL', .05], ['kneeR', .05], ['hockL', .04], ['hockR', .04]];
  const CELL = .25, REACH = .35; // (grid cell; how far from a point we look for a surface)
  // Where she is, by name (the picker's rooms).
  const where = () => { const p = k.place; if (p === k.room) return 'study'; if (p === k.kitchen) return k.kitchen.half === 'living' ? 'living' : 'kitchen'; return k.hall.level === 'up' ? (k.hall.wing === 'landing' ? 'landing' : k.hall.wing) : 'hall'; };
  // A name for a mesh: its own or an ancestor's name, else its shape and where it is.
  const label = (m, c) => { for (let p = m; p && p !== k.place.group; p = p.parent) if (p.name) return p.name; return `${m.geometry.type.replace('Geometry', '')}@${c.x.toFixed(1)},${c.y.toFixed(1)},${c.z.toFixed(1)}`; };
  // Triangles of the current place, sorted into a grid of cells.
  let grid = null, key = '';
  const build = () => {
    const g = k.place.group, skip = new Set();
    for (const s of [k.cat.root, k.kitchen?.vacuum, k.kitchen?.dog?.g, k.toy].filter(Boolean)) s.traverse(o => skip.add(o));
    g.updateMatrixWorld(true);
    const cells = new Map(), tris = [], a = new V3(), b = new V3(), c = new V3(), e1 = new V3(), e2 = new V3();
    const shown = m => { for (let p = m; p && p !== g; p = p.parent) if (!p.visible) return false; return true; };
    g.traverse(m => {
      if (!m.isMesh || m.isInstancedMesh || skip.has(m) || m.isSkinnedMesh) return;
      const pos = m.geometry.attributes.position; if (!pos) return;
      const first = tris.length;
      m.geometry.computeBoundingBox();
      const bb = m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld), h = bb.max.y - bb.min.y;
      // (A hidden mesh counts if it's tall: a wall the Room view hid. Not
      // a stored-away decoration or a see-through glow.)
      if (!shown(m) && h < 1.5) return;
      const mat = Array.isArray(m.material) ? m.material[0] : m.material;
      if (mat?.transparent && mat.opacity < .3 || mat?.visible === false) return;
      const name = label(m, bb.getCenter(new V3())), idx = m.geometry.index, n = (idx ? idx.count : pos.count) / 3;
      // (A mirrored mesh's triangles wind the other way: flip them back. A
      // flat sheet facing one way (a wall as one plane) has its back as
      // inside; one drawn both ways, or with faces both ways (a flat mat
      // shape with its two caps), has no inside.)
      const flip = m.matrixWorld.determinant() < 0 ? -1 : 1, flat = Math.min(bb.max.x - bb.min.x, h, bb.max.z - bb.min.z) < .02;
      let sheet = flat && mat?.side !== 0, n0 = null;
      for (let i = 0; i < n; i++) {
        const ia = idx ? idx.getX(3 * i) : 3 * i, ib = idx ? idx.getX(3 * i + 1) : 3 * i + 1, ic = idx ? idx.getX(3 * i + 2) : 3 * i + 2;
        a.fromBufferAttribute(pos, ia).applyMatrix4(m.matrixWorld); b.fromBufferAttribute(pos, ib).applyMatrix4(m.matrixWorld); c.fromBufferAttribute(pos, ic).applyMatrix4(m.matrixWorld);
        const nm = e1.subVectors(b, a).cross(e2.subVectors(c, a)); const len = nm.length(); if (len < 1e-9) continue; nm.divideScalar(flip * len);
        if (flat && !sheet) { if (!n0) n0 = nm.clone(); else if (n0.dot(nm) < .9) sheet = true; }
        const t = {a: a.clone(), b: b.clone(), c: c.clone(), n: nm.clone(), name, top: nm.y > .7 || h < .03, mesh: m}; // (a rug: its edges count as its top)
        const ti = tris.push(t) - 1;
        const x0 = Math.floor(Math.min(a.x, b.x, c.x) / CELL), x1 = Math.floor(Math.max(a.x, b.x, c.x) / CELL), y0 = Math.floor(Math.min(a.y, b.y, c.y) / CELL), y1 = Math.floor(Math.max(a.y, b.y, c.y) / CELL), z0 = Math.floor(Math.min(a.z, b.z, c.z) / CELL), z1 = Math.floor(Math.max(a.z, b.z, c.z) / CELL);
        if ((x1 - x0 + 1) * (y1 - y0 + 1) * (z1 - z0 + 1) > 4e4) continue; // (a sky sheet or the like)
        for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) { const kk = x + ',' + y + ',' + z; let l = cells.get(kk); if (!l) cells.set(kk, l = []); l.push(ti); }
      }
      for (let i = first; i < tris.length; i++) tris[i].sheet = sheet;
    });
    grid = {cells, tris};
    return tris.length;
  };
  // The closest surface to p within REACH: signed distance (negative =
  // behind the face, i.e. inside the thing) and which triangle.
  const q = new V3(), d = new V3();
  let face = false; // (the closest point is inside a face, not on an edge or a corner)
  const closestOnTri = (p, t, out) => {
    face = false;
    // (Real-Time Collision Detection, 5.1.5.)
    const {a, b, c} = t, ab = e1.subVectors(b, a), ac = e2.subVectors(c, a), ap = e3.subVectors(p, a);
    const d1 = ab.dot(ap), d2 = ac.dot(ap); if (d1 <= 0 && d2 <= 0) return out.copy(a);
    const bp = e4.subVectors(p, b), d3 = ab.dot(bp), d4 = ac.dot(bp); if (d3 >= 0 && d4 <= d3) return out.copy(b);
    const vc = d1 * d4 - d3 * d2; if (vc <= 0 && d1 >= 0 && d3 <= 0) return out.copy(a).addScaledVector(ab, d1 / (d1 - d3));
    const cp = e4.subVectors(p, c), d5 = ab.dot(cp), d6 = ac.dot(cp); if (d6 >= 0 && d5 <= d6) return out.copy(c);
    const vb = d5 * d2 - d1 * d6; if (vb <= 0 && d2 >= 0 && d6 <= 0) return out.copy(a).addScaledVector(ac, d2 / (d2 - d6));
    const va = d3 * d6 - d5 * d4; if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) return out.copy(b).addScaledVector(e4.subVectors(c, b), (d4 - d3) / (d4 - d3 + d5 - d6));
    face = true; const den = 1 / (va + vb + vc); return out.copy(a).addScaledVector(ab, vb * den).addScaledVector(ac, vc * den);
  };
  const e1 = new V3(), e2 = new V3(), e3 = new V3(), e4 = new V3();
  const probe = p => {
    const cx = Math.floor(p.x / CELL), cy = Math.floor(p.y / CELL), cz = Math.floor(p.z / CELL), seen = new Set();
    let best = null, bd = REACH;
    for (let x = cx - 2; x <= cx + 2; x++) for (let y = cy - 2; y <= cy + 2; y++) for (let z = cz - 2; z <= cz + 2; z++) {
      const l = grid.cells.get(x + ',' + y + ',' + z); if (!l) continue;
      for (const ti of l) { if (seen.has(ti)) continue; seen.add(ti); const t = grid.tris[ti]; closestOnTri(p, t, q); const dd = q.distanceTo(p); if (dd < bd - 1e-6 || dd < bd + 1e-6 && face && best && !best.face) { bd = dd; best = {t, q: q.clone(), face}; } }
    }
    if (!best) return null;
    // (Inside only behind a face; near an edge or a corner, or by a thin
    // sheet, it's the distance.)
    const s = best.face && !best.t.sheet && d.subVectors(p, best.q).dot(best.t.n) < 0 ? -1 : 1;
    return {d: s * bd, t: best.t};
  };
  const worst = {}, log = [];
  const note = (room, kind, thing, part, d, t, top) => {
    const kk = room + '|' + kind + '|' + thing, w = worst[kk];
    if (!w || d < w.d) worst[kk] = {room, kind, thing, part, d, t, top, act: k.brain.activity, perch: k.brain.perch || '', x: k.brain.pos.x, y: k.brain.elevation, z: k.brain.pos.z};
    if (d < -.01 && (!log.length || log[log.length - 1].kk !== kk || t - log[log.length - 1].t > 2)) log.push({kk, room, kind, thing, part, d, t, act: k.brain.activity});
  };
  const P = new V3(), Q = new V3(), X = new V3();
  const check = (room, kind, part, p, r, t) => {
    const h = probe(p); if (!h) return;
    // (On a top, a ball is fatter than she is: only sinking past half its
    // radius and 2 cm more counts.)
    const c = h.t.top ? Math.min(0, h.d - .5 * r + .02) : h.d - r;
    if (c < .05) note(room, kind, h.t.name, part, c, t, h.t.top);
  };
  window.__clip = {worst, log, secs: {}, tris: 0, where,
    measure(t) {
      const room = where(), kk = room + (k.hall?.level || '') + (k.hall?.wing || '');
      if (kk !== key) { key = kk; this.tris = build(); }
      if (k.brain.jump) return; // (mid-air jumps: the arc isn't a walk)
      this.secs[room] = (this.secs[room] || 0) + 1 / 20;
      for (const [n, r] of pts) { B[n].getWorldPosition(P); check(room, 'body', n, P, r, t); }
      for (let i = 0; i < 8; i++) {
        B['tail' + i].getWorldPosition(P);
        if (i < 7) B['tail' + (i + 1)].getWorldPosition(Q); else B.tail7.localToWorld(Q.copy(tip));
        for (let j = 0; j < 3; j++) { const u = j / 3, r = M.tailR[i] * (1 - u) + M.tailR[i + 1] * u; X.lerpVectors(P, Q, u); check(room, 'tail', 'tail' + i + (j ? '+' + j : ''), X, r, t); }
      }
      B.tail7.localToWorld(Q.copy(tip)); check(room, 'tail', 'tip', Q, M.tailR[8], t);
    }};
});

const tick = () => page.evaluate(() => {
  const r = kitten.renderer, render = r.render; __vt.on = true;
  try { for (let i = 0; i < 20; i++) { r.render = i === 19 ? render : () => {}; kitten.step(1 / 20, 1); __vt.tick(50); __clip.measure(__vt.now / 1000); } } finally { r.render = render; }
  return Object.values(__clip.worst).filter(w => w.d < -.01).map(w => `${w.room}|${w.kind}|${w.thing}|${w.d.toFixed(3)}`);
});
const shotOf = {};
for (const room of ROOMS) {
  await page.evaluate(r => kitten.goTo(r === 'study' ? 'room' : r), room);
  const perches = await page.evaluate(() => Object.keys(kitten.PERCHES || {}));
  let pi = 0;
  for (let s = 0; s < SEC; s++) {
    // Every 12 s: a walk to a random spot, or up to one of the room's
    // perches, or left to her own choices; back if she's wandered off.
    if (s % 12 === 6) await page.evaluate(([room, perch, r]) => {
      const k = kitten; if (k.brain.mode !== 'idle' || k.brain.jump) return;
      if (__clip.where() !== room) return k.goTo(room === 'study' ? 'room' : room);
      if (r < .45) { const p = k.place.randomFloorPoint ? k.place.randomFloorPoint(.1) : k.brain.pos.clone().set(Math.random() * 7 - 3.5, 0, Math.random() * 4.5 - 2); if (p) k.walkTo(p, null, Math.random() < .3); }
      else if (r < .7 && perch) k.jumpTo(perch, () => k.setActivity('sit'), 2);
      else if (k.brain.perch) k.stroll();
    }, [room, perches[pi++ % Math.max(1, perches.length)], Math.random()]);
    const worse = await tick();
    for (const w of worse) {
      const [r, kind] = w.split('|'), kk = r + kind, d = +w.split('|')[3];
      if (!SHOTS || (shotOf[kk] && shotOf[kk].d <= d)) continue;
      shotOf[kk] = {d};
      // (From where the Room view looks, closer in.)
      const [x, y, z, yaw] = await page.evaluate(() => { const k = kitten, p = k.cat.bones.spine.getWorldPosition(k.cat.root.position.clone()); k.CAMERA_VIEWS.room(); return [p.x, p.y, p.z, k.view.goal.yaw]; });
      await look({focus: [x, y, z], yaw, pitch: .45, dist: 2.4});
      await page.screenshot({path: `${OUT}/clip-${r}-${kind}.png`});
    }
  }
  const t = await page.evaluate(() => __clip.tris);
  console.log(`${room}: done (${t} triangles in its place)`);
}
const {worst, log, secs} = await page.evaluate(() => ({worst: Object.values(__clip.worst), log: __clip.log, secs: __clip.secs}));
console.log(`\nSeed ${SEED}, ${SEC} s a room. Closest approach per thing, metres (negative = went through; "top" = into a surface facing up, past what is allowed):`);
for (const room of Object.keys(secs)) {
  console.log(`\n${room} (${secs[room].toFixed(0)} s on her feet or lying):`);
  for (const kind of ['body', 'tail']) {
    const ws = worst.filter(w => w.room === room && w.kind === kind).sort((a, b) => a.d - b.d);
    const bad = ws.filter(w => w.d < -.01), lim = kind === 'tail' ? -.03 : -.01;
    console.log(`  ${kind}: ${ws.filter(w => w.d < lim).length ? 'FAIL' : 'PASS'} (${bad.length} thing(s) under -1 cm)`);
    for (const w of ws.slice(0, 8)) console.log(`    ${w.d.toFixed(3).padStart(7)}  ${w.thing}${w.top ? ' (top)' : ''}: ${w.part} at ${w.t.toFixed(1)} s, ${w.act}${w.perch ? ' on ' + w.perch : ''} at ${w.x.toFixed(2)},${w.y.toFixed(2)},${w.z.toFixed(2)}`);
  }
}
console.log(`\n${log.length} overlap moment(s) over 1 cm:`);
for (const e of log.slice(0, 80)) console.log(`  ${e.t.toFixed(1).padStart(6)} s  ${e.room.padEnd(8)} ${e.kind} ${e.thing.slice(0, 34).padEnd(34)} ${e.part.padEnd(9)} ${e.d.toFixed(3)} ${e.act}`);
await close();
