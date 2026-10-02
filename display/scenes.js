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

// ---------- wilder ones ----------

const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
// Slot k (0-7) = an ordered-dither shade, (k+1)/8 of the pixels on.
function defineShades(lcd) {
  for (let k = 0; k < 8; k++)
    lcd.defineChar(k, Array.from({ length: 8 }, (_, y) =>
      [0, 1, 2, 3, 4].reduce((bits, x) => bits | (BAYER[y % 4][x % 4] < (k + 1) * 2 ? 1 << (4 - x) : 0), 0)));
}
const shade = v => (v < 0.08 ? " " : String.fromCharCode(Math.min(7, Math.floor(v * 8))));

/** Swirling plasma in 8 dither shades; tilt bends it, sound speeds it up. */
export function plasma() {
  let phase = 0;
  return {
    label: "Plasma",
    setup(lcd) { lcd.clear(); defineShades(lcd); },
    frame(lcd, t, inp) {
      phase += (1 + inp.sound * 4) / 15;
      const rows = [0, 1].map(r => Array.from({ length: W }, (_, x) => {
        const v = Math.sin(x * 0.35 + phase) + Math.sin((x * (0.2 + inp.tiltX * 0.15) + r * 1.7 + phase * 1.3))
          + Math.sin(Math.hypot(x - 10 - inp.tiltX * 6, (r - 0.5) * 6) * 0.6 - phase * 1.7);
        return shade((v + 3) / 6);
      }).join(""));
      lcd.show(rows[0], rows[1]);
    },
  };
}

/** A wave drawn across both lines at 16 pixel heights; tilt = frequency, sound = amplitude. */
export function oscilloscope() {
  let phase = 0;
  return {
    label: "Oscilloscope",
    setup(lcd) {
      lcd.clear();
      for (let k = 0; k < 8; k++) lcd.defineChar(k, Array.from({ length: 8 }, (_, y) => (y === k ? 0b11111 : 0)));
    },
    frame(lcd, t, inp) {
      phase += 0.35;
      const freq = 0.45 + inp.tiltX * 0.3, amp = 3 + 4.5 * Math.min(1, 0.3 + inp.sound);
      let top = "", bottom = "";
      for (let x = 0; x < W; x++) {
        const v = Math.sin(x * freq + phase) + 0.35 * Math.sin(x * freq * 2.7 - phase * 1.6);
        const y = Math.max(0, Math.min(15, Math.round(7.5 - v * amp)));
        top += y < 8 ? String.fromCharCode(y) : " ";
        bottom += y >= 8 ? String.fromCharCode(y - 8) : " ";
      }
      lcd.show(top, bottom);
    },
  };
}

/** Pac-Man eats dots along the bottom line with a ghost on his tail. */
export function pacman() {
  const PAC = [
    [".###.", "#####", "###..", "##...", "###..", "#####", ".###.", "....."],
    [".###.", "#####", "#####", "#####", "#####", "#####", ".###.", "....."],
  ];
  const GHOST = [
    [".###.", "#####", "#.#.#", "#####", "#####", "#####", "#.#.#", "....."],
    [".###.", "#####", "#.#.#", "#####", "#####", "#####", ".#.#.", "....."],
  ];
  let x = 0, score = 0, dots = "";
  return {
    label: "Pac-Man",
    setup(lcd) { lcd.clear(); x = -1; dots = ".".repeat(W).split(""); dots[14] = "o"; },
    frame(lcd, t, inp) {
      lcd.defineChar(0, PAC[Math.floor(t * 8) % 2]);
      lcd.defineChar(1, GHOST[Math.floor(t * 4) % 2]);
      x += 0.25 + Math.max(0, inp.tiltX) * 0.3;
      if (x > W + 4) { x = -1; dots = ".".repeat(W).split(""); dots[14] = "o"; }
      const px = Math.floor(x), gx = px - 4;
      if (px >= 0 && px < W && dots[px] !== " ") { score += dots[px] === "o" ? 50 : 10; dots[px] = " "; }
      const row = dots.slice();
      if (gx >= 0 && gx < W) row[gx] = "\x01";
      if (px >= 0 && px < W) row[px] = "\x00";
      lcd.show(`1UP ${String(score).padStart(5, "0")}  HI 99990`, row.join(""));
    },
  };
}

