// Mochi's hall (phase 21): the front door, a console and a bench, and the
// stairs (scenery for now: she climbs them in the next step of the phase).
// A long narrow room along the kitchen's right wall, reached by the doorway
// in that wall (house.js: ROOMS.hall, DOORS).
//
// The room's own frame: x along the kitchen's wall (west -7, where the
// bench stands, to east 7, the stairs' end), z from that wall (0) to the
// front door's wall (5.05). Same scale as the other rooms: about 2.4 scene
// units per metre.
//
// How far her body rides over the line through the treads, in risers (see rampAt).
const STAIR_LIFT = .5;
// The stairs: a dog-leg at the east end. The lower flight runs east along
// the front wall (twelve risers of 5/12 to a half landing at y 5), the upper
// flight comes back west along the kitchen's wall, to the upper floor at
// y 10 (the phase's "Facts for the build").
import * as THREE from 'three';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';
import {canvasTexture, drawLinen, drawWood, roundedBox} from './room.js';
import {Bedroom} from './bedroom.js';
import {Bathroom} from './bathroom.js';

const {damp} = THREE.MathUtils;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const rand = (a, b) => a + Math.random() * (b - a);

// The plan.
export const H = {
  west: -7, east: 7, back: 0, front: 5.05, wallH: 10,
  // (The doorway to the kitchen: house.js has the same.)
  door: [-3.35, -.95], doorTop: 5.4,
  frontDoor: {x: -2.15, w: 2.2, h: 5.0, fan: 1.1},
  console: {x: -5.3, long: 2.4, deep: .8, top: 1.9},
  bench: {z: 3.2, long: 2.6, deep: .95, seat: 1.05},
  // The stairs: where they start, how deep a tread and how high a riser,
  // each flight's side of the hall, the half landing.
  // (Merlin, 2026-11-19: a real house's slope, about 40 degrees, not 51:
  // 17 cm risers on 25 cm treads.)
  stairs: {x0: -.4, tread: .5, rise: 5 / 12, steps: 12, lowZ: [2.6, 5.05], highZ: [0, 2.45], landX: [5.6, 7]},
  lamp: {x: -2.15, y: 7.4, z: 2.5},
  // Upstairs (phase 21 step 2): the landing, the hall's upper floor at
  // y 10, round the stairwell; its walls 9.5 high (as the kitchen's). The
  // window over the front door, the bedroom's door in the kitchen's wall.
  up: 10, upH: 9.5, well: 2.45,
  window: {x: -2.15, w: 2.6, sill: 2.2, h: 4.4},
  bedDoor: {x: -4.6, w: 2.2, h: 5.0},
};
// (Where the upper flight comes out on the landing; the half landing's height.)
const HALF = H.stairs.steps * H.stairs.rise, UPX = H.stairs.landX[0] - H.stairs.steps * H.stairs.tread;
// Upstairs, where she may walk: the landing's main floor (west of the top
// step), and the gallery along the front wall over the lower flight.
const UPFLOOR = {x0: H.west + .7, x1: UPX - .7, z0: .7, z1: H.front - .65, gz0: H.well + .65};
// The tops she can stand on at (x, z): the floor, a tread, the half
// landing, the landing upstairs.
function tops(x, z) {
  const S = H.stairs, [l0] = S.landX, out = [0];
  // (Past the kitchen's wall: the bedroom's floor up there, and its doorway.)
  if (z < -.05) { out.push(H.up); return out; }
  if (z >= S.lowZ[0] - .08 && z <= S.lowZ[1] && x >= S.x0 && x < l0) out.push((Math.floor((x - S.x0) / S.tread) + 1) * S.rise);
  if (x >= l0 && x <= H.east + .5) out.push(HALF);
  if (z <= S.highZ[1] + .08 && x >= UPX && x < l0) out.push(HALF + (Math.floor((l0 - x) / S.tread) + 1) * S.rise);
  if (x < UPX || z > H.well) out.push(H.up);
  return out;
}
// Where she may walk: her centre .65 from the walls, the bench and the
// stairs' first riser (her head turned to look at something reaches that far).
const FLOOR = {x0: H.west + 1.6, x1: H.stairs.x0 - .7, z0: .7, z1: H.front - .7};
// The console, kept clear.
const KEEP_OUT = {x0: H.console.x - H.console.long / 2 - .65, x1: H.console.x + H.console.long / 2 + .65, z0: -1, z1: H.console.deep + .65};

