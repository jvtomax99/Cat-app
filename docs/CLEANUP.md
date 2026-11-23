# Cleanup findings

Last audit: 2026-11-23, after phase 21.

How: `npx knip` was blocked by the session's permissions before, so a
hand-written scan stood in (exports nobody imports, functions never called,
files under `dist/assets` that no code names), then each hit was checked by
hand for things a scan misses (URL flags, names built at runtime, the extra
pages, tools and workflows). Not covered this time: a sweep for duplicate
logic and overly long code (`app.js` is 5,600 lines; see `docs/refactor.md`).

1. **Two cat models nobody uses, published on every deploy.**
   `dist/assets/mochi-longhair.glb` (5.7 MB) and `dist/assets/mochi-longhair-b.glb`
   (8.6 MB): the first long-haired candidate and Merlin's own Meshy model B.
   The app loads only `mochi-longhair-{web,phone,hq}.glb` (and the old
   `mochi-ragdoll.glb` behind `?mochi=first`). They can only be opened by
   hand through `mochi-study.html?model=`. Removing from `dist` (move them to
   `models/`, which isn't published) makes every deploy 14 MB lighter (the
   site upload is about 100 MB). Update `CREDITS.md` and
   `docs/mochi-longhair/README.md` paths. Not in the offline copy, so no
   player downloads them today. Risk: low.

2. **Two big icon source images published but never shown.**
   `dist/assets/icons/mochi-portrait.png` (3 MB) and `icon-1024.png` (1.9 MB).
   No page, manifest or script names them; the app uses the small icons made
   from them. 1024 px is the App Store icon size (phase 19), so keep them,
   but in `sources/icons/` instead of the published folder. 5 MB off every
   deploy. Risk: low.

3. **Two functions never called.** `meowV2Envelope` in `dist/meows.js` (a
   loudness curve for the mouth that nothing uses) and `drawTwist` in
   `dist/xmas-tree.js` (a striped bauble texture never drawn). About 20
   lines. Risk: low.

4. **Old documents that describe a different app.** `README.md`,
   `CODEX-HANDOFF.md` and `SOURCE-SNAPSHOT.json` describe the October
   "Pocket Kitten" build: `dist/assets/kitten.glb` (no longer exists),
   `npm run dev`, its old limits. A new session or helper reading them first
   gets the wrong picture. Rewrite `README.md` to point at `CLAUDE.md` and
   `SPEC.md`; move the other two to `docs/archive/`. Risk: low.

5. **13 exports used only inside their own file.** `GROUND_Y_LONGHAIR`
   (cat-rig.js), `padQ`, `eyeDist` (face-sculpt.js), `drawBreccia`
   (kitchen.js), `ypr`, `Track` (motion.js), `DROP`, `AWAY_MAX_HOURS`, `earn`
   (pet-state.js), `FUR_LONGHAIR` (real-cat.js), `drawLeather`,
   `drawAbstract` (room.js), `duneHeight` (terrace.js), `radiusAt`
   (xmas-tree.js). Dropping the `export` word shows they're private. Tidiness
   only, no speed or size gain. (The scan included the check files and
   tools, which import some modules directly; none use these.) Risk: low.
