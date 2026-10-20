// Kvitteringsspillet on paper (2026-10-20): the receipt the game prints, and the
// question screens for the scroll. game/kvittering.js hands over plain text lines,
// BREDDE (32) characters wide with columns made of spaces, so they're set in a
// monospaced font sized to fit exactly 32 characters across the paper. It prints
// them ONE AT A TIME (2 s apart, for reading), so each piece is exactly its line's
// height: one line printed alone and the same line in a block look the same.
import { makeTicket, centered, rule, stamp, font, MONO, MARGIN, INNER, WIDTH, mmToDots } from "../tickets/draw.js";
import { BREDDE } from "./kvitteringMotor.js";

let monoSize = 0;
function sizeFor(ctx) {
  if (!monoSize) {
    ctx.font = font(100, { weight: "bold", family: MONO });
    monoSize = Math.floor(100 * INNER / ctx.measureText("M".repeat(BREDDE)).width);
  }
  return monoSize;
}

// all-capital lines ("SPILLET ER TAPT", "DU KLARTE DET!") are headings: bold
const heading = l => /\p{Lu}/u.test(l) && !/\p{Ll}/u.test(l);

/** The game's lines as one piece of receipt, no margins above or below (so pieces
 *  join seamlessly). Empty lines = a little space. feedMm: blank paper after it —
 *  only before a cut, so the pieces of one game read as one strip. */
export function linjer(lines, { feedMm = 0 } = {}) {
  const measure = document.createElement("canvas").getContext("2d");
  const size = sizeFor(measure), lh = Math.round(size * 1.3), gap = Math.round(lh * 0.6);
  const height = lines.reduce((h, l) => h + (l ? lh : gap), 0) + mmToDots(feedMm);
  const c = document.createElement("canvas");
  c.width = WIDTH;
  c.height = Math.max(1, height);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = "#000";
  ctx.textBaseline = "top";
  let y = Math.round(size * 0.1);
  for (const l of lines) {
    if (!l) { y += gap; continue; }
    ctx.font = font(size, { weight: heading(l) ? "bold" : "normal", family: MONO });
    ctx.fillText(l, MARGIN, y);
    y += lh;
  }
  return c;
}

/** The top of the receipt: the game's name big, date and time, a dashed rule. */
export function topp(tittel) {
  return makeTicket(ctx => {
    let y = 14;
    y = centered(ctx, String(tittel).toUpperCase(), y, 60, { weight: "900" }) + 4;
    y = centered(ctx, stamp(), y, 22, { weight: "normal", family: MONO }) + 8;
    return rule(ctx, y, { dashed: true, thick: 2 }) + 6;
  }, { feedMm: 0 });
}

/** One scroll screen per question (belt/strip.js draws them): the picture's
 *  description in a box until the real pictures exist, the price, the question,
 *  and which button means what. Screen 0 (START) also says that answering starts. */
export function skjermer(manus) {
  const n = manus.sporsmal.length;
  return manus.sporsmal.map((s, i) => {
    const [ja, nei] = Object.keys(s.svar);
    const plain = /^ja$/i.test(ja) && /^nei$/i.test(nei || "");
    return {
      head: `${s.nr} / ${n}`,
      box: s.bilde || "",
      price: s.pris != null ? `${s.pris} kr` : "",
      lines: s.tekst,
      answers: plain ? "JA   ·   NEI" : `JA = ${ja}   NEI = ${nei}`,
      foot: i === 0 ? "Svar JA eller NEI for å begynne" : "",
    };
  });
}
