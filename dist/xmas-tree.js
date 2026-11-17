// Mochi's Christmas tree, in the kitchen beside the island, clear of the
// doorway to her study (Merlin, 2026-11-17: a picture with it there; while
// it's up her tent is put away for a round bed by the wall, kitchen.setTree). A tall, full fir, warm white fairy lights all
// through it, baubles in gold, champagne, bronze, mercury silver and deep
// red, big burgundy velvet bows, a gold star on top, a cream knitted skirt
// with a few baubles lying on it, and an open box she sits in. All built in
// code, one draw per kind of thing, so it stays light on a phone.
//
// What she does with it is in app.js (the "Christmas tree" block): a long
// curious first look, climbing up in stages (sometimes too far: stuck at
// the top, mewing), batting and knocking off baubles, hiding under the low
// boughs, sitting in the open box.
import * as THREE from 'three';
import {rng, canvasTexture, lathe} from './room.js';

// Where it stands and where she goes in it, in the kitchen's frame (plain
// numbers, so the kitchen's layout can name her perches before it's built).
// The camera looks from the open front (+z): her places are on the tree's
// front-left, the side you see and the side she climbs from.
// (Her side of it was laid out for a tree in the back right corner; RY
// turns all of it round together, so it faces the open floor to the right
// of the island, away from the island itself.)
const TX = 3.35, TZ = .45, RY = .9, at = (a, d) => [TX + Math.sin(a + RY) * d, TZ + Math.cos(a + RY) * d];
export const TREE = {
  x: TX, z: TZ, ry: RY, base: .9, top: 7.5, radius: 1.75,
  walls: {x1: 6.92, z0: -4.1}, // (the right wall and the back wall: no bough goes through them)
  // Up the tree in stages, lying across its front, her head to the wall
  // and a paw hanging down, as in the picture.
  perches: {
    treeLow: {spot: at(-.75, 1.15), top: 1.9, face: Math.PI / 2 + .3 + RY},
    treeMid: {spot: at(-.5, .9), top: 3.3, face: Math.PI / 2 + .15 + RY},
    treeHigh: {spot: at(-.35, .65), top: 4.6, face: Math.PI / 2 + .3 + RY},
    treeTop: {spot: at(-.25, .36), top: 5.8, face: Math.PI / 2 + .4 + RY},
  },
  climbFrom: at(-1.0, 2.25),
  // On the skirt under the low boughs on its left side (clear of the tent),
  // looking out.
  hide: at(-1.3, 1.2), hideFace: -1.3 + RY,
  // The open box on the skirt by the wall, and where she hops in from.
  box: {spot: at(.55, 1.55), ry: Math.PI / 2 + .15 + RY}, boxFrom: at(-.197, 1.53),
  // The first look: from out on the floor, then up close to sniff.
  look: at(-.84, 3.82), sniff: at(-.95, 2.45),
  // Kept clear for her: the stand in its collar.
  ring: .6,
};
// (The way to the open floor in front of it, as an angle round the tree:
// where a fallen bauble ends up, in reach.)
const FRONT = -.95 + RY;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const P = n => TREE.perches[n];

// The fir's radius at height y (measured up from the floor).
export const radiusAt = y => TREE.radius * Math.pow(Math.max(0, (TREE.top - y) / (TREE.top - TREE.base)), .92) * (1 + .04 * Math.sin(y * 1.7));

