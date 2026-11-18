/* Afrishine Hub: shows the Verified Badge next to verified members.
   Reads publicProfiles/{uid}.verified (the field the Admin Dashboard sets).
   Load AFTER push.js:  <script src="verified-badge.js"></script>  */
(function () {
  'use strict';
  try {
    var TTL = 3 * 60 * 1000;                 // badge list is refreshed every 3 minutes
    var verified = new Set(), loadedAt = 0, loading = null, lastMemberUid = '', timer = null;

    function dbx() { return (typeof db !== 'undefined') ? db : null; }
    function me() { return (typeof currentFirebaseUser !== 'undefined') ? currentFirebaseUser : null; }

    var style = document.createElement('style');
    style.textContent = '.af-verified{display:inline-grid;place-items:center;width:17px;height:17px;margin-left:5px;border-radius:50%;background:#ffb91f;color:#171107;font-size:11px;font-weight:900;line-height:1;font-style:normal;vertical-align:middle;flex-shrink:0}';
    document.head.appendChild(style);

    function makeBadge(uid) {
      var s = document.createElement('span');
      s.className = 'af-verified';
      s.setAttribute('data-uid', uid);
      s.setAttribute('role', 'img');
      s.setAttribute('aria-label', 'Verified account');
      s.title = 'Verified';
      s.textContent = '✓';
      return s;
    }

    function addTo(el, uid) {
      if (!el || !uid || !verified.has(uid)) return;
      var last = el.lastElementChild;
      if (last && last.classList && last.classList.contains('af-verified')) return;
      el.appendChild(makeBadge(uid));
    }

    function load() {
      var d = dbx();
      if (!d) return Promise.resolve();
      if (loading) return loading;
      loading = d.collection('publicProfiles').where('verified', '==', true).limit(500).get().then(function (snap) {
        var next = new Set();
        snap.docs.forEach(function (x) { next.add(x.id); });
        verified = next;
        loadedAt = Date.now();
      }).catch(function (e) {
        console.warn('Verified badges could not be loaded:', e);
      }).then(function () { loading = null; });
      return loading;
    }

    function decorate() {
      // Remove a badge from anybody who is no longer verified.
      Array.prototype.forEach.call(document.querySelectorAll('.af-verified'), function (x) {
        if (!verified.has(x.getAttribute('data-uid'))) x.remove();
      });
      // Post authors (Home, Talent Hub, Community, Love Connection).
      Array.prototype.forEach.call(document.querySelectorAll('[data-open-profile]'), function (b) {
        addTo(b, b.getAttribute('data-open-profile'));
      });
      // My own profile.
      var u = me(), mine = document.getElementById('ahDashboardName');
      if (mine && u) addTo(mine, u.uid);
      // A member's profile page.
      var member = document.querySelector('#memberProfileContent h2');
      if (member && lastMemberUid) addTo(member, lastMemberUid);
      // Refresh the list now and then so a newly verified member appears without reinstalling.
      if (loadedAt && Date.now() - loadedAt > TTL) load().then(schedule);
    }

    function schedule() { clearTimeout(timer); timer = setTimeout(decorate, 120); }

    // Remember which member profile is open (the page itself does not show the member's id).
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
      auth.onAuthStateChanged(function () { loadedAt = 0; load().then(schedule); });
    }
    load().then(schedule);
  } catch (err) { console.warn('Verified badge not started:', err); }
})();
