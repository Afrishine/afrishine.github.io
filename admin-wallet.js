/* AFRISHINE HUB: Admin Dashboard add-on for the AST wallet (Admin Treasury edition).
   Adds five tabs to the Admin Dashboard (AST Treasury, Top-ups, Prices, Gifts, P2P disputes) and an AST Treasury card to Overview.
   Load it LAST in index.html:  <script src="/admin-wallet.js"></script>
   Every number and every rule is enforced by the Worker; this file only shows and edits them.
   Total Supply is fixed at 30,000,000 AST (1 AST = 100 units). Nothing here can create AST. */
(function () {
  'use strict';
  if (window.__afAdminWalletLoaded) return;          /* never register the listeners twice */
  window.__afAdminWalletLoaded = true;

  var WORKER = 'https://afrishine-media.usherluckyelie.workers.dev';
  var TABS = [['wtreasury', '🏦 AST Treasury'], ['wtopups', '💳 Top-ups'], ['wprices', '🏷️ Prices'], ['wgifts', '🎁 Gifts'], ['wp2p', '⚖️ P2P']];
  var p2pStatus = 'open';
  var topStatus = 'pending';
  var current = '';                 /* the wallet tab being shown (stops late answers from painting the wrong tab) */
  var lastTreasury = null;          /* Treasury balance in units, only used for a friendly pre-check */
  var tre = { member: null, idem: '', sig: '', before: 0, seq: 0, sending: false };
  var TYPE_LABEL = {
    treasury_allocation: 'Admin allocation',
    treasury_topup: 'Top-up approved',
    treasury_bonus: 'Rank bonus',
    service_income: 'Service payment returned',
    treasury_refund: 'Refund',
    treasury_fee: 'P2P fee',
    treasury_genesis: 'Initial supply'
  };

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function say(t) { if (typeof window.notice === 'function') window.notice(t); else alert(t); }
  function user() { try { return (typeof currentFirebaseUser !== 'undefined' && currentFirebaseUser) || (window.auth && window.auth.currentUser) || null; } catch (e) { return null; } }
  function ast(units) {
    var v = (Number(units) || 0) / 100, s = Math.abs(v).toFixed(2).split('.');
    s[0] = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (v < 0 ? '-' : '') + s.join('.');
  }
  function whole(units) { return ast(units).replace(/\.00$/, ''); }
  function when(ms) { return ms ? new Date(ms).toLocaleString() : ''; }
  /* "25" or "25.5" -> 2500 / 2550 units; 0 when the text is not a valid positive amount (max 2 decimals) */
  function parseUnits(text) {
    var s = String(text == null ? '' : text).trim();
    if (!/^\d{1,9}(\.\d{1,2})?$/.test(s)) return 0;
    var p = s.split('.');
    var u = Number(p[0]) * 100 + (p[1] ? Number((p[1] + '0').slice(0, 2)) : 0);
    return isFinite(u) && u > 0 ? u : 0;
  }
  function newIdem() {
    var a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', s = '', i, r;
    try {
      if (window.crypto && window.crypto.getRandomValues) {
        r = new Uint8Array(24); window.crypto.getRandomValues(r);
        for (i = 0; i < 24; i++) s += a.charAt(r[i] % 62);
        return s;
      }
    } catch (e) { }
    for (i = 0; i < 24; i++) s += a.charAt(Math.floor(Math.random() * 62));
    return s;
  }

  function appCheck() {
    try {
      if (typeof firebase !== 'undefined' && typeof firebase.appCheck === 'function') {
        return firebase.appCheck().getToken().then(function (t) { return { 'X-Firebase-AppCheck': t.token }; }).catch(function () { return {}; });
      }
    } catch (e) { }
    return Promise.resolve({});
  }
  function api(method, path, body) {
    var u = user();
    if (!u) return Promise.reject({ message: 'Please sign in first.' });
    return Promise.all([u.getIdToken(), appCheck()]).then(function (r) {
      var headers = Object.assign({ Authorization: 'Bearer ' + r[0] }, r[1]);
      var opts = { method: method, headers: headers };
      if (body !== undefined) { headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
      return fetch(WORKER + path, opts);
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (j) {
        if (!res.ok || j.success === false) throw { message: j.message || j.error || 'Something went wrong. Please try again.', code: j.code };
        return j;
      });
    }, function (e) {
      if (e && e.message && !e.code && /fetch|network/i.test(String(e.message))) throw { message: 'No connection. Please check your internet and try again.' };
      throw e;
    });
  }
  function body() { return $('admBody'); }
  function busy(t) { var b = body(); if (b) b.innerHTML = '<p class="adm-empty">' + esc(t || 'Loading…') + '</p>'; }
  function fail(e) { var b = body(); if (b) b.innerHTML = '<p class="adm-empty">' + esc((e && e.message) || 'Could not load. Please try again.') + '</p>'; }

  /* ---------- supply / treasury card (Overview + Top-ups tab) ---------- */
  function pctOf(s) { return s.total ? Math.min(100, Math.max(0, (s.circulation / s.total) * 100)) : 0; }
  function supplyHtml(s, extra) {
    var pct = pctOf(s);
    return '<div class="adm-stat" style="margin-bottom:10px"><small>🪙 Fixed Total Supply</small><b>' + whole(s.total) + ' AST</b>' +
      '<div class="adm-bar" style="margin-top:8px"><span style="width:' + pct.toFixed(2) + '%"></span></div>' +
      '<small style="margin-top:8px">' + pct.toFixed(3) + '% distributed to members</small></div>' +
      '<div class="adm-grid"><div class="adm-stat"><i>🏦</i><b>' + ast(s.treasury) + '</b><small>Admin Treasury Balance</small></div>' +
      '<div class="adm-stat"><i>👛</i><b>' + ast(s.circulation) + '</b><small>Circulation (members’ wallets)</small></div></div>' +
      (extra || '') +
      (s.ok === false ? '<p class="adm-empty" style="color:#ff6b6b">⚠️ The ledger does not add up to the fixed Total Supply. Please check the Worker.</p>' : '');
  }

  /* ---------- tab 0: AST Treasury ---------- */
  function statsHtml(o) {
    var s = o.supply, pct = pctOf({ total: s.total, circulation: s.circulation });
    return '<div class="adm-stat" style="margin-bottom:10px"><small>🪙 Total Supply (fixed)</small><b>' + whole(s.total) + ' AST</b>' +
      '<div class="adm-bar" style="margin-top:8px"><span style="width:' + pct.toFixed(2) + '%"></span></div>' +
      '<small style="margin-top:8px">' + pct.toFixed(3) + '% of Total Supply is with members</small></div>' +
      '<div class="adm-grid">' +
      '<div class="adm-stat"><i>🏦</i><b>' + ast(s.treasury) + '</b><small>Admin Treasury Balance</small></div>' +
      '<div class="adm-stat"><i>👛</i><b>' + ast(s.circulation) + '</b><small>Circulation</small></div>' +
      '<div class="adm-stat"><i>👥</i><b>' + s.holders + '</b><small>Members Holding AST</small></div>' +
      '<div class="adm-stat"><i>📤</i><b>' + ast(s.distributed) + '</b><small>Total Distributed</small></div>' +
      '<div class="adm-stat"><i>🧾</i><b>' + s.allocations + '</b><small>Total Allocations</small></div>' +
      '<div class="adm-stat"><i>⏳</i><b>' + o.topups.pending + '</b><small>Top-ups waiting</small></div></div>' +
      (s.ok === false ? '<p class="adm-empty" style="color:#ff6b6b">⚠️ The ledger does not add up to 30,000,000 AST. Please check the Worker.</p>' : '');
  }
  function loadStats() {
    var box = $('awTStats'); if (box) box.innerHTML = '<p class="adm-empty">Loading…</p>';
    return api('GET', '/wallet/admin/overview').then(function (o) {
      lastTreasury = o.supply.treasury;
      var b = $('awTStats'); if (b && current === 'wtreasury') b.innerHTML = statsHtml(o);
    }).catch(function (e) {
      var b = $('awTStats'); if (b && current === 'wtreasury') b.innerHTML = '<p class="adm-empty">' + esc((e && e.message) || 'Could not load the Treasury numbers.') + '</p>';
    });
  }
  function renderTreasury() {
    current = 'wtreasury'; tre.member = null; tre.idem = ''; tre.sig = ''; tre.before = 0; tre.sending = false;
    var opts = [['', 'All types'], ['allocation', 'Admin allocations'], ['topup', 'Top-ups approved'], ['bonus', 'Rank bonuses'], ['service', 'Service payments'], ['refund', 'Refunds'], ['genesis', 'Initial supply'], ['fee', 'P2P fees']]
      .map(function (o) { return '<option value="' + o[0] + '">' + o[1] + '</option>'; }).join('');
    body().innerHTML =
      '<div id="awTStats"><p class="adm-empty">Loading…</p></div>' +
      '<div class="adm-form"><b>Send AST to a member</b>' +
      '<small class="adm-empty" style="padding:0">AST are taken from the Admin Treasury. No new AST is ever created.</small>' +
      '<label class="creator-hint">Member User ID or email</label>' +
      '<div style="display:flex;gap:8px"><input class="field" id="awQ" data-aw-q type="text" maxlength="254" autocomplete="off" placeholder="User ID or email" style="flex:1">' +
      '<button type="button" class="adm-btn" data-aw="tfind">Find</button></div>' +
      '<div id="awMember"></div>' +
      '<label class="creator-hint">Amount (AST)</label><input class="field" id="awAmt" type="text" inputmode="decimal" autocomplete="off" placeholder="e.g. 25 or 25.50">' +
      '<label class="creator-hint">Reason (optional)</label><input class="field" id="awReason" type="text" maxlength="200" placeholder="Why are you sending this AST?">' +
      '<button type="button" class="adm-btn gold" id="awSend" data-aw="tsend" style="padding:12px" disabled>Send AST</button>' +
      '<p class="adm-empty" id="awMsg" style="padding:6px 0 0"></p></div>' +
      '<h3 class="adm-h">Treasury Transactions History</h3>' +
      '<div style="display:flex;gap:8px;margin-bottom:8px"><select class="field" id="awTType" data-aw-filter style="flex:1">' + opts + '</select></div>' +
      '<div style="display:flex;gap:8px"><input class="field" id="awTQ" type="text" maxlength="100" placeholder="Search: User ID, name, email, reason or transaction ID" style="flex:1">' +
      '<button type="button" class="adm-btn" data-aw="tfilter">Search</button></div>' +
      '<div id="awTHist"></div><div id="awTMore" style="margin-top:8px"></div>';
    loadStats();
    loadHistory(true);
  }
  function memberHtml(m) {
    var img = m.photoURL && /^https:\/\//.test(m.photoURL)
      ? '<img src="' + esc(m.photoURL) + '" alt="" loading="lazy" style="width:44px;height:44px;border-radius:50%;object-fit:cover;background:#05070c">'
      : '<span style="width:44px;height:44px;border-radius:50%;background:#1a2030;display:inline-block"></span>';
    return '<div class="adm-row" style="display:flex;gap:10px;align-items:center">' + img +
      '<div class="grow"><b>' + esc(m.username || 'Member') + '</b>' + (m.verified ? ' <span class="adm-tag">Verified</span>' : '') +
      '<small>Wallet: ' + ast(m.balance || 0) + ' AST</small><small style="word-break:break-all">ID: ' + esc(m.uid) + '</small></div></div>';
  }
  function setMsg(text, bad) { var m = $('awMsg'); if (m) { m.textContent = text || ''; m.style.color = bad ? '#ff6b6b' : ''; } }
  function findMember(btn) {
    var q = ($('awQ').value || '').trim(), box = $('awMember'), send = $('awSend');
    if (!q) { say('Enter the member’s User ID or email.'); return; }
    tre.member = null; tre.idem = ''; tre.sig = ''; if (send) send.disabled = true; setMsg('');
    box.innerHTML = '<p class="adm-empty">Searching…</p>';
    btn.disabled = true;
    api('GET', '/wallet/admin/member?q=' + encodeURIComponent(q)).then(function (r) {
      if (current !== 'wtreasury' || ($('awQ').value || '').trim() !== q) return;
      tre.member = r.member; box.innerHTML = memberHtml(r.member); if (send) send.disabled = false;
    }).catch(function (e) {
      if (current !== 'wtreasury') return;
      box.innerHTML = '<p class="adm-empty" style="color:#ff6b6b">' + esc((e && e.message) || 'Member not found.') + '</p>';
    }).then(function () { btn.disabled = false; });
  }
  function sendAst(btn) {
    if (tre.sending) return;
    var m = tre.member;
    if (!m) { say('Find the member first.'); return; }
    var amountText = ($('awAmt').value || '').trim(), units = parseUnits(amountText);
    var reason = ($('awReason').value || '').replace(/\s+/g, ' ').trim().slice(0, 200);
    if (!units) { say('Enter a positive amount with at most 2 decimals, for example 25 or 25.50.'); return; }
    if (lastTreasury !== null && units > lastTreasury) { say('The Admin Treasury has only ' + ast(lastTreasury) + ' AST. Nothing was sent.'); return; }
    if (!confirm('Send ' + ast(units) + ' AST from the Admin Treasury to ' + (m.username || 'this member') + '?')) return;
    /* the same idempotency key is reused for a retry of the same request, so a lost answer can never pay twice */
    var sig = m.uid + '|' + units + '|' + reason;
    if (sig !== tre.sig || !tre.idem) { tre.sig = sig; tre.idem = newIdem(); }
    tre.sending = true; btn.disabled = true; setMsg('Sending…');
    api('POST', '/wallet/admin/allocate', { toUid: m.uid, amount: amountText, reason: reason, idem: tre.idem }).then(function (r) {
      var who = m.username || 'the member';
      tre.member = null; tre.idem = ''; tre.sig = '';
      if (current === 'wtreasury') {
        $('awQ').value = ''; $('awAmt').value = ''; $('awReason').value = ''; $('awMember').innerHTML = '';
        setMsg(r.duplicate ? 'This request was already completed. Nothing was sent twice.' : '✔ ' + ast(units) + ' AST sent to ' + who + '.');
        loadStats(); loadHistory(true);
      }
      say(r.duplicate ? 'Already completed. Nothing was sent twice.' : ast(units) + ' AST sent to ' + who + '.');
    }).catch(function (e) {
      if (current === 'wtreasury') setMsg((e && e.message) || 'Could not send. Please try again.', true);
      say((e && e.message) || 'Could not send. Please try again.');
    }).then(function () {
      tre.sending = false;
      var s = $('awSend'); if (s) s.disabled = !tre.member;
    });
  }
  function historyRow(x) {
    var out = x.units < 0, label = TYPE_LABEL[x.type] || x.type;
    var who = x.uid ? '<small>Member: <b>' + esc(x.name || 'Member') + '</b> · ' + esc(x.uid) + '</small>' : '';
    var by = x.byName ? '<small>Admin: ' + esc(x.byName) + '</small>' : '';
    var why = x.reason ? '<small>Reason: ' + esc(x.reason) + '</small>' : '';
    return '<div class="adm-row" style="display:block"><div><b>' + (out ? '−' : '+') + ast(Math.abs(x.units)) + ' AST</b> <span class="adm-tag">' + esc(label) + '</span></div>' +
      '<small>' + esc(when(x.at)) + '</small>' + who + by + why + '<small style="word-break:break-all">ID: ' + esc(x.id) + '</small></div>';
  }
  function loadHistory(reset) {
    var list = $('awTHist'), more = $('awTMore'); if (!list) return;
    if (reset) { tre.before = 0; list.innerHTML = '<p class="adm-empty">Loading…</p>'; }
    if (more) more.innerHTML = '';
    var seq = ++tre.seq;
    var type = $('awTType') ? $('awTType').value : '', q = $('awTQ') ? $('awTQ').value.trim() : '';
    var path = '/wallet/admin/treasury/history?limit=30' + (type ? '&type=' + encodeURIComponent(type) : '') + (q ? '&q=' + encodeURIComponent(q) : '') + (!reset && tre.before ? '&before=' + tre.before : '');
    api('GET', path).then(function (r) {
      if (seq !== tre.seq || current !== 'wtreasury') return;
      var items = r.items || [], l = $('awTHist'), mo = $('awTMore'); if (!l) return;
      if (reset) l.innerHTML = '';
      if (!items.length && reset) { l.innerHTML = '<p class="adm-empty">No Treasury transactions found.</p>'; return; }
      l.insertAdjacentHTML('beforeend', items.map(historyRow).join(''));
      if (items.length) tre.before = items[items.length - 1].at;
      if (r.more && mo) mo.innerHTML = '<button type="button" class="adm-btn" data-aw="tmore" style="width:100%">Load more</button>';
    }).catch(function (e) {
      if (seq !== tre.seq || current !== 'wtreasury') return;
      var l = $('awTHist');
      if (l && reset) l.innerHTML = '<p class="adm-empty">' + esc((e && e.message) || 'Could not load the history.') + '</p>';
      else say((e && e.message) || 'Could not load more.');
      var mo = $('awTMore'); if (mo && !reset) mo.innerHTML = '<button type="button" class="adm-btn" data-aw="tmore" style="width:100%">Try again</button>';
    });
  }

  /* ---------- tab 1: top-ups ---------- */
  function renderTopups() {
    current = 'wtopups';
    busy();
    Promise.all([api('GET', '/wallet/admin/topups?status=' + topStatus), api('GET', '/wallet/config').catch(function () { return null; })]).then(function (r) {
      if (current !== 'wtopups') return;
      var j = r[0], cfg = r[1] && r[1].config, rows = j.items || [];
      lastTreasury = j.treasury;
      var tabs = [['pending', 'Pending (' + j.pending + ')'], ['approved', 'Approved'], ['rejected', 'Rejected']].map(function (x) {
        return '<button type="button" class="adm-btn ' + (topStatus === x[0] ? 'gold' : '') + '" data-aw="status" data-v="' + x[0] + '">' + x[1] + '</button>';
      }).join(' ');
      var html = supplyHtml({ total: j.totalSupply, treasury: j.treasury, circulation: j.circulation, ok: j.supplyOk }) +
        '<p class="adm-empty" style="padding:0 0 10px">When you press <b>Approve</b>, the AST is moved from the Admin Treasury to the member. Nothing is credited automatically, and a request can be approved only once.</p>' +
        '<div class="adm-tabs" style="margin-top:0">' + tabs + '</div>';
      if (!rows.length) { body().innerHTML = html + '<p class="adm-empty">No ' + esc(topStatus) + ' top-up requests.</p>'; return; }
      body().innerHTML = html + rows.map(function (q) {
        var m = cfg && cfg.methods && cfg.methods[q.method] ? cfg.methods[q.method].name : q.method;
        var pre = q.coin === 'USDT' ? q.coin_amount : '';
        var actions = q.status === 'pending'
          ? '<input class="field" data-aw-ast type="text" inputmode="decimal" value="' + esc(pre) + '" placeholder="AST to add (e.g. 25.00)">' +
            '<input class="field" data-aw-note type="text" maxlength="300" placeholder="Note (shown to the member if rejected)">' +
            '<div class="acts" style="justify-content:flex-start"><button type="button" class="adm-btn gold" data-aw="approve">✔ Approve</button><button type="button" class="adm-btn red" data-aw="reject">✖ Reject</button></div>'
          : '<small>' + (q.status === 'approved' ? 'Added ' + ast(q.ast_units) + ' AST' : 'Rejected') + (q.note ? ' · ' + esc(q.note) : '') + (q.reviewed_at ? ' · ' + esc(when(q.reviewed_at)) : '') + '</small>';
        return '<div class="adm-row" data-aw-req="' + esc(q.id) + '" style="display:block"><div><b>' + esc(q.username || 'Member') + '</b> <span class="adm-tag">' + esc(q.status) + '</span></div>' +
          '<small>' + esc(q.email || '') + '</small><small>' + esc(m) + ' · <b>' + esc(q.coin_amount) + ' ' + esc(q.coin) + '</b> · account: ' + esc(q.account_name || '') + '</small>' +
          '<small style="word-break:break-all">Hash: ' + esc(q.tx_hash) + '</small><small>' + esc(when(q.created_at)) + '</small>' +
          '<a href="' + esc(q.screenshot_url) + '" target="_blank" rel="noopener"><img src="' + esc(q.screenshot_url) + '" alt="Payment screenshot" loading="lazy" style="width:100%;max-height:260px;object-fit:contain;border-radius:10px;margin:8px 0;background:#05070c"></a>' + actions + '</div>';
      }).join('');
    }).catch(function (e) { if (current === 'wtopups') fail(e); });
  }
  function decide(btn, decision) {
    var card = btn.closest('[data-aw-req]'); if (!card) return;
    var id = card.getAttribute('data-aw-req'), a = card.querySelector('[data-aw-ast]'), n = card.querySelector('[data-aw-note]');
    var amount = a ? a.value.trim() : '', units = parseUnits(amount);
    if (decision === 'approve') {
      if (!units) { say('Enter the AST amount to add, for example 25 or 25.50.'); return; }
      if (lastTreasury !== null && units > lastTreasury) { say('The Admin Treasury has only ' + ast(lastTreasury) + ' AST, not enough for ' + ast(units) + ' AST. Nothing was changed.'); return; }
      if (!confirm('Approve this top-up and move ' + ast(units) + ' AST from the Admin Treasury to this member’s wallet?')) return;
    } else if (!confirm('Reject this top-up request?')) return;
    Array.prototype.forEach.call(card.querySelectorAll('button'), function (b) { b.disabled = true; });
    api('POST', '/wallet/admin/decide', { id: id, decision: decision, astAmount: amount, note: n ? n.value.trim() : '' }).then(function () {
      say(decision === 'approve' ? 'Approved. AST moved from the Treasury to the member.' : 'Request rejected.'); renderTopups();
    }).catch(function (e) { say((e && e.message) || 'Could not save.'); renderTopups(); });
  }

  /* ---------- tab 2: service prices ---------- */
  function pkgRows(kind, list) {
    return list.map(function (p) {
      return '<div class="adm-row" style="display:block" data-aw-pkg="' + kind + '" data-id="' + esc(p.id) + '"><b>' + esc(p.id) + '</b>' +
        '<input class="field" data-f="name" maxlength="30" value="' + esc(p.name) + '" placeholder="Name">' +
        '<div style="display:flex;gap:8px"><input class="field" data-f="ast" type="text" inputmode="decimal" value="' + esc(p.ast) + '" placeholder="AST"><input class="field" data-f="days" type="text" inputmode="numeric" value="' + esc(p.days) + '" placeholder="Days"></div></div>';
    }).join('');
  }
  function renderPrices() {
    current = 'wprices';
    busy();
    api('GET', '/wallet/config').then(function (j) {
      if (current !== 'wprices') return;
      var p = j.config.prices;
      body().innerHTML = '<p class="adm-empty" style="padding:0 0 10px">Prices are in AST (1 AST = 1 USDT). AST paid for a service returns to the Admin Treasury. Changes apply to new purchases right away.</p>' +
        '<div class="adm-form"><b>✔️ Verification Badge</b><input class="field" id="awVer" type="text" inputmode="decimal" value="' + esc(p.verification) + '" placeholder="Price in AST"></div>' +
        '<div class="adm-form"><b>👑 Premium (subscription)</b><div style="display:flex;gap:8px"><input class="field" id="awPremAst" type="text" inputmode="decimal" value="' + esc(p.premium.ast) + '" placeholder="AST"><input class="field" id="awPremDays" type="text" inputmode="numeric" value="' + esc(p.premium.days) + '" placeholder="Days"></div></div>' +
        '<div class="adm-form"><b>📣 Ads packages</b><div id="awAds">' + pkgRows('ads', p.ads) + '</div></div>' +
        '<div class="adm-form"><b>🚀 Boost packages</b><div id="awBoost">' + pkgRows('boost', p.boost) + '</div></div>' +
        '<button type="button" class="adm-btn gold" style="padding:13px;width:100%" data-aw="saveprices">Save prices</button><p class="adm-empty" id="awPriceMsg"></p>';
    }).catch(function (e) { if (current === 'wprices') fail(e); });
  }
  function readPkgs(boxId) {
    var out = [];
    Array.prototype.forEach.call($(boxId).querySelectorAll('[data-aw-pkg]'), function (row) {
      out.push({ id: row.getAttribute('data-id'), name: row.querySelector('[data-f=name]').value.trim(), ast: row.querySelector('[data-f=ast]').value.trim(), days: row.querySelector('[data-f=days]').value.trim() });
    });
    return out;
  }
  function savePrices(btn) {
    var prices = {
      verification: $('awVer').value.trim(),
      premium: { ast: $('awPremAst').value.trim(), days: $('awPremDays').value.trim() },
      ads: readPkgs('awAds'), boost: readPkgs('awBoost')
    };
    var bad = [prices.verification, prices.premium.ast].concat(prices.ads.map(function (x) { return x.ast; }), prices.boost.map(function (x) { return x.ast; }));
    for (var i = 0; i < bad.length; i++) { if (!(Number(bad[i]) > 0)) { say('Every price must be a number greater than 0.'); return; } }
    btn.disabled = true;
    api('POST', '/wallet/admin/config', { prices: prices }).then(function () { say('Prices saved.'); renderPrices(); })
      .catch(function (e) { btn.disabled = false; say((e && e.message) || 'Could not save.'); });
  }

  /* ---------- tab 3: gift management ---------- */
  function renderGifts() {
    current = 'wgifts';
    busy();
    Promise.all([api('GET', '/wallet/admin/overview'), api('GET', '/wallet/config')]).then(function (r) {
      if (current !== 'wgifts') return;
      var o = r[0], g = r[1].config.gift, ranks = r[1].config.ranks, G = o.gifts;
      var stats = '<div class="adm-grid"><div class="adm-stat"><i>🎁</i><b>' + G.count + '</b><small>Gifts sent (all time)</small></div><div class="adm-stat"><i>🪙</i><b>' + ast(G.units) + '</b><small>AST gifted (all time)</small></div>' +
        '<div class="adm-stat"><i>🕒</i><b>' + G.last24hCount + '</b><small>Gifts in the last 24 hours</small></div><div class="adm-stat"><i>📈</i><b>' + ast(G.last24hUnits) + '</b><small>AST gifted in 24 hours</small></div></div>';
      var limits = '<div class="adm-form"><b>Gift limits</b><label class="creator-hint">Minimum per gift (AST)</label><input class="field" id="awGMin" type="text" inputmode="decimal" value="' + esc(g.min) + '">' +
        '<label class="creator-hint">Maximum per gift (AST)</label><input class="field" id="awGMax" type="text" inputmode="decimal" value="' + esc(g.max) + '">' +
        '<label style="display:flex;gap:9px;align-items:center;font-size:14px"><input type="checkbox" id="awGVer"' + (g.verifiedOnly ? ' checked' : '') + '> Only verified members can receive gifts</label>' +
        '<small class="adm-empty" style="padding:0">Each member can send at most ' + G.hourlyMax + ' gifts per hour (set in the Worker).</small>' +
        '<button type="button" class="adm-btn gold" data-aw="savegift" style="padding:12px">Save limits</button></div>';
      var rankForm = '<div class="adm-form"><b>Gifter ranks (points)</b><small class="adm-empty" style="padding:0">A member’s rank rises with the total AST they have gifted. The first rank must start at 0. A bonus is paid once, from the Admin Treasury, when a member reaches the rank. If the Treasury cannot cover it, the bonus is not paid. No new AST is ever created.</small><div id="awRanks">' +
        ranks.map(function (x) {
          return '<div class="adm-row" style="display:block" data-aw-rank><input class="field" data-f="name" maxlength="20" value="' + esc(x.name) + '" placeholder="Rank name"><div style="display:flex;gap:8px"><input class="field" data-f="min" type="text" inputmode="decimal" value="' + esc(x.min) + '" placeholder="AST gifted"><input class="field" data-f="bonus" type="text" inputmode="decimal" value="' + esc(x.bonus) + '" placeholder="Bonus AST"></div></div>';
        }).join('') + '</div><button type="button" class="adm-btn gold" data-aw="saveranks" style="padding:12px">Save ranks</button></div>';
      var top = '<h3 class="adm-h">Top gifters</h3>' + (o.topGifters.map(function (t, i) {
        return '<div class="adm-row"><div class="grow"><b>' + (i + 1) + '. ' + esc(t.name) + '</b> <span class="adm-tag">' + esc(t.rank) + '</span><small>' + t.count + ' gifts · ' + ast(t.sentUnits) + ' AST</small></div></div>';
      }).join('') || '<p class="adm-empty">No gifts yet.</p>');
      var recent = '<h3 class="adm-h">Recent gifts</h3>' + (o.recent.map(function (x) {
        return '<div class="adm-row"><div class="grow"><b>' + esc(x.from) + '</b> → <b>' + esc(x.to) + '</b> <span class="adm-tag">' + (x.kind === 'talent' ? 'Talent' : 'Gift') + '</span><small>' + ast(x.units) + ' AST · ' + esc(when(x.at)) + '</small></div></div>';
      }).join('') || '<p class="adm-empty">No gifts yet.</p>');
      body().innerHTML = stats + limits + rankForm + top + recent;
    }).catch(function (e) { if (current === 'wgifts') fail(e); });
  }
  function saveGift(btn) {
    var min = $('awGMin').value.trim(), max = $('awGMax').value.trim();
    if (!(Number(min) > 0) || !(Number(max) >= Number(min))) { say('Enter a minimum above 0 and a maximum that is not smaller than it.'); return; }
    btn.disabled = true;
    api('POST', '/wallet/admin/config', { gift: { min: min, max: max, verifiedOnly: $('awGVer').checked } }).then(function () { say('Gift limits saved.'); renderGifts(); })
      .catch(function (e) { btn.disabled = false; say((e && e.message) || 'Could not save.'); });
  }
  function saveRanks(btn) {
    var list = [];
    Array.prototype.forEach.call($('awRanks').querySelectorAll('[data-aw-rank]'), function (row) {
      list.push({ name: row.querySelector('[data-f=name]').value.trim(), min: row.querySelector('[data-f=min]').value.trim(), bonus: row.querySelector('[data-f=bonus]').value.trim() || '0' });
    });
    if (!list.length || (list[0].min !== '0' && Number(list[0].min) !== 0)) { say('The first rank must start at 0 AST.'); return; }
    for (var i = 0; i < list.length; i++) { if (!list[i].name || isNaN(Number(list[i].min)) || isNaN(Number(list[i].bonus))) { say('Check every rank: it needs a name and numbers.'); return; } }
    btn.disabled = true;
    api('POST', '/wallet/admin/config', { ranks: list }).then(function () { say('Ranks saved.'); renderGifts(); })
      .catch(function (e) { btn.disabled = false; say((e && e.message) || 'Could not save.'); });
  }

  /* ---------- tab 5: P2P disputes (escrow) ---------- */
  function p2pCard(o) {
    var open = o.status === 'disputed';
    return '<div class="adm-row" data-aw-p2p="' + esc(o.id) + '" style="display:block"><div><b>' + whole(o.units) + ' AST</b> · ' + esc(o.fiat) + ' ' + esc(o.currency) + ' <span class="adm-tag">' + esc(o.status) + '</span></div>' +
      '<small>Buyer: <b>' + esc(o.buyerName) + '</b> · ' + esc(o.buyer) + '</small><small>Seller: <b>' + esc(o.sellerName) + '</b> · ' + esc(o.seller) + '</small>' +
      '<small>' + esc(o.methodName) + ' · ' + esc(o.payName) + ' · ' + esc(o.payAccount) + '</small><small>Order: ' + esc(o.id) + ' · ' + esc(when(o.createdAt)) + '</small>' +
      '<small style="color:#ffb91f">Dispute by the ' + esc(o.disputeBy) + ': ' + esc(o.disputeReason) + '</small>' +
      (o.resolution ? '<small>Decision: ' + esc(o.resolution) + '</small>' : '') +
      (o.proofUrl ? '<a href="' + esc(o.proofUrl) + '" target="_blank" rel="noopener"><img src="' + esc(o.proofUrl) + '" alt="Payment screenshot" loading="lazy" style="width:100%;max-height:240px;object-fit:contain;border-radius:10px;margin:8px 0;background:#05070c"></a>' : '') +
      '<div data-aw-chat></div><div class="acts" style="justify-content:flex-start"><button type="button" class="adm-btn" data-aw="p2pchat">💬 Chat & evidence</button></div>' +
      (open ? '<input class="field" data-aw-note type="text" maxlength="300" placeholder="Note for both members (your decision)"><div class="acts" style="justify-content:flex-start"><button type="button" class="adm-btn gold" data-aw="p2prelease">🔓 Release to buyer</button><button type="button" class="adm-btn red" data-aw="p2prefund">↩ Return to seller</button></div>' : '') + '</div>';
  }
  var p2pSection = 'disputes', kycStatus = 'pending';
  function p2pNav() {
    return '<div class="adm-tabs" style="margin-top:0">' + [['disputes', '⚖️ Disputes'], ['kyc', '🪪 KYC'], ['settings', '⚙️ Fees & rules']].map(function (x) {
      return '<button type="button" class="adm-btn ' + (p2pSection === x[0] ? 'gold' : '') + '" data-aw="p2pnav" data-v="' + x[0] + '">' + x[1] + '</button>';
    }).join(' ') + '</div>';
  }
  function renderP2P() {
    current = 'wp2p';
    if (p2pSection === 'kyc') return renderP2PKyc();
    if (p2pSection === 'settings') return renderP2PSettings();
    renderP2PDisputes();
  }
  function renderP2PKyc() {
    busy();
    api('GET', '/wallet/admin/p2p/kyc?status=' + kycStatus).then(function (j) {
      if (current !== 'wp2p' || p2pSection !== 'kyc') return;
      var tabs = [['pending', 'Pending (' + j.pending + ')'], ['approved', 'Approved'], ['rejected', 'Rejected']].map(function (x) {
        return '<button type="button" class="adm-btn ' + (kycStatus === x[0] ? 'gold' : '') + '" data-aw="p2pkycst" data-v="' + x[0] + '">' + x[1] + '</button>';
      }).join(' ');
      var html = p2pNav() + '<p class="adm-empty" style="padding:0 0 10px">Check that the face on the selfie matches the document, the name matches, and the document is real and not expired. Rejected members can send new photos.</p><div class="adm-tabs" style="margin-top:0">' + tabs + '</div>';
      if (!j.items.length) { body().innerHTML = html + '<p class="adm-empty">No ' + esc(kycStatus) + ' requests.</p>'; return; }
      body().innerHTML = html + j.items.map(function (k) {
        return '<div class="adm-row" data-aw-kyc="' + esc(k.uid) + '" style="display:block"><div><b>' + esc(k.fullName) + '</b> <span class="adm-tag">' + esc(k.status) + '</span></div>' +
          '<small>Profile: ' + esc(k.name) + ' · ' + esc(k.uid) + '</small><small>' + esc(k.docType.replace('_', ' ')) + ' · ' + esc(when(k.at)) + '</small>' +
          '<div style="display:flex;gap:8px;margin:8px 0"><a href="' + esc(k.front) + '" target="_blank" rel="noopener" style="flex:1"><img src="' + esc(k.front) + '" alt="Document" loading="lazy" style="width:100%;max-height:200px;object-fit:contain;border-radius:10px;background:#05070c"></a>' +
          '<a href="' + esc(k.selfie) + '" target="_blank" rel="noopener" style="flex:1"><img src="' + esc(k.selfie) + '" alt="Selfie" loading="lazy" style="width:100%;max-height:200px;object-fit:contain;border-radius:10px;background:#05070c"></a></div>' +
          (k.status === 'pending' ? '<input class="field" data-aw-note type="text" maxlength="200" placeholder="Reason (required when rejecting)"><div class="acts" style="justify-content:flex-start"><button type="button" class="adm-btn gold" data-aw="p2pkycok">✔ Approve</button><button type="button" class="adm-btn red" data-aw="p2pkycno">✖ Reject</button></div>' : (k.note ? '<small>' + esc(k.note) + '</small>' : '')) + '</div>';
      }).join('');
    }).catch(function (e) { if (current === 'wp2p') fail(e); });
  }
  function p2pKycDecide(btn, decision) {
    var card = btn.closest('[data-aw-kyc]'); if (!card) return;
    var n = card.querySelector('[data-aw-note]'), note = n ? n.value.trim() : '';
    if (decision === 'reject' && note.length < 3) { say('Write the reason so the member can fix it.'); return; }
    if (!confirm(decision === 'approve' ? 'Approve this identity?' : 'Reject this identity check?')) return;
    Array.prototype.forEach.call(card.querySelectorAll('button'), function (b) { b.disabled = true; });
    api('POST', '/wallet/admin/p2p/kyc/decide', { uid: card.getAttribute('data-aw-kyc'), decision: decision, note: note }).then(function () { say(decision === 'approve' ? 'Identity approved.' : 'Identity rejected.'); renderP2PKyc(); })
      .catch(function (e) { say((e && e.message) || 'Could not save.'); renderP2PKyc(); });
  }
  function renderP2PSettings() {
    busy();
    api('GET', '/wallet/admin/p2p/settings').then(function (c) {
      if (current !== 'wp2p' || p2pSection !== 'settings') return;
      body().innerHTML = p2pNav() + '<div class="adm-form"><b>P2P fee</b><small class="adm-empty" style="padding:0">The seller pays this fee ON TOP of the order, so the buyer always receives the full amount. The fee goes to the Admin Treasury (the 30,000,000 AST supply never changes). Example: 1000 AST at 0.15% = 1.5 AST.</small>' +
        '<label class="creator-hint">Fee (% of the AST amount, 0 to 5)</label><input class="field" id="awPFee" type="text" inputmode="decimal" value="' + esc(String(c.feeBps / 100)) + '">' +
        '<label class="creator-hint">Minimum fee per order (AST)</label><input class="field" id="awPMin" type="text" inputmode="decimal" value="' + esc((c.minFeeUnits / 100).toFixed(2)) + '">' +
        '<small class="adm-empty" id="awPEx" style="padding:0"></small></div>' +
        '<div class="adm-form"><b>Identity verification (KYC)</b><label class="creator-hint">Who must be verified before trading</label><select class="field" id="awPKyc"><option value="off"' + (c.kyc === 'off' ? ' selected' : '') + '>Nobody (optional)</option><option value="sellers"' + (c.kyc === 'sellers' ? ' selected' : '') + '>Sellers only</option><option value="all"' + (c.kyc === 'all' ? ' selected' : '') + '>Buyers and sellers</option></select></div>' +
        '<button type="button" class="adm-btn gold" style="padding:13px;width:100%" data-aw="p2psavesettings">Save</button>';
      p2pExample();
    }).catch(function (e) { if (current === 'wp2p') fail(e); });
  }
  function p2pExample() {
    var f = $('awPFee'), m = $('awPMin'), ex = $('awPEx'); if (!f || !m || !ex) return;
    var bps = Math.round(Number(f.value) * 100) || 0, min = Math.round(Number(m.value) * 100) || 0;
    var rows = [10, 100, 1000, 10000].map(function (a) { var fee = bps > 0 ? Math.max(min, Math.ceil(a * 100 * bps / 10000)) : 0; return a + ' AST → ' + ast(fee) + ' AST'; });
    ex.textContent = 'Fee examples: ' + rows.join(' · ');
  }
  function p2pSaveSettings(btn) {
    var pct = $('awPFee').value.trim(), min = $('awPMin').value.trim();
    if (!/^\d{1,2}(\.\d{1,2})?$/.test(pct) || Number(pct) > 5) { say('The fee must be between 0 and 5 percent.'); return; }
    if (!/^\d{1,3}(\.\d{1,2})?$/.test(min)) { say('Enter the minimum fee, for example 0.01.'); return; }
    btn.disabled = true;
    api('POST', '/wallet/admin/p2p/settings', { feePercent: pct, minFee: min, kyc: $('awPKyc').value }).then(function () { say('P2P settings saved.'); renderP2PSettings(); })
      .catch(function (e) { btn.disabled = false; say((e && e.message) || 'Could not save.'); });
  }
  document.addEventListener('input', function (e) { if (e.target && (e.target.id === 'awPFee' || e.target.id === 'awPMin')) p2pExample(); });
  function renderP2PDisputes() {
    busy();
    api('GET', '/wallet/admin/p2p/disputes?status=' + p2pStatus).then(function (j) {
      if (current !== 'wp2p') return;
      var tabs = [['open', 'Open (' + j.open + ')'], ['resolved', 'Resolved']].map(function (x) {
        return '<button type="button" class="adm-btn ' + (p2pStatus === x[0] ? 'gold' : '') + '" data-aw="p2pstatus" data-v="' + x[0] + '">' + x[1] + '</button>';
      }).join(' ');
      var html = p2pNav() + '<p class="adm-empty" style="padding:0 0 10px">The AST of every P2P order is locked in escrow. For a dispute, read the chat and the screenshots, then decide who receives the AST. A decision cannot be undone.</p><div class="adm-tabs" style="margin-top:0">' + tabs + '</div>';
      body().innerHTML = html + (j.items.length ? j.items.map(p2pCard).join('') : '<p class="adm-empty">No ' + esc(p2pStatus) + ' disputes.</p>');
    }).catch(function (e) { if (current === 'wp2p') fail(e); });
  }
  function p2pChat(btn) {
    var card = btn.closest('[data-aw-p2p]'); if (!card) return;
    var id = card.getAttribute('data-aw-p2p'), box = card.querySelector('[data-aw-chat]');
    box.innerHTML = '<small>Loading chat…</small>';
    api('GET', '/wallet/p2p/order?id=' + encodeURIComponent(id)).then(function (j) {
      box.innerHTML = '<div style="max-height:240px;overflow-y:auto;margin:6px 0">' + (j.messages.length ? j.messages.map(function (m) {
        var who = m.from === 'system' ? 'System' : (m.from === 'buyer' ? 'Buyer' : (m.from === 'seller' ? 'Seller' : 'Support'));
        return '<div style="margin:5px 0"><small><b>' + who + '</b> · ' + esc(when(m.at)) + '</small><br>' + (m.kind === 'image' ? '<a href="' + esc(m.body) + '" target="_blank" rel="noopener"><img src="' + esc(m.body) + '" alt="Photo" loading="lazy" style="max-width:100%;max-height:180px;border-radius:8px"></a>' : esc(m.body)) + '</div>';
      }).join('') : '<small>No messages.</small>') + '</div>' +
        (p2pStatus === 'open' ? '<div style="display:flex;gap:8px"><input class="field" data-aw-say type="text" maxlength="500" placeholder="Message both members (as Support)" style="flex:1"><button type="button" class="adm-btn" data-aw="p2psay">Send</button></div>' : '');
    }).catch(function (e) { box.innerHTML = '<small>' + esc((e && e.message) || 'Could not load the chat.') + '</small>'; });
  }
  function p2pSay(btn) {
    var card = btn.closest('[data-aw-p2p]'); if (!card) return;
    var inp = card.querySelector('[data-aw-say]'), t = inp ? inp.value.trim() : ''; if (!t) return;
    btn.disabled = true;
    api('POST', '/wallet/p2p/message', { id: card.getAttribute('data-aw-p2p'), text: t }).then(function () { var c = card.querySelector('[data-aw="p2pchat"]'); if (c) p2pChat(c); })
      .catch(function (e) { btn.disabled = false; say((e && e.message) || 'Could not send.'); });
  }
  function p2pDecide(btn, decision) {
    var card = btn.closest('[data-aw-p2p]'); if (!card) return;
    var n = card.querySelector('[data-aw-note]'), note = n ? n.value.trim() : '';
    if (!confirm(decision === 'release' ? 'Release the escrowed AST to the BUYER? This cannot be undone.' : 'Return the escrowed AST to the SELLER? This cannot be undone.')) return;
    Array.prototype.forEach.call(card.querySelectorAll('button'), function (b) { b.disabled = true; });
    api('POST', '/wallet/admin/p2p/resolve', { id: card.getAttribute('data-aw-p2p'), decision: decision, note: note }).then(function () {
      say(decision === 'release' ? 'AST released to the buyer.' : 'AST returned to the seller.'); renderP2P();
    }).catch(function (e) { say((e && e.message) || 'Could not save.'); renderP2P(); });
  }

  /* ---------- wiring ---------- */
  var RENDER = { wtreasury: renderTreasury, wtopups: renderTopups, wprices: renderPrices, wgifts: renderGifts, wp2p: renderP2P };
  function mark(tab) {
    Array.prototype.forEach.call(document.querySelectorAll('#admTabs [data-adm-tab]'), function (b) { b.classList.toggle('on', b.getAttribute('data-adm-tab') === tab); });
  }
  function addTabs() {
    var bar = $('admTabs'); if (!bar) return;
    TABS.forEach(function (t) {
      if (bar.querySelector('[data-adm-tab="' + t[0] + '"]')) return;
      var b = document.createElement('button'); b.type = 'button'; b.setAttribute('data-adm-tab', t[0]); b.textContent = t[1]; bar.appendChild(b);
    });
  }
  /* run before the dashboard's own tab handler, which only knows its built-in tabs */
  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('[data-adm-tab]') : null;
    if (!t) return;
    var tab = t.getAttribute('data-adm-tab');
    if (!RENDER[tab]) { current = ''; return; }      /* a built-in tab: leave it to the dashboard */
    e.stopImmediatePropagation();
    if (!window.__afIsAdmin) { say('This area is for administrators only.'); return; }
    mark(tab); RENDER[tab]();
  }, true);
  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-aw]') : null;
    if (!b || !window.__afIsAdmin) return;
    var a = b.getAttribute('data-aw');
    if (a === 'status') { topStatus = b.getAttribute('data-v'); renderTopups(); }
    else if (a === 'approve') decide(b, 'approve');
    else if (a === 'reject') decide(b, 'reject');
    else if (a === 'saveprices') savePrices(b);
    else if (a === 'savegift') saveGift(b);
    else if (a === 'saveranks') saveRanks(b);
    else if (a === 'tfind') findMember(b);
    else if (a === 'tsend') sendAst(b);
    else if (a === 'tfilter') loadHistory(true);
    else if (a === 'tmore') loadHistory(false);
    else if (a === 'p2pstatus') { p2pStatus = b.getAttribute('data-v'); renderP2P(); }
    else if (a === 'p2pnav') { p2pSection = b.getAttribute('data-v'); renderP2P(); }
    else if (a === 'p2pkycst') { kycStatus = b.getAttribute('data-v'); renderP2PKyc(); }
    else if (a === 'p2pkycok') p2pKycDecide(b, 'approve');
    else if (a === 'p2pkycno') p2pKycDecide(b, 'reject');
    else if (a === 'p2psavesettings') p2pSaveSettings(b);
    else if (a === 'p2pchat') p2pChat(b);
    else if (a === 'p2psay') p2pSay(b);
    else if (a === 'p2prelease') p2pDecide(b, 'release');
    else if (a === 'p2prefund') p2pDecide(b, 'refund');
  });
  /* typing a different member invalidates the member that was found */
  document.addEventListener('input', function (e) {
    var t = e.target;
    if (!t || !t.hasAttribute || !t.hasAttribute('data-aw-q')) return;
    tre.member = null; tre.idem = ''; tre.sig = '';
    var box = $('awMember'), send = $('awSend');
    if (box) box.innerHTML = '';
    if (send) send.disabled = true;
  });
  document.addEventListener('keydown', function (e) {
    var t = e.target;
    if (!t || e.key !== 'Enter' || !t.id) return;
    if (t.id === 'awQ') { e.preventDefault(); var f = document.querySelector('[data-aw="tfind"]'); if (f && !f.disabled) findMember(f); }
    else if (t.id === 'awTQ') { e.preventDefault(); loadHistory(true); }
  });
  document.addEventListener('change', function (e) {
    if (e.target && e.target.hasAttribute && e.target.hasAttribute('data-aw-filter')) loadHistory(true);
  });

  /* AST Treasury card on the Overview tab (added once per Overview render) */
  var injecting = false;
  function addSupplyToOverview() {
    var bd = body(); if (!bd || injecting || $('admAstSupply')) return;
    var on = document.querySelector('#admTabs [data-adm-tab="overview"].on');
    if (!on || !bd.querySelector('.adm-grid') || !window.__afIsAdmin) return;
    injecting = true;
    var holder = document.createElement('div'); holder.id = 'admAstSupply';
    holder.innerHTML = '<p class="adm-empty" style="padding:0 0 8px">Loading AST Treasury…</p>';
    bd.insertBefore(holder, bd.firstChild);
    api('GET', '/wallet/admin/overview').then(function (o) {
      var s = o.supply;
      holder.innerHTML = supplyHtml({ total: s.total, treasury: s.treasury, circulation: s.circulation, ok: s.ok },
        '<div class="adm-grid"><div class="adm-stat"><i>👥</i><b>' + s.holders + '</b><small>Members Holding AST</small></div>' +
        '<div class="adm-stat"><i>⏳</i><b>' + o.topups.pending + '</b><small>Pending Top-ups</small></div></div>' +
        '<div class="adm-grid"><div class="adm-stat"><i>⚖️</i><b>' + (o.p2p ? o.p2p.disputes : 0) + '</b><small>Open P2P disputes</small></div><div class="adm-stat"><i>🤝</i><b>' + ast(o.p2p ? o.p2p.escrow : 0) + '</b><small>AST in P2P escrow</small></div></div>' +
        '<div class="adm-grid"><div class="adm-stat"><i>💰</i><b>' + ast(o.p2p ? o.p2p.fees : 0) + '</b><small>P2P fees earned (AST)</small></div><div class="adm-stat"><i>🪪</i><b>' + (o.p2p ? o.p2p.kycPending : 0) + '</b><small>KYC waiting</small></div></div>');
    }).catch(function () { holder.innerHTML = ''; }).then(function () { injecting = false; });
  }
  function start() {
    addTabs();
    var bd = body();
    if (bd && 'MutationObserver' in window) new MutationObserver(addSupplyToOverview).observe(bd, { childList: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
