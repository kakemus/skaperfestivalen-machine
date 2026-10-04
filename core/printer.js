// Owns the one physical printer connection and the one queue allowed to talk
// to it. Everything else calls print({ build }) and never touches WebUSB.
// Copied (and slimmed down) from the occult printer's printer.js — the
// connection handling below carries fixes that were found on real hardware
// there, so keep them unless the hardware proves otherwise.
import { emit } from "./eventBus.js";
import { inCharge } from "./singleTab.js";
import { canvasToRasterBytes, DOTS_PER_MM } from "./raster.js";

let activeDevice = null;
// Set only once open + claimInterface + selectAlternateInterface have ALL
// succeeded. Checking just `opened` let a failed claim (another tab or app
// holding the printer) look connected, and the next print died in transferOut.
let claimedInterface = null;
const jobs = [];
let processing = false;
// The running job's abort controller — lets Cut (or a new print) stop a slow print.
let activeAbort = null;

// Tickets print in one go by default. Slow mode paces the paper out at a set
// speed instead (the occult printer's "breathing" strip pacing).
let slowMode = false;
let slowSpeedMmPerSec = 6;
export const SLOW_SPEED_RANGE = [1, 30];

export function setSlowMode(on) { slowMode = !!on; emit("printer:modeChanged", { slowMode, slowSpeedMmPerSec }); }
export function setSlowSpeed(mmPerSec) {
  slowSpeedMmPerSec = Math.min(SLOW_SPEED_RANGE[1], Math.max(SLOW_SPEED_RANGE[0], mmPerSec));
  emit("printer:modeChanged", { slowMode, slowSpeedMmPerSec });
}
export function getMode() { return { slowMode, slowSpeedMmPerSec }; }

export function isConnected() {
  return !!(activeDevice && activeDevice.opened && claimedInterface !== null);
}

// A device counts as a printer if any interface declares the USB printer class (7).
function isPrinterDevice(d) {
  return (d.configurations || []).some(c =>
    c.interfaces.some(i => i.alternates.some(a => a.interfaceClass === 7))
  );
}

function getPrintInterface(device = activeDevice) {
  return device.configuration.interfaces.find(i =>
    i.alternates.some(a => a.interfaceClass === 7)
  ) || device.configuration.interfaces[0];
}

function dropDevice() {
  activeDevice = null;
  claimedInterface = null;
}

if (typeof navigator !== "undefined" && navigator.usb?.addEventListener) {
  navigator.usb.addEventListener("disconnect", (e) => {
    if (e.device === activeDevice) {
      dropDevice();
      emit("printer:disconnected");
    }
  });
}

// `auto` reuses a printer this page was already allowed to use, and stays
// quiet if there is none — the picker needs a real click.
export async function connect({ auto = false } = {}) {
  if (!inCharge()) { if (!auto) emit("printer:error", { message: "Another tab is running the machine — use that one, or close it." }); return false; }
  let device = null;
  try {
    const devices = await navigator.usb.getDevices();
    device = devices.find(isPrinterDevice);
    if (!device) {
      if (auto) return false;
      device = await navigator.usb.requestDevice({ filters: [{ classCode: 7 }] });
    }
    if (!isPrinterDevice(device)) throw new Error("The selected USB device does not expose a printer interface.");

    await device.open();
    if (!device.configuration) await device.selectConfiguration(1);

    const before = getPrintInterface(device);
    const wanted = before.alternates.find(a => a.endpoints.some(e => e.direction === "out")) || before.alternates[0];
    await device.claimInterface(before.interfaceNumber);
    // Re-read after claiming: transfers must use the SELECTED alternate.
    const claimed = getPrintInterface(device);
    if (claimed.alternate?.alternateSetting !== wanted.alternateSetting) {
      await device.selectAlternateInterface(claimed.interfaceNumber, wanted.alternateSetting);
    }

    activeDevice = device;
    claimedInterface = claimed.interfaceNumber;
    emit("printer:connected", { name: device.productName || "USB printer" });
    return true;
  } catch (e) {
    if (device?.opened) { try { await device.close(); } catch (_) {} }
    dropDevice();
    if (!auto) {
      const needsGesture = e.name === "SecurityError" || /user gesture/i.test(e.message);
      const message = needsGesture
        ? "The printer can only be connected by clicking \"Connect printer\" (the browser requires a real click the first time)."
        : /claim/i.test(e.message)
          ? "Couldn't take control of the printer — something else is holding it. Close other tabs of this page (and any app using the printer) and try again."
          : "Printer connection error: " + e.message;
      emit("printer:error", { message });
    }
    return false;
  }
}

async function transfer(bytes) {
  const iface = getPrintInterface();
  const alternate = iface.alternate || iface.alternates[0];
  const endpoint = alternate.endpoints.find(e => e.direction === "out");
  if (!endpoint) throw new Error("Printer output endpoint not found.");
  for (let i = 0; i < bytes.length; i += 16384) {
    const chunk = bytes.subarray(i, i + 16384);
    const result = await activeDevice.transferOut(endpoint.endpointNumber, chunk);
    if (result.status !== "ok" || result.bytesWritten !== chunk.length) {
      throw new Error("The printer did not accept all print data.");
    }
  }
}

