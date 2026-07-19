"use strict";

const CACHE_NAME = "scorecraft-v2-iphone-fix-redirect-v1";
const APP_FILES = [
  "./",
  "./index.html",
  "./round.html",
  "./history.html",
  "./analysis.html",
  "./myclubs.html",
  "./settings.html",
  "./course-management.html",
  "./manifest.webmanifest",
  "./css/style.css",
  "./js/app.js",
  "./js/config.js",
  "./js/storage.js",
  "./js/navigation.js",
  "./js/index.js",
  "./js/courseDatabase.js",
  "./js/round.js",
  "./js/history.js",
  "./js/analysis.js",
  "./js/clubs.js",
  "./js/settings.js",
  "./js/dataManagement.js",
  "./js/courseManagement.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
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
  event.respondWith(
    caches.match(event.request).then(cached => {
      const network = fetch(event.request)
        .then(response => {
          if (response && response.ok && response.type === "basic") {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached || caches.match("./index.html"));
      return cached || network;
    })
  );
});
