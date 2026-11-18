'use strict';

var CACHE_NAME = 'afrishine-hub-v2';
var META_CACHE = 'afrishine-meta';   // tiny cache that remembers who is signed in (used to skip your own video alerts)
var NOTIFY_ICON = '/icon-192.png';

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

  // Share previews and API routes are always served live by Vercel
  if (url.pathname.indexOf('/api/') === 0 || url.pathname.indexOf('/share/') === 0) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then(function (response) {
        if (response && response.ok && (url.pathname === '/' || url.pathname === '/index.html')) {
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

// ---------------------------------------------------------------------------
// Push notifications: a member published a new video
// ---------------------------------------------------------------------------

function readSignedInUid() {
  return caches.open(META_CACHE).then(function (cache) {
    return cache.match('/__uid');
  }).then(function (response) {
    return response ? response.text() : '';
  }).catch(function () { return ''; });
}

function handlePush(d) {
  return Promise.all([
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }),
    readSignedInUid()
  ]).then(function (result) {
    var windows = result[0], me = result[1];
    var visible = windows.filter(function (w) { return w.visibilityState === 'visible'; });
    var own = !!(me && d.authorUid && me === d.authorUid);

    // The app is open: no system notification is needed.
    if (visible.length) {
      if (!own) {
        visible.forEach(function (w) { w.postMessage({ type: 'af-push', data: d }); });
      }
      return;
    }

    var title = d.title || 'Afrishine Hub';
    return self.registration.showNotification(title, {
      body: d.body || 'There is something new on Afrishine Hub.',
      icon: d.icon || NOTIFY_ICON,
      badge: d.badge || NOTIFY_ICON,
      tag: d.tag || ('af-video-' + (d.postId || 'new')),
      data: { url: d.url || '/' }
    });
  });
}

self.addEventListener('push', function (event) {
  var payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch (e) { payload = {}; }
  var d = (payload && payload.data) ? payload.data : (payload || {});
  if (payload && payload.notification) {
    d = Object.assign({}, payload.notification, d);
  }
  event.waitUntil(handlePush(d));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var target = (event.notification.data && event.notification.data.url) || '/';
  var full = new URL(target, self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (windows) {
      for (var i = 0; i < windows.length; i++) {
        var w = windows[i];
        if (w.url.indexOf(self.location.origin) === 0 && 'focus' in w) {
          return w.focus().then(function (focused) {
            return (focused && 'navigate' in focused) ? focused.navigate(full) : self.clients.openWindow(full);
          }).catch(function () { return self.clients.openWindow(full); });
        }
      }
      return self.clients.openWindow(full);
    })
  );
});
