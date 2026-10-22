// What the IBM display (2 × 20) says during Tankeleseren (2026-10-22). Same job as
// kvitteringDisplay.js: phone.js sends these two lines a few times a second.
// The window with the strip is to the right of the display (>>>), the printer above it (^).
import { TEKST } from "./tankeleserData.js";

const B = 20;
const midt = t => { t = t.slice(0, B); const p = Math.floor((B - t.length) / 2); return " ".repeat(p) + t; };
const pil = (t, on) => on ? `^ ${t} ^` : `  ${t}  `;

export const LOKK_ETTER_MS = 300000;   // as Kvitteringsspillet: the lure after 5 min (if switched on)

/** [top, bottom] for the game's state. ms = a clock for blinking; klarMs = how long it has stood ready. */
export function lcdLinjer(game, ms, klarMs = 0) {
  const blink = Math.floor(ms / 500) % 2 === 0, side = Math.floor(ms / 2500) % 2;
  const prikker = ".".repeat(1 + Math.floor(ms / 400) % 3);
  const d = game.dyr;
  switch (game.state) {
    case "ready":
      if (klarMs >= LOKK_ETTER_MS && Math.floor(ms / 4000) % 2)
        return blink ? [midt("JEG KAN LESE"), midt("TANKENE DINE!")] : ["", ""];
      return side ? [midt("TENK PÅ ETT AV"), midt(blink ? "DYRENE HER >>>" : "DYRENE HER    ")]
        : [midt(TEKST.tittel), midt("TRYKK JA FOR START")];
    case "asking": {
      const [a, b] = game.node.skjerm;
      return b ? [midt(a), midt(b)] : [midt(a), midt(blink ? "JA ELLER NEI?" : "")];
    }
    case "thinking":
      return [midt("HMMMMM" + prikker.padEnd(3)), midt("JEG LESER TANKER")];
    case "guessing":
      return [midt(`ER DET EN ${d.navn}?`), midt(blink ? "JA ELLER NEI?" : "")];
    case "result":
    case "pause":
      if (game.riktig === true) return [midt(side ? "JEG VISSTE DET!" : `EN ${d.navn}!`), midt(pil("TA BEVISET!", blink))];
      if (game.riktig === false) return [midt(side ? "DU LURTE MEG!" : "HVA VAR DET?"), midt(pil("TA DIPLOMET", blink))];
      return [midt("HALLO?"), midt("ER DU DER?")];
    case "rewinding":
      return [midt("TAKK FOR LEKEN!"), midt("SPOLER TILBAKE" + prikker)];
    default:
      return [midt(TEKST.tittel), midt("SPOLER TILBAKE ...")];
  }
}
