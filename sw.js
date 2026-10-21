// Keeps a copy of the phone version on the phone, so it opens with no Mac and
// no Wi-Fi at the festival (2026-10-14). Each file is asked from the Mac
// first; if it hasn't answered within WAIT_MS (or there's no network at all)
// the kept copy is used. A fresh answer also refreshes the copy — so one
// reload with the Mac on the hotspot is enough to get a new version. (The
// first version served the copy first and refreshed in the background, which
// needed two reloads per update and confused things on the phone.)
// A new file for the phone version = add it to FILES (and to phone_server.py's list).
const CACHE = "machine-phone-v43";
const WAIT_MS = 1500;
const FILES = [
  "./", "phone.html", "phone.js", "manifest.json", "icon.svg", "phonecheck.html", "belt.html", "belt.js",
  "core/clock.js", "core/clockWorker.js", "core/controller.js", "core/eventBus.js", "core/printer.js",
  "core/raster.js", "core/singleTab.js", "core/usbSerial.js",
  "game/game.js", "game/lang.js", "game/life.js", "game/cards.js", "game/receipt.js", "game/kvittering.js", "game/kvitteringMotor.js", "game/kvitteringTegning.js", "game/kvitteringDisplay.js",
  "bilder/03-labubu.png", "bilder/04-vaffeljern.png", "bilder/05-binokularlupe.png", "bilder/06-ekstremstol.png", "bilder/07-romaskin.png", "bilder/08-seilbat.png", "bilder/09-urne.png", "bilder/10-kvitteringsspillet.png", "game/manus.js", "game/questions.js", "game/sound.js",
  "belt/belt.js", "belt/strip.js",
  "tickets/index.js", "tickets/draw.js", "tickets/code128.js", "tickets/fortune.js", "tickets/plain.js",
  "tickets/prize.js", "tickets/reward.js", "tickets/scannerSetup.js",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;                      // results posts etc. go straight out
  if (new URL(req.url).origin !== location.origin) return; // e.g. the IBM display helper on 127.0.0.1: never cached
  e.respondWith(caches.open(CACHE).then(async cache => {
    const fresh = fetch(req, { cache: "no-store" }).then(res => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    });
    const late = new Promise(resolve => setTimeout(resolve, WAIT_MS, null));
    const first = await Promise.race([fresh.catch(() => null), late]);
    if (first && first.ok) return first;
    const kept = await cache.match(req, { ignoreSearch: true });
    if (kept) { fresh.catch(() => {}); return kept; }   // no Mac: the kept copy
    return fresh;                                        // nothing kept yet: wait for the network
  }));
});
