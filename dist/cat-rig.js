// Builds a cat skeleton inside the static Meshy ragdoll model and computes
// skin weights, so the realistic textured mesh can be posed and animated.
//
// All landmark coordinates are in the GLB's own space (metres, cat facing +z,
// ground at y = -0.628) and were measured on assets/mochi-ragdoll.glb.
// The model stands slightly curved, with its left hind leg stepped out and its
// tail wrapped along its left haunch; REST_FIX straightens it at runtime.
import * as THREE from 'three';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export let GROUND_Y = -0.628;
export let MIDLINE_X = -0.313;

// name: [parent, position, end (for leaves / weighting)]
export const BONES = {
  hips:      [null,       V(-0.20, 0.00, -0.48)],
  spine:     ['hips',     V(-0.24, 0.02, -0.12)],
  chest:     ['spine',    V(-0.30, 0.02, 0.22)],
  neck:      ['chest',    V(-0.313, 0.13, 0.46)],
  head:      ['neck',     V(-0.313, 0.33, 0.62), V(-0.313, 0.34, 0.86)],
  jaw:       ['head',     V(-0.313, 0.27, 0.70), V(-0.313, 0.255, 0.86)],
  earR:      ['head',     V(-0.42, 0.50, 0.67), V(-0.47, 0.62, 0.66)],
  earL:      ['head',     V(-0.205, 0.50, 0.67), V(-0.155, 0.62, 0.66)],
  shoulderR: ['chest',    V(-0.45, -0.02, 0.30)],
  elbowR:    ['shoulderR', V(-0.47, -0.30, 0.33)],
  wristR:    ['elbowR',   V(-0.475, -0.52, 0.40), V(-0.48, -0.60, 0.53)],
  shoulderL: ['chest',    V(-0.17, -0.02, 0.30)],
  elbowL:    ['shoulderL', V(-0.155, -0.30, 0.33)],
  wristL:    ['elbowL',   V(-0.15, -0.52, 0.40), V(-0.145, -0.60, 0.53)],
  hipR:      ['hips',     V(-0.37, -0.04, -0.52)],
  kneeR:     ['hipR',     V(-0.39, -0.30, -0.47)],
  hockR:     ['kneeR',    V(-0.41, -0.48, -0.65), V(-0.41, -0.60, -0.51)],
  hipL:      ['hips',     V(-0.05, -0.04, -0.47)],
  kneeL:     ['hipL',     V(0.06, -0.30, -0.36)],
  hockL:     ['kneeL',    V(0.14, -0.48, -0.34), V(0.18, -0.60, -0.15)],
  tail0:     ['hips',     V(-0.10, 0.05, -0.62)],
  tail1:     ['tail0',    V(0.044, 0.008, -0.579)],
  tail2:     ['tail1',    V(0.182, -0.117, -0.539)],
  tail3:     ['tail2',    V(0.347, -0.277, -0.453)],
  tail4:     ['tail3',    V(0.44, -0.334, -0.459)],
  tail5:     ['tail4',    V(0.49, -0.366, -0.564)],
  tail6:     ['tail5',    V(0.457, -0.354, -0.723)],
  tail7:     ['tail6',    V(0.522, -0.382, -0.792), V(0.58, -0.38, -0.79)],
};
const TAIL = ['tail0', 'tail1', 'tail2', 'tail3', 'tail4', 'tail5', 'tail6', 'tail7'];
const LEGS = {
  R: {bones: ['shoulderR', 'elbowR', 'wristR'], axis: [-0.47, 0.36]},
  L: {bones: ['shoulderL', 'elbowL', 'wristL'], axis: [-0.15, 0.36]},
  HR: {bones: ['hipR', 'kneeR', 'hockR'], axis: [-0.40, -0.58]},
  HL: {bones: ['hipL', 'kneeL', 'hockL'], axis: [0.13, -0.28]},
};

// Face landmarks for the eye/mouth shader (same space).
export const FACE = {
  eyeR: V(-0.388, 0.396, 0.826),
  eyeL: V(-0.238, 0.396, 0.826),
  eyeRadius: new THREE.Vector2(0.035, 0.032),
  mouth: V(-0.313, 0.29, 0.876),
  nose: V(-0.313, 0.327, 0.89),
};

const _ab = new THREE.Vector3(), _ap = new THREE.Vector3();
function segDist(p, a, b) {
  _ab.subVectors(b, a); _ap.subVectors(p, a);
  const t = THREE.MathUtils.clamp(_ap.dot(_ab) / Math.max(1e-9, _ab.lengthSq()), 0, 1);
  return _ap.addScaledVector(_ab, -t).length();
}

/** Returns {root, bones: {name: Bone}, list: Bone[]} with identity rotations. */
export function buildSkeleton(def = BONES) {
  const bones = {}, list = [];
  for (const [name, [parent, pos]] of Object.entries(def)) {
    const b = new THREE.Bone();
    b.name = name;
    const parentPos = parent ? def[parent][1] : new THREE.Vector3();
    b.position.copy(pos).sub(parentPos);
    if (parent) bones[parent].add(b);
    bones[name] = b;
    list.push(b);
  }
  return {root: bones.hips, bones, list};
}

