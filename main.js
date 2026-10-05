// The only file that knows the page exists: wires the sidebar to the printer,
// the IBM display, the micro:bit and the ticket designs.
import { on } from "./core/eventBus.js";
import * as printer from "./core/printer.js";
import * as controller from "./core/controller.js";
import * as ibm from "./core/ibmDisplay.js";
import { TICKETS } from "./tickets/index.js";
import { SCENES, INPUT_DEFAULTS } from "./display/scenes.js";
import { setupReplica } from "./display/replica.js";
import { every, after, cancel as cancelTimer } from "./core/clock.js";
import { whenInCharge } from "./core/singleTab.js";
import { textScene } from "./display/lcdText.js";
import { createGame } from "./game/game.js";
import { DEFAULT_QUESTIONS, parseQuestions } from "./game/questions.js";
import { ding } from "./game/sound.js";
import { createBelt } from "./belt/belt.js";
import { DEFAULT_STRIP, drawStrip, stripLengthCm } from "./belt/strip.js";

const $ = id => document.getElementById(id);
const FPS = 15;
const QUIET_AFTER_MS = 5000; // micro:bit silent this long → the ghost takes over

// ---------- saved settings (this browser only) ----------
function load(key, fallback) {
  try { return { ...fallback, ...JSON.parse(localStorage.getItem(key)) }; } catch { return { ...fallback }; }
}
function save(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }

const settings = load("machineSettings", {
  design: "prize", values: {}, slowMode: false, slowSpeed: 6, feedMm: 15, scene: "auto", sceneSeconds: 15,
  questions: null, answerSeconds: 30, rewardPrints: true, scanIsCoin: true, coinPrompt: true, strip: {},
  jogSpeed: 50, jogMs: 1000, markLevel: 0, stopOnMarks: false,
  pullSpeed: 60, feedSpeed: 45, rewindSpeed: 80, snugSpeed: 30, snugMs: 120,
});
const saveSettings = () => save("machineSettings", settings);

// ---------- log ----------
function log(text, cls = "") {
  const el = document.createElement("div");
  el.textContent = `${new Date().toLocaleTimeString()}  ${text}`;
  if (cls) el.className = cls;
  $("log").prepend(el);
  while ($("log").children.length > 60) $("log").lastChild.remove();
}

// ---------- connections ----------
const dots = { printer: $("dotPrinter"), controller: $("dotMicrobit"), ibm: $("dotIbm") };
for (const [name, label] of [["printer", "Printer"], ["controller", "micro:bit"], ["ibm", "IBM display"]]) {
  on(`${name}:connected`, () => { dots[name].classList.add("on"); log(`${label} connected`, "ok"); });
  on(`${name}:disconnected`, () => { dots[name].classList.remove("on"); log(`${label} disconnected`); });
  on(`${name}:error`, ({ message }) => log(message, "err"));
}
$("connectPrinter").onclick = () => printer.connect();
$("connectMicrobit").onclick = () => controller.connect();
$("connectIbm").onclick = () => ibm.connect();
whenInCharge(() => {
  $("otherTab").hidden = true;
  printer.connect({ auto: true });
  controller.connect({ auto: true });
  ibm.connect({ auto: true });
}, () => { $("otherTab").hidden = false; log("The machine is already open in another tab — this one won't touch the hardware.", "err"); });

// ---------- tickets ----------
const designSelect = $("design");
for (const [key, t] of Object.entries(TICKETS)) designSelect.add(new Option(t.label, key));
if (!TICKETS[settings.design]) settings.design = "prize";
designSelect.value = settings.design;

function design() { return TICKETS[settings.design]; }
function values(key = settings.design) {
  const defaults = Object.fromEntries(TICKETS[key].fields.map(f => [f.key, f.default]));
  return { ...defaults, ...settings.values[key] };
}

