/* Afrishine Academy (afrishine-academy.js)
   1) Academy content: the free "Amategeko y'umuhanda" (traffic rules) course, its files and viewer.
   2) "Academy-only" mode: when the site is opened on the Academy address (afrishine-academy….vercel.app,
      or any address with ?mode=academy) only the Academy is shown. On the normal Hub address nothing changes.
   Loads AFTER app-extras.js. */
(function () {
'use strict';

var HUB_URL = 'https://afrishinegithubio.vercel.app/';
var SKILLS_URL = 'https://afrishine-skills.vercel.app';
var MEDIA_BASE = 'https://afrishine-media.usherluckyelie.workers.dev/media/';

/* ---------- small helpers ---------- */
function plain(text) { return String(text == null ? '' : text).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function ms2(t) { return t && t.toMillis ? t.toMillis() : 0; }
function snip(t, n) { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n) + '…' : t; }
function say(text) { if (typeof window.afToast === 'function') window.afToast(text); else alert(text); }

/* ================= 1. ACADEMY: traffic rules ================= */
var TR_CATS = [
  { id: 'gazette', n: 1, icon: '📰', title: 'Igazeti ya Leta', sub: 'Soma amategeko mashya n’andi mabwiriza yatangajwe mu Igazeti ya Leta.', cta: '📖 Soma →' },
  { id: 'signs', n: 2, icon: '🛑', title: 'Ibyapa', sub: 'Menya icyo ibyapa byo mu muhanda bisobanura.', cta: '▶ Reba →' },
  { id: 'new_rules', n: 3, icon: '📄', title: 'Amabwiriza Mashya', sub: 'Menya amabwiriza mashya agenga imikoreshereze y’umuhanda.', cta: '📖 Soma →' },
  { id: 'vehicle_transfer', n: 4, icon: '🚗', title: 'Mutation y’ibinyabiziga', sub: 'Menya amategeko agenga guhindura nyiri ikinyabiziga n’ibyo ugomba kubahiriza.', cta: '📖 Soma →' },
  { id: 'rules_in_force', n: 5, icon: '📋', title: 'Ibigomba kubahirizwa', sub: 'Menya ibyo amategeko asaba abakoresha umuhanda n’abagenzuzi.', cta: '☑ Quiz →' },
  { id: 'faq', n: 6, icon: '❓', title: 'Ibibazo n’ibisubizo', sub: 'Subiza ibibazo wipimishe ubumenyi ufite ku mategeko y’umuhanda.', cta: '▶ Reba →' }
];
window.AF_TR_CATS = TR_CATS;                                   // also used by the admin dashboard
var TR_LOCKED = 'Get a subscription to unlock premium features, then tap Start Now.';
var academy = { files: [], at: 0, loading: null };

function loadAcademyFiles(force) {
  if (!db) return Promise.resolve(academy.files);
  if (!force && academy.at && Date.now() - academy.at < 5 * 60 * 1000) return Promise.resolve(academy.files);
  if (academy.loading) return academy.loading;
  academy.loading = db.collection('academyFiles').limit(300).get().then(function (snap) {
    academy.files = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
    academy.at = Date.now(); return academy.files;
  }).catch(function (e) { console.warn('Academy files:', e); return academy.files; }).then(function (f) { academy.loading = null; return f; });
  return academy.loading;
}
function filesOf(cat) { return academy.files.filter(function (f) { return f.category === cat; }).sort(function (a, b) { return ms2(b.createdAt) - ms2(a.createdAt); }); }
function paintTrafficGrid() {
  var grid = document.getElementById('trGrid'); if (!grid) return;
  if (!grid.children.length) {
    grid.innerHTML = TR_CATS.map(function (c) {
      return '<button type="button" class="tr-card" data-tr-cat="' + c.id + '"><span class="tr-num">' + c.n + '</span><span class="tr-count" data-tr-count="' + c.id + '"></span><i aria-hidden="true">' + c.icon + '</i><b>' + plain(c.title) + '</b><small>' + plain(c.sub) + '</small><span class="tr-cta">' + c.cta + '</span></button>';
    }).join('');
  }
  TR_CATS.forEach(function (c) { var n = filesOf(c.id).length, b = grid.querySelector('[data-tr-count="' + c.id + '"]'); if (b) { b.textContent = n; b.style.display = n ? 'block' : 'none'; } });
}
function fileIcon(t) { return t === 'pdf' ? '📄' : t === 'video' ? '🎬' : '🖼️'; }
function openTrafficCategory(id) {
  var cat = TR_CATS.filter(function (c) { return c.id === id; })[0]; if (!cat) return;
  loadAcademyFiles(false).then(function () {
    var list = filesOf(id);
    if (!list.length) { say(TR_LOCKED); return; }
    document.getElementById('trListTitle').textContent = cat.title;
    document.getElementById('trListSub').textContent = cat.sub;
    document.getElementById('trListBody').innerHTML = list.map(function (f) {
      var d = ms2(f.createdAt) ? new Date(ms2(f.createdAt)).toLocaleDateString() : '';
      return '<div class="tr-file"><i aria-hidden="true">' + fileIcon(f.fileType) + '</i><div><b>' + plain(f.title) + '</b><small>' + plain(snip(f.description, 90)) + (d ? ' · ' + plain(d) : '') + '</small></div><button type="button" data-tr-file="' + plain(f.id) + '">' + (f.fileType === 'video' ? 'Reba' : 'Soma') + '</button></div>';
    }).join('');
    showPage('trafficList');
  });
}
function closeViewer() { var v = document.getElementById('afViewer'); if (v) v.remove(); }
function openAcademyFile(f) {
  if (!f || String(f.fileUrl || '').indexOf(MEDIA_BASE) !== 0) { say('This file could not be opened.'); return; }
  closeViewer();
  var url = f.fileUrl, body;
  if (f.fileType === 'image') body = '<img src="' + plain(url) + '" alt="' + plain(f.title) + '">';
  else if (f.fileType === 'video') body = '<video src="' + plain(url) + '" controls playsinline autoplay></video>';
  else body = '<iframe src="https://docs.google.com/viewer?embedded=true&url=' + encodeURIComponent(url) + '" title="' + plain(f.title) + '"></iframe>';
  var v = document.createElement('div');
  v.id = 'afViewer'; v.className = 'af-viewer'; v.setAttribute('role', 'dialog'); v.setAttribute('aria-modal', 'true');
  v.innerHTML = '<div class="af-viewer-bar"><b>' + plain(f.title) + '</b>' + (f.fileType === 'pdf' ? '<a href="' + plain(url) + '" target="_blank" rel="noopener">Open</a>' : '') + '<button type="button" id="afViewerClose">Close</button></div><div class="af-viewer-body">' + body + '</div>';
  document.body.appendChild(v);
  v.querySelector('#afViewerClose').addEventListener('click', closeViewer);
}
document.addEventListener('click', function (e) {
  var c = e.target.closest ? e.target.closest('[data-tr-cat]') : null;
  if (c) { openTrafficCategory(c.getAttribute('data-tr-cat')); return; }
  var f = e.target.closest ? e.target.closest('[data-tr-file]') : null;
  if (f) { var id = f.getAttribute('data-tr-file'); openAcademyFile(academy.files.filter(function (x) { return x.id === id; })[0]); return; }
  if (e.target.closest && (e.target.closest('#trStart') || e.target.closest('#trStart2'))) {
    loadAcademyFiles(false).then(function () {
      if (!academy.files.length) { say(TR_LOCKED); return; }
      var g = document.getElementById('trCats'); if (g && g.scrollIntoView) g.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
  if (e.target.closest && e.target.closest('[data-open-traffic]')) { showPage('trafficRules'); }
});

/* What the rest of the app (page router, admin dashboard) uses */
window.afAcademy = {
  state: academy,
  load: loadAcademyFiles,
  filesOf: filesOf,
  paint: function () { paintTrafficGrid(); return loadAcademyFiles(false).then(paintTrafficGrid); },
  open: function (f) { return openAcademyFile(f); },               // used by skills-library.js
  openChat: function (cid, title) { return openChat(cid, title); }, // used by the skills-*.js files
  needUser: function () { return needUser(); }, curUser: function () { return curUser(); },
  myName: function () { return myName(); }, isVerified: function (uid) { return isVerified(uid); }
};
window.afAcademyReload = function () { academy.at = 0; return loadAcademyFiles(true); };


/* Share button on the Academy page: the link shows the Academy preview in WhatsApp and opens Afrishine Skills */
(function () {
  var page = document.getElementById('academy'); if (!page) return;
  var bar = document.createElement('div'); bar.className = 'ac-share-bar';
  bar.innerHTML = '<button type="button" id="acShareBtn">🔗 Share Academy</button>';
  page.insertBefore(bar, page.firstChild);
  bar.querySelector('#acShareBtn').addEventListener('click', function () {
    var link = SKILLS_URL + '/api/share?kind=academy';
    if (navigator.share) { navigator.share({ title: 'Afrishine Academy', text: 'Learn. Grow. Succeed.', url: link }).catch(function () {}); return; }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link).then(function () { say('Link copied'); }, function () { prompt('Copy this link', link); });
    else prompt('Copy this link', link);
  });
})();

/* ================= 3. ACADEMY DASHBOARD: six sections + Academy bottom navigation ================= */
var piOnly = /^afrishine-skills/i.test(location.hostname);   // Afrishine Skills address: Pi sign-in only, no link to the Hub
var ownAddress = /^afrishine-(academy|skills)/i.test(location.hostname) || /[?&]mode=academy\b/.test(location.search);

var AC_PAGES = { academy: 1, trafficRules: 1, trafficList: 1, acLibrary: 1, acServices: 1, acFreelance: 1, acCommunity: 1, acBooking: 1, acStore: 1, acInbox: 1, acChannel: 1 };
var SECTIONS = {
  library:   { id: 'acLibrary',   icon: '📖', title: 'E-Library', sub: 'Courses, guides and resources.' },
  services:  { id: 'acServices',  icon: '🧰', title: 'Professional Services', sub: 'Electricians, CCTV installers and other experts.' },
  freelance: { id: 'acFreelance', icon: '💻', title: 'Freelance', sub: 'Website, design and programming work.' },
  community: { id: 'acCommunity', icon: '👥', title: 'Community', sub: 'Connect, learn and share.' },
  booking:   { id: 'acBooking',   icon: '📅', title: 'Book A Service', sub: 'Book an expert fast.' },
  store:     { id: 'acStore',     icon: '🛍️', title: 'Afrishine Store', sub: 'Phone accessories, electronics and more. Pay with Pi.' }
};
var VERIFIED_NOTE = 'Only members with a Verified badge will be able to post here.';
var holder = document.getElementById('academy') && document.getElementById('academy').parentNode;
function sectionPage(s, body) {
  return '<section class="page" id="' + s.id + '"><div class="lp"><button class="lp-back" type="button" data-ac-nav="home">‹ Back</button>' +
    '<div class="ac-head"><span class="ac-ico">' + s.icon + '</span><div><h2>' + plain(s.title) + '</h2><p>' + plain(s.sub) + '</p></div></div>' + body + '</div></section>';
}
function soon(text) { return '<div class="ac-soon"><i aria-hidden="true">⏳</i><b>Coming soon</b><p>' + plain(text) + '</p></div>'; }
if (holder) {
  holder.insertAdjacentHTML('beforeend',
    sectionPage(SECTIONS.library, '<div id="acLibraryBody"></div>') +
    sectionPage(SECTIONS.services, soon(VERIFIED_NOTE)) +
    sectionPage(SECTIONS.freelance, soon(VERIFIED_NOTE)) +
    sectionPage(SECTIONS.community, soon(VERIFIED_NOTE)) +
    sectionPage(SECTIONS.booking, soon('You will be able to book an expert directly from here.')) +
    sectionPage(SECTIONS.store, '<div id="acStoreBody"></div>') +
    sectionPage({ id: 'acInbox', icon: '✉️', title: 'Inbox', sub: 'Your messages.' }, soon('Messages will be available here.')) +
    sectionPage({ id: 'acChannel', icon: '📺', title: 'Channel', sub: 'Share your YouTube or TikTok video link.' }, '<div id="acChannelBody"></div>'));
}
function paintLibrary() {
  if (window.afSkills && window.afSkills.libraryReady) return;     // skills-library.js draws the E-Library
  var box = document.getElementById('acLibraryBody'); if (!box) return;
  loadAcademyFiles(false).then(function () {
    var list = filesOf('elibrary');
    box.innerHTML = list.length ? list.map(function (f) {
      return '<div class="tr-file"><i aria-hidden="true">' + fileIcon(f.fileType) + '</i><div><b>' + plain(f.title) + '</b><small>' + plain(snip(f.description, 90)) + '</small></div><button type="button" data-tr-file="' + plain(f.id) + '">' + (f.fileType === 'video' ? 'Reba' : 'Soma') + '</button></div>';
    }).join('') : soon('Books and guides will appear here as soon as they are added.');
  });
}


/* Terms / Privacy links: at the bottom of Profile on the Academy address; at the bottom of the Academy page on the Hub */
(function () {
  var page = document.getElementById(ownAddress ? 'profile' : 'academy'); if (!page) return;
  var p = document.createElement('p'); p.className = 'ac-legal';
  p.innerHTML = '<a href="/terms">Terms</a> · <a href="/privacy">Privacy</a>';
  page.appendChild(p);
  if (ownAddress && window.MutationObserver) {                       // other Profile blocks are added later: keep Terms / Privacy last
    new MutationObserver(function () { if (page.lastElementChild !== p) page.appendChild(p); }).observe(page, { childList: true });
  }
})();

var nav = document.createElement('nav');
nav.className = 'academy-nav'; nav.setAttribute('aria-label', 'Academy navigation');
var ICO = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10"/><path d="M10 20v-5.5h4V20"/></svg>',
  channel: '<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true"><path d="M21.6 7.2a2.6 2.6 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.200 0-7.800.4A2.600 2.600 0 0 0 2.400 7.200C2 8.800 2 12 2 12s0 3.200.4 4.800a2.600 2.600 0 0 0 1.800 1.800C5.800 19 12 19 12 19s6.200 0 7.800-.4a2.600 2.600 0 0 0 1.800-1.800c.4-1.600.4-4.800.4-4.800s0-3.200-.4-4.800ZM10 15.200V8.800l5.500 3.200Z"/></svg>',
  inbox: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/></svg>',
  profile: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="8" r="4.200"/><path d="M4 21c0-4.200 3.600-7 8-7s8 2.800 8 7Z"/></svg>'
};
nav.innerHTML = '<div class="ac-pill">' +
  '<button type="button" data-ac-nav="home">' + ICO.home + '<small>Home</small></button>' +
  '<button type="button" class="chan" data-ac-nav="channel"><span class="ch-ico">' + ICO.channel + '</span><small>Channel</small></button>' +
  '<button type="button" data-ac-nav="inbox">' + ICO.inbox + '<small>Inbox</small></button>' +
  '<button type="button" data-ac-nav="profile">' + ICO.profile + '<small>Profile</small></button></div>';
document.body.appendChild(nav);
function navGo(k) {
  if (k === 'home') showPage('academy');
  else if (k === 'channel') showPage('acChannel');
  else if (k === 'inbox') showPage(ownAddress ? 'acInbox' : 'inbox');
  else if (k === 'profile') showPage('profile');
}
document.addEventListener('click', function (e) {
  var n = e.target.closest ? e.target.closest('[data-ac-nav]') : null;
  if (n) { navGo(n.getAttribute('data-ac-nav')); return; }
  var t = e.target.closest ? e.target.closest('[data-ac-go]') : null;
  if (t) { var s = SECTIONS[t.getAttribute('data-ac-go')]; if (s) showPage(s.id); }
});
function markNav(id) {
  var key = id === 'academy' || id === 'trafficRules' || id === 'trafficList' || (id.indexOf('ac') === 0 && id !== 'acChannel' && id !== 'acInbox') ? 'home' : id === 'acChannel' ? 'channel' : id === 'acInbox' ? 'inbox' : id === 'profile' ? 'profile' : '';
  Array.prototype.forEach.call(nav.querySelectorAll('[data-ac-nav]'), function (b) { b.classList.toggle('active', b.getAttribute('data-ac-nav') === key); });
}
/* The Academy has its own bottom navigation; the Hub one is hidden while an Academy page is open */
var prevShowPage = window.showPage;
window.showPage = function (id) {
  var r = prevShowPage(id);
  var active = document.querySelector('.page.active'), cur = active ? active.id : id;
  document.body.classList.toggle('ac-on', !!AC_PAGES[cur] || (ownAddress && !!ALLOWED_OWN[cur]));
  markNav(cur);
  if (cur === 'acLibrary') paintLibrary();
  if (cur === 'acStore') paintStore();
  if (cur === 'acInbox') paintInbox();
  if (cur === 'academy') paintChannelHome();
  if (cur === 'acChannel') paintChannelPage();
  if (cur === 'profile') mountVerify();
  return r;
};
var ALLOWED_OWN = { profile: 1, settings: 1, contact: 1 };
var CH_CHIP = 'Only members with a Verified badge can post in Channel.';
(function () { var a = document.querySelector('.page.active'); if (a) { document.body.classList.toggle('ac-on', !!AC_PAGES[a.id]); markNav(a.id); } })();

/* ================= 4. AFRISHINE STORE (electronics, paid with Pi only, 5% commission) ================= */
var COMMISSION = 0.05;
var store = { items: [], loaded: 0, q: '' };
function $(id) { return document.getElementById(id); }
/* The Store works with Pi accounts only (uid starts with pi_); Google / email accounts are ignored here. */
function curUser() { var u = (typeof currentFirebaseUser !== 'undefined' && currentFirebaseUser) || null; return u && /^pi_/.test(u.uid) ? u : null; }
function inPi() { return typeof isPiBrowser === 'function' && isPiBrowser(); }
function piFmt(n) { return 'π ' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 7 }); }
function postJson(url, data) {
  return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.error || 'Server error'); return d; }); });
}