function segmentFor(name) {
  const [, pos, end] = BONES[name];
  if (end) return [pos, end];
  const child = Object.entries(BONES).find(([, [parent]]) => parent === name);
  return [pos, child ? child[1][1] : pos];
}

/**
 * Computes skinIndex/skinWeight attributes. `color(i)` returns the texture
 * brightness (0..1) at vertex i, used to tell the dark tail from the haunch.
 * `smooth`: surface smoothing passes (0 shows the raw, masked weights).
 */
export function computeWeights(geometry, color, {smooth = 4} = {}) {
  const pos = geometry.attributes.position, idx = geometry.index, N = pos.count;
  const names = Object.keys(BONES), NB = names.length;
  const nameIndex = Object.fromEntries(names.map((n, i) => [n, i]));
  const segs = names.map(segmentFor);

  // Weld duplicated seam vertices so smoothing crosses UV seams.
  const key = new Map(), weld = new Int32Array(N);
  for (let i = 0; i < N; i++) {
    const k = Math.round(pos.getX(i) * 1e4) + ',' + Math.round(pos.getY(i) * 1e4) + ',' + Math.round(pos.getZ(i) * 1e4);
    if (!key.has(k)) key.set(k, i);
    weld[i] = key.get(k);
  }
  const tailPts = TAIL.map(n => BONES[n][1]).concat([BONES.tail7[2]]);
  const tailDist = p => { let m = 9; for (let k = 1; k < tailPts.length - 1; k++) m = Math.min(m, segDist(p, tailPts[k], tailPts[k + 1])); return m; };

  const W = new Float32Array(N * NB);
  const p = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    if (weld[i] !== i) continue;
    p.fromBufferAttribute(pos, i);
    const row = i * NB;
    const td = tailDist(p);
    const nearHindLeg = Math.hypot(p.x - LEGS.HL.axis[0], p.z - LEGS.HL.axis[1]) < 0.16 && p.y < -0.12;
    const isTail = p.z < -0.28 && !nearHindLeg && (td < 0.06 || (td < 0.18 && color(i) < 0.5) || (td < 0.22 && p.x > 0.3));
    if (isTail) {
      // Follow the tail chain: only the nearest segment and its neighbours,
      // so where the tail curls back on itself it doesn't split apart.
      let k = 1, bd = 1e9, bt = 0;
      for (let s = 1; s < tailPts.length - 1; s++) {
        const a = tailPts[s], e = tailPts[s + 1];
        _ab.subVectors(e, a); _ap.subVectors(p, a);
        const t = THREE.MathUtils.clamp(_ap.dot(_ab) / _ab.lengthSq(), 0, 1);
        const d = _ap.addScaledVector(_ab, -t).length();
        if (d < bd) { bd = d; k = s; bt = t; }
      }
      const prev = k > 1 ? nameIndex['tail' + (k - 1)] : nameIndex.tail0;
      const cur = nameIndex['tail' + k], next = k < 7 ? nameIndex['tail' + (k + 1)] : cur;
      const toPrev = (1 - THREE.MathUtils.smoothstep(bt, 0, 0.35)) * 0.5;
      const toNext = THREE.MathUtils.smoothstep(bt, 0.65, 1) * 0.5;
      W[row + prev] += toPrev; W[row + next] += toNext; W[row + cur] += 1 - toPrev - toNext;
      continue;
    }
    for (let b = 0; b < NB; b++) {
      const name = names[b];
      const [a, e] = segs[b];
      let d = segDist(p, a, e);
      let allowed = true;
      if (name.startsWith('tail')) allowed = isTail;
      else if (isTail) allowed = name === 'hips';
      else {
        for (const [, leg] of Object.entries(LEGS)) {
          const li = leg.bones.indexOf(name);
          if (li < 0) continue;
          const horiz = Math.hypot(p.x - leg.axis[0], p.z - leg.axis[1]);
          // The upper bone may reach into the body; lower bones only the visible leg.
          allowed = li === 0 ? (p.y < 0.05 && horiz < 0.24) : (p.y < -0.18 && horiz < 0.22);
        }
        if (name === 'jaw') allowed = p.z > 0.72 && p.y < 0.305 && p.y > 0.17 && Math.abs(p.x - MIDLINE_X) < 0.14;
        if (name === 'earR' || name === 'earL') allowed = p.y > 0.47 && p.z < 0.78;
        if (name === 'head' || name === 'neck') allowed = allowed && p.z > 0.25;
      }
      if (!allowed) continue;
      W[row + b] = 1 / Math.pow(d + 0.012, 4);
    }
    // Normalise.
    let s = 0; for (let b = 0; b < NB; b++) s += W[row + b];
    if (s === 0) {
      // Nothing allowed: fall back to the nearest bone.
      let best = 0, bd = 1e9;
      for (let b = 0; b < NB; b++) { const d = segDist(p, segs[b][0], segs[b][1]); if (d < bd) { bd = d; best = b; } }
      W[row + best] = 1; s = 1;
    }
    for (let b = 0; b < NB; b++) W[row + b] /= s;
  }

  // Smooth along the surface so joints bend softly.
  const adj = Array.from({length: N}, () => []);
  for (let t = 0; t < idx.count; t += 3) {
    const a = weld[idx.getX(t)], b = weld[idx.getX(t + 1)], c = weld[idx.getX(t + 2)];
    adj[a].push(b, c); adj[b].push(a, c); adj[c].push(a, b);
  }
  const tmp = new Float32Array(NB);
  for (let it = 0; it < smooth; it++) {
    for (let i = 0; i < N; i++) {
      if (weld[i] !== i || !adj[i].length) continue;
      tmp.fill(0);
      for (const j of adj[i]) for (let b = 0; b < NB; b++) tmp[b] += W[j * NB + b];
      const inv = 1 / adj[i].length;
      for (let b = 0; b < NB; b++) W[i * NB + b] = W[i * NB + b] * 0.5 + tmp[b] * inv * 0.5;
    }
  }

  const skinIndex = new Uint16Array(N * 4), skinWeight = new Float32Array(N * 4);
  const order = new Array(NB);
  for (let i = 0; i < N; i++) {
    const src = weld[i] * NB;
    for (let b = 0; b < NB; b++) order[b] = b;
    order.sort((x, y) => W[src + y] - W[src + x]);
    let s = 0;
    for (let k = 0; k < 4; k++) s += W[src + order[k]];
    for (let k = 0; k < 4; k++) {
      skinIndex[i * 4 + k] = order[k];
      skinWeight[i * 4 + k] = s > 0 ? W[src + order[k]] / s : (k === 0 ? 1 : 0);
    }
  }
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));
  return {weld, names};
}

