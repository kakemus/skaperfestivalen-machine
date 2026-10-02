// The only file that knows the page exists: wires the sidebar to the printer,
// the IBM display, the micro:bit and the ticket designs.
import { on } from "./core/eventBus.js";
import * as printer from "./core/printer.js";
import * as controller from "./core/controller.js";
import * as ibm from "./core/ibmDisplay.js";
import { TICKETS } from "./tickets/index.js";
import { SCENES, INPUT_DEFAULTS, message } from "./display/scenes.js";
import { setupReplica } from "./display/replica.js";
import { every, after } from "./core/clock.js";

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
printer.connect({ auto: true });
controller.connect({ auto: true });
ibm.connect({ auto: true });

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
function startScene(name, instance = SCENES[name]()) {
  sceneName = name;
  scene = instance;
  sceneStart = performance.now();
  scene.setup(ibm);
  return scene;
}
function nextScene(step = 1) {
  const i = sceneNames.indexOf(sceneName);
  startScene(sceneNames[(i + step + sceneNames.length) % sceneNames.length]);
}
sceneSelect.onchange = () => {
  settings.scene = sceneSelect.value; saveSettings();
  holdUntil = 0;
  startScene(settings.scene === "auto" ? sceneNames[0] : settings.scene);
};
$("showMsg").onclick = () => {
  holdUntil = performance.now() + 30000; // hold the message for 30 s
  startScene("message", message({ top: $("msgTop").value, bottom: $("msgBottom").value }));
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
  if (button === "a") play();
  if (button === "b") { holdUntil = 0; nextScene(); }
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
  const t = (now - sceneStart) / 1000;
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

buildFields();
schedulePreview();
