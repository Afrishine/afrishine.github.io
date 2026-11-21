/* AFRISHINE HUB - Social stats (Following / Followers / Suggested + Likes)
   Uses the existing Firebase `db`. Touches nothing else. Android 8+ safe (no ?. / ??).
   Load AFTER the main app scripts. REMOVE the old profile-social-stats file. */
(function (w, d) {
  'use strict';
  if (w.AHSocial) return;

  // ===== SETTINGS (edit here only) =====
  var CFG = {
    likeCollections: ['posts'],
    ownerField: 'uid',            // field holding the owner's uid in those collections
    max: 100,                     // members shown per tab
    onOpenProfile: function (uid) { close(); if (typeof w.openMemberProfile === 'function') w.openMemberProfile(uid); }
  };

  var S = { uid: null, tab: 'following', v: 0, lists: {}, mine: { fers: {}, fing: {} }, pc: {}, hidden: {} };
  var page = null, prevOv = '';

  function $(id) { return d.getElementById(id); }
  function getDB() { try { if (typeof db !== 'undefined' && db) return db; } catch (e) {} return null; }
  function getUser() {
    try {
      if (typeof currentFirebaseUser !== 'undefined' && currentFirebaseUser) return currentFirebaseUser;
      if (typeof currentUser === 'function') return currentUser();
    } catch (e) {}
    return null;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function uniq(a) { return a.filter(function (x, i) { return x && a.indexOf(x) === i; }); }
  function setOf(a) { var o = {}; a.forEach(function (x) { o[x] = 1; }); return o; }
  function fmt(n) { return n >= 1e6 ? (n / 1e6).toFixed(1).replace('.0', '') + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1).replace('.0', '') + 'K' : String(n); }
  function stamp() { try { return firebase.firestore.FieldValue.serverTimestamp(); } catch (e) { return new Date(); } }

  // ===== DATA =====
  // field 'followingUid' -> who follows uid ; field 'followerUid' -> who uid follows
  function rel(field, uid) {
    var other = field === 'followerUid' ? 'followingUid' : 'followerUid';
    return getDB().collection('follows').where(field, '==', uid).get().then(function (s) {
      return uniq(s.docs.map(function (x) { return x.data()[other]; }));
    });
  }
  function toPC(x) { x = x || {}; return { name: x.name || x.username || 'Afrishine Member', user: x.username || '', photo: x.photoURL || '', ver: x.verified === true }; }
  var BADGE = '<svg class="ahs-vb" viewBox="0 0 24 24" aria-label="Verified"><path fill="currentColor" d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m9 12 2 2 4-4" fill="none" stroke="#1a1300" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function profiles(ids) {
    var need = ids.filter(function (id) { return !S.pc[id]; }), p = Promise.resolve();
    for (var i = 0; i < need.length; i += 10) (function (chunk) {
      p = p.then(function () {
        return Promise.all(chunk.map(function (id) {
          return getDB().collection('publicProfiles').doc(id).get()
            .then(function (s) { S.pc[id] = toPC(s.exists ? s.data() : {}); })
            .catch(function () { S.pc[id] = toPC({}); });
        }));
      });
    })(need.slice(i, i + 10));
    return p;
  }

  // Likes received on ALL the member's posts / videos / photos
  function countLikes(uid) {
    var total = 0, p = Promise.resolve();
    CFG.likeCollections.forEach(function (col) {
      p = p.then(function () {
        return getDB().collection(col).where(CFG.ownerField, '==', uid).get().then(function (s) {
          var docs = s.docs, q = Promise.resolve();
          for (var i = 0; i < docs.length; i += 8) (function (b) {
            q = q.then(function () {
              return Promise.all(b.map(function (doc) {
                var x = doc.data();
                if (typeof x.likesCount === 'number') return x.likesCount;
                return doc.ref.collection('likes').get().then(function (l) { return l.size; });
              })).then(function (a) { a.forEach(function (n) { total += n; }); });
            });
          })(docs.slice(i, i + 8));
          return q;
        });
      }).catch(function () {});
    });
    return p.then(function () { return total; });
  }

  // ===== PROFILE NUMBERS (own profile + any element with data-ah-social + data-ah-uid) =====
  function setup(me) {
    var st = d.querySelector('#ahProfileDashboard .ah-profile-stats');
    if (!st) return;
    var l = $('ahLikesStat');
    if (!l) { l = d.createElement('span'); l.id = 'ahLikesStat'; l.innerHTML = '0<small>likes</small>'; st.appendChild(l); }
    [[$('ahFollowerStat'), 'followers'], [$('ahFollowingStat'), 'following'], [l, 'likes']].forEach(function (x) {
      if (x[0]) { x[0].setAttribute('data-ah-social', x[1]); x[0].setAttribute('data-ah-uid', me.uid); }
    });
  }

  function refresh() {
    var me = getUser();
    if (!me || !getDB()) return Promise.resolve();
    setup(me);
    var els = d.querySelectorAll('[data-ah-social][data-ah-uid]');
    return Promise.all(Array.prototype.map.call(els, function (el) {
      var t = el.getAttribute('data-ah-social'), uid = el.getAttribute('data-ah-uid');
      var job = t === 'followers' ? rel('followingUid', uid).then(function (a) { return a.length; })
        : t === 'following' ? rel('followerUid', uid).then(function (a) { return a.length; })
        : countLikes(uid);
      return job.then(function (n) { var b = el.querySelector('b'); if (b) b.textContent = fmt(n); else el.innerHTML = fmt(n) + '<small>' + t + '</small>'; }).catch(function () {});
    }));
  }

  // ===== FOLLOW / UNFOLLOW =====
  function st(id) { var f = S.mine.fing[id], r = S.mine.fers[id]; return f ? [r ? 'Friends' : 'Following', 'grey'] : [r ? 'Follow back' : 'Follow', 'gold']; }

  function toggle(uid, el) {
    var me = getUser();
    if (!me || el.disabled || uid === me.uid) return;
    var was = !!S.mine.fing[uid], ref = getDB().collection('follows');
    el.disabled = true;
    var job = was
      ? ref.where('followerUid', '==', me.uid).where('followingUid', '==', uid).get().then(function (s) {
          return Promise.all(s.docs.map(function (x) { return x.ref.delete(); }));
        })
      : ref.doc(me.uid + '_' + uid).set({ followerUid: me.uid, followingUid: uid, createdAt: stamp() });
    job.then(function () {
      if (was) delete S.mine.fing[uid]; else {
        S.mine.fing[uid] = 1;
        try { if (typeof w.afCreateNotification === 'function') w.afCreateNotification(uid, 'follow', 'New follower', (me.displayName || 'Someone') + ' started following you.', 'profile'); } catch (e) {}
      }
      if (S.uid === me.uid) {
        var a = S.lists.following, i = a.indexOf(uid);
        if (was) { if (i > -1) a.splice(i, 1); } else if (i < 0) a.unshift(uid);
        tabs();
      }
      var s = st(uid); el.textContent = s[0]; el.className = 'ahs-btn ' + s[1];
      refresh();
    }).catch(function () {}).then(function () { el.disabled = false; });
  }

  // ===== SUGGESTED (own profile): people who follow you first, then other members =====
  function suggest(meUid, target) {
    var ok = function (id) { return id !== meUid && id !== target && !S.mine.fing[id]; };
    var rel1 = (target === meUid ? [] : uniq((S.lists.followers || []).concat(S.lists.following || []))).filter(ok);
    var first = uniq(rel1.concat(Object.keys(S.mine.fers).filter(ok)));
    return getDB().collection('publicProfiles').limit(40).get().then(function (s) {
      var more = [];
      s.docs.forEach(function (doc) {
        S.pc[doc.id] = toPC(doc.data());
        if (ok(doc.id) && first.indexOf(doc.id) < 0) more.push(doc.id);
      });
      return first.concat(more);
    }).catch(function () { return first; });
  }

  // ===== PAGE =====
  var CSS = [
    '[data-ah-social="followers"],[data-ah-social="following"]{cursor:pointer;-webkit-tap-highlight-color:transparent}',
    '#ahsPage{display:none;position:fixed;top:0;left:0;right:0;bottom:0;z-index:15000;background:#0b0f19;color:#fff;flex-direction:column}',
    '#ahsPage.open{display:flex}',
    '.ahs-top{display:flex;align-items:center;padding:8px;padding-top:calc(8px + env(safe-area-inset-top,0px))}',
    '#ahsBack{width:44px;height:44px;border:0;background:none;color:#fff;font-size:26px;cursor:pointer}',
    '#ahsTitle{flex:1;margin-right:44px;text-align:center;font-weight:700;font-size:17px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '#ahsTabs{display:flex;border-bottom:1px solid #273044}',
    '#ahsTabs button{flex:1;padding:14px 4px;border:0;border-bottom:2px solid transparent;background:none;color:#8d97ad;font-weight:600;font-size:14px;cursor:pointer}',
    '#ahsTabs button.on{color:#fff;border-bottom-color:var(--gold,#ffb91f)}',
    '#ahsList{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch}',
    '.ahs-row{display:flex;align-items:center;padding:12px 16px}',
    '.ahs-av{position:relative;width:52px;height:52px;margin-right:12px;border-radius:50%;overflow:hidden;background:#303747;color:#ffbf36;font-weight:800;font-size:20px;display:flex;align-items:center;justify-content:center;flex-shrink:0}',
    '.ahs-av img{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover}',
    '.ahs-info{flex:1;min-width:0}',
    '.ahs-info b{display:flex;align-items:center;font-size:15px}',
    '.ahs-nm{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.ahs-info b .ahs-vb{flex-shrink:0;margin-top:0;vertical-align:baseline}',
    '.ahs-info > span{display:block;margin-top:2px;color:#8d97ad;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.ahs-btn{min-width:96px;margin-left:10px;padding:9px 14px;border:0;border-radius:10px;font-weight:700;font-size:14px;cursor:pointer}',
    '.ahs-btn.gold{background:var(--gold,#ffb91f);color:#1a1300}',
    '.ahs-btn.grey{background:#262e3f;color:#fff}',
    '.ahs-btn:disabled{opacity:.6}',
    '.ahs-x{width:34px;height:34px;margin-left:4px;border:0;background:none;color:#8d97ad;font-size:24px;cursor:pointer}',
    '.ahs-vb{display:inline-block;width:16px;height:16px;margin-left:5px;vertical-align:-3px;color:var(--gold,#ffb91f)}',
    '.ahs-msg{padding:40px 16px;text-align:center;color:#8d97ad;font-size:14px}'
  ].join('');

  function build() {
    if (page) return;
    var s = d.createElement('style'); s.textContent = CSS; d.head.appendChild(s);
    page = d.createElement('div'); page.id = 'ahsPage';
    page.innerHTML = '<div class="ahs-top"><button type="button" id="ahsBack" aria-label="Back">&#8592;</button><div id="ahsTitle"></div></div><div id="ahsTabs"></div><div id="ahsList"></div>';
    d.body.appendChild(page);
    $('ahsBack').addEventListener('click', close);
    $('ahsTabs').addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (b) { S.tab = b.getAttribute('data-t'); tabs(); list(); }
    });
    $('ahsList').addEventListener('click', function (e) {
      var el = e.target.closest('[data-act]');
      if (!el) return;
      var act = el.getAttribute('data-act'), uid = el.getAttribute('data-uid');
      if (act === 'follow') toggle(uid, el);
      else if (act === 'hide') { S.hidden[uid] = 1; var r = el.closest('.ahs-row'); r.parentNode.removeChild(r); }
      else if (act === 'open' && typeof CFG.onOpenProfile === 'function') CFG.onOpenProfile(uid);
    });
    $('ahsList').addEventListener('error', function (e) { if (e.target.tagName === 'IMG') e.target.style.display = 'none'; }, true);
  }

  function tabs() {
    var me = getUser(), own = me && S.uid === me.uid, t = [['following', 'Following'], ['followers', 'Followers']];
    t.push(['suggested', 'Suggested']);
    $('ahsTabs').innerHTML = t.map(function (x) {
      return '<button type="button" data-t="' + x[0] + '"' + (S.tab === x[0] ? ' class="on"' : '') + '>' + x[1] +
        (x[0] === 'suggested' ? '' : ' ' + fmt((S.lists[x[0]] || []).length)) + '</button>';
    }).join('');
  }

  function row(id) {
    var p = S.pc[id], me = getUser(), b = st(id), sub;
    if (S.tab === 'suggested') sub = S.mine.fers[id] ? 'Follows you' : 'Suggested for you';
    else sub = p.user ? '@' + p.user : '';
    return '<div class="ahs-row" data-act="open" data-uid="' + esc(id) + '">' +
      '<div class="ahs-av">' + esc((p.name.charAt(0) || '?').toUpperCase()) + (p.photo ? '<img src="' + esc(p.photo) + '" alt="">' : '') + '</div>' +
      '<div class="ahs-info"><b><span class="ahs-nm">' + esc(p.name) + '</span>' + (p.ver ? BADGE : '') + '</b><span>' + esc(sub) + '</span></div>' +
      (id === me.uid ? '' : '<button type="button" class="ahs-btn ' + b[1] + '" data-act="follow" data-uid="' + esc(id) + '">' + b[0] + '</button>') +
      (S.tab === 'suggested' ? '<button type="button" class="ahs-x" data-act="hide" data-uid="' + esc(id) + '" aria-label="Hide">&times;</button>' : '') +
      '</div>';
  }

  function list() {
    var L = $('ahsList'), v = S.v, tab = S.tab;
    var ids = (S.lists[tab] || []).filter(function (id) { return !S.hidden[id]; }).slice(0, CFG.max);
    if (!ids.length) { L.innerHTML = '<div class="ahs-msg">No members yet.</div>'; return; }
    L.innerHTML = '<div class="ahs-msg">Loading...</div>';
    profiles(ids.concat([S.uid])).then(function () {
      if (v !== S.v || tab !== S.tab) return;
      var me = S.pc[S.uid];
      $('ahsTitle').innerHTML = esc(me.user || me.name) + (me.ver ? BADGE : '');
      L.innerHTML = ids.map(row).join('');
    });
  }

  function open(uid, tab) {
    var me = getUser();
    if (!me || !getDB() || !uid) return;
    build();
    var v = ++S.v, own = uid === me.uid;
    S.uid = uid; S.tab = tab || 'following'; S.hidden = {}; S.lists = {};
    if (page.className !== 'open') { prevOv = d.body.style.overflow; d.body.style.overflow = 'hidden'; }
    page.className = 'open';
    $('ahsTabs').innerHTML = ''; $('ahsTitle').textContent = '';
    $('ahsList').innerHTML = '<div class="ahs-msg">Loading...</div>';

    var A = rel('followingUid', uid), B = rel('followerUid', uid);          // target's followers / following
    var C = own ? A : rel('followingUid', me.uid), D = own ? B : rel('followerUid', me.uid); // my followers / following
    Promise.all([A, B, C, D]).then(function (r) {
      if (v !== S.v) return null;
      S.lists = { followers: r[0], following: r[1] };
      S.mine = { fers: setOf(r[2]), fing: setOf(r[3]) };
      return suggest(me.uid, uid);
    }).then(function (sug) {
      if (sug === null || v !== S.v) return;
      S.lists.suggested = sug;
      tabs(); list();
    }).catch(function () {
      if (v === S.v) $('ahsList').innerHTML = '<div class="ahs-msg">Unable to load. Please try again.</div>';
    });
  }

  function close() {
    if (!page) return;
    page.className = ''; d.body.style.overflow = prevOv; S.v++;
  }

  // ===== INSTALL =====
  d.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('[data-ah-social]') : null;
    if (!el) return;
    var t = el.getAttribute('data-ah-social'), uid = el.getAttribute('data-ah-uid');
    if (uid && (t === 'followers' || t === 'following')) open(uid, t);
  });

  // Other member's profile: make Followers / Following tappable and add Likes
  function tagMember() {
    var el = $('memberProfileContent'), box = el && el.querySelector('.ah-inline');
    if (!box || !S.member || box.getAttribute('data-ahs')) return;
    var x = box.querySelectorAll('.ah-stat');
    if (x.length < 2) return;
    box.setAttribute('data-ahs', '1');
    var l = d.createElement('span'); l.className = 'ah-stat'; l.innerHTML = '<b>0</b><small>Likes</small>'; box.appendChild(l);
    [[x[0], 'followers'], [x[1], 'following'], [l, 'likes']].forEach(function (a) {
      a[0].setAttribute('data-ah-social', a[1]); a[0].setAttribute('data-ah-uid', S.member);
    });
    refresh();
    var h = el.querySelector('h2'), id = S.member;
    if (h) profiles([id]).then(function () {
      if (S.pc[id] && S.pc[id].ver && id === S.member && !h.querySelector('.ahs-vb')) h.insertAdjacentHTML('beforeend', BADGE);
    });
  }

  function install() {
    var mp = $('memberProfileContent');
    if (mp && w.MutationObserver) new MutationObserver(tagMember).observe(mp, { childList: true, subtree: true });
    if (typeof w.openMemberProfile === 'function' && !w.openMemberProfile.__ahs) {
      var om = w.openMemberProfile;
      var nm = function (uid) { S.member = uid; return om.apply(this, arguments); };
      nm.__ahs = 1; w.openMemberProfile = nm;
    }
    var pr = $('profile');
    if (pr && w.MutationObserver) {
      new MutationObserver(function () { var u = getUser(); if (u) setup(u); }).observe(pr, { childList: true, subtree: true });
    }
    if (typeof w.showPage === 'function' && !w.showPage.__ahs) {
      var orig = w.showPage;
      var wrapped = function (id) {
        var r = orig.apply(this, arguments);
        if (id === 'profile') setTimeout(refresh, 150);
        return r;
      };
      wrapped.__ahs = 1; w.showPage = wrapped;
    }
    try {
      if (typeof auth !== 'undefined' && auth && auth.onAuthStateChanged) auth.onAuthStateChanged(function () { setTimeout(refresh, 400); });
    } catch (e) {}
    if (pr && pr.classList.contains('active')) refresh();
  }

  w.AHSocial = { open: open, close: close, refresh: refresh, config: CFG };
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', install); else install();
})(window, document);

