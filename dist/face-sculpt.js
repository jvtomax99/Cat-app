// Face surgery on the Meshy model, done once at load time, before rigging.
// The model came with a smooth muzzle (the mouth only painted on), flat
// painted eyes sitting in shallow dishes, and whiskers sculpted as thick,
// webbed clumps. So we:
//   1. cut the whisker clumps out of the mesh and patch the openings they
//      leave in the muzzle pads (fine strands are drawn instead, in
//      real-cat.js addWhiskers),
//   2. refine the mesh around the muzzle and the eyes (conforming 1→4 splits),
//   3. sculpt the muzzle: two rounded pads, a groove under the nose
//      (philtrum), a lip line with the upper lip slightly overhanging, a chin,
//   4. sculpt a rounded eyeball under each eye, so closed lids read as a
//      soft, convex curve rather than a hollow,
//   5. open the lip line into a narrow slit, so the jaw can part the lips and
//      a mouth interior (real-cat.js addMouthInterior) shows through.
// All coordinates are in the GLB's own space (cat faces +z).
import * as THREE from 'three';
import {FACE} from './cat-rig.js';

export const MOUTH = {
  midX: -0.313,
  // Lip line: y at a given distance from the midline. A cat's relaxed mouth
  // is a soft "w": a small peak under the philtrum, dipping either side and
  // curving gently back up at the corners (a corner that drops reads as a
  // frown). real-cat.js paints the same curve.
  seamY: dx => 0.2835 - 0.0058 * fade(Math.abs(dx), 0.002, 0.02) + 0.0022 * fade(Math.abs(dx), 0.02, 0.036),
  halfWidth: 0.034,
  frontZ: 0.86,
};

// Smooth 0→1 step that also works with reversed edges (e0 > e1 fades out).
export const fade = (x, e0, e1) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

// The front of the head sits close to this ellipsoid. Anything on the face
// standing well out in front of it is a sculpted whisker clump.
const SHELL = {c: new THREE.Vector3(-0.313, 0.38, 0.66), r: new THREE.Vector3(0.3, 0.27, 0.27)};
const shellRadius = (x, y, z) => Math.hypot((x - SHELL.c.x) / SHELL.r.x, (y - SHELL.c.y) / SHELL.r.y, (z - SHELL.c.z) / SHELL.r.z);
const CLUMP_R = 0.93;
const inClumpBand = (x, y, z) => z > 0.78 && y > 0.12 && y < 0.45;
// The muzzle pads, where the clumps grew out of the face. Whatever is left
// of their roots is pressed onto a smooth surface fitted to the skin around
// them (then sculpted into rounded pads below).
const padQ = (x, y) => Math.hypot((Math.abs(x - MOUTH.midX) - 0.066) / 0.047, (y - 0.293) / 0.033);
const inPad = (x, y, z) => z > 0.82 && padQ(x, y) < 1;

const inMouth = (x, y, z) => z > 0.8 && Math.abs(x - MOUTH.midX) < 0.085 && y > 0.235 && y < 0.34;
const eyeDist = (x, y, c) => Math.hypot((x - c.x) / FACE.eyeRadius.x, (y - c.y) / FACE.eyeRadius.y);
const inEyes = (x, y, z) => z > 0.76 && Math.min(eyeDist(x, y, FACE.eyeR), eyeDist(x, y, FACE.eyeL)) < 1.7;

const posKey = (pos, i) => Math.round(pos.getX(i) * 1e5) + ',' + Math.round(pos.getY(i) * 1e5) + ',' + Math.round(pos.getZ(i) * 1e5);
function weldIds(pos) {
  const map = new Map(), id = new Int32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const k = posKey(pos, i);
    if (!map.has(k)) map.set(k, i);
    id[i] = map.get(k);
  }
  return id;
}

