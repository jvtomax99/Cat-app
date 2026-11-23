// Motion trial: Mochi's movement authored the way an animator works with a
// rig, instead of easing every joint towards a pose together.
//
//  - The body is set directly: the pelvis (position and turn), the bend of
//    the spine and chest, the neck and a steady head, the shoulder blades
//    and the tail.
//  - Each paw has a target and a contact state. A planted paw stays exactly
//    where it was put down while the body moves over it; the legs reach it
//    by inverse kinematics (two bones, with the paw's own angle set).
//  - The walk is a cat's four-beat walk (left hind, left fore, right hind,
//    right fore), with stride length, step rhythm and distance travelled
//    worked out together, so the feet and body always agree.
//  - Each transition (stop, sit, lie down) is its own sequence of weight
//    shifts and limb moves, each part on its own timing.
//
// MotionRig.apply(state) poses the cat from a state; trialSequence() builds
// the trial (notice, walk, stop, sit, lie down, rest) as state(t).
// Units: the app's world units, the cat facing +z, its left side +x.
import * as THREE from 'three';
import {syncHelpers, BONES2} from './cat-rig.js';

const {clamp, smoothstep, lerp} = THREE.MathUtils;
const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4();
const smoother = k => k * k * k * (k * (k * 6 - 15) + 10);
// How far a point p (with a radius r) is inside a solid, 0 if it's clear;
// n is set to the way out (by the nearest face; round things: sideways or
// up, whichever is nearer).
function solidDepth(s, p, r, n) {
  if (p.y < s.y0 - r || p.y > s.y1 + r) return 0;
  if (s.kind === 'cyl') {
    const dx = p.x - s.x, dz = p.z - s.z, d = Math.hypot(dx, dz), side = s.r + r - d;
    if (side <= 0) return 0;
    // (Up only when it's nearly on top already: a tail against the side
    // of a thing bends round it, it doesn't climb it.)
    const up = s.y1 + r - p.y;
    if (up < side && up < .06 + r) { n.set(0, 1, 0); return up; }
    if (d < 1e-6) n.set(0, 0, -1); else n.set(dx / d, 0, dz / d);
    return side;
  }
  let x = p.x, z = p.z, x0 = s.x0, x1 = s.x1, z0 = s.z0, z1 = s.z1;
  if (s.kind === 'rbox') {
    const dx = p.x - s.x, dz = p.z - s.z, c = Math.cos(s.ry), sn = Math.sin(s.ry);
    x = c * dx - sn * dz; z = sn * dx + c * dz; x0 = -s.hx; x1 = s.hx; z0 = -s.hz; z1 = s.hz;
  }
  if (x < x0 - r || x > x1 + r || z < z0 - r || z > z1 + r) return 0;
  const up = (s.y1 + r) - p.y, faces = [[x - (x0 - r), -1, 0, 0], [(x1 + r) - x, 1, 0, 0], [z - (z0 - r), 0, 0, -1], [(z1 + r) - z, 0, 0, 1]];
  let f = faces[0];
  for (const g of faces) if (g[0] < f[0]) f = g;
  if (up < f[0] && up < .06 + r) f = [up, 0, 1, 0];
  n.set(f[1], f[2], f[3]);
  if (s.kind === 'rbox') { const c = Math.cos(s.ry), sn = Math.sin(s.ry); n.set(c * f[1] + sn * f[3], f[2], -sn * f[1] + c * f[3]); }
  return f[0];
}
const I0 = new THREE.Quaternion();

// A rotation from yaw (about y), pitch (about x; positive raises the front)
// and roll (about z; positive drops the right side), applied in that order.
function ypr(yaw = 0, pitch = 0, roll = 0, out = new THREE.Quaternion()) {
  return out.setFromEuler(new THREE.Euler(-pitch, yaw, roll, 'YXZ'));
}

export const LEGS = {
  LF: {front: true, side: 1, bones: ['shoulderL', 'elbowL', 'wristL'], scap: 'scapulaL', sole: 1},
  RF: {front: true, side: -1, bones: ['shoulderR', 'elbowR', 'wristR'], scap: 'scapulaR', sole: 0},
  LH: {front: false, side: 1, bones: ['hipL', 'kneeL', 'hockL'], sole: 3},
  RH: {front: false, side: -1, bones: ['hipR', 'kneeR', 'hockR'], sole: 2},
};

