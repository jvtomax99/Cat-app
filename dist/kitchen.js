// Mochi's kitchen: the second room she can explore, from Orion's approved
// design (an eclectic, collected open kitchen). Warm ivory plaster, pale
// limestone floor, tall black steel windows onto an olive garden, dark walnut
// lower cabinets under a cream stone counter, two brushed steel open shelves,
// a big rounded island in veined cream-and-brown stone with walnut-and-leather
// stools, and a sculptural brass mobile light. Through the opening on the
// right, a glimpse of her study (the way back there, once she can walk between
// rooms).
// Mochi's own corner: a canvas tent bed, her fountain and bowl, and a robot
// vacuum on its dock.
//
// Built the first time she visits. The things she'll play with (cups and
// plates on the shelves, the orchid, the plate of food, the vacuum) are kept
// as separate objects with their home positions, apart from the room itself.
// Same scale as the study: about 2.4 scene units per metre.
import * as THREE from 'three';
import {windowView} from './window-view.js';
import {Room, MOONLIGHT, DAYLIGHT, rng, canvasTexture, drawNoise, drawLinen, drawWood, roundedBox, lathe} from './room.js';

const {damp} = THREE.MathUtils;
const rand = (a, b) => a + Math.random() * (b - a);
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// The plan. Back wall at z = -4.2, window wall at x = -6, right wall at x = 7,
// with the opening to her study in the back wall between x = 3.8 and 6.2.
const K = {
  back: -4.2, left: -6, right: 7, door: [3.8, 6.2], doorTop: 5.4, wallH: 9.5,
  counter: 2.2, counterFront: -2.72, shelf1: 4.1, shelf2: 5.5, shelfX: [-5.2, 3.4], shelfD: .9,
  island: {x0: -3.9, x1: 1.5, z0: -.55, z1: 1.95, top: 2.25},
  tent: {x: 4.75, z: .75, ry: -.45},
};
// Where she may walk: the open floor, keeping clear of the island.
// (Her centre .6 from the window wall and the counter: her head turned
// to look at something reaches that far.)
const FLOOR = {x0: -5.25, x1: 6.3, z0: -2.15, z1: 4.3};
// The island and its stools, kept clear (the stools stand in front of it):
// her centre this far out keeps her head and hips (each about .6 from it)
// out of the island's base and the stools' legs (which reach .7 in front
// of the island).
const KEEP_OUT = {x0: K.island.x0 - .65, x1: K.island.x1 + .65, z0: K.island.z0 - .65, z1: K.island.z1 + 1.35};
// Where the robot vacuum's centre may go: its body (.43) clear of the walls
// and the counter; with her aboard, her head and hips (.6 each way) too.
const VAC_FLOOR = {x0: -5.4, x1: 6.5, z0: -2.25, z1: 4.3}, VAC_FLOOR_RIDE = {x0: -5.3, x1: 6.3, z0: -1.83, z1: 4.3};
// Round things on the floor she walks round: the fountain, her bowl, the
// tent (in and out by its doorway only) and the robot vacuum.
const TENT = {x: K.tent.x, z: K.tent.z, r: 1.55};
// (The vacuum's moves with it.)
const VAC = {x: 3.15, z: -2.0, r: .7};
const OBSTACLES = [{x: 3.0, z: 1.55, r: .9}, {x: 4.55, z: 2.6, r: .7}, TENT, VAC];
const VAC_HOME = V(3.15, 0, -2.0);
// The dock, for the vacuum with her aboard: her rear hangs .8 behind it.
const DOCK = {x: 3.15, z: -2.62, r: .55};
const TENT_DOOR = V(K.tent.x + Math.sin(K.tent.ry) * 1.95, 0, K.tent.z + Math.cos(K.tent.ry) * 1.95);
// The gap between the counter's end and the window wall, where the wall
// steps start: in and out by its mouth, straight, never turning inside it
// (it's narrower than she is long).
// (The mouth stands a little east and north: turning there toward the gap,
// her head and hips stay clear of the window wall.)
const GAP = {x0: -5.9, x1: -5.05, z0: -2.8, z1: -2.1}, GAP_MOUTH = V(-5.15, 0, -1.5);

