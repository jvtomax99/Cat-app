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
// The stairs: a dog-leg at the east end. The lower flight runs east along
// the front wall (ten risers of .5 to a half landing at y 5), the upper
// flight comes back west along the kitchen's wall, to the upper floor at
// y 10 (the phase's "Facts for the build").
import * as THREE from 'three';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';
import {canvasTexture, drawLinen, drawWood, roundedBox} from './room.js';

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
  stairs: {x0: 1.6, tread: .4, rise: .5, steps: 10, lowZ: [2.6, 5.05], highZ: [0, 2.45], landX: [5.6, 7]},
  lamp: {x: -2.15, y: 7.4, z: 2.5},
};
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
    // (And up past its top, where the upper floor will be: no sky over it.)
    wall(H.east - H.west, 30, 0, T + 15, H.back, 0);
    // The front wall, round the front door and its fanlight.
    this.frontWalls = [
      wall(f0 - H.west, T, (H.west + f0) / 2, T / 2, H.front, Math.PI),
      wall(f1 - f0, T - ft, F.x, (T + ft) / 2, H.front, Math.PI),
      wall(H.east - f1, T, (f1 + H.east) / 2, T / 2, H.front, Math.PI),
    ];
    this.westWall = wall(H.front - H.back, T, H.west, T / 2, (H.back + H.front) / 2, Math.PI / 2);
    this.eastWall = wall(H.front - H.back, T, H.east, T / 2, (H.back + H.front) / 2, -Math.PI / 2);
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
    // (Where it lands upstairs: a short piece of the floor to come.)
    const upX = l0 - n * S.tread;
    body.box(upX - 1.2, upX, 2 * half - .4, 2 * half - lip, b0, b1); tread.box(upX - 1.2, upX, 2 * half - lip, 2 * half, b0, b1 + .03);
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
    // (And along the edge of the floor to come, so the top doesn't end in thin air.)
    rail.box(upX - 1.2, upX, 2 * half + RH - .06, 2 * half + RH + .06, b1 - .18, b1 - .02);
    for (const x of [upX - .4, upX - .8, upX - 1.15]) post.box(x - .025, x + .025, 2 * half, 2 * half + RH, b1 - .125, b1 - .075);
    this.stairs = [tread.done(), body.done(), run.done(), rail.done(), post.done()];
    // Under the upper flight: a fiddle-leaf fig in a stone pot.
    this.buildPlant(3.0, 1.15);
  }

  buildPlant(x, z) {
    const M = this.materials, g = new THREE.Group();
    g.position.set(x, 0, z); this.group.add(g);
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
    const rug = this.mesh(new THREE.PlaneGeometry(6.4, 1.9), M.rug, this.group, {cast: false});
    rug.rotation.x = -Math.PI / 2; rug.position.set(-2.4, .012, 2.55);
    this.rug = rug;
    // The lantern: black iron and glass, on a rod from above.
    const L = H.lamp, lg = new THREE.Group(); lg.position.set(L.x, L.y, L.z); this.group.add(lg);
    const iron = M.iron;
    const rod = this.mesh(new THREE.CylinderGeometry(.025, .025, 6, 6), iron, lg, {cast: false}); rod.position.y = 3.6;
    for (const [x, z] of [[-.3, -.3], [.3, -.3], [.3, .3], [-.3, .3]]) { const p = this.mesh(new THREE.BoxGeometry(.04, 1.1, .04), iron, lg, {cast: false}); p.position.set(x, 0, z); }
    for (const y of [-.55, .55]) { const r = this.mesh(new THREE.BoxGeometry(.68, .04, .68), iron, lg, {cast: false}); r.position.y = y; }
    const glow = this.mesh(new THREE.CylinderGeometry(.1, .1, .5, 10), M.shade, lg, {cast: false}); glow.position.y = -.15;
    this.lantern = lg;
  }

  // Where things are, for the app (as kitchen.js's layout()).
  layout() {
    const at = (x, z) => V(x, 0, z), F = H.frontDoor, C = H.console, B = H.bench, S = H.stairs;
    const box = (x0, x1, z0, z1, y0, y1, tag) => ({kind: 'box', x0, x1, z0, z1, y0, y1, tag});
    return {
      home: at(-1.2, 2.6), toyHome: V(-.2, .13, 3.1),
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
        box(S.x0, H.east, S.lowZ[0], S.lowZ[1], 0, S.rise), box(S.x0 + S.tread, H.east, S.lowZ[0], S.lowZ[1], S.rise, 5),
        {kind: 'cyl', x: 3.0, z: 1.15, r: .55, y0: 0, y1: .9},
      ],
      limits: {dist: [1.1, 21], pitch: [.04, 1.25], x: [H.west + .6, H.east - .6], z: [.4, H.front - .4], y: [.08, 6.5]},
      // (The camera may stand back past the front wall, which hides.)
      camBox: {x: [H.west + .2, H.east - .2], y: [.2, 12], z: [.2, 24]},
      camSolids: [[3.0, 1.15, .7, 4.2]],
      camBlocks: [[S.x0 - .2, S.landX[0], S.lowZ[0] - .2, H.front + .2, 5.4], [S.landX[0] - .2, H.east, H.back, H.front + .2, 5.5]],
    };
  }

  // What the Room view keeps in frame (see roomFrame in app.js): from
  // outside the front wall, looking in. Phones: the doorway, the front
  // door's side and the foot of the stairs; the bench is a drag away.
  frame(wide) {
    const S = H.stairs, C = H.console;
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

  activate(lamp) { lamp.position.copy(this.lampSpot); }

  // Walking: the open floor west of the stairs, round the console.
  clampFloor(v) {
    v.x = Math.min(FLOOR.x1, Math.max(FLOOR.x0, v.x)); v.z = Math.min(FLOOR.z1, Math.max(FLOOR.z0, v.z));
    const R = KEEP_OUT;
    if (v.x > R.x0 && v.x < R.x1 && v.z < R.z1) { if (R.z1 - v.z < Math.min(v.x - R.x0, R.x1 - v.x)) v.z = R.z1; else v.x = v.x - R.x0 < R.x1 - v.x ? R.x0 : R.x1; }
    return v;
  }
  randomFloorPoint(pad = 0) {
    return this.clampFloor(V(rand(FLOOR.x0 + pad, FLOOR.x1 - pad), 0, rand(KEEP_OUT.z1, FLOOR.z1 - pad)));
  }
  pushOut(v) { return v; }
  // (Round the console's corner when it lies between: by the nearest one.)
  route(from, to) {
    const R = KEEP_OUT, inX = p => p.x > R.x0 - .01 && p.x < R.x1 + .01;
    if (Math.min(from.z, to.z) >= R.z1 - .01 || (from.x <= R.x0 && to.x <= R.x0) || (from.x >= R.x1 && to.x >= R.x1)) return [];
    if (!inX(from) && !inX(to) && Math.max(from.z, to.z) < R.z1) return [V(from.x < to.x ? R.x0 : R.x1, 0, R.z1 + .05), V(from.x < to.x ? R.x1 : R.x0, 0, R.z1 + .05)].filter(p => p.distanceTo(from) > .2);
    const low = from.z < to.z ? from : to;
    if (inX(low) || low.z >= R.z1) return [];
    const c = V(low.x <= R.x0 ? R.x0 : R.x1, 0, R.z1 + .05);
    return c.distanceTo(from) > .2 && c.distanceTo(to) > .2 ? [c] : [];
  }

  update(dt, t, night, {camera = null, lamp = null, away = false} = {}) {
    if (camera) {
      const eye = this.group.worldToLocal(camera.position.clone());
      for (const w of this.walls) {
        const n = V(0, 0, 1).applyQuaternion(w.quaternion);
        w.visible = V(0, 0, 0).subVectors(eye, w.position).dot(n) > -.05;
      }
      // (The front door goes with its wall; the skirting with the kitchen's.)
      this.frontDoor.visible = this.frontWalls[0].visible;
      this.skirting.visible = this.walls[0].visible;
    }
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
