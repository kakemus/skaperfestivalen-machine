// The phone version of the machine (phone.html): the game on the phone's own
// screen, the printer and the micro:bit on its USB port, a hidden operator
// panel. Same game, belt and ticket modules as the computer page (main.js);
// only the screen and the controls differ. Must keep working on Chrome 87.
import { on } from "./core/eventBus.js";
import * as printer from "./core/printer.js";
import * as controller from "./core/controller.js";
import { whenInCharge } from "./core/singleTab.js";
import { after, every, cancel } from "./core/clock.js";
import { createGame } from "./game/game.js";
import { DEFAULT_QUESTIONS, parseQuestions } from "./game/questions.js";
import { ding } from "./game/sound.js";
import { createBelt } from "./belt/belt.js";
import { DEFAULT_STRIP, drawStrip } from "./belt/strip.js";
import { TICKETS } from "./tickets/index.js";

const VERSION = "phone 2026-10-14 b";
const $ = id => document.getElementById(id);

// ---------- settings (kept on the phone) ----------
const settings = (() => {
  const d = { answerSeconds: 30, levels: DEFAULT_STRIP.levels, rewardPrints: true, questions: null };
  try { return { ...d, ...JSON.parse(localStorage.getItem("phoneSettings")) }; } catch { return d; }
})();
const save = () => { try { localStorage.setItem("phoneSettings", JSON.stringify(settings)); } catch {} };

// ---------- log ----------
const lines = [];
function log(text) {
  lines.push(`${new Date().toLocaleTimeString()}  ${text}`);
  if (lines.length > 150) lines.shift();
  $("log").textContent = lines.slice().reverse().join("\n");
}

// ---------- the screen ----------
// Text is set as big as it fits: the font size is found by halving the range
// until the wrapped text just fits the screen area.
function show(str, { blink = false } = {}) {
  const el = $("text"), box = $("screen");
  el.textContent = str;
  el.classList.toggle("blink", blink);
  let lo = 12, hi = 200;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    el.style.fontSize = mid + "px";
    if (el.scrollHeight <= box.clientHeight && el.scrollWidth <= box.clientWidth) lo = mid; else hi = mid;
  }
  el.style.fontSize = lo + "px";
}
let shown = ["", {}];
const showAgain = () => show(shown[0], shown[1]);
window.addEventListener("resize", () => after(100, showAgain));

function showLevels(level) {
  const n = belt.last;
  $("levels").innerHTML = Array.from({ length: n }, (_, i) => `<b class="${i < level ? "on" : ""}"></b>`).join("");
}
function runTimer(seconds) {
  const bar = $("timer"), fill = bar.firstElementChild;
  bar.style.visibility = seconds ? "visible" : "hidden";
  fill.style.transition = "none";
  fill.style.transform = "scaleX(1)";
  if (!seconds) return;
  void fill.offsetWidth;                                // restart the transition
  fill.style.transition = `transform ${seconds}s linear`;
  fill.style.transform = "scaleX(0)";
}

// attract mode: a few lines taking turns until a coin comes
const ATTRACT = [["SETT INN MYNT", { blink: true }], ["SVAR JA ELLER NEI"], ["KLATRE HELT TIL TOPPEN"], ["VINN EN PREMIE!"]];
let attractTimer = null, attractI = 0;
function attract(on) {
  if (attractTimer) { cancel(attractTimer); attractTimer = null; }
  if (!on) return;
  const next = () => { const [t, o = {}] = ATTRACT[attractI++ % ATTRACT.length]; shown = [t, o]; show(t, o); };
  next();
  attractTimer = every(3500, next);
}

// ---------- belt + game ----------
const belt = createBelt({ canvas: document.createElement("canvas"), send: line => controller.send(line) });
function setStrip() {
  const cfg = { ...DEFAULT_STRIP, levels: settings.levels };
  belt.setStrip(drawStrip(cfg), cfg);
}
setStrip();

const ticketValues = key => Object.fromEntries(TICKETS[key].fields.map(f => [f.key, f.default]));
const printTicket = (key, extra) =>
  printer.print({ label: TICKETS[key].label, build: () => TICKETS[key].draw({ ...ticketValues(key), ...extra }, { feedMm: 15 }) })
    .catch(e => log("Print failed: " + e.message));

const game = createGame({
  questions: () => parseQuestions(settings.questions ?? DEFAULT_QUESTIONS),
  answerSeconds: () => settings.answerSeconds,
  belt,
  text(str, opts = {}) { attract(false); shown = [str, opts]; show(str, opts); },
  idle() { runTimer(0); showLevels(0); attract(true); },
  bell(times) { ding(times); controller.send(`BELL:${times}`); },
  printReward(level) { if (settings.rewardPrints) printTicket("reward", { level }); },
  printWin() { printTicket("prize", { reels: "★ ★ ★", result: "DU VANT!", message: `Du klarte alle ${belt.last} nivåene!` }); },
  log,
  onState({ state, level }) {
    showLevels(level);
    runTimer(state === "asking" ? settings.answerSeconds : 0);
  },
});
showLevels(0);
attract(true);

