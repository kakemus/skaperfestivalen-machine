// The phone version of the machine (phone.html): the printer and the micro:bit
// on the phone's USB port, a hidden operator panel. Since 2026-10-20 it runs
// Kvitteringsspillet, Aksel's script (game/kvittering.js; before that the life
// simulator, game/life.js): the scroll shows the question, the printed receipt is
// the answer — the phone's own screen just mirrors the state for the operator.
// (The Mac page, main.js, still runs the old quiz.) Must keep working on Chrome 87.
import { on } from "./core/eventBus.js";
import * as printer from "./core/printer.js";
import * as controller from "./core/controller.js";
import { whenInCharge } from "./core/singleTab.js";
import { after, every, cancel } from "./core/clock.js";
import { createKvitteringGame, LIVSTID_MS } from "./game/kvittering.js";
import { MANUS } from "./game/manus.js";
import * as tegning from "./game/kvitteringTegning.js";
import { lcdLinjer, LOKK_ETTER_MS } from "./game/kvitteringDisplay.js";
import { ding, buzzer, preloadSounds } from "./game/sound.js";
import { createBelt } from "./belt/belt.js";
import { DEFAULT_STRIP, drawStrip, stripLengthCm } from "./belt/strip.js";

const VERSION = "phone 2026-10-21 o";
const $ = id => document.getElementById(id);

// ---------- settings (kept on the phone) ----------
const settings = (() => {
  // (Older keys from the life game — answerSeconds, cards, finalText — may still be stored;
  // nothing reads them now.)
  // answerFeedMm: paper fed after each answer (the print head sits well below the slot)
  // ntfyTopic: the maker's own channel (2026-10-20); an empty saved one falls back to it too,
  // since the field used to start empty and that empty value was saved with every setting
  const d = { ntfyTopic: "kvitteringsspillet-c26433ea", answerFeedMm: 40 };
  let s = d;
  try { s = { ...d, ...JSON.parse(localStorage.getItem("phoneSettings")) }; } catch {}
  if (!s.ntfyTopic) s.ntfyTopic = d.ntfyTopic;
  return s;
})();
const save = () => { try { localStorage.setItem("phoneSettings", JSON.stringify(settings)); } catch {} };

