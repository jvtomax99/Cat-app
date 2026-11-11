import * as THREE from 'three';
import {fresh, advance, care, mood} from './pet-state.js';
import {DECORS, applyDecor, inSeason, decorNow, applyKitchenDecor} from './decor.js';
import {load as loadSave, store as storeSave, keepStorage, toCode, fromCode, keys as saveKeys} from './save.js';
import {RealCat, EXPRESSIONS} from './real-cat.js';
import {MotionCat} from './motion-cat.js';
import {Room} from './room.js';
import {Kitchen} from './kitchen.js';
import {Sounds} from './sound.js';
import {openTitle} from './title.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';

const $ = s => document.querySelector(s);
const {damp, clamp, lerp} = THREE.MathUtils;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = list => list[Math.floor(Math.random() * list.length)];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const motion = reduceMotion ? 0.35 : 1;

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------
// save.js keeps every player's cat through updates (see there).
let storage = null;
try { storage = localStorage; } catch {}
const loaded = storage ? loadSave(storage) : null;
let pet = loaded ? loaded.pet : fresh();
keepStorage();
let saveWarned = false;
function save() {
  try { storeSave(storage, pet); }
  catch { if (!saveWarned) { toast('Browser storage is unavailable. Care will last for this visit.'); saveWarned = true; } }
}

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------
let toastTimer;
function toast(text) {
  const el = $('#toast');
  el.textContent = text;
  el.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('visible'), 3400);
}

const icon = (id, cls = '') => `<svg class="${cls}" aria-hidden="true"><use href="#${id}"/></svg>`;
const LEGACY_ICONS = {'♡': 'i-heart', '◡': 'i-bowl', '≋': 'i-brush', '✺': 'i-yarn', '☾': 'i-moon', '✦': 'i-sparkle'};
const ICON_TINT = {'i-drop': '--water', 'i-heart': '--love', 'i-bowl': '--food', 'i-brush': '--clean', 'i-yarn': '--happy', 'i-moon': '--energy', 'i-sparkle': '--accent', 'i-sun': '--energy'};

const NEEDS = [
  {key: 'food', label: 'Tummy', icon: 'i-bowl', tint: '--food'},
  {key: 'happiness', label: 'Joy', icon: 'i-heart', tint: '--happy'},
  {key: 'water', label: 'Water', icon: 'i-drop', tint: '--water'},
  {key: 'energy', label: 'Energy', icon: 'i-bolt', tint: '--energy'},
  {key: 'cleanliness', label: 'Fluff', icon: 'i-sparkle', tint: '--clean'},
];
const CIRC = 2 * Math.PI * 29;
for (const n of NEEDS) {
  const el = document.createElement('div');
  el.className = 'ring';
  el.id = 'ring-' + n.key;
  el.style.setProperty('--tint', `var(${n.tint})`);
  el.setAttribute('role', 'progressbar');
  el.setAttribute('aria-label', n.label);
  el.setAttribute('aria-valuemin', '0');
  el.setAttribute('aria-valuemax', '100');
  el.innerHTML = `<div class="ring-wrap"><svg class="dial" viewBox="0 0 70 70" aria-hidden="true"><circle class="track" cx="35" cy="35" r="29"/><circle class="bar" cx="35" cy="35" r="29" style="stroke-dashoffset:${CIRC}"/></svg><span class="ring-icon">${icon(n.icon)}</span></div><div><strong>0%</strong><small>${n.label}</small></div>`;
  $('#stats').append(el);
}

const LEVELS = [0, 15, 40, 100, 180, 300, 480, 750, 1100];
const LEVEL_NAMES = ['New friends', 'A familiar face', 'Growing closer', 'Best little friends', 'Kindred spirits', 'Inseparable', 'Soulmates', 'Hearts entwined', 'Legendary love'];
function levelInfo(bond) {
  let i = 0;
  while (i < LEVELS.length - 1 && bond >= LEVELS[i + 1]) i++;
  const lo = LEVELS[i], hi = LEVELS[i + 1] ?? lo + 500;
  return {level: i + 1, name: LEVEL_NAMES[i], progress: clamp((bond - lo) / (hi - lo), 0, 1), toGo: Math.max(0, Math.ceil(hi - bond))};
}
let shownLevel = levelInfo(pet.bond).level;

const MOOD_COLORS = {'Dreaming softly': '#8f9cff', 'A little hungry': '#f28c5b', 'A little thirsty': '#5b8def', 'Ready for a nap': '#e9ad2f', 'Needs a little brush': '#3fb3c9', 'Missing you': '#b48ad8', 'Feeling lovely': '#5cc489'};

function greeting() {
  const h = new Date().getHours();
  const part = h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  if (pet.sleeping) return `${part}. ${pet.name} is fast asleep — shh.`;
  if (pet.food < 40) return `${part}. ${pet.name} keeps glancing at the bowl…`;
  if (pet.water < 40) return `${part}. ${pet.name} is eyeing the fountain.`;
  if (pet.happiness < 35) return `${part}. ${pet.name} missed you.`;
  return `${part}. ${pet.name} is so happy you’re here.`;
}

// Night: the real evening, by the time of year (dusk about half an hour
// after sunset, until sunrise), unless you've switched it with the sun/moon
// button, which holds until the clock next turns. It isn't sleep: she may
// well be up and about at night (Rest puts her to bed, day or night).
const SUNSET = [16.9, 17.5, 18.2, 19.5, 20, 20.5, 20.4, 19.9, 19.1, 18.3, 16.7, 16.4];
const SUNRISE = [7.2, 6.9, 7.1, 6.5, 5.8, 5.5, 5.7, 6.2, 6.6, 7.1, 6.6, 7.1];
function clockNight(d = new Date()) {
  const h = d.getHours() + d.getMinutes() / 60, m = d.getMonth();
  return h >= SUNSET[m] + .5 || h < SUNRISE[m];
}
// (?night=1 or ?night=0 fixes it, for the review pack's day and evening shots.)
let forcedNight = {1: true, 0: false}[new URLSearchParams(location.search).get('night')] ?? null;
function isNight() {
  if (forcedNight != null) return forcedNight;
  const c = clockNight(), o = pet.nightOverride;
  if (o && o.clock !== c) delete pet.nightOverride;
  return pet.nightOverride ? pet.nightOverride.night : c;
}
let night = isNight();

function refresh() {
  night = isNight();
  const m = mood(pet);
  $('#pet-name').textContent = pet.name;
  $('#mood-text').textContent = m;
  $('#mood').style.setProperty('--mood', MOOD_COLORS[m] || '#5cc489');
  // Calendar days: a kitten adopted last night is on day 2 this morning.
  const midnight = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  $('#age').textContent = 'Day ' + Math.max(1, Math.round((midnight(Date.now()) - midnight(pet.born)) / 86400000) + 1);
  $('#greeting').textContent = greeting();
  for (const n of NEEDS) {
    const v = Math.round(pet[n.key]), el = $('#ring-' + n.key);
    el.querySelector('.bar').style.strokeDashoffset = String(CIRC * (1 - v / 100));
    el.querySelector('strong').textContent = v + '%';
    el.setAttribute('aria-valuenow', v);
    el.classList.toggle('low', v < 35);
  }
  const lv = levelInfo(pet.bond);
  $('#level').textContent = lv.level;
  $('#bond-label').textContent = lv.name;
  $('#xp-fill').style.width = (lv.progress * 100).toFixed(1) + '%';
  $('#xp-bar').setAttribute('aria-valuenow', Math.round(lv.progress * 100));
  $('#bond-next').textContent = lv.level >= LEVELS.length ? 'Max level — wow' : `${lv.toGo} to level ${lv.level + 1}`;
  $('#bond-count').textContent = pet.cuddles + ' cuddle' + (pet.cuddles === 1 ? '' : 's');
  if (lv.level > shownLevel) {
    const badge = $('.level-badge');
    badge.classList.remove('up'); void badge.offsetWidth; badge.classList.add('up');
    toast(`Friendship level ${lv.level}: ${lv.name}!`);
    moment(`Friendship grew: ${lv.name}.`, 'i-heart');
    if (ready) { express('joy', 2); burst('sparkle', 8); }
  }
  shownLevel = lv.level;
  $('#sleep-label').textContent = pet.sleeping ? 'Wake' : 'Rest';
  $('#sleep-icon').setAttribute('href', pet.sleeping ? '#i-sun' : '#i-bed');
  document.body.classList.toggle('night', night);
  document.querySelector('meta[name=theme-color]').content = night ? '#1c1612' : '#f7f1ea';
  $('#daynight').innerHTML = icon(night ? 'i-sun' : 'i-moon');
  $('#daynight').ariaLabel = $('#daynight').title = night ? 'Switch to day' : 'Switch to night';
  for (const b of document.querySelectorAll('.dock [data-action]')) {
    const off = pet.sleeping && b.dataset.action !== 'sleep';
    b.setAttribute('aria-disabled', String(off));
    b.classList.toggle('active', brain.mode === b.dataset.action || (b.dataset.action === 'sleep' && pet.sleeping));
  }
  $('#care-tip').textContent = pet.sleeping ? 'Resting restores energy, even while you’re away.'
    : pet.food < 40 ? 'A tasty snack would be lovely.'
    : pet.water < 40 ? 'Tap the fountain to invite a drink.'
    : pet.energy < 35 ? 'A nap will put the bounce back.'
    : pet.cleanliness < 30 ? 'Time for a gentle brush.'
    : pet.happiness < 35 ? 'A cuddle or a game would help.'
    : 'All good. Just be here.';
  // Her own name everywhere (buttons, the sound panel, the care guide).
  document.querySelectorAll('.pet-name-slot').forEach(el => { if (el.textContent !== pet.name) el.textContent = pet.name; });
  $('[data-cam="follow"]').title = $('[data-cam="follow"]').ariaLabel = `Follow ${pet.name}`;
  $('#vol-cat').ariaLabel = `${pet.name}'s volume`;
  $('#sound').innerHTML = icon(pet.sound ? 'i-sound' : 'i-mute');
  $('#sound-on').checked = pet.sound;
  $('#vol-cat').value = pet.catVolume;
  $('#sound-panel').classList.toggle('muted', !pet.sound);
  $('#scene-hint').textContent = brain.mode === 'play' ? 'Steer the toy · hold it still near your kitten to tempt a pounce'
    : pet.sleeping ? 'Shh… tap Wake when it’s time to play'
    : matchMedia('(pointer: coarse)').matches ? `Stroke ${pet.name} · tap ${perchHint()} to invite her · pinch to zoom` : `Stroke ${pet.name} to pet · click ${perchHint()} to invite her up · drag to look around · scroll to zoom`;
}

function showDeltas(before) {
  for (const n of NEEDS) {
    const d = Math.round(pet[n.key]) - Math.round(before[n.key]);
    if (!d) continue;
    const ring = $('#ring-' + n.key);
    const chip = document.createElement('span');
    chip.className = 'delta' + (d < 0 ? ' neg' : '');
    chip.textContent = (d > 0 ? '+' : '') + d;
    ring.append(chip);
    setTimeout(() => chip.remove(), 1700);
    if (d > 0) { ring.classList.remove('bump'); void ring.offsetWidth; ring.classList.add('bump'); }
  }
}

function moment(text, iconId = 'i-heart') {
  pet.journal.unshift({text, icon: iconId, time: Date.now()});
  pet.journal = pet.journal.slice(0, 12);
  renderJournal(true);
  save();
}
function renderJournal(fresh = false) {
  const list = $('#journal');
  list.replaceChildren();
  pet.journal.slice(0, 8).forEach((m, i) => {
    const id = LEGACY_ICONS[m.icon] || (String(m.icon).startsWith('i-') ? m.icon : 'i-heart');
    const li = document.createElement('li');
    li.className = 'moment' + (fresh && i === 0 ? ' new' : '');
    li.style.setProperty('--tint', `var(${ICON_TINT[id] || '--love'})`);
    const when = new Date(m.time);
    li.innerHTML = `<span class="moment-icon">${icon(id)}</span><div><strong></strong><small></small></div>`;
    li.querySelector('strong').textContent = m.text;
    li.querySelector('small').textContent = when.toLocaleDateString(undefined, {month: 'short', day: 'numeric'}) + ' · ' + when.toLocaleTimeString(undefined, {hour: 'numeric', minute: '2-digit'});
    list.append(li);
  });
  $('#journal-count').textContent = pet.journal.length;
}

// Speech bubble beside the kitten's head. She mostly speaks through what she
// does; words are kept for things you need to know (`important`) and the odd
// remark, at most one every 40 seconds or so.
let speechTimer, lastSay = -100;
function say(text, ms = 3600, important = false) {
  if (!important && (clockNow - lastSay < 40 || Math.random() > .4)) return;
  lastSay = clockNow;
  $('#speech-text').textContent = text;
  $('#speech').classList.add('show');
  clearTimeout(speechTimer);
  speechTimer = setTimeout(() => $('#speech').classList.remove('show'), ms);
}

// Little floating hearts, sparkles and z's rising from the kitten.
const headScreen = {x: 0, y: 0};
function burst(kind = 'heart', count = 5, at = headScreen) {
  for (let k = 0; k < count; k++) {
    setTimeout(() => {
      const s = document.createElement('span');
      s.className = 'floating' + (kind === 'z' ? ' zzz' : '');
      if (kind === 'z') s.textContent = 'z';
      else s.innerHTML = icon(kind === 'sparkle' ? 'i-sparkle' : kind === 'note' ? 'i-sound' : 'i-heart');
      s.style.setProperty('--c', kind === 'sparkle' ? '#f6b73c' : kind === 'note' ? '#8f9cff' : '#f2689a');
      s.style.left = (at.x + rand(-40, 40)) + 'px';
      s.style.top = (at.y + rand(-10, 30)) + 'px';
      s.style.fontSize = (kind === 'z' ? rand(16, 26) : rand(16, 30)) + 'px';
      s.style.setProperty('--drift', rand(-60, 60) + 'px');
      s.style.setProperty('--r0', rand(-40, 40) + 'deg');
      s.style.setProperty('--r1', rand(-25, 25) + 'deg');
      $('#float-layer').append(s);
      setTimeout(() => s.remove(), 2000);
    }, k * 110);
  }
}

// ---------------------------------------------------------------------------
// Sound (sound.js): recorded meows with a mouth that follows them, a purr,
// with one volume control (no background ambience).
// ---------------------------------------------------------------------------
const sounds = new Sounds();
sounds.enabled = pet.sound;
sounds.volume = {cat: pet.catVolume};
function meow(kind = 'meow', priority = 'reply') {
  const m = sounds.meow(kind, priority);
  if (!m) return false;
  // Subtle: a mew or meow parts the lips a little; a trill or a sleepy call
  // barely opens them (and purring, which doesn't come through here, keeps
  // the jaw closed).
  brain.mouthAnim = {start: clockNow, dur: m.dur + .08, env: m.env, rate: m.rate, peak: {mew: .36, meow: .45, chirp: .15, sleepy: .22}[kind] ?? .36};
  return true;
}
const purr = seconds => sounds.purr(seconds);
// Browsers only allow audio after a tap; start it on the first one anywhere.
// (iPhones only count the end of a touch, or a click, as permission; and
// after the app has been in the background its audio needs waking again.)
for (const ev of ['pointerdown', 'touchend', 'click']) document.addEventListener(ev, () => { if (pet.sound) sounds.setEnabled(true); }, {capture: true, passive: true});

// ---------------------------------------------------------------------------
// 3D room
// ---------------------------------------------------------------------------
const host = $('#scene');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, 1, .1, 60);
let renderer;
try {
  renderer = new THREE.WebGLRenderer({antialias: true, alpha: true, powerPreference: 'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.prepend(renderer.domElement);
} catch (e) {
  $('#loading strong').textContent = 'Your browser couldn’t open the 3D room.';
  $('#load-progress').textContent = 'Try a browser with WebGL enabled.';
  console.error(e);
}

const ambient = new THREE.HemisphereLight(0xfff0dc, 0x8a6446, 1.5);
scene.add(ambient);
const sun = new THREE.DirectionalLight(0xffdcae, 3.2);
sun.position.set(-3, 6, 4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, {left: -6, right: 6, top: 6, bottom: -6, far: 25});
sun.shadow.bias = -.0005;
sun.shadow.normalBias = .02;
scene.add(sun);
// Golden window light from behind-left gives Mochi a warm rim.
const rim = new THREE.DirectionalLight(0xffd29a, 1.8);
rim.position.set(-3, 4, -5);
scene.add(rim);
const moon = new THREE.DirectionalLight(0x9fb4ff, 0);
moon.position.set(-3, 4, -4);
scene.add(moon);
// A warm fill from the front so Mochi stays readable in the evening.
const fill = new THREE.DirectionalLight(0xffcf9a, 0);
fill.position.set(2, 3, 6);
scene.add(fill);

const mat = (color, roughness = .85) => new THREE.MeshStandardMaterial({color, roughness});
function mesh(geo, material, parent = scene) {
  const o = new THREE.Mesh(geo, material);
  o.castShadow = true; o.receiveShadow = true;
  parent.add(o);
  return o;
}
// The room: furniture, bowls, fountain and bed (room.js).
const room = new Room(scene, renderer, {mobile: matchMedia('(pointer: coarse)').matches});
room.id = 'study';
const {bowl, kibbles, fountain} = room;
let bed = room.bed;
// (A seasonal look is stored away out of season: ?decor=halloween shows one anyway.)
const DECOR_FORCE = new URLSearchParams(location.search).get('decor');
if (pet.decor !== decorNow(pet.decor, DECOR_FORCE)) { pet.decor = decorNow(pet.decor, DECOR_FORCE); save(); }
applyDecor(room, pet.decor);
// The study's lamp light belongs to the scene, so it can hang over whichever
// room she's in (the number of lights never changes, so nothing recompiles).
scene.attach(room.lamp);
const lampHome = room.lamp.position.clone();
// The kitchen (kitchen.js) is built the first time she goes there.
let kitchen = null, place = room;

// Toy ball.
let TOY_HOME = new THREE.Vector3(-1.15, .13, 1.35);
const toy = mesh(new THREE.SphereGeometry(.12, 28, 18), mat('#f2689a', .55));
toy.position.copy(TOY_HOME);
mesh(new THREE.TorusGeometry(.121, .012, 6, 32), mat('#ffe2a8'), toy).rotation.x = .6;
mesh(new THREE.TorusGeometry(.121, .012, 6, 32), mat('#ffe2a8'), toy).rotation.y = 1.2;
const toyTarget = TOY_HOME.clone(), toyVel = new THREE.Vector3(), toyLast = toy.position.clone();

// Grooming brush (shown while brushing).
const brushRig = new THREE.Group();
const brushTool = new THREE.Group();
mesh(new THREE.BoxGeometry(.34, .07, .16), mat('#ffb48f', .5), brushTool);
const bristles = mesh(new THREE.BoxGeometry(.3, .07, .13), mat('#fff6ea', .9), brushTool);
bristles.position.y = -.07;
const handle = mesh(new THREE.CylinderGeometry(.03, .035, .32, 12), mat('#ffb48f', .5), brushTool);
handle.rotation.z = Math.PI / 2; handle.position.set(.32, .02, 0);
brushTool.scale.setScalar(0);
brushRig.add(brushTool);

// ---------------------------------------------------------------------------
// Kitten
// ---------------------------------------------------------------------------
// The new movement (repaired rig, authored motion: motion-cat.js) is the
// default; ?motion=classic brings back the earlier animation for comparison
// or as a quick rollback.
const CLASSIC_MOTION = new URLSearchParams(location.search).get('motion') === 'classic';
const cat = new RealCat(CLASSIC_MOTION ? {} : {rig: 2});
scene.add(cat.root);
cat.root.add(brushRig);

// Soft contact shadow so the kitten feels grounded.
const shadowTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), grd = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grd.addColorStop(0, 'rgba(60,40,25,.4)'); grd.addColorStop(1, 'rgba(60,40,25,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
})();
const contact = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.2), new THREE.MeshBasicMaterial({map: shadowTex, transparent: true, depthWrite: false}));
contact.rotation.x = -Math.PI / 2; contact.position.y = .02;
cat.root.add(contact);