/* ---- Pi sign-in (also gives the user a Firebase identity, so chat / bids / selling work) ---- */
function piIncomplete(payment) {
  var tx = payment && payment.transaction && payment.transaction.txid;
  if (payment && payment.identifier && tx) postJson('/api/pi-complete', { paymentId: payment.identifier, txid: tx }).catch(function () { });
}
window.afPiLogin = function () {
  if (!PI_HOST) { window.afPiGate(); return Promise.reject(new Error('Pi sign-in is on Afrishine Skills')); }
  if (!window.Pi) { window.afPiGate(); return Promise.reject(new Error('Open Afrishine Skills in Pi Browser')); }
  /* Pi.init must finish before Pi.authenticate; no "sandbox" option (it is detected automatically) */
  var step = function (name, fn) { return function (v) { try { return Promise.resolve(fn(v)).catch(function (e) { var m = (e && e.message) || String(e || ''); var er = new Error(name + ': ' + m); er.step = name; throw er; }); } catch (e) { var er2 = new Error(name + ': ' + ((e && e.message) || e)); er2.step = name; return Promise.reject(er2); } }; };
  return Promise.resolve().then(step('Pi.init', function () { window.__afPiInited = true; return window.Pi.init({ version: '2.0' }); })).then(step('Pi.authenticate', function () {
    /* login only needs the username; the payments permission is requested right before a purchase */
    return window.Pi.authenticate(['username'], piIncomplete);
  })).then(function (r) {
    /* Only the access token is used. The identity comes back from the server (App Studio), never from the browser. */
    return step('server login', function () { return postJson('/api/pi-login', { accessToken: r.accessToken }); })().then(function (d) {
      return step('Firebase sign-in', function () { return auth.signInWithCustomToken(d.token); })().then(function () {
        try { sessionStorage.setItem('afrishine_pi_username', d.username); } catch (e) { }
        return { accessToken: r.accessToken, user: { username: d.username } };
      });
    });
  });
};
/* Outside Pi Browser: explain that Pi sign-in needs Pi Browser and help the member get there */
window.afPiGate = function () {
  if (!PI_HOST) {
    sheet('<h3>Sign in with Pi on Afrishine Skills</h3><p class="as-desc">Pi sign-in, the Store and Pi payments work on <b>Afrishine Skills</b>. Open it in Pi Browser to continue.</p><div class="as-actions static"><a class="as-btn main as-link" href="' + SKILLS_URL + '/">Open Afrishine Skills</a></div><div class="as-actions static"><button type="button" class="as-btn ghost" data-as="sheet-close">Close</button></div>');
    return;
  }
  var link = location.origin + '/';
  var o = sheet('<h3>Login with Pi Browser</h3><p class="as-desc">Afrishine Skills signs you in with your Pi account, which works inside <b>Pi Browser</b> only. Open this page in Pi Browser to continue.</p>' +
    '<div class="as-actions static"><button type="button" class="as-btn main" id="asPiCopy">Copy link</button></div>' +
    '<p class="as-note" style="margin:0">Do not have Pi Browser yet?</p>' +
    '<div class="as-actions static"><a class="as-btn ghost as-link" href="https://play.google.com/store/apps/details?id=pi.browser" target="_blank" rel="noopener">Android</a><a class="as-btn ghost as-link" href="https://apps.apple.com/app/id1560911608" target="_blank" rel="noopener">iPhone</a></div>' +
    '<div class="as-actions static"><button type="button" class="as-btn ghost" data-as="sheet-close">Close</button></div>');
  o.querySelector('#asPiCopy').addEventListener('click', function () {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link).then(function () { say('Link copied. Paste it in Pi Browser.'); }, function () { prompt('Copy this link', link); });
    else prompt('Copy this link', link);
  });
};
function needUser() {
  var u = curUser();
  if (u && /^pi_/.test(u.uid)) return Promise.resolve(u);          // already signed in with Pi
  if (inPi()) return window.afPiLogin().then(function () { return curUser(); }).catch(function (e) { say(e.message || 'Pi sign-in failed'); return null; });
  window.afPiGate(); return Promise.resolve(null);
}
var PI_HOST = /^afrishine-skills/i.test(location.hostname);   // Pi sign-in works on Afrishine Skills only
function piOnlyHost() { return /^afrishine-skills/i.test(location.hostname); }