function buildFields() {
  const box = $("fields");
  box.innerHTML = "";
  const v = values();
  for (const f of design().fields) {
    const wrap = document.createElement("div");
    wrap.className = "field";
    const label = document.createElement("label");
    label.textContent = f.label;
    const input = document.createElement(f.type === "textarea" ? "textarea" : "input");
    if (f.type !== "textarea") input.type = f.type === "number" ? "number" : "text";
    input.value = v[f.key];
    input.oninput = () => {
      settings.values[settings.design] = { ...settings.values[settings.design], [f.key]: input.value };
      saveSettings();
      schedulePreview();
    };
    wrap.append(label, input);
    box.append(wrap);
  }
  $("randomize").style.display = design().randomize ? "" : "none";
}

const preview = $("ticketPreview");
function showCanvas(canvas, label) {
  preview.width = canvas.width;
  preview.height = canvas.height;
  preview.getContext("2d").drawImage(canvas, 0, 0);
  $("previewLabel").textContent = label;
}
let previewQueued = false;
function schedulePreview() {
  if (previewQueued) return;
  previewQueued = true;
  requestAnimationFrame(() => {
    previewQueued = false;
    const c = design().draw(values(), { feedMm: settings.feedMm });
    showCanvas(c, `Ticket preview · ${(c.height / 8 / 10).toFixed(1)} cm`);
  });
}

designSelect.onchange = () => { settings.design = designSelect.value; saveSettings(); buildFields(); schedulePreview(); };
$("randomize").onclick = () => {
  settings.values[settings.design] = { ...settings.values[settings.design], ...design().randomize() };
  saveSettings(); buildFields(); schedulePreview();
};
$("resetFields").onclick = () => { delete settings.values[settings.design]; saveSettings(); buildFields(); schedulePreview(); };

function printTicket(key = settings.design, overrides = {}) {
  const v = { ...values(key), ...overrides };
  return printer.print({ label: TICKETS[key].label, build: () => TICKETS[key].draw(v, { feedMm: settings.feedMm }) });
}
$("printTicket").onclick = () => printTicket();
$("cut").onclick = () => printer.cut().catch(e => log(e.message, "err"));
on("printer:printing", ({ label }) => log(`Printing ${label}…`));
on("printer:printed", ({ label }) => log(`Printed ${label}`, "ok"));
on("printer:stopped", ({ label }) => log(`Stopped ${label}`));
on("printer:cut", () => log("Paper cut"));
on("printer:preview", ({ canvas, label }) => showCanvas(canvas, `Last print · ${label}`));

// ---------- printer settings ----------
function bindRange(id, key, fmt, apply) {
  const el = $(id), out = $(id + "Val");
  el.value = settings[key];
  const update = () => { settings[key] = Number(el.value); out.textContent = fmt(settings[key]); apply?.(settings[key]); saveSettings(); };
  el.oninput = update;
  update();
}
$("slowMode").checked = settings.slowMode;
printer.setSlowMode(settings.slowMode);
$("slowMode").onchange = () => { settings.slowMode = $("slowMode").checked; printer.setSlowMode(settings.slowMode); saveSettings(); };
bindRange("slowSpeed", "slowSpeed", v => `${v} mm/s`, v => printer.setSlowSpeed(v));
bindRange("feedMm", "feedMm", v => `${v} mm`, () => schedulePreview());

// ---------- IBM display scenes ----------
const drawReplica = setupReplica($("lcdCanvas"));
on("ibm:changed", state => drawReplica(state));
drawReplica(ibm.getState());

const sceneSelect = $("scene");
sceneSelect.add(new Option("Cycle through all scenes", "auto"));
const sceneNames = Object.keys(SCENES);
for (const name of sceneNames) sceneSelect.add(new Option(SCENES[name]().label, name));
sceneSelect.value = settings.scene in SCENES || settings.scene === "auto" ? settings.scene : "auto";
bindRange("sceneSeconds", "sceneSeconds", v => `${v} s`);

