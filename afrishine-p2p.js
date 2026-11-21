/* =============================================================================
   AFRISHINE HUB: P2P TRADING (buy and sell AST with RWF or USDT)  -  afrishine-p2p.js
   Put this file in the ROOT of Afrishine Hub (next to index.html) and add ONE line AFTER afrishine-wallet.js:
       <script src="/afrishine-p2p.js"></script>
   The "P2P Trading" button on the wallet home opens it (window.AfrishineP2P.open()).
   The AST of every order is held in escrow by the Worker. This file never changes a balance.
   Written for Android 8+ (no optional chaining, no ??, no spread, no flex gap).
   ============================================================================= */
(function () {
  'use strict';
  if (window.__afP2PLoaded) return;
  window.__afP2PLoaded = true;
  try {
    var WORKER = 'https://afrishine-media.usherluckyelie.workers.dev';
    var $ = function (id) { return document.getElementById(id); };
    function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function me() {
      try { if (typeof currentFirebaseUser !== 'undefined' && currentFirebaseUser) return currentFirebaseUser; } catch (_) { }
      try { if (typeof auth !== 'undefined' && auth && auth.currentUser) return auth.currentUser; } catch (_) { }
      return null;
    }
    function commas(s) { var p = String(s).split('.'); p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ','); return p.join('.'); }
    function ast(u) { return commas(((Number(u) || 0) / 100).toFixed(2)); }
    function uuid() {
      var a = new Uint8Array(12), s = '';
      try { (window.crypto || window.msCrypto).getRandomValues(a); } catch (_) { for (var i = 0; i < 12; i++) a[i] = Math.floor(Math.random() * 256); }
      for (var j = 0; j < a.length; j++) s += ('0' + a[j].toString(16)).slice(-2);
      return s;
    }
    function fdate(ms) { var d = new Date(Number(ms) || 0); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' • ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }); }
    function fiatText(cur, units, price) { var v = (Number(units) / 100) * Number(price); return commas(cur === 'RWF' ? String(Math.round(v)) : v.toFixed(2)); }
    function feeOf(u) { var c = P.cfg; if (!c || !c.feeBps) return 0; return Math.max(c.minFeeUnits || 0, Math.ceil(u * c.feeBps / 10000)); }
    function feePct() { return P.cfg && P.cfg.feeBps ? String(P.cfg.feeBps / 100) : '0'; }
    function errMsg(e) { return (e && e.message) || 'Something went wrong. Please try again.'; }
    function appCheck() {
      try { if (typeof firebase !== 'undefined' && typeof firebase.appCheck === 'function') return firebase.appCheck().getToken().then(function (t) { return { 'X-Firebase-AppCheck': t.token }; }).catch(function () { return {}; }); } catch (_) { }
      return Promise.resolve({});
    }
    function api(method, path, body) {
      var u = me();
      if (!u) return Promise.reject({ message: 'Please sign in first.' });
      return Promise.all([u.getIdToken(), appCheck()]).then(function (r) {
        var headers = Object.assign({ Authorization: 'Bearer ' + r[0] }, r[1]), opts = { method: method, headers: headers };
        if (body !== undefined) { headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
        return fetch(WORKER + path, opts);
      }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (j) {
          if (!res.ok || j.success === false) throw { message: j.message || j.error || (res.status === 404 ? 'P2P is not available yet. Please try again later.' : 'Something went wrong. Please try again.'), code: j.code };
          return j;
        });
      }, function (e) { if (e && e.message && e.code) throw e; throw { message: 'No connection. Please check your internet and try again.' }; });
    }
    function compress(file) {
      return new Promise(function (res, rej) {
        var img = new Image(), url = URL.createObjectURL(file);
        img.onload = function () {
          var r = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement('canvas');
          c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
          c.toBlob(function (b) { b ? res(b) : rej(new Error('compress')); }, 'image/jpeg', 0.82);
        };
        img.onerror = function () { rej(new Error('image')); }; img.src = url;
      });
    }
    function uploadImage(file) {
      var u = me();
      return compress(file).then(function (blob) {
        return Promise.all([u.getIdToken(), appCheck()]).then(function (r) {
          return fetch(WORKER + '/upload?filename=p2p.jpg', { method: 'POST', headers: Object.assign({ Authorization: 'Bearer ' + r[0], 'Content-Type': 'image/jpeg' }, r[1]), body: blob });
        });
      }, function () { throw { message: 'This image could not be read. Please choose another one.' }; }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (j) { if (!res.ok || !j.success || !j.url) throw { message: j.message || 'The image could not be uploaded. Please try again.' }; return j.url; });
      }, function (e) { if (e && e.message) throw e; throw { message: 'No connection. Please check your internet and try again.' }; });
    }
    function copyText(t) {
      function fb() { var ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.top = '-1000px'; document.body.appendChild(ta); ta.focus(); ta.select(); var ok = false; try { ok = document.execCommand('copy'); } catch (_) { } document.body.removeChild(ta); return ok; }
      if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(t).then(function () { return true; }, function () { return fb(); });
      return Promise.resolve(fb());
    }
    var profiles = {};
    function profile(uid) {
      var c = profiles[uid]; if (c) return Promise.resolve(c);
      var d; try { d = (typeof db !== 'undefined') ? db : null; } catch (_) { d = null; }
      if (!d || !uid) return Promise.resolve({});
      return d.collection('publicProfiles').doc(uid).get().then(function (s) { var v = s.exists ? s.data() : {}; profiles[uid] = v; return v; }).catch(function () { return {}; });
    }
    var SEAL = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10.5" fill="#1d9bf0"/><path d="M7.4 12.3l3.1 3.1 6-6.6" fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    function avatar(name, uid) { return '<span class="afp-av" data-av="' + esc(uid || '') + '"><span>' + esc(String(name || 'A').charAt(0).toUpperCase()) + '</span></span>'; }
    function paintAvatars() {
      Array.prototype.forEach.call(root.querySelectorAll('[data-av]'), function (el) {
        var uid = el.getAttribute('data-av'); if (!uid || el.getAttribute('data-done')) return;
        el.setAttribute('data-done', '1');
        profile(uid).then(function (p) { if (p && /^https:\/\//.test(p.photoURL || '')) { var im = document.createElement('img'); im.alt = ''; im.referrerPolicy = 'no-referrer'; im.onerror = function () { im.style.display = 'none'; }; im.src = p.photoURL; el.appendChild(im); } });
      });
    }

    /* ------------------------------------------------------------------ styles */
    var css = [
      '.afp{position:fixed;left:0;right:0;top:0;bottom:0;z-index:10001;display:none;flex-direction:column;background:linear-gradient(180deg,#0a0420 0%,#120733 60%,#0a0420 100%);color:#fff;font-family:Roboto,system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-tap-highlight-color:transparent}',
      '.afp.on{display:flex}.afp *{box-sizing:border-box}.afp button{font-family:inherit;cursor:pointer;color:inherit}',
      '.afp-head{display:flex;align-items:center;padding:calc(10px + env(safe-area-inset-top,0px)) 12px 8px;flex-shrink:0}',
      '.afp-back{width:40px;height:40px;border:0;background:none;color:#8e7cff;font-size:30px;line-height:1}',
      '.afp-title{flex:1;min-width:0;margin-left:4px}.afp-title b{display:block;font-size:21px}.afp-title small{display:block;color:#c8b9ff;font-size:12.5px}',
      '.afp-body{flex:1;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding:6px 12px 16px}',
      '.afp-wrap{max-width:560px;margin:0 auto}',
      '.afp-nav{display:flex;flex-shrink:0;background:#0c0624;border-top:1px solid #3a2a8a;padding:6px 4px calc(6px + env(safe-area-inset-bottom,0px))}',
      '.afp-nav button{flex:1;border:0;background:none;color:#a99be0;font-size:12.5px;font-weight:700;padding:6px 0 4px;min-height:50px}.afp-nav button span{display:block;font-size:22px;line-height:1.1}',
      '.afp-nav button.on{color:#ffb91f;box-shadow:inset 0 -3px 0 #ffb91f}',
      '.afp-seg{display:flex;margin:4px 0 10px;border:1px solid #4a35b8;border-radius:22px;overflow:hidden}',
      '.afp-seg button{flex:1;border:0;background:#150b40;font-weight:900;font-size:16px;padding:11px 0}.afp-seg button.on.buy{background:#1f9d55}.afp-seg button.on.sell{background:#d8303c}',
      '.afp-chips{display:flex;flex-wrap:wrap;margin:0 -3px 6px}.afp-chips button{margin:3px;padding:0 14px;min-height:36px;border-radius:18px;border:1px solid #5b3fd0;background:#241470;font-weight:800;font-size:14px}.afp-chips button.on{background:#ffb91f;color:#2a1700;border-color:#ffb91f}',
      '.afp-card{border:1px solid #4a35b8;border-radius:18px;background:linear-gradient(135deg,#1b0f4f,#120a33);padding:12px 14px;margin:0 0 10px}',
      '.afp-row{display:flex;align-items:center}.afp-grow{flex:1;min-width:0}',
      '.afp-av{position:relative;display:inline-grid;place-items:center;width:40px;height:40px;border-radius:50%;overflow:hidden;background:linear-gradient(145deg,#5b2de0,#2a3a8f);border:2px solid #6b57d8;font-weight:800;font-size:16px;flex-shrink:0;margin-right:10px}',
      '.afp-av img{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover}',
      '.afp-vb{display:inline-block;width:15px;height:15px;margin-left:4px;vertical-align:-3px;line-height:0}.afp-vb svg{display:block;width:100%;height:100%}',
      '.afp small,.afp .sm{color:#bfb2f0;font-size:12.5px}',
      '.afp-price{font-size:24px;font-weight:900;color:#fff;margin:6px 0 2px}.afp-price small{font-size:13px;color:#ffb91f;font-weight:700}',
      '.afp-meth{display:inline-block;margin:4px 6px 0 0;padding:3px 9px;border-radius:10px;background:#2a1a7a;font-size:12px;font-weight:700;color:#e4dcff}',
      '.afp-gold,.afp-ghost,.afp-green,.afp-red{border:0;border-radius:22px;font-weight:900;font-size:15px;padding:0 18px;min-height:44px}',
      '.afp-gold{background:linear-gradient(180deg,#ffd54a,#f2a100);color:#2a1700!important}.afp-ghost{border:1px solid #5b3fd0;background:#241470;color:#fff}.afp-green{background:#1f9d55;color:#fff}.afp-red{background:#d8303c;color:#fff}',
      '.afp button:disabled{opacity:.5}.afp-block{display:block;width:100%}',
      '.afp-h2{font-size:20px;font-weight:900;margin:0 0 4px}.afp-h2.gold{color:#ffb91f}',
      '.afp-sub{color:#cfc5f5;font-size:14px;line-height:1.45;margin:0 0 8px}',
      '.afp-input{width:100%;min-height:44px;padding:0 14px;border-radius:14px;border:1px solid #4a35b8;background:#f1edff;color:#1a1040;font-size:16px;outline:0}textarea.afp-input{padding:10px 14px;min-height:70px;font-family:inherit}',
      '.afp-label{display:block;margin:10px 0 4px;font-size:13.5px;font-weight:700;color:#e4dcff}',
      '.afp-err{margin:8px 0 0;padding:9px 12px;border-radius:12px;background:#4a1020;border:1px solid #d8303c;color:#ffd0d4;font-size:14px}',
      '.afp-ok{margin:8px 0 0;padding:9px 12px;border-radius:12px;background:#0f3a24;border:1px solid #1f9d55;color:#c9f5da;font-size:14px}',
      '.afp-warn{margin:8px 0;padding:10px 12px;border:1px solid #ffb91f;border-radius:14px;background:#2a1d00;color:#ffe9b0;font-size:13.5px;line-height:1.5}.afp-warn ul{margin:4px 0 0 18px;padding:0}',
      '.afp-empty{padding:22px 8px;text-align:center;color:#cfc5f5;font-size:14.5px;line-height:1.55}',
      '.afp-pill{display:inline-block;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:800;background:#3b2a8f}',
      '.afp-pill.created{background:#7a5a00;color:#ffe08a}.afp-pill.paid{background:#1d4e9e;color:#d0e4ff}.afp-pill.disputed{background:#7a1a24;color:#ffd0d4}.afp-pill.released{background:#14632f;color:#c9f5da}',
      '.afp-kv{display:flex;padding:7px 0;border-bottom:1px solid #2c1f6e;font-size:14.5px}.afp-kv:last-child{border-bottom:0}.afp-kv span{flex:0 0 42%;color:#bfb2f0}.afp-kv b{flex:1;text-align:right;word-break:break-word}',
      '.afp-timer{font-size:30px;font-weight:900;color:#ffb91f;text-align:center;margin:2px 0}',
      '.afp-modal{position:absolute;left:0;right:0;top:0;bottom:0;z-index:5;background:rgba(5,2,18,.82);display:flex;align-items:flex-end;justify-content:center}',
      '.afp-sheet{width:100%;max-width:560px;max-height:92%;overflow-y:auto;-webkit-overflow-scrolling:touch;background:linear-gradient(180deg,#1b0f4f,#0f0830);border:1px solid #5b3fd0;border-bottom:0;border-radius:24px 24px 0 0;padding:16px 16px calc(18px + env(safe-area-inset-bottom,0px))}',
      '.afp-sheet h3{margin:0 0 6px;font-size:20px}.afp-x{float:right;width:36px;height:36px;border-radius:50%;border:1px solid #4a35b8;background:#1b1060;font-size:18px}',
      '.afp-chat{max-height:300px;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:4px 0}',
      '.afp-msg{margin:6px 0;max-width:85%;padding:8px 12px;border-radius:14px;font-size:14.5px;line-height:1.4;word-break:break-word;background:#241470}',
      '.afp-msg.mine{margin-left:auto;background:#3b2a8f}.afp-msg.system{max-width:100%;background:#2a1d00;color:#ffe9b0;font-size:13px;text-align:center}.afp-msg.support{background:#14632f}',
      '.afp-msg small{display:block;margin-bottom:2px;font-weight:700}.afp-msg img{display:block;max-width:100%;max-height:200px;border-radius:10px;margin-top:4px}',
      '.afp-img{max-width:100%;max-height:200px;border-radius:12px;margin-top:8px;display:block}',
      '.afp-toast{position:absolute;left:50%;bottom:calc(80px + env(safe-area-inset-bottom,0px));-webkit-transform:translateX(-50%);transform:translateX(-50%);z-index:9;max-width:88%;padding:10px 18px;border-radius:22px;background:#241470;border:1px solid #8e7cff;font-size:14px;font-weight:700;text-align:center}',
      '.afp-spin{display:inline-block;width:18px;height:18px;border:3px solid #ffffff44;border-top-color:#ffb91f;border-radius:50%;-webkit-animation:afpspin .8s linear infinite;animation:afpspin .8s linear infinite;vertical-align:-4px;margin-right:8px}',
      '@-webkit-keyframes afpspin{to{-webkit-transform:rotate(360deg)}}@keyframes afpspin{to{transform:rotate(360deg)}}'
    ].join('\n');
    var styleEl = document.createElement('style'); styleEl.textContent = css; document.head.appendChild(styleEl);

    /* ------------------------------------------------------------------ state */
    var P = { open: false, tab: 'market', side: 'sell', cur: 'RWF', method: '', amount: '', ads: null, adsErr: '', orders: null, scope: 'active', ordersErr: '', mine: null, cfg: null,
      view: 'main', order: null, msgs: [], skew: 0, flow: null, ordSig: '', lastView: 'main', ratings: { mine: '', theirs: '', theirComment: '' }, kyc: null };
    var root = null, timer = null, tick = null;
    var METH = { mtn: 'MTN Mobile Money', airtel: 'Airtel Money', bank: 'Bank transfer', usdt_trc20: 'USDT (TRC20)', usdt_bep20: 'USDT (BEP20)', binance: 'Binance Pay' };
    var CUR_METHODS = { RWF: ['mtn', 'airtel', 'bank'], USDT: ['usdt_trc20', 'usdt_bep20', 'binance'] };
    function mname(k) { return (P.cfg && P.cfg.methods[k] && P.cfg.methods[k].name) || METH[k] || k; }

    function build() {
      if (root) return;
      root = document.createElement('div'); root.id = 'afP2P'; root.className = 'afp';
      root.innerHTML = '<div class="afp-head"><button class="afp-back" id="afpBack" aria-label="Back">‹</button><div class="afp-title"><b>🤝 P2P Trading</b><small>Buy and sell AST safely • escrow protected</small></div></div><div class="afp-body" id="afpBody"></div>' +
        '<div class="afp-nav" id="afpNav"><button data-nav="market"><span>🏪</span>Market</button><button data-nav="orders"><span>📜</span>Orders</button><button data-nav="ads"><span>📢</span>My Ads</button></div>';
      document.body.appendChild(root);
      root.addEventListener('click', onClick);
      root.addEventListener('input', onInput);
      root.addEventListener('change', onInput);
    }
    function toast(t) {
      var old = $('afpToast'); if (old) old.remove();
      var el = document.createElement('div'); el.id = 'afpToast'; el.className = 'afp-toast'; el.textContent = t; root.appendChild(el);
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 3200);
    }
    function openSheet(html) { var old = $('afpModal'); if (old) old.remove(); var m = document.createElement('div'); m.className = 'afp-modal'; m.id = 'afpModal'; m.innerHTML = '<div class="afp-sheet" id="afpSheet">' + html + '</div>'; root.appendChild(m); m.addEventListener('click', function (e) { if (e.target === m) closeSheet(); }); }
    function closeSheet() { var m = $('afpModal'); if (m) m.remove(); P.flow = null; }
    function setSheet(html) { var s = $('afpSheet'); if (s) s.innerHTML = html; else openSheet(html); }
    function sheetHead(t) { return '<button class="afp-x" data-act="closesheet" aria-label="Close">✕</button><h3>' + t + '</h3>'; }
    function vb() { return '<span class="afp-vb">' + SEAL + '</span>'; }

    /* ------------------------------------------------------------------ render */
    function setNav() {
      Array.prototype.forEach.call(root.querySelectorAll('#afpNav button'), function (b) { b.classList.toggle('on', P.view === 'main' && b.getAttribute('data-nav') === P.tab); });
      $('afpNav').style.display = P.view === 'order' ? 'none' : 'flex';
    }
    function render() {
      if (!root) return;
      setNav();
      var body = $('afpBody'), html;
      if (!me()) html = '<div class="afp-card" style="margin-top:20px;text-align:center"><h2 class="afp-h2">Sign in to use P2P</h2><p class="afp-sub">Your orders are linked to your Afrishine Hub account.</p></div>';
      else if (P.view === 'order') { body.innerHTML = '<div class="afp-wrap">' + orderShell() + '</div>'; paintOrder(true); paintAvatars(); return; }
      else if (P.tab === 'orders') html = viewOrders();
      else if (P.tab === 'ads') html = viewAds();
      else html = viewMarket();
      body.innerHTML = '<div class="afp-wrap">' + html + '</div>';
      paintAvatars();
    }
    function viewMarket() {
      var buy = P.side === 'sell';
      var html = '<div class="afp-seg"><button class="buy' + (buy ? ' on' : '') + '" data-act="side:sell">Buy AST</button><button class="sell' + (!buy ? ' on' : '') + '" data-act="side:buy">Sell AST</button></div>';
      html += '<div class="afp-chips"><button class="' + (P.cur === 'RWF' ? 'on' : '') + '" data-act="cur:RWF">RWF</button><button class="' + (P.cur === 'USDT' ? 'on' : '') + '" data-act="cur:USDT">USDT</button>' +
        '<button class="' + (!P.method ? 'on' : '') + '" data-act="meth:">All methods</button>' + CUR_METHODS[P.cur].map(function (k) { return '<button class="' + (P.method === k ? 'on' : '') + '" data-act="meth:' + k + '">' + esc(mname(k)) + '</button>'; }).join('') + '</div>';
      html += '<div class="afp-row" style="margin-bottom:10px"><input class="afp-input" id="afpAmt" type="text" inputmode="decimal" placeholder="Amount in AST (optional)" value="' + esc(P.amount) + '" style="flex:1;min-width:0;margin-right:8px"><button class="afp-ghost" data-act="search">🔍</button></div>';
      if (P.ads === null) return html + '<div class="afp-empty"><span class="afp-spin"></span>Loading adverts…</div>';
      if (P.adsErr) return html + '<div class="afp-err">' + esc(P.adsErr) + '</div><button class="afp-ghost afp-block" style="margin-top:8px" data-act="search">Try again</button>';
      if (!P.ads.length) return html + '<div class="afp-empty">No adverts found for these filters.<br>' + (buy ? 'Try another currency or method.' : 'Nobody is buying AST right now.') + '</div>';
      return html + P.ads.map(adCard).join('');
    }
    function adCard(a) {
      var st = a.stats || {}, buy = a.side === 'sell';
      return '<div class="afp-card"><div class="afp-row">' + avatar(a.name, a.uid) + '<div class="afp-grow"><b>' + esc(a.name) + '</b>' + vb() + '<br><small>' + st.done + ' orders • ' + st.rate + '% completed' + (st.avgMin ? ' \u2022 ~' + st.avgMin + ' min' : '') + (st.pos !== null && st.pos !== undefined ? ' \u2022 \ud83d\udc4d ' + st.pos + '% (' + (st.up + st.down) + ')' : '') + '</small></div></div>' +
        '<div class="afp-price">' + commas(a.price) + ' <small>' + esc(a.currency) + ' / 1 AST</small></div>' +
        '<small>Available: <b style="color:#fff">' + ast(a.remaining) + ' AST</b> • Limit: <b style="color:#fff">' + ast(a.min) + ' – ' + ast(a.max) + ' AST</b></small><div>' +
        a.methods.map(function (k) { return '<span class="afp-meth">' + esc(mname(k)) + '</span>'; }).join('') + '</div>' + (a.terms ? '<p class="sm" style="margin:8px 0 0">' + esc(a.terms) + '</p>' : '') +
        '<div style="margin-top:10px">' + (a.mine ? '<button class="afp-ghost afp-block" disabled>Your advert</button>' : '<button class="' + (buy ? 'afp-green' : 'afp-red') + ' afp-block" data-act="trade:' + esc(a.id) + '">' + (buy ? 'Buy AST' : 'Sell AST') + '</button>') + '</div></div>';
    }
    function orderCard(o) {
      var buyer = o.role === 'buyer';
      return '<div class="afp-card" data-act="open:' + esc(o.id) + '" style="cursor:pointer"><div class="afp-row"><div class="afp-grow"><b style="color:' + (buyer ? '#22d36b' : '#ff6672') + '">' + (buyer ? 'Buy' : 'Sell') + ' AST</b> <span class="sm">with ' + esc(o.otherName) + '</span></div><span class="afp-pill ' + esc(o.status) + '">' + esc(statusLabel(o)) + '</span></div>' +
        '<div class="afp-price" style="font-size:20px">' + ast(o.units) + ' <small>AST</small> • ' + commas(o.fiat) + ' <small>' + esc(o.currency) + '</small></div><small>' + esc(fdate(o.createdAt)) + ' • ' + esc(o.methodName) + '</small></div>';
    }
    function statusLabel(o) {
      return { created: 'Waiting for payment', paid: 'Payment sent', disputed: 'Dispute', released: 'Completed', cancelled: 'Cancelled', expired: 'Expired', refunded: 'Returned to seller' }[o.status] || o.status;
    }
    function viewOrders() {
      var html = '<div class="afp-seg"><button class="' + (P.scope === 'active' ? 'on buy' : '') + '" data-act="scope:active">Active</button><button class="' + (P.scope === 'done' ? 'on buy' : '') + '" data-act="scope:done">Finished</button></div>';
      if (P.orders === null) return html + '<div class="afp-empty"><span class="afp-spin"></span>Loading…</div>';
      if (P.ordersErr) return html + '<div class="afp-err">' + esc(P.ordersErr) + '</div>';
      if (!P.orders.length) return html + '<div class="afp-empty">' + (P.scope === 'active' ? 'You have no open orders. Choose an advert in the Market to start.' : 'No finished orders yet.') + '</div>';
      return html + P.orders.map(orderCard).join('');
    }
    function kycCard() {
      var k = P.kyc, c = P.cfg, need = c && c.kyc === 'all' ? 'Required for all P2P trades.' : (c && c.kyc === 'sellers' ? 'Required to sell AST.' : 'Optional: verified traders earn more trust.');
      if (!k) return '';
      var label = { none: 'Not verified', pending: 'Under review', approved: 'Verified \u2714', rejected: 'Not approved' }[k.status] || k.status;
      return '<div class="afp-card"><div class="afp-row"><div class="afp-h2 gold" style="flex:1;margin:0">\ud83e\udeaa Identity verification</div><span class="afp-pill ' + (k.status === 'approved' ? 'released' : (k.status === 'rejected' ? 'disputed' : 'created')) + '">' + label + '</span></div><p class="afp-sub" style="margin:6px 0 0">' + need + '</p>' +
        (k.status === 'rejected' && k.note ? '<div class="afp-err">' + esc(k.note) + '</div>' : '') +
        (k.status === 'none' || k.status === 'rejected' ? '<button class="afp-ghost afp-block" style="margin-top:8px" data-act="kycstart">Verify my identity</button>' : '') + '</div>';
    }
    function viewAds() {
      var m = P.mine, html = kycCard() + '<button class="afp-gold afp-block" data-act="newad" style="margin:4px 0 10px">\u2795 Post a new advert</button>';
      if (m === null) return html + '<div class="afp-empty"><span class="afp-spin"></span>Loading…</div>';
      var st = m.stats || { done: 0, rate: 100, avgMin: 0 };
      html += '<div class="afp-card"><div class="afp-h2 gold">My trading record</div><div class="afp-kv"><span>Completed orders</span><b>' + st.done + '</b></div><div class="afp-kv"><span>Completion rate</span><b>' + st.rate + '%</b></div><div class="afp-kv"><span>Average release time</span><b>' + (st.avgMin ? st.avgMin + ' min' : '—') + '</b></div></div>';
      if (!m.items.length) return html + '<div class="afp-empty">You have no adverts. Post one to sell or buy AST.<br>Only verified members can post adverts.</div>';
      return html + m.items.map(function (a) {
        var sell = a.side === 'sell';
        return '<div class="afp-card"><div class="afp-row"><b style="color:' + (sell ? '#ff6672' : '#22d36b') + '">' + (sell ? 'I sell AST' : 'I buy AST') + '</b><span class="afp-pill ' + (a.status === 'online' ? 'released' : 'created') + '" style="margin-left:8px">' + (a.status === 'online' ? 'Online' : 'Offline') + '</span></div>' +
          '<div class="afp-price">' + commas(a.price) + ' <small>' + esc(a.currency) + ' / 1 AST</small></div><small>Left: <b style="color:#fff">' + ast(a.remaining) + '</b> of ' + ast(a.total) + ' AST • Limit ' + ast(a.min) + '–' + ast(a.max) + '</small><div>' + a.methods.map(function (k) { return '<span class="afp-meth">' + esc(mname(k)) + '</span>'; }).join('') + '</div>' +
          '<div class="afp-row" style="margin-top:10px"><button class="afp-ghost" style="flex:1;margin-right:8px" data-act="adst:' + esc(a.id) + ':' + (a.status === 'online' ? 'offline' : 'online') + '">' + (a.status === 'online' ? 'Go offline' : 'Go online') + '</button><button class="afp-ghost" style="flex:1" data-act="adst:' + esc(a.id) + ':closed">Close</button></div></div>';
      }).join('');
    }

    /* ------------------------------------------------------------------ data */
    function loadCfg() { return P.cfg ? Promise.resolve(P.cfg) : api('GET', '/wallet/p2p/config').then(function (j) { P.cfg = j; return j; }); }
    function loadAds() {
      P.ads = null; P.adsErr = ''; if (P.view === 'main' && P.tab === 'market') render();
      var q = '?side=' + P.side + '&currency=' + P.cur + (P.method ? '&method=' + P.method : '') + (P.amount ? '&amount=' + encodeURIComponent(P.amount) : '');
      var side = P.side;
      api('GET', '/wallet/p2p/ads' + q).then(function (j) { if (side !== P.side) return; P.ads = j.items; if (P.view === 'main' && P.tab === 'market' && !$('afpModal')) render(); },
        function (e) { P.ads = []; P.adsErr = errMsg(e); if (P.view === 'main' && P.tab === 'market') render(); });
    }
    function loadOrders(silent) {
      if (!silent) { P.orders = null; P.ordersErr = ''; if (P.tab === 'orders') render(); }
      var scope = P.scope;
      api('GET', '/wallet/p2p/orders?scope=' + scope).then(function (j) { if (scope !== P.scope) return; P.orders = j.items; P.ordersErr = ''; if (P.view === 'main' && P.tab === 'orders' && !$('afpModal')) render(); },
        function (e) { if (!silent) { P.orders = []; P.ordersErr = errMsg(e); if (P.tab === 'orders') render(); } });
    }
    function loadMine() { api('GET', '/wallet/p2p/kyc').then(function (j) { P.kyc = j; if (P.view === 'main' && P.tab === 'ads' && !$('afpModal') && P.mine) render(); }, function () { }); api('GET', '/wallet/p2p/myads').then(function (j) { P.mine = j; if (P.view === 'main' && P.tab === 'ads' && !$('afpModal')) render(); }, function (e) { P.mine = { items: [], stats: null }; toast(errMsg(e)); if (P.tab === 'ads') render(); }); }
    function showTab(t) {
      P.tab = t; P.view = 'main'; stopOrderTimers(); render();
      var b = $('afpBody'); if (b) b.scrollTop = 0;
      if (t === 'market') loadAds(); else if (t === 'orders') loadOrders(false); else loadMine();
    }

    /* ------------------------------------------------------------------ trade sheet (start an order) */
    function findAd(id) { var l = P.ads || []; for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i]; return null; }
    function startTrade(id) {
      var a = findAd(id); if (!a) return;
      var buy = a.side === 'sell';
      P.flow = { type: 'trade', ad: a, buy: buy, method: a.methods[0], amount: '', name: '', account: '', idem: uuid(), busy: false, error: '' };
      paintTrade();
    }
    function paintTrade() {
      var F = P.flow; if (!F || F.type !== 'trade') return; var a = F.ad;
      var u = Math.round(Number(F.amount) * 100), fiat = Number(F.amount) > 0 ? fiatText(a.currency, u, a.price) : '0';
      var html = sheetHead(F.buy ? 'Buy AST from ' + esc(a.name) : 'Sell AST to ' + esc(a.name)) +
        '<div class="afp-price" style="margin:0">' + commas(a.price) + ' <small>' + esc(a.currency) + ' / 1 AST</small></div><small>Limit ' + ast(a.min) + ' – ' + ast(a.max) + ' AST</small>' +
        '<label class="afp-label">Amount of AST</label><input class="afp-input" id="afpTAmt" type="text" inputmode="decimal" autocomplete="off" placeholder="' + ast(a.min) + ' – ' + ast(a.max) + '" value="' + esc(F.amount) + '">' +
        '<div class="afp-row" style="margin-top:6px"><span class="sm" style="flex:1">' + (F.buy ? 'You will pay' : 'You will receive') + '</span><b id="afpTFiat" style="font-size:20px;color:#ffb91f">' + fiat + ' ' + esc(a.currency) + '</b></div>' +
        '<div class="sm" id="afpTFee" style="margin-top:6px">' + feeText(F) + '</div><label class="afp-label">Payment method</label><div class="afp-chips">' + a.methods.map(function (k) { return '<button class="' + (F.method === k ? 'on' : '') + '" data-act="tmeth:' + k + '">' + esc(mname(k)) + '</button>'; }).join('') + '</div>';
      if (!F.buy) html += '<label class="afp-label">Your account name (where you receive money)</label><input class="afp-input" id="afpTName" maxlength="60" value="' + esc(F.name) + '"><label class="afp-label">Your account number / phone / address</label><input class="afp-input" id="afpTAcc" maxlength="80" value="' + esc(F.account) + '">';
      html += '<div class="afp-warn">' + (F.buy ? 'After you confirm, the seller’s AST is locked in escrow. You then have <b>30 minutes</b> to pay the seller directly and upload your payment screenshot.' : 'After you confirm, <b>your AST is locked in escrow</b> until you receive the money and release it. The buyer has 30 minutes to pay you.') + '</div>' +
        (F.error ? '<div class="afp-err">' + esc(F.error) + '</div>' : '') + '<button class="afp-gold afp-block" data-act="tconfirm"' + (F.busy ? ' disabled' : '') + '>' + (F.busy ? 'Please wait…' : (F.buy ? 'Buy AST' : 'Sell AST')) + '</button>';
      var keep = document.activeElement && document.activeElement.id;
      setSheet(html);
      if (keep && $(keep) && !F.busy) { try { $(keep).focus(); var v = $(keep).value; $(keep).setSelectionRange(v.length, v.length); } catch (_) { } }
    }
    function feeText(F) {
      if (!P.cfg || !P.cfg.feeBps) return '';
      var u = Math.round(Number(F.amount) * 100);
      if (F.buy) return 'The seller pays the P2P fee (' + feePct() + '%). You receive the full amount.';
      if (!(u > 0)) return 'P2P fee: ' + feePct() + '% (minimum ' + ast(P.cfg.minFeeUnits) + ' AST), paid by you on top of the order.';
      var f = feeOf(u);
      return 'P2P fee (' + feePct() + '%): <b style="color:#fff">' + ast(f) + ' AST</b>, paid by you on top. AST locked in escrow: <b style="color:#fff">' + ast(u + f) + ' AST</b>.';
    }
    function readTrade() {
      var F = P.flow; if (!F || F.type !== 'trade') return;
      var g = function (id) { var e = $(id); return e ? e.value.trim() : null; }, v;
      if ((v = g('afpTAmt')) !== null) F.amount = v; if ((v = g('afpTName')) !== null) F.name = v; if ((v = g('afpTAcc')) !== null) F.account = v;
    }
    function confirmTrade() {
      var F = P.flow; if (!F || F.busy) return; readTrade(); var a = F.ad;
      if (!/^\d{1,9}(\.\d{1,2})?$/.test(F.amount) || !(Number(F.amount) > 0)) { F.error = 'Enter the amount of AST (up to 2 decimals).'; paintTrade(); return; }
      var u = Math.round(Number(F.amount) * 100);
      if (u < a.min || u > a.max) { F.error = 'The amount must be between ' + ast(a.min) + ' and ' + ast(a.max) + ' AST.'; paintTrade(); return; }
      if (!F.buy && (F.name.length < 2 || F.account.length < 3)) { F.error = 'Enter the account where you want to receive the money.'; paintTrade(); return; }
      if (!confirm((F.buy ? 'Buy ' : 'Sell ') + F.amount + ' AST for ' + fiatText(a.currency, u, a.price) + ' ' + a.currency + '?')) return;
      F.busy = true; F.error = ''; paintTrade();
      api('POST', '/wallet/p2p/order', { adId: a.id, amount: F.amount, method: F.method, name: F.name, account: F.account, idem: F.idem }).then(function (j) {
        closeSheet(); openOrder(j.id); if (window.AfrishineWallet && window.AfrishineWallet.refresh) window.AfrishineWallet.refresh();
      }, function (e) { F.busy = false; F.error = errMsg(e); if (P.flow === F) paintTrade(); });
    }

    /* ------------------------------------------------------------------ KYC */
    function startKyc() { P.flow = { type: 'kyc', name: '', doc: 'national_id', front: null, selfie: null, busy: false, error: '' }; paintKyc(); }
    function readKyc() { var F = P.flow, e = $('afpKName'); if (F && F.type === 'kyc' && e) F.name = e.value.trim(); }
    function paintKyc() {
      var F = P.flow; if (!F || F.type !== 'kyc') return;
      var docs = [['national_id', 'National ID'], ['passport', 'Passport'], ['driving_licence', 'Driving licence']];
      setSheet(sheetHead('Verify your identity') + '<div class="afp-warn">Send your documents only here. They are used by Afrishine Hub support to check that you are a real person and are not shown to other members.</div>' +
        '<label class="afp-label">Full name (exactly as on your document)</label><input class="afp-input" id="afpKName" maxlength="80" value="' + esc(F.name) + '">' +
        '<label class="afp-label">Document type</label><div class="afp-chips">' + docs.map(function (d) { return '<button class="' + (F.doc === d[0] ? 'on' : '') + '" data-act="kdoc:' + d[0] + '">' + d[1] + '</button>'; }).join('') + '</div>' +
        '<label class="afp-label">1. Photo of the document (front, clear, all corners visible)</label><input class="afp-input" id="afpKFront" type="file" accept="image/*" style="padding:10px 14px;height:auto"><div class="sm" id="afpKFrontName">' + (F.front ? '\u2714 ' + esc(F.front.name) : '') + '</div>' +
        '<label class="afp-label">2. Selfie holding the document next to your face</label><input class="afp-input" id="afpKSelfie" type="file" accept="image/*" style="padding:10px 14px;height:auto"><div class="sm" id="afpKSelfieName">' + (F.selfie ? '\u2714 ' + esc(F.selfie.name) : '') + '</div>' +
        (F.error ? '<div class="afp-err">' + esc(F.error) + '</div>' : '') + '<button class="afp-gold afp-block" style="margin-top:10px" data-act="kycgo"' + (F.busy ? ' disabled' : '') + '>' + (F.busy ? 'Uploading\u2026' : 'Submit for review') + '</button>');
    }
    function submitKyc() {
      var F = P.flow; if (!F || F.busy) return; readKyc();
      if (F.name.length < 5 || F.name.indexOf(' ') < 0) { F.error = 'Enter your full name (first and last name).'; paintKyc(); return; }
      if (!F.front || !F.selfie) { F.error = 'Please attach both photos.'; paintKyc(); return; }
      F.busy = true; F.error = ''; paintKyc();
      uploadImage(F.front).then(function (a) { return uploadImage(F.selfie).then(function (b) { return [a, b]; }); }).then(function (u) {
        return api('POST', '/wallet/p2p/kyc', { fullName: F.name, docType: F.doc, frontUrl: u[0], selfieUrl: u[1] });
      }).then(function () { closeSheet(); toast('Submitted. We will review your documents soon.'); loadMine(); },
        function (e) { F.busy = false; F.error = errMsg(e); if (P.flow === F) paintKyc(); });
    }

    /* ------------------------------------------------------------------ post advert sheet */
    function startAd() {
      P.flow = { type: 'ad', side: 'sell', cur: 'RWF', price: '', amount: '', min: '', max: '', terms: '', methods: {}, idem: uuid(), busy: false, error: '' };
      paintAd();
    }
    function readAd() {
      var F = P.flow; if (!F || F.type !== 'ad') return;
      var g = function (id) { var e = $(id); return e ? e.value.trim() : null; }, v;
      if ((v = g('afpAPrice')) !== null) F.price = v; if ((v = g('afpAAmt')) !== null) F.amount = v; if ((v = g('afpAMin')) !== null) F.min = v; if ((v = g('afpAMax')) !== null) F.max = v; if ((v = g('afpATerms')) !== null) F.terms = v;
      CUR_METHODS[F.cur].forEach(function (k) { var n = $('afpAN_' + k), c = $('afpAC_' + k); if (n || c) { var m = F.methods[k] || (F.methods[k] = {}); if (n) m.name = n.value.trim(); if (c) m.account = c.value.trim(); } });
    }
    function paintAd() {
      var F = P.flow; if (!F || F.type !== 'ad') return; var sell = F.side === 'sell';
      var html = sheetHead('Post an advert') + '<div class="afp-seg"><button class="sell' + (sell ? ' on' : '') + '" data-act="aside:sell">I sell AST</button><button class="buy' + (!sell ? ' on' : '') + '" data-act="aside:buy">I buy AST</button></div>' +
        '<div class="afp-chips"><button class="' + (F.cur === 'RWF' ? 'on' : '') + '" data-act="acur:RWF">RWF</button><button class="' + (F.cur === 'USDT' ? 'on' : '') + '" data-act="acur:USDT">USDT</button></div>' +
        '<label class="afp-label">Price for 1 AST (' + F.cur + ')</label><input class="afp-input" id="afpAPrice" type="text" inputmode="decimal" value="' + esc(F.price) + '" placeholder="' + (F.cur === 'RWF' ? 'e.g. 1450' : 'e.g. 1.00') + '">' +
        '<label class="afp-label">Total AST' + (sell ? ' (you must have them in your wallet)' : ' you want to buy') + '</label><input class="afp-input" id="afpAAmt" type="text" inputmode="decimal" value="' + esc(F.amount) + '">' +
        '<div class="afp-row"><div class="afp-grow" style="margin-right:8px"><label class="afp-label">Min per order</label><input class="afp-input" id="afpAMin" type="text" inputmode="decimal" value="' + esc(F.min) + '"></div><div class="afp-grow"><label class="afp-label">Max per order</label><input class="afp-input" id="afpAMax" type="text" inputmode="decimal" value="' + esc(F.max) + '"></div></div>' +
        '<label class="afp-label">' + (sell ? 'Where buyers pay you (choose up to 3)' : 'Payment methods you can pay with') + '</label>';
      CUR_METHODS[F.cur].forEach(function (k) {
        var m = F.methods[k], on = !!m && m.on;
        html += '<div class="afp-card" style="padding:8px 12px;margin:6px 0"><button class="afp-ghost" style="min-height:38px;width:100%;text-align:left;' + (on ? 'border-color:#ffb91f;background:#2a1d00' : '') + '" data-act="amethod:' + k + '">' + (on ? '☑ ' : '☐ ') + esc(mname(k)) + '</button>';
        if (on && sell) html += '<input class="afp-input" id="afpAN_' + k + '" maxlength="60" placeholder="Account name" value="' + esc(m.name || '') + '" style="margin-top:6px"><input class="afp-input" id="afpAC_' + k + '" maxlength="80" placeholder="' + (k === 'mtn' || k === 'airtel' ? 'Phone number' : (k === 'bank' ? 'Bank and account number' : 'Wallet address / Pay ID')) + '" value="' + esc(m.account || '') + '" style="margin-top:6px">';
        html += '</div>';
      });
      html += '<label class="afp-label">Terms for the other member (optional)</label><textarea class="afp-input" id="afpATerms" maxlength="300" placeholder="e.g. Pay within 15 minutes. No third-party payments.">' + esc(F.terms) + '</textarea>' +
        '<div class="afp-warn">Your payment details are shown only to the member who opens an order with you. Only verified members can post adverts.' + (P.cfg && P.cfg.feeBps ? ' The seller pays a P2P fee of ' + feePct() + '% (minimum ' + ast(P.cfg.minFeeUnits) + ' AST) on top of each order.' : '') + '</div>' +
        (F.error ? '<div class="afp-err">' + esc(F.error) + '</div>' : '') + '<button class="afp-gold afp-block" data-act="apost"' + (F.busy ? ' disabled' : '') + '>' + (F.busy ? 'Posting…' : 'Post advert') + '</button>';
      setSheet(html);
    }
    function postAd() {
      var F = P.flow; if (!F || F.busy) return; readAd();
      var sell = F.side === 'sell', list = [];
      CUR_METHODS[F.cur].forEach(function (k) { var m = F.methods[k]; if (m && m.on) list.push(sell ? { type: k, name: m.name || '', account: m.account || '' } : { type: k }); });
      if (!(Number(F.price) > 0)) { F.error = 'Enter the price for 1 AST.'; paintAd(); return; }
      if (!(Number(F.amount) > 0) || !(Number(F.min) > 0) || !(Number(F.max) > 0)) { F.error = 'Enter the total, the minimum and the maximum in AST.'; paintAd(); return; }
      if (!list.length) { F.error = 'Choose at least one payment method.'; paintAd(); return; }
      if (sell) for (var i = 0; i < list.length; i++) if (list[i].name.length < 2 || list[i].account.length < 3) { F.error = 'Fill in the account name and number for each method you chose.'; paintAd(); return; }
      F.busy = true; F.error = ''; paintAd();
      api('POST', '/wallet/p2p/ad', { side: F.side, currency: F.cur, price: F.price, amount: F.amount, min: F.min, max: F.max, methods: list, terms: F.terms, idem: F.idem }).then(function () {
        closeSheet(); toast('Advert posted.'); P.mine = null; showTab('ads');
      }, function (e) { F.busy = false; F.error = errMsg(e); if (P.flow === F) paintAd(); });
    }

    /* ------------------------------------------------------------------ order view */
    function stopOrderTimers() { clearInterval(timer); clearInterval(tick); timer = null; tick = null; }
    function openOrder(id) {
      P.view = 'order'; P.order = null; P.msgs = []; P.ordSig = ''; P.orderId = id; render();
      loadOrder();
      stopOrderTimers(); timer = setInterval(function () { if (!$('afpModal')) loadOrder(); }, 6000); tick = setInterval(paintTimer, 1000);
    }
    function loadOrder() {
      var id = P.orderId; if (!id) return;
      api('GET', '/wallet/p2p/order?id=' + encodeURIComponent(id)).then(function (j) {
        if (P.view !== 'order' || P.orderId !== id) return;
        var wasFinal = P.order && ['released', 'cancelled', 'expired', 'refunded'].indexOf(P.order.status) >= 0;
        P.skew = j.now - Date.now(); P.order = j.order; P.msgs = j.messages; P.ratings = j.ratings || { mine: '', theirs: '', theirComment: '' };
        paintOrder(false);
        if (!wasFinal && ['released', 'refunded', 'cancelled', 'expired'].indexOf(j.order.status) >= 0 && window.AfrishineWallet && window.AfrishineWallet.refresh) window.AfrishineWallet.refresh();
      }, function (e) { if (!P.order) { var t = $('afpOTop'); if (t) t.innerHTML = '<div class="afp-err">' + esc(errMsg(e)) + '</div>'; } });
    }
    function orderShell() {
      return '<div id="afpOTop"><div class="afp-empty"><span class="afp-spin"></span>Loading order…</div></div><div class="afp-card"><div class="afp-h2 gold">💬 Chat</div><div class="afp-chat" id="afpOChat"></div>' +
        '<div class="afp-row" style="margin-top:8px"><label class="afp-ghost" style="min-height:44px;line-height:44px;padding:0 14px;margin-right:6px;cursor:pointer">📎<input type="file" id="afpOFile" accept="image/*" style="display:none"></label><input class="afp-input" id="afpOMsg" maxlength="500" placeholder="Write a message" style="flex:1;min-width:0;margin-right:6px"><button class="afp-gold" id="afpOSend" data-act="send" style="padding:0 16px">Send</button></div><div id="afpOMsgErr"></div></div>';
    }
    function remainingMs(o) { return o.expiresAt - (Date.now() + P.skew); }
    function paintTimer() {
      var el = $('afpOTimer'), o = P.order; if (!el || !o) return;
      var ms = remainingMs(o); if (ms <= 0) { el.textContent = '00:00'; return; }
      var s = Math.floor(ms / 1000), m = Math.floor(s / 60); s = s % 60; el.textContent = (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
    }
    function paintOrder(force) {
      var o = P.order, top = $('afpOTop'); if (!top || !o) return;
      var sig = JSON.stringify([o.status, o.proofUrl, o.disputeReason, o.resolution, P.ratings.mine, P.ratings.theirs, P.msgs.length, P.msgs.length ? P.msgs[P.msgs.length - 1].id : '']);
      if (!force && sig === P.ordSig) return; P.ordSig = sig;
      var buyer = o.role === 'buyer', seller = o.role === 'seller', other = buyer ? o.sellerName : o.buyerName;
      var title = { created: buyer ? 'Pay the seller now' : 'Waiting for the buyer to pay', paid: buyer ? 'Waiting for the seller to release' : 'Check your account, then release', disputed: 'Dispute: support is reviewing', released: 'Order completed', cancelled: 'Order cancelled', expired: 'Order expired', refunded: 'AST returned to the seller' }[o.status] || o.status;
      var html = '<div class="afp-card" style="border-color:#8e5bff"><div class="afp-row"><div class="afp-grow"><b style="color:' + (buyer ? '#22d36b' : '#ff6672') + '">' + (buyer ? 'Buy' : (seller ? 'Sell' : 'Order')) + ' AST</b></div><span class="afp-pill ' + esc(o.status) + '">' + esc(statusLabel(o)) + '</span></div><div class="afp-h2" style="margin-top:6px">' + esc(title) + '</div>';
      if (o.status === 'created') html += '<div class="afp-timer" id="afpOTimer">--:--</div><div class="sm" style="text-align:center">Time left to pay</div>';
      html += '<div style="margin-top:8px"><div class="afp-kv"><span>AST amount</span><b>' + ast(o.units) + ' AST</b></div>' + (seller && o.fee ? '<div class="afp-kv"><span>P2P fee (paid by you)</span><b>' + ast(o.fee) + ' AST</b></div><div class="afp-kv"><span>Locked in escrow</span><b>' + ast(o.units + o.fee) + ' AST</b></div>' : '') + '<div class="afp-kv"><span>Price</span><b>' + commas(o.price) + ' ' + esc(o.currency) + '</b></div><div class="afp-kv"><span>' + (buyer ? 'You pay' : 'Buyer pays') + '</span><b style="color:#ffb91f;font-size:17px">' + commas(o.fiat) + ' ' + esc(o.currency) + '</b></div><div class="afp-kv"><span>' + (buyer ? 'Seller' : 'Buyer') + '</span><b>' + esc(other) + '</b></div><div class="afp-kv"><span>Order ID</span><b style="font-size:12px">' + esc(o.id) + '</b></div></div></div>';
      if (o.status === 'created' || o.status === 'paid' || o.status === 'disputed') {
        html += '<div class="afp-card"><div class="afp-h2 gold">' + (buyer ? 'Pay to this account' : 'You will be paid here') + '</div><div class="afp-kv"><span>Method</span><b>' + esc(o.methodName) + '</b></div><div class="afp-kv"><span>Account name</span><b>' + esc(o.payName) + '</b></div><div class="afp-kv"><span>Account / number</span><b>' + esc(o.payAccount) + '</b></div>' +
          '<button class="afp-ghost afp-block" style="margin-top:8px;min-height:40px" data-act="copy:' + esc(o.payAccount) + '">📋 Copy account</button>' + (buyer && o.status === 'created' ? '<div class="afp-warn">Pay <b>' + commas(o.fiat) + ' ' + esc(o.currency) + '</b> only to this account, then press <b>I have paid</b> and upload your screenshot.</div>' : '') + '</div>';
      }
      if (o.proofUrl) html += '<div class="afp-card"><div class="afp-h2 gold">Payment screenshot</div><a href="' + esc(o.proofUrl) + '" target="_blank" rel="noopener"><img class="afp-img" src="' + esc(o.proofUrl) + '" alt="Payment screenshot"></a></div>';
      if (o.disputeReason) html += '<div class="afp-card" style="border-color:#d8303c"><div class="afp-h2">⚠️ Dispute</div><p class="afp-sub" style="margin:0">Opened by the ' + esc(o.disputeBy) + ': ' + esc(o.disputeReason) + '</p>' + (o.resolution ? '<div class="afp-ok">' + esc(o.resolution) + '</div>' : '') + '</div>';
      if (o.status === 'released') html += ratingCard();
      html += '<div class="afp-card" id="afpOActs">';
      if (buyer && o.status === 'created') html += '<button class="afp-green afp-block" data-act="paid">✔ I have paid</button><button class="afp-ghost afp-block" style="margin-top:8px" data-act="cancel">Cancel order</button><p class="sm" style="margin:8px 0 0">Do not cancel if you already paid. Open a dispute instead after marking as paid.</p>';
      else if (seller && (o.status === 'created' || o.status === 'paid')) html += '<button class="afp-green afp-block" data-act="release">🔓 Release AST to buyer</button>' + (o.status === 'paid' ? '<button class="afp-ghost afp-block" style="margin-top:8px" data-act="dispute">Payment not received / problem</button>' : '<p class="sm" style="margin:8px 0 0">The buyer has not marked the payment yet. Release only after the money is in your account.</p>');
      else if (buyer && o.status === 'paid') html += '<p class="afp-sub" style="margin:0 0 8px">The seller was notified. If they do not release, open a dispute.</p><button class="afp-ghost afp-block" data-act="dispute">Open a dispute</button>';
      else if (o.status === 'released') html += '<div class="afp-ok" style="margin:0">' + (buyer ? ast(o.units) + ' AST was added to your wallet.' : 'You released the AST. Thank you!') + '</div>';
      else if (o.status === 'disputed') html += '<p class="afp-sub" style="margin:0">The AST stays locked in escrow. Add your evidence in the chat below. Support will decide.</p>';
      else html += '<p class="afp-sub" style="margin:0">This order is closed.' + (o.status !== 'released' && seller ? ' Your AST is back in your wallet.' : '') + '</p>';
      html += '</div>';
      top.innerHTML = html;
      var chat = $('afpOChat');
      if (chat) {
        var atEnd = chat.scrollHeight - chat.scrollTop - chat.clientHeight < 60 || force;
        chat.innerHTML = P.msgs.length ? P.msgs.map(function (m) {
          var who = m.from === 'system' ? '' : '<small>' + (m.mine ? 'You' : (m.from === 'support' ? 'Support' : (m.from === 'buyer' ? 'Buyer' : 'Seller'))) + '</small>';
          var content = m.kind === 'image' ? '<a href="' + esc(m.body) + '" target="_blank" rel="noopener"><img src="' + esc(m.body) + '" alt="Photo" loading="lazy"></a>' : esc(m.body);
          return '<div class="afp-msg ' + (m.from === 'system' ? 'system' : (m.mine ? 'mine' : (m.from === 'support' ? 'support' : ''))) + '">' + who + content + '</div>';
        }).join('') : '<div class="afp-empty" style="padding:8px">No messages yet.</div>';
        if (atEnd) chat.scrollTop = chat.scrollHeight;
      }
      paintTimer();
    }
    function ratingCard() {
      var r = P.ratings, em = { up: '\ud83d\udc4d', down: '\ud83d\udc4e' };
      if (r.mine) return '<div class="afp-card"><div class="afp-h2 gold">Ratings</div><p class="afp-sub" style="margin:0">You rated this trader ' + em[r.mine] + '.' + (r.theirs ? ' They rated you ' + em[r.theirs] + (r.theirComment ? ': \u201c' + esc(r.theirComment) + '\u201d' : '') + '.' : '') + '</p></div>';
      return '<div class="afp-card"><div class="afp-h2 gold">Rate this trader</div><p class="afp-sub">How was your trade? Your rating helps other members.</p><input class="afp-input" id="afpRCom" maxlength="200" placeholder="Comment (optional)"><div class="afp-row" style="margin-top:8px"><button class="afp-green" style="flex:1;margin-right:8px" data-act="rate:up">\ud83d\udc4d Good</button><button class="afp-red" style="flex:1" data-act="rate:down">\ud83d\udc4e Bad</button></div></div>';
    }
    function pickProof(then) {
      var inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
      inp.onchange = function () { if (inp.files && inp.files[0]) then(inp.files[0]); };
      inp.click();
    }
    function markPaid() {
      var o = P.order; if (!o) return;
      P.flow = { type: 'paid', file: null, previewUrl: '', busy: false, error: '' };
      paintPaid();
    }
    function paintPaid() {
      var F = P.flow, o = P.order; if (!F || F.type !== 'paid') return;
      setSheet(sheetHead('Confirm your payment') + '<div class="afp-warn">Upload a clear screenshot showing the amount <b>' + commas(o.fiat) + ' ' + esc(o.currency) + '</b> sent to <b>' + esc(o.payName) + '</b>. Fake screenshots lead to a permanent ban.</div>' +
        '<input class="afp-input" id="afpPFile" type="file" accept="image/*" style="padding:10px 14px;height:auto">' + (F.previewUrl ? '<img class="afp-img" src="' + esc(F.previewUrl) + '" alt="Preview">' : '') +
        (F.error ? '<div class="afp-err">' + esc(F.error) + '</div>' : '') + '<button class="afp-green afp-block" style="margin-top:10px" data-act="paidgo"' + (F.busy ? ' disabled' : '') + '>' + (F.busy ? 'Uploading…' : 'I have paid') + '</button>');
    }
    function submitPaid() {
      var F = P.flow, o = P.order; if (!F || F.busy || !o) return;
      if (!F.file) { F.error = 'Please attach your payment screenshot.'; paintPaid(); return; }
      F.busy = true; F.error = ''; paintPaid();
      uploadImage(F.file).then(function (url) { return api('POST', '/wallet/p2p/paid', { id: o.id, proofUrl: url }); }).then(function () { closeSheet(); toast('Marked as paid. The seller was notified.'); loadOrder(); },
        function (e) { F.busy = false; F.error = errMsg(e); if (P.flow === F) paintPaid(); });
    }
    function orderAction(path, body, okMsg, btn) {
      if (btn) btn.disabled = true;
      return api('POST', path, body).then(function () { toast(okMsg); loadOrder(); }, function (e) { toast(errMsg(e)); loadOrder(); }).then(function () { if (btn) btn.disabled = false; });
    }
    function sendChat() {
      var inp = $('afpOMsg'), o = P.order; if (!inp || !o) return; var t = inp.value.trim(); if (!t) return;
      var b = $('afpOSend'); if (b) b.disabled = true;
      api('POST', '/wallet/p2p/message', { id: o.id, text: t }).then(function () { inp.value = ''; loadOrder(); }, function (e) { toast(errMsg(e)); }).then(function () { if (b) b.disabled = false; });
    }
    function sendChatImage(file) {
      var o = P.order; if (!o) return; toast('Uploading photo…');
      uploadImage(file).then(function (url) { return api('POST', '/wallet/p2p/message', { id: o.id, imageUrl: url }); }).then(function () { loadOrder(); }, function (e) { toast(errMsg(e)); });
    }

    /* ------------------------------------------------------------------ events */
    function onInput(e) {
      var t = e.target;
      if (t.id === 'afpTAmt' && P.flow && P.flow.type === 'trade') {
        P.flow.amount = t.value.trim(); var a = P.flow.ad, u = Math.round(Number(P.flow.amount) * 100), f = $('afpTFiat');
        if (f) f.textContent = (Number(P.flow.amount) > 0 ? fiatText(a.currency, u, a.price) : '0') + ' ' + a.currency;
        var fe = $('afpTFee'); if (fe) fe.innerHTML = feeText(P.flow);
      } else if (t.id === 'afpAmt') P.amount = t.value.trim();
      else if (t.id === 'afpPFile' && P.flow && P.flow.type === 'paid' && t.files && t.files[0]) {
        if (P.flow.previewUrl) { try { URL.revokeObjectURL(P.flow.previewUrl); } catch (_) { } }
        P.flow.file = t.files[0]; P.flow.previewUrl = URL.createObjectURL(t.files[0]); P.flow.error = ''; paintPaid();
      } else if (t.id === 'afpOFile' && t.files && t.files[0]) { sendChatImage(t.files[0]); t.value = ''; }
      else if ((t.id === 'afpKFront' || t.id === 'afpKSelfie') && P.flow && P.flow.type === 'kyc' && t.files && t.files[0]) {
        var isF = t.id === 'afpKFront'; P.flow[isF ? 'front' : 'selfie'] = t.files[0]; var nm = $(isF ? 'afpKFrontName' : 'afpKSelfieName'); if (nm) nm.textContent = '\u2714 ' + t.files[0].name;
      }
    }
    function onClick(e) {
      var navb = e.target.closest && e.target.closest('[data-nav]');
      if (navb) { showTab(navb.getAttribute('data-nav')); return; }
      if (e.target.closest && e.target.closest('#afpBack')) { goBack(); return; }
      var a = e.target.closest && e.target.closest('[data-act]'); if (!a) return;
      var act = a.getAttribute('data-act'), arg = '', i = act.indexOf(':');
      if (i > 0) { arg = act.slice(i + 1); act = act.slice(0, i); }
      switch (act) {
        case 'closesheet': closeSheet(); break;
        case 'side': P.side = arg; P.ads = null; loadAds(); break;
        case 'cur': P.cur = arg; P.method = ''; loadAds(); break;
        case 'meth': P.method = arg; loadAds(); break;
        case 'search': var q = $('afpAmt'); if (q) P.amount = q.value.trim(); if (P.amount && !/^\d{1,9}(\.\d{1,2})?$/.test(P.amount)) { toast('Enter a valid amount.'); break; } loadAds(); break;
        case 'trade': startTrade(arg); break;
        case 'tmeth': if (P.flow) { readTrade(); P.flow.method = arg; paintTrade(); } break;
        case 'tconfirm': confirmTrade(); break;
        case 'scope': P.scope = arg; loadOrders(false); break;
        case 'open': openOrder(arg); break;
        case 'newad': startAd(); break;
        case 'aside': if (P.flow) { readAd(); P.flow.side = arg; paintAd(); } break;
        case 'acur': if (P.flow) { readAd(); P.flow.cur = arg; P.flow.methods = {}; paintAd(); } break;
        case 'amethod': if (P.flow) { readAd(); var m = P.flow.methods[arg] || (P.flow.methods[arg] = {}); var n = 0; for (var k in P.flow.methods) if (P.flow.methods[k].on) n++; if (!m.on && n >= 3) { toast('You can choose up to 3 methods.'); break; } m.on = !m.on; paintAd(); } break;
        case 'apost': postAd(); break;
        case 'adst': var p = arg.split(':'); if (p[2] === undefined && p.length === 2) { a.disabled = true; api('POST', '/wallet/p2p/ad/status', { id: p[0], status: p[1] }).then(function () { loadMine(); }, function (er) { a.disabled = false; toast(errMsg(er)); }); } break;
        case 'paid': markPaid(); break;
        case 'paidgo': submitPaid(); break;
        case 'cancel': if (confirm('Cancel this order? Only cancel if you have NOT paid.')) orderAction('/wallet/p2p/cancel', { id: P.order.id }, 'Order cancelled.', a); break;
        case 'release': if (confirm('Release ' + ast(P.order.units) + ' AST to the buyer?\n\nOnly continue if the money is already in YOUR account. A screenshot is not proof of payment. This cannot be undone.')) orderAction('/wallet/p2p/release', { id: P.order.id }, 'AST released to the buyer.', a); break;
        case 'dispute': var why = prompt('Explain the problem (for example: "I paid but the seller did not release" or "I did not receive the money"):'); if (why && why.trim().length >= 5) orderAction('/wallet/p2p/dispute', { id: P.order.id, reason: why.trim() }, 'Dispute opened. Support will review it.', a); else if (why !== null) toast('Please write at least 5 characters.'); break;
        case 'copy': copyText(arg).then(function (ok) { toast(ok ? 'Copied' : 'Could not copy. Press and hold to copy.'); }); break;
        case 'send': sendChat(); break;
        case 'rate': var rc = $('afpRCom'); a.disabled = true; api('POST', '/wallet/p2p/rate', { id: P.order.id, score: arg, comment: rc ? rc.value.trim() : '' }).then(function () { toast('Thank you for your rating.'); loadOrder(); }, function (er) { a.disabled = false; toast(errMsg(er)); }); break;
        case 'kycstart': startKyc(); break;
        case 'kdoc': if (P.flow && P.flow.type === 'kyc') { readKyc(); P.flow.doc = arg; paintKyc(); } break;
        case 'kycgo': submitKyc(); break;
      }
    }
    function goBack() {
      if ($('afpModal')) { closeSheet(); return; }
      if (P.view === 'order') { stopOrderTimers(); P.view = 'main'; P.order = null; P.orderId = ''; render(); if (P.tab === 'orders') loadOrders(false); else if (P.tab === 'market') loadAds(); else loadMine(); return; }
      closeP2P();
    }

    /* ------------------------------------------------------------------ terms gate, open, close */
    function termsOk() { try { return window.localStorage.getItem('afp_terms_v1') === '1'; } catch (_) { return false; } }
    function showTerms() {
      openSheet(sheetHead('P2P Trading rules') + '<div class="afp-warn"><ul><li>The seller’s AST is held in <b>escrow</b> and released only when the seller confirms, or when support decides a dispute.</li><li><b>Never release AST before the money is in your own account.</b> Screenshots can be fake.</li><li>Pay only to the account shown in the order, within the time limit, and only from an account in your own name.</li><li>The seller pays a small P2P fee on every order. It is added on top of the amount, so the buyer always receives the full amount.</li><li>Keep all communication inside the order chat. Afrishine Hub will never ask for your password.</li><li>Fake payments, false disputes and scams lead to a permanent ban.</li><li>Afrishine Hub does not handle the RWF / USDT payment. It is sent directly between members. Follow the laws of your country.</li></ul></div><button class="afp-gold afp-block" data-act="terms">I understand and agree</button>');
      var b = $('afpSheet'); if (b) b.addEventListener('click', function (e) { var t = e.target.closest && e.target.closest('[data-act="terms"]'); if (t) { try { window.localStorage.setItem('afp_terms_v1', '1'); } catch (_) { } closeSheet(); } });
    }
    function openP2P(orderId) {
      build();
      P.open = true; root.classList.add('on'); P.view = 'main'; P.tab = 'market';
      loadCfg().then(function () { if (P.view === 'main' && P.tab === 'market') render(); }, function () { });
      if (orderId) openOrder(orderId); else { render(); loadAds(); }
      if (!termsOk()) showTerms();
    }
    function closeP2P() {
      if (!P.open) return; P.open = false; stopOrderTimers(); closeSheet(); if (root) root.classList.remove('on');
      if (window.AfrishineWallet && window.AfrishineWallet.refresh) window.AfrishineWallet.refresh();
    }
    setInterval(function () { if (P.open && P.view === 'main' && P.tab === 'orders' && !$('afpModal')) loadOrders(true); }, 15000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden && P.open && P.view === 'order') loadOrder(); });

    window.AfrishineP2P = { open: openP2P, openOrder: function (id) { openP2P(id); }, close: closeP2P };
  } catch (err) { console.warn('Afrishine P2P not started:', err); }
})();
