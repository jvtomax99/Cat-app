// Mochi's room: a cozy, classic study built in 3D from simple shapes and
// textures drawn in code (no photos are used). Limed oak floor, panelled
// wainscoting, a tall window with linen curtains, an olive-and-navy plaid
// rug, a tufted leather club chair with a plaid throw, side table and brass
// lamp, a large abstract painting, a limestone fireplace, an olive tree,
// plaid cat bed with a plush lining, an ivory food bowl and an olive ceramic
// water fountain.
//
// Scale: about 2.4 scene units per metre, matching Mochi.
import * as THREE from 'three';
import {windowView} from './window-view.js';

const {damp} = THREE.MathUtils;
const V2 = (x, y) => new THREE.Vector2(x, y);

export function rng(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

let maxAniso = 4;
const _n = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Vector3();
export const MOONLIGHT = new THREE.Color('#7f9cff'), DAYLIGHT = new THREE.Color('#ffffff');
export function canvasTexture(w, h, draw, {repeat = [1, 1], color = true} = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = maxAniso;
  return t;
}

// ---------------------------------------------------------------------------
// Textures
// ---------------------------------------------------------------------------
// limed: lime paste left in the open grain (pale streaks), softer knots and
// seams, and a faint white wash: lightly limed natural oak.
export function drawWood(g, w, h, {planks = 8, colors, seed = 1, grain = 46, limed = false}) {
  const r = rng(seed), ph = h / planks;
  for (let i = 0; i < planks; i++) {
    let x = -r() * 400;
    while (x < w) {
      const len = 380 + r() * 520;
      const c = colors[Math.floor(r() * colors.length)];
      g.fillStyle = c;
      g.fillRect(x, i * ph, len, ph);
      g.save();
      g.beginPath(); g.rect(x, i * ph, len, ph); g.clip();
      // Soft colour drift along the board.
      const drift = g.createLinearGradient(x, 0, x + len, 0);
      drift.addColorStop(0, `rgba(255,220,170,${r() * .08})`);
      drift.addColorStop(.5, `rgba(60,25,5,${r() * .1})`);
      drift.addColorStop(1, `rgba(255,220,170,${r() * .08})`);
      g.fillStyle = drift; g.fillRect(x, i * ph, len, ph);
      for (let k = 0; k < grain; k++) {
        const y0 = i * ph + r() * ph, amp = 1 + r() * 4, f = .004 + r() * .01, ph0 = r() * 6;
        g.strokeStyle = limed
          ? (r() < .5 ? `rgba(246,240,228,${.08 + r() * .14})` : `rgba(88,60,34,${.08 + r() * .14})`)
          : r() < .75 ? `rgba(55,25,8,${.05 + r() * .12})` : `rgba(255,215,160,${.04 + r() * .06})`;
        g.lineWidth = .6 + r() * 2.2;
        g.beginPath();
        for (let xx = x; xx <= x + len; xx += 12) g.lineTo(xx, y0 + Math.sin(xx * f + ph0) * amp);
        g.stroke();
      }
      if (r() < .45) {
        const kx = x + r() * len, ky = i * ph + ph * (.3 + r() * .4), kr = 6 + r() * 10;
        const kg = g.createRadialGradient(kx, ky, 1, kx, ky, kr * 2.2);
        if (limed) { kg.addColorStop(0, 'rgba(92,66,40,.62)'); kg.addColorStop(.4, 'rgba(120,90,58,.3)'); kg.addColorStop(1, 'rgba(120,90,58,0)'); }
        else { kg.addColorStop(0, 'rgba(40,18,5,.75)'); kg.addColorStop(.4, 'rgba(70,32,10,.35)'); kg.addColorStop(1, 'rgba(70,32,10,0)'); }
        g.fillStyle = kg;
        g.beginPath(); g.ellipse(kx, ky, kr * 2.2, kr, 0, 0, Math.PI * 2); g.fill();
      }
      g.restore();
      g.fillStyle = limed ? 'rgba(78,58,38,.42)' : 'rgba(30,14,4,.55)';
      g.fillRect(x, i * ph, 2, ph);
      x += len;
    }
    g.fillStyle = limed ? 'rgba(78,58,38,.45)' : 'rgba(30,14,4,.6)';
    g.fillRect(0, i * ph, w, 2);
  }
  if (limed) { g.fillStyle = 'rgba(244,240,230,.07)'; g.fillRect(0, 0, w, h); }
}

function drawPlaid(g, w, h, {base, stripes, seed = 3}) {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (const dir of [0, 1]) {
    g.globalAlpha = .62;
    let p = 0;
    for (const [c, s] of stripes) {
      g.fillStyle = c;
      if (dir) g.fillRect(p, 0, s, h); else g.fillRect(0, p, w, s);
      p += s;
    }
  }
  g.globalAlpha = 1;
  // Twill weave and wool fuzz.
  const r = rng(seed);
  g.strokeStyle = 'rgba(0,0,0,.07)'; g.lineWidth = 1;
  for (let d = -h; d < w; d += 3) { g.beginPath(); g.moveTo(d, 0); g.lineTo(d + h, h); g.stroke(); }
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = r() < .5 ? 'rgba(255,245,220,.06)' : 'rgba(0,0,0,.07)';
    g.fillRect(r() * w, r() * h, 1 + r() * 2, 1);
  }
}

export function drawNoise(g, w, h, {base, blobs, seed = 5}) {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  const r = rng(seed);
  for (const [color, count, min, max] of blobs) {
    g.fillStyle = color;
    for (let i = 0; i < count; i++) {
      const s = min + r() * (max - min);
      g.beginPath(); g.ellipse(r() * w, r() * h, s, s * (.5 + r() * .8), r() * 3, 0, Math.PI * 2); g.fill();
    }
  }
}

export function drawLeather(g, w, h) {
  drawNoise(g, w, h, {base: '#4f2a17', blobs: [['rgba(130,78,42,.09)', 900, 8, 40], ['rgba(50,20,6,.08)', 900, 6, 34], ['rgba(190,120,60,.05)', 400, 20, 70]], seed: 9});
  const r = rng(11);
  for (let i = 0; i < 260; i++) {
    g.strokeStyle = r() < .7 ? 'rgba(40,15,4,.18)' : 'rgba(220,160,100,.1)';
    g.lineWidth = .5 + r() * 1.2;
    let x = r() * w, y = r() * h;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 4; k++) { x += (r() - .5) * 26; y += (r() - .5) * 26; g.lineTo(x, y); }
    g.stroke();
  }
}

export function drawLinen(g, w, h, {base, seed = 7, dark = .07}) {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  const r = rng(seed);
  for (let y = 0; y < h; y += 2) { g.fillStyle = `rgba(0,0,0,${r() * dark})`; g.fillRect(0, y, w, 1); }
  for (let x = 0; x < w; x += 2) { g.fillStyle = `rgba(255,255,255,${r() * dark})`; g.fillRect(x, 0, 1, h); }
  for (let i = 0; i < 160; i++) { g.fillStyle = 'rgba(80,60,30,.08)'; g.fillRect(r() * w, r() * h, 10 + r() * 40, 1.5); }
}

function drawSherpa(g, w, h) {
  drawNoise(g, w, h, {base: '#d6c7aa', blobs: [['rgba(120,100,70,.35)', 5000, 2, 4.5], ['rgba(248,240,225,.6)', 6000, 1.5, 4]], seed: 13});
}

// An original abstract in the spirit of mid-century European painting: a
// slab of cobalt, a block of vermilion, black bars and chalky whites, laid
// on with a dry brush and a palette knife and worn back in places. Signed,
// small and in paint, in the bottom right corner.
export function drawAbstract(g, w, h) {
  const r = rng(58);
  const pick = c => Array.isArray(c) ? c[Math.floor(r() * c.length)] : c;
  // A block built up from palette-knife dabs: slanted slabs of paint in
  // slightly different mixes, thicker in the middle, broken at the edges so
  // the layers underneath show through.
  const rough = (x, y, ww, hh, color, {alpha = 1, jag = 10, layers = 5} = {}) => {
    const n = Math.round(ww * hh / 2400 / (w / 768) ** 2 * layers * .5);
    for (let i = 0; i < n; i++) {
      const u = r(), v = r(), edge = Math.min(u, 1 - u, v, 1 - v);
      const px = x + u * ww + (r() - .5) * jag, py = y + v * hh + (r() - .5) * jag;
      const dw = (34 + r() * 110) * w / 768, dh = (14 + r() * 38) * w / 768, sk = (r() - .5) * dh * 1.2;
      g.globalAlpha = alpha * (edge < .06 ? .3 + r() * .45 : .7 + r() * .3);
      g.fillStyle = pick(color);
      g.save(); g.translate(px, py); g.rotate((r() - .5) * .35);
      g.beginPath(); g.moveTo(-dw / 2, -dh / 2); g.lineTo(dw / 2 + sk, -dh / 2 + (r() - .5) * 4); g.lineTo(dw / 2, dh / 2); g.lineTo(-dw / 2 - sk, dh / 2 + (r() - .5) * 4); g.closePath(); g.fill();
      // A ridge of lighter paint where the knife lifted.
      if (r() < .35) { g.globalAlpha *= .5; g.fillStyle = 'rgba(255,250,240,.6)'; g.fillRect(-dw / 2, -dh / 2, dw, 1.5); }
      g.restore();
    }
    g.globalAlpha = 1;
  };
  const scumble = (x, y, ww, hh, color, n, a) => {
    // Dry brush: long, broken drags that catch only the high spots.
    for (let i = 0; i < n; i++) {
      g.globalAlpha = a * (.3 + r() * .7);
      g.fillStyle = color;
      let sx = x + r() * ww, sy = y + r() * hh;
      const len = 30 + r() * ww * .5, hgt = 1 + r() * 5;
      for (let k = 0; k < len; k += 6 + r() * 10) if (r() < .7) g.fillRect(sx + k, sy + (r() - .5) * 2, 5 + r() * 9, hgt);
    }
    g.globalAlpha = 1;
  };
  const W = k => k * w, H = k => k * h;
  const chalk = ['#ece5d6', '#e4dccb', '#f2ece0', '#d9d0bd', '#cfc6b3'], cobalt = ['#1c3e9c', '#21469f', '#183585', '#2a52ad', '#13296b'];
  const vermilion = ['#e2531f', '#d8481b', '#ec6528', '#cf4317', '#f07a35'], black = ['#17140f', '#221d17', '#0f0d0a', '#2b261f'];
  // Underpainting: a warm grey ground, loosely scrubbed in with ochre and
  // umber, which shows through wherever the top layers break.
  g.fillStyle = '#d8cdb6'; g.fillRect(0, 0, w, h);
  rough(0, 0, w, h, ['#c9b994', '#b8a27a', '#d6cbb4', '#a8987c', '#8c7d66'], {alpha: .7, jag: 30, layers: 2});
  // The big blue, top left, with a deeper blue pressed into it.
  rough(W(-.03), H(-.03), W(.63), H(.45), cobalt, {jag: 34, layers: 9});
  rough(W(.05), H(.05), W(.32), H(.18), ['#122a6e', '#183588', '#0f2259'], {alpha: .8, jag: 24, layers: 5});
  // Chalk whites across the middle and up the right, worn thin.
  rough(W(.03), H(.41), W(.44), H(.27), chalk, {jag: 36, layers: 8});
  rough(W(.6), H(.03), W(.39), H(.32), chalk, {jag: 32, layers: 8});
  // Black: a bar down the middle, a slab at the lower left, shards.
  rough(W(.555), H(.02), W(.075), H(.44), black, {jag: 12, layers: 8});
  rough(W(.02), H(.7), W(.3), H(.17), black, {jag: 26, layers: 8});
  rough(W(.32), H(.46), W(.11), H(.08), black, {alpha: .9, jag: 14, layers: 6});
  rough(W(.77), H(.33), W(.19), H(.06), black, {alpha: .9, jag: 12, layers: 6});
  // The vermilion block, lower right, glowing against the black.
  rough(W(.46), H(.39), W(.55), H(.5), vermilion, {jag: 34, layers: 10});
  rough(W(.55), H(.47), W(.3), H(.18), ['#f58a45', '#ef7834', '#f6a060'], {alpha: .6, jag: 26, layers: 5});
  // A little blue carried down into the lower half, and chalk along the bottom.
  rough(W(.36), H(.65), W(.16), H(.15), cobalt, {alpha: .9, jag: 18, layers: 7});
  rough(W(.3), H(.86), W(.72), H(.16), chalk, {jag: 26, layers: 7});
  rough(W(-.02), H(.86), W(.34), H(.16), ['#d9d0bd', '#cfc4ae', '#bfb39b'], {jag: 22, layers: 6});
  // Knife work and wear: scrapes of each colour over the others.
  scumble(W(0), H(0), W(.6), H(.42), '#e9e2d3', 70, .22);
  scumble(W(.47), H(.4), W(.53), H(.48), '#efe7d7', 50, .18);
  scumble(W(.04), H(.42), W(.42), H(.25), '#1d3f9a', 30, .2);
  scumble(W(.6), H(.04), W(.38), H(.3), '#d8481b', 18, .2);
  scumble(0, 0, w, h, '#17140f', 60, .2);
  // Fine crackle and specks.
  g.lineWidth = 1;
  for (let i = 0; i < 140; i++) {
    g.strokeStyle = `rgba(20,16,12,${.08 + r() * .2})`;
    let x = r() * w, y = r() * h;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 4; k++) { x += (r() - .5) * 40; y += (r() - .5) * 40; g.lineTo(x, y); }
    g.stroke();
  }
  for (let i = 0; i < 500; i++) {
    g.fillStyle = [`rgba(20,16,12,${r() * .5})`, `rgba(240,234,222,${r() * .5})`][i % 2];
    g.fillRect(r() * w, r() * h, 1 + r() * 2.5, 1 + r() * 2.5);
  }
  paintSignature(g, W(.955), H(.962), h * .021, r);
}