export class Kitchen {
  constructor(scene, room) {
    this.scene = scene;
    this.room = room;
    this.id = 'kitchen';
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);
    this.clickables = [];
    this.walls = [];
    // Things Mochi will play with, each remembering where it belongs.
    this.props = {cups: [], plates: [], glasses: []};
    this.build();
  }

  // The bird: the same visitor as in the study's window.
  startBird(t, kind) { return Room.prototype.startBird.call(this, t, kind); }
  birdWorld(v) { return Room.prototype.birdWorld.call(this, v); }

  mesh(geo, material, parent = this.group, {cast = true, receive = true} = {}) {
    const m = new THREE.Mesh(geo, material);
    m.castShadow = cast; m.receiveShadow = receive;
    parent.add(m);
    return m;
  }
  box(w, h, d, x, y, z, material, parent = this.group, opts) {
    const m = this.mesh(new THREE.BoxGeometry(w, h, d), material, parent, opts);
    m.position.set(x, y, z);
    return m;
  }
  // A movable prop: remembers its home so it can be put back.
  prop(obj, list) {
    obj.userData.home = {p: obj.position.clone(), r: obj.rotation.clone(), parent: obj.parent};
    list?.push(obj);
    return obj;
  }

  build() {
    const M = this.materials = {
      floor: new THREE.MeshStandardMaterial({map: canvasTexture(1024, 1024, drawLimestone, {repeat: [7.5, 7.5]}), roughness: .55}),
      plaster: new THREE.MeshStandardMaterial({map: canvasTexture(512, 512, (g, w, h) => drawNoise(g, w, h, {base: '#efe3d0', blobs: [['rgba(255,250,240,.06)', 260, 20, 90], ['rgba(160,125,85,.035)', 220, 20, 80]], seed: 31}), {repeat: [3, 3]}), roughness: .95}),
      walnut: new THREE.MeshStandardMaterial({map: canvasTexture(512, 512, (g, w, h) => { g.translate(w, 0); g.rotate(Math.PI / 2); drawWood(g, w, h, {planks: 5, colors: ['#4b2e1c', '#563522', '#45291a', '#5c3b25'], seed: 41, grain: 40}); }), roughness: .5}),
      walnutDark: new THREE.MeshStandardMaterial({color: '#2b1a10', roughness: .7}),
      stone: new THREE.MeshStandardMaterial({map: canvasTexture(768, 768, drawBreccia), roughness: .3}),
      counter: new THREE.MeshStandardMaterial({map: canvasTexture(512, 512, drawCreamStone, {repeat: [.3, .3]}), roughness: .35}),
      // Brushed stainless: cool grey, streaked lengthwise, so it reads as steel
      // rather than mirroring the warm room as a cream.
      steel: new THREE.MeshStandardMaterial({map: canvasTexture(256, 64, drawBrushed), color: '#e4e8ea', metalness: .9, roughness: .36}),
      steelDark: new THREE.MeshStandardMaterial({color: '#8e8f8c', metalness: .8, roughness: .4}),
      iron: new THREE.MeshStandardMaterial({color: '#211e1b', metalness: .55, roughness: .45}),
      frame: new THREE.MeshStandardMaterial({color: '#1d1c1a', metalness: .3, roughness: .5}),
      brass: new THREE.MeshStandardMaterial({color: '#b58a3c', metalness: .85, roughness: .3}),
      ivory: new THREE.MeshStandardMaterial({color: '#efe7d8', roughness: .45}),
      cream: new THREE.MeshStandardMaterial({color: '#e2d6c2', roughness: .6}),
      clay: new THREE.MeshStandardMaterial({color: '#c9a98a', roughness: .8}),
      amber: new THREE.MeshStandardMaterial({color: '#c98634', transparent: true, opacity: .62, roughness: .12}),
      cobalt: new THREE.MeshPhysicalMaterial({color: '#1d3a9e', roughness: .18, clearcoat: .8}),
      canvas: new THREE.MeshStandardMaterial({map: canvasTexture(256, 256, (g, w, h) => drawLinen(g, w, h, {base: '#efe6d6', dark: .06, seed: 43}), {repeat: [2, 2]}), roughness: 1, side: THREE.DoubleSide}),
      olive: this.room.materials.oliveLinen,
      leather: this.room.materials.leather,
      // Leaves that stay solid at a distance: the study's leaf cut-out,
      // without mipmaps (which fade the cut-out's edges away on small,
      // far-off leaves and leave the shelf plants looking see-through).
      leaf: (() => { const m = this.room.materials.leaf.clone(), t = m.map.clone(); t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; m.map = t; m.alphaTest = .4; return m; })(),
      shade: new THREE.MeshStandardMaterial({color: '#f3eadb', emissive: '#ffe2b0', emissiveIntensity: .3, roughness: .6, side: THREE.DoubleSide}),
    };
    // Large stone pieces: their UVs run in scene units, so stretch the pattern.
    M.stone.map.repeat.set(.22, .22);
    this.buildShell();
    this.buildWindows();
    this.buildCounter();
    this.buildShelves();
    this.buildIsland();
    this.buildMobile();
    this.buildStools();
    this.buildTent();
    this.buildPainting();
    this.buildVacuum();
    this.buildSunPatch();
    this.buildDog();
  }

  // Floor, plaster walls and the opening to her study.
  buildShell() {
    const M = this.materials;
    const floor = this.mesh(new THREE.PlaneGeometry(60, 60), M.floor, this.group, {cast: false});
    floor.rotation.x = -Math.PI / 2; floor.position.y = -.002;
    this.floor = floor;
    // A wall panel; it hides when the camera swings round behind it.
    const wall = (w, h, x, y, z, ry, parent = this.group) => {
      const m = this.mesh(new THREE.PlaneGeometry(w, h), M.plaster, parent, {cast: false});
      m.position.set(x, y, z); m.rotation.y = ry;
      this.walls.push(m);
      return m;
    };
    const [d0, d1] = K.door, H = K.wallH;
    wall(d0 - K.left, H, (K.left + d0) / 2, H / 2, K.back, 0);
    wall(d1 - d0, H - K.doorTop, (d0 + d1) / 2, (H + K.doorTop) / 2, K.back, 0);
    wall(K.right - d1, H, (d1 + K.right) / 2, H / 2, K.back, 0);
    wall(14, H, K.right, H / 2, 2.8, -Math.PI / 2);
    // The window wall: plaster round the tall window.
    const wz0 = -3.7, wz1 = 3.9, wy0 = 0, wy1 = 8.0;
    wall(wz0 - K.back, H, K.left, H / 2, (K.back + wz0) / 2, Math.PI / 2);
    wall(11.5 - wz1, H, K.left, H / 2, (wz1 + 11.5) / 2, Math.PI / 2);
    wall(wz1 - wz0, H - wy1, K.left, (H + wy1) / 2, (wz0 + wz1) / 2, Math.PI / 2);
    this.windowRect = {z0: wz0, z1: wz1, y0: wy0, y1: wy1};
    // Deep plaster reveals round the opening.
    const T = .45;
    const reveal = M.plaster.clone(); reveal.color.set('#d9cab2');
    for (const x of [d0, d1]) { const r = this.mesh(new THREE.PlaneGeometry(T, K.doorTop), reveal, this.group, {cast: false}); r.position.set(x, K.doorTop / 2, K.back - T / 2); r.rotation.y = x === d0 ? Math.PI / 2 : -Math.PI / 2; }
    const soffit = this.mesh(new THREE.PlaneGeometry(d1 - d0, T), reveal, this.group, {cast: false});
    soffit.position.set((d0 + d1) / 2, K.doorTop, K.back - T / 2); soffit.rotation.x = Math.PI / 2;
    // A slim limestone skirting.
    const skirt = new THREE.MeshStandardMaterial({color: '#d8ccb6', roughness: .6});
    this.box(d0 - K.left, .14, .04, (K.left + d0) / 2, .07, K.back + .02, skirt, this.group, {cast: false});
    this.box(.04, .14, 14, K.right - .02, .07, 2.8, skirt, this.group, {cast: false});
  }

  // Floor-to-ceiling black steel glazing with a pair of garden doors in the
  // middle, onto a terrace with olive trees in pots and, beyond the dunes,
  // the sea. The bird visits here too.
  buildWindows() {
    const M = this.materials, {z0, z1, y0, y1} = this.windowRect, x = K.left + .02;
    // The view (window-view.js) stands a little way out, past a strip of
    // real terrace paving, so there's room outside the doors for a visitor
    // to walk by. It's larger than the glazing so it fills it from anywhere
    // in the kitchen.
    const out = 1.4, sc = 1.45;
    this.terraceView = windowView((z1 - z0) * sc, (y1 - y0) * sc, 'terrace', {anisotropy: this.room?.outside?.material.uniforms.uFar.value.anisotropy ?? 4});
    this.glass = this.terraceView.mesh; this.group.add(this.glass);
    this.glass.position.set(K.left - out, y0 + (y1 - y0) * sc / 2, (z0 + z1) / 2); this.glass.rotation.y = Math.PI / 2;
    this.paving = this.mesh(new THREE.PlaneGeometry(out + .05, (z1 - z0) * sc), new THREE.MeshBasicMaterial({color: '#e2d6c0', toneMapped: false}), this.group, {cast: false, receive: false});
    this.paving.rotation.x = -Math.PI / 2; this.paving.position.set(K.left - out / 2, -.001, (z0 + z1) / 2);
    this.outside = {x: K.left - out * .55, z0: z0 - 2.5, z1: z1 + 2.5, door: (z0 + z1) / 2};
    const zc = (z0 + z1) / 2, H = y1 - y0, T = 6.5;
    const v = (w, y0b, y1b, z) => this.box(.12, y1b - y0b, w, x + .04, (y0b + y1b) / 2, z, M.frame, this.group, {cast: false});
    const hz = (w, y, za, zb) => this.box(.12, w, zb - za, x + .04, y, (za + zb) / 2, M.frame, this.group, {cast: false});
    // Four bays: fixed glass either side, two door leaves in the middle,
    // under a transom.
    const bay = (z1 - z0) / 4, a = z0 + bay, c = z1 - bay, b = zc;
    for (const z of [z0, z1]) v(.16, y0, y1, z);
    for (const z of [a, c]) v(.14, y0, y1, z);
    v(.1, y0, T, b);
    hz(.16, y1, z0, z1); hz(.12, y0 + .06, z0, z1); hz(.14, T, z0, z1);
    // Glazing bars: two columns in the side bays, one in each door leaf;
    // four rows below the transom, and four panes above it.
    for (const [za, zb, cols] of [[z0, a, 2], [a, b, 1], [b, c, 1], [c, z1, 2]]) {
      for (let i = 1; i < cols; i++) v(.05, y0, T, za + (zb - za) * i / cols);
      for (let j = 1; j < 4; j++) hz(.05, y0 + (T - y0) * j / 4, za, zb);
      v(.05, T, y1, (za + zb) / 2);
    }
    // Door handles: slim black levers at the meeting stiles.
    for (const s of [-1, 1]) { const h = this.box(.06, .05, .28, x + .14, 3.0, b + s * .2, M.frame, this.group, {cast: false}); h.rotation.x = .1; }
    // The bird's window: a frame of reference along the glass (x along it,
    // y up, z into the room), as in the study.
    const wg = new THREE.Group(); wg.position.set(x + .02, 0, zc); wg.rotation.y = Math.PI / 2; this.group.add(wg);
    this.windowGroup = wg;
    Room.prototype.buildBird.call(this, wg, z1 - z0 - 1.2, 2.0, 4.4);
    // Perched on a glazing bar at about Mochi's eye level from the counter.
    this.birdBox.mid = y0 + (T - y0) * 2 / 4 + .06;
    // Halloween evenings: bats swooping past outside, as at the study window.
    Room.prototype.buildNightBats.call(this, wg);
  }

  // The back counter: walnut cabinets, a cream stone top, the sink with its
  // brass faucet, the range, and a stepping perch at the far left.
  buildCounter() {
    const M = this.materials, C = K.counter, zb = K.back, zf = K.counterFront, depth = zf - zb;
    const g = new THREE.Group(); this.group.add(g); this.counterGroup = g;
    const sections = [[-5.1, .3], [2.5, 3.6]];
    for (const [a, b] of sections) {
      this.box(b - a, C - .38, depth, (a + b) / 2, .2 + (C - .38) / 2, zb + depth / 2, M.walnut, g);
      this.box(b - a - .1, .2, depth - .12, (a + b) / 2, .1, zb + (depth - .12) / 2, M.walnutDark, g, {cast: false});
      // Door and drawer fronts with slim brass pulls.
      const n = Math.max(1, Math.round((b - a) / 1.1)), w = (b - a) / n;
      for (let i = 0; i < n; i++) {
        const cx = a + w * (i + .5);
        const drawer = this.mesh(roundedBox(w - .06, .5, .05, .01), M.walnut, g); drawer.position.set(cx, C - .48, zf + .02);
        const door = this.mesh(roundedBox(w - .06, C - .98, .05, .01), M.walnut, g); door.position.set(cx, .2 + (C - .98) / 2 + .02, zf + .02);
        this.box(.42, .03, .04, cx, C - .4, zf + .07, M.brass, g, {cast: false});
        this.box(.03, .4, .04, cx + (i % 2 ? -1 : 1) * (w / 2 - .15), 1.3, zf + .07, M.brass, g, {cast: false});
      }
    }
    // Stone top in pieces round the sink.
    const top = (a, b, z0 = zb, z1 = zf + .06) => this.box(b - a, .18, z1 - z0, (a + b) / 2, C - .09, (z0 + z1) / 2, M.counter, g);
    const sink = {x0: -2.85, x1: -1.35, z0: -3.85, z1: -3.05};
    top(-5.15, sink.x0); top(sink.x1, .3); top(2.5, 3.65);
    top(sink.x0, sink.x1, zb, sink.z0); top(sink.x0, sink.x1, sink.z1, zf + .06);
    // Brushed steel basin.
    const bw = sink.x1 - sink.x0, bd = sink.z1 - sink.z0, by = C - .45;
    this.box(bw, .02, bd, (sink.x0 + sink.x1) / 2, by, (sink.z0 + sink.z1) / 2, M.steelDark, g, {cast: false});
    for (const [w, d, x, z] of [[bw, .02, (sink.x0 + sink.x1) / 2, sink.z0], [bw, .02, (sink.x0 + sink.x1) / 2, sink.z1], [.02, bd, sink.x0, (sink.z0 + sink.z1) / 2], [.02, bd, sink.x1, (sink.z0 + sink.z1) / 2]]) this.box(w, .45, d, x, by + .22, z, M.steel, g, {cast: false});
    this.sink = {x: (sink.x0 + sink.x1) / 2, z: (sink.z0 + sink.z1) / 2, y: by, ...sink};
    // Brass gooseneck faucet and lever.
    const fx = this.sink.x, fz = zb + .28;
    const faucetBase = this.mesh(new THREE.CylinderGeometry(.06, .07, .1, 16), M.brass, g); faucetBase.position.set(fx, C + .05, fz);
    const neck = new THREE.CatmullRomCurve3([V(fx, C, fz), V(fx, C + .7, fz), V(fx, C + 1.0, fz + .15), V(fx, C + .95, fz + .45), V(fx, C + .7, fz + .55)]);
    // (Tapping the faucet asks her up for a drink.)
    this.faucetParts = [faucetBase, this.mesh(new THREE.TubeGeometry(neck, 24, .035, 10), M.brass, g)];
    this.faucetTip = V(fx, C + .68, fz + .55);
    const fall = this.faucetTip.y - by;
    this.stream = this.mesh(new THREE.CylinderGeometry(.012, .018, fall, 8), new THREE.MeshStandardMaterial({color: '#d9ecf5', transparent: true, opacity: .55, roughness: .05}), g, {cast: false, receive: false});
    this.stream.position.set(fx, by + fall / 2, fz + .55); this.stream.visible = false;
    const lever = this.mesh(new THREE.CylinderGeometry(.018, .018, .3, 8), M.brass, g); lever.position.set(fx + .14, C + .3, fz); lever.rotation.z = -1.1;
    // The range: brushed steel with black grates, knobs and an oven door.
    const rx0 = .3, rx1 = 2.5, rw = rx1 - rx0, rc = (rx0 + rx1) / 2;
    this.box(rw, C - .02, depth, rc, (C - .02) / 2, zb + depth / 2, M.steel, g);
    this.box(rw - .3, 1.05, .04, rc, .78, zf + .03, M.steelDark, g, {cast: false});
    const handle = this.mesh(new THREE.CylinderGeometry(.03, .03, rw - .5, 10), M.steel, g); handle.rotation.z = Math.PI / 2; handle.position.set(rc, 1.42, zf + .14);
    for (let i = 0; i < 6; i++) { const k = this.mesh(new THREE.CylinderGeometry(.06, .06, .07, 14), M.iron, g); k.rotation.x = Math.PI / 2; k.position.set(rx0 + .3 + i * (rw - .6) / 5, 1.82, zf + .05); }
    for (const [x, z] of [[rx0 + .55, -3.2], [rx1 - .55, -3.2], [rx0 + .55, -3.8], [rx1 - .55, -3.8]]) {
      this.box(.9, .05, .55, x, C + .02, z, M.iron, g, {cast: false});
      this.mesh(new THREE.CylinderGeometry(.12, .14, .05, 16), M.iron, g, {cast: false}).position.set(x, C + .05, z);
    }
    this.box(rw, .3, .06, rc, C + .15, zb + .03, M.steel, g, {cast: false});
    this.range = {x0: rx0, x1: rx1};
    // Brass pot filler on the wall above the range.
    const pf = new THREE.CatmullRomCurve3([V(rc, 3.4, zb + .02), V(rc, 3.4, zb + .25), V(rc + .5, 3.4, zb + .3)]);
    this.mesh(new THREE.TubeGeometry(pf, 10, .035, 8), M.brass, g);
    this.mesh(new THREE.CylinderGeometry(.03, .03, .2, 8), M.brass, g).position.set(rc + .5, 3.3, zb + .3);
    // Odds and ends on the counter, clear of her climbing route at the left
    // end: a crock of wooden spoons, a little olive in a pot, bottles, and a
    // brass mushroom lamp at the right.
    const crock = new THREE.Group(); crock.position.set(2.95, C, -3.75); g.add(crock);
    this.crock = crock; // (a seasonal look may swap it for its own jar)
    this.mesh(lathe([[0, 0], [.17, 0], [.18, .38], [.16, .4], [0, .4]], 20), M.cream, crock);
    for (let i = 0; i < 4; i++) { const s = this.mesh(new THREE.CylinderGeometry(.015, .02, .75, 6), M.walnut, crock); s.position.set((i - 1.5) * .05, .55, (i % 2) * .05); s.rotation.z = (i - 1.5) * .12; }
    const olive = this.counterOlive = new THREE.Group(); g.add(olive); // (likewise: Christmas stands a pine here)
    const pot = this.mesh(lathe([[0, 0], [.14, 0], [.18, .25], [0, .25]], 20), M.clay, olive); pot.position.set(-.55, C, -3.85);
    this.room.sprigs(olive, new THREE.Vector3(-.55, C + .25, -3.85), 7, .6, {stem: '#66704a', leaf: M.leaf});
    for (const [x, h, c] of [[2.65, .55, '#3e4a2c'], [2.75, .45, '#7a4a1e']]) this.mesh(lathe([[0, 0], [.07, 0], [.07, h * .7], [.03, h * .85], [.03, h], [0, h]], 14), new THREE.MeshStandardMaterial({color: c, roughness: .2}), g).position.set(x, C, -4.0);
    const lampG = new THREE.Group(); lampG.position.set(3.35, C, -3.9); g.add(lampG);
    this.mesh(lathe([[0, 0], [.13, 0], [.1, .05], [.03, .1], [.03, .55], [0, .55]], 16), M.brass, lampG);
    this.counterLamp = this.mesh(new THREE.SphereGeometry(.24, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.shade, lampG, {cast: false});
    this.counterLamp.position.y = .55;
    // Her steps: floating walnut blocks on the wall at the left end, rising
    // in a zig-zag with the counter and the shelves, so she can climb all
    // the way up: floor, step, counter, step, lower shelf, step, top shelf.
    this.steps = [1.15, 3.05, 4.85].map(top => {
      const st = this.box(.62, .14, .66, -5.6, top - .07, zb + .33, M.walnut, this.group);
      this.box(.06, .3, .5, -5.6, top - .29, zb + .27, M.walnutDark, this.group, {cast: false});
      return st;
    });
    this.step = this.steps[0];
    this.stepTops = [1.15, 3.05, 4.85];
  }

  // Two long brushed steel shelves, styled, with clear places to land.
  buildShelves() {
    const M = this.materials, [x0, x1] = K.shelfX, zc = K.back + K.shelfD / 2;
    this.shelves = [];
    for (const y of [K.shelf1, K.shelf2]) {
      const s = this.box(x1 - x0, .09, K.shelfD, (x0 + x1) / 2, y - .045, zc, M.steel);
      this.shelves.push(s);
      for (const bx of [x0 + .6, (x0 + x1) / 2, x1 - .6]) this.box(.04, .28, K.shelfD - .1, bx, y - .23, zc - .03, M.steel, this.group, {cast: false});
    }
    // Things stand toward the back; the front is a lane she can walk along.
    const S1 = K.shelf1, S2 = K.shelf2, z = K.back + .33;
    // Separate, movable pieces.
    const cup = (x, y, zz, mat = M.ivory) => {
      const c = new THREE.Group(); c.position.set(x, y, zz); this.group.add(c);
      this.mesh(lathe([[0, 0], [.07, 0], [.09, .02], [.1, .16], [.095, .17], [0, .17]], 18), mat, c);
      const h = this.mesh(new THREE.TorusGeometry(.045, .012, 6, 12), mat, c); h.position.set(.11, .09, 0); h.rotation.y = Math.PI / 2;
      return this.prop(c, this.props.cups);
    };
    const plate = (x, y, zz, r = .26) => {
      const p = this.mesh(lathe([[0, 0], [r * .55, 0], [r, .03], [r * 1.02, .04], [0, .02]], 28), M.ivory, this.group);
      p.position.set(x, y, zz); return this.prop(p, this.props.plates);
    };
    const glass = (x, y, zz) => {
      const gl = this.mesh(lathe([[0, 0], [.075, 0], [.085, .22], [.08, .22], [.07, .01], [0, .01]], 16), M.amber, this.group, {cast: false});
      gl.position.set(x, y, zz); return this.prop(gl, this.props.glasses);
    };
    const bowl = (x, y, zz, r = .22, mat = M.cream) => { const b = this.mesh(lathe([[0, 0], [r * .5, 0], [r, r * .55], [r * .95, r * .56], [r * .45, r * .05], [0, r * .05]], 24), mat, this.group); b.position.set(x, y, zz); return b; };
    // A small framed picture leaning against the wall: walnut frame, an ivory
    // mat, and one of Orion's paintings (3:4).
    const frame = (x, y, zz, w, file) => {
      const h = w * 4 / 3 + w * .12;
      const f = new THREE.Group(); f.position.set(x, y, zz - .1); f.rotation.x = -.08; this.group.add(f);
      this.mesh(roundedBox(w, h, .04, .01), M.walnutDark, f).position.y = h / 2;
      const mat = this.mesh(new THREE.PlaneGeometry(w * .86, h * .88), new THREE.MeshStandardMaterial({color: '#f2ece2', roughness: .9}), f, {cast: false});
      mat.position.set(0, h / 2, .022);
      const pw = w * .7, art = new THREE.MeshStandardMaterial({color: '#d9cbb3', roughness: .8});
      new THREE.TextureLoader().load(`./art/${file}`, t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; art.map = t; art.color.set('#ffffff'); art.needsUpdate = true; });
      this.mesh(new THREE.PlaneGeometry(pw, pw * 4 / 3), art, f, {cast: false}).position.set(0, h / 2, .024);
    };
    // Lower shelf: landing room at the left; two cups right beside it (hers
    // to pat at); then plates, bowls, a gap, amber glasses, a board, a little
    // painting (the blue pitcher), a bowl.
    this.shelfCups = [cup(-3.85, S1, z - .02), cup(-3.45, S1, z + .03)];
    for (let i = 0; i < 5; i++) plate(-2.75, S1 + i * .045, z - .03);
    bowl(-2.1, S1, z); bowl(-2.1, S1 + .1, z, .19);
    const glasses = [.25, .48, .71].map(x => glass(x, S1, z));
    const board = this.mesh(roundedBox(.5, .75, .05, .02), M.walnut, this.group); board.position.set(1.45, S1 + .37, K.back + .1); board.rotation.x = -.12;
    frame(2.3, S1, z + .1, .5, 'shelf-blue-pitcher.jpg');
    bowl(3.0, S1, z, .24, M.clay);
    // Upper shelf: landing room at the left; a trailing plant, the pears, the
    // cobalt vessel, plates, cups, books and another plant.
    const p1 = this.mesh(lathe([[0, 0], [.13, 0], [.16, .22], [0, .22]], 18), M.cream, this.group); p1.position.set(-3.25, S2, z);
    this.drapeIvy(V(-3.25, S2 + .2, z), 10, 1.0, K.back + K.shelfD + .02);
    frame(-2.45, S2, z + .1, .55, 'shelf-pears.jpg');
    const vessel = this.mesh(lathe([[0, 0], [.14, 0], [.28, .18], [.3, .34], [.2, .5], [.12, .56], [.13, .6], [0, .6]], 28), M.cobalt, this.group);
    vessel.position.set(-1.6, S2, K.back + .27); vessel.scale.setScalar(.82);
    for (let i = 0; i < 4; i++) plate(-.65, S2 + i * .045, z - .02, .24);
    const highCups = [cup(.05, S2, z, M.cream), cup(.35, S2, z + .04, M.cream)];
    const bookColors = ['#6b4a2e', '#cdbb98', '#3c4a3a', '#8a6a46', '#e3d8c3'];
    bookColors.slice(0, 4).forEach((c, i) => this.box(.08, .45 + (i % 3) * .05, .38, 1.4 + i * .09, S2 + .23 + (i % 3) * .025, z, new THREE.MeshStandardMaterial({color: c, roughness: .8})));
    // The last book stands on its own: she can tip it off.
    const book = new THREE.Group(); book.position.set(1.4 + 4 * .09, S2, z); this.group.add(book);
    this.box(.08, .5, .38, 0, .25, 0, new THREE.MeshStandardMaterial({color: bookColors[4], roughness: .8}), book);
    this.prop(book);
    // What she can pat off the edge, shelf by shelf.
    const L = this.props.plates;
    this.knockables = [
      ...this.shelfCups.map(obj => ({obj, kind: 'cup', shelf: 'shelf'})),
      ...glasses.map(obj => ({obj, kind: 'glass', shelf: 'shelf'})),
      {obj: L[4], kind: 'plate', shelf: 'shelf'},
      ...highCups.map(obj => ({obj, kind: 'cup', shelf: 'shelfHigh'})),
      {obj: L[8], kind: 'plate', shelf: 'shelfHigh'},
      {obj: book, kind: 'book', shelf: 'shelfHigh'},
    ];
    const p2 = this.mesh(lathe([[0, 0], [.15, 0], [.18, .26], [0, .26]], 18), M.clay, this.group); p2.position.set(2.75, S2, z);
    this.drapeIvy(V(2.75, S2 + .24, z), 11, 1.2, K.back + K.shelfD + .02);
  }

  // The robot vacuum. Now and then (or when tapped) it sets off from its
  // dock on a little tour of the floor, round the furniture, and goes home.
  // If it runs into her it stops, backs off a touch and turns away; a swat
  // sends it spinning; with her aboard it goes a little slower.
  startVacuum(t) {
    const v = this.vac;
    if (v.state !== 'docked') return false;
    Object.assign(v, {state: 'out', stops: 4 + Math.floor(Math.random() * 4), goal: null, path: null, wait: t + 1.2, spin: null, back: 0});
    this.vacuumButton.material.emissive.set('#6fb2ff');
    return true;
  }
  hitVacuum(t, from) {
    const v = this.vac;
    if (v.state === 'docked') return;
    v.spin = {start: t, dir: Math.random() < .5 ? -1 : 1, from: v.heading};
    // A little shove away from her paw.
    const p = this.vacuum.position, dx = p.x - from.x, dz = p.z - from.z, d = Math.max(.01, Math.hypot(dx, dz));
    v.shove = {x: dx / d * .35, z: dz / d * .35, start: t};
    v.path = null;
  }
  updateVacuum(dt, t, night, cat) {
    const v = this.vac, g = this.vacuum, p = g.position;
    VAC.x = p.x; VAC.z = p.z;
    if (v.state === 'docked') return;
    if (night && v.state === 'out') { v.state = 'home'; v.path = null; }
    // Spinning off after a swat (and pushed a little way).
    if (v.spin) {
      const k = (t - v.spin.start) / 1.1;
      v.heading = v.spin.from + v.spin.dir * Math.PI * 2.5 * Math.sin(Math.min(1, k) * Math.PI / 2);
      if (v.shove && t - v.shove.start < .4) { p.x += v.shove.x * dt / .4; p.z += v.shove.z * dt / .4; this.clampVacuum(p); }
      g.rotation.y = v.heading;
      if (k >= 1) { v.spin = null; v.wait = t + .6; }
      return;
    }
    // Bumped into her (not with her aboard): stop, back off, turn away.
    if (cat && !v.rider && cat.elevation < .1 && t - v.bumped > 2.5 && Math.hypot(cat.pos.x - p.x, cat.pos.z - p.z) < .8) {
      v.bumped = t; v.back = t + .5; v.wait = t + 1.4; v.path = null;
      v.turnTo = v.heading + (Math.random() < .5 ? -1 : 1) * (1.8 + Math.random());
    }
    if (t < v.back) { p.x -= Math.sin(v.heading) * .22 * dt; p.z -= Math.cos(v.heading) * .22 * dt; this.clampVacuum(p); return; }
    if (v.turnTo != null) {
      const d = Math.atan2(Math.sin(v.turnTo - v.heading), Math.cos(v.turnTo - v.heading));
      v.heading += Math.sign(d) * Math.min(Math.abs(d), 2.4 * dt); g.rotation.y = v.heading;
      if (Math.abs(d) < .05) v.turnTo = null;
      return;
    }
    if (t < v.wait) return;
    // Where to next: a few spots round the floor, then home.
    if (!v.goal) {
      if (v.state === 'out' && v.stops-- > 0) v.goal = this.randomFloorPoint(.75);
      else { v.state = 'home'; v.goal = VAC_HOME.clone(); }
      v.path = null;
    }
    // (Its own body clear of the island and stools: with her aboard, hers too,
    // so it plans again when she hops on or off.)
    if (v.planRider !== v.rider) { v.planRider = v.rider; v.path = null; }
    if (!v.path) { const r = VAC.r; VAC.r = 0; v.path = this.route(p, v.goal, v.rider ? .7 : .45); VAC.r = r; }
    if (!v.path.length) { v.path = null; v.goal = null; v.wait = t + .5; return; }
    const next = v.path[0], dx = next.x - p.x, dz = next.z - p.z, dist = Math.hypot(dx, dz);
    if (dist < .08) {
      v.path.shift();
      if (!v.path.length) {
        v.path = null;
        if (v.state === 'home') { v.state = 'docked'; v.goal = null; v.heading = Math.PI; g.rotation.y = v.heading; this.vacuumButton.material.emissive.set('#5fd38a'); return; }
        v.goal = null; v.wait = t + .6 + Math.random();
      }
      return;
    }
    const want = Math.atan2(dx, dz), d = Math.atan2(Math.sin(want - v.heading), Math.cos(want - v.heading));
    v.heading += Math.sign(d) * Math.min(Math.abs(d), 2.2 * dt);
    g.rotation.y = v.heading;
    if (Math.abs(d) < .35) {
      const sp = Math.min(dist, (v.rider ? .38 : .55) * dt), nx = p.x + Math.sin(v.heading) * sp, nz = p.z + Math.cos(v.heading) * sp;
      // Never drives into her: if she's on the floor just ahead, it stops
      // and turns away rather than closing in (and pinning her against the
      // furniture).
      if (cat && !v.rider && cat.elevation < .1) {
        const now = Math.hypot(cat.pos.x - p.x, cat.pos.z - p.z), next = Math.hypot(cat.pos.x - nx, cat.pos.z - nz);
        if (next < .9 && next < now) { v.path = null; v.wait = t + .8; v.turnTo = v.heading + (Math.random() < .5 ? -1 : 1) * (1.6 + Math.random()); return; }
      }
      p.x = nx; p.z = nz; this.clampVacBox(p);
    }
  }
  clampVacBox(p) {
    const F = this.vac.rider ? VAC_FLOOR_RIDE : VAC_FLOOR;
    p.x = Math.min(F.x1, Math.max(F.x0, p.x)); p.z = Math.min(F.z1, Math.max(F.z0, p.z));
    return p;
  }
  // On the floor and out of the island (but not out of its own circle).
  clampVacuum(p) {
    const r = VAC.r; VAC.r = 0; this.clampFloor(p); VAC.r = r; this.clampVacBox(p);
    // Its body (and hers, aboard) out of the island and stools too.
    const pad = this.vac.rider ? .7 : .45, R = {x0: KEEP_OUT.x0 - pad, x1: KEEP_OUT.x1 + pad, z0: KEEP_OUT.z0 - Math.min(pad, .45), z1: KEEP_OUT.z1 + pad};
    if (p.x > R.x0 && p.x < R.x1 && p.z > R.z0 && p.z < R.z1) {
      const opts = [[R.x0 - p.x, 0], [R.x1 - p.x, 0], [0, R.z0 - p.z], [0, R.z1 - p.z]].sort((a, b) => Math.abs(a[0] + a[1]) - Math.abs(b[0] + b[1]));
      if (Math.abs(opts[0][0] + opts[0][1]) < .4) { p.x += opts[0][0]; p.z += opts[0][1]; }
    }
  }
  get vacuumNearHome() { return this.vacuum.position.distanceTo(VAC_HOME) < 1.3; }

  // Trailing ivy from a pot on a shelf: the vines spill forward out of the
  // pot, over the shelf's front edge, and hang down in front of it.
  drapeIvy(at, vines, length, edgeZ) {
    const r = rng(83 + vines), per = 18, leaves = new THREE.InstancedMesh(new THREE.PlaneGeometry(.16, .16), this.materials.leaf, vines * per);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3();
    let n = 0;
    for (let v = 0; v < vines; v++) {
      const side = (v / (vines - 1) - .5) * .7 + (r() - .5) * .12, len = length * (.55 + r() * .55), over = edgeZ + .05 + r() * .06;
      for (let k = 0; k < per; k++) {
        const t = k / (per - 1);
        if (t < .28) {
          // Out of the pot and across to the edge, arching a little.
          const u = t / .28;
          p.set(at.x + side * u * .8, at.y + Math.sin(u * Math.PI) * .06 - u * .1, at.z + (over - at.z) * u);
        } else {
          // Down over the edge, swaying a touch.
          const u = (t - .28) / .72;
          p.set(at.x + side * .8 + Math.sin(u * 5 + v) * .05, at.y - .1 - u * len, over + Math.sin(u * 4 + v * 2) * .04 + u * .03);
        }
        q.setFromEuler(e.set(r() * 1.4 - .7, r() * 6.3, r() * 6.3));
        m4.compose(p, q, new THREE.Vector3(1, 1, 1).multiplyScalar(.65 + r() * .5 - t * .25));
        leaves.setMatrixAt(n++, m4);
      }
    }
    leaves.count = n;
    leaves.castShadow = true;
    this.group.add(leaves);
  }

  // Things on the shelves she can pat. A pat slides one toward the front
  // edge with a wobble; a pat too many and it goes over, onto the counter
  // below (from the top shelf it clears the lower one), and lies there,
  // unbroken, until it's put back a minute later.
  nextCup() { return this.shelfCups.find(c => !c.userData.fall) || null; }
  knockableNear(shelf, x) {
    let best = null;
    for (const k of this.knockables) if (k.shelf === shelf && !k.obj.userData.fall && (!best || Math.abs(k.obj.position.x - x) < Math.abs(best.obj.position.x - x))) best = k;
    return best;
  }
  nudgeCup(obj, t) {
    const u = obj.userData, k = this.knockables.find(k => k.obj === obj), kind = k?.kind || 'cup';
    if (u.fall) return null;
    const r = {cup: .1, glass: .085, plate: .25, book: .05}[kind], edge = K.back + K.shelfD - r + .04, to = obj.position.z + .2 + Math.random() * .12;
    u.wobble = t;
    if (to > edge) { u.fall = {start: t, kind, x: obj.position.x, y: obj.position.y, z: obj.position.z, r0: obj.rotation.clone()}; return 'fell'; }
    u.slide = {start: t, from: obj.position.z, to};
    return 'nudged';
  }
  updateCups(t) {
    for (const {obj, kind} of this.knockables) {
      const u = obj.userData, f = u.fall;
      if (f) {
        const k = t - f.start, lying = K.counter + {cup: .1, glass: .085, plate: .02, book: .04}[kind];
        // How it ends up: cups and glasses on their sides, a plate flat, the
        // book on its cover.
        const end = kind === 'plate' ? [0, 0, 0] : kind === 'book' ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0];
        if (k < .3) { const q = k / .3; obj.position.z = f.z + q * .1; if (kind === 'plate') obj.rotation.x = q * .25; else if (kind === 'book') obj.rotation.z = q * .5; else obj.rotation.x = q * .7; }
        else if (!f.landed) {
          const fall = Math.sqrt((f.y - lying) / 4.9), q = Math.min(k - .3, fall), e = Math.min(1, q / fall);
          obj.position.set(f.x + q * .1, Math.max(lying, f.y - 4.9 * q * q), f.z + .1 + q * .35);
          if (kind === 'plate') obj.rotation.set(.25 * (1 - e), q * 2, 0);
          else if (kind === 'book') obj.rotation.set(0, 0, .5 + e * (Math.PI / 2 - .5));
          else obj.rotation.set(.7 + e * (end[0] - .7), 0, q * .5);
          if (k - .3 >= fall) { obj.position.y = lying; obj.rotation.set(end[0], obj.rotation.y, end[2]); f.landed = t; f.lx = obj.position.x; f.ry = obj.rotation.y; this.onLand?.(kind); }
        } else if (t - f.landed < 1.1) {
          // A little roll (a plate spins and settles).
          const r = (t - f.landed) / 1.1, e = Math.sin(r * Math.PI / 2);
          if (kind === 'plate') { obj.rotation.y = f.ry + e * 1.2; obj.rotation.x = Math.sin(r * 18) * .05 * (1 - r); }
          else if (kind !== 'book') { obj.position.x = f.lx + e * .18; obj.rotation.y = e * .6; }
        } else if (t - f.landed > 60) {
          obj.position.copy(u.home.p); obj.rotation.copy(u.home.r); u.fall = null; u.slide = null; u.wobble = null;
        }
        continue;
      }
      if (u.slide) {
        const q = Math.min(1, (t - u.slide.start) / .25);
        obj.position.z = u.slide.from + (u.slide.to - u.slide.from) * (1 - (1 - q) * (1 - q));
        if (q >= 1) u.slide = null;
      }
      if (u.wobble != null) {
        const w = t - u.wobble, d = Math.exp(-w * 5), base = u.home.r;
        obj.rotation.x = base.x + Math.sin(w * 26) * (kind === 'plate' ? .05 : .14) * d; obj.rotation.z = base.z + Math.sin(w * 19 + 1) * .05 * d;
        if (w > 1.5) { obj.rotation.x = base.x; obj.rotation.z = base.z; u.wobble = null; }
      }
    }
  }
  // The salmon on the island: she may help herself. It's back a few minutes
  // later (someone made more).
  get salmonReady() { return this.salmon.visible; }
  eatSalmon(t) { this.salmon.visible = false; this.salmonBack = t + rand(150, 240); }
  // The brass faucet: a thin trickle, on while she drinks from it.
  faucetRun(on) { this.stream.visible = on; }
  // Down in the sink's basin (rather than on the stone round it)?
  inBasin(p) { const s = this.sink; return p.x > s.x0 + .12 && p.x < s.x1 - .12 && p.z > s.z0 + .08 && p.z < s.z1 - .06; }
  cupWorld(cup, v) { return cup.getWorldPosition(v); }

  // The island: a big, rounded block of veined stone with a walnut base
  // under the overhang where the stools tuck in. No sink on top.
  buildIsland() {
    const M = this.materials, I = K.island, w = I.x1 - I.x0, d = I.z1 - I.z0, cx = (I.x0 + I.x1) / 2, cz = (I.z0 + I.z1) / 2;
    const g = new THREE.Group(); this.group.add(g); this.island = g;
    const slab = (sw, sd, sh, r, x, y, z, mat) => {
      const m = this.mesh(roundedSlab(sw, sd, sh, r), mat, g);
      m.position.set(x, y, z);
      return m;
    };
    const topH = .2, baseH = I.top - topH;
    slab(w, d, topH, .35, cx, baseH, cz, M.stone);
    // Stone block at the right end (waterfall on front, end and back) and a
    // slim stone leg at the left end.
    slab(1.5, d, baseH, .35, I.x1 - .75, 0, cz, M.stone);
    slab(.24, d, baseH, .1, I.x0 + .12, 0, cz, M.stone);
    // Walnut base, set back under the front overhang.
    this.box(I.x1 - 1.5 - (I.x0 + .24), baseH, d - .75, (I.x0 + .24 + I.x1 - 1.5) / 2, baseH / 2, I.z0 + (d - .75) / 2 + .02, M.walnut, g);
    // A white orchid at the left end of the island, a small plate of food at
    // the right.
    this.orchid = this.buildOrchid(I.x0 + .7, I.top, I.z0 + .75);
    const plate = new THREE.Group(); plate.position.set(I.x1 - .65, I.top, cz + .25); this.group.add(plate);
    this.mesh(lathe([[0, 0], [.18, 0], [.32, .03], [.33, .045], [0, .025]], 28), M.ivory, plate);
    const fish = this.salmon = this.mesh(roundedBox(.34, .07, .16, .03), new THREE.MeshStandardMaterial({map: canvasTexture(64, 32, drawSalmon), roughness: .5}), plate);
    fish.position.set(-.02, .065, 0); fish.rotation.y = .3;
    const herb = this.mesh(new THREE.SphereGeometry(.05, 8, 6), new THREE.MeshStandardMaterial({color: '#5f7a3a', roughness: .8}), plate); herb.position.set(.13, .06, .08); herb.scale.y = .5;
    this.foodPlate = this.prop(plate);
  }

  buildOrchid(x, y, z) {
    const M = this.materials, g = new THREE.Group(); g.position.set(x, y, z); this.group.add(g);
    // A rough stone bowl.
    this.mesh(lathe([[0, 0], [.22, 0], [.36, .12], [.38, .3], [.34, .34], [0, .3]], 28), M.stone, g);
    const leafMat = new THREE.MeshStandardMaterial({color: '#3f5a2a', roughness: .5, side: THREE.DoubleSide});
    for (let i = 0; i < 4; i++) {
      const lf = this.mesh(new THREE.SphereGeometry(.22, 12, 6), leafMat, g, {cast: false});
      lf.scale.set(1, .1, .42); lf.position.set(Math.cos(i * 1.6) * .18, .34, Math.sin(i * 1.6) * .18); lf.rotation.y = -i * 1.6; lf.rotation.z = .25;
    }
    const stemMat = new THREE.MeshStandardMaterial({color: '#4c5a2e', roughness: .7});
    const petal = new THREE.MeshStandardMaterial({map: canvasTexture(64, 64, drawOrchidFlower), alphaTest: .4, side: THREE.DoubleSide, roughness: .6});
    this.orchidStems = [];
    for (const [ang, h, lean] of [[.4, 1.25, .5], [2.6, 1.05, .45], [4.4, 1.35, .35]]) {
      const stem = new THREE.Group(); stem.position.set(0, .3, 0); stem.rotation.y = ang; g.add(stem);
      const pts = [V(0, 0, 0), V(0, h * .6, .05), V(.08, h * .95, lean * .5), V(.14, h, lean)];
      this.mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, .012, 6), stemMat, stem, {cast: false});
      const curve = new THREE.CatmullRomCurve3(pts);
      for (let k = 0; k < 5; k++) {
        const p = curve.getPointAt(.62 + k * .09);
        const f = this.mesh(new THREE.PlaneGeometry(.2, .2), petal, stem, {cast: false});
        f.position.copy(p).add(V(0, -.04, .05)); f.rotation.set(-.2, (k - 2) * .25, (k % 2 - .5) * .3);
      }
      this.orchidStems.push(stem);
    }
    return this.prop(g);
  }

  // The mobile light: slender dark arms, aged brass joints, ivory shades,
  // airy and asymmetric, hanging over the island.
  buildMobile() {
    const M = this.materials, g = new THREE.Group(); this.group.add(g); this.mobile = g;
    const ix = (K.island.x0 + K.island.x1) / 2, iz = (K.island.z0 + K.island.z1) / 2;
    const arm = (a, b, r = .018) => {
      const v = new THREE.Vector3().subVectors(b, a), m = this.mesh(new THREE.CylinderGeometry(r, r, v.length(), 8), M.iron, g, {cast: false});
      m.position.copy(a).addScaledVector(v, .5); m.quaternion.setFromUnitVectors(V(0, 1, 0), v.normalize());
    };
    const joint = p => this.mesh(new THREE.SphereGeometry(.06, 12, 8), M.brass, g, {cast: false}).position.copy(p);
    const shade = (p, s = 1, tilt = 0) => {
      const m = this.mesh(new THREE.SphereGeometry(.5, 24, 12), M.shade, g, {cast: false});
      m.scale.set(1.1 * s, .38 * s, .8 * s); m.position.copy(p); m.rotation.z = tilt;
      return m;
    };
    const top = V(ix, K.wallH, iz), P = V(ix, 8.4, iz);
    this.mesh(new THREE.CylinderGeometry(.15, .15, .05, 16), M.brass, g, {cast: false}).position.set(ix, K.wallH - .03, iz);
    arm(top, P, .02); joint(P);
    const A = V(-3.6, 8.15, -2.2), B = V(ix + 1.6, 8.6, iz + .3);
    arm(P, A); arm(P, B); joint(A); joint(B);
    // Left: a long drop to a big shade, hung low in front of the shelves, a
    // leap from the top one. It hangs from a pivot and swings (with a cat on
    // it, or after one's leapt off): see updatePendant.
    const piv = new THREE.Group(); piv.position.copy(A); g.add(piv);
    const drop = A.y - 5.0;
    const cord = this.mesh(new THREE.CylinderGeometry(.012, .012, drop, 8), M.iron, piv, {cast: false}); cord.position.y = -drop / 2;
    const big = shade(V(0, -drop, 0), 1.15, 0); piv.add(big);
    this.shades = [big];
    this.pendant = {pivot: piv, drop, top: .5 * .38 * 1.15, ax: 0, az: 0, vx: 0, vz: 0, spin: 0, vspin: 0};
    // Right: an arm out to a brass counterweight disc, with a shade hung
    // from its middle, and a short arm up to a small shade.
    const C = V(B.x + 1.2, 8.35, B.z + .35); arm(B, C); joint(C);
    const disc = this.mesh(new THREE.CylinderGeometry(.22, .22, .03, 24), M.brass, g, {cast: false}); disc.position.copy(C).add(V(.15, -.2, 0)); disc.rotation.z = Math.PI / 2;
    const mid = V(B.x + .5, 8.5, B.z + .15); joint(mid);
    const b1 = V(mid.x, 7.35, mid.z); arm(mid, b1, .012); this.shades.push(shade(b1, .95, -.1));
    const D = V(ix - .7, 8.95, iz - .4); arm(P, D); joint(D);
    const d1 = V(D.x - .1, 8.0, D.z); arm(D, d1, .012); this.shades.push(shade(d1, .75, .2));
    this.lampSpot = V(ix, 6.4, iz);
  }

  // Two walnut stools with cognac leather seats and brass foot bars.
  buildStools() {
    const M = this.materials;
    for (const x of [-3.0, -1.85]) {
      const g = new THREE.Group(); g.position.set(x, 0, K.island.z1 + .45); this.group.add(g);
      const seat = this.mesh(new THREE.CylinderGeometry(.42, .36, .14, 28), M.leather, g); seat.position.y = 1.62; seat.scale.z = .85;
      for (const s of [-1, 1]) {
        const leg = this.mesh(roundedBox(.11, 1.56, .5, .04), M.walnut, g); leg.position.set(s * .26, .78, 0); leg.rotation.z = -s * .06;
      }
      const bar = this.mesh(new THREE.CylinderGeometry(.022, .022, .56, 8), M.brass, g); bar.rotation.z = Math.PI / 2; bar.position.set(0, .55, .16);
    }
  }

  // Mochi's tent bed: an ivory canvas A-frame on walnut poles, open at the
  // front and back, with an olive cushion big enough to turn and curl up on.
  buildTent() {
    const M = this.materials, T = K.tent, g = new THREE.Group();
    g.position.set(T.x, 0, T.z); g.rotation.y = T.ry; this.group.add(g);
    this.bed = g;
    const W = 1.3, D = 1.0, H = 1.95;
    for (const z of [-D, D]) for (const s of [-1, 1]) {
      const a = V(s * (W + .05), 0, z), b = V(-s * .1, H + .1, z), v = new THREE.Vector3().subVectors(b, a);
      const p = this.mesh(new THREE.CylinderGeometry(.03, .03, v.length(), 8), M.walnut, g);
      p.position.copy(a).addScaledVector(v, .5); p.quaternion.setFromUnitVectors(V(0, 1, 0), v.normalize());
    }
    const ridge = this.mesh(new THREE.CylinderGeometry(.03, .03, 2 * D + .2, 8), M.walnut, g); ridge.rotation.x = Math.PI / 2; ridge.position.y = H;
    // Canvas: ivory outside, a shaded taupe inside, so the interior reads as
    // a little den she can disappear into.
    const outside = M.canvas.clone(); outside.side = THREE.FrontSide;
    const inside = M.canvas.clone(); inside.side = THREE.BackSide; inside.color.set('#8f8270');
    const piece = (verts, uvs, out) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      const n = verts.length / 3, idx = [];
      for (let i = 1; i < n - 1; i++) idx.push(0, i, i + 1);
      // Wind each piece so its front faces outward.
      const A = V(verts[0], verts[1], verts[2]), B = V(verts[3], verts[4], verts[5]), C = V(verts[6], verts[7], verts[8]);
      if (new THREE.Vector3().subVectors(B, A).cross(new THREE.Vector3().subVectors(C, A)).dot(out) < 0) for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
      geo.setIndex(idx); geo.computeVertexNormals();
      this.mesh(geo, outside, g); this.mesh(geo, inside, g, {cast: false});
    };
    for (const s of [-1, 1]) piece([s * W, 0, -D, s * W, 0, D, 0, H, D, 0, H, -D], [0, 0, 1, 0, 1, 1, 0, 1], V(s, 1, 0));
    // Closed at the back.
    piece([-W, 0, -D, W, 0, -D, 0, H, -D], [0, 0, 1, 0, .5, 1], V(0, 0, -1));
    // At the front, two flaps tied back round an arched doorway: each runs
    // up its front pole to the tie, its inner edge curving round the
    // doorway, the canvas gathered into soft folds that bunch at the tie.
    const poleX = y => (W + .05) - (W + .15) * y / (H + .1), tieY = 1.3, tieX = poleX(tieY) - .02;
    const curve = []; for (let i = 0; i <= 24; i++) { const t = i / 24, u = 1 - t; curve.push([u * u * .55 + 2 * u * t * .3 + t * t * tieX, 2 * u * t * .55 + t * t * tieY]); }
    const innerAt = y => { for (let i = 1; i < curve.length; i++) if (curve[i][1] >= y) { const [x0, y0] = curve[i - 1], [x1, y1] = curve[i]; return x0 + (x1 - x0) * (y - y0) / Math.max(1e-6, y1 - y0); } return tieX; };
    const tieMat = M.canvas.clone(); tieMat.color.set('#cdbf9f');
    for (const s of [-1, 1]) {
      const cols = 14, rows = 20, verts = [], uvs = [], idx = [];
      for (let j = 0; j <= rows; j++) {
        const v = j / rows, y = v * tieY, xo = poleX(y) - .03, xi = innerAt(y), gather = Math.pow(v, 1.6);
        for (let i = 0; i <= cols; i++) {
          const u = i / cols, x = xo + (xi - xo) * u;
          // Folds: fuller toward the tie, where the cloth is gathered in;
          // the free edge rolls outward a little.
          const fold = Math.sin(u * Math.PI * 3.5 + .4) * (.018 + .05 * gather) * Math.sin(Math.PI * Math.min(1, u * 1.15 + .05));
          verts.push(s * x, y, D + .02 + Math.max(0, fold) * 1.2 + fold * .4 + u * u * .025 * (1 - v));
          uvs.push(x / W, y / H);
        }
      }
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const a = j * (cols + 1) + i, b = a + 1, c = a + cols + 1, e = c + 1;
        if (s > 0) idx.push(a, e, b, a, c, e); else idx.push(a, b, e, a, e, c);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geo.setIndex(idx); geo.computeVertexNormals();
      this.mesh(geo, outside, g); this.mesh(geo, inside, g, {cast: false});
      // The tie: a band of darker canvas round the gathered flap and the pole.
      const tie = this.mesh(new THREE.TorusGeometry(.075, .018, 8, 18), tieMat, g);
      tie.position.set(s * (tieX + .02), tieY - .02, D + .06); tie.rotation.set(Math.PI / 2, 0, s * .4); tie.scale.set(1, 1, .7);
      const tail = this.mesh(new THREE.BoxGeometry(.035, .22, .008), tieMat, g);
      tail.position.set(s * (tieX + .05), tieY - .16, D + .1); tail.rotation.z = s * .15;
    }
    this.mesh(roundedBox(2.3, .16, 1.95, .07), M.olive, g).position.y = .08;
    this.bedTop = .16;
    this.bedRadius = .9;
  }

  // A neighbour's golden retriever who comes by on the terrace now and
  // then: trots along outside, stops at the doors, looks in with its tail
  // going, maybe puts a paw up on the glass, then trots off.
  buildDog() {
    const gold = new THREE.MeshStandardMaterial({color: '#cf9a55', roughness: .95});
    const light = new THREE.MeshStandardMaterial({color: '#e6c290', roughness: .95});
    const dark = new THREE.MeshStandardMaterial({color: '#1d1714', roughness: .35});
    const dog = new THREE.Group(), body = new THREE.Group(); dog.add(body);
    const m = (geo, mat, parent, x, y, z) => { const o = this.mesh(geo, mat, parent, {cast: false}); o.position.set(x, y, z); return o; };
    const blob = (mat, parent, x, y, z, sx, sy, sz) => m(new THREE.SphereGeometry(1, 20, 14), mat, parent, x, y, z).scale.set(sx, sy, sz);
    // (Built facing +x, the way it walks.) A deep chest, a level back,
    // a soft feathered underline.
    blob(gold, body, -.05, .74, 0, .52, .24, .21);
    blob(gold, body, .3, .72, 0, .28, .29, .22);
    blob(light, body, .38, .62, 0, .18, .24, .17);
    blob(light, body, -.05, .55, 0, .4, .1, .16);
    blob(gold, body, -.38, .76, 0, .2, .21, .2);
    const neck = m(new THREE.CapsuleGeometry(.13, .22, 6, 12), gold, body, .5, .92, 0); neck.rotation.z = -.75;
    const head = new THREE.Group(); head.position.set(.64, 1.08, 0); body.add(head);
    blob(gold, head, 0, .02, 0, .16, .15, .14);
    const muzzle = m(new THREE.CapsuleGeometry(.075, .1, 6, 12), light, head, .17, -.04, 0); muzzle.rotation.z = -Math.PI / 2;
    m(new THREE.SphereGeometry(.04, 12, 10), dark, head, .3, -.02, 0);
    for (const s of [-1, 1]) {
      m(new THREE.SphereGeometry(.024, 10, 8), dark, head, .11, .06, s * .09);
      // Soft ears hanging beside the face.
      const ear = m(new THREE.SphereGeometry(1, 12, 10), gold, head, -.02, -.05, s * .135); ear.scale.set(.08, .15, .035); ear.rotation.x = s * .2;
    }
    const tongue = m(new THREE.CapsuleGeometry(.035, .04, 4, 8), new THREE.MeshStandardMaterial({color: '#d86a7a', roughness: .6}), head, .2, -.13, 0); tongue.scale.z = .6;
    const legs = [];
    for (const [x, z, hind] of [[.32, .11, 0], [.32, -.11, 0], [-.36, .11, 1], [-.36, -.11, 1]]) {
      const hip = new THREE.Group(); hip.position.set(x, .66, z); body.add(hip);
      m(new THREE.CapsuleGeometry(hind ? .085 : .07, .3, 6, 12), gold, hip, 0, -.2, 0);
      m(new THREE.CapsuleGeometry(.055, .26, 6, 10), gold, hip, hind ? -.03 : 0, -.47, 0);
      blob(light, hip, hind ? -.08 : -.06, -.3, 0, .05, .14, .05); // feathering
      blob(light, hip, .03, -.64, 0, .08, .04, .065);
      legs.push(hip);
    }
    // A plumed tail.
    const tail = new THREE.Group(); tail.position.set(-.55, .82, 0); body.add(tail);
    const t1 = m(new THREE.CapsuleGeometry(.05, .3, 6, 10), gold, tail, -.15, .06, 0); t1.rotation.z = 1.25;
    const plume = m(new THREE.SphereGeometry(1, 12, 10), light, tail, -.2, -.02, 0); plume.scale.set(.2, .07, .06); plume.rotation.z = .35;
    // A soft shadow under it on the paving.
    const sh = this.mesh(new THREE.PlaneGeometry(1.7, .8), new THREE.MeshBasicMaterial({map: canvasTexture(128, 64, (g, w, h) => {
      const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); grd.addColorStop(0, 'rgba(60,45,30,.45)'); grd.addColorStop(1, 'rgba(60,45,30,0)');
      g.setTransform(1, 0, 0, .5, 0, h / 4); g.fillStyle = grd; g.fillRect(0, 0, w, h * 2);
    }), transparent: true, depthWrite: false}), dog, {cast: false, receive: false});
    sh.rotation.x = -Math.PI / 2; sh.position.set(-.02, .005, 0);
    dog.visible = false;
    this.group.add(dog);
    this.dog = {g: dog, body, head, legs, tail, tongue, run: null};
  }
  // Start a visit; returns how long it lasts (0 if one's already on).
  startDog(t) {
    const d = this.dog;
    if (d.run) return 0;
    const O = this.outside, dir = Math.random() < .5 ? 1 : -1, paw = Math.random() < .6;
    const walk = (O.door - O.z0) / 1.1, stay = 5 + Math.random() * 4;
    d.run = {start: t, dir, walk, stay, paw, dur: walk * 2 + stay};
    d.g.visible = true;
    return d.run.dur;
  }
  // Where its head is (for her to look at), or null.
  dogWorld(v) { return this.dog.run ? this.dog.head.getWorldPosition(v) : null; }
  // Its paw up on the glass?
  get dogPawing() { const r = this.dog.run; return !!(r && r.pawing); }
  updateDog(t) {
    const d = this.dog, r = d.run;
    if (!r) return;
    const k = t - r.start, O = this.outside, from = r.dir > 0 ? O.z0 : O.z1, to = r.dir > 0 ? O.z1 : O.z0;
    if (k > r.dur) { d.run = null; d.g.visible = false; return; }
    let z, moving = true, look = 0, sit = 0;
    if (k < r.walk) z = from + (O.door - from) * (k / r.walk);
    else if (k < r.walk + r.stay) {
      z = O.door; moving = false;
      const q = (k - r.walk) / r.stay;
      look = Math.min(1, q * 5) * Math.min(1, (1 - q) * 5);
      sit = q > .15 && q < .55 && !r.paw ? 1 : 0;
      r.pawing = r.paw && q > .3 && q < .6;
    } else { z = O.door + (to - O.door) * ((k - r.walk - r.stay) / r.walk); r.pawing = false; }
    d.g.position.set(O.x, 0, z);
    d.g.rotation.y = r.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
    // Trotting: diagonal pairs swing together; standing, still.
    const ph = t * 9;
    d.legs.forEach((l, i) => { l.rotation.z = moving ? Math.sin(ph + (i === 0 || i === 3 ? 0 : Math.PI)) * .45 : 0; });
    d.body.position.y = moving ? Math.abs(Math.sin(ph)) * .03 : 0;
    // A paw up on the glass (the front leg nearest the room), or sitting.
    d.body.rotation.z = r.pawing ? .25 : sit * .35;
    if (r.pawing) d.legs[r.dir > 0 ? 1 : 0].rotation.set(0, 0, 1.3 + Math.sin(t * 6) * .15); else d.legs.forEach(l => { l.rotation.x = 0; });
    if (sit) { d.legs[2].rotation.z = d.legs[3].rotation.z = -1.1; d.body.position.y = -.12; }
    // Looking in at the room (and her), tail going, tongue out.
    d.head.rotation.set(0, look * (r.dir > 0 ? 1 : -1) * 1.1, moving ? -.1 : .1 + Math.sin(t * 2) * .05);
    d.tail.rotation.x = Math.sin(t * (moving ? 10 : 16)) * (moving ? .4 : .7);
    d.tongue.visible = !moving;
  }

  // Where she sits on the big pendant shade (the top of its dome), in the
  // kitchen's frame.
  pendantTop(v) {
    const p = this.pendant;
    p.pivot.updateMatrixWorld(true);
    return this.group.worldToLocal(p.pivot.localToWorld(v.set(0, -p.drop + p.top, 0)));
  }
  // The pendant swings from its pivot like a pendulum (lightly damped), and
  // turns a little on its cord. bump(): a push, from a cat landing on it,
  // shifting about up there, or leaping off.
  bumpPendant(x, z, spin = 0) { const p = this.pendant; p.vx += x; p.vz += z; p.vspin += spin; }
  updatePendant(dt, riding) {
    const p = this.pendant, k = 9.8 / p.drop * 2.2, c = riding ? .35 : .5;
    p.vx += (-k * p.ax - c * p.vx) * dt; p.vz += (-k * p.az - c * p.vz) * dt;
    p.ax += p.vx * dt; p.az += p.vz * dt;
    p.vspin += (-1.2 * p.spin - .6 * p.vspin) * dt; p.spin += p.vspin * dt;
    p.pivot.rotation.set(p.ax, p.spin, p.az);
  }

  // A round robot vacuum, parked on its discreet dock by the counter.
  buildVacuum() {
    const g = new THREE.Group(); g.position.set(3.15, 0, -2.0); g.rotation.y = Math.PI; this.group.add(g);
    const white = new THREE.MeshStandardMaterial({color: '#ecebe6', roughness: .35});
    const dark = new THREE.MeshStandardMaterial({color: '#2a2a2a', roughness: .4});
    this.mesh(new THREE.CylinderGeometry(.42, .42, .1, 32), white, g).position.y = .07;
    this.mesh(new THREE.CylinderGeometry(.43, .43, .02, 32), dark, g).position.y = .03;
    this.mesh(new THREE.CylinderGeometry(.13, .13, .04, 20), dark, g).position.set(0, .13, -.1);
    this.vacuumButton = this.mesh(new THREE.CylinderGeometry(.05, .05, .03, 16), new THREE.MeshStandardMaterial({color: '#3b3b3b', emissive: '#5fd38a', emissiveIntensity: .4}), g);
    this.vacuumButton.position.set(0, .13, .15);
    this.vacuum = this.prop(g);
    this.vac = {state: 'docked', heading: Math.PI, goal: null, path: null, wait: 0, stops: 0, rider: false, spin: null, back: 0, bumped: -99};
    const dock = new THREE.Group(); dock.position.set(3.15, 0, -2.62); this.group.add(dock);
    this.mesh(roundedBox(.62, .34, .2, .05), dark, dock).position.y = .17;
    this.mesh(new THREE.BoxGeometry(.08, .03, .01), new THREE.MeshBasicMaterial({color: '#7be0a0'}), dock).position.set(0, .28, .105);
  }

  // Window light falling across the limestone.
  // On the right wall over her tent: Jan Davidsz de Heem, Vase of Flowers,
  // c. 1660 (National Gallery of Art, Washington; open access), in a dark
  // frame with a narrow gilt liner, larger than life for drama, as in the study.
  buildPainting() {
    const M = this.materials, W = 2.36, H = W * 69.6 / 56.5, F = .24, Ln = .045;
    const g = new THREE.Group(); g.position.set(K.right, 4.2, .35); g.rotation.y = -Math.PI / 2; this.group.add(g);
    const ebony = new THREE.MeshStandardMaterial({color: '#21150e', roughness: .45, metalness: .1});
    const gilt = new THREE.MeshStandardMaterial({color: '#9c7b45', roughness: .45, metalness: .7}); // antique gold
    const ow = W + 2 * (F + Ln), oh = H + 2 * (F + Ln);
    for (const [w, h, x, y] of [[ow, F, 0, (oh - F) / 2], [ow, F, 0, -(oh - F) / 2], [F, oh - 2 * F, (ow - F) / 2, 0], [F, oh - 2 * F, -(ow - F) / 2, 0]]) this.box(w, h, .14, x, y, .07, ebony, g);
    const iw = W + 2 * Ln, ih = H + 2 * Ln;
    for (const [w, h, x, y] of [[iw, Ln, 0, (ih - Ln) / 2], [iw, Ln, 0, -(ih - Ln) / 2], [Ln, ih - 2 * Ln, (iw - Ln) / 2, 0], [Ln, ih - 2 * Ln, -(iw - Ln) / 2, 0]]) this.box(w, h, .09, x, y, .045, gilt, g, {cast: false});
    const canvas = new THREE.MeshStandardMaterial({color: '#2a1d14', roughness: .55});
    new THREE.TextureLoader().load('./art/de-heem-vase-of-flowers.jpg', t => {
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
      canvas.map = t; canvas.color.set('#ffffff'); canvas.needsUpdate = true;
    });
    this.mesh(new THREE.PlaneGeometry(W, H), canvas, g, {cast: false}).position.z = .03;
  }

  buildSunPatch() {
    const beam = canvasTexture(256, 256, (c, w, h) => { c.filter = 'blur(10px)'; c.fillStyle = 'rgba(255,214,150,1)'; for (let i = 0; i < 2; i++) for (let j = 0; j < 5; j++) c.fillRect(24 + i * 110, 14 + j * 46, 96, 38); });
    this.sunPatch = this.mesh(new THREE.PlaneGeometry(3.2, 6.4), new THREE.MeshBasicMaterial({map: beam, transparent: true, opacity: .3, blending: THREE.AdditiveBlending, depthWrite: false}), this.group, {cast: false, receive: false});
    this.sunPatch.rotation.set(-Math.PI / 2, 0, -.35);
    this.sunPatch.position.set(-4.0, .02, 1.2);
  }

  // Everything the app needs to know about the room's layout.
  layout() {
    const t = this.bed, kitchen = this;
    t.updateMatrixWorld(true);
    const at = (x, z) => V(x, 0, z);
    return {
      home: at(-1.0, 3.5), toyHome: V(.2, .13, 3.5),
      bowl: {p: at(4.55, 2.6), ry: -.5}, fountain: {p: at(3.0, 1.55), ry: .3},
      sunSpot: at(-4.7, 2.6),
      // On the island, by the salmon (facing it).
      salmonSpot: {at: at(.25, .95), face: Math.PI / 2},
      // The sink: she hops down into the basin from the front strip. To
      // drink she stands along it, her head at the faucet's trickle; or she
      // just sits in it, because it's there.
      sink: {laneZ: -2.95, y: this.sink.y + .01, drinkAt: at(this.stream.position.x + .34, this.stream.position.z - .03), sitAt: at(-2.0, -3.45), drink: V(this.stream.position.x, this.sink.y + .14, this.stream.position.z), x0: this.sink.x0 + .3, x1: this.sink.x1 - .3},
      // Where she sits to watch the bird at the garden doors.
      windowSpot: at(-5.0, .4),
      // Floor -> stepping perch -> back counter -> lower shelf -> upper
      // shelf, all at the left end, well away from the range.
      perches: {
        step: {spot: at(-5.6, -3.87), top: this.stepTops[0], base: at(-5.45, -2.45), face: 0},
        counter: {spot: at(-4.65, -3.35), top: K.counter, via: 'step', face: 0, lane: {z: -2.95, x0: -4.9, x1: .1}},
        stepMid: {spot: at(-5.6, -3.87), top: this.stepTops[1], via: 'counter', face: 0},
        shelf: {spot: at(-4.6, -3.9), top: K.shelf1, via: 'stepMid', face: 0, lane: {z: K.back + K.shelfD - .17, x0: -4.5, x1: 3.0}},
        stepTop: {spot: at(-5.6, -3.87), top: this.stepTops[2], via: 'shelf', face: 0},
        shelfHigh: {spot: at(-4.65, -3.9), top: K.shelf2, via: 'stepTop', face: 0, lane: {z: K.back + K.shelfD - .17, x0: -4.5, x1: 3.0}},
        // Up on the island (from behind it), only for the salmon.
        island: {spot: at(.3, -.2), top: K.island.top, base: at(.3, -1.75), face: 0},
        // Riding the big pendant shade (from the top shelf, a flying leap):
        // wherever it's swung to; she drops down onto the counter below.
        pendant: {get spot() { return kitchen.pendantTop(V(0, 0, 0)).setY(0); }, get top() { return kitchen.pendantTop(V(0, 0, 0)).y; },
          via: 'shelfHigh', face: 0, ride: true, dropTo: {at: at(-3.6, -2.95), top: K.counter, perch: 'counter'}},
        // Riding the robot vacuum: wherever it is; off to one side of it.
        // (Off to whichever side has the room, or ahead or behind it when
        // neither has, in the lane behind the island: by the stools or a
        // wall she'd land with her head in them. Scored by how far the
        // furniture, walls and counter push the spot; the open front
        // doesn't count.)
        vacuum: {spot: this.vacuum.position, top: .16, face: 0, ride: true, get base() {
          const p = kitchen.vacuum.position, h = kitchen.vac.heading, side = V(Math.cos(h), 0, -Math.sin(h)).multiplyScalar(.8), ahead = V(Math.sin(h), 0, Math.cos(h)).multiplyScalar(.9);
          // (Room for the whole of her, not just her centre: sitting down
          // after the hop her hips reach .5 behind her, so a spot hard by
          // her bowl, the fountain or the tent counts against it, and the
          // one chosen is moved clear of them.)
          const ROOM = .5, round = OBSTACLES.filter(o => o !== VAC);
          const crowd = q => round.reduce((n, o) => n + Math.max(0, o.r + ROOM - Math.hypot(q.x - o.x, q.z - o.z)), 0);
          const score = q => { const c = kitchen.clampFloor(q.clone()); return kitchen.pushOut(q.clone()).distanceTo(q) + Math.abs(c.x - q.x) + Math.max(0, FLOOR.z0 - q.z) + crowd(q); };
          let best = null, bs = Infinity;
          for (const q of [p.clone().add(side), p.clone().sub(side), p.clone().sub(ahead), p.clone().add(ahead)]) { const sc = score(q); if (sc < bs - 1e-6) { bs = sc; best = q; } }
          for (const o of round) { const d = Math.hypot(best.x - o.x, best.z - o.z); if (d < o.r + ROOM && d > 1e-3) { best.x = o.x + (best.x - o.x) / d * (o.r + ROOM); best.z = o.z + (best.z - o.z) / d * (o.r + ROOM); } }
          return kitchen.clampFloor(best);
        }},
      },
      // What her tail keeps out of (clearTail in motion.js), as it is on
      // the floor: the island (its base pieces and top), the stools (legs,
      // foot bar, seat), the counter and the range, the dock, the walls
      // (either side of the doorway), the tent from outside, her fountain
      // and bowl. The app adds the vacuum where it is.
      tailSolids: (() => {
        const box = (x0, x1, z0, z1, y0, y1, tag) => ({kind: 'box', x0, x1, z0, z1, y0, y1, tag});
        const cyl = (x, z, r, y0, y1) => ({kind: 'cyl', x, z, r, y0, y1});
        const I = K.island, d = I.z1 - I.z0, baseH = I.top - .2, list = [
          box(I.x0 + .24, I.x1 - 1.5, I.z0 + .02, I.z0 + .02 + d - .75, 0, baseH), box(I.x1 - 1.5, I.x1, I.z0, I.z1, 0, baseH), box(I.x0, I.x0 + .24, I.z0, I.z1, 0, baseH),
          box(I.x0, I.x1, I.z0, I.z1, baseH, I.top),
          box(K.left, 3.6, K.back, K.counterFront, 0, K.counter, 'counter'),
          box(2.84, 3.46, -2.72, -2.52, 0, .34),
          box(K.left - .5, K.left + .12, K.back, FLOOR.z1 + 1, 0, K.wallH), box(K.right - .05, K.right + .5, K.back, FLOOR.z1 + 1, 0, K.wallH),
          box(K.left, K.door[0], K.back - .5, K.back + .05, 0, K.wallH), box(K.door[1], K.right, K.back - .5, K.back + .05, 0, K.wallH),
          {kind: 'rbox', x: K.tent.x, z: K.tent.z, ry: K.tent.ry, hx: 1.32, hz: 1.02, y0: 0, y1: 1.95, tag: 'bed'},
          cyl(3.0, 1.55, .55, 0, .23), cyl(3.0, 1.55, .23, .23, .38), cyl(4.55, 2.6, .37, 0, .16),
        ];
        for (const x of [-3.0, -1.85]) {
          const z = I.z1 + .45;
          for (const s of [-1, 1]) list.push(box(x + s * .26 - .06, x + s * .26 + .06, z - .25, z + .25, 0, 1.56));
          list.push(box(x - .28, x + .28, z + .14, z + .18, .53, .57), cyl(x, z, .42, 1.55, 1.69));
        }
        return list;
      })(),
      perchTargets: [['step', this.steps[0]], ['stepMid', this.steps[1]], ['stepTop', this.steps[2]], ['counter', this.counterGroup], ['shelf', this.shelves[0]], ['shelfHigh', this.shelves[1]], ['vacuum', this.vacuum], ['pendant', this.shades[0]], ['salmon', this.foodPlate]],
      // In the tent she lies along it, facing out of the open front.
      // Curled up inside, her back to the closed end (her tail lying along
      // it, clear of the canvas) and her face to the doorway; a little
      // forward of the middle, so the tail has room.
      sleepHeading: K.tent.ry,
      bedOffset: V(Math.sin(K.tent.ry) * .15, 0, Math.cos(K.tent.ry) * .15),
      // Awake in the tent she faces out of the doorway (where it's tallest).
      bedFace: K.tent.ry,
      limits: {dist: [1.1, 16], pitch: [.04, 1.25], x: [-5.6, 6.4], z: [-3.6, 4.6], y: [.08, 5.8]},
      camBox: {x: [-5.8, 6.8], y: [.2, 9.2], z: [-3.9, 26]}, // open to the front: the living area will be there
      camSolids: [[-2.6, .7, 1.45, 2.3], [.2, .7, 1.45, 2.3], [K.tent.x, K.tent.z, 1.4, 2.0]],
      // Tops the camera mustn't sink into (it would see through them): over
      // the island or the back counter it stays a little above the surface.
      camBlocks: [[K.island.x0 - .3, K.island.x1 + .3, K.island.z0 - .3, K.island.z1 + .3, K.island.top + .35], [K.left, K.right, K.back, K.counterFront + .3, K.counter + .35]],
    };
  }

  // What the Room view keeps in frame (see roomFrame in app.js).
  frame(wide) {
    const I = K.island;
    return {
      // Wide screens look nearly straight at the back wall, from a little
      // right of centre: from there the study's fireplace shows through the
      // doorway (straight on it's hidden by the jamb). Phones look toward
      // the window corner, where her steps climb the wall.
      yaw: wide ? .15 : .35,
      // Wide screens: the whole room. Phones: her route (floor, wall steps,
      // counter, both shelves) and the island; the tent corner is a drag away.
      across: wide
        ? [[I.x0, 1.2, I.z1], [I.x1, 1.2, I.z1], [-3.3, .8, I.z1 + .8], [K.tent.x + .7, .9, K.tent.z], [3.0, .3, 1.55], [4.55, .1, 2.6], [-5.2, 4.2, -3.9], [3.4, 4.2, -3.9],
          [K.left, 4, this.windowRect.z0], [K.left, 1, this.windowRect.z1], [K.door[1], 3, K.back], [K.right, 5.95, -1.2], [K.right, 2.45, 1.9]]
        : [[I.x0, 1.2, I.z1], [I.x1, 1.2, I.z1], [-3.3, .8, I.z1 + .8], [3.0, .3, 1.55], [-5.2, 4.2, -3.9], [3.4, 4.2, -3.9], [-5.95, .9, -3.55], [-5.95, 5.0, -3.55]],
      bottom: [[I.x0, 0, I.z1 + .8], [I.x1, 0, I.z1 + .3], wide ? [4.55, 0, 3.0] : [2.6, 0, 3.0], [-1, 0, 3.4]],
      top: [[-5.2, 5.8, -3.9], [3.4, 5.8, -3.9], [-3.5, 7.4, .5], [.9, 7.6, 1.1]].concat(wide ? [[-1.2, 8.7, .7]] : []),
    };
  }

  // Walking: the open floor, kept clear of the island; a walk that would
  // cross the island goes round it, by the nearest corner(s).
  clampFloor(v) {
    v.x = Math.min(FLOOR.x1, Math.max(FLOOR.x0, v.x)); v.z = Math.min(FLOOR.z1, Math.max(FLOOR.z0, v.z));
    const R = KEEP_OUT;
    // (A few passes: out of the island's margin can be into the vacuum's
    // circle beside it, and back again.)
    for (let pass = 0; pass < 3; pass++) {
      if (v.x > R.x0 && v.x < R.x1 && v.z > R.z0 && v.z < R.z1) {
        const opts = [[R.x0 - v.x, 0], [R.x1 - v.x, 0], [0, R.z0 - v.z], [0, R.z1 - v.z]].sort((a, b) => Math.abs(a[0] + a[1]) - Math.abs(b[0] + b[1]));
        v.x += opts[0][0] * 1.02; v.z += opts[0][1] * 1.02;
        if (v.z < FLOOR.z0) v.z = R.z1 + .05;
      }
      for (const c of OBSTACLES) {
        const dx = v.x - c.x, dz = v.z - c.z, d = Math.hypot(dx, dz);
        if (d < c.r) { const k = (c.r + .05) / Math.max(d, 1e-3); v.x = c.x + (d < 1e-3 ? c.r + .05 : dx * k); v.z = c.z + (d < 1e-3 ? 0 : dz * k); }
      }
    }
    // (Squeezed between the vacuum's circle and the island's margin, the
    // margin wins: nearer the vacuum is harmless, her head in the island isn't.)
    if (v.x > R.x0 && v.x < R.x1 && v.z > R.z0 && v.z < R.z1) {
      const opts = [[R.x0 - v.x, 0], [R.x1 - v.x, 0], [0, R.z0 - v.z], [0, R.z1 - v.z]].sort((a, b) => Math.abs(a[0] + a[1]) - Math.abs(b[0] + b[1]));
      v.x += opts[0][0] * 1.02; v.z += opts[0][1] * 1.02;
    }
    // (Pushed out of the vacuum's circle by the counter or a wall: the
    // floor's edge wins, she stands a little nearer the vacuum instead.)
    v.x = Math.min(FLOOR.x1, Math.max(FLOOR.x0, v.x)); v.z = Math.min(FLOOR.z1, Math.max(FLOOR.z0, v.z));
    return v;
  }
  randomFloorPoint(pad = 0) {
    const t = this.bed.position;
    for (let i = 0; i < 30; i++) {
      const v = V(-4.8 + Math.random() * 10.4, 0, -2.1 + Math.random() * 6.2);
      if (v.x > KEEP_OUT.x0 - pad && v.x < KEEP_OUT.x1 + pad && v.z > KEEP_OUT.z0 - pad && v.z < KEEP_OUT.z1 + pad) continue;
      // (For the vacuum: clear of each thing by its own margin, as route()
      // pads it, so a goal never lies inside a padded circle.)
      if (Math.hypot(v.x - t.x, v.z - t.z) < 1.5 || OBSTACLES.some(c => Math.hypot(v.x - c.x, v.z - c.z) < c.r + (pad ? pad * .5 + (c === TENT ? .5 : .15) : .3))) continue;
      return v;
    }
    return V(5.5, 0, 3.6);
  }
  // The safety net under every way she moves on the floor (walks, the toy
  // chase, pounces, zoomies): her centre is kept out of the furniture, far
  // enough that her body stays clear too. Into the tent only along its
  // doorway; riding the vacuum, it doesn't count.
  pushOut(v, {riding = false} = {}) {
    // (A few passes: pushed clear of one thing can mean pushed into another,
    // e.g. between the vacuum and the island.)
    for (let pass = 0; pass < 3; pass++) this.pushOutOnce(v, riding);
    // (Squeezed between the vacuum and the island's margin, the margin wins.)
    const R = KEEP_OUT;
    if (v.x > R.x0 && v.x < R.x1 && v.z > R.z0 && v.z < R.z1) {
      const opts = [[R.x0 - v.x, 0], [R.x1 - v.x, 0], [0, R.z0 - v.z], [0, R.z1 - v.z]].sort((a, b) => Math.abs(a[0] + a[1]) - Math.abs(b[0] + b[1]));
      v.x += opts[0][0] * 1.01; v.z += opts[0][1] * 1.01;
    }
    return v;
  }
  pushOutOnce(v, riding) {
    const R = KEEP_OUT;
    if (v.x > R.x0 && v.x < R.x1 && v.z > R.z0 && v.z < R.z1) {
      const opts = [[R.x0 - v.x, 0], [R.x1 - v.x, 0], [0, R.z0 - v.z], [0, R.z1 - v.z]].sort((a, b) => Math.abs(a[0] + a[1]) - Math.abs(b[0] + b[1]));
      v.x += opts[0][0] * 1.01; v.z += opts[0][1] * 1.01;
    }
    for (const c of OBSTACLES) {
      if (c === VAC && riding) continue;
      const dx = v.x - c.x, dz = v.z - c.z, d = Math.hypot(dx, dz);
      if (d >= c.r) continue;
      if (c === TENT) {
        // In by the doorway: a corridor along the door axis into the bed.
        const ax = Math.sin(K.tent.ry), az = Math.cos(K.tent.ry), along = dx * ax + dz * az, side = Math.abs(dx * az - dz * ax);
        if (side < .6 && along > -1.0) continue;
      }
      const k = c.r / Math.max(d, 1e-3);
      v.x = c.x + (d < 1e-3 ? c.r : dx * k); v.z = c.z + (d < 1e-3 ? 0 : dz * k);
    }
    return v;
  }

  // A walk round everything in the way: the shortest path through a few
  // points just clear of the island's corners and round each obstacle.
  // Into the tent only through its doorway; out the same way. A spot right
  // beside something (her bowl, the fountain) is fine to walk up to.
  // pad: extra room all round (the robot vacuum, its body round its middle,
  // and her on top of it).
  route(from, to, pad = 0) {
    const inside = (p, c) => Math.hypot(p.x - c.x, p.z - c.z) < c.r;
    let A = from, B = to;
    const pre = [], post = [];
    if (inside(to, TENT)) { B = TENT_DOOR; post.push(to); }
    if (inside(from, TENT)) { A = TENT_DOOR; pre.push(TENT_DOOR); }
    const inGap = p => p.x > GAP.x0 && p.x < GAP.x1 && p.z > GAP.z0 && p.z < GAP.z1;
    if (!pad && inGap(to)) { B = GAP_MOUTH; post.push(to); }
    if (!pad && inGap(from)) { A = GAP_MOUTH; pre.push(GAP_MOUTH); }
    // The vacuum where it is now: its full size when it's docked (it won't
    // move), a little smaller when it's out (it moves on, and backs off if
    // she meets it), so she isn't sent the long way round the room.
    const vac = {x: VAC.x, z: VAC.z, r: this.vac?.state === 'docked' ? .7 : .55};
    // (The tent is square: its corners stick out of its circle, so the
    // vacuum gives it more room. Behind the island the lane is narrow: less
    // margin there, her rear clear of the counter's drawers matters more.)
    const padded = OBSTACLES.filter(c => c !== VAC).concat(vac, pad && this.vac?.rider ? [DOCK] : []).map(c => pad ? {...c, r: c.r + pad * .5 + (c === TENT ? .4 : 0)} : c);
    // (The vacuum's goal inside something's margin: no path, it picks
    // another; a circle round the goal is dropped below, and it would drive
    // straight through.)
    if (pad && padded.some(c => inside(B, c))) return [];
    const circles = padded.filter(c => !inside(A, c) && !inside(B, c));
    const R = pad ? {x0: KEEP_OUT.x0 - pad, x1: KEEP_OUT.x1 + pad, z0: KEEP_OUT.z0 - Math.min(pad, .45), z1: KEEP_OUT.z1 + pad} : KEEP_OUT;
    // (Starting inside that margin, after a swat or backing off say: first
    // straight out of it, by the nearest side, then round as usual.)
    if (pad && A.x > R.x0 && A.x < R.x1 && A.z > R.z0 && A.z < R.z1) {
      const opts = [[R.x0 - .05 - A.x, 0], [R.x1 + .05 - A.x, 0], [0, R.z0 - .05 - A.z], [0, R.z1 + .05 - A.z]].sort((a, b) => Math.abs(a[0] + a[1]) - Math.abs(b[0] + b[1]));
      A = V(A.x + opts[0][0], 0, A.z + opts[0][1]); pre.push(A);
    }
    const rectOn = !(A.x > R.x0 && A.x < R.x1 && A.z > R.z0 && A.z < R.z1) && !(B.x > R.x0 && B.x < R.x1 && B.z > R.z0 && B.z < R.z1);
    const clear = (p, q) => (!rectOn || !segmentHitsRect(p, q, R)) && circles.every(c => segmentDistance(c, p, q) >= c.r - 1e-3);
    let path = [B];
    if (!clear(A, B)) {
      const m = .2, nodes = [A, B];
      // (The vacuum's corners kept where its centre may go: by the window
      // the lane is narrow, so with her aboard it turns a little nearer
      // the island than it would like, rather than her head in the wall.)
      if (rectOn) nodes.push(...[V(R.x0 - m, 0, R.z0 - m), V(R.x1 + m, 0, R.z0 - m), V(R.x1 + m, 0, R.z1 + m), V(R.x0 - m, 0, R.z1 + m)].map(p => pad ? this.clampVacBox(p) : p));
      for (const c of circles) for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; nodes.push(V(c.x + Math.cos(a) * (c.r + m), 0, c.z + Math.sin(a) * (c.r + m))); }
      // (Points past the floor's edge: her centre a little way, her body
      // is narrow sideways; the open front freely; the vacuum only within
      // its own box, else it would drive its body into the wall, or be
      // held short of a point and never get there.)
      const F = pad ? (this.vac.rider ? VAC_FLOOR_RIDE : VAC_FLOOR) : {x0: FLOOR.x0 - .15, x1: FLOOR.x1 + .15, z0: FLOOR.z0 - .15, z1: FLOOR.z1 + .6};
      const ok = nodes.filter((p, i) => i < 2 || (p.x >= F.x0 && p.x <= F.x1 && p.z >= F.z0 && p.z <= F.z1 && !circles.some(c => inside(p, c)) && !(rectOn && p.x > R.x0 && p.x < R.x1 && p.z > R.z0 && p.z < R.z1)));
      // Dijkstra over the points that can see each other.
      const dist = ok.map((_, i) => i ? Infinity : 0), prev = ok.map(() => -1), done = ok.map(() => false);
      for (;;) {
        let u = -1;
        for (let i = 0; i < ok.length; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
        if (u < 0 || u === 1) break;
        done[u] = true;
        for (let v = 0; v < ok.length; v++) if (!done[v]) { const d = dist[u] + ok[u].distanceTo(ok[v]); if (d < dist[v] && clear(ok[u], ok[v])) { dist[v] = d; prev[v] = u; } }
      }
      if (dist[1] < Infinity) { path = []; for (let i = 1; i > 0; i = prev[i]) path.unshift(ok[i]); }
      // No way round for the vacuum: no path (it picks another goal),
      // rather than a straight line through the furniture.
      else if (pad) return [];
    }
    // (Skip any point she's already standing on.)
    const pts = [...pre, ...path, ...post].filter((p, i, all) => !(i && p.distanceTo(all[i - 1]) < .05));
    return pts.filter((p, i) => i === pts.length - 1 || p.distanceTo(from) > .15).map(p => p.clone());
  }


  // Where the room's lamp light hangs (the study's lamp light moves here).
  activate(lamp) { lamp.position.copy(this.lampSpot); }

  // away: seen through the doorway from her study (the vacuum waits till
  // she's here, and the scene's lighting belongs to the study).
  update(dt, t, night, {camera = null, lamp = null, cat = null, away = false} = {}) {
    if (!away) this.updateVacuum(dt, t, night, cat);
    if (!away) this.updatePendant(dt, cat?.perch === 'pendant');
    // (The camera in this room's own frame: the study may be the room she's
    // in, with the kitchen joined on through the doorway.)
    if (camera) {
      const eye = this.group.worldToLocal(camera.position.clone());
      for (const w of this.walls) {
        const n = V(0, 0, 1).applyQuaternion(w.quaternion);
        w.visible = V(0, 0, 0).subVectors(eye, w.position).dot(n) > -.05;
      }
    }
    if (lamp) lamp.intensity = damp(lamp.intensity, night ? 30 : 3, 3, dt);
    const e = damp(this.materials.shade.emissiveIntensity, night ? 2.6 : .3, 3, dt);
    this.materials.shade.emissiveIntensity = e;
    // By night the window's light on the floor is moonlight: fainter and cool.
    this.sunPatch.material.opacity = damp(this.sunPatch.material.opacity, night ? .2 : .3, 3, dt);
    this.sunPatch.material.color.lerp(night ? MOONLIGHT : DAYLIGHT, 1 - Math.exp(-3 * dt));
    // The holiday decor (decor.js): the lantern's candle, the jack-o'-lanterns
    // (carved faces by day, lit in the evening) and the paper bats.
    if (this.candleLight) {
      this.candleLight.material.opacity = damp(this.candleLight.material.opacity, night ? .95 : .3, 3, dt) * (1 + Math.sin(t * 13) * .04 + Math.sin(t * 7.3) * .03);
      this.candleFlame.scale.y = 1 + Math.sin(t * 11) * .12;
    }
    if (this.pumpkinGlow) {
      const f = 1 + Math.sin(t * 9) * .05 + Math.sin(t * 5.3) * .04;
      for (const m of this.pumpkinGlow) m.emissiveIntensity = damp(m.emissiveIntensity, night ? 4 : .04, 3, dt) * f;
      for (const m of this.pumpkinHalos) m.opacity = damp(m.opacity, night ? .75 : 0, 3, dt) * f;
    }
    this.updatePaperBats?.(t);
    this.updateChristmas?.(dt, t, night);
    this.terraceView.setMood(night ? 1 : 0);
    this.terraceView.update(dt, t);
    this.paving.material.color.copy(this.terraceView.pave);
    this.updateDog(t);
    const R = this.room;
    if (!away && this.scene.environment && R.envNight) {
      const env = night ? R.envNight : R.envDay;
      if (this.scene.environment !== env) this.scene.environment = env;
      this.scene.environmentIntensity = damp(this.scene.environmentIntensity, night ? .35 : .6, 3, dt);
    }
    Room.prototype.updateBird.call(this, t);
    Room.prototype.updateBats.call(this, t);
    this.updateCups(t);
    if (!this.salmon.visible && t > this.salmonBack) this.salmon.visible = true;
    if (this.stream.visible) this.stream.scale.set(1 + Math.sin(t * 40) * .15, 1, 1 + Math.cos(t * 33) * .15);
    // The orchid's stems sway, just a little.
    this.orchidStems.forEach((s, i) => { s.rotation.z = Math.sin(t * .8 + i * 2) * .025; });
  }
}

