// The slot-machine prize ticket: three reels, a result and a serial number.
import { makeTicket, centered, paragraph, rule, serial, stamp, pick, font, MONO, WIDTH, MARGIN, INNER } from "./draw.js";

const SYMBOLS = ["7", "★", "♥", "☾", "$", "♣", "◆", "☂"];
const RESULTS = [
  ["JACKPOT!", "Show this ticket to someone and smile."],
  ["SO CLOSE", "The machine believes in you. Try again."],
  ["BONUS", "You win: one compliment from a stranger."],
  ["LUCKY", "Something good happens before Sunday."],
];

export default {
  label: "Prize ticket",
  fields: [
    { key: "header", label: "Header", default: "SKAPERFESTIVALEN" },
    { key: "reels", label: "Reels (3 symbols)", default: "7 7 7" },
    { key: "result", label: "Result", default: "JACKPOT!" },
    { key: "message", label: "Message", type: "textarea", default: "Show this ticket to someone and smile." },
    { key: "footer", label: "Footer", default: "NOT VALID AS MONEY" },
  ],
  randomize() {
    const win = Math.random() < 0.25;
    const a = pick(SYMBOLS);
    const reels = win ? [a, a, a] : [a, pick(SYMBOLS), pick(SYMBOLS)];
    const [result, message] = win ? RESULTS[0] : pick(RESULTS.slice(1));
    return { reels: reels.join(" "), result, message };
  },
  draw(v, { feedMm } = {}) {
    const no = serial(), when = stamp();
    return makeTicket(ctx => {
      let y = 20;
      y = centered(ctx, v.header, y, 40, { weight: "900" }) + 6;
      y = rule(ctx, y) + 18;

      // three reels in boxes
      const reels = String(v.reels).trim().split(/\s+/).slice(0, 3);
      while (reels.length < 3) reels.push("?");
      const gap = 16, box = (INNER - gap * 2) / 3, h = 150;
      reels.forEach((s, i) => {
        const x = MARGIN + i * (box + gap);
        ctx.lineWidth = 5;
        ctx.strokeRect(x, y, box, h);
        ctx.font = font(110);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(s, x + box / 2, y + h / 2 + 4);
      });
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      y += h + 24;

      // the result, white on a black band
      ctx.fillRect(MARGIN, y, INNER, 96);
      ctx.fillStyle = "#fff";
      centered(ctx, v.result, y + 14, 72, { weight: "900" });
      ctx.fillStyle = "#000";
      y += 96 + 20;

      y = paragraph(ctx, v.message, y, 28, { weight: "normal" }) + 14;
      y = rule(ctx, y, { dashed: true, thick: 2 }) + 12;
      ctx.font = font(20, { weight: "normal", family: MONO });
      ctx.fillText(`NO. ${no}`, MARGIN, y);
      ctx.textAlign = "right";
      ctx.fillText(when, WIDTH - MARGIN, y);
      ctx.textAlign = "left";
      y += 30;
      return centered(ctx, v.footer, y, 18, { weight: "normal", family: MONO }) + 4;
    }, { feedMm });
  },
};