export class MotionRig {
  // opts.sampleEvery: how thinly to sample the skin for floor contact (the
  // app uses fewer samples than the trial page, for speed).
  constructor(cat, opts = {}) {
    this.cat = cat;
    const B = this.B = cat.bones;
    this.mesh = cat.skinned;
    this.modelPos = cat.model.position.clone();
    // Rest: every bone at identity, the model standing as built.
    for (const b of Object.values(B)) { b.quaternion.identity(); b.scale.set(1, 1, 1); }
    cat.root.position.set(0, 0, 0); cat.root.quaternion.identity();
    cat.root.updateMatrixWorld(true);
    this.mq = this.mesh.getWorldQuaternion(new THREE.Quaternion());
    this.mqi = this.mq.clone().invert();
    this.scale = this.mesh.getWorldScale(new THREE.Vector3()).x;
    this.restPos = {}; this.restLocal = {};
    for (const [n, b] of Object.entries(B)) { this.restPos[n] = b.getWorldPosition(new THREE.Vector3()); this.restLocal[n] = b.position.clone(); }
    // Sole points (under each paw), at rest.
    this.soleRest = cat.legs.map(l => l.sole.getWorldPosition(new THREE.Vector3()));
    this.legs = {};
    for (const [k, L] of Object.entries(LEGS)) {
      const [a, b, c] = L.bones.map(n => this.restPos[n]);
      const sole = this.soleRest[L.sole];
      this.legs[k] = {...L, la: a.distanceTo(b), lb: b.distanceTo(c),
        dirA: b.clone().sub(a).normalize(), dirB: c.clone().sub(b).normalize(),
        soleOff: sole.clone().sub(c)}; // the sole from the lowest joint, at rest
    }
    // The head's own levelling (as the app's rest pose), as a world turn.
    this.restHeadQ = cat.rest?.head ? this.mq.clone().multiply(cat.rest.head).multiply(this.mqi) : new THREE.Quaternion();
    // Where things are at rest, for building the neutral stance.
    // Her own stance, from the sculpt: front paws stand well ahead of the
    // shoulder joints and hind paws ahead of the hip joints (which sit far
    // back in the haunch). The sculpt's left hind leg is stepped out, so the
    // right one is the reference for both.
    const R = this.restPos, [sRF, sLF, sRH] = this.soleRest;
    const mid = (R.shoulderL.x + R.shoulderR.x) / 2;
    this.stance = {
      hips: R.hips.clone(), chest: R.chest.clone(), mid,
      width: {front: (sLF.x - sRF.x) / 2, hind: mid - sRH.x},
      frontZ: (sLF.z + sRF.z) / 2, hindZ: sRH.z,
    };
    this.dW = {};
    this.planted = {};
    // Contact samples: every vertex that isn't paw or tail, thinned out
    // (a paw's own floor contact is its target; the tail has its own rule).
    const names = this.mesh.skeleton.bones.map(b => b.name), geo = this.mesh.geometry;
    const si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight;
    this.bodySamples = [];
    this.tailSamples = Array.from({length: 8}, () => []);
    this.pawSamples = {LF: [], RF: [], LH: [], RH: []};
    this.lastLeg = {};
    for (let i = 0; i < geo.attributes.position.count; i += opts.sampleEvery || 3) {
      let top = 0, w = -1;
      for (let k = 0; k < 4; k++) if (sw.getComponent(i, k) > w) { w = sw.getComponent(i, k); top = si.getComponent(i, k); }
      const n = names[top];
      if (/^tail\d$/.test(n) && w > .5) (this.tailSamples[+n.slice(4)] ||= []).push(i);
      const paw = {wristL: 'LF', wristR: 'RF', hockL: 'LH', hockR: 'RH'}[n];
      if (paw) this.pawSamples[paw].push(i);
      if (/^(wrist|hock|tail)/.test(n)) continue;
      this.bodySamples.push(i);
    }
    // The tail's tip (past its last joint) and its thickness along it.
    this.tailTip = BONES2.tail7[2].clone().sub(BONES2.tail7[1]);
    // Tail segment lengths and thickness (from its skin at rest).
    this.tailLen = []; this.tailR = [];
    const tp = i => i < 8 ? this.restPos['tail' + i] : this.B.tail7.localToWorld(this.tailTip.clone());
    for (let i = 0; i < 8; i++) this.tailLen.push(tp(i).distanceTo(tp(i + 1)));
    {
      const v = new THREE.Vector3(), ab = new THREE.Vector3(), ap = new THREE.Vector3();
      for (let i = 0; i < 8; i++) {
        const a = tp(i), b = tp(i + 1);
        let r = 0;
        for (const k of this.tailSamples[i]) {
          v.fromBufferAttribute(geo.attributes.position, k).applyMatrix4(this.mesh.matrixWorld);
          ab.subVectors(b, a); ap.subVectors(v, a);
          const tt = clamp(ap.dot(ab) / ab.lengthSq(), 0, 1);
          r = Math.max(r, ap.addScaledVector(ab, -tt).length());
        }
        this.tailR.push(Math.min(r || .04, .08));
      }
      this.tailR.push(this.tailR[7] * .8);
    }
    this.maxSquash = .06; // how far skin may press into the floor (≈2.4 cm), flattening, before the body lifts
  }

  // A bone's turn relative to its rest orientation, in world terms; set its
  // local rotation from that (given its parent's world turn).
  setTurn(name, dW, parentDW) {
    const b = this.B[name];
    this.dW[name] = dW.clone();
    // local = mqi * parentDW^-1 * dW * mq
    b.quaternion.copy(this.mqi).multiply(_q.copy(parentDW).invert()).multiply(dW).multiply(this.mq);
  }
  // Move a bone by a world offset from its rest place (in its parent's frame).
  offset(name, worldOff, parentDW) {
    const b = this.B[name];
    _v.copy(worldOff).applyQuaternion(_q.copy(parentDW).invert()).applyQuaternion(this.mqi).multiplyScalar(1 / this.scale);
    b.position.copy(this.restLocal[name]).add(_v);
  }
  // (Positions, turns and heights here are all in her own frame: cat.root's
  // space, which only moves and turns about the vertical. In the trial page
  // that's the world; in the app it follows her around, up perches and on to
  // the vacuum, so her support surface is always at height 0.)
  pos(name, out = new THREE.Vector3()) { return this.cat.root.worldToLocal(this.B[name].getWorldPosition(out)); }
  rootY() { return this.cat.root.getWorldPosition(_v2).y; }

  /**
   * state: {
   *   pelvis: {pos: Vector3 (hips joint), yaw, pitch, roll},
   *   spine: {yaw, pitch, roll}, chest: {yaw, pitch, roll},
   *   head: {yaw, pitch, roll} (in the world: steady while the body moves),
   *   neckShare (how much of the head's turn the neck takes, 0..1),
   *   headLevel: {y, w} (the neck tips to bring the head a share w of the
   *     way to height y, so it rides level over a bounding body),
   *   scap: {L: {angle, lift}, R: {...}},
   *   paws: {LF: {pos, pitch, yaw, planted}, ...} (pos: the sole, on the floor when planted),
   *   tail: {lift, curl, side, up, amp, speed}, breathe (-1..1 × depth),
   *   face, look
   * }
   */
  apply(s, dt = 0, t = 0, opt = {}) {
    // opt.bodyFloor: her body stays above the level she stands on (or is
    // about to: in the air that's her root's height) even with no contact,
    // so the lift doesn't come and go in one frame as she takes off and
    // lands. Off only when she hangs below it (draped on the pendant).
    const contact = opt.contact ?? true, bodyFloor = opt.bodyFloor ?? contact;
    // Pose, then make sure no part of her goes into the floor: if the body
    // (belly, haunches, chest, legs) dips below it, the pelvis rises until
    // it just touches and the legs solve again to their planted paws. The
    // tail is laid along the floor rather than through it.
    let lift = 0;
    // (Off the floor, the lift it was giving her eases away, a spring: let go
    // at once, her whole body dropped by it, up to 20 cm from a crouch, in the
    // one frame she took off.)
    if (!bodyFloor && dt > 0) {
      const W = 14, d = this.lift || 0, v = this.liftV || 0, e = Math.exp(-W * dt), n = v + W * d;
      lift = (d + n * dt) * e; this.liftV = (v - W * n * dt) * e;
    } else this.liftV = 0;
    for (let pass = 0; pass < 4; pass++) {
      this.pose(s, t, lift);
      if (!bodyFloor) { this.squash = 0; break; }
      const low = this.lowest(this.bodySamples);
      this.squash = Math.max(0, -low);
      if (low >= -this.maxSquash) break;
      lift += -this.maxSquash - low;
      this.squash = this.maxSquash;
    }
    this.lift = lift;
    if (!contact) this.squash = 0;
    // Paws: if a paw's own skin (pads, heel) would dip below the floor, its
    // target rises by that much and the leg solves again.
    for (const [k, L] of Object.entries(this.legs)) {
      const last = this.lastLeg[k];
      if (!contact || s.paws[k].free) continue;
      for (let pass = 0; pass < 2; pass++) {
        const low = this.lowest(this.pawSamples[k]);
        if (low >= -.002) break;
        last.sole.y += .002 - low;
        this.solveLeg(L, last.sole, last.pawQ, last.parentQ, last.bodyQ);
      }
    }
    syncHelpers(this.B);
    this.cat.root.updateMatrixWorld(true);
    if (contact) this.tailOnFloor();
    if (s.tail?.solids?.length) this.clearTail(s.tail.solids);
    if (s.face) this.cat.updateFace(dt, t, s.face, s.look || {x: 0, y: 0});
    this.cat.root.updateMatrixWorld(true);
  }