// Places in the room she's in: set by usePlace() for the study or the
// kitchen. home: where she settles; the bowl, fountain and bed spots; her
// perches; and the camera's limits there.
let HOME, EAT_SPOT, CUSHION_SPOT, DRINK_SPOT, PERCHES, SUN_SPOT, LIMITS, CAM_BOX, CAM_SOLIDS, CAM_BLOCKS;
const RUG = {x: -.4, z: .3, rx: 1.55, rz: 1.2};
function studyLayout() {
  const w = room.windowGroup, c = room.chair, f = room.fireplace;
  w.updateMatrixWorld(true); c.updateMatrixWorld(true); f.updateMatrixWorld(true);
  return {
    home: new THREE.Vector3(0, 0, .3), toyHome: new THREE.Vector3(-1.15, .13, 1.35),
    sunSpot: new THREE.Vector3(room.sunPatch.position.x + .2, 0, room.sunPatch.position.z + .3),
    // Places she jumps up to. spot: where she sits; top: its height; base:
    // where she jumps from and back down to; face: the way she sits there.
    perches: {
      // The window sill, from her bed just below it.
      sill: {spot: w.localToWorld(new THREE.Vector3(-.05, 0, room.sillDepth * .5)).setY(0), top: room.sillTop,
        base: new THREE.Vector3(room.bed.position.x, 0, room.bed.position.z - .3), face: Math.PI},
      chair: {spot: c.localToWorld(new THREE.Vector3(0, 0, .3)).setY(0), top: room.chairSeatTop,
        base: c.localToWorld(new THREE.Vector3(0, 0, 1.45)).setY(0), face: c.rotation.y},
      // The mantel shelf, beside the vase, facing the room; she takes off
      // from the floor just in front of the hearth.
      mantel: {spot: f.localToWorld(new THREE.Vector3(-.3, 0, .36)).setY(0), top: room.mantelTop,
        base: f.localToWorld(new THREE.Vector3(-.3, 0, 1.5)).setY(0), face: -Math.PI / 2},
    },
    perchTargets: [['sill', room.windowGroup], ['chair', room.chair], ['mantel', room.fireplace]],
    limits: {dist: [1.1, 13], pitch: [.04, 1.25], x: [-4.1, 4.1], z: [-2.9, 3.8], y: [.08, 2.4]},
    // The camera stays inside the room (it may stand back past the open
    // front) and out of the tall furniture: [x, z, radius, height].
    camBox: {x: [-4.3, 3.75], y: [.2, 6.5], z: [-3.1, 16]},
    camSolids: [[2.45, -2.0, 1.3, 2.3], [.55, -2.85, .75, 2.6], [4.0, -1.45, .6, 3.2], [4.2, 1.1, .7, 2.8], [-2.35, -1.75, 1.0, .55]],
  };
}
// The study and the kitchen are joined: the doorway in the study's left wall
// is the opening in the kitchen's back wall. The room she's in stands at the
// origin and the other is set beyond the doorway, so each is seen through it
// from the other (with its floor cut to the room, under that doorway too).
// (The kitchen's opening, x 3.8 to 6.2 in its back wall at z -4.2, .45 deep,
// meets the study's at z -.1 to 2.3 in its left wall at x -4.6.)
const JOIN = {kitchen: {p: [-9.25, 0, -3.9], ry: -Math.PI / 2}, room: {p: [3.9, 0, -9.25], ry: Math.PI / 2}};
function floorPatch(floor, x0, x1, z0, z1) {
  const S = floor.geometry.parameters.width, geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
  geo.rotateX(-Math.PI / 2); geo.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
  // The same pattern as the whole floor, in the same place.
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + S / 2) / S, (S / 2 - pos.getZ(i)) / S);
  // (Drawn over the other floor, never fighting it for the same pixels.)
  const m = new THREE.Mesh(geo, Object.assign(floor.material.clone(), {polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4}));
  m.receiveShadow = true; m.position.y = floor.position.y + .004; m.visible = false;
  floor.parent.add(m);
  return m;
}
function joinRooms() {
  room.group.visible = true;
  if (!kitchen) return;
  room.floorPatch ??= floorPatch(room.floor, room.walls.left, room.walls.right, room.walls.back, 8.6);
  kitchen.floorPatch ??= floorPatch(kitchen.floor, -6, 7, -4.65, 14);
  for (const [id, r] of [['room', room], ['kitchen', kitchen]]) {
    const here = r === place, j = JOIN[id];
    r.group.visible = true;
    r.group.position.set(...(here ? [0, 0, 0] : j.p)); r.group.rotation.set(0, here ? 0 : j.ry, 0);
    r.group.updateMatrixWorld(true);
    r.floor.visible = here; r.floorPatch.visible = !here;
    if (here) r.group.traverse(o => o.layers.set(SEEN));
  }
}
// The other room is only drawn while the doorway is in view, and then only
// what can be seen through it (the rest is hidden behind the walls anyway).
const doorBox = new THREE.Box3(), doorView = new THREE.Frustum(), doorPV = new THREE.Matrix4();
const portal = new THREE.Frustum(), doorPts = [0, 1, 2, 3].map(() => new THREE.Vector3()), beyond = new THREE.Vector3();
const SEEN = 0, UNSEEN = 31;
function doorwayInView() {
  const d = room.door;
  doorBox.min.set(room.walls.left - .45, 0, d.z0); doorBox.max.set(room.walls.left, d.top, d.z1);
  doorBox.applyMatrix4(room.group.matrixWorld);
  camera.updateMatrixWorld();
  return doorView.setFromProjectionMatrix(doorPV.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)).intersectsBox(doorBox);
}
function cullThroughDoor(other) {
  // The opening on the camera's side of the wall, in the world.
  const d = room.door, x = room.walls.left - (place === room ? 0 : .45), C = camera.position;
  [[d.z0, 0], [d.z1, 0], [d.z1, d.top], [d.z0, d.top]].forEach(([z, y], i) => doorPts[i].set(x, y, z).applyMatrix4(room.group.matrixWorld));
  beyond.addVectors(doorPts[0], doorPts[2]).sub(C); // (as far past the opening as the camera is before it)
  // Four planes through the camera and the opening's edges, and the opening.
  for (let i = 0; i < 4; i++) {
    const pl = portal.planes[i].setFromCoplanarPoints(C, doorPts[i], doorPts[(i + 1) % 4]);
    if (pl.distanceToPoint(beyond) < 0) pl.negate();
  }
  const door = portal.planes[4].setFromCoplanarPoints(doorPts[0], doorPts[1], doorPts[2]);
  if (door.distanceToPoint(C) > 0) door.negate();
  portal.planes[5].copy(door);
  // (A few centimetres' margin, so nothing pops at the opening's edges; a
  // cluster of leaves is tested as the whole cluster, not one leaf.)
  for (const pl of portal.planes) pl.constant += .25;
  other.group.traverse(o => {
    if (!o.geometry) return;
    if (o.isInstancedMesh && !o.boundingSphere) o.computeBoundingSphere();
    o.layers.set(portal.intersectsObject(o) ? SEEN : UNSEEN);
  });
}
function usePlace(p) {
  place = p;
  joinRooms();
  const L = p.layoutCache ??= p === room ? studyLayout() : p.layout();
  // Her bowl and fountain come with her.
  for (const [obj, spot] of [[bowl, L.bowl], [fountain, L.fountain]]) {
    const home = obj.userData.studyHome ??= {p: obj.position.clone(), r: obj.rotation.y};
    (p === room ? room.group : p.group).add(obj);
    obj.position.copy(spot ? spot.p : home.p); obj.rotation.y = spot ? spot.ry : home.r;
  }
  // (So does Halloween's felt bat toy.)
  if (room.altToy) (p === room ? room.group : p.group).add(room.altToy);
  bed = p.bed;
  HOME = L.home; TOY_HOME = L.toyHome; SUN_SPOT = L.sunSpot; PERCHES = L.perches;
  LIMITS = L.limits; CAM_BOX = L.camBox; CAM_SOLIDS = L.camSolids; CAM_BLOCKS = L.camBlocks || [];
  const toHome = new THREE.Vector3().subVectors(HOME, bowl.position).setY(0).normalize();
  EAT_SPOT = bowl.position.clone().addScaledVector(toHome, .86).setY(0);
  CUSHION_SPOT = new THREE.Vector3(bed.position.x, 0, bed.position.z);
  if (L.bedOffset) CUSHION_SPOT.add(L.bedOffset);
  const toFountain = new THREE.Vector3().subVectors(HOME, fountain.position).setY(0).normalize();
  DRINK_SPOT = fountain.position.clone().addScaledVector(toFountain, 1.0).setY(0);
  if (p === room) room.lamp.position.copy(lampHome); else p.activate(room.lamp);
}
// Something she's knocked over lands: a soft clink or thud (if sound's on).
const onLand = kind => sounds.knock(kind);
// The kitchen, dressed like the study (decor.js).
function buildKitchen() {
  kitchen = new Kitchen(scene, room);
  kitchen.onLand = onLand;
  applyKitchenDecor(kitchen, room.decor);
  return kitchen;
}
if (pet.place === 'kitchen') buildKitchen();
usePlace(pet.place === 'kitchen' ? kitchen : room);
function onRug(v) {
  if (place !== room) return place.clampFloor(v);
  const dx = (v.x - RUG.x) / RUG.rx, dz = (v.z - RUG.z) / RUG.rz, r = Math.hypot(dx, dz);
  if (r > 1) { v.x = RUG.x + dx / r * RUG.rx; v.z = RUG.z + dz / r * RUG.rz; }
  return v;
}
const randomRugPoint = () => place !== room ? place.randomFloorPoint() : onRug(new THREE.Vector3(rand(-1.4, 1.4), 0, rand(-.7, 1.2)));

// ---------------------------------------------------------------------------
// The opening screen (title.js): the logo and Play over the live room, and
// the very first time a short film. ?title=0 skips it and ?title=film plays
// the film again; the QA tools and the review pack (?debug) open straight on
// the room.
// ---------------------------------------------------------------------------
const titleAsk = new URLSearchParams(location.search);
let titleView = null, titleToys = null, titleDay = null;
const title = openTitle({
  mode: !renderer || titleAsk.get('title') === '0' || (titleAsk.has('debug') && !titleAsk.has('title')) ? 'off' : titleAsk.get('title') === 'film' ? 'film' : 'auto',
  storage, key: saveKeys().main + '-intro',
  onReveal: () => titleReveal(), onPlay: () => greet(true), onEnter: () => titleEnter(),
  onPointer: e => { if (!pet.sleeping) trackPointer(e); }, onTap: e => titleTap(e),
});
// The film is in daylight, so the room it hands over to is too, until Play.
// (Before the first refresh(), further down, which lights the room.)
if (title.film) { titleDay = {was: forcedNight}; forcedNight = false; night = false; }

let ready = false;
cat.load('./assets/mochi-ragdoll.glb', p => {
  if (!p.total) return;
  const pct = Math.round(p.loaded / p.total * 100);
  title.progress(pct);
  $('#load-fill').style.width = pct + '%';
  $('#load-progress').textContent = pct < 100 ? pct + '% · bringing your kitten home' : 'Fluffing the fur…';
}).then(() => {
  if (!CLASSIC_MOTION) { const motion = new MotionCat(cat); cat.update = (dt, t, ctl) => motion.update(dt, t, ctl); cat.motion = motion; }
  ready = true;
  // The kitchen through the study's doorway (built once she's home).
  if (!kitchen) setTimeout(() => { if (!kitchen) { buildKitchen(); joinRooms(); } }, 400);
  host.classList.add('ready');
  $('#loading').classList.add('done');
  setTimeout(() => $('#loading').hidden = true, 900);
  // (Behind the opening screen she says hello when Play is pressed.)
  if (title.on) title.ready(); else greet(true);
}).catch(e => {
  title.abort();
  $('#loading strong').textContent = 'Your kitten couldn’t load.';
  $('#load-progress').textContent = 'Please reload to try again.';
  console.error(e);
});

// ---------------------------------------------------------------------------
// Behaviour: what the kitten is doing, how it feels, where it looks
// ---------------------------------------------------------------------------
let clockNow = 0;
const brain = {
  mode: 'idle', modeStart: 0, modeUntil: 0,
  activity: 'sit', actStart: 0, actUntil: Infinity, after: null,
  pos: HOME.clone(), heading: 0, speed: 0, target: null, run: false, elevation: 0,
  override: null, overrideUntil: 0,
  face: {...EXPRESSIONS.content},
  blinkAt: -10, nextBlink: 1.5, blinkDouble: false, slowBlinkAt: -10,
  mouthAnim: null, rubUntil: 0, tailUpUntil: 0, chewUntil: 0, yawnAt: -10, hopAt: -10, kneadUntil: 0, strokeUntil: 0,
  gaze: new THREE.Vector3(0, 1.2, 4), headGaze: new THREE.Vector3(0, 1.2, 4), headWait: null, headMoving: false,
  bodyWait: null, bodyTurning: false, glance: null, glanceUntil: 0,
  head: {yaw: 0, pitch: 0, roll: 0}, look: {x: 0, y: 0}, reach: {z: 0, dip: 0, pitch: 0},
  nextIdle: 6, nextShow: 10, nextZ: 0, nextTwitch: 3,
  pointerAt: -10, pointerWorld: new THREE.Vector3(),
  pounce: null, pounceReadyAt: 0, stillSince: 0, catches: 0, playEnd: 0,
  petTimes: [],
  perch: null, perchUntil: 0, jump: null, jumpFace: 0, nextVacuum: 1e9, vacReactAt: 0, vacStalk: false, vacRide: false, nextBird: 12, birdSeen: false, nextKnock: 0, swatHit: 0,
};
if (pet.sleeping) { brain.activity = 'sleep'; brain.pos.copy(CUSHION_SPOT); brain.heading = .6; }

function express(name, seconds) { brain.override = name; brain.overrideUntil = clockNow + seconds; }
function hop() { if (!reduceMotion) brain.hopAt = clockNow; }
function slowBlink() { brain.slowBlinkAt = clockNow; }
function yawn() { brain.yawnAt = clockNow; }
function glanceAt(point, seconds) { brain.glance = point.clone(); brain.glanceUntil = clockNow + seconds; }
function twitchEar(side = Math.random() < .5 ? 0 : 1, strength = 1) { cat.twitchEar(side, strength); }

function setActivity(name, seconds = Infinity, after = null) {
  brain.activity = name;
  brain.actStart = clockNow;
  brain.actUntil = clockNow + seconds;
  brain.after = after;
}
function walkTo(point, then = null, run = false, anywhere = false) {
  // Mid-jump: go there once she lands. Up on a perch: hop down first.
  if (brain.jump) { brain.jump.then = () => walkTo(point, then, run, anywhere); return; }
  if (brain.perch) { brain.climbGoal = 'floor'; jumpDown(() => walkTo(point, then, run, anywhere)); return; }
  const target = anywhere ? point.clone() : onRug(point.clone());
  // In the kitchen she goes round the island, not through it.
  if (place.route) {
    const path = place.route(brain.pos, target);
    if (path.length > 1) { walkTo(path[0], () => walkTo(target, then, run, true), run, true); return; }
  }
  brain.target = target;
  brain.run = run;
  brain.faceAt = null;
  const dist = Math.hypot(brain.target.x - brain.pos.x, brain.target.z - brain.pos.z);
  setActivity('walk', 8 + dist / (run ? 1.2 : .45), then);
}
// Jumping: a crouch and a little wiggle while she sizes it up, then an arc to
// the new spot and height, and a soft landing.
const groundAt = p => Math.hypot(p.x - bed.position.x, p.z - bed.position.z) < place.bedRadius ? place.bedTop : 0;
function leap(to, toY, perch, then = null, out = 0) {
  brain.target = null;
  brain.chainUntil = clockNow + 6;
  brain.jumpFace = angleTo(brain.pos, to);
  glanceAt(new THREE.Vector3(to.x, toY + .3, to.z), 1.2);
  setActivity('prejump', reduceMotion ? .3 : chainNext() ? rand(.5, .9) : .8, () => {
    const up = toY - brain.elevation;
    brain.jump = {from: brain.pos.clone(), fromY: brain.elevation, to: to.clone(), toY, perch, fromPerch: brain.perch, then, start: clockNow, dur: .5 + Math.abs(up) * .06, arc: .18 + Math.max(0, up) * .22, out};
    setActivity('jump');
  });
}
function jumpTo(name, then = null, stay = 40, inner = false) {
  const P = PERCHES[name];
  if (!P || brain.perch === name) { then?.(); return; }
  if (!inner) brain.climbGoal = name;
  // A perch reached by way of another (the kitchen's step, counter and
  // shelves): up from the one below; from higher up, come down to it first.
  if (P.via) {
    if (brain.perch === P.via && !brain.jump) { if (backToSpot(() => jumpTo(name, then, stay, true))) return; leap(P.spot, P.top, name, () => { brain.perchUntil = clockNow + stay; then ? then() : setActivity('sit'); }); return; }
    if (brain.perch && PERCHES[brain.perch]?.top > P.top) { jumpDown(() => jumpTo(name, then, stay, true)); return; }
    jumpTo(P.via, () => jumpTo(name, then, stay, true), 5, true);
    return;
  }
  // Up on something else: down to the floor first.
  if (brain.perch && !brain.jump) { jumpDown(() => jumpTo(name, then, stay, true)); return; }
  // Only jump from the take-off spot (a walk can end early if it ran out of
  // time); otherwise keep walking there, or give up after a few tries.
  const go = tries => walkTo(P.base, () => {
    if (Math.hypot(brain.pos.x - P.base.x, brain.pos.z - P.base.z) > .3) { if (tries < 3) go(tries + 1); else setActivity('sit'); return; }
    leap(P.spot, P.top, name, () => { brain.perchUntil = clockNow + stay; then ? then() : setActivity('sit'); });
  }, false, true);
  go(0);
}
function jumpDown(then = null) {
  const P = PERCHES[brain.perch];
  brain.climbGoal ??= 'floor';
  if (backToSpot(() => jumpDown(then))) return;
  // (Off the pendant shade she drops straight down onto the counter.)
  if (P.dropTo) { leap(P.dropTo.at, P.dropTo.top, P.dropTo.perch, then); return; }
  // Down the way she went up, one perch at a time.
  if (P.via) { const U = PERCHES[P.via]; leap(U.spot, U.top, P.via, then); return; }
  leap(P.base, groundAt(P.base), null, then);
}
// Partway up (or down) a run of perches: where she's headed next, so her
// eyes and body stay on it rather than turning back to you at each landing.
function chainNext() {
  const g = brain.climbGoal;
  if (g == null || brain.jump || !brain.perch || g === brain.perch || clockNow > brain.chainUntil) return null;
  const cur = PERCHES[brain.perch];
  if (!cur) return null;
  if (g !== 'floor' && PERCHES[g]) {
    let n = g;
    while (n && PERCHES[n].via !== brain.perch) n = PERCHES[n].via;
    if (n) return chainPt.set(PERCHES[n].spot.x, PERCHES[n].top + .25, PERCHES[n].spot.z);
  }
  return cur.via ? chainPt.set(PERCHES[cur.via].spot.x, PERCHES[cur.via].top + .25, PERCHES[cur.via].spot.z) : chainPt.set(cur.base.x, .25, cur.base.z);
}
const chainPt = new THREE.Vector3();
// Along a shelf (after a cup, say), she walks back to where she landed
// before jumping on or down.
function backToSpot(then) {
  const P = PERCHES[brain.perch];
  if (!P || brain.jump || Math.hypot(brain.pos.x - P.spot.x, brain.pos.z - P.spot.z) < .3) return false;
  // Along a shelf: back down the lane, then in to the landing spot.
  walkPath(P.lane && Math.abs(brain.pos.z - P.lane.z) < .2 ? [new THREE.Vector3(P.spot.x + .25, 0, P.lane.z), P.spot] : [P.spot], then);
  return true;
}
// Walking up on something (a shelf, the counter, the island): point to point,
// at the height she's at.
function walkPath(points, then) {
  // (Out of the sink first: she doesn't walk through its sides.)
  if (inSink() && !brain.jump) { outOfSink(() => walkPath(points, then)); return; }
  const [p, ...rest] = points;
  if (!p) { then?.(); return; }
  brain.target = p.clone();
  setActivity('walk', 3 + Math.hypot(p.x - brain.pos.x, p.z - brain.pos.z) / .4, () => walkPath(rest, then));
}
// Her own finds (salmon off the island, a drink from the tap, a cup sent
// flying, a ride) count toward her needs, shown like your care is.
function treat(d) {
  const before = {...pet};
  for (const [k, v] of Object.entries(d)) pet[k] = Math.max(0, Math.min(100, pet[k] + v));
  showDeltas(before); save(); refresh();
}
// Timers on the game clock (so a recorded clip keeps true time).
const timers = [];
function later(seconds, fn) { timers.push({at: clockNow + seconds, fn}); }
function runTimers(t) {
  for (let i = timers.length - 1; i >= 0; i--) if (t >= timers[i].at) { const {fn} = timers[i]; timers.splice(i, 1); fn(); }
}
function restingActivity() {
  if (pet.sleeping) return 'sleep';
  return pet.energy < 30 ? 'loaf' : 'sit';
}

function baseExpression() {
  if (pet.sleeping) return 'asleep';
  if (pet.energy < 35) return 'sleepy';
  if (pet.food < 40 || pet.water < 40) return 'hungry';
  if (pet.cleanliness < 40) return 'grumpy';
  if (pet.happiness < 45) return 'lonely';
  return 'content';
}
function currentExpression() {
  const a = brain.activity, since = clockNow - brain.actStart;
  if (clockNow < brain.overrideUntil) return brain.override;
  if (a === 'sleep' || a === 'catnap') return 'asleep';
  if (pet.sleeping) return 'sleepy';
  if (a === 'prejump') return 'curious';
  if (a === 'eat') return since < .5 ? 'curious' : 'yum';
  if (a === 'drink') return since < .5 ? 'curious' : 'bliss';
  if (a === 'groom') return 'groom';
  if (a === 'belly') return pet.bond >= 40 ? 'love' : 'joy';
  if (a === 'stretch') return 'sleepy';
  if (a === 'beg') return 'hungry';
  if (brain.mode === 'brush') return 'bliss';
  if (brain.mode === 'play' || brain.mode === 'solo') return 'excited';
  if (clockNow < brain.strokeUntil) return 'bliss';
  return baseExpression();
}

function greet(first = false) {
  if (!ready) return;
  if (pet.sleeping) { say(pick(['Zzz… dreaming of tiny adventures.', 'Zzz… mrrp… fish…']), 3800); return; }
  express('surprised', .6);
  setTimeout(() => { express('joy', 1.8); hop(); meow('mew'); burst('heart', 4); }, 600);
  const lines = pet.food < 40 ? ['You’re back! Is it… snack o’clock?'] : pet.happiness < 45 ? ['There you are! I missed you.'] : first ? ['Oh! Hi, you! Got a little time for me?', 'Mrrp! You came back!', 'Hello, my favourite human.'] : ['Welcome back!', 'Mrrp! There you are.'];
  setTimeout(() => say(pick(lines), 3600, first), 450);
  brain.tailUpUntil = clockNow + 4;
}

const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3(), tmpV3 = new THREE.Vector3();
// Where her mouth goes when she eats or drinks: the kibble in the middle of
// the bowl, the water at the near edge of the fountain, or the salmon or the
// faucet's trickle in the kitchen (a column: she laps at it wherever her
// mouth meets it).
function mouthTarget(a, out, mouthY = 0) {
  if (brain.eatAt && brain.lapStream) return out.copy(brain.eatAt).setY(clamp(mouthY, brain.eatAt.y - .04, brain.eatAt.y + .75));
  if (brain.eatAt) return out.copy(brain.eatAt).setY(brain.eatAt.y + (a === 'eat' ? .02 : 0));
  const c = a === 'eat' ? bowl.position : fountain.position;
  const dx = brain.pos.x - c.x, dz = brain.pos.z - c.z, d = Math.hypot(dx, dz) || 1;
  const r = a === 'eat' ? .05 : .27;
  return out.set(c.x + dx / d * r, a === 'eat' ? .12 : .225, c.z + dz / d * r);
}
const angleTo = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);
function dampAngle(a, b, rate, dt) {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * (1 - Math.exp(-rate * dt));
}

