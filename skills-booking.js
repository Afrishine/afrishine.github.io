/* Afrishine Skills - BOOK A SERVICE: service -> professional (or anyone nearby) -> date/time -> place + details -> summary
   -> "Pay after service". Status: Pending -> Accepted -> Completed (or Declined / Cancelled). Rating after completion.
   Collection skillsBookings. Only the assigned professional can change a booking's status; the client can only cancel or rate. */
(function () {
'use strict';
var AF = window.afSkills; if (!AF) return;
var esc = AF.esc, $ = AF.$;
var SV = function () { return AF.SERVICES || [{ id: 'other', name: 'Other', icon: '➕' }]; };
function svc(id) { return SV().filter(function (s) { return s.id === id; })[0] || { id: id, name: id, icon: '🧰' }; }
var LABEL = { pending: 'Pending', accepted: 'Accepted', completed: 'Completed', declined: 'Declined', cancelled: 'Cancelled' };
var S = { tab: 'mine', mine: [], reqs: [], open: [], isPro: false, myPro: null };
var W = null;       // the booking wizard

function today() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
function when(b) { return esc(b.date || '') + ' · ' + esc(b.time || ''); }

/* ---------- page ---------- */
function paint() {
  var box = AF.body('acBooking', 'skBookBody'); if (!box) return;
  var u = AF.piUser();
  box.innerHTML = '<div class="as-bar"><button type="button" class="as-sell sk-wide" data-sk="bk-new">＋ Book a service</button></div><div id="skBkTabs"></div><div id="skBkList"></div>';
  if (!u) { $('skBkList').innerHTML = AF.empty('📅', 'Sign in to see your bookings', 'Book an expert in a few taps. You pay after the service.', '<button type="button" class="as-btn main" data-sk="bk-login">Sign in with Pi</button>'); return; }
  $('skBkList').innerHTML = '<p class="as-note">Loading…</p>';
  load(u).then(paintLists);
}
AF.on('bk-login', function () { AF.needPi().then(function (u) { if (u) paint(); }); });

function load(u) {
  var d = AF.db();
  var sort = function (a) { return a.sort(function (x, y) { return AF.ms(y.createdAt) - AF.ms(x.createdAt); }); };
  var pro = d.collection('skillsPros').doc(u.uid).get().then(function (s) { S.myPro = s.exists ? s.data() : null; S.isPro = !!S.myPro; }).catch(function () { S.isPro = false; });
  return Promise.all([
    d.collection('skillsBookings').where('clientUid', '==', u.uid).limit(60).get().then(function (s) { S.mine = sort(s.docs.map(function (x) { return Object.assign({ id: x.id }, x.data()); })); }).catch(function () { S.mine = []; }),
    pro
  ]).then(function () {
    if (!S.isPro) { S.reqs = []; S.open = []; return; }
    return Promise.all([
      d.collection('skillsBookings').where('proUid', '==', u.uid).limit(60).get().then(function (s) { S.reqs = sort(s.docs.map(function (x) { return Object.assign({ id: x.id }, x.data()); })); }).catch(function () { S.reqs = []; }),
      d.collection('skillsBookings').where('proUid', '==', '').limit(40).get().then(function (s) { S.open = sort(s.docs.map(function (x) { return Object.assign({ id: x.id }, x.data()); })).filter(function (b) { return b.status === 'pending' && b.clientUid !== u.uid && b.service === S.myPro.category; }); }).catch(function () { S.open = []; })
    ]);
  });
}
function paintLists() {
  var tabs = $('skBkTabs'), host = $('skBkList'); if (!tabs || !host) return;
  var pend = S.reqs.filter(function (b) { return b.status === 'pending'; }).length + S.open.length;
  tabs.innerHTML = '<div class="sk-tabs"><button type="button" class="' + (S.tab === 'mine' ? 'on' : '') + '" data-sk="bk-tab" data-id="mine">My bookings</button>' + (S.isPro ? '<button type="button" class="' + (S.tab === 'reqs' ? 'on' : '') + '" data-sk="bk-tab" data-id="reqs">Requests' + (pend ? ' <em class="sk-dot">' + pend + '</em>' : '') + '</button>' : '') + '</div>';
  if (S.tab === 'reqs' && S.isPro) {
    var all = S.open.concat(S.reqs);
    host.innerHTML = all.length ? all.map(function (b) { return card(b, 'pro'); }).join('') : AF.empty('📥', 'No requests yet', 'New booking requests for your service will appear here.');
  } else host.innerHTML = S.mine.length ? S.mine.map(function (b) { return card(b, 'client'); }).join('') : AF.empty('📅', 'No bookings yet', 'Tap “Book a service” to book an expert.');
}
AF.on('bk-tab', function (el) { S.tab = el.getAttribute('data-id'); paintLists(); });
function card(b, as) {
  var s = svc(b.service), who = as === 'pro' ? (b.clientName || 'Client') : (b.proUid ? (b.proName || 'Professional') : 'Anyone nearby');
  var acts = '';
  if (as === 'client') {
    if (b.status === 'pending' || b.status === 'accepted') acts += '<button type="button" class="as-btn danger" data-sk="bk-set" data-id="' + esc(b.id) + '" data-to="cancelled">Cancel</button>';
    if (b.status === 'completed' && !b.rated) acts += '<button type="button" class="as-btn main" data-sk="bk-rate" data-id="' + esc(b.id) + '">⭐ Rate</button>';
    if (b.proUid && b.status !== 'cancelled' && b.status !== 'declined') acts += '<button type="button" class="as-btn ghost" data-sk="bk-chat" data-id="' + esc(b.id) + '">💬 Message</button>';
  } else {
    if (b.status === 'pending' && !b.proUid) acts += '<button type="button" class="as-btn main" data-sk="bk-claim" data-id="' + esc(b.id) + '">Accept</button>';
    else if (b.status === 'pending') acts += '<button type="button" class="as-btn main" data-sk="bk-set" data-id="' + esc(b.id) + '" data-to="accepted">Accept</button><button type="button" class="as-btn danger" data-sk="bk-set" data-id="' + esc(b.id) + '" data-to="declined">Decline</button>';
    if (b.status === 'accepted') acts += '<button type="button" class="as-btn main" data-sk="bk-set" data-id="' + esc(b.id) + '" data-to="completed">✓ Mark completed</button>';
    if (b.proUid) acts += '<button type="button" class="as-btn ghost" data-sk="bk-chat" data-id="' + esc(b.id) + '" data-as="pro">💬 Message</button>';
  }
  return '<div class="sk-bk"><div class="sk-bk-top"><b>' + esc(s.icon + ' ' + (b.serviceName || s.name)) + '</b><span class="sk-st ' + esc(b.status) + '">' + esc(LABEL[b.status] || b.status) + '</span></div>' +
    '<small>' + (as === 'pro' ? '👤 ' : '🧑‍🔧 ') + esc(who) + ' · 📅 ' + when(b) + '</small><small>📍 ' + esc(b.address || '') + '</small>' + (b.notes ? '<p>' + esc(b.notes) + '</p>' : '') +
    '<small>💵 Pay after service' + (b.rated ? ' · ⭐ Rated' : '') + '</small>' + (acts ? '<div class="sk-bk-acts">' + acts + '</div>' : '') + '</div>';
}
function findB(id) { return S.mine.concat(S.reqs, S.open).filter(function (b) { return b.id === id; })[0]; }

/* ---------- status changes ---------- */
AF.on('bk-set', function (el) {
  var b = findB(el.getAttribute('data-id')), to = el.getAttribute('data-to'); if (!b) return;
  if (to === 'cancelled' && !confirm('Cancel this booking?')) return;
  AF.busy(el, true, '…');
  AF.db().collection('skillsBookings').doc(b.id).update({ status: to, updatedAt: AF.ts() }).then(function () { return AF.piUser() && load(AF.piUser()); }).then(paintLists)
    .catch(function () { AF.busy(el, false); AF.say('Could not update this booking.'); });
});
AF.on('bk-claim', function (el) {
  var b = findB(el.getAttribute('data-id')), u = AF.piUser(); if (!b || !u || !S.myPro) return;
  AF.busy(el, true, '…');
  AF.db().collection('skillsBookings').doc(b.id).update({ proUid: u.uid, proName: String(S.myPro.name || AF.myName()).slice(0, 60), status: 'accepted', updatedAt: AF.ts() }).then(function () { return load(u); }).then(paintLists)
    .catch(function () { AF.busy(el, false); AF.say('Someone else may have taken this request.'); load(u).then(paintLists); });
});
AF.on('bk-chat', function (el) {
  var b = findB(el.getAttribute('data-id')), u = AF.piUser(); if (!b || !u || !b.proUid) return;
  if (el.getAttribute('data-as') === 'pro') AF.say('Open your messages from Inbox.'); else AF.chat('book_' + b.id, b.proUid, b.proName, svc(b.service).name);
});

/* ---------- rating ---------- */
AF.on('bk-rate', function (el) {
  var b = findB(el.getAttribute('data-id')); if (!b) return;
  W = W || {}; W.rate = { id: b.id, n: 5 };
  AF.sheet('<h3>Rate ' + esc(b.proName || 'the professional') + '</h3><div class="sk-rate" id="skRate">' + [1, 2, 3, 4, 5].map(function (i) { return '<button type="button" class="on" data-sk="bk-star" data-id="' + i + '">★</button>'; }).join('') + '</div><textarea class="as-input" id="skRateText" rows="3" maxlength="300" placeholder="How was the service? (optional)"></textarea><div class="as-actions static"><button type="button" class="as-btn ghost" data-sk="close-sheet">Cancel</button><button type="button" class="as-btn main" data-sk="bk-rate-send">Send review</button></div>');
});
AF.on('bk-star', function (el) {
  var n = Number(el.getAttribute('data-id')); W.rate.n = n;
  Array.prototype.forEach.call($('skRate').children, function (b, i) { b.className = i < n ? 'on' : ''; });
});
AF.on('bk-rate-send', function (el) {
  var u = AF.piUser(), r = W && W.rate, b = r && findB(r.id); if (!u || !b) return;
  AF.busy(el, true, 'Sending…');
  var d = AF.db(), batch = d.batch();
  batch.set(d.collection('skillsReviews').doc(b.id), { bookingId: b.id, proUid: b.proUid, clientUid: u.uid, rating: r.n, text: AF.val('skRateText').slice(0, 300), name: AF.myName(), createdAt: AF.ts() });
  batch.update(d.collection('skillsBookings').doc(b.id), { rated: true, updatedAt: AF.ts() });
  batch.commit().then(function () { AF.closeSheet(); AF.say('Thank you for your review!'); if (AF.pro) AF.pro.reload(); return load(u); }).then(paintLists)
    .catch(function () { AF.busy(el, false); AF.say('Could not send your review.'); });
});

/* ---------- wizard ---------- */
function open(opts) {
  AF.needPi().then(function (u) {
    if (!u) return;
    var pro = opts && opts.pro || null;
    W = { step: pro ? 3 : 1, service: pro ? pro.category : '', pro: pro, any: false, date: '', time: '', address: '', notes: '', pros: [] };
    wiz();
  });
}
function steps() { return 5; }
function wiz() {
  var h = '<div class="sk-steps">' + [1, 2, 3, 4, 5].map(function (i) { return '<i class="' + (i <= W.step ? 'on' : '') + '"></i>'; }).join('') + '</div>';
  if (W.step === 1) {
    h += '<h3>1 · What do you need?</h3>' + '<div class="sk-svc">' + SV().map(function (s) { return '<button type="button" class="sk-chip big' + (W.service === s.id ? ' on' : '') + '" data-sk="bk-svc" data-id="' + s.id + '">' + esc(s.icon) + '<br>' + esc(s.name) + '</button>'; }).join('') + '</div>';
  } else if (W.step === 2) {
    h += '<h3>2 · Choose a professional</h3><div id="skBkPros"><p class="as-note">Loading…</p></div>';
  } else if (W.step === 3) {
    h += '<h3>3 · Date and time</h3>' + (W.pro ? '<p class="as-note" style="text-align:left">With <b>' + esc(W.pro.name) + '</b> (' + esc(svc(W.service).name) + ')</p>' : '') +
      '<label class="sk-lab">Date<input class="as-input" id="skBkDate" type="date" min="' + today() + '" value="' + esc(W.date) + '"></label><label class="sk-lab">Time<input class="as-input" id="skBkTime" type="time" value="' + esc(W.time) + '"></label>';
  } else if (W.step === 4) {
    h += '<h3>4 · Where are you?</h3><input class="as-input" id="skBkAddr" maxlength="160" placeholder="Your location (district, street, landmark)" value="' + esc(W.address) + '"><textarea class="as-input" id="skBkNotes" rows="4" maxlength="500" placeholder="Describe what you need…">' + esc(W.notes) + '</textarea>';
  } else {
    h += '<h3>5 · Summary</h3><div class="sk-sum"><p><span>Service</span><b>' + esc(svc(W.service).icon + ' ' + svc(W.service).name) + '</b></p><p><span>Professional</span><b>' + esc(W.pro ? W.pro.name : 'Anyone nearby') + '</b></p><p><span>When</span><b>' + esc(W.date) + ' · ' + esc(W.time) + '</b></p><p><span>Where</span><b>' + esc(W.address) + '</b></p>' + (W.notes ? '<p><span>Details</span><b>' + esc(W.notes) + '</b></p>' : '') + '<p><span>Payment</span><b>💵 Pay after service</b></p></div><p class="as-note">The professional will accept or decline. You pay them directly once the work is done.</p>';
  }
  h += '<div class="as-actions static"><button type="button" class="as-btn ghost" data-sk="' + (W.step === 1 || (W.step === 3 && W.pro && W.fixed) ? 'close-sheet' : 'bk-back') + '">' + (W.step === 1 ? 'Cancel' : '← Back') + '</button>' +
    (W.step === 5 ? '<button type="button" class="as-btn main" data-sk="bk-confirm">Confirm booking</button>' : W.step === 2 ? '' : '<button type="button" class="as-btn main" data-sk="bk-next">Next →</button>') + '</div>';
  AF.sheet(h);
  if (W.step === 2) AF.prosByCategory(W.service).then(function (list) {
    var host = $('skBkPros'); if (!host) return; W.pros = list;
    host.innerHTML = '<button type="button" class="sk-pro" data-sk="bk-any"><span class="sk-av lg">📍</span><span class="sk-pro-main"><b>Anyone nearby</b><small>The first professional to accept takes the job</small></span></button>' +
      list.map(function (p) { var r = AF.proAvg(p.uid); return '<button type="button" class="sk-pro" data-sk="bk-pick" data-id="' + esc(p.uid) + '">' + AF.avatar(p.name, p.photo, 'lg') + '<span class="sk-pro-main"><b>' + esc(p.name) + '</b><small>' + (p.city ? '📍 ' + esc(p.city) + ' · ' : '') + (r ? '★ ' + r.toFixed(1) : 'New') + '</small></span><span class="sk-pro-price">' + esc(p.price || '') + '</span></button>'; }).join('');
  });
}
function grab() {
  if (W.step === 3) { W.date = AF.val('skBkDate'); W.time = AF.val('skBkTime'); }
  if (W.step === 4) { W.address = AF.val('skBkAddr'); W.notes = AF.val('skBkNotes'); }
}
AF.on('bk-new', function () { open(); });
AF.on('bk-svc', function (el) { W.service = el.getAttribute('data-id'); W.pro = null; W.any = false; W.step = 2; wiz(); });
AF.on('bk-any', function () { W.pro = null; W.any = true; W.step = 3; wiz(); });
AF.on('bk-pick', function (el) { W.pro = W.pros.filter(function (p) { return p.uid === el.getAttribute('data-id'); })[0] || null; W.step = 3; wiz(); });
AF.on('bk-back', function () { grab(); W.step = Math.max(1, W.step - 1); if (W.step === 2 && W.pro && !W.pros.length) W.step = 1; wiz(); });
AF.on('bk-next', function () {
  grab();
  if (W.step === 3) { if (!W.date || !W.time) { AF.say('Choose the date and time.'); return; } if (W.date < today()) { AF.say('Choose a date from today.'); return; } }
  if (W.step === 4 && W.address.length < 3) { AF.say('Write where you are.'); return; }
  W.step = Math.min(5, W.step + 1); wiz();
});
AF.on('bk-confirm', function (el) {
  var u = AF.piUser(); if (!u || !W) return;
  if (W.pro && W.pro.uid === u.uid) { AF.say('You cannot book yourself.'); return; }
  AF.busy(el, true, 'Booking…');
  AF.db().collection('skillsBookings').add({ clientUid: u.uid, clientName: AF.myName(), proUid: W.pro ? W.pro.uid : '', proName: W.pro ? String(W.pro.name).slice(0, 60) : '', service: W.service, serviceName: svc(W.service).name, date: W.date, time: W.time, address: W.address.slice(0, 160), notes: W.notes.slice(0, 500), status: 'pending', payment: 'after_service', createdAt: AF.ts(), updatedAt: AF.ts() })
    .then(function () { AF.closeSheet(); W = null; AF.say('Booking sent. You will see its status in My bookings.'); S.tab = 'mine'; if (typeof window.showPage === 'function') window.showPage('acBooking'); paint(); })
    .catch(function () { AF.busy(el, false); AF.say('Could not send the booking. Please try again.'); });
});

AF.mount('acBooking', paint);
AF.booking = { open: open };
})();
