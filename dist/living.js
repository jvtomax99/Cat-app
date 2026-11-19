// Mochi's living room (phase 21, step 1): the big room the kitchen opens
// into, from Merlin's reference picture (docs/house/reference-living-room.jpg:
// the mood and the materials, not a likeness). Black steel glazing from
// floor to ceiling on the sea side and at the far end, the kitchen's pale
// limestone floor carried on, an antique wool rug, a curved cream boucle
// sofa, a sculptural rosewood coffee table, a worn leather sling chair, an
// aubergine mohair armchair, a travertine cube, a red lacquer side table, a
// burl sideboard under a large abstract painting, a plaster fireplace with
// a fire, and an arc floor lamp. Her tent and fountain stand by the glazing.
//
// The room's own frame is the kitchen's, moved along: x from the sea
// glazing (-6) to the wall with the fire (10), z from where the kitchen
// ends (0) to the far glazing (14). In the house (house.js) that is
//   living: {name: 'living room', at: {x: -19.05, z: -3.9}, ry: -Math.PI / 2}
// Same scale as the other rooms: about 2.4 scene units per metre.
//
// Not joined to the app yet: dist/living-check.html shows it on its own.
import * as THREE from 'three';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';
import {buildTerrace} from './terrace.js';
import {MOONLIGHT, DAYLIGHT, rng, canvasTexture, drawNoise, drawLinen, drawWood, roundedBox, lathe, pillowGeometry} from './room.js';

const {damp} = THREE.MathUtils;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
// How much wall one picture of plaster covers.
const PLASTER = 4.7;

// The plan.
export const L = {
  sea: -6, south: 10, join: 0, end: 14, wallH: 9.5, glassTop: 8.0, transom: 6.5,
  seaGlass: [.8, 13.2], endGlass: [-4.8, 8.8],
  rug: {x: 3.1, z: 7.35, w: 7.6, d: 10},
  sofa: {x: -1, z: 7.25, long: 6.2, deep: 2.0, seat: 1.08, back: 1.9, R: 9},
  table: {x: 2.1, z: 7.45, long: 4.2, wide: 1.6, top: .88},
  sling: {x: 3.6, z: 3.1, ry: -.33},
  mohair: {x: 3.2, z: 11.65, ry: -2.885, seat: .98},
  cube: {x: 5.5, z: 3.35, s: 1.12},
  lacquer: {x: 5.0, z: 11.25, r: .47, h: 1.16},
  sideboard: {z: 11.85, long: 3.4, deep: 1.05, top: 1.87},
  fire: {z: 7.05, wide: 3.8, deep: .6, open: 1.8, openH: 1.65},
  lamp: {x: -.9, z: 11.6, head: [.95, 4.5, 9.55]},
  tent: {x: -3.7, z: 12.2, ry: Math.PI - .35},
  fountain: {x: -4.7, z: 8.4, ry: 1.2},
};
// Where she may walk: her centre .6 from the glazing, the sideboard and the
// far end (her head turned to look at something reaches that far). The
// kitchen side is open; on its own the room's floor stops there.
const FLOOR = {x0: L.sea + .65, x1: L.south - 1.75, z0: .3, z1: L.end - .65};
// Furniture she walks round: her centre this far out keeps her head and
// hips (each about .6 from it) out of it.
const KEEP_OUT = [
  {x0: L.sofa.x - 1.65, x1: L.sofa.x + 2.1, z0: L.sofa.z - 3.7, z1: L.sofa.z + 3.7, tag: 'sofa'},
  // (It starts where the sofa's ends: there is no way between the two.)
  {x0: L.sofa.x + 2.1, x1: L.table.x + 1.4, z0: L.table.z - 2.7, z1: L.table.z + 2.7, tag: 'table'},
];
const TENT = {x: L.tent.x, z: L.tent.z, r: 1.55}, FOUNTAIN = {x: L.fountain.x, z: L.fountain.z, r: .9, ry: L.fountain.ry};
const OBSTACLES = [
  FOUNTAIN, TENT,
  {x: L.sling.x, z: L.sling.z, r: 1.5}, {x: L.mohair.x, z: L.mohair.z, r: 1.5},
  {x: L.cube.x, z: L.cube.z, r: 1.2}, {x: L.lacquer.x, z: L.lacquer.z, r: 1.0}, {x: L.lamp.x, z: L.lamp.z, r: .85},
];
const TENT_DOOR = V(L.tent.x + Math.sin(L.tent.ry) * 1.95, 0, L.tent.z + Math.cos(L.tent.ry) * 1.95);

