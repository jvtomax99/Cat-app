// The house from outside (phase 21 step 5): the House view's pale walls,
// slate roofs and front door, drawn round the rooms as the blueprint's
// "From the front" shows (docs/house/blueprint.png).
//
// Built in the house frame (house.js: the study's own frame, x east, z
// south, the sea to the north). Three blocks:
//   - the living room, one storey, flat roof, glazing to the sea and at its end;
//   - the middle (kitchen and hall, bedroom and landing over them), two
//     storeys, a pitched slate roof, the front door in the hall's wall;
//   - the study with the bathroom over it, its own pitched roof and the
//     chimney of the study's fire.
// Wall lines are the rooms' inside lines (from the phase brief's "Facts")
// plus the walls' thickness outwards. Opaque glass: from out here the
// rooms are not drawn (the app hides them in this view), so nothing has to
// show through. Every piece is merged per material: a handful of draw calls.
// The app moves `group` round the room she's in (placeOf('room', here)).
import * as THREE from 'three';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';

const T = .45;                       // a wall's thickness
const UP = 10, TOP = 19.5;           // the upper floor; the upper walls' top
// The rooms' inside lines in the house frame.
export const BLOCKS = {
  living: {x0: -33.05, x1: -19.05, z0: -9.9, z1: 6.1},
  middle: {x0: -19.05, x1: -5.05, z0: -9.9, z1: 11.6},
  study: {x0: -4.6, x1: 4.6, z0: -3.4, z1: 8.6},
};
// The whole house, roofs and chimney included (for the camera's fit).
export const BOUNDS = {x0: -34, x1: 6.8, y0: 0, y1: 29, z0: -10.9, z1: 12.6};
export const MID = {x: -13.6, y: 9, z: .85};

function slateTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#5f6b78'; g.fillRect(0, 0, 128, 128);
  // Courses of slates, each a little lighter or darker, joints staggered.
  for (let row = 0; row < 8; row++) {
    const y = row * 16, off = row % 2 ? 8 : 0;
    for (let x = -off; x < 128; x += 16) {
      const v = 88 + Math.round(Math.sin(row * 7.1 + x * 1.3) * 9);
      g.fillStyle = `rgb(${v},${v + 10},${v + 22})`; g.fillRect(x + 1, y + 1, 14, 14);
    }
    g.fillStyle = 'rgba(30,34,40,.55)'; g.fillRect(0, y + 14, 128, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class HouseShell {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'house-shell';
    const slate = slateTexture(); slate.repeat.set(5, 5);
    this.materials = {
      plaster: new THREE.MeshStandardMaterial({color: 0xeee6d8, roughness: .92}),
      trim: new THREE.MeshStandardMaterial({color: 0xf7f3ec, roughness: .7}),
      steel: new THREE.MeshStandardMaterial({color: 0x23262b, roughness: .5, metalness: .4}),
      glass: new THREE.MeshStandardMaterial({color: 0x8fa9b8, roughness: .12, metalness: .25, emissive: 0xffc37a, emissiveIntensity: 0}),
      slate: new THREE.MeshStandardMaterial({color: 0xffffff, map: slate, roughness: .75}),
      stone: new THREE.MeshStandardMaterial({color: 0xd9cdb9, roughness: .95}),
      door: new THREE.MeshStandardMaterial({color: 0x34424f, roughness: .55}),
      sand: new THREE.MeshStandardMaterial({color: 0xe4d7bd, roughness: 1}),
      paving: new THREE.MeshStandardMaterial({color: 0xd3c6ae, roughness: .95}),
      sea: new THREE.MeshStandardMaterial({color: 0x5a8fa6, roughness: .3, metalness: .1}),
    };
    this.parts = {};
    for (const k of Object.keys(this.materials)) this.parts[k] = [];
    this.buildWalls();
    this.buildRoofs();
    this.buildGround();
    for (const [k, list] of Object.entries(this.parts)) {
      if (!list.length) continue;
      // (Boxes are indexed, the gables' extrusions not: all unindexed to merge.)
      const m = new THREE.Mesh(mergeGeometries(list.map(g => g.index ? g.toNonIndexed() : g)), this.materials[k]);
      m.name = 'shell-' + k; m.matrixAutoUpdate = false; m.updateMatrix();
      this.group.add(m);
      for (const g of list) g.dispose();
    }
    this.parts = null;
  }

  // A box by its corners (house frame), into a material's list.
  box(mat, x0, x1, y0, y1, z0, z1) {
    const g = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0));
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    this.parts[mat].push(g);
    return g;
  }

  // One face of a block: a wall along x (at z from zIn to zOut) or along z
  // (at x from xIn to xOut), from `a` to `b` along it and y0 to y1 up it,
  // with openings {a, b, lo, hi, kind}: 'win' (white frame, a bar down the
  // middle), 'steel' (black glazing bars), 'door' (the front door).
  face(along, a, b, y0, y1, inLine, outLine, holes = []) {
    const put = (mat, s0, s1, h0, h1, d0 = inLine, d1 = outLine) => along === 'x' ? this.box(mat, s0, s1, h0, h1, d0, d1) : this.box(mat, d0, d1, h0, h1, s0, s1);
    // Strips between the openings' edges; in each, plaster where no opening is.
    const cuts = [...new Set([a, b, ...holes.flatMap(h => [h.a, h.b])])].filter(v => v >= a && v <= b).sort((p, q) => p - q);
    for (let i = 0; i < cuts.length - 1; i++) {
      const s0 = cuts[i], s1 = cuts[i + 1], m = (s0 + s1) / 2;
      const inHole = holes.filter(h => h.a <= m && h.b >= m).sort((p, q) => p.lo - q.lo);
      let h = y0;
      for (const o of inHole) { if (o.lo > h) put('plaster', s0, s1, h, o.lo); h = Math.max(h, o.hi); }
      if (y1 > h) put('plaster', s0, s1, h, y1);
    }
    // The openings: glass set back a little, a frame round it.
    const out = Math.sign(outLine - inLine), pane0 = outLine - out * .22, pane1 = outLine - out * .16;
    const fr0 = outLine - out * .2, fr1 = outLine + out * .06, f = .14;
    for (const o of holes) {
      if (o.kind === 'door') {
        put('door', o.a, o.b, o.lo, o.hi, outLine - out * .25, outLine - out * .1);
        put('trim', o.a - f, o.a, o.lo, o.hi + f, fr0, fr1); put('trim', o.b, o.b + f, o.lo, o.hi + f, fr0, fr1); put('trim', o.a - f, o.b + f, o.hi, o.hi + f, fr0, fr1);
        // (The step, and the knob.)
        put('stone', o.a - .4, o.b + .4, 0, .22, outLine, outLine + out * 1.1);
        put('trim', o.b - .45, o.b - .3, o.lo + 2.3, o.hi - 2.55, outLine - out * .1, outLine);
        continue;
      }
      put('glass', o.a, o.b, o.lo, o.hi, pane0, pane1);
      const mat = o.kind === 'steel' ? 'steel' : 'trim', w = o.kind === 'steel' ? .1 : f;
      put(mat, o.a, o.a + w, o.lo, o.hi, fr0, fr1); put(mat, o.b - w, o.b, o.lo, o.hi, fr0, fr1);
      put(mat, o.a, o.b, o.lo, o.lo + w, fr0, fr1); put(mat, o.a, o.b, o.hi - w, o.hi, fr0, fr1);
      // Bars: steel glazing every 1.6 or so with a transom; a window one down the middle.
      if (o.kind === 'steel') {
        const n = Math.max(1, Math.round((o.b - o.a) / 1.6));
        for (let j = 1; j < n; j++) { const s = o.a + (o.b - o.a) * j / n; put('steel', s - .04, s + .04, o.lo, o.hi, fr0, fr1); }
        if (o.transom) put('steel', o.a, o.b, o.transom - .04, o.transom + .04, fr0, fr1);
      } else {
        const s = (o.a + o.b) / 2; put('trim', s - .05, s + .05, o.lo, o.hi, fr0, fr1);
      }
      // (A sill under a window.)
      if (o.kind !== 'steel' && o.lo > .5) put('trim', o.a - .2, o.b + .2, o.lo - .16, o.lo, outLine - out * .1, outLine + out * .25);
    }
  }

  buildWalls() {
    const {living: L, middle: M, study: S} = BLOCKS;
    const win = (c, w, lo, hi) => ({a: c - w / 2, b: c + w / 2, lo, hi, kind: 'win'});
    // The living room: one storey, glazing to the sea (north) and at its far
    // end (west), floor to 8 with a transom at 6.5; the front (south) as the
    // blueprint draws it, three tall windows.
    this.face('x', L.x0 - T, L.x1, 0, 10, L.z0, L.z0 - T, [{a: -32.25, b: -19.85, lo: .15, hi: 8, kind: 'steel', transom: 6.5}]);
    this.face('z', L.z0 - T, L.z1 + T, 0, 10, L.x0, L.x0 - T, [{a: -8.7, b: 4.9, lo: .15, hi: 8, kind: 'steel', transom: 6.5}]);
    this.face('x', L.x0 - T, L.x1, 0, 10, L.z1, L.z1 + T, [win(-30.2, 2.4, .6, 7.6), win(-26.05, 2.4, .6, 7.6), win(-21.9, 2.4, .6, 7.6)]);
    // The middle: two storeys. North: the kitchen's glazing with its garden
    // doors; the bedroom's window over it.
    this.face('x', M.x0 - T, M.x1 + T, 0, TOP + .45, M.z0, M.z0 - T, [
      {a: -17.6, b: -6.5, lo: .15, hi: 8.6, kind: 'steel', transom: 7}, win(-11.55, 6, UP + 1.9, UP + 7.5),
    ]);
    // South: the front door under the landing's window, a window either side.
    this.face('x', M.x0 - T, M.x1 + T, 0, TOP + .45, M.z1, M.z1 + T, [
      {a: -15.3, b: -13.1, lo: .22, hi: 5.2, kind: 'door'}, win(-17.4, 2.2, 1.8, 6.8), win(-9.3, 2.2, 1.8, 6.8),
      win(-14.2, 2.6, UP + 2.2, UP + 6.6), win(-17.6, 2.2, UP + 2.2, UP + 6.6), win(-9.3, 2.2, UP + 2.2, UP + 6.6),
    ]);
    // West: above the living room's roof all along; downstairs only past it (the hall's end).
    this.face('z', M.z0 - T, M.z1 + T, UP, TOP + .45, M.x0, M.x0 - T, [win(-3.9, 2.4, UP + 2.2, UP + 7)]);
    this.face('z', L.z1 + T, M.z1 + T, 0, UP, M.x0, M.x0 - T);
    // East: where the study doesn't stand against it.
    this.face('z', M.z0 - T, S.z0 - T, 0, TOP + .45, M.x1, M.x1 + T);
    this.face('z', S.z1 + T, M.z1 + T, 0, TOP + .45, M.x1, M.x1 + T);
    // The study and the bathroom over it: windows to the sea and the front.
    this.face('x', S.x0 - T, S.x1 + T, 0, TOP + .45, S.z0, S.z0 - T, [win(-2.35, 2.3, 1.62, 5.3), win(2.05, 3, UP + 3.4, UP + 7)]);
    this.face('x', S.x0 - T, S.x1 + T, 0, TOP + .45, S.z1, S.z1 + T, [win(0, 3.2, 1.4, 7.2), win(0, 2.4, UP + 2.4, UP + 6.8)]);
    this.face('z', S.z0 - T, S.z1 + T, 0, TOP + .45, S.x1, S.x1 + T, [win(-.6, 2, UP + 2.6, UP + 6.6)]);
    // A band of trim where the upper floor is, and round the living room's roof.
    for (const [x0, x1, z0, z1] of [[M.x0 - T - .08, M.x1 + T + .08, M.z1 + T, M.z1 + T + .1], [M.x0 - T - .08, M.x1 + T + .08, M.z0 - T - .1, M.z0 - T], [S.x0 - T, S.x1 + T + .08, S.z1 + T, S.z1 + T + .1], [S.x0 - T, S.x1 + T + .08, S.z0 - T - .1, S.z0 - T]]) this.box('trim', x0, x1, UP - .1, UP + .25, z0, z1);
  }

  buildRoofs() {
    const {living: L, middle: M, study: S} = BLOCKS, eave = TOP + .45, over = .55;
    // A gable roof with its ridge along z (north to south, as both gables
    // face the front in the blueprint): two slopes and the two gable ends.
    const gable = (x0, x1, z0, z1, rise) => {
      const xm = (x0 + x1) / 2, half = (x1 - x0) / 2 + over, drop = rise * over / ((x1 - x0) / 2);
      const len = Math.hypot(half, rise + drop), ang = Math.atan2(rise + drop, half);
      for (const s of [-1, 1]) {
        const g = new THREE.BoxGeometry(len, .32, z1 - z0 + over * 2);
        g.rotateZ(s * -ang); g.translate(xm + s * half / 2, eave - drop + (rise + drop) / 2 + .16, (z0 + z1) / 2);
        this.parts.slate.push(g);
      }
      // (The ridge's cap.)
      this.box('stone', xm - .22, xm + .22, eave + rise + .05, eave + rise + .38, z0 - over, z1 + over);
      // The gable ends: plaster triangles in the wall's line.
      for (const [za, zb] of [[z0, z0 + T], [z1 - T, z1]]) {
        const sh = new THREE.Shape([new THREE.Vector2(x0, 0), new THREE.Vector2(x1, 0), new THREE.Vector2(xm, rise)]);
        const g = new THREE.ExtrudeGeometry(sh, {depth: zb - za, bevelEnabled: false});
        g.translate(0, eave, za);
        this.parts.plaster.push(g);
      }
    };
    gable(M.x0 - T, M.x1 + T, M.z0 - T, M.z1 + T, 5.6);
    gable(S.x0 - T, S.x1 + T, S.z0 - T, S.z1 + T, 3.9);
    // The living room's flat roof: a slab and a low parapet in trim.
    this.box('stone', L.x0 - T, L.x1, 10, 10.3, L.z0 - T, L.z1 + T);
    for (const [x0, x1, z0, z1] of [[L.x0 - T, L.x1, L.z0 - T, L.z0 - T + .3], [L.x0 - T, L.x1, L.z1 + T - .3, L.z1 + T], [L.x0 - T, L.x0 - T + .3, L.z0 - T, L.z1 + T]]) this.box('trim', x0, x1, 10, 10.75, z0, z1);
    // The study's chimney, on its east wall over the fire.
    this.box('plaster', S.x1 + T, S.x1 + T + 1.2, 0, eave, 1.0, 4.4);
    this.box('plaster', S.x1 - .9, S.x1 + T + 1.2, eave, eave + 6.6, 1.5, 3.9);
    this.box('trim', S.x1 - 1.05, S.x1 + T + 1.35, eave + 6.6, eave + 6.9, 1.35, 4.05);
    for (const z of [2.2, 3.2]) this.box('stone', S.x1 - .2, S.x1 + .35, eave + 6.9, eave + 7.6, z - .2, z + .2);
  }

  buildGround() {
    // Sand all round; the terrace along the sea side of the kitchen and the
    // living room and round its far end; a path from the front door; the sea.
    this.box('sand', -600, 600, -.08, -.02, -45, 600);
    this.box('paving', -40, -4.6, -.02, .04, -16.5, -10.35);
    this.box('paving', -40, -33.5, -.02, .04, -10.35, 6.55);
    this.box('paving', -15.6, -12.8, -.02, .04, 12.05, 24);
    this.box('sand', -600, 600, -.12, -.06, -60, -45);
    this.box('sea', -600, 600, -.2, -.1, -600, -58);
  }

  // Night: the windows glow warm (the rooms' lamps are on behind them).
  update(night, dt = 1 / 60) {
    const g = this.materials.glass, want = night ? .55 : 0;
    g.emissiveIntensity += (want - g.emissiveIntensity) * (1 - Math.exp(-3 * dt));
  }
}