// Does the segment a-b (on the floor) cross the rectangle R?
// Distance in plan from a circle's centre to a segment.
function segmentDistance(c, a, b) {
  const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz;
  const t = l2 ? Math.max(0, Math.min(1, ((c.x - a.x) * dx + (c.z - a.z) * dz) / l2)) : 0;
  return Math.hypot(a.x + dx * t - c.x, a.z + dz * t - c.z);
}
function segmentHitsRect(a, b, R) {
  let t0 = 0, t1 = 1;
  const dx = b.x - a.x, dz = b.z - a.z;
  for (const [p, q] of [[-dx, a.x - R.x0], [dx, R.x1 - a.x], [-dz, a.z - R.z0], [dz, R.z1 - a.z]]) {
    if (p === 0) { if (q < 0) return false; continue; }
    const r = q / p;
    if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
    else { if (r < t0) return false; if (r < t1) t1 = r; }
  }
  return t0 < t1;
}

// A slab with rounded corners in plan (w along x, d along z), h tall,
// sitting on y = 0, with softly eased edges.
function roundedSlab(w, d, h, r) {
  const s = new THREE.Shape(), x = -w / 2, z = -d / 2;
  r = Math.min(r, w / 2 - .01, d / 2 - .01);
  s.moveTo(x + r, z); s.lineTo(x + w - r, z); s.quadraticCurveTo(x + w, z, x + w, z + r);
  s.lineTo(x + w, z + d - r); s.quadraticCurveTo(x + w, z + d, x + w - r, z + d);
  s.lineTo(x + r, z + d); s.quadraticCurveTo(x, z + d, x, z + d - r);
  s.lineTo(x, z + r); s.quadraticCurveTo(x, z, x + r, z);
  const b = Math.min(.03, h / 4);
  const geo = new THREE.ExtrudeGeometry(s, {depth: h - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 10});
  geo.rotateX(Math.PI / 2);
  geo.translate(0, h - b, 0);
  geo.computeVertexNormals();
  return geo;
}