// Her body on each perch and under the tree, as a line from head to tail
// base (the tree's frame): nothing hard hangs there.
function bodyLines() {
  const line = (x, z, y, face) => {
    const f = V(Math.sin(face), 0, Math.cos(face)), p = V(x - TREE.x, y, z - TREE.z);
    return [p.clone().addScaledVector(f, .6).add(V(0, .15, 0)), p.clone().addScaledVector(f, -.85)];
  };
  return Object.values(TREE.perches).map(Q => line(Q.spot[0], Q.spot[1], Q.top + .3, Q.face)).concat([line(TREE.hide[0], TREE.hide[1], .35, TREE.hideFace)]);
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
// solids: boxes a fallen bauble can't roll through, in the kitchen's frame
// ({x0, x1, z0, z1, top}: the island).
// circles: round things on the floor ({x, z, r, top}: the tent, the fountain).
// bow: a velvet bow as one geometry (decor.js), hung on the tree here and there.
export function buildChristmasTree(parent, {solids = [], circles = [], bow = null} = {}) {
  const r = rng(2412);
  const root = new THREE.Group(); root.position.set(TREE.x, 0, TREE.z); parent.add(root);
  // (The sway turns the whole tree about its foot; fallen baubles and the
  // presents stay out of it.)
  const sway = new THREE.Group(); root.add(sway);
  const floorItems = new THREE.Group(); root.add(floorItems);
  const Y = V(0, 1, 0), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();

  // Keep-out: the right wall and the back wall (the boughs there are shorter).
  const blocked = p => p.x + TREE.x > TREE.walls.x1 || p.z + TREE.z < TREE.walls.z0;
  const bodies = bodyLines();
  const nearHer = (p, pad) => bodies.some(b => segDist(p, b) < pad);

  // Foot: a big rattan collar round the stand, and the trunk.
  const rattan = new THREE.MeshStandardMaterial({map: canvasTexture(256, 64, (g, w, h) => {
    g.fillStyle = '#b58e56'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 8) for (let y = 0; y < h; y += 8) { g.fillStyle = (x + y) % 16 ? '#9c7742' : '#caa46a'; g.fillRect(x + 1, y + 1, 6, 6); }
  }, {repeat: [6, 1]}), roughness: .9});
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(.5, .56, .5, 32, 1, true), rattan); collar.position.y = .25; collar.castShadow = true; collar.receiveShadow = true; sway.add(collar);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(.5, .028, 6, 36), rattan); rim.rotation.x = Math.PI / 2; rim.position.y = .5; sway.add(rim);
  const bark = new THREE.MeshStandardMaterial({color: '#4b3624', roughness: 1});
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.035, .11, TREE.top - .2, 8), bark); trunk.position.y = (TREE.top - .2) / 2 + .1; sway.add(trunk);

  // A dark heart: the tree is solid, not see-through, as a full fir is.
  const heartMat = new THREE.MeshStandardMaterial({color: '#0f2214', roughness: 1});
  const hp = [];
  for (let i = 0; i <= 14; i++) { const y = TREE.base + .25 + (TREE.top - .4 - TREE.base) * i / 14; hp.push(new THREE.Vector2(Math.max(.02, radiusAt(y) * .45), y)); }
  hp.unshift(new THREE.Vector2(0, TREE.base + .25)); hp.push(new THREE.Vector2(0, TREE.top - .2));
  const heart = new THREE.Mesh(new THREE.LatheGeometry(hp, 20), heartMat); heart.castShadow = true; heart.receiveShadow = true; sway.add(heart);

  // Branches: whorls up the trunk, each bough reaching out and a little down,
  // its tip lifting; sprays of fir along it and along its side shoots.
  const sprigTex = canvasTexture(256, 512, drawFirSprig);
  const sprigMat = new THREE.MeshStandardMaterial({map: sprigTex, alphaTest: .45, side: THREE.DoubleSide, roughness: .75, emissive: '#6b4a1c', emissiveMap: sprigTex, emissiveIntensity: 0});
  const cards = [];
  const spray = (pts, count, size, depthOf) => {
    const curve = new THREE.CatmullRomCurve3(pts);
    for (let i = 0; i < count; i++) {
      const u = Math.min(1, (i + r()) / count), p = curve.getPointAt(u), tan = curve.getTangentAt(u);
      if (blocked(p) || nearHer(p, .42)) continue;
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
  const depth = p => Math.min(1, Math.hypot(p.x, p.z) / Math.max(.15, radiusAt(p.y)));
  const whorls = 28;
  for (let w = 0; w < whorls; w++) {
    const y = TREE.base + .06 + (TREE.top - .6 - TREE.base) * Math.pow(w / (whorls - 1), .95), R = radiusAt(y), n = Math.max(5, Math.round(5 + 10 * R / TREE.radius));
    for (let j = 0; j < n; j++) {
      const a = (j + r() * .6 + w * .37) / n * Math.PI * 2, L = R * (.88 + r() * .2), dir = V(Math.cos(a), 0, Math.sin(a));
      const pt = (u, drop) => V(0, y, 0).addScaledVector(dir, L * u).add(V(0, -drop, 0));
      const pts = [pt(.05, 0), pt(.4, L * .08), pt(.75, L * .13), pt(1, L * .1)];
      while (pts.length > 2 && blocked(pts[pts.length - 1])) pts.pop();
      spray(pts, Math.round(L * 7) + 2, .62 + .32 * R / TREE.radius, depth);
      for (const u of [.45, .72]) {
        const b0 = new THREE.CatmullRomCurve3(pts).getPointAt(Math.min(1, u)), side = V(-dir.z, 0, dir.x).multiplyScalar(r() < .5 ? 1 : -1);
        const sd = dir.clone().multiplyScalar(.6).addScaledVector(side, .8).normalize(), sl = L * (.3 + r() * .14);
        const sp = [b0, b0.clone().addScaledVector(sd, sl * .6).add(V(0, -.03, 0)), b0.clone().addScaledVector(sd, sl)];
        if (!blocked(sp[2])) spray(sp, Math.round(sl * 5) + 1, .48 + .2 * R / TREE.radius, depth);
      }
    }
  }
  // A full coat over it all: sprays all over the outside, so no gaps show
  // between the boughs (a well-shaped, dense fir, as in the picture).
  for (let i = 0; i < 1400; i++) {
    const y = TREE.base + .1 + (TREE.top - .5 - TREE.base) * (1 - Math.sqrt(r())), R = radiusAt(y), a = r() * Math.PI * 2;
    const rad = R * (.74 + r() * .28), p = V(Math.cos(a) * rad, y, Math.sin(a) * rad);
    if (blocked(p) || nearHer(p, .5)) continue;
    const d = V(Math.cos(a), -.25 - r() * .3, Math.sin(a)).add(V((r() - .5) * 1.1, (r() - .5) * .3, (r() - .5) * 1.1)).normalize();
    let up = Y.clone().addScaledVector(d, -d.y).normalize();
    if (r() < .3) up.applyAxisAngle(d, (r() - .5) * 2);
    const x = new THREE.Vector3().crossVectors(d, up).normalize(), k = (.5 + .3 * R / TREE.radius) * (.75 + r() * .5);
    m4.makeBasis(x, d, new THREE.Vector3().crossVectors(x, d)); m4.scale(s.set(k * .7, k, k)); m4.setPosition(p);
    cards.push([m4.clone(), Math.min(1, rad / Math.max(.15, R))]);
  }
  // The leader: a straight spire of fresh growth at the top.
  spray([V(0, TREE.top - .7, 0), V(0, TREE.top - .3, 0), V(0, TREE.top + .02, 0)], 12, .32, () => 1);
  const foliage = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).translate(0, .5, 0), sprigMat, cards.length);
  const deep = new THREE.Color('#5e7c5c'), light = new THREE.Color('#d9e6cf'), c = new THREE.Color();
  cards.forEach(([mm, d], i) => { foliage.setMatrixAt(i, mm); foliage.setColorAt(i, c.copy(deep).lerp(light, Math.pow(d, 1.6) * (.75 + r() * .25))); });
  foliage.receiveShadow = true;
  sway.add(foliage);

  // ---- Fairy lights: warm white, all through the tree, more at the foot.
  const lights = [];
  for (let tries = 0; lights.length < 900 && tries < 12000; tries++) {
    const y = TREE.base + .15 + (TREE.top - .4 - TREE.base) * (1 - Math.sqrt(r()));
    const R = radiusAt(y), a = r() * Math.PI * 2, rad = R * (r() < .2 ? .75 + r() * .2 : .98 + r() * .1) + .03;
    const p = V(Math.cos(a) * rad, y, Math.sin(a) * rad);
    if (!blocked(p)) lights.push(p);
  }
  const bulbMat = new THREE.MeshBasicMaterial({color: '#fff1cf'});
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(.03, 6, 4), bulbMat, lights.length);
  lights.forEach((p, i) => bulbs.setMatrixAt(i, m4.makeTranslation(p.x, p.y, p.z)));
  sway.add(bulbs);
  const glowTex = glowTexture();
  // (Two sets, breathing out of step: a gentle twinkle.)
  const glowMats = [0, 1].map(() => new THREE.PointsMaterial({map: glowTex, size: .5, sizeAttenuation: true, transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false}));
  [0, 1].forEach(k => {
    const pts = new THREE.Points(new THREE.BufferGeometry().setFromPoints(lights.filter((_, i) => i % 2 === k)), glowMats[k]);
    pts.frustumCulled = false; sway.add(pts);
  });

  // ---- Ornaments: as in the picture, glass baubles in gold, champagne,
  // bronze, mercury silver and deep red (round ones, and long teardrops),
  // and big burgundy velvet bows; a gold star on top.
  const B = batcher();
  const glass = new THREE.MeshPhysicalMaterial({color: '#ffffff', metalness: .6, roughness: .2, clearcoat: 1, clearcoatRoughness: .06});
  const brass = new THREE.MeshStandardMaterial({color: '#c9a45a', metalness: .9, roughness: .3});
  const gold = new THREE.MeshStandardMaterial({color: '#f0c66a', metalness: .55, roughness: .25, emissive: '#b07a1c', emissiveIntensity: .9});
  const velvet = new THREE.MeshStandardMaterial({color: '#9a1a2c', roughness: .7, side: THREE.DoubleSide, emissive: '#3a0610', emissiveIntensity: .5});
  const sphere = new THREE.SphereGeometry(1, 16, 12), cap = new THREE.CylinderGeometry(.24, .28, .3, 8);
  const drop = lathe([[0, -1], [.18, -.85], [.42, -.45], [.55, -.05], [.45, .3], [.18, .52], [.12, .62], [0, .62]], 14);
  const put = (geo, mat, p, sc, color = null, rot = 0) => { q.setFromAxisAngle(Y, rot); m4.compose(p, q, typeof sc === 'number' ? s.setScalar(sc) : sc); B.add(geo, mat, m4, color); };

  // Spots to hang things: out on the bough tips, never where she lies or
  // hides, and not crowding each other.
  const hung = [];
  const free = (p, gap) => !nearHer(p, .42) && !blocked(p) && hung.every(h => h.distanceTo(p) > gap);
  const spot = (gap, yMin = TREE.base + .15, yMax = TREE.top - .6) => {
    for (let k = 0; k < 80; k++) {
      const y = yMin + (yMax - yMin) * (1 - Math.sqrt(r())), a = r() * Math.PI * 2, R = radiusAt(y) * (.97 + r() * .09) + .02;
      const p = V(Math.cos(a) * R, y, Math.sin(a) * R);
      if (free(p, gap)) { hung.push(p); return p; }
    }
    return null;
  };
  const BAUBLES = ['#d9b25e', '#e8cf95', '#c79a4a', '#a8662f', '#8a4a24', '#d7d9dc', '#b9bcc2', '#7a1320', '#5c1018', '#efe3c4', '#d9b25e', '#c79a4a', '#e8cf95'];
  for (let i = 0; i < 230; i++) {
    const p = spot(.2); if (!p) break;
    const rad = .09 + r() * .07;
    put(sphere, glass, p.clone().add(V(0, -rad, 0)), rad, BAUBLES[Math.floor(r() * BAUBLES.length)]);
    put(cap, brass, p.clone().add(V(0, .01, 0)), rad * .9);
  }
  for (let i = 0; i < 45; i++) {
    const p = spot(.25); if (!p) break;
    const k = .1 + r() * .05;
    put(drop, glass, p.clone().add(V(0, -k * .62, 0)), V(k, k * 1.3, k), ['#d9b25e', '#e8cf95', '#a8662f', '#d7d9dc', '#7a1320'][i % 5], r() * 6);
    put(cap, brass, p, k * .6);
  }
  // Velvet bows, big, on the front and sides, facing out.
  if (bow) {
    const bows = [];
    for (let i = 0; i < 120 && bows.length < 15; i++) {
      const y = TREE.base + .6 + (TREE.top - 1.6 - TREE.base) * r(), a = r() * Math.PI * 2, R = radiusAt(y) + .16;
      const p = V(Math.cos(a) * R, y, Math.sin(a) * R);
      if (blocked(p) || nearHer(p, 1.0) || bows.some(o => o.distanceTo(p) < 1.15)) continue;
      bows.push(p);
      q.setFromAxisAngle(Y, Math.atan2(p.x, p.z)); const k = 1.35 + r() * .35;
      B.add(bow, velvet, m4.compose(p, q, s.set(k, k, k)));
    }
  }
  // A gold eight-pointed star on top.
  {
    const sh = new THREE.Shape();
    for (let i = 0; i <= 16; i++) { const a = i / 16 * Math.PI * 2, rr = i % 2 ? .09 : (i % 4 === 0 ? .3 : .2); sh[i ? 'lineTo' : 'moveTo'](Math.sin(a) * rr, Math.cos(a) * rr); }
    const star = new THREE.ExtrudeGeometry(sh, {depth: .04, bevelEnabled: true, bevelThickness: .02, bevelSize: .015, bevelSegments: 1}).translate(0, 0, -.02);
    put(star, gold, V(0, TREE.top + .45, 0), 1.7, null, Math.PI * .1);
    put(new THREE.CylinderGeometry(.04, .05, .4, 8), gold, V(0, TREE.top + .05, 0), 1);
  }
  const ornaments = B.build(sway);

  // ---- Baubles of her own: each on its own string, to swing when batted
  // and to come off. Under her paws at the high perch; low on the front
  // boughs (where she meets the tree from the floor); over where she hides.
  const loose = [];
  const hangLoose = (p, color, rad, group) => {
    const pivot = new THREE.Group(); pivot.position.copy(p); sway.add(pivot);
    const b = new THREE.Group(); pivot.add(b);
    const ball = new THREE.Mesh(sphere, glass.clone()); ball.material.color.set(color); ball.scale.setScalar(rad); ball.position.y = -.07 - rad;
    const top = new THREE.Mesh(cap, brass); top.scale.setScalar(rad * .9); top.position.y = -.06;
    const loop = new THREE.Mesh(new THREE.CylinderGeometry(.004, .004, .07, 3), brass); loop.position.y = -.03;
    b.add(ball, top, loop);
    loose.push({i: loose.length, group, pivot, b, rad, swing: V(0, 0, 0), spin: V(0, 0, 0), down: null});
  };
  {
    const H = P('treeHigh'), f = V(Math.sin(H.face), 0, Math.cos(H.face)), paw = V(H.spot[0] - TREE.x, H.top - .38, H.spot[1] - TREE.z).addScaledVector(f, .4);
    const side = V(f.z, 0, -f.x);
    [[0, 0, '#d9b25e', .1], [.32, .1, '#7a1320', .09], [-.3, .16, '#e8cf95', .085]].forEach(([dx, dy, color, rad]) => hangLoose(paw.clone().addScaledVector(side, dx).add(V(0, -dy, 0)).add(V(0, 0, .12)), color, rad, 'high'));
  }
  [[-1.0, 1.32, '#d9b25e', .1], [-1.15, 1.18, '#7a1320', .11], [-1.3, 1.28, '#d7d9dc', .095]].forEach(([a, y, color, rad]) => {
    a += RY; const d = radiusAt(y) + .04; hangLoose(V(Math.sin(a) * d, y, Math.cos(a) * d), color, rad, 'low');
  });
  {
    const hx = TREE.hide[0] - TREE.x, hz = TREE.hide[1] - TREE.z, f = V(Math.sin(TREE.hideFace), 0, Math.cos(TREE.hideFace));
    [[.2, '#a8662f', .09], [-.25, '#e8cf95', .085]].forEach(([dx, color, rad]) => hangLoose(V(hx, 1.02, hz).addScaledVector(f, .45).add(V(f.z * dx, 0, -f.x * dx)), color, rad, 'hide'));
  }

  // ---- Under the tree: a cream knitted skirt in soft folds, a few
  // baubles lying on it, and the open box.
  {
    const geo = new THREE.RingGeometry(.48, 1.75, 64, 4), pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), rr = Math.hypot(x, y), a = Math.atan2(y, x), k = (rr - .48) / 1.27;
      pos.setZ(i, .015 + k * k * (.05 + .05 * Math.sin(a * 9) + .03 * Math.sin(a * 23 + 1)));
      const wob = 1 + .04 * Math.sin(a * 7) * k; pos.setX(i, x * wob); pos.setY(i, y * wob);
    }
    geo.rotateX(-Math.PI / 2); geo.computeVertexNormals();
    const knit = new THREE.MeshStandardMaterial({color: '#eadfca', roughness: 1, side: THREE.DoubleSide, map: canvasTexture(128, 128, (g, w, h) => {
      g.fillStyle = '#f1e8d6'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 8) for (let x = 0; x < w; x += 6) { g.fillStyle = (x / 6 + y / 8) % 2 ? 'rgba(160,140,110,.18)' : 'rgba(255,255,255,.25)'; g.beginPath(); g.ellipse(x + 3, y + 4, 2.4, 3.6, .5, 0, 7); g.fill(); }
    }, {repeat: [6, 6]})});
    const skirt = new THREE.Mesh(geo, knit); skirt.receiveShadow = true; root.add(skirt);
    const S2 = batcher();
    for (const [a, d, color, rad] of [[-.2, 1.1, '#d9b25e', .1], [.9, .95, '#7a1320', .09], [-1.6, 1.15, '#e8cf95', .085], [2.6, 1.0, '#a8662f', .1]]) {
      const p = V(Math.sin(a + RY) * d, rad + .05, Math.cos(a + RY) * d);
      if (blocked(p) || Math.hypot(p.x + TREE.x - TREE.hide[0], p.z + TREE.z - TREE.hide[1]) < .7) continue;
      S2.add(sphere, glass, m4.compose(p, q.identity(), s.setScalar(rad)), color);
      S2.add(cap, brass, m4.compose(p.clone().add(V(rad * .9, .02, 0)), q.setFromAxisAngle(V(0, 0, 1), -Math.PI / 2), s.setScalar(rad * .9)));
    }
    S2.build(root, {cast: true});
  }
  // The open box: kraft card, its flaps folded out, red tissue in it.
  const kraft = new THREE.MeshStandardMaterial({color: '#b98f5c', roughness: .95, side: THREE.DoubleSide});
  const box = new THREE.Group(); box.position.set(TREE.box.spot[0] - TREE.x, .02, TREE.box.spot[1] - TREE.z); box.rotation.y = TREE.box.ry; root.add(box);
  const BW = 1.05, BD = .85, BH = .32;
  const wall = (w, x, z, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, BH), kraft); m.position.set(x, BH / 2, z); m.rotation.y = ry; m.castShadow = true; m.receiveShadow = true; box.add(m); return m; };
  wall(BW, 0, BD / 2, 0); wall(BW, 0, -BD / 2, 0); wall(BD, BW / 2, 0, Math.PI / 2); wall(BD, -BW / 2, 0, Math.PI / 2);
  const floorB = new THREE.Mesh(new THREE.PlaneGeometry(BW, BD), kraft); floorB.rotation.x = -Math.PI / 2; floorB.position.y = .012; box.add(floorB);
  for (const [w, x, z, ry, out] of [[BW, 0, BD / 2, 0, 1], [BW, 0, -BD / 2, 0, -1], [BD, BW / 2, 0, Math.PI / 2, 1], [BD, -BW / 2, 0, Math.PI / 2, -1]]) {
    const hinge = new THREE.Group(); hinge.position.set(x, BH, z); hinge.rotation.y = ry; box.add(hinge);
    const flap = new THREE.Mesh(new THREE.PlaneGeometry(w * .96, .28).translate(0, .14, 0), kraft); flap.rotation.x = out * 1.15; hinge.add(flap);
  }
  const tissue = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), new THREE.MeshStandardMaterial({color: '#7a1320', roughness: .8}));
  tissue.scale.set(.18, .14, .14); tissue.position.set(-BW / 2 + .12, BH - .02, BD / 2 - .15); box.add(tissue);

  // A tap on the tree hits this: a plain cone round it, never drawn.
  const hit = new THREE.Mesh(new THREE.ConeGeometry(TREE.radius * .95, TREE.top - TREE.base, 12).translate(0, (TREE.top + TREE.base) / 2, 0), new THREE.MeshBasicMaterial({visible: false}));
  root.add(hit);
  const boxHit = new THREE.Mesh(new THREE.BoxGeometry(BW + .1, BH + .3, BD + .1).translate(0, (BH + .3) / 2, 0), new THREE.MeshBasicMaterial({visible: false}));
  box.add(boxHit);

  // ---- In the evening: a warm pool of light on the floor round it.
  const washTex = canvasTexture(128, 128, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grd.addColorStop(0, 'rgba(255,190,110,.9)'); grd.addColorStop(.5, 'rgba(255,160,80,.35)'); grd.addColorStop(1, 'rgba(255,140,60,0)');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  });
  const washMat = new THREE.MeshBasicMaterial({map: washTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false});
  const washFloor = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 6.5), washMat); washFloor.rotation.x = -Math.PI / 2; washFloor.position.set(.4 * Math.cos(RY) + .3 * Math.sin(RY), .012, .3 * Math.cos(RY) - .4 * Math.sin(RY)); root.add(washFloor);

  // ---- Movement: the sway (a damped spring about the foot) and the
  // baubles' swing and fall.
  const sw = {ang: V(0, 0, 0), vel: V(0, 0, 0)};
  let glowSize = .4, night = 0;
  const tmp = V(0, 0, 0);
  const tree = {
    root, sway, foliage, ornaments, loose, hit, boxHit, onLand: null,
    // A push at the tree: `dir` (the kitchen's frame) is the way the top goes.
    shake(amount = .5, dir = null) {
      const d = dir ? V(dir.x, 0, dir.z).normalize() : V(r() - .5, 0, r() - .5).normalize();
      sw.vel.x += d.z * amount * .07; sw.vel.z += -d.x * amount * .07;
    },
    // A pat: the bauble swings away from her paw.
    bat(i, dir, k = 1) {
      const L = loose[i]; if (!L || L.down) return false;
      L.swing.x += dir.z * 3.2 * k; L.swing.z += -dir.x * 3.2 * k; L.spin.y += (r() - .5) * 6 * k;
      return true;
    },
    // Off it comes: from where it hangs, falling, bouncing and rolling.
    drop(i) {
      const L = loose[i]; if (!L || L.down) return false;
      const p = L.b.children[0].getWorldPosition(V(0, 0, 0)); root.worldToLocal(p);
      L.pivot.visible = false;
      const g = new THREE.Group(); g.add(L.b.children[0].clone()); g.children[0].position.set(0, 0, 0);
      g.position.copy(p); floorItems.add(g);
      const out = V(p.x, 0, p.z).normalize();
      L.down = {g, vel: V(out.x * .6, .5, out.z * .6), landed: 0, rest: false};
      return true;
    },
    // A tap on a fallen bauble: back on its branch.
    rehang(i) {
      const L = loose[i]; if (!L?.down) return false;
      floorItems.remove(L.down.g); L.down = null; L.pivot.visible = true; L.swing.set(.6, 0, .4);
      return true;
    },
    // Nudged along the floor.
    kick(i, dir, speed = 2) {
      const D = loose[i]?.down; if (!D) return false;
      D.vel.x += dir.x * speed; D.vel.z += dir.z * speed; D.vel.y = Math.max(D.vel.y, .6); D.rest = false;
      return true;
    },
    fallen() { return loose.filter(L => L.down); },
    hanging(group) { return loose.filter(L => !L.down && (!group || L.group === group)); },
    ballWorld(i, v = V(0, 0, 0)) { const L = loose[i]; return L.down ? L.down.g.getWorldPosition(v) : L.b.children[0].getWorldPosition(v); },
    // Points on the tree in the world (its frame's x, y, z): for her eyes.
    world(x, y, z, v = V(0, 0, 0)) { return root.localToWorld(v.set(x, y, z)); },
    hitFallen(ray) {
      let best = null;
      for (const L of loose) if (L.down) { const p = L.down.g.getWorldPosition(V(0, 0, 0)); const d = ray.ray.distanceToPoint(p); if (d < .3 && (!best || d < best.d)) best = {i: L.i, d, dist: ray.ray.origin.distanceTo(p)}; }
      return best;
    },
    update(dt, t, isNight) {
      if (!root.visible) return;
      dt = Math.min(dt, .05);
      night += ((isNight ? 1 : 0) - night) * (1 - Math.exp(-3 * dt));
      // Sway: a big tree, slower to swing and slower to settle.
      sw.vel.addScaledVector(sw.ang, -20 * dt).multiplyScalar(Math.exp(-2.4 * dt)); sw.ang.addScaledVector(sw.vel, dt);
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
        // drifting round to its front, onto the open floor in her reach.
        const fr0 = Math.hypot(g.position.x, g.position.z), Rb = radiusAt(Math.max(g.position.y, TREE.base)) + L.rad;
        if (g.position.y > TREE.base - .1 && fr0 < Rb) {
          let a = Math.atan2(g.position.x, g.position.z);
          a += Math.atan2(Math.sin(FRONT - a), Math.cos(FRONT - a)) * Math.min(1, 4 * dt);
          g.position.x = Math.sin(a) * Rb; g.position.z = Math.cos(a) * Rb;
          const n = V(Math.sin(a), 0, Math.cos(a)), vn = D.vel.dot(n);
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
        // (The kitchen's walls, the back counter, the island, the tent and
        // the other round things, the tree's stand and the open box.)
        const wx = g.position.x + TREE.x, wz = g.position.z + TREE.z, rad = L.rad;
        if (wx < -5.9 + rad) { g.position.x = -5.9 + rad - TREE.x; D.vel.x = Math.abs(D.vel.x) * .5; }
        if (wx > 6.92 - rad) { g.position.x = 6.92 - rad - TREE.x; D.vel.x = -Math.abs(D.vel.x) * .5; }
        if (wz < -4.1 + rad) { g.position.z = -4.1 + rad - TREE.z; D.vel.z = Math.abs(D.vel.z) * .5; }
        if (wz > 9) { g.position.z = 9 - TREE.z; D.vel.z = -Math.abs(D.vel.z) * .5; }
        for (const C of circles) {
          if (g.position.y > C.top + rad) continue;
          tmp.set(g.position.x + TREE.x - C.x, 0, g.position.z + TREE.z - C.z);
          const d = tmp.length(), RR = C.r + rad;
          if (d < RR && d > 1e-4) { tmp.normalize(); g.position.x = C.x + tmp.x * RR - TREE.x; g.position.z = C.z + tmp.z * RR - TREE.z; const vn = D.vel.dot(tmp); if (vn < 0) D.vel.addScaledVector(tmp, -1.5 * vn); }
        }
        for (const S of solids) {
          if (g.position.y > S.top + rad) continue;
          const x0 = S.x0 - rad, x1 = S.x1 + rad, z0 = S.z0 - rad, z1 = S.z1 + rad, X = g.position.x + TREE.x, Z = g.position.z + TREE.z;
          if (X > x0 && X < x1 && Z > z0 && Z < z1) {
            const opts = [[x0 - X, 'x'], [x1 - X, 'x'], [z0 - Z, 'z'], [z1 - Z, 'z']].reduce((a, b) => Math.abs(b[0]) < Math.abs(a[0]) ? b : a);
            g.position[opts[1]] += opts[0]; if (Math.sign(D.vel[opts[1]]) !== Math.sign(opts[0])) D.vel[opts[1]] *= -.5;
          }
        }
        const fr = Math.hypot(g.position.x, g.position.z), R0 = TREE.ring + rad;
        if (fr < R0 && g.position.y < .8) { g.position.x *= R0 / fr; g.position.z *= R0 / fr; const n = V(g.position.x / fr, 0, g.position.z / fr), vn = D.vel.dot(n); if (vn < 0) D.vel.addScaledVector(n, -1.5 * vn); }
        tmp.set(g.position.x - box.position.x, 0, g.position.z - box.position.z);
        const bd = tmp.length(), BR = .72 + rad;
        if (bd < BR && g.position.y < BH + rad) { tmp.normalize(); g.position.x = box.position.x + tmp.x * BR; g.position.z = box.position.z + tmp.z * BR; const vn = D.vel.dot(tmp); if (vn < 0) D.vel.addScaledVector(tmp, -1.5 * vn); }
      }
      // Lights: on by day too (as in the picture), brighter in the evening.
      const twinkle = Math.sin(t * 1.7) * .06;
      glowSize += ((isNight ? .75 : .5) - glowSize) * (1 - Math.exp(-3 * dt));
      glowMats[0].size = glowSize * (1 + twinkle); glowMats[1].size = glowSize * (1 - twinkle);
      for (const m of glowMats) m.opacity = .7 + .3 * night;
      washMat.opacity = .04 + .3 * night;
      // (The branches catch the lights' warmth in the evening.)
      sprigMat.emissiveIntensity = .12 + .5 * night;
    },
  };
  return tree;
}
