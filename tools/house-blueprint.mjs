// Draws docs/house/blueprint.svg: the floor plans of Mochi's house.
// Sizes are in the app's own units, in the study's frame (x east, z south);
// the study and kitchen are where the code has them (room.js, kitchen.js, JOIN in app.js).
import {writeFileSync} from 'node:fs';
const S = 26, X0 = -20.4, Z0 = -13.4, W = 26.2, H = 26.6, M = .41; // px per unit, metres per unit
const px = x => ((x - X0) * S).toFixed(1), pz = z => ((z - Z0) * S).toFixed(1);
const C = {ink: '#2b3a4a', wall: '#2b3a4a', old: '#eef0f2', neu: '#fbe9d7', soft: '#7b8794', line: '#b9c2cc', accent: '#c8643c', sea: '#dcebf2', paper: '#fdfcf9'};
const rect = (x0, z0, x1, z1, o = {}) => `<rect x="${px(x0)}" y="${pz(z0)}" width="${((x1 - x0) * S).toFixed(1)}" height="${((z1 - z0) * S).toFixed(1)}" fill="${o.fill ?? 'none'}" stroke="${o.stroke ?? 'none'}" stroke-width="${o.w ?? 1.5}" ${o.dash ? `stroke-dasharray="${o.dash}"` : ''} rx="${o.rx ?? 0}"/>`;
const line = (x0, z0, x1, z1, o = {}) => `<line x1="${px(x0)}" y1="${pz(z0)}" x2="${px(x1)}" y2="${pz(z1)}" stroke="${o.stroke ?? C.wall}" stroke-width="${o.w ?? 5}" stroke-linecap="${o.cap ?? 'square'}" ${o.dash ? `stroke-dasharray="${o.dash}"` : ''}/>`;
const text = (x, z, s, o = {}) => `<text x="${px(x)}" y="${pz(z)}" font-size="${o.size ?? 13}" font-weight="${o.bold ? 700 : 400}" fill="${o.fill ?? C.ink}" text-anchor="${o.anchor ?? 'middle'}" ${o.italic ? 'font-style="italic"' : ''}>${s}</text>`;
const size = (x0, z0, x1, z1) => `${((x1 - x0) * M).toFixed(1)} x ${((z1 - z0) * M).toFixed(1)} m`;
const room = (name, x0, z0, x1, z1, o = {}) => rect(x0, z0, x1, z1, {fill: o.old ? C.old : C.neu}) +
  text(o.ax ?? (x0 + x1) / 2, (o.at ?? (z0 + z1) / 2), name, {bold: true, size: 16}) +
  text(o.ax ?? (x0 + x1) / 2, (o.at ?? (z0 + z1) / 2) + .7, size(x0, z0, x1, z1), {fill: C.soft, size: 12});
const thing = (label, x0, z0, x1, z1, o = {}) => rect(x0, z0, x1, z1, {fill: '#fff', stroke: C.soft, w: 1.2, rx: o.rx ?? 4}) + (label ? text((x0 + x1) / 2, (z0 + z1) / 2 + .15, label, {size: 11, fill: C.soft}) : '');
// A wall from a to b with openings [[from, to], ...] measured along it.
const wall = (x0, z0, x1, z1, gaps = [], o = {}) => {
  const len = Math.hypot(x1 - x0, z1 - z0), ux = (x1 - x0) / len, uz = (z1 - z0) / len;
  let at = 0, out = '';
  for (const [a, b] of [...gaps, [len, len]]) { if (a > at) out += line(x0 + ux * at, z0 + uz * at, x0 + ux * a, z0 + uz * a, o); at = b; }
  return out;
};
const open = (x0, z0, x1, z1) => line(x0, z0, x1, z1, {stroke: C.accent, w: 2, dash: '7 6', cap: 'butt'});
const win = (x0, z0, x1, z1) => line(x0, z0, x1, z1, {stroke: '#fff', w: 5, cap: 'butt'}) + line(x0, z0, x1, z1, {stroke: '#5aa0c8', w: 2.5, cap: 'butt'});
const stairs = (x0, z0, x1, z1, n, up) => {
  let s = rect(x0, z0, x1, z1, {fill: '#fff', stroke: C.soft, w: 1.2});
  for (let i = 1; i < n; i++) { const z = z0 + (z1 - z0) * i / n; s += line(x0, z, x1, z, {stroke: C.line, w: 1, cap: 'butt'}); }
  const xm = (x0 + x1) / 2, a = up ? z1 - .3 : z0 + .3, b = up ? z0 + .3 : z1 - .3;
  return s + line(xm, a, xm, b, {stroke: C.accent, w: 1.5, cap: 'butt'}) + `<circle cx="${px(xm)}" cy="${pz(b)}" r="3.5" fill="${C.accent}"/>`;
};
const panel = (title, sub, body) => `<svg x="0" y="0" width="${W * S}" height="${H * S + 70}"><text x="20" y="34" font-size="24" font-weight="700" fill="${C.ink}">${title}</text><text x="20" y="56" font-size="13" fill="${C.soft}">${sub}</text><g transform="translate(0 70)">${body}</g></svg>`;

