// The opening screen. It covers the app while the room loads, then shows the
// live room behind the logo and one button. The very first time, a short
// film plays first: it was made from two real pictures of Mochi in her
// study, and its last frame is the picture the live scene opens on, so the
// film hands over to the real cat without a cut.
//
//   const title = openTitle({mode, storage, key, onReveal, onPlay, onEnter});
//   title.progress(pct)   loading bar
//   title.ready()         the room can be shown
//   title.abort()         get out of the way (the room couldn't load)
//   title.on / title.film / title.live
//
// mode: 'auto' (film only the first time), 'film' (always), 'off'.
// onReveal: the live scene is about to show.  onPlay: Play was pressed.
// onEnter: the screen is covered, switch to the game's layout now.
const FILM = './assets/title/mochi-hello.mp4', POSTER = './assets/title/mochi-hello.webp';
const WAIT_FOR_FILM = 7000; // a film that hasn't started by then is skipped

export function openTitle({mode = 'auto', storage = null, key = 'intro', onReveal, onPlay, onEnter, onPointer, onTap} = {}) {
  const el = document.querySelector('#title'), body = document.body;
  const none = {on: false, film: false, live: false, progress() {}, ready() {}, abort() {}};
  if (!el) return none;
  if (mode === 'off') { el.remove(); body.classList.remove('title-on'); return none; }

  const $ = s => el.querySelector(s);
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const get = () => { try { return storage?.getItem(key); } catch { return null; } };
  const seen = () => { try { storage?.setItem(key, '1'); } catch {} };
  const state = {on: true, film: false, live: false, room: false, filmOver: true, left: false};
  const app = document.querySelector('.app');
  if (app) app.inert = true;
  body.classList.add('title-on');

  // The film: only for someone who hasn't seen it, isn't saving data and
  // hasn't asked for less motion.
  const wantFilm = mode === 'film' || (!get() && !still && !navigator.connection?.saveData);
  let video = null, waitTimer = 0, started = false;
  const endFilm = () => {
    if (state.filmOver) return;
    state.filmOver = true;
    clearTimeout(waitTimer);
    // (A film that never started, on a phone in low power mode for one,
    // gets another go next time.)
    if (started) seen();
    video.pause();
    el.classList.remove('filming');
    el.classList.add('film-done');
    reveal();
  };
  if (wantFilm) {
    state.film = true; state.filmOver = false;
    el.classList.add('film');
    video = $('#title-film');
    Object.assign(video, {muted: true, playsInline: true, preload: 'auto', poster: POSTER});
    video.setAttribute('muted', ''); video.setAttribute('playsinline', '');
    video.addEventListener('playing', () => { if (state.filmOver) return; started = true; clearTimeout(waitTimer); el.classList.add('filming'); }, {once: true});
    video.addEventListener('ended', endFilm);
    video.addEventListener('error', endFilm);
    video.src = FILM;
    video.play().catch(endFilm);
    waitTimer = setTimeout(() => { if (video.paused || video.readyState < 3) endFilm(); }, WAIT_FOR_FILM);
    $('#title-skip').addEventListener('click', endFilm);
  }

  // The live scene shows once the room is ready and any film is over.
  function reveal() {
    if (state.live || !state.room || !state.filmOver || state.left) return;
    state.live = true;
    onReveal?.(state.film);
    // (Two frames, so the room has drawn in its opening pose before the
    // film or the cover fades away.)
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.classList.add('live');
      setTimeout(() => { if (video) { video.pause(); video.removeAttribute('src'); video.load(); } }, 1600);
      setTimeout(() => $('#title-play').focus({preventScroll: true}), still ? 0 : 900);
    }));
  }

  function leave() {
    if (!state.live || state.left) return;
    state.left = true;
    el.classList.add('leaving');
    onPlay?.();
    // She hops hello, the screen blooms over, and the game is underneath.
    const hop = still ? 0 : 1000, bloom = still ? 0 : 480, out = still ? 0 : 900;
    setTimeout(() => el.classList.add('bloom'), hop);
    setTimeout(() => {
      body.classList.remove('title-on');
      if (app) app.inert = false;
      state.on = false;
      onEnter?.();
      el.classList.add('out');
      setTimeout(() => el.remove(), out + 100);
    }, hop + bloom);
  }
  $('#title-play').addEventListener('click', leave);

  // Her eyes follow a finger on the screen; a tap on her says hello.
  el.addEventListener('pointermove', e => { if (state.live && !state.left) onPointer?.(e); });
  el.addEventListener('pointerdown', e => { if (state.live && !state.left && !e.target.closest('button')) onTap?.(e); });

  return {
    get on() { return state.on; }, get film() { return state.film; }, get live() { return state.live; },
    progress(pct) {
      $('#title-fill').style.width = pct + '%';
      $('#title-progress').textContent = pct < 100 ? pct + '%' : 'Fluffing the fur…';
    },
    ready() { state.room = true; el.classList.add('room-ready'); reveal(); },
    abort() {
      if (!state.on) return;
      state.on = false; state.left = true;
      clearTimeout(waitTimer);
      body.classList.remove('title-on');
      if (app) app.inert = false;
      el.remove();
    },
  };
}
