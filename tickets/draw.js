// Small drawing helpers shared by the ticket designs.
import { PRINT_WIDTH, mmToDots, wrapText } from "../core/raster.js";

export const WIDTH = PRINT_WIDTH;
export const MARGIN = 24;
export const INNER = WIDTH - MARGIN * 2;
export { mmToDots, wrapText };

/**
 * Draw a ticket top-down without knowing its height in advance: `layout(ctx)`
 * draws and returns the y it reached; it runs once to measure and once for real.
 * `feedMm` of blank paper is added at the bottom so the end clears the cutter.
 */
export function makeTicket(layout, { feedMm = 15 } = {}) {
  const measure = document.createElement("canvas");
  measure.width = WIDTH;
  measure.height = 4000;
  const height = Math.ceil(layout(prepare(measure.getContext("2d")))) + mmToDots(feedMm);
  const c = document.createElement("canvas");
  c.width = WIDTH;
  c.height = Math.max(height, 80);
  layout(prepare(c.getContext("2d")));
  return c;
}

function prepare(ctx) {
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.fillStyle = "#000";
  ctx.strokeStyle = "#000";
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  return ctx;
}

export const font = (size, { weight = "bold", family = "Helvetica, Arial, sans-serif" } = {}) => `${weight} ${size}px ${family}`;
export const MONO = "Menlo, Consolas, monospace";

/** Largest font size (≤ max) at which `text` fits in maxWidth. */
export function fitSize(ctx, text, maxWidth, max, opts) {
  let size = max;
  ctx.font = font(size, opts);
  while (size > 8 && ctx.measureText(text).width > maxWidth) ctx.font = font(--size, opts);
  return size;
}

/** Centered single line, shrunk to fit. Returns the y below it. */
export function centered(ctx, text, y, max, opts) {
  const size = fitSize(ctx, text, INNER, max, opts);
  ctx.textAlign = "center";
  ctx.fillText(text, WIDTH / 2, y);
  ctx.textAlign = "left";
  return y + Math.round(size * 1.15);
}

/** Centered, word-wrapped paragraph. Returns the y below it. */
export function paragraph(ctx, text, y, size, opts, lineHeight = 1.25) {
  ctx.font = font(size, opts);
  ctx.textAlign = "center";
  for (const block of String(text).split("\n")) {
    for (const l of wrapText(ctx, block, INNER)) {
      ctx.fillText(l, WIDTH / 2, y);
      y += Math.round(size * lineHeight);
    }
  }
  ctx.textAlign = "left";
  return y;
}

export function rule(ctx, y, { dashed = false, thick = 3 } = {}) {
  ctx.lineWidth = thick;
  ctx.setLineDash(dashed ? [12, 8] : []);
  ctx.beginPath();
  ctx.moveTo(MARGIN, y);
  ctx.lineTo(WIDTH - MARGIN, y);
  ctx.stroke();
  ctx.setLineDash([]);
  return y + thick;
}

export function serial() {
  return String(Math.floor(Math.random() * 1e6)).padStart(6, "0");
}

export function stamp(date = new Date()) {
  const p = n => String(n).padStart(2, "0");
  return `${p(date.getDate())}.${p(date.getMonth() + 1)}.${date.getFullYear()}  ${p(date.getHours())}:${p(date.getMinutes())}`;
}

export const pick = arr => arr[Math.floor(Math.random() * arr.length)];
