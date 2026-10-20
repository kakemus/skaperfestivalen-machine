// Kvitteringsspillet på maskinen (Aksels manus, 2026-10-20): et helt liv på 10 minutter.
//
//   start() once at power-on ──▶ starting: belt to START
//                                    │
//      ┌─────────────────────────────▼
//      │   ready: question 1 on the scroll, no clock — the machine just waits
//      │      │ the first JA / NEI starts the game: receipt header + answer,
//      │      │   and the life clock from then on
//      │      ▼
//      │      ┌── deciding: question n on the scroll, the life clock runs ──┐
//      │      │ JA / NEI: the answer's steps → receipt lines with your age, │
//      │      │   green + ding + belt one screen up ──▶ next question       │
//      │      │ lost (kroner, venner, død), the last question answered,     │
//      │      │   or the 10 min used up ("Tiden er ute. Du ble 67 år.")    │
//      │      └──────────────▶ over: ending printed, cut ─────────────────┘
//      │                              │
//      └── rewinding: belt back to START ◀── 5 s to take the receipt ◀───┘
//
// The receipt is printed line by line, LINJE_MS per line, so the player can
// read it as it comes out. The life clock only runs while the player is
// choosing — not while the machine prints or moves the belt, so the 10 min are
// the player's own and the reading time is free.
// JA = the question's first answer, NEI = its second (spørsmål 2: JA = Venner).
// Knows nothing about the page or the hardware: everything physical comes in
// through `io`, so the same game runs on the machine, in simulator.html and in
// tests/kvittering.test.mjs. Every wait on the machine has a time limit, so a
// stuck printer or belt can never stop the game for good.
import { MANUS } from "./manus.js";
import * as motor from "./kvitteringMotor.js";

export const LIVSTID_MS = 600000;         // a whole life … (60 s until 2026-10-20: ~6 s a question was too short)
export const LEVEALDER = 67;              // … is 67 years
export const PAUSE_ETTER_SLUTT_MS = 5000;
export const LINJE_MS = 500;              // per printed line of text (io.linjeMs() can change it)
const TOM_LINJE_ANDEL = 0.25;             // a blank line is only spacing: a quarter of that
const HURRY_MS = 10000;                   // the light flickers faster for the last 10 s of life
const PRINT_LIMIT_MS = 20000;             // longest wait for a print or a cut
const BELT_LIMIT_MS = 70000;              // belt.js gives up on the board after 15 s / 60 s itself

