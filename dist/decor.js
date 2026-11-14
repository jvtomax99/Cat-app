// Room decors: seasonal looks for Mochi's room. The furniture, its size and
// position, and so every path Mochi walks or jumps, stay exactly the same; a
// decor only recolours materials, changes the view from the window and adds
// props where they're out of her way.
//
// Thanksgiving at the Beach House (from Orion's reference and prop sheet):
// oatmeal wool rug with faded sage stripes and a flax border; flax-linen cat
// bed with olive piping and a fluffy ivory lining; cream cable-knit throw;
// linen cushion with sage stripes; dunes and the sea out of the window; and
// the ten props: ivory and apricot pumpkins, a sage gourd, a pear bowl, oak
// branches, an oak-leaf garland on the curtain rod, the knit throw, the
// linen cushion, a brass lantern with a candle and a pinecone basket.
import * as THREE from 'three';
import {rng, canvasTexture, drawLinen, drawNoise, roundedBox, lathe, pillowGeometry, pillowPiping} from './room.js';

export const DECORS = {
  classic: {name: 'Classic', note: 'Plaid, leather and greenery'},
  thanksgiving: {name: 'Thanksgiving at the Beach House', note: 'Oatmeal, sage and candlelight'},
  // (Seasonal looks are stored away out of season: `months` says when
  // they're offered, `then` what a room dressed in one changes to.)
  halloween: {name: 'Halloween at the Beach House', note: 'Jack-o’-lanterns, paper bats and a felt bat', months: [10], then: 'thanksgiving'},
  // (Christmas dresses the kitchen; the study keeps its classic plaid,
  // leather and greenery, with pine and a lantern on the mantel.)
  christmas: {name: 'Christmas at the Beach House', note: 'Pine garland, velvet bows and fairy lights', months: [11, 12], then: 'classic'},
};
// A look that's offered now (`force`: a decor named in the page's address,
// to look at one out of season).
export function inSeason(name, force = null, date = new Date()) {
  const d = DECORS[name];
  return !!d && (name === force || !d.months || d.months.includes(date.getMonth() + 1));
}
// The look a room dressed in `name` wears now: the same one in season,
// otherwise what it's stored away for.
export function decorNow(name, force = null, date = new Date()) {
  let n = DECORS[name] ? name : 'classic';
  for (let i = 0; i < 4 && !inSeason(n, force, date); i++) n = DECORS[n].then || 'classic';
  return n;
}

export function applyDecor(room, name) {
  if (!DECORS[name]) name = 'classic';
  const M = room.materials;
  // What the classic room looks like, kept so it can come back.
  room.decorOriginal ??= {
    rugMap: M.rug.map, rugColor: M.rug.color.clone(), rugEdge: room.rugEdge.color.clone(),
    bedMap: M.plaidBed.map, sherpaMap: M.sherpa.map, throwMap: M.plaidThrow.map, fringe: room.fringeMat.color.clone(),
    pillowMap: M.pillow.map, view: {...room.view},
  };
  const O = room.decorOriginal;
  for (const g of Object.values(room.decorProps || {})) g.forEach(o => o.visible = false);
  room.candleLight = null; room.candleFlame = null; room.pumpkinGlow = null; room.pumpkinHalos = null; room.altToy = null;
  if (name === 'classic' || name === 'christmas') {
    if (M.piping) M.piping.color.set('#6b7040');
    M.rug.map = O.rugMap; M.rug.color.copy(O.rugColor); room.rugEdge.color.copy(O.rugEdge);
    M.plaidBed.map = O.bedMap; M.sherpa.map = O.sherpaMap; M.plaidThrow.map = O.throwMap; room.fringeMat.color.copy(O.fringe);
    M.pillow.map = O.pillowMap;
    for (const m of [M.rug, M.plaidBed, M.plaidThrow]) m.normalMap = null;
    room.view = {...O.view};
    room.sillSprigs.visible = true;
    // Christmas in the study (what shows through the kitchen's doorway in
    // Orion's pictures): pine in a little vase and a brass lantern on the
    // mantel, at the end away from her seat and the big vase, and the
    // armchair's cushion in green plaid.
    if (name === 'christmas') {
      M.pillow.map = O.bedMap;
      (room.decorProps ??= {}).christmas ??= buildStudyChristmas(room);
      room.decorProps.christmas.forEach(o => o.visible = true);
      room.candleLight = room.xmasCandle; room.candleFlame = room.xmasFlame;
    }
  } else {
    // Thanksgiving and Halloween share the autumn room: oatmeal rug, flax
    // bed, knit throw, the sill runner, oak branches and the brass lantern.
    const T = room.decorTextures ??= thanksgivingTextures();
    const halloween = name === 'halloween';
    M.rug.map = T.rug; M.rug.color.set('#cfc3ab'); room.rugEdge.color.set('#b9a27b');
    M.plaidBed.map = T.flax; M.sherpa.map = T.fluff; M.plaidThrow.map = T.knit; room.fringeMat.color.set('#e4d8c1');
    M.rug.normalMap = T.rugWeave; M.rug.normalScale.set(1, 1);
    M.plaidBed.normalMap = T.linenWeave; M.plaidBed.normalScale.set(1, 1);
    M.plaidThrow.normalMap = T.knitRelief; M.plaidThrow.normalScale.set(1.4, 1.4);
    if (halloween) {
      T.ghost ??= canvasTexture(1024, 1024, drawGhostCushion);
      T.ghost.offset.set(0, 0);
    }
    M.pillow.map = halloween ? T.ghost : T.cushion;
    if (M.piping) M.piping.color.set(halloween ? '#e6dcc7' : '#6b7040');
    room.view = {day: O.view.day, night: halloween ? 2 : O.view.night};
    room.sillSprigs.visible = false;
    room.decorProps ??= {};
    if (!room.decorProps.shared) Object.assign(room.decorProps, buildAutumn(room, T));
    if (halloween) room.decorProps.halloween ??= buildHalloween(room);
    // Show just this decor's pieces (newly built ones start out visible).
    for (const [part, objs] of Object.entries(room.decorProps)) objs.forEach(o => o.visible = part === 'shared' || part === name);
    room.candleLight = room.thanksgivingCandle;
    if (halloween) { room.pumpkinGlow = room.halloweenGlow; room.pumpkinHalos = room.halloweenHalos; room.altToy = room.feltBat; }
  }
  for (const m of [M.rug, M.plaidBed, M.sherpa, M.plaidThrow, M.pillow]) m.needsUpdate = true;
  room.glass.material.needsUpdate = true;
  room.decor = name;
}

// ---------------------------------------------------------------------------
// Textures
// ---------------------------------------------------------------------------
function thanksgivingTextures() {
  return {
    // The rug's UVs cover 1/2.4 of a texture tile, so this repeat makes one
    // drawing span the whole rug.
    rug: canvasTexture(1024, 1024, drawOatmealRug, {repeat: [2.4, 2.4]}),
    flax: canvasTexture(256, 256, (g, w, h) => drawLinen(g, w, h, {base: '#c4b28d', dark: .1, seed: 21}), {repeat: [6, 1]}),
    fluff: canvasTexture(512, 512, (g, w, h) => drawNoise(g, w, h, {base: '#efe7d8', blobs: [['rgba(170,150,120,.22)', 5000, 2, 4.5], ['rgba(255,252,244,.7)', 6000, 1.5, 4]], seed: 23}), {repeat: [3, 3]}),
    knit: canvasTexture(512, 512, drawCableKnit, {repeat: [1.6, 1.6]}),
    cushion: canvasTexture(256, 256, drawStripedLinen),
    runner: canvasTexture(512, 128, drawRunner),
    oak: canvasTexture(128, 128, drawOakLeaf),
    // Weave relief, as small tiling normal maps (light on phones): basket
    // weave on the rug, linen on the bed, raised cables on the throw.
    rugWeave: normalMap(128, drawBasketWeave, {repeat: [19.2, 19.2], strength: 2.2}),
    linenWeave: normalMap(128, drawLinenHeight, {repeat: [12, 2.5], strength: 2.6}),
    knitRelief: normalMap(256, drawCableHeight, {repeat: [1.6, 1.6], strength: 4}),
    gourd: canvasTexture(256, 256, (g, w, h) => drawNoise(g, w, h, {base: '#8e9b72', blobs: [['rgba(210,200,140,.35)', 260, 2, 7], ['rgba(70,90,60,.25)', 160, 3, 10]], seed: 27})),
  };
}

// A tiling normal map from a grey height drawing (brighter = higher).
function normalMap(size, drawHeight, {repeat = [1, 1], strength = 2} = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  // Read back below, so keep this canvas in ordinary memory: reading a
  // graphics-card canvas forces a long wait (19 s in testing).
  const g = c.getContext('2d', {willReadFrequently: true});
  g.fillStyle = '#000'; g.fillRect(0, 0, size, size);
  drawHeight(g, size, size);
  const src = g.getImageData(0, 0, size, size).data, out = g.createImageData(size, size);
  const H = (x, y) => src[(((y + size) % size) * size + ((x + size) % size)) * 4] / 255;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength;
    const l = Math.hypot(dx, dy, 1), i = (y * size + x) * 4;
    out.data[i] = (-dx / l * .5 + .5) * 255; out.data[i + 1] = (dy / l * .5 + .5) * 255; out.data[i + 2] = (1 / l * .5 + .5) * 255; out.data[i + 3] = 255;
  }
  g.putImageData(out, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  return t;
}

// Basket weave: blocks of three strands, alternating across and along.
function drawBasketWeave(g, w, h) {
  const n = 8, cell = w / n, strand = cell / 3;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const across = (i + j) % 2 === 0;
    for (let k = 0; k < 3; k++) {
      const x = i * cell + (across ? 0 : k * strand), y = j * cell + (across ? k * strand : 0);
      const sw = across ? cell : strand, sh = across ? strand : cell;
      const grd = across ? g.createLinearGradient(0, y, 0, y + sh) : g.createLinearGradient(x, 0, x + sw, 0);
      grd.addColorStop(0, '#202020'); grd.addColorStop(.5, '#d8d8d8'); grd.addColorStop(1, '#202020');
      g.fillStyle = grd; g.fillRect(x, y, sw, sh);
    }
  }
}

// Linen: fine crossing threads of uneven thickness.
function drawLinenHeight(g, w, h) {
  const r = rng(47);
  for (let y = 0; y < h; y += 4) { g.fillStyle = `rgba(255,255,255,${.35 + r() * .4})`; g.fillRect(0, y, w, 2); }
  g.globalCompositeOperation = 'lighter';
  for (let x = 0; x < w; x += 4) { g.fillStyle = `rgba(255,255,255,${.2 + r() * .3})`; g.fillRect(x, 0, 2, h); }
  g.globalCompositeOperation = 'source-over';
}

// Cables: the same lobes as the knit's colour, raised in the middle.
function drawCableHeight(g, w, h) {
  const cols = 6, cw = w / cols;
  for (let c = 0; c < cols; c++) {
    const x = c * cw;
    for (let y = -cw * .5; y < h; y += cw * .55) {
      for (const s of [0, 1]) {
        const cx = x + cw * (.36 + s * .3), cy = y + s * cw * .27;
        g.save(); g.translate(cx, cy); g.rotate(s ? -.6 : .6); g.scale(1, cw * .3 / (cw * .19));
        const grd = g.createRadialGradient(0, 0, 0, 0, 0, cw * .19);
        grd.addColorStop(0, '#ffffff'); grd.addColorStop(.7, '#909090'); grd.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grd; g.beginPath(); g.arc(0, 0, cw * .19, 0, Math.PI * 2); g.fill();
        g.restore();
      }
    }
  }
}