/* ---- small UI helpers ---- */
function overlay(id, html) {
  var old = $(id); if (old) old.remove();
  var o = document.createElement('div'); o.id = id; o.className = 'as-ov'; o.innerHTML = html; document.body.appendChild(o);
  document.body.classList.add('as-lock'); return o;
}
function closeOv(id) { var o = $(id); if (o) o.remove(); if (!document.querySelector('.as-ov')) document.body.classList.remove('as-lock'); }
function sheet(html) {
  var o = overlay('asSheet', '<div class="as-sheet-box" role="dialog" aria-modal="true">' + html + '</div>');
  o.classList.add('as-sheet'); o.addEventListener('click', function (e) { if (e.target === o) closeOv('asSheet'); }); return o;
}
function verifiedChip(on) { return on ? '<span class="as-verified">✓ Verified</span>' : ''; }
function verifiedNow(p) { if (!p || p.verified !== true) return false; var u = ms2(p.verifiedUntil); return !u || u > Date.now(); }   // a badge with an end date stops at that date
function isVerified(uid) { return db.collection('publicProfiles').doc(uid).get().then(function (s) { return !!(s.exists && verifiedNow(s.data())); }).catch(function () { return false; }); }
function myName() { var u = curUser(); return (u && (u.displayName || '')) || sessionStorageGet('afrishine_pi_username') || 'Afrishine Member'; }
function sessionStorageGet(k) { try { return sessionStorage.getItem(k) || ''; } catch (e) { return ''; } }

