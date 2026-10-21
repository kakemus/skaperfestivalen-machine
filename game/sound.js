// A synthesized bell, so the on-screen game dings even without the real bell.
// Browsers only allow sound after a click on the page — the first button
// press (e.g. "Insert coin") unlocks it.
let audio = null;

export function ding(times = 1) {
  try {
    audio ??= new AudioContext();
    audio.resume();
    for (let n = 0; n < times; n++) {
      const t0 = audio.currentTime + n * 0.35;
      // a bell = a few inharmonic partials with fast attack and long decay
      for (const [ratio, gain] of [[1, 0.5], [2.76, 0.25], [5.4, 0.12], [8.93, 0.06]]) {
        const osc = audio.createOscillator(), g = audio.createGain();
        osc.frequency.value = 880 * ratio;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(gain * 0.4, t0 + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.4 / ratio ** 0.3);
        osc.connect(g).connect(audio.destination);
        osc.start(t0);
        osc.stop(t0 + 1.6);
      }
    }
  } catch { /* no sound available — the game doesn't depend on it */ }
}

// A thermal printer's "skhsh" for one printed line: a short burst of filtered
// noise, chopped quickly like the print head stepping, for the simulator.
let noise = null;
export function printSound(ms = 220) {
  try {
    audio ??= new AudioContext();
    audio.resume();
    if (!noise) {
      noise = audio.createBuffer(1, audio.sampleRate, audio.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t0 = audio.currentTime, len = ms / 1000;
    const src = audio.createBufferSource(), band = audio.createBiquadFilter(), g = audio.createGain();
    src.buffer = noise;
    band.type = "bandpass";
    band.frequency.value = 3200 + Math.random() * 800;
    band.Q.value = 0.9;
    g.gain.setValueAtTime(0.0001, t0);
    for (let s = 0; s < len; s += 0.018) {                // the head stepping: quick on/off
      g.gain.setValueAtTime(0.22, t0 + s);
      g.gain.setValueAtTime(0.06, t0 + s + 0.011);
    }
    g.gain.setValueAtTime(0.22, t0 + len - 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
    src.connect(band).connect(g).connect(audio.destination);
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + len + 0.02);
  } catch { /* no sound available — the game doesn't depend on it */ }
}

// The losing sound (2026-10-21, tuned in the maker's user test): a buzzing two-tone alarm,
// "eeh – aawh" three times, all the same. Each tone is two square waves a few Hz apart, so it
// buzzes; eeh = 294 Hz (D4), aawh = 220 Hz (A3) — low enough not to shriek, high enough for a
// phone speaker (a 120 Hz buzz didn't come through; a high vowel-like version was too shrill).
export function buzzer(ctx) {
  try {
    if (!ctx) { audio ??= new AudioContext(); audio.resume(); ctx = audio; }
    const start = ctx.currentTime + 0.02;
    const lp = ctx.createBiquadFilter(), out = ctx.createGain();
    lp.type = "lowpass";
    lp.frequency.value = 3000;
    out.gain.value = 0.0001;
    lp.connect(out).connect(ctx.destination);
    const a = ctx.createOscillator(), b = ctx.createOscillator();
    a.type = b.type = "square";
    a.connect(lp);
    b.connect(lp);
    let t = start;
    for (let n = 0; n < 3; n++) {
      for (const [f, len] of [[294, 0.3], [220, 0.45]]) {    // eeh, aawh
        a.frequency.setValueAtTime(f, t);
        b.frequency.setValueAtTime(f + 7, t);                // a few Hz apart: the buzz
        out.gain.setValueAtTime(0.0001, t);
        out.gain.exponentialRampToValueAtTime(0.45, t + 0.01);
        out.gain.setValueAtTime(0.45, t + len - 0.03);
        out.gain.exponentialRampToValueAtTime(0.0001, t + len);
        t += len;
      }
      t += 0.12;                                             // a breath between the three
    }
    a.start(start); b.start(start);
    a.stop(t); b.stop(t);
  } catch { /* no sound available — the game doesn't depend on it */ }
}
