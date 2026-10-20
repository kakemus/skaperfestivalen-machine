// Kvitteringsspillet på maskinen (Aksels manus, 2026-10-20): et helt liv på 60 sekunder.
//
//   attract ──JA+NEI──▶ starting: belt to START, receipt header
//      ▲                    │
//      │                    ▼
//      │      ┌── deciding: question n on the scroll, the life clock runs ──┐
//      │      │ JA / NEI: the answer's steps → receipt lines with your age, │
//      │      │   green + ding + belt one screen up ──▶ next question       │
//      │      │ lost (kroner, venner, død), the last question answered,     │
//      │      │   or the 60 s used up ("Tiden er ute. Du ble 67 år.")       │
//      │      └──────────────▶ over: ending printed, cut ─────────────────┘
//      │                              │
//      └──── 15 s for the player to take the receipt, belt back to START ◀─┘
//
// The life clock only runs while the player is choosing — not while the
// machine prints or moves the belt, so the 60 s are the player's own.
// JA = the question's first answer, NEI = its second (spørsmål 2: JA = Venner).
// Knows nothing about the page or the hardware: everything physical comes in
// through `io`, so the same game runs on the machine, in simulator.html and in
// tests/kvittering.test.mjs. Every wait on the machine has a time limit, so a
// stuck printer or belt can never stop the game for good.
import { MANUS } from "./manus.js";
import * as motor from "./kvitteringMotor.js";

export const LIVSTID_MS = 60000;          // a whole life …
export const LEVEALDER = 67;              // … is 67 years
export const PAUSE_ETTER_SLUTT_MS = 15000;
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
  const print = (label, lines) => within(PRINT_LIMIT_MS, io.print(label, lines));

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
    await print("Slutt", ["", ...motor.sluttLinjer(spill, manus.avslutning)]);
    if (!still(id)) return;
    await within(PRINT_LIMIT_MS, io.cut());
    if (!still(id)) return;
    // the player gets the receipt; meanwhile the belt goes back to START
    setState("pause");
    await Promise.all([wait(PAUSE_ETTER_SLUTT_MS), within(BELT_LIMIT_MS, io.belt.rewind())]);
    if (!still(id)) return;
    toAttract();
  }

  function toAttract() {
    stopTimers();
    nr = 0;
    brukt = 0;
    spill = motor.nyttSpill();
    setState("attract");
    io.idle?.();
  }

  return {
    get state() { return state; },
    get nr() { return nr; },
    get spill() { return spill; },
    get alder() { return alder(); },
    /** ms of life left, counting the question being decided right now */
    get igjenMs() { return LIVSTID_MS - brukt - (state === "deciding" ? io.now() - startet : 0); },

    /** JA + NEI together (or a coin): a new game. Only from attract, so the
     *  15 s after a game always belong to the player who just finished. */
    async start() {
      if (state !== "attract") return false;
      const id = ++run;
      stopTimers();
      nr = 0;
      brukt = 0;
      spill = motor.nyttSpill();
      setState("starting");
      io.log("Nytt spill");
      await Promise.all([
        within(BELT_LIMIT_MS, io.belt.rewind()),
        print("Start", [manus.tittel.toUpperCase(), "=".repeat(motor.BREDDE)]),
      ]);
      decide(id);
      return true;
    },

    /** JA (true) or NEI (false). Ignored unless a question is waiting for an answer. */
    async answer(yes) {
      if (state !== "deciding") return;
      const s = manus.sporsmal[nr], valg = valgFor(s);
      const v = valg.length === 1 ? valg[0] : valg[yes ? 0 : 1];
      if (!v) return;
      const id = run;
      stopTimers();
      brukt = Math.min(LIVSTID_MS, brukt + io.now() - startet);
      setState("answering");
      const lines = ["", motor.svarLinje(s.nr, v, alder()), ...motor.spillSvar(spill, s, v)];
      io.log(`${s.nr}. ${v} (${alder()} år)`);
      nr++;
      if (spill.tapt || nr >= manus.sporsmal.length) {
        await print(`Svar ${s.nr}`, lines);
        return over(id);
      }
      io.flash?.(true);
      io.bell?.(1);
      await Promise.all([print(`Svar ${s.nr}`, lines), within(BELT_LIMIT_MS, io.belt.step())]);
      decide(id);
    },

    /** Operator: stop whatever runs and go back to START. */
    async reset() {
      const id = ++run;
      stopTimers();
      setState("resetting");
      await within(BELT_LIMIT_MS, io.belt.rewind());
      if (!still(id)) return;
      toAttract();
    },
  };
}
