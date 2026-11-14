// The bird that visits the windows: a house sparrow, painted in code on a
// few thin cards (body, a folded wing and legs for when it is perched, two
// spread wings that beat when it flies). It lives in the narrow gap between
// the view and the glazing bars, so it is flat front to back, but seen
// from the room it has the shape, markings and feathers of the real bird.
// It faces +x; `wings` are the two spread wings' hinges (turn about x: up
// is negative for the first, positive for the second).
import * as THREE from 'three';

const TAU = Math.PI * 2;
// A picture painted in the bird's own units (x forward, y up), covering
// x0..x1 by y0..y1, on a card of that size.
function card(x0, x1, y0, y1, px, draw) {
  const w = Math.round((x1 - x0) * px), h = Math.round((y1 - y0) * px), c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d'); g.setTransform(px, 0, 0, -px, -x0 * px, y1 * px); g.lineCap = 'round';
  draw(g);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, y1 - y0), new THREE.MeshBasicMaterial({map: t, alphaTest: .5, side: THREE.DoubleSide, toneMapped: false}));
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0);
  return m;
}
const oval = (g, x, y, rx, ry, rot, fill) => { g.fillStyle = fill; g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, TAU); g.fill(); };
// One feather: a long narrow leaf from (x, y) to (tx, ty), dark with a
// pale edge.
function feather(g, x, y, tx, ty, wd, dark, edge) {
  const nx = -(ty - y), ny = tx - x, L = Math.hypot(nx, ny) || 1, ox = nx / L * wd, oy = ny / L * wd, mx = (x + tx) / 2, my = (y + ty) / 2;
  for (const [k, col] of [[1, edge], [.72, dark]]) {
    g.fillStyle = col; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(mx + ox * k, my + oy * k, tx, ty); g.quadraticCurveTo(mx - ox * k, my - oy * k, x, y); g.fill();
  }
}

