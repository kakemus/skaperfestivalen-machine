// Belt test page: only the scroll mechanism — moves, tension, light-sensor
// calibration, motor settings, a repeat test and a copyable log. Talks to the
// machine micro:bit (firmware/machine.py) through core/controller.js.
//
// Settings live in two places on purpose: this browser (localStorage
// "beltSettings") and the micro:bit itself (settings.txt, via SET:key:value),
// so nothing needs recalibrating after a page refresh or a board restart.
import { on } from "./core/eventBus.js";
import * as controller from "./core/controller.js";
import { every, after, cancel } from "./core/clock.js";
import { whenInCharge } from "./core/singleTab.js";

const $ = id => document.getElementById(id);

// ---------- settings ----------
// keys the board knows (same names as firmware S); "rewind" uses input id "rewind_"
const BOARD_KEYS = ["pull", "feed", "rewind", "tension", "tensionms", "mode", "level", "hyst",
  "steptime", "timeout", "after", "mingap", "idletension", "backlight", "cr", "cg", "cb", "kick", "inv1", "inv2",
  "brake", "creep", "settle"];
const DEFAULTS = {
  pull: 60, feed: 45, rewind: 80, tension: 55, tensionms: 400, mode: 0, level: 0, hyst: 8,
  steptime: 1500, timeout: 8000, after: 0, mingap: 300, idletension: 0, backlight: 25, cr: 255, cg: 120, cb: 10, kick: 80,
  inv1: 1, inv2: 1,   // this build has both motors wired the other way round (2026-10-13)
  brake: 30, creep: 40, settle: 600,
  paper: 0, mark: 0, jogSpeed: 50, jogMs: 800, tUp: 3, tRounds: 10, tPause: 500, pos: 0,
};
let saved = null;
try { saved = JSON.parse(localStorage.getItem("beltSettings")); } catch {}
const st = { ...DEFAULTS, ...(saved || {}) };
const hadSaved = !!saved;
// 2026-10-13: tightening became a soft ramp — the old 35 / 200 ms never got the motors turning
if (saved && !saved.tensionRamp) {
  if (st.tension === 35 && st.tensionms === 200) { st.tension = 55; st.tensionms = 400; }
  st.tensionRamp = 1;
}
// 2026-10-13: settling searches each way for this long — 1.5 s looked like a rewind back and forth
if (saved && !saved.settleV2) { if (st.settle === 1500) st.settle = 600; st.settleV2 = 1; }
const persist = () => { try { localStorage.setItem("beltSettings", JSON.stringify(st)); } catch {} };
const inputId = k => (k === "rewind" ? "rewind_" : k);

// ---------- log ----------
function log(text, cls = "") {
  if (cls === "hb" && !$("showHb").checked) return;
  const el = document.createElement("div");
  const t = new Date();
  el.textContent = `${t.toLocaleTimeString()}.${String(t.getMilliseconds()).padStart(3, "0")}  ${text}`;
  el.className = cls === "hb" ? "dim" : cls;
  $("log").prepend(el);
  while ($("log").children.length > 400) $("log").lastChild.remove();
}
$("copyLog").onclick = async () => {
  const text = [...$("log").children].reverse().map(e => e.textContent).join("\n");
  try { await navigator.clipboard.writeText(text); log("Log copied — paste it to Claude.", "ok"); }
  catch { log("Couldn't copy automatically — select the log text and copy it by hand.", "err"); }
};
$("clearLog").onclick = () => { $("log").innerHTML = ""; };
// On the phone, copying text off it is awkward: post the log to the Mac's
// phone_server.py instead (it keeps it in /tmp/phonecheck-results.txt).
$("sendLog").onclick = () => {
  const text = "BELT LOG\n" + [...$("log").children].reverse().map(e => e.textContent).join("\n");
  fetch("results", { method: "POST", body: text })
    .then(r => log(r.ok ? "Log sent to the Mac." : "The Mac didn't take it (open this page through start-phone.command).", r.ok ? "ok" : "err"))
    .catch(() => log("Couldn't reach the Mac — is it on the same hotspot with start-phone.command running?", "err"));
};