let scene = null, sceneName = null, sceneStart = 0, holdUntil = 0;
let lastIdle = null;
function startScene(name, instance = SCENES[name]()) {
  if (name in SCENES) lastIdle = name;
  sceneName = name;
  scene = instance;
  sceneStart = performance.now();
  scene.setup(ibm);
  return scene;
}
function nextScene(step = 1) {
  if (game?.state === "attract" && settings.coinPrompt && sceneName !== "coin") {
    return startScene("coin", textScene("SETT INN MYNT FOR Å SPILLE!"));
  }
  const i = sceneNames.indexOf(lastIdle);
  startScene(sceneNames[(i + step + sceneNames.length) % sceneNames.length]);
}
sceneSelect.onchange = () => {
  settings.scene = sceneSelect.value; saveSettings();
  holdUntil = 0;
  startScene(settings.scene === "auto" ? sceneNames[0] : settings.scene);
};
$("showMsg").onclick = () => {
  holdUntil = performance.now() + 30000; // hold the message for 30 s
  startScene("message", textScene([$("msgTop").value, $("msgBottom").value].filter(Boolean).join(" "))); // handles Æ Ø Å
};
startScene(settings.scene === "auto" ? sceneNames[0] : settings.scene);

// ---------- input: micro:bit, or the ghost when it's quiet ----------
const live = { ...INPUT_DEFAULTS };
let lastHeard = 0, shakePending = false;
const heard = () => { lastHeard = performance.now(); };
on("controller:tilt", ({ x, y }) => {
  heard();
  live.tiltX = Math.max(-1, Math.min(1, x / 1000));
  live.tiltY = Math.max(-1, Math.min(1, y / 1000));
});
on("controller:mic", ({ level }) => { heard(); live.sound = Math.min(1, level / 255); });
on("controller:gesture", ({ gesture }) => { heard(); if (gesture === "shake") shakePending = true; });
on("controller:button", ({ button, pressed, synthetic }) => {
  heard();
  live[button] = pressed;
  if (!pressed || synthetic) return;
  if (game.state === "attract") { if (button === "a") game.coin(); else nextScene(); return; }
  game.answer(button === "a");
});

function ghost(t) {
  return {
    ...INPUT_DEFAULTS,
    tiltX: Math.sin(t * 0.7),
    tiltY: Math.sin(t * 0.43) * 0.8,
    sound: Math.max(0, Math.sin(t * 1.3)) ** 3,
  };
}

function currentInput(t) {
  const quiet = performance.now() - lastHeard > QUIET_AFTER_MS;
  const inp = quiet ? ghost(t) : { ...live };
  inp.shake = shakePending;
  shakePending = false;
  return inp;
}

every(1000 / FPS, () => {
  const now = performance.now();
  if (holdUntil && now > holdUntil) { holdUntil = 0; startScene(settings.scene === "auto" ? sceneNames[0] : settings.scene); }
  if (!holdUntil && settings.scene === "auto" && now - sceneStart > settings.sceneSeconds * 1000) nextScene();
  const t = Math.max(0, (performance.now() - sceneStart) / 1000); // a scene started this tick would otherwise get t < 0
  const inp = currentInput(t);
  scene.frame(ibm, t, inp);
  $("inputs").textContent =
    `${now - lastHeard > QUIET_AFTER_MS ? "ghost (no micro:bit heard)" : "micro:bit live"}\n` +
    `tilt ${inp.tiltX.toFixed(2)} ${inp.tiltY.toFixed(2)}  sound ${inp.sound.toFixed(2)}  A ${live.a ? "■" : "□"} B ${live.b ? "■" : "□"}`;
});
$("inputs").style.whiteSpace = "pre";

// ---------- play: spin the reels on the display, then print the prize ticket ----------
let playing = false;
function play() {
  if (playing) return;
  playing = true;
  const result = TICKETS.prize.randomize();
  holdUntil = performance.now() + 12000;
  startScene("slots").spin(result.result);
  log(`Play → ${result.result}`);
  after(3000, () => {
    printTicket("prize", result).catch(e => log(e.message, "err")).finally(() => { playing = false; });
  });
}
$("play").onclick = play;

// ---------- the game ----------
const stripCfg = () => ({ ...DEFAULT_STRIP, ...settings.strip });
const belt = createBelt({ canvas: $("beltView"), send: line => controller.send(line) });
let game = null;

function questions() { return parseQuestions(settings.questions ?? DEFAULT_QUESTIONS); }