function drawBody(g) {
  // Tail: a few long dark feathers, a little spread.
  for (let i = 0; i < 4; i++) feather(g, -.045, .004 + i * .004, -.128, -.012 + i * .009, .011, '#4a3b2d', '#a08a6c');
  // Body: warm brown back, pale grey-buff underneath, rounder at the breast.
  g.save();
  g.beginPath(); g.ellipse(.002, .004, .064, .044, -.1, 0, TAU); g.clip();
  const coat = g.createLinearGradient(0, .05, 0, -.045);
  coat.addColorStop(0, '#9a6a40'); coat.addColorStop(.42, '#8a5c38'); coat.addColorStop(.58, '#d8cfbd'); coat.addColorStop(.85, '#e4dccb'); coat.addColorStop(1, '#b3a996');
  g.fillStyle = coat; g.fillRect(-.1, -.06, .2, .12);
  // (Dark streaks down the back.)
  g.strokeStyle = 'rgba(40,28,18,.75)'; g.lineWidth = .0035;
  for (let i = 0; i < 9; i++) { const x = -.05 + i * .011, y = .03 - Math.abs(i - 4) * .002; g.beginPath(); g.moveTo(x + .012, y + .008); g.lineTo(x - .01, y - .008); g.stroke(); }
  // (The breast turns from the light, the flank is faintly streaked.)
  const round = g.createRadialGradient(.01, .012, .02, .005, .005, .07); round.addColorStop(0, 'rgba(255,250,235,.16)'); round.addColorStop(1, 'rgba(60,45,30,.3)');
  g.fillStyle = round; g.fillRect(-.1, -.06, .2, .12);
  g.restore();
  // Head: grey crown, chestnut from the eye round the nape, pale cheek.
  g.save();
  g.beginPath(); g.arc(.056, .043, .034, 0, TAU); g.clip();
  g.fillStyle = '#e6dfd0'; g.fillRect(0, 0, .12, .09);
  oval(g, .04, .058, .04, .022, -.5, '#8c4f2c');
  oval(g, .06, .078, .04, .016, -.05, '#807b74');
  const dome = g.createRadialGradient(.062, .058, .005, .056, .043, .036); dome.addColorStop(0, 'rgba(255,250,240,.2)'); dome.addColorStop(1, 'rgba(50,38,28,.28)');
  g.fillStyle = dome; g.fillRect(0, 0, .12, .09);
  g.restore();
  // The black bib and the dark line through the eye.
  oval(g, .071, .018, .017, .024, .35, '#2a2420');
  g.strokeStyle = '#2a2420'; g.lineWidth = .006; g.beginPath(); g.moveTo(.062, .05); g.lineTo(.086, .044); g.stroke();
  // Beak: short and stout.
  g.fillStyle = '#3d3229'; g.beginPath(); g.moveTo(.084, .053); g.lineTo(.11, .04); g.lineTo(.084, .03); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(200,180,150,.6)'; g.lineWidth = .0018; g.beginPath(); g.moveTo(.086, .042); g.lineTo(.106, .0405); g.stroke();
  // Eye: black and bright.
  oval(g, .067, .051, .0068, .0068, 0, '#0f0c0a'); oval(g, .0688, .0532, .002, .002, 0, '#ffffff');
}
// Perched: the wing folded along the flank, and its legs.
function drawPerched(g) {
  g.strokeStyle = '#b08a76'; g.lineWidth = .0042;
  for (const x of [-.004, .016]) { g.beginPath(); g.moveTo(x, -.03); g.lineTo(x + .006, -.064); g.stroke(); g.lineWidth = .003; for (const dx of [.016, -.01]) { g.beginPath(); g.moveTo(x + .006, -.064); g.lineTo(x + .006 + dx, -.068); g.stroke(); } g.lineWidth = .0042; }
  g.save();
  g.beginPath(); g.moveTo(.036, .03); g.quadraticCurveTo(-.02, .058, -.098, .0); g.quadraticCurveTo(-.03, -.022, .03, .0); g.closePath(); g.clip();
  g.fillStyle = '#8f5a34'; g.fillRect(-.12, -.04, .2, .12);
  // (Rows of dark-centred feathers, a white bar, dark flight feathers aft.)
  for (let row = 0; row < 3; row++) for (let i = 0; i < 7; i++) oval(g, .022 - i * .014 - row * .004, .03 - row * .014 - i * .003, .008, .0045, .5, '#33261c');
  g.strokeStyle = '#f1ece0'; g.lineWidth = .0045; g.beginPath(); g.moveTo(.026, .012); g.lineTo(.004, .034); g.stroke();
  for (let i = 0; i < 5; i++) feather(g, -.02 - i * .004, .022 - i * .007, -.098, .004 - i * .003, .006, '#3b2d22', '#b89468');
  g.restore();
}
// A spread wing from above: root at z = 0, tip at z = `span`; x forward.
function drawWing(g, span) {
  // Flight feathers fanned along the trailing edge, longest near the tip.
  for (let i = 0; i < 12; i++) {
    const k = i / 11, z = .012 + k * (span - .02), len = .05 + .028 * Math.sin(k * 2.2) - (k > .8 ? (k - .8) * .12 : 0);
    feather(g, .012 - k * .01, z, -len, z + .012 + k * .014, .0085, '#43342a', '#b79a74');
  }
  // Coverts over their roots: chestnut, dark-centred, with the white bar.
  g.save();
  g.beginPath(); g.moveTo(.03, 0); g.quadraticCurveTo(.036, span * .6, .0, span - .012); g.quadraticCurveTo(-.02, span * .5, -.018, 0); g.closePath(); g.clip();
  g.fillStyle = '#935c35'; g.fillRect(-.05, -.01, .1, span + .02);
  for (let i = 0; i < 26; i++) oval(g, .016 - (i % 3) * .012, .008 + i * (span - .03) / 26, .0075, .004, 1.2, '#35281d');
  g.strokeStyle = '#f1ece0'; g.lineWidth = .004; g.beginPath(); g.moveTo(-.012, .01); g.lineTo(-.008, span * .62); g.stroke();
  g.restore();
}

export function makeBird() {
  const group = new THREE.Group(), PX = 2400, SPAN = .15;
  const body = card(-.135, .115, -.075, .085, PX, drawBody);
  const perched = card(-.135, .115, -.075, .085, PX, drawPerched); perched.position.z = .0015;
  group.add(body, perched);
  // (Flat front to back, so a wing held level does not reach through the
  // glazing bars: the hinges turn inside a holder that is squashed that way.)
  const flat = new THREE.Group(); flat.scale.z = .3; group.add(flat);
  const wings = [1, -1].map(side => {
    const hinge = new THREE.Group(); hinge.position.set(.012, .03, side * .01);
    // The picture's "up" is along the wing: laid flat, reaching out to its side.
    const w = card(-.085, .04, -.01, SPAN + .012, PX, g => drawWing(g, SPAN));
    // (A sparrow's wing is about as long as its body.)
    w.scale.setScalar(1.45); w.rotation.x = side * Math.PI / 2; w.position.set(-.0225 * 1.45, 0, side * (SPAN + .002) / 2 * 1.45);
    hinge.add(w); flat.add(hinge);
    return hinge;
  });
  return {group, wings, perch(on) { perched.visible = on; for (const w of wings) w.visible = !on; }};
}