// ---------- sending ----------
function toBoard(line, quiet = false) {
  if (!controller.send(line)) { if (!quiet) log("No micro:bit connected — click Connect micro:bit.", "err"); return false; }
  if (!quiet) log(`→ ${line}`, "out");
  return true;
}
const pendingSet = {};
function sendSetting(key) {
  clearTimeout(pendingSet[key]);
  pendingSet[key] = setTimeout(() => toBoard(`SET:${key}:${st[key]}`), 250);
}
// One at a time, a little apart: sent in one burst the board's small serial
// buffer overflowed and a line came out garbled ("ERR:unknown ttle:1500", 2026-10-13).
function pushAllSettings() {
  BOARD_KEYS.forEach((k, i) => after(i * 40, () => controller.send(`SET:${k}:${st[k]}`)));
  after(BOARD_KEYS.length * 40, () => log("Sent all settings to the micro:bit.", "ok"));
}

// ---------- inputs ----------
const NOT_NUMBERS = ["mode", "inv1", "inv2", "cr", "cg", "cb"];   // checkboxes / the colour picker
const numberInputs = [...BOARD_KEYS.filter(k => !NOT_NUMBERS.includes(k)), "paper", "mark", "jogSpeed", "jogMs", "tUp", "tRounds", "tPause"];
for (const k of numberInputs) {
  const el = $(inputId(k));
  el.value = st[k];
  el.onchange = () => {
    const v = Math.round(Number(el.value));
    if (!Number.isFinite(v)) { el.value = st[k]; return; }
    st[k] = v;
    if (k === "paper" || k === "mark") autoLevel();
    persist();
    if (BOARD_KEYS.includes(k)) sendSetting(k);
    drawMeter();
    verdict();
  };
}
$("mode").checked = !!st.mode;
// backlight colour: one colour field ↔ the board's cr/cg/cb; sent while dragging, so the box changes live
const hex2 = n => n.toString(16).padStart(2, "0");
const showColour = () => { $("colour").value = "#" + hex2(st.cr) + hex2(st.cg) + hex2(st.cb); };
showColour();
$("colour").oninput = () => {
  const v = $("colour").value;
  [st.cr, st.cg, st.cb] = [1, 3, 5].map(i => parseInt(v.slice(i, i + 2), 16));
  persist();
  for (const k of ["cr", "cg", "cb"]) sendSetting(k);
};
for (const k of ["inv1", "inv2"]) {
  $(k).checked = !!st[k];
  $(k).onchange = () => { st[k] = $(k).checked ? 1 : 0; persist(); sendSetting(k); };
}
$("mode").onchange = () => { st.mode = $("mode").checked ? 1 : 0; persist(); sendSetting("mode"); verdict(); };

function autoLevel() {
  if (st.paper > 0 && st.mark > 0 && st.paper > st.mark) {
    st.level = Math.round((st.paper + st.mark) / 2);
    st.hyst = Math.max(4, Math.round((st.paper - st.mark) / 6));
    $("level").value = st.level;
    $("hyst").value = st.hyst;
    sendSetting("level");
    sendSetting("hyst");
  }
}