/* ======================================================================
   VIDEO VIEWER TABS: For You | Following | Friends  (full-screen "Videos For You")
   * The tabs sit at the top of the full-screen player and stay there while you scroll.
   * For You = every video (as before). Following = people you follow. Friends = you follow each other.
   * The Home grid keeps its look (2 per row) but shows at most HOME_MAX videos, so the page continues
     down to "Latest Community Posts". Tap any video and keep scrolling to see ALL of them.
   * Inside the player only the video you opened and the ones just ahead of you download; the rest wait.
   Nothing else in index.html or the app is changed.
   ====================================================================== */
(function (w, d) {
  'use strict';
  if (w.AHVideoTabs) return;

  var HOME_MAX = 10;        // videos shown in the Home grid
  var TTL = 60000;          // follow lists are read again after 60 seconds

  var viewer = d.getElementById('videoViewer'), feed = d.getElementById('videoViewerFeed'), home = d.getElementById('homeVideoFeed');
  var tab = 'foryou', seq = 0, wasOpen = false, urlUid = {}, orderUid = [];
  var fc = { at: 0, uid: '', fing: {}, fers: {} };
  var lazy = null;

  function $(id) { return d.getElementById(id); }
  function getDB() { try { if (typeof db !== 'undefined' && db) return db; } catch (e) {} return null; }
  function getUser() {
    try {
      if (typeof currentFirebaseUser !== 'undefined' && currentFirebaseUser) return currentFirebaseUser;
      if (typeof currentUser === 'function') return currentUser();
    } catch (e) {}
    return null;
  }
  function setOf(a) { var o = {}; a.forEach(function (x) { o[x] = 1; }); return o; }
  function rel(field, uid) {
    var other = field === 'followerUid' ? 'followingUid' : 'followerUid';
    return getDB().collection('follows').where(field, '==', uid).get().then(function (s) {
      return s.docs.map(function (x) { return x.data()[other]; }).filter(function (x, i, a) { return x && a.indexOf(x) === i; });
    });
  }

  // ---------- 1. Home grid: at most HOME_MAX videos (the player still holds all of them) ----------
  function capHome() {
    if (!home) return;
    var cards = home.querySelectorAll('.home-video-card');
    for (var i = cards.length - 1; i >= HOME_MAX; i--) {
      var v = cards[i].querySelector('video');
      if (v) { try { v.removeAttribute('src'); v.load(); } catch (e) {} }   // never start downloading it
      cards[i].parentNode.removeChild(cards[i]);
    }
  }

  // ---------- 2. Player: load only what is needed ----------
  function lighten() {
    if (!feed) return;
    Array.prototype.forEach.call(feed.querySelectorAll('.video-viewer-item'), function (sec) {
      var v = sec.querySelector('video');
      if (!v || sec.getAttribute('data-ahv') === '1') return;
      sec.setAttribute('data-ahv', '1');
      if (v.getAttribute('preload') === 'auto') return;            // the video that was tapped keeps loading
      v.preload = 'none'; v.setAttribute('preload', 'none');
      if (lazy) lazy.observe(sec);
    });
  }
  if ('IntersectionObserver' in w && feed) {
    lazy = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var v = e.target.querySelector('video');
        if (v && v.getAttribute('preload') === 'none') { v.preload = 'metadata'; v.setAttribute('preload', 'metadata'); }
        lazy.unobserve(e.target);
      });
    }, { root: feed, rootMargin: '100% 0px 100% 0px', threshold: 0 });
  }

  // ---------- 3. Tabs ----------
  var CSS = '#ahsVT{position:fixed;top:12px;top:calc(12px + env(safe-area-inset-top,0px));left:0;right:0;height:43px;z-index:4;display:flex;align-items:center;justify-content:center;pointer-events:none}' +
    '#ahsVT button{pointer-events:auto;position:relative;margin:0 2px;padding:8px 7px;border:0;background:none;color:rgba(255,255,255,.72);font-size:15px;font-weight:700;text-shadow:0 1px 6px rgba(0,0,0,.85);-webkit-tap-highlight-color:transparent;cursor:pointer}' +
    '#ahsVT button.on{color:#fff}#ahsVT button.on::after{content:"";position:absolute;left:7px;right:7px;bottom:1px;height:3px;border-radius:2px;background:#ffb91f}' +
    '#ahsVEmpty{display:none;position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);z-index:4;padding:0 30px;text-align:center;color:#fff;text-shadow:0 1px 6px rgba(0,0,0,.8)}' +
    '#ahsVEmpty p{margin:0 0 16px;font-size:15px;line-height:1.55}#ahsVEmpty button{padding:11px 20px;border:1px solid rgba(255,255,255,.5);border-radius:22px;background:rgba(16,19,27,.8);color:#fff;font-weight:700;font-size:14px}';

  function build() {
    if (!viewer || $('ahsVT')) return;
    var st = d.createElement('style'); st.id = 'ahsVStyle'; st.textContent = CSS; d.head.appendChild(st);
    var bar = d.createElement('div'); bar.id = 'ahsVT';
    bar.innerHTML = '<button type="button" data-vt="foryou" class="on">For You</button><button type="button" data-vt="following">Following</button><button type="button" data-vt="friends">Friends</button>';
    viewer.appendChild(bar);
    var em = d.createElement('div'); em.id = 'ahsVEmpty';
    em.innerHTML = '<p id="ahsVMsg"></p><button type="button" data-vt="foryou" id="ahsVBack">Back to For You</button>';
    viewer.appendChild(em);
    viewer.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('[data-vt]') : null;
      if (b) setTab(b.getAttribute('data-vt'));
    });
  }
  function paintTabs() {
    Array.prototype.forEach.call(d.querySelectorAll('#ahsVT button'), function (b) { b.className = b.getAttribute('data-vt') === tab ? 'on' : ''; });
  }
  function message(text, back) {
    var em = $('ahsVEmpty'); if (!em) return;
    if (!text) { em.style.display = 'none'; return; }
    $('ahsVMsg').textContent = text; $('ahsVBack').style.display = back === false ? 'none' : '';
    em.style.display = 'block';
  }

  // Which member posted this video? (by its URL, with the list order as a back-up)
  function indexOwners() {
    urlUid = {}; orderUid = [];
    (w.__afLatestPosts || []).forEach(function (p) {
      if (!p || String(p.type || '').toLowerCase() !== 'video') return;
      var raw = p.videoUrl || p.mediaUrl || p.mediaURL || p.fileUrl || '', href = '';
      try { var u = new URL(raw, location.href); if (u.protocol === 'https:' || u.protocol === 'http:') href = u.href; } catch (e) {}
      if (!href) return;
      urlUid[href] = p.uid; orderUid.push(p.uid);
    });
  }
  function ownerOf(sec) {
    var v = sec.querySelector('video'), src = v ? v.src : '';
    if (src && urlUid[src]) return urlUid[src];
    return orderUid[Number(sec.getAttribute('data-viewer-index'))] || '';
  }

  function show(allowed, emptyText) {
    var shown = 0;
    Array.prototype.forEach.call(feed.querySelectorAll('.video-viewer-item'), function (sec) {
      var ok = !allowed || !!allowed[ownerOf(sec)];
      sec.style.display = ok ? '' : 'none';
      if (ok) shown++;
    });
    feed.scrollTop = 0;
    message(allowed && !shown ? emptyText : '');
  }

  function loadFollows(uid) {
    if (fc.uid === uid && Date.now() - fc.at < TTL) return Promise.resolve();
    if (!getDB()) return Promise.reject(new Error('offline'));
    return Promise.all([rel('followerUid', uid), rel('followingUid', uid)]).then(function (r) {
      fc = { at: Date.now(), uid: uid, fing: setOf(r[0]), fers: setOf(r[1]) };
    });
  }

  function setTab(t) {
    if (!feed) return;
    tab = t; paintTabs();
    var mine = ++seq;
    if (t === 'foryou') { show(null); return; }
    var me = getUser();
    if (!me) { show({}, 'Sign in to see videos from people you follow.'); return; }
    message('Loading…', false);
    loadFollows(me.uid).then(function () {
      if (mine !== seq) return;
      var allowed = {};
      Object.keys(fc.fing).forEach(function (id) {
        if (id !== me.uid && (t === 'following' || fc.fers[id])) allowed[id] = 1;
      });
      show(allowed, t === 'following'
        ? 'No videos from the people you follow yet. Follow more creators and their videos will appear here.'
        : 'No videos from friends yet. Friends are people you follow who also follow you back.');
    }).catch(function () {
      if (mine === seq) { show({}, 'Could not load. Check your connection and try again.'); }
    });
  }

  function onOpen() {
    indexOwners();
    tab = 'foryou'; seq++; paintTabs(); message('');
    lighten();
  }

  function install() {
    if (!viewer || !feed) return;
    build(); capHome();
    if (home && w.MutationObserver) new MutationObserver(capHome).observe(home, { childList: true });
    if (w.MutationObserver) {
      new MutationObserver(function () {
        var open = viewer.classList.contains('open');
        if (open && !wasOpen) onOpen();
        wasOpen = open;
      }).observe(viewer, { attributes: true, attributeFilter: ['class'] });
      new MutationObserver(lighten).observe(feed, { childList: true });
    }
  }

  w.AHVideoTabs = { setTab: setTab, homeMax: HOME_MAX };
  install();
})(window, document);
