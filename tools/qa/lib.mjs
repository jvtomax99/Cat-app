// Shared helpers for the QA scripts: serve dist/, open the app in headless
// Chromium (software WebGL), wait for Mochi, and step time by hand.
//   import {open} from './lib.mjs';
//   const {page, step, close} = await open({seed: 7, kitchen: true});
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import url from 'node:url';

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '../../dist');
const TYPES = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.webmanifest': 'application/manifest+json', '.mp4': 'video/mp4', '.webp': 'image/webp'};

async function chromium() {
  try { return (await import('playwright')).chromium; } catch {}
  return (await import('/opt/node22/lib/node_modules/playwright/index.mjs')).chromium;
}

export async function open({seed = null, kitchen = false, night = 0, flags = '', width = 420, height = 760, quiet = true, before = null, scale = 1} = {}) {
  const srv = http.createServer((q, r) => {
    let f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
    if (f.endsWith('/')) f += 'index.html';
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
    r.writeHead(200, {'content-type': TYPES[path.extname(f)] || 'application/octet-stream'});
    fs.createReadStream(f).pipe(r);
  }).listen(0);
  const port = srv.address().port;
  const browser = await (await chromium()).launch({args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
  const page = await browser.newPage({viewport: {width, height}, deviceScaleFactor: scale});
  page.setDefaultTimeout(3600000);
  page.on('pageerror', e => console.log('pageerror', e.message));
  // Same random choices every run, so before/after numbers are comparable.
  if (seed !== null) await page.addInitScript(s => { let x; (window.__seed = s => { x = s; })(s); Math.random = () => (x = (x * 16807) % 2147483647) / 2147483647; }, seed);
  // The app's setTimeout calls run on real time, but we step virtual time:
  // once stepping starts, timeouts wait for virtual time too, so a slow or
  // busy machine doesn't change what she does.
  await page.addInitScript(() => {
    // (The clock starts the same every run, not at however long loading took.)
    performance.now = () => 1000; Date.now = () => 1.8e12 + vt.now;
    const vt = window.__vt = {on: false, now: 0, id: 1e6, q: []}, rs = setTimeout, rc = clearTimeout;
    window.setTimeout = (fn, ms = 0, ...a) => { if (!vt.on) return rs(fn, ms, ...a); vt.q.push({id: ++vt.id, at: vt.now + (+ms || 0), fn, a}); return vt.id; };
    window.clearTimeout = id => { const i = vt.q.findIndex(x => x.id === id); if (i >= 0) vt.q.splice(i, 1); else rc(id); };
    vt.tick = ms => {
      vt.now += ms;
      for (;;) {
        let j = -1; vt.q.forEach((x, i) => { if (x.at <= vt.now && (j < 0 || x.at < vt.q[j].at)) j = i; });
        if (j < 0) break;
        const [x] = vt.q.splice(j, 1); if (typeof x.fn === 'function') x.fn(...x.a);
      }
    };
  });
  // (before(page): anything to set up before the app loads, a save for one.)
  if (before) await before(page);
  await page.goto(`http://127.0.0.1:${port}/index.html?debug&frames&night=${night}${flags}`);
  await page.waitForFunction(() => window.kitten && kitten.cat.ready && kitten.cat.motion && kitten.kitchen, null, {timeout: 900000});
  // (Let the start-up timeouts finish on real time, then start the random
  // choices from the seed again: loading order varies from run to run.)
  await page.waitForTimeout(3000);
  if (seed !== null) await page.evaluate(s => __seed(s), seed);
  await page.evaluate(([k, quiet]) => {
    if (k) kitten.goTo('kitchen');
    if (quiet) Object.assign(kitten.brain, {nextIdle: 1e9, nextShow: 1e9, nextBird: 1e9, nextVacuum: 1e9, vacInit: true});
    document.querySelectorAll('.hud, .dock, .scene-hint, #speech').forEach(e => e.style.visibility = 'hidden');
  }, [kitchen, quiet]);
  // Advance n frames of 1/20 s (drawing only the last one).
  // (One app frame at a time, so timeouts run between frames; only the last is drawn.)
  const step = (n = 1, dt = 1 / 20) => page.evaluate(([n, dt]) => {
    const r = kitten.renderer, render = r.render; __vt.on = true;
    try { for (let i = 0; i < n; i++) { r.render = i === n - 1 ? render : () => {}; kitten.step(dt, 1); __vt.tick(dt * 1000); } } finally { r.render = render; }
  }, [n, dt]);
  // Put the camera somewhere and draw: {focus: [x,y,z], yaw, pitch, dist}.
  const look = v => page.evaluate(v => { const w = kitten.view; w.mode = 'free'; for (const o of [w, w.goal]) { o.focus.set(...v.focus); Object.assign(o, {yaw: v.yaw, pitch: v.pitch, dist: v.dist}); } w.cut = 0; w.lift = 0; kitten.step(1 / 60, 1, true); }, v);
  const close = async () => { await browser.close(); srv.close(); };
  return {page, step, look, close};
}
