/* =============================================================================
   AFRISHINE WALLET (AST)  -  afrishine-wallet.js
   Put this file in the ROOT of Afrishine Hub (next to index.html) and add ONE line at the end
   of index.html, after the other scripts:

       <script src="/afrishine-wallet.js"></script>

   It opens the full Wallet dashboard whenever the "wallet" page opens (My Wallet menu item,
   "Open My Wallet" button, #wallet link). It does not edit any other file or script.
   All money is handled by the Afrishine Worker (/wallet/*). This file never changes a balance.
   Written for Android 8+ (Chrome/WebView 58+): no optional chaining, no flex gap, no object spread.
   ============================================================================= */
(function () {
  'use strict';
  if (window.__afWalletLoaded) return;
  window.__afWalletLoaded = true;
  try {
    var WORKER = 'https://afrishine-media.usherluckyelie.workers.dev';
    var page = document.getElementById('wallet');
    if (!page) return;

    /* ------------------------------------------------------------------ utils */
    var $ = function (id) { return document.getElementById(id); };
    function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function me() {
      try { if (typeof currentFirebaseUser !== 'undefined' && currentFirebaseUser) return currentFirebaseUser; } catch (_) { }
      try { if (typeof auth !== 'undefined' && auth && auth.currentUser) return auth.currentUser; } catch (_) { }
      return null;
    }
    function fdb() { try { return (typeof db !== 'undefined') ? db : null; } catch (_) { return null; } }
    function units(n) { return (Number(n) || 0) / 100; }
    function fmt(n) {
      var v = units(n), neg = v < 0, s = Math.abs(v).toFixed(2).split('.');
      s[0] = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      return (neg ? '-' : '') + s.join('.');
    }
    function fmtSigned(n) { return (n > 0 ? '+' : n < 0 ? '-' : '') + fmt(Math.abs(n)); }
    function fmtDate(ms) {
      var d = new Date(Number(ms) || 0);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' \u2022 ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
    function uuid() {
      var a = new Uint8Array(12), s = '';
      try { (window.crypto || window.msCrypto).getRandomValues(a); } catch (_) { for (var i = 0; i < 12; i++) a[i] = Math.floor(Math.random() * 256); }
      for (var j = 0; j < a.length; j++) s += ('0' + a[j].toString(16)).slice(-2);
      return s;
    }
    function ucfirst(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }
    function validAmount(s) { return /^\d{1,9}(\.\d{1,2})?$/.test(String(s || '').trim()) && Number(s) > 0; }
    function cleanName(raw) { raw = String(raw || '').trim(); if (raw.indexOf('@') > 0) raw = raw.split('@')[0]; return raw.slice(0, 40) || 'Afrishine Member'; }

    function appCheckHeader() {
      try {
        if (typeof firebase !== 'undefined' && typeof firebase.appCheck === 'function') {
          return firebase.appCheck().getToken().then(function (t) { return { 'X-Firebase-AppCheck': t.token }; }).catch(function () { return {}; });
        }
      } catch (_) { }
      return Promise.resolve({});
    }
    function api(method, path, body) {
      var u = me();
      if (!u) return Promise.reject({ message: 'Please sign in to use your wallet.', code: 'LOGIN_REQUIRED' });
      return Promise.all([u.getIdToken(), appCheckHeader()]).then(function (r) {
        var headers = Object.assign({ Authorization: 'Bearer ' + r[0] }, r[1]);
        var opts = { method: method, headers: headers };
        if (body !== undefined) { headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
        return fetch(WORKER + path, opts);
      }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (j) {
          if (!res.ok || j.success === false) {
            var msg = j.message || j.error || (res.status === 404 ? 'The wallet service is not available yet. Please try again later.' : 'Something went wrong. Please try again.');
            throw { message: msg, code: j.code || ('HTTP_' + res.status), status: res.status };
          }
          return j;
        });
      }, function (e) {
        if (e && e.message && e.code) throw e;
        throw { message: 'No connection. Please check your internet and try again.', code: 'NETWORK' };
      });
    }
    function errMsg(e) { return (e && e.message) || 'Something went wrong. Please try again.'; }

    /* profiles (name / photo / badge) */
    var profiles = {};
    function getProfile(uid) {
      var c = profiles[uid];
      if (c && Date.now() - c.t < 5 * 60 * 1000) return Promise.resolve(c.d);
      var d = fdb();
      if (!d || !uid) return Promise.resolve({});
      return d.collection('publicProfiles').doc(uid).get().then(function (s) {
        var v = s.exists ? s.data() : {};
        profiles[uid] = { t: Date.now(), d: v };
        return v;
      }).catch(function () { return {}; });
    }
    var SEAL = (function () {
      var pts = [];
      for (var i = 0; i < 96; i++) { var a = i * Math.PI * 2 / 96, r = 9.4 + 1.3 * Math.cos(8 * a); pts.push((12 + r * Math.cos(a)).toFixed(2) + ' ' + (12 + r * Math.sin(a)).toFixed(2)); }
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M' + pts.join(' L') + ' Z" fill="#1d9bf0"/><path d="M7.4 12.3l3.1 3.1 6-6.6" fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    })();
    function badge(p) { return p && p.verified === true ? '<span class="afw-vb" title="Verified">' + SEAL + '</span>' : ''; }
    function avatar(p, name, cls) {
      var photo = p && /^https:\/\//.test(p.photoURL || '') ? '<img src="' + esc(p.photoURL) + '" alt="" referrerpolicy="no-referrer" onerror="this.style.display=\'none\'">' : '';
      return '<span class="afw-av ' + (cls || '') + '"><span>' + esc((name || 'A').charAt(0).toUpperCase()) + '</span>' + photo + '</span>';
    }

    /* ------------------------------------------------------------------ styles */
    var css = [
      '.afw{position:fixed;left:0;right:0;top:0;bottom:0;z-index:10000;display:none;flex-direction:column;background:#07031a;background:linear-gradient(180deg,#0a0420 0%,#120733 60%,#0a0420 100%);color:#fff;font-family:Roboto,system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-tap-highlight-color:transparent}',
      '.afw.on{display:flex}',
      '.afw *{box-sizing:border-box}',
      '.afw button{font-family:inherit;cursor:pointer;color:inherit}',
      '.afw-head{display:flex;align-items:center;padding:calc(10px + env(safe-area-inset-top,0px)) 14px 8px;flex-shrink:0}',
      '.afw-back{width:40px;height:40px;border:0;background:none;color:#8e7cff;font-size:30px;line-height:1;margin-right:4px}',
      '.afw-logo{font-style:italic;font-weight:900;font-size:30px;color:#ffb91f;margin-right:10px;letter-spacing:-1px}',
      '.afw-title{flex:1;min-width:0}',
      '.afw-title b{display:block;font-size:22px;line-height:1.1}',
      '.afw-title b i{font-style:normal;color:#ffb91f}',
      '.afw-title small{display:block;color:#c8b9ff;font-size:13px;font-style:italic;margin-top:2px}',
      '.afw-me{position:relative;width:44px;height:44px;margin-left:8px;flex-shrink:0}',
      '.afw-me .afw-vb{position:absolute;right:-3px;bottom:-3px;width:18px;height:18px;margin:0}',
      '.afw-body{flex:1;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding:6px 12px 16px}',
      '.afw-wrap{max-width:560px;margin:0 auto}',
      '.afw-nav{display:flex;flex-shrink:0;align-items:flex-end;background:#0c0624;border-top:1px solid #3a2a8a;padding:6px 4px calc(6px + env(safe-area-inset-bottom,0px))}',
      '.afw-nav button{flex:1;border:0;background:none;color:#a99be0;font-size:12.5px;font-weight:700;padding:6px 0 4px;min-height:52px}',
      '.afw-nav button span{display:block;font-size:24px;line-height:1.1}',
      '.afw-nav button.on{color:#ffb91f;box-shadow:inset 0 -3px 0 #ffb91f}',
      '.afw-nav .afw-ast{flex:0 0 74px;margin-top:-22px;box-shadow:none!important}',
      '.afw-ast i{display:block;width:62px;height:62px;margin:0 auto;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff2a8,#ffb91f 55%,#b7740a);border:3px solid #ffe08a;color:#3a2300;font:900 18px/56px Roboto,sans-serif;font-style:normal;box-shadow:0 0 18px #ffb91f99}',
      /* cards */
      '.afw-card{border:1px solid #4a35b8;border-radius:18px;background:linear-gradient(135deg,#1b0f4f,#120a33);padding:12px 14px;margin:0 0 10px}',
      '.afw-balance{position:relative;border:2px solid #ffb91f;border-radius:22px;background:linear-gradient(135deg,#3a1a8f 0%,#1a0b4f 55%,#4a2a00 130%);padding:14px;margin:0 0 12px;box-shadow:0 0 22px #ffb91f44;overflow:hidden}',
      '.afw-balrow{display:flex;align-items:center}',
      '.afw-coin{flex:0 0 84px;width:84px;height:84px;margin-right:12px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff2a8,#ffb91f 55%,#b7740a);border:4px solid #ffe08a;color:#3a2300;font:900 26px/76px Roboto,sans-serif;text-align:center;box-shadow:0 0 26px #ffb91f99}',
      '.afw-balmain{flex:1;min-width:0}',
      '.afw-baltitle{color:#ffb91f;font-weight:800;font-size:16px}',
      '.afw-balnum{font-size:36px;font-weight:900;line-height:1.15;word-break:break-all}',
      '.afw-balnum small{font-size:22px;color:#ffb91f;margin-left:4px}',
      '.afw-usd{color:#e4dcff;font-size:14px}',
      '.afw-last7{margin-top:8px;display:inline-block;padding:6px 10px;border-radius:12px;background:#ffffff14;font-size:13px;color:#cfc5f5}',
      '.afw-last7 b{color:#22d36b;font-size:15px}.afw-last7 b.neg{color:#ff4d5a}',
      '.afw-secure{margin-top:10px;padding:7px 12px;border:1px solid #5b3fd0;border-radius:18px;background:#2a1a7a;text-align:center;font-size:13.5px;color:#e8e0ff}',
      /* grids and buttons */
      '.afw-grid{display:grid;grid-template-columns:1fr 1fr 1fr;grid-gap:8px;gap:8px;margin:0 0 12px}',
      '.afw-svc{border:1px solid #4a35b8;border-radius:16px;background:linear-gradient(160deg,#1c1060,#100838);padding:12px 6px 10px;text-align:center;min-height:98px}',
      '.afw-svc.gold{border-color:#ffb91f;background:linear-gradient(160deg,#4a3000,#1c1060)}',
      '.afw-svc span{display:block;font-size:30px;line-height:1.2}',
      '.afw-svc b{display:block;font-size:14.5px;line-height:1.15;margin-top:4px}',
      '.afw-svc small{display:block;font-size:12px;color:#c8b9ff;margin-top:2px}',
      '.afw-gold{border:0;border-radius:24px;background:linear-gradient(180deg,#ffd54a,#f2a100);color:#2a1700!important;font-weight:900;font-size:16px;padding:0 20px;min-height:46px}',
      '.afw-gold:disabled,.afw-ghost:disabled,.afw-red:disabled{opacity:.55}',
      '.afw-ghost{border:1px solid #5b3fd0;border-radius:24px;background:#241470;color:#fff;font-weight:800;font-size:15px;padding:0 18px;min-height:46px}',
      '.afw-red{border:0;border-radius:24px;background:#d8303c;color:#fff;font-weight:800;font-size:15px;padding:0 18px;min-height:42px}',
      '.afw-green{border:0;border-radius:24px;background:#1f9d55;color:#fff;font-weight:800;font-size:15px;padding:0 18px;min-height:42px}',
      '.afw-block{display:block;width:100%}',
      '.afw-h2{font-size:21px;font-weight:900;margin:0 0 4px;color:#fff}',
      '.afw-h2.gold{color:#ffb91f}',
      '.afw-sub{color:#cfc5f5;font-size:14px;line-height:1.45;margin:0 0 8px}',
      '.afw-row{display:flex;align-items:center}',
      '.afw-chips{display:flex;margin:6px 0 4px}',
      '.afw-chip{flex:1;margin-right:8px;border:1px solid #4a35b8;border-radius:16px;background:#12093a;padding:12px 6px;font-weight:800;font-size:16px;text-align:center;min-height:50px}',
      '.afw-chip:last-child{margin-right:0}',
      '.afw-chip.on{border-color:#ffb91f;background:linear-gradient(180deg,#ffd54a,#e69a00);color:#2a1700}',
      '.afw-input{width:100%;min-height:46px;padding:0 14px;border-radius:14px;border:1px solid #4a35b8;background:#f1edff;color:#1a1040;font-size:16px;outline:0}',
      'textarea.afw-input{padding:10px 14px;min-height:76px;resize:vertical;font-family:inherit}',
      '.afw-input:disabled,.afw-input[readonly]{background:#d9d3f0;color:#3b3270}',
      '.afw-label{display:block;margin:10px 0 4px;font-size:13.5px;font-weight:700;color:#e4dcff}',
      '.afw-err{margin:8px 0 0;padding:9px 12px;border-radius:12px;background:#4a1020;border:1px solid #d8303c;color:#ffd0d4;font-size:14px}',
      '.afw-ok{margin:8px 0 0;padding:9px 12px;border-radius:12px;background:#0f3a24;border:1px solid #1f9d55;color:#c9f5da;font-size:14px}',
      '.afw-warn{margin:8px 0;padding:10px 12px;border:1px solid #ffb91f;border-radius:14px;background:#2a1d00;color:#ffe9b0;font-size:14px;line-height:1.5}',
      '.afw-warn ol{margin:4px 0 0 18px;padding:0}',
      /* history */
      '.afw-tx{display:flex;align-items:center;padding:9px 0;border-bottom:1px solid #2c1f6e}',
      '.afw-tx:last-child{border-bottom:0}',
      '.afw-txic{flex:0 0 42px;width:42px;height:42px;margin-right:12px;border-radius:50%;display:grid;place-items:center;font-size:20px;background:#3b2a8f}',
      '.afw-txic.in{background:#16a34a}.afw-txic.out{background:#8b3dff}.afw-txic.svc{background:#2563eb}',
      '.afw-txm{flex:1;min-width:0}',
      '.afw-txm b{display:block;font-size:16px}',
      '.afw-txm small{display:block;color:#bfb2f0;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.afw-txa{text-align:right;flex-shrink:0;margin-left:8px}',
      '.afw-txa b{display:block;font-size:16px}',
      '.afw-txa small{display:block;color:#bfb2f0;font-size:11.5px}',
      '.afw-pos{color:#22d36b}.afw-neg{color:#ff6672}',
      '.afw-stats{display:grid;grid-template-columns:1fr 1fr 1fr;grid-gap:8px;gap:8px;margin:0 0 10px}',
      '.afw-stat{border:1px solid #4a35b8;border-radius:16px;background:#150b40;padding:10px 8px}',
      '.afw-stat small{display:block;color:#cfc5f5;font-size:12.5px}',
      '.afw-stat b{display:block;font-size:22px;color:#ffb91f;margin:2px 0}',
      '.afw-stat em{display:block;font-style:normal;font-size:12.5px;color:#fff;font-weight:700}',
      /* avatars */
      '.afw-av{position:relative;display:inline-grid;place-items:center;width:46px;height:46px;border-radius:50%;overflow:hidden;background:linear-gradient(145deg,#5b2de0,#2a3a8f);border:2px solid #6b57d8;font-weight:800;font-size:18px;flex-shrink:0;margin-right:12px;vertical-align:middle}',
      '.afw-av img{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover}',
      '.afw-av.lg{width:56px;height:56px}.afw-av.me{width:44px;height:44px;margin:0}',
      '.afw-vb{display:inline-block;width:16px;height:16px;margin-left:5px;vertical-align:-3px;line-height:0}',
      '.afw-vb svg{display:block;width:100%;height:100%}',
      '.afw-member{display:flex;align-items:center;padding:10px;border:1px solid #4a35b8;border-radius:16px;background:#150b40;margin:8px 0}',
      '.afw-member .m{flex:1;min-width:0}.afw-member .m b{display:block;font-size:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.afw-member .m small{color:#bfb2f0;font-size:12.5px}',
      /* top-up */
      '.afw-qr{flex:0 0 160px;width:160px;height:160px;margin-right:12px;background:#fff;border-radius:12px;padding:8px;display:grid;place-items:center;overflow:hidden}',
      '.afw-qr img,.afw-qr canvas{max-width:100%;max-height:100%}',
      '.afw-addr{flex:1;min-width:0;border:1px solid #5b3fd0;border-radius:14px;background:#1b1060;padding:10px}',
      '.afw-addr small{display:block;color:#bfb2f0;font-size:12.5px}',
      '.afw-addr code{display:block;font-size:14px;font-weight:700;word-break:break-all;margin:4px 0 8px;color:#fff;font-family:inherit}',
      '.afw-steps{display:flex;margin:10px 0 2px}',
      '.afw-steps div{flex:1;text-align:center;font-size:12.5px;color:#cfc5f5}',
      '.afw-steps b{display:block;color:#fff;font-size:14px;margin:6px 0 2px}',
      '.afw-steps i{display:inline-block;width:26px;height:26px;line-height:26px;border-radius:50%;background:#5b2de0;font-style:normal;font-weight:800;color:#fff}',
      '.afw-pill{display:inline-block;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:800;background:#3b2a8f}',
      '.afw-pill.pending{background:#7a5a00;color:#ffe08a}.afw-pill.approved{background:#14632f;color:#c9f5da}.afw-pill.rejected{background:#7a1a24;color:#ffd0d4}',
      /* modal */
      '.afw-modal{position:absolute;left:0;right:0;top:0;bottom:0;z-index:5;background:rgba(5,2,18,.82);display:flex;align-items:flex-end;justify-content:center}',
      '.afw-sheet{width:100%;max-width:560px;max-height:92%;overflow-y:auto;-webkit-overflow-scrolling:touch;background:linear-gradient(180deg,#1b0f4f,#0f0830);border:1px solid #5b3fd0;border-bottom:0;border-radius:24px 24px 0 0;padding:16px 16px calc(18px + env(safe-area-inset-bottom,0px))}',
      '.afw-sheet h3{margin:0 0 6px;font-size:21px}',
      '.afw-x{float:right;width:36px;height:36px;border-radius:50%;border:1px solid #4a35b8;background:#1b1060;font-size:18px}',
      '.afw-amts{display:flex;flex-wrap:wrap;margin:8px -4px 0}',
      '.afw-amts button{margin:4px;padding:0 16px;min-height:40px;border-radius:20px;border:1px solid #5b3fd0;background:#241470;font-weight:800;font-size:15px}',
      '.afw-amts button.on{background:#ffb91f;color:#2a1700;border-color:#ffb91f}',
      '.afw-pkg{display:flex;align-items:center;width:100%;text-align:left;margin:6px 0;padding:10px 12px;border:1px solid #4a35b8;border-radius:14px;background:#150b40}',
      '.afw-pkg.on{border-color:#ffb91f;background:#2a1d00}',
      '.afw-pkg b{flex:1}.afw-pkg span{color:#ffb91f;font-weight:900}',
      '.afw-empty{padding:18px 8px;text-align:center;color:#cfc5f5;font-size:14.5px;line-height:1.55}',
      '.afw-bars{display:flex;align-items:flex-end;height:120px;margin:8px 0 2px}',
      '.afw-bar{flex:1;display:flex;align-items:flex-end;justify-content:center;height:100%;margin:0 1px}',
      '.afw-bar i{display:block;width:45%;min-height:2px;border-radius:3px 3px 0 0;margin:0 1px}',
      '.afw-bar i.in{background:#22d36b}.afw-bar i.out{background:#ff6672}',
      '.afw-prog{height:12px;border-radius:6px;background:#2a1a7a;overflow:hidden;margin:8px 0}',
      '.afw-prog i{display:block;height:100%;background:linear-gradient(90deg,#ffb91f,#ffe08a)}',
      '.afw-ladder{display:flex;align-items:center;padding:8px 0;border-bottom:1px solid #2c1f6e;font-size:15px}',
      '.afw-ladder:last-child{border-bottom:0}',
      '.afw-ladder b{flex:1}.afw-ladder small{color:#bfb2f0}',
      '.afw-toast{position:absolute;left:50%;bottom:calc(86px + env(safe-area-inset-bottom,0px));-webkit-transform:translateX(-50%);transform:translateX(-50%);z-index:9;max-width:88%;padding:10px 18px;border-radius:22px;background:#241470;border:1px solid #8e7cff;color:#fff;font-size:14px;font-weight:700;text-align:center}',
      '.afw-img{max-width:100%;max-height:180px;border-radius:12px;margin-top:8px;display:block}',
      '.afw-spin{display:inline-block;width:18px;height:18px;border:3px solid #ffffff44;border-top-color:#ffb91f;border-radius:50%;-webkit-animation:afwspin .8s linear infinite;animation:afwspin .8s linear infinite;vertical-align:-4px;margin-right:8px}',
      '@-webkit-keyframes afwspin{to{-webkit-transform:rotate(360deg)}}@keyframes afwspin{to{transform:rotate(360deg)}}',
      '@media(max-width:380px){.afw-balnum{font-size:30px}.afw-coin{flex-basis:70px;width:70px;height:70px;font:900 22px/62px Roboto,sans-serif}.afw-svc b{font-size:13px}.afw-qr{flex-basis:130px;width:130px;height:130px}}'
    ].join('\n');
    var styleEl = document.createElement('style');
    styleEl.textContent = css;
    document.head.appendChild(styleEl);

    /* ------------------------------------------------------------------ state */
    var S = { open: false, view: 'home', stack: [], sum: null, cfg: null, recent: null, err: '', loading: false, method: 'binance',
      hFilter: '', hItems: [], hMore: false, hLoading: false, topups: null, an: null, gifts: null,
      admin: { tab: 'pending', items: null, pending: 0, circ: 0, err: '' }, flow: null, lastPage: 'home', myProfile: {} };
    var root = null, pollTimer = null, qrLib = null;

    /* ------------------------------------------------------------------ shell */
    function build() {
      if (root) return;
      root = document.createElement('div');
      root.id = 'afWallet';
      root.className = 'afw';
      root.innerHTML = '<div class="afw-head"><button class="afw-back" id="afwBack" aria-label="Back">\u2039</button><span class="afw-logo">AH</span><div class="afw-title"><b>Afrishine <i>Hub</i></b><small>Connect \u2022 Learn \u2022 Earn</small></div><span class="afw-me" id="afwMe"></span></div>' +
        '<div class="afw-body" id="afwBody"></div>' +
        '<div class="afw-nav" id="afwNav"><button data-nav="home"><span>\u2302</span>Home</button><button data-nav="analytics"><span>\u2191</span>Analytics</button><button data-nav="topup" class="afw-ast" aria-label="Top up"><i>AST</i></button><button data-nav="giftcenter"><span>\ud83c\udf81</span>Gift Center</button><button data-nav="settings"><span>\u2699</span>Settings</button></div>';
      document.body.appendChild(root);
      root.addEventListener('click', onClick);
      root.addEventListener('change', onChange);
      root.addEventListener('input', onInput);
    }
    function setView(v, push) {
      if (push !== false && S.view !== v) S.stack.push(S.view);
      S.view = v;
      render();
      var b = $('afwBody'); if (b) b.scrollTop = 0;
      loadFor(v);
    }
    function goBack() {
      if (S.flow) { closeFlow(); return; }
      if (S.stack.length) { S.view = S.stack.pop(); render(); loadFor(S.view); return; }
      closeWallet(true);
    }
    function nav(v) { S.stack = []; S.view = v; render(); var b = $('afwBody'); if (b) b.scrollTop = 0; loadFor(v); }

    function render() {
      if (!root) return;
      var nb = root.querySelectorAll('#afwNav button');
      var main = ['home', 'analytics', 'topup', 'giftcenter', 'settings'];
      Array.prototype.forEach.call(nb, function (b) { b.classList.toggle('on', b.getAttribute('data-nav') === S.view && S.view !== 'topup'); });
      var body = $('afwBody'); if (!body) return;
      var html;
      if (!me()) html = viewSignIn();
      else if (S.err && !S.sum) html = viewError();
      else if (S.view === 'topup') html = viewTopup();
      else if (S.view === 'history') html = viewHistory();
      else if (S.view === 'analytics') html = viewAnalytics();
      else if (S.view === 'giftcenter') html = viewGiftCenter();
      else if (S.view === 'settings') html = viewSettings();
      else if (S.view === 'admin') html = viewAdmin();
      else html = viewHome();
      body.innerHTML = '<div class="afw-wrap">' + html + '</div>';
      paintMe();
      resolvePeers();
      if (S.view === 'topup') drawQR();
      void main;
    }
    function paintMe() {
      var u = me(), el = $('afwMe'); if (!el) return;
      if (!u) { el.innerHTML = ''; return; }
      getProfile(u.uid).then(function (p) {
        S.myProfile = p || {};
        var el2 = $('afwMe'); if (!el2) return;
        el2.innerHTML = avatar(p, cleanName(p.username || u.displayName), 'me') + badge(p);
      });
    }
    function toast(t) {
      if (!root) return;
      var old = $('afwToast'); if (old) old.remove();
      var el = document.createElement('div');
      el.id = 'afwToast'; el.className = 'afw-toast'; el.textContent = t;
      root.appendChild(el);
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 3000);
    }

    /* ------------------------------------------------------------------ data loading */
    function loadSummary() {
      return api('GET', '/wallet/summary').then(function (j) { S.sum = j; S.err = ''; return j; });
    }
    function loadConfig() { return api('GET', '/wallet/config').then(function (j) { S.cfg = j.config; return j.config; }); }
    function loadRecent() { return api('GET', '/wallet/history?limit=3').then(function (j) { S.recent = j.items; return j.items; }); }
    function refreshAll() {
      if (!me()) { render(); return Promise.resolve(); }
      S.loading = true;
      return Promise.all([loadSummary(), loadConfig(), loadRecent()]).then(function () { S.loading = false; S.err = ''; render(); },
        function (e) { S.loading = false; S.err = errMsg(e); render(); });
    }
    function softRefresh() {
      if (!S.open || !me()) return;
      var ae = document.activeElement;
      loadSummary().then(function () {
        if (ae && root.contains(ae) && /INPUT|TEXTAREA|SELECT/.test(ae.tagName)) { paintBalances(); return; }
        if (S.flow) { paintBalances(); return; }
        if (S.view === 'home') loadRecent().then(render, render); else paintBalances();
      }, function () { });
    }
    function paintBalances() {
      if (!S.sum) return;
      Array.prototype.forEach.call(root.querySelectorAll('[data-bal]'), function (el) { el.textContent = fmt(S.sum.balance); });
      Array.prototype.forEach.call(root.querySelectorAll('[data-usd]'), function (el) { el.textContent = fmt(S.sum.balance); });
    }
    function loadFor(v) {
      if (!me()) return;
      if (v === 'history') { S.hItems = []; S.hMore = false; loadHistory(false); }
      else if (v === 'analytics') api('GET', '/wallet/analytics').then(function (j) { S.an = j; if (S.view === 'analytics') render(); }, function (e) { S.an = { error: errMsg(e) }; if (S.view === 'analytics') render(); });
      else if (v === 'giftcenter') api('GET', '/wallet/history?limit=8&filter=gifts').then(function (j) { S.gifts = j.items; if (S.view === 'giftcenter') render(); }, function () { S.gifts = []; });
      else if (v === 'topup') api('GET', '/wallet/topups').then(function (j) { S.topups = j.items; if (S.view === 'topup' && !S.flow) render(); }, function () { S.topups = []; });
      else if (v === 'admin') loadAdmin();
      if (v !== 'home' && !S.sum) refreshAll();
    }
    function loadHistory(more) {
      if (S.hLoading) return;
      S.hLoading = true; render();
      var before = more && S.hItems.length ? S.hItems[S.hItems.length - 1].created_at : 0;
      api('GET', '/wallet/history?limit=20' + (S.hFilter ? '&filter=' + S.hFilter : '') + (before ? '&before=' + before : '')).then(function (j) {
        S.hItems = more ? S.hItems.concat(j.items) : j.items; S.hMore = j.more; S.hLoading = false; if (S.view === 'history') render();
      }, function (e) { S.hLoading = false; S.hErr = errMsg(e); if (S.view === 'history') render(); });
    }
    function loadAdmin() {
      S.admin.items = null; S.admin.err = ''; render();
      api('GET', '/wallet/admin/topups?status=' + S.admin.tab).then(function (j) {
        S.admin.items = j.items; S.admin.pending = j.pending; S.admin.circ = j.circulation; if (S.view === 'admin') render();
      }, function (e) { S.admin.err = errMsg(e); S.admin.items = []; if (S.view === 'admin') render(); });
    }

    /* ------------------------------------------------------------------ views */
    function viewSignIn() {
      return '<div class="afw-card" style="margin-top:20px;text-align:center"><div class="afw-coin" style="margin:6px auto 12px">AST</div><h2 class="afw-h2">Sign in to open your wallet</h2><p class="afw-sub">Your AST balance, gifts and payments are linked to your Afrishine Hub account.</p><button class="afw-gold afw-block" data-act="signin">Sign in / Create account</button></div>';
    }
    function viewError() {
      return '<div class="afw-card" style="margin-top:20px;text-align:center"><h2 class="afw-h2">Wallet unavailable</h2><p class="afw-sub">' + esc(S.err) + '</p><button class="afw-gold afw-block" data-act="retry">Try again</button></div>';
    }
    function balanceCard(withTopBtn) {
      var s = S.sum, bal = s ? fmt(s.balance) : '\u2014', l7 = s ? s.last7 : 0;
      return '<div class="afw-balance"><div class="afw-balrow"><div class="afw-coin">AST</div><div class="afw-balmain"><div class="afw-baltitle">\ud83d\udc5b Your Wallet Balance</div>' +
        '<div class="afw-balnum"><span data-bal>' + bal + '</span> <small>AST</small></div><div class="afw-usd">\u2248 $<span data-usd>' + (s ? fmt(s.balance) : '\u2014') + '</span> USD</div>' +
        (s ? '<div class="afw-last7"><b class="' + (l7 < 0 ? 'neg' : '') + '">' + (l7 >= 0 ? '\u2197 ' : '\u2198 ') + fmtSigned(l7) + ' AST</b> (Last 7 Days)</div>' : '<div class="afw-last7"><span class="afw-spin"></span>Loading\u2026</div>') +
        '</div>' + (withTopBtn ? '<button class="afw-ghost" data-act="topuptop" style="margin-left:8px;flex-shrink:0">\u2197 Top Up Wallet</button>' : '') + '</div>' +
        (withTopBtn ? '' : '<div class="afw-secure">\ud83d\udee1 Your balance is secure in Afrishine Hub</div>') + '</div>';
    }
    function viewHome() {
      var cfg = S.cfg, mNames = cfg ? ['binance', 'okx', 'pidex'].map(function (k) { return cfg.methods[k]; }) : [];
      var html = balanceCard(false);
      html += '<div class="afw-grid">' +
        svc('ads', '\ud83d\udce2', 'Pay For Ads', 'Promote your content') + svc('verification', '\ud83d\udee1\ufe0f', 'Get Verification', 'Get a Blue Badge') + svc('premium', '\ud83d\udc51', 'Subscription Premium', 'Unlock more features') +
        svc('boost', '\ud83d\ude80', 'Boost Service', 'Grow your channel') + svc('gift', '\ud83c\udf81', 'Send AST Gift', 'To a Friend', true) + svc('talent', '\u2b50', 'Talent Gift', 'Support Talent') + '</div>';
      html += '<div class="afw-card" style="border-color:#8e5bff"><div class="afw-row"><div style="flex:1;min-width:0"><div class="afw-h2 gold">Top Up with Binance</div><p class="afw-sub" style="margin:0">Add AST to your wallet using Binance</p></div></div>' +
        '<button class="afw-gold afw-block" data-act="topup:binance" style="margin-top:8px">Top Up with Binance \u203a</button>' +
        '<div class="afw-row" style="margin-top:8px"><span style="color:#cfc5f5;font-size:13px;font-weight:700;margin-right:8px">Also available:</span>' +
        '<button class="afw-ghost" data-act="topup:okx" style="min-height:38px;padding:0 14px;margin-right:6px">OKX</button><button class="afw-ghost" data-act="topup:pidex" style="min-height:38px;padding:0 14px">Pi DEX</button></div></div>';
      html += '<div class="afw-card"><div class="afw-h2 gold">\ud83c\udf81 Send AST Gift</div><p class="afw-sub">Find a member by email or username and send AST.</p>' +
        '<div class="afw-row"><input class="afw-input" id="afwQuick" type="text" placeholder="Email or username" autocomplete="off" autocapitalize="off" style="flex:1;min-width:0;margin-right:8px"><button class="afw-ghost" data-act="quicksearch">\ud83d\udd0d Search</button></div>' +
        '<p class="afw-sub" style="margin:8px 0 0;font-size:12.5px">' + (cfg && cfg.gift.verifiedOnly ? 'Only verified members can receive AST gifts.' : 'Gifts are sent instantly and cannot be reversed.') + '</p></div>';
      html += '<div class="afw-card" style="border-color:#1f9d55"><div class="afw-row"><span style="font-size:30px;margin-right:10px">\ud83e\udd1d</span><div style="flex:1;min-width:0"><div class="afw-h2 gold" style="margin:0">P2P Trading</div><p class="afw-sub" style="margin:0">Buy and sell AST with other members (RWF or USDT)</p></div></div><button class="afw-green afw-block" data-act="p2p" style="margin-top:8px">Open P2P Trading \u203a</button></div>';
      html += historyCard();
      html += statCards();
      void mNames;
      return html;
    }
    function svc(id, icon, title, sub, gold) {
      return '<button class="afw-svc' + (gold ? ' gold' : '') + '" data-act="svc:' + id + '"><span>' + icon + '</span><b>' + esc(title) + '</b><small>' + esc(sub) + '</small></button>';
    }
    function historyCard() {
      var items = S.recent;
      var html = '<div class="afw-card"><div class="afw-row"><div class="afw-h2 gold" style="flex:1;margin:0">\ud83d\udd53 Transaction History</div><button data-act="viewall" style="border:0;background:none;color:#ffb91f;font-weight:800;font-size:14px">View All \u2192</button></div>';
      if (items === null) html += '<div class="afw-empty"><span class="afw-spin"></span>Loading\u2026</div>';
      else if (!items.length) html += '<div class="afw-empty">No transactions yet. Top up your wallet to get started.</div>';
      else html += items.map(txRow).join('');
      return html + '</div>';
    }
    function txInfo(t) {
      var ty = t.type, peer = t.peer ? '<span data-peer="' + esc(t.peer) + '">\u2026</span>' : '';
      var map = {
        topup: ['\u2b06', 'in', 'Top Up', 'Approved by Afrishine Hub'],
        gift_received: ['\ud83c\udf81', 'in', 'Received AST Gift', 'From: ' + peer],
        gift_sent: ['\u2708', 'out', 'Sent AST Gift', 'To: ' + peer],
        talent_received: ['\u2b50', 'in', 'Received Talent Gift', 'From: ' + peer],
        talent_sent: ['\u2b50', 'out', 'Sent Talent Gift', 'To: ' + peer],
        service_verification: ['\ud83d\udee1', 'svc', 'Verification', 'Verified Badge'],
        service_premium: ['\ud83d\udc51', 'svc', 'Subscription Premium', 'Premium subscription'],
        service_ads: ['\ud83d\udce2', 'svc', 'Used for Ads', 'Promoted your content'],
        service_boost: ['\ud83d\ude80', 'svc', 'Boost Service', 'Boosted your content'],
        refund: ['\u21a9', 'in', 'Refund', 'Returned to your wallet'],
        bonus: ['\ud83c\udfc6', 'in', 'Rank Reward', 'Gift level reward'],
        admin_allocation: ['\ud83c\udfe6', 'in', 'AST from Afrishine Hub', 'Added by the administrator'],
        p2p_lock: ['\ud83e\udd1d', 'out', 'P2P Sell (escrow)', 'AST held in escrow'],
        p2p_buy: ['\ud83e\udd1d', 'in', 'P2P Purchase', 'AST bought from a member'],
        p2p_unlock: ['\u21a9', 'in', 'P2P Returned', 'Escrow returned to your wallet']
      };
      return map[ty] || ['\u2022', 'svc', ty, ''];
    }
    function txRow(t) {
      var i = txInfo(t);
      return '<div class="afw-tx"><span class="afw-txic ' + i[1] + '">' + i[0] + '</span><div class="afw-txm"><b>' + esc(i[2]) + '</b><small>' + i[3] + '</small></div>' +
        '<div class="afw-txa"><b class="' + (t.amount >= 0 ? 'afw-pos' : 'afw-neg') + '">' + fmtSigned(t.amount) + ' AST</b><small>' + esc(fmtDate(t.created_at)) + '</small></div></div>';
    }
    function statCards() {
      var s = S.sum; if (!s) return '';
      return '<div class="afw-stats"><div class="afw-stat"><small>\ud83c\udfc6 Your Current Rank</small><b>' + esc(s.rank.name) + '</b><em data-act="giftcenter" style="cursor:pointer">View Rank \u2192</em></div>' +
        '<div class="afw-stat"><small>\u2b50 Total Gifts Sent</small><b>' + s.giftsSent + '</b><em data-act="giftcenter" style="cursor:pointer">View Details \u2192</em></div>' +
        '<div class="afw-stat"><small>\ud83d\udc65 Total Gifts Received</small><b>' + s.giftsReceived + '</b><em data-act="giftcenter" style="cursor:pointer">View Details \u2192</em></div></div>';
    }

    /* top up */
    function methodCfg() { return S.cfg && S.cfg.methods[S.method]; }
    function viewTopup() {
      var cfg = S.cfg, m = methodCfg(), keys = ['binance', 'okx', 'pidex'];
      var html = balanceCard(true) + '<div class="afw-row" style="margin:6px 0 2px"><span style="font-size:30px;margin-right:8px">\u26a1</span><div><div class="afw-h2" style="margin:0">Top Up Your Wallet</div><p class="afw-sub" style="margin:0">Choose a method to add AST to your Afrishine Hub Wallet</p></div></div>';
      if (!cfg) return html + '<div class="afw-empty"><span class="afw-spin"></span>Loading\u2026</div>';
      html += '<div class="afw-chips">' + keys.map(function (k) { var mm = cfg.methods[k]; return '<button class="afw-chip' + (S.method === k ? ' on' : '') + '" data-act="method:' + k + '">' + esc(mm.name) + '</button>'; }).join('') + '</div>';
      html += '<div class="afw-card" style="border-color:#8e5bff"><div class="afw-h2 gold">Top Up with ' + esc(m.name) + '</div>';
      if (!m.enabled || !m.address) {
        html += '<div class="afw-warn">This payment method is not available yet. The wallet address has not been set by the administrator. Please choose another method or try again later.</div></div>';
      } else {
        html += '<p class="afw-sub">Send ' + esc(m.coins.join(' or ')) + ' to the ' + esc(m.name) + ' address below. 1 AST = 1 USDT.</p>' +
          '<div class="afw-row" style="align-items:flex-start"><div class="afw-qr" id="afwQr">' + (m.qrUrl ? '<img src="' + esc(m.qrUrl) + '" alt="QR code">' : '<span class="afw-spin"></span>') + '</div>' +
          '<div class="afw-addr"><small>Afrishine Hub ' + esc(m.name) + ' Address</small><code id="afwAddr">' + esc(m.address) + '</code><button class="afw-gold" data-act="copyaddr" style="min-height:38px;font-size:14px">\ud83d\udccb Copy</button></div></div>' +
          '<p class="afw-sub" style="margin:10px 0 0">\u2705 Network: <b>' + esc(m.network) + '</b></p>' +
          (m.instructions.length ? '<div class="afw-warn">\u26a0\ufe0f <ol>' + m.instructions.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol></div>' : '') +
          '<div class="afw-row" style="margin-top:6px"><button class="afw-gold" data-act="havesent" style="flex:1.4;margin-right:8px">\u2714 I Have Sent</button><button class="afw-ghost" data-act="guide" style="flex:1">\ud83d\udcd6 View Guide</button></div></div>';
      }
      html += '<div class="afw-card"><div class="afw-h2 gold">\ud83d\udd53 Payment Status</div><p class="afw-sub" style="margin:0">After sending, our team will verify your payment and add AST to your wallet.</p>' +
        '<div class="afw-steps"><div><i>1</i><b>Send Payment</b>From ' + esc(m ? m.name : 'exchange') + '</div><div><i>2</i><b>Wait for Verification</b>(Usually 1\u20135 min)</div><div><i>3</i><b>Get Your AST</b>Instantly</div></div></div>';
      html += myTopups();
      html += '<div class="afw-card afw-row"><span style="font-size:28px;margin-right:10px">\ud83c\udfa7</span><div style="flex:1"><b style="font-size:17px;color:#ffb91f">Need Help?</b><div class="afw-sub" style="margin:0">Contact Support for assistance</div></div><button class="afw-ghost" data-act="support">Contact Us \u203a</button></div>';
      return html;
    }
    function myTopups() {
      var t = S.topups; if (!t || !t.length) return '';
      return '<div class="afw-card"><div class="afw-h2 gold">My Top Up Requests</div>' + t.map(function (r) {
        return '<div class="afw-tx"><div class="afw-txm"><b>' + esc(r.coin_amount) + ' ' + esc(r.coin) + ' \u2022 ' + esc((S.cfg && S.cfg.methods[r.method] ? S.cfg.methods[r.method].name : r.method)) + '</b><small>' + esc(fmtDate(r.created_at)) + (r.note ? ' \u2022 ' + esc(r.note) : '') + '</small></div>' +
          '<div class="afw-txa"><span class="afw-pill ' + esc(r.status) + '">' + esc(ucfirst(r.status)) + '</span>' + (r.status === 'approved' ? '<small class="afw-pos">+' + fmt(r.ast_units) + ' AST</small>' : '') + '</div></div>';
      }).join('') + '</div>';
    }
    function drawQR() {
      var m = methodCfg(), box = $('afwQr');
      if (!box || !m || !m.address || m.qrUrl) return;
      function paint() {
        var b = $('afwQr'); if (!b || !window.QRCode) { if (b) b.innerHTML = '<small style="color:#333;text-align:center">QR unavailable.<br>Use the address.</small>'; return; }
        b.innerHTML = '';
        try { new window.QRCode(b, { text: m.address, width: 144, height: 144, correctLevel: window.QRCode.CorrectLevel.M }); }
        catch (_) { b.innerHTML = '<small style="color:#333;text-align:center">QR unavailable.<br>Use the address.</small>'; }
      }
      if (window.QRCode) { paint(); return; }
      if (qrLib === 'failed') { paint(); return; }
      if (qrLib === 'loading') return;
      qrLib = 'loading';
      var sc = document.createElement('script');
      sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
      sc.onload = function () { qrLib = 'ready'; if (S.open && S.view === 'topup') paint(); };
      sc.onerror = function () { qrLib = 'failed'; if (S.open && S.view === 'topup') paint(); };
      document.head.appendChild(sc);
    }

    /* history / analytics / gift center / settings */
    function viewHistory() {
      var f = [['', 'All'], ['topup', 'Top Up'], ['received', 'Received'], ['sent', 'Sent'], ['gifts', 'Gifts'], ['services', 'Services']];
      var html = '<h2 class="afw-h2 gold" style="margin-top:6px">\ud83d\udd53 Transaction History</h2><div class="afw-amts" style="margin:0 -4px 6px">' + f.map(function (x) { return '<button class="' + (S.hFilter === x[0] ? 'on' : '') + '" data-act="hfilter:' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div><div class="afw-card">';
      if (S.hErr && !S.hItems.length) html += '<div class="afw-err">' + esc(S.hErr) + '</div>';
      if (!S.hItems.length && S.hLoading) html += '<div class="afw-empty"><span class="afw-spin"></span>Loading\u2026</div>';
      else if (!S.hItems.length) html += '<div class="afw-empty">No transactions here yet.</div>';
      else html += S.hItems.map(txRow).join('');
      html += '</div>';
      if (S.hMore) html += '<button class="afw-ghost afw-block" data-act="hmore"' + (S.hLoading ? ' disabled' : '') + '>' + (S.hLoading ? 'Loading\u2026' : 'Load more') + '</button>';
      return html;
    }
    function viewAnalytics() {
      var a = S.an, s = S.sum;
      var html = '<h2 class="afw-h2 gold" style="margin-top:6px">\ud83d\udcca Analytics</h2>' + balanceCard(false);
      if (!a) return html + '<div class="afw-empty"><span class="afw-spin"></span>Loading\u2026</div>';
      if (a.error) return html + '<div class="afw-err">' + esc(a.error) + '</div>';
      var cat = {}; a.categories.forEach(function (c) { cat[c.type] = c; });
      var g = function (t) { return cat[t] || { n: 0, total: 0 }; };
      var spent = -(g('service_verification').total + g('service_premium').total + g('service_ads').total + g('service_boost').total);
      html += '<div class="afw-stats"><div class="afw-stat"><small>Total top-ups</small><b>' + fmt(g('topup').total) + '</b><em>' + g('topup').n + ' payments</em></div>' +
        '<div class="afw-stat"><small>Gifts sent</small><b>' + fmt(-(g('gift_sent').total + g('talent_sent').total)) + '</b><em>' + (g('gift_sent').n + g('talent_sent').n) + ' gifts</em></div>' +
        '<div class="afw-stat"><small>Gifts received</small><b>' + fmt(g('gift_received').total + g('talent_received').total) + '</b><em>' + (g('gift_received').n + g('talent_received').n) + ' gifts</em></div></div>';
      var days = [], map = {}; a.daily.forEach(function (d) { map[d.d] = d; });
      var max = 1; for (var i = 13; i >= 0; i--) { var row = map[a.today - i] || { inflow: 0, outflow: 0 }; days.push(row); if (row.inflow > max) max = row.inflow; if (row.outflow > max) max = row.outflow; }
      html += '<div class="afw-card"><div class="afw-h2 gold">Last 14 days</div><p class="afw-sub" style="margin:0"><span class="afw-pos">\u25a0 In</span> &nbsp; <span class="afw-neg">\u25a0 Out</span></p><div class="afw-bars">' +
        days.map(function (d) { return '<div class="afw-bar"><i class="in" style="height:' + Math.round(d.inflow / max * 100) + '%"></i><i class="out" style="height:' + Math.round(d.outflow / max * 100) + '%"></i></div>'; }).join('') + '</div></div>';
      html += '<div class="afw-card"><div class="afw-h2 gold">Spent on services</div>' +
        [['service_ads', '\ud83d\udce2 Ads'], ['service_boost', '\ud83d\ude80 Boost'], ['service_premium', '\ud83d\udc51 Premium'], ['service_verification', '\ud83d\udee1 Verification']].map(function (x) {
          return '<div class="afw-ladder"><b>' + x[1] + '</b><span class="afw-neg">' + fmt(-g(x[0]).total) + ' AST</span></div>';
        }).join('') + '<div class="afw-ladder"><b>Total</b><span class="afw-neg">' + fmt(spent) + ' AST</span></div></div>';
      if (s && s.promotions && s.promotions.length) {
        html += '<div class="afw-card"><div class="afw-h2 gold">Active promotions</div>' + s.promotions.map(function (p) {
          return '<div class="afw-tx"><div class="afw-txm"><b>' + (p.kind === 'ads' ? '\ud83d\udce2 Ad' : '\ud83d\ude80 Boost') + ': ' + esc(p.target_title || p.target_id) + '</b><small>Ends ' + esc(fmtDate(p.ends_at)) + '</small></div></div>';
        }).join('') + '</div>';
      }
      return html;
    }
    function viewGiftCenter() {
      var s = S.sum; if (!s) return '<div class="afw-empty"><span class="afw-spin"></span>Loading\u2026</div>';
      var r = s.rank, sent = s.astSent, nextTxt = '', pct = 100;
      if (r.next) { pct = Math.max(2, Math.min(100, Math.round(sent / r.next.minUnits * 100))); nextTxt = fmt(Math.max(0, r.next.minUnits - sent)) + ' AST more to reach ' + r.next.name; }
      else nextTxt = 'You reached the highest level!';
      var html = '<h2 class="afw-h2 gold" style="margin-top:6px">\ud83c\udf81 Gift Center</h2><div class="afw-card" style="border-color:#ffb91f"><div class="afw-row"><span style="font-size:38px;margin-right:12px">\ud83c\udfc6</span><div><small style="color:#cfc5f5">Your Current Rank</small><div style="font-size:28px;font-weight:900;color:#ffb91f">' + esc(r.name) + '</div><small style="color:#cfc5f5">Level ' + r.level + ' of ' + r.levels + '</small></div></div>' +
        '<div class="afw-prog"><i style="width:' + pct + '%"></i></div><div class="afw-sub" style="margin:0">' + esc(nextTxt) + '</div></div>';
      html += '<div class="afw-stats"><div class="afw-stat"><small>Gifts sent</small><b>' + s.giftsSent + '</b><em>' + fmt(s.astSent) + ' AST</em></div><div class="afw-stat"><small>Gifts received</small><b>' + s.giftsReceived + '</b><em>' + fmt(s.astReceived) + ' AST</em></div><div class="afw-stat"><small>Balance</small><b data-bal>' + fmt(s.balance) + '</b><em>AST</em></div></div>';
      html += '<div class="afw-row" style="margin-bottom:10px"><button class="afw-gold" data-act="svc:gift" style="flex:1;margin-right:8px">\ud83c\udf81 Send a Gift</button><button class="afw-ghost" data-act="svc:talent" style="flex:1">\u2b50 Talent Gift</button></div>';
      html += '<div class="afw-card"><div class="afw-h2 gold">Gift levels</div>' + r.ladder.map(function (l) {
        var reached = sent >= l.minUnits;
        return '<div class="afw-ladder"><span style="margin-right:10px;font-size:18px">' + (reached ? '\u2705' : '\u26aa') + '</span><b>' + esc(l.name) + '</b><small>' + (l.minUnits ? 'from ' + fmt(l.minUnits) + ' AST sent' : 'start') + (l.bonusUnits ? ' \u2022 reward ' + fmt(l.bonusUnits) + ' AST' : '') + '</small></div>';
      }).join('') + '</div>';
      html += '<div class="afw-card"><div class="afw-h2 gold">Recent gifts</div>' + (S.gifts === null ? '<div class="afw-empty"><span class="afw-spin"></span>Loading\u2026</div>' : (!S.gifts.length ? '<div class="afw-empty">No gifts yet.</div>' : S.gifts.map(txRow).join(''))) + '</div>';
      return html;
    }
    function viewSettings() {
      var s = S.sum, u = me(), p = S.myProfile || {};
      var html = '<h2 class="afw-h2 gold" style="margin-top:6px">\u2699 Wallet Settings</h2><div class="afw-card"><div class="afw-row">' + avatar(p, cleanName(p.username || (u && u.displayName)), 'lg') + '<div style="min-width:0"><b style="font-size:18px">' + esc(cleanName(p.username || (u && u.displayName))) + badge(p) + '</b><div class="afw-sub" style="margin:0">' + esc(u && u.email || '') + '</div></div></div></div>';
      if (s) {
        html += '<div class="afw-card"><div class="afw-ladder"><b>\ud83d\udc51 Premium</b><span>' + (s.premium.active ? 'Active until ' + esc(new Date(s.premium.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })) : 'Not active') + '</span></div>' +
          '<div class="afw-ladder"><b>\ud83c\udfc6 Gift rank</b><span>' + esc(s.rank.name) + '</span></div>' +
          '<div class="afw-ladder"><b>\ud83d\udcb0 Balance</b><span><span data-bal>' + fmt(s.balance) + '</span> AST</span></div></div>';
      }
      html += '<button class="afw-ghost afw-block" data-act="viewall" style="margin-bottom:8px">\ud83d\udd53 Transaction History</button>' +
        '<button class="afw-ghost afw-block" data-act="topuptop" style="margin-bottom:8px">\u2b06 Top Up &amp; My Requests</button>';
      if (s && s.admin) html += '<button class="afw-gold afw-block" data-act="admin" style="margin-bottom:8px">\ud83d\udee0 Admin Dashboard' + (S.admin.pending ? ' (' + S.admin.pending + ' pending)' : '') + '</button>';
      html += '<div class="afw-card"><div class="afw-h2 gold">How the wallet works</div><ul class="afw-sub" style="margin:0;padding-left:18px"><li>1 AST = 1 USDT.</li><li>Your balance is kept on the Afrishine Hub server and cannot be changed from your phone.</li><li>AST is added to your wallet only after an administrator approves your payment.</li><li>Gifts are instant and cannot be reversed.</li></ul></div>' +
        '<button class="afw-ghost afw-block" data-act="support" style="margin-bottom:8px">\ud83c\udfa7 Contact Support</button>';
      return html;
    }

    /* ------------------------------------------------------------------ admin */
    function viewAdmin() {
      var A = S.admin, html = '<div class="afw-row" style="margin-top:6px"><h2 class="afw-h2 gold" style="flex:1;margin:0">\ud83d\udee0 Admin Dashboard</h2></div>' +
        '<div class="afw-stats" style="grid-template-columns:1fr 1fr"><div class="afw-stat"><small>Pending requests</small><b>' + A.pending + '</b></div><div class="afw-stat"><small>AST in circulation</small><b>' + fmt(A.circ) + '</b></div></div>' +
        '<div class="afw-amts" style="margin:0 -4px 6px">' + [['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['settings', 'Settings']].map(function (x) { return '<button class="' + (A.tab === x[0] ? 'on' : '') + '" data-act="atab:' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>';
      if (A.tab === 'settings') return html + adminSettings();
      if (A.err) html += '<div class="afw-err">' + esc(A.err) + '</div>';
      if (A.items === null) return html + '<div class="afw-empty"><span class="afw-spin"></span>Loading\u2026</div>';
      if (!A.items.length) return html + '<div class="afw-card afw-empty">No ' + esc(A.tab) + ' requests.</div>';
      return html + A.items.map(function (r) {
        var mname = S.cfg && S.cfg.methods[r.method] ? S.cfg.methods[r.method].name : r.method;
        var pre = r.coin === 'USDT' ? r.coin_amount : '';
        return '<div class="afw-card" data-req="' + esc(r.id) + '"><div class="afw-row"><b style="flex:1;font-size:17px">' + esc(r.username) + '</b><span class="afw-pill ' + esc(r.status) + '">' + esc(ucfirst(r.status)) + '</span></div>' +
          '<div class="afw-sub" style="margin:4px 0">' + esc(r.email) + '<br>' + esc(mname) + ' \u2022 <b>' + esc(r.coin_amount) + ' ' + esc(r.coin) + '</b><br>Account name: <b>' + esc(r.account_name) + '</b><br>Hash: <span style="word-break:break-all">' + esc(r.tx_hash) + '</span><br>' + esc(fmtDate(r.created_at)) + '</div>' +
          '<a href="' + esc(r.screenshot_url) + '" target="_blank" rel="noopener"><img class="afw-img" src="' + esc(r.screenshot_url) + '" alt="Payment screenshot" loading="lazy"></a>' +
          (r.status === 'pending' ? '<label class="afw-label">AST to add</label><input class="afw-input" data-ast type="text" inputmode="decimal" value="' + esc(pre) + '" placeholder="e.g. 25.00"><label class="afw-label">Note (shown to the member if rejected)</label><input class="afw-input" data-note type="text" maxlength="300" placeholder="Optional">' +
            '<div class="afw-row" style="margin-top:10px"><button class="afw-green" data-act="approve" style="flex:1;margin-right:8px">\u2714 Approve</button><button class="afw-red" data-act="reject" style="flex:1">\u2716 Reject</button></div>'
            : '<div class="afw-sub" style="margin:8px 0 0">' + (r.status === 'approved' ? 'Added ' + fmt(r.ast_units) + ' AST' : 'Rejected') + (r.note ? ' \u2022 ' + esc(r.note) : '') + '</div>') + '</div>';
      }).join('');
    }
    function adminSettings() {
      var c = S.cfg; if (!c) return '<div class="afw-empty"><span class="afw-spin"></span>Loading\u2026</div>';
      var pk = function (l) { return l.map(function (p) { return p.id + '|' + p.name + '|' + p.ast + '|' + p.days; }).join('\n'); };
      var html = '<p class="afw-sub">Only these addresses are shown to members. Leave an address empty to hide a method.</p>';
      ['binance', 'okx', 'pidex'].forEach(function (k) {
        var m = c.methods[k];
        html += '<div class="afw-card" data-m="' + k + '"><div class="afw-h2 gold">' + esc(m.name) + '</div>' +
          '<label class="afw-label">Wallet address</label><input class="afw-input" data-f="address" value="' + esc(m.address) + '" autocomplete="off">' +
          '<label class="afw-label">Network text</label><input class="afw-input" data-f="network" value="' + esc(m.network) + '">' +
          '<label class="afw-label">Coins (comma separated)</label><input class="afw-input" data-f="coins" value="' + esc(m.coins.join(', ')) + '">' +
          '<label class="afw-label">QR image URL (optional, https). Empty = QR is made from the address</label><input class="afw-input" data-f="qrUrl" value="' + esc(m.qrUrl) + '">' +
          '<label class="afw-label">Instructions (one per line)</label><textarea class="afw-input" data-f="instructions">' + esc(m.instructions.join('\n')) + '</textarea>' +
          '<label class="afw-label"><input type="checkbox" data-f="enabled"' + (m.enabled !== false ? ' checked' : '') + '> Enabled</label></div>';
      });
      html += '<div class="afw-card" id="afwPrices"><div class="afw-h2 gold">Prices</div>' +
        '<label class="afw-label">Get Verification (AST)</label><input class="afw-input" id="afwcVer" value="' + esc(c.prices.verification) + '" inputmode="decimal">' +
        '<label class="afw-label">Premium price (AST) / days</label><div class="afw-row"><input class="afw-input" id="afwcPrem" value="' + esc(c.prices.premium.ast) + '" inputmode="decimal" style="margin-right:8px"><input class="afw-input" id="afwcPremD" value="' + esc(c.prices.premium.days) + '" inputmode="numeric"></div>' +
        '<label class="afw-label">Ads packages (id|name|AST|days, one per line)</label><textarea class="afw-input" id="afwcAds">' + esc(pk(c.prices.ads)) + '</textarea>' +
        '<label class="afw-label">Boost packages (id|name|AST|days, one per line)</label><textarea class="afw-input" id="afwcBoost">' + esc(pk(c.prices.boost)) + '</textarea></div>';
      html += '<div class="afw-card"><div class="afw-h2 gold">Gifts, ranks &amp; rules</div>' +
        '<label class="afw-label">Minimum / maximum gift (AST)</label><div class="afw-row"><input class="afw-input" id="afwcGmin" value="' + esc(c.gift.min) + '" inputmode="decimal" style="margin-right:8px"><input class="afw-input" id="afwcGmax" value="' + esc(c.gift.max) + '" inputmode="decimal"></div>' +
        '<label class="afw-label"><input type="checkbox" id="afwcGver"' + (c.gift.verifiedOnly ? ' checked' : '') + '> Only verified members can receive gifts</label>' +
        '<label class="afw-label">Ranks (name|minimum AST sent|reward AST, one per line)</label><textarea class="afw-input" id="afwcRanks">' + esc(c.ranks.map(function (r) { return r.name + '|' + r.min + '|' + r.bonus; }).join('\n')) + '</textarea>' +
        '<label class="afw-label">Followers needed to buy Verification (0 = none)</label><input class="afw-input" id="afwcFol" value="' + esc(c.verification.minFollowers) + '" inputmode="numeric">' +
        '<label class="afw-label">Support email</label><input class="afw-input" id="afwcSupMail" value="' + esc(c.support.email) + '">' +
        '<label class="afw-label">Support link (https, e.g. WhatsApp)</label><input class="afw-input" id="afwcSupUrl" value="' + esc(c.support.url) + '"></div>' +
        '<div id="afwcMsg"></div><button class="afw-gold afw-block" data-act="savecfg">Save settings</button>';
      return html;
    }
    function collectConfig() {
      var out = { methods: {}, prices: {}, gift: {}, verification: {}, support: {} };
      Array.prototype.forEach.call(root.querySelectorAll('[data-m]'), function (card) {
        var k = card.getAttribute('data-m'), f = function (n) { return card.querySelector('[data-f="' + n + '"]'); };
        out.methods[k] = { address: f('address').value, network: f('network').value, qrUrl: f('qrUrl').value, enabled: f('enabled').checked,
          coins: f('coins').value.split(',').map(function (x) { return x.trim(); }).filter(Boolean), instructions: f('instructions').value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean) };
      });
      var lines = function (id) { return $(id).value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean); };
      var pk = function (id) { return lines(id).map(function (l) { var p = l.split('|'); return { id: (p[0] || '').trim(), name: (p[1] || '').trim(), ast: Number(p[2]), days: Number(p[3]) }; }); };
      out.prices = { verification: Number($('afwcVer').value), premium: { ast: Number($('afwcPrem').value), days: Number($('afwcPremD').value) }, ads: pk('afwcAds'), boost: pk('afwcBoost') };
      out.ranks = lines('afwcRanks').map(function (l) { var p = l.split('|'); return { name: (p[0] || '').trim(), min: Number(p[1]), bonus: Number(p[2] || 0) }; });
      out.gift = { min: Number($('afwcGmin').value), max: Number($('afwcGmax').value), verifiedOnly: $('afwcGver').checked };
      out.verification = { minFollowers: Number($('afwcFol').value) };
      out.support = { email: $('afwcSupMail').value, url: $('afwcSupUrl').value };
      return out;
    }

    /* ------------------------------------------------------------------ peers */
    function resolvePeers() {
      Array.prototype.forEach.call(root.querySelectorAll('[data-peer]'), function (el) {
        var uid = el.getAttribute('data-peer');
        getProfile(uid).then(function (p) { el.textContent = cleanName(p && p.username); });
      });
    }

    /* ------------------------------------------------------------------ modal flows */
    function openSheet(html) {
      closeSheet();
      var m = document.createElement('div');
      m.className = 'afw-modal'; m.id = 'afwModal';
      m.innerHTML = '<div class="afw-sheet" id="afwSheet">' + html + '</div>';
      root.appendChild(m);
      m.addEventListener('click', function (e) { if (e.target === m) closeFlow(); });
    }
    function closeSheet() { var m = $('afwModal'); if (m) m.remove(); }
    function closeFlow() { S.flow = null; closeSheet(); }
    function sheetHead(t) { return '<button class="afw-x" data-act="closeflow" aria-label="Close">\u2715</button><h3>' + t + '</h3>'; }
    function setSheet(html) { var s = $('afwSheet'); if (s) { s.innerHTML = html; resolvePeers(); } else openSheet(html); }
    function memberRow(m, action) {
      return '<div class="afw-member">' + avatar(m, m.username, '') + '<div class="m"><b>' + esc(cleanName(m.username)) + badge(m) + '</b><small>' + esc(m.location || 'Afrishine Hub member') + '</small></div>' + (action ? '<button class="afw-gold" style="min-height:38px;padding:0 16px;font-size:14px" data-act="pick:' + esc(m.uid) + '">Select</button>' : '') + '</div>';
    }

    /* ---- gift flow (Send AST Gift + Talent Gift) ---- */
    function startGift(kind, query) {
      if (!requireAuth()) return;
      S.flow = { type: 'gift', kind: kind, step: 'search', query: query || '', results: null, member: null, amount: '', videos: null, postId: '', idem: uuid(), busy: false, error: '' };
      paintGift();
      if (query) runSearch();
    }
    function paintGift() {
      var F = S.flow; if (!F || F.type !== 'gift') return;
      var talent = F.kind === 'talent', title = talent ? '\u2b50 Talent Gift' : '\ud83c\udf81 Send AST Gift', html = sheetHead(title), bal = S.sum ? fmt(S.sum.balance) : '\u2014';
      if (F.step === 'search') {
        html += '<p class="afw-sub">' + (talent ? 'Support a talented member. Search by email or username.' : 'Find a member by email or username.') + '</p>' +
          '<div class="afw-row"><input class="afw-input" id="afwFindQ" type="text" placeholder="Email or username" value="' + esc(F.query) + '" autocomplete="off" autocapitalize="off" style="flex:1;min-width:0;margin-right:8px"><button class="afw-ghost" data-act="dosearch"' + (F.busy ? ' disabled' : '') + '>\ud83d\udd0d Search</button></div>';
        if (F.busy) html += '<div class="afw-empty"><span class="afw-spin"></span>Searching\u2026</div>';
        else if (F.results) html += F.results.length ? F.results.map(function (m) { return memberRow(m, true); }).join('') : '<div class="afw-empty">No member found. Check the spelling and try again.</div>';
        if (F.error) html += '<div class="afw-err">' + esc(F.error) + '</div>';
      } else if (F.step === 'amount') {
        html += memberRow(F.member, false) + '<label class="afw-label">Amount (AST) \u2022 Balance: <span data-bal>' + bal + '</span></label>' +
          '<input class="afw-input" id="afwAmt" type="text" inputmode="decimal" placeholder="0.00" value="' + esc(F.amount) + '"><div class="afw-amts">' + ['1', '5', '10', '25', '50'].map(function (a) { return '<button data-act="amt:' + a + '"' + (F.amount === a ? ' class="on"' : '') + '>' + a + '</button>'; }).join('') + '</div>';
        if (talent && F.videos && F.videos.length) {
          html += '<label class="afw-label">Support a video (optional)</label><select class="afw-input" id="afwVid"><option value="">General support</option>' + F.videos.map(function (v) { return '<option value="' + esc(v.id) + '"' + (F.postId === v.id ? ' selected' : '') + '>' + esc(v.title) + '</option>'; }).join('') + '</select>';
        }
        if (F.error) html += '<div class="afw-err">' + esc(F.error) + '</div>';
        html += '<div class="afw-row" style="margin-top:12px"><button class="afw-ghost" data-act="gback" style="margin-right:8px">Back</button><button class="afw-gold" data-act="greview" style="flex:1">Continue</button></div>';
      } else if (F.step === 'confirm') {
        html += '<div class="afw-card" style="margin-top:10px;text-align:center"><p class="afw-sub" style="margin:0">You are about to send</p><div style="font-size:34px;font-weight:900;color:#ffb91f;margin:4px 0">' + esc(Number(F.amount).toFixed(2)) + ' AST</div><p class="afw-sub" style="margin:0">to</p>' + memberRow(F.member, false) + '<p class="afw-sub" style="margin:6px 0 0;font-size:13px">This cannot be undone.</p></div>';
        if (F.error) html += '<div class="afw-err">' + esc(F.error) + '</div>';
        html += '<div class="afw-row" style="margin-top:12px"><button class="afw-ghost" data-act="gedit" style="margin-right:8px"' + (F.busy ? ' disabled' : '') + '>Edit</button><button class="afw-gold" data-act="gsend" style="flex:1"' + (F.busy ? ' disabled' : '') + '>' + (F.busy ? '<span class="afw-spin"></span>Sending\u2026' : 'Confirm &amp; Send Gift') + '</button></div>';
      } else if (F.step === 'done') {
        html += '<div class="afw-card" style="margin-top:10px;text-align:center"><div style="font-size:48px">\ud83c\udf89</div><h3 style="margin:4px 0">Gift sent!</h3><p class="afw-sub">You sent ' + esc(Number(F.amount).toFixed(2)) + ' AST to ' + esc(cleanName(F.member.username)) + '.<br>New balance: <b><span data-bal>' + bal + '</span> AST</b></p></div><button class="afw-gold afw-block" data-act="closeflow" style="margin-top:10px">Done</button>';
      }
      setSheet(html);
      var q = $('afwFindQ'); if (q && !q.__f) { q.__f = 1; q.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); runSearch(); } }); }
    }
    function searchUsername(q) {
      var d = fdb(); if (!d) return Promise.resolve([]);
      var seen = {}, vars = [q, ucfirst(q), q.toLowerCase()].filter(function (v, i, a) { return v && a.indexOf(v) === i; });
      return Promise.all(vars.map(function (v) {
        return d.collection('publicProfiles').where('username', '>=', v).where('username', '<', v + '\uf8ff').limit(8).get().then(function (s) { return s.docs; }).catch(function () { return []; });
      })).then(function (lists) {
        var out = [];
        lists.forEach(function (docs) { docs.forEach(function (x) { if (!seen[x.id]) { seen[x.id] = 1; var v = x.data(); out.push({ uid: x.id, username: v.username, photoURL: v.photoURL, verified: v.verified === true, location: v.location }); } }); });
        return out;
      });
    }
    function runSearch() {
      var F = S.flow; if (!F || F.type !== 'gift') return;
      var inp = $('afwFindQ'); if (inp) F.query = inp.value;
      var q = String(F.query || '').trim();
      if (q.length < 2) { F.error = 'Type at least 2 characters.'; paintGift(); return; }
      F.busy = true; F.error = ''; F.results = null; paintGift();
      var u = me(), p;
      if (q.indexOf('@') > 0) p = api('GET', '/wallet/lookup?email=' + encodeURIComponent(q)).then(function (j) { return [j.member]; }).catch(function (e) { if (e.status === 404) return []; throw e; });
      else p = searchUsername(q);
      p.then(function (list) {
        if (S.flow !== F) return;
        F.results = list.filter(function (m) { return m && m.uid !== (u && u.uid); }); F.busy = false; paintGift();
      }, function (e) { if (S.flow !== F) return; F.busy = false; F.error = errMsg(e); paintGift(); });
    }
    function pickMember(uid) {
      var F = S.flow; if (!F) return;
      var m = (F.results || []).filter(function (x) { return x.uid === uid; })[0]; if (!m) return;
      F.member = m; F.step = 'amount'; F.error = '';
      if (F.kind === 'talent' && fdb()) {
        fdb().collection('posts').where('uid', '==', uid).limit(30).get().then(function (s) {
          F.videos = s.docs.map(function (x) { var v = x.data(); return { id: x.id, type: v.type, vis: v.visibility, title: String(v.title || v.linkTitle || v.text || 'Video').replace(/\s+/g, ' ').slice(0, 50) }; })
            .filter(function (v) { return (v.type === 'video' || v.type === 'link') && v.vis !== 'private'; });
          if (S.flow === F && F.step === 'amount') { readAmount(); paintGift(); }
        }).catch(function () { });
      }
      paintGift();
    }
    function readAmount() { var a = $('afwAmt'); if (a && S.flow) S.flow.amount = a.value.trim(); var v = $('afwVid'); if (v && S.flow) S.flow.postId = v.value; }
    function reviewGift() {
      var F = S.flow; readAmount();
      if (!validAmount(F.amount)) { F.error = 'Enter a valid amount (up to 2 decimals).'; paintGift(); return; }
      var cfg = S.cfg, n = Number(F.amount);
      if (cfg && (n < cfg.gift.min || n > cfg.gift.max)) { F.error = 'Enter an amount between ' + cfg.gift.min + ' and ' + cfg.gift.max + ' AST.'; paintGift(); return; }
      if (S.sum && Math.round(n * 100) > S.sum.balance) { F.error = 'You do not have enough AST. Top up your wallet first.'; paintGift(); return; }
      F.error = ''; F.step = 'confirm'; paintGift();
    }
    function sendGift() {
      var F = S.flow; if (!F || F.busy) return;
      F.busy = true; F.error = ''; paintGift();
      api('POST', '/wallet/gift', { toUid: F.member.uid, amount: Number(F.amount).toFixed(2), kind: F.kind, postId: F.postId || undefined, idem: F.idem }).then(function () {
        F.busy = false; F.step = 'done'; F.idem = uuid();
        return Promise.all([loadSummary(), loadRecent()]).catch(function () { });
      }).then(function () { if (S.flow === F) { paintGift(); } render(); }, function (e) {
        F.busy = false; F.error = errMsg(e); if (S.flow === F) paintGift();
      });
    }

    /* ---- services (verification / premium / ads / boost) ---- */
    function startService(id) {
      if (!requireAuth()) return;
      if (!S.cfg) { toast('Loading\u2026 please try again in a moment.'); refreshAll(); return; }
      S.flow = { type: 'svc', id: id, step: 'form', pkg: '', target: 'profile', posts: null, busy: false, error: '', idem: uuid(), done: null };
      if (id === 'ads' || id === 'boost') {
        var d = fdb(), u = me();
        if (d && u) d.collection('posts').where('uid', '==', u.uid).limit(30).get().then(function (s) {
          var F = S.flow; if (!F || F.id !== id) return;
          F.posts = s.docs.map(function (x) { var v = x.data(); return { id: x.id, vis: v.visibility, title: String(v.title || v.linkTitle || v.text || 'Post').replace(/\s+/g, ' ').slice(0, 60) }; }).filter(function (p) { return p.vis !== 'private'; });
          paintService();
        }).catch(function () { if (S.flow) { S.flow.posts = []; paintService(); } });
        else S.flow.posts = [];
      }
      paintService();
    }
    function priceOf(id, pkg) {
      var p = S.cfg.prices;
      if (id === 'verification') return p.verification;
      if (id === 'premium') return p.premium.ast;
      var x = (p[id] || []).filter(function (k) { return k.id === pkg; })[0]; return x ? x.ast : 0;
    }
    function paintService() {
      var F = S.flow; if (!F || F.type !== 'svc') return;
      var cfg = S.cfg, id = F.id, bal = S.sum ? fmt(S.sum.balance) : '\u2014';
      var titles = { verification: '\ud83d\udee1\ufe0f Get Verification', premium: '\ud83d\udc51 Subscription Premium', ads: '\ud83d\udce2 Pay For Ads', boost: '\ud83d\ude80 Boost Service' };
      var html = sheetHead(titles[id]);
      if (F.step === 'done') {
        var msgs = { verification: 'Your Verified Badge is now active.', premium: 'Your Premium subscription is active.', ads: 'Your ad is now running.', boost: 'Your boost is now running.' };
        return setSheet(html + '<div class="afw-card" style="margin-top:10px;text-align:center"><div style="font-size:48px">\u2705</div><h3 style="margin:4px 0">Payment successful</h3><p class="afw-sub">' + msgs[id] + '<br>New balance: <b><span data-bal>' + bal + '</span> AST</b></p></div><button class="afw-gold afw-block" data-act="closeflow">Done</button>');
      }
      if (id === 'verification') {
        var need = cfg.verification.minFollowers;
        html += '<p class="afw-sub">Get the blue Verified Badge next to your name.</p><div class="afw-card"><div class="afw-ladder"><b>Price</b><span style="color:#ffb91f;font-weight:900">' + esc(cfg.prices.verification) + ' AST</span></div><div class="afw-ladder"><b>Your balance</b><span><span data-bal>' + bal + '</span> AST</span></div>' +
          (need ? '<div class="afw-ladder"><b>Requirement</b><span>' + need + '+ followers</span></div>' : '') + '</div>' +
          (S.myProfile && S.myProfile.verified ? '<div class="afw-ok">Your account is already verified.</div>' : '');
      } else if (id === 'premium') {
        var pr = cfg.prices.premium, prem = S.sum && S.sum.premium;
        html += '<p class="afw-sub">Unlock more features for ' + pr.days + ' days.</p><div class="afw-card"><div class="afw-ladder"><b>Price</b><span style="color:#ffb91f;font-weight:900">' + esc(pr.ast) + ' AST / ' + pr.days + ' days</span></div><div class="afw-ladder"><b>Your balance</b><span><span data-bal>' + bal + '</span> AST</span></div>' +
          (prem && prem.active ? '<div class="afw-ladder"><b>Active until</b><span>' + esc(new Date(prem.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })) + '</span></div>' : '') + '</div>' + (prem && prem.active ? '<p class="afw-sub">Buying again extends your subscription.</p>' : '');
      } else {
        html += '<p class="afw-sub">' + (id === 'ads' ? 'Promote your content to more members.' : 'Grow your channel by boosting your content.') + ' Balance: <b><span data-bal>' + bal + '</span> AST</b></p><label class="afw-label">Choose a package</label>' +
          cfg.prices[id].map(function (k) { return '<button class="afw-pkg' + (F.pkg === k.id ? ' on' : '') + '" data-act="pkg:' + esc(k.id) + '"><b>' + esc(k.name) + ' \u2022 ' + k.days + (k.days === 1 ? ' day' : ' days') + '</b><span>' + esc(k.ast) + ' AST</span></button>'; }).join('') +
          '<label class="afw-label">What do you want to promote?</label><select class="afw-input" id="afwTarget"><option value="profile"' + (F.target === 'profile' ? ' selected' : '') + '>My profile / channel</option>' +
          (F.posts || []).map(function (p) { return '<option value="' + esc(p.id) + '"' + (F.target === p.id ? ' selected' : '') + '>' + esc(p.title) + '</option>'; }).join('') + '</select>' +
          (F.posts === null ? '<p class="afw-sub" style="font-size:12.5px">Loading your posts\u2026</p>' : '');
      }
      if (F.error) html += '<div class="afw-err">' + esc(F.error) + '</div>';
      var price = priceOf(id, F.pkg), canPay = id === 'verification' || id === 'premium' || !!F.pkg;
      if (F.step === 'confirm') {
        html += '<div class="afw-warn">Confirm payment of <b>' + esc(price) + ' AST</b>. It is taken from your wallet right away and the service starts immediately.</div><div class="afw-row"><button class="afw-ghost" data-act="svcback" style="margin-right:8px"' + (F.busy ? ' disabled' : '') + '>Back</button><button class="afw-gold" data-act="svcpay" style="flex:1"' + (F.busy ? ' disabled' : '') + '>' + (F.busy ? '<span class="afw-spin"></span>Processing\u2026' : 'Confirm &amp; Pay ' + esc(price) + ' AST') + '</button></div>';
      } else {
        html += '<button class="afw-gold afw-block" data-act="svcreview" style="margin-top:12px"' + (canPay ? '' : ' disabled') + '>Pay ' + (canPay ? esc(price) + ' AST' : 'with AST') + '</button>';
      }
      setSheet(html);
    }
    function svcReview() {
      var F = S.flow, t = $('afwTarget'); if (t) F.target = t.value;
      var price = priceOf(F.id, F.pkg);
      if (S.sum && Math.round(price * 100) > S.sum.balance) { F.error = 'You do not have enough AST. Top up your wallet first.'; paintService(); return; }
      F.error = ''; F.step = 'confirm'; paintService();
    }
    function svcPay() {
      var F = S.flow; if (!F || F.busy) return;
      F.busy = true; F.error = ''; paintService();
      var body = { service: F.id, idem: F.idem };
      if (F.id === 'ads' || F.id === 'boost') { body.packageId = F.pkg; if (F.target === 'profile') body.targetKind = 'profile'; else { body.targetKind = 'post'; body.targetId = F.target; } }
      api('POST', '/wallet/buy', body).then(function () {
        F.busy = false; F.step = 'done'; F.idem = uuid();
        if (F.id === 'verification') { delete profiles[me().uid]; try { if (typeof window.afProfileSyncRefresh === 'function') window.afProfileSyncRefresh(me().uid); } catch (_) { } paintMe(); }
        return Promise.all([loadSummary(), loadRecent()]).catch(function () { });
      }).then(function () { if (S.flow === F) paintService(); render(); }, function (e) {
        F.busy = false; F.step = 'form'; F.error = errMsg(e);
        loadSummary().catch(function () { }).then(function () { if (S.flow === F) paintService(); });
      });
    }

    /* ---- top-up submission ---- */
    function startTopupForm() {
      if (!requireAuth()) return;
      var m = methodCfg(); if (!m || !m.address) return;
      var u = me(), p = S.myProfile || {};
      S.flow = { type: 'topup', coin: m.coins[0], amount: '', hash: '', account: '', file: null, previewUrl: '', shotUrl: '', busy: false, status: '', error: '', done: false, idem: uuid(), method: S.method,
        username: cleanName(p.username || (u && u.displayName)), email: (u && u.email) || '' };
      paintTopup();
    }
    function paintTopup() {
      var F = S.flow; if (!F || F.type !== 'topup') return;
      var m = S.cfg.methods[F.method];
      if (F.done) { return setSheet(sheetHead('Request submitted') + '<div class="afw-card" style="margin-top:10px;text-align:center"><div style="font-size:48px">\ud83d\udd53</div><h3 style="margin:4px 0">Waiting for verification</h3><p class="afw-sub">Our team will check your payment and add the AST to your wallet. This usually takes 1\u20135 minutes. You will get a notification.</p></div><button class="afw-gold afw-block" data-act="closeflow" style="margin-top:10px">OK</button>'); }
      var html = sheetHead('\u2714 I Have Sent') + '<p class="afw-sub">Tell us about your ' + esc(m.name) + ' payment so an administrator can verify it.</p>' +
        '<label class="afw-label">Coin sent</label><select class="afw-input" id="afwtCoin">' + m.coins.map(function (c) { return '<option' + (F.coin === c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select>' +
        '<label class="afw-label">Amount of coin you sent</label><input class="afw-input" id="afwtAmt" type="text" inputmode="decimal" placeholder="e.g. 25" value="' + esc(F.amount) + '">' +
        '<label class="afw-label">Transaction hash (TxID)</label><input class="afw-input" id="afwtHash" type="text" placeholder="Paste the transaction hash" autocomplete="off" value="' + esc(F.hash) + '">' +
        '<label class="afw-label">Account name you used on ' + esc(m.name) + '</label><input class="afw-input" id="afwtAcc" type="text" maxlength="100" value="' + esc(F.account) + '">' +
        '<label class="afw-label">Payment screenshot</label><input class="afw-input" id="afwtFile" type="file" accept="image/*" style="padding:10px 14px;height:auto">' + (F.previewUrl ? '<img class="afw-img" src="' + esc(F.previewUrl) + '" alt="Screenshot preview">' : '') +
        '<label class="afw-label">Username (automatic)</label><input class="afw-input" value="' + esc(F.username) + '" readonly><label class="afw-label">Email (automatic)</label><input class="afw-input" value="' + esc(F.email) + '" readonly>';
      if (F.error) html += '<div class="afw-err">' + esc(F.error) + '</div>';
      if (F.busy) html += '<div class="afw-sub" style="margin-top:10px"><span class="afw-spin"></span>' + esc(F.status) + '</div>';
      html += '<button class="afw-gold afw-block" data-act="submittopup" style="margin-top:12px"' + (F.busy ? ' disabled' : '') + '>Submit for review</button>';
      setSheet(html);
      var f = $('afwtFile'); if (f) f.addEventListener('change', function () {
        var file = f.files && f.files[0]; if (!file) return;
        readTopup(); F.file = file; F.shotUrl = '';
        if (F.previewUrl) { try { URL.revokeObjectURL(F.previewUrl); } catch (_) { } }
        F.previewUrl = URL.createObjectURL(file); paintTopup();
      });
    }
    function readTopup() {
      var F = S.flow; if (!F || F.type !== 'topup') return;
      var g = function (id) { var e = $(id); return e ? e.value.trim() : null; };
      var v;
      if ((v = g('afwtCoin')) !== null) F.coin = v; if ((v = g('afwtAmt')) !== null) F.amount = v; if ((v = g('afwtHash')) !== null) F.hash = v; if ((v = g('afwtAcc')) !== null) F.account = v;
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
    function uploadShot(blob) {
      var u = me();
      return Promise.all([u.getIdToken(), appCheckHeader()]).then(function (r) {
        return fetch(WORKER + '/upload?filename=payment.jpg', { method: 'POST', headers: Object.assign({ Authorization: 'Bearer ' + r[0], 'Content-Type': 'image/jpeg' }, r[1]), body: blob });
      }, function () { throw { message: 'Please sign in again.' }; }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (j) { if (!res.ok || !j.success || !j.url) throw { message: j.message || 'The screenshot could not be uploaded. Please try again.' }; return j.url; });
      }, function (e) { if (e && e.message) throw e; throw { message: 'No connection. Please check your internet and try again.' }; });
    }
    function submitTopup() {
      var F = S.flow; if (!F || F.busy) return;
      readTopup();
      if (!/^\d{1,9}(\.\d{1,8})?$/.test(F.amount) || !(Number(F.amount) > 0)) { F.error = 'Enter the amount you sent.'; paintTopup(); return; }
      if (!/^[A-Za-z0-9:_.\-]{10,200}$/.test(F.hash)) { F.error = 'Enter a valid transaction hash (at least 10 characters, no spaces).'; paintTopup(); return; }
      if (F.account.length < 2) { F.error = 'Enter the account name you used on the exchange.'; paintTopup(); return; }
      if (!F.file && !F.shotUrl) { F.error = 'Please attach a screenshot of your payment.'; paintTopup(); return; }
      F.busy = true; F.error = ''; F.status = 'Uploading screenshot\u2026'; paintTopup();
      var step = F.shotUrl ? Promise.resolve(F.shotUrl) : compress(F.file).then(uploadShot).then(function (url) { F.shotUrl = url; return url; });
      step.then(function (url) {
        F.status = 'Submitting request\u2026'; paintTopup();
        return api('POST', '/wallet/topup', { method: F.method, coin: F.coin, coinAmount: F.amount, txHash: F.hash, accountName: F.account, screenshotUrl: url, idem: F.idem });
      }).then(function () {
        F.busy = false; F.done = true; if (S.flow === F) paintTopup();
        api('GET', '/wallet/topups').then(function (j) { S.topups = j.items; if (S.view === 'topup') render(); }, function () { });
      }, function (e) { F.busy = false; F.error = (e && e.message) ? e.message : 'The request could not be sent. Please try again.'; if (S.flow === F) paintTopup(); });
    }
    function showGuide() {
      var m = methodCfg();
      openSheet(sheetHead('\ud83d\udcd6 How to top up') + '<ol class="afw-sub" style="padding-left:20px;line-height:1.7"><li>Choose ' + esc(m.name) + ' and copy the wallet address (or scan the QR code).</li><li>Open your ' + esc(m.name) + ' app and send the amount to that address using the network shown: <b>' + esc(m.network) + '</b>.</li><li>Take a screenshot of the completed transaction and copy the transaction hash (TxID).</li><li>Come back here, tap <b>I Have Sent</b> and fill in the form.</li><li>An administrator checks the payment. When approved, your AST is added and appears in your Transaction History.</li></ol><div class="afw-warn">1 AST = 1 USDT. Always check the address and network before sending. Payments sent to the wrong network may be lost.</div><button class="afw-gold afw-block" data-act="closeflow">Got it</button>');
    }

    /* ------------------------------------------------------------------ events */
    function requireAuth() {
      if (me()) return true;
      toast('Please sign in first.');
      return false;
    }
    function copyText(text) {
      function fallback() {
        var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.top = '-1000px'; document.body.appendChild(ta); ta.focus(); ta.select();
        var ok = false; try { ok = document.execCommand('copy'); } catch (_) { } document.body.removeChild(ta); return ok;
      }
      if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return fallback(); });
      return Promise.resolve(fallback());
    }
    function onInput(e) {
      var t = e.target;
      if (S.flow && S.flow.type === 'gift' && t.id === 'afwAmt') { S.flow.amount = t.value.trim(); var on = root.querySelectorAll('.afw-amts button.on'); Array.prototype.forEach.call(on, function (b) { b.classList.remove('on'); }); }
    }
    function onChange(e) {
      var t = e.target;
      if (t.id === 'afwVid' && S.flow) S.flow.postId = t.value;
      if (t.id === 'afwTarget' && S.flow) S.flow.target = t.value;
    }
    function onClick(e) {
      var navb = e.target.closest && e.target.closest('[data-nav]');
      if (navb) { nav(navb.getAttribute('data-nav')); return; }
      if (e.target.closest && e.target.closest('#afwBack')) { goBack(); return; }
      var a = e.target.closest && e.target.closest('[data-act]');
      if (!a) return;
      var act = a.getAttribute('data-act'), arg = '', i = act.indexOf(':');
      if (i > 0) { arg = act.slice(i + 1); act = act.slice(0, i); }
      switch (act) {
        case 'signin': closeWallet(false); if (typeof window.showPage === 'function') window.showPage('profile'); break;
        case 'retry': S.err = ''; refreshAll(); break;
        case 'svc':
          if (arg === 'gift' || arg === 'talent') startGift(arg, '');
          else startService(arg);
          break;
        case 'topup': S.method = arg; setView('topup'); break;
        case 'topuptop': setView('topup'); break;
        case 'method': S.method = arg; render(); break;
        case 'copyaddr': var m = methodCfg(); if (m) copyText(m.address).then(function (ok) { toast(ok ? 'Address copied' : 'Could not copy. Press and hold the address to copy.'); }); break;
        case 'havesent': startTopupForm(); break;
        case 'guide': showGuide(); break;
        case 'submittopup': submitTopup(); break;
        case 'viewall': S.hFilter = ''; setView('history'); break;
        case 'hfilter': S.hFilter = arg; S.hItems = []; S.hMore = false; loadHistory(false); break;
        case 'hmore': loadHistory(true); break;
        case 'giftcenter': setView('giftcenter'); break;
        case 'support': openSupport(); break;
        case 'admin': S.admin.tab = 'pending'; setView('admin'); break;
        case 'atab': S.admin.tab = arg; if (arg === 'settings') { render(); if (!S.cfg) loadConfig().then(render); } else loadAdmin(); break;
        case 'approve': case 'reject': adminDecide(a, act); break;
        case 'savecfg': saveConfig(a); break;
        case 'quicksearch': var q = $('afwQuick'); startGift('gift', q ? q.value.trim() : ''); break;
        case 'dosearch': runSearch(); break;
        case 'pick': pickMember(arg); break;
        case 'amt': if (S.flow) { S.flow.amount = arg; paintGift(); } break;
        case 'gback': if (S.flow) { readAmount(); S.flow.step = 'search'; S.flow.error = ''; paintGift(); } break;
        case 'greview': reviewGift(); break;
        case 'gedit': if (S.flow) { S.flow.step = 'amount'; S.flow.error = ''; paintGift(); } break;
        case 'gsend': sendGift(); break;
        case 'pkg': if (S.flow) { var t = $('afwTarget'); if (t) S.flow.target = t.value; S.flow.pkg = arg; paintService(); } break;
        case 'svcreview': svcReview(); break;
        case 'svcback': if (S.flow) { S.flow.step = 'form'; paintService(); } break;
        case 'svcpay': svcPay(); break;
        case 'closeflow': closeFlow(); break;
        case 'p2p': if (window.AfrishineP2P) window.AfrishineP2P.open(); else toast('P2P Trading is not installed yet.'); break;
      }
    }
    function openSupport() {
      var s = S.cfg && S.cfg.support;
      if (s && s.url) { window.open(s.url, '_blank'); return; }
      if (s && s.email) { window.location.href = 'mailto:' + s.email; return; }
      toast('Support contact is not set yet.');
    }
    function adminDecide(btn, decision) {
      var card = btn.closest('[data-req]'); if (!card || btn.disabled) return;
      var id = card.getAttribute('data-req'), ast = card.querySelector('[data-ast]'), note = card.querySelector('[data-note]');
      if (decision === 'approve') {
        if (!validAmount(ast && ast.value)) { toast('Enter the AST amount to add.'); return; }
        if (!confirm('Add ' + Number(ast.value).toFixed(2) + ' AST to this member\'s wallet?')) return;
      } else if (!confirm('Reject this payment request?')) return;
      Array.prototype.forEach.call(card.querySelectorAll('button'), function (b) { b.disabled = true; });
      api('POST', '/wallet/admin/decide', { id: id, decision: decision, astAmount: ast ? ast.value.trim() : '', note: note ? note.value.trim() : '' }).then(function () {
        toast(decision === 'approve' ? 'Approved. AST added.' : 'Request rejected.'); loadAdmin();
      }, function (e) { toast(errMsg(e)); Array.prototype.forEach.call(card.querySelectorAll('button'), function (b) { b.disabled = false; }); loadAdmin(); });
    }
    function saveConfig(btn) {
      btn.disabled = true;
      var msg = $('afwcMsg'); if (msg) msg.innerHTML = '';
      var cfg;
      try { cfg = collectConfig(); } catch (e) { btn.disabled = false; if (msg) msg.innerHTML = '<div class="afw-err">Please check the fields and try again.</div>'; return; }
      api('POST', '/wallet/admin/config', cfg).then(function (j) { S.cfg = j.config; btn.disabled = false; if (msg) msg.innerHTML = '<div class="afw-ok">Settings saved.</div>'; },
        function (e) { btn.disabled = false; if (msg) msg.innerHTML = '<div class="afw-err">' + esc(errMsg(e)) + '</div>'; });
    }

    /* ------------------------------------------------------------------ open / close */
    function openWallet() {
      if (S.open) return;
      build();
      S.open = true; S.view = 'home'; S.stack = []; S.flow = null; S.err = '';
      root.classList.add('on');
      render();
      refreshAll();
      clearInterval(pollTimer);
      pollTimer = setInterval(softRefresh, 30000);
    }
    function closeWallet(navigate) {
      if (!S.open) return;
      S.open = false; S.flow = null; closeSheet();
      if (root) root.classList.remove('on');
      clearInterval(pollTimer);
      if (navigate) {
        if (typeof window.showPage === 'function') window.showPage(S.lastPage && S.lastPage !== 'wallet' ? S.lastPage : 'home');
        else window.location.hash = '#home';
      }
    }

    /* open whenever the "wallet" page becomes the active page (menu, button, link, back/forward) */
    var wasActive = page.classList.contains('active');
    if ('MutationObserver' in window) {
      new MutationObserver(function () {
        var a = page.classList.contains('active');
        if (a === wasActive) return;
        wasActive = a;
        if (a) openWallet(); else closeWallet(false);
      }).observe(page, { attributes: true, attributeFilter: ['class'] });
    }
    var prevShow = window.showPage;
    if (typeof prevShow === 'function') {
      window.showPage = function (id) {
        if (id && id !== 'wallet') S.lastPage = id;
        return prevShow.apply(this, arguments);
      };
    }
    try {
      if (typeof auth !== 'undefined' && auth && auth.onAuthStateChanged) {
        auth.onAuthStateChanged(function () { profiles = {}; S.sum = null; S.recent = null; S.err = ''; if (S.open) { render(); refreshAll(); } });
      }
    } catch (_) { }
    document.addEventListener('visibilitychange', function () { if (!document.hidden) softRefresh(); });
    if (wasActive) setTimeout(openWallet, 60);

    /* small public API for other scripts (for example a "Gift" button on a video) */
    window.AfrishineWallet = {
      open: function () { if (typeof window.showPage === 'function') window.showPage('wallet'); else openWallet(); },
      close: function () { closeWallet(true); },
      refresh: refreshAll,
      balance: function () { return S.sum ? S.sum.balance / 100 : null; },
      isPremium: function () { return !!(S.sum && S.sum.premium && S.sum.premium.active); },
      talentGift: function (uid, name) {
        openWallet();
        startGift('talent', '');
        var F = S.flow; if (F && uid) { F.results = [{ uid: uid, username: name || 'Member' }]; F.query = name || ''; paintGift(); }
      }
    };
  } catch (err) { console.warn('Afrishine Wallet not started:', err); }
})();