// ---------------------------------------------------------------------------
// Textures
// ---------------------------------------------------------------------------
// Pale limestone: large tiles in slightly different beiges, with fossil
// flecks, faint veins and fine joints.
function drawLimestone(g, w, h) {
  const r = rng(201), n = 4, tw = w / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    g.fillStyle = ['#dacdb6', '#d5c7ae', '#ded2bd', '#d2c4ab'][Math.floor(r() * 4)];
    g.fillRect(i * tw, j * tw, tw, tw);
    for (let k = 0; k < 220; k++) { g.fillStyle = `rgba(${r() < .5 ? '150,128,100' : '250,245,232'},${r() * .22})`; g.fillRect(i * tw + r() * tw, j * tw + r() * tw, 1 + r() * 3, 1 + r() * 2); }
    g.strokeStyle = 'rgba(165,145,115,.18)'; g.lineWidth = 1.2;
    for (let k = 0; k < 3; k++) { g.beginPath(); let x = i * tw + r() * tw, y = j * tw + r() * tw; g.moveTo(x, y); for (let s = 0; s < 6; s++) { x += (r() - .5) * 50; y += (r() - .2) * 40; g.lineTo(x, y); } g.stroke(); }
  }
  g.strokeStyle = 'rgba(140,120,95,.35)'; g.lineWidth = 2;
  for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * tw, 0); g.lineTo(i * tw, h); g.moveTo(0, i * tw); g.lineTo(w, i * tw); g.stroke(); }
}

