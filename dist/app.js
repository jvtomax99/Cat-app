import * as THREE from 'three';
import {fresh, advance, care, mood, dayKey, dayFull, JOURNAL_MAX} from './pet-state.js';
import {AWAY_MIN, awayStory} from './away.js';
import {TOYS, RIBBONS, LATE, nextGift, newGifts, waitingGifts, owns, toysAt} from './rewards.js';
import {todaysWish, grantWish, wishDone, WISH_WORTH} from './wish.js';
import {DECORS, applyDecor, inSeason, decorNow, applyKitchenDecor} from './decor.js';
import {load as loadSave, store as storeSave, keepStorage, toCode, fromCode, keys as saveKeys} from './save.js';
import {RealCat, EXPRESSIONS} from './real-cat.js';
import {MotionCat} from './motion-cat.js';
import {Room} from './room.js';
import {Kitchen} from './kitchen.js';
import {Sounds, TUNES} from './sound.js';
import {TitleFx} from './title-fx.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';

const $ = s => document.querySelector(s);
const {damp, clamp, lerp, smoothstep} = THREE.MathUtils;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = list => list[Math.floor(Math.random() * list.length)];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
// The title screen (index.html decides before the first paint: on, unless
// ?intro=0 or ?debug). Once a day the zoomies cinematic plays (after one
// "Enter" tap), then her name over the room; the other times she is asleep
// in her room until a tap wakes her. See the "Title screen" block below.
const titleRoot = document.documentElement;
let titleOn = titleRoot.classList.contains('title'), titleLeaving = false, titleFlip = false;
// Where the title is: load, gate (the Enter buttons), cine (the sequence),
// live (her name, "Tap to start") or still (asleep, "Tap to wake her").
let titleStage = 'load', cine = null, titleFx = null, titleToys = null, titleToysOut = null;
// (The sequence's slow motion: the game clock runs at this rate.)
let timeRate = 1, clockLag = 0;
const TITLE_CAM = {dist: 2.3, pitch: .3, y: .62};
const TITLE_CHIME = 'wake-chime.mp3';
function titleOff() { titleOn = false; syncMusic(); titleRoot.classList.remove('title', 'title-out'); document.querySelectorAll('.topbar, .panel, .app > footer').forEach(el => el.inert = false); }
const motion = reduceMotion ? 0.35 : 1;

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------
// save.js keeps every player's cat through updates (see there).
let storage = null;
try { storage = localStorage; } catch {}
const loaded = storage ? loadSave(storage) : null;
let pet = loaded ? loaded.pet : fresh();
// "While you were away" (away.js): kept in the save until the card has been
// seen, so closing the app during the opening doesn't lose the story.
if (loaded?.left && Date.now() - loaded.left >= AWAY_MIN) pet.away = {from: loaded.left, to: Date.now(), asleep: pet.sleeping};
// First steps, shown once to a new player: "tap the ball", then "give her a
// stroke". A save from before this existed has nothing to learn.
function ensureTaught() { if (pet.taught && typeof pet.taught === 'object') return; const isNew = !pet.bond && !pet.cuddles && (pet.journal?.length ?? 0) <= 1; pet.taught = {ball: !isNew, pet: !isNew}; }
ensureTaught();
const teachStep = () => !pet.taught.ball ? 'ball' : !pet.taught.pet ? 'pet' : null;
function learned(step) { if (pet.taught[step]) return; pet.taught[step] = true; save(); refresh(); if (!teachStep()) setTimeout(() => { if (view.mode === 'room' && !titleOn) keepCamMode(); }, 1500); }
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
// Phones get the room full screen with the panel as a pull-up sheet (phase 08).
const sheetMQ = matchMedia('(max-width: 720px) and (orientation: portrait)');
const CLAY_ICONS = {'i-drop': 'drop', 'i-heart': 'heart', 'i-bowl': 'bowl', 'i-brush': 'brush', 'i-yarn': 'yarn', 'i-moon': 'moon', 'i-sparkle': 'sparkle', 'i-paw': 'paw', 'i-bolt': 'bolt'};
const LEGACY_ICONS = {'♡': 'i-heart', '◡': 'i-bowl', '≋': 'i-brush', '✺': 'i-yarn', '☾': 'i-moon', '✦': 'i-sparkle'};
const ICON_TINT = {'i-drop': '--water', 'i-heart': '--love', 'i-bowl': '--food', 'i-brush': '--clean', 'i-yarn': '--happy', 'i-moon': '--energy', 'i-sparkle': '--accent', 'i-sun': '--energy'};

const NEEDS = [
  {key: 'food', label: 'Tummy', img: 'bowl', tint: '--food', low: 40, verb: 'Feed', act: 'feed', tip: 'A tasty snack would be lovely.'},
  {key: 'happiness', label: 'Joy', img: 'heart', tint: '--happy', low: 35, verb: 'Play', act: 'play', tip: 'A cuddle or a game would help.'},
  {key: 'water', label: 'Water', img: 'drop', tint: '--water', low: 40, verb: 'Fountain', cam: 'water', tip: 'Tap the fountain to invite a drink.'},
  {key: 'energy', label: 'Energy', img: 'bolt', tint: '--energy', low: 35, verb: 'Nap', act: 'sleep', tip: 'A nap will put the bounce back.'},
  {key: 'cleanliness', label: 'Fluff', img: 'sparkle', tint: '--clean', low: 30, verb: 'Brush', act: 'brush', tip: 'Time for a gentle brush.'},
];
// Needs: one tile each, filled like a glass by how full she is. The need
// that wants her most grows into the big card at the top, with its button.
const WAVE = '<svg viewBox="0 0 200 12" preserveAspectRatio="none" aria-hidden="true"><path d="M0 6 Q12.5 0 25 6 T50 6 T75 6 T100 6 T125 6 T150 6 T175 6 T200 6 V12 H0Z"/></svg>';
for (const n of NEEDS) {
  const el = document.createElement('div');
  el.className = 'need';
  el.id = 'ring-' + n.key;
  el.style.setProperty('--tint', `var(${n.tint})`);
  el.innerHTML = `<div class="need-fill" aria-hidden="true">${WAVE}</div><img class="need-icon" src="assets/icons/clay/${n.img}.webp" alt="" width="96" height="96"><div class="need-text"><small>${n.label}</small><strong role="progressbar" aria-label="${n.label}" aria-valuemin="0" aria-valuemax="100">0%</strong><p class="need-tip"></p></div><button class="need-btn" type="button" data-need="${n.key}" hidden>${n.verb}</button><div class="need-bar" aria-hidden="true"><i></i></div>`;
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
let shownLevel = levelInfo(pet.bond).level, shownBowlName = '';
// Does she have this gift (rewards.js)? And the gift toys she has, for the wish.
const has = id => owns(levelInfo(pet.bond).level, id, pet.gifts);
const dueGifts = () => newGifts(levelInfo(pet.bond).level, pet.gifts, pet.giftDay, dayKey());
// Her wish of the day (wish.js): none while a new player is still being
// shown the first steps.
const wishNow = () => teachStep() ? null : todaysWish(pet, has);
let wishTold = false, shownCollar = null, shownFrame = null, frameImage = null;
// A care that was just given may be the wish: thanked a moment later, so her
// words for the care itself are heard first.
function wishCheck(e) {
  if (teachStep()) return;
  const w = grantWish(pet, e, has);
  if (!w) return;
  moment(`${pet.name} ${w.moment}.`, w.icon);
  setTimeout(() => {
    toast(`Wish granted: ${w.label}. +${WISH_WORTH} friendship`);
    if (ready && !pet.sleeping) { say(w.thanks, 3800, true); express('love', 2.4); burst('heart', 9); }
  }, 2200);
}
// The photo on the study wall: one small picture, kept on this phone beside
// the save (not in it, and not in a backup code).
const FRAME_KEY = saveKeys().main + '-frame';
function loadFramePhoto() {
  let url = null;
  try { url = storage?.getItem(FRAME_KEY); } catch {}
  if (!url || !/^data:image\/jpeg;base64,/.test(url)) return;
  const im = new Image();
  im.onload = () => { frameImage = im; refresh(); };
  im.src = url;
}

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
    el.style.setProperty('--v', v / 100);
    el.querySelector('strong').textContent = v + '%';
    el.querySelector('strong').setAttribute('aria-valuenow', v);
    el.classList.toggle('low', v < n.low);
  }
  const lv = levelInfo(pet.bond);
  $('#level').textContent = lv.level;
  $('#bond-label').textContent = lv.name;
  $('#xp-fill').style.width = (lv.progress * 100).toFixed(1) + '%';
  $('#xp-bar').setAttribute('aria-valuenow', Math.round(lv.progress * 100));
  $('#bond-next').textContent = lv.level >= LEVELS.length ? 'Top level. Nothing left to prove.' : `${lv.toGo} more care to reach “${LEVEL_NAMES[lv.level]}”`;
  $('#xp-bar').setAttribute('aria-valuenow', Math.round(lv.progress * 100));
  $('#bond-count').textContent = pet.cuddles + ' cuddle' + (pet.cuddles === 1 ? '' : 's');
  // Gifts of friendship (rewards.js): the next one on the card, her name on
  // her bowl once that is hers.
  // (A save already far along gets the later gifts one a day.)
  const gift = nextGift(lv.level), later = waitingGifts(lv.level, pet.gifts).length > dueGifts().length;
  $('#bond-gift').hidden = !gift && !later;
  if (later) $('#bond-gift').textContent = `${pet.name} has another gift for you tomorrow`;
  else if (gift) $('#bond-gift').textContent = `Level ${gift.level} gift: ${gift.short}`;
  // Friendship is earned over days: once today's care has all counted, say so softly.
  $('#bond-day').hidden = !dayFull(pet);
  const bowlName = owns(lv.level, 'bowl') ? pet.name : '';
  // The later gifts in the room and on her.
  room.setFairyLights(has('lights'));
  if (has('frame') || shownFrame !== null) { const k = has('frame') ? frameImage || 'empty' : null; if (k !== shownFrame) { room.setFrame(!!k, frameImage); shownFrame = k; } }
  { const r = RIBBONS.find(r => r.id === pet.collar) || RIBBONS[0], k = has('collar') ? `${r.id}${has('tag') ? '+tag' : ''}` : ''; if (ready && k !== shownCollar) { cat.setCollar(k ? {color: r.color, tag: has('tag')} : null); shownCollar = k; } }
  $('#photo-hang').hidden = !has('frame');
  $('#ribbons').hidden = !has('collar');
  for (const b of document.querySelectorAll('#ribbon-options [data-ribbon]')) b.setAttribute('aria-pressed', String(b.dataset.ribbon === (RIBBONS.find(r => r.id === pet.collar) || RIBBONS[0]).id));
  if (bowlName !== shownBowlName) { room.setBowlName(bowlName); shownBowlName = bowlName; }
  if (toyChoice() !== usedToy) useToy();
  if (lv.level > shownLevel) {
    const badge = $('.level-badge');
    badge.classList.remove('up'); void badge.offsetWidth; badge.classList.add('up');
    toast(`Friendship level ${lv.level}: ${lv.name}!`);
    moment(`Friendship grew: ${lv.name}.`, 'i-heart');
    if (ready) { express('joy', 2); burst('sparkle', 8); }
  }
  shownLevel = lv.level;
  if (news.length || pet.away || dueGifts().length) setTimeout(pumpNews, 1200);
  $('#sleep-label').textContent = pet.sleeping ? 'Wake' : 'Rest';
  { const src = `assets/icons/clay/${pet.sleeping ? 'sun' : 'moon'}.webp`; if (!$('#sleep-icon').src.endsWith(src)) $('#sleep-icon').src = src; }
  document.body.classList.toggle('night', night);
  document.querySelector('meta[name=theme-color]').content = night ? '#1c1612' : '#f7f1ea';
  $('#daynight').innerHTML = icon(night ? 'i-sun' : 'i-moon');
  $('#daynight').ariaLabel = $('#daynight').title = night ? 'Switch to day' : 'Switch to night';
  for (const b of document.querySelectorAll('.dock [data-action]')) {
    const off = pet.sleeping && b.dataset.action !== 'sleep';
    b.setAttribute('aria-disabled', String(off));
    b.classList.toggle('active', brain.mode === b.dataset.action || (b.dataset.action === 'sleep' && pet.sleeping));
  }
  // The big card: asleep, her energy; otherwise the need that is lowest
  // against its own "low" line, with its button when it is actually low.
  const lows = NEEDS.filter(n => pet[n.key] < n.low);
  const hero = pet.sleeping ? NEEDS.find(n => n.key === 'energy') : [...NEEDS].sort((a, b) => pet[a.key] / a.low - pet[b.key] / b.low)[0];
  const wish = wishNow(), wishOpen = wish && !wishDone(pet) && !pet.sleeping;
  const tip = pet.sleeping ? 'Resting restores energy, even while you’re away.' : lows.length ? hero.tip : wishOpen ? `All good. Today she fancies ${wish.label}.` : 'All good. Just be here.';
  $('#wish').hidden = !wishOpen || (titleOn && titleStage !== 'off');
  if (wishOpen) { $('#wish-text').textContent = `Wish: ${wish.label}`; $('#wish').title = wish.how; }
  // On a phone with the sheet resting, the needs are one slim row (no big card).
  const compact = sheetMQ.matches && !document.body.classList.contains('sheet-open');
  for (const n of NEEDS) {
    const el = $('#ring-' + n.key), on = n === hero && !compact;
    if (on && !el.classList.contains('hero')) { el.classList.remove('swap'); void el.offsetWidth; el.classList.add('swap'); }
    el.classList.toggle('hero', on);
    el.classList.toggle('dream', on && pet.sleeping);
    if (n.key === 'energy') { const src = `assets/icons/clay/${pet.sleeping ? 'moon' : 'bolt'}.webp`; const im = el.querySelector('.need-icon'); if (!im.src.endsWith(src)) im.src = src; }
    el.querySelector('.need-tip').textContent = on ? tip : '';
    el.querySelector('.need-btn').hidden = !on || pet.sleeping || !lows.includes(n);
  }
  $('#care-tip-live').textContent = tip;
  // The care button for what she needs most glows (the fountain button for water).
  const wantAct = !pet.sleeping && lows.includes(hero) ? {food: 'feed', happiness: 'play', energy: 'sleep', cleanliness: 'brush'}[hero.key] : null;
  for (const b of document.querySelectorAll('.dock [data-action]')) b.classList.toggle('wants', b.dataset.action === wantAct);
  $('[data-cam="water"]').classList.toggle('wants', !pet.sleeping && hero.key === 'water' && lows.includes(hero));
  const pill = $('#needs-pill');
  pill.textContent = pet.sleeping ? 'Asleep' : lows.length ? (lows.length === 1 ? '1 needs you' : `${lows.length} need you`) : 'All good';
  pill.dataset.state = pet.sleeping ? 'sleep' : lows.length ? 'low' : 'good';
  // Her own name everywhere (buttons, the sound panel, the care guide).
  document.querySelectorAll('.pet-name-slot').forEach(el => { if (el.textContent !== pet.name) el.textContent = pet.name; });
  $('[data-cam="follow"]').title = $('[data-cam="follow"]').ariaLabel = `Follow ${pet.name}`;
  $('#vol-cat').ariaLabel = `${pet.name}'s volume`;
  $('#sound').innerHTML = icon(pet.sound ? 'i-sound' : 'i-mute');
  $('#sound-on').checked = pet.sound;
  $('#vol-cat').value = pet.catVolume;
  $('#vol-music').value = pet.musicVolume;
  for (const b of $('#tunes').children) b.setAttribute('aria-checked', String(b.dataset.tune === (TUNES[pet.music] ? pet.music : '')));
  $('#sound-panel').classList.toggle('muted', !pet.sound);
  const step = brain.mode === 'play' || pet.sleeping || titleOn && titleStage !== 'off' ? null : teachStep();
  $('#scene-hint').classList.toggle('teach', !!step);
  $('#scene-hint').textContent = brain.mode === 'play' ? 'Steer the toy · hold it still near your kitten to tempt a pounce'
    : step === 'ball' ? `Tap ${altToy() ? 'her toy' : 'the pink ball'} to play with ${pet.name}`
    : step === 'pet' ? `Now give ${pet.name} a stroke`
    : pet.sleeping ? 'Shh… tap Wake when it’s time to play'
    : view.mode !== 'follow' ? (matchMedia('(pointer: coarse)').matches ? 'Explore · drag to turn · pinch towards anything · double tap to go close' : 'Explore · drag to turn · scroll towards anything · double click to go close')
    : matchMedia('(pointer: coarse)').matches ? `Stroke ${pet.name} · drag to circle her · pinch to zoom · tap the floor to call her` : `Stroke ${pet.name} · click the floor to call her, or ${perchHint()} to invite her up · drag to circle her · scroll to come closer`;
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
  pet.journal = pet.journal.slice(0, JOURNAL_MAX);
  renderJournal(true);
  save();
}
// Moments, newest first, under a day heading (Today, Yesterday, a date);
// five show until "Show all".
let journalAll = false;
function dayLabel(t) {
  const d = new Date(t); d.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = Math.round((today - d) / 86400000);
  return days === 0 ? 'Today' : days === 1 ? 'Yesterday' : d.toLocaleDateString(undefined, {weekday: 'short', month: 'short', day: 'numeric'});
}
function renderJournal(fresh = false) {
  const list = $('#journal');
  list.replaceChildren();
  const shown = pet.journal.slice(0, journalAll ? JOURNAL_MAX : 5);
  let lastDay = null;
  shown.forEach((m, i) => {
    const day = dayLabel(m.time);
    if (day !== lastDay) {
      const h = document.createElement('li');
      h.className = 'day-head';
      h.textContent = day;
      list.append(h);
      lastDay = day;
    }
    const id = LEGACY_ICONS[m.icon] || (String(m.icon).startsWith('i-') ? m.icon : 'i-heart');
    const li = document.createElement('li');
    li.className = 'moment' + (fresh && i === 0 ? ' new' : '');
    li.style.setProperty('--tint', `var(${ICON_TINT[id] || '--love'})`);
    const art = CLAY_ICONS[id];
    li.innerHTML = `<span class="moment-icon">${art ? `<img src="assets/icons/clay/${art}.webp" alt="" width="40" height="40">` : icon(id)}</span><span class="moment-text"></span><time></time>`;
    li.querySelector('.moment-text').textContent = m.text;
    const t = li.querySelector('time');
    t.dateTime = new Date(m.time).toISOString();
    t.textContent = new Date(m.time).toLocaleTimeString(undefined, {hour: 'numeric', minute: '2-digit'});
    list.append(li);
  });
  const more = $('#journal-more');
  more.hidden = pet.journal.length <= 5;
  more.textContent = journalAll ? 'Show fewer' : `Show all ${pet.journal.length}`;
  $('#journal-count').textContent = pet.journal.length;
}

