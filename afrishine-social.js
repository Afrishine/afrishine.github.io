/* AFRISHINE HUB - Social stats (Following / Followers / Suggested + Likes)
   Uses the existing Firebase `db`. Touches nothing else. Android 8+ safe (no ?. / ??).
   Load AFTER the main app scripts. REMOVE the old profile-social-stats file. */
(function (w, d) {
  'use strict';
  if (w.AHSocial) return;

  // ===== SETTINGS (edit here only) =====
  var CFG = {
    likeCollections: ['posts', 'love_posts', 'marketplacePosts'],
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
  function toPC(x) { x = x || {}; return { name: x.name || x.username || 'Afrishine Member', user: x.username || '', photo: x.photoURL || '' }; }

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
  function suggest(meUid) {
    var first = Object.keys(S.mine.fers).filter(function (id) { return !S.mine.fing[id] && id !== meUid; });
    return getDB().collection('publicProfiles').limit(40).get().then(function (s) {
      var more = [];
      s.docs.forEach(function (doc) {
        S.pc[doc.id] = toPC(doc.data());
        if (doc.id !== meUid && !S.mine.fing[doc.id] && first.indexOf(doc.id) < 0) more.push(doc.id);
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
    '.ahs-info b{display:block;font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.ahs-info span{display:block;margin-top:2px;color:#8d97ad;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.ahs-btn{min-width:96px;margin-left:10px;padding:9px 14px;border:0;border-radius:10px;font-weight:700;font-size:14px;cursor:pointer}',
    '.ahs-btn.gold{background:var(--gold,#ffb91f);color:#1a1300}',
    '.ahs-btn.grey{background:#262e3f;color:#fff}',
    '.ahs-btn:disabled{opacity:.6}',
    '.ahs-x{width:34px;height:34px;margin-left:4px;border:0;background:none;color:#8d97ad;font-size:24px;cursor:pointer}',
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
    if (own) t.push(['suggested', 'Suggested']);
    if (!own && S.tab === 'suggested') S.tab = 'following';
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
      '<div class="ahs-info"><b>' + esc(p.name) + '</b><span>' + esc(sub) + '</span></div>' +
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
      $('ahsTitle').textContent = me.user || me.name;
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
      return own ? suggest(me.uid) : [];
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
