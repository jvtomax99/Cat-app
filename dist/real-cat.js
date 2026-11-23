// Mochi: the realistic ragdoll model (assets/mochi-ragdoll.glb), rigged at
// load time with a cat skeleton (cat-rig.js), given a soft coat of
// shell-textured fur that takes its colour from the model's own texture, and
// realistic eyes with eyelids, dilating pupils and gaze painted in the skin
// shader. Same interface as the earlier cartoon cat, so app.js drives it with
// the same behaviours: walking, sitting, loafing, sleeping, stretching,
// grooming, eating, kneading, pouncing and rolling over.
import * as THREE from 'three';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {MeshoptDecoder} from './vendor/meshopt_decoder.module.js';

// A packed model (meshopt: whole-number positions, normals and texture
// coordinates, with the true size kept on the mesh's node) back as plain
// floats in the model's own space, which the rig and the fur measure in.
// A model that was never packed comes back as it is.
function plainGeometry(mesh) {
  const g = mesh.geometry;
  mesh.updateWorldMatrix(true, false);
  const packed = ['position', 'normal', 'uv'].some(n => g.attributes[n] && !(g.attributes[n].array instanceof Float32Array && !g.attributes[n].isInterleavedBufferAttribute));
  if (!packed && mesh.matrixWorld.equals(new THREE.Matrix4())) return g;
  const out = new THREE.BufferGeometry();
  out.setIndex(g.index);
  for (const n of ['position', 'normal', 'uv']) {
    const a = g.attributes[n];
    if (!a) continue;
    const f = new Float32Array(a.count * a.itemSize);
    for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) f[i * a.itemSize + k] = a.getComponent(i, k);
    out.setAttribute(n, new THREE.BufferAttribute(f, a.itemSize));
  }
  out.applyMatrix4(mesh.matrixWorld);
  return out;
}
import {useModel, buildSkeleton, computeWeights, computeWeights2, syncHelpers, BONES, BONES2, FACE, GROUND_Y, MIDLINE_X} from './cat-rig.js';
import {sculptFace, MOUTH, fade} from './face-sculpt.js';

const {damp, clamp} = THREE.MathUtils;
const MODEL_SCALE = 0.86;
// The long-haired Mochi's coat, part by part (model units; see furLengthsLonghair).
const FUR_LONGHAIR = {scale: 1, body: .042, belly: .06, ruff: .08, bib: .012, muzzle: .002, skull: .012, cheek: .036, ear: .003, earTuft: .01,
  armUp: .034, armLow: .013, feather: .014, haunch: .046, britches: .09, shin: .026, paw: .006, plume: .14};
const MODEL_SCALE_LONGHAIR = 0.95; // her bones come out the first Mochi's size

// Face presets: real-cat expressions. open = upper lids, happy = lower lids
// push up (a contented squint), pupil = 0 narrow slit .. 1 round and wide.
export const EXPRESSIONS = {
  content:   {open: .68, happy: .22, pupil: .62, smile: 0, mouth: 0,   sparkle: .5, earBack: 0,    earOut: 0,    tongue: 0},
  joy:       {open: .35, happy: .7,  pupil: .55, smile: 0, mouth: 0,   sparkle: .6, earBack: -.05, earOut: .05,  tongue: 0},
  love:      {open: .25, happy: .6,  pupil: .8,  smile: 0, mouth: 0,   sparkle: .8, earBack: .05,  earOut: .1,   tongue: 0},
  excited:   {open: 1,   happy: 0,   pupil: 1,   smile: 0, mouth: .1,  sparkle: 1,  earBack: -.3,  earOut: -.05, tongue: 0},
  yum:       {open: .3,  happy: .6,  pupil: .5,  smile: 0, mouth: 0,   sparkle: .5, earBack: 0,    earOut: .1,   tongue: 0},
  bliss:     {open: .12, happy: .5,  pupil: .5,  smile: 0, mouth: 0,   sparkle: .4, earBack: .15,  earOut: .3,   tongue: 0},
  curious:   {open: 1,   happy: 0,   pupil: .8,  smile: 0, mouth: 0,   sparkle: .8, earBack: -.35, earOut: -.1,  tongue: 0},
  sleepy:    {open: .4,  happy: .2,  pupil: .5,  smile: 0, mouth: 0,   sparkle: .2, earBack: .15,  earOut: .3,   tongue: 0},
  asleep:    {open: 0,   happy: 0,   pupil: .5,  smile: 0, mouth: 0,   sparkle: 0,  earBack: .2,   earOut: .4,   tongue: 0},
  hungry:    {open: 1,   happy: 0,   pupil: .95, smile: 0, mouth: 0,   sparkle: 1,  earBack: .1,   earOut: .15,  tongue: 0},
  lonely:    {open: .8,  happy: 0,   pupil: .9,  smile: 0, mouth: 0,   sparkle: .9, earBack: .35,  earOut: .45,  tongue: 0},
  grumpy:    {open: .5,  happy: 0,   pupil: .2,  smile: 0, mouth: 0,   sparkle: .2, earBack: .55,  earOut: .55,  tongue: 0},
  surprised: {open: 1,   happy: 0,   pupil: 1,   smile: 0, mouth: .35, sparkle: 1,  earBack: -.4,  earOut: -.1,  tongue: 0},
  groom:     {open: .15, happy: .4,  pupil: .5,  smile: 0, mouth: .35, sparkle: .3, earBack: .05,  earOut: .1,   tongue: 1},
};

// Joint angles (radians) on top of the straightened rest pose. x-rotation:
// negative pitch lifts the front; negative leg angles swing a leg forward.
// curl bends the spine sideways (a sleeping cat's C), shared out from hips
// to neck.
// The body is set on the ground automatically from its lowest contact point.
export const POSES = {
  stand:   {pitch: 0,     roll: 0,   spine: 0,    chest: 0,    neck: 0,    shF: 0,    elF: 0,    wrF: 0,    shB: 0,    knB: 0,    hkB: 0,    tailLift: -.55, tailCurl: .22, tailSide: 0,   hYaw: 0,   hPitch: 0,   curl: 0, hRoll: 0},
  sit:     {pitch: -.58,  roll: 0,   spine: -.08, chest: -.04, neck: .32,  shF: .7,   elF: .05,  wrF: .05,  shB: -.95, knB: 2.15, hkB: -1.25, tailLift: -1.2, tailCurl: .05, tailSide: .9, hYaw: 0,   hPitch: 0,   curl: 0, hRoll: 0},
  loaf:    {pitch: .04,   roll: 0,   spine: 0,    chest: .04,  neck: -.05, shF: .95,  elF: -2.25, wrF: 1.2, shB: -.85, knB: 2.3,  hkB: -1.5, tailLift: -1.1, tailCurl: .02, tailSide: .8,  hYaw: 0,   hPitch: 0,   curl: 0, hRoll: 0},
  sleep:   {pitch: .06,   roll: 0,   spine: .08,  chest: .08,  neck: .25,  shF: .95,  elF: -2.25, wrF: 1.2, shB: -.85, knB: 2.3,  hkB: -1.5, tailLift: -.85, tailCurl: .12, tailSide: 4.8, hYaw: 1.0, hPitch: -.9, curl: .9, hRoll: .5},
  crouch:  {pitch: .1,    roll: 0,   spine: .05,  chest: .05,  neck: -.2,  shF: -.45, elF: 1.0,  wrF: -.55, shB: -.55, knB: 1.25, hkB: -.75, tailLift: -.75, tailCurl: .05, tailSide: 0,   hYaw: 0,   hPitch: 0,   curl: 0, hRoll: 0},
  leap:    {pitch: -.18,  roll: 0,   spine: -.05, chest: 0,    neck: .1,   shF: -1.05, elF: .3,  wrF: -.2,  shB: .75,  knB: .1,   hkB: .2,   tailLift: -.2,  tailCurl: -.05, tailSide: 0,  hYaw: 0,   hPitch: 0,   curl: 0, hRoll: 0},
  stretch: {pitch: .3,    roll: 0,   spine: .12,  chest: .12,  neck: -.55, shF: -1.35, elF: .15, wrF: .1,   shB: -.15, knB: .25,  hkB: -.1,  tailLift: .35,  tailCurl: .15, tailSide: 0,   hYaw: 0,   hPitch: 0,   curl: 0, hRoll: 0},
  belly:   {pitch: 0,     roll: 1.55, spine: .05, chest: 0,    neck: -.15, shF: -.55, elF: 1.3,  wrF: -.4,  shB: -.5,  knB: 1.1,  hkB: -.5,  tailLift: -.5,  tailCurl: .1,  tailSide: .4,  hYaw: .2,  hPitch: .1,  curl: 0, hRoll: -1.0},
  beg:     {pitch: -1.05, roll: 0,   spine: -.15, chest: -.1,  neck: .75,  shF: .2,   elF: 1.5,  wrF: .6,   shB: -.95, knB: 2.15, hkB: -1.25, tailLift: -1.2, tailCurl: .05, tailSide: .9, hYaw: 0,   hPitch: 0,   curl: 0, hRoll: 0},
};
const POSE_KEYS = Object.keys(POSES.stand);

const skinVertexHead = /* glsl */`
attribute float furLen;
attribute float facePatch;
attribute vec3 patchColor;
attribute float furTail; // 1 on the long-haired Mochi's tail (see TAIL_BROWN)
varying vec3 vBind;
varying float vFurLen;
varying float vPatch;
varying vec3 vPatchColor;
varying float vTail;
`;
// Her tail is seal brown all round. The model's texture is cream along one
// side of it (the underside of the club it was, before tools/mochi-longhair/
// tail.py), which showed as a white fringe when she carried it up.
const TAIL_BROWN = /* glsl */`
  { float tailLum = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.085, 0.036, 0.019) * (0.75 + 1.4 * min(tailLum, 0.5)), max(vTail, 0.0) * smoothstep(0.035, 0.12, tailLum));
    // (vTail below 0: her rump round the tail's root, which the texture
    // paints dark, a ring of dark fur from behind. Fawn like the rest of it.)
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.5, 0.345, 0.215) * (0.8 + 0.9 * tailLum), max(-vTail, 0.0) * (1.0 - smoothstep(0.1, 0.3, tailLum))); }
`;