// ---------- light ----------
let lightNow = null;
const recent = [];
$("live").onchange = () => toBoard(`STREAM:${$("live").checked ? "ON" : "OFF"}`);
$("usePaper").onclick = () => useCurrent("paper");
$("useMark").onclick = () => useCurrent("mark");
function useCurrent(key) {
  if (lightNow == null) { log("No light reading yet — tick Live reading first.", "err"); return; }
  st[key] = lightNow;
  st[key + "Wobble"] = recent.length >= 3 ? Math.max(...recent.slice(-6)) - Math.min(...recent.slice(-6)) : 5;
  $(key).value = lightNow;
  autoLevel();
  persist();
  drawMeter();
  verdict();
}
function drawMeter() {
  const pct = v => `${Math.max(0, Math.min(100, v / 10.23))}%`;
  $("bar").style.width = pct(lightNow ?? 0);
  $("mPaper").style.left = pct(st.paper); $("mPaper").style.display = st.paper ? "" : "none";
  $("mMark").style.left = pct(st.mark); $("mMark").style.display = st.mark ? "" : "none";
  $("mLevel").style.left = pct(st.level); $("mLevel").style.display = st.level ? "" : "none";
  $("lightNow").textContent = lightNow == null ? "–" : `${lightNow}${st.level ? (lightNow < st.level ? "  ● mark" : "  ○ paper") : ""}`;
}
function verdict() {
  const el = $("verdict");
  if (!st.paper || !st.mark) { el.textContent = "Hold paper, then a black mark, in front of the sensor and press Use current for each."; return; }
  const gap = st.paper - st.mark;
  const wobble = Math.max(3, st.paperWobble ?? 5, st.markWobble ?? 5);
  el.textContent = gap <= 0 ? "The mark isn't darker than the paper — check the numbers."
    : gap >= 8 * wobble ? `Gap ${gap}, wobble ±${wobble}: clear — stopping on marks should be reliable.`
    : gap >= 4 * wobble ? `Gap ${gap}, wobble ±${wobble}: workable in a dark box, but tight.`
    : `Gap ${gap}, wobble ±${wobble}: too small. Sensor closer to the paper, shade it, brighter backlight.`;
  if (st.mode && !st.level) el.textContent += " Stop on marks is on but there's no threshold — steps will be timed.";
}

// ---------- board state ----------
let lastHeard = 0, lastReconnect = 0, connected = false, boardState = "–";
const pill = (id, text, cls) => { $(id).textContent = text; $(id).className = "pill " + (cls || ""); };
on("controller:connected", () => {
  connected = true;
  pill("pUsb", "micro:bit: connected", "ok");
  log("micro:bit connected", "ok");
  after(800, () => {
    toBoard("SETTINGS?");
    if (hadSaved) after(400, pushAllSettings);   // this page's settings win; first visit adopts the board's
    if ($("live").checked) toBoard("STREAM:ON", true);
  });
});
on("controller:disconnected", () => {
  connected = false;
  pill("pUsb", "micro:bit: not connected", "bad");
  log("micro:bit disconnected", "err");
  finish("the connection was reset — press it again");   // a move in flight was lost with it
});
on("controller:error", ({ message }) => log(message, "err"));
$("connect").onclick = () => controller.connect();

every(1000, () => {
  const ago = (performance.now() - lastHeard) / 1000;
  if (!connected) { pill("pBoard", "board: –"); return; }
  if (lastHeard && ago < 5) pill("pBoard", "board: answering", "ok");
  else {
    pill("pBoard", lastHeard ? `board: silent ${Math.round(ago)} s` : "board: waiting…", "bad");
    // the board sends a heartbeat every 2 s; silence means the link is stuck → reopen it (at most every 20 s)
    if (lastHeard && ago > 6 && performance.now() - lastReconnect > 20000) {
      lastReconnect = performance.now();
      log("The board has gone quiet — reconnecting.", "err");
      controller.reconnect();
    }
  }
});

