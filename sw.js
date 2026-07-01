// Service worker — offline play for the store builds (Play TWA / installed PWA).
// Cache-first with a VERSIONED cache: bump CACHE with every release (it rides the
// game VERSION per the standing rules) so an update invalidates the old shell in
// one activate. Core shell is precached; everything else same-origin (the big
// stat-gif clips, icons) is cached on first use so it never blocks first paint.
const CACHE = "ids-v12.2";
const CORE = ["./", "./index.html", "./style.css", "./js/game.js", "./icon.svg", "./manifest.webmanifest"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      if (res.ok && new URL(e.request.url).origin === location.origin) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(() => hit))
  );
});
