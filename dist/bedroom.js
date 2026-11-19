// Mochi's bedroom (phase 21, step 3): over the kitchen, through the
// landing's door. A big bed against the east wall, a window seat in the
// north wall, a wardrobe, a dresser with a mirror, a chaise, a rug, a fig.
// The bathroom's door (shut until step 4) is in the east wall, over the
// study's doorway.
//
// Part of the hall's place, as the landing is (the hall's upper floor):
// `Hall` builds it and adds its group to its own, in the hall's frame (x
// along the kitchen's wall, -7 west to 7 east; z from the hall's back wall,
// 0, so the bedroom runs from -.45, the kitchen's wall's far side, to
// -16.45, over the kitchen's window wall). Heights here are above the
// bedroom's floor; the hall adds its upper floor's height (`up`, 10).
import * as THREE from 'three';
import {canvasTexture, drawLinen, roundedBox} from './room.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const rand = (a, b) => a + Math.random() * (b - a);

// The plan (hall frame).
export const B = {
  west: -7, east: 7, south: -.45, north: -16.45, wallH: 9.5,
  // The door from the landing (the hall's `bedDoor`), its leaf standing
  // open into the room; the bathroom's door, over the study's doorway.
  door: {x: -4.6, w: 2.2, h: 5.0},
  bathDoor: {z: -5.45, w: 2.2, h: 5.0},
  window: {x: .5, w: 6.0, sill: 1.9, h: 5.6},
  bed: {x0: 2.45, x1: 6.95, z0: -13.15, z1: -8.15, top: 1.72},
  tables: [[-14.15, -13.35], [-7.95, -7.15]], tableX: 6.0, tableTop: 1.65,
  seat: {x0: -2.95, x1: 3.95, z0: -16.45, z1: -15.45, top: 1.6},
  wardrobe: {x0: 1.85, x1: 6.95, z0: -1.55, z1: -.45, top: 7.6},
  // (On the landing's wall, between the door and the wardrobe: from the
  // Room view, by the west wall, it would stand in front of everything.)
  dresser: {x0: -2.6, x1: .6, z0: -1.35, z1: -.45, top: 2.9},
  chaise: {x0: -6.85, x1: -5.45, z0: -14.05, z1: -10.85, seat: .95},
  rug: {x0: -3.2, x1: 1.8, z0: -12.8, z1: -8.5},
  plant: {x: -6.2, z: -15.6},
};
const D = B.door, d0 = D.x - D.w / 2, d1 = D.x + D.w / 2;
// Where she may walk: her centre .65 from the walls; the lane through the
// doorway; what stands on the floor, kept clear (each with its own margin).
const FLOOR = {x0: B.west + .7, x1: B.east - .7, z0: B.north + .7, z1: B.south - .65};
const LANE = {x0: D.x - .15, x1: D.x + .15, z0: FLOOR.z1 - .05, z1: .75};
const grow = (x0, x1, z0, z1, m) => ({x0: x0 - m, x1: x1 + m, z0: z0 - m, z1: z1 + m});
const KEEP = [
  grow(B.bed.x0, B.east, B.bed.z0, B.bed.z1, .65),
  grow(B.tableX, B.east, B.tables[0][0], B.tables[0][1], .55), grow(B.tableX, B.east, B.tables[1][0], B.tables[1][1], .55),
  grow(B.wardrobe.x0, B.east, B.wardrobe.z0, B.south, .65),
  grow(B.dresser.x0, B.dresser.x1, B.dresser.z0, B.south, .6),
  grow(B.west, B.chaise.x1, B.chaise.z0, B.chaise.z1, .65),
  grow(B.seat.x0, B.seat.x1, B.north, B.seat.z1, .65),
  grow(B.plant.x - .55, B.plant.x + .55, B.plant.z - .55, B.plant.z + .55, .5),
  // (The door's leaf, open against the jamb.)
  grow(d1 - .2, d1 + .05, -2.6, B.south, .4),
];
const inside = (p, r, e = 0) => p.x > r.x0 + e && p.x < r.x1 - e && p.z > r.z0 + e && p.z < r.z1 - e;
// Does the straight walk from a to b cut through a kept-clear patch?
function blocked(a, b) {
  for (const r of KEEP) {
    let t0 = 0, t1 = 1;
    const dx = b.x - a.x, dz = b.z - a.z, e = .01;
    const clip = (p, q) => { if (Math.abs(p) < 1e-9) return q >= 0; const t = q / p; if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; } return true; };
    if (clip(-dx, a.x - (r.x0 + e)) && clip(dx, (r.x1 - e) - a.x) && clip(-dz, a.z - (r.z0 + e)) && clip(dz, (r.z1 - e) - a.z) && t1 - t0 > 1e-6) return true;
  }
  return false;
}
// The corners to walk round (just outside each patch, on her floor).
const CORNERS = KEEP.flatMap(r => [[r.x0 - .03, r.z0 - .03], [r.x1 + .03, r.z0 - .03], [r.x1 + .03, r.z1 + .03], [r.x0 - .03, r.z1 + .03]])
  .map(([x, z]) => V(x, 0, z)).filter(p => p.x >= FLOOR.x0 && p.x <= FLOOR.x1 && p.z >= FLOOR.z0 && p.z <= FLOOR.z1 && !KEEP.some(r => inside(p, r)));

