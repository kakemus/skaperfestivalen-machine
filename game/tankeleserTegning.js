// Tankeleseren on paper (2026-10-22): the strip's screens and the receipt's pieces.
// A picture is bilder/<bilde> when it exists (prepared like Kvitteringsspillet's: background
// away, cropped, dithered — kvitteringTegning.js's forbered), otherwise the animal's emoji,
// drawn big and dithered, so the game works before anyone has found pictures.
import { makeTicket, centered, paragraph, rule, stamp, font, MONO, WIDTH, INNER, MARGIN, mmToDots } from "../tickets/draw.js";
import { autoEnhancePhoto, adjustBrightnessContrast, ditherFloydSteinberg } from "../core/raster.js";
import { forbered, linjer, BILDE } from "./kvitteringTegning.js";
import { DYR, LURT, TEKST } from "./tankeleserData.js";

const EMOJI_FONT = '"Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif';

/** Loads the pictures that exist: { id: Image } ("lurt" for the last screen). */
export function lastBilder() {
  const alle = [...DYR, { ...LURT, id: "lurt" }];
  return Promise.all(alle.map(d => new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve([d.id, img]);
    img.onerror = () => resolve(null);
    img.src = "bilder/" + d.bilde;
  }))).then(list => Object.fromEntries(list.filter(Boolean)));
}

const emojiCache = new Map();
/** An emoji as a black-and-white picture, w × h: drawn big, cropped to its outline, fitted in. */
function emojiBilde(emoji, w, h) {
  const key = emoji + w + "x" + h;
  if (emojiCache.has(key)) return emojiCache.get(key);
  const S = 400, src = document.createElement("canvas");
  src.width = src.height = S * 1.4;
  const sctx = src.getContext("2d");
  sctx.fillStyle = "#fff";
  sctx.fillRect(0, 0, src.width, src.height);
  sctx.textAlign = "center";
  sctx.textBaseline = "middle";
  sctx.font = `${S}px ${EMOJI_FONT}`;
  sctx.fillText(emoji, src.width / 2, src.height / 2);
  const d = sctx.getImageData(0, 0, src.width, src.height).data;
  let x0 = src.width, y0 = src.height, x1 = -1, y1 = -1;
  for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) {
    const i = (y * src.width + x) * 4;
    if (d[i] + d[i + 1] + d[i + 2] < 735) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) { x0 = y0 = 0; x1 = y1 = src.width - 1; }
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  const ow = x1 - x0 + 1, oh = y1 - y0 + 1, k = Math.min(w * 0.96 / ow, h * 0.96 / oh);
  ctx.drawImage(src, x0, y0, ow, oh, (w - ow * k) / 2, (h - oh * k) / 2, ow * k, oh * k);
  // the shape (anything not white), for a black outline: a white dog vanished on white paper
  const before = ctx.getImageData(0, 0, w, h).data, ink = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) ink[i] = before[i * 4] + before[i * 4 + 1] + before[i * 4 + 2] < 735 ? 1 : 0;
  autoEnhancePhoto(c, { gamma: 0.8, clipPercent: 0.5 });
  adjustBrightnessContrast(c, { brightness: 1, contrast: 1.35 });
  ditherFloydSteinberg(ctx, 0, 0, w, h);
  const out = ctx.getImageData(0, 0, w, h), o = out.data, R = Math.max(2, Math.round(w / 130));
  const at = (x, y) => x >= 0 && y >= 0 && x < w && y < h && ink[y * w + x];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!at(x, y)) continue;
    let edge = false;
    for (let dy = -R; dy <= R && !edge; dy++) for (let dx = -R; dx <= R; dx++) if (!at(x + dx, y + dy)) { edge = true; break; }
    if (edge) { const i = (y * w + x) * 4; o[i] = o[i + 1] = o[i + 2] = 0; }
  }
  ctx.putImageData(out, 0, 0);
  emojiCache.set(key, c);
  return c;
}

