// Owns the one Web Serial connection to the micro:bit receiver board (plugged
// in by USB, forwarding radio messages from the handheld board — see
// firmware/). Nothing else touches navigator.serial; everything reacts to the
// controller:* events emitted here. Copied from the occult printer, so a
// micro:bit flashed for that machine speaks the same language.
import { emit } from "./eventBus.js";
import { inCharge } from "./singleTab.js";
import { serialApi } from "./usbSerial.js";

const BAUD_RATE = 115200;

// Web Serial where the browser has it; on the old Android phone (WebUSB only)
// the same thing rebuilt on WebUSB — see usbSerial.js.
const serial = serialApi();

// micro:bit / DAPLink USB vendor id — picks the right port when more than one
// serial device has been allowed on this page.
const MICROBIT_VENDOR_ID = 0x0d28;

let port = null;
let reader = null;
let keepReading = false;
let connecting = false;
let reconnectWhenClosed = false;
const buttonState = { a: false, b: false };
const buttonChangedAt = { a: 0, b: 0 };
const BUTTON_REPRESS_MS = 250;

export function isConnected() {
  return !!(port && keepReading);
}

function pickPort(ports) {
  return ports.find(p => p.getInfo?.().usbVendorId === MICROBIT_VENDOR_ID) || null;
}

function resetButtonState({ emitReleases = true } = {}) {
  for (const button of ["a", "b"]) {
    if (emitReleases && buttonState[button]) emit("controller:button", { button, pressed: false, synthetic: true });
    buttonState[button] = false;
    buttonChangedAt[button] = 0;
  }
}

// `auto` is the hands-off path (the board reappearing after a USB drop):
// it can only reuse a port the browser already granted, and stays quiet if
// there isn't one, because opening the picker needs a real click.
export async function connect({ auto = false } = {}) {
  if (!inCharge()) { if (!auto) emit("controller:error", { message: "Another tab is running the machine — use that one, or close it." }); return false; }
  if (connecting || port) return !!port;
  if (!serial) {
    if (!auto) emit("controller:error", { message: "This browser can't reach USB devices — use Chrome." });
    return false;
  }
  connecting = true;
  try {
    const known = await serial.getPorts();
    const knownMicrobit = pickPort(known);
    if (auto && !knownMicrobit) return false;
    // A click always shows the chooser: reusing the known board silently, when
    // opening it then failed (another tab holding it), left "Connect" looking
    // dead on the phone (2026-10-14). Only the automatic path reuses it.
    const chosen = auto ? knownMicrobit : await serial.requestPort({ filters: [{ usbVendorId: MICROBIT_VENDOR_ID }] });
    await chosen.open({ baudRate: BAUD_RATE });
    port = chosen;
    keepReading = true;
    reconnectWhenClosed = false;
    resetButtonState({ emitReleases: false });
    readLoop();
    emit("controller:connected", {});
    return true;
  } catch (e) {
    port = null;
    if (auto) return false;
    // Same browser rule as WebUSB: a picker only opens from a real click.
    const needsGesture = e.name === "SecurityError" || /user gesture/i.test(e.message);
    const message = needsGesture
      ? "Controller isn't connected yet, and it can't be from an automatic action — click \"Connect micro:bit\" once (a real click is required by the browser)."
      : "Controller connection error: " + e.message;
    emit("controller:error", { message });
    return false;
  } finally {
    connecting = false;
  }
}

// If the board drops off the USB bus (a hub glitch, a bumped cable) and comes
// back, pick it up again without anyone clicking Connect.
if (serial?.addEventListener) {
  serial.addEventListener("connect", (event) => {
    if (event.port?.getInfo?.().usbVendorId !== MICROBIT_VENDOR_ID) return;
    if (port) reconnectWhenClosed = true;
    else connect({ auto: true });
  });
  serial.addEventListener("disconnect", (event) => {
    if (event.port !== port) return;
    reconnectWhenClosed = true;
    keepReading = false;
    reader?.cancel().catch(() => {});
  });
}

export async function disconnect() {
  keepReading = false;
  await reader?.cancel().catch(() => {});
}

