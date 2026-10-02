// Animated scenes for the IBM 2x20 display.
//
// A scene is { label, setup(lcd), frame(lcd, t, inp) }: setup defines the
// custom characters it needs, frame runs ~15 times a second with t = seconds
// since the scene started and inp = the latest controller state (INPUT_DEFAULTS
// below). Scenes only read inp, so they run the same from the "ghost" input or
// a real micro:bit. lcd is core/ibmDisplay.js (show, line, clear, defineChar).
// Adding a scene = one entry in SCENES.

export const W = 20;
export const INPUT_DEFAULTS = {
  tiltX: 0,      // -1 (left) .. 1 (right)
  tiltY: 0,      // -1 (away) .. 1 (towards you)
  sound: 0,      // 0 .. 1
  a: false,      // button A held
  b: false,      // button B held
  shake: false,  // true for the one frame a shake arrives
};

const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const center = (s, w = W) => {
  s = s.slice(0, w);
  const left = Math.floor((w - s.length) / 2);
  return " ".repeat(left) + s + " ".repeat(w - s.length - left);
};

// Split a pixel grid (strings, "#" = on) of (cols*5) x (rows*8) into cells.
function bitmapToChars(bitmap, cols, rows) {
  const cells = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      cells.push(Array.from({ length: 8 }, (_, y) =>
        parseInt([...bitmap[r * 8 + y].slice(c * 5, c * 5 + 5)].map(p => p === "#" ? 1 : 0).join(""), 2)));
  return cells;
}

/** A phrase sliding along the top line; tilt sets speed and direction. */
export function marquee({ text = "WELCOME TO THE MACHINE", bottom = "* SKAPERFESTIVALEN *" } = {}) {
  let pos = 0;
  return {
    label: "Scrolling text",
    setup(lcd) { lcd.clear(); },
    frame(lcd, t, inp) {
      const loop = text + " ".repeat(8);
      const speed = 3 + 4 * inp.tiltX; // letters per second — ~3 is readable
      pos = (((pos + speed / 15) % loop.length) + loop.length) % loop.length;
      const i = Math.floor(pos);
      lcd.show((loop + loop).slice(i, i + W), center(bottom));
    },
  };
}

/** Types lines out letter by letter with a blinking block cursor. */
export function typewriter({ lines = ["INSERT COIN", "OR PRESS A", "1x LUCK ..... 0.00", "TOTAL:  PRICELESS"] } = {}) {
  return {
    label: "Typewriter",
    setup(lcd) { lcd.clear(); lcd.defineChar(0, Array(8).fill("#####")); },
    frame(lcd, t, inp) {
      const pairs = Math.max(1, Math.floor(lines.length / 2));
      const pair = Math.floor(t / 5) % pairs;
      const top = lines[pair * 2] || "", bottom = lines[pair * 2 + 1] || "";
      const n = Math.floor((t % 5) * 9);
      const cursor = Math.floor(t * 3) % 2 === 0 ? "\x00" : " ";
      if (n <= top.length) return lcd.show(top.slice(0, n) + cursor, "");
      const m = n - top.length - 3;
      lcd.show(top, m <= bottom.length + 6 ? bottom.slice(0, Math.max(0, m)) + cursor : bottom);
    },
  };
}

/** Letters spin and lock in one by one. spin(word) restarts it (a shake does too). */
export function slots({ words = ["JACKPOT", "TRY AGAIN", "LUCKY", "BONUS", "WINNER", "ALMOST"] } = {}) {
  const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#%&*?!$";
  let start = null, word = null, pending = null;
  return {
    label: "Slot machine",
    spin(w) { pending = w || pick(words); },
    setup(lcd) { lcd.clear(); start = null; },
    frame(lcd, t, inp) {
      if (pending || start === null || inp.shake || t - start > 6) {
        word = center(pending || pick(words));
        start = t;
        pending = null;
      }
      const dt = t - start;
      const out = [...word].map((ch, i) => ch === " " || dt > 0.4 + i * 0.12 ? ch : pick(GLYPHS)).join("");
      lcd.show(out, center(dt < 2.5 ? ">> SPINNING <<" : "* * * * * *"));
    },
  };
}