export class LivingRoom {
  // room: the study (room.js), for the materials and reflections the rooms
  // share. alone: the room on its own (a stand-in for the kitchen's window
  // wall and a strip of floor on the kitchen side); joined to the kitchen,
  // pass alone: false, floor: false to stand on the kitchen's floor, and
  // seaTerrace: false when the kitchen's terrace runs on behind this room.
  // Still to settle at the join: layout() has no `bowl` (it stays in the
  // kitchen); `bed` is only there after adopt(); decor.js's seasonal
  // plaster and floor colours know only the kitchen.
  constructor(scene, room, {alone = true, floor = true, floorMaterial = null, plasterMaterial = null, seaTerrace = true} = {}) {
    this.scene = scene;
    this.room = room;
    this.id = 'living';
    this.alone = alone;
    this.seaTerrace = seaTerrace;
    // (Joined to the kitchen, her floor runs on to meet the kitchen's: the
    // seam is 2.6 before this room's own start.)
    this.floorBox = {...FLOOR, z0: alone ? FLOOR.z0 : -2.6};
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);
    this.clickables = [];
    this.walls = [];
    this.build({floor, floorMaterial, plasterMaterial});
  }

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
  // Many pieces of one material drawn as one: add(geo, x, y, z, rx, ry, rz),
  // box(...), then done(). `color` paints a piece (for a material with
  // vertexColors: books, pots and other small things of many colours).
  batch(material, parent = this.group, opts) {
    const geos = [], m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = V(1, 1, 1), c = new THREE.Color();
    const api = {
      add: (geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, color = null, scale = one) => {
        const g = geo.index ? geo.toNonIndexed() : geo;
        g.applyMatrix4(m4.compose(V(x, y, z), q.setFromEuler(e.set(rx, ry, rz, 'YXZ')), scale));
        for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
        if (material.vertexColors) {
          c.set(color ?? '#ffffff');
          const n = g.attributes.position.count, col = new Float32Array(n * 3);
          for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
          g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        }
        geos.push(g);
        return api;
      },
      box: (w, h, d, x, y, z, rx, ry, rz, color) => api.add(new THREE.BoxGeometry(w, h, d), x, y, z, rx, ry, rz, color),
      done: () => this.mesh(mergeGeometries(geos), material, parent, opts),
    };
    return api;
  }

  build({floor, floorMaterial, plasterMaterial}) {
    const R = this.room?.materials ?? {};
    const wood = (colors, seed, grain, planks = 1) => canvasTexture(512, 512, (g, w, h) => drawWood(g, w, h, {planks, colors, seed, grain}));
    const M = this.materials = {
      floor: floorMaterial ?? new THREE.MeshStandardMaterial({map: canvasTexture(1024, 1024, drawLimestone), roughness: .55}),
      plaster: plasterMaterial ?? new THREE.MeshStandardMaterial({map: canvasTexture(512, 512, (g, w, h) => drawNoise(g, w, h, {base: '#efe3d0', blobs: [['rgba(255,250,240,.06)', 260, 20, 90], ['rgba(160,125,85,.035)', 220, 20, 80]], seed: 31})), roughness: .95}),
      frame: new THREE.MeshStandardMaterial({color: '#1d1c1a', metalness: .3, roughness: .5}),
      brass: new THREE.MeshStandardMaterial({color: '#b58a3c', metalness: .85, roughness: .3}),
      bronze: new THREE.MeshStandardMaterial({color: '#4a3524', metalness: .7, roughness: .38}),
      stone: new THREE.MeshStandardMaterial({map: canvasTexture(256, 256, (c, w, h) => drawNoise(c, w, h, {base: '#e2d6c0', blobs: [['rgba(160,140,110,.18)', 900, 1, 3], ['rgba(255,252,242,.35)', 700, 1, 4], ['rgba(190,170,140,.12)', 40, 20, 60]], seed: 77})), roughness: .85}),
      // Boucle: cream, nubbly, the loops catching the light.
      boucle: new THREE.MeshStandardMaterial({map: canvasTexture(512, 512, (g, w, h) => drawBoucle(g, w, h, false)), bumpMap: canvasTexture(512, 512, (g, w, h) => drawBoucle(g, w, h, true), {color: false}), bumpScale: 2.2, roughness: 1}),
      // Mohair: a deep aubergine pile with a pale bloom where it turns
      // away from the eye.
      mohair: new THREE.MeshPhysicalMaterial({map: canvasTexture(512, 512, drawMohair, {repeat: [2, 2]}), bumpMap: canvasTexture(256, 256, (g, w, h) => drawFuzz(g, w, h), {color: false, repeat: [4, 4]}), bumpScale: 1.6, roughness: 1, sheen: 1, sheenColor: new THREE.Color('#b48cc0'), sheenRoughness: .5}),
      // Rosewood: dark, red in the grain, polished.
      rosewood: new THREE.MeshPhysicalMaterial({map: canvasTexture(1024, 512, drawRosewood, {repeat: [.26, .5]}), roughness: .3, clearcoat: .8, clearcoatRoughness: .2}),
      // The sling chair: cognac leather gone pale where it's been sat in,
      // on a frame of oiled walnut.
      leather: new THREE.MeshPhysicalMaterial({map: canvasTexture(512, 512, drawWornLeather), roughness: .55, clearcoat: .25, clearcoatRoughness: .5}),
      chairWood: new THREE.MeshStandardMaterial({map: wood(['#5b3620', '#663d24', '#52301c'], 51, 36), roughness: .5}),
      travertine: new THREE.MeshStandardMaterial({map: canvasTexture(512, 512, drawTravertine, {repeat: [.85, .85]}), roughness: .7}),
      lacquer: new THREE.MeshPhysicalMaterial({color: '#6a0d12', roughness: .14, clearcoat: 1, clearcoatRoughness: .04}),
      burl: new THREE.MeshPhysicalMaterial({map: canvasTexture(512, 512, (g, w, h) => drawBurl(g, w, h, 0)), roughness: .38, clearcoat: .5, clearcoatRoughness: .25}),
      burlDoors: new THREE.MeshPhysicalMaterial({map: canvasTexture(1024, 512, (g, w, h) => drawBurl(g, w, h, 4)), roughness: .38, clearcoat: .5, clearcoatRoughness: .25}),
      darkWood: new THREE.MeshStandardMaterial({color: '#2b1a10', roughness: .6}),
      rug: new THREE.MeshStandardMaterial({map: canvasTexture(1024, 1344, drawRug), roughness: 1}),
      fringe: new THREE.MeshStandardMaterial({map: canvasTexture(256, 32, drawFringe, {repeat: [14, 1]}), alphaTest: .5, roughness: 1, side: THREE.DoubleSide}),
      painting: new THREE.MeshStandardMaterial({map: canvasTexture(768, 896, drawPainting), roughness: .85}),
      knit: new THREE.MeshStandardMaterial({map: canvasTexture(256, 256, drawKnit, {repeat: [3, 3]}), roughness: 1, side: THREE.DoubleSide}),
      // Small things of many colours, drawn as one.
      paint: new THREE.MeshStandardMaterial({vertexColors: true, roughness: .75}),
      velvetOlive: new THREE.MeshStandardMaterial({map: canvasTexture(256, 256, (g, w, h) => drawLinen(g, w, h, {base: '#5a5a2f', dark: .1, seed: 81})), roughness: 1}),
      velvetRust: new THREE.MeshStandardMaterial({map: canvasTexture(256, 256, (g, w, h) => drawLinen(g, w, h, {base: '#8c4a35', dark: .1, seed: 82})), roughness: 1}),
      velvetMoss: new THREE.MeshStandardMaterial({map: canvasTexture(256, 256, (g, w, h) => drawLinen(g, w, h, {base: '#3d4427', dark: .1, seed: 83})), roughness: 1}),
      paisley: new THREE.MeshStandardMaterial({map: canvasTexture(256, 256, drawPaisley), roughness: 1}),
      soot: new THREE.MeshStandardMaterial({color: '#1a1512', roughness: 1}),
      shade: new THREE.MeshStandardMaterial({color: '#f3eadb', emissive: '#ffe2b0', emissiveIntensity: .3, roughness: .6, side: THREE.DoubleSide}),
      candle: new THREE.MeshStandardMaterial({color: '#c98634', emissive: '#ff9a3a', emissiveIntensity: .5, roughness: .2}),
      leaf: R.leaf ?? new THREE.MeshStandardMaterial({color: '#6d7d4c', side: THREE.DoubleSide, roughness: .7}),
    };
    // (A borrowed plaster may repeat its picture: lay it on to match.)
    this.plasterPer = PLASTER * (M.plaster.map?.repeat.x ?? 1);
    this.buildShell(floor);
    this.buildGlazing();
    this.buildOutdoors();
    this.buildRug();
    this.buildSofa();
    this.buildCoffeeTable();
    this.buildSlingChair();
    this.buildMohairChair();
    this.buildSideTables();
    this.buildSideboard();
    this.buildFireplace();
    this.buildLamp();
    this.buildSunPatch();
  }

  // Floor and plaster walls. No wall on the kitchen side.
  buildShell(floor) {
    const M = this.materials, H = L.wallH;
    if (floor) {
      // The kitchen's limestone, its tiles lined up with the kitchen's own
      // (whose floor is laid from its own origin, 9.8 before this room's).
      const z0 = this.alone ? -10 : L.join, geo = new THREE.PlaneGeometry(L.south - L.sea, L.end - z0);
      geo.rotateX(-Math.PI / 2); geo.translate((L.sea + L.south) / 2, 0, (z0 + L.end) / 2);
      const p = geo.attributes.position, uv = geo.attributes.uv, rep = M.floor.map?.repeat ?? {x: 1, y: 1};
      for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + 30) / 8 / rep.x, (30 - (p.getZ(i) + 9.8)) / 8 / rep.y);
      this.floor = this.mesh(geo, M.floor, this.group, {cast: false});
      this.floor.position.y = -.002;
    }
    // A wall panel; it hides when the camera swings round behind it.
    // (The plaster's picture is laid on by size, 4.7 to a picture, so narrow
    // and tall pieces match the wide ones.)
    const wall = (w, h, x, y, z, ry) => {
      const geo = new THREE.PlaneGeometry(w, h), uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / this.plasterPer + x * .37 + z * .61, uv.getY(i) * h / this.plasterPer);
      const m = this.mesh(geo, M.plaster, this.group, {cast: false});
      m.position.set(x, y, z); m.rotation.y = ry;
      this.walls.push(m);
      return m;
    };
    // The wall with the fire and the sideboard.
    this.southWall = wall(L.end - L.join, H, L.south, H / 2, (L.join + L.end) / 2, -Math.PI / 2);
    // (And up past its top: no ceiling hides the sky over it.)
    wall(L.end - L.join, 30, L.south, H + 15, (L.join + L.end) / 2, -Math.PI / 2);
    // The sea side: plaster at each end of the glazing and above it; and up
    // past its top (no ceiling hides the sky there), as in the kitchen.
    const [s0, s1] = L.seaGlass, [e0, e1] = L.endGlass, G = L.glassTop;
    wall(s0 - L.join, G, L.sea, G / 2, (L.join + s0) / 2, Math.PI / 2);
    wall(L.end - s1, G, L.sea, G / 2, (s1 + L.end) / 2, Math.PI / 2);
    wall(L.end - L.join, H - G, L.sea, (H + G) / 2, (L.join + L.end) / 2, Math.PI / 2);
    wall(L.end - L.join, 30, L.sea, H + 15, (L.join + L.end) / 2, Math.PI / 2);
    // The far end, the same.
    wall(e0 - L.sea, G, (L.sea + e0) / 2, G / 2, L.end, Math.PI);
    wall(L.south - e1, G, (e1 + L.south) / 2, G / 2, L.end, Math.PI);
    wall(L.south - L.sea, H - G, (L.sea + L.south) / 2, (H + G) / 2, L.end, Math.PI);
    wall(L.south - L.sea, 30, (L.sea + L.south) / 2, H + 15, L.end, Math.PI);
    // On its own: a plain wall where the kitchen's window wall will be, so
    // the outdoors doesn't show past the end of the glazing.
    if (this.alone) { wall(16, H, L.sea, H / 2, L.join - 8, Math.PI / 2); wall(16, 30, L.sea, H + 15, L.join - 8, Math.PI / 2); }
    // A slim limestone skirting along the fire wall.
    const skirt = new THREE.MeshStandardMaterial({color: '#d8ccb6', roughness: .6});
    this.skirting = this.box(.04, .14, L.end - L.join, L.south - .02, .07, (L.join + L.end) / 2, skirt, this.group, {cast: false});
  }

  // Black steel glazing from the floor to 8 up, on the sea side and at the
  // far end: bays of fixed glass, a pair of doors in the middle of each,
  // glazing bars as the kitchen's. One shape for each wall.
  buildGlazing() {
    const M = this.materials, T = L.transom, Y = L.glassTop;
    const glaze = (a0, a1, bays, put) => {
      const b = this.batch(M.frame, this.group, {cast: false});
      const v = (w, y0, y1, a) => put(b, a, (y0 + y1) / 2, w, y1 - y0);
      const hz = (h, y, a, c) => put(b, (a + c) / 2, y, c - a, h);
      const bay = (a1 - a0) / bays, mid = bays / 2;
      for (let i = 0; i <= bays; i++) v(i === 0 || i === bays ? .16 : i === mid ? .1 : .14, 0, i === mid ? T : Y, a0 + bay * i);
      hz(.16, Y, a0, a1); hz(.12, .06, a0, a1); hz(.14, T, a0, a1);
      for (let i = 0; i < bays; i++) {
        const a = a0 + bay * i, c = a + bay, door = i === mid - 1 || i === mid;
        // (Door leaves: one column; fixed bays: two. Four rows below the
        // transom, two panes above it.)
        if (!door) v(.05, 0, T, (a + c) / 2);
        for (let j = 1; j < 4; j++) hz(.05, T * j / 4, a, c);
        v(.05, T, Y, (a + c) / 2);
      }
      // Door handles: slim black levers at the meeting stiles.
      const m = a0 + bay * mid;
      for (const s of [-1, 1]) put(b, m + s * .2, 3.0, .28, .05, .2);
      return b.done();
    };
    const [s0, s1] = L.seaGlass, [e0, e1] = L.endGlass;
    this.seaGlazing = glaze(s0, s1, 6, (b, a, y, w, h, out = .04) => b.box(.12, h, w, L.sea + .02 + out, y, a));
    this.endGlazing = glaze(e0, e1, 6, (b, a, y, w, h, out = .04) => b.box(w, h, .12, a, y, L.end - .02 - out));
    this.windowRect = {z0: s0, z1: s1, y0: 0, y1: Y};
  }

  // Outside both glazings (terrace.js, as outside the kitchen): paving out
  // to a low wall, olive trees in pots, the dunes and the sea. Two
  // terraces that meet at the corner. (Joined to the kitchen, the sea
  // side's can be the kitchen's own, made longer.)
  buildOutdoors() {
    const wallOut = 4.4, anisotropy = this.room?.outside?.material.uniforms.uFar.value.anisotropy ?? 4, corner = wallOut + .46;
    // The sea side: its wall stops at the corner of the far end's.
    const sea = this.seaTerrace && buildTerrace({x: L.sea, zc: 8, long: 52, wallOut, anisotropy, wall: [-26, L.end + corner - 8], trees: [[-5.4, 1.2, .9], [1.7, 1.0, .7], [8.6, 1.3, .85]]});
    // The far end: the same thing turned a quarter (its own x runs out
    // from the glazing, its z along it).
    const end = buildTerrace({x: -L.end, zc: 2, long: 52, wallOut, anisotropy, wall: [L.sea - corner - 2, 26], trees: [[-3.4, 1.1, .8], [4.3, 1.3, .9]]});
    end.group.rotation.y = Math.PI / 2;
    this.group.add(end.group);
    if (this.seaTerrace) this.group.add(sea.group);
    this.terraces = this.seaTerrace ? [sea, end] : [end];
    this.terraceView = end.view;
    // The paving: one L of it round the corner.
    const pave = this.paving = new THREE.MeshBasicMaterial({color: '#e2d6c0', toneMapped: false});
    const b = this.batch(pave, this.group, {cast: false, receive: false}), w = wallOut + .05, flat = -Math.PI / 2;
    if (this.seaTerrace) b.add(new THREE.PlaneGeometry(w, 52), L.sea - w / 2, -.001, 8, flat);
    b.add(new THREE.PlaneGeometry(52 - w, w), 2 + w / 2, -.001, L.end + w / 2, flat);
    b.done();
  }

  // The antique wool rug under the seats, fringed at both ends.
  buildRug() {
    const M = this.materials, {x, z, w, d} = L.rug;
    const rug = this.mesh(new THREE.BoxGeometry(w, .03, d), [M.darkWood, M.darkWood, M.rug, M.darkWood, M.darkWood, M.darkWood], this.group, {cast: false});
    rug.position.set(x, .015, z);
    this.rug = rug;
    const f = this.batch(M.fringe, this.group, {cast: false});
    for (const s of [-1, 1]) f.add(new THREE.PlaneGeometry(w, .22), x, .012, z + s * (d / 2 + .1), -Math.PI / 2, s > 0 ? 0 : Math.PI);
    f.done();
  }

  // The curved cream boucle sofa: a deep seat on a low base, a rolled back
  // that drops into rounded arms, cushions along it and a knitted throw
  // over one end. Its hollow side faces the coffee table and the fire.
  buildSofa() {
    const M = this.materials, S = L.sofa, g = new THREE.Group();
    // (Its own frame: x along it, z to the front.)
    g.position.set(S.x, 0, S.z); g.rotation.y = Math.PI / 2;
    this.group.add(g);
    this.sofa = g;
    const R = S.R, path = s => { const a = s / R; return {p: V(R * Math.sin(a), 0, R * (1 - Math.cos(a))), n: V(Math.sin(a), 0, -Math.cos(a)), a}; };
    const half = S.long / 2;
    const plinth = this.mesh(sweep({path, length: S.long - .5, w: 1.6, h: .14, y0: 0, e: 4, cap: .8, flat: true}), M.darkWood, g, {cast: false});
    const b = this.batch(M.boucle, g);
    b.add(sweep({path, length: S.long, w: S.deep, h: .56, y0: .1, e: 5, cap: 1.0, flat: true}));
    // Two seat cushions.
    for (const s of [-1, 1]) b.add(sweep({path: t => path(t + s * 1.36), length: 2.66, w: 1.5, h: .46, y0: .62, off: -.22, e: 3.4, cap: .3, flat: true, nu: 12}));
    // The back, lower toward the arms.
    b.add(sweep({path, length: S.long - .1, w: .74, h: S.back - .5, y0: .5, off: .63, e: 2.8, cap: .75, flat: true, grow: s => 1 - .3 * Math.pow(Math.abs(s) / half, 3)}));
    // The arms: fat and round.
    for (const s of [-1, 1]) {
      const {p, n, a} = path(s * (half - .5));
      const ball = new THREE.SphereGeometry(1, 24, 16), uv = ball.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2.6, uv.getY(i) * 1.5);
      b.add(ball, p.x + n.x * .02, .93, p.z + n.z * .02, 0, -a, 0, null, V(.5, .6, .97));
    }
    b.done();
    // Cushions along the back: velvet, a patterned one, and one in boucle.
    const pillow = (s, mat, w = .95, h = .9, lean = -.32, turn = 0, off = .12) => {
      const {p, n, a} = path(s), m = this.mesh(pillowGeometry(w, h, .34, 16), mat, g);
      m.rotation.order = 'YXZ';
      m.position.set(p.x + n.x * off, S.seat + h * .46, p.z + n.z * off); m.rotation.set(lean, -a + turn, 0);
      return m;
    };
    pillow(-1.95, M.velvetOlive, 1.0, .95, -.36, .12);
    pillow(-1.15, M.paisley, .95, .9, -.3, -.1, -.08);
    pillow(.55, M.boucle, .9, .85, -.34, .05);
    pillow(1.35, M.velvetRust, 1.0, .82, -.3, -.14, -.1);
    pillow(2.0, M.velvetMoss, .95, .95, -.4, -.2);
    // The throw, over the end nearest the kitchen: up from the seat, over
    // the arm and down the outside, in soft folds.
    const prof = new THREE.CatmullRomCurve3([V(1.55, S.seat + .03, 0), V(2.05, S.seat + .05, 0), V(2.42, 1.4, 0), V(2.72, 1.575, 0), V(3.0, 1.5, 0), V(3.2, 1.15, 0), V(3.3, .7, 0), V(3.34, .34, 0)]);
    const nu = 26, nv = 12, pos = [], uv = [], idx = [];
    for (let j = 0; j <= nu; j++) {
      const q = prof.getPoint(j / nu), {p, n} = path(q.x);
      for (let i = 0; i <= nv; i++) {
        const t = i / nv, off = -.82 + t * 1.16 + .05 * Math.sin(j * .5);
        // (Lower at its edges, where it falls off the arm's roundness.)
        const droop = q.y > 1.1 ? (q.y - 1.1) * (1 - Math.sqrt(Math.max(0, 1 - Math.pow((off - .02) / .98, 2)))) * 1.25 : 0;
        const fold = .022 * Math.sin(t * 15 + j * .35) * Math.min(1, j / 6);
        pos.push(p.x + n.x * off, q.y - droop + fold + .035, p.z + n.z * off);
        uv.push(t, j / nu * 2.2);
      }
    }
    for (let j = 0; j < nu; j++) for (let i = 0; i < nv; i++) { const a = j * (nv + 1) + i, c = a + nv + 1; idx.push(a, c, a + 1, a + 1, c, c + 1); }
    const throwGeo = new THREE.BufferGeometry();
    throwGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); throwGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    throwGeo.setIndex(idx); throwGeo.computeVertexNormals();
    this.throw = this.mesh(throwGeo, M.knit, g);
    void plinth;
  }

  // The coffee table: one thick slab of rosewood, shaped like a river
  // stone, on two carved feet. On it: books, a hammered bowl and a small
  // bronze.
  buildCoffeeTable() {
    const M = this.materials, T = L.table, g = new THREE.Group();
    g.position.set(T.x, 0, T.z); g.rotation.y = Math.PI / 2 + .07;
    this.group.add(g);
    this.table = g;
    const pts = [];
    for (let i = 0; i < 40; i++) {
      const a = i / 40 * TAU, c = Math.cos(a), s = Math.sin(a);
      // (Fatter at one end, with a waist: a bean, not an oval.)
      pts.push(new THREE.Vector2(T.long / 2 * c * (1 + .05 * Math.sin(2 * a + .6)), T.wide / 2 * s * (1 + .2 * c) + .13 * Math.cos(2 * a) - .05));
    }
    const slabH = .3, bev = .1;
    const top = new THREE.ExtrudeGeometry(new THREE.Shape(new THREE.SplineCurve(pts.concat(pts[0])).getPoints(96)), {depth: slabH - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 5, curveSegments: 12});
    top.rotateX(Math.PI / 2); top.translate(0, T.top - bev, 0);
    const b = this.batch(M.rosewood, g);
    b.add(top);
    // The feet: flared at the floor and under the slab, drawn in at the waist.
    const foot = () => lathe([[0, 0], [.5, 0], [.56, .05], [.5, .16], [.36, .32], [.34, .42], [.46, .54], [.62, .6], [0, .6]], 28);
    b.add(foot(), -1.15, 0, .02, 0, .3, 0, null, V(1.05, 1, .78));
    b.add(foot(), 1.05, 0, -.04, 0, -.4, 0, null, V(.9, 1, .72));
    b.done();
    const y = T.top;
    const p = this.batch(M.paint, g);
    // Two books, stacked a little askew.
    p.box(.95, .09, .68, -.75, y + .045, .1, 0, .2, 0, '#2c3340');
    p.box(.88, .07, .62, -.72, y + .125, .08, 0, .05, 0, '#b8a888');
    p.box(.84, .012, .58, -.72, y + .166, .08, 0, .05, 0, '#efe6d4');
    p.done();
    // A hammered bowl and a little bronze (a loop standing on a loop).
    const m = this.batch(M.bronze, g);
    m.add(lathe([[0, .03], [.2, .03], [.42, .17], [.47, .26], [.44, .26], [.38, .17], [.18, .07], [0, .06]], 28), .55, y, -.05);
    m.add(new THREE.TorusGeometry(.13, .055, 10, 24), 1.35, y + .17, .15, 0, .5, 0);
    m.add(new THREE.TorusGeometry(.085, .045, 10, 22), 1.35, y + .4, .15, 0, .5, 0);
    m.done();
  }

  // The sling chair: a square walnut frame with flat arms, and a seat and
  // back of thick worn leather slung between the rails.
  buildSlingChair() {
    const M = this.materials, C = L.sling, g = new THREE.Group();
    g.position.set(C.x, 0, C.z); g.rotation.y = C.ry;
    this.group.add(g);
    this.slingChair = g;
    const w = this.batch(M.chairWood, g);
    for (const s of [-1, 1]) {
      w.box(.11, 1.42, .11, s * .76, .71, .68);
      w.box(.11, 2.0, .11, s * .76, .98, -.74, -.13);
      w.box(.07, .15, 1.42, s * .76, .52, -.02);
      w.box(.17, .06, 1.78, s * .76, 1.45, -.06, .03);
    }
    w.box(1.5, .13, .07, 0, .66, .68); w.box(1.5, .13, .07, 0, .55, -.7); w.box(1.5, .1, .07, 0, 1.86, -.86, -.13);
    w.done();
    const l = this.batch(M.leather, g);
    // The seat sags toward the back; the back leans.
    l.add(roundedBox(1.4, .13, 1.5, .05), 0, .88, 0, -.11);
    l.add(roundedBox(1.4, 1.2, .12, .05), 0, 1.5, -.76, -.2);
    // Straps: under each arm, buckled to the frame.
    for (const s of [-1, 1]) l.box(.02, .1, 1.4, s * .69, 1.12, -.04, .03);
    l.done();
  }

  // The mohair armchair: a round tub, all soft curves, its back wrapping
  // round into the arms.
  buildMohairChair() {
    const M = this.materials, C = L.mohair, g = new THREE.Group();
    g.position.set(C.x, 0, C.z); g.rotation.y = C.ry;
    this.group.add(g);
    this.mohairChair = g;
    const r = .68, span = 4.7, len = r * span, path = s => { const a = s / r; return {p: V(r * Math.sin(a), 0, -r * Math.cos(a)), n: V(Math.sin(a), 0, -Math.cos(a))}; };
    const b = this.batch(M.mohair, g);
    b.add(lathe([[0, .12], [.6, .12], [.7, .2], [.74, .45], [.72, .78], [.6, .93], [.35, C.seat], [0, C.seat]], 36));
    b.add(sweep({path, length: len, w: .56, h: 1.5, y0: .22, e: 2.3, cap: .42, nu: 30, nv: 18, grow: s => 1 - .3 * Math.pow(Math.abs(s) / (len / 2), 2), flat: true}));
    b.done();
    this.box(.9, .12, .9, 0, .06, 0, M.darkWood, g, {cast: false});
  }

  // Beside the sling chair, a cube of travertine; beside the mohair chair,
  // a drum of red lacquer with a candle in a glass.
  buildSideTables() {
    const M = this.materials, C = L.cube, Q = L.lacquer;
    const cube = this.mesh(roundedBox(C.s, C.s, C.s, .035, 3, .04), M.travertine);
    cube.position.set(C.x, C.s / 2, C.z); cube.rotation.y = .22;
    this.cube = cube;
    const drum = this.mesh(lathe([[0, 0], [Q.r - .03, 0], [Q.r, .03], [Q.r, Q.h - .04], [Q.r - .04, Q.h], [0, Q.h]], 40), M.lacquer);
    drum.position.set(Q.x, 0, Q.z);
    this.lacquerTable = drum;
    const glass = this.mesh(new THREE.CylinderGeometry(.11, .1, .24, 20), M.candle, this.group, {cast: false});
    glass.position.set(Q.x + .08, Q.h + .12, Q.z - .05);
    // On the cube: an olive-green vase of winter berries and a little dish.
    const p = this.batch(M.paint), y = C.s, r = rng(91);
    p.add(lathe([[0, 0], [.1, 0], [.17, .1], [.18, .2], [.1, .32], [.06, .38], [.08, .42], [0, .42]], 20), C.x - .2, y, C.z + .1, 0, 0, 0, '#5c6238');
    for (let i = 0; i < 7; i++) {
      const a = r() * TAU, tilt = .15 + r() * .45, h = .5 + r() * .45, dx = Math.cos(a) * Math.sin(tilt), dz = Math.sin(a) * Math.sin(tilt), dy = Math.cos(tilt);
      p.add(new THREE.CylinderGeometry(.008, .01, h, 4), C.x - .2 + dx * h / 2, y + .4 + dy * h / 2, C.z + .1 + dz * h / 2, tilt * Math.sin(a), 0, -tilt * Math.cos(a), '#4a3324');
      for (let k = 0; k < 6; k++) { const t = .45 + r() * .6; p.add(new THREE.SphereGeometry(.028, 6, 5), C.x - .2 + dx * h * t + (r() - .5) * .08, y + .4 + dy * h * t + (r() - .5) * .06, C.z + .1 + dz * h * t + (r() - .5) * .08, 0, 0, 0, r() < .7 ? '#8e1f22' : '#6d1418'); }
    }
    p.done();
    const dish = this.mesh(lathe([[0, .01], [.1, .01], [.17, .05], [.16, .06], [.09, .03], [0, .025]], 20), M.brass);
    dish.position.set(C.x + .25, y, C.z - .15);
  }

  // The sideboard: four doors of burl walnut on little brass-shod legs,
  // under a large abstract painting. On it: a big urn of olive branches
  // and a few books.
  buildSideboard() {
    const M = this.materials, S = L.sideboard, g = new THREE.Group();
    // (Its own frame: x along the wall, z into the room.)
    g.position.set(L.south - S.deep / 2 - .04, 0, S.z); g.rotation.y = -Math.PI / 2;
    this.group.add(g);
    this.sideboard = g;
    const bodyH = 1.4, legH = .4;
    const body = this.mesh(new THREE.BoxGeometry(S.long, bodyH, S.deep), [M.burl, M.burl, M.burl, M.burl, M.burlDoors, M.burl], g);
    body.position.y = legH + bodyH / 2;
    this.box(S.long + .08, .07, S.deep + .06, 0, legH + bodyH + .035, 0, M.darkWood, g);
    const legs = this.batch(M.darkWood, g);
    for (const x of [-1.5, -.5, .5, 1.5]) for (const z of [-.38, .38]) legs.add(new THREE.CylinderGeometry(.06, .035, legH, 10), x * (S.long / 2 - .16) / 1.5, legH / 2, z);
    legs.done();
    const brass = this.batch(M.brass, g, {cast: false});
    for (const x of [-.94, -.76, .76, .94]) brass.add(new THREE.SphereGeometry(.035, 10, 8), x, legH + bodyH * .55, S.deep / 2 + .03);
    brass.done();
    // On top.
    const y = S.top, p = this.batch(M.paint, g);
    p.add(lathe([[0, 0], [.2, 0], [.36, .2], [.42, .5], [.36, .82], [.2, .98], [.17, 1.08], [.22, 1.14], [.19, 1.16], [.13, 1.1], [0, 1.1]], 28), -1.0, y, -.05, 0, 0, 0, '#bca587');
    p.box(.8, .1, .56, .85, y + .05, .02, 0, .12, 0, '#3a2a22');
    p.box(.74, .08, .5, .83, y + .14, .03, 0, -.06, 0, '#8a7a5c');
    p.box(.66, .07, .46, .86, y + .215, .02, 0, .22, 0, '#243040');
    // (The olive branches' stems.)
    const r = rng(93), sprays = [];
    for (let i = 0; i < 9; i++) {
      const a = r() * TAU, tilt = .12 + r() * .5, h = 1.1 + r() * 1.0, dir = V(Math.cos(a) * Math.sin(tilt), Math.cos(tilt), Math.sin(a) * Math.sin(tilt) * .6 + .08);
      p.add(new THREE.CylinderGeometry(.008, .014, h, 4), -1.0 + dir.x * h / 2, y + 1.05 + dir.y * h / 2, -.05 + dir.z * h / 2, 0, 0, 0, '#6a6248', V(1, 1, 1));
      sprays.push([dir, h]);
    }
    p.done();
    // Leaves along each stem.
    const leaves = new THREE.InstancedMesh(new THREE.PlaneGeometry(.1, .24), M.leaf, sprays.length * 14), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    let n = 0;
    for (const [dir, h] of sprays) for (let k = 0; k < 14; k++) {
      const at = V(-1.0, y + 1.05, -.05).addScaledVector(V(dir.x, 1, dir.z).normalize(), h * (.3 + k * .05));
      q.setFromEuler(e.set(r() * 1.4 - .7, r() * TAU, (k % 2 ? 1 : -1) * (.7 + r() * .5)));
      leaves.setMatrixAt(n++, m4.compose(at, q, V(1, 1, 1).multiplyScalar(.8 + r() * .6)));
    }
    g.add(leaves);
    // The painting: a big canvas in a slim dark frame.
    const W = 3.1, H = 3.6, cy = 5.15, pic = new THREE.Group();
    pic.position.set(0, cy, -S.deep / 2 - .02); g.add(pic);
    this.mesh(new THREE.PlaneGeometry(W, H), M.painting, pic, {cast: false}).position.z = .05;
    const f = this.batch(M.frame, pic), t = .07;
    f.box(W + 2 * t, t, .1, 0, H / 2 + t / 2, .05); f.box(W + 2 * t, t, .1, 0, -H / 2 - t / 2, .05);
    f.box(t, H, .1, W / 2 + t / 2, 0, .05); f.box(t, H, .1, -W / 2 - t / 2, 0, .05);
    f.done();
    this.paintingGroup = pic;
  }

  // The fireplace: a plain plaster chimney breast the height of the room,
  // a limestone surround and hearth, logs on a grate, and the fire.
  buildFireplace() {
    const M = this.materials, F = L.fire, g = new THREE.Group();
    // (Its own frame: x along the wall, z into the room.)
    g.position.set(L.south, 0, F.z); g.rotation.y = -Math.PI / 2;
    this.group.add(g);
    this.fireplace = g;
    const W = F.wide, D = F.deep, OW = F.open, OH = F.openH, H = L.wallH;
    const breast = this.batch(M.plaster, g);
    for (const s of [-1, 1]) breast.add(sizedBox((W - OW) / 2, H, D, this.plasterPer), s * (OW / 2 + (W - OW) / 4), H / 2, D / 2);
    breast.add(sizedBox(OW, H - OH, D, this.plasterPer), 0, (H + OH) / 2, D / 2);
    breast.done();
    // The surround: flat slips of limestone round the opening, a plain
    // shelf over them, and the hearth slab on the floor.
    const stone = this.batch(M.stone, g), sw = .3;
    for (const s of [-1, 1]) stone.add(sizedBox(sw, OH + sw, .08, 1.6), s * (OW / 2 + sw / 2), (OH + sw) / 2, D + .04);
    stone.add(sizedBox(OW, sw, .08, 1.6), 0, OH + sw / 2, D + .04);
    stone.add(sizedBox(OW + 2 * sw + .3, .12, .34, 1.6), 0, OH + sw + .06, D + .13);
    stone.add(sizedBox(W + .1, .1, 1.0, 1.6), 0, .05, D + .5);
    stone.done();
    this.hearthTop = .1;
    // The firebox: sooty back, sides, roof and floor.
    const soot = this.batch(M.soot, g, {cast: false});
    soot.box(OW, OH, .02, 0, OH / 2, .06);
    for (const s of [-1, 1]) soot.box(.02, OH, D, s * (OW / 2 - .01), OH / 2, D / 2);
    soot.box(OW, .02, D, 0, OH - .01, D / 2); soot.box(OW, .1, D, 0, .05, D / 2);
    // The grate.
    for (const s of [-1, 1]) soot.box(.03, .12, .32, s * .45, .2, .33);
    soot.box(1.0, .03, .03, 0, .24, .22); soot.box(1.0, .03, .03, 0, .24, .44);
    soot.done();
    const logs = this.batch(M.paint, g);
    for (const [x, y, z, len, rot, tilt] of [[-.06, .33, .36, 1.1, .12, 0], [.1, .33, .25, 1.0, -.15, 0], [0, .46, .3, .95, .05, .22]]) {
      logs.add(new THREE.CylinderGeometry(.085, .095, len, 10, 1, true), x, y, z, 0, rot, Math.PI / 2 + tilt, '#4a3424');
      for (const s of [-1, 1]) logs.add(new THREE.CircleGeometry(.09, 10), x + s * Math.cos(rot) * Math.cos(tilt) * len / 2, y + s * Math.sin(tilt) * len / 2, z - s * Math.sin(rot) * len / 2, 0, rot + s * Math.PI / 2, 0, '#c19a6b');
    }
    logs.done();
    // The fire: flame cards, embers under the logs, a soft glow in the
    // opening, and warm light spilling over the hearth and the floor.
    // (Drawn, not a lamp: no extra light for the phone to work out.)
    const flameMat = this.flameMat = new THREE.MeshBasicMaterial({map: canvasTexture(64, 128, drawFlame), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, color: new THREE.Color(1, .75, .45), side: THREE.DoubleSide});
    this.flames = [[-.28, .16, .9], [.02, .2, 1.2], [.3, .15, .85], [-.08, .1, .7], [.16, .12, .78]].map(([x, z, s], i) => {
      const geo = new THREE.PlaneGeometry(.36, .75); geo.translate(0, .375, 0);
      const f = this.mesh(geo, flameMat, g, {cast: false, receive: false});
      f.position.set(x, .36, .3 + z * .5); f.rotation.y = (i - 2) * .12;
      return {f, s, phase: i * 1.9, x};
    });
    const glowTex = canvasTexture(128, 128, (c, w, h) => { const gr = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(255,190,110,1)'); gr.addColorStop(.4, 'rgba(255,140,60,.45)'); gr.addColorStop(1, 'rgba(255,120,40,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, h); });
    this.embers = this.mesh(new THREE.PlaneGeometry(1.1, .45), new THREE.MeshBasicMaterial({map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, color: '#ff8a3a'}), g, {cast: false, receive: false});
    this.embers.rotation.x = -Math.PI / 2; this.embers.position.set(0, .26, .33);
    this.fireGlow = new THREE.Sprite(new THREE.SpriteMaterial({map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, color: '#ffb070', opacity: .5}));
    this.fireGlow.scale.set(2.3, 1.9, 1); this.fireGlow.position.set(0, .75, D + .1);
    g.add(this.fireGlow);
    this.hearthGlow = this.mesh(new THREE.PlaneGeometry(6.4, 4.6), new THREE.MeshBasicMaterial({map: glowTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, color: '#ff9a4a'}), g, {cast: false, receive: false});
    this.hearthGlow.rotation.x = -Math.PI / 2; this.hearthGlow.position.set(0, .012, D + 1.7);
    this.fireLevel = .5;
  }

  // The arc lamp: a marble foot, a long brass bow, and a cream shade
  // hanging over the end of the sofa.
  buildLamp() {
    const M = this.materials, {x, z, head} = L.lamp, [hx, hy, hz] = head;
    const foot = this.mesh(new THREE.CylinderGeometry(.36, .38, .22, 32), M.travertine);
    foot.position.set(x, .11, z);
    const bow = new THREE.CatmullRomCurve3([V(x, .2, z), V(x, 2.6, z), V(x + (hx - x) * .08, 4.6, z + (hz - z) * .08), V(x + (hx - x) * .32, 5.75, z + (hz - z) * .32), V(x + (hx - x) * .68, 5.85, z + (hz - z) * .68), V(hx, hy + .55, hz)]);
    const b = this.batch(M.brass);
    b.add(new THREE.TubeGeometry(bow, 48, .035, 8));
    b.add(new THREE.CylinderGeometry(.05, .05, .22, 12), hx, hy + .45, hz);
    b.done();
    const shade = this.mesh(new THREE.CylinderGeometry(.1, .82, .62, 40, 1, true), M.shade, this.group, {cast: false});
    shade.position.set(hx, hy, hz);
    this.lampShade = shade;
    // Where the room's lamp light hangs (the study's lamp light moves here).
    this.lampSpot = V(hx, hy - .5, hz);
  }

  // The low sun through the sea glazing, across the floor.
  buildSunPatch() {
    const beam = canvasTexture(256, 512, (c, w, h) => { c.filter = 'blur(9px)'; c.fillStyle = 'rgba(255,214,150,1)'; for (let i = 0; i < 2; i++) for (let j = 0; j < 12; j++) c.fillRect(22 + i * 110, 14 + j * 41, 96, 34); });
    this.sunPatch = this.mesh(new THREE.PlaneGeometry(3.4, 11.5), new THREE.MeshBasicMaterial({map: beam, transparent: true, opacity: .2, blending: THREE.AdditiveBlending, depthWrite: false}), this.group, {cast: false, receive: false});
    this.sunPatch.rotation.set(-Math.PI / 2, 0, -.2);
    this.sunPatch.position.set(-3.9, .02, 7.2);
  }

  // Her tent and her fountain come to stand by the glazing: the kitchen's
  // tent (its `bed` group) and the study's fountain, moved here.
  adopt({tent = null, fountain = null} = {}) {
    if (tent) { this.group.add(tent); tent.position.set(L.tent.x, 0, L.tent.z); tent.rotation.y = L.tent.ry; this.bed = tent; this.bedTop = .16; this.bedRadius = .9; }
    if (fountain) { this.group.add(fountain); fountain.position.set(FOUNTAIN.x, 0, FOUNTAIN.z); fountain.rotation.y = FOUNTAIN.ry; this.fountain = fountain; }
  }
  activate(lamp) { lamp.position.copy(this.lampSpot); }

  // Everything the app needs to know about the room's layout (as the
  // kitchen's; what she does here comes in a later step).
  layout() {
    const at = (x, z) => V(x, 0, z), S = L.sofa, T = L.table, F = L.fire, B = L.sideboard, tentIn = !!this.bed;
    return {
      home: at(6.0, 7.2), toyHome: V(6.6, .13, 8.4),
      fountain: {p: at(FOUNTAIN.x, FOUNTAIN.z), ry: FOUNTAIN.ry},
      sunSpot: at(-4.2, 5.2),
      // Where she sits to watch the sea, and where she lies by the fire.
      windowSpot: at(-5.1, 5.6), endWindowSpot: at(6.5, 13.1),
      fireSpot: {at: at(L.south - F.deep - 1.75, F.z), face: Math.PI / 2},
      perches: {
        // Up onto the sofa from its kitchen end; along the seat; and from
        // the seat up onto the back.
        sofa: {spot: at(S.x + .25, S.z - 2.1), top: S.seat, base: at(S.x + 1.5, S.z - 4.0), face: Math.PI / 2, lane: {x: S.x + .2, z0: S.z - 2.2, z1: S.z + 2.2}},
        sofaBack: {spot: at(S.x - .55, S.z - 1.2), top: S.back, via: 'sofa', face: Math.PI / 2},
        // The mohair chair: a round seat to curl up in.
        mohair: {spot: at(L.mohair.x, L.mohair.z), top: L.mohair.seat, base: at(L.mohair.x - 1.6, L.mohair.z - .35), face: L.mohair.ry},
        // The sling chair's seat.
        sling: {spot: at(L.sling.x, L.sling.z), top: .92, base: at(L.sling.x - 1.6, L.sling.z + .6), face: L.sling.ry},
      },
      // What her tail keeps out of (clearTail in motion.js), as it is on
      // the floor.
      tailSolids: (() => {
        const box = (x0, x1, z0, z1, y0, y1, tag) => ({kind: 'box', x0, x1, z0, z1, y0, y1, tag});
        const cyl = (x, z, r, y0, y1) => ({kind: 'cyl', x, z, r, y0, y1});
        const list = [
          // The sofa: its seat, and its back behind it (a box a little
          // generous at the middle, where the sofa curves away).
          box(S.x - 1.05, S.x + 1.5, S.z - S.long / 2, S.z + S.long / 2, 0, S.seat, 'sofa'), box(S.x - 1.05, S.x - .2, S.z - S.long / 2, S.z + S.long / 2, S.seat, S.back, 'sofa'),
          // The coffee table: its feet, and the slab.
          cyl(T.x, T.z - 1.15, .6, 0, T.top - .3), cyl(T.x, T.z + 1.05, .55, 0, T.top - .3), box(T.x - T.wide / 2 - .15, T.x + T.wide / 2 + .15, T.z - T.long / 2, T.z + T.long / 2, T.top - .3, T.top + .45, 'table'),
          cyl(L.sling.x, L.sling.z, 1.0, 0, 2.0), cyl(L.mohair.x, L.mohair.z, .98, 0, 1.75),
          cyl(L.cube.x, L.cube.z, .8, 0, L.cube.s + .9), cyl(L.lacquer.x, L.lacquer.z, L.lacquer.r, 0, L.lacquer.h + .25), cyl(L.lamp.x, L.lamp.z, .38, 0, .22), cyl(L.lamp.x, L.lamp.z, .05, .22, 4.6),
          // The sideboard on its legs, the chimney breast, the hearth slab.
          box(L.south - B.deep - .08, L.south, B.z - B.long / 2 - .04, B.z + B.long / 2 + .04, .4, B.top, 'sideboard'),
          box(L.south - F.deep, L.south, F.z - F.wide / 2, F.z + F.wide / 2, 0, L.wallH), box(L.south - F.deep - 1.0, L.south - F.deep, F.z - F.wide / 2 - .05, F.z + F.wide / 2 + .05, 0, .1),
          // The walls and both glazings.
          box(L.sea - .5, L.sea + .14, L.join, L.end, 0, L.wallH), box(L.sea, L.south, L.end - .14, L.end + .5, 0, L.wallH), box(L.south - .05, L.south + .5, L.join, L.end, 0, L.wallH),
        ];
        // (Joined, the kitchen lists her fountain and tent itself.)
        if (this.alone) list.push(cyl(FOUNTAIN.x, FOUNTAIN.z, .55, 0, .23), cyl(FOUNTAIN.x, FOUNTAIN.z, .23, .23, .38));
        if (tentIn && this.alone) list.push({kind: 'rbox', x: L.tent.x, z: L.tent.z, ry: L.tent.ry, hx: 1.32, hz: 1.02, y0: 0, y1: 1.95, tag: 'bed'});
        return list;
      })(),
      perchTargets: [['sofa', this.sofa], ['mohair', this.mohairChair], ['sling', this.slingChair]],
      // In the tent she lies along it, facing out of the open front.
      sleepHeading: L.tent.ry,
      bedOffset: V(Math.sin(L.tent.ry) * .15, 0, Math.cos(L.tent.ry) * .15),
      bedFace: L.tent.ry,
      floor: {...this.floorBox}, keepOut: KEEP_OUT.map(r => ({...r})), obstacles: OBSTACLES.map(o => ({...o})), tentDoor: TENT_DOOR.clone(),
      limits: {dist: [1.1, 20], pitch: [.04, 1.25], x: [L.sea + .4, L.south - .6], z: [.4, L.end - .6], y: [.08, 5.8]},
      camBox: {x: [L.sea + .2, L.south - .2], y: [.2, 9.2], z: [-16, L.end - .2]}, // open to the kitchen side
      camSolids: [[S.x, S.z - 1.6, 1.3, 2.1], [S.x, S.z + 1.6, 1.3, 2.1], [L.sling.x, L.sling.z, 1.1, 2.1], [L.mohair.x, L.mohair.z, 1.05, 1.9]].concat(tentIn && this.alone ? [[L.tent.x, L.tent.z, 1.4, 2.0]] : []),
      // Tops the camera mustn't sink into.
      camBlocks: [[T.x - T.wide / 2 - .3, T.x + T.wide / 2 + .3, T.z - T.long / 2 - .3, T.z + T.long / 2 + .3, T.top + .35], [L.south - B.deep - .4, L.south, B.z - B.long / 2 - .3, B.z + B.long / 2 + .3, B.top + .35]],
    };
  }

  // What the Room view keeps in frame (see roomFrame in app.js).
  frame(wide) {
    const S = L.sofa, T = L.table;
    return {
      // From the kitchen side, looking down the room toward the far
      // glazing, a little turned to the sea.
      yaw: wide ? .5 : .35,
      across: wide
        ? [[S.x - 1, 1.9, S.z - 3.1], [S.x - 1, 1.9, S.z + 3.1], [T.x, .9, T.z], [L.sling.x, 1.9, L.sling.z], [L.mohair.x, 1.7, L.mohair.z], [L.south, 5, L.fire.z], [L.south, 5, L.sideboard.z], [L.tent.x, 1.9, L.tent.z], [L.sea, 4, 2], [L.sea, 4, L.end], [L.south, 4, L.end]]
        : [[S.x - 1, 1.9, S.z - 3.1], [S.x - 1, 1.9, S.z + 3.1], [T.x, .9, T.z], [L.sling.x, 1.9, L.sling.z], [L.mohair.x, 1.7, L.mohair.z], [L.south, 2, L.fire.z]],
      bottom: [[L.sling.x, 0, L.sling.z - 1.2], [L.cube.x, 0, L.cube.z - .8], [S.x, 0, S.z - 3.4]],
      top: [[L.south, 7.1, L.sideboard.z], [L.lamp.x, 6.2, L.lamp.z], [L.sea, 8.2, 7]],
    };
  }

  clampFloor(v) {
    const F = this.floorBox, clampF = () => { v.x = Math.min(F.x1, Math.max(F.x0, v.x)); v.z = Math.min(F.z1, Math.max(F.z0, v.z)); };
    clampF();
    for (let pass = 0; pass < 3; pass++) { this.pushOutOnce(v, .05); }
    clampF();
    // (Pushed out of one thing into the next and back, between the sofa's
    // end and the lamp say, or out past the glazing behind the tent and
    // back in by the floor's edge: the nearest clear spot instead.)
    const blocked = q => KEEP_OUT.some(R => q.x > R.x0 && q.x < R.x1 && q.z > R.z0 && q.z < R.z1) || OBSTACLES.some(c => this.blocks(c) && Math.hypot(q.x - c.x, q.z - c.z) < c.r - 1e-3 && !this.inTentDoor(c, q));
    if (blocked(v)) {
      const q = V(0, 0, 0);
      search: for (let ring = 1; ring <= 40; ring++) for (let i = 0; i < ring * 8; i++) {
        const a = i / (ring * 8) * TAU;
        q.set(Math.min(F.x1, Math.max(F.x0, v.x + Math.cos(a) * ring * .1)), 0, Math.min(F.z1, Math.max(F.z0, v.z + Math.sin(a) * ring * .1)));
        if (!blocked(q)) { v.copy(q); break search; }
      }
    }
    return v;
  }
  randomFloorPoint(pad = 0) {
    for (let i = 0; i < 40; i++) {
      const v = V(FLOOR.x0 + .3 + Math.random() * (FLOOR.x1 - FLOOR.x0 - .6), 0, FLOOR.z0 + .3 + Math.random() * (FLOOR.z1 - FLOOR.z0 - .6));
      if (KEEP_OUT.some(R => v.x > R.x0 - pad && v.x < R.x1 + pad && v.z > R.z0 - pad && v.z < R.z1 + pad)) continue;
      if (OBSTACLES.some(c => this.blocks(c) && Math.hypot(v.x - c.x, v.z - c.z) < c.r + .3 + pad * .5)) continue;
      return v;
    }
    return V(6.4, 0, 7.2);
  }
  // Things that stand on this floor only for a while (the Christmas tree's
  // foot and its open box, from the kitchen's setTree): she walks round them.
  setExtras(list) {
    for (const o of this.extras ?? []) { const i = OBSTACLES.indexOf(o); if (i >= 0) OBSTACLES.splice(i, 1); }
    this.extras = list.map(o => ({...o})); OBSTACLES.push(...this.extras);
  }
  // Is this round thing here (the tent and fountain only once adopted)?
  blocks(c) { return c === TENT ? !!this.bed : c === FOUNTAIN ? !!this.fountain : true; }
  // In the corridor along the tent's door axis, the way into the bed.
  inTentDoor(c, v) {
    if (c !== TENT) return false;
    const dx = v.x - c.x, dz = v.z - c.z, ax = Math.sin(L.tent.ry), az = Math.cos(L.tent.ry);
    return Math.abs(dx * az - dz * ax) < .6 && dx * ax + dz * az > -1.0;
  }
  // The safety net under every way she moves on the floor: her centre is
  // kept out of the furniture. Into the tent only along its doorway.
  pushOut(v) {
    for (let pass = 0; pass < 3; pass++) this.pushOutOnce(v);
    return v;
  }
  pushOutOnce(v, more = 0) {
    for (const R of KEEP_OUT) if (v.x > R.x0 && v.x < R.x1 && v.z > R.z0 && v.z < R.z1) {
      // (Out by the nearest side that doesn't lead into the other piece:
      // the sofa and the table stand side by side.)
      const opts = [[R.x0 - .01 - v.x, 0], [R.x1 + .01 - v.x, 0], [0, R.z0 - .01 - v.z], [0, R.z1 + .01 - v.z]].sort((a, b) => Math.abs(a[0] + a[1]) - Math.abs(b[0] + b[1]));
      const free = opts.find(([dx, dz]) => !KEEP_OUT.some(Q => Q !== R && v.x + dx > Q.x0 && v.x + dx < Q.x1 && v.z + dz > Q.z0 && v.z + dz < Q.z1)) ?? opts[0];
      v.x += free[0]; v.z += free[1];
    }
    for (const c of OBSTACLES) {
      if (!this.blocks(c)) continue;
      const dx = v.x - c.x, dz = v.z - c.z, d = Math.hypot(dx, dz);
      // (In by the tent's doorway.)
      if (d >= c.r || this.inTentDoor(c, v)) continue;
      const k = (c.r + more) / Math.max(d, 1e-3);
      v.x = c.x + (d < 1e-3 ? c.r + more : dx * k); v.z = c.z + (d < 1e-3 ? 0 : dz * k);
    }
    return v;
  }
  // A walk round everything in the way: the shortest path through points
  // just clear of the furniture's corners and round each round thing (as
  // the kitchen's). Into the tent only through its doorway; out the same.
  route(from, to) {
    const inside = (p, c) => Math.hypot(p.x - c.x, p.z - c.z) < c.r, inRect = (p, R) => p.x > R.x0 && p.x < R.x1 && p.z > R.z0 && p.z < R.z1;
    let A = from, B = to;
    const pre = [], post = [];
    if (this.bed && inside(to, TENT)) { B = TENT_DOOR; post.push(to); }
    if (this.bed && inside(from, TENT)) { A = TENT_DOOR; pre.push(TENT_DOOR); }
    const circles = OBSTACLES.filter(c => (c !== TENT || this.bed) && (c !== FOUNTAIN || this.fountain) && !inside(A, c) && !inside(B, c));
    const rects = KEEP_OUT.filter(R => !inRect(A, R) && !inRect(B, R));
    const clear = (p, q) => rects.every(R => !segmentHitsRect(p, q, R)) && circles.every(c => segmentDistance(c, p, q) >= c.r - 1e-3);
    let path = [B];
    if (!clear(A, B)) {
      const m = .2, nodes = [A, B];
      for (const R of rects) nodes.push(V(R.x0 - m, 0, R.z0 - m), V(R.x1 + m, 0, R.z0 - m), V(R.x1 + m, 0, R.z1 + m), V(R.x0 - m, 0, R.z1 + m));
      for (const c of circles) for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; nodes.push(V(c.x + Math.cos(a) * (c.r + m), 0, c.z + Math.sin(a) * (c.r + m))); }
      const B0 = this.floorBox, F = {x0: B0.x0 - .15, x1: B0.x1 + .15, z0: B0.z0 - .6, z1: B0.z1 + .15};
      const ok = nodes.filter((p, i) => i < 2 || (p.x >= F.x0 && p.x <= F.x1 && p.z >= F.z0 && p.z <= F.z1 && !circles.some(c => inside(p, c)) && !rects.some(R => inRect(p, R))));
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
    }
    const pts = [...pre, ...path, ...post].filter((p, i, all) => !(i && p.distanceTo(all[i - 1]) < .05));
    return pts.filter((p, i) => i === pts.length - 1 || p.distanceTo(from) > .15).map(p => p.clone());
  }

  // away: seen from another room (the scene's lighting then belongs to
  // that room).
  update(dt, t, night, {camera = null, lamp = null, away = false} = {}) {
    if (camera) {
      const eye = this.group.worldToLocal(camera.position.clone());
      for (const w of this.walls) {
        const n = V(0, 0, 1).applyQuaternion(w.quaternion);
        w.visible = V(0, 0, 0).subVectors(eye, w.position).dot(n) > -.05;
      }
      // (What is built onto the fire wall goes with it.)
      this.fireplace.visible = this.paintingGroup.visible = this.skirting.visible = this.southWall.visible;
    }
    const M = this.materials;
    if (lamp) lamp.intensity = damp(lamp.intensity, night ? 34 : 3, 3, dt);
    M.shade.emissiveIntensity = damp(M.shade.emissiveIntensity, night ? 2.6 : .3, 3, dt);
    M.candle.emissiveIntensity = damp(M.candle.emissiveIntensity, night ? 2.2 : .5, 3, dt) * (1 + Math.sin(t * 13) * .04 + Math.sin(t * 7.3) * .03);
    // By night the glazing's light on the floor is moonlight: fainter and cool.
    this.sunPatch.material.opacity = damp(this.sunPatch.material.opacity, night ? .12 : .2, 3, dt);
    this.sunPatch.material.color.lerp(night ? MOONLIGHT : DAYLIGHT, 1 - Math.exp(-3 * dt));
    for (const tr of this.terraces) tr.update(dt, t, night);
    this.paving.color.copy(this.terraceView.pave);
    this.updateFire(dt, t, night);
    const R = this.room;
    if (!away && R && this.scene.environment && R.envNight) {
      const env = night ? R.envNight : R.envDay;
      if (this.scene.environment !== env) this.scene.environment = env;
      this.scene.environmentIntensity = damp(this.scene.environmentIntensity, night ? .35 : .6, 3, dt);
    }
  }
  // The fire burns low by day and up in the evening.
  updateFire(dt, t, night) {
    this.fireLevel = damp(this.fireLevel, night ? 1 : .55, 1.5, dt);
    const F = this.fireLevel, flick = .85 + .15 * Math.sin(t * 9.7) * Math.sin(t * 6.3 + 1);
    for (const {f, s, phase, x} of this.flames) {
      const k = s * (.55 + .45 * F) * (.82 + .18 * Math.sin(t * (5 + s * 3) + phase) + .08 * Math.sin(t * 17 + phase * 2));
      f.scale.set(.85 + .15 * Math.sin(t * 4 + phase), k, 1);
      f.position.x = x + Math.sin(t * 2.3 + phase) * .02;
    }
    this.flameMat.opacity = (.55 + .45 * F) * flick;
    this.embers.material.opacity = (.6 + .4 * F) * (.85 + .15 * Math.sin(t * 3.1));
    this.fireGlow.material.opacity = .25 + .45 * F * flick;
    this.hearthGlow.material.opacity = (.12 + Math.max(0, F - .5) * 2 * .5) * flick;
  }
}

