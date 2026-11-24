/* =============================================================================
   AFRISHINE SECURITY SOLUTIONS  (opens from  Marketplace > Buy Products > Explore Now)
   - Shop: security & electronics, paid by Mobile Money to the admin, collected at the office
   - Network: binary plan (Left / Right), referral commission + matching bonus, wallet, withdrawals
   - Team chat, profile dashboard, binary tree, register-a-member, admin panel tab "Security"
   All money / PV / tree changes are done by the server (api/sec.js). This file only shows them and asks the server.
   ============================================================================= */
(function () {
  'use strict';
  var API = '/api/sec', MEDIA = 'https://afrishine-media.usherluckyelie.workers.dev';
  var CATS = [['cctv', 'CCTV Cameras'], ['alarm', 'Alarm Systems (ARM)'], ['phone', 'Smartphones'], ['computer', 'Computers & Laptops'], ['tv', 'Screen TVs'], ['fingerprint', 'Fingerprint Attendance'], ['other', 'Other Security Devices']];
  var DEF_TIERS = { cctv: [[80000, 1], [150000, 2], [350000, 5]], phone: [[80000, 1], [150000, 2], [350000, 5]], tv: [[120000, 1], [200000, 2]], computer: [[150000, 2], [300000, 5]] };
  var cfg = { pvValue: 10000, ref1: 10, ref2: 5, ref3: 2, matchPct: 7, dailyCap: 0, minWithdraw: 5000, tiers: DEF_TIERS, payTo: '', officeAddress: '' };
  var S = { view: 'home', sub: '', cat: 'all', cond: 'all', q: '', products: [], loaded: false, member: null, saved: [], ck: null, chatTab: 'mine', netRoot: '', net: null, ledger: null, orders: null, wds: null, led: { type: 'all', from: '', to: '' }, unsubChat: null, unsubMember: null, memberUid: '' };
  try { S.saved = JSON.parse(localStorage.getItem('af_sec_saved') || '[]') || []; } catch (e) { S.saved = []; }

  function $(id) { return document.getElementById(id); }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function rwf(n) { return Number(n || 0).toLocaleString('en-US') + ' RWF'; }
  function user() { try { return (typeof auth !== 'undefined' && auth.currentUser) || window.currentFirebaseUser || null; } catch (e) { return window.currentFirebaseUser || null; } }
  function dbx() { return (typeof db !== 'undefined' && db) || window.db || null; }
  function say(t) { if (typeof notice === 'function') notice(t); else alert(t); }
  function when(t) { try { var d = t && t.toDate ? t.toDate() : (t ? new Date(t) : null); return d ? d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''; } catch (e) { return ''; } }
  function ms(t) { try { return t && t.toDate ? t.toDate().getTime() : (t ? new Date(t).getTime() : 0); } catch (e) { return 0; } }
  function catName(k) { for (var i = 0; i < CATS.length; i++) if (CATS[i][0] === k) return CATS[i][1]; return 'Other'; }
  function ini(n) { return esc(String(n || '?').trim().charAt(0).toUpperCase() || '?'); }
  function avatar(n, photo, cls) { return '<span class="sec-av ' + (cls || '') + '">' + (photo ? '<img src="' + esc(photo) + '" alt="" onerror="this.remove()">' : '') + '<i>' + ini(n) + '</i></span>'; }
  function ask(action, body) {
    var u = user(); if (!u) return Promise.reject(new Error('Please sign in first.'));
    return u.getIdToken().then(function (t) {
      body = body || {}; body.action = action;
      return fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify(body) });
    }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok || d.error) throw new Error(d.error || 'Something went wrong. Please try again.'); return d; }); });
  }
  function login() { if (typeof window.marketOpenLogin === 'function') window.marketOpenLogin(); else say('Please sign in first.'); }

  /* ---------- prices, PV ---------- */
  function pvOf(p) {
    if (p && p.pvFixed && typeof p.pv === 'number') return p.pv;
    var list = (cfg.tiers && cfg.tiers[p.category]) || [], pv = 0, price = Number(p.price) || 0;
    list.forEach(function (t) { if (price >= t[0] && t[1] > pv) pv = t[1]; });
    return pv;
  }
  function loadCfg() {
    var d = dbx(); if (!d) return Promise.resolve();
    return d.collection('secConfig').doc('main').get().then(function (s) {
      if (!s.exists) return; var c = s.data() || {};
      ['pvValue', 'ref1', 'ref2', 'ref3', 'matchPct', 'dailyCap', 'minWithdraw'].forEach(function (k) { if (c[k] !== undefined && c[k] !== '' && !isNaN(Number(c[k]))) cfg[k] = Number(c[k]); });
      cfg.payTo = c.payTo || ''; cfg.officeAddress = c.officeAddress || '';
      if (c.tiers) { try { cfg.tiers = typeof c.tiers === 'string' ? JSON.parse(c.tiers) : c.tiers; } catch (e) { } }
    }).catch(function () { });
  }
  function loadProducts() {
    var d = dbx(); if (!d) return Promise.resolve();
    return d.collection('secProducts').limit(200).get().then(function (snap) {
      S.products = []; snap.forEach(function (x) { var p = x.data(); p.id = x.id; if (p.active !== false) S.products.push(p); });
      S.products.sort(function (a, b) { return ms(b.createdAt) - ms(a.createdAt); });
      S.loaded = true;
    }).catch(function () { S.loaded = true; });
  }
  function watchMember(u) {
    if (S.unsubMember) { try { S.unsubMember(); } catch (e) { } S.unsubMember = null; }
    S.member = null; S.memberUid = u ? u.uid : '';
    if (!u || !dbx()) { paintNav(); return; }
    S.unsubMember = dbx().collection('secMembers').doc(u.uid).onSnapshot(function (s) {
      S.member = s.exists ? s.data() : null; paintNav();
      if (active() && S.view === 'profile' && !S.sub) paintBody();
    }, function () { S.member = null; paintNav(); });
  }
  function active() { var el = $('secshop'); return !!(el && el.classList.contains('active')); }

  /* ---------- page skeleton ---------- */
  function ensurePage() {
    var el = $('secshop'); if (!el) return null;
    if (!el.getAttribute('data-ready')) {
      el.setAttribute('data-ready', '1');
      el.innerHTML = '<div class="sec-top"><button type="button" class="sec-back" data-a="back" aria-label="Back">‹</button><div class="sec-title"><small>AFRISHINE</small><b id="secTitle">Security Solutions</b></div><button type="button" class="sec-dots" id="secDots" data-a="menu" aria-label="Menu" style="visibility:hidden">⋮</button></div>' +
        '<div id="secBody" class="sec-body"></div>' +
        '<nav class="sec-nav" aria-label="Security Solutions"><button type="button" data-a="nav" data-v="home"><span>⌂</span><small>Home</small></button><button type="button" data-a="nav" data-v="chat"><span>✉</span><small>Chat</small></button><button type="button" data-a="nav" data-v="profile" id="secNavProfile"><span class="sec-nav-av">●</span><small>Profile</small></button></nav>';
      el.addEventListener('click', onClick);
      el.addEventListener('input', onInput);
      el.addEventListener('change', onChange);
      el.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target && e.target.id === 'secChatInput') { e.preventDefault(); sendChat(); } });
    }
    return el;
  }
  function paintNav() {
    var b = $('secNavProfile'); if (!b) return;
    var m = S.member, u = user(), name = m ? (m.name || m.username) : (u ? (u.displayName || 'Profile') : 'Profile');
    b.innerHTML = '<span class="sec-nav-av">' + (m ? avatar(m.name, m.photo || (u && u.photoURL) || '', 'sm') : '●') + '</span><small>' + esc(String(m ? (m.name || 'Joined').split(' ')[0] : 'Profile').slice(0, 12)) + '</small>';
    Array.prototype.forEach.call(document.querySelectorAll('#secshop .sec-nav button'), function (x) { x.classList.toggle('on', x.getAttribute('data-v') === S.view); });
  }
  function setTitle(t, dots) { var e = $('secTitle'); if (e) e.textContent = t; var d = $('secDots'); if (d) d.style.visibility = dots ? 'visible' : 'hidden'; }
  function go(view, sub) {
    if (S.unsubChat && view !== 'chat') { try { S.unsubChat(); } catch (e) { } S.unsubChat = null; }
    S.view = view; S.sub = sub || ''; paintBody(); paintNav(); window.scrollTo(0, 0);
  }
  function paintBody() {
    var el = $('secBody'); if (!el) return;
    if (S.view === 'home') { setTitle('Security Solutions', false); el.innerHTML = homeHtml(); }
    else if (S.view === 'chat') { setTitle('Team Chat', false); chatPaint(el); }
    else profilePaint(el);
  }

  /* ---------- HOME / SHOP ---------- */
  function homeHtml() {
    var chips = '<button type="button" data-a="cat" data-v="all" class="' + (S.cat === 'all' ? 'on' : '') + '">All</button>';
    CATS.forEach(function (c) { chips += '<button type="button" data-a="cat" data-v="' + c[0] + '" class="' + (S.cat === c[0] ? 'on' : '') + '">' + esc(c[1]) + '</button>'; });
    chips += '<button type="button" data-a="cat" data-v="saved" class="' + (S.cat === 'saved' ? 'on' : '') + '">♥ Saved</button>';
    var cond = ['all', 'New', 'Used'].map(function (c) { return '<button type="button" data-a="cond" data-v="' + c + '" class="' + (S.cond === c ? 'on' : '') + '">' + (c === 'all' ? 'All' : c) + '</button>'; }).join('');
    var list = S.products.filter(function (p) {
      if (S.cat === 'saved') { if (S.saved.indexOf(p.id) < 0) return false; } else if (S.cat !== 'all' && p.category !== S.cat) return false;
      if (S.cond !== 'all' && (p.condition || 'New') !== S.cond) return false;
      if (S.q && (String(p.title || '') + ' ' + String(p.description || '')).toLowerCase().indexOf(S.q.toLowerCase()) < 0) return false;
      return true;
    });
    var cards = list.map(card).join('');
    var empty = S.loaded ? '<div class="sec-empty">No products here yet.</div>' : '<div class="sec-empty">Loading products…</div>';
    return '<div class="sec-hero"><div><b>Afrishine Security Solutions</b><p>CCTV, alarms, phones, computers, TVs and fingerprint attendance. Pay by Mobile Money, collect at our office.</p></div></div>' +
      '<div class="sec-search"><span>⌕</span><input id="secSearch" type="search" placeholder="Search products…" value="' + esc(S.q) + '"></div>' +
      '<div class="sec-chips">' + chips + '</div><div class="sec-chips small">' + cond + '</div>' +
      '<div class="sec-note">ℹ️ Order here, pay by Mobile Money, upload the payment screenshot, then collect your product at the Afrishine office. Earn PV on every order.</div>' +
      '<div class="sec-count">' + list.length + ' product' + (list.length === 1 ? '' : 's') + '</div>' +
      '<div class="sec-grid">' + (cards || '') + '</div>' + (cards ? '' : empty);
  }
  function card(p) {
    var img = (p.images && p.images[0]) || '', pv = pvOf(p), saved = S.saved.indexOf(p.id) >= 0, soldOut = typeof p.stock === 'number' && p.stock <= 0;
    return '<div class="sec-card" data-a="open" data-id="' + esc(p.id) + '"><div class="sec-img">' + (img ? '<img loading="lazy" src="' + esc(img) + '" alt="">' : '<span class="sec-noimg">🛡️</span>') +
      '<span class="sec-badge">' + esc(p.condition || 'New') + '</span>' +
      '<button type="button" class="sec-ico a" data-a="save" data-id="' + esc(p.id) + '" aria-label="Save">' + (saved ? '♥' : '♡') + '</button>' +
      '<button type="button" class="sec-ico b" data-a="share" data-id="' + esc(p.id) + '" aria-label="Share">⤴</button></div>' +
      '<div class="sec-info"><b>' + esc(p.title) + '</b><div class="sec-price">' + rwf(p.price) + '</div>' + (pv ? '<span class="sec-pv">+' + pv + ' PV</span>' : '<span class="sec-pv none">No PV</span>') +
      '<button type="button" class="sec-buy" data-a="buy" data-id="' + esc(p.id) + '"' + (soldOut ? ' disabled' : '') + '>' + (soldOut ? 'Sold out' : 'Buy') + '</button></div></div>';
  }
  function findP(id) { for (var i = 0; i < S.products.length; i++) if (S.products[i].id === id) return S.products[i]; return null; }
  function openProduct(id) {
    var p = findP(id); if (!p) return;
    var imgs = (p.images || []).map(function (u) { return '<img src="' + esc(u) + '" alt="">'; }).join(''), pv = pvOf(p);
    sheet('<div class="sec-sh-h"><b>' + esc(p.title) + '</b><button type="button" data-a="close">✕</button></div>' +
      (imgs ? '<div class="sec-gal">' + imgs + '</div>' : '') +
      '<div class="sec-price big">' + rwf(p.price) + '</div><p class="sec-meta">' + esc(catName(p.category)) + ' · ' + esc(p.condition || 'New') + (typeof p.stock === 'number' ? ' · ' + p.stock + ' in stock' : '') + '</p>' +
      (pv ? '<span class="sec-pv">+' + pv + ' PV when your payment is confirmed</span>' : '') +
      '<p class="sec-desc">' + esc(p.description || '').replace(/\n/g, '<br>') + '</p>' +
      '<div class="sec-qty"><button type="button" data-a="qty" data-v="-1">−</button><b id="secQty">1</b><button type="button" data-a="qty" data-v="1">+</button></div>' +
      '<button type="button" class="sec-btn gold" data-a="buy" data-id="' + esc(p.id) + '">Buy now</button>');
  }

  /* ---------- sheets ---------- */
  function sheet(html) { closeSheet(); var o = document.createElement('div'); o.className = 'sec-ov'; o.id = 'secOv'; o.innerHTML = '<div class="sec-sheet" role="dialog" aria-modal="true">' + html + '</div>'; o.addEventListener('click', function (e) { if (e.target === o) closeSheet(); }); document.body.appendChild(o); document.body.classList.add('sec-lock'); o.addEventListener('click', onClick); o.addEventListener('input', onInput); o.addEventListener('change', onChange); }
  function closeSheet() { var o = $('secOv'); if (o && o.parentNode) o.parentNode.removeChild(o); document.body.classList.remove('sec-lock'); }
  function sheetBody(html) { var s = document.querySelector('#secOv .sec-sheet'); if (s) s.innerHTML = html; else sheet(html); }

  /* ---------- BUY FLOW ---------- */
  function ref() { try { return localStorage.getItem('af_sec_ref') || ''; } catch (e) { return ''; } }
  function startBuy(id) {
    var p = findP(id); if (!p) return;
    if (!user()) { closeSheet(); login(); return; }
    var qEl = $('secQty'), qty = qEl ? Math.max(1, Math.min(20, parseInt(qEl.textContent, 10) || 1)) : 1;
    S.ck = { id: id, qty: qty, step: S.member ? 'confirm' : 'reg', name: (user().displayName || ''), phone: '', username: '', sponsor: ref(), parentUid: '', leg: '', nodes: null, invite: '', uOk: null };
    ckPaint();
  }
  function ckSummary() {
    var p = findP(S.ck.id); if (!p) return ''; var total = p.price * S.ck.qty, pv = pvOf(p) * S.ck.qty;
    return '<div class="sec-sum"><div><b>' + esc(p.title) + '</b><small>× ' + S.ck.qty + '</small></div><div class="r"><b>' + rwf(total) + '</b>' + (pv ? '<small>+' + pv + ' PV</small>' : '') + '</div></div>';
  }
  function payInfo(total) {
    return '<div class="sec-pay"><b>How to pay</b><ol><li>Send <b>' + rwf(total) + '</b> by Mobile Money to <b>' + esc(cfg.payTo || 'the Afrishine MoMo number (ask the admin)') + '</b>.</li><li>Take a screenshot of the payment and upload it on your order.</li><li>When the admin confirms, your PV and commissions are counted.</li><li>Collect your product at ' + esc(cfg.officeAddress || 'the Afrishine office') + '. Your order stays <i>Pending</i> until you pick it up.</li></ol></div>';
  }
  function ckPaint() {
    var c = S.ck; if (!c) return; var h = '<div class="sec-sh-h"><b>' + (c.step === 'done' ? 'Order placed' : 'Checkout') + '</b><button type="button" data-a="close">✕</button></div>';
    if (c.step === 'confirm') {
      var p = findP(c.id);
      h += ckSummary() + payInfo(p ? p.price * c.qty : 0) + '<button type="button" class="sec-btn gold" data-a="place" id="secPlace">Place order</button>';
    } else if (c.step === 'reg') {
      h += ckSummary() + '<p class="sec-hint">To join the Afrishine team with your first order, fill in your details. Your sponsor is the member who introduced you.</p>' +
        '<label>Full name<input id="ckName" value="' + esc(c.name) + '" maxlength="40" autocomplete="name"></label>' +
        '<label>Phone number<input id="ckPhone" value="' + esc(c.phone) + '" inputmode="tel" maxlength="20" placeholder="07…"></label>' +
        '<label>Choose your username<input id="ckUser" value="' + esc(c.username) + '" maxlength="20" autocapitalize="none" placeholder="e.g. alice_k"></label><div class="sec-uhint" id="ckUHint"></div>' +
        '<label>Your sponsor\'s username<input id="ckSponsor" value="' + esc(c.sponsor) + '" maxlength="20" autocapitalize="none" placeholder="username of who invited you"></label>' +
        '<button type="button" class="sec-btn gold" data-a="ckNext">Next: choose your position</button><button type="button" class="sec-link" data-a="ckInvite">I have an invite code</button>';
    } else if (c.step === 'invite') {
      h += ckSummary() + '<p class="sec-hint">Enter the invite code your sponsor gave you.</p><label>Invite code<input id="ckCode" value="' + esc(c.invite) + '" maxlength="12" autocapitalize="characters"></label>' +
        '<label>Full name<input id="ckName" value="' + esc(c.name) + '" maxlength="40"></label><label>Phone number<input id="ckPhone" value="' + esc(c.phone) + '" inputmode="tel" maxlength="20"></label>' +
        '<button type="button" class="sec-btn gold" data-a="place" id="secPlace">Place order</button><button type="button" class="sec-link" data-a="ckReg">Back</button>';
    } else if (c.step === 'pick') {
      h += '<p class="sec-hint">Pick the empty position (<b>Left</b> or <b>Right</b>) where you want to join. Positions are inside your sponsor\'s team.</p><div class="sec-tree-wrap">' + treeHtml(c.nodes || [], c.rootUid, 4, 'pick') + '</div><button type="button" class="sec-link" data-a="ckReg">Back</button>';
    } else if (c.step === 'review') {
      var p2 = findP(c.id);
      h += ckSummary() + '<div class="sec-place">You will join under <b>@' + esc(c.parentName) + '</b> on the <b>' + (c.leg === 'L' ? 'LEFT' : 'RIGHT') + '</b> side. Sponsor: <b>@' + esc(c.sponsor) + '</b></div>' + payInfo(p2 ? p2.price * c.qty : 0) +
        '<button type="button" class="sec-btn gold" data-a="place" id="secPlace">Confirm &amp; place order</button><button type="button" class="sec-link" data-a="ckPickBack">Choose another position</button>';
    } else if (c.step === 'done') {
      h += '<div class="sec-ok">✔ Your order is saved (pending payment).</div>' + payInfo(c.total) + proofBox(c.orderId) +
        '<button type="button" class="sec-btn" data-a="goOrders">See my orders</button>';
    }
    sheetBody(h);
  }
  function proofBox(orderId) {
    return '<div class="sec-proof"><b>Upload your payment screenshot</b><input type="file" id="proofFile" accept="image/*"><input id="proofRef" placeholder="Transaction ID (optional)" maxlength="60"><button type="button" class="sec-btn gold" data-a="proof" data-id="' + esc(orderId) + '">Upload screenshot</button><small>You can also do this later from Profile ⋮ → My Orders.</small></div>';
  }
  function readCk() {
    var c = S.ck; if (!c) return;
    ['ckName:name', 'ckPhone:phone', 'ckUser:username', 'ckSponsor:sponsor', 'ckCode:invite'].forEach(function (m) { var p = m.split(':'), e = $(p[0]); if (e) c[p[1]] = e.value.trim(); });
    c.username = String(c.username || '').toLowerCase(); c.sponsor = String(c.sponsor || '').toLowerCase().replace(/^@/, ''); c.invite = String(c.invite || '').toUpperCase();
  }
  var checkTimer = null;
  function checkUser(v) {
    var h = $('ckUHint'); if (!h) return;
    v = String(v || '').toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(v)) { h.className = 'sec-uhint bad'; h.textContent = v ? '3 to 20 letters, numbers or _' : ''; return; }
    h.className = 'sec-uhint'; h.textContent = 'Checking…';
    clearTimeout(checkTimer); checkTimer = setTimeout(function () {
      ask('check', { username: v }).then(function (r) { var e = $('ckUHint'); if (!e) return; e.className = 'sec-uhint ' + (r.available ? 'good' : 'bad'); e.textContent = r.available ? '✔ Username is free' : '✖ That username is taken. Use another one.'; }).catch(function () { var e = $('ckUHint'); if (e) e.textContent = ''; });
    }, 450);
  }
  function ckNext() {
    readCk(); var c = S.ck;
    if (c.name.length < 2) return say('Please write your full name.');
    if (c.phone.replace(/\D/g, '').length < 9) return say('Please write your phone number.');
    if (!/^[a-z0-9_]{3,20}$/.test(c.username)) return say('Username must be 3 to 20 letters, numbers or _ (no spaces).');
    if (!c.sponsor) return say('Write the username of the member who introduced you.');
    var b = $('secOv') && document.querySelector('#secOv [data-a="ckNext"]'); if (b) { b.disabled = true; b.textContent = 'Loading…'; }
    ask('check', { username: c.username }).then(function (r) {
      if (!r.available) throw new Error('That username is already taken. Please choose another.');
      return ask('tree', { sponsor: c.sponsor });
    }).then(function (t) { c.nodes = t.nodes; c.rootUid = t.sponsor.uid; c.sponsorName = t.sponsor.username; c.step = 'pick'; ckPaint(); })
      .catch(function (e) { say(e.message); ckPaint(); });
  }
  function placeOrder() {
    readCk(); var c = S.ck, body = { items: [{ id: c.id, qty: c.qty }] };
    if (!S.member) {
      body.name = c.name; body.phone = c.phone;
      if (c.step === 'invite') { if (!c.invite) return say('Enter the invite code.'); body.inviteCode = c.invite; }
      else { body.username = c.username; body.sponsor = c.sponsor; body.parentUid = c.parentUid; body.leg = c.leg; }
    }
    var b = $('secPlace'); if (b) { b.disabled = true; b.textContent = 'Placing order…'; }
    ask('order', body).then(function (r) { c.orderId = r.orderId; c.total = r.total; c.step = 'done'; S.orders = null; ckPaint(); })
      .catch(function (e) { say(e.message); if (b) { b.disabled = false; b.textContent = 'Place order'; } });
  }

  /* ---------- screenshot upload ---------- */
  function compress(file) {
    if (!window.createImageBitmap) return Promise.resolve(file);
    return createImageBitmap(file).then(function (bm) {
      var s = Math.min(1, 1280 / Math.max(bm.width, bm.height)), c = document.createElement('canvas'); c.width = Math.round(bm.width * s); c.height = Math.round(bm.height * s);
      c.getContext('2d').drawImage(bm, 0, 0, c.width, c.height);
      return new Promise(function (res) { c.toBlob(function (b) { res(b || file); }, 'image/jpeg', 0.82); });
    }).catch(function () { return file; });
  }
  function uploadImage(file) {
    var u = user(); if (!u) return Promise.reject(new Error('Please sign in first.'));
    return compress(file).then(function (blob) {
      return u.getIdToken().then(function (t) { return fetch(MEDIA + '/upload?filename=' + encodeURIComponent('sec-' + Date.now() + '.jpg'), { method: 'POST', headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'image/jpeg' }, body: blob }); });
    }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok || !d.success || !d.url) throw new Error(d.error || 'Photo upload failed'); return d.url; }); });
  }
  function sendProof(orderId, btn) {
    var f = $('proofFile') && $('proofFile').files[0]; if (!f) return say('Choose the payment screenshot first.');
    btn.disabled = true; btn.textContent = 'Uploading…';
    uploadImage(f).then(function (url) { return ask('proof', { orderId: orderId, url: url, ref: ($('proofRef') || {}).value || '' }); })
      .then(function () { say('Screenshot uploaded. The admin will confirm your payment.'); S.orders = null; closeSheet(); if (S.view === 'profile' && S.sub === 'orders') profilePaint($('secBody')); })
      .catch(function (e) { say(e.message); btn.disabled = false; btn.textContent = 'Upload screenshot'; });
  }

  /* ---------- BINARY TREE ---------- */
  // nodes: [{uid, username, name, photo, leftUid, rightUid, leftPv, rightPv, status}]
  function treeHtml(nodes, rootUid, maxD, mode) {
    var map = {}; nodes.forEach(function (n) { map[n.uid] = n; });
    if (!map[rootUid]) return '<div class="sec-empty">No team to show yet.</div>';
    function slot(parent, leg) {
      var raw = leg === 'L' ? parent.leftUid : parent.rightUid;
      if (raw && String(raw).indexOf('invite:') === 0) return '<div class="tn"><div class="tbox res"><i>⏳</i><b>Reserved</b></div></div>';
      if (raw) return '<div class="tn"><div class="tbox more"><i>•••</i></div></div>';
      if (mode === 'pick' || mode === 'add') return '<div class="tn"><button type="button" class="tbox add" data-a="slot" data-p="' + esc(parent.uid) + '" data-l="' + leg + '" data-n="' + esc(parent.username) + '"><i>+</i><b>' + (leg === 'L' ? 'Left' : 'Right') + '</b></button></div>';
      return '<div class="tn"><div class="tbox empty"><i>+</i><b>' + (leg === 'L' ? 'Left' : 'Right') + '</b></div></div>';
    }
    function node(uid, d) {
      var n = map[uid]; if (!n) return '';
      var kids = '';
      if (d < maxD) {
        kids = '<div class="tk">' + (n.leftUid && map[n.leftUid] ? node(n.leftUid, d + 1) : slot(n, 'L')) + (n.rightUid && map[n.rightUid] ? node(n.rightUid, d + 1) : slot(n, 'R')) + '</div>';
      }
      var pend = n.status === 'pending';
      return '<div class="tn"><button type="button" class="tbox' + (pend ? ' pend' : '') + '" data-a="node" data-id="' + esc(n.uid) + '">' + avatar(n.name || n.username, n.photo, 'sm') + '<b>' + esc(String(n.name || n.username).split(' ')[0]) + '</b><small>@' + esc(n.username) + '</small><em>L ' + (n.leftPv || 0) + ' · R ' + (n.rightPv || 0) + '</em></button>' + kids + '</div>';
    }
    return '<div class="sec-tree">' + node(rootUid, 1) + '</div>';
  }
  function placeAt(p, l, name) {
    var c = S.ck; if (!c) return;
    c.parentUid = p; c.leg = l; c.parentName = name; c.step = 'review'; ckPaint();
  }

  /* ---------- PROFILE / DASHBOARD ---------- */
  function profilePaint(el) {
    var u = user(), m = S.member;
    if (!u) { setTitle('Profile', false); el.innerHTML = '<div class="sec-card0 center"><div class="sec-big">🔐</div><b>Sign in to see your profile</b><p>Sign in, then join the team with your first order.</p><button type="button" class="sec-btn gold" data-a="login">Sign in</button></div>'; return; }
    if (!m) { setTitle('Profile', false); el.innerHTML = '<div class="sec-card0 center"><div class="sec-big">🛡️</div><b>You have not joined yet</b><p>Place your first order and enter the username of the member who introduced you. You will then get your own username, wallet and team.</p><button type="button" class="sec-btn gold" data-a="nav" data-v="home">Browse products</button><button type="button" class="sec-btn" data-a="ordersOnly">My orders</button></div>'; if (S.sub === 'orders') ordersPaint(el); return; }
    var subs = { wallet: walletPaint, network: networkPaint, orders: ordersPaint, withdraw: withdrawPaint, invite: invitePaint, settings: settingsPaint, disclaimer: disclaimerPaint };
    if (S.sub && subs[S.sub]) { setTitle({ wallet: 'My Wallet', network: 'My Network', orders: 'My Orders', withdraw: 'Withdraw', invite: 'Register New Member', settings: 'Settings', disclaimer: 'Income Disclaimer' }[S.sub], false); subs[S.sub](el); return; }
    setTitle(m.name || 'Profile', true);
    var carry = (m.leftBal || 0) + (m.rightBal || 0), link = location.origin + '/solution?ref=' + encodeURIComponent(m.username);
    el.innerHTML = '<div class="sec-prof"><div class="sec-prof-top">' + avatar(m.name, m.photo || (u && u.photoURL), 'lg') + '<div><b>' + esc(m.name) + '</b><span>@' + esc(m.username) + '</span><em class="sec-stat ' + (m.status === 'active' ? 'on' : '') + '">' + (m.status === 'active' ? '● Active member' : '● Pending — waiting for payment confirmation') + '</em></div></div>' +
      '<p class="sec-hint">Sponsor: @' + esc(m.sponsorUsername || '-') + '</p></div>' +
      '<h3 class="sec-h">Wallet</h3><div class="sec-stats"><div class="sec-st"><small>Total Earned</small><b>' + rwf(m.earnedTotal) + '</b></div><div class="sec-st"><small>Total Withdrawn</small><b>' + rwf(m.withdrawn) + '</b></div><div class="sec-st hi"><small>Available Balance</small><b>' + rwf(m.balance) + '</b></div></div>' +
      '<button type="button" class="sec-btn gold" data-a="sub" data-v="withdraw">Withdraw</button>' +
      '<h3 class="sec-h">PV (points)</h3><div class="sec-stats four"><div class="sec-st"><small>Left PV</small><b>' + (m.leftPv || 0) + '</b></div><div class="sec-st"><small>Right PV</small><b>' + (m.rightPv || 0) + '</b></div><div class="sec-st"><small>Matched PV</small><b>' + (m.matchedPv || 0) + '</b></div><div class="sec-st"><small>Carry Forward</small><b>' + carry + '</b></div></div>' +
      '<h3 class="sec-h">Earnings</h3><div class="sec-stats four"><div class="sec-st"><small>Referral L1 (' + cfg.ref1 + '%)</small><b>' + rwf(m.refL1) + '</b></div><div class="sec-st"><small>Referral L2 (' + cfg.ref2 + '%)</small><b>' + rwf(m.refL2) + '</b></div><div class="sec-st"><small>Referral L3 (' + cfg.ref3 + '%)</small><b>' + rwf(m.refL3) + '</b></div><div class="sec-st"><small>Matching bonus (' + cfg.matchPct + '%)</small><b>' + rwf(m.matchEarned) + '</b></div></div>' +
      '<h3 class="sec-h">Your link</h3><div class="sec-link-box"><input readonly value="' + esc(link) + '" onclick="this.select()"><button type="button" class="sec-btn gold" data-a="shareLink">Share</button></div>' +
      '<div class="sec-quick"><button type="button" data-a="sub" data-v="network">🌳 My Network</button><button type="button" data-a="sub" data-v="wallet">💰 My Wallet</button><button type="button" data-a="sub" data-v="orders">📦 My Orders</button><button type="button" data-a="sub" data-v="invite">➕ Register member</button></div>' +
      '<p class="sec-disc">Commissions come only from real product purchases, not from recruiting alone. Earnings are not guaranteed and depend on sales. <a href="#" data-a="sub" data-v="disclaimer">Read the income disclaimer</a></p>';
  }
  function menu() {
    var m = S.member; if (!m) return;
    var items = [['wallet', '💰 My Wallet'], ['network', '🌳 My Network'], ['orders', '📦 My Orders'], ['withdraw', '🏧 Withdraw'], ['invite', '➕ Register New Member'], ['settings', '⚙️ Settings (password)'], ['disclaimer', 'ℹ️ Income Disclaimer']];
    sheet('<div class="sec-sh-h"><b>Menu</b><button type="button" data-a="close">✕</button></div>' + items.map(function (i) { return '<button type="button" class="sec-menu-i" data-a="sub" data-v="' + i[0] + '">' + i[1] + '</button>'; }).join(''));
  }
  function loadLedger() {
    if (S.ledger) return Promise.resolve(S.ledger);
    return dbx().collection('secLedger').where('uid', '==', user().uid).limit(300).get().then(function (s) { var a = []; s.forEach(function (d) { var x = d.data(); x.id = d.id; a.push(x); }); a.sort(function (p, q) { return ms(q.createdAt) - ms(p.createdAt); }); S.ledger = a; return a; });
  }
  function walletPaint(el) {
    var m = S.member; el.innerHTML = '<div class="sec-stats"><div class="sec-st"><small>Total Earned</small><b>' + rwf(m.earnedTotal) + '</b></div><div class="sec-st"><small>Withdrawn</small><b>' + rwf(m.withdrawn) + '</b></div><div class="sec-st hi"><small>Available</small><b>' + rwf(m.balance) + '</b></div></div>' +
      '<div class="sec-filters"><select id="ledType"><option value="all">All</option><option value="ref">Referral</option><option value="match">Matching bonus</option><option value="pv">PV</option><option value="withdraw">Withdrawals</option></select><input type="date" id="ledFrom"><input type="date" id="ledTo"></div><div id="ledList"><div class="sec-empty">Loading…</div></div>';
    $('ledType').value = S.led.type; $('ledFrom').value = S.led.from; $('ledTo').value = S.led.to;
    loadLedger().then(ledgerList).catch(function () { var l = $('ledList'); if (l) l.innerHTML = '<div class="sec-empty">Could not load your history.</div>'; });
  }
  function ledgerList() {
    var l = $('ledList'); if (!l) return; var f = S.led, from = f.from ? new Date(f.from + 'T00:00:00').getTime() : 0, to = f.to ? new Date(f.to + 'T23:59:59').getTime() : 9e15;
    var rows = (S.ledger || []).filter(function (x) { if (x.type === 'order' || x.type === 'decision') return false; if (f.type !== 'all' && x.type !== f.type && !(f.type === 'withdraw' && x.type === 'refund')) return false; var t = ms(x.createdAt); return t >= from && t <= to; });
    var names = { ref: 'Referral commission', match: 'Matching bonus', pv: 'PV added', withdraw: 'Withdrawal request', refund: 'Withdrawal returned' };
    l.innerHTML = rows.length ? rows.map(function (x) {
      var amt = x.type === 'pv' ? '+' + x.pv + ' PV (' + (x.leg === 'L' ? 'Left' : 'Right') + ')' : (x.amount > 0 ? '+' : '') + rwf(x.amount);
      var sub = x.type === 'ref' ? 'Level ' + x.level + ' · from @' + esc(x.fromName || '') : x.type === 'match' ? x.pv + ' PV matched' + (x.capped ? ' (daily cap)' : '') : x.type === 'pv' ? 'from @' + esc(x.fromName || '') : '';
      return '<div class="sec-row"><div><b>' + esc(names[x.type] || x.type) + '</b><small>' + esc(sub) + ' ' + when(x.createdAt) + '</small></div><div class="r ' + (x.amount < 0 ? 'neg' : 'pos') + '">' + amt + '</div></div>';
    }).join('') : '<div class="sec-empty">No transactions yet.</div>';
  }
  function networkPaint(el) {
    var m = S.member, root = S.netRoot || user().uid;
    el.innerHTML = '<div class="sec-empty">Loading your team…</div>';
    var p = S.net ? Promise.resolve(S.net) : dbx().collection('secMembers').where('ancestors', 'array-contains', user().uid).limit(500).get().then(function (s) { var a = [m]; s.forEach(function (d) { a.push(d.data()); }); S.net = a; return a; });
    p.then(function (nodes) {
      var map = {}; nodes.forEach(function (n) { map[n.uid] = n; });
      var lv = [], cur = [user().uid], left = 0, right = 0, seen = 0;
      function count(uid) { var n = map[uid]; if (!n) return 0; return 1 + count(n.leftUid) + count(n.rightUid); }
      left = map[user().uid] && map[user().uid].leftUid ? count(map[user().uid].leftUid) : 0; right = map[user().uid] && map[user().uid].rightUid ? count(map[user().uid].rightUid) : 0;
      for (var d = 1; d <= 6 && cur.length; d++) { var nx = []; cur.forEach(function (u) { var n = map[u]; if (!n) return;[n.leftUid, n.rightUid].forEach(function (c) { if (c && map[c]) nx.push(c); }); }); if (nx.length) lv.push(nx.length); cur = nx; }
      el.innerHTML = '<div class="sec-stats"><div class="sec-st"><small>Left team</small><b>' + left + '</b></div><div class="sec-st"><small>Right team</small><b>' + right + '</b></div><div class="sec-st hi"><small>Total team</small><b>' + (left + right) + '</b></div></div>' +
        '<div class="sec-lv">' + (lv.length ? lv.map(function (n, i) { return '<span>Level ' + (i + 1) + ': <b>' + n + '</b></span>'; }).join('') : '<span>No team members yet</span>') + '</div>' +
        (root !== user().uid ? '<button type="button" class="sec-link" data-a="netRoot" data-id="">⌂ Back to me</button>' : '') +
        '<div class="sec-tree-wrap">' + treeHtml(nodes, root, 3, 'add') + '</div><p class="sec-hint">Tap a person to see details. Tap <b>+ Left</b> / <b>+ Right</b> to register a new member there.</p>';
    }).catch(function () { el.innerHTML = '<div class="sec-empty">Could not load your team.</div>'; });
  }
  function nodeSheet(uid) {
    var n = null; (S.net || (S.ck && S.ck.nodes) || []).forEach(function (x) { if (x.uid === uid) n = x; }); if (!n) return;
    sheet('<div class="sec-sh-h"><b>' + esc(n.name) + '</b><button type="button" data-a="close">✕</button></div><div class="sec-prof-top">' + avatar(n.name, n.photo, 'lg') + '<div><b>@' + esc(n.username) + '</b><span>' + (n.status === 'active' ? 'Active' : 'Pending') + '</span></div></div>' +
      '<div class="sec-stats four"><div class="sec-st"><small>Left PV</small><b>' + (n.leftPv || 0) + '</b></div><div class="sec-st"><small>Right PV</small><b>' + (n.rightPv || 0) + '</b></div><div class="sec-st"><small>Sponsor</small><b>@' + esc(n.sponsorUsername || '-') + '</b></div><div class="sec-st"><small>Joined</small><b>' + esc((when(n.createdAt) || '').split(' ')[0]) + '</b></div></div>' +
      (S.net ? '<button type="button" class="sec-btn" data-a="netRoot" data-id="' + esc(n.uid) + '">View team under this person</button>' : ''));
  }
  function ordersPaint(el) {
    el.innerHTML = '<div class="sec-empty">Loading orders…</div>';
    var p = S.orders ? Promise.resolve(S.orders) : dbx().collection('secOrders').where('uid', '==', user().uid).limit(100).get().then(function (s) { var a = []; s.forEach(function (d) { var x = d.data(); x.id = d.id; a.push(x); }); a.sort(function (x, y) { return ms(y.createdAt) - ms(x.createdAt); }); S.orders = a; return a; });
    p.then(function (rows) {
      if (!rows.length) { el.innerHTML = '<div class="sec-empty">You have no orders yet.</div>'; return; }
      el.innerHTML = rows.map(function (o) {
        var pay = { awaiting: ['Pending payment', 'warn'], uploaded: ['Payment uploaded — waiting for confirmation', 'info'], confirmed: ['Payment confirmed ✔', 'good'], rejected: ['Rejected', 'bad'] }[o.payStatus] || ['', ''];
        var pick = o.payStatus === 'confirmed' ? (o.pickStatus === 'picked' ? '<span class="sec-pill good">Picked up ✔</span>' : '<span class="sec-pill warn">Pending pickup at the office</span>') : '';
        return '<div class="sec-order"><div class="top"><b>' + (o.items || []).map(function (i) { return esc(i.title) + ' ×' + i.qty; }).join(', ') + '</b><small>' + when(o.createdAt) + '</small></div><div class="mid"><b>' + rwf(o.total) + '</b>' + (o.pv ? ' · +' + o.pv + ' PV' : '') + '</div><div class="pills"><span class="sec-pill ' + pay[1] + '">' + pay[0] + '</span>' + pick + '</div>' +
          (o.payStatus === 'rejected' && o.rejectReason ? '<small>' + esc(o.rejectReason) + '</small>' : '') +
          ((o.payStatus === 'awaiting' || o.payStatus === 'uploaded') ? '<button type="button" class="sec-btn" data-a="proofOpen" data-id="' + esc(o.id) + '" data-t="' + o.total + '">' + (o.payStatus === 'uploaded' ? 'Replace screenshot' : 'Upload payment screenshot') + '</button>' : '') + '</div>';
      }).join('');
    }).catch(function () { el.innerHTML = '<div class="sec-empty">Could not load orders.</div>'; });
  }
  function withdrawPaint(el) {
    var m = S.member;
    el.innerHTML = '<div class="sec-stats"><div class="sec-st hi"><small>Available</small><b>' + rwf(m.balance) + '</b></div><div class="sec-st"><small>Pending</small><b>' + rwf(m.pendingWd) + '</b></div><div class="sec-st"><small>Minimum</small><b>' + rwf(cfg.minWithdraw) + '</b></div></div>' +
      '<div class="sec-form"><label>Amount (RWF)<input id="wdAmt" type="number" inputmode="numeric" min="' + cfg.minWithdraw + '" placeholder="e.g. 20000"></label><label>MoMo number to receive the money<input id="wdPhone" inputmode="tel" maxlength="20" value="' + esc(m.phone || '') + '"></label><button type="button" class="sec-btn gold" data-a="wdGo">Request withdrawal</button></div><h3 class="sec-h">History</h3><div id="wdList"><div class="sec-empty">Loading…</div></div>';
    dbx().collection('secWithdrawals').where('uid', '==', user().uid).limit(100).get().then(function (s) {
      var a = []; s.forEach(function (d) { var x = d.data(); x.id = d.id; a.push(x); }); a.sort(function (x, y) { return ms(y.createdAt) - ms(x.createdAt); });
      var l = $('wdList'); if (!l) return;
      l.innerHTML = a.length ? a.map(function (w) { return '<div class="sec-row"><div><b>' + rwf(w.amount) + '</b><small>' + esc(w.phone) + ' · ' + when(w.createdAt) + '</small></div><div class="r"><span class="sec-pill ' + ({ pending: 'warn', paid: 'good', rejected: 'bad' }[w.status] || '') + '">' + ({ pending: 'Pending', paid: 'Paid', rejected: 'Rejected' }[w.status] || w.status) + '</span></div></div>'; }).join('') : '<div class="sec-empty">No withdrawals yet.</div>';
    }).catch(function () { });
  }
  function invitePaint(el) {
    var m = S.member;
    if (m.status !== 'active') { el.innerHTML = '<div class="sec-empty">You can register new members after your first payment is confirmed.</div>'; return; }
    S.inv = S.inv || { parentUid: '', leg: '', parentName: '' };
    el.innerHTML = '<p class="sec-hint">Register a new member with their details. Choose a free position in your team, then give them the invite code. They sign in, enter the code with their first order, and pay.</p>' +
      '<div class="sec-form"><label>Full name<input id="ivName" maxlength="40"></label><label>Phone number<input id="ivPhone" inputmode="tel" maxlength="20"></label><label>Username for the new member<input id="ivUser" maxlength="20" autocapitalize="none"></label><div class="sec-uhint" id="ckUHint"></div>' +
      '<div class="sec-place" id="ivPlace">' + (S.inv.parentUid ? 'Position: under <b>@' + esc(S.inv.parentName) + '</b> · <b>' + (S.inv.leg === 'L' ? 'LEFT' : 'RIGHT') + '</b>' : 'Choose a position below (tap + Left / + Right).') + '</div>' +
      '<div id="ivTree" class="sec-tree-wrap"><div class="sec-empty">Loading…</div></div><button type="button" class="sec-btn gold" data-a="ivGo">Create invite code</button></div><div id="ivOut"></div>';
    ask('myTree').then(function (r) { S.net = null; S.invNodes = r.nodes; var t = $('ivTree'); if (t) t.innerHTML = treeHtml(r.nodes, user().uid, 4, 'pick'); }).catch(function (e) { var t = $('ivTree'); if (t) t.innerHTML = '<div class="sec-empty">' + esc(e.message) + '</div>'; });
  }
  function settingsPaint(el) {
    var u = user(), hasPw = u && u.providerData && u.providerData.some(function (p) { return p.providerId === 'password'; });
    el.innerHTML = hasPw ?
      '<div class="sec-form"><h3 class="sec-h">Change password</h3><label>Current password<input id="pwOld" type="password" autocomplete="current-password"></label><label>New password (min 6 characters)<input id="pwNew" type="password" autocomplete="new-password"></label><label>Repeat new password<input id="pwNew2" type="password" autocomplete="new-password"></label><button type="button" class="sec-btn gold" data-a="pwGo">Change password</button><button type="button" class="sec-link" data-a="pwReset">Email me a reset link instead</button></div>' :
      '<div class="sec-card0"><b>You sign in with Google</b><p>Your password is managed by your Google account, so there is nothing to change here.</p></div>';
  }
  function disclaimerPaint(el) {
    el.innerHTML = '<div class="sec-card0"><b>Income disclaimer</b><p>Afrishine Security Solutions pays commissions only on real product purchases that were paid and confirmed. You do not earn anything simply by inviting people.</p><p>Earnings are <b>not guaranteed</b>. How much you earn depends on actual sales made by you and your team. Most members should expect to earn little or nothing, and you should never buy products you do not want or cannot afford because of the possibility of commission.</p><p>PV points, matching bonuses and commissions can be changed by Afrishine with notice, and are paid only after payment is confirmed by the admin. Withdrawals are paid by Mobile Money after review.</p><p>Buy the products because you value them. Never pay anyone for the right to recruit.</p></div>';
  }

  /* ---------- TEAM CHAT ---------- */
  function chatPaint(el) {
    var u = user(), m = S.member;
    if (!u) { el.innerHTML = '<div class="sec-card0 center"><div class="sec-big">💬</div><b>Team chat</b><p>Sign in to chat with your upline and downline.</p><button type="button" class="sec-btn gold" data-a="login">Sign in</button></div>'; return; }
    if (!m || m.status !== 'active') { el.innerHTML = '<div class="sec-card0 center"><div class="sec-big">💬</div><b>Team chat</b><p>' + (m ? 'Team chat opens once your first payment is confirmed.' : 'Join the team with your first order to chat with your upline and downline.') + '</p></div>'; return; }
    var room = S.chatTab === 'up' && m.sponsorUid ? m.sponsorUid : u.uid;
    el.innerHTML = '<div class="sec-tabs"><button type="button" data-a="chatTab" data-v="mine" class="' + (S.chatTab === 'mine' ? 'on' : '') + '">My Team</button>' + (m.sponsorUid ? '<button type="button" data-a="chatTab" data-v="up" class="' + (S.chatTab === 'up' ? 'on' : '') + '">@' + esc(m.sponsorUsername) + '\'s Team</button>' : '') + '</div>' +
      '<p class="sec-hint">' + (room === u.uid ? 'Everyone in your downline can write here. Share ideas on how to grow your team.' : 'Your sponsor and everyone in their team.') + '</p>' +
      '<div class="sec-msgs" id="secMsgs"><div class="sec-empty">Loading…</div></div><div class="sec-compose"><input id="secChatInput" maxlength="1000" placeholder="Write a message…" autocomplete="off"><button type="button" class="sec-btn gold" data-a="chatSend">Send</button></div>';
    if (S.unsubChat) { try { S.unsubChat(); } catch (e) { } }
    S.chatRoom = room;
    S.unsubChat = dbx().collection('secChats').doc(room).collection('messages').orderBy('createdAt', 'desc').limit(100).onSnapshot(function (s) {
      var a = []; s.forEach(function (d) { a.push(d.data()); }); a.reverse();
      var box = $('secMsgs'); if (!box) return;
      box.innerHTML = a.length ? a.map(function (x) { var mine = x.uid === u.uid; return '<div class="sec-msg ' + (mine ? 'me' : '') + '">' + (mine ? '' : avatar(x.name, x.photo, 'sm')) + '<div class="b"><small>' + (mine ? 'You' : esc(x.name)) + ' · ' + when(x.createdAt) + '</small><p>' + esc(x.text).replace(/\n/g, '<br>') + '</p></div></div>'; }).join('') : '<div class="sec-empty">No messages yet. Say hello 👋</div>';
      box.scrollTop = box.scrollHeight;
    }, function () { var box = $('secMsgs'); if (box) box.innerHTML = '<div class="sec-empty">Could not open this chat.</div>'; });
  }
  function sendChat() {
    var i = $('secChatInput'), t = i && i.value.trim(), m = S.member; if (!t || !m) return;
    i.value = '';
    dbx().collection('secChats').doc(S.chatRoom).collection('messages').add({ uid: user().uid, name: String(m.name || m.username).slice(0, 60), photo: String(m.photo || user().photoURL || '').slice(0, 400), text: t.slice(0, 1000), createdAt: firebase.firestore.FieldValue.serverTimestamp() }).catch(function () { say('Could not send. Please try again.'); });
  }

  /* ---------- events ---------- */
  function onInput(e) {
    var t = e.target; if (!t) return;
    if (t.id === 'secSearch') { S.q = t.value; var g = document.querySelector('#secshop .sec-grid'); var pos = t.selectionStart; paintBody(); var n = $('secSearch'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (x) { } } }
    if (t.id === 'ckUser' || t.id === 'ivUser') checkUser(t.value);
  }
  function onChange(e) {
    var t = e.target; if (!t) return;
    if (t.id === 'ledType') { S.led.type = t.value; ledgerList(); } else if (t.id === 'ledFrom') { S.led.from = t.value; ledgerList(); } else if (t.id === 'ledTo') { S.led.to = t.value; ledgerList(); }
  }
  function onClick(e) {
    var b = e.target.closest ? e.target.closest('[data-a]') : null; if (!b) return;
    var a = b.getAttribute('data-a'), id = b.getAttribute('data-id'), v = b.getAttribute('data-v');
    if (a === 'save' || a === 'share' || (a === 'buy' && b.closest('.sec-card'))) e.stopPropagation();
    switch (a) {
      case 'back':
        if (S.sub) { S.sub = ''; S.netRoot = ''; go('profile'); } else if (S.view !== 'home') go('home'); else if (typeof showPage === 'function') showPage('shop');
        break;
      case 'nav': closeSheet(); S.netRoot = ''; go(v); break;
      case 'menu': menu(); break;
      case 'sub': e.preventDefault(); closeSheet(); S.sub = v; if (v === 'network') S.net = null; if (v === 'wallet') S.ledger = null; if (v === 'orders') S.orders = null; S.view = 'profile'; paintBody(); paintNav(); window.scrollTo(0, 0); break;
      case 'close': closeSheet(); break;
      case 'cat': S.cat = v; paintBody(); break;
      case 'cond': S.cond = v; paintBody(); break;
      case 'open': openProduct(id); break;
      case 'save': var i = S.saved.indexOf(id); if (i >= 0) S.saved.splice(i, 1); else S.saved.push(id); try { localStorage.setItem('af_sec_saved', JSON.stringify(S.saved)); } catch (x) { } b.textContent = S.saved.indexOf(id) >= 0 ? '♥' : '♡'; break;
      case 'share': shareProduct(id); break;
      case 'qty': var q = $('secQty'); if (q) q.textContent = Math.max(1, Math.min(20, (parseInt(q.textContent, 10) || 1) + Number(v))); break;
      case 'buy': startBuy(id); break;
      case 'login': login(); break;
      case 'ckNext': ckNext(); break;
      case 'ckInvite': readCk(); S.ck.step = 'invite'; ckPaint(); break;
      case 'ckReg': readCk(); S.ck.step = 'reg'; ckPaint(); break;
      case 'ckPickBack': S.ck.step = 'pick'; ckPaint(); break;
      case 'slot':
        if (S.ck && S.ck.step === 'pick') placeAt(b.getAttribute('data-p'), b.getAttribute('data-l'), b.getAttribute('data-n'));
        else if (S.sub === 'invite' || $('ivTree')) { S.inv = { parentUid: b.getAttribute('data-p'), leg: b.getAttribute('data-l'), parentName: b.getAttribute('data-n') }; var pl = $('ivPlace'); if (pl) pl.innerHTML = 'Position: under <b>@' + esc(S.inv.parentName) + '</b> · <b>' + (S.inv.leg === 'L' ? 'LEFT' : 'RIGHT') + '</b>'; }
        else { S.inv = { parentUid: b.getAttribute('data-p'), leg: b.getAttribute('data-l'), parentName: b.getAttribute('data-n') }; S.sub = 'invite'; paintBody(); }
        break;
      case 'place': placeOrder(); break;
      case 'proof': sendProof(id, b); break;
      case 'proofOpen': sheet('<div class="sec-sh-h"><b>Payment screenshot</b><button type="button" data-a="close">✕</button></div>' + payInfo(Number(b.getAttribute('data-t'))) + proofBox(id)); break;
      case 'goOrders': closeSheet(); S.view = 'profile'; S.sub = 'orders'; S.orders = null; paintBody(); paintNav(); break;
      case 'ordersOnly': S.sub = 'orders'; paintBody(); break;
      case 'node': nodeSheet(id); break;
      case 'netRoot': closeSheet(); S.netRoot = id || ''; paintBody(); break;
      case 'chatTab': S.chatTab = v; paintBody(); break;
      case 'chatSend': sendChat(); break;
      case 'wdGo':
        b.disabled = true; ask('withdraw', { amount: Number($('wdAmt').value), phone: $('wdPhone').value }).then(function () { say('Withdrawal requested. The admin will pay it to your MoMo.'); S.ledger = null; paintBody(); }).catch(function (er) { say(er.message); b.disabled = false; }); break;
      case 'ivGo':
        if (!S.inv || !S.inv.parentUid) return say('Choose a position in the tree first.');
        b.disabled = true; ask('invite', { name: $('ivName').value, phone: $('ivPhone').value, username: $('ivUser').value.toLowerCase(), parentUid: S.inv.parentUid, leg: S.inv.leg }).then(function (r) {
          S.net = null; S.inv = null; $('ivOut').innerHTML = '<div class="sec-ok">✔ Invite created. Give this code to the new member:<div class="sec-code">' + esc(r.code) + '</div><small>They sign in, open Security Solutions, choose a product, tap “I have an invite code”, and pay for their first order.</small></div>'; b.style.display = 'none';
        }).catch(function (er) { say(er.message); b.disabled = false; }); break;
      case 'shareLink':
        var link = location.origin + '/solution?ref=' + encodeURIComponent(S.member.username), txt = 'Join me on Afrishine Security Solutions: ' + link;
        if (navigator.share) navigator.share({ title: 'Afrishine Security Solutions', text: txt, url: link }).catch(function () { }); else if (navigator.clipboard) navigator.clipboard.writeText(link).then(function () { say('Link copied.'); }); break;
      case 'pwGo':
        var o = $('pwOld').value, n1 = $('pwNew').value, n2 = $('pwNew2').value;
        if (n1.length < 6) return say('The new password must have at least 6 characters.'); if (n1 !== n2) return say('The two new passwords are not the same.');
        var us = user(), cred = firebase.auth.EmailAuthProvider.credential(us.email, o);
        us.reauthenticateWithCredential(cred).then(function () { return us.updatePassword(n1); }).then(function () { say('Password changed.'); $('pwOld').value = $('pwNew').value = $('pwNew2').value = ''; }).catch(function () { say('Could not change the password. Check your current password.'); }); break;
      case 'pwReset': auth.sendPasswordResetEmail(user().email).then(function () { say('Reset link sent to ' + user().email); }).catch(function () { say('Could not send the email.'); }); break;
    }
  }
  function shareProduct(id) {
    var p = findP(id); if (!p) return; var link = location.origin + '/solution?p=' + encodeURIComponent(id) + (S.member ? '&ref=' + encodeURIComponent(S.member.username) : '');
    var data = { title: p.title, text: p.title + ' — ' + rwf(p.price), url: link };
    if (navigator.share) navigator.share(data).catch(function () { }); else if (navigator.clipboard) navigator.clipboard.writeText(link).then(function () { say('Link copied.'); });
  }

  /* ---------- opening ---------- */
  function welcome() {
    var seen = false; try { seen = sessionStorage.getItem('af_sec_welcome') === '1'; } catch (e) { }
    if (seen) return;
    try { sessionStorage.setItem('af_sec_welcome', '1'); } catch (e) { }
    sheet('<div class="sec-welcome"><div class="sec-big">🛡️</div><h2>Welcome to<br>Afrishine Security Solutions</h2><p>Quality security and electronics, paid by Mobile Money and collected at our office.</p><button type="button" class="sec-btn gold" data-a="close">Start shopping</button></div>');
  }
  window.afSecOpen = function () {
    ensurePage(); loadCfg().then(function () { if (active()) paintBody(); });
    if (typeof showPage === 'function') showPage('secshop');
    S.view = 'home'; S.sub = ''; paintBody(); paintNav();
    if (!S.loaded) loadProducts().then(function () { if (active() && S.view === 'home') paintBody(); }); else loadProducts().then(function () { if (active() && S.view === 'home') paintBody(); });
    welcome();
  };
  function hookShowPage() {
    var prev = window.showPage; if (typeof prev !== 'function' || prev.__sec) return;
    window.showPage = function (id) {
      prev.apply(this, arguments);
      document.body.classList.toggle('sec-on', id === 'secshop');
      if (id === 'secshop' && window.history && history.replaceState) { try { history.replaceState(null, '', '/solution' + (location.search || '')); } catch (e) { } }
      if (id !== 'secshop') { closeSheet(); if (S.unsubChat) { try { S.unsubChat(); } catch (e) { } S.unsubChat = null; } }
    };
    window.showPage.__sec = true;
  }
  function init() {
    hookShowPage();
    try {
      var q = new URLSearchParams(location.search), r = q.get('ref');
      if (r) { try { localStorage.setItem('af_sec_ref', r.toLowerCase().slice(0, 20)); } catch (e) { } }
      if (q.get('sec') === '1' || /^\/solution\/?$/.test(location.pathname)) { setTimeout(function () { window.afSecOpen(); var p = q.get('p'); if (p) loadProducts().then(function () { openProduct(p); }); }, 700); }
    } catch (e) { }
    var tries = 0, t = setInterval(function () {
      tries++;
      if (typeof auth !== 'undefined' && auth && auth.onAuthStateChanged) { clearInterval(t); auth.onAuthStateChanged(function (u) { S.ledger = S.orders = S.net = null; watchMember(u); }); }
      else if (tries > 100) clearInterval(t);
    }, 150);
  }

  /* =============================================================================
     ADMIN  (tab "Security" in the Admin page)
     ============================================================================= */
  var A = { sub: 'orders', filter: 'uploaded', edit: null, imgs: [] };
  function money(n) { return rwf(n); }
  window.afSecAdmin = function (box) {
    if (!box) return; if (!window.__afIsAdmin) { box.innerHTML = '<p class="adm-empty">Administrators only.</p>'; return; }
    box.onclick = adminClick; box.onchange = adminChange;
    var tabs = [['orders', 'Orders'], ['products', 'Products'], ['wd', 'Withdrawals'], ['members', 'Members'], ['settings', 'Settings']];
    box.innerHTML = '<div class="sa-tabs">' + tabs.map(function (t) { return '<button type="button" data-sa="tab" data-v="' + t[0] + '" class="' + (A.sub === t[0] ? 'on' : '') + '">' + t[1] + '</button>'; }).join('') + '</div><div id="saBody"><p class="adm-empty">Loading…</p></div>';
    loadCfg().then(function () { adminPaint(); });
  };
  function adminPaint() { var b = $('saBody'); if (!b) return; ({ orders: aOrders, products: aProducts, wd: aWd, members: aMembers, settings: aSettings }[A.sub] || aOrders)(b); }
  function aList(col, limit) { return dbx().collection(col).orderBy('createdAt', 'desc').limit(limit || 150).get().then(function (s) { var a = []; s.forEach(function (d) { var x = d.data(); x.id = d.id; a.push(x); }); return a; }); }
  function aOrders(b) {
    aList('secOrders', 200).then(function (rows) {
      var fl = { uploaded: 'Payment uploaded', awaiting: 'Awaiting payment', pickup: 'Pending pickup', done: 'Picked up', rejected: 'Rejected', all: 'All' };
      var list = rows.filter(function (o) { var f = A.filter; return f === 'all' || (f === 'uploaded' && o.payStatus === 'uploaded') || (f === 'awaiting' && o.payStatus === 'awaiting') || (f === 'pickup' && o.payStatus === 'confirmed' && o.pickStatus !== 'picked') || (f === 'done' && o.pickStatus === 'picked') || (f === 'rejected' && o.payStatus === 'rejected'); });
      b.innerHTML = '<div class="sa-chips">' + Object.keys(fl).map(function (k) { return '<button type="button" data-sa="filter" data-v="' + k + '" class="' + (A.filter === k ? 'on' : '') + '">' + fl[k] + '</button>'; }).join('') + '</div>' +
        (list.map(function (o) {
          return '<div class="sa-card"><div class="t"><b>@' + esc(o.username) + '</b> · ' + esc(o.name) + (o.newMember ? ' <span class="sec-pill info">NEW MEMBER</span>' : '') + '<small>' + when(o.createdAt) + '</small></div>' +
            '<div>' + (o.items || []).map(function (i) { return esc(i.title) + ' ×' + i.qty; }).join(', ') + '</div><div><b>' + money(o.total) + '</b> · ' + (o.pv || 0) + ' PV · pay: <b>' + esc(o.payStatus) + '</b> · pickup: <b>' + esc(o.pickStatus) + '</b></div>' +
            (o.proofUrl ? '<a href="' + esc(o.proofUrl) + '" target="_blank" rel="noopener"><img class="sa-proof" src="' + esc(o.proofUrl) + '" alt="Payment screenshot"></a>' + (o.payRef ? '<small>Ref: ' + esc(o.payRef) + '</small>' : '') : '') +
            '<div class="sa-btns">' + (o.payStatus !== 'confirmed' && o.payStatus !== 'rejected' ? '<button type="button" class="adm-btn" data-sa="confirm" data-id="' + esc(o.id) + '">Confirm payment</button><button type="button" class="adm-btn danger" data-sa="reject" data-id="' + esc(o.id) + '">Reject</button>' : '') +
            (o.payStatus === 'confirmed' && o.pickStatus !== 'picked' ? '<button type="button" class="adm-btn" data-sa="pick" data-id="' + esc(o.id) + '">Mark as picked up</button>' : '') + '</div></div>';
        }).join('') || '<p class="adm-empty">No orders here.</p>');
    }).catch(function () { b.innerHTML = '<p class="adm-empty">Could not load orders.</p>'; });
  }
  function aProducts(b) {
    var e = A.edit || {}, cats = CATS.map(function (c) { return '<option value="' + c[0] + '"' + (e.category === c[0] ? ' selected' : '') + '>' + c[1] + '</option>'; }).join('');
    dbx().collection('secProducts').limit(200).get().then(function (s) {
      var rows = []; s.forEach(function (d) { var x = d.data(); x.id = d.id; rows.push(x); }); rows.sort(function (x, y) { return ms(y.createdAt) - ms(x.createdAt); });
      b.innerHTML = '<div class="sa-form"><h3 class="adm-h">' + (e.id ? 'Edit product' : 'Add product') + '</h3><input id="spTitle" placeholder="Product name" maxlength="90" value="' + esc(e.title || '') + '"><select id="spCat">' + cats + '</select><input id="spPrice" type="number" inputmode="numeric" placeholder="Price (RWF)" value="' + esc(e.price || '') + '"><input id="spStock" type="number" inputmode="numeric" placeholder="Stock (empty = unlimited)" value="' + (typeof e.stock === 'number' ? e.stock : '') + '"><select id="spCond"><option' + (e.condition !== 'Used' ? ' selected' : '') + '>New</option><option' + (e.condition === 'Used' ? ' selected' : '') + '>Used</option></select><textarea id="spDesc" rows="3" placeholder="Description" maxlength="1500">' + esc(e.description || '') + '</textarea>' +
        '<div class="sa-imgs">' + A.imgs.map(function (u, i) { return '<span><img src="' + esc(u) + '" alt=""><button type="button" data-sa="rmimg" data-v="' + i + '">✕</button></span>'; }).join('') + '</div><input type="file" id="spFile" accept="image/*" multiple><small id="spPv"></small><div class="sa-btns"><button type="button" class="adm-btn" data-sa="saveProduct">' + (e.id ? 'Save changes' : 'Add product') + '</button>' + (e.id ? '<button type="button" class="adm-btn" data-sa="cancelEdit">Cancel</button>' : '') + '</div></div>' +
        '<h3 class="adm-h">Products (' + rows.length + ')</h3>' + rows.map(function (p) { return '<div class="sa-card row"><div class="grow"><b>' + esc(p.title) + '</b><small>' + esc(catName(p.category)) + ' · ' + money(p.price) + ' · PV ' + pvOf(p) + (typeof p.stock === 'number' ? ' · stock ' + p.stock : '') + (p.active === false ? ' · HIDDEN' : '') + '</small></div><div class="sa-btns"><button type="button" class="adm-btn" data-sa="editP" data-id="' + esc(p.id) + '">Edit</button><button type="button" class="adm-btn" data-sa="togP" data-id="' + esc(p.id) + '" data-v="' + (p.active === false ? '1' : '0') + '">' + (p.active === false ? 'Show' : 'Hide') + '</button><button type="button" class="adm-btn danger" data-sa="delP" data-id="' + esc(p.id) + '">Delete</button></div></div>'; }).join('');
      A.rows = rows;
      var up = function () { var pe = $('spPv'), pr = Number(($('spPrice') || {}).value) || 0, ct = ($('spCat') || {}).value; if (pe) pe.textContent = 'PV for this product: ' + pvOf({ price: pr, category: ct }); }; up();
      var pr = $('spPrice'), ct = $('spCat'); if (pr) pr.oninput = up; if (ct) ct.onchange = up;
    });
  }
  function aWd(b) {
    aList('secWithdrawals', 150).then(function (rows) {
      b.innerHTML = rows.map(function (w) { return '<div class="sa-card row"><div class="grow"><b>@' + esc(w.username) + ' · ' + money(w.amount) + '</b><small>MoMo ' + esc(w.phone) + ' · ' + when(w.createdAt) + ' · <b>' + esc(w.status) + '</b></small></div>' + (w.status === 'pending' ? '<div class="sa-btns"><button type="button" class="adm-btn" data-sa="wdOk" data-id="' + esc(w.id) + '">I paid it</button><button type="button" class="adm-btn danger" data-sa="wdNo" data-id="' + esc(w.id) + '">Reject</button></div>' : '') + '</div>'; }).join('') || '<p class="adm-empty">No withdrawal requests.</p>';
    }).catch(function () { b.innerHTML = '<p class="adm-empty">Could not load.</p>'; });
  }
  function aMembers(b) {
    dbx().collection('secMembers').limit(300).get().then(function (s) {
      var rows = []; s.forEach(function (d) { rows.push(d.data()); }); rows.sort(function (x, y) { return ms(y.createdAt) - ms(x.createdAt); });
      var root = rows.some(function (r) { return r.root; });
      var owed = 0; rows.forEach(function (r) { owed += (r.balance || 0) + (r.pendingWd || 0); });
      b.innerHTML = '<div class="sa-card"><b>' + rows.length + ' members</b><small>Owed to members (wallets + pending withdrawals): ' + money(owed) + '</small><div class="sa-btns">' + (root ? '' : '<button type="button" class="adm-btn" data-sa="seed">Create company root account</button>') + '<button type="button" class="adm-btn" data-sa="match">Run daily matching now</button></div><small>' + (root ? '' : 'Create the company account first: it is the top of the tree (username “afrishine”). New members can use it as sponsor.') + ' Matching also runs by itself every day if you add the Vercel Cron (see the setup notes).</small></div>' +
        rows.map(function (m) { return '<div class="sa-card row"><div class="grow"><b>@' + esc(m.username) + ' · ' + esc(m.name) + '</b><small>' + esc(m.status) + ' · sponsor @' + esc(m.sponsorUsername || '-') + ' · L ' + (m.leftPv || 0) + ' / R ' + (m.rightPv || 0) + ' PV · balance ' + money(m.balance) + '</small></div></div>'; }).join('');
    }).catch(function () { b.innerHTML = '<p class="adm-empty">Could not load members.</p>'; });
  }
  function tiersText() { var t = cfg.tiers || {}; return CATS.map(function (c) { return c[0] + ': ' + (t[c[0]] || []).map(function (x) { return x[0] + '=' + x[1]; }).join(', '); }).join('\n'); }
  function aSettings(b) {
    var f = function (id, label, val, hint) { return '<label>' + label + '<input id="' + id + '" value="' + esc(val) + '">' + (hint ? '<small>' + hint + '</small>' : '') + '</label>'; };
    b.innerHTML = '<div class="sa-form">' + f('stPv', 'Value of 1 PV (RWF)', cfg.pvValue) + f('stR1', 'Referral level 1 (%)', cfg.ref1) + f('stR2', 'Referral level 2 (%)', cfg.ref2) + f('stR3', 'Referral level 3 (%)', cfg.ref3) + f('stMatch', 'Binary matching bonus (%)', cfg.matchPct) + f('stCap', 'Daily matching cap per member (RWF, 0 = no cap)', cfg.dailyCap) + f('stMin', 'Minimum withdrawal (RWF)', cfg.minWithdraw) +
      f('stPay', 'Where customers send the money', cfg.payTo, 'e.g. MoMo 0788 000 000 (Afrishine Security)') + f('stOffice', 'Office address for pickup', cfg.officeAddress) +
      '<label>PV points per category<textarea id="stTiers" rows="8">' + esc(tiersText()) + '</textarea><small>One line per category: <b>price=PV</b> pairs. A product earns the highest PV whose price it reaches.</small></label><button type="button" class="adm-btn" data-sa="saveCfg">Save settings</button></div>';
  }
  function adminChange(e) { var t = e.target; if (t && t.id === 'spFile') { var files = Array.prototype.slice.call(t.files || [], 0, 4 - A.imgs.length); if (!files.length) return; say('Uploading photos…'); Promise.all(files.map(uploadImage)).then(function (urls) { A.imgs = A.imgs.concat(urls); readForm(); adminPaint(); }).catch(function (er) { say(er.message); }); } }
  function readForm() { A.edit = A.edit || {}; var g = function (id) { var x = $(id); return x ? x.value : ''; }; if ($('spTitle')) { A.edit.title = g('spTitle'); A.edit.category = g('spCat'); A.edit.price = g('spPrice'); A.edit.stock = g('spStock') === '' ? undefined : Number(g('spStock')); A.edit.condition = g('spCond'); A.edit.description = g('spDesc'); } }
  function aDo(action, body, okMsg, btn) {
    if (btn) btn.disabled = true;
    ask(action, body).then(function (r) { say(okMsg || 'Done.'); adminPaint(); return r; }).catch(function (er) { say(er.message); if (btn) btn.disabled = false; });
  }
  function adminClick(e) {
    var b = e.target.closest ? e.target.closest('[data-sa]') : null; if (!b) return;
    var a = b.getAttribute('data-sa'), id = b.getAttribute('data-id'), v = b.getAttribute('data-v');
    if (a === 'tab') { A.sub = v; A.edit = null; A.imgs = []; window.afSecAdmin($('admBody')); }
    else if (a === 'filter') { A.filter = v; adminPaint(); }
    else if (a === 'confirm') { if (confirm('Confirm that the money arrived? PV and commissions will be created and cannot be undone.')) aDo('confirm', { orderId: id }, 'Payment confirmed. PV and commissions added.', b); }
    else if (a === 'reject') { var why = prompt('Why is this order rejected? (the buyer will see it)'); if (why !== null) aDo('reject', { orderId: id, reason: why }, 'Order rejected.', b); }
    else if (a === 'pick') aDo('pick', { orderId: id }, 'Marked as picked up.', b);
    else if (a === 'wdOk') { if (confirm('Only press this after you sent the money by MoMo.')) aDo('wdDecide', { id: id, approve: true }, 'Marked as paid.', b); }
    else if (a === 'wdNo') { var n = prompt('Reason (optional)'); if (n !== null) aDo('wdDecide', { id: id, approve: false, note: n }, 'Rejected. The amount went back to the member wallet.', b); }
    else if (a === 'match') { if (confirm('Run the matching bonus for today now? It pays each member only once per day.')) { b.disabled = true; ask('matching').then(function (r) { say('Matching done: ' + r.members + ' members, ' + money(r.total) + ' paid.'); adminPaint(); }).catch(function (er) { say(er.message); b.disabled = false; }); } }
    else if (a === 'seed') { var un = prompt('Username for the company account', 'afrishine'); if (un) aDo('seed', { username: un }, 'Company account created.', b); }
    else if (a === 'saveCfg') {
      var tiers = {}, bad = false;
      String($('stTiers').value).split('\n').forEach(function (line) { var p = line.split(':'); if (p.length < 2) return; var k = p[0].trim(), list = []; p.slice(1).join(':').split(',').forEach(function (x) { var q = x.split('='); if (q.length === 2 && !isNaN(Number(q[0])) && !isNaN(Number(q[1]))) list.push([Number(q[0]), Number(q[1])]); else if (x.trim()) bad = true; }); tiers[k] = list; });
      if (bad) return say('Check the PV lines: use price=PV, separated by commas.');
      var doc = { pvValue: Number($('stPv').value) || 10000, ref1: Number($('stR1').value) || 0, ref2: Number($('stR2').value) || 0, ref3: Number($('stR3').value) || 0, matchPct: Number($('stMatch').value) || 0, dailyCap: Number($('stCap').value) || 0, minWithdraw: Number($('stMin').value) || 0, payTo: $('stPay').value.trim(), officeAddress: $('stOffice').value.trim(), tiers: JSON.stringify(tiers), updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
      dbx().collection('secConfig').doc('main').set(doc, { merge: true }).then(function () { cfg.tiers = tiers; ['pvValue', 'ref1', 'ref2', 'ref3', 'matchPct', 'dailyCap', 'minWithdraw'].forEach(function (k) { cfg[k] = doc[k]; }); cfg.payTo = doc.payTo; cfg.officeAddress = doc.officeAddress; say('Settings saved.'); }).catch(function () { say('Could not save settings.'); });
    }
    else if (a === 'rmimg') { readForm(); A.imgs.splice(Number(v), 1); adminPaint(); }
    else if (a === 'editP') { var p = null; (A.rows || []).forEach(function (x) { if (x.id === id) p = x; }); if (p) { A.edit = p; A.imgs = (p.images || []).slice(); adminPaint(); window.scrollTo(0, 0); } }
    else if (a === 'cancelEdit') { A.edit = null; A.imgs = []; adminPaint(); }
    else if (a === 'togP') dbx().collection('secProducts').doc(id).update({ active: v === '1' }).then(function () { adminPaint(); S.loaded = false; });
    else if (a === 'delP') { if (confirm('Delete this product?')) dbx().collection('secProducts').doc(id).delete().then(function () { adminPaint(); S.loaded = false; }); }
    else if (a === 'saveProduct') {
      readForm(); var e2 = A.edit, price = Math.floor(Number(e2.price) || 0);
      if (!e2.title || e2.title.trim().length < 3) return say('Write the product name.'); if (price < 1000) return say('Write the price in RWF.'); if (!A.imgs.length) return say('Add at least one photo.');
      var data = { title: e2.title.trim().slice(0, 90), category: e2.category || 'other', price: price, condition: e2.condition || 'New', description: String(e2.description || '').slice(0, 1500), images: A.imgs.slice(0, 4), active: e2.active !== false };
      if (typeof e2.stock === 'number' && !isNaN(e2.stock)) data.stock = e2.stock; else if (e2.id) data.stock = firebase.firestore.FieldValue.delete();
      var ref2 = e2.id ? dbx().collection('secProducts').doc(e2.id) : dbx().collection('secProducts').doc();
      if (!e2.id) data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      b.disabled = true; ref2.set(data, { merge: true }).then(function () { say('Product saved.'); A.edit = null; A.imgs = []; S.loaded = false; adminPaint(); }).catch(function () { say('Could not save the product.'); b.disabled = false; });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
