// How much one frame costs in each room: draw calls and triangles (shadow
// passes included), meshes drawn, of them casting a shadow. Room view and
// Mochi view. For a phone stutter: compare a slow room with one that's fine.
//   node tools/qa/cost.mjs      (W, H, ONLY=bedroom,kitchen)
// HOUSE=1: also every room at once from high over the house (the House
// view's worst case), each floor, with and without the sun's shadow.
import {open} from './lib.mjs';
const {page, step, close} = await open({seed: 3, width: +(process.env.W || 390), height: +(process.env.H || 844)});
const rooms = (process.env.ONLY || 'room,kitchen,hall,landing,bedroom,bathroom').split(',');
const read = () => page.evaluate(() => {
  const k = kitten, r = k.renderer.info.render; let meshes = 0, casters = 0;
  let sc = k.toy; while (sc.parent) sc = sc.parent;
  sc.traverseVisible(o => { if (o.isMesh || o.isInstancedMesh) { meshes++; if (o.castShadow) casters++; } });
  return {calls: r.calls, tris: r.triangles, meshes, casters, programs: k.renderer.info.programs?.length, geos: k.renderer.info.memory.geometries, tex: k.renderer.info.memory.textures};
});
for (const id of rooms) {
  await page.evaluate(id => kitten.goTo(id), id);
  await step(40);
  const a = await read();
  await page.evaluate(() => kitten.CAMERA_VIEWS.follow());
  await step(40);
  const b = await read();
  console.log(id.padEnd(8), 'room view', JSON.stringify(a), '| follow', JSON.stringify(b));
}
if (process.env.HOUSE) {
  await page.evaluate(() => kitten.goTo('kitchen')); await step(40);
  const floor = (up, shadow) => page.evaluate(([up, shadow]) => {
    const k = kitten, h = k.hall, R = k.renderer, cam = k.camera; let sc = k.toy; while (sc.parent) sc = sc.parent;
    const mid = k.house.convert({x: -14, z: 1}, 'room', 'kitchen');
    for (const g of [k.room.group, k.kitchen.group, h.group]) { g.visible = true; g.traverse(o => o.layers.set(0)); }
    // (Downstairs: the hall's upper floor and the rooms up there hidden; upstairs: shown.)
    for (const m of [...h.upFront, h.upWest, h.upEast, ...h.landing, h.upWindow, h.upRug, h.upPlant]) if (m) m.visible = up;
    h.bedroom.group.visible = h.bathroom.group.visible = up;
    // (Upstairs: the rooms downstairs are under its floor; still drawn, as they would be.)
    const wasShadow = R.shadowMap.enabled; R.shadowMap.enabled = shadow;
    const f = cam.far; cam.far = 200; cam.position.set(mid.x + 22, 34, mid.z + 26); cam.lookAt(mid.x, up ? 10 : 0, mid.z); cam.updateProjectionMatrix();
    R.render(sc, cam); R.render(sc, cam);
    const r = R.info.render; let meshes = 0; sc.traverseVisible(o => { if (o.isMesh || o.isInstancedMesh) meshes++; });
    const out = {calls: r.calls, tris: r.triangles, meshes};
    R.shadowMap.enabled = wasShadow; cam.far = f; cam.updateProjectionMatrix();
    return out;
  }, [up, shadow]);
  for (const up of [false, true]) for (const shadow of [true, false]) console.log('house', up ? 'upstairs ' : 'downstairs', shadow ? 'shadow   ' : 'no shadow', JSON.stringify(await floor(up, shadow)));
}
await close();
