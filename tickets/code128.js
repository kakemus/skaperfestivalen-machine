// Code 128 barcodes, drawn straight onto a canvas.
//
// Used for the scanner's MetroSelect setup codes, which are Code 128 with an
// FNC3 in front of an even number of digits. encodeFnc3Digits() lays them out
// exactly as the printed guide does — Start B, FNC3, switch to Code C, digit
// pairs, checksum, Stop — checked by decoding the guide's own barcodes
// (2026-10-04): e.g. "118703" → 104 96 99 11 87 3 [73] 106.
const PATTERNS = ("212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 " +
  "112232 122132 122231 113222 123122 123221 223211 221132 221231 213212 223112 312131 311222 321122 " +
  "321221 312212 322112 322211 212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 " +
  "231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 231131 213113 213311 213131 " +
  "311123 311321 331121 312113 312311 332111 314111 221411 431111 111224 111422 121124 121421 141122 " +
  "141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 111242 121142 " +
  "121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 " +
  "114311 411113 411311 113141 114131 311141 411131 211412 211214 211232 2331112").split(" ");

const START_B = 104, FNC3 = 96, CODE_C = 99, STOP = 106;

/** Symbol values for FNC3 + digits (even count), the MetroSelect way. */
export function encodeFnc3Digits(digits) {
  if (!/^(\d\d)+$/.test(digits)) throw new Error(`"${digits}" must be an even number of digits`);
  const vals = [START_B, FNC3, CODE_C];
  for (let i = 0; i < digits.length; i += 2) vals.push(Number(digits.slice(i, i + 2)));
  const check = vals.reduce((sum, v, i) => sum + v * Math.max(i, 1), 0) % 103;
  return [...vals, check, STOP];
}

/** Width in modules (bars + spaces) of a symbol list, without quiet zones. */
export const modulesOf = vals => vals.reduce((n, v) => n + [...PATTERNS[v]].reduce((a, b) => a + Number(b), 0), 0);

/** Draw bars at (x, y); returns the width drawn in px. */
export function drawBars(ctx, vals, x, y, { module = 4, height = 120 } = {}) {
  let cx = x;
  for (const v of vals) {
    [...PATTERNS[v]].forEach((w, i) => {
      const width = Number(w) * module;
      if (i % 2 === 0) ctx.fillRect(cx, y, width, height); // even positions are bars
      cx += width;
    });
  }
  return cx - x;
}