function updateCat(dt, t) {
  // --- Activity flow -------------------------------------------------------
  if (t > brain.actUntil) {
    const next = brain.after;
    brain.after = null;
    if (next) next(); else setActivity(restingActivity());
  }
  if (pet.sleeping && !['sleep', 'walk', 'prejump', 'jump', 'land', 'poise'].includes(brain.activity)) setActivity('sleep');

  // --- Moving around ---------------------------------------------------------
  const a = brain.activity;
  let desiredHeading = null;
  const pc = brain.pounce;
  if (a === 'walk' && brain.target) {
    const dx = brain.target.x - brain.pos.x, dz = brain.target.z - brain.pos.z, dist = Math.hypot(dx, dz);
    desiredHeading = Math.atan2(dx, dz);
    const facing = Math.abs(Math.atan2(Math.sin(desiredHeading - brain.heading), Math.cos(desiredHeading - brain.heading)));
    // (Running: a trot. A dash or zoomies, 2.6, is flat out: a gallop.)
    const top = typeof brain.run === 'number' ? brain.run : brain.run ? 2.1 : .65;
    brain.speed = damp(brain.speed, facing < .8 ? Math.min(top, dist * 2.5 + .2) : .15, 5, dt);
    if (dist < .06) {
      brain.speed = 0;
      brain.target = null;
      brain.stuck = null;
      const next = brain.after;
      brain.after = null;
      if (next) next(); else setActivity(restingActivity());
    } else if (!brain.jump && !brain.perch) {
      // Not getting anywhere (blocked by the vacuum, say): look for another
      // way round; after a few tries, give up and sit, eyeing what's in the way.
      const s = brain.stuck ??= {x: brain.pos.x, z: brain.pos.z, t, tries: 0};
      if (t - s.t > .8) {
        if (Math.hypot(brain.pos.x - s.x, brain.pos.z - s.z) < .06) {
          const target = brain.target, next = brain.after, tries = s.tries + 1;
          brain.after = null; brain.target = null; brain.speed = 0;
          if (tries < 3) { walkTo(target, next, brain.run, true); brain.stuck = {x: brain.pos.x, z: brain.pos.z, t, tries}; }
          else {
            // (Whatever she was on her way to do, she still does, from here.)
            brain.stuck = null;
            if (next) next(); else setActivity('sit', rand(2, 4));
            if (place === kitchen) glanceAt(kitchen.vacuum.position.clone().setY(.2), 2);
          }
        } else Object.assign(s, {x: brain.pos.x, z: brain.pos.z, t});
      }
    }
  } else if (!pc) {
    brain.speed = damp(brain.speed, 0, 8, dt);
  }
  const J = brain.jump;
  if (J) {
    const k = Math.min(1, (t - J.start) / J.dur), e = k * k * (3 - 2 * k);
    brain.pos.lerpVectors(J.from, J.to, e);
    // (Between shelves she arcs out past the edge of the one above.)
    if (J.out) brain.pos.z += J.out * Math.sin(Math.PI * k);
    brain.elevation = J.fromY + (J.toY - J.fromY) * e + 4 * J.arc * k * (1 - k);
    desiredHeading = angleTo(J.from, J.to);
    if (k >= 1) {
      brain.jump = null;
      brain.perch = J.perch;
      brain.elevation = J.toY;
      // Landing on the pendant shade sets it swinging (on, and off it).
      if (place === kitchen && (J.perch === 'pendant' || J.fromPerch === 'pendant')) {
        const dx = J.to.x - J.from.x, dz = J.to.z - J.from.z, d = Math.hypot(dx, dz) || 1, s = J.perch === 'pendant' ? .45 : -.3;
        kitchen.bumpPendant(-dz / d * s, dx / d * s, rand(-.8, .8));
      }
      if (brain.climbGoal != null && (J.perch === brain.climbGoal || (brain.climbGoal === 'floor' && !J.perch))) brain.climbGoal = null;
      // Partway along a climb: sometimes straight on, sometimes a moment
      // balancing on her feet, sometimes a brief sit, eyes on the next perch.
      if (J.then && chainNext()) {
        const then = J.then, r = Math.random();
        setActivity('land', rand(.22, .38), () => r < .3 ? then() : r < .7 ? setActivity('poise', rand(.4, .9), then) : setActivity('sit', rand(.7, 1.4), then));
      } else setActivity('land', .4, J.then);
    }
  }
  if (a === 'prejump') desiredHeading = brain.jumpFace;
  if (pc) {
    const p = (t - pc.start) / 1.3;
    if (p < .5) desiredHeading = angleTo(brain.pos, pc.at ? pc.at() : toy.position);
    else if (p < .82) { const k = (p - .5) / .32; brain.pos.lerpVectors(pc.from, pc.to, k * k * (3 - 2 * k)); if (!pc.caught && k > .7) { if (pc.onHit) { pc.caught = true; pc.onHit(); } else catchToy(); } }
    else if (p >= 1) brain.pounce = null;
  } else if (!J) {
    brain.pos.x += Math.sin(brain.heading) * brain.speed * dt;
    brain.pos.z += Math.cos(brain.heading) * brain.speed * dt;
  }
  // Never through the furniture, however she's moving on the floor.
  if (place.pushOut && !J && !brain.perch && brain.elevation < .05) place.pushOut(brain.pos);
  // Up on the big pendant shade: she goes where it swings.
  if (brain.perch === 'pendant' && !J && place === kitchen) {
    const top = kitchen.pendantTop(tmpV); brain.pos.x = top.x; brain.pos.z = top.z; brain.elevation = top.y;
  }
  // Riding the robot vacuum: she goes where it goes, facing the way it does.
  if (brain.perch === 'vacuum' && !J && place === kitchen) {
    brain.pos.x = kitchen.vacuum.position.x; brain.pos.z = kitchen.vacuum.position.z;
    if (a !== 'prejump') desiredHeading = kitchen.vac.heading;
  }
  if (a === 'eat') desiredHeading = angleTo(brain.pos, brain.eatAt || bowl.position);
  if (a === 'drink') desiredHeading = angleTo(brain.pos, brain.eatAt || fountain.position);
  if ((brain.mode === 'play' || brain.mode === 'solo') && !pc && !J && !['walk', 'prejump', 'land', 'poise'].includes(a)) desiredHeading = angleTo(brain.pos, toy.position);
  if (a === 'stalk' || a === 'pause') desiredHeading = angleTo(brain.pos, brain.mode === 'idle' && brain.swatAt ? brain.swatAt : toy.position);
  if (a === 'swat' && brain.swatAt) desiredHeading = angleTo(brain.pos, brain.swatAt);
  // On a perch she keeps to the way it faces (it's narrow up there).
  // Watching the bird from the floor: she turns to face it.
  // (Not at the foot of the wall steps, in the gap by the window: turned
  // across the gap her hips or nose would be in the wall or the counter's
  // end. There she faces the steps.)
  const atStepFoot = place === kitchen && !brain.perch && !J && Math.hypot(brain.pos.x - PERCHES.step.base.x, brain.pos.z - PERCHES.step.base.z) < .4;
  if (brain.watching && !brain.perch && !J && a === 'sit' && brain.glance && !atStepFoot) { const want = angleTo(brain.pos, brain.glance); if (Math.abs(Math.atan2(Math.sin(want - brain.heading), Math.cos(want - brain.heading))) > .7) desiredHeading = want; }
  // (Facing the first step itself, a touch west of south: from facing out
  // of the gap, the shorter turn is then the one that keeps her hips out
  // of the window wall.)
  // (The gap is .78 wide and she is 1.2 long: facing north already, she
  // stays so (hips in the gap); else she faces the first step. Any turn
  // across sweeps her into the wall or the counter's end.)
  if (atStepFoot && !['walk', 'prejump', 'jump'].includes(a)) { const hs = Math.atan2(Math.sin(brain.heading), Math.cos(brain.heading)); desiredHeading = Math.abs(hs) < 1.57 ? 0 : angleTo(brain.pos, PERCHES.step.spot); }
  const onward = brain.perch && !J && ['land', 'poise', 'sit'].includes(a) ? chainNext() : null;
  if (onward) desiredHeading = angleTo(brain.pos, onward);
  else if (brain.perch && !J && ['sit', 'loaf', 'catnap', 'groom', 'land'].includes(a)) desiredHeading = PERCHES[brain.perch].face;
  // Settled to watch something (the fire, say): she faces it.
  if (desiredHeading === null && brain.faceAt && !brain.perch && !J && ['sit', 'loaf', 'catnap', 'groom'].includes(a)) desiredHeading = angleTo(brain.pos, brain.faceAt);
  // In the kitchen's tent she lies along it, facing out of the front.
  const SH = place.layoutCache.sleepHeading;
  const inBed = Math.hypot(brain.pos.x - bed.position.x, brain.pos.z - bed.position.z) < place.bedRadius;
  if (desiredHeading === null && SH != null && (a === 'sleep' || a === 'catnap') && inBed) desiredHeading = SH;
  if (desiredHeading === null && place.layoutCache.bedFace != null && ['sit', 'loaf', 'groom', 'beg'].includes(a) && inBed && !brain.perch) desiredHeading = place.layoutCache.bedFace;
  if (desiredHeading === null && (['belly', 'sleep', 'catnap'].includes(a) || brain.mode === 'brush')) desiredHeading = angleTo(brain.pos, camera.position) + (a === 'belly' ? -1.2 : brain.mode === 'brush' ? -1.1 : -.5);
  else if (desiredHeading === null && ['sit', 'loaf', 'beg'].includes(a)) {
    // Settled: the body only turns once the head has been turned well round
    // for a moment, and then just until she faces what she's watching.
    if (Math.abs(brain.head.yaw) > .42) brain.bodyWait ??= t + .6; else brain.bodyWait = null;
    if (brain.bodyWait !== null && t > brain.bodyWait) brain.bodyTurning = true;
    if (Math.abs(brain.head.yaw) < .1) brain.bodyTurning = false;
    if (brain.bodyTurning) desiredHeading = angleTo(brain.pos, brain.headGaze);
  }
  if (desiredHeading !== null) {
    const was = brain.heading;
    brain.heading = dampAngle(brain.heading, desiredHeading, a === 'walk' || pc || J ? 7 : a === 'prejump' ? 5 : 1.6, dt);
    // Sitting or lying, she shuffles round no faster than her paws can step;
    // setting off (or walking slowly) toward something behind her, she
    // steps round, not spins on the spot. (At a run, or mid-jump or pounce,
    // she can turn as fast as she likes.)
    // (Up on a shelf or the counter too: turning round at the end of one,
    // or settling after a landing.)
    const resting = ['sit', 'loaf', 'groom', 'catnap', 'sleep', 'beg', 'pause', 'land', 'poise'].includes(a) && !J && brain.perch !== 'vacuum' && brain.perch !== 'pendant';
    const pivot = a === 'walk' && !pc && !J && brain.speed < .9;
    if (resting || pivot) {
      const d = Math.atan2(Math.sin(brain.heading - was), Math.cos(brain.heading - was)), max = (resting ? 1.2 : 1.8 + brain.speed * 2.2) * dt;
      if (Math.abs(d) > max) brain.heading = was + Math.sign(d) * max;
    }
  }
  if (!J) brain.elevation = damp(brain.elevation, brain.perch ? perchTop() : groundAt(brain.pos), 8, dt);
  cat.root.position.set(brain.pos.x, brain.elevation, brain.pos.z);
  cat.root.rotation.y = brain.heading;

  // --- Face ----------------------------------------------------------------
  const f = brain.face, ex = EXPRESSIONS[currentExpression()] || EXPRESSIONS.content;
  for (const k in ex) f[k] = damp(f[k], ex[k], k === 'mouth' ? 12 : 9, dt);
  const face = {...f};
  if (t > brain.nextBlink && !pet.sleeping) {
    brain.blinkAt = t;
    brain.blinkDouble = Math.random() < .2;
    brain.nextBlink = t + rand(2.2, 5.5);
  }
  const bp = (t - brain.blinkAt) / .16;
  let shut = bp < 0 ? 0 : bp < .45 ? bp / .45 : bp < 1 ? 1 - (bp - .45) / .55 : 0;
  if (brain.blinkDouble && bp >= 1.3 && bp < 2.3) { const b2 = bp - 1.3; shut = b2 < .45 ? b2 / .45 : 1 - (b2 - .45) / .55; }
  const sb = (t - brain.slowBlinkAt) / 2;
  if (sb >= 0 && sb < 1) { shut = Math.max(shut, Math.sin(Math.PI * Math.min(1, sb * 1.25)) ** .6); face.happy = 0; }
  face.open *= 1 - shut;
  const m = brain.mouthAnim;
  if (m) {
    const p = (t - m.start) / m.dur;
    if (p >= 1) brain.mouthAnim = null;
    else if (m.env) face.mouth = Math.max(face.mouth, (m.env[Math.min(m.env.length - 1, Math.floor((t - m.start) * m.rate))] || 0) * m.peak);
    else face.mouth = Math.max(face.mouth, Math.sin(Math.PI * p) ** .7 * m.peak);
  }
  if (brain.activity === 'drink' && t - brain.actStart > .6) { face.tongue = .5 + .5 * Math.sin(t * 13); face.mouth = Math.max(face.mouth, .12); }
  if (t < brain.chewUntil) face.mouth = Math.max(face.mouth, .15 + .25 * (.5 + .5 * Math.sin(t * 14)));
  const yp = (t - brain.yawnAt) / 2;
  let yawnPitch = 0;
  if (yp >= 0 && yp < 1) {
    const y = Math.sin(Math.PI * yp) ** 1.4;
    face.mouth = Math.max(face.mouth, y);
    face.open = Math.min(face.open, 1 - y);
    face.earBack += y * .4;
    yawnPitch = y * .35;
  }

  // --- Head and eyes -----------------------------------------------------------
  let gazeTarget;
  if (brain.mode === 'play') gazeTarget = toy.position;
  else if (a === 'eat') gazeTarget = brain.eatAt || tmpV2.copy(bowl.position).setY(0);
  else if (a === 'drink') gazeTarget = brain.eatAt || tmpV2.copy(fountain.position).setY(.2);
  else if (t - brain.pointerAt < 2.2) gazeTarget = brain.pointerWorld;
  else if (a === 'walk' && brain.target) gazeTarget = tmpV2.copy(brain.target).setY(brain.elevation + .5);
  else if (['land', 'poise', 'sit', 'prejump'].includes(a) && chainNext()) gazeTarget = tmpV2.copy(chainPt);
  else if (brain.glance && t < brain.glanceUntil) gazeTarget = brain.glance;
  else gazeTarget = camera.position;
  // Eyes first: they jump to whatever caught her attention. The head
  // follows a beat later and more slowly; the body (above) last of all.
  const quick = brain.mode === 'play';
  brain.gaze.x = damp(brain.gaze.x, gazeTarget.x, 18, dt);
  brain.gaze.y = damp(brain.gaze.y, gazeTarget.y, 18, dt);
  brain.gaze.z = damp(brain.gaze.z, gazeTarget.z, 18, dt);
  cat.root.updateMatrixWorld(true);
  const eyeAt = cat.headCenter(tmpV3);
  const apart = tmpV.subVectors(brain.gaze, eyeAt).normalize().angleTo(tmpV2.subVectors(brain.headGaze, eyeAt).normalize());
  if (apart > .12 && !brain.headMoving) brain.headWait ??= t + (quick ? .05 : .2);
  if (brain.headWait !== null && t >= brain.headWait) { brain.headMoving = true; brain.headWait = null; }
  if (brain.headMoving) {
    const r = quick ? 9 : 3.4;
    brain.headGaze.x = damp(brain.headGaze.x, brain.gaze.x, r, dt);
    brain.headGaze.y = damp(brain.headGaze.y, brain.gaze.y, r, dt);
    brain.headGaze.z = damp(brain.headGaze.z, brain.gaze.z, r, dt);
    if (apart < .03) brain.headMoving = false;
  }
  const toLocal = p => cat.neck.worldToLocal(tmpV.copy(p)).sub(cat.head.position);
  let local = toLocal(brain.headGaze);
  const wantYaw = Math.atan2(local.x, Math.max(.12, local.z));
  const wantPitch = Math.atan2(local.y, Math.hypot(local.x, local.z));
  local = toLocal(brain.gaze);
  const eyeYaw = Math.atan2(local.x, Math.max(.12, local.z));
  const eyePitch = Math.atan2(local.y, Math.hypot(local.x, local.z));
  let yaw = clamp(wantYaw * .75, -.85, .85), pitch = clamp(wantPitch * .7, -.5, .45), roll = 0;
  const e = currentExpression();
  roll += Math.sin(t * .7) * .04 * motion;
  if (e === 'curious') roll += .28;
  if (e === 'bliss') { roll += .2; pitch += .15; }
  if (e === 'joy' || e === 'love') roll += Math.sin(t * 2.6) * .12;
  if (e === 'sleepy') { pitch -= .12; roll += .12; }
  if (e === 'lonely' || e === 'hungry') { pitch += .05; roll -= .1; }
  if (a === 'sleep' || a === 'catnap' || a === 'belly') { yaw = 0; pitch = 0; roll = 0; }
  // Eating and drinking: her mouth goes right down to the food or the
  // water. Each frame she leans in, dips her front and tips her head a
  // little more towards wherever her mouth still has to go.
  const R = brain.reach;
  if ((a === 'eat' || a === 'drink') && t - brain.actStart > .35 && !J) {
    const m = cat.root.worldToLocal(cat.bones.jaw.localToWorld(tmpV3.set(0, -.015, .14)));
    const g = cat.root.worldToLocal(mouthTarget(a, tmpV2, cat.root.localToWorld(tmpV.copy(m)).y));
    const ef = g.z - m.z, ev = g.y - m.y;
    R.z = clamp(R.z + ef * 2.5 * dt, -.08, .18);
    R.dip = clamp(R.dip - ev * 2 * dt, 0, brain.lapStream ? 0 : .3);
    R.pitch = clamp(R.pitch + ev * 3 * dt, -.6, .25);
  } else for (const k in R) R[k] = damp(R[k], 0, 4, dt);
  if ((a === 'eat' || a === 'drink') && t - brain.actStart > .35) { yaw = 0; pitch = (brain.lapStream ? -.25 : -.85) + R.pitch + Math.sin(t * 7) * (a === 'eat' ? .04 : .02); }
  if (a === 'groom') { yaw = .35; pitch = -.3 + Math.sin(t * 5) * .1; roll = .2; }
  // Rubbing her cheek against your hand.
  if (t < brain.rubUntil && !['sleep', 'belly', 'eat', 'drink'].includes(a)) { const k = Math.min(1, (brain.rubUntil - t) * 2); roll += Math.sin(t * 6.5) * .28 * k; yaw += Math.sin(t * 3.2) * .12 * k; pitch += .08 * k; }
  pitch += yawnPitch;
  brain.head.yaw = damp(brain.head.yaw, yaw, brain.mode === 'play' ? 8 : 5, dt);
  brain.head.pitch = damp(brain.head.pitch, pitch, 5, dt);
  brain.head.roll = damp(brain.head.roll, roll, 4, dt);
  const sleepy = a === 'sleep' || a === 'catnap';
  brain.look.x = damp(brain.look.x, sleepy ? 0 : clamp((eyeYaw - brain.head.yaw) / .45, -1, 1), 22, dt);
  brain.look.y = damp(brain.look.y, sleepy ? 0 : clamp((eyePitch - brain.head.pitch) / .35, -1, 1), 22, dt);

  if (t > brain.nextTwitch) {
    brain.nextTwitch = t + rand(3, 8);
    twitchEar(undefined, pet.sleeping ? .6 : 1);
    if (Math.random() < .3) setTimeout(() => twitchEar(undefined, .7), 170);
  }

  // --- Body pose ---------------------------------------------------------------
  let pose = 'sit', walk = 0, wiggle = 0, lift = 0, poseRate = 6, tail = {amp: .25, speed: 1.4};
  if (a === 'walk' || brain.speed > .05) { pose = 'stand'; walk = brain.speed / .8; tail = {amp: .3, speed: 2.5}; }
  if (a === 'loaf') pose = 'loaf';
  if (a === 'sleep') { pose = 'sleep'; tail = {amp: .05, speed: .5}; }
  // (At the faucet she sits in the sink and laps at the trickle.)
  if (a === 'eat' || a === 'drink') { pose = a === 'drink' && brain.lapStream ? 'sit' : 'eat'; tail = {amp: .45, speed: 1.2}; }
  if (a === 'groom') pose = 'sit';
  if (a === 'belly') { pose = 'belly'; tail = {amp: .5, speed: 2}; }
  if (a === 'stretch') { pose = 'stretch'; poseRate = 3.5; }
  if (a === 'beg') { pose = 'beg'; tail = {amp: .4, speed: 2}; }
  if (brain.mode === 'brush') { pose = 'loaf'; tail = {amp: .5, speed: 1}; }
  if ((brain.mode === 'play' || brain.mode === 'solo') && a === 'play') { pose = 'crouch'; tail = {amp: .6, speed: 4}; }
  if (a === 'catnap') { pose = 'sleep'; tail = {amp: .05, speed: .5}; }
  if (a === 'prejump') { pose = 'crouch'; poseRate = 9; const w = (t - brain.actStart) / Math.max(.3, brain.actUntil - brain.actStart); wiggle = w > .45 ? .5 : 0; tail = {amp: .5, speed: 4}; }
  if (a === 'jump') { const k = J ? (t - J.start) / J.dur : 1; pose = k < .7 ? 'leap' : 'crouch'; poseRate = 14; tail = {amp: .1, speed: 1}; }
  if (a === 'land') { pose = 'crouch'; poseRate = 10; }
  if (a === 'poise') { pose = 'stand'; poseRate = 8; tail = {amp: .7, speed: 1.8}; }
  if (a === 'stalk') { pose = 'crouch'; poseRate = 7; wiggle = (t - brain.actStart) > .8 ? .45 : 0; tail = {amp: .5, speed: 5}; }
  if (a === 'pause') { pose = 'crouch'; tail = {amp: .3, speed: 3}; }
  // Draped over the pendant shade like a scarf: legs and tail dangling.
  if (brain.perch === 'pendant' && !J && !['prejump', 'land', 'swat'].includes(a)) { pose = 'drape'; tail = {amp: .15, speed: .8}; }
  let swat = 0;
  if (a === 'swat') { const q = (t - brain.actStart) / .45; swat = Math.max(0, Math.sin(Math.min(q, 1) * Math.PI)) * motion; tail = {amp: .5, speed: 4}; }
  // A bird at the window: quick tail flicks.
  if (brain.watching) tail = {amp: .45, speed: 6};
  if (brain.dogWatch) tail = {amp: .7, speed: 7};
  if (pc) {
    const p = (t - pc.start) / 1.3;
    poseRate = 14;
    if (p < .5) { pose = 'crouch'; wiggle = Math.min(1, p / .15); tail = {amp: .8, speed: 6}; }
    else if (p < .82) { pose = 'leap'; lift = Math.sin((p - .5) / .32 * Math.PI) * .4; }
    else pose = 'crouch';
  }
  const hp = (t - brain.hopAt) / .55;
  if (hp >= 0 && hp < 1) lift = Math.max(lift, Math.sin(hp * Math.PI) * .22);
  if (e === 'joy' || e === 'love' || e === 'excited') tail = {amp: Math.max(tail.amp, .45), speed: Math.max(tail.speed, 3)};
  const knead = t < brain.kneadUntil || brain.mode === 'brush' || t < brain.strokeUntil || a === 'belly';

  cat.update(dt, t, {
    pose, poseRate, walk, wiggle: wiggle * motion, lift: lift * motion, knead, purr: knead && pet.sound,
    groom: a === 'groom', swat, head: brain.head, reach: brain.reach, look: brain.look, face, tail,
    tailUp: t < brain.tailUpUntil && !['sleep', 'belly', 'loaf'].includes(a) ? 1 : 0,
    // (For the new movement: how far through a jump she is, which way, and
    // whether she's riding the vacuum.)
    air: J ? clamp((t - J.start) / J.dur, 0, 1) : -1, airUp: J ? Math.sign(J.toY - J.fromY) || 1 : 1, riding: brain.perch === 'vacuum',
    // In her bed, her tail stays inside the rim.
    tailBounds: !brain.perch && brain.elevation > .05 && Math.hypot(brain.pos.x - bed.position.x, brain.pos.z - bed.position.z) < place.bedRadius ? {x: bed.position.x, z: bed.position.z, r: place.bedRadius} : null,
    tailSolids: tailSolids(),
  });

  // Screen anchor above the head for particles, and the face's rough
  // on-screen box (so the speech bubble can stay clear of it).
  const W = host.clientWidth, H = host.clientHeight;
  const top = cat.headTop(tmpV).project(camera);
  headScreen.x = (top.x * .5 + .5) * W;
  headScreen.y = (-top.y * .5 + .5) * H;
  const mid = cat.headCenter(tmpV).project(camera);
  const cx = (mid.x * .5 + .5) * W, cy = (-mid.y * .5 + .5) * H, r = Math.max(28, Math.abs(cy - headScreen.y) * 1.15);
  Object.assign(faceBox, {cx, cy, l: cx - r, r: cx + r, t: Math.min(headScreen.y, cy - r), b: cy + r * .9});
}
const faceBox = {cx: 0, cy: 0, l: 0, r: 0, t: 0, b: 0};

