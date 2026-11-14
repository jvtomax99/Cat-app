// Outside the kitchen's glazing, built in 3D so it holds up from any
// camera: the paving runs out to a low limestone wall, olive trees stand in
// terracotta pots in front of it, and beyond it two rows of dunes with
// tufts of beach grass roll away to the beach. The sky, sea and beach are
// the sheet from window-view.js, standing at the far end of the dunes.
//
// Nothing here is lit by the kitchen's lamps: light and shade are painted
// in, and by night everything is tinted dark and blue with the sky.
import * as THREE from 'three';
import {windowView, rng, tuft, GRASS} from './window-view.js';

const TAU = Math.PI * 2, SUN = new THREE.Vector3(.45, .75, -.5).normalize();
const hex = c => new THREE.Color(c);

function texture(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}
// Shade a shape by its own form: each point's colour is `base`, lighter
// where it faces the sun.
function shade(geo, base, {lo = .7, hi = 1.06, tone = null, sun = SUN} = {}) {
  geo.computeVertexNormals();
  const n = geo.attributes.normal, p = geo.attributes.position, col = [], c = new THREE.Color(), v = new THREE.Vector3();
  for (let i = 0; i < n.count; i++) {
    const k = lo + (hi - lo) * Math.max(0, v.fromBufferAttribute(n, i).dot(sun) * .5 + .5);
    c.copy(tone ? tone(v.fromBufferAttribute(p, i)) : base).multiplyScalar(k);
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return geo;
}

// Two courses of limestone blocks, for a stretch of wall 2.2 long.
function drawBlocks(g, w, h) {
  const r = rng(74);
  for (let row = 0; row < 2; row++) for (let i = -1; i < 3; i++) {
    const x = (i + row * .5) * w / 2, y = row * h / 2;
    g.fillStyle = ['#d9cbb0', '#d2c3a6', '#dfd2b8', '#cfbfa0'][Math.floor(r() * 4)];
    g.fillRect(x, y, w / 2, h / 2);
    g.fillStyle = 'rgba(120,100,70,.3)'; g.fillRect(x, y, 3, h / 2); g.fillRect(x, y + h / 2 - 3, w / 2, 3);
    g.fillStyle = 'rgba(255,250,235,.3)'; g.fillRect(x + 3, y, w / 2 - 3, 3);
  }
  for (let i = 0; i < 500; i++) { g.fillStyle = r() < .5 ? 'rgba(255,250,235,.12)' : 'rgba(110,90,60,.1)'; g.fillRect(r() * w, r() * h, 2 + r() * 5, 1.5); }
  // (The wall's foot is in soft shade.)
  const foot = g.createLinearGradient(0, h, 0, h * .6); foot.addColorStop(0, 'rgba(90,76,56,.35)'); foot.addColorStop(1, 'rgba(90,76,56,0)');
  g.fillStyle = foot; g.fillRect(0, 0, w, h);
}
// A spray of olive leaves: loose, with gaps, dark inside and silvery where
// the sun catches it. Many of these, turned every way, make a crown.
function drawSpray(g, w, h) {
  const r = rng(75), leaves = [], clumps = [];
  for (let i = 0; i < 9; i++) { const a = r() * TAU, d = Math.sqrt(r()) * .3; clumps.push([.5 + Math.cos(a) * d, .5 + Math.sin(a) * d]); }
  for (let i = 0; i < 520; i++) {
    const [bx, by] = clumps[Math.floor(r() * clumps.length)], a = r() * TAU, d = r() * .17;
    const x = bx + Math.cos(a) * d, y = by + Math.sin(a) * d;
    leaves.push([x, y, .5 + (.5 - y) * 1.1 - (x - .5) * .5 + (r() - .5) * .6, r() * 3.14]);
  }
  leaves.sort((p, q) => p[2] - q[2]);
  for (const [x, y, lit, rot] of leaves) {
    g.fillStyle = ['#4c5a3a', '#5d6b45', '#75835a', '#8f9b72', '#aab38c', '#c3c9a8'][Math.max(0, Math.min(5, Math.floor(lit * 6)))];
    g.beginPath(); g.ellipse(x * w, y * h, .05 * w, .014 * w, rot, 0, TAU); g.fill();
  }
}
function drawTuft(g, w, h) {
  g.setTransform(w, 0, 0, -h, 0, h);
  tuft(g, rng(76), .5, .03, .8, GRASS, 40);
}

// Upright cards with a picture on, joined into one shape: [x, y, z, size,
// turn, tint] each; `cross` adds a second card across the first.
function cards(list, {cross = false, foot = false} = {}) {
  const pos = [], uv = [], col = [], idx = [];
  for (const [x, y, z, s, turn, k, tilt = 0] of list) for (const a of cross ? [turn, turn + Math.PI / 2] : [turn]) {
    const dx = Math.cos(a) * s / 2, dz = Math.sin(a) * s / 2, y0 = foot ? y : y - s / 2 * Math.cos(tilt), i = pos.length / 3;
    // (A seventh number leans the card back: its top edge moves off across it.)
    const ux = -Math.sin(a) * Math.sin(tilt) * s, uy = Math.cos(tilt) * s, uz = Math.cos(a) * Math.sin(tilt) * s, bx = foot ? 0 : -ux / 2, bz = foot ? 0 : -uz / 2;
    pos.push(x - dx + bx, y0, z - dz + bz, x + dx + bx, y0, z + dz + bz, x + dx + bx + ux, y0 + uy, z + dz + bz + uz, x - dx + bx + ux, y0 + uy, z - dz + bz + uz);
    uv.push(0, 0, 1, 0, 1, 1, 0, 1);
    for (let j = 0; j < 4; j++) col.push(k[0], k[1], k[2]);
    idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  return geo;
}

// How high the dunes stand, `u` beyond the wall and `z` along it: flat at
// the wall, a first crest about 4 out, a higher one about 10 out.
export function duneHeight(u, z) {
  const s = Math.min(1, Math.max(0, u / 1.4)), rise = s * s * (3 - 2 * s);
  const a = 1.25 * (1 + .25 * Math.sin(z * .5 + 2)) * Math.exp(-(((u - 4 - 1.2 * Math.sin(z * .21)) / 1.9) ** 2));
  const b = 1.75 * (1 + .2 * Math.sin(z * .31)) * Math.exp(-(((u - 10 + 1.5 * Math.sin(z * .17 + 1)) / 2.6) ** 2));
  return rise * (.3 + a + b + .1 * Math.sin(z * 1.3 + u * .9));
}

// `x`: the glazing; `zc`: its middle. `wallOut`: how far out the terrace
// wall stands; `far`: where the dunes end and the sky's sheet stands.
export function buildTerrace({x, zc, wallOut = 4.4, far = 18, long = 46, anisotropy = 4}) {
  const group = new THREE.Group(), tinted = [], r = rng(77);
  const basic = o => { const m = new THREE.MeshBasicMaterial({toneMapped: false, ...o}); tinted.push(m); return m; };
  const add = (geo, mat, px = 0, py = 0, pz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); group.add(m); return m; };

  // The sky, sea and beach, far off.
  const view = windowView(120, 64, 'terrace', {anisotropy});
  view.mesh.position.set(x - far, 14, zc); view.mesh.rotation.y = Math.PI / 2; group.add(view.mesh);

  // The wall and its cap stone.
  const wx = x - wallOut - .2;
  add(new THREE.BoxGeometry(.4, .8, long), basic({map: texture(512, 128, drawBlocks, [long / 2.2, 1])}), wx, .4, zc);
  add(shade(new THREE.BoxGeometry(.52, .1, long), hex('#ece1c9'), {lo: .86, hi: 1.05}), basic({vertexColors: true}), wx, .85, zc);

  // The dunes.
  const deep = far - wallOut - .4, nx = 44, nz = 110, ground = new THREE.PlaneGeometry(deep, long, nx, nz);
  ground.rotateX(-Math.PI / 2);
  const gp = ground.attributes.position;
  for (let i = 0; i < gp.count; i++) gp.setY(i, duneHeight(deep / 2 - gp.getX(i), gp.getZ(i)));
  const sandLo = hex('#d9bf88'), sandHi = hex('#f3e4bb'), mix = new THREE.Color();
  shade(ground, null, {lo: .5, hi: 1.12, sun: new THREE.Vector3(-.8, .55, -.25).normalize(), tone: p => mix.copy(sandLo).lerp(sandHi, Math.min(1, p.y / 1.8)).multiplyScalar(.97 + .06 * Math.sin(p.x * 31.7 + p.z * 17.3) * Math.sin(p.z * 23.1))});
  add(ground, basic({vertexColors: true}), wx - .2 - deep / 2, 0, zc);
  // Beach grass: crossed cards, thick on the crests and thin in the hollows.
  const tufts = [], shades = [[1, 1, 1], [.84, .9, .74], [1.12, 1.02, .78], [.74, .8, .62], [1.1, .96, .7], [.95, 1, .85]];
  while (tufts.length < 760) {
    const u = .5 + r() * (deep - .6), z = (r() - .5) * (long - 2), h = duneHeight(u, z);
    if (r() > .12 + h * .45) continue;
    tufts.push([wx - .2 - u, h - .04, zc + z, .4 + r() * r() * .9, r() * 3.14, shades[Math.floor(r() * 6)], (r() - .5) * .5]);
  }
  add(cards(tufts, {cross: true, foot: true}), basic({map: texture(256, 256, drawTuft), vertexColors: true, alphaTest: .35, side: THREE.DoubleSide}));

  // Olive trees in pots, in front of the wall.
  const spray = basic({map: texture(512, 512, drawSpray), vertexColors: true, alphaTest: .4, side: THREE.DoubleSide});
  const clay = basic({vertexColors: true}), bark = basic({vertexColors: true});
  const shadowMat = new THREE.MeshBasicMaterial({transparent: true, depthWrite: false, toneMapped: false, map: texture(128, 128, (g, w) => { const s = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); s.addColorStop(0, 'rgba(70,58,44,.55)'); s.addColorStop(1, 'rgba(70,58,44,0)'); g.fillStyle = s; g.fillRect(0, 0, w, w); })});
  const crowns = [];
  for (const [dz, s, dx] of [[-3.0, 1.3, .85], [.9, 1.0, .7], [3.5, 1.36, .9]]) {
    const tree = new THREE.Group(); tree.position.set(x - wallOut + dx - .1, 0, zc + dz); tree.scale.setScalar(s); group.add(tree);
    const terracotta = hex('#c67d52'), soil = hex('#4a3a2c');
    const pot = shade(new THREE.LatheGeometry([[0, 0], [.37, 0], [.52, .82], [.56, .84], [.56, .95], [.47, .95], [.45, .9], [0, .9]].map(([a, b]) => new THREE.Vector2(a, b)), 28), null, {lo: .66, hi: 1.08, tone: p => p.y > .89 && Math.hypot(p.x, p.z) < .46 ? soil : terracotta});
    tree.add(new THREE.Mesh(pot, clay));
    const top = new THREE.Vector3(.06, 2.95, 0), grey = hex('#8a8170');
    const limb = (pts, rad) => tree.add(new THREE.Mesh(shade(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, rad, 6), grey, {lo: .62, hi: 1.12}), bark));
    limb([new THREE.Vector3(0, .88, 0), new THREE.Vector3(.05, 1.6, .03), new THREE.Vector3(-.03, 2.3, -.02), top], .055);
    const crown = new THREE.Group(); crown.position.copy(top); tree.add(crown);
    const sprays = [];
    for (let i = 0; i < 46; i++) {
      // (Within a ball, a little wider than tall.)
      const a = r() * TAU, up = r(), wide = Math.sin(Math.PI * (.12 + up * .82)), d = Math.sqrt(r()) * 1.05 * wide, px = Math.cos(a) * d, pz = Math.sin(a) * d, py = .05 + up * 1.5;
      // (Lighter on top and on the sunny side.)
      const k = .6 + .42 * up + .12 * (px * SUN.x + pz * SUN.z) + .1 * d;
      sprays.push([px, py, pz, .75 + r() * .45, r() * 3.14, [k, k, k], (r() - .5) * 2.2]);
      if (i < 6) limb([top.clone().add(new THREE.Vector3(0, -.3, 0)), top.clone().add(new THREE.Vector3(px * .5, py * .5, pz * .5)), top.clone().add(new THREE.Vector3(px * .9, py * .9, pz * .9))], .02);
    }
    const leaves = new THREE.Mesh(cards(sprays), spray); crown.add(leaves); crowns.push(leaves);
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), shadowMat); sh.rotation.x = -Math.PI / 2; sh.position.set(.35, .006 / s, -.45); tree.add(sh);
  }

  const tint = new THREE.Color();
  return {
    group, view,
    update(dt, t, night) {
      view.setMood(night ? 1 : 0); view.update(dt, t);
      // As the sheet's shader tints its own pictures by night.
      const n = view.night();
      tint.setRGB(1 - .84 * n, 1 - .8 * n, 1 - .67 * n, THREE.SRGBColorSpace);
      for (const m of tinted) m.color.copy(tint);
      shadowMat.opacity = 1 - .6 * n;
      crowns.forEach((c, i) => { c.rotation.z = Math.sin(t * .7 + i * 2) * .012; c.rotation.x = Math.sin(t * .53 + i) * .01; });
    },
  };
}