// ---------------------------------------------------------------------------
// Rig v2 (the motion trial; the app still uses the rig above until it's
// approved). Same bones, plus a shoulder blade on each side between the chest
// and the upper arm, and new skin weights:
//  - the tail is told apart from the body by the mesh itself (cut a ring
//    round its root and the rest of it comes away as one piece), not by
//    colour, so the haunch it lies against stays with the body;
//  - each thigh bone carries the haunch, fading into the pelvis above the
//    hip joint, so the leg doesn't slide out of it when it swings or folds;
//  - the shoulder blade carries the side of the chest, the upper arm only
//    the leg and armpit;
//  - every influence fades out smoothly with distance (no hard mask edges),
//    and smoothing never mixes the tail with the body, one leg with
//    another, or a leg with the far side.
export const BONES2 = {};
for (const [name, def] of Object.entries(BONES)) {
  // Half-turn helpers at the hips: each follows its thigh halfway (see
  // syncHelpers), and carries the upper haunch, so a deep fold (sitting)
  // rolls the haunch instead of pushing the thigh through the belly.
  if (name === 'hipR') BONES2.thighR = ['hips', BONES.hipR[1]];
  if (name === 'hipL') BONES2.thighL = ['hips', BONES.hipL[1]];
  if (name === 'shoulderR') BONES2.scapulaR = ['chest', V(-0.38, 0.25, 0.14)];
  if (name === 'shoulderL') BONES2.scapulaL = ['chest', V(-0.24, 0.25, 0.14)];
  BONES2[name] = name.startsWith('shoulder') ? ['scapula' + name.slice(-1), def[1]] : def;
}
// The end of the tail, on the sculpt's own centreline: past its curl the tail
// runs straight back to the tip (the first rig's last bone turned off sideways
// short of it, so a straightened tail ended in an upturned tuft).
BONES2.tail5 = ['tail4', V(0.515, -0.38, -0.60)];
BONES2.tail6 = ['tail5', V(0.505, -0.372, -0.72)];
BONES2.tail7 = ['tail6', V(0.48, -0.365, -0.82), V(0.43, -0.34, -0.95)];

