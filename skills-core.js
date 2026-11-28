/* Afrishine Skills - shared tools for the Skills sections (skills-library / pro / freelance / community / booking).
   Load AFTER afrishine-academy.js and BEFORE the other skills-*.js files. Does not change anything by itself. */
(function () {
'use strict';
if (window.afSkills) return;
var AFA = window.afAcademy || {};
var WORKER = 'https://afrishine-media.usherluckyelie.workers.dev';
var SKILLS_HOST = /^afrishine-(academy|skills)/i.test(location.hostname) || /[?&]mode=academy\b/.test(location.search);
var AF = { WORKER: WORKER, SKILLS_HOST: SKILLS_HOST };

function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function $(id) { return document.getElementById(id); }
function say(t) { if (typeof window.afToast === 'function') window.afToast(t); else if (typeof window.notice === 'function') window.notice(t); else alert(t); }
function fdb() { try { return typeof db !== 'undefined' ? db : null; } catch (e) { return null; } }
function ts() { return firebase.firestore.FieldValue.serverTimestamp(); }
function ms(t) { return t && t.toMillis ? t.toMillis() : (typeof t === 'number' ? t : 0); }
function stamp(msv) { return firebase.firestore.Timestamp.fromMillis(msv); }
function fmtDate(msv, withTime) { if (!msv) return ''; var d = new Date(msv); return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) + (withTime ? ' · ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''); }
function stars(n, size) { n = Math.round(Number(n) || 0); var s = ''; for (var i = 1; i <= 5; i++) s += '<span class="sk-star' + (i <= n ? ' on' : '') + '">★</span>'; return '<span class="sk-stars">' + s + '</span>'; }
function snip(t, n) { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n) + '…' : t; }

/* ---------- users ---------- */
function anyUser() { try { return (typeof currentFirebaseUser !== 'undefined' && currentFirebaseUser) || null; } catch (e) { return null; } }
function piUser() { return AFA.curUser ? AFA.curUser() : null; }
function needPi() { return AFA.needUser ? AFA.needUser() : Promise.resolve(null); }
function needAny() {
  var u = anyUser(); if (u) return Promise.resolve(u);
  if (SKILLS_HOST) return needPi();
  say('Please create an account or sign in first.'); if (typeof window.showPage === 'function') window.showPage('profile');
  return Promise.resolve(null);
}
function myName() { var u = anyUser(); return String((u && u.displayName) || (AFA.myName ? AFA.myName() : '') || 'Afrishine Member').slice(0, 60); }
function isAdmin() { return window.__afIsAdmin === true; }
var vcache = {};
function verified(uid) {
  if (!uid) return Promise.resolve(false);
  var c = vcache[uid]; if (c && Date.now() - c.t < 300000) return c.p;
  var p = AFA.isVerified ? AFA.isVerified(uid) : Promise.resolve(false);
  vcache[uid] = { t: Date.now(), p: p }; return p;
}
function profiles(uids) {          // uid -> {verified, photo}
  var out = {}, list = uids.filter(function (u, i) { return u && uids.indexOf(u) === i; }).slice(0, 60);
  return Promise.all(list.map(function (u) {
    return fdb().collection('publicProfiles').doc(u).get().then(function (s) {
      var d = s.exists ? s.data() : {}, until = ms(d.verifiedUntil);
      out[u] = { verified: d.verified === true && (!until || until > Date.now()), photo: d.photoURL || '' };
    }).catch(function () { out[u] = { verified: false, photo: '' }; });
  })).then(function () { return out; });
}
function vchip(on) { return on ? '<span class="as-verified">✓ Verified</span>' : ''; }
function avatar(name, photo, cls) { return '<span class="sk-av ' + (cls || '') + '">' + esc(String(name || 'A').charAt(0).toUpperCase()) + (photo ? '<img src="' + esc(photo) + '" alt="" loading="lazy">' : '') + '</span>'; }

/* ---------- sheet (bottom) and screen (full page) ---------- */
function closeSheet() { var o = $('skSheet'); if (o) o.remove(); if (!document.querySelector('.as-ov')) document.body.classList.remove('as-lock'); }
function sheet(html, onClose) {
  closeSheet();
  var o = document.createElement('div'); o.id = 'skSheet'; o.className = 'as-ov as-sheet';
  o.innerHTML = '<div class="as-sheet-box sk-box" role="dialog" aria-modal="true">' + html + '</div>';
  document.body.appendChild(o); document.body.classList.add('as-lock');
  o.addEventListener('click', function (e) { if (e.target === o) { closeSheet(); if (onClose) onClose(); } });
  return o;
}
function closeScreen() { var o = $('skScreen'); if (o) o.remove(); if (!document.querySelector('.as-ov')) document.body.classList.remove('as-lock'); }
function screen(title, bodyHtml) {
  closeScreen();
  var o = document.createElement('div'); o.id = 'skScreen'; o.className = 'as-ov sk-screen';
  o.innerHTML = '<div class="sk-top"><button type="button" class="sk-back" data-sk="close-screen" aria-label="Back">←</button><b id="skScreenTitle">' + esc(title) + '</b></div><div class="sk-scroll" id="skScreenBody">' + bodyHtml + '</div>';
  document.body.appendChild(o); document.body.classList.add('as-lock');
  return o;
}

/* ---------- click router: <button data-sk="action" data-id="..."> ---------- */
var handlers = {};
function on(name, fn) { handlers[name] = fn; }
document.addEventListener('click', function (e) {
  var el = e.target.closest ? e.target.closest('[data-sk]') : null; if (!el) return;
  var fn = handlers[el.getAttribute('data-sk')];
  if (fn) { e.preventDefault(); try { fn(el, e); } catch (er) { console.warn('skills:', er); } }
});
on('close-sheet', closeSheet); on('close-screen', closeScreen);

/* ---------- mount a section on a page when it opens ---------- */
var mounts = {};
function body(pageId, bodyId) {             // replaces the "Coming soon" card with our own container
  var page = $(pageId), b = $(bodyId); if (b) return b; if (!page) return null;
  var lp = page.querySelector('.lp') || page, soon = lp.querySelector('.ac-soon');
  b = document.createElement('div'); b.id = bodyId; b.className = 'sk-body';
  if (soon) soon.parentNode.replaceChild(b, soon); else lp.appendChild(b);
  return b;
}
function mount(pageId, fn) {
  mounts[pageId] = fn;
  var a = document.querySelector('.page.active'); if (a && a.id === pageId) try { fn(); } catch (e) { console.warn(e); }
}
var prevShow = window.showPage;
if (typeof prevShow === 'function') window.showPage = function (id) {
  var r = prevShow.apply(this, arguments);
  var a = document.querySelector('.page.active'), cur = a ? a.id : id;
  if (mounts[cur]) { try { mounts[cur](); } catch (e) { console.warn('skills mount:', e); } }
  return r;
};

/* ---------- uploads (photos are compressed; videos are sent as they are) ---------- */
function compress(file) {
  if (!file.type || file.type.indexOf('image/') !== 0 || file.type === 'image/gif' || !window.createImageBitmap) return Promise.resolve(file);
  return createImageBitmap(file).then(function (bm) {
    var s = Math.min(1, 1280 / Math.max(bm.width, bm.height)), c = document.createElement('canvas'); c.width = Math.round(bm.width * s); c.height = Math.round(bm.height * s);
    c.getContext('2d').drawImage(bm, 0, 0, c.width, c.height);
    return new Promise(function (res) { c.toBlob(function (b) { res(b || file); }, 'image/jpeg', 0.82); });
  }).catch(function () { return file; });
}
function upload(file, maxMB) {
  var u = anyUser(); if (!u) return Promise.reject(new Error('Please sign in first.'));
  if (file.size > (maxMB || 60) * 1048576) return Promise.reject(new Error('This file is too large (max ' + (maxMB || 60) + ' MB).'));
  return compress(file).then(function (blob) {
    return u.getIdToken().then(function (t) {
      return fetch(WORKER + '/upload?filename=' + encodeURIComponent(file.name || 'media'), { method: 'POST', headers: { Authorization: 'Bearer ' + t, 'Content-Type': blob.type || file.type || 'application/octet-stream' }, body: blob });
    });
  }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok || !d.success || !d.url) throw new Error(d.error || 'Upload failed. Please try again.'); return d; }); });
}