on("controller:raw", ({ line }) => {
  lastHeard = performance.now();
  if (line.startsWith("HB:")) {
    const [, state, w, p] = line.split(":");
    boardState = state;
    if (p !== undefined) boardPos(Number(p));
    pill("pWukong", w === "W1" ? "Wukong: on" : "Wukong: OFF", w === "W1" ? "ok" : "bad");
    pill("pState", state === "idle" ? "idle" : state === "service" ? "SERVICE MODE (YES+NO 5 s to leave)" : `busy: ${state}`,
      state === "idle" ? "" : "busy");
    log(`← ${line}`, "hb");
    return;
  }
  if (line.startsWith("LIGHT:")) {
    lightNow = Number(line.slice(6));
    recent.push(lightNow); if (recent.length > 20) recent.shift();
    drawMeter();
    return;   // too many to log
  }
  if (line.startsWith("SETTINGS:")) {
    const board = Object.fromEntries(line.slice(9).split(",").map(kv => kv.split("=")).map(([k, v]) => [k, Number(v)]));
    log(`← board settings: ${line.slice(9)}`, "ok");
    if (!hadSaved) {              // first time on this page: take over what the board already knows
      for (const k of BOARD_KEYS) if (k in board) { st[k] = board[k]; const el = $(inputId(k)); if (el && !NOT_NUMBERS.includes(k)) el.value = st[k]; }
      showColour();
      $("mode").checked = !!st.mode;
      for (const k of ["inv1", "inv2"]) $(k).checked = !!st[k];
      persist(); drawMeter(); verdict();
    }
    return;
  }
  if (line.startsWith("BELT:DONE:")) boardPos(Number(line.slice(10)));
  if (line.startsWith("POS:OK:")) boardPos(Number(line.slice(7)));
  if (line.startsWith("WUKONG:")) pill("pWukong", line.endsWith("ON") ? "Wukong: on" : "Wukong: OFF", line.endsWith("ON") ? "ok" : "bad");
  const bad = /ERROR|ERR:|BUSY|OFF/.test(line);
  log(`← ${line}`, bad ? "err" : "ok");
  settleMove(line);
});

// ---------- moves ----------
let pending = null;   // { resolve, timer, label }
function setBusy(b) {
  for (const id of ["up", "down", "rewind", "tighten", "tStart", "holdUp", "holdDown"]) $(id).disabled = b;
  document.querySelectorAll("[data-jog]").forEach(el => (el.disabled = b));
}
function move(line, label, screens = 1) {
  if (pending) { log("Still moving — wait, or press STOP.", "err"); return Promise.resolve("busy"); }
  if (!toBoard(line)) return Promise.resolve("no board");
  if (line.startsWith("BELT") && !st.mode) log("(timed step — \"Stop on marks\" is off, so the marks are ignored)", "dim");
  setBusy(true);
  const limit = (line === "BELT:HOME" ? 15 : screens) * (st.mode ? st.timeout : st.steptime * 2) + st.tensionms + st.settle * 3 + 4000;
  return new Promise(resolve => {
    pending = { resolve, label, timer: after(limit, () => finish("no answer from the board")) };
  });
}
function finish(result) {
  if (!pending) return;
  cancel(pending.timer);
  const p = pending;
  pending = null;
  setBusy(false);
  if (result !== "ok") log(`${p.label}: ${result}`, "err");
  p.resolve(result);
}
function settleMove(line) {
  if (!pending) return;
  if (line.startsWith("BELT:DONE") || line === "TENSION:DONE" || line === "MOTOR:DONE") finish("ok");
  else if (line.startsWith("BELT:ERROR") || line.startsWith("MOTOR:ERROR") || line === "BUSY" || line === "STOPPED" || line.startsWith("ERR:")) finish(line);
}
// The board knows where the belt is (BELT:DONE:n, heartbeats); -1 = it doesn't.
let pos = -1;
function boardPos(p) {
  if (!Number.isFinite(p) || p === pos) return;
  pos = p;
  $("pos").textContent = p < 0 ? "Position unknown" : p === 0 ? "Screen 0 (START)" : `Screen ${p}`;
}
$("pos").textContent = "Position unknown";