// Rebuilds a geometry from plain attribute arrays and an index list,
// dropping vertices nothing uses.
function rebuild(template, attrs, index) {
  const used = new Int32Array(attrs[0].data.length / attrs[0].size).fill(-1);
  let n = 0;
  for (const i of index) if (used[i] < 0) used[i] = n++;
  const g = new THREE.BufferGeometry();
  for (const at of attrs) {
    const src = template.attributes[at.name];
    const out = new (src ? src.array.constructor : Float32Array)(n * at.size);
    for (let i = 0; i < used.length; i++) if (used[i] >= 0) for (let c = 0; c < at.size; c++) out[used[i] * at.size + c] = at.data[i * at.size + c];
    g.setAttribute(at.name, new THREE.BufferAttribute(out, at.size, src ? src.normalized : false));
  }
  g.setIndex(new THREE.Uint32BufferAttribute(index.map(i => used[i]), 1));
  return g;
}
const plain = geometry => Object.entries(geometry.attributes).map(([name, a]) => ({name, size: a.itemSize, data: Array.from(a.array)}));

// 1. Whisker clumps out, openings patched. `sampleUV(u, v)` returns the
// texture colour [r, g, b] (0..1, linear) at a UV, for colouring the patches.
function removeWhiskerClumps(geometry, sampleUV) {
  const pos = geometry.attributes.position, uv = geometry.attributes.uv, N = pos.count;
  const clump = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (inClumpBand(x, y, z) && shellRadius(x, y, z) > CLUMP_R) clump[i] = 1;
  }
  markLayers(geometry, clump);
  const src = Array.from(geometry.index.array);
  let kept = [];
  for (let t = 0; t < src.length; t += 3) if (!clump[src[t]] && !clump[src[t + 1]] && !clump[src[t + 2]]) kept.push(src[t], src[t + 1], src[t + 2]);
  // Bits of whisker cut loose from the face go too.
  const w = weldIds(pos);
  const parent = new Int32Array(N).map((_, i) => i);
  const find = i => { while (parent[i] !== i) i = parent[i] = parent[parent[i]]; return i; };
  for (let t = 0; t < kept.length; t += 3) { const a = find(w[kept[t]]); parent[find(w[kept[t + 1]])] = a; parent[find(w[kept[t + 2]])] = a; }
  const size = new Map();
  for (let t = 0; t < kept.length; t += 3) { const r = find(w[kept[t]]); size.set(r, (size.get(r) || 0) + 1); }
  kept = kept.filter((_, k) => {
    const t = k - k % 3, i = kept[t];
    return size.get(find(w[i])) > 1000 || !inClumpBand(pos.getX(i), pos.getY(i), pos.getZ(i));
  });

  // The openings: edges that were shared before and now border one triangle.
  const ek = (a, b) => a < b ? a * 4194304 + b : b * 4194304 + a;
  const count = (list) => { const m = new Map(); for (let t = 0; t < list.length; t += 3) for (let k = 0; k < 3; k++) { const e = ek(w[list[t + k]], w[list[t + (k + 1) % 3]]); m.set(e, (m.get(e) || 0) + 1); } return m; };
  const before = count(src), after = count(kept);
  const next = new Map(), rep = new Map();
  for (let t = 0; t < kept.length; t += 3) for (let k = 0; k < 3; k++) {
    const ia = kept[t + k], ib = kept[t + (k + 1) % 3], a = w[ia], b = w[ib], e = ek(a, b);
    if (after.get(e) !== 1 || before.get(e) !== 2) continue;
    next.set(b, a); // walk opposite to the kept triangle, so patches face out
    rep.set(a, ia); rep.set(b, ib);
  }

  const attrs = plain(geometry);
  attrs.push({name: 'facePatch', size: 1, data: new Array(N).fill(0)});
  attrs.push({name: 'patchColor', size: 3, data: new Array(N * 3).fill(0)});
  const A = Object.fromEntries(attrs.map(a => [a.name, a]));
  const vcount = () => A.position.data.length / 3;
  const addVertex = (copyOf, p, colour) => {
    const n = vcount();
    for (const at of attrs) for (let c = 0; c < at.size; c++) at.data.push(at.data[copyOf * at.size + c]);
    A.position.data.splice(n * 3, 3, p.x, p.y, p.z);
    A.facePatch.data[n] = 1;
    A.patchColor.data.splice(n * 3, 3, ...colour);
    return n;
  };
  const P = i => new THREE.Vector3(A.position.data[3 * i], A.position.data[3 * i + 1], A.position.data[3 * i + 2]);
  const onShell = (p, r) => p.sub(SHELL.c).multiply(_inv.set(1 / SHELL.r.x, 1 / SHELL.r.y, 1 / SHELL.r.z)).setLength(r).multiply(SHELL.r).add(SHELL.c);
  const _inv = new THREE.Vector3();
  const seen = new Set();
  for (const start of next.keys()) {
    if (seen.has(start)) continue;
    const loop = [];
    for (let v = start; !seen.has(v) && next.has(v) && loop.length < 4000; v = next.get(v)) { seen.add(v); loop.push(v); }
    if (loop.length < 3 || next.get(loop[loop.length - 1]) !== start) continue;
    // Patch colour: the average texture colour around the opening.
    const col = [0, 0, 0], centre = new THREE.Vector3();
    let rMean = 0;
    for (const v of loop) {
      const c = sampleUV(uv.getX(rep.get(v)), uv.getY(rep.get(v)));
      col[0] += c[0] / loop.length; col[1] += c[1] / loop.length; col[2] += c[2] / loop.length;
      const p = P(v);
      centre.addScaledVector(p, 1 / loop.length);
      rMean += shellRadius(p.x, p.y, p.z) / loop.length;
    }
    // A tiny opening inside one patch of texture is simply closed with a fan
    // that keeps the texture (it takes the colour of what's around it).
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const v of loop) { const i = rep.get(v); u0 = Math.min(u0, uv.getX(i)); u1 = Math.max(u1, uv.getX(i)); v0 = Math.min(v0, uv.getY(i)); v1 = Math.max(v1, uv.getY(i)); }
    if (loop.length <= 8 && u1 - u0 < 0.02 && v1 - v0 < 0.02) {
      const hub = addVertex(rep.get(loop[0]), centre.clone(), col);
      A.facePatch.data[hub] = 0;
      A.uv.data.splice(hub * 2, 2, (u0 + u1) / 2, (v0 + v1) / 2);
      for (let k = 0; k < loop.length; k++) kept.push(rep.get(loop[k]), rep.get(loop[(k + 1) % loop.length]), hub);
      continue;
    }
    const outer = loop.map(v => addVertex(rep.get(v), P(v), col));
    // Rings stepping in to a centre point, on the face's curve.
    const rings = [outer];
    for (const f of [1 / 3, 2 / 3]) rings.push(loop.map(v => { const p = P(v); return addVertex(rep.get(v), onShell(p.clone().lerp(centre, f), shellRadius(p.x, p.y, p.z) * (1 - f) + rMean * f), col); }));
    const mid = addVertex(rep.get(loop[0]), onShell(centre.clone(), rMean), col);
    for (let j = 0; j < rings.length; j++) {
      const a = rings[j], b = rings[j + 1];
      for (let k = 0; k < loop.length; k++) {
        const k2 = (k + 1) % loop.length;
        if (b) kept.push(a[k], a[k2], b[k2], a[k], b[k2], b[k]);
        else kept.push(a[k], a[k2], mid);
      }
    }
  }
  const g = rebuild(geometry, attrs, kept);
  // Smooth normals over the patches and the skin around them.
  smoothNormals(g, (x, y, z) => inClumpBand(x, y, z) && shellRadius(x, y, z) > 0.84 && shellRadius(x, y, z) < 0.96, () => 1);
  return g;
}

