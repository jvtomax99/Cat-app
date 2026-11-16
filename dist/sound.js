// Mochi's sounds: her voice only, on one volume. Meows are synthesized
// (meows.js, the first version's meow) unless sounds.json lists recordings for them; the purr is the
// recording listed there (or a synthesized one if none is).
// There is deliberately no background ambience: both the old fountain
// trickle and the later room tone came across as white noise. The fountain
// (and the robot vacuum) are visual only. The one other sound is a short,
// soft knock when something she's sent over lands: a ceramic clink, a glass
// tink, a plate's rattle or a book's thud, on her volume.
//
// Music (Merlin, 2026-11-14) is the player's choice and off until they pick
// a piece: one of TUNES, on its own volume, played through with a quiet
// pause before it comes round again so it never drones. "Mix" (Merlin,
// 2026-11-16) plays the three in turn, with the same pause between them.
//
// Meows never overlap and leave quiet gaps between them. Each recording's
// loudness envelope is measured when it loads, so the mouth can open and
// close with the actual sound.

import {meowV1, meowV1Envelope} from './meows.js';

// Peak gain of her meow: the original tone, brought up to sit level with the
// purr (it was about 8 dB quieter as first written).
export const MEOW_LEVEL = .11;

const MANIFEST = 'sounds.json';

// The pieces of music a player can pick (the key is what the save keeps).
// (No inherited keys: a save may hold any short word.)
export const TUNES = Object.assign(Object.create(null), {
  box: {name: 'Music box', file: 'music-box.mp3'},
  piano: {name: 'Piano', file: 'music-piano.mp3'},
  guitar: {name: 'Guitar', file: 'music-guitar.mp3'},
  mix: {name: 'Mix', files: ['music-box.mp3', 'music-piano.mp3', 'music-guitar.mp3']},
});
// Seconds of quiet between one play of a piece and the next (in a mix too).
const MUSIC_PAUSE = 12;

export class Sounds {
  constructor(base = './assets/sounds/') {
    this.base = base;
    this.ctx = null;
    this.enabled = false;
    this.volume = {cat: .8, music: .3};
    this.tune = null; // the music playing (or being fetched): its file, or a mix's files joined by spaces
    this.tuneNow = null; // in it, the file playing now
    this.tuneTurn = 0;
    this.clips = [];
    this.credits = [];
    // Call timing runs on the page clock (seconds), which keeps going even
    // while audio is still locked or muted.
    this.busyUntil = -Infinity; // no new call starts before this
    this.purrUntil = -Infinity; // she doesn't meow while purring
    this.lastClip = null;
  }