  pose(s, t, lift = 0) {
    const B = this.B, cat = this.cat, I = new THREE.Quaternion();
    cat.model.position.copy(this.modelPos);
    cat.root.updateMatrixWorld(true);
    for (const b of Object.values(B)) b.scale.set(1, 1, 1);
    // The face (updateFace) turns the jaw and ears on from rest each frame.
    for (const n of ['jaw', 'earR', 'earL']) B[n].quaternion.identity();
    // Pelvis: the hips bone is the skeleton's root.
    const pel = ypr(s.pelvis.yaw, s.pelvis.pitch, s.pelvis.roll);
    this.setTurn('hips', pel, I);
    B.hips.position.copy(this.mesh.worldToLocal(cat.root.localToWorld(_v.copy(s.pelvis.pos).add(_v2.set(0, lift, 0)))));
    const spine = pel.clone().multiply(ypr(s.spine.yaw, s.spine.pitch, s.spine.roll));
    this.setTurn('spine', spine, pel);
    const chest = spine.clone().multiply(ypr(s.chest.yaw, s.chest.pitch, s.chest.roll));
    this.setTurn('chest', chest, spine);
    // Breathing: the belly and ribs swell, the chest beyond kept to size.
    // (Before the legs are solved, so the paws stay exactly on their marks.)
    const br = s.breathe || 0;
    B.spine.scale.set(1 + br * .45, 1 + br, 1 + br * .1);
    B.chest.scale.set(1 / (1 + br * .45), 1 / (1 + br), 1 / (1 + br * .1));
    // Head: held in the world (steady, level), the neck sharing the turn.
    const head = ypr(s.head.yaw, s.head.pitch, s.head.roll).multiply(this.restHeadQ);
    const neck = chest.clone().slerp(head, s.neckShare ?? .5);
    this.setTurn('neck', neck, chest);
    this.setTurn('head', head, neck);
    // (Where the head would ride, measured each frame; then the neck tips
    // up or down about its base to carry the head toward the asked height.)
    cat.root.updateMatrixWorld(true);
    const hy = cat.root.worldToLocal(B.head.getWorldPosition(_v)).y;
    this.headY0 = hy;
    if (s.headLevel?.w > 0) {
      const n = cat.root.worldToLocal(B.neck.getWorldPosition(_v2)), dy = hy - n.y, len = Math.hypot(dy, _v.z - n.z);
      const a = Math.asin(THREE.MathUtils.clamp(dy / len, -1, 1)), b = Math.asin(THREE.MathUtils.clamp((dy + s.headLevel.w * (s.headLevel.y - hy)) / len, -1, 1));
      neck.premultiply(_q2.setFromAxisAngle(X, -THREE.MathUtils.clamp(b - a, -.5, .5)));
      this.setTurn('neck', neck, chest);
      this.setTurn('head', head, neck);
    }
    // Shoulder blades: a swing about the side-to-side axis (pivoting near
    // the top), and a lift as the leg below takes weight.
    for (const side of ['L', 'R']) {
      const sc = s.scap?.[side] || {angle: 0, lift: 0};
      const q = chest.clone().multiply(_q2.setFromAxisAngle(X, -sc.angle));
      this.setTurn('scapula' + side, q, chest);
      this.offset('scapula' + side, _v2.set(0, sc.lift || 0, 0).applyQuaternion(chest), chest);
    }
    cat.root.updateMatrixWorld(true);
    // Legs.
    for (const [k, L] of Object.entries(this.legs)) {
      const paw = s.paws[k];
      const parentQ = L.front ? this.dW['scapula' + (L.side > 0 ? 'L' : 'R')] : pel;
      const pawQ = ypr(paw.yaw ?? s.pelvis.yaw, paw.pitch || 0, paw.roll || 0);
      this.lastLeg[k] = {sole: paw.pos.clone(), pawQ, parentQ, bodyQ: L.front ? chest : pel};
      this.solveLeg(L, paw.pos, pawQ, parentQ, L.front ? chest : pel);
    }
    syncHelpers(B);
    // Tail (the app's own tail shaping, from the hips).
    const P = cat.pose, tl = s.tail || {};
    P.tailLift = tl.lift ?? -.55; P.tailCurl = tl.curl ?? .2; P.tailSide = tl.side ?? 0;
    cat.tailUp = tl.up || 0;
    cat.poseTail(t, {amp: tl.amp ?? .2, speed: tl.speed ?? 1.2});
    cat.root.updateMatrixWorld(true);
    if (tl.floor > 0) this.drapeTail(tl.floor, tl.wrap ?? 1, tl.radius ?? .2, pel, tl.bounds);
  }