// On the cheeks, flat whisker sheets lie just above the skin. A point counts
// as one if a ray from it toward the middle of the head meets another
// surface within a few millimetres.
function markLayers(geometry, clump) {
  const pos = geometry.attributes.position, idx = geometry.index.array;
  const cheek = (x, y, z) => z > 0.6 && y > 0.16 && y < 0.42 && Math.abs(x - MOUTH.midX) > 0.07;
  const tris = [];
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2];
    if (cheek(pos.getX(a), pos.getY(a), pos.getZ(a)) || cheek(pos.getX(b), pos.getY(b), pos.getZ(b))) tris.push(a, b, c);
  }
  const T = tris.length / 3, tv = new Float32Array(T * 9);
  for (let k = 0; k < T; k++) for (let j = 0; j < 3; j++) { const i = tris[k * 3 + j]; tv[k * 9 + j * 3] = pos.getX(i); tv[k * 9 + j * 3 + 1] = pos.getY(i); tv[k * 9 + j * 3 + 2] = pos.getZ(i); }
  const o = new THREE.Vector3(), d = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), pv = new THREE.Vector3(), tvv = new THREE.Vector3(), qv = new THREE.Vector3();
  const v0 = new THREE.Vector3(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3();
  const centre = new THREE.Vector3(MOUTH.midX, 0.36, 0.55);
  for (let i = 0; i < pos.count; i++) {
    o.fromBufferAttribute(pos, i);
    if (clump[i] || !cheek(o.x, o.y, o.z) || shellRadius(o.x, o.y, o.z) < 0.84) continue;
    d.subVectors(centre, o).normalize();
    for (let k = 0; k < T; k++) {
      v0.fromArray(tv, k * 9); v1.fromArray(tv, k * 9 + 3); v2.fromArray(tv, k * 9 + 6);
      if (v0.distanceToSquared(o) > 0.0016) continue; // only nearby triangles
      e1.subVectors(v1, v0); e2.subVectors(v2, v0);
      pv.crossVectors(d, e2);
      const det = e1.dot(pv);
      if (Math.abs(det) < 1e-12) continue;
      tvv.subVectors(o, v0);
      const u = tvv.dot(pv) / det;
      if (u < 0 || u > 1) continue;
      qv.crossVectors(tvv, e1);
      const v = d.dot(qv) / det;
      if (v < 0 || u + v > 1) continue;
      const t = e2.dot(qv) / det;
      if (t > 0.0012 && t < 0.03) { clump[i] = 1; break; }
    }
  }
}