export class Bedroom {
  constructor(hall) {
    this.hall = hall;
    this.group = new THREE.Group();
    this.group.visible = false;
    hall.group.add(this.group);
    this.up = hall.up;
    this.walls = [];
    this.build();
  }

  build() {
    const H = this.hall, M = H.materials, U = this.up;
    const lin = (base, seed, dark = .08) => new THREE.MeshStandardMaterial({map: canvasTexture(256, 256, (g, w, h) => drawLinen(g, w, h, {base, dark, seed})), roughness: 1});
    const N = this.materials = {
      duvet: lin('#efe8dc', 61, .05), sheet: lin('#f6f1e8', 62, .03),
      head: lin('#5d6b7c', 63, .1), throw: lin('#9a5a3a', 64, .14), seat: lin('#8c9a86', 65, .1),
      rug: new THREE.MeshStandardMaterial({map: canvasTexture(512, 512, drawRug), roughness: 1}),
      paint: new THREE.MeshStandardMaterial({color: '#e4dccd', roughness: .55}),
    };
    const g = this.group;
    const batch = (mat, opts) => { const b = H.batch(mat, opts); const done = b.done; b.done = () => { const m = done(); if (m) g.add(m); return m; }; return b; };
    const add = (geo, mat, x, y, z, parent = g, cast = true) => { const m = H.mesh(geo, mat, parent, {cast}); m.position.set(x, y, z); return m; };
    // A wall panel (it hides when the camera swings round behind it).
    const wall = (w, h, x, y, z, ry) => {
      const m = H.mesh(new THREE.PlaneGeometry(w, h), M.plaster, g, {cast: false});
      m.position.set(x, U + y, z); m.rotation.y = ry;
      H.walls.push(m); this.walls.push(m);
      return m;
    };
    const T = B.wallH, W = B.window, w0 = W.x - W.w / 2, w1 = W.x + W.w / 2, BD = B.bathDoor, b0 = BD.z - BD.w / 2, b1 = BD.z + BD.w / 2;
    const lx = B.east - B.west, lz = B.south - B.north, mx = (B.west + B.east) / 2, mz = (B.south + B.north) / 2;
    // The floor (oak, as the landing's; the kitchen's ceiling under it) and
    // the doorway's sill.
    // (The landing's oak, its boards at the same width across this bigger floor.)
    const boards = M.oak.map.clone(); boards.wrapS = boards.wrapT = THREE.RepeatWrapping; boards.repeat.set(3.2, 3.6); boards.needsUpdate = true;
    N.oak = new THREE.MeshStandardMaterial({map: boards, roughness: .5});
    const oak = batch(N.oak), white = batch(M.white, {cast: false});
    oak.box(B.west, B.east, U - .06, U, B.north, B.south); oak.box(d0, d1, U - .06, U, B.south, 0);
    white.box(B.west, B.east, U - .45, U - .06, B.north, B.south);
    // Walls: the landing's side with its doorway, the window wall, the
    // west wall, the east wall with the bathroom's door.
    this.south = [
      wall(d0 - B.west, T, (B.west + d0) / 2, T / 2, B.south, Math.PI),
      wall(D.w, T - D.h, D.x, (T + D.h) / 2, B.south, Math.PI),
      wall(B.east - d1, T, (d1 + B.east) / 2, T / 2, B.south, Math.PI),
    ];
    this.north = [
      wall(w0 - B.west, T, (B.west + w0) / 2, T / 2, B.north, 0),
      wall(W.w, W.sill, W.x, W.sill / 2, B.north, 0),
      wall(W.w, T - W.sill - W.h, W.x, (T + W.sill + W.h) / 2, B.north, 0),
      wall(B.east - w1, T, (w1 + B.east) / 2, T / 2, B.north, 0),
    ];
    this.west = wall(lz, T, B.west, T / 2, mz, Math.PI / 2);
    this.east = [
      wall(b0 - B.north, T, B.east, T / 2, (B.north + b0) / 2, -Math.PI / 2),
      wall(BD.w, T - BD.h, B.east, (T + BD.h) / 2, BD.z, -Math.PI / 2),
      wall(B.south - b1, T, B.east, T / 2, (b1 + B.south) / 2, -Math.PI / 2),
    ];
    // The doorway's lining, through the wall's thickness, and the skirting.
    white.box(d0 - .08, d0, U, U + D.h, B.south, 0).box(d1, d1 + .08, U, U + D.h, B.south, 0).box(d0 - .08, d1 + .08, U + D.h, U + D.h + .1, B.south, 0);
    const skirt = batch(N.paint, {cast: false});
    skirt.box(B.west, d0, U, U + .16, B.south - .04, B.south).box(d1, B.east, U, U + .16, B.south - .04, B.south);
    skirt.box(B.west, B.west + .04, U, U + .16, B.north, B.south).box(B.east - .04, B.east, U, U + .16, B.north, b0).box(B.east - .04, B.east, U, U + .16, b1, B.south);
    skirt.box(B.west, B.east, U, U + .16, B.north, B.north + .04);
    oak.done(); white.done(); skirt.done();

    this.buildWindow(add);
    this.buildBathDoor(add);
    this.buildBed(add, batch);
    this.buildFurniture(add, batch);
    // A rug at the bed's foot.
    const R = B.rug, rug = add(new THREE.PlaneGeometry(R.x1 - R.x0, R.z1 - R.z0), N.rug, (R.x0 + R.x1) / 2, U + .012, (R.z0 + R.z1) / 2, g, false);
    rug.rotation.x = -Math.PI / 2;
    // A fig in the corner by the window seat.
    H.buildPlant(B.plant.x, B.plant.z, U); g.add(H.plant);
  }

