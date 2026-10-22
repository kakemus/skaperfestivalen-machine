// Tankeleseren — the game (2026-10-22, plan B). What it says and shows is in tankeleserData.js;
// this is the order of things. Same machine, same `io` as Kvitteringsspillet (phone.js builds it),
// plus belt.up(n) to jump straight to an animal.
//   ready      belt on START (the eight animals); JA or NEI begins
//   asking     the display asks; each answer is a small line on the receipt
//   thinking   "HMMM …" for a moment, then the belt jumps to the animal it worked out
//   guessing   ER DET EN KATT?  JA → the win light, bell, a "proof" receipt
//                               NEI → the belt goes on to DU LURTE MEG!, a diploma
//   result     the receipt prints and is cut, a few seconds to take it
//   rewinding  back to START, ready again
// Nobody answering for SVAR_MS while asking or guessing: back to START.
import { DYR, SPORSMAL } from "./tankeleserData.js";

export const SKJERMER = DYR.length + 2;          // START, the animals, DU LURTE MEG!
const TENKE_MS = 2500;                           // "HMMM …" before the belt moves
const AVSLOR_MS = 1200;                          // after the belt stops, before the question
const SVAR_MS = 45000;                           // nobody answering: back to START
const PAUSE_MS = 7000;                           // time to take the receipt
const PRINT_LIMIT_MS = 20000;
const BELT_LIMIT_MS = 70000;

export function createTankeleserGame(io) {
  let state = "attract";
  let node = SPORSMAL, nr = 0, dyr = null, riktig = null;
  let run = 0, timer = null;

  const wait = ms => new Promise(resolve => io.after(ms, resolve));
  const within = (ms, p) => Promise.race([Promise.resolve(p).catch(e => io.log("Feil: " + e.message)), wait(ms)]);
  const still = id => id === run;
  const stopTimer = () => { if (timer) io.cancel(timer); timer = null; };
  const print = (label, what, ...args) => within(PRINT_LIMIT_MS, io.print(label, what, ...args));

  function setState(s) {
    state = s;
    io.onState?.({ state, nr, node, dyr, riktig });
  }

  // a question or a guess waits for an answer, but not forever
  function waitForAnswer(id) {
    stopTimer();
    timer = io.after(SVAR_MS, () => {
      if (!still(id)) return;
      io.log("Ingen svarte — tilbake til START");
      finish(id, null);
    });
  }

  function toReady() {
    stopTimer();
    node = SPORSMAL; nr = 0; dyr = null; riktig = null;
    setState("ready");
    io.idle?.();
  }

  async function ask(id, next) {
    if (typeof next === "string") return guess(id, DYR.find(d => d.id === next));
    node = next;
    nr++;
    setState("asking");
    waitForAnswer(id);
  }

  async function guess(id, d) {
    stopTimer();
    dyr = d;
    setState("thinking");
    io.log(`Gjetter: ${d.navn}`);
    await wait(TENKE_MS);
    if (!still(id)) return;
    await within(BELT_LIMIT_MS, io.belt.up(DYR.indexOf(d) + 1));
    if (!still(id)) return;
    io.flash?.("white");
    io.bell?.(1);
    await wait(AVSLOR_MS);
    if (!still(id)) return;
    setState("guessing");
    waitForAnswer(id);
  }

  // riktig: true (guessed it), false (fooled), null (nobody answered)
  async function finish(id, svar) {
    stopTimer();
    riktig = svar;
    setState("result");
    if (svar === true) {
      io.log(`Riktig: ${dyr.navn}`);
      io.celebrate?.();
      await print("Bevis", "bevis", dyr);
    } else if (svar === false) {
      io.log(`Lurt! (gjettet ${dyr.navn})`);
      io.flash?.("fooled");
      await within(BELT_LIMIT_MS, io.belt.up(DYR.length + 1 - (DYR.indexOf(dyr) + 1)));
      if (!still(id)) return;
      await print("Diplom", "diplom");
    }
    if (!still(id)) return;
    if (nr > 0) await within(PRINT_LIMIT_MS, io.cut());      // something was printed: cut it off
    if (!still(id)) return;
    if (svar !== null) {
      setState("pause");
      await wait(PAUSE_MS);
      if (!still(id)) return;
    }
    setState("rewinding");
    await within(BELT_LIMIT_MS, io.belt.rewind());
    if (!still(id)) return;
    toReady();
  }

  return {
    get state() { return state; },
    get nr() { return nr; },
    get node() { return node; },
    get dyr() { return dyr; },
    get riktig() { return riktig; },

    async start() {
      if (state !== "attract") return false;
      const id = ++run;
      setState("starting");
      await within(BELT_LIMIT_MS, io.belt.rewind());
      if (!still(id)) return false;
      toReady();
      return true;
    },

    /** JA (true) or NEI (false). Either one starts from ready (and is not an answer). */
    async answer(yes) {
      if (state === "ready") {
        const id = ++run;
        io.log("Nytt spill (Tankeleseren)");
        io.flash?.(true);
        print("Start", "topp");
        return ask(id, SPORSMAL);
      }
      const id = run;
      if (state === "asking") {
        stopTimer();
        io.flash?.(true);
        io.log(`${nr}. ${node.kort} ${yes ? "JA" : "NEI"}`);
        print(`Svar ${nr}`, "svar", nr, node.kort, yes);
        return ask(id, yes ? node.ja : node.nei);
      }
      if (state === "guessing") return finish(id, yes);
    },

    async reset() {
      const id = ++run;
      stopTimer();
      setState("resetting");
      await within(BELT_LIMIT_MS, io.belt.rewind());
      if (!still(id)) return;
      toReady();
    },
  };
}

/** Every animal reachable exactly once (checked by the page at start; a typo in the data shows in the log). */
export function sjekkTre() {
  const seen = [];
  (function walk(n) { if (typeof n === "string") seen.push(n); else { walk(n.ja); walk(n.nei); } })(SPORSMAL);
  const ids = DYR.map(d => d.id);
  return ids.filter(i => seen.filter(s => s === i).length !== 1).concat(seen.filter(s => !ids.includes(s)));
}
