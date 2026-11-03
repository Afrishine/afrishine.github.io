
'use strict';

var CACHE_NAME = 'afrishine-hub-v1';

var APP_FILES = [
  './',
  './index.html'
];

// Install service worker and cache the main app
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(APP_FILES);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

// Activate and remove old Afrishine caches
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (cacheNames) {
      return Promise.all(
        cacheNames.map(function (cacheName) {
          if (
            cacheName.indexOf('afrishine-hub-') === 0 &&
            cacheName !== CACHE_NAME
          ) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

// Network first for pages, cache fallback when offline
self.addEventListener('fetch', function (event) {
  var request = event.request;

  if (request.method !== 'GET') {
    return;
  }

  var url = new URL(request.url);

  // Do not cache Firebase, Pi SDK, authentication or external APIs
  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then(function (response) {
        if (response && response.ok) {
          var copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put('./index.html', copy);
          });
        }
        return response;
      }).catch(function () {
        return caches.match('./index.html');
      })
    );
    return;
  }

  // Cache local static files when available
  event.respondWith(
    caches.match(request).then(function (cachedResponse) {
      var networkRequest = fetch(request).then(function (response) {
        if (response && response.ok) {
          var copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(request, copy);
          });
        }
        return response;
      });

      return cachedResponse || networkRequest;
    })
  );
});
