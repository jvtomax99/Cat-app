// The new movement in the app: drives the repaired rig (rig v2) with the
// motion trial's approach, behind the same cat.update(dt, t, ctl) the app
// already calls, so the app's behaviour code doesn't change.
//
//  - Body poses (stand, sit, loaf, sleep, crouch, stretch, beg, belly, leap)
//    are targets for the pelvis, spine, chest, shoulder blades, head and
//    tail. Changing pose, each part moves on its own timing: settling down,
//    the hips lead and the chest follows; getting up, the chest leads.
//  - Paws are planted in the world. Walking is the four-beat walk, its
//    stride and rhythm following how fast she's actually moving; each paw
//    lands where the leg will be upright mid-stance. Standing, turning or
//    changing pose, a paw that's far from where that pose wants it takes a
//    small step there, one at a time (her shuffles back to sit, forward to
//    lie down). In the air the paws reach and tuck; riding the vacuum they
//    stay planted on it.
//  - Her support surface (floor, shelf, counter, sink, vacuum) is always the
//    height she's standing at: the body, paws and tail rest on it with the
//    soft contact (switched off mid-jump).
import * as THREE from 'three';
import {MotionRig, LEGS} from './motion.js';

const {clamp, smoothstep, lerp, damp} = THREE.MathUtils;
const smoother = k => (k = clamp(k, 0, 1), k * k * k * (k * (k * 6 - 15) + 10));
const PAWS = Object.keys(LEGS);
const PHASE = {LH: 0, LF: .25, RH: .5, RF: .75}; // four-beat walk
// Trotting (from about 1.0, where a real cat leaves its walk): diagonal
// pairs move together, left hind with right front. (RF is 1, not 0, so the
// blends from the walk's .75 and to the gallop's .7 go the short way round.)
const PHASE_TROT = {LH: 0, RF: 1, RH: .5, LF: .5};
// Flat out (from 2.2, or from the first step of a dash), a gallop: the hind
// legs push off one after the other (a sixth of a stride apart, so they
// don't hop together like a rabbit's), then the front legs land one after
// the other; after the second front paw leaves, a moment with all four paws
// off the floor, gathered under her, before the hind paws land again.
const PHASE_RUN = {LH: 0, RH: .17, LF: .47, RF: .62};
// A gallop's strides a second at her size (a real cat's 3.5 to 4, slowed for
// a body about twice as long), and how far a paw travels back under her
// while it's down.
const RUN_HZ = 2.6, RUN_STANCE = .29;
// The walk is set to numbers measured in walking cats (Day & Jayne 2007 and
// others; docs/phases/07-walk-grace.md): stride 1.2x the old one, hind paws
// down less of the stride than the front (.57 / .62), carried 5 cm lower
// (legs bent: hips at ~77% of leg length at mid-stance), hind paws in under
// the hips like the front ones under the chest, half the old hip sway.
// Preview flags: ?walk=old is the old walk (all four off); each part on its
// own: ?gait=old, ?low=0, ?track=wide, ?sway=1. ?hindlift=0.8 steps the hind
// paws 20% lower.
const AB = new URLSearchParams(globalThis.location?.search || ''), OLD = AB.get('walk') === 'old';
const HIND_LIFT = +(AB.get('hindlift') || 1), NARROW = !OLD && AB.get('track') !== 'wide', LONG = !OLD && AB.get('gait') !== 'old';
const STRIDE_K = LONG ? 1.2 : 1, SWAY = +(AB.get('sway') || (OLD ? 1 : .5));
const CARRY_LOW = +(AB.get('low') || (OLD ? 0 : .05));
// (A pat's roll of the chest: her right shoulder up.)
const SWAT_ROLL = +(AB.get('swatroll') || .2);

// Pose targets, relative to her standing stance (pelvis offsets in her own
// frame; paw places relative to the standing ones; angles in radians).
const BASE = {y: 0, z: 0, x: 0, pitch: 0, roll: 0, yaw: 0, spine: 0, spineRoll: 0, spineYaw: 0, chest: 0, chestYaw: 0, scap: 0,
  fdz: 0, fdx: 0, lhx: 0, lhz: 0, rhx: 0, rhz: 0, hock: 0, wrist: 0, headPitch: 0, headYaw: 0, headRoll: 0,
  tailLift: -.55, tailCurl: .2, tailSide: 0, tailFloor: 0, tailR: .38, tailWrap: 1};