  // The window over the seat: the day's light in its glass, white bars, a
  // deep reveal.
  buildWindow(add) {
    const M = this.hall.materials, W = B.window, U = this.up, g = new THREE.Group();
    g.position.set(W.x, U, B.north); this.group.add(g);
    add(new THREE.PlaneGeometry(W.w, W.h), M.glass, 0, W.sill + W.h / 2, .02, g, false);
    for (const x of [-W.w / 2, -W.w / 6, W.w / 6, W.w / 2]) add(new THREE.BoxGeometry(.1, W.h, .12), M.white, x, W.sill + W.h / 2, .06, g, false);
    for (const y of [W.sill, W.sill + W.h * .66, W.sill + W.h]) add(new THREE.BoxGeometry(W.w + .1, .1, .12), M.white, 0, y, .06, g, false);
    for (const x of [-W.w / 2 - .06, W.w / 2 + .06]) add(new THREE.BoxGeometry(.12, W.h + .2, .3), M.white, x, W.sill + W.h / 2, .15, g, false);
    add(new THREE.BoxGeometry(W.w + .24, .12, .3), M.white, 0, W.sill + W.h + .06, .15, g, false);
    this.window = g;
  }

  // The bathroom's door, shut until step 4: white, four panels, a brass knob.
  buildBathDoor(add) {
    const M = this.hall.materials, BD = B.bathDoor, U = this.up, d = new THREE.Group();
    d.position.set(B.east, U, BD.z); d.rotation.y = -Math.PI / 2; this.group.add(d);
    for (const s of [-1, 1]) add(new THREE.BoxGeometry(.14, BD.h + .1, .2), M.white, s * (BD.w / 2 - .07), (BD.h + .1) / 2, .06, d, false);
    add(new THREE.BoxGeometry(BD.w, .14, .2), M.white, 0, BD.h + .03, .06, d, false);
    add(new THREE.BoxGeometry(BD.w - .28, BD.h, .1), M.white, 0, BD.h / 2, .04, d, false);
    const pw = (BD.w - .28) / 2 - .2;
    for (const s of [-1, 1]) for (const [y0, y1] of [[.4, 2.3], [2.6, 4.6]]) add(roundedBox(pw, y1 - y0, .04, .03), M.white, s * (pw / 2 + .07), (y0 + y1) / 2, .1, d, false);
    add(new THREE.SphereGeometry(.09, 16, 12), M.brass, -(BD.w / 2 - .4), 2.4, .16, d, false);
    this.bathDoor = d;
  }

