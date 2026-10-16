// The phone version of the machine (phone.html): the printer and the micro:bit
// on the phone's USB port, a hidden operator panel. Since 2026-10-16 it runs the
// maker's life simulator (game/life.js): the printed receipt is the only screen
// visitors see — the phone's own screen just mirrors the state for the operator.
// (The Mac page, main.js, still runs the old quiz.) Must keep working on Chrome 87.
import { on } from "./core/eventBus.js";
import * as printer from "./core/printer.js";
import * as controller from "./core/controller.js";
import { whenInCharge } from "./core/singleTab.js";
import { after, every, cancel } from "./core/clock.js";
import { createLifeGame } from "./game/life.js";
import { DEFAULT_CARDS, FINAL_TEXT, parseCards, kroner } from "./game/cards.js";
import * as receipt from "./game/receipt.js";
import { ding } from "./game/sound.js";
import { createBelt } from "./belt/belt.js";
import { DEFAULT_STRIP, drawStrip } from "./belt/strip.js";

const VERSION = "phone 2026-10-16 c";
const $ = id => document.getElementById(id);

// ---------- settings (kept on the phone) ----------
const settings = (() => {
  // cards / finalText: null = the defaults in game/cards.js; ntfyTopic: "" = no push notification
  const d = { answerSeconds: 30, cards: null, finalText: null, ntfyTopic: "" };
  try { return { ...d, ...JSON.parse(localStorage.getItem("phoneSettings")) }; } catch { return d; }
})();
const save = () => { try { localStorage.setItem("phoneSettings", JSON.stringify(settings)); } catch {} };
const cardText = () => settings.cards ?? DEFAULT_CARDS;
const cards = () => parseCards(cardText());
const finalText = () => settings.finalText ?? FINAL_TEXT;

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
const ATTRACT = ["TRYKK JA + NEI FOR Å STARTE", "KJØP DEG OPP I LIVET", "IKKE NØL"];
let attractTimer = null, attractI = 0;
function attract(on) {
  if (attractTimer) { cancel(attractTimer); attractTimer = null; }
  if (!on) return;
  const next = () => {
    const lines = ATTRACT, i = attractI++ % lines.length;
    shown = [lines[i], { blink: i === 0 }];             // the first line ("insert coin") blinks
    show(...shown);
  };
  next();
  attractTimer = every(3500, next);
}

// ---------- belt + game ----------
const belt = createBelt({ canvas: document.createElement("canvas"), send: line => controller.send(line) });
// one screen per card (START = card 1), so the strip has cards − 1 levels above START
function setStrip() {
  const cfg = { ...DEFAULT_STRIP, levels: Math.max(1, cards().length - 1) };
  belt.setStrip(drawStrip(cfg), cfg);
}
setStrip();

const print = (label, build) => printer.print({ label, build }).catch(e => log("Print failed: " + e.message));

// optional push notification through ntfy (ntfy.sh — an app, or ntfy.sh/app in a browser)
function notify(text) {
  if (!settings.ntfyTopic) return;
  fetch("https://ntfy.sh/" + encodeURIComponent(settings.ntfyTopic), { method: "POST", body: text })
    .then(() => log("Push sent"), e => log("Push failed (no internet?): " + e.message));
}

const game = createLifeGame({
  cards,
  seconds: () => settings.answerSeconds,
  finalText,
  belt,
  print,
  cut: () => printer.cut().catch(e => log("Cut: " + e.message)),
  bell(times) { ding(times); controller.send(`BELL:${times}`); },
  flash(right) { controller.send(`LED:FLASH:${right ? "G" : "R"}`); },
  hurry(ms) { controller.send(`LED:HURRY:${ms}`); },
  celebrate() { controller.send("LED:WIN"); },
  notify,
  idle() { runTimer(0); showLevels(0); attract(true); },
  log,
  onState({ state, level, debt, card }) {
    showLevels(level);
    runTimer(state === "deciding" ? settings.answerSeconds : 0);
    if (state === "attract") return;
    attract(false);
    // the phone's screen is only for the operator: what the scroll shows and what's right
    const what = { starting: "NYTT SPILL", deciding: card ? `NIVÅ ${level + 1}: ${card.title} · ${kroner(card.price)} KR` : "",
      climbing: "KJØPT!", lost: "TAPT", won: "JACKPOT!", resetting: "TILBAKE TIL START" }[state] || state;
    shown = [what + (state === "deciding" ? `\n(${card && card.buy ? "JA" : "NEI"} · GJELD ${kroner(debt)})` : ""), {}];
    show(...shown);
  },
});
// the board's Find START must know how many screens the strip has
on("controller:connected", () => after(2500, () => controller.send(`SET:screens:${cards().length}`)));
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
  // heartbeats, live light readings and trace samples would flood the log
  // (a whole game's events got pushed out by LIGHT lines, 2026-10-16)
  if (!/^(HB|LIGHT|T):/.test(line)) log("← " + line);
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