function drawOatmealRug(g, w, h) {
  // Oatmeal wool in a fine basket weave.
  g.fillStyle = '#d8cbb3'; g.fillRect(0, 0, w, h);
  const r = rng(41);
  // Basket weave, 64 blocks across, lined up with the rug's relief map
  // (rugWeave: 8 tiles of 8 blocks).
  const cell = w / 64, strand = cell / 3;
  for (let i = 0; i < 64; i++) for (let j = 0; j < 64; j++) {
    const across = (i + j) % 2 === 0;
    for (let k = 0; k < 3; k++) {
      const x = i * cell + (across ? 0 : k * strand), y = j * cell + (across ? k * strand : 0);
      g.fillStyle = `rgba(255,248,232,${.1 + r() * .08})`;
      g.fillRect(x + (across ? 1 : .5), y + (across ? .5 : 1), across ? cell - 2 : strand - 1, across ? strand - 1 : cell - 2);
      g.fillStyle = 'rgba(110,90,60,.12)';
      if (across) g.fillRect(x, y + strand - 1, cell, 1); else g.fillRect(x + strand - 1, y, 1, cell);
    }
  }
  // Faded sage stripes running the length of the rug, in two pairs.
  const stripe = (u, width, a) => { g.fillStyle = `rgba(150,163,128,${a})`; g.fillRect(u * w, 0, width * w, h); };
  for (const base of [.2, .74]) { stripe(base, .045, .85); stripe(base + .065, .014, .75); }
  stripe(.08, .01, .45); stripe(.91, .01, .45);
  for (let i = 0; i < 16000; i++) { g.fillStyle = r() < .5 ? 'rgba(255,250,238,.1)' : 'rgba(90,70,40,.08)'; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1); }
}

function drawCableKnit(g, w, h) {
  g.fillStyle = '#e6dac3'; g.fillRect(0, 0, w, h);
  const r = rng(43), cols = 6, cw = w / cols;
  for (let c = 0; c < cols; c++) {
    const x = c * cw;
    // Purl ridge between cables.
    g.fillStyle = 'rgba(120,100,70,.18)'; g.fillRect(x, 0, cw * .12, h);
    // A two-strand cable: crossing lobes down the column.
    for (let y = -cw * .5; y < h; y += cw * .55) {
      for (const s of [0, 1]) {
        const cx = x + cw * (.36 + s * .3), cy = y + s * cw * .27;
        const grd = g.createLinearGradient(cx - cw * .2, cy, cx + cw * .2, cy);
        grd.addColorStop(0, 'rgba(140,118,86,.5)'); grd.addColorStop(.5, 'rgba(255,251,242,.5)'); grd.addColorStop(1, 'rgba(140,118,86,.45)');
        g.fillStyle = grd;
        g.beginPath(); g.ellipse(cx, cy, cw * .19, cw * .3, s ? -.6 : .6, 0, Math.PI * 2); g.fill();
        g.strokeStyle = 'rgba(120,100,70,.25)'; g.lineWidth = 1.5; g.stroke();
      }
    }
  }
  for (let i = 0; i < 9000; i++) { g.fillStyle = r() < .5 ? 'rgba(255,250,240,.12)' : 'rgba(100,80,50,.1)'; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1); }
}

function drawStripedLinen(g, w, h) {
  drawLinen(g, w, h, {base: '#dccfb4', dark: .1, seed: 29});
  g.fillStyle = 'rgba(122,138,98,.75)';
  for (const u of [.16, .26, .7, .8]) g.fillRect(u * w, 0, w * (u === .16 || u === .8 ? .045 : .018), h);
}

function drawRunner(g, w, h) {
  drawLinen(g, w, h, {base: '#e8dfcb', dark: .08, seed: 31});
  g.fillStyle = 'rgba(122,138,98,.8)';
  for (const u of [.05, .085, .9, .935]) g.fillRect(u * w, 0, w * .018, h);
}


// An oak leaf: lobed outline, ochre to russet with a little olive.
function drawOakLeaf(g, w, h) {
  g.clearRect(0, 0, w, h);
  g.translate(w / 2, h * .95);
  g.beginPath(); g.moveTo(0, 0);
  const lobes = 4;
  for (const side of [-1, 1]) {
    for (let i = 0; i <= lobes; i++) {
      const y = -h * (.12 + i * .2), out = (i === lobes ? .08 : .22 + .08 * Math.sin(i * 1.3)) * w;
      g.quadraticCurveTo(side * out * 1.25, y + h * .06, side * out, y);
      g.quadraticCurveTo(side * out * .35, y - h * .04, side * w * .08, y - h * .08);
    }
    g.lineTo(0, -h * .92);
    if (side < 0) g.moveTo(0, 0);
  }
  const grd = g.createLinearGradient(0, -h * .9, 0, 0);
  grd.addColorStop(0, '#c8892f'); grd.addColorStop(.6, '#b56a2a'); grd.addColorStop(1, '#7d6a32');
  g.fillStyle = grd; g.fill();
  g.strokeStyle = 'rgba(90,50,20,.6)'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -h * .88); g.stroke();
}