  // The tail lying on the floor: from its root it drops to the floor just
  // behind her, then curves round her side on a smooth arc. w blends from
  // the tail's own (lifted, swaying) shape to the draped one. bounds (a
  // circle on the floor, {x, z, r}, in the world): lying in a round bed, the
  // tail keeps inside its rim, following it round.
  drapeTail(w, wrap, R, pel, bounds = null) {
    const B = this.B, proc = [], P = new THREE.Vector3(), cur = new THREE.Vector3(), want = new THREE.Vector3();
    for (let i = 0; i < 8; i++) proc.push(B['tail' + i].quaternion.clone());
    const rootQ = this.cat.root.getWorldQuaternion(new THREE.Quaternion()), floor = this.rootY();
    const f = Z.clone().applyQuaternion(pel).applyQuaternion(rootQ).setY(0).normalize(), left = new THREE.Vector3().crossVectors(Y, f).normalize();
    const e1 = f.clone().negate(), e2 = left.clone().multiplyScalar(wrap);
    const base = B.tail0.getWorldPosition(new THREE.Vector3());
    const r0 = this.tailR[0];
    // From the root the tail curves down and back onto the floor (a smooth
    // bend, not a corner), then lies along an arc round her.
    const C = base.clone().addScaledVector(e1, .24); C.y = floor + r0;
    const K = base.clone().addScaledVector(e1, .07); K.y = floor + r0;
    const pts = [base.clone()], lens = [0];
    for (let k = 1; k <= 16; k++) {
      const s = k / 16, q = base.clone().multiplyScalar((1 - s) * (1 - s)).addScaledVector(K, 2 * s * (1 - s)).addScaledVector(C, s * s);
      lens.push(lens[k - 1] + q.distanceTo(pts[k - 1])); pts.push(q);
    }
    const l0 = lens[16];
    const path = (u, y) => {
      if (u <= l0) {
        let k = 1; while (k < 16 && lens[k] < u) k++;
        const q = pts[k - 1].clone().lerp(pts[k], (u - lens[k - 1]) / (lens[k] - lens[k - 1] || 1));
        return q.setY(Math.max(q.y, y));
      }
      const ph = (u - l0) / R;
      return C.clone().addScaledVector(e1, R * Math.sin(ph)).addScaledVector(e2, R * (1 - Math.cos(ph))).setY(y);
    };
    let u = 0;
    for (let i = 0; i < 8; i++) {
      const bone = B['tail' + i];
      bone.getWorldPosition(P);
      u += this.tailLen[i];
      want.copy(path(u, floor + this.tailR[i + 1] + .004));
      if (bounds) {
        const dx = want.x - bounds.x, dz = want.z - bounds.z, d = Math.hypot(dx, dz);
        if (d > bounds.r) { want.x = bounds.x + dx / d * bounds.r; want.z = bounds.z + dz / d * bounds.r; }
      }
      want.sub(P).normalize();
      if (i < 7) B['tail' + (i + 1)].getWorldPosition(cur); else bone.localToWorld(cur.copy(this.tailTip));
      cur.sub(P).normalize();
      const turn = _q.setFromUnitVectors(cur, want);
      const wq = bone.getWorldQuaternion(new THREE.Quaternion());
      const pq = bone.parent.getWorldQuaternion(new THREE.Quaternion());
      const draped = pq.invert().multiply(turn).multiply(wq);
      bone.quaternion.copy(proc[i]).slerp(draped, w);
      bone.updateMatrixWorld(true);
    }
  }

  // Soft contact: skin pressing below the floor is squashed onto it (with a
  // soft fall-off over the last few millimetres) rather than passing through
  // it, as a cat's haunch or belly flattens where it rests. The contact rule
  // above keeps the squash small (maxSquash); anything more lifts the body.
  enableSoftFloor(floorY = 0, soft = .012) {
    this.floorU = {floorY: {value: floorY}, floorSoft: {value: soft}};
    for (const m of [this.cat.skinned.material, this.cat.fur?.material].filter(Boolean)) {
      const prev = m.onBeforeCompile, key = m.customProgramCacheKey?.() || '';
      m.onBeforeCompile = (sh, r) => {
        prev?.call(m, sh, r);
        Object.assign(sh.uniforms, this.floorU);
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', '#include <common>\nuniform float floorY;\nuniform float floorSoft;')
          .replace('#include <project_vertex>', `{
            vec4 fw = modelMatrix * vec4(transformed, 1.0);
            float top = floorY + floorSoft;
            if (fw.y < top) {
              fw.y = top - floorSoft * (1.0 - exp(-(top - fw.y) / floorSoft));
              transformed = (inverse(modelMatrix) * fw).xyz;
            }
          }
          #include <project_vertex>`);
      };
      m.customProgramCacheKey = () => key + '-softfloor';
      m.needsUpdate = true;
    }
  }

  // Where the skin actually is (the mesh skinned on the CPU), for a sample
  // of vertices: the lowest point, in world height.
  lowest(samples) {
    this.mesh.skeleton.update();
    let low = Infinity;
    const base = this.rootY();
    for (const i of samples) {
      _v.fromBufferAttribute(this.mesh.geometry.attributes.position, i);
      this.mesh.applyBoneTransform(i, _v);
      _v.applyMatrix4(this.mesh.matrixWorld);
      if (_v.y < low) low = _v.y;
    }
    return low - base;
  }
  // Every vertex below the floor (by more than `tol`): how many, how deep.
  belowFloor(tol = .01) {
    this.mesh.skeleton.update();
    const N = this.mesh.geometry.attributes.position.count, base = this.rootY();
    let n = 0, deep = 0;
    for (let i = 0; i < N; i++) {
      _v.fromBufferAttribute(this.mesh.geometry.attributes.position, i);
      this.mesh.applyBoneTransform(i, _v);
      _v.applyMatrix4(this.mesh.matrixWorld);
      const y = _v.y - base;
      if (y < -tol) { n++; deep = Math.max(deep, -y); }
    }
    return {n, deep, of: N};
  }