// ---------- operator panel: the small ⚙ button top-left ----------
$("gear").onclick = () => { $("panel").hidden = false; };
$("close").onclick = () => { $("panel").hidden = true; after(100, showAgain); };

$("connectPrinter").onclick = () => printer.connect();
$("connectMicrobit").onclick = () => controller.connect();
$("tCoin").onclick = () => game.coin();
$("tYes").onclick = () => game.answer(true);
$("tNo").onclick = () => game.answer(false);
$("tStep").onclick = () => controller.send("BELT:STEP") || log("No micro:bit connected");
$("tHome").onclick = () => controller.send("BELT:HOME") || log("No micro:bit connected");
$("tPrint").onclick = () => print("Test", () => receipt.bought(1, cards()[0] || { title: "TEST", price: 0 }, 1234));
$("tBell").onclick = () => { ding(1); controller.send("BELL:1") || log("No micro:bit connected"); };
$("tWin").onclick = () => controller.send("LED:WIN") || log("No micro:bit connected");
// the game log, to the Mac's phone_server.py (getting text off the phone is awkward)
$("sendLog").onclick = () => fetch("results", { method: "POST", body: "GAME LOG\n" + lines.join("\n") })
  .then(r => log(r.ok ? "Log sent to the Mac." : "The Mac didn't take it."), () => log("Couldn't reach the Mac."));
$("tCut").onclick = () => printer.cut().catch(e => log(e.message));
$("tReset").onclick = () => { $("panel").hidden = true; game.reset(); };
// same tab, so this page lets go of the micro:bit and the belt page takes it; "← Game" comes back
$("beltPage").onclick = () => { location.href = "belt.html"; };

$("answerSeconds").value = settings.answerSeconds;
$("answerSeconds").onchange = () => { settings.answerSeconds = Math.max(5, Number($("answerSeconds").value) || 30); save(); };
const countCards = () => {
  const n = cards().length;
  $("cCount").textContent = `${n} cards → ${n} screens on the strip`;
};
$("cards").value = cardText();
$("cards").oninput = () => {
  settings.cards = $("cards").value; save(); countCards(); setStrip(); showLevels(game.level);
  controller.send(`SET:screens:${cards().length}`);
};
$("cReset").onclick = () => { settings.cards = null; $("cards").value = DEFAULT_CARDS; save(); countCards(); setStrip(); showLevels(0); };
countCards();
$("finalText").value = finalText();
$("finalText").oninput = () => { settings.finalText = $("finalText").value; save(); };
$("ntfy").value = settings.ntfyTopic;
$("ntfy").onchange = () => { settings.ntfyTopic = $("ntfy").value.trim(); save(); };
$("ntfyTest").onclick = () => settings.ntfyTopic ? notify("Test fra maskinen") : log("Type a topic name first");

// keyboard, for testing on a computer: C = coin, J = ja, N = nei
window.addEventListener("keydown", e => {
  if (e.target.closest?.("input, textarea")) return;
  const k = e.key.toLowerCase();
  if (k === "c") game.coin(); else if (k === "j") game.answer(true); else if (k === "n") game.answer(false);
});

// ---------- offline copy (sw.js) ----------
$("version").textContent = VERSION;
$("startVersion").textContent = VERSION;
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").then(
    () => log("Offline copy: on"),
    e => log("Offline copy failed: " + e.message));
}
