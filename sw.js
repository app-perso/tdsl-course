// Service worker : garde une copie de l'appli sur le téléphone
// pour qu'elle marche sans réseau.
// "__VERSION__" est remplacé automatiquement à chaque déploiement.
const VERSION = "__VERSION__";
const CACHE = "tdsl-course-" + VERSION;

const FICHIERS = [
  "./",
  "index.html",
  "style.css",
  "app.js",
  "course.js",
  "manifest.webmanifest",
  "fonts/archivo-latin.woff2",
  "icons/icon-180.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "vendor/xlsx.mini.min.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(FICHIERS.map((f) => new Request(f, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((noms) => Promise.all(noms.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

// Toujours la copie locale d'abord (instantané, marche hors ligne).
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((enCache) => {
      if (enCache) return enCache;
      return fetch(req).catch(() =>
        req.mode === "navigate" ? caches.match("index.html") : Response.error()
      );
    })
  );
});
