// The life simulator's receipt (2026-10-16): the printer is the only "screen",
// so the whole game is one continuous till receipt — a header when the game
// starts, a line per card, and an ending that is cut off. Each part is its own
// small print (no feed in between, so it reads as one strip); only endings get
// the feed that carries the last line past the cutter.
import { makeTicket, centered, paragraph, rule, stamp, font, MONO, WIDTH, MARGIN } from "../tickets/draw.js";
import { kroner } from "./cards.js";

const mono = (size, weight = "normal") => font(size, { weight, family: MONO });

/** Text left and right on one line (the right part right-aligned). */
function leftRight(ctx, left, right, y, size, weight) {
  ctx.font = mono(size, weight);
  ctx.textAlign = "left";
  ctx.fillText(left, MARGIN, y);
  ctx.textAlign = "right";
  ctx.fillText(right, WIDTH - MARGIN, y);
  ctx.textAlign = "left";
  return y + Math.round(size * 1.3);
}

export function header() {
  return makeTicket(ctx => {
    let y = 14;
    y = centered(ctx, "LIVET AS", y, 64, { weight: "900" }) + 2;
    ctx.font = mono(20);
    y = centered(ctx, "TRANSAKSJONSLOGG", y, 22, { weight: "normal", family: MONO });
    y = centered(ctx, stamp() + "   KASSE 1", y, 20, { weight: "normal", family: MONO }) + 6;
    return rule(ctx, y, { dashed: true, thick: 2 }) + 10;
  }, { feedMm: 0 });
}

/** A card bought: its level, title, price — and the debt it brings you to. */
export function bought(level, card, debt) {
  return makeTicket(ctx => {
    let y = 4;
    ctx.font = mono(24, "bold");
    y = paragraphLeft(ctx, `NIVÅ ${level}  ${card.title.toUpperCase()}`, y, 24, "bold");
    y = leftRight(ctx, "", `${kroner(card.price)} kr`, y, 24, "bold");
    y = leftRight(ctx, "GJELD", `${kroner(debt)} kr`, y, 18, "normal");
    return y + 8;
  }, { feedMm: 0 });
}

/** A trap card refused. */
export function refused(level, card, text) {
  return makeTicket(ctx => {
    let y = 4;
    y = paragraphLeft(ctx, `NIVÅ ${level}  ${card.title.toUpperCase()}`, y, 24, "bold");
    y = leftRight(ctx, "", text, y, 24, "bold");
    return y + 8;
  }, { feedMm: 0 });
}

/** Game over: the losing text, the debt you leave with — then fed past the cutter. */
export function ending(text, debt) {
  return makeTicket(ctx => {
    let y = rule(ctx, 6, { thick: 3 }) + 12;
    y = leftRight(ctx, "TOTAL GJELD", `${kroner(debt)} kr`, y, 22, "bold") + 8;
    y = paragraph(ctx, text, y, 34, { weight: "900" }) + 10;
    return rule(ctx, y, { thick: 3 }) + 6;
  }, { feedMm: 15 });
}

/** The jackpot: the big final block, then fed past the cutter. */
export function jackpot(level, card, debt, finalText) {
  return makeTicket(ctx => {
    let y = rule(ctx, 6, { thick: 3 }) + 4;
    y = rule(ctx, y + 4, { thick: 3 }) + 14;
    y = paragraphLeft(ctx, `NIVÅ ${level}: ${card.title.toUpperCase()}`, y, 24, "bold");
    y = leftRight(ctx, "", `${kroner(card.price)} NOK`, y, 26, "bold");
    y = leftRight(ctx, "TOTAL GJELD", `${kroner(debt)} kr`, y, 22, "bold") + 12;
    const lines = String(finalText).split("\n");
    for (const [i, l] of lines.entries()) {
      const last = i === lines.length - 1;
      if (last) y = rule(ctx, y + 4, { thick: 3 }) + 14;
      y = paragraph(ctx, l, y, last ? 36 : 22, { weight: last ? "900" : "normal", family: last ? undefined : MONO }) + 6;
    }
    return rule(ctx, y + 4, { thick: 3 }) + 6;
  }, { feedMm: 15 });
}

/** Left-aligned, word-wrapped text. Returns the y below it. */
function paragraphLeft(ctx, text, y, size, weight) {
  ctx.font = mono(size, weight);
  ctx.textAlign = "left";
  const words = String(text).split(" ");
  let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > WIDTH - 2 * MARGIN && line) {
      ctx.fillText(line, MARGIN, y);
      y += Math.round(size * 1.25);
      line = w;
    } else line = test;
  }
  if (line) { ctx.fillText(line, MARGIN, y); y += Math.round(size * 1.25); }
  return y;
}