// Put the speech bubble above her head, or beside it when there's no room
// above; never over her face.
function placeSpeech() {
  const sp = $('#speech');
  if (!sp.classList.contains('show')) return;
  const w = sp.offsetWidth, h = sp.offsetHeight, W = host.clientWidth, H = host.clientHeight;
  const top = 78, right = W - 72, bottom = H - 130, f = faceBox;
  let x, y;
  if (f.t - 10 - h >= top) { x = clamp(f.cx - w * .3, 12, right - w); y = f.t - 10; }
  else if (f.r + 12 + w <= right) { x = f.r + 12; y = clamp(f.cy, top + h, bottom); }
  else if (f.l - 12 - w >= 12) { x = f.l - 12 - w; y = clamp(f.cy, top + h, bottom); }
  else { x = clamp(f.cx - w / 2, 12, right - w); y = clamp(f.b + 12 + h, top + h, bottom); }
  sp.style.setProperty('--x', x.toFixed(1) + 'px');
  sp.style.setProperty('--y', y.toFixed(1) + 'px');
}

// Little unprompted behaviours that make the kitten feel alive.
function idleLife(t) {
  // On the opening screen she stays put (titleLife); her day starts at Play.
  if (title.on) { if (titleView) titleLife(t); return; }
  // Birds by day, bats on Halloween evenings (so before the sleeping return).
  watchBirds(t);
  vacuumLife(t);
  dogLife(t);
  if (pet.sleeping) {
    if (t > brain.nextZ) { brain.nextZ = t + rand(2.2, 3.4); burst('z', 1); }
    return;
  }
  if (brain.mode !== 'idle' || !['sit', 'loaf'].includes(brain.activity) || t < brain.nextIdle || t - brain.pointerAt < 2.5) return;
  // A night owl: after dark she's up to something every few seconds.
  brain.nextIdle = t + (night ? rand(2.5, 5) : rand(4, 8));
  if (brain.perch) { perchLife(t); return; }
  if (night && Math.random() < .75 && nightLife()) return;
  const perchChoices = place === room ? ['window', 'window', 'chair'] : ['shelf', 'shelf', 'shelfHigh', 'shelfHigh', 'salmonRaid', 'faucet', 'faucet', 'pendant'].concat(pet.food < 75 ? ['salmonRaid'] : [], pet.water < 85 ? ['faucet', 'faucet'] : []);
  const options = ['glance', 'twitch', 'tilt', 'wander', 'wander', 'groom', ...perchChoices, 'sunbeam'];
  if (pet.energy > 35) options.push('solo', 'solo', 'dash');
  if (pet.happiness > 60) options.push('slowBlink', 'zoomies');
  if (pet.energy < 55) options.push('yawn', 'loaf', 'stretch');
  if (pet.energy > 50) options.push('stretch');
  if (pet.food < 40) options.push('bowl', 'bowl');
  if (pet.water < 60) options.push('drink', 'drink', 'drink');
  if (pet.energy < 50) options.push('nap');
  options.push('meow');
  if (pet.happiness > 50) options.push('meow');
  let choice = pick(options);
  // Something worth watching comes round often: soon after you open the
  // app, then every half a minute or so. A tired kitten picks the calm ones.
  if (t > brain.nextShow) {
    brain.nextShow = t + rand(25, 40);
    const shows = place === room ? ['window', 'chair', 'sunbeam', 'mantel', 'mantel'] : ['counter', 'shelf', 'shelfHigh', 'pendant', 'pendant', 'sunbeam'];
    if (pet.energy > 35) shows.push('solo', 'solo', 'zoomies');
    choice = pick(shows);
  }
  if (choice === 'glance') glanceAt(new THREE.Vector3(rand(-3, 3), rand(.2, 2.4), rand(-.5, 2.5)), rand(1.2, 2.6));
  if (choice === 'twitch') { twitchEar(0); setTimeout(() => twitchEar(1), 140); }
  if (choice === 'tilt') express('curious', 1.8);
  if (choice === 'slowBlink') slowBlink();
  if (choice === 'yawn') { yawn(); if (Math.random() < .5) setTimeout(() => say(pick(['*yawn*… so cozy.', 'Mmm… nap soon?'])), 900); }
  if (choice === 'loaf') setActivity('loaf', rand(6, 11));
  if (choice === 'stretch') { setActivity('stretch', 1.9); setTimeout(yawn, 400); }
  if (choice === 'groom') setActivity('groom', rand(2.2, 3.5));
  if (choice === 'wander') walkTo(randomRugPoint(), () => setActivity(pick(['sit', 'sit', 'loaf']), rand(3, 7)));
  if (choice === 'zoomies') {
    say(pick(['Zoomies!!', 'Nyoom!']), 1600);
    express('excited', 3);
    walkTo(randomRugPoint(), () => walkTo(randomRugPoint(), () => walkTo(HOME, null, true), true), true);
  }
  if (choice === 'dash') dash();
  if (choice === 'drink') act('drink', {auto: true});
  if (choice === 'nap') walkTo(CUSHION_SPOT, () => { setActivity('loaf', rand(8, 14)); setTimeout(slowBlink, 1500); }, false, true);
  if (choice === 'bowl') {
    walkTo(EAT_SPOT, () => { setActivity('beg', 3.5); meow('mew'); say(pick(['Is it snack o’clock?', 'This bowl looks very empty…'])); }, false, true);
  }
  if (choice === 'meow') { meow(pick(['mew', 'chirp']), 'idle'); if (Math.random() < .5) say(pick(['Mrrp?', 'Mew!', 'I like it here. With you.'])); }
  if (choice === 'window') jumpTo('sill', () => { setActivity('sit'); brain.nextBird = clockNow + rand(2, 5); }, rand(20, 35));
  if (choice === 'mantel') jumpTo('mantel', () => setActivity('sit'), rand(18, 30));
  if (['step', 'counter'].includes(choice)) jumpTo(choice, () => setActivity('sit'), rand(18, 30));
  // Up on a shelf she usually goes for a wander along it.
  if (['shelf', 'shelfHigh'].includes(choice)) jumpTo(choice, () => { if (Math.random() < .75) later(rand(.8, 2), () => { if (brain.perch === choice && brain.mode === 'idle') stroll(); }); setActivity('sit'); }, rand(25, 40));
  if (choice === 'chair') jumpTo('chair', () => {
    // Kneads the seat, turns, and settles in for a catnap.
    brain.kneadUntil = clockNow + 3;
    setActivity('loaf', 3.4, () => setActivity('catnap', rand(12, 22), () => { slowBlink(); setActivity('sit', 4); }));
  }, rand(25, 40));
  if (choice === 'sunbeam' && !pet.sleeping) walkTo(SUN_SPOT, () => {
    express('bliss', 2);
    setActivity('loaf', 2.5, () => setActivity('catnap', rand(10, 20), () => { yawn(); setActivity('sit', 3); }));
  }, false, true);
  if (choice === 'pendant') ridePendant();
  if (choice === 'solo') startSolo();
  if (choice === 'salmonRaid' && !stealSalmon()) setActivity('sit');
  if (choice === 'faucet' && place === kitchen) drinkFaucet();
}

// After dark (and awake): the hours a cat really comes alive. Night zoomies,
// pouncing on shadows only she can see, the moth at the window, a doze in
// the moonlight or by the fire, the counter and the salmon while nobody's
// looking, and the robot vacuum's little light, asleep in its dock.
// Returns false if she'd rather do an ordinary thing this time.
function nightLife() {
  if (pet.energy < 25) {
    // Worn out: a proper catnap in her bed (it restores a little energy).
    walkTo(CUSHION_SPOT, () => setActivity('loaf', 2.5, () => setActivity('catnap', rand(18, 30), () => { yawn(); setActivity('sit', 3); })), false, true);
    return true;
  }
  const options = ['zoomies', 'zoomies', 'zoomies', 'shadow', 'shadow', 'shadow', 'moonbeam'];
  if (place === room) options.push('fireside', 'fireside', 'window');
  else {
    options.push('raid', 'raid', 'shelf', 'pendant');
    if (kitchen.vac.state === 'docked' && !kitchen.vac.rider) options.push('dock', 'dock');
  }
  const choice = pick(options);
  if (choice === 'zoomies') nightZoomies();
  if (choice === 'shadow') shadowPounce();
  if (choice === 'moonbeam') walkTo(SUN_SPOT, () => {
    // (The window's light on the floor is moonlight now.)
    express('bliss', 2);
    setActivity('loaf', 3, () => setActivity('catnap', rand(8, 14), () => { glanceAt(camera.position, 2); slowBlink(); setActivity('sit', 3); }));
  }, false, true);
  if (choice === 'fireside') {
    // Stretched out on the warm hearth, slow-blinking at the flames.
    const f = room.fireplace, fire = f.localToWorld(new THREE.Vector3(0, .4, 0)), spot = f.localToWorld(new THREE.Vector3(rand(-.4, .4), 0, 1.05)).setY(0);
    walkTo(spot, () => {
      brain.faceAt = fire;
      setActivity('loaf', rand(10, 18), () => setActivity('groom', 2, () => setActivity('sit', 2)));
      later(3, slowBlink); later(rand(6, 9), slowBlink);
    }, false, true);
  }
  if (choice === 'window') jumpTo('sill', () => { setActivity('sit'); brain.nextBird = clockNow + rand(1, 4); }, rand(20, 35));
  if (choice === 'raid') { if (!(Math.random() < .6 && stealSalmon())) drinkFaucet(); }
  if (choice === 'shelf') jumpTo(pick(['shelf', 'shelfHigh']), () => { later(rand(.8, 2), () => { if (brain.perch && brain.mode === 'idle') stroll(); }); setActivity('sit'); }, rand(20, 35));
  if (choice === 'dock') dockHunt();
  if (choice === 'pendant') ridePendant();
  return true;
}
// The neighbour's dog, on the terrace outside the kitchen doors. She spots
// it, trots over to the glass and sits staring, tail lashing, chattering at
// it; when it puts a paw up on the glass, she swats back. Asleep, she
// doesn't care.
// (Off for now: the dog waits for a proper model. ?dog shows the draft.)
const DOG_VISITS = new URLSearchParams(location.search).has('dog');
function dogLife(t) {
  if (!DOG_VISITS || place !== kitchen || !ready) return;
  brain.nextDog ??= t + rand(25, 50);
  if (t > brain.nextDog && !pet.sleeping) {
    const d = kitchen.startDog(t);
    brain.nextDog = t + d + rand(90, 180) * (night ? 2 : 1);
    if (d) brain.dogSeen = false;
  }
  const at = kitchen.dogWorld(tmpV3);
  if (!at || pet.sleeping) { brain.dogWatch = false; return; }
  if (!brain.dogSeen && Math.abs(at.z - kitchen.outside.door) < 2.5) {
    brain.dogSeen = true;
    glanceAt(at.clone(), 2); twitchEar(0, 1.3); later(.12, () => twitchEar(1, 1.3)); express('curious', 2.5);
    if (brain.mode === 'idle' && !brain.jump) {
      const go = () => walkTo(place.layoutCache.windowSpot, () => { brain.dogWatch = true; brain.faceAt = kitchen.dogWorld(new THREE.Vector3()); setActivity('sit', 8); later(.6, () => meow('chirp', 'idle')); later(2, () => { if (Math.random() < .5) say(pick(['Who are YOU?', 'This is my house.', 'Hmph.', 'A… dog?!']), 2200); }); }, true, true);
      if (brain.perch) jumpDown(go); else go();
    }
  }
  if (brain.dogWatch) {
    brain.glance = (brain.glance || new THREE.Vector3()).copy(at); brain.glanceUntil = t + .4;
    if (kitchen.dogPawing && t > (brain.dogSwatAt || 0) && brain.activity === 'sit') {
      brain.dogSwatAt = t + rand(1.2, 2);
      brain.swatAt = at.clone().setY(0); brain.swatSoft = true;
      setActivity('swat', .45, () => setActivity('sit', 6));
    }
  }
}

// A sudden sprint across the room (a sound only she heard, a thought), then
// a stop, a look round and a sit as if nothing happened.
function dash() {
  let to = randomRugPoint();
  for (let i = 0; i < 6 && to.distanceTo(brain.pos) < 2.2; i++) to = randomRugPoint();
  express('excited', 2);
  walkTo(to, () => { hop(); setActivity('pause', .8, () => { glanceAt(new THREE.Vector3(rand(-3, 3), rand(.3, 2), rand(-2, 2)), 1.5); setActivity('sit', rand(2, 4)); }); }, 2.6);
}
// Night zoomies: tearing about from one end of the room to the other, a
// skid and a hop at each turn, sometimes ending with a leap up somewhere.
function nightZoomies() {
  express('excited', 4);
  if (Math.random() < .5) say(pick(['Nyoom!!', '3 a.m. energy!', 'Can’t stop. Won’t stop.', 'Zoomies!!']), 1600);
  let legs = 3 + Math.floor(rand(0, 3));
  const ups = (place === room ? ['chair', 'sill'] : ['step', 'counter']).filter(n => PERCHES[n]);
  const leg = () => {
    hop();
    if (--legs > 0) { walkTo(randomRugPoint(), leg, 2.6); return; }
    if (ups.length && Math.random() < .4) jumpTo(pick(ups), () => setActivity('sit'), rand(8, 15));
    else setActivity('pause', 1, () => { glanceAt(camera.position, 1.5); setActivity('sit'); });
  };
  walkTo(randomRugPoint(), leg, 2.6);
}
// A shadow, a flicker, a speck only she can see: ears forward, the stalk,
// the wiggle, the pounce, the swat; then a look round as if nothing happened.
function shadowPounce() {
  const a = rand(0, Math.PI * 2), d = rand(1.3, 2.1);
  const spot = onRug(new THREE.Vector3(brain.pos.x + Math.sin(a) * d, 0, brain.pos.z + Math.cos(a) * d));
  if (spot.distanceTo(brain.pos) < .8) { nightZoomies(); return; }
  brain.swatAt = spot.clone();
  glanceAt(spot.clone().setY(.03), 2.5);
  twitchEar(0, 1.2); later(.12, () => twitchEar(1, 1.2));
  express('curious', 1.6);
  setActivity('stalk', rand(1.3, 2.2), () => {
    if (brain.mode !== 'idle') return;
    const dx = spot.x - brain.pos.x, dz = spot.z - brain.pos.z, dd = Math.max(.01, Math.hypot(dx, dz)), reach = Math.max(0, dd - .35);
    brain.pounce = {start: clockNow, from: brain.pos.clone(), to: onRug(new THREE.Vector3(brain.pos.x + dx / dd * reach, 0, brain.pos.z + dz / dd * reach)), caught: false, at: () => spot, onHit: () => {
      brain.swatAt = spot.clone(); brain.swatSoft = true;
      setActivity('swat', .45, () => setActivity('pause', 1.1, () => {
        glanceAt(new THREE.Vector3(rand(-2, 2), rand(.2, 1.5), rand(-1, 2)), 1.2);
        if (Math.random() < .35) say(pick(['Got it.', '…where did it go?', 'I definitely got it.']), 2000);
        setActivity('sit', rand(2, 4));
      }));
      express('excited', 1.5);
    }};
    setActivity('pause', 1.6);
  });
}
// The robot vacuum asleep in its dock, its little green light glowing in
// the dark: clearly up to something.
function dockHunt() {
  const light = kitchen.vacuumButton.getWorldPosition(new THREE.Vector3());
  glanceAt(light, 2.5); express('curious', 1.6);
  walkTo(nearVacuum(1.3), () => {
    if (kitchen.vac.state !== 'docked' || brain.mode !== 'idle') { setActivity('sit'); return; }
    brain.swatAt = light.clone().setY(0);
    setActivity('stalk', rand(1.4, 2.4), () => {
      if (brain.mode !== 'idle') return;
      const dx = light.x - brain.pos.x, dz = light.z - brain.pos.z, dd = Math.max(.01, Math.hypot(dx, dz)), reach = Math.max(0, dd - .55);
      brain.pounce = {start: clockNow, from: brain.pos.clone(), to: kitchen.clampFloor(new THREE.Vector3(brain.pos.x + dx / dd * reach, 0, brain.pos.z + dz / dd * reach)), caught: false, at: () => light, onHit: () => {
        brain.swatAt = light.clone().setY(0); brain.swatSoft = true;
        setActivity('swat', .45, () => setActivity('swat', .45, () => setActivity('pause', 1.2, () => setActivity('sit', rand(2, 4)))));
        later(.8, () => { meow('chirp', 'idle'); if (Math.random() < .5) say(pick(['It blinked at me.', 'Stay. Asleep.', 'I see you, little light.']), 2200); });
      }};
      setActivity('pause', 1.6);
    });
  }, false, true);
}

// Up the steps and shelves, along to the end, a wiggle, and a flying leap
// onto the big pendant shade.
function ridePendant() {
  jumpTo('pendant', () => {
    setActivity('sit');
    express('excited', 1.5);
    later(.8, () => { if (brain.perch === 'pendant' && Math.random() < .6) say(pick(['Wheee!', 'I meant to do that.', 'Best seat in the house.']), 2200); });
  }, rand(14, 24));
}
// Riding the pendant shade (as cats do with chandeliers): she hangs over it
// quite unbothered while it swings, looks round, looks down at you, shifts
// her weight (and off it swings again), bats at the next shade along.
function pendantLife() {
  const choice = pick(['glance', 'glance', 'lookBack', 'shift', 'shift', 'slowBlink', 'bat', 'meow']);
  if (choice === 'glance') glanceAt(new THREE.Vector3(rand(-4, 4), rand(1, 6), rand(-2, 3)), rand(1.5, 3));
  if (choice === 'lookBack') glanceAt(camera.position, rand(1.5, 2.5));
  if (choice === 'slowBlink') { glanceAt(camera.position, 2.2); slowBlink(); }
  if (choice === 'shift') { kitchen.bumpPendant(rand(-.3, .3), rand(-.3, .3), rand(-.6, .6)); twitchEar(); }
  if (choice === 'bat') {
    const s = kitchen.shades[1].getWorldPosition(new THREE.Vector3());
    glanceAt(s, 1.2); brain.swatAt = s.clone().setY(0);
    later(.6, () => { if (brain.perch === 'pendant') { setActivity('swat', .45, () => setActivity('sit')); kitchen.bumpPendant(rand(-.2, .2), rand(-.2, .2), rand(-.4, .4)); } });
  }
  if (choice === 'meow') { meow(pick(['mew', 'chirp']), 'idle'); if (Math.random() < .5) say(pick(['I live here now.', 'Wheee.', 'Look at me!', 'This is fine.']), 2200); }
}

// Up on a perch: mostly she stays a while, watching, washing, dozing,
// glancing back at you; then she hops down.
function perchLife(t) {
  if (t > brain.perchUntil) { jumpDown(() => setActivity(restingActivity(), rand(2, 5))); return; }
  if (brain.perch === 'pendant') { pendantLife(); return; }
  const options = ['glance', 'twitch', 'slowBlink', 'groom', 'lookBack', 'loaf'];
  if (brain.perch === 'sill' && t > brain.nextKnock && !room.bookFall && t - brain.actStart > 6) options.push('book');
  if (brain.perch === 'mantel' && t > brain.nextKnock && !room.vaseFall && t - brain.actStart > 4) options.push('vase', 'vase');
  if (PERCHES[brain.perch]?.lane && place === kitchen && t - brain.actStart > 2) options.push('stroll', 'stroll', 'stroll');
  // Something on this shelf that could do with being on the floor.
  if (PERCHES[brain.perch]?.lane && place === kitchen && t > brain.nextKnock && kitchen.knockableNear(brain.perch, brain.pos.x) && t - brain.actStart > 2) options.push('knock', 'knock');
  if (brain.perch === 'counter' && place === kitchen && !inSink() && t - brain.actStart > 2) options.push('faucet', 'faucet', 'sink');
  if (HOPS[brain.perch] && place === kitchen && t - brain.actStart > 2) options.push('hop');
  options.push('call');
  const choice = pick(options);
  if (choice === 'glance') glanceAt(brain.perch === 'sill' ? room.glass.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(rand(-.9, .9), rand(-.6, .6), 0)) : new THREE.Vector3(rand(-3, 3), rand(.2, 2.4), rand(-.5, 2.5)), rand(1.5, 3));
  if (choice === 'twitch') twitchEar();
  if (choice === 'slowBlink') { glanceAt(camera.position, 2.2); slowBlink(); }
  if (choice === 'lookBack') { glanceAt(camera.position, rand(1.5, 2.5)); if (Math.random() < .3) meow('mew', 'idle'); }
  if (choice === 'groom') setActivity('groom', rand(2.2, 3.5), () => setActivity('sit'));
  if (choice === 'loaf') setActivity('loaf', rand(6, 12), () => setActivity('sit'));
  if (choice === 'book') knockBook();
  if (choice === 'vase') knockVase();
  if (choice === 'knock') knockThing(kitchen.knockableNear(brain.perch, brain.pos.x));
  if (choice === 'stroll') stroll();
  if (choice === 'faucet') drinkFaucet();
  if (choice === 'sink') sinkSit();
  if (choice === 'hop') hopFrom();
  // Calling down to you from up there.
  if (choice === 'call') { glanceAt(camera.position, 2.2); meow(pick(['mew', 'chirp', 'meow']), 'idle'); }
}

// The vase on the mantel: the same slow, deliberate pats, and over it goes.
// Then a long look down at it, and a look at you.
function knockVase() {
  brain.nextKnock = clockNow + rand(100, 160);
  const vase = room.vaseWorld(new THREE.Vector3()).add(new THREE.Vector3(0, .3, 0));
  glanceAt(vase, 3.5);
  [0, 1, 2.1].forEach((d, i) => setTimeout(() => {
    if (brain.perch !== 'mantel' || brain.jump) return;
    brain.swatAt = vase;
    setActivity('swat', .45, () => setActivity('sit'));
    if (i === 2) setTimeout(() => {
      if (!room.knockVase(clockNow)) return;
      later(1.05, () => onLand('cup'));
      setTimeout(() => {
        glanceAt(room.vaseWorld(new THREE.Vector3()), 2);
        setTimeout(() => { glanceAt(camera.position, 2.5); express('curious', 2); if (Math.random() < .6) say(pick(['…it fell.', 'Gravity did it.', 'It wanted to be on the floor.']), 2600); }, 2000);
      }, 900);
    }, 220);
  }, d * 1000));
}