const POSES = {
  stand: {},
  // Low and ready: the chest drops between the shoulder blades, which ride up.
  crouch: {y: -.07, z: -.02, pitch: -.03, chest: -.06, scap: .03, hock: -.1, headPitch: -.04, tailLift: -.75, tailCurl: .05},
  // Eating or drinking: hind legs gathered, the front dipped, shoulder
  // blades high and the neck stretched down to the bowl.
  eat: {y: -.06, z: .02, pitch: -.12, spine: -.03, chest: -.2, scap: .055, hock: -.1, headPitch: 0, tailLift: -.8, tailCurl: .05},
  // Sitting (from the trial): the body pivots back over the front paws, the
  // shoulder blades slide down the ribs so the front legs reach the floor,
  // the hocks lie along it and the tail wraps round.
  sit: {y: .225, z: -.15, pitch: .46, spine: .12, chest: .07, scap: -.075, fdz: -.14, hock: .4, tailLift: -1.2, tailCurl: .05, tailSide: .9, tailFloor: 1, tailR: .38, abs: true},
  // Lying on her belly, hips rolled a little to her right, hind legs folded
  // out to the sides, front paws ahead.
  loaf: {y: .245, z: -.02, x: -.03, pitch: .02, roll: .3, spine: -.03, spineRoll: -.2, chest: -.06, scap: .015, fdz: .14, lhx: .16, lhz: .16, rhx: -.2, rhz: .2, hock: .4, headPitch: -.06, tailLift: -1.1, tailSide: 1.6, tailFloor: 1, tailR: .42, abs: true},
  // Asleep: lying, curled a little, head down.
  sleep: {y: .24, z: -.02, x: -.03, pitch: .02, roll: .35, spine: -.03, spineRoll: -.2, spineYaw: .2, chest: -.08, chestYaw: .2, scap: .02, fdz: .12, lhx: .16, lhz: .16, rhx: -.2, rhz: .2, hock: .4, headPitch: -.32, headYaw: .3, headRoll: -.1, tailFloor: 1, tailR: .3, abs: true},
  // Curled up asleep (her Christmas nap in the garland): hips turned to
  // her left, the back bent round to her right, chest down, head laid on
  // her front paws and turned back toward her tail, which wraps round to
  // her right to meet it. (No roll of the hips: bending round a rolled
  // back lifts the chest off the ground.)
  curl: {y: .24, z: -.02, x: .03, yaw: .5, pitch: .02, spine: -.1, spineYaw: -.7, chest: -.3, chestYaw: -.65, scap: .06, fdz: .1, lhx: .2, lhz: .2, rhx: -.16, rhz: .16, hock: .4, headPitch: -.9, headYaw: -1, headRoll: .25, tailLift: -1.1, tailCurl: .1, tailFloor: 1, tailR: .2, tailWrap: -1, abs: true},
  // Front paws reaching far forward, chest low, hindquarters up.
  stretch: {y: -.02, z: .05, pitch: -.3, spine: -.06, chest: -.12, scap: .04, fdz: .24, headPitch: .12, tailLift: .35, tailCurl: .15},
  // Sitting up tall, front paws lifted.
  beg: {y: .225, z: -.17, pitch: .62, spine: .2, chest: .2, scap: -.05, fdz: -.1, hock: .4, headPitch: .1, tailFloor: 1, abs: true, frontFree: [.0, .12, .1]},
  // Rolled on to her back, paws in the air.
  belly: {y: .2, z: 0, roll: 1.45, spine: .05, headRoll: -1, headPitch: .1, tailLift: -.5, tailSide: .4, abs: true, allFree: true},
  // Draped over something round and high (the kitchen's pendant shade),
  // as cats do with chandeliers: belly on top, legs hanging down either
  // end, tail straight down, head resting forward and looking down.
  drape: {y: .13, z: 0, pitch: -.04, spine: .1, chest: -.2, scap: .07, headPitch: .55, tailLift: -1.5, tailCurl: .04, abs: true, allFree: true},
  // Mid-leap: stretched out, front paws reaching, hind legs trailing.
  leap: {y: .02, pitch: -.1, spine: -.04, chest: 0, fdz: .12, lhz: -.12, rhz: -.12, tailLift: -.2, tailCurl: -.05, allFree: true},
};
for (const k of Object.keys(POSES)) POSES[k] = {...BASE, ...POSES[k]};
const CH = Object.keys(BASE);
// How far a planted paw may be from where it belongs, forward or back and to
// the side, before its leg runs out of reach (in her own frame).
const LEASH = {x: .14, z: .26};
// (Carried lower, her legs have more reach fore and aft: on the move, not
// turning on the spot, where a paw out wide ran out of leg.)
const LEASH_Z = speed => LEASH.z * (1 + CARRY_LOW * 3 * clamp(speed / .3, 0, 1));
// How long each part takes when the pose changes, and how long it waits
// (going down to sit/lie: hips first, chest after; getting up: chest first).
const PART = c => /^(y|z|x|pitch|roll|yaw)$/.test(c) ? 'pelvis' : /^(spine|chest)/.test(c) ? 'chest' : c === 'scap' ? 'scap' : /^(fd|lh|rh|hock|wrist)/.test(c) ? 'paws' : /^head/.test(c) ? 'head' : 'tail';
const TIMING = {
  down: {pelvis: [0, .85], chest: [.25, .95], scap: [.15, .8], paws: [.1, .7], head: [0, .6], tail: [.55, 1.0]},
  up: {pelvis: [.12, .65], chest: [0, .55], scap: [0, .5], paws: [0, .4], head: [0, .45], tail: [0, .6]},
  quick: {pelvis: [0, .22], chest: [0, .25], scap: [0, .22], paws: [0, .2], head: [0, .2], tail: [0, .3]},
};
const _m = new THREE.Vector3(), _s = new THREE.Vector3();
const LOW = new Set(['sit', 'loaf', 'sleep', 'curl', 'beg', 'belly', 'drape']);

