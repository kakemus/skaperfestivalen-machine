// Just text — for test prints and quick notes.
import { makeTicket, centered, paragraph } from "./draw.js";

export default {
  label: "Plain text",
  fields: [
    { key: "title", label: "Title", default: "HELLO" },
    { key: "body", label: "Text", type: "textarea", default: "This is a test print." },
    { key: "size", label: "Text size", type: "number", default: 32 },
  ],
  draw(v, { feedMm } = {}) {
    return makeTicket(ctx => {
      let y = 20;
      if (v.title) y = centered(ctx, v.title, y, 56, { weight: "900" }) + 12;
      return paragraph(ctx, v.body, y, Number(v.size) || 32, { weight: "normal" }) + 10;
    }, { feedMm });
  },
};