// The top book on the sill: she pats at it, twice, and the third pat sends it
// over the edge. Then a look down at it, and an innocent look at you.
function knockBook() {
  // Not every minute: the book needs time to be put back, and so do you.
  brain.nextKnock = clockNow + rand(100, 160);
  const book = room.bookWorld(new THREE.Vector3());
  const pats = [0, .9, 1.8];
  glanceAt(book, 3.5);
  pats.forEach((d, i) => setTimeout(() => {
    if (brain.perch !== 'sill' || brain.jump) return;
    brain.swatAt = book;
    setActivity('swat', .45, () => setActivity('sit'));
    if (i === pats.length - 1) setTimeout(() => {
      if (!room.knockBook(clockNow)) return;
      later(.9, () => onLand('book'));
      setTimeout(() => {
        glanceAt(room.bookWorld(new THREE.Vector3()), 1.8);
        setTimeout(() => { glanceAt(camera.position, 2.5); express('curious', 2); if (Math.random() < .5) say(pick(['…it fell.', 'Oops.', 'It was like that when I got here.']), 2600); }, 1800);
      }, 700);
    }, 220);
  }, d * 1000));
}

// Things on the kitchen's shelves: she walks along to one, plants her feet
// (a low crouch, eyes on it, tail going), and pats it toward the edge, once
// or a few times. A pat too many and over it goes onto the counter: a long
// look down at it, then an innocent look at you.
function knockThing(item, pats = 1 + Math.floor(Math.random() * 3)) {
  const shelf = brain.perch, P = PERCHES[shelf];
  if (!item || !P?.lane || item.shelf !== shelf || brain.jump || item.obj.userData.fall) return false;
  const obj = item.obj;
  brain.nextKnock = clockNow + rand(25, 50);
  brain.perchUntil = Math.max(brain.perchUntil, clockNow + 25);
  const at = () => kitchen.cupWorld(obj, new THREE.Vector3()).add(new THREE.Vector3(0, .1, 0));
  const still = () => brain.perch === shelf && !brain.jump && place === kitchen;
  glanceAt(at(), 2.5);
  // Stand in the lane just short of it, on the side she's coming from.
  const c = at(), side = brain.pos.x <= c.x ? -1 : 1, standX = c.x + side * .44;
  const near = Math.abs(brain.pos.z - P.lane.z) < .2 ? [] : [new THREE.Vector3(brain.pos.x + .25 * -side, 0, P.lane.z)];
  walkPath([...near, new THREE.Vector3(standX, 0, P.lane.z)], () => {
    if (!still()) return;
    brain.swatAt = at(); glanceAt(brain.swatAt, 4);
    setActivity('pause', rand(.6, 1.1), () => pat(0));
  });
  const pat = i => {
    if (!still()) return;
    brain.swatAt = at();
    setActivity('swat', .45);
    later(.22, () => {
      if (!still()) return;
      if (kitchen.nudgeCup(obj, clockNow) === 'fell') {
        later(.9, () => glanceAt(at(), 2));
        later(1.4, () => treat({happiness: 5}));
        later(2.8, () => { glanceAt(camera.position, 2.5); express('curious', 2); if (Math.random() < .6) meow(pick(['mew', 'chirp']), 'reply'); if (Math.random() < .6) say(pick(['…it fell.', 'Gravity did it.', 'It was like that when I got here.', 'Oops.']), 2600); });
        later(.5, () => { if (still()) setActivity('sit', rand(4, 7)); });
        return;
      }
      later(.3, () => {
        if (!still()) return;
        glanceAt(at(), 2);
        setActivity('pause', rand(.7, 1.3), () => {
          if (i + 1 < pats) pat(i + 1);
          else { if (Math.random() < .5) later(.4, () => glanceAt(camera.position, 2)); setActivity('sit', rand(3, 6)); }
        });
      });
    });
  };
  return true;
}
// The lower shelf's cups (by her landing spot).
function tapCups(pats) {
  const cup = kitchen?.nextCup();
  return cup ? knockThing(kitchen.knockables.find(k => k.obj === cup), pats) : false;
}
// Along a shelf: a stroll to somewhere along it, a look round, and often
// whatever's standing nearby gets a pat.
function stroll() {
  const P = PERCHES[brain.perch];
  if (!P?.lane || brain.jump) return false;
  const x = rand(P.lane.x0, P.lane.x1), lane = P.lane.z;
  const path = (Math.abs(brain.pos.z - lane) < .2 ? [] : [new THREE.Vector3(brain.pos.x + .25, 0, lane)]).concat([new THREE.Vector3(x, 0, lane)]);
  brain.perchUntil = Math.max(brain.perchUntil, clockNow + 20);
  // Where it goes from here is up to her: a pat at something, up or down to
  // another shelf, further along, or a rest. No set tour.
  walkPath(path, () => {
    const item = kitchen.knockableNear(brain.perch, brain.pos.x), r = Math.random();
    if (r < .55 && item && Math.abs(item.obj.position.x - brain.pos.x) < 1.5 && clockNow > brain.nextKnock) knockThing(item);
    else if (r < .7 && hopFrom()) return;
    else if (r < .8) { setActivity('sit', rand(1.5, 3), () => { if (PERCHES[brain.perch]?.lane && brain.mode === 'idle') stroll(); }); }
    else if (r < .88 && brain.perch === 'counter' && kitchen.sink.x0 < brain.pos.x && brain.pos.x < kitchen.sink.x1) sinkSit();
    else {
      setActivity(Math.random() < .5 ? 'sit' : 'loaf', rand(3, 6)); glanceAt(new THREE.Vector3(brain.pos.x + rand(-2, 2), rand(1, 3), rand(-1, 2)), 2);
      if (Math.random() < .25) later(1, () => { glanceAt(camera.position, 2); meow(pick(['mew', 'chirp']), 'idle'); });
    }
  });
  return true;
}
// Up, down or across partway along, not only by the wall steps: counter to
// lower shelf, shelf to shelf, lower shelf down to the counter. (Not over the
// sink or the range, nor through the hanging ivy.)
const counterSafe = x => (x > -4.85 && x < -3.05) || (x > -1.15 && x < .05);
const clearOfIvy = x => Math.abs(x + 3.25) > .55 && Math.abs(x - 2.75) > .55;
const HOPS = {shelf: [['shelfHigh', clearOfIvy], ['counter', counterSafe]], shelfHigh: [['shelf', clearOfIvy]], counter: [['shelf', counterSafe]]};
function hopFrom() {
  if (place !== kitchen || brain.jump || !HOPS[brain.perch]) return false;
  const x = brain.pos.x, opts = HOPS[brain.perch].filter(([n, ok]) => PERCHES[n]?.lane && ok(x));
  if (!opts.length) return false;
  const [name] = pick(opts), P = PERCHES[name], tx = Math.min(P.lane.x1, Math.max(P.lane.x0, x + rand(-.25, .25)));
  brain.climbGoal = null;
  glanceAt(new THREE.Vector3(tx, P.top + .3, P.lane.z), 1.2);
  leap(new THREE.Vector3(tx, 0, P.lane.z), P.top, name, () => {
    brain.perchUntil = Math.max(brain.perchUntil, clockNow + rand(15, 30));
    setActivity('sit');
    later(rand(1, 3), () => { if (brain.perch === name && brain.mode === 'idle' && !brain.jump && Math.random() < .6) stroll(); });
  }, .45);
  return true;
}
// The salmon on the island: up she goes (from behind it), creeps over and
// helps herself. Mine now.
function stealSalmon() {
  if (!kitchen?.salmonReady || pet.sleeping || brain.mode !== 'idle') return false;
  const S = place.layoutCache.salmonSpot, fish = kitchen.salmon.getWorldPosition(new THREE.Vector3());
  jumpTo('island', () => {
    glanceAt(fish, 3);
    walkPath([S.at], () => {
      if (brain.perch !== 'island' || !kitchen.salmonReady) { setActivity('sit'); return; }
      brain.heading = S.face; brain.swatAt = fish.clone();
      setActivity('stalk', .7, () => {
        brain.eatAt = fish.clone(); brain.lapStream = false;
        setActivity('eat', 3.2, () => {
          brain.eatAt = null;
          setActivity('sit', rand(3, 5));
          later(.4, () => { glanceAt(camera.position, 2.2); meow('chirp', 'reply'); if (Math.random() < .7) say(pick(['Mine now.', 'Finders keepers.', 'You weren’t eating that, were you?', 'Mmm. Salmon.']), 2600); });
        });
        later(1.6, () => { if (brain.activity === 'eat') { kitchen.eatSalmon(clockNow); treat({food: 18, happiness: 6}); } });
      });
    });
  }, rand(12, 18));
  return true;
}
// A drink from the faucet: along the counter to the sink, and she laps at
// the trickle.
function drinkFaucet() {
  if (!kitchen || pet.sleeping || brain.mode !== 'idle') return false;
  if (inSink()) { outOfSink(drinkFaucet); return true; }
  const S = place.layoutCache.sink;
  const go = () => intoSink(S.drinkAt, () => {
    kitchen.faucetRun(true);
    brain.eatAt = S.drink.clone(); brain.lapStream = true;
    setActivity('drink', rand(4, 5.5), () => {
      kitchen.faucetRun(false); brain.eatAt = null; brain.lapStream = false;
      later(.5, () => glanceAt(camera.position, 2));
      // A moment in the sink, sometimes a longer one, then out.
      setActivity('sit', Math.random() < .3 ? rand(8, 14) : rand(2.5, 4), () => { if (inSink()) outOfSink(() => setActivity('sit', rand(3, 5))); });
    });
    later(2, () => { if (brain.activity === 'drink') treat({water: 22, happiness: 3}); });
  });
  if (brain.perch === 'counter' && !brain.jump) go();
  else jumpTo('counter', go, rand(14, 20));
  return true;
}
// The kitchen sink. Her height up on a perch is its top, except down in the
// basin; she hops in over the front edge and back out the same way.
function inSink() { return place === kitchen && brain.perch === 'counter' && kitchen.inBasin(brain.pos); }
// The furniture her tail keeps out of (clearTail in motion.js): the room's
// list, and in the kitchen the vacuum where it is now; not her bed while
// she's in it, nor the counter while she sits in the sink.
function tailSolids() {
  const list = place.layoutCache?.tailSolids;
  if (!list) return null;
  const inBed = Math.hypot(brain.pos.x - bed.position.x, brain.pos.z - bed.position.z) < place.bedRadius, sink = inSink();
  const out = list.filter(s => !(s.tag === 'bed' && inBed) && !(s.tag === 'counter' && sink));
  if (place === kitchen) { const v = kitchen.vacuum.position; out.push({kind: 'cyl', x: v.x, z: v.z, r: .43, y0: 0, y1: .13}); }
  return out;
}
function perchTop() { return inSink() ? place.layoutCache.sink.y : PERCHES[brain.perch].top; }
function intoSink(spot, then) {
  const S = place.layoutCache.sink, x = THREE.MathUtils.clamp(spot.x, S.x0, S.x1);
  const lane = Math.abs(brain.pos.z - S.laneZ) < .2 ? [] : [new THREE.Vector3(brain.pos.x + .25, 0, S.laneZ)];
  walkPath([...lane, new THREE.Vector3(x, 0, S.laneZ)], () => {
    if (brain.perch !== 'counter' || brain.mode !== 'idle') { setActivity('sit'); return; }
    glanceAt(spot.clone().setY(S.y), 1);
    leap(spot, S.y, 'counter', then);
  });
}
function outOfSink(then) {
  const S = place.layoutCache.sink;
  leap(new THREE.Vector3(THREE.MathUtils.clamp(brain.pos.x, S.x0, S.x1), 0, S.laneZ), PERCHES.counter.top, 'counter', then);
}
// Sitting in the sink, because it's there: a sit, a loaf or a wash, a look
// round, then out again.
function sinkSit() {
  if (place !== kitchen || brain.perch !== 'counter' || brain.jump || inSink()) return false;
  brain.perchUntil = Math.max(brain.perchUntil, clockNow + 30);
  intoSink(place.layoutCache.sink.sitAt, () => {
    brain.heading = rand(-.6, .6);
    const r = Math.random(), done = () => { if (inSink()) outOfSink(() => setActivity('sit', rand(2, 4))); };
    setActivity(r < .4 ? 'sit' : r < .75 ? 'loaf' : 'groom', rand(8, 16), done);
    later(rand(1.5, 3), () => { if (inSink()) { glanceAt(camera.position, 2.4); if (Math.random() < .4) meow(pick(['mew', 'chirp']), 'idle'); if (Math.random() < .35) say(pick(['This is my sink now.', 'Fits perfectly.', 'I fits, I sits.']), 2400); } });
  });
  return true;
}

// Tapping something on a shelf asks her to see to it: up she goes if she
// isn't on that shelf already, along to it, and over it goes (usually).
function inviteKnock(item) {
  if (!item || item.obj.userData.fall) return;
  if (pet.sleeping) { toast('Shh… wake your kitten first.'); return; }
  if (!['idle', 'solo'].includes(brain.mode)) { say(pick(['In a minute!', 'Busy! One sec.']), 2000); return; }
  glanceAt(kitchen.cupWorld(item.obj, new THREE.Vector3()), 1.6);
  twitchEar(0, 1);
  if (Math.random() > .85) { later(.9, () => { glanceAt(camera.position, 2.2); say(pick(['Not now.', 'Maybe later.', '*tail flick*']), 2400); }); return; }
  brain.mode = 'idle';
  brain.nextKnock = 0;
  later(.35, () => meow('chirp', 'idle'));
  const go = () => { if (!knockThing(item, 4)) setActivity('sit'); };
  if (brain.perch === item.shelf && !brain.jump) go();
  else if (brain.perch && brain.perch !== 'shelf' && brain.perch !== 'shelfHigh') jumpDown(() => jumpTo(item.shelf, go, rand(25, 40)));
  else jumpTo(item.shelf, go, rand(25, 40));
}

// The robot vacuum, the star of the kitchen. Now and then it goes out on a
// run (or you tap it), and she has opinions: she stalks it (low crouch,
// wiggle, eyes locked) and pounces with a swat that sends it spinning; or
// she hops on and rides it round the kitchen; or she just watches it,
// suspicious. She hops off before it docks.
function vacuumLife(t) {
  if (place !== kitchen) return;
  const v = kitchen.vac;
  // First run soon after she arrives in the kitchen.
  if (!brain.vacInit) { brain.vacInit = true; brain.nextVacuum = t + rand(20, 40); }
  if (!v.rider && brain.perch === 'vacuum') v.stops += 2; // with her aboard it goes a bit further
  v.rider = brain.perch === 'vacuum';
  if (brain.vacStalk && brain.activity === 'stalk') brain.swatAt.copy(kitchen.vacuum.position);
  // Coming to ride: once she's close, it politely waits for her.
  // (Not at its dock, though: boarding there her hips would be in it.)
  if (brain.vacRide && v.state === 'out' && !kitchen.vacuumNearHome && brain.pos.distanceTo(kitchen.vacuum.position) < 2.4) v.wait = Math.max(v.wait, t + .6);
  if (v.state === 'docked' && !pet.sleeping && !night && t > brain.nextVacuum) {
    brain.nextVacuum = t + rand(150, 260);
    kitchen.startVacuum(t);
    brain.vacReactAt = t + rand(1.5, 3); brain.vacReacts = 0;
  }
  if (v.rider && !brain.jump && brain.activity !== 'prejump' && (v.state === 'docked' || (v.state === 'home' && kitchen.vacuumNearHome) || pet.sleeping)) {
    jumpDown(() => { setActivity('sit'); glanceAt(kitchen.vacuum.position.clone().setY(.2), 2); });
    return;
  }
  // Mostly one reaction a run (now and then a second): a swat, a ride, or a
  // long suspicious look, or she just carries on.
  if (v.state === 'out' && t > brain.vacReactAt && (brain.vacReacts ?? 0) < 2 && brain.mode === 'idle' && !pet.sleeping && !brain.jump && ['sit', 'loaf', 'groom'].includes(brain.activity)) {
    brain.vacReactAt = t + rand(20, 35);
    brain.vacReacts = (brain.vacReacts ?? 0) + (brain.vacReacts ? 1 : Math.random() < .7 ? 2 : 1);
    const r = Math.random(), react = () => r < .28 ? vacuumAttack() : r < .7 ? vacuumRide() : r < .85 ? vacuumWatch() : null;
    // Up on a perch she may well come down for it.
    if (!brain.perch) react();
    else if (brain.perch !== 'vacuum') { if (Math.random() < .55) jumpDown(react); else vacuumWatch(); }
  }
}
const vacAt = () => kitchen.vacuum.position;
// Up to a spot a little way off it, on her side.
function nearVacuum(dist) {
  const p = vacAt(), dx = brain.pos.x - p.x, dz = brain.pos.z - p.z, d = Math.max(.01, Math.hypot(dx, dz));
  return kitchen.clampFloor(new THREE.Vector3(p.x + dx / d * dist, 0, p.z + dz / d * dist));
}
function vacuumAttack() {
  glanceAt(vacAt().clone().setY(.2), 3); express('curious', 1.5); twitchEar(0, 1);
  brain.swatAt = vacAt().clone(); brain.vacStalk = true;
  const go = tries => {
    if (kitchen.vac.state === 'docked' || brain.mode !== 'idle') { brain.vacStalk = false; return; }
    if (brain.pos.distanceTo(vacAt()) > 2.2) { if (tries < 4) walkTo(approachVacuum(1.5), () => go(tries + 1), 1.0, true); else { brain.vacStalk = false; setActivity('sit'); } return; }
    // Stalk: low, bottom wiggling, eyes locked on; then the pounce.
    setActivity('stalk', rand(1.2, 2.2), () => {
      if (kitchen.vac.state === 'docked' || brain.mode !== 'idle') { brain.vacStalk = false; setActivity('sit'); return; }
      // It's driven off while she was winding up: after it again.
      if (brain.pos.distanceTo(vacAt()) > 2.6 && tries < 4) { go(tries + 1); return; }
      brain.vacStalk = false;
      // A pounce is at most a good long bound; if it's driven on, she misses.
      // She leads it: aims where it'll be by the time she lands.
      const v = kitchen.vac, moving = v.state !== 'docked' && clockNow > v.wait && !v.spin;
      const p = vacAt().clone().add(new THREE.Vector3(Math.sin(v.heading), 0, Math.cos(v.heading)).multiplyScalar(moving ? .3 : 0));
      const dx = p.x - brain.pos.x, dz = p.z - brain.pos.z, d = Math.max(.01, Math.hypot(dx, dz)), reach = Math.min(2.0, Math.max(0, d - .45));
      brain.pounce = {start: clockNow, from: brain.pos.clone(), to: kitchen.clampFloor(new THREE.Vector3(brain.pos.x + dx / d * reach, 0, brain.pos.z + dz / d * reach)), caught: false, at: vacAt, onHit: () => {
        if (brain.pos.distanceTo(vacAt()) > 1.15) {
          setActivity('pause', 1.2, () => setActivity('sit'));
          later(.5, () => { glanceAt(camera.position, 2); if (Math.random() < .5) say(pick(['I meant to do that.', '…', 'Next time.']), 2200); });
          return;
        }
        brain.swatAt = vacAt().clone(); brain.swatSoft = false;
        setActivity('swat', .45, () => setActivity('pause', 1.2, () => setActivity('sit')));
        kitchen.hitVacuum(clockNow, brain.pos);
        express('excited', 2);
        later(.7, () => { glanceAt(vacAt().clone().setY(.2), 1.5); meow(pick(['meow', 'chirp']), 'reply'); if (Math.random() < .5) say(pick(['Got it!', 'And stay out.', 'Intruder!', 'Who’s the boss now?']), 2200); });
        later(2.4, () => glanceAt(camera.position, 2));
      }};
      setActivity('pause', 1.6);
    });
  };
  go(0);
}
// A spot to hop on from: her own side of it, unless landing from there
// would carry her head into the furniture beyond it (the counter, a wall),
// then from behind or ahead of it, along its way.
function approachVacuum(dist) {
  const p = vacAt(), h = kitchen.vac.heading, dx = brain.pos.x - p.x, dz = brain.pos.z - p.z, d = Math.max(.01, Math.hypot(dx, dz));
  let best = null, bestMoved = Infinity;
  for (const [x, z] of [[dx / d, dz / d], [-Math.sin(h), -Math.cos(h)], [Math.sin(h), Math.cos(h)]]) {
    const beyond = new THREE.Vector3(p.x - x * .8, 0, p.z - z * .8), spot = new THREE.Vector3(p.x + x * dist, 0, p.z + z * dist);
    const moved = kitchen.clampFloor(beyond.clone()).distanceTo(beyond) + kitchen.clampFloor(spot.clone()).distanceTo(spot);
    if (moved < .05) return kitchen.clampFloor(spot);
    if (moved < bestMoved) { bestMoved = moved; best = spot; }
  }
  // (Nowhere clean: the least bad of them.)
  return kitchen.clampFloor(best);
}
function vacuumRide() {
  glanceAt(vacAt().clone().setY(.2), 2); express('curious', 1.2);
  brain.vacRide = true;
  const go = tries => walkTo(approachVacuum(.95), () => {
    const v = kitchen.vac;
    if (v.state === 'docked' || brain.mode !== 'idle') { brain.vacRide = false; setActivity('sit'); return; }
    // It moved on: after it (a few times), then give up. Still at its dock:
    // she lets it come out first (boarding there, her hips would be in it).
    if (brain.pos.distanceTo(vacAt()) > 1.4 || kitchen.vacuumNearHome) { if (tries < 5) later(.8, () => go(tries + 1)); else { brain.vacRide = false; setActivity('sit'); } return; }
    brain.vacRide = false;
    // It waits for her (it's polite), and up she hops.
    v.wait = Math.max(v.wait, clockNow + 2.4);
    leap(vacAt(), PERCHES.vacuum.top, 'vacuum', () => {
      brain.perchUntil = clockNow + rand(40, 70); // rides till it heads home, mostly
      setActivity(Math.random() < .5 ? 'loaf' : 'sit');
      later(.6, () => { meow('chirp', 'reply'); if (Math.random() < .6) say(pick(['Onward!', 'Chauffeur, please.', 'Wheee.', 'To the bowl, please.']), 2200); });
    });
  }, tries > 1 ? 1.0 : false, true);
  go(0);
}
function vacuumWatch() {
  [0, 1.6, 3.4].forEach(d => later(d, () => { if (kitchen.vac.state !== 'docked' && !brain.perch) glanceAt(vacAt().clone().setY(.2), 1.4); }));
  twitchEar(1, 1);
  if (Math.random() < .5) later(1, () => say(pick(['…', 'It’s back.', 'I don’t trust it.']), 2000));
}
// Tapping the vacuum: off it goes on a run (she'll have a reaction), or if
// it's already out, she goes after it.
function inviteVacuum() {
  if (pet.sleeping) { toast('Shh… wake your kitten first.'); return; }
  const v = kitchen.vac;
  if (v.state === 'docked') { kitchen.startVacuum(clockNow); brain.vacReactAt = clockNow + rand(1.2, 2.5); brain.vacReacts = 0; brain.nextVacuum = clockNow + rand(150, 260); glanceAt(vacAt().clone().setY(.2), 1.5); twitchEar(0, 1); return; }
  if (brain.perch === 'vacuum') { meow('chirp', 'idle'); return; }
  if (!['idle', 'solo'].includes(brain.mode)) return;
  brain.mode = 'idle';
  const go = () => Math.random() < .5 ? vacuumAttack() : vacuumRide();
  if (brain.perch) jumpDown(go); else go();
}