// 2. One round of red–green refinement: every triangle touching the region
// is split 1→4, and its neighbours are split along the shared edges, so no
// cracks appear. Edges are matched by position, so UV-seam copies split
// together too.
function refine(geometry, region) {
  const attrs = plain(geometry);
  const pos = attrs.find(a => a.name === 'position');
  const index = Array.from(geometry.index.array);
  const w = weldIds(geometry.attributes.position);
  const count = () => pos.data.length / 3;
  const split = new Set();
  const wkey = (a, b) => { const x = w[a] ?? a, y = w[b] ?? b; return x < y ? x * 4194304 + y : y * 4194304 + x; };
  const ikey = (a, b) => a < b ? a * 4194304 + b : b * 4194304 + a;
  for (let t = 0; t < index.length; t += 3) {
    const tri = [index[t], index[t + 1], index[t + 2]];
    if (!tri.some(i => region(pos.data[3 * i], pos.data[3 * i + 1], pos.data[3 * i + 2]))) continue;
    split.add(wkey(tri[0], tri[1])); split.add(wkey(tri[1], tri[2])); split.add(wkey(tri[2], tri[0]));
  }
  const mid = new Map();
  const midpoint = (a, b) => {
    const k = ikey(a, b);
    if (mid.has(k)) return mid.get(k);
    const n = count();
    for (const at of attrs) for (let c = 0; c < at.size; c++) at.data.push((at.data[a * at.size + c] + at.data[b * at.size + c]) / 2);
    mid.set(k, n);
    return n;
  };
  const out = [];
  for (let t = 0; t < index.length; t += 3) {
    const [a, b, c] = [index[t], index[t + 1], index[t + 2]];
    const sab = split.has(wkey(a, b)), sbc = split.has(wkey(b, c)), sca = split.has(wkey(c, a));
    const n = sab + sbc + sca;
    if (n === 0) { out.push(a, b, c); continue; }
    if (n === 3) {
      const ab = midpoint(a, b), bc = midpoint(b, c), ca = midpoint(c, a);
      out.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca);
      continue;
    }
    // Rotate so the split edges come first, keeping winding.
    let v = [a, b, c], s = [sab, sbc, sca];
    while (!(n === 1 ? s[0] : s[0] && s[1])) { v = [v[1], v[2], v[0]]; s = [s[1], s[2], s[0]]; }
    if (n === 1) {
      const m = midpoint(v[0], v[1]);
      out.push(v[0], m, v[2], m, v[1], v[2]);
    } else {
      const m0 = midpoint(v[0], v[1]), m1 = midpoint(v[1], v[2]);
      out.push(m0, v[1], m1, v[0], m0, m1, v[0], m1, v[2]);
    }
  }
  return rebuild(geometry, attrs, out);
}