  // The big bed: a walnut frame, an upholstered headboard against the east
  // wall, a deep mattress, a cream duvet turned back, four pillows, a rust
  // throw across the foot; a walnut table each side with a lamp.
  buildBed(add, batch) {
    const M = this.hall.materials, N = this.materials, U = this.up, Bd = B.bed, g = this.group;
    const mz = (Bd.z0 + Bd.z1) / 2, wz = Bd.z1 - Bd.z0, wood = batch(M.walnut);
    wood.box(Bd.x0, Bd.x1 - .2, U + .25, U + .95, Bd.z0, Bd.z1);
    for (const x of [Bd.x0 + .15, Bd.x1 - .35]) for (const z of [Bd.z0 + .15, Bd.z1 - .15]) wood.box(x - .1, x + .1, U, U + .25, z - .1, z + .1);
    const head = add(roundedBox(.3, 3.2, wz + .4, .12), N.head, B.east - .2, U + 2.9, mz);
    const mat = add(roundedBox(Bd.x1 - Bd.x0 - .35, .6, wz - .1, .12), N.sheet, (Bd.x0 + Bd.x1 - .2) / 2, U + 1.25, mz);
    // The duvet over the foot two thirds, its edge turned back.
    const dx0 = Bd.x0 - .08, dx1 = Bd.x0 + 3.0;
    add(roundedBox(dx1 - dx0, .32, wz + .16, .14), N.duvet, (dx0 + dx1) / 2, U + Bd.top - .16, mz);
    add(roundedBox(.5, .14, wz + .1, .06), N.duvet, dx1 + .1, U + Bd.top - .05, mz).rotation.z = -.2;
    // Four pillows leaning on the headboard.
    for (const [z, x, y, s] of [[mz - 1.25, 6.35, 2.15, 1], [mz + 1.25, 6.35, 2.15, 1], [mz - 1.1, 5.95, 1.95, .85], [mz + 1.1, 5.95, 1.95, .85]]) {
      const p = add(roundedBox(.45 * s, 1.0 * s, 2.1 * s, .2 * s), s < 1 ? N.duvet : N.sheet, x, U + y, z);
      p.rotation.z = .35;
    }
    // The throw, across the foot and hanging down each side.
    const thr = batch(N.throw);
    thr.box(Bd.x0 + .3, Bd.x0 + 1.5, U + Bd.top, U + Bd.top + .05, Bd.z0 - .1, Bd.z1 + .1);
    for (const z of [Bd.z0 - .1, Bd.z1 + .05]) thr.box(Bd.x0 + .3, Bd.x0 + 1.5, U + .9, U + Bd.top + .05, z, z + .05);
    thr.done();
    // The bedside tables, each with a lamp (lit in the evening).
    for (const [z0, z1] of B.tables) {
      wood.box(B.tableX, B.east - .05, U + B.tableTop - .1, U + B.tableTop, z0, z1);
      wood.box(B.tableX + .05, B.east - .1, U + .9, U + B.tableTop - .1, z0 + .05, z1 - .05);
      for (const x of [B.tableX + .08, B.east - .13]) for (const z of [z0 + .08, z1 - .08]) wood.box(x - .04, x + .04, U, U + .9, z - .04, z + .04);
      const lamp = new THREE.Group(); lamp.position.set((B.tableX + B.east) / 2, U + B.tableTop, (z0 + z1) / 2); g.add(lamp);
      add(new THREE.CylinderGeometry(.1, .15, .6, 14), M.pot, 0, .3, 0, lamp);
      add(new THREE.CylinderGeometry(.22, .32, .45, 18, 1, true), M.shade, 0, .82, 0, lamp, false);
    }
    wood.done();
    this.bed = mat; this.headboard = head;
  }