game = createGame({
  questions,
  answerSeconds: () => settings.answerSeconds,
  belt,
  text(str, opts) { holdUntil = Infinity; startScene("game", textScene(str, opts)); },
  idle() { holdUntil = 0; startScene(settings.scene === "auto" ? (lastIdle || sceneNames[0]) : settings.scene); },
  bell(times) { ding(times); controller.send(`BELL:DING:${times}`); },
  printReward(level) {
    if (settings.rewardPrints) printTicket("reward", { level }).catch(e => log(e.message, "err"));
  },
  printWin() {
    printTicket("prize", { reels: "★ ★ ★", result: "DU VANT!", message: `Du klarte alle ${belt.last} nivåene!` }).catch(e => log(e.message, "err"));
  },
  log,
  onState({ state, level, question }) {
    const words = {
      attract: "Waiting for a coin", starting: "Starting…", asking: `Level ${level} — waiting for JA / NEI`,
      climbing: `Right! Climbing to level ${level}`, lost: "Wrong — rewinding", won: "WON!", resetting: "Rewinding…",
    };
    $("gameStatus").textContent = words[state] + (state === "asking" && question ? `\n${question.text} → ${question.answer ? "JA" : "NEI"}` : "");
    $("beltLabel").textContent = `Belt window · screen ${belt.position} of ${belt.last}`;
  },
});
$("gameStatus").style.whiteSpace = "pre-wrap";

$("coin").onclick = () => game.coin();
$("answerYes").onclick = () => game.answer(true);
$("answerNo").onclick = () => game.answer(false);
$("resetGame").onclick = () => game.reset();

// lines from the machine micro:bit (buttons, coin, belt reports)
on("controller:raw", ({ line }) => {
  heard();
  belt.handleLine(line);
  if (line === "ANSWER:YES") game.answer(true);
  else if (line === "ANSWER:NO") game.answer(false);
  else if (line.startsWith("COIN")) game.coin();
});

// belt test buttons — straight commands to the machine board (firmware/machine.py)
function toBoard(line) {
  if (controller.send(line)) log(`→ ${line}`);
  else log("No micro:bit connected — click Connect next to micro:bit first.", "err");
}
bindRange("jogSpeed", "jogSpeed", v => `${v}`);
bindRange("jogMs", "jogMs", v => `${(v / 1000).toFixed(1)} s`);
document.querySelectorAll("[data-jog]").forEach(btn => btn.onclick = () => {
  const [m, dir] = btn.dataset.jog.split(":").map(Number);
  toBoard(`MOTOR:${m}:${dir * settings.jogSpeed}:${settings.jogMs}`);
});
$("ping").onclick = () => toBoard("PING");
$("readLight").onclick = () => toBoard("LIGHT?");
$("beltStep").onclick = () => toBoard("BELT:STEP");
$("beltBack").onclick = () => toBoard("BELT:BACK:1");
// live light meter: polls LIGHT? and helps pick paper vs. mark
const light = { now: null, paper: null, mark: null, polling: null, recent: [] };
// How much readings wobble on their own — the spread of the last few readings
// at the moment each button is pressed (holding still), so the paper/mark gap
// is judged against real noise, not a fixed percentage.
const spreadNow = () => {
  const last = light.recent.slice(-6);
  return last.length < 3 ? 5 : Math.max(...last) - Math.min(...last);
};
const noise = () => Math.max(3, light.paperNoise ?? 5, light.markNoise ?? 5);
function showVerdict() {
  const { paper, mark } = light;
  if (paper == null || mark == null) {
    $("lightVerdict").textContent = `Paper: ${paper ?? "–"} · mark: ${mark ?? "–"}. Hold each in front of the sensor and press its button.`;
    return;
  }
  const gap = paper - mark, n = noise();
  if (gap <= 0) {
    $("lightVerdict").textContent = `Paper ${paper}, mark ${mark}: the mark isn't darker than the paper — check you pressed the right buttons, and that the sensor sees the mark.`;
    return;
  }
  sendMarkLevel(Math.round((paper + mark) / 2));
  $("lightVerdict").textContent = gap >= 8 * n && gap >= 40
    ? `Paper ${paper}, mark ${mark}: gap ${gap}, readings wobble ±${n} — clear enough to stop on marks. Threshold set to ${settings.markLevel}.`
    : gap >= 4 * n && gap >= 20
      ? `Paper ${paper}, mark ${mark}: gap ${gap}, wobble ±${n} — workable in a closed, dark box, but tight. Threshold set to ${settings.markLevel}. A closer or shaded sensor would make it safer.`
      : `Paper ${paper}, mark ${mark}: gap ${gap}, wobble ±${n} — too close to tell apart reliably. Put the sensor right behind the paper opposite the backlight, shade it, or use bigger/blacker marks.`;
}
function sendMarkLevel(level) {
  settings.markLevel = level;
  saveSettings();
  controller.send(`MARKLEVEL:${level}`);
  showMarkLevel();
}
function showMarkLevel() {
  $("markLevelInfo").textContent = settings.markLevel
    ? `Mark threshold: below ${settings.markLevel} = mark (from your paper/mark calibration).`
    : "No calibration yet — measure paper and a mark with the live reading above.";
}
$("stopOnMarks").checked = settings.stopOnMarks;
$("stopOnMarks").onchange = () => {
  settings.stopOnMarks = $("stopOnMarks").checked;
  saveSettings();
  toBoard(`STOPMODE:${settings.stopOnMarks ? "MARK" : "TIME"}`);
};
// motor speeds + snug tug: sent when a slider is let go, and on every connect
const sendSpeeds = () => controller.send(`SPEEDS:${settings.pullSpeed}:${settings.feedSpeed}:${settings.rewindSpeed}`);
const sendSnug = () => controller.send(`SNUG:${settings.snugSpeed}:${settings.snugMs}`);
for (const [id, fmt, send] of [["pullSpeed", v => `${v}`, sendSpeeds], ["feedSpeed", v => `${v}`, sendSpeeds],
  ["rewindSpeed", v => `${v}`, sendSpeeds], ["snugSpeed", v => v ? `${v}` : "off", sendSnug], ["snugMs", v => `${v} ms`, sendSnug]]) {
  bindRange(id, id, fmt);
  $(id).onchange = () => { if (!send()) log("Saved — sent to the board once a micro:bit is connected."); };
}