// Ghost cushion: flax linen with a little ivory felt ghost appliqué.
// (Drawn round the centre; the cushion's texture offset puts it mid-front.)
// A grown-up Halloween cushion: deep navy wool herringbone with one large
// ghost embroidered in ivory satin stitch in the middle, softly shaded,
// with black satin eyes. Tailored, not crafty.
function drawGhostCushion(g, w, h) {
  const r = rng(37);
  g.fillStyle = '#1f2633'; g.fillRect(0, 0, w, h);
  // Herringbone: rows of short slanted twill strokes, alternating direction.
  const row = w / 22;
  for (let y = 0; y < h; y += 3) for (let col = 0; col < 22; col++) {
    const x0 = col * row, dir = col % 2 ? 1 : -1;
    g.strokeStyle = `rgba(${150 + r() * 40},${160 + r() * 40},${185 + r() * 40},${.08 + r() * .07})`;
    g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + row, y + dir * 4); g.stroke();
  }
  // The ghost: a dome, gently swaying body, a flowing three-scallop hem.
  const ghost = () => {
    g.beginPath();
    g.moveTo(-.28, .32);
    g.bezierCurveTo(-.31, .05, -.3, -.12, -.24, -.24);
    g.bezierCurveTo(-.16, -.4, .16, -.4, .24, -.24);
    g.bezierCurveTo(.3, -.12, .3, .05, .29, .3);
    g.quadraticCurveTo(.22, .4, .14, .31); g.quadraticCurveTo(.07, .39, 0, .32);
    g.quadraticCurveTo(-.07, .4, -.14, .32); g.quadraticCurveTo(-.22, .41, -.28, .32);
    g.closePath();
  };
  g.save(); g.translate(w / 2, h / 2); g.scale(w, h); g.rotate(-.04);
  // A soft shadow where the embroidery sits proud of the cloth.
  g.save(); g.translate(.006, .01); ghost(); g.fillStyle = 'rgba(0,0,0,.35)'; g.filter = `blur(${w * .006}px)`; g.fill(); g.restore();
  ghost(); g.fillStyle = '#ece4d3'; g.fill();
  // Satin stitch: fine slanting threads across it, catching the light.
  g.save(); ghost(); g.clip();
  g.lineWidth = 1.2 / w;
  for (let i = -1; i < 1; i += .0045) {
    g.strokeStyle = `rgba(${r() < .5 ? '255,250,238' : '190,178,155'},${.18 + r() * .2})`;
    g.beginPath(); g.moveTo(i - .2, -.45); g.lineTo(i + .2, .45); g.stroke();
  }
  // Shading toward the edges, so it reads as padded.
  const sh = g.createRadialGradient(-.03, -.08, .05, 0, 0, .42);
  sh.addColorStop(0, 'rgba(255,255,255,.12)'); sh.addColorStop(1, 'rgba(120,100,70,.28)');
  g.fillStyle = sh; g.fillRect(-.5, -.5, 1, 1);
  g.restore();
  // A fine ivory outline stitch.
  ghost(); g.strokeStyle = 'rgba(214,200,170,.9)'; g.lineWidth = 2.2 / w; g.stroke();
  // Black satin eyes.
  g.fillStyle = '#121212';
  for (const x of [-.085, .085]) { g.beginPath(); g.ellipse(x, -.14, .028, .045, 0, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = 'rgba(255,255,255,.35)';
  for (const x of [-.078, .092]) { g.beginPath(); g.ellipse(x, -.155, .008, .012, 0, 0, Math.PI * 2); g.fill(); }
  g.restore();
}

// A paper bat silhouette (charcoal), on a transparent background.
function drawPaperBat(g, w, h) {
  g.clearRect(0, 0, w, h);
  g.translate(w / 2, h / 2);
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.moveTo(0, -h * .12);
  g.quadraticCurveTo(w * .18, -h * .42, w * .48, -h * .3);
  for (let i = 0; i < 3; i++) { const x = w * (.48 - i * .14); g.quadraticCurveTo(x - w * .05, h * (.02 + i * .02), x - w * .14, h * (.06 + (i === 2 ? .1 : 0))); }
  g.quadraticCurveTo(w * .03, h * .3, 0, h * .32);
  g.quadraticCurveTo(-w * .03, h * .3, -w * .06, h * .16);
  for (let i = 0; i < 3; i++) { const x = -w * (.06 + i * .14); g.quadraticCurveTo(x - w * .09, h * (.02 + i * .02), x - w * .14, h * (i === 2 ? -.3 : .02)); }
  g.quadraticCurveTo(-w * .18, -h * .42, 0, -h * .12);
  g.fill();
  // Ears.
  g.beginPath(); g.moveTo(-w * .04, -h * .1); g.lineTo(-w * .02, -h * .3); g.lineTo(0, -h * .12); g.lineTo(w * .02, -h * .3); g.lineTo(w * .04, -h * .1); g.fill();
}

// A jack-o'-lantern's skin (colour) and its glowing carved face (emissive).
// The face sits at u = .25, which on a sphere faces +z (into the room).
function drawJack(g, w, h, {base, sleepy, glow}) {
  g.fillStyle = glow ? '#000' : base; g.fillRect(0, 0, w, h);
  if (!glow) { const r = rng(sleepy ? 57 : 59); for (let i = 0; i < 900; i++) { g.fillStyle = r() < .5 ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)'; g.fillRect(r() * w, r() * h, 2, 2); } }
  const cx = w * .25, cy = h * .47, k = 1.35;
  // The carved face; `edge` widens every outline (for the cut rim).
  const face = (color, edge) => {
    g.fillStyle = g.strokeStyle = color; g.lineCap = 'round'; g.lineJoin = 'round';
    const shape = (draw, filled, width) => { g.beginPath(); draw(); if (filled) g.fill(); g.lineWidth = width + edge; g.stroke(); };
    if (sleepy) {
      for (const dx of [-13, 13]) shape(() => g.arc(cx + dx * k, cy - 9 * k, 7 * k, .15 * Math.PI, .85 * Math.PI), false, 5 * k);
      shape(() => { g.moveTo(cx, cy - 1 * k); g.lineTo(cx - 4 * k, cy + 5 * k); g.lineTo(cx + 4 * k, cy + 5 * k); g.closePath(); }, true, 1);
      shape(() => { g.moveTo(cx - 14 * k, cy + 11 * k); g.quadraticCurveTo(cx, cy + 24 * k, cx + 14 * k, cy + 11 * k); g.quadraticCurveTo(cx, cy + 17 * k, cx - 14 * k, cy + 11 * k); }, true, 1);
    } else {
      for (const dx of [-14, 14]) shape(() => g.ellipse(cx + dx * k, cy - 9 * k, 6.5 * k, 7.5 * k, 0, 0, Math.PI * 2), true, 1);
      shape(() => { g.moveTo(cx, cy - 3 * k); g.lineTo(cx - 5.5 * k, cy + 5 * k); g.lineTo(cx + 5.5 * k, cy + 5 * k); g.closePath(); }, true, 1);
      shape(() => { g.moveTo(cx - 23 * k, cy + 9 * k); g.quadraticCurveTo(cx, cy + 32 * k, cx + 23 * k, cy + 9 * k); g.quadraticCurveTo(cx, cy + 21 * k, cx - 23 * k, cy + 9 * k); }, true, 1);
    }
  };
  if (glow) { face('#ffffff', 0); return; }
  // By day: a pale cut edge round a deep, dark hollow, so the carving reads
  // clearly; at night the hollow is what glows (emissive map).
  face('#f4d29b', 5);
  face('#1c0e05', 0);
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
// Autumn pieces: "shared" by Thanksgiving and Halloween (sill runner, oak
// branches in the pitcher, brass lantern, bed piping) and Thanksgiving's own.
function buildAutumn(room, T) {
  const M = room.materials, out = {shared: [], thanksgiving: []};
  let made = out.shared;
  const add = (obj, parent) => { parent.add(obj); made.push(obj); return obj; };
  const mesh = (geo, mat, parent, opts) => { const m = room.mesh(geo, mat, parent, opts); made.push(m); return m; };
  const r = rng(71);
  const stemMat = new THREE.MeshStandardMaterial({color: '#6b4a2a', roughness: .8});
  const oakMat = new THREE.MeshStandardMaterial({map: T.oak, alphaTest: .45, side: THREE.DoubleSide, roughness: .75});
  const stoneware = new THREE.MeshStandardMaterial({color: '#ece3d0', roughness: .75});

  // --- On the window sill: a striped runner, pumpkins, oak branches in the
  // pitcher and a bowl of pears. The middle stays clear for Mochi.
  const w = room.windowGroup, top = room.sillTop, D = room.sillDepth;
  const runnerMat = new THREE.MeshStandardMaterial({map: T.runner, roughness: 1, side: THREE.DoubleSide});
  const runner = mesh(new THREE.BoxGeometry(2.3, .012, D * .62), runnerMat, w, {cast: false});
  runner.position.set(0, top + .004, D * .58);
  const drape = mesh(new THREE.PlaneGeometry(2.3, .3), runnerMat, w, {cast: false});
  drape.position.set(0, top - .14, D + .012);
  room.sprigs(add(new THREE.Group(), w), new THREE.Vector3(-.75, top + .4, .22), 8, .95, {leaf: oakMat, stem: '#6a4a2c', size: 1.55, seed: 91});
  made = out.thanksgiving;
  const pumpkin = (x, z, rad, height, color) => {
    const body = mesh(pumpkinGeometry(rad, height), new THREE.MeshStandardMaterial({color, roughness: .62}), w);
    body.position.set(x, top + height, z);
    mesh(pumpkinStem(rad), stemMat, w).position.set(x + rad * .05, top + height * 2 + rad * .15, z);
  };
  pumpkin(-1.13, .34, .17, .14, '#efe6d2');
  pumpkin(-.93, .64, .11, .085, '#e0995e');
  pumpkin(-.58, .62, .08, .065, '#efe6d2');
  const bowl = mesh(lathe([[0, 0], [.1, 0], [.15, .04], [.17, .1], [.165, .105], [.14, .055], [0, .045]], 32), stoneware, w);
  bowl.position.set(1.12, top + .005, .24);
  const pearMat = new THREE.MeshStandardMaterial({color: '#c0ae48', roughness: .55});
  const pear = (x, y, z, s, tilt) => {
    const p = mesh(lathe([[0, 0], [.05, .005], [.065, .04], [.055, .08], [.03, .11], [.022, .14], [.012, .155], [0, .16]].map(([a, b]) => [a * s, b * s]), 24), pearMat, w);
    p.position.set(x, y, z); p.rotation.z = tilt;
    const st = mesh(new THREE.CylinderGeometry(.004, .006, .04 * s, 5), new THREE.MeshStandardMaterial({color: '#5a3e22'}), w);
    st.position.set(x - Math.sin(tilt) * .17 * s, y + .17 * s, z); st.rotation.z = tilt - .3;
  };
  pear(1.08, top + .06, .21, 1.25, .15); pear(1.18, top + .06, .27, 1.15, -.2); pear(1.12, top + .07, .14, 1.1, .05);

  // --- An oak-leaf garland swagged along the curtain rod, with short tails
  // at each end. (The painting stays bare.)
  const rod = room.curtainRod, path = [];
  for (let i = 0; i <= 80; i++) {
    const k = i / 80, x = -rod.half + .12 + k * (rod.half - .12) * 2;
    path.push([x, rod.y - .05 - Math.sin(Math.PI * ((k * 2) % 1)) * .26]);
  }
  for (const sx of [-1, 1]) for (let i = 0; i <= 10; i++) path.push([sx * (rod.half - .12), rod.y - .05 - i * .05]);
  const garland = new THREE.InstancedMesh(new THREE.PlaneGeometry(.21, .21), oakMat, 300);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let i = 0; i < 300; i++) {
    const [x, y] = path[Math.floor(r() * path.length)];
    q.setFromEuler(e.set((r() - .5) * .8, (r() - .5) * .8, r() * Math.PI * 2));
    m4.compose(new THREE.Vector3(x + (r() - .5) * .12, y + (r() - .5) * .1, rod.z + .14 + r() * .06), q, new THREE.Vector3(1, 1, 1).multiplyScalar(.7 + r() * .45));
    garland.setMatrixAt(i, m4);
  }
  add(garland, room.windowGroup);

  // --- Brass lantern with a candle on the side table; a sage gourd on the
  // shelf below.
  made = out.shared;
  const st = room.sideTable, H = room.sideTableTop;
  const lantern = add(new THREE.Group(), st);
  lantern.position.set(.3, H, .2);
  mesh(roundedBox(.2, .03, .2, .01), M.brass, lantern).position.y = .015;
  for (const [x, z] of [[-.085, -.085], [.085, -.085], [-.085, .085], [.085, .085]]) mesh(new THREE.BoxGeometry(.016, .3, .016), M.brass, lantern).position.set(x, .18, z);
  const glass = new THREE.MeshStandardMaterial({color: '#fff6e0', transparent: true, opacity: .18, roughness: .05, depthWrite: false});
  mesh(new THREE.BoxGeometry(.17, .28, .17), glass, lantern, {cast: false}).position.y = .18;
  mesh(lathe([[0, 0], [.12, 0], [.1, .04], [.05, .09], [.02, .1], [0, .1]], 24), M.brass, lantern).position.y = .33;
  const ring = mesh(new THREE.TorusGeometry(.035, .008, 6, 16), M.brass, lantern); ring.position.y = .46;
  mesh(new THREE.CylinderGeometry(.035, .035, .1, 16), new THREE.MeshStandardMaterial({color: '#f3ead6', roughness: .6}), lantern).position.y = .08;
  const flame = mesh(new THREE.ConeGeometry(.012, .04, 8), new THREE.MeshBasicMaterial({color: '#ffcf70'}), lantern, {cast: false});
  flame.position.y = .155;
  // The candle's glow is a soft additive halo, not a light: adding a light
  // makes the phone rebuild the shading of everything in the room (a
  // freeze of several seconds on an iPhone).
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({map: canvasTexture(64, 64, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grd.addColorStop(0, 'rgba(255,200,120,1)'); grd.addColorStop(.35, 'rgba(255,170,80,.45)'); grd.addColorStop(1, 'rgba(255,150,60,0)');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  }), color: '#ffffff', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .3}));
  halo.scale.setScalar(.7);
  halo.position.y = .17;
  add(halo, lantern);
  room.thanksgivingCandle = halo;
  room.thanksgivingFlame = flame;
  made = out.thanksgiving;
  const gourd = mesh(lathe([[0, 0], [.06, .005], [.11, .05], [.12, .1], [.09, .17], [.05, .22], [.045, .28], [.035, .32], [0, .33]], 28), new THREE.MeshStandardMaterial({map: T.gourd, roughness: .5}), st);
  gourd.position.set(.15, .34, .05); gourd.rotation.z = .08;
  mesh(new THREE.CylinderGeometry(.008, .012, .07, 6), new THREE.MeshStandardMaterial({color: '#5a3e22'}), st).position.set(.15, .7, .05);

  // --- Pinecone basket on the hearth, in front of the fireplace's right side.
  const bg = add(new THREE.Group(), room.group);
  bg.position.set(3.85, room.hearthTop, 2.3); bg.scale.setScalar(.85);
  mesh(lathe([[0, 0], [.27, 0], [.31, .05], [.33, .28], [.31, .3], [0, .3]], 32), M.jute, bg);
  for (const s of [-1, 1]) { const h = mesh(new THREE.TorusGeometry(.07, .018, 6, 14, Math.PI), M.jute, bg); h.position.set(s * .3, .3, 0); h.rotation.y = Math.PI / 2; }
  const coneMat = new THREE.MeshStandardMaterial({color: '#6d4a2c', roughness: .9});
  for (let i = 0; i < 7; i++) {
    const geo = new THREE.ConeGeometry(.07, .17, 10, 5), p = geo.attributes.position;
    for (let k = 0; k < p.count; k++) { const y = p.getY(k), s = 1 + .18 * Math.sin(y * 70); p.setX(k, p.getX(k) * s); p.setZ(k, p.getZ(k) * s); }
    geo.computeVertexNormals();
    const c = mesh(geo, coneMat, bg);
    const a = i / 7 * Math.PI * 2;
    c.position.set(Math.cos(a) * .16 * (i ? 1 : 0), .32 + (i ? 0 : .06), Math.sin(a) * .16 * (i ? 1 : 0));
    c.rotation.set(Math.PI / 2 + (r() - .5) * .8, r() * 6, (r() - .5) * .8);
  }

  // --- Olive piping round the bed's rim (following its lower front) and
  // its base.
  made = out.shared;
  const R = room.bedR, olive = new THREE.MeshStandardMaterial({color: '#6c7444', roughness: .8}), rim = [];
  for (let i = 0; i < 64; i++) {
    const a = i / 64 * Math.PI * 2, rr = R - .1, x = rr * Math.sin(a), z = rr * Math.cos(a);
    const front = Math.pow(Math.max(0, Math.cos(a)), 3);
    rim.push(new THREE.Vector3(x, .16 + (.452 - .16) * (1 - .55 * front), z));
  }
  mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rim, true), 128, .022, 8, true), olive, room.bed);
  const foot = mesh(new THREE.TorusGeometry(R + .012, .02, 8, 64), olive, room.bed);
  foot.rotation.x = Math.PI / 2; foot.position.y = .025;

  // --- One oak leaf blown onto the rug.
  made = out.thanksgiving;
  const leaf = mesh(new THREE.PlaneGeometry(.2, .2), oakMat, room.group, {cast: false});
  leaf.rotation.set(-Math.PI / 2, 0, .9);
  leaf.position.set(.95, .041, 1.15);
  room.rugLeaf = leaf;
  return out;
}

function pumpkinGeometry(rad, height) {
  const geo = new THREE.SphereGeometry(rad, 40, 24), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i), a = Math.atan2(vz, vx);
    const rib = 1 - .08 * Math.pow(Math.abs(Math.sin(a * 4)), .6) * (1 - Math.abs(vy / rad));
    const squash = vy > 0 ? 1 - .25 * Math.pow(Math.max(0, 1 - Math.hypot(vx, vz) / rad), 2) : 1;
    p.setXYZ(i, vx * rib, vy * (height / rad) * squash, vz * rib);
  }
  geo.computeVertexNormals();
  return geo;
}
const pumpkinStem = rad => { const g = new THREE.CylinderGeometry(rad * .07, rad * .1, rad * .5, 8); g.rotateZ(-.25); return g; };