const gauss = (v, w) => Math.exp(-(v * v) / (2 * w * w));

// 3. Muzzle displacement (model units, along the surface normal).
function mouthHeight(x, y) {
  const dx = x - MOUTH.midX, ax = Math.abs(dx), seam = MOUTH.seamY(dx);
  let h = 0;
  // Muzzle (whisker) pads: two soft mounds either side of the philtrum.
  const px = (ax - 0.028) / 0.024, py = (y - 0.297) / 0.019;
  h += 0.0062 * Math.exp(-(px * px + py * py) * 1.6);
  // Philtrum: a narrow groove from the nose down to the lip.
  if (y > seam && y < 0.316) h -= 0.0026 * gauss(dx, 0.0032) * fade(y, seam, seam + 0.004);
  // Lip line: a fine crease; the upper lip overhangs a touch, the lower lip
  // sits back.
  const lips = 1 - fade(ax, MOUTH.halfWidth - 0.006, MOUTH.halfWidth + 0.006);
  h -= 0.0022 * gauss(y - seam, 0.0016) * lips;
  h += 0.0005 * gauss(y - (seam + 0.004), 0.003) * lips;
  h -= 0.0012 * fade(seam - y, 0.001, 0.008) * (1 - fade(seam - y, 0.012, 0.03)) * lips;
  // Chin: a small rounded bump below the lower lip.
  const cx = dx / 0.022, cy = (y - 0.258) / 0.013;
  h += 0.0042 * Math.exp(-(cx * cx + cy * cy) * 1.4);
  const edge = fade(ax, 0.08, 0.06) * fade(y, 0.236, 0.245) * fade(y, 0.338, 0.33);
  return h * edge;
}

// 4. Eyeballs: the painted eyes sit in flat, slightly sunken discs. Raise a
// rounded dome under each, blending into the rim of the socket.
const EYE_REACH = 1.6;
function eyeHeight(x, y) {
  let h = 0;
  for (const c of [FACE.eyeR, FACE.eyeL]) {
    const r = eyeDist(x, y, c);
    if (r < EYE_REACH) h += 0.009 * Math.pow(1 - (r / EYE_REACH) ** 2, 2);
  }
  return h;
}