  // The tail rests along the floor: working out from the root, any tail
  // bone whose skin would go below the floor is turned up just enough to
  // lie on it (keeping its direction across the floor), using the real skin
  // of the tail, not an assumed thickness.
  tailOnFloor() {
    const B = this.B, a = new THREE.Vector3(), end = new THREE.Vector3(), d = new THREE.Vector3(), d2 = new THREE.Vector3();
    for (let i = 0; i < 8; i++) {
      const samples = this.tailSamples[i];
      if (!samples.length) continue;
      for (let pass = 0; pass < 4; pass++) {
        const low = this.lowest(samples);
        // (A little squash is fine: the soft floor flattens it. The tip's
        // skin curls off the bone line in the sculpt, so it rests a touch
        // lower than the bones suggest.)
        if (low >= -.025) break;
        const bone = B['tail' + i];
        bone.getWorldPosition(a);
        if (i < 7) B['tail' + (i + 1)].getWorldPosition(end); else bone.localToWorld(end.copy(this.tailTip));
        d.subVectors(end, a);
        const L = d.length();
        // Raise the far end by the shortfall (the skin under it follows).
        const dy = clamp(d.y + (-.025 - low), -L, L), hl = Math.sqrt(Math.max(0, L * L - dy * dy));
        d2.set(d.x, 0, d.z);
        if (d2.lengthSq() < 1e-10) d2.set(0, 0, -1);
        d2.normalize().multiplyScalar(hl).setY(dy);
        const turn = _q.setFromUnitVectors(d.normalize(), d2.normalize());
        const wq = bone.getWorldQuaternion(new THREE.Quaternion());
        const pq = bone.parent.getWorldQuaternion(new THREE.Quaternion());
        bone.quaternion.copy(pq.invert().multiply(turn).multiply(wq));
        bone.updateMatrixWorld(true);
      }
    }
  }

  // The tail kept out of the furniture. solids: boxes and round things in
  // the world ({kind: 'box', x0, x1, y0, y1, z0, z1}, {kind: 'cyl', x, z,
  // r, y0, y1}, or a turned box {kind: 'rbox', x, z, ry, hx, hz, y0, y1}).
  // From the root out, a joint inside something (allowing the tail's
  // thickness) has its bone turn to bring it out by the nearest face, the
  // rest of the tail following; lying on top of a thing counts as out.
  clearTail(solids) {
    const B = this.B, a = new THREE.Vector3(), end = new THREE.Vector3(), n = new THREE.Vector3(), best = new THREE.Vector3(), bend = new THREE.Vector3();
    for (let i = 0; i < 8; i++) {
      const bone = B['tail' + i], r = this.tailR[i + 1] + .01;
      for (let pass = 0; pass < 3; pass++) {
        if (i < 7) B['tail' + (i + 1)].getWorldPosition(end); else bone.localToWorld(end.copy(this.tailTip));
        let depth = 0;
        for (const sd of solids) { const d = solidDepth(sd, end, r, n); if (d > depth) { depth = d; best.copy(n); } }
        if (depth <= .002) break;
        bone.getWorldPosition(a);
        const L = _v.subVectors(end, a).length(); _v.normalize();
        _v2.copy(end).addScaledVector(best, depth).sub(a).normalize();
        // Pointing straight into the face, a turn toward the way out does
        // nothing (it's along the bone): it bends up along the face instead,
        // enough that its reach into the thing is gone.
        if (_v.dot(best) < -.7) {
          const th = Math.acos(clamp(1 - depth / Math.max(L, 1e-3), 0, 1));
          bend.copy(Y).addScaledVector(_v, -_v.dot(Y));
          if (bend.lengthSq() < 1e-6) bend.crossVectors(_v, X);
          bend.normalize();
          _v2.copy(_v).multiplyScalar(Math.cos(th)).addScaledVector(bend, Math.sin(th)).normalize();
        }
        const turn = _q.setFromUnitVectors(_v, _v2);
        const wq = bone.getWorldQuaternion(new THREE.Quaternion());
        const pq = bone.parent.getWorldQuaternion(new THREE.Quaternion());
        bone.quaternion.copy(pq.invert().multiply(turn).multiply(wq));
        bone.updateMatrixWorld(true);
      }
    }
  }

  // Two-bone IK: the upper and middle bones turn so the lowest joint lands
  // where the paw (at its given angle) puts its sole on the target. The knee
  // bends forward on hind legs, the elbow back on front legs.
  solveLeg(L, sole, pawQ, parentQ, bodyQ) {
    const [na, nb, nc] = L.bones;
    const A = this.pos(na, new THREE.Vector3());
    const C = sole.clone().sub(_v.copy(L.soleOff).applyQuaternion(pawQ)); // the lowest joint
    let d = A.distanceTo(C);
    const reach = L.la + L.lb - 1e-4;
    const u = C.clone().sub(A).normalize();
    if (d > reach) { C.copy(A).addScaledVector(u, reach); d = reach; }
    d = Math.max(d, Math.abs(L.la - L.lb) + 1e-3);
    const fwd = Z.clone().applyQuaternion(bodyQ);
    const pole = L.front ? fwd.clone().negate() : fwd;
    const perp = pole.clone().addScaledVector(u, -pole.dot(u)).normalize();
    const cosA = clamp((L.la * L.la + d * d - L.lb * L.lb) / (2 * L.la * d), -1, 1);
    const Bj = A.clone().addScaledVector(u, L.la * cosA).addScaledVector(perp, L.la * Math.sqrt(1 - cosA * cosA));
    // Side axis of the leg's bend (her left).
    const side = X.clone().applyQuaternion(bodyQ);
    const qa = frameTurn(L.dirA, Bj.clone().sub(A).normalize(), side);
    const qb = frameTurn(L.dirB, C.clone().sub(Bj).normalize(), side);
    this.setTurn(na, qa, parentQ);
    this.setTurn(nb, qb, qa);
    this.setTurn(nc, pawQ, qb);
    this.cat.root.updateMatrixWorld(true);
    L.reachShort = A.distanceTo(sole.clone().sub(_v.copy(L.soleOff).applyQuaternion(pawQ))) - (L.la + L.lb);
  }
}

// The turn that takes a bone from its rest direction to a new one, keeping
// its side axis as close as possible to `side` (so legs don't twist).
function frameTurn(rest, now, side) {
  const s0 = X.clone().addScaledVector(rest, -X.dot(rest)).normalize();
  const s1 = side.clone().addScaledVector(now, -side.dot(now)).normalize();
  const m0 = _m.makeBasis(rest, s0, rest.clone().cross(s0));
  const m1 = _m2.makeBasis(now, s1, now.clone().cross(s1));
  return new THREE.Quaternion().setFromRotationMatrix(m1.multiply(m0.transpose()));
}