// The artists' signature, in paint: each letter is a few brush strokes of
// our own (no font needed, so it looks the same on every device), with a
// slant, a little wobble from letter to letter, strokes that swell and
// taper.
const SIGNATURE = (() => {
  const ell = (cx, cy, rx, ry, a0, a1, n = 18) => Array.from({length: n + 1}, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]; });
  const T = Math.PI;
  return {
    O: {w: .72, s: [ell(.34, .5, .32, .5, T * .45, T * 2.55, 26)]},
    r: {w: .42, s: [[[.06, .48], [.05, .2], [.05, 0]], [[.05, .26], [.14, .44], [.27, .5], [.38, .44]]]},
    i: {w: .24, s: [[[.08, .48], [.07, .2], [.09, 0], [.16, .04]], [[.1, .74], [.12, .76]]]},
    o: {w: .5, s: [ell(.23, .25, .2, .25, T * .4, T * 2.5, 18)]},
    n: {w: .54, s: [[[.05, .48], [.05, 0]], [[.05, .28], [.15, .46], [.28, .5], [.39, .42], [.42, .2], [.44, 0], [.5, .05]]]},
    ' ': {w: .22, s: []},
    '&': {w: .62, s: [[[.58, 0], [.42, .16], [.2, .42], [.12, .62], [.18, .82], [.3, .86], [.38, .76], [.34, .6], [.18, .44], [.04, .26], [.06, .08], [.2, 0], [.36, .06], [.52, .24], [.6, .36]]]},
    C: {w: .66, s: [ell(.38, .5, .34, .5, -T * .28, -T * 1.72, 22)]},
    h: {w: .54, s: [[[.08, 1], [.06, .5], [.05, 0]], [[.05, .28], [.15, .46], [.28, .5], [.39, .42], [.42, .2], [.44, 0], [.5, .05]]]},
    a: {w: .52, s: [ell(.22, .25, .19, .25, -T * .1, -T * 2.05, 18), [[.42, .48], [.41, .2], [.43, 0], [.5, .05]]]},
    d: {w: .54, s: [ell(.22, .25, .19, .25, -T * .1, -T * 2.05, 18), [[.44, 1.02], [.42, .5], [.43, 0], [.52, .06]]]},
  };
})();
function paintSignature(g, right, baseline, size, r) {
  const text = 'Orion & Chad', slant = .22;
  const width = [...text].reduce((t, ch) => t + SIGNATURE[ch].w + .05, 0) * size;
  // Smooth a stroke's points into a dense path (Catmull-Rom), in pixels.
  const smooth = (pts, ox, oy, sc, rot) => {
    const P = pts.map(([px, py]) => { const X = px * sc, Y = py * sc; return [ox + (X + Y * slant) * Math.cos(rot) + Y * Math.sin(rot), oy - Y * Math.cos(rot) + X * Math.sin(rot)]; });
    if (P.length < 2) return P;
    const out = [];
    for (let i = 0; i < P.length - 1; i++) {
      const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
      const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / .6));
      for (let k = 0; k < n; k++) {
        const t = k / n, t2 = t * t, t3 = t2 * t;
        out.push([0, 1].map(j => .5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
      }
    }
    out.push(P[P.length - 1]);
    return out;
  };
  // Lay a stroke down as dabs from a small round brush.
  const paint = (path, wd) => {
    const load = .8 + r() * .2;
    path.forEach(([px, py], i) => {
      const k = i / Math.max(1, path.length - 1), rad = wd * (.45 + .55 * Math.pow(Math.sin(Math.PI * Math.min(.98, .08 + k * .9)), .5)) * load;
      g.globalAlpha = .5 + r() * .4;
      g.fillStyle = r() < .88 ? '#1a140f' : '#40291b';
      g.beginPath(); g.arc(px + (r() - .5) * .5, py + (r() - .5) * .5, rad, 0, 7); g.fill();
    });
    g.globalAlpha = 1;
  };
  let x = right - width;
  const wd = size * .075;
  for (const ch of text) {
    const L = SIGNATURE[ch], lift = (r() - .5) * size * .06, sc = size * (.96 + r() * .08), rot = (r() - .5) * .08 - .04;
    for (const st of L.s) {
      const path = smooth(st, x, baseline + lift, sc, rot);
      if (path.length < 6) { const [px, py] = path[0]; g.globalAlpha = .9; g.fillStyle = '#1a140f'; g.beginPath(); g.arc(px, py, wd * 1.1, 0, 7); g.fill(); g.globalAlpha = 1; }
      else paint(path, wd);
    }
    x += (L.w + .05) * size;
  }
}

function drawSootyBrick(g, w, h) {
  const r = rng(83);
  g.fillStyle = '#2a1d16'; g.fillRect(0, 0, w, h);
  const bh = h / 8, bw = w / 3;
  for (let row = 0; row < 8; row++) for (let i = -1; i < 4; i++) {
    const x = i * bw + (row % 2) * bw / 2;
    g.fillStyle = ['#6a3b28', '#5a3222', '#7a4630', '#4d2a1d'][Math.floor(r() * 4)];
    g.fillRect(x + 2, row * bh + 2, bw - 4, bh - 4);
  }
  // Soot, heaviest at the top and the middle.
  const s = g.createRadialGradient(w / 2, 0, 10, w / 2, h * .2, w * .8);
  s.addColorStop(0, 'rgba(10,8,6,.92)'); s.addColorStop(1, 'rgba(10,8,6,.45)');
  g.fillStyle = s; g.fillRect(0, 0, w, h);
}

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

function drawOliveLeaf(g, w, h) {
  g.clearRect(0, 0, w, h);
  // Long and narrow: dark grey-green on one half, silvery on the other.
  for (const [col, side] of [['#5f7a45', -1], ['#a9b893', 1]]) {
    g.fillStyle = col;
    g.beginPath(); g.moveTo(w / 2, h * .02);
    g.quadraticCurveTo(w / 2 + side * w * .46, h * .5, w / 2, h * .98);
    g.closePath(); g.fill();
  }
}

function drawLeaf(g, w, h) {
  g.clearRect(0, 0, w, h);
  g.translate(w / 2, h * .92);
  const pts = [[0, 0], [-.18, -.12], [-.46, -.3], [-.3, -.42], [-.36, -.62], [-.12, -.6], [0, -.95], [.12, -.6], [.36, -.62], [.3, -.42], [.46, -.3], [.18, -.12]];
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo : g.moveTo).call(g, x * w, y * h));
  g.closePath();
  const grd = g.createLinearGradient(0, -h * .9, 0, 0);
  grd.addColorStop(0, '#5f7d3a'); grd.addColorStop(1, '#2f4a22');
  g.fillStyle = grd; g.fill();
  g.strokeStyle = 'rgba(210,225,170,.55)'; g.lineWidth = 2;
  for (const [x, y] of [[0, -.9], [-.38, -.55], [.38, -.55], [-.4, -.3], [.4, -.3]]) { g.beginPath(); g.moveTo(0, 0); g.lineTo(x * w * .85, y * h * .85); g.stroke(); }
}

function drawJute(g, w, h) {
  g.fillStyle = '#b89565'; g.fillRect(0, 0, w, h);
  const r = rng(41);
  for (let rad = 4; rad < w / 2; rad += 9) {
    for (let a = 0; a < Math.PI * 2; a += .09) {
      g.fillStyle = r() < .5 ? 'rgba(90,60,25,.35)' : 'rgba(235,205,150,.35)';
      g.save(); g.translate(w / 2 + Math.cos(a) * rad, h / 2 + Math.sin(a) * rad); g.rotate(a + .8);
      g.fillRect(-4, -2, 8, 4); g.restore();
    }
  }
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------
// One monarch wing pair (the right side; mirrored for the left), on a clear
// background: orange cells veined in black, a black border with white dots.
function drawMonarchWing(g, w, h, under = false) {
  g.clearRect(0, 0, w, h);
  const wing = (path) => { g.beginPath(); path(); g.closePath(); };
  const fore = () => { g.moveTo(4, h * .5); g.bezierCurveTo(w * .3, h * .02, w * .82, h * .02, w * .98, h * .14); g.bezierCurveTo(w * .9, h * .32, w * .7, h * .5, w * .45, h * .55); g.lineTo(4, h * .54); };
  const hind = () => { g.moveTo(4, h * .54); g.bezierCurveTo(w * .4, h * .5, w * .78, h * .6, w * .72, h * .8); g.bezierCurveTo(w * .62, h * .98, w * .25, h * .96, 4, h * .62); };
  for (const part of [fore, hind]) {
    wing(part); g.fillStyle = '#121010'; g.fill();
    g.save(); wing(part); g.clip();
    g.translate(w * .03, 0); g.scale(.88, .9); g.translate(0, h * .05);
    wing(part); g.fillStyle = under ? '#d89a52' : '#e8781e'; g.fill();
    // Black veins.
    g.strokeStyle = '#121010'; g.lineWidth = 4;
    for (let a = -.9; a <= .9; a += .3) { g.beginPath(); g.moveTo(4, h * .53); g.lineTo(4 + Math.cos(a) * w, h * .53 + Math.sin(a) * h * .55); g.stroke(); }
    g.restore();
    // White dots along the border.
    g.fillStyle = '#f4efe4';
    g.save(); wing(part); g.clip();
    for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2; g.beginPath(); g.arc(w * .45 + Math.cos(a) * w * .5, h * .5 + Math.sin(a) * h * .42, 2.6, 0, 7); g.fill(); }
    g.restore();
  }
}

// A soft cushion (Orion's design): plump in the middle and full at the
// sides, thinning to a piped seam all round, the sides drawn in a little and
// the corners pinched; a "chop" in the top, a rounded dip with a short
// compression crease down the front (lighter on the back), and an outline
// that's slightly uneven, as a real stuffed pillow is. w wide, h tall, d
// thick at the middle. Its front face takes the whole texture (u, v from 0
// to 1); the same shape carries any fabric. The seam's path is kept for the
// piping (pillowPiping).
export function pillowGeometry(w, h, d, seg = 32, {chop = .11, crease = .7} = {}) {
  const pos = [], uv = [], idx = [];
  const shape = (u, v) => {
    // Outline: drawn in at the middle of each side, a little uneven.
    let x = u * w / 2 * (1 - .08 * (1 - v * v)) * (1 + .018 * Math.sin(v * 2.7 + 1.3));
    let y = v * h / 2 * (1 - .08 * (1 - u * u)) * (1 + .02 * Math.sin(u * 2.3 + .4));
    // The chop: the top edge dips in a rounded V at the middle.
    const top = Math.max(0, (v + 1) / 2);
    y -= chop * h * Math.exp(-(u * u) / .14) * Math.pow(top, 3);
    return [x, y];
  };
  for (const side of [1, -1]) {
    const base = pos.length / 3;
    for (let j = 0; j <= seg; j++) for (let i = 0; i <= seg; i++) {
      const u = i / seg * 2 - 1, v = j / seg * 2 - 1;
      const [x, y] = shape(u, v);
      let puff = Math.pow(Math.max(0, 1 - u * u), .42) * Math.pow(Math.max(0, 1 - v * v), .48);
      // The crease, from the dip partway down the face.
      const c = Math.exp(-(u * u) / .03) * Math.pow(Math.max(0, Math.min(1, (v - .15) / .65)), 1.5) * (side > 0 ? crease : crease * .55);
      puff *= 1 - c;
      pos.push(x, y, side * d / 2 * puff);
      uv.push(side > 0 ? (u + 1) / 2 : 1 - (u + 1) / 2, (v + 1) / 2);
    }
    for (let j = 0; j < seg; j++) for (let i = 0; i < seg; i++) {
      const a = base + j * (seg + 1) + i, b = a + 1, c = a + seg + 1, e = c + 1;
      if (side > 0) idx.push(a, b, e, a, e, c); else idx.push(a, e, b, a, c, e);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const seam = [];
  for (let i = 0; i < 4 * seg; i++) {
    const k = i / seg, side = Math.floor(k), f = (k - side) * 2 - 1;
    const [u, v] = [[f, -1], [1, f], [-f, 1], [-1, -f]][side];
    const [x, y] = shape(u, v);
    seam.push(new THREE.Vector3(x, y, 0));
  }
  geo.userData.seam = seam;
  return geo;
}
// The piping round a pillow's seam.
export function pillowPiping(geo, r = .014) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(geo.userData.seam, true), geo.userData.seam.length * 2, r, 6, true);
}

