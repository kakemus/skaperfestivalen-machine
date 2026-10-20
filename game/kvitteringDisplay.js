// What the IBM till display (2 × 20 characters) shows during Kvitteringsspillet
// (2026-10-20). On the phone it's driven through a small helper in Termux
// (tools/termux-ibm/), since Android's Chrome has no WebHID; phone.js sends these two
// lines a few times a second, the helper skips lines that haven't changed.
//   ready      KVITTERINGSSPILLET / SVAR JA ELLER NEI (taking turns with a teaser)
//   deciding   DU ER 23 ÅR / 1900 KR — no countdown (the maker, 2026-10-20): just the age,
//              ticking up while the player thinks; "SKYND DEG!" blinks in the last 10 s
//   answering  the same, the age standing still while the machine prints
//   over       DU KLARTE DET! / SPILLET ER TAPT / TIDEN ER UTE!  +  DU BLE 67 ÅR
export const LCD_BREDDE = 20;

const midt = t => { t = t.slice(0, LCD_BREDDE); const p = Math.floor((LCD_BREDDE - t.length) / 2); return " ".repeat(p) + t; };

/** [top, bottom] for the game's state right now. `ms` = a clock for the blinking and turns. */
export function lcdLinjer(game, ms) {
  const sp = game.spill, igjen = game.igjenMs;
  const saldo = sp.visning === "venner" ? `${sp.venner.length} VENNER` : `${sp.kroner} KR`;
  switch (game.state) {
    case "ready":
      return [midt("KVITTERINGSSPILLET"), midt(Math.floor(ms / 3000) % 2 ? "HELE LIVET PÅ 4 MIN" : "SVAR JA ELLER NEI")];
    case "deciding":
      if (igjen <= 10000 && Math.floor(ms / 500) % 2) return [midt("SKYND DEG!"), midt(saldo)];
      return [midt(`DU ER ${game.alder} ÅR`), midt(saldo)];
    case "answering":
      return [midt(`DU ER ${game.alder} ÅR`), midt(saldo)];
    case "over":
      return [midt(sp.grunn === "tid" ? "TIDEN ER UTE!" : sp.tapt ? "SPILLET ER TAPT" : "DU KLARTE DET!"),
        midt(`DU BLE ${game.alder} ÅR`)];
    case "pause":
      return [midt("TA KVITTERINGEN!"), midt("TAKK FOR SPILLET")];
    default:                                              // starting, rewinding, resetting
      return [midt("KVITTERINGSSPILLET"), midt("SPOLER TILBAKE ...")];
  }
}