// News cards (#news-dialog): "While you were away" and gifts of friendship.
// One at a time, once she is idle in the room and nothing else is open.
const news = [];
let awayQueued = false, giftsQueued = false;
function gatherNews() {
  const a = pet.away;
  if (a && !awayQueued) {
    const story = a && Number.isFinite(a.from) && Number.isFinite(a.to) ? awayStory(a.from, a.to, {asleep: a.asleep === true, decor: room.decor}) : null;
    if (!story) delete pet.away;
    else {
      awayQueued = true;
      news.push({eyebrow: `Away ${story.label}`, title: 'While you were away', rows: story.lines, button: `Hello, ${pet.name}`, shown() {
        const l = story.lines[0];
        delete pet.away; awayQueued = false;
        moment(`While you were away: ${l.text[0].toLowerCase()}${l.text.slice(1)}`, l.icon);
      }});
    }
  }
  const got = dueGifts();
  if (got.length && !giftsQueued) {
    giftsQueued = true;
    news.push({eyebrow: 'A gift of friendship', title: got.length > 1 ? `${pet.name} has ${got.length} gifts for you` : `${pet.name} has a gift for you`, rows: got.map(g => ({text: g.name, sub: g.text, icon: g.icon, gift: true})), button: 'Lovely', shown() {
      pet.gifts = [...new Set([...(Array.isArray(pet.gifts) ? pet.gifts : []), ...got.map(g => g.id)])];
      if (got.some(g => g.level >= LATE)) pet.giftDay = dayKey();
      giftsQueued = false;
      if (ready && !pet.sleeping) { express('joy', 2); burst('sparkle', 8); }
      moment(`A gift of friendship: ${got.map(g => g.short).join(', ')}.`, 'i-sparkle');
      // (So a gift for the room or for her is there behind the card at once.)
      refresh();
    }});
  }
}
function pumpNews() {
  if (!ready || titleOn || brain.mode !== 'idle' || document.querySelector('dialog[open]')) return;
  gatherNews();
  const n = news.shift();
  if (!n) {
    // Nothing to tell: she says her wish of the day, once a visit.
    const w = wishNow();
    if (w && !wishTold && !wishDone(pet) && !pet.sleeping) { wishTold = true; say(w.want, 4600); }
    return;
  }
  $('#news-eyebrow').textContent = n.eyebrow;
  $('#news-title').textContent = n.title;
  $('#news-ok').textContent = n.button;
  const list = $('#news-list');
  list.replaceChildren();
  for (const r of n.rows) {
    const li = document.createElement('li');
    if (r.gift) li.className = 'gift';
    li.style.setProperty('--tint', `var(${ICON_TINT[r.icon] || '--love'})`);
    li.innerHTML = `<img src="assets/icons/clay/${CLAY_ICONS[r.icon] || 'heart'}.webp" alt="" width="44" height="44"><strong></strong>${r.sub ? '<small></small>' : ''}`;
    li.querySelector('strong').textContent = r.text;
    if (r.sub) li.querySelector('small').textContent = r.sub;
    list.append(li);
  }
  $('#news-dialog').showModal();
  n.shown();
}
$('#news-dialog').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.close(); });
$('#news-dialog').addEventListener('close', () => setTimeout(pumpNews, 500));

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
sounds.volume = {cat: pet.catVolume, music: pet.musicVolume};
// Music: the piece the player picked, only with sound on, once the opening
// is over and while the app is in front. Called wherever one of those changes.
const syncMusic = () => sounds.setMusic(pet.sound && !titleOn && !document.hidden ? TUNES[pet.music]?.file ?? null : null);
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
for (const ev of ['pointerdown', 'touchend', 'click']) document.addEventListener(ev, () => { if (pet.sound) { sounds.setEnabled(true); syncMusic(); } }, {capture: true, passive: true});

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
  titleOff();
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
// (It also dresses the rooms in that look straight away: a link that shows it with no tapping.)
if (DECOR_FORCE && DECORS[DECOR_FORCE] && pet.decor !== DECOR_FORCE) { pet.decor = DECOR_FORCE; save(); }
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
// Gift toys (rewards.js): the felt mouse and the fabric fish stand in for
// the ball when picked from the toy basket, the way a decor's own toy does
// (`room.altToy`, Halloween's felt bat). Loaded the first time each is picked.
const giftToys = {};
let giftToy = null, usedToy = null;
const altToy = () => titleOn ? room.altToy : giftToy || room.altToy;
async function loadGiftToy(t) {
  const loader = new GLTFLoader();
  try { loader.setMeshoptDecoder((await import('./vendor/meshopt_decoder.module.js')).MeshoptDecoder); } catch { return null; }
  return new Promise(done => loader.load(`./assets/models/${t.file}.glb`, g => {
    const o = g.scene, box = new THREE.Box3().setFromObject(o), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    const k = t.size / Math.max(size.x, size.y, size.z), holder = new THREE.Group();
    // (Standing on the floor, centred over its spot.)
    o.scale.setScalar(k); o.position.set(-c.x * k, -box.min.y * k, -c.z * k);
    o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    holder.add(o);
    holder.visible = false;
    scene.add(holder);
    done(giftToys[t.id] = holder);
  }, undefined, () => done(null)));
}
const toyChoice = () => has(pet.toy) && TOYS.some(t => t.id === pet.toy) ? pet.toy : 'ball';
function useToy() {
  const id = usedToy = toyChoice(), t = TOYS.find(t => t.id === id);
  if (!t.file) { giftToy = null; return; }
  if (giftToys[id]) { giftToy = giftToys[id]; return; }
  // (A toy that didn't arrive is asked for again at the next refresh.)
  loadGiftToy(t).then(o => { if (!o) { if (usedToy === id) usedToy = null; } else if (toyChoice() === id) giftToy = o; });
}

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
// Mochi is the long-haired Mochi (docs/mochi-longhair) on the preview since
// 2026-11-12, Merlin's pick. ?mochi=first: the first Mochi, the kitten (and
// with ?motion=classic, which is hers alone).
const LONGHAIR = new URLSearchParams(location.search).get('mochi') !== 'first' && new URLSearchParams(location.search).get('motion') !== 'classic';
// Her model, packed (tools/mochi-longhair/web.sh, from mochi-longhair-hq.glb):
// the same shape in both; a phone gets the textures at half size (2.2 MB
// against 4.8 MB). `?model=phone`, `web` or `hq` (the unpacked source) picks one by hand.
const CAT_FILE = `./assets/mochi-longhair-${{phone: 'phone', hq: 'hq'}[new URLSearchParams(location.search).get('model') || (matchMedia('(pointer: coarse)').matches ? 'phone' : 'web')] || 'web'}.glb`;
const cat = new RealCat(LONGHAIR ? {rig: 2, model: 'longhair'} : CLASSIC_MOTION ? {} : {rig: 2});
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
    // (Past the right wall the camera may step outside: that wall and its
    // fireplace hide, so the turn towards it sees the room, not the back of the armchair.)
    camBox: {x: [-4.3, 9.5], y: [.2, 6.5], z: [-3.1, 16]},
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
// (The title screen opens on her bed in the study.)
// (?room=kitchen or ?room=study opens in that room; the title screen still starts in the study.)
{ const r = new URLSearchParams(location.search).get('room'); if (r === 'kitchen' || r === 'study') pet.place = r === 'kitchen' ? 'kitchen' : 'room'; }
if (titleOn) pet.place = 'room';
if (pet.place === 'kitchen') buildKitchen();
usePlace(pet.place === 'kitchen' ? kitchen : room);
function onRug(v) {
  if (place !== room) return place.clampFloor(v);
  const dx = (v.x - RUG.x) / RUG.rx, dz = (v.z - RUG.z) / RUG.rz, r = Math.hypot(dx, dz);
  if (r > 1) { v.x = RUG.x + dx / r * RUG.rx; v.z = RUG.z + dz / r * RUG.rz; }
  return v;
}
const randomRugPoint = () => place !== room ? place.randomFloorPoint() : onRug(new THREE.Vector3(rand(-1.4, 1.4), 0, rand(-.7, 1.2)));

