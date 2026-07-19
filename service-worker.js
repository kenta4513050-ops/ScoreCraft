"use strict";

const CACHE_NAME = "scorecraft-v1-1-csv-import";
const APP_FILES = [
  "./", "./index.html", "./round.html", "./history.html", "./analysis.html",
  "./myclubs.html", "./settings.html", "./course-management.html", "./import-rounds.html",
  "./manifest.webmanifest", "./css/style.css", "./js/app.js", "./js/config.js",
  "./js/storage.js", "./js/navigation.js", "./js/index.js", "./js/courseDatabase.js",
  "./js/round.js", "./js/history.js", "./js/analysis.js", "./js/clubs.js",
  "./js/settings.js", "./js/dataManagement.js", "./js/courseManagement.js", "./js/csvImport.js",
  "./icons/icon-192.png", "./icons/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  const isAppAsset = url.origin === self.location.origin;
  if (!isAppAsset) return;

  // HTML/JS/CSSは最新版を優先し、オフライン時のみキャッシュを使う。
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then(cached => cached || caches.match("./index.html")))
  );
});
