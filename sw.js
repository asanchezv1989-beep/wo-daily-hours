// Service Worker — cachea la app para uso offline
const CACHE = "wo-daily-v4";
const ASSETS = [
  "./", "./index.html", "./manifest.webmanifest",
  "./css/styles.css",
  "./js/app.js", "./js/db.js", "./js/i18n.js", "./js/pdf.js",
  "./js/coords.js", "./js/tools.js", "./js/pdf-lib.min.js",
  "./assets/wo-template.pdf",
  "./icons/icon-192.png", "./icons/icon-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // deja pasar CDN de fuentes
  e.respondWith(
    caches.match(e.request).then((cached) =>
      cached || fetch(e.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      }).catch(() => cached)
    )
  );
});
