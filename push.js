/* Afrishine Hub: video notifications (Firebase Cloud Messaging).
   Load AFTER upload-rules.js:  <script src="push.js"></script>  */
(function () {
  'use strict';
  try {
    /* Paste your Web Push key pair (public key) here: Firebase Console > Project settings >
       Cloud Messaging > Web Push certificates > Generate key pair. */
    var VAPID_KEY = 'PASTE_YOUR_VAPID_PUBLIC_KEY_HERE';
    var WORKER = 'https://afrishine-media.usherluckyelie.workers.dev';
    var SDK = 'https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js';
    var FLAG = 'af_push_on', TOKEN = 'af_push_token', UIDK = 'af_push_uid';

    function user() { return (typeof currentFirebaseUser !== 'undefined') ? currentFirebaseUser : null; }
    function say(t) { if (typeof notice === 'function') notice(t); }
    function store(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (_) { } }
    function read(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
    function supported() { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }

    function loadSdk() {
      if (window.firebase && firebase.messaging) return Promise.resolve();
      return new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = SDK; s.onload = resolve; s.onerror = function () { reject(new Error('Could not load notifications.')); };
        document.head.appendChild(s);
      });
    }
    function call(path, body) {
      var u = user(); if (!u) return Promise.reject(new Error('Please sign in first.'));
      return u.getIdToken().then(function (t) {
        return fetch(WORKER + path, { method: 'POST', headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok || !d.success) throw new Error(d.error || 'Request failed.'); return d; });
      });
    }

    /* Remember who is signed in, so your own video does not alert you. */
    function rememberUid() {
      var u = user();
      if (!window.caches) return;
      caches.open('afrishine-meta').then(function (c) {
        return u ? c.put('/__uid', new Response(u.uid)) : c.delete('/__uid');
      }).catch(function () { });
    }

    function getToken() {
      return loadSdk().then(function () {
        if (!firebase.messaging.isSupported()) throw new Error('This browser cannot receive notifications.');
        return navigator.serviceWorker.ready;
      }).then(function (reg) {
        return firebase.messaging().getToken({ vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
      });
    }

    function enable() {
      if (VAPID_KEY.indexOf('PASTE') === 0) { say('Notifications are not set up yet.'); return Promise.resolve(false); }
      if (!supported()) { say('This browser cannot receive notifications. On iPhone, add the app to your Home Screen first.'); return Promise.resolve(false); }
      if (!user()) { say('Please sign in first to turn on notifications.'); if (typeof showPage === 'function') showPage('profile'); return Promise.resolve(false); }
      return Notification.requestPermission().then(function (p) {
        if (p !== 'granted') { say('Notifications are blocked. Allow them in your browser settings to continue.'); return false; }
        return getToken().then(function (token) {
          if (!token) throw new Error('No notification token.');
          return call('/push/subscribe', { token: token }).then(function () { store(FLAG, '1'); store(TOKEN, token); store(UIDK, user().uid); say('Notifications are on.'); return true; });
        });
      }).catch(function (e) { console.warn('Notifications:', e); say(e.message || 'Could not turn on notifications.'); return false; });
    }

    function disable() {
      var token = read(TOKEN);
      store(FLAG, null); store(TOKEN, null); store(UIDK, null);
      var done = token && user() ? call('/push/unsubscribe', { token: token }).catch(function () { }) : Promise.resolve();
      return done.then(function () {
        return loadSdk().then(function () { return firebase.messaging().deleteToken(); }).catch(function () { });
      }).then(function () { say('Notifications are off.'); return true; });
    }

    /* If notifications are on, keep this phone subscribed (tokens can change). */
    function resync() {
      rememberUid();
      if (read(FLAG) !== '1' || !user() || !supported() || Notification.permission !== 'granted') return;
      getToken().then(function (token) {
        if (token && (token !== read(TOKEN) || user().uid !== read(UIDK))) return call('/push/subscribe', { token: token }).then(function () { store(TOKEN, token); store(UIDK, user().uid); });
      }).catch(function () { });
    }

    /* The "turn on" switch, placed in Inbox > Notifications. */
    function paint() {
      var panel = document.getElementById('afNotificationsPanel');
      if (!panel) return;
      var box = document.getElementById('afPushBox');
      if (!box) {
        box = document.createElement('div');
        box.id = 'afPushBox';
        box.style.cssText = 'margin:8px 0 14px;padding:12px;border:1px solid #394355;border-radius:14px;background:#151b27';
        var h = panel.querySelector('h2');
        if (h && h.nextSibling) panel.insertBefore(box, h.nextSibling); else panel.appendChild(box);
      }
      var on = read(FLAG) === '1' && supported() && Notification.permission === 'granted';
      box.innerHTML = '<b>🔔 Notifications</b><p class="creator-hint" style="margin:6px 0 10px">' +
        (on ? 'You will be told about new videos, messages, followers, comments and likes, even when the app is closed.' : 'Get a notification on your phone about new videos, messages, followers, comments and likes, even when the app is closed.') +
        '</p><button type="button" class="' + (on ? 'secondary' : 'gold') + '" id="afPushBtn">' + (on ? 'Turn off notifications' : 'Turn on notifications') + '</button>';
      document.getElementById('afPushBtn').onclick = function () {
        var btn = this; btn.disabled = true;
        (on ? disable() : enable()).then(paint, paint);
      };
    }

    /* Tell the Worker when something happens that another member should hear about.
       The Worker re-checks everything itself, so nothing here can be faked. */
    function send(path, body) { call(path, body).catch(function () { }); }
    function announce(id) { send('/push/notify', { postId: id }); }
    if (window.firebase && firebase.firestore) {
      var CR = firebase.firestore.CollectionReference && firebase.firestore.CollectionReference.prototype;
      var DR = firebase.firestore.DocumentReference && firebase.firestore.DocumentReference.prototype;
      if (CR) {
        var origAdd = CR.add;
        CR.add = function (data) {
          var p = origAdd.apply(this, arguments), path = String(this.path || ''), m;
          try {
            if (path === 'posts' && data && (data.type === 'video' || data.type === 'link') && data.visibility !== 'private') {
              p.then(function (ref) { if (ref && ref.id) announce(ref.id); }, function () { });
            } else if ((m = /^(posts|love_posts|marketplacePosts)\/([^/]+)\/comments$/.exec(path))) {
              p.then(function (ref) { if (ref && ref.id) send('/push/event', { type: 'comment', kind: m[1], postId: m[2], commentId: ref.id }); }, function () { });
            } else if ((m = /^conversations\/([^/]+)\/messages$/.exec(path))) {
              p.then(function (ref) { if (ref && ref.id) send('/push/event', { type: 'message', conversationId: m[1], messageId: ref.id }); }, function () { });
            }
          } catch (_) { }
          return p;
        };
      }
      if (DR) {
        var origSet = DR.set;
        DR.set = function () {
          var p = origSet.apply(this, arguments), path = String(this.path || ''), m;
          try {
            if ((m = /^follows\/([^/]+)$/.exec(path))) {
              p.then(function () { send('/push/event', { type: 'follow', followId: m[1] }); }, function () { });
            } else if ((m = /^(posts|love_posts)\/([^/]+)\/likes\/[^/]+$/.exec(path))) {
              p.then(function () { send('/push/event', { type: 'like', kind: m[1], postId: m[2] }); }, function () { });
            }
          } catch (_) { }
          return p;
        };
      }
    }

    /* Signing out: this phone stops receiving THIS member's personal alerts. */
    if (typeof auth !== 'undefined' && auth && typeof auth.signOut === 'function') {
      var origSignOut = auth.signOut;
      auth.signOut = function () {
        var args = arguments, ctx = this, token = read(TOKEN);
        var release = token && user() ? call('/push/release', { token: token }).catch(function () { }) : Promise.resolve();
        return release.then(function () { store(UIDK, null); return origSignOut.apply(ctx, args); });
      };
    }

    /* App open: show a small in-app message instead of a system notification. */
    if (navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener('message', function (e) {
        var m = e.data;
        if (m && m.type === 'af-push' && m.data) say((m.data.title || 'Afrishine Hub') + ': ' + (m.data.body || ''));
      });
    }

    if (typeof auth !== 'undefined' && auth && auth.onAuthStateChanged) auth.onAuthStateChanged(function () { resync(); paint(); });
    paint();
    window.addEventListener('load', function () { setTimeout(paint, 1200); });
    document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('[data-page="inbox"]')) setTimeout(paint, 150); });
  } catch (err) { console.warn('Afrishine notifications not started:', err); }
})();
