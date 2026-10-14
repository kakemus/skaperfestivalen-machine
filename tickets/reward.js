// The small slip printed after each correct answer. The game fills in `level`;
// the reward line is picked at random from the list (one per line).
import { makeTicket, centered, paragraph, rule, pick, font, WIDTH } from "./draw.js";

const REWARDS = `Ett usynlig kakestykke
En high five fra maskinen
Lov til å juble høyt
Én (1) ekstra god idé
Et lykketall: 7
En stjerne i boka
Maskinen liker deg litt mer nå
Gratis klem fra nærmeste voksen
Et hemmelig håndtrykk
Ti sekunder med ære`;

export default {
  label: "Reward slip",
  fields: [
    { key: "title", label: "Title ({level} = level reached)", default: "NIVÅ {level}!" },
    { key: "rewards", label: "Rewards (one per line, one is picked)", type: "textarea", default: REWARDS },
    { key: "footer", label: "Footer", default: "FORTSETT Å SVARE!" },
    { key: "wonLabel", label: "Above the reward", default: "DU VANT:" },
    { key: "level", label: "Level (for the preview)", type: "number", default: 3 },
  ],
  randomize() { return { level: 1 + Math.floor(Math.random() * 9) }; },
  draw(v, { feedMm } = {}) {
    const level = Number(v.level) || 1;
    const reward = pick(String(v.rewards).split("\n").map(s => s.trim()).filter(Boolean)) || "";
    return makeTicket(ctx => {
      let y = 16;
      y = centered(ctx, String(v.title).replace("{level}", level), y, 64, { weight: "900" }) + 4;
      ctx.font = font(30);
      ctx.textAlign = "center";
      ctx.fillText("★".repeat(Math.min(level, 10)), WIDTH / 2, y);
      ctx.textAlign = "left";
      y = rule(ctx, y + 44) + 14;
      y = centered(ctx, v.wonLabel ?? "DU VANT:", y, 20, { weight: "normal" }) + 2;
      y = paragraph(ctx, reward, y, 36, { weight: "bold" }) + 10;
      return centered(ctx, v.footer, y, 18, { weight: "normal" }) + 4;
    }, { feedMm });
  },
};
