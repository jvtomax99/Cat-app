// Stills of the living room on its own (dist/living-check.html), day and
// night, from several places; then how heavy it is to draw (draw calls and
// triangles) and whether she could find her way across its floor.
//   node tools/qa/living.mjs      (OUT, W, H, DPR, NIGHTS="0 1", ONLY="wide,sofa")
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import url from 'node:url';
const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '../../dist');
const TYPES = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml'};
const OUT = process.env.OUT || 'qa-out/living', W = +(process.env.W || 1280), H = +(process.env.H || 800), DPR = +(process.env.DPR || 1);
fs.mkdirSync(OUT, {recursive: true});
// (The camera stands back from `focus`: yaw 0 on the kitchen side looking
// down the room, a positive yaw toward the fire wall, negative toward the sea.
// All inside the room or on its open kitchen side, as the app's camera will be.)
const CAMS = {
  wide: {focus: [2.0, 2.2, 7.6], yaw: .12, pitch: .16, dist: 24},
  fromFire: {focus: [0, 2.0, 7.4], yaw: .95, pitch: .2, dist: 11.5},
  toFire: {focus: [7.5, 2.4, 8.4], yaw: -1.0, pitch: .12, dist: 13},
  toSea: {focus: [-2.0, 2.4, 7.2], yaw: 1.35, pitch: .1, dist: 11.5},
  corner: {focus: [-2.0, 2.4, 10.0], yaw: .7, pitch: .12, dist: 12},
  sofa: {focus: [-.6, 1.1, 6.6], yaw: 1.15, pitch: .26, dist: 8.5},
  table: {focus: [2.2, .8, 7.4], yaw: .75, pitch: .36, dist: 7.5},
  chairs: {focus: [3.8, 1.0, 11.2], yaw: .15, pitch: .28, dist: 7.5},
  sling: {focus: [4.2, 1.0, 3.3], yaw: -.5, pitch: .24, dist: 6.5},
  sideboard: {focus: [9.2, 3.2, 11.6], yaw: -1.3, pitch: .08, dist: 10.5},
  fire: {focus: [9.3, 1.5, 7.05], yaw: -1.4, pitch: .12, dist: 7.5},
  throw: {focus: [-.6, 1.0, 4.4], yaw: .35, pitch: .3, dist: 5.5},
  tent: {focus: [-3.9, 1.0, 10.6], yaw: .55, pitch: .22, dist: 8},
  phone: {focus: [2.0, 2.4, 7.6], yaw: .1, pitch: .2, dist: 38, w: 390, h: 844},
  above: {focus: [2.0, 0, 7.0], yaw: .0001, pitch: 1.25, dist: 30},
};
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const srv = http.createServer((q, r) => {
  let f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, {'content-type': TYPES[path.extname(f)] || 'application/octet-stream'});
  fs.createReadStream(f).pipe(r);
}).listen(0);
let chromium;
try { chromium = (await import('playwright')).chromium; } catch { chromium = (await import('/opt/node22/lib/node_modules/playwright/index.mjs')).chromium; }
const browser = await chromium.launch({args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
let errors = 0;
for (const night of (process.env.NIGHTS || '0 1').split(' ')) {
  const page = await browser.newPage({viewport: {width: W, height: H}, deviceScaleFactor: DPR});
  page.setDefaultTimeout(600000);
  page.on('pageerror', e => { errors++; console.log('pageerror', e.message); });
  page.on('console', m => { if (m.type() === 'error') console.log('console', m.text()); });
  await page.goto(`http://127.0.0.1:${srv.address().port}/living-check.html?frames&night=${night}`);
  await page.waitForFunction(() => window.ready);
  await page.evaluate(n => check.night(n), +night);
  for (const [name, v] of Object.entries(CAMS)) {
    if (only && !only.includes(name)) continue;
    await page.setViewportSize({width: v.w || W, height: v.h || H});
    await page.evaluate(v => { dispatchEvent(new Event('resize')); check.look(v); }, v);
    const f = `${OUT}/${+night ? 'night' : 'day'}-${name}.png`;
    await page.locator('canvas').first().screenshot({path: f}); console.log(f);
  }
  if (!+night || (process.env.NIGHTS || '').trim() === '1') {
    await page.setViewportSize({width: W, height: H});
    const info = await page.evaluate(v => { dispatchEvent(new Event('resize')); check.look(v); return check.info(); }, CAMS.wide);
    console.log('one frame, the wide view:', JSON.stringify(info));
    const grid = await page.evaluate(() => check.clampGrid());
    console.log(`${grid.bad || grid.spotsBlocked.length ? 'FAIL' : 'PASS'}: spots put on the floor that ended inside furniture: ${grid.bad} of ${grid.tried}${grid.bad ? ' (first: ' + JSON.stringify(grid.first) + ')' : ''}; her spots that are blocked: ${grid.spotsBlocked.join(', ') || 'none'}`);
    const routes = await page.evaluate(() => check.routes(400));
    console.log(`${routes.found === routes.tried ? 'PASS' : 'FAIL'}: walks across the floor that found a way: ${routes.found} of ${routes.tried} (longest detour ${routes.longestDetour} times the straight line)`);
  }
  await page.close();
}
console.log(errors ? `FAIL: ${errors} page errors` : 'PASS: no page errors');
await browser.close(); srv.close();
