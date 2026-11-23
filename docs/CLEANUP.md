# Cleanup findings

Last audit: 2026-11-23, after phase 21.

How: `npx knip` was blocked by the session's permissions before, so a
hand-written scan stood in (exports nobody imports, functions never called,
files under `dist/assets` that no code names), then each hit was checked by
hand for things a scan misses (URL flags, names built at runtime, the extra
pages, tools and workflows). Not covered this time: a sweep for duplicate
logic and overly long code (`app.js` is 5,600 lines; see `docs/refactor.md`).

All five items from this audit were done the same day (Merlin: "Clean up
the low-risk ones"): the two unused models moved to `models/`, the icon
originals to `sources/icons/`, `meowV2Envelope` and `drawTwist` removed,
`README.md` rewritten and the October handoff notes moved to
`docs/archive/`, 13 private exports un-exported. Deploys about 19 MB lighter.
Open items: none.
