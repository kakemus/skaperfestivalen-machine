// Setup codes for the handheld Metrologic MS5145 barcode scanner, from the
// MetroSelect Configuration Guide (00-02544) — see docs/scanner-setup-codes.png.
// Scanning one changes the scanner's settings (it beeps several tones when
// saved). One code per line: "label | digits".
import { makeTicket, centered, paragraph, rule, font, WIDTH } from "./draw.js";
import { encodeFnc3Digits, modulesOf, drawBars } from "./code128.js";

const CODES = `Scan without the button (CodeGate off) | 118703
Back to needing the button (CodeGate on) | 118713
Enter / exit setup mode | 999999
Blinky scan (laser blinks ~60 s) | 418324
Continuous blinky scan (always on) | 418334
Normal scan | 418304
RESET: factory defaults | 999998`;

const MODULE = 4; // dots per bar unit (0.5 mm) — wide enough for a laser to read easily

export default {
  label: "Scanner setup codes",
  fields: [
    { key: "codes", label: "Codes (label | digits)", type: "textarea", default: CODES },
  ],
  draw(v, { feedMm } = {}) {
    const items = String(v.codes).split("\n").map(line => {
      const [label, digits] = line.split("|").map(s => s && s.trim());
      return label && /^(\d\d)+$/.test(digits || "") ? { label, digits } : null;
    }).filter(Boolean);
    return makeTicket(ctx => {
      let y = 16;
      y = centered(ctx, "SCANNER SETUP", y, 44, { weight: "900" }) + 2;
      y = paragraph(ctx, "Metrologic MS5145. Aim at a code and press the button. A multi-tone beep = saved.", y, 20, { weight: "normal" }) + 6;
      y = rule(ctx, y) + 20;
      for (const { label, digits } of items) {
        y = centered(ctx, label, y, 26, { weight: "bold" }) + 4;
        const vals = encodeFnc3Digits(digits);
        const w = modulesOf(vals) * MODULE;
        drawBars(ctx, vals, Math.round((WIDTH - w) / 2), y, { module: MODULE, height: 110 });
        y += 116;
        ctx.font = font(18, { weight: "normal", family: "Menlo, monospace" });
        ctx.textAlign = "center";
        ctx.fillText(digits.split("").join(" "), WIDTH / 2, y);
        ctx.textAlign = "left";
        y += 50;
      }
      return y;
    }, { feedMm });
  },
};
