/* Afrishine Hub: new Inbox (Messages + Notifications in separate tabs).
   Load AFTER verified-badge.js:  <script src="/inbox-ui.js"></script>
   - Messages tab: only conversations (avatar, full name + verified badge, last message, time, unread count).
     Tap a row to chat, tap the avatar to open that member's profile.
   - Notifications tab: market, followers, likes, comments... (reuses the existing notification list). */
(function () {
  'use strict';
  try {
    var page = document.getElementById('inbox');
    if (!page || document.getElementById('ahInboxUI')) return;

    var $ = function (id) { return document.getElementById(id); };
    var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    function dbx() { return (typeof db !== 'undefined') ? db : null; }
    function me() { return (typeof currentFirebaseUser !== 'undefined') ? currentFirebaseUser : null; }
    function ms(t) { return t && t.toMillis ? t.toMillis() : 0; }
    function errText(e) { try { return typeof firebaseErrorMessage === 'function' ? firebaseErrorMessage(e) : 'Something went wrong. Please try again.'; } catch (_) { return 'Something went wrong. Please try again.'; } }
    function niceName(raw) { raw = String(raw || '').trim(); if (!raw) return ''; if (raw.indexOf('@') > 0) raw = raw.split('@')[0]; return raw.slice(0, 40); }
    function debounce(fn, wait) { var t = null; return function () { clearTimeout(t); t = setTimeout(fn, wait); }; }

    var profiles = {}, convs = [], convMeta = {}, unread = {}, nmeta = {}, nmetaAt = 0;
    var filterText = '', activeChat = '', seq = 0, tab = 'messages', authReady = false;
    var peopleCache = { at: 0, list: [] };

    /* ---------- verified seal (same look as verified-badge.js) ---------- */
    var SEAL = (function () {
      var pts = [];
      for (var i = 0; i < 96; i++) {
        var a = i * Math.PI * 2 / 96, r = 9.4 + 1.3 * Math.cos(8 * a);
        pts.push((12 + r * Math.cos(a)).toFixed(2) + ' ' + (12 + r * Math.sin(a)).toFixed(2));
      }
      return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M' + pts.join(' L') + ' Z" fill="#1d9bf0"/><path d="M7.4 12.3l3.1 3.1 6-6.6" fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    })();
    function vbadge(uid) {
      var p = profiles[uid];
      return (p && p.d && p.d.verified === true) ? '<span class="ah-vb" role="img" aria-label="Verified account" title="Verified">' + SEAL + '</span>' : '';
    }
    /* name + verified badge: the name shortens with "…" only if really too long, the badge always stays visible */
    function nameHtml(name, uid) {
      return '<span class="ah-nm"><span class="ah-name">' + esc(name) + '</span>' + vbadge(uid) + '</span>';
    }

    /* ---------- member profiles (name, photo, verified) ---------- */
    function getProfile(uid) {
      var d = dbx();
      if (!uid || !d) return Promise.resolve({});
      var c = profiles[uid];
      if (c && Date.now() - c.t < 10 * 60 * 1000) return Promise.resolve(c.d);
      return d.collection('publicProfiles').doc(uid).get().then(function (s) {
        var data = s.exists ? s.data() : {};
        profiles[uid] = { t: Date.now(), d: data };
        return data;
      }).catch(function () { profiles[uid] = { t: Date.now(), d: {} }; return {}; });
    }
    function avatarHtml(uid, p, name, cls) {
      var photo = /^https:\/\//.test((p && p.photoURL) || '') ? '<img src="' + esc(p.photoURL) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display=\'none\'">' : '<span>' + esc((name || 'A').slice(0, 1).toUpperCase()) + '</span>';
      return '<span class="ah-av ' + (cls || '') + '" role="button" tabindex="0" data-ah-profile="' + esc(uid) + '" aria-label="View ' + esc(name || 'member') + ' profile">' + photo + '</span>';
    }
    function nameOf(c) { var p = (profiles[c.other] && profiles[c.other].d) || {}; return niceName(p.username) || niceName(c.fallbackName) || 'Afrishine Member'; }

    /* short, WhatsApp-style time: 2:59 PM / Yesterday / 12 Nov */
    function fmtTime(t) {
      if (!t) return '';
      var d = new Date(t), now = new Date(), start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      if (t >= start) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      if (t >= start - 86400000) return 'Yesterday';
      return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
    }

    /* ---------- per-device "seen" memory (no extra fields are written to Firestore) ---------- */
    function key(n) { var u = me(); return 'af_inbox_' + n + '_' + (u ? u.uid : 'guest'); }
    function seenMap() { try { return JSON.parse(localStorage.getItem(key('seen')) || '{}'); } catch (_) { return {}; } }
    function saveSeen(m) { try { localStorage.setItem(key('seen'), JSON.stringify(m)); } catch (_) { } }
    function baseline() {
      var k = key('base'), v = 0;
      try { v = Number(localStorage.getItem(k) || 0); if (!v) { v = Date.now(); localStorage.setItem(k, String(v)); } } catch (_) { v = v || Date.now(); }
      return v;
    }

    /* ---------- styles ---------- */
    var style = document.createElement('style');
    style.textContent = [
      '#inbox.ah-inbox-ready>.eyebrow,#inbox.ah-inbox-ready>h1,#inbox.ah-inbox-ready>.muted,#inbox.ah-inbox-ready>.panel{display:none!important}',
      '#ahInboxUI{max-width:640px;margin:0 auto;padding:4px 0 24px}',
      '#ahInboxUI .panel{background:transparent;border:0;padding:0;margin:0;box-shadow:none}',
      '#ahInboxUI #afNotificationsPanel>h2{display:none}',
      '.ah-head{display:flex;align-items:center;gap:14px;margin:6px 0 16px}',
      '.ah-head-ic{width:56px;height:56px;flex-shrink:0;border-radius:50%;display:grid;place-items:center;background:linear-gradient(145deg,#5b2de0,#7c3aed);box-shadow:0 6px 20px #5b2de055}',
      '.ah-head-ic svg{width:28px;height:28px}',
      '.ah-title{font-size:32px;font-weight:850;line-height:1.1;color:#fff}',
      '.ah-sub{margin:4px 0 0;color:#aab4e8;font-size:14px;line-height:1.4}',
      '.ah-tabs{display:flex;gap:10px;margin:0 0 14px}',
      '.ah-tabs button{flex:1;display:flex;align-items:center;justify-content:center;gap:8px;min-height:48px;padding:0 10px;border:1px solid #2c3659;border-radius:24px;background:#12172b;color:#e6e9f7;font-size:15px;font-weight:750}',
      '.ah-tabs button[aria-selected="true"]{background:linear-gradient(120deg,#5b2de0,#8a3ff2);border-color:#7c4dff;box-shadow:0 3px 0 #ffb91f}',
      '.ah-tabcount{display:none;min-width:22px;height:22px;padding:0 6px;border-radius:11px;background:#e5242f;color:#fff;font-size:12px;font-weight:800;line-height:22px;text-align:center}',
      '.ah-search{display:flex;align-items:center;gap:10px;height:48px;margin:0 0 14px;padding:0 14px;border:1px solid #2c3659;border-radius:24px;background:#12172b}',
      '.ah-search svg{width:20px;height:20px;flex-shrink:0;stroke:#9aa5d6;fill:none;stroke-width:2;stroke-linecap:round}',
      '.ah-search input{flex:1;min-width:0;border:0;outline:0;background:transparent;color:#fff;font-size:15px}',
      '.ah-search input::placeholder{color:#8b96c8}',
      '.ah-row,#afNotificationsList .af-notification-row[data-ah-dec="1"]{display:flex;align-items:center;gap:13px;width:100%;margin:0 0 10px;padding:12px 14px 12px 12px;border:1px solid #2c3659;border-radius:18px;background:linear-gradient(135deg,#171d36,#10152b);color:#fff;text-align:left;cursor:pointer;-webkit-tap-highlight-color:transparent}',
      '.ah-row:active{background:#1c2342}',
      '.ah-row.unread,#afNotificationsList .af-notification-row.new[data-ah-dec="1"]{border-color:#6a4be0;box-shadow:0 0 0 1px #6a4be055}',
      '.ah-av{position:relative;width:56px;height:56px;flex-shrink:0;border-radius:50%;overflow:hidden;display:grid;place-items:center;background:linear-gradient(145deg,#5b2de0,#2a3a8f);border:2px solid #394066;color:#fff;font-size:22px;font-weight:800;cursor:pointer}',
      '.ah-av img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}',
      '.ah-av.sm{width:44px;height:44px;font-size:18px}',
      '.ah-main{flex:1;min-width:0}',
      '.ah-top{display:flex;align-items:center;gap:8px;min-width:0}',
      '.ah-nm{display:flex;align-items:center;flex:1;min-width:0}',
      '.ah-name{font-size:16.5px;font-weight:800;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}',
      '.ah-pill{flex-shrink:0;padding:3px 9px;border-radius:999px;background:#3b2a8f;color:#d6cfff;font-size:11.5px;font-weight:750}',
      '.ah-pill.n{background:#12408f;color:#8fc0ff}',
      '.ah-bottom{display:flex;align-items:center;gap:10px;margin-top:4px;min-width:0}',
      '.ah-snip{margin-top:4px;color:#aab4d4;font-size:14px;line-height:1.35;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.ah-bottom .ah-snip{flex:1;min-width:0;margin-top:0}',
      '#afNotificationsList .ah-snip{white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}',
      '.ah-row.unread .ah-snip{color:#fff;font-weight:600}',
      '.ah-ntime{display:block;margin-top:3px;color:#8b96c8;font-size:12px}',
      '.ah-time{flex-shrink:0;color:#9aa5d6;font-size:12.5px;line-height:1.3;white-space:nowrap}',
      '.ah-row.unread .ah-time{color:#ffb91f;font-weight:700}',
      '.ah-count{flex-shrink:0;min-width:22px;height:22px;padding:0 6px;border-radius:11px;background:#e5242f;color:#fff;font-size:12.5px;font-weight:800;line-height:22px;text-align:center}',
      '.ah-chev{flex-shrink:0;color:#c9d0f5;font-size:24px;line-height:1}',
      '.ah-vb{flex-shrink:0;display:inline-block;width:16px;height:16px;margin-left:5px;vertical-align:-3px;line-height:0}',
      '.ah-vb svg{display:block;width:100%;height:100%}',
      '.ah-sec{margin:16px 2px 8px;color:#ffb91f;font-size:12.5px;font-weight:800;letter-spacing:.8px;text-transform:uppercase}',
      '.ah-empty{padding:26px 14px;text-align:center;color:#aab4d4;font-size:14.5px;line-height:1.6}',
      '.ah-empty button{margin-top:12px}',
      '#ahInboxUI[data-tab="messages"] #ahPaneNot{display:none}',
      '#ahInboxUI[data-tab="notifications"] #ahPaneMsg,#ahInboxUI[data-tab="notifications"] .ah-search{display:none}',
      '#ahInboxUI.in-chat .ah-head,#ahInboxUI.in-chat .ah-tabs,#ahInboxUI.in-chat .ah-search{display:none}',
      '.ah-chat-head{display:flex;align-items:center;gap:12px;padding:4px 0 12px;margin-bottom:8px;border-bottom:1px solid #2c3659}',
      '.ah-back{width:40px;height:40px;flex-shrink:0;border-radius:50%;border:1px solid #2c3659;background:#12172b;color:#fff;font-size:26px;line-height:1}',
      '.ah-chat-who{flex:1;min-width:0;text-align:left;cursor:pointer}',
      '.ah-chat-who .ah-nm b,.ah-chat-who .ah-nm .ah-name{font-size:17px}',
      '.ah-chat-who small{display:block;margin-top:2px;color:#aab4e8;font-size:12.5px}',
      '#ahInboxUI .message-list{max-height:calc(100vh - 300px);max-height:calc(100dvh - 300px);min-height:180px}',
      '#ahInboxUI .message-bubble{border-radius:16px}',
      '#ahInboxUI .message-bubble.mine{background:#2a2150;border-color:#5b3fd0}'
    ].join('\n');
    document.head.appendChild(style);

    /* ---------- build the new Inbox shell ---------- */
    var ui = document.createElement('div');
    ui.id = 'ahInboxUI';
    ui.setAttribute('data-tab', 'messages');
    ui.innerHTML =
      '<div class="ah-head"><span class="ah-head-ic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><rect x="3" y="5.5" width="18" height="13" rx="3" fill="#fff"/><path d="M4.5 8l7.5 5.5L19.5 8" stroke="#5b2de0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span><div><div class="ah-title">Inbox</div><p class="ah-sub">Your messages and notifications, kept separate</p></div></div>' +
      '<div class="ah-tabs" role="tablist"><button type="button" role="tab" data-ah-tab="messages" aria-selected="true">✉ Messages <span class="ah-tabcount" id="ahTabMsg"></span></button><button type="button" role="tab" data-ah-tab="notifications" aria-selected="false">🔔 Notifications <span class="ah-tabcount" id="ahTabNot"></span></button></div>' +
      '<div class="ah-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><input id="ahInboxSearch" type="search" placeholder="Search person or message…" autocomplete="off" aria-label="Search messages"></div>' +
      '<section id="ahPaneMsg"><div id="ahMsgSlot"></div></section>' +
      '<section id="ahPaneNot"><div id="ahNotSlot"></div></section>';
    page.insertBefore(ui, page.firstChild);

    var inboxList = $('inboxList'), notifPanel = $('afNotificationsPanel');
    if (inboxList) $('ahMsgSlot').appendChild(inboxList);
    if (notifPanel) $('ahNotSlot').appendChild(notifPanel);
    page.classList.add('ah-inbox-ready');

    /* ---------- tabs ---------- */
    function setTab(name) {
      tab = name === 'notifications' ? 'notifications' : 'messages';
      ui.setAttribute('data-tab', tab);
      Array.prototype.forEach.call(ui.querySelectorAll('[data-ah-tab]'), function (b) { b.setAttribute('aria-selected', b.getAttribute('data-ah-tab') === tab ? 'true' : 'false'); });
      if (tab === 'notifications') {
        if (typeof window.afRefreshNotifications === 'function') window.afRefreshNotifications();
        refreshNotifMeta(false);
        updateNotifCount();
      }
    }
    window.afInboxTab = setTab;
    function setCount(id, n) { var el = $(id); if (!el) return; el.textContent = n > 99 ? '99+' : String(n); el.style.display = n > 0 ? 'inline-block' : 'none'; }
    function setMsgCount() { var n = Object.keys(unread).length; setCount('ahTabMsg', n); }
    function updateNotifCount() { setCount('ahTabNot', document.querySelectorAll('#afNotificationsList .af-notification-row.new').length); }

    /* ---------- Messages tab ---------- */
    function rowHtml(c) {
      var p = (profiles[c.other] && profiles[c.other].d) || {}, name = nameOf(c), n = unread[c.id] || 0;
      return '<div class="ah-row' + (n ? ' unread' : '') + '" role="button" tabindex="0" data-conv="' + esc(c.id) + '">' +
        avatarHtml(c.other, p, name) +
        '<div class="ah-main">' +
        '<div class="ah-top">' + nameHtml(name, c.other) + '<span class="ah-time">' + esc(fmtTime(c.t)) + '</span></div>' +
        '<div class="ah-bottom"><div class="ah-snip">' + esc(c.last || 'Start a conversation') + '</div>' + (n ? '<span class="ah-count">' + (n > 9 ? '9+' : n) + '</span>' : '') + '</div>' +
        '</div></div>';
    }
    function drawMessages() {
      var list = $('inboxList');
      if (!list || activeChat) return;
      var q = filterText.trim().toLowerCase();
      var rows = convs.filter(function (c) { return !q || nameOf(c).toLowerCase().indexOf(q) >= 0 || String(c.last || '').toLowerCase().indexOf(q) >= 0; });
      var html = rows.map(rowHtml).join('');
      if (!rows.length) html = '<div class="ah-empty">' + (q ? 'No conversation matches “' + esc(q) + '”.' : 'No messages yet.<br>Open a member’s profile and tap Send Message, or search for a person above.') + '</div>';
      list.innerHTML = html + '<div id="ahPeople"></div>';
      if (q.length >= 2) searchPeople(q);
    }
    function renderMessages() {
      var list = $('inboxList'), u = me(), d = dbx(), mine = ++seq;
      if (!list) return Promise.resolve();
      ui.classList.remove('in-chat');
      activeChat = '';
      if (!u || !d) {
        convs = []; unread = {};
        list.innerHTML = authReady ? '<div class="ah-empty">Sign in to view your messages.<br><button type="button" class="gold" data-ah-signin>Create Account / Sign In</button></div>' : '<div class="ah-empty">Loading messages…</div>';
        setMsgCount();
        return Promise.resolve();
      }
      list.innerHTML = '<div class="ah-empty">Loading messages…</div>';
      return d.collection('conversations').where('participants', 'array-contains', u.uid).limit(40).get().then(function (snap) {
        if (mine !== seq) return null;
        convs = snap.docs.map(function (x) {
          var v = x.data(), other = (v.participants || []).filter(function (p) { return p !== u.uid; })[0] || '';
          return { id: x.id, other: other, fallbackName: (v.participantNames || {})[other] || '', last: v.lastMessage || '', t: ms(v.updatedAt) };
        }).sort(function (a, b) { return b.t - a.t; });
        convs.forEach(function (c) { convMeta[c.id] = c; });
        return Promise.all(convs.map(function (c) { return getProfile(c.other); })).then(function () { return true; });
      }).then(function (ok) {
        if (!ok || mine !== seq) return;
        drawMessages();
        computeUnread(mine);
      }).catch(function (e) {
        console.warn('Inbox:', e);
        if (mine === seq && list) list.innerHTML = '<div class="ah-empty">' + esc(errText(e)) + '</div>';
      });
    }
    function computeUnread(mine) {
      var u = me(), d = dbx();
      if (!u || !d) return;
      var seen = seenMap(), base = baseline();
      var cand = convs.filter(function (c) { return c.t > Math.max(seen[c.id] || 0, base); }).slice(0, 25);
      unread = {};
      if (!cand.length) { setMsgCount(); return; }
      Promise.all(cand.map(function (c) {
        var thr = Math.max(seen[c.id] || 0, base);
        return d.collection('conversations').doc(c.id).collection('messages').where('createdAt', '>', firebase.firestore.Timestamp.fromMillis(thr)).limit(10).get().then(function (s) {
          var n = s.docs.filter(function (x) { return x.data().senderUid !== u.uid; }).length;
          if (n) unread[c.id] = n;
        }).catch(function () { });
      })).then(function () {
        if (mine !== seq) return;
        setMsgCount();
        if (!activeChat) drawMessages();
      });
    }
    function markSeen(id) {
      var d = dbx();
      if (!d || !id) return;
      d.collection('conversations').doc(id).get().then(function (s) {
        if (!s.exists) return;
        var t = ms(s.data().updatedAt), m = seenMap();
        m[id] = Math.max(m[id] || 0, t);
        saveSeen(m);
        delete unread[id];
        setMsgCount();
      }).catch(function () { });
    }

    /* search people to start a new chat (replaces the old "Find a Member" box) */
    function searchPeople(q) {
      var d = dbx(), u = me();
      if (!d || !u) return;
      function show() {
        if (filterText.trim().toLowerCase() !== q) return;
        var box = $('ahPeople');
        if (!box || activeChat) return;
        var have = {};
        convs.forEach(function (c) { have[c.other] = 1; });
        var hits = peopleCache.list.filter(function (p) { return p.id !== u.uid && !have[p.id] && String(p.username || '').toLowerCase().indexOf(q) >= 0; }).slice(0, 8);
        box.innerHTML = hits.length ? '<div class="ah-sec">People</div>' + hits.map(function (p) {
          var nm = niceName(p.username) || 'Afrishine Member';
          return '<div class="ah-row" role="button" tabindex="0" data-ah-start="' + esc(p.id) + '" data-name="' + esc(nm) + '">' + avatarHtml(p.id, p, nm) + '<div class="ah-main"><div class="ah-top">' + nameHtml(nm, p.id) + '<span class="ah-pill">Start chat</span></div><div class="ah-snip">' + esc(p.location || p.bio || 'Afrishine Hub member') + '</div></div><span class="ah-chev" aria-hidden="true">›</span></div>';
        }).join('') : '';
      }
      if (Date.now() - peopleCache.at < 5 * 60 * 1000) { show(); return; }
      d.collection('publicProfiles').limit(300).get().then(function (snap) {
        peopleCache = { at: Date.now(), list: snap.docs.map(function (x) { var v = x.data(); profiles[x.id] = { t: Date.now(), d: v }; return Object.assign({ id: x.id }, v); }) };
        show();
      }).catch(function () { });
    }

    /* ---------- chat screen: profile header + badges ---------- */
    function enhanceChat(id, name) {
      var list = $('inboxList'), u = me(), d = dbx();
      var view = list && list.querySelector('.conversation-view');
      if (!view || !u) return Promise.resolve();
      var c = convMeta[id];
      var otherP = c ? Promise.resolve(c.other) : (d ? d.collection('conversations').doc(id).get().then(function (s) {
        var parts = (s.exists && s.data().participants) || [], o = parts.filter(function (p) { return p !== u.uid; })[0] || '';
        convMeta[id] = { id: id, other: o, fallbackName: name || '', last: '', t: 0 };
        return o;
      }) : Promise.resolve(''));
      return otherP.then(function (other) {
        return Promise.all([getProfile(other), getProfile(u.uid)]).then(function (res) {
          var p = res[0], nm = niceName(p.username) || niceName(name) || 'Afrishine Member';
          var head = document.createElement('div');
          head.className = 'ah-chat-head';
          head.innerHTML = '<button type="button" class="ah-back" id="ahChatBack" aria-label="Back to messages">‹</button>' + avatarHtml(other, p, nm, 'sm') +
            '<div class="ah-chat-who" data-ah-profile="' + esc(other) + '" role="button" tabindex="0">' + nameHtml(nm, other) + '<small>View profile</small></div>';
          var first = view.firstElementChild, h2 = view.querySelector('h2');
          if (first && first.tagName === 'BUTTON') first.remove();
          if (h2) h2.remove();
          view.insertBefore(head, view.firstChild);
          Array.prototype.forEach.call(view.querySelectorAll('.message-bubble'), function (bubble) {
            var who = bubble.classList.contains('mine') ? u.uid : other, b = bubble.querySelector('b');
            if (b && !b.querySelector('.ah-vb')) b.insertAdjacentHTML('beforeend', vbadge(who));
          });
          var ml = $('messageList');
          if (ml) ml.scrollTop = ml.scrollHeight;
        });
      });
    }

    /* take over the two functions the page already uses to show the inbox and a chat */
    window.loadInbox = function () { return renderMessages(); };
    var origOpen = window.openConversation;
    if (typeof origOpen === 'function') {
      window.openConversation = function (id, name) {
        seq++;
        activeChat = id;
        ui.classList.add('in-chat');
        var ctx = this, args = arguments;
        return Promise.resolve(origOpen.apply(ctx, args)).then(function () { return enhanceChat(id, name); }).then(function () { markSeen(id); }).catch(function (e) { console.warn('Chat:', e); });
      };
    }
    var prevShow = window.showPage;
    if (typeof prevShow === 'function') {
      window.showPage = function (id) {
        if (id === 'inbox') setTab('messages');
        return prevShow.apply(this, arguments);
      };
    }
    function openProfile(uid) { if (uid && typeof window.openMemberProfile === 'function') window.openMemberProfile(uid); }

    /* ---------- Notifications tab: photo + name + badge on each row ---------- */
    function pillFor(type) {
      return ({ follow: 'Follow', post_like: 'Like', post_comment: 'Comment', marketplace_comment: 'Market', message: 'Message', feed: 'New post' })[type] || 'Update';
    }
    function refreshNotifMeta(force) {
      var u = me(), d = dbx();
      if (!u || !d) return Promise.resolve();
      if (!force && Date.now() - nmetaAt < 20000) return Promise.resolve();
      nmetaAt = Date.now();
      return d.collection('notifications').where('recipientUid', '==', u.uid).limit(50).get().then(function (snap) {
        snap.docs.forEach(function (x) { var v = x.data(); nmeta[x.id] = { actor: v.actorUid || '', type: v.type || '' }; });
        decorateNotifs();
      }).catch(function () { });
    }
    function decorateNotifs() {
      var rows = document.querySelectorAll('#afNotificationsList .af-notification-row'), missing = false;
      Array.prototype.forEach.call(rows, function (row) {
        if (row.getAttribute('data-ah-dec') === '1') return;
        var id = row.getAttribute('data-af-id') || '', actor = '', type = '';
        if (row.getAttribute('data-af-doc') === '1') {
          var m = nmeta[id];
          if (!m) { missing = true; return; }
          actor = m.actor; type = m.type;
        } else if (id.indexOf('feed-') === 0) {
          var pid = id.slice(5), p = (window.__afLatestPosts || []).filter(function (x) { return x.id === pid; })[0];
          if (p) { actor = p.uid; type = 'feed'; }
        }
        if (!actor) return;
        row.setAttribute('data-ah-dec', '1');
        getProfile(actor).then(function (p) {
          var t = row.querySelector('b'), bd = row.querySelector('span'), tm = row.querySelector('small');
          var titleTxt = t ? t.textContent : '', bodyTxt = bd ? bd.textContent : '', timeTxt = tm ? tm.textContent : '';
          var nm = niceName(p.username);
          row.innerHTML = avatarHtml(actor, p, nm || 'M') +
            '<div class="ah-main"><div class="ah-top">' + nameHtml(nm || titleTxt, nm ? actor : '') + '<span class="ah-pill n">' + esc(pillFor(type)) + '</span></div><div class="ah-snip">' + esc(bodyTxt) + '</div><small class="ah-ntime">' + esc(timeTxt) + '</small></div><span class="ah-chev" aria-hidden="true">›</span>';
          var av = row.querySelector('[data-ah-profile]');
          if (av) av.addEventListener('click', function (e) { e.stopPropagation(); e.preventDefault(); openProfile(actor); });
        });
      });
      if (missing) refreshNotifMeta(Date.now() - nmetaAt > 4000);
    }
    var notifList = $('afNotificationsList');
    if (notifList && 'MutationObserver' in window) {
      new MutationObserver(debounce(function () { decorateNotifs(); updateNotifCount(); }, 120)).observe(notifList, { childList: true, subtree: true });
    }

    /* ---------- clicks and keys ---------- */
    ui.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var prof = t.closest('[data-ah-profile]');
      if (prof) { e.preventDefault(); e.stopPropagation(); openProfile(prof.getAttribute('data-ah-profile')); return; }
      var tb = t.closest('[data-ah-tab]');
      if (tb) { setTab(tb.getAttribute('data-ah-tab')); return; }
      if (t.closest('#ahChatBack')) { window.loadInbox(); return; }
      if (t.closest('[data-ah-signin]')) { if (typeof window.showPage === 'function') window.showPage('profile'); return; }
      var st = t.closest('[data-ah-start]');
      if (st) { if (typeof window.startConversation === 'function') window.startConversation(st.getAttribute('data-ah-start'), st.getAttribute('data-name') || 'Afrishine Member'); return; }
      var row = t.closest('[data-conv]');
      if (row) {
        var id = row.getAttribute('data-conv'), c = convMeta[id];
        window.openConversation(id, c ? nameOf(c) : 'Conversation');
      }
    });
    ui.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var t = e.target;
      if (t && t.matches && t.matches('[data-conv],[data-ah-profile],[data-ah-start]')) { e.preventDefault(); t.click(); }
    });
    var search = $('ahInboxSearch');
    if (search) search.addEventListener('input', debounce(function () { filterText = search.value || ''; drawMessages(); }, 150));

    /* ---------- start ---------- */
    if (typeof auth !== 'undefined' && auth && auth.onAuthStateChanged) {
      auth.onAuthStateChanged(function () {
        authReady = true;
        profiles = {}; nmeta = {}; nmetaAt = 0; convs = []; unread = {};
        if (page.classList.contains('active') && !activeChat) renderMessages();
        else setMsgCount();
      });
    }
    updateNotifCount();
    if (page.classList.contains('active')) renderMessages();
  } catch (err) { console.warn('New Inbox not started:', err); }
})();