// ---------- hardware ----------
on("controller:raw", ({ line }) => {
  belt.handleLine(line);
  if (line === "ANSWER:YES") game.answer(true);
  else if (line === "ANSWER:NO") game.answer(false);
  else if (line.startsWith("COIN")) game.coin();
  const pos = line.match(/^(?:BELT:DONE|HB:\w+:W\d):(-?\d+)/);
  if (pos) $("sPos").textContent = pos[1] === "-1" ? "unknown" : pos[1] === "0" ? "START" : "screen " + pos[1];
  if (!line.startsWith("HB:")) log("← " + line);
  lastHeard = Date.now();
});
let lastHeard = 0;
const pill = (id, text, ok) => { $(id).textContent = text; $(id).className = ok ? "ok" : "bad"; };
on("printer:connected", ({ name }) => { pill("sPrinter", name || "connected", true); log("Printer connected"); });
on("printer:disconnected", () => { pill("sPrinter", "not connected", false); log("Printer unplugged"); });
on("printer:error", ({ message }) => log("Printer: " + message));
on("printer:printed", ({ label }) => log("Printed " + label));
on("controller:connected", () => { pill("sMicrobit", "connected", true); log("micro:bit connected"); });
on("controller:disconnected", () => { pill("sMicrobit", "not connected", false); log("micro:bit unplugged"); });
on("controller:error", ({ message }) => log("micro:bit: " + message));

// tiny status in the corner of the game screen: only shows trouble
every(1000, () => {
  const p = printer.isConnected(), m = controller.isConnected() && Date.now() - lastHeard < 6000;
  $("status").innerHTML = (p ? "" : '<span class="bad">printer </span>') + (m ? "" : '<span class="bad">micro:bit</span>');
});

whenInCharge(() => {
  $("otherTab").hidden = true;
  printer.connect({ auto: true });
  controller.connect({ auto: true });
}, () => { $("otherTab").hidden = false; });

// ---------- the first tap: full screen, screen on, sound ----------
let wakeLock = null;
async function keepAwake() {
  try { wakeLock = await navigator.wakeLock?.request("screen"); } catch (e) { log("Screen may sleep: " + e.message); }
}
document.addEventListener("visibilitychange", () => { if (!document.hidden) keepAwake(); });
$("tapToStart").addEventListener("click", async () => {
  $("tapToStart").hidden = true;
  try { await document.documentElement.requestFullscreen?.(); } catch {}
  keepAwake();
  ding(0);                                                // unlocks sound for later
  after(300, showAgain);
});

// ---------- operator panel: long press in the top-left corner ----------
let pressTimer = null;
$("corner").addEventListener("pointerdown", () => { pressTimer = setTimeout(() => { $("panel").hidden = false; }, 2000); });
for (const ev of ["pointerup", "pointerleave", "pointercancel"]) $("corner").addEventListener(ev, () => clearTimeout(pressTimer));
$("close").onclick = () => { $("panel").hidden = true; after(100, showAgain); };

$("connectPrinter").onclick = () => printer.connect();
$("connectMicrobit").onclick = () => controller.connect();
$("tCoin").onclick = () => game.coin();
$("tYes").onclick = () => game.answer(true);
$("tNo").onclick = () => game.answer(false);
$("tStep").onclick = () => controller.send("BELT:STEP") || log("No micro:bit connected");
$("tHome").onclick = () => controller.send("BELT:HOME") || log("No micro:bit connected");
$("tPrint").onclick = () => printTicket("reward", { level: 1 });
$("tCut").onclick = () => printer.cut().catch(e => log(e.message));
$("tReset").onclick = () => { $("panel").hidden = true; game.reset(); };
// same tab, so this page lets go of the micro:bit and the belt page takes it; "← Game" comes back
$("beltPage").onclick = () => { location.href = "belt.html"; };

$("answerSeconds").value = settings.answerSeconds;
$("answerSeconds").onchange = () => { settings.answerSeconds = Math.max(5, Number($("answerSeconds").value) || 30); save(); };
$("levels_").value = settings.levels;
$("levels_").onchange = () => { settings.levels = Math.min(15, Math.max(3, Number($("levels_").value) || 10)); save(); setStrip(); showLevels(game.level); };
$("rewardPrints").checked = settings.rewardPrints;
$("rewardPrints").onchange = () => { settings.rewardPrints = $("rewardPrints").checked; save(); };
const countQuestions = () => { $("qCount").textContent = `${parseQuestions(settings.questions ?? DEFAULT_QUESTIONS).length} questions`; };
$("questions").value = settings.questions ?? DEFAULT_QUESTIONS;
$("questions").oninput = () => { settings.questions = $("questions").value; save(); countQuestions(); };
$("qReset").onclick = () => { settings.questions = null; $("questions").value = DEFAULT_QUESTIONS; save(); countQuestions(); };
countQuestions();

// keyboard, for testing on a computer: C = coin, J = ja, N = nei
window.addEventListener("keydown", e => {
  if (e.target.closest?.("input, textarea")) return;
  const k = e.key.toLowerCase();
  if (k === "c") game.coin(); else if (k === "j") game.answer(true); else if (k === "n") game.answer(false);
});

// ---------- offline copy (sw.js) ----------
$("version").textContent = VERSION;
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").then(
    () => log("Offline copy: on"),
    e => log("Offline copy failed: " + e.message));
}