/* ---- list ---- */
function loadStore(force) {
  if (!db) return Promise.resolve([]);
  if (!force && store.loaded && Date.now() - store.loaded < 60000) return Promise.resolve(store.items);
  return db.collection('academyProducts').orderBy('createdAt', 'desc').limit(80).get().then(function (snap) {
    store.items = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); }).filter(function (p) { return p.status === 'active'; });
    store.loaded = Date.now(); return store.items;
  }).catch(function (e) { console.warn('Store:', e); return store.items; });
}
function card(p) {
  var img = (p.images && p.images[0]) || '';
  return '<button type="button" class="as-card" data-as="open" data-id="' + plain(p.id) + '"><span class="as-img">' + (img ? '<img src="' + plain(img) + '" alt="' + plain(p.title) + '" loading="lazy" decoding="async">' : '<i aria-hidden="true">📦</i>') + '</span><b>' + plain(p.title) + '</b><strong>' + piFmt(p.price) + '</strong><small>' + plain(p.sellerName || 'Seller') + '</small></button>';
}
function paintGrid() {
  var g = $('asGrid'); if (!g) return;
  var q = store.q.toLowerCase();
  var list = store.items.filter(function (p) { return !q || (String(p.title) + ' ' + String(p.description || '')).toLowerCase().indexOf(q) >= 0; });
  g.innerHTML = list.length ? list.map(card).join('') : '<div class="ac-soon" style="grid-column:1/-1"><i aria-hidden="true">🛍️</i><b>' + (store.items.length ? 'No match' : 'No products yet') + '</b><p>' + (store.items.length ? 'Try another word.' : 'Verified sellers can list electronics here. Tap “Sell”.') + '</p></div>';
}
function paintStore() {
  var box = $('acStoreBody'); if (!box) return;
  if (!box.firstChild) {
    box.innerHTML = '<div class="as-bar"><input id="asSearch" type="search" placeholder="Search electronics…" aria-label="Search"><button type="button" class="as-sell" data-as="sell">＋ Sell</button></div><p class="as-note">Pay with Pi only · 5% platform commission is taken from the seller’s payment.</p><div class="as-grid" id="asGrid"></div>';
    $('asSearch').addEventListener('input', function () { store.q = this.value; paintGrid(); });
  }
  paintGrid();
  loadStore(false).then(paintGrid);
}
function findItem(id) { return store.items.filter(function (p) { return p.id === id; })[0] || null; }

/* ---- product detail ---- */
function openProduct(id) {
  var p = findItem(id);
  if (!p) { db.collection('academyProducts').doc(id).get().then(function (s) { if (s.exists && s.data().status === 'active') { var x = Object.assign({ id: s.id }, s.data()); store.items.push(x); openProduct(id); } else say('This product is no longer available.'); }); return; }
  var u = curUser(), mine = !!(u && u.uid === p.uid), imgs = (p.images || []).filter(Boolean);
  var gallery = imgs.length ? imgs.map(function (s) { return '<img src="' + plain(s) + '" alt="' + plain(p.title) + '" decoding="async">'; }).join('') : '<div class="as-noimg">📦</div>';
  overlay('asDetail',
    '<div class="as-d"><div class="as-gal">' + gallery + '</div><button type="button" class="as-back" data-as="close-detail" aria-label="Back">←</button>' +
    '<div class="as-d-body"><div class="as-row"><span class="as-tag">' + plain(p.condition || 'New') + '</span><button type="button" class="as-ic" data-as="share" data-id="' + plain(p.id) + '" aria-label="Share">⤴</button><span class="as-price">' + piFmt(p.price) + '</span></div>' +
    '<h2>' + plain(p.title) + '</h2>' +
    '<div class="as-seller"><span class="as-av">' + plain((p.sellerName || 'S').charAt(0).toUpperCase()) + '</span><div><b>' + plain(p.sellerName || 'Seller') + '</b> <span id="asVer"></span><small>Pay with Pi · seller gets 95%</small></div></div>' +
    '<h3>Description</h3><p class="as-desc">' + plain(p.description || 'No description.') + '</p>' +
    '<div class="as-bids" id="asBids"></div></div>' +
    '<div class="as-actions">' + (mine ? '<button type="button" class="as-btn ghost" data-as="messages">💬 Messages</button><button type="button" class="as-btn danger" data-as="delete" data-id="' + plain(p.id) + '">Delete</button>'
      : '<button type="button" class="as-btn ghost" data-as="chat" data-id="' + plain(p.id) + '">💬 Chat</button><button type="button" class="as-btn main" data-as="buy" data-id="' + plain(p.id) + '">Buy</button><button type="button" class="as-btn ghost" data-as="bid" data-id="' + plain(p.id) + '">Make bid</button>') + '</div></div>');
  isVerified(p.uid).then(function (v) { var e = $('asVer'); if (e) e.innerHTML = verifiedChip(v); });
  db.collection('academyProducts').doc(p.id).collection('bids').orderBy('amount', 'desc').limit(5).get().then(function (snap) {
    var e = $('asBids'); if (!e) return;
    e.innerHTML = snap.empty ? '' : '<h3>Bids</h3>' + snap.docs.map(function (d) { var b = d.data(); return '<div class="as-bidrow"><span>' + plain(b.name || 'Bidder') + '</span><b>' + piFmt(b.amount) + '</b></div>'; }).join('');
  }).catch(function () { });
}
function shareProduct(id) {
  var link = SKILLS_URL + '/api/share?kind=academyProducts&id=' + encodeURIComponent(id), p = findItem(id);
  if (navigator.share) { navigator.share({ title: p ? p.title : 'Afrishine Store', text: p ? piFmt(p.price) : '', url: link }).catch(function () { }); return; }
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link).then(function () { say('Link copied'); }, function () { prompt('Copy this link', link); });
  else prompt('Copy this link', link);
}

/* ---- buy with Pi ---- */
function buy(id) {
  var p = findItem(id); if (!p) return;
  if (!inPi()) { window.afPiGate(); return; }
  needUser().then(function (u) {
    if (!u) return;
    if (u.uid === p.uid) { say('This is your own product.'); return; }
    var o = sheet('<h3>Confirm purchase</h3><p class="as-desc"><b>' + plain(p.title) + '</b><br>Price: <b>' + piFmt(p.price) + '</b><br>You pay with Pi only. Afrishine keeps a 5% commission; the seller receives ' + piFmt(Math.round(p.price * (1 - COMMISSION) * 1e7) / 1e7) + '.</p><div class="as-actions static"><button type="button" class="as-btn ghost" data-as="sheet-close">Cancel</button><button type="button" class="as-btn main" id="asPay">Pay ' + piFmt(p.price) + '</button></div>');
    o.querySelector('#asPay').addEventListener('click', function () {
      this.disabled = true; this.textContent = 'Opening Pi…';
      Promise.resolve(window.Pi.authenticate(['username', 'payments'], piIncomplete)).catch(function () { }).then(function () { window.Pi.createPayment({ amount: Number(p.price), memo: ('Afrishine Store: ' + p.title).slice(0, 120), metadata: { productId: p.id } }, {
        onReadyForServerApproval: function (paymentId) { postJson('/api/pi-approve', { paymentId: paymentId }).catch(function (e) { say(e.message); }); },
        onReadyForServerCompletion: function (paymentId, txid) {
          postJson('/api/pi-complete', { paymentId: paymentId, txid: txid }).then(function () {
            closeOv('asSheet'); closeOv('asDetail'); store.loaded = 0; say('Payment complete ✅ Chat with the seller to arrange delivery.'); paintStore();
          }).catch(function (e) { say(e.message); });
        },
        onCancel: function () { closeOv('asSheet'); say('Payment cancelled.'); },
        onError: function () { closeOv('asSheet'); say('Payment failed. Please try again.'); }
      }); });
    });
  });
}

/* ---- bid ---- */
function bid(id) {
  var p = findItem(id); if (!p) return;
  needUser().then(function (u) {
    if (!u) return;
    if (u.uid === p.uid) { say('This is your own product.'); return; }
    var o = sheet('<h3>Make a bid</h3><p class="as-desc">Listed price: <b>' + piFmt(p.price) + '</b>. The seller will see your bid and can chat with you.</p><input class="as-input" id="asBidAmt" type="number" inputmode="decimal" min="0" step="any" placeholder="Your offer in π"><div class="as-actions static"><button type="button" class="as-btn ghost" data-as="sheet-close">Cancel</button><button type="button" class="as-btn main" id="asBidGo">Send bid</button></div>');
    o.querySelector('#asBidGo').addEventListener('click', function () {
      var n = Number($('asBidAmt').value);
      if (!(n > 0)) { say('Enter an amount in π.'); return; }
      this.disabled = true;
      db.collection('academyProducts').doc(p.id).collection('bids').add({ uid: u.uid, name: myName(), amount: n, createdAt: firebase.firestore.FieldValue.serverTimestamp() })
        .then(function () { closeOv('asSheet'); say('Bid sent'); openProduct(p.id); }).catch(function () { closeOv('asSheet'); say('Could not send the bid.'); });
    });
  });
}