export class MotionCat {
  constructor(cat) {
    this.cat = cat;
    this.poses = POSES; // (for the QA tools)
    this.rig = new MotionRig(cat, {sampleEvery: 7});
    this.rig.enableSoftFloor(0);
    const S = this.rig.stance;
    this.S = S;
    // Where each paw stands, from its own shoulder or hip (the sculpt is
    // posed unevenly, so each side is placed from its own joint): the front
    // paws a little in under the chest, the hind ones a little out from the
    // hips, so from in front, behind or three-quarters all four legs show
    // (in line, the far ones hide behind the near). Front legs upright, the
    // hind ones just behind the hip.
    const R = this.rig.restPos;
    this.home0 = {
      LF: new THREE.Vector3(R.shoulderL.x - .015, 0, S.frontZ - .07), RF: new THREE.Vector3(R.shoulderR.x + .015, 0, S.frontZ - .07),
      LH: new THREE.Vector3(R.hipL.x + (NARROW ? -.03 : .05), 0, S.hindZ + .02), RH: new THREE.Vector3(R.hipR.x - (NARROW ? -.025 : .055), 0, S.hindZ + .02),
    };
    // Each leg's own reach (the sculpt's legs differ a little: her left hind
    // is the shortest), so a shorter leg steps a little sooner.
    this.reach = Object.fromEntries(PAWS.map(k => { const L = this.rig.legs[k]; return [k, Math.min(1, (L.la + L.lb) / .448)]; }));
    this.h0 = S.hips.y - .005;
    this.ch = {...POSES.stand, y: this.h0};
    this.from = {...this.ch};
    this.poseName = 'stand'; this.poseAt = -1; this.timing = TIMING.quick;
    this.paws = Object.fromEntries(PAWS.map(k => [k, {pos: null, swing: null, free: false}]));
    this.phase = 0; this.walkW = 0; this.lastStep = -9;
    this.prev = null; this.vel = new THREE.Vector3(); this.yawRate = 0;
    this.br = 0;
    this.groomPaw = new THREE.Vector3(); this.patAt = new THREE.Vector3();
  }

  // Where a paw belongs now (her own frame), for the pose's current blend.
  homeLocal(k, out = new THREE.Vector3()) {
    const c = this.ch, h = this.home0[k];
    out.copy(h);
    if (k[1] === 'F') { out.z += c.fdz; out.x += c.fdx * (k[0] === 'L' ? 1 : -1); }
    else if (k === 'LH') { out.x += c.lhx; out.z += c.lhz; }
    else { out.x += c.rhx; out.z += c.rhz; }
    return out;
  }