const stepUp = () => move("BELT:STEP", "Step up");
const stepDown = () => move("BELT:BACK:1", "Step down");
const rewindToStart = () => move("BELT:HOME", "Find START");
$("up").onclick = stepUp;
$("down").onclick = stepDown;
$("rewind").onclick = rewindToStart;
$("tighten").onclick = () => move("TENSION", "Tighten");
$("ledOn").onclick = () => toBoard("LED:ON");
$("ledOff").onclick = () => toBoard("LED:OFF");
$("flashG").onclick = () => toBoard("LED:FLASH:G");     // what a right answer shows
$("flashR").onclick = () => toBoard("LED:FLASH:R");     // ... and a wrong one
// hold-to-run: HOLD:±1 repeated every 250 ms while pressed (the board stops by itself
// 600 ms after the last one, so a lost connection can't leave it running), HOLD:0 on release
let holdTimer = null, holdDir = 0;
function holdStart(dir, btn) {
  if (pending) { log("Still moving — wait, or press STOP.", "err"); return; }
  if (holdDir) return;
  if (!toBoard(`HOLD:${dir}`)) return;
  holdDir = dir;
  btn.classList.add("on");
  holdTimer = every(250, () => controller.send(`HOLD:${dir}`));
}
function holdEnd() {
  if (!holdDir) return;
  cancel(holdTimer);
  holdTimer = null;
  holdDir = 0;
  document.querySelectorAll(".hold.on").forEach(b => b.classList.remove("on"));
  toBoard("HOLD:0");
}
for (const [id, dir] of [["holdUp", 1], ["holdDown", -1]]) {
  const btn = $(id);
  btn.addEventListener("pointerdown", e => { e.preventDefault(); btn.setPointerCapture?.(e.pointerId); holdStart(dir, btn); });
  for (const ev of ["pointerup", "pointercancel", "lostpointercapture"]) btn.addEventListener(ev, holdEnd);
}
window.addEventListener("blur", holdEnd);                 // switching away mid-hold stops it
document.addEventListener("visibilitychange", () => { if (document.hidden) holdEnd(); });

$("here0").onclick = () => toBoard("POS:0");
document.querySelectorAll("[data-jog]").forEach(btn => btn.onclick = () => {
  const [m, dir] = btn.dataset.jog.split(":").map(Number);
  move(`MOTOR:${m}:${dir * st.jogSpeed}:${st.jogMs}`, `M${m}`);
});
$("stop").onclick = () => {
  testRunning = false;
  holdEnd();
  if (!toBoard("STOP")) return;
  finish("stopped");
};

// ---------- repeat test ----------
let testRunning = false;
const wait = ms => new Promise(r => after(ms, r));
$("tStart").onclick = async () => {
  if (testRunning) return;
  testRunning = true;
  let ok = 0, errors = 0;
  $("sOk").textContent = 0; $("sErr").textContent = 0;
  log(`Repeat test: ${st.tRounds} rounds of ${st.tUp} up + rewind.`, "ok");
  for (let round = 1; round <= st.tRounds && testRunning; round++) {
    $("sRound").textContent = round;
    for (let i = 0; i < st.tUp && testRunning; i++) {
      const r = await stepUp();
      if (r !== "ok") { errors++; break; }
      ok++; $("sOk").textContent = ok;
      await wait(st.tPause);
    }
    if (!testRunning || errors) break;
    const r = await rewindToStart();
    if (r !== "ok") { errors++; break; }
    ok++; $("sOk").textContent = ok;
    await wait(st.tPause);
  }
  $("sErr").textContent = errors;
  log(errors ? `Test stopped after an error (${ok} moves ok). Copy the log and send it to Claude.` : `Test finished: ${ok} moves, no errors.`, errors ? "err" : "ok");
  testRunning = false;
};
$("tStop").onclick = () => { testRunning = false; log("Test will stop after the current move."); };

// ---------- start ----------
drawMeter();
verdict();
setBusy(false);
whenInCharge(() => { $("otherTab").hidden = true; controller.connect({ auto: true }); },
  () => { $("otherTab").hidden = false; log("Another tab has the micro:bit — close it.", "err"); });
