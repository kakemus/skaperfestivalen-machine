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