/** A friendly message that keeps breaking into noise. */
export function glitch({ messages = [["HELLO, HUMAN", "PLEASE INSERT JOY"], ["I AM VERY NORMAL", "TOTALLY NORMAL"], ["FEED ME TICKETS", "* * * * * * *"]] } = {}) {
  let burstUntil = 0, nextBurst = 1;
  return {
    label: "Glitch",
    setup(lcd) {
      lcd.clear();
      lcd.defineChar(0, Array(8).fill(0b11111));
      lcd.defineChar(1, [0b10101, 0b01010, 0b10101, 0b01010, 0b10101, 0b01010, 0b10101, 0b01010]);
    },
    frame(lcd, t, inp) {
      const [top, bottom] = messages[Math.floor(t / 6) % messages.length].map(s => center(s));
      if (t > nextBurst || inp.shake) { burstUntil = t + 0.2 + Math.random() * 0.6; nextBurst = t + 1 + Math.random() * 3; }
      if (t > burstUntil) return lcd.show(top, bottom);
      const noise = s => [...s].map(ch => {
        const r = Math.random();
        if (r < 0.25) return String.fromCharCode(33 + Math.floor(Math.random() * 94));
        if (r < 0.35) return Math.random() < 0.5 ? "\x00" : "\x01";
        if (r < 0.45) return String.fromCharCode(0xa1 + Math.floor(Math.random() * 94));
        return ch;
      }).join("");
      const shift = Math.floor(Math.random() * 5) - 2;
      const roll = s => s.slice(-shift) + s.slice(0, -shift) || s;
      Math.random() < 0.3 ? lcd.show(noise(bottom), noise(top)) : lcd.show(roll(noise(top)), noise(bottom));
    },
  };
}

/** Stars streaming out from the middle; louder = faster. */
export function warp() {
  let stars = [];
  return {
    label: "Warp",
    setup(lcd) { lcd.clear(); stars = []; },
    frame(lcd, t, inp) {
      const speed = 1 + inp.sound * 3;
      while (stars.length < 14) stars.push({ x: 9.5 + inp.tiltX * 4, v: (Math.random() < 0.5 ? -1 : 1) * (0.05 + Math.random() * 0.1), row: Math.random() < 0.5 ? 0 : 1 });
      for (const s of stars) { s.x += s.v * speed; s.v *= 1.12; }
      stars = stars.filter(s => s.x >= 0 && s.x < W);
      const rows = [Array(W).fill(" "), Array(W).fill(" ")];
      for (const s of stars) {
        const d = Math.abs(s.x - 9.5);
        rows[s.row][Math.floor(s.x)] = d < 3 ? "." : d < 6 ? "+" : "*";
        const trail = Math.floor(s.x - Math.sign(s.v));
        if (d > 5 && trail >= 0 && trail < W && rows[s.row][trail] === " ") rows[s.row][trail] = "-";
      }
      lcd.show(rows[0].join(""), rows[1].join(""));
    },
  };
}

/** Pixel-smooth drops falling through both lines, splashing into symbols at the bottom. */
export function rain() {
  let drops = [];
  return {
    label: "Rain",
    setup(lcd) {
      lcd.clear();
      // slot k = a 3-pixel streak whose lowest pixel is row k
      for (let k = 0; k < 8; k++) lcd.defineChar(k, Array.from({ length: 8 }, (_, y) => (y <= k && y > k - 3 ? 0b00100 : 0)));
      drops = [];
    },
    frame(lcd, t, inp) {
      const rate = 0.25 + inp.sound * 0.6;
      if (Math.random() < rate) drops.push({ x: Math.floor(Math.random() * W), y: 0, v: 0.6 + Math.random() * 0.6 });
      for (const d of drops) d.y += d.v * (1 + Math.abs(inp.tiltY));
      const rows = [Array(W).fill(" "), Array(W).fill(" ")];
      drops = drops.filter(d => {
        if (d.y >= 16) { rows[1][d.x] = d.y < 18 ? "*" : rows[1][d.x]; return d.y < 18; }
        const y = Math.floor(d.y);
        rows[y < 8 ? 0 : 1][d.x] = String.fromCharCode(y % 8);
        return true;
      });
      lcd.show(rows[0].join(""), rows[1].join(""));
    },
  };
}

// The scenes the machine cycles through while idle, in order.
export const SCENES = {
  marquee, typewriter, slots, equalizer, eyes, walker,
  plasma, oscilloscope, pacman, glitch, warp, rain,
};