export class Hall {
  constructor(scene, room, {plaster = null, floor = null} = {}) {
    this.scene = scene;
    this.room = room;
    this.id = 'hall';
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);
    this.walls = [];
    // (No bed here: for a nap she goes to her own, in the kitchen's place.
    // The app reads a bed's place and size from every room.)
    this.bed = new THREE.Object3D(); this.bed.position.set(0, -50, 400); this.group.add(this.bed);
    this.bedTop = 0; this.bedRadius = 0; this.noBed = true;
    this.lampSpot = V(H.lamp.x, H.lamp.y - 1.1, H.lamp.z);
    this.upLampSpot = V(-3.2, H.up + 6, 2.5);
    this.level = 'down';
    // (Upstairs: on the landing, through its door in the bedroom, or on
    // through the bedroom's east door in the bathroom.)
    this.wing = 'landing';
    this.bedLampSpot = V(0, H.up + 6.5, -8.5);
    this.bathLampSpot = V(11.8, H.up + 6.5, -5.2);
    this.build(plaster, floor);
  }

  mesh(geo, material, parent = this.group, {cast = true, receive = true} = {}) {
    const m = new THREE.Mesh(geo, material);
    m.castShadow = cast; m.receiveShadow = receive;
    parent.add(m);
    return m;
  }
  // Many boxes (and other pieces) of one material, drawn as one.
  batch(material, opts) {
    const geos = [], m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = V(1, 1, 1);
    const api = {
      add: (geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
        const g = geo.index ? geo.toNonIndexed() : geo;
        g.applyMatrix4(m4.compose(V(x, y, z), q.setFromEuler(e.set(rx, ry, rz, 'YXZ')), one));
        for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
        geos.push(g);
        return api;
      },
      // A box by its corners.
      box: (x0, x1, y0, y1, z0, z1) => api.add(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2),
      done: () => geos.length ? this.mesh(mergeGeometries(geos), material, this.group, opts) : null,
    };
    return api;
  }

  build(plaster, floor) {
    const wood = (colors, seed, grain, planks = 1) => canvasTexture(512, 512, (g, w, h) => drawWood(g, w, h, {planks, colors, seed, grain}));
    const M = this.materials = {
      // (The kitchen's limestone and plaster carry on: one house.)
      floor: floor ?? new THREE.MeshStandardMaterial({color: '#d9cfbd', roughness: .55}),
      plaster: plaster ?? new THREE.MeshStandardMaterial({color: '#efe3d0', roughness: .95}),
      oak: new THREE.MeshStandardMaterial({map: wood(['#a9824f', '#b48c58', '#9c7645'], 31, 40, 4), roughness: .5}),
      walnut: new THREE.MeshStandardMaterial({map: wood(['#4a2f1d', '#563822', '#3d2616'], 32, 52), color: '#b9a48f', roughness: .4}),
      white: new THREE.MeshStandardMaterial({color: '#ece4d6', roughness: .6}),
      door: new THREE.MeshStandardMaterial({color: '#34424f', roughness: .42, metalness: .05}),
      brass: new THREE.MeshStandardMaterial({color: '#b08d4f', roughness: .32, metalness: .85}),
      iron: new THREE.MeshStandardMaterial({color: '#1c1b1a', roughness: .5, metalness: .6}),
      runner: new THREE.MeshStandardMaterial({map: canvasTexture(256, 256, (g, w, h) => drawLinen(g, w, h, {base: '#6d2f35', dark: .12, seed: 41})), roughness: 1}),
      rug: new THREE.MeshStandardMaterial({map: canvasTexture(512, 256, drawRunner), roughness: 1}),
      mat: new THREE.MeshStandardMaterial({map: canvasTexture(256, 256, (g, w, h) => drawLinen(g, w, h, {base: '#8a7350', dark: .22, seed: 43})), roughness: 1}),
      linen: new THREE.MeshStandardMaterial({map: canvasTexture(256, 256, (g, w, h) => drawLinen(g, w, h, {base: '#cdbfa6', dark: .06, seed: 44})), roughness: 1}),
      velvet: new THREE.MeshStandardMaterial({map: canvasTexture(256, 256, (g, w, h) => drawLinen(g, w, h, {base: '#3d4427', dark: .1, seed: 45})), roughness: 1}),
      mirror: new THREE.MeshStandardMaterial({color: '#cfd6d8', roughness: .08, metalness: 1}),
      glass: new THREE.MeshStandardMaterial({color: '#fff3d6', emissive: '#ffe9bd', emissiveIntensity: .9, roughness: .3}),
      shade: new THREE.MeshStandardMaterial({color: '#f3e6cc', emissive: '#ffd9a0', emissiveIntensity: .3, roughness: .8, side: THREE.DoubleSide}),
      leaf: new THREE.MeshStandardMaterial({color: '#4f6238', roughness: .8, side: THREE.DoubleSide}),
      pot: new THREE.MeshStandardMaterial({color: '#b9aa94', roughness: .85}),
    };
    this.buildShell();
    this.buildFrontDoor();
    this.buildStairs();
    this.buildFurniture();
    this.buildUpstairs();
    this.bedroom = new Bedroom(this);
    this.bathroom = new Bathroom(this);
  }

  // Floor, plaster walls, the doorway to the kitchen.
  buildShell() {
    const M = this.materials;
    const floor = this.mesh(new THREE.PlaneGeometry(60, 60), M.floor, this.group, {cast: false});
    floor.rotation.x = -Math.PI / 2; floor.position.y = -.002;
    this.floor = floor;
    // A wall panel; it hides when the camera swings round behind it.
    // (With what hangs on it or stands in it: `kids`.)
    const wall = (w, h, x, y, z, ry) => {
      const m = this.mesh(new THREE.PlaneGeometry(w, h), M.plaster, this.group, {cast: false});
      m.position.set(x, y, z); m.rotation.y = ry;
      this.walls.push(m);
      return m;
    };
    const [d0, d1] = H.door, T = H.wallH, F = H.frontDoor, f0 = F.x - F.w / 2, f1 = F.x + F.w / 2, ft = F.h + F.fan;
    // The kitchen's wall, with the doorway.
    wall(d0 - H.west, T, (H.west + d0) / 2, T / 2, H.back, 0);
    wall(d1 - d0, T - H.doorTop, (d0 + d1) / 2, (T + H.doorTop) / 2, H.back, 0);
    wall(H.east - d1, T, (d1 + H.east) / 2, T / 2, H.back, 0);
    // Upstairs (the landing): the kitchen's wall with the bedroom's doorway,
    // the front wall with the window. (The end walls go up the two floors.)
    const U = H.up, UT = U + H.upH, B = H.bedDoor, W = H.window;
    this.upWalls = [
      wall(B.x - B.w / 2 - H.west, H.upH, (H.west + B.x - B.w / 2) / 2, U + H.upH / 2, H.back, 0),
      wall(B.w, H.upH - B.h, B.x, U + (H.upH + B.h) / 2, H.back, 0),
      wall(H.east - B.x - B.w / 2, H.upH, (B.x + B.w / 2 + H.east) / 2, U + H.upH / 2, H.back, 0),
    ];
    const w0 = W.x - W.w / 2, w1 = W.x + W.w / 2;
    this.upFront = [
      wall(w0 - H.west, H.upH, (H.west + w0) / 2, U + H.upH / 2, H.front, Math.PI),
      wall(W.w, W.sill, W.x, U + W.sill / 2, H.front, Math.PI),
      wall(W.w, H.upH - W.sill - W.h, W.x, (U + W.sill + W.h + UT) / 2, H.front, Math.PI),
      wall(H.east - w1, H.upH, (w1 + H.east) / 2, U + H.upH / 2, H.front, Math.PI),
    ];
    // The front wall, round the front door and its fanlight.
    this.frontWalls = [
      wall(f0 - H.west, T, (H.west + f0) / 2, T / 2, H.front, Math.PI),
      wall(f1 - f0, T - ft, F.x, (T + ft) / 2, H.front, Math.PI),
      wall(H.east - f1, T, (f1 + H.east) / 2, T / 2, H.front, Math.PI),
    ];
    this.westWall = wall(H.front - H.back, T, H.west, T / 2, (H.back + H.front) / 2, Math.PI / 2);
    this.eastWall = wall(H.front - H.back, T, H.east, T / 2, (H.back + H.front) / 2, -Math.PI / 2);
    this.upWest = wall(H.front - H.back, H.upH, H.west, U + H.upH / 2, (H.back + H.front) / 2, Math.PI / 2);
    this.upEast = wall(H.front - H.back, H.upH, H.east, U + H.upH / 2, (H.back + H.front) / 2, -Math.PI / 2);
    // A slim limestone skirting.
    const skirt = this.batch(new THREE.MeshStandardMaterial({color: '#d8ccb6', roughness: .6}), {cast: false});
    skirt.box(H.west, d0, 0, .14, H.back, H.back + .04).box(d1, H.stairs.x0, 0, .14, H.back, H.back + .04);
    skirt.box(H.west, H.west + .04, 0, .14, H.back, H.front);
    this.skirting = skirt.done();
  }

  // The front door: dark blue-grey, six panels, a brass knob and letter
  // plate, a fanlight over it that glows with the day outside, a mat inside.
  buildFrontDoor() {
    const M = this.materials, F = H.frontDoor, z = H.front, g = new THREE.Group();
    g.position.set(F.x, 0, z); this.group.add(g);
    this.frontDoor = g;
    const add = (geo, mat, x, y, zz, cast = false) => { const m = this.mesh(geo, mat, g, {cast}); m.position.set(x, y, zz); return m; };
    // The frame, then the leaf, a little back in it.
    for (const s of [-1, 1]) add(new THREE.BoxGeometry(.16, F.h + F.fan, .3), M.white, s * (F.w / 2 - .08), (F.h + F.fan) / 2, -.1);
    add(new THREE.BoxGeometry(F.w, .16, .3), M.white, 0, F.h + F.fan - .08, -.1);
    add(new THREE.BoxGeometry(F.w, .14, .3), M.white, 0, F.h + .07, -.1);
    const w = F.w - .32;
    add(new THREE.BoxGeometry(w, F.h, .14), M.door, 0, F.h / 2, -.05);
    // (Raised panels: two columns of three.)
    const pw = w / 2 - .22;
    for (const s of [-1, 1]) for (const [y0, y1] of [[.35, 1.55], [1.8, 3.2], [3.45, 4.65]]) add(roundedBox(pw, y1 - y0, .05, .04), M.door, s * (pw / 2 + .08), (y0 + y1) / 2, -.14);
    add(new THREE.SphereGeometry(.09, 16, 12), M.brass, w / 2 - .22, 2.45, -.2);
    add(new THREE.BoxGeometry(.5, .12, .03), M.brass, 0, 1.68, -.13);
    // The fanlight: the day's light behind its glass, and its bars.
    this.fan = add(new THREE.PlaneGeometry(w, F.fan - .22), M.glass, 0, F.h + .14 + (F.fan - .22) / 2, -.04);
    this.fan.rotation.y = Math.PI;
    for (const x of [-w / 4, 0, w / 4]) add(new THREE.BoxGeometry(.05, F.fan - .22, .05), M.white, x, F.h + .14 + (F.fan - .22) / 2, -.08);
    // The mat (on the floor, in the room's own group: the wall hides, it stays).
    const mat = this.mesh(roundedBox(1.9, 1.2, .05, .05), M.mat, this.group, {cast: false});
    mat.rotation.x = -Math.PI / 2; mat.position.set(F.x, .025, z - .85);
  }

  // The stairs: oak treads with a wine-red runner, white risers and
  // strings, a dark handrail on brass-topped newels.
  buildStairs() {
    const M = this.materials, S = H.stairs, n = S.steps;
    const tread = this.batch(M.oak), body = this.batch(M.white), run = this.batch(M.runner, {cast: false}), rail = this.batch(M.walnut), post = this.batch(M.iron);
    const [a0, a1] = S.lowZ, [b0, b1] = S.highZ, [l0, l1] = S.landX, half = n * S.rise;
    const mid = z => (z[0] + z[1]) / 2, RW = 1.25, lip = .06;
    // The lower flight, going up to the east: solid under each tread.
    for (let i = 0; i < n; i++) {
      const x = S.x0 + i * S.tread, top = (i + 1) * S.rise;
      body.box(x, x + S.tread, 0, top - lip, a0, a1);
      tread.box(x - .04, x + S.tread, top - lip, top, a0 - .03, a1);
      run.box(x - .05, x + S.tread, top - S.rise + .01, top + .012, mid(S.lowZ) - RW / 2, mid(S.lowZ) + RW / 2);
    }
    // The half landing, the whole depth of the hall.
    body.box(l0, l1, 0, half - lip, H.back, H.front);
    tread.box(l0, l1, half - lip, half, H.back, H.front);
    run.box(l0, l0 + 1.25, half, half + .012, mid(S.highZ) - RW / 2, mid(S.lowZ) + RW / 2);
    // The upper flight, coming back to the west: open underneath.
    for (let i = 0; i < n; i++) {
      const x = l0 - (i + 1) * S.tread, top = half + (i + 1) * S.rise;
      body.box(x, x + S.tread, top - S.rise - .35, top - lip, b0, b1);
      tread.box(x, x + S.tread + .04, top - lip, top, b0, b1 + .03);
      run.box(x, x + S.tread + .05, top - S.rise + .01, top + .012, mid(S.highZ) - RW / 2, mid(S.highZ) + RW / 2);
    }
    const upX = l0 - n * S.tread;
    // The handrails: along each flight's open side, between newel posts.
    const slope = Math.atan2(S.rise, S.tread), len = Math.hypot(n * S.tread, half), RH = 2.1;
    const newel = (x, y, z, h = RH + .25) => { post.box(x - .09, x + .09, y, y + h, z - .09, z + .09); rail.add(new THREE.SphereGeometry(.13, 12, 10), x, y + h + .1, z); };
    const flight = (xa, ya, xb, z) => {
      const dir = Math.sign(xb - xa);
      rail.add(new THREE.BoxGeometry(len, .12, .16), (xa + xb) / 2, ya + half / 2 + RH, z, 0, 0, dir * slope);
      for (let i = 0; i < n; i++) { const x = xa + dir * (i + .5) * S.tread, y = ya + (i + 1) * S.rise; post.box(x - .025, x + .025, y, y + RH - S.rise / 2 - .02, z - .025, z + .025); }
    };
    flight(S.x0, 0, l0, a0 + .1); newel(S.x0 - .05, 0, a0 + .1); newel(l0 + .05, half, a0 + .1);
    flight(l0, half, upX, b1 - .1); newel(l0 + .05, half, b1 - .1); newel(upX - .05, 2 * half, b1 - .1);
    this.stairs = [tread.done(), body.done(), run.done(), rail.done(), post.done()];
    // Under the upper flight: a fiddle-leaf fig in a stone pot.
    this.buildPlant(3.0, 1.15);
    this.downPlant = this.plant;
  }

  buildPlant(x, z, y = 0) {
    const M = this.materials, g = new THREE.Group();
    g.position.set(x, y, z); this.group.add(g);
    const pot = this.mesh(new THREE.CylinderGeometry(.55, .42, .9, 20), M.pot, g); pot.position.y = .45;
    const stem = this.mesh(new THREE.CylinderGeometry(.04, .06, 2.6, 6), M.iron, g); stem.position.y = 2.1;
    const leaves = [], leaf = new THREE.SphereGeometry(.34, 8, 6); leaf.scale(1, .08, .62);
    for (let i = 0; i < 16; i++) {
      const a = i * 2.4, y = 1.5 + i * .13, r = .32 + (i % 3) * .08, l = leaf.clone();
      l.rotateZ(.5 - i * .02); l.rotateY(a); l.translate(Math.cos(a) * r, y, -Math.sin(a) * r);
      leaves.push(l);
    }
    this.mesh(mergeGeometries(leaves), M.leaf, g);
    this.plant = g;
  }

  // The landing: an oak floor round the stairwell (the hall's ceiling
  // under it), the window over the front door, the bedroom's door (shut
  // until that room is built), a runner and a second fig.
  buildUpstairs() {
    const M = this.materials, U = H.up, W = H.window, B = H.bedDoor;
    const oak = this.batch(M.oak), white = this.batch(M.white, {cast: false});
    for (const [x0, x1, z0, z1] of [[H.west, UPX, H.back, H.front], [UPX, H.east, H.well, H.front]]) {
      oak.box(x0, x1, U - .06, U, z0, z1);
      white.box(x0, x1, U - .45, U - .06, z0, z1);
    }
    // (The stairwell's edges: a white fascia.)
    white.box(UPX, H.east, U - .5, U - .06, H.well - .02, H.well + .02);
    // Round the stairwell: a handrail along the gallery's edge, over the upper flight.
    const rail = this.batch(M.walnut), post = this.batch(M.iron), gz = H.well + .08, RH = 2.1;
    rail.box(UPX + .05, H.east, U + RH - .06, U + RH + .06, gz - .08, gz + .08);
    for (let x = UPX + .3; x < H.east - .1; x += .3) post.box(x - .025, x + .025, U, U + RH, gz - .025, gz + .025);
    post.box(UPX - .04, UPX + .14, U, U + RH + .25, gz - .09, gz + .09); rail.add(new THREE.SphereGeometry(.13, 12, 10), UPX + .05, U + RH + .35, gz);
    this.landing = [oak.done(), white.done(), rail.done(), post.done()];
    // The window: the day's light in its glass, white bars, a deep sill.
    const g = new THREE.Group(); g.position.set(W.x, U, H.front); this.group.add(g);
    const add = (geo, mat, x, y, z, cast = false) => { const m = this.mesh(geo, mat, g, {cast}); m.position.set(x, y, z); return m; };
    const glass = add(new THREE.PlaneGeometry(W.w, W.h), M.glass, 0, W.sill + W.h / 2, -.02); glass.rotation.y = Math.PI;
    for (const x of [-W.w / 2, 0, W.w / 2]) add(new THREE.BoxGeometry(.1, W.h, .12), M.white, x, W.sill + W.h / 2, -.06);
    for (const y of [W.sill, W.sill + W.h * .62, W.sill + W.h]) add(new THREE.BoxGeometry(W.w + .1, .1, .12), M.white, 0, y, -.06);
    add(new THREE.BoxGeometry(W.w + .4, .1, .5), M.white, 0, W.sill - .05, -.25, true);
    this.upWindow = g;
    // The bedroom's door, shut: white, four panels, a brass knob.
    const d = new THREE.Group(); d.position.set(B.x, U, H.back); this.group.add(d);
    const dd = (geo, mat, x, y, z) => { const m = this.mesh(geo, mat, d, {cast: false}); m.position.set(x, y, z); return m; };
    for (const sx of [-1, 1]) dd(new THREE.BoxGeometry(.14, B.h + .1, .2), M.white, sx * (B.w / 2 - .07), (B.h + .1) / 2, .06);
    dd(new THREE.BoxGeometry(B.w, .14, .2), M.white, 0, B.h + .03, .06);
    this.bedDoorGroup = d;
    // (Its leaf stands open into the bedroom, against the east jamb: phase 21 step 3.)
    const leaf = new THREE.Group(); leaf.position.set(B.x + B.w / 2 - .19, U, -.45); leaf.rotation.y = Math.PI / 2; this.group.add(leaf);
    const lw = B.w - .28, lf = (geo, mat, x, y, z) => { const m = this.mesh(geo, mat, leaf, {cast: false}); m.position.set(x, y, z); return m; };
    lf(new THREE.BoxGeometry(lw, B.h, .1), M.white, lw / 2, B.h / 2, 0);
    const pw = lw / 2 - .2;
    for (const sx of [-1, 1]) for (const [y0, y1] of [[.4, 2.3], [2.6, 4.6]]) for (const sz of [-1, 1]) lf(roundedBox(pw, y1 - y0, .04, .03), M.white, lw / 2 + sx * (pw / 2 + .07), (y0 + y1) / 2, sz * .06);
    for (const sz of [-1, 1]) lf(new THREE.SphereGeometry(.09, 16, 12), M.brass, lw - .4, 2.4, sz * .12);
    this.bedLeaf = leaf;
    // A runner along the landing, and a fig in the corner by the window.
    const rug = this.mesh(new THREE.PlaneGeometry(4.6, 1.6), M.rug, this.group, {cast: false});
    rug.rotation.x = -Math.PI / 2; rug.position.set(-3.6, U + .012, 2.3);
    this.upRug = rug;
    this.buildPlant(H.west + .8, H.front - .8, U);
    this.upPlant = this.plant;
  }

  // A walnut console with a lamp and a bowl, under a round mirror; a
  // bench with a cushion at the west end; a long runner; the lantern.
  buildFurniture() {
    const M = this.materials, C = H.console, B = H.bench;
    const wood = this.batch(M.walnut), brass = this.batch(M.brass);
    // The console, against the kitchen's wall.
    wood.box(C.x - C.long / 2, C.x + C.long / 2, C.top - .12, C.top, .04, C.deep);
    wood.box(C.x - C.long / 2 + .1, C.x + C.long / 2 - .1, C.top - .42, C.top - .12, .1, C.deep - .06);
    for (const sx of [-1, 1]) for (const z of [.14, C.deep - .12]) wood.box(C.x + sx * (C.long / 2 - .1) - .05, C.x + sx * (C.long / 2 - .1) + .05, 0, C.top - .42, z - .05, z + .05);
    for (const sx of [-.5, .5]) brass.add(new THREE.SphereGeometry(.04, 8, 6), C.x + sx, C.top - .27, C.deep - .04);
    // On it: a lamp (lit in the evening) and a shallow bowl.
    const lamp = new THREE.Group(); lamp.position.set(C.x - .7, C.top, .42); this.group.add(lamp);
    const base = this.mesh(new THREE.CylinderGeometry(.11, .16, .7, 14), M.pot, lamp); base.position.y = .35;
    const shade = this.mesh(new THREE.CylinderGeometry(.24, .36, .5, 18, 1, true), M.shade, lamp, {cast: false}); shade.position.y = .95;
    brass.add(new THREE.CylinderGeometry(.3, .16, .14, 18), C.x + .55, C.top + .07, .42);
    // The mirror over it (on the wall: it hides with the wall).
    const back = this.walls[0];
    const ring = this.mesh(new THREE.TorusGeometry(.92, .07, 10, 40), M.brass, back, {cast: false}); ring.position.set(C.x - back.position.x, 4.3 - back.position.y, .05);
    const glass = this.mesh(new THREE.CircleGeometry(.9, 40), M.mirror, back, {cast: false}); glass.position.set(C.x - back.position.x, 4.3 - back.position.y, .04);
    // The bench, along the west wall.
    const bx0 = H.west + .06, bx1 = H.west + B.deep, z0 = B.z - B.long / 2, z1 = B.z + B.long / 2;
    wood.box(bx0, bx1, B.seat - .22, B.seat - .1, z0, z1);
    for (const z of [z0 + .12, z1 - .12]) for (const x of [bx0 + .08, bx1 - .08]) wood.box(x - .05, x + .05, 0, B.seat - .22, z - .05, z + .05);
    const cushion = this.mesh(roundedBox(B.deep - .1, B.long - .1, .2, .08), M.velvet);
    cushion.rotation.x = -Math.PI / 2; cushion.position.set((bx0 + bx1) / 2, B.seat, B.z);
    const pillow = this.mesh(roundedBox(.7, .7, .22, .1), M.linen); pillow.position.set(bx0 + .22, B.seat + .5, z0 + .5); pillow.rotation.set(0, Math.PI / 2, 0); pillow.rotateX(-.25);
    this.bench = cushion;
    // Hooks over the bench, with a straw hat.
    const west = this.westWall, hy = 4.4 - west.position.y;
    for (const dz of [-.7, 0, .7]) { const h = this.mesh(new THREE.CylinderGeometry(.035, .035, .22, 8), M.brass, west, {cast: false}); h.rotation.x = Math.PI / 2; h.position.set(-(B.z + dz - west.position.z), hy, .11); }
    const hat = this.mesh(new THREE.CylinderGeometry(.5, .5, .03, 24), M.mat, west, {cast: false}); hat.rotation.x = Math.PI / 2; hat.position.set(-(B.z - .7 - west.position.z), hy - .12, .2);
    const crown = this.mesh(new THREE.CylinderGeometry(.24, .27, .2, 20), M.mat, west, {cast: false}); crown.rotation.x = Math.PI / 2; crown.position.set(-(B.z - .7 - west.position.z), hy - .12, .3);
    wood.done(); brass.done();
    // The runner, down the middle of the open floor.
    const rug = this.mesh(new THREE.PlaneGeometry(5.2, 1.9), M.rug, this.group, {cast: false});
    rug.rotation.x = -Math.PI / 2; rug.position.set(-3.1, .012, 2.55);
    this.rug = rug;
    // The lantern: black iron and glass, on a rod from above.
    const L = H.lamp, lg = new THREE.Group(); lg.position.set(L.x, L.y, L.z); this.group.add(lg);
    const iron = M.iron;
    const rod = this.mesh(new THREE.CylinderGeometry(.025, .025, 1.6, 6), iron, lg, {cast: false}); rod.position.y = 1.35;
    for (const [x, z] of [[-.3, -.3], [.3, -.3], [.3, .3], [-.3, .3]]) { const p = this.mesh(new THREE.BoxGeometry(.04, 1.1, .04), iron, lg, {cast: false}); p.position.set(x, 0, z); }
    for (const y of [-.55, .55]) { const r = this.mesh(new THREE.BoxGeometry(.68, .04, .68), iron, lg, {cast: false}); r.position.y = y; }
    const glow = this.mesh(new THREE.CylinderGeometry(.1, .1, .5, 10), M.shade, lg, {cast: false}); glow.position.y = -.15;
    this.lantern = lg;
  }

  // Where things are, for the app (as kitchen.js's layout()).
  layout() {
    const at = (x, z) => V(x, 0, z), F = H.frontDoor, C = H.console, B = H.bench, S = H.stairs;
    const box = (x0, x1, z0, z1, y0, y1, tag) => ({kind: 'box', x0, x1, z0, z1, y0, y1, tag});
    const U = H.up, mu = (S.highZ[0] + S.highZ[1]) / 2, [l0] = S.landX;
    // The stairs, step by step (her tail rests on them, not through them),
    // and the railing round the stairwell.
    const stairSolids = [box(l0, H.east, H.back, H.front, 0, HALF), box(UPX, H.east, H.well - .05, H.well + .2, U, U + 2.2)];
    for (let i = 0; i < S.steps; i++) {
      stairSolids.push(box(S.x0 + i * S.tread, l0, S.lowZ[0], S.lowZ[1], 0, (i + 1) * S.rise));
      stairSolids.push(box(l0 - (i + 1) * S.tread, l0, S.highZ[0], S.highZ[1], HALF + i * S.rise - .35, HALF + (i + 1) * S.rise));
    }
    // The landing's two spots: at the top of the stairs, looking down them;
    // at the window. (At the landing's height: walkTo knows them by it.)
    const upSpots = {
      topSpot: {at: V(UPX - .75, U, mu), look: V(3, U - 3, mu)},
      windowSpot: {at: V(H.window.x, U, H.front - 1.1), look: V(H.window.x, U + 4, H.front + 3)},
    };
    // (Upstairs: the landing's or the bedroom's camera and spots, by which
    // side of its door she's on; the bedroom's two perches either way.)
    const BL = this.bedroom.layout(), AL = this.bathroom.layout();
    const wingL = this.wing === 'bedroom' ? BL : this.wing === 'bathroom' ? AL : null;
    if (this.level === 'up' && wingL) {
      const landing = this.upLayout(upSpots, stairSolids, BL, AL);
      return {...landing, home: wingL.home, sunSpot: wingL.sunSpot, limits: wingL.limits, camBox: wingL.camBox, camSolids: wingL.camSolids, camBlocks: wingL.camBlocks};
    }
    if (this.level === 'up') return this.upLayout(upSpots, stairSolids, BL, AL);
    return this.downLayout(upSpots, stairSolids);
  }
  upLayout(upSpots, stairSolids, BL, AL) {
    const U = H.up, box = (x0, x1, z0, z1, y0, y1) => ({kind: 'box', x0, x1, z0, z1, y0, y1});
    return {
      ...upSpots,
      seatLook: BL.seatLook, bedroomHome: BL.home,
      // (The bathroom's: the water at the tap, the roll, the mat, its middle.)
      tapDrink: AL.tapDrink, rollSpot: AL.rollSpot, matSpot: AL.matSpot, bathHome: AL.home,
      // (Spots up here are at the landing's height: walkTo knows them by it.)
      home: V(-3.2, U, 2.4), toyHome: V(-1.7, .13, 3.1),
      sunSpot: V(H.window.x, U, H.front - 1.3),
      perches: {...BL.perches, ...AL.perches}, perchTargets: [],
      tailSolids: [
        box(H.west - .5, H.west + .05, H.back, H.front, U, U + H.upH), box(H.west, H.east, H.front - .05, H.front + .5, U, U + H.upH),
        box(H.west, H.bedDoor.x - H.bedDoor.w / 2, H.back - .5, H.back + .05, U, U + H.upH), box(H.bedDoor.x + H.bedDoor.w / 2, H.east, H.back - .5, H.back + .05, U, U + H.upH), ...stairSolids,
        {kind: 'cyl', x: H.west + .8, z: H.front - .8, r: .55, y0: U, y1: U + .9},
        ...BL.tailSolids, ...AL.tailSolids,
      ],
      limits: {dist: [1.1, 21], pitch: [.04, 1.25], x: [H.west + .6, H.east - .6], z: [.4, H.front - .4], y: [U + .08, U + 6.5]},
      camBox: {x: [H.west + .2, H.east - .2], y: [U + .4, U + 12], z: [.2, 24]},
      camSolids: [[H.west + .8, H.front - .8, .7, U + 4.2]],
      camBlocks: [],
    };
  }
  downLayout(upSpots, stairSolids) {
    const at = (x, z) => V(x, 0, z), F = H.frontDoor, C = H.console, B = H.bench, S = H.stairs;
    const U = H.up;
    const box = (x0, x1, z0, z1, y0, y1, tag) => ({kind: 'box', x0, x1, z0, z1, y0, y1, tag});
    return {
      ...upSpots,
      home: at(-1.6, 2.6), toyHome: V(-1.7, .13, 3.1),
      // The patch of light the fanlight throws, just inside the front door.
      sunSpot: at(F.x, H.front - 1.5),
      // Where she sits to look up the stairs.
      stairsSpot: {at: at(S.x0 - .9, 3.8), look: V(S.x0 + 3, 3.5, 3.8)},
      perches: {},
      perchTargets: [],
      tailSolids: [
        box(H.west - .5, H.west + .05, H.back, H.front, 0, H.wallH), box(H.west, H.east, H.front - .05, H.front + .5, 0, H.wallH),
        box(H.west, H.door[0], H.back - .5, H.back + .05, 0, H.wallH), box(H.door[1], H.east, H.back - .5, H.back + .05, 0, H.wallH),
        box(C.x - C.long / 2, C.x + C.long / 2, 0, C.deep, 0, C.top), box(H.west, H.west + B.deep, B.z - B.long / 2, B.z + B.long / 2, 0, B.seat + .2),
        ...stairSolids,
        {kind: 'cyl', x: 3.0, z: 1.15, r: .55, y0: 0, y1: .9},
      ],
      limits: {dist: [1.1, 21], pitch: [.04, 1.25], x: [H.west + .6, H.east - .6], z: [.4, H.front - .4], y: [.08, 8.5]},
      // (The camera may stand back past the front wall, which hides.)
      // (Below the landing's floor: up there, the hall's ceiling hides it.)
      camBox: {x: [H.west + .2, H.east - .2], y: [.2, U - .6], z: [.2, 24]},
      camSolids: [[3.0, 1.15, .7, 4.2]],
      camBlocks: [[S.x0 - .2, S.landX[0], S.lowZ[0] - .2, H.front + .2, 5.4], [S.landX[0] - .2, H.east, H.back, H.front + .2, 5.5]],
    };
  }

  // What the Room view keeps in frame (see roomFrame in app.js): from
  // outside the front wall, looking in. Phones: the doorway, the front
  // door's side and the foot of the stairs; the bench is a drag away.
  frame(wide) {
    const S = H.stairs, C = H.console, U = H.up;
    // (Upstairs: the landing from outside its front wall, the top of the
    // stairs on one side, the bedroom's door ahead.)
    if (this.level === 'up' && this.wing === 'bedroom') return this.bedroom.frame(wide);
    if (this.level === 'up' && this.wing === 'bathroom') return this.bathroom.frame(wide);
    if (this.level === 'up') return {
      yaw: wide ? .12 : -.3,
      from: [-2, U + 1.5, 2.5],
      across: wide
        ? [[H.west + .4, U + 1, 4.4], [H.bedDoor.x, U + 5, .1], [UPX, U + .5, 1.2], [H.east - .5, U + 2.2, 2.5], [H.window.x, U + 1, 4.9]]
        : [[H.bedDoor.x - 1, U + 2.5, .1], [-5.6, U + .1, 3.4], [UPX + .8, U + .3, 1.2], [UPX + 1.5, U + 2.2, 2.5]],
      bottom: [[-3, U, 4.4], [UPX, U, 4.6]],
      top: [[H.bedDoor.x, U + 5.6, .1], [UPX, U + 2.4, 2.5]],
    };
    return {
      yaw: wide ? .12 : -.3,
      from: wide ? [0, 1.5, 2.5] : [-.6, 1.5, 2.5],
      across: wide
        ? [[H.west + .3, 1, 3.2], [H.west + .6, 4.4, .1], [C.x, 4.3, .1], [H.door[1], 3, .1], [S.x0, .5, 4.9], [S.landX[0], 5, 2.6], [H.east - .3, 5, 4.8], [H.east - .3, 7, .2]]
        : [[H.door[0] - .6, 2.5, .1], [-4.4, .1, 3.4], [S.x0 + 1.2, 1.6, 4.9], [S.x0 + 2.4, 3, 2.6]],
      bottom: [[-2.4, 0, 4.2], [S.x0, 0, 4.9]].concat(wide ? [[H.west + .5, 0, 4.4]] : []),
      top: wide ? [[S.landX[0], 7.6, .3], [C.x, 5.6, .1], [H.door[1], 5.8, .1]] : [[-2.15, 5.8, .1], [S.x0 + 2.4, 5.2, 2.6]],
    };
  }

  activate(lamp) { this.lamp = lamp; lamp.position.copy(this.lampFor()); }
  lampFor() { return this.level !== 'up' ? this.lampSpot : this.wing === 'bedroom' ? this.bedLampSpot : this.wing === 'bathroom' ? this.bathLampSpot : this.upLampSpot; }

  // Which floor she's on (the app sets it from her height): the hall's
  // or the landing's. The Room view, the camera's box, where she walks and
  // the lamp follow it; while she's downstairs the upstairs isn't drawn.
  setLevel(level) {
    if (level === this.level) return false;
    this.level = level; this.layoutCache = null;
    if (level !== 'up') this.wing = 'landing';
    if (this.lamp) this.lamp.position.copy(this.lampFor());
    return true;
  }
  // Upstairs, which side of the bedroom's door she's on (a little past the
  // middle of the wall either way, so a cat in the doorway doesn't flip it).
  setWing(wing) {
    if (wing === this.wing) return false;
    this.wing = wing; this.layoutCache = null;
    if (this.lamp) this.lamp.position.copy(this.lampFor());
    return true;
  }
  // (The bathroom the same way, by the bedroom's east wall, at x 7.)
  wingAt(p) {
    if (this.level !== 'up') return 'landing';
    if (p.z < -.45 && p.x > (this.wing === 'bathroom' ? 6.6 : 7.4)) return 'bathroom';
    return p.z < (this.wing === 'bedroom' || this.wing === 'bathroom' ? .1 : -.6) ? 'bedroom' : 'landing';
  }
  levelAt(y) { return y > HALF + 2.5 ? 'up' : 'down'; }
  // Between the floors (on a step or the half landing).
  onStairs(y) { return y > .05 && y < H.up - .05; }
  // What a paw at (x, z) stands on, for her at height `ref`: the highest
  // top there that she could step on to (not the floor over her head).
  groundAt(x, z, ref) { let best = 0; for (const t of tops(x, z)) if (t <= ref + 1.2 && t > best) best = t; return best; }
  // Her body's height there: smooth up a flight, along the line through
  // the middles of its treads (each step's paw height), else the floor.
  rampAt(x, z, ref) {
    const S = H.stairs, [l0] = S.landX, k = S.rise / S.tread;
    // (Up on the landing, over its floor: the landing, even where the line
    // of the upper flight passes under the gallery's edge.)
    if (ref > H.up - .3 && tops(x, z).includes(H.up)) return H.up;
    // (On a flight her body rides up to half a riser over that line, or the
    // treads' noses, which stand up to half a riser above it, come up
    // through her chest: a riser is nearly her hips' height. The lift eases
    // in and out over the first and last half step.)
    const lift = (y, lo, hi) => y + Math.max(0, Math.min(STAIR_LIFT * S.rise, y - lo, hi - y));
    if (ref < HALF + .6 && z >= S.lowZ[0] - .3 && x > S.x0 - S.tread / 2 && x < l0) return lift(Math.min(HALF, (x - S.x0 + S.tread / 2) * k), 0, HALF);
    if (ref > HALF - .6 && ref < H.up + .6 && z > -.05 && z <= S.highZ[1] + .3 && x > UPX - S.tread / 2 && x < l0) return lift(Math.min(H.up, HALF + (l0 - x + S.tread / 2) * k), HALF, H.up);
    return this.groundAt(x, z, ref);
  }
  // The way up the stairs (or down: the same, backwards): from the foot,
  // up the middle of the lower flight, round on the half landing, up the
  // upper flight and on to the landing.
  stairPath(up) {
    const S = H.stairs, [l0] = S.landX, ml = (S.lowZ[0] + S.lowZ[1]) / 2, mu = (S.highZ[0] + S.highZ[1]) / 2, lx = (l0 + H.east) / 2;
    const pts = [V(S.x0 - .9, 0, ml), V(l0 - .2, 0, ml), V(lx, 0, ml - .8), V(lx, 0, mu + .8), V(l0 - .2, 0, mu), V(UPX - .9, 0, mu)];
    return up ? pts : pts.reverse();
  }
  get up() { return H.up; }
  // The middle of the lower flight's tread i (0 at the bottom), at its height.
  treadSpot(i) { const S = H.stairs; return V(S.x0 + (i + .5) * S.tread, (i + 1) * S.rise, (S.lowZ[0] + S.lowZ[1]) / 2); }
  get stairFoot() { return this.stairPath(true)[0]; }
  get stairTop() { return this.stairPath(true).at(-1); }

  // Walking: the open floor west of the stairs, round the console.
  clampFloor(v) {
    if (this.level === 'up') {
      const F = UPFLOOR;
      // (Through the bathroom's door, or in there.)
      if (v.z < -.45 && (v.x > 7.2 || (v.x > 6.3 && this.bathroom.inLane(v)))) return this.bathroom.clampFloor(v);
      // (Through the bedroom's door, or in there.)
      if (v.z < F.z0 && (v.z < -.225 || this.bedroom.inLane(v))) return this.bedroom.clampFloor(v);
      v.x = Math.min(H.east - .7, Math.max(F.x0, v.x)); v.z = Math.min(F.z1, Math.max(F.z0, v.z));
      if (v.x > F.x1 && v.z < F.gz0) { if (F.gz0 - v.z < v.x - F.x1) v.z = F.gz0; else v.x = F.x1; }
      return v;
    }
    v.x = Math.min(FLOOR.x1, Math.max(FLOOR.x0, v.x)); v.z = Math.min(FLOOR.z1, Math.max(FLOOR.z0, v.z));
    const R = KEEP_OUT;
    if (v.x > R.x0 && v.x < R.x1 && v.z < R.z1) { if (R.z1 - v.z < Math.min(v.x - R.x0, R.x1 - v.x)) v.z = R.z1; else v.x = v.x - R.x0 < R.x1 - v.x ? R.x0 : R.x1; }
    return v;
  }
  randomFloorPoint(pad = 0) {
    const F = UPFLOOR;
    if (this.level === 'up' && this.wing === 'bedroom') return this.bedroom.randomFloorPoint(pad);
    if (this.level === 'up' && this.wing === 'bathroom') return this.bathroom.randomFloorPoint(pad);
    if (this.level === 'up') return this.clampFloor(Math.random() < .3 ? V(rand(F.x1, H.east - .7 - pad), 0, rand(F.gz0, F.z1)) : V(rand(F.x0 + pad, F.x1 - pad), 0, rand(F.z0 + pad, F.z1 - pad)));
    return this.clampFloor(V(rand(FLOOR.x0 + pad, FLOOR.x1 - pad), 0, rand(KEEP_OUT.z1, FLOOR.z1 - pad)));
  }
  pushOut(v) { return v; }
  // (Round the console's corner when it lies between: by the nearest one.
  // The whole way, the goal last: walkTo follows a route of two or more.)
  route(from, to) {
    if (this.level === 'up') {
      // (Between the landing, the bedroom and the bathroom, a row of three:
      // by each doorway on the way, each side's way round what stands there.)
      const ra = this.upRoom(from), rb = this.upRoom(to);
      const inner = (r, p, q) => r === 2 ? this.bathroom.path(p, q) : r === 1 ? this.bedroom.path(p, q) : this.landingPath(p, q);
      // (Stopped in the bathroom's doorway: out of it by the door's spot first,
      // not on a slant across the wall.)
      const A = this.bathroom, lane = p => A.inLane(p) && p.x < A.doorSpot.x - .3;
      if (ra === 2 && rb === 2 && lane(from) !== lane(to)) {
        const d = A.doorSpot, p = (lane(from) ? [d, ...A.path(d, to)] : [...A.path(from, d), d]).filter(q => Math.hypot(q.x - from.x, q.z - from.z) > .1 && Math.hypot(q.x - to.x, q.z - to.z) > .1);
        return p.length ? [...p, to.clone()] : [];
      }
      if (ra === rb) { const p = inner(ra, from, to).filter(q => Math.hypot(q.x - from.x, q.z - from.z) > .1); return p.length ? [...p, to.clone()] : []; }
      // (Each doorway's two spots, the lower-numbered room's first.)
      const doors = [[V(H.bedDoor.x, 0, UPFLOOR.z0 + .2), this.bedroom.doorSpot], [this.bathroom.bedroomSpot, this.bathroom.doorSpot]];
      const pts = [], dir = rb > ra ? 1 : -1;
      let cur = from;
      for (let r = ra; r !== rb; r += dir) {
        const [p, q] = dir > 0 ? doors[r] : [doors[r - 1][1], doors[r - 1][0]];
        pts.push(...inner(r, cur, p), p, q); cur = q;
      }
      pts.push(...inner(rb, cur, to));
      // (Nothing left between, the doorway's two spots being where she is
      // and where she's going: straight there. Else walkTo would ask again
      // for the same way, forever.)
      const flat = p => Math.hypot(p.x - from.x, p.z - from.z) > .2 && Math.hypot(p.x - to.x, p.z - to.z) > .2;
      const way = pts.filter(flat);
      return way.length ? way.concat([to.clone()]) : [];
    }
    const R = KEEP_OUT, inX = p => p.x > R.x0 - .01 && p.x < R.x1 + .01;
    if (Math.min(from.z, to.z) >= R.z1 - .01 || (from.x <= R.x0 && to.x <= R.x0) || (from.x >= R.x1 && to.x >= R.x1)) return [];
    if (!inX(from) && !inX(to) && Math.max(from.z, to.z) < R.z1) return [V(from.x < to.x ? R.x0 : R.x1, 0, R.z1 + .05), V(from.x < to.x ? R.x1 : R.x0, 0, R.z1 + .05)].filter(p => p.distanceTo(from) > .2).concat([to.clone()]);
    const low = from.z < to.z ? from : to;
    if (inX(low) || low.z >= R.z1) return [];
    const c = V(low.x <= R.x0 ? R.x0 : R.x1, 0, R.z1 + .05);
    return c.distanceTo(from) > .2 && c.distanceTo(to) > .2 ? [c, to.clone()] : [];
  }

  // Upstairs, can she dash straight from a to b? (Same side of the
  // bedroom's wall, and in there nothing standing between.)
  straightOk(a, b) {
    const r = this.upRoom(a);
    if (r !== this.upRoom(b)) return false;
    if (r === 2 && this.bathroom.inLane(a) !== this.bathroom.inLane(b)) return false;
    const R = r === 1 ? this.bedroom : r === 2 ? this.bathroom : null;
    return !R || !R.path(a, b).length && !R.blocked(a, b);
  }
  // Upstairs, which room (x, z) is in: 0 the landing, 1 the bedroom, 2 the bathroom.
  upRoom(p) { return this.bathroom.holds(p) && p.x > 6.3 ? 2 : p.z < -.225 ? 1 : 0; }
  // On the landing: round the stairwell's corner, between the main floor
  // and the gallery (the corner, or nothing).
  landingPath(from, to) {
    const F = UPFLOOR, c = V(F.x1 - .2, 0, (F.gz0 + F.z1) / 2), g = p => p.x > F.x1 + .05;
    return g(from) !== g(to) && Math.min(from.z, to.z) < F.gz0 && c.distanceTo(from) > .2 && c.distanceTo(to) > .2 ? [c] : [];
  }

  update(dt, t, night, {camera = null, lamp = null, away = false} = {}) {
    if (camera) {
      const eye = this.group.worldToLocal(camera.position.clone());
      for (const w of this.walls) {
        const n = V(0, 0, 1).applyQuaternion(w.quaternion);
        w.visible = V(0, 0, 0).subVectors(eye, w.position).dot(n) > -.05;
      }
      // (Upstairs is drawn only with her up there, the camera above its floor;
      // in the House view, looking in, by the floor picked: `houseFloor`.)
      const up = this.houseFloor ? this.houseFloor === 'up' : this.level === 'up';
      // (Except the kitchen's wall up there, with the bedroom's door: no sky over the hall.)
      for (const m of [...this.upFront, this.upWest, this.upEast, ...this.landing, this.upWindow, this.upRug, this.upPlant]) if (m && !up) m.visible = false;
      if (up) for (const m of [...this.landing, this.upWindow, this.upRug, this.upPlant]) m.visible = true;
      this.bedDoorGroup.visible = this.upWalls[1].visible;
      this.bedroom.group.visible = up; this.bedLeaf.visible = up;
      this.bathroom.group.visible = up;
      if (up) this.bedroom.update(camera);
      this.upWindow.visible = up && this.upFront[1].visible;
      // (The front door goes with its wall; the skirting with the kitchen's.)
      this.frontDoor.visible = this.frontWalls[0].visible;
      this.skirting.visible = this.walls[0].visible;
    }
    // (The tap's water, the roll's paper: whether or not it's drawn.)
    this.bathroom.update(dt, t);
    if (lamp) lamp.intensity = damp(lamp.intensity, night ? 26 : 3, 3, dt);
    const M = this.materials;
    M.shade.emissiveIntensity = damp(M.shade.emissiveIntensity, night ? 2.4 : .3, 3, dt);
    // The fanlight: daylight, or the dark blue of the evening outside.
    M.glass.emissiveIntensity = damp(M.glass.emissiveIntensity, night ? .12 : .9, 3, dt);
    const R = this.room;
    if (!away && this.scene.environment && R.envNight) {
      const env = night ? R.envNight : R.envDay;
      if (this.scene.environment !== env) this.scene.environment = env;
      this.scene.environmentIntensity = damp(this.scene.environmentIntensity, night ? .35 : .6, 3, dt);
    }
  }
}

// The long runner: a faded red field, a darker border, a row of medallions.
function drawRunner(g, w, h) {
  drawLinen(g, w, h, {base: '#7a3a36', dark: .14, seed: 51});
  g.strokeStyle = '#3a2420'; g.lineWidth = 14; g.strokeRect(7, 7, w - 14, h - 14);
  g.strokeStyle = '#c9b48a'; g.lineWidth = 3; g.strokeRect(20, 20, w - 40, h - 40);
  for (let i = 0; i < 5; i++) {
    const x = w * (i + .5) / 5, y = h / 2;
    g.fillStyle = i % 2 ? '#2f3d4a' : '#c9b48a';
    g.beginPath(); g.moveTo(x, y - 46); g.lineTo(x + 30, y); g.lineTo(x, y + 46); g.lineTo(x - 30, y); g.closePath(); g.fill();
    g.fillStyle = '#7a3a36'; g.beginPath(); g.arc(x, y, 9, 0, 7); g.fill();
  }
  drawNoiseOver(g, w, h);
}
function drawNoiseOver(g, w, h) {
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${i % 2 ? '255,240,220' : '30,15,10'},.05)`; g.fillRect((i * 97) % w, (i * 57) % h, 3, 2); }
}
