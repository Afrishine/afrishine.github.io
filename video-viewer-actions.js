/* Afrishine Hub: full-screen video viewer actions (v2, low-end Android friendly).
   Load LAST, after all other scripts:  <script src="/video-viewer-actions.js"></script>

   Adds to every video opened from "Videos For You":
   - right side: Like, Comment, Repost, Share, Save
   - bottom left: profile photo + name + verified badge + Follow (tap the name to open the profile)

   It never touches the <video> elements (no play, pause, load, src or listeners on videos).
   It only reads video sources to find the matching post. Plain ES5, no modern syntax. */
(function () {
  'use strict';
  try {
    var viewer = document.getElementById('videoViewer'), feed = document.getElementById('videoViewerFeed');
    if (!viewer || !feed || document.getElementById('vxStyles')) return;

    /* =====================================================================
       BASIC HELPERS
       ===================================================================== */
    var WORKER_MEDIA = /^https:\/\/afrishine-media\.usherluckyelie\.workers\.dev\/media\/.+/;
    function safe(fn) { return function () { try { return fn.apply(this, arguments); } catch (e) { try { console.warn('[video actions]', e); } catch (_) { } } }; }
    function say(m) { try { if (typeof notice === 'function') notice(m); } catch (_) { } }
    function validId(s) { return typeof s === 'string' && /^[A-Za-z0-9_-]{4,100}$/.test(s); }
    function validUid(s) { return typeof s === 'string' && /^[A-Za-z0-9_.:@-]{3,128}$/.test(s); }
    function validPhoto(u) { return typeof u === 'string' && u.length <= 2048 && /^https:\/\/[^\s"'<>]+$/i.test(u); }
    function niceName(raw) { raw = String(raw == null ? '' : raw).replace(/[\u0000-\u001f\u007f]/g, '').trim(); if (raw.indexOf('@') > 0) raw = raw.split('@')[0]; return raw.slice(0, 40); }
    function fmtN(n) { n = Number(n) || 0; if (n >= 1e6) return (n / 1e6).toFixed(1).replace('.0', '') + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(1).replace('.0', '') + 'K'; return String(n); }
    function setCls(el, c, on) { if (!el) return; if (on) el.classList.add(c); else el.classList.remove(c); }
    function mk(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
    function errText(e) {
      try {
        if (e && e.code === 'permission-denied') return 'You do not have permission to do this. Please sign in and try again.';
        return typeof firebaseErrorMessage === 'function' ? firebaseErrorMessage(e) : 'Something went wrong. Please try again.';
      } catch (_) { return 'Something went wrong. Please try again.'; }
    }

    /* =====================================================================
       FIREBASE (waits for it, never fails permanently)
       ===================================================================== */
    function dbx() { try { return (typeof db !== 'undefined' && db && window.firebase && firebase.firestore) ? db : null; } catch (e) { return null; } }
    function me() {
      try {
        if (typeof currentFirebaseUser !== 'undefined' && currentFirebaseUser) return currentFirebaseUser;
        if (typeof auth !== 'undefined' && auth && auth.currentUser) return auth.currentUser;
      } catch (e) { }
      return null;
    }
    var dbWait = null;
    function getDbSoon() {
      var d = dbx();
      if (d) return Promise.resolve(d);
      if (dbWait) return dbWait;
      dbWait = new Promise(function (resolve) {
        var n = 0;
        (function tick() {
          var d2 = dbx();
          if (d2) { dbWait = null; resolve(d2); return; }
          if (++n > 20) { dbWait = null; resolve(null); return; }
          setTimeout(tick, 600);
        })();
      });
      return dbWait;
    }
    function stamp() { return firebase.firestore.FieldValue.serverTimestamp(); }
    function notify(uid, type, title, body, page) { try { if (typeof window.afCreateNotification === 'function') window.afCreateNotification(uid, type, title, body, page); } catch (_) { } }

    var authReady = !!me(), authVer = 0;

    /* =====================================================================
       STYLES (no filters, no big shadows, no animations)
       ===================================================================== */
    var st = document.createElement('style');
    st.id = 'vxStyles';
    st.textContent = [
      '.vx-rail{position:absolute;z-index:4;right:8px;bottom:calc(150px + env(safe-area-inset-bottom));display:flex;flex-direction:column;align-items:center;gap:8px;pointer-events:none}',
      '.vx-btn{pointer-events:auto;display:flex;flex-direction:column;align-items:center;gap:2px;width:56px;padding:0;border:0;background:none;color:#fff;touch-action:manipulation;-webkit-tap-highlight-color:transparent}',
      '.vx-btn svg{box-sizing:content-box;width:26px;height:26px;padding:7px;border-radius:50%;background:rgba(0,0,0,.32);fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}',
      '.vx-btn span{font-size:12px;font-weight:700;line-height:14px;min-height:14px;text-shadow:0 1px 2px #000}',
      '.vx-btn.on.like{color:#ff3b5c}.vx-btn.on.save{color:#ffb91f}.vx-btn.on svg{fill:currentColor}',
      '.video-viewer-item.vx-has-author .video-viewer-caption>small{display:none}',
      '.vx-author{display:flex;align-items:center;gap:10px;margin:0 0 9px}',
      '.vx-who{display:flex;align-items:center;gap:10px;min-width:0;padding:0;border:0;background:none;color:#fff;text-align:left;touch-action:manipulation}',
      '.vx-av{position:relative;width:46px;height:46px;flex-shrink:0;border-radius:50%;overflow:hidden;display:grid;place-items:center;background:#3a2f9a;border:2px solid #ffb91f;color:#fff;font-size:18px;font-weight:800}',
      '.vx-av img{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover}',
      '.vx-nm{display:flex;align-items:center;min-width:0}',
      '.vx-name{display:block;max-width:34vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:16px;font-weight:800;text-shadow:0 1px 3px #000}',
      '.vx-vb{display:inline-block;width:15px;height:15px;margin-left:4px;vertical-align:-2px;line-height:0}.vx-vb svg{display:block;width:100%;height:100%}',
      '.vx-follow{flex-shrink:0;padding:7px 16px;border:1.5px solid #fff;border-radius:9px;background:rgba(0,0,0,.35);color:#fff;font-size:14px;font-weight:800;touch-action:manipulation}',
      '.vx-follow.on{border-color:rgba(255,255,255,.5);color:#e1e5ed;font-weight:700}',
      '.vx-back{position:absolute;z-index:5;left:0;right:0;top:0;bottom:0;background:transparent}',
      '.vx-sheet{position:absolute;z-index:6;left:0;right:0;bottom:0;max-width:560px;margin:0 auto;max-height:72vh;max-height:72dvh;display:flex;flex-direction:column;background:#141a27;border:1px solid #2f3a52;border-bottom:0;border-radius:20px 20px 0 0;color:#fff}',
      '.vx-sh-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid #263047}',
      '.vx-sh-head b{font-size:16px}',
      '.vx-x{width:36px;height:36px;border:0;border-radius:50%;background:#222b3d;color:#fff;font-size:16px}',
      '.vx-clist{flex:1;min-height:120px;overflow-y:auto;padding:6px 16px;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}',
      '.vx-c{padding:10px 0;border-bottom:1px solid #1f2738;font-size:14.5px;line-height:1.45;overflow-wrap:anywhere}',
      '.vx-c b{color:#ffd064;margin-right:4px}.vx-c small{display:block;margin-top:2px;color:#8d97ab;font-size:11.5px}',
      '.vx-c button{margin-left:10px;border:0;background:none;color:#ff9a9a;font-size:12px;font-weight:700}',
      '.vx-empty{padding:26px 6px;text-align:center;color:#aab4d4;font-size:14px;line-height:1.6}',
      '.vx-empty button{margin-top:10px;padding:9px 16px;border:0;border-radius:18px;background:#252d3e;color:#fff;font-weight:700}',
      '.vx-hint{min-height:16px;padding:0 16px;color:#ffcf54;font-size:12px}',
      '.vx-cform{display:flex;gap:8px;padding:10px 12px calc(12px + env(safe-area-inset-bottom));border-top:1px solid #263047}',
      '.vx-cform input{flex:1;min-width:0;height:46px;padding:0 14px;border:1px solid #394355;border-radius:23px;background:#0d121c;color:#fff;font-size:16px;outline:0}',
      '.vx-cform button{flex-shrink:0;min-width:70px;border:0;border-radius:23px;background:#f5a800;color:#171107;font-weight:850;font-size:15px}',
      '.vx-cform button[disabled]{opacity:.5}'
    ].join('\n');
    document.head.appendChild(st);

    /* =====================================================================
       ICONS (trusted static markup)
       ===================================================================== */
    var IC = {
      like: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.2l7.8-7.7 1-1.1a5.5 5.5 0 0 0 0-7.8z"/></svg>',
      comment: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z"/></svg>',
      repost: '<svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>',
      share: '<svg viewBox="0 0 24 24" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
      save: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>'
    };
    var LABEL = { like: 'Like', comment: 'Comments', repost: 'Repost', share: 'Share', save: 'Save' };
    var SEAL = (function () {
      var pts = [], i;
      for (i = 0; i < 96; i++) { var a = i * Math.PI * 2 / 96, r = 9.4 + 1.3 * Math.cos(8 * a); pts.push((12 + r * Math.cos(a)).toFixed(2) + ' ' + (12 + r * Math.sin(a)).toFixed(2)); }
      return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M' + pts.join(' L') + ' Z" fill="#1d9bf0"/><path d="M7.4 12.3l3.1 3.1 6-6.6" fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    })();
    var railTpl = null;
    function getRailTpl() {
      if (railTpl) return railTpl;
      railTpl = mk('div', 'vx-rail');
      var acts = ['like', 'comment', 'repost', 'share', 'save'], i;
      for (i = 0; i < acts.length; i++) {
        var b = mk('button', 'vx-btn ' + acts[i]);
        b.type = 'button';
        b.setAttribute('data-vx-act', acts[i]);
        b.setAttribute('aria-label', LABEL[acts[i]]);
        b.innerHTML = IC[acts[i]];
        b.appendChild(mk('span', null, acts[i] === 'share' ? 'Share' : acts[i] === 'save' ? 'Save' : '0'));
        railTpl.appendChild(b);
      }
      return railTpl;
    }

    /* =====================================================================
       VIDEO SOURCE -> POST MATCHING
       Reads currentSrc, src, the src attribute and <source> children.
       Matches on origin + decoded path (query and #hash ignored).
       ===================================================================== */
    var anchor = document.createElement('a');
    function keyOf(u) {
      if (!u || typeof u !== 'string') return '';
      anchor.href = u;
      var proto = anchor.protocol;
      if (proto !== 'https:' && proto !== 'http:') return '';
      var p = anchor.pathname || '';
      if (p.charAt(0) !== '/') p = '/' + p;
      try { p = decodeURIComponent(p); } catch (e) { }
      return proto + '//' + anchor.host + p;
    }
    var idx = null, idxSrc = null;
    function postIndex() {
      var list = window.__afLatestPosts;
      if (!list || !list.length) return {};
      if (idx && idxSrc === list) return idx;
      idx = {}; idxSrc = list;
      var i, p, k;
      for (i = 0; i < list.length; i++) {
        p = list[i];
        if (!p || String(p.type || '').toLowerCase() !== 'video' || !validId(p.id) || !validUid(p.uid)) continue;
        k = keyOf(p.videoUrl || p.mediaUrl || p.mediaURL || p.fileUrl || '');
        if (!k) continue;
        if (!idx[k] || (idx[k].isRepost === true && p.isRepost !== true)) idx[k] = p;
      }
      return idx;
    }
    function videoSources(vid) {
      var out = [], i, s;
      try { if (vid.currentSrc) out.push(vid.currentSrc); } catch (e) { }
      try { if (vid.src) out.push(vid.src); } catch (e) { }
      s = vid.getAttribute('src'); if (s) out.push(s);
      var kids = vid.getElementsByTagName('source');
      for (i = 0; i < kids.length; i++) { s = kids[i].getAttribute('src'); if (s) out.push(s); }
      return out;
    }
    function matchPost(vid) {
      var ix = postIndex(), srcs = videoSources(vid), i, k;
      for (i = 0; i < srcs.length; i++) { k = keyOf(srcs[i]); if (k && ix[k]) return ix[k]; }
      return null;
    }

    /* =====================================================================
       CACHES (small, in-flight requests are shared)
       ===================================================================== */
    var profiles = {}, profCount = 0, profPending = {};
    function getProfile(uid) {
      if (!validUid(uid)) return Promise.resolve({});
      var c = profiles[uid];
      if (c && Date.now() - c.t < 10 * 60 * 1000) return Promise.resolve(c.d);
      if (profPending[uid]) return profPending[uid];
      var p = getDbSoon().then(function (d) {
        if (!d) return {};
        return d.collection('publicProfiles').doc(uid).get().then(function (s) { return s.exists ? s.data() : {}; });
      }).then(function (v) {
        if (profCount > 80) { profiles = {}; profCount = 0; }
        profiles[uid] = { t: Date.now(), d: v || {} }; profCount++; delete profPending[uid]; return v || {};
      }, function () { delete profPending[uid]; return {}; });
      profPending[uid] = p;
      return p;
    }
    function profOf(uid) { return (profiles[uid] && profiles[uid].d) || {}; }

    function zero() { return 0; }
    function cnt(q, cap) {
      try { return q.count().get().then(function (s) { return s.data().count; }).catch(function () { return q.limit(cap).get().then(function (s) { return s.size; }); }); }
      catch (e) { return q.limit(cap).get().then(function (s) { return s.size; }); }
    }
    var cntCache = {}, cntPending = {}, cntSize = 0;
    function getCounts(d, id) {
      var c = cntCache[id];
      if (c && Date.now() - c.t < 60000) return Promise.resolve(c);
      if (cntPending[id]) return cntPending[id];
      var ref = d.collection('posts').doc(id);
      var p = Promise.all([
        cnt(ref.collection('likes'), 200).catch(zero),
        cnt(ref.collection('comments'), 200).catch(zero),
        cnt(d.collection('posts').where('originalPostId', '==', id), 100).catch(zero)
      ]).then(function (r) {
        if (cntSize > 150) { cntCache = {}; cntSize = 0; }
        var o = { likes: r[0], comments: r[1], reposts: r[2], t: Date.now() };
        cntCache[id] = o; cntSize++; delete cntPending[id]; return o;
      }, function () { delete cntPending[id]; return null; });
      cntPending[id] = p;
      return p;
    }
    function bump(id, key, delta) { if (cntCache[id]) cntCache[id][key] = Math.max(0, (cntCache[id][key] || 0) + delta); }

    var followState = {}, followPending = {};
    function getFollow(d, u, target) {
      if (!u || target === u.uid) return Promise.resolve(false);
      var c = followState[target];
      if (c && c.ver === authVer) return Promise.resolve(c.v);
      if (followPending[target]) return followPending[target];
      var ver = authVer;
      var p = d.collection('follows').doc(u.uid + '_' + target).get().then(function (s) {
        delete followPending[target];
        if (ver === authVer) followState[target] = { v: s.exists, ver: ver };
        return s.exists;
      }, function () { delete followPending[target]; return null; });
      followPending[target] = p;
      return p;
    }

    /* =====================================================================
       DECORATE / UNDECORATE one viewer item
       ===================================================================== */
    function allItems() { return feed.querySelectorAll('.video-viewer-item'); }
    function itemOf(node) {
      if (!node) return null;
      if (node.nodeType !== 1) node = node.parentNode;
      return (node && node.closest) ? node.closest('.video-viewer-item') : null;
    }
    function nameOf(x) { return niceName(profOf(x.post.uid).username) || niceName(x.post.authorName) || 'Afrishine Member'; }

    function decorate(item, post) {
      var x = { post: post, liked: false, saved: false, following: false, likes: 0, comments: 0, reposts: 0, busy: {}, touched: {}, els: {}, stDone: false, stP: null, stTry: 0, cDone: false, cP: null };
      item.__vx = x;
      item.setAttribute('data-vx', '1');
      var rail = getRailTpl().cloneNode(true), acts = ['like', 'comment', 'repost', 'share', 'save'], i, b;
      for (i = 0; i < acts.length; i++) { b = rail.querySelector('[data-vx-act="' + acts[i] + '"]'); x.els[acts[i]] = b; b.__s = b.querySelector('span'); }
      item.appendChild(rail);
      var cap = item.querySelector('.video-viewer-caption');
      if (cap) {
        var row = mk('div', 'vx-author');
        var who = mk('button', 'vx-who');
        who.type = 'button';
        who.setAttribute('data-vx-profile', post.uid);
        who.setAttribute('aria-label', 'Open profile');
        var av = mk('span', 'vx-av');
        av.appendChild(mk('span', null, (niceName(post.authorName).slice(0, 1) || 'A').toUpperCase()));
        var nm = mk('span', 'vx-nm'), name = mk('span', 'vx-name', niceName(post.authorName) || 'Afrishine Member'), badge = mk('span');
        nm.appendChild(name); nm.appendChild(badge);
        who.appendChild(av); who.appendChild(nm);
        var fol = mk('button', 'vx-follow', 'Follow');
        fol.type = 'button';
        fol.setAttribute('data-vx-follow', '1');
        fol.setAttribute('data-follow-author', post.uid);
        row.appendChild(who); row.appendChild(fol);
        cap.insertBefore(row, cap.firstChild);
        item.classList.add('vx-has-author');
        x.els.av = av; x.els.name = name; x.els.badge = badge; x.els.follow = fol;
      }
      paint(item);
      getProfile(post.uid).then(function () { if (item.__vx === x) fillAuthor(item); });
    }
    function undecorate(item) {
      var nodes = item.querySelectorAll('.vx-rail,.vx-author'), i;
      for (i = 0; i < nodes.length; i++) if (nodes[i].parentNode) nodes[i].parentNode.removeChild(nodes[i]);
      item.classList.remove('vx-has-author');
      item.removeAttribute('data-vx');
      item.__vx = null;
    }
    /* find the matching post; keep, replace or remove the buttons. Never touches the video. */
    function ensure(item) {
      var vid = item.querySelector('video'), post = vid ? matchPost(vid) : null, x = item.__vx;
      if (!post) { if (x) undecorate(item); return false; }
      if (x && x.post.id === post.id) return true;
      if (x) undecorate(item);
      decorate(item, post);
      return true;
    }
    function fillAuthor(item) {
      var x = item.__vx;
      if (!x || !x.els.name) return;
      var p = profOf(x.post.uid), name = nameOf(x), initial = (name.slice(0, 1) || 'A').toUpperCase();
      x.els.name.textContent = name;
      x.els.badge.innerHTML = p.verified === true ? '<span class="vx-vb" role="img" aria-label="Verified account">' + SEAL + '</span>' : '';
      var av = x.els.av;
      while (av.firstChild) av.removeChild(av.firstChild);
      av.appendChild(mk('span', null, initial));
      if (validPhoto(p.photoURL)) {
        var img = document.createElement('img');
        img.alt = '';
        try { img.referrerPolicy = 'no-referrer'; } catch (e) { }
        img.addEventListener('error', function () { if (img.parentNode) img.parentNode.removeChild(img); });
        img.src = p.photoURL;
        av.appendChild(img);
      }
    }
    function setBtn(b, on, n) {
      if (!b) return;
      setCls(b, 'on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      if (n != null && b.__s) b.__s.textContent = fmtN(n);
    }
    function paint(item) {
      var x = item.__vx;
      if (!x) return;
      var u = me(), own = !!(u && u.uid === x.post.uid);
      setBtn(x.els.like, x.liked, x.likes);
      setBtn(x.els.comment, false, x.comments);
      setBtn(x.els.repost, false, x.reposts);
      setBtn(x.els.save, x.saved, null);
      var f = x.els.follow;
      if (f) {
        f.style.display = own ? 'none' : '';
        f.textContent = x.following ? 'Following' : 'Follow';
        setCls(f, 'on', x.following);
      }
    }

    /* =====================================================================
       LOADING STATS (only for the video on screen)
       ===================================================================== */
    function loadCounts(item) {
      var x = item.__vx;
      if (!x || x.cDone || x.cP) return;
      x.cP = getDbSoon().then(function (d) {
        if (!d) return null;
        return getCounts(d, x.post.id);
      }).then(function (o) {
        x.cP = null;
        if (!o || item.__vx !== x) return;
        if (!x.touched.like) x.likes = o.likes;
        if (!x.touched.comment) x.comments = o.comments;
        if (!x.touched.repost) x.reposts = o.reposts;
        x.cDone = true;
        paint(item);
      }, function () { x.cP = null; });
    }
    function loadState(item) {
      var x = item.__vx;
      if (!x) return Promise.resolve();
      if (x.stDone) return Promise.resolve();
      if (x.stP) return x.stP;
      var u = me();
      if (!u) { x.stDone = true; return Promise.resolve(); }
      if (Date.now() - x.stTry < 8000 && x.stTry) return Promise.resolve();
      x.stTry = Date.now();
      var ver = authVer;
      x.stP = getDbSoon().then(function (d) {
        if (!d) return;
        var id = x.post.id, uid = u.uid;
        return Promise.all([
          d.collection('posts').doc(id).collection('likes').doc(uid).get().then(function (s) { return s.exists; }, function () { return null; }),
          d.collection('savedPosts').doc(uid + '_posts_' + id).get().then(function (s) { return s.exists; }, function () { return null; }),
          getFollow(d, u, x.post.uid)
        ]).then(function (r) {
          if (ver !== authVer || item.__vx !== x) return;
          if (r[0] !== null && !x.touched.like) x.liked = r[0];
          if (r[1] !== null && !x.touched.save) x.saved = r[1];
          if (r[2] !== null && !x.touched.follow) x.following = r[2];
          x.stDone = (r[0] !== null && r[1] !== null && r[2] !== null);
          paint(item);
        });
      }).then(function () { x.stP = null; }, function () { x.stP = null; });
      return x.stP;
    }
    function loadStats(item) {
      loadCounts(item);
      loadState(item);
    }

    /* =====================================================================
       OBSERVERS (one IntersectionObserver, one MutationObserver)
       ===================================================================== */
    var io = null, mo = null, queue = [], qTimer = null;
    function onIO(entries) {
      var i, en, it;
      for (i = 0; i < entries.length; i++) {
        en = entries[i]; it = en.target;
        if (!en.isIntersecting) { it.__vis = false; continue; }
        it.__vis = en.intersectionRatio >= 0.6;
        if (!it.__vx) ensure(it);
        if (it.__vis && it.__vx) loadStats(it);
      }
    }
    function getIO() {
      if (io) return io;
      if (!('IntersectionObserver' in window)) return null;
      try { io = new IntersectionObserver(safe(onIO), { root: feed, threshold: [0, 0.6] }); } catch (e) { io = null; }
      return io;
    }
    function addItem(item) {
      if (item.__vxo) return;
      item.__vxo = true;
      var o = getIO();
      if (o) o.observe(item); else ensure(item);
    }
    function schedule(item) {
      if (!item || item.__vxq) return;
      item.__vxq = true;
      queue.push(item);
      if (!qTimer) qTimer = setTimeout(flush, 60);
    }
    var flush = safe(function () {
      qTimer = null;
      var list = queue; queue = [];
      var i, it;
      for (i = 0; i < list.length; i++) {
        it = list[i]; it.__vxq = false;
        if (!feed.contains(it)) continue;
        if (it.__vx || it.__vis || !io) ensure(it);
        if (it.__vx && it.__vis) loadStats(it);
      }
      if (mo) mo.takeRecords();
    });
    function isOwnNode(n) {
      if (!n || n.nodeType !== 1) return false;
      var c = n.getAttribute && n.getAttribute('class');
      return !!c && /(^|\s)vx-/.test(c);
    }
    var onMut = safe(function (records) {
      var i, j, r, n, it, emptied = false;
      for (i = 0; i < records.length; i++) {
        r = records[i];
        if (r.type === 'attributes') { schedule(itemOf(r.target)); continue; }
        for (j = 0; j < r.addedNodes.length; j++) {
          n = r.addedNodes[j];
          if (n.nodeType !== 1 || isOwnNode(n)) continue;
          if (n.classList && n.classList.contains('video-viewer-item')) addItem(n);
          else { it = itemOf(n); if (it) schedule(it); }
        }
        if (r.removedNodes.length && r.target === feed) emptied = true;
      }
      if (emptied && !feed.firstElementChild) teardown();
    });
    function teardown() {
      closeSheet();
      if (io) { try { io.disconnect(); } catch (e) { } io = null; }
      if (qTimer) { clearTimeout(qTimer); qTimer = null; }
      queue = [];
      idx = null; idxSrc = null;
    }

    /* =====================================================================
       ACTIONS
       ===================================================================== */
    function needLogin(what) {
      try { if (typeof window.closeVideoViewer === 'function') window.closeVideoViewer(); } catch (_) { }
      say('Create an account or sign in to ' + what + '.');
      try { if (typeof window.showPage === 'function') window.showPage('profile'); } catch (_) { }
    }
    /* returns the signed-in user, or null (and explains why) */
    function requireUser(what) {
      var u = me();
      if (u) return u;
      if (!authReady) { say('Checking your account… please try again in a moment.'); return null; }
      needLogin(what);
      return null;
    }
    function toggleLike(item) {
      var x = item.__vx, u = requireUser('like videos');
      if (!x || !u || x.busy.like) return;
      x.busy.like = true;
      loadState(item).then(function () { return getDbSoon(); }).then(function (d) {
        if (!d) { say('Connecting… please try again in a moment.'); x.busy.like = false; return; }
        var was = x.liked, id = x.post.id, ref = d.collection('posts').doc(id).collection('likes').doc(u.uid);
        x.touched.like = true; x.liked = !was; x.likes = Math.max(0, x.likes + (was ? -1 : 1)); bump(id, 'likes', was ? -1 : 1); paint(item);
        return (was ? ref.delete() : ref.set({ uid: u.uid, createdAt: stamp() })).then(function () {
          if (!was && x.post.uid !== u.uid) notify(x.post.uid, 'post_like', 'New like', (u.displayName || 'A member') + ' liked your video.', 'talent');
        }, function (e) {
          x.liked = was; x.likes = Math.max(0, x.likes + (was ? 1 : -1)); bump(id, 'likes', was ? 1 : -1);
          x.stDone = false; x.stTry = 0; paint(item); say(errText(e));
        }).then(function () { x.busy.like = false; });
      }).then(null, function () { x.busy.like = false; });
    }
    function toggleSave(item) {
      var x = item.__vx, u = requireUser('save videos');
      if (!x || !u || x.busy.save) return;
      x.busy.save = true;
      loadState(item).then(function () { return getDbSoon(); }).then(function (d) {
        if (!d) { say('Connecting… please try again in a moment.'); x.busy.save = false; return; }
        var was = x.saved, ref = d.collection('savedPosts').doc(u.uid + '_posts_' + x.post.id);
        x.touched.save = true; x.saved = !was; paint(item);
        return (was ? ref.delete() : ref.set({ uid: u.uid, postId: x.post.id, kind: 'posts', createdAt: stamp() })).then(function () {
          say(was ? 'Removed from saved.' : 'Saved to your profile.');
        }, function (e) { x.saved = was; x.stDone = false; x.stTry = 0; paint(item); say(errText(e)); })
          .then(function () { x.busy.save = false; });
      }).then(null, function () { x.busy.save = false; });
    }
    function syncFollow(target, value) {
      followState[target] = { v: value, ver: authVer };
      var list = allItems(), i, it;
      for (i = 0; i < list.length; i++) { it = list[i]; if (it.__vx && it.__vx.post.uid === target) { it.__vx.following = value; paint(it); } }
    }
    function toggleFollow(item) {
      var x = item.__vx, u = requireUser('follow members');
      if (!x || !u) return;
      var target = x.post.uid;
      if (!validUid(target) || target === u.uid) return;
      if (x.busy.follow) return;
      x.busy.follow = true;
      loadState(item).then(function () { return getDbSoon(); }).then(function (d) {
        if (!d) { say('Connecting… please try again in a moment.'); x.busy.follow = false; return; }
        var was = x.following, ref = d.collection('follows').doc(u.uid + '_' + target);
        x.touched.follow = true; syncFollow(target, !was);
        return (was ? ref.delete() : ref.set({ followerUid: u.uid, followingUid: target, createdAt: stamp() })).then(function () {
          if (!was) notify(target, 'follow', 'New follower', (u.displayName || 'Someone') + ' started following you.', 'profile');
        }, function (e) { syncFollow(target, was); say(errText(e)); })
          .then(function () { x.busy.follow = false; });
      }).then(null, function () { x.busy.follow = false; });
    }

    /* SHARE: native share, then copy-link fallback */
    function shareLink(id) { return location.origin + location.pathname + '?post=' + encodeURIComponent(id) + '&kind=posts#home'; }
    function copyText(t) {
      return new Promise(function (resolve, reject) {
        function legacy() {
          try {
            var ta = document.createElement('textarea');
            ta.value = t; ta.setAttribute('readonly', '');
            ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
            document.body.appendChild(ta);
            ta.select();
            try { ta.setSelectionRange(0, t.length); } catch (_) { }
            var ok = document.execCommand && document.execCommand('copy');
            document.body.removeChild(ta);
            if (ok) resolve(); else reject(new Error('copy failed'));
          } catch (e) { reject(e); }
        }
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(resolve, legacy);
        else legacy();
      });
    }
    function copyFallback(url) {
      return copyText(url).then(function () { say('Video link copied.'); }, function () {
        try { window.prompt('Copy this link:', url); } catch (_) { say(url); }
      });
    }
    function logShare(x) {
      var u = me();
      if (!u || x.post.uid === u.uid) return;
      getDbSoon().then(function (d) {
        if (!d) return;
        d.collection('creatorEvents').doc(x.post.uid).collection('events').add({ actorUid: u.uid, type: 'share', createdAt: stamp(), postId: x.post.id }).then(null, function () { });
      });
    }
    function doShare(item) {
      var x = item.__vx;
      if (!x) return;
      var url = shareLink(x.post.id), text = String(x.post.text || x.post.title || 'A video on Afrishine Hub').slice(0, 120);
      logShare(x);
      if (navigator.share) {
        var p;
        try { p = navigator.share({ title: 'Afrishine Hub', text: text, url: url }); } catch (e) { copyFallback(url); return; }
        if (p && p.then) p.then(null, function (e) { if (e && e.name === 'AbortError') return; copyFallback(url); });
      } else copyFallback(url);
    }

    /* REPOST: a real video repost (same file, original author kept) using the existing posts structure.
       It has no mediaKey of its own, so deleting a repost can never delete the original file. */
    function doRepost(item) {
      var x = item.__vx, u = requireUser('repost videos');
      if (!x || !u || x.busy.repost) return;
      if (x.post.uid === u.uid) { say('This is your own video.'); return; }
      var mediaUrl = x.post.videoUrl || x.post.mediaUrl || x.post.mediaURL || x.post.fileUrl || '';
      if (!WORKER_MEDIA.test(String(mediaUrl))) { say('This video cannot be reposted.'); return; }
      var origId = validId(x.post.originalPostId) ? x.post.originalPostId : x.post.id;
      var origAuthor = String(x.post.originalAuthor || nameOf(x) || 'Afrishine Member').slice(0, 100);
      var okConfirm = true;
      try { okConfirm = confirm('Repost this video to your profile?'); } catch (_) { }
      if (!okConfirm) return;
      x.busy.repost = true;
      getDbSoon().then(function (d) {
        if (!d) { say('Connecting… please try again in a moment.'); return; }
        return d.collection('posts').where('uid', '==', u.uid).where('originalPostId', '==', origId).limit(1).get().then(function (snap) {
          if (!snap.empty) { say('You already reposted this video.'); return; }
          var doc = {
            uid: u.uid, authorName: String(u.displayName || 'Afrishine Member').slice(0, 100),
            text: String(x.post.text || '').slice(0, 2000),
            type: 'video', mediaType: 'video', mediaUrl: mediaUrl,
            source: x.post.source === 'talent' ? 'talent' : 'hub',
            isRepost: true, originalPostId: origId, originalAuthor: origAuthor,
            createdAt: stamp()
          };
          if (typeof x.post.title === 'string' && x.post.title && x.post.title.length <= 100) doc.title = x.post.title;
          if (typeof x.post.durationSeconds === 'number' && isFinite(x.post.durationSeconds) && x.post.durationSeconds >= 0) doc.durationSeconds = Math.round(x.post.durationSeconds);
          return d.collection('posts').add(doc).then(function () {
            x.touched.repost = true; x.reposts += 1; bump(x.post.id, 'reposts', 1); paint(item);
            say('Reposted to your profile and Home.');
          });
        });
      }).then(null, function (e) {
        if (e && e.code === 'permission-denied') say('Reposting videos is not enabled yet. The Firestore rules need the video-repost update.');
        else say(errText(e));
      }).then(function () { x.busy.repost = false; });
    }
    function openProfile(uid) {
      if (!validUid(uid)) return;
      try { if (typeof window.closeVideoViewer === 'function') window.closeVideoViewer(); } catch (_) { }
      setTimeout(function () { try { if (typeof window.openMemberProfile === 'function') window.openMemberProfile(uid); } catch (_) { } }, 30);
    }

    /* =====================================================================
       COMMENTS SHEET (does not touch playback; feed scroll is locked while it is open)
       ===================================================================== */
    var sheet = null, back = null, sheetItem = null, resizeFn = null, sending = false, prevOverflow = '';
    function closeSheet() {
      if (sheet && sheet.parentNode) sheet.parentNode.removeChild(sheet);
      if (back && back.parentNode) back.parentNode.removeChild(back);
      var had = !!sheetItem;
      sheet = null; back = null; sheetItem = null; sending = false;
      if (resizeFn) { window.removeEventListener('resize', resizeFn); resizeFn = null; }
      if (had) feed.style.overflowY = prevOverflow;
    }
    function commentNode(id, uid, name, text, when, mine) {
      var row = mk('div', 'vx-c');
      row.appendChild(mk('b', null, niceName(name) || 'Member'));
      row.appendChild(document.createTextNode(String(text || '')));
      var sm = mk('small', null, when || '');
      if (mine) {
        var del = mk('button', null, 'Delete');
        del.type = 'button';
        del.setAttribute('data-vx-del', id);
        sm.appendChild(del);
      }
      row.appendChild(sm);
      return row;
    }
    function loadComments(item, list) {
      var x = item.__vx, u = me();
      list.innerHTML = '';
      list.appendChild(mk('div', 'vx-empty', 'Loading…'));
      getDbSoon().then(function (d) {
        if (!d) throw new Error('offline');
        return d.collection('posts').doc(x.post.id).collection('comments').orderBy('createdAt', 'desc').limit(50).get();
      }).then(function (snap) {
        if (sheetItem !== item) return;
        list.innerHTML = '';
        if (snap.empty) { list.appendChild(mk('div', 'vx-empty', 'No comments yet. Be the first to comment.')); return; }
        var docs = snap.docs.slice().reverse(), i, c, when;
        for (i = 0; i < docs.length; i++) {
          c = docs[i].data();
          when = ''; try { when = c.createdAt && c.createdAt.toDate ? c.createdAt.toDate().toLocaleString() : ''; } catch (_) { }
          list.appendChild(commentNode(docs[i].id, c.uid, c.authorName, c.text, when, !!(u && c.uid === u.uid)));
        }
        list.scrollTop = list.scrollHeight;
      }).then(null, function (e) {
        if (sheetItem !== item) return;
        list.innerHTML = '';
        var box = mk('div', 'vx-empty', 'Comments could not be loaded. ' + (e && e.message === 'offline' ? 'Check your connection.' : errText(e)));
        var retry = mk('button', null, 'Try again');
        retry.type = 'button';
        retry.addEventListener('click', function () { loadComments(item, list); });
        box.appendChild(document.createElement('br'));
        box.appendChild(retry);
        list.appendChild(box);
      });
    }
    function openSheet(item) {
      if (!item.__vx) return;
      closeSheet();
      sheetItem = item;
      prevOverflow = feed.style.overflowY || '';
      feed.style.overflowY = 'hidden';
      resizeFn = function () { if (sheetItem && feed.contains(sheetItem)) feed.scrollTop = sheetItem.offsetTop; };
      window.addEventListener('resize', resizeFn);

      back = mk('div', 'vx-back');
      back.addEventListener('click', closeSheet);
      sheet = mk('div', 'vx-sheet');
      sheet.setAttribute('role', 'dialog');
      sheet.setAttribute('aria-label', 'Comments');
      var head = mk('div', 'vx-sh-head'), close = mk('button', 'vx-x', '\u2715');
      close.type = 'button';
      close.setAttribute('aria-label', 'Close comments');
      close.addEventListener('click', closeSheet);
      head.appendChild(mk('b', null, 'Comments'));
      head.appendChild(close);
      var list = mk('div', 'vx-clist'), hint = mk('div', 'vx-hint');
      sheet.appendChild(head); sheet.appendChild(list); sheet.appendChild(hint);

      var u = me(), form = mk('div', 'vx-cform');
      if (u) {
        var input = document.createElement('input');
        input.type = 'text'; input.maxLength = 500; input.placeholder = 'Add comment…'; input.autocomplete = 'off';
        var send = mk('button', null, 'Send');
        send.type = 'button';
        var submit = function () {
          if (sending) return;
          var text = String(input.value || '').replace(/\s+/g, ' ').trim().slice(0, 500), user = me(), x = item.__vx;
          if (!text || !user || !x) return;
          sending = true; send.disabled = true; send.textContent = '…'; input.value = '';
          var slow = setTimeout(function () { hint.textContent = 'Slow connection… still sending.'; }, 10000);
          getDbSoon().then(function (d) {
            if (!d) throw new Error('offline');
            return d.collection('posts').doc(x.post.id).collection('comments').add({ uid: user.uid, authorName: String(user.displayName || 'Afrishine Member').slice(0, 100), text: text, createdAt: stamp() });
          }).then(function (ref) {
            x.touched.comment = true; x.comments += 1; bump(x.post.id, 'comments', 1); paint(item);
            if (x.post.uid !== user.uid) notify(x.post.uid, 'post_comment', 'New comment', (user.displayName || 'A member') + ' commented on your video.', 'talent');
            if (sheetItem === item && list.parentNode) {
              if (list.firstChild && list.firstChild.className === 'vx-empty') list.innerHTML = '';
              list.appendChild(commentNode(ref.id, user.uid, user.displayName, text, 'Just now', true));
              list.scrollTop = list.scrollHeight;
            }
          }).then(null, function (e) {
            if (sheetItem === item && !input.value) input.value = text;
            say(e && e.message === 'offline' ? 'Connecting… please try again in a moment.' : errText(e));
          }).then(function () {
            clearTimeout(slow); sending = false;
            if (sheetItem === item) { send.disabled = false; send.textContent = 'Send'; hint.textContent = ''; }
          });
        };
        send.addEventListener('click', submit);
        input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
        form.appendChild(input); form.appendChild(send);
      } else {
        var login = mk('button', null, 'Sign in to comment');
        login.type = 'button';
        login.style.cssText = 'flex:1;min-height:46px';
        login.addEventListener('click', function () { if (authReady) needLogin('comment'); else say('Checking your account… please try again in a moment.'); });
        form.appendChild(login);
      }
      sheet.appendChild(form);
      sheet.addEventListener('click', function (e) {
        var del = e.target && e.target.closest ? e.target.closest('[data-vx-del]') : null;
        if (!del) return;
        var cid = del.getAttribute('data-vx-del'), x = item.__vx;
        if (!x || !validId(cid) || !me()) return;
        var okDel = true;
        try { okDel = confirm('Delete your comment?'); } catch (_) { }
        if (!okDel) return;
        getDbSoon().then(function (d) {
          if (!d) throw new Error('offline');
          return d.collection('posts').doc(x.post.id).collection('comments').doc(cid).delete();
        }).then(function () {
          x.touched.comment = true; x.comments = Math.max(0, x.comments - 1); bump(x.post.id, 'comments', -1); paint(item);
          var row = del.closest('.vx-c'); if (row && row.parentNode) row.parentNode.removeChild(row);
          if (!list.firstChild) list.appendChild(mk('div', 'vx-empty', 'No comments yet. Be the first to comment.'));
        }).then(null, function (er) { say(er && er.message === 'offline' ? 'Connecting… please try again in a moment.' : errText(er)); });
      });
      viewer.appendChild(back);
      viewer.appendChild(sheet);
      loadComments(item, list);
    }

    /* =====================================================================
       EVENTS
       ===================================================================== */
    feed.addEventListener('click', safe(function (e) {
      var b = e.target && e.target.closest ? e.target.closest('[data-vx-act],[data-vx-profile],[data-vx-follow]') : null;
      if (!b) return;
      var item = itemOf(b);
      if (!item || !item.__vx) return;
      e.stopPropagation();
      if (!io) loadStats(item);
      if (b.hasAttribute('data-vx-profile')) { openProfile(b.getAttribute('data-vx-profile')); return; }
      if (b.hasAttribute('data-vx-follow')) { toggleFollow(item); return; }
      var act = b.getAttribute('data-vx-act');
      if (act === 'like') toggleLike(item);
      else if (act === 'comment') openSheet(item);
      else if (act === 'repost') doRepost(item);
      else if (act === 'share') doShare(item);
      else if (act === 'save') toggleSave(item);
    }));

    /* sign in / sign out / account switch: reset per-user state, never crash */
    var onAuth = safe(function () {
      authReady = true; authVer++;
      followState = {}; followPending = {};
      if (sheetItem) closeSheet();
      var list = allItems(), i, it, x;
      for (i = 0; i < list.length; i++) {
        it = list[i]; x = it.__vx;
        if (!x) continue;
        x.liked = false; x.saved = false; x.following = false; x.touched = {}; x.stDone = false; x.stP = null; x.stTry = 0;
        paint(it);
        if (it.__vis) loadState(it);
      }
    });
    (function hookAuth(n) {
      try { if (typeof auth !== 'undefined' && auth && auth.onAuthStateChanged) { auth.onAuthStateChanged(onAuth); return; } } catch (e) { }
      if (n < 20) setTimeout(function () { hookAuth(n + 1); }, 500);
      else authReady = true;
    })(0);

    /* start watching the viewer */
    if ('MutationObserver' in window) {
      mo = new MutationObserver(onMut);
      mo.observe(feed, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
    }
    var existing = allItems(), k;
    for (k = 0; k < existing.length; k++) addItem(existing[k]);
  } catch (err) { try { console.warn('Video viewer actions not started:', err); } catch (_) { } }
})();
