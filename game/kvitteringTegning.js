// Kvitteringsspillet on paper (2026-10-20): the receipt the game prints, and the
// question screens for the scroll. game/kvittering.js hands over plain text lines,
// BREDDE (32) characters wide with columns made of spaces, so they're set in a
// monospaced font sized to fit exactly 32 characters across the paper. It prints
// them ONE AT A TIME (2 s apart, for reading), so each piece is exactly its line's
// height: one line printed alone and the same line in a block look the same.
import { makeTicket, centered, rule, stamp, font, MONO, MARGIN, INNER, WIDTH, mmToDots } from "../tickets/draw.js";
import { BREDDE } from "./kvitteringMotor.js";
import { autoEnhancePhoto, adjustBrightnessContrast, ditherFloydSteinberg } from "../core/raster.js";

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
// A clearer hierarchy (2026-10-22, after user testing): each answer starts with its line
// ("3. Ja ------- 23 år") reversed out of a black band; the entries (a name or a post with a
// number on the right, columns made of spaces) stay normal; the story under them — what
// the player is meant to read — is bold. Told apart by shape: the answer line is "n. … år",
// an entry has a run of spaces before its number, story text has only single spaces.
const svarlinje = l => /^\d+\. .*-+ \d+ år$/.test(l);
const post = l => /\S {2,}\S/.test(l);

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
    if (svarlinje(l)) {                             // white on a black band, the dashes as plain space
      ctx.fillRect(0, y - Math.round(size * 0.1), WIDTH, lh);
      ctx.fillStyle = "#fff";
      ctx.font = font(size, { weight: "bold", family: MONO });
      ctx.fillText(l.replace(/-/g, " "), MARGIN, y);
      ctx.fillStyle = "#000";
      y += lh;
      continue;
    }
    ctx.font = font(size, { weight: heading(l) || !post(l) ? "bold" : "normal", family: MONO });
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
    y = centered(ctx, stamp(), y, 22, { weight: "normal", family: MONO }) + 6;
    y = centered(ctx, "MÅL: IKKE GÅ I MINUS", y, 30, { weight: "bold", family: MONO }) + 8;   // the goal, said once (user test, 2026-10-21)
    return rule(ctx, y, { dashed: true, thick: 2 }) + 6;
  }, { feedMm: 0 });
}

// ---------- the pictures on the scroll ----------
// The maker's pictures (500 × 300, the object on plain white) are in bilder/, named as in
// manus.js's "bildefil" but as .png. Each is prepared once: the white connected to the
// picture's edges is the background (a flood fill, so a white object with any shading at
// its edge is kept), the picture is cropped to the object and fitted into the picture
// area, levelled, and dithered — the printer only knows black and white, and the strip
// is backlit, so what's black blocks the light. Per picture, if needed: lys / kontrast
// (1 = unchanged), gamma (< 1 lighter mid-tones), kant = a black outline round the object,
// for a white object that would vanish on white paper.
export const BILDE = { w: 400, h: 240 };      // as wide as the strip's content area (belt/strip.js WIN)
const JUSTER = {
  5: { kant: true },                      // white microscope on white paper
  6: { gamma: 0.6 },                      // the red chair went almost solid: lighter, so its tubes show
  10: { gamma: 0.6, kontrast: 1.3 },      // brown MDF: mid grey on mid grey, came out heavy
};
const bildefil = s => s.bildefil && "bilder/" + s.bildefil.split("/").pop().replace(/\.\w+$/, ".png");

/** Loads the pictures that exist: { questionNr: Image }. A missing one keeps its text box. */
export function lastBilder(manus) {
  return Promise.all(manus.sporsmal.filter(bildefil).map(s => new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve([s.nr, img]);
    img.onerror = () => resolve(null);
    img.src = bildefil(s);
  }))).then(list => Object.fromEntries(list.filter(Boolean)));
}

const ferdige = new Map();
const BAKGRUNN = 246;                     // lighter than this, and touching the edge = background