// Halloween's own pieces: two glowing jack-o'-lanterns on the left of the
// sill, three paper bats on the window and the felt bat toy (it stands in
// for the ball; app.js moves it). The ghost cushion is the chair cushion's
// texture.
function buildHalloween(room) {
  const made = [], w = room.windowGroup, top = room.sillTop;
  const mesh = (geo, mat, parent, opts) => { const m = room.mesh(geo, mat, parent, opts); made.push(m); return m; };
  const stemMat = new THREE.MeshStandardMaterial({color: '#5d4a28', roughness: .8});
  room.halloweenGlow = []; room.halloweenHalos = [];
  const haloMat = new THREE.SpriteMaterial({map: canvasTexture(64, 64, (g, cw, ch) => {
    const grd = g.createRadialGradient(cw / 2, ch / 2, 0, cw / 2, ch / 2, cw / 2);
    grd.addColorStop(0, 'rgba(255,190,100,.9)'); grd.addColorStop(.4, 'rgba(255,160,70,.35)'); grd.addColorStop(1, 'rgba(255,140,50,0)');
    g.fillStyle = grd; g.fillRect(0, 0, cw, ch);
  }), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0});
  const jack = (x, z, rad, height, base, sleepy, turn) => {
    const opts = {base, sleepy};
    const mat = new THREE.MeshStandardMaterial({
      map: canvasTexture(256, 128, (g, cw, ch) => drawJack(g, cw, ch, opts)),
      emissiveMap: canvasTexture(256, 128, (g, cw, ch) => drawJack(g, cw, ch, {...opts, glow: true})),
      emissive: '#ffad4a', emissiveIntensity: .6, roughness: .7,
    });
    const body = mesh(pumpkinGeometry(rad, height), mat, w);
    body.position.set(x, top + height, z); body.rotation.y = turn;
    mesh(pumpkinStem(rad), stemMat, w).position.set(x + rad * .05, top + height * 2 + rad * .15, z);
    room.halloweenGlow.push(mat);
    // Candlelight spilling from the face in the evening.
    const halo = new THREE.Sprite(haloMat.clone());
    halo.scale.setScalar(rad * 3.2);
    halo.position.set(x + Math.sin(turn) * rad * .9, top + height * 1.05, z + Math.cos(turn) * rad * .9);
    w.add(halo); made.push(halo);
    room.halloweenHalos.push(halo.material);
  };
  jack(-1.17, .4, .25, .2, '#d98b45', false, -.15);
  jack(-.78, .64, .18, .14, '#efe5d2', true, .1);
  // Paper bats taped to the glass, upper right.
  const batMat = new THREE.MeshStandardMaterial({map: canvasTexture(128, 64, drawPaperBat), color: '#38332f', alphaTest: .5, side: THREE.DoubleSide, roughness: 1});
  const glassBottom = room.glassBottom, h = room.glassH;
  // Bigger than the prop sheet's 8-12 cm so they read on a phone; each hangs
  // from a thread at its top and sways a little (room.updatePaperBats).
  const paper = [];
  for (const [x, y, size, rot] of [[.36, .5, .62, .12], [.76, .43, .5, -.18], [.52, .33, .42, .05]]) {
    const geo = new THREE.PlaneGeometry(size, size / 2); geo.translate(0, -size / 4, 0);
    const b = mesh(geo, batMat, w, {cast: false, receive: false});
    b.position.set(x, glassBottom + h * y + size / 4, .035); b.rotation.z = rot;
    paper.push({b, rot, phase: paper.length * 1.7});
  }
  room.updatePaperBats = t => {
    if (!paper[0].b.visible) return;
    for (const p of paper) { p.b.rotation.z = p.rot + Math.sin(t * 1.1 + p.phase) * .1; p.b.scale.x = 1 + Math.sin(t * 2.3 + p.phase) * .05; }
  };
  // The felt bat toy: a round charcoal felt body, little ears and scalloped
  // wings, about 14 cm across.
  const felt = new THREE.MeshStandardMaterial({map: canvasTexture(128, 128, (g, cw, ch) => drawNoise(g, cw, ch, {base: '#46403a', blobs: [['rgba(255,255,255,.06)', 900, 1, 2.5], ['rgba(0,0,0,.12)', 900, 1, 2.5]], seed: 61})), roughness: 1, side: THREE.DoubleSide});
  const bat = new THREE.Group();
  room.group.add(bat); made.push(bat);
  const body = room.mesh(new THREE.SphereGeometry(.075, 20, 14), felt, bat);
  body.position.y = .075; body.scale.set(1, .95, .9);
  for (const sx of [-1, 1]) {
    const ear = room.mesh(new THREE.ConeGeometry(.022, .05, 8), felt, bat);
    ear.position.set(sx * .035, .145, 0); ear.rotation.z = -sx * .25;
    const wing = new THREE.Shape();
    wing.moveTo(0, 0); wing.quadraticCurveTo(.06, .07, .13, .06);
    for (let i = 0; i < 3; i++) { const x = .13 - i * .045; wing.quadraticCurveTo(x - .015, .015, x - .045, i === 2 ? -.02 : .02); }
    wing.lineTo(0, -.03); wing.closePath();
    const wm = room.mesh(new THREE.ShapeGeometry(wing, 6), felt, bat);
    // Big felt wings, so it reads as a bat from across the room.
    wm.position.set(sx * .055, .09, -.012); wm.scale.set(sx * 1.7, 1.7, 1);
    const eye = room.mesh(new THREE.SphereGeometry(.009, 8, 6), new THREE.MeshStandardMaterial({color: '#0d0b0a', roughness: .2}), bat);
    eye.position.set(sx * .024, .088, .066);
  }
  bat.scale.setScalar(1.15);
  bat.visible = false;
  room.feltBat = bat;
  return made;
}

// ---------------------------------------------------------------------------
// The kitchen's holiday dress (from Orion's concepts): the same decor as the
// study, so the house changes together. Shared by both: oak branches in a
// cream pitcher at the island's left end (in place of the orchid) and a brass
// lantern on the counter by the range. Thanksgiving: heirloom pumpkins on the
// counter, pears, a white pumpkin and walnuts on a linen runner, an oak-leaf
// wreath on the glazing and a striped linen towel over a stool. Halloween:
// two jack-o'-lanterns on the counter (glowing in the evening), paper bats
// on the glazing, a ghost cushion in her tent, clementines in a stone bowl,
// an orange towel over a stool, and the felt bat toy. The shelves, their
// landings, the faucet and the salmon plate stay as they are.
// ---------------------------------------------------------------------------
export function applyKitchenDecor(kitchen, name) {
  if (!DECORS[name]) name = 'classic';
  const room = kitchen.room, T = room.decorTextures ??= thanksgivingTextures();
  const parts = kitchen.decorParts ??= {};
  const autumn = name === 'thanksgiving' || name === 'halloween', christmas = name === 'christmas';
  if (autumn) {
    parts.shared ??= kitchenAutumn(kitchen, T);
    parts[name] ??= name === 'halloween' ? kitchenHalloween(kitchen, T) : kitchenThanksgiving(kitchen, T);
  }
  if (christmas) parts.christmas ??= kitchenChristmas(kitchen, T);
  for (const [part, g] of Object.entries(parts)) g.visible = part === 'shared' ? autumn : part === name;
  kitchen.orchid.visible = name === 'classic';
  // Christmas swaps a few of the kitchen's own pieces: the hanging lamps
  // turn to alabaster on brass arms, and its utensil jar and potted pine
  // stand where the crock and the olive do.
  if (kitchen.crock) kitchen.crock.visible = !christmas;
  if (kitchen.counterOlive) kitchen.counterOlive.visible = !christmas;
  const X = kitchen.xmasLamps;
  if (X) {
    kitchen.shades.forEach(sh => sh.material = christmas ? X.alabaster : kitchen.materials.shade);
    X.arms.forEach(m => m.material = christmas ? kitchen.materials.brass : kitchen.materials.iron);
    X.fittings.forEach(o => o.visible = christmas);
  }
  if (kitchen.ghostCushion) kitchen.ghostCushion.visible = name === 'halloween';
  if (kitchen.xmasCushion) kitchen.xmasCushion.visible = christmas;
  // Christmas warms the room itself: the plaster and the stone floor take
  // on the pictures' honey tone (and give it back for the other looks).
  const KM = kitchen.materials;
  kitchen.decorOriginal ??= {plaster: KM.plaster.color.clone(), floor: KM.floor.color.clone(), counter: KM.counter.color.clone()};
  KM.plaster.color.set(christmas ? '#f6e6d0' : kitchen.decorOriginal.plaster);
  KM.floor.color.set(christmas ? '#efdec6' : kitchen.decorOriginal.floor);
  KM.counter.color.set(christmas ? '#f7e6cc' : kitchen.decorOriginal.counter);
  kitchen.candleLight = autumn ? kitchen.lanternHalo : christmas ? kitchen.xmasHalo : null;
  kitchen.candleFlame = christmas ? kitchen.xmasFlame : kitchen.lanternFlame;
  kitchen.pumpkinGlow = name === 'halloween' ? kitchen.jackGlow : null;
  kitchen.pumpkinHalos = name === 'halloween' ? kitchen.jackHalos : null;
  kitchen.decor = name;
}

const ISLAND_TOP = 2.25, COUNTER_TOP = 2.2;
function kitchenPart(kitchen) { const g = new THREE.Group(); kitchen.group.add(g); return g; }
const glowHalo = (inner, outer) => new THREE.SpriteMaterial({map: canvasTexture(64, 64, (g, w, h) => {
  const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  grd.addColorStop(0, inner); grd.addColorStop(.38, outer); grd.addColorStop(1, 'rgba(255,140,50,0)');
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
}), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0});

// A brass lantern with a candle, standing on the back counter.
function brassLantern(kitchen, g, x, z, y = COUNTER_TOP) {
  const M = {brass: kitchen.materials.brass || (kitchen.materials.brass = new THREE.MeshStandardMaterial({color: '#b58a3c', metalness: .85, roughness: .3}))}, mesh = (geo, mat, parent = g, opts) => kitchen.mesh(geo, mat, parent, opts);
  const lantern = new THREE.Group(); lantern.position.set(x, y, z); lantern.scale.setScalar(1.45); g.add(lantern);
  mesh(roundedBox(.2, .03, .2, .01), M.brass, lantern).position.y = .015;
  for (const [x, z] of [[-.085, -.085], [.085, -.085], [-.085, .085], [.085, .085]]) mesh(new THREE.BoxGeometry(.016, .3, .016), M.brass, lantern).position.set(x, .18, z);
  mesh(new THREE.BoxGeometry(.17, .28, .17), new THREE.MeshStandardMaterial({color: '#fff6e0', transparent: true, opacity: .18, roughness: .05, depthWrite: false}), lantern, {cast: false}).position.y = .18;
  mesh(lathe([[0, 0], [.12, 0], [.1, .04], [.05, .09], [.02, .1], [0, .1]], 24), M.brass, lantern).position.y = .33;
  mesh(new THREE.TorusGeometry(.035, .008, 6, 16), M.brass, lantern).position.y = .46;
  mesh(new THREE.CylinderGeometry(.035, .035, .1, 16), new THREE.MeshStandardMaterial({color: '#f3ead6', roughness: .6}), lantern).position.y = .08;
  const flame = mesh(new THREE.ConeGeometry(.012, .04, 8), new THREE.MeshBasicMaterial({color: '#ffcf70'}), lantern, {cast: false});
  flame.position.y = .155;
  const halo = new THREE.Sprite(glowHalo('rgba(255,200,120,1)', 'rgba(255,170,80,.45)'));
  halo.material.opacity = .3; halo.scale.setScalar(.8); halo.position.y = .17;
  lantern.add(halo);
  return {halo, flame};
}

function kitchenAutumn(kitchen, T) {
  const g = kitchenPart(kitchen), M = kitchen.materials, room = kitchen.room;
  const mesh = (geo, mat, parent = g, opts) => kitchen.mesh(geo, mat, parent, opts);
  // Oak branches in a cream stoneware pitcher.
  const stoneware = new THREE.MeshStandardMaterial({color: '#ece3d0', roughness: .75});
  const pitcher = new THREE.Group(); pitcher.position.set(-3.3, ISLAND_TOP, .25); g.add(pitcher);
  mesh(lathe([[0, 0], [.13, 0], [.17, .08], [.18, .2], [.13, .34], [.11, .4], [.13, .46], [.12, .47], [.09, .4], [0, .4]], 32), stoneware, pitcher);
  const handle = mesh(new THREE.TorusGeometry(.09, .022, 8, 16, Math.PI * 1.1), stoneware, pitcher);
  handle.position.set(-.16, .27, 0); handle.rotation.z = Math.PI / 2 + .1;
  const oakMat = new THREE.MeshStandardMaterial({map: T.oak, alphaTest: .45, side: THREE.DoubleSide, roughness: .75});
  room.sprigs(pitcher, new THREE.Vector3(0, .38, 0), 12, 1.25, {leaf: oakMat, stem: '#6a4a2c', size: 2.1, seed: 93});
  // A brass lantern with a candle, on the counter by the range.
  const {halo, flame} = brassLantern(kitchen, g, 3.42, -3.3);
  kitchen.lanternHalo = halo; kitchen.lanternFlame = flame;
  return g;
}

// A tea towel hung over the right-hand stool: folded on the seat, falling
// down its front.
function stoolTowel(kitchen, g, mat) {
  const s = new THREE.Group(); s.position.set(-1.85, 1.69, 2.4); s.rotation.y = .12; g.add(s);
  // One cloth: lying across the seat, rolling over its front edge and
  // hanging in soft folds to a slightly uneven hem.
  const W = .4, L = .95, geo = new THREE.PlaneGeometry(W, L, 16, 48), p = geo.attributes.position;
  const edge = .34, R = .05;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) / W, t = .5 - p.getY(i) / L; // across, and along from its back end
    let sAlong = t * L;
    // (Its hem a little uneven.)
    sAlong *= 1 + .04 * Math.sin(u * 9 + 1) * Math.max(0, t - .6) * 2.5;
    let y, z;
    const flat = edge + .12;
    if (sAlong < flat) { y = .008 - Math.max(0, sAlong - edge) * .15; z = -.12 + sAlong; }
    else if (sAlong < flat + Math.PI / 2 * R) { const a = (sAlong - flat) / R; y = .008 - .018 - R + Math.cos(a) * R; z = -.12 + flat + Math.sin(a) * R; }
    else { const d = sAlong - flat - Math.PI / 2 * R; y = -.01 - R - d; z = -.12 + flat + R + d * .1; }
    const hang = Math.max(0, -y - .06);
    // Folds deepen as it hangs; the sides fall in a little.
    z += Math.sin(u * 11 + .6) * .03 * Math.min(1, hang * 3) + Math.sin(u * 23) * .006;
    const x = u * W * (1 - .1 * Math.min(1, hang * 2.5));
    p.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  const m2 = mat.clone(); m2.side = THREE.DoubleSide;
  kitchen.mesh(geo, m2, s);
}

