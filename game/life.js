// The life simulator (2026-10-16, the maker's new concept, replacing the quiz on
// the phone version): you must keep "buying" your way up through life.
//
//   attract ──coin (or JA+NEI)──▶ starting: belt to START, receipt header
//      ▲                              │
//      │                              ▼
//      │            ┌──── deciding: card n shown on the scroll, timer runs ────┐
//      │            │ right choice (JA on a purchase, NEI on a trap):           │
//      │            │   ding + green, a receipt line, belt one screen up ──▶ next card
//      │            │ last card bought: jackpot — rainbow, bells, push, final receipt, cut
//      │            │ wrong choice, or too slow:                                │
//      └── rewind ◀─┴── red, the losing text + total debt, cut ─────────────────┘
//
// Knows nothing about the page or the hardware; everything physical comes in
// through `io`, so it runs with or without the machine attached.
import { after, cancel } from "../core/clock.js";
import { TEXTS } from "./cards.js";
import * as receipt from "./receipt.js";

const HURRY_MS = 10000;      // the light flickers faster and faster for the last 10 s

export function createLifeGame(io) {
  let state = "attract";
  let level = 0;              // index of the card being decided (= the screen the scroll shows)
  let debt = 0;
  let run = 0;                // bumps on every new game/reset, so stale waits stop quietly
  let timers = [];
  const wait = ms => new Promise(resolve => after(ms, resolve));
  const still = id => id === run;
  const stopTimers = () => { timers.forEach(cancel); timers = []; };
  const setState = s => { state = s; io.onState?.({ state, level, debt, card: io.cards()[level] }); };

  function decide(id) {
    if (!still(id)) return;
    const card = io.cards()[level];
    if (!card) return toAttract();
    setState("deciding");
    io.log(`Nivå ${level + 1}: ${card.title} (${card.price} kr, riktig: ${card.buy ? "JA" : "NEI"})`);
    stopTimers();
    const secs = io.seconds();
    timers.push(after(secs * 1000, () => { if (still(id) && state === "deciding") lose(id, TEXTS.tooSlow, "for treig"); }));
    if (secs * 1000 > HURRY_MS) timers.push(after(secs * 1000 - HURRY_MS, () => { if (still(id) && state === "deciding") io.hurry(HURRY_MS); }));
  }

  async function lose(id, text, why) {
    stopTimers();
    setState("lost");
    io.log(`Tapt — ${why}`);
    io.flash(false);                      // red; the board starts the rewind once it's over
    await io.print("Slutt", () => receipt.ending(text, debt));
    if (!still(id)) return;
    await io.cut();
    await Promise.all([io.belt.rewind(), wait(3000)]);
    if (!still(id)) return;
    toAttract();
  }

  async function jackpot(id, card) {
    setState("won");
    debt += card.price;
    io.log("JACKPOT");
    io.celebrate();                       // rainbow; the rewind below waits for it on the board
    io.bell(3);
    io.notify?.(`Noen trykket JA på nivå ${level + 1}: ${card.title}`);
    await io.print("Sluttkvittering", () => receipt.jackpot(level + 1, card, debt, io.finalText()));
    if (!still(id)) return;
    await io.cut();
    await wait(10000);
    if (!still(id)) return;
    await io.belt.rewind();
    if (!still(id)) return;
    toAttract();
  }

  function toAttract() {
    stopTimers();
    level = 0;
    debt = 0;
    setState("attract");
    io.idle?.();
  }

  return {
    get state() { return state; },
    get level() { return level; },
    get debt() { return debt; },

    /** A coin, or JA + NEI together: a new game — also straight after one ended. */
    async coin() {
      if (!["attract", "won", "lost"].includes(state)) return false;
      const id = ++run;
      stopTimers();
      level = 0;
      debt = 0;
      setState("starting");
      io.log("Nytt spill");
      await Promise.all([io.belt.rewind(), io.print("Kvittering", () => receipt.header())]);
      decide(id);
      return true;
    },

    /** JA (true) or NEI (false). */
    async answer(yes) {
      if (state !== "deciding") return;
      const id = run;
      stopTimers();
      const cards = io.cards(), card = cards[level];
      if (yes !== card.buy) {
        const text = card.lose || (card.buy ? TEXTS.shouldHaveBought : TEXTS.shouldNotHaveBought);
        return lose(id, text, yes ? "kjøpte en felle" : "takket nei");
      }
      if (level >= cards.length - 1) return jackpot(id, card);
      setState("climbing");
      io.flash(true);                     // green; the board starts the step once it's over
      io.bell(1);
      if (yes) {
        debt += card.price;
        io.print(`Nivå ${level + 1}`, () => receipt.bought(level + 1, card, debt));
      } else {
        io.print(`Nivå ${level + 1}`, () => receipt.refused(level + 1, card, TEXTS.refused));
      }
      level++;
      await Promise.all([io.belt.step(), wait(1500)]);
      decide(id);
    },

    /** Operator: stop whatever runs and go back to START. */
    async reset() {
      const id = ++run;
      stopTimers();
      setState("resetting");
      await io.belt.rewind();
      if (!still(id)) return;
      toAttract();
    },
  };
}
