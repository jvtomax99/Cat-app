// The view out of the study window: sky with drifting clouds, the sea with
// surf on the beach, and three rows of dunes and beach grass.
//
// It is one flat sheet at the glass, but it is not a flat picture: for each
// point of the glass the shader works out where the line from the camera
// through that point would meet things standing at different distances
// outside (a sky and sea very far off, dunes at three distances), so
// the near grass slides past the far dunes as the camera moves, the way a
// real view does behind glazing bars. The sky, sea and beach are drawn by
// the shader (so the clouds drift, the waves roll in and the sea glitters);
// the dunes are three pictures painted in code below, with see-through tops.
//
// The kitchen's terrace view is the same thing with its own layers (the
// low wall and the olive trees in pots nearest).
//
// Mood: 0 day, 1 night, 2 dusk (Halloween's evening). `setMood` picks one,
// `update` fades towards it.
import * as THREE from 'three';

const TAU = Math.PI * 2;
function rng(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// The two views. `home` is where the view is set up to be seen from (x, y
// and distance, measured from the middle of the sheet); `aim` shifts the
// sun's glitter and the moon to where that viewer sees them. Each layer:
// how far behind the sheet it stands, how wide the picture is before it
// repeats, its bottom and top (0 = the middle of the sheet), how much it
// sways, the size of its picture and what paints it.
// The kitchen's sheet stands 1.4 behind its glazing, at the far edge of the
// real paving: `ground` carries the paving on (drawn by the shader) from
// the sheet's foot to the terrace wall, `deep` further out.
const SCENES = {
  study: {
    home: [0, -.25, 6.5], aim: [0, 0], sheen: 1,
    layers: [
      {depth: 14, wide: 20, y0: -6.2, y1: -2.0, sway: 0, px: [2048, 256], draw: drawFar},
      {depth: 5.5, wide: 12, y0: -5.4, y1: -1.9, sway: .0012, px: [2048, 512], draw: drawMid},
      {depth: 1.4, wide: 8, y0: -2.9, y1: -.55, sway: .006, px: [2048, 512], draw: drawNear},
    ],
  },
  terrace: {
    home: [-6, -2.3, 8], aim: [.75, 0], sheen: 0, ground: {y: -5.8, deep: 3},
    layers: [
      {depth: 22, wide: 20, y0: -9.1, y1: -5.2, sway: 0, px: [2048, 256], draw: drawFar},
      {depth: 9, wide: 12, y0: -8.0, y1: -4.5, sway: .0012, px: [2048, 512], draw: drawMid},
      {depth: 3, wide: 16, y0: -5.8, y1: 1.2, sway: .0006, px: [2048, 1024], draw: drawTerrace},
    ],
  },
};

// A picture drawn in the layer's own units (x to the right, y up, 0 at the
// layer's bottom). Everything is drawn three times, a picture's width
// apart, so the left edge meets the right one.
function layerTexture(L, draw, aniso) {
  const [w, h] = L.px, c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d'), high = L.y1 - L.y0;
  for (const dx of [-L.wide, 0, L.wide]) {
    g.setTransform(w / L.wide, 0, 0, -h / high, dx * w / L.wide, h);
    draw(g, L.wide, high);
  }
  const t = new THREE.CanvasTexture(c);
  // Read as painted (the shader mixes the colours as a painter would and
  // converts once at the end); see-through edges stay clean.
  t.colorSpace = THREE.NoColorSpace; t.premultiplyAlpha = true;
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
  t.anisotropy = aniso;
  return t;
}

// A dune's skyline: rolling, the same at both edges of the picture.
const crest = (terms, wide) => x => terms.reduce((y, [a, n, p]) => y + a * Math.sin(TAU * n * x / wide + p), 0);

// One blade of grass: a thin curved leaf from (x, y), leaning by `lean`.
function blade(g, x, y, len, lean, wd, color) {
  const tx = x + lean, ty = y + len, mx = x + lean * .25, my = y + len * .6;
  g.fillStyle = color;
  g.beginPath(); g.moveTo(x - wd, y); g.quadraticCurveTo(mx - wd * .6, my, tx, ty); g.quadraticCurveTo(mx + wd * .6, my, x + wd, y); g.closePath(); g.fill();
}
// A tuft: blades fanning out from one root, dark at the heart.
function tuft(g, r, x, y, size, colors, n = 26) {
  for (let i = 0; i < n; i++) {
    const a = (r() - .5) * 1.5, len = size * (.55 + r() * .6);
    blade(g, x + (r() - .5) * size * .22, y - size * .04, len * Math.cos(a * .6), Math.sin(a) * len * .7 + size * .12, size * (.012 + r() * .012), colors[Math.floor(r() * colors.length)]);
  }
}
// Sand under a skyline: pale and sunlit on top, deeper below, with soft
// shadows on the slopes turned from the sun and a little grain.
function sand(g, r, wide, high, top, [light, deep], shade) {
  const grad = g.createLinearGradient(0, high, 0, 0);
  grad.addColorStop(0, light); grad.addColorStop(1, deep);
  g.fillStyle = grad;
  // (Drawn well past both edges, so shadows that cross an edge are whole.)
  g.beginPath(); g.moveTo(-wide, 0);
  for (let x = -wide; x <= wide * 2; x += .04) g.lineTo(x, top(x));
  g.lineTo(wide * 2, 0); g.closePath(); g.fill();
  g.save(); g.clip();
  // (Soft-edged by a gradient, not the canvas blur: iPhones have none.)
  for (let i = 0; i < 26; i++) {
    const x = r() * wide, y = top(x) - .15 - r() * high * .6;
    // (Where the skyline falls away to the right, the slope is in shade.)
    const dark = top(x + .2) < top(x) ? 1 : .35, rx = .5 + r() * 1.1, ry = .12 + r() * .2;
    g.save(); g.translate(x, y); g.rotate(-.15); g.scale(rx, ry);
    const soft = g.createRadialGradient(0, 0, 0, 0, 0, 1);
    soft.addColorStop(0, shade); soft.addColorStop(1, shade + '00');
    g.fillStyle = soft; g.globalAlpha = .14 + .3 * dark * r();
    g.fillRect(-1, -1, 2, 2); g.restore();
  }
  g.globalAlpha = 1;
  for (let i = 0; i < 900; i++) {
    g.fillStyle = r() < .5 ? 'rgba(255,250,232,.16)' : 'rgba(120,96,60,.12)';
    g.fillRect(r() * wide, r() * high, .012 + r() * .03, .006);
  }
  g.restore();
}

const GRASS_FAR = ['#8f8d52', '#a89a58', '#76804a', '#b7a866', '#837a44'];
const GRASS = ['#b9a85a', '#d8c47a', '#8f9a52', '#a08c44', '#c9b266', '#748246', '#e3d294'];
const GRASS_NEAR = ['#c7b25e', '#e2cf86', '#93a052', '#a8923f', '#6f7f3f', '#d9c070', '#efe0a2', '#857a3a'];

// Far dunes: a long low ridge with a dip where the path runs down to the
// beach, thinly grassed.
function drawFar(g, wide, high) {
  const r = rng(71), top = crest([[.32, 1, .4], [.2, 2, 2.1], [.09, 5, 1.2], [.04, 11, .3]], wide), y = x => high - .62 + top(x);
  sand(g, r, wide, high, y, ['#e6d4a4', '#c4ac78'], '#7d6c4c');
  for (let i = 0; i < 4200; i++) {
    const x = r() * wide, patch = .5 + .5 * Math.sin(x * 2.3) * Math.sin(x * .9 + 1);
    if (r() > .25 + patch * .75) continue;
    const yy = y(x) - r() * r() * r() * 1.8, len = .12 + r() * .24;
    blade(g, x, yy - .02, len, (r() - .3) * .1, .008 + r() * .006, GRASS_FAR[Math.floor(r() * GRASS_FAR.length)]);
  }
}

// Middle dune: nearer, with tufts of beach grass, a few bayberry bushes and
// a weathered sand fence wandering over it.
function drawMid(g, wide, high) {
  const r = rng(72), top = crest([[.3, 1, 2.6], [.16, 3, .7], [.07, 7, 2.2]], wide), y = x => high - .75 + top(x);
  sand(g, r, wide, high, y, ['#ecd7a0', '#b99c62'], '#6f5c3c');
  const things = [];
  for (let i = 0; i < 210; i++) { const x = r() * wide; things.push({kind: 'tuft', x, y: y(x) - r() * r() * 2.4, s: .34 + r() * .3}); }
  for (let i = 0; i < 7; i++) { const x = r() * wide; things.push({kind: 'bush', x, y: y(x) - .25 - r() * 1.2, s: .3 + r() * .25}); }
  // The fence: pickets on two wires, leaning a little, half buried in places.
  for (let x = .3; x < wide * .62; x += .075) things.push({kind: 'picket', x, y: y(x) - .42 - .5 * Math.sin(x * .55) ** 2, lean: Math.sin(x * 1.7) * .05, post: Math.round(x / .075) % 9 === 0});
  things.sort((a, b) => b.y - a.y);
  for (const o of things) {
    if (o.kind === 'tuft') tuft(g, r, o.x, o.y, o.s, GRASS);
    else if (o.kind === 'bush') {
      // (Leaf by leaf, from the shaded underside up to the sunlit top.)
      for (let i = 0; i < 260; i++) {
        const a = r() * TAU, d = Math.sqrt(r()), up = i / 260, px = o.x + Math.cos(a) * d * o.s * (1 - up * .25), py = o.y + o.s * (.12 + up * .42) + Math.sin(a) * d * o.s * .2;
        g.fillStyle = ['#3d4a2c', '#4a5833', '#5b6a3a', '#6f7c44', '#8a9455'][Math.min(4, Math.floor(up * 3.4 + r() * 1.6))];
        g.beginPath(); g.ellipse(px, py, o.s * .05, o.s * .028, r() * 3, 0, TAU); g.fill();
      }
    } else {
      const hgt = o.post ? .62 : .5 + r() * .05, wd = o.post ? .022 : .013;
      g.fillStyle = o.post ? '#7c6a55' : r() < .5 ? '#9a8a74' : '#8a7861';
      g.beginPath(); g.moveTo(o.x - wd, o.y); g.lineTo(o.x - wd + o.lean, o.y + hgt); g.lineTo(o.x + wd + o.lean, o.y + hgt); g.lineTo(o.x + wd, o.y); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,246,225,.35)'; g.fillRect(o.x - wd + o.lean * .5, o.y, wd * .7, hgt);
      g.fillStyle = 'rgba(70,58,44,.55)'; for (const k of [.3, .78]) g.fillRect(o.x - .04, o.y + hgt * k, .08, .012);
    }
  }
}