/** 20-column, 16-level bar graph over both lines, driven by sound. */
export function equalizer() {
  const levels = Array(W).fill(0);
  return {
    label: "Equalizer",
    setup(lcd) {
      lcd.clear();
      for (let k = 0; k < 8; k++) lcd.defineChar(k, [...Array(7 - k).fill(0), ...Array(k + 1).fill(0b11111)]);
    },
    frame(lcd, t, inp) {
      let top = "", bottom = "";
      for (let i = 0; i < W; i++) {
        const wave = 0.5 + 0.5 * Math.sin(t * 2.5 + i * 0.5 + inp.tiltX * 3);
        const target = 16 * Math.min(1, 0.25 * wave + inp.sound * (0.6 + 0.6 * Math.random()));
        levels[i] += (target - levels[i]) * 0.5;
        const lv = Math.round(levels[i]);
        bottom += lv > 0 ? String.fromCharCode(Math.min(lv, 8) - 1) : " ";
        top += lv > 8 ? String.fromCharCode(lv - 9) : " ";
      }
      lcd.show(top, bottom);
    },
  };
}

/** Two big eyes (2x2 cells each) that follow the tilt and blink; holding B shuts them. */
export function eyes() {
  let blinkAt = -1, blinkDue = 1.5, last = null;
  function eyeBitmap(lookX, lookY, open) {
    const w = 10, h = 16, cx = (w - 1) / 2, cy = (h - 1) / 2, ry = 7 * open;
    const grid = Array.from({ length: h }, () => Array(w).fill("."));
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const d = ((x - cx) / 4.6) ** 2 + ((y - cy) / Math.max(ry, 0.6)) ** 2;
      if (open < 0.2) { if (Math.abs(y - cy) < 1 && Math.abs(x - cx) < 4.5) grid[y][x] = "#"; }
      else if (d > 0.55 && d <= 1.08) grid[y][x] = "#";
      const px = cx + lookX * 2.2, py = cy + lookY * 3.5 * open;
      if (d < 0.55 && (x - px) ** 2 / 3 + (y - py) ** 2 / 6 < 1) grid[y][x] = "#";
    }
    return grid.map(r => r.join(""));
  }
  return {
    label: "Eyes",
    setup(lcd) { lcd.clear(); last = null; },
    frame(lcd, t, inp) {
      if (t >= blinkDue) { blinkAt = t; blinkDue = t + 2 + 4 * Math.random(); }
      const open = t - blinkAt < 0.15 || inp.b ? 0.1 : 1;
      const key = `${Math.round(inp.tiltX * 3)},${Math.round(inp.tiltY * 2)},${open}`;
      if (key !== last) {
        const cells = bitmapToChars(eyeBitmap(Math.round(inp.tiltX * 3) / 3, Math.round(inp.tiltY * 2) / 2, open), 2, 2);
        cells.forEach((rows, slot) => lcd.defineChar(slot, rows));
        last = key;
      }
      lcd.show("     \x00\x01      \x00\x01", "     \x02\x03      \x02\x03");
    },
  };
}

/** A little bug walking the bottom line; tilt steers it. */
export function walker({ title = "SOMETHING CRAWLS" } = {}) {
  const FRAMES = [
    [".#.#.", "..#..", "#####", ".###.", "#####", ".###.", "#.#.#", "....."],
    [".#.#.", "..#..", "#####", ".###.", "#####", ".###.", ".#.#.", "#...#"],
  ];
  let x = 0, dir = 1;
  return {
    label: "Walking bug",
    setup(lcd) { lcd.clear(); x = 0; dir = 1; },
    frame(lcd, t, inp) {
      lcd.defineChar(0, FRAMES[Math.floor(t * 4) % 2]);
      if (Math.abs(inp.tiltX) > 0.2) dir = Math.sign(inp.tiltX);
      x += dir * (0.15 + 0.25 * Math.abs(inp.tiltX));
      if (x > W - 1 || x < 0) { dir *= -1; x = Math.max(0, Math.min(W - 1, x)); }
      const i = Math.floor(x);
      lcd.show(center(title), " ".repeat(i) + "\x00" + " ".repeat(W - 1 - i));
    },
  };
}

/** Two fixed lines — for a message the machine wants to hold on screen. */
export function message({ top = "", bottom = "" } = {}) {
  return {
    label: "Message",
    setup(lcd) { lcd.clear(); },
    frame(lcd) { lcd.show(center(top), center(bottom)); },
  };
}

// The scenes the machine cycles through while idle, in order.
export const SCENES = { marquee, typewriter, slots, equalizer, eyes, walker };
