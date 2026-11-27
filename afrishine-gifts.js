/* AFRISHINE HUB: Gift button on posts + rank badges (Bronze / Silver / Gold / Platinum).
   - A Gift button appears between Repost and Save on posts of Verified members (video, photo, text, link).
   - Tap it: the list of gifts opens, the member picks one, sees the AST price, then taps Confirm. The AST are sent with the
     existing wallet Worker (POST /wallet/gift), so the history, the rank and the receiver's notification all work as before.
   - A Verified member whose gift rank is Bronze or higher gets the matching badge instead of the plain blue one
     (window.AfrishineGifts.badgeHtml / decorate). A Verified member who has not reached a rank keeps the plain badge.
   Load it AFTER the wallet scripts in index.html:  <script src="/afrishine-gifts.js"></script> */
(function () {
  'use strict';
  if (window.AfrishineGifts) return;
  var WORKER = 'https://afrishine-media.usherluckyelie.workers.dev';
  var GIFTS = [
    { n: 'Great', a: '0.1', i: '🎁', c: '#e5484d' }, { n: 'Good', a: '0.5', i: '🎁', c: '#2f8cff' }, { n: 'Very Good', a: '1', i: '🎁', c: '#a855f7' },
    { n: 'Excellent', a: '5', i: '⭐', c: '#ffc22a' }, { n: 'Congratulations', a: '9', i: '🏆', c: '#ffc22a' }, { n: 'Bronze', a: '10', i: '🥉', c: '#cd7f32' },
    { n: 'Silver', a: '50', i: '🥈', c: '#c0c8d8' }, { n: 'Gold', a: '200', i: '🥇', c: '#ffc22a' }, { n: 'Platinum', a: '1000', i: '💎', c: '#5fd4ff' }
  ];
  var TIER = { bronze: ['#ffb26b', '#a85a1a', '#7a3c0c'], silver: ['#f1f5ff', '#aab4c8', '#6c7894'], gold: ['#ffe27a', '#f5a800', '#a86b00'], platinum: ['#b6f0ff', '#4aa8ff', '#6a4cff'] };
  var BY_LEVEL = ['', 'bronze', 'bronze', 'silver', 'gold', 'platinum'];       // fallback when the admin renamed the ranks

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function say(t) { if (typeof window.notice === 'function') window.notice(t); else alert(t); }
  function me() { try { if (typeof currentFirebaseUser !== 'undefined' && currentFirebaseUser) return currentFirebaseUser; } catch (e) { } try { if (window.auth && window.auth.currentUser) return window.auth.currentUser; } catch (e) { } return null; }
  function fdb() { try { return typeof db !== 'undefined' ? db : (window.db || null); } catch (e) { return null; } }
  function uuid() { var a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', s = '', i, r; try { r = new Uint8Array(24); crypto.getRandomValues(r); for (i = 0; i < 24; i++) s += a.charAt(r[i] % 62); return s; } catch (e) { } for (i = 0; i < 24; i++) s += a.charAt(Math.floor(Math.random() * 62)); return s; }
  function fmt(n) { var v = Number(n) || 0; return v.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1'); }

  /* ---------- API (same headers as the wallet) ---------- */
  function appCheck() { try { if (typeof firebase !== 'undefined' && typeof firebase.appCheck === 'function') return firebase.appCheck().getToken().then(function (t) { return { 'X-Firebase-AppCheck': t.token }; }).catch(function () { return {}; }); } catch (e) { } return Promise.resolve({}); }
  function api(method, path, body) {
    var u = me(); if (!u) return Promise.reject({ message: 'Please sign in first.' });
    return Promise.all([u.getIdToken(), appCheck()]).then(function (r) {
      var h = Object.assign({ Authorization: 'Bearer ' + r[0] }, r[1]), o = { method: method, headers: h };
      if (body !== undefined) { h['Content-Type'] = 'application/json'; o.body = JSON.stringify(body); }
      return fetch(WORKER + path, o);
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (j) { if (!res.ok || j.success === false) throw { message: j.message || j.error || 'Something went wrong. Please try again.', code: j.code }; return j; });
    }, function (e) { if (e && e.message && !e.code && /fetch|network/i.test(String(e.message))) throw { message: 'No connection. Please check your internet and try again.' }; throw e; });
  }

  /* ---------- rank badges ---------- */
  var ranks = {}, ranksAt = {}, pending = {}, timer = null;
  function tierOf(r) {
    if (!r) return '';
    var k = String(r.name || '').toLowerCase();
    if (TIER[k]) return k;
    return BY_LEVEL[Math.min(5, Math.max(0, Number(r.level) || 0))] || '';
  }
  var PLAIN = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#1d9bf0"/><path d="m7.200 12.400 3.200 3.200 6.400-6.800" fill="none" stroke="#fff" stroke-width="2.400" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var uidn = 0;
  function shield(t) {
    var c = TIER[t], id = 'afgs' + (++uidn);
    return '<svg viewBox="0 0 24 28" width="17" height="20" aria-hidden="true"><defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + c[0] + '"/><stop offset=".6" stop-color="' + c[1] + '"/><stop offset="1" stop-color="' + c[2] + '"/></linearGradient></defs>' +
      '<path d="M12 1.500 22 5v8.500c0 6-4.200 10.500-10 13-5.800-2.500-10-7-10-13V5Z" fill="url(#' + id + ')" stroke="' + c[2] + '" stroke-width="1"/>' +
      '<path d="m7.200 13.600 3.200 3.200 6.400-6.800" fill="none" stroke="#fff" stroke-width="2.400" stroke-linecap="round" stroke-linejoin="round"/>' +
      (t === 'gold' || t === 'platinum' ? '<path d="m8.500 4.500 1.500 1.500 2-2.200 2 2.200 1.500-1.500-.8 2.400H9.300Z" fill="#fff" opacity=".9"/>' : '') + '</svg>';
  }
  /* The badge to show next to a Verified member. Pass the rank object (or nothing for the plain badge). */
  function badgeHtml(rank, label) {
    var t = tierOf(rank), name = rank && rank.name ? rank.name : '';
    return '<span class="afg-badge' + (t ? ' ' + t : '') + '" title="' + esc(t ? name + ' Verified' : (label || 'Verified')) + '" data-afg-badge="' + (t || 'plain') + '">' + (t ? shield(t) : PLAIN) + '</span>';
  }
  function fetchRanks(uids) {
    var need = uids.filter(function (u) { return u && !(ranksAt[u] && Date.now() - ranksAt[u] < 120000) && !pending[u]; });
    if (!need.length) return Promise.resolve();
    need.forEach(function (u) { pending[u] = 1; });
    var chunks = []; for (var i = 0; i < need.length; i += 40) chunks.push(need.slice(i, i + 40));
    return Promise.all(chunks.map(function (c) {
      return fetch(WORKER + '/wallet/ranks?uids=' + encodeURIComponent(c.join(','))).then(function (r) { return r.json(); }).then(function (j) {
        c.forEach(function (u) { ranksAt[u] = Date.now(); if (j && j.ranks && j.ranks[u]) ranks[u] = j.ranks[u]; else delete ranks[u]; delete pending[u]; });
      }).catch(function () { c.forEach(function (u) { delete pending[u]; }); });
    }));
  }

  /* ---------- who is Verified (a badge with an end date stops at that date) ---------- */
  var profiles = {};
  function verifiedNow(p) { if (!p || p.verified !== true) return false; var u = p.verifiedUntil && p.verifiedUntil.toMillis ? p.verifiedUntil.toMillis() : 0; return !u || u > Date.now(); }
  function isVerified(uid) {
    if (!uid) return Promise.resolve(false);
    if (profiles[uid] && Date.now() - profiles[uid].at < 300000) return profiles[uid].p;
    var d = fdb(); if (!d) return Promise.resolve(false);
    var p = d.collection('publicProfiles').doc(uid).get().then(function (s) { return s.exists && verifiedNow(s.data()); }).catch(function () { return false; });
    profiles[uid] = { at: Date.now(), p: p };
    return p;
  }

  /* ---------- the gift sheet ---------- */
  var G = null, cfg = null, balance = null;
  var GIFT_MASK = 'url("data:image/svg+xml,' + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><rect x='3' y='8' width='18' height='4' rx='1'/><path d='M12 8v13M5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8'/><path d='M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5'/></svg>") + '")';
  var CSS = '.afg-badge{display:inline-flex;vertical-align:-3px;margin-left:4px;line-height:0}.afg-badge.bronze,.afg-badge.silver,.afg-badge.gold,.afg-badge.platinum{filter:drop-shadow(0 0 3px #0008)}' +
    '.afg-btn{display:inline-flex;align-items:center;gap:6px}.afg-btn svg{width:20px;height:20px}' +
    '.ah-feed .post-actions>.afg-btn svg,.ah-feed .post-actions>.afg-btn span{display:none}' +
    '.ah-feed .post-actions>.afg-btn::before{-webkit-mask-image:' + GIFT_MASK + ';mask-image:' + GIFT_MASK + '}' +
    '.vx-btn.afg-vx{color:#ffb91f}.vx-btn.afg-vx svg{width:26px;height:26px}' +
    '.af-verified[data-afg-t]{width:19px;height:22px;vertical-align:-5px}h2 .af-verified[data-afg-t]{width:24px;height:28px;vertical-align:-6px}.vx-vb[data-afg-t]{width:17px;height:20px;vertical-align:-4px}' +
    '.afg-ov{position:fixed;inset:0;z-index:2000;background:#000a;display:flex;align-items:flex-end;justify-content:center}' +
    '.afg-sheet{width:100%;max-width:560px;max-height:88vh;overflow:auto;background:#10141d;border:1px solid #2c3446;border-radius:24px 24px 0 0;padding:14px 14px calc(18px + env(safe-area-inset-bottom));color:#fff;box-shadow:0 -10px 40px #000a}' +
    '.afg-grip{width:46px;height:5px;border-radius:4px;background:#394355;margin:0 auto 10px}' +
    '.afg-head{display:flex;align-items:center;gap:10px;margin-bottom:4px}.afg-head h3{margin:0;flex:1;font-size:21px}.afg-x{border:0;background:none;color:#fff;font-size:24px;line-height:1;padding:6px 10px}' +
    '.afg-sub{margin:0 0 12px;color:#aeb6c5;font-size:14px}.afg-sub b{color:#fff}' +
    '.afg-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}' +
    '.afg-gift{display:flex;flex-direction:column;align-items:center;gap:2px;padding:12px 4px 10px;border-radius:16px;border:2px solid #2c3446;background:#171d29;color:#fff;cursor:pointer;font-weight:700;font-size:14px}' +
    '.afg-gift i{font-style:normal;font-size:34px;line-height:1.1}.afg-gift span{color:#ffb91f;font-size:14.500px}' +
    '.afg-gift.on{border-color:#ffb91f;background:#241c08;box-shadow:0 0 0 3px #ffb91f22}.afg-gift:disabled{opacity:.4}' +
    '.afg-confirm{margin-top:14px;padding:14px;border-radius:16px;background:#0d1838;border:1px solid #2c4a9a;text-align:center}' +
    '.afg-confirm p{margin:0 0 10px;font-size:15.500px}.afg-confirm p b{color:#ffb91f}.afg-confirm small{display:block;color:#aeb6c5;margin-top:8px}' +
    '.afg-go{width:100%;min-height:52px;border:0;border-radius:999px;background:linear-gradient(180deg,#ffd13f,#f5a800);color:#111;font-weight:900;font-size:17px}.afg-go:disabled{opacity:.6}' +
    '.afg-alt{width:100%;margin-top:8px;min-height:46px;border-radius:999px;border:1px solid #394355;background:#171d29;color:#fff;font-weight:700}' +
    '.afg-msg{margin:10px 0 0;font-size:14px;color:#ff9b9b;text-align:center}.afg-done{text-align:center;padding:10px 0 4px}.afg-done i{font-style:normal;font-size:58px;display:block}.afg-done h4{margin:6px 0 4px;font-size:21px}.afg-done p{margin:0 0 12px;color:#aeb6c5}';
  function css() { if ($('afgCss')) return; var s = document.createElement('style'); s.id = 'afgCss'; s.textContent = CSS; document.head.appendChild(s); }
  function close() { var o = $('afgOv'); if (o) o.remove(); G = null; }
  function minAst() { return cfg && cfg.gift ? Number(cfg.gift.min) || 0 : 0; }
  function maxAst() { return cfg && cfg.gift ? Number(cfg.gift.max) || 1e9 : 1e9; }
  function paint() {
    var o = $('afgOv'); if (!o || !G) return;
    var sel = G.sel, html;
    if (G.done) {
      html = '<div class="afg-done"><i>🎉</i><h4>Gift sent!</h4><p>' + esc(sel.n) + ' · ' + fmt(sel.a) + ' AST was sent to <b>' + esc(G.name) + '</b>.<br>They get a notification with your name.</p></div>' +
        '<button type="button" class="afg-go" data-afg="close">Done</button>' + (G.uid && typeof window.openMessageUser === 'function' ? '' : '');
    } else {
      var cells = GIFTS.map(function (g) {
        var off = Number(g.a) < minAst() || Number(g.a) > maxAst();
        return '<button type="button" class="afg-gift' + (sel && sel.n === g.n ? ' on' : '') + '" data-afg-pick="' + esc(g.n) + '"' + (off ? ' disabled title="Not available"' : '') + '><i>' + g.i + '</i>' + esc(g.n) + '<span>' + fmt(g.a) + ' AST</span></button>';
      }).join('');
      var enough = sel && balance !== null ? balance >= Number(sel.a) : true;
      html = '<div class="afg-grip"></div><div class="afg-head"><h3>Send a Gift</h3><button type="button" class="afg-x" data-afg="close" aria-label="Close">✕</button></div>' +
        '<p class="afg-sub">To <b>' + esc(G.name) + '</b>' + (balance !== null ? ' · Your wallet: <b>' + fmt(balance) + ' AST</b>' : '') + '</p><div class="afg-grid">' + cells + '</div>' +
        (sel ? '<div class="afg-confirm"><p>' + sel.i + ' <b>' + esc(sel.n) + '</b> = <b>' + fmt(sel.a) + ' AST</b></p>' +
          (enough ? '<button type="button" class="afg-go" data-afg="send"' + (G.busy ? ' disabled' : '') + '>' + (G.busy ? 'Sending…' : 'Confirm · Send ' + fmt(sel.a) + ' AST') + '</button>' :
            '<button type="button" class="afg-go" data-afg="topup">Not enough AST · Add AST</button>') +
          '<small>The AST leave your wallet right away. A gift cannot be taken back.</small></div>' : '<p class="afg-sub" style="margin:12px 0 0;text-align:center">Choose a gift.</p>') +
        (G.err ? '<p class="afg-msg">' + esc(G.err) + '</p>' : '');
    }
    var sheet = o.querySelector('.afg-sheet'); sheet.innerHTML = html;
  }
  function open(opts) {
    opts = opts || {};
    css();
    var u = me();
    if (!u) { say('Sign in to send a gift.'); return; }
    if (opts.uid && opts.uid === u.uid) { say('You cannot send a gift to yourself.'); return; }
    close();
    G = { uid: opts.uid, name: String(opts.name || 'this creator').slice(0, 40), postId: opts.postId || '', sel: null, busy: false, err: '', done: false, idem: '' };
    var o = document.createElement('div'); o.className = 'afg-ov'; o.id = 'afgOv'; o.innerHTML = '<div class="afg-sheet" role="dialog" aria-modal="true" aria-label="Send a Gift"></div>';
    document.body.appendChild(o); paint();
    o.addEventListener('click', function (e) { if (e.target === o) close(); });
    var sum = api('GET', '/wallet/summary').then(function (j) { balance = j.balance / 100; }).catch(function () { });
    var conf = cfg ? Promise.resolve() : api('GET', '/wallet/config').then(function (j) { cfg = j.config; }).catch(function () { });
    Promise.all([sum, conf]).then(paint);
  }
  function send() {
    if (!G || !G.sel || G.busy) return;
    var sel = G.sel;
    if (!G.idem || G.idemFor !== sel.n) { G.idem = uuid(); G.idemFor = sel.n; }      // the same key is reused for a retry: it can never pay twice
    G.busy = true; G.err = ''; paint();
    api('POST', '/wallet/gift', { toUid: G.uid, amount: Number(sel.a).toFixed(2), kind: 'gift', postId: G.postId || undefined, idem: G.idem }).then(function (j) {
      if (!G) return;
      if (typeof j.balance === 'number') balance = j.balance / 100;
      G.busy = false; G.done = true; ranksAt[me().uid] = 0; paint();
      try { if (window.AfrishineWallet && window.AfrishineWallet.refresh) window.AfrishineWallet.refresh(); } catch (e) { }
      try { var mu = me(); if (typeof window.afCreateNotification === 'function' && G.uid) window.afCreateNotification(G.uid, 'gift', 'You received a gift', (mu && mu.displayName || 'A member') + ' sent you ' + sel.n + ' (' + fmt(sel.a) + ' AST).', 'profile'); } catch (e) { }
    }).catch(function (e) { if (!G) return; G.busy = false; G.err = (e && e.message) || 'Could not send. Please try again.'; paint(); });
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target : null; if (!t) return;
    var pick = t.closest('[data-afg-pick]');
    if (pick && G) { var n = pick.getAttribute('data-afg-pick'); G.sel = GIFTS.filter(function (g) { return g.n === n; })[0] || null; G.err = ''; paint(); return; }
    var a = t.closest('[data-afg]');
    if (a) { var k = a.getAttribute('data-afg'); if (k === 'close') close(); else if (k === 'send') send(); else if (k === 'topup') { close(); if (window.AfrishineWallet) window.AfrishineWallet.open(); } return; }
    var g = t.closest('[data-afg-open]');
    if (g) { e.preventDefault(); e.stopPropagation(); open({ uid: g.getAttribute('data-afg-open'), name: g.getAttribute('data-afg-name'), postId: g.getAttribute('data-afg-post') }); }
  }, true);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && G) close(); });

  /* ---------- Gift button on posts ---------- */
  var GIFT_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8"/><path d="M7.500 8a2.500 2.500 0 0 1 0-5C10 3 12 8 12 8s2-5 4.500-5a2.500 2.500 0 0 1 0 5"/></svg>';
  function buttonHtml(uid, name, postId, cls) {
    return '<button type="button" class="' + esc(cls || 'secondary') + ' afg-btn" data-afg-open="' + esc(uid) + '" data-afg-name="' + esc(name) + '" data-afg-post="' + esc(postId || '') + '" aria-label="Send a gift">' + GIFT_ICON + '<span>Gift</span></button>';
  }
  function nameOf(card, uid) {
    var el = card.querySelector('[data-open-profile="' + uid + '"]') || card.querySelector('[data-open-profile]');
    return el ? String(el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40) : '';
  }
  function addGiftButtons(root) {
    var reposts = (root || document).querySelectorAll('[data-repost]:not([data-afg-seen])');
    Array.prototype.forEach.call(reposts, function (rb) {
      rb.setAttribute('data-afg-seen', '1');
      var card = rb.closest('[data-post-id]'); if (!card) return;
      var uid = card.getAttribute('data-author-uid'), id = card.getAttribute('data-post-id'); if (!uid) return;
      var u = me(); if (u && u.uid === uid) return;                             // not on your own posts
      isVerified(uid).then(function (ok) {
        if (!ok || card.querySelector('[data-afg-open]')) return;
        var wrap = document.createElement('span'); wrap.innerHTML = buttonHtml(uid, nameOf(card, uid) || 'this creator', id, rb.className || 'secondary');
        rb.insertAdjacentElement('afterend', wrap.firstChild);                    // between Repost and Save
      });
    });
  }
  /* ---------- rank badge ----------
     verified-badge.js already puts the blue seal (.af-verified) next to every verified member. For members who have
     reached a rank we swap the inside of that same seal for the rank shield, so nobody ever gets two badges.
     If verified-badge.js is not on the page, we add the badge ourselves. */
  var HAS_VB = !!document.querySelector('script[src*="erfied-badge"],script[src*="erified-badge"]');
  function applyShield(el, uid) {
    var t = tierOf(ranks[uid]);
    if (!t) { if (el.getAttribute('data-afg-t')) { el.removeAttribute('data-afg-t'); el.removeAttribute('data-afg-keep'); } return; }
    if (el.getAttribute('data-afg-t') === t) return;
    el.innerHTML = shield(t); el.setAttribute('data-afg-t', t);
    el.title = ranks[uid].name + ' Verified'; el.setAttribute('aria-label', ranks[uid].name + ' Verified account');
  }
  function viewerItems() { return document.querySelectorAll('#videoViewerFeed .video-viewer-item'); }
  function decorate(root) {
    var seals = document.querySelectorAll('.af-verified[data-uid]:not([data-afg-t])');
    var items = viewerItems(), uids = [], i;
    Array.prototype.forEach.call(seals, function (el) { uids.push(el.getAttribute('data-uid')); });
    Array.prototype.forEach.call(items, function (it) { if (it.__vx && it.__vx.post) uids.push(it.__vx.post.uid); });
    function paintAll() {
      Array.prototype.forEach.call(document.querySelectorAll('.af-verified[data-uid]'), function (el) { applyShield(el, el.getAttribute('data-uid')); });
      Array.prototype.forEach.call(viewerItems(), function (it) {
        var vb = it.querySelector('.vx-vb'); if (vb && it.__vx && it.__vx.post) applyShield(vb, it.__vx.post.uid);
      });
    }
    if (uids.length) fetchRanks(uids).then(paintAll);
    if (HAS_VB) return;
    // fallback when verified-badge.js is missing
    var names = (root || document).querySelectorAll('.text-link[data-open-profile]:not([data-afg-done])');
    Array.prototype.forEach.call(names, function (el) {
      var uid = el.getAttribute('data-open-profile'); if (!uid) return;
      el.setAttribute('data-afg-done', '1');
      Promise.all([fetchRanks([uid]), isVerified(uid)]).then(function (r) {
        if (!r[1] || el.querySelector('[data-afg-badge],.af-verified')) return;
        var s = document.createElement('span'); s.innerHTML = badgeHtml(ranks[uid]);
        var b = s.firstChild; b.setAttribute('data-afg-for', uid); el.appendChild(b);
      });
    });
  }
  /* ---------- Gift button in the full-screen video viewer (right-hand column, after Repost) ---------- */
  function addViewerGift() {
    Array.prototype.forEach.call(viewerItems(), function (it) {
      var x = it.__vx, rail = it.querySelector('.vx-rail');
      if (!x || !x.post || !rail || rail.querySelector('.afg-vx')) return;
      var uid = x.post.uid, u = me(); if (!uid || (u && u.uid === uid)) return;
      if (rail.getAttribute('data-afg-chk') === uid) return;
      rail.setAttribute('data-afg-chk', uid);
      isVerified(uid).then(function (ok) {
        if (!ok || rail.querySelector('.afg-vx') || !rail.parentNode) return;
        var nm = it.querySelector('.vx-name'), name = nm ? String(nm.textContent || '').trim() : (x.post.authorName || 'this creator');
        var w = document.createElement('span');
        w.innerHTML = '<button type="button" class="vx-btn afg-vx" data-afg-open="' + esc(uid) + '" data-afg-name="' + esc(name) + '" data-afg-post="' + esc(x.post.id) + '" aria-label="Send a gift">' + GIFT_ICON + '<span>Gift</span></button>';
        var after = rail.querySelector('[data-vx-act="repost"]');
        if (after && after.nextSibling) rail.insertBefore(w.firstChild, after.nextSibling); else rail.appendChild(w.firstChild);
      });
    });
  }
  function scan(root) { try { addGiftButtons(root); addViewerGift(); decorate(root); } catch (e) { console.warn('Gifts:', e); } }
  function start() {
    css(); scan(document);
    if (!window.MutationObserver) return;
    var q = null;
    new MutationObserver(function () { if (q) return; q = setTimeout(function () { q = null; scan(document); }, 250); }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  window.AfrishineGifts = { open: open, close: close, badgeHtml: badgeHtml, buttonHtml: buttonHtml, rankOf: function (uid) { return ranks[uid] || null; }, loadRanks: fetchRanks, decorate: decorate, GIFTS: GIFTS };
})();
