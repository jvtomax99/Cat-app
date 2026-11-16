// Mochi's Christmas tree, in the study's corner by the fireplace (in place
// of the olive tree, in the Christmas look). From Merlin's picture: a full,
// dense fir, warm white fairy lights all through it, old glass baubles in
// reds, golds, silvers and greens, red-and-white twists, glass icicles, and
// little figures (snowmen, Santas, soldiers, red owls); lights along the top
// of the wall. All built in code; one draw per kind of thing, so it stays
// light on a phone.
//
// She climbs it: a leap into the lower branches, a scramble to the upper
// ones, and there she lies half in the tree, as in the picture. The tree
// sways when she lands, she bats at the baubles hanging under her paws, and
// now and then one comes off, drops to the floor and rolls. A tap on a
// fallen bauble hangs it back up.
import * as THREE from 'three';
import {rng, canvasTexture, lathe} from './room.js';

// Where it stands (the study's frame) and where she goes in it. Plain
// numbers, so the study's layout can name her perches before the tree is built.
export const TREE = {
  x: 4.0, z: -2.72, base: .42, top: 5.55, radius: 1.5,
  // Her perches: low in the branches on the fireplace side (from the
  // floor), then up to the top half, lying across the tree with her front
  // half out of it.
  low: {spot: [4.12, -1.78], top: 1.7, face: .15},
  high: {spot: [3.58, -2.3], top: 3.25, face: -Math.PI / 2 + .35},
  floor: [3.3, -.72],
};
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const WALL = {x: 4.52, z: -3.32};
// (The way to the open floor in front of the tree, as an angle round it.)
const FRONT = Math.atan2(1, -.42);

// The fir's radius at height y (measured up from the floor).
const radiusAt = y => TREE.radius * Math.pow(Math.max(0, (TREE.top - y) / (TREE.top - TREE.base)), .92) * (1 + .05 * Math.sin(y * 2.3));

// Her body on each perch, as a line from head to tail base (the tree's
// frame): nothing hard hangs there.
function bodyLines() {
  return [TREE.low, TREE.high].map(P => {
    const f = V(Math.sin(P.face), 0, Math.cos(P.face)), at = V(P.spot[0] - TREE.x, P.top + .3, P.spot[1] - TREE.z);
    return [at.clone().addScaledVector(f, .55).add(V(0, .15, 0)), at.clone().addScaledVector(f, -.8)];
  });
}
const segDist = (p, [a, b]) => {
  const ab = b.clone().sub(a), t = Math.max(0, Math.min(1, p.clone().sub(a).dot(ab) / ab.lengthSq()));
  return p.distanceTo(a.clone().addScaledVector(ab, t));
};

// ---------------------------------------------------------------------------
// Textures
// ---------------------------------------------------------------------------
// A fir sprig: a stem with flat needles set close on both sides, dark and
// glossy at the base, the fresh growth paler at the tip; side shoots.
function drawFirSprig(g, w, h) {
  const r = rng(717);
  g.clearRect(0, 0, w, h);
  g.lineCap = 'round';
  const shoot = (x0, y0, ang, len, wide, tipLight) => {
    const n = Math.round(len / 2.1);
    for (let i = 0; i <= n; i++) {
      const u = i / n, a = ang + Math.sin(u * 2) * .08;
      const x = x0 + Math.sin(a) * len * u, y = y0 - Math.cos(a) * len * u;
      for (const side of [-1, 1]) {
        const na = a + side * (1.05 + r() * .35) - side * u * .35, nl = wide * (1 - u * .45) * (.8 + r() * .35);
        const light = u > 1 - tipLight ? (u - 1 + tipLight) / tipLight : 0;
        const c = light > .3 && r() < .85 ? ['#6f9a52', '#7ea95c', '#5f8a46'][Math.floor(r() * 3)] : ['#173420', '#1d3d25', '#24482c', '#2b5431', '#13281a'][Math.floor(r() * 5)];
        g.strokeStyle = c; g.lineWidth = w / 120 * (.85 + r() * .4);
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.sin(na) * nl, y - Math.cos(na) * nl); g.stroke();
      }
    }
    g.strokeStyle = '#5a4630'; g.lineWidth = w / 110;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + Math.sin(ang) * len * .9, y0 - Math.cos(ang) * len * .9); g.stroke();
  };
  shoot(w * .5, h * .99, 0, h * .93, w * .15, .32);
  for (const [y, a, l] of [[.82, -.7, .42], [.74, .66, .44], [.6, -.62, .36], [.52, .6, .34], [.4, -.55, .26], [.33, .55, .25]]) shoot(w * .5, h * y, a, h * l, w * .11, .45);
}
// Fine diagonal stripes, red on white (the twisted glass ornaments).
function drawTwist(g, w, h) {
  g.fillStyle = '#f2ece2'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#b3141f';
  for (let i = -8; i < 16; i++) { g.beginPath(); g.moveTo(i * w / 6, 0); g.lineTo(i * w / 6 + w / 12, 0); g.lineTo(i * w / 6 + w / 12 + w, h); g.lineTo(i * w / 6 + w, h); g.fill(); }
}
function glowTexture() {
  return canvasTexture(64, 64, (c, w, h) => {
    const grd = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grd.addColorStop(0, 'rgba(255,236,190,1)'); grd.addColorStop(.2, 'rgba(255,200,120,.6)'); grd.addColorStop(1, 'rgba(255,160,70,0)');
    c.fillStyle = grd; c.fillRect(0, 0, w, h);
  });
}