/* ---- in-app chat (not the Hub inbox) ---- */
var chatUnsub = null;
function closeChat() { if (chatUnsub) { chatUnsub(); chatUnsub = null; } closeOv('asChat'); }
function openChat(cid, title) {
  var u = curUser(); if (!u) return;
  var o = overlay('asChat', '<div class="as-c"><div class="as-c-bar"><button type="button" class="as-back st" data-as="close-chat" aria-label="Back">←</button><b>' + plain(title) + '</b></div><div class="as-msgs" id="asMsgs"></div><form class="as-send" id="asSend"><input id="asMsg" maxlength="800" placeholder="Write a message…" autocomplete="off"><button type="submit" class="as-btn main">Send</button></form></div>');
  var ref = db.collection('academyChats').doc(cid);
  chatUnsub = ref.collection('messages').orderBy('createdAt', 'asc').limit(200).onSnapshot(function (snap) {
    var box = $('asMsgs'); if (!box) return;
    box.innerHTML = snap.docs.map(function (d) { var m = d.data(); return '<div class="as-m ' + (m.uid === u.uid ? 'me' : '') + '"><span>' + plain(m.text) + '</span></div>'; }).join('') || '<p class="as-note">Say hello 👋</p>';
    box.scrollTop = box.scrollHeight;
  }, function () { var box = $('asMsgs'); if (box) box.innerHTML = '<p class="as-note">Could not load messages.</p>'; });
  o.querySelector('#asSend').addEventListener('submit', function (e) {
    e.preventDefault(); var inp = $('asMsg'), t = inp.value.trim(); if (!t) return; inp.value = '';
    ref.collection('messages').add({ uid: u.uid, text: t, createdAt: firebase.firestore.FieldValue.serverTimestamp() })
      .then(function () { return ref.update({ last: t.slice(0, 80), updatedAt: firebase.firestore.FieldValue.serverTimestamp() }); }).catch(function () { say('Message not sent.'); });
  });
}
function startChat(id) {
  var p = findItem(id); if (!p) return;
  needUser().then(function (u) {
    if (!u) return;
    if (u.uid === p.uid) { say('Open your messages from the Inbox.'); return; }
    var cid = p.id + '_' + u.uid, ref = db.collection('academyChats').doc(cid);
    ref.get().then(function (s) {
      if (s.exists) return;
      return ref.set({ productId: p.id, title: p.title, members: [p.uid, u.uid], sellerUid: p.uid, buyerUid: u.uid, sellerName: p.sellerName || 'Seller', buyerName: myName(), last: '', updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    }).then(function () { openChat(cid, p.title + ' · ' + (p.sellerName || 'Seller')); }).catch(function () { say('Could not open the chat.'); });
  });
}
function paintInbox() {
  var page = $('acInbox'); if (!page) return;
  var host = $('acInboxBody'); if (!host) { var h = page.querySelector('.ac-soon'); if (h) h.outerHTML = '<div id="acInboxBody"></div>'; host = $('acInboxBody'); }
  if (!host) return;
  var u = curUser();
  if (!u) { host.innerHTML = '<div class="ac-soon"><i aria-hidden="true">✉️</i><b>Sign in to see your messages</b><p>Chats with Store buyers and sellers appear here.</p><button type="button" class="as-btn main" data-as="signin">Sign in with Pi</button></div>'; return; }
  host.innerHTML = '<p class="as-note">Loading…</p>';
  db.collection('academyChats').where('members', 'array-contains', u.uid).limit(50).get().then(function (snap) {
    var rows = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); }).sort(function (a, b) { return ms2(b.updatedAt) - ms2(a.updatedAt); });
    host.innerHTML = rows.length ? rows.map(function (c) { var other = c.sellerUid === u.uid ? c.buyerName : c.sellerName; return '<button type="button" class="as-chatrow" data-as="open-chat" data-id="' + plain(c.id) + '" data-t="' + plain(c.title) + '"><span class="as-av">' + plain(String(other || 'A').charAt(0).toUpperCase()) + '</span><div><b>' + plain(other || 'Member') + '</b><small>' + plain(c.title) + ' — ' + plain(c.last || 'New chat') + '</small></div></button>'; }).join('') : '<div class="ac-soon"><i aria-hidden="true">✉️</i><b>No messages yet</b><p>Tap Chat on a product to talk to the seller.</p></div>';
  }).catch(function () { host.innerHTML = '<p class="as-note">Could not load messages.</p>'; });
}