export function sculptFace(geometry, sampleUV) {
  let g = removeWhiskerClumps(geometry, sampleUV);
  const padSurface = fitPadSurface(g);
  g = refine(refine(g, (x, y, z) => inMouth(x, y, z) || inPad(x, y, z)), inMouth);
  g = refine(g, inEyes);
  const pos = g.attributes.position, nrm = g.attributes.normal, N = pos.count;
  // Displace along the normal. Copies of a vertex along UV seams share one
  // averaged normal, so they move together and no cracks open.
  const p = new THREE.Vector3(), n = new THREE.Vector3();
  const shared = new Map();
  const sculpted = (x, y, z) => (inMouth(x, y, z) && z > 0.82) || inEyes(x, y, z);
  for (let i = 0; i < N; i++) {
    p.fromBufferAttribute(pos, i);
    if (!sculpted(p.x, p.y, p.z)) continue;
    const k = posKey(pos, i);
    if (!shared.has(k)) shared.set(k, new THREE.Vector3());
    shared.get(k).add(n.fromBufferAttribute(nrm, i).normalize());
  }
  // Each eyeball rises along one direction (the eye's average facing), so
  // the creases of the old socket can't fold the dome.
  const eyeAxis = [FACE.eyeR, FACE.eyeL].map(c => {
    const a = new THREE.Vector3();
    for (let i = 0; i < N; i++) if (pos.getZ(i) > 0.76 && eyeDist(pos.getX(i), pos.getY(i), c) < 1) a.add(n.fromBufferAttribute(nrm, i));
    return a.normalize();
  });
  const moved = [];
  for (let i = 0; i < N; i++) {
    p.fromBufferAttribute(pos, i);
    if (!sculpted(p.x, p.y, p.z)) continue;
    n.copy(shared.get(posKey(pos, i))).normalize();
    const hm = inMouth(p.x, p.y, p.z) && p.z > 0.82 ? mouthHeight(p.x, p.y) : 0;
    const he = inEyes(p.x, p.y, p.z) ? eyeHeight(p.x, p.y) : 0;
    const axis = eyeAxis[eyeDist(p.x, p.y, FACE.eyeR) < eyeDist(p.x, p.y, FACE.eyeL) ? 0 : 1];
    moved.push([i, p.x + n.x * hm + axis.x * he, p.y + n.y * hm + axis.y * he, p.z + n.z * hm + axis.z * he]);
  }
  for (const [i, x, y, z] of moved) pos.setXYZ(i, x, y, z);
  pressPads(g, padSurface);
  // Pressed flat, the folds left from the clump roots face backwards and
  // flicker against the pad (the model is double-sided). Drop them, and any
  // other backward fold on the front of the muzzle: the forward-facing
  // surface already covers it.
  {
    const idx = Array.from(g.index.array), keep = [], a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (let t = 0; t < idx.length; t += 3) {
      a.fromBufferAttribute(pos, idx[t]); b.fromBufferAttribute(pos, idx[t + 1]); c.fromBufferAttribute(pos, idx[t + 2]);
      const inside = [a, b, c].every(v => (v.z > 0.8 && padQ(v.x, v.y) < 0.98) || (v.z > 0.85 && inMouth(v.x, v.y, v.z)));
      if (inside && b.clone().sub(a).cross(c.clone().sub(a)).z <= 0) continue;
      keep.push(idx[t], idx[t + 1], idx[t + 2]);
    }
    g.setIndex(new THREE.Uint32BufferAttribute(keep, 1));
  }
  // 5. Open the lip line: drop the thin band of triangles that straddle it.
  const index = Array.from(g.index.array), kept = [], cut = [];
  for (let t = 0; t < index.length; t += 3) {
    const tri = [index[t], index[t + 1], index[t + 2]];
    let above = 0, below = 0, front = true;
    for (const i of tri) {
      const dx = pos.getX(i) - MOUTH.midX;
      if (pos.getZ(i) < MOUTH.frontZ || Math.abs(dx) > MOUTH.halfWidth - 0.002) front = false;
      if (pos.getY(i) > MOUTH.seamY(dx)) above++; else below++;
    }
    if (front && above && below) { cut.push(...tri); continue; }
    kept.push(...tri);
  }
  g.setIndex(new THREE.Uint32BufferAttribute(kept, 1));
  // The cut follows triangle edges, so its edges zigzag. Snap every point on
  // them onto the lip line itself (a hair above or below), so the closed
  // mouth is one clean, fine line.
  const onCut = new Set(cut.map(i => posKey(pos, i))), inKept = new Set();
  for (const i of kept) if (onCut.has(posKey(pos, i))) inKept.add(i);
  for (const i of inKept) {
    const dx = pos.getX(i) - MOUTH.midX, seam = MOUTH.seamY(dx);
    pos.setY(i, seam + (pos.getY(i) > seam ? 0.00025 : -0.00025));
  }
  // New normals where the surface changed, blended into the originals at the
  // rim of each region.
  smoothNormals(g, inMouth, (x, y, z) => fade(Math.abs(x - MOUTH.midX), 0.085, 0.07) * fade(y, 0.235, 0.245) * fade(y, 0.34, 0.33) * fade(z, 0.8, 0.82) * fade(padQ(x, y), 0.7, 1));
  smoothNormals(g, inEyes, (x, y) => fade(Math.min(eyeDist(x, y, FACE.eyeR), eyeDist(x, y, FACE.eyeL)), 1.7, 1.5));
  return g;
}