// Nearest: tall grass just under the window, with seed heads nodding.
function drawNear(g, wide, high) {
  const r = rng(73);
  for (let i = 0; i < 620; i++) {
    const x = r() * wide, clump = .55 + .45 * Math.sin(x * 1.9 + 1) * Math.sin(x * .7);
    const len = high * (.3 + .62 * r() * clump), lean = (r() - .35) * .5;
    const col = GRASS_NEAR[Math.floor(r() * GRASS_NEAR.length)];
    blade(g, x, -.05, len, lean, .014 + r() * .016, col);
    if (r() < .16 && len > high * .5) {
      // A seed head: a short spray of pale grains drooping from the tip.
      const tx = x + lean, ty = len - .05;
      for (let k = 0; k < 9; k++) { g.fillStyle = k % 2 ? '#e9d6a0' : '#cdb475'; g.beginPath(); g.ellipse(tx + .02 * k * Math.sign(lean || 1) + (r() - .5) * .03, ty - k * .012 + (r() - .5) * .03, .03, .012, .5, 0, TAU); g.fill(); }
    }
  }
  // Their feet are in shade.
  const shade = g.createLinearGradient(0, 0, 0, high * .45);
  shade.addColorStop(0, 'rgba(60,62,30,.55)'); shade.addColorStop(1, 'rgba(60,62,30,0)');
  g.globalCompositeOperation = 'source-atop'; g.fillStyle = shade; g.fillRect(0, -.1, wide, high * .5); g.globalCompositeOperation = 'source-over';
}

