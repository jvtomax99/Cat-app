// The living room on its own (phase 21, step 1), for looking at before it
// is joined to the kitchen. Not linked from the app. Drag to turn, wheel or
// pinch to zoom; Day and Night; ?night=1 opens at night.
// For the stills (tools/qa/living.mjs):
//   check.look({focus: [x, y, z], yaw, pitch, dist})   put the camera there and draw
//   check.night(on)       day or night, settled at once
//   check.info()          draw calls and triangles of one frame: all of it,
//                         the room without the outdoors, the outdoors
//   check.routes(n)       n random walks across the floor: how many found a way
import * as THREE from 'three';
import {Room} from './room.js';
import {Kitchen} from './kitchen.js';
import {LivingRoom, L} from './living.js';

const Q = new URLSearchParams(location.search);
const renderer = new THREE.WebGLRenderer({antialias: true, preserveDrawingBuffer: true});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#efe6d6');
const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, .1, 80);

// The app's lights (app.js), with the sun's shadow laid over this room.
const ambient = new THREE.HemisphereLight(0xfff0dc, 0x8a6446, 1.5);
const sun = new THREE.DirectionalLight(0xffdcae, 3.2);
const mid = new THREE.Vector3((L.sea + L.south) / 2, 0, (L.join + L.end) / 2);
sun.position.copy(mid).add(new THREE.Vector3(-6, 12, 8)); sun.target.position.copy(mid);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, {left: -12, right: 12, top: 12, bottom: -12, far: 40});
sun.shadow.bias = -.0005; sun.shadow.normalBias = .02;
const rim = new THREE.DirectionalLight(0xffd29a, 1.8); rim.position.set(-3, 4, -5);
const moon = new THREE.DirectionalLight(0x9fb4ff, 0); moon.position.set(-3, 4, -4);
const fill = new THREE.DirectionalLight(0xffcf9a, 0); fill.position.set(2, 3, 6);
scene.add(ambient, sun, sun.target, rim, moon, fill);

// The study and the kitchen are built only to lend what the rooms share:
// materials and reflections, the lamp's light, her fountain and her tent.
const room = new Room(scene, renderer);
room.group.visible = false;
scene.add(room.lamp);
const kitchen = new Kitchen(scene, room);
const living = new LivingRoom(scene, room);
living.adopt({tent: kitchen.bed, fountain: room.fountain});
living.activate(room.lamp);
living.group.visible = true;

let night = Q.get('night') === '1', t = 0;
const view = {focus: new THREE.Vector3(2.4, 2.2, 7.4), yaw: .62, pitch: .2, dist: 27};
function place() {
  const c = Math.cos(view.pitch);
  camera.position.set(view.focus.x + Math.sin(view.yaw) * c * view.dist, view.focus.y + Math.sin(view.pitch) * view.dist, view.focus.z - Math.cos(view.yaw) * c * view.dist);
  camera.lookAt(view.focus);
}
function tick(dt) {
  t += dt;
  const d = (v, to) => THREE.MathUtils.damp(v, to, 3, dt);
  sun.intensity = d(sun.intensity, night ? .05 : 3.2); ambient.intensity = d(ambient.intensity, night ? .35 : 1.5);
  rim.intensity = d(rim.intensity, night ? 0 : 1.8); moon.intensity = d(moon.intensity, night ? .45 : 0); fill.intensity = d(fill.intensity, night ? .7 : 0);
  place();
  living.update(dt, t, night, {camera, lamp: room.lamp});
  room.updateFountain(dt, t, false);
}
const draw = () => renderer.render(scene, camera);
const stats = document.querySelector('#stats');
function info() {
  const count = () => { draw(); return {calls: renderer.info.render.calls, triangles: renderer.info.render.triangles}; };
  const all = count(), out = living.terraces.map(x => x.group).concat(living.paving ? [] : []);
  for (const g of out) g.visible = false;
  const inside = count();
  for (const g of out) g.visible = true;
  return {all, inside, outdoors: {calls: all.calls - inside.calls, triangles: all.triangles - inside.triangles}, textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries};
}
window.check = {
  living, room, kitchen, view, scene, camera, renderer,
  look(v) { if (v.focus) view.focus.set(...v.focus); for (const k of ['yaw', 'pitch', 'dist']) if (v[k] != null) view[k] = v[k]; tick(1 / 60); draw(); },
  night(on) { night = !!on; for (let i = 0; i < 240; i++) tick(1 / 20); draw(); },
  step(n = 1, dt = 1 / 30) { for (let i = 0; i < n; i++) tick(dt); draw(); },
  info,
  routes(n = 400) {
    let found = 0, worst = 0;
    for (let i = 0; i < n; i++) {
      const a = living.randomFloorPoint(), b = living.randomFloorPoint(), path = living.route(a, b);
      let len = 0, p = a; for (const q of path) { len += p.distanceTo(q); p = q; }
      if (path.length && path[path.length - 1].distanceTo(b) < .01) found++;
      worst = Math.max(worst, len / Math.max(.5, a.distanceTo(b)));
    }
    return {tried: n, found, longestDetour: +worst.toFixed(2)};
  },
};

// Looking around: drag turns, wheel and pinch zoom.
const el = renderer.domElement, pts = new Map();
let pinch = 0;
el.addEventListener('pointerdown', e => { pts.set(e.pointerId, e); el.setPointerCapture(e.pointerId); });
el.addEventListener('pointerup', e => { pts.delete(e.pointerId); pinch = 0; });
el.addEventListener('pointercancel', e => { pts.delete(e.pointerId); pinch = 0; });
el.addEventListener('pointermove', e => {
  if (!pts.has(e.pointerId)) return;
  const was = pts.get(e.pointerId); pts.set(e.pointerId, e);
  if (pts.size === 1) { view.yaw += (e.clientX - was.clientX) * .006; view.pitch = Math.min(1.25, Math.max(.03, view.pitch + (e.clientY - was.clientY) * .005)); }
  else if (pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); if (pinch) view.dist = Math.min(40, Math.max(3, view.dist * pinch / d)); pinch = d; }
});
el.addEventListener('wheel', e => { e.preventDefault(); view.dist = Math.min(40, Math.max(3, view.dist * Math.exp(e.deltaY * .001))); }, {passive: false});
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
document.querySelector('#day').onclick = () => { night = false; };
document.querySelector('#night').onclick = () => { night = true; };

if (night) check.night(true);
window.ready = true;
// (?frames: nothing moves by itself; the stills script steps it.)
if (!Q.has('frames')) {
  let last = performance.now(), n = 0;
  renderer.setAnimationLoop(now => {
    tick(Math.min(.05, (now - last) / 1000)); last = now; draw();
    if (!(n++ % 30)) stats.textContent = `${renderer.info.render.calls} draw calls · ${Math.round(renderer.info.render.triangles / 1000)}k triangles`;
  });
} else { stats.textContent = ''; check.step(2); }
