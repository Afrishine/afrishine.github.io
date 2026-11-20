/* AFRISHINE HUB: Admin Dashboard add-on for the AST wallet.
   Adds three tabs to the Admin Dashboard (Top-ups, Prices, Gifts) and an AST Total Supply card to Overview.
   Load it LAST in index.html:  <script src="/admin-wallet.js"></script>
   Every number and every rule is enforced by the Worker; this file only shows and edits them. */
(function () {
  'use strict';
  var WORKER = 'https://afrishine-media.usherluckyelie.workers.dev';
  var TABS = [['wtopups', '💳 Top-ups'], ['wprices', '🏷️ Prices'], ['wgifts', '🎁 Gifts']];
  var topStatus = 'pending';

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
    });
  }
  function body() { return $('admBody'); }
  function busy(t) { body().innerHTML = '<p class="adm-empty">' + esc(t || 'Loading…') + '</p>'; }
  function fail(e) { body().innerHTML = '<p class="adm-empty">' + esc((e && e.message) || 'Could not load. Please try again.') + '</p>'; }

  /* ---------- supply card (used on Overview and on the Top-ups tab) ---------- */
  function supplyHtml(s) {
    var pct = s.total ? Math.min(100, Math.max(0, (s.circulation / s.total) * 100)) : 0;
    return '<div class="adm-stat" style="margin-bottom:10px"><small>🪙 AST Total Supply (fixed)</small><b>' + whole(s.total) + ' AST</b>' +
      '<div class="adm-bar" style="margin-top:8px"><span style="width:' + pct.toFixed(2) + '%"></span></div>' +
      '<small style="margin-top:8px">' + pct.toFixed(3) + '% issued to members</small></div>' +
      '<div class="adm-grid"><div class="adm-stat"><i>👛</i><b>' + ast(s.circulation) + '</b><small>AST in members’ wallets</small></div>' +
      '<div class="adm-stat"><i>🏦</i><b>' + ast(s.remaining) + '</b><small>AST still available</small></div></div>';
  }

  /* ---------- tab 1: top-ups ---------- */
  function renderTopups() {
    busy();
    Promise.all([api('GET', '/wallet/admin/topups?status=' + topStatus), api('GET', '/wallet/config').catch(function () { return null; })]).then(function (r) {
      var j = r[0], cfg = r[1] && r[1].config, rows = j.items || [];
      var tabs = [['pending', 'Pending (' + j.pending + ')'], ['approved', 'Approved'], ['rejected', 'Rejected']].map(function (x) {
        return '<button type="button" class="adm-btn ' + (topStatus === x[0] ? 'gold' : '') + '" data-aw="status" data-v="' + x[0] + '">' + x[1] + '</button>';
      }).join(' ');
      var html = supplyHtml({ total: j.totalSupply, circulation: j.circulation, remaining: j.remaining }) +
        '<p class="adm-empty" style="padding:0 0 10px">AST is added to a member only after you press <b>Approve</b>. Nothing is credited automatically.</p>' +
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
    }).catch(fail);
  }
  function decide(btn, decision) {
    var card = btn.closest('[data-aw-req]'); if (!card) return;
    var id = card.getAttribute('data-aw-req'), a = card.querySelector('[data-aw-ast]'), n = card.querySelector('[data-aw-note]');
    var amount = a ? a.value.trim() : '';
    if (decision === 'approve') {
      if (!/^\d{1,9}(\.\d{1,2})?$/.test(amount) || !(Number(amount) > 0)) { say('Enter the AST amount to add, for example 25 or 25.50.'); return; }
      if (!confirm('Approve this top-up and add ' + amount + ' AST to this member’s wallet?')) return;
    } else if (!confirm('Reject this top-up request?')) return;
    Array.prototype.forEach.call(card.querySelectorAll('button'), function (b) { b.disabled = true; });
    api('POST', '/wallet/admin/decide', { id: id, decision: decision, astAmount: amount, note: n ? n.value.trim() : '' }).then(function () {
      say(decision === 'approve' ? 'Approved. AST added to the member.' : 'Request rejected.'); renderTopups();
    }).catch(function (e) { say((e && e.message) || 'Could not save.'); renderTopups(); });
  }

  /* ---------- tab 2: service prices ---------- */
  function pkgRows(kind, list) {
    return list.map(function (p, i) {
      return '<div class="adm-row" style="display:block" data-aw-pkg="' + kind + '" data-id="' + esc(p.id) + '"><b>' + esc(p.id) + '</b>' +
        '<input class="field" data-f="name" maxlength="30" value="' + esc(p.name) + '" placeholder="Name">' +
        '<div style="display:flex;gap:8px"><input class="field" data-f="ast" type="text" inputmode="decimal" value="' + esc(p.ast) + '" placeholder="AST"><input class="field" data-f="days" type="text" inputmode="numeric" value="' + esc(p.days) + '" placeholder="Days"></div></div>';
    }).join('');
  }
  function renderPrices() {
    busy();
    api('GET', '/wallet/config').then(function (j) {
      var p = j.config.prices;
      body().innerHTML = '<p class="adm-empty" style="padding:0 0 10px">Prices are in AST (1 AST = 1 USDT). Changes apply to new purchases right away.</p>' +
        '<div class="adm-form"><b>✔️ Verification Badge</b><input class="field" id="awVer" type="text" inputmode="decimal" value="' + esc(p.verification) + '" placeholder="Price in AST"></div>' +
        '<div class="adm-form"><b>👑 Premium (subscription)</b><div style="display:flex;gap:8px"><input class="field" id="awPremAst" type="text" inputmode="decimal" value="' + esc(p.premium.ast) + '" placeholder="AST"><input class="field" id="awPremDays" type="text" inputmode="numeric" value="' + esc(p.premium.days) + '" placeholder="Days"></div></div>' +
        '<div class="adm-form"><b>📣 Ads packages</b><div id="awAds">' + pkgRows('ads', p.ads) + '</div></div>' +
        '<div class="adm-form"><b>🚀 Boost packages</b><div id="awBoost">' + pkgRows('boost', p.boost) + '</div></div>' +
        '<button type="button" class="adm-btn gold" style="padding:13px;width:100%" data-aw="saveprices">Save prices</button><p class="adm-empty" id="awPriceMsg"></p>';
    }).catch(fail);
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
    busy();
    Promise.all([api('GET', '/wallet/admin/overview'), api('GET', '/wallet/config')]).then(function (r) {
      var o = r[0], g = r[1].config.gift, ranks = r[1].config.ranks, G = o.gifts;
      var stats = '<div class="adm-grid"><div class="adm-stat"><i>🎁</i><b>' + G.count + '</b><small>Gifts sent (all time)</small></div><div class="adm-stat"><i>🪙</i><b>' + ast(G.units) + '</b><small>AST gifted (all time)</small></div>' +
        '<div class="adm-stat"><i>🕒</i><b>' + G.last24hCount + '</b><small>Gifts in the last 24 hours</small></div><div class="adm-stat"><i>📈</i><b>' + ast(G.last24hUnits) + '</b><small>AST gifted in 24 hours</small></div></div>';
      var limits = '<div class="adm-form"><b>Gift limits</b><label class="creator-hint">Minimum per gift (AST)</label><input class="field" id="awGMin" type="text" inputmode="decimal" value="' + esc(g.min) + '">' +
        '<label class="creator-hint">Maximum per gift (AST)</label><input class="field" id="awGMax" type="text" inputmode="decimal" value="' + esc(g.max) + '">' +
        '<label style="display:flex;gap:9px;align-items:center;font-size:14px"><input type="checkbox" id="awGVer"' + (g.verifiedOnly ? ' checked' : '') + '> Only verified members can receive gifts</label>' +
        '<small class="adm-empty" style="padding:0">Each member can send at most ' + G.hourlyMax + ' gifts per hour (set in the Worker).</small>' +
        '<button type="button" class="adm-btn gold" data-aw="savegift" style="padding:12px">Save limits</button></div>';
      var rankForm = '<div class="adm-form"><b>Gifter ranks (points)</b><small class="adm-empty" style="padding:0">A member’s rank rises with the total AST they have gifted. The first rank must start at 0. A bonus is new AST given once when a member reaches the rank (it never goes past the Total Supply).</small><div id="awRanks">' +
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
    }).catch(fail);
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
    if (!list.length || list[0].min !== '0' && Number(list[0].min) !== 0) { say('The first rank must start at 0 AST.'); return; }
    for (var i = 0; i < list.length; i++) { if (!list[i].name || isNaN(Number(list[i].min)) || isNaN(Number(list[i].bonus))) { say('Check every rank: it needs a name and numbers.'); return; } }
    btn.disabled = true;
    api('POST', '/wallet/admin/config', { ranks: list }).then(function () { say('Ranks saved.'); renderGifts(); })
      .catch(function (e) { btn.disabled = false; say((e && e.message) || 'Could not save.'); });
  }

  /* ---------- wiring ---------- */
  var RENDER = { wtopups: renderTopups, wprices: renderPrices, wgifts: renderGifts };
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
    if (!RENDER[tab]) return;
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
  });

  /* Total Supply card on the Overview tab */
  var injecting = false;
  function addSupplyToOverview() {
    var bd = body(); if (!bd || injecting || $('admAstSupply')) return;
    var on = document.querySelector('#admTabs [data-adm-tab="overview"].on');
    if (!on || !bd.querySelector('.adm-grid') || !window.__afIsAdmin) return;
    injecting = true;
    var holder = document.createElement('div'); holder.id = 'admAstSupply';
    holder.innerHTML = '<p class="adm-empty" style="padding:0 0 8px">Loading AST supply…</p>';
    bd.insertBefore(holder, bd.firstChild);
    api('GET', '/wallet/admin/overview').then(function (o) {
      holder.innerHTML = supplyHtml(o.supply) + '<div class="adm-grid"><div class="adm-stat"><i>⏳</i><b>' + o.topups.pending + '</b><small>Top-ups waiting for you</small></div><div class="adm-stat"><i>👥</i><b>' + o.supply.holders + '</b><small>Members holding AST</small></div></div>';
    }).catch(function () { holder.innerHTML = ''; }).then(function () { injecting = false; });
  }
  function start() {
    addTabs();
    var bd = body();
    if (bd && 'MutationObserver' in window) new MutationObserver(addSupplyToOverview).observe(bd, { childList: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