// The kitchen's terrace: a low limestone wall at the far edge of the
// paving, and olive trees in terracotta pots standing in front of it.
function drawTerrace(g, wide, high) {
  const r = rng(74), WALL = .9;
  for (let row = 0; row < 2; row++) for (let i = -1; i < wide / 1.1 + 1; i++) {
    const x = i * 1.1 + row * .55, k = r();
    g.fillStyle = ['#d9cbb0', '#d2c3a6', '#dfd2b8', '#cfbfa0'][Math.floor(k * 4)];
    g.fillRect(x, row * .4, 1.1, .41);
    g.fillStyle = 'rgba(120,100,70,.28)'; g.fillRect(x, row * .4, .025, .4); g.fillRect(x, row * .4, 1.1, .02);
    g.fillStyle = 'rgba(255,250,235,.25)'; g.fillRect(x + .025, row * .4 + .37, 1.075, .03);
  }
  // The cap stone, sunlit on top, and the wall's foot in soft shade.
  g.fillStyle = '#e9dec7'; g.fillRect(-.1, .8, wide + .2, WALL - .8);
  g.fillStyle = 'rgba(110,92,66,.35)'; g.fillRect(-.1, .775, wide + .2, .03);
  g.fillStyle = '#f6eedb'; g.fillRect(-.1, WALL - .025, wide + .2, .025);
  const foot = g.createLinearGradient(0, 0, 0, .3);
  foot.addColorStop(0, 'rgba(90,76,56,.35)'); foot.addColorStop(1, 'rgba(90,76,56,0)');
  g.fillStyle = foot; g.fillRect(-.1, 0, wide + .2, .3);
  for (const [x, s] of [[2.6, 1.3], [8.1, 1.05], [12.9, 1.36]]) {
    const potH = .95 * s, top = .52 * s, base = .37 * s, trunkTop = potH + 2.0 * s;
    // Its shadow on the paving, falling to the right.
    g.save(); g.translate(x + .5 * s, .03); g.scale(1.1 * s, .09 * s);
    const sh = g.createRadialGradient(0, 0, 0, 0, 0, 1); sh.addColorStop(0, 'rgba(70,58,44,.5)'); sh.addColorStop(1, 'rgba(70,58,44,0)');
    g.fillStyle = sh; g.fillRect(-1, -1, 2, 2); g.restore();
    // The trunk: slender and a little crooked, with a few boughs.
    g.lineCap = 'round';
    const bough = (x0, y0, x1, y1, wd) => { g.strokeStyle = '#7d7565'; g.lineWidth = wd; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(x0 + (x1 - x0) * .2, y0 + (y1 - y0) * .7, x1, y1); g.stroke(); g.strokeStyle = 'rgba(214,206,186,.5)'; g.lineWidth = wd * .35; g.beginPath(); g.moveTo(x0 - wd * .25, y0); g.quadraticCurveTo(x0 + (x1 - x0) * .2 - wd * .25, y0 + (y1 - y0) * .7, x1 - wd * .2, y1); g.stroke(); };
    bough(x, potH - .05, x + .08 * s, trunkTop, .11 * s);
    const cx = x + .1 * s, cy = trunkTop + .75 * s, rx = 1.3 * s, ry = 1.0 * s;
    for (let i = 0; i < 6; i++) { const a = -1.2 + i * .48 + (r() - .5) * .2; bough(x + .08 * s, trunkTop - .25 * s, cx + Math.sin(a) * rx * .7, cy + Math.cos(a) * ry * .45 - .1 * s, .045 * s); }
    // The crown: leaf by leaf in loose clumps with sky between them, dark
    // inside and underneath, silvery where the sun catches it.
    const clumps = []; for (let i = 0; i < 20; i++) { const a = r() * TAU, d = Math.sqrt(r()) * .88; clumps.push([cx + Math.cos(a) * d * rx, cy + Math.sin(a) * d * ry]); }
    const leaves = [];
    for (let i = 0; i < 2400; i++) {
      const [bx, by] = clumps[Math.floor(r() * clumps.length)], a = r() * TAU, d = r() * .36 * s;
      const lx = bx + Math.cos(a) * d, ly = by + Math.sin(a) * d * .8;
      // (Lit from the upper left.)
      const lit = .5 + .5 * ((ly - cy) / ry * .7 - (lx - cx) / rx * .45) + (Math.sin(a) * .25) + (r() - .5) * .5;
      leaves.push([lx, ly, lit, r() * 3.14]);
    }
    leaves.sort((p, q) => p[2] - q[2]);
    for (const [lx, ly, lit, rot] of leaves) {
      g.fillStyle = ['#4c5a3a', '#5d6b45', '#75835a', '#8f9b72', '#aab38c', '#c3c9a8'][Math.max(0, Math.min(5, Math.floor(lit * 6)))];
      g.beginPath(); g.ellipse(lx, ly, .075 * s, .02 * s, rot, 0, TAU); g.fill();
    }
    // The pot: terracotta, round (lighter on the sunny side), with a rim.
    const clay = g.createLinearGradient(x - top, 0, x + top, 0);
    clay.addColorStop(0, '#d0895c'); clay.addColorStop(.35, '#c67d52'); clay.addColorStop(1, '#96583a');
    g.fillStyle = clay;
    g.beginPath(); g.moveTo(x - top, potH); g.lineTo(x + top, potH); g.lineTo(x + base, 0); g.lineTo(x - base, 0); g.closePath(); g.fill();
    g.fillRect(x - top * 1.07, potH - .13 * s, top * 2.14, .13 * s);
    g.fillStyle = 'rgba(80,44,26,.3)'; g.fillRect(x - top * 1.04, potH - .16 * s, top * 2.08, .03 * s);
    g.fillStyle = 'rgba(255,226,196,.3)'; g.fillRect(x - top * 1.07, potH - .03 * s, top * 2.14, .03 * s);
  }
}