export function createKvitteringGame(io, manus = MANUS) {
  let state = "attract";
  let nr = 0;                 // index of the question being decided (= the screen the scroll shows)
  let spill = motor.nyttSpill();
  let brukt = 0;              // ms of life used up by earlier questions
  let startet = 0;            // when the current question started counting
  let run = 0;                // bumps on every new game/reset, so stale waits stop quietly
  let timers = [];

  const wait = ms => new Promise(resolve => io.after(ms, resolve));
  const within = (ms, promise) => Promise.race([Promise.resolve(promise).catch(e => io.log("Feil: " + e.message)), wait(ms)]);
  const still = id => id === run;
  const stopTimers = () => { timers.forEach(io.cancel); timers = []; };
  const alder = () => Math.min(LEVEALDER, Math.floor(brukt * LEVEALDER / LIVSTID_MS));
  const valgFor = s => Object.keys(s.svar);

  // One line at a time, each given its reading time; stops if the game was reset meanwhile.
  // A printer that doesn't answer is waited for once (PRINT_LIMIT_MS); after that the game
  // only keeps its reading pace until a print gets through again, instead of waiting per line.
  let printerStuck = false;
  async function print(id, label, lines) {
    for (const line of lines) {
      if (!still(id)) return;
      const ms = (io.linjeMs?.() ?? LINJE_MS) * (line ? 1 : TOM_LINJE_ANDEL);
      // the watch is cancelled as soon as the line is out — otherwise it would go off
      // 20 s later anyway and call a working printer stuck
      let watch = null;
      const limit = new Promise(resolve => {
        watch = io.after(PRINT_LIMIT_MS, () => {
          if (!printerStuck) io.log("Skriveren svarer ikke");
          printerStuck = true;
          resolve();
        });
      });
      const printed = Promise.resolve(io.print(label, [line])).then(
        () => { printerStuck = false; },
        e => io.log("Utskrift feilet: " + e.message)).finally(() => io.cancel(watch));
      await Promise.all([wait(ms), printerStuck ? null : Promise.race([printed, limit])]);
    }
  }

  function setState(s) {
    state = s;
    const sporsmal = manus.sporsmal[nr];
    io.onState?.({
      state, nr, sporsmal, spill, alder: alder(),
      igjenMs: LIVSTID_MS - brukt, valg: sporsmal ? valgFor(sporsmal) : [],
    });
  }

  function decide(id) {
    if (!still(id)) return;
    setState("deciding");
    const igjen = LIVSTID_MS - brukt;
    io.log(`Spørsmål ${nr + 1}, ${alder()} år, ${Math.round(igjen / 1000)} s igjen`);
    startet = io.now();
    stopTimers();
    timers.push(io.after(igjen, () => { if (still(id) && state === "deciding") timeUp(id); }));
    if (igjen <= HURRY_MS) io.hurry?.(igjen);
    else timers.push(io.after(igjen - HURRY_MS, () => { if (still(id) && state === "deciding") io.hurry?.(HURRY_MS); }));
  }

  function timeUp(id) {
    stopTimers();
    brukt = LIVSTID_MS;
    motor.tidenErUte(spill, LEVEALDER);
    io.log("Tiden er ute");
    return over(id);
  }

  async function over(id) {
    stopTimers();
    setState("over");
    const won = !spill.tapt;
    io.log(won ? "Vunnet" : `Tapt (${spill.grunn})`);
    if (won) { io.celebrate?.(); io.bell?.(3); } else io.flash?.(false);
    await print(id, "Slutt", ["", ...motor.sluttLinjer(spill, manus.avslutning)]);
    if (!still(id)) return;
    await within(PRINT_LIMIT_MS, io.cut());
    if (!still(id)) return;
    // the player gets 5 s to take the receipt, then the belt goes back to START
    setState("pause");
    await wait(PAUSE_ETTER_SLUTT_MS);
    if (!still(id)) return;
    setState("rewinding");
    await within(BELT_LIMIT_MS, io.belt.rewind());
    if (!still(id)) return;
    toReady();
  }

  // Question 1 waits on the scroll; nothing is printed and no clock runs until
  // someone answers it, so the machine can stand ready all day.
  function toReady() {
    stopTimers();
    nr = 0;
    brukt = 0;
    spill = motor.nyttSpill();
    setState("ready");
    io.idle?.();
  }

  return {
    get state() { return state; },
    get nr() { return nr; },
    get spill() { return spill; },
    get alder() { return alder(); },
    /** ms of life left, counting the question being decided right now */
    get igjenMs() { return LIVSTID_MS - brukt - (state === "deciding" ? io.now() - startet : 0); },

    /** Power-on (once, by the page): belt to START, then question 1 stands ready.
     *  After every game the machine gets ready again by itself. */
    async start() {
      if (state !== "attract") return false;
      const id = ++run;
      setState("starting");
      await within(BELT_LIMIT_MS, io.belt.rewind());
      if (!still(id)) return false;
      toReady();
      return true;
    },

    /** JA (true) or NEI (false). The first answer to question 1 starts the game;
     *  otherwise ignored unless a question is waiting for an answer — so the 5 s
     *  after a game always belong to the player who just finished. */
    async answer(yes) {
      if (state !== "deciding" && state !== "ready") return;
      const s = manus.sporsmal[nr], valg = valgFor(s);
      const v = valg.length === 1 ? valg[0] : valg[yes ? 0 : 1];
      if (!v) return;
      const first = state === "ready";
      const id = first ? ++run : run;
      stopTimers();
      if (!first) brukt = Math.min(LIVSTID_MS, brukt + io.now() - startet);
      setState("answering");
      if (first) io.log("Nytt spill");
      const lines = ["", motor.svarLinje(s.nr, v, alder()), ...motor.spillSvar(spill, s, v)];
      // the receipt header is its own "Start" print (the phone draws it as the big top)
      const printAnswer = async () => {
        if (first) await print(id, "Start", [manus.tittel.toUpperCase(), "=".repeat(motor.BREDDE)]);
        await print(id, `Svar ${s.nr}`, lines);
      };
      io.log(`${s.nr}. ${v} (${alder()} år)`);
      nr++;
      if (spill.tapt || nr >= manus.sporsmal.length) {
        await printAnswer();
        if (!still(id)) return;
        return over(id);
      }
      io.flash?.(true);
      io.bell?.(1);
      // the belt shows the next question while the answer is still printing
      await Promise.all([printAnswer(), within(BELT_LIMIT_MS, io.belt.step())]);
      decide(id);
    },

    /** Operator: stop whatever runs and go back to START. */
    async reset() {
      const id = ++run;
      stopTimers();
      setState("resetting");
      await within(BELT_LIMIT_MS, io.belt.rewind());
      if (!still(id)) return;
      toReady();
    },
  };
}
