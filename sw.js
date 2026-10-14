// Keeps a copy of the phone version on the phone, so it opens with no Mac and
// no Wi-Fi at the festival (2026-10-14). Every file comes from this copy at
// once; when the Mac happens to be reachable, a fresh copy is fetched in the
// background and used from the next start — so after a change, open the page
// once with the Mac around, then once more.
// A new file for the phone version = add it to FILES (and to phone_server.py's list).
const CACHE = "machine-phone-v2";
const FILES = [
  "./", "phone.html", "phone.js", "manifest.json", "icon.svg", "phonecheck.html", "belt.html", "belt.js",
  "core/clock.js", "core/clockWorker.js", "core/controller.js", "core/eventBus.js", "core/printer.js",
  "core/raster.js", "core/singleTab.js", "core/usbSerial.js",
  "game/game.js", "game/questions.js", "game/sound.js",
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
  e.respondWith(caches.open(CACHE).then(async cache => {
    const kept = await cache.match(req, { ignoreSearch: true });
    const fresh = fetch(req, { cache: "no-store" }).then(res => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    });
    if (kept) { fresh.catch(() => {}); return kept; }   // no Mac: the kept copy, quietly
    return fresh;
  }));
});