// Birds at the window, in daytime. Up on the sill she gets them often; from
// the floor now and then one catches her eye and she may go up to watch.
// Her head (not just her eyes) turned to the bird, near enough.
function lookingAtBird() {
  if (!brain.glance) return false;
  const want = angleTo(brain.pos, brain.glance), face = brain.heading + brain.head.yaw;
  return Math.abs(Math.atan2(Math.sin(want - face), Math.cos(want - face))) < .5;
}
function watchBirds(t) {
  room.batsOn = false;
  // The bird visits the window of whichever room she's in (the study's or
  // the kitchen's garden doors); Halloween's bats are the study's.
  const win = place;
  if (pet.sleeping || !ready) {
    brain.watching = false;
    // Halloween evenings: bats swoop outside the window; now and then she
    // stirs and an ear flicks.
    room.batsOn = ready && place === room && room.decor === 'halloween' && night;
    if (kitchen) kitchen.batsOn = ready && place === kitchen && room.decor === 'halloween' && night;
    if (room.batsOn && t > (brain.nextBatTwitch ??= t + 8)) { brain.nextBatTwitch = t + rand(10, 25); twitchEar(undefined, .7); }
    host.classList.remove('bird');
    return;
  }
  room.batsOn = place === room && room.decor === 'halloween' && night;
  if (kitchen) kitchen.batsOn = place === kitchen && room.decor === 'halloween' && night;
  const onSill = brain.perch === 'sill' && !brain.jump;
  // The bird is a regular (by night, a moth at the glass): it comes by about once a minute while she's up
  // and about (whatever the decor), and keeps coming back while she sits at
  // the window. If she's busy on another perch it waits a little.
  if (!win.birdRun && t > brain.nextBird) {
    // (In the kitchen she can see the doors from her perches too.)
    if (brain.mode === 'idle' && (onSill || !brain.perch || place !== room)) {
      // (By day mostly the bird, sometimes a monarch butterfly or a moth;
      // by night the moth.)
      const r = Math.random();
      const d = win.startBird(t, night ? 'moth' : r < .25 ? 'butterfly' : r < .42 ? 'dayMoth' : undefined);
      brain.birdSeen = false;
      brain.nextBird = t + d + (onSill ? rand(4, 9) : rand(12, 24));
    } else brain.nextBird = t + rand(6, 12);
  }
  const at = win.birdWorld(tmpV3);
  host.classList.toggle('bird', !!at);
  // Once the bird has gone, a cat at the window with all that excitement and
  // nowhere to put it may well take it out on the top book.
  if (!at && brain.birdSeen && brain.birdLeft == null) {
    brain.birdLeft = t;
    if (onSill && t > brain.nextKnock && !room.bookFall && Math.random() < .6) setTimeout(() => { if (brain.perch === 'sill' && !brain.jump && brain.mode === 'idle' && !pet.sleeping) knockBook(); }, 1200);
  }
  const busy = ['walk', 'prejump', 'jump', 'land', 'poise', 'swat', 'stalk', 'pounce', 'catnap', 'eat', 'drink'];
  brain.watching = !!at && brain.mode === 'idle' && !brain.jump && !busy.includes(brain.activity);
  if (!brain.watching) return;
  brain.glance = (brain.glance || new THREE.Vector3()).copy(at);
  brain.glanceUntil = t + .4;
  if (!brain.birdSeen) {
    brain.birdSeen = true; brain.birdLeft = null;
    twitchEar(0, 1.2); setTimeout(() => twitchEar(1, 1.2), 120);
    express('curious', 1.5);
    if (brain.activity !== 'sit') setActivity('sit');
    // She chatters at it (a chirp, often a second): only once she's
    // actually looking at it.
    const chirp = (tries, then) => later(.25, () => {
      if (!brain.watching) return;
      if (lookingAtBird() || tries > 12) { meow('chirp', 'idle'); then?.(); } else chirp(tries + 1, then);
    });
    later(.35, () => chirp(0, () => { if (Math.random() < .6) later(1.1, () => chirp(0)); }));
    // From the floor: sometimes she goes up for a better look.
    // (In the kitchen, she trots over to the garden doors.)
    const spot = place.layoutCache.windowSpot;
    if (!onSill && Math.random() < (place === room ? .4 : .2)) setTimeout(() => {
      if (brain.mode !== 'idle' || brain.perch || pet.sleeping) return;
      if (PERCHES.sill) jumpTo('sill', () => { setActivity('sit'); brain.nextBird = clockNow + rand(3, 8); }, rand(30, 50));
      else if (spot) walkTo(spot, () => { setActivity('sit'); brain.nextBird = clockNow + rand(3, 8); }, false, true);
    }, 1500);
  }
}

// A paw print where you tapped a perch, so you can see the tap landed.
function pawAt(x, y) {
  const s = document.createElement('span');
  s.className = 'tap-paw';
  s.innerHTML = icon('i-paw');
  s.style.left = x + 'px'; s.style.top = y + 'px';
  $('#float-layer').append(s);
  setTimeout(() => s.remove(), 1000);
}

// ---------------------------------------------------------------------------
// Care actions
// ---------------------------------------------------------------------------
function setMode(mode, seconds = Infinity) {
  brain.mode = mode;
  brain.modeStart = clockNow;
  brain.modeUntil = clockNow + seconds;
  host.classList.toggle('playing', mode === 'play');
  refresh();
}
function finishMode() {
  if (brain.mode === 'idle') return;
  brain.mode = 'idle';
  express('joy', 1.4);
  hop();
  refresh();
}

let lastPet = -10;
function act(a, opts = {}) {
  advance(pet);
  if (!ready && a !== 'sleep') { toast('Your kitten is still settling in. One moment.'); return false; }
  if (brain.mode === 'play' && a !== 'sleep' && a !== 'pet') { toast('Playtime is in progress. Move the toy around!'); return false; }
  if ((brain.mode === 'feed' || brain.mode === 'brush' || brain.mode === 'drink') && a !== 'sleep' && a !== 'pet') { if (!opts.auto) toast('One thing at a time — almost done!'); return false; }
  if (a === 'pet' && clockNow - lastPet < .9) return false;
  if (pet.sleeping && a === 'pet') {
    twitchEar(undefined, .8);
    say(pick(['Mmm… five more minutes.', 'Zzz… *happy mumble*']), 2600);
    return false;
  }
  const before = {...pet};
  const r = care(pet, a, opts.snack);
  if (!r.ok) {
    if (opts.auto) return false;
    if (a === 'drink') { glanceAt(fountain.position, 1.5); say('Not thirsty right now, thanks!', 2600, true); return false; }
    toast(r.message);
    if (a === 'feed') { twitchEar(); say('I’m stuffed, thank you!', 3600, true); }
    if (a === 'play') { yawn(); say('Too sleepy to play…', 3600, true); }
    return false;
  }
  showDeltas(before);
  const t = clockNow;
  brain.nextIdle = t + 9;
  if (a === 'feed') {
    const name = {kibble: 'crunchy kibble', salmon: 'salmon bites', chicken: 'chicken morsels'}[opts.snack] || 'crunchy kibble';
    kibbles.forEach(k => k.visible = true);
    setMode('feed');
    brain.tailUpUntil = t + 5;
    meow('chirp');
    express('excited', 1);
    say(pick([`${name[0].toUpperCase() + name.slice(1)}?! Best. Human. Ever.`, `Mmm, ${name}! You know the way to my heart.`]));
    walkTo(EAT_SPOT, () => {
      setActivity('eat', 3.8, () => {
        kibbles.forEach(k => k.visible = false);
        burst('sparkle', 5);
        setActivity('groom', 2.4, () => { finishMode(); setActivity('sit'); });
      });
      brain.chewUntil = clockNow + 3.6;
    }, true, true);
    moment(`A happy tummy, thanks to ${name}.`, 'i-bowl');
  } else if (a === 'drink') {
    setMode('drink');
    if (!opts.auto) { say(pick(['Ooh, fresh water!', 'Sip sip sip…', 'Mrrp! Water time.']), 2600); moment('A refreshing drink from the fountain.', 'i-drop'); }
    walkTo(DRINK_SPOT, () => {
      setActivity('drink', 3.4, () => setActivity('groom', 1.6, () => { finishMode(); setActivity('sit'); }));
    }, false, true);
  } else if (a === 'brush') {
    setMode('brush', 4);
    setActivity('loaf', 4);
    purr(3.6);
    say(pick(['Oh, that’s the spot… fluffy again!', 'Mmm. Brush the cheeks too, please.']));
    setTimeout(() => burst('sparkle', 6), 900);
    moment('Freshly brushed & feeling fabulous.', 'i-brush');
  } else if (a === 'play') {
    startPlay();
    moment('A little mischief. A lot of fun.', 'i-yarn');
  } else if (a === 'sleep') {
    endPlay(true);
    brain.mode = 'idle';
    if (pet.sleeping) {
      yawn();
      setTimeout(() => meow('sleepy'), 300);
      say('Zzz… time for a cozy nap.');
      walkTo(CUSHION_SPOT, () => setActivity('sleep'), false, true);
      moment('Tucked in for sweet little dreams.', 'i-moon');
    } else {
      setActivity('stretch', 2.2, () => walkTo(HOME, () => { express('joy', 1.4); hop(); meow('mew'); setActivity('sit'); }));
      setTimeout(yawn, 300);
      say('Good morning, my favourite human.');
      moment('Hello again, sleepyhead.', 'i-sun');
    }
  } else if (a === 'pet') {
    lastPet = t;
    // Stop wandering to enjoy the attention.
    if (brain.mode === 'idle' && brain.activity === 'walk') { brain.target = null; brain.after = null; setActivity('sit'); }
    brain.petTimes = brain.petTimes.filter(x => t - x < 12).concat(t);
    const rollOver = brain.petTimes.length >= 3 && ['sit', 'loaf'].includes(brain.activity) && brain.mode === 'idle';
    if (rollOver) {
      brain.petTimes = [];
      setActivity('belly', 5, () => { setActivity('sit'); hop(); });
      say(pick(['Belly rubs?! Just this once…', 'You may pet the floof.', 'Purrrr… I trust you.']), 3200);
      burst('heart', 7);
    } else {
      express(opts.stroke ? 'bliss' : pet.bond >= 100 && Math.random() < .4 ? 'love' : 'joy', 2.2);
      brain.rubUntil = t + (opts.stroke ? 1.2 : 1.8);
      brain.tailUpUntil = t + 2.5;
      if (!opts.stroke && brain.activity !== 'belly') hop();
      burst('heart', opts.stroke ? 3 : 5, opts.at || headScreen);
      if (!opts.quiet) say(pick(['I like it here. Especially with you.', 'More of that, please.', 'You have excellent petting skills.', 'Purrrr…', 'Right behind the ears. Perfect.']), 3000);
    }
    brain.kneadUntil = t + 2.4;
    purr(2.2);
    if (pet.bond >= 15 && Math.random() < .45) setTimeout(slowBlink, 2400);
    if (pet.cuddles % 5 === 0) moment(`${pet.cuddles} cuddles. One very happy cat.`, 'i-heart');
  }
  refresh();
  save();
  return true;
}

// Play: steer the toy; the kitten chases it, wiggles and pounces.
const PLAY_SECONDS = 25;
function startPlay() {
  setMode('play', PLAY_SECONDS);
  setActivity('play');
  brain.playEnd = clockNow + PLAY_SECONDS;
  brain.catches = 0;
  brain.stillSince = clockNow;
  brain.pounceReadyAt = clockNow + 1.2;
  toyTarget.set(brain.pos.x + rand(-.6, .6), .13, Math.min(1.9, brain.pos.z + 1.3));
  $('#play-meter').hidden = false;
  $('#play-score').textContent = '0 catches';
  express('surprised', .4);
  meow('chirp');
  say('Catch me if you can! Steer the toy around.', 3600, true);
}
// Solo play: when she's in the mood, she bats the ball around the rug by
// herself, chasing it, swatting it and now and then pouncing.
function startSolo() {
  setMode('solo', rand(14, 24));
  setActivity('play');
  brain.stillSince = clockNow;
  brain.pounceReadyAt = clockNow + 1.5;
  express('excited', 1);
}
function endPlay(silent = false) {
  if (brain.mode !== 'play') return;
  brain.mode = 'idle';
  brain.pounce = null;
  host.classList.remove('playing');
  $('#play-meter').hidden = true;
  toyTarget.copy(TOY_HOME);
  setActivity('sit');
  if (!silent) {
    const n = brain.catches;
    express('joy', 2);
    hop();
    burst('sparkle', 6);
    say(n ? `That was fun! ${n} catch${n === 1 ? '' : 'es'}. Same time tomorrow?` : 'That was fun. Same time tomorrow?');
    toast(`Playtime complete · ${n} catch${n === 1 ? '' : 'es'} · joy +18`);
    if (n >= 3) moment(`Pounce champion: ${n} catches!`, 'i-yarn');
  }
  refresh();
}
function catchToy() {
  const pc = brain.pounce;
  if (!pc || pc.caught) return;
  pc.caught = true;
  if (brain.mode === 'play') {
    brain.catches++;
    $('#play-score').textContent = `${brain.catches} catch${brain.catches === 1 ? '' : 'es'}`;
    burst('sparkle', 4, toyScreen());
    meow('chirp');
  } else if (Math.random() < .3) meow('chirp', 'idle');
  // The toy squirts away from the paws.
  const a = rand(0, Math.PI * 2);
  toyTarget.copy(onRug(new THREE.Vector3(toy.position.x + Math.sin(a) * 1.3, .13, toy.position.z + Math.cos(a) * 1.1))).setY(.13);
  brain.stillSince = clockNow + 1;
  setTimeout(() => express('joy', 1), 300);
}
function toyScreen() {
  const p = toy.position.clone().project(camera);
  return {x: (p.x * .5 + .5) * host.clientWidth, y: (-p.y * .5 + .5) * host.clientHeight};
}
function updatePlay(dt, t) {
  const playing = brain.mode === 'play', solo = brain.mode === 'solo';
  toy.position.x = damp(toy.position.x, toyTarget.x, playing ? 10 : 4, dt);
  toy.position.z = damp(toy.position.z, toyTarget.z, playing ? 10 : 4, dt);
  toyVel.subVectors(toy.position, toyLast).divideScalar(Math.max(dt, 1e-3));
  toyLast.copy(toy.position);
  toy.rotation.x += toyVel.z * dt / .12;
  toy.rotation.z -= toyVel.x * dt / .12;
  // A decor can swap the ball for its own toy (Halloween's felt bat): it
  // slides and wobbles where the ball would roll.
  const alt = room.altToy;
  toy.visible = !alt;
  if (alt) {
    const speed = toyVel.length();
    alt.position.set(toy.position.x, 0, toy.position.z);
    if (speed > .15) alt.rotation.y = dampAngle(alt.rotation.y, Math.atan2(toyVel.x, toyVel.z) + Math.PI, 8, dt);
    alt.rotation.z = Math.sin(t * 18) * Math.min(.35, speed * .25);
    alt.rotation.x = -Math.min(.4, speed * .2);
  }
  if (!playing && !solo) return;
  if (playing) {
    const remaining = brain.playEnd - t;
    $('#play-fill').style.transform = `scaleX(${clamp(remaining / PLAY_SECONDS, 0, 1)})`;
    if (remaining <= 0) { endPlay(); return; }
  } else if (t > brain.modeUntil && !brain.pounce) {
    brain.mode = 'idle';
    setActivity('sit', rand(3, 6));
    if (Math.random() < .5) setTimeout(() => { glanceAt(camera.position, 2); slowBlink(); }, 800);
    return;
  }
  if (brain.jump) return;
  if (toyVel.length() > .35) brain.stillSince = t;
  // A swat lands: the ball rolls off away from her paw.
  if (brain.swatHit && t > brain.swatHit) {
    brain.swatHit = 0;
    const a = brain.heading + rand(-.6, .6), d = brain.swatSoft ? rand(.2, .35) : rand(.7, 1.4);
    brain.swatSoft = false;
    toyTarget.copy(onRug(new THREE.Vector3(toy.position.x + Math.sin(a) * d, .13, toy.position.z + Math.cos(a) * d))).setY(.13);
    brain.stillSince = t + .8;
  }
  if (brain.pounce || brain.activity === 'swat') return;
  const dx = toy.position.x - brain.pos.x, dz = toy.position.z - brain.pos.z, dist = Math.hypot(dx, dz);
  if (solo) {
    // Mid-story with the felt bat (stalk, tap, pause): stay put, even if the
    // tap sent it a little further; the pounce covers the distance.
    if (['stalk', 'swat', 'pause'].includes(brain.activity)) return;
    // Up close to the ball, then mostly swats, sometimes a pounce.
    if (dist > .85) {
      if (brain.activity !== 'walk' || !brain.target || brain.target.distanceTo(toy.position) > .9) walkTo(new THREE.Vector3(toy.position.x - dx / dist * .6, 0, toy.position.z - dz / dist * .6), () => setActivity('play'), dist > 2.2);
      return;
    }
    if (brain.activity === 'walk') setActivity('play');
    if (brain.activity !== 'play' || t < brain.pounceReadyAt || t - brain.stillSince < .5) return;
    if (room.altToy && !brain.stalked) {
      // The felt bat: she stalks it (low, tail twitching, a little wiggle),
      // taps it, pauses to watch, then pounces.
      brain.stalked = true;
      express('curious', 1.2);
      setActivity('stalk', 1.4, () => {
        brain.swatAt = toy.position.clone();
        setActivity('swat', .45, () => setActivity('pause', .9, () => {
          if (brain.mode !== 'solo') return;
          const ddx = toy.position.x - brain.pos.x, ddz = toy.position.z - brain.pos.z, dd = Math.max(.01, Math.hypot(ddx, ddz));
          brain.pounce = {start: clockNow, from: brain.pos.clone(), to: onRug(new THREE.Vector3(toy.position.x - ddx / dd * .5, 0, toy.position.z - ddz / dd * .5)), caught: false};
          express('excited', 1.4);
          setActivity('play');
        }));
        brain.swatHit = clockNow + .22; brain.swatSoft = true;
      });
      brain.pounceReadyAt = t + 6;
      return;
    }
    brain.stalked = false;
    if (Math.random() < .7) {
      brain.swatAt = toy.position.clone();
      setActivity('swat', .45, () => setActivity('play'));
      brain.swatHit = t + .22;
    } else {
      brain.pounce = {start: t, from: brain.pos.clone(), to: onRug(new THREE.Vector3(toy.position.x - dx / dist * .5, 0, toy.position.z - dz / dist * .5)), caught: false};
      express('excited', 1.4);
    }
    brain.pounceReadyAt = t + rand(1.4, 2.8);
    return;
  }
  if (dist > 1.35) {
    // Chase: run to a spot just short of the toy.
    if (brain.activity !== 'walk' || !brain.target || brain.target.distanceTo(toy.position) > 1.2) {
      walkTo(new THREE.Vector3(toy.position.x - dx / dist * .95, 0, toy.position.z - dz / dist * .95), () => setActivity('play'), true);
    }
    return;
  }
  if (brain.activity === 'walk' && dist < 1.1) setActivity('play');
  const still = t - brain.stillSince;
  if (brain.activity === 'play' && t > brain.pounceReadyAt && (still > .7 || (toyVel.length() > 2.5 && Math.random() < dt * 1.5))) {
    const to = new THREE.Vector3(toy.position.x - dx / dist * .55, 0, toy.position.z - dz / dist * .55);
    brain.pounce = {start: t, from: brain.pos.clone(), to: onRug(to), caught: false};
    brain.pounceReadyAt = t + 2;
    express('excited', 1.4);
  }
}

// ---------------------------------------------------------------------------
// Input: stroke the kitten, drag to orbit, steer the toy, look at the pointer
// ---------------------------------------------------------------------------
// Camera: an orbit around a focus point. Everything is eased toward `goal`.
//   one finger / left mouse  orbit        pinch / wheel           zoom
//   two fingers / right drag pan          buttons                 whole room, follow Mochi, food, water, bed
const view = {
  focus: new THREE.Vector3(0, .7, -.2), yaw: 0, pitch: .3, dist: 7,
  goal: {focus: new THREE.Vector3(0, .7, -.2), yaw: 0, pitch: .3, dist: 7},
  mode: 'room', lastDrag: -10, zoomedAt: -100,
};
const pointer = new THREE.Vector2(), ray = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -.13);
const gazePlane = new THREE.Plane();
let gesture = null;
const touches = new Map();
let pinch = null;

