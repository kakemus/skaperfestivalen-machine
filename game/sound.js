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

// The wrong-answer buzzer for losing (2026-10-21): a hard, low "BZZZT" of about a second,
// like a game show's. Two square waves slightly apart (120 / 127 Hz) beat against each other
// for the rasp; a low-pass takes the fizz off so a small phone speaker doesn't just crackle.
export function buzzer(ctx) {
  try {
    if (!ctx) { audio ??= new AudioContext(); audio.resume(); ctx = audio; }
    const t0 = ctx.currentTime + 0.02, len = 1.0;
    const out = ctx.createGain(), lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1800;
    out.gain.setValueAtTime(0.0001, t0);
    out.gain.exponentialRampToValueAtTime(0.35, t0 + 0.01);
    out.gain.setValueAtTime(0.35, t0 + len - 0.08);
    out.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
    lp.connect(out).connect(ctx.destination);
    for (const f of [120, 127]) {
      const osc = ctx.createOscillator();
      osc.type = "square";
      osc.frequency.value = f;
      osc.connect(lp);
      osc.start(t0);
      osc.stop(t0 + len + 0.02);
    }
  } catch { /* no sound available — the game doesn't depend on it */ }
}
