# Mochi (Cat-app)

A three.js virtual-pet web app: Mochi, a long-haired ragdoll kitten, in a
house by the sea (study, kitchen and living room, hall and stairs, landing,
bedroom, bathroom). No build step and no npm dependencies; three.js is in
`dist/vendor`.

Start with `CLAUDE.md` (how work is done here), then `SPEC.md` (what the app
does and for whom), `docs/ROADMAP.md` (phases) and `docs/ARCHITECTURE.md`
(how the code works).

## Run

Node.js 20 or newer.

```sh
npm run dev     # http://127.0.0.1:5173/ (PORT, HOST to change)
npm run check   # syntax, care rules, saves, house map, offline file list
```

Add `?debug` to get `window.kitten` for testing. The browser tests are in
`tools/qa/` (see `docs/QA.md`).

## Publishing

`.github/workflows/pages.yml` publishes `main` at the site root and the
preview branch at `/preview/`. See `CLAUDE.md` for when each is updated.

Older notes from the first October build are in `docs/archive/`.
