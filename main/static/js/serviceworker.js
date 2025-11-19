// serviceworker.js

const CACHE_NAME = "django-pwa-081125";
const FILES_TO_CACHE = [
  "/offline",
  "/",
  "/public/logo.png",
  "/assets/index-081125.js",
  "/assets/index-081125.css",
  "/public/sql-wasm.js",
  "/public/sql-wasm.wasm",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // skip api/admin
  if (url.pathname.startsWith("/api") || url.pathname.startsWith("/admin")) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request)
        .then((networkResponse) => {
          // clone dulu sebelum dipakai
          const responseClone = networkResponse.clone();

          if (
            networkResponse &&
            networkResponse.status === 200 &&
            networkResponse.type === "basic"
          ) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }

          return networkResponse;
        })
        .catch(() => {
          if (request.mode === "navigate") {
            return caches.match("/") || caches.match("/offline");
          }
          return caches.match("/offline");
        });
    })
  );
});
