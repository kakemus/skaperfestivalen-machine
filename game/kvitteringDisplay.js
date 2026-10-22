// What the IBM till display (2 × 20 characters) shows during Kvitteringsspillet.
// On the phone it's driven through a small helper in Termux (tools/termux-ibm/), since
// Android's Chrome has no WebHID; phone.js sends these lines a few times a second, the
// helper skips lines that haven't changed.
//
// Since 2026-10-22 (after a lot of user testing — less noise): the left 18 characters are
// text, one line per row; the right 2 columns hold ONE big arrow over both rows, drawn by
// the helper with custom characters: up = the receipt (the printer sits above the display),
// right = the question on the scroll, down = the buttons. Text and arrow stand still —
// nothing blinks. While playing: what to read on top, the kroner and friends below (they
// change once a choice is made). The life's clock shows only in its last 30 s.
export const LCD_BREDDE = 20;
export const TEKST_BREDDE = 18;
export const LOKK_ETTER_MS = 300000;   // 5 min standing ready → the lure (if switched on in the panel)
const KLOKKE_MS = 30000;               // the clock appears for the last 30 s only

const tid = ms => { const t = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; };
const felt = t => String(t).slice(0, TEKST_BREDDE).padEnd(TEKST_BREDDE);

/** "1900 KR 8 VENNER", shortened until it fits the text field. */
export function saldo(sp) {
  const kr = sp.kroner, v = sp.venner.length;
  return [`${kr} KR ${v} VENNER`, `${kr}KR ${v} VENNER`, `${kr} KR ${v} V`, `${kr}KR ${v}V`]
    .find(t => t.length <= TEKST_BREDDE) || `${kr}KR ${v}V`;
}

/** { top, bottom, pil } for the game's state: top/bottom are the 18-character text field,
 *  pil = "up" | "right" | "down" | null. `ms` is unused now (nothing blinks), kept for the
 *  caller; `klarMs` = how long the machine has stood ready (for the lure). */
export function lcdInnhold(game, ms, klarMs = 0) {
  const sp = game.spill, igjen = game.igjenMs;
  switch (game.state) {
    case "ready":
      if (klarMs >= LOKK_ETTER_MS) return { top: "TRYKK JA ELLER NEI", bottom: "FOR Å STARTE!", pil: "down" };
      return { top: "LES SPØRSMÅLET", bottom: "TRYKK JA ELLER NEI", pil: "right" };
    case "deciding":
      return { top: igjen <= KLOKKE_MS ? `SKYND DEG!   ${tid(igjen)}` : "LES SPØRSMÅLET", bottom: saldo(sp), pil: "right" };
    case "answering":
      return { top: "LES KVITTERINGEN", bottom: saldo(sp), pil: "up" };
    case "over":
    case "pause":
      return { top: sp.tapt ? (sp.grunn === "tid" ? "TIDEN ER UTE!" : "SPILLET ER TAPT") : "DU KLARTE DET!",
        bottom: "TA KVITTERINGEN", pil: "up" };
    case "rewinding":
      return { top: "TAKK FOR SPILLET!", bottom: "SPOLER TILBAKE", pil: null };
    default:                                              // starting, resetting
      return { top: "KVITTERINGSSPILLET", bottom: "SPOLER TILBAKE", pil: null };
  }
}

// The arrow's four custom characters (helper slots 4–7): top-left, top-right, bottom-left,
// bottom-right — so the right 2 columns of both rows show one arrow.
const PIL_TEGN = ["\u0004\u0005", "\u0006\u0007"];

/** [top, bottom, pil]: the two full 20-character lines for the helper, and which arrow its
 *  slots 4–7 should hold. */
export function lcdLinjer(game, ms, klarMs = 0) {
  const { top, bottom, pil } = lcdInnhold(game, ms, klarMs);
  const hoyre = pil ? PIL_TEGN : ["  ", "  "];
  return [felt(top) + hoyre[0], felt(bottom) + hoyre[1], pil];
}