  // The window seat (a built-in bench under the window, a sage cushion);
  // the wardrobe along the landing's wall; the dresser and its mirror; the
  // velvet chaise.
  buildFurniture(add, batch) {
    const H = this.hall, M = H.materials, N = this.materials, U = this.up;
    const S = B.seat, Wd = B.wardrobe, Dr = B.dresser, C = B.chaise;
    const paint = batch(N.paint), wood = batch(M.walnut), brass = batch(M.brass);
    paint.box(S.x0, S.x1, U, U + S.top - .22, S.z0, S.z1);
    add(roundedBox(S.x1 - S.x0 - .1, .24, S.z1 - S.z0 - .08, .1), N.seat, (S.x0 + S.x1) / 2, U + S.top - .12, (S.z0 + S.z1) / 2);
    for (const x of [S.x0 + .6, S.x1 - .6]) add(roundedBox(.8, .8, .25, .12), N.head, x, U + S.top + .35, S.z0 + .25).rotation.x = -.2;
    // The wardrobe: two pairs of tall panelled doors under a cornice.
    paint.box(Wd.x0, Wd.x1, U, U + Wd.top, Wd.z0 + .02, Wd.z1);
    paint.box(Wd.x0 - .06, Wd.x1, U + Wd.top, U + Wd.top + .18, Wd.z0 - .06, Wd.z1);
    const n = 4, dw = (Wd.x1 - Wd.x0) / n;
    for (let i = 0; i < n; i++) {
      const x0 = Wd.x0 + i * dw + .12, x1 = Wd.x0 + (i + 1) * dw - .12;
      for (const [y0, y1] of [[.5, 3.6], [3.9, 7.1]]) paint.box(x0, x1, U + y0, U + y1, Wd.z0 - .02, Wd.z0 + .02);
      brass.add(new THREE.SphereGeometry(.06, 10, 8), i % 2 ? x0 + .1 : x1 - .1, U + 3.75, Wd.z0 - .06);
    }
    // The dresser, against the landing's wall: four drawers, brass pulls.
    wood.box(Dr.x0, Dr.x1, U + .2, U + Dr.top, Dr.z0, Dr.z1);
    for (let i = 0; i < 4; i++) {
      const y = U + .45 + i * .62;
      wood.box(Dr.x0 + .1, Dr.x1 - .1, y, y + .5, Dr.z0 - .03, Dr.z0);
      for (const x of [Dr.x0 + .7, Dr.x1 - .7]) brass.box(x - .12, x + .12, y + .2, y + .3, Dr.z0 - .07, Dr.z0 - .03);
    }
    for (const x of [Dr.x0 + .1, Dr.x1 - .1]) wood.box(x - .05, x + .05, U, U + .2, Dr.z0 + .04, Dr.z0 + .14);
    // Its mirror, on the wall (it hides with the wall).
    const wl = this.south[2], mxc = (Dr.x0 + Dr.x1) / 2;
    const frame = H.mesh(new THREE.BoxGeometry(2.0, 2.6, .06), M.brass, wl, {cast: false}); frame.position.set(-(mxc - wl.position.x), 4.6 - (wl.position.y - U), .03);
    const glass = H.mesh(new THREE.PlaneGeometry(1.8, 2.4), M.mirror, wl, {cast: false}); glass.position.set(-(mxc - wl.position.x), 4.6 - (wl.position.y - U), .07);
    // On top: a little brass tray and a jug.
    brass.add(new THREE.CylinderGeometry(.35, .35, .04, 20), mxc - .7, U + Dr.top + .02, (Dr.z0 + Dr.z1) / 2);
    add(new THREE.CylinderGeometry(.14, .18, .55, 14), M.pot, mxc + .8, U + Dr.top + .28, (Dr.z0 + Dr.z1) / 2);
    // The chaise: a velvet seat, its back rising at the window end.
    const cx = (C.x0 + C.x1) / 2, cz = (C.z0 + C.z1) / 2;
    add(roundedBox(C.x1 - C.x0, .5, C.z1 - C.z0, .15), M.velvet, cx, U + C.seat - .25, cz);
    const back = add(roundedBox(C.x1 - C.x0, 1.6, .4, .15), M.velvet, cx, U + C.seat + .55, C.z0 + .3); back.rotation.x = -.35;
    for (const x of [C.x0 + .15, C.x1 - .15]) for (const z of [C.z0 + .15, C.z1 - .15]) wood.box(x - .05, x + .05, U, U + C.seat - .5, z - .05, z + .05);
    add(roundedBox(.7, .7, .22, .1), M.linen, cx + .1, U + C.seat + .3, C.z0 + .75).rotation.x = -.5;
    paint.done(); wood.done(); brass.done();
  }

