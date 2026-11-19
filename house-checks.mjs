// The house map (dist/house.js): rooms and doorways line up.
import assert from 'node:assert/strict';
import {ROOMS, DOORS, toHouse, fromHouse, convert, convertYaw, placeOf, doorBetween, laneAt, pastDoor, neighbours, nextRoom, opening} from './dist/house.js';
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
// The hall hangs off the kitchen: the way there from the study is by the
// kitchen, and its doorway's opening is the same hole from both sides.
assert.deepEqual(neighbours('kitchen'), ['room', 'hall']); assert.equal(doorBetween('room', 'hall'), null);
assert.equal(nextRoom('room', 'hall'), 'kitchen'); assert.equal(nextRoom('hall', 'room'), 'kitchen'); assert.equal(nextRoom('hall', 'kitchen'), 'kitchen'); assert.equal(nextRoom('hall', 'hall'), null);
for (const d of DOORS) {
  const [a, b] = d.rooms, A = opening(a, b, 1), B = opening(b, a, -1);
  for (const p of A) { const q = convert({x: p[0], z: p[2]}, a, b); assert.ok(B.some(c => Math.abs(c[0] - q.x) < 1e-6 && Math.abs(c[2] - q.z) < 1e-6 && c[1] === p[1]), `${a}-${b} opening`); }
}
// (Its walls: 14 long on the kitchen's wall, to the front at the house's z 11.6.)
{ const a = toHouse('hall', {x: -7, z: 0}), b = toHouse('hall', {x: 7, z: 5.05}); near(a.x, -19.05); near(a.z, 6.55); near(b.x, -5.05); near(b.z, 11.6); }
console.log('PASS: house map: rooms placed as before, the hall off the kitchen, doorway sides meet, lanes hold their spots.');
