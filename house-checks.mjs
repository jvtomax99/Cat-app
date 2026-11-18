// The house map (dist/house.js): rooms and doorways line up.
import assert from 'node:assert/strict';
import {ROOMS, DOORS, toHouse, fromHouse, convert, convertYaw, placeOf, doorBetween, laneAt, pastDoor, neighbours} from './dist/house.js';
const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);
// The old fixed join (before house.js): the kitchen seen from the study, and back.
let k = placeOf('kitchen', 'room'); near(k.at.x, -9.25); near(k.at.z, -3.9); near(k.ry, -Math.PI / 2);
let r = placeOf('room', 'kitchen'); near(r.at.x, 3.9); near(r.at.z, -9.25); near(r.ry, Math.PI / 2);
let h = placeOf('room', 'room'); near(h.at.x, 0); near(h.at.z, 0); near(h.ry, 0);
for (const id in ROOMS) { const p = {x: 1.3, z: -2.7}, q = fromHouse(id, toHouse(id, p)); near(q.x, p.x); near(q.z, p.z); }
for (const d of DOORS) {
  const [a, b] = d.rooms, A = d[a], B = d[b];
  // Both sides' middle of the opening is the same spot in the house; their
  // ways through are opposite; each spot is on its own side, each lane
  // reaches past the middle and holds its spot and mouth.
  const m = convert(A.mid, a, b); near(m.x, B.mid.x, 1e-6); near(m.z, B.mid.z, 1e-6);
  const o = convert({x: A.mid.x + A.out.x, z: A.mid.z + A.out.z}, a, b);
  near(o.x - m.x, -B.out.x, 1e-6); near(o.z - m.z, -B.out.z, 1e-6);
  for (const [id, S] of [[a, A], [b, B]]) {
    assert.ok(pastDoor(S, S.spot) < -.5 && pastDoor(S, S.mouth) < pastDoor(S, S.spot), id);
    assert.equal(laneAt(id, S.spot), S); assert.equal(laneAt(id, S.mouth), S);
    assert.equal(laneAt(id, S.mid), S);
  }
  assert.equal(doorBetween(a, b).here, A); assert.equal(doorBetween(b, a).there, A);
}
assert.deepEqual(neighbours('room'), ['kitchen']); assert.equal(doorBetween('room', 'room'), null);
near(convertYaw(0, 'kitchen', 'room'), -Math.PI / 2);
console.log('PASS: house map: rooms placed as before, doorway sides meet, lanes hold their spots.');