/** The picture of an animal (or LURT), BILDE.w × BILDE.h. */
function bilde(d, bilder) {
  const img = bilder[d.id || "lurt"];
  return img ? forbered(img) : emojiBilde(d.emoji, BILDE.w, BILDE.h);
}

/** START's picture: all the animals in a grid, each with its name (400 wide). */
function rutenett(bilder) {
  const cols = 4, rows = Math.ceil(DYR.length / cols), cw = 100, ih = 104, nh = 30;
  const c = document.createElement("canvas");
  c.width = cols * cw; c.height = rows * (ih + nh);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  DYR.forEach((d, i) => {
    const x = (i % cols) * cw, y = Math.floor(i / cols) * (ih + nh);
    const p = bilde(d, bilder), k = Math.min((cw - 6) / p.width, ih / p.height);
    ctx.drawImage(p, x + (cw - p.width * k) / 2, y + (ih - p.height * k) / 2, p.width * k, p.height * k);
    ctx.fillStyle = "#000";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    let size = 24;
    do ctx.font = font(size--, { weight: "900" }); while (ctx.measureText(d.navn).width > cw - 4 && size > 10);
    ctx.fillText(d.navn, x + cw / 2, y + ih + 2);
  });
  return c;
}

/** The strip's screens (belt/strip.js draws them): START, one per animal, DU LURTE MEG!. */
export function skjermer(bilder = {}) {
  return [
    { head: TEKST.tittel, image: rutenett(bilder), lines: [TEKST.start], answers: TEKST.startKnapp },
    ...DYR.map(d => ({ head: TEKST.gjetter, image: bilde(d, bilder), lines: [`EN ${d.navn}!`] })),
    { head: TEKST.tittel, image: bilde(LURT, bilder), lines: [LURT.navn] },
  ];
}

// ---------- the receipt ----------
/** The top: the name, date and time. */
export function topp() {
  return makeTicket(ctx => {
    let y = 14;
    y = centered(ctx, TEKST.tittel, y, 64, { weight: "900" }) + 4;
    y = centered(ctx, stamp(), y, 22, { weight: "normal", family: MONO }) + 6;
    return rule(ctx, y, { dashed: true, thick: 2 }) + 6;
  }, { feedMm: 0 });
}

/** One answer: "2. Sier det mjau?        JA". */
export function svar(nr, kort, ja) {
  return linjer([`${nr}. ${kort}`.slice(0, 27).padEnd(28) + (ja ? "  JA" : " NEI")]);
}

/** Guessed right: what you thought of, its picture, a fact. */
export function bevis(d, bilder = {}) {
  return makeTicket(ctx => {
    let y = rule(ctx, 10, { dashed: true, thick: 2 }) + 16;
    y = centered(ctx, TEKST.bevisTopp, y, 34, { weight: "bold" }) + 4;
    y = centered(ctx, `EN ${d.navn}!`, y, 96, { weight: "900" }) + 10;
    const p = bilde(d, bilder);
    ctx.drawImage(p, (WIDTH - p.width) / 2, y);
    y += p.height + 16;
    y = paragraph(ctx, d.fakta, y, 30, { weight: "bold" }) + 14;
    y = paragraph(ctx, TEKST.bevisBunn, y, 22, { weight: "normal" }) + 8;
    return y;
  });
}

/** Fooled: a diploma, and a box to draw your own animal in. */
export function diplom() {
  return makeTicket(ctx => {
    let y = rule(ctx, 10, { dashed: true, thick: 2 }) + 16;
    y = centered(ctx, `★ ${TEKST.diplomTopp} ★`, y, 80, { weight: "900" }) + 10;
    y = paragraph(ctx, TEKST.diplom, y, 32, { weight: "bold" }) + 14;
    const h = mmToDots(55);
    ctx.lineWidth = 4;
    ctx.strokeRect(MARGIN, y, INNER, h);
    y += h + 14;
    y = paragraph(ctx, TEKST.diplomBunn, y, 22, { weight: "normal" }) + 8;
    return y;
  });
}