// ---------- log ----------
const lines = [];
function log(text) {
  lines.push(`${new Date().toLocaleTimeString()}  ${text}`);
  if (lines.length > 1500) lines.shift();          // enough for a long session: "Send log" got only the last minute or two
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
/** The bar runs out over `seconds`, starting `from` full (the life left). */
function runTimer(seconds, from = 1) {
  const bar = $("timer"), fill = bar.firstElementChild;
  bar.style.visibility = seconds ? "visible" : "hidden";
  fill.style.transition = "none";
  fill.style.transform = `scaleX(${from})`;
  if (!seconds) return;
  void fill.offsetWidth;                                // restart the transition
  fill.style.transition = `transform ${seconds}s linear`;
  fill.style.transform = "scaleX(0)";
}

// ---------- belt + game ----------
const belt = createBelt({ canvas: document.createElement("canvas"), send: line => controller.send(line) });
// one screen per question (START = question 1), so the strip has questions − 1 levels above START
// the pictures load in the background; until then (or if one is missing) its screen shows a text box
let bilder = {};
const stripCfg = () => ({ ...DEFAULT_STRIP, levels: Math.max(1, MANUS.sporsmal.length - 1), screens: tegning.skjermer(MANUS, bilder) });
belt.setStrip(drawStrip(stripCfg()), stripCfg());
tegning.lastBilder(MANUS).then(b => { bilder = b; belt.setStrip(drawStrip(stripCfg()), stripCfg()); });

const print = (label, build) => printer.print({ label, build }).catch(e => log("Print failed: " + e.message));

// optional push notification through ntfy (ntfy.sh — an app, or ntfy.sh/app in a browser)
function notify(text) {
  if (!settings.ntfyTopic) return;
  fetch("https://ntfy.sh/" + encodeURIComponent(settings.ntfyTopic), { method: "POST", body: text })
    .then(() => log("Push sent"), e => log("Push failed (no internet?): " + e.message));
}

// the game moves the belt on only once an answer is printed: first feed that answer up out of
// the printer's slot (the head sits well below it), so it can be read while the next question comes
const feedAnswer = () => settings.answerFeedMm > 0 ? print("Feed", () => tegning.linjer([], { feedMm: settings.answerFeedMm })) : null;
const game = createKvitteringGame({
  now: () => performance.now(),
  after,
  cancel,
  belt: { step: () => Promise.resolve(feedAnswer()).then(() => belt.step()), rewind: () => belt.rewind() },
  // the game hands over one text line at a time; the start's title gets the big top
  // (which has its own rule under it, so the start's "=====" line is left out)
  print(label, lines) {
    if (label === "Start") return lines[0] && lines[0][0] !== "=" ? print(label, () => tegning.topp(lines[0])) : Promise.resolve();
    return print(label, () => tegning.linjer(lines));
  },
  // feed the end past the blade (it sits above the print head), then cut
  cut: () => print("Feed", () => tegning.linjer([], { feedMm: 15 })).then(() => printer.cut()).catch(e => log("Cut: " + e.message)),
  bell(times) { ding(times); controller.send(`BELL:${times}`); },
  // A right answer blinks green once (3 blinks, ~0.9 s). Losing has to be unmistakable, so the
  // board's red flash is sent 4 times back to back (~3.6 s); and a win's 6 s rainbow is sent again
  // after 5 s (~11 s) — longer without touching the micro:bit's program (2026-10-21).
  flash(right) {
    if (right) return controller.send("LED:FLASH:G");
    buzzer();                                             // and the wrong-answer buzzer on the phone's speaker
    for (let i = 0; i < 4; i++) after(i * 900, () => controller.send("LED:FLASH:R"));
  },
  hurry(ms) { controller.send(`LED:HURRY:${ms}`); },
  // a win: the rainbow twice over (~11 s), and the bell for ~30 s — the board rings at most
  // 10 per BELL command but queues them, so 6 commands 5 s apart (old firmware, no update)
  celebrate() {
    controller.send("LED:WIN");
    after(5000, () => controller.send("LED:WIN"));
    for (let i = 0; i < 6; i++) after(i * 5000, () => controller.send("BELL:10"));
  },
  idle() { runTimer(0); showLevels(0); },
  log,
  onState({ state, nr, sporsmal, spill, alder, igjenMs, valg }) {
    showLevels(nr);
    runTimer(state === "deciding" ? igjenMs / 1000 : 0, igjenMs / LIVSTID_MS);
    if (state === "over" && !spill.tapt) notify("Noen klarte Kvitteringsspillet!");
    if (state === "attract") return;
    // the phone's screen is only for the operator: what the scroll shows, the age, the balance
    const status = `${alder} ÅR · ${spill.kroner} KR · ${spill.venner.length} VENNER`;
    const what = {
      starting: "TIL START",
      ready: sporsmal ? `KLAR · ${sporsmal.nr}. ${sporsmal.tekst[sporsmal.tekst.length - 1]}` : "KLAR",
      deciding: sporsmal ? `${sporsmal.nr}. ${sporsmal.tekst[sporsmal.tekst.length - 1]}\nJA = ${valg[0]} · NEI = ${valg[1] || valg[0]}` : "",
      answering: "SKRIVER UT …",
      over: spill.tapt ? "TAPT" : "DU KLARTE DET!",
      pause: "TA KVITTERINGEN",
      rewinding: "SPOLER TILBAKE",
      resetting: "TILBAKE TIL START",
    }[state] || state;
    shown = [what + "\n" + status, {}];
    show(...shown);
  },
});
// the board's Find START must know how many screens the strip has; and a board that
// (re)connects while the machine stands ready is sent to START, since the power-on
// rewind may have run before it was there
on("controller:connected", () => after(2500, () => {
  controller.send(`SET:screens:${MANUS.sporsmal.length}`);
  if (game.state === "ready") game.reset();
}));
showLevels(0);
game.start();   // power-on: belt to START, then question 1 stands ready

// ---------- hardware ----------
// A calibration — JA + NEI held 5 s on the machine, or the panel's button — ends with the
// board finding START by itself; then the game is put back on START too (it lost its place).
let calibrated = false;
on("controller:raw", ({ line }) => {
  belt.handleLine(line);
  if (line.startsWith("CAL:OK")) calibrated = true;
  if (line.startsWith("CAL:FAIL") || (calibrated && line.startsWith("BELT:"))) {
    calibrated = false;
    log("Calibrated — the game goes back to START");
    game.reset();
  }
  if (line === "ANSWER:YES") game.answer(true);
  else if (line === "ANSWER:NO") game.answer(false);
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

// ---------- micro:bit watchdog ----------
// On 2026-10-20 the board kept freezing mid-game ("M" on its LEDs, still on USB, its heartbeat
// — sent every 2 s whatever it does — just stopping), always while a player was thinking and
// only with the IBM display on the hub; the cause isn't known yet. So: no heartbeat for 5 s →
// reset it the way its button does (a serial break), then, if the belt was standing still, tell
// it which screen it's on (POS) so the game simply goes on; if it was moving, back to START.
// Only one automatic reset until it's heard from again: a reset every few seconds once kept
// it from ever starting (and overrode its own button).
let lastHb = Date.now(), resetting = false, autoResetUsed = false, sinceConnect = Date.now();
on("controller:raw", ({ line }) => {
  if (!line.startsWith("HB:")) return;
  lastHb = Date.now();
  if (autoResetUsed) { autoResetUsed = false; pill("sMicrobit", "connected", true); }
});
on("controller:connected", () => { lastHb = sinceConnect = Date.now(); });
every(1000, async () => {
  if (!controller.isConnected() || resetting) return;
  const quiet = Date.now() - Math.max(lastHb, sinceConnect);
  if (quiet < 5000) return;
  if (autoResetUsed) {
    if (quiet < 6000) log("micro:bit still not answering after its reset — unplug its USB cable and plug it back in");
    return;
  }
  autoResetUsed = true;
  resetting = true;
  const still = ["ready", "deciding"].includes(game.state), screen = belt.position;
  log(`micro:bit silent for ${Math.round(quiet / 1000)} s (game: ${game.state}, screen ${screen}) — resetting it`);
  pill("sMicrobit", "not answering — resetting", false);
  if (await controller.resetBoard()) {
    await new Promise(r => after(3000, r));                  // it starts up again
    controller.send(`SET:screens:${MANUS.sporsmal.length}`);
    if (still) {
      controller.send(`POS:${screen}`);
      log(`micro:bit reset — told it it's on screen ${screen}; the game goes on`);
    } else {
      log("micro:bit reset during a move — the game goes back to START");
      game.reset();
    }
  }
  lastHb = Date.now();
  resetting = false;
});

// ---------- the lure: a minute standing ready with nobody playing ----------
// The display blinks TRYKK JA ELLER NEI (kvitteringDisplay.js); every 30 s the light blinks white a
// few times and the bell rings twice (2026-10-21, after the user test). The machine stands still
// then, so a flash can't disturb a belt move; a press starts the game as usual.
const LOKK_HVER_MS = 30000;
let klarSiden = Date.now(), forrigeState = "", sisteLokk = 0;
every(1000, () => {
  const now = Date.now();
  if (game.state !== forrigeState) { forrigeState = game.state; klarSiden = now; }
  if (game.state !== "ready" || now - klarSiden < LOKK_ETTER_MS || now - sisteLokk < LOKK_HVER_MS) return;
  sisteLokk = now;
  controller.send("LED:FLASH:W:6");
  controller.send("BELL:2");
  ding(2);
});

// ---------- the IBM till display, through the helper in Termux (tools/termux-ibm/) ----------
// Android's Chrome has no WebHID; the helper owns the display and listens on 127.0.0.1:8765.
// Four times a second the game's two lines go there (the helper skips unchanged lines).
// Not running: a quiet retry every 5 s, so the game never waits for it.
const LCD = "http://127.0.0.1:8765";
let lcdUp = null, lcdNext = 0, lcdShown = "";
every(250, () => {
  const now = Date.now();
  if (lcdUp === false && now < lcdNext) return;
  const [top, bottom] = lcdLinjer(game, now, game.state === "ready" ? now - klarSiden : 0), key = top + "|" + bottom;
  if (lcdUp && key === lcdShown) return;
  fetch(`${LCD}/show?top=${encodeURIComponent(top)}&bottom=${encodeURIComponent(bottom)}`, { cache: "no-store" })
    .then(r => {
      if (!r.ok) throw new Error("helper answered " + r.status);
      lcdShown = key;
      if (lcdUp !== true) { lcdUp = true; pill("sLcd", "connected", true); log("IBM display: connected"); }
    })
    .catch(() => {
      lcdShown = "";
      lcdNext = Date.now() + 5000;
      if (lcdUp !== false) { lcdUp = false; pill("sLcd", "not running (start it in Termux)", false); log("IBM display: helper not running"); }
    });
});

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
  preloadSounds();                                        // the losing sound's file, decoded once
  after(300, showAgain);
});

// ---------- operator panel: the small ⚙ button top-left ----------
$("gear").onclick = () => { $("panel").hidden = false; };
$("close").onclick = () => { $("panel").hidden = true; after(100, showAgain); };

$("connectPrinter").onclick = () => printer.connect();
$("connectMicrobit").onclick = () => controller.connect();
$("tYes").onclick = () => game.answer(true);
$("tNo").onclick = () => game.answer(false);
// the belt by hand (the same commands as the belt setup page). The game doesn't know about
// these moves — after them, Reset game puts the belt and the game back on START together.
const toBoard = line => controller.send(line) || (log("No micro:bit connected"), false);
$("tStep").onclick = () => toBoard("BELT:STEP");
$("tDown").onclick = () => toBoard("BELT:BACK:1");
$("tHome").onclick = () => toBoard("BELT:HOME");
// the command that starts the IBM display's helper in Termux (after a phone restart)
$("copyLcdCmd").onclick = () => navigator.clipboard.writeText($("lcdCmd").textContent)
  .then(() => log("Copied — paste it in Termux (long-press → Paste)"), e => log("Couldn't copy: " + e.message));
// one-off: fetch the newest helper from the Mac's phone server (only works with the Mac there)
$("copyLcdUpdate").onclick = () => {
  const base = location.origin + "/tools/termux-ibm/";
  navigator.clipboard.writeText(`curl -sf ${base}start-display.sh -o ~/start-display.sh; curl -sf ${base}ibm_bridge.py -o ~/ibm_bridge.py; bash ~/start-display.sh`)
    .then(() => log("Copied — paste it in Termux (long-press → Paste)"), e => log("Couldn't copy: " + e.message));
};
$("tResetBoard").onclick = async () => {
  log("micro:bit: resetting it by hand");
  if (await controller.resetBoard()) log("Reset sent — its LEDs should flash and show M again in a few seconds");
};
$("tTighten").onclick = () => toBoard("TENSION") && log("Tightening the paper");
$("tCal").onclick = () => toBoard("CALIBRATE") && log("Auto-calibrating — the belt runs up, measures and finds START again");
// hold-to-run: HOLD:±1 every 250 ms while pressed (the board stops by itself 600 ms
// after the last one, so a lost connection can't leave it running), HOLD:0 on release
let holdTimer = null, holdDir = 0;
function holdEnd() {
  if (!holdDir) return;
  cancel(holdTimer);
  holdTimer = null;
  holdDir = 0;
  document.querySelectorAll("#panel .hold.on").forEach(b => b.classList.remove("on"));
  controller.send("HOLD:0");
}
for (const [id, dir] of [["holdUp", 1], ["holdDown", -1]]) {
  const btn = $(id);
  btn.addEventListener("pointerdown", e => {
    e.preventDefault();
    btn.setPointerCapture?.(e.pointerId);
    if (holdDir || !toBoard(`HOLD:${dir}`)) return;
    holdDir = dir;
    btn.classList.add("on");
    holdTimer = every(250, () => controller.send(`HOLD:${dir}`));
  });
  for (const ev of ["pointerup", "pointercancel", "lostpointercapture"]) btn.addEventListener(ev, holdEnd);
}
window.addEventListener("blur", holdEnd);
document.addEventListener("visibilitychange", () => { if (document.hidden) holdEnd(); });
$("stop").onclick = () => { holdEnd(); toBoard("STOP") && log("STOP sent"); };
$("tPrint").onclick = () => print("Test", () => tegning.linjer(["1. Ja -------------------- 0 år", "Barnetrygd               1900 kr", "", "TESTUTSKRIFT"]));
$("tBell").onclick = () => { ding(1); controller.send("BELL:1") || log("No micro:bit connected"); };
// the phone's own sounds, to check the speaker and its volume (they need a tap first anyway)
$("tLoseSound").onclick = () => { preloadSounds(); buzzer(); };
$("tDing").onclick = () => ding(3);
$("tWin").onclick = () => controller.send("LED:WIN") || log("No micro:bit connected");
// the game log, to the Mac's phone_server.py (getting text off the phone is awkward)
$("sendLog").onclick = () => fetch("results", { method: "POST", body: "GAME LOG\n" + lines.join("\n") })
  .then(r => log(r.ok ? "Log sent to the Mac." : "The Mac didn't take it."), () => log("Couldn't reach the Mac."));
$("tCut").onclick = () => printer.cut().catch(e => log(e.message));
$("tReset").onclick = () => { $("panel").hidden = true; game.reset(); };
// same tab, so this page lets go of the micro:bit and the belt page takes it; "← Game" comes back
$("beltPage").onclick = () => { location.href = "belt.html"; };

// the scroll: one screen per question — preview here, or print it (one long strip)
$("stripInfo").textContent = `${MANUS.sporsmal.length} questions → ${MANUS.sporsmal.length} screens · strip ≈ ${stripLengthCm(stripCfg()).toFixed(0)} cm`;
$("previewStrip").onclick = () => { $("stripImg").src = drawStrip(stripCfg()).toDataURL(); $("stripImg").hidden = false; };
$("printStrip").onclick = () => printer.print({ label: "Paper strip", build: () => drawStrip(stripCfg()), slow: false })
  .catch(e => log("Print failed: " + e.message));
$("answerFeed").value = settings.answerFeedMm;
$("answerFeed").onchange = () => { settings.answerFeedMm = Math.max(0, Math.min(60, Number($("answerFeed").value) || 0)); save(); };
$("ntfy").value = settings.ntfyTopic;
$("ntfy").onchange = () => { settings.ntfyTopic = $("ntfy").value.trim(); save(); };
$("ntfyTest").onclick = () => settings.ntfyTopic ? notify("Test fra maskinen") : log("Type a topic name first");

// keyboard, for testing on a computer: J = ja, N = nei
window.addEventListener("keydown", e => {
  if (e.target.closest?.("input, textarea")) return;
  const k = e.key.toLowerCase();
  if (k === "j") game.answer(true); else if (k === "n") game.answer(false);
});

// ---------- offline copy (sw.js) ----------
$("version").textContent = VERSION;
$("startVersion").textContent = VERSION;
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").then(
    () => log("Offline copy: on"),
    e => log("Offline copy failed: " + e.message));
}
