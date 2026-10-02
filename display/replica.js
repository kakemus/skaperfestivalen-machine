// Draws a look-alike of the IBM display on a canvas: 2 x 20 cells of 5 x 8
// dots, yellow-green backlight. Ordinary letters are rasterised from a font
// into the same dot grid, custom characters (0-7) come from their bitmaps, so
// what you see here is close to what the real display shows.
const COLS = 20, ROWS = 2, DOT = 4, GAP = 1, CELL_GAP = 4;
const CELL_W = 5 * (DOT + GAP) + CELL_GAP, CELL_H = 8 * (DOT + GAP) + CELL_GAP;
const BG = "#9bd12e", OFF = "#8cc226", ON = "#1c2a0a";

const glyphCache = new Map();

// Turn a character into 8 rows of 5 bits by drawing it small and thresholding.
function glyphRows(ch) {
  if (glyphCache.has(ch)) return glyphCache.get(ch);
  const c = document.createElement("canvas");
  c.width = 5; c.height = 8;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "#000";
  ctx.font = "8px Menlo, monospace";
  ctx.textBaseline = "top";
  ctx.fillText(ch, 0, 0);
  const d = ctx.getImageData(0, 0, 5, 8).data;
  const rows = Array.from({ length: 8 }, (_, y) => {
    let bits = 0;
    for (let x = 0; x < 5; x++) if (d[(y * 5 + x) * 4 + 3] > 90) bits |= 1 << (4 - x);
    return bits;
  });
  glyphCache.set(ch, rows);
  return rows;
}

export function setupReplica(canvas) {
  canvas.width = COLS * CELL_W + CELL_GAP;
  canvas.height = ROWS * CELL_H + CELL_GAP;
  const ctx = canvas.getContext("2d");
  return function draw({ lines, chars }) {
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let r = 0; r < ROWS; r++) {
      for (let col = 0; col < COLS; col++) {
        const code = lines[r][col];
        const rows = code < 8 ? chars[code] : code === 32 ? null : glyphRows(String.fromCharCode(code));
        const x0 = CELL_GAP + col * CELL_W, y0 = CELL_GAP + r * CELL_H;
        for (let y = 0; y < 8; y++) for (let x = 0; x < 5; x++) {
          ctx.fillStyle = rows && rows[y] & (1 << (4 - x)) ? ON : OFF;
          ctx.fillRect(x0 + x * (DOT + GAP), y0 + y * (DOT + GAP), DOT, DOT);
        }
      }
    }
  };
}