// The outline both floors share.
const WX = -19.05, KX = -5.05, SX0 = -4.6, SX1 = 4.6, N = -9.9, KS = 6.1, SN = -3.4, S_ = 8.6, HS = 11.6;
const compass = `<g transform="translate(${px(3.6)} ${pz(-10.2)})"><line x1="0" y1="16" x2="0" y2="-16" stroke="${C.ink}" stroke-width="1.5"/><path d="M0 -22 l5 10 h-10 z" fill="${C.ink}"/><text x="0" y="-27" font-size="12" text-anchor="middle" fill="${C.ink}">sea</text></g>`;
const shell = gaps => // the outer walls (in the app, a wall the camera is behind hides)
  wall(WX, N, KX, N, gaps.north ?? []) + wall(KX, N, KX, SN, []) + wall(KX, SN, SX1, SN, gaps.studyNorth ?? []) + wall(SX1, SN, SX1, S_, gaps.east ?? []) +
  wall(SX1, S_, KX, S_, gaps.studySouth ?? []) + wall(KX, S_, KX, HS, []) + wall(KX, HS, WX, HS, gaps.south ?? []) + wall(WX, HS, WX, N, gaps.west ?? []);

const ground =
  rect(X0, Z0, X0 + W, N - 1.9, {fill: C.sea}) + text(-12, -12.4, 'dunes and sea', {fill: '#5a8ca6', italic: true, size: 12}) +
  rect(WX, N - 1.9, KX, N, {fill: '#efe8dc', stroke: C.line, w: 1}) + text(-12, N - .75, 'terrace (there today)', {size: 12, fill: C.soft}) +
  room('Kitchen', WX, N, KX, KS, {old: true, at: -1.2, ax: -15.6}) + room('Study', SX0, SN, SX1, S_, {old: true, at: 5}) + room('Hall', WX, KS, KX, HS, {at: 9.0, ax: -11.6}) +
  rect(KX, SN, SX0, S_, {fill: C.wall}) +
  thing('island', -11.2, -7.6, -8.7, -2.4) + thing('', -6.5, -9.1, -5.25, -.5) + text(-5.9, -4.7, 'counter', {size: 11, fill: C.soft}) + thing('tent', -10.9, -.1, -9.1, 1.7, {rx: 27}) +
  thing('rug', -2.25, -1.2, 1.45, 1.8) + thing('', 3.9, .2, 4.5, 2.0) + text(3.7, 1.25, 'fire', {size: 11, fill: C.soft, anchor: 'end'}) + thing('bed', -3.9, -3.0, -2.4, -1.8, {rx: 16}) +
  stairs(-8.4, 6.9, -6.9, 11.3, 10, true) + stairs(-6.7, 6.9, -5.25, 11.3, 10, false) + text(-6.8, 6.7, 'stairs up', {size: 11, fill: C.accent}) +
  thing('console', -17.6, 6.5, -15.0, 7.1) + thing('', -18.7, 7.6, -18.1, 10.4) + text(-17.9, 9.15, 'bench', {size: 11, fill: C.soft, anchor: 'start'}) +
  shell({north: [[4, 11]], studyNorth: [[3.6, 6.4]], south: [[7.2, 9.0]]}) + win(WX + 4, N, WX + 11, N) + win(KX + 3.6, SN, KX + 6.4, SN) +
  wall(SX0 - .22, SN, SX0 - .22, S_, [[3.3, 5.7]], {w: 11.7}) + wall(WX, KS, KX, KS, [[5.8, 8.2]]) +
  text(-12.05, 5.75, 'new doorway', {size: 11, fill: C.accent}) + text(-3.2, 1.3, 'doorway', {size: 11, fill: C.soft}) +
  text(-13.15, 12.4, 'front door', {size: 12, fill: C.accent}) + line(-14.05, HS, -12.25, HS, {stroke: C.accent, w: 5, cap: 'butt'}) + compass;