// ---------------------------------------------------------------------------
// Authoring helpers.

// A channel of keys [time, value, ease] (ease into that key: 'io' smooth,
// 'o' fast then settling, 'i' slow then quick, 'l' linear).
class Track {
  constructor(keys) { this.k = keys; }
  at(t) {
    const k = this.k;
    if (t <= k[0][0]) return k[0][1];
    for (let i = 1; i < k.length; i++) {
      if (t > k[i][0]) continue;
      const [t0, v0] = k[i - 1], [t1, v1, e = 'io'] = k[i];
      let u = (t - t0) / Math.max(1e-6, t1 - t0);
      u = e === 'l' ? u : e === 'o' ? 1 - (1 - u) * (1 - u) * (1 - u) : e === 'i' ? u * u * u : smoother(u);
      return v0 + (v1 - v0) * u;
    }
    return k[k.length - 1][1];
  }
}
const tr = keys => new Track(keys);

// ---------------------------------------------------------------------------
// The trial: she notices something, walks several steps, stops, sits, lies
// down and rests, breathing.
export function trialSequence(rig, opts = {}) {
  const S = rig.stance;
  const h0 = S.hips.y - .012;                 // pelvis height standing (legs just off straight)
  const W = {front: S.width.front * .82, hind: S.width.hind * .82}; // she walks with her paws closer in
  // Paw places relative to the pelvis (standing): under the shoulders and hips.
  const off = {
    LF: new THREE.Vector3(S.mid + W.front, 0, S.frontZ - S.hips.z),
    RF: new THREE.Vector3(S.mid - W.front, 0, S.frontZ - S.hips.z),
    LH: new THREE.Vector3(S.mid + W.hind, 0, S.hindZ - S.hips.z),
    RH: new THREE.Vector3(S.mid - W.hind, 0, S.hindZ - S.hips.z),
  };
  // Walking, the front paws land a little further back (so the leg reaches
  // its print as it lands) and she carries herself a touch lower.
  const walkOff = {LF: -.05, RF: -.05, LH: 0, RH: 0};
  const X0 = S.hips.x, Z0 = 0;

  // ---- Timeline ------------------------------------------------------------
  const T = {notice: 0, walk: 1.9, walkEnd: 0, sit: 0, lie: 0, end: 0};
  // Walk: speed builds over the first steps and eases off over the last.
  const v = opts.speed ?? .62, cycle = opts.cycle ?? 1.0, duty = .64;
  const cruise = 2.4, ramp = .9;
  T.walkEnd = T.walk + ramp + cruise + ramp;
  const bodyZs = t => {
    if (t <= T.walk) return Z0;
    const a = T.walk, b = a + ramp, c = b + cruise, d = c + ramp;
    const sp = tt => tt <= a ? 0 : tt < b ? v * smoother((tt - a) / ramp) : tt < c ? v : tt < d ? v * (1 - smoother((tt - c) / ramp)) : 0;
    // Integrate the speed (fine steps; it's only built once per call site).
    let z = Z0, n = Math.ceil((Math.min(t, d) - a) / .01);
    for (let i = 0; i < n; i++) { const t0 = a + i * .01, t1 = Math.min(t, a + (i + 1) * .01); z += sp((t0 + t1) / 2) * (t1 - t0); }
    return z;
  };
  const zTable = [];
  for (let t = 0; t <= T.walkEnd + 3; t += .01) zTable.push(bodyZs(t));
  const zAt = t => { const i = clamp(t / .01, 0, zTable.length - 1), i0 = Math.floor(i); return lerp(zTable[i0], zTable[Math.min(i0 + 1, zTable.length - 1)], i - i0); };
  const Zstop = zAt(T.walkEnd + 1);

  // Four-beat walk: left hind, left fore, right hind, right fore. A paw lands
  // so the leg is upright at the middle of its time on the ground.
  const phase = {LH: 0, LF: .25, RH: .5, RF: .75};
  const steps = {}; // per paw: [{t0, t1, from, to}] swings; planted between
  // The first paw to lift is the left fore (after a weight shift), the
  // others in sequence.
  const firstLift = T.walk + .08;
  const lift0 = (phase.LF + duty) % 1;
  const plan = {};
  for (const k of Object.keys(phase)) {
    const liftPh = (phase[k] + duty) % 1;
    let tl = firstLift + (((liftPh - lift0) % 1 + 1) % 1) * cycle;
    const swings = [];
    let at = new THREE.Vector3(X0 + off[k].x, 0, Z0 + off[k].z);
    for (let n = 0; n < 20; n++) {
      const td = tl + (1 - duty) * cycle;                // touch down
      const mid = td + duty * cycle / 2;                 // middle of the next stance
      const z = zAt(Math.min(mid, T.walkEnd)) + off[k].z + (mid < T.walkEnd ? walkOff[k] : 0);
      const to = new THREE.Vector3(X0 + off[k].x, 0, z);
      if (to.z - at.z < .02) break;                      // body's stopped: no step needed
      swings.push({t0: tl, t1: td, from: at.clone(), to: to.clone()});
      at = to;
      if (mid >= T.walkEnd) break;
      tl += cycle;
    }
    plan[k] = swings;
  }
  // When the last paw is down and still, she's stopped.
  const lastDown = Math.max(...Object.values(plan).map(s => s.length ? s[s.length - 1].t1 : 0));
  T.stop = Math.max(T.walkEnd, lastDown);
  T.sit = T.stop + 1.0;
  T.lie = T.sit + 2.6;
  T.end = T.lie + 5.5;

  // Paw on the floor between swings; lifted and carried in a swing.
  const pawAt = (k, t) => {
    const sw = plan[k];
    let pos = new THREE.Vector3(X0 + off[k].x, 0, Z0 + off[k].z), pitch = 0, planted = true, lift = 0, swingU = -1;
    for (const s of sw) {
      if (t >= s.t1) { pos = s.to.clone(); continue; }
      if (t > s.t0) {
        const u = (t - s.t0) / (s.t1 - s.t0);
        swingU = u;
        const e = smoother(clamp((u - .05) / .9, 0, 1));
        pos = s.from.clone().lerp(s.to, e);
        // Lifted quickly, carried low, set down softly.
        const front = LEGS[k].front;
        const H = (front ? .07 : .06) * clamp((s.to.z - s.from.z) / .5, .45, 1);
        lift = H * Math.pow(Math.sin(Math.PI * Math.pow(u, .8)), 1.3);
        pos.y = lift;
        // The paw flexes back as it leaves the floor and reaches forward to land.
        pitch = front ? -1.1 * Math.sin(Math.PI * clamp(u * 1.25, 0, 1)) * (1 - u) + .15 * smoothstep(u, .6, .95) * (1 - smoothstep(u, .95, 1))
                      : -.7 * Math.sin(Math.PI * clamp(u * 1.3, 0, 1)) * (1 - u);
        planted = false;
      } else {
        // Before this swing: on the floor; late in stance the heel/wrist
        // starts to rise, rolling over the toes.
        const toLift = s.t0 - t;
        const roll = 1 - smoothstep(toLift, 0, .22);
        pitch = (LEGS[k].front ? -.35 : -.45) * roll;
      }
      break;
    }
    return {pos, pitch, planted, lift, swingU};
  };

  // How much each leg is swinging now (0 planted .. 1 mid-swing).
  const swingOf = (k, t) => { const p = pawAt(k, t); return p.planted ? 0 : Math.sin(Math.PI * clamp(p.swingU, 0, 1)); };

  // ---- Body channels: notice, stop, sit, lie down, rest ---------------------
  const ts = T.sit, tl = T.lie;
  const ch = {
    // Pelvis height and tilt, spine/chest bends.
    // (Heights set from where her skin meets the floor: sitting on her
    // haunches, then lying on her belly and right hip.)
    pelY: tr([[0, h0], [ts + .15, h0 + .005, 'io'], [ts + .95, .215, 'o'], [ts + 1.15, .23, 'io'], [ts + 1.35, .225, 'io'],
              [tl + .3, .225], [tl + 1.6, .26, 'io'], [tl + 2.3, .24, 'o'], [tl + 2.6, .245]]),
    pelZ: tr([[0, 0], [ts, 0], [ts + 1.0, -.15, 'io'], [tl + .3, -.15], [tl + 2.2, -.02, 'io']]), // sitting, the body pivots back over the front paws
    pelX: tr([[0, 0], [tl + .4, 0], [tl + 2.0, -.03, 'io']]),
    pelPitch: tr([[0, 0], [ts + .1, -.02], [ts + 1.0, .48, 'io'], [ts + 1.3, .46, 'io'], [tl + .4, .46], [tl + 1.9, .08, 'io'], [tl + 2.5, .02, 'io']]),
    pelRoll: tr([[0, 0], [tl + .9, 0], [tl + 2.3, .3, 'io']]),
    // Shoulder blades: sitting, they slide down the ribs (a cat has no
    // collarbone; the chest hangs between them, so the front legs reach the
    // floor); lying, they ride up as the chest sinks between them.
    scapDrop: tr([[0, 0], [ts + .3, 0], [ts + 1.1, -.075, 'io'], [tl + .5, -.075], [tl + 2.0, .015, 'io']]),
    spinePitch: tr([[0, 0], [ts + .25, 0], [ts + 1.2, .12, 'io'], [tl + .5, .12], [tl + 1.9, -.03, 'io']]),
    chestPitch: tr([[0, 0], [ts + .35, 0], [ts + 1.35, .07, 'io'], [tl + .6, .07], [tl + 1.9, -.06, 'io']]),
    spineRoll: tr([[0, 0], [tl + 1.0, 0], [tl + 2.3, -.2, 'io']]),
    // Head (world): looks up and left at something, then ahead; settles low.
    headYaw: tr([[0, 0], [.35, 0], [.75, .42, 'o'], [1.5, .4], [T.walk + .1, .1, 'io'], [T.walk + .6, 0, 'io'],
                 [T.stop + .2, 0], [T.stop + .8, -.25, 'io'], [ts + .2, -.22], [ts + 1.0, 0, 'io'], [tl + 3.2, 0], [tl + 4.0, .25, 'io']]),
    headPitch: tr([[0, -.05], [.35, -.05], [.75, .12, 'o'], [1.5, .1], [T.walk + .5, -.08, 'io'], [T.stop, -.06], [ts + 1.2, 0, 'io'],
                   [tl + .5, 0], [tl + 2.4, -.12, 'io'], [tl + 3.2, -.1], [tl + 4.0, -.2, 'io']]),
    headRoll: tr([[0, 0], [.75, .06, 'o'], [1.6, 0, 'io'], [tl + 3.2, 0], [tl + 4.0, -.1, 'io']]),
    tailLift: tr([[0, -.55], [.6, -.35, 'o'], [T.walk, -.4], [T.walk + .8, -.2, 'io'], [T.stop, -.3, 'io'], [ts + .6, -.4], [ts + 1.6, -1.2, 'io'], [tl + .8, -1.2], [tl + 2.4, -1.1, 'io']]),
    tailCurl: tr([[0, .2], [T.walk + .8, .3], [T.stop, .22], [ts + 1.6, .05, 'io'], [tl + 2.4, .05]]),
    tailSide: tr([[0, 0], [ts + .7, 0], [ts + 1.9, .9, 'io'], [tl + 1.2, .9], [tl + 2.8, 1.6, 'io']]),
    // The tail settles on to the floor once she's down, curving round her
    // left side (the camera side), and stays there.
    tailFloor: tr([[0, 0], [ts + .8, 0], [ts + 1.8, 1, 'io']]),
    tailWrapR: tr([[0, .38], [ts + 1.8, .38], [tl + 1.2, .38], [tl + 2.6, .42, 'io']]),
    breathe: tr([[0, 1], [T.stop, 1.2], [ts + 2.0, .9], [tl + 3.0, 1.4]]),
    breatheRate: tr([[0, .45], [T.stop, .5], [ts + 2, .4], [tl + 2.5, .4], [tl + 4.5, .28, 'io']]), // breaths a second
    eyes: tr([[0, .75], [.45, .75], [.6, 1, 'o'], [1.6, .95], [T.walk + .5, .75, 'io'], [tl + 2.6, .7], [tl + 3.6, .3, 'io'], [tl + 4.6, .25]]),
  };
  // Front paws during sit (one small step back to tidy) and lie down (two
  // steps forward as the chest lowers): extra swings for the front paws.
  const extra = {
    // Sitting: the front paws shuffle back under the chest as the
    // hindquarters drop (right, then left); lying down: they walk out again.
    RF: [{t0: ts + .45, t1: ts + .75, dz: -.1, dx: .01}, {t0: tl + .85, t1: tl + 1.25, dz: .24, dx: 0}],
    LF: [{t0: ts + .8, t1: ts + 1.1, dz: -.1, dx: -.01}, {t0: tl + 1.2, t1: tl + 1.6, dz: .24, dx: 0}],
    // Hind paws: as the hips roll on to her right side, the left hind slides
    // its paw out a little under the haunch.
    // Lying: the hind legs fold out to the sides, so the belly can rest on
    // the floor: the left beside her belly, the right (the side she rolls
    // towards) well out and forward.
    LH: [{t0: tl + 1.2, t1: tl + 1.7, dz: .16, dx: .16}],
    RH: [{t0: tl + 1.55, t1: tl + 2.05, dz: .2, dx: -.2}],
  };
  for (const [k, list] of Object.entries(extra)) {
    for (const e of list) {
      const from = pawAt(k, e.t0 - 1e-3).pos.clone().setY(0);
      plan[k].push({t0: e.t0, t1: e.t1, from, to: from.clone().add(new THREE.Vector3(e.dx, 0, e.dz))});
    }
  }

  // Paw angle when sitting / lying (overrides the walking roll):
  //  hind: from sitting on, the hock lies along the floor (heel down).
  //  front: lying, the forearm lies along the floor, the paw flat ahead.
  const hockDown = tr([[0, 0], [ts + .3, 0], [ts + 1.0, 1, 'io']]);
  const foreDown = tr([[0, 0], [tl + .5, 0], [tl + 2.0, 1, 'io']]);

  // Breathing phase (its rate changes, so it's added up over time).
  const brTable = [0];
  for (let t = .01; t <= T.end + 1; t += .01) brTable.push(brTable[brTable.length - 1] + ch.breatheRate.at(t) * .01);
  const breathPhase = t => { const i = clamp(t / .01, 0, brTable.length - 1), i0 = Math.floor(i); return lerp(brTable[i0], brTable[Math.min(i0 + 1, brTable.length - 1)], i - i0); };

  // ---- state(t) --------------------------------------------------------------
  const state = t => {
    const walking = t > T.walk - .4 && t < T.stop + .5;
    const sw = {LF: swingOf('LF', t), RF: swingOf('RF', t), LH: swingOf('LH', t), RH: swingOf('RH', t)};
    // Weight shifts: before the first step, onto the right hind and fore
    // (back and right); while walking, away from the swinging legs.
    const pre = smoothstep(t, T.walk - .45, T.walk - .05) * (1 - smoothstep(t, T.walk + .1, T.walk + .5));
    const swayH = .012 * (sw.RH - sw.LH), swayF = .01 * (sw.RF - sw.LF);
    const z = zAt(t) + ch.pelZ.at(t);
    const low = smoothstep(t, T.walk - .2, T.walk + .6) * (1 - smoothstep(t, T.stop - .4, T.stop + .4));
    const pelY = ch.pelY.at(t) - (walking ? .006 * (sw.LH + sw.RH) + .003 * (sw.LF + sw.RF) : 0) - .006 * pre - .02 * low;
    // Hips: the swinging side dips a little and turns forward.
    const pelRoll = ch.pelRoll.at(t) + .045 * (sw.RH - sw.LH);
    const pelYaw = .03 * (sw.RH - sw.LH);
    const chestRoll = .03 * (sw.RF - sw.LF);
    const pos = new THREE.Vector3(X0 + ch.pelX.at(t) + swayH - .012 * pre, pelY, z - .015 * pre + .012 * smoothstep(t, T.stop - .3, T.stop) * (1 - smoothstep(t, T.stop, T.stop + .7)));
    const paws = {};
    for (const k of Object.keys(LEGS)) {
      const p = pawAt(k, t);
      const front = LEGS[k].front;
      let pitch = p.pitch;
      if (!front) pitch = lerp(pitch, .4, hockDown.at(t));
      else pitch = lerp(pitch, .0, foreDown.at(t));
      paws[k] = {pos: p.pos.setY(p.pos.y + (p.planted ? 0 : 0)), pitch, yaw: 0, planted: p.planted};
    }
    // Shoulder blades: each swings with its leg and lifts while the leg
    // below carries weight.
    const scapFor = k => {
      const p = pawAt(k, t);
      const rel = p.pos.z - (z + off[k].z);          // paw ahead (+) or behind (-) of the shoulder
      return {angle: walking ? clamp(rel * .9, -.25, .25) : 0, lift: (walking ? .01 * (1 - sw[k]) : 0) + ch.scapDrop.at(t)};
    };
    const breatheDepth = .012 * ch.breathe.at(t);
    return {
      pelvis: {pos, yaw: pelYaw, pitch: ch.pelPitch.at(t), roll: pelRoll},
      spine: {yaw: -.5 * pelYaw + .02 * (sw.LF - sw.RF), pitch: ch.spinePitch.at(t), roll: ch.spineRoll.at(t) + chestRoll * .5},
      chest: {yaw: 0, pitch: ch.chestPitch.at(t) + .03 * pre - .035 * low, roll: chestRoll * .5},
      head: {yaw: ch.headYaw.at(t), pitch: ch.headPitch.at(t), roll: ch.headRoll.at(t)},
      neckShare: .5,
      scap: {L: scapFor('LF'), R: scapFor('RF')},
      paws,
      tail: {lift: ch.tailLift.at(t), curl: ch.tailCurl.at(t), side: ch.tailSide.at(t), amp: walking ? .3 : .12, speed: walking ? 2 : 1,
             floor: ch.tailFloor.at(t), wrap: 1, radius: ch.tailWrapR.at(t)},
      // In a little quicker than out.
      breathe: breatheDepth * (() => { const ph = breathPhase(t) % 1; return ph < .4 ? -Math.cos(Math.PI * ph / .4) : Math.cos(Math.PI * (ph - .4) / .6); })(),
      eyes: ch.eyes.at(t),
    };
  };
  return {T, state, plan, duration: T.end, stance: {h0, off}};
}
