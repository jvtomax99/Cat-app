// The house: where each room stands, and the doorways between them.
// House coordinates are the study's own (the study stands at the origin).
// Each room keeps its own frame (x and z as its builder, room.js or
// kitchen.js, lays it out); a room's place in the house is where its
// origin sits and how far it is turned (as a three.js rotation.y).
// Adding a room later = one entry in ROOMS and one in DOORS.
// (No three.js here: plain {x, z} maths, so the checks can run it in node.)

export const ROOMS = {
  room: {name: 'study', at: {x: 0, z: 0}, ry: 0},
  // The kitchen's opening (x 3.8 to 6.2 in its back wall at z -4.2, .45
  // deep) meets the study's (z -.1 to 2.3 in its left wall at x -4.6).
  kitchen: {name: 'kitchen', at: {x: -9.25, z: -3.9}, ry: -Math.PI / 2},
  // The hall lies along the kitchen's right wall (the house's z 6.1), a
  // wall's thickness (.45) beyond it: its own x runs along that wall (east
  // is +x, as in the house), its z from that wall (0) to the front door's.
  hall: {name: 'hall', at: {x: -12.05, z: 6.55}, ry: 0},
};

// Each doorway, seen from each side, in that room's own frame:
//   mid:  the middle of the opening, halfway through the wall (where she
//         changes room);
//   out:  the way through, out of this room (a unit vector);
//   spot: just inside, where she lines up before going through;
//   mouth: where the lane to the door leaves her usual floor;
//   lane: the corridor she may walk from her floor to the opening and a
//         little past it ({x0, x1, z0, z1}).
// width, top: the opening's; deep: the wall's thickness there.
export const DOORS = [{
  rooms: ['room', 'kitchen'], width: 2.4, top: 5.4, deep: .45,
  room: {mid: {x: -4.825, z: 1.1}, out: {x: -1, z: 0}, spot: {x: -3.9, z: 1.1}, mouth: {x: -1.55, z: 1.1}, lane: {x0: -5.4, x1: -1.3, z0: .55, z1: 1.65}},
  // (Clear of the vacuum's dock on the left and the tree on the right.)
  kitchen: {mid: {x: 5.0, z: -4.425}, out: {x: 0, z: -1}, spot: {x: 5.0, z: -3.6}, mouth: {x: 5.0, z: -1.95}, lane: {x0: 4.45, x1: 5.55, z0: -5.0, z1: -1.85}},
}, {
  // The kitchen's right wall (x 10; opening z 3.75 to 6.15, past the
  // painting) to the hall's back wall (z 0; opening x -3.35 to -.95).
  rooms: ['kitchen', 'hall'], width: 2.4, top: 5.4, deep: .45,
  kitchen: {mid: {x: 10.225, z: 4.95}, out: {x: 1, z: 0}, spot: {x: 9.4, z: 4.95}, mouth: {x: 9.1, z: 4.95}, lane: {x0: 9.0, x1: 10.8, z0: 4.4, z1: 5.5}},
  hall: {mid: {x: -2.15, z: -.225}, out: {x: 0, z: -1}, spot: {x: -2.15, z: .6}, mouth: {x: -2.15, z: .95}, lane: {x0: -2.7, x1: -1.6, z0: -.8, z1: 1.05}},
}];

const turn = (p, a) => ({x: p.x * Math.cos(a) + p.z * Math.sin(a), z: -p.x * Math.sin(a) + p.z * Math.cos(a)});
// A point in a room's own frame, in the house; and back.
export function toHouse(id, p) {
  const R = ROOMS[id], q = turn(p, R.ry);
  return {x: q.x + R.at.x, z: q.z + R.at.z};
}
export function fromHouse(id, p) {
  const R = ROOMS[id];
  return turn({x: p.x - R.at.x, z: p.z - R.at.z}, -R.ry);
}
// A point, or a heading (rotation.y), in one room's frame, in another's.
export const convert = (p, from, to) => fromHouse(to, toHouse(from, p));
export const convertYaw = (y, from, to) => y + ROOMS[from].ry - ROOMS[to].ry;
// Where a room stands, and how it's turned, seen from the room she's in
// (which stands at the origin).
export function placeOf(id, here) {
  return {at: convert({x: 0, z: 0}, id, here), ry: ROOMS[id].ry - ROOMS[here].ry};
}
// The doorway from one room to another (null if they don't share one):
// this side and the far side.
export function doorBetween(from, to) {
  const d = DOORS.find(d => d.rooms.includes(from) && d.rooms.includes(to) && from !== to);
  return d ? {here: d[from], there: d[to], width: d.width} : null;
}
// The next room on the way from one room to another (the rooms hang
// together by their doorways; null if there's no way).
export function nextRoom(from, to) {
  if (from === to) return null;
  const seen = new Set([to]), queue = [to];
  while (queue.length) {
    const r = queue.shift();
    for (const n of neighbours(r)) {
      if (n === from) return r;
      if (!seen.has(n)) { seen.add(n); queue.push(n); }
    }
  }
  return null;
}
// A doorway's opening seen from one of its rooms, in that room's frame:
// the four corners of the face a given way through the wall (k = -1: this
// room's face; 1: the far room's), going round.
export function opening(id, other, k) {
  const d = DOORS.find(d => d.rooms.includes(id) && d.rooms.includes(other)), S = d[id], h = d.width / 2;
  const cx = S.mid.x + S.out.x * k * d.deep / 2, cz = S.mid.z + S.out.z * k * d.deep / 2, ax = -S.out.z * h, az = S.out.x * h;
  return [[cx - ax, 0, cz - az], [cx + ax, 0, cz + az], [cx + ax, d.top, cz + az], [cx - ax, d.top, cz - az]];
}
// The rooms a room has a doorway to.
export const neighbours = id => DOORS.filter(d => d.rooms.includes(id)).map(d => d.rooms.find(r => r !== id));
// In a room's lane to a doorway: that doorway (this side), else null.
export function laneAt(id, p) {
  for (const d of DOORS) {
    const s = d[id];
    if (s && p.x >= s.lane.x0 && p.x <= s.lane.x1 && p.z >= s.lane.z0 && p.z <= s.lane.z1) return s;
  }
  return null;
}
// How far past the middle of a doorway she is (above 0: through, into the
// other room).
export const pastDoor = (side, p) => (p.x - side.mid.x) * side.out.x + (p.z - side.mid.z) * side.out.z;