// a freshly started board knows nothing: send calibration, stop mode, speeds, snug whenever it connects
on("controller:connected", () => after(1500, () => {
  if (settings.markLevel) controller.send(`MARKLEVEL:${settings.markLevel}`);
  controller.send(`STOPMODE:${settings.stopOnMarks ? "MARK" : "TIME"}`);
  sendSpeeds();
  sendSnug();
}));
showMarkLevel();
$("liveLight").onchange = () => {
  const on = $("liveLight").checked;
  $("lightMeter").hidden = !on;
  if (on) { light.polling = every(150, () => controller.send("LIGHT?")); showVerdict(); }
  else if (light.polling) { cancelTimer(light.polling); light.polling = null; }
};
$("markPaper").onclick = () => { light.paper = light.now; light.paperNoise = spreadNow(); showVerdict(); };
$("markMark").onclick = () => { light.mark = light.now; light.markNoise = spreadNow(); showVerdict(); };
on("controller:raw", ({ line }) => {
  if (!line.startsWith("LIGHT:")) return;
  light.now = Number(line.slice(6));
  light.recent = [...light.recent.slice(-19), light.now];
  $("lightNow").textContent = `Light: ${light.now} (0 = dark, 1023 = bright)`;
  $("lightBar").style.width = `${Math.min(100, light.now / 10.23)}%`;
});

on("controller:raw", ({ line }) => {
  if (light.polling && line.startsWith("LIGHT:")) return; // the meter shows these; don't flood the log
  if (/^(PONG|LIGHT:|MOTOR:|BELT:|WUKONG:|MARKLEVEL:|STOPMODE:|SPEEDS:|SNUG:)/.test(line)) log(`← ${line}`, /ERROR|OFF/.test(line) ? "err" : "ok");
});

