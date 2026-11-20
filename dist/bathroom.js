// Mochi's bathroom (phase 21, step 4): over the study, through the door in
// the bedroom's east wall (the bedroom's `B.bathDoor`). A tub under the
// window, a sink on a cabinet with a tall tap, the toilet and its roll, a
// bath mat, a towel rail, a snake plant. All built here, in code.
//
// Her three things: a drink from the tap (the water runs only while she
// drinks), the toilet roll (she unrolls it; it rolls itself back up once
// she's gone), a nap on the mat.
//
// Part of the hall's place, upstairs, as the bedroom is: `Hall` builds it
// and adds its group to its own, in the hall's frame (x along the kitchen's
// wall; the bedroom's east wall is at 7, the wall's far side 7.45, so this
// room runs from 7.45 to 16.2 east, over the study; z from -.45, in line
// with the bedroom's landing wall, to -9.95 north). Heights here are above
// its floor; the hall adds its upper floor's height (`up`, 10).
import * as THREE from 'three';
import {canvasTexture, drawLinen, roundedBox} from './room.js';
import {B as BED} from './bedroom.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const rand = (a, b) => a + Math.random() * (b - a);

// The plan (hall frame).
export const A = {
  west: 7.45, east: 16.2, south: -.45, north: -9.95, wallH: 9.5,
  // The doorway from the bedroom (in line with its door, over the study's
  // own doorway); its leaf stands open into this room, against the south jamb.
  door: {z: BED.bathDoor.z, w: BED.bathDoor.w, h: BED.bathDoor.h},
  window: {x: 14.1, w: 3.0, sill: 3.4, h: 3.6},
  tub: {x0: 12.0, x1: 16.2, z0: -9.95, z1: -8.05, top: 1.45},
  vanity: {x0: 7.75, x1: 11.15, z0: -9.95, z1: -8.55, top: 2.15},
  basin: {x: 10.2, z: -9.2, r: .5, h: .34},
  // The tall tap: from the back of the counter up and over, its spout over
  // the basin's near side (where the water falls).
  tap: {x: 9.88, z0: -9.78, z1: -9.2, h: 1.45},
  toilet: {x0: 14.55, x1: 16.2, z0: -4.2, z1: -2.9, seat: 1.05},
  roll: {x: 15.93, y: .95, z: -1.6, r: .14},
  mat: {x0: 12.9, x1: 15.3, z0: -7.3, z1: -5.9},
  rail: {z0: -7.6, z1: -5.7, y: 3.2},
  plant: {x: 11.58, z: -9.5},
};
const D = A.door, dz0 = D.z - D.w / 2, dz1 = D.z + D.w / 2;
// The open leaf: hinged at the south jamb, folded right back flat against
// the west wall (standing out in the room it hid the sink from the Room view).
const LW = D.w - .28, LEAF = {x0: A.west, x1: A.west + .12, z0: dz1, z1: dz1 + LW};
// Where she may walk: her centre .7 from the walls; the lane through the
// doorway (from the bedroom's floor's edge, 6.25); what stands on the floor,
// kept clear, each with its own margin.
const FLOOR = {x0: A.west + .7, x1: A.east - .7, z0: A.north + .7, z1: A.south - .65};
const LANE = {x0: 6.25, x1: FLOOR.x0 + .05, z0: D.z - .15, z1: D.z + .15};
const grow = (x0, x1, z0, z1, m) => ({x0: x0 - m, x1: x1 + m, z0: z0 - m, z1: z1 + m});
const KEEP = [
  grow(A.tub.x0, A.east, A.north, A.tub.z1, .65),
  grow(A.west, A.vanity.x1, A.north, A.vanity.z1, .6),
  grow(A.plant.x - .25, A.plant.x + .25, A.north, A.plant.z + .25, .45),
  grow(A.toilet.x0, A.east, A.toilet.z0, A.toilet.z1, .65),
  grow(LEAF.x0, LEAF.x1, LEAF.z0, LEAF.z1, .4),
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

// How far the paper reaches at most: down the wall, then along the floor.
const PAPER_MAX = 2.6;

export class Bathroom {
  constructor(hall) {
    this.hall = hall;
    this.group = new THREE.Group();
    this.group.visible = false;
    hall.group.add(this.group);
    this.up = hall.up;
    this.walls = [];
    // (How much paper hangs off the roll; whether she's still by it: the
    // app sets `near`.)
    this.paper = 0;
    this.near = () => false;
    this.build();
  }

  build() {
    const H = this.hall, M = H.materials, U = this.up;
    const tex = (w, h, draw, rx = 1, ry = 1) => { const t = canvasTexture(w, h, draw); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.needsUpdate = true; return t; };
    const N = this.materials = {
      tile: new THREE.MeshStandardMaterial({map: tex(256, 256, drawFloorTiles, (A.east - A.west) / 2.4, (A.south - A.north) / 2.4), roughness: .45}),
      wainscot: new THREE.MeshStandardMaterial({map: tex(256, 256, drawWallTiles), roughness: .3}),
      enamel: new THREE.MeshStandardMaterial({color: '#f5f3ee', roughness: .22}),
      inner: new THREE.MeshStandardMaterial({color: '#e3e8e8', roughness: .2}),
      chrome: new THREE.MeshStandardMaterial({color: '#d8dcdf', roughness: .15, metalness: 1}),
      cabinet: new THREE.MeshStandardMaterial({color: '#7f907c', roughness: .55}),
      marble: new THREE.MeshStandardMaterial({color: '#ebe7e0', roughness: .25}),
      mat: new THREE.MeshStandardMaterial({map: canvasTexture(256, 256, (g, w, h) => drawLinen(g, w, h, {base: '#6f8799', dark: .18, seed: 81})), roughness: 1}),
      towel: new THREE.MeshStandardMaterial({map: canvasTexture(256, 256, (g, w, h) => drawLinen(g, w, h, {base: '#d7a99a', dark: .12, seed: 82})), roughness: 1}),
      paper: new THREE.MeshStandardMaterial({color: '#fbf8f2', roughness: .9, side: THREE.DoubleSide}),
      water: new THREE.MeshStandardMaterial({color: '#d9ecf5', transparent: true, opacity: .55, roughness: .05}),
      paint: new THREE.MeshStandardMaterial({color: '#e4dccd', roughness: .55}),
    };
    const g = this.group;
    const batch = (mat, opts) => { const b = H.batch(mat, opts); const done = b.done; b.done = () => { const m = done(); if (m) g.add(m); return m; }; return b; };
    const add = (geo, mat, x, y, z, parent = g, cast = true) => { const m = H.mesh(geo, mat, parent, {cast}); m.position.set(x, y, z); return m; };
    // A wall panel (it hides when the camera swings round behind it); one
    // that stands on the floor gets the tiles' band along its foot.
    const TH = 3.0;
    const wall = (w, h, x, y, z, ry) => {
      const m = H.mesh(new THREE.PlaneGeometry(w, h), M.plaster, g, {cast: false});
      m.position.set(x, U + y, z); m.rotation.y = ry;
      H.walls.push(m); this.walls.push(m);
      if (y - h / 2 < .01) {
        const th = Math.min(h, TH), geo = new THREE.PlaneGeometry(w, th), uv = geo.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 1.2, uv.getY(i) * th / 1.2);
        const t = H.mesh(geo, N.wainscot, m, {cast: false}); t.position.set(0, th / 2 - h / 2, .015);
      }
      return m;
    };
    const T = A.wallH, W = A.window, w0 = W.x - W.w / 2, w1 = W.x + W.w / 2;
    const lx = A.east - A.west, lz = A.south - A.north, mx = (A.west + A.east) / 2, mz = (A.south + A.north) / 2;
    // The floor (small cream tiles; the study's ceiling under it), and the
    // doorway's sill through the wall's thickness.
    const tile = batch(N.tile, {cast: false}), white = batch(M.white, {cast: false});
    tile.box(A.west, A.east, U - .06, U, A.north, A.south);
    white.box(A.west, A.east, U - .45, U - .06, A.north, A.south);
    const sill = batch(this.hall.bedroom.materials.oak, {cast: false});
    sill.box(BED.east, A.west, U - .06, U + .02, dz0, dz1);
    // Walls: the bedroom's side with the doorway, the window wall, the
    // east wall, the south wall (which hides for the Room view).
    this.west = [
      wall(dz0 - A.north, T, A.west, T / 2, (A.north + dz0) / 2, Math.PI / 2),
      wall(D.w, T - D.h, A.west, (T + D.h) / 2, D.z, Math.PI / 2),
      wall(A.south - dz1, T, A.west, T / 2, (dz1 + A.south) / 2, Math.PI / 2),
    ];
    this.north = [
      wall(w0 - A.west, T, (A.west + w0) / 2, T / 2, A.north, 0),
      wall(W.w, W.sill, W.x, W.sill / 2, A.north, 0),
      wall(W.w, T - W.sill - W.h, W.x, (T + W.sill + W.h) / 2, A.north, 0),
      wall(A.east - w1, T, (w1 + A.east) / 2, T / 2, A.north, 0),
    ];
    this.east = wall(lz, T, A.east, T / 2, mz, -Math.PI / 2);
    this.south = wall(lx, T, mx, T / 2, A.south, Math.PI);
    // The doorway's lining through the wall, white.
    white.box(BED.east, A.west, U, U + D.h, dz0 - .08, dz0).box(BED.east, A.west, U, U + D.h, dz1, dz1 + .08).box(BED.east, A.west, U + D.h, U + D.h + .1, dz0 - .08, dz1 + .08);
    tile.done(); white.done(); sill.done();

    this.buildDoor(add);
    this.buildWindow(add);
    this.buildTub(add, batch);
    this.buildVanity(add, batch);
    this.buildToilet(add, batch);
    this.buildSoft(add, batch);
  }

  // The door's leaf, folded back against the wall from the south jamb:
  // white, four panels, a brass knob (the bedroom keeps its frame).
  buildDoor(add) {
    const M = this.hall.materials, U = this.up, lw = LW, d = new THREE.Group();
    d.position.set(A.west + .06, U, LEAF.z0); d.rotation.y = -Math.PI / 2; this.group.add(d);
    add(new THREE.BoxGeometry(lw, D.h - .05, .1), M.white, lw / 2, (D.h - .05) / 2, 0, d, false);
    const pw = lw / 2 - .2;
    for (const s of [-1, 1]) for (const [y0, y1] of [[.4, 2.3], [2.6, 4.6]]) add(roundedBox(pw, y1 - y0, .04, .03), M.white, lw / 2 + s * (pw / 2 + .07), (y0 + y1) / 2, -.06, d, false);
    add(new THREE.SphereGeometry(.09, 16, 12), M.brass, lw - .26, 2.4, -.1, d, false);
    this.leaf = d;
  }

  // The window over the tub: frosted (the day's light in its glass), white
  // bars, a deep reveal.
  buildWindow(add) {
    const M = this.hall.materials, W = A.window, U = this.up, g = new THREE.Group();
    g.position.set(W.x, U, A.north); this.group.add(g);
    add(new THREE.PlaneGeometry(W.w, W.h), M.glass, 0, W.sill + W.h / 2, .02, g, false);
    for (const x of [-W.w / 2, 0, W.w / 2]) add(new THREE.BoxGeometry(.1, W.h, .12), M.white, x, W.sill + W.h / 2, .06, g, false);
    for (const y of [W.sill, W.sill + W.h * .5, W.sill + W.h]) add(new THREE.BoxGeometry(W.w + .1, .1, .12), M.white, 0, y, .06, g, false);
    for (const x of [-W.w / 2 - .06, W.w / 2 + .06]) add(new THREE.BoxGeometry(.12, W.h + .2, .3), M.white, x, W.sill + W.h / 2, .15, g, false);
    add(new THREE.BoxGeometry(W.w + .24, .12, .3), M.white, 0, W.sill + W.h + .06, .15, g, false);
    add(new THREE.BoxGeometry(W.w + .4, .08, .38), M.white, 0, W.sill - .04, .19, g, false);
    this.window = g;
  }

  // The tub: a built-in white bath along the window wall, its rim, a chrome
  // filler on the wall at the far end.
  buildTub(add, batch) {
    const N = this.materials, U = this.up, Tb = A.tub, r = .2;
    const en = batch(N.enamel), inn = batch(N.inner, {cast: false});
    en.box(Tb.x0, Tb.x1, U, U + Tb.top - .1, Tb.z1 - r, Tb.z1).box(Tb.x0, Tb.x1, U, U + Tb.top - .1, Tb.z0, Tb.z0 + r);
    en.box(Tb.x0, Tb.x0 + r, U, U + Tb.top - .1, Tb.z0, Tb.z1).box(Tb.x1 - r, Tb.x1, U, U + Tb.top - .1, Tb.z0, Tb.z1);
    inn.box(Tb.x0 + r, Tb.x1 - r, U, U + .4, Tb.z0 + r, Tb.z1 - r);
    en.done(); inn.done();
    // (The rim, rounded, all round the top.)
    add(roundedBox(Tb.x1 - Tb.x0, .14, r + .04, .06), N.enamel, (Tb.x0 + Tb.x1) / 2, U + Tb.top - .07, Tb.z1 - r / 2);
    add(roundedBox(Tb.x1 - Tb.x0, .14, r + .04, .06), N.enamel, (Tb.x0 + Tb.x1) / 2, U + Tb.top - .07, Tb.z0 + r / 2);
    for (const x of [Tb.x0 + r / 2, Tb.x1 - r / 2]) add(roundedBox(r + .04, .14, Tb.z1 - Tb.z0, .06), N.enamel, x, U + Tb.top - .07, (Tb.z0 + Tb.z1) / 2);
    // The filler: a spout from the wall and two crossheads.
    const fz = (Tb.z0 + Tb.z1) / 2, fx = Tb.x1 - .02;
    add(new THREE.CylinderGeometry(.05, .05, .5, 12), N.chrome, fx - .25, U + Tb.top + .55, fz).rotation.z = Math.PI / 2;
    for (const dz of [-.35, .35]) add(new THREE.CylinderGeometry(.07, .07, .12, 12), N.chrome, fx - .08, U + Tb.top + .85, fz + dz).rotation.z = Math.PI / 2;
  }

  // The sink: a sage cabinet with two doors and a marble top, a white bowl
  // on it, the tall tap behind the bowl, a mirror over it on the wall.
  buildVanity(add, batch) {
    const H = this.hall, M = H.materials, N = this.materials, U = this.up, Vn = A.vanity, Bs = A.basin, Tp = A.tap;
    const cab = batch(N.cabinet), brass = batch(M.brass);
    cab.box(Vn.x0 + .05, Vn.x1 - .05, U + .25, U + Vn.top - .1, Vn.z0, Vn.z1 - .05);
    cab.box(Vn.x0 + .15, Vn.x1 - .15, U, U + .25, Vn.z0, Vn.z1 - .2);
    const dw = (Vn.x1 - Vn.x0 - .3) / 2;
    for (let i = 0; i < 2; i++) {
      const x0 = Vn.x0 + .15 + i * dw + .05, x1 = x0 + dw - .1;
      cab.box(x0, x1, U + .4, U + Vn.top - .3, Vn.z1 - .05, Vn.z1 - .01);
      brass.box(i ? x0 + .15 : x1 - .19, i ? x0 + .19 : x1 - .15, U + 1.2, U + 1.6, Vn.z1 - .01, Vn.z1 + .04);
    }
    cab.done(); brass.done();
    add(roundedBox(Vn.x1 - Vn.x0, .1, Vn.z1 - Vn.z0 + .05, .03), N.marble, (Vn.x0 + Vn.x1) / 2, U + Vn.top - .05, (Vn.z0 + Vn.z1) / 2 + .025);
    // The bowl (a lathe: thin wall, round foot).
    const prof = [];
    for (let i = 0; i <= 10; i++) { const a = i / 10 * Math.PI / 2; prof.push(new THREE.Vector2(.12 + (Bs.r - .12) * Math.sin(a), Bs.h * (1 - Math.cos(a)))); }
    for (let i = 10; i >= 0; i--) { const a = i / 10 * Math.PI / 2; prof.push(new THREE.Vector2(Math.max(.01, .12 + (Bs.r - .16) * Math.sin(a)), .04 + (Bs.h - .04) * (1 - Math.cos(a)))); }
    add(new THREE.LatheGeometry(prof, 32), N.enamel, Bs.x, U + Vn.top, Bs.z);
    // The tall tap: up from the counter's back, over in an arch, down to
    // the spout over the bowl's near side.
    const top = U + Vn.top, neck = new THREE.CatmullRomCurve3([V(Tp.x, top, Tp.z0), V(Tp.x, top + Tp.h - .25, Tp.z0), V(Tp.x, top + Tp.h, Tp.z0 + .2), V(Tp.x, top + Tp.h - .05, Tp.z1 - .12), V(Tp.x, top + Tp.h - .35, Tp.z1)]);
    add(new THREE.CylinderGeometry(.07, .08, .1, 16), N.chrome, Tp.x, top + .05, Tp.z0);
    add(new THREE.TubeGeometry(neck, 32, .04, 10), N.chrome, 0, 0, 0);
    add(new THREE.CylinderGeometry(.02, .02, .32, 8), N.chrome, Tp.x + .16, top + .5, Tp.z0).rotation.z = -1.1;
    this.tapTip = V(Tp.x, top + Tp.h - .37, Tp.z1);
    // The water: only while she drinks.
    const fall = this.tapTip.y - (top + .06);
    this.stream = add(new THREE.CylinderGeometry(.014, .02, fall, 8), N.water, Tp.x, top + .06 + fall / 2, Tp.z1, this.group, false);
    this.stream.receiveShadow = false; this.stream.visible = false;
    // A soap dish and a tumbler on the counter.
    add(roundedBox(.4, .06, .28, .03), N.enamel, Vn.x0 + .55, top + .03, Vn.z0 + .45);
    add(roundedBox(.26, .1, .16, .05), N.towel, Vn.x0 + .55, top + .1, Vn.z0 + .45);
    add(new THREE.CylinderGeometry(.11, .09, .36, 14), M.glass, Vn.x1 - .4, top + .18, Vn.z0 + .35);
    // The mirror on the wall (it hides with the wall).
    const wl = this.north[0], mc = (Vn.x0 + Vn.x1) / 2;
    const fr = H.mesh(new THREE.BoxGeometry(2.4, 3.0, .05), M.brass, wl, {cast: false}); fr.position.set(mc - wl.position.x, 5.0 - (wl.position.y - U), .025);
    const gl = H.mesh(new THREE.PlaneGeometry(2.2, 2.8), M.mirror, wl, {cast: false}); gl.position.set(mc - wl.position.x, 5.0 - (wl.position.y - U), .06);
  }

  // The toilet against the east wall, and its roll on the wall beside it.
  buildToilet(add, batch) {
    const N = this.materials, U = this.up, Tl = A.toilet, R = A.roll, mz = (Tl.z0 + Tl.z1) / 2;
    // The cistern, the pan on its foot, the seat and the lid (down).
    add(roundedBox(.5, 1.25, 1.3, .08), N.enamel, Tl.x1 - .27, U + 1.95, mz);
    add(roundedBox(.58, .1, 1.4, .04), N.enamel, Tl.x1 - .3, U + 2.62, mz);
    add(new THREE.CylinderGeometry(.04, .04, .04, 12), N.chrome, Tl.x1 - .3, U + 2.68, mz).scale.set(1.6, 1, 1.6);
    add(new THREE.CylinderGeometry(.34, .42, Tl.seat - .25, 20), N.enamel, Tl.x0 + .65, U + (Tl.seat - .25) / 2, mz).scale.set(1, 1, .82);
    const pan = add(new THREE.CylinderGeometry(.62, .52, .25, 24), N.enamel, Tl.x0 + .75, U + Tl.seat - .17, mz); pan.scale.set(1.15, 1, .95);
    add(roundedBox(1.32, .07, 1.12, .08), N.enamel, Tl.x0 + .8, U + Tl.seat - .02, mz);
    add(roundedBox(1.26, .06, 1.06, .08), N.enamel, Tl.x0 + .82, U + Tl.seat + .04, mz);
    // The roll's holder: an arm from the wall; the roll on it, its axis along the wall.
    add(new THREE.CylinderGeometry(.04, .04, .2, 10), N.chrome, A.east - .1, U + R.y, R.z - .2).rotation.z = Math.PI / 2;
    add(new THREE.CylinderGeometry(.025, .025, .44, 10), N.chrome, R.x, U + R.y, R.z).rotation.x = Math.PI / 2;
    this.roll = add(new THREE.CylinderGeometry(R.r, R.r, .36, 20), N.paper, R.x, U + R.y, R.z);
    this.roll.rotation.x = Math.PI / 2;
    // The loose end: down the wall from the roll's front, then along the
    // floor towards the room (each a unit long, scaled to what's out).
    const hang = new THREE.PlaneGeometry(.32, 1); hang.translate(0, -.5, 0); hang.rotateY(-Math.PI / 2);
    this.hang = add(hang, N.paper, R.x - R.r - .005, U + R.y, R.z, this.group, false);
    const trail = new THREE.PlaneGeometry(1, .32); trail.translate(-.5, 0, 0); trail.rotateX(-Math.PI / 2);
    this.trail = add(trail, N.paper, R.x - R.r - .01, U + .015, R.z, this.group, false);
    this.tip = new THREE.Mesh(new THREE.PlaneGeometry(.32, .12), N.paper); this.tip.rotation.y = -Math.PI / 2; this.tip.position.set(R.x - R.r - .005, U + R.y - .06, R.z);
    this.group.add(this.tip);
    this.setPaper(0);
  }

  // The bath mat, the towel rail and its towel, the snake plant.
  buildSoft(add, batch) {
    const H = this.hall, M = H.materials, N = this.materials, U = this.up, Mt = A.mat, Rl = A.rail, P = A.plant;
    add(roundedBox(Mt.x1 - Mt.x0, .06, Mt.z1 - Mt.z0, .03), N.mat, (Mt.x0 + Mt.x1) / 2, U + .03, (Mt.z0 + Mt.z1) / 2, this.group, false);
    // The rail, on the east wall by the tub: a chrome bar on two brackets,
    // a towel folded over it.
    const ch = batch(N.chrome), x = A.east - .22;
    ch.add(new THREE.CylinderGeometry(.035, .035, Rl.z1 - Rl.z0 + .2, 10), x, U + Rl.y, (Rl.z0 + Rl.z1) / 2, Math.PI / 2, 0, 0);
    for (const z of [Rl.z0 - .05, Rl.z1 + .05]) ch.box(x, A.east, U + Rl.y - .03, U + Rl.y + .03, z - .03, z + .03);
    ch.done();
    const tw = Rl.z1 - Rl.z0 - .3, tz = (Rl.z0 + Rl.z1) / 2;
    add(roundedBox(.06, 1.5, tw, .02), N.towel, x - .06, U + Rl.y - .72, tz);
    add(roundedBox(.06, 1.2, tw, .02), N.towel, x + .07, U + Rl.y - .58, tz);
    add(roundedBox(.2, .1, tw, .04), N.towel, x, U + Rl.y + .02, tz);
    // The snake plant: a white pot of upright blades, in the corner between
    // the sink and the tub.
    const pg = new THREE.Group(); pg.position.set(P.x, U, P.z); this.group.add(pg);
    add(new THREE.CylinderGeometry(.24, .19, .5, 16), N.enamel, 0, .25, 0, pg);
    const blades = batch(M.leaf, {cast: true}), blade = new THREE.PlaneGeometry(.12, 1);
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4, h = 1.4 + (i % 4) * .35, b = blade.clone();
      b.scale(1, h, 1); b.translate(0, h / 2, 0); b.rotateX(.08 + (i % 3) * .05); b.rotateY(a);
      blades.add(b, Math.cos(a) * .08 + P.x, U + .45, -Math.sin(a) * .08 + P.z);
    }
    blades.done();
  }

  // The paper off the roll: down the wall from its front, then along the floor.
  setPaper(u) {
    this.paper = Math.max(0, Math.min(PAPER_MAX, u));
    const R = A.roll, down = Math.min(this.paper, R.y - .02), along = Math.max(0, this.paper - down);
    this.hang.visible = down > .01; this.hang.scale.y = Math.max(down, .001);
    this.trail.visible = along > .01; this.trail.scale.x = Math.max(along, .001);
    this.tip.visible = !this.hang.visible;
    // (The roll a little thinner with paper off it.)
    const s = 1 - this.paper / PAPER_MAX * .12; this.roll.scale.set(s, 1, s);
  }
  // A pat at the roll: some more paper comes off.
  pullPaper(amount = rand(.35, .6)) { this.setPaper(this.paper + amount); }
  tapRun(on) { this.stream.visible = on; }

  // Her places: the counter by the bowl (a perch: up from the floor in
  // front of the cabinet), the spot by the roll, the mat; where she goes in
  // here; the light from the window.
  layout() {
    const U = this.up, at = (x, z) => V(x, 0, z), Vn = A.vanity, Tp = A.tap, R = A.roll, Mt = A.mat;
    const box = (x0, x1, z0, z1, y0, y1) => ({kind: 'box', x0, x1, z0, z1, y0, y1});
    const drinkAt = at(Tp.x - .5, A.basin.z);
    return {
      perches: {
        vanity: {spot: drinkAt, top: U + Vn.top, base: at(drinkAt.x, Vn.z1 + .95), face: Math.PI / 2},
      },
      // (The water falling from the tap, where she laps at it.)
      tapDrink: V(Tp.x, U + Vn.top + .36, Tp.z1),
      rollSpot: {at: V(R.x - .62, U, R.z), look: V(R.x, U + R.y - .15, R.z)},
      matSpot: {at: V((Mt.x0 + Mt.x1) / 2 - .1, U, (Mt.z0 + Mt.z1) / 2), face: -Math.PI / 2},
      home: V(11.3, U, -3.6),
      sunSpot: V(11.8, U, -6.9),
      tailSolids: [
        box(A.west - .5, A.west + .05, A.north, dz0, U, U + A.wallH), box(A.west - .5, A.west + .05, dz1, A.south, U, U + A.wallH),
        box(A.east - .05, A.east + .5, A.north, A.south, U, U + A.wallH),
        box(A.west, A.east, A.north - .5, A.north + .05, U, U + A.wallH), box(A.west, A.east, A.south - .05, A.south + .5, U, U + A.wallH),
        box(A.tub.x0, A.east, A.north, A.tub.z1, U, U + A.tub.top), box(A.west, Vn.x1, A.north, Vn.z1, U, U + Vn.top),
        box(A.toilet.x0, A.east, A.toilet.z0, A.toilet.z1, U, U + A.toilet.seat + .1), box(A.east - .55, A.east, A.toilet.z0 - .1, A.toilet.z1 + .1, U, U + 2.7),
        box(LEAF.x0, LEAF.x1, LEAF.z0, LEAF.z1, U, U + D.h),
        {kind: 'cyl', x: A.plant.x, z: A.plant.z, r: .3, y0: U, y1: U + .6},
      ],
      limits: {dist: [1.1, 32], pitch: [.04, 1.25], x: [A.west + .6, A.east - .6], z: [A.north + .4, A.south - .4], y: [U + .08, U + 6.5]},
      // (The camera may stand back past the south wall, which hides: over
      // the study's roof.)
      camBox: {x: [A.west + .2, A.east - .2], y: [U + .4, U + 14], z: [A.north + .2, A.south + 24]},
      camSolids: [[A.plant.x, A.plant.z, .5, U + 2.4]],
      camBlocks: [],
    };
  }

  // The Room view: from beyond the south wall, looking north: the sink on
  // the left, the tub under the window, the toilet on the right.
  frame(wide) {
    const U = this.up, Vn = A.vanity, Tb = A.tub, Tl = A.toilet, Mt = A.mat;
    return {
      // (On a phone, from the corner by the door: the sink, the tub and the
      // toilet all at once.)
      yaw: wide ? -.2 : -.3,
      from: [11.8, U + 1.5, -4.5],
      across: wide
        ? [[A.west + .3, U + 4.5, D.z], [Vn.x0, U + 2.4, Vn.z1], [Tb.x1 - .1, U + 1.6, Tb.z1], [A.window.x, U + A.window.sill + A.window.h, A.north], [A.east - .2, U + 2.7, Tl.z1], [A.east - .2, U + .2, A.roll.z]]
        : [[Vn.x0 + .6, U + 2.2, Vn.z1], [Tb.x1 - .2, U + 1.6, Tb.z1], [A.east - .4, U + 1.2, Tl.z0]],
      bottom: [[(Mt.x0 + Mt.x1) / 2, U, Mt.z1], [A.roll.x - .5, U, A.roll.z]],
      top: [[A.window.x, U + A.window.sill + A.window.h + .2, A.north], [(Vn.x0 + Vn.x1) / 2, U + 6.6, A.north]],
    };
  }

  // Walking, in here: her floor round what stands on it, and the lane
  // through the doorway (to the bedroom's side of the wall).
  inLane(v) { return v.x > LANE.x0 && v.x < FLOOR.x0 + .05 && Math.abs(v.z - D.z) < .9; }
  clampFloor(v) {
    if (v.x < FLOOR.x0 && this.inLane(v)) { v.z = Math.min(LANE.z1, Math.max(LANE.z0, v.z)); v.x = Math.max(LANE.x0, v.x); return v; }
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
      const free = opts.filter(([dx, dz]) => { const q = V(v.x + dx + Math.sign(dx) * .02, 0, v.z + dz + Math.sign(dz) * .02); return !KEEP.some(o => inside(q, o)); });
      const [dx, dz] = (free.length ? free : opts).reduce((a, b) => Math.hypot(...a) < Math.hypot(...b) ? a : b);
      v.x += dx + Math.sign(dx) * .02; v.z += dz + Math.sign(dz) * .02;
    }
    return v;
  }
  randomFloorPoint(pad = 0) {
    for (let i = 0; i < 20; i++) {
      const p = V(rand(FLOOR.x0 + pad, FLOOR.x1 - pad), 0, rand(FLOOR.z0 + pad, FLOOR.z1 - pad));
      if (!KEEP.some(r => inside(p, r))) return p;
    }
    return V(11.3, 0, -3.6);
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
  blocked(a, b) { return blocked(a, b); }
  // (Where the roll is, on the floor's plan.)
  get rollAt() { return V(A.roll.x, 0, A.roll.z); }
  // (For the tests: the patches she keeps out of, her floor.)
  get keep() { return KEEP; }
  get floorBox() { return FLOOR; }
  // Just inside the doorway, on this side; and on the bedroom's side.
  get doorSpot() { return V(FLOOR.x0 + .3, 0, D.z); }
  get bedroomSpot() { return V(BED.east - 1, 0, D.z); }
  // Is (x, z) in here (or in the doorway's lane, past the bedroom's floor)?
  holds(p) { return p.z < A.south && (p.x > BED.east + .2 || (p.x > LANE.x0 && Math.abs(p.z - D.z) < .9)); }

  update(dt, t) {
    // (The window and the door's leaf go with their walls; the mirror is the wall's.)
    this.window.visible = this.north[1].visible;
    if (this.stream.visible) this.stream.scale.set(1 + Math.sin(t * 40) * .15, 1, 1 + Math.cos(t * 33) * .15);
    // Once she's gone, the paper rolls itself back up (slowly at first).
    if (this.paper > 0 && !this.near()) this.setPaper(this.paper - dt * (.25 + this.paper * .35));
  }
}

// Small cream floor tiles, square, with pale grey grout and the odd darker one.
function drawFloorTiles(g, w, h) {
  g.fillStyle = '#b9b2a6'; g.fillRect(0, 0, w, h);
  const n = 8, s = w / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const k = (i * 7 + j * 13) % 11;
    g.fillStyle = k === 0 ? '#c9c0b2' : k < 4 ? '#ece6da' : '#f1ebe0';
    g.fillRect(i * s + 1.5, j * s + 1.5, s - 3, s - 3);
  }
}
// White wall tiles, laid like bricks, with a thin grey grout.
function drawWallTiles(g, w, h) {
  g.fillStyle = '#c8c6c0'; g.fillRect(0, 0, w, h);
  const rows = 8, rh = h / rows, cw = w / 4;
  for (let r = 0; r < rows; r++) for (let c = -1; c < 5; c++) {
    const x = c * cw + (r % 2 ? cw / 2 : 0);
    g.fillStyle = (r + c) % 5 ? '#f6f4ef' : '#efede7';
    g.fillRect(x + 1.5, r * rh + 1.5, cw - 3, rh - 3);
  }
}
