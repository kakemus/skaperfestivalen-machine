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
  "steptime", "timeout", "after", "mingap", "idletension", "backlight", "kick", "inv1", "inv2"];
const DEFAULTS = {
  pull: 60, feed: 45, rewind: 80, tension: 35, tensionms: 200, mode: 0, level: 0, hyst: 8,
  steptime: 1500, timeout: 8000, after: 0, mingap: 300, idletension: 0, backlight: 25, kick: 80,
  inv1: 1, inv2: 1,   // this build has both motors wired the other way round (2026-10-13)
  paper: 0, mark: 0, jogSpeed: 50, jogMs: 800, tUp: 3, tRounds: 10, tPause: 500, pos: 0,
};
let saved = null;
try { saved = JSON.parse(localStorage.getItem("beltSettings")); } catch {}
const st = { ...DEFAULTS, ...(saved || {}) };
const hadSaved = !!saved;
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
function pushAllSettings() {
  for (const k of BOARD_KEYS) controller.send(`SET:${k}:${st[k]}`);
  log("Sent all settings to the micro:bit.", "ok");
}

// ---------- inputs ----------
const numberInputs = [...BOARD_KEYS.filter(k => !["mode", "inv1", "inv2"].includes(k)), "paper", "mark", "jogSpeed", "jogMs", "tUp", "tRounds", "tPause"];
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
    const [, state, w] = line.split(":");
    boardState = state;
    pill("pWukong", w === "W1" ? "Wukong: on" : "Wukong: OFF", w === "W1" ? "ok" : "bad");
    pill("pState", state === "idle" ? "idle" : `busy: ${state}`, state === "idle" ? "" : "busy");
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
      for (const k of BOARD_KEYS) if (k in board) { st[k] = board[k]; const el = $(inputId(k)); if (el && !["mode", "inv1", "inv2"].includes(k)) el.value = st[k]; }
      $("mode").checked = !!st.mode;
      for (const k of ["inv1", "inv2"]) $(k).checked = !!st[k];
      persist(); drawMeter(); verdict();
    }
    return;
  }
  if (line.startsWith("WUKONG:")) pill("pWukong", line.endsWith("ON") ? "Wukong: on" : "Wukong: OFF", line.endsWith("ON") ? "ok" : "bad");
  const bad = /ERROR|ERR:|BUSY|OFF/.test(line);
  log(`← ${line}`, bad ? "err" : "ok");
  settleMove(line);
});

// ---------- moves ----------
let pending = null;   // { resolve, timer, label }
function setBusy(b) {
  for (const id of ["up", "down", "rewind", "tighten", "tStart", "ledTest", "holdUp", "holdDown"]) $(id).disabled = b;
  document.querySelectorAll("[data-jog]").forEach(el => (el.disabled = b));
}
function move(line, label, screens = 1) {
  if (pending) { log("Still moving — wait, or press STOP.", "err"); return Promise.resolve("busy"); }
  if (!toBoard(line)) return Promise.resolve("no board");
  setBusy(true);
  const limit = screens * (st.mode ? st.timeout : st.steptime * 2) + st.tensionms + 4000;
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
  if (line === "BELT:DONE" || line === "TENSION:DONE" || line === "MOTOR:DONE" || line === "LED:DONE") finish("ok");
  else if (line.startsWith("BELT:ERROR") || line.startsWith("MOTOR:ERROR") || line === "BUSY" || line === "STOPPED" || line.startsWith("ERR:")) finish(line);
}
function showPos() { $("pos").textContent = st.pos === 0 ? "Screen 0 (START)" : `Screen ${st.pos}`; persist(); }
showPos();

async function stepUp() { const r = await move("BELT:STEP", "Step up"); if (r === "ok") { st.pos++; showPos(); } return r; }
async function stepDown() {
  if (st.pos <= 0) log("Already at START as far as this page knows — stepping down anyway.", "err");
  const r = await move("BELT:BACK:1", "Step down"); if (r === "ok") { st.pos = Math.max(0, st.pos - 1); showPos(); } return r;
}
async function rewindToStart() {
  if (st.pos <= 0) { log("Already at START."); return "ok"; }
  const n = st.pos;
  const r = await move(`BELT:BACK:${n}`, `Rewind ${n}`, n); if (r === "ok") { st.pos = 0; showPos(); } return r;
}
$("up").onclick = stepUp;
$("down").onclick = stepDown;
$("rewind").onclick = rewindToStart;
$("tighten").onclick = () => move("TENSION", "Tighten");
$("ledOn").onclick = () => toBoard("LED:ON");
$("ledOff").onclick = () => toBoard("LED:OFF");
$("ledTest").onclick = () => move("LED:TEST", "LED test");
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

$("here0").onclick = () => { st.pos = 0; showPos(); log("Position set to START."); };
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