// Breccia, as in the design: big, rounded cream fragments packed together,
// with a web of fine brown and gold veins along the joins, a soft shadow at
// each fragment's edge, and the odd darker fragment. (Cells around scattered
// points, wobbled so the joins wander; it tiles.)
export function drawBreccia(g, w, h) {
  // Breccia: rounded stone fragments of many sizes and tones (mostly cream,
  // some beige and taupe, a few grey and darker mineral patches) set in a
  // softer sandy matrix, with fine golden veins along only some of the joins.
  // Fragments sit on a jittered grid (fast to search), weighted so their
  // sizes vary, in a warped space so their shapes are irregular. Tiles.
  const r = rng(211), G = 9, cw = w / G, seeds = [];
  const tones = [[[242, 235, 222], .26], [[236, 227, 211], .2], [[245, 240, 230], .14], [[226, 212, 190], .13], [[214, 200, 182], .09], [[205, 203, 198], .08], [[188, 178, 166], .06], [[172, 164, 156], .04]];
  const pick = () => { let t = r(); for (const [c, p] of tones) { if ((t -= p) <= 0) return c; } return tones[0][0]; };
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) seeds.push({x: (i + .15 + r() * .7) * cw, y: (j + .15 + r() * .7) * cw, wt: Math.pow(r(), 2) * cw * cw * .55, c: pick(), m: r()});
  const img = g.createImageData(w, h), d = img.data, T = Math.PI * 2;
  const F = 26, fw = w / F, fine = [];
  // Small clasts cluster where a slow wave is high.
  for (let j = 0; j < F; j++) for (let i = 0; i < F; i++) {
    const x = (i + .2 + r() * .6) * fw, y = (j + .2 + r() * .6) * fw;
    const dense = Math.sin(T * x / w * 2 + 1) * Math.sin(T * y / h * 2 + .5) + Math.sin(T * (x + y) / w * 3) * .5;
    const a = r() * Math.PI, e = 1 + r() * 1.4;
    fine.push({x, y, ca: Math.cos(a), sa: Math.sin(a), e, on: dense > .35 && r() < .7, r: fw * (.22 + r() * .4), c: [[200, 196, 190], [186, 176, 164], [214, 204, 190], [172, 163, 152]][Math.floor(r() * 4)]});
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const wx = x + Math.sin(T * y / h * 3) * 7 + Math.sin(T * (x + y) / w * 5 + 1) * 5 + Math.sin(T * y / h * 11) * 2;
    const wy = y + Math.sin(T * x / w * 3 + 2) * 7 + Math.sin(T * (x - y) / h * 4) * 5 + Math.sin(T * x / w * 13) * 2;
    const gi = Math.floor(wx / cw), gj = Math.floor(wy / cw);
    let d1 = 1e12, d2 = 1e12, k1 = 0, k2 = 0;
    for (let oj = -2; oj <= 2; oj++) for (let oi = -2; oi <= 2; oi++) {
      const ii = ((gi + oi) % G + G) % G, jj = ((gj + oj) % G + G) % G, sd = seeds[jj * G + ii];
      let dx = wx - sd.x, dy = wy - sd.y;
      dx -= Math.round(dx / w) * w; dy -= Math.round(dy / h) * h;
      const dd = dx * dx + dy * dy - sd.wt;
      if (dd < d1) { d2 = d1; k2 = k1; d1 = dd; k1 = jj * G + ii; } else if (dd < d2 && jj * G + ii !== k1) { d2 = dd; k2 = jj * G + ii; }
    }
    // Distance to the join, approximately, in pixels.
    const edge = (d2 - d1) / (2 * cw), s1 = seeds[k1], o = (y * w + x) * 4;
    let [R, Gc, B] = s1.c;
    // Clouded within each fragment.
    const cl = Math.sin(T * x / w * 7 + s1.m * 9) * Math.sin(T * y / h * 6 + s1.m * 5) * 6;
    R += cl; Gc += cl; B += cl * .8;
    // Most joins melt away; some show a sandy matrix, some a fine golden vein.
    const s2 = seeds[k2], jh = (s1.m * 7.3 + s2.m * 3.1) % 1, contrast = Math.abs(s1.c[0] - s2.c[0]) / 90;
    if (jh < .3 || contrast > .5) {
      const mw = 1.5 + (s1.m + s2.m) * 2.2;
      if (edge < mw) { const t = edge / mw, k = (1 - t * t) * .5; R = R * (1 - k) + 210 * k; Gc = Gc * (1 - k) + 190 * k; B = B * (1 - k) + 158 * k; }
    } else if (jh > .55) {
      const vw = .6 + s1.m * .7;
      if (edge < vw) { const t = edge / vw; R = R * t + 176 * (1 - t); Gc = Gc * t + 134 * (1 - t); B = B * t + 82 * (1 - t); }
      else if (edge < vw * 2.5) { const k = (1 - (edge - vw) / (vw * 1.5)) * .35; R = R * (1 - k) + 200 * k; Gc = Gc * (1 - k) + 168 * k; B = B * (1 - k) + 120 * k; }
    } else if (edge < 6) { const k = (1 - edge / 6) * .5; R = R * (1 - k) + s2.c[0] * k; Gc = Gc * (1 - k) + s2.c[1] * k; B = B * (1 - k) + s2.c[2] * k; }
    // Clusters of small clasts, here and there.
    const fi = Math.floor(wx / fw), fj = Math.floor(wy / fw);
    let f1 = 1e12, f2 = 1e12, fk = 0;
    for (let oj = -1; oj <= 1; oj++) for (let oi = -1; oi <= 1; oi++) {
      const ii = ((fi + oi) % F + F) % F, jj = ((fj + oj) % F + F) % F, sd = fine[jj * F + ii];
      let dx = wx - sd.x, dy = wy - sd.y;
      dx -= Math.round(dx / w) * w; dy -= Math.round(dy / h) * h;
      // Each clast is an ellipse at its own angle, edged with a little wobble.
      const u = dx * sd.ca + dy * sd.sa, v = (dy * sd.ca - dx * sd.sa) * sd.e, wob = 1 + .18 * Math.sin(Math.atan2(v, u) * 3 + sd.x);
      const dd = (u * u + v * v) * wob;
      if (dd < f1) { f2 = f1; f1 = dd; fk = jj * F + ii; } else if (dd < f2) f2 = dd;
    }
    const fs = fine[fk];
    if (fs.on && s1.c[0] > 224 && f1 < fs.r * fs.r) {
      const fe = (Math.sqrt(f2) - Math.sqrt(f1)) / 2, rim = fs.r - Math.sqrt(f1);
      if (fe > .8 && rim > .8) { R = fs.c[0] + cl * .5; Gc = fs.c[1] + cl * .5; B = fs.c[2] + cl * .4; }
      else { R = R * .45 + 182 * .55; Gc = Gc * .45 + 142 * .55; B = B * .45 + 92 * .55; }
    }
    d[o] = R; d[o + 1] = Gc; d[o + 2] = B; d[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  // Hairline veins and fine grain across the fragments.
  for (let i = 0; i < 14; i++) {
    g.strokeStyle = `rgba(160,120,75,${.1 + r() * .14})`; g.lineWidth = .4 + r() * .5;
    g.beginPath(); let x = r() * w, y = r() * h; g.moveTo(x, y);
    for (let k = 0; k < 7; k++) { x += (r() - .5) * 46; y += (r() - .5) * 46; g.lineTo(x, y); }
    g.stroke();
  }
  for (let i = 0; i < 1600; i++) { g.fillStyle = `rgba(${r() < .5 ? '120,100,80' : '255,252,246'},${r() * .16})`; g.fillRect(r() * w, r() * h, .8 + r(), .8 + r()); }
}

// Brushed stainless: fine lengthwise streaks in cool greys.
function drawBrushed(g, w, h) {
  const r = rng(97);
  g.fillStyle = '#b4b7b8'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 900; i++) {
    const y = r() * h, l = w * (.2 + r() * .8), x = r() * w, v = 150 + Math.floor(r() * 80);
    g.strokeStyle = `rgba(${v},${v + 2},${v + 4},${.15 + r() * .25})`; g.lineWidth = .5 + r() * .8;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y + (r() - .5) * .6); g.stroke();
  }
}

