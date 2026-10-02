// A fortune slip: a short prophecy and some lucky numbers.
import { makeTicket, centered, paragraph, rule, stamp, pick, font, MONO, WIDTH, MARGIN } from "./draw.js";

const FORTUNES = [
  "Something you made will outlive the reason you made it.",
  "Take the wire apart. The answer is inside.",
  "A small machine is thinking about you.",
  "Today, solder. Tomorrow, glory.",
  "The next button you press will matter.",
];

export default {
  label: "Fortune",
  fields: [
    { key: "title", label: "Title", default: "YOUR FORTUNE" },
    { key: "fortune", label: "Fortune", type: "textarea", default: FORTUNES[0] },
    { key: "numbers", label: "Lucky numbers", default: "3  14  27  42" },
  ],
  randomize() {
    const nums = new Set();
    while (nums.size < 4) nums.add(1 + Math.floor(Math.random() * 49));
    return { fortune: pick(FORTUNES), numbers: [...nums].sort((a, b) => a - b).join("  ") };
  },
  draw(v, { feedMm } = {}) {
    const when = stamp();
    return makeTicket(ctx => {
      let y = 24;
      y = centered(ctx, "✦  " + v.title + "  ✦", y, 38, { weight: "900" }) + 10;
      y = rule(ctx, y) + 26;
      y = paragraph(ctx, v.fortune, y, 40, { weight: "bold" }, 1.2) + 20;
      y = rule(ctx, y, { dashed: true, thick: 2 }) + 14;
      y = centered(ctx, "LUCKY NUMBERS", y, 18, { weight: "normal", family: MONO }) + 2;
      y = centered(ctx, v.numbers, y, 34, { family: MONO }) + 12;
      ctx.font = font(16, { weight: "normal", family: MONO });
      ctx.textAlign = "right";
      ctx.fillText(when, WIDTH - MARGIN, y);
      ctx.textAlign = "left";
      return y + 24;
    }, { feedMm });
  },
};