const eyeFragment = /* glsl */`
varying vec3 vBind;
uniform vec3 eyeR;
uniform vec3 eyeL;
uniform vec2 eyeRadius;
uniform vec3 mouthPos;
uniform float eyeOpen;
uniform float eyeHappy;
uniform float eyePupil;
uniform vec2 eyeLook;
uniform float eyeSparkle;
uniform float mouthOpen;
uniform float tongueOut;
uniform float retouchOn; // the first Mochi's face only
uniform vec3 lidRing[32]; // 16 directions around each eye: right eye, then left
uniform vec3 lidMid[2];   // each lid's overall colour
uniform vec3 lidDark;
float eyeMask = 0.0;
float lidMask = 0.0; // where the lid fur is painted (its normal-map detail is ignored there)

vec3 lidColorAt(float a, float side) {
  float f = (a / 6.2831853 + 0.5) * 16.0 - 0.5;
  float i0 = floor(f);
  int off = side < 0.0 ? 0 : 16;
  int a0 = off + int(mod(i0, 16.0)), a1 = off + int(mod(i0 + 1.0, 16.0));
  vec3 c0 = lidRing[0], c1 = lidRing[0];
  for (int k = 0; k < 32; k++) { if (k == a0) c0 = lidRing[k]; if (k == a1) c1 = lidRing[k]; }
  return mix(c0, c1, smoothstep(0.0, 1.0, f - i0));
}

// Gentle retouch of the baked face texture, in bind space: a wider white
// blaze between the eyes (like the Ragdoll reference), softer inner-brow and
// tear marks (the source texture paints a frown there), and a relaxed,
// neutral mouth in place of the down-turned one.
vec3 retouch(vec3 base, vec3 p) {
  if (p.z < 0.78 || p.y < 0.24 || p.y > 0.52) return base;
  float dx = abs(p.x - mouthPos.x);
  float y = p.y;
  float n = sin(p.y * 260.0 + p.x * 90.0) * 0.0025;
  float hwBlaze = y < 0.42 ? 0.022 + (0.42 - y) * 0.45 : max(0.006, 0.022 - (y - 0.42) * 0.22);
  float blaze = (1.0 - smoothstep(hwBlaze - 0.01, hwBlaze + 0.012, dx + n)) * smoothstep(0.3, 0.33, y) * (1.0 - smoothstep(0.48, 0.5, y));
  vec3 cream = vec3(0.86, 0.83, 0.79) * (0.96 + 0.04 * sin(p.y * 1400.0 + dx * 300.0));
  // Keep the eyes themselves out of the blaze.
  float nearEye = min(length((p.xy - eyeR.xy) / eyeRadius), length((p.xy - eyeL.xy) / eyeRadius));
  blaze *= smoothstep(1.05, 1.5, nearEye);
  base = mix(base, cream, blaze);
  // Lift the darkest frown marks to the soft chocolate of the mask.
  float brow = smoothstep(0.012, 0.03, dx) * (1.0 - smoothstep(0.07, 0.1, dx)) * smoothstep(0.34, 0.36, y) * (1.0 - smoothstep(0.47, 0.5, y));
  brow *= smoothstep(1.1, 1.5, nearEye);
  base = mix(base, max(base, vec3(0.17, 0.09, 0.05)), brow);
  // Soften the heavy dark patches under the eyes toward warm fawn.
  float under = smoothstep(0.045, 0.07, dx) * (1.0 - smoothstep(0.17, 0.22, dx)) * smoothstep(0.29, 0.32, y) * (1.0 - smoothstep(0.37, 0.39, y)) * smoothstep(1.05, 1.4, nearEye);
  base = mix(base, base * 1.45 + vec3(0.03, 0.02, 0.012), under * 0.7);
  // Mouth: smooth the painted frown into white muzzle fur, then draw a
  // soft, level line: a short philtrum and two shallow curves.
  vec2 m = vec2(dx, y - mouthPos.y);
  float pad = (1.0 - smoothstep(0.75, 1.0, length(m / vec2(0.04, 0.022)))) * step(y, 0.305);
  base = mix(base, vec3(0.84, 0.81, 0.78), pad);
  // Whisker pads: a few bright scribbles are left where the whisker clumps
  // grew; cap the brightness at the cream of the muzzle fur.
  float pads = smoothstep(0.02, 0.035, dx) * (1.0 - smoothstep(0.1, 0.125, dx)) * smoothstep(0.26, 0.275, y) * (1.0 - smoothstep(0.33, 0.345, y)) * step(0.83, p.z);
  base = mix(base, min(base, vec3(0.8, 0.77, 0.73)), pads);
  float aa = max(fwidth(y), 0.0004) * 1.5;
  float philtrum = (1.0 - smoothstep(0.0012, 0.0012 + aa, dx)) * step(mouthPos.y - 0.001, y) * step(y, 0.308);
  // Lips: the sculpted lip line, tinted the soft grey-brown of a cat's lip edge.
  float curveY = 0.2835 - 0.0058 * smoothstep(0.002, 0.02, dx) + 0.0022 * smoothstep(0.02, 0.036, dx);
  float lipEdge = (1.0 - smoothstep(0.0, 0.0013, abs(y - curveY))) * (1.0 - smoothstep(0.026, 0.036, dx));
  base = mix(base, vec3(0.36, 0.26, 0.25), lipEdge * 0.6);
  base = mix(base, vec3(0.3, 0.17, 0.15), philtrum * 0.35);
  return base;
}

vec4 drawEye(vec3 p, vec3 c, float side) {
  vec2 e = (p.xy - c.xy) / eyeRadius;
  e.x *= side;
  float r = length(e);
  if (r > 1.7 || p.z < c.z - 0.06) return vec4(0.0);
  float aa = max(fwidth(e.y), 0.01) * 1.4;
  float hw = sqrt(max(0.0, 1.0 - e.x * e.x));
  // Lids meet in a soft, relaxed line when shut.
  float meet = -0.1 - 0.06 * hw;
  float yu = mix(meet, hw * 1.0, eyeOpen);
  float yl = mix(-hw * 1.0, meet, max(eyeHappy * 0.6, 1.0 - eyeOpen));
  float inside = smoothstep(yl - aa, yl + aa, e.y) * (1.0 - smoothstep(yu - aa, yu + aa, e.y));
  inside *= 1.0 - smoothstep(0.95, 1.01, abs(e.x));
  // Iris fills the eye (cats show almost no white): ragdoll sapphire with a
  // paler ring round the pupil, uneven fibres and flecks, and only a soft,
  // thin darker edge (a heavy dark ring is what makes eyes look like toys).
  vec2 g = e - vec2(eyeLook.x * side, eyeLook.y) * vec2(0.16, 0.1);
  float d = length(g);
  float ang = atan(g.y, g.x);
  vec3 iris = mix(vec3(0.42, 0.62, 0.84), vec3(0.13, 0.3, 0.6), smoothstep(0.15, 0.9, d));
  float fib = 0.5 + 0.5 * sin(ang * 47.0 + d * 11.0 + 1.7 * sin(ang * 13.0));
  float fleck = 0.5 + 0.5 * sin(ang * 23.0 - d * 19.0) * sin(ang * 7.0 + d * 5.0);
  iris *= (0.86 + 0.14 * fib) * (0.94 + 0.08 * fleck * smoothstep(0.3, 0.8, d));
  iris = mix(iris, vec3(0.09, 0.15, 0.27), smoothstep(0.9, 1.02, d) * 0.7);
  vec3 col = iris;
  // Pupil: a soft upright oval, rounder in dim light.
  float pw = mix(0.24, 0.55, eyePupil), ph = mix(0.58, 0.64, eyePupil);
  float pd = length(g / vec2(pw, ph));
  col = mix(col, vec3(0.01, 0.012, 0.02), 1.0 - smoothstep(0.9, 1.08, pd));
  // Wet, rounded look: the upper lid shades the top of the eye, the eye's
  // curve darkens its edge, and the window gives one soft, small catchlight
  // (plus a faint second) rather than big round highlights.
  col *= mix(1.0, 0.45, smoothstep(yu - 0.75, yu, e.y));
  col *= 0.84 + 0.16 * (1.0 - smoothstep(0.3, 1.0, r));
  vec2 s = e * vec2(side, 1.0) - vec2(eyeLook.x, eyeLook.y) * 0.03;
  float glint = 1.0 - smoothstep(0.06 + 0.03 * eyeSparkle, 0.13 + 0.03 * eyeSparkle, length((s - vec2(-0.28, 0.28)) / vec2(1.25, 0.9)));
  float glint2 = 1.0 - smoothstep(0.02, 0.06, length(s - vec2(0.3, -0.3)));
  col = mix(col, vec3(0.97, 0.98, 1.0), max(glint * 0.85, glint2 * 0.35));
  // Lids: soft fur over a rounded eyeball, in the colour of the fur around
  // the eye. Fine hairs comb away from the lash line, the lid's curve catches
  // a little light, and only the lash line itself is dark.
  float distU = e.y - yu, distL = yl - e.y;
  float toLash = 1.0 - smoothstep(0.0, 0.18, min(abs(distU), abs(distL)));
  vec2 hair = vec2(p.x * 1700.0 + e.y * 6.0, p.y * 380.0 + e.x * 3.0);
  float grain = 0.95 + 0.03 * sin(hair.x + 2.0 * sin(hair.y)) + 0.02 * sin(p.y * 2300.0 - p.x * 500.0);
  vec3 furAround = mix(lidMid[side < 0.0 ? 0 : 1], lidColorAt(atan(e.y, e.x), side), smoothstep(0.35, 1.25, r));
  vec3 lid = mix(furAround * 0.9, lidDark, 0.1 * toLash) * grain;
  lid *= 1.0 + 0.05 * (1.0 - smoothstep(0.0, 1.0, r)) * (1.0 - eyeOpen); // the closed lid's soft dome
  float rimU = 1.0 - smoothstep(0.0, 0.05 + aa, abs(distU - 0.015));
  float rimL = (1.0 - smoothstep(0.0, 0.04 + aa, abs(distL - 0.012))) * 0.75;
  float rim = max(rimU, rimL) * (1.0 - smoothstep(0.85, 1.02, abs(e.x)));
  vec3 outc = mix(lid, col, inside);
  outc = mix(outc, vec3(0.07, 0.05, 0.04), rim * mix(0.5, 0.8, eyeOpen));
  // As the eye closes, the lid fur also covers the dark rim painted into the
  // texture around the eye, so a closed eye never looks sunken.
  float region = 1.0 - smoothstep(mix(1.3, 0.9, eyeOpen), mix(1.68, 1.12, eyeOpen), r);
  eyeMask = max(eyeMask, region * inside);
  lidMask = max(lidMask, region * (1.0 - inside));
  return vec4(outc, region);
}

vec3 paintFace(vec3 base) {
  if (retouchOn > 0.5) base = retouch(base, vBind);
  vec4 a = drawEye(vBind, eyeR, -1.0);
  base = mix(base, a.rgb, a.a);
  vec4 b = drawEye(vBind, eyeL, 1.0);
  base = mix(base, b.rgb, b.a);
  return base;
}
`;