let ready = false;
cat.load(LONGHAIR ? CAT_FILE : './assets/mochi-ragdoll.glb', p => {
  if (!p.total) return;
  const pct = Math.round(p.loaded / p.total * 100);
  $('#load-fill').style.width = pct + '%';
  $('#load-progress').textContent = pct < 100 ? pct + '% · bringing your kitten home' : 'Fluffing the fur…';
  if (titleOn) { $('#title-fill').style.width = pct + '%'; $('#title-progress').textContent = pct < 100 ? pct + '% · bringing your kitten home' : 'Fluffing the fur…'; }
}).then(() => {
  if (!CLASSIC_MOTION) { const motion = new MotionCat(cat); cat.update = (dt, t, ctl) => motion.update(dt, t, ctl); cat.motion = motion; }
  ready = true;
  // (Her collar goes on now, not at the next tick.)
  refresh();
  // The kitchen through the study's doorway (built once she's home).
  if (!kitchen) setTimeout(() => { if (!kitchen) { buildKitchen(); joinRooms(); } }, 400);
  host.classList.add('ready');
  $('#loading').classList.add('done');
  setTimeout(() => $('#loading').hidden = true, 900);
  if (titleOn) titleReady(); else { greet(true); setTimeout(pumpNews, 2600); }
}).catch(e => {
  titleOff();
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
if (pet.sleeping || titleOn) { brain.activity = 'sleep'; brain.pos.copy(CUSHION_SPOT); brain.heading = .6; }

function express(name, seconds) { brain.override = name; brain.overrideUntil = clockNow + seconds; }
function hop() { if (!reduceMotion) brain.hopAt = clockNow; }
function slowBlink() { brain.slowBlinkAt = clockNow; }
function yawn() { brain.yawnAt = clockNow; }
function glanceAt(point, seconds) { brain.glance = point.clone(); brain.glanceUntil = clockNow + seconds; }
function twitchEar(side = Math.random() < .5 ? 0 : 1, strength = 1) { cat.twitchEar(side, strength); }

function setActivity(name, seconds = Infinity, after = null) {
  brain.activity = name;
  brain.napFace = null; // (which way she lies for a nap on the shelf: set after, by garlandNap)
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
// How long a jump takes and how high it arcs: she falls at a cat's pace
// (gravity for her size), clears the higher end by a little (more over a
// long gap), and never crosses the floor faster than a sprint.
const JUMP_G = 32;
// How fast a turn may pick up or lose pace (rad/s2).
const TURN_ACC = 40;
function jumpArc(up, dist) {
  const clear = .12 + .06 * dist;
  const dur = Math.max(Math.sqrt(2 * (Math.max(up, 0) + clear) / JUMP_G) + Math.sqrt(2 * (Math.max(-up, 0) + clear) / JUMP_G), dist / 5, .3);
  return {dur, arc: JUMP_G * dur * dur / 8};
}
function leap(to, toY, perch, then = null, out = 0) {
  brain.target = null;
  brain.chainUntil = clockNow + 6;
  brain.jumpFace = angleTo(brain.pos, to);
  glanceAt(new THREE.Vector3(to.x, toY + .3, to.z), 1.2);
  setActivity('prejump', reduceMotion ? .3 : chainNext() ? rand(.5, .9) : .8, () => {
    const up = toY - brain.elevation;
    brain.jump = {from: brain.pos.clone(), fromY: brain.elevation, to: to.clone(), toY, perch, fromPerch: brain.perch, then, start: clockNow, ...jumpArc(up, Math.hypot(to.x - brain.pos.x, to.z - brain.pos.z)), out};
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

// A pat with a paw takes this long: drawn back, out fast (it hits at .22 s),
// half way back, a second quick tap, then home more slowly.
const SWAT = .62;

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
    // (A dash takes off and pulls up harder than a walk or a trot.)
    const top = typeof brain.run === 'number' ? brain.run : brain.run ? 2.1 : .65, flat = top >= 2.5;
    // (She eases right down as she arrives, and the last of her speed dies
    // away over a couple of centimetres below: stopping dead from a walk or a
    // run is a jolt through her whole body.)
    // (Slowed over the last few centimetres before the spot she used to stop
    // dead at, 6 cm short, so she ends where she always did: the reach of
    // her mouth to bowls and the salmon was set there.)
    brain.speed = damp(brain.speed, facing < .8 ? Math.min(top, Math.max(0, dist - .05) * (flat ? 3.2 : 2.5) + .05) : .15, flat ? 8 : 5, dt);
    if (dist < .06) {
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
    brain.speed = damp(brain.speed, 0, 12, dt);
  }
  const J = brain.jump;
  if (J) {
    // (A thrown thing's path: steady across, and a plain arc up and down.)
    // (The first sixth is the push-off: she gathers speed over a few frames
    // as her legs drive, not all of it in one. The last eighth is the
    // landing: her front paws are down and her legs take up most of her
    // speed before she stops. A thrown thing's path in between.)
    const kt = Math.min(1, (t - J.start) / J.dur), PUSH = .18, LAND = .16, END = .15;
    const along = x => x < PUSH ? x * x / (2 * PUSH) : x < 1 - LAND ? x - PUSH / 2 : 1 - LAND - PUSH / 2 + (x - 1 + LAND) * (1 - (1 - END) * (x - 1 + LAND) / (2 * LAND));
    const k = kt >= 1 ? 1 : along(kt) / along(1);
    brain.pos.lerpVectors(J.from, J.to, k);
    // (Between shelves she arcs out past the edge of the one above.)
    if (J.out) brain.pos.z += J.out * Math.sin(Math.PI * k);
    brain.elevation = J.fromY + (J.toY - J.fromY) * k + 4 * J.arc * k * (1 - k);
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
  else if (brain.perch && !J && ['sit', 'loaf', 'catnap', 'groom', 'land'].includes(a)) desiredHeading = a === 'catnap' && brain.napFace != null && brain.perch === 'shelfHigh' ? brain.napFace : PERCHES[brain.perch].face;
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
    // A turn gathers pace over a few frames and eases off the same way:
    // started at full pace in one frame, her hips whipped sideways (turning
    // round on the mantel before jumping down, most of all).
    const w = Math.atan2(Math.sin(brain.heading - was), Math.cos(brain.heading - was)) / Math.max(dt, 1e-4), lim = TURN_ACC * dt;
    brain.turnRate = clamp(w, (brain.turnRate || 0) - lim, (brain.turnRate || 0) + lim);
    brain.heading = was + brain.turnRate * dt;
  } else if (brain.turnRate) {
    brain.turnRate = Math.abs(brain.turnRate) < .01 ? 0 : damp(brain.turnRate, 0, 12, dt);
    brain.heading += brain.turnRate * dt;
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
  // (Her nap in the garland on the top shelf: curled up, her face to the room.)
  if (a === 'catnap') { pose = brain.napFace != null && brain.perch === 'shelfHigh' ? 'curl' : 'sleep'; tail = {amp: .05, speed: .5}; }
  if (a === 'prejump') { pose = 'crouch'; poseRate = 9; const w = (t - brain.actStart) / Math.max(.3, brain.actUntil - brain.actStart); wiggle = w > .45 ? .5 : 0; tail = {amp: .5, speed: 4}; }
  if (a === 'jump') { const k = J ? (t - J.start) / J.dur : 1; pose = k < .7 ? 'leap' : 'crouch'; poseRate = 14; tail = {amp: .1, speed: 1}; }
  if (a === 'land') { pose = 'crouch'; poseRate = 10; }
  if (a === 'poise') { pose = 'stand'; poseRate = 8; tail = {amp: .7, speed: 1.8}; }
  if (a === 'stalk') { pose = 'crouch'; poseRate = 7; wiggle = (t - brain.actStart) > .8 ? .45 : 0; tail = {amp: .5, speed: 5}; }
  if (a === 'pause') { pose = 'crouch'; tail = {amp: .3, speed: 3}; }
  // Draped over the pendant shade like a scarf: legs and tail dangling.
  if (brain.perch === 'pendant' && !J && !['prejump', 'land', 'swat'].includes(a)) { pose = 'drape'; tail = {amp: .15, speed: .8}; }
  // (swat: how far the paw is off the floor; reach: from drawn back, below
  // 0, to right out, 1; lean: how much her weight, shoulder and head join in.)
  let swat = 0, swatReach = 0, swatLean = 0;
  if (a === 'swat') {
    const q = clamp((t - brain.actStart) / SWAT, 0, 1), ss = (a, b) => smoothstep(q, a, b);
    swat = ss(0, .15) * (1 - ss(.82, 1)) * motion;
    swatReach = q < .18 ? -.25 * ss(0, .18) : q < .355 ? -.25 + 1.25 * (1 - Math.pow(1 - (q - .18) / .175, 3)) : q < .52 ? 1 - .55 * ss(.355, .52) : q < .64 ? .45 + .45 * ss(.52, .64) : .9 * (1 - ss(.64, .97));
    swatLean = ss(0, .3) * (1 - ss(.72, 1)) * motion;
    tail = {amp: .5, speed: 4};
  }
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
    sprint: a === 'walk' && typeof brain.run === 'number' && brain.run >= 2.5,
    groom: a === 'groom', swat, swatReach, swatLean, swatAt: a === 'swat' ? brain.swatAt : null, head: brain.head, reach: brain.reach, look: brain.look, face, tail,
    tailUp: t < brain.tailUpUntil && !['sleep', 'belly', 'loaf'].includes(a) ? 1 : 0,
    // (For the new movement: how far through a jump she is, which way, and
    // whether she's riding the vacuum.)
    air: J ? clamp((t - J.start) / J.dur, 0, 1) : -1,
    // (Her body follows the way she's flying; landing, she sinks and comes back up.)
    airTilt: J ? clamp(Math.atan2(J.toY - J.fromY + 4 * J.arc * (1 - 2 * clamp((t - J.start) / J.dur, 0, 1)), Math.max(.3, Math.hypot(J.to.x - J.from.x, J.to.z - J.from.z))) * .5, -.5, .55) : 0,
    squash: a === 'land' ? smoothstep(t - brain.actStart, 0, .07) * Math.exp(-7 * (t - brain.actStart)) * motion : 0, airUp: J ? Math.sign(J.toY - J.fromY) || 1 : 1, riding: brain.perch === 'vacuum',
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
  // At Christmas, the top shelf by the garland is the place for a nap.
  if (place === kitchen && kitchen.decor === 'christmas') options.push('garlandNap', 'garlandNap');
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
  if (choice === 'garlandNap') garlandNap();
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
      setActivity('swat', SWAT, () => setActivity('sit', 6));
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
      setActivity('swat', SWAT, () => setActivity('pause', 1.1, () => {
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
        setActivity('swat', SWAT, () => setActivity('swat', SWAT, () => setActivity('pause', 1.2, () => setActivity('sit', rand(2, 4)))));
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
    later(.6, () => { if (brain.perch === 'pendant') { setActivity('swat', SWAT, () => setActivity('sit')); kitchen.bumpPendant(rand(-.2, .2), rand(-.2, .2), rand(-.4, .4)); } });
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
    setActivity('swat', SWAT, () => setActivity('sit'));
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
    setActivity('swat', SWAT, () => setActivity('sit'));
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
    setActivity('swat', SWAT);
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
// Christmas: up to the top shelf, along to the clear stretch between the
// cups and the books, and a nap there lying along the shelf, tucked up
// against the garland.
function garlandNap() {
  if (place !== kitchen || brain.mode !== 'idle') return false;
  const lane = PERCHES.shelfHigh.lane, spot = new THREE.Vector3(.95, 0, lane.z - .18);
  const settle = () => {
    if (brain.perch !== 'shelfHigh' || brain.mode !== 'idle') return;
    brain.perchUntil = Math.max(brain.perchUntil, clockNow + 40);
    // (She comes to the spot from its left, walking toward the books, and
    // curls up as she arrives: her back to the garland, her face to the
    // room. From further along the shelf she goes past it first, so there's
    // no turning round asleep.)
    const lead = brain.pos.x > spot.x - .3 ? [new THREE.Vector3(spot.x - .6, 0, lane.z)] : Math.abs(brain.pos.z - lane.z) < .2 ? [] : [new THREE.Vector3(brain.pos.x + .25, 0, lane.z)];
    walkPath(lead.concat([spot]), () => {
      setActivity('catnap', rand(16, 26), () => { brain.napFace = null; setActivity('sit', rand(2, 4)); });
      brain.napFace = Math.PI / 2;
    });
  };
  if (brain.perch === 'shelfHigh') settle(); else jumpTo('shelfHigh', settle, rand(45, 60));
  return true;
}
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
        setActivity('swat', SWAT, () => setActivity('pause', 1.2, () => setActivity('sit')));
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

// How she takes a touch, by where it lands. Her chin is the favourite; the
// tail and paws are not for touching (dislikeTouch).
const PET_ZONES = {
  head: {face: 'joy', rub: 1.8, tail: 2.5, hearts: 5, lines: ['Right behind the ears. Perfect.', 'More of that, please.', 'You have excellent petting skills.', 'I like it here. Especially with you.']},
  chin: {face: 'love', rub: 1.2, tail: 2, hearts: 7, lines: ['Chin scratches. Yes. There.', 'Mmm… a little to the left.', 'That is the spot. Remember it.', 'Purrrr…']},
  back: {face: 'joy', rub: .5, tail: 4.5, hearts: 4, lines: ['All the way down to the tail, please.', 'Long strokes. Lovely.', 'Purrrr…', 'Keep going.']},
};
// Which part of her a point on her coat belongs to: the nearest of a few
// points on her skeleton. (By bone name, so a new model with the same rig
// keeps its spots.)
const ZONE_BONES = [['head', 'earL'], ['head', 'earR'], ['back', 'neck'], ['back', 'chest'], ['back', 'spine'], ['back', 'hips'], ['back', 'tail0'],
  ['tail', 'tail2'], ['tail', 'tail3'], ['tail', 'tail4'], ['tail', 'tail5'], ['tail', 'tail6'], ['tail', 'tail7'],
  ['paws', 'wristL'], ['paws', 'wristR'], ['paws', 'hockL'], ['paws', 'hockR']];
const zonePt = new THREE.Vector3();
function zoneAt(point) {
  let best = 'back', d = Infinity;
  const near = (zone, p, k = 1) => { const x = p.distanceTo(point) * k; if (x < d) { d = x; best = zone; } };
  // (Loafing or asleep her paws are tucked under her: her side is her side.)
  const tucked = ['loaf', 'sleep', 'catnap'].includes(brain.activity);
  near('head', cat.headTop(zonePt));
  near('head', cat.head.localToWorld(zonePt.set(0, .2, .2)));
  near('head', cat.head.localToWorld(zonePt.set(0, .12, .26)));
  near('chin', cat.head.localToWorld(zonePt.set(0, -.05, .16)));
  for (const [zone, bone] of ZONE_BONES) if (cat.bones[bone]) near(zone, cat.bones[bone].getWorldPosition(zonePt), zone === 'paws' ? tucked ? 2.4 : 1.25 : 1);
  return best;
}
// A touch on her, wherever it lands.
let lastDislike = -10, lastMumble = -10, dislikes = [];
function touchCat(zone, opts = {}) {
  if (!ready) return;
  if ((zone === 'tail' || zone === 'paws') && brain.activity !== 'belly') { dislikeTouch(zone); return; }
  if (pet.taught.ball && !pet.sleeping) learned('pet');
  // (Asleep: a mumble now and then, not at every stroke.)
  if (pet.sleeping) { if (clockNow - lastMumble < 4) return; lastMumble = clockNow; }
  // (Care only counts every so often, but she always feels the hand.)
  if (!pet.sleeping && clockNow - lastPet < .9) { brain.strokeUntil = clockNow + .6; burst('heart', 1, opts.at || headScreen); return; }
  act('pet', {...opts, zone});
}
// The tail and the paws: ears flick, a look, a word. Keep at it and she
// moves away from your hand.
function dislikeTouch(zone) {
  if (clockNow - lastDislike < 1.4) return;
  lastDislike = clockNow;
  if (pet.sleeping) { twitchEar(undefined, .8); return; }
  brain.strokeUntil = 0;
  brain.content = Math.max(0, (brain.content || 0) - .25);
  express(zone === 'tail' ? 'grumpy' : 'surprised', zone === 'tail' ? 1.6 : .8);
  twitchEar(0, 1.4); twitchEar(1, 1.4);
  glanceAt(camera.position, 1.8);
  say(pick(zone === 'tail' ? ['Not the tail.', 'Excuse me. That is my tail.', '*tail flick*'] : ['My toes!', 'Those are my beans. Mine.', 'Paws are private.']), 2200);
  dislikes = dislikes.filter(x => clockNow - x < 10).concat(clockNow);
  if (dislikes.length >= 3 && brain.mode === 'idle' && !busyBody() && !brain.perch && !brain.jump && ['sit', 'loaf', 'stand', 'walk'].includes(brain.activity)) {
    dislikes = [];
    const away = tmpV.subVectors(brain.pos, camera.position).setY(0).normalize().multiplyScalar(1.1).add(brain.pos);
    walkTo(away, () => { setActivity('sit'); glanceAt(camera.position, 2); });
  }
}
const busyBody = () => !!brain.eatAt || brain.vacRide || ['eat', 'drink', 'stalk'].includes(brain.activity);
// A tap on the floor calls her over. She comes unless she is busy or asleep.
function callTo(x, y) {
  if (!ready || brain.mode === 'play') return;
  setPointer({clientX: x, clientY: y});
  const hit = new THREE.Vector3();
  if (!ray.ray.intersectPlane(groundPlane, hit) || hit.x < LIMITS.x[0] || hit.x > LIMITS.x[1] || hit.z < LIMITS.z[0] || hit.z > LIMITS.z[1]) return;
  const r = host.getBoundingClientRect();
  pawAt(x - r.left, y - r.top);
  if (pet.sleeping) { twitchEar(undefined, .6); return; }
  // (Not in the middle of a drink at the tap, a stolen bite, a stalk or a ride: those have to finish.)
  if (!['idle', 'solo'].includes(brain.mode) || busyBody()) { say(pick(['In a minute!', 'Busy! One sec.']), 2000); return; }
  const to = onRug(hit.setY(0));
  if (Math.hypot(to.x - brain.pos.x, to.z - brain.pos.z) < .4 && !brain.perch) { glanceAt(camera.position, 2); slowBlink(); return; }
  brain.mode = 'idle';
  brain.nextIdle = clockNow + 9;
  glanceAt(to.clone().setY(.2), 1.2);
  later(.3, () => meow('chirp', 'idle'));
  brain.tailUpUntil = clockNow + 4;
  walkTo(to, () => { setActivity('sit'); glanceAt(camera.position, 2.4); later(.8, slowBlink); }, Math.hypot(to.x - brain.pos.x, to.z - brain.pos.z) > 2.6);
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
  const r = care(pet, a, opts.snack, {auto: opts.auto === true});
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
    // Contentment builds with every welcome touch (her chin most of all)
    // and fades when she is left alone. Full, she may roll over for you,
    // or just blink slowly: she decides.
    const zone = brain.activity === 'belly' && !['head', 'chin'].includes(opts.zone) ? 'belly' : opts.zone || 'head';
    brain.content = Math.max(0, (brain.content || 0) - (t - (brain.contentAt ?? t)) * .04) + ({chin: .3, head: .22, belly: .1}[zone] ?? .16);
    brain.contentAt = t;
    const full = brain.content >= 1 && ['sit', 'loaf'].includes(brain.activity) && brain.mode === 'idle';
    const rollOver = full && Math.random() < .6;
    if (full) { brain.content = rollOver ? 0 : .5; if (!rollOver) later(.6, slowBlink); }
    if (rollOver) {
      setActivity('belly', 5, () => { setActivity('sit'); hop(); });
      say(pick(['Belly rubs?! Just this once…', 'You may pet the floof.', 'Purrrr… I trust you.']), 3200);
      burst('heart', 7);
    } else if (zone === 'belly') {
      // The belly: with a good friend, bliss. Otherwise it is a trap.
      if (pet.bond >= 40) { express('love', 2.2); burst('heart', 6, opts.at || headScreen); if (!opts.quiet) say(pick(['Only you get to do this.', 'Softest spot. Be gentle.', 'Purrrr…']), 2800); }
      else { express('excited', 1.4); hop(); burst('sparkle', 3, opts.at || headScreen); if (!opts.quiet) say(pick(['Got your hand!', '*bunny kicks*', 'It was a trap. It is always a trap.']), 2600); }
    } else {
      const Z = PET_ZONES[zone] || PET_ZONES.head;
      express(zone === 'chin' ? 'love' : opts.stroke ? 'bliss' : pet.bond >= 100 && Math.random() < .4 ? 'love' : Z.face, 2.2);
      brain.rubUntil = t + (opts.stroke ? Z.rub * .7 : Z.rub);
      brain.tailUpUntil = t + Z.tail;
      if (!opts.stroke && zone === 'head') hop();
      burst('heart', opts.stroke ? Math.ceil(Z.hearts / 2) : Z.hearts, opts.at || headScreen);
      if (!opts.quiet) say(pick(Z.lines), 3000);
    }
    brain.kneadUntil = t + 2.4;
    purr(2.2);
    if (pet.bond >= 15 && Math.random() < .45) setTimeout(slowBlink, 2400);
    if (pet.cuddles % 5 === 0) moment(`${pet.cuddles} cuddles. One very happy cat.`, 'i-heart');
  }
  if (!opts.auto && a !== 'sleep') wishCheck({action: a, snack: opts.snack || 'kibble', zone: opts.zone || 'head', toy: toyChoice(), night});
  refresh();
  save();
  return true;
}

// Play: steer the toy; the kitten chases it, wiggles and pounces.
const PLAY_SECONDS = 25;
function startPlay() {
  learned('ball');
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
  const alt = altToy();
  toy.visible = !alt;
  for (const id in giftToys) giftToys[id].visible = giftToys[id] === alt;
  // (A decor's own toy is put away while a gift toy is out.)
  if (room.altToy && giftToy && !titleOn) room.altToy.visible = false; else if (room.altToy) room.altToy.visible = true;
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
    if (altToy() && !brain.stalked) {
      // The felt bat: she stalks it (low, tail twitching, a little wiggle),
      // taps it, pauses to watch, then pounces.
      brain.stalked = true;
      express('curious', 1.2);
      setActivity('stalk', 1.4, () => {
        brain.swatAt = toy.position.clone();
        setActivity('swat', SWAT, () => setActivity('pause', .9, () => {
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
      setActivity('swat', SWAT, () => setActivity('play'));
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
// Two modes, chosen with the Explore and Mochi buttons and by nothing else:
// Mochi (`follow`) stays on her; Explore (`room`, `free`, `spot`) is yours.
//   one finger / left mouse  turns the view about what it looks at (glides on after a flick)
//   pinch / wheel            Explore: closer or further, towards the thing under the fingers;
//                            far out gives the whole room. Mochi: closer to her or further.
//   two fingers              twisting turns; in Explore, sliding both moves the view
//   tap                      her: a pat, by where it lands; the floor, in Mochi: she comes
//   double tap               Explore: go close to that thing (again on it: the whole room)
//   the turn                 runs from one side wall to the other (the rooms have no
//                            front wall); past the end it gives a little and springs back
const view = {
  focus: new THREE.Vector3(0, .7, -.2), yaw: 0, pitch: .3, dist: 7,
  goal: {focus: new THREE.Vector3(0, .7, -.2), yaw: 0, pitch: .3, dist: 7},
  mode: 'room', lastDrag: -10, zoomedAt: -100, glideUntil: -1, titleYaw: 0,
  // zoomHeld: you chose the zoom, so following her leaves it alone. fling: the
  // turn still running after a flick. shown: how far the camera really is
  // (walls and furniture can hold it closer than `dist`).
  zoomHeld: false, fling: null, shown: 7, auto: 7, far: 0, farY: 0, push: 0, home: null,
};
const pointer = new THREE.Vector2(), ray = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -.13);
const gazePlane = new THREE.Plane();
let gesture = null;
const touches = new Map();
let pinch = null;

function seedPinch() {
  const [p1, p2] = [...touches.values()];
  pinch = {d: Math.hypot(p1.x - p2.x, p1.y - p2.y), mx: (p1.x + p2.x) / 2, my: (p1.y + p2.y) / 2, a: Math.atan2(p2.y - p1.y, p2.x - p1.x), twist: 0};
  // (A new pinch aims afresh, however soon after the last.)
  view.zoomedAt = -100;
}
function setPointer(e) {
  const r = host.getBoundingClientRect();
  pointer.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
  ray.setFromCamera(pointer, camera);
  return r;
}
function catHit() { return ready ? ray.intersectObjects(cat.meshes, false)[0] || null : null; }
function hitsCat() { return !!catHit(); }
// The ball on the floor: a tap near it starts a game. (A finger is wide: near counts.)
function hitsToy() { const o = altToy() || toy; return ready && o.visible !== false && ray.ray.distanceToPoint(o.getWorldPosition(new THREE.Vector3())) < .26; }
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

// The whole-room view may look at a point below the floor (on a phone the
// room is framed that way). Leaving it, raise that point to the floor and
// aim at it from where the camera already is: the picture tilts a few
// degrees instead of jumping when you start to drag, turn or zoom.
function liftFocus() {
  const y0 = LIMITS.y[0] + .02;
  for (const v of [view, view.goal]) {
    if (v.focus.y >= y0) continue;
    const cp = Math.cos(v.pitch);
    const cx = v.focus.x + Math.sin(v.yaw) * cp * v.dist, cy = v.focus.y + Math.sin(v.pitch) * v.dist, cz = v.focus.z + Math.cos(v.yaw) * cp * v.dist;
    v.focus.y = y0;
    const dx = cx - v.focus.x, dy = cy - y0, dz = cz - v.focus.z;
    v.dist = Math.hypot(dx, dy, dz);
    v.yaw = Math.atan2(dx, dz) + Math.round((v.yaw - Math.atan2(dx, dz)) / (Math.PI * 2)) * Math.PI * 2;
    v.pitch = Math.asin(dy / v.dist);
  }
  view.far = Math.max(view.far, view.goal.dist);
}
function setCamMode(mode) {
  if (view.mode === 'room' && mode !== 'room') liftFocus();
  if (mode !== 'free') { view.fling = null; view.zoomHeld = false; }
  const swapped = (view.mode === 'follow') !== (mode === 'follow');
  view.mode = mode;
  // (The hint under the room says what fingers do in this mode.)
  if (swapped && ready && !titleOn) refresh();
  for (const b of document.querySelectorAll('[data-cam]')) b.setAttribute('aria-pressed', String(b.dataset.cam === (mode === 'follow' ? 'follow' : 'room')));
}
function clampGoal() {
  const g = view.goal;
  // (The whole-room view may stand further back and look higher than the
  // limits: that room is kept until you have come in from it.)
  view.far = Math.max(LIMITS.dist[1], Math.min(view.far, g.dist));
  view.farY = Math.max(LIMITS.y[1], Math.min(view.farY, g.focus.y));
  g.dist = clamp(g.dist, LIMITS.dist[0], view.far);
  g.pitch = clamp(g.pitch, ...LIMITS.pitch);
  g.focus.x = clamp(g.focus.x, ...LIMITS.x);
  g.focus.y = clamp(g.focus.y, LIMITS.y[0], view.farY);
  g.focus.z = clamp(g.focus.z, ...LIMITS.z);
}
// Turn the view. The rooms are open at the front, so the turn runs from one
// side wall round to the other and no further: past the end it gives a
// little, like a rubber band, and springs back when you let go (`updateCamera`).
const TURN_MAX = 1.75, TURN_OVER = .16;
function turnBy(da) {
  if (!da) return;
  const g = view.goal, past = Math.abs(g.yaw) - TURN_MAX;
  if (past > 0 && da * g.yaw > 0) da *= .3 * Math.max(0, 1 - past / TURN_OVER);
  let to = g.yaw + da;
  if (Math.abs(to) > Math.abs(g.yaw)) to = Math.sign(to) * Math.min(Math.abs(to), Math.max(Math.abs(g.yaw), TURN_MAX + TURN_OVER));
  g.yaw = to;
}
// How the tilt changes with distance: the last few metres in drop the view
// to her level (the way a pet game frames her); further out it holds.
// (Used as a change, so each view keeps its own angle.)
const tiltFor = d => .12 + .16 * smoothstep(d, 1.1, 3.2);
function orbit(dx, dy) {
  if (view.mode === 'room') setCamMode('free');
  turnBy(-dx * .008);
  view.goal.pitch += dy * .006;
  view.lastDrag = clockNow;
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
// How long the camera's arm can be before it leaves the room.
function boxArm(focus, off, d) {
  for (const [k, [lo, hi]] of Object.entries(CAM_BOX)) {
    const o = off[k], f = focus[k];
    if (o > 1e-4 && f + o * d > hi) d = Math.min(d, (hi - f) / o);
    if (o < -1e-4 && f + o * d < lo) d = Math.min(d, (lo - f) / o);
  }
  return d;
}
// The point in the room under a screen position: on her if she is there,
// otherwise on the floor, kept inside the room (fingers over a wall aim at
// the floor at its foot, never into the wall). `onCat` says which.
const zoomPt = new THREE.Vector3();
let zoomOnCat = false;
function pointUnder(x, y) {
  const r = host.getBoundingClientRect();
  pointer.set((x - r.left) / r.width * 2 - 1, -(y - r.top) / r.height * 2 + 1);
  ray.setFromCamera(pointer, camera);
  const hit = ready && ray.intersectObjects(cat.meshes, false)[0];
  zoomOnCat = !!hit;
  if (hit) return zoomPt.copy(hit.point);
  // (Above the horizon there is no floor: straight in.)
  if (!ray.ray.intersectPlane(groundPlane, zoomPt) || zoomPt.distanceTo(camera.position) > 40) return null;
  zoomPt.x = clamp(zoomPt.x, LIMITS.x[0] + .4, LIMITS.x[1] - .4);
  zoomPt.z = clamp(zoomPt.z, LIMITS.z[0] + .4, LIMITS.z[1] - .4);
  return zoomPt;
}
// The thing under a screen position, for Explore: whatever is drawn there
// (furniture, a wall, a picture), else the floor. Looked up once per pinch
// or tap, not every frame: it tests the whole room.
const aimPt = new THREE.Vector3();
const drawn = o => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
function thingUnder(x, y) {
  const r = host.getBoundingClientRect();
  pointer.set((x - r.left) / r.width * 2 - 1, -(y - r.top) / r.height * 2 + 1);
  ray.setFromCamera(pointer, camera);
  const hit = ready && place.group && ray.intersectObject(place.group, true).find(h => h.distance < 40 && h.object.isMesh && drawn(h.object) && h.object.material?.blending !== THREE.AdditiveBlending && !(h.object.material?.transparent && h.object.material.opacity < .5));
  if (!hit) { const p = pointUnder(x, y); return p ? aimPt.copy(p) : null; }
  aimPt.copy(hit.point);
  aimPt.x = clamp(aimPt.x, LIMITS.x[0] - .2, LIMITS.x[1] + .2);
  aimPt.z = clamp(aimPt.z, LIMITS.z[0] - .2, LIMITS.z[1] + .2);
  aimPt.y = clamp(aimPt.y, LIMITS.y[0], LIMITS.y[1]);
  return aimPt;
}
// Zoom by a factor, towards the screen point `at` if given (the fingers, the
// mouse): that point stays under them. Zoom always starts from where the
// camera really is, so a wall or a piece of furniture holding it closer
// never leaves a stretch of pinching that does nothing.
const tiltAxis = new THREE.Vector3(), tiltV = new THREE.Vector3(), tiltQ = new THREE.Quaternion();
function zoomBy(f, at) {
  const g = view.goal;
  // Explore: in and out about the thing under the fingers; far out, the
  // whole room. Mochi: in and out about her. A pinch never changes the mode.
  if (clockNow - view.zoomedAt > .5) {
    view.push = 0;
    // (Decided once per pinch: the thing must not change as the view moves.)
    view.aim = at && view.mode !== 'follow' && !titleOn ? thingUnder(at.x, at.y)?.clone() ?? null : null;
  }
  if (view.mode === 'room') {
    view.zoomedAt = clockNow;
    view.push -= Math.log(f);
    if (f >= 1 || view.push < .06 || !ready) return;
    const from = Math.min(g.dist, view.shown, 8.5);
    setCamMode('free');
    g.dist = from; view.zoomHeld = true; view.push = 0;
  } else if (view.mode === 'spot' && view.aim && f < 1) {
    // (From the bowl, fountain or bed view: a pinch elsewhere goes there.)
    g.dist = Math.min(g.dist, view.shown);
    setCamMode('free');
  }
  // (Following her with the zoom left to the camera: start from what it chose.)
  // Squeezed against a wall, nearer than the nearest zoom: nothing closer to go to.
  if (f < 1 && view.shown < LIMITS.dist[0] && view.shown < view.dist - .02) { g.dist = LIMITS.dist[0]; view.zoomedAt = clockNow; return; }
  const base = view.mode === 'follow' && !view.zoomHeld ? view.auto : g.dist;
  // Held closer by a wall or furniture (not just still gliding to a view).
  const held = view.shown < view.dist - .02 && view.shown >= LIMITS.dist[0];
  const from = Math.max(LIMITS.dist[0], f < 1 && held ? Math.min(base, view.shown) : base);
  if (f < 1 && held && view.shown < g.dist) { view.dist = view.shown; view.cut = 0; }
  const reach = Math.max(from, boxArm(view.focus, camOffset, LIMITS.dist[1]));
  const to = clamp(Math.min(from * f, reach), LIMITS.dist[0], Math.max(LIMITS.dist[1], from));
  if (view.mode !== 'room' && view.mode !== 'follow' && f > 1) {
    if (to < from * f - 1e-3) view.push += Math.log(f);
    // (Crossing out past the room's edge, or a clear pinch against the
    // far end: a view already that far out, say the turned whole room, stays.)
    if (to > 9 && from <= 9 || view.push > .35) { view.push = 0; CAMERA_VIEWS.room(); view.zoomedAt = clockNow; return; }
  }
  const k = to / from;
  g.dist = to;
  // (Closer looks lower, further looks down over the room.)
  const dp = tiltFor(to) - tiltFor(from);
  view.lastDrag = view.zoomedAt = clockNow;
  view.zoomHeld = true;
  // (Only in a view of your own; her view and the bowl, fountain and bed views stay on their subject.)
  if (at && view.mode === 'free' && Math.abs(k - 1) > 1e-4) {
    const p = view.aim;
    if (p) {
      g.focus.sub(p).multiplyScalar(k).add(p);
      // (The tilt turns the camera about that spot, so it stays under the fingers.)
      if (dp) {
        tiltAxis.set(Math.cos(g.yaw), 0, -Math.sin(g.yaw));
        tiltQ.setFromAxisAngle(tiltAxis, -dp);
        tiltV.set(Math.sin(g.yaw) * Math.cos(g.pitch), Math.sin(g.pitch), Math.cos(g.yaw) * Math.cos(g.pitch)).applyQuaternion(tiltQ);
        if (Math.abs(Math.asin(clamp(tiltV.y, -1, 1)) - (g.pitch + dp)) > Math.abs(dp) * .5) tiltQ.setFromAxisAngle(tiltAxis, dp);
        g.focus.sub(p).applyQuaternion(tiltQ).add(p);
      }
    }
  }
  g.pitch += dp;
  clampGoal();
}
// Two quick taps in one place (not on her)?
let lastFloor = null;
function secondTap(x, y, ts) {
  const twice = lastFloor && ts - lastFloor.t < 340 && Math.hypot(x - lastFloor.x, y - lastFloor.y) < 40;
  lastFloor = twice ? null : {t: ts, x, y};
  return !!twice;
}
// Explore, a double tap: go close to that thing and make it the centre of
// the view. On the thing you are already close to: back to the whole room.
function goClose(x, y) {
  const p = thingUnder(x, y);
  if (!p) return;
  p.y = Math.max(p.y, .3);
  if (view.mode !== 'room' && view.shown < 4.5 && p.distanceTo(view.goal.focus) < .8) { CAMERA_VIEWS.room(); return; }
  const from = Math.min(view.goal.dist, view.shown);
  if (view.mode === 'room') setCamMode('free');
  view.goal.focus.copy(p);
  view.goal.dist = Math.max(LIMITS.dist[0], Math.min(from * .45, 4));
  view.goal.pitch += tiltFor(view.goal.dist) - tiltFor(from);
  setCamMode('free');
  view.zoomHeld = true;
  clampGoal();
}
// A tap on the bare floor. Mochi mode: she comes. (Explore: looking round
// the room does not move her about; two taps go closer, see `endGesture`.)
function floorTap(x, y) {
  if (view.mode === 'follow') callTo(x, y);
}
// A double tap on her in Explore: a close look at her, where she is now.
// (In Mochi mode quick pats stay pats.)
function doubleTap() {
  if (view.mode === 'follow') return;
  const fr = framing(false);
  view.goal.focus.copy(fr.center);
  view.goal.dist = clamp(fitDistance(fr.radius) * .45, LIMITS.dist[0], 6);
  setCamMode('free');
  view.zoomHeld = true;
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
let ROOM_CROP = +(new URLSearchParams(location.search).get('crop') ?? .6);
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
    if (dock?.height && (sheetMQ.matches || dock.top - box.top > H / 2)) bottom = dock.top - box.top - 10;
  }
  // On a phone held upright the room may run a little off the left and right
  // edges, so the camera comes closer and she is bigger (Merlin 2026-11-13:
  // "the cat more visible"); the spare height would otherwise be bare floor.
  const crop = sheetMQ.matches && W / Math.max(1, bottom) < .8 ? ROOM_CROP : 0;
  const L = -1 + 20 / W - crop, Rcams = right / W * 2 - 1 + crop, Redge = 1 - 14 / W + crop, B = 1 - bottom / H * 2, T = 1 - 16 / H;
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
      // (On a tall screen the spare height is shared above and below, so
      // the room sits in the middle and not under a screenful of wall.)
      f.y -= (B + Math.max(0, (T - B) - (y1 - y0)) / 2 - y0) * .9 * d * tanV / Math.cos(pitch);
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
    // (After turns round her, come back the short way.)
    const turns = Math.round((view.yaw - fit.yaw) / (Math.PI * 2)) * Math.PI * 2;
    view.yaw -= turns;
    Object.assign(view.goal, {yaw: fit.yaw, pitch: fit.pitch, dist: fit.dist});
    view.goal.focus.copy(fit.focus);
    view.far = fit.dist; view.farY = fit.focus.y;
    view.home = {yaw: fit.yaw, pitch: fit.pitch};
    setCamMode('room');
  },
  // (`yaw`: from where to look at her; left out, from where the camera is.
  // Never from beyond the ends of the turn.)
  follow(yaw) {
    Object.assign(view.goal, {dist: ready ? clamp(fitDistance(framing(false).radius), 2.6, 6) : tallScreen() ? 4.2 : 3.4, pitch: .26});
    view.goal.yaw = clamp(typeof yaw === 'number' ? yaw : Math.atan2(camera.position.x - brain.pos.x, camera.position.z - brain.pos.z), -TURN_MAX, TURN_MAX);
    setCamMode('follow');
  },
  food: () => lookAtSpot(bowl.position, {y: .15}),
  water: () => lookAtSpot(fountain.position, {y: .2}),
  bed: () => lookAtSpot(bed.position, {dist: 3, y: .3}),
};
// The mode you picked is kept for next time.
const CAM_PREF = 'mochi-cam';
const camPref = () => { try { return storage.getItem(CAM_PREF); } catch { return null; } };
// (After the title, or in a new room: back to her if that was your mode.
// Not while the first steps are being shown: they are framed for the room.)
// (2026-11-13: with no pick yet it is Mochi mode. In the whole-room view she
// is 7% of a phone screen; the app is about her.)
function keepCamMode() { if (camPref() !== 'explore' && !teachStep()) CAMERA_VIEWS.follow(view.goal.yaw); }
// The part of the picture not under the care buttons and the sheet (px from
// the top of the room's element), read at most twice a second.
let clearCache = {at: -1, bottom: 0, h: 1};
function clearArea() {
  if (clockNow - clearCache.at < .5 && clockNow >= clearCache.at) return clearCache;
  const H = Math.max(1, host.clientHeight), box = host.getBoundingClientRect();
  let bottom = H;
  if (!document.body.classList.contains('watch')) {
    const dock = $('.dock')?.getBoundingClientRect();
    if (dock?.height && (sheetMQ.matches || dock.top - box.top > H / 2)) bottom = clamp(dock.top - box.top, H / 2, H);
  }
  return clearCache = {at: clockNow, bottom, h: H};
}
// Is her head in the clear part of the picture?
function herInPicture() {
  const p = cat.headCenter(tmpV).project(camera), a = clearArea(), W = Math.max(1, host.clientWidth);
  const x = (p.x + 1) / 2 * W, y = (1 - p.y) / 2 * a.h;
  // (The view buttons run down the right edge on a phone.)
  return p.z < 1 && x > 24 && x < W - (sheetMQ.matches ? 64 : 24) && y > 40 && y < a.bottom - 10;
}
// A care button pressed while she is out of the picture (Explore does not
// follow her): look at her first. Still Explore; Mochi mode has her already.
function showHer() {
  if (view.mode === 'follow' || !ready || herInPicture()) return;
  lookAtSpot(brain.pos, {dist: 3.4, pitch: .3, y: brain.elevation + .7});
}
for (const b of document.querySelectorAll('[data-cam]')) b.addEventListener('click', () => {
  CAMERA_VIEWS[b.dataset.cam]();
  try { storage.setItem(CAM_PREF, view.mode === 'follow' ? 'mochi' : 'explore'); } catch {}
});

host.addEventListener('contextmenu', e => e.preventDefault());
host.addEventListener('wheel', e => {
  e.preventDefault();
  view.fling = null;
  zoomBy(Math.exp(e.deltaY * (e.ctrlKey ? .01 : .0012)), {x: e.clientX, y: e.clientY});
}, {passive: false});

host.addEventListener('pointerdown', e => {
  if (e.target.closest('button, .hud, .dock, dialog')) return;
  host.setPointerCapture(e.pointerId);
  // (A first finger: nothing can be left over from a touch that never ended.)
  if (e.isPrimary) { touches.clear(); pinch = null; }
  touches.set(e.pointerId, {x: e.clientX, y: e.clientY});
  view.fling = null;
  if (touches.size === 2) {
    // A second finger: switch from stroking/orbiting to pinch and pan.
    gesture = null;
    host.classList.remove('stroking', 'dragging');
    seedPinch();
    lastTap = null;
    return;
  }
  if (touches.size > 2) return;
  const r = trackPointer(e);
  const panning = e.button === 2 || e.shiftKey;
  const on = !panning && brain.mode !== 'play' ? catHit() : null, onCat = !!on;
  const onFountain = !panning && !onCat && brain.mode !== 'play' && hitsFountain();
  const onPerch = !panning && !onCat && !onFountain && brain.mode !== 'play' ? perchAt() : null;
  gesture = {x: e.clientX, y: e.clientY, lastX: e.clientX, lastY: e.clientY, moved: false, onCat, onFountain, onPerch, panning, stroke: 0, rect: r, t0: e.timeStamp, lastT: e.timeStamp, vx: 0, vy: 0, turning: false, zone: on ? zoneAt(on.point) : null, zoneT: e.timeStamp, petAt: -10, off: false};
  if (onCat) host.classList.add('stroking');
});
host.addEventListener('pointermove', e => {
  if (e.target.closest('.hud, .dock')) return;
  if (touches.has(e.pointerId)) touches.set(e.pointerId, {x: e.clientX, y: e.clientY});
  if (pinch && touches.size >= 2) {
    const [p1, p2] = [...touches.values()];
    const d = Math.hypot(p1.x - p2.x, p1.y - p2.y), mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
    if (d > 10 && pinch.d > 10) zoomBy(pinch.d / d, {x: mx, y: my});
    // Twisting the two fingers turns the view (once it is clearly a twist,
    // so a plain pinch stays straight).
    const a = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    let da = a - pinch.a;
    da -= Math.round(da / (Math.PI * 2)) * Math.PI * 2;
    let twist = pinch.twist;
    if (d > 60) {
      if (Math.abs(twist) < .14) { twist += da; da = Math.abs(twist) < .14 ? 0 : twist - Math.sign(twist) * .14; }
      if (da) { turnBy(da); view.lastDrag = clockNow; clampGoal(); }
    }
    // Explore: sliding both fingers moves the view (once it is clearly a
    // slide, so a plain pinch stays where it is).
    // (Measured from where the pinch began: fingers report one at a time,
    // so the spot between them jitters even in a straight pinch. Not from the
    // whole-room view: there a pinch comes in first.)
    // (Both fingers going the same way: one finger alone is a pinch.)
    const sx = pinch.sx ?? mx, sy = pinch.sy ?? my, d0 = pinch.d0 ?? d, went = Math.hypot(mx - sx, my - sy);
    const slide = pinch.slide || went > 22 && Math.abs(d - d0) < went * 1.5;
    if (slide && (view.mode === 'free' || view.mode === 'spot') && !titleOn) pan(mx - pinch.mx, my - pinch.my);
    pinch = {d, mx, my, a, twist, slide, sx, sy, d0};
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
    // Stroking: she feels the hand all the way along, and knows where it is.
    const step = Math.hypot(sx, sy);
    if (step > 1) {
      if (e.timeStamp - gesture.zoneT > 120) { const h = catHit(); gesture.zoneT = e.timeStamp; gesture.off = !h; if (h) gesture.zone = zoneAt(h.point); }
      const at = {x: e.clientX - gesture.rect.left, y: e.clientY - gesture.rect.top};
      if (!gesture.off) {
        gesture.stroke += step;
        if (['tail', 'paws'].includes(gesture.zone) && brain.activity !== 'belly') { if (gesture.stroke > 40) touchCat(gesture.zone, {at}); }
        else {
          if (!pet.sleeping) brain.strokeUntil = clockNow + .5;
          if (gesture.stroke > 70 && clockNow - gesture.petAt > .45) { gesture.stroke = 0; gesture.petAt = clockNow; touchCat(gesture.zone, {stroke: true, quiet: clockNow - lastPet < 6, at}); }
        }
      }
    }
  } else if (gesture.panning) {
    // (Right mouse button or shift: turn the view.)
    orbit(sx, sy);
    host.classList.add('dragging');
  } else if (brain.mode !== 'play' && gesture.moved) {
    // One finger turns the view about what it is looking at.
    orbit(sx, sy);
    host.classList.add('dragging');
    // (How fast the finger is going, for the glide after a flick.)
    const ms = Math.max(4, e.timeStamp - gesture.lastT), mix = Math.min(1, ms / 60);
    gesture.vx += (sx / ms * 1000 - gesture.vx) * mix;
    gesture.vy += (sy / ms * 1000 - gesture.vy) * mix;
    gesture.turning = true;
  }
  gesture.lastT = e.timeStamp;
  gesture.lastX = e.clientX; gesture.lastY = e.clientY;
});
let lastTap = null;
function endGesture(e) {
  touches.delete(e.pointerId);
  // (One of three fingers lifted: start again from the two that are left.)
  if (pinch && touches.size >= 2) { seedPinch(); return; }
  if (touches.size < 2 && pinch) {
    pinch = null;
    // One finger left down after a pinch: it carries on turning the view.
    const [rest] = [...touches.values()];
    if (rest && brain.mode !== 'play') gesture = {x: rest.x, y: rest.y, lastX: rest.x, lastY: rest.y, moved: true, stroke: 0, rect: host.getBoundingClientRect(), t0: e.timeStamp, lastT: e.timeStamp, vx: 0, vy: 0, turning: false};
    return;
  }
  if (gesture && !gesture.moved && gesture.onCat) {
    // Two quick taps in one place.
    if (lastTap && e.timeStamp - lastTap.t < 340 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 34) {
      lastTap = null;
      doubleTap();
      gesture = null;
      host.classList.remove('stroking', 'dragging');
      return;
    }
    lastTap = e.timeStamp - gesture.t0 < 320 ? {t: e.timeStamp, x: e.clientX, y: e.clientY} : null;
  } else lastTap = null;
  // Let go mid-flick: the view glides on and settles.
  if (gesture?.turning && e.timeStamp - gesture.lastT < 90 && Math.hypot(gesture.vx, gesture.vy) > 260) view.fling = {vx: clamp(gesture.vx, -800, 800), vy: clamp(gesture.vy * .5, -400, 400)};
  // Explore: two quick taps on a thing go close to it.
  if (gesture && !gesture.moved && !gesture.onCat && !gesture.panning && brain.mode !== 'play' && e.timeStamp - gesture.t0 < 400 && view.mode !== 'follow' && secondTap(e.clientX, e.clientY, e.timeStamp)) {
    goClose(e.clientX, e.clientY);
    gesture = null;
    host.classList.remove('stroking', 'dragging');
    return;
  }
  // (Explore: a tap on the fountain or a perch waits a moment, in case a
  // second tap makes it a look closer; then it does what it always did.)
  if (gesture && !gesture.moved && (gesture.onPerch || gesture.onFountain) && view.mode !== 'follow' && lastFloor && e.timeStamp - gesture.t0 < 400) {
    const tap = lastFloor, g = gesture, px = e.clientX - g.rect.left, py = e.clientY - g.rect.top;
    later(.34, () => {
      if (lastFloor !== tap) return;
      lastFloor = null;
      if (g.onFountain) { if (pet.sleeping) toast('Shh… wake your kitten first.'); else act('drink'); }
      else { pawAt(px, py); invite(g.onPerch); }
    });
    gesture = null;
    host.classList.remove('stroking', 'dragging');
    return;
  }
  // A tap on her ball: play.
  if (gesture && !gesture.moved && !gesture.onCat && !gesture.onFountain && !gesture.onPerch && !gesture.panning && brain.mode !== 'play' && e.timeStamp - gesture.t0 < 400 && (setPointer(e), hitsToy())) {
    if (pet.sleeping) toast('Shh… wake your kitten first.'); else act('play');
    gesture = null;
    host.classList.remove('stroking', 'dragging');
    return;
  }
  if (gesture && !gesture.moved && gesture.onFountain) {
    if (pet.sleeping) toast('Shh… wake your kitten first.');
    else act('drink');
  }
  if (gesture && !gesture.moved && gesture.onPerch) { pawAt(e.clientX - gesture.rect.left, e.clientY - gesture.rect.top); invite(gesture.onPerch); }
  if (gesture && !gesture.moved && gesture.onCat) touchCat(gesture.zone, {at: {x: e.clientX - gesture.rect.left, y: e.clientY - gesture.rect.top}});
  // A tap on the bare floor calls her there; two quick taps go closer to that spot instead.
  if (gesture && !gesture.moved && !gesture.onCat && !gesture.onFountain && !gesture.onPerch && !gesture.panning && e.timeStamp - gesture.t0 < 400 && brain.mode !== 'play') floorTap(e.clientX, e.clientY);
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
  if (a === 'brush' || a === 'pet' || a === 'play') showHer();
  if (a === 'feed') {
    if (brain.mode !== 'idle') { toast('One thing at a time — almost done!'); return; }
    $('#feed-dialog').showModal();
  } else if (a === 'play' && brain.mode === 'idle' && pet.energy >= 15 && toysAt(levelInfo(pet.bond).level, pet.gifts).length > 1) openToys();
  else act(a);
});
// The toy basket: shown on Play once she has more than the ball.
function openToys() {
  const now = toyChoice(), box = $('#toy-options');
  box.replaceChildren();
  for (const t of toysAt(levelInfo(pet.bond).level, pet.gifts)) {
    const b = document.createElement('button');
    b.dataset.toy = t.id;
    b.style.setProperty('--tint', `var(${t.tint})`);
    b.setAttribute('aria-pressed', String(t.id === now));
    b.innerHTML = `<span>${icon(t.id === 'fish' ? 'i-fish' : t.id === 'mouse' ? 'i-paw' : 'i-yarn')}</span><strong></strong><small></small>`;
    b.querySelector('strong').textContent = t.name;
    b.querySelector('small').textContent = t.note;
    box.append(b);
  }
  $('#toy-dialog').showModal();
}
$('#toy-options').addEventListener('click', e => {
  const b = e.target.closest('[data-toy]');
  if (!b) return;
  $('#toy-dialog').close();
  pet.toy = b.dataset.toy; save(); useToy();
  act('play');
});
// A photo of the room as it is now, without the buttons: her name and the
// date at the foot, then Share or Save.
let photoBusy = false, photoUrl = null;
async function takePhoto() {
  if (!ready || titleOn || photoBusy) return;
  photoBusy = true;
  try {
    // (Drawn and copied in one go: the picture is gone once the browser has shown it.)
    renderer.render(scene, camera);
    const src = renderer.domElement, r = src.getBoundingClientRect(), k = src.width / Math.max(1, r.width);
    // On a phone the care buttons and the sheet cover the foot of the room: stop above them.
    let h = src.height;
    if (sheetMQ.matches && !document.body.classList.contains('watch')) h = Math.round(clamp(($('.dock').getBoundingClientRect().top - r.top - 8) * k, src.height * .5, src.height));
    const c = document.createElement('canvas');
    c.width = src.width; c.height = h;
    const g = c.getContext('2d'), u = c.width / 100;
    g.fillStyle = night ? '#1c1612' : '#f7f1ea'; g.fillRect(0, 0, c.width, h);
    g.drawImage(src, 0, 0, src.width, h, 0, 0, src.width, h);
    const shade = g.createLinearGradient(0, h - 16 * u, 0, h);
    shade.addColorStop(0, 'rgba(24, 16, 10, 0)'); shade.addColorStop(1, 'rgba(24, 16, 10, .5)');
    g.fillStyle = shade; g.fillRect(0, h - 16 * u, c.width, 16 * u);
    const font = getComputedStyle(document.body).fontFamily;
    g.fillStyle = '#fff'; g.textBaseline = 'alphabetic';
    g.font = `800 ${4.6 * u}px ${font}`; g.fillText(pet.name, 4 * u, h - 7.4 * u);
    g.font = `600 ${2.9 * u}px ${font}`; g.globalAlpha = .9;
    g.fillText(`Pocket Kitten · ${new Date().toLocaleDateString(undefined, {day: 'numeric', month: 'long', year: 'numeric'})}`, 4 * u, h - 3.4 * u);
    g.globalAlpha = 1;
    const flash = $('#photo-flash');
    flash.classList.remove('on'); void flash.offsetWidth; flash.classList.add('on');
    const blob = await new Promise(done => c.toBlob(done, 'image/jpeg', .92));
    if (!blob) { toast('The photo didn’t come out. Try once more.'); return; }
    const d = new Date(), name = `${pet.name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'kitten'}-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.jpg`;
    const file = new File([blob], name, {type: 'image/jpeg'});
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    photoUrl = URL.createObjectURL(blob);
    $('#photo-img').src = photoUrl;
    $('#photo-save').href = photoUrl; $('#photo-save').download = name;
    let can = false;
    try { can = !!navigator.canShare?.({files: [file]}); } catch {}
    $('#photo-share').hidden = !can;
    $('#photo-share').onclick = () => navigator.share({files: [file], title: `${pet.name} · Pocket Kitten`}).catch(() => {});
    document.querySelectorAll('.pet-name-slot').forEach(el => el.textContent = pet.name);
    $('#photo-dialog').showModal();
    pet.photos = (Number.isFinite(pet.photos) ? pet.photos : 0) + 1;
    if (pet.photos === 1) moment(`The first photo of ${pet.name}.`, 'i-sparkle'); else save();
    // For the frame on the study wall: this photo, small, cut to the frame.
    $('#photo-hang').textContent = 'Hang it on the wall'; $('#photo-hang').disabled = false;
    $('#photo-hang').onclick = () => {
      const f = document.createElement('canvas');
      f.width = 480; f.height = 600;
      const k = Math.max(f.width / c.width, f.height / c.height), w = c.width * k, hh = c.height * k;
      f.getContext('2d').drawImage(c, (f.width - w) / 2, (f.height - hh) / 2, w, hh);
      const url = f.toDataURL('image/jpeg', .82);
      try { storage.setItem(FRAME_KEY, url); } catch { toast('The picture could not be kept on this phone.'); return; }
      frameImage = f;
      $('#photo-hang').textContent = 'On the wall, over the fire'; $('#photo-hang').disabled = true;
      moment(`A photo of ${pet.name} hangs over the fire.`, 'i-sparkle');
      refresh();
    };
    wishCheck({action: 'photo'}); refresh();
    if (params.has('debug')) window.kitten.photo = {w: c.width, h, bytes: blob.size, name};
  } finally { photoBusy = false; }
}
$('#photo-btn').onclick = takePhoto;
// Her wish of the day: a tap on it and she says it again, with what to do.
$('#wish').onclick = () => { const w = wishNow(); if (!w) return; if (ready && !pet.sleeping) say(w.want, 4200, true); toast(w.how); };
// The ribbon's colour (in the name card, once she has the collar).
for (const r of RIBBONS) {
  const b = document.createElement('button');
  b.type = 'button'; b.dataset.ribbon = r.id; b.style.setProperty('--ribbon', r.color);
  b.ariaLabel = b.title = r.name; b.setAttribute('aria-pressed', 'false');
  $('#ribbon-options').append(b);
}
$('#ribbon-options').addEventListener('click', e => {
  const b = e.target.closest('[data-ribbon]');
  if (!b) return;
  pet.collar = b.dataset.ribbon; save(); refresh();
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
const DECOR_SWATCHES = {classic: ['#3f472b', '#1e2536', '#5a3a22', '#e6dcc0'], thanksgiving: ['#d8cbb3', '#96a380', '#e0995e', '#b58a3c'], halloween: ['#d98b45', '#38332f', '#455d7a', '#efe5d2'], christmas: ['#2d4a27', '#7c1426', '#e9d6a6', '#efe7d6']};
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
  const withHer = view.mode === 'follow';
  CAMERA_VIEWS.room();
  view.focus.copy(view.goal.focus);
  Object.assign(view, {yaw: view.goal.yaw, pitch: view.goal.pitch, dist: view.goal.dist, cut: 0, lift: 0});
  // (In Mochi mode the new room opens on her too.)
  if (withHer) CAMERA_VIEWS.follow(view.goal.yaw);
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
  // (Cards waiting for the kitten that was here are not for this one.)
  news.length = 0; awayQueued = giftsQueued = false;
  ensureTaught();
  save();
  refresh(); renderJournal();
  // (Her sound settings came with her.)
  sounds.setEnabled(pet.sound); sounds.setVolume('cat', pet.catVolume); sounds.setVolume('music', pet.musicVolume); syncMusic();
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
  syncMusic();
  refresh(); save();
  if (pet.sound) { meow('mew'); twitchEar(0); twitchEar(1); }
};
$('#tunes').innerHTML = [['', 'Off'], ...Object.entries(TUNES).map(([k, t]) => [k, t.name])].map(([k, name]) => `<button type="button" role="radio" data-tune="${k}" aria-checked="${k === (TUNES[pet.music] ? pet.music : '')}">${name}</button>`).join('');
$('#tunes').onclick = e => {
  const b = e.target.closest('button'); if (!b) return;
  pet.music = b.dataset.tune;
  refresh(); save(); syncMusic();
};
for (const [id, kind, key] of [['#vol-cat', 'cat', 'catVolume'], ['#vol-music', 'music', 'musicVolume']]) {
  $(id).oninput = e => { pet[key] = +e.target.value; sounds.setVolume(kind, pet[key]); };
  $(id).onchange = () => { save(); if (kind === 'cat' && pet.sound) meow('mew'); };
}
$('#log-switch').onclick = () => {
  const toGuide = $('#guide').hidden;
  $('#guide').hidden = !toGuide;
  $('#journal-wrap').hidden = toGuide;
  $('#log-title').firstChild.textContent = toGuide ? 'Care guide ' : 'Moments ';
  $('#journal-count').hidden = toGuide;
  $('#log-switch').innerHTML = toGuide ? '<span aria-hidden="true">‹</span> Moments' : 'Care guide <span aria-hidden="true">›</span>';
};
$('#journal-more').onclick = () => { journalAll = !journalAll; renderJournal(); };
// The Needs card's button does what the dock would: it brings the room back
// into view first, since play and the fountain happen there.
$('#stats').addEventListener('click', e => {
  const b = e.target.closest('.need-btn');
  const n = b && NEEDS.find(x => x.key === b.dataset.need);
  if (!n) return;
  sheetOpen(false);
  $('.stage').scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start'});
  if (n.cam) $(`[data-cam="${n.cam}"]`).click();
  else $(`.dock [data-action="${n.act}"]`).click();
});
for (const d of document.querySelectorAll('dialog')) {
  d.addEventListener('click', e => {
    if (e.target !== d) return;
    const r = d.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close();
  });
}

let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  advance(pet); refresh(); save(); syncMusic();
  if (document.hidden) hiddenAt = Date.now();
  else {
    if (!titleOn && Date.now() - hiddenAt > 45000) greet();
    if (hiddenAt && Date.now() - hiddenAt >= AWAY_MIN) { pet.away = {from: hiddenAt, to: Date.now(), asleep: pet.sleeping}; save(); setTimeout(pumpNews, 2600); }
  }
});
window.addEventListener('pagehide', save);
setInterval(() => { advance(pet); refresh(); save(); }, 15000);
refresh();
renderJournal();

// Why the Runway film did not play, when it did not: kept from one open to
// the next and shown after the build number on the preview, so someone
// testing on a phone can read it out (a film that gives way to the sequence
// does so without a word).
let buildText = '', buildPreview = false;
function showFilmNote() {
  let note = ''; try { note = localStorage.getItem('pk-film-note') || ''; } catch {}
  if (buildText && buildPreview) $('#build-label').textContent = buildText + (note ? ' · film: ' + note : '');
}
function noteFilm(why) { try { localStorage.setItem('pk-film-note', why + ' (' + new Date().toTimeString().slice(0, 5) + ')'); } catch {} showFilmNote(); }
// Build label: version.json is written by the site's deploy workflow (build
// number = commits on the branch, plus the commit itself). Preview builds
// show it at the top so reviewers can match what they see to a review pack.
fetch('./version.json', {cache: 'no-store'}).then(r => r.ok ? r.json() : null).then(v => {
  if (!v) return;
  const text = `${v.channel === 'preview' ? 'Preview' : 'Version'} build ${v.build} · ${v.commit}`;
  $('#build-label').textContent = text;
  buildText = text; buildPreview = v.channel === 'preview'; showFilmNote();
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
  // (While the title screen shrinks to the room's card the picture is only
  // stretched to fit; it is redrawn at its real size once it gets there.)
  if (titleFlip) return;
  renderer?.setSize(w, h);
  titleFx?.setSize(w, h);
  if (titleOn && !titleLeaving) titleView();
  if (view.mode === 'room') CAMERA_VIEWS.room();
}
new ResizeObserver(resize).observe(host);
resize();
CAMERA_VIEWS.room();
view.focus.copy(view.goal.focus);

// ---------------------------------------------------------------------------
// Title screen. Two kinds:
//   full   every launch (Merlin, 2026-11-13): one "Enter" tap (so sound may play),
//          the zoomies cinematic (about 8 s: SHOTS and CUES below), then her
//          name over the room and "Tap to start". A tap skips the sequence
//          at any moment.
//   still  reduced motion, or she was put to bed: she
//          sleeps under her name; a tap wakes her (or you tiptoe in).
// Either way the camera then glides out to the room and the screen shrinks
// to its card. ?intro=short forces the still one.
// ---------------------------------------------------------------------------
const introParam = new URLSearchParams(location.search).get('intro');
// Asleep, and the film would play: the film is her waking up, so opening
// the app wakes her (Merlin, 2026-11-14: put to bed every night, she was
// found asleep every morning and the film was never seen). Where there is
// no film (a seasonal look, a wide screen, the first Mochi, reduced motion)
// she sleeps on behind the still title, as before.
// (Every look, Merlin 2026-11-14: in a seasonal look the plain-room film
// fades into the decorated room.)
const filmFits = () => LONGHAIR && tallScreen() && new URLSearchParams(location.search).get('film') !== '0';
if (pet.sleeping && titleOn && renderer && !reduceMotion && introParam !== 'short' && filmFits()) {
  pet.sleeping = false;
  moment('Woke up when you came in.', 'i-sun');
  save(); refresh();
}
const titleFull = titleOn && !!renderer && !reduceMotion && !pet.sleeping && introParam !== 'short';
let titleLiveAt = 0;
// The opening film (assets/title/mochi-opening-v4.mp4): in place of the zoomies
// sequence when the room looks like the film does: the plain study, the
// long-haired Mochi, an upright screen. By night too (Merlin, 2026-11-13:
// evening players should see it; the sunny film then fades into the night
// room). ?film=0 keeps the sequence.
// (A new film gets a new file name, so no phone keeps playing an old one.)
const FILM_SRC = './assets/title/mochi-opening-v4.mp4';
const filmOK = () => titleFull && filmFits();
let film = null;
function titleView() {
  if (titleStage === 'live') {
    // Her sitting on the rug, the window and its light behind her.
    Object.assign(view.goal, {yaw: .42, pitch: .1, dist: tallScreen() ? 4.6 : 3.8});
    view.goal.focus.set(HOME.x, tallScreen() ? 1.35 : .85, HOME.z);
    setCamMode('spot');
  } else lookAtSpot(bed.position, {dist: TITLE_CAM.dist, pitch: TITLE_CAM.pitch, y: TITLE_CAM.y});
  view.titleYaw = view.goal.yaw;
}
function titleSnap() {
  view.focus.copy(view.goal.focus);
  Object.assign(view, {yaw: view.goal.yaw, pitch: view.goal.pitch, dist: view.goal.dist, cut: 0, lift: 0});
}
if (titleOn) {
  titleView();
  titleSnap();
  document.querySelectorAll('.topbar, .panel, footer').forEach(el => el.inert = true);
  const el = $('#title');
  if (titleFull) el.classList.add('full');
  for (const ev of ['pointerdown', 'pointermove', 'pointerup', 'wheel', 'contextmenu']) el.addEventListener(ev, e => e.stopPropagation());
  el.addEventListener('click', titleTap);
  // "Enter with sound" turns sound on for good; without, the save is left as it is.
  $('#enter-sound').onclick = e => { e.stopPropagation(); pet.sound = true; sounds.setEnabled(true); refresh(); save(); startOpening(true); };
  $('#enter-mute').onclick = e => { e.stopPropagation(); startOpening(false); };
  document.addEventListener('keydown', e => { if ((titleStage === 'cine' || titleStage === 'film') && !e.repeat && ['Escape', 'Enter', ' '].includes(e.key)) { e.preventDefault(); titleTap(); } });
}
function titleTap() {
  if (titleStage === 'cine') { if (cine.T > .4) endCine(true); }
  else if (titleStage === 'film') { if (clockNow - film.at > .4) endFilm(); }
  else if (titleStage === 'live') { if (clockNow - titleLiveAt > .7) leaveTitle(); }
  else if (titleStage === 'still') leaveTitle();
}
// The title's own picture (title-fx.js): glow, sun shafts, dust. Only while
// the title is up; without it the plain renderer draws.
function startTitleFx() {
  if (!renderer || titleFx) return;
  // (?fx=0: the title with the plain picture, to tell an effects fault from any other.)
  if (new URLSearchParams(location.search).get('fx') === '0') return;
  const w = room.windowGroup;
  try {
    titleFx = new TitleFx(renderer, scene, camera, {parent: room.group, night, mobile: matchMedia('(pointer: coarse)').matches, patch: room.sunPatch,
      win: {x: w.position.x, z: w.position.z + .06, w: 2.3, y0: room.glassBottom, y1: room.glassBottom + room.glassH}});
    titleFx.fixed = manual;
  } catch (e) { console.warn('Title effects unavailable:', e); titleFx = null; }
}
function titleReady() {
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  $('#title-load').hidden = true;
  startTitleFx();
  if (titleFull) {
    titleStage = 'gate';
    $('#title').classList.add('gate');
    $('#title-gate').hidden = false;
    $('#enter-sound').focus({preventScroll: true});
    // The film starts coming in behind the Enter screen (she is home by
    // now), so a tap plays it at once. Fetched only after the tap, it often
    // missed its wait on a phone and the sequence played in its place.
    if (filmOK() && !(navigator.connection && navigator.connection.saveData)) setTimeout(() => {
      const v = $('#title-film');
      if (titleStage !== 'gate' || !v || v.getAttribute('src')) return;
      v.preload = 'auto'; v.src = FILM_SRC;
      try { v.load(); } catch {}
    }, 1200);
    return;
  }
  titleStage = 'still';
  // (For the footer on the preview: why the quiet title, not the film.)
  noteFilm('quiet title: ' + [reduceMotion && 'Reduce Motion is on', pet.sleeping && 'asleep', introParam === 'short' && 'intro=short', !renderer && 'no 3D'].filter(Boolean).join(', ') + '; look "' + room.decor + '", screen ' + camera.aspect.toFixed(2) + (LONGHAIR ? '' : ', first Mochi'));
  $('#title-sub').textContent = 'is fast asleep';
  $('#title-go').textContent = pet.sleeping ? (fine ? 'Click to tiptoe in' : 'Tap to tiptoe in') : (fine ? 'Click to wake her' : 'Tap to wake her');
  $('#title-go').hidden = false;
  $('#title').classList.add('lit');
  $('#title-go').focus({preventScroll: true});
  brain.nextZ = clockNow + 1.2;
}
// (Instead of idleLife while the title is up: asleep she only dreams; after
// the sequence she sits and looks about.)
function titleLife(t) {
  if (titleFx && titleFx.night !== night) titleFx.setNight(night);
  titleToyLife(t);
  if (titleLeaving || titleStage === 'cine' || titleStage === 'film') return;
  if (!reduceMotion) view.goal.yaw = view.titleYaw + Math.sin(t * .22) * .09;
  if (titleStage === 'live') {
    if (t < brain.nextIdle) return;
    brain.nextIdle = t + rand(2.4, 4.2);
    const r = Math.random(), toys = (titleToys || []).filter(o => o.userData.born != null && t > o.userData.born + .6), yarn = toys.find(o => o.userData.rolls);
    // The yarn ball rolls a little way and back, and her eyes go with it; or she looks at one of her toys.
    if (yarn && r < .26) { yarn.userData.roll = t; brain.glance = yarn.userData.eye.copy(yarn.position); brain.glanceUntil = t + 2.8; brain.nextIdle = t + 4; }
    else if (toys.length && r < .4) glanceAt(pick(toys).position, 1.7);
    else if (r < .5) glanceAt(new THREE.Vector3(rand(-3, 3), rand(.4, 2.6), rand(-2.5, 3)), rand(1.2, 2.2));
    else if (r < .7) slowBlink(); else if (r < .85) twitchEar(); else glanceAt(camera.position, 2);
  } else if (titleStage === 'still' && t > brain.nextZ) { brain.nextZ = t + rand(2.2, 3.4); burst('z', 1); }
}

// A few of her toys on the rug beside her, in the living title only (Meshy
// models, see CREDITS.md). Fetched while the sequence plays, shown when her
// name comes in, put away when the game starts.
// at: [to the right on screen, toward the camera], from where she sits.
const TITLE_TOYS = [
  {file: 'yarn-ball', size: .3, at: [-.64, .1], turn: 2.4, rolls: true},
  {file: 'felt-mouse', size: .3, at: [.56, .08], turn: -2.2},
  {file: 'fabric-fish', size: .36, at: [.9, -.5], turn: .9},
];
async function loadTitleToys() {
  if (titleToys) return;
  titleToys = [];
  const loader = new GLTFLoader();
  // (The toys are packed small; this unpacks them. Fetched only here.)
  try { loader.setMeshoptDecoder((await import('./vendor/meshopt_decoder.module.js')).MeshoptDecoder); } catch { return; }
  if (!titleOn || !titleToys || titleLeaving) return;
  TITLE_TOYS.forEach((d, i) => loader.load(`./assets/models/${d.file}.glb`, g => {
    if (!titleOn || !titleToys || titleLeaving) return;
    const o = g.scene, box = new THREE.Box3().setFromObject(o), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    const k = d.size / Math.max(size.x, size.y, size.z), holder = new THREE.Group();
    o.scale.setScalar(k); o.position.copy(c).multiplyScalar(-k);
    o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    holder.add(o);
    holder.visible = false;
    holder.userData = {...d, i, half: size.y * k / 2, born: null, eye: new THREE.Vector3(), home: new THREE.Vector3(), turn0: new THREE.Quaternion(), roll: null};
    scene.add(holder);
    titleToys.push(holder);
    if (titleStage === 'live') placeTitleToy(holder, .2);
    else if (titleStage === 'film' && film?.rolling) placeTitleToy(holder, -1);
  }, undefined, () => {}));
}
// Beside her on the rug, as the title's camera sees it.
function placeTitleToy(o, wait) {
  const u = o.userData, a = view.titleYaw, cos = Math.cos(a), sin = Math.sin(a);
  u.side = new THREE.Vector3(cos, 0, -sin);
  u.home.set(HOME.x + u.at[0] * cos + u.at[1] * sin, u.half + .012, HOME.z - u.at[0] * sin + u.at[1] * cos);
  o.position.copy(u.home);
  o.rotation.set(0, a + u.turn, 0);
  u.turn0.copy(o.quaternion);
  o.scale.setScalar(.001);
  o.visible = true;
  u.born = clockNow + wait;
}
const toyRoll = new THREE.Quaternion(), toyAxis = new THREE.Vector3();
function titleToyLife(t) {
  for (const o of titleToys || []) {
    const u = o.userData;
    if (u.born == null) continue;
    // (They pop in with a little overshoot, and shrink away as the game starts.)
    const p = clamp((t - u.born) / .55, 0, 1), out = titleToysOut == null ? 1 : 1 - clamp((t - titleToysOut) / .35, 0, 1);
    o.scale.setScalar(Math.max(.001, (1 + 2.7 * (p - 1) ** 3 + 1.7 * (p - 1) ** 2) * out));
    if (u.roll != null) {
      const q = clamp((t - u.roll) / 2.8, 0, 1), d = -Math.sin(q * Math.PI) * .26;
      o.position.copy(u.home).addScaledVector(u.side, d);
      u.eye.copy(o.position);
      o.quaternion.copy(toyRoll.setFromAxisAngle(toyAxis.set(u.side.z, 0, -u.side.x), d / u.half)).multiply(u.turn0);
      if (q >= 1) u.roll = null;
    }
  }
}
function clearTitleToys() {
  for (const o of titleToys || []) {
    scene.remove(o);
    o.traverse(m => { if (m.isMesh) { m.geometry.dispose(); for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap']) m.material[k]?.dispose(); m.material.dispose(); } });
  }
  titleToys = null;
}

// --- The zoomies cinematic -------------------------------------------------
// A story clock (cine.T, in real seconds) runs the shots: each is a camera
// placement plus things she can already do, set off by direct calls.
// Slow motion is the game clock running slow (timeRate).
const cineTo = new THREE.Vector3(), cineLook = new THREE.Vector3();
// The shots: when each starts, and its camera (k: seconds into the shot;
// fills the camera's place p and what it looks at l; returns the lens angle).
const SHOTS = [
  // 1. Close on her face, asleep in her bed. Her eyes snap open.
  {at: 0, cam(k, p, l) {
    cat.headCenter(l);
    const a = brain.heading + .5, d = (k < .72 ? lerp(1.9, 1.75, k / .72) : 1.5) * (tallScreen() ? 1.5 : 1);
    p.set(l.x + Math.sin(a) * d, l.y + .2, l.z + Math.cos(a) * d);
    return 30;
  }},
  // 2. Low on the floor: she gallops across the rug, past the camera.
  {at: 1.3, aim: 14, cam(k, p, l) { p.set(.6, .25, 4.6); l.set(brain.pos.x + .2, .55, brain.pos.z); return tallScreen() ? 46 : 38; }},
  // 3. She leaps to the mantel; the camera whips up after her.
  {at: 3.05, aim: 9, cam(k, p, l) { p.set(.3, .9, 3.4); l.set(brain.pos.x, brain.elevation + .55, brain.pos.z); return 48; }},
  // 4. Up on the mantel, slow motion: a paw pats the vase, and it wobbles.
  {at: 4.5, cam(k, p, l) { p.set(.2 + k * .15, 3.3, .5); l.set(4.3, 3.25, .5); return tallScreen() ? 44 : 25; }},
  // 5. She pounces at the camera. Freeze, flash.
  {at: 6.3, aim: 12, cam(k, p, l) { p.set(1, 2.5, 1); cat.headCenter(l); return 54; }},
];
// What happens when (seconds on the story clock).
const swatNow = () => setActivity('swat', SWAT, () => setActivity('sit', 9));
const CUES = [
  [.72, () => { express('surprised', .5); Object.assign(brain.face, {open: 1, pupil: .35}); twitchEar(0, 1.5); twitchEar(1, 1.5); }],
  // (Up on her feet before the cut, so the gallop starts in full stride.)
  [1, () => { express('excited', 8); setActivity('poise', 2); }],
  [1.3, () => {
    Object.assign(brain, {heading: 1.4, elevation: 0, speed: 2.9, run: 2.9, target: new THREE.Vector3(3.5, 0, .92), faceAt: null});
    brain.pos.set(-3.3, 0, -.3);
    setActivity('walk', 9);
    $('#title').classList.add('streak');
    // (A running leap: no crouch first.)
    const M = PERCHES.mantel;
    cine.watch = () => { if (brain.pos.x > 2.7) { cine.watch = null; cineJump(M.spot, M.top, 'mantel'); } };
  }],
  [3.05, () => $('#title').classList.remove('streak')],
  [4.5, () => {
    cine.hold = angleTo(brain.pos, cine.vase);
    brain.swatAt = cine.vase.clone().setY(cine.vase.y + .3);
    glanceAt(brain.swatAt, 3); express('curious', 3); setActivity('sit', 9);
  }],
  [4.7, swatNow],
  [5.15, swatNow],
  [5.25, () => { timeRate = .28; }],
  [5.6, () => { room.wobbleVase(clockNow); express('surprised', 2); }],
  [6.05, () => { timeRate = 1; }],
  [6.3, () => {
    const to = new THREE.Vector3(1.25, 0, 1);
    timeRate = 1; cine.hold = null;
    brain.heading = brain.jumpFace = angleTo(brain.pos, to);
    express('excited', 4); glanceAt(camera.position, 2);
    setActivity('prejump', .3, () => {
      cineJump(to, .3, null);
      // Nearly on the camera: time all but stops, and the screen goes white.
      cine.watch = () => { const J = brain.jump; if (!J || (clockNow - J.start) / J.dur > .66) { cine.watch = null; timeRate = .05; cine.flashAt = cine.T; $('#title').classList.add('flash'); } };
    });
  }],
];
function cineJump(to, toY, perch) {
  brain.target = null; brain.climbGoal = null;
  brain.jump = {from: brain.pos.clone(), fromY: brain.elevation, to: to.clone(), toY, perch, fromPerch: brain.perch, then: () => setActivity('sit', 9), start: clockNow, ...jumpArc(toY - brain.elevation, Math.hypot(to.x - brain.pos.x, to.z - brain.pos.z)), out: 0};
  setActivity('jump');
}
function startOpening(withSound) {
  if (filmOK()) return startFilm(withSound);
  noteFilm('not tried: ' + (!LONGHAIR ? 'first Mochi' : !tallScreen() ? 'wide screen ' + camera.aspect.toFixed(2) : 'switched off'));
  startCine();
}
// The film plays over the room. Under it the room is already set as the
// film's last picture (she sits at HOME, her toys beside her), so the film
// can fade straight into it. A film that will not start, or has not started
// after 3 seconds, gives way to the zoomies sequence.
function startFilm(withSound) {
  if (titleStage !== 'gate') return;
  const el = $('#title'), v = $('#title-film');
  titleStage = 'film';
  el.classList.remove('gate');
  el.classList.add('film', 'lit', 'soft');
  $('#title-gate').hidden = true;
  film = {at: clockNow, rolling: false, watch: 0};
  const fail = why => {
    if (titleStage !== 'film' || film.rolling) return;
    const e = v.error;
    noteFilm('gave way, ' + (typeof why === 'string' ? why : 'play refused: ' + (why && why.name || '?')) + (e ? ', error ' + e.code + ' ' + (e.message || '') : '') + ', ready ' + v.readyState + ', net ' + v.networkState + ', ' + ((clockNow - film.at) || 0).toFixed(1) + ' s');
    stopFilm();
    el.classList.remove('film', 'soft');
    (titleToys || []).forEach(o => { o.visible = false; o.userData.born = null; });
    titleStage = 'gate';
    startCine();
  };
  const wait = +new URLSearchParams(location.search).get('filmwait') || 0;
  v.onplaying = () => {
    if (titleStage !== 'film' || film.rolling) return;
    film.rolling = true;
    noteFilm('played');
    clearTimeout(film.watch);
    el.classList.add('rolling');
    // Under the film the room becomes its last picture. (Only now: if the
    // film never starts, the sequence finds her where she was.)
    titleSnap();
    brain.pos.copy(HOME); brain.elevation = 0; brain.heading = view.goal.yaw - .3;
    setActivity('sit');
    brain.nextBlink = clockNow + 30;
    (titleToys || []).forEach(o => placeTitleToy(o, -1));
    // A film that stalls, breaks or is paused by the phone ends at once;
    // and whatever happens it is over a little after its length.
    film.watch = setTimeout(endFilm, Math.max(25000, wait));
  };
  v.onended = endFilm;
  v.onpause = () => { if (film?.rolling && !v.ended) endFilm(); };
  v.onerror = () => film.rolling ? endFilm() : fail('the film broke');
  // (Its music only with "Enter with sound", whatever the save says.)
  v.muted = !withSound;
  // (Already coming in since the Enter screen: setting it again would start over.)
  if (!v.getAttribute('src')) v.src = FILM_SRC;
  // (A phone may refuse a film with sound: then it plays without.)
  try { v.play()?.catch(() => { v.muted = true; v.play()?.catch(fail); }); } catch (err) { fail(err); }
  // (?filmwait=ms: a longer wait, for the slow test machine. Three seconds
  // proved too short on a phone: the sequence played instead of the film.)
  film.watch = setTimeout(() => fail('no start in time'), wait || 8000);
  loadTitleToys();
}
function stopFilm() {
  const v = $('#title-film');
  clearTimeout(film?.watch);
  if (!v) return;
  v.onplaying = v.onended = v.onerror = v.onpause = null;
  try { v.pause(); v.removeAttribute('src'); v.load(); } catch {}
}
function endFilm() {
  if (titleStage !== 'film') return;
  const el = $('#title'), v = $('#title-film');
  clearTimeout(film.watch);
  v.onended = v.onerror = v.onpause = null;
  v.muted = true;
  el.classList.remove('film', 'rolling');
  // (The picture fades out over the room; then the film is let go.)
  setTimeout(stopFilm, 700);
  enterLive(true, false);
}
function startCine() {
  if (titleStage !== 'gate') return;
  titleStage = 'cine';
  const el = $('#title');
  el.classList.remove('gate');
  el.classList.add('cine', 'lit');
  $('#title-gate').hidden = true;
  cine = {T: 0, shot: -1, cue: 0, cut: true, look: new THREE.Vector3(), watch: null, hold: null, flashAt: null, vase: room.vaseWorld(new THREE.Vector3())};
  brain.nextBlink = clockNow + 30;
  loadTitleToys();
}
// (Before she moves each frame: the clock, the cues, and the cut to the next shot.)
function cineStep(real) {
  cine.T += real;
  while (cine && cine.cue < CUES.length && cine.T >= CUES[cine.cue][0]) CUES[cine.cue++][1]();
  if (!cine) return;
  while (cine.shot < SHOTS.length - 1 && cine.T >= SHOTS[cine.shot + 1].at) { cine.shot++; cine.cut = true; }
  cine.watch?.();
  if (cine.hold != null) brain.heading = cine.hold;
  if ((cine.flashAt != null && cine.T > cine.flashAt + .32) || cine.T > 9.5) endCine();
}
function cineCamera(real) {
  const s = SHOTS[Math.max(0, cine.shot)], fov = s.cam(cine.T - s.at, cineTo, cineLook);
  camera.position.copy(cineTo);
  if (cine.cut || !s.aim) cine.look.copy(cineLook); else for (const k of ['x', 'y', 'z']) cine.look[k] = damp(cine.look[k], cineLook[k], s.aim, real);
  cine.cut = false;
  if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
  camera.lookAt(cine.look);
}
// The end of the sequence (or a tap part-way): the room is tidy again, she
// lands on the rug and sits, and her name comes in.
function endCine(skipped = false) {
  if (!cine) return;
  cine = null; timeRate = 1;
  room.resetVase();
  enterLive(skipped, true);
}
// Into the living title: after the sequence she lands on the rug (land);
// after the film she already sits there.
function enterLive(skipped, land) {
  Object.assign(brain, {jump: null, perch: null, pounce: null, target: null, speed: 0, climbGoal: null, swatAt: null, glance: null, glanceUntil: 0, stuck: null, overrideUntil: 0});
  titleStage = 'live'; titleLiveAt = clockNow;
  resize();
  titleSnap();
  brain.pos.copy(HOME); brain.elevation = skipped ? 0 : .5; brain.heading = view.goal.yaw - .3;
  if (land) setActivity('land', .3, () => setActivity('sit')); else setActivity('sit');
  express('joy', 2.4);
  // (After the film they are already out: set down again for this view, full size.)
  (titleToys || []).forEach(o => placeTitleToy(o, land ? .9 + o.userData.i * .25 : -1));
  Object.assign(brain, {tailUpUntil: clockNow + 3, nextIdle: clockNow + 3.2, nextBlink: clockNow + 1.6});
  const el = $('#title');
  el.classList.remove('cine', 'streak', 'flash');
  el.classList.add('reveal');
  $('#title-sub').textContent = 'a little life to love';
  $('#title-go').textContent = 'Play with ' + pet.name;
  $('#title-go').hidden = false;
  $('#title-go').focus({preventScroll: true});
  // A burst of sparkles from her name.
  const box = $('#title-sparks');
  box.textContent = '';
  for (let i = 0; i < 18; i++) {
    const s = document.createElement('i'), a = rand(0, Math.PI * 2), d = rand(70, 200);
    s.style.cssText = `--dx:${(Math.cos(a) * d * 1.15).toFixed(0)}px;--dy:${(Math.sin(a) * d * .7).toFixed(0)}px;--s:${rand(.5, 1.4).toFixed(2)};animation-delay:${rand(.08, .4).toFixed(2)}s`;
    box.append(s);
  }
}

function leaveTitle() {
  if (!titleOn || !ready || titleLeaving) return;
  titleLeaving = true;
  titleToysOut = clockNow;
  const live = titleStage === 'live';
  $('#title').classList.add('out');
  // A short music-box chime as she wakes (sound on only).
  if (!live && !pet.sleeping) sounds.play(TITLE_CHIME, .5).then(ok => { if (params.has('debug')) window.kitten.chimed = ok; });
  // (Her own ideas wait until she has said hello.)
  brain.nextIdle = clockNow + 9; brain.nextShow = clockNow + 14; brain.nextBird = clockNow + 14;
  if (live) later(.5, () => greet(true));
  else if (!pet.sleeping) {
    setActivity('stretch', 2.2, () => walkTo(HOME, () => { setActivity('sit'); greet(true); }));
    later(.3, yawn);
  }
  if (reduceMotion) return later(.4, endTitle);
  view.glideUntil = clockNow + 3.4;
  later(.5, () => CAMERA_VIEWS.room());
  later(1.5, shrinkTitle);
}
function shrinkTitle() {
  const stage = $('.stage');
  // Where the room's card sits once the title is gone.
  titleRoot.classList.remove('title');
  const r = stage.getBoundingClientRect();
  titleRoot.classList.add('title', 'title-out');
  if (!stage.animate || r.width < 10) return endTitle();
  const from = {top: '0px', left: '0px', width: innerWidth + 'px', height: innerHeight + 'px', borderRadius: '0px'};
  const to = {top: r.top + 'px', left: r.left + 'px', width: r.width + 'px', height: r.height + 'px', borderRadius: sheetMQ.matches ? '0px' : getComputedStyle(titleRoot).getPropertyValue('--radius').trim() || '28px'};
  let anim;
  try { anim = stage.animate([from, to], {duration: 900, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'forwards'}); } catch { return endTitle(); }
  titleFlip = true;
  // (The picture scales with its box; resize() gives it its real size back after.)
  if (renderer) renderer.domElement.style.width = renderer.domElement.style.height = '100%';
  const done = () => { anim.cancel(); endTitle(); };
  anim.onfinish = done; anim.oncancel = () => { if (titleOn) endTitle(); };
  // (A tab put in the background mustn't leave it stuck part-way.)
  setTimeout(() => { if (titleOn) done(); }, 1600);
}
function endTitle() {
  if (!titleOn) return;
  titleFlip = false;
  titleOff();
  titleStage = 'off';
  titleFx?.dispose(); titleFx = null;
  clearTitleToys();
  const hadFocus = $('#title').contains(document.activeElement);
  $('#title').remove();
  if (hadFocus) $('[data-cam="room"]')?.focus({preventScroll: true});
  resize();
  CAMERA_VIEWS.room();
  keepCamMode();
  if (pet.sleeping) greet(true);
  refresh();
  setTimeout(pumpNews, 2600);
  if (teachStep() === 'ball' && !pet.sleeping) setTimeout(() => { if (teachStep() === 'ball' && brain.mode !== 'play') say('Tap my ball!', 5000, true); }, 1600);
}
Object.assign(view, {yaw: view.goal.yaw, pitch: view.goal.pitch, dist: view.goal.dist, cut: 0, lift: 0});

function updateCamera(dt) {
  if (view.fling) {
    const fl = view.fling;
    turnBy(-fl.vx * dt * .008); view.goal.pitch += fl.vy * dt * .006;
    const k = Math.exp(-5.5 * dt);
    fl.vx *= k; fl.vy *= k;
    if (Math.hypot(fl.vx, fl.vy) < 25) view.fling = null;
    clampGoal();
  }
  const g = view.goal, following = view.mode === 'follow' && ready;
  // The care buttons and the sheet cover the bottom of the picture. In Mochi
  // mode the whole picture slides up by half of that, so she sits in the
  // middle of the part you can see. (The picture moves, not the camera: a
  // lower camera flattens the floor and taps on it land on the furniture.)
  {
    const clear = clearArea(), W = Math.max(1, host.clientWidth);
    view.shift = damp(view.shift || 0, following && !titleOn ? (clear.h - clear.bottom) / 2 : 0, 4, dt);
    const px = view.shift < .5 ? 0 : Math.round(view.shift);
    if (px !== view.shiftPx || W !== view.shiftW || clear.h !== view.shiftH) {
      if (px) camera.setViewOffset(W, clear.h, 0, px, W, clear.h); else camera.clearViewOffset();
      Object.assign(view, {shiftPx: px, shiftW: W, shiftH: clear.h});
    }
  }
  // Let go past the end of the turn: it springs back to the end.
  if (!touches.size && !view.fling && !titleOn) {
    const over = Math.abs(g.yaw) - TURN_MAX;
    if (over > 0 && over < .5) g.yaw = damp(g.yaw, Math.sign(g.yaw) * TURN_MAX, 9, dt);
  }
  let distGoal = g.dist;
  if (following) {
    // Keep Mochi (and, while playing, the toy) comfortably in frame. The
    // camera only re-centres once she has moved a little way off, eases
    // there gently, and backs off when cat and toy are far apart. Turning
    // and zoom stay yours: this never changes the angle, and your zoom is
    // the closest it will go.
    const playing = brain.mode === 'play';
    const frame = framing(playing);
    // Zoomed in closer than her whole body: look at her face, not at the
    // middle of body and tail.
    const fit = fitDistance(frame.radius);
    if (view.zoomHeld && !playing && g.dist < fit) frame.center.lerp(cat.headCenter(framePt), clamp((fit - g.dist) / (fit * .45), 0, 1));
    if (frame.center.distanceTo(g.focus) > (playing ? .2 : .3) * clamp(g.dist / 3, .35, 1)) g.focus.copy(frame.center);
    clampGoal();
    // Your own zoom stays until you pick a view again. (While playing it
    // only wins for a while: the toy has to stay in the picture.)
    if (playing ? clockNow - view.zoomedAt > 8 : !view.zoomHeld) distGoal = Math.max(g.dist, fit);
    view.auto = distGoal;
  }
  // (Leaving the title screen, the camera glides out slowly.)
  const slow = clockNow < view.glideUntil ? .22 : 1;
  const r = (following ? 2.2 : 5) * slow;
  view.focus.x = damp(view.focus.x, g.focus.x, r, dt);
  view.focus.y = damp(view.focus.y, g.focus.y, r, dt);
  view.focus.z = damp(view.focus.z, g.focus.z, r, dt);
  view.yaw = damp(view.yaw, g.yaw, 8 * slow, dt);
  view.pitch = damp(view.pitch, g.pitch, 8 * slow, dt);
  view.dist = damp(view.dist, distGoal, (following && distGoal > g.dist ? 1.6 : 7) * slow, dt);
  camOffset.set(Math.sin(view.yaw) * Math.cos(view.pitch), Math.sin(view.pitch), Math.cos(view.yaw) * Math.cos(view.pitch));
  // Spring arm: if the camera would leave the room, shorten the arm instead.
  let d = boxArm(view.focus, camOffset, view.dist);
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
  view.shown = Math.max(.6, dFree - view.cut);
  camera.position.copy(view.focus).addScaledVector(camOffset, view.shown);
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
  const real = Math.min(.1, (now - last) / 1000), dt = real * timeRate;
  last = now;
  // (In the title sequence's slow motion the game clock falls behind.)
  clockLag += real - dt;
  clockNow = now / 1000 - clockLag;
  const t = clockNow;
  runTimers(t);
  if (cine) cineStep(real);
  if (brain.mode === 'brush' && t > brain.modeUntil) finishMode();
  // A meal or a drink that somehow never finishes mustn't lock the buttons.
  if ((brain.mode === 'feed' || brain.mode === 'drink') && t - brain.modeStart > 30) { finishMode(); setActivity('sit'); }
  // Her own catnaps restore a little energy (about 1 a minute).
  if (ready && brain.activity === 'catnap') pet.energy = Math.min(100, pet.energy + dt / 60);
  updatePlay(dt, t);
  if (ready) updateCat(dt, t);
  // (While the title shrinks, the picture's shape follows its box every frame.)
  if (titleFlip) { camera.aspect = host.clientWidth / host.clientHeight; camera.updateProjectionMatrix(); }
  if (cine) cineCamera(real); else updateCamera(dt);
  updateRoom(dt, t);
  if (ready) {
    if (titleOn) titleLife(t); else idleLife(t);
    placeSpeech();
  }
  if (skipDraw) return;
  if (titleFx) titleFx.render(dt, t); else { renderer.render(scene, camera); qualityTick(now); }
  if (fpsChip) fpsTick(now);
}
// Quality (phase 18): a phone that cannot keep up gets an easier picture, one
// step at a time, and keeps it: 1 a less sharp picture, 2 two thirds of the
// fur layers, 3 a plain-sharpness picture and smaller shadows. A step is
// taken after about two seconds under 25 frames a second, measured on real
// time over a run of frames (one slow frame, or coming back to the app, does
// not count). Never while the title's own picture is up (title-fx.js has its
// own steps). Remembered for a day, so a slow phone does not stutter at
// every launch, and a phone that was only hot gets another try tomorrow. `?q=0` to `?q=3` fixes the level;
// `?fps` shows frames a second and the level on screen.
const QUALITY_KEY = 'pk-quality', QUALITY_DAYS = 1;
const quality = {level: 0, slow: 0, lastAt: 0, fixed: /^[0-3]$/.test(new URLSearchParams(location.search).get('q') || ''), want: 0, layers: 0};
if (quality.fixed) quality.want = +new URLSearchParams(location.search).get('q');
else try { const k = JSON.parse(localStorage.getItem(QUALITY_KEY) || 'null'); if (k && Date.now() - k.at < QUALITY_DAYS * 864e5 && k.level >= 0 && k.level <= 3) quality.want = k.level | 0; } catch {}
function setQuality(level) {
  if (!renderer) return;
  quality.level = level;
  const sharp = Math.min(devicePixelRatio, 2);
  renderer.setPixelRatio(level >= 3 ? 1 : level >= 1 ? Math.min(sharp, 1.5) : sharp);
  renderer.setSize(host.clientWidth, host.clientHeight);
  quality.layers = cat.furLayers(level >= 2 ? 2 / 3 : 1);
  if (level >= 3 && !quality.shadows) {
    quality.shadows = true;
    scene.traverse(o => { if (o.isLight && o.castShadow && o.shadow.mapSize.x > 512) { o.shadow.mapSize.multiplyScalar(.5); o.shadow.map?.dispose(); o.shadow.map = null; } });
  }
}
// (The first frame after the app was out of sight is not a slow frame.)
document.addEventListener('visibilitychange', () => { quality.lastAt = 0; fps.lastAt = 0; });
function qualityTick(now) {
  if (!ready || manual || titleOn) return;
  if (quality.level < quality.want) setQuality(quality.want);
  const took = quality.lastAt ? now - quality.lastAt : 0;
  quality.lastAt = now;
  if (quality.fixed || quality.level >= 3 || document.hidden || !(took > 0)) return;
  // (Slow time adds up, time at a good pace takes it away again.)
  quality.slow = Math.max(0, quality.slow + (took > 40 ? Math.min(took, 500) : -took));
  if (quality.slow > 2000) {
    // (Step 1 changes nothing on a screen that is not sharper than 1.5.)
    quality.slow = 0; quality.want = quality.level + (quality.level === 0 && devicePixelRatio <= 1.5 ? 2 : 1);
    setQuality(quality.want);
    try { localStorage.setItem(QUALITY_KEY, JSON.stringify({level: quality.level, at: Date.now()})); } catch {}
  }
}
// `?fps`: frames a second (over the last second), the slowest frame in it,
// and what the picture is set to. For reading off a real phone.
const fpsChip = new URLSearchParams(location.search).has('fps') ? document.body.appendChild(Object.assign(document.createElement('div'), {id: 'fps-chip', textContent: 'fps'})) : null;
if (fpsChip) fpsChip.style.cssText = 'position:fixed;left:8px;top:calc(env(safe-area-inset-top, 0px) + 8px);z-index:9999;padding:4px 8px;border-radius:8px;background:rgba(20,16,12,.78);color:#fff;font:600 12px/1.3 ui-monospace,Menlo,monospace;pointer-events:none;white-space:pre';
const fps = {n: 0, worst: 0, since: 0, lastAt: 0};
function fpsTick(now) {
  const took = fps.lastAt ? now - fps.lastAt : 0; fps.lastAt = now;
  if (took > 0) { fps.n++; fps.worst = Math.max(fps.worst, took); }
  if (now - fps.since < 1000) return;
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  fpsChip.textContent = `${(r => r < 10 ? r.toFixed(1) : Math.round(r))(fps.n * 1000 / (now - fps.since))} fps · slowest ${Math.round(fps.worst)} ms\nquality ${titleFx ? 'title' : quality.level} · ${size.x}x${size.y} · fur ${quality.layers || cat.furLook?.full || '-'}`;
  Object.assign(fps, {n: 0, worst: 0, since: now});
}
let skipDraw = false; // (debug stepping can skip drawing the in-between frames)

// Handy for visual QA: open with ?debug to drive the kitten from the console.
// With ?debug&frames the app doesn't run by itself: kitten.step(dt, n)
// advances it n frames of dt seconds each, so the review pack can record
// clips that play at true speed however slowly its renderer draws.
const params = new URLSearchParams(location.search), manual = params.has('debug') && params.has('frames');
let virtualNow = performance.now();
// The sheet (phase 08). Resting: the needs; open: everything. A drag that
// starts on the resting sheet, or on the open sheet's grip or "needs"
// heading, moves it; inside the open sheet the list scrolls. Touches on the
// sheet never reach the room (it is outside the camera's element).
const sheet = $('#sheet'), sheetGrip = $('#sheet-grip'), sheetScrim = $('#sheet-scrim');
const isSheetOpen = () => document.body.classList.contains('sheet-open');
function sheetOpen(on) {
  if (on && !sheetMQ.matches) return;
  document.body.classList.toggle('sheet-open', on);
  sheetGrip.setAttribute('aria-expanded', String(on));
  sheetGrip.ariaLabel = on ? 'Show less' : 'Show more';
  if (!on) sheet.scrollTop = 0;
  refresh();
  // Resting, what's below the needs can't be reached by keyboard either.
  for (const el of sheet.querySelectorAll('.bond-card, .log, footer')) el.inert = sheetMQ.matches && !on;
  if (!on) requestAnimationFrame(sheetPeek);
}
function sheetPeek() {
  if (!sheetMQ.matches || isSheetOpen()) return;
  const p = sheet.getBoundingClientRect(), n = $('.panel .needs').getBoundingClientRect();
  const px = Math.round(n.bottom - p.top + sheet.scrollTop + 14);
  const was = parseFloat(document.documentElement.style.getPropertyValue('--peek-px')) || 0;
  if (Math.abs(px - was) < 2) return;
  document.documentElement.style.setProperty('--peek-px', px + 'px');
  // The dock moved: frame the room in the space left above it.
  if (view.mode === 'room' && !titleOn) { clearTimeout(sheetPeek.t); sheetPeek.t = setTimeout(() => CAMERA_VIEWS.room(), 450); }
}
function sheetLayout() {
  const phone = sheetMQ.matches;
  // The top bar's buttons and the credits go where a phone can see them.
  const acts = $('.top-actions'), foot = $('footer');
  if (phone) { $('.hud-left').append(acts); sheet.append(foot); }
  else { $('.topbar').append(acts); $('.app').append(foot); }
  sheetOpen(false);
  sheetScrim.hidden = !phone;
  requestAnimationFrame(sheetPeek);
}
sheetMQ.addEventListener('change', sheetLayout);
new ResizeObserver(() => sheetPeek()).observe($('.panel .needs'));
sheetLayout();
let sheetDrag = null, sheetNoClick = false;
sheet.addEventListener('pointerdown', e => {
  if (!sheetMQ.matches || document.body.classList.contains('watch') || e.button > 0) return;
  const open = isSheetOpen(), handle = !!e.target.closest('.sheet-grip, .needs > .card-head');
  if (open && !handle) return;
  sheetDrag = {id: e.pointerId, y: e.clientY, t: performance.now(), open, moving: false};
});
sheet.addEventListener('pointermove', e => {
  const d = sheetDrag;
  if (!d || e.pointerId !== d.id) return;
  const dy = e.clientY - d.y;
  if (!d.moving) {
    if (Math.abs(dy) < 8) return;
    d.moving = true;
    d.travel = sheet.offsetHeight - parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--peek-px') || 300);
    sheet.classList.add('dragging');
    try { sheet.setPointerCapture(e.pointerId); } catch {}
  }
  const base = d.open ? 0 : d.travel;
  let y = base + dy;
  if (y < 0) y = -Math.sqrt(-y) * 2;                       // a little give past the top
  if (y > d.travel) y = d.travel + Math.sqrt(y - d.travel) * 2;
  sheet.style.transform = `translateY(${y}px)`;
});
function sheetDragEnd(e) {
  const d = sheetDrag;
  if (!d || e.pointerId !== d.id) return;
  sheetDrag = null;
  if (!d.moving) return;
  if (e.type === 'pointercancel') { sheet.classList.remove('dragging'); sheet.style.transform = ''; sheetOpen(d.open); return; }
  const dy = e.clientY - d.y, v = dy / Math.max(1, performance.now() - d.t);
  sheet.classList.remove('dragging');
  sheet.style.transform = '';
  const y = (d.open ? 0 : d.travel) + dy;
  sheetOpen(Math.abs(v) > .35 ? v < 0 : y < d.travel / 2);
  sheetNoClick = true; setTimeout(() => sheetNoClick = false, 0);
}
sheet.addEventListener('pointerup', sheetDragEnd);
sheet.addEventListener('pointercancel', sheetDragEnd);
// A tap: the grip toggles; on the resting sheet anything but a button opens it.
sheet.addEventListener('click', e => {
  if (sheetNoClick) { e.stopPropagation(); e.preventDefault(); sheetNoClick = false; return; }
  if (!sheetMQ.matches) return;
  if (e.target.closest('#sheet-grip')) { sheetOpen(!isSheetOpen()); return; }
  if (!isSheetOpen() && !e.target.closest('button, a, input')) sheetOpen(true);
}, true);
let sheetPull = null;
sheet.addEventListener('touchstart', e => {
  sheetPull = isSheetOpen() && !sheetDrag && sheet.scrollTop <= 0 && e.touches.length === 1 ? {y: e.touches[0].clientY, t: performance.now(), on: false} : null;
}, {passive: true});
sheet.addEventListener('touchmove', e => {
  const d = sheetPull;
  if (!d) return;
  const dy = e.touches[0].clientY - d.y;
  if (!d.on && (dy < 6 || sheet.scrollTop > 0)) { if (dy < -6) sheetPull = null; return; }
  d.on = true; d.dy = dy;
  e.preventDefault();
  sheet.classList.add('dragging');
  sheet.style.transform = `translateY(${Math.max(0, dy)}px)`;
}, {passive: false});
const sheetPullEnd = e => {
  const d = sheetPull; sheetPull = null;
  if (!d?.on) return;
  sheet.classList.remove('dragging'); sheet.style.transform = '';
  const v = d.dy / Math.max(1, performance.now() - d.t);
  sheetOpen(!(e.type === 'touchend' && (d.dy > 120 || v > .35)));
};
sheet.addEventListener('touchend', sheetPullEnd);
sheet.addEventListener('touchcancel', sheetPullEnd);
sheetScrim.addEventListener('click', () => sheetOpen(false));
document.addEventListener('keydown', e => { if (e.key === 'Escape' && isSheetOpen()) sheetOpen(false); });

loadFramePhoto();
if (params.has('debug')) window.kitten = {news, pumpNews, wishNow, wishCheck, takePhoto, useToy, openToys, get giftToy() { return giftToy; }, brain, renderJournal, sheetOpen, sheetPeek, cat, get clock() { return clockNow; }, SWAT, express, endPlay, get teach() { return teachStep(); }, get title() { return {stage: titleStage, cine, film, fx: titleFx, full: titleFull, toys: titleToys}; }, ridePendant, dash, dogLife, nightLife, nightZoomies, shadowPounce, dockHunt, isNight, get night() { return night; }, setNight(v) { forcedNight = v; refresh(); }, act, yawn, slowBlink, meow, hop, view, setActivity, walkTo, jumpTo, jumpDown, startSolo, knockBook, knockVase, tapCups, knockItem: knockThing, stroll, garlandNap, sinkSit, inSink, hopFrom, stealSalmon, drinkFaucet, vacuumRide, vacuumAttack, invite, zoneAt, touchCat, callTo, zoneUnder(x, y) { setPointer({clientX: x, clientY: y}); const h = catHit(); return h ? zoneAt(h.point) : null; }, refresh, goTo, get place() { return place; }, get kitchen() { return kitchen; }, room, get PERCHES() { return PERCHES; }, get SUN_SPOT() { return SUN_SPOT; }, renderer, orbit, pan, zoomBy, toy, toyTarget, sounds, pet, say, CAMERA_VIEWS, camera,
  step(dt = 1 / 24, n = 1, drawAll = true) { for (let i = 0; i < n; i++) { virtualNow += dt * 1000; skipDraw = !drawAll && i < n - 1; frame(virtualNow); } skipDraw = false; }};

renderer?.setAnimationLoop(now => { if (manual) return; if (!document.hidden) frame(now); else last = now; });
// In manual mode, draw one frame so the page isn't blank before stepping.
if (manual) frame(virtualNow);