// The long-haired Mochi (assets/mochi-longhair-hq.glb, Meshy's top settings; see
// docs/mochi-longhair/): the same bones as BONES2, measured on that model. It
// stands almost square: midline x = 0, ground y = -0.6, facing +z,
// her left is +x, tail raised. Thick fur: the skin is well inside the surface
// (back at y .25, bones at .08). Not used by the app yet (mochi-study.html
// draws it with ?bones).
const side = (n, parent, x, y, z, end) => ({[n + 'R']: [parent && parent + 'R', V(-x, y, z), end && V(-end[0], end[1], end[2])].filter(v => v !== undefined), [n + 'L']: [parent && parent + 'L', V(x, y, z), end && V(...end)].filter(v => v !== undefined)});
const GROUND_Y_LONGHAIR = -0.602;
// Joint heights are the first Mochi's (hip and shoulder joints, knees,
// hocks, elbows, wrists the same height off the floor in the room), so the
// movement tuned on her fits; the paws and the head are where this model
// has them. The spine runs through the middle of the body, fur included.
export const BONES_LONGHAIR = {
  hips:  [null,    V(0, -0.03, -0.27)],
  spine: ['hips',  V(0, -0.01, 0.01)],
  chest: ['spine', V(0, -0.01, 0.29)],
  neck:  ['chest', V(0, 0.15, 0.55)],
  head:  ['neck',  V(0, 0.29, 0.70), V(0, 0.29, 0.93)],
  jaw:   ['head',  V(0, 0.23, 0.78), V(0, 0.21, 0.93)],
  earR:  ['head',  V(-0.11, 0.41, 0.75), V(-0.152, 0.508, 0.787)],
  earL:  ['head',  V(0.11, 0.41, 0.75), V(0.156, 0.509, 0.783)],
  scapulaR: ['chest', V(-0.07, 0.20, 0.32)], scapulaL: ['chest', V(0.07, 0.20, 0.32)],
  ...side('shoulder', 'scapula', 0.09, -0.052, 0.37),
  ...side('elbow', 'shoulder', 0.078, -0.305, 0.40),
  ...side('wrist', 'elbow', 0.078, -0.504, 0.44, [0.087, -0.577, 0.53]),
  thighR: ['hips', V(-0.10, -0.069, -0.27)], thighL: ['hips', V(0.10, -0.069, -0.27)],
  hipR: ['hips', V(-0.10, -0.069, -0.27)], hipL: ['hips', V(0.10, -0.069, -0.27)],
  // (She stands mid-step: her right hind leg is a little further back.)
  kneeR: ['hipR', V(-0.12, -0.305, -0.22)], kneeL: ['hipL', V(0.12, -0.305, -0.20)],
  hockR: ['kneeR', V(-0.11, -0.468, -0.355), V(-0.15, -0.577, -0.28)], hockL: ['kneeL', V(0.10, -0.468, -0.31), V(0.13, -0.577, -0.20)],
  // (Along the centre line the tail was reshaped on: tools/mochi-longhair/tail.py prints these.)
  tail0: ['hips',  V(0, 0.15, -0.40)],
  tail1: ['tail0', V(0, 0.200, -0.445)],
  tail2: ['tail1', V(0, 0.273, -0.491)],
  tail3: ['tail2', V(0, 0.344, -0.541)],
  tail4: ['tail3', V(0, 0.407, -0.600)],
  tail5: ['tail4', V(0, 0.459, -0.669)],
  tail6: ['tail5', V(0, 0.493, -0.748)],
  tail7: ['tail6', V(0, 0.506, -0.834), V(0, 0.505, -0.920)],
};
// Face landmarks, read off the model's texture (blue of the eyes, pink of the nose).
export const FACE_LONGHAIR = {
  eyeR: V(-0.061, 0.311, 0.874),
  eyeL: V(0.061, 0.311, 0.874),
  eyeRadius: new THREE.Vector2(0.024, 0.017),
  mouth: V(0, 0.225, 0.925),
  nose: V(0, 0.261, 0.936),
};

// Where the parts of the model are, for the weights (the first Mochi's own
// numbers; useModel swaps them): tailCut: radius round the first tail segment
// that separates the tail from the body; front, hind (z): front-leg bones only
// ahead of this, hind-leg bones only behind; the tops of the legs (y); the
// jaw's box; the ears above earY and behind earZ; head and neck ahead of headZ;
// mid: how far a leg's bones reach across the midline, and where they are at
// full strength (her legs stand closer together than the first Mochi's).
const T = {tailCut: 0.11, front: -0.05, hind: -0.2, legTopF: -0.2, legTopH: -0.24, jaw: [0.72, 0.17, 0.305, 0.14], earY: 0.47, earZ: 0.78, headZ: 0.25, mid: [.02, .05]};
const inJaw = p => p.z > T.jaw[0] && p.y > T.jaw[1] && p.y < T.jaw[2] && Math.abs(p.x - MIDLINE_X) < T.jaw[3];
const T_LONGHAIR = {tailCut: 0.13, front: 0.22, hind: -0.02, legTopF: -0.3, legTopH: -0.3, jaw: [0.8, 0.16, 0.245, 0.09], earY: 0.41, earZ: 0.84, headZ: 0.48, mid: [.008, .015], tailUp: true};

/**
 * Switches every table in this file to another model's measurements, in
 * place, before a RealCat is built ('longhair': the long-haired candidate).
 * One model per page: the tables are shared.
 */
export function useModel(name) {
  if (name !== 'longhair' || BONES2 === useModel.done) return;
  useModel.done = BONES2;
  for (const table of [BONES, BONES2]) { for (const k of Object.keys(table)) delete table[k]; Object.assign(table, BONES_LONGHAIR); }
  for (const k of ['scapulaR', 'scapulaL', 'thighR', 'thighL']) delete BONES[k];
  BONES.shoulderR = ['chest', BONES_LONGHAIR.shoulderR[1]]; BONES.shoulderL = ['chest', BONES_LONGHAIR.shoulderL[1]];
  for (const k of ['eyeR', 'eyeL', 'eyeRadius', 'mouth', 'nose']) FACE[k].copy(FACE_LONGHAIR[k]);
  Object.assign(LEGS.R, {axis: [-0.078, 0.43]}); Object.assign(LEGS.L, {axis: [0.078, 0.43]});
  Object.assign(LEGS.HR, {axis: [-0.125, -0.31]}); Object.assign(LEGS.HL, {axis: [0.115, -0.26]});
  Object.assign(T, T_LONGHAIR);
  GROUND_Y = GROUND_Y_LONGHAIR; MIDLINE_X = 0;
}
 // z: front-leg bones only ahead of this, hind-leg bones only behind // radius round the first tail segment that separates the tail from the body