function setPointer(e) {
  const r = host.getBoundingClientRect();
  pointer.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
  ray.setFromCamera(pointer, camera);
  return r;
}
function hitsCat() { return ready && ray.intersectObjects(cat.meshes, false).length > 0; }
function hitsFountain() { return ready && ray.intersectObjects(room.clickables, false).length > 0; }
// Which perch (if any) is under the pointer: the window and its sill, the
// chair, or the fireplace and its mantel.
function perchAt() {
  if (!ready) return null;
  let best = null;
  if (place === kitchen) {
    kitchen.knockables.forEach((k, i) => {
      if (k.obj.userData.fall) return;
      const hit = ray.intersectObject(k.obj, true)[0];
      if (hit && (!best || hit.distance < best.d)) best = {name: 'knock:' + i, d: hit.distance};
    });
    for (const part of kitchen.faucetParts) { const hit = ray.intersectObject(part, false)[0]; if (hit && (!best || hit.distance < best.d)) best = {name: 'faucet', d: hit.distance}; }
  }
  for (const [name, obj] of place.layoutCache.perchTargets) {
    if (!obj.visible) continue;
    const hit = ray.intersectObject(obj, true).find(h => h.object.visible && h.object.material?.blending !== THREE.AdditiveBlending);
    if (hit && (!best || hit.distance < best.d)) best = {name, d: hit.distance};
  }
  return best?.name || null;
}
// Tapping a perch invites her up. She's a cat: mostly she goes (with a
// chirp), sometimes she just looks at it, then at you. Ask again and she's
// more likely to give in.
let lastInvite = {name: null, at: -99};
function invite(name) {
  if (name.startsWith('knock:')) { inviteKnock(kitchen.knockables[+name.slice(6)]); return; }
  if (name === 'faucet') { if (pet.sleeping) { toast('Shh… wake your kitten first.'); return; } if (!['idle', 'solo'].includes(brain.mode)) return; brain.mode = 'idle'; later(.35, () => meow('chirp', 'idle')); if (brain.perch && brain.perch !== 'counter') jumpDown(drinkFaucet); else drinkFaucet(); return; }
  if (name === 'vacuum') { inviteVacuum(); return; }
  if (name === 'salmon') { if (pet.sleeping) { toast('Shh… wake your kitten first.'); return; } if (!kitchen.salmonReady) { say('All gone…', 2000); return; } if (Math.random() < .85) { brain.mode = 'idle'; stealSalmon(); } else say(pick(['I would never.', '*innocent look*']), 2200); return; }
  if (pet.sleeping) { toast('Shh… wake your kitten first.'); return; }
  if (!['idle', 'solo'].includes(brain.mode)) { say(pick(['In a minute!', 'Busy! One sec.']), 2000); return; }
  const P = PERCHES[name];
  if (brain.perch === name && !brain.jump) { glanceAt(camera.position, 2); slowBlink(); meow('mew', 'idle'); return; }
  const again = lastInvite.name === name && clockNow - lastInvite.at < 12;
  lastInvite = {name, at: clockNow};
  glanceAt(P.spot.clone().setY(P.top + .2), 1.6);
  twitchEar(0, 1);
  if (Math.random() < (again ? .9 : .72)) {
    brain.mode = 'idle';
    setTimeout(() => meow('chirp', 'idle'), 350);
    jumpTo(name, () => {
      setActivity('sit');
      if (name === 'sill') brain.nextBird = clockNow + rand(3, 8);
      if (name === 'chair') { brain.kneadUntil = clockNow + 3; setActivity('loaf', 3.4, () => setActivity('catnap', rand(10, 18), () => { slowBlink(); setActivity('sit', 4); })); }
    }, rand(25, 40));
  } else setTimeout(() => {
    glanceAt(camera.position, 2.2); express('curious', 1.6);
    say(pick(['Maybe later.', 'Hmm… no.', '*tail flick*', 'I heard you. I’m choosing not to.', 'Not right now, thank you.']), 2600);
  }, 900);
}
function trackPointer(e) {
  const r = setPointer(e);
  brain.pointerAt = clockNow;
  gazePlane.setFromNormalAndCoplanarPoint(tmpV.subVectors(camera.position, cat.root.position).setY(0).normalize(), tmpV2.copy(cat.root.position).setY(1).add(tmpV.multiplyScalar(1.2)));
  ray.ray.intersectPlane(gazePlane, brain.pointerWorld);
  if (brain.mode === 'play') {
    const hit = new THREE.Vector3();
    if (ray.ray.intersectPlane(groundPlane, hit)) toyTarget.copy(onRug(hit.setY(0))).setY(.13);
  }
  return r;
}

function setCamMode(mode) {
  view.mode = mode;
  for (const b of document.querySelectorAll('[data-cam]')) b.setAttribute('aria-pressed', String(b.dataset.cam === mode));
}
function clampGoal() {
  const g = view.goal;
  g.dist = clamp(g.dist, ...LIMITS.dist);
  g.pitch = clamp(g.pitch, ...LIMITS.pitch);
  g.focus.x = clamp(g.focus.x, ...LIMITS.x);
  g.focus.y = clamp(g.focus.y, ...LIMITS.y);
  g.focus.z = clamp(g.focus.z, ...LIMITS.z);
}
function orbit(dx, dy) {
  view.goal.yaw -= dx * .008;
  view.goal.pitch += dy * .006;
  view.lastDrag = clockNow;
  if (view.mode === 'room' || view.mode === 'spot') setCamMode('free');
  clampGoal();
}
function pan(dx, dy) {
  const k = view.goal.dist * .0016, yaw = view.goal.yaw;
  view.goal.focus.x += (-dx * Math.cos(yaw) - dy * Math.sin(yaw) * .6) * k;
  view.goal.focus.z += (dx * Math.sin(yaw) - dy * Math.cos(yaw) * .6) * k;
  view.goal.focus.y += dy * k * .5;
  view.lastDrag = clockNow;
  setCamMode('free');
  clampGoal();
}
function zoomBy(f) {
  view.goal.dist *= f;
  view.lastDrag = view.zoomedAt = clockNow;
  clampGoal();
}

// Ready-made views. Tall (phone) screens stand back a little further.
const tallScreen = () => camera.aspect < .9;
function lookAtSpot(pos, {dist = 2.6, pitch = .42, y = .25} = {}) {
  // View the spot from the open middle of the room, so walls stay behind it.
  const yaw = Math.atan2(.3 - pos.x, 3.2 - pos.z);
  Object.assign(view.goal, {yaw, pitch, dist: dist * (tallScreen() ? 1.35 : 1)});
  view.goal.focus.set(pos.x, y, pos.z);
  setCamMode('spot');
  clampGoal();
}
// The Room view fits the furnishings into the part of the screen that the
// camera buttons and the care bar leave clear: both ends of the sill, the bed,
// the chair and fountain across; the front of the rug and the bowls just above
// the care bar; the painting's top edge below the top. Whatever the screen
// shape, the furniture fills the frame and spare height goes to the wall.
const ROOM_FRAME = {
  across: [[3.72, .95, -.9], [2.9, .3, .55], [2.55, .14, 1.95]],
  bottom: [[-2.25, 0, 1.8], [1.45, 0, 1.8], [2.55, 0, 1.95]],
  left: [[-3.67, .25, -1.75], [-3.45, .2, -.55]],
  // On a phone the view centres on the cosy side (chair, olive tree and
  // fireplace) and lets the bed and window run a little off the left.
  leftNarrow: [[-2.85, .25, -1.45], [-2.6, .2, -.65]],
  // On a wide screen: the whole fireplace and the far end of the sill. On a
  // narrow one, the fire and the near side of the fireplace, and the ends
  // of the sill and mantel may run off the edges.
  fireWide: [[-3.75, 1.62, -2.95], [3.6, .5, 1.1], [4.15, 2.75, .2], [4.15, 2.75, 2.0], [3.55, 0, 2.6]],
  fireNarrow: [[3.6, .4, .4], [4.1, .5, 1.1]],
  top: [],
};
const fitCam = new THREE.PerspectiveCamera(), fitPt = new THREE.Vector3(), fitOff = new THREE.Vector3();
function roomFrame() {
  const W = Math.max(1, host.clientWidth), H = Math.max(1, host.clientHeight), box = host.getBoundingClientRect();
  if (!ROOM_FRAME.top.length && room.printSize) {
    const pg = room.printGroup, {w, h} = room.printSize;
    pg.updateWorldMatrix(true, false);
    // (In the study's own frame: it may be standing beyond the kitchen's doorway.)
    for (const x of [-w / 2, w / 2]) ROOM_FRAME.top.push(room.group.worldToLocal(pg.localToWorld(new THREE.Vector3(x, h / 2 + .05, 0))).toArray());
    const wg = room.windowGroup;
    wg.updateWorldMatrix(true, false);
    ROOM_FRAME.top.push(room.group.worldToLocal(wg.localToWorld(new THREE.Vector3(0, room.curtainRod.y + .15, 0))).toArray());
  }
  // The clear area, in screen units (-1 to 1): the camera buttons only cover
  // the right edge down to their last button.
  let right = W, camsBottom = -1, bottom = H;
  if (!document.body.classList.contains('watch')) {
    const cams = $('.cam-buttons')?.getBoundingClientRect(), dock = $('.dock')?.getBoundingClientRect();
    if (cams?.width && cams.left - box.left > W / 2) { right = cams.left - box.left - 6; camsBottom = 1 - (cams.bottom - box.top + 6) / H * 2; }
    if (dock?.height && dock.top - box.top > H / 2) bottom = dock.top - box.top - 10;
  }
  const L = -1 + 20 / W, Rcams = right / W * 2 - 1, Redge = 1 - 14 / W, B = 1 - bottom / H * 2, T = 1 - 16 / H;
  fitCam.fov = camera.fov; fitCam.aspect = W / H; fitCam.updateProjectionMatrix();
  const tanV = Math.tan(THREE.MathUtils.degToRad(fitCam.fov / 2)), tanH = tanV * fitCam.aspect;
  // (?roomview=full keeps the earlier phone view, for comparison.)
  const wide = W / H > 1, full = new URLSearchParams(location.search).get('roomview') === 'full';
  let across, bottomPts, topPts, yaw;
  if (place === room) {
    across = ROOM_FRAME.across.concat(ROOM_FRAME.bottom, wide ? ROOM_FRAME.left.concat(ROOM_FRAME.fireWide) : full ? ROOM_FRAME.left.concat(ROOM_FRAME.fireNarrow) : ROOM_FRAME.leftNarrow.concat(ROOM_FRAME.fireWide.slice(1)));
    bottomPts = ROOM_FRAME.bottom; topPts = ROOM_FRAME.top;
    // Turned a little towards the fireplace on the right wall.
    yaw = -.3;
  } else {
    const F = place.frame(wide);
    across = F.across.concat(F.bottom); bottomPts = F.bottom; topPts = F.top; yaw = F.yaw;
  }
  // For a distance, slide the focus so the furniture sits centred in the
  // clear area with the rug's front edge on its bottom; report whether it fits.
  const camRight = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  const placeAt = (d, f, pitch) => {
    fitOff.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    let fits = false;
    for (let it = 0; it < 6; it++) {
      fitCam.position.copy(f).addScaledVector(fitOff, d); fitCam.lookAt(f); fitCam.updateMatrixWorld();
      let lo = -1e9, hi = 1e9, y0 = 1e9, y1 = -1e9;
      for (const p of across) {
        fitPt.fromArray(p).project(fitCam);
        lo = Math.max(lo, L - fitPt.x);
        hi = Math.min(hi, (fitPt.y > camsBottom ? Rcams : Redge) - fitPt.x);
      }
      for (const p of bottomPts) { fitPt.fromArray(p).project(fitCam); y0 = Math.min(y0, fitPt.y); }
      for (const p of topPts) { fitPt.fromArray(p).project(fitCam); y1 = Math.max(y1, fitPt.y); }
      if (y1 < -1e8) y1 = y0;
      fits = lo <= hi && y1 - y0 <= T - B;
      // Shift the picture by the middle of the allowed range. (Moving the
      // camera right moves the picture left, and up moves it down.)
      f.addScaledVector(camRight, -(lo + hi) / 2 * .9 * d * tanH);
      f.y -= (B - y0) * .9 * d * tanV / Math.cos(pitch);
    }
    return fits;
  };
  const f = new THREE.Vector3();
  let pitch = .28, dist = 18;
  // Lower the angle a little if the camera would otherwise rise above the
  // room's ceiling.
  for (; pitch >= .1; pitch -= .03) {
    let lo = 3, hi = place === room ? 18 : 28;
    for (let i = 0; i < 16; i++) { const mid = (lo + hi) / 2; if (placeAt(mid, f.set(0, .9, -.6), pitch)) hi = mid; else lo = mid; }
    placeAt(hi, f.set(0, .9, -.6), pitch);
    dist = hi;
    if (f.y + Math.sin(pitch) * dist < CAM_BOX.y[1] - .2) break;
  }
  return {yaw, pitch, dist, focus: f};
}
const CAMERA_VIEWS = {
  room() {
    const fit = roomFrame();
    Object.assign(view.goal, {yaw: fit.yaw, pitch: fit.pitch, dist: fit.dist});
    view.goal.focus.copy(fit.focus);
    setCamMode('room');
  },
  follow() {
    Object.assign(view.goal, {dist: ready ? clamp(fitDistance(framing(false).radius), 2.6, 6) : tallScreen() ? 4.2 : 3.4, pitch: .26});
    view.goal.yaw = Math.atan2(camera.position.x - brain.pos.x, camera.position.z - brain.pos.z);
    setCamMode('follow');
  },
  food: () => lookAtSpot(bowl.position, {y: .15}),
  water: () => lookAtSpot(fountain.position, {y: .2}),
  bed: () => lookAtSpot(bed.position, {dist: 3, y: .3}),
};
for (const b of document.querySelectorAll('[data-cam]')) b.addEventListener('click', () => CAMERA_VIEWS[b.dataset.cam]());

host.addEventListener('contextmenu', e => e.preventDefault());
host.addEventListener('wheel', e => {
  e.preventDefault();
  zoomBy(Math.exp(e.deltaY * (e.ctrlKey ? .01 : .0012)));
}, {passive: false});

host.addEventListener('pointerdown', e => {
  if (e.target.closest('button, .hud, .dock, dialog')) return;
  host.setPointerCapture(e.pointerId);
  touches.set(e.pointerId, {x: e.clientX, y: e.clientY});
  if (touches.size === 2) {
    // A second finger: switch from stroking/orbiting to pinch and pan.
    gesture = null;
    host.classList.remove('stroking', 'dragging');
    const [p1, p2] = [...touches.values()];
    pinch = {d: Math.hypot(p1.x - p2.x, p1.y - p2.y), mx: (p1.x + p2.x) / 2, my: (p1.y + p2.y) / 2};
    return;
  }
  if (touches.size > 2) return;
  const r = trackPointer(e);
  const panning = e.button === 2 || e.shiftKey;
  const onCat = !panning && brain.mode !== 'play' && hitsCat();
  const onFountain = !panning && !onCat && brain.mode !== 'play' && hitsFountain();
  const onPerch = !panning && !onCat && !onFountain && brain.mode !== 'play' ? perchAt() : null;
  gesture = {x: e.clientX, y: e.clientY, lastX: e.clientX, lastY: e.clientY, moved: false, onCat, onFountain, onPerch, panning, stroke: 0, rect: r};
  if (onCat) host.classList.add('stroking');
});
host.addEventListener('pointermove', e => {
  if (e.target.closest('.hud, .dock')) return;
  if (touches.has(e.pointerId)) touches.set(e.pointerId, {x: e.clientX, y: e.clientY});
  if (pinch && touches.size >= 2) {
    const [p1, p2] = [...touches.values()];
    const d = Math.hypot(p1.x - p2.x, p1.y - p2.y), mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
    if (d > 10 && pinch.d > 10) zoomBy(pinch.d / d);
    pan(mx - pinch.mx, my - pinch.my);
    pinch = {d, mx, my};
    return;
  }
  trackPointer(e);
  if (!gesture) {
    if (e.pointerType === 'mouse') host.classList.toggle('over-cat', brain.mode !== 'play' && (hitsCat() || hitsFountain() || !!perchAt()));
    return;
  }
  const dx = e.clientX - gesture.x, dy = e.clientY - gesture.y;
  const sx = e.clientX - gesture.lastX, sy = e.clientY - gesture.lastY;
  if (Math.abs(dx) + Math.abs(dy) > 8) gesture.moved = true;
  if (gesture.onCat) {
    const step = Math.hypot(sx, sy);
    gesture.stroke += step;
    if (!pet.sleeping && step > 1) brain.strokeUntil = clockNow + .5;
    if (gesture.stroke > 240) {
      gesture.stroke = 0;
      act('pet', {stroke: true, quiet: clockNow - lastPet < 6, at: {x: e.clientX - gesture.rect.left, y: e.clientY - gesture.rect.top}});
    }
  } else if (gesture.panning) {
    pan(sx, sy);
    host.classList.add('dragging');
  } else if (brain.mode !== 'play' && gesture.moved) {
    orbit(sx, sy);
    host.classList.add('dragging');
  }
  gesture.lastX = e.clientX; gesture.lastY = e.clientY;
});
function endGesture(e) {
  touches.delete(e.pointerId);
  if (touches.size < 2) pinch = null;
  if (gesture && !gesture.moved && gesture.onFountain) {
    if (pet.sleeping) toast('Shh… wake your kitten first.');
    else act('drink');
  }
  if (gesture && !gesture.moved && gesture.onPerch) { pawAt(e.clientX - gesture.rect.left, e.clientY - gesture.rect.top); invite(gesture.onPerch); }
  if (gesture && !gesture.moved && gesture.onCat) act('pet', {at: {x: e.clientX - gesture.rect.left, y: e.clientY - gesture.rect.top}});
  gesture = null;
  host.classList.remove('stroking', 'dragging');
}
host.addEventListener('pointerup', endGesture);
host.addEventListener('pointercancel', e => { touches.delete(e.pointerId); pinch = null; gesture = null; host.classList.remove('stroking', 'dragging'); });
host.addEventListener('pointerleave', () => host.classList.remove('over-cat'));

$('.dock').addEventListener('click', e => {
  const b = e.target.closest('[data-action]');
  if (!b) return;
  const a = b.dataset.action;
  if (pet.sleeping && a !== 'sleep') { toast('Shh… wake your kitten first.'); twitchEar(); return; }
  if (a === 'feed') {
    if (brain.mode !== 'idle') { toast('One thing at a time — almost done!'); return; }
    $('#feed-dialog').showModal();
  } else act(a);
});
$('.snacks').addEventListener('click', e => {
  const b = e.target.closest('[data-snack]');
  if (b) { $('#feed-dialog').close(); act('feed', {snack: b.dataset.snack}); }
});
$('#rename').onclick = () => { $('#name-input').value = pet.name; $('#name-dialog').showModal(); $('#name-input').select(); };
$('#close-name').onclick = () => $('#name-dialog').close();
// Watch mode: the room fills the screen (real full screen where the browser
// allows it; on an iPhone the home-screen app is already edge to edge).
function setWatch(on) {
  document.body.classList.toggle('watch', on);
  $('#watch-btn').setAttribute('aria-pressed', String(on));
  $('#watch-btn span').textContent = on ? 'Exit' : 'Watch';
  try {
    if (on && !document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
    if (!on && document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  } catch {}
  // Once the layout has changed size.
  setTimeout(() => CAMERA_VIEWS.room(), 80);
}
$('#watch-btn').onclick = () => setWatch(!document.body.classList.contains('watch'));
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && document.body.classList.contains('watch')) setWatch(false); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.body.classList.contains('watch')) setWatch(false); });

// Room decor: the furniture stays put, only the look changes (decor.js).
const DECOR_SWATCHES = {classic: ['#3f472b', '#1e2536', '#5a3a22', '#e6dcc0'], thanksgiving: ['#d8cbb3', '#96a380', '#e0995e', '#b58a3c'], halloween: ['#d98b45', '#38332f', '#455d7a', '#efe5d2']};
// What to tap to invite her up, in the room she's in.
function perchHint() { return place === room ? 'the sill, chair or mantel' : 'a shelf, a cup, the tap, the vacuum or the big lamp'; }
// Rooms she can be in. The kitchen is built the first time she goes there.
const PLACES = {
  study: {name: 'The study', note: 'Fireplace, window seat and the bird', swatch: ['#9a5a34', '#5a6b38', '#e7d3b2', '#1d3f9a']},
  kitchen: {name: 'The kitchen', note: 'Shelves to climb, cups to pat, a vacuum to ride', swatch: ['#4b2e1c', '#efe3d0', '#cfd0cc', '#d8c3a5']},
};
function renderPlaces() {
  $('#place-options').innerHTML = Object.entries(PLACES).map(([id, d]) => `<button type="button" data-place="${id}" aria-pressed="${place.id === id}" style="--tint:var(--accent)"><span class="decor-swatch">${d.swatch.map(c => `<i style="background:${c}"></i>`).join('')}</span><strong>${d.name}</strong><small>${d.note}</small></button>`).join('');
}
// Take her (and the camera) to another room.
function goTo(id) {
  if (id === 'kitchen' && !kitchen) buildKitchen();
  const target = id === 'kitchen' ? kitchen : room;
  if (target === place) return;
  if (brain.mode === 'play') endPlay(true);
  if (brain.mode !== 'idle') setMode('idle');
  Object.assign(brain, {perch: null, jump: null, target: null, pounce: null});
  usePlace(target);
  brain.pos.copy(pet.sleeping ? CUSHION_SPOT : HOME);
  brain.elevation = pet.sleeping ? place.bedTop : 0;
  brain.heading = pet.sleeping ? place.layoutCache.sleepHeading ?? .6 : 0;
  setActivity(pet.sleeping ? 'sleep' : 'sit');
  toy.position.copy(TOY_HOME); toyTarget.copy(TOY_HOME);
  CAMERA_VIEWS.room();
  view.focus.copy(view.goal.focus);
  Object.assign(view, {yaw: view.goal.yaw, pitch: view.goal.pitch, dist: view.goal.dist, cut: 0, lift: 0});
  pet.place = id;
  save();
  refresh();
  if (!pet.sleeping) { express('curious', 2); setTimeout(() => glanceAt(new THREE.Vector3(rand(-3, 3), rand(1, 4), -2.5), 2), 600); }
}
$('#place-options').addEventListener('click', e => {
  const b = e.target.closest('[data-place]');
  if (!b) return;
  const id = b.dataset.place;
  $('#decor-dialog').close();
  if (place.id === id) return;
  toast(id === 'kitchen' ? 'Off to the kitchen…' : 'Back to the study…');
  host.classList.add('moving');
  setTimeout(() => { goTo(id); setTimeout(() => host.classList.remove('moving'), 120); }, 320);
});

function renderDecor() {
  $('#decor-options').innerHTML = Object.entries(DECORS).filter(([id]) => inSeason(id, DECOR_FORCE)).map(([id, d]) => `<button type="button" data-decor="${id}" aria-pressed="${room.decor === id}" style="--tint:var(--accent)"><span class="decor-swatch">${DECOR_SWATCHES[id].map(c => `<i style="background:${c}"></i>`).join('')}</span><strong>${d.name}</strong><small>${d.note}</small></button>`).join('');
}
$('#decor-btn').onclick = () => { renderPlaces(); renderDecor(); $('#decor-dialog').showModal(); };
// Day or night by hand (until the clock next turns dusk or dawn).
$('#daynight').onclick = () => {
  pet.nightOverride = {night: !night, clock: clockNight()};
  if (pet.nightOverride.night === pet.nightOverride.clock) delete pet.nightOverride;
  save();
  refresh();
  toast(night ? 'Evening falls…' : 'Good morning!');
  if (ready && !pet.sleeping) { twitchEar(0); later(.15, () => twitchEar(1)); glanceAt(new THREE.Vector3(rand(-2, 2), 1.6, -2.5), 1.6); }
};
$('#decor-options').addEventListener('click', e => {
  const b = e.target.closest('[data-decor]');
  if (!b) return;
  const id = b.dataset.decor;
  $('#decor-dialog').close();
  if (room.decor === id) return;
  // Let the menu close and the note show before the room is redressed.
  toast('Decorating…');
  setTimeout(() => {
    applyDecor(room, id);
    if (kitchen) applyKitchenDecor(kitchen, id);
    if (room.altToy) (place === room ? room.group : place.group).add(room.altToy);
    pet.decor = id;
    save();
    toast(`${DECORS[id].name}`);
  }, 120);
  if (ready && !pet.sleeping) { express('curious', 1.6); glanceAt(new THREE.Vector3(rand(-2, 2), 1.4, -2.5), 2); }
});