/* ---- sell (Verified members only) ---- */
function compress(file) {
  if (!file.type || file.type.indexOf('image/') !== 0 || !window.createImageBitmap) return Promise.resolve(file);
  return createImageBitmap(file).then(function (bm) {
    var s = Math.min(1, 1280 / Math.max(bm.width, bm.height)), c = document.createElement('canvas'); c.width = Math.round(bm.width * s); c.height = Math.round(bm.height * s);
    c.getContext('2d').drawImage(bm, 0, 0, c.width, c.height);
    return new Promise(function (res) { c.toBlob(function (b) { res(b || file); }, 'image/jpeg', 0.82); });
  }).catch(function () { return file; });
}
function uploadImage(file, user) {
  return compress(file).then(function (blob) {
    return user.getIdToken().then(function (t) {
      return fetch(MEDIA_BASE.replace('/media/', '') + '/upload?filename=' + encodeURIComponent('store-' + Date.now() + '.jpg'), { method: 'POST', headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'image/jpeg' }, body: blob });
    });
  }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok || !d.success || !d.url) throw new Error(d.error || 'Photo upload failed'); return d.url; }); });
}
function sell() {
  needUser().then(function (u) {
    if (!u) return;
    isVerified(u.uid).then(function (v) {
      if (!v) { sheet('<h3>Verified sellers only</h3><p class="as-desc">Only members with a Verified badge can sell in Afrishine Store. Get your badge from Profile → Verified Badge, then come back.</p><div class="as-actions static"><button type="button" class="as-btn main" data-as="sheet-close">OK</button></div>'); return; }
      var o = sheet('<h3>Sell an item</h3><input class="as-input" id="asTitle" maxlength="90" placeholder="Item name (e.g. Infinix Hot 40)"><input class="as-input" id="asPrice" type="number" inputmode="decimal" min="0" step="any" placeholder="Price in π"><select class="as-input" id="asCond"><option>New</option><option>Used</option></select><textarea class="as-input" id="asDesc" maxlength="1200" rows="3" placeholder="Description"></textarea><label class="as-file">📷 Add photos (up to 4)<input id="asPhotos" type="file" accept="image/*" multiple hidden></label><div class="as-prev" id="asPrev"></div><p class="as-note">Afrishine keeps 5% of each sale.</p><div class="as-actions static"><button type="button" class="as-btn ghost" data-as="sheet-close">Cancel</button><button type="button" class="as-btn main" id="asPost">Publish</button></div>');
      var files = [];
      o.querySelector('#asPhotos').addEventListener('change', function () { files = Array.prototype.slice.call(this.files || [], 0, 4); $('asPrev').innerHTML = files.map(function (f) { return '<img src="' + URL.createObjectURL(f) + '" alt="">'; }).join(''); });
      o.querySelector('#asPost').addEventListener('click', function () {
        var title = $('asTitle').value.trim(), price = Number($('asPrice').value);
        if (title.length < 3) { say('Write the item name.'); return; }
        if (!(price > 0)) { say('Enter the price in π.'); return; }
        if (!files.length) { say('Add at least one photo.'); return; }
        var btn = this; btn.disabled = true; btn.textContent = 'Publishing…';
        Promise.all(files.map(function (f) { return uploadImage(f, u); })).then(function (urls) {
          return db.collection('academyProducts').add({ title: title, price: price, condition: $('asCond').value, description: $('asDesc').value.trim(), images: urls, uid: u.uid, sellerName: myName(), status: 'active', createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        }).then(function () { closeOv('asSheet'); store.loaded = 0; say('Published ✅'); paintStore(); })
          .catch(function (e) { btn.disabled = false; btn.textContent = 'Publish'; say(e.message || 'Could not publish.'); });
      });
    });
  });
}
function removeProduct(id) {
  var o = sheet('<h3>Delete this product?</h3><p class="as-desc">It will disappear from the Store.</p><div class="as-actions static"><button type="button" class="as-btn ghost" data-as="sheet-close">Cancel</button><button type="button" class="as-btn danger" id="asDel">Delete</button></div>');
  o.querySelector('#asDel').addEventListener('click', function () {
    db.collection('academyProducts').doc(id).delete().then(function () { store.items = store.items.filter(function (p) { return p.id !== id; }); closeOv('asSheet'); closeOv('asDetail'); paintStore(); say('Deleted'); }).catch(function () { closeOv('asSheet'); say('Could not delete.'); });
  });
}
function myMessages() { closeOv('asDetail'); showPage('acInbox'); }

document.addEventListener('click', function (e) {
  var b = e.target.closest ? e.target.closest('[data-as]') : null; if (!b) return;
  var a = b.getAttribute('data-as'), id = b.getAttribute('data-id');
  if (a === 'open') openProduct(id);
  else if (a === 'close-detail') closeOv('asDetail');
  else if (a === 'close-chat') closeChat();
  else if (a === 'sheet-close') closeOv('asSheet');
  else if (a === 'share') shareProduct(id);
  else if (a === 'buy') buy(id);
  else if (a === 'bid') bid(id);
  else if (a === 'chat') startChat(id);
  else if (a === 'sell') sell();
  else if (a === 'delete') removeProduct(id);
  else if (a === 'messages') myMessages();
  else if (a === 'open-chat') openChat(id, b.getAttribute('data-t') || 'Chat');
  else if (a === 'signin') needUser().then(function () { paintInbox(); });
});
/* Deep link from a shared product: /?store=ID */
(function () {
  var m = /[?&]store=([A-Za-z0-9_-]{6,64})/.exec(location.search); if (!m) return;
  window.addEventListener('load', function () { showPage('acStore'); setTimeout(function () { openProduct(m[1]); }, 300); });
})();

/* ================= 5. CHANNEL: YouTube / TikTok links shared by Verified members ================= */
var chan = { items: [], docs: [], loaded: 0, last: null, more: false, loading: null };
var chanVer = {};
function chanUserNow() { return (typeof currentFirebaseUser !== 'undefined' && currentFirebaseUser) || null; }
function chanName(u) { return String((u && u.displayName) || sessionStorageGet('afrishine_pi_username') || 'Afrishine Member').slice(0, 100); }
function dShort(t) { var m = ms2(t); return m ? new Date(m).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : ''; }
function chanCard(p) {
  var me = chanUserNow(), canDel = (me && p.uid === me.uid) || window.__afIsAdmin === true;
  var card = typeof window.afLinkCardHtml === 'function' ? window.afLinkCardHtml({ linkProvider: p.linkProvider, linkId: p.linkId, linkUrl: p.linkUrl, linkTitle: p.linkTitle, linkThumb: p.linkThumb }) : '<a href="' + plain(p.linkUrl) + '" target="_blank" rel="noopener">' + plain(p.linkTitle || 'Open video') + '</a>';
  return '<article class="ac-chan-item"><div class="ac-chan-head"><span class="ac-chan-av">' + plain(String(p.authorName || 'A').charAt(0).toUpperCase()) + '</span><div class="who"><b>' + plain(p.authorName || 'Member') + ' <span data-chan-ver="' + plain(p.uid) + '"></span></b><small>' + plain(dShort(p.createdAt)) + '</small></div>' +
    (canDel ? '<button type="button" class="ac-chan-del" data-chan-del="' + plain(p.id) + '">Delete</button>' : '') + '</div>' +
    (p.text ? '<p class="ac-chan-cap">' + plain(p.text) + '</p>' : '') + card + '</article>';
}
function chanChips(root) {                         // show "✓ Verified" next to members whose badge is active right now
  Array.prototype.forEach.call(root.querySelectorAll('[data-chan-ver]'), function (el) {
    var uid = el.getAttribute('data-chan-ver');
    if (!(uid in chanVer)) chanVer[uid] = isVerified(uid);
    Promise.resolve(chanVer[uid]).then(function (v) { chanVer[uid] = v; el.innerHTML = verifiedChip(v); });
  });
}
function loadChannel(more) {
  if (!db) return Promise.resolve();
  if (chan.loading) return chan.loading;
  if (!more && chan.loaded && Date.now() - chan.loaded < 30000) return Promise.resolve();
  var q = db.collection('academyChannel').orderBy('createdAt', 'desc').limit(12);
  if (more && chan.last) q = q.startAfter(chan.last);
  chan.loading = q.get().then(function (snap) {
    var rows = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
    chan.items = more ? chan.items.concat(rows) : rows;
    if (snap.docs.length) chan.last = snap.docs[snap.docs.length - 1];
    chan.more = snap.docs.length === 12; chan.loaded = Date.now();
  }).catch(function (e) { console.warn('Channel:', e); }).then(function () { chan.loading = null; });
  return chan.loading;
}
function paintChannelHome(more) {
  var sec = $('acChanHome'); if (!sec) return;
  loadChannel(more === true).then(function () {
    var grid = $('acChanGrid'), btn = $('acChanMore'); if (!grid) return;
    if (grid.querySelector('[data-vlink-playing="1"]')) return;               // do not interrupt a video that is playing
    grid.innerHTML = chan.items.length ? chan.items.map(chanCard).join('') : '<div class="ac-soon" style="grid-column:1/-1"><i aria-hidden="true">📺</i><b>No videos yet</b><p>Verified members can share the first one from <b>Channel</b>.</p></div>';
    if (btn) btn.style.display = chan.more ? 'block' : 'none';
    chanChips(grid);
  });
}
(function () {                                    // the list sits below "Start Learning"
  var page = $('academy'); if (!page) return;
  var bottom = page.querySelector('.lp-bottom'), sec = document.createElement('section');
  sec.className = 'ac-chan'; sec.id = 'acChanHome';
  sec.innerHTML = '<h3>📺 Latest from Channel</h3><p>Videos shared by Verified members.</p><div class="ac-chan-grid" id="acChanGrid"></div><button type="button" class="ac-chan-more" id="acChanMore" style="display:none">Show more</button>';
  if (bottom && bottom.parentNode) bottom.parentNode.insertBefore(sec, bottom.nextSibling); else page.appendChild(sec);
})();

var chanForm = null;
function paintChannelPage() {
  var box = $('acChannelBody'); if (!box) return;
  var u = chanUserNow();
  if (!u) {
    box.innerHTML = '<div class="ac-chan-lock"><i aria-hidden="true">📺</i><b>Sign in to post in Channel</b><p>' + plain(CH_CHIP) + ' Sign in with Pi first.</p><button type="button" class="as-btn main" data-chan="signin">Sign in with Pi</button></div>';
    return;
  }
  box.innerHTML = '<p class="ac-msg">Loading…</p>';
  isVerified(u.uid).then(function (ok) {
    if (!$('acChannelBody')) return;
    if (!ok) {
      box.innerHTML = '<div class="ac-chan-lock"><i aria-hidden="true">🔒</i><b>Verified members only</b><p>' + plain(CH_CHIP) + ' Get your badge in Profile → Request Verification, then come back here.</p><button type="button" class="as-btn main" data-chan="getverified">Get Verified</button></div><div id="acMyVideos"></div>';
      return;
    }
    box.innerHTML = '<div class="ac-chan-form"><b>Share a video link</b><p class="ac-msg">Paste a YouTube or TikTok link. It goes public right away and appears on the Academy home, below “Start Learning”.</p>' +
      '<input class="field" id="acChanUrl" type="url" inputmode="url" autocomplete="off" placeholder="https://youtube.com/watch?v=…"><div id="acChanPrev"></div><p class="ac-msg" id="acChanMsg" role="status"></p>' +
      '<input class="field" id="acChanTitle" maxlength="200" placeholder="Title (optional)" style="display:none"><textarea class="field" id="acChanCap" maxlength="500" placeholder="Say something about this video (optional)"></textarea>' +
      '<button type="button" class="gold" id="acChanPost" disabled>Post Video</button></div><h3 class="adm-h" style="margin:6px 0 8px">Your videos</h3><div id="acMyVideos"></div>';
    wireChannelForm(u); paintMyVideos(u);
  });
}
function paintMyVideos(u) {
  var host = $('acMyVideos'); if (!host) return;
  db.collection('academyChannel').where('uid', '==', u.uid).limit(30).get().then(function (snap) {
    var rows = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); }).sort(function (a, b) { return ms2(b.createdAt) - ms2(a.createdAt); });
    host.innerHTML = rows.length ? '<div class="ac-chan-grid">' + rows.map(chanCard).join('') + '</div>' : '<p class="ac-msg">You have not shared a video yet.</p>';
  }).catch(function () { host.innerHTML = '<p class="ac-msg err">Could not load your videos.</p>'; });
}
function wireChannelForm(u) {
  var input = $('acChanUrl'), msg = $('acChanMsg'), prev = $('acChanPrev'), btn = $('acChanPost'), titleEl = $('acChanTitle'), timer = null, seq = 0;
  chanForm = null;
  function say2(t, cls) { msg.textContent = t || ''; msg.className = 'ac-msg' + (cls ? ' ' + cls : ''); }
  function check() {
    var mine = ++seq, raw = input.value.trim();
    chanForm = null; btn.disabled = true; prev.innerHTML = ''; titleEl.style.display = 'none';
    if (!raw) return say2('');
    if (typeof window.afParseVideoLink !== 'function' || typeof window.afResolveVideoLink !== 'function') return say2('Video links are not ready. Please reload the page.', 'err');
    var info = window.afParseVideoLink(raw);
    if (!info) return say2('Paste a valid YouTube or TikTok video link.', 'err');
    say2('Checking link…');
    window.afResolveVideoLink(info).then(function (r) {
      if (mine !== seq) return;
      if (!r) return say2('Please paste the full TikTok link that looks like tiktok.com/@name/video/123…', 'err');
      chanForm = r;
      titleEl.style.display = ''; titleEl.value = r.title ? r.title.slice(0, 200) : '';
      prev.innerHTML = window.afLinkCardHtml({ linkProvider: r.provider, linkId: r.id, linkUrl: r.url, linkTitle: r.title, linkThumb: r.thumb });
      say2('Ready to post.', 'ok'); btn.disabled = false;
    });
  }
  input.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(check, 450); });
  input.addEventListener('paste', function () { setTimeout(check, 60); });
  btn.addEventListener('click', function () {
    var r = chanForm; if (!r || !db) return;
    var title = (titleEl.value || '').trim().slice(0, 200) || (r.provider === 'tiktok' ? 'TikTok video' : 'YouTube video');
    btn.disabled = true; btn.textContent = 'Posting…';
    db.collection('academyChannel').add({
      uid: u.uid, authorName: chanName(u), text: ($('acChanCap').value || '').trim().slice(0, 500),
      linkProvider: r.provider, linkUrl: r.url, linkId: r.id, linkTitle: title, linkThumb: (r.thumb && r.thumb.length <= 600) ? r.thumb : '',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(function () {
      chan.loaded = 0; say('Your video is now live ✅'); paintChannelPage();
      var g = $('acChanGrid'); if (g) paintChannelHome();
    }).catch(function (e) { btn.disabled = false; btn.textContent = 'Post Video'; say2(typeof firebaseErrorMessage === 'function' ? firebaseErrorMessage(e) : 'Could not post. Please try again.', 'err'); });
  });
}
function delChannel(id) {
  if (!confirm('Delete this video from Channel?')) return;
  db.collection('academyChannel').doc(id).delete().then(function () {
    chan.items = chan.items.filter(function (x) { return x.id !== id; }); chan.loaded = 0;
    say('Deleted'); paintChannelHome(); if (document.querySelector('.page.active') && document.querySelector('.page.active').id === 'acChannel') paintChannelPage();
  }).catch(function () { say('Could not delete.'); });
}
document.addEventListener('click', function (e) {
  var t = e.target.closest ? e.target : null; if (!t) return;
  var d = t.closest('[data-chan-del]'); if (d) { delChannel(d.getAttribute('data-chan-del')); return; }
  if (t.closest('#acChanMore')) { paintChannelHome(true); return; }
  var c = t.closest('[data-chan]'); if (!c) return;
  var a = c.getAttribute('data-chan');
  if (a === 'signin') needUser().then(function () { paintChannelPage(); });
  else if (a === 'getverified') { showPage('profile'); setTimeout(function () { var tg = $('acVerifyToggle'); if (tg && $('acVerify') && $('acVerify').hasAttribute('hidden')) tg.click(); if (tg && tg.scrollIntoView) tg.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 700); }
});

/* ================= 6. VERIFIED BADGE REQUEST + PAY WITH PI (Profile, Afrishine Skills only) ================= */
var VPLANS = [
  { id: 'verified', title: 'Verified', usd: 10, per: '/ 1 Year', note: 'YouTube & TikTok links in Channel' },
  { id: 'boost', title: 'Verified + Boost', usd: 15, per: '/ 30 Days', note: 'Boost your posts', pop: true },
  { id: 'vip', title: 'Verified VIP', usd: 150, per: '/ 30 Days', note: 'Unlock all features' }
];
var vstate = { plan: 'verified', pi: {}, busy: false };
var CONTACT_MAIL = 'afrishinehub@gmail.com';
function planOf(id) { return VPLANS.filter(function (p) { return p.id === id; })[0] || VPLANS[0]; }
function paintPlans() {
  var host = $('acvPlans'); if (!host) return;
  host.innerHTML = VPLANS.map(function (p) {
    var pi = vstate.pi[p.id];
    return '<button type="button" class="ac-plan' + (vstate.plan === p.id ? ' on' : '') + '" data-vplan="' + p.id + '" aria-pressed="' + (vstate.plan === p.id) + '">' + (p.pop ? '<span class="pop">Popular</span>' : '') +
      '<span class="dot"></span><span class="t"><b>' + plain(p.title) + '</b><small>' + plain(p.note) + '</small></span><span class="p"><b>$' + p.usd + '</b><small>' + plain(p.per) + (pi ? ' · ≈ ' + plain(piFmt(pi)) : '') + '</small></span></button>';
  }).join('');
  var pay = $('acvPay'); if (pay && !vstate.busy) pay.textContent = 'Pay with Pi Network · ' + (vstate.pi[vstate.plan] ? piFmt(vstate.pi[vstate.plan]) : '$' + planOf(vstate.plan).usd);
}
function loadPlanPrices() {
  return postJson('/api/pi-verify', { action: 'plans' }).then(function (d) { (d.plans || []).forEach(function (p) { vstate.pi[p.id] = p.amountPi; }); paintPlans(); }).catch(function () { });
}
function paintVerifyStatus() {
  var el = $('acvStatus'), u = chanUserNow(); if (!el) return;
  if (!u) { el.style.display = 'none'; return; }
  db.collection('publicProfiles').doc(u.uid).get().then(function (s) {
    var p = s.exists ? s.data() : null, until = p ? ms2(p.verifiedUntil) : 0, e = $('acvStatus'); if (!e) return;
    if (verifiedNow(p)) { e.style.display = ''; e.textContent = '✓ You are Verified' + (until ? ' until ' + dShort(p.verifiedUntil) : '') + '. Pay again to add more time.'; }
    else if (p && p.verifiedPlan && until) { e.style.display = ''; e.textContent = 'Your badge ended on ' + dShort(p.verifiedUntil) + '. Renew below.'; }
    else e.style.display = 'none';
  }).catch(function () { });
}
function fillVerifyPanel() {
  var panel = $('acVerify'); if (!panel) return;
  var u = chanUserNow();
  panel.innerHTML = '<h3>Professional Verification</h3><p class="sub">Request a Verified badge as a business or professional. Verified members can post in Channel and sell in the Store.</p><p class="ac-vstatus" id="acvStatus" style="display:none"></p>' +
    '<div class="ac-vgrid"><input class="field" id="acvProf" maxlength="100" placeholder="Profession / Business" autocomplete="organization-title"><textarea class="field" id="acvWhy" maxlength="500" placeholder="Explain why you are requesting verification (at least 10 characters)"></textarea></div>' +
    '<b style="display:block;margin:4px 0 2px">Choose your plan</b><div class="ac-plans" id="acvPlans"></div>' +
    '<div class="ac-vgrid"><input class="field ro" id="acvName" readonly placeholder="Your name"><input class="field ro" id="acvUser" readonly placeholder="Username"><input class="field" id="acvEmail" type="email" inputmode="email" maxlength="120" placeholder="Your e-mail address" autocomplete="email"></div>' +
    '<div class="ac-vbtns"><button type="button" class="gold pay" id="acvPay" data-acv="pay">Pay with Pi Network</button><button type="button" class="secondary" data-acv="request">Request Verification</button></div>' +
    '<p class="ac-msg" id="acvMsg" role="status"></p>' +
    '<p class="ac-help">Pay with Pi: your badge turns on as soon as the payment is complete. Request Verification: we review your details and contact you. Questions? Write to <a href="mailto:' + CONTACT_MAIL + '">' + CONTACT_MAIL + '</a>.</p>';
  var nm = (u && (u.displayName || '')) || sessionStorageGet('afrishine_pi_username') || '', un = sessionStorageGet('afrishine_pi_username') || '';
  $('acvName').value = nm; $('acvUser').value = un ? '@' + un : '';
  if (u && u.email) $('acvEmail').value = u.email;
  if (u && !un) db.collection('publicProfiles').doc(u.uid).get().then(function (s) { var d = s.exists ? s.data() : {}, v = d.piUsername || d.username || ''; if (v && $('acvUser')) { $('acvUser').value = '@' + v; if (!$('acvName').value) $('acvName').value = d.username || v; } }).catch(function () { });
  paintPlans(); loadPlanPrices(); paintVerifyStatus();
}
function mountVerify() {
  if (!ownAddress || $('acVerifyWrap')) return;
  var ed = $('ahProfileEditor'); if (!ed) return;
  var wrap = document.createElement('div'); wrap.id = 'acVerifyWrap'; wrap.style.margin = '12px 0 0';
  wrap.innerHTML = '<button type="button" class="secondary" id="acVerifyToggle">Request Verification</button><section class="ac-verify" id="acVerify" hidden></section>';
  var old = $('ahVerifyToggle');
  if (old && old.parentNode) old.parentNode.insertBefore(wrap, old); else ed.appendChild(wrap);
  $('acVerifyToggle').addEventListener('click', function () {
    var p = $('acVerify'), open = p.hasAttribute('hidden');
    if (open) { p.removeAttribute('hidden'); fillVerifyPanel(); this.textContent = 'Hide Verification'; } else { p.setAttribute('hidden', ''); this.textContent = 'Request Verification'; }
  });
}
(function () {                                    // the Profile editor is built after the page opens: mount when it appears
  var prof = $('profile'); if (!prof || !ownAddress || !window.MutationObserver) return;
  new MutationObserver(function () { mountVerify(); }).observe(prof, { childList: true });
  window.addEventListener('load', mountVerify);
})();
function vmsg(t, cls) { var m = $('acvMsg'); if (m) { m.textContent = t || ''; m.className = 'ac-msg' + (cls ? ' ' + cls : ''); } }
function readVerifyForm() {
  var prof = ($('acvProf').value || '').trim(), why = ($('acvWhy').value || '').trim(), email = ($('acvEmail').value || '').trim();
  if (prof.length < 2) { vmsg('Write your profession or business.', 'err'); return null; }
  if (why.length < 10) { vmsg('Explain why you are requesting verification (at least 10 characters).', 'err'); return null; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { vmsg('Enter a valid e-mail address.', 'err'); return null; }
  return { plan: vstate.plan, profession: prof, details: why, email: email, name: $('acvName').value, username: String($('acvUser').value || '').replace(/^@/, '') };
}
function submitVerify(pay) {
  if (vstate.busy) return;
  var f = readVerifyForm(); if (!f) return;
  if (pay && !inPi()) { window.afPiGate(); return; }
  vstate.busy = true; vmsg('Sending…');
  var payBtn = $('acvPay'); if (payBtn) payBtn.disabled = true;
  var done = function () { vstate.busy = false; if (payBtn) payBtn.disabled = false; paintPlans(); };
  needUser().then(function (u) {
    if (!u) { vmsg('Please sign in with Pi first.', 'err'); return done(); }
    return u.getIdToken().then(function (t) { f.idToken = t; return postJson('/api/pi-verify', Object.assign({ action: 'submit' }, f)); }).then(function (r) {
      if (!pay) { vmsg('Request sent ✅ We will review it and contact you by e-mail. Questions? ' + CONTACT_MAIL, 'ok'); return done(); }
      vmsg(''); done(); payVerify(r);
    });
  }).catch(function (e) { vmsg((e && e.message) || 'Could not send. Please try again.', 'err'); done(); });
}
function payVerify(r) {
  var o = sheet('<h3>Confirm payment</h3><p class="as-desc"><b>' + plain(r.label) + '</b> · ' + plain(planOf(r.plan).per.replace('/ ', '')) + '<br>Price: <b>$' + plain(r.usd) + '</b> = <b>' + piFmt(r.amountPi) + '</b><br>You pay with Pi. Your Verified badge turns on as soon as the payment is complete.</p><div class="as-actions static"><button type="button" class="as-btn ghost" data-as="sheet-close">Cancel</button><button type="button" class="as-btn main" id="acvConfirm">Pay ' + piFmt(r.amountPi) + '</button></div>');
  o.querySelector('#acvConfirm').addEventListener('click', function () {
    this.disabled = true; this.textContent = 'Opening Pi…';
    if (!window.__afPiInited) { try { window.Pi.init({ version: '2.0' }); window.__afPiInited = true; } catch (_) { } }
    Promise.resolve(window.Pi.authenticate(['username', 'payments'], piIncomplete)).catch(function () { }).then(function () {
      window.Pi.createPayment({ amount: Number(r.amountPi), memo: ('Afrishine ' + r.label + ' badge').slice(0, 120), metadata: { kind: 'verify', plan: r.plan, requestId: r.requestId } }, {
        onReadyForServerApproval: function (paymentId) { postJson('/api/pi-approve', { paymentId: paymentId }).catch(function (e) { say(e.message); }); },
        onReadyForServerCompletion: function (paymentId, txid) {
          postJson('/api/pi-complete', { paymentId: paymentId, txid: txid }).then(function () {
            closeOv('asSheet'); chanVer = {}; say('Payment complete ✅ You are Verified!'); paintVerifyStatus(); vmsg('You are Verified ✅', 'ok');
          }).catch(function (e) { say(e.message); });
        },
        onCancel: function () { closeOv('asSheet'); say('Payment cancelled.'); },
        onError: function () { closeOv('asSheet'); say('Payment failed. Please try again.'); }
      });
    });
  });
}
document.addEventListener('click', function (e) {
  var pl = e.target.closest ? e.target.closest('[data-vplan]') : null;
  if (pl) { vstate.plan = pl.getAttribute('data-vplan'); paintPlans(); return; }
  var a = e.target.closest ? e.target.closest('[data-acv]') : null; if (!a) return;
  submitVerify(a.getAttribute('data-acv') === 'pay');
});

/* ================= 2. ACADEMY-ONLY MODE (own address) ================= */
if (!ownAddress) return;

var ALLOWED = { academy: 1, trafficRules: 1, trafficList: 1, profile: 1, settings: 1, contact: 1, acLibrary: 1, acServices: 1, acFreelance: 1, acCommunity: 1, acBooking: 1, acStore: 1, acInbox: 1, acChannel: 1 };
document.documentElement.classList.add('academy-only');
document.body.classList.add('academy-only');
document.title = 'Afrishine Skills · Learn. Create. Teach. Earn.';

/* Header: Academy name, a link back to the Hub; the Hub search and menu are hidden by style.css */
var brand = document.querySelector('header .brand');
if (brand) brand.innerHTML = '<b class="brand-mark" aria-hidden="true">🎓</b><span><strong>Afrishine <span style="color:var(--gold)">Skills</span></strong><small>Learn • Create • Teach • Earn</small></span>';
var actions = document.querySelector('header .header-actions');
if (actions && !piOnly) {
  var hub = document.createElement('a');
  hub.className = 'ac-hub-link'; hub.href = HUB_URL; hub.rel = 'noopener'; hub.textContent = 'Afrishine Hub ↗';
  actions.appendChild(hub);
}

/* Afrishine Skills: Pi sign-in only (no email panel) */
if (piOnly) {
  var emailForm = document.getElementById('emailAuthForm'), emailPanel = emailForm && emailForm.closest ? emailForm.closest('.panel') : null;
  if (emailPanel) emailPanel.classList.add('ac-email');   // hidden by style.css (the page router resets inline styles)
}

/* Any page that belongs to the Hub opens the Academy instead */
var hubShowPage = window.showPage;
window.showPage = function (id) {
  if (!ALLOWED[id]) id = 'academy';
  return hubShowPage(id);
};

/* First page: the Academy (or the allowed page named in the address) */
var hashId = '';
try { hashId = decodeURIComponent((location.hash || '').replace('#', '')); } catch (e) { hashId = ''; }
var routeId = typeof getAfrishineRoutePage === 'function' ? getAfrishineRoutePage() : '';
window.showPage(ALLOWED[hashId] ? hashId : (ALLOWED[routeId] ? routeId : 'academy'));
if (typeof closeMenu === 'function') closeMenu();
})();