// Distance in plan from a circle's centre to a segment.
function segmentDistance(c, a, b) {
  const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz;
  const t = l2 ? Math.max(0, Math.min(1, ((c.x - a.x) * dx + (c.z - a.z) * dz) / l2)) : 0;
  return Math.hypot(a.x + dx * t - c.x, a.z + dz * t - c.z);
}
// Does the segment a-b (on the floor) cross the rectangle R?
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

// A box whose picture is laid on by size (`per` units to a picture), not
// stretched to fit each face.
function sizedBox(w, h, d, per) {
  const geo = new THREE.BoxGeometry(w, h, d), uv = geo.attributes.uv, sizes = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let i = 0; i < uv.count; i++) { const [a, b] = sizes[Math.floor(i / 4)]; uv.setXY(i, uv.getX(i) * a / per, uv.getY(i) * b / per); }
  return geo;
}

// A soft, upholstered shape: a rounded section (w across, h tall, its foot
// at y0, `off` to one side of the path) carried along a path, with rounded
// ends. path(s) gives the point on the floor at s along (from -length/2 to
// length/2) and the unit vector across. e: how square the section is (2 an
// oval, 5 nearly a box). flat: the ends are rounded in plan only (a sofa's
// base); otherwise they close like a bolster's. grow(s): taller or lower
// along the way.
function sweep({path, length, w, h, y0 = 0, off = 0, e = 3, cap = .5, nu = 24, nv = 20, flat = false, grow = null, uvScale = .6}) {
  const rings = [], m = 7, inner = length - 2 * cap, n = Math.max(1, Math.round(nu * inner / length));
  for (let j = 0; j <= m; j++) { const a = j / m * Math.PI / 2; rings.push([-length / 2 + cap * (1 - Math.cos(a)), Math.pow(Math.sin(a), .75)]); }
  for (let j = 1; j < n; j++) rings.push([-length / 2 + cap + inner * j / n, 1]);
  for (let j = m; j >= 0; j--) { const a = j / m * Math.PI / 2; rings.push([length / 2 - cap * (1 - Math.cos(a)), Math.pow(Math.sin(a), .75)]); }
  const pos = [], uv = [], idx = [], pow = (c, k) => Math.sign(c) * Math.pow(Math.abs(c), k), round = 2 * (w + h) * .85;
  // (The picture runs along the shape by the distance over its surface, so
  // it isn't squeezed where the ends turn in.)
  let run = 0, was = null;
  for (const [s, k] of rings) {
    const {p, n: across} = path(s), hh = h * (grow ? grow(s) : 1);
    const edge = V(p.x + across.x * (off + w / 2 * k), 0, p.z + across.z * (off + w / 2 * k));
    if (was) run += edge.distanceTo(was);
    was = edge;
    for (let i = 0; i <= nv; i++) {
      // (The seam runs underneath.)
      const f = -Math.PI / 2 + i / nv * TAU, a = w / 2 * pow(Math.cos(f), 2 / e) * k, b = pow(Math.sin(f), 2 / e);
      const y = flat ? y0 + hh * (b + 1) / 2 : y0 + hh / 2 + hh / 2 * b * k;
      pos.push(p.x + across.x * (off + a), y, p.z + across.z * (off + a));
      uv.push(run * uvScale, i / nv * round * uvScale);
    }
  }
  for (let j = 0; j < rings.length - 1; j++) for (let i = 0; i < nv; i++) { const a = j * (nv + 1) + i, c = a + nv + 1; idx.push(a, a + 1, c, a + 1, c + 1, c); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  // (Smooth across the seam.)
  const nrm = geo.attributes.normal, v = V(0, 0, 0), u = V(0, 0, 0);
  for (let j = 0; j < rings.length; j++) {
    const a = j * (nv + 1), c = a + nv;
    v.fromBufferAttribute(nrm, a).add(u.fromBufferAttribute(nrm, c)).normalize();
    nrm.setXYZ(a, v.x, v.y, v.z); nrm.setXYZ(c, v.x, v.y, v.z);
  }
  return geo;
}

// ---------------------------------------------------------------------------
// Textures
// ---------------------------------------------------------------------------
// The kitchen's pale limestone (kitchen.js): large tiles in slightly
// different beiges, fossil flecks, faint veins and fine joints. One picture
// is four tiles by four, 8 units of floor.
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

// Boucle: a cream ground thick with little loops of yarn. bump: the same
// loops as heights (pale = proud).
function drawBoucle(g, w, h, bump) {
  const r = rng(301);
  g.fillStyle = bump ? '#606060' : '#e9dfcc'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 5200; i++) {
    const x = r() * w, y = r() * h, s = 3 + r() * 4.5, lit = r();
    g.strokeStyle = bump ? `rgba(255,255,255,${.35 + lit * .5})` : lit < .45 ? `rgba(168,150,122,${.25 + r() * .3})` : `rgba(255,251,240,${.5 + r() * .4})`;
    g.lineWidth = 1.6 + r() * 1.6;
    // (Drawn again a picture's width away, so it tiles.)
    for (const [ox, oy] of [[0, 0], [x < 12 ? w : x > w - 12 ? -w : 0, y < 12 ? h : y > h - 12 ? -h : 0]]) {
      g.beginPath(); g.arc(x + ox, y + oy, s, r() * TAU, r() * TAU + 2.2 + r() * 2.5); g.stroke();
      if (!ox && !oy) continue;
    }
  }
}
// Mohair: aubergine, with the pile lying this way and that.
function drawMohair(g, w, h) {
  const r = rng(302);
  g.fillStyle = '#3b1d36'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 9000; i++) {
    const x = r() * w, y = r() * h, a = r() * TAU, l = 5 + r() * 11, k = r();
    g.strokeStyle = k < .4 ? `rgba(28,10,26,${.25 + r() * .3})` : k < .85 ? `rgba(84,44,80,${.3 + r() * .35})` : `rgba(136,92,130,${.18 + r() * .26})`;
    g.lineWidth = .8 + r() * 1.2;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * l * .5 + (r() - .5) * 4, y + Math.sin(a) * l * .5 + (r() - .5) * 4, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
}
// Short fibres, as heights: the fuzz on the mohair.
function drawFuzz(g, w, h) {
  const r = rng(303);
  g.fillStyle = '#505050'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 5000; i++) {
    const x = r() * w, y = r() * h, a = r() * TAU, l = 3 + r() * 7;
    g.strokeStyle = `rgba(255,255,255,${.25 + r() * .6})`; g.lineWidth = .8 + r();
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
}
// Rosewood: nearly black-brown, with long red and tan streaks that swing
// round a few dark eyes.
function drawRosewood(g, w, h) {
  const r = rng(304);
  g.fillStyle = '#3a1d13'; g.fillRect(0, 0, w, h);
  const eyes = []; for (let i = 0; i < 5; i++) eyes.push([r() * w, r() * h, 30 + r() * 60]);
  const bend = (x, y) => { let d = 0; for (const [ex, ey, s] of eyes) { const dy = y - ey, dx = x - ex; d += s * dy / (Math.abs(dy) + 26) * Math.exp(-(dx * dx) / (2 * (s * 3.2) ** 2)) * Math.exp(-(dy * dy) / (2 * (s * 1.6) ** 2)) * 1.6; } return d; };
  for (let i = 0; i < 230; i++) {
    const y0 = r() * h, k = r();
    g.strokeStyle = k < .4 ? `rgba(18,6,3,${.25 + r() * .45})` : k < .78 ? `rgba(122,52,28,${.2 + r() * .35})` : `rgba(176,104,58,${.12 + r() * .22})`;
    g.lineWidth = .8 + r() * r() * 5;
    g.beginPath();
    for (let x = -10; x <= w + 10; x += 12) { const y = y0 + Math.sin(x * .006 + i) * 9 + bend(x, y0); x < 0 ? g.moveTo(x, y) : g.lineTo(x, y); }
    g.stroke();
  }
  for (const [ex, ey, s] of eyes) { const gr = g.createRadialGradient(ex, ey, 0, ex, ey, s * .9); gr.addColorStop(0, 'rgba(16,6,3,.6)'); gr.addColorStop(1, 'rgba(16,6,3,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(ex, ey, s * 1.6, s * .6, 0, 0, TAU); g.fill(); }
}
// Leather the colour of cognac, paler and smoother where it's worn, dark in
// its creases.
function drawWornLeather(g, w, h) {
  drawNoise(g, w, h, {base: '#6f3b1c', blobs: [['rgba(150,90,48,.1)', 500, 14, 60], ['rgba(50,22,8,.1)', 700, 6, 36], ['rgba(180,124,74,.07)', 220, 30, 90]], seed: 305});
  const r = rng(306);
  // (The worn middle.)
  const gr = g.createRadialGradient(w * .5, h * .5, 20, w * .5, h * .5, w * .55); gr.addColorStop(0, 'rgba(186,128,78,.3)'); gr.addColorStop(1, 'rgba(186,128,78,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 320; i++) {
    g.strokeStyle = r() < .7 ? 'rgba(52,22,8,.2)' : 'rgba(232,180,128,.12)'; g.lineWidth = .5 + r() * 1.3;
    let x = r() * w, y = r() * h;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 5; k++) { x += (r() - .5) * 30; y += (r() - .5) * 30; g.lineTo(x, y); }
    g.stroke();
  }
  // (Dark at the edges, where hands and oil have been.)
  const ed = g.createRadialGradient(w / 2, h / 2, w * .3, w / 2, h / 2, w * .75); ed.addColorStop(0, 'rgba(50,22,8,0)'); ed.addColorStop(1, 'rgba(50,22,8,.4)');
  g.fillStyle = ed; g.fillRect(0, 0, w, h);
}
// Travertine: cream, in bands as it was laid down, pitted along them.
function drawTravertine(g, w, h) {
  const r = rng(307);
  g.fillStyle = '#e4d7be'; g.fillRect(0, 0, w, h);
  let y = 0;
  while (y < h) {
    const t = 4 + r() * 22;
    g.fillStyle = ['rgba(200,180,146,.35)', 'rgba(244,236,218,.45)', 'rgba(214,196,164,.3)', 'rgba(188,166,130,.28)', 'rgba(236,226,204,.3)'][Math.floor(r() * 5)];
    g.beginPath(); g.moveTo(0, y);
    for (let x = 0; x <= w; x += 32) g.lineTo(x, y + Math.sin(x * .02 + y) * 2.5);
    for (let x = w; x >= 0; x -= 32) g.lineTo(x, y + t + Math.sin(x * .017 + y * 2) * 2.5);
    g.fill();
    y += t;
  }
  for (let i = 0; i < 520; i++) {
    const x = r() * w, py = r() * h, l = 2 + r() * r() * 22;
    g.fillStyle = `rgba(${r() < .75 ? '120,96,66' : '90,70,46'},${.25 + r() * .4})`;
    g.beginPath(); g.ellipse(x, py, l, .8 + r() * 1.8, 0, 0, TAU); g.fill();
  }
}
// Burl walnut: a swirl of small dark eyes in honey-brown, no straight
// grain anywhere. doors: that many door fronts across, with dark seams
// between them (0: plain).
function drawBurl(g, w, h, doors) {
  const r = rng(308 + doors);
  g.fillStyle = '#7b4c24'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 260; i++) {
    const x = r() * w, y = r() * h, s = 14 + r() * 46, k = r();
    g.fillStyle = k < .5 ? `rgba(54,28,10,${.08 + r() * .14})` : `rgba(172,116,58,${.08 + r() * .16})`;
    g.beginPath(); g.ellipse(x, y, s, s * (.5 + r() * .7), r() * 3, 0, TAU); g.fill();
  }
  for (let i = 0; i < 420; i++) {
    const x = r() * w, y = r() * h, s = 2 + r() * 7;
    for (let k = 3; k > 0; k--) { g.strokeStyle = `rgba(40,18,6,${.14 + r() * .2})`; g.lineWidth = .8 + r(); g.beginPath(); g.ellipse(x, y, s * k * .8, s * k * .6, r() * 3, 0, TAU); g.stroke(); }
    g.fillStyle = 'rgba(30,12,4,.55)'; g.beginPath(); g.arc(x, y, .8 + r() * 1.6, 0, TAU); g.fill();
  }
  for (let i = 0; i < 160; i++) {
    g.strokeStyle = `rgba(${r() < .5 ? '46,22,8' : '196,140,78'},${.1 + r() * .16})`; g.lineWidth = 1 + r() * 2.5;
    let x = r() * w, y = r() * h, a = r() * TAU;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 9; k++) { a += (r() - .5) * 1.5; x += Math.cos(a) * 16; y += Math.sin(a) * 16; g.lineTo(x, y); }
    g.stroke();
  }
  if (doors) {
    for (let i = 0; i <= doors; i++) { const x = Math.min(w - 3, Math.max(0, i * w / doors - 1.5)); g.fillStyle = 'rgba(22,10,4,.9)'; g.fillRect(x, 0, 3, h); g.fillStyle = 'rgba(228,180,118,.22)'; g.fillRect(x + 3, 0, 2, h); }
    g.fillStyle = 'rgba(22,10,4,.9)'; g.fillRect(0, 0, w, 3); g.fillRect(0, h - 3, w, 3);
  }
}
// The rug: an old Persian carpet worn soft. A madder-rose field under a
// lattice of small flowers, a stepped indigo medallion, corner pieces, and
// a wide border of rosettes between pale guard stripes; faded in bands and
// worn thin in patches. (w across the rug, h along it.)
function drawRug(g, w, h) {
  const r = rng(309), FIELD = '#7c4a44', INK = '#2f2b3b', PLUM = '#573a4e', CREAM = '#c4ad88', SAND = '#a9855c', SAGE = '#6c735e', RUST = '#99593a';
  const B = w * .13, guard = w * .014;
  g.fillStyle = INK; g.fillRect(0, 0, w, h);
  g.fillStyle = CREAM; g.fillRect(guard, guard, w - 2 * guard, h - 2 * guard);
  g.fillStyle = PLUM; g.fillRect(2 * guard, 2 * guard, w - 4 * guard, h - 4 * guard);
  g.fillStyle = CREAM; g.fillRect(B - guard, B - guard, w - 2 * B + 2 * guard, h - 2 * B + 2 * guard);
  g.fillStyle = INK; g.fillRect(B - guard * .45, B - guard * .45, w - 2 * B + guard * .9, h - 2 * B + guard * .9);
  g.fillStyle = FIELD; g.fillRect(B, B, w - 2 * B, h - 2 * B);
  const rosette = (x, y, s, a, b, n = 8) => {
    g.fillStyle = a;
    for (let i = 0; i < n; i++) { const t = i / n * TAU; g.beginPath(); g.ellipse(x + Math.cos(t) * s * .55, y + Math.sin(t) * s * .55, s * .42, s * .17, t, 0, TAU); g.fill(); }
    g.fillStyle = b; g.beginPath(); g.arc(x, y, s * .26, 0, TAU); g.fill();
  };
  // A leaf-and-vine scroll between the border's flowers.
  const sprig = (x, y, s, a, col) => { g.save(); g.translate(x, y); g.rotate(a); g.strokeStyle = col; g.lineWidth = s * .12; g.beginPath(); g.moveTo(-s, 0); g.quadraticCurveTo(0, -s * .7, s, 0); g.stroke(); g.fillStyle = col; for (const k of [-.5, .5]) { g.beginPath(); g.ellipse(k * s, -s * .15, s * .32, s * .12, k, 0, TAU); g.fill(); } g.restore(); };
  g.globalAlpha = .82;
  const bm = (2 * guard + B - guard) / 2, step = (B - 3 * guard) * .92;
  const nx = Math.round((w - 2 * bm) / step), ny = Math.round((h - 2 * bm) / step);
  for (let i = 0; i <= nx; i++) for (const y of [bm, h - bm]) { const x = bm + (w - 2 * bm) * i / nx; rosette(x, y, step * .36, i % 2 ? CREAM : RUST, i % 2 ? RUST : CREAM); if (i < nx) sprig(x + (w - 2 * bm) / nx / 2, y, step * .2, i % 2 ? .5 : -.5, SAGE); }
  for (let i = 1; i < ny; i++) for (const x of [bm, w - bm]) { const y = bm + (h - 2 * bm) * i / ny; rosette(x, y, step * .36, i % 2 ? CREAM : RUST, i % 2 ? RUST : CREAM); sprig(x, y + (h - 2 * bm) / ny / 2, step * .2, Math.PI / 2 + (i % 2 ? .5 : -.5), SAGE); }
  // The field: a close lattice of small flowers, buds between them.
  g.save(); g.beginPath(); g.rect(B, B, w - 2 * B, h - 2 * B); g.clip();
  const cell = w * .054;
  for (let j = 0, y = B + cell * .3; y < h - B + cell; y += cell * .8, j++) for (let x = B + (j % 2 ? cell : cell / 2); x < w - B + cell; x += cell) {
    const k = (j * 3 + Math.round(x / cell)) % 5;
    g.strokeStyle = 'rgba(44,30,40,.5)'; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(x - cell / 2, y); g.lineTo(x, y - cell * .4); g.lineTo(x + cell / 2, y); g.lineTo(x, y + cell * .4); g.closePath(); g.stroke();
    rosette(x, y, cell * .26, [CREAM, SAND, PLUM, SAGE, INK][k], [PLUM, INK, CREAM, RUST, SAND][k], k % 2 ? 6 : 8);
    g.fillStyle = [RUST, CREAM, SAND, INK, CREAM][k]; g.beginPath(); g.arc(x - cell / 2, y, cell * .05, 0, TAU); g.fill();
  }
  // The medallion: stepped diamonds, one inside the other.
  const cx = w / 2, cy = h / 2, diamond = (sx, sy, col) => {
    g.fillStyle = col; g.beginPath();
    const n = 9;
    for (let q = 0; q < 4; q++) for (let i = 0; i <= n; i++) {
      const t = i / n, [ax, ay, bx, by] = [[0, -1, 1, 0], [1, 0, 0, 1], [0, 1, -1, 0], [-1, 0, 0, -1]][q];
      const x0 = cx + (ax + (bx - ax) * t) * sx, y0 = cy + (ay + (by - ay) * t) * sy, x1 = cx + (ax + (bx - ax) * Math.min(1, t + 1 / n)) * sx;
      if (!q && !i) g.moveTo(x0, y0); else g.lineTo(x0, y0);
      g.lineTo(q % 2 ? x0 : x1, q % 2 ? cy + (ay + (by - ay) * Math.min(1, t + 1 / n)) * sy : y0);
    }
    g.closePath(); g.fill();
  };
  g.globalAlpha = .9;
  diamond(w * .26, h * .22, INK); diamond(w * .238, h * .202, CREAM); diamond(w * .225, h * .19, PLUM);
  g.globalAlpha = .82;
  // (Flowers on the medallion's plum ground too.)
  for (let a = 0; a < 12; a++) { const t = a / 12 * TAU; rosette(cx + Math.cos(t) * w * .15, cy + Math.sin(t) * h * .125, cell * .26, a % 2 ? CREAM : SAND, a % 2 ? RUST : INK); }
  diamond(w * .115, h * .096, CREAM); diamond(w * .1, h * .084, INK); diamond(w * .085, h * .07, RUST);
  rosette(cx, cy, w * .05, CREAM, INK, 12);
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const x = sx < 0 ? B : w - B, y = sy < 0 ? B : h - B;
    g.fillStyle = INK; g.beginPath(); g.moveTo(x, y); g.lineTo(x - sx * w * .2, y); g.lineTo(x, y - sy * h * .15); g.closePath(); g.fill();
    g.fillStyle = PLUM; g.beginPath(); g.moveTo(x, y); g.lineTo(x - sx * w * .17, y); g.lineTo(x, y - sy * h * .127); g.closePath(); g.fill();
    rosette(x - sx * w * .05, y - sy * h * .036, w * .028, CREAM, RUST); rosette(x - sx * w * .115, y - sy * h * .02, w * .016, SAND, INK); rosette(x - sx * w * .025, y - sy * h * .088, w * .016, SAND, INK);
  }
  g.restore();
  g.globalAlpha = 1;
  // Age: bands where a batch of wool took the dye differently, worn
  // patches down to the pale warp, a wash of dust, and the weave itself.
  g.fillStyle = 'rgba(128,98,92,.2)'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 11; i++) { g.fillStyle = `rgba(${r() < .5 ? '216,190,160' : '60,36,40'},${.04 + r() * .08})`; g.fillRect(0, r() * h, w, 20 + r() * 140); }
  for (let i = 0; i < 30; i++) { const x = r() * w, y = r() * h, s = 40 + r() * 150, gr = g.createRadialGradient(x, y, 0, x, y, s); gr.addColorStop(0, `rgba(196,176,150,${.12 + r() * .2})`); gr.addColorStop(1, 'rgba(196,176,150,0)'); g.fillStyle = gr; g.fillRect(x - s, y - s, 2 * s, 2 * s); }
  for (let y = 0; y < h; y += 3) { g.fillStyle = `rgba(40,24,20,${.04 + r() * .09})`; g.fillRect(0, y, w, 1); }
  for (let x = 0; x < w; x += 3) { g.fillStyle = `rgba(255,240,215,${r() * .05})`; g.fillRect(x, 0, 1, h); }
}
// The fringe at a rug's end: strands of undyed wool, knotted in bunches.
function drawFringe(g, w, h) {
  const r = rng(310);
  g.clearRect(0, 0, w, h);
  for (let x = 2; x < w; x += 5) {
    g.strokeStyle = ['#d9cbab', '#cdbd98', '#e3d7bb'][Math.floor(r() * 3)]; g.lineWidth = 2.2;
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (r() - .5) * 5, h * (.7 + r() * .3)); g.stroke();
  }
  g.fillStyle = '#cfc09c'; g.fillRect(0, 0, w, 5);
}
// A chunky cream knit, for the throw.
function drawKnit(g, w, h) {
  g.fillStyle = '#cdbb9a'; g.fillRect(0, 0, w, h);
  const n = 16, cw = w / n;
  for (let i = 0; i < n; i++) for (let y = 0; y < h; y += 10) {
    for (const s of [-1, 1]) {
      g.strokeStyle = 'rgba(110,90,62,.55)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(i * cw + cw / 2, y + 10); g.lineTo(i * cw + cw / 2 + s * cw * .42, y); g.stroke();
      g.strokeStyle = 'rgba(240,230,208,.7)'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(i * cw + cw / 2 + s * 2, y + 9); g.lineTo(i * cw + cw / 2 + s * cw * .36, y + 1); g.stroke();
    }
  }
}
// A red wool cushion cover with a small ochre and indigo figure.
function drawPaisley(g, w, h) {
  const r = rng(311);
  drawLinen(g, w, h, {base: '#7e2f2a', dark: .12, seed: 84});
  const n = 5, c = w / n;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = (i + (j % 2 ? .5 : 0)) * c + c / 2, y = j * c + c / 2;
    for (const ox of [0, -w]) {
      g.save(); g.translate(x + ox, y); g.rotate((i + j) % 2 ? .5 : -.5);
      g.fillStyle = '#c59a4e'; g.beginPath(); g.ellipse(0, 0, c * .2, c * .32, 0, 0, TAU); g.fill();
      g.fillStyle = '#2f3550'; g.beginPath(); g.ellipse(0, c * .04, c * .11, c * .2, 0, 0, TAU); g.fill();
      g.fillStyle = '#e5d3ac'; g.beginPath(); g.arc(0, c * .08, c * .045, 0, TAU); g.fill();
      g.restore();
    }
  }
  for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(40,12,10,${r() * .18})`; g.fillRect(r() * w, r() * h, 2, 2); }
}
// The painting: an original abstract. Big slabs of navy and near-black, a
// field of chalky cream, a stroke of rust-red down one side, a little
// ochre: laid on in knife-loads and dragged, the canvas showing between.
function drawPainting(g, w, h) {
  const r = rng(312);
  g.fillStyle = '#e4d9c2'; g.fillRect(0, 0, w, h);
  const slab = (x0, y0, x1, y1, cols, n = 150, a = .5) => {
    for (let i = 0; i < n; i++) {
      const x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0), sw = (x1 - x0) * (.18 + r() * .4), sh = (y1 - y0) * (.05 + r() * .16);
      g.save(); g.translate(x, y); g.rotate((r() - .5) * .16);
      g.globalAlpha = a + r() * (1 - a);
      g.fillStyle = cols[Math.floor(r() * cols.length)];
      g.fillRect(-sw / 2, -sh / 2, sw, sh);
      // (The dragged edge.)
      g.globalAlpha = .25; g.fillStyle = '#f2ead8';
      for (let k = 0; k < 3; k++) g.fillRect(-sw / 2 + r() * sw * .7, -sh / 2 + r() * sh, sw * .3, 1.2);
      g.restore();
    }
    g.globalAlpha = 1;
  };
  slab(0, 0, w, h, ['#e9dfc9', '#ddd0b6', '#efe7d6', '#d6c8ab'], 260, .35);
  slab(w * .04, h * .05, w * .5, h * .56, ['#1c2a44', '#22345a', '#182238', '#2c4068'], 220);
  slab(w * .28, h * .36, w * .8, h * .93, ['#141a26', '#1b2233', '#101520', '#232c42'], 240);
  slab(w * .46, h * .1, w * .86, h * .5, ['#eee5d2', '#e3d8c0', '#f4eddd'], 150, .55);
  slab(w * .82, h * .08, w * .96, h * .78, ['#a33a22', '#b5482a', '#8e2f1c'], 110, .6);
  slab(w * .05, h * .66, w * .3, h * .95, ['#a33a22', '#96341f', '#b9502e'], 80, .55);
  slab(w * .5, h * .56, w * .72, h * .72, ['#c89a4a', '#b8873c'], 30, .5);
  slab(w * .08, h * .5, w * .34, h * .62, ['#7d93a8', '#64798e'], 30, .4);
  // Canvas weave and a little craquelure.
  for (let y = 0; y < h; y += 3) { g.fillStyle = `rgba(30,24,16,${r() * .06})`; g.fillRect(0, y, w, 1); }
  for (let x = 0; x < w; x += 3) { g.fillStyle = `rgba(255,248,232,${r() * .05})`; g.fillRect(x, 0, 1, h); }
}
// One flame.
function drawFlame(g, w, h) {
  g.clearRect(0, 0, w, h);
  g.filter = 'blur(3px)';
  const grad = g.createLinearGradient(0, h, 0, 0);
  grad.addColorStop(0, 'rgba(255,240,200,1)'); grad.addColorStop(.25, 'rgba(255,200,90,.95)'); grad.addColorStop(.6, 'rgba(255,120,30,.7)'); grad.addColorStop(1, 'rgba(200,60,10,0)');
  g.fillStyle = grad;
  g.beginPath(); g.moveTo(w * .5, h * .04);
  g.bezierCurveTo(w * .62, h * .35, w * .95, h * .55, w * .82, h * .85);
  g.bezierCurveTo(w * .72, h * .99, w * .28, h * .99, w * .18, h * .85);
  g.bezierCurveTo(w * .05, h * .55, w * .4, h * .4, w * .5, h * .04);
  g.fill();
  g.filter = 'none';
}