/** A picture ready for the printer: BILDE.w × BILDE.h, black and white. */
export function forbered(img, { lys = 1, kontrast = 1, gamma = 0.85, kant = false } = {}) {
  if (ferdige.has(img)) return ferdige.get(img);
  // 1. the background: near-white pixels connected to the picture's edge
  const sw = img.naturalWidth, sh = img.naturalHeight;
  const src = document.createElement("canvas");
  src.width = sw; src.height = sh;
  const sctx = src.getContext("2d");
  sctx.fillStyle = "#fff";
  sctx.fillRect(0, 0, sw, sh);
  sctx.drawImage(img, 0, 0);
  const sd = sctx.getImageData(0, 0, sw, sh), d = sd.data;
  const bg = new Uint8Array(sw * sh), stack = [];
  const light = i => d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114 > BAKGRUNN;
  const push = i => { if (!bg[i] && light(i)) { bg[i] = 1; stack.push(i); } };
  for (let x = 0; x < sw; x++) { push(x); push((sh - 1) * sw + x); }
  for (let y = 0; y < sh; y++) { push(y * sw); push(y * sw + sw - 1); }
  while (stack.length) {
    const i = stack.pop(), x = i % sw;
    if (x > 0) push(i - 1);
    if (x < sw - 1) push(i + 1);
    if (i >= sw) push(i - sw);
    if (i < sw * (sh - 1)) push(i + sw);
  }
  // the background pure white; the object's box
  let x0 = sw, y0 = sh, x1 = -1, y1 = -1;
  for (let i = 0; i < bg.length; i++) {
    if (bg[i]) { d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = 255; continue; }
    const x = i % sw, y = (i - x) / sw;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  sctx.putImageData(sd, 0, 0);
  if (x1 < 0) { x0 = 0; y0 = 0; x1 = sw - 1; y1 = sh - 1; }   // nothing found: the whole picture

  // 2. cropped to the object, fitted into the picture area
  const { w, h } = BILDE, ow = x1 - x0 + 1, oh = y1 - y0 + 1, k = Math.min(w / ow, h / oh);
  const dw = Math.round(ow * k), dh = Math.round(oh * k), dx = Math.round((w - dw) / 2), dy = Math.round((h - dh) / 2);
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(src, x0, y0, ow, oh, dx, dy, dw, dh);
  autoEnhancePhoto(c, { gamma, clipPercent: 0.5 });
  adjustBrightnessContrast(c, { brightness: lys, contrast: kontrast });
  ditherFloydSteinberg(ctx, 0, 0, w, h);

  // 3. the outline: object pixels next to background, solid black
  if (kant) {
    const out = ctx.getImageData(0, 0, w, h), o = out.data;
    const inside = (x, y) => {
      if (x < 0 || y < 0 || x >= w || y >= h) return false;
      const sx = Math.floor(x0 + (x - dx) / k), sy = Math.floor(y0 + (y - dy) / k);
      return sx >= x0 && sy >= y0 && sx <= x1 && sy <= y1 && !bg[sy * sw + sx];
    };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!inside(x, y)) continue;
      let edge = false;
      for (let oy = -2; oy <= 2 && !edge; oy++) for (let ox = -2; ox <= 2; ox++) if (!inside(x + ox, y + oy)) { edge = true; break; }
      if (edge) { const i = (y * w + x) * 4; o[i] = o[i + 1] = o[i + 2] = 0; }
    }
    ctx.putImageData(out, 0, 0);
  }
  ferdige.set(img, c);
  return c;
}

/** One scroll screen per question (belt/strip.js draws them): the picture's
 *  description in a box until the real pictures exist, the price, the question,
 *  and which button means what. Screen 0 (START) also says that answering starts. */
export function skjermer(manus, bilder = {}) {
  const n = manus.sporsmal.length;
  return manus.sporsmal.map((s, i) => {
    const [ja, nei] = Object.keys(s.svar);
    const plain = /^ja$/i.test(ja) && /^nei$/i.test(nei || "");
    return {
      head: `${s.nr} / ${n}`,
      box: s.bilde || "",
      image: bilder[s.nr] ? forbered(bilder[s.nr], JUSTER[s.nr]) : null,
      price: s.pris != null ? `${s.pris} kr` : "",
      lines: s.tekst,
      answers: plain ? "JA   ·   NEI" : `JA = ${ja}   NEI = ${nei}`,
      foot: i === 0 ? "Svar JA eller NEI for å begynne" : "",
    };
  });
}