function kitchenThanksgiving(kitchen, T) {
  const g = kitchenPart(kitchen), room = kitchen.room;
  const mesh = (geo, mat, parent = g, opts) => kitchen.mesh(geo, mat, parent, opts);
  const stemMat = new THREE.MeshStandardMaterial({color: '#6b4a2a', roughness: .8});
  const pumpkin = (x, y, z, rad, height, color) => {
    mesh(pumpkinGeometry(rad, height), new THREE.MeshStandardMaterial({color, roughness: .62})).position.set(x, y + height, z);
    mesh(pumpkinStem(rad), stemMat).position.set(x + rad * .05, y + height * 2 + rad * .15, z);
  };
  // Heirloom pumpkins on the counter by the range.
  pumpkin(2.82, COUNTER_TOP, -3.2, .26, .2, '#d9884a');
  pumpkin(3.12, COUNTER_TOP, -2.98, .16, .12, '#efe6d2');
  // On the island: a linen runner with a bowl of pears, a little white
  // pumpkin and walnuts.
  const runner = mesh(new THREE.BoxGeometry(1.7, .012, .62), new THREE.MeshStandardMaterial({map: T.runner, roughness: 1}), g, {cast: false});
  runner.position.set(-2.85, ISLAND_TOP + .006, .55);
  const stoneware = new THREE.MeshStandardMaterial({color: '#8a6a48', roughness: .8});
  const bowl = new THREE.Group(); bowl.position.set(-2.55, ISLAND_TOP + .012, .55); g.add(bowl);
  mesh(lathe([[0, 0], [.14, 0], [.22, .05], [.25, .13], [.24, .135], [.2, .07], [0, .06]], 32), stoneware, bowl);
  const pearMat = new THREE.MeshStandardMaterial({color: '#c0ae48', roughness: .55});
  const pear = (x, y, z, s, tilt) => {
    const p = mesh(lathe([[0, 0], [.05, .005], [.065, .04], [.055, .08], [.03, .11], [.022, .14], [.012, .155], [0, .16]].map(([a, b]) => [a * s, b * s]), 24), pearMat, bowl);
    p.position.set(x, y, z); p.rotation.z = tilt;
    const st = mesh(new THREE.CylinderGeometry(.005, .007, .045 * s, 5), stemMat, bowl);
    st.position.set(x - Math.sin(tilt) * .17 * s, y + .17 * s, z); st.rotation.z = tilt - .3;
  };
  pear(-.06, .07, -.03, 1.7, .15); pear(.08, .07, .05, 1.6, -.2); pear(.02, .08, -.1, 1.5, .05); pear(-.08, .08, .1, 1.5, .3);
  pumpkin(-2.05, ISLAND_TOP + .012, .7, .11, .085, '#efe6d2');
  const nut = new THREE.MeshStandardMaterial({color: '#7a5634', roughness: .85});
  for (const [x, z] of [[-2.2, .32], [-2.12, .38], [-2.27, .4]]) mesh(new THREE.SphereGeometry(.035, 10, 8), nut).position.set(x, ISLAND_TOP + .045, z);
  // An oak-leaf wreath hung on the glazing.
  const oakMat = new THREE.MeshStandardMaterial({map: T.oak, alphaTest: .45, side: THREE.DoubleSide, roughness: .75});
  const wreath = new THREE.InstancedMesh(new THREE.PlaneGeometry(.26, .26), oakMat, 90), r = rng(57);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let i = 0; i < 90; i++) {
    const a = i / 90 * Math.PI * 2 + r() * .1, rr = .42 + (r() - .5) * .14;
    q.setFromEuler(e.set((r() - .5) * .7, Math.PI / 2 + (r() - .5) * .7, a + r() * 1.2));
    m4.compose(new THREE.Vector3(-5.86 + r() * .06, 5.3 + Math.sin(a) * rr, -2.25 + Math.cos(a) * rr), q, new THREE.Vector3(1, 1, 1).multiplyScalar(.75 + r() * .4));
    wreath.setMatrixAt(i, m4);
  }
  g.add(wreath);
  mesh(new THREE.CylinderGeometry(.006, .006, 1.6, 4), new THREE.MeshStandardMaterial({color: '#a88b5a'})).position.set(-5.9, 6.5, -2.25);
  stoolTowel(kitchen, g, new THREE.MeshStandardMaterial({map: T.cushion, roughness: 1}));
  return g;
}

function kitchenHalloween(kitchen, T) {
  const g = kitchenPart(kitchen), room = kitchen.room;
  const mesh = (geo, mat, parent = g, opts) => kitchen.mesh(geo, mat, parent, opts);
  const stemMat = new THREE.MeshStandardMaterial({color: '#5d4a28', roughness: .8});
  kitchen.jackGlow = []; kitchen.jackHalos = [];
  const halo = glowHalo('rgba(255,190,100,.9)', 'rgba(255,160,70,.35)');
  // Two jack-o'-lanterns by the range, faces to the room.
  const jack = (x, z, rad, height, base, sleepy, turn) => {
    const opts = {base, sleepy};
    const mat = new THREE.MeshStandardMaterial({
      map: canvasTexture(256, 128, (c, cw, ch) => drawJack(c, cw, ch, opts)),
      emissiveMap: canvasTexture(256, 128, (c, cw, ch) => drawJack(c, cw, ch, {...opts, glow: true})),
      emissive: '#ffad4a', emissiveIntensity: .04, roughness: .7,
    });
    const body = mesh(pumpkinGeometry(rad, height), mat);
    body.position.set(x, COUNTER_TOP + height, z); body.rotation.y = turn;
    mesh(pumpkinStem(rad), stemMat).position.set(x + rad * .05, COUNTER_TOP + height * 2 + rad * .15, z);
    kitchen.jackGlow.push(mat);
    const h = new THREE.Sprite(halo.clone());
    h.scale.setScalar(rad * 3.2);
    h.position.set(x + Math.sin(turn) * rad * .9, COUNTER_TOP + height * 1.05, z + Math.cos(turn) * rad * .9);
    g.add(h);
    kitchen.jackHalos.push(h.material);
  };
  jack(2.82, -3.2, .3, .23, '#d98b45', false, -.1);
  jack(3.14, -2.98, .19, .15, '#efe5d2', true, .15);
  // Paper bats on the glazing, high up.
  const batMat = new THREE.MeshStandardMaterial({map: canvasTexture(128, 64, drawPaperBat), color: '#38332f', alphaTest: .5, side: THREE.DoubleSide, roughness: 1});
  const bats = [];
  for (const [z, y, size, rot] of [[-2.9, 6.9, .95, .12], [-1.6, 6.3, .8, -.15], [-3.2, 5.2, .7, .06], [1.4, 6.6, .75, -.08]]) {
    const geo = new THREE.PlaneGeometry(size, size / 2); geo.translate(0, -size / 4, 0);
    const b = mesh(geo, batMat, g, {cast: false, receive: false});
    b.position.set(-5.88, y + size / 4, z); b.rotation.set(0, Math.PI / 2, rot);
    bats.push({b, rot, phase: bats.length * 1.7});
  }
  kitchen.updatePaperBats = t => {
    if (!g.visible) return;
    for (const p of bats) { p.b.rotation.z = p.rot + Math.sin(t * 1.1 + p.phase) * .1; p.b.scale.x = 1 + Math.sin(t * 2.3 + p.phase) * .05; }
  };
  // A ghost cushion propped in the back corner of her tent (clear of where
  // her tail lies when she sleeps).
  T.ghost ??= canvasTexture(1024, 1024, drawGhostCushion);
  T.ghost.offset.set(0, 0);
  const ghostMat = new THREE.MeshStandardMaterial({map: T.ghost, roughness: .95});
  const cushion = mesh(pillowGeometry(.68, .66, .3), ghostMat, kitchen.bed);
  kitchen.mesh(pillowPiping(cushion.geometry), new THREE.MeshStandardMaterial({color: '#e6dcc7', roughness: .85}), cushion, {cast: false});
  // (Well inside the sloping canvas: checked against it point by point.)
  cushion.position.set(-.3, kitchen.bedTop + .3, -.62); cushion.rotation.set(-.12, .12, 0);
  // (It lives in the tent's own group; the decor shows and hides it too.)
  kitchen.ghostCushion = cushion;
  // Clementines in a stone bowl on the island.
  const bowl = new THREE.Group(); bowl.position.set(-2.55, ISLAND_TOP, .55); g.add(bowl);
  mesh(lathe([[0, 0], [.14, 0], [.22, .05], [.25, .13], [.24, .135], [.2, .07], [0, .06]], 32), new THREE.MeshStandardMaterial({color: '#cfc6b6', roughness: .85}), bowl);
  const orange = new THREE.MeshStandardMaterial({color: '#e8892f', roughness: .55});
  for (const [x, y, z] of [[-.07, .1, -.04], [.08, .1, .03], [.0, .1, .1], [-.03, .17, .03], [.06, .1, -.1]]) mesh(new THREE.SphereGeometry(.06, 14, 10), orange, bowl).position.set(x, y, z);
  stoolTowel(kitchen, g, new THREE.MeshStandardMaterial({map: canvasTexture(128, 128, (c, w, h) => { c.fillStyle = '#c8642a'; c.fillRect(0, 0, w, h); c.fillStyle = '#5d6b3a'; c.fillRect(0, h * .78, w, h * .08); }), roughness: 1}));
  return g;
}

// ---------------------------------------------------------------------------
// Christmas at the Beach House, the kitchen (from Orion's day and night
// pictures): a pine garland with warm fairy lights along the back of the top
// shelf, a burgundy velvet bow on the front of each end, a pine wreath with
// its own bow and lights on the glazing, pine boughs in a stoneware jug, a
// striped linen runner over the island's front with clementines in a brass
// bowl and walnuts, a striped towel on a stool, the brass lantern with pine
// and three champagne baubles on the counter, and a warm glow under both
// shelves in the evening. Everything stands behind or beside where she
// walks: the garland keeps to the back of the shelf (her lane is its front)
// and stops short of where she lands at the left; the bows hang on the
// shelf's front face, below its top (nothing in her way on the shelf).
// ---------------------------------------------------------------------------
function drawPineSprig(g, w, h) {
  const r = rng(211);
  g.clearRect(0, 0, w, h);
  g.lineCap = 'round';
  const greens = ['#1c3320', '#24402a', '#2e4f30', '#3a6038', '#16281a', '#4b7243'];
  // A twig with needles raked forward on both sides, thinning to its tip.
  const twig = (x0, y0, ang, len, wide) => {
    const n = Math.round(len / 2.6);
    for (let i = 0; i <= n; i++) {
      const u = i / n, bend = Math.sin(u * 2.2) * .12, a = ang + bend;
      const x = x0 + Math.sin(a) * len * u, y = y0 - Math.cos(a) * len * u;
      for (const side of [-1, 1]) {
        const na = a + side * (.38 + r() * .42), nl = wide * (1 - u * .5) * (.75 + r() * .5);
        g.strokeStyle = greens[Math.floor(r() * greens.length)]; g.lineWidth = w / 230 * (.9 + r() * .6);
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.sin(na) * nl, y - Math.cos(na) * nl); g.stroke();
      }
    }
    g.strokeStyle = '#4a3a22'; g.lineWidth = w / 90;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + Math.sin(ang) * len * .8, y0 - Math.cos(ang) * len * .8); g.stroke();
  };
  twig(w * .5, h * .99, 0, h * .92, w * .2);
  twig(w * .5, h * .78, -.62, h * .5, w * .16); twig(w * .5, h * .68, .58, h * .52, w * .16);
  twig(w * .5, h * .5, -.5, h * .36, w * .13); twig(w * .5, h * .42, .55, h * .34, w * .13);
}

