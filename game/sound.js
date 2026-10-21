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

// The losing sound (2026-10-21, tuned with the maker in the user test): a deep, mechanical
// buzzer, "eeh – aawh" three times. Two square waves a few Hz apart per tone (the buzz), eeh
// 150 Hz, aawh 110 Hz, chopped 50 times a second (a square LFO on the gain) — the rattle of an
// old electric buzzer's vibrating armature. Deep, so it wants a real speaker (the maker has one);
// a phone's own speaker plays mostly the overtones.
export function synthBuzzer(ctx) {
  try {
    if (!ctx) { audio ??= new AudioContext(); audio.resume(); ctx = audio; }
    const start = ctx.currentTime + 0.02;
    const lp = ctx.createBiquadFilter(), env = ctx.createGain(), chop = ctx.createGain();
    lp.type = "lowpass";
    lp.frequency.value = 2500;
    env.gain.value = 0.0001;
    chop.gain.value = 0.6;                                   // the rattle: 0.6 ± 0.4
    const rattle = ctx.createOscillator(), depth = ctx.createGain();
    rattle.type = "square";
    rattle.frequency.value = 50;
    depth.gain.value = 0.4;
    rattle.connect(depth).connect(chop.gain);
    lp.connect(chop).connect(env).connect(ctx.destination);
    const a = ctx.createOscillator(), b = ctx.createOscillator();
    a.type = b.type = "square";
    a.connect(lp);
    b.connect(lp);
    let t = start;
    for (let n = 0; n < 3; n++) {
      for (const [f, len] of [[150, 0.32], [110, 0.48]]) {    // eeh, aawh
        a.frequency.setValueAtTime(f, t);
        b.frequency.setValueAtTime(f + 4, t);
        env.gain.setValueAtTime(0.0001, t);
        env.gain.exponentialRampToValueAtTime(0.6, t + 0.008);
        env.gain.setValueAtTime(0.6, t + len - 0.02);
        env.gain.exponentialRampToValueAtTime(0.0001, t + len);
        t += len;
      }
      t += 0.12;
    }
    for (const o of [a, b, rattle]) { o.start(start); o.stop(t); }
  } catch { /* no sound available — the game doesn't depend on it */ }
}

// The losing sound the maker picked (2026-10-21): lyder/tap.mp3, played a little lower
// (playbackRate 0.8 — about 4 semitones down, and a bit slower) and twice in a row. The file
// is decoded once; until it has loaded, or if it can't be, the synthesized buzzer above plays.
const TAP_URL = "lyder/tap.mp3", TAP_RATE = 0.8, TAP_TIMES = 2;
let tapBuffer = null, tapLoading = null;
function loadTap() {
  if (tapLoading) return tapLoading;
  audio ??= new AudioContext();
  tapLoading = fetch(TAP_URL).then(r => r.arrayBuffer())
    .then(data => new Promise((ok, fail) => audio.decodeAudioData(data, ok, fail)))   // the callback form: Chrome 87
    .then(buf => { tapBuffer = buf; return buf; }, () => null);
  return tapLoading;
}
export function buzzer() {
  try {
    audio ??= new AudioContext();
    audio.resume();
    if (!tapBuffer) { loadTap(); return synthBuzzer(); }
    let t = audio.currentTime + 0.02;
    for (let n = 0; n < TAP_TIMES; n++) {
      const src = audio.createBufferSource();
      src.buffer = tapBuffer;
      src.playbackRate.value = TAP_RATE;
      src.connect(audio.destination);
      src.start(t);
      t += tapBuffer.duration / TAP_RATE;
    }
  } catch { /* no sound available — the game doesn't depend on it */ }
}
/** Load the losing sound ahead of time (the first tap on the page). */
export const preloadSounds = () => { try { loadTap(); } catch {} };