export function roundedBox(w, h, d, r, seg = 3, corner = .2) {
  const s = new THREE.Shape(), x = -(w / 2 - r), y = -(h / 2 - r), W = w - 2 * r, H = h - 2 * r, c = Math.min(W, H) * corner;
  s.moveTo(x + c, y); s.lineTo(x + W - c, y); s.quadraticCurveTo(x + W, y, x + W, y + c);
  s.lineTo(x + W, y + H - c); s.quadraticCurveTo(x + W, y + H, x + W - c, y + H);
  s.lineTo(x + c, y + H); s.quadraticCurveTo(x, y + H, x, y + H - c);
  s.lineTo(x, y + c); s.quadraticCurveTo(x, y, x + c, y);
  const g = new THREE.ExtrudeGeometry(s, {depth: Math.max(.001, d - 2 * r), bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: seg, curveSegments: 6});
  g.center();
  g.computeVertexNormals();
  return g;
}
export const lathe = (pts, seg = 48) => new THREE.LatheGeometry(pts.map(([x, y]) => V2(x, y)), seg);
function turnedLeg(height, radius = .07) {
  const p = [[0, 0], [.75, 0], [1, .05], [.9, .12], [.55, .18], [.6, .3], [.8, .38], [.55, .48], [.5, .7], [.62, .8], [.62, 1], [0, 1]];
  return lathe(p.map(([x, y]) => [x * radius, y * height]), 20);
}

export class Room {
  constructor(scene, renderer, {mobile = false} = {}) {
    if (renderer) maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.mobile = mobile;
    this.clickables = [];
    this.build();
    if (renderer) this.buildEnvironment(renderer);
  }

  mesh(geo, material, parent = this.group, {cast = true, receive = true} = {}) {
    const m = new THREE.Mesh(geo, material);
    m.castShadow = cast; m.receiveShadow = receive;
    parent.add(m);
    return m;
  }

  build() {
    const M = this.materials = {
      floor: new THREE.MeshStandardMaterial({map: canvasTexture(1024, 1024, (g, w, h) => drawWood(g, w, h, {colors: ['#b8966c', '#ae8c63', '#c09f76', '#a98760', '#bb9a71', '#b39168'], seed: 2, limed: true, grain: 60}), {repeat: [5, 5]}), roughness: .72}),
      panel: new THREE.MeshStandardMaterial({map: canvasTexture(512, 512, (g, w, h) => { g.translate(w, 0); g.rotate(Math.PI / 2); drawWood(g, w, h, {planks: 4, colors: ['#6e4024', '#774628', '#68391f', '#7d4b2a'], seed: 4, grain: 34}); }, {repeat: [1, 1]}), roughness: .55}),
      darkWood: new THREE.MeshStandardMaterial({map: canvasTexture(512, 512, (g, w, h) => drawWood(g, w, h, {planks: 4, colors: ['#4f2c17', '#583219', '#4a2914'], seed: 6, grain: 30})), roughness: .5}),
      plaster: new THREE.MeshStandardMaterial({map: canvasTexture(512, 512, (g, w, h) => drawNoise(g, w, h, {base: '#ecdcbf', blobs: [['rgba(255,250,235,.05)', 260, 20, 90], ['rgba(150,110,60,.035)', 220, 20, 80]]}), {repeat: [3, 3]}), roughness: .95}),
      trim: new THREE.MeshStandardMaterial({color: '#6a3e22', roughness: .5}),
      window: new THREE.MeshStandardMaterial({color: '#f3ead8', roughness: .6}),
      rug: new THREE.MeshStandardMaterial({map: canvasTexture(512, 512, (g, w, h) => drawPlaid(g, w, h, {base: '#3f472b', stripes: [['#1e2536', 110], ['#3f472b', 34], ['#a8987a', 3], ['#3f472b', 36], ['#28324a', 70], ['#3f472b', 60], ['#a8987a', 3], ['#3f472b', 27], ['#1e2536', 40], ['#4d5436', 40], ['#9c8c6c', 2], ['#4d5436', 87]]}), {repeat: [1, 1]}), roughness: 1, color: '#d8d0c0'}),
      plaidBed: new THREE.MeshStandardMaterial({map: canvasTexture(512, 512, (g, w, h) => drawPlaid(g, w, h, {base: '#5a6b38', stripes: [['#1f2a45', 110], ['#5a6b38', 30], ['#e6dcc0', 6], ['#5a6b38', 60], ['#7d4a2a', 3], ['#5a6b38', 50], ['#1f2a45', 60], ['#4b5a30', 60], ['#e6dcc0', 4], ['#4b5a30', 129]], seed: 8}), {repeat: [6, 1]}), roughness: .95}),
      plaidThrow: new THREE.MeshStandardMaterial({map: canvasTexture(512, 512, (g, w, h) => drawPlaid(g, w, h, {base: '#3b4a33', stripes: [['#222c40', 120], ['#3b4a33', 40], ['#b9a77c', 5], ['#3b4a33', 80], ['#4f5a3a', 90], ['#b9a77c', 3], ['#222c40', 70], ['#3b4a33', 104]], seed: 10}), {repeat: [1.6, 1.6]}), roughness: 1, side: THREE.DoubleSide}),
      leather: new THREE.MeshPhysicalMaterial({map: canvasTexture(512, 512, drawLeather, {repeat: [1.4, 1.4]}), roughness: .48, clearcoat: .35, clearcoatRoughness: .45}),
      sherpa: new THREE.MeshStandardMaterial({map: canvasTexture(512, 512, drawSherpa, {repeat: [3, 3]}), roughness: 1}),
      linen: new THREE.MeshStandardMaterial({map: canvasTexture(256, 256, (g, w, h) => drawLinen(g, w, h, {base: '#e7dcc6'}), {repeat: [2, 6]}), roughness: 1, side: THREE.DoubleSide}),
      pillow: new THREE.MeshStandardMaterial({map: canvasTexture(256, 256, (g, w, h) => drawLinen(g, w, h, {base: '#cdbfa3', dark: .12})), roughness: 1}),
      oliveLinen: new THREE.MeshStandardMaterial({map: canvasTexture(256, 256, (g, w, h) => drawLinen(g, w, h, {base: '#66703f', dark: .12})), roughness: 1}),
      jute: new THREE.MeshStandardMaterial({map: canvasTexture(512, 512, drawJute), roughness: 1}),
      brass: new THREE.MeshStandardMaterial({color: '#b58a3c', metalness: .85, roughness: .32}),
      ivory: new THREE.MeshPhysicalMaterial({color: '#efe7d6', roughness: .3, clearcoat: .9, clearcoatRoughness: .12}),
      clay: new THREE.MeshStandardMaterial({color: '#c6a27a', roughness: .95}),
      olive: new THREE.MeshPhysicalMaterial({color: '#5e6b35', roughness: .32, clearcoat: 1, clearcoatRoughness: .1}),
      oliveStripe: new THREE.MeshPhysicalMaterial({color: '#4e5a2a', roughness: .3, clearcoat: .8}),
      white: new THREE.MeshPhysicalMaterial({color: '#f1ece2', roughness: .35, clearcoat: .6}),
      leaf: new THREE.MeshStandardMaterial({map: canvasTexture(128, 128, drawLeaf), alphaTest: .45, side: THREE.DoubleSide, roughness: .7}),
      frame: new THREE.MeshStandardMaterial({color: '#8a6a3a', metalness: .45, roughness: .45}),
      print: new THREE.MeshStandardMaterial({map: canvasTexture(900, 1152, drawAbstract), roughness: .86}),
      paleOak: new THREE.MeshStandardMaterial({color: '#cdb796', roughness: .7}),
    };
    M.leaf.map.repeat.set(1, 1);

    this.buildShell();
    this.buildWindow();
    this.buildRug();
    this.buildChair();
    this.buildSideTable();
    this.buildPrint();
    this.buildFireplace();
    this.buildBed();
    this.buildBowl();
    this.buildFountain();
    this.buildPlants();
  }

  // Floor, walls, wainscoting.
  buildShell() {
    const M = this.materials;
    const floor = this.mesh(new THREE.PlaneGeometry(40, 40), M.floor, this.group, {cast: false});
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -.002;
    floor.material.map.repeat.set(10, 10);
    this.floor = floor;

    const W = {back: -3.4, left: -4.6, right: 4.6}, H = 12, WAIN = 1.55;
    this.walls = W;
    // The doorway to her kitchen: in the left wall, straight across from the
    // fireplace (the same opening the kitchen has in its back wall).
    this.door = {z0: -.1, z1: 2.3, top: 5.4};
    // A wall (plaster over panelled wainscot), with an opening from a to b
    // along it (its own x) if given.
    const wall = (len, x, z, ry, open = null) => {
      const g = new THREE.Group();
      g.position.set(x, 0, z); g.rotation.y = ry;
      this.group.add(g);
      const spans = open ? [[-len / 2, open.a], [open.b, len / 2]] : [[-len / 2, len / 2]];
      for (const [a, b] of spans) {
        const L = b - a, cx = (a + b) / 2;
        const up = this.mesh(new THREE.PlaneGeometry(L, H - WAIN), M.plaster, g, {cast: false});
        up.position.set(cx, WAIN + (H - WAIN) / 2, 0);
        // Wainscot: a backing board, raised panels, chair rail and skirting.
        const back = this.mesh(new THREE.PlaneGeometry(L, WAIN), M.panel, g, {cast: false});
        back.position.set(cx, WAIN / 2, 0);
        const n = Math.max(1, Math.round(L / 1.5)), pw = L / n;
        for (let i = 0; i < n; i++) {
          const p = this.mesh(roundedBox(pw - .32, WAIN - .58, .06, .02, 2, .03), M.panel, g, {cast: false});
          p.position.set(a + pw * (i + .5), WAIN / 2 + .05, .03);
        }
        const rail = this.mesh(new THREE.BoxGeometry(L, .1, .1), M.trim, g, {cast: false});
        rail.position.set(cx, WAIN, .05);
        const cap = this.mesh(new THREE.BoxGeometry(L, .04, .14), M.trim, g, {cast: false});
        cap.position.set(cx, WAIN + .06, .06);
        const skirt = this.mesh(new THREE.BoxGeometry(L, .22, .08), M.trim, g, {cast: false});
        skirt.position.set(cx, .11, .04);
      }
      if (open) {
        // Plaster over the opening, and a broad limestone casing round it.
        const head = this.mesh(new THREE.PlaneGeometry(open.b - open.a, H - open.top), M.plaster, g, {cast: false});
        head.position.set((open.a + open.b) / 2, (H + open.top) / 2, 0);
        const stone = new THREE.MeshStandardMaterial({color: '#eadfca', roughness: .55});
        const cw = .26, cd = .07;
        for (const xx of [open.a - cw / 2, open.b + cw / 2]) this.mesh(new THREE.BoxGeometry(cw, open.top + cw, cd), stone, g, {cast: false}).position.set(xx, (open.top + cw) / 2, cd / 2);
        this.mesh(new THREE.BoxGeometry(open.b - open.a + cw * 2, cw, cd), stone, g, {cast: false}).position.set((open.a + open.b) / 2, open.top + cw / 2, cd / 2);
      }
      return g;
    };
    // (The left wall runs from the back corner forwards; along it, its own
    // x points back, so the doorway is at x = 2.6 - z.)
    const door = {a: 2.6 - this.door.z1, b: 2.6 - this.door.z0, top: this.door.top};
    // Kept so a wall the camera swings behind can be hidden (dollhouse style).
    this.wallGroups = [wall(9.2, 0, W.back, 0), wall(12, W.left, 2.6, Math.PI / 2, door), wall(12, W.right, 2.6, -Math.PI / 2)];
  }