// The pads' smooth surface: a height field z(x, y) interpolated from the
// clean skin in a band around each pad.
function fitPadSurface(g) {
  const pos = g.attributes.position, rim = [];
  const seen = new Set();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), q = padQ(x, y);
    if (z < 0.8 || q < 1 || q > 1.4 || g.attributes.facePatch.getX(i) > 0) continue;
    const k = posKey(pos, i);
    if (seen.has(k)) continue;
    seen.add(k);
    rim.push([x, y, z]);
  }
  return (x, y) => {
    let sw = 0, sz = 0;
    for (const [rx, ry, rz] of rim) {
      if ((rx - MOUTH.midX) * (x - MOUTH.midX) < 0) continue; // same side only
      const d2 = (rx - x) ** 2 + (ry - y) ** 2 + 1e-7, w = 1 / (d2 * d2);
      sw += w; sz += w * rz;
    }
    return sz / sw;
  };
}

// Final pad surface = fitted skin + the sculpted mounds; vertices are moved
// onto it (fully inside, blending out at the rim) and get its normal, so
// any folds left from the clump roots lie flat and shade smoothly.
function pressPads(g, surface) {
  const pos = g.attributes.position, nrm = g.attributes.normal;
  const Z = (x, y) => surface(x, y) + mouthHeight(x, y);
  const e = 0.0015, n = new THREE.Vector3(), o = new THREE.Vector3();
  const cache = new Map();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (z < 0.8) continue;
    const q = padQ(x, y);
    if (q >= 1) continue;
    const w = fade(q, 1, 0.7);
    const k = Math.round(x * 1e5) + ',' + Math.round(y * 1e5);
    if (!cache.has(k)) {
      const z0 = Z(x, y);
      cache.set(k, [z0, new THREE.Vector3(-(Z(x + e, y) - Z(x - e, y)) / (2 * e), -(Z(x, y + e) - Z(x, y - e)) / (2 * e), 1).normalize()]);
    }
    const [z0, nz] = cache.get(k);
    pos.setZ(i, z + (z0 - z) * w);
    n.copy(nz);
    o.fromBufferAttribute(nrm, i).lerp(n, w).normalize();
    nrm.setXYZ(i, o.x, o.y, o.z);
  }
}

// Recompute normals inside a region, welding UV-seam duplicates so no
// shading seams appear; `blend` (0..1) mixes toward the original normals.
function smoothNormals(g, region, blend) {
  const pos = g.attributes.position, nrm = g.attributes.normal, idx = g.index, N = pos.count;
  const id = weldIds(pos);
  const acc = new Float32Array(N * 3);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), fn = new THREE.Vector3();
  for (let t = 0; t < idx.count; t += 3) {
    const i0 = idx.getX(t), i1 = idx.getX(t + 1), i2 = idx.getX(t + 2);
    a.fromBufferAttribute(pos, i0); b.fromBufferAttribute(pos, i1); c.fromBufferAttribute(pos, i2);
    if (!region(a.x, a.y, a.z) && !region(b.x, b.y, b.z) && !region(c.x, c.y, c.z)) continue;
    fn.subVectors(c, b).cross(a.clone().sub(b));
    for (const i of [i0, i1, i2]) { acc[id[i] * 3] += fn.x; acc[id[i] * 3 + 1] += fn.y; acc[id[i] * 3 + 2] += fn.z; }
  }
  for (let i = 0; i < N; i++) {
    a.fromBufferAttribute(pos, i);
    if (!region(a.x, a.y, a.z)) continue;
    const w = id[i] * 3;
    fn.set(acc[w], acc[w + 1], acc[w + 2]);
    if (fn.lengthSq() < 1e-14) continue;
    fn.normalize();
    b.fromBufferAttribute(nrm, i).lerp(fn, blend(a.x, a.y, a.z)).normalize();
    nrm.setXYZ(i, b.x, b.y, b.z);
  }
}
