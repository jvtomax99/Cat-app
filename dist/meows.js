// Mochi's synthesized meows. Neither uses any recording: they're generated
// tones written for this project, so no third-party licence is involved.
// meowV1, the original project's meow, is her voice in the app (chosen by
// ear); meowV2 is kept for comparison in the review pack.

// Version 1, from the original Pocket Kitten project (Codex handoff, commit
// 11099b9): one soft triangle tone rising and falling. `level` is its peak
// gain; the original played it at .055 straight to the speakers.
export function meowV1(ctx, out, t, level = .055) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'triangle';
  o.frequency.setValueAtTime(620, t);
  o.frequency.exponentialRampToValueAtTime(920, t + .14);
  o.frequency.exponentialRampToValueAtTime(430, t + .42);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(level, t + .04);
  g.gain.exponentialRampToValueAtTime(level / 55, t + .5);
  o.connect(g); g.connect(out);
  o.start(t); o.stop(t + .55);
  return .55;
}

// Loudness envelope of a version 1 meow (0..1 at `rate` per second), for the
// mouth: it follows the same gain curve as the sound.
export function meowV1Envelope(rate = 60) {
  const n = Math.ceil(.55 * rate), out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const g = t < .04 ? t / .04 : t < .5 ? Math.pow(1 / 55, (t - .04) / .46) : 0;
    out[i] = Math.sqrt(g);
  }
  return {dur: .55, env: out};
}

// Version 2 (first written in commit 24fdab9): a buzzy tone through two
// vowel-like filters, with a little vibrato; four kinds.
export function meowV2(ctx, dest, t, kind = 'meow') {
  const dur = {chirp: .2, mew: .36, meow: .6, sleepy: .8}[kind] ?? .6;
  const base = {chirp: 760, mew: 700, meow: 540, sleepy: 430}[kind] ?? 540;
  const o = ctx.createOscillator(), lfo = ctx.createOscillator(), lfoGain = ctx.createGain();
  const f1 = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter(), out = ctx.createGain(), g2 = ctx.createGain();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(base * .82, t);
  o.frequency.linearRampToValueAtTime(base * 1.32, t + dur * .32);
  o.frequency.exponentialRampToValueAtTime(base * .72, t + dur);
  lfo.frequency.value = 6.5; lfoGain.gain.value = base * .018;
  lfo.connect(lfoGain).connect(o.frequency);
  f1.type = f2.type = 'bandpass'; f1.Q.value = 5; f2.Q.value = 7;
  f1.frequency.setValueAtTime(650, t); f1.frequency.linearRampToValueAtTime(1150, t + dur * .4); f1.frequency.linearRampToValueAtTime(600, t + dur);
  f2.frequency.setValueAtTime(2700, t); f2.frequency.linearRampToValueAtTime(1800, t + dur * .5); f2.frequency.linearRampToValueAtTime(1100, t + dur);
  g2.gain.value = .55;
  o.connect(f1).connect(out); o.connect(f2).connect(g2).connect(out); out.connect(dest);
  out.gain.setValueAtTime(.0001, t);
  out.gain.exponentialRampToValueAtTime(.32, t + .05);
  out.gain.setValueAtTime(.32, t + dur * .55);
  out.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.start(t); lfo.start(t); o.stop(t + dur + .05); lfo.stop(t + dur + .05);
  return dur + .05;
}