// keyboard + barcode scanner. A scanner "types" its code very fast (a few ms
// per key) and usually ends with Enter — but some send Tab or nothing, so a
// fast burst that simply stops also counts. Single keys are held back a moment
// so a code's letters aren't taken as C/J/N presses.
let scanBuffer = "", lastKeyAt = 0, pendingKey = null, burstEnd = null;
function endBurst() {
  clearTimeout(burstEnd);
  if (scanBuffer.length >= 4) { clearTimeout(pendingKey); onScan(scanBuffer); }
  scanBuffer = "";
}
window.addEventListener("keydown", e => {
  if (e.target.closest?.("input, textarea, select") || e.metaKey || e.ctrlKey || e.altKey) return;
  const now = performance.now();
  const fast = now - lastKeyAt < 50;
  lastKeyAt = now;
  if (e.key === "Enter" || (e.key === "Tab" && scanBuffer.length >= 4)) { e.preventDefault(); endBurst(); return; }
  if (e.key.length !== 1) return;
  scanBuffer = fast ? scanBuffer + e.key : e.key;
  clearTimeout(burstEnd);
  burstEnd = setTimeout(endBurst, 150);
  clearTimeout(pendingKey);
  if (fast) return; // part of a scan
  const key = e.key.toLowerCase();
  pendingKey = setTimeout(() => {
    if (scanBuffer.length > 1) return; // turned out to be the start of a scan
    if (key === "c") game.coin();
    else if (key === "j" || key === "y") game.answer(true);
    else if (key === "n") game.answer(false);
  }, 80);
});
$("printScannerCodes").onclick = () => {
  showCanvas(TICKETS.scannerSetup.draw(values("scannerSetup"), { feedMm: settings.feedMm }), "Scanner setup codes");
  printTicket("scannerSetup").catch(e => log(e.message, "err"));
};
function onScan(code) {
  log(`Scanned: ${code}${settings.scanIsCoin ? " → coin" : ""}`, "ok");
  if (settings.scanIsCoin) game.coin();
}

// game settings
bindRange("answerSeconds", "answerSeconds", v => `${v} s`);
for (const id of ["rewardPrints", "scanIsCoin", "coinPrompt"]) {
  $(id).checked = settings[id];
  $(id).onchange = () => { settings[id] = $(id).checked; saveSettings(); };
}
function showQuestionCount() { $("questionCount").textContent = `${questions().length} questions`; }
$("questions").value = settings.questions ?? DEFAULT_QUESTIONS;
$("questions").oninput = () => { settings.questions = $("questions").value; saveSettings(); showQuestionCount(); };
$("resetQuestions").onclick = () => { settings.questions = null; $("questions").value = DEFAULT_QUESTIONS; saveSettings(); showQuestionCount(); };
showQuestionCount();

// belt strip settings
function rebuildStrip() {
  const cfg = stripCfg();
  belt.setStrip(drawStrip(cfg), cfg);
  $("stripInfo").textContent = `${cfg.levels + 1} screens · strip ≈ ${stripLengthCm(cfg).toFixed(0)} cm long · ${(cfg.leaderMm / 10).toFixed(0)} cm blank at each end to glue on · marks at the left edge, START has the long one`;
  $("beltLabel").textContent = `Belt window · screen ${belt.position} of ${belt.last}`;
}
for (const [id, key, unit] of [["stripLevels", "levels", ""], ["stripScreenMm", "screenMm", " mm"], ["stripLeaderMm", "leaderMm", " mm"]]) {
  const el = $(id), out = $(id + "Val");
  el.value = stripCfg()[key];
  out.textContent = el.value + unit;
  el.oninput = () => { settings.strip = { ...settings.strip, [key]: Number(el.value) }; out.textContent = el.value + unit; saveSettings(); rebuildStrip(); };
}
$("stripTitles").value = stripCfg().titles;
$("stripTitles").oninput = () => { settings.strip = { ...settings.strip, titles: $("stripTitles").value }; saveSettings(); rebuildStrip(); };
$("printStrip").onclick = () => printer.print({ label: "Paper strip", build: () => drawStrip(stripCfg()), slow: false });
$("previewStrip").onclick = () => showCanvas(drawStrip(stripCfg()), `Paper strip · ${stripLengthCm(stripCfg()).toFixed(0)} cm`);
rebuildStrip();

buildFields();
schedulePreview();
