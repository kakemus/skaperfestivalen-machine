// Canvas → thermal-printer bytes, plus photo helpers. A ticket design draws
// on a canvas; printer.print({ build: () => canvas }) sends it through
// canvasToRasterBytes() below. Copied from the occult printer's raster.js.

export const PRINT_WIDTH = 576; // dots — standard for 58/80mm thermal printers at 203dpi
export const DOTS_PER_MM = 8;

export function mmToDots(mm) {
  return Math.round(mm * DOTS_PER_MM);
}

export function wrapText(ctx, text, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? line + " " + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Dithers a source image/video/canvas down to the printer width (Floyd-
 * Steinberg — the right choice for continuous-tone photos, unlike the plain
 * threshold used for already-binary text) and returns a print-ready canvas.
 */
export function buildImagePrintCanvas(source, sourceWidth, sourceHeight, { feedMm = 20, caption } = {}) {
  const width = PRINT_WIDTH;
  const imgHeight = Math.round(width * (sourceHeight / sourceWidth));
  const feedPad = mmToDots(feedMm);
  const captionHeight = caption ? 34 : 0;

  const c = document.createElement("canvas");
  c.width = width;
  c.height = imgHeight + captionHeight + feedPad;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(source, 0, 0, width, imgHeight);
  ditherFloydSteinberg(ctx, 0, 0, width, imgHeight);

  drawCaption(ctx, caption, width, imgHeight);
  return c;
}

function drawCaption(ctx, caption, width, y) {
  if (!caption) return;
  ctx.fillStyle = "#000";
  ctx.font = "16px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(caption, width / 2, y + 8);
}

/**
 * Auto-levels + a fixed brightening curve, in place. A flat multiplicative
 * contrast boost (the old approach) assumes the image is already centered
 * around mid-gray, which a dim or backlit webcam capture usually isn't —
 * this instead reads the image's actual histogram and:
 *   1. stretches the real black/white points (ignoring the extreme 1%
 *      outliers so a stray shadow or glare doesn't skew the whole range)
 *      to fill the full 0-255 range — real "auto levels"
 *   2. applies a gamma curve on top that lifts shadows/midtones (a face)
 *      while correctly leaving anything already at the black point black
 *      (a genuinely dark background stays dark, rather than being dragged
 *      toward gray to hit some average — chasing a whole-frame brightness
 *      target actively fights a real dark background and can't even
 *      succeed: 0 raised to any gamma is still 0)
 * This is what makes a face's actual features (eyes, nose, shading) show
 * up after 1-bit dithering, instead of the whole capture collapsing to
 * mostly-black or mostly-white.
 */
export function autoEnhancePhoto(canvas, { gamma = 0.7, clipPercent = 1 } = {}) {
  const ctx = canvas.getContext("2d");
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imgData.data;
  const n = d.length / 4;

  const hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) {
    const l = Math.round(d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114);
    hist[l]++;
  }

  const clipCount = Math.max(1, Math.floor(n * (clipPercent / 100)));
  let black = 0, white = 255, acc = 0;
  for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc >= clipCount) { black = i; break; } }
  acc = 0;
  for (let i = 255; i >= 0; i--) { acc += hist[i]; if (acc >= clipCount) { white = i; break; } }
  if (white <= black) { black = 0; white = 255; } // degenerate/flat image guard
  const range = white - black;

  for (let i = 0; i < d.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      let v = (d[i + c] - black) / range;
      v = Math.max(0, Math.min(1, v));
      v = Math.pow(v, gamma);
      d[i + c] = Math.round(v * 255);
    }
  }
  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

/**
 * Manual brightness/contrast on top of autoEnhancePhoto. 1 = no change for
 * both. Same math and order as CSS `brightness(b) contrast(c)`.
 * Modifies `canvas` in place and returns it.
 */
export function adjustBrightnessContrast(canvas, { brightness = 1, contrast = 1 } = {}) {
  if (brightness === 1 && contrast === 1) return canvas;
  const ctx = canvas.getContext("2d");
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imgData.data;
  const lut = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v++) lut[v] = ((v / 255) * brightness - 0.5) * contrast * 255 + 127.5;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = lut[d[i]]; d[i + 1] = lut[d[i + 1]]; d[i + 2] = lut[d[i + 2]];
  }
  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

function ditherFloydSteinberg(ctx, x, y, w, h) {
  const imgData = ctx.getImageData(x, y, w, h);
  const d = imgData.data;
  const gray = new Float32Array(w * h);
  for (let i = 0; i < d.length; i += 4) {
    gray[i / 4] = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
  }

  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const idx = py * w + px;
      const old = gray[idx];
      const nv = old < 150 ? 0 : 255;
      gray[idx] = nv;
      const err = old - nv;
      if (px + 1 < w) gray[idx + 1] += err * 7 / 16;
      if (px - 1 >= 0 && py + 1 < h) gray[idx + w - 1] += err * 3 / 16;
      if (py + 1 < h) gray[idx + w] += err * 5 / 16;
      if (px + 1 < w && py + 1 < h) gray[idx + w + 1] += err * 1 / 16;
    }
  }

  for (let i = 0; i < gray.length; i++) {
    const v = gray[i];
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v;
  }
  ctx.putImageData(imgData, x, y);
}

/** Converts a print-ready canvas (already roughly black/white) into ESC/POS raster bytes. */
export function canvasToRasterBytes(canvas) {
  const w = canvas.width, h = canvas.height;
  const ctx = canvas.getContext("2d");
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;

  const bytesPerRow = Math.ceil(w / 8);
  const out = [27, 51, 0, 29, 118, 48, 0, bytesPerRow & 255, bytesPerRow >> 8, h & 255, h >> 8];

  for (let y = 0; y < h; y++) {
    for (let xb = 0; xb < bytesPerRow; xb++) {
      let byteVal = 0;
      for (let bit = 0; bit < 8; bit++) {
        const x = xb * 8 + bit;
        if (x < w) {
          const idx = (y * w + x) * 4;
          if (d[idx] < 128) byteVal |= (1 << (7 - bit));
        }
      }
      out.push(byteVal);
    }
  }
  return new Uint8Array(out);
}
