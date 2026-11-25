/* Afrishine Hub - admin tab "Pi Payouts": send small Pi TEST payments (App-to-User) to Pi members.
   Pi asks for A2U payments to 5 different wallets on the paired Testnet app before it grants a Mainnet app wallet.
   All money moves on the server (/api/pi-a2u). This file only shows the list and presses the buttons. */
(function () {
  'use strict';
  var API = '/api/pi-a2u', S = { data: null, busy: '', msg: '' };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function user() { return (typeof currentFirebaseUser !== 'undefined' && currentFirebaseUser) || null; }
  function ask(action, body) {
    var u = user(); if (!u) return Promise.reject(new Error('Please sign in first.'));
    return u.getIdToken().then(function (t) {
      body = body || {}; body.action = action;
      return fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify(body) });
    }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok || d.error) throw new Error(d.error || 'Something went wrong. Please try again.'); return d; }); });
  }
  function box() { return document.getElementById('admBody'); }
  function yes(v) { return v ? '✅' : '❌'; }
  function render() {
    var b = box(); if (!b) return;
    var d = S.data; if (!d) { b.innerHTML = '<p class="adm-empty">' + esc(S.msg || 'Loading…') + '</p>'; return; }
    var r = d.ready || {}, ready = r.hasApiKey && r.seedValid && r.hasSdk;
    var html = '<div class="adm-form"><b>Pi test payments (App → User)</b>' +
      '<small class="adm-empty" style="padding:0">Network: <b>' + esc(r.mode) + '</b> · Paid wallets: <b>' + d.completed + ' / ' + d.needed + '</b></small>' +
      '<small class="adm-empty" style="padding:0">' + yes(r.hasApiKey) + ' PI_NETWORK_API_KEY · ' + yes(r.seedValid) + ' PI_WALLET_SEED' + (r.hasSeed && !r.seedValid ? ' (not a valid seed)' : '') + ' · ' + yes(r.hasSdk) + ' Stellar package</small>' +
      (r.walletPublic ? '<small class="adm-empty" style="padding:0;word-break:break-all">App wallet (public): ' + esc(r.walletPublic) + ' · <a href="' + esc(r.explorer) + '" target="_blank" rel="noopener">Blockexplorer</a></small>' : '') +
      (ready ? '' : '<small class="adm-empty" style="padding:0;color:#ff9b9b">Finish the missing items in Vercel (Environment Variables), Redeploy, then press Refresh.</small>') +
      '<input class="field" id="paAmt" type="number" step="0.001" min="0.001" max="1" value="0.01" inputmode="decimal" placeholder="Amount (Pi)">' +
      '<input class="field" id="paMemo" maxlength="28" value="Afrishine test payment" placeholder="Memo">' +
      (S.msg ? '<small class="adm-empty" style="padding:0">' + esc(S.msg) + '</small>' : '') + '</div>' +
      '<h3 class="adm-h">Members who signed in with Pi</h3>';
    var rows = (d.members || []).map(function (m) {
      var tag = m.status === 'completed' ? '<span class="adm-tag">✅ Paid</span>' : (m.status ? '<span class="adm-tag">' + esc(m.status) + '</span>' : '');
      var act = m.status === 'completed' ? '' : '<div class="acts"><button type="button" class="adm-btn gold" data-pa="pay" data-uid="' + esc(m.uid) + '"' + (S.busy ? ' disabled' : '') + '>' + (S.busy === m.uid ? 'Sending…' : (m.status ? 'Resume' : 'Pay')) + '</button></div>';
      return '<div class="adm-row"><div class="grow"><b>' + esc(m.username || 'Pi member') + '</b> ' + tag + '<small>' + esc(m.uid) + '</small>' + (m.txid ? '<small style="word-break:break-all">' + esc(m.txid) + '</small>' : '') + (m.error ? '<small style="color:#ff9b9b">' + esc(m.error) + '</small>' : '') + '</div>' + act + '</div>';
    }).join('');
    html += (rows || '<p class="adm-empty">No Pi members yet. Ask your testers to open the app and press Login with Pi.</p>') + '<button type="button" class="adm-btn" data-pa="refresh">Refresh</button>';
    b.innerHTML = html;
  }
  function load() {
    S.msg = ''; S.data = null; render();
    ask('overview').then(function (d) { S.data = d; render(); }).catch(function (e) { S.msg = e.message; S.data = null; render(); });
  }
  document.addEventListener('click', function (ev) {
    var t = ev.target && ev.target.closest ? ev.target.closest('[data-pa]') : null; if (!t || !box() || !box().contains(t)) return;
    var a = t.getAttribute('data-pa');
    if (a === 'refresh') return load();
    if (a === 'pay' && !S.busy) {
      var uid = t.getAttribute('data-uid'), amt = parseFloat((document.getElementById('paAmt') || {}).value), memo = (document.getElementById('paMemo') || {}).value || '';
      if (!(amt > 0) || amt > 1) { S.msg = 'Amount must be more than 0 and at most 1 Pi.'; return render(); }
      if (!confirm('Send ' + amt + ' Pi from the app wallet to this member?')) return;
      S.busy = uid; S.msg = 'Sending… please wait, do not close this page.'; render();
      ask('pay', { uid: uid, amount: amt, memo: memo }).then(function (r) { S.msg = 'Done ✅ Transaction: ' + r.txid; S.busy = ''; return ask('overview'); })
        .then(function (d) { S.data = d; render(); })
        .catch(function (e) { S.msg = e.message; S.busy = ''; return ask('overview').then(function (d) { S.data = d; render(); }).catch(function () { render(); }); });
    }
  });
  window.afPiPayouts = function () { load(); };
})();