const upper =
  room('Bedroom', WX, N, KX, KS, {at: .2, ax: -13.6}) + room('Bathroom', SX0, SN, SX1, S_, {at: 5.6}) + room('Landing', WX, KS, -8.6, HS, {at: 8.6, ax: -12.6}) +
  rect(-8.6, KS, KX, HS, {fill: '#f3f1ec'}) + rect(KX, SN, SX0, S_, {fill: C.wall}) +
  thing('big bed', -9.6, -6.6, -5.4, -1.6) + thing('window seat', -15.0, -9.7, -8.1, -8.9) + thing('wardrobe', -10.2, 5.0, -5.3, 5.9) + thing('rug', -15.2, -6.2, -10.4, -2.0, {rx: 10}) + thing('chaise', -18.7, -7.5, -17.5, -4.3, {rx: 12}) + thing('dresser', -18.8, 1.4, -18.0, 4.6) +
  thing('bath', -1.6, -2.9, 2.0, -1.3, {rx: 22}) + thing('', 3.6, -.4, 4.4, 3.2) + text(3.4, 1.55, 'basins', {size: 11, fill: C.soft, anchor: 'end'}) + thing('shower', -4.4, 3.3, -2.2, 5.6) + thing('mat', -1.2, -.7, 1.4, .7, {rx: 10}) + thing('wc', 3.4, 4.6, 4.4, 5.8, {rx: 10}) + thing('towels', -4.4, -3.2, -2.9, -2.2) +
  stairs(-8.4, 6.9, -6.9, 11.3, 10, true) + stairs(-6.7, 6.9, -5.25, 11.3, 10, false) + text(-6.8, 6.7, 'stairs down', {size: 11, fill: C.accent}) +
  thing('chair', -18.5, 9.4, -17.0, 10.9, {rx: 12}) +
  shell({north: [[4, 11]], studyNorth: [[3.6, 6.4]], east: [[9.2, 10.6]], south: [[6.2, 9.8]]}) + win(WX + 4, N, WX + 11, N) + win(KX + 3.6, SN, KX + 6.4, SN) + win(SX1, SN + 9.2, SX1, SN + 10.6) + win(KX - 6.2, HS, KX - 9.8, HS) +
  wall(SX0 - .22, SN, SX0 - .22, S_, [[3.3, 5.7]], {w: 11.7}) + wall(WX, KS, KX, KS, [[5.8, 8.2]]) +
  text(-12.05, 5.75, 'door', {size: 11, fill: C.accent}) + text(-3.1, 1.3, 'door', {size: 11, fill: C.accent}) + compass;