const furVertex = /* glsl */`
uniform float furShells;
uniform float furScale;
varying float vLayer;
`;
// The long coat's strands. Each layer of the fur draws a short stroke of
// every hair, and the strokes of one hair must overlap from layer to layer
// or it reads as a row of dots (the grain of the first long coat: round
// dots, on hair leaning well over, were further apart than they were wide).
// So the cells the hairs sit in are drawn out along the comb direction, by
// furStretch, and they are laid out on her body itself (vBind), not in the
// texture's map, which on this model is a patchwork of scraps each turned
// its own way. Fine and tapered: a stroke narrows to nothing at its hair's
// length.
const furFragmentLong = /* glsl */`
uniform float furStretch;
varying vec3 vFurDir;
varying float vTail;
float furHash3(vec3 p) {
  p = fract(p * .1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
`;
const furFragment = /* glsl */`
uniform float furDensity;
varying float vLayer;
varying float vFurLen;
float furHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * .1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
`;

// Where the collar sits, per model (on the long-haired Mochi it peeks through
// her ruff at the front and is under the fur behind, as on a real long-haired
// cat): `at` along the neck bone (0 its root, 1
// the head), `up` a nudge, `r` the ring, `band` the ribbon's thickness, `wide`
// and `flat` its shape, `tilt` its lean, `tag` the tag's radius. Set by eye
// (tools/qa/gifts.mjs).
const COLLAR = {
  longhair: {at: .45, up: -.02, r: .19, band: .021, wide: 1, flat: 1.3, tilt: -.3, tag: .03, bow: 1, out: .05, drop: 0},
  first: {at: .5, up: -.02, r: .14, band: .017, wide: 1, flat: 1.3, tilt: -.25, tag: .024, bow: .8, out: .01, drop: 0},
};
export class RealCat {
  // opts.rig: 2 for the motion trial's rig (shoulder blades, new weights).
  // opts.model: 'longhair' for the long-haired candidate (docs/mochi-longhair).
  constructor(opts = {}) {
    this.opts = opts;
    this.longhair = opts.model === 'longhair';
    if (opts.model) useModel(opts.model);
    this.root = new THREE.Group();
    this.model = new THREE.Group();
    this.root.add(this.model);
    this.meshes = [];
    this.pose = {...POSES.stand};
    this.walkPhase = 0;
    this.ears = [{s: -1, twitch: 0, vel: 0}, {s: 1, twitch: 0, vel: 0}];
    this.faceUniforms = {
      eyeR: {value: FACE.eyeR.clone()}, eyeL: {value: FACE.eyeL.clone()}, eyeRadius: {value: FACE.eyeRadius.clone()},
      mouthPos: {value: FACE.mouth.clone()},
      eyeOpen: {value: .9}, eyeHappy: {value: 0}, eyePupil: {value: .4}, eyeLook: {value: new THREE.Vector2()},
      eyeSparkle: {value: .5}, mouthOpen: {value: 0}, tongueOut: {value: 0}, retouchOn: {value: this.longhair ? 0 : 1},
      lidRing: {value: Array.from({length: 32}, () => new THREE.Color(0.25, 0.16, 0.12))},
      lidMid: {value: [new THREE.Color(0.25, 0.16, 0.12), new THREE.Color(0.25, 0.16, 0.12)]},
      lidDark: {value: new THREE.Color(0.12, 0.07, 0.045)},
    };
    this.ready = false;
  }

  load(url, onProgress) {
    return new Promise((resolve, reject) => new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load(url, gltf => { this.build(gltf); resolve(this); }, onProgress, reject));
  }