  // Her two places: the big bed and the window seat (perches: the app
  // jumps her up from the floor beside them), and what she looks at from
  // the seat; where she goes in here, the light under the window.
  layout() {
    const U = this.up, at = (x, z) => V(x, 0, z), Bd = B.bed, S = B.seat, mz = (Bd.z0 + Bd.z1) / 2;
    const box = (x0, x1, z0, z1, y0, y1) => ({kind: 'box', x0, x1, z0, z1, y0, y1});
    return {
      perches: {
        bigBed: {spot: at(Bd.x0 + 1.4, mz), top: U + Bd.top, base: at(Bd.x0 - .8, mz), face: -Math.PI / 2},
        windowSeat: {spot: at(.5, S.z1 - .45), top: U + S.top, base: at(.5, S.z1 + .9), face: Math.PI},
      },
      seatLook: V(.5, U + 4, B.north - 8),
      home: V(-1.2, U, -6.4),
      sunSpot: V(B.window.x, U, S.z1 + 1.15),
      tailSolids: [
        box(B.west - .5, B.west + .05, B.north, B.south, U, U + B.wallH), box(B.east - .05, B.east + .5, B.north, B.south, U, U + B.wallH),
        box(B.west, B.east, B.north - .5, B.north + .05, U, U + B.wallH), box(B.west, d0, B.south - .05, B.south + .5, U, U + B.wallH), box(d1, B.east, B.south - .05, B.south + .5, U, U + B.wallH),
        box(Bd.x0, B.east, Bd.z0, Bd.z1, U, U + Bd.top), ...B.tables.map(([z0, z1]) => box(B.tableX, B.east, z0, z1, U, U + B.tableTop + 1.1)),
        box(B.wardrobe.x0, B.east, B.wardrobe.z0, B.south, U, U + B.wardrobe.top), box(B.dresser.x0, B.dresser.x1, B.dresser.z0, B.south, U, U + B.dresser.top),
        box(B.west, B.chaise.x1, B.chaise.z0, B.chaise.z1, U, U + B.chaise.seat + .3), box(S.x0, S.x1, B.north, S.z1, U, U + S.top),
        box(d1 - .2, d1 + .05, -2.6, B.south, U, U + D.h),
        {kind: 'cyl', x: B.plant.x, z: B.plant.z, r: .55, y0: U, y1: U + .9},
      ],
      limits: {dist: [1.1, 34], pitch: [.04, 1.25], x: [B.west + .6, B.east - .6], z: [B.north + .4, B.south - .4], y: [U + .08, U + 6.5]},
      // (The camera may stand back past the west wall, which hides: over
      // the living room's roof.)
      camBox: {x: [B.west - 24, B.east - .2], y: [U + .4, U + 14], z: [B.north + .2, B.south - .2]},
      camSolids: [[B.plant.x, B.plant.z, .7, U + 4.2]],
      camBlocks: [],
    };
  }

  // The Room view: from beyond the west wall, looking east at the bed; the
  // window seat on the left, the doors on the right.
  frame(wide) {
    const U = this.up, Bd = B.bed, S = B.seat;
    return {
      // (On a phone, from the corner by the landing: the bed and the seat both.)
      yaw: -Math.PI / 2 + (wide ? .22 : .5),
      from: [-1, U + 1.5, -8.5],
      across: wide
        ? [[S.x0, U + 1, S.z1], [S.x1, U + 1.2, B.north + .3], [B.east - .2, U + 4.4, Bd.z0 - .9], [B.east - .2, U + 4.4, B.bathDoor.z + 1], [d1, U + 4, B.south - .2], [B.wardrobe.x0, U + 2, B.wardrobe.z0]]
        : [[S.x0 + .4, U + .8, S.z1], [B.east - .2, U + 4, Bd.z0], [B.east - .2, U + 4, Bd.z1 + .8], [Bd.x0, U + 1.8, Bd.z1]],
      bottom: [[Bd.x0 - .8, U, (Bd.z0 + Bd.z1) / 2], [S.x0 + 1.5, U, S.z1 + 1]],
      top: [[B.east - .2, U + 4.6, (Bd.z0 + Bd.z1) / 2]],
    };
  }