  // Must first be called from a user gesture (browsers keep audio locked
  // until then).
  start() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      // On iPhone, play like media (so the ringer's silent switch doesn't
      // mute her), where Safari supports saying so.
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.bus = {cat: this.ctx.createGain(), music: this.ctx.createGain()};
      for (const [k, g] of Object.entries(this.bus)) { g.gain.value = this.volume[k]; g.connect(this.master); }
      this.master.gain.value = this.enabled ? 1 : 0;
      this.loading = this.load();
    }
    // 'suspended' before the first tap; 'interrupted' on iPhone after a call
    // or time in the background.
    if (this.ctx.state !== 'running') {
      this.ctx.resume?.();
      // A moment of silence, played from inside the tap, unlocks older iPhones.
      try { const b = this.ctx.createBufferSource(); b.buffer = this.ctx.createBuffer(1, 1, 22050); b.connect(this.ctx.destination); b.start(0); } catch {}
    }
    return this.ctx;
  }

  async load() {
    try {
      const res = await fetch(this.base + MANIFEST);
      if (!res.ok) return;
      const list = await res.json();
      // Clips marked "candidate" are still being reviewed: they play in the
      // preview build only, not in the live app. "reference" clips are only
      // for comparison in the review pack and are never played.
      const channel = await fetch('./version.json', {cache: 'no-store'}).then(r => r.ok ? r.json() : {}).then(v => v.channel).catch(() => null);
      const clips = (list.clips || []).filter(c => c.status !== 'reference' && (c.status !== 'candidate' || channel !== 'live'));
      this.credits = clips.length ? list.credits || [] : [];
      await Promise.all(clips.map(async c => {
        const data = await (await fetch(this.base + c.file)).arrayBuffer();
        const buffer = await this.ctx.decodeAudioData(data);
        this.clips.push({...c, buffer, env: envelope(buffer)});
      }));
    } catch (e) { console.warn('Sounds unavailable:', e); }
  }

  setEnabled(on) {
    this.enabled = on;
    if (on) this.start();
    if (this.ctx) this.master.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, .08);
  }
  setVolume(kind, v) {
    this.volume[kind] = v;
    if (this.ctx) this.bus[kind].gain.setTargetAtTime(v, this.ctx.currentTime, .08);
  }

  // The music to play now: a file from this folder, a list of them (a mix,
  // played in turn), or nothing. Safe to call often (the same music again
  // changes nothing). A piece fades in, plays through, and after a quiet
  // pause comes round again, or the next piece of the mix does.
  setMusic(files = null) {
    if (!this.ctx || !this.enabled) files = null;
    const list = files ? [files].flat() : [];
    const key = list.join(' ') || null;
    if (key === this.tune) return;
    this.tune = key;
    const turn = ++this.tuneTurn, ctx = this.ctx;
    clearTimeout(this.tuneTimer);
    if (this.tuneSrc) {
      const now = ctx.currentTime, g = this.tuneGain.gain;
      const at = g.value;
      g.cancelScheduledValues(now); g.setValueAtTime(at, now); g.setTargetAtTime(0, now, .2);
      try { this.tuneSrc.stop(now + 1.2); } catch {}
      // (A phone stops the audio clock in the background, so a fade would
      // wait and be heard on coming back: cut it off at once.)
      if (document.hidden) this.tuneGain.disconnect();
      this.tuneSrc = null;
    }
    this.tuneNow = null;
    if (!list.length) return;
    // (Only the piece playing is kept decoded: a minute of music takes about
    // 20 MB that way, too much to hold three on a phone. The next is fetched
    // and decoded during the pause.)
    const load = async file => {
      if (this.tuneKept?.file === file) return this.tuneKept.buffer;
      const buffer = await ctx.decodeAudioData(await (await fetch(this.base + file)).arrayBuffer());
      if (turn === this.tuneTurn) this.tuneKept = {file, buffer};
      return buffer;
    };
    const round = async i => {
      const file = list[i % list.length];
      try {
        const buffer = await load(file);
        if (turn !== this.tuneTurn) return;
        const src = ctx.createBufferSource(), g = ctx.createGain(), t = ctx.currentTime + .05;
        src.buffer = buffer;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + 1.5);
        src.connect(g).connect(this.bus.music);
        src.onended = () => {
          if (turn !== this.tuneTurn) return;
          const next = list[(i + 1) % list.length];
          // (Fetch the next piece now, so the pause is no longer for it.)
          const ready = load(next).catch(() => {});
          this.tuneTimer = setTimeout(async () => { await ready; if (turn === this.tuneTurn) round(i + 1); }, MUSIC_PAUSE * 1000);
        };
        src.start(t);
        this.tuneSrc = src; this.tuneGain = g; this.tuneNow = file;
      } catch (e) {
        // (Weak signal: the next tap after a short while tries again.)
        console.warn('Music unavailable:', e);
        setTimeout(() => { if (turn === this.tuneTurn) this.tune = null; }, 20000);
      }
    };
    round(0);
  }

  // A one-off sound file from this folder (the title screen's wake-up
  // chime), on her volume; nothing if muted or still locked.
  async play(file, gain = .5) {
    if (!this.ctx || !this.enabled) return false;
    try {
      const buffer = await this.ctx.decodeAudioData(await (await fetch(this.base + file)).arrayBuffer());
      if (!this.enabled || this.ctx.state !== 'running') return false;
      const src = this.ctx.createBufferSource(), g = this.ctx.createGain();
      src.buffer = buffer; g.gain.value = gain;
      src.connect(g).connect(this.bus.cat); src.start();
      return true;
    } catch (e) { console.warn('Sound unavailable:', e); return false; }
  }

  // Something landing (see above). One-off and quiet; nothing if muted.
  knock(kind = 'cup') {
    if (!this.ctx || !this.enabled || this.ctx.state !== 'running') return;
    const c = this.ctx, t0 = c.currentTime + .01, out = c.createGain();
    out.gain.value = .5; out.connect(this.bus.cat);
    const ping = (f, a, d, at) => {
      const o = c.createOscillator(), g = c.createGain();
      o.frequency.value = f; g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(a, at + .003); g.gain.exponentialRampToValueAtTime(.0001, at + d);
      o.connect(g).connect(out); o.start(at); o.stop(at + d + .02);
    };
    const thud = (f, a, d, at) => {
      const n = c.createBuffer(1, Math.ceil(c.sampleRate * d), c.sampleRate), ch = n.getChannelData(0);
      for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * Math.exp(-i / ch.length * 6);
      const src = c.createBufferSource(), lp = c.createBiquadFilter(), g = c.createGain();
      src.buffer = n; lp.type = 'lowpass'; lp.frequency.value = f; g.gain.value = a;
      src.connect(lp).connect(g).connect(out); src.start(at);
    };
    const clink = (fs, a, d, at) => fs.forEach((f, i) => ping(f, a / (i + 1), d / (1 + i * .3), at));
    if (kind === 'book') { thud(320, .35, .14, t0); return; }
    if (kind === 'glass') { clink([3100, 4720, 7350], .04, .16, t0); thud(900, .06, .05, t0); clink([3150, 4800], .015, .1, t0 + .1); return; }
    if (kind === 'plate') { clink([1480, 2630, 4100], .045, .2, t0); thud(500, .1, .07, t0); [.07, .12, .16].forEach((d, i) => clink([1500 + i * 40, 2700], .018 / (i + 1), .08, t0 + d)); return; }
    // A cup (or the study's vase): a clink, a low knock, a little bounce.
    clink([2050, 3300, 5150], .045, .13, t0); thud(420, .12, .08, t0); clink([2080, 3340], .014, .08, t0 + .11);
  }

  /**
   * A meow. kind: 'mew' | 'meow' | 'chirp' | 'sleepy'. priority 'reply' (she
   * answers you) may follow a short pause; 'idle' needs a longer quiet spell.
   * Returns {dur, env, rate} for the mouth (env: loudness 0..1 at `rate` per
   * second), or null when it's too soon to speak again.
   */
  meow(kind = 'meow', priority = 'reply') {
    const now = clock();
    const gap = priority === 'idle' ? 6 + Math.random() * 6 : 2.5;
    if (now < this.busyUntil + gap || now < this.purrUntil) return null;
    // The right kind of call, not the same recording twice in a row when
    // there's a choice.
    let pool = this.clips.filter(c => c.kind === kind);
    if (!pool.length) pool = this.clips.filter(c => c.kind === 'mew' || c.kind === 'meow');
    if (pool.length > 1) pool = pool.filter(c => c !== this.lastClip);
    const clip = pick(pool);
    if (!clip) {
      // No recorded meow for this: her own voice, the first version's meow
      // (meows.js), the same tone for every kind, a little softer or louder
      // each time.
      const {dur, env} = meowV1Envelope(ENV_RATE);
      this.busyUntil = now + dur;
      if (this.enabled && this.ctx) {
        const g = this.ctx.createGain();
        g.gain.value = .85 + Math.random() * .15;
        g.connect(this.bus.cat);
        meowV1(this.ctx, g, this.ctx.currentTime + .02, MEOW_LEVEL);
      }
      return {dur, env, rate: ENV_RATE};
    }
    this.lastClip = clip;
    this.busyUntil = now + clip.buffer.duration;
    if (this.enabled && this.ctx) {
      const src = this.ctx.createBufferSource(), g = this.ctx.createGain();
      src.buffer = clip.buffer;
      // A little natural variation in pitch and loudness each time.
      src.playbackRate.value = 1 + (Math.random() - .5) * .07;
      g.gain.value = (clip.gain ?? 1) * (.85 + Math.random() * .15);
      src.connect(g).connect(this.bus.cat);
      src.start();
    }
    return {dur: clip.buffer.duration, env: clip.env, rate: ENV_RATE};
  }

  purr(seconds = 2.2) {
    if (!this.enabled || !this.start()) return;
    // Never over a meow: start once she's finished, and keep calls away
    // while she purrs.
    const now = clock(), start = Math.max(now, this.busyUntil + .25);
    if (start < this.purrUntil) return;
    this.purrUntil = start + seconds;
    const t = this.ctx.currentTime + (start - now);
    const recorded = this.clips.filter(c => c.kind === 'purr');
    if (recorded.length) {
      const clip = pick(recorded), src = this.ctx.createBufferSource(), g = this.ctx.createGain();
      src.buffer = clip.buffer; src.loop = true;
      g.gain.setValueAtTime(.0001, t);
      g.gain.exponentialRampToValueAtTime(clip.gain ?? 1, t + .4);
      g.gain.setValueAtTime(clip.gain ?? 1, t + seconds - .5);
      g.gain.exponentialRampToValueAtTime(.0001, t + seconds);
      src.connect(g).connect(this.bus.cat);
      src.start(t); src.stop(t + seconds);
      return;
    }
    synthPurr(this.ctx, this.bus.cat, t, seconds);
  }

}

