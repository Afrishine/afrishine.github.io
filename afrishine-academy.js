/* Afrishine Academy (afrishine-academy.js)
   1) Academy content: the free "Amategeko y'umuhanda" (traffic rules) course, its files and viewer.
   2) "Academy-only" mode: when the site is opened on the Academy address (afrishine-academy….vercel.app,
      or any address with ?mode=academy) only the Academy is shown. On the normal Hub address nothing changes.
   Loads AFTER app-extras.js. */
(function () {
'use strict';

var HUB_URL = 'https://afrishinegithubio.vercel.app/';
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
  paint: function () { paintTrafficGrid(); return loadAcademyFiles(false).then(paintTrafficGrid); }
};
window.afAcademyReload = function () { academy.at = 0; return loadAcademyFiles(true); };

/* ================= 2. ACADEMY-ONLY MODE (own address) ================= */
var ownAddress = /^afrishine-academy/i.test(location.hostname) || /[?&]mode=academy\b/.test(location.search);
if (!ownAddress) return;

var ALLOWED = { academy: 1, trafficRules: 1, trafficList: 1, profile: 1, settings: 1, contact: 1 };
document.documentElement.classList.add('academy-only');
document.body.classList.add('academy-only');
document.title = 'Afrishine Academy · Learn. Grow. Succeed.';

/* Header: Academy name, a link back to the Hub; the Hub search and menu are hidden by style.css */
var brand = document.querySelector('header .brand');
if (brand) brand.innerHTML = '<b class="brand-mark" aria-hidden="true">🎓</b><span><strong><span style="color:var(--gold)">Afrishine</span> Academy</strong><small>Learn. Grow. Succeed.</small></span>';
var actions = document.querySelector('header .header-actions');
if (actions) {
  var hub = document.createElement('a');
  hub.className = 'ac-hub-link'; hub.href = HUB_URL; hub.rel = 'noopener'; hub.textContent = 'Afrishine Hub ↗';
  actions.appendChild(hub);
}

/* Academy bottom navigation */
var nav = document.createElement('nav');
nav.className = 'academy-nav'; nav.setAttribute('aria-label', 'Academy navigation');
nav.innerHTML = '<button type="button" data-ac="academy">🎓<small>Academy</small></button><button type="button" data-ac="trafficRules">🚦<small>Traffic Rules</small></button><button type="button" data-ac="profile">👤<small>Profile</small></button>';
document.body.appendChild(nav);
nav.addEventListener('click', function (e) { var b = e.target.closest('[data-ac]'); if (b) showPage(b.getAttribute('data-ac')); });
function markNav(id) {
  var current = id === 'trafficList' ? 'trafficRules' : id;
  Array.prototype.forEach.call(nav.querySelectorAll('[data-ac]'), function (b) { b.classList.toggle('active', b.getAttribute('data-ac') === current); });
}

/* Any page that belongs to the Hub opens the Academy instead */
var hubShowPage = window.showPage;
window.showPage = function (id) {
  if (!ALLOWED[id]) id = 'academy';
  var r = hubShowPage(id);
  markNav(id);
  return r;
};

/* First page: the Academy (or the allowed page named in the address) */
var hashId = '';
try { hashId = decodeURIComponent((location.hash || '').replace('#', '')); } catch (e) { hashId = ''; }
var routeId = typeof getAfrishineRoutePage === 'function' ? getAfrishineRoutePage() : '';
window.showPage(ALLOWED[hashId] ? hashId : (ALLOWED[routeId] ? routeId : 'academy'));
if (typeof closeMenu === 'function') closeMenu();
})();