// ---------------------------------------------------------------------------
// Batching: many small parts, one instanced draw per shape and material.
// ---------------------------------------------------------------------------
function batcher() {
  const sets = new Map();
  return {
    add(geo, mat, m4, color = null) {
      if (!sets.has(geo)) sets.set(geo, new Map());
      const byMat = sets.get(geo);
      if (!byMat.has(mat)) byMat.set(mat, []);
      byMat.get(mat).push([m4.clone(), color]);
    },
    build(parent, {cast = false} = {}) {
      const out = [];
      for (const [geo, byMat] of sets) for (const [mat, list] of byMat) {
        const inst = new THREE.InstancedMesh(geo, mat, list.length), c = new THREE.Color();
        list.forEach(([m4, color], i) => { inst.setMatrixAt(i, m4); if (color) inst.setColorAt(i, c.set(color)); });
        inst.castShadow = cast; inst.receiveShadow = true;
        parent.add(inst); out.push(inst);
      }
      return out;
    },
  };
}

// ---------------------------------------------------------------------------
// The tree
// ---------------------------------------------------------------------------
export function buildChristmasTree(room) {
  const r = rng(2412);
  const root = new THREE.Group(); root.position.set(TREE.x, 0, TREE.z); room.group.add(root);
  // (The sway turns the whole tree about its foot; fallen baubles stay out of it.)
  const sway = new THREE.Group(); root.add(sway);
  const floorItems = new THREE.Group(); root.add(floorItems);
  const Y = V(0, 1, 0), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();

  // Keep-outs: the two walls, and the armchair's back (the chair stands
  // where it always does; the branches on that side are shorter).
  const chair = room.chair, chairInv = new THREE.Matrix4(), chairFwd = new THREE.Matrix4(), chairQ = new THREE.Quaternion(), chairBox = new THREE.Box3();
  {
    const p = chair.position.clone(), ry = chair.rotation.y;
    chair.position.set(0, 0, 0); chair.rotation.y = 0; chair.updateMatrixWorld(true);
    chairBox.setFromObject(chair).expandByScalar(.06);
    chair.position.copy(p); chair.rotation.y = ry; chair.updateMatrixWorld(true);
    chairQ.setFromAxisAngle(Y, ry); chairFwd.compose(p, chairQ, V(1, 1, 1)); chairInv.copy(chairFwd).invert();
  }
  const local = V(0, 0, 0), world = V(0, 0, 0);
  const blocked = p => {
    world.set(p.x + TREE.x, p.y, p.z + TREE.z);
    if (world.x > WALL.x || world.z < WALL.z) return true;
    return chairBox.containsPoint(local.copy(world).applyMatrix4(chairInv));
  };
  const bodies = bodyLines();
  const nearHer = (p, pad) => bodies.some(b => segDist(p, b) < pad);

  // Foot: a rattan collar round the stand, and the trunk.
  const rattan = new THREE.MeshStandardMaterial({map: canvasTexture(256, 64, (g, w, h) => {
    g.fillStyle = '#b58e56'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 8) for (let y = 0; y < h; y += 8) { g.fillStyle = (x + y) % 16 ? '#9c7742' : '#caa46a'; g.fillRect(x + 1, y + 1, 6, 6); }
  }, {repeat: [4, 1]}), roughness: .9});
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(.44, .5, .42, 28, 1, true), rattan); collar.position.y = .21; collar.castShadow = true; collar.receiveShadow = true; sway.add(collar);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(.44, .025, 6, 32), rattan); rim.rotation.x = Math.PI / 2; rim.position.y = .42; sway.add(rim);
  const bark = new THREE.MeshStandardMaterial({color: '#4b3624', roughness: 1});
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.025, .085, TREE.top - .2, 8), bark); trunk.position.y = (TREE.top - .2) / 2 + .1; sway.add(trunk);

  // A dark heart: the tree is solid, not see-through, as a full fir is.
  const heartMat = new THREE.MeshStandardMaterial({color: '#0f2214', roughness: 1});
  const hp = [];
  for (let i = 0; i <= 12; i++) { const y = TREE.base + .1 + (TREE.top - .25 - TREE.base) * i / 12; hp.push(new THREE.Vector2(Math.max(.02, radiusAt(y) * .72), y)); }
  hp.unshift(new THREE.Vector2(0, TREE.base + .1)); hp.push(new THREE.Vector2(0, TREE.top - .15));
  const heart = new THREE.Mesh(new THREE.LatheGeometry(hp, 20), heartMat); heart.castShadow = true; heart.receiveShadow = true; sway.add(heart);

  // Branches: whorls up the trunk, each bough reaching out and a little down,
  // its tip lifting; sprays of fir along it and along its side shoots.
  const sprigTex = canvasTexture(256, 512, drawFirSprig);
  const sprigMat = new THREE.MeshStandardMaterial({map: sprigTex, alphaTest: .45, side: THREE.DoubleSide, roughness: .75, emissive: '#6b4a1c', emissiveMap: sprigTex, emissiveIntensity: 0});
  const cards = [];
  const tips = []; // (bough tips: where baubles hang)
  const spray = (pts, count, size, depthOf) => {
    const curve = new THREE.CatmullRomCurve3(pts);
    for (let i = 0; i < count; i++) {
      const u = Math.min(1, (i + r()) / count), p = curve.getPointAt(u), tan = curve.getTangentAt(u);
      if (blocked(p)) continue;
      // Mostly flat sprays (needles to the sky), pointing on out along the
      // bough; a few turned, for depth.
      const d = tan.clone().multiplyScalar(r() < .82 ? 1 : -.6).add(V((r() - .5) * .9, (r() - .45) * .5, (r() - .5) * .9)).normalize();
      let up = Y.clone().addScaledVector(d, -d.y).normalize();
      if (r() < .3) up.applyAxisAngle(d, (r() - .5) * 2.4);
      const x = new THREE.Vector3().crossVectors(d, up).normalize();
      m4.makeBasis(x, d, new THREE.Vector3().crossVectors(x, d));
      const k = size * (.75 + r() * .5);
      m4.scale(s.set(k * .7, k, k)); m4.setPosition(p);
      cards.push([m4.clone(), depthOf(p)]);
    }
  };
  const whorls = 26;
  for (let w = 0; w < whorls; w++) {
    const y = TREE.base + .08 + (TREE.top - .45 - TREE.base) * Math.pow(w / (whorls - 1), .95), R = radiusAt(y), n = Math.max(5, Math.round(5 + 9 * R / TREE.radius));
    for (let j = 0; j < n; j++) {
      const a = (j + r() * .6 + w * .37) / n * Math.PI * 2, L = R * (.88 + r() * .2), dir = V(Math.cos(a), 0, Math.sin(a));
      const at = (u, drop) => V(0, y, 0).addScaledVector(dir, L * u).add(V(0, -drop, 0));
      const pts = [at(.05, 0), at(.4, L * .1), at(.75, L * .16), at(1, L * .12)];
      // (Shortened against the walls and the chair.)
      while (pts.length > 2 && blocked(pts[pts.length - 1])) pts.pop();
      const depth = p => Math.min(1, Math.hypot(p.x, p.z) / Math.max(.15, radiusAt(p.y)));
      spray(pts, Math.round(L * 17) + 3, .34 + .18 * R / TREE.radius, depth);
      if (pts.length === 4) tips.push(pts[3]);
      // Side shoots from the outer half of the bough.
      for (const u of [.45, .7]) {
        const base = new THREE.CatmullRomCurve3(pts).getPointAt(Math.min(1, u)), side = V(-dir.z, 0, dir.x).multiplyScalar(r() < .5 ? 1 : -1);
        const sd = dir.clone().multiplyScalar(.6).addScaledVector(side, .8).normalize(), sl = L * (.32 + r() * .14);
        const sp = [base, base.clone().addScaledVector(sd, sl * .6).add(V(0, -.02, 0)), base.clone().addScaledVector(sd, sl)];
        if (!blocked(sp[2])) { spray(sp, Math.round(sl * 13) + 1, .26 + .1 * R / TREE.radius, depth); tips.push(sp[2]); }
      }
    }
  }
  // A full coat over it all: short sprays all over the outside, so no gaps
  // show between the boughs (a well-shaped, dense fir, as in the picture).
  for (let i = 0; i < 1900; i++) {
    const y = TREE.base + .1 + (TREE.top - .35 - TREE.base) * (1 - Math.sqrt(r())), R = radiusAt(y), a = r() * Math.PI * 2;
    const rad = R * (.72 + r() * .3), p = V(Math.cos(a) * rad, y, Math.sin(a) * rad);
    if (blocked(p)) continue;
    const d = V(Math.cos(a), -.25 - r() * .3, Math.sin(a)).add(V((r() - .5) * 1.1, (r() - .5) * .3, (r() - .5) * 1.1)).normalize();
    let up = Y.clone().addScaledVector(d, -d.y).normalize();
    if (r() < .3) up.applyAxisAngle(d, (r() - .5) * 2);
    const x = new THREE.Vector3().crossVectors(d, up).normalize(), k = (.3 + .2 * R / TREE.radius) * (.75 + r() * .5);
    m4.makeBasis(x, d, new THREE.Vector3().crossVectors(x, d)); m4.scale(s.set(k * .7, k, k)); m4.setPosition(p);
    cards.push([m4.clone(), Math.min(1, rad / Math.max(.15, R))]);
  }
  // The leader: a straight spire of fresh growth at the top.
  spray([V(0, TREE.top - .5, 0), V(0, TREE.top - .2, 0), V(0, TREE.top + .02, 0)], 10, .24, () => 1);
  const foliage = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).translate(0, .5, 0), sprigMat, cards.length);
  const deep = new THREE.Color('#5e7c5c'), light = new THREE.Color('#d9e6cf'), c = new THREE.Color();
  cards.forEach(([mm, d], i) => { foliage.setMatrixAt(i, mm); foliage.setColorAt(i, c.copy(deep).lerp(light, Math.pow(d, 1.6) * (.75 + r() * .25))); });
  foliage.receiveShadow = true;
  sway.add(foliage);

  // ---- Fairy lights: warm white, all through the tree, more at the foot.
  const lights = [];
  for (let tries = 0; lights.length < 820 && tries < 9000; tries++) {
    const y = TREE.base + .15 + (TREE.top - .3 - TREE.base) * (1 - Math.sqrt(r()));
    const R = radiusAt(y), a = r() * Math.PI * 2, rad = R * (r() < .2 ? .75 + r() * .2 : .98 + r() * .1) + .02;
    const p = V(Math.cos(a) * rad, y, Math.sin(a) * rad);
    if (!blocked(p)) lights.push(p);
  }
  const bulbMat = new THREE.MeshBasicMaterial({color: '#fff1cf'});
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(.026, 6, 4), bulbMat, lights.length);
  lights.forEach((p, i) => bulbs.setMatrixAt(i, m4.makeTranslation(p.x, p.y, p.z)));
  sway.add(bulbs);
  const glowTex = glowTexture();
  // (Two sets, breathing out of step: a gentle twinkle.)
  const glowMats = [0, 1].map(() => new THREE.PointsMaterial({map: glowTex, size: .4, sizeAttenuation: true, transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false}));
  [0, 1].forEach(k => {
    const pts = new THREE.Points(new THREE.BufferGeometry().setFromPoints(lights.filter((_, i) => i % 2 === k)), glowMats[k]);
    pts.frustumCulled = false; sway.add(pts);
  });

  // ---- Ornaments.
  const B = batcher();
  const glass = new THREE.MeshPhysicalMaterial({color: '#ffffff', metalness: .55, roughness: .16, clearcoat: 1, clearcoatRoughness: .05});
  const satin = new THREE.MeshStandardMaterial({color: '#ffffff', roughness: .55});
  const brass = new THREE.MeshStandardMaterial({color: '#c9a45a', metalness: .9, roughness: .3});
  const silverGlass = new THREE.MeshPhysicalMaterial({color: '#dfe4ea', metalness: .9, roughness: .08, clearcoat: 1});
  const twistMat = new THREE.MeshPhysicalMaterial({map: canvasTexture(64, 256, drawTwist), roughness: .2, clearcoat: 1});
  const sphere = new THREE.SphereGeometry(1, 16, 12), cap = new THREE.CylinderGeometry(.24, .28, .3, 8), cone = new THREE.ConeGeometry(1, 1, 12);
  const drop = lathe([[0, -1], [.18, -.85], [.42, -.45], [.55, -.05], [.45, .3], [.18, .52], [.12, .62], [0, .62]], 14);
  const twist = lathe([[0, -1], [.1, -.85], [.32, -.4], [.36, 0], [.28, .4], [.12, .7], [0, .75]], 12);
  const icicle = new THREE.ConeGeometry(.018, .26, 6).translate(0, -.13, 0).rotateX(Math.PI);
  const cyl = new THREE.CylinderGeometry(1, 1, 1, 10);
  const put = (geo, mat, p, sc, color = null, rot = 0) => { q.setFromAxisAngle(Y, rot); m4.compose(p, q, typeof sc === 'number' ? s.setScalar(sc) : sc); B.add(geo, mat, m4, color); };

  // Spots to hang things: out on the bough tips, never where she lies, and
  // not crowding each other.
  const hung = [];
  const free = (p, gap) => !nearHer(p, .42) && !blocked(p) && hung.every(h => h.distanceTo(p) > gap);
  const spot = (gap, yMin = TREE.base + .3, yMax = TREE.top - .5) => {
    for (let k = 0; k < 80; k++) {
      const y = yMin + (yMax - yMin) * (1 - Math.sqrt(r())), a = r() * Math.PI * 2, R = radiusAt(y) * (.97 + r() * .09) + .02;
      const p = V(Math.cos(a) * R, y, Math.sin(a) * R);
      if (free(p, gap)) { hung.push(p); return p; }
    }
    return null;
  };
  const BAUBLES = ['#9d121b', '#c21d27', '#7c0f18', '#c9a043', '#d9b968', '#c9ccd2', '#2f6b3a', '#1f4f5f', '#e9e1d2', '#b8462c', '#c21d27', '#9d121b', '#c9a043'];
  for (let i = 0; i < 170; i++) {
    const p = spot(.17); if (!p) break;
    const rad = .06 + r() * .06;
    put(sphere, glass, p.clone().add(V(0, -rad, 0)), rad, BAUBLES[Math.floor(r() * BAUBLES.length)]);
    put(cap, brass, p.clone().add(V(0, .01, 0)), rad * .9);
  }
  for (let i = 0; i < 36; i++) {
    const p = spot(.2); if (!p) break;
    const k = .09 + r() * .04;
    put(drop, glass, p.clone().add(V(0, -k * .62, 0)), V(k, k * 1.25, k), ['#c21d27', '#c9a043', '#2f6b3a', '#d9d4ca', '#b03a5a'][i % 5], r() * 6);
    put(cap, brass, p, k * .6);
  }
  for (let i = 0; i < 26; i++) {
    const p = spot(.22); if (!p) break;
    const k = .13 + r() * .04;
    put(twist, twistMat, p.clone().add(V(0, -k * .75, 0)), V(k * .9, k * 1.6, k * .9), null, r() * 6);
  }
  for (let i = 0; i < 40; i++) {
    const p = spot(.15); if (!p) break;
    put(icicle, silverGlass, p, 1 + r() * .5, null, r() * 6);
  }
  // Little figures, hanging upright on their loops.
  const white = '#f3efe6', red = '#b8171f', black = '#1c1a1a', skin = '#e8b9a0', gold = '#c9a043';
  const figure = (p, kind, k) => {
    const at = (x, y, z) => p.clone().add(V(x * k, y * k, z * k)), turn = Math.atan2(p.x, p.z);
    if (kind === 'snowman') {
      put(sphere, satin, at(0, -1.1, 0), .5 * k, white); put(sphere, satin, at(0, -.4, 0), .36 * k, white);
      put(cyl, satin, at(0, -.02, 0), V(.26 * k, .3 * k, .26 * k), black); put(cyl, satin, at(0, -.16, 0), V(.4 * k, .04 * k, .4 * k), black);
      put(cone, satin, at(Math.sin(turn) * .36, -.4, Math.cos(turn) * .36), V(.06 * k, .25 * k, .06 * k), '#d9741f');
      put(cyl, satin, at(0, -.72, 0), V(.36 * k, .08 * k, .36 * k), red);
    } else if (kind === 'santa') {
      put(cone, glass, at(0, -1.05, 0), V(.48 * k, 1.1 * k, .48 * k), red); put(sphere, satin, at(0, -.32, 0), .27 * k, skin);
      put(sphere, satin, at(Math.sin(turn) * .12, -.45, Math.cos(turn) * .12), V(.25 * k, .26 * k, .2 * k), white);
      put(cone, glass, at(0, -.02, 0), V(.25 * k, .45 * k, .25 * k), red); put(sphere, satin, at(0, .2, 0), .08 * k, white);
      put(cyl, satin, at(0, -1.58, 0), V(.5 * k, .08 * k, .5 * k), white);
    } else if (kind === 'soldier') {
      put(cyl, glass, at(0, -.95, 0), V(.22 * k, .7 * k, .22 * k), red); put(cyl, satin, at(0, -1.45, 0), V(.2 * k, .3 * k, .2 * k), black);
      put(sphere, satin, at(0, -.45, 0), .2 * k, skin); put(cyl, satin, at(0, -.08, 0), V(.21 * k, .5 * k, .21 * k), black);
      put(cyl, glass, at(0, -.82, 0), V(.24 * k, .05 * k, .24 * k), gold);
    } else {
      put(sphere, glass, at(0, -.75, 0), V(.42 * k, .55 * k, .4 * k), red);
      for (const sd of [-1, 1]) {
        put(sphere, satin, at(Math.sin(turn) * .32 + Math.cos(turn) * sd * .15, -.6, Math.cos(turn) * .32 - Math.sin(turn) * sd * .15), .13 * k, white);
        put(sphere, satin, at(Math.sin(turn) * .42 + Math.cos(turn) * sd * .15, -.6, Math.cos(turn) * .42 - Math.sin(turn) * sd * .15), .06 * k, black);
      }
      put(cone, glass, at(Math.sin(turn) * .4, -.75, Math.cos(turn) * .4), V(.06 * k, .14 * k, .06 * k), gold);
    }
  };
  const KINDS = ['snowman', 'santa', 'soldier', 'owl'];
  for (let i = 0; i < 26; i++) { const p = spot(.28, TREE.base + .5); if (p) figure(p, KINDS[i % 4], .17 + r() * .05); }
  // A glass spire on top.
  const topAt = V(0, TREE.top, 0);
  put(lathe([[0, -.05], [.05, -.03], [.06, .04], [.13, .16], [.14, .24], [.1, .33], [.05, .4], [.035, .48], [.06, .52], [.03, .58], [.015, .8], [0, .86]], 18), glass, topAt, 1, '#b8141e');
  put(cyl, brass, topAt.clone().add(V(0, .04, 0)), V(.065, .06, .065));
  const ornaments = B.build(sway);

  // ---- The baubles under her paws on the top perch: each on its own, to
  // swing when batted and to come off.
  const her = TREE.high, paw = V(her.spot[0] - TREE.x + Math.sin(her.face) * .36, her.top - .36, her.spot[1] - TREE.z + Math.cos(her.face) * .36 + .12);
  const loose = [];
  [[0, 0, '#c21d27', .085], [-.42, .08, '#c9a043', .075], [-.2, .2, '#2f6b3a', .07]].forEach(([dx, dy, color, rad], i) => {
    const out = V(paw.x, 0, paw.z).normalize(), side = V(-out.z, 0, out.x);
    const hang = paw.clone().addScaledVector(side, dx).add(V(0, -dy, 0)).addScaledVector(out, .05);
    const pivot = new THREE.Group(); pivot.position.copy(hang); sway.add(pivot);
    const b = new THREE.Group(); pivot.add(b);
    const ball = new THREE.Mesh(sphere, glass.clone()); ball.material.color.set(color); ball.scale.setScalar(rad); ball.position.y = -.06 - rad; ball.castShadow = true;
    const top = new THREE.Mesh(cap, brass); top.scale.setScalar(rad * .9); top.position.y = -.05;
    const loop = new THREE.Mesh(new THREE.CylinderGeometry(.003, .003, .06, 3), brass); loop.position.y = -.025;
    b.add(ball, top, loop);
    loose.push({i, pivot, b, rad, home: hang.clone(), swing: V(0, 0, 0), spin: V(0, 0, 0), down: null});
  });

  // ---- Lights along the top of the walls (the back wall and the right
  // wall over the tree), in shallow swags between hooks.
  const wallLights = [], wire = [];
  const swag = (a, b, hooks, sag) => {
    for (let h = 0; h < hooks; h++) {
      const n = 14;
      for (let i = 0; i <= n; i++) {
        const u = (h + i / n) / hooks, p = a.clone().lerp(b, u); p.y -= sag * Math.sin(i / n * Math.PI);
        wire.push(p);
        if (i < n && i % 1 === 0) wallLights.push(p.clone().add(V(0, -.03, 0)));
      }
    }
  };
  const Y0 = 6.05;
  swag(V(-4.5 - TREE.x, Y0, -3.36 - TREE.z), V(4.56 - TREE.x, Y0, -3.36 - TREE.z), 7, .32);
  swag(V(4.56 - TREE.x, Y0, -3.36 - TREE.z), V(4.56 - TREE.x, Y0, -.3 - TREE.z), 2, .3);
  const wireMesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(wire), 400, .008, 4), new THREE.MeshStandardMaterial({color: '#2b3a26', roughness: .8}));
  root.add(wireMesh);
  const wallBulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(.026, 6, 4), bulbMat, wallLights.length);
  wallLights.forEach((p, i) => wallBulbs.setMatrixAt(i, m4.makeTranslation(p.x, p.y, p.z)));
  root.add(wallBulbs);
  const wallGlow = new THREE.Points(new THREE.BufferGeometry().setFromPoints(wallLights), glowMats[0]); wallGlow.frustumCulled = false; root.add(wallGlow);

  // ---- In the evening: a warm wash on the walls behind and the floor under it.
  const washTex = canvasTexture(128, 128, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grd.addColorStop(0, 'rgba(255,190,110,.9)'); grd.addColorStop(.5, 'rgba(255,160,80,.35)'); grd.addColorStop(1, 'rgba(255,140,60,0)');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  });
  const washMat = new THREE.MeshBasicMaterial({map: washTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false});
  const washBack = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 5.4), washMat); washBack.position.set(-.35, 2.5, WALL.z - TREE.z - .05); root.add(washBack);
  const washSide = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 5.4), washMat); washSide.rotation.y = -Math.PI / 2; washSide.position.set(WALL.x - TREE.x + .06, 2.5, .5); root.add(washSide);
  const washFloor = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), washMat); washFloor.rotation.x = -Math.PI / 2; washFloor.position.set(-.3, .012, .3); root.add(washFloor);

  // A plain cone round it all, never drawn: what a tap on the tree hits.
  const hit = new THREE.Mesh(new THREE.ConeGeometry(TREE.radius * .95, TREE.top - TREE.base, 12).translate(0, (TREE.top + TREE.base) / 2, 0), new THREE.MeshBasicMaterial({visible: false}));
  root.add(hit);

  // ---- Movement: the sway (a damped spring about the foot) and the
  // baubles' swing and fall.
  const sw = {ang: V(0, 0, 0), vel: V(0, 0, 0)};
  let glowSize = .3, night = 0;
  const tree = {
    root, sway, foliage, ornaments, loose, hit, onLand: null,
    // A push at the tree: `dir` (the room's frame) is the way the top goes.
    shake(amount = .5, dir = null) {
      const d = dir ? V(dir.x, 0, dir.z).normalize() : V(r() - .5, 0, r() - .5).normalize();
      sw.vel.x += d.z * amount * .12; sw.vel.z += -d.x * amount * .12;
    },
    // A pat: the bauble swings away from her paw.
    bat(i, dir) {
      const L = loose[i]; if (!L || L.down) return false;
      L.swing.x += dir.z * 3.2; L.swing.z += -dir.x * 3.2; L.spin.y += (r() - .5) * 6;
      return true;
    },
    // Off it comes: from where it hangs, falling, bouncing and rolling.
    drop(i, dir) {
      const L = loose[i]; if (!L || L.down) return false;
      const p = L.b.getWorldPosition(V(0, 0, 0)); root.worldToLocal(p);
      L.pivot.visible = false;
      const g = new THREE.Group(); g.add(L.b.children[0].clone()); g.children[0].position.set(0, 0, 0);
      g.position.copy(p).add(V(0, -.06 - L.rad, 0)); floorItems.add(g);
      // (Out from the tree, towards the room rather than along her paw.)
      const out = V(p.x, 0, p.z).normalize().multiplyScalar(.3).add(V(0, 0, 1)).normalize();
      L.down = {g, vel: V(out.x * .7, .6, out.z * .7), landed: 0, rest: false};
      return true;
    },
    // A tap on a fallen bauble: back on its branch.
    rehang(i) {
      const L = loose[i]; if (!L?.down) return false;
      floorItems.remove(L.down.g); L.down = null; L.pivot.visible = true; L.swing.set(.6, 0, .4);
      return true;
    },
    // Nudged along the floor (a paw, or a walk past).
    kick(i, dir, speed = 2) {
      const D = loose[i]?.down; if (!D) return false;
      D.vel.x += dir.x * speed; D.vel.z += dir.z * speed; D.vel.y = Math.max(D.vel.y, .6); D.rest = false;
      return true;
    },
    fallen() { return loose.filter(L => L.down); },
    // Room for her to stand at (x, z) in the study, facing `heading`: clear
    // of the armchair, the tree, the hearth and the walls (her head and hips too).
    freeFloor(x, z, heading) {
      for (const k of [-.5, 0, .45]) {
        const px = x + Math.sin(heading) * k, pz = z + Math.cos(heading) * k;
        if (px > 4.25 || px < -4.25 || pz < -3.1 || pz > 3.4) return false;
        if (Math.hypot(px - TREE.x, pz - TREE.z) < TREE.radius * .9) return false;
        if (px > 3.4 && pz > -.85 && pz < 3.0) return false;
        if (chairBox.clone().expandByScalar(.22).containsPoint(local.set(px, .5, pz).applyMatrix4(chairInv))) return false;
      }
      return true;
    },
    ballWorld(i, v = V(0, 0, 0)) { const L = loose[i]; return L.down ? L.down.g.getWorldPosition(v) : L.b.children[0].getWorldPosition(v); },
    hitFallen(ray) {
      let best = null;
      for (const L of loose) if (L.down) { const p = L.down.g.getWorldPosition(V(0, 0, 0)); const d = ray.ray.distanceToPoint(p); if (d < .3 && (!best || d < best.d)) best = {i: L.i, d}; }
      return best?.i ?? null;
    },
    update(dt, t, isNight) {
      if (!root.visible) return;
      dt = Math.min(dt, .05);
      night += ((isNight ? 1 : 0) - night) * (1 - Math.exp(-3 * dt));
      // Sway: stiff and quick to settle.
      sw.vel.addScaledVector(sw.ang, -38 * dt).multiplyScalar(Math.exp(-3.2 * dt)); sw.ang.addScaledVector(sw.vel, dt);
      sway.rotation.set(sw.ang.x, 0, sw.ang.z);
      for (const L of loose) {
        if (L.down) continue;
        L.swing.x += (-24 * L.pivot.rotation.x - 1.6 * L.swing.x) * dt; L.swing.z += (-24 * L.pivot.rotation.z - 1.6 * L.swing.z) * dt;
        L.pivot.rotation.x += L.swing.x * dt; L.pivot.rotation.z += L.swing.z * dt;
        L.spin.y *= Math.exp(-1.5 * dt); L.b.rotation.y += L.spin.y * dt;
      }
      // Fallen baubles: gravity, a bounce or two, then a roll that slows.
      for (const L of loose) {
        const D = L.down; if (!D || D.rest) continue;
        const g = D.g;
        D.vel.y -= 22 * dt; g.position.addScaledVector(D.vel, dt);
        // Tumbling down the outside of the boughs: never into the tree, and
        // drifting round to its front, onto the open floor between the
        // armchair and the hearth.
        const fr0 = Math.hypot(g.position.x, g.position.z), Rb = radiusAt(Math.max(g.position.y, TREE.base)) + L.rad;
        if (g.position.y > TREE.base - .1 && fr0 < Rb) {
          let a = Math.atan2(g.position.z, g.position.x);
          a += Math.atan2(Math.sin(FRONT - a), Math.cos(FRONT - a)) * Math.min(1, 4 * dt);
          g.position.x = Math.cos(a) * Rb; g.position.z = Math.sin(a) * Rb;
          const n = V(Math.cos(a), 0, Math.sin(a)), vn = D.vel.dot(n);
          if (vn < .6) D.vel.addScaledVector(n, .6 - vn);
          D.vel.y = Math.max(D.vel.y, -3.5);
        }
        const floorY = L.rad;
        if (g.position.y < floorY) {
          g.position.y = floorY;
          if (D.vel.y < -1.2) { D.landed++; if (D.landed === 1) this.onLand?.(); }
          D.vel.y = -D.vel.y * .35; if (Math.abs(D.vel.y) < .5) D.vel.y = 0;
          D.vel.x *= Math.exp(-3.4 * dt); D.vel.z *= Math.exp(-3.4 * dt);
          g.rotation.z -= D.vel.x / L.rad * dt; g.rotation.x += D.vel.z / L.rad * dt;
          if (Math.hypot(D.vel.x, D.vel.z) < .03 && D.vel.y === 0) D.rest = true;
        }
        // (The room's walls, and the tree's own collar.)
        const wx = g.position.x + TREE.x, wz = g.position.z + TREE.z;
        if (wx > 4.5 - L.rad) { g.position.x = 4.5 - L.rad - TREE.x; D.vel.x = -Math.abs(D.vel.x) * .5; }
        if (wx < -4.5 + L.rad) { g.position.x = -4.5 + L.rad - TREE.x; D.vel.x = Math.abs(D.vel.x) * .5; }
        if (wz < -3.3 + L.rad) { g.position.z = -3.3 + L.rad - TREE.z; D.vel.z = Math.abs(D.vel.z) * .5; }
        if (wz > 3.6) { g.position.z = 3.6 - TREE.z; D.vel.z = -Math.abs(D.vel.z) * .5; }
        // (The armchair is solid to it: it never rolls in under, out of her reach.)
        local.set(wx, g.position.y, wz).applyMatrix4(chairInv);
        const cb = chairBox, pad = L.rad + .05;
        if (local.y < cb.max.y + L.rad && local.x > cb.min.x - pad && local.x < cb.max.x + pad && local.z > cb.min.z - pad && local.z < cb.max.z + pad) {
          const outs = [[cb.min.x - pad - local.x, 'x'], [cb.max.x + pad - local.x, 'x'], [cb.min.z - pad - local.z, 'z'], [cb.max.z + pad - local.z, 'z']];
          const [d, ax] = outs.reduce((a, b) => Math.abs(b[0]) < Math.abs(a[0]) ? b : a);
          local[ax] += d;
          const back = local.clone().applyMatrix4(chairFwd);
          g.position.x = back.x - TREE.x; g.position.z = back.z - TREE.z;
          const n = V(ax === 'x' ? Math.sign(d) : 0, 0, ax === 'z' ? Math.sign(d) : 0).applyQuaternion(chairQ), vn = D.vel.dot(n);
          if (vn < 0) D.vel.addScaledVector(n, -1.5 * vn);
        }
        // (Nor in under the lowest boughs: it bounces back out where she can get it.)
        const fr = Math.hypot(g.position.x, g.position.z), R0 = TREE.radius * .85 + L.rad;
        if (fr < R0 && g.position.y < .5) { g.position.x *= R0 / fr; g.position.z *= R0 / fr; const n = V(g.position.x / fr, 0, g.position.z / fr), vn = D.vel.dot(n); if (vn < 0) D.vel.addScaledVector(n, -1.5 * vn); }
      }
      // Lights: on by day too (as in the picture), brighter in the evening.
      const twinkle = Math.sin(t * 1.7) * .06;
      glowSize += ((isNight ? .62 : .42) - glowSize) * (1 - Math.exp(-3 * dt));
      glowMats[0].size = glowSize * (1 + twinkle); glowMats[1].size = glowSize * (1 - twinkle);
      for (const m of glowMats) m.opacity = .7 + .3 * night;
      washMat.opacity = .05 + .3 * night;
      // (The branches catch the lights' warmth in the evening.)
      sprigMat.emissiveIntensity = .12 + .5 * night;
    },
  };
  return tree;
}