  update(dt, t, ctl) {
    dt = Math.min(dt, .1);
    const cat = this.cat, root = cat.root, rig = this.rig;
    root.updateMatrixWorld(true);
    const rootPos = root.getWorldPosition(new THREE.Vector3()), heading = root.rotation.y;
    // What each paw stands on: her root's height, or on stairs (ctl.ground,
    // a function of the world x and z) the step under that paw.
    const gy = ctl.ground ? p => ctl.ground(p.x, p.z) : () => rootPos.y;
    // How she's moving (from where the app has put her).
    if (this.prev && dt > 0) {
      const v = rootPos.clone().sub(this.prev.pos).divideScalar(dt);
      this.vel.lerp(v.setY(0), 1 - Math.exp(-12 * dt));
      let dy = heading - this.prev.heading; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      this.yawRate = lerp(this.yawRate, dy / dt, 1 - Math.exp(-10 * dt));
    }
    // (A teleport, e.g. changing rooms: up or down, or across, in one go.)
    const jumped = this.prev && ctl.air < 0 && (Math.abs(rootPos.y - this.prev.pos.y) > .5 || Math.hypot(rootPos.x - this.prev.pos.x, rootPos.z - this.prev.pos.z) > .45);
    this.prev = {pos: rootPos.clone(), heading};
    if (jumped) for (const k of PAWS) this.paws[k].pos = null;
    const speed = this.vel.length();
    const air = ctl.air >= 0 || (ctl.lift || 0) > .03;
    const riding = !!ctl.riding;

    // --- Pose channels ------------------------------------------------------
    let name = POSES[ctl.pose] ? ctl.pose : 'stand';
    if (ctl.air >= 0 || (ctl.lift || 0) > .1) name = 'leap';
    if (name !== this.poseName) {
      const goingDown = LOW.has(name) && !LOW.has(this.poseName);
      const goingUp = !LOW.has(name) && LOW.has(this.poseName);
      this.timing = goingDown ? TIMING.down : goingUp ? TIMING.up : TIMING.quick;
      if ((ctl.poseRate ?? 6) >= 9 && !goingDown && !goingUp) this.timing = TIMING.quick;
      this.from = {...this.ch}; this.poseName = name; this.poseAt = t;
    }
    const P = POSES[name];
    for (const c of CH) {
      const [delay, dur] = this.timing[PART(c)];
      const k = smoother((t - this.poseAt - delay) / dur);
      // (Pelvis height is kept as an actual height: the resting poses give
      // theirs directly, the others relative to her standing height.)
      let target = c === 'y' && !P.abs ? this.h0 + P.y : P[c];
      // Crouched but on the move (chasing a toy): she runs nearly upright;
      // the low crouch is for stalking, standing still or creeping.
      if (name === 'crouch' && this.walkW > 0) target = lerp(target, c === 'y' ? this.h0 + POSES.stand.y : POSES.stand[c], this.walkW * .85);
      this.ch[c] = lerp(this.from[c], target, k);
    }
    const c = this.ch;

    // --- Walk ------------------------------------------------------------------
    // (Turning counts too: her paws, a body's length apart, travel round as
    // she turns, so a turn on the spot is stepped round, not slid.)
    const gait = speed + Math.abs(this.yawRate) * .6;
    const walking = !air && !riding && gait > .05;
    this.walkW = damp(this.walkW, walking && speed > .05 ? 1 : 0, walking ? 6 : 4, dt);
    // (Short enough that a planted paw stays within its leg's reach for the
    // whole of its stance: quicker steps, not longer ones, as she speeds up.)
    // From 1.0 she trots; flat out (a dash, zoomies) she gallops: quick
    // bounds, each paw down for a shorter time. (Quick, not long: a long
    // bound carries her hips past where a planted hind paw can reach.)
    // (A dash is a gallop from the first bound, as a cat's is: she doesn't
    // trot her way up to it. Bounds of a steady rhythm that lengthen with
    // her speed, each paw down for a short push.)
    this.sprintW = damp(this.sprintW || 0, ctl.sprint ? 1 : 0, 8, dt);
    const trotW = AB.get('trot') === '0' ? 0 : smoother(clamp((speed - .95) / .35, 0, 1)), runW = Math.max(smoother(clamp((speed - 2.2) / .3, 0, 1)), this.sprintW * smoother(clamp((speed - .45) / .5, 0, 1)));
    this.trotW = trotW; this.runW = runW;
    const runStride = clamp(gait / RUN_HZ, .5, 1.25), runDuty = clamp(RUN_STANCE / runStride, .24, .4);
    const stride = lerp(lerp(clamp(.3 + .3 * gait, .36, .8) * STRIDE_K, clamp(.35 + .2 * gait, .6, .78), trotW), runStride, runW); // metres-equivalent per cycle at her size
    const walkDuty = clamp(.64 - .1 * (gait - .62), .42, .66);
    if (walking) this.phase = (this.phase + gait * dt / stride) % 1;
    const cycle = stride / Math.max(gait, .05);
    // Each paw: planted, swinging, or free.
    const fwdW = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
    const sw = {};
    for (const k of PAWS) {
      const pw = this.paws[k], front = k[1] === 'F';
      const home = this.homeLocal(k);
      const homeW = root.localToWorld(home.clone());
      const freePose = P.allFree || (P.frontFree && front) || air;
      if (pw.pos === null || riding) { pw.pos = homeW.clone(); pw.swing = null; }
      pw.free = false; sw[k] = 0;
      if (freePose) {
        pw.free = true; pw.swing = null;
        pw.pos.copy(homeW);
        continue;
      }
      if (walking || pw.swing?.gait) {
        // (A standing step still under way as she sets off becomes a quick
        // walking step; left as it was, nothing here would finish it, and the
        // paw would stay down and be dragged until she stopped.)
        if (pw.swing && !pw.swing.gait) pw.swing = {gait: true, early: true, from: pw.pos.clone(), t0: t};
        const duty = lerp(lerp(LONG ? Math.min(walkDuty, front ? .62 : .57) : walkDuty, .45, trotW), front ? runDuty - .01 : runDuty, runW);
        const p =((this.phase - lerp(lerp(PHASE[k], PHASE_TROT[k], trotW), PHASE_RUN[k], runW)) % 1 + 1) % 1;
        const inSwing = walking && p >= duty, near = walking && p >= duty - .12; // (its swing, or about to be)
        if (!inSwing) pw.sat = false;
        if (inSwing && !pw.swing && !pw.sat) {
          pw.swing = {gait: true, from: pw.pos.clone(), t0: t};
        }
        // A planted paw left too far behind (or beside) takes its step now,
        // a quick one, rather than being dragged until its turn comes.
        // (When the leg has gone past straight, as the rig measured it last
        // frame, or the paw is further off than a normal stance ever leaves
        // it: half the stance travel behind home. Judged by the leash alone,
        // a front paw tripped this at the end of every stance and
        // stutter-stepped before its real swing. Tripped just before its own
        // swing, that swing simply starts a little early.)
        if (walking && !pw.swing && !PAWS.some(q => q !== k && this.paws[q].swing?.early)) {
          const lp = root.worldToLocal(_m.copy(pw.pos));
          const rk = this.reach[k], lz = Math.max(.65 * LEASH_Z(speed) * rk * rk, duty * stride / 2 + (front ? .05 : 0) + .06);
          // (Behind her, about to go past straight: within a centimetre, or a
          // frame's travel, of it.)
          const stretched = p > duty / 2 && (this.rig.legs[k].reachShort || 0) > -Math.max(.01, speed * dt);
          if (stretched || Math.hypot((lp.x - home.x) / (.65 * LEASH.x * rk * rk), (lp.z - home.z) / lz) > 1) pw.swing = near ? {gait: true, from: pw.pos.clone(), t0: t} : {gait: true, early: true, from: pw.pos.clone(), t0: t};
        }
        if (pw.swing?.gait) {
          const early = pw.swing.early;
          // (A swing started a little early moves from the moment it starts,
          // not from when its turn would have come.)
          const u = early ? Math.min(1, (t - pw.swing.t0) / .18) : walking ? Math.min(1, Math.max((p - duty) / (1 - duty), (t - pw.swing.t0) / ((1 - duty) * cycle))) : Math.min(1, pw.swing.u + dt / .15);
          if (early ? u >= 1 : !walking && u >= 1 || walking && !near) {
            // Down: where the leg will be upright mid-stance. (A quick step
            // that lands late in its own swing window counts as that swing.)
            pw.pos.copy(pw.swing.to || pw.pos); pw.pos.y = gy(pw.pos); pw.swing = null;
            if (early && inSwing && (p - duty) / (1 - duty) > .6) pw.sat = true;
          } else {
            // (Galloping, a front paw lands a little nearer: reaching as far as
            // the walk's would take it past the end of her leg.)
            const ahead = (early ? (1 - u) * .2 + duty * cycle * .3 : (1 - u) * (1 - duty) * cycle + duty * cycle / 2) * (front ? 1 - .3 * runW : 1);
            const yaw = heading + this.yawRate * ahead;
            const local = home.clone().add(new THREE.Vector3(0, 0, front ? -.05 : 0));
            // (How far ahead it lands comes from the stride, not her speed of
            // the moment: a stance always covers duty x stride, and placed by
            // a speed she was still building up to, a paw landed short and
            // ran out of leg before its next swing.)
            const dist = early ? ahead * speed : ((1 - u) * (1 - duty) + duty / 2) * stride * (front ? 1 - .3 * runW : 1) * (speed / Math.max(gait, .05));
            const to = rootPos.clone().addScaledVector(speed > .05 ? this.vel.clone().divideScalar(speed) : fwdW, walking ? dist : 0)
              .add(local.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw));
            to.y = gy(to);
            pw.swing.to = to; pw.swing.u = u;
            const e = smoother(clamp((u - .05) / .9, 0, 1));
            pw.pos.copy(pw.swing.from).lerp(to, e);
            // (Every step clears the floor, even a short one.)
            const H = (front ? .08 : .075 * HIND_LIFT) * clamp(pw.swing.from.distanceTo(to) / .5, .7, 1) * (1 + trotW * .25 + runW * .9);
            // (Up or down a step: it rises over the step's edge first, and
            // comes down on to it.)
            const fy = pw.swing.from.y, rise = Math.abs(to.y - fy);
            pw.pos.y = lerp(fy, to.y, smoother(clamp((u - .1) / .7, 0, 1))) + (H + .7 * rise) * Math.pow(Math.sin(Math.PI * Math.pow(u, .8)), 1.3);
            pw.pitch = front ? -1.1 * Math.sin(Math.PI * clamp(u * 1.25, 0, 1)) * (1 - u) : -.7 * Math.sin(Math.PI * clamp(u * 1.3, 0, 1)) * (1 - u);
            sw[k] = Math.sin(Math.PI * u);
            continue;
          }
        }
        // (Planted, it rises or sinks with her, as standing: stepping up into
        // her bed, a paw left at floor height would pull its leg out straight.)
        pw.pos.y = gy(pw.pos);
        pw.pitch = 0;
        continue;
      }
      // Standing, turning or changing pose: a corrective step when a paw is
      // well away from where it belongs (one paw at a time).
      if (pw.swing) {
        const u = Math.min(1, (t - pw.swing.t0) / pw.swing.dur);
        const fy = pw.swing.from.y, ty = gy(homeW);
        pw.pos.copy(pw.swing.from).lerp(homeW, smoother(u));
        pw.pos.y = lerp(fy, ty, smoother(u)) + (pw.swing.h + .7 * Math.abs(ty - fy)) * Math.sin(Math.PI * u);
        pw.pitch = -.5 * Math.sin(Math.PI * u);
        sw[k] = Math.sin(Math.PI * u);
        if (u >= 1) { pw.swing = null; pw.pos.y = ty; }
        continue;
      }
      pw.pos.y = gy(pw.pos);
      pw.pitch = 0;
      // (Off to the side shows more than off forward or back.)
      const offL = root.worldToLocal(pw.pos.clone()).sub(home), off = Math.hypot(offL.x / .55, offL.z);
      if (off > .055 && t - this.lastStep > .14 && !PAWS.some(q => this.paws[q].swing && !this.paws[q].swing.gait)) {
        this.lastStep = t;
        pw.swing = {from: pw.pos.clone(), t0: t, dur: clamp(.18 + off * .5, .2, .4), h: clamp(.03 + off * .14, .038, .06)};
      }
    }