const clock = () => performance.now() / 1000;
const pick = list => list[Math.floor(Math.random() * list.length)];

// Loudness envelope of a recording, 0..1 at ENV_RATE samples per second.
const ENV_RATE = 60;
function envelope(buffer) {
  const data = buffer.getChannelData(0), hop = Math.floor(buffer.sampleRate / ENV_RATE);
  const out = new Float32Array(Math.ceil(data.length / hop));
  let peak = 1e-6;
  for (let k = 0; k < out.length; k++) {
    let s = 0;
    const end = Math.min(data.length, (k + 1) * hop);
    for (let i = k * hop; i < end; i++) s += data[i] * data[i];
    out[k] = Math.sqrt(s / Math.max(1, end - k * hop));
    peak = Math.max(peak, out[k]);
  }
  // Normalise, ignore the noise floor, and smooth so the jaw doesn't chatter.
  let prev = 0;
  for (let k = 0; k < out.length; k++) {
    const v = Math.max(0, (out[k] / peak - .08) / .92);
    prev = prev + (v - prev) * (v > prev ? .6 : .3);
    out[k] = Math.pow(prev, .7);
  }
  return out;
}

// Synthesized purr, used only when no purr recording is bundled: a ~26 Hz flutter of low, breathy noise, louder on the out-breath
// and softer on the in-breath, which alternate about every second.
export function synthPurr(ctx, out, t, seconds) {
  const sr = ctx.sampleRate, len = Math.floor(sr * seconds);
  const buf = ctx.createBuffer(1, len, sr), d = buf.getChannelData(0);
  let lp = 0;
  for (let i = 0; i < len; i++) {
    const tt = i / sr;
    lp += ((Math.random() * 2 - 1) - lp) * .06;
    const breath = Math.sin(Math.PI * 2 * tt / 2.1);
    const rate = breath > 0 ? 26 : 23;
    const flutter = Math.pow(.5 + .5 * Math.sin(Math.PI * 2 * rate * tt), 3);
    d[i] = lp * flutter * (breath > 0 ? 1 : .6) * 6;
  }
  const src = ctx.createBufferSource(), low = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = buf;
  low.type = 'lowpass'; low.frequency.value = 380; low.Q.value = .5;
  g.gain.setValueAtTime(.0001, t);
  g.gain.exponentialRampToValueAtTime(.9, t + .35);
  g.gain.setValueAtTime(.9, t + Math.max(.4, seconds - .5));
  g.gain.exponentialRampToValueAtTime(.0001, t + seconds);
  src.connect(low).connect(g).connect(out);
  src.start(t); src.stop(t + seconds);
}