const fall = (d, r0, r1) => 1 - THREE.MathUtils.smoothstep(d, r0, r1);

export function computeWeights2(geometry, {smooth = 300} = {}) {
  const pos = geometry.attributes.position, idx = geometry.index, N = pos.count;
  const names = Object.keys(BONES2), NB = names.length;
  const ix = Object.fromEntries(names.map((n, i) => [n, i]));
  const seg = n => { const [, a, e] = BONES2[n]; if (e) return [a, e]; const c = Object.entries(BONES2).find(([, [p]]) => p === n); return [a, c ? c[1][1] : a]; };
  const segs = names.map(seg);

  // Weld seam duplicates, and near-duplicates across the model's split
  // seams (within half a millimetre), so both sides of a seam move together;
  // then the surface's neighbours.
  const TOL = 5e-4, cell = new Map(), parent = new Int32Array(N).map((_, i) => i);
  const root = i => { while (parent[i] !== i) i = parent[i] = parent[parent[i]]; return i; };
  const ck = (x, y, z) => x + ',' + y + ',' + z;
  for (let i = 0; i < N; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const cx = Math.floor(x / TOL), cy = Math.floor(y / TOL), cz = Math.floor(z / TOL);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      const list = cell.get(ck(cx + dx, cy + dy, cz + dz));
      if (!list) continue;
      for (const j of list) if (Math.hypot(pos.getX(j) - x, pos.getY(j) - y, pos.getZ(j) - z) < TOL) { const a = root(i), b = root(j); if (a !== b) parent[Math.max(a, b)] = Math.min(a, b); }
    }
    const k = ck(cx, cy, cz);
    if (!cell.has(k)) cell.set(k, []);
    cell.get(k).push(i);
  }
  const weld = new Int32Array(N);
  for (let i = 0; i < N; i++) weld[i] = root(i);
  const adj = Array.from({length: N}, () => []);
  for (let t = 0; t < idx.count; t += 3) {
    const a = weld[idx.getX(t)], b = weld[idx.getX(t + 1)], c = weld[idx.getX(t + 2)];
    adj[a].push(b, c); adj[b].push(a, c); adj[c].push(a, b);
  }
  const P = i => new THREE.Vector3().fromBufferAttribute(pos, i);

  // Regions: 0 body, 1 tail, 2 root ring (tail <-> body), 3-6 legs.
  const region = new Uint8Array(N);
  const [r0, r1] = [BONES2.tail0[1], BONES2.tail1[1]];
  const tailEnd = BONES2.tail7[2];
  let tip = -1, best = 9;
  for (let i = 0; i < N; i++) {
    if (weld[i] !== i) continue;
    const p = P(i);
    if (segDist(p, r0, r1) < T.tailCut) region[i] = 2;
    const d = p.distanceTo(tailEnd);
    if (d < best) { best = d; tip = i; }
  }
  const stack = [tip];
  region[tip] = 1;
  while (stack.length) { const v = stack.pop(); for (const u of adj[v]) if (region[u] === 0) { region[u] = 1; stack.push(u); } }
  // A raised tail's loose flecks of fur (pieces of their own, which the
  // spread above can't reach) belong to the tail too, or they stay behind
  // in the air when it moves.
  if (T.tailUp) for (let i = 0; i < N; i++) if (weld[i] === i && region[i] === 0 && pos.getZ(i) < r1.z && pos.getY(i) > r1.y) region[i] = 1;
  const LEG_REGIONS = {3: LEGS.R, 4: LEGS.L, 5: LEGS.HR, 6: LEGS.HL};
  for (let i = 0; i < N; i++) {
    if (weld[i] !== i || region[i]) continue;
    const p = P(i);
    // (The nearest leg: legs that stand close together are within reach of each other.)
    let nearest = 0.15;
    for (const [r, leg] of Object.entries(LEG_REGIONS)) {
      const top = leg.bones[0].startsWith('shoulder') ? T.legTopF : T.legTopH, d = Math.hypot(p.x - leg.axis[0], p.z - leg.axis[1]);
      if (p.y < top && d < nearest) { nearest = d; region[i] = +r; }
    }
  }
  const legOf = n => /R$/.test(n) && /^(scapula|shoulder|elbow|wrist)/.test(n) ? 3 : /L$/.test(n) && /^(scapula|shoulder|elbow|wrist)/.test(n) ? 4 : /R$/.test(n) && /^(hip|knee|hock)/.test(n) ? 5 : /L$/.test(n) && /^(hip|knee|hock)/.test(n) ? 6 : 0;
  // Which bones a vertex in each region may follow.
  // The body's midline (it runs slightly askew in the model): a leg's bones
  // never reach the other side.
  const midX = z => THREE.MathUtils.lerp(BONES2.hips[1].x, BONES2.chest[1].x, THREE.MathUtils.clamp((z - BONES2.hips[1].z) / (BONES2.chest[1].z - BONES2.hips[1].z), 0, 1));
  const allowed = (reg, n) => {
    if (reg === 1) return n.startsWith('tail') && n !== 'tail0' || n === 'tail0';
    if (reg === 2) return n === 'hips' || n === 'tail0' || n === 'tail1' || n === 'spine';
    if (n.startsWith('tail')) return false;
    if (reg >= 3) { const l = legOf(n); return l === reg || (l === 0 && !['head', 'jaw', 'earR', 'earL', 'neck'].includes(n)); }
    return true;
  };
  const allow = names.map(n => [0, 1, 2, 3, 4, 5, 6].map(r => allowed(r, n)));

  // How far each bone reaches into the body: [full until, gone by].
  const reachOf = {
    tail0: [.05, .12], tail1: [.05, .12], hips: [.1, .3], spine: [.1, .3], chest: [.1, .32], neck: [.08, .2], head: [.15, .3], jaw: [.03, .06], earR: [.03, .08], earL: [.03, .08],
    scapulaR: [.07, .16], scapulaL: [.07, .16], shoulderR: [.06, .14], shoulderL: [.06, .14], elbowR: [.05, .1], elbowL: [.05, .1], wristR: [.05, .09], wristL: [.05, .09],
    hipR: [.12, .21], hipL: [.12, .21], kneeR: [.06, .12], kneeL: [.06, .12], hockR: [.05, .1], hockL: [.05, .1],
  };
  const W = new Float32Array(N * NB);
  const tailPts = TAIL.map(n => BONES2[n][1]).concat([tailEnd]);
  // Along the tail: how far each vertex is from the root, measured over the
  // surface (where the tip curls back on itself, the nearest bone can be
  // three segments on, but the distance along the tail can't), scaled so the
  // tip lands at the end of the last bone.
  const cum = [0];
  for (let k = 1; k < tailPts.length; k++) cum.push(cum[k - 1] + tailPts[k].distanceTo(tailPts[k - 1]));
  const along = new Float64Array(N).fill(Infinity);
  {
    const chainPos = p => {
      let bd = 1e9, u = 0;
      for (let k = 0; k < tailPts.length - 1; k++) {
        _ab.subVectors(tailPts[k + 1], tailPts[k]); _ap.subVectors(p, tailPts[k]);
        const t = THREE.MathUtils.clamp(_ap.dot(_ab) / _ab.lengthSq(), 0, 1);
        const d = _ap.addScaledVector(_ab, -t).length();
        if (d < bd) { bd = d; u = cum[k] + t * (cum[k + 1] - cum[k]); }
      }
      return u;
    };
    // Start from the tail's edge at the root ring, then spread outwards.
    const heap = [];
    const push = (i, d) => { heap.push([d, i]); let c = heap.length - 1; while (c > 0) { const pa = (c - 1) >> 1; if (heap[pa][0] <= heap[c][0]) break; [heap[pa], heap[c]] = [heap[c], heap[pa]]; c = pa; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let c = 0; for (;;) { const l = 2 * c + 1, r = l + 1; let m = c; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; c = m; } } return top; };
    for (let i = 0; i < N; i++) if (weld[i] === i && region[i] === 1 && adj[i].some(j => region[j] === 2)) { along[i] = chainPos(P(i)); push(i, along[i]); }
    while (heap.length) {
      const [d, i] = pop();
      if (d > along[i]) continue;
      for (const j of adj[i]) {
        if (region[j] !== 1) continue;
        const nd = d + P(i).distanceTo(P(j));
        if (nd < along[j]) { along[j] = nd; push(j, nd); }
      }
    }
    let maxU = 0;
    for (let i = 0; i < N; i++) if (region[i] === 1 && isFinite(along[i])) maxU = Math.max(maxU, along[i]);
    let start = Infinity; // (a loop: a model can have more points than a call takes arguments)
    for (let i = 0; i < N; i++) if (region[i] === 1 && isFinite(along[i])) start = Math.min(start, along[i]);
    for (let i = 0; i < N; i++) if (region[i] === 1 && isFinite(along[i])) along[i] = start + (along[i] - start) * (cum[cum.length - 1] - start) / Math.max(1e-6, maxU - start);
    for (let i = 0; i < N; i++) if (region[i] === 1 && weld[i] === i && !isFinite(along[i])) along[i] = chainPos(P(i)); // loose pieces: by the nearest point of the chain
  }
  for (let i = 0; i < N; i++) {
    if (weld[i] !== i) continue;
    const p = P(i), reg = region[i], row = i * NB;
    if (reg === 1) {
      // Its segment by the distance along the tail, blending into its neighbours.
      const u = isFinite(along[i]) ? along[i] : cum[1];
      let k = 1;
      while (k < 7 && u > cum[k + 1]) k++;
      const bt = THREE.MathUtils.clamp((u - cum[k]) / (cum[k + 1] - cum[k]), 0, 1);
      const prev = ix['tail' + (k - 1)], cur = ix['tail' + k], next = k < 7 ? ix['tail' + (k + 1)] : cur;
      // Blend all the way from each segment's middle to the next, so a bend
      // spreads along the tail instead of creasing at each joint.
      const toPrev = (1 - THREE.MathUtils.smoothstep(bt, 0, 0.5)) * 0.5, toNext = THREE.MathUtils.smoothstep(bt, 0.5, 1) * 0.5;
      W[row + prev] += toPrev; W[row + next] += toNext; W[row + cur] += 1 - toPrev - toNext;
      continue;
    }
    if (reg === 2) {
      // The root ring: from the pelvis into the tail along the first segment.
      _ab.subVectors(r1, r0); _ap.subVectors(p, r0);
      const t = THREE.MathUtils.clamp(_ap.dot(_ab) / _ab.lengthSq(), 0, 1);
      W[row + ix.hips] = 1 - t; W[row + ix.tail0] = t * .7; W[row + ix.tail1] = t * .3;
      continue;
    }
    const side = p.x - midX(p.z); // < 0: her right
    for (let b = 0; b < NB; b++) {
      const n = names[b];
      if (!allow[b][reg] || !reachOf[n]) continue;
      if (legOf(n) && (n.endsWith('R') ? side > T.mid[0] : side < -T.mid[0])) continue;
      const d = segDist(p, segs[b][0], segs[b][1]);
      let f = fall(d, ...reachOf[n]);
      // The upper leg bones stop at the top of the leg (the back stays on the spine);
      // the thigh reaches up to just above the hip joint.
      if (/^(hip|knee|hock)[RL]$/.test(n)) f *= fall(p.y - BONES2[n][1].y, n.startsWith('hip') ? .02 : 0, n.startsWith('hip') ? .12 : .04);
      if (/^(shoulder|elbow|wrist)/.test(n)) f *= fall(p.y - BONES2[n][1].y, .0, .06);
      // Shoulder blades sit on the sides of the chest, not across the back or under the chest.
      if (n.startsWith('scapula')) f *= fall(Math.abs(p.x - BONES2[n][1].x), .1, .2);
      if (n === 'jaw') f *= +(inJaw(p));
      if (n === 'earR' || n === 'earL') f *= +(p.y > T.earY && p.z < T.earZ);
      if (n === 'head' || n === 'neck') f *= +(p.z > T.headZ);
      if (f <= 0) continue;
      W[row + b] = f / Math.pow(d + 0.02, 2);
    }
    let s = 0; for (let b = 0; b < NB; b++) s += W[row + b];
    if (s === 0) {
      let bb = -1, bd = 1e9;
      for (let b = 0; b < NB; b++) { if (!allow[b][reg]) continue; const d = segDist(p, segs[b][0], segs[b][1]); if (d < bd) { bd = d; bb = b; } }
      W[row + bb] = 1; s = 1;
    }
    for (let b = 0; b < NB; b++) W[row + b] /= s;
  }

  // Bone heat (as Blender's automatic weights): each bone warms the skin it
  // is nearest to, the more strongly the closer it is, and the heat spreads
  // along the surface. Solving for the balance gives every joint a wide,
  // smooth blend that follows the shape (narrow on a slim leg, broad across
  // the body). Each vertex only takes bones its region allows; nothing
  // crosses the tail cut, passes between legs, or reaches the far side.
  // The tail and its root ring keep the weights set above.
  const edge = (() => { let s = 0, n = 0; for (let t = 0; t < Math.min(idx.count, 30000); t += 3) { s += P(idx.getX(t)).distanceTo(P(idx.getX(t + 1))); n++; } return s / n; })();
  const free = [], okList = [], heat = [], near = [];
  for (let i = 0; i < N; i++) {
    if (weld[i] !== i || region[i] === 1 || !adj[i].length) continue;
    const p = P(i), side = p.x - midX(p.z), reg = region[i];
    const ok = [];
    let nb = -1, nd = 1e9;
    // Skin beside the tail's root ring may take a little of the tail's first
    // bones too, so the blend carries on past the ring instead of stopping at it.
    const nearRoot = reg === 0 && segDist(p, r0, r1) < .2;
    for (let b = 0; b < NB; b++) {
      const n = names[b];
      if (!(allow[b][reg] || (nearRoot && (n === 'tail0' || n === 'tail1'))) || !reachOf[n]) continue;
      if (legOf(n) && (n.endsWith('R') ? side > T.mid[0] : side < -T.mid[0])) continue;
      ok.push(b);
      if (reg === 0 && n.startsWith('tail')) continue; // (only ever blended in, never the body's own bone)
      // Nearest bone: the plain distance, except a leg bone only counts
      // below the top of its own segment (the back belongs to the spine).
      let d = segDist(p, segs[b][0], segs[b][1]);
      if (/^(hip|knee|hock|shoulder|elbow|wrist)[RL]$/.test(n) && p.y > BONES2[n][1].y + (n.startsWith('hip') ? .1 : .02)) d += .3;
      if (n.startsWith('scapula') && Math.abs(p.x - BONES2[n][1].x) > .14) d += .3;
      if (n === 'jaw' && !(inJaw(p))) d += .3;
      if ((n === 'earR' || n === 'earL') && !(p.y > T.earY && p.z < T.earZ)) d += .3;
      if (d < nd) { nd = d; nb = b; }
    }
    // (The root ring reads the tail's fixed weights as its far boundary.)
    const nbrs = [...new Set(adj[i])].filter(j => (region[j] !== 1 || reg === 2) && !(region[j] >= 3 && reg >= 3 && region[j] !== reg));
    free.push([i, nbrs]); okList.push(ok); near.push(nb);
    // The body's own bones sit deep inside it: count them as no further
    // than 8 cm, so the flank holds firmly to the spine instead of being
    // pulled about by the legs' influence spreading across it.
    const body = ['hips', 'spine', 'chest', 'neck'].includes(names[nb]);
    heat.push(1 / Math.pow(Math.max(body ? Math.min(nd, .08) : nd, edge * 2) / edge, 2));
  }
  for (let it = 0; it < smooth; it++) {
    for (let f = 0; f < free.length; f++) {
      const [i, nbrs] = free[f], ok = okList[f], h = heat[f], row = i * NB;
      const deg = nbrs.length;
      let s = 0;
      for (const b of ok) {
        let sum = 0;
        for (const j of nbrs) sum += W[j * NB + b];
        const w = (sum + (b === near[f] ? h : 0)) / (deg + h);
        W[row + b] = w; s += w;
      }
      if (s > 0) for (const b of ok) W[row + b] /= s;
    }
  }

  // Front legs fade out over the middle of the body going back, hind legs
  // going forward, and each leg fades out at the midline: soft limits, so
  // there's no edge where the influence stops.
  for (let i = 0; i < N; i++) {
    if (weld[i] !== i || region[i] === 1 || region[i] === 2) continue;
    const z = pos.getZ(i), side = pos.getX(i) - midX(z);
    let s = 0;
    for (let b = 0; b < NB; b++) {
      const L = legOf(names[b]);
      if (!L || !W[i * NB + b]) { s += W[i * NB + b]; continue; }
      let k = L <= 4 ? THREE.MathUtils.smoothstep(z, T.front - .12, T.front + .06) : 1 - THREE.MathUtils.smoothstep(z, T.hind - .06, T.hind + .12);
      k *= THREE.MathUtils.smoothstep(names[b].endsWith('R') ? -side : side, -T.mid[0], T.mid[1]);
      W[i * NB + b] *= k; s += W[i * NB + b];
    }
    if (s > 0) for (let b = 0; b < NB; b++) W[i * NB + b] /= s;
  }
  // The ears carry only the ears: none of the face below them (the heat
  // spreads it there), easing out over their base and away from the middle
  // of the crown, which stays with the head.
  for (let i = 0; i < N; i++) {
    if (weld[i] !== i) continue;
    const y = pos.getY(i), mid = Math.abs(pos.getX(i) - MIDLINE_X);
    const k = THREE.MathUtils.smoothstep(y, T.earY, T.earY + .05) * THREE.MathUtils.smoothstep(mid, .04, .09) * +(pos.getZ(i) < T.earZ);
    for (const e of [ix.earR, ix.earL]) {
      const w = W[i * NB + e];
      if (w > 0) { W[i * NB + e] = w * k; W[i * NB + ix.head] += w * (1 - k); }
    }
  }
  // Drop traces (under 4%) so neighbouring vertices keep the same few bones.
  for (let i = 0; i < N; i++) {
    if (weld[i] !== i) continue;
    let s = 0;
    for (let b = 0; b < NB; b++) { if (W[i * NB + b] < .04) W[i * NB + b] = 0; s += W[i * NB + b]; }
    if (s > 0) for (let b = 0; b < NB; b++) W[i * NB + b] /= s;
  }
  // The thigh's share of the upper haunch goes to its half-turn helper;
  // from partway down the thigh to the knee it stays on the thigh bone.
  for (const s of ['R', 'L']) {
    const hip = ix['hip' + s], helper = ix['thigh' + s], [a, e] = segs[hip];
    for (let i = 0; i < N; i++) {
      if (weld[i] !== i) continue;
      const w = W[i * NB + hip];
      if (w <= 0) continue;
      _ab.subVectors(e, a); _ap.fromBufferAttribute(pos, i).sub(a);
      const t = THREE.MathUtils.clamp(_ap.dot(_ab) / _ab.lengthSq(), 0, 1);
      const k = THREE.MathUtils.smoothstep(t, .3, .85);
      W[i * NB + hip] = w * k; W[i * NB + helper] = w * (1 - k);
    }
  }

  const skinIndex = new Uint16Array(N * 4), skinWeight = new Float32Array(N * 4);
  const order = new Array(NB);
  for (let i = 0; i < N; i++) {
    const src = weld[i] * NB;
    for (let b = 0; b < NB; b++) order[b] = b;
    order.sort((x, y) => W[src + y] - W[src + x]);
    let s = 0;
    for (let k = 0; k < 4; k++) s += W[src + order[k]];
    for (let k = 0; k < 4; k++) {
      skinIndex[i * 4 + k] = order[k];
      skinWeight[i * 4 + k] = s > 0 ? W[src + order[k]] / s : (k === 0 ? 1 : 0);
    }
  }
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));
  return {weld, names, region};
}

// Point the half-turn helpers halfway between the pelvis and their thighs.
// Call after the pose (and any IK) is set.
const _hq = new THREE.Quaternion();
export function syncHelpers(bones) {
  for (const s of ['R', 'L']) {
    const h = bones['thigh' + s];
    if (h) h.quaternion.copy(_hq.identity()).slerp(bones['hip' + s].quaternion, .5);
  }
}