// The back counter: a quieter cream stone with soft veining.
function drawCreamStone(g, w, h) {
  const r = rng(221);
  g.fillStyle = '#e8ddcb'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 40; i++) {
    g.strokeStyle = `rgba(170,140,105,${.08 + r() * .14})`; g.lineWidth = 1 + r() * 3;
    g.beginPath(); let x = r() * w, y = r() * h; g.moveTo(x, y);
    for (let s = 0; s < 6; s++) { x += (r() - .3) * 80; y += (r() - .5) * 40; g.lineTo(x, y); }
    g.stroke();
  }
}

// Out of the window: a stone terrace with olive trees in terracotta pots,
// a low wall, then dune grass and the sea under a soft sky; at night, a blue
// dusk with the moon on the water.

function drawOrchidFlower(g, w, h) {
  g.clearRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2;
  g.fillStyle = '#fbf8f3';
  for (const [a, rx, ry] of [[-Math.PI / 2, 12, 20], [Math.PI / 6, 12, 20], [Math.PI * 5 / 6, 12, 20], [-Math.PI / 6, 15, 13], [-Math.PI * 5 / 6, 15, 13]]) {
    g.beginPath(); g.ellipse(cx + Math.cos(a) * 13, cy + Math.sin(a) * 13, rx, ry, a + Math.PI / 2, 0, 7); g.fill();
  }
  g.fillStyle = '#e9d36a'; g.beginPath(); g.arc(cx, cy, 5, 0, 7); g.fill();
  g.fillStyle = '#c84a7a'; g.beginPath(); g.ellipse(cx, cy + 6, 4, 3, 0, 0, 7); g.fill();
}

function drawSalmon(g, w, h) {
  g.fillStyle = '#ea8f6b'; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(255,235,220,.8)'; g.lineWidth = 2;
  for (let x = 4; x < w; x += 8) { g.beginPath(); g.moveTo(x, 0); g.quadraticCurveTo(x + 4, h / 2, x, h); g.stroke(); }
}

