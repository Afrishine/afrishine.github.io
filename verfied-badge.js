/* Afrishine Hub: shows the Verified Badge next to verified members.
   Reads publicProfiles/{uid}.verified (the field the Admin Dashboard sets).
   Load AFTER push.js:  <script src="/verified-badge.js"></script>
   Tip: open the app with ?badgedebug=1 at the end of the address to see what the script found. */
(function () {
  'use strict';
  try {
    var TTL = 3 * 60 * 1000, MAX_LOOKUPS = 40;
    var verified = new Set(), listOk = false, lastTry = 0, loading = null, lastMemberUid = '', timer = null;
    var known = {};   // uid -> { v: boolean, t: time }; used only when the full list is not readable
    var debug = /[?&]badgedebug=1/.test(location.search);

    function tell(text) { try { if (debug && typeof notice === 'function') notice(text); } catch (e) { } }
    function dbx() { return (typeof db !== 'undefined') ? db : null; }
    function me() { return (typeof currentFirebaseUser !== 'undefined') ? currentFirebaseUser : null; }

    var style = document.createElement('style');
    style.textContent = '.af-verified{display:inline-block;width:17px;height:17px;margin-left:5px;vertical-align:-3px;flex-shrink:0;line-height:0}.af-verified svg{display:block;width:100%;height:100%}h2 .af-verified{width:22px;height:22px;vertical-align:-4px}';
    document.head.appendChild(style);

    // Professional "seal" badge (wavy edge + white check), drawn once as SVG. Change BADGE_COLOR to restyle it.
    var BADGE_COLOR = '#1d9bf0';
    var SEAL = (function () {
      var pts = [];
      for (var i = 0; i < 96; i++) {
        var a = i * Math.PI * 2 / 96, r = 9.4 + 1.3 * Math.cos(8 * a);
        pts.push((12 + r * Math.cos(a)).toFixed(2) + ' ' + (12 + r * Math.sin(a)).toFixed(2));
      }
      return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M' + pts.join(' L') + ' Z" fill="' + BADGE_COLOR + '"/><path d="M7.4 12.3l3.1 3.1 6-6.6" fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    })();

    function isVerified(uid) {
      if (!uid) return false;
      if (listOk) return verified.has(uid);
      return !!(known[uid] && known[uid].v);
    }

    function makeBadge(uid) {
      var s = document.createElement('span');
      s.className = 'af-verified';
      s.setAttribute('data-uid', uid);
      s.setAttribute('role', 'img');
      s.setAttribute('aria-label', 'Verified account');
      s.title = 'Verified';
      s.innerHTML = SEAL;
      return s;
    }

    function addTo(el, uid) {
      if (!el || !isVerified(uid)) return;
      var last = el.lastElementChild;
      if (last && last.classList && last.classList.contains('af-verified')) return;
      el.appendChild(makeBadge(uid));
    }

    function load() {
      var d = dbx();
      if (!d) return Promise.resolve();
      if (loading) return loading;
      lastTry = Date.now();
      loading = d.collection('publicProfiles').where('verified', '==', true).limit(500).get().then(function (snap) {
        var next = new Set();
        snap.docs.forEach(function (x) { next.add(x.id); });
        verified = next;
        listOk = true;
        tell('Verified badges: ' + verified.size + ' verified member(s) found.');
      }).catch(function (e) {
        console.warn('Verified badge list could not be loaded:', e);
        tell('Verified badges: list not readable (' + ((e && e.code) || 'error') + '). Checking members one by one.');
      }).then(function () { loading = null; });
      return loading;
    }

    // Fallback when the full list cannot be read: look at each member on screen.
    function lookup(uids) {
      var d = dbx();
      if (!d || listOk) return;
      var now = Date.now();
      var need = uids.filter(function (u, i) { return u && uids.indexOf(u) === i && (!known[u] || now - known[u].t > TTL); }).slice(0, MAX_LOOKUPS);
      if (!need.length) return;
      need.forEach(function (u) { known[u] = { v: !!(known[u] && known[u].v), t: now }; });   // mark first: never loops
      Promise.all(need.map(function (u) {
        return d.collection('publicProfiles').doc(u).get().then(function (s) {
          known[u] = { v: !!(s.exists && s.data().verified === true), t: Date.now() };
        }).catch(function () { });
      })).then(function () {
        tell('Verified badges: checked ' + need.length + ' member(s), ' + need.filter(function (u) { return known[u].v; }).length + ' verified.');
        schedule();
      });
    }

    function decorate() {
      var u = me(), uids = [];
      var authors = document.querySelectorAll('[data-open-profile]');
      Array.prototype.forEach.call(authors, function (b) { uids.push(b.getAttribute('data-open-profile')); });
      if (u) uids.push(u.uid);
      if (lastMemberUid) uids.push(lastMemberUid);
      lookup(uids);

      // Remove a badge from anybody who is no longer verified.
      Array.prototype.forEach.call(document.querySelectorAll('.af-verified'), function (x) {
        if (!isVerified(x.getAttribute('data-uid'))) x.remove();
      });
      // Post authors (Home, Talent Hub, Community, Love Connection).
      Array.prototype.forEach.call(authors, function (b) { addTo(b, b.getAttribute('data-open-profile')); });
      // My own profile.
      var mine = document.getElementById('ahDashboardName');
      if (mine && u) addTo(mine, u.uid);
      // A member's profile page.
      var member = document.querySelector('#memberProfileContent h2');
      if (member && lastMemberUid) addTo(member, lastMemberUid);
      // Refresh now and then so a newly verified member appears without reinstalling.
      if (Date.now() - lastTry > TTL) load().then(schedule);
    }

    function schedule() { clearTimeout(timer); timer = setTimeout(decorate, 120); }

    // Remember which member profile is open (the page does not show the member's id).
    var original = window.openMemberProfile;
    if (typeof original === 'function') {
      window.openMemberProfile = function (uid) {
        lastMemberUid = uid || '';
        return original.apply(this, arguments);
      };
    }

    if ('MutationObserver' in window) {
      new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    }
    if (typeof auth !== 'undefined' && auth && auth.onAuthStateChanged) {
      auth.onAuthStateChanged(function () {
        (loading || Promise.resolve()).then(function () { return load(); }).then(schedule);
      });
    }
    load().then(schedule);
  } catch (err) { console.warn('Verified badge not started:', err); }
})();