// Alabaster: creamy stone with soft honey clouds and a few wandering veins
// (it wraps round a lamp shade, so the left and right edges meet).
function drawAlabaster(g, w, h) {
  const r = rng(131);
  g.fillStyle = '#f3e4c8'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 90; i++) {
    const x = r() * w, y = r() * h, rad = 20 + r() * 70, warm = r() < .6;
    for (const dx of [-w, 0, w]) {
      const grd = g.createRadialGradient(x + dx, y, 0, x + dx, y, rad);
      grd.addColorStop(0, warm ? `rgba(196,134,66,${.16 + r() * .2})` : `rgba(255,250,236,${.2 + r() * .2})`); grd.addColorStop(1, 'rgba(230,190,130,0)');
      g.fillStyle = grd; g.fillRect(x + dx - rad, y - rad, rad * 2, rad * 2);
    }
  }
  g.lineCap = 'round';
  for (let i = 0; i < 22; i++) {
    let x = r() * w, y = r() * h, a = r() * Math.PI * 2;
    g.strokeStyle = `rgba(140,84,38,${.22 + r() * .3})`; g.lineWidth = 1 + r() * 3;
    for (const dx of [-w, 0, w]) {
      const rr = rng(500 + i); let px = x + dx, py = y, pa = a;
      g.beginPath(); g.moveTo(px, py);
      for (let k = 0; k < 26; k++) { pa += (rr() - .5) * .9; px += Math.cos(pa) * 11; py += Math.sin(pa) * 7; g.lineTo(px, py); }
      g.stroke();
    }
  }
}

// A round mat of braided jute, coiled from the middle out.
function drawWovenMat(g, w, h) {
  const r = rng(151), cx = w / 2, cy = h / 2, R = w / 2;
  g.fillStyle = '#9c7b4a'; g.fillRect(0, 0, w, h);
  const tones = ['#b8935a', '#a9844d', '#c4a26a', '#9f7a45'], band = R / 17;
  for (let k = 17; k >= 1; k--) {
    const rad = k * band - band / 2;
    g.strokeStyle = tones[k % tones.length]; g.lineWidth = band * .9;
    g.beginPath(); g.arc(cx, cy, rad, 0, Math.PI * 2); g.stroke();
    // (The braid: short slanted strands along each coil, and a dark seam between coils.)
    const n = Math.round(rad * Math.PI * 2 / (band * .55));
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2, slant = (k % 2 ? 1 : -1) * .5;
      const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad, ca = Math.cos(a + slant), sa = Math.sin(a + slant);
      g.strokeStyle = r() < .5 ? 'rgba(110,84,46,.4)' : 'rgba(240,226,190,.4)'; g.lineWidth = band * .13;
      g.beginPath(); g.moveTo(x - ca * band * .36, y - sa * band * .36); g.lineTo(x + ca * band * .36, y + sa * band * .36); g.stroke();
    }
    g.strokeStyle = 'rgba(70,48,24,.65)'; g.lineWidth = band * .12;
    g.beginPath(); g.arc(cx, cy, k * band, 0, Math.PI * 2); g.stroke();
  }
}

// Pale oak for chopping boards: long grain, a few darker streaks.
function drawBoardWood(g, w, h) {
  const r = rng(171);
  g.fillStyle = '#b98a57'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 70; i++) {
    const x = r() * w;
    g.strokeStyle = r() < .5 ? `rgba(120,78,40,${.1 + r() * .22})` : `rgba(226,188,134,${.1 + r() * .2})`; g.lineWidth = .6 + r() * 2.4;
    g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + (r() - .5) * 10, h * .3, x + (r() - .5) * 10, h * .7, x + (r() - .5) * 6, h); g.stroke();
  }
}

// Pine sprigs along a path: flat cards of the sprig, each rooted on the path
// and pointing along it one way or the other, splayed out. `out(p)` gives
// the directions they may splay toward (so none grow into a wall or shelf).
function pineAlong(parent, mat, pts, {count, size = .42, spread = .7, jitter = .05, seed = 5, out = null}) {
  const r = rng(seed), curve = new THREE.CatmullRomCurve3(pts), geo = new THREE.PlaneGeometry(size * .8, size);
  geo.translate(0, size / 2, 0);
  const inst = new THREE.InstancedMesh(geo, mat, count);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), q2 = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), d = new THREE.Vector3(), s = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const u = (i + r()) / count, p = curve.getPointAt(Math.min(1, u)), tan = curve.getTangentAt(Math.min(1, u));
    let side;
    for (let k = 0; k < 12; k++) {
      side = new THREE.Vector3(r() - .5, r() - .5, r() - .5).normalize();
      side.addScaledVector(tan, -side.dot(tan)).normalize();
      if (!out || out(side, p)) break;
    }
    d.copy(tan).multiplyScalar(r() < .5 ? 1 : -1).addScaledVector(side, spread * (.5 + r())).normalize();
    q.setFromUnitVectors(Y, d); q2.setFromAxisAngle(Y, r() * Math.PI * 2); q.multiply(q2);
    p.addScaledVector(side, jitter * r());
    m4.compose(p, q, s.setScalar(.7 + r() * .55));
    inst.setMatrixAt(i, m4);
  }
  inst.castShadow = true; inst.receiveShadow = true;
  parent.add(inst);
  return inst;
}

// A strip of ribbon: `n` rows from centre(u), each `width(u)` wide along
// across(u), puffed a little along its normal in the middle.
function ribbonStrip(n, centre, across, width, puff = 0) {
  const COLS = 5, pos = [], idx = [], c = new THREE.Vector3(), a = new THREE.Vector3(), nx = new THREE.Vector3(), t = new THREE.Vector3();
  for (let i = 0; i <= n; i++) {
    const u = i / n; centre(u, c); across(u, a).normalize();
    centre(Math.min(1, u + .01), t).sub(centre(Math.max(0, u - .01), nx)); nx.crossVectors(a, t).normalize();
    for (let j = 0; j < COLS; j++) {
      const v = j / (COLS - 1) - .5, w = width(u, v);
      pos.push(c.x + a.x * v * w + nx.x * puff * (.25 - v * v) * 4, c.y + a.y * v * w + nx.y * puff * (.25 - v * v) * 4, c.z + a.z * v * w + nx.z * puff * (.25 - v * v) * 4);
    }
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < COLS - 1; j++) { const k = i * COLS + j; idx.push(k, k + COLS, k + 1, k + 1, k + COLS, k + COLS + 1); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  return geo;
}

// A velvet bow, facing +z: two fat loops, a knot and two tails with
// swallow-tail ends. `size` is about the width of one loop.
function velvetBow(kitchen, parent, mat, size = .3, tail = 1.6) {
  const bow = new THREE.Group(); parent.add(bow);
  const mesh = (geo, rot = 0) => { const m = kitchen.mesh(geo, mat, bow, {cast: false}); m.rotation.z = rot; return m; };
  const up = new THREE.Vector3(0, 1, 0);
  for (const side of [-1, 1]) {
    // (A loop: out along the front, round and back behind, pinched at the knot.)
    const loop = ribbonStrip(26, (u, c) => { const a = u * Math.PI * 2; return c.set(side * size * (1 - Math.cos(a)) / 2, -size * .1 * Math.sin(a / 2), size * .3 * Math.sin(a)); },
      (u, a) => a.copy(up), u => size * (.22 + .5 * Math.pow(Math.sin(u * Math.PI), .6)), side * size * .06);
    mesh(loop, side * .3);
    const len = size * tail * (side < 0 ? 1 : .88);
    const t = ribbonStrip(18, (u, c) => c.set(side * (size * .08 + size * .42 * u + Math.sin(u * 3) * size * .05), -u * len, size * (.1 + .06 * Math.sin(u * 5 + side))),
      (u, a) => a.set(1, side * .35, .25 * Math.sin(u * 4)), (u, v) => size * (.36 + .12 * u), size * .03);
    // (The swallow-tail: the middle of the hem cut up into it.)
    const p = t.attributes.position, last = 18 * 5;
    for (let j = 0; j < 5; j++) p.setY(last + j, p.getY(last + j) + size * .22 * (1 - Math.abs(j - 2) / 2));
    t.computeVertexNormals();
    mesh(t);
  }
  const knot = kitchen.mesh(new THREE.SphereGeometry(size * .2, 14, 10), mat, bow, {cast: false});
  knot.scale.set(.9, 1.15, .8); knot.position.z = size * .08;
  return bow;
}

const pineTexture = room => room.pineTex ??= canvasTexture(512, 512, drawPineSprig);

function buildStudyChristmas(room) {
  const f = room.fireplace, y = room.mantelTop, g = new THREE.Group(), r = rng(301);
  f.add(g);
  const pine = new THREE.MeshStandardMaterial({map: pineTexture(room), alphaTest: .4, side: THREE.DoubleSide, roughness: .8});
  const stoneware = new THREE.MeshStandardMaterial({color: '#efe7d6', roughness: .7});
  const at = new THREE.Vector3(.62, y, .26);
  room.mesh(lathe([[0, 0], [.09, 0], [.14, .1], [.13, .22], [.07, .3], [.08, .34], [0, .34]], 24), stoneware, g).position.copy(at);
  const berry = new THREE.MeshStandardMaterial({color: '#8c1c22', roughness: .5});
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2 + r() * .5, tilt = i < 3 ? .1 + r() * .2 : .5 + r() * .45, len = .42 + r() * .3;
    const dir = new THREE.Vector3(Math.cos(a) * Math.sin(tilt), Math.cos(tilt), Math.abs(Math.sin(a)) * Math.sin(tilt) * .8);
    const from = at.clone().setY(y + .33), mid = from.clone().addScaledVector(dir, len * .55), end = from.clone().addScaledVector(dir, len); end.y -= len * .2;
    pineAlong(g, pine, [from, mid, end], {count: 13, size: .3, spread: .6, jitter: .02, seed: 311 + i});
    if (i % 2) room.mesh(new THREE.SphereGeometry(.028, 10, 8), berry, g, {cast: false}).position.copy(mid).add(new THREE.Vector3(0, .05, .05));
  }
  const {halo, flame} = brassLantern(room, g, 1.08, .28, y);
  room.xmasCandle = halo; room.xmasFlame = flame;
  return [g];
}