  build(gltf) {
    let src;
    gltf.scene.traverse(o => { if (o.isMesh && !src) src = o; });
    const material = src.material;
    material.metalness = 0;
    material.roughness = 1;
    material.metalnessMap = null;
    material.needsUpdate = true;

    // Texture colours: tell the dark tail from the haunch, give the eyelids
    // the colour of the fur around each eye, and colour the face patches.
    const img = material.map.image;
    const canvas = document.createElement('canvas');
    canvas.width = img.width; canvas.height = img.height;
    const ctx = canvas.getContext('2d', {willReadFrequently: true});
    ctx.drawImage(img, 0, 0);
    const px = ctx.getImageData(0, 0, img.width, img.height).data;
    const texelAt = (u, v) => (Math.min(img.height - 1, Math.floor(v * img.height)) * img.width + Math.min(img.width - 1, Math.floor(u * img.width))) * 4;
    const toLin = c => Math.pow(c / 255, 2.2);
    const sampleUV = (u, v) => { const k = texelAt(u, v); return [toLin(px[k]), toLin(px[k + 1]), toLin(px[k + 2])]; };

    // Real mouth, rounded eyeballs, and no whisker clumps (face-sculpt.js).
    // (The long-haired model keeps its face as made, for now: no cut mouth.)
    let geometry;
    const srcGeometry = plainGeometry(src);
    if (this.longhair) {
      geometry = srcGeometry.clone();
      const n = geometry.attributes.position.count;
      geometry.setAttribute('facePatch', new THREE.BufferAttribute(new Float32Array(n), 1));
      geometry.setAttribute('patchColor', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    } else geometry = sculptFace(srcGeometry, sampleUV);
    const uv = geometry.attributes.uv, pos = geometry.attributes.position;
    const texel = i => texelAt(uv.getX(i), uv.getY(i));
    const bright = i => { const k = texel(i); return Math.max(px[k], px[k + 1], px[k + 2]) / 255; };
    const v2 = this.opts.rig === 2;
    const {weld, names} = v2 ? computeWeights2(geometry) : computeWeights(geometry, bright);
    this.rigSource = {bright}; // (for rig-check.html)
    if (!this.longhair) this.weightMouth(geometry, names);
    this.sampleLidRing(pos, texel, px);
    this.furLengths(geometry, weld, names);

    const {root, bones, list} = buildSkeleton(v2 ? BONES2 : BONES);
    this.bones = bones;
    const skinned = new THREE.SkinnedMesh(geometry, material);
    skinned.castShadow = true;
    skinned.receiveShadow = true;
    skinned.frustumCulled = false;
    skinned.add(root);
    this.model.add(skinned);
    // Line the model up: body axis along +z, standing on y = 0, scaled for the room.
    const MS = this.longhair ? MODEL_SCALE_LONGHAIR : MODEL_SCALE;
    this.model.scale.setScalar(MS);
    const yaw = Math.atan2(BONES.chest[1].x - BONES.hips[1].x, BONES.chest[1].z - BONES.hips[1].z);
    this.model.rotation.y = -yaw;
    const centre = (this.longhair ? new THREE.Vector3(0, GROUND_Y, .04) : new THREE.Vector3(MIDLINE_X + .06, GROUND_Y, -0.1)).applyAxisAngle(THREE.Object3D.DEFAULT_UP, -yaw).multiplyScalar(MS);
    this.model.position.set(-centre.x, -centre.y, -centre.z);
    this.model.updateMatrixWorld(true);
    const skeleton = new THREE.Skeleton(list);
    skinned.bind(skeleton, skinned.matrixWorld);
    this.skinned = skinned;
    this.patchSkin(material);
    this.addFur(skinned, material);

    // Rest-pose fixes: tuck the stepped-out left hind leg under the body.
    this.rest = {};
    const aim = (name, childPos, target) => {
      const from = childPos.clone().sub(BONES[name][1]).normalize();
      this.rest[name] = new THREE.Quaternion().setFromUnitVectors(from, target.clone().normalize());
    };
    aim('hipL', BONES.hockL[2], new THREE.Vector3(0.02, -1, 0.05));
    aim('hipR', BONES.hockR[2], new THREE.Vector3(-0.02, -1, 0.05));
    aim('shoulderR', BONES.wristR[2], new THREE.Vector3(-0.01, -1, 0.12));
    aim('shoulderL', BONES.wristL[2], new THREE.Vector3(0.01, -1, 0.12));
    // The sculpted head looks slightly upward; level it.
    this.rest.head = new THREE.Quaternion().setFromEuler(new THREE.Euler(this.longhair ? 0 : 0.22, 0, 0));
    this.tailRest = [];
    for (let i = 0; i < 8; i++) {
      const a = BONES['tail' + i][1], b = i < 7 ? BONES['tail' + (i + 1)][1] : BONES.tail7[2];
      this.tailRest.push(b.clone().sub(a).normalize());
    }

    // Contact points used to set the cat on the floor, in bone space.
    const pt = (bone, x, y, z) => {
      const o = new THREE.Object3D();
      o.position.set(x, y, z);
      bones[bone].add(o);
      return o;
    };
    const endOf = (b) => BONES[b][2].clone().sub(BONES[b][1]);
    this.contacts = [
      pt('wristR', ...endOf('wristR').setY(-0.105)), pt('wristL', ...endOf('wristL').setY(-0.105)),
      pt('wristR', 0, -0.06, 0), pt('wristL', 0, -0.06, 0),
      pt('hockR', ...endOf('hockR').setY(-0.145)), pt('hockL', ...endOf('hockL').setY(-0.145)),
      pt('hockR', 0, -0.06, 0), pt('hockL', 0, -0.06, 0),
      pt('hips', 0, -0.3, -0.1), pt('hips', 0, -0.2, -0.28), pt('hips', 0.25, -0.15, -0.05), pt('hips', -0.25, -0.15, -0.05),
      pt('spine', 0, -0.3, 0), pt('spine', 0.3, -0.05, 0), pt('spine', -0.3, -0.05, 0), pt('spine', 0, 0.3, 0),
      pt('chest', 0, -0.3, 0.05), pt('chest', 0.28, -0.1, 0), pt('chest', -0.28, -0.1, 0),
      pt('head', 0, -0.12, 0.2), pt('head', 0.2, 0, 0.05), pt('head', -0.2, 0, 0.05),
    ];

    // Legs for foot planting: three bones each, and a sole point under the paw.
    this.legs = [['R', 'shoulderR', 'elbowR', 'wristR', 0, true], ['L', 'shoulderL', 'elbowL', 'wristL', Math.PI, true],
      ['R', 'hipR', 'kneeR', 'hockR', Math.PI, false], ['L', 'hipL', 'kneeL', 'hockL', 0, false]]
      .map(([s, a, b, c, phase, front]) => ({s, a: bones[a], b: bones[b], c: bones[c], phase, front,
        sole: pt(c, ...endOf(c).multiplyScalar(.6).setY(front ? -0.105 : -0.145)), plant: null, step: null, w: 0, bendSign: 1}));

    // Cheap invisible colliders for petting (raycasting a skinned mesh is slow).
    const hidden = new THREE.MeshBasicMaterial({visible: false});
    const collider = (bone, r, x, y, z, sx = 1, sy = 1, sz = 1) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), hidden);
      m.position.set(x, y, z);
      m.scale.set(sx, sy, sz);
      bones[bone].add(m);
      this.meshes.push(m);
    };
    collider('head', .26, 0, .04, .12);
    collider('chest', .32, 0, -.02, .05);
    collider('spine', .32, 0, 0, 0, 1, 1, 1.2);
    collider('hips', .3, 0, 0, -.05);
    // (Her tail and paws can be touched too: she has opinions about those.)
    for (const b of ['tail1', 'tail2', 'tail3', 'tail4', 'tail5', 'tail6', 'tail7']) if (bones[b]) collider(b, .1, 0, 0, 0);
    for (const b of ['wristR', 'wristL', 'hockR', 'hockL']) if (bones[b]) { collider(b, .09, 0, 0, 0); collider(b, .1, ...endOf(b).multiplyScalar(.7).toArray()); }

    if (!this.longhair) { this.addWhiskers(bones); this.addMouthInterior(bones); }
    this.neck = bones.neck;
    this.head = bones.head;
    this.ready = true;
  }

  // The lids' colour: for each eye, the median colour of the fur just
  // outside it, in 16 directions, so a closed lid matches what's around it.
  sampleLidRing(pos, texel, px) {
    const toLin = c => Math.pow(c / 255, 2.2);
    const ring = this.faceUniforms.lidRing.value, dark = [];
    [FACE.eyeR, FACE.eyeL].forEach((c, eye) => {
      const side = c.x < MIDLINE_X ? -1 : 1, bins = Array.from({length: 16}, () => []);
      for (let i = 0; i < pos.count; i++) {
        if (pos.getZ(i) < c.z - 0.06) continue;
        const ex = (pos.getX(i) - c.x) / FACE.eyeRadius.x * side, ey = (pos.getY(i) - c.y) / FACE.eyeRadius.y;
        const r = Math.hypot(ex, ey);
        if (r < 1.62 || r > 1.85) continue;
        const k = texel(i);
        bins[Math.min(15, Math.floor((Math.atan2(ey, ex) / (Math.PI * 2) + .5) * 16))].push([toLin(px[k]), toLin(px[k + 1]), toLin(px[k + 2])]);
      }
      const mid = (list, ch) => list.map(v => v[ch]).sort((x, y) => x - y)[list.length >> 1];
      let cols = bins.map((list, b) => {
        // An empty direction borrows its neighbour's colour.
        const use = list.length ? list : bins[(b + 1) % 16].length ? bins[(b + 1) % 16] : bins[(b + 15) % 16];
        return use.length ? [mid(use, 0), mid(use, 1), mid(use, 2)] : [.25, .16, .12];
      });
      // Soften the changes from one direction to the next.
      for (let pass = 0; pass < 3; pass++) cols = cols.map((c, b) => c.map((v, ch) => (cols[(b + 15) % 16][ch] + 2 * v + cols[(b + 1) % 16][ch]) / 4));
      cols.forEach((c, b) => { ring[eye * 16 + b].setRGB(...c); dark.push(ring[eye * 16 + b]); });
      const byLight = [...cols].sort((a, b) => (a[0] + a[1] + a[2]) - (b[0] + b[1] + b[2]));
      this.faceUniforms.lidMid.value[eye].setRGB(...byLight[8]);
    });
    // The lash line takes the mask's deepest chocolate.
    const sorted = dark.sort((a, b) => (a.r + a.g + a.b) - (b.r + b.g + b.b)).slice(0, 6);
    this.faceUniforms.lidDark.value.setRGB(...['r', 'g', 'b'].map(k => sorted.reduce((t, c) => t + c[k], 0) / 6));
  }


  // How long the fur grows at each vertex (model units).
  furLengths(geometry, weld, names) {
    const pos = geometry.attributes.position, N = pos.count;
    const len = new Float32Array(N);
    // Tiny disconnected pieces (whiskers) get no fur.
    const idx = geometry.index, parent = new Int32Array(N).map((_, i) => i);
    const find = i => { while (parent[i] !== i) i = parent[i] = parent[parent[i]]; return i; };
    for (let t = 0; t < idx.count; t += 3) {
      const a = find(weld[idx.getX(t)]), b = find(weld[idx.getX(t + 1)]), c = find(weld[idx.getX(t + 2)]);
      parent[b] = a; parent[find(c)] = a;
    }
    const size = new Map();
    for (let i = 0; i < N; i++) { const r = find(weld[i]); size.set(r, (size.get(r) || 0) + 1); }
    if (this.longhair) { this.furInput = {geometry, names, loose: Uint8Array.from({length: N}, (_, i) => size.get(find(weld[i])) < 2000 ? 1 : 0)}; return this.furLengthsLonghair(); }
    const eyes = [FACE.eyeR, FACE.eyeL];
    const p = new THREE.Vector3();
    for (let i = 0; i < N; i++) {
      p.fromBufferAttribute(pos, i);
      if (size.get(find(weld[i])) < 2000) { len[i] = 0; continue; }
      let l = 0.024;
      const face = p.z > 0.62 && p.y > 0.12;
      if (face) l = p.z > 0.76 ? 0.007 : 0.014;
      if (p.y > 0.47 && p.z < 0.78 && p.z > 0.55) l = 0.008; // ears
      if (p.z > 0.25 && p.z < 0.7 && p.y < 0.2 && p.y > -0.32 && Math.abs(p.x - MIDLINE_X) < 0.3) l = 0.04; // ruff
      if (p.y < -0.3 && p.z > 0.2) l = 0.012; // front legs
      if (p.y < -0.5) l = 0.008; // paws
      if (p.x > 0.0 && p.z < -0.4 && p.y < 0.1) l = 0.034; // tail (fluffy)
      for (const e of eyes) {
        const d = Math.hypot((p.x - e.x) / FACE.eyeRadius.x, (p.y - e.y) / FACE.eyeRadius.y);
        if (p.z > e.z - 0.06 && d < 1.8) l *= clamp((d - 1.3) / 0.5, 0, 1);
      }
      // Whiskers and ear furnishings stay crisp, without a fur coat.
      if (p.z > 0.84 && Math.abs(p.x - MIDLINE_X) > 0.09 && p.y > 0.12 && p.y < 0.4) l = 0;
      const dn = Math.hypot(p.x - FACE.nose.x, p.y - FACE.nose.y);
      if (p.z > 0.82 && dn < 0.06) l = 0;
      const dm = Math.hypot((p.x - FACE.mouth.x) / 0.05, (p.y - FACE.mouth.y) / 0.025);
      if (p.z > 0.8 && dm < 1) l = 0;
      // Restrained coat: no fur on the face and ears, shorter elsewhere.
      if (p.z > 0.5 && p.y > 0.08) l = 0;
      len[i] = l * 0.62;
    }
    geometry.setAttribute('furLen', new THREE.BufferAttribute(len, 1));
  }

  // The long-haired Mochi's coat. Her body parts come from her own skin
  // weights (which bones move a point), so the regions follow her anatomy and
  // blend where the weights blend. Each part has a length and a comb
  // direction; furDir is that direction laid along the surface, its size how
  // flat the hair lies (0 stands straight out, 1 lies along the coat).
  // Lengths are model units: the model's surface already holds the bulk of
  // the coat, so this is the soft outer layer. Run again after changing
  // FUR_LONGHAIR to retune without reloading.
  furLengthsLonghair() {
    const {geometry, names, loose} = this.furInput, F = FUR_LONGHAIR;
    const pos = geometry.attributes.position, nor = geometry.attributes.normal, N = pos.count;
    const si = geometry.attributes.skinIndex, sw = geometry.attributes.skinWeight;
    const len = new Float32Array(N), dir = new Float32Array(N * 3), tailW = new Float32Array(N);
    const part = names.map(n => n.startsWith('tail') ? 'tail' : n.startsWith('ear') ? (n.endsWith('R') ? 'earR' : 'earL') : n === 'head' || n === 'jaw' ? 'head'
      : n === 'neck' || n === 'chest' || n.startsWith('scapula') ? 'chest' : n.startsWith('shoulder') ? 'armUp' : n.startsWith('elbow') ? 'armLow'
      : n.startsWith('wrist') ? 'paw' : /^(thigh|hip)/.test(n) ? 'haunch' : n.startsWith('knee') ? 'shin' : n.startsWith('hock') ? 'hock' : 'body');
    const tail = [0, 1, 2, 3, 4, 5, 6, 7].map(i => BONES2['tail' + i][1]).concat(BONES2.tail7[2]);
    const tips = {earR: BONES2.earR, earL: BONES2.earL};
    const p = new THREE.Vector3(), n = new THREE.Vector3(), d = new THREE.Vector3(), sum = new THREE.Vector3(), a = new THREE.Vector3(), ab = new THREE.Vector3();
    const st = THREE.MathUtils.smoothstep;
    // One part's length, comb direction (into d) and lie for this point.
    const coat = name => {
      const back = st(-n.z, .1, .6), under = st(-n.y, .2, .7), ax = Math.abs(p.x);
      switch (name) {
        case 'body': d.set(0, -.5, -1); return [F.body + (F.belly - F.body) * under, .86 - .3 * under];
        case 'chest': {
          // The ruff: the front and sides of the neck and chest, under the chin, down to the forelegs.
          const ruff = st(p.z, .28, .46) * (1 - st(p.y, .14, .3)), bib = ruff * st(n.z, -.2, .5);
          d.set(p.x * 2.2 * ruff, -1, -.9 + 1.05 * ruff);
          return [F.body + (F.ruff - F.body) * ruff + (F.belly - F.body) * under * (1 - ruff) + F.bib * bib, .8 - .25 * ruff];
        }
        case 'head': {
          // Short on the muzzle, longer toward the skull; the cheeks grow into the ruff.
          const dn = p.distanceTo(FACE.nose), cheek = st(ax, .07, .14) * (1 - st(p.y, .2, .3)) * (1 - st(p.z, .82, .9));
          d.subVectors(p, FACE.nose); d.y = d.y * .5 - .25 * cheek - .05; d.x *= 1 + cheek;
          return [F.muzzle + (F.skull - F.muzzle) * st(dn, .05, .24) + (F.cheek - F.skull) * cheek, .85];
        }
        case 'earR': case 'earL': {
          // Ears stay neat; a small tuft toward the tip.
          const [, base, tip] = tips[name];
          d.subVectors(tip, base);
          return [F.ear + (F.earTuft - F.ear) * (1 - st(p.distanceTo(tip), .015, .06)), .8];
        }
        case 'armUp': d.set(0, -1, -.3); return [F.armUp + F.feather * back, .75];
        case 'armLow': d.set(0, -1, -.15); return [F.armLow + F.feather * .6 * back, .85];
        case 'haunch': {
          // Britches: the long fur down the back of the thighs.
          // (Below the root of her tail only: long fur round the root itself stood out as a shaggy collar.)
          const br = back * (1 - st(p.z, -.3, -.12)) * (1 - st(p.y, .0, .12));
          d.set(0, -1, -.4); return [F.haunch + (F.britches - F.haunch) * br, .7 - .15 * br];
        }
        case 'shin': d.set(0, -1, -.3); return [F.shin + (F.britches * .7 - F.shin) * back, .7];
        case 'hock': case 'paw': {
          // Short and sleek down to the toes; nothing underneath, where she stands.
          const foot = 1 - st(p.y, GROUND_Y + .05, GROUND_Y + .13), sole = st(-n.y, .5, .8) * (1 - st(p.y, GROUND_Y + .02, GROUND_Y + .06));
          d.set(0, -1 + .5 * foot, .9 * foot - (name === 'hock' ? .2 : 0) * (1 - foot));
          return [(F.paw + ((name === 'hock' ? F.shin * .6 : F.armLow) - F.paw) * (1 - foot)) * (1 - sole), .88];
        }
        case 'tail': {
          // The plume: fullest in the middle, hair sweeping toward the tip.
          let best = Infinity, along = 0;
          for (let k = 0; k < tail.length - 1; k++) {
            ab.subVectors(tail[k + 1], tail[k]);
            const t = clamp(a.subVectors(p, tail[k]).dot(ab) / ab.lengthSq(), 0, 1), dist = a.addScaledVector(ab, -t).length();
            if (dist < best) { best = dist; along = (k + t) / (tail.length - 1); d.copy(ab).normalize(); }
          }
          // (Laid well over, .88: stood half out from the tail, .5, the hairs
          // pointed every way round it, a bottle brush. Shorter where the tail
          // leaves her rump, so the two coats meet, and toward the tip.)
          return [F.plume * (.3 + .7 * st(along, 0, .38)) * (1 - .3 * st(along, .75, 1)), .84];
        }
      }
      return [0, 0];
    };
    for (let i = 0; i < N; i++) {
      if (loose[i]) continue; // loose flecks: no coat
      p.fromBufferAttribute(pos, i); n.fromBufferAttribute(nor, i);
      let l = 0, lie = 0;
      sum.set(0, 0, 0);
      for (let k = 0; k < 4; k++) {
        const w = sw.getComponent(i, k);
        if (w < .01) continue;
        const name = part[si.getComponent(i, k)], [L, flat] = coat(name);
        l += w * L; lie += w * flat; sum.addScaledVector(d.normalize(), w);
        if (name === 'tail') tailW[i] += w;
      }
      // Bare: the eyes, the nose leather, the lips.
      for (const e of [FACE.eyeR, FACE.eyeL]) {
        const de = Math.hypot((p.x - e.x) / FACE.eyeRadius.x, (p.y - e.y) / FACE.eyeRadius.y);
        if (p.z > e.z - .06 && de < 2.2) l *= clamp((de - 1.5) / .7, 0, 1);
      }
      if (p.z > FACE.nose.z - .05) {
        l *= st(Math.hypot(p.x - FACE.nose.x, (p.y - FACE.nose.y) * 1.2), .022, .04);
        l *= st(Math.hypot((p.x - FACE.mouth.x) / .035, (p.y - FACE.mouth.y) / .014), .8, 1.4);
      }
      len[i] = l * F.scale;
      // Lay the comb direction along the surface.
      sum.addScaledVector(n, -sum.dot(n));
      if (sum.lengthSq() > 1e-6) { sum.normalize().multiplyScalar(lie); dir[i * 3] = sum.x; dir[i * 3 + 1] = sum.y; dir[i * 3 + 2] = sum.z; }
    }
    geometry.setAttribute('furLen', new THREE.BufferAttribute(len, 1));
    geometry.setAttribute('furDir', new THREE.BufferAttribute(dir, 3));
    // (The loose flecks of her tail too: they have no coat, but they are tail.)
    for (let i = 0; i < N; i++) if (loose[i]) { let w = 0; for (let k = 0; k < 4; k++) if (part[si.getComponent(i, k)] === 'tail') w += sw.getComponent(i, k); tailW[i] = w; }
    {
      const rootAt = BONES2.tail1[1], q = new THREE.Vector3();
      for (let i = 0; i < N; i++) { const d = q.fromBufferAttribute(pos, i).distanceTo(rootAt), near = 1 - st(d, .1, .19); if (near > 0 && tailW[i] < .5) tailW[i] = tailW[i] > .02 ? tailW[i] * (1 - near) : -near; }
    }
    geometry.setAttribute('furTail', new THREE.BufferAttribute(tailW, 1));
    if (this.fur) for (const k of ['furLen', 'furDir', 'furTail']) this.fur.geometry.setAttribute(k, geometry.attributes[k]);
  }

  patchSkin(material) {
    const u = this.faceUniforms;
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, u);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\n' + skinVertexHead)
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBind = position;\nvFurLen = furLen;\nvPatch = facePatch;\nvPatchColor = patchColor;\nvTail = furTail;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\n' + eyeFragment + '\nvarying float vPatch;\nvarying vec3 vPatchColor;\nvarying float vTail;')
        .replace('#include <color_fragment>', '#include <color_fragment>\n' + TAIL_BROWN)
        .replace('#include <map_fragment>', '#include <map_fragment>\nvec3 patchCol = vPatchColor * (0.95 + 0.035 * sin(vBind.y * 1500.0 + vBind.x * 260.0) + 0.025 * sin(vBind.x * 2100.0 - vBind.y * 400.0));\ndiffuseColor.rgb = paintFace(mix(diffuseColor.rgb, patchCol, vPatch));')
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.2, eyeMask);')
        // The model's normal map still holds the sculpted socket of the
        // original open eye; under the lid fur it would draw a ring.
        .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nvec3 lidBaseNormal = normal;')
        .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = normalize(mix(normal, lidBaseNormal, lidMask));');
    };
    material.customProgramCacheKey = () => 'mochi-skin3';
    material.needsUpdate = true;
  }

  // Fewer fur layers for a phone that cannot keep up (app.js, "Quality").
  // `share` of the layers she was made with; the hairs are drawn out
  // further along their length when there are few, to stay soft.
  furLayers(share) {
    const f = this.furLook;
    if (!f) return 0;
    const n = Math.max(4, Math.round(f.full * share));
    f.g.instanceCount = n; f.u.furShells.value = n;
    if (n <= 9) f.u.furStretch.value = 9;
    return n;
  }

  addFur(skinned, baseMaterial) {
    // (?fur=phone: a phone's fewer layers on a computer, to look at them.)
    const coarse = matchMedia('(pointer: coarse)').matches || new URLSearchParams(location.search).get('fur') === 'phone';
    const long = this.longhair; // longer hair needs more layers to stay soft
    const shells = long ? (coarse ? 9 : 20) : coarse ? 6 : 9;
    const g = new THREE.InstancedBufferGeometry();
    for (const [name, attr] of Object.entries(skinned.geometry.attributes)) g.setAttribute(name, attr);
    g.setIndex(skinned.geometry.index);
    g.instanceCount = shells;
    // (Long coat: cells per model unit, about 2.3 mm across in the room, and how far they're drawn out along the hair: further with fewer layers.)
    const u = {furShells: {value: shells}, furDensity: {value: long ? 410 : 380}, furStretch: {value: coarse ? 9 : 4}};
    this.furLook = {u, g, full: shells};
    const m = new THREE.MeshStandardMaterial({map: baseMaterial.map, roughness: 1, metalness: 0});
    m.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, u);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\n' + skinVertexHead + furVertex + (long ? 'attribute vec3 furDir;\nvarying vec3 vFurDir;\n' : ''))
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBind = position;\nvFurLen = furLen;\nvTail = furTail;\nvLayer = (float(gl_InstanceID) + 1.0) / furShells;')
        .replace('#include <skinning_vertex>', long ? `#include <skinning_vertex>
          // Each hair leaves the skin along the normal, then bends over into
          // the comb direction and sags a little under its own weight.
          // Tufts: neighbouring hairs lean together, each tuft a little its own way.
          vec3 furN = normalize(objectNormal);
          float furLie = length(furDir);
          vec3 furTuft = vec3(sin(position.y * 83.0 + position.z * 61.0) + .6 * sin(position.x * 190.0 + position.y * 170.0), sin(position.z * 71.0 + position.x * 97.0) + .6 * sin(position.y * 210.0 + position.z * 150.0), sin(position.x * 89.0 + position.y * 67.0) + .6 * sin(position.z * 180.0 + position.x * 230.0));
          vec3 furD = (skinMatrix * vec4(furDir + furTuft * 0.11 * furLie, 0.0)).xyz;
          vFurDir = furDir;
          transformed += furLen * (furN * (vLayer - 0.5 * furLie * vLayer * vLayer) + furD * (0.5 * vLayer + 0.5 * vLayer * vLayer) + vec3(0.0, -0.2, 0.0) * vLayer * vLayer);` : `#include <skinning_vertex>
          vec3 furN = normalize(objectNormal);
          transformed += furN * vLayer * furLen + vec3(0.0, -1.0, -0.4) * vLayer * vLayer * furLen * 0.6;`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\n' + furFragment + (long ? furFragmentLong : '') + '\nvarying vec3 vBind;')
        .replace('#include <map_fragment>', long ? `#include <map_fragment>
          if (vFurLen < 0.002) discard;
          ${TAIL_BROWN}
          float furLie = length(vFurDir);
          vec3 furDn = furLie > 0.001 ? vFurDir / furLie : vec3(0.0, 1.0, 0.0);
          // (Short fur, her face and paws: nearly round, as it was.)
          // (And the longest, the plume, ruff and britches: longer strokes,
          // their layers being further apart along the hair. Where a stroke
          // was shorter than that step, the hair's end broke into dots.)
          float furLong = vFurLen < 0.024 ? 1.6 : vFurLen < 0.075 ? furStretch : furStretch * 1.5;
          vec3 furG = (vBind + furDn * dot(vBind, furDn) * (1.0 / furLong - 1.0)) * furDensity;
          // From further off the hairs gather into locks, each still a pixel
          // or two wide: cells smaller than a pixel are noise (the "static"
          // at the app's usual distance, and it flickers as she moves).
          vec3 furFw = fwidth(furG);
          float furFar = max(0.0, ceil(log2(max(max(furFw.x, furFw.y), furFw.z) * 0.85)));
          furG /= exp2(furFar);
          furFar = min(furFar / 3.0, 1.0);
          vec3 furCell = floor(furG);
          float furSeed = furHash3(furCell);
          vec3 furF = fract(furG) - 0.5 - (vec3(furHash3(furCell + 7.1), furHash3(furCell + 3.3), furHash3(furCell + 5.7)) - 0.5) * 0.4;
          // Hairs of different lengths; in locks, so the coat lies in layers.
          float furH = mix(0.45, 1.0, furSeed) * mix(0.7, 1.0, furHash3(floor(furG / vec3(5.0, 5.0, 5.0)) + 11.0));
          if (vLayer > furH) discard;
          float furAlong = dot(furF, furDn), furAcross = length(furF - furDn * furAlong);
          float furWide = 0.5 * (1.0 - vLayer / furH) + 0.05;
          float furCover = (1.0 - smoothstep(furWide - 0.1, furWide + 0.1, furAcross)) * (1.0 - smoothstep(0.4, 0.56, abs(furAlong)));
          // (Each hair's edge falls at its own place, so edges vary like hairs do,
          // and nothing flickers: the cut depends on the hair, not the screen.)
          if (furCover < 0.3 + 0.35 * furHash3(furCell + 9.1)) discard;
          // Depth: shaded at the roots, lighter at the tips; each hair its own
          // shade; and the darkest fur (her tail, mask) warms toward the
          // tips, so it reads as soft brown fur, not a black mass.
          float furLum = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
          // (Gentler from further off: hairs a pixel wide with shaded roots
          // and bright tips side by side read as a mottled, woolly coat.)
          diffuseColor.rgb *= mix(mix(0.6, 0.88, furFar), mix(1.1, 1.02, furFar), vLayer) * (1.0 + (0.2 - 0.14 * furFar) * (furHash3(furCell + 1.7) - 0.5));
          diffuseColor.rgb += vec3(0.05, 0.03, 0.017) * vLayer * vLayer * (1.0 - smoothstep(0.03, 0.2, furLum)) * (0.6 + 0.8 * furSeed);` : `#include <map_fragment>
          if (vFurLen < 0.002) discard;
          vec2 furG = vMapUv * vec2(furDensity);
          vec2 furCell = floor(furG);
          float furSeed = furHash(furCell);
          vec2 furF = fract(furG) - 0.5 - (vec2(furHash(furCell + 7.1), furHash(furCell + 3.3)) - 0.5) * 0.5;
          float furH = mix(0.4, 1.0, furSeed);
          if (vLayer > furH) discard;
          if (length(furF) > 0.6 * (1.0 - vLayer / furH) + 0.08) discard;
          diffuseColor.rgb *= mix(0.86, 1.03, vLayer) * (0.96 + 0.07 * furHash(furCell + 1.7));`);
      // A soft edge of light round her where the fur is seen side on, as fur
      // has against the light: brown fur keeps its depth at the outline.
      if (long) shader.fragmentShader = shader.fragmentShader.replace('#include <lights_physical_fragment>', `float furRim = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 3.0) * vLayer;
          diffuseColor.rgb += (diffuseColor.rgb * 0.7 + vec3(0.035, 0.022, 0.013)) * furRim;
          #include <lights_physical_fragment>`);
    };
    m.customProgramCacheKey = () => long ? 'mochi-fur-long8' : 'mochi-fur';
    this.furUniforms = u;
    const fur = new THREE.SkinnedMesh(g, m);
    fur.frustumCulled = false;
    fur.castShadow = false;
    fur.receiveShadow = true;
    fur.raycast = () => {};
    fur.bind(skinned.skeleton, skinned.bindMatrix);
    skinned.parent.add(fur);
    this.fur = fur;
  }

  // A ribbon round her neck with a bow at her throat (a gift of friendship), with a small gold
  // tag at the front once that is hers too. `c` = {color, tag} or null to
  // take it off. It rides on the neck bone, tilted to sit across the neck.
  setCollar(c) {
    if (!this.ready) return;
    if (!c) { if (this.collar) this.collar.visible = false; return; }
    const L = this.longhair, R = L ? COLLAR.longhair : COLLAR.first;
    if (!this.collar) {
      const g = this.collar = new THREE.Group(), along = this.bones.head.position.clone();
      const d = along.clone().normalize();
      g.position.copy(along).multiplyScalar(R.at).add(new THREE.Vector3(0, R.up, 0));
      g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d);
      g.rotateX(R.tilt);
      const band = new THREE.Mesh(new THREE.TorusGeometry(R.r, R.band, 10, 48), new THREE.MeshStandardMaterial({roughness: .62, metalness: 0}));
      band.scale.set(R.wide, 1, R.flat);
      band.castShadow = true;
      g.add(band);
      // The bow: at her throat, out on top of her fur so the colour is always
      // seen (the band itself is mostly under her ruff). Two loops, a knot
      // and two tails, lying against her chest. In the collar's own frame
      // -y is out from her throat and -z is down her chest.
      const bow = new THREE.Group(), ball = new THREE.SphereGeometry(1, 18, 12), S = R.bow;
      bow.position.set(0, -R.r - R.out, R.drop);
      const part = (geo, sx, sy, sz, x, y, z, ry = 0) => { const m = new THREE.Mesh(geo, band.material); m.scale.set(sx * S, sy * S, sz * S); m.position.set(x * S, y * S, z * S); m.rotation.y = ry; m.castShadow = true; bow.add(m); return m; };
      for (const s of [-1, 1]) {
        part(ball, .062, .018, .04, s * .066, 0, .004, s * .22);
        part(new THREE.BoxGeometry(1, 1, 1), .03, .007, .085, s * .03, .004, -.062, -s * .32);
      }
      part(ball, .022, .024, .026, 0, -.006, 0);
      g.add(bow);
      // The tag hangs under the knot.
      const gold = new THREE.MeshStandardMaterial({color: '#e2b53a', metalness: .9, roughness: .25, emissive: '#3a2a08', emissiveIntensity: .35});
      const tag = new THREE.Group();
      tag.position.set(0, -.012 * S, -.045 * S);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(R.tag * .32, R.tag * .07, 6, 14), gold);
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(R.tag, R.tag, R.tag * .16, 22), gold);
      disc.position.z = -R.tag * 1.15;
      tag.add(ring, disc);
      bow.add(tag);
      g.userData = {band, tag, bow};
      this.bones.neck.add(g);
    }
    this.collar.visible = true;
    this.collar.userData.band.material.color.set(c.color || '#d9728a');
    this.collar.userData.tag.visible = !!c.tag;
  }

  // A sparse set of fine, tapered whiskers from the muzzle pads, plus two
  // above each eye. They're children of the head bone, so they move with her
  // face. Each one arcs gently: out and slightly forward, then down.
  addWhiskers(bones) {
    const headPos = BONES.head[1];
    const mat = new THREE.MeshStandardMaterial({color: '#f7f2ea', roughness: .35, transparent: true, opacity: .85, depthWrite: false});
    const group = new THREE.Group();
    bones.head.add(group);
    const strand = (root, dir, len, droop, bow, radius) => {
      const d = dir.clone().normalize(), side = new THREE.Vector3(0, 1, 0).cross(d).normalize();
      const pts = [0, .25, .5, .75, 1].map(t => root.clone().addScaledVector(d, len * t)
        .add(new THREE.Vector3(0, -droop * t * t, 0)).addScaledVector(side, bow * Math.sin(Math.PI * t)).sub(headPos));
      const curve = new THREE.CatmullRomCurve3(pts);
      const segs = 20, radial = 5;
      const geo = new THREE.TubeGeometry(curve, segs, radius, radial, false);
      const p = geo.attributes.position, c = new THREE.Vector3(), v = new THREE.Vector3();
      for (let i = 0; i <= segs; i++) {
        curve.getPointAt(i / segs, c);
        const k = Math.pow(1 - i / segs, .8) * .94 + .06; // tapers to a fine tip
        for (let j = 0; j <= radial; j++) {
          const idx = i * (radial + 1) + j;
          v.fromBufferAttribute(p, idx).sub(c).multiplyScalar(k).add(c);
          p.setXYZ(idx, v.x, v.y, v.z);
        }
      }
      const m = new THREE.Mesh(geo, mat);
      m.renderOrder = 2;
      group.add(m);
    };
    for (const s of [-1, 1]) {
      // [root height, root offset from midline, rise, forward, length, droop]
      const rows = [[.3, .036, .07, .02, .27, .028], [.292, .041, .02, .05, .32, .04], [.284, .045, -.03, .07, .3, .045], [.276, .048, -.08, .09, .25, .04], [.297, .05, .045, -.02, .22, .03]];
      for (const [y, off, up, fwd, len, droop] of rows) {
        const root = new THREE.Vector3(MIDLINE_X + s * off, y, .881 - (off - .036) * .4);
        strand(root, new THREE.Vector3(s, up, .16 + fwd), len, droop, -.012 * s, .0009);
      }
      // Two brow whiskers above each eye.
      for (const [dx, up, len] of [[.045, .9, .13], [.07, .75, .15]]) strand(new THREE.Vector3(MIDLINE_X + s * dx, .452, .842), new THREE.Vector3(s * .5, up, .35), len, .012, 0, .0008);
    }
    this.whiskers = group;
  }

  // The jaw carries the lower lip and chin; the upper lip stays with the head,
  // so the lips part along the sculpted lip line.
  weightMouth(geometry, names) {
    const head = names.indexOf('head'), jaw = names.indexOf('jaw');
    const pos = geometry.attributes.position, si = geometry.attributes.skinIndex, sw = geometry.attributes.skinWeight;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), dx = x - MOUTH.midX, ax = Math.abs(dx);
      if (z < .78 || ax > .07 || y < .2 || y > .335) continue;
      let oldJaw = 0;
      for (let k = 0; k < 4; k++) if (si.getComponent(i, k) === jaw) oldJaw += sw.getComponent(i, k);
      // Rounded opening: fully open at the middle, pinching in at the corners.
      const c = fade(ax, MOUTH.halfWidth + .012, MOUTH.halfWidth * .35);
      const below = y < MOUTH.seamY(dx);
      // Below the lip line the jaw takes over; above it the upper lip stays on
      // the head, blending back to the original weights beside the mouth.
      // Beside the corners, the skin just under the lip line stays with the
      // head too, so the opening curves up into the corners instead of
      // tearing straight down.
      const drop = 1 + (fade(MOUTH.seamY(dx) - y, 0, .035) - 1) * fade(ax, .07, .04);
      const j = below ? c + (1 - c) * oldJaw * drop : (1 - c) * oldJaw * fade(ax, .04, .07);
      si.setXYZW(i, jaw, head, 0, 0);
      sw.setXYZW(i, j, 1 - j, 0, 0);
    }
    si.needsUpdate = sw.needsUpdate = true;
  }

  // Inside of the mouth: a dark cavity behind the lips (big enough to cover
  // the whole opening, corners included, so nothing shows through), a solid
  // floor and tongue on the jaw, and two small fangs tucked behind the
  // upper lip.
  addMouthInterior(bones) {
    const at = (bone, x, y, z) => new THREE.Vector3(x, y, z).sub(BONES[bone][1]);
    const cavity = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), new THREE.MeshStandardMaterial({color: '#34101a', roughness: .75, side: THREE.BackSide}));
    cavity.scale.set(.05, .032, .046);
    cavity.position.copy(at('head', MOUTH.midX, .276, .836));
    bones.head.add(cavity);
    const floor = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), new THREE.MeshStandardMaterial({color: '#5a1c26', roughness: .7}));
    floor.scale.set(.034, .008, .036);
    floor.position.copy(at('jaw', MOUTH.midX, .262, .832));
    bones.jaw.add(floor);
    // Solid pink from every side; it rests on the floor of the mouth.
    const tongueMat = new THREE.MeshPhysicalMaterial({color: '#d9727f', roughness: .45, clearcoat: .35, clearcoatRoughness: .35, side: THREE.DoubleSide});
    const tongue = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 16), tongueMat);
    tongue.scale.set(.019, .006, .03);
    tongue.position.copy(at('jaw', MOUTH.midX, .268, .83));
    bones.jaw.add(tongue);
    const fangGeo = new THREE.ConeGeometry(.0028, .009, 10);
    fangGeo.rotateX(Math.PI);
    const fangMat = new THREE.MeshPhysicalMaterial({color: '#f4efe4', roughness: .25, clearcoat: .6});
    this.fangs = [-1, 1].map(s => {
      const f = new THREE.Mesh(fangGeo, fangMat);
      f.position.copy(at('head', MOUTH.midX + s * .019, .2795, .858));
      bones.head.add(f);
      return f;
    });
    this.tongue = tongue;
    this.tongueRest = tongue.position.clone();
  }

  headTop(target = new THREE.Vector3()) { return this.head.localToWorld(target.set(0, .34, .05)); }
  headCenter(target = new THREE.Vector3()) { return this.head.localToWorld(target.set(0, .06, .12)); }
  twitchEar(i, strength = 1) { this.ears[i].vel += (Math.random() < .5 ? -10 : 8) * strength; }

  /**
   * ctl: {pose, poseRate, walk, knead, wiggle, purr, groom, swat, lift,
   *       head: {yaw, pitch, roll}, look: {x, y}, face, tail: {amp, speed}}
   */
  update(dt, t, ctl) {
    if (!this.ready) return;
    const B = this.bones, P = this.pose, target = POSES[ctl.pose === 'eat' ? 'crouch' : ctl.pose] || POSES.stand, rate = ctl.poseRate ?? 6;
    for (const k of POSE_KEYS) P[k] = damp(P[k], target[k], rate, dt);
    const sleeping = ctl.pose === 'sleep';
    const breathe = Math.sin(t * (sleeping ? 1.4 : 2.4)) * (sleeping ? .03 : .015);

    for (const b of Object.values(B)) b.quaternion.identity();
    for (const [name, q] of Object.entries(this.rest)) B[name].quaternion.copy(q);
    const rot = (name, x = 0, y = 0, z = 0) => B[name].quaternion.multiply(_q.setFromEuler(_e.set(x, y, z)));

    // Walk cycle: diagonal pairs move together.
    const walk = ctl.walk || 0;
    if (walk > .01) this.walkPhase += dt * (5 + walk * 6);
    const ph = this.walkPhase, stride = Math.min(1, walk) * .5;
    const swing = side => Math.sin(ph + side) * stride;
    // A paw lifts while it swings forward (its angle decreasing) and is down
    // while it pushes back.
    const lift = side => Math.max(0, -Math.cos(ph + side)) * Math.min(1, walk);

    rot('hips', P.pitch + (this.lean || 0) + Math.sin(ph * 2) * .02 * walk, (ctl.wiggle || 0) * Math.sin(t * 20) * .16 + P.curl * .5, P.roll);
    rot('spine', P.spine + breathe * .3, -(ctl.wiggle || 0) * Math.sin(t * 20) * .08 + P.curl);
    rot('chest', P.chest - breathe * .3, P.curl);
    rot('neck', P.neck, P.curl * .8);
    const h = ctl.head || {yaw: 0, pitch: 0, roll: 0};
    B.head.quaternion.multiply(_q.setFromEuler(_e.set(-(h.pitch + P.hPitch), h.yaw + P.hYaw, h.roll + P.hRoll, 'YXZ')));
    _e.order = 'XYZ';

    // Front legs, with kneading ("making biscuits"): paws press down in turn.
    const knead = ctl.knead ? 1 : 0;
    [['R', 0], ['L', Math.PI]].forEach(([s, side]) => {
      const press = knead * Math.max(0, Math.sin(t * 5.5 + side));
      let sh = P.shF + swing(side) - press * .35;
      let el = P.elF + lift(side) * .9 + press * .7;
      let wr = P.wrF - lift(side) * .4 - press * .45;
      if (ctl.groom && s === 'L') { sh = -.9 + Math.sin(t * 5) * .1; el = 2.0; wr = -.6; }
      // A swat (0..1): the right paw reaches up and forward.
      if (ctl.swat && s === 'R') { const k = ctl.swat; sh += (-1.35 - sh) * k; el += (.3 - el) * k; wr += (-.1 - wr) * k; }
      rot('shoulder' + s, sh);
      rot('elbow' + s, el);
      rot('wrist' + s, wr);
    });
    [['R', Math.PI], ['L', 0]].forEach(([s, side]) => {
      rot('hip' + s, P.shB + swing(side) * .9);
      rot('knee' + s, P.knB + lift(side) * .6);
      rot('hock' + s, P.hkB - lift(side) * .3);
    });

    this.tailUp = damp(this.tailUp || 0, ctl.tailUp || 0, 3, dt);
    this.poseTail(t, ctl.tail || {amp: .25, speed: 1.4});
    this.updateFace(dt, t, ctl.face || EXPRESSIONS.content, ctl.look || {x: 0, y: 0});

    // Breathing swell and purr shiver.
    const purr = ctl.purr ? Math.sin(t * 55) * .004 : 0;
    B.spine.scale.set(1 + breathe * .5 + purr, 1 + breathe + purr, 1);

    // Stand on the floor. Lower the body until the highest paw that should
    // be planted reaches the floor (the planting IK bends the others), but
    // never push the body itself or any other paw through it.
    this.model.position.y = 0;
    this.root.updateMatrixWorld(true);
    let low = Infinity, lowBody = Infinity, highPaw = -Infinity;
    this.contacts.forEach((c, i) => { const y = c.getWorldPosition(_v).y; low = Math.min(low, y); if (i >= 8) lowBody = Math.min(lowBody, y); });
    this.legs.forEach(leg => {
      leg.can = this.canPlant(leg, ctl, lift);
      const y = leg.sole.getWorldPosition(_v).y;
      if (leg.can && y - low < .14) highPaw = Math.max(highPaw, y);
    });
    const rest = highPaw > -Infinity ? Math.min(lowBody, highPaw) : low;
    const want = this.model.position.y - (rest - this.root.getWorldPosition(_v2).y) + (ctl.lift || 0);
    this.ground = this.ground === undefined ? want : damp(this.ground, want, 14, dt);
    this.model.position.y = this.ground;
    this.plantPaws(dt, t, ctl, lift);
    syncHelpers(this.bones);
  }

  // Planted paws: a paw in contact with the floor stays where it was put
  // down while the body moves over it (two-bone IK on the upper leg), and
  // takes a small lifted step when the body has drifted too far from it.
  // Walking legs plant during their stance phase only.
  plantPaws(dt, t, ctl, lift) {
    this.root.updateMatrixWorld(true);
    const floor = this.root.getWorldPosition(_v3).y;
    let stepping = this.legs.filter(l => l.step).length, reachGap = -Infinity, fronts = 0;
    for (const leg of this.legs) {
      const sole = leg.sole.getWorldPosition(_s1);
      const want = leg.can && sole.y - floor < .14;
      // While walking, a paw is put down exactly where it is (no blend in);
      // standing still, planting eases in.
      const walking = (ctl.walk || 0) > .01;
      leg.w = want && walking ? 1 : damp(leg.w, want ? 1 : 0, want ? 6 : 14, dt);
      if (!want) {
        leg.plant = null; leg.step = null;
        // A swinging paw may brush the floor but never go through it.
        if (sole.y < floor) this.reach(leg, _s2.copy(sole).setY(floor), sole);
        continue;
      }
      else if (!leg.plant) leg.plant = sole.clone().setY(floor);
      if (!leg.plant || leg.w < .01) continue;
      // Standing, sitting or turning on the spot: when the body has moved too
      // far from a paw, step it over. (Walking legs step by themselves.)
      const home = _s3.copy(sole).setY(floor);
      if (!leg.step && (home.distanceTo(leg.plant) > (walking ? .4 : .07)) && stepping < 2) {
        leg.step = {from: leg.plant.clone(), t0: t};
        stepping++;
      }
      const target = _s2.copy(leg.plant);
      if (leg.step) {
        const k = Math.min(1, (t - leg.step.t0) / .2), e = k * k * (3 - 2 * k);
        target.lerpVectors(leg.step.from, home, e).y += Math.sin(Math.PI * k) * .035;
        if (k >= 1) { leg.plant.copy(home); leg.step = null; stepping--; }
      }
      target.lerpVectors(sole, target, leg.w);
      const short = this.reach(leg, target, sole);
      if (leg.front && leg.w > .9) { reachGap = Math.max(reachGap, short); fronts++; }
    }
    // If a planted front paw can't reach the floor (its leg fully
    // stretched), lean the body forward just enough; when the front legs have
    // slack again, ease back.
    const L = .5, lean = this.lean || 0;
    const goal = !fronts ? 0 : reachGap > 0 ? lean + reachGap / L : lean - Math.max(0, -reachGap - .015) / L;
    this.lean = damp(lean, clamp(goal, 0, .45), 4, dt);
  }

  canPlant(leg, ctl, lift) {
    const allowed = {stand: 'all', sit: 'all', crouch: 'all', stretch: 'all', beg: 'hind'}[ctl.pose || 'stand'];
    if (!allowed || (allowed === 'hind' && leg.front) || (ctl.lift || 0) > .02) return false;
    if (leg.front && (ctl.knead || (ctl.groom && leg.s === 'L') || (ctl.swat > .05 && leg.s === 'R'))) return false;
    return !((ctl.walk || 0) > .01 && lift(leg.phase) > .03);
  }

  // Two-bone IK: turn the upper and middle bones so the sole reaches
  // `target`, keeping the paw's own orientation. Returns how far short the
  // leg falls (negative: how much slack it has left).
  reach(leg, target, sole) {
    const {a: A, b: Bn, c: C} = leg;
    const a = A.getWorldPosition(_ka), b = Bn.getWorldPosition(_kb), c = C.getWorldPosition(_kc);
    const t = _kt.copy(target).sub(sole).add(c); // where the wrist/hock joint must go
    const lab = a.distanceTo(b), lcb = b.distanceTo(c);
    const want = a.distanceTo(t);
    const lat = clamp(want, Math.abs(lab - lcb) + 1e-4, lab + lcb - 1e-4);
    const ang = (u, v) => Math.acos(clamp(u.dot(v), -1, 1));
    const ac = _k1.subVectors(c, a).normalize(), ab = _k2.subVectors(b, a).normalize();
    const ba = _k3.subVectors(a, b).normalize(), bc = _k4.subVectors(c, b).normalize(), at = _k5.subVectors(t, a).normalize();
    const acab0 = ang(ac, ab), babc0 = ang(ba, bc), acat0 = ang(ac, at);
    const acab1 = Math.acos(clamp((lcb * lcb - lab * lab - lat * lat) / (-2 * lab * lat), -1, 1));
    const babc1 = Math.acos(clamp((lat * lat - lab * lab - lcb * lcb) / (-2 * lab * lcb), -1, 1));
    // Bend in the leg's current plane (or, when it's straight, about its
    // own side-to-side axis, bending the way it last did).
    const axis0 = _k6.crossVectors(ac, ab);
    if (axis0.lengthSq() > 1e-8) { axis0.normalize(); leg.bendSign = Math.sign(axis0.dot(_x.clone().applyQuaternion(A.getWorldQuaternion(_kq)))) || 1; }
    else axis0.copy(_x).applyQuaternion(A.getWorldQuaternion(_kq)).multiplyScalar(leg.bendSign);
    const axis1 = _k7.crossVectors(ac, at);
    const aW = A.getWorldQuaternion(_kqa).invert(), bW = Bn.getWorldQuaternion(_kqb).invert();
    const cW = C.getWorldQuaternion(_kqc).clone();
    A.quaternion.multiply(_kq.setFromAxisAngle(_k8.copy(axis0).applyQuaternion(aW), acab1 - acab0));
    Bn.quaternion.multiply(_kq.setFromAxisAngle(_k8.copy(axis0).applyQuaternion(bW), babc1 - babc0));
    if (axis1.lengthSq() > 1e-10) A.quaternion.multiply(_kq.setFromAxisAngle(_k8.copy(axis1).normalize().applyQuaternion(aW), acat0));
    // Keep the paw's world orientation (so it stays flat on the floor).
    A.updateMatrixWorld(true);
    const parentW = Bn.getWorldQuaternion(_kq).invert();
    C.quaternion.copy(parentW.multiply(cW));
    C.updateMatrixWorld(true);
    return want - (lab + lcb);
  }

  // Tail: each segment is aimed along a smooth curve behind the cat.
  poseTail(t, tail) {
    const P = this.pose, B = this.bones;
    let parentQ = _pq.identity();
    // Tail up (a happy greeting): raised high, the tip hooked forward like a
    // question mark, with a little quiver.
    const up = this.tailUp || 0;
    let pitch = P.tailLift + (1.3 - P.tailLift) * up, yaw = 0;
    const curl = P.tailCurl + (-.16 - P.tailCurl) * up, side = P.tailSide * (1 - up);
    for (let i = 0; i < 8; i++) {
      const k = i / 7;
      const sway = Math.sin(t * tail.speed * 2 - i * .55) * tail.amp * (.25 + k) * .35 * (1 - up * .7) + up * Math.sin(t * 24 - i) * .02 * k;
      yaw += (i === 0 ? 0 : side * .14) + sway;
      if (i > 0) pitch += curl * (.4 + k);
      // Direction in the hips' frame: straight back is -z, rotated by pitch/yaw.
      _v.set(0, 0, -1).applyAxisAngle(_x, pitch).applyAxisAngle(_y, -yaw);
      // Carry the parent's rotation along, then bend by the smallest arc, so
      // the tail keeps a consistent twist from root to tip.
      _v2.copy(this.tailRest[i]).applyQuaternion(parentQ);
      const world = _q.setFromUnitVectors(_v2, _v).multiply(parentQ);
      const local = _q2.copy(parentQ).invert().multiply(world);
      B['tail' + i].quaternion.copy(local);
      parentQ = _pq.copy(world);
    }
  }

  updateFace(dt, t, f, look) {
    const u = this.faceUniforms;
    u.eyeOpen.value = clamp(f.open, 0, 1);
    u.eyeHappy.value = clamp(f.happy, 0, 1);
    u.eyePupil.value = clamp(f.pupil, 0, 1);
    u.eyeLook.value.set(look.x, look.y);
    u.eyeSparkle.value = f.sparkle;
    const m = clamp(f.mouth, 0, 1), tg = clamp(f.tongue || 0, 0, 1);
    u.mouthOpen.value = m;
    u.tongueOut.value = tg;
    const B = this.bones;
    B.jaw.quaternion.multiply(_q.setFromEuler(_e.set(m * .3 + tg * .1, 0, 0)));
    // Tongue: lapping/grooming pushes it forward past the lips.
    if (this.tongue) {
      // At rest it lies low and back, out of sight between closed lips.
      // Out for lapping or grooming, it rises over the lower lip (never
      // through it) and its tip drapes down a little.
      this.tongue.position.copy(this.tongueRest).add(_v.set(0, m * .003 + tg * .016, m * .003 + tg * .036));
      this.tongue.scale.set(.019, .006 + tg * .0015, .03 + tg * .006);
      this.tongue.rotation.x = tg * .25;
      // Closed lips leave a hairline gap; keep it a dark lip line.
      this.tongue.visible = m + tg > .03;
      for (const f of this.fangs) f.visible = m + tg > .05;
    }
    for (const [i, ear] of this.ears.entries()) {
      ear.vel += (-170 * ear.twitch - 10 * ear.vel) * dt;
      ear.twitch += ear.vel * dt;
      const name = i === 0 ? 'earR' : 'earL';
      // (The new rig's ears carry only the ear itself, not the crown, so a
      // flick turns them a little further to show as much.)
      const tw = this.opts.rig === 2 ? 1.6 : 1;
      B[name].quaternion.multiply(_q.setFromEuler(_e.set(-(f.earBack + ear.twitch * .5 * tw), 0, -ear.s * (f.earOut + ear.twitch * .2 * tw))));
    }
  }
}

const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _pq = new THREE.Quaternion();
const _e = new THREE.Euler(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3();
const _x = new THREE.Vector3(1, 0, 0), _y = new THREE.Vector3(0, 1, 0);
const _v3 = new THREE.Vector3(), _s1 = new THREE.Vector3(), _s2 = new THREE.Vector3(), _s3 = new THREE.Vector3();
const [_ka, _kb, _kc, _kt, _k1, _k2, _k3, _k4, _k5, _k6, _k7, _k8] = Array.from({length: 12}, () => new THREE.Vector3());
const _kq = new THREE.Quaternion(), _kqa = new THREE.Quaternion(), _kqb = new THREE.Quaternion(), _kqc = new THREE.Quaternion();