// The house from the front (south): x as in the plans, height up.
const G = 26.5, ey = y => ((G - y) * S).toFixed(1);
const er = (x0, y0, x1, y1, o = {}) => `<rect x="${px(x0)}" y="${ey(y1)}" width="${((x1 - x0) * S).toFixed(1)}" height="${((y1 - y0) * S).toFixed(1)}" fill="${o.fill ?? '#f6f1e7'}" stroke="${o.stroke ?? C.ink}" stroke-width="${o.w ?? 1.5}" rx="${o.rx ?? 0}"/>`;
const poly = (pts, fill) => `<polygon points="${pts.map(([x, y]) => `${px(x)},${ey(y)}`).join(' ')}" fill="${fill}" stroke="${C.ink}" stroke-width="1.5" stroke-linejoin="round"/>`;
const pane = (x0, y0, x1, y1) => er(x0, y0, x1, y1, {fill: '#cfe3ee'}) + `<line x1="${px((x0 + x1) / 2)}" y1="${ey(y0)}" x2="${px((x0 + x1) / 2)}" y2="${ey(y1)}" stroke="${C.ink}" stroke-width="1"/>`;
const front =
  `<rect x="0" y="${ey(0)}" width="${W * S}" height="60" fill="#e9e2d2"/>` +
  poly([[SX0 - .5, 10], [SX1 + .6, 10], [SX1 + .6, 20], [SX0 - .5, 20]], '#f6f1e7') + poly([[SX0 - 1, 20], [SX1 + 1.1, 20], [0, 23.4]], '#6f7f8c') +
  poly([[WX, 0], [KX + .5, 0], [KX + .5, 20], [WX, 20]], '#fbf7ee') + poly([[WX - .6, 20], [KX + 1.1, 20], [(WX + KX) / 2 + .25, 24.6]], '#7d8d9a') +
  er(KX + .5, 0, SX1 + .6, 10) +
  er(-14.25, 0, -12.05, 5.6, {fill: '#3d4f5e', rx: 3}) + `<circle cx="${px(-12.45)}" cy="${ey(2.7)}" r="3" fill="#d8b46a"/>` + er(-14.9, 0, -11.4, .35, {fill: '#d9d2c2'}) +
  pane(-10.4, 2.2, -8.0, 6.8) + pane(-18.2, 2.2, -15.8, 6.8) + pane(-1.9, 1.2, 1.9, 8) + pane(-18.2, 12.2, -15.8, 16.8) + pane(-14.35, 12.2, -11.95, 16.8) + pane(-10.4, 12.2, -8.0, 16.8) + pane(-1.6, 12.2, 1.6, 16.8) +
  er(3.0, 20.6, 3.9, 24.6, {fill: '#e9e2d2'}) +
  `<text x="${px(-12)}" y="${ey(-1.1)}" font-size="13" text-anchor="middle" fill="${C.soft}">hall and landing, bedroom behind</text><text x="${px(0)}" y="${ey(-1.1)}" font-size="13" text-anchor="middle" fill="${C.soft}">study, bathroom above</text>`;

const PH = H * S + 70, FH = 28.5 * S + 80;
const key = y => `<g transform="translate(20 ${y})" font-size="13" fill="${C.ink}"><rect width="18" height="18" fill="${C.old}" stroke="${C.line}"/><text x="26" y="14">there today</text><rect x="130" width="18" height="18" fill="${C.neu}" stroke="${C.line}"/><text x="156" y="14">new</text><text x="210" y="14" fill="${C.soft}">A wall between you and a room hides, as today.</text></g>`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * S}" height="${PH * 2 + FH + 60}" font-family="-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif">
<rect width="100%" height="100%" fill="${C.paper}"/>
<g transform="translate(0 10)">${panel('Downstairs', 'Kitchen and study stay as they are. New: the hall with the stairs.', ground)}</g>
${key(PH + 14)}
<g transform="translate(0 ${PH + 50})">${panel('Upstairs', 'All new: landing, bedroom, bathroom (through the bedroom).', upper)}</g>
<g transform="translate(0 ${PH * 2 + 60})"><text x="20" y="34" font-size="24" font-weight="700" fill="${C.ink}">From the front</text><text x="20" y="56" font-size="13" fill="${C.soft}">What the House view shows from outside: pale walls, slate roof. Come closer and the near walls hide.</text>
<g transform="translate(0 70)">${front}</g></g>
</svg>`;
writeFileSync(new URL('../docs/house/blueprint.svg', import.meta.url), svg);
console.log('written', (svg.length / 1024).toFixed(1) + ' KB');
