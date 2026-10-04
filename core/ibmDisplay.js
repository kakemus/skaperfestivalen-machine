// The IBM till display (USB 04b3:4526, "IBM Retail USB 40 Character Liquid
// Crystal Display" — 2 lines x 20 characters), over WebHID. Nothing else
// touches navigator.hid.
//
// The protocol isn't published; it was worked out by trial on 2026-10-02
// (tools/ibmlcd.py is the same thing in Python, for quick terminal tests).
// The display has two HID interfaces:
//   usage 0xA000  firmware upgrade — NEVER write to it, that can brick the display
//   usage 0x2600  the display      — everything below
// Each write is a 23-byte output report: [command, length, up to 21 data bytes]
//   0x81 len text      replace the top line
//   0x82 len text      replace the bottom line
//   0x02               clear the screen
//   0x40 slot rows*8   define custom character `slot` (0-7) from 8 rows of 5
//                      pixels (0b10000 = leftmost). chr(slot) in text prints it,
//                      and redefining a slot changes every copy on screen at once.
//   0x20               once brought back the power-on "OK" screen — avoid
//   0x10               unknown
// About 30 writes a second get through.
//
// The module always keeps a copy of what *should* be on screen (lines +
// custom characters) and announces it with "ibm:changed", so the page can draw
// a replica whether or not the real display is plugged in. Sending to the
// hardware runs behind that: only the newest version of each line/character
// is sent, so a scene can't build up a backlog faster than the display eats it.
import { emit } from "./eventBus.js";
import { inCharge } from "./singleTab.js";

export const WIDTH = 20;
const VENDOR_ID = 0x04b3, PRODUCT_ID = 0x4526;
const USAGE_PAGE = 0xff45, DISPLAY_USAGE = 0x2600, FIRMWARE_USAGE = 0xa000;

let device = null;
const lines = ["", ""].map(() => new Uint8Array(WIDTH).fill(32));
const chars = Array.from({ length: 8 }, () => new Uint8Array(8));
const dirty = { lines: new Set(), chars: new Set(), clear: false };
let pumping = false;

export function isConnected() { return !!device?.opened; }
export function getState() { return { lines, chars }; }

function isDisplayInterface(d) {
  if (d.vendorId !== VENDOR_ID || d.productId !== PRODUCT_ID) return false;
  const usages = d.collections.map(c => (c.usagePage << 16) | c.usage);
  return usages.includes((USAGE_PAGE << 16) | DISPLAY_USAGE)
    && !usages.includes((USAGE_PAGE << 16) | FIRMWARE_USAGE);
}

// `auto` reuses a display this page was already allowed to use and stays
// quiet otherwise (the picker needs a real click).
export async function connect({ auto = false } = {}) {
  if (!inCharge()) { if (!auto) emit("ibm:error", { message: "Another tab is running the machine — use that one, or close it." }); return false; }
  if (!("hid" in navigator)) {
    if (!auto) emit("ibm:error", { message: "WebHID isn't available — use Chrome." });
    return false;
  }
  try {
    let d = (await navigator.hid.getDevices()).find(isDisplayInterface);
    if (!d) {
      if (auto) return false;
      const picked = await navigator.hid.requestDevice({
        filters: [{ vendorId: VENDOR_ID, productId: PRODUCT_ID, usagePage: USAGE_PAGE, usage: DISPLAY_USAGE }],
      });
      d = picked.find(isDisplayInterface);
      if (!d) throw new Error("That isn't the IBM display's text interface.");
    }
    if (!d.opened) await d.open();
    device = d;
    // Push everything we think is on screen, so the hardware matches the replica.
    dirty.clear = true;
    chars.forEach((_, i) => dirty.chars.add(i));
    dirty.lines.add(0).add(1);
    pump();
    emit("ibm:connected", { name: d.productName });
    return true;
  } catch (e) {
    device = null;
    if (!auto) emit("ibm:error", { message: "IBM display: " + e.message });
    return false;
  }
}

if (typeof navigator !== "undefined" && navigator.hid?.addEventListener) {
  navigator.hid.addEventListener("disconnect", (e) => {
    if (e.device === device) { device = null; emit("ibm:disconnected"); }
  });
  navigator.hid.addEventListener("connect", (e) => {
    if (!device && isDisplayInterface(e.device)) connect({ auto: true });
  });
}

function toBytes(text) {
  const out = new Uint8Array(WIDTH).fill(32);
  for (let i = 0; i < Math.min(WIDTH, text.length); i++) {
    const c = text.charCodeAt(i);
    out[i] = c < 256 ? c : 63; // "?" for anything outside latin-1
  }
  return out;
}

/** Set a whole line (0 = top, 1 = bottom). "\x00"-"\x07" print custom characters. */
export function line(row, text) {
  const bytes = toBytes(text);
  if (bytes.every((b, i) => b === lines[row][i])) return;
  lines[row] = bytes;
  dirty.lines.add(row);
  changed();
}

export function show(top = "", bottom = "") {
  line(0, top);
  line(1, bottom);
}

export function clear() {
  lines.forEach(l => l.fill(32));
  dirty.lines.clear();
  dirty.clear = true;
  changed();
}

/** rows: 8 numbers (5 bits each) or 8 strings like ".#.#." */
export function defineChar(slot, rows) {
  const bits = rows.slice(0, 8).map(r => typeof r === "string" ? parseInt(r.replace(/\./g, "0").replace(/#/g, "1"), 2) : r);
  if (bits.every((b, i) => b === chars[slot][i])) return;
  chars[slot] = Uint8Array.from({ length: 8 }, (_, i) => bits[i] || 0);
  dirty.chars.add(slot);
  changed();
}

function changed() {
  emit("ibm:changed", { lines, chars });
  pump();
}

async function send(cmd, data = [], length = data.length) {
  const report = new Uint8Array(23);
  report[0] = cmd;
  report[1] = length;
  report.set(data.slice(0, 21), 2);
  await device.sendReport(0, report);
}

// Sends whatever changed, newest state only, one report at a time.
async function pump() {
  if (pumping || !isConnected()) return;
  pumping = true;
  try {
    while (isConnected() && (dirty.clear || dirty.chars.size || dirty.lines.size)) {
      if (dirty.clear) {
        dirty.clear = false;
        await send(0x02);
        dirty.lines.add(0).add(1); // a clear wipes both lines; resend whatever they hold now
      } else if (dirty.chars.size) {
        const slot = dirty.chars.values().next().value;
        dirty.chars.delete(slot);
        await send(0x40, chars[slot], slot); // for 0x40 the "length" byte is the slot
      } else {
        const row = dirty.lines.values().next().value;
        dirty.lines.delete(row);
        await send(row === 0 ? 0x81 : 0x82, lines[row]);
      }
    }
  } catch (e) {
    emit("ibm:error", { message: "IBM display write failed: " + e.message });
  } finally {
    pumping = false;
  }
}
