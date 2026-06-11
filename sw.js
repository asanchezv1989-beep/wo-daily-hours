// Service Worker — cachea la app para uso offline
const CACHE = "wo-daily-v13";
const ASSETS = [
  "./", "./index.html", "./manifest.webmanifest",
  "./css/styles.css",
  "./js/app.js", "./js/db.js", "./js/i18n.js", "./js/pdf.js",
  "./js/coords.js", "./js/tools.js", "./js/pdf-lib.min.js", "./js/catalog.js",
  "./assets/wo-template.pdf", "./assets/roster.csv",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/mark.png"
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
// Network-first: siempre intenta la versión más nueva; si no hay internet, usa caché.
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(e.request).then((c) => c || caches.match("./index.html")))
  );
});