/* ---------- chat with another member (uses the Academy chat) ---------- */
function chat(key, ownerUid, ownerName, title, firstMessage) {
  return needPi().then(function (u) {
    if (!u) return;
    if (u.uid === ownerUid) { say('This is yours. Your messages are in Inbox.'); return; }
    var cid = key + '_' + u.uid, ref = fdb().collection('academyChats').doc(cid);
    return ref.get().then(function (s) { return s.exists; }, function () { return false; }).then(function (exists) {
      if (exists) return;
      return ref.set({ productId: key, title: String(title).slice(0, 120), members: [ownerUid, u.uid], sellerUid: ownerUid, buyerUid: u.uid, sellerName: String(ownerName || 'Member').slice(0, 100), buyerName: myName(), last: '', updatedAt: ts() }).catch(function () { });
    }).then(function () {
      if (firstMessage) return ref.collection('messages').add({ uid: u.uid, text: String(firstMessage).slice(0, 900), createdAt: ts() }).then(function () { return ref.update({ last: String(firstMessage).slice(0, 80), updatedAt: ts() }); }).catch(function () { });
    }).then(function () { if (AFA.openChat) AFA.openChat(cid, String(title).slice(0, 60) + ' · ' + (ownerName || 'Member')); });
  });
}

/* ---------- small form helper ---------- */
function val(id) { var e = $(id); return e ? String(e.value || '').trim() : ''; }
function busy(btn, on, text) { if (!btn) return; btn.disabled = !!on; if (on) { btn.setAttribute('data-t', btn.textContent); btn.textContent = text || 'Please wait…'; } else if (btn.getAttribute('data-t')) btn.textContent = btn.getAttribute('data-t'); }
function chips(list, current, action, allLabel) {
  return '<div class="sk-chips">' + (allLabel ? '<button type="button" class="sk-chip' + (!current ? ' on' : '') + '" data-sk="' + action + '" data-id="">' + esc(allLabel) + '</button>' : '') +
    list.map(function (c) { return '<button type="button" class="sk-chip' + (current === c.id ? ' on' : '') + '" data-sk="' + action + '" data-id="' + esc(c.id) + '">' + (c.icon ? esc(c.icon) + ' ' : '') + esc(c.name) + '</button>'; }).join('') + '</div>';
}
function empty(icon, title, text, btn) { return '<div class="ac-soon"><i aria-hidden="true">' + icon + '</i><b>' + esc(title) + '</b><p>' + esc(text) + '</p>' + (btn || '') + '</div>'; }

AF.esc = esc; AF.$ = $; AF.say = say; AF.db = fdb; AF.ts = ts; AF.ms = ms; AF.stamp = stamp; AF.fmtDate = fmtDate; AF.stars = stars; AF.snip = snip;
AF.anyUser = anyUser; AF.piUser = piUser; AF.needPi = needPi; AF.needAny = needAny; AF.myName = myName; AF.isAdmin = isAdmin;
AF.verified = verified; AF.profiles = profiles; AF.vchip = vchip; AF.avatar = avatar;
AF.sheet = sheet; AF.closeSheet = closeSheet; AF.screen = screen; AF.closeScreen = closeScreen;
AF.on = on; AF.mount = mount; AF.body = body; AF.upload = upload; AF.chat = chat; AF.val = val; AF.busy = busy; AF.chips = chips; AF.empty = empty;
window.afSkills = AF;
})();