// GS V 1: cut. Stops a slow print in progress and drops anything waiting, so
// paper can't start moving again right after the blade.
export function cut() {
  if (!isConnected()) return Promise.reject(new Error("Connect the printer before cutting."));
  activeAbort?.abort();
  for (let i = jobs.length - 1; i >= 0; i--) {
    jobs[i].resolve({ stopped: true, reason: "cancelled by paper cut" });
    jobs.splice(i, 1);
  }
  return new Promise((resolve, reject) => {
    jobs.unshift({ kind: "cut", label: "paper cut", resolve, reject });
    processQueue();
  });
}

/**
 * Queue a print. Resolves once it's printed, stopped or previewed-only
 * (no printer) — rejects only on a real failure.
 * @param {object} job
 * @param {() => HTMLCanvasElement|Promise<HTMLCanvasElement>} job.build - called right before printing
 * @param {string} [job.label]
 * @param {boolean} [job.slow] - override the shared fast/slow setting for this one print
 */
export function print(job) {
  return new Promise((resolve, reject) => {
    jobs.push({ ...job, resolve, reject });
    processQueue();
  });
}

async function processQueue() {
  if (processing) return;
  processing = true;
  while (jobs.length) await runJob(jobs.shift());
  processing = false;
}

async function runJob(job) {
  if (job.kind === "cut") {
    try {
      await transfer(new Uint8Array([29, 86, 1]));
      emit("printer:cut");
      job.resolve({ cut: true });
    } catch (error) {
      emit("printer:error", { label: job.label, message: error.message });
      job.reject(error);
    }
    return;
  }

  const abort = new AbortController();
  activeAbort = abort;
  try {
    const canvas = typeof job.build === "function" ? await job.build() : job.build;
    // Always show what would print, even with no printer attached.
    emit("printer:preview", { canvas, label: job.label });
    if (!isConnected() && !(await connect({ auto: true }))) {
      emit("printer:error", { label: job.label, message: `"${job.label || "Print"}" wasn't printed — no printer connected.` });
      job.resolve({ previewOnly: true });
      return;
    }
    emit("printer:printing", { label: job.label });
    const slow = job.slow ?? slowMode;
    if (slow) {
      const durationMs = (canvas.height / DOTS_PER_MM / slowSpeedMmPerSec) * 1000;
      await paceOntoPaper(canvas, { durationMs, signal: abort.signal });
    } else {
      await transfer(canvasToRasterBytes(canvas));
    }
    emit("printer:printed", { label: job.label });
    job.resolve({ printed: true });
  } catch (e) {
    if (e.name === "AbortError") {
      emit("printer:stopped", { label: job.label });
      job.resolve({ stopped: true });
      return;
    }
    // A failed transfer often leaves `opened` true on a device that no longer
    // takes data — drop it so the next print reconnects cleanly.
    if (activeDevice) {
      const failed = activeDevice;
      dropDevice();
      try { if (failed.opened) await failed.close(); } catch (_) {}
      emit("printer:disconnected");
    }
    emit("printer:error", { message: e.message, label: job.label });
    job.reject(e);
  } finally {
    if (activeAbort === abort) activeAbort = null;
  }
}

// Philip's weighted/"breathing" strip pacing from the occult printer, verified
// on real hardware there: 8-row strips with slightly uneven gaps and one
// longer pause just past halfway.
async function paceOntoPaper(canvas, { signal, durationMs, pauseAt = 0.55 }) {
  const rows = 8;
  const count = Math.ceil(canvas.height / rows);
  const weights = Array.from({ length: count - 1 }, (_, i) => {
    const fraction = (i + 1) * rows / canvas.height;
    const breath = Math.abs(fraction - pauseAt) < rows / canvas.height ? 8 : 0;
    return 0.8 + 0.4 * Math.sin(i * 0.21) ** 2 + breath;
  });
  const weightTotal = weights.reduce((a, b) => a + b, 0);
  // One reused strip canvas — a fresh canvas per strip crashed the renderer
  // partway through long prints on the occult printer's iMac.
  const slice = document.createElement("canvas");
  slice.width = canvas.width;
  const sliceCtx = slice.getContext("2d", { willReadFrequently: true });
  for (let i = 0; i < count; i++) {
    signal.throwIfAborted();
    const y = i * rows;
    const h = Math.min(rows, canvas.height - y);
    if (slice.height !== h) slice.height = h;
    sliceCtx.clearRect(0, 0, slice.width, h);
    sliceCtx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
    await transfer(canvasToRasterBytes(slice));
    if (i < count - 1) await wait(durationMs * weights[i] / weightTotal, signal);
  }
}

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
}