  // Walking, in here: her floor round what stands on it, and the lane
  // through the doorway (to the landing's side of the wall).
  inLane(v) { return v.z > FLOOR.z1 - .05 && Math.abs(v.x - D.x) < .9; }
  clampFloor(v) {
    if (v.z > FLOOR.z1 && this.inLane(v)) { v.x = Math.min(LANE.x1, Math.max(LANE.x0, v.x)); v.z = Math.min(LANE.z1, v.z); return v; }
    v.x = Math.min(FLOOR.x1, Math.max(FLOOR.x0, v.x)); v.z = Math.min(FLOOR.z1, Math.max(FLOOR.z0, v.z));
    return this.pushOut(v);
  }
  // Out of a kept-clear patch, by its nearest side that's on her floor.
  pushOut(v) {
    for (let k = 0; k < 2; k++) for (const r of KEEP) {
      if (!inside(v, r)) continue;
      const opts = [[r.x0 - v.x, 0], [r.x1 - v.x, 0], [0, r.z0 - v.z], [0, r.z1 - v.z]]
        .filter(([dx, dz]) => { const x = v.x + dx, z = v.z + dz; return x >= FLOOR.x0 - .01 && x <= FLOOR.x1 + .01 && z >= FLOOR.z0 - .01 && z <= FLOOR.z1 + .01; });
      if (!opts.length) continue;
      const [dx, dz] = opts.reduce((a, b) => Math.hypot(...a) < Math.hypot(...b) ? a : b);
      v.x += dx + Math.sign(dx) * .02; v.z += dz + Math.sign(dz) * .02;
    }
    return v;
  }
  randomFloorPoint(pad = 0) {
    for (let i = 0; i < 20; i++) {
      const p = V(rand(FLOOR.x0 + pad, FLOOR.x1 - pad), 0, rand(FLOOR.z0 + pad, FLOOR.z1 - pad));
      if (!KEEP.some(r => inside(p, r))) return p;
    }
    return V(-1.2, 0, -6.4);
  }
  // The corners to go by from a to b, round what stands between (the
  // shortest way past the corners; [] when the straight walk is clear).
  path(a, b) {
    if (!blocked(a, b)) return [];
    const nodes = [a, ...CORNERS, b], n = nodes.length, dist = new Array(n).fill(Infinity), prev = new Array(n).fill(-1), done = new Array(n).fill(false);
    dist[0] = 0;
    for (;;) {
      let u = -1;
      for (let i = 0; i < n; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
      if (u < 0 || u === n - 1) break;
      done[u] = true;
      for (let i = 0; i < n; i++) {
        if (done[i]) continue;
        const d = dist[u] + nodes[u].distanceTo(nodes[i]);
        if (d < dist[i] && !blocked(nodes[u], nodes[i])) { dist[i] = d; prev[i] = u; }
      }
    }
    if (prev[n - 1] < 0) return [];
    const out = [];
    for (let i = prev[n - 1]; i > 0; i = prev[i]) out.unshift(nodes[i].clone());
    return out;
  }
  // (For the tests: the patches she keeps out of, her floor.)
  get keep() { return KEEP; }
  get floorBox() { return FLOOR; }
  // Just inside the doorway, on this side.
  get doorSpot() { return V(D.x, 0, FLOOR.z1 - .3); }

  update(camera) {
    // (The doors and the mirror go with their walls.)
    this.bathDoor.visible = this.east[1].visible;
    this.window.visible = this.north[1].visible;
  }
}

// An antique wool rug: a faded rose field, a blue-grey border, a centre medallion.
function drawRug(g, w, h) {
  drawLinen(g, w, h, {base: '#b78a7a', dark: .12, seed: 71});
  g.strokeStyle = 'rgba(70,80,100,.65)'; g.lineWidth = w * .05; g.strokeRect(w * .06, h * .06, w * .88, h * .88);
  g.strokeStyle = 'rgba(230,214,190,.5)'; g.lineWidth = w * .012; g.strokeRect(w * .12, h * .12, w * .76, h * .76);
  g.fillStyle = 'rgba(70,80,100,.45)';
  g.beginPath(); g.ellipse(w / 2, h / 2, w * .17, h * .2, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(230,214,190,.35)';
  g.beginPath(); g.ellipse(w / 2, h / 2, w * .08, h * .1, 0, 0, Math.PI * 2); g.fill();
  for (const [x, y] of [[.25, .25], [.75, .25], [.25, .75], [.75, .75]]) { g.fillStyle = 'rgba(70,80,100,.35)'; g.beginPath(); g.arc(w * x, h * y, w * .045, 0, Math.PI * 2); g.fill(); }
}