const VERT = /* glsl */`
varying vec2 vP;
varying vec3 vEye;
void main() {
  vP = position.xy;
  // The camera, seen from the glass (x right, y up, z into the room).
  vEye = (inverse(modelMatrix) * vec4(cameraPosition, 1.)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
}`;

const FRAG = /* glsl */`
precision highp float;
uniform float uTime, uNight, uDusk;
uniform sampler2D uFar, uMid, uNear;
uniform vec4 uFarL, uMidL, uNearL;   // depth, width, bottom, top
uniform vec3 uSway, uHome, uPave;    // each layer's sway; where it is seen from; the paving now
uniform vec2 uHalf, uAim, uGround;   // half the sheet's size; sun and moon shift; paving height and reach
uniform float uSheen;
varying vec2 vP;
varying vec3 vEye;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + 1.), f.x), f.y);
}
float fbm(vec2 p) { float a = .5, s = 0.; for (int i = 0; i < 4; i++) { s += a * noise(p); p = p * 2.03 + vec2(17., 9.); a *= .5; } return s; }

// Day, night or dusk, by how far each has faded in.
vec3 mood(vec3 day, vec3 night, vec3 dusk) { return day * (1. - uNight - uDusk) + night * uNight + dusk * uDusk; }

vec4 layer(sampler2D tex, vec4 L, vec2 e, float sway) {
  vec2 q = vP + e * L.x;
  float v = (q.y - L.z) / (L.w - L.z);
  float u = q.x / L.y + sway * v * v * (sin(uTime * 1.1 + q.x * 1.7) + .5 * sin(uTime * 2.3 + q.x * 4.1));
  vec4 c = texture2D(tex, vec2(u, clamp(v, .004, .996)));
  return v > 1. ? vec4(0.) : c;
}

void main() {
  // The slope of the line of sight through this point of the glass. The
  // view is set up for someone standing in the room's middle; the real
  // camera moves it by part of the true amount (the app's camera goes high
  // and far, and true perspective would then show nothing but sand).
  vec2 home = (vP - uHome.xy) / uHome.z;
  vec2 d = (vP - vEye.xy) / max(vEye.z, .6) - home;
  vec2 e = home + .7 * d / (1. + abs(d) * 1.4);

  // Sky: pale at the horizon, deeper overhead.
  float up = max(e.y, 0.), k = 1. - exp(-up * 3.2);
  vec3 horizon = mood(vec3(.86, .92, .93), vec3(.17, .22, .34), vec3(.86, .62, .52));
  vec3 col = mix(horizon, mood(vec3(.35, .60, .84), vec3(.03, .05, .12), vec3(.16, .23, .37)), k);
  col = mix(col, vec3(.56, .45, .58), uDusk * smoothstep(.02, .12, up) * smoothstep(.34, .1, up) * .7);
  // Stars, and the moon with its glow.
  vec2 sg = e * 70., sc = floor(sg);
  float sr = hash(sc), star = step(.972, sr) * smoothstep(.16, 0., length(fract(sg) - .5 - (vec2(hash(sc + 3.), hash(sc + 7.)) - .5) * .6));
  col += star * (.55 + .45 * sin(uTime * 2. + sr * 90.)) * (uNight * .9 + uDusk * .25) * step(0., e.y);
  vec2 moon = mix(vec2(.13, .2), vec2(.1, .15), uDusk) + uAim;
  float md = length(e - moon), moonUp = clamp(uNight + uDusk, 0., 1.);
  col += moonUp * (vec3(1., .97, .88) * smoothstep(.021, .017, md) + vec3(.5, .55, .7) * .35 * exp(-md * 14.));
  // Clouds: a flat layer high up, so they crowd together towards the
  // horizon, drifting slowly to the right.
  vec2 cp = vec2(e.x, 1.) / (up + .22);
  cp = vec2(cp.x * 1.5 - uTime * .011, cp.y * 1.9);
  float cf = fbm(cp), cover = smoothstep(.44, .66, cf) * smoothstep(0., .06, e.y);
  vec3 cloud = mix(mood(vec3(.78, .82, .88), vec3(.13, .16, .26), vec3(.45, .38, .5)), mood(vec3(1., .99, .96), vec3(.24, .28, .4), vec3(.95, .68, .58)), smoothstep(.5, .85, fbm(cp + vec2(.06, .22))));
  col = mix(col, cloud, cover * mood(vec3(.92), vec3(.7), vec3(.85)).x);

  if (e.y < 0.) {
    // The sea, as a flat plane running out to the horizon.
    float dn = -e.y, z = 1. / max(dn, .002), near = smoothstep(0., .02, dn);
    vec3 sea = mix(mood(vec3(.30, .50, .66), vec3(.07, .11, .2), vec3(.25, .3, .42)), mood(vec3(.42, .68, .72), vec3(.1, .15, .24), vec3(.34, .37, .45)), smoothstep(0., .075, dn));
    sea = mix(sea, horizon, exp(-dn * 70.) * .45);
    // Swell, white streaks, and glitter under the sun (or the moon).
    sea *= .94 + .12 * noise(vec2(e.x * z * 1.3 + uTime * .05, z * 1.2 + uTime * .22)) * near;
    sea += mood(vec3(.16), vec3(.05), vec3(.08)) * smoothstep(.64, .72, noise(vec2(e.x * z * .5, z * 3.2 - uTime * .35))) * near;
    float lx = mix(-.14 + uAim.x, moon.x, moonUp);
    float glit = exp(-pow((e.x - lx) / (.035 + dn * 1.1), 2.)) * smoothstep(.5, .8, noise(vec2(e.x * z * 2.2, z * 7. + uTime * 1.2))) * smoothstep(.004, .03, dn);
    sea += mood(vec3(1., .96, .84) * .5, vec3(.75, .8, 1.) * .55, vec3(1., .9, .8) * .3) * glit;
    // The beach: a wave line washing up and back, wet sand, dry sand.
    float shore = .074 + .004 * sin(e.x * 6. + 1.) + .0035 * sin(uTime * .55 + e.x * 2.5);
    float roll = fract(uTime * .07 + noise(vec2(e.x * 2.5, 3.)) * .35);
    sea += mood(vec3(.5), vec3(.16), vec3(.3)) * smoothstep(.004, 0., abs(dn - shore + .024 * (1. - roll))) * sin(roll * 3.1416);
    vec3 beach = mix(mood(vec3(.72, .64, .5), vec3(.12, .13, .17), vec3(.42, .36, .36)), mood(vec3(.93, .86, .7), vec3(.17, .18, .22), vec3(.56, .46, .43)), smoothstep(0., .014, dn - shore));
    beach *= .96 + .08 * noise(e * vec2(90., 400.));
    sea = mix(sea, beach, smoothstep(-.0015, .0015, dn - shore));
    sea += mood(vec3(.6), vec3(.2), vec3(.38)) * smoothstep(.0045, 0., abs(dn - shore + .001));
    col = sea;
  }

  // The dunes, far to near. By night they are dark and blue; at dusk, dim
  // and warm. The far one fades a little into the haze.
  vec3 tint = mood(vec3(1.), vec3(.16, .2, .33), vec3(.5, .4, .45));
  vec4 a = layer(uFar, uFarL, e, uSway.x);
  a.rgb = mix(a.rgb * tint, horizon * a.a, .12);
  col = col * (1. - a.a) + a.rgb;
  vec4 b = layer(uMid, uMidL, e, uSway.y);
  col = col * (1. - b.a) + b.rgb * tint;
  vec4 c = layer(uNear, uNearL, e, uSway.z);
  col = col * (1. - c.a) + c.rgb * tint * mood(vec3(1.), vec3(.8), vec3(.85));
  // Paving, from the foot of the sheet out to the wall (the kitchen): the
  // line of sight meets the ground before it gets as far as the wall.
  if (uGround.y > 0. && e.y < 0.) {
    float reach = (uGround.x - vP.y) / e.y;
    if (reach < uGround.y) col = uPave * (.97 + .05 * noise((vP + e * reach).xx * vec2(3., 0.) + vec2(0., reach * 6.)));
  }

  // The glass itself: a faint slanting sheen, a touch darker in the corners.
  vec2 g = vP / uHalf;
  col += uSheen * .035 * smoothstep(.18, 0., abs(g.x * .6 + g.y * .5 - .25)) * (1. - uNight * .6);
  col *= 1. - uSheen * .1 * pow(max(abs(g.x), abs(g.y)), 6.);

  gl_FragColor = vec4(pow(max(col, 0.), vec3(2.2)), 1.);
  #include <colorspace_fragment>
}`;