// Backup codes (save.js): copy one out, or bring a kitten in from one.
$('#open-backup').onclick = () => {
  $('#name-dialog').close();
  $('#backup-code').value = toCode(pet);
  $('#restore-code').value = '';
  document.querySelectorAll('.pet-name-slot').forEach(el => el.textContent = pet.name);
  $('#share-backup').hidden = !navigator.share;
  $('#backup-dialog').showModal();
};
$('#close-backup').onclick = () => $('#backup-dialog').close();
$('#copy-backup').onclick = async () => {
  const code = $('#backup-code');
  try { await navigator.clipboard.writeText(code.value); toast('Backup code copied. Keep it somewhere safe.'); }
  catch { code.focus(); code.select(); toast('Select the code and copy it.'); }
};
$('#share-backup').onclick = () => navigator.share({title: `${pet.name}'s backup code`, text: $('#backup-code').value}).catch(() => {});
$('#backup-form').onsubmit = e => {
  e.preventDefault();
  const incoming = fromCode($('#restore-code').value);
  if (!incoming) { toast('That doesn’t look like a backup code. Paste the whole code, starting with MOCHI1.'); return; }
  if (!confirm(`Bring ${incoming.name} home? This replaces ${pet.name} on this device.`)) return;
  // In place: other parts of the app hold on to this object.
  for (const key of Object.keys(pet)) delete pet[key];
  Object.assign(pet, incoming);
  save();
  refresh(); renderJournal();
  $('#backup-dialog').close();
  toast(`Welcome home, ${pet.name}`);
  if (ready && !pet.sleeping) { express('joy', 1.6); meow('mew'); }
};
$('#name-form').onsubmit = e => {
  e.preventDefault();
  const name = $('#name-input').value.trim();
  if (!name) return;
  pet.name = name.slice(0, 24);
  moment('A name to love: ' + pet.name + '.', 'i-heart');
  refresh();
  $('#name-dialog').close();
  toast('Hello, ' + pet.name);
  if (ready && !pet.sleeping) { express('joy', 1.6); hop(); meow('mew'); say(`${pet.name}? I love it!`, 3600, true); }
};
// Sound panel: an on/off switch and Mochi's volume.
function toggleSoundPanel(open = $('#sound-panel').hidden) {
  $('#sound-panel').hidden = !open;
  $('#sound').setAttribute('aria-expanded', String(open));
}
$('#sound').onclick = () => toggleSoundPanel();
document.addEventListener('pointerdown', e => { if (!e.target.closest('.sound-wrap')) toggleSoundPanel(false); });
$('#sound-on').onchange = e => {
  pet.sound = e.target.checked;
  sounds.setEnabled(pet.sound);
  refresh(); save();
  if (pet.sound) { meow('mew'); twitchEar(0); twitchEar(1); }
};
for (const [id, kind, key] of [['#vol-cat', 'cat', 'catVolume']]) {
  $(id).oninput = e => { pet[key] = +e.target.value; sounds.setVolume(kind, pet[key]); };
  $(id).onchange = () => { save(); if (kind === 'cat' && pet.sound) meow('mew'); };
}
$('.tabs').onclick = e => {
  const b = e.target.closest('[data-tab]');
  if (!b) return;
  for (const x of $('.tabs').querySelectorAll('button')) { x.classList.toggle('active', x === b); x.setAttribute('aria-selected', String(x === b)); }
  $('#journal').hidden = b.dataset.tab !== 'journal';
  $('#guide').hidden = b.dataset.tab !== 'guide';
};
for (const d of document.querySelectorAll('dialog')) {
  d.addEventListener('click', e => {
    if (e.target !== d) return;
    const r = d.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close();
  });
}

let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  advance(pet); refresh(); save();
  if (document.hidden) hiddenAt = Date.now();
  else if (Date.now() - hiddenAt > 45000) greet();
});
window.addEventListener('pagehide', save);
setInterval(() => { advance(pet); refresh(); save(); }, 15000);
refresh();
renderJournal();

// Build label: version.json is written by the site's deploy workflow (build
// number = commits on the branch, plus the commit itself). Preview builds
// show it at the top so reviewers can match what they see to a review pack.
fetch('./version.json', {cache: 'no-store'}).then(r => r.ok ? r.json() : null).then(v => {
  if (!v) return;
  const text = `${v.channel === 'preview' ? 'Preview' : 'Version'} build ${v.build} · ${v.commit}`;
  $('#build-label').textContent = text;
  if (v.channel === 'preview') { $('.topbar').classList.add('has-build'); $('#build-chip').innerHTML = `Preview<span class="long"> · build</span> ${v.build}`; $('#build-chip').hidden = false; $('#review-link').hidden = false; }
}).catch(() => {});

// ---------------------------------------------------------------------------
// Camera & frame loop
// ---------------------------------------------------------------------------
const camOffset = new THREE.Vector3();
// The space Mochi takes up right now (head, hips, tail, paws), and the toy
// too while playing, as a centre and radius.
const frameBox = new THREE.Box3(), framePt = new THREE.Vector3(), frameOut = {center: new THREE.Vector3(), radius: 1};
function framing(withToy) {
  frameBox.makeEmpty();
  frameBox.expandByPoint(cat.headTop(framePt));
  for (const b of ['hips', 'tail4', 'tail7', 'wristR', 'wristL', 'hockR', 'hockL']) frameBox.expandByPoint(cat.bones[b].getWorldPosition(framePt));
  if (withToy) frameBox.expandByPoint(toy.position);
  frameBox.getCenter(frameOut.center);
  frameOut.center.y = clamp(frameOut.center.y, .3, 1);
  frameOut.radius = frameBox.getSize(framePt).length() / 2 + .15;
  return frameOut;
}
// Camera distance that fits a sphere of this radius on screen.
function fitDistance(radius) {
  const half = THREE.MathUtils.degToRad(camera.fov / 2), halfH = Math.atan(Math.tan(half) * camera.aspect);
  return radius / Math.sin(Math.min(half, halfH)) * 1.05;
}
function resize() {
  const w = host.clientWidth, h = host.clientHeight;
  camera.aspect = w / h;
  camera.fov = w / h < .9 ? 46 : 40;
  camera.updateProjectionMatrix();
  renderer?.setSize(w, h);
  if (view.mode === 'room') CAMERA_VIEWS.room();
}
new ResizeObserver(resize).observe(host);
resize();
CAMERA_VIEWS.room();
view.focus.copy(view.goal.focus);
Object.assign(view, {yaw: view.goal.yaw, pitch: view.goal.pitch, dist: view.goal.dist, cut: 0, lift: 0});

// ---------------------------------------------------------------------------
// The opening screen's scene. She sits facing the camera, close up: that is
// the film's last frame exactly (sources/title/film-last-frame.png), so the
// film can fade into the live room. The camera then eases back to leave room
// for the logo, and drifts a little. Asleep, she is left asleep in her bed.
// ---------------------------------------------------------------------------
const TITLE_CLOSE = {y: .55, yaw: .1, pitch: .06, dist: 2.3}, TITLE_WIDE = {y: .86, yaw: .1, pitch: .1, dist: 3.6};
function titleReveal() {
  const asleep = pet.sleeping, base = brain.elevation || 0;
  if (!asleep) {
    if (place === room) brain.pos.set(0, 0, .5);
    brain.heading = 0; brain.target = null;
    setActivity('sit');
  }
  const h = brain.heading;
  const to = asleep ? {y: .75, yaw: h + .5, pitch: .34, dist: 3.6} : {...TITLE_WIDE, yaw: h + TITLE_WIDE.yaw};
  // After the film: the film's last frame. Otherwise most of the way back
  // already, so the logo (up since loading) never sits on her face.
  const from = asleep ? {...to, y: .6, dist: 3} : title.film ? {...TITLE_CLOSE, yaw: h + TITLE_CLOSE.yaw} : {...to, y: lerp(TITLE_CLOSE.y, to.y, .7), dist: lerp(TITLE_CLOSE.dist, to.dist, .7)};
  setCamMode('title');
  view.focus.set(brain.pos.x, base + from.y, brain.pos.z);
  Object.assign(view, {yaw: from.yaw, pitch: from.pitch, dist: from.dist, cut: 0, lift: 0, glideUntil: Infinity});
  // (After the film the close-up holds a moment, so the hand-over is still.)
  titleView = {from, to, base, t0: clockNow + (title.film ? .7 : .15), next: clockNow + 3.5};
  titleCamera();
  if (!asleep) loadTitleToys();
}
function titleCamera() {
  const v = titleView, s = clockNow - v.t0, g = view.goal, p = s < 0 ? v.from : v.to, drift = Math.max(0, s) * motion;
  g.focus.set(brain.pos.x, v.base + p.y, brain.pos.z);
  g.yaw = p.yaw + Math.sin(drift * .3) * .1;
  g.pitch = p.pitch;
  g.dist = p.dist - (1 - Math.cos(drift * .19)) * .12;
}
function titleLife(t) {
  const v = titleView;
  if (pet.sleeping) { if (t > brain.nextZ) { brain.nextZ = t + rand(2.2, 3.4); burst('z', 1); } return; }
  if (t < v.next) return;
  v.next = t + rand(3.2, 5.5);
  const toys = (titleToys || []).filter(o => t > o.userData.born + .6), yarn = toys.find(o => o.userData.rolls);
  const choice = pick(['blink', 'blink', 'tilt', toys.length ? 'toy' : 'tilt', yarn ? 'roll' : 'blink']);
  if (choice === 'blink') { glanceAt(camera.position, 2.2); slowBlink(); }
  if (choice === 'tilt') { express('curious', 1.8); twitchEar(); }
  if (choice === 'toy') glanceAt(pick(toys).position, 1.7);
  // The yarn ball rolls a little way and back; her eyes go with it.
  if (choice === 'roll') { yarn.userData.roll = t; brain.glance = yarn.position; brain.glanceUntil = t + 2.8; v.next = t + 4; }
}
function titleTap(e) {
  setPointer(e);
  if (!hitsCat()) return;
  if (pet.sleeping) { twitchEar(); return; }
  express('joy', 1.4); burst('heart', 3); meow('chirp', 'reply');
  brain.tailUpUntil = clockNow + 2;
}
// A few of her toys on the floor beside her, on the opening screen only
// (Meshy models, see CREDITS.md; they are put away when the game starts).
// at: [to her right, in front of her].
const TITLE_TOYS = [
  {file: 'yarn-ball', size: .3, at: [-.43, .22], turn: 2.4, rolls: true},
  {file: 'felt-mouse', size: .22, at: [.42, .34], turn: -2.2},
  {file: 'fabric-fish', size: .26, at: [.43, -.5], turn: .9},
];
async function loadTitleToys() {
  titleToys = [];
  const loader = new GLTFLoader(), h = brain.heading, cos = Math.cos(h), sin = Math.sin(h), y = brain.elevation || 0;
  // (The toys are packed small; this unpacks them. Fetched only here.)
  try { loader.setMeshoptDecoder((await import('./vendor/meshopt_decoder.module.js')).MeshoptDecoder); } catch { return; }
  if (!titleView) return;
  TITLE_TOYS.forEach((d, i) => loader.load(`./assets/models/${d.file}.glb`, g => {
    if (!titleView) return;
    const o = g.scene, box = new THREE.Box3().setFromObject(o), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    const k = d.size / Math.max(size.x, size.y, size.z), holder = new THREE.Group();
    o.scale.setScalar(k); o.position.copy(c).multiplyScalar(-k);
    o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    holder.add(o);
    holder.position.set(brain.pos.x + d.at[0] * cos + d.at[1] * sin, y + size.y * k / 2 + .012, brain.pos.z - d.at[0] * sin + d.at[1] * cos);
    holder.rotation.y = h + d.turn;
    holder.scale.setScalar(.001);
    holder.userData = {born: Math.max(clockNow, titleView.t0) + .35 + i * .25, home: holder.position.clone(), radius: size.y * k / 2, rolls: !!d.rolls, roll: null};
    scene.add(holder);
    titleToys.push(holder);
  }, undefined, () => {}));
}
function titleToyLife(t) {
  for (const o of titleToys || []) {
    const u = o.userData, p = clamp((t - u.born) / .55, 0, 1);
    // (They pop in with a little overshoot.)
    o.scale.setScalar(Math.max(.001, 1 + 2.7 * (p - 1) ** 3 + 1.7 * (p - 1) ** 2));
    if (u.roll != null) {
      const q = clamp((t - u.roll) / 2.8, 0, 1), dx = Math.sin(q * Math.PI) * .22 * motion;
      o.position.x = u.home.x + dx;
      o.rotation.z = -dx / u.radius;
      if (q >= 1) u.roll = null;
    }
  }
}
// Play was pressed and the screen is covered: back to the game's layout,
// and the camera sweeps out from her to the whole room.
function titleEnter() {
  titleView = null;
  for (const o of titleToys || []) {
    scene.remove(o);
    o.traverse(m => { if (m.isMesh) { m.geometry.dispose(); for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap']) m.material[k]?.dispose(); m.material.dispose(); } });
  }
  titleToys = null;
  if (titleDay) { forcedNight = titleDay.was; titleDay = null; refresh(); }
  brain.nextIdle = clockNow + 7; brain.nextShow = Math.max(brain.nextShow, clockNow + 12); brain.nextBird = Math.max(brain.nextBird, clockNow + 14);
  // (Once the layout has changed size.)
  setTimeout(() => { view.glideUntil = clockNow + 3; CAMERA_VIEWS.room(); }, 80);
}

function updateCamera(dt) {
  const g = view.goal, following = view.mode === 'follow' && ready;
  let distGoal = g.dist;
  if (following) {
    // Keep Mochi (and, while playing, the toy) comfortably in frame. The
    // camera only re-centres once she has moved a little way off, eases
    // there gently, and backs off when cat and toy are far apart. Turning
    // and zoom stay yours: this never changes the angle, and your zoom is
    // the closest it will go.
    const playing = brain.mode === 'play';
    const frame = framing(playing);
    if (frame.center.distanceTo(g.focus) > (playing ? .2 : .3)) g.focus.copy(frame.center);
    clampGoal();
    // Your own zoom wins for a while after you pinch or scroll.
    if (clockNow - view.zoomedAt > 8) distGoal = Math.max(g.dist, fitDistance(frame.radius));
  }
  // (A glide: the opening screen's slow camera, and its sweep out to the room.)
  const glide = clockNow < (view.glideUntil || 0);
  const r = glide ? 1.5 : following ? 2.2 : 5, turn = glide ? 1.5 : 8;
  view.focus.x = damp(view.focus.x, g.focus.x, r, dt);
  view.focus.y = damp(view.focus.y, g.focus.y, r, dt);
  view.focus.z = damp(view.focus.z, g.focus.z, r, dt);
  view.yaw = damp(view.yaw, g.yaw, turn, dt);
  view.pitch = damp(view.pitch, g.pitch, turn, dt);
  view.dist = damp(view.dist, distGoal, glide ? 1.5 : following && distGoal > g.dist ? 1.6 : 7, dt);
  camOffset.set(Math.sin(view.yaw) * Math.cos(view.pitch), Math.sin(view.pitch), Math.cos(view.yaw) * Math.cos(view.pitch));
  // Spring arm: if the camera would leave the room, shorten the arm instead.
  let d = view.dist;
  for (const [k, [lo, hi]] of Object.entries(CAM_BOX)) {
    const o = camOffset[k], f = view.focus[k];
    if (o > 1e-4 && f + o * d > hi) d = Math.min(d, (hi - f) / o);
    if (o < -1e-4 && f + o * d < lo) d = Math.min(d, (lo - f) / o);
  }
  // Keep furniture from coming between the camera and what it looks at.
  // Something tall in the way: the arm stops just in front of it. Something
  // low (the island, a stool, the chair): the camera rises to see over it.
  // Both ease in and out, so a turn past a piece of furniture glides rather
  // than jumping.
  const fx = view.focus.x, fz = view.focus.z, fy = view.focus.y, ox = camOffset.x, oz = camOffset.z, oy = camOffset.y, hz = Math.hypot(ox, oz);
  const dFree = d;
  let lift = 0;
  const blocked = (tHit, h) => {
    if (!(tHit > 0 && tHit < d) || fy + oy * tHit >= h) return;
    // Rise so the line of sight clears its top (at that distance along),
    // if that's only a little; otherwise come in front of it.
    const s = tHit / d, need = h < 3.2 && tHit > d * .25 ? fy + (h + .15 - fy) / s - (fy + oy * d) : Infinity;
    if (need < 1.6) lift = Math.max(lift, need); else d = Math.min(d, tHit - .15);
  };
  if (hz > 1e-4) {
    for (const [cx, cz, r, h] of CAM_SOLIDS) {
      const px = fx - cx, pz = fz - cz;
      if (px * px + pz * pz < r * r) continue; // looking at the piece itself
      const a2 = ox * ox + oz * oz, b2 = 2 * (px * ox + pz * oz), c2 = px * px + pz * pz - r * r, disc = b2 * b2 - 4 * a2 * c2;
      if (disc < 0) continue;
      blocked((-b2 - Math.sqrt(disc)) / (2 * a2), h);
    }
    // Worktops (the island, the counter): boxes, so the camera never ends
    // up looking at a close-up of the stone from inside one.
    for (const [x0, x1, z0, z1, top] of CAM_BLOCKS) {
      if (fx > x0 && fx < x1 && fz > z0 && fz < z1) continue;
      let t0 = 0, t1 = d;
      for (const [o, f, lo, hi] of [[ox, fx, x0, x1], [oz, fz, z0, z1]]) {
        if (Math.abs(o) < 1e-6) { if (f < lo || f > hi) { t0 = 1; t1 = 0; } continue; }
        const a = (lo - f) / o, b = (hi - f) / o;
        t0 = Math.max(t0, Math.min(a, b)); t1 = Math.min(t1, Math.max(a, b));
      }
      if (t0 < t1) blocked(t0, top - .2);
    }
  }
  // (Only the dodging eases; zoom and turning follow you as before.)
  const cut = dFree - d;
  view.cut = damp(view.cut || 0, cut, cut > (view.cut || 0) ? 12 : 3, dt);
  view.lift = damp(view.lift || 0, Math.min(lift, 4), lift > (view.lift || 0) ? 8 : 2.5, dt);
  camera.position.copy(view.focus).addScaledVector(camOffset, Math.max(.6, dFree - view.cut));
  camera.position.y += view.lift;
  // Never inside a worktop: over one, the camera stays just above it.
  const cp = camera.position;
  for (const [x0, x1, z0, z1, top] of CAM_BLOCKS) if (cp.x > x0 && cp.x < x1 && cp.z > z0 && cp.z < z1 && cp.y < top) cp.y = top;
  camera.lookAt(view.focus);
}

function updateRoom(dt, t) {
  // (The clock turning dusk or dawn while you watch.)
  if (Math.floor(t / 5) !== Math.floor((t - dt) / 5) && isNight() !== night) refresh();
  sun.intensity = damp(sun.intensity, night ? .05 : 3.2, 3, dt);
  ambient.intensity = damp(ambient.intensity, night ? .35 : 1.5, 3, dt);
  rim.intensity = damp(rim.intensity, night ? 0 : 1.8, 3, dt);
  moon.intensity = damp(moon.intensity, night ? .45 : 0, 3, dt);
  fill.intensity = damp(fill.intensity, night ? .7 : 0, 3, dt);
  const atFountain = brain.activity === 'drink' && !brain.eatAt;
  const other = place === room ? kitchen : room;
  if (other) { other.group.visible = doorwayInView(); if (other.group.visible) cullThroughDoor(other); }
  if (place === room) { room.update(dt, t, night, {drinking: atFountain, camera}); if (kitchen?.group.visible) kitchen.update(dt, t, night, {camera, away: true}); }
  else {
    place.update(dt, t, night, {camera, lamp: room.lamp, cat: brain});
    if (room.group.visible) room.update(dt, t, night, {drinking: atFountain, camera, away: true}); else room.updateFountain(dt, t, atFountain);
  }

  // Feeding: kibble disappears bite by bite.
  if (brain.activity === 'eat' && !brain.eatAt) {
    const p = clamp((t - brain.actStart - .5) / 3, 0, 1);
    kibbles.forEach((k, i) => k.visible = i >= Math.floor(p * kibbles.length));
  }
  // Brushing: slow strokes along the back.
  const brushing = brain.mode === 'brush';
  brushTool.scale.setScalar(damp(brushTool.scale.x, brushing ? 1.2 : 0, 8, dt));
  if (brushTool.scale.x > .01) {
    const p = ((t - brain.modeStart) / 1.1) % 1, s = Math.sin(p * Math.PI);
    brushRig.position.set(.2, .7 + s * .1, lerp(.3, -.5, p));
    brushRig.rotation.set(0, Math.PI / 2, .35);
    if (Math.random() < dt * 2) burst('sparkle', 1);
  }
}

let last = performance.now();
function frame(now) {
  if (!renderer) return;
  const dt = Math.min(.1, (now - last) / 1000);
  last = now;
  clockNow = now / 1000;
  const t = clockNow;
  runTimers(t);
  if (brain.mode === 'brush' && t > brain.modeUntil) finishMode();
  // A meal or a drink that somehow never finishes mustn't lock the buttons.
  if ((brain.mode === 'feed' || brain.mode === 'drink') && t - brain.modeStart > 30) { finishMode(); setActivity('sit'); }
  // Her own catnaps restore a little energy (about 1 a minute).
  if (ready && brain.activity === 'catnap') pet.energy = Math.min(100, pet.energy + dt / 60);
  updatePlay(dt, t);
  if (ready) updateCat(dt, t);
  if (titleView) { titleCamera(); titleToyLife(t); }
  updateCamera(dt);
  updateRoom(dt, t);
  if (ready) {
    idleLife(t);
    placeSpeech();
  }
  if (!skipDraw) renderer.render(scene, camera);
}
let skipDraw = false; // (debug stepping can skip drawing the in-between frames)

// Handy for visual QA: open with ?debug to drive the kitten from the console.
// With ?debug&frames the app doesn't run by itself: kitten.step(dt, n)
// advances it n frames of dt seconds each, so the review pack can record
// clips that play at true speed however slowly its renderer draws.
const params = new URLSearchParams(location.search), manual = params.has('debug') && params.has('frames');
let virtualNow = performance.now();
if (params.has('debug')) window.kitten = {brain, cat, express, ridePendant, dash, dogLife, nightLife, nightZoomies, shadowPounce, dockHunt, isNight, get night() { return night; }, setNight(v) { forcedNight = v; refresh(); }, act, yawn, slowBlink, meow, hop, view, setActivity, walkTo, jumpTo, jumpDown, startSolo, knockBook, knockVase, tapCups, knockItem: knockThing, stroll, sinkSit, inSink, hopFrom, stealSalmon, drinkFaucet, vacuumRide, vacuumAttack, invite, refresh, goTo, get place() { return place; }, get kitchen() { return kitchen; }, room, get PERCHES() { return PERCHES; }, get SUN_SPOT() { return SUN_SPOT; }, renderer, orbit, pan, zoomBy, toy, toyTarget, sounds, pet, say, CAMERA_VIEWS, camera,
  step(dt = 1 / 24, n = 1, drawAll = true) { for (let i = 0; i < n; i++) { virtualNow += dt * 1000; skipDraw = !drawAll && i < n - 1; frame(virtualNow); } skipDraw = false; }};

renderer?.setAnimationLoop(now => { if (manual) return; if (!document.hidden) frame(now); else last = now; });
// In manual mode, draw one frame so the page isn't blank before stepping.
if (manual) frame(virtualNow);