// Send one "KEY:VALUE" line to the micro:bit on USB (the machine board, or the
// receiver, which passes it on by radio). Returns false when nothing is connected.
//
// A write can hang if the board stops reading (the old firmware slept through
// every motor move), and then every later command queued behind it forever —
// "motors stop working until I refresh the page" (2026-10-12). So each write
// gets WRITE_TIMEOUT_MS; if it doesn't finish, the stuck writer is aborted and
// the connection is reopened by itself.
const encoder = new TextEncoder();
const WRITE_TIMEOUT_MS = 1500;
let writing = Promise.resolve();
let activeWriter = null;
let generation = 0;     // bumps on every reconnect: writes queued before it are dropped quietly
export function send(line) {
  if (!port?.writable) return false;
  const gen = generation;
  writing = writing.then(async () => {
    if (!port?.writable || gen !== generation) return;
    const writer = activeWriter = port.writable.getWriter();
    let timer;
    try {
      await Promise.race([
        writer.write(encoder.encode(line + "\n")),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("write timed out")), WRITE_TIMEOUT_MS); }),
      ]);
    } finally {
      clearTimeout(timer);
      if (activeWriter === writer) activeWriter = null;
      try { writer.releaseLock(); } catch {}
    }
  }).catch(e => {
    if (gen !== generation) return;
    emit("controller:error", { message: `Couldn't send "${line}" to the micro:bit (${e?.message || "connection reset"}) — reconnecting.` });
    reconnect();
  });
  return true;
}

/** Drop the connection and open it again (used when a write hangs, or the board goes quiet). */
export function reconnect() {
  generation++;
  if (!port) return connect({ auto: true });
  reconnectWhenClosed = true;
  keepReading = false;
  activeWriter?.abort().catch(() => {});
  activeWriter = null;
  // a write still stuck in the stream would stop port.close() — throw it away
  try { if (port.writable && !port.writable.locked) port.writable.abort().catch(() => {}); } catch {}
  writing = Promise.resolve();
  reader?.cancel().catch(() => {});
}

async function readLoop() {
  const decoder = new TextDecoderStream();
  const closed = port.readable.pipeTo(decoder.writable).catch(() => {});
  reader = decoder.readable.getReader();
  let buffer = "";

  try {
    while (keepReading) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      let newlineIndex;
      while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (line) handleLine(line);
      }
    }
  } catch (e) {
    emit("controller:error", { message: "Controller read error: " + e.message });
  } finally {
    resetButtonState();
    reader?.releaseLock();
    await closed;
    await port?.close().catch(() => {});
    port = null;
    reader = null;
    emit("controller:disconnected", {});
    if (reconnectWhenClosed) {
      reconnectWhenClosed = false;
      setTimeout(() => connect({ auto: true }), 250);
    }
  }
}

// The receiver (firmware/receiver.py) prints raw "KEY:VALUE" lines exactly as
// received over radio from the handheld board (firmware/controller.py). Parsing is intentionally
// generic: an unrecognized key is still surfaced (controller:raw) instead
// of silently dropped, so a new input added to the controller script shows
// up here without a matching code change.
function handleLine(line) {
  const sep = line.indexOf(":");
  if (sep === -1) return;
  const key = line.slice(0, sep);
  const value = line.slice(sep + 1);

  switch (key) {
    case "BTN_A":
    case "BTN_B": {
      if (value !== "0" && value !== "1") break;
      const button = key === "BTN_A" ? "a" : "b";
      const pressed = value === "1";
      const now = performance.now();
      // Radio retransmits and physical bounce may repeat an edge. Treat the
      // protocol as state, not a press counter, so one physical action can
      // never become a double/triple command merely because a packet repeats.
      if (buttonState[button] === pressed) {
        // If a release was lost, the next genuine press otherwise remains
        // indistinguishable from a duplicate forever. The firmware sends
        // edges (not held-state heartbeats), so a later down edge repairs the
        // stale state before being delivered as a new press.
        if (!pressed || now - buttonChangedAt[button] < BUTTON_REPRESS_MS) break;
        emit("controller:button", { button, pressed: false, synthetic: true });
      }
      buttonState[button] = pressed;
      buttonChangedAt[button] = now;
      emit("controller:button", { button, pressed });
      break;
    }
    case "LOGO":
      emit("controller:logo", { touched: value === "1" });
      break;
    case "GESTURE":
      emit("controller:gesture", { gesture: value });
      break;
    case "TILT": {
      const [x, y, z] = value.split(",").map(Number);
      if ([x, y, z].every(Number.isFinite)) emit("controller:tilt", { x, y, z });
      break;
    }
    case "MIC": {
      const level = Number(value);
      if (Number.isFinite(level)) emit("controller:mic", { level });
      break;
    }
    case "TEMP": {
      const celsius = Number(value);
      if (Number.isFinite(celsius)) emit("controller:temperature", { celsius });
      break;
    }
    default:
      emit("controller:raw", { line });
  }
}