  buildWindow() {
    const M = this.materials, z = this.walls.back;
    const g = new THREE.Group();
    g.position.set(-2.35, 0, z);
    this.group.add(g);
    // Tall, beach-house proportions, looking out over the dunes to the sea.
    const W = 2.3, bottom = 1.62, top = 5.3, cy = (bottom + top) / 2, h = top - bottom;
    // The view (window-view.js): what is shown by day and by night (0 day,
    // 1 night, 2 dusk; a seasonal look may change the pair).
    this.view = {day: 0, night: 1};
    this.glassBottom = bottom; this.glassH = h;
    this.outside = windowView(W, h, {anisotropy: maxAniso});
    this.glass = this.outside.mesh; g.add(this.glass);
    this.glass.position.set(0, cy, .01);
    // Frame, sashes and muntins.
    const bar = (w, hh, x, y, d = .1, mat = M.window) => { const b = this.mesh(new THREE.BoxGeometry(w, hh, d), mat, g); b.position.set(x, y, .06); return b; };
    bar(W + .3, .16, 0, top + .08); bar(.16, h + .3, -W / 2 - .08, cy); bar(.16, h + .3, W / 2 + .08, cy);
    bar(W, .07, 0, cy); bar(.06, h, 0, cy);
    for (const y of [bottom + h * .25, top - h * .25]) bar(W, .04, 0, y, .06);
    for (const x of [-W / 4, W / 4]) bar(.04, h, x, cy, .06);
    // Deep sill on top of the wainscot, wide enough for Mochi to sit on,
    // with two brackets under it.
    const SD = .8;
    const sill = this.mesh(roundedBox(W + .6, .1, SD, .03), M.trim, g);
    sill.position.set(0, bottom - .03, SD / 2);
    for (const x of [-W / 2 + .1, W / 2 - .1]) {
      const br = this.mesh(new THREE.BoxGeometry(.08, .32, SD - .12), M.trim, g);
      br.position.set(x, bottom - .24, (SD - .12) / 2);
    }
    this.windowGroup = g;
    this.sillTop = bottom + .02;
    this.sillDepth = SD;
    // On the sill: a white pitcher with greenery, and a few books.
    const pitcher = this.mesh(lathe([[0, 0], [.13, 0], [.15, .05], [.16, .2], [.13, .32], [.1, .38], [.12, .42], [0, .42]], 28), M.white, g);
    pitcher.position.set(-.75, bottom + .02, .22);
    const handle = this.mesh(new THREE.TorusGeometry(.08, .018, 8, 20, Math.PI), M.white, g);
    handle.position.set(-.6, bottom + .25, .22); handle.rotation.z = -Math.PI / 2;
    this.sillSprigs = new THREE.Group(); g.add(this.sillSprigs);
    this.sprigs(this.sillSprigs, new THREE.Vector3(-.75, bottom + .4, .22), 9, .55);
    const bookColors = ['#3f4b33', '#6b2c22', '#283652', '#8b6b3e'];
    this.books = bookColors.map((c, i) => {
      const b = this.mesh(new THREE.BoxGeometry(.5 - i * .04, .07, .34), new THREE.MeshStandardMaterial({color: c, roughness: .8}), g);
      b.position.set(.62, bottom + .05 + i * .07, .2); b.rotation.y = (i % 2 - .5) * .15;
      b.userData.home = {p: b.position.clone(), r: b.rotation.clone()};
      return b;
    });
    this.bookFall = null;
    this.buildBird(g, W, bottom, h);
    this.buildNightBats(g);
    // Linen curtains on a brass rod.
    const rod = this.mesh(new THREE.CylinderGeometry(.03, .03, W + 1.8, 12), M.brass, g);
    rod.rotation.z = Math.PI / 2; rod.position.set(0, top + .45, .22);
    this.curtainRod = {y: top + .45, z: .22, half: (W + 1.8) / 2};
    for (const s of [-1, 1]) {
      const fin = this.mesh(new THREE.SphereGeometry(.06, 12, 10), M.brass, g);
      fin.position.set(s * (W / 2 + .9), top + .45, .22);
      const cg = new THREE.PlaneGeometry(.85, top + .4, 28, 1), p = cg.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i);
        const flare = .6 + .4 * (1 - (y + (top + .4) / 2) / (top + .4));
        p.setX(i, x * flare);
        p.setZ(i, Math.sin(x * 22) * .045 + Math.sin(x * 9 + 1) * .03);
      }
      cg.computeVertexNormals();
      // The folds shaded into the fabric too (deeper in the hollows), so
      // they still show where the curtain is in shadow.
      const col = [];
      for (let i = 0; i < p.count; i++) { const k = .74 + .26 * (p.getZ(i) + .075) / .15; col.push(k, k * .99, k * .97); }
      cg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      M.curtain ??= Object.assign(M.linen.clone(), {vertexColors: true});
      const curtain = this.mesh(cg, M.curtain, g, {cast: false});
      curtain.position.set(s * (W / 2 + .45), (top + .4) / 2 + .02, .3);
    }
    // Sunlight from the window falls across the floor in pane-shaped patches.
    const beam = canvasTexture(256, 256, (c, w, hh) => {
      c.filter = 'blur(10px)';
      c.fillStyle = 'rgba(255,214,150,1)';
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) c.fillRect(20 + i * 56, 20 + j * 56, 46, 46);
    });
    this.sunPatch = this.mesh(new THREE.PlaneGeometry(2.6, 3.4), new THREE.MeshBasicMaterial({map: beam, transparent: true, opacity: .32, blending: THREE.AdditiveBlending, depthWrite: false}), this.group, {cast: false, receive: false});
    this.sunPatch.rotation.set(-Math.PI / 2, 0, .45);
    // Just above the rug's surface, so the light falls across the rug (and
    // Mochi lying on it) as well as the boards.
    this.sunPatch.position.set(-1.05, .045, -1.25);
  }

  // A small brown bird outside the window, now and then, in daylight. It
  // lives in the window's own space just in front of the glass, behind the
  // glazing bars.
  buildBird(g, W, bottom, h) {
    const brown = new THREE.MeshStandardMaterial({color: '#6b5240', roughness: .9});
    const cream = new THREE.MeshStandardMaterial({color: '#cdb69a', roughness: .9});
    const bird = new THREE.Group();
    const body = this.mesh(new THREE.SphereGeometry(1, 14, 10), cream, bird, {cast: false});
    body.scale.set(.085, .065, .02);
    const back = this.mesh(new THREE.SphereGeometry(1, 14, 10), brown, bird, {cast: false});
    back.scale.set(.08, .05, .021); back.position.set(-.01, .02, 0);
    const head = this.mesh(new THREE.SphereGeometry(.045, 12, 10), brown, bird, {cast: false});
    head.scale.z = .45; head.position.set(.07, .05, 0);
    const beak = this.mesh(new THREE.ConeGeometry(.012, .035, 6), new THREE.MeshStandardMaterial({color: '#3a2a1c'}), bird, {cast: false});
    beak.rotation.z = -Math.PI / 2; beak.position.set(.118, .045, 0);
    const tail = this.mesh(new THREE.BoxGeometry(.08, .012, .015), brown, bird, {cast: false});
    tail.position.set(-.1, .01, 0); tail.rotation.z = .35;
    const wing = (side) => {
      const piv = new THREE.Group(); piv.position.set(-.005, .045, side * .012); bird.add(piv);
      const w = this.mesh(new THREE.BoxGeometry(.1, .008, .07), brown, piv, {cast: false});
      w.position.set(-.02, 0, side * .035);
      return piv;
    };
    this.birdWings = [wing(1), wing(-1)];
    bird.visible = false;
    g.add(bird);
    this.bird = bird;
    // By night a pale moth comes to the lit glass instead, and flutters there.
    const moth = new THREE.Group(), dust = this.mothDust = new THREE.MeshBasicMaterial({color: '#e8dfcc', side: THREE.DoubleSide});
    const mb = this.mesh(new THREE.SphereGeometry(.012, 8, 6), new THREE.MeshBasicMaterial({color: '#b9ab92'}), moth, {cast: false, receive: false});
    mb.scale.set(1, 2.6, 1);
    const mwing = new THREE.Shape(); mwing.moveTo(0, 0); mwing.quadraticCurveTo(.05, .05, .045, -.005); mwing.quadraticCurveTo(.03, -.035, 0, -.02);
    const mGeo = new THREE.ShapeGeometry(mwing, 5);
    this.mothWings = [1, -1].map(sx => { const piv = new THREE.Group(); moth.add(piv); const w = this.mesh(mGeo, dust, piv, {cast: false, receive: false}); w.scale.x = sx; return piv; });
    moth.visible = false;
    g.add(moth);
    this.moth = moth;
    // By day sometimes a monarch butterfly instead: it flutters in, settles
    // on a glazing bar opening and closing its wings, and drifts off.
    const fly = new THREE.Group();
    // Bright orange above, paler and buff beneath (what shows when its wings
    // are closed), lit like everything else so it has some shape.
    const top = new THREE.MeshStandardMaterial({map: canvasTexture(256, 256, (g, w, h) => drawMonarchWing(g, w, h)), transparent: true, alphaTest: .4, side: THREE.FrontSide, roughness: .8});
    const under = new THREE.MeshStandardMaterial({map: canvasTexture(256, 256, (g, w, h) => drawMonarchWing(g, w, h, true)), transparent: true, alphaTest: .4, side: THREE.BackSide, roughness: .8});
    const wGeo = new THREE.PlaneGeometry(.17, .17, 4, 4); wGeo.translate(.085, 0, 0);
    // (A slight curve along each wing, so it isn't a flat card.)
    const wp = wGeo.attributes.position; for (let i = 0; i < wp.count; i++) wp.setZ(i, -.012 * Math.pow(wp.getX(i) / .17, 2)); wGeo.computeVertexNormals();
    this.flyWings = [1, -1].map(sx => { const piv = new THREE.Group(); fly.add(piv); for (const m of [top, under]) { const w = this.mesh(wGeo, m, piv, {cast: false, receive: false}); w.scale.x = sx; } return piv; });
    this.mesh(new THREE.CapsuleGeometry(.009, .07, 4, 6), new THREE.MeshStandardMaterial({color: '#1a1410', roughness: .6}), fly, {cast: false, receive: false});
    for (const sx of [-1, 1]) { const ant = this.mesh(new THREE.CylinderGeometry(.0015, .0015, .06, 3), new THREE.MeshBasicMaterial({color: '#1a1410'}), fly, {cast: false, receive: false}); ant.position.set(sx * .01, .07, 0); ant.rotation.z = -sx * .35; }
    fly.visible = false;
    g.add(fly);
    this.butterfly = fly;
    this.birdRun = null;
    this.birdBox = {x0: -W / 2 - .3, x1: W / 2 + .3, low: bottom + .32, high: bottom + h * .7, mid: bottom + h / 2 + .06, z: .025};
  }

  // Bats outside the window on Halloween evenings: three dark silhouettes
  // with fast-flapping scalloped wings, swooping in loops over the dunes.
  // App sets `batsOn`.
  buildNightBats(g) {
    const dark = new THREE.MeshBasicMaterial({color: '#141018', side: THREE.DoubleSide});
    const shape = new THREE.Shape();
    shape.moveTo(0, 0); shape.quadraticCurveTo(.08, .09, .2, .07);
    for (let i = 0; i < 3; i++) { const x = .2 - i * .066; shape.quadraticCurveTo(x - .02, .015, x - .066, i === 2 ? -.03 : .02); }
    shape.closePath();
    const wingGeo = new THREE.ShapeGeometry(shape, 6), bodyGeo = new THREE.SphereGeometry(.05, 12, 8), earGeo = new THREE.ConeGeometry(.015, .04, 6);
    this.nightBats = [0, 1, 2].map(i => {
      const bat = new THREE.Group(), wings = [];
      const body = new THREE.Mesh(bodyGeo, dark); body.scale.set(.8, 1, .4); bat.add(body);
      for (const sx of [-1, 1]) {
        const ear = new THREE.Mesh(earGeo, dark); ear.position.set(sx * .02, .055, 0); bat.add(ear);
        const piv = new THREE.Group(); piv.position.x = sx * .025; bat.add(piv);
        const wing = new THREE.Mesh(wingGeo, dark); wing.scale.x = sx; piv.add(wing);
        wings.push(piv);
      }
      bat.visible = false;
      g.add(bat);
      return {bat, wings, speed: .32 + i * .07, phase: i * 2.1, size: 1.9 - i * .25, flap: 40 + i * 7};
    });
    this.batsOn = false;
  }
  updateBats(t) {
    if (!this.nightBats) return;
    // Loops stay within the glass (past it they'd show against the wall).
    const B = this.birdBox, cx = (B.x0 + B.x1) / 2, span = (B.x1 - B.x0) / 2 - .6;
    for (const b of this.nightBats) {
      b.bat.visible = this.batsOn;
      if (!this.batsOn) continue;
      const a = t * b.speed + b.phase;
      // A wide loop across the window, with quick jinks.
      const x = cx + Math.sin(a) * span + Math.sin(a * 7.3) * .06;
      const y = B.mid + .15 + Math.sin(a * 2) * .55 + Math.sin(a * 5.1 + b.phase) * .08;
      b.bat.position.set(x, y, B.z + .01);
      b.bat.scale.setScalar(b.size);
      b.bat.rotation.z = Math.cos(a) * .25 + Math.sin(a * 7.3) * .2;
      const f = Math.sin(t * b.flap) * 1.05;
      b.wings[0].rotation.y = f; b.wings[1].rotation.y = -f;
    }
  }
  // Start a bird visit: 'flyby' crosses the window; 'perch' lands low in the
  // window, hops and pecks, then flies off. Returns its length in seconds.
  startBird(t, kind = Math.random() < .5 ? 'flyby' : 'perch') {
    if (this.birdRun) return 0;
    // (A moth by day is a brown one, so it shows against the bright sky.)
    if (kind === 'dayMoth' || kind === 'moth') { this.mothDust.color.set(kind === 'dayMoth' ? '#7a6248' : '#e8dfcc'); kind = 'moth'; }
    const flier = kind === 'moth' ? this.moth : kind === 'butterfly' ? this.butterfly : this.bird;
    const dir = Math.random() < .5 ? 1 : -1, B = this.birdBox;
    const dur = kind === 'flyby' ? 2.6 : kind === 'moth' ? 6 + Math.random() * 5 : kind === 'butterfly' ? 10 + Math.random() * 6 : 7;
    this.birdRun = {kind, dir, start: t, dur, y0: B.low + Math.random() * (B.high - B.low), land: dir * (.4 + Math.random() * .25), yaw: (Math.random() < .5 ? -1 : 1) * (.45 + Math.random() * .5)};
    flier.visible = true;
    return dur;
  }
  // The bird's (or moth's) position in world space (for Mochi to watch), or null.
  birdWorld(v) {
    if (!this.birdRun) return null;
    const k = this.birdRun.kind, o = k === 'moth' ? this.moth : k === 'butterfly' ? this.butterfly : this.bird;
    return o.visible ? o.getWorldPosition(v) : null;
  }
  updateBird(t) {
    const r = this.birdRun;
    if (!r) return;
    const k = (t - r.start) / r.dur, B = this.birdBox, b = this.bird;
    if (k >= 1) { this.birdRun = null; b.visible = false; this.moth.visible = false; this.butterfly.visible = false; return; }
    if (r.kind === 'butterfly') {
      // In along a wandering, bobbing path (.0-.3), its wings beating; settled
      // on the middle glazing bar, wings mostly held closed and upright, now
      // and then slowly opening (.3-.75); then away. Turned a little to one
      // side, so it's often seen three-quarter on.
      const f = this.butterfly, from = r.dir > 0 ? B.x0 : B.x1, to = r.dir > 0 ? B.x1 : B.x0, sitX = r.land * .6, sitY = B.mid + .1;
      let x, y, a, flying = true;
      if (k < .3) { const q = k / .3, e = q * q * (3 - 2 * q); x = from + (sitX - from) * e; y = r.y0 + (sitY - r.y0) * e + Math.sin(q * 14) * .08 * (1 - q); }
      else if (k < .75) { x = sitX; y = sitY; flying = false; }
      else { const q = (k - .75) / .25; x = sitX + (to - sitX) * q * q; y = sitY + q * .9 + Math.sin(q * 12) * .06; }
      // (0: wings spread flat; pi/2: closed together, upright.)
      if (flying) a = .65 + .8 * Math.sin(t * 24);
      else { const open = Math.pow(Math.max(0, Math.sin((t - r.start) * .8 - 1)), 3); a = 1.45 - 1.1 * open; }
      f.position.set(x, y, B.z + .03);
      f.rotation.set(flying ? -.25 : -.15, r.yaw + (flying ? Math.sin(t * 2.2) * .4 : 0), flying ? Math.sin(t * 3) * .25 : 0);
      f.scale.setScalar(1.6);
      this.flyWings[0].rotation.y = -a; this.flyWings[1].rotation.y = a;
      return;
    }
    if (r.kind === 'moth') {
      // In from the side, a while fluttering and bumping about the glass in
      // the middle, then off into the dark.
      const m = this.moth, cx = r.land * .5, cy = B.mid + .35;
      const flit = (x, y) => [x + Math.sin(t * 2.3) * .35 + Math.sin(t * 9.1) * .05, y + Math.sin(t * 1.7 + 1) * .3 + Math.sin(t * 11.3) * .05];
      const from = r.dir > 0 ? B.x0 : B.x1, to = r.dir > 0 ? B.x1 : B.x0;
      const e = k < .15 ? 1 - k / .15 : k > .85 ? (k - .85) / .15 : 0;
      const [fx, fy] = flit(cx, cy);
      m.position.set(fx + ((k < .5 ? from : to) - fx) * e * e, fy + e * .3, B.z + .005 + Math.abs(Math.sin(t * 5)) * .01);
      m.rotation.z = Math.sin(t * 6) * .4;
      m.scale.setScalar(2.4);
      const a = Math.sin(t * 46) * 1.1;
      this.mothWings[0].rotation.y = a; this.mothWings[1].rotation.y = -a;
      return;
    }
    const from = r.dir > 0 ? B.x0 : B.x1, to = r.dir > 0 ? B.x1 : B.x0;
    let x, y, flap = true;
    if (r.kind === 'flyby') {
      x = from + (to - from) * k;
      y = r.y0 + Math.sin(k * Math.PI * 3) * .06 + Math.sin(k * Math.PI) * .12;
    } else {
      // In (0–.2), on the ledge hopping and pecking (.2–.8), away (.8–1).
      // Perched on the middle glazing bar, as if on the ledge outside.
      const sitY = B.mid;
      if (k < .2) { const q = k / .2; x = from + (r.land - from) * q; y = r.y0 + (sitY - r.y0) * q * q; }
      else if (k < .8) {
        const q = (k - .2) / .6;
        const hop = Math.floor(q * 3), hq = q * 3 - hop;
        x = r.land + (hop + Math.min(1, hq / .25)) * .1 * r.dir;
        y = sitY + (hq < .25 ? Math.sin(hq / .25 * Math.PI) * .05 : 0);
        flap = false;
        b.rotation.z = hq > .5 && hq < .75 ? -.5 : 0; // a peck
      } else { const q = (k - .8) / .2, x0 = r.land + .3 * r.dir; x = x0 + (to - x0) * q; y = sitY + (r.y0 + .3 - sitY) * q; }
    }
    if (flap) b.rotation.z = .1;
    b.position.set(x, y, B.z);
    b.scale.set(1.8 * r.dir, 1.8, 1.8);
    const a = flap ? Math.sin(t * 38) * .9 : .1;
    this.birdWings[0].rotation.x = a; this.birdWings[1].rotation.x = -a;
  }

  // Mochi nudges the top book off the sill; it slides, tips and falls to the
  // floor, then quietly returns to the stack a while later.
  knockBook(t) {
    if (this.bookFall) return false;
    const b = this.books[this.books.length - 1];
    this.bookFall = {b, start: t, x: b.position.x, y: b.position.y, z: b.position.z, floor: -this.windowGroup.position.y + .035};
    return true;
  }
  updateBook(t) {
    const f = this.bookFall;
    if (!f) return;
    const k = t - f.start, b = f.b, home = b.userData.home;
    if (k < .5) { b.position.z = f.z + k * .9; b.position.x = f.x + k * .1; b.rotation.z = 0; }
    else if (b.position.y > f.floor) {
      // Clamped to the moment it reaches the floor, so a slow frame can't
      // throw it further than it would fall.
      const fall = Math.sqrt((f.y - f.floor) / 4.9), q = Math.min(k - .5, fall);
      b.position.set(f.x + .05 + q * 1.3, Math.max(f.floor, f.y - 4.9 * q * q), f.z + .45 + q * .7);
      b.rotation.set(q * 3.2, b.rotation.y, q * 1.2);
      if (k - .5 >= fall) { b.position.y = f.floor; b.rotation.x = 0; b.rotation.z = 0; f.landed = t; }
    } else if (f.landed && t - f.landed > 60) {
      b.position.copy(home.p); b.rotation.copy(home.r); this.bookFall = null;
    }
  }
  // Where the fallen book lies (world), or the stack's top while it's home.
  bookWorld(v) { return this.books[this.books.length - 1].getWorldPosition(v); }

  buildRug() {
    const M = this.materials;
    const RW = 3.7, RD = 3.0, RX = -.4, RZ = .3;
    const rug = this.mesh(roundedBox(RW, .035, RD, .012, 1, .02), M.rug, this.group, {cast: false});
    rug.position.set(RX, .018, RZ);
    const uv = rug.geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 2.4, uv.getY(i) / 2.4);
    const edge = this.rugEdge = new THREE.MeshStandardMaterial({color: '#3a3f2a', roughness: 1});
    for (const [w, d, x, z] of [[RW + .06, .06, RX, RZ - RD / 2], [RW + .06, .06, RX, RZ + RD / 2], [.06, RD + .06, RX - RW / 2, RZ], [.06, RD + .06, RX + RW / 2, RZ]]) {
      const b = this.mesh(new THREE.BoxGeometry(w, .04, d), edge, this.group, {cast: false});
      b.position.set(x, .02, z);
    }
  }

  // Tufted leather club chair with rolled arms, nailhead trim and a plaid throw.
  buildChair() {
    const M = this.materials, g = new THREE.Group();
    g.position.set(2.45, 0, -2.0); g.rotation.y = -.55;
    this.group.add(g);
    const legH = .3;
    for (const [x, z] of [[-.85, -.7], [.85, -.7], [-.85, .78], [.85, .78]]) {
      const l = this.mesh(turnedLeg(legH, .085), M.darkWood, g);
      l.position.set(x, 0, z);
    }
    const base = this.mesh(roundedBox(2.1, .55, 1.85, .07), M.leather, g);
    base.position.set(0, legH + .27, 0);
    const seat = this.mesh(roundedBox(1.42, .3, 1.42, .12), M.leather, g);
    seat.position.set(0, legH + .62, .14);
    const back = this.mesh(roundedBox(2.1, 1.25, .42, .1), M.leather, g);
    back.position.set(0, legH + .55 + .6, -.72); back.rotation.x = -.1;
    const backRoll = this.mesh(new THREE.CylinderGeometry(.2, .2, 2.12, 24), M.leather, g);
    backRoll.rotation.z = Math.PI / 2; backRoll.position.set(0, legH + 1.72, -.78);
    for (const s of [-1, 1]) {
      const arm = this.mesh(roundedBox(.34, .55, 1.65, .06), M.leather, g);
      arm.position.set(s * .88, legH + .82, .05);
      const roll = this.mesh(new THREE.CylinderGeometry(.21, .21, 1.68, 24), M.leather, g);
      roll.rotation.x = Math.PI / 2; roll.position.set(s * .93, legH + 1.12, .07);
      const scroll = this.mesh(new THREE.CylinderGeometry(.215, .215, .04, 24), M.leather, g);
      scroll.rotation.x = Math.PI / 2; scroll.position.set(s * .93, legH + 1.12, .92);
    }
    // Brass nailheads along the arm fronts and the base.
    const nails = new THREE.InstancedMesh(new THREE.SphereGeometry(.018, 8, 6), M.brass, 120);
    const m4 = new THREE.Matrix4();
    let n = 0;
    for (const s of [-1, 1]) for (let a = 0; a < Math.PI * 2 && n < 120; a += .22) m4.makeTranslation(s * .93 + Math.cos(a) * .17, legH + 1.12 + Math.sin(a) * .17, .945), nails.setMatrixAt(n++, m4);
    for (let x = -1.0; x <= 1.0 && n < 120; x += .075) m4.makeTranslation(x, legH + .1, .93), nails.setMatrixAt(n++, m4);
    nails.count = n;
    g.add(nails);
    // Tufting: shallow buttons on the back.
    const tufts = new THREE.InstancedMesh(new THREE.SphereGeometry(.03, 8, 6), new THREE.MeshStandardMaterial({color: '#4a2410', roughness: .5}), 40);
    n = 0;
    for (let row = 0; row < 3; row++) for (let i = 0; i < 6 - row % 2; i++) {
      m4.makeTranslation(-.75 + i * .3 + (row % 2) * .15, legH + .9 + row * .28, -.49 + row * -.03);
      tufts.setMatrixAt(n++, m4);
    }
    tufts.count = n;
    g.add(tufts);
    // Cushion pillow.
    const pillow = this.mesh(pillowGeometry(.95, .92, .34), M.pillow, g);
    this.mesh(pillowPiping(pillow.geometry), M.piping ??= new THREE.MeshStandardMaterial({color: '#6b7040', roughness: .85}), pillow, {cast: false});
    pillow.position.set(-.25, legH + 1.12, -.42); pillow.rotation.set(-.25, .1, .12);
    // Plaid throw draped over the right arm: up from the seat, over the
    // roll, down the outside to an uneven hem; wider than the arm, so where
    // it runs past the arm's front it sags and falls in soft folds.
    const tw = 1.3, tl = 2.3, tz = .42, front = .9, tg = new THREE.PlaneGeometry(tw, tl, 20, 44), tp = tg.attributes.position;
    const path = v => {
      // Up the inside of the arm, over the roll, down the outside.
      const s = v * tl;
      if (s < .55) return [.62 + s * .45, legH + .62 + s * .9, 0];
      if (s < 1.15) { const a = (s - .55) / .6 * Math.PI; return [.93 - Math.cos(a) * .25, legH + 1.12 + Math.sin(a) * .27, 0]; }
      return [1.18 + (s - 1.15) * .06, legH + 1.12 - (s - 1.15) * .95, 0];
    };
    for (let i = 0; i < tp.count; i++) {
      const u = tp.getX(i), v0 = .5 - tp.getY(i) / tl;
      // (A ragged hem: some of it hangs a little lower.)
      const v = v0 * (1 + .06 * Math.sin(u * 7 + 1) * Math.max(0, v0 - .6) * 2.5);
      let [x, y] = path(v);
      const z = tz + u, over = Math.max(0, z - front);
      // Past the arm's front it's unsupported: it sags and falls away.
      y -= over * over * 2.2 + over * .5;
      x += over * .25 * (v < .5 ? -1 : 1);
      // Folds: soft on top, deeper down the outside.
      const fold = (Math.sin(u * 11 + v * 2.5) * .028 + Math.sin(u * 23 + 1) * .01) * (v > .5 ? 1.4 : .35);
      tp.setXYZ(i, x + fold, y + Math.sin(u * 13) * .008, z + Math.sin(v * 12) * .02 + over * .1);
    }
    tg.computeVertexNormals();
    const throwBlanket = this.mesh(tg, M.plaidThrow, g);
    const fringe = new THREE.InstancedMesh(new THREE.BoxGeometry(.008, .1, .008), this.fringeMat = new THREE.MeshStandardMaterial({color: '#3a4630', roughness: 1}), 40);
    const [fx, fy] = path(1);
    for (let i = 0; i < 40; i++) { const z = tz - tw / 2 + i * tw / 39, over = Math.max(0, z - front); m4.makeTranslation(fx + over * .25, fy - .05 - over * over * 2.2 - over * .5, z); fringe.setMatrixAt(i, m4); }
    g.add(fringe);
    this.chair = g;
    this.chairSeatTop = legH + .62 + .15;
    this.chairPillow = pillow;
  }

  buildSideTable() {
    const M = this.materials, g = new THREE.Group();
    g.position.set(.55, 0, -2.85);
    this.group.add(g);
    const H = 1.35;
    const top = this.mesh(roundedBox(1.05, .07, 1.05, .02), M.darkWood, g);
    top.position.y = H;
    const apron = this.mesh(new THREE.BoxGeometry(.92, .2, .92), M.darkWood, g);
    apron.position.y = H - .14;
    const knob = this.mesh(new THREE.SphereGeometry(.03, 10, 8), M.brass, g);
    knob.position.set(0, H - .14, .47);
    for (const [x, z] of [[-.42, -.42], [.42, -.42], [-.42, .42], [.42, .42]]) {
      const l = this.mesh(turnedLeg(H - .2, .06), M.darkWood, g);
      l.position.set(x, 0, z);
    }
    const shelf = this.mesh(new THREE.BoxGeometry(.9, .04, .9), M.darkWood, g);
    shelf.position.y = .32;
    this.sideTable = g; this.sideTableTop = H + .035;
    // Brass lamp with a pleated shade.
    const lampBase = this.mesh(lathe([[0, 0], [.2, 0], [.21, .03], [.14, .07], [.17, .16], [.12, .3], [.05, .36], [.04, .4], [0, .4]], 28), M.brass, g);
    lampBase.position.set(-.1, H + .035, -.1);
    const stem = this.mesh(new THREE.CylinderGeometry(.022, .022, .62, 10), M.brass, g);
    stem.position.set(-.1, H + .7, -.1);
    const shade = new THREE.CylinderGeometry(.27, .44, .55, 72, 1, true), sp = shade.attributes.position;
    for (let i = 0; i < sp.count; i++) {
      const x = sp.getX(i), z = sp.getZ(i), a = Math.atan2(z, x), k = 1 + Math.abs(Math.sin(a * 18)) * .035;
      sp.setX(i, x * k); sp.setZ(i, z * k);
    }
    shade.computeVertexNormals();
    this.shadeMat = new THREE.MeshStandardMaterial({color: '#f2e6cc', emissive: '#ffc777', emissiveIntensity: .4, roughness: .9, side: THREE.DoubleSide});
    const sh = this.mesh(shade, this.shadeMat, g, {cast: false});
    sh.position.set(-.1, H + 1.1, -.1);
    this.lamp = new THREE.PointLight(0xffb66b, 0, 14, 1.6);
    this.lamp.position.set(g.position.x - .1, H + 1.05, g.position.z - .1);
    this.group.add(this.lamp);
    // Books and a little vase of dried flowers.
    ['#2f3f2c', '#6a2b20'].forEach((c, i) => {
      const b = this.mesh(new THREE.BoxGeometry(.42, .07, .3), new THREE.MeshStandardMaterial({color: c, roughness: .8}), g);
      b.position.set(.22, H + .07 + i * .07, .22); b.rotation.y = .2 * i;
    });
    const vase = this.mesh(lathe([[0, 0], [.08, 0], [.11, .08], [.1, .16], [.06, .22], [.07, .26], [0, .26]], 24), M.white, g);
    vase.position.set(.3, H + .035, -.2);
    this.sprigs(g, new THREE.Vector3(.3, H + .28, -.2), 8, .4);
  }

  // A large abstract canvas over the lamp and the chair, in a thin pale-oak
  // float frame. (Still called the print: decor hangs things on it.)
  buildPrint() {
    const M = this.materials, z = this.walls.back;
    const PW = 2.5, PH = 3.2;
    const g = new THREE.Group();
    g.position.set(1.55, 2.3 + PH / 2, z + .04);
    this.group.add(g);
    const frame = this.mesh(roundedBox(PW + .1, PH + .1, .08, .015), M.paleOak, g);
    frame.position.z = .04;
    const shadow = this.mesh(new THREE.BoxGeometry(PW + .01, PH + .01, .02), new THREE.MeshStandardMaterial({color: '#4a4036', roughness: 1}), g, {cast: false});
    shadow.position.z = .075;
    const art = this.mesh(new THREE.BoxGeometry(PW - .02, PH - .02, .07), [M.paleOak, M.paleOak, M.paleOak, M.paleOak, M.print, M.paleOak], g, {cast: false});
    art.position.z = .1;
    this.printGroup = g;
    this.printSize = {w: PW, h: PH, front: .135};
  }

  // A limestone fireplace on the right wall: a carved surround and mantel
  // shelf (with room along the front for Christmas stockings), a sooty brick
  // firebox with a small log fire, and a stone hearth. The fire is drawn
  // (flames, embers and a warm glow on the floor), not a light, so it costs
  // phones almost nothing; it burns low by day and brighter in the evening.
  buildFireplace() {
    const M = this.materials, g = new THREE.Group();
    // Local x runs along the wall (towards the front), local z into the room.
    g.position.set(this.walls.right, 0, 1.1); g.rotation.y = -Math.PI / 2;
    this.group.add(g);
    this.fireplace = g;
    const stone = new THREE.MeshStandardMaterial({map: canvasTexture(256, 256, (c, w, h) => drawNoise(c, w, h, {base: '#e2d6c0', blobs: [['rgba(160,140,110,.18)', 900, 1, 3], ['rgba(255,252,242,.35)', 700, 1, 4], ['rgba(190,170,140,.12)', 40, 20, 60]], seed: 77}), {repeat: [2, 2]}), roughness: .85});
    const brick = new THREE.MeshStandardMaterial({map: canvasTexture(256, 256, drawSootyBrick), roughness: 1});
    const soot = new THREE.MeshStandardMaterial({color: '#1a1512', roughness: 1});
    const box = (w, h, d, x, y, z, mat = stone) => { const b = this.mesh(new THREE.BoxGeometry(w, h, d), mat, g); b.position.set(x, y, z); return b; };
    const W = 3.0, OW = 1.5, OH = 1.3, D = .45, H = 2.5;
    // Surround: two pilasters and a lintel, with a raised edge round the opening.
    for (const sx of [-1, 1]) box((W - OW) / 2, H, D, sx * (OW / 2 + (W - OW) / 4), H / 2, D / 2);
    box(OW, H - OH, D, 0, OH + (H - OH) / 2, D / 2);
    for (const sx of [-1, 1]) box(.08, OH + .08, .06, sx * (OW / 2 + .04), (OH + .08) / 2, D + .03);
    box(OW + .16, .08, .06, 0, OH + .04, D + .03);
    // Mantel: a moulding and a deep shelf.
    box(W + .12, .12, D + .1, 0, H + .06, (D + .1) / 2);
    box(W + .4, .14, D + .26, 0, H + .19, (D + .26) / 2);
    // Firebox: brick back and sides, sooty roof and floor.
    const back = this.mesh(new THREE.PlaneGeometry(OW, OH), brick, g, {cast: false}); back.position.set(0, OH / 2, .05);
    for (const sx of [-1, 1]) { const side = this.mesh(new THREE.PlaneGeometry(D - .05, OH), brick, g, {cast: false}); side.position.set(sx * OW / 2, OH / 2, D / 2 + .02); side.rotation.y = -sx * Math.PI / 2; }
    box(OW, .02, D, 0, OH, D / 2, soot); box(OW, .03, D - .05, 0, .085, D / 2 + .02, soot);
    // Hearth: a stone slab on the floor, in front and to either side.
    box(W + .5, .07, 1.05, 0, .035, 1.05 / 2);
    this.hearthTop = .07;
    // Logs on a little iron grate.
    const iron = new THREE.MeshStandardMaterial({color: '#211c18', roughness: .6, metalness: .4});
    for (const sx of [-1, 1]) box(.03, .12, .3, sx * .38, .16, .28, iron);
    box(.86, .03, .03, 0, .19, .18, iron); box(.86, .03, .03, 0, .19, .38, iron);
    const bark = new THREE.MeshStandardMaterial({color: '#4a3424', roughness: .95});
    const ends = new THREE.MeshStandardMaterial({color: '#c19a6b', roughness: .9});
    for (const [x, y, z, len, rot, tilt] of [[-.05, .27, .3, .95, .12, 0], [.08, .27, .2, .85, -.15, 0], [0, .38, .25, .8, .05, .25]]) {
      const log = this.mesh(new THREE.CylinderGeometry(.075, .085, len, 10), [bark, ends, ends], g);
      log.rotation.z = Math.PI / 2 + tilt; log.rotation.y = rot; log.position.set(x, y, z);
    }
    // The fire: a few flame cards, the embers under the logs, a soft glow in
    // the opening, and warm light spilling onto the hearth and floor.
    const flameTex = canvasTexture(64, 128, drawFlame);
    this.flames = [[-.22, .14, .9], [.02, .17, 1.15], [.24, .13, .85], [-.05, .1, .7], [.12, .11, .75]].map(([x, z, s], i) => {
      const f = this.mesh(new THREE.PlaneGeometry(.3, .6), new THREE.MeshBasicMaterial({map: flameTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, color: new THREE.Color(1, .75, .45)}), g, {cast: false, receive: false});
      f.geometry.translate(0, .3, 0);
      f.position.set(x, .3, .3 + z * .4); f.rotation.y = (i - 2) * .12;
      return {f, s, phase: i * 1.9, x};
    });
    const glowTex = canvasTexture(128, 128, (c, w, h) => { const gr = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(255,190,110,1)'); gr.addColorStop(.4, 'rgba(255,140,60,.45)'); gr.addColorStop(1, 'rgba(255,120,40,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, h); });
    this.embers = this.mesh(new THREE.PlaneGeometry(.95, .4), new THREE.MeshBasicMaterial({map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, color: '#ff8a3a'}), g, {cast: false, receive: false});
    this.embers.rotation.x = -Math.PI / 2; this.embers.position.set(0, .2, .28);
    this.fireGlow = new THREE.Sprite(new THREE.SpriteMaterial({map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, color: '#ffb070', opacity: .5}));
    this.fireGlow.scale.set(1.9, 1.5, 1); this.fireGlow.position.set(0, .6, .55);
    g.add(this.fireGlow);
    this.hearthGlow = this.mesh(new THREE.PlaneGeometry(3.4, 2.8), new THREE.MeshBasicMaterial({map: glowTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, color: '#ff9a4a'}), g, {cast: false, receive: false});
    this.hearthGlow.rotation.x = -Math.PI / 2; this.hearthGlow.position.set(0, .075, 1.25);
    this.fireLevel = .5;
    // On the mantel: a big ivory vase, off to one side.
    const vase = this.mesh(lathe([[0, 0], [.13, 0], [.24, .2], [.25, .38], [.17, .55], [.1, .64], [.12, .7], [0, .7]], 28), M.white, g);
    vase.position.set(-.95, H + .26, .26);
    vase.userData.home = {p: vase.position.clone(), r: vase.rotation.clone()};
    this.mantelVase = vase; this.vaseFall = null;
    this.mantelTop = H + .26;
  }

  // Mochi pushes the vase off the mantel: it wobbles to the edge, tips and
  // drops, landing on its side on the floor (unbroken), and is put back a
  // minute later.
  knockVase(t) {
    if (this.vaseFall) return false;
    const v = this.mantelVase;
    this.vaseFall = {start: t, x: v.position.x, y: v.position.y, z: v.position.z};
    return true;
  }
  // (The title sequence: a pat sets it rocking, but it stays up.)
  wobbleVase(t) { if (!this.vaseFall) this.vaseWobble = t; }
  resetVase() { const v = this.mantelVase; v.position.copy(v.userData.home.p); v.rotation.copy(v.userData.home.r); this.vaseFall = this.vaseWobble = null; }
  updateVase(t) {
    const f = this.vaseFall, v = this.mantelVase;
    if (!f && this.vaseWobble != null) {
      const k = t - this.vaseWobble, a = Math.exp(-3.2 * k);
      if (k > 2) this.resetVase(); else v.rotation.set(Math.sin(k * 23) * .07 * a, 0, Math.sin(k * 19) * .42 * a);
    }
    if (!f) return;
    const k = t - f.start, lying = .24;
    if (k < .45) { v.position.z = f.z + k / .45 * .32; v.rotation.x = Math.sin(k * 32) * .1 * k / .45; }
    else if (!f.landed) {
      const fall = Math.sqrt((f.y - lying) / 4.9), q = Math.min(k - .45, fall);
      v.position.set(f.x + q * .2, Math.max(lying, f.y - 4.9 * q * q), f.z + .32 + q * 1.6);
      v.rotation.set(Math.min(Math.PI / 2, q * 2.6), 0, q * .4);
      // (Landed by the clock, not by height, which can stop a hair short.)
      if (k - .45 >= fall) { v.position.y = lying; v.rotation.x = Math.PI / 2; f.landed = t; f.lx = v.position.x; }
    } else if (t - f.landed < 1.4) {
      // A short roll on the floor.
      const r = (t - f.landed) / 1.4;
      v.position.x = f.lx + Math.sin(r * Math.PI / 2) * .25; v.rotation.y = r * .9;
    } else if (t - f.landed > 60) {
      v.position.copy(v.userData.home.p); v.rotation.copy(v.userData.home.r); this.vaseFall = null;
    }
  }
  vaseWorld(v) { return this.mantelVase.getWorldPosition(v); }

  updateFire(dt, t, night) {
    if (!this.flames) return;
    this.fireLevel = damp(this.fireLevel, night ? 1 : .5, 1.5, dt);
    const L = this.fireLevel, flick = .85 + .15 * Math.sin(t * 9.7) * Math.sin(t * 6.3 + 1);
    for (const {f, s, phase, x} of this.flames) {
      const k = s * (.55 + .45 * L) * (.82 + .18 * Math.sin(t * (5 + s * 3) + phase) + .08 * Math.sin(t * 17 + phase * 2));
      f.scale.set(.85 + .15 * Math.sin(t * 4 + phase), k, 1);
      f.position.x = x + Math.sin(t * 2.3 + phase) * .02;
      f.material.opacity = (.55 + .45 * L) * flick;
    }
    this.embers.material.opacity = (.6 + .4 * L) * (.85 + .15 * Math.sin(t * 3.1));
    this.fireGlow.material.opacity = .25 + .45 * L * flick;
    this.hearthGlow.material.opacity = Math.max(0, L - .5) * 2 * .5 * flick;
  }

  // Plaid cat bed with a plush lining and a lower front to step in.
  buildBed() {
    const M = this.materials, g = new THREE.Group();
    g.position.set(-2.35, 0, -1.75); g.rotation.y = .7;
    this.group.add(g);
    const R = .92;
    const dip = (geo) => {
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), z = p.getZ(i), y = p.getY(i), a = Math.atan2(x, z);
        const front = Math.pow(Math.max(0, Math.cos(a)), 3);
        if (y > .16) p.setY(i, .16 + (y - .16) * (1 - .55 * front));
      }
      geo.computeVertexNormals();
      return geo;
    };
    const shell = this.mesh(dip(lathe([[R - .02, 0], [R, .04], [R + .02, .2], [R, .36], [R - .06, .43], [R - .14, .45]], 64)), M.plaidBed, g);
    const lining = this.mesh(dip(lathe([[R - .14, .45], [R - .24, .42], [R - .28, .3], [R - .3, .14], [R - .32, .1]], 64)), M.sherpa, g);
    const cushion = this.mesh(new THREE.SphereGeometry(R - .28, 40, 16), M.sherpa, g);
    cushion.scale.y = .2; cushion.position.y = .1;
    const floorDisc = this.mesh(new THREE.CircleGeometry(R, 48), M.plaidBed, g, {cast: false});
    floorDisc.rotation.x = -Math.PI / 2; floorDisc.position.y = .004;
    this.bed = g;
    this.bedTop = .17;
    this.bedRadius = R - .3;
    this.bedR = R; this.bedDip = dip;
  }

  // Ivory ceramic food bowl with an olive band, on an olive linen mat.
  buildBowl() {
    const M = this.materials, g = new THREE.Group();
    g.position.set(2.05, 0, 1.45);
    this.group.add(g);
    const mat = this.mesh(new THREE.BoxGeometry(.95, .012, .95), M.oliveLinen, g, {cast: false});
    mat.position.y = .006; mat.rotation.y = .15;
    const y0 = .012;
    const bowl = this.mesh(lathe([[0, .03], [.2, .03], [.235, .03], [.26, .045], [.27, .08], [.27, .13], [.262, .145], [.25, .14], [.24, .1], [.225, .06], [0, .055]], 48), M.ivory, g);
    bowl.position.y = y0;
    const foot = this.mesh(lathe([[0, 0], [.24, 0], [.255, .015], [.262, .04], [0, .04]], 48), M.clay, g);
    foot.position.y = y0;
    const band = this.mesh(new THREE.TorusGeometry(.272, .006, 6, 64), M.oliveStripe, g);
    band.rotation.x = Math.PI / 2; band.position.y = y0 + .115;
    this.kibbles = [];
    const kib = [new THREE.MeshStandardMaterial({color: '#8a5a2c', roughness: .8}), new THREE.MeshStandardMaterial({color: '#a87339', roughness: .8}), new THREE.MeshStandardMaterial({color: '#6f4520', roughness: .8})];
    const kg = new THREE.DodecahedronGeometry(.028, 0);
    for (let i = 0; i < 22; i++) {
      const k = this.mesh(kg, kib[i % 3], g, {cast: false});
      const a = i * 2.4, rr = .17 * Math.sqrt((i + 1) / 22);
      k.position.set(Math.cos(a) * rr, y0 + .075 + (i % 4) * .01, Math.sin(a) * rr);
      k.rotation.set(i, i * 2, i * 3);
      k.scale.set(1, .7, 1);
      k.visible = false;
      this.kibbles.push(k);
    }
    this.bowl = g;
  }

  // Her name painted round the front of her bowl (a gift of friendship;
  // '' takes it off). A curved strip just outside the bowl's wall, drawn
  // on a canvas in the olive of the band.
  setBowlName(name) {
    const g = this.bowl;
    if (!g) return;
    if (!name) { if (g.userData.label) g.userData.label.visible = false; return; }
    let label = g.userData.label;
    if (!label) {
      const canvas = document.createElement('canvas');
      canvas.width = 768; canvas.height = 80;
      const map = new THREE.CanvasTexture(canvas);
      map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
      const arc = 1.5;
      label = new THREE.Mesh(new THREE.CylinderGeometry(.2725, .2725, .04, 40, 1, true, -arc / 2, arc), new THREE.MeshStandardMaterial({map, transparent: true, roughness: .35, depthWrite: false}));
      label.position.y = .012 + .088;
      label.userData.canvas = canvas;
      g.add(label);
      g.userData.label = label;
    }
    const c = label.userData.canvas, x = c.getContext('2d');
    x.clearRect(0, 0, c.width, c.height);
    x.fillStyle = '#4e5a2a'; x.textAlign = 'center'; x.textBaseline = 'middle';
    let size = 60;
    do { x.font = `italic 700 ${size}px Georgia, 'Times New Roman', serif`; size -= 4; } while (x.measureText(name).width > c.width - 40 && size > 20);
    x.fillText(name, c.width / 2, c.height / 2 + 2);
    label.material.map.needsUpdate = true;
    label.visible = true;
  }

  // Olive ceramic fountain: domed spout, bubbling top and rippling water.
  buildFountain() {
    const M = this.materials, g = new THREE.Group();
    g.position.set(2.2, 0, -.05);
    this.group.add(g);
    const jute = this.mesh(new THREE.CircleGeometry(.68, 48), M.jute, g, {cast: false});
    jute.rotation.x = -Math.PI / 2; jute.position.y = .006;
    const R = .44, y0 = .01;
    const body = this.mesh(lathe([[0, .04], [R - .04, .04], [R - .01, .05], [R, .1], [R, .2], [R - .015, .222], [R - .04, .215], [R - .05, .17], [0, .17]], 64), M.olive, g);
    body.position.y = y0;
    const foot = this.mesh(lathe([[0, 0], [R - .05, 0], [R - .03, .015], [R - .02, .045], [0, .045]], 64), M.clay, g);
    foot.position.y = y0;
    const dome = lathe([[0, .3], [.06, .295], [.12, .27], [.16, .22], [.18, .17], [.185, .15]], 64), dp = dome.attributes.position;
    for (let i = 0; i < dp.count; i++) {
      const x = dp.getX(i), z = dp.getZ(i), a = Math.atan2(z, x), k = 1 + Math.abs(Math.sin(a * 14)) * .02 * (dp.getY(i) < .26 ? 1 : 0);
      dp.setX(i, x * k); dp.setZ(i, z * k);
    }
    dome.computeVertexNormals();
    this.mesh(dome, M.olive, g).position.y = y0;
    // Rippling water surface (vertices animated each frame).
    const water = new THREE.RingGeometry(.19, R - .04, 64, 10);
    water.rotateX(-Math.PI / 2);
    this.waterGeo = water;
    this.waterBase = Float32Array.from(water.attributes.position.array);
    const waterMat = new THREE.MeshPhysicalMaterial({color: '#dfe9e2', roughness: .03, metalness: .1, transparent: true, opacity: .5, clearcoat: 1, clearcoatRoughness: .02, envMapIntensity: 2});
    this.water = this.mesh(water, waterMat, g, {cast: false});
    this.water.position.y = y0 + .2;
    // Water sheeting over the dome, and the bubbling spout.
    const film = new THREE.MeshPhysicalMaterial({color: '#dfe8dc', transparent: true, opacity: .3, roughness: .02, clearcoat: 1, depthWrite: false});
    const sheet = this.mesh(lathe([[0, .305], [.065, .3], [.125, .275], [.165, .224], [.186, .172], [.192, .2]].slice(0, 5), 64), film, g, {cast: false});
    sheet.position.y = y0 + .004;
    this.bubble = this.mesh(new THREE.SphereGeometry(.045, 20, 14), new THREE.MeshPhysicalMaterial({color: '#ffffff', transparent: true, opacity: .45, roughness: 0, clearcoat: 1}), g, {cast: false});
    this.bubble.position.y = y0 + .32;
    this.fountain = g;
    this.ripple = 1;
    this.clickables.push(body, this.water, this.bubble);
  }

  buildPlants() {
    const M = this.materials;
    // An olive tree in a big stone pot, beside the chair.
    const g = new THREE.Group();
    g.position.set(4.0, 0, -1.45);
    this.group.add(g);
    this.oliveTree = g;
    const potMat = new THREE.MeshStandardMaterial({map: canvasTexture(128, 128, (c, w, h) => drawNoise(c, w, h, {base: '#d6ccb8', blobs: [['rgba(120,105,85,.2)', 600, 1, 3], ['rgba(250,245,232,.3)', 400, 1, 3]], seed: 91})), roughness: .95});
    this.mesh(lathe([[0, 0], [.3, 0], [.42, .2], [.46, .55], [.43, .78], [.45, .8], [0, .8]], 32), potMat, g);
    // An olive standard: one slender, slightly wavy trunk, and up top a
    // loose, lopsided crown of thin branches, the narrow leaves strung along
    // each twig in long sprays.
    const r = rng(101), bark = new THREE.MeshStandardMaterial({color: '#7a6e58', roughness: .9});
    const trunk = [new THREE.Vector3(0, .74, 0), new THREE.Vector3(.03, 1.3, .01), new THREE.Vector3(-.02, 1.85, -.02), new THREE.Vector3(.02, 2.35, .01)];
    this.mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(trunk), 20, .04, 8), bark, g);
    // Branches and twigs as one instanced set of short, tapering segments.
    const segs = [], sprays = [];
    const grow = (from, dir, len, rad, depth) => {
      const n = 5, pts = [from.clone()];
      let p = from.clone(), d = dir.clone();
      for (let i = 0; i < n; i++) {
        d.add(new THREE.Vector3((r() - .5) * .35, (r() - .5) * .15 - (depth === 0 ? .06 : 0), (r() - .5) * .35)).normalize();
        p = p.clone().addScaledVector(d, len / n);
        segs.push([pts[pts.length - 1], p, rad * (1 - i / n * .5)]);
        pts.push(p);
      }
      if (depth === 0) { sprays.push(pts); return; }
      for (let k = 0; k < 3; k++) {
        const at = pts[1 + Math.floor(r() * (n - 1))];
        const side = new THREE.Vector3(r() - .5, 0, r() - .5).normalize();
        grow(at, d.clone().addScaledVector(side, .8 + r() * .4).add(new THREE.Vector3(0, .1, 0)).normalize(), len * (.5 + r() * .28), rad * .55, depth - 1);
      }
      sprays.push(pts.slice(2));
    };
    // Lopsided: more and longer branches reaching up and out towards the room.
    const top = trunk[3];
    for (const [x, y, z, len] of [[-.7, .8, .1, 1.72], [-.35, 1, .5, 1.95], [-.2, 1, -.35, 1.55], [.25, .9, .45, 1.32], [-.6, .55, .7, 1.5], [.1, 1, .05, 1.26], [-.85, .45, -.3, 1.15], [-.45, .7, -.6, 1.32]]) {
      grow(top.clone().add(new THREE.Vector3(0, -r() * .3, 0)), new THREE.Vector3(x, y, z).normalize(), len, .02, 1);
    }
    const wood = new THREE.InstancedMesh(new THREE.CylinderGeometry(.6, 1, 1, 5).translate(0, .5, 0), bark, segs.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3();
    segs.forEach(([a, b, rad], i) => {
      v.subVectors(b, a);
      q.setFromUnitVectors(up, v.clone().normalize());
      m4.compose(a, q, new THREE.Vector3(rad, v.length() * 1.04, rad));
      wood.setMatrixAt(i, m4);
    });
    wood.castShadow = true;
    g.add(wood);
    // Leaves along each spray, alternating sides, angled forward and
    // drooping a little; a small tuft at each tip.
    const leafMat = new THREE.MeshStandardMaterial({map: canvasTexture(32, 128, drawOliveLeaf), alphaTest: .4, side: THREE.DoubleSide, roughness: .8});
    const leafGeo = new THREE.PlaneGeometry(.055, .2).translate(0, .1, 0);
    const spots = [];
    for (const pts of sprays) {
      const curve = new THREE.CatmullRomCurve3(pts), L = curve.getLength(), count = Math.max(3, Math.round(L / .045));
      for (let i = 1; i <= count; i++) {
        const t = i / count, at = curve.getPointAt(t), tan = curve.getTangentAt(t);
        const side = new THREE.Vector3().crossVectors(tan, up).normalize().multiplyScalar(i % 2 ? 1 : -1);
        if (r() < .18) continue;
        const dir = tan.clone().multiplyScalar(.9).addScaledVector(side, .35 + r() * .7).add(new THREE.Vector3((r() - .5) * .5, (r() - .6) * .6, (r() - .5) * .5)).normalize();
        spots.push([at.clone().addScaledVector(tan, (r() - .5) * .03), dir]);
        if (i === count) for (let k = 0; k < 3; k++) spots.push([at, tan.clone().add(new THREE.Vector3((r() - .5) * .9, (r() - .3) * .5, (r() - .5) * .9)).normalize()]);
      }
    }
    const leaves = new THREE.InstancedMesh(leafGeo, leafMat, spots.length);
    const twist = new THREE.Quaternion();
    spots.forEach(([at, dir], i) => {
      q.setFromUnitVectors(up, dir);
      twist.setFromAxisAngle(up, r() * Math.PI);
      m4.compose(at, q.multiply(twist), new THREE.Vector3(1, 1, 1).multiplyScalar(.8 + r() * .45));
      leaves.setMatrixAt(i, m4);
    });
    leaves.castShadow = true;
    g.add(leaves);
    // A tall leafy plant in the far corner by the window.
    const g2 = new THREE.Group();
    g2.position.set(-4.0, 0, -2.85);
    this.group.add(g2);
    this.mesh(lathe([[0, 0], [.28, 0], [.34, .62], [.3, .64], [0, .64]], 32), M.white, g2);
    this.ivy(g2, new THREE.Vector3(0, .62, 0), 12, 1.6, true);
  }

  // Leafy sprigs in a vase.
  sprigs(parent, at, count, height, {leaf = this.materials.leaf, stem = '#5c6a3a', size = 1, seed = 61} = {}) {
    const r = rng(seed + count), leaves = new THREE.InstancedMesh(new THREE.PlaneGeometry(.09 * size, .13 * size), leaf, count * 9);
    const stems = new THREE.MeshStandardMaterial({color: stem, roughness: .8});
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    let n = 0;
    for (let i = 0; i < count; i++) {
      const a = r() * Math.PI * 2, tilt = .2 + r() * .5, h = height * (.6 + r() * .5);
      const dir = new THREE.Vector3(Math.cos(a) * Math.sin(tilt), Math.cos(tilt), Math.sin(a) * Math.sin(tilt));
      const stem = this.mesh(new THREE.CylinderGeometry(.006, .008, h, 4), stems, parent, {cast: false});
      stem.position.copy(at).addScaledVector(dir, h / 2);
      stem.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      for (let k = 0; k < 9; k++) {
        const p = at.clone().addScaledVector(dir, h * (.25 + k * .085));
        q.setFromEuler(e.set(r() * 1.2 - .6, r() * 6.3, (k % 2 ? 1 : -1) * (.8 + r() * .4)));
        m4.compose(p, q, new THREE.Vector3(1, 1, 1).multiplyScalar(.7 + r() * .5));
        leaves.setMatrixAt(n++, m4);
      }
    }
    leaves.count = n;
    parent.add(leaves);
  }

  // Trailing ivy vines.
  ivy(parent, at, vines, length, upright = false, leaf = this.materials.leaf) {
    const r = rng(71 + vines), leaves = new THREE.InstancedMesh(new THREE.PlaneGeometry(.16, .16), leaf, vines * 16);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    let n = 0;
    for (let v = 0; v < vines; v++) {
      const a = r() * Math.PI * 2;
      const out = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      for (let k = 0; k < 16; k++) {
        const t = k / 15;
        const p = at.clone()
          .addScaledVector(out, .1 + t * (upright ? .35 : .3))
          .add(new THREE.Vector3(0, upright ? (t < .4 ? t * length * .6 : (.4 * length * .6) - (t - .4) * length * .8) : -t * length, 0));
        p.x += Math.sin(t * 9 + v) * .04; p.z += Math.cos(t * 7 + v) * .04;
        q.setFromEuler(e.set(r() * 1.4 - .7, a + r() - .5, r() * 6.3));
        m4.compose(p, q, new THREE.Vector3(1, 1, 1).multiplyScalar(.6 + r() * .6 - t * .2));
        leaves.setMatrixAt(n++, m4);
      }
    }
    leaves.count = n;
    leaves.castShadow = true;
    parent.add(leaves);
  }

  // Soft reflections for ceramic, leather, brass and Mochi's eyes.
  buildEnvironment(renderer) {
    const pm = new THREE.PMREMGenerator(renderer);
    const make = night => {
      const s = new THREE.Scene();
      const sphere = new THREE.SphereGeometry(10, 32, 16), c = [];
      const p = sphere.attributes.position;
      const floorC = new THREE.Color(night ? '#33261b' : '#a48a6a'), wallC = new THREE.Color(night ? '#4a3524' : '#e7d3b2'), ceilC = new THREE.Color(night ? '#2a2018' : '#f6ecdc');
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i) / 10, col = y < -.1 ? floorC : y < .55 ? wallC : ceilC;
        c.push(col.r, col.g, col.b);
      }
      sphere.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
      s.add(new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({vertexColors: true, side: THREE.BackSide})));
      const win = new THREE.Mesh(new THREE.PlaneGeometry(5, 6), new THREE.MeshBasicMaterial({color: night ? new THREE.Color(.12, .18, .35) : new THREE.Color(3, 2.7, 2.2)}));
      win.position.set(-3, 2.5, -9); s.add(win);
      const lampGlow = new THREE.Mesh(new THREE.SphereGeometry(.8, 16, 12), new THREE.MeshBasicMaterial({color: new THREE.Color(night ? 6 : 1.5, night ? 4 : 1, night ? 2 : .5)}));
      lampGlow.position.set(3, 3, -8); s.add(lampGlow);
      return pm.fromScene(s, .04).texture;
    };
    this.envDay = make(false);
    this.envNight = make(true);
    this.scene.environment = this.envDay;
    this.scene.environmentIntensity = .55;
    pm.dispose();
  }

  // The fountain goes wherever Mochi lives, so it animates on its own too.
  updateFountain(dt, t, drinking) {
    // Ripples: gentle rings from the spout, livelier while Mochi drinks.
    this.ripple = damp(this.ripple, drinking ? 3 : 1, 4, dt);
    const p = this.waterGeo.attributes.position, b = this.waterBase;
    for (let i = 0; i < p.count; i++) {
      const x = b[i * 3], z = b[i * 3 + 2], r = Math.hypot(x, z);
      p.setY(i, (Math.sin(r * 70 - t * 7) * .0025 + Math.sin(x * 40 + t * 5) * Math.cos(z * 37 - t * 4) * .001 * this.ripple) * this.ripple);
    }
    p.needsUpdate = true;
    this.waterGeo.computeVertexNormals();
    const s = 1 + Math.sin(t * 9) * .08 + Math.sin(t * 23) * .04;
    this.bubble.scale.set(s, 1 / s, s);
  }

  // away: seen through the doorway from the kitchen, where she is (the lamp
  // light and the lighting of the scene then belong to the kitchen).
  // Fairy lights along the front of the mantel (a gift of friendship): little
  // warm bulbs on a wire in shallow swags, and a soft glow round each that
  // comes up in the evening. Drawn, not lights: three draw calls.
  setFairyLights(on) {
    if (this.fairy) { this.fairy.g.visible = !!on; return; }
    if (!on) return;
    const g = new THREE.Group(), X = 1.6, Y = 2.62, Z = .73, SWAGS = 4, SAG = .14, N = 26;
    const at = (u, out) => out.set(-X + u * 2 * X, Y - Math.sin(((u * SWAGS) % 1) * Math.PI) * SAG, Z);
    const wire = Array.from({length: 97}, (_, i) => at(i / 96, new THREE.Vector3()));
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(wire), new THREE.LineBasicMaterial({color: '#4a4a32'})));
    const pts = Array.from({length: N}, (_, i) => { const p = at((i + .5) / N, new THREE.Vector3()); p.y -= .028; return p; });
    const bulbMat = new THREE.MeshBasicMaterial({color: '#ffe3ae'});
    const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(.024, 8, 6), bulbMat, N), m4 = new THREE.Matrix4();
    pts.forEach((p, i) => bulbs.setMatrixAt(i, m4.makeTranslation(p.x, p.y, p.z)));
    g.add(bulbs);
    const glowTex = canvasTexture(64, 64, (c, w, h) => {
      const grd = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      grd.addColorStop(0, 'rgba(255,225,165,1)'); grd.addColorStop(.25, 'rgba(255,190,105,.55)'); grd.addColorStop(1, 'rgba(255,150,60,0)');
      c.fillStyle = grd; c.fillRect(0, 0, w, h);
    });
    const glowMat = new THREE.PointsMaterial({map: glowTex, size: .34, sizeAttenuation: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false});
    const glow = new THREE.Points(new THREE.BufferGeometry().setFromPoints(pts), glowMat);
    glow.frustumCulled = false; g.add(glow);
    this.fireplace.add(g);
    this.fairy = {g, glowMat, bulbMat, day: new THREE.Color('#e9d9b4'), lit: new THREE.Color('#ffe3ae')};
  }

  // A picture frame over the mantel (a gift of friendship): one of the
  // player's own photos (`image`: anything a canvas can draw), or a paw print
  // on the mount until one is hung. The picture is cut to the frame, centred.
  setFrame(on, image = null) {
    if (!on) { if (this.photoFrame) this.photoFrame.g.visible = false; return; }
    let f = this.photoFrame;
    if (!f) {
      const M = this.materials, g = new THREE.Group(), FW = .8, FH = 1;
      g.position.set(0, this.mantelTop + 1.08, .012);
      this.mesh(new THREE.BoxGeometry(FW + .14, FH + .14, .06), M.frame, g).position.z = .03;
      const canvas = document.createElement('canvas');
      canvas.width = 480; canvas.height = 600;
      const map = new THREE.CanvasTexture(canvas);
      map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
      const pic = this.mesh(new THREE.PlaneGeometry(FW, FH), new THREE.MeshStandardMaterial({map, roughness: .55}), g, {cast: false});
      pic.position.z = .062;
      this.fireplace.add(g);
      f = this.photoFrame = {g, canvas, map, image: undefined};
    }
    f.g.visible = true;
    if (f.image === image) return;
    f.image = image;
    const c = f.canvas, x = c.getContext('2d'), iw = image && (image.naturalWidth || image.width), ih = image && (image.naturalHeight || image.height);
    x.fillStyle = '#f3ead9'; x.fillRect(0, 0, c.width, c.height);
    if (iw && ih) {
      const k = Math.max(c.width / iw, c.height / ih), w = iw * k, h = ih * k;
      x.drawImage(image, (c.width - w) / 2, (c.height - h) / 2, w, h);
    } else {
      // The empty mount: a paw print, waiting for a photo.
      x.fillStyle = '#d9c7a8';
      const cx = c.width / 2, cy = c.height / 2 + 20;
      x.beginPath(); x.ellipse(cx, cy + 30, 62, 52, 0, 0, Math.PI * 2); x.fill();
      for (const [dx, dy, r] of [[-78, -38, 26], [-28, -78, 28], [28, -78, 28], [78, -38, 26]]) { x.beginPath(); x.ellipse(cx + dx, cy + dy, r * .82, r, dx * .004, 0, Math.PI * 2); x.fill(); }
    }
    f.map.needsUpdate = true;
  }

  update(dt, t, night, {drinking = false, camera = null, away = false} = {}) {
    if (camera) {
      // (In the room's own frame: seen from the kitchen, it's joined on
      // through the doorway.)
      const eye = this.group.worldToLocal(_e.copy(camera.position));
      for (const w of this.wallGroups) {
        // A wall faces into the room along its local +z.
        _n.set(0, 0, 1).applyQuaternion(w.quaternion);
        w.visible = _d.subVectors(eye, w.position).dot(_n) > .05;
      }
      // Furniture standing against a hidden wall goes with it.
      this.fireplace.visible = this.wallGroups[2].visible;
    }
    const k = night ? 1 : 0;
    if (!away) this.lamp.intensity = damp(this.lamp.intensity, night ? 26 : 2.5, 3, dt);
    this.shadeMat.emissiveIntensity = damp(this.shadeMat.emissiveIntensity, night ? 2.2 : .45, 3, dt);
    // By night the window's light on the floor is moonlight: fainter and cool.
    this.sunPatch.material.opacity = damp(this.sunPatch.material.opacity, night ? .2 : .32, 3, dt);
    this.sunPatch.material.color.lerp(night ? MOONLIGHT : DAYLIGHT, 1 - Math.exp(-3 * dt));
    this.updateFire(dt, t, night);
    this.outside.setMood(night ? this.view.night : this.view.day);
    this.outside.update(dt, t);
    if (!away && this.scene.environment && this.envNight) {
      const env = night ? this.envNight : this.envDay;
      if (this.scene.environment !== env) this.scene.environment = env;
      this.scene.environmentIntensity = damp(this.scene.environmentIntensity, night ? .35 : .55, 3, dt);
    }
    this.updateFountain(dt, t, drinking);
    if (this.fairy && this.fairy.g.visible) {
      const F = this.fairy;
      F.glowMat.opacity = damp(F.glowMat.opacity, night ? .5 : .05, 3, dt) * (1 + Math.sin(t * 2.1) * .03);
      F.bulbMat.color.lerp(night ? F.lit : F.day, 1 - Math.exp(-3 * dt));
    }
    if (this.candleLight) {
      const glow = this.candleLight.material;
      glow.opacity = damp(glow.opacity, night ? .95 : .3, 3, dt) * (1 + Math.sin(t * 13) * .04 + Math.sin(t * 7.3) * .03);
      (this.candleFlame || this.thanksgivingFlame).scale.y = 1 + Math.sin(t * 11) * .12;
    }
    if (this.pumpkinGlow) {
      const f = 1 + Math.sin(t * 9) * .05 + Math.sin(t * 5.3) * .04;
      // Dark carvings by day; bright faces and a warm halo in the evening.
      for (const m of this.pumpkinGlow) m.emissiveIntensity = damp(m.emissiveIntensity, night ? 4 : .04, 3, dt) * f;
      for (const m of this.pumpkinHalos || []) m.opacity = damp(m.opacity, night ? .75 : 0, 3, dt) * f;
    }
    this.updateBird(t);
    this.updateBats(t);
    this.updatePaperBats?.(t);
    this.updateBook(t);
    this.updateVase(t);
    return k;
  }
}