// Paving by day (#e2d6c0) and by night (#2a2724).
const PAVE_DAY = [.886, .839, .753], PAVE_NIGHT = [.165, .153, .141];

// The sheet with the view on it: `scene` is 'study' or 'terrace', `wide`
// and `high` the sheet's size. `pave` (kept up to date) is the colour of
// the paving just now, for the real paving in front of the sheet.
export function windowView(wide, high, scene = 'study', {anisotropy = 4} = {}) {
  const S = SCENES[scene], [far, mid, near] = S.layers;
  const L = l => new THREE.Vector4(l.depth, l.wide, l.y0, l.y1), T = l => ({value: layerTexture(l, l.draw, anisotropy)});
  const pave = new THREE.Color();
  const material = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, toneMapped: false,
    uniforms: {
      uTime: {value: 0}, uNight: {value: 0}, uDusk: {value: 0}, uHalf: {value: new THREE.Vector2(wide / 2, high / 2)},
      uFar: T(far), uMid: T(mid), uNear: T(near), uFarL: {value: L(far)}, uMidL: {value: L(mid)}, uNearL: {value: L(near)},
      uSway: {value: new THREE.Vector3(far.sway, mid.sway, near.sway)}, uHome: {value: new THREE.Vector3(...S.home)}, uAim: {value: new THREE.Vector2(...S.aim)},
      uGround: {value: new THREE.Vector2(S.ground?.y ?? 0, S.ground?.deep ?? 0)}, uPave: {value: new THREE.Vector3()}, uSheen: {value: S.sheen},
    },
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(wide, high), material);
  const u = material.uniforms;
  let want = 0, first = true;
  return {
    mesh, material, pave,
    setMood(m) { want = m; },
    // (The first frame shows the mood outright, so a launch at night does
    // not open on a sunset.)
    update(dt, t) {
      const k = first ? 1 : 1 - Math.exp(-2.5 * dt); first = false;
      u.uTime.value = t;
      u.uNight.value += ((want === 1 ? 1 : 0) - u.uNight.value) * k;
      u.uDusk.value += ((want === 2 ? 1 : 0) - u.uDusk.value) * k;
      // (Mixed as the shader mixes: by the painted values, not by light.)
      const n = u.uNight.value;
      u.uPave.value.set(...PAVE_DAY.map((d, i) => d + (PAVE_NIGHT[i] - d) * n));
      pave.setRGB(u.uPave.value.x, u.uPave.value.y, u.uPave.value.z, THREE.SRGBColorSpace);
    },
  };
}