    // A paw never trails further than its leg can reach: when she's moved
    // faster than she can step (a pounce, a dash, a hop between perches),
    // the planted paw comes along at the end of its leg instead of staying
    // behind and pulling the leg out of sight; standing, it steps at once.
    for (const k of PAWS) {
      const pw = this.paws[k];
      if (pw.free) continue;
      const home = this.homeLocal(k), loc = root.worldToLocal(pw.pos.clone());
      const rk = this.reach[k], dx = loc.x - home.x, dz = loc.z - home.z, e = Math.hypot(dx / (LEASH.x * rk), dz / (LEASH_Z(speed) * rk));
      if (e <= 1) continue;
      loc.x = home.x + dx / e; loc.z = home.z + dz / e;
      const y = pw.pos.y;
      pw.pos.copy(root.localToWorld(loc)).setY(y);
      if (pw.swing?.from) pw.swing.from.copy(pw.pos);
      if (!walking && !pw.swing) { pw.swing = {from: pw.pos.clone(), t0: t, dur: .22, h: .04}; this.lastStep = t; }
    }

    // --- State for the rig -------------------------------------------------------
    const S = this.S, ww = this.walkW;
    const low = POSES[name].abs;
    // Carried a touch lower while walking, dipping as each hind leg swings.
    // Galloping, she bounds: up off the hind legs, the back flexing as the
    // legs gather under her and stretching out as they reach.
    // Trotting, a light bounce with each diagonal pair (twice a stride) and
    // no hip roll or sway.
    // (Through a gallop stride: `flex` is the back, +1 rounded with all four
    // legs gathered under her (as the front paws leave), -1 stretched long
    // (as the hind paws leave and the front ones reach); `saw` is the
    // see-saw, +1 front end up (hind paws down, pushing), -1 hips up over
    // the planted front paws. Not in the air or on the vacuum.)
    this.galW = damp(this.galW || 0, air || riding ? 0 : this.runW || 0, 12, dt);
    const rw = this.galW, tw = (this.trotW || 0) * (1 - (this.runW || 0)), gph = Math.PI * 2 * this.phase;
    const flex = Math.cos(gph + .3), saw = Math.sin(gph + .5), rock = rw * .045 * Math.sin(gph - .5);
    const pelY = c.y - (.02 + CARRY_LOW) * ww - .006 * ((sw.LH || 0) + (sw.RH || 0)) * ww * (1 - rw - tw) + tw * .012 * Math.sin(2 * gph - .8) + rw * (.04 * Math.sin(gph - 1.9) - .005);
    const settled = c.y < this.h0 - .1; // resting on her body (sitting, lying)
    const swayH = .012 * ((sw.RH || 0) - (sw.LH || 0)) * ww * SWAY * (1 - tw);
    // (Reach: a lean forward and a dip of the front, so her mouth finds the food.)
    const reach = ctl.reach || {z: 0, dip: 0};
    // (Galloping, the hips come forward under her as the back rounds, and
    // swing a little from side to side against the shoulders.)
    const pelvis = {pos: new THREE.Vector3(S.hips.x + c.x + swayH, pelY, S.hips.z + c.z + reach.z + rw * .03 * flex), yaw: c.yaw + .03 * SWAY * (1 - tw) * (1 - rw) * ((sw.RH || 0) - (sw.LH || 0)) * ww + rock + (ctl.wiggle || 0) * Math.sin(t * 20) * .14,
      pitch: c.pitch - reach.dip + rw * (.09 * saw + .1 * flex - .1) + tw * .01 * Math.sin(2 * gph - .8), roll: c.roll + .045 * SWAY * ((sw.RH || 0) - (sw.LH || 0)) * ww * (1 - rw - tw)};
    const chestRoll = .03 * ((sw.RF || 0) - (sw.LF || 0)) * ww;
    // A pat: her weight goes over the other front leg, the patting shoulder
    // comes up and forward, and she leans in behind the paw.
    // The paw goes for the thing itself (the vase, the toy, the speck on the
    // floor) where it's within reach, else a spot on the floor ahead; the
    // lower the thing, the more her chest and head dip to it.
    const lean = ctl.swatLean || 0, out = lean * Math.max(0, ctl.swatReach || 0);
    if (ctl.swat > .02 || lean > 0) {
      const T = this.patAt.set(S.mid - .06, .07, S.frontZ + .3), hx = this.home0.RF.x;
      if (ctl.swatAt) {
        const loc = root.worldToLocal(_m.copy(ctl.swatAt));
        if (Math.hypot(loc.x, loc.z - S.frontZ) < 1.4) T.set(clamp(loc.x, hx - .1, hx + .22), clamp(loc.y + .03, .05, .5), clamp(loc.z - .04, S.frontZ + .16, S.frontZ + .43));
      }
    }
    const dip = clamp((.5 - this.patAt.y) / .4, 0, 1);
    pelvis.pos.x += .06 * lean; pelvis.pos.z += .075 * out - .02 * lean * (1 - Math.max(0, ctl.swatReach || 0)); pelvis.roll += SWAT_ROLL * .5 * lean; pelvis.pitch -= .09 * out * dip;
    // Air: the body follows the arc (nose up rising, down falling).
    // She tips into it and levels out again as she lands (a spring, eased
    // both ways): set straight to the arc's slope, her whole body snapped
    // round by up to 30 degrees in one frame at take-off and at landing.
    {
      const k = ctl.air, up = ctl.airUp ?? 1, goal = k >= 0 ? (ctl.airTilt != null ? ctl.airTilt : (up > 0 ? .3 : -.25) * Math.cos(Math.PI * k)) : ctl.slope || 0;
      const W = 16, d = (this.tilt || 0) - goal, v = this.tiltV || 0, e = Math.exp(-W * dt), n = v + W * d;
      this.tilt = goal + (d + n * dt) * e; this.tiltV = (v - W * n * dt) * e;
      pelvis.pitch += this.tilt;
    }
    // Landing: she sinks on her legs, front first, and comes back up.
    if (ctl.squash > .01) { pelvis.pos.y -= .045 * ctl.squash; pelvis.pitch -= .1 * ctl.squash; }
    const paws = {};
    for (const k of PAWS) {
      const pw = this.paws[k];
      const local = root.worldToLocal(pw.pos.clone());
      let pitch = pw.pitch || 0;
      if (k[1] === 'H') pitch += c.hock;
      // Knead: front paws press in turn; groom: left paw up to her face; swat: right paw reaches.
      if (ctl.knead && k[1] === 'F' && !air) local.y += Math.max(0, Math.sin(t * 5.5 + (k === 'LF' ? Math.PI : 0))) * .035;
      let free = pw.free;
      if (ctl.groom && k === 'LF') {
        // Washing: the paw comes right up to her mouth (wherever her head is),
        // its back to her tongue, rising a little with each lick.
        const mouth = root.worldToLocal(this.cat.bones.jaw.localToWorld(_m.set(0, -.015, .14))).clone();
        free = true;
        local.copy(this.groomPaw.lerp(mouth.add(_m.set(.01, -.075 + Math.max(0, Math.sin(t * 7)) * .02, -.035)), 1 - Math.exp(-10 * dt)));
        pitch = -1.6;
      } else if (k === 'LF') this.groomPaw.copy(local);
      // (The pat: the paw comes up bent beside her chest, its wrist hanging,
      // draws back a little, then hooks up and over and comes down on the
      // thing, the wrist flicking flat as it lands.)
      if (ctl.swat > .02 && k === 'RF') {
        const r = ctl.swatReach ?? 1, o = Math.max(0, r), up = _m.copy(local).add(_s.set(.02, .28 + .05 * Math.max(0, -r), .02 + .4 * Math.min(0, r)));
        free = true;
        up.lerp(this.patAt, o).y += .16 * Math.sin(Math.PI * o);
        local.lerp(up, ctl.swat);
        pitch = lerp(pitch, lerp(-1.35, .15, smoothstep(o, .5, 1)), ctl.swat);
      }
      if (P.frontFree && k[1] === 'F') { free = true; local.add(new THREE.Vector3(...P.frontFree)); pitch = -1; }
      if (air) {
        // Pushing off, the hind legs are still stretched out behind; then she
        // tucks; coming down, the front paws reach for the landing first.
        const q = ctl.air >= 0 ? ctl.air : .5, push = 1 - smoother(clamp(q / .3, 0, 1)), reach = smoother(clamp((q - .55) / .45, 0, 1));
        if (k[1] === 'F') { local.y += .12 * (1 - .75 * reach); local.z += .07 * reach; pitch = lerp(-.3, .2, reach); }
        else { local.y += .08 * (1 - push) * (1 - .5 * reach) - .02 * push; local.z += -.1 * push + .06 * reach; pitch = lerp(lerp(-.6, .5, push), -.25, reach); }
      }
      if (name === 'drape') { local.y -= k[1] === 'F' ? .34 : .36; local.z += k[1] === 'F' ? .2 : -.16; pitch = k[1] === 'F' ? .7 : 1; }
      paws[k] = {pos: local, pitch, yaw: 0, free};
    }
    // Shoulder blades swing with their legs and lift over a supporting leg.
    const scapFor = k => {
      const local = paws[k].pos, rel = local.z - this.home0[k].z;
      return {angle: ww * clamp(rel * .9, -.25, .25) + (k === 'RF' ? .25 * out : 0), lift: c.scap + ww * .01 * (1 - (sw[k] || 0)) + (k === 'RF' ? .02 * (ctl.swat || 0) : 0)};
    };
    // Breathing: slower and deeper asleep.
    const sleeping = name === 'sleep' || name === 'curl';
    this.br += dt * (sleeping ? .3 : speed > .3 ? .8 : .45);
    const ph = this.br % 1;
    const breath = (ph < .4 ? -Math.cos(Math.PI * ph / .4) : Math.cos(Math.PI * (ph - .4) / .6)) * (sleeping ? .02 : .012)
      + (ctl.purr ? Math.sin(t * 55) * .004 : 0);
    const head = ctl.head || {yaw: 0, pitch: 0, roll: 0};
    const tl = ctl.tail || {amp: .25, speed: 1.4};
    // Her head stays level while the body bounds under it: the neck takes up
    // most of the rise and fall (the rig aims it at her head's usual height).
    this.headAvg = damp(this.headAvg ?? rig.headY0 ?? 0, rig.headY0 ?? 0, rw > .05 ? 2.5 : 30, dt);
    // The tail streams out behind at a run, nearly level; it follows the
    // hips' rise and fall a beat late, and swings wide of a turn, left
    // behind (walking too, a little).
    const stream = Math.max(rw, tw * .35);
    this.tailLag = damp(this.tailLag || 0, clamp(this.yawRate * .3, -1.3, 1.3) * Math.max(stream, ww * .4), 5, dt);
    this.tailBob = damp(this.tailBob || 0, -rw * (.1 * saw + .06 * flex), 10, dt);
    const state = {
      pelvis,
      spine: {yaw: c.spineYaw - .5 * pelvis.yaw * ww + .02 * ((sw.LF || 0) - (sw.RF || 0)) * ww - (ctl.wiggle || 0) * Math.sin(t * 20) * .08, pitch: c.spine - rw * .17 * flex - .1 * out * dip, roll: c.spineRoll + chestRoll * .5},
      chest: {yaw: c.chestYaw - rock + .22 * lean + .2 * out, pitch: c.chest - .035 * ww - rw * (.02 + .07 * flex) - (.06 * lean + .2 * out) * (.4 + .6 * dip), roll: chestRoll * .5 + SWAT_ROLL * lean},
      head: {yaw: head.yaw + c.headYaw, pitch: head.pitch + c.headPitch - (.1 + .2 * dip) * lean - .12 * out, roll: (head.roll || 0) + c.headRoll + SWAT_ROLL * .6 * lean},
      neckShare: .5 + .25 * rw, headLevel: {y: this.headAvg, w: .9 * rw},
      scap: {L: scapFor('LF'), R: scapFor('RF')},
      paws,
      tail: {lift: lerp(c.tailLift, 0, stream) + this.tailBob, curl: lerp(c.tailCurl, .04, stream), side: c.tailSide + this.tailLag, up: ctl.tailUp || 0, amp: tl.amp, speed: tl.speed,
        floor: air ? 0 : c.tailFloor, wrap: c.tailWrap, radius: c.tailR, bounds: ctl.tailBounds, solids: ctl.tailSolids},
      breathe: breath, face: ctl.face, look: ctl.look,
    };
    // Soft contact on her support surface (not mid-air).
    // (Nothing to stand on under her paws when she's in the air or hanging.)
    const unsupported = air || name === 'drape';
    // (On stairs: the lowest step under her, so nothing of her is pressed
    // flat on a step her paws stand above.)
    rig.floorU.floorY.value = unsupported ? -1e3 : ctl.ground ? Math.min(...PAWS.map(k => this.paws[k].pos ? gy(this.paws[k].pos) : rootPos.y)) : rootPos.y;
    // (Contact whenever she's not walking or in the air: resting, crouching,
    // landing on a cushion. Walking, her legs carry her clear of it.)
    // (And for a moment after a landing: the speed she came down with reads
    // as walking for a frame, the contact came a frame late and her body
    // popped up 5 cm.)
    if (air) this.airAt = t;
    const grounded = low || settled || c.tailFloor > .05 || this.walkW < .5 || t - (this.airAt ?? -9) < .6;
    rig.apply(state, dt, t, {contact: !unsupported && grounded, bodyFloor: name !== 'drape' && (air || grounded)});
  }
}
