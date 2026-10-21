// What the IBM till display (2 × 20 characters) shows during Kvitteringsspillet
// (2026-10-20). On the phone it's driven through a small helper in Termux
// (tools/termux-ibm/), since Android's Chrome has no WebHID; phone.js sends these two
// lines a few times a second, the helper skips lines that haven't changed.
//   ready      KVITTERINGSSPILLET / SVAR JA ELLER NEI (taking turns with a teaser)
//   deciding   DU ER 23 ÅR / 1900 KR — no countdown (the maker, 2026-10-20): just the age, as of
//              the last answer; "SKYND DEG!" blinks in the last 10 s
//   answering  the same, the age standing still while the machine prints
//   over       DU KLARTE DET! / SPILLET ER TAPT / TIDEN ER UTE!  +  DU BLE 80 ÅR
export const LCD_BREDDE = 20;
// 20 characters each; ^ = up, at the printer. The arrows blink, the words stand still.
const pil = (tekst, on) => on ? `^ ${tekst} ^` : `  ${tekst}  `;
const LES = on => pil("LES KVITTERINGEN", on), TA = on => pil("TA KVITTERINGEN!", on);

const midt = t => { t = t.slice(0, LCD_BREDDE); const p = Math.floor((LCD_BREDDE - t.length) / 2); return " ".repeat(p) + t; };

// A minute standing ready with nobody playing: the display turns into a lure (the light and the
// bell join in from phone.js), until someone presses.
export const LOKK_ETTER_MS = 60000;

/** [top, bottom] for the game's state right now. `ms` = a clock for the blinking and turns;
 *  `klarMs` = how long the machine has stood ready (for the lure). */
export function lcdLinjer(game, ms, klarMs = 0) {
  const sp = game.spill, igjen = game.igjenMs, skift = Math.floor(ms / 2000) % 2 === 1;
  const blink = Math.floor(ms / 500) % 2 === 0;                    // arrows on / off
  const runde = (...ord) => midt(ord[Math.floor(ms / 1000) % ord.length]);   // the result: a word a second
  // the age as of the last answer — not ticking live: a changing number distracted players in
  // the user test (2026-10-21), so it moves on only when they choose
  const alder = game.alder;
  const saldo = sp.visning === "venner" ? `${sp.venner.length} VENNER` : `${sp.kroner} KR`;
  switch (game.state) {
    // Waiting: the display points right, at the question in the scroll window (user test,
    // 2026-10-21: people liked the machine but didn't get the game); after a minute, a lure.
    case "ready":
      if (klarMs >= LOKK_ETTER_MS && Math.floor(ms / 4000) % 2)
        return blink ? [midt("TRYKK JA ELLER NEI"), midt("FOR Å STARTE!")] : ["", ""];
      return [midt(blink ? "LES SPØRSMÅLET >>>" : "LES SPØRSMÅLET    "), midt("JA/NEI FOR Å STARTE")];
    case "deciding":
      if (igjen <= 10000 && Math.floor(ms / 500) % 2) return [midt("SKYND DEG!"), midt(saldo)];
      return [midt(`DU ER ${alder} ÅR`), midt(saldo)];
    // From the moment an answer is pressed the display says how it went and points up at the
    // receipt (the printer sits above it): three screens talking at once confused people in the
    // maker's user test (2026-10-21), so this one sends them to the receipt.
    case "answering":
      if (game.nr === 1 && !sp.tapt) return [runde("LIVET ER I GANG!", "IKKE GÅ I MINUS!"), LES(blink)];   // the first answer: the goal
      return [sp.tapt ? runde("GAME OVER", "FEIL VALG") : runde("RIKTIG VALG!", "DU LEVER VIDERE"), LES(blink)];
    case "over":
      if (!sp.tapt) return [runde("DU KLARTE DET!", `DU BLE ${game.alder} ÅR`), LES(blink)];
      return [sp.grunn === "tid" ? runde("TIDEN ER UTE!", "TILBAKE TIL START")
        : runde("GAME OVER", "FEIL VALG", "TILBAKE TIL START"), LES(blink)];
    case "pause":
    case "rewinding":
      return [TA(blink), midt(skift ? "TAKK FOR SPILLET" : "OG TA DEN MED DEG")];
    default:                                              // starting, rewinding, resetting
      return [midt("KVITTERINGSSPILLET"), midt("SPOLER TILBAKE ...")];
  }
}
