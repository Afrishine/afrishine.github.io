/* Afrishine Hub - admin tab "Pi Badges": see, give, extend and remove Verified badges of members who signed in with Pi
   (Afrishine Skills), with an end date. Expired badges are switched off automatically when this tab opens.
   Also: the price rate (π per $1) and the list of badge payments.  Loads AFTER app-extras.js. */
(function () {
  'use strict';
  var DAY = 86400000;
  var PLANS = {
    verified: { label: 'Verified · 1 Year ($10)', days: 365 },
    boost: { label: 'Verified + Boost · 30 Days ($15)', days: 30 },
    vip: { label: 'Verified VIP · 30 Days ($150)', days: 30 },
    forever: { label: 'No end date (permanent)', days: 0 }
  };
  var S = { rows: [], pays: [], rate: null, msg: '', q: '', swept: 0 };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function D() { return window.db || (typeof db !== 'undefined' ? db : null); }
  function box() { return document.getElementById('admBody'); }
  function ms(t) { return t && t.toMillis ? t.toMillis() : 0; }
  function fd(m) { return m ? new Date(m).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : ''; }
  function FV() { return firebase.firestore.FieldValue; }

  /* Fields to write on publicProfiles when a badge is given (also used by the "Approve" button in Admin > Verification) */
  window.afBadgeFields = function (plan, fromMs) {
    var p = PLANS[plan], f = { verified: true, verifiedAt: FV().serverTimestamp() };
    if (!p) return { verified: true };
    f.verifiedPlan = plan === 'forever' ? 'manual' : plan;
    f.verifiedUntil = p.days ? firebase.firestore.Timestamp.fromMillis((fromMs && fromMs > Date.now() ? fromMs : Date.now()) + p.days * DAY) : FV().delete();
    return f;
  };
  function state(r) {
    var until = ms(r.verifiedUntil), now = Date.now();
    if (r.verified === true) return until && until <= now ? 'expired' : 'active';
    return r.verifiedPlan && until && until <= now ? 'ended' : 'none';
  }
  function tag(r) {
    var st = state(r), until = ms(r.verifiedUntil);
    if (st === 'active') {
      var left = until ? Math.ceil((until - Date.now()) / DAY) : 0;
      return '<span class="adm-tag">✔ Verified</span>' + (until ? '<span class="adm-tag">until ' + esc(fd(until)) + ' (' + left + ' d)</span>' : '<span class="adm-tag">no end date</span>') + (r.verifiedPlan ? '<span class="adm-tag">' + esc(r.verifiedPlan) + '</span>' : '');
    }
    if (st === 'expired') return '<span class="adm-tag">⌛ Expired ' + esc(fd(until)) + '</span>';
    if (st === 'ended') return '<span class="adm-tag">Badge ended ' + esc(fd(until)) + '</span>';
    return '';
  }
  function render() {
    var b = box(); if (!b) return;
    var n = { active: 0, soon: 0, gone: 0 };
    S.rows.forEach(function (r) { var st = state(r), u = ms(r.verifiedUntil); if (st === 'active') { n.active++; if (u && u - Date.now() < 7 * DAY) n.soon++; } else if (st === 'ended' || st === 'expired') n.gone++; });
    var planOpts = Object.keys(PLANS).map(function (k) { return '<option value="' + k + '">' + esc(PLANS[k].label) + '</option>'; }).join('');
    var q = S.q.toLowerCase();
    var rows = S.rows.filter(function (r) { return !q || String(r.username || '').toLowerCase().indexOf(q) !== -1 || String(r.piUsername || '').toLowerCase().indexOf(q) !== -1; }).sort(function (a, c) {
      var order = { active: 0, expired: 1, ended: 2, none: 3 }; return (order[state(a)] - order[state(c)]) || String(a.username || '').localeCompare(String(c.username || ''));
    }).map(function (r) {
      var st = state(r), on = st === 'active';
      return '<div class="adm-row"><div class="grow"><b>' + esc(r.username || 'Pi member') + '</b> ' + tag(r) + '<small>' + esc(r.id) + '</small>' +
        '<div class="bd-ctl"><select class="field bd-sel" data-bd-plan="' + esc(r.id) + '">' + planOpts + '</select>' +
        '<button type="button" class="adm-btn gold" data-bd="give" data-id="' + esc(r.id) + '">' + (on ? 'Renew' : 'Give badge') + '</button>' +
        (on && ms(r.verifiedUntil) ? '<button type="button" class="adm-btn" data-bd="extend" data-id="' + esc(r.id) + '">+30 days</button>' : '') +
        (on ? '<button type="button" class="adm-btn red" data-bd="remove" data-id="' + esc(r.id) + '">Remove</button>' : '') + '</div></div></div>';
    }).join('');
    var rate = S.rate;
    var pays = S.pays.map(function (p) {
      return '<div class="adm-row"><div class="grow"><b>π ' + esc(p.amountPi) + '</b> <span class="adm-tag">' + esc(p.plan) + '</span>' + (p.granted ? '<span class="adm-tag">✅ badge given</span>' : '<span class="adm-tag">⏳ not given yet</span>') + '<small>' + esc(p.uid) + ' · ' + esc(fd(ms(p.createdAt))) + '</small><small style="word-break:break-all">' + esc(p.txid || '') + '</small></div></div>';
    }).join('');
    b.innerHTML =
      '<div class="adm-grid"><div class="adm-stat"><i>✅</i><b>' + n.active + '</b><small>Active badges</small></div><div class="adm-stat"><i>⏰</i><b>' + n.soon + '</b><small>End in 7 days</small></div><div class="adm-stat"><i>⌛</i><b>' + n.gone + '</b><small>Ended / expired</small></div><div class="adm-stat"><i>π</i><b>' + S.rows.length + '</b><small>Pi members</small></div></div>' +
      (S.swept ? '<p class="adm-empty">' + S.swept + ' expired badge(s) were switched off just now.</p>' : '') +
      (S.msg ? '<p class="adm-empty">' + esc(S.msg) + '</p>' : '') +
      '<div class="adm-form"><b>Price: how many π for $1?</b><small class="adm-empty" style="padding:0">Plans: Verified $10 · Boost $15 · VIP $150. Members pay the π amount that this number gives. ' +
      (rate ? 'Now: <b>' + esc(rate) + ' π per $1</b> → Verified π ' + esc(Math.round(10 * rate * 100) / 100) + ' · Boost π ' + esc(Math.round(15 * rate * 100) / 100) + ' · VIP π ' + esc(Math.round(150 * rate * 100) / 100) + '.' : '<b style="color:#ffb3b3">Not set yet — the app uses 1 π per $1 until you save a number.</b>') + '</small>' +
      '<input class="field" id="bdRate" type="number" min="0.0001" step="any" inputmode="decimal" placeholder="π per $1 (e.g. 3)" value="' + esc(rate || '') + '"><button type="button" class="adm-btn gold" data-bd="rate" style="padding:12px">Save price</button></div>' +
      '<h3 class="adm-h">Members who signed in with Pi</h3><input class="field" id="bdSearch" placeholder="Search username…" value="' + esc(S.q) + '">' +
      (rows || '<p class="adm-empty">No Pi members yet. They appear here after they sign in with Pi.</p>') +
      '<h3 class="adm-h">Badge payments</h3>' + (pays || '<p class="adm-empty">No payments yet.</p>') +
      '<button type="button" class="adm-btn" data-bd="refresh">Refresh</button>';
  }
  function load() {
    var b = box(); if (b) b.innerHTML = '<p class="adm-empty">Loading…</p>';
    S.swept = 0; S.msg = '';
    var FP = firebase.firestore.FieldPath;
    var members = D().collection('publicProfiles').orderBy(FP.documentId()).startAt('pi_').endAt('pi_' + String.fromCharCode(0xf8ff)).limit(500).get();
    var pays = D().collection('verificationPayments').orderBy('createdAt', 'desc').limit(30).get().then(function (s) { return s.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); }); }).catch(function () { return []; });
    var rate = D().collection('verificationSettings').doc('config').get().then(function (d) { return d.exists ? Number(d.data().piPerUsd) || null : null; }).catch(function () { return null; });
    Promise.all([members, pays, rate]).then(function (r) {
      S.rows = r[0].docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
      S.pays = r[1]; S.rate = r[2];
      var gone = S.rows.filter(function (x) { return state(x) === 'expired'; });
      if (!gone.length) { render(); return; }
      var batch = D().batch();
      gone.forEach(function (x) { batch.update(D().collection('publicProfiles').doc(x.id), { verified: false }); });
      return batch.commit().then(function () { gone.forEach(function (x) { x.verified = false; }); S.swept = gone.length; render(); }).catch(function (e) { S.msg = 'Could not switch off expired badges: ' + ((window.firebaseErrorMessage && window.firebaseErrorMessage(e)) || e.message); render(); });
    }).catch(function (e) { if (b) b.innerHTML = '<p class="adm-empty">' + esc((window.firebaseErrorMessage && window.firebaseErrorMessage(e)) || 'Could not load.') + '</p>'; });
  }
  window.afPiBadges = load;

  function find(id) { return S.rows.filter(function (r) { return r.id === id; })[0]; }
  function done(text) { S.msg = text; render(); }
  document.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('[data-bd]') : null;
    if (!btn || !window.__afIsAdmin) return;
    var act = btn.getAttribute('data-bd'), id = btn.getAttribute('data-id'), row = id && find(id), ref = id && D().collection('publicProfiles').doc(id);
    var fail = function (er) { done((window.firebaseErrorMessage && window.firebaseErrorMessage(er)) || 'Could not save.'); };
    if (act === 'refresh') load();
    else if (act === 'rate') {
      var n = Number(document.getElementById('bdRate').value);
      if (!(n > 0)) { done('Write a number bigger than 0.'); return; }
      D().collection('verificationSettings').doc('config').set({ piPerUsd: n, updatedAt: FV().serverTimestamp() }, { merge: true }).then(function () { S.rate = n; done('Price saved.'); }).catch(fail);
    }
    else if (act === 'give' && row) {
      var sel = document.querySelector('[data-bd-plan="' + id + '"]'), plan = sel ? sel.value : 'verified';
      var base = state(row) === 'active' ? ms(row.verifiedUntil) : 0;
      ref.update(window.afBadgeFields(plan, base)).then(function () { return ref.get(); }).then(function (d) { Object.assign(row, d.data()); done('Badge saved for ' + (row.username || id) + '.'); }).catch(fail);
    }
    else if (act === 'extend' && row) {
      ref.update({ verifiedUntil: firebase.firestore.Timestamp.fromMillis(Math.max(ms(row.verifiedUntil), Date.now()) + 30 * DAY), verified: true }).then(function () { return ref.get(); }).then(function (d) { Object.assign(row, d.data()); done('Added 30 days for ' + (row.username || id) + '.'); }).catch(fail);
    }
    else if (act === 'remove' && row) {
      if (!confirm('Remove the Verified badge from ' + (row.username || id) + '?')) return;
      ref.update({ verified: false }).then(function () { row.verified = false; done('Badge removed from ' + (row.username || id) + '.'); }).catch(fail);
    }
  });
  document.addEventListener('input', function (e) {
    if (e.target && e.target.id === 'bdSearch') { S.q = e.target.value.trim(); var pos = e.target.selectionStart; render(); var el = document.getElementById('bdSearch'); if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch (_) { } } }
  });
})();
