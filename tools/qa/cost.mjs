// How much one frame costs in each room: draw calls and triangles (shadow
// passes included), meshes drawn, of them casting a shadow. Room view and
// Mochi view. For a phone stutter: compare a slow room with one that's fine.
//   node tools/qa/cost.mjs      (W, H, ONLY=bedroom,kitchen)
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
await close();
