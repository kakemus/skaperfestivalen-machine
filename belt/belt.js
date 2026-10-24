// The belt: where it is, moving it, and a backlit on-screen view of the window.
//
// Every move is shown on screen AND sent to the belt micro:bit (firmware/
// machine.py) as "BELT:STEP" (one screen up) or "BELT:HOME" (down until the
// long START mark — the board finds it itself, so nothing here counts
// screens). The board answers "BELT:DONE:n" when it has settled on the mark.
// With no board connected — or one that never answers — the on-screen belt
// alone sets the pace, so the game always carries on.
import { after } from "../core/clock.js";
import { stripLayout } from "./strip.js";

const STEP_MS = 1600;           // on-screen time for one screen up
const REWIND_MS_PER_SCREEN = 450;
const HARDWARE_TIMEOUT_MS = 15000;
const HOME_TIMEOUT_MS = 60000;  // finding START from the top can take a while

export function createBelt({ canvas, send }) {
  const ctx = canvas.getContext("2d");
  let strip = null, layout = null;
  let position = 0;                       // screen index the window shows
  let anim = { from: 0, to: 0, start: 0, ms: 0 };
  let waitingForBoard = null;
  let inFlight = null;                    // { command, from, timeout } of the move the board hasn't finished

  function view() {
    if (!strip) return;
    const now = performance.now();
    const k = anim.ms ? Math.min(1, (now - anim.start) / anim.ms) : 1;
    const ease = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
    const at = anim.from + (anim.to - anim.from) * ease;
    const y = layout.centerOf(at) - layout.screen / 2;
    canvas.width = strip.width;
    canvas.height = layout.screen;
    ctx.drawImage(strip, 0, -y);
    // backlight: paper glows warm, ink stays dark, edges fall off
    ctx.globalCompositeOperation = "multiply";
    const g = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, 40, canvas.width / 2, canvas.height / 2, canvas.width * 0.75);
    g.addColorStop(0, "#fff8e0");
    g.addColorStop(1, "#c98a3a");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = "source-over";
    if (k < 1) requestAnimationFrame(view);
  }

  function armTimeout(resolve, ms) {
    after(ms, () => { if (waitingForBoard === resolve) { waitingForBoard = null; inFlight = null; resolve("timeout"); } });
  }

  function move(to, ms, command, timeout = HARDWARE_TIMEOUT_MS) {
    const from = position;
    position = to;
    anim = { from, to, start: performance.now(), ms };
    requestAnimationFrame(view);
    const screenDone = new Promise(resolve => after(ms, resolve));
    if (!send(command)) return screenDone;
    inFlight = { command, from, timeout };
    // Wait for the board too, but never forever.
    const boardDone = new Promise(resolve => {
      waitingForBoard = resolve;
      armTimeout(resolve, timeout);
    });
    return Promise.all([screenDone, boardDone]);
  }

  return {
    get position() { return position; },
    get last() { return layout ? layout.count - 1 : 0; },
    setStrip(stripCanvas, cfg) {
      strip = stripCanvas;
      layout = stripLayout(cfg);
      position = Math.min(position, layout.count - 1);
      anim = { from: position, to: position, start: 0, ms: 0 };
      view();
    },
    step() { return move(Math.min(position + 1, layout.count - 1), STEP_MS, "BELT:STEP"); },
    /** n screens up / down in one move (the board's BELT:UP:n / BELT:BACK:n; Tankeleseren jumps to its guess) */
    up(n) { return n > 0 ? move(Math.min(position + n, layout.count - 1), STEP_MS * n, `BELT:UP:${n}`, HARDWARE_TIMEOUT_MS * n) : Promise.resolve(); },
    back(n) { return n > 0 ? move(Math.max(position - n, 0), STEP_MS * n, `BELT:BACK:${n}`, HARDWARE_TIMEOUT_MS * n) : Promise.resolve(); },
    rewind() {
      // always ask the board, even at 0 on screen: it may have been moved by hand
      return move(0, Math.max(800, position * REWIND_MS_PER_SCREEN), "BELT:HOME", HOME_TIMEOUT_MS);
    },
    /** The move the board was in the middle of, if any: { command, from }. */
    get inFlight() { return waitingForBoard ? inFlight : null; },
    /** After the board was reset mid-move (phone.js's watchdog, 2026-10-24): send the same
     *  command again and give the board its full time for it; the game keeps waiting. */
    resend() {
      if (!waitingForBoard || !inFlight) return false;
      if (!send(inFlight.command)) return false;
      armTimeout(waitingForBoard, inFlight.timeout);
      return true;
    },
    /** call with every line from the micro:bit */
    handleLine(line) {
      // BUSY too: a move the board refused must not leave the game waiting a minute
      if (line.startsWith("BELT:DONE") || line.startsWith("BELT:ERROR") || line === "BUSY") {
        const resolve = waitingForBoard;
        waitingForBoard = null;
        inFlight = null;
        resolve?.(line);
      }
    },
  };
}
