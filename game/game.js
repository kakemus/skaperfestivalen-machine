// The game, as a small state machine:
//
//   attract ──coin──▶ starting ──▶ asking ──right──▶ step up + ding + reward ──▶ asking …
//                                    │                                 └─ top reached ─▶ won
//                                    └──wrong / too slow──▶ rewind ──▶ attract
//
// It knows nothing about the page or the hardware: everything physical comes
// in through `io` (display text, belt, bell, prints), so the same game runs
// on screen alone or with the real machine attached.
import { after, cancel } from "../core/clock.js";

export function createGame(io) {
  let state = "attract";
  let level = 0;
  let question = null;
  let used = new Set();
  let run = 0;            // bumps on every reset, so stale waits stop quietly
  let answerTimer = null;
  const stopTimer = () => { if (answerTimer) cancel(answerTimer); answerTimer = null; };

  const wait = ms => new Promise(resolve => after(ms, resolve));
  const setState = s => { state = s; io.onState?.({ state, level, question }); };
  // Run `fn` only if no reset happened since `id` was taken.
  const still = id => id === run;

  function pickQuestion() {
    const all = io.questions();
    if (!all.length) return { text: "Ingen spørsmål! Legg til noen.", answer: true };
    if (used.size >= all.length) used.clear();
    let i;
    do i = Math.floor(Math.random() * all.length); while (used.has(i));
    used.add(i);
    return all[i];
  }

  async function ask(id) {
    if (!still(id)) return;
    question = pickQuestion();
    setState("asking");
    io.text(`${question.text} JA ELLER NEI?`);
    stopTimer();
    const asked = question;
    answerTimer = after(io.answerSeconds() * 1000, () => { if (still(id) && state === "asking" && question === asked) lose(id, "TIDEN ER UTE!"); });
    io.log(`Spørsmål ${level + 1}: ${question.text} (${question.answer ? "JA" : "NEI"})`);
  }

  async function lose(id, message) {
    setState("lost");
    io.text(`${message} TILBAKE TIL START...`);
    io.log(`Feil — ${message}`);
    await Promise.all([io.belt.rewind(), wait(4000)]);
    if (!still(id)) return;
    level = 0;
    toAttract();
  }

  async function win(id) {
    setState("won");
    io.text("DU VANT!!!", { blink: true });
    io.log("Vant!");
    io.bell(3);
    io.printWin();
    await wait(9000);
    if (!still(id)) return;
    io.text("TAKK FOR SPILLET!");
    await Promise.all([io.belt.rewind(), wait(3000)]);
    if (!still(id)) return;
    level = 0;
    toAttract();
  }

  function toAttract() {
    setState("attract");
    used.clear();
    io.idle();
  }

  return {
    get state() { return state; },
    get level() { return level; },

    /** A coin (or a scanned card) — starts a game from the attract screen. */
    async coin() {
      if (state !== "attract") return false;
      const id = ++run;
      level = 0;
      setState("starting");
      io.text("MYNT MOTTATT! LA OSS SPILLE!", { blink: true });
      io.log("Mynt — nytt spill");
      await Promise.all([io.belt.rewind(), wait(2500)]);
      ask(id);
      return true;
    },

    /** YES (true) or NO (false) from any button. */
    async answer(yes) {
      if (state !== "asking") return;
      const id = run;
      stopTimer();
      if (yes !== question.answer) return lose(id, `FEIL! SVARET VAR ${question.answer ? "JA" : "NEI"}.`);
      level++;
      setState("climbing");
      io.text("RIKTIG!", { blink: true });
      io.log(`Riktig! Nivå ${level}`);
      io.bell(1);
      if (level < io.belt.last) io.printReward(level);
      await Promise.all([io.belt.step(), wait(1800)]);
      if (!still(id)) return;
      if (level >= io.belt.last) return win(id);
      ask(id);
    },

    /** Stop whatever is going on and go back to the attract screen (operator button). */
    async reset() {
      const id = ++run;
      stopTimer();
      setState("resetting");
      io.text("TILBAKESTILLER...");
      await io.belt.rewind();
      if (!still(id)) return;
      level = 0;
      toAttract();
    },
  };
}
