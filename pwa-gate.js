/* Afrishine Hub – PWA install + "actions go to Pi Browser" gate.
   Viewing stays free. Outside Pi Browser (and not on afrishine-skills) every action that needs
   a signed-in member (post, like, comment, follow, message, gift, wallet, Verified...) opens a
   sheet that sends the member to Afrishine Skills in Pi Browser. Email/Google sign-in stays usable. */
(function () {
  'use strict';
  var SKILLS = 'https://afrishine-skills.vercel.app/';
  function inPi() { try { return !!window.Pi || /PiBrowser/i.test(navigator.userAgent || ''); } catch (e) { return false; } }
  function onSkills() { return /^afrishine-skills/i.test(location.hostname) || !!window.AF_SKILLS; }
  function active() { return !inPi() && !onSkills(); }

  /* ---------- the gate sheet ---------- */
  var last = 0;
  function gate() {
    var now = Date.now(); if (now - last < 600) return; last = now;
    if (typeof window.afPiGate === 'function') { window.afPiGate(); return; }
    var ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.65);display:flex;align-items:flex-end;justify-content:center';
    ov.innerHTML = '<div style="background:#10131c;color:#fff;border-radius:18px 18px 0 0;padding:20px 18px 24px;max-width:480px;width:100%;box-sizing:border-box;font-family:inherit">' +
      '<h3 style="margin:0 0 8px">Continue in Pi Browser</h3>' +
      '<p style="margin:0 0 14px;opacity:.85;line-height:1.45">Posting, likes, comments, messages, gifts and your wallet work on <b>Afrishine Skills</b> inside <b>Pi Browser</b>. Copy the link and open it there.</p>' +
      '<button type="button" id="afGCopy" style="width:100%;padding:13px;border:0;border-radius:12px;background:#d4a62a;color:#111;font-weight:700;margin-bottom:8px">Copy link</button>' +
      '<button type="button" id="afGClose" style="width:100%;padding:12px;border:1px solid #333;border-radius:12px;background:transparent;color:#fff">Close</button></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function (e) { if (e.target === ov || e.target.id === 'afGClose') ov.remove(); });
    ov.querySelector('#afGCopy').addEventListener('click', function () {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(SKILLS).then(function () { ov.remove(); }, function () { prompt('Copy this link', SKILLS); });
      else prompt('Copy this link', SKILLS);
    });
  }
  window.afHubGate = gate;

  /* ---------- 1. wrap the global action functions ---------- */
  var FN = ['openCreateMenu', 'createAction', 'chooseMedia', 'publishTextPost', 'publishLovePost', 'previewPost',
    'sendDirectMessage', 'marketPublishProduct', 'marketOpenSell', 'afWalletToast', 'saveLoveProfile', 'editPost'];
  function wrapAll() {
    FN.forEach(function (n) {
      var f = window[n];
      if (typeof f !== 'function' || f.__afg) return;
      var w = function () { if (active()) { gate(); return; } return f.apply(this, arguments); };
      w.__afg = true; window[n] = w;
    });
    /* pages that are only for signed-in members */
    var sp = window.showPage;
    if (typeof sp === 'function' && !sp.__afg) {
      var w2 = function (id) { if (active() && (id === 'wallet' || id === 'inbox')) { gate(); return; } return sp.apply(this, arguments); };
      w2.__afg = true; window.showPage = w2;
    }
  }

  /* ---------- 2. capture clicks on dynamic buttons ---------- */
  var ACTION = /(^|[^a-z])(like|unlike|love|comment|reply|follow|unfollow|repost|gift|send|message|chat|dm|post|publish|upload|create|go[- ]?live|live|wallet|verified|vip|boost|subscribe|apply|book|join|save|report|block|vote)([^a-z]|$)/i;
  var SAFE = /(sign[- ]?in|sign[- ]?up|signin|signup|google|login|log[- ]?in|password|sign[- ]?out|signout|close|back|menu|search|share|copy|cancel|install|pi-?gate|afg)/i;
  function sig(el) {
    return [el.className && el.className.baseVal === undefined ? el.className : '', el.id || '', el.getAttribute('aria-label') || '',
      el.getAttribute('data-act') || '', el.getAttribute('data-action') || '', el.getAttribute('data-sk') || '', el.getAttribute('onclick') || '',
      (el.textContent || '').trim().slice(0, 30)].join(' ');
  }
  document.addEventListener('click', function (e) {
    if (!active()) return;
    var t = e.target; if (!t || !t.closest) return;
    if (t.closest('.as-ov,#afGateOv,[data-afg-skip]')) return;
    var el = t.closest('button,a,[role="button"],[data-act],[data-action]');
    if (!el) return;
    if (el.closest('#profile') && /sign|log|google|password|email/i.test(sig(el) + (el.closest('form') ? 'x' : ''))) return;
    var s = sig(el);
    if (SAFE.test(s)) return;
    if (!ACTION.test(s)) return;
    /* plain navigation links to pages are fine */
    if (el.tagName === 'A' && /^#(home|talent|love|travel|academy|jobs|shop|profile|settings|contact|community)/.test(el.getAttribute('href') || '')) return;
    e.preventDefault(); e.stopImmediatePropagation(); gate();
  }, true);

  /* comment / message forms and file pickers */
  document.addEventListener('submit', function (e) {
    if (!active()) return;
    var f = e.target;
    if (f && f.closest && f.closest('#profile') ) return;
    e.preventDefault(); e.stopImmediatePropagation(); gate();
  }, true);
  document.addEventListener('click', function (e) {
    if (!active()) return;
    var t = e.target;
    if (t && t.tagName === 'INPUT' && t.type === 'file') { e.preventDefault(); gate(); }
  }, true);

  /* ---------- 3. install button (Chrome/Android) + iPhone hint ---------- */
  var deferred = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; showInstall(); });
  window.addEventListener('appinstalled', function () { var b = document.getElementById('afInstallBtn'); if (b) b.remove(); });
  function standalone() { return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true; }
  function dismissed() { try { return localStorage.getItem('afInstallDismissed') === '1'; } catch (e) { return false; } }
  function showInstall() {
    if (standalone() || inPi() || onSkills() || dismissed() || document.getElementById('afInstallBtn')) return;
    var ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !deferred;
    var b = document.createElement('div'); b.id = 'afInstallBtn'; b.setAttribute('data-afg-skip', '1');
    b.style.cssText = 'position:fixed;left:12px;right:12px;bottom:76px;z-index:9000;background:#10131c;color:#fff;border:1px solid #d4a62a;border-radius:14px;padding:11px 12px;display:flex;align-items:center;gap:10px;font-size:14px;max-width:460px;margin:0 auto';
    b.innerHTML = '<span style="flex:1">' + (ios ? 'Install: tap <b>Share</b> then <b>Add to Home Screen</b>' : 'Install Afrishine Hub on your phone') + '</span>' +
      (ios ? '' : '<button type="button" id="afInstallGo" style="background:#d4a62a;color:#111;border:0;border-radius:10px;padding:8px 12px;font-weight:700">Install</button>') +
      '<button type="button" id="afInstallX" aria-label="Close" style="background:none;border:0;color:#fff;font-size:18px">×</button>';
    document.body.appendChild(b);
    var go = b.querySelector('#afInstallGo');
    if (go) go.addEventListener('click', function () { if (!deferred) return; deferred.prompt(); deferred.userChoice.then(function () { deferred = null; b.remove(); }); });
    b.querySelector('#afInstallX').addEventListener('click', function () { try { localStorage.setItem('afInstallDismissed', '1'); } catch (e) { } b.remove(); });
  }

  function init() {
    wrapAll(); setTimeout(wrapAll, 800); setTimeout(wrapAll, 2500);
    if (/iphone|ipad|ipod/i.test(navigator.userAgent)) setTimeout(showInstall, 4000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