function kitchenChristmas(kitchen, T) {
  const g = kitchenPart(kitchen), M = kitchen.materials;
  const mesh = (geo, mat, parent = g, opts) => kitchen.mesh(geo, mat, parent, opts);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const BACK = -4.2, S2 = 5.5, SHELF_FRONT = -3.3;
  const pine = new THREE.MeshStandardMaterial({map: pineTexture(kitchen.room), alphaTest: .4, side: THREE.DoubleSide, roughness: .8});
  const velvet = new THREE.MeshStandardMaterial({color: '#7c1426', roughness: .95, side: THREE.DoubleSide});
  const lights = []; // where the fairy lights sit

  // The garland, along the back of the top shelf (her lane is the front),
  // from just past where she lands to the right-hand end, then down past it.
  const along = [];
  for (let x = -3.95; x <= 3.31; x += .605) along.push(V(x, S2 + .13 + Math.sin(x * 2.3) * .03, BACK + .2 + Math.sin(x * 1.7) * .03));
  // (Up and forward only: not into the wall or down into the shelf.)
  const shelfOut = d => d.z > -.15 && d.z < .55 && d.y > -.25;
  pineAlong(g, pine, along, {count: 420, size: .52, spread: .8, jitter: .08, seed: 11, out: shelfOut});
  const drop = [V(3.3, S2 + .12, BACK + .22), V(3.47, S2 + .02, BACK + .3), V(3.52, S2 - .4, BACK + .32), V(3.5, S2 - .85, BACK + .3)];
  pineAlong(g, pine, drop, {count: 44, size: .42, spread: .55, seed: 13, out: d => d.z > -.1 && d.x > -.3});
  const r = rng(71), gc = new THREE.CatmullRomCurve3(along);
  for (let i = 0; i < 42; i++) { const p = gc.getPointAt((i + .2 + r() * .6) / 42); lights.push(p.add(V((r() - .5) * .1, .05 + r() * .2, .14 + r() * .16))); }
  const dc = new THREE.CatmullRomCurve3(drop);
  for (let i = 0; i < 6; i++) lights.push(dc.getPointAt((i + .5) / 6).add(V(.06, 0, .1)));

  // A velvet bow on the shelf's front face at each end, a few sprigs behind it.
  for (const x of [-4.85, 3.12]) {
    const b = velvetBow(kitchen, g, velvet, .32, 1.35);
    b.position.set(x, S2 - .2, SHELF_FRONT + .09);
    pineAlong(g, pine, [V(x - .32, S2 - .2, SHELF_FRONT + .04), V(x, S2 - .17, SHELF_FRONT + .05), V(x + .32, S2 - .2, SHELF_FRONT + .04)], {count: 12, size: .3, spread: .5, seed: 17 + x, out: d => d.z > .1 && d.y < 0});
  }

  // The wreath on the glazing, hung by its ribbon, with its bow at the top.
  const WX = -5.84, WY = 5.75, WZ = -1.6, WR = .56, ring = [];
  for (let i = 0; i <= 16; i++) { const a = i / 16 * Math.PI * 2; ring.push(V(WX, WY + Math.sin(a) * WR, WZ + Math.cos(a) * WR)); }
  const wc = new THREE.CatmullRomCurve3(ring.slice(0, -1), true);
  pineAlong(g, pine, wc.getSpacedPoints(48), {count: 170, size: .4, spread: .6, jitter: .05, seed: 23, out: d => d.x > 0});
  for (let i = 0; i < 16; i++) { const a = (i + r() * .7) / 16 * Math.PI * 2, rr = WR + (r() - .5) * .16; lights.push(V(WX + .13 + r() * .06, WY + Math.sin(a) * rr, WZ + Math.cos(a) * rr)); }
  const wb = velvetBow(kitchen, g, velvet, .34, 2.6);
  wb.position.set(WX + .16, WY + WR - .02, WZ); wb.rotation.y = Math.PI / 2;
  mesh(new THREE.BoxGeometry(.012, 2.1, .09), velvet, g, {cast: false}).position.set(WX - .04, WY + WR + 1.05, WZ);

  // Pine boughs in a cream stoneware jug, on the island where the orchid stands.
  const stoneware = new THREE.MeshStandardMaterial({color: '#efe7d6', roughness: .7});
  const jug = new THREE.Group(); jug.position.set(-3.25, ISLAND_TOP, .3); jug.scale.setScalar(1.35); g.add(jug);
  mesh(lathe([[0, 0], [.13, 0], [.17, .08], [.18, .2], [.13, .34], [.11, .4], [.13, .46], [.12, .47], [.09, .4], [0, .4]], 32), stoneware, jug);
  const handle = mesh(new THREE.TorusGeometry(.09, .022, 8, 16, Math.PI * 1.1), stoneware, jug);
  handle.position.set(-.16, .27, 0); handle.rotation.z = Math.PI / 2 + .1;
  const twigMat = new THREE.MeshStandardMaterial({color: '#4f3d26', roughness: .9});
  const bough = (parent, from, dir, len, seed, size = .4, droop = .35) => {
    const mid = from.clone().addScaledVector(dir, len * .55), end = from.clone().addScaledVector(dir, len); end.y -= len * droop;
    const pts = [from, mid, end];
    mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 8, .012, 5), twigMat, parent, {cast: false});
    pineAlong(parent, pine, pts, {count: Math.round(len * 26), size, spread: .6, jitter: .02, seed});
  };
  for (let i = 0; i < 11; i++) {
    const a = i / 11 * Math.PI * 2 + r() * .4, tilt = i < 3 ? .15 + r() * .2 : .55 + r() * .5;
    bough(jug, V(0, .42, 0), V(Math.cos(a) * Math.sin(tilt), Math.cos(tilt), Math.sin(a) * Math.sin(tilt)), .5 + r() * .3, 31 + i, .34, i < 3 ? .05 : .3);
  }

  // The linen runner: across the island's left half and over its front edge.
  {
    const W = 1.5, L = 2.05, FRONT = 1.95, z0 = .32, R = .035, geo = new THREE.PlaneGeometry(W, L, 12, 40), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i) / W, sAlong = (.5 - p.getY(i) / L) * L, flat = FRONT - z0;
      let y, z;
      if (sAlong < flat) { y = .008; z = z0 + sAlong; }
      else if (sAlong < flat + Math.PI / 2 * R) { const a = (sAlong - flat) / R; y = .008 - R + Math.cos(a) * R; z = FRONT + Math.sin(a) * R; }
      else { const dd = sAlong - flat - Math.PI / 2 * R; y = .008 - R - dd; z = FRONT + R + Math.sin(u * 9 + 1) * .012 * Math.min(1, dd * 6); }
      p.setXYZ(i, u * W, y, z);
    }
    geo.computeVertexNormals();
    const runner = mesh(geo, new THREE.MeshStandardMaterial({map: T.runner, roughness: 1, side: THREE.DoubleSide}), g, {cast: false});
    runner.position.set(-2.75, ISLAND_TOP, 0);
  }
  // Clementines with their leaves in a brass bowl, and walnuts beside it.
  const bowl = new THREE.Group(); bowl.position.set(-2.55, ISLAND_TOP + .01, 1.2); g.add(bowl);
  mesh(lathe([[0, 0], [.16, 0], [.27, .06], [.31, .15], [.3, .155], [.25, .075], [0, .065]], 32), M.brass, bowl);
  const orange = new THREE.MeshStandardMaterial({color: '#ea8a2c', roughness: .5}), leaf = new THREE.MeshStandardMaterial({color: '#3f6a2c', roughness: .7, side: THREE.DoubleSide});
  for (const [x, y, z] of [[-.1, .12, -.05], [.1, .12, .03], [0, .12, .12], [-.02, .2, .02], [.07, .12, -.12], [-.13, .12, .1]]) {
    mesh(new THREE.SphereGeometry(.075, 16, 12), orange, bowl).position.set(x, y, z);
  }
  for (const [x, y, z, ry, rz] of [[-.02, .285, .02, .4, .5], [.04, .28, .0, 2.4, .6], [.13, .2, .05, 1.2, .9]]) {
    const lf = mesh(new THREE.CircleGeometry(.06, 10), leaf, bowl, {cast: false}); lf.scale.set(.45, 1, 1); lf.position.set(x, y, z); lf.rotation.set(-1.1, ry, rz);
  }
  const nut = new THREE.MeshStandardMaterial({color: '#8a6238', roughness: .85});
  for (const [x, z] of [[-3.02, 1.42], [-2.93, 1.5], [-3.08, 1.55], [-2.97, 1.62]]) { const n = mesh(new THREE.SphereGeometry(.042, 10, 8), nut); n.position.set(x, ISLAND_TOP + .05, z); n.scale.y = .9; }
  stoolTowel(kitchen, g, new THREE.MeshStandardMaterial({map: T.cushion, roughness: 1}));

  // On the counter by the range: the brass lantern, pine sprigs and three
  // champagne baubles.
  const {halo, flame} = brassLantern(kitchen, g, 3.42, -3.3);
  kitchen.xmasHalo = halo; kitchen.xmasFlame = flame;
  const sprigs = new THREE.Group(); sprigs.position.set(2.75, COUNTER_TOP + .03, -3.25); g.add(sprigs);
  for (const [a, len] of [[.3, .5], [2.6, .45], [1.4, .35], [4.4, .4]]) bough(sprigs, V(0, .02, 0), V(Math.cos(a), .12, Math.sin(a)).normalize(), len, 51 + a, .3, .1);
  const bauble = new THREE.MeshStandardMaterial({color: '#e9d6a6', metalness: .55, roughness: .22, emissive: '#5a4520', emissiveIntensity: .35});
  for (const [x, z, rad] of [[2.62, -2.98, .075], [2.8, -2.92, .06], [2.93, -3.02, .07]]) {
    mesh(new THREE.SphereGeometry(rad, 20, 14), bauble).position.set(x, COUNTER_TOP + rad, z);
    mesh(new THREE.CylinderGeometry(rad * .22, rad * .22, rad * .25, 8), M.brass, g, {cast: false}).position.set(x, COUNTER_TOP + rad * 2, z);
  }

  // The fairy lights: little warm bulbs, and a soft glow round each that
  // comes up in the evening.
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(.021, 8, 6), new THREE.MeshBasicMaterial({color: '#ffe3ae'}), lights.length), m4 = new THREE.Matrix4();
  lights.forEach((p, i) => bulbs.setMatrixAt(i, m4.makeTranslation(p.x, p.y, p.z)));
  g.add(bulbs);
  const glowTex = canvasTexture(64, 64, (c, w, h) => {
    const grd = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grd.addColorStop(0, 'rgba(255,225,165,1)'); grd.addColorStop(.25, 'rgba(255,190,105,.55)'); grd.addColorStop(1, 'rgba(255,150,60,0)');
    c.fillStyle = grd; c.fillRect(0, 0, w, h);
  });
  const glowMat = new THREE.PointsMaterial({map: glowTex, size: .3, sizeAttenuation: true, transparent: true, opacity: .3, blending: THREE.AdditiveBlending, depthWrite: false});
  const glowGeo = new THREE.BufferGeometry().setFromPoints(lights);
  const glow = new THREE.Points(glowGeo, glowMat); glow.frustumCulled = false; g.add(glow);

  // The glow under the shelves in the evening: light washing down the wall.
  const washTex = canvasTexture(8, 64, (c, w, h) => {
    const grd = c.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, 'rgba(255,170,90,1)'); grd.addColorStop(.25, 'rgba(255,150,70,.5)'); grd.addColorStop(1, 'rgba(255,140,60,0)');
    c.fillStyle = grd; c.fillRect(0, 0, w, h);
  });
  const washMat = new THREE.MeshBasicMaterial({map: washTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false});
  const stripMat = new THREE.MeshBasicMaterial({color: '#ffdca8', transparent: true, opacity: 0});
  for (const y of [4.1, S2]) {
    const wash = mesh(new THREE.PlaneGeometry(8.5, 1.25), washMat, g, {cast: false, receive: false});
    wash.position.set(-.9, y - .09 - .625, BACK + .015);
    const strip = mesh(new THREE.BoxGeometry(8.4, .015, .03), stripMat, g, {cast: false, receive: false});
    strip.position.set(-.9, y - .1, BACK + .06);
  }
  // Low winter sun through the garden's trees: dappled light across the
  // floor and up the far wall by day.
  const dapple = canvasTexture(512, 512, (c, w, h) => {
    const rr = rng(97);
    c.fillStyle = '#000'; c.fillRect(0, 0, w, h);
    c.translate(w / 2, h / 2); c.rotate(-.45); c.translate(-w / 2, -h / 2);
    for (let i = 0; i < 420; i++) {
      const x = rr() * w * 1.4 - w * .2, y = rr() * h * 1.4 - h * .2, rad = 7 + rr() * 22, a = .25 + rr() * .5;
      const grd = c.createRadialGradient(x, y, 0, x, y, rad);
      grd.addColorStop(0, `rgba(255,216,160,${a})`); grd.addColorStop(.6, `rgba(255,205,140,${a * .5})`); grd.addColorStop(1, 'rgba(255,200,130,0)');
      c.fillStyle = grd; c.beginPath(); c.ellipse(x, y, rad * 1.5, rad * .8, .3, 0, Math.PI * 2); c.fill();
    }
    // (The glazing bars' shadows across it.)
    c.fillStyle = 'rgba(0,0,0,.8)';
    for (let x = -w * .2; x < w * 1.3; x += w / 6) c.fillRect(x, -h, w * .022, h * 3);
    for (let y = -h * .2; y < h * 1.3; y += h / 3.2) c.fillRect(-w, y, w * 3, h * .02);
  });
  const dappleMat = new THREE.MeshBasicMaterial({map: dapple, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false});
  const sunFloor = mesh(new THREE.PlaneGeometry(12.6, 8.4), dappleMat, g, {cast: false, receive: false});
  sunFloor.rotation.x = -Math.PI / 2; sunFloor.position.set(.4, .022, .3);
  const wallMat = dappleMat.clone(); wallMat.map = dapple;
  const sunWall = mesh(new THREE.PlaneGeometry(8.4, 6.5), wallMat, g, {cast: false, receive: false});
  sunWall.rotation.y = -Math.PI / 2; sunWall.position.set(6.97, 3.6, .2);
  // In the evening, pools of lamplight on the floor and the island.
  const poolTex = canvasTexture(64, 64, (c, w, h) => {
    const grd = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grd.addColorStop(0, 'rgba(255,190,110,.9)'); grd.addColorStop(.5, 'rgba(255,170,90,.35)'); grd.addColorStop(1, 'rgba(255,160,80,0)');
    c.fillStyle = grd; c.fillRect(0, 0, w, h);
  });
  const poolMat = new THREE.MeshBasicMaterial({map: poolTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false});
  for (const [x, y, z, sx, sz] of [[-1.2, .024, 3.4, 7, 3.6], [3.6, .024, 1.6, 4.5, 4], [-1.2, ISLAND_TOP + .012, .7, 4.6, 2.2], [-1, COUNTER_TOP + .012, -3.4, 8, 1.3]]) {
    const pool = mesh(new THREE.PlaneGeometry(sx, sz), poolMat, g, {cast: false, receive: false});
    pool.rotation.x = -Math.PI / 2; pool.position.set(x, y, z);
  }

  // The three hanging lamps: alabaster shades lit from inside, on brass
  // arms. Their shape and place stay (she rides the big one): the stone,
  // a brass band round each, and a warm halo in the evening are what change.
  const alabTex = canvasTexture(512, 256, drawAlabaster);
  const alabaster = new THREE.MeshStandardMaterial({map: alabTex, emissive: '#ffb563', emissiveMap: alabTex, emissiveIntensity: .4, roughness: .4, side: THREE.DoubleSide});
  const lampHalo = glowHalo('rgba(255,205,135,.9)', 'rgba(255,165,80,.3)');
  const fittings = [], arms = [];
  kitchen.mobile.traverse(o => { if (o.isMesh && o.material === M.iron) arms.push(o); });
  const bandGeo = new THREE.TorusGeometry(.497, .016, 8, 48); bandGeo.rotateX(Math.PI / 2);
  kitchen.shades.forEach((sh, i) => {
    const band = mesh(bandGeo, M.brass, sh, {cast: false}); band.scale.y = 2.2; band.position.y = .02; fittings.push(band);
    // (A brass cap where the rod meets the stone; not on the big one, whose top is her seat.)
    if (i) { const cap = mesh(new THREE.SphereGeometry(.09, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.brass, sh, {cast: false}); cap.scale.y = 1.6; cap.position.y = .47; fittings.push(cap); }
    const halo = new THREE.Sprite(lampHalo); halo.scale.set(2.5, 5.2, 1); sh.add(halo); fittings.push(halo);
  });
  kitchen.xmasLamps = {alabaster, arms, fittings};

  // Her corner: a big round woven mat under the tent (her fountain and
  // bowl have their own mats already), lying flat on the floor (nothing
  // to walk round, nothing for the vacuum to meet), and a plaid cushion
  // propped in the back of the tent.
  const tentMat = mesh(new THREE.CircleGeometry(1.78, 56), new THREE.MeshStandardMaterial({map: canvasTexture(512, 512, drawWovenMat), roughness: 1}), g, {cast: false});
  tentMat.rotation.set(-Math.PI / 2, 0, .3); tentMat.position.set(4.75, .004, .75);
  const plaid = new THREE.MeshStandardMaterial({map: kitchen.room.decorOriginal?.bedMap ?? kitchen.room.materials.plaidBed.map, roughness: .95});
  const cushion = mesh(pillowGeometry(.68, .66, .3), plaid, kitchen.bed);
  kitchen.mesh(pillowPiping(cushion.geometry), new THREE.MeshStandardMaterial({color: '#2b3a2a', roughness: .85}), cushion, {cast: false});
  // (Where the Halloween ghost cushion sits: checked clear of the canvas and of her tail asleep.)
  cushion.position.set(-.3, kitchen.bedTop + .3, -.62); cushion.rotation.set(-.12, .12, 0);
  kitchen.xmasCushion = cushion;

  // The shelves, dressed a little more like the pictures, all at the back
  // (her lane along the front stays clear), away from where she lands and
  // naps, and beside (never in place of) the things she pats off.
  const S1 = 4.1, SZ = BACK + .33;
  const boardWood = new THREE.MeshStandardMaterial({map: canvasTexture(128, 256, drawBoardWood), roughness: .55});
  const paleWood = new THREE.MeshStandardMaterial({map: boardWood.map, color: '#f1dcbb', roughness: .6});
  // Lower shelf, the open stretch over the sink: two boards leaning on the
  // wall, a stack of bowls, and a few books by the glasses.
  const tall = mesh(roundedBox(.44, .78, .045, .03), boardWood, g); tall.position.set(-1.5, S1 + .385, BACK + .1); tall.rotation.x = -.12;
  const roundB = new THREE.Group(); roundB.position.set(-1.12, S1, BACK + .2); roundB.rotation.set(-.14, 0, .05); g.add(roundB);
  const disc = mesh(new THREE.CylinderGeometry(.25, .25, .04, 40), paleWood, roundB); disc.rotation.x = Math.PI / 2; disc.position.y = .25;
  mesh(roundedBox(.08, .2, .038, .02), paleWood, roundB).position.y = .57;
  const bowlOf = (rad, mat, parent) => mesh(lathe([[0, 0], [rad * .5, 0], [rad, rad * .55], [rad * .95, rad * .56], [rad * .45, rad * .05], [0, rad * .05]], 24), mat, parent);
  const sage = new THREE.MeshStandardMaterial({color: '#93a487', roughness: .5});
  [[.21, M.cream], [.195, M.ivory], [.18, sage]].forEach(([rad, mat], i) => bowlOf(rad, mat, g).position.set(-.5, S1 + i * .05, SZ));
  [['#6e1f26', .46], ['#2f4a36', .5], ['#e6dcc6', .42]].forEach(([c, hgt], i) => {
    const b = mesh(new THREE.BoxGeometry(.075, hgt, .32), new THREE.MeshStandardMaterial({color: c, roughness: .8}), g); b.position.set(.93 + i * .082, S1 + hgt / 2, SZ - .02);
    if (i === 2) { b.rotation.z = -.16; b.position.x += .05; b.position.y -= .01; }
  });
  // Top shelf: books lying flat with a little bowl on them, between the
  // cobalt vessel and the plates; a framed pine print by the books.
  [['#2f4a36', .4], ['#cdbb98', .36], ['#6e1f26', .33]].forEach(([c, wid], i) => {
    const b = mesh(new THREE.BoxGeometry(wid, .065, .28), new THREE.MeshStandardMaterial({color: c, roughness: .8}), g); b.position.set(-1.12 + i * .012, S2 + .0325 + i * .066, SZ + .02); b.rotation.y = (i - 1) * .09;
  });
  bowlOf(.12, M.brass, g).position.set(-1.1, S2 + .2, SZ + .02);
  const print = new THREE.Group(); print.position.set(2.14, S2, BACK + .34); print.rotation.x = -.1; g.add(print);
  const pw = .44, ph = .6;
  mesh(roundedBox(pw, ph, .04, .01), paleWood, print).position.y = ph / 2;
  mesh(new THREE.PlaneGeometry(pw * .84, ph * .87), new THREE.MeshStandardMaterial({map: canvasTexture(256, 340, (c, w, h) => {
    drawPineSprig(c, w, h);
    c.globalCompositeOperation = 'destination-over'; c.fillStyle = '#f4eddd'; c.fillRect(0, 0, w, h);
    c.globalCompositeOperation = 'source-over'; c.strokeStyle = 'rgba(120,100,70,.35)'; c.lineWidth = 2; c.strokeRect(w * .07, h * .06, w * .86, h * .88);
  }), roughness: .9}), print, {cast: false}).position.set(0, ph / 2, .022);

  // On the counter: a stoneware jar of utensils where the crock stands, and
  // a little pine in a clay pot where the olive does (both put away for
  // Christmas; see applyKitchenDecor).
  const jar = new THREE.Group(); jar.position.set(2.95, COUNTER_TOP, -3.75); jar.scale.setScalar(1.12); g.add(jar);
  mesh(lathe([[0, 0], [.15, 0], [.185, .05], [.185, .34], [.165, .39], [.175, .42], [.16, .42], [.15, .39], [0, .39]], 28), stoneware, jar);
  mesh(new THREE.CylinderGeometry(.187, .187, .035, 28, 1, true), sage, jar, {cast: false}).position.y = .27;
  const utensil = (lean, turn, len, head) => {
    const u = new THREE.Group(); u.position.y = .1; u.rotation.set(0, turn, 0); jar.add(u);
    const stick = new THREE.Group(); stick.rotation.z = lean; u.add(stick);
    mesh(new THREE.CylinderGeometry(.013, .017, len, 8), head === 'whisk' || head === 'ladle' ? M.brass : paleWood, stick).position.y = len / 2;
    if (head === 'spoon') { const h = mesh(new THREE.SphereGeometry(.06, 14, 10), paleWood, stick); h.scale.set(1, 1.5, .35); h.position.y = len + .06; }
    if (head === 'spatula') mesh(roundedBox(.11, .17, .014, .02), boardWood, stick).position.y = len + .07;
    if (head === 'ladle') { const h = mesh(new THREE.SphereGeometry(.07, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M.brass, stick); h.position.set(.05, len + .03, 0); h.rotation.z = -.5; }
    if (head === 'whisk') for (let k = 0; k < 4; k++) { const loop = mesh(new THREE.TorusGeometry(.05, .005, 5, 18), M.brass, stick, {cast: false}); loop.scale.y = 2; loop.position.y = len + .09; loop.rotation.y = k * Math.PI / 4; }
  };
  utensil(.2, 0, .62, 'spoon'); utensil(.16, 1.4, .7, 'spatula'); utensil(.14, 2.9, .56, 'whisk'); utensil(.18, 4.3, .66, 'spoon'); utensil(.1, 5.4, .6, 'ladle');
  const tree = new THREE.Group(); tree.position.set(-.55, COUNTER_TOP, -3.85); g.add(tree);
  mesh(lathe([[0, 0], [.14, 0], [.19, .26], [.205, .27], [.2, .3], [0, .3]], 24), M.clay, tree);
  mesh(new THREE.CylinderGeometry(.175, .175, .02, 20), new THREE.MeshStandardMaterial({color: '#3a2a1c', roughness: 1}), tree, {cast: false}).position.y = .285;
  mesh(new THREE.CylinderGeometry(.014, .022, .95, 6), twigMat, tree, {cast: false}).position.y = .3 + .475;
  // (Tiers of short boughs, wide at the bottom, closing to a point: a little fir.)
  for (let k = 0; k < 9; k++) {
    const n = 9 - Math.floor(k * .6), y = .4 + k * .085, len = .34 - k * .033;
    for (let j = 0; j < n; j++) {
      const a = (j + (k % 2) * .5) / n * Math.PI * 2 + r() * .3, pts = [V(0, y, 0), V(Math.cos(a) * len * .55, y - .02, Math.sin(a) * len * .55), V(Math.cos(a) * len, y - .1, Math.sin(a) * len)];
      pineAlong(tree, pine, pts, {count: 9, size: .24, spread: .5, jitter: .02, seed: 401 + k * 11 + j});
    }
  }
  pineAlong(tree, pine, [V(0, 1.05, 0), V(.01, 1.2, 0), V(0, 1.34, .01)], {count: 10, size: .2, spread: .35, jitter: .01, seed: 499});
  let glowSize = .28;

  kitchen.updateChristmas = (dt, t, night) => {
    if (!g.visible) return;
    const k = 1 - Math.exp(-3 * dt), twinkle = 1 + Math.sin(t * 2.1) * .05 + Math.sin(t * 3.7) * .04;
    glowMat.opacity += ((night ? .95 : .3) - glowMat.opacity) * k; glowSize += ((night ? .5 : .28) - glowSize) * k; glowMat.size = glowSize * twinkle;
    washMat.opacity += ((night ? .3 : 0) - washMat.opacity) * k;
    stripMat.opacity += ((night ? 1 : 0) - stripMat.opacity) * k;
    dappleMat.opacity += ((night ? 0 : .42) - dappleMat.opacity) * k; wallMat.opacity = dappleMat.opacity * .45;
    poolMat.opacity += ((night ? .34 : 0) - poolMat.opacity) * k;
    alabaster.emissiveIntensity += ((night ? 1.05 : .35) - alabaster.emissiveIntensity) * k;
    lampHalo.opacity += ((night ? .8 : 0) - lampHalo.opacity) * k;
  };
  return g;
}
