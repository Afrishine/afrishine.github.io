/* Afrishine Skills - PROFESSIONAL SERVICES: categories, list of professionals (photo, rating, place, price, Verified),
   profile sheet with reviews and "Book Now". Only Verified members can create a professional profile (skillsPros/{uid}).
   Reviews are written by clients after a completed booking (skillsReviews/{bookingId}). */
(function () {
'use strict';
var AF = window.afSkills; if (!AF) return;
var esc = AF.esc, $ = AF.$;
var SERVICES = [
  { id: 'electrician', name: 'Electrician', icon: '⚡' }, { id: 'cctv', name: 'CCTV installer', icon: '📹' }, { id: 'plumber', name: 'Plumber', icon: '🚰' },
  { id: 'mechanic', name: 'Mechanic', icon: '🔧' }, { id: 'repair', name: 'Computer & phone repair', icon: '💻' }, { id: 'builder', name: 'Builder / mason', icon: '🧱' },
  { id: 'painter', name: 'Painter', icon: '🎨' }, { id: 'carpenter', name: 'Carpenter', icon: '🪚' }, { id: 'cleaner', name: 'Cleaner', icon: '🧹' }, { id: 'other', name: 'Other', icon: '➕' }
];
AF.SERVICES = SERVICES;
function svc(id) { return SERVICES.filter(function (s) { return s.id === id; })[0] || SERVICES[SERVICES.length - 1]; }
var S = { cat: '', q: '', pros: [], rating: {}, prof: {}, loaded: 0 };

function load(force) {
  if (!force && S.loaded && Date.now() - S.loaded < 60000) return Promise.resolve();
  var d = AF.db();
  return Promise.all([d.collection('skillsPros').limit(200).get(), d.collection('skillsReviews').limit(500).get().catch(function () { return { docs: [] }; })]).then(function (r) {
    S.pros = r[0].docs.map(function (x) { return Object.assign({ id: x.id }, x.data()); }).filter(function (p) { return p.active !== false; });
    S.rating = {}; r[1].docs.forEach(function (x) { var v = x.data(); if (!v.proUid) return; var o = S.rating[v.proUid] || (S.rating[v.proUid] = { sum: 0, n: 0 }); o.sum += Number(v.rating) || 0; o.n++; });
    S.loaded = Date.now();
    return AF.profiles(S.pros.map(function (p) { return p.uid; })).then(function (m) { S.prof = m; });
  }).catch(function () { });
}
function avg(uid) { var o = S.rating[uid]; return o && o.n ? o.sum / o.n : 0; }
AF.proAvg = avg;
AF.prosByCategory = function (cat) { return load(false).then(function () { return S.pros.filter(function (p) { return !cat || p.category === cat; }); }); };

function paint() {
  var box = AF.body('acServices', 'skProBody'); if (!box) return;
  if (!$('skProList')) {
    box.innerHTML = '<div class="as-bar"><input id="skProQ" type="search" placeholder="Search a professional or place…" aria-label="Search"><button type="button" class="as-sell" data-sk="pro-mine" id="skProMine">＋ My profile</button></div><div id="skProChips"></div><div id="skProList"></div>';
    $('skProQ').addEventListener('input', function () { S.q = this.value; paintList(); });
    $('skProChips').innerHTML = AF.chips(SERVICES, S.cat, 'pro-chip', 'All');
  }
  $('skProList').innerHTML = '<p class="as-note">Loading…</p>';
  load(false).then(paintList);
}
function paintList() {
  var host = $('skProList'); if (!host) return;
  $('skProChips').innerHTML = AF.chips(SERVICES, S.cat, 'pro-chip', 'All');
  var q = S.q.toLowerCase();
  var list = S.pros.filter(function (p) { return (!S.cat || p.category === S.cat) && (!q || (p.name + ' ' + (p.city || '') + ' ' + (p.about || '') + ' ' + svc(p.category).name).toLowerCase().indexOf(q) >= 0); })
    .sort(function (a, b) { return (avg(b.uid) - avg(a.uid)) || (AF.ms(b.createdAt) - AF.ms(a.createdAt)); });
  if (!list.length) { host.innerHTML = AF.empty('🧰', S.pros.length ? 'No match' : 'No professionals yet', S.pros.length ? 'Try another category or word.' : 'Verified professionals can add their profile with “＋ My profile”.'); return; }
  host.innerHTML = list.map(function (p) {
    var r = avg(p.uid), n = (S.rating[p.uid] || {}).n || 0, v = S.prof[p.uid] && S.prof[p.uid].verified;
    return '<button type="button" class="sk-pro" data-sk="pro-open" data-id="' + esc(p.uid) + '">' + AF.avatar(p.name, p.photo, 'lg') + '<span class="sk-pro-main"><b>' + esc(p.name) + ' ' + AF.vchip(v) + '</b><small>' + esc(svc(p.category).icon + ' ' + svc(p.category).name) + (p.city ? ' · 📍 ' + esc(p.city) : '') + '</small>' +
      '<span class="sk-pro-rate">' + (n ? AF.stars(r) + ' <em>' + r.toFixed(1) + ' (' + n + ')</em>' : '<em>New</em>') + '</span></span><span class="sk-pro-price">' + esc(p.price || '') + '</span></button>';
  }).join('');
}
AF.on('pro-chip', function (el) { S.cat = el.getAttribute('data-id') || ''; paintList(); });

/* ---------- profile sheet ---------- */
function find(uid) { return S.pros.filter(function (p) { return p.uid === uid; })[0]; }
function openPro(uid) {
  var p = find(uid); if (!p) return;
  var r = avg(uid), n = (S.rating[uid] || {}).n || 0, v = S.prof[uid] && S.prof[uid].verified, me = AF.piUser(), mine = me && me.uid === uid;
  AF.sheet('<div class="sk-pro-head">' + AF.avatar(p.name, p.photo, 'xl') + '<div><h3>' + esc(p.name) + '</h3>' + AF.vchip(v) + '<small>' + esc(svc(p.category).icon + ' ' + svc(p.category).name) + '</small></div></div>' +
    '<div class="sk-meta">' + (n ? '<span class="sk-tag">' + AF.stars(r) + ' ' + r.toFixed(1) + ' (' + n + ')</span>' : '<span class="sk-tag">New</span>') + (p.city ? '<span class="sk-tag">📍 ' + esc(p.city) + '</span>' : '') + (p.price ? '<span class="sk-tag">💰 ' + esc(p.price) + '</span>' : '') + '</div>' +
    '<p class="as-desc">' + esc(p.about || 'No description yet.') + '</p><div class="sk-reviews" id="skProRev"><p class="as-note">Loading reviews…</p></div>' +
    (mine ? '<div class="as-actions static"><button type="button" class="as-btn main" data-sk="pro-edit">✏️ Edit my profile</button><button type="button" class="as-btn danger" data-sk="pro-remove">Remove</button></div>'
      : '<div class="as-actions static"><button type="button" class="as-btn main" data-sk="pro-book" data-id="' + esc(uid) + '">📅 Book Now</button><button type="button" class="as-btn ghost" data-sk="pro-msg" data-id="' + esc(uid) + '">💬 Message</button></div>') +
    (AF.isAdmin() && !mine ? '<div class="as-actions static"><button type="button" class="as-btn danger" data-sk="pro-admin-del" data-id="' + esc(uid) + '">Remove (admin)</button></div>' : '') +
    '<div class="as-actions static"><button type="button" class="as-btn ghost" data-sk="close-sheet">Close</button></div>');
  AF.db().collection('skillsReviews').where('proUid', '==', uid).limit(30).get().then(function (snap) {
    var host = $('skProRev'); if (!host) return;
    var rows = snap.docs.map(function (d) { return d.data(); }).sort(function (a, b) { return AF.ms(b.createdAt) - AF.ms(a.createdAt); }).slice(0, 20);
    host.innerHTML = rows.length ? '<b>Reviews</b>' + rows.map(function (x) { return '<div class="sk-review">' + AF.stars(x.rating) + ' <b>' + esc(x.name || 'Client') + '</b><small>' + esc(AF.fmtDate(AF.ms(x.createdAt))) + '</small>' + (x.text ? '<p>' + esc(x.text) + '</p>' : '') + '</div>'; }).join('') : '<p class="as-note">No reviews yet.</p>';
  }).catch(function () { var h = $('skProRev'); if (h) h.innerHTML = ''; });
}
AF.on('pro-open', function (el) { openPro(el.getAttribute('data-id')); });
AF.on('pro-book', function (el) { var p = find(el.getAttribute('data-id')); if (p && AF.booking) { AF.closeSheet(); AF.booking.open({ pro: p }); } });
AF.on('pro-msg', function (el) { var p = find(el.getAttribute('data-id')); if (p) AF.chat('pro_' + p.uid, p.uid, p.name, svc(p.category).name); });
AF.on('pro-admin-del', function (el) { var id = el.getAttribute('data-id'); if (!AF.isAdmin() || !confirm('Remove this professional profile?')) return; AF.db().collection('skillsPros').doc(id).delete().then(function () { AF.closeSheet(); load(true).then(paintList); }).catch(function () { AF.say('Could not remove.'); }); });

/* ---------- create / edit my profile (Verified only) ---------- */
function form(existing) {
  var p = existing || {};
  var o = AF.sheet('<h3>' + (existing ? 'Edit my professional profile' : 'Create my professional profile') + '</h3>' +
    '<select class="as-input" id="skPrCat">' + SERVICES.map(function (s) { return '<option value="' + s.id + '"' + (p.category === s.id ? ' selected' : '') + '>' + esc(s.icon + ' ' + s.name) + '</option>'; }).join('') + '</select>' +
    '<input class="as-input" id="skPrName" maxlength="60" placeholder="Your name or business name" value="' + esc(p.name || AF.myName()) + '">' +
    '<input class="as-input" id="skPrCity" maxlength="60" placeholder="Where you work (e.g. Kigali, Nyamirambo)" value="' + esc(p.city || '') + '">' +
    '<input class="as-input" id="skPrPrice" maxlength="40" placeholder="Price (e.g. from 5,000 RWF)" value="' + esc(p.price || '') + '">' +
    '<textarea class="as-input" id="skPrAbout" rows="4" maxlength="600" placeholder="What you do, your experience…">' + esc(p.about || '') + '</textarea>' +
    '<label class="as-file">📷 ' + (p.photo ? 'Change photo' : 'Add photo') + '<input id="skPrPhoto" type="file" accept="image/*" hidden></label><div class="as-prev" id="skPrPrev">' + (p.photo ? '<img src="' + esc(p.photo) + '" alt="">' : '') + '</div>' +
    '<div class="as-actions static"><button type="button" class="as-btn ghost" data-sk="close-sheet">Cancel</button><button type="button" class="as-btn main" data-sk="pro-save">Save profile</button></div>');
  var file = null;
  o.querySelector('#skPrPhoto').addEventListener('change', function () { file = (this.files || [])[0] || null; if (file) $('skPrPrev').innerHTML = '<img src="' + URL.createObjectURL(file) + '" alt="">'; });
  S.formFile = function () { return file; }; S.formOld = existing || null;
}
function mine() {
  AF.needPi().then(function (u) {
    if (!u) return;
    AF.verified(u.uid).then(function (ok) {
      if (!ok) { AF.sheet('<h3>Verified members only</h3><p class="as-desc">Only members with a Verified badge can create a professional profile. Get your badge from Profile → Verified Badge, then come back.</p><div class="as-actions static"><button type="button" class="as-btn main" data-sk="close-sheet">OK</button></div>'); return; }
      load(true).then(function () { form(find(u.uid)); });
    });
  });
}
AF.on('pro-mine', mine);
AF.on('pro-edit', function () { var u = AF.piUser(); if (u) form(find(u.uid)); });
AF.on('pro-save', function (el) {
  var u = AF.piUser(); if (!u) return;
  var name = AF.val('skPrName'), about = AF.val('skPrAbout');
  if (name.length < 2) { AF.say('Write your name.'); return; }
  if (about.length < 10) { AF.say('Tell clients what you do (at least 10 characters).'); return; }
  AF.busy(el, true, 'Saving…');
  var f = S.formFile && S.formFile(), old = S.formOld;
  (f ? AF.upload(f, 8).then(function (d) { return d.url; }) : Promise.resolve((old && old.photo) || '')).then(function (photo) {
    var doc = { uid: u.uid, name: name.slice(0, 60), category: AF.val('skPrCat'), city: AF.val('skPrCity').slice(0, 60), price: AF.val('skPrPrice').slice(0, 40), about: about.slice(0, 600), photo: photo || '', active: true, updatedAt: AF.ts() };
    if (!old) doc.createdAt = AF.ts();
    return AF.db().collection('skillsPros').doc(u.uid).set(doc, { merge: true });
  }).then(function () { AF.closeSheet(); AF.say('Profile saved.'); return load(true); }).then(paintList)
    .catch(function (e) { AF.busy(el, false); AF.say(e && e.message && !e.code ? e.message : 'Could not save. Check that your Verified badge is active.'); });
});
AF.on('pro-remove', function () {
  var u = AF.piUser(); if (!u || !confirm('Remove your professional profile?')) return;
  AF.db().collection('skillsPros').doc(u.uid).delete().then(function () { AF.closeSheet(); AF.say('Profile removed.'); return load(true); }).then(paintList).catch(function () { AF.say('Could not remove.'); });
});

AF.mount('acServices', paint);
AF.pro = { reload: function () { return load(true); }, find: find, service: svc };
})();
