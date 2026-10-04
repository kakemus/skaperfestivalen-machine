// Text for the IBM display: upper-case, word-wrapped to 20 columns, with Æ Ø Å
// drawn as custom characters 5-7 (the display's own character set very likely
// lacks them — a till display from 2011 with a Japanese-style ROM).
import { W } from "./scenes.js";

const NORDIC = {
  "Æ": [".####", "#.#..", "#.#..", "####.", "#.#..", "#.#..", "#.###", "....."],
  "Ø": [".###.", "#..##", "#.#.#", "#.#.#", "#.#.#", "##..#", ".###.", "....."],
  "Å": ["..#..", ".#.#.", "..#..", ".###.", "#...#", "#####", "#...#", "....."],
};
const SLOTS = { "Æ": "\x05", "Ø": "\x06", "Å": "\x07" };

export function defineNordic(lcd) {
  for (const [ch, rows] of Object.entries(NORDIC)) lcd.defineChar(SLOTS[ch].charCodeAt(0), rows);
}

/** Upper-case and swap Æ Ø Å (and accented letters) for what the display can show. */
export function toLcd(text) {
  return String(text).toUpperCase()
    .replace(/[ÆØÅ]/g, ch => SLOTS[ch])
    .normalize("NFD").replace(/[̀-ͯ]/g, ""); // É → E etc. (after Å is already swapped)
}

/** Word-wrap into lines of at most 20 characters (long words are cut). */
export function wrap(text, width = W) {
  const lines = [];
  let line = "";
  for (let word of String(text).split(/\s+/).filter(Boolean)) {
    while (word.length > width) { if (line) { lines.push(line); line = ""; } lines.push(word.slice(0, width)); word = word.slice(width); }
    if (!line) line = word;
    else if ((line + " " + word).length <= width) line += " " + word;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

const center = s => {
  const left = Math.floor((W - s.length) / 2);
  return " ".repeat(Math.max(0, left)) + s;
};

/**
 * A scene showing text on the display. Two lines or fewer stay put (centered);
 * more lines page through two at a time. `blink` flashes the whole text.
 */
export function textScene(text, { blink = false, pageSeconds = 2.6 } = {}) {
  const lines = wrap(toLcd(text)).map(center);
  const pages = [];
  for (let i = 0; i < lines.length; i += 2) pages.push([lines[i], lines[i + 1] || ""]);
  return {
    label: "Game text",
    setup(lcd) { lcd.clear(); defineNordic(lcd); },
    frame(lcd, t) {
      if (blink && Math.floor(t * 3) % 2) return lcd.show("", "");
      const [top, bottom] = pages[Math.floor(t / pageSeconds) % pages.length];
      lcd.show(top, bottom);
    },
  };
}
